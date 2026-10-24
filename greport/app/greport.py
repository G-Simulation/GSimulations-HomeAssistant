#!/usr/bin/env python3
"""GReport – Notizen zu Störungen festhalten (der Notiz-Teil von GLighter als eigene App).

- Notiz jetzt: Text, Schnellwahl (eigene Tasten, lernt mit), Zeuge, Zeitraum von–bis.
- Jede neue Notiz kommt ins Logbuch von Home Assistant.
- In Home Assistant (über MQTT): Textfeld „Notiz“, eine Auswahlliste je Gruppe, „Zeuge“, Knopf „Speichern“,
  Sensoren „Letzte Notiz“ und „Notizen heute“ – dazu weiterhin „Schnellwahl“ und „Hinzufügen“.
- Eigene Dashboard-Karte „GReport“ (custom:greport-card), die sich die Ingress-Adresse selbst holt.
- Ist GLighter (Pro) installiert, liest es die Notizen aus /share/greport und zeigt sie mit an.
Nur Python-Standardbibliothek (MQTT über paho, wenn vorhanden).
"""
import csv
import datetime as dt
import fcntl
import glob
import hashlib
import hmac
import http.server
import io
import json
import os
import re
import secrets
import socketserver
import sys
import threading
import time
import urllib.parse
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "web")
sys.path.insert(0, HERE)
import lizenz  # noqa: E402
import felder  # noqa: E402

VERSION = "1.12.9"
BRAND = "GReport"
OPTIONS = os.environ.get("GR_OPTIONS", "/data/options.json")
PRIV = os.environ.get("GR_PRIVATE", "/data")                    # nur für GReport (Pro-Schlüssel)
PORT = int(os.environ.get("GR_PORT", "8099"))
ALLOWED = {"172.30.32.2", "127.0.0.1", "::1"}                   # nur über Home Assistant (Ingress)
RESTRICT = os.environ.get("GR_ALLOW_ALL") != "1"
HAID = TOPIC = "greport"


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def read_json(p, default=None):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(p, data):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":")); f.flush(); os.fsync(f.fileno())
    os.replace(tmp, p)


OPT = {"language": "auto", "mqtt": True, "logbook": True, "output_dir": "/share/greport", "dashboard_card": True, "attach_max_mb": 25, "attach_total_mb": 500}
OPT.update({k: v for k, v in (read_json(OPTIONS, {}) or {}).items() if k in OPT})
DIR = os.environ.get("GR_DIR") or OPT["output_dir"] or "/share/greport"
GL_DIR = os.environ.get("GR_GLIGHTER_DIR", "/share/gaslighter")


def lang():
    return "en" if OPT.get("language") == "en" else "de"


def now_iso():
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def ms_of(iso):
    """ISO-Zeit -> ms. Mit Offset (so schickt es die Oberfläche, z. B. „2026-10-25T02:30:00+01:00“) genau dieser Zeitpunkt –
    auch in der doppelten Stunde bei der Zeitumstellung. Ohne Offset (ältere Daten, Import): Ortszeit des Add-ons, bei
    doppelter Stunde die erste (Sommerzeit), wie im Browser."""
    try:
        s_ = str(iso).strip()
        d = dt.datetime.fromisoformat(s_[:-1] + "+00:00" if s_.endswith(("Z", "z")) else s_)
        if d.tzinfo is None:
            d = d.astimezone()
        return int(d.timestamp() * 1000)
    except (ValueError, TypeError):
        return None


def iso_of(ms):
    return dt.datetime.fromtimestamp(ms / 1000.0).astimezone().isoformat(timespec="seconds")


def clean_text(v, n=500):
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(v or "")).strip()[:n]


# =====================================================================
# Pro (offline geprüfter Schlüssel; GReport- oder GLighter-Schlüssel)
# =====================================================================
def pro_file():
    return read_json(os.path.join(PRIV, "pro.json"), {}) or {}


PRO_CACHE = {"t": 0, "v": None}


def pro_info():
    if time.time() - PRO_CACHE["t"] > 60 or PRO_CACHE["v"] is None:
        k = pro_file().get("key") or ""
        PRO_CACHE.update(t=time.time(), v=lizenz.check(k))
    return dict(PRO_CACHE["v"], buy=lizenz.BUY_URL)


def pro_ok():
    return bool(pro_info().get("ok"))


def pro_set(key):
    key, r, shop = lizenz.resolve(key)  # Shop-Schlüssel (WordPress) werden einmal online getauscht
    if r.get("ok") or r.get("state") == "expired":
        rec = {"key": str(key).strip(), "at": now_iso()}
        if shop:
            rec["shop_key"] = shop
        write_json(os.path.join(PRIV, "pro.json"), rec)
        PRO_CACHE["v"] = None
    return r


# =====================================================================
# Schnellwahl (wie in GLighter): eingebaute Tasten, eigene, ausgeblendete, Reihenfolge nach Gebrauch, gelernte Vorschläge
# =====================================================================
NOTE_TAGS = {
    "src": ["oben", "unten", "nebenan", "treppenhaus", "tuer_o", "draussen", "unklar"],
    "kind": ["klopfen", "schritte", "musik", "stimmen", "tuer", "moebel", "bohren", "hund"],
    "lvl": ["leicht", "deutlich", "stark"],
    "eff": ["aufgewacht", "kind_geweckt", "kein_schlaf", "gestoert"],
    "act": ["geklingelt", "angesprochen", "verwaltung", "polizei"],
    "misc": ["zeuge", "serie"],
}
NOTE_TAG_SET = {t for v in NOTE_TAGS.values() for t in v}
# Rubrik „Zeitpunkt“: Tasten setzen die Zeit der Notiz (sie werden nicht als Wort gespeichert).
# Gerechnet wird immer vom Beginn der Erfassung (erstes Tippen), nicht vom Speichern.
# m = Minuten zurück, at = Uhrzeit (die letzte, die schon war), rng = ungefährer Zeitraum [von, bis], day = Tage zurück,
# none = Notiz ohne Zeitpunkt
WHEN_G = "when"
WHEN_DEF = {"w_now": {"m": 0}, "w_5": {"m": 5}, "w_15": {"m": 15}, "w_60": {"m": 60}, "w_night": {"rng": ["22:00", "06:00"]},
            "w_eve": {"rng": ["18:00", "22:00"], "day": 1}, "w_none": {"none": True}}
WHEN_DE = {"w_now": "gerade eben", "w_5": "vor 5 Min.", "w_15": "vor 15 Min.", "w_60": "vor 1 Std.", "w_night": "heute Nacht",
           "w_eve": "gestern Abend", "w_none": "ohne Zeitpunkt"}
WHEN_EN = {"w_now": "just now", "w_5": "5 min ago", "w_15": "15 min ago", "w_60": "1 hour ago", "w_night": "last night",
           "w_eve": "yesterday evening", "w_none": "no time"}
WHEN_MAX = 30
TAG_DE = {"oben": "oben", "unten": "unten", "nebenan": "nebenan", "treppenhaus": "Treppenhaus", "tuer_o": "Tür", "draussen": "draußen", "unklar": "unklar",
          "klopfen": "Klopfen", "schritte": "Schritte", "musik": "Musik/Bass", "stimmen": "Stimmen", "tuer": "Türenknallen", "moebel": "Möbelrücken",
          "bohren": "Bohren", "hund": "Hund", "leicht": "leicht", "deutlich": "deutlich", "stark": "stark", "aufgewacht": "aufgewacht",
          "kind_geweckt": "Kind geweckt", "kein_schlaf": "kein Einschlafen", "gestoert": "gestört", "geklingelt": "geklingelt",
          "angesprochen": "angesprochen", "verwaltung": "Hausverwaltung informiert", "polizei": "Polizei/Ordnungsamt", "zeuge": "Zeuge anwesend",
          "serie": "wiederholt"}
TAG_EN = {"oben": "above", "unten": "below", "nebenan": "next door", "treppenhaus": "stairwell", "tuer_o": "door", "draussen": "outside", "unklar": "unclear", "klopfen": "knocking", "schritte": "footsteps", "musik": "music/bass", "stimmen": "voices", "tuer": "door slamming", "moebel": "moving furniture", "bohren": "drilling", "hund": "dog", "leicht": "slight", "deutlich": "clear", "stark": "strong", "aufgewacht": "woke up", "kind_geweckt": "child woken", "kein_schlaf": "could not sleep", "gestoert": "disturbed", "geklingelt": "rang the bell", "angesprochen": "talked to them", "verwaltung": "informed management", "polizei": "police/authority", "zeuge": "witness present", "serie": "repeated"}
QT_LOCK = threading.RLock()
QT = {"data": None}
QT_OWN_FREE, QT_OWN_MAX, QT_WORDS_MAX, QT_SUGGEST_N = 5, 40, 400, 3        # ohne Pro: 5 eigene Tasten
QT_STOP = set("""aber alle allem allen aller alles also auch auf aus bei beim bin bis bist dann darf das dass dem den denn der des dich die dies diese
diesem diesen dieser dir doch dort durch eine einem einen einer eines etwa euch eure fast fuer für gegen geht gibt habe haben hast hat hatte hatten heute
hier ihm ihn ihr ihre immer ist jede jedem jeden jeder jetzt kann kein keine konnte machen macht mal man mehr mein meine mich mir mit muss nach nicht
nichts noch nur oben oder ohne schon sehr sein seine seit sich sie sind soll sondern über um und uns unser unten vom von vor war waren warum was weil
weiter wenn wer werden wie wieder wir wird wo wurde zum zur zwei drei viel wohl ganz gerade gleich lang lange laut leise minuten stunde stunden uhr ca
morgens abends nachts mittags nacht abend morgen tag tage about after again also and any are because been before being both but can could did does
doing down during each few for from further had has have having her here hers him his how into its just more most not now off once only other our out
over own same she should some such than that the their them then there these they this those through too under until very was were what when where
which while who whom why will with would you your loud noise""".split())


def qt_path():
    return os.path.join(DIR, "schnellwahl.json")


def qt_all():
    with QT_LOCK:
        if QT["data"] is None:
            d = read_json(qt_path(), {})
            QT["data"] = d if isinstance(d, dict) else {}
        for k in ("own", "hide", "use", "words", "nope", "ren", "grp", "gcol", "req", "when", "groups", "gren", "ghide", "gone", "ghelp"):
            if not isinstance(QT["data"].get(k), dict):
                QT["data"][k] = {}
        for k in ("order", "gorder"):
            if not isinstance(QT["data"].get(k), list):
                QT["data"][k] = []
        if QT["data"].get("mode") not in ("use", "fixed"):
            QT["data"]["mode"] = "use"               # Reihenfolge: nach Gebrauch (häufigste zuerst) oder fest (selbst angeordnet)
        return QT["data"]


def qt_save():
    if QT.get("batch"):                                  # mehrere Änderungen auf einmal („Layout anpassen“ → Fertig): erst am Ende speichern
        QT["dirty"] = True
        return
    with QT_LOCK:
        write_json(qt_path(), qt_all())
    mqtt_announce()
    diary_soon()


def qt_clean_label(v):
    return re.sub(r"\s+", " ", re.sub(r"[\x00-\x1f<>]", "", str(v or ""))).strip()[:30]


def tag_ok(t):
    if not isinstance(t, str):
        return False
    if t in NOTE_TAG_SET:
        return True
    o = qt_all()["own"].get(t)
    return isinstance(o, dict) and not o.get("del")


def tag_label(t, lg=None):
    d = qt_all(); o = d["own"].get(t)
    if isinstance(o, dict):
        return o.get("l") or t
    o = d["when"].get(t)
    if isinstance(o, dict):
        return o.get("l") or t
    if d["ren"].get(t):                                   # eingebautes Wort umbenannt
        return d["ren"][t]
    if t in WHEN_DEF:
        return (WHEN_EN if (lg or lang()) == "en" else WHEN_DE)[t]
    return (TAG_EN if (lg or lang()) == "en" else TAG_DE).get(t, t)


def when_spec(k):
    """Zeitpunkt-Taste: {"m": Minuten} | {"at": "HH:MM", "day": n} | {"none": True}; None = keine Zeit-Taste."""
    if k in WHEN_DEF:
        return WHEN_DEF[k]
    o = qt_all()["when"].get(k)
    if isinstance(o, dict) and not o.get("del"):
        return {x: o[x] for x in ("m", "at", "day", "rng") if x in o}
    return None


def when_keys(visible=True):
    d = qt_all()
    keys = [k for k in WHEN_DEF if not (visible and d["hide"].get(k))]
    keys += [k for k, o in d["when"].items() if isinstance(o, dict) and not o.get("del")]
    return keys


def _hm(s_, base):
    hh, mm = (int(x) for x in s_.split(":"))
    return base.replace(hour=hh, minute=mm, second=0, microsecond=0)


def when_range(sp, now):
    """Ungefährer Zeitraum: Beginn = letzter vergangener „von“ (bzw. vor „day“ Tagen), Ende = „bis“ danach, höchstens jetzt."""
    a = _hm(sp["rng"][0], now)
    if sp.get("day"):
        a -= dt.timedelta(days=int(sp["day"]))
    elif a > now:
        a -= dt.timedelta(days=1)
    b = _hm(sp["rng"][1], a)
    if b <= a:
        b += dt.timedelta(days=1)
    return a, min(b, now)


def when_apply(k, now=None):
    """Zeitpunkt-Taste → (von als ISO, ohne Zeitpunkt?). Ungefähre Tasten: when_apply_full liefert auch „bis“."""
    f, _, nt, _ = when_apply_full(k, now)
    return f, nt


def when_apply_full(k, now=None):
    """→ (von, bis, ohne Zeitpunkt, ungefähr); now = Beginn der Erfassung."""
    sp = when_spec(k) or {}
    now = now or dt.datetime.now().astimezone()
    if sp.get("none"):
        return "", "", True, False
    if sp.get("rng"):
        a, b = when_range(sp, now)
        return a.isoformat(timespec="seconds"), b.isoformat(timespec="seconds") if b > a else "", False, True
    if "at" in sp:
        hh, mm = (int(x) for x in sp["at"].split(":"))
        t = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
        if sp.get("day"):
            t -= dt.timedelta(days=int(sp["day"]))
        elif t > now:
            t -= dt.timedelta(days=1)
        return t.isoformat(timespec="seconds"), "", False, False
    return (now - dt.timedelta(minutes=int(sp.get("m") or 0))).replace(microsecond=0).isoformat(timespec="seconds"), "", False, False


def group_custom():
    return {g: o for g, o in qt_all()["groups"].items() if isinstance(o, dict) and not o.get("del")}


def word_groups():
    """Rubriken, in die Wörter dürfen: eingebaute (ohne „Zeitpunkt“) und eigene."""
    return GROUPS + list(group_custom())


def groups_all():
    """Alle Rubriken in der angezeigten Reihenfolge: eingebaute, „Zeitpunkt“, eigene; selbst angeordnet über gorder."""
    base = GROUPS[:-1] + [WHEN_G] + list(group_custom()) + ["own"]
    pos = {g: i for i, g in enumerate(qt_all()["gorder"])}
    return sorted(base, key=lambda g: (pos.get(g, 10 ** 6), base.index(g)))


def group_label(g, lg=None):
    d = qt_all(); de = (lg or lang()) != "en"
    if g in group_custom():
        return group_custom()[g].get("l") or g
    if d["gren"].get(g):
        return d["gren"][g]
    if g == WHEN_G:
        return "Zeitpunkt" if de else "Time"
    return (GROUP_DE if de else GROUP_EN).get(g, g)


def clean_tags(v):
    return list(dict.fromkeys(t for t in v if tag_ok(t)))[:12] if isinstance(v, list) else []


QT_OWN_PRO_MAX = 200


def own_max():
    """Eigene Tasten: frei 5; mit Pro einstellbar (Standard 40, höchstens 200)."""
    if not pro_ok():
        return QT_OWN_FREE
    try:
        return max(QT_OWN_FREE, min(QT_OWN_PRO_MAX, int(qt_all().get("limit") or QT_OWN_MAX)))
    except (TypeError, ValueError):
        return QT_OWN_MAX


def show_n():
    """Pro: so viele Tasten je Gruppe zeigen (0 = alle), der Rest hinter „mehr“."""
    if not pro_ok():
        return 0
    try:
        return max(0, min(50, int(qt_all().get("show") or 0)))
    except (TypeError, ValueError):
        return 0


def qt_learn(tags, text):
    with QT_LOCK:
        d = qt_all()
        for t in tags or []:
            d["use"][t] = int(d["use"].get(t) or 0) + 1
        labels = {(o.get("l") or "").lower() for o in d["own"].values() if isinstance(o, dict) and not o.get("del")}
        labels |= {x.lower() for x in TAG_DE.values()} | {x.lower() for x in TAG_EN.values()}
        labels |= {str(x).lower() for x in d["ren"].values()}
        seen = set()
        for w in re.findall(r"[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\-]{3,23}", str(text or "")):
            lw = w.lower().strip("-")
            if len(lw) < 4 or lw in seen or lw in QT_STOP or lw in labels or lw in NOTE_TAG_SET or d["nope"].get(lw):
                continue
            seen.add(lw)
            e = d["words"].get(lw) if isinstance(d["words"].get(lw), dict) else {"n": 0, "w": w}
            e["n"] = int(e.get("n") or 0) + 1
            if w[:1].isupper():
                e["w"] = w
            d["words"][lw] = e
        if len(d["words"]) > QT_WORDS_MAX:
            for k in sorted(d["words"], key=lambda k: int(d["words"][k].get("n") or 0))[:len(d["words"]) - QT_WORDS_MAX]:
                d["words"].pop(k, None)
        write_json(qt_path(), d)


def qt_state():
    with QT_LOCK:
        d = qt_all()
        labels = {(o.get("l") or "").lower() for o in d["own"].values() if isinstance(o, dict) and not o.get("del")}
        sug = sorted(((k, e) for k, e in d["words"].items() if isinstance(e, dict) and int(e.get("n") or 0) >= QT_SUGGEST_N
                      and not d["nope"].get(k) and k not in labels), key=lambda x: -int(x[1].get("n") or 0))
        return {"ok": True, "tags": NOTE_TAGS, "own_max": own_max(), "pro": pro_ok(), "groups": GROUPS,
                "ren": {k: v for k, v in d["ren"].items() if (k in NOTE_TAG_SET or k in WHEN_DEF) and v}, "grp": {k: v for k, v in d["grp"].items() if v in word_groups()},
                "order": [k for k in d["order"] if tag_known(k)], "mode": d["mode"],
                "gcol": {g: c for g, c in d["gcol"].items() if g in groups_all() and re.fullmatch(r"#[0-9a-fA-F]{6}", str(c))},
                "req": sorted(g for g, v in d["req"].items() if v and g in groups_all()),
                "gone": sorted(g for g, v in d["gone"].items() if v and g in groups_all()),          # nur eine Auswahl in dieser Rubrik
                "ghelp": {g: str(v)[:160] for g, v in d["ghelp"].items() if v and g in groups_all()},   # Hilfetext unter der Rubrik
                "gall": [{"g": g, "l": group_label(g), "custom": g in group_custom(), "hide": bool(d["ghide"].get(g)), "renamed": bool(d["gren"].get(g))}
                         for g in groups_all()],
                "when": [dict({"k": k, "l": tag_label(k), "own": k not in WHEN_DEF, "hide": bool(d["hide"].get(k))}, **(when_spec(k) or {}))
                         for k in when_keys(False)], "when_max": WHEN_MAX,
                "limit": own_max(), "show": show_n(), "pro_max": QT_OWN_PRO_MAX,
                "own": [{"k": k, "l": o.get("l") or k, "del": bool(o.get("del"))} for k, o in d["own"].items() if isinstance(o, dict)],
                "hide": sorted(k for k, v in d["hide"].items() if v and (k in NOTE_TAG_SET or k in WHEN_DEF)),
                "use": {k: int(v or 0) for k, v in d["use"].items() if isinstance(v, (int, float))},
                "suggest": [{"w": e.get("w") or k, "k": k, "n": int(e.get("n") or 0)} for k, e in sug[:5]]}


GROUPS = ["src", "kind", "lvl", "eff", "act", "misc", "own"]     # Woher, Was, Wie stark, Folgen, Maßnahmen, Sonstiges, Eigene


def tag_known(t):
    return isinstance(t, str) and (t in NOTE_TAG_SET or isinstance(qt_all()["own"].get(t), dict) or when_spec(t) is not None)


def tag_group(k):
    """Gruppe einer Taste: selbst zugeordnet, sonst die eingebaute; eigene Tasten ohne Zuordnung = „Eigene“."""
    if when_spec(k) is not None:
        return WHEN_G
    g = qt_all()["grp"].get(k)
    if g in word_groups():
        return g
    return next((g for g, v in NOTE_TAGS.items() if k in v), "own")


def qt_change(data):
    """Mehrere Änderungen in einem Rutsch (action „batch“, ops = Liste) – gespeichert wird einmal am Ende."""
    if str(data.get("action") or "") == "batch":
        ops = data.get("ops") if isinstance(data.get("ops"), list) else []
        errs, made = [], {}
        with QT_LOCK:
            QT["batch"] = True; QT["dirty"] = False
            try:
                for i, op in enumerate(ops[:600]):
                    if not isinstance(op, dict) or op.get("action") == "batch":
                        continue
                    r = qt_change_one(op)
                    if not r.get("ok"):
                        errs.append({"i": i, "action": op.get("action"), "error": r.get("error")})
                    for x in ("k", "g"):
                        if r.get(x) and op.get(x) and r[x] != op[x]:
                            made[op[x]] = r[x]
            finally:
                QT["batch"] = False
            if QT.pop("dirty", False):
                qt_save()
        return dict(qt_state(), errors=errs, made=made)
    return qt_change_one(data)


