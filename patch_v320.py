#!/usr/bin/env python3
# patch_v320.py — LetterLoot v320 (2.0.1 train; DEBUG stays TRUE)
# WoD CELEBRATION ARROW (Daryl ruled A, Sep 3): show the word pair on the pirate card —
# gold line above the saying, inside the contrast band. ONLY when the played word differs
# from the listed WoD (RASPBERRY→RASPBERRIES). Exact finds keep the July 9 "pirate and one
# line, nothing else" ruling — the malleable WoD is what changed the calculus for grown
# finds: the pair is new information, not an echo.
# Data: wotdFoundDetails (set in the same award block that enqueues the celebration).
# Run AFTER patch_v319.py. Anchors: count==1, refuses on mismatch.
import sys, io

PATH = "src/App.jsx"
src = io.open(PATH, encoding="utf-8").read()

edits = [
  ('const DEBUG_MODE = true; // v319 dev cycle OPEN - WoD arrow relaunch fix + PD/summary surfaces (2.0.1 train). DO NOT PUSH while true.',
   'const DEBUG_MODE = true; // v320 dev cycle OPEN - WoD celebration arrow line (2.0.1 train). DO NOT PUSH while true.'),
  ('            <div style={{marginTop:ipadIntro(14),background:"rgba(0,0,0,0.22)",borderRadius:14,padding:`${ipadIntro(10)}px ${ipadIntro(12)}px`}}>\n              <div style={{fontSize:ipadIntro(15),color:"#fdf6e3",fontStyle:"italic",fontWeight:"bold",lineHeight:1.45}}>{pickWotdSaying(',
   '            <div style={{marginTop:ipadIntro(14),background:"rgba(0,0,0,0.22)",borderRadius:14,padding:`${ipadIntro(10)}px ${ipadIntro(12)}px`}}>\n'
   '              {/* v320 (Daryl ruled A, Sep 3 — amends his July 9 "nothing else" ruling for GROWN\n'
   '                  finds only): the malleable WoD means the played word can differ from the listed\n'
   '                  one, so the pair is information, not an echo. Exact finds render nothing here. */}\n'
   '              {wotd && wotdFoundDetails && wotdFoundDetails.word && wotdFoundDetails.word.toUpperCase() !== wotd.toUpperCase() &&\n'
   '                <div style={{fontSize:ipadIntro(17),color:"#f6d365",fontWeight:"bold",letterSpacing:1.5,marginBottom:ipadIntro(6)}}>{wotd}→{wotdFoundDetails.word.toUpperCase()}</div>}\n'
   '              <div style={{fontSize:ipadIntro(15),color:"#fdf6e3",fontStyle:"italic",fontWeight:"bold",lineHeight:1.45}}>{pickWotdSaying('),
]

for i, (old, new) in enumerate(edits, 1):
    n = src.count(old)
    if n != 1:
        sys.exit(f"REFUSED: anchor {i} matched {n} times (expected 1). Nothing written. (Anchors expect v319 applied first.)")

for old, new in edits:
    src = src.replace(old, new, 1)

io.open(PATH, "w", encoding="utf-8").write(src)
print("v320 applied OK")
