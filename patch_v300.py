p='src/App.jsx'; s=open(p).read()
def rep(old,new):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f"STOP: anchor found {n} times, expected 1: {old[:70]!r}")
    s=s.replace(old,new)

rep("const DEBUG_MODE = true; // v299 dev cycle OPEN — 1.8: Malleable WoD root-stem rule (A) + WoD card brightness/copy. Flip false pre-archive. (Aug 23)",
    "const DEBUG_MODE = true; // v300 dev cycle OPEN — 1.8: WoD card XL text, grown-WoD sayings, SF WoD cards, foundBonus restore fix. Flip false pre-archive. (Aug 23)")

# ── 1) WoD card lines EVEN bigger/bolder (Daryl, Aug 23) ──
rep('''            <div style={{fontSize:13,color:"#c4b5fd",letterSpacing:3,fontWeight:"bold",marginBottom:6}}>🎯 WORD OF THE DAY</div>''',
    '''            <div style={{fontSize:16,color:"#d8ccfd",letterSpacing:3,fontWeight:"bold",marginBottom:6}}>🎯 WORD OF THE DAY</div>''')
rep('''            <div style={{fontSize:wotdFound?15:13.5,fontWeight:"bold",color:wotdFound?"#4ade80":"rgba(255,255,255,0.92)",lineHeight:1.5}}>''',
    '''            <div style={{fontSize:wotdFound?16:15.5,fontWeight:"bold",color:wotdFound?"#4ade80":"rgba(255,255,255,0.98)",lineHeight:1.5}}>''')

# ── 2) grown-WoD sayings: second rotation with a bigger-and-better kick.
#      Drafts pending Kim's pass; pickWotdSaying(bonus, grew) selects the array. ──
rep('''const WOTD_SAYINGS = [
  "The Word o' the Day be YOURS \\u2014 +{BONUS} doubloons!",
  "Ye found the day's treasure \\u2014 +{BONUS} to yer hoard!",
  "Struck gold, ye clever devil \\u2014 +{BONUS} doubloons be yers!",
  "That be the very word \\u2014 +{BONUS} bits conferred.",
  "The daily prize is best \\u2014 +{BONUS} in the chest!",
  "Word o' the Day plundered'll keep us afloat longer \\u2014 +{BONUS}!",
  "A captain's find to keep us from a bind \\u2014 +{BONUS} to yer name!",
];''',
    '''const WOTD_SAYINGS = [
  "The Word o' the Day be YOURS \\u2014 +{BONUS} doubloons!",
  "Ye found the day's treasure \\u2014 +{BONUS} to yer hoard!",
  "Struck gold, ye clever devil \\u2014 +{BONUS} doubloons be yers!",
  "That be the very word \\u2014 +{BONUS} bits conferred.",
  "The daily prize is best \\u2014 +{BONUS} in the chest!",
  "Word o' the Day plundered'll keep us afloat longer \\u2014 +{BONUS}!",
  "A captain's find to keep us from a bind \\u2014 +{BONUS} to yer name!",
];
// v300 (Malleable WoD): separate rotation when the player GREW the word beyond the listed WoD —
// the find is bigger and better than asked, so the line should say so. Same daily-seeded pick.
// Drafts pending Kim's copy pass (Daryl, Aug 23).
const WOTD_GROWN_SAYINGS = [
  "Ye GREW the Word o' the Day \\u2014 +{BONUS} fer yer bigger bounty!",
  "The day's word, stretched to fit more gold \\u2014 +{BONUS} doubloons!",
  "Not just found \\u2014 EXPANDED! +{BONUS} to yer hoard!",
  "A longer word, a heavier chest \\u2014 +{BONUS} fer the haul!",
  "Ye took the day's treasure and built upon it \\u2014 +{BONUS}!",
  "Bigger word, bigger bounty \\u2014 +{BONUS} doubloons be yers!",
  "The Cap'n asked fer one word \\u2014 ye brought back MORE! +{BONUS}!",
];''')
rep('''function pickWotdSaying(bonus = 1000) {''',
    '''function pickWotdSaying(bonus = 1000, grew = false) {''')
rep('''  return WOTD_SAYINGS[((dayIdx % n) + n) % n].replace("{BONUS}", bonus.toLocaleString("en-US"));''',
    '''  const pool = grew ? WOTD_GROWN_SAYINGS : WOTD_SAYINGS;
  return pool[((dayIdx % n) + n) % n].replace("{BONUS}", bonus.toLocaleString("en-US"));''')
# celebration payload carries grew; render passes it through
rep('''        enqueueCelebration("wotd", { bonus }, 8000); // v172: 4s -> 8s (Daryl). v298: payload carries the real bonus for the saying.''',
    '''        enqueueCelebration("wotd", { bonus, grew: currentWord.length > wotd.length }, 8000); // v172: 4s -> 8s (Daryl). v300: bonus + grew flag for the saying.''')
