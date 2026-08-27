p='src/App.jsx'; s=open(p).read()
def rep(old,new):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f"STOP: anchor found {n} times, expected 1: {old[:70]!r}")
    s=s.replace(old,new)

rep("const DEBUG_MODE = false; // v297 — 1.7 SHIP CANDIDATE (Aug 22): Spyglass (chip only) + Flourish board + What's New + Special Features + Hints&Tips entries. DEBUG OFF.",
    "const DEBUG_MODE = true; // v298 dev cycle OPEN — 1.8: Malleable WoD (containment match, +200/extra letter). Flip false pre-archive. (Aug 23)")

# ── sayings: "+1,000" becomes a {BONUS} slot filled at render (Daryl's ruling A) ──
rep('''const WOTD_SAYINGS = [
  "The Word o' the Day be YOURS \\u2014 +1,000 doubloons!",
  "Ye found the day's treasure \\u2014 +1,000 to yer hoard!",
  "Struck gold, ye clever devil \\u2014 +1,000 doubloons be yers!",
  "That be the very word \\u2014 +1,000 bits conferred.",
  "The daily prize is best \\u2014 +1,000 in the chest!",
  "Word o' the Day plundered'll keep us afloat longer \\u2014 +1,000!",
  "A captain's find to keep us from a bind \\u2014 +1,000 to yer name!",
];''',
    '''// v298 (Malleable WoD): "+1,000" hard-codes replaced by a {BONUS} slot — the bonus now varies
// (1,000 base + 200 per letter beyond the WoD's length), so pickWotdSaying(bonus) fills the
// real amount. Daryl's wording otherwise verbatim (ruling A, Aug 23).
const WOTD_SAYINGS = [
  "The Word o' the Day be YOURS \\u2014 +{BONUS} doubloons!",
  "Ye found the day's treasure \\u2014 +{BONUS} to yer hoard!",
  "Struck gold, ye clever devil \\u2014 +{BONUS} doubloons be yers!",
  "That be the very word \\u2014 +{BONUS} bits conferred.",
  "The daily prize is best \\u2014 +{BONUS} in the chest!",
  "Word o' the Day plundered'll keep us afloat longer \\u2014 +{BONUS}!",
  "A captain's find to keep us from a bind \\u2014 +{BONUS} to yer name!",
];''')
rep('''function pickWotdSaying() {''', '''function pickWotdSaying(bonus = 1000) {''')
rep('''  return WOTD_SAYINGS[((dayIdx % n) + n) % n];''',
    '''  return WOTD_SAYINGS[((dayIdx % n) + n) % n].replace("{BONUS}", bonus.toLocaleString("en-US"));''')

# ── match site 1: History/entry flag ──
rep('''    const isWotdWord = !!(valid && wotd && !wotdFound && currentWord.toUpperCase() === wotd.toUpperCase());''',
    '''    // v298 (Malleable WoD, Daryl's ruling Aug 23): the WoD is a ROOT MINIMUM — any valid word
    // CONTAINING it counts (SURPRISED matches UNSURPRISING). includes() makes shorter forms
    // impossible by definition, so no separate length check is needed.
    const isWotdWord = !!(valid && wotd && !wotdFound && currentWord.toUpperCase().includes(wotd.toUpperCase()));''')

# ── match site 2 + bonus formula ──
rep('''      // ── Word of the Day check — award 1,000 bonus once per day ──
      if (wotd && !wotdFound && currentWord.toUpperCase() === wotd.toUpperCase()) {
        setWotdFound(true);
        setWotdFoundDetails({ level, score });
        markWordOfTheDayFound(level, score);
        const bonus = 1000;''',
    '''      // ── Word of the Day check (v298 Malleable WoD) — any valid word CONTAINING the WoD,
      // once per day. Bonus: 1,000 base + 200 per letter beyond the WoD's own length. ──
      if (wotd && !wotdFound && currentWord.toUpperCase().includes(wotd.toUpperCase())) {
        setWotdFound(true);
        setWotdFoundDetails({ level, score });
        markWordOfTheDayFound(level, score);
        const bonus = 1000 + 200 * Math.max(0, currentWord.length - wotd.length);''')
rep('''        enqueueCelebration("wotd", null, 8000); // v172: 4s -> 8s (Daryl). Loot/Great Word unchanged.''',
    '''        enqueueCelebration("wotd", { bonus }, 8000); // v172: 4s -> 8s (Daryl). v298: payload carries the real bonus for the saying.''')

# ── celebration state carries the payload; saying renders the real amount ──
rep('''    if (next.kind === "wotd") {
      setWotdCelebration(true);''',
    '''    if (next.kind === "wotd") {
      setWotdCelebration(next.payload || true); // v298: object { bonus } (or true from legacy paths)''')
rep('''>{pickWotdSaying()}</div>''',
    '''>{pickWotdSaying((typeof wotdCelebration === "object" && wotdCelebration && wotdCelebration.bonus) || 1000)}</div>''')

# ── copy: Ready-screen WoD tip line ──
rep('''🎯 Find the Word of the Day<br/>''',
    '''🎯 Find the Word of the Day — or any longer word containing it!<br/>''')

# ── copy: new Hints & Tips entry, third position (after the two 1.7 leads) ──
rep('''    { emoji:"👁️", title:"Watch Your Letters",''',
    '''    { emoji:"🎯", title:"Grow the Word of the Day", body:"The Word of the Day is a root minimum — any valid word containing it counts! Spell a longer form (add a prefix, suffix, or both) and the 1,000-pt bonus grows by 200 pts for every extra letter." },
    { emoji:"👁️", title:"Watch Your Letters",''')

open(p,'w').write(s); print("v298 applied OK")
