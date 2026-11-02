"""ab 1.85.76: „Zeitpunkt“ ist eine normale Rubrik – im Layout mit Name, Farbe, Reihenfolge; Tasten umbenennen, ausblenden, eigene anlegen."""
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
import laerm  # noqa: E402


class ZeitpunktRubrik(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(); out = os.path.join(self.tmp, "out"); os.makedirs(out)
        self.keep = (laerm.paths, laerm.QT["data"])
        laerm.paths = lambda: (out, out + "/clips", out + "/log.csv"); laerm.QT["data"] = None

    def tearDown(self):
        laerm.paths, laerm.QT["data"] = self.keep
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_rubrik_und_tasten(self):
        st = laerm.qt_state()
        gs = [g["g"] for g in st["gall"]]
        self.assertIn("when", gs)
        self.assertLess(gs.index("when"), gs.index("own"))
        j = laerm.qt_change({"action": "batch", "ops": [
            {"action": "gren", "g": "when", "l": "Wann"}, {"action": "gcol", "g": "when", "c": "#123456"},
            {"action": "ren", "k": "w_5", "l": "eben grad"}, {"action": "hide", "k": "w_eve", "on": True},
            {"action": "wadd", "k": "t_abcdef", "l": "Mittag", "at": "12:30"},
            {"action": "order", "keys": ["w_15", "t_abcdef", "w_now"]},
            {"action": "gorder", "groups": ["when", "src", "own"]}]})
        self.assertTrue(j.get("ok"), j)
        st = laerm.qt_state()
        w = {x["k"]: x for x in st["when"]}
        self.assertEqual(w["w_5"]["l"], "eben grad")
        self.assertTrue(w["w_eve"]["hide"])
        self.assertEqual(w["t_abcdef"]["at"], "12:30")
        self.assertEqual(st["order"][:3], ["w_15", "t_abcdef", "w_now"])
        self.assertEqual(st["gall"][0]["g"], "when")
        self.assertEqual(st["gcol"]["when"], "#123456")
        self.assertEqual(next(g for g in st["gall"] if g["g"] == "when")["l"], "Wann")
        laerm.qt_change({"action": "ren", "k": "w_5", "l": ""})                # leer = eingebauter Name
        laerm.qt_change({"action": "del", "k": "t_abcdef"})
        w = {x["k"]: x for x in laerm.qt_state()["when"]}
        self.assertNotEqual(w["w_5"]["l"], "eben grad")
        self.assertNotIn("t_abcdef", w)


if __name__ == "__main__":
    unittest.main()
