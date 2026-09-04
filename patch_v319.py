#!/usr/bin/env python3
# patch_v319.py — LetterLoot v319 (2.0.1 train; DEBUG stays TRUE)
# ONE SWING replacing unapplied v317+v318 (download cards failed to render; both numbers
# retired per the burn rule). Applies directly on a v316 source:
#   1. RELAUNCH FIX: the reset/re-sync path (v300's old fix site) rebuilds wotdFoundDetails
#      without the word field — carry foundWord through so the card arrow survives relaunch.
#   2. WoD ARROW on the first-PD modal, repeat-PD modal, and Today's Summary card
#      (RASPBERRY\u2192RASPBERRIES — L4, 99 pts). Exact finds unchanged everywhere.
# Anchors: count==1, refuses on mismatch.
import sys, io

PATH = "src/App.jsx"
src = io.open(PATH, encoding="utf-8").read()

edits = [
  ('const DEBUG_MODE = true; // v316 dev cycle OPEN - WoD arrow + "WoD:" labels + Y-stem rule (2.0.1 train). DO NOT PUSH while true.',
   'const DEBUG_MODE = true; // v319 dev cycle OPEN - WoD arrow relaunch fix + PD/summary surfaces (2.0.1 train). DO NOT PUSH while true.'),
  ('          // v300: include foundBonus — without it a relaunch showed "+1,000" for a grown find.\n          setWotdFoundDetails({ level: cachedWotd.foundLevel, score: cachedWotd.foundScore, bonus: cachedWotd.foundBonus || 1000 });',
   '          // v300: include foundBonus — without it a relaunch showed "+1,000" for a grown find.\n          // v317: include foundWord too — same bug, one field over. Without it a relaunch\n          // dropped the v313 arrow (card fell back to "You found it!").\n          setWotdFoundDetails({ level: cachedWotd.foundLevel, score: cachedWotd.foundScore, bonus: cachedWotd.foundBonus || 1000, word: cachedWotd.foundWord || null });'),
  ('Score: {totalScore} pts · 💰 Lifetime: {lifetimePoints.toLocaleString()} pts</div>\n          </div>\n          {wotdFoundDetails && (\n            <div style={{marginTop:8,background:"linear-gradient(135deg,rgba(167,139,250,0.18),rgba(167,139,250,0.06))",border:"1.5px solid rgba(167,139,250,0.5)",borderRadius:12,padding:"10px",fontSize:ipadTour(12),color:"#f5f0e8",lineHeight:1.5,textAlign:"center"}}>\n              <span style={{fontSize:ipadTour(11),color:"#a78bfa",letterSpacing:2,fontWeight:"bold"}}>🎯 WORD OF THE DAY</span><br/>\n              <strong style={{color:"#f6d365"}}>{wotd}</strong> — L{wotdFoundDetails.level}, {wotdFoundDetails.score} pts',
   'Score: {totalScore} pts · 💰 Lifetime: {lifetimePoints.toLocaleString()} pts</div>\n          </div>\n          {wotdFoundDetails && (\n            <div style={{marginTop:8,background:"linear-gradient(135deg,rgba(167,139,250,0.18),rgba(167,139,250,0.06))",border:"1.5px solid rgba(167,139,250,0.5)",borderRadius:12,padding:"10px",fontSize:ipadTour(12),color:"#f5f0e8",lineHeight:1.5,textAlign:"center"}}>\n              <span style={{fontSize:ipadTour(11),color:"#a78bfa",letterSpacing:2,fontWeight:"bold"}}>🎯 WORD OF THE DAY</span><br/>\n              <strong style={{color:"#f6d365"}}>{wotd}{wotdFoundDetails.word && wotdFoundDetails.word.toUpperCase() !== wotd.toUpperCase() ? "→" + wotdFoundDetails.word.toUpperCase() : ""}</strong> — L{wotdFoundDetails.level}, {wotdFoundDetails.score} pts'),
  ('{wotdFoundDetails ? <><strong style={{color:"#f6d365"}}>{wotd}</strong> — L{wotdFoundDetails.level}, {wotdFoundDetails.score} pts</>',
   '{wotdFoundDetails ? <><strong style={{color:"#f6d365"}}>{wotd}{wotdFoundDetails.word && wotdFoundDetails.word.toUpperCase() !== wotd.toUpperCase() ? "→" + wotdFoundDetails.word.toUpperCase() : ""}</strong> — L{wotdFoundDetails.level}, {wotdFoundDetails.score} pts</>'),
  ('Score: {totalRef.current} pts<br/>\n            💰 Lifetime: {lifetimePoints.toLocaleString()} pts\n          </div>\n          {wotdFoundDetails && (\n            <div style={{marginTop:8,background:"linear-gradient(135deg,rgba(167,139,250,0.18),rgba(167,139,250,0.06))",border:"1.5px solid rgba(167,139,250,0.5)",borderRadius:12,padding:"10px",fontSize:ipadTour(12),color:"#f5f0e8",lineHeight:1.5,textAlign:"center"}}>\n              <span style={{fontSize:ipadTour(11),color:"#a78bfa",letterSpacing:2,fontWeight:"bold"}}>🎯 WORD OF THE DAY</span><br/>\n              <strong style={{color:"#f6d365"}}>{wotd}</strong> — L{wotdFoundDetails.level}, {wotdFoundDetails.score} pts',
   'Score: {totalRef.current} pts<br/>\n            💰 Lifetime: {lifetimePoints.toLocaleString()} pts\n          </div>\n          {wotdFoundDetails && (\n            <div style={{marginTop:8,background:"linear-gradient(135deg,rgba(167,139,250,0.18),rgba(167,139,250,0.06))",border:"1.5px solid rgba(167,139,250,0.5)",borderRadius:12,padding:"10px",fontSize:ipadTour(12),color:"#f5f0e8",lineHeight:1.5,textAlign:"center"}}>\n              <span style={{fontSize:ipadTour(11),color:"#a78bfa",letterSpacing:2,fontWeight:"bold"}}>🎯 WORD OF THE DAY</span><br/>\n              <strong style={{color:"#f6d365"}}>{wotd}{wotdFoundDetails.word && wotdFoundDetails.word.toUpperCase() !== wotd.toUpperCase() ? "→" + wotdFoundDetails.word.toUpperCase() : ""}</strong> — L{wotdFoundDetails.level}, {wotdFoundDetails.score} pts'),
]

for i, (old, new) in enumerate(edits, 1):
    n = src.count(old)
    if n != 1:
        sys.exit(f"REFUSED: anchor {i} matched {n} times (expected 1). Nothing written. (Anchors expect a v316 source.)")

for old, new in edits:
    src = src.replace(old, new, 1)

io.open(PATH, "w", encoding="utf-8").write(src)
print("v319 applied OK")
