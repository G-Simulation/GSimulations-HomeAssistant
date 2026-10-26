"""Regressionstests für die Datenpfade (ohne Mikrofon, ohne Home Assistant).
Aufruf:  python3 -m unittest discover -s tests -v     (aus dem Ordner gaslighter/)
Jeder Test legt seine Dateien in einem eigenen Wegwerf-Ordner an."""
import csv, datetime as dt, gzip, hashlib, json, os, shutil, sys, tempfile, time, unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
import numpy as np                                    # noqa: E402
import laerm                                          # noqa: E402

DAY = "2026-10-14"
SID = "mic"
T0 = int(dt.datetime(2026, 10, 14, 5, 0, 0).timestamp() * 1000)


def minute_line(i):
    return json.dumps({"m": T0 + i * 60000, "r": [[0, 1, 2, 3, 4, 0]]}, separators=(",", ":"))


def build_day(tmp, n=8, tear_block=None, tear_link=None):
    """Tagesdatei + Kette wie im Betrieb; optional ein Block bzw. eine Summe halb geschrieben (Stromausfall)."""
    laerm.day_dir = lambda: tmp
    prev = laerm.chain_seed(SID, DAY); blocks, links = [], []
    for i in range(n):
        line = minute_line(i)
        h = hashlib.sha256(prev.encode() + line.encode() + b"").hexdigest(); prev = h
        blocks.append(gzip.compress((line + "\n").encode())); links.append(f"{T0 + i * 60000} {h}")
    if tear_block is not None:
        blocks[tear_block] = blocks[tear_block][:15]
    if tear_link is not None:
        links[tear_link] = links[tear_link][:40]
    with open(laerm.day_path(SID, DAY), "wb") as f:
        f.write(b"".join(blocks))
    with open(laerm.chain_file(SID, DAY), "w") as f:
        f.write("\n".join(links) + ("" if tear_link == n - 1 else "\n"))
    return laerm.chain_file(SID, DAY)


