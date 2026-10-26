"""ab 1.85.44: Hintergrund – Berechnungsart gilt sofort (rekey), Dauerpegel-Regel (Fernseher/Radio/Laptop)."""
import collections
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
import laerm  # noqa: E402


def sus_step(C, bg, sus, sus_q, fl, nblk, log):
    """Genau die Regel aus dem Aufnahme-Lauf (laerm.py), als Funktion – damit sie hier mit Pegelreihen durchgespielt werden kann."""
    if C.get("sus_on", True) is not False and bg.value is not None:
        sus_n = max(50, int(float(C.get("sus_s") or 20) * 10))
        if sus_q.maxlen != sus_n:
            sus_q = collections.deque(sus_q, maxlen=sus_n)
        sus_q.append(float(np.median(fl)))
        sref = sus["ref"] if sus else bg.value
        if len(sus_q) >= sus_n and nblk % 5 == 0:
            arr = np.asarray(sus_q); over = float(np.mean(arr > sref + float(C.get("sus_over_db") or 6)))
            typ = float(np.median(arr))
            if sus is None:
                if over >= 0.9 and typ - sref <= float(C.get("sus_max_db") or 25):
                    sus = {"ref": sref, "lvl": typ, "t": 0}; log.append(("an", typ))
            elif over < 0.5:
                log.append(("aus", 0)); sus = None
            else:
                sus["lvl"] = typ
        if sus is not None and bg.value < sus["lvl"]:
            bg.value = sus["lvl"]
    elif sus is not None:
        sus = None
    return sus, sus_q


class Dauerpegel(unittest.TestCase):
    def cfg(self, **kw):
        c = dict(laerm.DEFAULTS); c.update(kw); return c

    def run_levels(self, levels, **kw):
        C = self.cfg(**kw); bg = laerm.Background(lambda: C); sus = None; q = collections.deque(maxlen=200); log = []; thr = []
        for i, lv in enumerate(levels):
            fl = [lv] * 5
            if sus is None:
                bg.add(lv, lv)                      # wie im Lauf: ohne Störung lernt der Hintergrund
            sus, q = sus_step(C, bg, sus, q, fl, i + 1, log)
            thr.append(None if bg.value is None else bg.value + C["offset_db"])
        return log, thr, bg

    def test_fernseher_wird_dauerpegel_und_geht_wieder(self):
        quiet = [-68.0] * 400                       # 40 s ruhig
        tv = [-50.0 + (2.0 if i % 7 == 0 else 0.0) for i in range(600)]   # 60 s Fernseher, leicht schwankend
        after = [-68.0] * 300
        log, thr, bg = self.run_levels(quiet + tv + after)
        self.assertEqual([x[0] for x in log], ["an", "aus"])
        self.assertAlmostEqual(log[0][1], -50.0, delta=1.5)
        self.assertGreater(thr[400 + 250], -45)     # nach 25 s Fernseher: Hintergrund = Fernseherpegel (−50), Schwelle darüber
        self.assertLess(thr[-1], -45)               # danach wieder tief

    def test_lauter_dauerlaerm_bleibt_stoerung(self):
        quiet = [-68.0] * 400
        bass = [-35.0] * 600                        # 33 dB über ruhig: über der Obergrenze (25)
        log, thr, bg = self.run_levels(quiet + bass)
        self.assertEqual(log, [])
        self.assertLess(thr[-1], -35)               # Schwelle bleibt unter dem Dauerlärm → er zählt weiter als Störung

    def test_aus_schaltbar(self):
        log, thr, bg = self.run_levels([-68.0] * 400 + [-50.0] * 600, sus_on=False)
        self.assertEqual(log, [])

    def test_rekey_sofort(self):
        C = self.cfg(bg_stat="quiet"); bg = laerm.Background(lambda: C)
        for i in range(300):
            lv = -70.0 if i % 10 == 0 else -55.0
            bg.add(lv, lv)
        self.assertLess(bg.value, -60)              # leiseste Momente
        C["bg_stat"] = "median"; bg.rekey()
        self.assertGreater(bg.value, -56)           # typischer Pegel – sofort, ohne 5-min-Glättung


if __name__ == "__main__":
    unittest.main()
