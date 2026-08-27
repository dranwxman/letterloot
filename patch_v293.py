p='src/App.jsx'; s=open(p).read()
def rep(old,new):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f"STOP: anchor found {n} times, expected 1: {old[:70]!r}")
    s=s.replace(old,new)
def rep_all(old,new,expect):
    global s
    n=s.count(old)
    if n!=expect: raise SystemExit(f"STOP: anchor found {n} times, expected {expect}: {old[:70]!r}")
    s=s.replace(old,new)

rep('(v292: Flourish board tab + brighter row meta)', '(v293: What\'s New 1.7 — Spyglass + Flourish board; Tips card)')

# ── gate key bump: every player sees the 1.7 popup once ──
rep_all('ll_whatsnew_v12_seen', 'll_whatsnew_v17_seen', 3)

SPY_TXT = "Not sure a word's in the LL dictionary? Tap the blue <strong style={{color:'#7cc4ff'}}>🔭 SCOUT</strong> chip beside yer built word (or double-tap the word itself) to check it — without committing yer tiles. The clock keeps runnin', so certainty costs time, matey!"
FFB_TXT = "New leaderboard tab: the longest board-clearing Finishing Flourish words, across all Looters. Registered players only — and the board starts fresh from 1.7, so get yer name up there first!"

# ── ONE-TIME POPUP (gates Ready screen) ──
rep('''<div style={{fontSize:ipadIntro(22),color:"#f6d365",fontWeight:"bold"}}>Fresh treasure in v1.2</div>''',
    '''<div style={{fontSize:ipadIntro(22),color:"#f6d365",fontWeight:"bold"}}>Fresh treasure in v1.7</div>''')
rep('''          {/* v203/v205/v212: FEATURED Finishing Flourish card — enlarged, STRONGER border, bold red title. */}
          <div style={{background:"rgba(246,211,101,0.16)",border:"2.5px solid rgba(246,211,101,0.85)",borderRadius:14,padding:`${ipadIntroPad(18)}px ${ipadIntroPad(18)}px`,boxShadow:"0 0 28px rgba(246,211,101,0.35)"}}>
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
              <span style={{fontSize:ipadIntro(24)}}>🏴‍☠️</span>
              <span style={{fontSize:ipadIntro(21),color:"#ff4444",fontWeight:"bold",textShadow:"0 0 10px rgba(255,68,68,0.45)"}}>Finishing Flourish Bonus</span>
            </div>
            <div style={{fontSize:ipadIntro(17.5),color:"rgba(245,240,232,0.98)",lineHeight:1.6}}>Use a 5+ letter word as your final, board-clearing word to pocket a Finishing Flourish Bonus — treasure that grows with every extra letter. The longer that finishing word, the bigger the haul!</div>
          </div>''',
    '''          {/* v293: FEATURED Spyglass card (1.7) — gold box, bold red title, Daryl's ruling A. */}
          <div style={{background:"rgba(246,211,101,0.16)",border:"2.5px solid rgba(246,211,101,0.85)",borderRadius:14,padding:`${ipadIntroPad(18)}px ${ipadIntroPad(18)}px`,boxShadow:"0 0 28px rgba(246,211,101,0.35)"}}>
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
              <span style={{fontSize:ipadIntro(24)}}>🔭</span>
              <span style={{fontSize:ipadIntro(21),color:"#ff4444",fontWeight:"bold",textShadow:"0 0 10px rgba(255,68,68,0.45)"}}>The Spyglass</span>
            </div>
            <div style={{fontSize:ipadIntro(17.5),color:"rgba(245,240,232,0.98)",lineHeight:1.6}}>''' + SPY_TXT + '''</div>
          </div>
          {/* v293: second card — Flourish Leaderboard (1.7). Slightly smaller than the featured card. */}
          <div style={{background:"rgba(167,139,250,0.14)",border:"2px solid rgba(167,139,250,0.7)",borderRadius:14,padding:`${ipadIntroPad(14)}px ${ipadIntroPad(16)}px`,boxShadow:"0 0 18px rgba(167,139,250,0.25)"}}>
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
              <span style={{fontSize:ipadIntro(20)}}>🏴‍☠️</span>
              <span style={{fontSize:ipadIntro(18),color:"#c4b5fd",fontWeight:"bold"}}>Flourish Leaderboard</span>
            </div>
            <div style={{fontSize:ipadIntro(15.5),color:"rgba(245,240,232,0.95)",lineHeight:1.55}}>''' + FFB_TXT + '''</div>
          </div>''')
