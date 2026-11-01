"""Oberflächen-Rauchtest GReport: Seite lädt ohne Fehler, Notiz speichern, Liste, Schnellwahl verwalten, Handy ohne Überbreite."""
import os, shutil, socket, subprocess, sys, tempfile, time, urllib.request

APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app")


def main():
    from playwright.sync_api import sync_playwright
    tmp = tempfile.mkdtemp(); s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    env = dict(os.environ, GR_DIR=os.path.join(tmp, "share"), GR_PRIVATE=os.path.join(tmp, "priv"), GR_OPTIONS=os.path.join(tmp, "none.json"),
               GR_PORT=str(port), GR_ALLOW_ALL="1", GR_GLIGHTER_DIR=os.path.join(tmp, "nogl"))
    srv = subprocess.Popen([sys.executable, os.path.join(APP, "greport.py")], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    errors, fails = [], []
    try:
        url = f"http://127.0.0.1:{port}/"
        for _ in range(60):
            try:
                urllib.request.urlopen(url, timeout=1); break
            except Exception:
                time.sleep(0.3)
        kw = {"executable_path": "/opt/pw-browsers/chromium"} if os.path.exists("/opt/pw-browsers/chromium") else {}
        with sync_playwright() as p:
            b = p.chromium.launch(**kw)
            pg = b.new_context(locale="de-DE", viewport={"width": 1200, "height": 900}).new_page()
            pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
            pg.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
            pg.goto(url); pg.wait_for_selector("#fnptags .tag[data-t]"); pg.wait_for_timeout(500)
            if pg.locator("#fnpsrc, #fnpsrcl").count():
                fails.append("„Quelle / Gerät“ ist noch da")
            if not pg.locator("#fnprun").count():
                fails.append("„läuft noch“ fehlt")
            if pg.locator("#fnptags .grp").count() < 5:
                fails.append("Schnellwahl nicht nach Gruppen")
            pg.fill("#fnptext", "Bass dröhnt"); pg.click('#fnptags .tag[data-t="klopfen"]'); pg.click("#fnpsave"); pg.wait_for_timeout(800)
            if pg.locator("#grnotes .note").count() != 1 or "Bass dröhnt" not in pg.locator("#grnotes").inner_text():
                fails.append("gespeicherte Notiz erscheint nicht in der Liste")
            pg.click("#grnotes .note .e"); pg.wait_for_timeout(300)
            if pg.input_value("#fnptext") != "Bass dröhnt" or not pg.locator("#fnpcancel").is_visible():
                fails.append("Ändern füllt „Notiz jetzt“ nicht")
            pg.click("#fnpcancel")
            pg.click("#fnptags .grp[data-g='own'] .tag.add", button="right"); pg.wait_for_timeout(300)   # Schnellwahl bearbeiten (ab 1.12.13: Rechtsklick; Klick = Eingabefeld in der Rubrik)
            pg.fill("#qtnew", "Waschmaschine"); pg.click("#qtaddok"); pg.wait_for_timeout(500)
            r = pg.locator('#qtlist .qtr[data-k="musik"] input[type=text]'); r.fill("Bass"); r.press("Enter"); pg.wait_for_timeout(500)
            pg.click('#qtlist .qtr[data-k="unten"] .up'); pg.wait_for_timeout(500)
            pg.locator('#qtlist .qtg.g-src h4 input[type=color]').evaluate("e => { e.value = '#ff0000'; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); }"); pg.wait_for_timeout(600)
            pg.click("#qtdlg .dlgx"); pg.wait_for_timeout(300)
            txt = pg.locator("#fnptags").inner_text()
            gc = pg.locator('#fnptags .tag[data-t="oben"]').evaluate("e => getComputedStyle(e).getPropertyValue('--gc').trim()")
            if gc.lower() not in ("#ff0000", "rgb(255, 0, 0)"):
                fails.append("Gruppenfarbe wirkt nicht: " + gc)
            if "Waschmaschine" not in txt or "Bass" not in txt or "Musik/Bass" in txt:
                fails.append("eigenes Wort oder Umbenennen wirkt nicht")
            src_ = [x.get_attribute("data-t") for x in pg.locator("#fnptags .grp >> nth=0").locator(".tag[data-t]").all()]
            if src_[:2] != ["unten", "oben"]:
                fails.append("Anordnen wirkt nicht: " + ",".join(src_[:3]))
            pg.click("#grmenu"); pg.wait_for_timeout(200)
            if pg.locator("#grmenul button").count() < 6:
                fails.append("Menü unvollständig")
            pg.locator("#grmenul button >> nth=1").click(); pg.wait_for_timeout(300)   # Datum und Uhrzeit
            pg.select_option("#pfdate", "iso"); pg.select_option("#pftime", "hm"); pg.click("#pfsave"); pg.wait_for_timeout(500)
            import re as _re
            if not _re.fullmatch(r"\d\d:\d\d", pg.locator("#capclock").inner_text().strip()) or not _re.fullmatch(r"\d{4}-\d\d-\d\d", pg.locator("#capdate").inner_text().strip()):
                fails.append("Datums-/Zeitformat wirkt nicht: " + pg.locator("#capclock").inner_text() + " " + pg.locator("#capdate").inner_text())
            pg.click("#fnptags .grp[data-g='own'] .tag.add", button="right"); pg.wait_for_timeout(300)             # Pflicht-Gruppen: pulsieren, wenn alle gewählt
            pg.locator("#qtlist .qtg.g-src .reqc input").check(); pg.wait_for_timeout(400)
            pg.locator("#qtlist .qtg.g-kind .reqc input").check(); pg.wait_for_timeout(400)
            pg.click("#qtdlg .dlgx"); pg.wait_for_timeout(200)
            pg.click('#fnptags .tag[data-t="oben"]')
            if "alldone" in (pg.locator("#fnpanel").get_attribute("class") or ""):
                fails.append("Pflicht: leuchtet schon, obwohl „Was“ fehlt")
            pg.click('#fnptags .tag[data-t="klopfen"]'); pg.wait_for_timeout(200)
            if "alldone" not in (pg.locator("#fnpanel").get_attribute("class") or ""):
                fails.append("Pflicht: leuchtet nicht, obwohl alles gewählt ist")
            pg.click("#fnpsave"); pg.wait_for_timeout(600)
            if "alldone" in (pg.locator("#fnpanel").get_attribute("class") or ""):
                fails.append("Pflicht: Leuchten bleibt nach dem Speichern")
            pg.locator("#secbar .secb >> nth=1").click(); pg.wait_for_timeout(200)       # Abschnitt Schnellwahl ausblenden
            if pg.locator("#fnptags").is_visible():
                fails.append("Abschnitt Schnellwahl lässt sich nicht ausblenden")
            pg.locator("#secbar .secb >> nth=1").click(); pg.wait_for_timeout(200)
            if not pg.locator("#fnptags").is_visible():
                fails.append("Abschnitt Schnellwahl lässt sich nicht wieder einblenden")
            pg.click("#helpbtn"); pg.wait_for_timeout(300)
            if pg.locator("#helpbody details").count() < 9 or "gr_h" in pg.locator("#helpbody").inner_text():
                fails.append("Hilfe unvollständig")
            pg.click("#helpdlg .dlgx")
            pg.click("#grmenu"); pg.wait_for_timeout(200)
            pg.locator("#grmenul button", has_text="Textdatei").click(); pg.wait_for_timeout(500)
            if not pg.locator("#txtdlg").is_visible() or not pg.locator("#txtpro").is_visible():
                fails.append("Textdatei-Dialog fehlt oder ohne Pro nicht gesperrt")
            if any(k in pg.locator("#txtdlg").inner_text() for k in ("gr_", "fnp_")):
                fails.append("Text-Schlüssel im Textdatei-Dialog")
            pg.click("#txtdlg .dlgx"); pg.wait_for_timeout(200)
            if any(k in pg.locator("body").inner_text() for k in ("gr_", "fnp_", "qt_", "nt_")):
                fails.append("Text-Schlüssel statt Text sichtbar")
            # Zeit-Tasten: gerechnet ab dem ersten Tippen; zweite Taste wieder ab dort; von Hand gesetzte Zeit erst nach Hinweis ersetzen
            pg.fill("#fnptext", "Tür knallt"); pg.wait_for_timeout(1300)
            cap = pg.evaluate("() => FNP.cap")
            pg.click('#fnptags .tag[data-w="w_5"]'); pg.wait_for_timeout(100)
            want = lambda m: pg.evaluate("([c, m]) => dtl(new Date(c - m * 60000))", [cap, m])
            if pg.input_value("#fnpfromi") != want(5):
                fails.append("Zeit-Taste rechnet nicht ab Erfassungsbeginn: " + pg.input_value("#fnpfromi") + " statt " + want(5))
            pg.wait_for_timeout(1100); pg.click('#fnptags .tag[data-w="w_15"]'); pg.wait_for_timeout(100)
            if pg.input_value("#fnpfromi") != want(15):
                fails.append("zweite Zeit-Taste rechnet nicht ab Erfassungsbeginn")
            pg.fill("#fnpfromi", "2026-01-02T03:04:05"); pg.click('#fnptags .tag[data-w="w_5"]'); pg.wait_for_timeout(100)
            if pg.input_value("#fnpfromi") != "2026-01-02T03:04:05" or "warn" not in (pg.locator("#fnpmsg").get_attribute("class") or ""):
                fails.append("von Hand gesetzte Zeit wird ohne Hinweis ersetzt")
            pg.click('#fnptags .tag[data-w="w_5"]'); pg.wait_for_timeout(100)
            if pg.input_value("#fnpfromi") != want(5):
                fails.append("zweites Tippen ersetzt die von Hand gesetzte Zeit nicht")
            # Anlage beim Notieren, 📎 in der Liste, Vorschläge aus dem Dokument (ansehen frei, übernehmen Pro)
            pg.set_input_files("#attf", files=[{"name": "protokoll.txt", "mimeType": "text/plain", "buffer": "12.03.2025\n23:15 Bass dröhnt von oben.\n".encode()}])
            pg.wait_for_timeout(200)
            if "protokoll.txt" not in pg.locator("#fnpatts").inner_text():
                fails.append("vorgemerkte Anlage fehlt")
            pg.click("#fnpsave"); pg.wait_for_timeout(1200)
            if "Taste: vor 5 Min." not in pg.locator("#grnotes").inner_text():
                fails.append("„erfasst …, Taste: …“ fehlt in der Liste")
            if not pg.locator("#grnotes .attb").count():
                fails.append("📎 an der Notiz fehlt")
            else:
                pg.locator("#grnotes .attb").first.click(); pg.wait_for_timeout(500)
                if "protokoll.txt" not in pg.locator("#attlist").inner_text():
                    fails.append("Anlage nicht im Dialog")
                pg.locator('#attlist [data-a="scan"]').first.click(); pg.wait_for_timeout(2500)
                if not pg.locator("#doclist .docrow").count() or "Pro" not in pg.locator("#docgo").inner_text():
                    fails.append("Vorschläge aus dem Dokument fehlen: " + pg.locator("#docst").inner_text())
                pg.click("#docdlg .dlghead .dlgx"); pg.click("#attdlg .dlgx"); pg.wait_for_timeout(200)
            # Überschrift im Layout-Modus ändern (in den Einstellungen gespeichert)
            pg.click("#laybtn"); pg.wait_for_timeout(300)
            pg.evaluate("() => { const e = document.getElementById('capttl'); e.textContent = 'Lärm notieren'; }")
            pg.click("#laydone"); pg.wait_for_timeout(800); pg.reload(); pg.wait_for_selector("#fnptags .tag[data-t]"); pg.wait_for_timeout(400)
            if pg.locator("#capttl").inner_text().strip() != "Lärm notieren":
                fails.append("eigene Überschrift bleibt nicht")
            mp = b.new_context(locale="de-DE", viewport={"width": 375, "height": 760}, is_mobile=True, has_touch=True).new_page()
            mp.on("pageerror", lambda e: errors.append("pageerror (Handy): " + str(e)))
            mp.goto(url); mp.wait_for_selector("#fnptags .tag"); mp.wait_for_timeout(500)
            if mp.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth") > 1:
                fails.append("Handy: Seite breiter als der Bildschirm")
            b.close()
    finally:
        srv.terminate()
        try:
            srv.wait(5)
        except Exception:
            srv.kill()
        shutil.rmtree(tmp, ignore_errors=True)
    for e in errors + fails:
        print("FEHLER:", e)
    print("OK" if not errors and not fails else "NICHT OK")
    return 0 if not errors and not fails else 1


if __name__ == "__main__":
    sys.exit(main())
