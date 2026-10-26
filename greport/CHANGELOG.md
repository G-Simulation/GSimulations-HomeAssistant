# Changelog

## 1.12.11

- **Schnellwahl-Tasten mit GLighter abgleichen:** Sind beide Apps installiert und verbunden, haben beide dieselbe Tastenbelegung (eigene Tasten, Umbenennungen, Ausblendungen, Gruppen, Reihenfolge, Pflichtfelder). Wer zuletzt geändert hat, gewinnt; die Nutzungszähler bleiben je App.

## 1.12.10

- **Von selbst speichern** (Anzeige → „Von selbst speichern“, 3/5/8/12 s, Standard aus): Sobald alle Pflichtfelder gesetzt sind, zählt die Taste „Speichern“ sichtbar herunter und speichert dann. Text tippen oder ein freiwilliges Feld wählen startet den Countdown neu, Klick auf die Taste speichert sofort. Nur bei neuen Notizen, nie beim Ändern. Ohne ein einziges Pflichtfeld passiert nichts.

## 1.12.9
- **„＋ Rubrik“ mit Shoelace (MIT, lokal eingebunden):** Typauswahl schließt bei Klick daneben und mit Esc, wird nicht abgeschnitten.
- **Tasten in einer Rubrik entfernen** geht jetzt auch in der Home-Assistant-App: Rückfrage im Knopf („Sicher?“) statt Browser-Fenster.
- Schnellwahl: neue Taste „Tür“ unter „Woher“; die Taste unter „Was“ heißt „Türenknallen“ („Tür knallt“ in Dokumenten erkennt beides).

## 1.12.8
- Auch in der Feldliste: „＋ Rubrik“ öffnet beim Klick die Typauswahl (statt Auswahlliste + „Hinzufügen“) – überall gleich.

## 1.12.7
- Typauswahl bei „＋ Rubrik“ wird nicht mehr am Rand des Notiz-Bereichs abgeschnitten: liegt über der ganzen Seite und öffnet nach oben oder unten, je nach Platz.

## 1.12.6
- In „Layout anpassen“ kein Notiz-„Speichern“ mehr (das Layout speichert „Fertig“) – keine Meldung „Bitte Text oder einen Tag angeben“ beim Layout.
- Eine Notiz nur mit Zeuge oder „Mehr“ ist nicht leer.

## 1.12.5
- „＋ Rubrik“: Klick öffnet die Typauswahl als Liste (Tasten, Text, Zahl, Datum/Uhrzeit …), Esc schließt.
- Löschen-Rückfrage kompakt im Knopf („Sicher?“, gleiche Größe), auch beim Entfernen einer Rubrik – kein Browser-Fenster mehr.

## 1.12.4
- **„＋ Rubrik“ mit Typauswahl:** Tasten (Rubrik) oder ein Feld – Text, Zahl, Ja/Nein, Auswahl, Skala, Dauer, Datum/Uhrzeit, Ort, Person, Zähler. Das neue Element erscheint sofort mit derselben Leiste wie die Rubriken, der Name ist zum Überschreiben markiert.
- Felder sehen in „Layout anpassen“ genau wie Rubriken aus (gleicher Rahmen, gleiche Leiste).
- Neue Rubrik ohne Namensabfrage-Fenster (erscheint in der Home-Assistant-App nicht): heißt „Neue Rubrik“, Name direkt in der Leiste ändern.
- „jetzt · Zeit ändern“ steht immer direkt über dem Notiz-Textfeld.

## 1.12.3
- **Jedes Feld direkt am Element bearbeiten (auch Zeuge und die Felder unter „Mehr“):** In „Layout anpassen“ hat jedes Feld dieselbe Leiste wie die Rubriken – ⠿ verschieben (ziehen oder Pfeiltasten), Name, zeigen, Pflicht, unter „Mehr“ einklappen, ⚙ weitere Einstellungen, 🗑 löschen, Hinweis.
- **Zeuge ist ein Feld wie jedes andere:** löschen (zweimal 🗑), gelöscht bleibt der alte feste Zeugen-Bereich weg, über „＋ Feld“ → Person wieder anlegbar.

