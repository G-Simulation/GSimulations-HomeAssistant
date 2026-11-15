"""ab 1.85.79: abgeschlossene Ausschnitte des Verlaufs werden auf dem Server zwischengespeichert; Laufendes nie,
neue Störung / KI-Einordnung / Änderung über die Oberfläche rechnen neu."""
import os
import sys
import tempfile
import time
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
import laerm  # noqa: E402


class VerlaufKacheln(unittest.TestCase):
    def setUp(self):
        self.calls = 0
        self.tmp = tempfile.mkdtemp(); self.log = os.path.join(self.tmp, "log.csv"); open(self.log, "w").write("x\n")

        def fake(*a, **k):
            self.calls += 1
            return {"ok": True, "n": self.calls}
        self.p = [mock.patch.object(laerm, "day_track", side_effect=fake), mock.patch.object(laerm, "paths", return_value=(self.tmp, self.tmp, self.log))]
        for p in self.p:
            p.start()
        laerm.DT_RC.clear()

    def tearDown(self):
        for p in self.p:
            p.stop()
        laerm.DT_RC.clear()

    def test_vergangen_aus_speicher(self):
        t1 = int(time.time() * 1000) - 3600000; t0 = t1 - 600000
        a = laerm.day_track_cached("main", "2026-11-14", t0, t1, 512, True, True)
        b = laerm.day_track_cached("main", "2026-11-14", t0, t1, 512, True, True)
        self.assertEqual(a["n"], 1); self.assertEqual(b["n"], 1)
        laerm.VER["art"] += 1                                   # KI ordnet neu ein: neu rechnen
        self.assertEqual(laerm.day_track_cached("main", "2026-11-14", t0, t1, 512, True, True)["n"], 2)
        open(self.log, "a").write("neue Störung\n")             # neue Zeile in log.csv: neu rechnen
        self.assertEqual(laerm.day_track_cached("main", "2026-11-14", t0, t1, 512, True, True)["n"], 3)

    def test_laufendes_nie(self):
        t1 = int(time.time() * 1000); t0 = t1 - 600000
        laerm.day_track_cached("main", "2026-11-15", t0, t1, 512, True, True)
        laerm.day_track_cached("main", "2026-11-15", t0, t1, 512, True, True)
        self.assertEqual(self.calls, 2)


if __name__ == "__main__":
    unittest.main()