rep('''            <div style={{fontSize:ipadIntro(17),color:"rgba(245,240,232,0.92)",lineHeight:1.6}}>✨ <strong style={{color:"#f6d365"}}>Loot Letters</strong> — one hidden tile per level scores 5×.</div>''',
    '''            <div style={{fontSize:ipadIntro(17),color:"rgba(245,240,232,0.92)",lineHeight:1.6}}>🦜 <strong style={{color:"#ff4444"}}>Finishing Flourish Bonus</strong> — clear the board with a 5+ letter word for bonus treasure; longer = bigger haul.</div>
            <div style={{fontSize:ipadIntro(17),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:ipadIntro(9)}}>✨ <strong style={{color:"#f6d365"}}>Loot Letters</strong> — one hidden tile per level scores 5×.</div>''')

# ── LATEST UPDATES reference screen (via Tour) ──
rep('''📢 What's New in v1.2</div>''', '''📢 What's New in v1.7</div>''')
rep('''            {/* v205/v213: FEATURED Finishing Flourish — enlarged, STRONGER border, bold red title. */}
            <div style={{background:"rgba(246,211,101,0.16)",border:"2.5px solid rgba(246,211,101,0.85)",borderRadius:14,padding:uT(18),boxShadow:"0 0 28px rgba(246,211,101,0.35)"}}>
              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
                <span style={{fontSize:uT(24)}}>🏴‍☠️</span>
                <span style={{fontSize:uT(21),color:"#ff4444",fontWeight:"bold",textShadow:"0 0 10px rgba(255,68,68,0.45)"}}>Finishing Flourish Bonus</span>
              </div>
              <div style={{fontSize:uT(17.5),color:"rgba(245,240,232,0.98)",lineHeight:1.6}}>Use a 5+ letter word as your final, board-clearing word to pocket a Finishing Flourish Bonus — treasure that grows with every extra letter. The longer that finishing word, the bigger the haul!</div>
            </div>''',
    '''            {/* v293: FEATURED Spyglass (1.7). */}
            <div style={{background:"rgba(246,211,101,0.16)",border:"2.5px solid rgba(246,211,101,0.85)",borderRadius:14,padding:uT(18),boxShadow:"0 0 28px rgba(246,211,101,0.35)"}}>
              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
                <span style={{fontSize:uT(24)}}>🔭</span>
                <span style={{fontSize:uT(21),color:"#ff4444",fontWeight:"bold",textShadow:"0 0 10px rgba(255,68,68,0.45)"}}>The Spyglass</span>
              </div>
              <div style={{fontSize:uT(17.5),color:"rgba(245,240,232,0.98)",lineHeight:1.6}}>''' + SPY_TXT + '''</div>
            </div>
            {/* v293: Flourish Leaderboard card (1.7). */}
            <div style={{background:"rgba(167,139,250,0.14)",border:"2px solid rgba(167,139,250,0.7)",borderRadius:14,padding:uT(14),boxShadow:"0 0 18px rgba(167,139,250,0.25)",marginTop:uT(12)}}>
              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
                <span style={{fontSize:uT(20)}}>🏴‍☠️</span>
                <span style={{fontSize:uT(18),color:"#c4b5fd",fontWeight:"bold"}}>Flourish Leaderboard</span>
              </div>
              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.95)",lineHeight:1.55}}>''' + FFB_TXT + '''</div>
            </div>''')
rep('''              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.92)",lineHeight:1.6}}>✨ <strong style={{color:"#6ee7b7"}}>Loot Letters</strong> — one hidden tile per level scores 5×.</div>''',
    '''              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.92)",lineHeight:1.6}}>🦜 <strong style={{color:"#ff4444"}}>Finishing Flourish Bonus</strong> — clear the board with a 5+ letter word for bonus treasure; longer = bigger haul.</div>
              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:uT(7)}}>✨ <strong style={{color:"#6ee7b7"}}>Loot Letters</strong> — one hidden tile per level scores 5×.</div>''')

# ── TIPS / TOUR "Special Features" page: add Flourish Leaderboard card after the Spyglass card ──
rep('''Words we don't know can be sent to the Cap'n fer review.</div>
          </div>
        </div>''',
    '''Words we don't know can be sent to the Cap'n fer review.</div>
          </div>
          <div style={{background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.4)',borderRadius:12,padding:ipadTour(11)}}>
            <div style={{fontSize:ipadTour(14),color:'#c4b5fd',fontWeight:'bold',marginBottom:ipadTour(4)}}>🏴‍☠️ Flourish Leaderboard</div>
            <div style={{fontSize:ipadTour(12),color:'rgba(245,240,232,0.9)',lineHeight:1.55}}>The longest board-clearing Finishing Flourish words across all Looters. Find it under the <strong style={{color:'#c4b5fd'}}>🏴‍☠️ Flourish</strong> tab on the Leaderboard. Registered players only.</div>
          </div>
        </div>''')

open(p,'w').write(s); print("v293 applied OK")
