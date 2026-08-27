p='src/App.jsx'; s=open(p).read()
def rep(old,new):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f"STOP: anchor found {n} times, expected 1: {old[:70]!r}")
    s=s.replace(old,new)

rep("const DEBUG_MODE = true; // v298 dev cycle OPEN — 1.8: Malleable WoD (containment match, +200/extra letter). Flip false pre-archive. (Aug 23)",
    "const DEBUG_MODE = true; // v299 dev cycle OPEN — 1.8: Malleable WoD root-stem rule (A) + WoD card brightness/copy. Flip false pre-archive. (Aug 23)")

# ── root-stem helper (Daryl's ruling A + guards, Aug 23) ──
rep('''function saveCachedWordOfTheDay(word) {''',
    '''// v299 (Malleable WoD rule A): the WoD is a ROOT MINIMUM. The root = the WoD minus ONE common
// grammatical ending (longest match first), stripped from the END only, and never below 5
// letters (short WoDs keep their full form as the root). A played word counts if it is valid,
// CONTAINS the root as a contiguous block, and is AT LEAST as long as the listed WoD.
// SURPRISED -> root SURPRIS: SURPRISING/UNSURPRISING/SURPRISES/UNSURPRISED all count;
// SURPRISE fails (shorter than 9); SURREPTITIOUS fails (no SURPRIS block).
const WOTD_STRIP_ENDINGS = ["ING","EST","ED","ER","ES","S","D"];
function wotdRoot(w) {
  const W = (w || "").toUpperCase();
  for (const e of WOTD_STRIP_ENDINGS) {
    if (W.endsWith(e) && W.length - e.length >= 5) return W.slice(0, W.length - e.length);
  }
  return W;
}
function isWotdMatch(playedWord, wotdWord) {
  if (!playedWord || !wotdWord) return false;
  const P = playedWord.toUpperCase(), W = wotdWord.toUpperCase();
  return P.length >= W.length && P.includes(wotdRoot(W));
}
function saveCachedWordOfTheDay(word) {''')

# ── match site 1: History/entry flag (replace v298 containment version) ──
rep('''    // v298 (Malleable WoD, Daryl's ruling Aug 23): the WoD is a ROOT MINIMUM — any valid word
    // CONTAINING it counts (SURPRISED matches UNSURPRISING). includes() makes shorter forms
    // impossible by definition, so no separate length check is needed.
    const isWotdWord = !!(valid && wotd && !wotdFound && currentWord.toUpperCase().includes(wotd.toUpperCase()));''',
    '''    // v299 (Malleable WoD rule A): root-stem match — see wotdRoot()/isWotdMatch() by the WoD
    // cache helpers. v298's strict containment missed SURPRISING/UNSURPRISING (no "ED" block).
    const isWotdWord = !!(valid && wotd && !wotdFound && isWotdMatch(currentWord, wotd));''')

# ── match site 2: bonus block (replace v298 version) ──
rep('''      // ── Word of the Day check (v298 Malleable WoD) — any valid word CONTAINING the WoD,
      // once per day. Bonus: 1,000 base + 200 per letter beyond the WoD's own length. ──
      if (wotd && !wotdFound && currentWord.toUpperCase().includes(wotd.toUpperCase())) {''',
    '''      // ── Word of the Day check (v299 Malleable WoD rule A) — root-stem match, once per day.
      // Bonus: 1,000 base + 200 per letter beyond the LISTED WoD's length (Daryl, Aug 23). ──
      if (wotd && !wotdFound && isWotdMatch(currentWord, wotd)) {''')

# ── persist the real bonus so the Ready-screen card can show it after the fact ──
rep('''function markWordOfTheDayFound(level, score) {
  try {
    const cached = getCachedWordOfTheDay();
    if (cached) {
      cached.found = true;
      cached.foundLevel = level;
      cached.foundScore = score;''',
    '''function markWordOfTheDayFound(level, score, bonus = 1000) {
  try {
    const cached = getCachedWordOfTheDay();
    if (cached) {
      cached.found = true;
      cached.foundLevel = level;
      cached.foundScore = score;
      cached.foundBonus = bonus; // v299: varies with word length now''')
rep('''        setWotdFound(true);
        setWotdFoundDetails({ level, score });
        markWordOfTheDayFound(level, score);
        const bonus = 1000 + 200 * Math.max(0, currentWord.length - wotd.length);''',
    '''        const bonus = 1000 + 200 * Math.max(0, currentWord.length - wotd.length);
        setWotdFound(true);
        setWotdFoundDetails({ level, score, bonus });
        markWordOfTheDayFound(level, score, bonus);''')
rep('''      return cached?.foundLevel ? { level: cached.foundLevel, score: cached.foundScore } : null;''',
    '''      return cached?.foundLevel ? { level: cached.foundLevel, score: cached.foundScore, bonus: cached.foundBonus || 1000 } : null;''')

# ── Ready-screen WoD card: brightness + size + malleable copy (Daryl, Aug 23) ──
rep('''            <div style={{fontSize:10,color:"#a78bfa",letterSpacing:3,fontWeight:"bold",marginBottom:6}}>🎯 WORD OF THE DAY</div>
            <div style={{fontSize:24,fontWeight:"bold",color:"#f6d365",letterSpacing:2,marginBottom:6,fontFamily:"Georgia,serif"}}>{wotd}</div>
            <div style={{fontSize:wotdFound?15:11,fontWeight:wotdFound?"bold":"normal",color:wotdFound?"#4ade80":"rgba(255,255,255,0.6)",lineHeight:1.5}}>{/* v268: found-it line bigger/bolder (Daryl, Aug 12) */}
              {wotdFound ? "✓ You found it! +1,000 pts" : "Find & spell it during today's game for a 1,000 pt bonus!"}
            </div>''',
    '''            {/* v299: label 10->13 and brighter, bottom line 11->13.5 and 0.6->0.92 white (Daryl:
                "far too light and small for humans with any visual limitations"), copy updated
                for the Malleable WoD rule, found-line shows the REAL banked bonus. */}
            <div style={{fontSize:13,color:"#c4b5fd",letterSpacing:3,fontWeight:"bold",marginBottom:6}}>🎯 WORD OF THE DAY</div>
            <div style={{fontSize:24,fontWeight:"bold",color:"#f6d365",letterSpacing:2,marginBottom:6,fontFamily:"Georgia,serif"}}>{wotd}</div>
            <div style={{fontSize:wotdFound?15:13.5,fontWeight:"bold",color:wotdFound?"#4ade80":"rgba(255,255,255,0.92)",lineHeight:1.5}}>
              {wotdFound ? `✓ You found it! +${((wotdFoundDetails && wotdFoundDetails.bonus) || 1000).toLocaleString("en-US")} pts` : "Spell it — or any longer form of it! 1,000 pts, +200 per extra letter."}
            </div>''')

# ── mid-game WoD reminder overlay: same rule copy ──
rep('''<div style={{fontSize:ipadTour(11),color:"rgba(255,255,255,0.9)",marginBottom:12,lineHeight:1.5}}>Spell it for a <strong style={{color:"#fda085"}}>+1,000 pt bonus!</strong></div>''',
    '''<div style={{fontSize:ipadTour(12),color:"rgba(255,255,255,0.95)",marginBottom:12,lineHeight:1.5}}>Spell it — or any longer form — for <strong style={{color:"#fda085"}}>+1,000 pts, +200 per extra letter!</strong></div>''')

open(p,'w').write(s); print("v299 applied OK")