## 1.12.2
- **Feld löschen (auch Zeuge) geht jetzt in der Home-Assistant-App:** statt eines Bestätigungsfensters, das dort nicht erscheint, fragt der Knopf selbst – erster Klick „Wirklich löschen?“, zweiter Klick löscht. Gleich bei Notiz-Arten.

## 1.12.1
- Versionsanzeige korrigiert (zeigte noch 1.11.1).

## 1.12.0
- **Zeuge und „Mehr“ sind normale Felder:** Name des Zeugen, Häufigkeit, Polizei, Aktenzeichen, gemeldet an/am, Gesundheit, Attest, Bedrohung sind als Standard-Felder angelegt und im Layout-Editor voll bearbeitbar (Name, Hinweis, Pflicht, zeigen, „unter Mehr einklappen“, löschen). Werte bleiben in Zeuge/ext der Notiz (Export, Bericht, GLighter). Ein gelöschtes Feld lässt den alten Wert einer bearbeiteten Notiz unverändert.
- **Layout-Editor in Reitern:** „Anordnung“, „Felder“, „Notiz-Arten“ statt einer sehr langen Seite (Pfeiltasten wechseln, letzter Reiter gemerkt).
- **Tipps:** Erfassungs-Tipp im Kopf statt drei Birnen am Rand, Zeugen-Tipp am Zeugen-Feld.

## 1.11.1
- **Tabelle: Spalten umsortieren.** Im Menü ⚙ „Spalten“ je Spalte ← → (auch per Tastatur, wird angesagt), oder im Tabellenkopf ziehen. Reihenfolge, gezeigte Spalten und Breiten werden in GReport gespeichert (für breite und schmale Ansicht getrennt), „Spalten zurücksetzen“ stellt den Standard wieder her. Die Spalte „Art“ ist jetzt auch im Menü.

## 1.11.0
- **Eigene Notiz-Arten** wie „Erinnerung“, „Termin“ oder „Idee“: unter ▦ Layout anpassen → „Notiz-Arten“ anlegen, mit Name, Farbe und Symbol. Je Art einstellbar: „ohne Zeitpunkt“ (wählen setzt dann auch „ohne Zeitpunkt“, außer die Zeit wurde von Hand gesetzt) und „nicht Störungen zuordnen“ (GLighter hängt solche Notizen an keine Störung). Vorgabe beim Erfassen und „zuletzt gewählte Art behalten“ einstellbar. „Erinnerung“ ist schon angelegt.
- Beim Erfassen als Tasten „Art“ wählbar (auch beim Ändern); im Verlauf als farbiges Schild und als Filter-Taste mit Anzahl, in der Tabelle als Spalte „Art“ mit Filter (mehrere wählbar, auch „ohne Art“). Im CSV-Export die Spalte „notiz_art“ (nur wenn eine Notiz eine Art hat), beim Import wird sie wieder erkannt.
- Gelöschte Arten bleiben für alte Notizen lesbar. Notizen ohne Art bleiben, wie sie sind.

## 1.10.2
- **Eigene Felder genauer einstellbar:** Textfeld mit Platzhalter, Höchstlänge, Zeilenzahl (mehrzeilig) und „frühere Eingaben vorschlagen“ (einzeilig); Datum/Uhrzeit wahlweise „nur Datum“ oder „nur Uhrzeit“, vorbelegt mit „jetzt“, Taste „Jetzt“/„Heute“ abschaltbar, mit Sekunden; Ort mit Platzhalter. Ältere Werte bleiben gültig.
- **Abgedockt: Tipps wie eingestellt.** Im abgedockten Fenster „Notiz jetzt“ (⧉) folgen die 💡-Tipps jetzt der Tipp-Einstellung, statt alle offen dazustehen: „beim Zeigen“ zeigt nur ein kleines 💡, der Text erscheint beim Zeigen, mit der Tastatur oder nach Antippen. 💡 sitzt im Fenster (und am Handy) in einer eigenen Spalte rechts, keine Taste liegt mehr darunter, und die Blase bleibt im Fenster. Hell/dunkel, Sprache und Gruppenfarben ziehen mit; Meldungen erscheinen im Fenster.
- **Zwei Ansichten: angedockt und abgedockt.** ▦ Layout anpassen hat oben den Schalter „Ansicht: Angedockt | Abgedockt“. Je Ansicht einstellbar: Reihenfolge der Bereiche, Zeigen/Ausblenden von Bereichen, Feldern und Rubriken, Dichte (normal/kompakt) und Tipps (beim Zeigen/immer/aus); die Seitenbreite gilt angedockt. Namen, Tasten und Felder sind in beiden Ansichten dieselben. Im abgedockten Fenster öffnet ▦ (oder Taste lange drücken) direkt die abgedockte Ansicht.
- Abgedockt folgt der angedockten Ansicht, bis du dort etwas änderst; „Wie angedockt übernehmen“ stellt das wieder her. „Auf Standard zurücksetzen“ und eine Vorlage setzen auch die abgedockte Ansicht zurück.
- Die Schnell-Schalter ● / ○ über „Notiz jetzt“ gelten je Ansicht und werden jetzt in den Einstellungen gespeichert (gleich auf allen Geräten). Die bisher nur im Browser gemerkten Schalter werden einmal in die angedockte Ansicht übernommen – es ändert sich nichts an dem, was du siehst.
- Gespeichert in einstellungen.json (Schlüssel „pop“, „sechide“, „sechide_pop“, „dens“) und damit in der Sicherung. Ältere Einstellungsdateien bleiben gültig. Nur Anzeige – Notizen und Werte bleiben unverändert.

