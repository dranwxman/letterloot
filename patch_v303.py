#!/usr/bin/env python3
# v303 (Aug 29): Today's Summary buttons — Daryl's option B.
#   Continue → replaced by 🏆 Leaderboard · 📋 Share · ✏️ Play Now · 🌅 Later.
#   The PD / repeat-PD modals keep their own buttons; the summary re-asks so the player can
#   change their mind after reading it. Share picks the PD or day-results text automatically.
import sys
P = "src/App.jsx"
s = open(P).read()

def rep(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        print(f"ABORT: anchor '{label}' found {n} times (expected 1). No changes written."); sys.exit(1)
    s = s.replace(old, new)

rep("const DEBUG_MODE = true; // v302 dev cycle OPEN",
    "const DEBUG_MODE = true; // v303 dev cycle OPEN", "version marker")

# closeDaySummary now takes the action explicitly (afterSummaryRef kept only as the default for legacy callers)
rep("  const closeDaySummary = useCallback(() => {\n"
    "    setShowDaySummary(false);\n"
    "    const next = afterSummaryRef.current; afterSummaryRef.current = \"farewell\";\n",
    "  const closeDaySummary = useCallback((choice) => {\n"
    "    setShowDaySummary(false);\n"
    "    const next = choice || afterSummaryRef.current; afterSummaryRef.current = \"farewell\"; // v303: button passes its own choice\n",
    "closeDaySummary signature")

# button row
rep('            <button className="ll-btn" onClick={closeDaySummary} style={{marginTop:14,width:"100%",padding:ipadTour(13),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(14),fontWeight:"bold",border:"none"}}>Continue →</button>\n',
    '''            {/* v303 (option B): Leaderboard · Share · Play Now · Later */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:14}}>
              <button className="ll-btn" onClick={()=>{
                if (isGuest) { setShowDaySummary(false); setShowGuestUpsell(true); return; }
                setShowDaySummary(false); setLeaderboardFromPerfectDay(true); setLevelComplete(false); setTab('leaderboard');
              }} style={{padding:`${ipadTour(11)}px ${ipadTour(6)}px`,borderRadius:12,background:isGuest?"rgba(255,255,255,0.04)":"rgba(246,211,101,0.18)",border:isGuest?"1px solid rgba(255,255,255,0.15)":"1px solid rgba(246,211,101,0.6)",color:isGuest?"rgba(255,255,255,0.5)":"#fef3c7",fontSize:ipadTour(12),fontWeight:"bold",fontFamily:"Georgia,serif",cursor:"pointer"}}>
                {isGuest?<span><span style={{filter:"grayscale(0.6)",opacity:0.55}}>🏆</span> Leaderboard <span style={{color:"rgba(167,139,250,0.85)"}}>🔒</span></span>:"🏆 Leaderboard"}
              </button>
              <button className="ll-btn" onClick={()=>{ if (isPD) sharePerfectDay(); else shareDayResults(); }} style={{padding:`${ipadTour(11)}px ${ipadTour(6)}px`,borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(12),fontWeight:"bold",fontFamily:"Georgia,serif",border:"none",cursor:"pointer"}}>
                {shareCopied?"✓ Copied!":"📋 Share"}
              </button>
            </div>
            <div style={{fontSize:ipadTour(12),color:"rgba(255,255,255,0.75)",marginTop:12,marginBottom:6}}>Want to play again?</div>
            <div style={{display:"flex",gap:8}}>
              <button className="ll-btn replay-btn" onClick={()=>closeDaySummary("now")} style={{flex:1,padding:`${ipadTour(11)}px ${ipadTour(4)}px`,borderRadius:12,background:"linear-gradient(135deg,#00c853,#00e676)",color:"#003300",fontSize:ipadTour(12),fontWeight:"bold",border:"none"}}>✏️ Now</button>
              <button className="ll-btn" onClick={()=>closeDaySummary("later")} style={{flex:1,padding:`${ipadTour(11)}px ${ipadTour(4)}px`,borderRadius:12,background:"linear-gradient(135deg,rgba(96,165,250,0.3),rgba(59,130,246,0.2))",border:"1px solid rgba(96,165,250,0.6)",color:"#bfdbfe",fontSize:ipadTour(12),fontWeight:"bold"}}>🌅 Later</button>
            </div>
''', "button row")

open(P, "w").write(s)
print("v303 applied OK")
