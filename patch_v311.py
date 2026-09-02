#!/usr/bin/env python3
# patch_v311.py — LetterLoot v311 (web-beta wire-up)
# Puts Spyglass Open Search in front of the Beta-Looters on Vercel: DEBUG -> FALSE so the
# live web app is clean, APP_VERSION -> "1.9.1 (311)" so testers can confirm their build
# from the version line. 2.0 App Store ship waits on their feedback.
# Anchors: count==1 each, refuses to write on any mismatch.
import sys, io

PATH = "src/App.jsx"
src = io.open(PATH, encoding="utf-8").read()

edits = [
  ('const DEBUG_MODE = true; // v310 dev cycle OPEN - Spyglass Open Search + WoD verdict (2.0 feature)',
   'const DEBUG_MODE = false; // v311 web-beta: Spyglass Open Search live for Beta-Looters (2.0 ship pending feedback)'),
  ('const APP_VERSION = "1.9.1 (309)";',
   'const APP_VERSION = "1.9.1 (311)";'),
]

for i, (old, new) in enumerate(edits, 1):
    n = src.count(old)
    if n != 1:
        sys.exit(f"REFUSED: anchor {i} matched {n} times (expected 1). Nothing written.")

for old, new in edits:
    src = src.replace(old, new, 1)

io.open(PATH, "w", encoding="utf-8").write(src)
print("v311 applied OK")