## 1.10.1
- Der Name des Zählers aus der Vorlage „Zähler“ (und „Stichworte“ bei „Allgemein“) folgt jetzt der Sprache der Oberfläche, nicht mehr der Spracheinstellung des Servers.
- Passend zu GLighter 1.83: GReport-Notizen werden dort mit einem eigenen Fenster (Standard −10 / +30 min) den Störungen zugeordnet; die Zuordnung von Hand liegt in GLighter, die Notizen in GReport bleiben unverändert.

## 1.10.0
- **Für jedes Thema:** Die Notiz-Erfassung lässt sich jetzt aus Bausteinen zusammenstellen – vom einfachen Strichliste-Zähler („wie oft fällt mir das Feuerzeug runter“) bis zum ausführlichen, nachvollziehbaren Protokoll. Unter ▦ Layout anpassen → „Bereiche und Felder“ → „Hinzufügen“: Pillen-Rubrik (Tasten, auf Wunsch „nur eine Auswahl“), Textfeld, Zähler (＋1, auf Wunsch −1), Zahl (mit Einheit, kleinster und größter Zahl), Ja/Nein, Auswahlliste (eine oder mehrere), Skala (1–5 oder 0–10), Dauer, Datum/Uhrzeit, Ort (mit früheren Eingaben als Vorschlag) und Person/Zeuge (Name, Rolle, Erreichbarkeit).
- **Jeder Bereich** – auch die eingebauten (Text, Schnellwahl, Zeuge, Weitere Angaben, Zeitraum) – hat einen Namen, einen Hinweis, „Pflichtfeld“ und „zeigen“. Der Zeugen-Bereich ist damit freiwillig und frei benennbar. Pflichtfelder geben einen Hinweis; ein zweites „Speichern“ speichert trotzdem.
- **Vorlagen:** „Lärm und Störungen“ (wie bisher, Standard), „Allgemein“ (Text, eine freie Rubrik, Person, Zeit) und „Zähler“ (nur Zeit und eine große Taste ＋1 – jeder Druck ein eigener Eintrag mit genauer Uhrzeit). Beim ersten Start werden sie angeboten, später unter ▦ Layout anpassen → „Vorlage wählen“. Eine Vorlage stellt nur ein, was zu sehen ist – es wird nie etwas gelöscht.
- **Werte überall dabei:** Die Werte stehen je Notiz in einem eigenen Feld („fields“) und erscheinen in der Liste, in der Suche, als eigene Spalten in der Tabelle (mit Filter je Feld), im CSV-Export (je Feld eine Spalte „Name (Kennung)“), im Tagebuch, in JSON-Export, Bericht und Sicherung. CSV und JSON lassen sich mit den Werten wieder einlesen.
- **Zähler-Statistik:** Über der Liste zeigt je Zähler ein kleines Balkenbild die letzten 14 Tage, dazu „heute“. Im Bericht steht die Summe im Zeitraum. In Home Assistant gibt es je Zähler einen Knopf „+1“, Textfelder, Ort, Ja/Nein und einfache Auswahllisten zum Ausfüllen.
- Gelöschte Felder bleiben mit ihren Werten in alten Notizen und im Export erhalten. Notizen ohne eigene Felder, das Änderungsprotokoll mit Prüfsummenkette und bisherige Exporte bleiben unverändert.

