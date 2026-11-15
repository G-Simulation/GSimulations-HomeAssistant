#!/usr/bin/env python3
"""Gemeinsame Dateien von GReport nach GLighter kopieren.

GReport ist die Quelle für die gemeinsame Oberfläche: geändert wird nur unter greport/app/…, dieses Skript kopiert die Dateien
unverändert nach gaslighter/app/… (jedes Add-on hat seinen eigenen Docker-Build-Kontext, die Dateien müssen also wirklich in beiden
Ordnern liegen). Die Tests test_gemeinsam.py in beiden Apps schlagen fehl, solange die Kopien abweichen.

Aufruf (im Repo):  python3 tools/sync_shared.py          kopieren
                   python3 tools/sync_shared.py --check  nur prüfen (Rückgabe 1, wenn etwas abweicht)
"""
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "greport", "app")
DST = os.path.join(ROOT, "gaslighter", "app")
# relative Pfade unter app/ – gleich in beiden Apps
SHARED = ["web/erfassung.js", "web/erfassung.css", "web/felder.js", "felder.py"]


def differs(rel):
    a, b = os.path.join(SRC, rel), os.path.join(DST, rel)
    if not os.path.exists(b):
        return True
    with open(a, "rb") as x, open(b, "rb") as y:
        return x.read() != y.read()


def main(argv):
    check = "--check" in argv
    bad = [rel for rel in SHARED if differs(rel)]
    if check:
        for rel in bad:
            print("weicht ab:", rel)
        print("gleich" if not bad else "%d Datei(en) weichen ab – python3 tools/sync_shared.py" % len(bad))
        return 1 if bad else 0
    for rel in bad:
        shutil.copyfile(os.path.join(SRC, rel), os.path.join(DST, rel))
        print("kopiert:", rel)
    if not bad:
        print("alles gleich")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
