"""ab 1.85.62: Regel „nur melden, wenn nicht gleichzeitig …“ – Tür-Erschütterung ohne Radar im Flur; nur Anzeige."""
import csv
import datetime as dt
import os
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
import laerm  # noqa: E402


class RegelOhne(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(); self.f = os.path.join(self.tmp, "ha_zustand.csv")
        self.keep = (laerm.ha_hist_path, list(laerm.HA_RULES), laerm.ha_note_all, laerm.run_downs, laerm.ha_len_caps)
        laerm.ha_hist_path = lambda: self.f; laerm.ha_note_all = lambda: {}; laerm.run_downs = lambda: []; laerm.ha_len_caps = lambda: {}
        laerm.HA_HIST.update(key=None, rows=[])
        self.t0 = int(time.time() * 1000) - 3600000
        iso = lambda ms: dt.datetime.fromtimestamp(ms / 1000).astimezone().isoformat(timespec="milliseconds")
        rows = [(self.t0, "tuer", 1), (self.t0 + 2000, "tuer", 0),                 # 1) Tür, Radar 10 s später an → du selbst
                (self.t0 + 12000, "radar", 1), (self.t0 + 60000, "radar", 0),
                (self.t0 + 600000, "tuer", 1), (self.t0 + 602000, "tuer", 0)]    # 2) Tür allein → melden
        with open(self.f, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh); w.writerow(["zeit", "regel", "name", "entitaet", "zustand", "an", "geraet"])
            for t, rid, on in rows:
                w.writerow([iso(t), rid, rid, "binary_sensor." + rid, "on" if on else "off", on, "all"])

    def tearDown(self):
        laerm.ha_hist_path, rules, laerm.ha_note_all, laerm.run_downs, laerm.ha_len_caps = self.keep
        laerm.HA_RULES[:] = rules

    def rules(self, unless, how="not"):
        r = [{"id": "tuer", "entity": "binary_sensor.tuer", "states": "on", "mode": "event", "enabled": True, "src": "all"},
             {"id": "radar", "entity": "binary_sensor.radar", "states": "on", "mode": "note", "enabled": True, "src": "all"}]
        if unless is not None:
            r[0].update(unless=["radar"], unless_s=unless, unless_how=how)
        laerm.HA_RULES[:] = laerm.clean_rules(r)

    def tuer(self):
        return [x[0] - self.t0 for x in laerm.ha_intervals("*", self.t0 - 1000, self.t0 + 3600000) if x[3] == "tuer"]

    def test_ohne_einstellung_alles(self):
        self.rules(None)
        self.assertEqual(self.tuer(), [0, 600000])

    def test_nur_ohne_radar(self):
        self.rules(30)
        self.assertEqual(laerm.HA_RULES[0]["unless"], ["radar"])
        self.assertEqual(self.tuer(), [600000])                         # mit Radar binnen 30 s: ausgeblendet
        self.assertEqual(laerm.ha_suppressed(self.t0 - 1000, self.t0 + 3600000), {"tuer": 1})

    def test_toleranz_zu_klein(self):
        self.rules(5)
        self.assertEqual(self.tuer(), [0, 600000])                      # Radar erst 10 s später: zählt bei 5 s nicht als gleichzeitig

    def test_nur_zusammen_mit(self):
        self.rules(30, "with")
        self.assertEqual(laerm.HA_RULES[0]["unless_how"], "with")
        self.assertEqual(self.tuer(), [0])                              # nur die Tür-Meldung mit Radar binnen 30 s


if __name__ == "__main__":
    unittest.main()