## 1.9.3
- **Tipps ruhiger:** 💡 sitzt rechts, senkrecht mittig am zugehörigen Block, mehrere übereinander. Der Text erscheint als schwebende Blase beim Zeigen auf 💡, mit der Tastatur oder nach Antippen. Nichts verschiebt oder flackert mehr.
- **Taste lange drücken** öffnet „Layout anpassen“ mit dieser Taste: gleich weiterziehen oder mit den Pfeiltasten verschieben. Verwalten geht weiter über ⋯ → Schnellwahl verwalten.

## 1.9.2
- **Tipps unauffälliger:** Von jedem Tipp ist nur noch ein kleines 💡 zu sehen. Der Text erscheint, wenn die Maus über dem Bereich ist, ein Feld darin ausgewählt ist oder du auf 💡 tippst. Einstellbar unter ⋯ → Datum und Uhrzeit → „Tipps“: nur beim Zeigen (Standard), immer oder aus.

## 1.9.1
- **Ganze Breite:** Erfassung und Liste nutzen jetzt die ganze Breite des Fensters, so breit wie die Tabelle. Einstellbar unter ▦ Layout anpassen → „Breite der Seite“ (ganze Breite oder schmale Spalte), mit Vorschau; „Abbrechen“ lässt alles, wie es war.

## 1.9.1
- **Ganze Breite:** Erfassung und Liste nutzen jetzt die ganze Breite des Fensters, genauso breit wie die Tabelle. Wer die schmale Spalte lieber mag: ⋯ → Datum und Uhrzeit → „Breite“ → „Schmale Spalte“.

