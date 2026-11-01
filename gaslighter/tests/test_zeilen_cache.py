"""ab 1.85.57: Zeilen-Zwischenspeicher der Ereignisliste – Einordnungen mit (verschachtelten) Listen dürfen die Liste nie abbrechen."""
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
import laerm  # noqa: E402


class ZeilenCache(unittest.TestCase):
    def test_listen_in_der_einordnung(self):
        art = {"a.wav": {"g": "klopfen", "c": 0.8, "k": [["klopfen", 80], ["tuer", 10]], "p": [["Nachbar", 0.7, "ok"]], "top": [["x", 5, "y"]]}}
        r = {"k": "s1|0", "start": "2026-11-01T23:00:00", "dauer_s": "1.0", "datei": "a.wav"}
        with mock.patch.object(laerm, "art_all", return_value=art), mock.patch.object(laerm, "best_of", return_value={"g": "klopfen", "ki": ["a", "b"]}), \
                mock.patch.object(laerm, "_ev_row", side_effect=lambda r_: dict(r_, x=1)):
            laerm.EVROW["rows"].clear(); laerm.KL["sug"]["a.wav"] = ["klopfen", 90]
            try:
                self.assertEqual(laerm.ev_row(r)["x"], 1)
                self.assertEqual(laerm.ev_row(r)["x"], 1)              # zweites Mal aus dem Zwischenspeicher
                self.assertEqual(len(laerm.EVROW["rows"]), 1)
            finally:
                laerm.KL["sug"].pop("a.wav", None)


if __name__ == "__main__":
    unittest.main()
