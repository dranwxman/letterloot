#!/usr/bin/env python3
# patch_v312.py — LetterLoot v312 (correction to v311, Daryl's ruling)
# The web-beta version line must read 2.0 — this IS the 2.0 feature. "1.9.1 (311)" -> "2.0 (312)".
# Applies ON TOP of v311 (run patch_v311.py first if you haven't). Refuses on any anchor miss.
import sys, io

PATH = "src/App.jsx"
src = io.open(PATH, encoding="utf-8").read()

edits = [
  ('const DEBUG_MODE = false; // v311 web-beta: Spyglass Open Search live for Beta-Looters (2.0 ship pending feedback)',
   'const DEBUG_MODE = false; // v312 web-beta: Spyglass Open Search live for Beta-Looters; version line reads 2.0 (App Store ship pending feedback)'),
  ('const APP_VERSION = "1.9.1 (311)";',
   'const APP_VERSION = "2.0 (312)";'),
]

for i, (old, new) in enumerate(edits, 1):
    n = src.count(old)
    if n != 1:
        sys.exit(f"REFUSED: anchor {i} matched {n} times (expected 1). Nothing written. (If this is anchor 1 or 2, check that patch_v311.py ran first.)")

for old, new in edits:
    src = src.replace(old, new, 1)

io.open(PATH, "w", encoding="utf-8").write(src)
print("v312 applied OK")
