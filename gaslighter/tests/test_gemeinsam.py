"""Gemeinsame Erfassung mit GReport (erfassung.js, erfassung.css): GReport ist die Quelle, GLighter hat eine unveränderte Kopie
(tools/sync_shared.py). Hier: Kopie gleich, Seite bindet sie ein, der Server liefert sie aus, die Schnell-Schalter (sechide) werden
in layout.json gemerkt, alle Texte stehen in i18n.js."""
import json, os, re, shutil, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")
GR_APP = os.path.join(HERE, "..", "..", "greport", "app")
sys.path.insert(0, APP)
import laerm  # noqa: E402

SHARED = ["web/erfassung.js", "web/erfassung.css", "web/felder.js", "felder.py"]


class GleicheDateien(unittest.TestCase):
    def test_gleich_wie_in_greport(self):
        if not os.path.isdir(GR_APP):
            self.skipTest("GReport liegt nicht daneben")
        for rel in SHARED:
            with open(os.path.join(APP, rel), "rb") as a, open(os.path.join(GR_APP, rel), "rb") as b:
                self.assertEqual(a.read(), b.read(), rel + " weicht von GReport ab – python3 tools/sync_shared.py")

    def test_sync_skript_prueft(self):
        tool = os.path.join(HERE, "..", "..", "tools", "sync_shared.py")
        if not os.path.exists(tool):
            self.skipTest("tools/sync_shared.py fehlt (nur im Repo)")
        r = subprocess.run([sys.executable, tool, "--check"], capture_output=True, text=True, timeout=30)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_seite_bindet_ein_und_server_liefert_aus(self):
        html = open(os.path.join(APP, "web", "index.html"), encoding="utf-8").read()
        self.assertIn('<script src="erfassung.js', html)
        self.assertIn('<link rel="stylesheet" href="erfassung.css', html)
        self.assertLess(html.index('<script src="felder.js'), html.index('<script src="erfassung.js'))       # Erfassung braucht Felder
        self.assertLess(html.index('<script src="erfassung.js'), html.index('<script src="app.js'))     # und die App die Erfassung
        self.assertLess(html.index('href="app.css'), html.index('href="erfassung.css'))
        self.assertIn('id="fnpanel"', html)
        self.assertNotIn('id="fnptext"', html)                                    # Aufbau kommt aus erfassung.js
        self.assertTrue({"erfassung.js", "erfassung.css"} <= laerm.STATIC)

    def test_keine_eigene_erfassung_mehr(self):
        js = open(os.path.join(APP, "web", "app.js"), encoding="utf-8").read()
        for old in ("function fnpTags", "function fclSave", "function fclDraw", "function whenPick", "function tagInBind", "const FCL ="):
            self.assertNotIn(old, js)
        self.assertIn("E.setup(", js)


class SchnellSchalter(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(); self.keep = laerm.LAYOUT_FILE
        laerm.LAYOUT_FILE = os.path.join(self.tmp, "layout.json"); laerm.LAYOUT["data"] = None

    def tearDown(self):
        laerm.LAYOUT_FILE = self.keep; laerm.LAYOUT["data"] = None
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_gemerkt_und_geprueft(self):
        j = laerm.layout_change({"cap": {"sechide": ["tags", "b_00a001", "unsinn", "tags"], "sechide_pop": []}})
        self.assertTrue(j["ok"])
        cap = j["layout"]["cap"]
        self.assertEqual(cap["sechide"], ["tags", "b_00a001"])                 # nur bekannte Bereiche/Felder, keine doppelten
        self.assertEqual(cap["sechide_pop"], [])                               # leer gesetzt ≠ nie gesetzt
        j = laerm.layout_change({"cap": {"title": "Lärm"}})                    # anderes ändern: bleibt
        self.assertEqual(j["layout"]["cap"]["sechide"], ["tags", "b_00a001"])
        j = laerm.layout_change({"reset": "cap"})                              # „Auf Standard“: Schnell-Schalter bleiben (wie GReport)
        self.assertEqual(j["layout"]["cap"]["sechide"], ["tags", "b_00a001"])
        self.assertEqual(j["layout"]["cap"]["title"], "")

    def test_ohne_schnell_schalter_wie_bisher(self):
        cap = laerm.layout_change({"cap": {"title": "x"}})["layout"]["cap"]
        self.assertNotIn("sechide", cap)
        self.assertNotIn("sechide_pop", cap)
        self.assertNotIn("sechide", laerm.layout_cap_clean({"sechide": "kaputt"}))


@unittest.skipUnless(shutil.which("node"), "node fehlt")
class Texte(unittest.TestCase):
    def test_alle_texte_der_erfassung_da(self):
        js = open(os.path.join(APP, "web", "erfassung.js"), encoding="utf-8").read()
        keys = set(re.findall(r"\bt\('([a-z0-9_]+)'", js)) | set(re.findall(r'data-i[a-z]*="([a-z0-9_]+)"', js))
        keys = {k for k in keys if not k.endswith('_')}                         # t('gr_g_' + g) usw.: Teile, unten einzeln
        keys |= {"gr_g_" + g for g in ("src", "kind", "lvl", "eff", "act", "misc", "own", "when")}
        keys |= set(re.findall(r"'((?:gr|fc|fnp)_[a-z0-9_]+)'", js.split("const VOPT")[1].split("function layBar")[0]))
        keys |= set(re.findall(r"'((?:gr|fc|fnp)_[a-z0-9_]+)'", js.split("const SEC_L")[1].split("\n")[0]))
        keys |= {"nt_w_" + w for w in ("now", "5", "15", "60", "night", "eve", "none")}
        src = "const fs=require('fs');const window={};eval(fs.readFileSync(process.argv[1],'utf8'));console.log(JSON.stringify(window.I18N))"
        I = json.loads(subprocess.run(["node", "-e", src, os.path.join(APP, "web", "i18n.js")], capture_output=True, text=True, check=True).stdout)
        for lg in ("de", "en"):
            self.assertEqual(sorted(k for k in keys if k not in I[lg]), [], lg)


if __name__ == "__main__":
    unittest.main()