class Stromausfall(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def test_gz_bytes_ueberspringt_halben_block(self):
        build_day(self.tmp, tear_block=3)
        lines, bad = laerm.gz_lines(laerm.day_path(SID, DAY))
        self.assertEqual(len(lines), 7)
        self.assertEqual(bad, 1)

    def test_gz_bytes_intakt(self):
        build_day(self.tmp)
        lines, bad = laerm.gz_lines(laerm.day_path(SID, DAY))
        self.assertEqual((len(lines), bad), (8, 0))

    def test_kette_intakt(self):
        build_day(self.tmp)
        c = laerm.chain_check_full(SID, DAY)
        self.assertTrue(c["ok"]); self.assertEqual(c["n"], 8)

    def test_kette_halber_block_meldet_nur_diese_minute(self):
        build_day(self.tmp, tear_block=3)
        c = laerm.chain_check_full(SID, DAY)
        self.assertFalse(c["ok"]); self.assertTrue(c.get("missing"))
        self.assertEqual(c["miss_list"], [T0 + 3 * 60000])
        self.assertEqual(c["n"], 7)                    # der Rest des Tages bleibt geprueft

    def test_kette_abgeschnittene_summe_ist_kein_fehler(self):
        build_day(self.tmp, tear_link=7)               # letzte Summe halb geschrieben, Block vorhanden
        c = laerm.chain_check_full(SID, DAY)
        self.assertTrue(c["ok"], c)

    def test_kette_veraenderter_wert_wird_erkannt(self):
        build_day(self.tmp)
        lines = [minute_line(i) for i in range(8)]
        lines[4] = lines[4].replace("[0,1,2,3,4,0]", "[0,9,9,9,9,0]")      # nachtraeglich veraendert
        with open(laerm.day_path(SID, DAY), "wb") as f:
            f.write(b"".join(gzip.compress((l + "\n").encode()) for l in lines))
        c = laerm.chain_check_full(SID, DAY)
        self.assertFalse(c["ok"]); self.assertEqual(c["bad"], T0 + 4 * 60000)
        self.assertFalse(c.get("missing"))

    def test_kette_anhaengen_nach_abgeschnittener_zeile(self):
        cf = build_day(self.tmp, tear_link=7)
        laerm.CHAIN.clear()
        laerm.chain_add(SID, DAY, T0 + 8 * 60000, minute_line(8), [])
        txt = open(cf).read().splitlines()
        self.assertEqual(len(txt), 9)                  # abgeschnittene Zeile bleibt eigene Zeile, neue Summe steht sauber dahinter
        self.assertTrue(laerm.HEX64.fullmatch(txt[-1].split()[1]))
        self.assertEqual(txt[-1].split()[0], str(T0 + 8 * 60000))

    def test_feste_saetze_nach_halbem_satz_werden_ausgerichtet(self):
        rl = 8 + 4
        lo, hi = T0 - 1000, T0 + 10 ** 9
        rec = lambda t: int(t).to_bytes(8, "little") + bytes([7, 7, 7, 7])
        raw = rec(T0) + rec(T0 + 1) + rec(T0 + 2)[:5] + rec(T0 + 3) + rec(T0 + 4)     # Strom weg im dritten Satz, danach weitergeschrieben
        out, skipped = laerm.realign_records(raw, rl, lo, hi)
        ts = [int.from_bytes(out[i:i + 8], "little") for i in range(0, len(out), rl)]
        self.assertEqual(ts, [T0, T0 + 1, T0 + 3, T0 + 4])
        self.assertGreater(skipped, 0)

    def test_auffuellen_haelt_ausrichtung(self):
        p = os.path.join(self.tmp, "x.ltp"); rl = 12
        with open(p, "wb") as f:
            f.write(b"a" * 25)
        laerm._PADDED.discard(p)
        laerm.pad_tail(p, rl)
        self.assertEqual(os.path.getsize(p) % rl, 0)


class HomeAssistant(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.f = os.path.join(self.tmp, "ha_zustand.csv")
        laerm.ha_hist_path = lambda: self.f
        laerm.DATA_DIR = self.tmp
        self.now = int(time.time() * 1000)
        self.iso = lambda ms: dt.datetime.fromtimestamp(ms / 1000).astimezone().isoformat(timespec="milliseconds")
        self.rule = {"id": "r1", "entity": "binary_sensor.x", "src": "all", "label": "Heiz", "states": ["on"], "mode": "event", "enabled": True, "color": ""}
        laerm.rule_match = lambda st, v: v == "on"
        laerm.ha_note_all = lambda: {}
        laerm.HA_RULES[:] = [self.rule]
        laerm.HA_HIST.update(key=None, rows=[])
        laerm.RUN_DOWNS.update(key=None, v=[])

    def write_rows(self, rows):
        with open(self.f, "w", newline="") as fh:
            w = csv.writer(fh); w.writerow(["zeit", "regel", "name", "entitaet", "zustand", "an", "geraet"])
            for t, on in rows:
                w.writerow([self.iso(t), "r1", "Heiz", "binary_sensor.x", "on" if on else "off", 1 if on else 0, "all"])

    def test_abgleich_holt_verpasstes_aus_nach(self):
        a = self.now - 5 * 3600000
        self.write_rows([(a, True)])                    # „Frei“ wurde nie mitgeschrieben
        laerm.ha_get = lambda *x, **k: [[{"entity_id": "binary_sensor.x", "state": "off", "last_changed": self.iso(self.now - 20 * 3600000)},
                                          {"state": "on", "last_changed": self.iso(a)}, {"state": "off", "last_changed": self.iso(a + 6000)}]]
        self.assertEqual(laerm.ha_heal([self.rule], self.now), 1)
        rows = list(csv.DictReader(open(self.f)))
        self.assertEqual([r["an"] for r in rows], ["1", "0"])
        self.assertEqual(laerm.ha_heal([self.rule], self.now), 0)       # zweiter Lauf: nichts mehr zu tun
        self.assertTrue(os.path.exists(self.f + ".bak"))

    def test_schon_laufender_zustand_bleibt(self):
        """ab 1.85.49: „zu Hause“ seit gestern – Home Assistant meldet den Anfangszustand mit der Fensterzeit; der eigene Beginn bleibt stehen."""
        since = self.now - 24 * 3600000; mine = self.now - 6 * 3600000
        self.write_rows([(mine, True)])                 # vom Historie-Abgleich beim Anlegen der Regel
        laerm.ha_get = lambda *x, **k: [[{"entity_id": "binary_sensor.x", "state": "on", "last_changed": self.iso(since)}]]
        self.assertEqual(laerm.ha_heal([self.rule], self.now), 0)       # passt: nichts löschen, nichts verschieben
        rows = list(csv.DictReader(open(self.f)))
        self.assertEqual([r["an"] for r in rows], ["1"])
        self.write_rows([])                                             # noch nichts festgehalten: Beginn = Fensteranfang
        self.assertEqual(laerm.ha_heal([self.rule], self.now), 1)
        rows = list(csv.DictReader(open(self.f)))
        self.assertEqual([r["an"] for r in rows], ["1"])
        self.assertAlmostEqual(laerm.ms_of(rows[0]["zeit"]) / 1000, since / 1000, delta=2)

    def test_intervall_endet_an_luecke(self):
        a = self.now - 5 * 3600000
        self.write_rows([(a, True), (a + 4 * 3600000, False)])         # „Aus“ kam erst nach dem Neustart
        d0 = a + 3600000
        with open(os.path.join(self.tmp, "laufzeit.jsonl"), "w") as fh:
            fh.write(json.dumps({"kind": "down", "from": self.iso(d0), "to": self.iso(d0 + 3000000)}) + "\n")
        out = laerm.ha_intervals("*", a - 1000, self.now)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0][1], int(laerm.ms_of(self.iso(d0))))     # endet am Beginn der Luecke, nicht erst beim spaeteren „Aus“

    def test_intervall_ohne_luecke_bleibt(self):
        a = self.now - 5 * 3600000
        self.write_rows([(a, True), (a + 6000, False)])
        out = laerm.ha_intervals("*", a - 1000, self.now)
        self.assertEqual(out[0][1] - out[0][0], 6000)


