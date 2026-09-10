#!/usr/bin/env python3
# patch_v315.py — LetterLoot v315 (2.0.1 train; DEBUG stays TRUE)
# Y-STEM RULE (phone session Sep 3, Item 1; floor settled by selection facts: WoDs are
# effectively always 8-10 letters, so floor 5 costs nothing).
# Symmetric to the v307 silent-E rule: accept root minus trailing Y (floor 5), so
# consonant-Y WoDs match their mutated forms (RASPBERRY -> RASPBERRI[ES], MYSTERY ->
# MYSTERI[OUS]). 261 candidate words in this class — second-largest after silent-E.
# Deliberately liberal per Daryl's settled looseness ruling; errors run player's favor.
# Run AFTER patch_v314.py. Anchors: count==1, refuses on mismatch.
import sys, io

PATH = "src/App.jsx"
src = io.open(PATH, encoding="utf-8").read()

edits = [
  ('const DEBUG_MODE = true; // v314 dev cycle OPEN - WoD arrow display + "WoD:" share label (2.0.1 train). DO NOT PUSH while true.',
   'const DEBUG_MODE = true; // v315 dev cycle OPEN - WoD arrow + Y-stem rule (2.0.1 train). DO NOT PUSH while true.'),
  ('  if (root.endsWith("E") && root.length - 1 >= 5) out.push(root.slice(0, -1));',
   '  if (root.endsWith("E") && root.length - 1 >= 5) out.push(root.slice(0, -1));\n'
   '  // v315 (Y-stem, Sep 3): consonant-Y words mutate Y->I before suffixes (RASPBERRY ->\n'
   '  // RASPBERRIES, MYSTERY -> MYSTERIOUS), breaking containment same as the silent E did.\n'
   '  // Accept the root minus trailing Y, same floor. 261 of 2,900 candidates in this class.\n'
   '  if (root.endsWith("Y") && root.length - 1 >= 5) out.push(root.slice(0, -1));'),
]

for i, (old, new) in enumerate(edits, 1):
    n = src.count(old)
    if n != 1:
        sys.exit(f"REFUSED: anchor {i} matched {n} times (expected 1). Nothing written. (Anchors expect v314 applied first.)")

for old, new in edits:
    src = src.replace(old, new, 1)

io.open(PATH, "w", encoding="utf-8").write(src)
print("v315 applied OK")