## 1.9.0
- **Neu: Tabelle.** Über der Liste lässt sich zwischen **Zeitleiste** und **Tabelle** wechseln (wird gemerkt). Die Tabelle zeigt Datum, Uhrzeit (von–bis), Text, Schnellwahl-Wörter in ihren Gruppenfarben, Zeuge sowie ✎ und 🗑. Sortieren nach jeder Spalte (Standard: neueste zuerst), Filter in der Kopfzeile (Zeitraum, Uhrzeit, Text, mehrere Wörter, Zeuge), Spalten wählen mit ⚙. Darüber steht genau, was angezeigt wird, z. B. „12 von 340 Notizen (gefiltert)“, mit „Filter löschen“. Auf dem Handy weniger Spalten; die Tabelle nutzt am PC die ganze Breite. Läuft ohne Internet.
- **Neu: „Anzeigen:“** Alle, Heute, Letzte 7 Tage, Letzte 30 Tage oder eigener Zeitraum – für Zeitleiste und Tabelle. Die Überschrift zeigt den Zeitraum, z. B. „Notizen der letzten 7 Tage“.
- **Neu: Rubrik „Zeitpunkt“.** Tasten wie „vor 5 Min.“, „vor 1 Std.“, „heute Nacht“ oder „gestern Abend“ setzen die Zeit der Notiz sichtbar im Zeitfeld – gerechnet ab dem ersten Tippen, nicht ab dem Speichern. „heute Nacht“ und „gestern Abend“ setzen einen ungefähren Zeitraum (≈). Von Hand gesetzte Zeit wird nur nach einem Hinweis ersetzt. Zusätzlich wird festgehalten, wann notiert wurde („erfasst 14:32:10, Taste: vor 5 Min.“). Eigene Zeit-Tasten möglich. In Home Assistant: `select.greport_zeitpunkt`.
- **Neu: Notizen ohne Zeitpunkt** für allgemeine Notizen und Erinnerungen. Sie stehen als „ohne Zeitpunkt“ in der Liste, haben einen eigenen Filter und werden nicht an Störungen in GLighter gehängt.
- **Neu: Layout anpassen** (▦ im Erfassen-Bereich): Tasten und Rubriken direkt auf dem Bildschirm anlegen, umbenennen, einfärben, ausblenden, löschen und per Ziehen oder mit den Pfeiltasten verschieben, Bereiche anordnen, Überschrift und Hinweis ändern. „Fertig“ speichert, „Zurücksetzen“ stellt nach Rückfrage den Standard her. Eigene Rubriken erscheinen auch in Home Assistant.
- **Neu: Nachweis.** Jede Änderung an den Notizen wird mit Zeit, Zeitzone und vollständigem Inhalt in einem Änderungsprotokoll mit Prüfsummenkette festgehalten (nur angehängt). ⋯ → **Nachweis prüfen** rechnet nach und zeigt „Unverändert seit …“ oder genau, wo etwas abweicht. Geänderte Notizen zeigen „geändert am …“ mit Verlauf, gelöschte lassen sich aus dem Papierkorb wiederherstellen. Tagebuch und Exporte enthalten Erfassungszeit, „Zeit per Taste gesetzt“, „ungefähr“, „geändert“ und einen Prüfblock; dazu gibt es eine Nachweis-Datei zum Herunterladen. Die Sicherung enthält das Protokoll. Alles frei.
- **Neu: Zeugen mit Rolle und Erreichbarkeit** (Mitbewohner, Nachbar, Hausverwaltung, Vermieter, Polizei, Sonstige), auch in der Personenliste („Name; Rolle; Erreichbarkeit“). **Unter „Mehr“** (freiwillig): Häufigkeit, Polizei mit Vorgangsnummer, Meldung an Hausverwaltung oder Vermieter mit Datum, gesundheitliche Folgen oder Änderungen im Alltag, Vermerk zu einem Attest, „Drohung oder Gewalt“. Die Intensität kommt weiter aus „Wie stark“.
- **Neu: Bericht für Dritte** (⋯ → Nachweis prüfen, frei): ZIP mit Zusammenfassung nach Zeitpunkt, Art, Intensität, Dauer und Häufigkeit, Vorfällen mit Ereignis- und Erfassungszeit (spät notiert = sichtbar markiert), Zeugen mit Rolle und Erreichbarkeit, Polizei, Meldungen und Attesten, Zeitachse mit Tagen ohne Eintrag, Prüfblock, Rohdaten als CSV, Nachweis-Datei und den Anlagen. Dazu „Für Gewaltschutzantrag“: kompakt, Drohung und Gewalt zuerst.
- **Neu: Tipps** an den passenden Stellen (beim Notieren, Zeit-Tasten, Zeuge, Mehr, Verlauf, Export), mit „Warum?“ und Quelle, einzeln ausblendbar und unter „Datum und Uhrzeit“ ganz abschaltbar. Hilfe und Doku: „So hilft GReport bei der Dokumentation“ – keine Rechtsberatung.
- **Neu: Anlagen** (frei): 📎 hängt Dateien an eine Notiz (txt, pdf, jpg, png, heic, docx, odt, eml; auf dem Handy 📷 direkt mit der Kamera), je Datei mit Beschreibung. Gespeichert unverändert unter `/share/greport/anlagen/<jahr>/`, mit Prüfsumme (SHA-256) im Änderungsprotokoll; „Nachweis prüfen“ rechnet jede Datei nach. 📎 in Liste und Tabelle, Vorschau, Original herunterladen, Papierkorb statt Löschen. In Sicherung, Bericht und Exporten enthalten. Höchstens 25 MB je Datei und 500 MB zusammen (in der Konfiguration einstellbar).
- **Neu: Notizen aus Dokumenten vorschlagen:** GReport liest den Text offline (PDF, Word, Text-Dokument, E-Mail; Fotos und Scans mit Texterkennung), findet Datums- und Zeitangaben (z. B. „12.03.2025“, „12. März“, „gegen 23 Uhr“, „von 22 bis 1 Uhr“, „gestern Nacht“) und schlägt je Fundstelle eine Notiz vor – mit Satz, Seite und Zeile, Einstufung genau/ungefähr/unklar, passenden Wörtern und Zeugen. Doppelte sind markiert; angelegt wird erst mit „Übernehmen“. Übernommene Notizen tragen „aus Dokument erkannt“. Ansehen frei, Übernehmen mit Pro (wie der Import). Der erkannte Text liegt als eigene Datei daneben, das Original bleibt unverändert.
- **Nachweis:** nennt, ob die Uhr von Home Assistant mit einem Zeitserver (NTP) abgeglichen ist, soweit der Supervisor das meldet.
- **Sicherer:** Tagebuch und Exporte nur noch in `/share/greport/export` oder `/media/greport`, fremde Dateien werden nie überschrieben (sonst neuer Name), Import nur aus `/share/greport/import` und `/media`; ein alter Tagebuch-Pfad wird mit Hinweis umgestellt. CSV-Werte, die wie Formeln beginnen, werden entschärft. Notizen aus Home Assistant höchstens 1 je Sekunde und 500 am Tag. Ungültige Anfragen werden abgelehnt, hängende Verbindungen nach 30 Sekunden getrennt. In der Dashboard-Vorlage können Notiztext und Zeuge kein Markdown mehr einschleusen.
- Bestehende Notizen, Sicherungen und Einstellungen bleiben gültig; neue Angaben werden nur zusätzlich gespeichert.

