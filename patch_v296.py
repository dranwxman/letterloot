p='src/App.jsx'; s=open(p).read()
def rep(old,new):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f"STOP: anchor found {n} times, expected 1: {old[:70]!r}")
    s=s.replace(old,new)

rep("// v295 — 1.7 SHIP CANDIDATE (Aug 22): Spyglass (chip only, double-tap removed) + Flourish board + What's New. DEBUG OFF.",
    "// v296 — 1.7 SHIP CANDIDATE (Aug 22): Spyglass (chip only) + Flourish board + What's New + Menu Special Features cards. DEBUG OFF.")

rep('''Toggle <strong style={{color:"#c4b5fd"}}>Show Mascot Celebrations</strong> on the "Ready?" screen before each game begins.</div>
            </div>
          </div>

          <div style={{textAlign:"center",marginBottom:16,marginTop:4}}>''',
    '''Toggle <strong style={{color:"#c4b5fd"}}>Show Mascot Celebrations</strong> on the "Ready?" screen before each game begins.</div>
            </div>
          </div>

          {/* v296: Spyglass card (1.7) — Menu Special Features page was missed in v284. */}
          <div style={{background:"rgba(124,196,255,0.1)",border:"1px solid rgba(124,196,255,0.4)",borderRadius:13,padding:`${ipadMenu(14)}px ${ipadMenu(16)}px`,marginBottom:8,display:"flex",gap:13,alignItems:"flex-start"}}>
            <div style={{fontSize:ipadMenu(26),flexShrink:0,marginTop:1,minWidth:ipadMenu(32),textAlign:"center"}}>🔭</div>
            <div style={{flex:1}}>
              <div style={{fontSize:ipadMenu(13),fontWeight:"bold",marginBottom:5,color:"#7cc4ff"}}>The Spyglass</div>
              <div style={{fontSize:ipadMenu(12),color:"rgba(255,255,255,0.95)",lineHeight:1.65}}>Not sure a word's in the LL dictionary? Tap the blue <strong style={{color:"#7cc4ff"}}>🔭 SCOUT</strong> chip beside yer built word to check it — without committing yer tiles. The clock keeps runnin', so certainty costs time, matey! Words we don't know can be sent to the Cap'n fer review with <strong style={{color:"#7cc4ff"}}>Submit fer Review</strong>.</div>
            </div>
          </div>

          {/* v296: Flourish Leaderboard card (1.7). */}
          <div style={{background:"rgba(167,139,250,0.12)",border:"1px solid rgba(167,139,250,0.4)",borderRadius:13,padding:`${ipadMenu(14)}px ${ipadMenu(16)}px`,marginBottom:8,display:"flex",gap:13,alignItems:"flex-start"}}>
            <div style={{fontSize:ipadMenu(26),flexShrink:0,marginTop:1,minWidth:ipadMenu(32),textAlign:"center"}}>🏴‍☠️</div>
            <div style={{flex:1}}>
              <div style={{fontSize:ipadMenu(13),fontWeight:"bold",marginBottom:5,color:"#c4b5fd"}}>Flourish Leaderboard</div>
              <div style={{fontSize:ipadMenu(12),color:"rgba(255,255,255,0.95)",lineHeight:1.65}}>The longest board-clearing Finishing Flourish words across all Looters. Find it under the <strong style={{color:"#c4b5fd"}}>🏴‍☠️ Flourish</strong> tab on the Leaderboard. Registered players only — the board starts fresh from 1.7.</div>
            </div>
          </div>

          <div style={{textAlign:"center",marginBottom:16,marginTop:4}}>''')

open(p,'w').write(s); print("v296 applied OK")