def qt_change_one(data):
    """Schnellwahl verwalten: add (l, g), ren (k, l – auch eingebaute), del (k), undel (k), hide (k, on), nope (w),
    grp (k, g), order (keys), mode (use|fixed), reset (eingebaute Wörter, Reihenfolge und Gruppen auf Standard)."""
    a = str(data.get("action") or "")
    with QT_LOCK:
        d = qt_all()
        k = str(data.get("k") or "")
        if a == "grp":
            if not tag_known(k) or when_spec(k) is not None or data.get("g") not in word_groups():
                return {"ok": False, "error": "not found"}
            dflt = next((g for g, v in NOTE_TAGS.items() if k in v), "own")
            if data["g"] == dflt:
                d["grp"].pop(k, None)
            else:
                d["grp"][k] = data["g"]
            qt_save()
            return qt_state()
        if a == "order":
            keys = [x for x in (data.get("keys") or []) if tag_known(x)] if isinstance(data.get("keys"), list) else None
            if keys is None:
                return {"ok": False, "error": "bad request"}
            d["order"] = list(dict.fromkeys(keys))[:200]; d["mode"] = "fixed"
            qt_save()
            return qt_state()
        if a in ("limit", "show"):                           # Pro: Anzahl eigener Tasten / Tasten je Gruppe
            if not pro_ok():
                return {"ok": False, "error": "pro"}
            try:
                n = int(data.get("n"))
            except (TypeError, ValueError):
                return {"ok": False, "error": "bad request"}
            d[a] = max(QT_OWN_FREE, min(QT_OWN_PRO_MAX, n)) if a == "limit" else max(0, min(50, n))
            qt_save()
            return qt_state()
        if a in ("req", "gone"):                              # Pflicht (nur Hinweis, gespeichert wird immer) / nur eine Auswahl
            g = data.get("g")
            if g not in groups_all():
                return {"ok": False, "error": "not found"}
            if data.get("on"):
                d[a][g] = True
            else:
                d[a].pop(g, None)
            qt_save()
            return qt_state()
        if a == "ghelp":                                      # Hilfetext einer Rubrik (leer = keiner)
            g = data.get("g")
            if g not in groups_all():
                return {"ok": False, "error": "not found"}
            h = cap_clean(data.get("h"), 160)
            if h:
                d["ghelp"][g] = h
            else:
                d["ghelp"].pop(g, None)
            qt_save()
            return qt_state()
        if a == "gcol":                                       # Farbe einer Gruppe (leer = Standardfarbe)
            g, c = data.get("g"), str(data.get("c") or "")
            if g not in groups_all():
                return {"ok": False, "error": "not found"}
            if re.fullmatch(r"#[0-9a-fA-F]{6}", c):
                d["gcol"][g] = c.lower()
            else:
                d["gcol"].pop(g, None)
            qt_save()
            return qt_state()
        if a == "mode":
            d["mode"] = "fixed" if data.get("mode") == "fixed" else "use"
            qt_save()
            return qt_state()
        if a == "reset":
            d["ren"] = {}; d["grp"] = {k_: v for k_, v in d["grp"].items() if k_ not in NOTE_TAG_SET}; d["hide"] = {}; d["order"] = []; d["mode"] = "use"
            d["gren"] = {}; d["ghide"] = {}; d["gorder"] = []           # Rubriken: Namen, Ausblenden, Reihenfolge wieder wie geliefert
            d["gone"] = {}; d["ghelp"] = {}
            qt_save()
            return qt_state()
        if a == "ren" and (k in NOTE_TAG_SET or k in WHEN_DEF):   # eingebautes Wort umbenennen (alte Notizen behalten den Schlüssel)
            l = qt_clean_label(data.get("l"))
            dflt = (TAG_EN.get(k) or WHEN_EN.get(k)) if lang() == "en" else (TAG_DE.get(k) or WHEN_DE.get(k))
            if not l or l == dflt:
                d["ren"].pop(k, None)
            else:
                d["ren"][k] = l
            qt_save()
            return qt_state()
        if a == "add":
            l = qt_clean_label(data.get("l"))
            if not l:
                return {"ok": False, "error": "empty"}
            for k_, o in d["own"].items():
                if isinstance(o, dict) and (o.get("l") or "").lower() == l.lower():
                    o["del"] = False; o["l"] = l; break
            else:
                if sum(1 for o in d["own"].values() if isinstance(o, dict) and not o.get("del")) >= own_max():
                    return {"ok": False, "error": "limit" if pro_ok() else "limit_free"}
                k_ = str(data.get("k") or "")                  # „Layout anpassen“ vergibt die Kennung schon vorher
                if not re.fullmatch(r"c_[0-9a-f]{6}", k_) or k_ in d["own"]:
                    k_ = "c_" + secrets.token_hex(3)
                d["own"][k_] = {"l": l, "ts": now_iso()}
                if data.get("g") in word_groups() and data.get("g") != "own":
                    d["grp"][k_] = data["g"]
                if d["mode"] == "fixed":
                    d["order"].append(k_)
            d["words"].pop(l.lower(), None)
            qt_save()
            return dict(qt_state(), k=k_)
        if a == "wadd" or a == "wset":                       # eigene Zeitpunkt-Taste: Name + Minuten zurück oder feste Uhrzeit
            l = qt_clean_label(data.get("l"))
            sp = {}
            at = str(data.get("at") or "").strip()
            if re.fullmatch(r"([01]?\d|2[0-3]):[0-5]\d", at):
                sp["at"] = "%02d:%s" % (int(at.split(":")[0]), at.split(":")[1])
            else:
                try:
                    sp["m"] = max(0, min(7 * 24 * 60, int(data.get("m"))))
                except (TypeError, ValueError):
                    return {"ok": False, "error": "bad request"}
            if a == "wset":
                o = d["when"].get(k)
                if not isinstance(o, dict):
                    return {"ok": False, "error": "not found"}
                for x in ("m", "at", "day"):
                    o.pop(x, None)
                o.update(sp)
                if l:
                    o["l"] = l
                qt_save()
                return qt_state()
            if not l:
                return {"ok": False, "error": "empty"}
            if sum(1 for o in d["when"].values() if isinstance(o, dict) and not o.get("del")) >= WHEN_MAX:
                return {"ok": False, "error": "limit"}
            k_ = str(data.get("k") or "")
            if not re.fullmatch(r"t_[0-9a-f]{6}", k_) or k_ in d["when"]:
                k_ = "t_" + secrets.token_hex(3)
            d["when"][k_] = dict(sp, l=l, ts=now_iso())
            if d["mode"] == "fixed":
                d["order"].append(k_)
            qt_save()
            return dict(qt_state(), k=k_)
        if a == "gadd":                                       # eigene Rubrik
            l = qt_clean_label(data.get("l"))
            if not l:
                return {"ok": False, "error": "empty"}
            if len(group_custom()) >= 20:
                return {"ok": False, "error": "limit"}
            g = str(data.get("g") or "")
            if not re.fullmatch(r"g_[0-9a-f]{6}", g) or g in d["groups"]:
                g = "g_" + secrets.token_hex(3)
            d["groups"][g] = {"l": l, "ts": now_iso()}
            qt_save()
            return dict(qt_state(), g=g)
        if a in ("gren", "gdel", "ghide"):
            g = str(data.get("g") or "")
            if g not in groups_all():
                return {"ok": False, "error": "not found"}
            if a == "gren":
                l = qt_clean_label(data.get("l"))
                if g in group_custom():
                    if not l:
                        return {"ok": False, "error": "empty"}
                    d["groups"][g]["l"] = l
                elif not l or l == (("Time" if lang() == "en" else "Zeitpunkt") if g == WHEN_G else (GROUP_EN if lang() == "en" else GROUP_DE).get(g)):
                    d["gren"].pop(g, None)
                else:
                    d["gren"][g] = l
            elif a == "gdel":                                 # nur eigene Rubriken; ihre Wörter kommen nach „Eigene“
                if g not in group_custom():
                    return {"ok": False, "error": "not found"}
                d["groups"][g]["del"] = True
                d["grp"] = {k_: v for k_, v in d["grp"].items() if v != g}
            elif data.get("on"):
                d["ghide"][g] = True
            else:
                d["ghide"].pop(g, None)
            qt_save()
            return qt_state()
        if a == "gorder":
            gs = data.get("groups")
            if not isinstance(gs, list):
                return {"ok": False, "error": "bad request"}
            ok = set(groups_all())
            d["gorder"] = list(dict.fromkeys(g for g in gs if g in ok))
            qt_save()
            return qt_state()
        if a in ("ren", "del", "undel"):
            o = d["own"].get(k)
            if not isinstance(o, dict):
                o = d["when"].get(k)
            if not isinstance(o, dict):
                return {"ok": False, "error": "not found"}
            if a == "ren":
                l = qt_clean_label(data.get("l"))
                if not l:
                    return {"ok": False, "error": "empty"}
                o["l"] = l
            else:
                o["del"] = a == "del"
            qt_save()
            return qt_state()
        if a == "hide":
            if k not in NOTE_TAG_SET and k not in WHEN_DEF:
                return {"ok": False, "error": "not found"}
            if data.get("on"):
                d["hide"][k] = True
            else:
                d["hide"].pop(k, None)
            qt_save()
            return qt_state()
        if a == "nope":
            w = str(data.get("w") or "").lower()[:24]
            if w:
                d["nope"][w] = True; d["words"].pop(w, None)
                qt_save()
            return qt_state()
    return {"ok": False, "error": "bad action"}


def qt_visible():
    """Sichtbare Tasten (für die Auswahlliste in Home Assistant): [(Schlüssel, Beschriftung)].
    Reihenfolge wie in der App: selbst angeordnet, sonst nach Gruppen."""
    d = qt_all(); keys = []
    for g in NOTE_TAGS.values():
        keys += [t for t in g if not d["hide"].get(t)]
    keys += [k for k, o in d["own"].items() if isinstance(o, dict) and not o.get("del")]
    keys = [k for k in keys if not d["ghide"].get(tag_group(k))]          # ausgeblendete Rubrik: auch in Home Assistant weg
    if d["mode"] == "fixed" and d["order"]:
        pos = {k: i for i, k in enumerate(d["order"])}
        keys.sort(key=lambda k: pos.get(k, 10 ** 6))
    return [(k, tag_label(k)) for k in keys]


def qt_groups():
    """Sichtbare Tasten je Gruppe (eine Auswahlliste pro Gruppe in Home Assistant); eigene Tasten kommen in ihre Gruppe."""
    out = {g: [] for g in word_groups()}
    for k, l in qt_visible():
        out.setdefault(tag_group(k), []).append((k, l))
    if not qt_all()["ghide"].get(WHEN_G):
        out[WHEN_G] = [(k, tag_label(k)) for k in when_keys()]
    return out


def mqtt_groups():
    """Auswahllisten in Home Assistant: (Gruppe, Kürzel, Name, Symbol) – eingebaute, „Zeitpunkt“, eigene Rubriken."""
    de = lang() == "de"
    out = [(g, GROUP_SLUG[g], group_label(g), GROUP_ICON[g]) for g in GROUPS]
    out.append((WHEN_G, "zeitpunkt", group_label(WHEN_G), "mdi:clock-outline"))
    out += [(g, "rubrik_" + g[2:], group_label(g), "mdi:shape-outline") for g in group_custom()]
    return out


# =====================================================================
# Anzeige: Datum und Uhrzeit (gilt in der App und im Export)
# =====================================================================
PREF_DEF = {"date": "dmy4", "time": "hms", "rel": True, "wd": False, "gl": True, "tips": True, "tipmode": "hover", "width": "wide", "dens": "normal"}   # tipmode: hover = nur beim Zeigen auf den Bereich, always, off   # width: wide = ganze Breite, narrow = schmale Spalte
WIDTHS = ("wide", "narrow")   # tips: Hinweise in der App zeigen   # gl: Notizen an GLighter weitergeben
DATE_FMTS = ("dmy4", "dmy2", "wdm", "iso", "long")
TIME_FMTS = ("hms", "hm", "h12")
CAP_SECS = ("txt", "tags", "wit", "more", "time")                # Bereiche von „Notiz jetzt“ (Reihenfolge einstellbar)
CAP_MAX = {"cap_title": 60, "cap_sub": 160}             # eigene Überschrift und eigener Hinweis (leer = Standardtext)
TIPMODES = ("hover", "always", "off")
DENS = ("normal", "compact")                            # Dichte von „Notiz jetzt“
_GID = re.compile(r"^[A-Za-z0-9_]{1,24}$")


def cap_keys(v, full=False):
    """Bereiche/Felder von „Notiz jetzt“ (eingebaute oder eigene b_…), ohne Doppelte. full: fehlende eingebaute hinten an."""
    o = [x for x in dict.fromkeys(v if isinstance(v, list) else []) if isinstance(x, str) and (x in CAP_SECS or felder.BID.match(x))][:80]
    return o + [x for x in CAP_SECS if x not in o] if full and o else o


def pop_clean(p):
    """Ansicht „abgedockt“ (eigenes Fenster): nur Anzeige – Reihenfolge und ausgeblendete Bereiche, ausgeblendete Rubriken,
    Tipps und Dichte. Fehlende Werte folgen der angedockten Ansicht. Kein dict = keine eigene Ansicht (folgt angedockt)."""
    if not isinstance(p, dict):
        return None
    out = {"cap_order": cap_keys(p.get("cap_order"), True), "hide": cap_keys(p.get("hide")),
           "ghide": [x for x in dict.fromkeys(p.get("ghide") if isinstance(p.get("ghide"), list) else []) if isinstance(x, str) and _GID.match(x)][:60]}
    if p.get("tipmode") in TIPMODES:
        out["tipmode"] = p["tipmode"]
    if p.get("dens") in DENS:
        out["dens"] = p["dens"]
    if not out["cap_order"]:
        out.pop("cap_order")
    return out


def cap_clean(v, n):
    return re.sub(r"\s+", " ", re.sub(r"[\x00-\x1f<>]", "", str(v or ""))).strip()[:n]


def prefs():
    d = read_json(os.path.join(DIR, "einstellungen.json"), {}) or {}
    out = dict(PREF_DEF)
    if d.get("date") in DATE_FMTS:
        out["date"] = d["date"]
    if d.get("time") in TIME_FMTS:
        out["time"] = d["time"]
    if d.get("width") in WIDTHS:
        out["width"] = d["width"]
    if d.get("tipmode") in TIPMODES:
        out["tipmode"] = d["tipmode"]
    if d.get("dens") in DENS:
        out["dens"] = d["dens"]
    for k in ("rel", "wd", "gl", "tips"):
        if isinstance(d.get(k), bool):
            out[k] = d[k]
    for k in ("sechide", "sechide_pop"):                 # Schnell-Schalter ● / ○ je Ansicht (fehlt sechide_pop: wie angedockt)
        if isinstance(d.get(k), list):
            out[k] = cap_keys(d[k])
    if isinstance(d.get("pop"), dict):
        out["pop"] = pop_clean(d["pop"])
    t_ = tbl_clean(d.get("tbl"))
    if t_:
        out["tbl"] = t_
    for k, n in CAP_MAX.items():
        if isinstance(d.get(k), str) and cap_clean(d[k], n):
            out[k] = cap_clean(d[k], n)
    if isinstance(d.get("cap_order"), list):
        o = [x for x in dict.fromkeys(d["cap_order"]) if x in CAP_SECS or felder.BID.match(str(x))]
        if o:
            out["cap_order"] = o + [x for x in CAP_SECS if x not in o]
    return out


def tbl_clean(v):
    """Tabelle (ab 1.11): Reihenfolge, gezeigte Spalten und Breiten – je Ansicht (breit „w“ / schmal „n“)."""
    if not isinstance(v, dict):
        return None
    cid = re.compile(r"^(?:[a-z]{2,12}|b_[0-9a-f]{6})$")
    out = {}
    for k in ("w", "n"):
        x = v.get(k)
        if not isinstance(x, dict):
            continue
        o = {}
        if isinstance(x.get("order"), list):
            o["order"] = [c for c in dict.fromkeys(str(c) for c in x["order"][:80]) if cid.match(c)]
        if isinstance(x.get("vis"), dict):
            o["vis"] = {str(c): bool(b) for c, b in list(x["vis"].items())[:80] if cid.match(str(c)) and isinstance(b, bool)}
        if isinstance(x.get("wd"), dict):
            o["wd"] = {str(c): int(n) for c, n in list(x["wd"].items())[:80] if cid.match(str(c)) and isinstance(n, (int, float)) and 40 <= n <= 1200}
        if o:
            out[k] = o
    return out or None


def prefs_set(d):
    cur = prefs()
    if d.get("date") in DATE_FMTS:
        cur["date"] = d["date"]
    if d.get("time") in TIME_FMTS:
        cur["time"] = d["time"]
    if d.get("width") in WIDTHS:
        cur["width"] = d["width"]
    if d.get("tipmode") in TIPMODES:
        cur["tipmode"] = d["tipmode"]; cur["tips"] = d["tipmode"] != "off"
    if d.get("dens") in DENS:
        cur["dens"] = d["dens"]
    for k in ("rel", "wd", "gl", "tips"):
        if isinstance(d.get(k), bool):
            cur[k] = d[k]
    drop = []
    for k in ("sechide", "sechide_pop"):
        if k in d:
            if isinstance(d[k], list):
                cur[k] = cap_keys(d[k])
            else:                                        # null: sechide_pop folgt wieder der angedockten Ansicht
                cur.pop(k, None); drop.append(k)
    if "tbl" in d:                                       # Tabelle: Reihenfolge/Spalten/Breiten (null = zurücksetzen)
        t_ = tbl_clean(d["tbl"])
        if t_:
            cur["tbl"] = t_
        else:
            cur.pop("tbl", None); drop.append("tbl")
    if "pop" in d:                                       # eigene abgedockte Ansicht (dict) oder wie angedockt (null)
        p = pop_clean(d["pop"])
        if p is None:
            cur.pop("pop", None); drop.append("pop")
        else:
            cur["pop"] = p
    for k, n in CAP_MAX.items():                         # leer = Standardtext
        if k in d:
            v = cap_clean(d[k], n)
            if v:
                cur[k] = v
            else:
                cur.pop(k, None); drop.append(k)
    if "cap_order" in d:
        o = [x for x in dict.fromkeys(d["cap_order"] if isinstance(d["cap_order"], list) else []) if x in CAP_SECS or felder.BID.match(str(x))]
        o = o + [x for x in CAP_SECS if x not in o] if o else []
        if o and o != list(CAP_SECS):
            cur["cap_order"] = o
        else:
            cur.pop("cap_order", None); drop.append("cap_order")
    allp = read_json(os.path.join(DIR, "einstellungen.json"), {}) or {}
    for k in drop:
        allp.pop(k, None)
    allp.update(cur)                                     # andere Einstellungen (z. B. Textdatei) bleiben
    write_json(os.path.join(DIR, "einstellungen.json"), allp)
    if "gl" in d:
        heartbeat()                                      # GLighter erfährt sofort, ob es die Notizen zeigen darf
        log("Notizen an GLighter:", "weitergeben" if cur["gl"] else "nicht weitergeben")
    diary_soon()                                         # Tagebuch im neuen Datumsformat
    return dict(cur, ok=True)


# =====================================================================
# Eigene Felder (felder.json): Bausteine der Erfassung, Name/Hilfe/Pflicht/Ausblenden der eingebauten Bereiche, Vorlage.
# Werte stehen je Notiz in "fields" (freiwillig) – alte Notizen, Export, Sicherung und Nachweis bleiben gültig.
# Fehlt felder.json, ist alles wie bisher („Lärm und Störungen“).
# =====================================================================
FB_LOCK = threading.RLock()
FB = {"data": None}
TPLS = ("laerm", "allg", "zaehler")
TPL_GROUPS = ["src", "kind", "lvl", "eff", "act", "misc"]          # eingebaute Rubriken, die nur zu Lärm gehören


def fb_path():
    return os.path.join(DIR, "felder.json")


BOUND_IDS = {"witness": "b_00a001", "ext:freq": "b_00a002", "ext:pol": "b_00a003", "ext:pol_nr": "b_00a004", "ext:rep_to": "b_00a005",
             "ext:rep_date": "b_00a006", "ext:health": "b_00a007", "ext:attest": "b_00a008", "ext:threat": "b_00a009"}


def bound_seed(sec):
    """Zeuge und „Mehr“ als Standard-Felder (ab 1.12). Name, Hinweis, Pflicht und „ausgeblendet“ des bisherigen Bereichs werden übernommen."""
    de = lang() != "en"
    L = lambda a, b: a if de else b
    wit, more = (sec or {}).get("wit") or {}, (sec or {}).get("more") or {}
    rep = [L("Hausverwaltung", "Property management"), L("Vermieter", "Landlord"), L("Sonstige", "Other")]
    raw = [("witness", "person", wit.get("l") or L("Zeuge", "Witness"), {"h": wit.get("h"), "req": wit.get("req"), "hide": wit.get("hide")}),
           ("ext:freq", "text", L("Häufigkeit", "Frequency"), {"ph": L("z. B. jede Nacht seit 3 Wochen", "e.g. every night for 3 weeks"), "max": 80}),
           ("ext:pol", "yesno", L("Polizei gerufen", "Police called"), {}),
           ("ext:pol_nr", "text", L("Vorgangsnummer der Polizei", "Police reference number"), {"max": 40}),
           ("ext:rep_to", "select", L("Gemeldet an", "Reported to"), {"opts": rep}),
           ("ext:rep_date", "datetime", L("Gemeldet am", "Reported on"), {"kind": "date"}),
           ("ext:health", "text", L("Gesundheitliche Folgen", "Health effects"), {"ml": True, "max": 300}),
           ("ext:attest", "text", L("Attest / ärztliche Bescheinigung", "Medical certificate"), {"max": 200}),
           ("ext:threat", "yesno", L("Drohung oder Gewalt", "Threat or violence"), {})]
    out = []
    for bind, typ, l, extra in raw:
        d = dict({"id": BOUND_IDS[bind], "type": typ, "l": l, "bind": bind}, **{k: v for k, v in extra.items() if v not in (None, "", False)})
        if bind != "witness":
            d["fold"] = True
            if more.get("hide"):
                d["hide"] = True
        c = felder.clean_def(d)
        if c:
            out.append(c)
    return out


def kinds_seed(tpl):
    """Erste Notiz-Arten (vor 1.11 gab es keine): aus der Vorlage, Namen in der Sprache der Einstellung."""
    de = lang() != "en"
    return [dict(k, l=k["l"] if de else {"Erinnerung": "Reminder", "Idee": "Idea"}.get(k["l"], k["l"])) for k in felder.KIND_TPL.get(tpl or "laerm") or []]


def fb_all():
    with FB_LOCK:
        if FB["data"] is None:
            d = read_json(fb_path(), {}) or {}
            d = d if isinstance(d, dict) else {}
            blocks, _ = felder.clean_defs(d.get("blocks") or [], [])
            seed = not d.get("bound_v")
            if seed:                                       # einmalig: Zeuge und „Mehr“ werden normale Felder (Werte bleiben, wo sie sind)
                have = {b.get("bind") for b in blocks}
                blocks += [b for b in bound_seed(d.get("sec")) if b["bind"] not in have]
            FB["data"] = {"v": 1, "blocks": blocks, "sec": felder.clean_sec(d.get("sec")),
                          "kinds": felder.clean_kinds(d.get("kinds") if "kinds" in d else kinds_seed(d.get("tpl")), []),   # noch nie Arten: „Erinnerung“ anbieten
                          "kind_def": d.get("kind_def") if felder.KID.match(str(d.get("kind_def") or "")) else "", "kind_keep": d.get("kind_keep") is True,
                          "tpl": d.get("tpl") if d.get("tpl") in TPLS + ("eigen",) else None,
                          "made": {k: v for k, v in (d.get("made") or {}).items() if isinstance(k, str) and isinstance(v, str)} if isinstance(d.get("made"), dict) else {},
                          "bound_v": 1}
            if seed:
                sc = FB["data"]["sec"]                     # alte Bereiche treten zurück: der Zeuge ist jetzt ein Feld, „Mehr“ nur noch die Klappe für eingeklappte Felder
                sc["wit"] = dict(sc.get("wit") or {}, hide=True)
                if os.path.exists(fb_path()):
                    write_json(fb_path(), FB["data"])
        return FB["data"]


def fb_defs():
    return fb_all()["blocks"]


def fb_save():
    with FB_LOCK:
        write_json(fb_path(), fb_all())
    mqtt_announce()
    diary_soon()


def fb_first():
    """Erster Start: noch nichts angelegt (keine Notizen, keine Schnellwahl, keine Felder) → Vorlage anbieten."""
    if os.path.exists(fb_path()) or os.path.exists(qt_path()):
        return False
    with NOTES_LOCK:
        a = notes_all()
        return not a["free"] and not a["trash"]


def fb_state():
    with FB_LOCK:
        f = fb_all()
        out = {"ok": True, "tpl": f["tpl"] or ("laerm" if not fb_first() else None), "first": fb_first(), "blocks": json.loads(json.dumps(f["blocks"])),
               "sec": json.loads(json.dumps(f["sec"])), "max": felder.MAX_ACTIVE, "tpls": list(TPLS), "counts": {}, "daily": {}, "sug": {},
               "kinds": json.loads(json.dumps(f.get("kinds") or [])), "kind_def": f.get("kind_def") or "", "kind_keep": bool(f.get("kind_keep")), "kind_n": {}}
        with NOTES_LOCK:
            for x in notes_all().get("free") or []:
                if x.get("kind"):
                    out["kind_n"][x["kind"]] = out["kind_n"].get(x["kind"], 0) + 1
    want = [b for b in out["blocks"] if not b.get("del") and (b["type"] in ("counter", "place") or (b["type"] == "text" and b.get("sug")))]
    if want:
        ns = notes_list(limit=None)
        t0 = int(dt.datetime.now().astimezone().replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)
        for b in want:
            if b["type"] == "counter":
                out["counts"][b["id"]] = felder.counter_sum(ns, b["id"], t0)
                out["daily"][b["id"]] = felder.daily(ns, b["id"])
            else:
                out["sug"][b["id"]] = felder.suggestions(ns, b["id"])
    return out


def fb_change(d):
    """set: Bausteine (blocks) und eingebaute Bereiche (sec) übernehmen; tpl: Vorlage anwenden (löscht nie etwas)."""
    a = str(d.get("action") or "")
    with FB_LOCK:
        f = fb_all()
        if a == "set":
            errs = []
            if "blocks" in d:
                f["blocks"], errs = felder.clean_defs(d.get("blocks"), f["blocks"])
            if "sec" in d:
                f["sec"] = felder.clean_sec(d.get("sec"))
            if "kinds" in d:                                  # Notiz-Arten (ab 1.11)
                f["kinds"] = felder.clean_kinds(d.get("kinds"), f.get("kinds") or [])
            if "kind_def" in d:
                f["kind_def"] = felder.kind_ok(f.get("kinds"), str(d.get("kind_def") or ""))
            if "kind_keep" in d:
                f["kind_keep"] = d.get("kind_keep") is True
            if not f["tpl"]:
                f["tpl"] = "laerm"
            fb_save()
            return dict(fb_state(), errors=errs)
        if a == "tpl":
            if d.get("tpl") not in TPLS:
                return {"ok": False, "error": "bad tpl"}
            tpl_apply(d["tpl"], d.get("lang"))
            return dict(fb_state(), qt=qt_state(), prefs=prefs())
    return {"ok": False, "error": "bad action"}


def tpl_apply(name, ui_lang=None):
    """Vorlage anwenden: nur Sichtbarkeit, Namen und Reihenfolge – nie Notizen, Tasten, Rubriken oder Felder löschen.
    Von einer Vorlage angelegte Dinge (made) werden beim Wechsel nur ausgeblendet und beim nächsten Mal wieder benutzt.
    Neue Namen (z. B. „Zähler“) in der Sprache der Oberfläche (ui_lang, ab 1.10.1), sonst der Einstellung."""
    de = ui_lang != "en" if ui_lang in ("de", "en") else lang() != "en"
    with QT_LOCK, FB_LOCK:
        q, f = qt_all(), fb_all()
        made, sec = f["made"], f["sec"]
        for k in felder.SEC_KEYS:                                  # eingebaute Bereiche: alle zeigen, Vorlagen-Namen weg
            e = sec.get(k) or {}
            e.pop("hide", None)
            if made.get("l_" + k) and e.get("l") == made["l_" + k]:
                e.pop("l", None)
            sec[k] = e
        if made.get("own_l") and q["gren"].get("own") == made["own_l"]:
            q["gren"].pop("own", None)
        for g in TPL_GROUPS + [WHEN_G, "own"]:
            q["ghide"].pop(g, None)
        for b in f["blocks"]:                                      # Felder einer Vorlage ausblenden
            if b["id"] in made.values():
                b["hide"] = True
        bound = {b.get("bind"): b for b in f["blocks"] if b.get("bind") and not b.get("del")}   # Standard-Felder (Zeuge, „Mehr“): jede Vorlage zeigt sie wieder
        for b in bound.values():
            b.pop("hide", None)
        wb = bound.get("witness")
        if wb and made.get("l_wit") and wb.get("l") == made["l_wit"]:
            wb["l"] = "Zeuge" if de else "Witness"
        order = []
        if name == "allg":
            for g in TPL_GROUPS:
                q["ghide"][g] = True
            if not q["gren"].get("own"):
                q["gren"]["own"] = made["own_l"] = "Stichworte" if de else "Keywords"
            if not sec["wit"].get("l"):
                sec["wit"]["l"] = made["l_wit"] = "Person"
            if wb:
                wb["l"] = made["l_wit"] = "Person"
            for b in bound.values():
                if b.get("fold"):
                    b["hide"] = True
            sec["more"]["hide"] = True
        elif name == "zaehler":
            bid = made.get("counter")
            b = next((x for x in f["blocks"] if x["id"] == bid), None)
            if b is None:
                bid = felder.new_id({x["id"] for x in f["blocks"]}, lambda: secrets.token_hex(3))
                b = felder.clean_def({"id": bid, "type": "counter", "l": "Zähler" if de else "Counter", "mode": "entry", "minus": True})
                f["blocks"].append(b); made["counter"] = bid
            b.pop("hide", None); b.pop("del", None)
            for k in ("txt", "tags", "wit", "more"):
                sec[k]["hide"] = True
            for b in bound.values():
                b["hide"] = True
            order = [bid, "time"]
        have = {k["id"] for k in f.get("kinds") or []}               # Notiz-Arten der Vorlage ergänzen (vorhandene bleiben, wie sie sind)
        for k in felder.KIND_TPL.get(name) or []:
            if k["id"] not in have:
                k = dict(k, l=k["l"] if de else {"Erinnerung": "Reminder", "Idee": "Idea"}.get(k["l"], k["l"]))
                f["kinds"] = (f.get("kinds") or []) + [felder.clean_kind(k)]
            else:
                for x in f["kinds"]:
                    if x["id"] == k["id"]:
                        x.pop("hide", None); x.pop("del", None)
        if bound:
            sec["wit"]["hide"] = True                              # der alte Zeugen-Bereich bleibt weg, der Zeuge ist ein Feld
        f["sec"] = felder.clean_sec(sec); f["tpl"] = name
        write_json(qt_path(), q)
        write_json(fb_path(), f)
    prefs_set({"cap_order": order, "pop": None})          # abgedockt folgt danach wieder der neuen Vorlage
    mqtt_announce(); diary_soon()


