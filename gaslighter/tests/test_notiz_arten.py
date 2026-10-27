"""ab 1.85.52/55: Notiz-Arten in GLighter – allein: Vorlage „Erinnerung“; verbunden: GReports Arten (GReport ist der Speicher); Notiz mit Art ohne Zeitpunkt."""
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
import laerm  # noqa: E402


class NotizArten(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(); out = os.path.join(self.tmp, "out"); os.makedirs(out + "/clips")
        self.gr = os.path.join(self.tmp, "greport"); os.makedirs(self.gr)
        self.keep = (laerm.paths, laerm.GR_DIR, dict(laerm.LAYOUT), dict(laerm.NOTES))
        laerm.paths = lambda: (out, out + "/clips", out + "/log.csv"); laerm.GR_DIR = self.gr
        laerm.LAYOUT["data"] = None; laerm.NOTES["data"] = None; laerm.GRK["key"] = None; laerm.KPUB["t"] = 0.0
        json.dump({"kinds": [{"id": "k_0000a1", "l": "Termin", "col": "#1c7ed6", "ico": "📅"}, {"id": "k_000001", "l": "Reminder (GR)"}]}, open(os.path.join(self.gr, "felder.json"), "w", encoding="utf-8"))

    def tearDown(self):
        laerm.paths, laerm.GR_DIR = self.keep[0], self.keep[1]
        laerm.LAYOUT.update(self.keep[2]); laerm.NOTES.update(self.keep[3])

    def test_vorlage_und_greport(self):
        with mock.patch.object(laerm, "gr_status", return_value={"linked": False}):
            ks = laerm.all_kinds()
        self.assertEqual([(k["id"], k["l"], k.get("notime")) for k in ks], [("k_000001", "Erinnerung", True)])   # Vorlage, nichts aus GReport
        with mock.patch.object(laerm, "gr_status", return_value={"linked": True}):
            ks = laerm.all_kinds()
        self.assertEqual([(k["id"], k["l"]) for k in ks], [("k_0000a1", "Termin"), ("k_000001", "Reminder (GR)")])   # verbunden: GReports Arten, nicht die eigenen

    def test_notiz_mit_art_ohne_zeitpunkt(self):
        with mock.patch.object(laerm, "gr_status", return_value={"linked": True}):
            r = laerm.fnote_change("add", {"text": "Brief", "kind": "k_000001", "src": "all", "from": "2026-10-26T09:00:00"})
            self.assertTrue(r["ok"]); n = r["note"]
            self.assertFalse(n.get("notime")); self.assertEqual(n["kind_l"], "Reminder (GR)")        # verbunden: GReports Art (dort ohne „ohne Zeitpunkt“)
        laerm.KPUB["t"] = 0.0
        with mock.patch.object(laerm, "gr_status", return_value={"linked": False}):
            r = laerm.fnote_change("add", {"text": "Brief", "kind": "k_000001", "src": "all"})
            self.assertTrue(r["ok"]); n = r["note"]
            self.assertTrue(n["notime"]); self.assertTrue(n["noassign"]); self.assertEqual(n["kind_l"], "Erinnerung"); self.assertEqual(n["kind_i"], "⏰")
        with mock.patch.object(laerm, "gr_status", return_value={"linked": True}):
            laerm.KPUB["t"] = 0.0
            r2 = laerm.fnote_change("add", {"text": "Arzt", "kind": "k_0000a1", "src": "all", "from": "2026-10-26T10:00:00"})
            self.assertTrue(r2["ok"]); self.assertFalse(r2["note"].get("notime")); self.assertEqual(r2["note"]["kind_l"], "Termin")
            r3 = laerm.fnote_change("add", {"text": "x", "kind": "k_fffff0", "src": "all", "from": "2026-10-26T10:00:00"})
            self.assertTrue(r3["ok"]); self.assertNotIn("kind", r3["note"])                     # unbekannte Art: ohne Art gespeichert

    def test_verbunden_schreibt_in_greport(self):
        with mock.patch.object(laerm, "gr_status", return_value={"linked": True}):
            laerm.layout_change({"cap": {"kinds": [{"id": "k_0000a1", "l": "Arzttermin", "col": "#1c7ed6", "ico": "📅"}], "kind_def": "k_0000a1", "kind_keep": False}})
            g = json.load(open(os.path.join(self.gr, "felder.json"), encoding="utf-8"))
            self.assertEqual([(k["id"], k["l"]) for k in g["kinds"]], [("k_0000a1", "Arzttermin"), ("k_000001", "Reminder (GR)")]); self.assertEqual(g["kind_def"], "k_0000a1")   # umbenannt; nicht mitgeschickte Arten bleiben (löschen nur mit del)
            laerm.KPUB["t"] = 0.0
            self.assertEqual([k["l"] for k in laerm.all_kinds()], ["Arzttermin", "Reminder (GR)"])
        self.assertNotIn("kinds", laerm.layout_all().get("cap") or {})          # eigene Konfiguration unberührt

    def test_erstes_verbinden_vorbelegen(self):
        os.remove(os.path.join(self.gr, "felder.json"))
        with mock.patch.object(laerm, "gr_status", return_value={"linked": True}):
            self.assertTrue(laerm.gr_fb_seed())
            g = json.load(open(os.path.join(self.gr, "felder.json"), encoding="utf-8"))
            self.assertEqual(g["tpl"], "laerm"); self.assertEqual([k["l"] for k in g["kinds"]], ["Erinnerung"])
            self.assertFalse(laerm.gr_fb_seed())                                 # schon da: nichts überschreiben


if __name__ == "__main__":
    unittest.main()
