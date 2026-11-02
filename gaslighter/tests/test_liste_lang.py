"""ab 1.85.73: lange Zeiträume der Ereignisliste rechnen nicht bei jeder neuen Störung neu (KI-Einordnung, Ereignis-Daten, log.csv),
wohl aber sofort nach einer Änderung über die Oberfläche."""
import datetime as dt
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
import laerm  # noqa: E402


class ListeLang(unittest.TestCase):
    def setUp(self):
        self.calls = 0

        def fake(*a, **k):
            self.calls += 1
            return {"n": self.calls}
        self.p = [mock.patch.object(laerm, "_events_summary", side_effect=fake), mock.patch.object(laerm, "read_log", return_value=None),
                  mock.patch.object(laerm, "evmeta_path", return_value="/nicht/da")]
        for p in self.p:
            p.start()
        laerm.EVS_CACHE.clear()

    def tearDown(self):
        for p in self.p:
            p.stop()
        laerm.EVS_CACHE.clear()

    def test_neue_stoerung_wartet_oberflaeche_nicht(self):
        rng = (dt.datetime(2026, 10, 4), dt.datetime(2026, 11, 3))
        self.assertEqual(laerm.events_summary("all", 5000, "", rng)["n"], 1)
        laerm.VER["art"] += 1                                  # KI ordnet die neue Störung ein
        laerm.LOG_CACHE["key"] = ("neu", laerm.LOG_CACHE.get("key"))   # log.csv hat sich geändert
        self.assertEqual(laerm.events_summary("all", 5000, "", rng)["n"], 1)
        laerm.VER["data"] += 1                                 # Änderung über die Oberfläche
        self.assertEqual(laerm.events_summary("all", 5000, "", rng)["n"], 2)

    def test_kurzer_zeitraum_sofort(self):
        rng = (dt.datetime(2026, 11, 2), dt.datetime(2026, 11, 3))
        self.assertEqual(laerm.events_summary("all", 200, "", rng)["n"], 1)
        laerm.VER["art"] += 1
        self.assertEqual(laerm.events_summary("all", 200, "", rng)["n"], 2)


if __name__ == "__main__":
    unittest.main()