def fb_fields(data):
    """Werte aus der Oberfläche prüfen → (fields, Fehler)."""
    return felder.clean_fields(fb_defs(), data.get("fields"))


def fb_dt(d):
    return fmt_date(d) + " " + fmt_time(d)


def fb_txt(p, sep="; "):
    return felder.compact_txt(fb_defs(), p.get("fields"), lang() != "en", fb_dt, sep)


MON_DE = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."]
MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
WD_DE = ["Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa.", "So."]
WD_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def fmt_date(d, p=None):
    p = p or prefs(); en = lang() == "en"
    f = p["date"]
    if f == "dmy2":
        s = d.strftime("%d.%m.%y")
    elif f == "wdm":
        s = (WD_EN if en else WD_DE)[d.weekday()] + " " + d.strftime("%d.%m.")
    elif f == "iso":
        s = d.strftime("%Y-%m-%d")
    elif f == "long":
        s = f"{d.day}. {(MON_EN if en else MON_DE)[d.month - 1]} {d.year}" if not en else f"{d.day} {MON_EN[d.month - 1]} {d.year}"
    else:
        s = d.strftime("%d.%m.%Y")
    if p["wd"] and f != "wdm":
        s = (WD_EN if en else WD_DE)[d.weekday()] + " " + s
    return s


def fmt_time(d, p=None):
    p = p or prefs()
    if p["time"] == "hm":
        return d.strftime("%H:%M")
    if p["time"] == "h12":
        return (d.strftime("%I:%M:%S %p")).lstrip("0")
    return d.strftime("%H:%M:%S")


# =====================================================================
# Personen / Zeugen (Pro: Liste zum Antippen)
# =====================================================================
ROLES = ("mitbewohner", "nachbar", "hausverwaltung", "vermieter", "polizei", "sonstige")
ROLE_DE = {"mitbewohner": "Mitbewohner", "nachbar": "Nachbar", "hausverwaltung": "Hausverwaltung", "vermieter": "Vermieter", "polizei": "Polizei", "sonstige": "Sonstige"}
ROLE_EN = {"mitbewohner": "flatmate", "nachbar": "neighbour", "hausverwaltung": "property management", "vermieter": "landlord", "polizei": "police", "sonstige": "other"}
REP_TO = ("hv", "verm", "sonst")
REP_DE = {"hv": "Hausverwaltung", "verm": "Vermieter", "sonst": "Sonstige Stelle"}
REP_EN = {"hv": "property management", "verm": "landlord", "sonst": "other office"}


def role_of(v):
    v = str(v or "").strip().lower()
    for k in ROLES:
        if v in (k, ROLE_DE[k].lower(), ROLE_EN[k].lower()):
            return k
    return ""


def persons():
    d = read_json(os.path.join(DIR, "personen.json"), {}) or {}
    return [p for p in d.get("list", []) if isinstance(p, str)][:50]


def persons_info():
    """Zu den Namen (Liste bleibt wie bisher): Rolle und Erreichbarkeit, {Name: {"r": Rolle, "c": Erreichbarkeit}}."""
    d = read_json(os.path.join(DIR, "personen.json"), {}) or {}
    i = d.get("info") if isinstance(d.get("info"), dict) else {}
    return {k: {"r": role_of(v.get("r")), "c": clean_text(v.get("c"), 120)} for k, v in i.items() if isinstance(v, dict)}


def persons_set(lst, info=None):
    """Zeilen „Name“ oder „Name; Rolle; Erreichbarkeit“."""
    if not pro_ok():
        return {"ok": False, "error": "pro"}
    names, inf = [], {}
    for x in (lst if isinstance(lst, list) else []):
        parts = [p.strip() for p in str(x or "").split(";")]
        n = clean_text(parts[0], 80)
        if not n or n in names:
            continue
        names.append(n)
        r, c = role_of(parts[1] if len(parts) > 1 else ""), clean_text(parts[2] if len(parts) > 2 else "", 120)
        if isinstance(info, dict) and isinstance(info.get(n), dict):
            r = role_of(info[n].get("r")) or r; c = clean_text(info[n].get("c"), 120) or c
        if r or c:
            inf[n] = {"r": r, "c": c}
    names = names[:50]
    write_json(os.path.join(DIR, "personen.json"), {"list": names, "info": {k: v for k, v in inf.items() if k in names}})
    return {"ok": True, "list": names, "info": persons_info()}


EXT_TXT = {"freq": 80, "pol_nr": 40, "health": 300, "attest": 200, "wcontact": 120}


def clean_ext(v):
    """Weitere Angaben je Notiz (alle freiwillig): Häufigkeit, Polizei mit Vorgangsnummer, Meldung an Hausverwaltung/Vermieter
    mit Datum, gesundheitliche Folgen, Vermerk Attest, Drohung/Gewalt, Rolle und Erreichbarkeit des Zeugen."""
    if not isinstance(v, dict):
        return {}
    out = {k: clean_text(v.get(k), n) for k, n in EXT_TXT.items() if clean_text(v.get(k), n)}
    for k in ("pol", "threat"):
        if v.get(k) is True:
            out[k] = True
    if v.get("rep_to") in REP_TO:
        out["rep_to"] = v["rep_to"]
    if re.fullmatch(r"\d{4}-\d\d-\d\d", str(v.get("rep_date") or "")):
        out["rep_date"] = v["rep_date"]
    if role_of(v.get("wrole")):
        out["wrole"] = role_of(v.get("wrole"))
    if out.get("pol_nr"):
        out["pol"] = True
    return out


# =====================================================================
# Notizen (notizen.json: {"free": [...], "trash": [...]}) – gleiches Format wie die freien Notizen in GLighter
# =====================================================================
NOTES_LOCK = threading.RLock()
NOTES = {"data": None}
NOTES_MAX = 20000


def notes_path():
    return os.path.join(DIR, "notizen.json")


def notes_all():
    with NOTES_LOCK:
        fresh = NOTES["data"] is None
        if fresh:
            d = read_json(notes_path(), {})
            NOTES["data"] = d if isinstance(d, dict) else {}
        for k in ("free", "trash"):
            if not isinstance(NOTES["data"].get(k), list):
                NOTES["data"][k] = []
        if fresh:                                         # Nachweis: Protokoll zum gerade geladenen Stand
            PROTO["state"] = None
            try:
                proto_init()
            except Exception as e:
                log("Protokoll:", e)
        return NOTES["data"]


def notes_save():
    with NOTES_LOCK:
        write_json(notes_path(), notes_all())
        try:
            proto_sync()                                 # Nachweis: jede Änderung ins Protokoll
        except Exception as e:
            log("Protokoll:", e)
    mqtt_notes()

# =====================================================================
# Nachweis: Änderungsprotokoll mit Prüfsummenkette (nur anhängen)
# notizen_protokoll.jsonl – je Zeile ein Vorgang (start, add, edit, del, restore, extern) mit dem vollständigen Inhalt der Notiz
# danach (bei edit auch der vorigen Fassung). hash = SHA-256(prev_hash + "\n" + kanonisches JSON des Eintrags ohne hash/mac).
# mac = dasselbe als HMAC-SHA256 mit einem Schlüssel in /data (liegt nicht bei den Daten in /share): wer nur /share ändern kann,
# kann die Kette so nicht unbemerkt neu berechnen. notizen.json bleibt unverändert im bisherigen Format.
# =====================================================================
PROTO_LOCK = NOTES_LOCK                                  # eine Sperre für Notizen und Protokoll (keine Verklemmung)
PROTO = {"state": None, "last": None, "n": 0}
PROTO_ZERO = "0" * 64


def proto_path():
    return os.path.join(DIR, "notizen_protokoll.jsonl")


def canon(o):
    return json.dumps(o, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def proto_key():
    """Geheimer Schlüssel für die HMAC (einmal erzeugt, in /data). None, wenn /data nicht beschreibbar ist."""
    p = os.path.join(PRIV, "nachweis_schluessel.json")
    k = read_json(p, None) if os.path.exists(p) else None
    if isinstance(k, dict) and re.fullmatch(r"[0-9a-f]{64}", str(k.get("k", ""))):
        return k["k"]
    try:
        os.makedirs(PRIV, exist_ok=True)
        k = secrets.token_hex(32); write_json(p, {"k": k, "ts": now_iso()})
        return k
    except OSError:
        return None


def proto_hashes(prev, e, key=None):
    body = {x: v for x, v in e.items() if x not in ("hash", "mac")}
    c = (prev + "\n" + canon(body)).encode("utf-8")
    return hashlib.sha256(c).hexdigest(), (hmac.new(bytes.fromhex(key), c, hashlib.sha256).hexdigest() if key else None)


def tz_name():
    return os.environ.get("TZ") or time.strftime("%Z") or ""


def proto_read():
    """Alle Einträge (roh). Kaputte Zeilen kommen als {"_bad": Zeilentext}."""
    out = []
    try:
        with open(proto_path(), encoding="utf-8") as f:
            for line in f:
                line = line.rstrip("\n")
                if not line.strip():
                    continue
                try:
                    e = json.loads(line)
                    out.append(e if isinstance(e, dict) else {"_bad": line[:200]})
                except ValueError:
                    out.append({"_bad": line[:200]})
    except OSError:
        pass
    return out


def proto_replay(entries):
    """Stand nach dem Protokoll: {"free": {id: Notiz}, "trash": {id: Notiz}}."""
    st = {"free": {}, "trash": {}}
    for e in entries:
        op = e.get("op")
        if op == "start":
            st = {"free": {str(x.get("id")): x for x in e.get("notes") or [] if isinstance(x, dict)},
                  "trash": {str(x.get("id")): x for x in e.get("trash") or [] if isinstance(x, dict)}}
        elif op in ("add", "edit", "restore", "extern") and isinstance(e.get("note"), dict):
            st["free"][str(e.get("id"))] = e["note"]; st["trash"].pop(str(e.get("id")), None)
        elif op in ("del",):
            st["free"].pop(str(e.get("id")), None)
            if isinstance(e.get("note"), dict):
                st["trash"][str(e.get("id"))] = e["note"]
        elif op == "extern_del":
            st["free"].pop(str(e.get("id")), None)
            if isinstance(e.get("note"), dict):
                st["trash"][str(e.get("id"))] = e["note"]
    return st


def proto_append(op, nid, note=None, prev=None, extra=None):
    with PROTO_LOCK:
        key = proto_key()
        now = dt.datetime.now().astimezone()
        e = {"n": PROTO["n"], "t": int(now.timestamp() * 1000), "iso": now.isoformat(timespec="milliseconds"), "tz": tz_name(), "op": op, "id": nid,
             "prev_hash": PROTO["last"] or PROTO_ZERO}
        if note is not None:
            e["note"] = note
        if prev is not None:
            e["prev"] = prev
        if extra:
            e.update(extra)
        h, m = proto_hashes(e["prev_hash"], e, key)
        e["hash"] = h
        if m:
            e["mac"] = m
        os.makedirs(DIR, exist_ok=True)
        with open(proto_path(), "a", encoding="utf-8") as f:
            f.write(canon(e) + "\n"); f.flush()
            try:
                os.fsync(f.fileno())
            except OSError:
                pass
        PROTO["last"] = h; PROTO["n"] += 1
        return e


def proto_init():
    """Beim ersten Mal: Start-Eintrag mit den vorhandenen Notizen. Sonst Stand aus dem Protokoll laden und mit notizen.json
    vergleichen – Abweichungen (außerhalb von GReport geändert) werden als „extern“ festgehalten, nicht verschwiegen."""
    with PROTO_LOCK, NOTES_LOCK:
        if PROTO["state"] is not None:
            return
        ents = [e for e in proto_read() if "_bad" not in e]
        a = notes_all()
        if not ents:
            PROTO.update(last=None, n=0)
            proto_append("start", "", extra={"notes": a["free"], "trash": a["trash"], "app": BRAND, "v": VERSION})
            PROTO["state"] = {"free": {str(x.get("id")): json.loads(canon(x)) for x in a["free"]},
                              "trash": {str(x.get("id")): json.loads(canon(x)) for x in a["trash"]}}
            return
        PROTO["last"] = ents[-1].get("hash"); PROTO["n"] = int(ents[-1].get("n", len(ents) - 1)) + 1
        PROTO["state"] = proto_replay(ents)
        proto_sync(extern=True)


def proto_sync(extern=False):
    """Jede Änderung an den Notizen ins Protokoll (aufgerufen beim Speichern)."""
    with PROTO_LOCK, NOTES_LOCK:
        st = PROTO["state"]
        if st is None:
            return
        a = notes_all()
        free = {str(x.get("id")): x for x in a["free"]}
        trash = {str(x.get("id")): x for x in a["trash"]}
        for nid, x in free.items():
            old = st["free"].get(nid)
            if old is None:
                op = "extern" if extern else ("restore" if nid in st["trash"] else "add")
                proto_append(op, nid, x, extra={"by": x.get("by") or "app"})
            elif canon(old) != canon(x):
                proto_append("extern" if extern else "edit", nid, x, prev=old)
        for nid in list(st["free"]):
            if nid not in free:
                if extern:
                    proto_append("extern_del", nid, trash.get(nid), prev=st["free"][nid])
                else:
                    proto_append("del", nid, trash.get(nid) or dict(st["free"][nid], deleted=now_iso()))
        PROTO["state"] = {"free": {k: json.loads(canon(v)) for k, v in free.items()}, "trash": {k: json.loads(canon(v)) for k, v in trash.items()}}


def _vt(de, en, **kw):
    s_ = en if lang() == "en" else de
    return s_.format(**kw)


def proto_verify():
    """Kette nachrechnen und mit notizen.json vergleichen. Ändert nichts."""
    ents = proto_read()
    key_p = os.path.join(PRIV, "nachweis_schluessel.json")
    kd = read_json(key_p, None) if os.path.exists(key_p) else None
    key = kd.get("k") if isinstance(kd, dict) else None
    probs, warns, prev, macs = [], [], PROTO_ZERO, 0
    good = []
    for i, e in enumerate(ents):
        if "_bad" in e:
            probs.append({"line": i + 1, "what": _vt("Zeile {i} ist kein gültiger Eintrag", "Line {i} is not a valid entry", i=i + 1)}); prev = None; continue
        if prev is not None and e.get("prev_hash") != prev:
            probs.append({"line": i + 1, "id": e.get("id"), "what": _vt("Zeile {i}: Verkettung unterbrochen (Eintrag fehlt, wurde eingefügt oder verschoben)",
                                                                         "Line {i}: chain broken (entry missing, inserted or moved)", i=i + 1)})
        h, m = proto_hashes(e.get("prev_hash") or "", e, key if e.get("mac") else None)
        if h != e.get("hash"):
            probs.append({"line": i + 1, "id": e.get("id"), "what": _vt("Zeile {i}: Inhalt passt nicht zur Prüfsumme (nachträglich geändert)",
                                                                         "Line {i}: content does not match its hash (changed afterwards)", i=i + 1)})
        elif e.get("mac"):
            if key and m != e["mac"]:
                probs.append({"line": i + 1, "id": e.get("id"), "what": _vt("Zeile {i}: Schlüssel-Prüfsumme passt nicht (Kette wurde neu berechnet)",
                                                                             "Line {i}: keyed hash does not match (chain was recomputed)", i=i + 1)})
            else:
                macs += 1
        if i == 0 and e.get("op") != "start":
            probs.append({"line": 1, "what": _vt("Der Start-Eintrag fehlt", "The start entry is missing")})
        if e.get("op") in ("extern", "extern_del"):
            warns.append({"line": i + 1, "id": e.get("id"), "t": e.get("iso"),
                          "what": _vt("Am {t} wurde eine Änderung außerhalb von GReport festgestellt (Notiz {id})",
                                      "On {t} a change made outside GReport was detected (note {id})", t=e.get("iso", "?"), id=e.get("id"))})
        prev = e.get("hash"); good.append(e)
    st = proto_replay(good)
    disk = read_json(notes_path(), {}) or {}
    free = {str(x.get("id")): x for x in (disk.get("free") or []) if isinstance(x, dict)}
    for nid, x in free.items():
        if nid not in st["free"]:
            probs.append({"id": nid, "what": _vt("Notiz {id} steht in notizen.json, aber nicht im Protokoll", "Note {id} is in notizen.json but not in the log", id=nid)})
        elif canon(x) != canon(st["free"][nid]):
            probs.append({"id": nid, "what": _vt("Notiz {id} in notizen.json weicht vom Protokoll ab", "Note {id} in notizen.json differs from the log", id=nid)})
    for nid in st["free"]:
        if nid not in free:
            probs.append({"id": nid, "what": _vt("Notiz {id} fehlt in notizen.json", "Note {id} is missing from notizen.json", id=nid)})
    av = att_verify(good)                                # Anlagen: Protokoll, anlagen.json und Prüfsumme jeder Datei
    probs += av["problems"]
    first, last = (ents[0] if ents and "_bad" not in ents[0] else {}), (ents[-1] if ents and "_bad" not in ents[-1] else {})
    return {"ok": bool(ents) and not probs, "n": len(ents), "notes": len(free), "first_hash": first.get("hash"), "last_hash": last.get("hash"),
            "since": first.get("iso"), "last": last.get("iso"), "problems": probs[:200], "warnings": warns[:200], "keyed": macs, "now": now_iso(),
            "tz": tz_name(), "clock": clock_text(), "ntp": ha_clock(), "files": av["n"], "files_active": av["active"], "empty": not ents}


def proto_history(nid):
    nid = str(nid or "")
    return [{"op": e.get("op"), "t": e.get("t"), "iso": e.get("iso"), "note": e.get("note"), "prev": e.get("prev"), "hash": e.get("hash")}
            for e in proto_read() if "_bad" not in e and (e.get("id") == nid or (e.get("op") == "start" and any(str(x.get("id")) == nid for x in e.get("notes") or [])))]


def proof_block():
    v = proto_verify()
    return {"anzahl_notizen": v["notes"], "eintraege": v["n"], "erster_hash": v["first_hash"], "letzter_hash": v["last_hash"],
            "erstellt": now_iso(), "zeitzone": v["tz"], "unveraendert": v["ok"], "zeitquelle": v["clock"], "anlagen": v["files_active"]}


def proof_text(pb):
    de = lang() != "en"
    rows = [("Prüfblock" if de else "Verification block", ""), ("Notizen" if de else "Notes", pb["anzahl_notizen"]),
            ("Protokoll-Einträge" if de else "Log entries", pb["eintraege"]), ("Erster Hash" if de else "First hash", pb["erster_hash"] or "–"),
            ("Letzter Hash" if de else "Last hash", pb["letzter_hash"] or "–"), ("Erstellt" if de else "Created", pb["erstellt"]),
            ("Zeitzone" if de else "Time zone", pb["zeitzone"] or "–"), ("Anlagen" if de else "Attachments", pb.get("anlagen", 0)),
            ("Prüfung" if de else "Check", ("unverändert" if de else "unchanged") if pb["unveraendert"] else ("Abweichung – siehe „Nachweis prüfen“" if de else "deviation – see “Verify record”"))]
    return "\n--- " + rows[0][0] + " ---\n" + "\n".join(f"{k}: {v}" for k, v in rows[1:]) + "\n" + pb["zeitquelle"] + "\n"


def nachweis_json():
    return {"app": BRAND, "v": VERSION, "erstellt": now_iso(), "pruefung": proto_verify(), "eintraege": proto_read(),
            "hinweis": "hash = SHA-256(prev_hash + \"\\n\" + JSON des Eintrags ohne hash/mac, Schlüssel sortiert, ohne Leerzeichen, UTF-8)"}


# =====================================================================
# Anlagen: Dateien zu Notizen (frei). Gespeichert unverändert unter anlagen/<jahr>/<id>_<name>, dazu anlagen/anlagen.json
# (Name, Art, Größe, SHA-256, hochgeladen, Beschreibung, Notizen). Jede Anlage und jede Änderung daran steht im
# Änderungsprotokoll (file_add, file_edit, file_del, file_restore, file_text). Entfernen = Papierkorb, die Datei bleibt.
# Erkannter Text kommt in eine eigene Datei <id>_<name>.erkannt.txt (mit eigener Prüfsumme) – das Original bleibt unberührt.
# =====================================================================
import dokument  # noqa: E402

MB = 1024 * 1024
ATT_LOCK = threading.RLock()
ATT = {"data": None}
ATT_MAX_FILES = 5000
SCAN = {}                                                # laufende Texterkennung: {id: {"state": "run"|"err", "error": …}}


def att_dir():
    return os.path.join(DIR, "anlagen")


def att_index_path():
    return os.path.join(att_dir(), "anlagen.json")


def att_limits():
    """Grenzen (Konfiguration der App): je Datei Standard 25 MB, zusammen 500 MB."""
    def mb(k, d, lo, hi):
        try:
            return max(lo, min(hi, int(OPT.get(k) or d)))
        except (TypeError, ValueError):
            return d
    return {"file": mb("attach_max_mb", 25, 1, 500) * MB, "total": mb("attach_total_mb", 500, 10, 100000) * MB}


def att_all():
    with ATT_LOCK:
        if ATT["data"] is None:
            d = read_json(att_index_path(), {}) or {}
            ATT["data"] = {"files": [x for x in (d.get("files") or []) if isinstance(x, dict) and x.get("id")]}
            ATT["map"] = None
        return ATT["data"]


def att_save():
    with ATT_LOCK:
        write_json(att_index_path(), att_all()); ATT["map"] = None


def att_get(aid):
    return next((x for x in att_all()["files"] if x.get("id") == aid), None)


def att_path(x, which="file"):
    rel = (x.get("txt") or {}).get("file") if which == "txt" else x.get("file")
    if not rel or ".." in str(rel).split("/") or str(rel).startswith("/"):
        return None
    return os.path.join(att_dir(), rel)


_TRANS = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue", "ß": "ss"})


def safe_name(n):
    """Dateiname für die Ablage: nur Buchstaben, Ziffern, . _ - (Endung klein)."""
    base = os.path.basename(str(n or "").replace("\\", "/"))
    stem, ext = os.path.splitext(base)
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", stem.translate(_TRANS)).strip("._-")[:60] or "datei"
    return stem + re.sub(r"[^a-z0-9.]", "", ext.lower())[:8]


def att_used():
    return sum(int(x.get("size") or 0) + int((x.get("txt") or {}).get("size") or 0) for x in att_all()["files"])


def att_public(x, full=False):
    out = {k: x.get(k) for k in ("id", "name", "kind", "type", "size", "sha256", "up", "desc", "notes", "del", "mtime", "by") if x.get(k) not in (None, "")}
    out["notes"] = list(x.get("notes") or [])
    if x.get("txt"):
        out["txt"] = {k: x["txt"].get(k) for k in ("sha256", "size", "method", "pages", "at", "doc_date") if x["txt"].get(k) is not None}
    if full:
        out["file"] = x.get("file")
        if x.get("txt"):
            out["txt"]["file"] = x["txt"].get("file")
    return out


def att_by_note():
    """{Notiz-Kennung: [Anlage, …]} (ohne Papierkorb)."""
    fs = att_all()["files"]
    if ATT.get("map") is not None:
        return ATT["map"]
    m = {}
    for x in fs:
        if x.get("del"):
            continue
        for n in x.get("notes") or []:
            m.setdefault(n, []).append(x)
    ATT["map"] = m
    return m


def att_note_ok(nid):
    with NOTES_LOCK:
        return any(x.get("id") == nid for x in notes_all()["free"])


def _att_log(op, x, prev=None):
    notes_all()                                          # Protokoll gestartet (Start-Eintrag), bevor eine Anlage hineinkommt
    proto_append(op, x["id"], prev=prev, extra={"file": json.loads(canon(x))})


def att_upload(stream, length, name, desc="", note_ids=(), mtime=None, by="app"):
    """Datei unverändert ablegen (Inhalt aus stream, genau length Bytes). Prüft Art, Grenzen und Dateianfang."""
    kind = dokument.kind_of(name)
    if not kind:
        return {"ok": False, "error": "kind"}
    lim = att_limits()
    if length <= 0:
        return {"ok": False, "error": "empty"}
    if length > lim["file"]:
        return {"ok": False, "error": "too big", "max": lim["file"]}
    with ATT_LOCK:
        if att_used() + length > lim["total"]:
            return {"ok": False, "error": "full", "max": lim["total"]}
        if len(att_all()["files"]) >= ATT_MAX_FILES:
            return {"ok": False, "error": "limit"}
        aid = "a_" + secrets.token_hex(5)
        year = str(dt.date.today().year)
        rel = f"{year}/{aid}_{safe_name(name)}"
        full = os.path.join(att_dir(), rel)
        os.makedirs(os.path.dirname(full), exist_ok=True)
    tmp = full + ".part"
    h, n, head = hashlib.sha256(), 0, b""
    try:
        with open(tmp, "wb") as f:
            while n < length:
                chunk = stream.read(min(MB, length - n))
                if not chunk:
                    break
                if len(head) < 65536:
                    head += chunk[:65536 - len(head)]
                h.update(chunk); f.write(chunk); n += len(chunk)
            f.flush(); os.fsync(f.fileno())
        if n != length:
            raise ValueError("short")
        if not dokument.sniff_ok(kind, head):
            raise TypeError("type")
        os.replace(tmp, full)
        try:
            os.chmod(full, 0o444)                          # Original nur lesbar
        except OSError:
            pass
    except (OSError, ValueError, TypeError) as e:
        try:
            os.remove(tmp)
        except OSError:
            pass
        return {"ok": False, "error": "type" if isinstance(e, TypeError) else "incomplete" if isinstance(e, ValueError) else "io"}
    x = {"id": aid, "name": clean_text(os.path.basename(str(name).replace("\\", "/")), 120) or safe_name(name), "file": rel, "kind": kind,
         "type": dokument.MIME.get(kind, "application/octet-stream"), "size": n, "sha256": h.hexdigest(), "up": now_iso(), "desc": clean_text(desc, 300),
         "notes": [x_ for x_ in dict.fromkeys(str(i) for i in note_ids or []) if att_note_ok(x_)][:50], "by": by}
    try:
        if mtime and 946684800000 < int(mtime) < 4102444800000:
            x["mtime"] = iso_of(int(mtime))               # Änderungsdatum der Datei auf dem Gerät (für relative Angaben im Dokument)
    except (TypeError, ValueError):
        pass
    with NOTES_LOCK, ATT_LOCK:
        att_all()["files"].append(x); att_save(); _att_log("file_add", x)
    return {"ok": True, "file": att_public(x)}


def att_change(d):
    """Beschreibung ändern (desc), an Notiz hängen/lösen (link/unlink), in den Papierkorb (del), zurückholen (restore)."""
    a = str(d.get("action") or "")
    with NOTES_LOCK, ATT_LOCK:
        x = att_get(str(d.get("id") or ""))
        if x is None:
            return {"ok": False, "error": "not found"}
        old = json.loads(canon(x))
        if a == "desc":
            x["desc"] = clean_text(d.get("desc"), 300)
            if not x["desc"]:
                x.pop("desc")
            op = "file_edit"
        elif a in ("link", "unlink"):
            nid = str(d.get("note") or "")
            if a == "link":
                if not att_note_ok(nid):
                    return {"ok": False, "error": "not found"}
                x["notes"] = list(dict.fromkeys(list(x.get("notes") or []) + [nid]))[:50]
            else:
                x["notes"] = [n for n in x.get("notes") or [] if n != nid]
            op = "file_edit"
        elif a == "del":
            if x.get("del"):
                return {"ok": True, "file": att_public(x)}
            x["del"] = now_iso(); op = "file_del"
        elif a == "restore":
            if not x.get("del"):
                return {"ok": True, "file": att_public(x)}
            x.pop("del", None); x["restored"] = now_iso(); op = "file_restore"
        else:
            return {"ok": False, "error": "bad action"}
        if canon(old) == canon(x):
            return {"ok": True, "file": att_public(x)}
        att_save(); _att_log(op, x, prev=old)
    return {"ok": True, "file": att_public(x)}


def att_state():
    lim = att_limits()
    fs = att_all()["files"]
    return {"ok": True, "files": [att_public(x) for x in fs if not x.get("del")][::-1], "trash": [att_public(x) for x in fs if x.get("del")][::-1],
            "used": att_used(), "max_file": lim["file"], "max_total": lim["total"], "tools": dokument.tools(), "pro": pro_ok(),
            "kinds": sorted(set(dokument.KINDS))}


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(MB), b""):
            h.update(chunk)
    return h.hexdigest()


