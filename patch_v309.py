#!/usr/bin/env python3
# patch_v309.py — LetterLoot v309 (1.9.1 ship patch)
# Version line onto the Welcome screen (Daryl ruled C: BOTH under the tagline AND as a
# footer below the WoD card). The v308 Menu line stays. APP_VERSION -> "1.9.1 (309)".
# Anchors are string-based, must match EXACTLY ONCE, refuses to write on any mismatch.
import sys, io

PATH = "src/App.jsx"
src = io.open(PATH, encoding="utf-8").read()

if "const DEBUG_MODE = false;" not in src:
    sys.exit("REFUSED: DEBUG_MODE is not false in src/App.jsx — ship patch will not apply.")

edits = [
  # 1. dev-cycle marker
  ('const DEBUG_MODE = false; // v308 dev cycle OPEN - in-app version line (1.9.1 ship patch)',
   'const DEBUG_MODE = false; // v309 dev cycle OPEN - version line on Welcome screen (1.9.1 ship patch)'),

  # 2. bump APP_VERSION
  ('const APP_VERSION = "1.9.1 (308)";',
   'const APP_VERSION = "1.9.1 (309)";'),

  # 3. Placement A — directly under the Welcome-screen tagline
  ('        <div style={{fontSize:ipadIntro(12),color:"rgba(255,255,255,0.6)",marginTop:6,letterSpacing:1}}>Daily word puzzle · Every letter has a value</div>\n',
   '        <div style={{fontSize:ipadIntro(12),color:"rgba(255,255,255,0.6)",marginTop:6,letterSpacing:1}}>Daily word puzzle · Every letter has a value</div>\n'
   '        {/* v309: version line, Welcome screen placement A. Zero taps, first view on every\n'
   '            device, guests included. The in-game Menu line (v308) covers mid-game returns. */}\n'
   '        <div style={{fontSize:ipadIntro(10),color:"rgba(255,255,255,0.38)",marginTop:4,letterSpacing:0.5,fontFamily:"Georgia,serif"}}>LetterLoot {APP_VERSION}</div>\n'),

  # 4. Placement B — footer below the WoD card, last item in the centered column
  ('      </div>\n      {/* v98 fix: delete-account modal duplicated into the Welcome (showIntro) branch.',
   '        {/* v309: version line, Welcome screen placement B (footer under the WoD card). */}\n'
   '        <div style={{marginTop:14,fontSize:ipadIntro(10),color:"rgba(255,255,255,0.38)",letterSpacing:0.5,fontFamily:"Georgia,serif"}}>LetterLoot {APP_VERSION}</div>\n'
   '      </div>\n      {/* v98 fix: delete-account modal duplicated into the Welcome (showIntro) branch.'),
]

for i, (old, new) in enumerate(edits, 1):
    n = src.count(old)
    if n != 1:
        sys.exit(f"REFUSED: anchor {i} matched {n} times (expected 1). Nothing written.")

for old, new in edits:
    src = src.replace(old, new, 1)

io.open(PATH, "w", encoding="utf-8").write(src)
print("v309 applied OK")
