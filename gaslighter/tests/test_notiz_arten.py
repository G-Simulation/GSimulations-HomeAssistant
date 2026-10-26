"""ab 1.85.52: Notiz-Arten in GLighter – Vorlage „Erinnerung“, Arten aus GReport (verbunden) dazu, Notiz mit Art ohne Zeitpunkt."""
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
        json.dump({"kinds": [{"id": "k_0000a1", "l": "Termin", "col": "#1c7ed6", "ico": "📅"}, {"id": "k_000001", "l": "Reminder (GR)"}]}, open(os.path.join(self.gr, "felder.json"), "w"))

    def tearDown(self):
        laerm.paths, laerm.GR_DIR = self.keep[0], self.keep[1]
        laerm.LAYOUT.update(self.keep[2]); laerm.NOTES.update(self.keep[3])

    def test_vorlage_und_greport(self):
        with mock.patch.object(laerm, "gr_status", return_value={"linked": False}):
            ks = laerm.all_kinds()
        self.assertEqual([(k["id"], k["l"], k.get("notime")) for k in ks], [("k_000001", "Erinnerung", True)])   # Vorlage, nichts aus GReport
        with mock.patch.object(laerm, "gr_status", return_value={"linked": True}):
            ks = laerm.all_kinds()
        self.assertEqual([(k["id"], k["l"], bool(k.get("gr"))) for k in ks], [("k_000001", "Erinnerung", False), ("k_0000a1", "Termin", True)])   # gleiche Kennung: eigene gewinnt

    def test_notiz_mit_art_ohne_zeitpunkt(self):
        with mock.patch.object(laerm, "gr_status", return_value={"linked": True}):
            r = laerm.fnote_change("add", {"text": "Brief", "kind": "k_000001", "src": "all"})
            self.assertTrue(r["ok"]); n = r["note"]
            self.assertTrue(n["notime"]); self.assertTrue(n["noassign"]); self.assertEqual(n["kind_l"], "Erinnerung"); self.assertEqual(n["kind_i"], "⏰")
            r2 = laerm.fnote_change("add", {"text": "Arzt", "kind": "k_0000a1", "src": "all", "from": "2026-10-26T10:00:00"})
            self.assertTrue(r2["ok"]); self.assertFalse(r2["note"].get("notime")); self.assertEqual(r2["note"]["kind_l"], "Termin")
            r3 = laerm.fnote_change("add", {"text": "x", "kind": "k_fffff0", "src": "all", "from": "2026-10-26T10:00:00"})
            self.assertTrue(r3["ok"]); self.assertNotIn("kind", r3["note"])                     # unbekannte Art: ohne Art gespeichert


if __name__ == "__main__":
    unittest.main()