def att_verify(entries):
    """Anlagen gegen das Protokoll und gegen ihre Prüfsummen prüfen (nur lesen)."""
    st, probs = {}, []
    for e in entries:
        if str(e.get("op", "")).startswith("file_") and isinstance(e.get("file"), dict):
            st[str(e.get("id"))] = e["file"]
    disk = read_json(att_index_path(), {}) or {}
    idx = {str(x.get("id")): x for x in (disk.get("files") or []) if isinstance(x, dict)}
    for aid, x in idx.items():
        nm = x.get("name") or aid
        if aid not in st:
            probs.append({"id": aid, "what": _vt("Anlage „{n}“ steht in anlagen.json, aber nicht im Protokoll", "Attachment “{n}” is in anlagen.json but not in the log", n=nm)})
        elif canon(x) != canon(st[aid]):
            probs.append({"id": aid, "what": _vt("Angaben zur Anlage „{n}“ in anlagen.json weichen vom Protokoll ab", "Details of attachment “{n}” in anlagen.json differ from the log", n=nm)})
    for aid, x in st.items():
        nm = x.get("name") or aid
        if aid not in idx:
            probs.append({"id": aid, "what": _vt("Anlage „{n}“ fehlt in anlagen.json", "Attachment “{n}” is missing from anlagen.json", n=nm)})
        for which, h_ in (("file", x.get("sha256")), ("txt", (x.get("txt") or {}).get("sha256"))):
            if which == "txt" and not x.get("txt"):
                continue
            p = att_path(x, which)
            label = nm + (_vt(" (erkannter Text)", " (recognised text)") if which == "txt" else "")
            if not p or not os.path.isfile(p):
                probs.append({"id": aid, "what": _vt("Datei der Anlage „{n}“ fehlt", "File of attachment “{n}” is missing", n=label)})
            else:
                try:
                    ok = sha256_file(p) == h_
                except OSError:
                    ok = False
                if not ok:
                    probs.append({"id": aid, "what": _vt("Datei der Anlage „{n}“ wurde verändert (Prüfsumme passt nicht)", "File of attachment “{n}” was changed (hash does not match)", n=label)})
    return {"n": len(st), "active": sum(1 for x in st.values() if not x.get("del")), "problems": probs}


# ---------- Texterkennung und Vorschläge für Notizen ----------
def att_doc_date(x):
    """Bezugsdatum für relative Angaben („gestern Nacht“): Datum im Dokument (E-Mail, PDF), sonst Änderungsdatum der Datei."""
    for v in ((x.get("txt") or {}).get("doc_date"), x.get("mtime")):
        if v and ms_of(v):
            return dt.datetime.fromtimestamp(ms_of(v) / 1000).astimezone(), True
    return dt.datetime.fromtimestamp((ms_of(x.get("up")) or time.time() * 1000) / 1000).astimezone(), False


def att_scan_run(aid):
    """Text erkennen (im Hintergrund) und als eigene Datei mit Prüfsumme ablegen."""
    x = att_get(aid)
    try:
        src = att_path(x)
        r = dokument.extract(src, x.get("kind"))
        txt = dokument.pages_to_text(r["pages"])
        rel = os.path.splitext(x["file"])[0] + ".erkannt.txt"
        full = os.path.join(att_dir(), rel)
        data = txt.encode("utf-8")
        with ATT_LOCK:
            if att_used() + len(data) > att_limits()["total"]:
                raise dokument.ExtractError("full")
        tmp = full + ".part"
        with open(tmp, "wb") as f:
            f.write(data); f.flush(); os.fsync(f.fileno())
        if os.path.exists(full):
            try:
                os.chmod(full, 0o644)
            except OSError:
                pass
        os.replace(tmp, full)
        try:
            os.chmod(full, 0o444)
        except OSError:
            pass
        with NOTES_LOCK, ATT_LOCK:
            x = att_get(aid); old = json.loads(canon(x))
            x["txt"] = {"file": rel, "sha256": hashlib.sha256(data).hexdigest(), "size": len(data), "method": r["method"], "pages": len(r["pages"]), "at": now_iso()}
            if r.get("date"):
                x["txt"]["doc_date"] = r["date"].isoformat(timespec="seconds")
            att_save(); _att_log("file_text", x, prev=old)
        SCAN.pop(aid, None)
    except dokument.ExtractError as e:
        SCAN[aid] = {"state": "err", "error": e.code, "detail": str(e.detail)[:200], "t": time.time()}
    except Exception as e:                                  # nie den Server stören
        log("Texterkennung:", e)
        SCAN[aid] = {"state": "err", "error": "x", "detail": str(e)[:200], "t": time.time()}


def att_scan(aid, again=False):
    x = att_get(aid)
    if x is None or x.get("del"):
        return {"ok": False, "error": "not found"}
    if SCAN.get(aid, {}).get("state") == "run":
        return {"ok": True, "state": "run"}
    if x.get("txt") and not again:
        return doc_suggest(aid)
    if sum(1 for v in SCAN.values() if v.get("state") == "run") >= 2:
        return {"ok": False, "error": "busy"}
    SCAN[aid] = {"state": "run", "t": time.time()}
    threading.Thread(target=att_scan_run, args=(aid,), daemon=True).start()
    return {"ok": True, "state": "run"}


def _stems(label):
    out = []
    for p in re.split(r"[/,]", str(label or "")):
        p = p.strip().lower()
        if len(p) >= 3:
            out.append(p if len(p) < 6 else p[:max(5, len(p) - 2)])
    return out


def _similar(a, b):
    import difflib
    a, b = re.sub(r"\W+", " ", str(a or "").lower()).strip(), re.sub(r"\W+", " ", str(b or "").lower()).strip()
    if not a or not b:
        return not a and not b
    return a in b or b in a or difflib.SequenceMatcher(None, a, b).ratio() >= 0.6


def doc_suggest(aid):
    """Vorschläge aus dem erkannten Text: je Fundstelle eine Notiz (von–bis, Satz, Seite/Zeile, Einstufung), dazu passende
    Schnellwahl-Wörter und bekannte Zeugen. Doppelte (±5 Min. und ähnlicher Text) sind markiert. Ändert nichts."""
    x = att_get(aid)
    if x is None:
        return {"ok": False, "error": "not found"}
    st = SCAN.get(aid)
    if st and st.get("state") == "run":
        return {"ok": True, "state": "run"}
    if st and st.get("state") == "err" and not x.get("txt"):
        return {"ok": True, "state": "err", "error": st.get("error"), "detail": st.get("detail")}
    if not x.get("txt"):
        return {"ok": True, "state": "none"}
    p = att_path(x, "txt")
    try:
        with open(p, encoding="utf-8") as f:
            text = f.read()
    except OSError:
        return {"ok": False, "error": "io"}
    ref, known = att_doc_date(x)
    hits = dokument.find_times(text.split("\f"), ref, known)
    words = []
    for k, l in _label_map().items():
        if tag_ok(l) and len(k) >= 3:
            words.append((l, _stems(k)))
    pers = persons()
    with NOTES_LOCK:
        have = [note_public(n) for n in notes_all()["free"]]
    out = []
    for i, h in enumerate(hits[:500]):
        sent = h["sentence"]; low = sent.lower()
        tags = []
        for key, stems in words:
            if key not in tags and any(re.search(r"(?<![\wäöüß])" + re.escape(s_), low) for s_ in stems):
                tags.append(key)
        wit = [n for n in pers if re.search(r"(?<!\w)" + re.escape(n.lower()) + r"(?!\w)", low)]
        a = ms_of(h["from"])
        dup = None
        for n in have:
            sd = n.get("src_doc") or {}
            if sd.get("id") == aid and sd.get("page") == h["page"] and sd.get("line") == h["line"] and abs((n.get("a") or 0) - a) <= 300000:
                dup = n["id"]; break
            if not n.get("notime") and n.get("a") and abs(n["a"] - a) <= 300000 and _similar(n.get("text"), h["text"]):
                dup = n["id"]; break
        dup_of = next((j for j, o in enumerate(out) if abs(ms_of(o["from"]) - a) <= 300000 and _similar(o["text"], h["text"])), None)
        out.append(dict(h, i=i, tags=tags[:12], witness=", ".join(wit[:5]), dup=dup, dup_of=dup_of))
    return {"ok": True, "state": "done", "id": aid, "name": x.get("name"), "suggestions": out, "doc_date": ref.isoformat(timespec="seconds"), "doc_date_known": known,
            "method": x["txt"].get("method"), "pages": x["txt"].get("pages"), "more": max(0, len(hits) - 500), "pro": pro_ok()}


def doc_apply(d):
    """Pro (wie der Import): gewählte Vorschläge als Notizen übernehmen. Erfassungszeit = jetzt; die Zeit aus dem Dokument
    ist die Zeit der Notiz, Herkunft steht in src_doc {id, page, line}. Nichts wird vorher angelegt."""
    if not pro_ok():
        return {"ok": False, "error": "pro"}
    aid = str(d.get("id") or "")
    x = att_get(aid)
    if x is None or x.get("del"):
        return {"ok": False, "error": "not found"}
    items = d.get("items") if isinstance(d.get("items"), list) else []
    ref, known = att_doc_date(x)
    made, errs = [], []
    for it in items[:500]:
        if not isinstance(it, dict):
            continue
        conf = it.get("conf") if it.get("conf") in dokument.CONF else "unklar"
        try:
            page, line = max(0, int(it.get("page") or 0)), max(0, int(it.get("line") or 0))
        except (TypeError, ValueError):
            page, line = 0, 0
        sd = {"id": aid, "name": x.get("name"), "page": page, "line": line, "conf": conf}
        if known:
            sd["doc_t"] = ref.isoformat(timespec="seconds")             # Datum des Dokuments – getrennt von Ereignis- und Erfassungszeit
        r = note_change("add", {"text": it.get("text"), "from": it.get("from"), "to": it.get("to") or "", "tags": it.get("tags") or [],
                                "witness": it.get("witness") or "", "cap": int(time.time() * 1000), "approx": conf != "genau" or bool(it.get("date_only")),
                                "typed": True, "_src_doc": sd}, by="dokument")
        if r.get("ok"):
            made.append(r["note"]["id"])
        else:
            errs.append({"i": it.get("i"), "error": r.get("error")})
    if made:
        with NOTES_LOCK, ATT_LOCK:
            x = att_get(aid); old = json.loads(canon(x))
            x["notes"] = list(dict.fromkeys(list(x.get("notes") or []) + made))[:5000]
            att_save(); _att_log("file_edit", x, prev=old)
    return {"ok": True, "n": len(made), "ids": made, "errors": errs}


# ---------- Uhr von Home Assistant (für den Nachweis) ----------
CLOCK = {"t": 0, "v": None}


def ha_clock():
    """Zeitquelle: Systemzeit des Servers. NTP-Abgleich über den Supervisor (host/info), wenn erreichbar – sonst None."""
    if time.time() - CLOCK["t"] < 600:
        return CLOCK["v"]
    CLOCK["t"] = time.time(); v = None
    tok = os.environ.get("SUPERVISOR_TOKEN")
    if tok:
        try:
            req = urllib.request.Request(os.environ.get("GR_SUPERVISOR", "http://supervisor") + "/host/info", headers={"Authorization": f"Bearer {tok}"})
            with urllib.request.urlopen(req, timeout=4) as r:
                dd = (json.loads(r.read() or b"{}") or {}).get("data") or {}
            if "dt_synchronized" in dd or "use_ntp" in dd:
                v = {"ntp": dd.get("use_ntp"), "sync": dd.get("dt_synchronized"), "tz": dd.get("timezone")}
        except Exception:
            v = None
    CLOCK["v"] = v
    return v


def clock_text():
    c = ha_clock()
    s_ = _vt("Zeitquelle: Uhr von Home Assistant (Systemzeit des Servers)", "Time source: Home Assistant clock (server system time)")
    if c and c.get("sync") is not None:
        s_ += _vt("; Abgleich mit Zeitserver (NTP): ", "; synchronised with time server (NTP): ") + (_vt("ja", "yes") if c["sync"] else _vt("nein", "no"))
    else:
        s_ += _vt("; Abgleich mit Zeitserver (NTP): nicht bekannt", "; synchronised with time server (NTP): unknown")
    return s_



def note_public(x):
    """Für die Anzeige: a/b in ms. Notiz ohne Zeitpunkt (notime): „from“ bleibt leer – so hängt GLighter sie an keine Störung –,
    a ist dann der Zeitpunkt, zu dem sie geschrieben wurde (für Sortierung und Zeitraum)."""
    if x.get("notime"):
        a = ms_of(x.get("at")) or ms_of(x.get("ts")) or ms_of(x.get("from"))
        return dict(x, a=a, b=a, notime=True, tagl=[tag_label(t) for t in x.get("tags") or []], att=_att_n(x))
    a = ms_of(x.get("from")); b = ms_of(x.get("to")) if x.get("to") else None
    return dict(x, a=a, b=b or a, tagl=[tag_label(t) for t in x.get("tags") or []], att=_att_n(x))


def _att_n(x):
    """Anlagen der Notiz für die Anzeige: [{id, name, kind, size}] (ohne Papierkorb)."""
    try:
        return [{"id": a["id"], "name": a.get("name"), "kind": a.get("kind"), "size": a.get("size")} for a in att_by_note().get(x.get("id"), [])]
    except Exception:
        return []


def notes_list(t_from=None, t_to=None, q="", limit=500):
    q = str(q or "").strip().lower()[:80]
    with NOTES_LOCK:
        out = []
        for x in notes_all()["free"]:
            p = note_public(x)
            if p["a"] is None:
                continue
            if t_from is not None and p["b"] < t_from:
                continue
            if t_to is not None and p["a"] > t_to:
                continue
            if q and q not in (" ".join([p.get("text") or "", p.get("witness") or "", fb_txt(p) if p.get("fields") else ""] + p["tagl"])).lower():
                continue
            out.append(p)
    out.sort(key=lambda p: -p["a"])
    if limit is None:                                  # alle (Tagebuch, Export) – nie still abschneiden
        return out
    return out[:max(1, min(5000, int(limit or 500)))]


def note_text(x):
    """Kurztext für Logbuch: „Klopfen, oben · Text · Zeuge Anna“."""
    parts = [", ".join(tag_label(t) for t in x.get("tags") or [] if t != "zeuge")]
    if x.get("text"):
        parts.append(x["text"])
    if x.get("witness"):
        parts.append(("Witness " if lang() == "en" else "Zeuge ") + x["witness"])
    if x.get("fields"):
        parts.append(fb_txt(x, " · "))
    return " · ".join(p for p in parts if p)[:250]


HA_RATE = {"last": 0.0, "tok": 5.0, "day": None, "n": 0, "warned": None}
HA_MAX_DAY = 500
HA_BURST = 5.0                                          # kurz hintereinander bis 5, im Schnitt höchstens 1 je Sekunde


def ha_rate_ok():
    """Notizen aus Home Assistant/MQTT: höchstens 1 je Sekunde und 500 am Tag (aus der App selbst unbegrenzt)."""
    now = time.time(); day = dt.date.today()
    if HA_RATE["day"] != day:
        HA_RATE.update(day=day, n=0)
    HA_RATE["tok"] = min(HA_BURST, HA_RATE["tok"] + (now - HA_RATE["last"])); HA_RATE["last"] = now
    if HA_RATE["tok"] < 1.0 or HA_RATE["n"] >= HA_MAX_DAY:
        if HA_RATE["warned"] != day:
            HA_RATE["warned"] = day
            log("Notizen aus Home Assistant: zu viele – wird gebremst")
            logbook({"text": "Zu viele Notizen aus Home Assistant – weitere werden heute abgelehnt (höchstens 1 je Sekunde, 500 am Tag)."
                     if lang() != "en" else "Too many notes from Home Assistant – more are rejected today (at most 1 per second, 500 per day).", "tags": []})
        return False
    HA_RATE["tok"] -= 1.0; HA_RATE["n"] += 1
    return True


def note_change(action, data, by="app"):
    with NOTES_LOCK:
        a = notes_all(); lst = a["free"]
        nid = str(data.get("id") or "")
        if action == "restore":                              # aus dem Papierkorb zurückholen
            idx = next((i for i, x in enumerate(a["trash"]) if x.get("id") == nid), None)
            if idx is None or any(x.get("id") == nid for x in lst):
                return {"ok": False, "error": "not found"}
            x = a["trash"].pop(idx); x.pop("deleted", None); x["restored"] = now_iso(); lst.append(x)
            notes_save(); diary_soon()
            return {"ok": True, "note": note_public(x)}
        if action == "del":
            idx = next((i for i, x in enumerate(lst) if x.get("id") == nid), None)
            if idx is None:
                return {"ok": False, "error": "not found"}
            a["trash"].append(dict(lst.pop(idx), deleted=now_iso()))
            notes_save()
            diary_soon()
            return {"ok": True}
        notime = data.get("notime") is True
        f = str(data.get("from") or "")[:25] or now_iso(); to = "" if notime else str(data.get("to") or "")[:25]
        fa, tb = ms_of(f), (ms_of(to) if to else None)
        if fa is None and not notime:
            return {"ok": False, "error": "from"}
        if to and (tb is None or tb < fa):
            return {"ok": False, "error": "to"}
        text = clean_text(data.get("text"))
        tags = clean_tags(data.get("tags"))
        fields, bad = fb_fields(data)                       # eigene Felder (freiwillig)
        if bad:
            return {"ok": False, "error": "field", "fields": bad}
        wit = clean_text(data.get("witness"), 200)
        if not text and not tags and not fields and not wit and not clean_ext(data.get("ext")):   # Zeuge oder „Mehr“ allein ist auch Inhalt
            return {"ok": False, "error": "empty"}
        if not pro_ok():                                   # mehrere Zeugen: Pro
            wit = wit.split(",")[0].strip()[:80]
        src = re.sub(r"[^a-z0-9_]", "", str(data.get("src") or "all"))[:16] or "all"
        rec = {"from": "" if notime else iso_of(fa), "to": iso_of(tb) if tb else "", "src": src, "text": text, "tags": tags,
               "witness": wit if (wit and ("zeuge" in tags or wit)) else ""}
        if notime:
            rec["notime"] = True
        ext = clean_ext(data.get("ext"))
        if ext:
            rec["ext"] = ext
        if fields:
            rec["fields"] = fields
        kd = felder.kind_ok(fb_all().get("kinds"), str(data.get("kind") or ""))     # Notiz-Art (ab 1.11)
        if kd:
            rec["kind"] = kd
        # Nachvollziehbar: wann tatsächlich notiert wurde (cap, ms) und welche Zeitpunkt-Taste die Zeit gesetzt hat (wk/wl, approx = ungefähr)
        try:
            cap = int(data.get("cap")) if data.get("cap") not in (None, "") else None
        except (TypeError, ValueError):
            cap = None
        if cap and 946684800000 < cap < 4102444800000:
            rec["cap"] = cap
        wk = str(data.get("wk") or "")
        if re.fullmatch(r"[wt]_[a-z0-9]{1,8}", wk):
            rec["wk"] = wk; rec["wl"] = qt_clean_label(data.get("wl")) or tag_label(wk)
            if data.get("approx") is True:
                rec["approx"] = True
        if by == "dokument" and isinstance(data.get("_src_doc"), dict):    # aus einem Dokument erkannt (nur intern, siehe doc_apply)
            sd = data["_src_doc"]
            rec["src_doc"] = {k: sd[k] for k in ("id", "name", "page", "line", "conf", "doc_t") if sd.get(k) not in (None, "")}
            if data.get("approx") is True:
                rec["approx"] = True
        if rec["witness"] and "zeuge" not in rec["tags"]:
            rec["tags"].append("zeuge")
        if action == "add":
            if len(lst) >= NOTES_MAX:
                return {"ok": False, "error": "limit"}
            if by == "homeassistant" and not ha_rate_ok():      # Schutz vor Flut aus Automationen
                return {"ok": False, "error": "rate"}
            x = dict(rec, id="r_" + secrets.token_hex(5), ts=now_iso(), at=now_iso(), by=by)
            lst.append(x)
            qt_learn(rec["tags"], text if data.get("typed") else "")
        else:
            x = next((y for y in lst if y.get("id") == nid), None)
            if x is None:
                return {"ok": False, "error": "not found"}
            if "fields" not in data and x.get("fields"):            # ältere Oberfläche/Automation ohne Felder: Werte bleiben
                rec["fields"] = x["fields"]
            if "kind" not in data and x.get("kind"):                # ältere Oberfläche/Automation ohne Art: Art bleibt
                rec["kind"] = x["kind"]
            for k_ in ("notime", "cap", "wk", "wl", "approx", "ext", "fields", "kind"):     # beim Ändern gilt, was jetzt mitkommt
                if k_ not in rec:
                    x.pop(k_, None)
            if notime and not x.get("at"):
                x["at"] = x.get("ts") or now_iso()
            x.update(rec, edited=now_iso())
        notes_save()
    if action == "add":
        logbook(x)
    diary_soon()
    return {"ok": True, "note": note_public(x)}


