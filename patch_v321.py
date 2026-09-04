#!/usr/bin/env python3
# patch_v321.py — LetterLoot v321 (2.0.1 train; DEBUG stays TRUE)
# SPYGLASS WoD HIT CALLOUT (Daryl ruled A, Sep 3): the hit line was camouflaged — same
# size/weight as the green "Accepted" line one row up. The biggest single discovery in the
# game now gets the app's WoD visual identity: purple-gradient box, gold border, soft glow,
# caps, larger type. ONLY the HIT line changes — "already claimed" and "not quite" stay
# quiet on purpose (information, not celebration).
# Run AFTER patch_v320.py. Anchors: count==1, refuses on mismatch.
import sys, io

PATH = "src/App.jsx"
src = io.open(PATH, encoding="utf-8").read()

edits = [
  ('const DEBUG_MODE = true; // v320 dev cycle OPEN - WoD celebration arrow line (2.0.1 train). DO NOT PUSH while true.',
   'const DEBUG_MODE = true; // v321 dev cycle OPEN - Spyglass WoD hit callout box (2.0.1 train). DO NOT PUSH while true.'),
  ('''            if (isWotdMatch(P, W)) return wotdFound
              ? <div style={{fontSize:ipadTour(13),fontWeight:"bold",color:"#f6d365",marginBottom:12}}>Today's Word of the Day is already claimed.</div>
              : <div style={{fontSize:ipadTour(13),fontWeight:"bold",color:"#f6d365",marginBottom:12}}>🎯 That's today's Word of the Day.</div>;''',
   '''            if (isWotdMatch(P, W)) return wotdFound
              ? <div style={{fontSize:ipadTour(13),fontWeight:"bold",color:"#f6d365",marginBottom:12}}>Today's Word of the Day is already claimed.</div>
              /* v321 (Daryl ruled A, Sep 3): the HIT gets the WoD visual identity — it was
                 camouflaged next to the Accepted line. Claimed/near-miss stay quiet. */
              : <div style={{background:"linear-gradient(135deg,rgba(167,139,250,0.35),rgba(124,58,237,0.28))",border:"2px solid #f6d365",borderRadius:14,padding:`${ipadTour(12)}px ${ipadTour(14)}px`,marginBottom:12,boxShadow:"0 0 24px rgba(246,211,101,0.45)"}}>
                  <div style={{fontSize:ipadTour(16),fontWeight:"bold",color:"#f6d365",letterSpacing:1.5,lineHeight:1.4}}>🎯 THAT'S TODAY'S WORD OF THE DAY!</div>
                </div>;'''),
]

for i, (old, new) in enumerate(edits, 1):
    n = src.count(old)
    if n != 1:
        sys.exit(f"REFUSED: anchor {i} matched {n} times (expected 1). Nothing written. (Anchors expect v320 applied first.)")

for old, new in edits:
    src = src.replace(old, new, 1)

io.open(PATH, "w", encoding="utf-8").write(src)
print("v321 applied OK")