## 1.8.0
- **Neu: Dashboard in Home Assistant mit einem Klick.** ⋯ → „Dashboard in Home Assistant“: Name, Adresse, Seitenleiste und Bereiche wählen (GReport-Karte oder einzelne Felder, letzte Notizen, Zähler „heute“, Knopf „GReport öffnen“), dann „In Home Assistant anlegen“. Ein vorhandenes Dashboard wird nur nach Rückfrage ersetzt. Die Vorlage gibt es auch als YAML zum Kopieren.
- **Barrierefreiheit:** bessere Kontraste bei grauem Text, alle Eingabefelder haben einen Namen für Screenreader, Statussymbole (🔗 🏠) werden vorgelesen, Meldungen nach dem Speichern werden angesagt, Menü mit Pfeiltasten bedienbar, größere Abschnitt- und Filterknöpfe, Seite mit Hauptbereich.
- **Handy:** Auf sehr schmalen Bildschirmen steht der Hinweis unter der Uhr statt in einer schmalen Spalte daneben.

## 1.7.1
- **Neu: Weitergabe an GLighter einstellbar.** Unter ⋯ → **GLighter** lässt sich „Notizen an GLighter weitergeben“ ein- und ausschalten (Standard: an). Aus: GLighter zeigt keine Notizen aus GReport mehr – an den Störungen, im Verlauf und im Lärmprotokoll. Die Notizen bleiben in GReport unverändert. Die Änderung gilt sofort. Das 🔗 oben zeigt, wenn die Weitergabe aus ist.
- Braucht GLighter ab 1.76.3. Ältere GLighter zeigen die Notizen weiterhin.

## 1.7.0
- **Behoben:** Tagebuch und Exporte enthalten wieder alle Notizen. Bisher waren es höchstens 5000, die ältesten fielen still weg.
- **Behoben:** Notizen während der Zeitumstellung (z. B. 25.10.2026 zwischen 2 und 3 Uhr) werden mit der richtigen Uhrzeit gespeichert. Die Oberfläche speichert jetzt immer mit Zeitzone, und beim Bearbeiten bleibt ein unverändertes Zeitfeld exakt erhalten.
- Freischaltung mit dem Schlüssel aus dem Shop unverändert.

## 1.6.3
- **Pro mit dem Schlüssel aus dem Shop:** Der Schlüssel aus der Kauf-E-Mail (GReport oder GLighter) funktioniert jetzt direkt. GReport prüft ihn beim Eintragen einmal online bei gsimulations.de und arbeitet danach wieder ohne Internet.

## 1.6.2
- **Eigene Karte „GReport“:** GReport bringt jetzt eine fertige Dashboard-Karte mit. Sie wird beim Start automatisch eingerichtet und steht danach unter „Karte hinzufügen“ → „Nach Karte“ → **GReport**. Darin: Notiz, alle Auswahllisten (Woher, Was, Wie stark …), Zeuge und „Speichern“, dazu „Notizen heute“ und „Letzte Notiz“. Funktioniert für alle Benutzer, auch ohne Administratorrechte – ohne Adresse und ohne Bastelei.
- **Eigener Bereich „GReport“:** Bei einer neuen Installation legt Home Assistant das Gerät gleich im Bereich „GReport“ an. In „Zum Dashboard hinzufügen“ → „Nach Entität“ stehen alle GReport-Felder damit unter **GReport**. (Bei bestehenden Installationen den Bereich einmal von Hand zuweisen: Einstellungen → Geräte → GReport → Bereich.)
- Dafür braucht GReport jetzt Schreibzugriff auf den Home-Assistant-Ordner `www/greport` (nur für die Kartendatei).