rep('''>{pickWotdSaying((typeof wotdCelebration === "object" && wotdCelebration && wotdCelebration.bonus) || 1000)}</div>''',
    '''>{pickWotdSaying((typeof wotdCelebration === "object" && wotdCelebration && wotdCelebration.bonus) || 1000, !!(typeof wotdCelebration === "object" && wotdCelebration && wotdCelebration.grew))}</div>''')

# ── 3) WoD card on BOTH Special Features surfaces ──
# 3a: Menu page — insert before the Finishing Flourish card
rep('''          <div style={{background:"rgba(246,211,101,0.12)",border:"1px solid rgba(246,211,101,0.45)",borderRadius:13,padding:`${ipadMenu(14)}px ${ipadMenu(16)}px`,marginBottom:8,display:"flex",gap:13,alignItems:"flex-start"}}>
            <div style={{fontSize:ipadMenu(26),flexShrink:0,marginTop:1,minWidth:ipadMenu(32),textAlign:"center"}}>🦜</div>''',
    '''          {/* v300: Word of the Day card — Malleable WoD rule (1.8). */}
          <div style={{background:"rgba(167,139,250,0.12)",border:"1px solid rgba(167,139,250,0.4)",borderRadius:13,padding:`${ipadMenu(14)}px ${ipadMenu(16)}px`,marginBottom:8,display:"flex",gap:13,alignItems:"flex-start"}}>
            <div style={{fontSize:ipadMenu(26),flexShrink:0,marginTop:1,minWidth:ipadMenu(32),textAlign:"center"}}>🎯</div>
            <div style={{flex:1}}>
              <div style={{fontSize:ipadMenu(13),fontWeight:"bold",marginBottom:5,color:"#a78bfa"}}>Word of the Day</div>
              <div style={{fontSize:ipadMenu(12),color:"rgba(255,255,255,0.95)",lineHeight:1.65}}>Each day names one word to hunt — and it's a root minimum: spell it OR any longer word containing it (SURPRISED counts SURPRISING, UNSURPRISING…). Worth 1,000 pts, plus 200 pts for every letter beyond the listed word. Once per day, and it's required for a Perfect Day.</div>
            </div>
          </div>

          <div style={{background:"rgba(246,211,101,0.12)",border:"1px solid rgba(246,211,101,0.45)",borderRadius:13,padding:`${ipadMenu(14)}px ${ipadMenu(16)}px`,marginBottom:8,display:"flex",gap:13,alignItems:"flex-start"}}>
            <div style={{fontSize:ipadMenu(26),flexShrink:0,marginTop:1,minWidth:ipadMenu(32),textAlign:"center"}}>🦜</div>''')
# 3b: Tour scene — insert before the Finishing Flourish card
rep('''          <div style={{background:'rgba(246,211,101,0.12)',border:'1px solid rgba(246,211,101,0.45)',borderRadius:12,padding:ipadTour(11)}}>
            <div style={{fontSize:ipadTour(14),color:'#ff4444',fontWeight:'bold',marginBottom:ipadTour(4)}}>🦜 Finishing Flourish Bonus</div>''',
    '''          <div style={{background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.4)',borderRadius:12,padding:ipadTour(11)}}>
            <div style={{fontSize:ipadTour(14),color:'#a78bfa',fontWeight:'bold',marginBottom:ipadTour(4)}}>🎯 Word of the Day</div>
            <div style={{fontSize:ipadTour(12),color:'rgba(245,240,232,0.9)',lineHeight:1.55}}>Each day names one word to hunt — and it's a root minimum: spell it OR any longer word containing it. Worth 1,000 pts, plus 200 pts per extra letter. Once per day, and required for a Perfect Day.</div>
          </div>
          <div style={{background:'rgba(246,211,101,0.12)',border:'1px solid rgba(246,211,101,0.45)',borderRadius:12,padding:ipadTour(11)}}>
            <div style={{fontSize:ipadTour(14),color:'#ff4444',fontWeight:'bold',marginBottom:ipadTour(4)}}>🦜 Finishing Flourish Bonus</div>''')

# ── 4) Ready-screen found-line restore bug: carry foundBonus through the relaunch path ──
rep('''        if (cachedWotd.found && cachedWotd.foundLevel) {
          setWotdFoundDetails({ level: cachedWotd.foundLevel, score: cachedWotd.foundScore });''',
    '''        if (cachedWotd.found && cachedWotd.foundLevel) {
          // v300: include foundBonus — without it a relaunch showed "+1,000" for a grown find.
          setWotdFoundDetails({ level: cachedWotd.foundLevel, score: cachedWotd.foundScore, bonus: cachedWotd.foundBonus || 1000 });''')

open(p,'w').write(s); print("v300 applied OK")
