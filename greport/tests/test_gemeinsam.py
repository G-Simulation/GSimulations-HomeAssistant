"""Gemeinsame Erfassung (erfassung.js, erfassung.css): GReport ist die Quelle, GLighter hat eine unveränderte Kopie
(tools/sync_shared.py). Hier: Kopie in GLighter gleich, die Seite bindet sie ein, der Server liefert sie aus, alle Texte stehen in i18n.js."""
import json, os, re, shutil, subprocess, sys, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")
GL_APP = os.path.join(HERE, "..", "..", "gaslighter", "app")

SHARED = ["web/erfassung.js", "web/erfassung.css", "web/felder.js", "felder.py"]


class GleicheDateien(unittest.TestCase):
    def test_gleich_in_glighter(self):
        if not os.path.isdir(GL_APP):
            self.skipTest("GLighter liegt nicht daneben")
        for rel in SHARED:
            with open(os.path.join(APP, rel), "rb") as a, open(os.path.join(GL_APP, rel), "rb") as b:
                self.assertEqual(a.read(), b.read(), rel + " in GLighter weicht ab – python3 tools/sync_shared.py")

    def test_seite_bindet_ein(self):
        html = open(os.path.join(APP, "web", "index.html"), encoding="utf-8").read()
        self.assertIn('<script src="erfassung.js', html)
        self.assertIn('<link rel="stylesheet" href="erfassung.css', html)
        self.assertLess(html.index('<script src="felder.js'), html.index('<script src="erfassung.js'))
        self.assertLess(html.index('<script src="erfassung.js'), html.index('<script src="app.js'))
        self.assertLess(html.index('href="greport.css'), html.index('href="erfassung.css'))
        self.assertIn('id="fnpanel"', html)
        self.assertNotIn('id="fnptext"', html)                                    # Aufbau kommt aus erfassung.js

    def test_erfassung_nur_im_modul(self):
        js = open(os.path.join(APP, "web", "app.js"), encoding="utf-8").read()
        for old in ("function fnpTags", "function laySave", "function layDraw", "function whenPick", "function tagInBind", "const LAY ="):
            self.assertNotIn(old, js)
        self.assertIn("E.setup(", js)
        mod = open(os.path.join(APP, "web", "erfassung.js"), encoding="utf-8").read()
        for f in ("function fnpTags", "function laySave", "function whenPick", "function tagInBind", "function fnPop"):
            self.assertIn(f, mod)

    def test_server_liefert_aus(self):
        src = open(os.path.join(APP, "greport.py"), encoding="utf-8").read()
        self.assertIn('".js": "text/javascript', src)                         # alle .js/.css aus web/ (kein Verzeichnis nötig)
        self.assertIn('".css": "text/css', src)


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