## 1.6.1
- Neues GReport-Logo und App-Symbol (im App-Store, in der App und als Browser-Symbol).

## 1.6.0
- **Notiz direkt im Dashboard:** Das Gerät „GReport“ in Home Assistant hat jetzt alles, was man für eine Notiz braucht: Textfeld „Notiz“, je Gruppe eine Auswahlliste (Woher, Was, Wie stark, Folgen, Maßnahmen, Sonstiges, Eigene – eigene Tasten kommen automatisch in ihre Gruppe), „Zeuge“ und den Knopf „Speichern“. Danach sind die Felder wieder leer.
- **Neue Sensoren:** „Letzte Notiz“ (mit den letzten 10 Notizen als Attribut, z. B. für eine eigene Notizen-Kachel) und „Notizen heute“.
- Damit funktioniert bei jedem Nutzer „Zu Dashboard hinzufügen“ auf der Geräteseite – ohne Adresse und ohne Bastelei. „Schnellwahl“ und „Hinzufügen“ bleiben für Automationen.

## 1.5.1
- Behoben: Die Abschnitte von „Notiz jetzt“ lassen sich wieder ein- und ausblenden, auch im abgedockten Fenster. Dafür gibt es oben eine schmale Leiste mit Textfeld, Schnellwahl, Zeuge und Zeitraum. Ein ausgeblendeter Abschnitt zeigt, wie viel darin gewählt ist. Der Zustand wird pro Browser gemerkt.
- Im abgedockten Fenster ziehen sich die Zeilen nicht mehr in die Höhe, wenn Abschnitte ausgeblendet sind.

## 1.5.0
- **Dezentere Tasten:** Jede Taste hat jetzt einen dünnen Rahmen in der Farbe ihrer Gruppe, der Punkt davor entfällt. Gewählte Tasten sind leicht in der Gruppenfarbe getönt. Die Marken in der Liste sehen genauso aus.
- **Neu (Pro), unter „Schnellwahl verwalten“:**
  - **Eigene Tasten höchstens:** frei einstellbar von 5 bis 200, Standard 40.
  - **Je Gruppe zeigen:** zum Beispiel nur die ersten 4 je Gruppe, der Rest steckt hinter „+2 mehr“. 0 heißt alle. Gewählte Tasten bleiben immer sichtbar.

## 1.4.0
- **Pflicht-Gruppen:** In „Schnellwahl verwalten“ lässt sich jede Gruppe als „Pflicht“ markieren, sie bekommt ein Sternchen. Sind in allen Pflicht-Gruppen Tasten gewählt, leuchten diese und „Speichern“ pulsierend auf („Alles Wichtige gewählt“). Das ist nur ein Hinweis, gespeichert wird immer. Wer weniger Bewegung eingestellt hat, sieht einen ruhigen Rand statt des Pulsierens.
- **Kleine Hilfe:** „?“ oben oder ⋯ → Hilfe. Kurz erklärt sind Notiz jetzt, Schnellwahl, Pflicht-Gruppen, Zeit, Liste, Home Assistant, GLighter, Textdatei und Pro.

## 1.3.0
- **Farbe pro Gruppe:** In „Schnellwahl verwalten“ hat jede Gruppe (Woher, Was, Wie stark …) neben der Überschrift ein Farbfeld. Die Farbe gilt für alle Wörter der Gruppe: in „Notiz jetzt“, in der Liste und bei den Filtern. Mit ↺ kommt die Standardfarbe zurück. Im dunklen Modus wird die Farbe etwas aufgehellt.

## 1.2.1
- Schnellwahl: Am PC und im abgedockten Fenster brechen die Tasten wieder in die nächste Zeile um, statt rechts abgeschnitten zu werden. Nur auf Handys mit Touch bleibt je Gruppe eine Zeile zum Wischen, mit einem Pfeil rechts, solange es weitergeht.