class Meldungen(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        laerm.DATA_DIR = self.tmp; laerm.day_dir = lambda: os.path.join(self.tmp, "tag")
        laerm.data_gaps = lambda *a, **k: []
        laerm.RUN_DOWNS.update(key=None, v=[])
        ev = [{"kind": "down", "from": "2026-10-14T05:38:19+02:00", "to": "2026-10-14T09:21:43+02:00", "version_new": "1.51.6"},
              {"kind": "update", "at": "2026-10-14T11:00:00+02:00", "version_old": "1", "version_new": "2"}]
        with open(os.path.join(self.tmp, "laufzeit.jsonl"), "w") as f:
            f.write("\n".join(json.dumps(e) for e in ev) + "\n")
        self.rng = (laerm.ms_of("2026-10-14T00:00:00+02:00"), laerm.ms_of("2026-10-14T23:00:00+02:00"))

    def events(self):
        return {e["kind"]: e for e in laerm.runtime_info(*self.rng)["events"]}

    def test_update_gilt_als_gelesen_stromausfall_ist_offen(self):
        e = self.events()
        self.assertTrue(e["update"]["ack"]); self.assertEqual(e["update"]["ack_by"], "auto")
        self.assertFalse(e["down"]["ack"])

    def test_bestaetigen_und_wieder_oeffnen(self):
        k = self.events()["down"]["key"]
        self.assertTrue(laerm.run_ack_set([k], True)["ok"])
        self.assertTrue(self.events()["down"]["ack"])
        laerm.run_ack_set([k], False)
        self.assertFalse(self.events()["down"]["ack"])

    def test_kette_halbe_minute_beim_stromausfall_ist_kein_fehler(self):
        os.makedirs(laerm.day_dir(), exist_ok=True)
        t0 = laerm.ms_of("2026-10-14T05:30:00+02:00")
        prev = laerm.chain_seed(SID, DAY); blocks, links = [], []
        for i in range(10):
            line = json.dumps({"m": t0 + i * 60000, "r": [[0, 1, 2, 3, 4, 0]]}, separators=(",", ":"))
            h = hashlib.sha256(prev.encode() + line.encode() + b"").hexdigest(); prev = h
            blocks.append(gzip.compress((line + "\n").encode())); links.append(f"{t0 + i * 60000} {h}")
        blocks[7] = blocks[7][:15]                      # Minute 05:37, danach 05:38:19 Strom weg
        open(laerm.day_path(SID, DAY), "wb").write(b"".join(blocks))
        open(laerm.chain_file(SID, DAY), "w").write("\n".join(links) + "\n")
        c = [x for x in laerm.runtime_info(*self.rng)["chains"] if x["day"] == DAY][0]
        self.assertTrue(c["ok"], c); self.assertEqual(c.get("explained"), 1)


class NotizAusHA(unittest.TestCase):
    """Textfeld/Knopf im Home-Assistant-Dashboard legen eine freie Notiz an."""
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        laerm.paths = lambda: (self.tmp, self.tmp)
        laerm.NOTES["data"] = None
        laerm.fnote_target = lambda *a, **k: None
        laerm.pub = lambda *a, **k: None
        laerm.HA_NOTE_LAST[:] = [0.0, ""]

    def notizen(self):
        return laerm.notes_all().get("free", [])

    def test_text_wird_notiz(self):
        laerm.ha_note_cmd("Klopfen von oben")
        n = self.notizen()
        self.assertEqual(len(n), 1); self.assertEqual(n[0]["text"], "Klopfen von oben")

    def test_knopf_ohne_text_markiert_stoerung(self):
        laerm.ha_note_cmd("")
        self.assertIn("Störung", self.notizen()[0]["text"])

    def test_doppelt_gesendet_zaehlt_einmal(self):
        laerm.ha_note_cmd("x"); laerm.ha_note_cmd("x")
        self.assertEqual(len(self.notizen()), 1)

    def test_unknown_wird_ignoriert(self):
        laerm.ha_note_cmd("unknown")
        self.assertEqual(len(self.notizen()), 0)


class OrdnerSperre(unittest.TestCase):
    """Normaler GLighter und Beta nie gleichzeitig im selben Datenordner."""
    def setUp(self):
        self.p = os.path.join(tempfile.mkdtemp(), ".gaslighter_lock.json")

    def test_fremde_frische_sperre_blockiert(self):
        json.dump({"id": "anderer", "app": "GLighter", "beat": time.time()}, open(self.p, "w"))
        self.assertEqual(laerm.lock_other(self.p)["app"], "GLighter")

    def test_alte_sperre_ist_frei(self):
        json.dump({"id": "anderer", "app": "GLighter", "beat": time.time() - 120}, open(self.p, "w"))
        self.assertIsNone(laerm.lock_other(self.p))

    def test_aeltere_version_ohne_sperre(self):
        d = tempfile.mkdtemp(); keep = laerm.day_dir; laerm.day_dir = lambda: d
        try:
            open(os.path.join(d, "2026-10-15_main" + laerm.DAY_EXT), "wb").write(b"x")    # gerade geschrieben, aber keine Sperre
            self.assertIn("ältere Version", laerm.lock_other(self.p)["app"])
            json.dump({"id": "anderer", "app": "GLighter", "released": time.time() + 10}, open(self.p, "w"))
            self.assertIsNone(laerm.lock_other(self.p))                                 # sauber beendet: frei
        finally:
            laerm.day_dir = keep

    def test_eigene_sperre(self):
        laerm.lock_write(self.p)
        self.assertIsNone(laerm.lock_other(self.p))
        self.assertEqual(laerm.lock_read(self.p)["id"], laerm.LOCK["id"])


class VorlaufSprachassistent(unittest.TestCase):
    """„Hey Jarvis“: Störung beginnt kurz BEVOR der Assistent auf „hört zu“ wechselt – mit Vorlauf zählt sie nicht."""
    def setUp(self):
        laerm.HA_RULES[:] = laerm.clean_rules([{"id": "j1", "entity": "assist_satellite.wohnzimmer", "states": "!idle", "mode": "quiet", "pre_s": 3, "after_min": 0.5}])
        laerm.HA_STATE.clear()

    def test_vorlauf_nur_bei_keine_stoerung(self):
        self.assertEqual(laerm.HA_RULES[0]["pre_s"], 3.0)
        r = laerm.clean_rules([{"id": "p", "entity": "binary_sensor.x", "mode": "pause", "pre_s": 5}])
        self.assertEqual(r[0]["pre_s"], 0.0)
        self.assertEqual(laerm.quiet_pre("main"), 3.0)

    def test_kurz_davor_zaehlt_nicht(self):
        on = 1000.0
        laerm.HA_STATE["j1"] = {"hold": False, "active": False, "ons": [on], "name": "Jarvis"}
        self.assertIsNotNone(laerm.quiet_covers("main", on - 1.2))      # „Hey Jarvis“ 1,2 s vorher
        self.assertIsNone(laerm.quiet_covers("main", on - 10))           # lange davor: echte Störung
        self.assertIsNone(laerm.quiet_covers("main", on + 30))           # lange danach (Regel aus): echte Störung

    def test_ohne_vorlauf_nichts(self):
        laerm.HA_RULES[0]["pre_s"] = 0.0
        laerm.HA_STATE["j1"] = {"hold": True, "active": True, "ons": [1000.0], "since": 1000.0}
        self.assertIsNone(laerm.quiet_covers("main", 999.0))


class IpWebcamSensoren(unittest.TestCase):
    """IP Webcam: sensors.json wird gelesen; Erschütterung, Neigung und Bewegung im Bild lösen den Melder aus."""
    def setUp(self):
        import io, threading
        class R:
            id = "ipc"; name = "Handy IP"; topic = "gaslighter/ipc"
            src = {"type": "url", "url": "http://192.168.1.50:8080/audio.wav", "motion_vib": True, "motion_tilt": True, "motion_cam": True}
        self.r = R(); self.t = 1000; self.feed = []; self.keep = (laerm.urllib.request.urlopen, laerm.pub, laerm.log)
        laerm.pub = lambda *a, **k: None; laerm.log = lambda *a, **k: None
        def fake(req, timeout=None):
            self.urls.append(req.full_url)
            return io.BytesIO(json.dumps(self.payload).encode())
        self.urls = []; laerm.urllib.request.urlopen = fake

    def tearDown(self):
        laerm.urllib.request.urlopen, laerm.pub, laerm.log = self.keep

    def send(self, vecs, mot=0):
        rows = []
        for v in vecs:
            self.t += 50; rows.append([self.t, list(v)])
        self.payload = {"accel": {"unit": "m/s²", "data": rows}, "motion_active": {"data": [[self.t, [float(mot)]]]}}
        if hasattr(self.r, "_ipc"): self.r._ipc["next"] = 0
        laerm.ipcam_poll(self.r)

    def test_adresse_und_ruhe(self):
        self.send([(0, 0, 9.81)] * 80)
        self.assertTrue(self.urls[0].startswith("http://192.168.1.50:8080/sensors.json?"))
        self.assertFalse(any(st["on"] for st in self.r.motion.values()))

    def test_erschuetterung_neigung_bewegung(self):
        self.send([(0, 0, 9.81)] * 80)
        self.send([(0, 0, 9.81), (2.0, 1.0, 12.0), (0, 0, 9.81)])          # Stoß
        self.assertTrue(self.r.motion["vib"]["on"])
        self.send([(0, 6.9, 6.9)] * 120)                                   # um 45° gekippt
        self.assertTrue(self.r.motion["tilt"]["on"]); self.assertGreater(self.r.motion["tilt"]["peak"], 20)
        self.send([(0, 6.9, 6.9)], mot=1)
        self.assertTrue(self.r.motion["cam"]["on"])

    def test_rtsp_nimmt_port_8080(self):
        self.assertEqual(laerm.ipcam_base({"url": "rtsp://10.0.0.7:8554/h264"}), "http://10.0.0.7:8080")


class SchwelleAutomatisch(unittest.TestCase):
    """Vorschlag für die Schwelle aus gespeicherten Pegeln: Störungen zählen nicht mit, gestörte Messung wird erkannt."""
    def setUp(self):
        self.tmp = tempfile.mkdtemp(); self.keep = (laerm.day_dir, dict(laerm.RUNNERS))
        laerm.day_dir = lambda: self.tmp
        class R:                                            # Gerät ohne laufende Aufnahme
            id = "mic"; name = "Testmikro"; spur = []
            import threading as _t; rlock = _t.Lock()
        laerm.RUNNERS.clear(); laerm.RUNNERS["mic"] = R()
        laerm.DAY_CACHE.clear()

    def tearDown(self):
        laerm.day_dir = self.keep[0]; laerm.RUNNERS.clear(); laerm.RUNNERS.update(self.keep[1]); laerm.DAY_CACHE.clear()

    def write(self, t0, minutes, level, act_every=0, loud_every=0):
        rng = np.random.default_rng(1); blocks = []
        for m in range(minutes):
            rows = []
            for k in range(480):
                eq = level + rng.normal(0, 1.5); a = 0
                if act_every and (m * 480 + k) % act_every == 0:
                    eq, a = level + 30, 1
                if loud_every and (m * 480 + k) % loud_every < 40:
                    eq = level + 25
                rows.append([k * 125, int(eq * 10) + 5, int(eq * 10), int(level * 10), int((level + 10) * 10), a])
            blocks.append(gzip.compress((json.dumps({"m": t0 + m * 60000, "r": rows}) + "\n").encode()))
        day = dt.datetime.fromtimestamp(t0 / 1000).date().isoformat()
        with open(laerm.day_path("mic", day), "ab") as f:
            f.write(b"".join(blocks))

    def test_jetzt_messen(self):
        t0 = int(time.time() * 1000) - 120000; t0 -= t0 % 60000
        self.write(t0, 2, -62.0)
        j = laerm.thr_suggest("mic", "now", t0, t0 + 120000)
        self.assertTrue(j["ok"], j); self.assertFalse(j["disturbed"])
        self.assertAlmostEqual(j["p50"], -62.0, delta=1.0)
        self.assertTrue(6 <= j["sugg"]["offset_db"] <= 20); self.assertLess(j["sugg"]["min_db"], -55)

    def test_gestoerte_messung(self):
        t0 = int(time.time() * 1000) - 120000; t0 -= t0 % 60000
        self.write(t0, 2, -62.0, loud_every=400)          # 10 % der Zeit deutlich lauter (Reden)
        j = laerm.thr_suggest("mic", "now", t0, t0 + 120000)
        self.assertTrue(j["ok"]); self.assertTrue(j["disturbed"])

    def test_letzte_nacht_ohne_stoerungen(self):
        laerm.CFG.update(quiet_from="01:00", quiet_to="02:00")
        now = dt.datetime.now(); end = now.replace(hour=2, minute=0, second=0, microsecond=0)
        if end > now: end -= dt.timedelta(days=1)
        t0 = int((end - dt.timedelta(hours=1)).timestamp() * 1000)
        self.write(t0, 60, -58.0, act_every=97)            # einzelne Störungen dazwischen
        j = laerm.thr_suggest("mic", "night")
        self.assertTrue(j["ok"], j); self.assertGreater(j["events"], 0)
        self.assertLess(j["p95"], -50)                     # Störungen (+30 dB) ziehen den Vorschlag nicht hoch

    def test_ohne_daten(self):
        j = laerm.thr_suggest("mic", "now", int(time.time() * 1000) - 60000, int(time.time() * 1000))
        self.assertFalse(j["ok"]); self.assertEqual(j["error"], "nodata")


class SicherungsZiel(unittest.TestCase):
    """Tägliche Sicherung: inkrementell, nichts geht verloren, Auslagern lässt Protokolle weiter lesen."""
    def setUp(self):
        self.tmp = tempfile.mkdtemp(); self.out = os.path.join(self.tmp, "out"); self.dst = os.path.join(self.tmp, "nas")
        os.makedirs(os.path.join(self.out, "clips", "tag")); os.makedirs(self.dst)
        self.f = os.path.join(self.out, "clips", "tag", "mic_2026-01-01.ltd")
        open(self.f, "wb").write(b"alt" * 1000)
        self.keep = (laerm.DATA_DIR, laerm.backup_items, laerm.public_settings, dict(laerm.CFG), laerm.pro_ok)
        laerm.DATA_DIR = self.tmp; laerm.pro_ok = lambda: True
        laerm.backup_items = lambda: [("clips/tag/mic_2026-01-01.ltd", self.f)]
        laerm.public_settings = lambda: {"x": 1}
        laerm.CFG.update(output_dir=self.out, mirror_dir=self.dst, mirror_offload=False, retention_days=30)
        os.environ["LAERM_MIRROR_SAMEDEV"] = "1"

    def tearDown(self):
        laerm.DATA_DIR, laerm.backup_items, laerm.public_settings, cfg, laerm.pro_ok = self.keep
        laerm.CFG.clear(); laerm.CFG.update(cfg); os.environ.pop("LAERM_MIRROR_SAMEDEV", None)

    def test_inkrementell_und_alte_fassung(self):
        self.assertTrue(laerm.mirror_run("test")); self.assertEqual(laerm.MIRROR["copied"], 2)
        d = os.path.join(self.dst, "clips", "tag", "mic_2026-01-01.ltd")
        self.assertEqual(open(d, "rb").read(), b"alt" * 1000)
        self.assertTrue(laerm.mirror_run("test")); self.assertEqual(laerm.MIRROR["copied"], 0)   # nichts Neues: nichts kopiert
        old = time.time() - 3 * 86400; os.utime(d, (old, old))
        open(self.f, "wb").write(b"neu")                       # nachträglich geändert: alte Fassung bleibt im Ziel
        self.assertTrue(laerm.mirror_run("test"))
        self.assertEqual(open(d, "rb").read(), b"neu")
        alts = [x for x in os.listdir(os.path.dirname(d)) if ".alt-" in x]
        self.assertEqual(len(alts), 1)

    def test_auslagern_liest_weiter(self):
        old = time.time() - 60 * 86400; os.utime(self.f, (old, old))
        laerm.CFG["mirror_offload"] = True
        self.assertTrue(laerm.mirror_run("test"))
        self.assertTrue(os.path.islink(self.f))
        self.assertEqual(open(self.f, "rb").read(), b"alt" * 1000)   # Protokolle lesen weiter (aus dem Ziel)
        self.assertTrue(laerm.mirror_verified(self.f))
        self.assertTrue(laerm.mirror_run("test"))                   # zweiter Lauf: ausgelagerte Datei bleibt, nichts kaputt
        self.assertTrue(os.path.isfile(os.path.join(self.dst, "clips", "tag", "mic_2026-01-01.ltd")))

    def test_nur_mit_pro(self):
        laerm.pro_ok = lambda: False
        self.assertFalse(laerm.mirror_run("test")); self.assertEqual(laerm.MIRROR["error"], "pro")
        self.assertEqual(os.listdir(self.dst), [])                 # ohne Pro wird nichts kopiert

    def test_ziel_fehlt(self):
        laerm.CFG["mirror_dir"] = os.path.join(self.tmp, "nicht_da")
        self.assertFalse(laerm.mirror_run("test")); self.assertFalse(laerm.MIRROR["ok"])
        self.assertFalse(os.path.exists(os.path.join(self.tmp, "nicht_da")))   # legt nichts auf dem eigenen Speicher an

    def test_gleicher_speicher_abgelehnt(self):
        os.environ.pop("LAERM_MIRROR_SAMEDEV", None)
        self.assertIn("demselben Speicher", laerm.mirror_check_target(self.dst))


class EigeneSchnellwahl(unittest.TestCase):
    """Eigene Schnellwahl-Tasten: anlegen, gelten für Notizen, lernen nur aus getipptem Text, nie von selbst angelegt."""
    def setUp(self):
        self.tmp = tempfile.mkdtemp(); self.keep = (dict(laerm.CFG),)
        laerm.CFG.update(output_dir=self.tmp, clip_dir=""); laerm.QT["data"] = None

    def tearDown(self):
        laerm.CFG.clear(); laerm.CFG.update(self.keep[0]); laerm.QT["data"] = None

    def test_anlegen_und_gueltig(self):
        j = laerm.qt_change({"action": "add", "l": "  Waschmaschine <b> "})
        k = j["k"]
        self.assertTrue(k.startswith("c_")); self.assertEqual(laerm.tag_label(k), "Waschmaschine b")
        self.assertEqual(laerm.clean_tags([k, "klopfen", "erfunden"]), [k, "klopfen"])
        laerm.qt_change({"action": "del", "k": k})
        self.assertEqual(laerm.clean_tags([k]), [])               # neue Notizen nicht mehr
        self.assertTrue(laerm.tag_known(k))                       # alte bleiben lesbar
        self.assertEqual(laerm.tag_label(k), "Waschmaschine b")
        self.assertEqual(laerm.qt_change({"action": "add", "l": "waschmaschine b"})["k"], k)   # gleicher Name: wieder da
        self.assertTrue(os.path.exists(os.path.join(self.tmp, "clips", "schnellwahl.json")))

    def test_lernen_und_vorschlag(self):
        for _ in range(3):
            laerm.qt_learn(["klopfen"], "Die Waschmaschine schleudert wieder und das nervt")
        st = laerm.qt_state()
        self.assertEqual(st["use"]["klopfen"], 3)
        self.assertIn("Waschmaschine", [x["w"] for x in st["suggest"]])
        self.assertNotIn("wieder", [x["k"] for x in st["suggest"]])          # Füllwörter nicht
        self.assertEqual(st["own"], [])                                      # nie von selbst angelegt
        laerm.qt_change({"action": "nope", "w": "waschmaschine"})
        self.assertNotIn("waschmaschine", [x["k"] for x in laerm.qt_state()["suggest"]])

    def test_ausblenden(self):
        laerm.qt_change({"action": "hide", "k": "hund", "on": True})
        self.assertEqual(laerm.qt_state()["hide"], ["hund"])
        self.assertTrue(laerm.tag_ok("hund"))                                # ausgeblendet heißt nicht verboten
        self.assertFalse(laerm.qt_change({"action": "hide", "k": "gibtsnicht", "on": True})["ok"])


class EigeneStatistik(unittest.TestCase):
    """Statistiken: Vorlagen frei, eigene nur mit Pro; Werte richtig aufgeteilt; nur lesen."""
    def setUp(self):
        self.tmp = tempfile.mkdtemp(); self.keep = (dict(laerm.CFG), laerm.pro_ok, laerm.read_log, laerm.sensor_events, laerm.art_fields)
        laerm.CFG.update(output_dir=self.tmp, clip_dir=""); laerm.STAT["data"] = None
        base = dt.datetime(2026, 10, 12, 23, 30)          # Montag
        rows = []
        for i, (h, pk) in enumerate([(0, -20.0), (0.5, -10.0), (12, -30.0), (49, -25.0)]):
            t = base + dt.timedelta(hours=h)
            rows.append({"start": t.isoformat(timespec="seconds"), "dauer_s": "2.0", "spitze_dbfs": str(pk), "hintergrund_dbfs": "-60", "datei": f"c{i}",
                         "schwelle_dbfs": "-40", "clip_s": "", "quelle": "Mic", "quelle_id": "main"})
        laerm.read_log = lambda: rows
        laerm.sensor_events = lambda *a: []
        laerm.art_fields = lambda f: {"art": "knock" if f in ("c0", "c1") else "steps", "prof": "", "bg": False}
        self.a = int(dt.datetime(2026, 10, 12).timestamp() * 1000); self.b = int(dt.datetime(2026, 10, 16).timestamp() * 1000)

    def tearDown(self):
        laerm.CFG.clear(); laerm.CFG.update(self.keep[0]); laerm.pro_ok, laerm.read_log, laerm.sensor_events, laerm.art_fields = self.keep[1:]; laerm.STAT["data"] = None

    def test_aufteilung(self):
        j = laerm.stat_compute({"src": "ev", "metric": "n", "by": "art"}, self.a, self.b)
        self.assertEqual(dict(zip(j["keys"], j["vals"])), {"knock": 2, "steps": 2})
        j = laerm.stat_compute({"src": "ev", "metric": "n", "by": "day"}, self.a, self.b)
        self.assertEqual(j["keys"], ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"]); self.assertEqual(j["vals"], [1, 2, 0, 1])
        j = laerm.stat_compute({"src": "ev", "metric": "n", "by": "hour", "night": True}, self.a, self.b)
        self.assertEqual(j["n"], 3); self.assertEqual((j["vals"][23], j["vals"][0], j["vals"][11]), (1, 2, 0))
        j = laerm.stat_compute({"src": "ev", "metric": "pk_max", "by": "none", "art": "knock"}, self.a, self.b)
        self.assertEqual(j["total"], -10.0)
        self.assertAlmostEqual(laerm.stat_compute({"src": "ev", "metric": "dur", "by": "wd"}, self.a, self.b)["vals"][0], 2.0, delta=0.5)

    def test_pro_und_vorlagen(self):
        laerm.pro_ok = lambda: False
        self.assertFalse(laerm.stat_change({"action": "add", "def": {"src": "ev"}})["ok"])
        j = laerm.stat_change({"action": "add", "tpl": "arts"}); self.assertTrue(j["ok"])
        k = j["id"]; self.assertEqual(laerm.stat_change({"action": "edit", "id": k, "def": {}})["error"], "pro")
        laerm.pro_ok = lambda: True
        self.assertTrue(laerm.stat_change({"action": "edit", "id": k, "def": {"name": "X", "by": "quatsch"}})["ok"])
        self.assertEqual(laerm.stat_list()[0]["by"], "none")
        self.assertTrue(laerm.stat_change({"action": "del", "id": k})["ok"]); self.assertEqual(laerm.stat_list(), [])
        self.assertTrue(os.path.exists(os.path.join(self.tmp, "clips", "statistik.json")))


class NurAufzeichnen(unittest.TestCase):
    def test_schalter(self):
        s = laerm.clean_source({"rec_only": True}, {"id": "main", "type": "local", "name": "M"})
        self.assertTrue(s["rec_only"])
        self.assertFalse(laerm.clean_source({"rec_only": "nein"}, s)["rec_only"])
        self.assertTrue(laerm.clean_source({"name": "X"}, s)["rec_only"])       # andere Änderungen lassen den Schalter stehen


class ArtStumm(unittest.TestCase):
    def test_liste(self):
        laerm.CFG["art_silent"] = laerm.clean_value("art_silent", "animal,knock") if hasattr(laerm, "clean_value") else "animal,knock"
        self.assertEqual(laerm.art_silent_set(), {"animal", "knock"})
        laerm.CFG["art_silent"] = ""
        self.assertEqual(laerm.art_silent_set(), set())


class RegelKeineStoerung(unittest.TestCase):
    """Regel-Art „keine Störung melden“: Graph läuft weiter, es wird nur nichts als Störung erkannt."""
    def setUp(self):
        self.r = laerm.clean_rules([{"id": "q1", "entity": "binary_sensor.tuer", "states": "on", "after_min": 10, "max_h": 1, "mode": "quiet"},
                                    {"id": "p1", "entity": "binary_sensor.fenster", "states": "on", "mode": "pause"}])
        laerm.HA_RULES[:] = self.r
        laerm.HA_STATE.clear()

    def test_modus_bleibt_erhalten(self):
        self.assertEqual([x["mode"] for x in self.r], ["quiet", "pause"])
        self.assertEqual(self.r[0]["after_min"], 10.0)

    def test_hervorheben_nur_echtes_true(self):
        r = laerm.clean_rules([{"id": "a", "entity": "binary_sensor.x", "mode": "event", "big": True},
                               {"id": "b", "entity": "binary_sensor.y", "mode": "event", "big": "ja"}])
        self.assertEqual([x["big"] for x in r], [True, False])

    def test_aktiv_und_nachlauf(self):
        laerm.HA_STATE["q1"] = {"hold": True, "active": True, "state": "on", "name": "Tür"}
        self.assertIsNotNone(laerm.ha_quiet_for("x"))
        self.assertIsNone(laerm.ha_hold_for("x"))               # pausiert die Aufnahme nicht (Graph läuft weiter)
        laerm.HA_STATE["q1"] = {"hold": True, "active": False, "until": time.time() + 300, "state": "off", "name": "Tür"}
        self.assertIsNotNone(laerm.ha_quiet_for("x"))           # Nachlauf (10 min) gilt noch
        laerm.HA_STATE["q1"] = {"hold": True, "active": False, "until": time.time() - 1, "state": "off", "name": "Tür"}
        self.assertIsNone(laerm.ha_quiet_for("x"))              # Nachlauf vorbei

    def test_pausenregel_zaehlt_nicht_als_ruhig(self):
        laerm.HA_STATE["p1"] = {"hold": True, "active": True, "state": "on", "name": "Fenster"}
        self.assertIsNone(laerm.ha_quiet_for("x")); self.assertIsNotNone(laerm.ha_hold_for("x"))

    def test_gerätefilter(self):
        laerm.HA_RULES[0]["src"] = "mic1"
        laerm.HA_STATE["q1"] = {"hold": True, "active": True, "state": "on", "name": "Tür"}
        self.assertIsNone(laerm.ha_quiet_for("mic2")); self.assertIsNotNone(laerm.ha_quiet_for("mic1"))


class RuheKnopf(unittest.TestCase):
    """Knopf/Dauer aus Home Assistant: keine Störung melden für eine einstellbare Zeit."""
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        laerm.SETTINGS_FILE = os.path.join(self.tmp, "settings.json")
        laerm.paths = lambda: (self.tmp, self.tmp)
        laerm.pub = lambda *a, **k: None
        laerm.HA_RULES[:] = []; laerm.HA_STATE.clear()
        laerm.QUIET.update(until=0.0, minutes=10.0)

    def test_standarddauer_zehn_minuten(self):
        self.assertTrue(laerm.quiet_start())
        q = laerm.ha_quiet_for("irgendein_geraet")
        self.assertIsNotNone(q)
        self.assertAlmostEqual(laerm.QUIET["until"] - time.time(), 600, delta=3)

    def test_dauer_einstellbar_und_begrenzt(self):
        laerm.quiet_set_minutes("25"); self.assertEqual(laerm.QUIET["minutes"], 25.0)
        laerm.quiet_set_minutes("9999"); self.assertEqual(laerm.QUIET["minutes"], 240.0)
        laerm.quiet_set_minutes("abc"); self.assertEqual(laerm.QUIET["minutes"], 240.0)
        laerm.quiet_set_minutes("25"); laerm.quiet_start()
        self.assertAlmostEqual(laerm.QUIET["until"] - time.time(), 1500, delta=3)

    def test_stop_und_ablauf(self):
        laerm.quiet_start(5); laerm.quiet_stop()
        self.assertIsNone(laerm.ha_quiet_for("x"))
        laerm.QUIET["until"] = time.time() - 1
        self.assertIsNone(laerm.ha_quiet_for("x"))

    def test_ueberlebt_neustart(self):
        laerm.quiet_set_minutes(15); laerm.quiet_start()
        u = laerm.QUIET["until"]; laerm.QUIET.update(until=0.0, minutes=10.0)
        laerm.quiet_load()
        self.assertEqual(laerm.QUIET["minutes"], 15.0); self.assertAlmostEqual(laerm.QUIET["until"], u, delta=1)

    def test_ungueltige_dauer(self):
        self.assertFalse(laerm.quiet_start("0")); self.assertFalse(laerm.quiet_start("x")); self.assertFalse(laerm.quiet_start("nan"))


if __name__ == "__main__":
    unittest.main()


class RegelSchwelleAnheben(unittest.TestCase):
    """Regel-Art „Schwelle anheben“ (z. B. Fernseher/Sonos ausblenden), mit Lautstärke und Einpegeln."""
    def setUp(self):
        self.r = laerm.clean_rules([{"id": "tv", "entity": "media_player.tv", "states": "on, playing", "mode": "raise", "raise_db": 12, "vol_scale": True, "cal_vol": 40},
                                    {"id": "sx", "entity": "media_player.sonos", "mode": "raise", "raise_db": 99}])
        laerm.HA_RULES[:] = self.r; laerm.HA_STATE.clear()
        self._pro = laerm.pro_ok; laerm.pro_ok = lambda: True

    def tearDown(self):
        laerm.pro_ok = self._pro; laerm.HA_RULES[:] = []; laerm.HA_STATE.clear(); laerm.RAISE_OPEN.clear()

    def test_felder(self):
        self.assertEqual(self.r[0]["mode"], "raise"); self.assertEqual(self.r[0]["raise_db"], 12.0); self.assertTrue(self.r[0]["vol_scale"])
        self.assertEqual(self.r[1]["raise_db"], 40.0)                 # begrenzt
        self.assertNotIn("raise_db", laerm.clean_rules([{"id": "p", "entity": "switch.x", "mode": "pause"}])[0])

    def test_pausiert_nicht_und_hebt_an(self):
        laerm.HA_STATE["tv"] = {"hold": True, "active": True, "vol": 40, "mute": False, "name": "TV"}
        self.assertIsNone(laerm.ha_hold_for("main")); self.assertIsNone(laerm.ha_quiet_for("main"))
        self.assertEqual(laerm.ha_raise_for("main"), (12.0, "TV"))
        laerm.HA_STATE["tv"]["vol"] = 20                              # halb so laut = halbe Anhebung
        self.assertEqual(laerm.ha_raise_for("main")[0], 6.0)
        laerm.HA_STATE["tv"]["mute"] = True
        self.assertIsNone(laerm.ha_raise_for("main"))

    def test_ohne_pro_keine_anhebung(self):
        laerm.HA_STATE["tv"] = {"hold": True, "active": True, "vol": 40}
        laerm.pro_ok = lambda: False
        self.assertIsNone(laerm.ha_raise_for("main"))

    def test_groesste_gilt(self):
        laerm.HA_STATE["tv"] = {"hold": True, "active": True, "vol": 40}
        laerm.HA_STATE["sx"] = {"hold": True, "active": True, "name": "Sonos"}
        self.assertEqual(laerm.ha_raise_for("main"), (40.0, "Sonos"))

    def test_einpegeln(self):
        class R:
            id = "main"; name = "M"
        r = R(); laerm.RUNNERS["zz_test"] = r
        try:
            laerm.HCAL.update(rid="tv", t0=time.time() - 4, srcs=["zz_test"], entity="")
            r.cal = [-40.0] * 300; r.thr_raw = -50.0
            j = laerm.ha_cal({"action": "stop"})
            self.assertTrue(j["ok"]); self.assertAlmostEqual(j["raise_db"], 13.0)       # Pegel -40 + 3 dB Abstand über -50
            laerm.HCAL.update(rid="tv", t0=time.time() - 1, srcs=["zz_test"], entity=""); r.cal = [-40.0] * 300
            self.assertEqual(laerm.ha_cal({"action": "stop"})["error"], "short")
        finally:
            laerm.RUNNERS.pop("zz_test", None)


class GReportEinbinden(unittest.TestCase):
    """GReport installiert: mit Pro erscheinen seine Notizen bei den freien Notizen (nur lesen)."""
    def setUp(self):
        self.d = tempfile.mkdtemp(); self._dir = laerm.GR_DIR; laerm.GR_DIR = self.d; laerm.GR_CACHE["key"] = None
        self._pro = laerm.pro_ok
        json.dump({"app": "GReport", "v": "1.0.0", "t": time.time()}, open(os.path.join(self.d, "greport.json"), "w"))
        json.dump({"own": {"c_abc123": {"l": "Waschmaschine"}}}, open(os.path.join(self.d, "schnellwahl.json"), "w"))
        json.dump({"free": [{"id": "r_1", "from": "2026-10-18T03:00:00+02:00", "to": "", "src": "all", "text": "Bass", "tags": ["klopfen", "c_abc123"], "witness": "Anna"}]},
                  open(os.path.join(self.d, "notizen.json"), "w"))

    def tearDown(self):
        laerm.GR_DIR = self._dir; laerm.pro_ok = self._pro; laerm.GR_CACHE["key"] = None
        shutil.rmtree(self.d, ignore_errors=True)

    def test_nur_mit_pro(self):
        laerm.pro_ok = lambda: False
        self.assertEqual(laerm.gr_notes(), [])
        st = laerm.gr_status(); self.assertTrue(st["found"]); self.assertFalse(st["linked"])

    def test_notizen_erscheinen(self):
        laerm.pro_ok = lambda: True
        n = laerm.gr_notes()
        self.assertEqual(len(n), 1); self.assertEqual(n[0]["tags"], ["klopfen", "g:Waschmaschine"])
        self.assertEqual(laerm.tag_label("g:Waschmaschine"), "Waschmaschine")
        self.assertTrue(laerm.gr_status()["linked"])

    def test_weitergabe_in_greport_aus(self):
        laerm.pro_ok = lambda: True
        json.dump({"app": "GReport", "v": "1.7.1", "t": time.time(), "share": False}, open(os.path.join(self.d, "greport.json"), "w"))
        self.assertEqual(laerm.gr_notes(), [])                             # in GReport abgeschaltet: keine Notizen
        st = laerm.gr_status(); self.assertTrue(st["found"]); self.assertFalse(st["shared"]); self.assertFalse(st["linked"])
        json.dump({"app": "GReport", "v": "1.7.1", "t": time.time(), "share": True}, open(os.path.join(self.d, "greport.json"), "w"))
        self.assertEqual(len(laerm.gr_notes()), 1)                         # wieder an: sofort wieder da
