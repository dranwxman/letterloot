#!/usr/bin/env python3
# patch_v316.py — LetterLoot v316 (2.0.1 train; DEBUG stays TRUE)
# ONE SWING replacing unapplied v314+v315 (v314 file never reached the repo; both numbers
# retired-unused per the burn rule). Applies directly on v313 state:
#   1. Share label "Word of the Day:" -> "WoD:" in all three share lines (Daryl, Sep 3).
#   2. Y-STEM RULE: accept root minus trailing Y, floor 5 (RASPBERRY -> RASPBERRI[ES]).
#      261/2,900 candidates in class; floor settled by selection facts (WoDs are 8-10).
# Run on a v313 source. Anchors: count==1, refuses on mismatch.
import sys, io

PATH = "src/App.jsx"
src = io.open(PATH, encoding="utf-8").read()

edits = [
  ('const DEBUG_MODE = true; // v313 dev cycle OPEN - WoD found-word arrow display (2.0.1 train). DO NOT PUSH while true.',
   'const DEBUG_MODE = true; // v316 dev cycle OPEN - WoD arrow + "WoD:" labels + Y-stem rule (2.0.1 train). DO NOT PUSH while true.'),
  ('    const wotdLine = wotdFoundDetails ? `\\n🎯 Word of the Day: ${wotd}${wotdArrow} — Found! Scored ${wotdFoundDetails.score} pts` : "";',
   '    const wotdLine = wotdFoundDetails ? `\\n🎯 WoD: ${wotd}${wotdArrow} — Found! Scored ${wotdFoundDetails.score} pts` : "";'),
  ('    const wotdLine = wotdFoundDetails\n      ? `\\n🎯 Word of the Day: ${wotd}${wotdArrow2} — Found! Scored ${wotdFoundDetails.score} pts`\n      : `\\n🎯 Word of the Day: not found today`;',
   '    const wotdLine = wotdFoundDetails\n      ? `\\n🎯 WoD: ${wotd}${wotdArrow2} — Found! Scored ${wotdFoundDetails.score} pts`\n      : `\\n🎯 WoD: not found today`;'),
  ('  if (root.endsWith("E") && root.length - 1 >= 5) out.push(root.slice(0, -1));',
   '  if (root.endsWith("E") && root.length - 1 >= 5) out.push(root.slice(0, -1));\n'
   '  // v316 (Y-stem, Sep 3): consonant-Y words mutate Y->I before suffixes (RASPBERRY ->\n'
   '  // RASPBERRIES, MYSTERY -> MYSTERIOUS), breaking containment same as the silent E did.\n'
   '  // Accept the root minus trailing Y, same floor. 261 of 2,900 candidates in this class.\n'
   '  if (root.endsWith("Y") && root.length - 1 >= 5) out.push(root.slice(0, -1));'),
]

for i, (old, new) in enumerate(edits, 1):
    n = src.count(old)
    if n != 1:
        sys.exit(f"REFUSED: anchor {i} matched {n} times (expected 1). Nothing written. (Anchors expect a v313 source.)")

for old, new in edits:
    src = src.replace(old, new, 1)

io.open(PATH, "w", encoding="utf-8").write(src)
print("v316 applied OK")
