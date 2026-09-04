#!/usr/bin/env python3
# patch_v313.py — LetterLoot v313 (DEBUG-true dev cycle; 2.0.1 train)
# WoD FOUND-WORD ARROW DISPLAY (Daryl ruled Sep 2/3):
#   - Capture the ACTUAL word played at the WoD award moment; persist it in ll_wotd cache.
#   - WoD card, extended/prefixed find:  "✓ STRENUOUS→STRENUOUSLY! +1,400 pts"
#     (full word BOTH sides — survives E-drop matches like STOCKPILE→STOCKPILING and
#     prefixed finds like SURPRISE→UNSURPRISINGLY)
#   - EXACT find keeps the blessed current line: "✓ You found it! +1,000 pts"
#   - Shares: same arrow folded into both composers' WoD line when the word differs.
#   - Pre-patch found-days have no stored word -> graceful fallback to current text.
# DEBUG -> TRUE for the verify round. DO NOT git push while DEBUG is true (push = Vercel =
# every player). Flip comes with the 2.0.1 ship patch.
# Anchors: count==1 each, refuses to write on any mismatch.
import sys, io

PATH = "src/App.jsx"
src = io.open(PATH, encoding="utf-8").read()

edits = [
  # 1. dev-cycle marker + DEBUG true
  ('const DEBUG_MODE = false; // v312 web-beta: Spyglass Open Search live for Beta-Looters; version line reads 2.0 (App Store ship pending feedback)',
   'const DEBUG_MODE = true; // v313 dev cycle OPEN - WoD found-word arrow display (2.0.1 train). DO NOT PUSH while true.'),

  # 2. persist the found word in the ll_wotd cache
  ('function markWordOfTheDayFound(level, score, bonus = 1000) {\n  try {\n    const cached = getCachedWordOfTheDay();\n    if (cached) {\n      cached.found = true;\n      cached.foundLevel = level;\n      cached.foundScore = score;\n      cached.foundBonus = bonus; // v299: varies with word length now',
   'function markWordOfTheDayFound(level, score, bonus = 1000, foundWord = null) {\n  try {\n    const cached = getCachedWordOfTheDay();\n    if (cached) {\n      cached.found = true;\n      cached.foundLevel = level;\n      cached.foundScore = score;\n      cached.foundBonus = bonus; // v299: varies with word length now\n      if (foundWord) cached.foundWord = foundWord; // v313: the ACTUAL word played (may be longer/prefixed form)',),

  # 3. hydrate the found word into wotdFoundDetails on load
  ('      return cached?.foundLevel ? { level: cached.foundLevel, score: cached.foundScore, bonus: cached.foundBonus || 1000 } : null;',
   '      return cached?.foundLevel ? { level: cached.foundLevel, score: cached.foundScore, bonus: cached.foundBonus || 1000, word: cached.foundWord || null } : null;'),

  # 4. capture the word at the award moment
  ('        setWotdFoundDetails({ level, score, bonus });\n        markWordOfTheDayFound(level, score, bonus);',
   '        setWotdFoundDetails({ level, score, bonus, word: currentWord }); // v313: remember what was actually played\n        markWordOfTheDayFound(level, score, bonus, currentWord);'),

  # 5. the WoD card line — arrow for extended/prefixed finds, blessed text for exact
  ('              {wotdFound ? `✓ You found it! +${((wotdFoundDetails && wotdFoundDetails.bonus) || 1000).toLocaleString("en-US")} pts` : "Spell it — or any longer form of it! 1,000 pts, +200 per extra letter."}',
   '''              {/* v313: extended/prefixed finds show full-word arrow (STRENUOUS→STRENUOUSLY).
                  Exact finds keep the blessed line. Pre-v313 found-days have no stored word
                  and fall back to the blessed line too. */}
              {wotdFound
                ? (wotdFoundDetails && wotdFoundDetails.word && wotdFoundDetails.word.toUpperCase() !== wotd.toUpperCase()
                  ? `✓ ${wotd}→${wotdFoundDetails.word.toUpperCase()}! +${(wotdFoundDetails.bonus || 1000).toLocaleString("en-US")} pts`
                  : `✓ You found it! +${((wotdFoundDetails && wotdFoundDetails.bonus) || 1000).toLocaleString("en-US")} pts`)
                : "Spell it — or any longer form of it! 1,000 pts, +200 per extra letter."}'''),

  # 6. Perfect Day share composer — arrow in the WoD line when the word differs
  ('    const wotdLine = wotdFoundDetails ? `\\n🎯 Word of the Day: ${wotd} — Found! Scored ${wotdFoundDetails.score} pts` : "";',
   '    const wotdArrow = wotdFoundDetails && wotdFoundDetails.word && wotdFoundDetails.word.toUpperCase() !== wotd.toUpperCase() ? `→${wotdFoundDetails.word.toUpperCase()}` : ""; // v313\n    const wotdLine = wotdFoundDetails ? `\\n🎯 Word of the Day: ${wotd}${wotdArrow} — Found! Scored ${wotdFoundDetails.score} pts` : "";'),

  # 7. daily share composer — same arrow (this one also has a not-found branch, untouched)
  ('    const wotdLine = wotdFoundDetails\n      ? `\\n🎯 Word of the Day: ${wotd} — Found! Scored ${wotdFoundDetails.score} pts`\n      : `\\n🎯 Word of the Day: not found today`;',
   '    const wotdArrow2 = wotdFoundDetails && wotdFoundDetails.word && wotdFoundDetails.word.toUpperCase() !== wotd.toUpperCase() ? `→${wotdFoundDetails.word.toUpperCase()}` : ""; // v313\n    const wotdLine = wotdFoundDetails\n      ? `\\n🎯 Word of the Day: ${wotd}${wotdArrow2} — Found! Scored ${wotdFoundDetails.score} pts`\n      : `\\n🎯 Word of the Day: not found today`;'),
]

for i, (old, new) in enumerate(edits, 1):
    n = src.count(old)
    if n != 1:
        sys.exit(f"REFUSED: anchor {i} matched {n} times (expected 1). Nothing written.")

for old, new in edits:
    src = src.replace(old, new, 1)

io.open(PATH, "w", encoding="utf-8").write(src)
print("v313 applied OK")