def notes_import(data):
    """Pro: Notizen aus einer Export-Datei (JSON) übernehmen; vorhandene (gleiche Kennung) bleiben."""
    if not pro_ok():
        return {"ok": False, "error": "pro"}
    lst = data.get("notes") if isinstance(data, dict) else None
    if not isinstance(lst, list):
        return {"ok": False, "error": "format"}
    n = 0
    with NOTES_LOCK:
        a = notes_all(); have = {x.get("id") for x in a["free"]}
        for x in lst[:NOTES_MAX]:
            nt = isinstance(x, dict) and x.get("notime") is True and ms_of(x.get("at") or x.get("ts")) is not None
            if not isinstance(x, dict) or (ms_of(x.get("from")) is None and not nt):
                continue
            nid = re.sub(r"[^a-z0-9_]", "", str(x.get("id") or ""))[:20] or "r_" + secrets.token_hex(5)
            if nid in have:
                continue
            rec = {"id": nid, "from": "" if nt else iso_of(ms_of(x["from"])), "to": "" if nt else iso_of(ms_of(x["to"])) if ms_of(x.get("to")) else "",
                   "src": re.sub(r"[^a-z0-9_]", "", str(x.get("src") or "all"))[:16] or "all", "text": clean_text(x.get("text")),
                   "tags": [t for t in (x.get("tags") or []) if isinstance(t, str) and (t in NOTE_TAG_SET or t.startswith("c_"))][:12],
                   "witness": clean_text(x.get("witness"), 200), "ts": str(x.get("ts") or now_iso())[:30], "by": "import"}
            if nt:
                rec.update(notime=True, at=str(x.get("at") or x.get("ts"))[:30])
            fv, _ = felder.clean_fields(fb_defs(), x.get("fields"))
            if fv:
                rec["fields"] = fv
            if not rec["text"] and not rec["tags"] and not fv:
                continue
            a["free"].append(rec); have.add(nid); n += 1
        if n:
            notes_save()
    diary_soon()
    return {"ok": True, "n": n}


# =====================================================================
# Textdatei (Pro): Tagebuch nach Tagen, Export in eine Datei, Import aus TXT/CSV/JSON
# =====================================================================
TXT_ROOTS = [r for r in os.environ.get("GR_TXT_ROOTS", "/share:/media").split(":") if r]
TXT_DEF = {"on": False, "path": "", "monthly": False, "fmt": "txt"}
DIARY = {"lock": threading.Lock(), "timer": None, "last": None, "error": "", "files": []}


def txt_default_path(ext="txt"):
    return os.path.join(DIR, "export", "greport_tagebuch." + ext)


def txt_cfg():
    d = (read_json(os.path.join(DIR, "einstellungen.json"), {}) or {}).get("txt") or {}
    out = dict(TXT_DEF)
    if isinstance(d, dict):
        out["on"] = d.get("on") is True
        out["monthly"] = d.get("monthly") is True
        out["fmt"] = "csv" if d.get("fmt") == "csv" else "txt"
        out["path"] = str(d.get("path") or "")[:300]
        if out["path"] and not safe_path(out["path"], (".txt", ".csv", ".log")):   # alter Pfad außerhalb der erlaubten Ordner
            out["moved"] = out["path"]; out["path"] = ""
    old = os.path.join(DIR, "greport_tagebuch." + out["fmt"])
    if not out.get("moved") and not out["path"] and os.path.exists(old):           # früherer Standard direkt in /share/greport
        out["moved"] = old
    return out


FOREIGN_APPS = ("gaslighter", "glighter", "gjarvis")      # fremde App-Ordner: nie lesen, nie schreiben


def _under(full, root):
    rr = os.path.realpath(root)
    return full == rr or full.startswith(rr + os.sep)


def write_roots():
    """Schreiben nur in eigene Ordner: /share/greport/export und /media/greport (je Wurzel aus TXT_ROOTS)."""
    out = [os.path.join(DIR, "export")]
    for r in TXT_ROOTS:
        if not _under(os.path.realpath(DIR), r):
            out.append(os.path.join(r, "greport"))
    return out


def read_roots():
    """Lesen (Import) nur aus /share/greport/import und /media."""
    out = [os.path.join(DIR, "import")]
    for r in TXT_ROOTS:
        if not _under(os.path.realpath(DIR), r):
            out.append(r)
    return out


def safe_path(p, exts, write=True):
    """Pfad prüfen: passende Endung, nur in den erlaubten Ordnern, keine fremden App-Ordner, keine eigenen Datendateien.
    Liefert den echten Pfad oder None."""
    p = str(p or "").strip()
    if not p or "\x00" in p:
        return None
    full = os.path.realpath(p if os.path.isabs(p) else os.path.join(DIR, "export" if write else "import", p))
    if os.path.splitext(full)[1].lower() not in exts:
        return None
    parts = [x.lower() for x in full.split(os.sep)]
    if any(x.startswith(a) for x in parts for a in FOREIGN_APPS):
        return None
    if os.path.dirname(full) == os.path.realpath(DIR):          # notizen.json, einstellungen.json, Protokoll … nie direkt
        return None
    for r in (write_roots() if write else read_roots()):
        if _under(full, r):
            return full
    return None


def own_files_path():
    return os.path.join(PRIV, "eigene_dateien.json")


def own_file_target(path):
    """Vorhandene Dateien nur überschreiben, wenn GReport sie selbst angelegt hat – sonst neuer Name mit Zähler."""
    reg = set((read_json(own_files_path(), {}) or {}).get("files") or [])
    base, ext = os.path.splitext(path)
    for i in range(1, 1000):
        cand = path if i == 1 else f"{base}_{i}{ext}"
        if not os.path.exists(cand) or cand in reg:
            if cand not in reg:
                reg.add(cand)
                try:
                    write_json(own_files_path(), {"files": sorted(reg)[-500:]})
                except OSError:
                    pass
            return cand
    raise OSError("no free name")


def txt_set(d):
    if not pro_ok():
        return {"ok": False, "error": "pro"}
    cur = txt_cfg()
    if isinstance(d.get("on"), bool):
        cur["on"] = d["on"]
    if isinstance(d.get("monthly"), bool):
        cur["monthly"] = d["monthly"]
    if d.get("fmt") in ("txt", "csv"):
        cur["fmt"] = d["fmt"]
    if "path" in d:
        path = str(d.get("path") or "").strip()
        if path and not safe_path(path, (".txt", ".csv", ".log")):
            return {"ok": False, "error": "path"}
        cur["path"] = path
    allp = read_json(os.path.join(DIR, "einstellungen.json"), {}) or {}
    allp["txt"] = cur
    write_json(os.path.join(DIR, "einstellungen.json"), allp)
    if cur["on"]:
        diary_write()
    return txt_state()


def txt_state():
    c = txt_cfg()
    return dict(c, ok=True, pro=pro_ok(), default=txt_default_path("csv" if c["fmt"] == "csv" else "txt"), roots=write_roots(), read_roots=read_roots(),
                last=DIARY["last"], error=DIARY["error"], files=DIARY["files"][-6:])


def csv_safe(v):
    """Tabellenprogramme führen Zellen mit = + - @ (oder Tab/CR am Anfang) als Formel aus – dann ' voranstellen."""
    s_ = "" if v is None else str(v)
    return "'" + s_ if s_ and s_[0] in "=+-@\t\r" else s_


class SafeWriter:
    def __init__(self, f):
        self.w = csv.writer(f, delimiter=";")

    def writerow(self, row):
        self.w.writerow([csv_safe(x) for x in row])


def meta_parts(p, pf=None):
    """Für Dritte: Erfassungszeit, „Zeit per Taste gesetzt (…)“, „ungefähr“ – getrennt von der Zeit der Notiz."""
    de = lang() != "en"; out = []
    if p.get("cap") and (p.get("wk") or abs(int(p["cap"]) - int(p.get("a") or 0)) > 60000):
        c = dt.datetime.fromtimestamp(int(p["cap"]) / 1000).astimezone()
        out.append(("erfasst " if de else "noted ") + fmt_date(c, pf) + " " + fmt_time(c, pf))
    if p.get("wk") and not p.get("notime"):
        out.append(("Zeit per Taste gesetzt (" if de else "time set by button (") + str(p.get("wl") or tag_label(p["wk"])) + ")")
    if p.get("approx"):
        out.append("ungefähr" if de else "approximate")
    return out


def ext_parts(p):
    """Weitere Angaben für Tagebuch/Export: Rolle/Erreichbarkeit des Zeugen, Häufigkeit, Polizei, Meldung, Folgen, Attest, Drohung."""
    de = lang() != "en"; x = p.get("ext") or {}; out = []
    if x.get("wrole") or x.get("wcontact"):
        out.append(("Zeuge " if de else "witness ") + ", ".join(v for v in ((ROLE_DE if de else ROLE_EN).get(x.get("wrole"), ""), x.get("wcontact", "")) if v))
    if x.get("freq"):
        out.append(("Häufigkeit: " if de else "frequency: ") + x["freq"])
    if x.get("pol"):
        out.append(("Polizei" if de else "police") + ((", Vorgang " if de else ", case ") + x["pol_nr"] if x.get("pol_nr") else ""))
    if x.get("rep_to") or x.get("rep_date"):
        out.append(("gemeldet an " if de else "reported to ") + (REP_DE if de else REP_EN).get(x.get("rep_to"), "–") + ((" am " if de else " on ") + x["rep_date"] if x.get("rep_date") else ""))
    if x.get("health"):
        out.append(("Folgen: " if de else "effects: ") + x["health"])
    if x.get("attest"):
        out.append(("Attest: " if de else "certificate: ") + x["attest"])
    if x.get("threat"):
        out.append("Drohung/Gewalt" if de else "threat/violence")
    an = att_names(p)
    if an:
        out.append(("Anlage: " if de else "attachment: ") + ", ".join(an))
    if p.get("src_doc"):
        out.append(("aus Dokument erkannt" if de else "recognised from document") + f" ({p['src_doc'].get('name') or p['src_doc'].get('id')}" + (f", S. {p['src_doc']['page']}" if p["src_doc"].get("page") else "") + (f", Z. {p['src_doc']['line']}" if p["src_doc"].get("line") else "") + ")")
    return out


EXT_COLS = ["zeuge_rolle", "zeuge_erreichbar", "haeufigkeit", "polizei_vorgang", "gemeldet_an", "gemeldet_am", "folgen", "attest", "drohung_gewalt", "aus_dokument", "anlagen"]


def ext_cols(p):
    x = p.get("ext") or {}; sd = p.get("src_doc") or {}
    return [ROLE_DE.get(x.get("wrole"), ""), x.get("wcontact", ""), x.get("freq", ""), (x.get("pol_nr") or "ja") if x.get("pol") else "",
            REP_DE.get(x.get("rep_to"), ""), x.get("rep_date", ""), x.get("health", ""), x.get("attest", ""), "ja" if x.get("threat") else "",
            (f"{sd.get('name') or sd.get('id', '')} S.{sd.get('page', '')} Z.{sd.get('line', '')}" if sd else ""),
            "; ".join(f"{a.get('name')} (SHA-256 {a.get('sha256')})" for a in att_by_note().get(p.get("id"), []))]


def cap_iso(p):
    return dt.datetime.fromtimestamp(int(p["cap"]) / 1000).astimezone().isoformat(timespec="seconds") if p.get("cap") else ""


def notime_txt():
    return "no time" if lang() == "en" else "ohne Zeitpunkt"


def _line_txt(p, pf):
    a = dt.datetime.fromtimestamp(p["a"] / 1000).astimezone()
    s = "(" + notime_txt() + ")" if p.get("notime") else fmt_time(a, pf)
    if p.get("to"):
        s += " – " + fmt_time(dt.datetime.fromtimestamp(p["b"] / 1000).astimezone(), pf)
    tags = [tag_label(t) for t in p.get("tags") or [] if not (t == "zeuge" and p.get("witness"))]
    s += "  "
    if tags:
        s += "[" + ", ".join(tags) + "] "
    if p.get("text"):
        s += p["text"].replace("\n", " / ")
    if p.get("witness"):
        s += (" – " if (tags or p.get("text")) else "") + ("Witness: " if lang() == "en" else "Zeuge: ") + p["witness"]
    if p.get("fields"):                                 # eigene Felder in geschweiften Klammern (beim Import erkannt)
        fx = fb_txt(p)
        if fx:
            s += " {" + fx + "}"
    mp = meta_parts(p, pf) + ext_parts(p)
    if mp:
        s += " (" + ", ".join(mp) + ")"
    if p.get("edited"):
        s += " (changed)" if lang() == "en" else " (geändert)"
    return s.rstrip()


def diary_render(notes, fmt, pf=None):
    """Tagebuch: je Tag eine Überschrift, darunter die Notizen nach Uhrzeit; zwischen den Tagen eine Leerzeile."""
    pf = pf or prefs()
    notes = sorted(notes, key=lambda p: p["a"])
    if fmt == "csv":
        out = io.StringIO(); w = SafeWriter(out); de = lang() != "en"
        fc = felder.csv_defs(fb_defs(), notes)              # je eigenes Feld eine Spalte: „Name (b_…)“
        kinds = fb_all().get("kinds") or []; kcol = any(p.get("kind") for p in notes)
        w.writerow(["datum", "uhrzeit", "bis", "schnellwahl", "text", "zeuge", "geaendert", "von_iso", "bis_iso", "kennung", "erfasst_iso", "zeit_per_taste", "ungefaehr"] + EXT_COLS
                   + [felder.csv_head(b, de) for b in fc] + (["notiz_art"] if kcol else []))
        for p in notes:
            a = dt.datetime.fromtimestamp(p["a"] / 1000).astimezone(); b = dt.datetime.fromtimestamp(p["b"] / 1000).astimezone() if p.get("to") else None
            w.writerow([fmt_date(a, pf), notime_txt() if p.get("notime") else fmt_time(a, pf), fmt_time(b, pf) if b else "", ", ".join(tag_label(t) for t in p.get("tags") or []),
                        p.get("text") or "", p.get("witness") or "", "ja" if p.get("edited") else "", p.get("from"), p.get("to") or "", p.get("id"),
                        cap_iso(p), (p.get("wl") or tag_label(p["wk"])) if p.get("wk") else "", "ja" if p.get("approx") else ""] + ext_cols(p)
                       + felder.csv_cells(fc, p, de) + ([felder.kind_label(kinds, p.get("kind"))] if kcol else []))
        pb = proof_block()
        for k, v in pb.items():                          # Prüfblock am Ende (Zeilen mit # werden beim Import übersprungen)
            w.writerow(["#" + k, v])
        return "\ufeff" + out.getvalue()
    hp = dict(pf, wd=True)
    lines, day = [], None
    for p in notes:
        a = dt.datetime.fromtimestamp(p["a"] / 1000).astimezone()
        if a.date() != day:
            if day is not None:
                lines.append("")
            day = a.date(); lines.append(fmt_date(a, hp))
        lines.append(_line_txt(p, pf))
    return "\n".join(lines) + ("\n" if lines else "") + att_text(notes) + proof_text(proof_block())


def att_fmt_size(n):
    n = int(n or 0)
    return f"{n / MB:.1f} MB" if n >= MB else f"{max(1, round(n / 1024))} KB"


def att_text(notes=None):
    """Anlagen mit Prüfsumme (für Tagebuch, Export und Bericht). notes: nur Anlagen dieser Notizen (None = alle)."""
    de = lang() != "en"; ids = None if notes is None else {p.get("id") for p in notes}
    fs = [x for x in att_all()["files"] if not x.get("del") and (ids is None or set(x.get("notes") or []) & ids)]
    if not fs:
        return ""
    out = ["", "--- " + ("Anlagen" if de else "Attachments") + " ---"]
    for x in fs:
        out.append(f"{x.get('name')} ({att_fmt_size(x.get('size'))}, " + ("hochgeladen " if de else "uploaded ") + str(x.get("up")) + ")"
                   + (" – " + x["desc"] if x.get("desc") else ""))
        out.append("  SHA-256: " + str(x.get("sha256")))
        if x.get("txt"):
            out.append("  " + ("erkannter Text" if de else "recognised text") + " SHA-256: " + str(x["txt"].get("sha256")))
    return "\n".join(out) + "\n"


def att_names(p):
    return [x.get("name") for x in att_by_note().get(p.get("id"), [])]