## 1.2.0
- **Neu (Pro): Tagebuch als Textdatei.** GReport führt eine gut lesbare Datei nach Tagen: je Tag eine Überschrift, darunter die Notizen nach Uhrzeit. Neue, geänderte und gelöschte Notizen werden sofort eingetragen, nachgetragene Notizen landen unter ihrem Tag.
  - Datei frei wählbar unter `/share` oder `/media`, z. B. auf einem Netzlaufwerk.
  - Format Text oder CSV, auf Wunsch eine Datei pro Monat.
  - Datum und Uhrzeit wie eingestellt.
- **Export in eine Datei** (Text, CSV oder JSON) direkt auf den Home-Assistant-Rechner, oder herunterladen.
- **Import aus Textdateien:** Text-Tagebuch, CSV und JSON, auch die eigenen Exporte. Vorher zeigt eine Vorschau, wie viele Notizen neu sind und wie viele schon vorhanden. Doppelte werden übersprungen, unbekannte Wörter als eigene angelegt.
- Alles unter ⋯ → **Textdatei & Import/Export**. Die ZIP-Sicherung bleibt frei.

## 1.1.0
- **Neues Erscheinungsbild.** Große Uhrzeit als Anker (sie wird mit der Notiz festgehalten). Die Schnellwahl ist nach Gruppen geordnet (Woher, Was, Wie stark, Folgen, Maßnahmen, Sonstiges, Eigene), jede mit eigener Farbe. Die Zeit ist eingeklappt („jetzt · Zeit ändern“), „Speichern“ steht in einer festen Leiste, am Handy unten am Bildschirm.
- Die Liste ist eine Zeitleiste nach Tagen („Heute“, „Gestern“, Datum), mit Filter nach Wörtern. Hell und dunkel, auch am Handy ohne Überbreite.
- **Schnellwahl verwalten** (⋯ → Schnellwahl verwalten, ＋ Eigene oder lange auf ein Wort drücken):
  - alle Wörter umbenennen, auch die eingebauten,
  - jedem Wort eine Gruppe geben,
  - die Reihenfolge selbst festlegen (ziehen oder ▲▼) oder nach Gebrauch,
  - Wörter zeigen oder ausblenden,
  - alles auf Standard zurücksetzen.
  - Die Auswahlliste „Schnellwahl“ in Home Assistant übernimmt Namen und Reihenfolge.
- **Datum und Uhrzeit einstellbar** (⋯ → Datum und Uhrzeit): 18.10.2026 · 18.10.26 · So. 18.10. · 2026-10-18 · 18. Okt. 2026, mit oder ohne Sekunden, 12 Stunden, Wochentag, „Heute/Gestern“. Gilt auch in der Export-Tabelle (CSV, zusätzlich mit genauer Zeit).
- „Quelle / Gerät“ entfällt. „läuft noch (bis = beim Speichern)“ bleibt.

## 1.0.1
- Behoben: Beim Öffnen in Home Assistant kam nur „forbidden“. Der Zugriff über Home Assistant wird jetzt auch über IPv6 erkannt.

## 1.0.0
- Erste Fassung: der Notiz-Teil von GLighter als eigene App.
- Notiz jetzt: Textfeld (Enter speichert), Schnellwahl mit eigenen Tasten (lernt mit, häufigste zuerst), Zeuge, Zeitraum von–bis, „läuft noch“, Notizbereich abdocken (⧉).
- Liste aller Notizen mit Suche, Ändern und Löschen.
- Home Assistant: jede neue Notiz im **Logbuch**, dazu (über MQTT) die Auswahlliste **„Schnellwahl“** und der Knopf **„Hinzufügen“**. In der Liste stehen dieselben Wörter wie in der App.
- Mit **GLighter (Pro)** automatisch verbunden: die Notizen erscheinen dort an den Störungen, im Verlauf und im Lärmprotokoll; „Quelle / Gerät“ zeigt dann die Geräte von GLighter.
- Pro (GReport- oder GLighter-Schlüssel): Export (CSV/JSON) und Import, bis zu 40 eigene Tasten (frei: 5), tägliche Sicherung (14 Tage), mehrere Zeugen. Die Sicherung als ZIP ist immer frei.
