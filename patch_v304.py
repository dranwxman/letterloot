#!/usr/bin/env python3
# v304 (Aug 30): 1.8 What's New surfaces — key ll_whatsnew_v17_seen -> v18; featured card =
# Malleable Word of the Day; second card = Today's Summary & My Flourishes; Spyglass + Flourish
# Leaderboard move to the "Still worth knowing" recap. Same copy on the Ready-screen popup and
# the Tour "Latest Updates" page. Copy approved by Daryl Aug 30.
import sys
P = "src/App.jsx"
s = open(P).read()

def rep(old, new, label, count=1):
    global s
    n = s.count(old)
    if n != count:
        print(f"ABORT: anchor '{label}' found {n} times (expected {count}). No changes written."); sys.exit(1)
    s = s.replace(old, new)

rep("const DEBUG_MODE = true; // v303 dev cycle OPEN",
    "const DEBUG_MODE = true; // v304 dev cycle OPEN", "version marker")

# --- key bump (2 code sites + 1 comment) ---
rep('    try { return localStorage.getItem("ll_whatsnew_v17_seen") !== "1"; } catch { return false; }',
    '    try { return localStorage.getItem("ll_whatsnew_v18_seen") !== "1"; } catch { return false; } // v304: 1.8 key',
    "key read")
rep('    try { localStorage.setItem("ll_whatsnew_v17_seen", "1"); } catch {}',
    '    try { localStorage.setItem("ll_whatsnew_v18_seen", "1"); } catch {}',
    "key write")
rep("(gated by the ll_whatsnew_v17_seen flag on the Ready screen)",
    "(gated by the ll_whatsnew_v18_seen flag on the Ready screen)", "key comment")

# --- shared copy ---
WOD_TITLE = "Malleable Word of the Day"
WOD_BODY  = "The Word of the Day now bends to yer will. Any word that carries the WoD's root — SURPRISING, UNSURPRISED, SURPRISES for SURPRISED — counts as found, so long as it's at least as long as the listed word. Grow it and the bonus grows too: <strong style={{color:'#f6d365'}}>1,000 pts plus 200 for every extra letter</strong>."
SUM_TITLE = "Today's Summary & My Flourishes"
SUM_BODY  = "Every game now ends with a <strong style={{color:'#c4b5fd'}}>Today's Summary</strong> card — Perfect Day and streak, yer Finishing Flourishes, Word of the Day, and total time — with Leaderboard, Share, and Play Again right there. And under Stats, a new <strong style={{color:'#c4b5fd'}}>My Flourishes</strong> log keeps every board-clearing word you've ever flourished, by day and level."
RECAP_SPY = "🔭 <strong style={{color:\"#7cc4ff\"}}>The Spyglass</strong> — tap SCOUT beside yer built word to check it before committing; the clock keeps runnin'."
RECAP_FLB = "🏴‍☠️ <strong style={{color:\"#c4b5fd\"}}>Flourish Leaderboard</strong> — the longest board-clearing Flourish words across all Looters."

# --- Ready-screen popup ---
rep('Fresh treasure in v1.7', 'Fresh treasure in v1.8', "popup header")
rep("          {/* v293: FEATURED Spyglass card (1.7) — gold box, bold red title, Daryl's ruling A. */}\n",
    "          {/* v304: FEATURED Malleable WoD card (1.8) — gold box, bold red title. */}\n", "popup featured comment")
rep('              <span style={{fontSize:ipadIntro(24)}}>🔭</span>\n              <span style={{fontSize:ipadIntro(21),color:"#ff4444",fontWeight:"bold",textShadow:"0 0 10px rgba(255,68,68,0.45)"}}>The Spyglass</span>\n',
    '              <span style={{fontSize:ipadIntro(24)}}>🎯</span>\n              <span style={{fontSize:ipadIntro(21),color:"#ff4444",fontWeight:"bold",textShadow:"0 0 10px rgba(255,68,68,0.45)"}}>' + WOD_TITLE + '</span>\n',
    "popup featured title")
rep('            <div style={{fontSize:ipadIntro(17.5),color:"rgba(245,240,232,0.98)",lineHeight:1.6}}>Not sure a word\'s in the LL dictionary? Tap the blue <strong style={{color:\'#7cc4ff\'}}>🔭 SCOUT</strong> chip beside yer built word to check it — without committing yer tiles. The clock keeps runnin\', so certainty costs time, matey!</div>\n',
    '            <div style={{fontSize:ipadIntro(17.5),color:"rgba(245,240,232,0.98)",lineHeight:1.6}}>' + WOD_BODY + '</div>\n',
    "popup featured body")
rep("          {/* v293: second card — Flourish Leaderboard (1.7). Slightly smaller than the featured card. */}\n",
    "          {/* v304: second card — Today's Summary & My Flourishes (1.8). */}\n", "popup second comment")