def _write_text(path, text):
    """Schreibt nur in eine eigene Datei (fremde gleichnamige Datei bleiben unberührt: neuer Name). Gibt den Pfad zurück."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    path = own_file_target(path)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="") as f:
        f.write(text); f.flush(); os.fsync(f.fileno())
    os.replace(tmp, path)
    return path


def diary_write():
    """Tagebuch-Datei(en) neu schreiben (Pro, wenn eingeschaltet). Mit „je Monat“: name_JJJJ-MM.txt."""
    c = txt_cfg()
    if not (pro_ok() and c["on"]):
        return False
    path = safe_path(c["path"], (".txt", ".csv", ".log")) if c["path"] else txt_default_path("csv" if c["fmt"] == "csv" else "txt")
    if not path:
        DIARY["error"] = "path"; return False
    with DIARY["lock"]:
        try:
            notes = notes_list(limit=None); pf = prefs(); files = []
            if c["monthly"]:
                base, ext = os.path.splitext(path); by = {}
                for p in notes:
                    by.setdefault(dt.datetime.fromtimestamp(p["a"] / 1000).astimezone().strftime("%Y-%m"), []).append(p)
                for m, ns in sorted(by.items()):
                    f = f"{base}_{m}{ext}"; files.append(_write_text(f, diary_render(ns, c["fmt"], pf)))
            else:
                files.append(_write_text(path, diary_render(notes, c["fmt"], pf)))
            DIARY.update(last=now_iso(), error="", files=files)
            return True
        except OSError as e:
            DIARY["error"] = str(e)[:160]; log("Textdatei:", e)
            return False


def diary_soon():
    """Nach einer Änderung kurz warten (mehrere Änderungen zusammen), dann die Datei schreiben."""
    c = txt_cfg()
    if not (c["on"] and pro_ok()):
        return
    t = DIARY.get("timer")
    if t:
        t.cancel()
    DIARY["timer"] = threading.Timer(1.0, diary_write); DIARY["timer"].daemon = True; DIARY["timer"].start()


def export_file(d):
    """Pro: alle Notizen in eine Datei auf dem Home-Assistant-Rechner schreiben (TXT-Tagebuch, CSV oder JSON)."""
    if not pro_ok():
        return {"ok": False, "error": "pro"}
    fmt = d.get("fmt") if d.get("fmt") in ("txt", "csv", "json") else "txt"
    path = safe_path(d.get("path") or os.path.join(DIR, "export", f"greport_export_{dt.date.today()}.{fmt}"), ("." + fmt, ".log") if fmt == "txt" else ("." + fmt,))
    if not path:
        return {"ok": False, "error": "path"}
    path = _write_text(path, export_text(fmt))
    return {"ok": True, "path": path, "n": len(notes_all()["free"])}


def export_text(fmt):
    if fmt == "json":
        return json.dumps({"app": BRAND, "v": VERSION, "notes": notes_all()["free"], "anlagen": [att_public(x) for x in att_all()["files"] if not x.get("del")],
                           "felder": fb_defs(), "nachweis": proof_block()}, ensure_ascii=False, indent=1)
    return diary_render(notes_list(limit=None), fmt)


# ---------- Import ----------
WD_ALL = set(x.lower().strip(".") for x in WD_DE + WD_EN) | {"montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag",
                                                         "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}


def parse_date(s):
    """Datum in den Formaten von GReport (und üblichen): 18.10.2026, 18.10.26, 2026-10-18, 18. Okt. 2026, mit Wochentag davor."""
    s = str(s or "").strip().rstrip(":")
    s = re.sub(r"^([A-Za-zÄÖÜäöü]+)\.?,?\s+", lambda m: "" if m.group(1).lower() in WD_ALL else m.group(0), s)
    m = re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        y, mo, d = int(m[1]), int(m[2]), int(m[3])
    else:
        m = re.fullmatch(r"(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})?", s)
        if m:
            d, mo = int(m[1]), int(m[2]); y = int(m[3]) if m[3] else dt.date.today().year
            y = 2000 + y if y < 100 else y
        else:
            m = re.fullmatch(r"(\d{1,2})\.?\s+([A-Za-zäÄ]+)\.?\s+(\d{4})", s)
            if not m:
                return None
            mons = [x.lower().strip(".") for x in MON_DE]; mons_en = [x.lower() for x in MON_EN]; w = m[2].lower().strip(".")
            mo = next((i + 1 for i, x in enumerate(mons) if w.startswith(x[:3])), None) or next((i + 1 for i, x in enumerate(mons_en) if w.startswith(x[:3])), None)
            if not mo:
                return None
            d, y = int(m[1]), int(m[3])
    try:
        return dt.date(y, mo, d)
    except ValueError:
        return None


def parse_time(s):
    m = re.match(r"\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?", str(s or ""))
    if not m:
        return None, None
    h, mi, se = int(m[1]), int(m[2]), int(m[3] or 0)
    if m[4]:
        h = h % 12 + (12 if m[4].lower() == "pm" else 0)
    if h > 23 or mi > 59 or se > 59:
        return None, None
    return dt.time(h, mi, se), m.end()


def _when(day, tm):
    return dt.datetime.combine(day, tm).astimezone().isoformat(timespec="seconds")


def parse_import(text):
    """TXT (Tagebuch), CSV (Export/Tagebuch) oder JSON → Liste roher Notizen {from, to, tags(labels|keys), text, witness, id}."""
    text = str(text or "").lstrip("\ufeff")
    st = text.lstrip()
    if st.startswith("{") or st.startswith("["):
        try:
            d = json.loads(text)
        except ValueError:
            return None, "format"
        lst = d.get("notes") if isinstance(d, dict) else d
        if not isinstance(lst, list):
            return None, "format"
        return [{"from": x.get("from"), "to": x.get("to") or "", "keys": x.get("tags") or [], "text": x.get("text") or "", "witness": x.get("witness") or "",
                 "id": x.get("id"), "fields": x.get("fields") if isinstance(x.get("fields"), dict) else {}, "kind": str(x.get("kind") or "")} for x in lst if isinstance(x, dict)], None
    first = text.split("\n", 1)[0]
    if ";" in first and re.search(r"(datum|von_iso|schnellwahl)", first, re.I):
        out = []
        fdefs = felder.by_id(fb_defs())
        for r in csv.DictReader(io.StringIO(text), delimiter=";"):
            fv = {}                                         # Spalten „Name (b_…)“ → eigene Felder
            for k, v in r.items():
                bid = felder.head_id(k)
                if bid in fdefs and v:
                    v = v[1:] if len(v) > 1 and v[0] == "'" and v[1] in "=+-@\t\r" else v
                    val = felder.from_raw(fdefs[bid], v)
                    if val is not None:
                        fv[bid] = val
            r = {str(k or "").strip().lower(): (v or "").strip() for k, v in r.items()}
            r = {k: (v[1:] if len(v) > 1 and v[0] == "'" and v[1] in "=+-@\t\r" else v) for k, v in r.items()}   # Schutz vor Formeln wieder entfernen
            if (r.get("datum") or "").startswith("#"):          # Prüfblock
                continue
            frm = r.get("von_iso")
            if not frm:
                day = parse_date(r.get("datum")); tm, _ = parse_time(r.get("uhrzeit") or r.get("von"))
                frm = _when(day, tm) if day and tm else ""
            to = r.get("bis_iso") or ""
            if not to and r.get("bis") and frm:
                tm, _ = parse_time(r["bis"]); to = _when(dt.datetime.fromisoformat(frm).date(), tm) if tm else ""
            out.append({"from": frm, "to": to, "labels": [x.strip() for x in (r.get("schnellwahl") or "").split(",") if x.strip()],
                        "text": r.get("text") or "", "witness": r.get("zeuge") or "", "id": r.get("kennung") or None, "fields": fv, "kind_l": r.get("notiz_art") or ""})
        return out, None
    out, day = [], None
    wit_re = re.compile(r"\s*–\s*(?:Zeuge|Zeugin|Witness):\s*(.+?)\s*$")
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if re.match(r"---\s*(Prüfblock|Verification block)", line):   # ab hier nur noch der Prüfblock
            break
        tm, end = parse_time(line)
        if tm is None:
            d_ = parse_date(line)
            if d_:
                day = d_
            continue
        if day is None:
            continue
        rest = line[end:].strip(); to = ""
        m = re.match(r"[–-]\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\s*", rest)
        if m:
            t2, _ = parse_time(m[1]); to = _when(day, t2) if t2 else ""; rest = rest[m.end():]
        rest = re.sub(r"\s*\((?:geändert|changed)\)\s*$", "", rest)
        rest = re.sub(r"\s*\((?:erfasst|noted|Zeit per Taste|time set by|ungefähr|approximate|Zeuge |witness |Häufigkeit|frequency|Polizei|police|gemeldet|reported|Folgen|effects|Attest|certificate|Drohung|threat|aus Dokument|recognised|Anlage|attachment)[^()]*(?:\([^()]*\)[^()]*)*\)\s*$", "", rest)
        rest = re.sub(r"\s*\{[^{}]*\}\s*$", "", rest)        # eigene Felder {Name: Wert; …} (nur in CSV/JSON wieder einlesbar)
        labels = []
        m = re.match(r"\[([^\]]*)\]\s*", rest)
        if m:
            labels = [x.strip() for x in m[1].split(",") if x.strip()]; rest = rest[m.end():]
        wit = ""
        m = wit_re.search(rest)
        if m:
            wit = m[1]; rest = rest[:m.start()]
        elif re.match(r"(?:Zeuge|Zeugin|Witness):\s*", rest):
            wit = re.sub(r"^(?:Zeuge|Zeugin|Witness):\s*", "", rest); rest = ""
        out.append({"from": _when(day, tm), "to": to, "labels": labels, "text": rest.replace(" / ", "\n").strip(), "witness": wit.strip(), "id": None})
    return out, None if out else "empty"


def _label_map():
    m = {}
    for g in NOTE_TAGS.values():
        for k in g:
            for l in (TAG_DE.get(k), TAG_EN.get(k), qt_all()["ren"].get(k), k):
                if l:
                    m[str(l).lower()] = k
    for k, o in qt_all()["own"].items():
        if isinstance(o, dict) and not o.get("del"):
            m[(o.get("l") or k).lower()] = k
    for w, k in (("knall", "tuer"), ("slam", "tuer")):         # „Tür knallt“: Woher Tür und Was Türenknallen
        m.setdefault(w, k)
    return m


def import_plan(text):
    """Vorschau/Übernahme: welche Notizen neu sind, welche schon da (gleiche Kennung oder gleiche Zeit, gleicher Text, gleiche Wörter)."""
    rows, err = parse_import(text)
    if err:
        return None, err
    lm = _label_map()
    with NOTES_LOCK:
        have_id = {x.get("id") for x in notes_all()["free"]}
        have_key = {(ms_of(x.get("from")), (x.get("text") or "").strip(), tuple(sorted(x.get("tags") or []))) for x in notes_all()["free"]}
    plan = {"new": [], "dup": 0, "bad": 0, "words": []}
    words = {}
    for r in rows:
        a = ms_of(r.get("from"))
        if a is None:
            plan["bad"] += 1; continue
        keys = [k for k in (r.get("keys") or []) if isinstance(k, str) and (k in NOTE_TAG_SET or k.startswith("c_"))]
        for l in r.get("labels") or []:
            k = lm.get(l.lower())
            if k:
                keys.append(k)
            else:
                words.setdefault(l.lower(), l); keys.append("?" + l)
        text = clean_text(r.get("text")); wit = clean_text(r.get("witness"), 200)
        fv, _ = felder.clean_fields(fb_defs(), r.get("fields"))
        if wit:
            keys.append("zeuge")
        keys = list(dict.fromkeys(keys))
        if not text and not keys and not fv:
            plan["bad"] += 1; continue
        nid = re.sub(r"[^a-z0-9_]", "", str(r.get("id") or ""))[:20]
        if (nid and nid in have_id) or (a, text, tuple(sorted(k for k in keys if not k.startswith("?")))) in have_key:
            plan["dup"] += 1; continue
        b = ms_of(r.get("to")) if r.get("to") else None
        kinds = fb_all().get("kinds") or []
        kd = felder.kind_ok(kinds, str(r.get("kind") or "")) or next((k["id"] for k in kinds if not k.get("del") and r.get("kind_l") and k["l"].lower() == str(r["kind_l"]).lower()), "")
        plan["new"].append({"id": nid, "from": iso_of(a), "to": iso_of(b) if b and b >= a else "", "keys": keys, "text": text, "witness": wit, "fields": fv, "kind": kd})
    plan["words"] = sorted(words.values(), key=str.lower)
    return plan, None


def import_text(d, apply=False):
    if not pro_ok():
        return {"ok": False, "error": "pro"}
    if d.get("path"):
        p = safe_path(d["path"], (".txt", ".csv", ".json", ".log"), write=False)
        if not p or not os.path.isfile(p):
            return {"ok": False, "error": "path"}
        if os.path.getsize(p) > 20 * 1024 * 1024:
            return {"ok": False, "error": "too big"}
        with open(p, encoding="utf-8", errors="replace") as f:
            text = f.read()
    else:
        text = str(d.get("content") or "")
    plan, err = import_plan(text)
    if err:
        return {"ok": False, "error": err}
    res = {"ok": True, "new": len(plan["new"]), "dup": plan["dup"], "bad": plan["bad"], "words": plan["words"][:30],
           "sample": [{"from": x["from"], "text": x["text"][:80]} for x in plan["new"][:5]]}
    if not apply:
        return res
    made = {}
    for w in plan["words"]:                            # unbekannte Wörter als eigene anlegen (so weit erlaubt)
        r = qt_change({"action": "add", "l": w})
        if r.get("ok") and r.get("k"):
            made[w.lower()] = r["k"]
    n = 0
    with NOTES_LOCK:
        a = notes_all(); have = {x.get("id") for x in a["free"]}
        for x in plan["new"][:NOTES_MAX - len(a["free"])]:
            keys, extra = [], []
            for k in x["keys"]:
                if k.startswith("?"):
                    kk = made.get(k[1:].lower())
                    (keys.append(kk) if kk else extra.append(k[1:]))
                else:
                    keys.append(k)
            text = x["text"] if not extra else ((", ".join(extra) + (" – " if x["text"] else "")) + x["text"])
            nid = x["id"] if x["id"] and x["id"] not in have else "r_" + secrets.token_hex(5)
            a["free"].append(dict({"id": nid, "from": x["from"], "to": x["to"], "src": "all", "text": text, "tags": list(dict.fromkeys(keys))[:12],
                                   "witness": x["witness"], "ts": now_iso(), "by": "import"}, **({"fields": x["fields"]} if x.get("fields") else {}), **({"kind": x["kind"]} if x.get("kind") else {})))
            have.add(nid); n += 1
        if n:
            notes_save()
    diary_soon()
    return dict(res, applied=n, words_made=len(made))


def export_csv():
    """Tabelle: Datum und Uhrzeit wie in der Anzeige eingestellt, dazu die genaue Zeit (ISO) für den Abgleich."""
    out = io.StringIO(); w = SafeWriter(out); pf = prefs(); de = lang() != "en"
    notes = sorted(notes_list(limit=None), key=lambda p: p["a"])
    fc = felder.csv_defs(fb_defs(), notes)                  # je eigenes Feld eine Spalte
    kinds = fb_all().get("kinds") or []; kcol = any(p.get("kind") for p in notes)
    w.writerow(["datum", "von", "bis", "schnellwahl", "text", "zeuge", "von_iso", "bis_iso", "geschrieben", "kennung", "erfasst_iso", "zeit_per_taste", "ungefaehr", "geaendert"] + EXT_COLS
               + [felder.csv_head(b, de) for b in fc] + (["notiz_art"] if kcol else []))
    for p in notes:
        a = dt.datetime.fromtimestamp(p["a"] / 1000).astimezone(); b = dt.datetime.fromtimestamp(p["b"] / 1000).astimezone() if p.get("to") else None
        w.writerow([fmt_date(a, pf), notime_txt() if p.get("notime") else fmt_time(a, pf), fmt_time(b, pf) if b else "", ", ".join(p["tagl"]), p.get("text"), p.get("witness"),
                    p.get("from"), p.get("to"), p.get("ts"), p.get("id"), cap_iso(p), (p.get("wl") or tag_label(p["wk"])) if p.get("wk") else "",
                    "ja" if p.get("approx") else "", p.get("edited") or ""] + ext_cols(p) + felder.csv_cells(fc, p, de) + ([felder.kind_label(kinds, p.get("kind"))] if kcol else []))
    for k, v in proof_block().items():
        w.writerow(["#" + k, v])
    return ("﻿" + out.getvalue()).encode("utf-8")


# =====================================================================
# Bericht für Dritte (Anwalt, Gericht, Hausverwaltung): Zusammenfassung nach Zeitpunkt, Art, Intensität, Dauer, Häufigkeit,
# chronologische Liste mit Ereignis- und Erfassungszeit, Zeugen, Polizei/Meldungen/Atteste, lückenlose Tagesachse,
# Prüfsummen mit Erläuterung. „gs“: kompakt für einen Gewaltschutzantrag, Vorfälle mit Drohung/Gewalt zuerst.
# Nur Anzeige/Export – gespeichert wird nichts.
# =====================================================================
GAP_MS = 12 * 3600 * 1000                                  # so viel später notiert: im Bericht sichtbar markieren


def cap_ms(p):
    """Erfassungszeit: cap (Zeit-Taste/Zeit von Hand) oder der Zeitpunkt, zu dem die Notiz angelegt wurde."""
    if p.get("cap"):
        return int(p["cap"])
    return ms_of(p.get("at")) or ms_of(p.get("ts"))


def wit_list(p):
    """Zeugen einer Notiz mit Rolle und Erreichbarkeit (aus der Notiz, sonst aus der Personenliste)."""
    info, ext = persons_info(), p.get("ext") or {}
    out = []
    for i, n in enumerate(x.strip() for x in str(p.get("witness") or "").split(",") if x.strip()):
        pi = info.get(n) or {}
        r = (ext.get("wrole") if i == 0 else "") or pi.get("r") or ""
        c = (ext.get("wcontact") if i == 0 else "") or pi.get("c") or ""
        out.append({"name": n, "rolle": r, "erreichbar": c})
    return out


def _dur_txt(ms):
    m = int(round(ms / 60000)); return f"{m // 60}:{m % 60:02d} h" if m >= 60 else f"{m} min"


def report_build(gs=False, t_from=None, t_to=None):
    de = lang() != "en"; pf = prefs()
    RL, PL = (ROLE_DE, REP_DE) if de else (ROLE_EN, REP_EN)
    notes = [p for p in notes_list(t_from, t_to, limit=None)]
    notes.sort(key=lambda p: p["a"])
    timed = [p for p in notes if not p.get("notime")]
    kinds, lvls, srcs = {}, {}, {}
    for p in timed:
        for t_ in p.get("tags") or []:
            g = tag_group(t_)
            if g == "lvl":
                lvls[tag_label(t_)] = lvls.get(tag_label(t_), 0) + 1
            elif g == "src":
                srcs[tag_label(t_)] = srcs.get(tag_label(t_), 0) + 1
            elif g in ("kind", "own") or g in group_custom():
                kinds[tag_label(t_)] = kinds.get(tag_label(t_), 0) + 1
    no_lvl = sum(1 for p in timed if not any(tag_group(t_) == "lvl" for t_ in p.get("tags") or []))
    durs = [p["b"] - p["a"] for p in timed if p.get("to") and p["b"] > p["a"]]
    night = sum(1 for p in timed if (lambda h: h >= 22 or h < 6)(dt.datetime.fromtimestamp(p["a"] / 1000).hour))
    wd = [0] * 7
    for p in timed:
        wd[dt.datetime.fromtimestamp(p["a"] / 1000).weekday()] += 1
    d0 = dt.date.fromtimestamp(t_from / 1000) if t_from else (dt.date.fromtimestamp(timed[0]["a"] / 1000) if timed else dt.date.today())
    d1 = dt.date.fromtimestamp(t_to / 1000) if t_to else dt.date.today()
    if d1 < d0:
        d1 = d0
    days, byday = [], {}
    for p in timed:
        byday.setdefault(dt.date.fromtimestamp(p["a"] / 1000), []).append(p)
    d = d0
    while d <= d1 and len(days) < 3700:
        days.append({"tag": d.isoformat(), "anzahl": len(byday.get(d, [])), "zeiten": [fmt_time(dt.datetime.fromtimestamp(p["a"] / 1000).astimezone(), pf) for p in byday.get(d, [])]})
        d += dt.timedelta(days=1)
    weeks = max(1.0, len(days) / 7.0)
    rows = []
    for p in notes:
        ext = p.get("ext") or {}
        cm = cap_ms(p); gap = (cm - p["b"]) if (cm and not p.get("notime")) else 0
        rows.append({"id": p.get("id"), "von": p.get("from") or "", "bis": p.get("to") or "", "ohne_zeitpunkt": bool(p.get("notime")),
                     "erfasst": dt.datetime.fromtimestamp(cm / 1000).astimezone().isoformat(timespec="seconds") if cm else "",
                     "abstand_h": round(gap / 3600000, 1) if gap > GAP_MS else 0, "art": [tag_label(t_) for t_ in p.get("tags") or [] if tag_group(t_) != "lvl" and t_ != "zeuge"],
                     "intensitaet": [tag_label(t_) for t_ in p.get("tags") or [] if tag_group(t_) == "lvl"], "text": p.get("text") or "",
                     "dauer_min": round((p["b"] - p["a"]) / 60000) if p.get("to") and p["b"] > p["a"] else None, "haeufigkeit": ext.get("freq", ""),
                     "zeugen": wit_list(p), "polizei": ({"vorgang": ext.get("pol_nr", "")} if ext.get("pol") else None),
                     "meldung": ({"an": PL.get(ext.get("rep_to"), ""), "datum": ext.get("rep_date", "")} if ext.get("rep_to") or ext.get("rep_date") else None),
                     "folgen": ext.get("health", ""), "attest": ext.get("attest", ""), "drohung_gewalt": bool(ext.get("threat")),
                     "zeit_per_taste": (p.get("wl") or tag_label(p["wk"])) if p.get("wk") and not p.get("notime") else "", "ungefaehr": bool(p.get("approx")),
                     "geaendert": p.get("edited") or "", "a": p["a"], "b": p["b"],
                     "felder": [{"id": b_["id"], "name": b_.get("l"), "wert": (p.get("fields") or {}).get(b_["id"]), "text": felder.fmt(b_, (p.get("fields") or {}).get(b_["id"]), de, fb_dt)}
                                for b_ in fb_defs() if b_["id"] in (p.get("fields") or {})]})
    if gs:
        rows.sort(key=lambda r: (not r["drohung_gewalt"], r["a"]))
    wits = {}
    for r in rows:
        for w in r["zeugen"]:
            e = wits.setdefault(w["name"], {"name": w["name"], "rolle": w["rolle"], "erreichbar": w["erreichbar"], "vorfaelle": []})
            e["rolle"] = e["rolle"] or w["rolle"]; e["erreichbar"] = e["erreichbar"] or w["erreichbar"]
            e["vorfaelle"].append(r["von"] or r["erfasst"])
    ops = {}
    for e in proto_read():
        if "_bad" not in e and (not t_from or True):
            ops[e.get("op")] = ops.get(e.get("op"), 0) + 1
    return {"gewaltschutz": bool(gs), "zeitraum": {"von": d0.isoformat(), "bis": d1.isoformat()}, "erstellt": now_iso(),
            "zusammenfassung": {"vorfaelle": len(timed), "ohne_zeitpunkt": len(notes) - len(timed), "tage_mit_eintrag": len(byday), "tage_im_zeitraum": len(days),
                                "nachts_22_6": night, "tagsueber": len(timed) - night, "wochentage": dict(zip((WD_DE if de else WD_EN), wd)),
                                "art": dict(sorted(kinds.items(), key=lambda x: -x[1])), "herkunft": dict(sorted(srcs.items(), key=lambda x: -x[1])),
                                "intensitaet": dict(lvls, **{("ohne Angabe" if de else "not given"): no_lvl}),
                                "dauer": {"mit_dauer": len(durs), "gesamt_min": round(sum(durs) / 60000), "schnitt_min": round(sum(durs) / len(durs) / 60000) if durs else 0,
                                          "laengste_min": round(max(durs) / 60000) if durs else 0},
                                "je_woche": round(len(timed) / weeks, 1), "drohung_gewalt": sum(1 for r in rows if r["drohung_gewalt"]),
                                "spaet_notiert": sum(1 for r in rows if r["abstand_h"]),
                                "zaehler": [{"id": b_["id"], "name": b_.get("l"), "summe": felder.counter_sum(notes, b_["id"]),
                                             "tage": len({dt.date.fromtimestamp(p["a"] / 1000) for p in notes if b_["id"] in (p.get("fields") or {})})}
                                            for b_ in fb_defs() if b_["type"] == "counter" and any(b_["id"] in (p.get("fields") or {}) for p in notes)]},
            "vorfaelle": rows, "zeugen": list(wits.values()), "tage": days, "protokoll": ops, "nachweis": proof_block(),
            "anlagen": [att_public(x) for x in att_all()["files"] if not x.get("del") and (set(x.get("notes") or []) & {r["id"] for r in rows}
                                                                                       or (t_from is None and t_to is None))]}


def report_text(rb):
    de = lang() != "en"; pf = prefs(); L = []
    T = lambda a, b: a if de else b
    z = rb["zusammenfassung"]
    fd = lambda iso_: fmt_date(dt.datetime.fromisoformat(iso_), pf) if iso_ else "–"
    L.append(T("GReport – Übersicht für einen Gewaltschutzantrag", "GReport – overview for a protection order") if rb["gewaltschutz"] else T("GReport – Bericht", "GReport – report"))
    L.append(T("Zeitraum: ", "Period: ") + fd(rb["zeitraum"]["von"]) + " – " + fd(rb["zeitraum"]["bis"]) + T(" · erstellt ", " · created ") + rb["erstellt"])
    L.append(T("Eigene Aufzeichnungen der Person, die die App nutzt. Keine Rechtsberatung.", "Own records of the person using the app. Not legal advice."))
    L.append("")
    L.append(T("1. Zusammenfassung", "1. Summary"))
    L.append(T(f"- Vorfälle: {z['vorfaelle']} an {z['tage_mit_eintrag']} von {z['tage_im_zeitraum']} Tagen (im Schnitt {z['je_woche']} je Woche)",
               f"- Incidents: {z['vorfaelle']} on {z['tage_mit_eintrag']} of {z['tage_im_zeitraum']} days (on average {z['je_woche']} per week)"))
    L.append(T(f"- Zeitpunkt: nachts (22–6 Uhr) {z['nachts_22_6']}, tagsüber {z['tagsueber']}", f"- Time: at night (10 pm–6 am) {z['nachts_22_6']}, daytime {z['tagsueber']}")
             + " · " + ", ".join(f"{k} {v}" for k, v in z["wochentage"].items()))
    if z["art"]:
        L.append(T("- Art: ", "- Kind: ") + ", ".join(f"{k} {v}" for k, v in z["art"].items()))
    if z["herkunft"]:
        L.append(T("- Herkunft: ", "- Source: ") + ", ".join(f"{k} {v}" for k, v in z["herkunft"].items()))
    L.append(T("- Intensität: ", "- Intensity: ") + ", ".join(f"{k} {v}" for k, v in z["intensitaet"].items()))
    du = z["dauer"]
    L.append(T(f"- Dauer: bei {du['mit_dauer']} Vorfällen angegeben, zusammen {_dur_txt(du['gesamt_min'] * 60000)}, im Schnitt {_dur_txt(du['schnitt_min'] * 60000)}, längste {_dur_txt(du['laengste_min'] * 60000)}",
               f"- Duration: given for {du['mit_dauer']} incidents, total {_dur_txt(du['gesamt_min'] * 60000)}, average {_dur_txt(du['schnitt_min'] * 60000)}, longest {_dur_txt(du['laengste_min'] * 60000)}"))
    fr = {}
    for r in rb["vorfaelle"]:
        if r["haeufigkeit"]:
            fr[r["haeufigkeit"]] = fr.get(r["haeufigkeit"], 0) + 1
    if fr:
        L.append(T("- Häufigkeit (eigene Angaben): ", "- Frequency (own notes): ") + "; ".join(f"{k} ({v}×)" for k, v in fr.items()))
    if z["drohung_gewalt"]:
        L.append(T(f"- Mit Drohung oder Gewalt: {z['drohung_gewalt']}", f"- With threat or violence: {z['drohung_gewalt']}"))
    for c in z.get("zaehler") or []:
        L.append(T(f"- Zähler „{c['name']}“: {c['summe']} im Zeitraum (an {c['tage']} Tagen)", f"- Counter “{c['name']}”: {c['summe']} in the period (on {c['tage']} days)"))
    if z["ohne_zeitpunkt"]:
        L.append(T(f"- Notizen ohne Zeitpunkt: {z['ohne_zeitpunkt']} (nicht in der Zeitachse)", f"- Notes without time: {z['ohne_zeitpunkt']} (not on the timeline)"))
    if z["spaet_notiert"]:
        L.append(T(f"- Mehr als 12 Stunden nach dem Ereignis notiert: {z['spaet_notiert']} (unten mit ⚠ markiert)", f"- Noted more than 12 hours after the event: {z['spaet_notiert']} (marked ⚠ below)"))
    L.append("")
    L.append(T("2. Vorfälle" + (" (Drohung oder Gewalt zuerst)" if rb["gewaltschutz"] else " (chronologisch)"), "2. Incidents" + (" (threat or violence first)" if rb["gewaltschutz"] else " (chronological)")))
    for r in rb["vorfaelle"]:
        a = dt.datetime.fromtimestamp(r["a"] / 1000).astimezone()
        when = fmt_date(a, dict(pf, wd=True)) + " " + (notime_txt() if r["ohne_zeitpunkt"] else ("≈ " if r["ungefaehr"] else "") + fmt_time(a, pf)
                                                       + (" – " + fmt_time(dt.datetime.fromtimestamp(r["b"] / 1000).astimezone(), pf) if r["bis"] else ""))
        head = "- " + ("⚠ " + T("Drohung/Gewalt", "threat/violence") + " · " if r["drohung_gewalt"] else "") + when
        tags = r["art"] + r["intensitaet"]
        L.append(head + ("  [" + ", ".join(tags) + "]" if tags else "") + ("  " + r["text"].replace("\n", " / ") if r["text"] else ""))
        sub = []
        if r["erfasst"]:
            c = dt.datetime.fromisoformat(r["erfasst"])
            sub.append(T("erfasst ", "noted ") + fmt_date(c, pf) + " " + fmt_time(c, pf) + (T(f"  ⚠ erst {r['abstand_h']} Std. nach dem Ereignis", f"  ⚠ only {r['abstand_h']} h after the event") if r["abstand_h"] else ""))
        if r["zeit_per_taste"]:
            sub.append(T("Zeit per Taste gesetzt (", "time set by button (") + r["zeit_per_taste"] + ")")
        if r["ungefaehr"]:
            sub.append(T("ungefähr", "approximate"))
        if r["dauer_min"]:
            sub.append(T("Dauer ", "duration ") + _dur_txt(r["dauer_min"] * 60000))
        if r["haeufigkeit"]:
            sub.append(T("Häufigkeit: ", "frequency: ") + r["haeufigkeit"])
        for w in r["zeugen"]:
            sub.append(T("Zeuge: ", "witness: ") + w["name"] + (" (" + ", ".join(x for x in ((ROLE_DE if de else ROLE_EN).get(w["rolle"], ""), w["erreichbar"]) if x) + ")" if w["rolle"] or w["erreichbar"] else ""))
        if r["polizei"] is not None:
            sub.append(T("Polizei", "police") + (T(", Vorgang ", ", case ") + r["polizei"]["vorgang"] if r["polizei"]["vorgang"] else ""))
        if r["meldung"]:
            sub.append(T("gemeldet an ", "reported to ") + (r["meldung"]["an"] or "–") + (T(" am ", " on ") + fd(r["meldung"]["datum"]) if r["meldung"]["datum"] else ""))
        if r["folgen"]:
            sub.append(T("Folgen: ", "effects: ") + r["folgen"])
        if r["attest"]:
            sub.append(T("Attest: ", "medical certificate: ") + r["attest"])
        for f_ in r.get("felder") or []:
            sub.append(f"{f_['name']}: {f_['text']}")
        if r["geaendert"]:
            sub.append(T("geändert ", "changed ") + r["geaendert"] + T(" (Verlauf im Protokoll)", " (history in the log)"))
        for x in sub:
            L.append("    " + x)
    if not rb["vorfaelle"]:
        L.append(T("  (keine Notizen im Zeitraum)", "  (no notes in this period)"))
    L.append("")
    L.append(T("3. Zeugen", "3. Witnesses"))
    for w in rb["zeugen"]:
        L.append("- " + w["name"] + " – " + ((ROLE_DE if de else ROLE_EN).get(w["rolle"]) or T("Rolle nicht angegeben", "role not given")) + " – "
                 + (w["erreichbar"] or T("Erreichbarkeit nicht angegeben", "contact not given")) + T(f" – bei {len(w['vorfaelle'])} Vorfällen", f" – at {len(w['vorfaelle'])} incidents"))
    if not rb["zeugen"]:
        L.append(T("  (keine Zeugen eingetragen)", "  (no witnesses entered)"))
    L.append("")
    L.append(T("4. Polizei, Meldungen, Atteste", "4. Police, reports, medical certificates"))
    k = 0
    for r in rb["vorfaelle"]:
        a = fmt_date(dt.datetime.fromtimestamp(r["a"] / 1000).astimezone(), pf)
        if r["polizei"] is not None:
            L.append(f"- {a}: " + T("Polizei", "police") + (T(", Vorgang ", ", case ") + r["polizei"]["vorgang"] if r["polizei"]["vorgang"] else "")); k += 1
        if r["meldung"]:
            L.append(f"- {a}: " + T("Meldung an ", "report to ") + (r["meldung"]["an"] or "–") + (T(" am ", " on ") + fd(r["meldung"]["datum"]) if r["meldung"]["datum"] else "")); k += 1
        if r["attest"]:
            L.append(f"- {a}: " + T("Attest: ", "medical certificate: ") + r["attest"]); k += 1
        if r["folgen"]:
            L.append(f"- {a}: " + T("Folgen: ", "effects: ") + r["folgen"]); k += 1
    if not k:
        L.append(T("  (keine eingetragen)", "  (none entered)"))
    if rb.get("anlagen"):
        L.append(T("- Anlagen (Originale im Ordner anlagen/ dieser ZIP-Datei, unverändert):", "- Attachments (originals in the folder anlagen/ of this ZIP file, unchanged):"))
        for a in rb["anlagen"]:
            L.append(f"  - {a.get('name')} ({att_fmt_size(a.get('size'))}" + (", " + a["desc"] if a.get("desc") else "") + f") SHA-256 {a.get('sha256')}")
    L.append("")
    if not rb["gewaltschutz"]:
        L.append(T("5. Zeitachse (jeder Tag im Zeitraum)", "5. Timeline (every day in the period)"))
        for d_ in rb["tage"]:
            dd = dt.date.fromisoformat(d_["tag"])
            L.append(fmt_date(dt.datetime(dd.year, dd.month, dd.day), dict(pf, wd=True)) + "  " + (T(f"{d_['anzahl']} Vorfall" if d_["anzahl"] == 1 else f"{d_['anzahl']} Vorfälle", f"{d_['anzahl']} incident" + ("" if d_["anzahl"] == 1 else "s")) + " (" + ", ".join(d_["zeiten"]) + ")" if d_["anzahl"] else T("– kein Eintrag", "– no entry")))
        L.append("")
    n = "6" if not rb["gewaltschutz"] else "5"
    L.append(n + T(". Prüfsummen und Änderungsprotokoll", ". Hashes and change log"))
    pb = rb["nachweis"]; op = rb["protokoll"]
    L.append(T(f"- Protokoll: {pb['eintraege']} Einträge (angelegt {op.get('add', 0)}, geändert {op.get('edit', 0)}, gelöscht {op.get('del', 0)}, wiederhergestellt {op.get('restore', 0)}, außerhalb von GReport geändert {op.get('extern', 0) + op.get('extern_del', 0)})",
               f"- Log: {pb['eintraege']} entries (created {op.get('add', 0)}, changed {op.get('edit', 0)}, deleted {op.get('del', 0)}, restored {op.get('restore', 0)}, changed outside GReport {op.get('extern', 0) + op.get('extern_del', 0)})"))
    L.append(T("- Erster Hash: ", "- First hash: ") + str(pb["erster_hash"] or "–"))
    L.append(T("- Letzter Hash: ", "- Last hash: ") + str(pb["letzter_hash"] or "–"))
    L.append(T("- Prüfung: ", "- Check: ") + (T("unverändert", "unchanged") if pb["unveraendert"] else T("Abweichung – siehe „Nachweis prüfen“", "deviation – see “Verify record”")) + " · " + pb["zeitquelle"] + (" · " + pb["zeitzone"] if pb["zeitzone"] else ""))
    L.append(T("- So wird geprüft: Jede Änderung an einer Notiz steht als eigener Eintrag in notizen_protokoll.jsonl, mit Zeit, Zeitzone und vollständigem Inhalt "
               "(beim Ändern auch der Fassung davor). Jeder Eintrag enthält den SHA-256-Wert über seinen Inhalt und den Wert des vorigen Eintrags. "
               "Wer einen Eintrag nachträglich ändert, entfernt oder einfügt, unterbricht diese Kette; das lässt sich mit der Datei greport_nachweis_<datum>.json "
               "(Protokoll mit allen Werten) nachrechnen. Änderungen sind so nachvollziehbar und nachträgliche Manipulation ist erkennbar.",
               "- How it is checked: every change to a note is a separate entry in notizen_protokoll.jsonl with time, time zone and full content "
               "(for changes also the previous version). Each entry contains the SHA-256 value over its content and the value of the previous entry. "
               "Changing, removing or inserting an entry later breaks this chain; it can be recomputed with greport_nachweis_<date>.json "
               "(log with all values). Changes are traceable and later manipulation is detectable."))
    L.append(T("- Rohdaten: rohdaten.csv (eine Zeile je Notiz) liegt dem Bericht bei.", "- Raw data: rohdaten.csv (one row per note) is attached to this report."))
    return "\n".join(L) + "\n"


PACKED = {"jpg", "png", "heic", "pdf", "docx", "odt"}            # schon gepackt: unverändert ablegen statt noch einmal packen


def _zip_att(z, x, prefix):
    for which in ("file", "txt"):
        if which == "txt" and not x.get("txt"):
            continue
        p = att_path(x, which)
        if p and os.path.isfile(p):
            rel = (x.get("txt") or {}).get("file") if which == "txt" else x["file"]
            z.write(p, prefix + rel, compress_type=zipfile.ZIP_STORED if which == "file" and x.get("kind") in PACKED else zipfile.ZIP_DEFLATED)


def report_write(f, gs=False, t_from=None, t_to=None):
    """Bericht + Rohdaten (CSV) + Nachweis (Protokoll mit Prüfsummen) + Anlagen (Originale) in eine ZIP-Datei."""
    rb = report_build(gs, t_from, t_to)
    with zipfile.ZipFile(f, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("bericht.txt", "\ufeff" + report_text(rb))
        z.writestr("bericht.json", json.dumps({k: v for k, v in rb.items()}, ensure_ascii=False, indent=1))
        z.writestr("rohdaten.csv", export_csv())
        z.writestr(f"greport_nachweis_{dt.date.today()}.json", json.dumps(nachweis_json(), ensure_ascii=False, indent=1))
        if os.path.exists(proto_path()):
            z.write(proto_path(), "notizen_protokoll.jsonl")
        ids = {a["id"] for a in rb.get("anlagen") or []}
        for x in att_all()["files"]:
            if x.get("id") in ids:
                _zip_att(z, x, "anlagen/")


def report_zip(gs=False, t_from=None, t_to=None):
    bio = io.BytesIO(); report_write(bio, gs, t_from, t_to)
    return bio.getvalue()


def backup_write(f, files=True):
    """Sicherung (immer frei): Notizen, Schnellwahl, Personen, Einstellungen, Änderungsprotokoll und Anlagen (files=False: nur das
    Verzeichnis der Anlagen mit Prüfsummen, ohne die Dateien selbst)."""
    with zipfile.ZipFile(f, "w", zipfile.ZIP_DEFLATED) as z:
        for fn in ("notizen.json", "schnellwahl.json", "personen.json", "einstellungen.json", "felder.json", "notizen_protokoll.jsonl"):
            p = os.path.join(DIR, fn)
            if os.path.exists(p):
                z.write(p, fn)
        if os.path.exists(att_index_path()):
            z.write(att_index_path(), "anlagen/anlagen.json")
        if files:
            for x in att_all()["files"]:
                _zip_att(z, x, "anlagen/")
        z.writestr("info.json", json.dumps({"app": BRAND, "version": VERSION, "at": now_iso(), "anlagen": bool(files)}, ensure_ascii=False))


def backup_zip(files=True):
    bio = io.BytesIO(); backup_write(bio, files)
    return bio.getvalue()


def daily_backup():
    """Pro: einmal am Tag eine Sicherung nach /share/greport/sicherung (die letzten 14 bleiben)."""
    if not pro_ok():
        return
    d = os.path.join(DIR, "sicherung"); day = dt.date.today().isoformat(); p = os.path.join(d, f"greport_{day}.zip")
    if os.path.exists(p):
        return
    os.makedirs(d, exist_ok=True)
    with open(p + ".tmp", "wb") as f:
        backup_write(f, files=False)                    # täglich ohne die Anlagen selbst (die ändern sich nie) – sonst 14 × alle Dateien
    os.replace(p + ".tmp", p)
    for old in sorted(glob.glob(os.path.join(d, "greport_*.zip")))[:-14]:
        try:
            os.remove(old)
        except OSError:
            pass
    log("Tägliche Sicherung:", p)


# =====================================================================
# Home Assistant: Logbuch und Entitäten (MQTT)
# =====================================================================
def ha_api():
    url = os.environ.get("GR_HA_URL") or ("http://supervisor/core/api" if os.environ.get("SUPERVISOR_TOKEN") else "")
    return url.rstrip("/"), os.environ.get("GR_HA_TOKEN") or os.environ.get("SUPERVISOR_TOKEN") or ""


HA = {"ok": None, "error": "", "logged": 0}


def logbook(x):
    if not OPT.get("logbook", True):
        return
    url, tok = ha_api()
    if not url:
        return
    body = {"name": BRAND, "message": note_text(x) or "Notiz", "domain": "greport"}
    if MQ["ok"]:
        body["entity_id"] = "button.greport_hinzufuegen"

    def go():
        try:
            req = urllib.request.Request(url + "/services/logbook/log", data=json.dumps(body).encode(), method="POST",
                                         headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=8):
                pass
            HA.update(ok=True, error=""); HA["logged"] += 1
        except Exception as e:
            HA.update(ok=False, error=str(e)[:120]); log("Logbuch:", e)
    threading.Thread(target=go, daemon=True).start()


MQ = {"c": None, "ok": False, "sel": None, "day": None}
NONE_OPT = "–"
GROUP_SLUG = {"src": "woher", "kind": "was", "lvl": "wie_stark", "eff": "folgen", "act": "massnahmen", "misc": "sonstiges", "own": "eigene"}
GROUP_DE = {"src": "Woher", "kind": "Was", "lvl": "Wie stark", "eff": "Folgen", "act": "Maßnahmen", "misc": "Sonstiges", "own": "Eigene"}
GROUP_EN = {"src": "Source", "kind": "What", "lvl": "How strong", "eff": "Effects", "act": "Actions", "misc": "Other", "own": "Own"}
GROUP_ICON = {"src": "mdi:compass-outline", "kind": "mdi:volume-high", "lvl": "mdi:signal-cellular-3", "eff": "mdi:sleep-off",
              "act": "mdi:account-voice", "misc": "mdi:dots-horizontal", "own": "mdi:star-outline"}
FORM = {"text": "", "witness": "", "pick": {g: NONE_OPT for g in GROUPS + [WHEN_G]}, "fields": {}}     # Eingaben aus Home Assistant bis „Speichern“


def mqtt_fb():
    """Eigene Felder in Home Assistant, nur wo es einfach geht: Text und Ort als Textfeld, Auswahlliste und Ja/Nein als
    Auswahl, Zähler als Knopf „+1“. [(Baustein, Art, Kürzel)] – andere Arten (Zahl, Skala, Dauer, Datum, Person) nicht."""
    out = []
    for b in fb_defs():
        if b.get("del") or b.get("hide"):
            continue
        h = b["id"][2:]
        if b["type"] in ("text", "place"):
            out.append((b, "text", "feld_" + h))
        elif b["type"] == "select" and not b.get("multi") and b.get("opts"):
            out.append((b, "select", "feld_" + h))
        elif b["type"] == "yesno":
            out.append((b, "select", "feld_" + h))
        elif b["type"] == "counter":
            out.append((b, "button", "zaehler_" + h))
    return out


def yesno_opts():
    return [NONE_OPT, "Ja", "Nein"] if lang() != "en" else [NONE_OPT, "Yes", "No"]


def mqtt_fb_val(b):
    v = FORM["fields"].get(b["id"])
    if b["type"] == "yesno":
        return NONE_OPT if v is None else yesno_opts()[1 if v else 2]
    if b["type"] == "select":
        return v or NONE_OPT
    return v or ""
LAST_N = 10                                                                    # so viele Notizen als Attribut des Sensors


def pub(topic, payload, retain=False):
    c = MQ["c"]
    if c is not None:
        try:
            c.publish(topic, payload, retain=retain)
        except Exception:
            pass


def group_opts(items):
    return [NONE_OPT] + [x for x in dict.fromkeys(l for _, l in items) if x != NONE_OPT]


def mqtt_form_state():
    # Leerer Text darf nicht „retained“ sein (das löscht nur die gespeicherte Nachricht) – dann gewöhnlich senden
    pub(f"{TOPIC}/notiz", FORM["text"], bool(FORM["text"]))
    pub(f"{TOPIC}/zeuge", FORM["witness"], bool(FORM["witness"]))
    for g, slug, _, _ in mqtt_groups():
        pub(f"{TOPIC}/{slug}", FORM["pick"].get(g) or NONE_OPT, True)
    for b, kind, slug in mqtt_fb():
        if kind != "button":
            v = str(mqtt_fb_val(b))
            pub(f"{TOPIC}/{slug}", v, bool(v))


def notes_summary():
    """Werte für die Sensoren „Letzte Notiz“ und „Notizen heute“ (nur lesen, ändert nichts)."""
    today = dt.datetime.now().astimezone().replace(hour=0, minute=0, second=0, microsecond=0)
    t0 = int(today.timestamp() * 1000)
    last = notes_list(limit=LAST_N)
    n_today = len(notes_list(t_from=t0, limit=None))
    p = prefs(); items = []
    for x in last:
        d = dt.datetime.fromtimestamp(x["a"] / 1000.0)
        items.append({"datum": fmt_date(d, p), "zeit": "" if x.get("notime") else fmt_time(d, p), "von": x.get("from"), "bis": x.get("to") or "",
                      "text": note_text(x), "zeuge": x.get("witness") or "", "woerter": x.get("tagl") or [],
                      **({"ohne_zeitpunkt": True} if x.get("notime") else {})})
    if last:
        d = dt.datetime.fromtimestamp(last[0]["a"] / 1000.0)
        state_txt = ((note_text(last[0]) or "Notiz") if last[0].get("notime") else (fmt_time(d, p) + " " + (note_text(last[0]) or "Notiz")))[:255]
    else:
        state_txt = "–"
    return {"last": state_txt, "today": n_today, "attr": {"notizen": items, "heute": n_today, "von": last[0].get("from") if last else ""}}


def mqtt_notes():
    if MQ["c"] is None:
        return None
    try:
        s = notes_summary()
    except Exception as e:
        log("Sensoren:", e)
        return None
    pub(f"{TOPIC}/letzte_notiz", s["last"], True)
    pub(f"{TOPIC}/notizen_heute", str(s["today"]), True)
    pub(f"{TOPIC}/notizen/attr", json.dumps(s["attr"], ensure_ascii=False), True)
    MQ["day"] = dt.date.today()
    return s


def mqtt_announce(client=None, *_):
    c = client if hasattr(client, "subscribe") else MQ["c"]
    if c is None:
        return
    de = lang() == "de"
    dev = {"identifiers": [HAID], "name": BRAND, "manufacturer": "G-Simulation", "model": "GReport", "sw_version": VERSION,
           "suggested_area": BRAND}                     # neues Gerät landet gleich im Bereich „GReport“
    avail = {"availability_topic": f"{TOPIC}/status", "device": dev}

    def cfg(kind, oid, d):
        pub(f"homeassistant/{kind}/{HAID}/{oid}/config", json.dumps(dict(d, unique_id=f"{HAID}_{oid}", object_id=f"{HAID}_{oid}", **avail),
                                                                   ensure_ascii=False), True)
    opts = [l for _, l in qt_visible()] or ["–"]
    opts = list(dict.fromkeys(opts))
    if MQ["sel"] not in opts:
        MQ["sel"] = opts[0]
    pub(f"{TOPIC}/status", "online", True)
    # wie bisher: eine Taste wählen + „Hinzufügen“ = Notiz mit Uhrzeit (auch für Automationen)
    cfg("select", "schnellwahl", {"name": "Schnellwahl" if de else "Quick select", "command_topic": f"{TOPIC}/schnellwahl/set",
                                  "state_topic": f"{TOPIC}/schnellwahl", "options": opts, "icon": "mdi:format-list-bulleted"})
    cfg("button", "hinzufuegen", {"name": "Hinzufügen" if de else "Add", "command_topic": f"{TOPIC}/hinzufuegen/set",
                                  "payload_press": "PRESS", "icon": "mdi:note-plus"})
    # Notiz wie in der App: Text, je Gruppe eine Auswahl, Zeuge, Speichern
    cfg("text", "notiz", {"name": "Notiz" if de else "Note", "command_topic": f"{TOPIC}/notiz/set", "state_topic": f"{TOPIC}/notiz",
                          "max": 255, "mode": "text", "icon": "mdi:note-text-outline"})
    cfg("text", "zeuge", {"name": "Zeuge" if de else "Witness", "command_topic": f"{TOPIC}/zeuge/set", "state_topic": f"{TOPIC}/zeuge",
                          "max": 200, "mode": "text", "icon": "mdi:account-eye-outline"})
    groups = qt_groups()
    for g, slug, name, icon in mqtt_groups():
        if groups.get(g):
            go = group_opts(groups[g])
            if FORM["pick"].get(g) not in go:
                FORM["pick"][g] = NONE_OPT
            cfg("select", slug, {"name": name, "command_topic": f"{TOPIC}/{slug}/set",
                                 "state_topic": f"{TOPIC}/{slug}", "options": go, "icon": icon})
        else:                                                   # Gruppe ohne sichtbare Tasten: Auswahlliste entfernen
            FORM["pick"][g] = NONE_OPT
            pub(f"homeassistant/select/{HAID}/{slug}/config", "", True)
    for g, o in qt_all()["groups"].items():                     # gelöschte eigene Rubriken: Auswahlliste entfernen
        if isinstance(o, dict) and o.get("del"):
            pub(f"homeassistant/select/{HAID}/rubrik_{g[2:]}/config", "", True)
    used = set()
    for b, kind, slug in mqtt_fb():                             # eigene Felder (nur einfache Arten)
        used.add((kind, slug))
        if kind == "text":
            cfg("text", slug, {"name": b["l"], "command_topic": f"{TOPIC}/{slug}/set", "state_topic": f"{TOPIC}/{slug}", "max": 255, "mode": "text",
                               "icon": "mdi:map-marker-outline" if b["type"] == "place" else "mdi:form-textbox"})
        elif kind == "select":
            go = yesno_opts() if b["type"] == "yesno" else [NONE_OPT] + [o for o in b.get("opts") or [] if o != NONE_OPT]
            cfg("select", slug, {"name": b["l"], "command_topic": f"{TOPIC}/{slug}/set", "state_topic": f"{TOPIC}/{slug}", "options": go,
                                 "icon": "mdi:toggle-switch-outline" if b["type"] == "yesno" else "mdi:form-dropdown"})
        else:
            cfg("button", slug, {"name": b["l"] + " +1", "command_topic": f"{TOPIC}/{slug}/set", "payload_press": "PRESS", "icon": "mdi:counter"})
    for b in fb_defs():                                         # gelöschte/ausgeblendete Felder: Entitäten entfernen
        for kind, slug in (("text", "feld_" + b["id"][2:]), ("select", "feld_" + b["id"][2:]), ("button", "zaehler_" + b["id"][2:])):
            if (kind, slug) not in used:
                pub(f"homeassistant/{kind}/{HAID}/{slug}/config", "", True)
    cfg("button", "speichern", {"name": "Speichern" if de else "Save", "command_topic": f"{TOPIC}/speichern/set",
                                "payload_press": "PRESS", "icon": "mdi:content-save-outline"})
    cfg("sensor", "letzte_notiz", {"name": "Letzte Notiz" if de else "Last note", "state_topic": f"{TOPIC}/letzte_notiz",
                                   "json_attributes_topic": f"{TOPIC}/notizen/attr", "icon": "mdi:note-outline"})
    cfg("sensor", "notizen_heute", {"name": "Notizen heute" if de else "Notes today", "state_topic": f"{TOPIC}/notizen_heute",
                                    "state_class": "measurement", "unit_of_measurement": "Notizen" if de else "notes",
                                    "icon": "mdi:counter"})
    pub(f"{TOPIC}/schnellwahl", MQ["sel"], True)
    mqtt_form_state()
    mqtt_notes()
    if hasattr(c, "subscribe") and client is not None:
        c.subscribe([(f"{TOPIC}/+/set", 0), ("homeassistant/status", 0)])
        MQ["ok"] = True
        mqtt_states_soon()


def mqtt_states_soon(delay=3.0):
    """Zustände kurz nach der Anmeldung noch einmal senden – Home Assistant abonniert neue Entitäten erst danach."""
    def go():
        pub(f"{TOPIC}/schnellwahl", MQ["sel"], True)
        mqtt_form_state()
        mqtt_notes()
    t = threading.Timer(delay, go)
    t.daemon = True
    t.start()


def form_save(by="homeassistant"):
    """„Speichern“ in Home Assistant: Notiz aus Text, gewählten Wörtern (je Gruppe) und Zeuge anlegen, Felder leeren."""
    groups = qt_groups(); tags = []
    for g in word_groups():
        lab = FORM["pick"].get(g)
        if lab and lab != NONE_OPT:
            k = next((k for k, l in groups.get(g, []) if l == lab), None)
            if k:
                tags.append(k)
    frm, to, notime, approx, extra = now_iso(), "", False, False, {}
    lab = FORM["pick"].get(WHEN_G)
    wk = next((k for k, l in groups.get(WHEN_G, []) if l == lab), None) if lab and lab != NONE_OPT else None
    if wk:                                                      # „Zeitpunkt“ gewählt: setzt die Zeit der Notiz
        frm, to, notime, approx = when_apply_full(wk)
        extra = {"cap": int(time.time() * 1000), "wk": wk, "wl": lab, "approx": approx}
    r = note_change("add", dict({"text": FORM["text"], "tags": tags, "witness": FORM["witness"], "from": frm, "to": to, "notime": notime, "typed": True,
                                 "fields": dict(FORM["fields"])}, **extra), by=by)
    if r.get("ok"):
        FORM.update(text="", witness="", pick={g: NONE_OPT for g, _, _, _ in mqtt_groups()}, fields={})
        mqtt_form_state()
    log("Notiz aus Home Assistant (Speichern):", "ok" if r.get("ok") else r.get("error"))
    return r


def mqtt_cmd(topic, raw):
    """Befehl aus Home Assistant: Felder merken bzw. Notiz anlegen."""
    if topic.endswith("/schnellwahl/set"):
        if raw in [l for _, l in qt_visible()]:
            MQ["sel"] = raw; pub(f"{TOPIC}/schnellwahl", raw, True)
        return None
    if topic.endswith("/hinzufuegen/set"):
        key = next((k for k, l in qt_visible() if l == MQ["sel"]), None)
        if not key:
            return None
        r = note_change("add", {"tags": [key], "from": now_iso()}, by="homeassistant")
        log("Notiz aus Home Assistant:", MQ["sel"], "ok" if r.get("ok") else r.get("error"))
        return r
    if topic == "homeassistant/status":                      # Home Assistant neu gestartet: alles noch einmal ansagen
        if raw == "online":
            mqtt_announce()
            mqtt_states_soon()
        return None
    if topic == f"{TOPIC}/notiz/set":
        FORM["text"] = clean_text(raw, 255); pub(f"{TOPIC}/notiz", FORM["text"], True)
        return None
    if topic == f"{TOPIC}/zeuge/set":
        FORM["witness"] = clean_text(raw, 200); pub(f"{TOPIC}/zeuge", FORM["witness"], True)
        return None
    if topic == f"{TOPIC}/speichern/set":
        return form_save()
    for b, kind, slug in mqtt_fb():
        if topic != f"{TOPIC}/{slug}/set":
            continue
        if kind == "button":                                    # Zähler +1: eigener Eintrag mit genauer Zeit (oder zur Notiz in Arbeit)
            if b.get("mode") == "add":
                FORM["fields"][b["id"]] = int(FORM["fields"].get(b["id"]) or 0) + 1
                return None
            r = note_change("add", {"fields": {b["id"]: 1}, "from": now_iso(), "cap": int(time.time() * 1000)}, by="homeassistant")
            log("Zähler aus Home Assistant:", b["l"], "ok" if r.get("ok") else r.get("error"))
            return r
        if b["type"] == "yesno":
            o = yesno_opts()
            if raw == NONE_OPT:
                FORM["fields"].pop(b["id"], None)
            elif raw in o:
                FORM["fields"][b["id"]] = raw == o[1]
        elif b["type"] == "select":
            if raw == NONE_OPT:
                FORM["fields"].pop(b["id"], None)
            elif raw in (b.get("opts") or []):
                FORM["fields"][b["id"]] = raw
        else:
            v = clean_text(raw, 255)
            if v:
                FORM["fields"][b["id"]] = v
            else:
                FORM["fields"].pop(b["id"], None)
        v = str(mqtt_fb_val(b)); pub(f"{TOPIC}/{slug}", v, bool(v))
        return None
    for g, slug, _, _ in mqtt_groups():
        if topic == f"{TOPIC}/{slug}/set":
            if raw == NONE_OPT or raw in [l for _, l in qt_groups().get(g, [])]:
                FORM["pick"][g] = raw; pub(f"{TOPIC}/{slug}", raw, True)
            return None
    return None


def mqtt_start():
    host = os.environ.get("MQTT_HOST")
    if not host or not OPT.get("mqtt", True):
        return
    try:
        import paho.mqtt.client as mqtt
        try:
            c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=HAID)
        except AttributeError:
            c = mqtt.Client(client_id=HAID)
        c.username_pw_set(os.environ.get("MQTT_USER"), os.environ.get("MQTT_PASS"))
        c.will_set(f"{TOPIC}/status", "offline", retain=True)
        c.on_connect = mqtt_announce
        c.on_message = lambda _c, _u, m: mqtt_cmd(m.topic, m.payload.decode(errors="ignore").strip())
        MQ["c"] = c
        c.connect_async(host, int(os.environ.get("MQTT_PORT", "1883")))
        c.loop_start()
        log("MQTT aktiv:", host)
    except Exception as e:
        log("MQTT nicht verfügbar:", e)


# =====================================================================
# Dashboard-Karte „GReport“ (custom:greport-card): Datei nach /homeassistant/www/greport, Ressource eintragen
# =====================================================================
HA_CFG = os.environ.get("GR_HA_CONFIG", "/homeassistant")
CARD_NAME = "greport-card.js"
CARD_URL = "/local/greport/" + CARD_NAME
CARD = {"file": False, "resource": None, "restart": False, "error": ""}


def card_file():
    """Karte nach www/greport im Konfigurationsordner legen (nur wenn neu oder geändert). True = Datei liegt bereit."""
    src = os.path.join(WEB, CARD_NAME)
    if not os.path.isdir(HA_CFG) or not os.path.isfile(src):
        CARD["error"] = "config"
        return False
    www = os.path.join(HA_CFG, "www")
    CARD["restart"] = CARD["restart"] or not os.path.isdir(www)     # neuer www-Ordner: Home Assistant liest ihn erst nach Neustart
    dst = os.path.join(www, "greport", CARD_NAME)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    data = open(src, "rb").read().replace(b"{{VERSION}}", VERSION.encode())
    try:
        old = open(dst, "rb").read()
    except OSError:
        old = None
    if old != data:
        with open(dst + ".tmp", "wb") as f:
            f.write(data)
        os.replace(dst + ".tmp", dst)
    CARD["file"] = True
    return True


def card_install():
    """Einstellung „Dashboard-Karte“: Datei bereitlegen und als Ressource eintragen; aus = nur unsere Ressource austragen."""
    on = OPT.get("dashboard_card", True)
    try:
        if on and not card_file():
            log("Dashboard-Karte: kein Zugriff auf den Konfigurationsordner von Home Assistant")
            return CARD
        url, tok = ha_api()
        if not url or not tok:
            return CARD
        import haws  # noqa: PLC0415
        res = haws.call(url, tok, {"type": "lovelace/resources"})[0] or []
        mine = [r for r in res if str(r.get("url") or "").split("?")[0] == CARD_URL]
        want = f"{CARD_URL}?v={VERSION}"
        if on and not mine:
            haws.call(url, tok, {"type": "lovelace/resources/create", "res_type": "module", "url": want})
            log("Dashboard-Karte „GReport“ eingetragen:", want)
        elif on and mine[0].get("url") != want:
            haws.call(url, tok, {"type": "lovelace/resources/update", "resource_id": mine[0]["id"], "res_type": "module", "url": want})
        elif not on:
            for r in mine:
                haws.call(url, tok, {"type": "lovelace/resources/delete", "resource_id": r["id"]})
                log("Dashboard-Karte „GReport“ ausgetragen")
        CARD.update(resource=on, error="")
        if on and CARD["restart"]:
            log("Dashboard-Karte: Ordner www neu angelegt – Home Assistant einmal neu starten, dann ist die Karte da")
    except Exception as e:                                          # z. B. Dashboards im YAML-Modus
        CARD.update(resource=False, error=str(e)[:160])
        if on:
            log("Dashboard-Karte nicht eingetragen:", e, f"– von Hand als Ressource hinzufügen: {CARD_URL} (JavaScript-Modul)")
    return CARD


# =====================================================================
# GLighter: erkennen (Pro-Verbindung liest GLighter selbst aus /share/greport)
# =====================================================================
def glighter():
    """Liest, was GLighter (Pro) über sich in /share/greport/glighter.json schreibt: Geräte und ob verbunden."""
    g = read_json(os.path.join(DIR, "glighter.json"), {}) or {}
    fresh = bool(g) and time.time() - float(g.get("t") or 0) < 300
    return {"found": fresh or os.path.isdir(GL_DIR), "linked": fresh and bool(g.get("pro")),
            "sources": g.get("sources") if fresh and isinstance(g.get("sources"), list) else [], "v": g.get("v")}


def heartbeat():
    # share: Einstellung „Notizen an GLighter weitergeben“ – GLighter zeigt die Notizen nur, wenn sie an ist
    write_json(os.path.join(DIR, "greport.json"), {"app": BRAND, "v": VERSION, "t": time.time(), "notes": "notizen.json", "tags": "schnellwahl.json",
                                                   "share": bool(prefs().get("gl", True))})


def bg_loop():
    while True:
        try:
            heartbeat(); daily_backup()
            if MQ["ok"] and MQ["day"] != dt.date.today():        # nach Mitternacht: „Notizen heute“ wieder bei 0
                mqtt_notes()
        except Exception as e:
            log("Hintergrund:", e)
        time.sleep(60)


# =====================================================================
# Datenordner sperren (nie zwei GReport gleichzeitig)
# =====================================================================
LOCK_FH = None


def lock_dir():
    global LOCK_FH
    os.makedirs(DIR, exist_ok=True)
    LOCK_FH = open(os.path.join(DIR, ".lock"), "w")
    try:
        fcntl.flock(LOCK_FH, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return True
    except OSError:
        return False


# =====================================================================
# Webserver (nur über Ingress)
# =====================================================================
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
         ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json"}


def state():
    return {"ok": True, "version": VERSION, "lang": OPT.get("language", "auto"), "pro": pro_info(), "glighter": glighter(),
            "ha": {"api": bool(ha_api()[0]), "ok": HA["ok"], "error": HA["error"]}, "mqtt": bool(MQ["ok"]),
            "persons": persons(), "persons_info": persons_info(), "dir": DIR, "own_max": own_max(), "prefs": prefs(),
            "att": {"max_file": att_limits()["file"], "kinds": sorted(set(dokument.KINDS))}}


def client_ip(a):
    """Der Server lauscht auf IPv6 und IPv4: Home Assistant (Ingress) kommt dann als „::ffff:172.30.32.2“ an."""
    a = str(a or "")
    return a[7:] if a.startswith("::ffff:") else a


class H(http.server.BaseHTTPRequestHandler):
    server_version = "GReport"
    timeout = 30                                         # Socket-Zeitlimit je Verbindung (hängende Clients)

    def log_message(self, *a):
        pass

    def allowed(self):
        if not RESTRICT or client_ip(self.client_address[0]) in ALLOWED:
            return True
        self.send(403, "text/plain", b"forbidden")
        return False

    def send(self, code, ctype, body, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def send_stream(self, ctype, f, size, extra=None):
        """Große Antworten (Sicherung mit Anlagen, Originaldatei) stückweise senden statt ganz im Speicher."""
        self.send_response(200)
        self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(size)); self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command == "HEAD":
            return
        for chunk in iter(lambda: f.read(MB), b""):
            self.wfile.write(chunk)

    def send_zip(self, writer, fname):
        import tempfile
        with tempfile.TemporaryFile() as f:
            writer(f)
            size = f.tell(); f.seek(0)
            self.send_stream("application/zip", f, size, {"Content-Disposition": f'attachment; filename="{fname}"'})

    def send_att(self, x, which, inline):
        p = att_path(x, which)
        if not p or not os.path.isfile(p):
            return self.send(404, "text/plain", b"not found")
        txt = which == "txt"
        name = x.get("name") or "datei"
        if txt:
            name = os.path.splitext(name)[0] + ".erkannt.txt"
        ctype = "text/plain; charset=utf-8" if txt or x.get("kind") in ("txt", "eml") else x.get("type") or "application/octet-stream"
        if txt or x.get("kind") not in ("jpg", "png", "pdf", "txt", "eml"):
            inline = inline and txt
        q = urllib.parse.quote(name)
        ascii_ = re.sub(r'[^A-Za-z0-9._-]', "_", name)[:80]
        extra = {"Content-Disposition": f"{'inline' if inline else 'attachment'}; filename=\"{ascii_}\"; filename*=UTF-8''{q}", "X-Content-Type-Options": "nosniff"}
        if x.get("kind") != "pdf" or txt:                 # PDF-Anzeige des Browsers läuft nicht in einer Sandbox; PDF führt dort keine Skripte aus
            extra["Content-Security-Policy"] = "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"
        with open(p, "rb") as f:
            self.send_stream(ctype, f, os.path.getsize(p), extra)

    def upload(self, q):
        """Anlage hochladen: Inhalt roh im Körper, Name/Beschreibung/Notiz in der Adresse."""
        g = lambda k: (q.get(k) or [""])[0]
        try:
            n = int(self.headers.get("Content-Length") or -1)
        except (TypeError, ValueError):
            n = -1
        if n < 0:
            return self.js({"ok": False, "error": "bad length"}, 411)
        lim = att_limits()
        if n > lim["file"]:
            self.close_connection = True
            return self.js({"ok": False, "error": "too big", "max": lim["file"]}, 413)
        r = att_upload(self.rfile, n, g("name"), g("desc"), [x for x in g("note").split(",") if x], g("mtime") or None)
        if not r.get("ok") and r.get("error") in ("kind", "full", "type", "limit", "empty"):
            self.close_connection = True                 # Körper nicht gelesen: Verbindung schließen
        return self.js(r, 200 if r.get("ok") else 400)

    def js(self, obj, code=200):
        self.send(code, "application/json", json.dumps(obj, ensure_ascii=False).encode())

    def route(self):
        u = urllib.parse.urlparse(self.path)
        return u.path.rstrip("/").split("/")[-1] if u.path not in ("", "/") else "", urllib.parse.parse_qs(u.query)

    def body(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except (TypeError, ValueError):
            raise ValueError("bad length")
        if n < 0 or n > 20 * 1024 * 1024:
            raise ValueError("too big" if n > 0 else "bad length")
        try:
            d = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            d = {}
        return d if isinstance(d, dict) else {}

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if not self.allowed():
            return
        name, q = self.route()
        g = lambda k, d="": (q.get(k) or [d])[0]
        if name in ("", "index.html"):
            html = open(os.path.join(WEB, "index.html"), encoding="utf-8").read().replace("{{VERSION}}", VERSION)
            return self.send(200, TYPES[".html"], html.encode())
        ext = os.path.splitext(name)[1]
        if ext in TYPES and re.fullmatch(r"[a-z0-9_.\-]+", name) and os.path.isfile(os.path.join(WEB, name)):
            return self.send(200, TYPES[ext], open(os.path.join(WEB, name), "rb").read())
        if name == "state":
            return self.js(state())
        if name == "notetags":
            return self.js(qt_state())
        if name == "felder":                                 # eigene Felder, Vorlage, Zähler heute
            return self.js(fb_state())
        if name == "notes":
            ia = lambda k: int(g(k)) if re.fullmatch(r"-?\d+", g(k)) else None
            return self.js({"ok": True, "notes": notes_list(ia("from"), ia("to"), g("q"), ia("limit") or 500)})
        if name == "bericht":                                # Bericht für Dritte (frei, wie der Nachweis): ZIP mit Bericht, Rohdaten, Nachweis, Anlagen
            ia = lambda k: int(g(k)) if re.fullmatch(r"-?\d+", g(k)) else None
            gs = g("gs") == "1"
            return self.send_zip(lambda f: report_write(f, gs, ia("from"), ia("to")), f'greport_{"gewaltschutz" if gs else "bericht"}_{dt.date.today()}.zip')
        if name == "files":                                  # Anlagen (frei)
            return self.js(att_state())
        if name == "file":
            x = att_get(g("id"))
            if x is None:
                return self.send(404, "text/plain", b"not found")
            return self.send_att(x, "txt" if g("txt") == "1" else "file", g("inline") == "1")
        if name == "scan":                                   # Vorschläge aus einem Dokument (frei, ändert nichts)
            return self.js(doc_suggest(g("id")))
        if name == "trash":
            return self.js({"ok": True, "notes": [note_public(x) for x in notes_all()["trash"]][-200:]})
        if name == "verify":                                 # Nachweis prüfen (frei, ändert nichts)
            return self.js(proto_verify())
        if name == "history":
            return self.js({"ok": True, "items": proto_history(g("id"))})
        if name == "nachweis":
            return self.send(200, "application/json", json.dumps(nachweis_json(), ensure_ascii=False, indent=1).encode(),
                             {"Content-Disposition": f'attachment; filename="greport_nachweis_{dt.date.today()}.json"'})
        if name == "backup":
            return self.send_zip(backup_write, f"greport_{dt.date.today()}.zip")
        if name == "export":
            if not pro_ok():
                return self.js({"ok": False, "error": "pro"}, 403)
            if g("fmt") == "json":
                return self.send(200, "application/json", export_text("json").encode("utf-8"),
                                 {"Content-Disposition": f'attachment; filename="greport_{dt.date.today()}.json"'})
            if g("fmt") == "txt":
                return self.send(200, "text/plain; charset=utf-8", export_text("txt").encode("utf-8"), {"Content-Disposition": f'attachment; filename="greport_{dt.date.today()}.txt"'})
            return self.send(200, "text/csv; charset=utf-8", export_csv(), {"Content-Disposition": f'attachment; filename="greport_{dt.date.today()}.csv"'})
        if name == "textfile":
            return self.js(txt_state())
        if name == "pro":
            return self.js(pro_info())
        if name == "hadash":                                 # Dashboard-Vorlage: Vorschau, ändert nichts
            return self.js(hadash_state())
        return self.send(404, "text/plain", b"not found")

    def do_POST(self):
        if not self.allowed():
            return
        name, q = self.route()
        if name == "upload":
            return self.upload(q)
        try:
            d = self.body()
        except ValueError:
            return self.js({"ok": False, "error": "too big"}, 413)
        if name == "note":
            a = d.get("action") if d.get("action") in ("add", "edit", "del", "restore") else "add"
            return self.js(note_change(a, d))
        if name == "notetags":
            return self.js(qt_change(d))
        if name == "felder":                                 # Felder ändern (set) oder Vorlage anwenden (tpl)
            return self.js(fb_change(d))
        if name == "file":
            return self.js(att_change(d))
        if name == "scan":                                   # Text erkennen (im Hintergrund), danach GET scan
            return self.js(att_scan(str(d.get("id") or ""), d.get("again") is True))
        if name == "doc_apply":                              # Vorschläge übernehmen (Pro, wie der Import)
            return self.js(doc_apply(d))
        if name == "persons":
            return self.js(persons_set(d.get("list"), d.get("info")))
        if name == "prefs":
            return self.js(prefs_set(d))
        if name == "import":
            if "content" in d or "path" in d:                 # Textdatei: Vorschau (preview) oder übernehmen
                return self.js(import_text(d, apply=d.get("apply") is True))
            return self.js(notes_import(d))
        if name == "textfile":
            if d.get("action") == "write":
                ok = diary_write()
                return self.js(dict(txt_state(), ok=ok, error=None if ok else (DIARY["error"] or ("pro" if not pro_ok() else "off"))))
            return self.js(txt_set(d))
        if name == "export_file":
            return self.js(export_file(d))
        if name == "hadash":                                 # Vorschau mit den gewählten Einstellungen (ändert nichts)
            return self.js(hadash_state(d))
        if name == "hadash_apply":                           # Dashboard in Home Assistant anlegen (nur auf Knopfdruck)
            return self.js(hadash_apply(d))
        if name == "pro":
            if d.get("action") == "del":
                try:
                    os.remove(os.path.join(PRIV, "pro.json"))
                except OSError:
                    pass
                PRO_CACHE["v"] = None
                return self.js({"ok": True, "pro": pro_info()})
            r = pro_set(d.get("key"))
            return self.js({"ok": bool(r.get("ok")), "error": r.get("error") or r.get("state"), "pro": pro_info()})
        return self.js({"ok": False, "error": "not found"}, 404)


class Srv(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    timeout = 30
    allow_reuse_address = True
    address_family = __import__("socket").AF_INET6


# =====================================================================
# Dashboard-Karte „GReport“: nach /config/www/greport kopieren und als Ressource eintragen
# =====================================================================
CARD_SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "card", "greport-card.js")
CARD_DIR = os.environ.get("GR_WWW_DIR", "/homeassistant/www/greport")
CARD_URL = "/local/greport/greport-card.js"


def card_copy():
    """Karte nach /config/www/greport/ legen (nur wenn sie sich geändert hat). Gibt True zurück, wenn die Datei da ist."""
    try:
        if not os.path.isdir(os.path.dirname(os.path.dirname(CARD_DIR))):   # /homeassistant (= /config) eingebunden?
            log("Karte: /config ist nicht eingebunden – Karte wird nicht installiert")
            return False
        with open(CARD_SRC, "rb") as f:
            data = f.read()
        os.makedirs(CARD_DIR, exist_ok=True)
        dst = os.path.join(CARD_DIR, "greport-card.js")
        try:
            with open(dst, "rb") as f:
                if f.read() == data:
                    return True
        except OSError:
            pass
        with open(dst + ".tmp", "wb") as f:
            f.write(data)
        os.replace(dst + ".tmp", dst)
        return True
    except Exception as e:
        log("Karte kopieren:", e)
        return False


def card_register():
    """Karte als Dashboard-Ressource eintragen bzw. auf die aktuelle Version umstellen (über die Home-Assistant-Websocket-API)."""
    tok = os.environ.get("SUPERVISOR_TOKEN")
    if not tok:
        return
    try:
        import websocket  # py3-websocket-client
    except ImportError:
        log("Karte: websocket-client fehlt – Ressource bitte von Hand eintragen:", CARD_URL)
        return
    url = f"{CARD_URL}?v={VERSION}"
    ws = None
    try:
        ws = websocket.create_connection(os.environ.get("GR_HA_WS", "ws://supervisor/core/websocket"), timeout=15)
        json.loads(ws.recv())                                    # auth_required
        ws.send(json.dumps({"type": "auth", "access_token": tok}))
        if json.loads(ws.recv()).get("type") != "auth_ok":
            raise RuntimeError("Anmeldung abgelehnt")
        seq = [0]

        def call(**msg):
            seq[0] += 1
            msg["id"] = seq[0]
            ws.send(json.dumps(msg))
            while True:
                r = json.loads(ws.recv())
                if r.get("id") == seq[0]:
                    if not r.get("success"):
                        raise RuntimeError((r.get("error") or {}).get("message") or r)
                    return r.get("result")

        mine = [r for r in call(type="lovelace/resources") if str(r.get("url", "")).split("?")[0] == CARD_URL]
        if not mine:
            call(type="lovelace/resources/create", res_type="module", url=url)
            log("Karte „GReport“ als Dashboard-Ressource eingetragen")
        elif mine[0].get("url") != url:
            call(type="lovelace/resources/update", resource_id=mine[0]["id"], res_type="module", url=url)
            log("Karte „GReport“ auf", VERSION, "aktualisiert")
    except Exception as e:                                       # z. B. Dashboards im YAML-Modus
        log("Karte als Ressource eintragen:", e, "– bitte von Hand:", url)
    finally:
        if ws is not None:
            try:
                ws.close()
            except Exception:
                pass


def card_install():
    if card_copy():
        card_register()



# =====================================================================
# Dashboard-Vorlage für Home Assistant (nur auf Knopfdruck in der App)
# =====================================================================
import hadash  # noqa: E402

# Markdown-Karte: Notiztext und Zeuge als HTML-Zeichen ausgeben, damit keine Links, Bilder oder Überschriften eingeschleust werden
MD_ESC = ("|string|replace('&','&amp;')|replace('\\\\','&#92;')|replace('[','&#91;')|replace(']','&#93;')|replace('(','&#40;')|replace(')','&#41;')"
          "|replace('!','&#33;')|replace('*','&#42;')|replace('_','&#95;')|replace('#','&#35;')|replace('<','&lt;')|replace('>','&gt;')|replace('`','&#96;')"
          "|replace('|','&#124;')|replace('~','&#126;')|replace('\\n',' ')|replace('\\r',' ')")
HADASH_PARTS = ("karte", "felder", "letzte", "heute", "oeffnen")


def hadash_file():
    return os.path.join(PRIV, "hadash.json")


def hadash_prefs():
    d = {"title": BRAND, "url": "gsim-greport", "sidebar": True, "admin": False, "parts": ["karte", "letzte", "heute", "oeffnen"]}
    try:
        with open(hadash_file(), encoding="utf-8") as f:
            x = json.load(f)
        if isinstance(x, dict):
            d.update({k: x[k] for k in d if k in x})
    except (OSError, ValueError):
        pass
    d["parts"] = [p for p in d.get("parts") or [] if p in HADASH_PARTS]
    return d


def hadash_clean(data):
    d = hadash_prefs()
    if isinstance(data.get("title"), str):
        d["title"] = data["title"].strip()[:60] or BRAND
    if isinstance(data.get("url"), str):
        d["url"] = data["url"].strip().lower()[:40]
    for k in ("sidebar", "admin"):
        if k in data:
            d[k] = bool(data[k])
    if isinstance(data.get("parts"), list):
        d["parts"] = [p for p in HADASH_PARTS if p in data["parts"]]
    return d


def hadash_guess():
    """Platzhalter für die Vorschau, wenn Home Assistant nicht erreichbar ist."""
    out = {f"{HAID}_{k}": f"{dom}.{HAID}_{k}" for k, dom in (("notiz", "text"), ("zeuge", "text"), ("speichern", "button"),
                                                                ("letzte_notiz", "sensor"), ("notizen_heute", "sensor"))}
    for slug in GROUP_SLUG.values():
        out[f"{HAID}_{slug}"] = f"select.{HAID}_{slug}"
    return out


def hadash_config(d, ents, card=True):
    de = lang() == "de"
    T = (lambda a, b: a if de else b)
    e = lambda key: ents.get(f"{HAID}_{key}")
    parts = set(d["parts"])
    secs = []
    if "karte" in parts and card:
        secs.append(hadash.section([hadash.heading(T("Notiz erfassen", "Add a note"), "mdi:note-edit-outline"),
                                    {"type": "custom:greport-card", "grid_options": {"columns": "full"}}]))
    if "felder" in parts or ("karte" in parts and not card):
        rows = [{"entity": e("notiz"), "name": T("Notiz", "Note")}] if e("notiz") else []
        for g, slug in GROUP_SLUG.items():
            if e(slug):
                rows.append({"entity": e(slug), "name": (GROUP_DE if de else GROUP_EN)[g]})
        if e("zeuge"):
            rows.append({"entity": e("zeuge"), "name": T("Zeuge", "Witness")})
        secs.append(hadash.section([hadash.heading(T("Notiz erfassen", "Add a note"), "mdi:note-edit-outline"),
                                    rows and {"type": "entities", "entities": rows, "grid_options": {"columns": "full"}},
                                    e("speichern") and hadash.press(e("speichern"), T("Notiz speichern", "Save note"), "mdi:content-save")]))
    if "letzte" in parts and e("letzte_notiz"):
        eid = e("letzte_notiz")
        md = ("{% set n = state_attr('" + eid + "', 'notizen') or [] %}"
              "{% for x in n %}- **{{ x.datum }} {{ x.zeit }}** {{ x.text" + MD_ESC + " }}{% if x.zeuge %} · 👤 {{ x.zeuge" + MD_ESC + " }}{% endif %}\n"
              "{% else %}" + T("Noch keine Notizen.", "No notes yet.") + "{% endfor %}")
        secs.append(hadash.section([hadash.heading(T("Letzte Notizen", "Latest notes"), "mdi:history"),
                                    {"type": "markdown", "content": md, "grid_options": {"columns": "full"}}]))
    if "heute" in parts:
        secs.append(hadash.section([hadash.heading(T("Heute", "Today"), "mdi:calendar-today"),
                                    e("notizen_heute") and hadash.tile(e("notizen_heute"), T("Notizen heute", "Notes today")),
                                    e("letzte_notiz") and hadash.tile(e("letzte_notiz"), T("Letzte Notiz", "Last note"))]))
    if "oeffnen" in parts:
        secs.append(hadash.section([hadash.heading(BRAND, "mdi:open-in-app"),
                                    hadash.open_button(T("GReport öffnen", "Open GReport"), hadash.self_slug("local_greport"), "mdi:note-edit-outline")]))
    return hadash.board(d["title"], secs)


def hadash_card_ready():
    """Ist die GReport-Karte als Dashboard-Ressource eingetragen? (nur lesen)"""
    try:
        res = hadash.call({"type": "lovelace/resources"})[0] or []
        return any(str(r.get("url", "")).split("?")[0] == CARD_URL for r in res)
    except Exception:
        return False


def hadash_state(data=None):
    d = hadash_clean(data or {})
    out = {"ok": True, "available": hadash.available(), "prefs": {k: d[k] for k in ("title", "url", "sidebar", "admin", "parts")},
           "parts": list(HADASH_PARTS), "valid_url": hadash.valid_url(d["url"])}
    ents, card = {}, True
    if out["available"]:
        try:
            ents = hadash.entity_map(HAID)
            out["exists"] = bool(hadash.find(d["url"]))
            card = hadash_card_ready()
        except Exception as e:
            out["error"] = str(e)[:200]
    out["n_entities"] = len(ents)
    out["card"] = card
    out["yaml"] = hadash.to_yaml(hadash_config(d, ents or hadash_guess(), card))
    return out


def hadash_apply(data):
    d = hadash_clean(data or {})
    if not hadash.valid_url(d["url"]):
        return {"ok": False, "error": "bad_url"}
    try:
        os.makedirs(PRIV, exist_ok=True)
        with open(hadash_file() + ".tmp", "w", encoding="utf-8") as f:
            json.dump({k: d[k] for k in ("title", "url", "sidebar", "admin", "parts")}, f)
        os.replace(hadash_file() + ".tmp", hadash_file())
    except OSError:
        pass
    try:
        ents = hadash.entity_map(HAID)
        if not ents:
            return {"ok": False, "error": "no_entities"}
        r = hadash.install(d["url"], d["title"], "mdi:note-edit-outline", hadash_config(d, ents, hadash_card_ready()),
                           d["sidebar"], d["admin"], bool(data.get("overwrite")))
        if r.get("ok"):
            log("Dashboard in Home Assistant", "angelegt:" if r.get("created") else "ersetzt:", "/" + d["url"])
        return r
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


def main():
    if not lock_dir():
        log("Datenordner wird schon von einem anderen GReport benutzt:", DIR)
        sys.exit(1)
    log(f"{BRAND} {VERSION} – Daten in {DIR}")
    notes_all(); qt_all(); fb_all()
    mqtt_start()
    threading.Thread(target=card_install, daemon=True).start()
    threading.Thread(target=bg_loop, daemon=True).start()
    try:
        srv = Srv(("::", PORT), H)
    except OSError:
        Srv.address_family = __import__("socket").AF_INET
        srv = Srv(("0.0.0.0", PORT), H)
    srv.serve_forever()


if __name__ == "__main__":
    main()
