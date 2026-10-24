"""Lernen aus Notizen (ab 1.85.27): Sensor zuerst, mehrere Arten, ähnliche Störungen im Fenster."""
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
import laerm  # noqa: E402

T0 = 1_790_000_000_000


def iso(ms):
    return laerm.dt.datetime.fromtimestamp(ms / 1000).astimezone().isoformat(timespec="seconds")


class NotizLernen(unittest.TestCase):
    def run_case(self, notes, rows, sensors):
        # rows: [(k, start_ms, peak, klang)] – Klang steckt im Merkmal: gleiche Zahl = gleiches Geräusch
        log = [{"start": iso(a), "spitze_dbfs": str(pk), "datei": "", "k": k + "|0", "_v": v} for k, a, pk, v in rows]
        keys = [r["k"] for r in log]
        by_stem = {}

        def ev_data(r, n):
            by_stem[r["k"]] = r
            return {"core": [0, 500], "_v": r["_v"]}, None, "x"

        def proto(d, ki, a, b):
            return {"band": d, "emb": None, "dur": 0.5}

        def score(p, fb, fe):
            return 1.0 if p["band"] == fb else 0.2

        with mock.patch.object(laerm, "read_log", return_value=log), mock.patch.object(laerm, "row_keys", return_value=keys), \
                mock.patch.object(laerm, "_event_data", side_effect=ev_data), mock.patch.object(laerm, "event_stem", side_effect=lambda r, n=0: r["k"].split("|")[0]), \
                mock.patch.object(laerm.lernen, "decode", side_effect=lambda g: g["_v"]), mock.patch.object(laerm.lernen, "proto_from", side_effect=proto), \
                mock.patch.object(laerm.lernen, "score", side_effect=score), \
                mock.patch.object(laerm, "ha_intervals", return_value=[[a, a + 1000, nm, "r1", "", "note", "", 0] for a, nm in sensors]), \
                mock.patch.object(laerm, "fnotes_in", return_value=notes), mock.patch.object(laerm, "notes_all", return_value={}), \
                mock.patch.object(laerm, "fn_assign", side_effect=lambda ns, rows: {laerm.na_key(n): {"k": n["_k"] + "|0", "cand": [[k + "|0", 0] for k in n["_c"]]} for n in ns}):
            return laerm.nl_examples()

    def test_briefkasten_muell_klopfen(self):
        rows = [("b1", T0, -20, 1), ("m1", T0 + 60000, -15, 2), ("k1", T0 + 120000, -30, 3), ("k2", T0 + 180000, -31, 3),
                ("k3", T0 + 900000, -33, 3), ("m9", T0 + 950000, -10, 2)]
        notes = [{"id": "n1", "a": T0, "b": T0, "tags": ["klopfen"], "text": "", "_k": "m1", "_c": ["m1", "b1", "k1", "k2"]},
                 {"id": "n2", "a": T0 + 900000, "b": T0 + 900000, "tags": [], "text": "wieder Klopfen", "_k": "m9", "_c": ["m9", "k3"]}]
        out = self.run_case(notes, rows, [(T0 + 500, "Erschütterung Briefkasten")])
        lab = {x[0]: x[4] for x in out}
        self.assertEqual(lab.get("s:b1|0"), "Erschütterung Briefkasten")          # Sensor gewinnt
        self.assertNotIn("Klopfen/Hämmern", [x[4] for x in out if x[1] == "b1"])
        kl = sorted(x[1] for x in out if x[4] == "Klopfen/Hämmern")
        self.assertIn("k1", kl); self.assertIn("k2", kl)                       # mehrere Schläge im Fenster
        self.assertIn("k3", kl)                                                # Anker der 2. Notiz passt zu den Beispielen der 1.
        self.assertNotIn("m1", kl); self.assertNotIn("m9", kl)                 # lauter Mülleimer wird kein Klopfen

    def test_notiz_mit_mehreren_arten(self):
        rows = [("k1", T0, -30, 3), ("k2", T0 + 60000, -31, 3), ("m1", T0 + 900000, -10, 2), ("k3", T0 + 960000, -32, 3)]
        notes = [{"id": "n1", "a": T0, "b": T0, "tags": ["klopfen"], "text": "", "_k": "k1", "_c": ["k1", "k2"]},
                 {"id": "n2", "a": T0 + 900000, "b": T0 + 900000, "tags": [], "text": "Briefkasten, Mülleimer, Klopfen", "_k": "m1", "_c": ["m1", "k3"]}]
        out = self.run_case(notes, rows, [])
        got = {x[1]: x[4] for x in out}
        self.assertEqual(got.get("k3"), "Klopfen/Hämmern")                    # passt zu den Klopf-Beispielen
        self.assertNotEqual(got.get("m1"), "Klopfen/Hämmern")                 # Mülleimer ohne eigene Beispiele: nichts

    def test_mehrere_arten(self):
        self.assertEqual(laerm.note_kinds([], "Briefkasten, Mülleimer, Klopfen"), ["klopfen", "muell", "briefkasten"])
        self.assertIsNone(laerm.note_kind([], "Briefkasten, Mülleimer, Klopfen"))
        self.assertEqual(laerm.note_kind([], "Möbelrücken über mir"), "moebel")
        self.assertIsNone(laerm.note_kind([], "kam zurück, geweckt"))


if __name__ == "__main__":
    unittest.main()
