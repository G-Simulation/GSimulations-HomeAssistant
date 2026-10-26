"""ab 1.85.46: Tastenbelegung mit GReport abgleichen – wer zuletzt geändert hat, gewinnt; Zähler bleiben je App."""
import json
import os
import sys
import tempfile
import time
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
import laerm  # noqa: E402


class TastenAbgleich(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(); out = os.path.join(self.tmp, "out"); os.makedirs(out + "/clips")
        self.gr = os.path.join(self.tmp, "greport"); os.makedirs(self.gr)
        self.keep = (laerm.paths, laerm.GR_DIR, laerm.QT["data"])
        laerm.paths = lambda: (out, out + "/clips", out + "/log.csv"); laerm.GR_DIR = self.gr; laerm.QT["data"] = None; laerm.QT_SYNC["last"] = 0.0

    def tearDown(self):
        laerm.paths, laerm.GR_DIR, laerm.QT["data"] = self.keep

    def gr_write(self, d):
        with open(os.path.join(self.gr, "schnellwahl.json"), "w", encoding="utf-8") as f:
            json.dump(d, f)
        laerm.QT_SYNC["last"] = 0.0

    def test_neuere_belegung_von_greport_kommt_an_zaehler_bleiben(self):
        d = laerm.qt_all(); d["use"] = {"klopfen": 7}; d["own"] = {"c_000001": {"l": "Alt", "ts": 1}}; laerm.qt_save()
        self.assertGreater(d.get("lay_ts", 0), 0)
        self.gr_write({"own": {"c_000002": {"l": "Neu", "ts": 2}}, "req": {"src": True}, "use": {"klopfen": 99}, "lay_ts": time.time() + 10})
        with mock.patch.object(laerm, "gr_status", return_value={"linked": True}):
            self.assertTrue(laerm.qt_sync_pull())
        d = laerm.qt_all()
        self.assertEqual(d["own"], {"c_000002": {"l": "Neu", "ts": 2}}); self.assertEqual(d["req"], {"src": True})
        self.assertEqual(d["use"], {"klopfen": 7})                     # Zähler bleiben je App
        with mock.patch.object(laerm, "gr_status", return_value={"linked": True}):
            self.assertFalse(laerm.qt_sync_pull())                     # zweites Mal: nichts Neues, kein Ping-Pong

    def test_aeltere_belegung_wird_nicht_uebernommen(self):
        d = laerm.qt_all(); d["own"] = {"c_000001": {"l": "Meins", "ts": 1}}; laerm.qt_save()
        self.gr_write({"own": {"c_000009": {"l": "Alt", "ts": 1}}, "lay_ts": 1.0})
        with mock.patch.object(laerm, "gr_status", return_value={"linked": True}):
            self.assertFalse(laerm.qt_sync_pull())
        self.assertEqual(laerm.qt_all()["own"], {"c_000001": {"l": "Meins", "ts": 1}})

    def test_nicht_verbunden_kein_abgleich(self):
        self.gr_write({"own": {"c_000002": {"l": "Neu", "ts": 2}}, "lay_ts": time.time() + 10})
        with mock.patch.object(laerm, "gr_status", return_value={"linked": False}):
            self.assertFalse(laerm.qt_sync_pull())

    def test_lay_ts_nur_bei_belegungsaenderung(self):
        d = laerm.qt_all(); d["own"] = {"c_000001": {"l": "A", "ts": 1}}; laerm.qt_save(); t1 = d["lay_ts"]
        d["use"] = {"x": 1}; laerm.qt_save()
        self.assertEqual(d["lay_ts"], t1)                              # nur ein Zähler: kein neuer Zeitstempel


if __name__ == "__main__":
    unittest.main()