rep('              <span style={{fontSize:ipadIntro(20)}}>🏴‍☠️</span>\n              <span style={{fontSize:ipadIntro(18),color:"#c4b5fd",fontWeight:"bold"}}>Flourish Leaderboard</span>\n',
    '              <span style={{fontSize:ipadIntro(20)}}>📊</span>\n              <span style={{fontSize:ipadIntro(18),color:"#c4b5fd",fontWeight:"bold"}}>' + SUM_TITLE + '</span>\n',
    "popup second title")
rep('            <div style={{fontSize:ipadIntro(15.5),color:"rgba(245,240,232,0.95)",lineHeight:1.55}}>New leaderboard tab: the longest board-clearing Finishing Flourish words, across all Looters. Registered players only — and the board starts fresh from 1.7, so get yer name up there first!</div>\n',
    '            <div style={{fontSize:ipadIntro(15.5),color:"rgba(245,240,232,0.95)",lineHeight:1.55}}>' + SUM_BODY + '</div>\n',
    "popup second body")
rep('            <div style={{fontSize:ipadIntro(17),color:"rgba(245,240,232,0.92)",lineHeight:1.6}}>🦜 <strong style={{color:"#ff4444"}}>Finishing Flourish Bonus</strong>',
    '            <div style={{fontSize:ipadIntro(17),color:"rgba(245,240,232,0.92)",lineHeight:1.6}}>' + RECAP_SPY + '</div>\n'
    '            <div style={{fontSize:ipadIntro(17),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:ipadIntro(9)}}>' + RECAP_FLB + '</div>\n'
    '            <div style={{fontSize:ipadIntro(17),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:ipadIntro(9)}}>🦜 <strong style={{color:"#ff4444"}}>Finishing Flourish Bonus</strong>',
    "popup recap")

# --- Tour "Latest Updates" page ---
rep("📢 What's New in v1.7", "📢 What's New in v1.8", "tour header")
rep("            {/* v293: FEATURED Spyglass (1.7). */}\n", "            {/* v304: FEATURED Malleable WoD (1.8). */}\n", "tour featured comment")
rep('                <span style={{fontSize:uT(24)}}>🔭</span>\n                <span style={{fontSize:uT(21),color:"#ff4444",fontWeight:"bold",textShadow:"0 0 10px rgba(255,68,68,0.45)"}}>The Spyglass</span>\n',
    '                <span style={{fontSize:uT(24)}}>🎯</span>\n                <span style={{fontSize:uT(21),color:"#ff4444",fontWeight:"bold",textShadow:"0 0 10px rgba(255,68,68,0.45)"}}>' + WOD_TITLE + '</span>\n',
    "tour featured title")
rep('              <div style={{fontSize:uT(17.5),color:"rgba(245,240,232,0.98)",lineHeight:1.6}}>Not sure a word\'s in the LL dictionary? Tap the blue <strong style={{color:\'#7cc4ff\'}}>🔭 SCOUT</strong> chip beside yer built word to check it — without committing yer tiles. The clock keeps runnin\', so certainty costs time, matey!</div>\n',
    '              <div style={{fontSize:uT(17.5),color:"rgba(245,240,232,0.98)",lineHeight:1.6}}>' + WOD_BODY + '</div>\n',
    "tour featured body")
rep("            {/* v293: Flourish Leaderboard card (1.7). */}\n", "            {/* v304: Today's Summary & My Flourishes card (1.8). */}\n", "tour second comment")
rep('                <span style={{fontSize:uT(20)}}>🏴‍☠️</span>\n                <span style={{fontSize:uT(18),color:"#c4b5fd",fontWeight:"bold"}}>Flourish Leaderboard</span>\n',
    '                <span style={{fontSize:uT(20)}}>📊</span>\n                <span style={{fontSize:uT(18),color:"#c4b5fd",fontWeight:"bold"}}>' + SUM_TITLE + '</span>\n',
    "tour second title")
rep('              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.95)",lineHeight:1.55}}>New leaderboard tab: the longest board-clearing Finishing Flourish words, across all Looters. Registered players only — and the board starts fresh from 1.7, so get yer name up there first!</div>\n',
    '              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.95)",lineHeight:1.55}}>' + SUM_BODY + '</div>\n',
    "tour second body")
rep('              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.92)",lineHeight:1.6}}>🦜 <strong style={{color:"#ff4444"}}>Finishing Flourish Bonus</strong>',
    '              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.92)",lineHeight:1.6}}>' + RECAP_SPY + '</div>\n'
    '              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:uT(7)}}>' + RECAP_FLB + '</div>\n'
    '              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:uT(7)}}>🦜 <strong style={{color:"#ff4444"}}>Finishing Flourish Bonus</strong>',
    "tour recap")

open(P, "w").write(s)
print("v304 applied OK")
