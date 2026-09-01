import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { supabase, signUp, signIn, signOut, resetPassword, getSession, loadGameState, saveGameState, loadDailySession, saveDailySession, updatePlayerName, savePlayerPhoto, loadPlayerPhoto, saveBestTime } from "./supabase";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Clipboard } from "@capacitor/clipboard";

// ═══════════════════════════════════════════════════════════════════
// 🛠 DEBUG MODE — set false before App Store submission!
// When true, shows a floating 🛠 DEBUG badge top-right on every screen.
// Tap badge → opens Debug Menu with quick-jump buttons to any level/modal/state.
// TODO BEFORE APP STORE SUBMISSION: set DEBUG_MODE = false
// v66 (May 26, 2026): FLIPPED to false for App Store submission build 1.0(6).
// Flip back to true for local development if needed.
// ═══════════════════════════════════════════════════════════════════
const DEBUG_MODE = false; // v308 dev cycle OPEN - in-app version line (1.9.1 ship patch)
// v308: the string players read off Menu -> Account and quote back when reporting an
// issue. Bump this in every ship patch; it is the app's only self-identification.
const APP_VERSION = "1.9.1 (308)";
// v306: ?admin=1 is NOT authorization. The admin panel reads every player's game_state
// row, so it renders only for a DEBUG build or one of these signed-in accounts.
const ADMIN_EMAILS = ["dranwxman@letterloot.net", "dranwxman@gmail.com"];

// v95: per-level level-clear celebration. ODD levels (1,3,5) = female captain (her own voice),
// EVEN levels (2,4) = male pirate (his goofy swagger). Each level has a distinct entrance animation.
// v108: rotating Level Clear lines — 10 per level, Loot-forward/comical/rhyming.
// A-hybrid rotation (see picker below): first clear of the day shows a
// deterministic line (same for every player that day); each subsequent clear in
// the same session advances to the next line (wraps). Session index resets on
// app launch (no stored key — deliberate, per design lock July 2).
const PIRATE_CLEAR_SAYINGS = {
  1: [
    "Well done, recruit! Welcome to me crew. ⚓",
    "Shiver me timbers, ye Loot with vim! ⭐",
    "Ye Looted that one clean — now dive back in! 💰",
    "Arrr, the crew be impressed, me friend! 🦜",
    "A tidy bit o' booty Looted! 🪙",
    "Ye sail so fine, the Loot be thine! ⛵",
    "Keep 'er steady, matey — more Loot be ready! 🧭",
    "Chest be cracked and the gold be packed! 🗝️",
    "Smooth sailin', ye salty ol' Looter! 🌊",
    "Anchors aweigh — ye Looted the day! ⚓",
  ],
  2: [
    "Two chests down and ye wear the crown! 💰",
    "Blimey, ye Loot like a scallywag pro! ⭐",
    "The tide be high and so be yer buy! 🌊",
    "Cuttin' through waters, ye Lootin' son 'n daughters! ⛵",
    "Ye've got the crew excited fer d' Loot! 🦜",
    "D'Looted Booty be pilin' up nicely, mate! 🪙",
    "Steady she goes — that's how Loot flows! 🧭",
    "Proper pirate work, ye Lootin' berserk! 🗝️",
    "Shiver me timbers, ye just don't quit! ⚓",
    "Onward, ye legend — richer Loot ahead! 💎",
  ],
  3: [
    "Ye be a Lootin' machine, ye fiend! 💰",
    "The seven seas bow — ye Loot like a wow! 🌊",
    "Grand haul, matey — the crew stands tall! 🦜",
    "Ye sail so keen, the finest e'er seen! ⛵",
    "Booty for days, ye clever ol' knave! 🪙",
    "Arrr, a captain's Loot, no doubt about it! ⚓",
    "Keep this up 'n we'll need a bigger cup! 🚢",
    "Sharp as a cutlass, twice as ruthless! 🗡️",
    "Treasure be leapin' aboard while ye're reapin'! 💎",
    "Full sails, fair winds, 'n Loot that never ends! 🧭",
  ],
  4: [
    "Nearly there, matey — the Loot be laid bare! 🧭",
    "Ye be sniffin' out the motherlode, ye rogue! 💎",
    "The crew can taste the Loot — no waste! 🪙",
    "Blimey, what a run — ye Loot for fun! ⭐",
    "One more, ye legend, 'n the seas be yer heaven! 🌊",
    "Ye Loot like the tide — relentless 'n wide! 💰",
    "Steady, sailor — the big chest be nearer! 🗝️",
    "Arrr, ye make it look like a lark! 🦜",
    "The map's near ours — hoist them Loot-filled hours! 🗺️",
    "Hold fast, ye rascal — glory's in yer grasp-al! ⚓",
  ],
  5: [
    "A grand voyage, matey — ye did it, ye brave-y! 🏆",
    "The whole sea be singin' yer Lootin' name! 🌊",
    "Every chest cracked — ye legend, that's a fact! 👑",
    "Arrr, a captain true through 'n through! ⚓",
    "Loot won, crew cheerin' — magnificent 'n endearin'! 🦜",
    "Ye Looted the lot, ye grand buccaneer-y sort! 💎",
    "Top o' the mast for ye, unsurpassed! ⭐",
    "That be how a pirate finishes the fight! 💰",
    "Shiver me timbers — a grand 'n glorious run! 🗝️",
    "Bow to the legend who Looted the seven! 👑",
  ],
};
// v113 (debug preview) / v113+ (full wiring): the 10 approved Great Word lines
// (PK July03e, Daryl-approved). [score] is a live slot replaced with the word's
// points at fire time. Used now only by the debug preview render; v113 adds the
// pickGreatWordSaying() rotation + trigger logic.
const GREAT_WORD_SAYINGS = [
  "Mighty word, matey — that's +[score] booty! 💰",
  "Ye Looted a whopper — +[score] proper! ⭐",
  "Blimey, what a haul — +[score], ye got 'em all! 🪙",
  "A word for the ages — +[score] wages! 📜",
  "Shiver me timbers, +[score] in the till! 💎",
  "Now that be Lootin' — +[score] high-falutin'! 🎩",
  "Grand word, ye scallywag — +[score] in the bag! 🎒",
  "Ye spelled it, ye sold it — +[score], ye bold-it! ⚔️",
  "Crackin' good word — +[score] for the hoard! 🏴‍☠️",
  "Ye word-slingin' wonder — +[score] worth o' plunder! 🌊",
];
// v113 (debug preview) / v113+ (full wiring): per-level Great Word score threshold
// (PK July03e LOCKED: L1=40, L2=50, L3=60, L4=70, L5=80). Used now only to pick a
// plausible sample score for the debug preview; v113 uses it as the real fire gate.
const GREAT_WORD_THRESH_PREVIEW = { 1: 40, 2: 50, 3: 60, 4: 70, 5: 80 };
// v116 (#16 full wiring): the REAL per-level Great Word fire threshold. Same values
// as _PREVIEW; kept as its own const so the live gate reads by intent, not off the
// debug-preview name. A single submitted word whose real (5x-inclusive) score meets
// or exceeds this fires the Great Word moment once per level.
const GREAT_WORD_THRESH = { 1: 40, 2: 50, 3: 60, 4: 70, 5: 80 };
// ── v119 (#new): V/C-RATIO DANGER PULSE thresholds (LOCKED July04c) ──────────────
// A non-blocking ambient cue: pulses the Vowels + Consonants boxes when the
// vowel:consonant RATIO of the remaining tiles enters a danger zone, teaching the
// player to bank/spend vowels before they strand themselves. This is a UTILITY cue,
// NOT a mascot moment — it is ALWAYS ON, independent of the mascot toggle (Daryl,
// July04c). Two rules, both firing the SAME 5s alternating pulse:
//   Rule 1 (vowel starvation, the dangerous one): V ÷ C <= 30%  → alert (inclusive).
//   Rule 2 (over-vowel / consonant compounding):  V ÷ C >= 100% AND >6 tiles left.
// Ratio is vowels DIVIDED BY consonants (NOT vowels/total). Both boundaries inclusive.
const VC_STARVE_RATIO = 0.30;   // Rule 1: V/C <= 0.30 fires
const VC_OVER_RATIO   = 1.00;   // Rule 2: V/C >= 1.00 fires (tips at V=C)
const VC_OVER_MIN_TILES = 6;    // Rule 2 guard: only when tilesRemaining > 6 (kills end-game false alarms)
const VC_PULSE_MS = 6000;       // dwell: 3 cycles x 2.0s = 6s of alternating V<->C rise/fade (v121, was 5000)
// Pure function of the remaining counts — identical result on board-open and
// post-submit, so both triggers agree. Returns "starve" | "over" | null.
//  - c === 0 (no consonants left) is NOT starvation — return null (avoids /0 and a
//    meaningless spike when only vowels remain in the last tiles).
//  - Rule 2's tile guard uses the total remaining (v + c).
function vcDangerState(v, c, tilesRemaining) {
  if (c === 0) return null;
  const ratio = v / c;
  if (ratio <= VC_STARVE_RATIO) return "starve";
  if (ratio >= VC_OVER_RATIO && tilesRemaining > VC_OVER_MIN_TILES) return "over";
  return null;
}
// v116: A-hybrid picker for Great Word lines — mirrors pickClearSaying exactly.
// First call of the session = deterministic daily index (getDailySeed() % 10);
// each later call advances +1 (wrapping). Returns the line WITH the [score] token
// still in it; the caller interpolates the real score at fire time.
// v169 (v1.2 #12): Word of the Day sayings. WoD fires at most ONCE PER DAY, so there is no
// session rotation to track (unlike Great Word) — a daily-seeded pick gives every player the
// same line on a given day, and a different one tomorrow.
// v171: Daryl's lines, verbatim. No emoji. Each carries the +1,000 itself, which is why the
// panel needs no separate points row. Lengths run 46-61 chars, so the panel breathes a little
// differently day to day (Daryl: "2 or 3 lines is fine").
// v298 (Malleable WoD): "+1,000" hard-codes replaced by a {BONUS} slot — the bonus now varies
// (1,000 base + 200 per letter beyond the WoD's length), so pickWotdSaying(bonus) fills the
// real amount. Daryl's wording otherwise verbatim (ruling A, Aug 23).
const WOTD_SAYINGS = [
  "The Word o' the Day be YOURS \u2014 +{BONUS} doubloons!",
  "Ye found the day's treasure \u2014 +{BONUS} to yer hoard!",
  "Struck gold, ye clever devil \u2014 +{BONUS} doubloons be yers!",
  "That be the very word \u2014 +{BONUS} bits conferred.",
  "The daily prize is best \u2014 +{BONUS} in the chest!",
  "Word o' the Day plundered'll keep us afloat longer \u2014 +{BONUS}!",
  "A captain's find to keep us from a bind \u2014 +{BONUS} to yer name!",
];
// v300 (Malleable WoD): separate rotation when the player GREW the word beyond the listed WoD —
// the find is bigger and better than asked, so the line should say so. Same daily-seeded pick.
// Drafts pending Kim's copy pass (Daryl, Aug 23).
const WOTD_GROWN_SAYINGS = [
  "Ye GREW the Word o' the Day \u2014 +{BONUS} fer yer bigger bounty!",
  "The day's word, stretched to fit more gold \u2014 +{BONUS} doubloons!",
  "Not just found \u2014 EXPANDED! +{BONUS} to yer hoard!",
  "A longer word, a heavier chest \u2014 +{BONUS} fer the haul!",
  "Ye took the day's treasure and built upon it \u2014 +{BONUS}!",
  "Bigger word, bigger bounty \u2014 +{BONUS} doubloons be yers!",
  "The Cap'n asked fer one word \u2014 ye brought back MORE! +{BONUS}!",
];
// Rotate on DAYS-SINCE-EPOCH, not getDailySeed(). getDailySeed() is YYYYMMDD, which jumps by
// 70 across a 31-day month boundary (20260731 -> 20260801) — and 70 % 7 == 0, so the same
// saying would repeat two days running every such rollover. Epoch-days increments by exactly 1
// per day, so the cycle never stalls. (Consequence, by design: with 7 sayings on a 7-day cycle
// each line lands on the same weekday each week.)
function pickWotdSaying(bonus = 1000, grew = false) {
  // LOCAL midnight, not UTC: Date.now()/86400000 would flip the saying at 5pm Pacific,
  // out of step with getTodayKey() and every other date-keyed thing in the app.
  const d = new Date();
  const dayIdx = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const n = WOTD_SAYINGS.length;
  const pool = grew ? WOTD_GROWN_SAYINGS : WOTD_SAYINGS;
  return pool[((dayIdx % n) + n) % n].replace("{BONUS}", bonus.toLocaleString("en-US"));
}

function pickGreatWordSaying(sessionIdx) {
  const lines = GREAT_WORD_SAYINGS;
  const daily = getDailySeed() % 10;
  const idx = (daily + Math.max(0, sessionIdx)) % lines.length;
  return lines[idx];
}
// A-hybrid picker. `sessionIdx` is a running counter for this app session
// (a useRef in the component, starts at -1). First call of the session uses the
// deterministic daily index (getDailySeed() % 10); each later call advances +1
// (wrapping). Returns the line string for the given level.
function pickClearSaying(level, sessionIdx) {
  const lines = PIRATE_CLEAR_SAYINGS[level] || PIRATE_CLEAR_SAYINGS[1];
  const daily = getDailySeed() % 10;
  const idx = (daily + Math.max(0, sessionIdx)) % lines.length;
  return lines[idx];
}
// Which character image appears per level: female captain on odd, male pirate on even.
const PIRATE_CLEAR_IMG = {
  1: "/pirate-captain-female.png",
  2: "/pirate-cheer.png",
  3: "/pirate-captain-female.png",
  4: "/pirate-cheer.png",
  5: "/pirate-captain-female.png",
};
const PIRATE_CLEAR_ANIM = { 1:"plClearL1", 2:"plClearL2", 3:"plClearL3", 4:"plClearL4", 5:"plClearL5" };
// ── v219: Perfect Day celebration image width. TUNING KNOB — adjust this ONE number on-device.
// The PD art is /pirates-m-f-celebration.png (1024x1024, both pirates mid-leap, arms out).
// The retired art was a pirate+leprechaun composite at 280; this pair is wider and throws its
// arms out to the sides, so it starts a touch larger. ipadTour() makes it device-aware.
const PD_PIRATE_W = 400;
// v220: how far the pair sits above the bottom of the screen, in % (fed into the pdPirates*
// keyframes, which are inside a template-literal <style> block so this interpolates).
// Was a hard-coded 6% — correct for the retired wide composite that rose from the floor, but
// it left this squarer arms-up art looking sunk. 28% ≈ vertically centered.
const PD_PIRATE_BOTTOM = 28;
// v220: PD stats modal spacing multiplier. The card's gaps were squeezed tight to fit a
// narrow card, leaving ~280px of dead vertical space on iPhone. This opens them up so the
// card breathes and fills more of the screen. Width cap deliberately UNCHANGED (Daryl: width
// is good). Raise for more air, lower for less. Note ipadTour() scales on top of this.
const PD_MODAL_AIR = 1.5;
const pdAir = (n) => Math.round(n * PD_MODAL_AIR);
// ── v221: STANDALONE Loot Letter celebration size. TUNING KNOB — one number, on-device.
// The card was full-bleed on iPhone: the container pads 20px/side, then `width:"100%"` took
// every remaining pixel, then the card added its own ~32px padding on top → no margins, and a
// tall stack (42px emoji + title + letter tile + 3 text rows) that crowded the screen.
// Fix = width 90% + this proportional shrink. The scale MUST live on a separate wrapper: the
// card's own wotdPop animation drives `transform`, so an inline transform on the card itself
// gets overridden (learned in v200 with the co-fire card).
// ⚠️ This applies to the STANDALONE path ONLY. When the Finishing Flourish overlay is up, the
// co-fire card keeps its LOCKED values (scale 0.4, nudge ipadTour(150)) — untouched here.
const LOOT_SCALE = 0.85;

// Speech-bubble text auto-fit. History: v114 shrink-only w/ 8px floor; v115 capped the
// shrink to a few px (which is what created the ceiling problem); v166 replaced both with
// a true grow-and-shrink fit. See below.
// v166 (v1.2 #8): TRUE fit — grows AND shrinks.
// Was: `let size = maxPx` then a shrink-only loop with `floor = Math.max(18, maxPx - minGap)`.
// Two bugs fell out of that:
//   1. maxPx was a CEILING the text could never exceed. Widening the bubble (v165 -> 1.85)
//      gave the text a much larger zone, but the font stayed pinned at maxPx. Making the
//      bubble bigger could not make the letters bigger. (Daryl, July 9: "letters are way
//      too small - that's the real issue".)
//   2. On iPhone, maxPx = ipadTour(11) = 11 while floor = max(18, 6) = 18. The loop guard
//      `size > floor` was `11 > 18` -> false, so it never ran a single iteration and long
//      sayings were simply clipped by overflow:hidden.
// Now: binary-search the largest size in [MIN_PX, maxPx] that fits the zone. Short sayings
// render large, long ones step down, everything stays inside the bubble. maxPx is now a
// genuine safety ceiling rather than the operative value, so future bubble-geometry changes
// pick up the right font automatically instead of needing a hand-tuned constant.
const BUBBLE_MIN_PX = 9;   // absolute legibility floor; below this we accept overflow rather than shrink further
// v176 (Item 14 RESOLVED): the text zone no longer derives its HEIGHT from the bubble <img>.
// Measured on-device (v175 instrumentation): on a cold render the fit ran in useLayoutEffect
// BEFORE /Speech_Bubble.png had decoded, so the wrapper had height 0, so `height:${zHeight}%`
// resolved to 0px, so the box had boxH=0, so nothing fit and the search bottomed out at
// BUBBLE_MIN_PX=9 (an illegible smear). Warm cache → boxH≈44 → best≈15. Same screen, different
// result depending purely on whether the PNG was cached — that was the L5 "screwball."
// FIX (Option B): the caller computes the zone in PIXELS from `bw` (the bubble is a fixed
// 1024×1024 square rendered at width:bw, so its rendered height is also bw). The box gets an
// explicit px height that can never be 0. `zLeft`/`zTop` stay percentages — position was never
// the problem, only height. `boxWpx`/`boxHpx` are the deterministic zone dimensions.
function BubbleFitText({ text, zLeft, zTop, boxWpx, boxHpx, maxPx }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);
  const [fontPx, setFontPx] = useState(BUBBLE_MIN_PX);
  useLayoutEffect(() => {
    const box = boxRef.current, inner = innerRef.current;
    if (!box || !inner) return;
    // v173: measure the INNER block, not the flex box. The outer div is `display:flex`, and on a
    // flex container scrollWidth/scrollHeight do NOT report the text overflowing — the text is an
    // anonymous flex item that gets COMPRESSED and wrapped to fit instead of spilling. So the old
    // `box.scrollWidth <= box.clientWidth` answered "fits" at sizes where the text was actually
    // being crushed into extra lines, and the search converged far too small. `wordBreak:
    // break-word` made it worse: the text can nearly always find SOME way to wrap within the
    // width, so the horizontal test was almost always true. Measuring a real block child gives
    // honest overflow numbers. (v166 introduced the search; this is what it should have measured.)
    const fitsAt = (px) => {
      box.style.fontSize = px + "px";
      return inner.scrollHeight <= box.clientHeight + 1 && inner.scrollWidth <= box.clientWidth + 1;
    };
    let lo = BUBBLE_MIN_PX, hi = maxPx, best = BUBBLE_MIN_PX;
    if (fitsAt(hi)) {
      best = hi;                       // ceiling already fits — take it, no search needed
    } else {
      // Invariant: `lo` fits (or is the floor), `hi` does not. Converge to 0.5px.
      while (hi - lo > 0.5) {
        const mid = Math.round(((lo + hi) / 2) * 2) / 2;   // snap to 0.5px steps
        if (mid === lo || mid === hi) break;
        if (fitsAt(mid)) { best = mid; lo = mid; } else { hi = mid; }
      }
      if (fitsAt(lo)) best = lo;
    }
    box.style.fontSize = best + "px";
    setFontPx(best);
  }, [text, maxPx, boxWpx, boxHpx]);
  return (
    <div
      ref={boxRef}
      style={{
        position: "absolute",
        left: `${zLeft}%`, top: `${zTop}%`,
        width: `${boxWpx}px`, height: `${boxHpx}px`,
        display: "flex", alignItems: "center", justifyContent: "center",
        textAlign: "center", color: "#5a3a12", fontFamily: "Georgia,serif",
        fontWeight: "bold", lineHeight: 1.15, fontSize: fontPx + "px",
        overflow: "hidden", wordBreak: "break-word",
      }}
    ><span ref={innerRef} style={{ display: "block", width: "100%" }}>{text}</span></div>
  );
}

// ── iPad responsive width helper (May 21, 2026) ──────────────
// On iPad-sized screens (≥768px wide), bump page-container widths so the
// app fills the screen comfortably instead of looking like a tiny phone
// app marooned in the middle. Modal cards keep their original widths —
// they're meant to feel focused, not stretched.
const isIpadWidth = () => typeof window !== "undefined" && window.innerWidth >= 768;
// v125: large-iPad (12.9"/13") detector. 11" iPad Pro logical width ~834pt, 13" ~1032pt,
// so >=1000 cleanly separates them. 768-999 = "standard/11" iPad" keeps the tuned-for-11"
// values; >=1000 = 13" gets its own larger tier so it fills the bigger screen instead of
// inheriting the smaller 11" tiles. Only the game-board tile path branches on this.
const isLargeIpad = () => typeof window !== "undefined" && window.innerWidth >= 1000;
const ipadW = (base) => isIpadWidth() ? Math.round(base * 1.78) : base;
// ipadTile: per-level scaling to keep larger boards (L4-L5 = 60-66 tiles, 9-10 rows)
// from overflowing the iPad screen. L1/L2 stay at 2.2× (perfect size). L3 nudges
// to 2.0×. L4 drops to 1.8×. L5 drops to 1.65× — still much bigger than phone
// (1.0×) but compact enough that a 10-row board plus all UI fits on an 11" iPad.
// Width gets a separate, more generous curve at L4/L5 so tiles don't get too
// narrow horizontally as the board lengthens vertically. Letter/value fonts stay
// on the HEIGHT curve (ipadTile) to keep text proportional to vertical space.
// v48 update May 25, 2026: Tile count formula bumped to 42+(L-1)*7, giving 63 tiles
// on L4 (9×7) and 70 on L5 (10×7). The extra row at each level was tight on 11"
// iPad — dropping L4 from 1.8→1.6 and L5 from 1.65→1.5 height, with proportional
// width adjustments, gives the extra row breathing room.
// v125 STANDARD/11" HEIGHT tier: L2/L3/L5 brought into line with L4's known-good 1.6
// tuning so 7/8/10-row boards stop clipping the last row + End Game bar on the 11" iPad
// (reviewer's device). L1 (6 rows, fits) and L4 (9 rows, the good-fit anchor) UNCHANGED.
// Locked values sit just under the computed 11" max-fit (2.09/1.83/1.47) for a safety margin.
const IPAD_TILE_SCALE_BY_LEVEL = { 1: 1.86, 2: 1.74, 3: 1.52, 4: 1.35, 5: 1.22 }; // v183: additional ~6% HEIGHT trim on top of v182 (v182 was {1:1.98,2:1.85,3:1.62,4:1.44,5:1.30}). v181's 6% and v182's +4% still left all levels clipping (top row OR bottom border, never both at once). ~16% cumulative below the v180 baseline {1:2.2,2:2.05,3:1.80,4:1.6,5:1.44}. NOTE: if this STILL clips, the remaining overflow is likely FIXED CHROME (header+stats+input+2 bottom buttons), not tile size — switch to trimming chrome / capping the play-column to viewport rather than shrinking tiles further. HEIGHT only; width/13"/iPhone untouched.
const IPAD_TILE_WIDTH_SCALE_BY_LEVEL = { 1: 2.2, 2: 2.2, 3: 2.1, 4: 2.15, 5: 2.05 }; // v60: L4 1.9→2.15, L5 1.85→2.05 (bug #13). 11" width unchanged — nothing overflowed sideways.
// v125 13" (>=1000px) HEIGHT tier: the 13" has ~917px board-height budget vs the 11"'s
// ~745px (≈1.23×), so it can run LARGER tiles at every level and fill its bigger screen
// instead of inheriting the smaller 11" tiles. Starting candidates — dial on the 13" sim.
const IPAD13_TILE_SCALE_BY_LEVEL = { 1: 2.7, 2: 2.5, 3: 2.2, 4: 2.0, 5: 1.8 };
// v125 13" WIDTH tier: 11" width scaled up ~1.23× (capped) so tiles keep a natural aspect
// ratio on the 13" instead of going tall-skinny. Dial alongside the height tier.
const IPAD13_TILE_WIDTH_SCALE_BY_LEVEL = { 1: 2.7, 2: 2.7, 3: 2.55, 4: 2.6, 5: 2.5 };
// iPhone per-level scaling (added May 24, 2026): L1 had only 4 rows of 7 tiles
// on a big iPhone screen like the 17 Pro Max — tiles felt tiny with empty space
// below. Scale UP on early levels, gradually returning closer to base by L5 where
// the board grows to 10 rows. Curve refined after iPhone 17 Pro Max smoke test
// showed L3-L5 had room to grow comfortably.
const IPHONE_TILE_SCALE_BY_LEVEL = { 1: 1.45, 2: 1.30, 3: 1.20, 4: 1.10, 5: 1.05 };
// ── v230: NARROW-iPHONE TIER ────────────────────────────────────────────────────────────────
// The table above was tuned on the iPhone 17 Pro Max (vw440) — see its own comment, "Curve refined
// after iPhone 17 Pro Max smoke test". There was NO iPhone device tier, unlike iPad which got
// isLargeIpad() for exactly this reason (Item 18).
// MEASURED on Daryl's PHYSICAL iPhone Air (vw375 vh812), July 17 2026, via the v229 probe:
//   L1 boardBottom 769 →  43px headroom  OK
//   L2 boardBottom 772 →  40px headroom  OK
//   L3 boardBottom 803 →   9px headroom  barely
//   L4 boardBottom 808 →   4px headroom  barely
//   L5 boardBottom 828 →  -16px          CLIPPED
// Only L5 actually clipped; L3/L4 were one font/OS change away.
// (Yesterday's "all levels overflow" was the PAGE scrolling — the End Game bar + Create Account
// button sit ~121px BELOW the board — not the board being cut off. The v229 BOARDOVER metric
// separated those two questions.)
// Fixed chrome eats 304-335px = 37-41% of an 812px viewport BEFORE a single tile, which is why a
// curve tuned on a bigger phone doesn't survive here. Past-us's line-325 warning was right.
// These values are DERIVED, not guessed: current scale x the factor needed to leave ~40px of
// headroom on the Air. L1/L2 barely move (already had it); L3/L4/L5 tighten.
// TUNE ON-DEVICE, ONE NUMBER AT A TIME.
const IPHONE_NARROW_TILE_SCALE_BY_LEVEL = { 1: 1.46, 2: 1.30, 3: 1.12, 4: 1.02, 5: 0.94 };
// iPhone Air reports vw375; iPhone 17 Pro Max reports vw440. 400 sits cleanly between.
// Mirrors the isIpadWidth()/isLargeIpad() pattern.
const isNarrowIphone = () => typeof window !== "undefined" && window.innerWidth < 400;
// ── v227 INSTRUMENTATION (TEMPORARY — strip once the numbers are captured) ──────────
// WHY: the iPhone board overflows on Daryl's iPhone Air (all levels), but fits perfectly on the
// iPhone 17 Pro Max simulator. Same code, same build. The chrome is IDENTICAL on both screens, so
// the line-325 "it's probably fixed chrome" guess does NOT hold here — the DEVICE says tile scale.
// Root suspicion (to be CONFIRMED by these numbers, not assumed): IPHONE_TILE_SCALE_BY_LEVEL was
// tuned on the 17 Pro Max ("Curve refined after iPhone 17 Pro Max smoke test showed L3-L5 had room
// to grow comfortably") and there is NO iPhone device tier — unlike iPad, which got isLargeIpad()
// precisely because one set of numbers didn't fit two sizes (Item 18).
// This readout reports the REAL geometry so the fix is arithmetic instead of another guess.
// Item 14 precedent: four modelled diagnoses failed; one instrumented number solved it at once.
const useBoardMetrics = (boardRef, level, enabled) => {
  const [m, setM] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    const measure = () => {
      try {
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const board = boardRef.current;
        if (!board) return;
        const bRect = board.getBoundingClientRect();
        // Chrome above the board = everything from viewport top to the board's top edge.
        const chromeTop = Math.round(bRect.top);
        const boardH = Math.round(bRect.height);
        const boardBottom = Math.round(bRect.bottom);
        // Everything below the board (End Game bar + Create Account button) — measured from the
        // board's parent's remaining children rather than assumed.
        const doc = document.documentElement;
        const pageH = Math.round(doc.scrollHeight);
        const overflow = Math.round(pageH - vh);
        // v229: boardFits is the question that actually matters — does the board's bottom edge
        // clear the viewport? OVER (pageH - vh) counts the whole page including the End Game bar
        // and Create Account button below the board, so a small OVER can still mean the BOARD is
        // fully visible. These are different questions and yesterday's screenshots conflated them.
        const boardOver = Math.round(boardBottom - vh); // >0 = board itself is cut off
        setM({ vh, vw, chromeTop, boardH, boardBottom, pageH, overflow, boardOver, level });
      } catch {}
    };
    measure();
    const t = setTimeout(measure, 400); // after fonts/layout settle
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [boardRef, level, enabled]);
  return m;
};

const ipadTile = (base, level = 1) => {
  if (!isIpadWidth()) {
    // iPhone path: apply per-level iPhone scale.
    // v230: narrow iPhones (Air vw375, mini, SE-class) get their own curve — see the note above
    // IPHONE_NARROW_TILE_SCALE_BY_LEVEL. Must stay in lockstep with ipadTileW below or tiles
    // stop being square.
    const phoneScale = (isNarrowIphone() ? IPHONE_NARROW_TILE_SCALE_BY_LEVEL[level] : IPHONE_TILE_SCALE_BY_LEVEL[level]) || 1.00;
    return Math.round(base * phoneScale);
  }
  // v125: 13" iPad gets its own larger height tier; 768-999 (11"/standard) keeps the 11" tune.
  if (isLargeIpad()) {
    const scale13 = IPAD13_TILE_SCALE_BY_LEVEL[level] || 1.8;
    return Math.round(base * scale13);
  }
  const scale = IPAD_TILE_SCALE_BY_LEVEL[level] || 1.65; // fallback for any future levels
  return Math.round(base * scale);
};
const ipadTileW = (base, level = 1) => {
  if (!isIpadWidth()) {
    // iPhone path: apply per-level iPhone scale (same curve as height for symmetric tiles)
    // v230: narrow-iPhone tier — MUST mirror ipadTile above exactly, or tiles stop being square.
    const phoneScale = (isNarrowIphone() ? IPHONE_NARROW_TILE_SCALE_BY_LEVEL[level] : IPHONE_TILE_SCALE_BY_LEVEL[level]) || 1.00;
    return Math.round(base * phoneScale);
  }
  // v125: 13" iPad gets its own larger width tier; 768-999 (11"/standard) keeps the 11" tune.
  if (isLargeIpad()) {
    const scale13 = IPAD13_TILE_WIDTH_SCALE_BY_LEVEL[level] || 2.5;
    return Math.round(base * scale13);
  }
  const scale = IPAD_TILE_WIDTH_SCALE_BY_LEVEL[level] || 2.05;
  return Math.round(base * scale);
};
const ipadChrome = (base) => isIpadWidth() ? Math.round(base * 1.5) : base;
// v179: TIER-AWARE (same rationale as ipadTour). Pop-ups/modals/intro cards rendered too
// large on the 11" tier (July 12 playthrough — "taking up entire screen"). 13" unchanged at
// 2.0x; 11" trims to 1.72x (~14%). iPhone unchanged.
const ipadIntro = (base) => isIpadWidth() ? (isLargeIpad() ? Math.round(base * 2.0) : Math.round(base * 1.63)) : base; // welcome/intro card content (v180: 11" 1.72->1.63)
const ipadIntroPad = (base) => isIpadWidth() ? (isLargeIpad() ? Math.round(base * 2.0) : Math.round(base * 1.63)) : base; // welcome/intro card padding (v180: 11" 1.72->1.63)
// ipadProfile (added v48): Profile Setup screen — 2.0× was overflowing on 11" iPad
// (Save button below the safe area). 1.5× on iPad keeps everything visible while
// still feeling proportional. iPhone unchanged.
const ipadProfile = (base) => isIpadWidth() ? Math.round(base * 1.5) : base;
const ipadProfilePad = (base) => isIpadWidth() ? Math.round(base * 1.5) : base;
// v179: TIER-AWARE. Was a flat 2.3x on BOTH iPad tiers, which OVERFLOWED the 11" tier
// (celebration cards, Great Word, Level-Clear all rendered too large and ran off the 11"
// reviewer device — confirmed in full playthrough July 12). The 13" tier is UNCHANGED at
// 2.3x (it fits and is approved); only the 11" tier (768-999px) trims to 1.95x (~15%) so
// these surfaces sit inside the 11" viewport. iPhone (base) unchanged. Board is a SEPARATE
// system (ipadTile/ipadTileW) and is intentionally not touched here.
const ipadTour = (base) => {
  if (!isIpadWidth()) return base;                 // iPhone: identity
  if (isLargeIpad()) return Math.round(base * 2.3); // 13": unchanged/approved
  return Math.round(base * 1.85);                   // 11": trimmed to fit (v180: 1.95->1.85)
};
const ipadMenu = (base) => isIpadWidth() ? Math.round(base * 1.75) : base; // menu hub - moderate scale, fits all cards on screen
const ipadDense = (base) => isIpadWidth() ? Math.round(base * 1.6) : base; // dense screens (Stats, Debug Menu) - v60: bumped 1.3→1.6 for readability (bug #15)
const ipadWord = (base) => isIpadWidth() ? Math.round(base * 2.5) : base; // word-being-built row (largest scale)
const ipadIcon = (base) => isIpadWidth() ? Math.round(base * 1.8) : base; // pencil/letterloot icon
const ipadBoardW = () => isIpadWidth() ? 1500 : undefined; // wider tile-board container on iPad

// v168 (v1.2 #11): SHARED Great Word overlay renderer.
// The live block and the debug-preview block were byte-identical markup differing only in the
// state variable they read. That duplication is exactly how they drifted apart before (bw hit
// 1.15 in one and 1.27 in the other), and it would have meant the debug preview showed a
// DIFFERENT screen than live — defeating the preview's whole purpose.
//
// The v116 rule ("debug triggers never touch live state") is about STATE isolation — the
// rotation counter, the per-level guard. Sharing the MARKUP preserves that completely: both
// callers still own their own state, they just render through one function.
//
// Card: matches the Level-Clear panel's gradient + gold border, but maxWidth ipadTour(420)
// rather than 320 — this panel carries no results text.
// NOTE (v174): the CARD does not constrain the bubble. The bubble is position:absolute inside
// an inline-block group, so it does not participate in the group's width (the group is sized by
// the pirate, width:pw) and there is no overflow:hidden anywhere on the path. The bubble simply
// overhangs the card. The real constraint is the VIEWPORT: group is centered in the card, card
// is centered in the overlay, and the bubble is centered on the group — so the bubble is
// centered on the screen and bw must fit within (viewport - 40px overlay padding).
function GreatWordOverlay({ line }) {
  const pw = ipadTour(180);                       // v174: 150→180 (+20%). The Level-Clear mascot is
                                                  // boxed in a results card; this one floats, so it
                                                  // needs more presence to hold the screen.
                                                  // 180 is the CEILING, not a taste call. The bubble is
                                                  // centered on the viewport (translateX(-50%) lives in
                                                  // the bubbleIn keyframes, fill-mode both), so bw must
                                                  // fit inside viewport-minus-40px of overlay padding.
                                                  // Narrowest supported phone = 375px (iPhone SE):
                                                  //   375 - 40 = 335px of room; bw = 1.85*180 = 333px.
                                                  // 2px of margin. pw=190 → bw=351.5 → clips on an SE.
                                                  // Level-Clear's pw (120) is a SEPARATE constant and is
                                                  // deliberately untouched — Daryl: "perfectly sized."
  const bw = pw * 1.85;                           // v165 width (legibility)
  const cropWR = 786/1024, cropHR = 546/1024;
  const solidBottomFrac = (1 + cropHR)/2;
  const marginBelow = bw * (1 - solidBottomFrac);
  const gap = pw * (10/162);
  const bubbleTop = -bw + marginBelow - gap;
  // The bubble hangs above the group at a negative top; inside a card that would escape the
  // panel. Drop the group by its upward extent — same technique v162 used on Level-Clear.
  const groupDrop = Math.max(0, -bubbleTop) + ipadTour(10);
  const cropLeftFrac = (1 - cropWR)/2, cropTopFrac = (1 - cropHR)/2;
  const zLeft = (cropLeftFrac + (9.4/100)*cropWR) * 100;
  const zWidth = (81.7/100) * cropWR * 100;
  const zTop = (cropTopFrac + (11/100)*cropHR) * 100;   // v115 zone (11%/66%)
  const zHeight = (66/100) * cropHR * 100;
  // v176: the bubble PNG is a 1024×1024 square rendered at width:bw, so its rendered HEIGHT is
  // also bw. Compute the text zone in PIXELS from bw so the box height never waits on image
  // decode (Item 14 root cause). zLeft/zTop stay % of the bw-wide wrapper — position was fine.
  const boxWpx = bw * (zWidth/100);
  const boxHpx = bw * (zHeight/100);
  return (
    <div style={{position:"fixed",inset:0,zIndex:9700,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",padding:"20px"}}>
      <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:`${ipadTour(28)}px ${ipadTour(20)}px`,textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,215,0,0.35)",maxWidth:ipadTour(420),width:"92%"}}>
        <div style={{position:"relative",display:"inline-block",marginTop:groupDrop}}>
          <div style={{position:"absolute",left:"50%",top:bubbleTop,width:bw,transformOrigin:"bottom center",pointerEvents:"none",animation:"bubbleIn 0.55s cubic-bezier(.34,1.56,.64,1) 0.35s both",zIndex:2}}>
            <img src="/Speech_Bubble.png" alt="" style={{display:"block",width:"100%",height:"auto"}}/>
            {/* Item 14 (RESOLVED v176): the Great Word saying sometimes rendered as an
                illegible smear, worst on L5 (longest sayings). The REAL cause — found by
                instrumenting the device, not by modelling — was an image-decode height race:
                BubbleFitText's box took its HEIGHT from `height:${zHeight}%`, a percentage of
                the bubble wrapper, whose height came from the <img src="/Speech_Bubble.png">.
                useLayoutEffect ran BEFORE the image decoded, so wrapper height = 0 → box
                height = 0 → nothing fit vertically → the binary search bottomed out at the 9px
                floor. Image load wasn't in the dep array, so it never re-measured. Cold-load /
                cache race; warm cache looked fine, which is why it read as intermittent.
                (The earlier v174 note here claimed the text was "pinned at the 22px ceiling"
                and that height was fine — that diagnosis was WRONG. Height was the whole
                problem.)
                FIX: the caller computes the zone in PIXELS from `bw` (boxWpx/boxHpx above);
                the box height can no longer be 0, cold or warm. maxPx=ipadTour(30) and pw=180
                are the accepted legibility values for THIS Great Word site. The Level-Clear
                block below keeps ipadTour(22)/pw=120 — accepted as-is, deliberately different.
                Confirmed on-device L1–L5. */}
            <BubbleFitText text={line} zLeft={zLeft} zTop={zTop} boxWpx={boxWpx} boxHpx={boxHpx} maxPx={ipadTour(30)}/>
          </div>
          <img src="/great-word-pirate.png" alt="" style={{display:"block",width:pw,height:"auto",filter:"drop-shadow(0 6px 12px rgba(0,0,0,0.5))",animation:"plClearL2 0.9s cubic-bezier(.34,1.56,.64,1) forwards"}}/>
        </div>
      </div>
    </div>
  );
}

// ── Board-Clear Finisher celebration overlay (step 3a: chest + count-up, NO coins yet) ─────
// Full-screen overlay modeled on GreatWordOverlay: fixed inset:0, gold-bordered gradient card,
// ipadTour() scaling. Shows the treasure chest (public/treasure-chest.png), a tier label that
// escalates with word length, and a point count-up rolling from 0 to `bonus`. Coins flying INTO
// the chest are step 3b (added on top of this). `len` drives the tier label/intensity; `bonus`
// is the finisher points (already computed via finisherBonus()). Purely presentational — no
// scoring here (that's applied at the board-clear point in handleSubmit).
function finisherTier(len) {
  // Daryl's loot-themed wording, 5 tiers (voice-matched to the Great Word / WoD sayings).
  // Escalating color/glow intensity climbs with the tier. Wording is verbatim — do not reword.
  if (len >= 10) return { label: "A Lootin' Legacy ya be!", color: "#fef08a", glow: "rgba(253,224,71,0.95)" };
  if (len === 9) return { label: "Yer Loot Legend grows!",  color: "#fde047", glow: "rgba(253,224,71,0.9)"  };
  if (len === 8) return { label: "Yer Lucky Lootin' Day!",  color: "#fcd34d", glow: "rgba(252,211,77,0.85)" };
  if (len === 7) return { label: "Big ol' Looter Y'arr!",   color: "#fbbf24", glow: "rgba(251,191,36,0.8)"  };
  return             { label: "Tidy Looter ya be",      color: "#fcd34d", glow: "rgba(252,211,77,0.7)"  };
}
// a/an by SPOKEN sound of the numeral: 8 ("eight") and 11 ("eleven") take "an"; all others "a".
function aOrAn(n) { return (n === 8 || n === 11) ? "an" : "a"; }
function FinisherOverlay({ len, bonus, onDismiss }) {
  const tier = finisherTier(len);
  const chestW = ipadTour(380);
  const rollMs = 1500 + Math.max(0, len - 5) * 500;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / rollMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(bonus * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bonus, rollMs]);
  // ── 3b (chest set): pick the chest image by finisher tier. 5 static chests with escalating
  // coin fill, so the chest itself shows how big the finish was — no animated coins (the
  // count-up is the motion). Mapping: 5–6→Chest 1 (modest), 7→2 (fuller), 8→3 (brimming),
  // 9→4 (spilling), 10+→5 (heavy overflow). All 5 chests share framing/orientation.
  const chestSrc =
    len >= 10 ? "/treasure-chest-5.png" :
    len === 9 ? "/treasure-chest-4.png" :
    len === 8 ? "/treasure-chest-3.png" :
    len === 7 ? "/treasure-chest-2.png" :
                "/treasure-chest.png";
  return (
    <div style={{position:"fixed",inset:0,zIndex:9720,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"auto",padding:"20px"}}>
      <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:`${ipadTour(22)}px ${ipadTour(24)}px ${ipadTour(16)}px`,textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.85)",border:"2px solid rgba(255,215,0,0.5)",maxWidth:ipadTour(580),width:"94%"}}>
        {/* Line 1: the flourish (dynamic letter count) */}
        <div style={{fontSize:ipadTour(16),color:"#e9d8fd",fontWeight:"bold",marginBottom:ipadTour(18),lineHeight:1.2}}>Finishing Flourish Bonus — {aOrAn(len)} {len} letter finish!</div>
        {/* Line 2: tier label (Daryl's loot wording) */}
        <div style={{fontSize:ipadTour(26),fontWeight:"bold",color:tier.color,letterSpacing:"0.3px",textShadow:`0 0 20px ${tier.glow}`,marginBottom:ipadTour(18),lineHeight:1.15}}>{tier.label}</div>
        {/* Scoring line — the big anchor, churns up to +bonus */}
        <div style={{fontSize:ipadTour(len>=9?54:46),fontWeight:"bold",color:"#f6d365",lineHeight:1,textShadow:`0 2px 16px ${tier.glow}`,marginBottom:ipadTour(2)}}>+{shown.toLocaleString()}</div>
        {/* Chest — tier-selected image (fill level = finish size) */}
        <img src={chestSrc} alt="" style={{display:"block",width:chestW,height:"auto",margin:"0 auto",filter:`drop-shadow(0 10px 24px ${tier.glow})`,animation:"plClearL2 0.8s cubic-bezier(.34,1.56,.64,1) forwards"}}/>
        {/* Dismiss button beneath the chest */}
        <button onClick={onDismiss} style={{marginTop:ipadTour(2),background:"linear-gradient(135deg,#f6d365,#fda085)",border:"none",borderRadius:14,padding:`${ipadTour(12)}px ${ipadTour(34)}px`,fontSize:ipadTour(17),fontWeight:"bold",color:"#3a2410",fontFamily:"Georgia,serif",cursor:"pointer",boxShadow:"0 4px 16px rgba(0,0,0,0.5)"}}>Dismiss Page</button>
      </div>
    </div>
  );
}
// Tiles: 2.2× (38→84, 44→97, 17→37, 7→15). Chrome (buttons/labels): 1.5×.
// Welcome card fonts: 1.3×, padding: 1.4×. App icon: 1.8× on iPad.

const LETTER_VALUES = {};
const SCORE_MAP = {
  E:3,T:3,A:4,I:4,O:4,N:4,S:5,R:5,
  H:6,L:6,D:6,C:7,U:7,M:7,F:8,P:8,
  G:9,W:9,Y:9,B:10,V:11,K:12,
  X:15,J:16,Q:20,Z:22
};
"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(l => { LETTER_VALUES[l] = SCORE_MAP[l] || 5; });

const MW_COLLEGIATE_KEY = import.meta.env.VITE_MW_COLLEGIATE_KEY || "6c41ef2c-8c1d-440a-b04a-24e623cf68e1";
const MW_MEDICAL_KEY    = import.meta.env.VITE_MW_MEDICAL_KEY    || "05a10875-f553-43f6-be64-6dafcdb4152e";

function getDailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

// ── Haptic feedback helper (May 15, 2026) ─────────────────────
// Fires iOS native vibration feedback when running inside Capacitor. Silent
// no-op on web. Three intensities:
//   "light"   — tile taps, selections
//   "medium"  — successful word submission
//   "heavy"   — major celebrations (Perfect Day, BOARD CLEAR)
// Pre-load plugin once after first call so subsequent triggers are instant.
let _hapticsPlugin = null;
let _hapticsLoadAttempted = false;
function triggerHaptic(intensity) {
  try {
    if (typeof window === "undefined" || !window.Capacitor) return;
    if (!window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return;
    const fire = (mod) => {
      const ImpactStyle = mod.ImpactStyle || {};
      const style = intensity === "heavy" ? ImpactStyle.Heavy
                 : intensity === "medium" ? ImpactStyle.Medium
                 : ImpactStyle.Light;
      mod.Haptics.impact({ style }).catch(() => {});
    };
    if (_hapticsPlugin) { fire(_hapticsPlugin); return; }
    if (_hapticsLoadAttempted) return;
    _hapticsLoadAttempted = true;
    import("@capacitor/haptics").then(mod => { _hapticsPlugin = mod; fire(mod); }).catch(() => {});
  } catch (e) {
    // silent — never break gameplay because haptics failed
  }
}

// Convert a date_key string like "2026-5-10" to a sortable integer 20260510.
// This avoids lexicographic comparison bugs where "2026-5-10" is treated as
// less than "2026-5-3" because '1' < '3' character-wise.
function dateKeyToNum(key) {
  if (!key || typeof key !== "string") return 0;
  const parts = key.split("-").map(p => parseInt(p, 10));
  if (parts.length !== 3 || parts.some(isNaN)) return 0;
  return parts[0] * 10000 + parts[1] * 100 + parts[2];
}
function getYesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}
function getWeekKey() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${monday.getMonth()+1}-${monday.getDate()}`;
}
function getCalendarDate() {
  return new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });
}
function getShortDate() {
  return new Date().toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });
}
function getShortDateCompact() {
  return new Date().toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
}
// Format a date_key string like "2026-5-7" → "May 7" (current year) or "May 7, 2025" (different year)
function formatDateKey(key) {
  if (!key) return "";
  const parts = key.split("-").map(p => parseInt(p, 10));
  if (parts.length !== 3 || parts.some(isNaN)) return "";
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) return "";
  const thisYear = new Date().getFullYear();
  return d.getFullYear() === thisYear
    ? d.toLocaleDateString("en-US", { month:"short", day:"numeric" })
    : d.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
}
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function getLongWordBonus(length) {
  if (length < 8) return 0;
  if (length === 8) return 1;
  if (length === 9) return 3;
  if (length === 10) return 6;
  if (length === 11) return 10;
  if (length === 12) return 15;
  if (length === 13) return 25;
  return 25 + (length - 13) * 10;
}
// ── Board-Clear Finisher bonus (Item: Finisher, v185) ─────────────────────────
// The bonus awarded to a word that SUCCESSFULLY CLEARS THE BOARD, scaled by length.
// Scale (Daryl; "may change"): 5=100, 6=500, 7=1,000, 8=2,000, then +1,500/letter above 8.
// Sub-5 clears get NO finisher (0). This is the single source of truth for the point value;
// v185 only READS it for instrumentation/preview — no scoring is applied to gameplay yet.
function finisherBonus(length) {
  if (length < 5) return 0;
  if (length === 5) return 100;
  if (length === 6) return 500;
  if (length === 7) return 1000;
  if (length === 8) return 2000;
  return 2000 + (length - 8) * 1500; // 9=3500, 10=5000, 11=6500, ...
}
// ── Bonus Level Helpers ───────────────────────────────────────
function isBonusLevel(level) { return ENABLE_BONUS_LEVELS && level >= 6; }
function getBonusLevelTileCount(level) { return BONUS_LEVEL_TILES[level] || 66; }
function calcBonusWordScore(tileIds, tiles) {
  // Bonus levels multiply base letter values by 1.5
  let score = 0;
  tileIds.forEach(id => {
    const tile = tiles.find(t => t.id === id);
    if (!tile) return;
    const baseVal = Math.round(tile.value * BONUS_LEVEL_MULTIPLIER);
    if (tile.bonus === "double") score += baseVal * 2;
    else if (tile.bonus === "triple") score += baseVal * 3;
    else score += baseVal;
  });
  return score;
}
function getBonusLevelUnlocked(statsData) {
  // Returns the highest bonus level the player has unlocked (or 0 if none)
  if (!ENABLE_BONUS_LEVELS) return 0;
  const streak = statsData.perfectDaysAllTime || 0;
  const consecutiveStreak = statsData.currentStreak || 0;
  if (consecutiveStreak >= BONUS_CONSECUTIVE_REQUIRED) return 6;
  return 0;
}
function getConsecutivePerfectDays(statsData) {
  return statsData.consecutivePerfectDays || 0;
}

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

const FREQ = { A:9,B:2,C:2,D:4,E:12,F:2,G:3,H:2,I:9,J:1,K:1,L:4,M:2,N:6,O:8,P:2,Q:1,R:6,S:4,T:6,U:4,V:2,W:2,X:1,Y:2,Z:1 };
function buildPool(rng) {
  const pool = [];
  Object.entries(FREQ).forEach(([l, c]) => { for (let i = 0; i < c; i++) pool.push(l); });
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool;
}
function getBonusCount(level) { return 1 + level; }
function getBonusPositions(count, bonusCount, rng) {
  const positions = [];
  while (positions.length < bonusCount) {
    const p = Math.floor(rng() * count);
    if (!positions.includes(p)) positions.push(p);
  }
  return positions;
}
// ── LOOT LETTER (v105: per-level rewrite) ───────────────────
// NEW premise (replaces the old one-hidden-tile-per-DAY system):
//   • EVERY level (1-5) has its own Loot Letter.
//   • The letter is ANNOUNCED at level start ("Level 3 Loot Letter = B").
//   • The board is guaranteed to contain >= 2 of that letter, but only ONE
//     tile is the actual loot ("only 1 tile pockets the loot") — the player
//     gambles on which. The loot tile is NOT visually marked until used.
//   • Any letter qualifies (no value floor).
//   • Reward unchanged: the loot tile scores 5x its base value, one-time
//     per game (see calcWordScore + word-submit detection — untouched).
//   • Deterministic from the daily seed, so all players share the same 5
//     Loot Letters each day.
// The letter picker is a PURE function of (level, dailySeed) — it does NOT
// consume the board-generation rng stream. This keeps the announcement text
// and the board in sync across every generation path (initial, next-level,
// reset, and the Date.now()-seeded Fresh-Tiles buy), because generation
// GUARANTEES the announced letter appears >= 2 times regardless of seed.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
// Per-level cap: high-value letters may appear at most twice (was effectively 1).
const HIGH_VALUE_CAP_LETTERS = ["Q","X","J","Z"];
const HIGH_VALUE_MAX = 2;

function getLootLetterForLevel(level) {
  const seed = getDailySeed();
  // Distinct offset per level so each level draws an independent letter, plus
  // the daily seed so it changes day-over-day and matches for all players.
  const rng = seededRandom(seed + 31337 + level * 101);
  // RNG WARMUP (carried from the May 18 2026 fix): the LCG produces correlated
  // first outputs for sequential/date-shaped seeds. Burn 3 outputs to
  // decorrelate so the letter distribution is uniform day-over-day and level-
  // over-level (the old bug locked selection into long repeating patterns).
  rng(); rng(); rng();
  return ALPHABET[Math.floor(rng() * ALPHABET.length)];
}

// Apply per-level letter caps to a letters array IN PLACE.
//   1) Trim any HIGH_VALUE_CAP_LETTERS beyond HIGH_VALUE_MAX (replace extras
//      with filler), and
//   2) Enforce the Q/U pairing rule: at least as many U's as Q's (>=1 per Q;
//      2 Q's require >= 2 U's).
// protectIdxs is a Set of tile indices that must NOT be altered (the loot tiles,
// so capping never removes an announced Loot Letter). Runs AFTER loot placement.
function applyLetterCaps(arr, protectIdxs, lootLetter) {
  const protect = protectIdxs || new Set();
  // (1) Cap high-value letters at HIGH_VALUE_MAX each (never touch protected tiles).
  HIGH_VALUE_CAP_LETTERS.forEach(letter => {
    let idxs = arr.map((l, i) => l === letter ? i : -1).filter(i => i >= 0 && !protect.has(i));
    const protectedCount = arr.filter((l, i) => l === letter && protect.has(i)).length;
    let allowedToRemain = Math.max(0, HIGH_VALUE_MAX - protectedCount);
    while (idxs.length > allowedToRemain) {
      const removeAt = idxs.pop();
      arr[removeAt] = "E";              // common filler; safe, low value
    }
  });
  // (2) Q/U pairing: ensure U count >= Q count. Convert only non-vowel, non-Q,
  //     unprotected tiles into U — AND never convert a tile of the loot letter,
  //     so the board keeps its guaranteed >= 2 instances of the announced letter.
  const qCount = arr.filter(l => l === "Q").length;
  let uCount = arr.filter(l => l === "U").length;
  let guard = 0;
  while (uCount < qCount && guard < arr.length) {
    const replaceIdx = arr.findIndex((l, i) => !["Q","A","E","I","O","U"].includes(l) && l !== lootLetter && !protect.has(i));
    if (replaceIdx === -1) break;       // nothing safe left to convert
    arr[replaceIdx] = "U";
    uCount++;
    guard++;
  }
}

// Guarantee the announced Loot Letter appears >= 2 times on this board, then
// mark exactly one of its tiles as the loot tile (MUTUALLY EXCLUSIVE with
// double/triple bonus squares). Mutates letters in place; returns loot index.
function placeLootLetter(letters, lootLetter, bonusSet, rng) {
  let idxs = letters.map((l, i) => l === lootLetter ? i : -1).filter(i => i >= 0);
  // Ensure there is at least one NON-bonus instance to be the loot tile, and at
  // least 2 instances total. Inject by replacing filler tiles that are NOT
  // vowels, NOT bonus squares, and NOT already the loot letter.
  const needNonBonus = () => idxs.some(i => !bonusSet.has(i));
  let inject = 0;
  while ((idxs.length < 2 || !needNonBonus()) && inject < letters.length) {
    const replaceIdx = letters.findIndex((l, i) =>
      l !== lootLetter && !VOWELS.has(l) && !bonusSet.has(i)
    );
    if (replaceIdx === -1) break;       // extremely unlikely; give up gracefully
    letters[replaceIdx] = lootLetter;
    idxs = letters.map((l, i) => l === lootLetter ? i : -1).filter(i => i >= 0);
    inject++;
  }
  // Pick the loot tile among NON-bonus instances (mutual exclusivity). Falls
  // back to any instance only in the pathological case none are non-bonus.
  const nonBonus = idxs.filter(i => !bonusSet.has(i));
  const pickFrom = nonBonus.length > 0 ? nonBonus : idxs;
  if (pickFrom.length === 0) return -1;
  return pickFrom[Math.floor(rng() * pickFrom.length)];
}

function generateLevelTiles(level, startId, rng, bonusPositions) {
  const pool = buildPool(rng);
  const count = 42 + (level - 1) * 7;
  let letters = pool.slice(0, count);
  const bonusSet = new Set(bonusPositions);
  // 1) Place the per-level Loot Letter FIRST (guarantees >=2 of the announced
  //    letter + one non-bonus instance to be the loot tile).
  const lootLetter = getLootLetterForLevel(level);
  const lootTileIndex = placeLootLetter(letters, lootLetter, bonusSet, rng);
  // 2) Apply caps AFTER loot placement, protecting the loot tile so a Loot
  //    Letter of Q/X/J/Z can't be demoted, and so a loot injection that added a
  //    Q still gets its matching U(s) from the pairing pass.
  const protect = lootTileIndex >= 0 ? new Set([lootTileIndex]) : new Set();
  applyLetterCaps(letters, protect, lootLetter);
  return letters.map((l, i) => ({
    id: startId + i, letter: l, value: LETTER_VALUES[l], used: false,
    bonus: bonusPositions.includes(i) ? (Math.random() < 0.5 ? "double" : "triple") : null,
    isLoot: i === lootTileIndex,
  }));
}
// v109: hideLoot suppresses the 5x for the LIVE running-score display only, so a
// player can't identify which of the >=2 matching tiles is the loot by watching the
// counter jump. The 5x is still fully applied on submit (hideLoot omitted/false).
function calcWordScore(tileIds, tiles, hideLoot) {
  let score = 0;
  tileIds.forEach(id => {
    const tile = tiles.find(t => t.id === id);
    if (!tile) return;
    let val = tile.value;
    if (tile.isLoot && !tile.lootUsed && !hideLoot) val = tile.value * 5; // Loot Letter: 5x base value (one per level, once each)
    if (tile.bonus === "double") score += val * 2;
    else if (tile.bonus === "triple") score += val * 3;
    else score += val;
  });
  return score;
}

const VOWELS = new Set(["A","E","I","O","U"]);
const LEVEL_BUY_COST = [0, 250, 500, 750, 1000, 1000];

// ── BONUS LEVELS FEATURE FLAG ─────────────────────────────────
// Set to true when ready to enable bonus levels (Level 6+)
const ENABLE_BONUS_LEVELS = false;

const BONUS_LEVEL_NAMES = {
  6: "The Vault",
  7: "The Sanctum",
  8: "The Summit",
  9: "The Cosmos",
  10: "Infinity",
};
const BONUS_LEVEL_EMOJIS = { 6:"🏛️", 7:"💫", 8:"🏔️", 9:"🌌", 10:"∞" };
const BONUS_LEVEL_TILES  = { 6:66, 7:72, 8:78, 9:84, 10:90 };
const BONUS_LEVEL_MULTIPLIER = 1.5; // all letter values ×1.5 on bonus levels
const BONUS_CONSECUTIVE_REQUIRED = 3; // perfect days in a row to unlock Level 6
// Beyond L6: each subsequent bonus level requires clearing the previous bonus level
// with a Perfect Day (no buys, no retries) on that same session

// ── Badge definitions ─────────────────────────────────────────
const BADGE_DEFS = [
  // ── Single Word Score Badges ──
  { id:"rocket",       icon:"🚀",   label:"Rocket",          desc:"Score 100+ in one word",                cat:"core",    scope:"lifetime" },
  { id:"shuttle",      icon:"🛸",   label:"Space Shuttle",   desc:"Score 125+ in one word",                cat:"core",    scope:"lifetime" },
  { id:"moon",         icon:"🌙",   label:"Moon",            desc:"Score 150+ in one word",                cat:"core",    scope:"lifetime" },
  { id:"mars",         icon:"🔴",   label:"Mars",            desc:"Score 175+ in one word",                cat:"core",    scope:"lifetime" },
  { id:"infinity",     icon:"∞",    label:"Infinity",        desc:"Score 200+ in one word — your best!",   cat:"core",    scope:"lifetime" },
  // ── Game Completion Badges ──
  { id:"first_word",   icon:"✨",   label:"First Loot",      desc:"Complete your first game",              cat:"level",   scope:"lifetime" },
  { id:"level_5",      icon:"💎",   label:"Diamond Looter",  desc:"Complete Level 5",                      cat:"level",   scope:"lifetime" },
  { id:"daily_500",    icon:"🏆",   label:"Loot Master",     desc:"5 levels complete with 2,000+ pts",     cat:"level",   scope:"lifetime" },
  { id:"daily_1000",   icon:"💰",   label:"Treasure Chest",  desc:"5 levels complete with 3,000+ pts",     cat:"level",   scope:"lifetime" },
  { id:"perfect_day",  icon:"🌈🏆", label:"Perfect Day",     desc:"No buys, resets, or re-dos",            cat:"level",   scope:"lifetime" },
  // ── Perfect Day Speed Badges ──
  { id:"pd_dawdler",   icon:"🐢",   label:"The Dawdler",     desc:"Perfect Day in under 30 minutes",       cat:"level",   scope:"lifetime" },
  { id:"pd_scooter",   icon:"🛴",   label:"Scooter",         desc:"Perfect Day in under 15 minutes",       cat:"level",   scope:"lifetime" },
  { id:"pd_velocirap", icon:"🦖",   label:"Velociraptor",    desc:"Perfect Day in under 12 minutes",       cat:"level",   scope:"lifetime" },
  { id:"pd_flux",      icon:"⚡",    label:"Flux Capacitor",  desc:"Perfect Day in under 10 minutes — BTTF!",cat:"level",  scope:"lifetime" },
  // ── Speed Badges ──
  { id:"slow_lane",    icon:"🚶",   label:"Slow Lane Looter", desc:"Complete a level in under 5 min",      cat:"word",    scope:"lifetime" },
  { id:"left_lane",    icon:"🚗",   label:"Left Lane Looter", desc:"Complete a level in under 3 min",      cat:"word",    scope:"lifetime" },
  { id:"speed_demon",  icon:"🚓",   label:"Speed Demon",     desc:"Complete a level in under 2 min",       cat:"word",    scope:"lifetime" },
  { id:"ferrari",      icon:"🏎️",   label:"Ferrari Looter",  desc:"Complete a level in under 1:30",        cat:"word",    scope:"lifetime" },
  // ── Word Length Badges ──
  { id:"long_8",       icon:"📜",   label:"OctoLooter",      desc:"Spell an 8-letter word",                cat:"core",    scope:"lifetime" },
  { id:"long_10",      icon:"🦅",   label:"Long Looter",     desc:"Spell a 10-letter word",                cat:"core",    scope:"lifetime" },
  { id:"long_13",      icon:"📚",   label:"Wordsmith",       desc:"Spell a 13+ letter word",               cat:"core",    scope:"lifetime" },
  // ── Lifetime Points Badges ──
  { id:"points_1k",    icon:"💫",   label:"1K Points",       desc:"Accumulate 1,000 lifetime points",      cat:"alltime", scope:"lifetime" },
  { id:"points_5k",    icon:"⭐",   label:"5K Points",       desc:"Accumulate 5,000 lifetime points",      cat:"alltime", scope:"lifetime" },
  { id:"points_10k",   icon:"🌠",   label:"Meteor",          desc:"Accumulate 10,000 lifetime points",     cat:"alltime", scope:"lifetime" },
  { id:"points_100k",  icon:"☄️",   label:"Comet",           desc:"Accumulate 100,000 lifetime points",    cat:"alltime", scope:"lifetime" },
  { id:"points_1m",    icon:"🌌",   label:"Galaxy",          desc:"Accumulate 1,000,000 lifetime points",  cat:"alltime", scope:"lifetime" },
  // ── Streak & Special Badges ──
  { id:"streak_7",     icon:"🔥",   label:"Week Streak",     desc:"Play 7 days in a row",                  cat:"alltime", scope:"lifetime" },
  { id:"streak_30",    icon:"👑",   label:"Month Streak",    desc:"Play 30 days in a row",                 cat:"alltime", scope:"lifetime" },
  { id:"no_retreat",   icon:"🎖️",   label:"No Retreat",      desc:"Complete level without resetting",      cat:"word",    scope:"lifetime" },
  { id:"medical_word", icon:"⚕️",   label:"Doctor's Orders", desc:"Use a medical dictionary word",         cat:"core",    scope:"lifetime" },
  { id:"all_time_100", icon:"🐉",   label:"Dragon",          desc:"100 words in a row, no misspellings",   cat:"alltime", scope:"lifetime" },
  { id:"perfect_q",    icon:"Q",    label:"Q Master",        desc:"Use Q in an 8+ letter word",            cat:"core",    scope:"lifetime" },
];

// ── Session-significant badges ──────────────────────────────────
// These badges celebrate every game they're earned in (not just the first lifetime earn).
// Only the TOP tiers of each category — lesser achievements still log silently to lifetime.
// Categories per Daryl's spec (May 2026):
//   Top 3 score badges: moon (150+), mars (175+), infinity (200+)
//   Top 2 length badges: long_10, long_13
//   Top 2 speed badges: ferrari (<90s), speed_demon (<120s)
//   Top 2 Perfect Day speed: pd_velocirap (<12min), pd_flux (<10min)
//   Special: medical_word, perfect_q
//   Plus base perfect_day (headline achievement always worth celebrating)
const SESSION_BADGE_IDS = new Set([
  // Top 3 score-based word badges
  "moon", "mars", "infinity",
  // Top 2 word length badges
  "long_10", "long_13",
  // Top 2 speed badges (level clear times)
  "ferrari", "speed_demon",
  // Perfect Day + top 2 PD speed badges
  "perfect_day", "pd_velocirap", "pd_flux",
  // Special word badges (medical word every time, Q-master every time)
  "medical_word", "perfect_q",
]);

// ── Doubloon SVG ──────────────────────────────────────────────
function DoubloonIcon({ size = 40 }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="df" cx="50%" cy="40%" r="55%"><stop offset="0%" stopColor="#FFE566"/><stop offset="60%" stopColor="#F5C518"/><stop offset="100%" stopColor="#C8920A"/></radialGradient>
        <radialGradient id="dr" cx="50%" cy="35%" r="60%"><stop offset="0%" stopColor="#D4A017"/><stop offset="100%" stopColor="#7A5200"/></radialGradient>
        <radialGradient id="ds" cx="35%" cy="28%" r="42%"><stop offset="0%" stopColor="#FFF9C0" stopOpacity="0.75"/><stop offset="100%" stopColor="#F5C518" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="url(#dr)"/>
      <circle cx="100" cy="100" r="91" fill="none" stroke="#6B4400" strokeWidth="2"/>
      {[0,15,30,45,60,75,90,105,120,135,150,165,180,195,210,225,240,255,270,285,300,315,330,345].map((deg,i) => {
        const rad = deg * Math.PI / 180;
        return <circle key={i} cx={100 + 95*Math.cos(rad)} cy={100 + 95*Math.sin(rad)} r="3" fill="#6B4400"/>;
      })}
      <circle cx="100" cy="100" r="82" fill="url(#df)"/>
      <circle cx="100" cy="100" r="75" fill="none" stroke="#6B4400" strokeWidth="2"/>
      <circle cx="100" cy="100" r="70" fill="none" stroke="#4A2E00" strokeWidth="1"/>
      <text x="100" y="78" textAnchor="middle" fontFamily="Georgia,serif" fontSize="20" fontWeight="bold" fill="#2A1400" letterSpacing="5">LL</text>
      <rect x="67" y="90" width="52" height="16" rx="2" fill="#2A1400"/>
      <rect x="67" y="90" width="48" height="16" rx="2" fill="#E8A800"/>
      <rect x="67" y="90" width="48" height="5" rx="2" fill="#F5C518" opacity="0.8"/>
      <rect x="67" y="90" width="9" height="16" rx="1" fill="#B0B0B0"/>
      <polygon points="115,90 128,98 115,106" fill="#C8922A"/>
      <polygon points="128,95 136,98 128,101" fill="#2A1400"/>
      <rect x="67" y="90" width="5" height="16" rx="1" fill="#1A6E35"/>
      <text x="100" y="136" textAnchor="middle" fontFamily="Georgia,serif" fontSize="22" fontWeight="bold" fill="#2A1400">100</text>
      <path id="darc" d="M 43,72 A 60 60 0 0 1 157,72" fill="none"/>
      <text fontFamily="Georgia,serif" fontSize="11" fontWeight="bold" fill="#2A1400" letterSpacing="3"><textPath href="#darc" startOffset="50%" textAnchor="middle">CENTURY</textPath></text>
      <circle cx="100" cy="100" r="82" fill="url(#ds)"/>
    </svg>
  );
}

// ── Dictionary ─────────────────────────────────────────────────
const wordCache = {};
// Common words fallback — used when MW API is unreachable
const COMMON_WORDS = new Set("the and for are but not you all can her was one our out day get has him his how its may new now old see two way who boy did let put say she too use add age ago air bad big bit car cut ear eat end far few fly got had hot ice job joy key kid law lay lid lot low man map mix net off oil own pan pay pen pet pit pop pot ran raw red rid rim rip rod row rub run sad sat saw sea set shy sin sit six sky sob son sow soy spy sun tab tan tap tar tax tea ten tie tin tip toe ton top toy tub tug urn van vat via vie vow war wax web wed wet wig win wit woe won yam yap yaw yea yes yet yew zap ace act ado aft ale amp ant ape arc ark ash ask asp ate awe awl axe aye bag ban bar bat bay bed beg bet bid bog bow bud bug bun bus cab cob cod cog cop cot cub cud cup dab dag dam dip doe dog don dot dry dub due dug dye eel egg ego elk elm emu eta eve ewe fad fan fat fax fed fen fib fig fin fit fix fob foe fog fop fox fry fur gab gag gap gar gas gay gem gig gnu gob god gum gun gut guy gym hag ham hap hat hay hen hew hey hid hip hit hob hoe hog hop hub hug hum hun hut ilk imp ink inn ion ire ivy jab jag jar jaw jay jib jig jog jot jug jut keg kin kit lab lad lag lap lax lea led leg lip lit log lop lug mad mar mat maw met mew mob mod mom mop mow mud mug nab nag nap nib nil nip nit nob nod nor nun oaf oak oar oat odd ode oft ohm opt orb ore owe owl pad pal pap par pat paw pea peg per pie pig pin ply pod pro pub pug pun pup pus rad rag raj ram rap rat ray reb ref rem rep rev rib rob rot rug rut rye sac sag sap sew sex sir ski sly sty sub sue sum sup tag tam tee thy tic tod tor tot tow try tun ugh vex vim wad wag wee woo yak zag zig zip zit zoo abs ads alb arb ass bib bop bub cad cam dim din dun duо fez fir gal gam gyp lac luv med cap able acid aged also area army away baby back ball band bank base bath bear beat been beer bell belt best bird bite blow blue boat bold bomb bond bone book boot born both bowl burn bush busy call calm came camp card care cart case cash cast cave city clam clap clay clip coal coat code coil cold come cook cool cope copy cord core corn cost crew crop cube cure curl damp dark date dawn dead deaf deal dear debt deck deed deep deny desk dial died diet dirt disk dock dome done door dose down draw drew drop drum dual dumb dump dune dusk dust each earn east easy edge even ever evil exam exit fact fade fail fair fall fame farm fast fate fear feat feel feet fell felt file fill film find fire firm fish fist flag flat flew flip flow foam fold folk fond food foot ford fore fork form fort four free from fuel full fund fury fuse gate gave gear gift girl give glad glee glue goal goes gold golf gone good grab gray grew grim grin grip grow gulf gust halt hand hang hard hare harm harp hate have hawk head heal heap heat heel held helm help herb here high hill hire hold hole home hood hope horn host hour huge hull hung hunt hurt idea idle inch into iron item jail jell jest join joke jump jury just keen keep kill kind king knew know lack laid lake lame land lane lark last late lawn lead leaf lean leap left lend less levy lied life lift like lily limp line link lion list live load loan loft lone long look lore lose loss lost loud love luck lump lung made maid mail main make male malt mane mare mark aby baa aal abb aby baa".split(" "));

// ── Custom whitelist — words MW rejects but are valid English ──
// Add words here as players report them and you verify them
const CUSTOM_WHITELIST = new Set([
  "acquisitioning",
  "summiting",
  "podiuming",
  "medaling",
  "medalled",
  "medalling",
  "googled","googling","tweeted","tweeting","tweets",
  "selfie","selfies",
  "texting","texted",
  "unfriending","unfriended","unfriend",
  "trending","retweet","retweeted",
  "blogged","blogging","blogger",
  "podcasting","podcaster",
  "livestreamed","livestreaming","livestream",
  "screenshotted","screenshotting","screenshot",
  "uploaded","uploading","upload","downloads","downloaded","downloading",
  "emailed","emailing",
  "phoned","phoning",
  "videoed","videoing",
]);

// ── Profanity filter (moderate strictness) ─────────────────────────────────
// Used in TWO places:
//   1. validateWord() — block profane dictionary words from scoring during play
//   2. signup/nickname/name-edit — block profane display names from leaderboards
// Strategy: substring match against canonicalized text (lowercase, leetspeak
// reversed, separators removed). Catches "fuck", "F U C K", "f.u.c.k", "fuk",
// and common embeddings. False positives possible on names like "Scunthorpe"
// — acceptable tradeoff for App Store guideline 1.1.3 (objectionable content)
// and 1.2 (user-generated content moderation) compliance.
const PROFANITY_LIST = [
  // F-word and variants
  "fuck","fuk","fck","phuck","fuq",
  // S-word and variants
  "shit","sh1t","shyt",
  // C-word and variants
  "cunt","kunt",
  // N-words (racial slurs)
  "nigger","nigga","nigr",
  // F-slur (homophobic)
  "faggot","fagot","fagg",
  // Anti-Semitic slurs
  "kike","jewboy",
  // Anti-Asian slurs
  "chink","gook",
  // Anti-Hispanic slurs
  "spic","wetback",
  // Misogynistic slurs
  "whore","slut","cuntface",
  // R-slur (ableist)
  "retard","retarded","tard",
  // Other hard slurs
  "tranny",
  // Sexual / explicit
  "cock","dick","pussy","penis","vagina","boobs","tits","titties",
  "blowjob","handjob","rimjob","cumshot","jizz","jism","semen",
  "anal","anus","asshole","arsehole",
  "pedo","pedophile","paedo",
  "rape","rapist","raping",
  // Bestiality / extreme
  "bestiality","zoophilia",
  // Common combinations
  "motherfucker","mfer","mofo","bullshit","horseshit","jackass",
  "dickhead","cocksucker","fucker","fucking","fucked","sucker",
];
const PROFANITY_SET = new Set(PROFANITY_LIST);
const LEET_MAP = { "0":"o","1":"i","3":"e","4":"a","5":"s","7":"t","8":"b","@":"a","$":"s","!":"i" };
function canonicalize(text) {
  if (!text) return "";
  let s = String(text).toLowerCase();
  // Replace leetspeak digits/symbols with letter equivalents
  s = s.replace(/[01345789@$!]/g, ch => LEET_MAP[ch] || ch);
  // Strip everything except letters
  s = s.replace(/[^a-z]/g, "");
  return s;
}
function containsProfanity(text) {
  if (!text) return false;
  const canon = canonicalize(text);
  if (!canon) return false;
  // Exact match (fastest)
  if (PROFANITY_SET.has(canon)) return true;
  // Substring match — catches embeddings like "ifuckyou", "f_u_c_k", etc.
  // Used for DISPLAY NAMES where embedding is the concern.
  for (const bad of PROFANITY_LIST) {
    if (canon.includes(bad)) return true;
  }
  return false;
}
// EXACT-MATCH ONLY — used for dictionary validation during gameplay.
// "analyze" contains "anal" but is a real word, so we only block when the
// entered word IS the profanity (or a known inflection of it).
function isProfaneWord(text) {
  if (!text) return false;
  const canon = canonicalize(text);
  if (!canon) return false;
  return PROFANITY_SET.has(canon);
}

// ── Word of the Day candidate pool ──
// Spans 4 to 12+ letters. Longer words are preferred (more impressive WoD),
// but the selector descends letter-by-letter when no longer candidate fits
// the day's tiles, ensuring every day has a playable WoD.
const WOTD_CANDIDATES = [
  // 4 letters — safety net only, used when no longer word fits today's boards
  "able","actor","also","area","army","baby","back","ball","band","bank","base","bath","bear","beat","been","beer","bell","best","bike","bill","bird","blue","boat","body","bone","book","born","both","boys","busy","cake","call","came","camp","care","case","cash","cell","city","club","coal","coat","code","cold","come","cook","cool","cope","copy","core","cost","crop","cure","cute","damp","dare","dark","data","date","dawn","days","dead","deal","dear","debt","deep","desk","dial","dirt","dish","does","done","door","draw","dust","duty","each","earn","east","easy","edge","else","even","ever","exam","exit","face","fact","fail","fair","fall","fame","fan","farm","fast","feed","feel","fees","feet","fell","felt","film","find","fine","fire","firm","fish","five","flag","flat","flew","food","foot","ford","form","fort","four","free","from","fuel","full","fund","game","gate","gave","gear","gift","girl","give","glad","goal","goat","gold","gone","good","grab","grew","gulf","hair","half","hall","hand","hang","hard","harm","hate","head","hear","heat","held","hell","help","here","hero","high","hill","hint","hire","hold","hole","holy","home","hope","host","hour","huge","hung","hunt","hurt","idea","inch","into","iron","item","join","jump","just","keep","kept","kick","kids","kind","king","knee","knew","know","lack","lady","laid","lake","lamp","land","lane","last","late","laws","lazy","lead","leaf","lean","left","legs","less","life","lift","like","line","link","lion","lips","list","live","load","loan","lock","logs","long","look","lord","lose","loss","lost","loud","love","luck","made","main","make","male","many","mark","mass","math","meal","mean","meat","meet","menu","mess","mile","milk","mind","mine","miss","mode","mood","moon","more","most","move","much","muse","must","name","near","neck","need","nest","news","next","nice","noon","norm","note","once","only","open","oral","over","pace","pack","page","paid","pain","pair","palm","park","part","pass","past","path","peak","pick","pile","pine","plan","play","plot","plus","poem","poet","pole","pond","poor","pope","port","post","pour","prep","pull","pure","push","quit","race","rage","rain","rank","rare","rate","read","real","rear","rely","rent","rest","rice","rich","ride","ring","rise","risk","road","rock","role","roll","roof","room","root","rose","rude","ruin","rule","rush","safe","said","sail","sake","sale","salt","same","sand","save","scan","seal","seat","seed","seek","seem","seen","self","sell","send","shop","shot","show","shut","sick","side","sign","silk","sing","sink","site","size","skin","slip","slow","snow","soap","soft","soil","sold","sole","some","song","soon","sort","soul","soup","span","spin","spot","star","stay","step","stop","such","suit","sure","swim","tail","take","tale","talk","tall","tank","task","team","tell","tent","term","test","than","that","them","then","they","thin","this","thus","tide","tile","time","tire","told","toll","tone","took","tool","torn","tour","town","tree","trip","true","tube","tune","turn","twin","type","ugly","unit","upon","used","user","vary","vast","very","vibe","view","vote","wage","wait","wake","walk","wall","want","ward","warm","warn","wash","wave","ways","weak","wear","week","well","went","were","west","what","when","whom","wide","wife","wild","will","wind","wine","wing","wire","wise","wish","with","wood","word","wore","work","worn","wrap","yard","yarn","year","yell","your","zero","zone",
  // 5-7 letters — common, broad vocabulary safety
  "about","above","added","after","again","agent","agree","ahead","alarm","album","alike","alive","alone","along","alter","among","anger","angle","angry","apart","apple","apply","arena","argue","arise","armed","array","aside","asked","asset","audio","avoid","award","aware","badge","baked","baker","based","basic","basis","beach","began","begin","begun","being","below","bench","bible","birth","black","blade","blame","blank","blast","blend","bless","blind","block","blood","bloom","blown","blues","board","boost","booth","bound","bowed","bowls","brain","brand","brass","brave","bread","break","brick","brief","bring","broad","broke","brown","build","built","burst","cabin","cable","calls","candy","carry","cause","cease","chain","chair","chalk","cheap","check","cheek","chess","chest","chief","child","chill","china","chips","civil","claim","class","clean","clear","clerk","click","cliff","climb","clock","close","cloth","cloud","clown","coach","coast","color","could","count","court","cover","craft","crash","cream","creek","crime","crisp","cross","crowd","crown","crude","cruel","cubic","curve","cycle","daily","dairy","dance","death","debit","debut","decay","decor","delay","delta","dense","depth","derby","diary","diner","dirty","ditch","diver","dollar","doors","doubt","dozen","draft","drain","drama","drawn","dream","dress","dried","drift","drill","drink","drive","drop","drove","dying","eager","eagle","early","earth","eight","elite","empty","enemy","enjoy","enter","entry","equal","error","essay","event","every","exact","exist","extra","faced","faint","faith","false","fancy","fault","favor","fence","fewer","field","fifth","fifty","fight","filed","final","finds","fired","first","fixed","flame","flash","fleet","flesh","float","flock","flood","floor","flour","fluid","flute","focus","foggy","forge","forth","forty","forum","found","frame","fraud","fresh","fried","front","frost","fruit","fudge","funny","gains","games","gates","ghost","giant","given","gives","glass","globe","gloom","glory","glove","going","goods","grace","grade","grain","grand","grant","grape","graph","grass","grave","gravy","great","greed","green","greet","grief","grill","grind","grins","group","grove","grown","guard","guess","guest","guide","guild","habit","hairy","handy","happy","harsh","haste","hatch","hated","haunt","heart","heavy","hedge","hello","hence","hills","hobby","hoist","honor","horse","hotel","house","hover","humor","hurry","ideal","image","imply","index","inner","input","issue","ivory","japan","jewel","joint","jolly","judge","juice","jumbo","keeps","kicks","kings","knife","knock","known","label","labor","large","laser","later","laugh","layer","leads","learn","lease","least","leave","legal","lemon","level","light","liked","limit","liner","links","loose","loved","lower","loyal","lucky","lunar","lunch","lying","macho","magic","major","maker","males","march","marsh","match","maybe","mayor","meals","means","medal","medium","merge","merit","merry","metal","meter","might","minor","minus","mixed","model","modem","money","month","moral","motor","mount","mouse","mouth","moved","movie","music","named","nasty","needs","never","newly","night","noble","noise","north","novel","nurse","nylon","ocean","offer","often","older","olive","onion","opera","optic","order","other","ought","outer","owned","owner","paint","panel","panic","paper","party","pasta","patch","peace","peach","pearl","penny","phase","phone","photo","piano","piece","pilot","pinch","pitch","pixel","place","plain","plane","plant","plate","plays","plaza","plead","plot","plumb","plume","plump","point","polar","pool","porch","posed","posts","pound","power","press","price","pride","prime","print","prior","prize","probe","proof","proud","prove","proxy","pulse","punch","pupil","queen","query","queue","quick","quiet","quite","quote","radar","radio","raise","range","rapid","ratio","reach","ready","realm","rebel","refer","regal","reign","relax","remix","reply","reset","resin","rider","rifle","right","risen","river","robot","rocky","roman","rough","round","route","royal","rugby","rural","sacred","saint","sales","sandy","sauce","scale","scare","scene","scope","score","screw","seats","seeks","seems","sense","seven","sewer","shade","shake","shape","share","sharp","sheep","sheet","shelf","shell","shift","shine","shirt","shock","shoes","short","shout","shown","sigh","sight","silly","silver","since","sixth","sized","skate","skill","slate","sleep","slice","slide","slope","small","smart","smash","smell","smile","smoke","snake","snowy","solar","solid","solve","sorry","sound","south","space","spare","spark","speak","speed","spell","spend","spent","spice","spike","spine","spiny","split","spoil","spoke","sport","spray","spread","spring","spurt","squad","stack","staff","stage","stain","stamp","stand","stare","start","state","steel","stem","steps","stick","still","stock","stone","stood","store","storm","story","stove","strip","stuck","study","stuff","style","sugar","suite","sunny","super","sweet","swept","swift","sword","table","taken","tales","taste","taxes","teach","teams","teeth","tells","tempo","tenor","tense","terms","texts","thank","theft","their","theme","there","these","thick","thief","thing","think","third","those","three","threw","throw","thumb","tiger","tight","tiled","timer","times","tired","title","toast","today","topic","total","touch","tough","tower","toxic","trace","track","trade","trail","train","trait","trash","tread","treat","trend","trial","tribe","trick","tries","truck","truly","trust","truth","tubes","tulip","tunes","turbo","turns","twice","twins","type","ultra","uncle","under","union","unite","unity","until","upper","upset","urban","usage","using","utter","valid","value","valve","vapor","vault","verse","video","villa","viral","virus","visit","vital","vivid","vocal","voice","voted","voter","wagon","waist","waiting","waste","watch","water","weeds","weeks","weigh","weird","wheat","wheel","where","which","while","white","whole","whose","widen","width","wider","wired","witch","woman","women","words","works","world","worry","worse","worth","would","wound","write","wrong","wrote","yacht","yards","years","yield","young","yours","youth","zebra","zones","accept","across","action","active","actual","adjust","admire","admit","adopt","adult","affair","affect","afford","afraid","agency","airport","amount","ample","ankle","annual","answer","anyone","appeal","appear","aspect","attack","attain","attend","august","author","avenue","backup","badly","barber","barely","barley","basket","battle","beauty","became","become","before","behalf","behind","belong","beside","better","beyond","bishop","bitter","blamed","blanket","blocks","bloody","blowing","bottle","bottom","bought","boxer","branch","breeze","breath","bridge","bright","broken","budget","bumpy","bundle","burden","burial","buried","butter","button","camera","cancer","canyon","carbon","career","carpet","cattle","caught","center","chairs","chance","change","chapel","charge","charity","cheese","cherry","choice","choose","chosen","church","circle","clever","client","climax","clinic","closed","closer","cloudy","coffee","coffin","colors","column","combat","comedy","coming","common","cookie","corner","cosmic","cotton","county","couple","course","cousin","coyote","cradle","credit","crispy","critic","custom","damage","danced","danger","dating","dealer","debate","debris","decade","decide","decree","deepen","defeat","defend","define","degree","demand","denote","depend","deploy","deputy","derive","design","desire","detail","detect","device","devote","differ","dinner","direct","disarm","divide","divine","doctor","domain","donate","donkey","double","downward","dozens","dragon","driver","during","dynamic","easier","easily","editor","effect","effort","eighth","either","elders","eleven","embark","embers","empire","employ","enable","encode","ending","endure","energy","engage","engine","enroll","ensure","entail","entire","equate","equity","escape","estate","ethics","evolve","exceed","except","excess","excite","excuse","exempt","exotic","expand","expect","expert","expire","export","extend","facade","famine","family","fasten","fatigue","feeble","fellow","female","fender","fervor","fierce","figure","filing","filthy","finale","finally","finger","finish","fiscal","fixing","flames","flavor","flesh","floppy","flower","fluffy","flying","follow","forbid","forced","forest","forgot","formal","format","former","fossil","fought","fourth","fraud","freedom","frenzy","fridge","friend","frozen","fungus","further","future","gadget","galaxy","garage","garden","garlic","gather","gender","gentle","gently","ghosts","giants","giggle","gladly","gloomy","gospel","gossip","govern","grades","ground","growth","guards","guilty","gypsy","handle","happen","harbor","hardly","harden","harvest","hawks","hazard","headed","health","helmet","hereby","heroes","hidden","higher","hiking","hockey","holder","hollow","holler","honest","horror","hotter","humble","humbly","hungry","hunter","hybrid","ignite","ignore","impact","import","impose","improve","income","induce","inform","injury","inland","insect","inside","insist","intact","intend","invade","invent","invest","invite","island","jacket","jaguar","jersey","jockey","jovial","joyful","jungle","junior","juror","kettle","kindly","kitten","ladder","lagoon","lament","lately","launch","laundry","lawyer","leader","league","leaves","ledger","legacy","legend","leisure","length","lesson","lethal","letter","levels","liable","liberty","linked","liquid","listen","little","living","locate","logic","longer","longing","lovers","loving","lowest","lumber","lunar","luxury","madame","magnet","mainly","makeup","malice","manage","manner","manual","marble","margin","marine","marked","market","marrow","marvel","master","matter","mature","meadow","medium","melody","member","memoir","memory","mental","mentor","method","midway","minded","mining","minute","mirror","misery","missed","mister","modest","modify","module","moment","mostly","mother","motion","motive","moving","muscle","museum","mutual","mythic","narrow","nation","native","nature","nearby","nearly","needed","needle","nephew","nervous","nimble","nobody","normal","notice","notion","novel","number","object","oblige","obtain","occupy","ocean","octave","office","offset","online","openly","option","orange","orbit","orchid","orderly","organic","ornate","outcry","outdid","outdo","outfit","output","outset","oxygen","packed","palace","parade","parent","parlor","partly","passed","patrol","payday","peanut","pencil","people","perish","permit","person","petite","phrase","picked","picnic","pickup","pierce","pillar","pilots","pirate","piston","placid","planet","plants","plenty","ploys","plunge","pocket","poetry","points","poison","police","polish","polite","ponder","popular","portal","potato","powder","prayer","praise","precise","prefer","prep","preset","presto","pretty","prevent","priest","primary","prince","prison","privy","prized","profit","prompt","proper","prosper","proven","public","pumpkin","purple","purpose","pursue","python","quaint","quarrel","quarry","quartz","query","quench","quench","quirky","racket","radial","raisin","rampant","random","rarely","rather","ravage","reader","really","reason","recall","recent","recipe","record","reduce","regard","region","regret","reject","relate","relax","relent","relief","remain","remark","remedy","remind","remote","remove","repair","repeat","report","rescue","resign","resist","resort","result","resume","retail","retain","return","reveal","review","reward","rhythm","rigid","ritual","rocket","rocky","rodent","rolled","romantic","rookie","rotate","rotten","rubble","ruling","rumble","runner","sacred","sailor","salary","salmon","sample","sanity","savage","saving","saying","scared","scarf","scenic","scheme","school","scorn","scotch","scout","screen","script","scroll","sculpt","seabed","sealed","season","second","secret","sector","secure","seeing","seldom","select","semantic","senate","sender","sensor","series","sermon","servant","sesame","settle","seven","severe","shadow","shaman","shapely","shared","sharp","sheath","sheer","shield","shiny","shovel","shrewd","shrine","shrug","sicker","sigmoid","signal","silent","silken","silver","simple","simply","singer","single","sister","sketch","sleeve","slight","slogan","slowly","smooth","social","socket","sodden","softly","solely","sorrow","soundly","source","sovereign","spacious","sparse","speech","sphere","spider","spiked","spirit","sponge","spoken","spouse","spread","spring","sprint","square","stable","stamp","staple","static","statue","status","steady","steam","steel","stereo","stigma","stocky","strain","strand","strange","stream","street","stress","strict","strike","string","stripe","strive","strode","stroke","strong","strove","struck","studio","stupid","subtle","subway","sudden","suffer","summer","summit","sunset","supply","surely","survey","switch","symbol","syntax","system","tablet","tackle","tailor","taught","tavern","temper","temple","tender","tennis","theory","thirty","though","thrice","thrift","thrive","throne","throng","ticket","tinker","tingle","tiptoe","tissue","toggle","tomato","topple","torpor","toward","towards","trace","tragic","trance","travel","treaty","tribe","trickle","triple","tropic","trophy","trouble","trough","trying","tumble","tunnel","turbid","turkey","turtle","tutor","tweak","twelve","twenty","twirl","typhoon","unable","unborn","uncle","undergo","undue","unfair","unfit","unfold","unify","union","unique","unite","unjust","unkind","unlike","unload","unlock","unpack","unreal","unrest","unsafe","unseat","unseen","unsung","untold","unveil","unwary","unwell","update","upheld","uphold","upland","uplift","upper","uproar","uproot","upside","uptake","uptown","urgent","urging","useful","uses","usher","usual","utmost","utter","vacant","valley","vaster","veiled","vendor","venue","verbal","verge","verify","versus","vertex","vessel","veteran","viable","victim","virgin","virtue","vision","visual","vital","vivid","vocal","volume","voters","voucher","voyage","walnut","wander","weaken","wealth","weapon","weasel","weather","wedded","wedge","weekend","weight","welder","whence","whilst","whisper","whoosh","wholly","wicked","widely","wider","wiggle","wilful","willing","window","winged","winter","wisdom","wishful","wisely","wither","wizard","wonder","wonderful","wooden","wooden","wooded","wool","worker","worldly","worship","wrench","wrinkle","writer","yearly","yellow","yonder","yummy","zealous","zenith","zipper",
  // 8 letters
  "absolute","academic","accuracy","activity","adequate","adoption","advanced","aircraft","airplane","alliance","analysis","ancestor","ancient","apparent","approach","approval","argument","artistic","attached","audience","balanced","baseball","beautiful","birthday","building","business","calendar","campaign","capacity","category","ceremony","children","civilian","classify","clinical","clothing","colossal","commerce","complete","computer","concrete","conflict","consider","constant","contains","contract","contrast","convince","creative","critical","cylinder","daughter","delicate","delivery","describe","designer","detailed","dialogue","diameter","director","disaster","discount","discover","distance","distinct","district","division","domestic","dominate","downtown","downward","dramatic","duration","economic","educated","electric","elephant","employee","engineer","enormous","entirely","envelope","equation","estimate","evaluate","everyday","everyone","evidence","exchange","exciting","exercise","existing","exposure","external","facility","familiar","fantastic","favorite","feedback","festival","football","forecast","fragment","frequent","friendly","function","graduate","graphics","grocery","handsome","hardware","heritage","hesitate","historic","holiday","homemade","honestly","hospital","humanity","humorous","hundred","identify","identity","increase","indicate","industry","infinite","informed","initiate","innocent","insomnia","inspired","intended","interest","internal","interval","intimate","involved","isolated","jewelry","journey","judgment","keyboard","kindness","kingdom","language","learning","lifetime","lighting","listener","location","loyalty","luminous","luxury","magnetic","majestic","marathon","material","maximum","measured","medieval","medicine","memorial","memorize","metaphor","midnight","military","mindful","minimum","minister","mistaken","monitor","mortgage","mountain","movement","multiple","mushroom","mystery","national","negative","neighbor","numerous","observer","obstacle","occasion","official","operator","opposite","optimist","organize","original","ornament","outdoors","overcome","overhead","overlook","overseas","painted","painting","parallel","particle","passport","patience","pavement","peaceful","peculiar","penalty","permanent","persuade","petition","physical","pioneer","platform","pleasant","portrait","positive","possible","practice","preserve","pressure","previous","priority","prisoner","probably","produced","property","proposal","provider","purchase","question","rainbow","rational","reaction","received","recovery","regional","register","regulate","relative","reliable","remember","reminder","reporter","resource","response","romantic","sandwich","scenario","schedule","seafood","security","separate","sequence","servant","shoulder","showcase","sideways","skeleton","software","solution","somebody","speaker","specific","spectrum","sponsor","standard","strategy","straight","stranger","strength","struggle","stunning","subjects","summary","superior","supplier","surgery","survival","sustain","syllable","sympathy","symphony","tangible","teacher","textile","thinking","thirteen","thousand","timeline","together","tolerate","tomorrow","tonight","tradition","training","transfer","traveler","tropical","tutorial","ultimate","umbrella","universe","upgraded","valuable","vehicle","velocity","vertical","vigorous","vineyard","virtuous","volcano","watching","wireless","wonderful","yourself",
  // 10 letters
  "abundance","accomplish","accordion","accurately","activity","adaptation","additional","adolescent","adventure","advertise","affection","affordable","afternoon","aggressive","alligator","altogether","ambassador","amazement","ambulance","analytical","apologize","appearance","appliance","architect","arithmetic","artificial","aspiration","assembled","astronomy","atmosphere","attendance","attractive","auditorium","authentic","automobile","background","basketball","beginning","beneficial","binoculars","blackberry","brilliant","calculator","candlestick","caterpillar","celebrate","chandelier","chemistry","chimpanzee","chocolate","cinematic","commitment","compassion","competent","completion","compliment","compromise","conference","consistent","contagious","convertible","corporation","correspond","creativity","crocodile","democratic","department","determine","devastate","dictionary","difference","disappear","discovery","downstairs","earthquake","ecosystem","editorial","educational","electrical","electronic","elementary","elevator","embarrass","emergency","employer","engineering","enjoyment","enthusiasm","entertain","environment","especially","everywhere","exaggerate","exceptional","experience","experiment","expression","fascinated","fingerprint","fortunately","foundation","framework","friendship","fundamental","generously","glamorous","greenhouse","headphones","helicopter","hilarious","historical","homestead","honeymoon","horoscope","horseshoe","hourglass","hurricane","illustrate","impressive","impromptu","improvement","incredible","industrial","ineffective","ingenious","innovative","inspection","instructor","instrument","interaction","invitation","journalism","kindness","laboratory","landscape","leadership","lighthouse","linguistic","literature","loneliness","loudspeaker","manuscript","masterpiece","mechanical","memorable","metaphor","microscope","miraculous","modernize","multimedia","mysterious","mythology","navigation","nightingale","noteworthy","obedience","objective","obligation","observation","occasional","occupation","officially","offspring","operation","oppressive","orchestra","outrageous","overshadow","overwhelm","palatable","parachute","particular","passenger","pedestrian","peninsula","perception","perfection","performer","persistent","photograph","picturesque","playground","political","powerhouse","practical","preference","preliminary","prevention","priority","procession","proficient","programming","prominent","propeller","prosperity","quarterly","raspberry","rebellion","recreation","reflection","registration","regulation","remarkable","reminisce","renowned","reputable","resistance","resolution","resourceful","restaurant","retirement","revelation","revitalize","revolution","ridiculous","sanctuary","satisfying","scholarly","scientific","screenplay","sensitivity","settlement","sightseeing","silhouette","sincerely","skillfully","skyscraper","smartphone","somersault","sophomore","sourdough","spaceship","spectacle","speculate","spiritual","spontaneous","stationary","stationery","stimulant","stockpile","strawberry","strenuous","stronghold","substantial","successful","sufficient","sunglasses","supernova","surprised","surrender","sweetheart","symbolize","tablespoon","tenacious","tenderness","themselves","thereafter","thoroughly","thunderbolt","thunderous","timekeeper","tomorrow","traditional","tranquility","translation","transmitter","transport","tremendous","triangular","triumphant","ultimately","unbelievable","unbreakable","underground","understand","underwater","unforgettable","university","unmistakable","unparalleled","unprecedented","upholstery","vegetation","ventilation","villainous","volunteer","voracious","wallflower","washboard","watercolor","watermelon","waterproof","whirlpool","wholesale","wilderness","windowsill","witnessed","workplace","yesterday",
  // 12+ letters (rarer, more impressive)
  "accommodate","achievement","acknowledge","alphabetical","appreciation","architecture","arrangement","astonishment","biographical","breathtaking","celebration","championship","cheerfulness","circumstance","civilization","collaborative","combination","commemorate","commercially","commonwealth","communicate","compensation","comprehensive","concentration","consciousness","consequently","conservation","considerable","construction","contemplation","contradiction","conversation","corresponding","craftsmanship","determination","disappointed","disagreement","disconnection","distinguished","documentary","dramatically","economically","effectiveness","efficiently","embarrassment","encyclopedia","entertainment","environment","established","evolutionary","exaggeration","extraordinary","fundamentally","generously","historically","horticulture","identification","illumination","imagination","immediately","impossibility","incredibly","independence","independently","indispensable","inflammation","infrastructure","intelligence","intentionally","interesting","international","interpretation","introduction","investigation","irreplaceable","irresistible","kaleidoscope","liberation","longitudinal","maintenance","manipulation","manufacturer","marvelously","mathematical","measurement","metropolitan","microscopic","misunderstand","negotiation","neighborhood","nonchalantly","observation","occasionally","operational","opportunity","organization","overshadowed","overwhelming","participation","particularly","perpendicular","philosophical","photographer","practically","precipitation","predicament","predictable","predominantly","preservation","procrastinate","professional","profoundly","proportional","psychological","questionnaire","recommendation","reconciliation","redistribute","regrettably","relationship","remembrance","reproduction","resourcefulness","respectfully","retrospective","revolutionize","satisfactory","significance","sophisticated","spectacular","spontaneously","standardize","statistical","sufficiently","superintendent","supernatural","surveillance","systematically","temperament","temptation","theoretical","thunderstorm","traditionally","transferable","transformation","transparency","transportation","tremendously","triumphantly","unbelievable","unbreakable","uncomfortable","unconscious","understanding","unforgettable","unfortunate","unmistakably","unpredictable","unrecognizable","wholeheartedly"
];

function canSpellWordFromTiles(word, tileLetters) {
  const available = [...tileLetters];
  const w = word.toUpperCase().split("");
  for (const letter of w) {
    const idx = available.indexOf(letter);
    if (idx === -1) return false;
    available.splice(idx, 1);
  }
  return true;
}

function selectWordOfTheDay(allLevelTiles) {
  const seed = getDailySeed();
  const rng = seededRandom(seed + 7777);

  // WoD selection strategy (revised May 15, 2026):
  // Players found prior WoDs (12+ letters) technically "fit" a level's raw tile
  // set but were impractical to actually spell during gameplay because they
  // consumed too many letters at once. New strategy preferences shorter,
  // achievable words while still feeling like a worthy challenge.
  //
  // Preferred length order: 9, 8, 10, 7, 11, 6, 12, 5, 4
  // Sweet spot is 8-10 (impressive but playable). Extends both directions
  // only when no preferred-length word fits the day's boards.
  const LENGTH_PRIORITY = [9, 8, 10, 7, 11, 6, 12, 5, 4];

  const byLength = {};
  for (const w of WOTD_CANDIDATES) {
    const len = w.length;
    if (!byLength[len]) byLength[len] = [];
    byLength[len].push(w);
  }
  // Cap any length >12 at the 12 bucket (still treated as "long" but eligible).
  for (const w of WOTD_CANDIDATES) {
    if (w.length > 12) {
      if (!byLength[12]) byLength[12] = [];
      byLength[12].push(w);
    }
  }

  for (const len of LENGTH_PRIORITY) {
    const tier = byLength[len];
    if (!tier || tier.length === 0) continue;
    // v251 CROSS-PLATFORM FIX: this was `[...tier].sort(() => rng() - 0.5)`, which is
    // NOT a shuffle. A random comparator gives inconsistent answers, so the result depends
    // on the JS engine's sort implementation (comparison count and order). WebKit (iOS) and
    // V8 (Android) differ, so the same seed produced DIFFERENT words on different platforms
    // — observed Jul 23 2026: iPhone+iPad "REMINISCE" vs Android "WASHBOARD", same account,
    // same date, same build. Fisher-Yates performs a fixed sequence of swaps driven only by
    // rng(), so every engine produces an identical result from an identical seed. Same idiom
    // already used by buildPool() at ~line 771.
    const shuffled = [...tier];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (const word of shuffled) {
      for (const tiles of allLevelTiles) {
        if (canSpellWordFromTiles(word, tiles)) {
          try { console.log(`[WoD] Selected "${word.toUpperCase()}" (${word.length} letters) — playable on a level's tile set.`); } catch {}
          return word.toUpperCase();
        }
      }
    }
  }
  try { console.warn("[WoD] No candidate word fits any level's tiles today. WoD disabled for today."); } catch {}
  return null;
}

// WoD cache version — bump whenever the WoD selection logic changes so
// stale caches from prior code versions are invalidated even on the same day.
const WOTD_CACHE_VERSION = 3;

function getCachedWordOfTheDay() {
  try {
    const today = getTodayKey();
    const raw = localStorage.getItem("ll_wotd");
    if (raw) {
      const data = JSON.parse(raw);
      if (data.date === today && data.word && data.version === WOTD_CACHE_VERSION) return data;
    }
  } catch {}
  return null;
}
// v299 (Malleable WoD rule A): the WoD is a ROOT MINIMUM. The root = the WoD minus ONE common
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
// v307 (Malleable WoD rule B — Daryl, Sep 1): SILENT-E STEM, UNGATED.
// wotdRoot() strips ONE ending off the WoD, which only helps when the WoD is already an
// inflected form (SURPRISED -> SURPRIS). When the WoD is the plain form ending in a silent E
// (STOCKPILE) nothing strips, the root stays whole, and English's E-drop before a vowel suffix
// breaks containment: STOCKPILING has no "STOCKPILE" block. Player-reported Sep 1.
// Fix: accept the root OR the root minus a trailing E (floor 5, same as wotdRoot).
// DELIBERATELY LIBERAL per Daryl's ruling: admits some non-forms (WoD CREATE accepts CREATURE
// via the CREAT stem). Errors run in the PLAYER'S favor, by design.
// v307 also folds in server-supplied extra roots (see WOTD_EXTRA_ROOTS below) so the NEXT
// edge case is a Supabase INSERT, not an App Store release.
function wotdRootVariants(wotdWord) {
  const W = (wotdWord || "").toUpperCase();
  const root = wotdRoot(W);
  const out = [root];
  if (root.endsWith("E") && root.length - 1 >= 5) out.push(root.slice(0, -1));
  for (const row of WOTD_EXTRA_ROOTS) {
    // Global rows (no wotd_word) apply to every day; targeted rows only to their own WoD.
    if (row.root && (!row.wotd || row.wotd === W)) out.push(row.root);
  }
  return out;
}
function isWotdMatch(playedWord, wotdWord) {
  if (!playedWord || !wotdWord) return false;
  const P = playedWord.toUpperCase(), W = wotdWord.toUpperCase();
  if (P.length < W.length) return false;
  return wotdRootVariants(W).some(r => P.includes(r));
}
function saveCachedWordOfTheDay(word) {
  try { localStorage.setItem("ll_wotd", JSON.stringify({ date: getTodayKey(), word, found: false, version: WOTD_CACHE_VERSION })); } catch {}
}
function markWordOfTheDayFound(level, score, bonus = 1000) {
  try {
    const cached = getCachedWordOfTheDay();
    if (cached) {
      cached.found = true;
      cached.foundLevel = level;
      cached.foundScore = score;
      cached.foundBonus = bonus; // v299: varies with word length now
      cached.version = WOTD_CACHE_VERSION;
      localStorage.setItem("ll_wotd", JSON.stringify(cached));
    }
  } catch {}
}

// ── Dynamic approved words whitelist (loaded from Supabase) ──
let APPROVED_WORDS = new Set();
let approvedWordsLoaded = false;
async function loadApprovedWords() {
  if (approvedWordsLoaded) return;
  try {
    const url = "https://zcevszxmoggmcmvyxjtn.supabase.co/rest/v1/word_reports?select=word&status=eq.approved&limit=1000";
    const r = await fetch(url, { headers: {
      apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZXZzenhtb2dnbWNtdnl4anRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDExNDIsImV4cCI6MjA5MTE3NzE0Mn0.nZhiDxv5ssCrkHXxaboZ5ziH-M4NqNqPMop2s_gA6NM",
      Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZXZzenhtb2dnbWNtdnl4anRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDExNDIsImV4cCI6MjA5MTE3NzE0Mn0.nZhiDxv5ssCrkHXxaboZ5ziH-M4NqNqPMop2s_gA6NM"
    }});
    if (r.ok) {
      const rows = await r.json();
      APPROVED_WORDS = new Set(rows.map(x => (x.word||"").toLowerCase()));
      approvedWordsLoaded = true;
    }
  } catch(e) { console.warn("Failed to load approved words:", e); }
}
// ── WoD extra accepted roots (v307, Option 1) ──
// Server-side safety net for WoD matching. Rows here add accepted roots WITHOUT a store
// release: fix a wrongly-rejected word with one INSERT in the Supabase SQL editor and every
// player — native and web — picks it up on next launch.
//   wotd_word  = the WoD this applies to (uppercase), or NULL to apply to every day
//   extra_root = the additional accepted root (uppercase)
// Fails safe: any error leaves the list empty and the baked-in rule B still applies.
// Guard: roots under 4 chars are dropped so a typo row can't make every word match.
let WOTD_EXTRA_ROOTS = [];
let wotdExtraRootsLoaded = false;
async function loadWotdExtraRoots() {
  if (wotdExtraRootsLoaded) return;
  try {
    const url = "https://zcevszxmoggmcmvyxjtn.supabase.co/rest/v1/wotd_extra_roots?select=wotd_word,extra_root&active=eq.true&limit=500";
    // Same anon key literal already used by loadApprovedWords() above — kept inline for
    // symmetry with that function rather than introducing a new shared constant.
    const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZXZzenhtb2dnbWNtdnl4anRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDExNDIsImV4cCI6MjA5MTE3NzE0Mn0.nZhiDxv5ssCrkHXxaboZ5ziH-M4NqNqPMop2s_gA6NM";
    const r = await fetch(url, { headers: {
      apikey: anonKey,
      Authorization: "Bearer " + anonKey
    }});
    if (r.ok) {
      const rows = await r.json();
      WOTD_EXTRA_ROOTS = rows
        .map(x => ({
          wotd: (x.wotd_word || "").toUpperCase() || null,
          root: (x.extra_root || "").toUpperCase()
        }))
        .filter(x => x.root.length >= 4);
      wotdExtraRootsLoaded = true;
      try { console.log(`[WoD] Loaded ${WOTD_EXTRA_ROOTS.length} extra root(s) from server.`); } catch {}
    }
  } catch (e) { console.warn("Failed to load WoD extra roots:", e); }
}

// Kick off load on module init
loadApprovedWords();
loadWotdExtraRoots();

async function validateWord(word) {
  const key = word.toLowerCase();
  // PROFANITY FILTER — block profane words from scoring (App Store guideline 1.1.3)
  // Exact-match only: blocks "fuck" but allows "analyze" (which contains "anal").
  if (isProfaneWord(key)) {
    wordCache[key] = { valid: false, source: "profanity" };
    return wordCache[key];
  }
  // Check both static and dynamic whitelists FIRST
  if (CUSTOM_WHITELIST.has(key) || APPROVED_WORDS.has(key)) {
    wordCache[key] = { valid: true, source: "whitelist" };
    return wordCache[key];
  }
  if (wordCache[key] !== undefined) return wordCache[key];
  if (!navigator.onLine) { return { valid: false, source: "offline" }; } // v261 #6: NOT cached — an offline moment must not condemn a word for the whole day
  const fetchWithTimeout = (url, ms = 6000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
  };
  // Try MW API with one automatic retry on timeout
  const tryMW = async () => {
    try {
      const collRes = await fetchWithTimeout(`https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(key)}?key=${MW_COLLEGIATE_KEY}`);
      const collData = await collRes.json();
      if (Array.isArray(collData) && collData.length > 0 && typeof collData[0] === "object" && collData[0].shortdef) {
        return { valid: true, source: "collegiate" };
      }
      const medRes = await fetchWithTimeout(`https://www.dictionaryapi.com/api/v3/references/medical/json/${encodeURIComponent(key)}?key=${MW_MEDICAL_KEY}`);
      const medData = await medRes.json();
      if (Array.isArray(medData) && medData.length > 0 && typeof medData[0] === "object" && medData[0].shortdef) {
        return { valid: true, source: "medical" };
      }
      return { valid: false, source: null };
    } catch (err) {
      if (err.name === "AbortError") return { valid: null, source: "timeout" };
      return { valid: word.length >= 3, source: "fallback" };
    }
  };
  let result = await tryMW();
  // Auto-retry once on timeout
  if (result.source === "timeout") {
    await new Promise(r => setTimeout(r, 1000));
    result = await tryMW();
  }
  // If still timing out, accept known-common words so the game stays playable — but a word
  // we simply COULDN'T CHECK must never be reported as invalid (v261 #6, Chelsea Jul 31:
  // degraded wifi turned VOLT/MANY/GLAZE into "Not a valid word!" and CACHED the lie for
  // the rest of the day). Unknown-under-timeout returns an honest lookup-failure verdict,
  // deliberately UNCACHED so the very next submit retries for real.
  if (result.source === "timeout") {
    if (COMMON_WORDS.has(key)) {
      result = { valid: true, source: "fallback" };
    } else {
      return { valid: null, source: "timeout" };
    }
  }
  // Secondary check: if MW rejected, ask Free Dictionary API.
  // If Free Dict accepts, mark as likelyValid so we offer to report it.
  // If Free Dict also rejects, it's almost certainly a misspelling.
  if (!result.valid && result.source !== "timeout" && result.source !== "fallback") {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const r2 = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(key), { signal: ctrl.signal }).finally(() => clearTimeout(timer));
      if (r2.ok) {
        const data2 = await r2.json();
        if (Array.isArray(data2) && data2.length > 0 && data2[0].word) {
          result = { valid: false, source: "mw_missing", likelyValid: true };
        }
      }
    } catch(e) {}
  }
  wordCache[key] = result;
  return wordCache[key];
}

async function hasValidWordsRemaining(tiles) {
  const available = tiles.filter(t => !t.used).map(t => t.letter);
  if (available.length < 3) return false;
  if (available.length > 10) return true; // skip check for large boards — false positives impossible
  const letters = [...available];
  const combos = new Set();
  // Lower cap for speed — fewer API calls
  const cap = Math.min(80, available.length * 6);
  for (let i = 0; i < letters.length && combos.size < cap; i++)
    for (let j = 0; j < letters.length && combos.size < cap; j++) {
      if (j === i) continue;
      for (let k = 0; k < letters.length && combos.size < cap; k++) {
        if (k === i || k === j) continue;
        combos.add(letters[i] + letters[j] + letters[k]);
      }
    }
  // Check cached words first (instant), then uncached
  const cached = [...combos].filter(w => wordCache[w.toLowerCase()] !== undefined);
  const uncached = [...combos].filter(w => wordCache[w.toLowerCase()] === undefined);
  for (const combo of cached) { if (wordCache[combo.toLowerCase()]?.valid) return true; }
  for (const combo of uncached) { const r = await validateWord(combo); if (r.valid) return true; }
  return false;
}

// ── Guitar music ───────────────────────────────────────────────
function createGuitar(ctx) {
  function pluck(freq, time, duration = 2.0, gain = 0.35) {
    const bufferSize = Math.round(ctx.sampleRate / freq);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer; source.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 2800;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(gain, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);
    const delay = ctx.createDelay(); delay.delayTime.value = 0.025;
    const fb = ctx.createGain(); fb.gain.value = 0.25;
    source.connect(filter); filter.connect(gainNode);
    gainNode.connect(delay); delay.connect(fb); fb.connect(delay);
    gainNode.connect(ctx.destination); delay.connect(ctx.destination);
    source.start(time); source.stop(time + duration + 0.5);
  }
  return { pluck };
}
const MELODY = [
  {freq:196.00,beat:0},{freq:246.94,beat:0.5},{freq:392.00,beat:1.0},{freq:329.63,beat:1.5},
  {freq:293.66,beat:2.0},{freq:246.94,beat:2.5},{freq:392.00,beat:3.0},{freq:329.63,beat:3.5},
  {freq:261.63,beat:4.0},{freq:329.63,beat:4.5},{freq:392.00,beat:5.0},{freq:329.63,beat:5.5},
  {freq:261.63,beat:6.0},{freq:246.94,beat:6.5},{freq:329.63,beat:7.0},{freq:261.63,beat:7.5},
  {freq:293.66,beat:8.0},{freq:369.99,beat:8.5},{freq:440.00,beat:9.0},{freq:369.99,beat:9.5},
  {freq:293.66,beat:10.0},{freq:246.94,beat:10.5},{freq:369.99,beat:11.0},{freq:293.66,beat:11.5},
  {freq:164.81,beat:12.0},{freq:246.94,beat:12.5},{freq:329.63,beat:13.0},{freq:246.94,beat:13.5},
  {freq:196.00,beat:14.0},{freq:246.94,beat:14.5},{freq:329.63,beat:15.0},{freq:246.94,beat:15.5},
];
const BEAT_DUR = 0.32;
const LOOP_DUR = 16 * BEAT_DUR;

function ConfettiCanvas({ active, rainbow }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particles = useRef([]);
  useEffect(() => {
    if (!active) { particles.current = []; return; }
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const colors = rainbow
      ? ["#ff0000","#ff7700","#ffff00","#00ff00","#0000ff","#8b00ff","#ff69b4","#ffffff"]
      : ["#f6d365","#fda085","#f093fb","#a78bfa","#6ee7b7","#60a5fa","#fb7185"];
    particles.current = Array.from({ length: rainbow ? 200 : 120 }, () => ({
      x: Math.random() * canvas.width, y: -10 - Math.random() * 100,
      w: 8 + Math.random() * 10, h: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.15,
      vx: (Math.random() - 0.5) * (rainbow ? 6 : 4), vy: 3 + Math.random() * 4, opacity: 1,
    }));
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current.forEach(p => {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = p.opacity; ctx.fillStyle = p.color;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); ctx.restore();
        p.x += p.vx; p.y += p.vy; p.rot += p.rotSpeed;
        if (p.y > canvas.height * 0.75) p.opacity -= 0.015;
      });
      particles.current = particles.current.filter(p => p.opacity > 0);
      if (particles.current.length > 0) animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [active, rainbow]);
  if (!active) return null;
  return <canvas ref={canvasRef} style={{ position:"fixed", inset:0, zIndex:9999, pointerEvents:"none" }} />;
}

function TileScene({ tileStyle, onAnimDone }) {
  const [wordLetters, setWordLetters] = useState([]);
  const [selectedTiles, setSelectedTiles] = useState([]);
  const [wordScore, setWordScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const [fp, setFp] = useState(null);
  const [fs2, setFs2] = useState(26);
  const [pulsing, setPulsing] = useState(false);
  const [showOops, setShowOops] = useState(false);
  const [pulseOn, setPulseOn] = useState(false);
  const containerRef = useRef(null);
  const ran = useRef(false);
  const stateRef = useRef({ letters: [], step: 0, phase: 'wrong' });

  useEffect(() => {
    if (!pulsing) return;
    let on = true;
    const iv = setInterval(() => { on = !on; setPulseOn(on); }, 700);
    return () => clearInterval(iv);
  }, [pulsing]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const SCORES = { Q:20, I:4, U:7, E:3, T:3 };
    const WRONG   = ['tQ','tI','tU','tE'];
    const CORRECT = ['tQ','tU','tI','tE','tT'];

    function getPos(id) {
      const c = containerRef.current;
      if (!c) return null;
      const el = c.querySelector('#' + id);
      if (!el) return null;
      const cr = c.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      return { x: er.left - cr.left + er.width/2 - 14,
               y: er.top  - cr.top  + er.height/2 - 14 };
    }

    function tapWrong() {
      const s = stateRef.current;
      if (s.step >= WRONG.length) {
        s.step = 0;
        setTimeout(moveToClear, 374);
        return;
      }
      const id = WRONG[s.step];
      const letter = id.slice(1);
      const pos = getPos(id);
      if (pos) setFp(pos);
      setTimeout(() => {
        s.letters = [...s.letters, letter];
        const score = s.letters.reduce((a,l) => a + (SCORES[l]||0), 0);
        setWordLetters([...s.letters]);
        setWordScore(score);
        setSelectedTiles([...s.letters]);
        s.step++;
        setTimeout(tapWrong, 398);
      }, 211);
    }

    function moveToClear() {
      setShowOops(true);
      setTimeout(() => { setShowOops(false); }, 900);
      setFs2(36);
      setTimeout(() => {
        const pos = getPos('tour-clear');
        if (pos) setFp(pos);
        setTimeout(() => {
          setShowClear(true);
          setTimeout(() => {
            setShowClear(false);
            setFs2(26);
            setFp(null);
            setWordLetters([]);
            setSelectedTiles([]);
            setWordScore(0);
            stateRef.current.letters = [];
            setTimeout(tapCorrect, 374);
          }, 390);
        }, 390);
      }, 140);
    }

    function tapCorrect() {
      const s = stateRef.current;
      if (s.step >= CORRECT.length) {
        setTimeout(() => {
          const pos = getPos('tour-submit');
          if (pos) setFp(pos);
          setTimeout(() => {
            setFp(null);
            setSubmitted(true);
            setPulsing(true);
            if (onAnimDone) onAnimDone();
          }, 600);
        }, 187);
        return;
      }
      const id = CORRECT[s.step];
      const letter = id.slice(1);
      const pos = getPos(id);
      if (pos) setFp(pos);
      setTimeout(() => {
        s.letters = [...s.letters, letter];
        const score = s.letters.reduce((a,l) => a + (SCORES[l]||0), 0);
        setWordLetters([...s.letters]);
        setWordScore(score);
        setSelectedTiles([...s.letters]);
        s.step++;
        setTimeout(tapCorrect, 351);
      }, 211);
    }

    setTimeout(tapWrong, 421);
  }, []);

  const VALS = {Q:20,U:7,I:4,E:3,T:3,R:5,A:4,N:4,L:6,B:8,S:5,M:7,D:6,F:8,H:6,W:9,O:4,P:8,V:11,K:12};
  const borderColor = submitted ? '#22d3ee' : showClear ? 'rgba(216,180,254,0.8)' : 'rgba(255,255,255,0.8)';

  return (
    <div style={{position:'relative'}} ref={containerRef}>
      {fp && (
        <div style={{position:'absolute',left:fp.x,top:fp.y,fontSize:ipadTour(fs2),transition:'left 0.4s ease,top 0.4s ease,font-size 0.3s',pointerEvents:'none',zIndex:10}}>
          &#128070;
        </div>
      )}
      {[['Q','R','A','N','E'],['L','B','S','M','D'],['F','U','H','W','O'],['P','V','I','K','T']].map((row,ri) => (
        <div key={ri} style={{display:'flex',justifyContent:'center',marginBottom:4}}>
          {row.map(letter => (
            <div key={letter} id={'t'+letter} style={tileStyle(letter, selectedTiles.includes(letter))}>
              {letter}
              <span style={{fontSize:ipadTour(7),color:'#fda085',fontWeight:'bold'}}>{VALS[letter]||4}</span>
            </div>
          ))}
        </div>
      ))}
      {showOops && (
        <div style={{position:'absolute',top:'35%',left:'50%',transform:'translate(-50%,-50%)',background:'rgba(220,38,38,0.95)',borderRadius:14,padding:`${ipadTour(10)}px ${ipadTour(20)}px`,fontSize:ipadTour(16),fontWeight:'bold',color:'#fff',zIndex:20,whiteSpace:'nowrap',boxShadow:'0 4px 20px rgba(0,0,0,0.5)'}}>
          Oops! ✕
        </div>
      )}
      <div style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1.5px solid '+borderColor,borderRadius:8,padding:`${ipadTour(8)}px ${ipadTour(12)}px`,minHeight:ipadTour(36),display:'flex',alignItems:'center',gap:ipadTour(6),margin:`${ipadTour(8)}px 0`,position:'relative'}}>
        {wordLetters.length === 0
          ? <span style={{color:'rgba(255,255,255,0.3)',fontSize:ipadTour(11),fontStyle:'italic'}}>Tap tiles to build a word...</span>
          : <>
              {wordLetters.map((l,i) => (
                <span key={i} style={{background:'linear-gradient(135deg,#5c6bc0,#512da8)',borderRadius:5,padding:`${ipadTour(4)}px ${ipadTour(7)}px`,fontSize:ipadTour(14),fontWeight:'bold',color:'#fff'}}>{l}</span>
              ))}
              <span style={{position:'absolute',right:ipadTour(8),fontSize:submitted?ipadTour(13):ipadTour(12),color:submitted?'#22d3ee':'#f6d365',fontWeight:'bold'}}>
                {submitted ? '✓ +37 pts!' : '+' + wordScore + ' pts'}
              </span>
            </>
        }
      </div>
      <div style={{display:'flex',gap:ipadTour(6),marginBottom:ipadTour(6)}}>
        <div id="tour-submit" style={{flex:2,padding:ipadTour(7),borderRadius:8,background:submitted?'rgba(246,211,101,0.4)':'rgba(246,211,101,0.15)',border:'1px solid rgba(246,211,101,0.4)',color:'#f6d365',fontSize:ipadTour(10),fontWeight:'bold',textAlign:'center',transition:'all 0.2s'}}>Submit Word</div>
        <div id="tour-clear" style={{flex:1,padding:ipadTour(7),borderRadius:8,background:showClear?'rgba(216,180,254,0.6)':'rgba(192,132,252,0.2)',border:'2px solid rgba(216,180,254,0.8)',color:'#ede9fe',fontSize:ipadTour(10),fontWeight:'bold',textAlign:'center',transition:'all 0.2s'}}>&#10005; Clear</div>
      </div>
      <div style={{fontSize:ipadTour(10),color:'rgba(255,255,255,0.5)',textAlign:'center'}}>Tiles can be anywhere &#8212; no adjacency needed!</div>
      {pulsing && (
        <div style={{marginTop:ipadTour(8),textAlign:'center',fontSize:ipadTour(11),color:'rgba(246,211,101,0.7)',fontStyle:'italic',opacity:pulseOn?1:0.3,transition:'opacity 0.7s'}}>
          Tap Next &#8594;
        </div>
      )}
    </div>
  );
}

function VisualTour({ onDone }) {
  // v152: Tour now opens on a landing screen offering "Full Walkthrough" or
  // "Latest Updates". mode drives which surface renders. The walkthrough is the
  // original 6-scene flow, unchanged. "updates" reuses the approved What's New v1.1
  // copy plus a self-contained V/C-alert demo. Version-stamped heading updates per release.
  const [mode, setMode] = useState("landing"); // "landing" | "updates" | "walkthrough"
  const [cur, setCur] = useState(0);
  const [pulseOn, setPulseOn] = useState(false);
  const pulseRef = useRef(null);

  // v152: self-contained pulse for the V/C-alert demo on the Latest Updates screen.
  // Cosmetic ONLY — a plain 1s alternating loop, wired to NOTHING in game state
  // (mirrors the Menu scene's isolated pulse pattern). Never touches the live vcPulse
  // system. vcDemoOn drives the glow on the two mock Vowels/Consonants boxes.
  const [vcDemoOn, setVcDemoOn] = useState(false);
  const vcDemoRef = useRef(null);

  function startPulse() {
    if (pulseRef.current) clearInterval(pulseRef.current);
    let on = true;
    pulseRef.current = setInterval(() => { on = !on; setPulseOn(on); }, 700);
  }

  useEffect(() => {
    setPulseOn(false);
    if (pulseRef.current) clearInterval(pulseRef.current);
    if (mode === "walkthrough" && cur !== 1) setTimeout(startPulse, 400);
    return () => { if (pulseRef.current) clearInterval(pulseRef.current); };
  }, [cur, mode]);

  // v152: run the V/C demo pulse only while the Latest Updates screen is showing.
  useEffect(() => {
    if (mode === "updates") {
      let on = true;
      setVcDemoOn(true);
      vcDemoRef.current = setInterval(() => { on = !on; setVcDemoOn(on); }, 1000);
    }
    return () => { if (vcDemoRef.current) clearInterval(vcDemoRef.current); };
  }, [mode]);

  const tileStyle = (letter, sel) => ({
    width: ipadTour(42), height: ipadTour(48), borderRadius: 8,
    background: sel ? 'linear-gradient(135deg,#5c6bc0,#512da8)' : 'linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.07))',
    border: sel ? '1px solid #9fa8da' : '1px solid rgba(255,255,255,0.22)',
    boxShadow: sel ? `0 0 ${ipadTour(12)}px ${ipadTour(3)}px rgba(0,230,118,0.85), 0 0 ${ipadTour(4)}px rgba(0,230,118,0.5)` : 'none',
    display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontWeight: 'bold', fontSize: ipadTour(16), color: '#fff',
    transform: sel ? 'translateY(-4px) scale(1.08)' : 'none',
    transition: 'all 0.2s', margin: 2, position: 'relative', cursor: 'default'
  });

  const SmallPot = () => (
    <svg viewBox="0 0 300 160" width="72" height="44" xmlns="http://www.w3.org/2000/svg" style={{verticalAlign:'-12px',display:'inline-block'}}>
      <path d="M 5 130 A 130 120 0 0 1 185 68" fill="none" stroke="#8B00FF" strokeWidth="14" strokeLinecap="round" opacity="0.9"/>
      <path d="M 17 135 A 116 106 0 0 1 181 76" fill="none" stroke="#0055FF" strokeWidth="14" strokeLinecap="round" opacity="0.9"/>
      <path d="M 29 140 A 102 92 0 0 1 177 84" fill="none" stroke="#00AA00" strokeWidth="14" strokeLinecap="round" opacity="0.9"/>
      <path d="M 41 145 A 88 78 0 0 1 173 92" fill="none" stroke="#FFD700" strokeWidth="14" strokeLinecap="round" opacity="0.9"/>
      <path d="M 53 150 A 74 64 0 0 1 169 100" fill="none" stroke="#FF2200" strokeWidth="14" strokeLinecap="round" opacity="0.9"/>
      <path d="M 179 158 Q 179 132 215 132 Q 251 132 251 158 Z" fill="#111111"/>
      <rect x="179" y="130" width="72" height="28" fill="#111111"/>
      <ellipse cx="215" cy="158" rx="36" ry="9" fill="#111111" stroke="#666" strokeWidth="1.5"/>
      <ellipse cx="215" cy="130" rx="36" ry="11" fill="#333333" stroke="#888" strokeWidth="2"/>
      <ellipse cx="215" cy="119" rx="13" ry="6" fill="#FFD700" stroke="#FFEE88" strokeWidth="2"/>
      <text x="215" y="122" textAnchor="middle" fontFamily="Georgia,serif" fontSize="7" fontWeight="bold" fill="#5a3a00">LL</text>
    </svg>
  );

  const BigPot = () => (
    <svg viewBox="0 0 300 160" width="220" height="118" xmlns="http://www.w3.org/2000/svg">
      <path d="M 10 140 A 160 150 0 0 1 200 80" fill="none" stroke="#8B00FF" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
      <path d="M 20 143 A 147 137 0 0 1 197 86" fill="none" stroke="#4400CC" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
      <path d="M 30 146 A 134 124 0 0 1 194 92" fill="none" stroke="#0055FF" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
      <path d="M 40 149 A 121 111 0 0 1 191 98" fill="none" stroke="#00AA00" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
      <path d="M 50 152 A 108 98 0 0 1 188 104" fill="none" stroke="#FFD700" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
      <path d="M 60 155 A 95 85 0 0 1 185 110" fill="none" stroke="#FF8C00" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
      <path d="M 70 158 A 82 72 0 0 1 182 116" fill="none" stroke="#FF2200" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
      <path d="M 172 158 Q 172 132 200 132 Q 228 132 228 158 Z" fill="#111"/>
      <rect x="172" y="130" width="56" height="28" fill="#111"/>
      <ellipse cx="200" cy="158" rx="28" ry="8" fill="#111" stroke="#666" strokeWidth="1.5"/>
      <ellipse cx="200" cy="130" rx="28" ry="9" fill="#333" stroke="#888" strokeWidth="2"/>
      <ellipse cx="191" cy="123" rx="10" ry="5" fill="#CC9900" stroke="#FFD700" strokeWidth="1.5"/>
      <ellipse cx="209" cy="123" rx="10" ry="5" fill="#CC9900" stroke="#FFD700" strokeWidth="1.5"/>
      <ellipse cx="200" cy="119" rx="12" ry="6" fill="#FFD700" stroke="#FFEE88" strokeWidth="2"/>
      <text x="200" y="122" textAnchor="middle" fontFamily="Georgia,serif" fontSize="6" fontWeight="bold" fill="#5a3a00">LL</text>
      <text x="228" y="119" fontFamily="Georgia,serif" fontSize="10" fill="#FFD700" opacity="0.9">✦</text>
      <text x="166" y="122" fontFamily="Georgia,serif" fontSize="8" fill="#FFD700" opacity="0.8">✦</text>
    </svg>
  );

  const scenes = [
    {
      title: "Welcome to LetterLoot!",
      desc:  "",
      content: () => (
        <div style={{textAlign:'center',padding:'10px 0'}}>
          <div style={{marginBottom:ipadTour(20),display:'flex',justifyContent:'center'}}><PencilLogo size={ipadIcon(96)}/></div>
          <div style={{display:'flex',flexDirection:'column',gap:ipadTour(14),fontSize:ipadTour(15),fontWeight:'bold'}}>
            <div style={{color:'#22d3ee'}}>🌅 Fresh Tiles Daily</div>
            <div style={{color:'#f6d365'}}>💎 Every letter is worth points</div>
            <div style={{color:'#fda085'}}>⭐ Bonuses increase points</div>
            <div style={{color:'#6ee7b7'}}>💥 Each level has a "Loot Letter" — one tile scores 5× that letter's value!</div>
            <div style={{color:'#a78bfa'}}>🌈 Clear 5 levels + find the Word of the Day for a Perfect Day! <SmallPot/></div>
          </div>
        </div>
      )
    },
    {
      title: "Tap Tiles to Spell a Word",
      desc:  "Tap any tiles in any order — no adjacency rules!",
      content: () => <TileScene tileStyle={tileStyle} onAnimDone={startPulse}/>
    },
    {
      title: "Letter Values",
      desc:  "",
      content: () => (
        <div>
          {/* Line 1: Spell 8+ — bigger */}
          <div style={{background:'rgba(110,231,183,0.08)',border:'1px solid rgba(110,231,183,0.4)',borderRadius:10,padding:ipadTour(10),textAlign:'center',fontSize:ipadTour(14),color:'#6ee7b7',fontWeight:'bold',marginBottom:ipadTour(10)}}>
            💡 Spell 8+ letter words for long-word bonuses!
          </div>
          {/* Line 2: Bonus tiles — slightly smaller */}
          <div style={{fontSize:ipadTour(11),color:'rgba(255,255,255,0.75)',textAlign:'center',marginBottom:ipadTour(6),fontWeight:'bold'}}>Bonus tiles multiply your score!</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:ipadTour(8),marginBottom:ipadTour(10)}}>
            <div style={{background:'rgba(255,215,0,0.08)',border:'1px solid rgba(255,215,0,0.4)',borderRadius:10,padding:ipadTour(8),textAlign:'center'}}>
              <div style={{...tileStyle('B',false),width:ipadTour(38),height:ipadTour(44),fontSize:ipadTour(14),margin:'0 auto 5px',boxShadow:'0 0 12px 3px rgba(255,215,0,0.8)',borderColor:'rgba(255,215,0,0.7)'}}>
                B<span style={{fontSize:ipadTour(7),color:'#ffd700',fontWeight:'bold'}}>2x</span>
              </div>
              <div style={{fontSize:ipadTour(9),color:'#ffd700'}}>Gold = 2x letter value</div>
            </div>
            <div style={{background:'rgba(224,64,251,0.08)',border:'1px solid rgba(224,64,251,0.4)',borderRadius:10,padding:ipadTour(8),textAlign:'center'}}>
              <div style={{...tileStyle('V',false),width:ipadTour(38),height:ipadTour(44),fontSize:ipadTour(14),margin:'0 auto 5px',boxShadow:'0 0 14px 4px rgba(255,100,255,0.9)',borderColor:'rgba(224,64,251,0.7)'}}>
                V<span style={{fontSize:ipadTour(7),color:'#e040fb',fontWeight:'bold'}}>3x</span>
              </div>
              <div style={{fontSize:ipadTour(9),color:'#e040fb'}}>Purple = 3x letter value</div>
            </div>
          </div>
          {/* Line 3: Rare letters */}
          <div style={{textAlign:'center',marginBottom:ipadTour(10)}}>
            <div style={{fontSize:ipadTour(11),color:'rgba(255,255,255,0.75)',marginBottom:ipadTour(6),fontWeight:'bold'}}>Rare letters score big!</div>
            <div style={{display:'flex',gap:ipadTour(5),justifyContent:'center'}}>
              {[['Z',22],['J',16],['K',12],['X',14]].map(([l,v]) => (
                <div key={l} style={{...tileStyle(l,false),width:ipadTour(38),height:ipadTour(44),fontSize:ipadTour(14)}}>
                  {l}<span style={{fontSize:ipadTour(7),color:'#fda085',fontWeight:'bold'}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Line 4: MW note — smaller */}
          <div style={{background:'rgba(255,255,255,0.05)',borderRadius:10,padding:ipadTour(7),textAlign:'center',fontSize:ipadTour(10),color:'rgba(255,255,255,0.55)',lineHeight:1.6}}>
            Words checked against <strong style={{color:'rgba(246,211,101,0.7)'}}>Merriam-Webster Dictionary</strong> — Collegiate + Medical
          </div>
        </div>
      )
    },

    {
      title: "📋 The Menu Button",
      desc:  "Your hub for everything beyond gameplay.",
      content: () => {
        // v158: scene-local tier-aware scale. v179: ipadTour is now itself tier-aware
        // (11" already trimmed to 1.95x, 13" still 2.3x), so mT no longer applies its own
        // 11" trim — that would DOUBLE-trim. 11" and 13" both defer to ipadTour now; only
        // the iPhone branch (base * 1.35, a deliberate phone EXPANSION for this scene) is
        // kept as-is.
        const on11 = isIpadWidth() && !isLargeIpad();
        const on13 = isLargeIpad();
        const mT = (base) =>
          (on13 || on11) ? ipadTour(base)
          : Math.round(base * 1.35);
        return (
        <div style={{textAlign:'center'}}>
          <div style={{display:'flex',justifyContent:'center',marginBottom:mT(14)}}>
            <div style={{background:"rgba(246,211,101,0.15)",border:"2px solid rgba(246,211,101,0.7)",color:"#f6d365",padding:`${mT(10)}px ${mT(28)}px`,borderRadius:12,fontSize:mT(18),fontWeight:"bold",fontFamily:"Georgia,serif",boxShadow: pulseOn ? '0 0 20px 6px rgba(246,211,101,0.85)' : 'none',transform: pulseOn ? 'scale(1.06)' : 'scale(1)',transition:'box-shadow 0.7s ease, transform 0.7s ease'}}>📋 Menu</div>
          </div>
          <div style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:14,padding:mT(14),fontSize:mT(12.5),color:'#f5f0e8',lineHeight:1.85,textAlign:'left',marginBottom:mT(10)}}>
            The <strong style={{color:'#f6d365'}}>📋 Menu</strong> button (under the tile board, next to UNDO) opens your hub. From there you can reach:
            <div style={{marginTop:mT(8),paddingLeft:mT(6),fontSize:mT(12),lineHeight:2}}>
              📜 <strong>History</strong> — every word you've played<br/>
              📊 <strong>Stats</strong> — your scores, streaks, Perfect Days<br/>
              🏅 <strong>Badges</strong> — achievements you've earned<br/>
              🏆 <strong>Leaders</strong> — top players today, this week &amp; all-time<br/>
              🏴‍☠️ <strong>Special Features</strong> — the extras that make LetterLoot shine<br/>
              ℹ️ <strong>Tips</strong> — rules &amp; strategy
            </div>
          </div>
          <div style={{fontSize:mT(10),color:'rgba(255,255,255,0.55)',fontStyle:'italic'}}>
            Each menu page has a ← Back to Menu button. From the menu, ✏️ Back to Game returns to play.
          </div>
        </div>
        );
      }
    },

    {
      // v210: Special Features scene — permanent home for all the extras added since the original
      // tour. Built as a list so future features are just one more entry. Placed after Menu (which
      // now links here in-game) and before History. Also mirrored as an in-game Menu page.
      title: "🏴‍☠️ Special Features",
      desc:  "The extras that make LetterLoot shine.",
      content: () => (
        <div style={{display:'flex',flexDirection:'column',gap:ipadTour(10)}}>
          <div style={{background:'rgba(110,231,183,0.1)',border:'1px solid rgba(110,231,183,0.35)',borderRadius:12,padding:ipadTour(11)}}>
            <div style={{fontSize:ipadTour(14),color:'#6ee7b7',fontWeight:'bold',marginBottom:ipadTour(4)}}>✨ Loot Letters</div>
            <div style={{fontSize:ipadTour(12),color:'rgba(245,240,232,0.9)',lineHeight:1.55}}>Every level hides one Loot Letter — a single tile worth 5× its normal value. We'll tell you which letter it is, but not which tile holds it. Use it in a word to pocket the bonus.</div>
          </div>
          <div style={{background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.4)',borderRadius:12,padding:ipadTour(11)}}>
            <div style={{fontSize:ipadTour(14),color:'#a78bfa',fontWeight:'bold',marginBottom:ipadTour(4)}}>🎯 Word of the Day</div>
            <div style={{fontSize:ipadTour(12),color:'rgba(245,240,232,0.9)',lineHeight:1.55}}>Each day names one word to hunt — and it's a root minimum: spell it OR any longer word containing it. Worth 1,000 pts, plus 200 pts per extra letter. Once per day, and required for a Perfect Day.</div>
          </div>
          <div style={{background:'rgba(246,211,101,0.12)',border:'1px solid rgba(246,211,101,0.45)',borderRadius:12,padding:ipadTour(11)}}>
            <div style={{fontSize:ipadTour(14),color:'#ff4444',fontWeight:'bold',marginBottom:ipadTour(4)}}>🦜 Finishing Flourish Bonus</div>
            <div style={{fontSize:ipadTour(12),color:'rgba(245,240,232,0.9)',lineHeight:1.55}}>Use a 5+ letter word as your final, board-clearing word to pocket a Finishing Flourish Bonus — treasure that grows with every extra letter. The longer that finishing word, the bigger the haul!</div>
          </div>
          <div style={{background:'rgba(124,196,255,0.1)',border:'1px solid rgba(124,196,255,0.35)',borderRadius:12,padding:ipadTour(11)}}>
            <div style={{fontSize:ipadTour(14),color:'#7cc4ff',fontWeight:'bold',marginBottom:ipadTour(4)}}>⚠️ Vowel / Consonant Alert</div>
            <div style={{fontSize:ipadTour(12),color:'rgba(245,240,232,0.9)',lineHeight:1.55}}>When your remaining letters tip into a risky vowel-to-consonant balance, the Vowels and Consonants boxes pulse — a heads-up to adjust your strategy before you strand yourself.</div>
          </div>
          <div style={{background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.4)',borderRadius:12,padding:ipadTour(11)}}>
            <div style={{fontSize:ipadTour(14),color:'#c4b5fd',fontWeight:'bold',marginBottom:ipadTour(4)}}>🏴‍☠️ Pirate Celebrations</div>
            <div style={{fontSize:ipadTour(12),color:'rgba(245,240,232,0.9)',lineHeight:1.55}}>Our pirate crew cheers your big moments — clearing a level, a great word, a Perfect Day. Want them on or off? Toggle <strong style={{color:'#c4b5fd'}}>Show Mascot Celebrations</strong> on the "Ready?" screen before each game begins.</div>
          </div>
          <div style={{background:'rgba(246,211,101,0.12)',border:'1px solid rgba(246,211,101,0.45)',borderRadius:12,padding:ipadTour(11)}}>
            <div style={{fontSize:ipadTour(14),color:'#f6d365',fontWeight:'bold',marginBottom:ipadTour(4)}}>🔭 The Spyglass</div>
            <div style={{fontSize:ipadTour(12),color:'rgba(245,240,232,0.9)',lineHeight:1.55}}>Unsure a word be in the LL dictionary? Tap the blue <strong style={{color:'#f6d365'}}>🔭 SCOUT</strong> chip beside yer staged word to scout it before ye commit yer tiles. The game clock keeps runnin' — certainty costs time, matey! Words we don't know can be sent to the Cap'n fer review.</div>
          </div>
          <div style={{background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.4)',borderRadius:12,padding:ipadTour(11)}}>
            <div style={{fontSize:ipadTour(14),color:'#c4b5fd',fontWeight:'bold',marginBottom:ipadTour(4)}}>🏴‍☠️ Flourish Leaderboard</div>
            <div style={{fontSize:ipadTour(12),color:'rgba(245,240,232,0.9)',lineHeight:1.55}}>The longest board-clearing Finishing Flourish words across all Looters. Find it under the <strong style={{color:'#c4b5fd'}}>🏴‍☠️ Flourish</strong> tab on the Leaderboard. Registered players only.</div>
          </div>
        </div>
      )
    },

    {
      title: "📜 History Keeps Everything",
      desc:  "Even the words that didn't count.",
      content: () => (
        <div style={{textAlign:'center'}}>
          <div style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:14,padding:ipadTour(15),fontSize:ipadTour(14),color:'#f5f0e8',lineHeight:1.8,textAlign:'left',marginBottom:ipadTour(12)}}>
            History saves <strong style={{color:'#f6d365'}}>every word you played today</strong> — valid words AND rejected ones. Tap any level to look back at exactly what you played.
          </div>
          {/* v216: Report for Review — kept ON the History page (linked), but with ENHANCED
              visibility (bigger box, stronger border, larger text, glow). */}
          <div style={{background:'rgba(167,139,250,0.14)',border:'2px solid rgba(167,139,250,0.6)',borderRadius:14,padding:ipadTour(15),textAlign:'left',boxShadow:'0 0 20px rgba(167,139,250,0.22)'}}>
            <div style={{fontSize:ipadTour(13),color:'#c4b5fd',letterSpacing:1.5,fontWeight:'bold',marginBottom:ipadTour(7)}}>📝 REPORT FOR REVIEW</div>
            <div style={{fontSize:ipadTour(14),color:'rgba(255,255,255,0.92)',lineHeight:1.75}}>
              Think a rejected word should count? Tap <strong style={{color:'#f6d365'}}>📝 Report for review</strong> next to it in History. We review <strong style={{color:'#f6d365'}}>every</strong> submission and add valid words to the dictionary.
            </div>
          </div>
          <div style={{fontSize:ipadTour(12),color:'rgba(255,255,255,0.6)',fontStyle:'italic',marginTop:ipadTour(12)}}>
            Help us make LetterLoot smarter for everyone!
          </div>
        </div>
      )
    },

    {
      title: "The Perfect Day",
      desc:  "",
      last:  true,
      content: () => (
        <div style={{textAlign:'center'}}>
          <div style={{display:'flex',justifyContent:'center',marginBottom:ipadTour(6)}}>
            <svg viewBox="0 0 300 160" width={ipadTour(160)} height={ipadTour(86)} xmlns="http://www.w3.org/2000/svg">
              <path d="M 10 140 A 160 150 0 0 1 200 80" fill="none" stroke="#8B00FF" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
              <path d="M 20 143 A 147 137 0 0 1 197 86" fill="none" stroke="#4400CC" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
              <path d="M 30 146 A 134 124 0 0 1 194 92" fill="none" stroke="#0055FF" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
              <path d="M 40 149 A 121 111 0 0 1 191 98" fill="none" stroke="#00AA00" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
              <path d="M 50 152 A 108 98 0 0 1 188 104" fill="none" stroke="#FFD700" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
              <path d="M 60 155 A 95 85 0 0 1 185 110" fill="none" stroke="#FF8C00" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
              <path d="M 70 158 A 82 72 0 0 1 182 116" fill="none" stroke="#FF2200" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
              <path d="M 172 158 Q 172 132 200 132 Q 228 132 228 158 Z" fill="#111"/>
              <rect x="172" y="130" width="56" height="28" fill="#111"/>
              <ellipse cx="200" cy="158" rx="28" ry="8" fill="#111" stroke="#666" strokeWidth="1.5"/>
              <ellipse cx="200" cy="130" rx="28" ry="9" fill="#333" stroke="#888" strokeWidth="2"/>
              <ellipse cx="191" cy="123" rx="10" ry="5" fill="#CC9900" stroke="#FFD700" strokeWidth="1.5"/>
              <ellipse cx="209" cy="123" rx="10" ry="5" fill="#CC9900" stroke="#FFD700" strokeWidth="1.5"/>
              <ellipse cx="200" cy="119" rx="12" ry="6" fill="#FFD700" stroke="#FFEE88" strokeWidth="2"/>
              <text x="200" y="122" textAnchor="middle" fontFamily="Georgia,serif" fontSize="6" fontWeight="bold" fill="#5a3a00">LL</text>
              <text x="228" y="119" fontFamily="Georgia,serif" fontSize="10" fill="#FFD700" opacity="0.9">&#10022;</text>
              <text x="166" y="122" fontFamily="Georgia,serif" fontSize="8" fill="#FFD700" opacity="0.8">&#10022;</text>
            </svg>
          </div>
          <div style={{background:'rgba(255,255,255,0.07)',border:'1.5px solid rgba(255,255,255,0.2)',borderRadius:14,padding:ipadTour(14),fontSize:ipadTour(13),color:'#f5f0e8',lineHeight:2,textAlign:'left',marginBottom:ipadTour(10)}}>
            ✨ Clear all 5 levels — no buying or repeating<br/>
            🎯 Find the Word of the Day — or any longer word containing it!<br/>
            🎉 Experience the big bonuses at Rainbow's End!<br/>
            <strong style={{color:'#f6d365'}}>Streaks increase your bonuses!</strong>
          </div>
          <div style={{fontSize:ipadTour(20),fontWeight:'bold',color:'#f6d365',marginBottom:ipadTour(10),letterSpacing:1}}>
            Now Get to Looting! ✏️
          </div>
          <div style={{fontSize:ipadTour(10),color:'rgba(255,255,255,0.35)',fontStyle:'italic'}}>
            Tap ↺ Tour anytime to replay this walkthrough
          </div>
        </div>
      )
    }
  ];

  const scene = scenes[cur];
  const nextBtnStyle = {
    flex:2, padding:ipadTour(12), borderRadius:12,
    background:'linear-gradient(135deg,#f6d365,#fda085)',
    color:'#1a1a2e', fontFamily:'Georgia,serif', fontSize:ipadTour(14),
    fontWeight:'bold', border:'none', cursor:'pointer',
    boxShadow: pulseOn ? '0 0 20px 6px rgba(246,211,101,0.9)' : 'none',
    transform: pulseOn ? 'scale(1.05)' : 'scale(1)',
    transition: 'box-shadow 0.7s ease, transform 0.7s ease'
  };
  const doneBtnStyle = {
    flex:2, padding:ipadTour(12), borderRadius:12,
    background:'linear-gradient(135deg,#00c853,#00e676)',
    color:'#003300', fontFamily:'Georgia,serif', fontSize:ipadTour(14),
    fontWeight:'bold', border:'none', cursor:'pointer',
    boxShadow: pulseOn ? '0 0 20px 6px rgba(0,200,83,0.9)' : 'none',
    transform: pulseOn ? 'scale(1.05)' : 'scale(1)',
    transition: 'box-shadow 0.7s ease, transform 0.7s ease'
  };

  // ── v152: LANDING screen — first thing shown when ↺ Tour is tapped ──
  if (mode === "landing") {
    const choiceCard = (emoji, title, sub, onClick, accent) => (
      <button className="ll-btn" onClick={onClick} style={{
        width:'100%', textAlign:'left', display:'flex', alignItems:'center', gap:ipadTour(14),
        padding:ipadTour(16), borderRadius:16, cursor:'pointer', marginBottom:ipadTour(12),
        background:'rgba(255,255,255,0.06)', border:`1px solid ${accent}`, fontFamily:'Georgia,serif'
      }}>
        <span style={{fontSize:ipadTour(28),lineHeight:1}}>{emoji}</span>
        <span style={{display:'flex',flexDirection:'column'}}>
          <span style={{fontSize:ipadTour(16),fontWeight:'bold',color:'#f6d365'}}>{title}</span>
          <span style={{fontSize:ipadTour(12),color:'rgba(255,255,255,0.7)',marginTop:ipadTour(2)}}>{sub}</span>
        </span>
      </button>
    );
    return (
      <div style={{position:'fixed',inset:0,zIndex:99999,background:'linear-gradient(160deg,#0a0820 0%,#1e1a4a 50%,#0f0e28 100%)',fontFamily:'Georgia,serif',color:'#f5f0e8',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:`calc(var(--ll-safe-top, 0px) + ${ipadIntroPad(16)}px) ${ipadIntroPad(16)}px ${ipadIntroPad(16)}px`,overflowY:'auto'}}>
        <div style={{width:'100%',maxWidth:ipadW(400)}}>
          <div style={{background:'linear-gradient(135deg,#1a1040,#2d1b69)',borderRadius:24,padding:ipadIntroPad(24),border:'2px solid rgba(167,139,250,0.5)',boxShadow:'0 16px 60px rgba(0,0,0,0.8)'}}>
            <div style={{textAlign:'center',marginBottom:ipadTour(18)}}>
              <div style={{display:'flex',justifyContent:'center',marginBottom:ipadTour(10)}}><PencilLogo size={ipadIcon(72)}/></div>
              <div style={{fontSize:ipadTour(18),fontWeight:'bold',color:'#f6d365',marginBottom:ipadTour(4)}}>LetterLoot</div>
              <div style={{fontSize:ipadTour(13),color:'rgba(255,255,255,0.8)'}}>What would you like to see?</div>
            </div>
            {choiceCard('📖','Full Walkthrough','Learn how to play',()=>{setCur(0);setMode("walkthrough");},'rgba(246,211,101,0.45)')}
            {choiceCard('📢','Latest Updates',"What's new in LetterLoot",()=>setMode("updates"),'rgba(167,139,250,0.55)')}
            <button className="ll-btn" onClick={onDone} style={{width:'100%',marginTop:ipadTour(4),padding:ipadTour(11),borderRadius:12,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.55)',fontFamily:'Georgia,serif',fontSize:ipadTour(13),cursor:'pointer'}}>Close ✕</button>
          </div>
        </div>
      </div>
    );
  }

  // ── v152/v204: LATEST UPDATES screen — v1.2 featured Finishing Flourish card + pared v1.1 recap
  //    (one-liners) with the live V/C demo retained. Button-accessible permanent reference. ──
  if (mode === "updates") {
    // v156: tier-aware scale for THIS screen only. v179: ipadTour is now itself tier-aware
    // (11" trimmed to 1.95x), so uT no longer applies its own 11" trim — it would double-trim.
    // uT now just defers to ipadTour on every device. Kept as a named alias so the scene's
    // call sites don't all have to change.
    const on11 = isIpadWidth() && !isLargeIpad();
    const uT = (base) => ipadTour(base);
    // v153: demo boxes now mirror the REAL in-game V/C box colors exactly —
    // Vowels green (#34d399 family), Consonants purple (#a78bfa family) — so the
    // demo teaches the same visual a player sees during play.
    const vcBox = (label, num, c) => (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:uT(4)}}>
        <div style={{
          minWidth:uT(54),padding:`${uT(6)}px ${uT(14)}px`,borderRadius:9,textAlign:'center',
          fontFamily:'Georgia,serif',
          background:c.bg,
          border:`2px solid ${c.border}`,
          boxShadow: vcDemoOn ? `0 0 22px 4px ${c.glow}` : `0 0 8px ${c.glow}`,
          filter: vcDemoOn ? 'brightness(2.2)' : 'brightness(1)',
          transition:'box-shadow 0.9s ease, filter 0.9s ease'
        }}>
          <div style={{fontSize:uT(20),fontWeight:'bold',color:c.num,textShadow:`0 0 8px ${c.glow}`}}>{num}</div>
          <div style={{fontSize:uT(10),fontWeight:'bold',letterSpacing:0.5,color:c.label}}>{label}</div>
        </div>
      </div>
    );
    const VOWEL_C = { bg:"rgba(52,211,153,0.16)", border:"#34d399", glow:"rgba(52,211,153,0.55)", num:"#6ee7b7", label:"#a7f3d0" };
    const CONSON_C = { bg:"rgba(167,139,250,0.16)", border:"#a78bfa", glow:"rgba(167,139,250,0.55)", num:"#c4b5fd", label:"#ddd6fe" };
    return (
      <div style={{position:'fixed',inset:0,zIndex:99999,background:'linear-gradient(160deg,#0a0820 0%,#1e1a4a 50%,#0f0e28 100%)',fontFamily:'Georgia,serif',color:'#f5f0e8',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',padding:`calc(var(--ll-safe-top, 0px) + ${ipadIntroPad(12)}px) ${ipadIntroPad(16)}px ${ipadIntroPad(40)}px`,overflowY:'auto',WebkitOverflowScrolling:'touch'}}>
        <div style={{width:'100%',maxWidth:ipadW(560),minHeight:'calc(100vh - var(--ll-safe-top, 0px) - '+ipadIntroPad(60)+'px)',display:'flex',flexDirection:'column'}}>
          <div style={{background:'linear-gradient(135deg,#1a1040,#2d1b69)',borderRadius:24,padding:ipadIntroPad(18),border:'2px solid rgba(167,139,250,0.5)',boxShadow:'0 16px 60px rgba(0,0,0,0.8)',flex:1,display:'flex',flexDirection:'column'}}>
            <div style={{textAlign:'center',fontSize:uT(17),fontWeight:'bold',color:'#f6d365',marginBottom:uT(16)}}>📢 What's New in v1.8</div>

            {/* v304: FEATURED Malleable WoD (1.8). */}
            <div style={{background:"rgba(246,211,101,0.16)",border:"2.5px solid rgba(246,211,101,0.85)",borderRadius:14,padding:uT(18),boxShadow:"0 0 28px rgba(246,211,101,0.35)"}}>
              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
                <span style={{fontSize:uT(24)}}>🎯</span>
                <span style={{fontSize:uT(21),color:"#ff4444",fontWeight:"bold",textShadow:"0 0 10px rgba(255,68,68,0.45)"}}>Malleable Word of the Day</span>
              </div>
              <div style={{fontSize:uT(17.5),color:"rgba(245,240,232,0.98)",lineHeight:1.6}}>The Word of the Day now bends to yer will. Any word that carries the WoD's root — SURPRISING, UNSURPRISED, SURPRISES for SURPRISED — counts as found, so long as it's at least as long as the listed word. Grow it and the bonus grows too: <strong style={{color:'#f6d365'}}>1,000 pts plus 200 for every extra letter</strong>.</div>
            </div>
            {/* v304: Today's Summary & My Flourishes card (1.8). */}
            <div style={{background:"rgba(167,139,250,0.14)",border:"2px solid rgba(167,139,250,0.7)",borderRadius:14,padding:uT(14),boxShadow:"0 0 18px rgba(167,139,250,0.25)",marginTop:uT(12)}}>
              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
                <span style={{fontSize:uT(20)}}>📊</span>
                <span style={{fontSize:uT(18),color:"#c4b5fd",fontWeight:"bold"}}>Today's Summary & My Flourishes</span>
              </div>
              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.95)",lineHeight:1.55}}>Every game now ends with a <strong style={{color:'#c4b5fd'}}>Today's Summary</strong> card — Perfect Day and streak, yer Finishing Flourishes, Word of the Day, and total time — with Leaderboard, Share, and Play Again right there. And under Stats, a new <strong style={{color:'#c4b5fd'}}>My Flourishes</strong> log keeps every board-clearing word you've ever flourished, by day and level.</div>
            </div>

            {/* v209/v213: Tour note CENTERED in the gap — bigger font, STRONGER border. */}
            <div style={{flex:0.8,minHeight:uT(18)}} />
            <div style={{textAlign:"center",fontSize:uT(17),color:"#f5f0e8",lineHeight:1.5,padding:`${uT(14)}px ${uT(16)}px`,background:"rgba(167,139,250,0.16)",border:"1.5px solid rgba(167,139,250,0.65)",borderRadius:10}}>Want to see this again? Tap <strong style={{color:"#f6d365"}}>↺ Tour</strong> anytime to review these changes.</div>
            <div style={{flex:0.8,minHeight:uT(18)}} />

            {/* v204/v213: pared v1.1 recap — bigger font, STRONGER border. Keeps its live V/C demo. */}
            <div style={{background:"rgba(255,255,255,0.05)",border:"1.5px solid rgba(255,255,255,0.28)",borderRadius:12,padding:uT(16),marginBottom:uT(14)}}>
              <div style={{fontSize:uT(13),letterSpacing:1,color:"rgba(245,240,232,0.7)",fontWeight:"bold",marginBottom:uT(11),textTransform:"uppercase"}}>Still worth knowing</div>
              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.92)",lineHeight:1.6}}>🔭 <strong style={{color:"#7cc4ff"}}>The Spyglass</strong> — tap SCOUT beside yer built word to check it before committing; the clock keeps runnin'.</div>
              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:uT(7)}}>🏴‍☠️ <strong style={{color:"#c4b5fd"}}>Flourish Leaderboard</strong> — the longest board-clearing Flourish words across all Looters.</div>
              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:uT(7)}}>🦜 <strong style={{color:"#ff4444"}}>Finishing Flourish Bonus</strong> — clear the board with a 5+ letter word for bonus treasure; longer = bigger haul.</div>
              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:uT(7)}}>✨ <strong style={{color:"#6ee7b7"}}>Loot Letters</strong> — one hidden tile per level scores 5×.</div>
              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:uT(7)}}>🏴‍☠️ <strong style={{color:"#c4b5fd"}}>Pirate Celebrations</strong> — cheers for big moments (toggle on or off on the "Ready?" screen).</div>
              <div style={{fontSize:uT(15.5),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:uT(7)}}>⚠️ <strong style={{color:"#7cc4ff"}}>Vowel / Consonant Alert</strong> — the letter boxes pulse when your balance gets risky.</div>
              <div style={{display:'flex',justifyContent:'center',gap:uT(20),padding:`${uT(12)}px 0 ${uT(2)}px`}}>
                {vcBox('VOWELS', 6, VOWEL_C)}
                {vcBox('CONSON.', 20, CONSON_C)}
              </div>
              <div style={{textAlign:'center',fontSize:uT(14),color:'#9ecbff',fontWeight:'bold',fontStyle:'italic',marginTop:uT(8)}}>↑ a risky balance — watch for the pulse in your game!</div>
            </div>

            <button className="ll-btn" onClick={()=>setMode("landing")} style={{width:'100%',padding:uT(13),borderRadius:12,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.65)',fontFamily:'Georgia,serif',fontSize:uT(14),cursor:'pointer'}}>← Back</button>
          </div>
        </div>
      </div>
    );
  }

  // ── WALKTHROUGH (original 6-scene flow) ──
  return (
    <div style={{position:'fixed',inset:0,zIndex:99999,background:'linear-gradient(160deg,#0a0820 0%,#1e1a4a 50%,#0f0e28 100%)',fontFamily:'Georgia,serif',color:'#f5f0e8',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:`calc(var(--ll-safe-top, 0px) + ${ipadIntroPad(12)}px) ${ipadIntroPad(16)}px ${ipadIntroPad(16)}px`,overflowY:'auto'}}>
      {/* v215 Option B: content vertically CENTERED (justifyContent:center on the container) so the
          empty space splits evenly above/below rather than dumping at the bottom — reads intentional. */}
      <div style={{width:'100%',maxWidth:ipadW(400),margin:'auto 0'}}>
        <div style={{display:'flex',gap:ipadTour(6),justifyContent:'center',marginBottom:ipadTour(10)}}>
          {scenes.map((_,i) => (
            <div key={i} onClick={()=>setCur(i)} style={{width:i===cur?ipadTour(20):ipadTour(8),height:ipadTour(8),borderRadius:4,background:i===cur?'#a78bfa':i<cur?'rgba(167,139,250,0.5)':'rgba(255,255,255,0.2)',transition:'all 0.3s',cursor:'pointer'}}/>
          ))}
        </div>
        <div style={{background:'linear-gradient(135deg,#1a1040,#2d1b69)',borderRadius:24,padding:ipadIntroPad(20),border:'2px solid rgba(167,139,250,0.5)',boxShadow:'0 16px 60px rgba(0,0,0,0.8)'}}>
          <div style={{fontSize:ipadTour(16),fontWeight:'bold',color:'#f6d365',marginBottom:ipadTour(6),textAlign:'center'}}>{scene.title}</div>
          {scene.desc ? <div style={{fontSize:ipadTour(13),color:'rgba(255,255,255,0.88)',textAlign:'center',lineHeight:1.7,marginBottom:ipadTour(14),fontWeight:'bold'}}>{scene.desc}</div> : null}
          {scene.content()}
          <div style={{display:'flex',gap:ipadTour(10),marginTop:ipadTour(16)}}>
            <button className="ll-btn" onClick={()=>cur>0?setCur(c=>c-1):setMode("landing")} style={{flex:1,padding:ipadTour(10),borderRadius:12,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.5)',fontFamily:'Georgia,serif',fontSize:ipadTour(12),cursor:'pointer'}}>
              {cur===0?'← Menu':'← Back'}
            </button>
            {scene.last
              ? <button className="ll-btn" onClick={onDone} style={doneBtnStyle}>✏️ Lets Play!</button>
              : <button className="ll-btn" onClick={()=>setCur(c=>c+1)} style={nextBtnStyle}>Next →</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function PencilLogo({ size = 120 }) {
  // Render the LetterLoot app icon image; fall back to pencil emoji if asset not found.
  const [imgOk, setImgOk] = useState(true);
  if (!imgOk) {
    const fontSize = Math.round(size * 0.35);
    return <span style={{fontSize:fontSize, lineHeight:1, display:"inline-block"}}>&#9999;&#65039;</span>;
  }
  return <img src="/icon-512.png" alt="LetterLoot" width={size} height={size} onError={()=>setImgOk(false)} style={{display:"inline-block", borderRadius: Math.round(size*0.18)}}/>;
}

function PencilIcon({ size = 32 }) {
  const fontSize = Math.round(size * 0.35);
  return <span style={{fontSize:fontSize, lineHeight:1, display:"inline-block"}}>&#9999;&#65039;</span>;
}


function RainbowPot({ size = 120 }) {
  const w = size; const h = Math.round(size * 0.9);
  return (
    <svg viewBox="0 0 300 160" width={w} height={h} xmlns="http://www.w3.org/2000/svg">
      <path d="M 10 140 A 160 150 0 0 1 200 80" fill="none" stroke="#8B00FF" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
      <path d="M 20 143 A 147 137 0 0 1 197 86" fill="none" stroke="#4400CC" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
      <path d="M 30 146 A 134 124 0 0 1 194 92" fill="none" stroke="#0055FF" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
      <path d="M 40 149 A 121 111 0 0 1 191 98" fill="none" stroke="#00AA00" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
      <path d="M 50 152 A 108 98 0 0 1 188 104" fill="none" stroke="#FFD700" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
      <path d="M 60 155 A 95 85 0 0 1 185 110" fill="none" stroke="#FF8C00" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
      <path d="M 70 158 A 82 72 0 0 1 182 116" fill="none" stroke="#FF2200" strokeWidth="13" strokeLinecap="round" opacity="0.9"/>
      <ellipse cx="200" cy="150" rx="30" ry="9" fill="#FFD700" opacity="0.25"/>
      <ellipse cx="200" cy="150" rx="28" ry="10" fill="#1a1a1a" stroke="#555" strokeWidth="1.2"/>
      <path d="M 172 138 Q 170 150 172 162 L 228 162 Q 230 150 228 138 Z" fill="#1c1c1c" stroke="#555" strokeWidth="1.2"/>
      <ellipse cx="200" cy="162" rx="28" ry="8" fill="#111" stroke="#444" strokeWidth="1"/>
      <path d="M 172 138 Q 175 128 200 126 Q 225 128 228 138 Z" fill="#333" stroke="#555" strokeWidth="1"/>
      <ellipse cx="200" cy="138" rx="28" ry="9" fill="#2a2a2a" stroke="#777" strokeWidth="1.5"/>
      <ellipse cx="188" cy="133" rx="8" ry="4" fill="#B8860B" stroke="#DAA520" strokeWidth="0.8"/>
      <ellipse cx="200" cy="129" rx="9" ry="4.5" fill="#DAA520" stroke="#FFD700" strokeWidth="0.8"/>
      <ellipse cx="212" cy="133" rx="8" ry="4" fill="#B8860B" stroke="#DAA520" strokeWidth="0.8"/>
      <ellipse cx="193" cy="135" rx="8.5" ry="4" fill="#FFD700" stroke="#DAA520" strokeWidth="0.8"/>
      <ellipse cx="207" cy="135" rx="8.5" ry="4" fill="#FFD700" stroke="#DAA520" strokeWidth="0.8"/>
      <ellipse cx="200" cy="131" rx="10" ry="5" fill="#FFE555" stroke="#DAA520" strokeWidth="1.2"/>
      <text x="200" y="133" textAnchor="middle" fontFamily="Georgia,serif" fontSize="5" fontWeight="bold" fill="#8B6914">LL</text>
      <text x="230" y="126" fontFamily="Georgia,serif" fontSize="10" fill="#FFD700" opacity="0.9">✦</text>
      <text x="166" y="128" fontFamily="Georgia,serif" fontSize="8" fill="#FFD700" opacity="0.8">✦</text>
      <text x="238" y="140" fontFamily="Georgia,serif" fontSize="7" fill="#FFD700" opacity="0.7">✦</text>
    </svg>
  );
}

// PotOfGold: pot-only variant of RainbowPot (no rainbow arcs). Used inline next to titles
// where the title already includes a rainbow emoji, avoiding redundancy.
function PotOfGold({ size = 60 }) {
  const w = size; const h = size;
  return (
    <svg viewBox="120 115 110 60" width={w} height={h} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="200" cy="150" rx="30" ry="9" fill="#FFD700" opacity="0.25"/>
      <ellipse cx="200" cy="150" rx="28" ry="10" fill="#1a1a1a" stroke="#555" strokeWidth="1.2"/>
      <path d="M 172 138 Q 170 150 172 162 L 228 162 Q 230 150 228 138 Z" fill="#1c1c1c" stroke="#555" strokeWidth="1.2"/>
      <ellipse cx="200" cy="162" rx="28" ry="8" fill="#111" stroke="#444" strokeWidth="1"/>
      <path d="M 172 138 Q 175 128 200 126 Q 225 128 228 138 Z" fill="#333" stroke="#555" strokeWidth="1"/>
      <ellipse cx="200" cy="138" rx="28" ry="9" fill="#2a2a2a" stroke="#777" strokeWidth="1.5"/>
      <ellipse cx="188" cy="133" rx="8" ry="4" fill="#B8860B" stroke="#DAA520" strokeWidth="0.8"/>
      <ellipse cx="200" cy="129" rx="9" ry="4.5" fill="#DAA520" stroke="#FFD700" strokeWidth="0.8"/>
      <ellipse cx="212" cy="133" rx="8" ry="4" fill="#B8860B" stroke="#DAA520" strokeWidth="0.8"/>
      <ellipse cx="193" cy="135" rx="8.5" ry="4" fill="#FFD700" stroke="#DAA520" strokeWidth="0.8"/>
      <ellipse cx="207" cy="135" rx="8.5" ry="4" fill="#FFD700" stroke="#DAA520" strokeWidth="0.8"/>
      <ellipse cx="200" cy="131" rx="10" ry="5" fill="#FFE555" stroke="#DAA520" strokeWidth="1.2"/>
      <text x="200" y="133" textAnchor="middle" fontFamily="Georgia,serif" fontSize="5" fontWeight="bold" fill="#8B6914">LL</text>
    </svg>
  );
}

function LetterLootLogo({ titleFontSize = 28, boxPadding = "8px 24px", showSubtitle = false }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <PencilLogo size={ipadIcon(140)} />
      <div style={{ display:"inline-block", background:"rgba(139,92,246,0.25)", border:"2.5px solid rgba(167,139,250,0.95)", borderRadius:12, padding:boxPadding, boxShadow:"0 0 28px rgba(139,92,246,0.5)" }}>
        <span style={{ fontSize:titleFontSize, fontWeight:"bold", letterSpacing:5, color:"#ffffff", textShadow:"0 0 16px rgba(167,139,250,0.85)", fontFamily:"Georgia,serif" }}>LetterLoot</span>
      </div>
      {showSubtitle && <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:4}}>Daily word puzzle · Every letter has a value</div>}
    </div>
  );
}

function Starfield() {
  const stars = [
    [23,45,1,0.6],[67,18,1.5,0.8],[120,55,1,0.5],[180,22,1,0.7],[240,40,1.5,0.6],
    [310,28,1,0.9],[360,55,1,0.5],[45,88,1,0.5],[95,105,1.5,0.7],[155,78,1,0.6],
    [205,95,1,0.8],[265,68,2,0.5],[335,90,1,0.7],[375,112,1.5,0.8],[30,145,1,0.6],
    [80,168,1,0.5],[140,142,1.5,0.7],[290,135,1,0.6],[350,158,1,0.8],[60,220,1,0.5],
    [110,240,1.5,0.7],[200,195,1,0.8],[330,210,1,0.6],[370,235,2,0.5],[20,300,1,0.7],
    [170,310,1,0.6],[280,295,1.5,0.8],[340,320,1,0.5],[50,380,1,0.7],[130,395,1.5,0.8],
    [220,370,1,0.6],[310,390,1,0.5],[380,410,1.5,0.7],[90,450,1,0.6],[195,465,1,0.8],
    [270,445,2,0.5],[355,470,1,0.7],[25,520,1.5,0.8],[115,535,1,0.6],[230,510,1,0.5],
    [320,545,1.5,0.7],[375,525,1,0.8],[60,600,1,0.6],[160,615,1.5,0.5],[250,590,1,0.7],
    [345,635,1,0.8],[38,335,1,0.6],[152,488,1.5,0.5],[298,478,1,0.8],[185,132,1.5,0.5],
    [142,312,1,0.8],[258,158,1,0.6],[8,192,1.5,0.5],[362,562,1,0.5],[108,668,1.5,0.6],
    [285,648,1,0.8],[15,65,1,0.4],[325,175,1.5,0.6],[88,388,1,0.7],[418,95,1,0.5],
  ];
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
      {stars.map(([x,y,r,o],i)=>(
        <div key={i} style={{position:"absolute",width:r*2,height:r*2,borderRadius:"50%",background:"#fff",opacity:o,left:`${(x/420)*100}%`,top:`${(y/680)*100}%`}}/>
      ))}
    </div>
  );
}

function getLifetimeData() {
  // Decay removed (May 24, 2026): Lifetime points are pure cumulative — they only
  // ever go up. Missed days no longer penalize the player. We keep the function
  // signature and return missedDays:0 to remain compatible with any callers that
  // still reference it.
  try {
    const data = JSON.parse(localStorage.getItem("ll_lifetime") || "null");
    if (!data) return { total: 0, lastPlayedDate: null, missedDays: 0 };
    return { ...data, missedDays: 0 };
  } catch { return { total: 0, lastPlayedDate: null, missedDays: 0 }; }
}
function saveLifetimeData(total) { try { localStorage.setItem("ll_lifetime", JSON.stringify({ total, lastPlayedDate: getTodayKey() })); } catch {} }

function getLocalStats() {
  const def = {
    daysPlayed:0, lastPlayedDate:null, currentStreak:0, longestStreak:0, lastStreakDate:null,
    perfectDaysAllTime:0, perfectDaysWeek:{}, weekKey:"", consecutivePerfectDays:0, lastPerfectDate:null,
    consecutiveValidWords:0, // Dragon badge tracking — resets on misspelling
    highScoreAllTime:0, highScoreWeek:{}, highScoreToday:0,
    highWordAllTime:0, highWordWeek:{}, highWordToday:0, highWordTodayWord:"", highWordAllTimeWord:"",
    fastestLevels:{"1":null,"2":null,"3":null,"4":null,"5":null},
    bestScorePerLevel:{"1":null,"2":null,"3":null,"4":null,"5":null},
    dailyScores:{}, collegiateWords:0, medicalWords:0,
    longestWordToday:"", longestWordAllTime:"",
    longWordBonuses:{"8":0,"9":0,"10":0,"11":0,"12":0,"13":0,"14+":0},
    infinityBest:0, infinityBestDate:"",
    spaceBadgeDates:{},
  };
  try {
    const data = JSON.parse(localStorage.getItem("ll_stats") || "null");
    if (!data) return def;
    const migratedFastest = { ...def.fastestLevels };
    if (data.fastestLevels) {
      Object.keys(data.fastestLevels).forEach(k => {
        const v = data.fastestLevels[k];
        if (v === null) migratedFastest[k] = null;
        else if (typeof v === "number") migratedFastest[k] = { seconds: v, date: "" };
        else migratedFastest[k] = v;
      });
    }
    return { ...def, ...data, fastestLevels: migratedFastest, bestScorePerLevel: data.bestScorePerLevel || def.bestScorePerLevel };
  } catch { return def; }
}
function saveLocalStats(stats) { try { localStorage.setItem("ll_stats", JSON.stringify(stats)); } catch {} }
function updateLocalStats(updates) {
  const stats = getLocalStats();
  const todayKey = getTodayKey(); const weekKey = getWeekKey();
  const yesterdayKey = getYesterdayKey();
  if (stats.lastPlayedDate !== todayKey) {
    stats.daysPlayed += 1;
    if (stats.lastStreakDate === yesterdayKey) stats.currentStreak += 1; else stats.currentStreak = 1;
    if (stats.currentStreak > stats.longestStreak) stats.longestStreak = stats.currentStreak;
    stats.lastStreakDate = todayKey; stats.lastPlayedDate = todayKey;
    stats.highScoreToday = 0; stats.highWordToday = 0; stats.highWordTodayWord = ""; stats.longestWordToday = "";
  }
  if (stats.weekKey !== weekKey) { stats.weekKey = weekKey; stats.perfectDaysWeek = {}; stats.highScoreWeek = {}; stats.highWordWeek = {}; }
  if (updates.score !== undefined) {
    if (updates.score > stats.highScoreToday) stats.highScoreToday = updates.score;
    if (updates.score > (stats.highScoreWeek[todayKey]||0)) stats.highScoreWeek[todayKey] = updates.score;
    if (updates.score > stats.highScoreAllTime) stats.highScoreAllTime = updates.score;
    stats.dailyScores = stats.dailyScores || {};
    if (!stats.dailyScores[todayKey] || updates.score > stats.dailyScores[todayKey]) stats.dailyScores[todayKey] = updates.score;
  }
  if (updates.wordScore !== undefined && updates.word !== undefined) {
    if (updates.wordScore > stats.highWordToday) { stats.highWordToday = updates.wordScore; stats.highWordTodayWord = updates.word; }
    if (updates.wordScore > (stats.highWordWeek[todayKey]||0)) stats.highWordWeek[todayKey] = updates.wordScore;
    if (updates.wordScore > stats.highWordAllTime) { stats.highWordAllTime = updates.wordScore; stats.highWordAllTimeWord = updates.word; }
  }
  if (updates.word) {
    if (!stats.longestWordToday || updates.word.length > stats.longestWordToday.length) stats.longestWordToday = updates.word;
    if (!stats.longestWordAllTime || updates.word.length > stats.longestWordAllTime.length) stats.longestWordAllTime = updates.word;
  }
  if (updates.source === "collegiate") stats.collegiateWords = (stats.collegiateWords||0) + 1;
  if (updates.source === "medical") stats.medicalWords = (stats.medicalWords||0) + 1;
  if (updates.longWordBonus !== undefined && updates.wordLength !== undefined) {
    const key = updates.wordLength >= 14 ? "14+" : String(updates.wordLength);
    stats.longWordBonuses = stats.longWordBonuses || {};
    stats.longWordBonuses[key] = (stats.longWordBonuses[key]||0) + 1;
  }
  if (updates.perfectDay) {
    // v249 DOUBLE-PAY FIX: detect a repeat PD for TODAY *before* recording this one.
    // perfectDaysWeek[todayKey] is the per-date counter, so >0 here means a PD was already
    // banked today (including one synced down from another device via the cloud merge).
    // lastPerfectDate === todayKey is the same signal from the other direction. On a repeat we
    // do NOT touch perfectDaysAllTime or consecutivePerfectDays — a PD is once per day, per
    // account, so a second PD the same day must not inflate the lifetime count or the streak
    // (observed before this fix: streak jumped 13→14 on a same-day second PD from another device).
    const pdAlreadyToday = ((stats.perfectDaysWeek || {})[todayKey] || 0) > 0
      || stats.lastPerfectDate === todayKey;
    stats.perfectDaysWeek[todayKey] = (stats.perfectDaysWeek[todayKey]||0) + 1;
    if (!pdAlreadyToday) {
      stats.perfectDaysAllTime += 1;
      // Track consecutive perfect days
      if (stats.lastPerfectDate === yesterdayKey) {
        stats.consecutivePerfectDays = (stats.consecutivePerfectDays || 0) + 1;
      } else {
        stats.consecutivePerfectDays = 1;
      }
    }
    stats.lastPerfectDate = todayKey;
  }
  if (updates.levelTime !== undefined && updates.levelNum !== undefined) {
    const lvl = String(updates.levelNum);
    const existing = stats.fastestLevels[lvl];
    const existingSecs = existing ? existing.seconds : null;
    if (existingSecs === null || updates.levelTime < existingSecs) stats.fastestLevels[lvl] = { seconds: updates.levelTime, date: getShortDateCompact() };
  }
  if (updates.levelScore !== undefined && updates.levelNum !== undefined) {
    const lvl = String(updates.levelNum);
    stats.bestScorePerLevel = stats.bestScorePerLevel || {};
    const existing = stats.bestScorePerLevel[lvl];
    if (!existing || updates.levelScore > existing.score) stats.bestScorePerLevel[lvl] = { score: updates.levelScore, date: getShortDateCompact() };
  }
  if (updates.infinityScore !== undefined) {
    if (updates.infinityScore > (stats.infinityBest||0)) {
      stats.infinityBest = updates.infinityScore;
      stats.infinityBestDate = getShortDateCompact();
    }
  }
  if (updates.spaceBadge) {
    stats.spaceBadgeDates = stats.spaceBadgeDates || {};
    stats.spaceBadgeDates[updates.spaceBadge] = getShortDateCompact();
  }
  saveLocalStats(stats); return stats;
}

// ── Badge storage ──────────────────────────────────────────────
function getBadgeStore() {
  try {
    const data = JSON.parse(localStorage.getItem("ll_badges_v2") || "null");
    if (data) {
      // Self-healing: prune any badge IDs that no longer exist in BADGE_DEFS
      // (handles cases where old badges were renamed/removed in past versions)
      const validIds = new Set(BADGE_DEFS.map(b => b.id));
      const cleaned = {
        lifetime: (data.lifetime || []).filter(id => validIds.has(id)),
        weekly: data.weekly || {},
        daily: data.daily || {},
      };
      // Persist the cleaned version if anything was stripped
      if (cleaned.lifetime.length !== (data.lifetime || []).length) {
        try { localStorage.setItem("ll_badges_v2", JSON.stringify(cleaned)); } catch {}
      }
      return cleaned;
    }
    const oldBadges = JSON.parse(localStorage.getItem("ll_stats") || "{}").badges || [];
    const validIds = new Set(BADGE_DEFS.map(b => b.id));
    return { lifetime: oldBadges.filter(id => validIds.has(id)), weekly: {}, daily: {} };
  } catch { return { lifetime: [], weekly: {}, daily: {} }; }
}
function saveBadgeStore(store) { try { localStorage.setItem("ll_badges_v2", JSON.stringify(store)); } catch {} }
function awardBadgeToStore(store, id, scope) {
  const todayKey = getTodayKey(); const weekKey = getWeekKey();
  const updated = { ...store, lifetime: [...store.lifetime], weekly: {...store.weekly}, daily: {...store.daily} };
  if (scope === "lifetime" || scope === "all") { if (!updated.lifetime.includes(id)) updated.lifetime.push(id); }
  if (scope === "weekly" || scope === "all") { if (!updated.weekly[weekKey]) updated.weekly[weekKey] = []; if (!updated.weekly[weekKey].includes(id)) updated.weekly[weekKey].push(id); }
  if (scope === "daily" || scope === "all") { if (!updated.daily[todayKey]) updated.daily[todayKey] = []; if (!updated.daily[todayKey].includes(id)) updated.daily[todayKey].push(id); }
  return updated;
}

// ── Daily history ──────────────────────────────────────────────
function getDailyHistory() {
  try {
    const data = JSON.parse(localStorage.getItem("ll_daily_history") || "null");
    if (!data || data.date !== getTodayKey()) return { date: getTodayKey(), games: [] };
    return data;
  } catch { return { date: getTodayKey(), games: [] }; }
}
function saveDailyHistory(history) { try { localStorage.setItem("ll_daily_history", JSON.stringify(history)); } catch {} }

// v302: persistent Finishing Flourish log — local, 30-day retention, guests included.
// Entry: { date, game, level, word, score, ts }. Written once per FF at award time. The cloud
// ff_words table (v285, signed-in only) is the long-term record; this covers guests, offline,
// and the per-game (Game 1 / Game 2) split the cloud row does not carry.
function getFFLog() { try { const a = JSON.parse(localStorage.getItem("ll_ff_log") || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }
function appendFFLog(entry) {
  try {
    const cutoff = Date.now() - 30 * 86400000;
    const log = getFFLog().filter(e => (e.ts || 0) >= cutoff);
    log.push(entry);
    localStorage.setItem("ll_ff_log", JSON.stringify(log));
  } catch {}
}
function getTodayFFs() { const k = getTodayKey(); return getFFLog().filter(e => e.date === k).sort((a, b) => (a.game || 0) - (b.game || 0) || a.level - b.level); }
function appendToDailyHistory(word, score, valid, medical, collegiate, gameIndex, loot=false, wotd=false) {
  const history = getDailyHistory();
  if (!history.games[gameIndex]) history.games[gameIndex] = [];
  history.games[gameIndex].push({ word, score, valid, medical, collegiate, loot, wotd });
  saveDailyHistory(history);
}

function getLocalTimeLeaderboard() {
  try {
    const data = JSON.parse(localStorage.getItem("ll_times") || "null");
    if (!data || typeof data !== "object") throw new Error();
    if (!data.levels) data.levels = {"1":[],"2":[],"3":[],"4":[],"5":[]};
    if (!data.perfect) data.perfect = [];
    [1,2,3,4,5].forEach(l => { if (!Array.isArray(data.levels[l])) data.levels[l] = []; });
    return data;
  } catch { return { levels:{"1":[],"2":[],"3":[],"4":[],"5":[]}, perfect:[] }; }
}
function saveLocalTimeLeaderboard(board) { try { localStorage.setItem("ll_times", JSON.stringify(board)); } catch {} }
function addLocalLevelTime(name, level, seconds) {
  const board = getLocalTimeLeaderboard();
  if (!board.levels[level]) board.levels[level] = [];
  board.levels[level].push({ name, seconds, date: getShortDateCompact() });
  board.levels[level].sort((a, b) => a.seconds - b.seconds);
  board.levels[level] = board.levels[level].slice(0, 5);
  saveLocalTimeLeaderboard(board); return board;
}
function addLocalPerfectTime(name, seconds) {
  const board = getLocalTimeLeaderboard();
  board.perfect.push({ name, seconds, date: getShortDateCompact() });
  board.perfect.sort((a, b) => a.seconds - b.seconds);
  board.perfect = board.perfect.slice(0, 10);
  saveLocalTimeLeaderboard(board); return board;
}
// v253: `owner` scopes the session to the account (Supabase user.id) or "guest".
// On resume, showIntro only restores a session whose owner matches the current
// signed-in identity — stops Player B landing on Player A's mid-game board after
// a same-device account switch (remaining-work item 4). Callers pass owner explicitly.
// v254: sessions are now stored under PER-OWNER KEYS ("ll_session__<owner>") instead of
// one shared slot. Rationale (found via Daryl's account-switch test, Jul 25): with a
// single slot, Player B's play OVERWRITES Player A's saved session — the v253 owner
// check then correctly refuses B's session for A, but A's own state is already gone,
// forcing a cloud restore that can't fully reconstruct (no level_complete in the cloud
// row). Per-owner keys mean each identity keeps its own session across switches.
function sessionKeyFor(owner) { return "ll_session__" + (owner || "guest"); }
function saveLocalSession(state, owner) {
  try {
    const own = owner || getCurrentOwnerSync();
    localStorage.setItem(sessionKeyFor(own), JSON.stringify({ ...state, savedDate: getTodayKey(), owner: own }));
  } catch {}
}
// v253: read the currently signed-in Supabase user id SYNCHRONOUSLY from the persisted
// auth session, so module-level session loading can owner-scope without waiting on React
// state. Supabase persists to `sb-<ref>-auth-token` by default. Returns "guest" when no
// session is present. Ref is the project ref used throughout this file.
function getCurrentOwnerSync() {
  try {
    const raw = localStorage.getItem("sb-zcevszxmoggmcmvyxjtn-auth-token");
    if (!raw) return "guest";
    const parsed = JSON.parse(raw);
    const uid = parsed?.user?.id || parsed?.currentSession?.user?.id;
    return uid || "guest";
  } catch { return "guest"; }
}
function loadLocalSession() {
  try {
    const owner = getCurrentOwnerSync();
    // v254: per-owner key first.
    let data = JSON.parse(localStorage.getItem(sessionKeyFor(owner)) || "null");
    let fromLegacy = false;
    // Legacy fallback (pre-v254 single-slot "ll_session"): honor it ONLY if its stamped
    // owner matches the current identity (missing owner = pre-v253 = treated as guest).
    if (!data) {
      const legacy = JSON.parse(localStorage.getItem("ll_session") || "null");
      if (legacy && (legacy.owner || "guest") === owner) { data = legacy; fromLegacy = true; }
    }
    if (!data || data.savedDate !== getTodayKey()) return null;
    // v253 account-scoping: never hand back a session owned by a different identity.
    // (With per-owner keys this is belt-and-suspenders, but it still guards the legacy path.)
    const sessOwner = data.owner || "guest";
    if (sessOwner !== owner) return null;
    // v258 FINDING-4 INVARIANT (Aug6a): the session and TODAY'S word history must AGREE
    // about what was played today. The word-history store (ll_daily_history) runs its own
    // date logic and has been correct at every boundary the session layer fumbled (Aug 3:
    // session reset, history intact; Aug 6: session claimed L1 complete / 11,453, history
    // said "No words yet"). A session that claims real play — submitted words or a positive
    // score — while today's word log is EMPTY is self-evidently laundered state from another
    // day. Self-repair: discard it (and delete the blob) so the player falls through to an
    // honest fresh start instead of a chimera. LOCAL-ONLY by design: cloud restores are
    // legitimately cross-device (history lives per-device), and the cloud-side laundering
    // writes are already killed by the v256 day-guard.
    const claimsPlay = (Array.isArray(data.submitted) && data.submitted.length > 0) || (data.totalScore || 0) > 0;
    if (claimsPlay) {
      const hist = JSON.parse(localStorage.getItem("ll_daily_history") || "null");
      const histIsToday = !!(hist && hist.date === getTodayKey());
      const histWordCount = histIsToday
        ? (hist.games || []).reduce((n, g) => n + (Array.isArray(g) ? g.length : 0), 0)
        : 0;
      if (histWordCount === 0) {
        if (DEBUG_MODE) console.log("[INVARIANT] session claims play today (" +
          ((data.submitted || []).length) + " words, score " + (data.totalScore || 0) +
          ") but today's word history is empty — laundered session discarded");
        localStorage.removeItem(sessionKeyFor(owner));
        if (fromLegacy) localStorage.removeItem("ll_session");
        return null;
      }
    }
    return data;
  } catch { return null; }
}
// v254: clears the CURRENT identity's session (per-owner key) AND the legacy single-slot
// key, so stale pre-v254 data can't resurrect through the fallback above.
function clearLocalSession() {
  try {
    localStorage.removeItem(sessionKeyFor(getCurrentOwnerSync()));
    localStorage.removeItem("ll_session");
  } catch {}
}
function getAllTimeStats() { try { return JSON.parse(localStorage.getItem("ll_alltime") || '{"words":0,"score":0}'); } catch { return {words:0,score:0}; } }
function saveAllTimeStats(stats) { try { localStorage.setItem("ll_alltime", JSON.stringify(stats)); } catch {} }

function scheduleNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const noon = new Date(); noon.setHours(12, 0, 0, 0);
  const sixPM = new Date(); sixPM.setHours(18, 0, 0, 0);
  [{ time: noon, msg: "✏️ Your daily LetterLoot puzzle is waiting!" }, { time: sixPM, msg: "⚠️ 6 hours left! Play LetterLoot before midnight!" }].forEach(({ time, msg }) => {
    const msUntil = time - now;
    if (msUntil > 0) setTimeout(() => { if (localStorage.getItem("ll_completed_today") !== getTodayKey()) new Notification("✏️ LetterLoot", { body: msg, icon: "/favicon.svg" }); }, msUntil);
  });
}
async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") { scheduleNotifications(); return true; }
  if (Notification.permission === "denied") return false;
  const permission = await Notification.requestPermission();
  if (permission === "granted") { scheduleNotifications(); return true; }
  return false;
}

// NOTE (v101, item #4): the former TOUR_STEPS array that lived here was DEAD CODE — defined but
// never rendered anywhere. The live in-app tour is the <VisualTour> component (search "function
// VisualTour"), which is already fully iPad-scaled via ipadTour(). The old backlog item #4 ("wrap
// TOUR_STEPS in ipadIntro()") was based on a stale diagnosis; there was nothing to wrap. Removed
// to prevent future confusion. If a text-step tour is ever wanted again, build it fresh.

// ── Install Prompt (Add to Home Screen) ───────────────────────
function detectPlatform() {
  // v89 FIX: inside the native Capacitor app, trust Capacitor's own platform detection.
  // The old user-agent sniff (below) is unreliable on iPadOS — iPad WebViews often report
  // a desktop/Mac user-agent, so isIOS came back false and share links wrongly used the
  // web URL instead of the App Store URL. Capacitor.getPlatform() returns "ios"/"android"
  // reliably inside the native app regardless of the UA string.
  try {
    if (window.Capacitor && typeof window.Capacitor.getPlatform === "function") {
      const p = window.Capacitor.getPlatform();
      if (p === "ios" || p === "android") return p;
    }
  } catch (e) {}
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/i.test(ua);
  return isIOS ? "ios" : isAndroid ? "android" : "desktop";
}

function isInstalled() {
  // Kept for backward compat with any saved state; PWA install flow is removed.
  return false;
}

// ── Share URL routing ─────────────────────────────────────────
// Returns the device-appropriate "where to play" URL for share messages.
// iOS users get the App Store. Everyone else gets the web URL.
//
// App Store listing (live as of June 13, 2026). Canonical short form using the
// numeric Apple ID — redirects to the full localized listing. App ID: 6769522298.
const APP_STORE_URL = "https://apps.apple.com/app/id6769522298";
const WEB_URL = "https://letterloot.net";

function getShareUrl() {
  const platform = detectPlatform();
  return platform === "ios" ? APP_STORE_URL : WEB_URL;
}

function getShareUrlLabel() {
  const platform = detectPlatform();
  return platform === "ios" ? "Download free on the App Store:" : "Play free at:";
}

function FarewellScreen({ totalScore, bestWord, bestWordScore, onDone, onViewStats, onViewLeaderboard, onPlayAgain, onShareResults, isGuest, perfectDay }) {
  // v87 (C+): feedback state for the "Share LetterLoot with a friend" copy action.
  const [inviteCopied, setInviteCopied] = useState(false);
  return (
    <div style={{ position:"fixed", inset:0, zIndex:99999, background:"#0a0820", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"30px 24px", fontFamily:"Georgia,serif", color:"#f5f0e8", overflowY:"auto" }}>
      <Starfield/>
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:ipadW(360)}}>
        <div style={{textAlign:"center",marginBottom:20}}><LetterLootLogo titleFontSize={ipadTour(32)} boxPadding={`${ipadTour(10)}px ${ipadTour(28)}px`}/></div>
        <div style={{textAlign:"center",width:"100%"}}>
          {/* v260 #3/#5: the farewell finally KNOWS when the day was Perfect. A PD player was
              previously sent off with "Great effort" + "no Perfect Day chance today" — reading
              as denial of the day they just banked. Copy by Daryl, Aug 11. */}
          <div style={{fontSize:ipadTour(22),fontWeight:"bold",color:"#f6d365",marginBottom:14}}>{perfectDay ? "🌈🏆 PERFECT DAY!" : "Great effort today! 🎉"}</div>
          <div style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:14,padding:ipadIntro(14),marginBottom:16,width:"100%"}}>
            <div style={{fontSize:ipadIntro(11),color:"rgba(255,255,255,0.95)",fontWeight:"bold",letterSpacing:0.5,marginBottom:6}}>Highest scoring word:</div>
            <div style={{fontSize:ipadTour(22),fontWeight:"bold",color:"#a78bfa",letterSpacing:3,marginBottom:4}}>{bestWord||"—"}</div>
            <div style={{fontSize:ipadTour(14),color:"#fda085",fontWeight:"bold",marginBottom:10}}>{bestWordScore||0} points</div>
            <div style={{height:1,background:"rgba(255,255,255,0.12)",marginBottom:10}}/>
            <div style={{fontSize:ipadIntro(11),color:"rgba(255,255,255,0.95)",fontWeight:"bold",letterSpacing:0.5,marginBottom:4}}>Total Score Today</div>
            <div style={{fontSize:ipadTour(30),fontWeight:"bold",color:"#f6d365"}}>{totalScore||0}</div>
          </div>
          <div style={{fontSize:ipadIntro(13),color:"#ffffff",lineHeight:1.6,fontWeight:"bold",marginBottom:14}}>
            {perfectDay ? "Perfect Day booty be yers, matey! Play on fer more gold if ye like \u2014 the treasure keeps stackin\u2019!" : "Try again? Replay for a higher score, but no Perfect Day chance today."}
          </div>
          {/* v64 (May 26): Simplified — Now + Later only. Tomorrow removed. */}
          {/* v267 Option A (Daryl, Aug 12): the PD modal already asked Now/Later — a PD
              farewell must not re-ask (the "double Later" gauntlet). One warm send-off;
              same-day return lands on the finished-day Welcome with replay available. */}
          {perfectDay ? (
            <button onClick={onDone} style={{width:"100%",padding:ipadChrome(13),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadChrome(15),fontWeight:"bold",border:"none",cursor:"pointer",fontFamily:"Georgia,serif",marginBottom:14}}>⚓ See ye next voyage!</button>
          ) : (<>
          <div style={{fontSize:ipadIntro(11),color:"rgba(255,255,255,0.95)",fontWeight:"bold",letterSpacing:1.5,marginBottom:6}}>PLAY AGAIN</div>
          <div style={{display:"flex",gap:6,marginBottom:14}}>
            <button onClick={()=>onPlayAgain && onPlayAgain("now")} style={{flex:1,padding:`${ipadChrome(10)}px ${ipadChrome(4)}px`,borderRadius:12,background:"linear-gradient(135deg,#00c853,#00e676)",color:"#003300",fontSize:ipadChrome(12),fontWeight:"bold",border:"none",cursor:"pointer",fontFamily:"Georgia,serif"}}>✏️ Now</button>
            <button onClick={()=>onPlayAgain && onPlayAgain("later")} style={{flex:1,padding:`${ipadChrome(10)}px ${ipadChrome(4)}px`,borderRadius:12,background:"linear-gradient(135deg,rgba(96,165,250,0.35),rgba(59,130,246,0.25))",border:"1px solid rgba(96,165,250,0.7)",color:"#dbeafe",fontSize:ipadChrome(12),fontWeight:"bold",cursor:"pointer",fontFamily:"Georgia,serif"}}>🌅 Later</button>
          </div>
          </>)}
          {/* Secondary row: Leaderboard / Stats / Close */}
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            <button onClick={onViewLeaderboard} style={{flex:1,padding:`${ipadChrome(9)}px ${ipadChrome(4)}px`,borderRadius:11,background:isGuest?"rgba(255,255,255,0.05)":"linear-gradient(135deg,rgba(246,211,101,0.25),rgba(253,160,133,0.2))",border:isGuest?"1px solid rgba(255,255,255,0.18)":"1px solid rgba(246,211,101,0.6)",color:isGuest?"rgba(255,255,255,0.55)":"#fef3c7",fontSize:ipadChrome(11),fontWeight:"bold",cursor:"pointer",fontFamily:"Georgia,serif"}}>{isGuest?<span><span style={{filter:"grayscale(0.6)",opacity:0.55}}>🏆</span> Leaders <span style={{color:"rgba(167,139,250,0.85)"}}>🔒</span></span>:"🏆 Leaders"}</button>
            <button onClick={onViewStats} style={{flex:1,padding:`${ipadChrome(9)}px ${ipadChrome(4)}px`,borderRadius:11,background:"linear-gradient(135deg,rgba(167,139,250,0.3),rgba(124,58,237,0.2))",border:"1px solid rgba(167,139,250,0.6)",color:"#ede9fe",fontSize:ipadChrome(11),fontWeight:"bold",cursor:"pointer",fontFamily:"Georgia,serif"}}>📊 Stats</button>
            <button onClick={onDone} style={{flex:1,padding:`${ipadChrome(9)}px ${ipadChrome(4)}px`,borderRadius:11,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.35)",color:"rgba(255,255,255,0.95)",fontSize:ipadChrome(11),fontWeight:"bold",cursor:"pointer",fontFamily:"Georgia,serif"}}>✕ Close</button>
          </div>
          {/* v72 (item 6): Share the player's actual day results (score, levels, words, time, WoD)
              even when it wasn't a Perfect Day. Routes through the parent's reliable share menu
              (Text / Email / Copy) rather than the navigator.clipboard call that fails in the WebView. */}
          {onShareResults && <button onClick={onShareResults} style={{width:"100%",padding:ipadChrome(10),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadChrome(12),fontWeight:"bold",cursor:"pointer",fontFamily:"Georgia,serif",border:"none",marginBottom:8}}>
            📤 Share My Results
          </button>}
          {/* Share LetterLoot — moved here from in-game play screen (May 2026). Post-game is the natural time to share.
              v87 (C+): use the reliable Capacitor Clipboard plugin (navigator.clipboard fails silently in the
              Capacitor WebView) + show "Copied!" feedback so the invite (with the App Store URL) actually copies. */}
          <button onClick={async ()=>{
            const inviteText = `✏️ Play LetterLoot — the daily word puzzle where every letter has a value! ${getShareUrlLabel()} ${getShareUrl()}`;
            try {
              await Clipboard.write({ string: inviteText });
              setInviteCopied(true);
              setTimeout(()=>setInviteCopied(false), 3000);
            } catch (e) {
              try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(inviteText); setInviteCopied(true); setTimeout(()=>setInviteCopied(false), 3000); } } catch (e2) {}
            }
          }} style={{width:"100%",padding:ipadChrome(10),borderRadius:12,background:"rgba(34,211,238,0.15)",border:"1px solid rgba(34,211,238,0.75)",color:"#67e8f9",fontSize:ipadChrome(12),fontWeight:"bold",cursor:"pointer",fontFamily:"Georgia,serif",marginBottom:10}}>
            {inviteCopied ? "✓ Copied — paste anywhere to invite a friend!" : "✏️ Share LetterLoot with a friend"}
          </button>
          <div style={{fontSize:ipadChrome(11),color:"rgba(255,255,255,0.85)",fontStyle:"italic",marginTop:8}}>{getShortDate()}</div>
        </div>
      </div>
    </div>
  );
}

function AuthScreen({ onGuest, onLogin }) {
  // Three player states:
  //  1. First-time visitor → "welcome" mode (Create Account + Play as Guest, equal weight)
  //  2. Returning guest (no signed-in account, but has played as guest before) → "welcome" mode with returning-guest copy
  //  3. Returning signed-in player who explicitly signed out → "welcome" mode too (v57 fix: previously
  //     defaulted to "login" which hid the Guest button. Now everyone sees the full menu including
  //     "Play as Guest" — they can tap "Sign In" to reach the login form if they want.)
  // v254: sessions now live under per-owner keys (ll_session__<owner>); prefix-scan so
  // returning guests are still recognized. Legacy "ll_session" is covered by the prefix.
  const hasSignedInBefore = !!(localStorage.getItem("ll_name") || Object.keys(localStorage).some(k => k.startsWith("ll_session")));
  const hasPlayedAsGuestBefore = localStorage.getItem("ll_guest_returning") === "1";
  const isReturningGuest = !hasSignedInBefore && hasPlayedAsGuestBefore;
  const [mode, setMode] = useState("welcome");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const handleSignUp = async () => {
    if (!email || !password || !name) { setError("Please fill in all fields"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (containsProfanity(name)) { setError("Please choose a different display name."); return; }
    setLoading(true); setError("");
    const { error } = await signUp(email, password, name); setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess("Account created! Please check your email to confirm, then sign in.");
    setTimeout(() => setMode("login"), 3000);
  };
  const handleSignIn = async () => {
    if (!email || !password) { setError("Please enter your email and password"); return; }
    setLoading(true); setError("");
    const { error } = await signIn(email, password); setLoading(false);
    if (error) { setError("Invalid email or password. Have you confirmed your email?"); return; }
    onLogin();
  };
  const handleForgot = async () => {
    if (!email) { setError("Please enter your email address"); return; }
    setLoading(true); setError("");
    const { error } = await resetPassword(email); setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess("Reset link sent! Check your email.");
  };
  const inputStyle = { width:"100%", padding:`${ipadMenu(11)}px ${ipadMenu(14)}px`, borderRadius:10, border:"1px solid rgba(255,255,255,0.25)", background:"rgba(255,255,255,0.08)", color:"#f5f0e8", fontSize:ipadMenu(14), fontFamily:"Georgia,serif", outline:"none", marginBottom:10, boxSizing:"border-box" };
  const btnStyle = (bg, color="#1a1a2e") => ({ width:"100%", padding:ipadMenu(13), borderRadius:12, border:"none", background:bg, color, fontSize:ipadMenu(14), fontWeight:"bold", fontFamily:"Georgia,serif", cursor:"pointer", marginBottom:8 });
  return (
    <div style={{ minHeight:"100vh", background:"#0a0820", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:ipadMenu(20), fontFamily:"Georgia,serif", color:"#f5f0e8", position:"relative" }}>
      <Starfield/>
      <div style={{zIndex:1, width:"100%", maxWidth:ipadW(360)}}>
        <div style={{textAlign:"center", marginBottom:28}}><LetterLootLogo titleFontSize={ipadMenu(30)} boxPadding={`${ipadMenu(8)}px ${ipadMenu(24)}px`} showSubtitle={true}/></div>
        {mode==="welcome"&&(
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:20,padding:`${ipadMenu(28)}px ${ipadMenu(24)}px`,border:"1px solid rgba(255,255,255,0.15)"}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              {isReturningGuest ? (
                <>
                  <div style={{fontSize:ipadMenu(15),fontWeight:"bold",color:"#22d3ee",marginBottom:8}}>Welcome back! 👋</div>
                  <div style={{fontSize:ipadMenu(12),color:"rgba(255,255,255,0.95)",lineHeight:1.6}}>Ready for another round? Create a free account this time to save your progress, share Perfect Day successes, and join the Leaderboard.</div>
                </>
              ) : (
                <>
                  <div style={{fontSize:ipadMenu(14),fontWeight:"bold",color:"#f6d365",marginBottom:8}}>Welcome!</div>
                  <div style={{fontSize:ipadMenu(12),color:"rgba(255,255,255,0.9)",lineHeight:1.6}}>Create an account to save your progress and compete on the Leaderboard — or play as a guest to try it out.</div>
                </>
              )}
            </div>
            <button style={btnStyle("linear-gradient(135deg,#a78bfa,#7c3aed)","#fff")} onClick={()=>setMode("signup")}>Create Account</button>
            <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
              <button style={{...btnStyle("linear-gradient(135deg,#f6d365,#fda085)"),width:"60%",padding:ipadMenu(8),fontSize:ipadMenu(12),marginBottom:0}} onClick={onGuest}>
                {isReturningGuest ? "Continue as Guest" : "Play as Guest"}
                {!isReturningGuest && <div style={{fontSize:ipadMenu(9),color:"rgba(26,26,46,0.95)",fontWeight:"bold",marginTop:2}}>Create account to join Leaderboard</div>}
              </button>
            </div>
            <div style={{textAlign:"center",marginTop:14,fontSize:ipadMenu(11),color:"rgba(255,255,255,0.9)"}}>Already have an account? <span style={{color:"#f6d365",cursor:"pointer",fontWeight:"bold"}} onClick={()=>setMode("login")}>Sign in</span></div>
          </div>
        )}
        {mode==="login"&&(
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:20,padding:`${ipadMenu(28)}px ${ipadMenu(24)}px`,border:"1px solid rgba(255,255,255,0.15)"}}>
            <div style={{textAlign:"center",marginBottom:18}}>
              {hasSignedInBefore && localStorage.getItem("ll_name") && (
                <div style={{fontSize:ipadMenu(16),fontWeight:"bold",color:"#22d3ee",marginBottom:8}}>
                  Welcome back, {localStorage.getItem("ll_name")}! 👋
                </div>
              )}
              <div style={{fontSize:ipadMenu(13),fontWeight:"bold",color:"#f6d365",letterSpacing:2}}>SIGN IN</div>
              {hasSignedInBefore && <div style={{fontSize:ipadMenu(11),color:"rgba(255,255,255,0.9)",marginTop:4}}>Sign in to sync your progress across devices</div>}
            </div>
            {error&&<div style={{background:"rgba(220,38,38,0.2)",border:"1px solid rgba(220,38,38,0.4)",borderRadius:8,padding:`${ipadMenu(8)}px ${ipadMenu(12)}px`,fontSize:ipadMenu(12),color:"#fca5a5",marginBottom:10}}>{error}</div>}
            {success&&<div style={{background:"rgba(34,197,94,0.2)",border:"1px solid rgba(34,197,94,0.4)",borderRadius:8,padding:`${ipadMenu(8)}px ${ipadMenu(12)}px`,fontSize:ipadMenu(12),color:"#86efac",marginBottom:10}}>{success}</div>}
            <input style={inputStyle} type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSignIn()}/>
            <input style={inputStyle} type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSignIn()}/>
            <button style={btnStyle("linear-gradient(135deg,#f6d365,#fda085)")} onClick={handleSignIn} disabled={loading}>{loading?"Signing in…":"Sign In"}</button>
            <div style={{textAlign:"center",marginTop:4}}><span style={{fontSize:ipadMenu(11),color:"rgba(255,255,255,0.85)",cursor:"pointer"}} onClick={()=>{setMode("forgot");setError("");}}>Forgot password?</span></div>
            <div style={{textAlign:"center",marginTop:12,fontSize:ipadMenu(12),color:"rgba(255,255,255,0.85)"}}>Don't have an account? <span style={{color:"#a78bfa",cursor:"pointer"}} onClick={()=>{setMode("signup");setError("");}}>Sign up</span></div>
            <button style={{...btnStyle("transparent","rgba(255,255,255,0.3)"),border:"none",fontSize:ipadMenu(12),marginTop:4}} onClick={()=>setMode("welcome")}>← Back</button>
          </div>
        )}
        {mode==="signup"&&(
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:20,padding:`${ipadMenu(28)}px ${ipadMenu(24)}px`,border:"1px solid rgba(255,255,255,0.15)"}}>
            <div style={{textAlign:"center",marginBottom:18}}><div style={{fontSize:ipadMenu(13),fontWeight:"bold",color:"#a78bfa",letterSpacing:2}}>CREATE ACCOUNT</div></div>
            {error&&<div style={{background:"rgba(220,38,38,0.2)",border:"1px solid rgba(220,38,38,0.4)",borderRadius:8,padding:`${ipadMenu(8)}px ${ipadMenu(12)}px`,fontSize:ipadMenu(12),color:"#fca5a5",marginBottom:10}}>{error}</div>}
            {success&&<div style={{background:"rgba(34,197,94,0.2)",border:"1px solid rgba(34,197,94,0.4)",borderRadius:8,padding:`${ipadMenu(8)}px ${ipadMenu(12)}px`,fontSize:ipadMenu(12),color:"#86efac",marginBottom:10}}>{success}</div>}
            <input style={inputStyle} type="text" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)}/>
            <input style={inputStyle} type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
            <input style={inputStyle} type="password" placeholder="Password (6+ characters)" value={password} onChange={e=>setPassword(e.target.value)}/>
            {/* Leaderboard disclosure block — added May 20, 2026 to satisfy App Store Guideline 5.1.2.
                Apple rejected build 1.0 (3) because the app uploaded scores to the global leaderboard
                without obtaining the user's consent. By placing this explicit disclosure directly above
                the Create Account button, signup itself becomes the consent event: the user is clearly
                informed about what data will be uploaded before they create the account. */}
            <div style={{background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.35)",borderRadius:12,padding:`${ipadMenu(12)}px ${ipadMenu(14)}px`,marginBottom:12,fontFamily:"Georgia,serif"}}>
              <div style={{fontSize:ipadMenu(12),fontWeight:"bold",color:"#f6d365",marginBottom:6,letterSpacing:0.5}}>🏆 About the Leaderboard</div>
              <div style={{fontSize:ipadMenu(11),lineHeight:1.6,color:"rgba(255,255,255,0.82)"}}>
                Creating an account lets you compete on the global leaderboard. We'll upload your name, scores, level times, and Perfect Day streaks so other players can see them. You can delete your account anytime from Menu → Account.
              </div>
              <div style={{marginTop:6,fontSize:ipadMenu(11)}}>
                <a href="https://letterloot.net/privacy.html" target="_blank" rel="noopener noreferrer" style={{color:"#60a5fa",textDecoration:"underline"}}>Read our privacy policy →</a>
              </div>
            </div>
            <button style={btnStyle("linear-gradient(135deg,#a78bfa,#7c3aed)","#fff")} onClick={handleSignUp} disabled={loading}>{loading?"Creating account…":"Create Account"}</button>
            <div style={{textAlign:"center",marginTop:8,fontSize:ipadMenu(12),color:"rgba(255,255,255,0.85)"}}>Already have an account? <span style={{color:"#f6d365",cursor:"pointer"}} onClick={()=>{setMode("login");setError("");}}>Sign in</span></div>
            <button style={{...btnStyle("transparent","rgba(255,255,255,0.3)"),border:"none",fontSize:ipadMenu(12),marginTop:4}} onClick={()=>setMode("welcome")}>← Back</button>
          </div>
        )}
        {mode==="forgot"&&(
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:20,padding:`${ipadMenu(28)}px ${ipadMenu(24)}px`,border:"1px solid rgba(255,255,255,0.15)"}}>
            <div style={{textAlign:"center",marginBottom:18}}><div style={{fontSize:ipadMenu(13),fontWeight:"bold",color:"#60a5fa",letterSpacing:2}}>RESET PASSWORD</div></div>
            {error&&<div style={{background:"rgba(220,38,38,0.2)",border:"1px solid rgba(220,38,38,0.4)",borderRadius:8,padding:`${ipadMenu(8)}px ${ipadMenu(12)}px`,fontSize:ipadMenu(12),color:"#fca5a5",marginBottom:10}}>{error}</div>}
            {success&&<div style={{background:"rgba(34,197,94,0.2)",border:"1px solid rgba(34,197,94,0.4)",borderRadius:8,padding:`${ipadMenu(8)}px ${ipadMenu(12)}px`,fontSize:ipadMenu(12),color:"#86efac",marginBottom:10}}>{success}</div>}
            <div style={{fontSize:ipadMenu(12),color:"rgba(255,255,255,0.9)",marginBottom:14,lineHeight:1.6}}>Enter your email and we'll send you a reset link.</div>
            <input style={inputStyle} type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
            <button style={btnStyle("linear-gradient(135deg,#60a5fa,#3b82f6)","#fff")} onClick={handleForgot} disabled={loading}>{loading?"Sending…":"Send Reset Link"}</button>
            <button style={{...btnStyle("transparent","rgba(255,255,255,0.3)"),border:"none",fontSize:ipadMenu(12),marginTop:4}} onClick={()=>setMode("login")}>← Back to Sign In</button>
          </div>
        )}
      </div>
    </div>
  );
}


// ── ADMIN DASHBOARD ──────────────────────────────────────────
const ADMIN_SUPABASE_URL = "https://zcevszxmoggmcmvyxjtn.supabase.co";
const ADMIN_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZXZzenhtb2dnbWNtdnl4anRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDExNDIsImV4cCI6MjA5MTE3NzE0Mn0.nZhiDxv5ssCrkHXxaboZ5ziH-M4NqNqPMop2s_gA6NM";
const ADMIN_PASSWORD = "!!Wxmanone2!!";

function AdminScreen({ onExit }) {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [data, setData] = useState(null);
  const [showDecided, setShowDecided] = useState(false); // v273: decisions-drawer toggle
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [selectedTab, setSelectedTab] = useState("overview");

  const adminQuery = async (table, select='*', extra='') => {
    let url = `${ADMIN_SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${extra}`;
    const r = await fetch(url, { headers: { apikey: ADMIN_ANON_KEY, Authorization: `Bearer ${ADMIN_ANON_KEY}` }});
    if (!r.ok) return [];
    return r.json();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const gameStates = await adminQuery('game_state', 'player_id,player_name,lifetime_points,last_played_date,current_streak,longest_streak,stats,badges', '&order=lifetime_points.desc');
      const td = new Date(); const today = td.getFullYear()+'-'+(td.getMonth()+1)+'-'+td.getDate();
      const tdAgo7 = new Date(Date.now()-7*86400000); const weekAgo = tdAgo7.getFullYear()+'-'+(tdAgo7.getMonth()+1)+'-'+tdAgo7.getDate();
      const tdAgo14 = new Date(Date.now()-14*86400000); const twoWeeksAgo = tdAgo14.getFullYear()+'-'+(tdAgo14.getMonth()+1)+'-'+tdAgo14.getDate();
      const todaySessions = await adminQuery('daily_sessions', 'player_id,date_key,total_score,perfect_day', `&date_key=eq.${today}`);
      // Date filtering: server-side gte on text columns has lexicographic bugs
      // (e.g. "2026-5-10" < "2026-5-3"), so fetch all and filter client-side numerically
      const weekAgoNum = tdAgo7.getFullYear()*10000 + (tdAgo7.getMonth()+1)*100 + tdAgo7.getDate();
      const twoWeeksAgoNum = tdAgo14.getFullYear()*10000 + (tdAgo14.getMonth()+1)*100 + tdAgo14.getDate();
      const allRecentForFilter = await adminQuery('daily_sessions', 'player_id,date_key', `&limit=2000`);
      const recentSessions = allRecentForFilter.filter(s => dateKeyToNum(s.date_key) >= twoWeeksAgoNum);
      const weekSessions = allRecentForFilter.filter(s => dateKeyToNum(s.date_key) >= weekAgoNum);
      const guestStats = await adminQuery('guest_stats', 'guest_plays').catch(()=>[{guest_plays:0}]);
      const wordReports = await adminQuery('word_reports', '*', '&order=reported_at.desc&limit=200').catch(()=>[]); // v273: widened so the pending view can't be crowded out by decided rows (split client-side)
      // Build top 25 longest words and top word scores from ALL daily sessions
      // (one entry per player per day they had a record-worthy word — multi-entry per player allowed)
      const allSessions = await adminQuery('daily_sessions', 'player_id,date_key,longest_word_today,top_word,top_word_score', '&limit=2000').catch(()=>[]);
      // Build a player_id → name lookup from gameStates
      const nameMap = {};
      gameStates.forEach(g => { if (g.player_id) nameMap[g.player_id] = g.player_name || 'Guest'; });
      // Top 25 longest — each session contributes one entry; sort by length, take 25
      const longestEntries = allSessions
        .filter(s => s.longest_word_today && s.longest_word_today.length > 0)
        .map(s => ({ player: nameMap[s.player_id] || 'Guest', word: s.longest_word_today, letters: s.longest_word_today.length, date: s.date_key }))
        .sort((a,b) => b.letters - a.letters || a.word.localeCompare(b.word))
        .slice(0, 25);
      // Top 25 word scores — each session contributes one entry; sort by score, take 25
      const scoreEntries = allSessions
        .filter(s => s.top_word && s.top_word_score > 0)
        .map(s => ({ player: nameMap[s.player_id] || 'Guest', word: s.top_word, score: s.top_word_score, date: s.date_key }))
        .sort((a,b) => b.score - a.score)
        .slice(0, 25);
      const top25Longest = longestEntries;
      const top25Score = scoreEntries;
      setData({ gameStates, todaySessions, recentSessions, weekSessions, today, top25Longest, top25Score, guestPlays: guestStats?.[0]?.guest_plays || 0, wordReports: wordReports || [] });
      setLastUpdated(new Date().toLocaleTimeString());
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (authed) loadData(); }, [authed]);
  useEffect(() => {
    if (!authed) return;
    const t = setInterval(loadData, 300000);
    return () => clearInterval(t);
  }, [authed]);

  const medal = (i) => i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`;
  const timeAgo = (str) => {
    if (!str) return '—';
    const d = Math.floor((Date.now()-new Date(str).getTime())/86400000);
    if (d===0) return 'Today'; if (d===1) return 'Yesterday'; return `${d}d ago`;
  };

  const cardStyle = (color) => ({ background: `rgba(${color},0.08)`, border: `1px solid rgba(${color},0.35)`, borderRadius:12, padding:'12px', textAlign:'center' });
  const tbl = { width:'100%', borderCollapse:'collapse', fontSize:11 };
  const th = { textAlign:'left', color:'rgba(255,255,255,0.4)', fontSize:9, letterSpacing:2, padding:'4px 8px', borderBottom:'1px solid rgba(255,255,255,0.08)', fontWeight:'normal' };
  const td = { padding:'7px 8px', borderBottom:'1px solid rgba(255,255,255,0.05)', color:'#f5f0e8' };

  if (!authed) return (
    <div style={{minHeight:'100vh',background:'#0a0820',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Georgia,serif',position:'relative'}}>
      <Starfield/>
      <div style={{position:'relative',zIndex:1,background:'linear-gradient(135deg,#1a1040,#2d1b69)',borderRadius:20,padding:'36px 32px',textAlign:'center',border:'1px solid rgba(255,255,255,0.15)',maxWidth:320,width:'90%'}}>
        <PencilLogo size={ipadIcon(140)}/>
        <div style={{fontSize:13,fontWeight:'bold',color:'#f6d365',letterSpacing:3,margin:'16px 0 20px'}}>ADMIN DASHBOARD</div>
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(pw===ADMIN_PASSWORD?(setAuthed(true),setPwError('')):(setPwError('Incorrect password')))} placeholder="Password" style={{width:'100%',padding:'11px 14px',borderRadius:10,border:'1px solid rgba(255,255,255,0.25)',background:'rgba(255,255,255,0.08)',color:'#f5f0e8',fontSize:14,fontFamily:'Georgia,serif',outline:'none',marginBottom:10,textAlign:'center'}}/>
        {pwError && <div style={{color:'#fca5a5',fontSize:11,marginBottom:8}}>{pwError}</div>}
        <button onClick={()=>pw===ADMIN_PASSWORD?(setAuthed(true),setPwError('')):(setPwError('Incorrect password'))} style={{width:'100%',padding:'13px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#f6d365,#fda085)',color:'#1a1a2e',fontSize:14,fontWeight:'bold',fontFamily:'Georgia,serif',cursor:'pointer'}}>Sign In</button>
        <button onClick={onExit} style={{marginTop:10,width:'100%',padding:'8px',borderRadius:10,background:'none',border:'1px solid rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.4)',fontSize:11,fontFamily:'Georgia,serif',cursor:'pointer'}}>← Back to Game</button>
      </div>
    </div>
  );

  const gs = data?.gameStates || [];
  const total = gs.length;
  const playedToday = data?.todaySessions?.length || 0;
  const newThisWeek = new Set((data?.weekSessions||[]).map(s=>s.player_id)).size;
  const perfectTotal = gs.reduce((a,g)=>a+(g.stats?.perfectDaysAllTime||0),0);
  const guestPlays = data?.guestPlays || 0;
  const longestStreak = gs.reduce((a,g)=>Math.max(a,g.longest_streak||0),0);

  // Chart data
  const chartCounts = {};
  const chartLabels = [];
  for(let i=13;i>=0;i--){
    const d=new Date(Date.now()-i*86400000);
    const key=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
    chartCounts[key]=0;
    chartLabels.push({key,label:d.toLocaleDateString('en-US',{weekday:'short'})});
  }
  (data?.recentSessions||[]).forEach(s=>{ if(chartCounts[s.date_key]!==undefined) chartCounts[s.date_key]++; });
  const chartMax = Math.max(...Object.values(chartCounts),1);

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#0a0820 0%,#1e1a4a 50%,#0f0e28 100%)',fontFamily:'Georgia,serif',color:'#f5f0e8',padding:'14px',position:'relative'}}>
      <Starfield/>
      <div style={{position:'relative',zIndex:1,maxWidth:900,margin:'0 auto'}}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,paddingBottom:12,borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
          <div>
            <div style={{fontSize:14,fontWeight:'bold',color:'#f6d365',letterSpacing:3}}>✏️ LETTERLOOT ADMIN</div>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.3)',marginTop:3}}>Last updated: {lastUpdated||'—'}</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={loadData} style={{background:'rgba(167,139,250,0.15)',border:'1px solid rgba(167,139,250,0.4)',borderRadius:12,padding:'4px 12px',color:'#a78bfa',fontFamily:'Georgia,serif',fontSize:11,cursor:'pointer'}}>{loading?'Loading…':'↺ Refresh'}</button>
            <button onClick={onExit} style={{background:'none',border:'1px solid rgba(255,255,255,0.2)',borderRadius:12,padding:'4px 12px',color:'rgba(255,255,255,0.5)',fontFamily:'Georgia,serif',fontSize:11,cursor:'pointer'}}>← Game</button>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:8}}>
          {[
            {label:'REGISTERED PLAYERS',val:total,color:'246,211,101',vc:'#f6d365'},
            {label:'PLAYED TODAY',val:playedToday,color:'34,211,238',vc:'#22d3ee'},
            {label:'NEW THIS WEEK',val:newThisWeek,color:'167,139,250',vc:'#a78bfa'},
          ].map((c,i)=>(
            <div key={i} style={cardStyle(c.color)}>
              <div style={{fontSize:28,fontWeight:'bold',color:c.vc}}>{c.val}</div>
              <div style={{fontSize:8,color:'rgba(255,255,255,0.5)',letterSpacing:2,marginTop:4}}>{c.label}</div>
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
          {[
            {label:'PERFECT DAYS',val:perfectTotal,color:'110,231,183',vc:'#6ee7b7'},
            {label:'LONGEST STREAK',val:longestStreak+'d',color:'253,160,133',vc:'#fda085'},
            {label:'GUEST GAMES PLAYED',val:guestPlays.toLocaleString(),color:'251,191,36',vc:'#fbbf24'},
          ].map((c,i)=>(
            <div key={i} style={cardStyle(c.color)}>
              <div style={{fontSize:28,fontWeight:'bold',color:c.vc}}>{c.val}</div>
              <div style={{fontSize:8,color:'rgba(255,255,255,0.5)',letterSpacing:2,marginTop:4}}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Activity chart */}
        <div style={{background:'rgba(255,255,255,0.04)',borderRadius:14,padding:14,marginBottom:12,border:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',letterSpacing:3,marginBottom:10}}>📅 DAILY ACTIVITY — LAST 14 DAYS</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:4,height:70}}>
            {chartLabels.map(({key,label})=>{
              const val=chartCounts[key];
              const pct=Math.max(3,(val/chartMax)*64);
              return(<div key={key} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                <div style={{fontSize:7,color:'rgba(255,255,255,0.5)'}}>{val||''}</div>
                <div style={{width:'100%',background:'linear-gradient(180deg,#f6d365,#fda085)',borderRadius:'3px 3px 0 0',height:pct}}/>
                <div style={{fontSize:7,color:'rgba(255,255,255,0.35)'}}>{label}</div>
              </div>);
            })}
          </div>
        </div>

        {/* Two col */}
        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:10,marginBottom:10}}>
          {/* Top scores */}
          <div style={{background:'rgba(255,255,255,0.04)',borderRadius:14,padding:14,border:'1px solid rgba(255,255,255,0.08)'}}>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',letterSpacing:3,marginBottom:10}}>🏆 TOP LIFETIME SCORES</div>
            {gs.length===0?<div style={{textAlign:'center',color:'rgba(255,255,255,0.25)',fontSize:11,padding:10}}>No data yet</div>:
            <table style={tbl}><thead><tr><th style={th}></th><th style={th}>Player</th><th style={th}>Pts</th><th style={th}>Last Active</th></tr></thead><tbody>
              {gs.slice(0,8).map((g,i)=>(
                <tr key={i}><td style={td}>{medal(i)}</td><td style={td}>{g.player_name||'Guest'}</td><td style={{...td,color:'#f6d365',fontWeight:'bold'}}>{(g.lifetime_points||0).toLocaleString()}</td><td style={{...td,color:'rgba(255,255,255,0.4)',fontSize:10}}>{timeAgo(g.last_played_date)}</td></tr>
              ))}
            </tbody></table>}
          </div>
          {/* Perfect day leaders */}
          <div style={{background:'rgba(255,255,255,0.04)',borderRadius:14,padding:14,border:'1px solid rgba(255,255,255,0.08)'}}>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',letterSpacing:3,marginBottom:10}}>🌈 PERFECT DAY LEADERS</div>
            {gs.length===0?<div style={{textAlign:'center',color:'rgba(255,255,255,0.25)',fontSize:11,padding:10}}>No data yet</div>:
            <table style={tbl}><thead><tr><th style={th}></th><th style={th}>Player</th><th style={th}>Perfect Days</th><th style={th}>Streak</th></tr></thead><tbody>
              {[...gs].sort((a,b)=>(b.stats?.perfectDaysAllTime||0)-(a.stats?.perfectDaysAllTime||0)).slice(0,8).map((g,i)=>(
                <tr key={i}><td style={td}>{medal(i)}</td><td style={td}>{g.player_name||'Guest'}</td><td style={{...td,color:'#6ee7b7',fontWeight:'bold'}}>🌈🏆 {g.stats?.perfectDaysAllTime||0}</td><td style={{...td,color:'#fda085',fontSize:10}}>🔥 {g.current_streak||0}d</td></tr>
              ))}
            </tbody></table>}
          </div>
        </div>

        {/* Top 25 longest words + top word scores */}
        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:10,marginBottom:10}}>
          <div style={{background:'rgba(255,255,255,0.04)',borderRadius:14,padding:14,border:'1px solid rgba(255,255,255,0.08)'}}>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',letterSpacing:3,marginBottom:10}}>📏 TOP 25 LONGEST WORDS</div>
            {!(data?.top25Longest?.length)?<div style={{textAlign:'center',color:'rgba(255,255,255,0.25)',fontSize:11,padding:10}}>No data yet</div>:
            <table style={tbl}><thead><tr><th style={th}>#</th><th style={th}>Word</th><th style={th}>Letters</th><th style={th}>Player</th></tr></thead><tbody>
              {(data.top25Longest||[]).map((w,i)=>(
                <tr key={i}>
                  <td style={{...td,color:'rgba(255,255,255,0.3)',fontSize:10}}>{medal(i)}</td>
                  <td style={{...td,color:'#a78bfa',fontWeight:'bold',letterSpacing:2}}>{w.word}</td>
                  <td style={{...td,color:'#22d3ee',fontWeight:'bold'}}>{w.letters}</td>
                  <td style={{...td,color:'rgba(255,255,255,0.5)',fontSize:10}}>{w.player}</td>
                </tr>
              ))}
            </tbody></table>}
          </div>
          <div style={{background:'rgba(255,255,255,0.04)',borderRadius:14,padding:14,border:'1px solid rgba(255,255,255,0.08)'}}>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',letterSpacing:3,marginBottom:10}}>💎 TOP 25 WORD SCORES</div>
            {!(data?.top25Score?.length)?<div style={{textAlign:'center',color:'rgba(255,255,255,0.25)',fontSize:11,padding:10}}>No data yet</div>:
            <table style={tbl}><thead><tr><th style={th}>#</th><th style={th}>Word</th><th style={th}>Score</th><th style={th}>Player</th></tr></thead><tbody>
              {(data.top25Score||[]).map((w,i)=>(
                <tr key={i}>
                  <td style={{...td,color:'rgba(255,255,255,0.3)',fontSize:10}}>{medal(i)}</td>
                  <td style={{...td,color:'#f093fb',fontWeight:'bold',letterSpacing:2}}>{w.word}</td>
                  <td style={{...td,color:'#f6d365',fontWeight:'bold'}}>{w.score} pts</td>
                  <td style={{...td,color:'rgba(255,255,255,0.5)',fontSize:10}}>{w.player}</td>
                </tr>
              ))}
            </tbody></table>}
          </div>
        </div>

        {/* Word Reports */}
        <div style={{background:'rgba(251,113,133,0.04)',borderRadius:14,padding:14,marginBottom:10,border:'1px solid rgba(251,113,133,0.2)'}}>
          {/* v273 (Daryl, Aug 19): AUTO-CLEAR — decided words leave the review list the moment
              they're approved/rejected; only PENDING shows here. Recent decisions live behind
              the toggle below, each with an Undo back to pending (the safety net: once decided
              rows auto-hide, a mis-tap needs a one-tap way back). */}
          <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',letterSpacing:3,marginBottom:10}}>📝 REPORTED WORDS — PENDING ({(data?.wordReports||[]).filter(r=>!r.status||r.status==='pending').length})</div>
          {!((data?.wordReports||[]).filter(r=>!r.status||r.status==='pending').length)?<div style={{textAlign:'center',color:'rgba(255,255,255,0.25)',fontSize:11,padding:10}}>No words awaiting review 🎉</div>:
          <table style={tbl}><thead><tr><th style={th}>Word</th><th style={th}>Reported by</th><th style={th}>When</th><th style={th}>Status</th><th style={th}>Action</th></tr></thead><tbody>
            {(data.wordReports||[]).filter(r=>!r.status||r.status==='pending').map((r,i)=>(
              <tr key={i}>
                <td style={{...td,color: r.status==='rejected'?'rgba(255,255,255,0.3)':'#fda4af',fontWeight:'bold',letterSpacing:2,textDecoration:r.status==='rejected'?'line-through':'none'}}>{r.word}</td>
                <td style={td}>{r.player_name||'Guest'}</td>
                <td style={{...td,color:'rgba(255,255,255,0.4)',fontSize:10}}>{new Date(r.reported_at).toLocaleString()}</td>
                <td style={{...td,fontSize:10,color: r.status==='approved'?'#6ee7b7':r.status==='rejected'?'rgba(255,255,255,0.3)':'#f6d365'}}>{r.status==='approved'?'✓ Approved':r.status==='rejected'?'✗ Rejected':'⏳ Pending'}</td>
                <td style={td}>
                  {(!r.status||r.status==='pending')&&(
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={async()=>{
                        try{
                          const res = await fetch(`${ADMIN_SUPABASE_URL}/rest/v1/word_reports?id=eq.${r.id}`,{
                            method:'PATCH',
                            headers:{apikey:ADMIN_ANON_KEY,Authorization:`Bearer ${ADMIN_ANON_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'},
                            body:JSON.stringify({status:'approved'})
                          });
                          if(!res.ok){const errText=await res.text().catch(()=>'');alert('Approve failed: '+res.status+'\n'+errText);return;}
                          // v150: notify registered player of outcome (guests have null email → skip)
                          if(r.email){
                            fetch("https://letterloot-6k6v.vercel.app/api/send-word-email",{
                              method:"POST",
                              headers:{"Content-Type":"application/json"},
                              body:JSON.stringify({type:"player_status",status:"approved",word:r.word,playerName:r.player_name||"Player",email:r.email})
                            }).catch(err=>console.error("Player notify (approve) failed:",err));
                          }
                          loadData();
                        }catch(e){alert('Approve error: '+e.message);}
                      }} style={{padding:'3px 8px',borderRadius:6,border:'1px solid rgba(110,231,183,0.5)',background:'rgba(110,231,183,0.15)',color:'#6ee7b7',fontSize:10,fontWeight:'bold',cursor:'pointer'}}>✓ Approve</button>
                      <button onClick={async()=>{
                        try{
                          const res = await fetch(`${ADMIN_SUPABASE_URL}/rest/v1/word_reports?id=eq.${r.id}`,{
                            method:'PATCH',
                            headers:{apikey:ADMIN_ANON_KEY,Authorization:`Bearer ${ADMIN_ANON_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'},
                            body:JSON.stringify({status:'rejected'})
                          });
                          if(!res.ok){const errText=await res.text().catch(()=>'');alert('Reject failed: '+res.status+'\n'+errText);return;}
                          // v150: notify registered player of outcome (guests have null email → skip)
                          if(r.email){
                            fetch("https://letterloot-6k6v.vercel.app/api/send-word-email",{
                              method:"POST",
                              headers:{"Content-Type":"application/json"},
                              body:JSON.stringify({type:"player_status",status:"rejected",word:r.word,playerName:r.player_name||"Player",email:r.email})
                            }).catch(err=>console.error("Player notify (reject) failed:",err));
                          }
                          loadData();
                        }catch(e){alert('Reject error: '+e.message);}
                      }} style={{padding:'3px 8px',borderRadius:6,border:'1px solid rgba(251,113,133,0.5)',background:'rgba(251,113,133,0.15)',color:'#fda4af',fontSize:10,fontWeight:'bold',cursor:'pointer'}}>✗ Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody></table>}
          {(() => {
            const decided = (data?.wordReports||[]).filter(r=>r.status==='approved'||r.status==='rejected').slice(0,20);
            if (!decided.length) return null;
            return (<div style={{marginTop:10}}>
              <button onClick={()=>setShowDecided(v=>!v)} style={{padding:'4px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.6)',fontSize:10,cursor:'pointer'}}>{showDecided?'▾ Hide recent decisions':`▸ Show recent decisions (${decided.length})`}</button>
              {showDecided && <table style={{...tbl,marginTop:8}}><thead><tr><th style={th}>Word</th><th style={th}>Decision</th><th style={th}>When</th><th style={th}></th></tr></thead><tbody>
                {decided.map((r,i)=>(
                  <tr key={'d'+i}>
                    <td style={{...td,color:r.status==='rejected'?'rgba(255,255,255,0.35)':'#6ee7b7',letterSpacing:2,textDecoration:r.status==='rejected'?'line-through':'none'}}>{r.word}</td>
                    <td style={{...td,fontSize:10,color:r.status==='approved'?'#6ee7b7':'rgba(255,255,255,0.35)'}}>{r.status==='approved'?'✓ Approved':'✗ Rejected'}</td>
                    <td style={{...td,color:'rgba(255,255,255,0.4)',fontSize:10}}>{new Date(r.reported_at).toLocaleString()}</td>
                    <td style={td}><button onClick={async()=>{
                      try{
                        const res = await fetch(`${ADMIN_SUPABASE_URL}/rest/v1/word_reports?id=eq.${r.id}`,{
                          method:'PATCH',
                          headers:{apikey:ADMIN_ANON_KEY,Authorization:`Bearer ${ADMIN_ANON_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'},
                          body:JSON.stringify({status:'pending'})
                        });
                        if(!res.ok){const errText=await res.text().catch(()=>'');alert('Undo failed: '+res.status+'\n'+errText);return;}
                        loadData(); /* silent: no player email on undo — the eventual re-decision notifies */
                      }catch(e){alert('Undo error: '+e.message);}
                    }} style={{padding:'3px 8px',borderRadius:6,border:'1px solid rgba(246,211,101,0.5)',background:'rgba(246,211,101,0.12)',color:'#f6d365',fontSize:10,fontWeight:'bold',cursor:'pointer'}}>↩ Undo</button></td>
                  </tr>
                ))}
              </tbody></table>}
            </div>);
          })()}
          <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginTop:8,fontStyle:'italic'}}>Approved words automatically added to live game whitelist</div>
        </div>

        {/* All players table */}
        <div style={{background:'rgba(255,255,255,0.04)',borderRadius:14,padding:14,border:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',letterSpacing:3,marginBottom:10}}>📋 ALL PLAYERS ({total})</div>
          {gs.length===0?<div style={{textAlign:'center',color:'rgba(255,255,255,0.25)',fontSize:11,padding:10}}>No players yet</div>:
          <table style={tbl}><thead><tr><th style={th}>#</th><th style={th}>Player</th><th style={th}>Lifetime Pts</th><th style={th}>Current Streak</th><th style={th}>Best Streak</th><th style={th}>Perfect Days</th><th style={th}>Badges</th><th style={th}>Last Played</th></tr></thead><tbody>
            {gs.map((g,i)=>(
              <tr key={i}>
                <td style={{...td,color:'rgba(255,255,255,0.3)',fontSize:10}}>{i+1}</td>
                <td style={td}>{g.player_name||'Guest'}</td>
                <td style={{...td,color:'#f6d365',fontWeight:'bold'}}>{(g.lifetime_points||0).toLocaleString()}</td>
                <td style={{...td,color:'#fda085'}}>{g.current_streak?'🔥 '+g.current_streak+'d':'—'}</td>
                <td style={{...td,color:'rgba(255,255,255,0.5)',fontSize:10}}>{g.longest_streak||0}d</td>
                <td style={{...td,color:'#6ee7b7'}}>{g.stats?.perfectDaysAllTime?'🌈🏆 '+g.stats.perfectDaysAllTime:'—'}</td>
                <td style={{...td,color:'rgba(255,255,255,0.5)',fontSize:10}}>{(g.badges||[]).length} earned</td>
                <td style={{...td,color:'rgba(255,255,255,0.4)',fontSize:10}}>{timeAgo(g.last_played_date)}</td>
              </tr>
            ))}
          </tbody></table>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 🛠 DEBUG MENU COMPONENT
// Full-screen panel with quick-jump buttons. Triggered when DEBUG_MODE=true
// and user taps the floating "🛠 DEBUG" badge.
// Calls onAction(actionString) which is set as debugAction state — both App
// and GameScreen watch this and execute on detection.
// ═══════════════════════════════════════════════════════════════════
function DebugMenu({ onClose, onAction, currentMode }) {
  const btn = (label, action, color = "#22d3ee") => (
    <button onClick={() => { onAction(action); onClose(); }} style={{
      padding: `${ipadDense(14)}px ${ipadDense(16)}px`, borderRadius: 10, border: `1px solid ${color}`,
      background: `${color}15`, color, fontSize: ipadDense(14), fontWeight: "bold",
      fontFamily: "Georgia,serif", cursor: "pointer", textAlign: "left"
    }}>
      {label}
    </button>
  );
  const sectionStyle = { marginBottom: 18 };
  const headerStyle = { fontSize: ipadDense(12), color: "rgba(255,255,255,0.6)", letterSpacing: 2, fontWeight: "bold", marginBottom: 8, textTransform: "uppercase" };
  const gridStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0a0820 0%,#1a0a1a 50%,#0a0820 100%)", color: "#f5f0e8", fontFamily: "Georgia,serif", padding: "24px 20px", overflowY: "auto" }}>
      <div style={{ maxWidth: isIpadWidth() ? 760 : 500, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div>
            <div style={{ fontSize: ipadDense(24), fontWeight: "bold", color: "#fb7185" }}>🛠 DEBUG MENU</div>
            <div style={{ fontSize: ipadDense(11), color: "rgba(255,255,255,0.5)", marginTop: 4 }}>Currently: <span style={{ color: "#22d3ee" }}>{currentMode}</span></div>
          </div>
          <button onClick={onClose} style={{ padding: `${ipadDense(10)}px ${ipadDense(16)}px`, borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.2)", color: "#f5f0e8", fontSize: ipadDense(14), fontFamily: "Georgia,serif", cursor: "pointer" }}>
            Close ✕
          </button>
        </div>

        <div style={sectionStyle}>
          <div style={headerStyle}>🎮 Jump to Level (fresh game)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
            {btn("L1", "jump-L1", "#22d3ee")}
            {btn("L2", "jump-L2", "#22d3ee")}
            {btn("L3", "jump-L3", "#22d3ee")}
            {btn("L4", "jump-L4", "#22d3ee")}
            {btn("L5", "jump-L5", "#22d3ee")}
          </div>
          <div style={{ fontSize: ipadDense(10), color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Starts fresh game at chosen level. Tiles auto-generated.</div>
        </div>

        <div style={sectionStyle}>
          <div style={headerStyle}>🎉 Trigger End-Game Modals</div>
          <div style={gridStyle}>
            {btn("🌈 Perfect Day", "modal-perfect-day", "#f6d365")}
            {btn("🏆 Streak Bonus", "modal-streak", "#f6d365")}
            {btn("🔁 Repeat PD", "modal-repeat-pd", "#f6d365")}
            {btn("👋 Farewell", "modal-farewell", "#fda085")}
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={headerStyle}>🎯 Trigger Mid-Game Modals</div>
          <div style={gridStyle}>
            {btn("😬 Stuck Modal", "modal-stuck", "#fb7185")}
            {btn("💰 Buy Level", "modal-buy-level", "#a78bfa")}
            {btn("👤 Guest Upsell", "modal-guest-upsell", "#a78bfa")}
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={headerStyle}>🎭 Trigger Mascot Popups (4s dwell)</div>
          <div style={gridStyle}>
            {btn("⚓ Level Clear", "mascot-level-clear", "#6ee7b7")}
            {btn("⭐ Great Word", "mascot-great-word", "#6ee7b7")}
            {btn("💥 Loot Letter", "mascot-loot", "#6ee7b7")}
            {btn("🎯 Word of the Day", "mascot-wotd", "#6ee7b7")}
          </div>
          <div style={{ fontSize: ipadDense(10), color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Previews each mascot celebration with its real art + a sample line. Great Word render is a v113 preview (trigger logic lands next). Loot/WoD/Great Word self-dismiss at 4s.</div>
        </div>

        <div style={sectionStyle}>
          <div style={headerStyle}>⚙️ State Helpers</div>
          <div style={gridStyle}>
            {btn("🆕 Start Fresh Game", "fresh-game", "#22d3ee")}
            {btn("🏁 Near Game End", "near-end", "#22d3ee")}
            {btn("🗑 Wipe localStorage", "wipe-local", "#fb7185")}
            {btn("📋 Welcome Screen", "go-welcome", "#22d3ee")}
            {btn("📢 What's New Popup", "show-whatsnew", "#f6d365")}
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={headerStyle}>👤 Guest Mode</div>
          <div style={gridStyle}>
            {btn("🆔 Become Guest", "become-guest", "#a78bfa")}
            {btn("🔐 Sign Out → Auth", "sign-out-to-auth", "#a78bfa")}
          </div>
          <div style={{ fontSize: ipadDense(10), color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Become Guest: instantly switch to guest mode without going through Auth screen. Sign Out → Auth: full sign-out flow that lets you re-enter as guest, sign in, or sign up.</div>
        </div>

        <div style={{ marginTop: 32, padding: 12, borderRadius: 10, background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.3)" }}>
          <div style={{ fontSize: ipadDense(11), color: "#fb7185", fontWeight: "bold", marginBottom: 4 }}>⚠ DEBUG_MODE is currently TRUE</div>
          <div style={{ fontSize: ipadDense(10), color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>Set <code>DEBUG_MODE = false</code> at top of App.jsx before App Store submission. The 🛠 badge will disappear and this menu will be unreachable.</div>
        </div>
      </div>
    </div>
  );
}

// Floating "🛠 DEBUG" badge — bottom-right corner, always visible when DEBUG_MODE=true.
// Bottom-right avoids the iPad/iPhone status bar (battery, signal indicators)
// which was hiding/blocking the top-right placement.
function DebugBadge({ onClick }) {
  const handleTap = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  };
  return (
    <div
      onClick={handleTap}
      onTouchEnd={handleTap}
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        right: 12,
        zIndex: 999999,
        padding: "10px 16px",
        borderRadius: 24,
        background: "rgba(220,38,38,0.95)",
        color: "#fff",
        fontSize: 13,
        fontWeight: "bold",
        fontFamily: "Georgia,serif",
        letterSpacing: 1,
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.4)",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "manipulation",
        pointerEvents: "auto",
        whiteSpace: "nowrap"
      }}>🛠 DEBUG</div>
  );
}

export default function App() {
  // ── iOS safe-area handling ────────────────────────────────────
  // Inside a Capacitor iOS WebView, the env(safe-area-inset-top) variable only
  // resolves correctly if index.html has <meta viewport ... viewport-fit=cover>.
  // Belt-and-suspenders: also detect iOS and set a CSS variable --ll-safe-top
  // we read from the header. On the iPhone 17 Dynamic Island we use 59px;
  // on older notched iPhones 47px; otherwise 0.
  useEffect(() => {
    try {
      const ua = navigator.userAgent || "";
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
      const isCapacitor = typeof window !== "undefined" && (window.Capacitor || (window.webkit && window.webkit.messageHandlers));
      // Try env() first; fall back to hardcoded value if it returns 0
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;top:0;left:-9999px;padding-top:env(safe-area-inset-top);";
      document.body.appendChild(probe);
      const envValue = parseFloat(getComputedStyle(probe).paddingTop) || 0;
      document.body.removeChild(probe);
      let safeTop = envValue;
      if (isIOS && envValue < 20) {
        // Heuristic: modern iPhones (12+ with notch, 14 Pro+ with Dynamic Island) all have >=47px inset.
        // If env() returned <20 on iOS, viewport-fit=cover is missing — use a conservative 50px fallback.
        safeTop = 50;
      }
      document.documentElement.style.setProperty("--ll-safe-top", safeTop + "px");
    } catch (e) {
      document.documentElement.style.setProperty("--ll-safe-top", "0px");
    }
  }, []);

  // ── iOS status bar styling (May 15, 2026) ─────────────────────
  // LetterLoot has a dark purple/navy game theme, so the iOS status bar
  // (clock, signal, battery) needs to render in light/white style to stay
  // visible. We also overlay the status bar so our header sits flush at the
  // top — the safe-area inset above already reserves space.
  // The dynamic import means the web build skips this entirely.
  useEffect(() => {
    (async () => {
      try {
        if (typeof window === "undefined" || !window.Capacitor) return;
        if (!window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return;
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Light });   // light icons on dark background
        await StatusBar.setOverlaysWebView({ overlay: true }); // let WebView draw under status bar
        await StatusBar.setBackgroundColor({ color: "#0a0820" }).catch(() => {}); // Android-only, ignore iOS rejection
      } catch (e) {
        // Plugin not installed yet, web platform, or other expected non-iOS case — silent.
      }
    })();
  }, []);

  const [authState, setAuthState] = useState("loading");
  const [user, setUser] = useState(null);
  const [showFarewell, setShowFarewell] = useState(false);
  const [farewellData, setFarewellData] = useState({ totalScore:0, bestWord:"", bestWordScore:0, shareText:"" });
  // v74 (Option A): App-level share menu for the Farewell "Share My Results" flow.
  // Fed by farewellData.shareText (precomputed in GameScreen). Independent of the
  // GameScreen Perfect Day share, which is untouched.
  const [showResultsShareMenu, setShowResultsShareMenu] = useState(false);
  const [resultsShareCopied, setResultsShareCopied] = useState(false);
  const [postFarewellTab, setPostFarewellTab] = useState(null);
  const showFarewellRef = useRef(false);
  useEffect(() => { showFarewellRef.current = showFarewell; }, [showFarewell]);
  useEffect(() => {
    getSession().then(session => {
      if (session) { setUser(session.user); setAuthState("playing"); }
      else {
        // Returning guests no longer auto-route to game.
        // They see the Welcome screen every time, with a pitch to create an account.
        // The "ll_guest_returning" flag tells AuthScreen this isn't a first-timer.
        const wasGuest = localStorage.getItem("ll_guest") === "1";
        if (wasGuest) {
          // Clear active guest session so they have to re-acknowledge "Continue as Guest"
          localStorage.removeItem("ll_guest");
          // NOTE: We intentionally do NOT wipe ll_stats, ll_lifetime, ll_badges_lifetime,
          // or ll_time_leaderboard here. Guest progress is cumulative on this device —
          // lifetime points, stats, and badges persist across guest sessions. The
          // v1.1 backlog includes a feature to migrate guest progress to an account
          // when they sign up.
          // Mark them as "returning guest" so AuthScreen shows the right copy
          localStorage.setItem("ll_guest_returning", "1");
        }
        setAuthState("auth");
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        // v97: Clear any lingering guest flag on sign-in. Without this, a player who
        // was in Guest mode and then signs into an account keeps ll_guest="1", so
        // gameplay saves misattribute their records to "Guest" (the phantom-Guest
        // leaderboard-entry bug). A signed-in session must never be treated as guest.
        localStorage.removeItem("ll_guest");
        // v271 ROOT FIX (Chelsea's foreground clock rewind, Aug 14): iOS fires SIGNED_IN on
        // every foreground TOKEN REFRESH, and setUser(session.user) minted a NEW object for
        // the SAME person — so every effect keyed on [user] (the full launch restore, the
        // saver) re-ran MID-SESSION: clock rewound to the cloud's last snapshot, timer
        // stopped, first-tap gate re-armed (probe-convicted: "CLOUD RESTORE applying timers"
        // on every foreground). Same identity now keeps the SAME object — no state change,
        // no re-fire. A genuinely different account still swaps normally.
        setUser(prev => (prev && session.user && prev.id === session.user.id) ? prev : session.user);
        setAuthState("playing");
      }
      if (event === "SIGNED_OUT") {
        // Don't kick the user to auth if they're viewing a Farewell screen — they're
        // mid-celebration and shouldn't be interrupted by token refresh failures.
        // The session can be re-established next time they need it.
        if (showFarewellRef.current) {
          // Keep showing Farewell. Don't clear user state — it may still be valid
          // for local rendering. The next save attempt will trigger re-auth if needed.
          return;
        }
        setUser(null); setAuthState("auth");
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  const [showCelebrate, setShowCelebrate] = useState(() => window.location.hash === '#celebrate');
  const [showAdmin, setShowAdmin] = useState(() => new URLSearchParams(window.location.search).get('admin') === '1');
  // v306: the URL param only REQUESTS the panel; this decides whether it opens.
  const adminAllowed = DEBUG_MODE || ADMIN_EMAILS.includes(((user && user.email) || "").trim().toLowerCase());
  // Debug menu state — only meaningful when DEBUG_MODE = true
  const [showDebugMenu, setShowDebugMenu] = useState(false);
  const [debugAction, setDebugAction] = useState(null);
  // Local handlers for debug actions that operate at App level (vs GameScreen level)
  const handleDebugAction = (action) => {
    if (action === "go-welcome") {
      // Force back to Welcome/Game screen
      setShowFarewell(false);
      setShowCelebrate(false);
      // GameScreen will read this via debugAction prop and clear its own intro/menu state
      setDebugAction("go-welcome");
      return;
    }
    if (action === "wipe-local") {
      try {
        // Preserve auth + guest flag, wipe game data only
        const keysToWipe = Object.keys(localStorage).filter(k => k.startsWith("ll_") && k !== "ll_guest");
        keysToWipe.forEach(k => localStorage.removeItem(k));
        alert("✓ Wiped " + keysToWipe.length + " localStorage keys. App will reload.");
        setTimeout(() => window.location.reload(), 500);
      } catch (e) { alert("Wipe error: " + e.message); }
      return;
    }
    if (action === "become-guest") {
      // Instantly switch to Guest mode. If currently signed in, sign out first.
      (async () => {
        try {
          if (user) await signOut();
          setUser(null);
          localStorage.setItem("ll_guest", "1");
          setAuthState("playing");
          // Force a reload to ensure clean state — GameScreen needs to re-mount
          // with isGuest=true and the correct initial state.
          setTimeout(() => window.location.reload(), 200);
        } catch (e) { alert("Become Guest error: " + e.message); }
      })();
      return;
    }
    if (action === "sign-out-to-auth") {
      // Full sign-out flow: clears auth, routes to AuthScreen where user can
      // pick Guest / Sign In / Sign Up.
      (async () => {
        try {
          await signOut();
          setUser(null);
          localStorage.removeItem("ll_guest");
          setAuthState("auth");
        } catch (e) { alert("Sign Out error: " + e.message); }
      })();
      return;
    }
    // All other actions are delegated to GameScreen via debugAction prop
    setDebugAction(action);
  };
  const handleGuest = () => { localStorage.setItem("ll_guest","1"); setAuthState("playing"); };
  const handleLogin = async () => { const session = await getSession(); if (session) { localStorage.removeItem("ll_guest"); setUser(session.user); setAuthState("playing"); } };
  const handleSignOut = async () => { await signOut(); localStorage.removeItem("ll_guest"); setAuthState("auth"); };
  // From guest upsell modal in GameScreen: clear guest flag and route to AuthScreen for signup.
  const handleGuestUpsellSignUp = () => {
    localStorage.removeItem("ll_guest");
    setAuthState("auth");
  };
  // Delete Account (Apple App Store guideline 5.1.1(v) requires in-app account deletion).
  // v69: calls the server-side delete_user_account() RPC (SECURITY DEFINER function in
  // Supabase) which deletes the user's daily_sessions, game_state, and players rows AND
  // the auth.users login identity (the auth-user deletion can only be done server-side
  // with elevated rights — the prior client-side code left the auth user behind, so the
  // app still recognized "deleted" accounts). word_reports is intentionally left untouched
  // (community moderation data, no reliable per-user link). Then signs out + wipes local storage.
  const handleDeleteAccount = useCallback(async () => {
    try {
      const session = await getSession();
      if (!session || !session.user) {
        alert("Not signed in. Nothing to delete.");
        return;
      }
      // Server-side full deletion (data rows + auth user) via SECURITY DEFINER RPC.
      const { error: rpcError } = await supabase.rpc("delete_user_account");
      if (rpcError) {
        alert("Deletion failed: " + (rpcError.message || "Unknown error") + "\n\nPlease email hello@letterloot.net for help.");
        return;
      }
      // Sign out and wipe local storage entirely so no remnants persist
      try { await signOut(); } catch {}
      try {
        // v99: corrected to match the keys the app ACTUALLY writes. Previously this list
        // named three phantom keys that are never written (ll_time_leaderboard, ll_daily_state,
        // ll_badges_lifetime) while MISSING four real user-data keys (ll_times, ll_alltime,
        // ll_badges_v2, ll_daily_history) — so a deleted user's time leaderboard, all-time data,
        // badges, and daily history persisted locally on the device (e.g. the "Frankie V." ghost
        // best-time). ll_tour_done is intentionally NOT wiped — the tour is device-level and
        // always available to anyone. ll_photo is also removed elsewhere but kept here for safety.
        // v122: ll_whatsnew_v11_seen is ALSO intentionally NOT wiped — same rationale as
        // ll_tour_done: it's a device-level "seen this update once" flag, not account/progress
        // data. Wiping it would re-show the What's New screen to a deleted-and-returning user
        // even though nothing changed. Keep it out of this list.
        const keysToClear = [
          "ll_guest","ll_guest_returning","ll_stats","ll_lifetime","ll_badges_v2",
          "ll_times","ll_alltime","ll_daily_history","ll_session","ll_completed_today",
          "ll_pd_acknowledged_today","ll_wotd","ll_name","ll_photo","ll_nickname","ll_longest",
          "ll_show_mascots"
        ];
        keysToClear.forEach(k => { try { localStorage.removeItem(k); } catch {} });
        // v254: sessions are per-owner keys (ll_session__<owner>) — sweep them all here.
        // "Wipe local storage entirely so no remnants persist" is this block's contract,
        // and the deleted account's key is unreachable after signOut() (getCurrentOwnerSync
        // would already read "guest"), so a targeted remove can't work — sweep by prefix.
        try { Object.keys(localStorage).filter(k => k.startsWith("ll_session")).forEach(k => localStorage.removeItem(k)); } catch {}
      } catch {}
      setAuthState("auth");
      // Brief delay so the auth screen renders before the alert
      setTimeout(() => alert("Your account has been deleted. We're sorry to see you go!"), 200);
    } catch (e) {
      alert("Deletion failed: " + (e?.message || "Unknown error") + "\n\nPlease email hello@letterloot.net for help.");
    }
  }, []);
  const handleShowFarewell = (data) => { setFarewellData(data); setShowFarewell(true); };

  // v74 (Option A): App-level "Share My Results" menu for the Farewell screen.
  // Uses the precomputed farewellData.shareText. Mirrors GameScreen's reliable
  // Text(sms:)/Email(mailto:)/Copy(Capacitor Clipboard) channels.
  const openResultsShareMenu = () => setShowResultsShareMenu(true);
  const resultsShareViaText = () => {
    const text = farewellData.shareText || "";
    window.location.href = `sms:&body=${encodeURIComponent(text)}`;
    setShowResultsShareMenu(false);
  };
  const resultsShareViaEmail = () => {
    const text = farewellData.shareText || "";
    window.location.href = `mailto:?subject=${encodeURIComponent("My LetterLoot results today")}&body=${encodeURIComponent(text)}`;
    setShowResultsShareMenu(false);
  };
  const resultsShareViaCopy = async () => {
    const text = farewellData.shareText || "";
    try {
      await Clipboard.write({ string: text });
      setResultsShareCopied(true);
      setTimeout(() => setResultsShareCopied(false), 4000);
    } catch (e) {
      try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); setResultsShareCopied(true); setTimeout(() => setResultsShareCopied(false), 4000); } }
      catch (e2) { alert("Copy failed. Please try Text Message or Email instead."); }
    }
    setShowResultsShareMenu(false);
  };
  const renderResultsShareMenu = () => (
    <div style={{position:"fixed",inset:0,zIndex:100000,background:"rgba(0,0,0,0.78)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}} onClick={()=>setShowResultsShareMenu(false)}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:20,padding:`${ipadTour(24)}px ${ipadTour(20)}px`,border:"2px solid rgba(246,211,101,0.5)",fontFamily:"Georgia,serif",color:"#f5f0e8",maxWidth:ipadTour(340),width:"100%",textAlign:"center"}}>
        <div style={{fontSize:ipadTour(20),fontWeight:"bold",color:"#f6d365",marginBottom:ipadTour(6),letterSpacing:1}}>Share Your Results</div>
        <div style={{fontSize:ipadTour(11),color:"rgba(255,255,255,0.65)",marginBottom:ipadTour(20)}}>Choose how to share your day</div>
        <button onClick={resultsShareViaText} style={{width:"100%",padding:`${ipadTour(14)}px ${ipadTour(16)}px`,marginBottom:ipadTour(10),borderRadius:12,background:"linear-gradient(135deg,#34d399,#10b981)",color:"#003322",fontSize:ipadTour(15),fontWeight:"bold",fontFamily:"Georgia,serif",border:"none",cursor:"pointer"}}>💬 Text Message</button>
        <button onClick={resultsShareViaEmail} style={{width:"100%",padding:`${ipadTour(14)}px ${ipadTour(16)}px`,marginBottom:ipadTour(10),borderRadius:12,background:"linear-gradient(135deg,#60a5fa,#3b82f6)",color:"#fff",fontSize:ipadTour(15),fontWeight:"bold",fontFamily:"Georgia,serif",border:"none",cursor:"pointer"}}>✉️ Email</button>
        <button onClick={resultsShareViaCopy} style={{width:"100%",padding:`${ipadTour(14)}px ${ipadTour(16)}px`,marginBottom:ipadTour(14),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(15),fontWeight:"bold",fontFamily:"Georgia,serif",border:"none",cursor:"pointer"}}>{resultsShareCopied?"✓ Copied!":"📋 Copy"}</button>
        <div style={{fontSize:ipadTour(10),color:"rgba(255,255,255,0.45)",marginBottom:ipadTour(14),fontStyle:"italic"}}>Copy works for Twitter, Facebook, Notes, and anywhere else you want to paste.</div>
        <button onClick={()=>setShowResultsShareMenu(false)} style={{width:"100%",padding:`${ipadTour(10)}px ${ipadTour(14)}px`,borderRadius:11,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.85)",fontSize:ipadTour(13),fontFamily:"Georgia,serif",cursor:"pointer"}}>← Cancel</button>
      </div>
    </div>
  );
  // Close just dismisses the screen back to the game's play tab — does NOT sign out.
  // (Previous buggy behavior kicked logged-in users back to the auth screen.)
  const handleFarewellDone = () => { setShowFarewell(false); setPostFarewellTab("play"); };
  const handleFarewellStats = () => { setShowFarewell(false); setPostFarewellTab("stats"); };
  // v59: Guest tapping Leaderboard from Farewell → routes to Guest Upsell, not Leaderboard.
  const handleFarewellLeaderboard = () => {
    setShowFarewell(false);
    if (localStorage.getItem("ll_guest") === "1") {
      setPostFarewellTab("guest-upsell");
    } else {
      setPostFarewellTab("leaderboard");
    }
  };
  // Play Again from Farewell: "now" → fresh game immediately; "later"/"tomorrow" → close
  // and return to game (player navigates back themselves whenever they want)
  const handleFarewellPlayAgain = (choice) => {
    setShowFarewell(false);
    if (choice === "now") {
      // Tell GameScreen to start a fresh game on mount
      setPostFarewellTab("play_now");
    } else {
      setPostFarewellTab("play");
    }
  };
  // ── Debug menu / badge wrapper ──
  // When DEBUG_MODE is true, every screen gets a floating "🛠 DEBUG" badge top-right
  // and the menu screen can be entered/exited.
  if (DEBUG_MODE && showDebugMenu) {
    let mode = "unknown";
    if (showAdmin) mode = "Admin";
    else if (showCelebrate) mode = "Celebrate";
    else if (showFarewell) mode = "Farewell";
    else if (authState === "loading") mode = "Loading";
    else if (authState === "auth") mode = "Auth";
    else mode = "Game";
    return <DebugMenu onClose={()=>setShowDebugMenu(false)} onAction={handleDebugAction} currentMode={mode}/>;
  }

  // Helper to wrap any screen with the floating DEBUG badge
  const withBadge = (screen) => DEBUG_MODE ? (
    <>{screen}<DebugBadge onClick={()=>setShowDebugMenu(true)}/></>
  ) : screen;

  if (showAdmin && adminAllowed) return withBadge(<AdminScreen onExit={()=>setShowAdmin(false)}/>);
  if (showCelebrate) return withBadge(
    <div style={{minHeight:'100vh',background:'#0a0820',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'Georgia,serif',color:'#f5f0e8',padding:'30px 24px',position:'relative',overflow:'hidden'}} onClick={()=>setShowCelebrate(false)}>
      <Starfield/>
      <ConfettiCanvas active={true} rainbow={true}/>
      <div style={{position:'relative',zIndex:1,textAlign:'center',maxWidth:340}}>
        <div style={{marginBottom:16,display:"flex",justifyContent:"center"}}><RainbowPot size={140}/></div>
        <div style={{background:'rgba(139,92,246,0.25)',border:'2.5px solid rgba(167,139,250,0.95)',borderRadius:14,padding:'10px 24px',marginBottom:20,boxShadow:'0 0 28px rgba(139,92,246,0.5)'}}>
          <span style={{fontSize:26,fontWeight:'bold',letterSpacing:4,color:'#fff',textShadow:'0 0 16px rgba(167,139,250,0.85)'}}>LetterLoot</span>
        </div>
        <div style={{fontSize:22,fontWeight:'bold',color:'#f6d365',marginBottom:12}}>🎉 Someone had a 🌈🏆 Perfect Day!</div>
        <div style={{fontSize:14,color:'#f5f0e8',lineHeight:1.8,marginBottom:20}}>A friend just crushed all 5 levels of LetterLoot — and wanted you to know about it!</div>
        <div style={{background:'rgba(255,255,255,0.07)',borderRadius:14,padding:'16px',marginBottom:20,border:'1px solid rgba(255,255,255,0.18)',fontSize:13,color:'rgba(255,255,255,0.7)',lineHeight:1.7}}>
          Daily word puzzle · Every letter has a value · Free to play!
        </div>
        <button onClick={()=>setShowCelebrate(false)} style={{width:'100%',padding:'16px',borderRadius:14,background:'linear-gradient(135deg,#f6d365,#fda085)',color:'#1a1a2e',fontSize:16,fontWeight:'bold',fontFamily:'Georgia,serif',border:'none',cursor:'pointer',boxShadow:'0 0 24px rgba(246,211,101,0.4)'}}>
          Play LetterLoot Free!
        </button>
        <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:14}}>Tap anywhere to dismiss</div>
      </div>
    </div>
  );
  if (showFarewell) return withBadge(<>
    <FarewellScreen {...farewellData} isGuest={!user} onDone={handleFarewellDone} onViewStats={handleFarewellStats} onViewLeaderboard={handleFarewellLeaderboard} onPlayAgain={handleFarewellPlayAgain} onShareResults={farewellData.shareText ? openResultsShareMenu : null}/>
    {showResultsShareMenu && renderResultsShareMenu()}
  </>);
  if (authState === "loading") return withBadge(
    <div style={{ minHeight:"100vh", background:"#0a0820", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Georgia,serif", position:"relative" }}>
      <Starfield/><div style={{textAlign:"center",zIndex:1}}><LetterLootLogo titleFontSize={28} boxPadding="8px 24px"/><div style={{fontSize:12,color:"rgba(255,255,255,0.4)",letterSpacing:2,marginTop:16}}>LOADING…</div></div>
    </div>
  );
  if (authState === "auth") return withBadge(<AuthScreen onGuest={handleGuest} onLogin={handleLogin}/>);
  return withBadge(<GameScreen user={user} onSignOut={handleSignOut} onFarewell={handleShowFarewell} initialTab={postFarewellTab} onTabConsumed={()=>setPostFarewellTab(null)} onSignUpRequest={handleGuestUpsellSignUp} onDeleteAccount={handleDeleteAccount} debugAction={debugAction} onDebugConsumed={()=>setDebugAction(null)}/>);
}

function GameScreen({ user, onSignOut, onFarewell, initialTab, onTabConsumed, onSignUpRequest, onDeleteAccount, debugAction, onDebugConsumed }) {
  const [showGuestUpsell, setShowGuestUpsell] = useState(false);
  // Delete Account two-step confirmation (May 15, 2026).
  // Apple App Store guideline 5.1.1(v) requires in-app account deletion.
  // Modal asks user to type DELETE before confirming.
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const isGuest = !user;
  const [playerName, setPlayerName] = useState("");
  const playerNameRef = useRef("");
  const [editingName, setEditingName] = useState(false);
  const [showTour, setShowTour] = useState(false);
  // v60: removed rejectedWord + reportSent state — modal was dead code (bug #14)
  const [online, setOnline] = useState(navigator.onLine);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const completeTour = () => { localStorage.setItem("ll_tour_done","1"); setShowTour(false); requestNotificationPermission(); };
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const lifetimeData = useRef(getLifetimeData());
  const [lifetimePoints, setLifetimePoints] = useState(lifetimeData.current.total || 0);
  const [showDecayWarning, setShowDecayWarning] = useState(false); // modal removed
  const decayInfo = lifetimeData.current;

  const ss = useRef(loadLocalSession()).current;
  // v225: DATE-ROLLOVER GUARD. `ss` above is a useRef — it evaluates loadLocalSession() ONCE at
  // mount and never again. loadLocalSession() DOES date-check correctly
  // (`if (data.savedDate !== getTodayKey()) return null`), but on iOS/Android the app is usually
  // SUSPENDED, not killed: leave a game open overnight, resume in the morning, and the component
  // never remounts — so the date check never re-runs and yesterday's board is still on screen with
  // no way to start today's game (Daryl, July 16, stranded on yesterday's L2). A cold launch was
  // always fine; a resume was not.
  // We capture the mount day here and compare on every resume. See the visibilitychange effect.
  const mountedDayRef = useRef(getTodayKey());
  // v228 INSTRUMENTATION (TEMPORARY): board geometry probe. DEBUG_MODE only.
  // The ref is declared here; the HOOK CALL lives further down, AFTER `level` is declared.
  // v227 BUG (fixed here): the hook was called at this line and passed `level` — but `level` is a
  // `const [level] = useState(...)` declared ~143 lines BELOW. const/let are hoisted but NOT
  // initialized, so touching one before its declaration throws
  //   ReferenceError: Cannot access 'level' before initialization
  // at RENDER time, on every screen, before anything paints → white screen on all devices.
  // Babel parsed it clean because a TDZ violation is a RUNTIME error, not a syntax error.
  const boardMeasureRef = useRef(null);
  const [dayRolledOver, setDayRolledOver] = useState(false);
  // ── Word of the Day: precompute from all 5 levels' potential tiles ──
  // ── Word of the Day: load from cache synchronously, compute lazily in background ──
  const wotdData = useRef(getCachedWordOfTheDay() || null);
  const [wotd, setWotd] = useState(wotdData.current?.word || null);
  const [wotdFound, setWotdFound] = useState(wotdData.current?.found || false);
  // v76 (item 15): mirror wotdFound into a ref so the async L5-completion handler reads
  // the CURRENT value (not a stale closure) when deciding Perfect Day eligibility.
  const wotdFoundRef = useRef(wotdData.current?.found || false);
  useEffect(() => { wotdFoundRef.current = wotdFound; }, [wotdFound]);
  const [showWotdReminder, setShowWotdReminder] = useState(false);
  const [wotdCelebration, setWotdCelebration] = useState(false);
  const [lootCelebration, setLootCelebration] = useState(null); // {word, score, letter}
  // v113 (debug): preview state for the Great Word popup. Great Word's TRIGGER logic
  // isn't wired until v113, but its RENDER block is built now (below) so the debug
  // menu can preview the real presentation. Holds {line, score} or null.
  const [greatWordPreview, setGreatWordPreview] = useState(null);
  // v186 (Finisher scoring): the REAL finisher bonus earned on the current board clear
  // (0 if the clearing word was <5 letters). Displayed as its own line on the Level-Complete
  // card only when > 0 (Option C). Reset per level.
  const [finisherBonusEarned, setFinisherBonusEarned] = useState(0);
  // v187 (Finisher step 3a): controls the FinisherOverlay celebration (chest + count-up).
  // { len, bonus } while showing, null when hidden. Debug buttons set it; it self-dismisses.
  const [finisherOverlay, setFinisherOverlay] = useState(null);
  // v198 (Finisher step 4): when a REAL board clear earns a finisher, the FinisherOverlay plays
  // FIRST and the whole visible Level-Clear sequence (flash, confetti, badges, best-time,
  // level-advance / endgame) is deferred until the player dismisses the overlay. This ref holds
  // that deferred sequence closure; the overlay's dismiss (button or 10s auto) invokes it once.
  // Sub-5 clears (no finisher) never touch this — they run the sequence inline as before.
  const pendingBoardClearRef = useRef(null);
  // v301 (Item 1-B): handle for the 600ms repeat-Perfect-Day modal timer so a full reset can cancel it.
  const repeatPdTimerRef = useRef(null);
  // (v106) Loot Letter announcement: a brief, self-dismissing INFORMATIONAL popup
  // ("💥 Loot Letter · Level N · X") shown at each level open. NOT a celebration —
  // ungated by showMascotCelebrations(). Auto-clears after 2s; no button. The
  // persistent reminder lives in the Tap-tiles strip badge.
  const [lootAnnounceLevel, setLootAnnounceLevel] = useState(null); // level number or null
  const lootAnnounceTimerRef = useRef(null);
  // v128→v129: Level-start "Welcome" moment. levelAnnounceNum holds the level number (or null when
  // hidden). In v129 this drives the full-screen TREASURE MAP Level Welcome page (map bg + "Level X /
  // Good Luck! / Timer starts on first tap" text + accumulating coin piles at trail waypoints). The
  // page dwells 10s auto OR the player taps the "Course is Set. Let's Sail!" button to dismiss early;
  // EITHER path calls dismissLevelWelcome(), which then fires the Loot + WoD sequence and reveals the
  // board. levelSeqTimerRef holds the 10s auto-dismiss timeout (cleared on manual dismiss / rapid
  // level change so a stale timer can't fire). NOT gated by the mascot celebration toggle — always shows.
  const [levelAnnounceNum, setLevelAnnounceNum] = useState(null);
  // v138: gate the Level Welcome overlay so it only reveals once the map <img> has decoded —
  // prevents a one-frame glimpse of the tile board through the overlay before the map paints.
  const [mapReady, setMapReady] = useState(false);
  const levelSeqTimerRef = useRef(null);
  // v133: Preload the Trail-of-Loot art ONCE on mount so the browser has the map + coin decoded and
  // cached before the Welcome page first renders. Fixes the one-frame "flash of map before it renders"
  // (CSS background-image was being fetched/decoded at mount time, so the scrim+text showed first).
  useEffect(() => {
    ["/level-map-bg.jpg", "/trail-coin.png"].forEach((src) => { const im = new Image(); im.src = src; });
  }, []);
  // v108: A-hybrid rotating Level Clear line — running session counter. Starts at
  // -1; the render advances it once per clear (first clear of session uses the
  // deterministic daily line, subsequent clears advance). Resets on app launch.
  const clearSayingIdxRef = useRef(-1);
  // Captured line to display for the current clear (set when the clear fires so
  // the counter doesn't advance on unrelated re-renders).
  const [clearSayingText, setClearSayingText] = useState("");
  // v162 (v1.2 #2): gates the Level-Clear mascot so it only pops in AFTER the entire
  // badge queue has had its solo moment. Set false when a level completes; flipped true
  // either immediately (no badges pending) or by processBadgeQueue's drain branch.
  const [mascotReady, setMascotReady] = useState(false);
  // v116 (#16): LIVE Great Word celebration — separate from greatWordPreview (debug
  // only) so debug triggers never touch live rotation state or the per-level guard.
  // Holds { line } (already score-interpolated) or null.
  const [greatWordCelebration, setGreatWordCelebration] = useState(null);
  // A-hybrid running session counter for Great Word lines — same pattern as
  // clearSayingIdxRef. Starts at -1; advances once per genuine fire; resets on launch.
  const greatWordIdxRef = useRef(-1);
  // Per-level fire guard: holds the level number Great Word last fired (or was
  // loot-suppressed) on, so it fires at most once per level. 0 = not yet fired this
  // level. Reset to 0 on next-level / replay / fresh-game (see reset sites).
  const greatWordFiredRef = useRef(0);
  // ── v164 (v1.2 #6): CELEBRATION QUEUE ────────────────────────────────────────
  // The three full-screen celebration overlays (WoD / Loot / Great Word) all render
  // UNDER the green word/points flash (flash zIndex 9997; overlays 9700-class), so a
  // celebration firing in the same submit tick as the flash got the banner stamped
  // across the mascot's chest. They also could co-fire with each other (a loot word
  // that is ALSO the Word of the Day hits both blocks) and stack.
  //
  // Fix, same shape as badgeQueueRef: handleSubmit ENQUEUES a descriptor instead of
  // setting overlay state directly. drainCelebrationQueue() runs them strictly serially,
  // and it is the ONLY thing that touches the timer for celebrations. showFlash's dismiss
  // timer kicks the drain, so the chain is: flash (2s) → celebration(s) → badges.
  //
  // Descriptor: { kind: "wotd" | "loot" | "greatWord", payload, dwellMs }
  const celebrationQueueRef = useRef([]);
  const celebrationActiveRef = useRef(false);
  const celebrationTimerRef = useRef(null);
  // ── v119: V/C-ratio danger pulse ──────────────────────────────────────────────
  // vcPulse drives the CSS pulse on BOTH the Vowels and Consonants boxes: null = at
  // rest (the plain v118 glow), or "starve"/"over" while a 5s pulse is running.
  // The rule name doesn't change which boxes pulse (both alternate for both rules,
  // per spec — the signal is "the ratio is in a danger zone", not which side is short);
  // it's tracked only so the effect can restart the animation cleanly on a rule change.
  const [vcPulse, setVcPulse] = useState(null);
  // v120: a monotonically increasing nonce, bumped on every fire. Used as a React
  // `key` on the pulsing boxes so a fresh fire REMOUNTS them — the most reliable way
  // to (re)start a CSS animation from React, sidestepping the v119/v120 fragility
  // where toggling the `animation` style via state didn't reliably (re)trigger it.
  const [vcPulseNonce, setVcPulseNonce] = useState(0);
  // Prior danger state, for FRESH-CROSSING detection on submit: re-fire only when the
  // ratio was SAFE (null) before a word and is dangerous after — NOT on every submit
  // while it stays dangerous (that's the nagging version, rejected). Board-open uses
  // its own check and seeds this. null = last-known-safe.
  const vcDangerPrevRef = useRef(null);
  const vcPulseTimerRef = useRef(null);
  // v121: timestamp of the last danger-effect evaluation, for the churn debounce
  // (rapid successive board changes from debug Jump-to-Ln shouldn't fire).
  const vcLastEvalRef = useRef(0);
  const [wotdFoundDetails, setWotdFoundDetails] = useState(() => {
    try {
      const cached = getCachedWordOfTheDay();
      return cached?.foundLevel ? { level: cached.foundLevel, score: cached.foundScore, bonus: cached.foundBonus || 1000 } : null;
    } catch { return null; }
  });
  // If no cached WoD, compute it in background after mount so it doesn't block the UI
  useEffect(() => {
    if (wotdData.current) return; // already cached
    const t = setTimeout(() => {
      try {
        const allLevelTiles = [];
        for (let lv = 1; lv <= 5; lv++) {
          const rng = lv === 1 ? seededRandom(getDailySeed()) : seededRandom(getDailySeed() + lv * 999);
          const tcount = 42 + (lv - 1) * 7;
          const bp = getBonusPositions(tcount, getBonusCount(lv), rng);
          const tiles = generateLevelTiles(lv, 0, rng, bp);
          allLevelTiles.push(tiles.map(t => t.letter));
        }
        const word = selectWordOfTheDay(allLevelTiles);
        if (word) {
          saveCachedWordOfTheDay(word);
          wotdData.current = { date: getTodayKey(), word, found: false };
          setWotd(word);
        }
      } catch(e) { console.warn("WoD computation failed:", e); }
    }, 100); // delay 100ms so initial render completes first
    return () => clearTimeout(t);
  }, []);
  const [level, setLevel] = useState(() => {
    const lv = ss?.level || 1;
    // Hard cap: never load beyond level 5 unless bonus levels enabled
    if (!ENABLE_BONUS_LEVELS && lv > 5) return 5;
    return lv;
  });
  const [levelScore, setLevelScore] = useState(ss?.levelScore || 0);
  const [tiles, setTiles] = useState(() => {
    if (ss?.tiles) return ss.tiles;
    const rng = seededRandom(getDailySeed());
    const bp = getBonusPositions(42, getBonusCount(1), rng);
    return generateLevelTiles(1, 0, rng, bp);
  });
  const tileCountRef = useRef(ss?.tileCount || 42);
  // v228: board geometry probe — called HERE, safely after `level` (above) is initialized.
  // Hook order is still unconditional (no early returns between GameScreen's start and this line),
  // so the Rules of Hooks are satisfied.
  const boardMetrics = useBoardMetrics(boardMeasureRef, level, DEBUG_MODE);
  const levelResetCount = useRef(0);
  // #18b: per-level clean-clear flag for the Cloud Time Leaderboard. True while the
  // CURRENT level has had no reset/re-do/buy (UNDO is OK — PD-safe, so time-safe too).
  // Reset to true at each new level; set false in doLevelReset. Gates the cloud level
  // time write so a fumbled L1 doesn't disqualify a clean L2–L5 the same day.
  const levelCleanRef = useRef(true);
  const [selected, setSelected] = useState([]);
  const [submitted, setSubmitted] = useState(ss?.submitted || []);
  const [totalScore, setTotalScore] = useState(ss?.totalScore || 0);
  const [badgeStore, setBadgeStore] = useState(() => getBadgeStore());
  const badges = badgeStore.lifetime;
  const [streak, setStreak] = useState(ss?.streak || 0);
  const [validating, setValidating] = useState(false);
  const [checkingStuck, setCheckingStuck] = useState(false);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(null);
  // v163 (v1.2 #5): the green word/points flash (top:40%, zIndex 9997) and the badge
  // banner (top:72, zIndex 9998) used to fire in the SAME tick on a badge-earning
  // submission, so the flash sat over the badge. flashActiveRef gates processBadgeQueue:
  // while a flash is up, badges stay queued; the flash's own dismiss drains the queue.
  // Decision A (July 9): ALL flashes gate — including "BOARD CLEAR!" — for one uniform rule.
  const flashActiveRef = useRef(false);
  const flashTimerRef = useRef(null);
  const [showBadge, setShowBadge] = useState(null);
  const [showBadgeExtra, setShowBadgeExtra] = useState("");
  const badgeQueueRef = useRef([]);
  const badgePopupActiveRef = useRef(false);
  // BUG FIX (May 2026): Track which badges have popped THIS GAME SESSION.
  // Allows lifetime-scope achievement badges (rocket, long_10, perfect_day, etc.)
  // to celebrate every game they're earned in, while still deduping within a
  // single game (so 3 rocket-tier words in one game = 1 popup, not 3).
  // Reset on handleFullReset for a fresh celebration next game.
  const sessionBadgesShownRef = useRef(new Set());
  const [tab, setTab] = useState(initialTab || "play");
  const [confetti, setConfetti] = useState(false);
  const [rainbowConfetti, setRainbowConfetti] = useState(false);
  // v246 Bug-B FIX: don't seed levelComplete=true from a FINISHED local session. ss.levelComplete
  // is true both for a legit mid-game between-levels resume AND for a dead finished L5 board. For
  // the latter we're deliberately showing the intro (replayable) and must NOT carry the completed
  // flag into the fresh start, or it re-triggers the completed-state UI. A finished game =
  // (levelComplete on L5) or perfectDay; in that case seed false. Mid-game (L1-4) resume unaffected.
  // v266 ROOT FIX (the historic resurrection taproot): ss.perfectDay is the ELIGIBILITY
  // flag — TRUE throughout every clean run — not "PD earned." Treating it as "finished"
  // zeroed levelComplete on every clean-run resume, so a level finished below L5 came back
  // as a dead live-looking board (limbo). Historically masked by the cloud restore's
  // clean-sweep inference winning ties; v257's stricter tie-breaker (correctly) unmasked it.
  // Finished means the dead L5 board, full stop.
  const ssLocalFinished = ss && (ss.levelComplete === true && (ss.level || 1) >= 5);
  const [levelComplete, setLevelComplete] = useState(() => {
    if (ssLocalFinished) return false;
    if (ss?.levelComplete === true) return true;
    // v266 local clean-sweep inference (mirror of v254 Fix B, same Jul-25 rule: completion
    // on every level ⟺ clean sweep): a sub-L5 session with every tile used IS a completed
    // level, even if levelComplete was saved false — self-heals sessions written during
    // the limbo window.
    const t = ss?.tiles || [];
    if ((ss?.level || 1) < 5 && t.length > 0 && t.every(x => x && x.used)) return true;
    return false;
  });
  // (v104) Mascot Celebrations toggle. ONE runtime preference, persisted in ll_show_mascots
  // (defaults ON). EVERY mascot moment (Level Clear now; WoD/Great Word/Pirate Hint/Streak Bonus
  // later — item #16) routes through the showMascotCelebrations() gate below, so there is exactly
  // one place to reason about on/off. NOT an age-gate — cosmetic preference only. The key is added
  // to keysToClear in handleDeleteAccount (the #2d wipe-list guard).
  const [showMascotsPref, setShowMascotsPref] = useState(() => {
    try { return localStorage.getItem("ll_show_mascots") !== "0"; } catch { return true; }
  });
  const showMascotCelebrations = () => showMascotsPref;
  const setMascotsPref = (on) => {
    setShowMascotsPref(on);
    try { localStorage.setItem("ll_show_mascots", on ? "1" : "0"); } catch {}
  };
  // TIMER FREEZE (v67): between levels, the clock must stay frozen until the
  // player's first tap of the new level. awaitingFirstTap gates the fair-timer
  // effect so it won't auto-start the timer on level entry.
  const [awaitingFirstTap, setAwaitingFirstTap] = useState(false);
  const awaitingFirstTapRef = useRef(false);
  useEffect(() => { awaitingFirstTapRef.current = awaitingFirstTap; }, [awaitingFirstTap]);
  // v71: mirror levelComplete into a ref so async handlers (celebration dismiss
  // setTimeouts) can read the CURRENT value instead of a stale closure value.
  const levelCompleteRef = useRef(false);
  useEffect(() => { levelCompleteRef.current = levelComplete; }, [levelComplete]);
  // v162 (v1.2 #2): when a level completes, decide when the mascot may pop in.
  // v167 (v1.2 #10): ALSO wait on the celebration queue. v164 wired celebrations →
  // badges, but nothing wired celebrations → mascot, so a level cleared with a LOOT word
  // or the WORD OF THE DAY and NO badge earned released the mascot after 450ms while the
  // loot/WoD overlay was still queued behind the flash — the mascot rendered underneath
  // the `inset:0` overlay. (Daryl's July 9 debug screenshots surfaced this; the debug
  // panel bypasses the queue by design, but the live zero-badge path had the same hole.)
  //
  // Full chain, every link releasing the next: flash → celebration(s) → badge(s) → mascot.
  // If ANYTHING is pending, HOLD. The last drain in the chain flips mascotReady:
  //   - badges pending  → processBadgeQueue's empty branch releases it
  //   - only celebrations pending → drainCelebrationQueue's empty branch releases it
  //   - nothing pending → the 450ms beat below releases it
  useEffect(() => {
    if (!levelComplete) { setMascotReady(false); return; }
    const badgesPending = badgeQueueRef.current.length > 0 || badgePopupActiveRef.current;
    const celebrationsPending = celebrationQueueRef.current.length > 0 || celebrationActiveRef.current;
    if (!badgesPending && !celebrationsPending) {
      const t = setTimeout(() => setMascotReady(true), 450);
      return () => clearTimeout(t);
    }
    // else: the celebration and/or badge drain will release the mascot when it empties
  }, [levelComplete]);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // (v103) showNewGameConfirm state removed — the mid-play Start New Game button and its confirm modal were deleted.
  const [showStuckModal, setShowStuckModal] = useState(false);
  // v83 (item 18): confirm dialog for the always-available "End Game & Share Results"
  // button at the base of the tile board — lets a player end their day and share their
  // results anytime, without needing the game to detect they're "stuck".
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  // v257 #7 fix (piece 1): the paused flag persists in the local session — a game paused at
  // close relaunches PAUSED with the clock frozen, killing the Aug3a sub-defect (b) silent
  // time bleed (paused game returning RUNNING). Cloud rows carry no paused column; this is
  // deliberately local-only per the #7 spec.
  const [paused, setPaused] = useState(ss?.paused === true);
  const pausedRef = useRef(ss?.paused === true);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  const [musicOn, setMusicOn] = useState(false);
  const [statsData, setStatsData] = useState(() => getLocalStats());
  const [timeLeaderboard, setTimeLeaderboard] = useState(() => getLocalTimeLeaderboard());
  const [showNameInput, setShowNameInput] = useState(false);
  const [perfectDay, setPerfectDay] = useState(ss?.perfectDay ?? true);
  const perfectDayRef = useRef(ss?.perfectDay ?? true);
  // v249 DOUBLE-PAY FIX: "has THIS ACCOUNT already banked a Perfect Day today?" A PD is a
  // once-per-day, per-ACCOUNT achievement — not per-device. Daryl's rule: if you're signed in,
  // the day's PD follows the account to any device. v248 guarded on local stats alone
  // (lastPerfectDate === today), which fails across devices: a PD earned on the phone leaves the
  // iPad's local stats unaware, so the guard passed and the bonus paid a SECOND time (observed:
  // +15,000 and streak 13→14 on a same-day iPad PD after a phone PD). Seeded here from local
  // stats, then OR'd with the cloud session at init (see setPdBankedFromCloud below) so the
  // account-level truth wins regardless of which device is playing.
  const pdAlreadyBankedTodayRef = useRef((() => {
    try {
      const s = getLocalStats();
      const t = getTodayKey();
      return s.lastPerfectDate === t || ((s.perfectDaysWeek || {})[t] || 0) > 0;
    } catch { return false; }
  })());
  // v256 #8 FIX (Layer C refs): cloudRowCompletedTodayRef = today's cloud row is already a
  // finished game (derived in init from completed/finished/swept signals). playerActedRef =
  // the player actually played THIS session (first word submit or explicit new-game start).
  // Together they let syncToCloud refuse to clobber a settled day with an unplayed board.
  const cloudRowCompletedTodayRef = useRef(false);
  const playerActedRef = useRef(false);
  const setPerfectDaySync = useCallback((val) => { perfectDayRef.current = val; setPerfectDay(val); }, []);
  // Stale Perfect Day on launch fix (May 15, 2026):
  // Once the player has dismissed the Perfect Day modal today, set a localStorage flag.
  // The auto-show useEffect below checks this so the modal doesn't re-pop on re-launch
  // after the player closed it earlier in the day.
  const markPDAcknowledged = useCallback(() => {
    try { localStorage.setItem("ll_pd_acknowledged_today", getTodayKey()); } catch {}
    // v64 (May 26): Removed automatic Guest streak upsell trigger. Previously
    // Now/Later/Tomorrow would auto-fire showGuestStreakUpsell after 400ms,
    // creating a confusing flow where every PD button led to upsell.
    // Per Daryl's design: PD modal buttons should route directly to their
    // intended destinations. Welcome screen has the upsell baked in for Guests.
  }, []);
  const [showRepeatPerfect, setShowRepeatPerfect] = useState(false);
  // v302 (option C): Today's Summary card — the closing beat of the L5 endgame. Shown after the
  // Perfect Day modal (or straight after a non-PD finish). afterSummaryRef carries the choice the
  // player already made on the PD modal (now / later) or 'farewell', for Continue to carry out.
  const [showDaySummary, setShowDaySummary] = useState(false);
  const afterSummaryRef = useRef("farewell");
  const openDaySummary = useCallback((next) => { afterSummaryRef.current = next || "farewell"; setShowDaySummary(true); }, []);
  // v302: My Flourishes (STATS) — this player's cloud ff_words rows; null = not fetched yet.
  const [myFFCloud, setMyFFCloud] = useState(null);
  const [longestWordToday, setLongestWordToday] = useState(ss?.longestWordToday || "");
  // v259 #10a FIX: longest-word bookkeeping must complete IN THE SAME INSTANT as the submit.
  // The Finishing Flourish word ends the game, and the game-completion cloud sync fires in
  // that same handler tick — before React commits setLongestWordToday — so the row shipped
  // with a STALE longest (Aug 8 proof: top_word = 28-letter ANTIDISESTABLISHMENTARIANISM,
  // longest_word_today = 22-letter prior word; no later save ever corrects a finished game).
  // The ref is the source of truth for every save payload; state remains for rendering.
  const longestWordTodayRef = useRef(ss?.longestWordToday || "");
  const [longestWordAllTime, setLongestWordAllTime] = useState(localStorage.getItem("ll_longest") || "");
  const [perfectDayAchieved, setPerfectDayAchieved] = useState(false);
  // v91: full-screen two-pirate (male + female) jig celebration that plays BEFORE the Perfect
  // Day stats modal. Triggered the first time perfectDayAchieved flips true (see effect below).
  // v219: art corrected — was pointed at a pirate+leprechaun composite that predated the
  // intended pair; now /pirates-m-f-celebration.png. Width knob = PD_PIRATE_W.
  const [showPirateDance, setShowPirateDance] = useState(false);
  const pirateDancePlayedRef = useRef(false);
  // v91: when a Perfect Day is achieved (first time this session), play the pirate dance
  // celebration overlay, then auto-dismiss it (~5.2s) leaving the stats modal underneath.
  // v219: now GATED behind showMascotCelebrations() — this overlay is a mascot celebration and
  // must obey the player's "Show Mascot Celebrations" toggle (it never did; that was the bug).
  // Gating the EFFECT (not just the render) matters: if it merely hid the visual, the
  // once-per-session ref would still burn and the PD stats modal timing would be unchanged.
  // With mascots OFF the dance never arms, and the PD stats modal shows immediately — which is
  // exactly what the toggle promises. The Finishing Flourish overlay is deliberately NOT gated
  // (it follows the WoD pattern); the PD dance is a mascot, so it IS.
  useEffect(() => {
    if (perfectDayAchieved && !pirateDancePlayedRef.current && showMascotCelebrations()) {
      pirateDancePlayedRef.current = true;
      setShowPirateDance(true);
      const t = setTimeout(() => setShowPirateDance(false), 5200);
      return () => clearTimeout(t);
    }
    if (!perfectDayAchieved) pirateDancePlayedRef.current = false;
  }, [perfectDayAchieved]);
  // v76 (item 15): near-miss — completed all 5 levels cleanly (PD-eligible) but didn't
  // find the Word of the Day, so no Perfect Day. Shows an encouraging explanatory modal.
  const [showWotdMissedPD, setShowWotdMissedPD] = useState(false);
  const [levelTime, setLevelTime] = useState(ss?.levelTime || 0);
  const [totalTime, setTotalTime] = useState(ss?.totalTime || 0);
  const [selectedLevelView, setSelectedLevelView] = useState(1);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [newRecord, setNewRecord] = useState(null);
  const [pulseScore, setPulseScore] = useState(false);
  const [pulseTime, setPulseTime] = useState(false);
  const [newBestTime, setNewBestTime] = useState(ss?.newBestTime || false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  // v72: which text-builder the share menu should use — "perfect" (Perfect Day) or
  // "results" (non-Perfect-Day day's results). Set when opening the menu.
  const [shareMode, setShareMode] = useState("perfect");
  const [shareLLCopied, setShareLLCopied] = useState(false);
  const [showIntro, setShowIntro] = useState(() => {
    try {
      // v254: read via loadLocalSession() — it resolves the PER-OWNER key (with legacy
      // fallback), date-checks, and owner-scopes at the source. A foreign identity's
      // session comes back null here, so the explicit owner check below is now
      // belt-and-suspenders rather than the primary wall.
      const sess = loadLocalSession();
      const d = new Date();
      const todayKey = d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();
      // Stale Perfect Day on launch fix (May 15, 2026):
      // If the player completed and acknowledged a Perfect Day today, show Welcome screen
      // on re-launch (not the stale completed-game state that triggered the modal). They
      // can decide from Welcome whether to play another round or just check stats.
      // v263 #4 FIX (Test-1 failure, Aug 11): a LIVE same-day session outranks the
      // pd-acknowledged rule below — otherwise every relaunch after a banked PD routes
      // Welcome \u2192 PLAY NOW \u2192 Ready \u2192 (L1 map) OVER a live replay, and the Welcome Back
      // screen never gets its moment. Ruling (a): Welcome Back REPLACES the Welcome
      // screen for these resumes, so a live owned session seeds showIntro FALSE and the
      // Welcome Back overlay fronts the restored board instead.
      const ownerNow = getCurrentOwnerSync();
      // v264: perfectDay here is ELIGIBILITY (true during any clean run), not "earned" —
      // only the dead L5 board marks a session finished. (Same conflation as the
      // welcomeBack initializer; both fixed together.)
      const liveOwned = sess && (sess.owner || "guest") === ownerNow && sess.savedDate === todayKey &&
        !(sess.levelComplete === true && (sess.level || 1) >= 5) &&
        ((sess.submitted && sess.submitted.length > 0) || (sess.totalScore || 0) > 0 || (sess.level || 1) > 1 || sess.levelComplete === true);
      if (liveOwned) return false;
      const pdAcknowledged = localStorage.getItem("ll_pd_acknowledged_today") === todayKey;
      if (pdAcknowledged) return true;
      // v246 Bug-B FIX (local second source): a FINISHED game is NOT an "active game to
      // resume". The check below treated any level>1 local session as resumable, so a completed
      // L5 board (level 5) skipped the intro and dropped the player onto the dead board — the
      // second source behind the resurrection (the cloud-restore guard alone wasn't enough).
      // A finished local session (levelComplete on L5, or perfectDay) should show the intro/
      // Welcome screen instead, exactly like pdAcknowledged above — replayable, per Daryl's
      // locked decision. Fields (levelComplete, perfectDay) are what saveLocalSession writes.
      const localFinished = sess && sess.savedDate === todayKey &&
        ((sess.levelComplete === true && (sess.level || 1) >= 5) || sess.perfectDay === true);
      if (localFinished) return true;
      // v253 account-scoping (remaining-work item 4): a session belongs to the account
      // (owner === user.id) or to "guest". If the CURRENT identity doesn't match the saved
      // owner, this is not our game to resume — show intro / fresh game. Sessions saved
      // before v253 have no owner field; treat missing owner as "guest" so pre-upgrade
      // guest sessions still resume (accounts had cloud restore anyway).
      const currentOwner = getCurrentOwnerSync();
      const sessOwner = sess ? (sess.owner || "guest") : "guest";
      if (sess && sessOwner !== currentOwner) return true; // not ours → intro
      // v253 Fix 1: a level completed BELOW L5 (finished a level, queued for the next,
      // quit) must resume to its Level-Complete modal — the "Play Level N+1" screen —
      // NOT the dead board. levelComplete===true with level<5 is exactly that state.
      // The modal (render ~7000) shows whenever levelComplete is true; seeding showIntro
      // false lets it surface. Timer needs no special handling: restored totalTime shows,
      // and the existing first-tap-starts-clock logic runs when they open Level N+1.
      const localSubL5Complete = sess && sess.savedDate === todayKey &&
        sess.levelComplete === true && (sess.level || 1) < 5;
      if (localSubL5Complete) return false; // resume straight to the complete modal
      // Restore if: same day AND (has submitted words OR is on level > 1)
      const hasActiveGame = sess && sess.savedDate === todayKey && (
        (sess.submitted && sess.submitted.length > 0) || (sess.level && sess.level > 1)
      );
      return !hasActiveGame;
    } catch { return true; }
  });
  // ═══════════════════════════════════════════════════════════════
  // v262 #4 — WELCOME-BACK RESUME FLOW (Daryl's three rulings, Aug 11):
  //  (a) same-day resume shows a dedicated Welcome Back screen (replaces the plain drop
  //      onto the board / the old Welcome for these paths);
  //  (b) a level-completed-below-L5 resume gets finish-line copy, then the existing
  //      Level-Complete modal flow untouched beneath;
  //  (c) resumes NEVER re-show the Loot Letter card (it lives in the submit line) —
  //      see resumeSkipLootRef in dismissLevelWelcome.
  // Routing rule: "initiated" = at least one word submitted ON the current level (or
  // level score already banked). Initiated → straight back to the live board. Not
  // initiated → the Level-N map/Good-Luck page (minus Loot card), then the board.
  // ═══════════════════════════════════════════════════════════════
  const [welcomeBack, setWelcomeBack] = useState(() => {
    try {
      if (!ss) return null;
      const d = new Date();
      const tk = d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();
      if (ss.savedDate !== tk) return null;
      const lvl = ss.level || 1;
      // v264 FIX: session.perfectDay is the ELIGIBILITY flag — TRUE throughout every clean
      // run — not "PD earned." Reading it as "finished" classified every healthy live game
      // as a finished day and stood the Welcome Back card down (Test-1b failure, Aug 11).
      // A finished day is the dead board alone: L5 complete.
      const finished = (ss.levelComplete === true && lvl >= 5);
      if (finished) return null; // finished days keep the replayable Welcome (locked decision)
      const played = (ss.submitted && ss.submitted.length > 0) || (ss.totalScore || 0) > 0 || lvl > 1 || ss.levelComplete === true;
      if (!played) return null; // pristine session — no ceremony needed
      const swept = (() => { const t = ss.tiles || []; return t.length > 0 && t.every(x => x && x.used); })();
      if ((ss.levelComplete === true || swept) && lvl < 5) return { level: lvl, variant: "finish" }; // v266: sweep inference — matches the levelComplete seed
      const initiated = (ss.submitted || []).some(s => s && s.level === lvl) || (ss.levelScore || 0) > 0;
      return { level: lvl, variant: initiated ? "return" : "chart" };
    } catch { return null; }
  });
  const resumeSkipLootRef = useRef(false);
  // v275: set the moment the player declares resume intent (Resume tap or WB "Return to
  // Level N"). The ASYNC launch restore finishes its network fetches seconds after mount
  // and then arms the first-tap gate + stops the clock — which RACED a fast intent tap and
  // froze the clock over a running timer (Daryl's static-00:17 find, Aug 19). The init's
  // arming site now yields to declared intent; consumed one-shot.
  const resumeIntentRef = useRef(false);
  const CONGRATS_MSGS = [
    "Pure perfection. Every tile, every level, every word. You made it look easy.",
    "Five levels. Zero shortcuts. Today, your brain was unstoppable.",
    "A Perfect Day! Go ahead and brag — you’ve earned it.",
    "Not all heroes wear capes. Some just spell really, really well.",
    "Five for five. Clean sweep. The tiles never stood a chance.",
    "Your vocabulary just wrote a love letter to the dictionary — and it wrote back.",
    "Somewhere, a Scrabble champion just felt a chill and doesn’t know why.",
    "You didn’t just play LetterLoot today. You played it perfectly.",
    "Word on the street is you’re kind of a big deal. Today proved it.",
    "Five levels down, not a single buyout or retry. That’s not luck — that’s mastery."
  ];
  const [congratsMsg] = useState(() => CONGRATS_MSGS[Math.floor(Math.random() * CONGRATS_MSGS.length)]);
  // v250: message shown on a SAME-DAY REPEAT Perfect Day. Acknowledges the achievement (per
  // Daryl's decision) while the modal itself awards NO streak bonus (bonus block is gated on
  // perfectDayStreakBonus > 0, which stays 0 on a repeat). Level/all-tiles/Finishing-Flourish
  // points still accrue normally during the game — only the once-per-day streak bonus is withheld.
  const repeatPdMsg = "Another flawless voyage, Cap'n! Today's Perfect Day streak treasure be already in yer hold — but keep plunderin'!";
  const [playAgainChoice, setPlayAgainChoice] = useState(null);
  const [perfectDayStreakBonus, setPerfectDayStreakBonus] = useState(0);
  const [showStreakBonus, setShowStreakBonus] = useState(false);
  // v57: New popup shown to Guests after PD modal — Guests don't accumulate
  // streak bonuses, so we tell them what they're missing and offer a sign-up.
  const [showGuestStreakUpsell, setShowGuestStreakUpsell] = useState(false);
  const [streakBonusCount, setStreakBonusCount] = useState(1);
  const [confirmResetStats, setConfirmResetStats] = useState(false);
  const [showReadyScreen, setShowReadyScreen] = useState(false);
  // v122: one-time "What's New in v1.1" screen. Shows once, for EVERYONE, on the first
  // launch after updating — gated by localStorage flag ll_whatsnew_v11_seen. Appears as
  // a gate in front of the Ready screen; its "Got it" button sets the flag and reveals
  // the normal Ready screen. Also re-openable later via Tour (#33). The WhatsNewScreen
  // render is a self-contained block so #33 can reuse it as a Tour page.
  const [showWhatsNew, setShowWhatsNew] = useState(() => {
    // v203: key bumped v11→v12 for the v1.2 What's New (Finishing Flourish Bonus). Returning players
    // who dismissed the v1.1 screen have ll_whatsnew_v11_seen set; the new key means they see the
    // v1.2 screen once, then it's marked seen. Each version release bumps this suffix.
    try { return localStorage.getItem("ll_whatsnew_v18_seen") !== "1"; } catch { return false; } // v304: 1.8 key
  });
  const dismissWhatsNew = () => {
    try { localStorage.setItem("ll_whatsnew_v18_seen", "1"); } catch {}
    setShowWhatsNew(false);
  };
  const [leaderboardFromPerfectDay, setLeaderboardFromPerfectDay] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState('scores');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('alltime');
  // #18b: Cloud Time Leaderboard data (all-time; { levels:{1..5:[]}, perfect:[] }) + loading.
  const [timeCloudData, setTimeCloudData] = useState(null);
  const [timeCloudLoading, setTimeCloudLoading] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem("ll_photo") || null);
  const [profileNickname, setProfileNickname] = useState(() => localStorage.getItem("ll_nickname") || "");
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameError, setNameError] = useState(""); // shown when nickname/name fails profanity check
  const photoInputRef = useRef(null);
  // ── Bonus Level State (dormant when ENABLE_BONUS_LEVELS = false) ──
  const [bonusLevelUnlocked, setBonusLevelUnlocked] = useState(false);
  const [showBonusUnlock, setShowBonusUnlock] = useState(false);
  const [bonusRetryUsed, setBonusRetryUsed] = useState(false);
  const [showBonusUnsuccessful, setShowBonusUnsuccessful] = useState(false);
  const [showBonusRestart, setShowBonusRestart] = useState(false);
  const [showBonusNo, setShowBonusNo] = useState(false);
  const [bonusRestartChoice, setBonusRestartChoice] = useState(null);
  const consecutivePerfect = getConsecutivePerfectDays(statsData);
  const [undoUsed, setUndoUsed] = useState(ss?.undoUsed || false);
  const [lastValidEntry, setLastValidEntry] = useState(null);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [dailyHistory, setDailyHistory] = useState(() => getDailyHistory());
  const gameIndexRef = useRef(ss?.gameIndex || 0);

  useEffect(() => {
    if (!initialTab) return;
    if (initialTab === "play_now") {
      // Special sentinel from Farewell screen — trigger a fresh game start.
      // CRITICAL: also set tab to "play" so the gameplay UI actually renders.
      // (Bug fix May 24, 2026: tab was initialized to "play_now" which matches
      // no conditional render branch, causing a blank screen.)
      setTab("play");
      handleFullReset({skipWelcome: true});
    } else if (initialTab === "guest-upsell") {
      // v59: Guest tapped Leaderboard from Farewell — open Guest Upsell modal
      // on top of the play screen instead of routing to Leaderboard.
      setTab("play");
      setShowGuestUpsell(true);
    } else {
      // v260 #3: the farewell replaces GameScreen entirely, so this is a FRESH mount and
      // showIntro starts true \u2014 which early-returns the Welcome screen and swallows the
      // requested tab (the "Leaders \u2192 Welcome" misroute). Suppress the intro ONLY for
      // leaderboard/stats routes \u2014 v267 SCOPE FIX: v260 suppressed it for ALL routes,
      // which sent the farewell's Later to a bare board instead of Welcome (Aug 12).
      if (initialTab === "leaderboard" || initialTab === "stats") setShowIntro(false);
      setTab(initialTab);
    }
    onTabConsumed?.();
  }, [initialTab]);

  // ═══════════════════════════════════════════════════════════════
  // 🛠 DEBUG ACTION HANDLER (only fires when DEBUG_MODE is true and user
  // taps an action button in the Debug Menu). Processes the action then
  // calls onDebugConsumed() to clear it.
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!DEBUG_MODE || !debugAction) return;
    try {
      // Level jumps — fresh game starting at chosen level
      if (debugAction.startsWith("jump-L")) {
        const targetLevel = parseInt(debugAction.replace("jump-L", ""), 10);
        if (targetLevel >= 1 && targetLevel <= 5) {
          setShowIntro(false);
          setTab("play");
          // v130: reset with NO Ready screen (skipReady), then jump DIRECTLY to the target level's
          // Welcome map page. Fixes the collision where the Ready screen's own Level-1 sequence
          // overrode the jump target. One timer tick lets the reset state settle first.
          handleFullReset({skipWelcome: true, skipReady: true});
          setTimeout(() => {
            if (targetLevel === 1) {
              fireLevelStartSequence(1);
            } else {
              handleNextLevel(false, targetLevel);
            }
          }, 120);
        }
      }
      // Modal triggers
      else if (debugAction === "modal-perfect-day") {
        setShowIntro(false);
        setTab("play");
        setPerfectDayAchieved(true);
      }
      else if (debugAction === "modal-streak") {
        setShowIntro(false);
        setTab("play");
        setPerfectDayStreakBonus(15000);
        setStreakBonusCount(14);
        setShowStreakBonus(true);
      }
      else if (debugAction === "modal-repeat-pd") {
        setShowIntro(false);
        setTab("play");
        setShowRepeatPerfect(true);
      }
      else if (debugAction === "modal-farewell") {
        // FarewellScreen is rendered at the App level, so we trigger via onFarewell prop
        onFarewell?.({
          totalScore: 12345,
          longestWord: "PERFORMER",
          longestWordScore: 51,
          perfectDayCount: 0,
          history: dailyHistory
        });
      }
      else if (debugAction === "modal-stuck") {
        setShowIntro(false);
        setTab("play");
        setShowStuckModal(true);
      }
      else if (debugAction === "modal-buy-level") {
        setShowIntro(false);
        setTab("play");
        setShowBuyModal(true);
      }
      else if (debugAction === "modal-guest-upsell") {
        setShowIntro(false);
        setTab("play");
        setShowGuestUpsell(true);
      }
      // v113: Mascot popup previews (real art + sample lines). Force mascots pref ON
      // so the gated renders aren't suppressed. Loot/WoD/Great Word self-dismiss at 4s
      // with a guarded timer resume, mirroring real play.
      else if (debugAction === "mascot-level-clear") {
        setShowIntro(false);
        setTab("play");
        setMascotsPref(true);
        // Level Clear is button-dismissed (not auto), so just show it with a rotating line.
        clearSayingIdxRef.current = clearSayingIdxRef.current + 1;
        setClearSayingText(pickClearSaying(level, clearSayingIdxRef.current));
        setLevelComplete(true);
      }
      else if (debugAction === "mascot-great-word") {
        setShowIntro(false);
        setTab("play");
        setMascotsPref(true);
        // Sample: a plausible ≥threshold score + a rotating approved line.
        const sampleScore = (GREAT_WORD_THRESH_PREVIEW[level] || 40) + 15;
        const raw = GREAT_WORD_SAYINGS[Math.floor(Math.random() * GREAT_WORD_SAYINGS.length)];
        setGreatWordPreview({ line: raw.replace("[score]", String(sampleScore)), score: sampleScore });
        stopTimer();
        setTimeout(() => {
          setGreatWordPreview(null);
          if (awaitingFirstTapRef.current || levelCompleteRef.current || pausedRef.current) { stopTimer(); } else { startTimer(); }
        }, 5000); // v117: match live Great Word dwell (5s)
      }
      else if (debugAction === "mascot-loot") {
        setShowIntro(false);
        setTab("play");
        setMascotsPref(true);
        setLootCelebration({ word: "PLUNDER", score: 45, letter: "P" });
        stopTimer();
        setTimeout(() => {
          setLootCelebration(null);
          if (awaitingFirstTapRef.current || levelCompleteRef.current || pausedRef.current) { stopTimer(); } else { startTimer(); }
        }, 4000);
      }
      else if (debugAction === "mascot-wotd") {
        setShowIntro(false);
        setTab("play");
        // v172: NO setMascotsPref(true) here. WoD is not gated by the mascot toggle, so forcing
        // the pref on was pointless — and worse, setMascotsPref() PERSISTS to localStorage
        // ("ll_show_mascots"), so pressing this debug button silently rewrote the player's saved
        // setting. That defeated the very test it was used for (toggle mascots OFF, confirm the
        // WoD pirate still fires). The other mascot-* debug branches still set it because those
        // celebrations ARE toggle-gated and would render nothing otherwise.
        setWotdCelebration(true);
        stopTimer();
        setTimeout(() => {
          setWotdCelebration(false);
          if (awaitingFirstTapRef.current || levelCompleteRef.current || pausedRef.current) { stopTimer(); } else { startTimer(); }
        }, 8000); // v172: match the live 8s WoD dwell
      }
      // State helpers
      else if (debugAction === "fresh-game") {
        handleFullReset({skipWelcome: false});
      }
      else if (debugAction === "near-end") {
        // Start a fresh L1 game first (ensures tiles state is clean and populated),
        // then mark most tiles as used so player is "near end" with just a few left.
        // Need setTimeout chain to let React state settle between operations.
        setShowIntro(false);
        setTab("play");
        handleFullReset({skipWelcome: true});
        setTimeout(() => {
          setTiles(prev => {
            if (!prev || prev.length <= 3) return prev;
            // Leave 3 random tiles unused (varied for testing different scenarios)
            const keepUnused = new Set();
            while (keepUnused.size < 3) {
              keepUnused.add(Math.floor(Math.random() * prev.length));
            }
            return prev.map((tile, idx) => keepUnused.has(idx) ? tile : { ...tile, used: true });
          });
          // Also dismiss the Ready screen so player lands directly on the near-end board
          setShowReadyScreen(false);
        }, 300);
      }
      else if (debugAction === "go-welcome") {
        // Return to Welcome / Intro screen
        setShowIntro(true);
        setTab("play");
        setPerfectDayAchieved(false);
        setShowRepeatPerfect(false);
        setShowStreakBonus(false);
        setShowStuckModal(false);
        setShowBuyModal(false);
        setShowGuestUpsell(false);
      }
      else if (debugAction === "show-whatsnew") {
        // v205 DEBUG: jump straight to the one-time "What's New" popup. It normally only appears
        // once (gated by the ll_whatsnew_v18_seen flag on the Ready screen), so force both gates:
        // showReadyScreen + showWhatsNew. Does NOT clear the seen-flag, so this is view-only and
        // doesn't change whether a real player would see it.
        setShowIntro(false);
        setTab("play");
        setShowReadyScreen(true);
        setShowWhatsNew(true);
      }
    } catch (e) {
      // Silent — debug action errors shouldn't crash gameplay
      console.error("Debug action error:", e);
    }
    onDebugConsumed?.();
  }, [debugAction]);

  // v302: My Flourishes — fetch this player's ff_words the first time STATS opens this session
  // (signed-in only). Fire-and-forget; a failure just leaves the local log on its own.
  useEffect(() => {
    if (tab !== "stats" || isGuest || !user?.id || myFFCloud !== null) return;
    supabase.from("ff_words").select("date_key,level,word,score,created_at").eq("player_id", user.id).order("created_at", { ascending: false }).limit(400)
      .then(({ data, error }) => { if (error) { if (DEBUG_MODE) console.warn("[FF_WORDS] fetch failed", error.message); setMyFFCloud([]); } else setMyFFCloud(data || []); })
      .catch(() => setMyFFCloud([]));
  }, [tab, isGuest, user, myFFCloud]);

  // GLOBAL GUARD: If user lands on the play tab with a completed game (or empty L5+ board),
  // force-show the Play Again screen instead of a dead board. Catches all entry paths
  // (tab clicks, modal closes, etc.), not just returnToGame().
  useEffect(() => {
    if (tab !== "play") return;
    if (showRepeatPerfect || perfectDayAchieved || levelComplete || showIntro || showReadyScreen) return;
    // v301 (Item 1-A): on a Finishing Flourish the board empties immediately but the endgame is
    // deferred behind the FF overlay (up to 10s). This guard used to see "empty L5 + PD acknowledged"
    // in that window and route to Welcome; a Play tap there reset the game, and the deferred
    // sequence then drew the repeat-PD modal over a 0-pt fresh board (Daryl, Aug 28). Hold.
    if (finisherOverlay || pendingBoardClearRef.current) return;
    if (showDaySummary) return; // v302: summary card is a modal in the same family
    try {
      // Stale Perfect Day on launch fix (May 15, 2026):
      // If the player has already acknowledged (dismissed) today's Perfect Day modal,
      // don't auto-pop it again on a fresh app open. They've seen it; they're back to
      // start a fresh game / play around. The Welcome screen / fresh game flow handles
      // them from here.
      const acknowledged = localStorage.getItem("ll_pd_acknowledged_today") === getTodayKey();
      if (acknowledged) {
        // v260 #3 hardening: with the intro suppressed by farewell tab routes, an acknowledged
        // PD + dead board could otherwise render the dead board itself. Route to Welcome.
        const rem0 = tiles.filter(t => !t.used).length;
        if (level >= 5 && rem0 === 0) setShowIntro(true);
        return;
      }
      const completedToday = localStorage.getItem("ll_completed_today") === getTodayKey();
      const remaining = tiles.filter(t => !t.used).length;
      const boardEmpty = level >= 5 && remaining === 0;
      // Only force the Play Again screen if the BOARD itself is in a dead state.
      // The completedToday flag alone isn't enough — player may have hit "Later Today" / "Play Now"
      // and be mid second game where ll_completed_today is still stuck from game 1.
      // BUG FIX (May 2026): Only show the showRepeatPerfect modal if the player actually
      // achieved a Perfect Day. Otherwise it briefly flashes "PERFECT DAY!" before the
      // farewell screen takes over — confusing and incorrect.
      if (boardEmpty && perfectDayRef.current === true && wotdFoundRef.current === true) {
        if (!completedToday) {
          try { localStorage.setItem("ll_completed_today", getTodayKey()); } catch {}
        }
        setShowRepeatPerfect(true);
      }
    } catch {}
  }, [tab, tiles, level, showRepeatPerfect, perfectDayAchieved, levelComplete, showIntro, showReadyScreen, finisherOverlay, showDaySummary]);

  useEffect(() => {
    if (tab === 'leaderboard' && !leaderboardData && !leaderboardLoading) {
      setLeaderboardLoading(true);
      const timer = setTimeout(() => { setLeaderboardLoading(false); setLeaderboardData(null); }, 10000);
      fetchLeaderboard().then(d => { clearTimeout(timer); setLeaderboardData(d); setLeaderboardLoading(false); });
    }
  }, [tab]);

  // #18b: lazy-load the Cloud Time Leaderboard the first time the Times sub-tab is opened
  // (and if a prior load failed/returned null, allow a retry on re-selection).
  useEffect(() => {
    if (tab === 'leaderboard' && leaderboardTab === 'times' && !timeCloudData && !timeCloudLoading) {
      setTimeCloudLoading(true);
      const timer = setTimeout(() => { setTimeCloudLoading(false); setTimeCloudData(null); }, 10000);
      fetchTimeLeaderboard().then(d => { clearTimeout(timer); setTimeCloudData(d); setTimeCloudLoading(false); });
    }
  }, [tab, leaderboardTab]);

  const timerRef = useRef(null);
  const justResetRef = useRef(false);
  const [showReadyToPlay, setShowReadyToPlay] = useState(false);
  const levelTimeRef = useRef(ss?.levelTime || 0);
  const totalTimeRef = useRef(ss?.totalTime || 0);
  const submittedRef = useRef(ss?.submitted || []);
  const totalRef = useRef(ss?.totalScore || 0);
  const levelScoreRef = useRef(ss?.levelScore || 0);
  const lifetimeRef = useRef(lifetimeData.current.total || 0);
  // v306: lifetime/name are only safe to WRITE once this session has PROVEN it can read
  // the cloud row. An unread row is UNKNOWN, not zero — treating unknown as zero is what
  // erased Mack's name and two lifetime totals on Aug 30.
  const lifetimeHydratedRef = useRef(false);
  const cloudLifetimeRef = useRef(0);
  const cloudNameRef = useRef("");
  const audioCtxRef = useRef(null);
  const musicLoopRef = useRef(null);
  const nextLoopRef = useRef(0);
  const clearedLevelsRef = useRef({});
  const syncTimerRef = useRef(null);
  // v257 #7 (piece 3): tracks the last level pushed to the cloud so the primary saver can
  // detect a level TRANSITION (immediate sync) vs ordinary play (debounced sync). Seeded
  // with the session's mount level so launch never registers as a transition.
  const lastSyncedLevelRef = useRef(ss?.level || 1);

  const availableTiles = tiles.filter(t => !t.used);
  const vowelsRemaining = availableTiles.filter(t => VOWELS.has(t.letter)).length;
  const consonantsRemaining = availableTiles.filter(t => !VOWELS.has(t.letter)).length;
  // ── v120: UNIFIED danger-pulse trigger (keyed on `tiles`) ─────────────────────
  // Re-runs on EVERY board change — level entry AND playing down within a level —
  // because `tiles` is a fresh array on each setTiles (submit, next-level, buy, reset,
  // undo, restore). This fixes the v119 miss: v119 keyed the check on [level,tab], so
  // driving the ratio into the danger zone by PLAYING DOWN (level unchanged) never
  // re-evaluated. Reads counts straight off `tiles` (no stale derived-value closure).
  //
  // FRESH-CROSSING semantics preserved: fire only when the danger state was null last
  // check and is dangerous now (safe -> danger). If it's already dangerous and stays
  // dangerous across submits, no re-pulse. vcDangerPrevRef holds the last state.
  // On a genuine board OPEN (level entry) that is already dangerous, prev was null for
  // the prior level's end state, so the transition into danger still reads as a fresh
  // crossing and fires — covering the "board opens already starved" case.
  useEffect(() => {
    if (tab !== "play") return;
    // v121: debounce rapid board churn. Legit board changes (a word submit, a single
    // level open) are seconds apart; the debug Jump-to-Ln chains several handleNextLevel
    // calls ~50ms apart, flashing intermediate boards that could spuriously fire. If this
    // evaluation lands within 150ms of the previous one, treat it as churn: update the
    // baseline silently and DON'T fire — the final settled board's own evaluation (which
    // arrives >150ms later) is the one that pulses. Real play is never this fast, so
    // board-open and in-play crossings are unaffected.
    const now = Date.now();
    const churning = (now - (vcLastEvalRef.current || 0)) < 150;
    vcLastEvalRef.current = now;
    const rem = tiles.filter(t => !t.used);
    const vRem = rem.filter(t => VOWELS.has(t.letter)).length;
    const cRem = rem.length - vRem;
    const nextState = vcDangerState(vRem, cRem, rem.length);
    if (!churning && nextState && vcDangerPrevRef.current !== nextState) fireVcPulse(nextState);
    vcDangerPrevRef.current = nextState;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, tab]);
  const tileRows = [];
  for (let i = 0; i < tiles.length; i += 7) tileRows.push(tiles.slice(i, i + 7));
  const currentWord = selected.map(id => tiles.find(t => t.id === id)?.letter).join("");
  // ═══ v279 SPYGLASS (relocated: v278 anchored this block BEFORE selected/currentWord existed — the dep array read selected.length eagerly → TDZ ReferenceError → white screen at launch. Declaration order matters even for hooks.) (Daryl + player request, Aug 20): double-tap the staged word to check
  // it against the LL dictionary BEFORE committing tiles — the FF-doubt scenario. Rules
  // (Daryl's rulings): any word length; binary verdict only, NO score preview; the game
  // clock KEEPS RUNNING (time is the collateral — "reinforces competitive fairness");
  // blocked while paused (a frozen-clock check would dodge the fee); rejected words get
  // "Submit fer Review" into the existing word_reports pipeline, zero game impact. ═══
  const [spyglass, setSpyglass] = useState(null); // null | {word, status:'checking'|'valid'|'invalid'|'error', reported}
  // v295: double-tap route removed (ruling A) — the SCOUT 🔭 chip is the sole access.
  const [spyHint, setSpyHint] = useState(false);
  const openSpyglass = async () => {
    if (!currentWord || currentWord.length < 3 || validating || pausedRef.current) return;
    const w = currentWord;
    localStorage.setItem("ll_spyglass_used", "1"); setSpyUsed(true); setSpyHint(false);
    setSpyglass({ word: w, status: "checking", reported: false });
    try {
      const r = await validateWord(w);
      setSpyglass(s => s && s.word === w ? { ...s, status: r.valid === true ? "valid" : (r.valid === null || r.source === "timeout") ? "error" : "invalid" } : s);
    } catch { setSpyglass(s => s && s.word === w ? { ...s, status: "error" } : s); }
  };
  const spyglassReport = async () => {
    if (!spyglass || spyglass.reported) return;
    try {
      const { error } = await supabase.from("word_reports").insert({ word: spyglass.word.toLowerCase(), player_name: playerName || "Guest", email: user?.email || null });
      if (!error) setSpyglass(s => s ? { ...s, reported: true } : s);
    } catch {}
  };
  // v280 (Daryl's D): the hint re-appears at the first staged word of EVERY session until
  // the player actually uses the Spyglass once — then retires forever. The permanent 🔭
  // glyph in the word row remains the always-on affordance (v295: sole access — double-tap removed).
  const spyHintShownThisSessionRef = useRef(false);
  const [spyUsed, setSpyUsed] = useState(() => !!localStorage.getItem("ll_spyglass_used"));
  useEffect(() => {
    if (selected.length >= 3 && !localStorage.getItem("ll_spyglass_used") && !spyHintShownThisSessionRef.current) {
      spyHintShownThisSessionRef.current = true;
      setSpyHint(true);
      const t = setTimeout(() => setSpyHint(false), 10000);
      return () => clearTimeout(t);
    }
  }, [selected.length]);

  // v109: the DISPLAYED running score hides the loot 5x (so the loot tile can't be
  // identified by watching the counter). currentScoreReal keeps the 5x for scoring on submit.
  const currentScore = calcWordScore(selected, tiles, true);
  const currentScoreReal = calcWordScore(selected, tiles);
  const buyCost = LEVEL_BUY_COST[level] || 0;
  const canBuy = totalRef.current >= buyCost && buyCost > 0;
  const weekPerfectCount = Object.values(statsData.perfectDaysWeek || {}).reduce((a,b)=>a+b,0);
  const weekHighScore = Math.max(0, ...Object.values(statsData.highScoreWeek || {}).concat([0]));
  const weekHighWord = Math.max(0, ...Object.values(statsData.highWordWeek || {}).concat([0]));
  const last7Days = Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate() - (6-i));
    const key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
    return { key, score: statsData.dailyScores?.[key] || 0, label: d.toLocaleDateString("en-US",{weekday:"short"}) };
  });
  const maxDayScore = Math.max(...last7Days.map(d => d.score), 1);
  const allTimeTotal = Object.values(statsData.dailyScores || {}).reduce((a,b)=>a+b,0);
  const avgDaily = statsData.daysPlayed > 0 ? Math.round(allTimeTotal / statsData.daysPlayed) : 0;

  useEffect(() => {
    const init = async () => {
      // v81: track whether the restored session is already on a completed level, so we
      // don't arm the first-tap gate over a level that's awaiting Next-Level advance.
      let restoredComplete = false;
      if (!isGuest && user) {
        setCloudSyncing(true);
        const [gameState, dailySession] = await Promise.all([loadGameState(user.id), loadDailySession(user.id, getTodayKey())]);
        setCloudSyncing(false);
        if (gameState && gameState.lifetime_points != null) {
          // Only use cloud value if it's greater than local — prevents stale 0 from wiping real points
          const cloudPts = gameState.lifetime_points || 0;
          const localPts = lifetimeRef.current || 0;
          const bestPts = Math.max(cloudPts, localPts);
          lifetimeRef.current = bestPts;
          setLifetimePoints(bestPts);
          // v306: a real row came back — this session may now write game_state.
          lifetimeHydratedRef.current = true;
          cloudLifetimeRef.current = cloudPts;
          if (gameState.player_name) cloudNameRef.current = gameState.player_name;
          // Filter stale badge IDs from cloud (handles legacy badge names)
          const validBadgeIds = new Set(BADGE_DEFS.map(b => b.id));
          const cloudBadges = (gameState.badges || []).filter(id => validBadgeIds.has(id));
          // Merge as UNION — local badges (earned but maybe not yet synced) PLUS cloud badges.
          // Without this union, local-only badges get clobbered when cloud loads.
          setBadgeStore(prev => {
            const merged = new Set([...(prev.lifetime || []), ...cloudBadges]);
            const newStore = { ...prev, lifetime: Array.from(merged) };
            // Persist the merged result to localStorage so subsequent awardBadge
            // reads (synchronous) see the correct state
            try { localStorage.setItem("ll_badges_v2", JSON.stringify(newStore)); } catch {}
            return newStore;
          });
          // Merge stats — preserve local perfect days if cloud has fewer (data loss protection)
          const cloudStats = gameState.stats || {};
          const localStats = getLocalStats();
          const mergedStats = {
            ...localStats,
            ...cloudStats,
            perfectDaysAllTime: Math.max(cloudStats.perfectDaysAllTime||0, localStats.perfectDaysAllTime||0),
            consecutivePerfectDays: Math.max(cloudStats.consecutivePerfectDays||0, localStats.consecutivePerfectDays||0),
            longestStreak: Math.max(cloudStats.longestStreak||0, localStats.longestStreak||0),
            lastPerfectDate: (dateKeyToNum(localStats.lastPerfectDate) >= dateKeyToNum(cloudStats.lastPerfectDate)) ? localStats.lastPerfectDate : cloudStats.lastPerfectDate,
          };
          setStatsData(mergedStats);
          saveLocalStats(mergedStats);
          // v249 DOUBLE-PAY FIX (account-level, cross-device): mergedStats is the account's true
          // picture (cloud vs local, most-recent lastPerfectDate wins — line above). If it shows a
          // PD already banked for today, mark it so the bonus block refuses a second payout even
          // though THIS device's local stats may know nothing about it (e.g. PD earned on the
          // phone, second PD attempted on the iPad). Set before the restore gate so a skipped
          // dead-board restore can't bypass it. Never cleared to false here — only ever raised —
          // so a stale/empty cloud read cannot un-bank a PD this device already recorded.
          try {
            const tKey = getTodayKey();
            if (mergedStats.lastPerfectDate === tKey ||
                ((mergedStats.perfectDaysWeek || {})[tKey] || 0) > 0) {
              pdAlreadyBankedTodayRef.current = true;
            }
          } catch {}
          setTimeLeaderboard(prev => ({...prev, ...(gameState.time_records || {})}));
        }
        // v306: a null/empty gameState is AMBIGUOUS — brand-new player, or a failed read.
        // Probe REST directly; only a confirmed 200 marks the session safe to write.
        if (!lifetimeHydratedRef.current) {
          try {
            const probe = await fetch(
              ADMIN_SUPABASE_URL + "/rest/v1/game_state?select=lifetime_points,player_name&player_id=eq." + user.id,
              { headers: { apikey: ADMIN_ANON_KEY, Authorization: "Bearer " + ADMIN_ANON_KEY } }
            );
            if (probe.ok) {
              const rows = await probe.json();
              const row = Array.isArray(rows) ? rows[0] : null;
              cloudLifetimeRef.current = (row && row.lifetime_points) || 0;
              cloudNameRef.current = (row && row.player_name) || "";
              if (cloudLifetimeRef.current > (lifetimeRef.current || 0)) {
                lifetimeRef.current = cloudLifetimeRef.current;
                setLifetimePoints(cloudLifetimeRef.current);
              }
              lifetimeHydratedRef.current = true;
            }
          } catch {}
        }
        // v249 DOUBLE-PAY FIX: today's cloud daily_sessions row is the most direct account-level
        // signal that a PD is already banked for today. Checked here, OUTSIDE/BEFORE the restore
        // gate below, so it still applies when the dead-board restore is skipped.
        if (dailySession && dailySession.perfect_day === true) {
          pdAlreadyBankedTodayRef.current = true;
        }
        // v243 Bug-B FIX (cloud-restore side): a FINISHED final-level game must NOT be
        // restored as a board. The old gate below only asked "is cloud further along than
        // local?" — a completed L5 cloud row (level 5 > local level 1) passed and dropped the
        // player onto a dead finished board (the cross-launch / cross-account resurrection).
        // The v241 boardIsDead guard only protected the LOCAL SAVE path; the CLOUD RESTORE
        // path had no such guard. Here we treat a completed final level (level_complete && L5+)
        // as "day's game is over" and skip the board restore entirely, so the player falls
        // through to a fresh, REPLAYABLE start (Daryl's locked decision: finished day = play
        // again, not a locked done-state). Stats/points/badges still sync above (separate
        // block). Mid-game completes on L1-4 (level done, awaiting Next-Level advance) are NOT
        // skipped — only the truly-finished final level is. Mirrors the local boardIsDead shape.
        // v245 Bug-B FIX (corrected fields, confirmed by v244 on-device probe): the cloud
        // daily_sessions row has NO level_complete field. The real completion signals are
        // `completed` (row-level game-done flag) and `perfect_day`. A finished final-level
        // board = (completed===true OR perfect_day===true) AND level>=5. Guard on those.
        const cloudBoardIsFinished = dailySession && (dailySession.completed === true || dailySession.perfect_day === true) && (dailySession.level || 1) >= 5;
        // v255 Fix B: the `completed` half of the guard above was HALF-DEAD until v255 —
        // the column was never written (see the v255 Fix A note in syncToCloud), so only
        // Perfect-Day L5 finishes were protected from dead-board resurrection. A player who
        // finished L5 WITHOUT a PD (swept the board but missed WoD / forfeited PD) and then
        // restored from cloud (second device, or lost local session) got the finished board
        // back. Same clean-sweep rule as the sub-L5 inference (Daryl, Jul 25: completion on
        // EVERY level ⟺ all tiles used; tiles remaining = failed clear): a restored L5 row
        // whose tiles are ALL used is a finished game → skip the board restore → replayable
        // Welcome (Daryl's locked decision). Also covers all pre-v255 rows, which can never
        // have completed:true.
        const cloudL5Swept = dailySession && (dailySession.level || 1) >= 5 &&
          (dailySession.tiles || []).length > 0 && dailySession.tiles.every(t => t.used);
        // v256 #8 FIX (Layer C): remember that today's cloud row is a settled, finished game.
        // Re-derived (not just raised) on every init so an account switch can't carry a stale
        // true. syncToCloud consults this before writing — see the Layer C guard there.
        cloudRowCompletedTodayRef.current = !!(dailySession && (dailySession.completed === true || cloudBoardIsFinished || cloudL5Swept));
        if (dailySession && dailySession.level != null && !justResetRef.current && !cloudBoardIsFinished && !cloudL5Swept) {
          // Only restore cloud session if it's further along than local session
          const localLevel = ss?.level || 1;
          const localSubmitted = ss?.submitted?.length || 0;
          const cloudLevel = dailySession.level || 1;
          const cloudSubmitted = (dailySession.submitted || []).length;
          const useCloud = cloudLevel > localLevel || (cloudLevel === localLevel && cloudSubmitted > localSubmitted);
          TPROBE("ARBITRATION | localLvl=" + localLevel + " localSub=" + localSubmitted + " cloudLvl=" + cloudLevel + " cloudSub=" + cloudSubmitted + " -> " + (useCloud ? "CLOUD WINS" : "LOCAL KEPT"));
          // v257 #7 fix (piece 4): the tie-breaker above was >= — a TIE on level and word
          // count handed the day to the CLOUD, whose timers are frozen at the last word
          // submission, silently discarding the local save's fresher timers (the background
          // save was working all along; arbitration threw its work away — reconciles the
          // Aug3a "exists but evidently not persisting" mystery). Local is this device's own
          // at-least-as-fresh snapshot; cloud now wins only when STRICTLY further along.
          if (useCloud) {
            // Hard cap on cloud level
            const safeCloudLevel = (!ENABLE_BONUS_LEVELS && cloudLevel > 5) ? 5 : cloudLevel;
            setLevel(safeCloudLevel);
            setTotalScore(dailySession.total_score || 0); totalRef.current = dailySession.total_score || 0;
            setLevelScore(dailySession.level_score || 0); levelScoreRef.current = dailySession.level_score || 0;
            if (dailySession.tiles && dailySession.tiles.length > 0) setTiles(dailySession.tiles);
            tileCountRef.current = dailySession.tile_count || 42;
            setSubmitted(dailySession.submitted || []); submittedRef.current = dailySession.submitted || [];
            // PERFECT DAY GUARD: never let a cloud row clobber local PD=true with PD=false.
            // Mid-game cloud saves intentionally write perfect_day:false (the cloud row only
            // commits true when the game is fully complete). So cloud=false can mean "still
            // in progress with PD intact" — local is the source of truth in that case.
            // Cloud only overrides when it confirms a true Perfect Day.
            if (dailySession.perfect_day === true) setPerfectDaySync(true);
            longestWordTodayRef.current = dailySession.longest_word_today || ""; setLongestWordToday(longestWordTodayRef.current);
            TPROBE("CLOUD RESTORE applying timers: cloud lvlT=" + (dailySession.level_time || 0) + " totT=" + (dailySession.total_time || 0) + " (overwrites local seed)");
            levelTimeRef.current = dailySession.level_time || 0; totalTimeRef.current = dailySession.total_time || 0;
            setLevelTime(dailySession.level_time || 0); setTotalTime(dailySession.total_time || 0);
            if (dailySession.level_complete) { setLevelComplete(true); restoredComplete = true; }
            // v254 Fix B (cloud second source, found via Daryl's account-switch test Jul 25):
            // the cloud row has NO level_complete field (v245 probe), so a level finished
            // below L5 restored as a live-looking board with the last word — not the
            // "Level N Complete / Play Level N+1" modal. RULE (Daryl, Jul 25): on EVERY
            // level, completion ⟺ clean sweep of all tiles; an unsuccessful end leaves
            // tiles UNUSED. So restored tiles all used + level<5 IS the completion signal.
            // L5 stays excluded: a swept L5 = game over, handled by the cloudBoardIsFinished
            // guard above (finished day → replayable intro, Daryl's locked decision).
            // NOTE: this inference rests on the clean-sweep rule — if a future feature ever
            // completes an L1-4 level without sweeping, add a real level_complete column.
            const restoredTiles = dailySession.tiles || [];
            if (safeCloudLevel < 5 && restoredTiles.length > 0 && restoredTiles.every(t => t.used)) {
              setLevelComplete(true); restoredComplete = true;
            }
            if (dailySession.undo_used) setUndoUsed(true);
          }
        }
        const { data: playerData } = await supabase.from("players").select("name").eq("id", user.id).single();
        if (playerData?.name) { setPlayerName(playerData.name); playerNameRef.current = playerData.name; }
        // Load photo from Supabase — always try when signed in
        const cloudPhoto = await loadPlayerPhoto(user.id);
        if (cloudPhoto) { setProfilePhoto(cloudPhoto); localStorage.setItem('ll_photo', cloudPhoto); }
      } else {
        const savedName = localStorage.getItem("ll_name") || "";
        setPlayerName(savedName); playerNameRef.current = savedName;
      }
      justResetRef.current = false;
      // v81 FIX: after restoring a saved session (cloud or local), the resumed level must
      // wait for the player's first tap before the clock runs — same rule as a fresh level.
      // The restore branches above load saved levelTime/tiles but never armed the gate, so
      // on app-reopen the timer started immediately on the restored level (the "Let's Go →
      // restored L2 → clock running before any tile" bug). Arm the gate + stop the timer here
      // (covers every restore path) UNLESS the level is already complete (awaiting Next-Level
      // advance, which arms its own gate). The gate clears on first tile tap.
      const alreadyComplete = restoredComplete || ss?.levelComplete === true;
      // v275 RACE FIX: if the player already declared resume intent (Resume tap or WB
      // "Return to Level N") before this async init finished, do NOT freeze the clock they
      // just started — honor the intent and restart the timer over any restore side effects.
      if (resumeIntentRef.current) {
        resumeIntentRef.current = false;
        if (!alreadyComplete && !pausedRef.current) startTimer();
      } else if (!alreadyComplete) {
        stopTimer();
        setAwaitingFirstTap(true); awaitingFirstTapRef.current = true;
      }
      if (!localStorage.getItem("ll_tour_done")) setShowTour(true);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") scheduleNotifications();
    };
    init();
  }, [user, isGuest]);

  const syncToCloud = useCallback(async (snapshotDay) => {
    if (isGuest || !user) return;
    const todayKey = getTodayKey();
    // v256 #8 FIX, Layers A+B (frozen-timer laundering): scheduled syncs carry the day they
    // were CAPTURED (snapshotDay, stamped in scheduleSyncToCloud). iOS freezes a pending
    // 3-second sync timer on suspend and fires it on resume — even the next morning — so a
    // stale timer used to write yesterday's board under today's date_key (confirmed in the
    // Aug 10 SQL pulls: four corrupted rows, all level_score 0, PD/completed sticky-true but
    // level/score/time from a dead session). If the day changed since capture, the snapshot
    // describes a game that no longer exists — discard it. Direct calls (leaderboard refresh,
    // name change, game-end) pass no snapshotDay and are unaffected by this guard.
    if (snapshotDay && snapshotDay !== todayKey) {
      if (DEBUG_MODE) console.log("[SYNCGUARD] snapshot day " + snapshotDay + " != today " + todayKey + " — sync discarded");
      return;
    }
    // v256 #8 FIX, Layer C (a settled day never downgrades): if today's cloud row is already
    // a finished game and the player has NOT actually played this session, local state is an
    // unplayed fresh board (the finished-day restore is deliberately skipped — Daryl's locked
    // replayable-Welcome decision) and writing it would clobber the finished row. This was the
    // relaunch/cross-device downgrade in the Aug 10 pulls, and the suspected #3
    // leaderboard-round-trip downgrade shares this exit. Nothing truthful to write → skip.
    // playerActedRef flips on first word submit or an explicit new-game start, after which
    // saves flow normally — replays remain fully supported.
    if (cloudRowCompletedTodayRef.current && !playerActedRef.current) {
      if (DEBUG_MODE) console.log("[SYNCGUARD] cloud row already completed for " + todayKey + " and no play this session — sync skipped");
      return;
    }
    // Compute top scoring word of all submitted words this game
    const validWords = submittedRef.current.filter(s => s.valid);
    const topEntry = validWords.reduce((best, s) => !best || s.score > best.score ? s : best, null);
    // Only mark perfect_day:true on the cloud if the game is FULLY complete
    // (Level 5 done, ll_completed_today flag set) AND PD is still intact.
    // Mid-game saves should never write perfect_day:true — this prevents the
    // cloud row from getting "stuck" with PD=true if the player later replays
    // a level (which forfeits PD), since saveDailySession has sticky-true logic.
    const gameIsComplete = (() => {
      try { return localStorage.getItem("ll_completed_today") === todayKey; } catch { return false; }
    })();
    const cloudPerfectDay = gameIsComplete && perfectDayRef.current === true && wotdFoundRef.current === true;
    // v306: game_state is written ONLY by a session that proved it could read the row.
    // daily_sessions still saves either way — today's game is never lost by this guard.
    const canWriteGameState = lifetimeHydratedRef.current === true;
    if (!canWriteGameState && DEBUG_MODE) console.log("[SYNCGUARD v306] game_state write skipped - cloud never hydrated this session");
    await Promise.all([
      saveDailySession(user.id, todayKey, {
        level, totalScore: totalRef.current, levelScore: levelScoreRef.current,
        tiles, submitted: submittedRef.current, perfectDay: cloudPerfectDay,
        tileCount: tileCountRef.current, levelTime: levelTimeRef.current,
        totalTime: totalTimeRef.current, longestWordToday: longestWordTodayRef.current, levelComplete, newBestTime, undoUsed,
        gameIndex: gameIndexRef.current, wotdFound: wotdFound,
        // v255 Fix A: the cloud `completed` column was NEVER written — supabase.js line 144
        // does `session.completed || false` and App.jsx never passed the field, so every row
        // ever written has completed:false (this also explains the July23d "completed=false
        // on PD rows" mystery). gameIsComplete (the ll_completed_today check, computed above)
        // is exactly the right value and was already sitting here unused by the payload.
        completed: gameIsComplete,
        topWord: topEntry?.word || "", topWordScore: topEntry?.score || 0,
      }),
      !canWriteGameState ? Promise.resolve(null) : saveGameState(user.id, (() => {
        // Read badges fresh from localStorage at save time to avoid syncing
        // stale React state (badgeStore could be 1-2 renders behind awardBadge writes)
        let liveBadges = badgeStore.lifetime;
        try {
          const raw = localStorage.getItem("ll_badges_v2");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.lifetime)) liveBadges = parsed.lifetime;
          }
        } catch {}
        return {
          // v306: never write an empty name over a good one, and never write a lifetime
          // lower than the last value actually READ from the cloud.
          playerName: playerNameRef.current || playerName || cloudNameRef.current || '',
          lifetimePoints: Math.max(lifetimeRef.current || 0, cloudLifetimeRef.current || 0), lastPlayedDate: todayKey,
          currentStreak: statsData.currentStreak, longestStreak: statsData.longestStreak,
          lastStreakDate: statsData.lastStreakDate, badges: liveBadges,
          stats: {...getLocalStats(), playerName: playerNameRef.current || playerName}, timeRecords: timeLeaderboard,
        };
      })()),
    ]);
  }, [user, isGuest, level, tiles, longestWordToday, badgeStore, statsData, timeLeaderboard, playerName, levelComplete, newBestTime, undoUsed]);

  // v256 #8 FIX: the scheduled timer routes through a ref so a woken stale timer calls the
  // LATEST syncToCloud (reading current state), never a frozen old closure — and it carries
  // the day it was scheduled so the Layers A+B day-guard above can veto it after a rollover.
  const syncToCloudRef = useRef(null);
  useEffect(() => { syncToCloudRef.current = syncToCloud; }, [syncToCloud]);
  const scheduleSyncToCloud = useCallback(() => {
    if (isGuest || !user) return;
    clearTimeout(syncTimerRef.current);
    const snapshotDay = getTodayKey(); // Layer A: the day is stamped at CAPTURE time, not fire time
    syncTimerRef.current = setTimeout(() => { if (syncToCloudRef.current) syncToCloudRef.current(snapshotDay); }, 3000);
  }, [isGuest, user]);

  const showSavedIndicator = useCallback(() => { setSavedIndicator(true); setTimeout(() => setSavedIndicator(false), 2000); }, []);

  useEffect(() => {
    // v226: same dead-board guard as the visibilitychange saver below — and this one is the
    // PRIMARY leak. It fires on every change to level/tiles, so it runs the instant the last tile
    // of L5 is used, writing the finished board into ll_session right after the game-end path
    // cleared it. No backgrounding required. Guarding only the visibility save would have left
    // this open and looked like a partial fix.
    // Board state, NOT ll_completed_today — that flag stays set through a second game (see ~3990).
    const unusedCount = tiles.filter(t => !t.used).length;
    // v241 Bug-B FIX: the old guard (all tiles used) missed a Finishing-Flourish clear, which ends
    // the game with tiles still on the board — so the finished board was saved as in-progress.
    // Also treat the board as dead when the game is genuinely COMPLETE (levelComplete true on L5).
    // Safe against the "second game same day" case: a fresh game resets levelComplete to false, so
    // the second game saves normally.
    const boardIsDead = level >= 5 && (unusedCount === 0 || levelComplete === true);
    // v233 FFLEAK PROBE (TEMPORARY, DEBUG_MODE only): B-bug diagnosis. Logs the exact
    // board/flag state at the instant this save effect fires on an L5 board, BEFORE the
    // dead-board guard returns. Goal: see why an FF-completed board slips past boardIsDead
    // and gets written into ll_session. Read-only — no behavior change.
    if (DEBUG_MODE && level >= 5) {
      console.log("[FFLEAK]",
        "level=" + level,
        "totalTiles=" + tiles.length,
        "unusedCount=" + unusedCount,
        "boardIsDead=" + boardIsDead,
        "perfectDay=" + perfectDayRef.current,
        "levelComplete=" + levelComplete,
        "submittedLen=" + (submittedRef.current ? submittedRef.current.length : "null"),
        "lastSubmitted=" + (submittedRef.current && submittedRef.current.length ? submittedRef.current[submittedRef.current.length - 1] : "none"),
        "completedTodayFlag=" + (localStorage.getItem("ll_completed_today") === getTodayKey()),
        "willSave=" + (!boardIsDead)
      );
    }
    if (boardIsDead) return;
    saveLocalSession({ level, tiles, totalScore: totalRef.current, levelScore: levelScoreRef.current, submitted: submittedRef.current, badges: badgeStore.lifetime, streak, perfectDay: perfectDayRef.current, longestWordToday: longestWordTodayRef.current, tileCount: tileCountRef.current, levelTime: levelTimeRef.current, totalTime: totalTimeRef.current, levelComplete, newBestTime, undoUsed, gameIndex: gameIndexRef.current, paused: pausedRef.current }, user?.id);
    showSavedIndicator();
    // v257 #7 fix (piece 3): a LEVEL TRANSITION is a moment that matters — sync the cloud
    // NOW, not after the 3-second debounce. Advancing into a level and closing inside the
    // debounce window left the cloud ignorant of the new level entirely (Variant B: Mack x2,
    // Daryl Aug 3 — "no level-5 row ever existed"). This effect runs post-commit, so the
    // closures here are fresh; lastSyncedLevelRef starts at the mount level so app launch
    // itself never counts as a transition (and so can't race the cloud restore).
    if (level !== lastSyncedLevelRef.current) {
      lastSyncedLevelRef.current = level;
      clearTimeout(syncTimerRef.current);
      if (syncToCloudRef.current) syncToCloudRef.current();
    } else {
      scheduleSyncToCloud();
    }
  }, [level, tiles, badgeStore, streak, longestWordToday, levelComplete, newBestTime, undoUsed]);

  // Save immediately when user switches away (text message, other app, etc.)
  useEffect(() => {
    const handleVisibilityChange = () => {
      TPROBE(document.hidden ? "BACKGROUND (hidden)" : "FOREGROUND (visible)");
      if (document.hidden) {
        // v226: DO NOT resurrect a DEAD board. Player report (July 16): finished L5 with
        // REWRITTEN, got the FF bonus, came back later and was dropped back on L5 with that same
        // last word waiting to be spelled again.
        // Cause: this save fired unconditionally on hide. The game-end path DOES call
        // clearLocalSession() — but then the player backgrounds the app (or the share sheet
        // triggers visibilitychange) and THIS handler writes the finished board straight back into
        // ll_session. On next launch showIntro (~3703) sees "same day AND level > 1" and restores
        // it. The clear was correct; the save undid it.
        // The guard is the BOARD STATE, not ll_completed_today — see the May 2026 note at ~3990:
        // that flag stays set while the player is mid-SECOND game, so guarding on it would kill
        // saves for the whole second game. `level >= 5 && remaining === 0` is the same dead-board
        // test used there, and it's true only when there is genuinely nothing to come back to.
        // v241 Bug-B FIX: same broadened guard as the primary saver above. Use levelCompleteRef
        // (always-current) here rather than the closure value, since this handler can fire long
        // after the completing render. (v254 comment correction, per Daryl: completion on EVERY
        // level — L5 included, with or without a Finishing Flourish — means a clean sweep of all
        // tiles. Tiles remaining = failed clear. The old note here claimed an "FF clear" could
        // complete L5 with tiles remaining; that was wrong. The OR-guard below is still correct:
        // when levelCompleteRef is true, remaining is 0 anyway — the flag just survives render lag.)
        const boardIsDead = level >= 5 && (tiles.filter(t => !t.used).length === 0 || levelCompleteRef.current === true);
        if (boardIsDead) return;
        saveLocalSession({ level, tiles, totalScore: totalRef.current, levelScore: levelScoreRef.current, submitted: submittedRef.current, badges: badgeStore.lifetime, streak, perfectDay: perfectDayRef.current, longestWordToday: longestWordTodayRef.current, tileCount: tileCountRef.current, levelTime: levelTimeRef.current, totalTime: totalTimeRef.current, levelComplete, newBestTime, undoUsed, gameIndex: gameIndexRef.current, paused: pausedRef.current }, user?.id);
        // v257 #7 fix (piece 2): backgrounding is a moment that matters — push the snapshot
        // (current timers included, read from refs) to the CLOUD immediately, inside iOS's
        // few seconds of background grace. Previously only the local save ran here and the
        // cloud rode a 3-second debounce that dies with the process — so a close after
        // backgrounding left the cloud at the last word-submission snapshot (the #7 timer
        // revert and the Variant-B "no L5 row ever existed" void). Best-effort by nature;
        // the pending debounce is cancelled so no frozen stale timer survives (belt for the
        // v256 day-guard's suspenders).
        clearTimeout(syncTimerRef.current);
        if (syncToCloudRef.current) syncToCloudRef.current();
      } else if (getTodayKey() !== mountedDayRef.current) {
        // v225: came back from the background and the DATE CHANGED. Everything date-keyed in this
        // app was read at mount — the session, the Word of the Day cache, stats/streak keys. Fixing
        // only the session would leave a half-rolled-over state (today's board, yesterday's WoD),
        // which is worse than the bug. So: show the player what happened, then hard reload on
        // dismiss. The reload re-runs every date-keyed initializer together, and
        // loadLocalSession()'s existing date guard then correctly discards yesterday's save.
        // Daryl chose this (Option C + modal): "It won't happen very often."
        setDayRolledOver(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [level, tiles, badgeStore, streak, longestWordToday, levelComplete, newBestTime, undoUsed]);

  const startTimer = useCallback(() => {
    // v77 DURABLE GUARD: never start the clock while we're waiting for the player's
    // first tap of a level. This makes the freeze robust regardless of which path
    // calls startTimer() — fixing the recurrent "timer moving before any taps" leak
    // at its root instead of patching individual callers. The tile-tap handler clears
    // awaitingFirstTap, after which startTimer() (via the fair-timer effect) runs.
    if (awaitingFirstTapRef.current) { TPROBE("startTimer BLOCKED (first-tap gate)"); return; }
    if (timerRef.current) return;
    timerRef.current = setInterval(() => { levelTimeRef.current += 1; totalTimeRef.current += 1; setLevelTime(levelTimeRef.current); setTotalTime(totalTimeRef.current); }, 1000);
    TPROBE("startTimer STARTED");
  }, []);
  const stopTimer = useCallback(() => { clearInterval(timerRef.current); timerRef.current = null; TPROBE("stopTimer"); }, []);
  // v270 TIMER PROBE (Chelsea field report, Aug 14: mid-game clock "back down to 00:00" +
  // day total under wall-clock). Console-only, DEBUG-gated, reads refs — never setState.
  function TPROBE(tag) { if (DEBUG_MODE) try {
    const line = new Date().toISOString().slice(11,23) + " " + tag + " | lvlT=" + levelTimeRef.current + " totT=" + totalTimeRef.current + " paused=" + pausedRef.current + " gate=" + awaitingFirstTapRef.current + " interval=" + (timerRef.current ? "RUNNING" : "stopped");
    console.log("[TPROBE] " + line);
    // v276 FLIGHT RECORDER: cold-launch probe lines fire before the Inspector can attach and
    // die with the process — so they also land in a localStorage ring buffer (last 60) that
    // SURVIVES the kill. Dump after any relaunch: JSON.parse(localStorage.ll_tprobe_log)
    const buf = JSON.parse(localStorage.getItem("ll_tprobe_log") || "[]");
    buf.push(line); while (buf.length > 60) buf.shift();
    localStorage.setItem("ll_tprobe_log", JSON.stringify(buf));
  } catch {} }
  useEffect(() => { TPROBE("MOUNT seed | ss=" + (ss ? "PRESENT" : "NULL") + " ss.level=" + (ss && ss.level || 0) + " ss.submitted=" + (ss && ss.submitted && ss.submitted.length || 0) + " ss.levelTime=" + (ss && ss.levelTime || 0) + " ss.totalTime=" + (ss && ss.totalTime || 0) + " ss.paused=" + !!(ss && ss.paused) + " owner=" + (typeof getCurrentOwnerSync === "function" ? getCurrentOwnerSync() : "?")); }, []);
  // v79 CENTRAL FIX: resetLevelTimer now also stops the clock AND arms the first-tap
  // gate. Every level-entry/reset path calls resetLevelTimer(), so doing the freeze
  // here guarantees the timer stays at 0 until the player's first tap — regardless of
  // which path (handleNextLevel, doLevelReset, buy, fresh game) triggered the new level.
  // This replaces the fragile per-caller gate-arming that kept leaking.
  const resetLevelTimer = useCallback(() => {
    TPROBE("resetLevelTimer (level entry: LEVEL clock -> 0, gate arming)");
    levelTimeRef.current = 0; setLevelTime(0);
    stopTimer();
    setAwaitingFirstTap(true); awaitingFirstTapRef.current = true;
  }, [stopTimer]);
  useEffect(() => { stopTimer(); return () => stopTimer(); }, []); // timer starts on Lets Go

  // ── Fair-timer effect (May 23, 2026) ────────────────────────────────────
  // Pause the game timer (level + total) any time a celebration or end-of-level
  // modal is showing. The player cannot act during these screens, so it would
  // be unfair to keep their time running. Also covers Stuck (game-detected, not
  // user-initiated) and the WoD reminder. User-initiated modals (Buy, Reset,
  // Undo, NewGame) are intentionally excluded — the player is actively deciding
  // and the time spent is part of their gameplay.
  // Note: WoD and Loot celebrations also call stopTimer() directly in their
  // setters — this effect is harmless redundancy for those (stopTimer is
  // idempotent) and ensures full coverage for the others.
  useEffect(() => {
    // v80: STOP-ONLY. This effect pauses the timer whenever a blocking modal/screen is
    // showing, but NEVER auto-starts it. Starting the clock happens ONLY from an actual
    // tile tap (first tap of a level) or an explicit mid-play resume (un-pause, badge
    // dismiss, post-validation, fresh-tiles). This permanently removes the recurrent leak
    // where a modal DISMISS (WoD reminder, celebration, intro) auto-resumed the clock
    // before the player's first tap. The startTimer() guard (awaitingFirstTapRef) is a
    // second layer of protection.
    const blocking = levelComplete || perfectDayAchieved || showRepeatPerfect ||
                     showStreakBonus || wotdCelebration || lootCelebration ||
                     showWotdReminder || showStuckModal ||
                     showIntro || showReadyScreen || awaitingFirstTap;
    if (blocking) {
      stopTimer();
    }
  }, [levelComplete, perfectDayAchieved, showRepeatPerfect, showStreakBonus,
      wotdCelebration, lootCelebration, showWotdReminder, showStuckModal,
      showIntro, showReadyScreen, awaitingFirstTap, tab, startTimer, stopTimer]);

  const handlePause = () => {
    if (paused) {
      TPROBE("RESUME from pause");
      // v274 RULING B (Daryl, Aug 19: "time is a competitive category — requires consistency"):
      // an explicit Resume tap IS the intent the first-tap gate was waiting for. Previously a
      // cold relaunch (iOS killed the app during a long absence) re-armed the gate, so Resume
      // left the clock frozen until a tile tap — while a quick warm return resumed instantly.
      // Same player action now behaves identically regardless of what iOS did in between.
      awaitingFirstTapRef.current = false; setAwaitingFirstTap(false);
      resumeIntentRef.current = true; // v275: survives a late-arriving init (see resumeIntentRef)
      setPaused(false); startTimer(); if (musicOn) startMusic();
    }
    else {
      TPROBE("PAUSE pressed");
      setPaused(true); stopTimer(); stopMusic();
      // v257 #7 fix (piece 1): Pause is a moment that matters — save NOW, locally and to the
      // cloud, with paused:true persisted so a relaunch returns paused. Previously nothing
      // saved on Pause at all (saves fired only on word submission — Daryl's Hawaii
      // experiments, Aug3a). The immediate cloud sync also cancels any pending debounce so
      // no stale frozen timer survives the pause.
      saveLocalSession({ level, tiles, totalScore: totalRef.current, levelScore: levelScoreRef.current, submitted: submittedRef.current, badges: badgeStore.lifetime, streak, perfectDay: perfectDayRef.current, longestWordToday: longestWordTodayRef.current, tileCount: tileCountRef.current, levelTime: levelTimeRef.current, totalTime: totalTimeRef.current, levelComplete, newBestTime, undoUsed, gameIndex: gameIndexRef.current, paused: true }, user?.id);
      if (!isGuest && user) { clearTimeout(syncTimerRef.current); if (syncToCloudRef.current) syncToCloudRef.current(); }
    }
  };

  const startMusic = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtxRef.current; if (ctx.state === "suspended") ctx.resume();
    const guitar = createGuitar(ctx);
    const loop = () => {
      const now = ctx.currentTime; const start = Math.max(now, nextLoopRef.current);
      MELODY.forEach(({ freq, beat }) => guitar.pluck(freq, start + beat * BEAT_DUR, 1.8, 0.35));
      nextLoopRef.current = start + LOOP_DUR;
      musicLoopRef.current = setTimeout(loop, (nextLoopRef.current - ctx.currentTime - 0.1) * 1000);
    };
    loop();
  }, []);
  const stopMusic = useCallback(() => { clearTimeout(musicLoopRef.current); if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; } nextLoopRef.current = 0; }, []);
  useEffect(() => { if (musicOn && !paused) startMusic(); else stopMusic(); return () => stopMusic(); }, [musicOn, paused]);

  // BUG FIX 4: Independent scope checking for "all" badges
  const processBadgeQueue = useCallback(() => {
    if (badgePopupActiveRef.current) return; // already showing one
    // v163 (v1.2 #5): a word/points (or BOARD CLEAR / error) flash is on screen — hold the
    // queue. showFlash's dismiss timer calls back into here once the flash clears, so
    // badges pop AFTER the player has read the word and its score. Nothing is lost:
    // the badge stays in badgeQueueRef until then.
    if (flashActiveRef.current) return;
    const next = badgeQueueRef.current.shift();
    if (!next) return;
    badgePopupActiveRef.current = true;
    setShowBadge(next.id);
    setShowBadgeExtra(next.extraLabel || "");
    stopTimer();
    setConfetti(true);
    setTimeout(() => setConfetti(false), 5000);
    setTimeout(() => {
      setShowBadge(null); setShowBadgeExtra("");
      badgePopupActiveRef.current = false;
      // Process next badge in queue (if any)
      if (badgeQueueRef.current.length > 0) {
        // Brief pause between badges so player can register each one
        setTimeout(() => processBadgeQueue(), 400);
      } else {
        // Queue empty — restart timer ONLY if still in active gameplay.
        // v81 FIX: use levelCompleteRef.current (always current) + awaitingFirstTapRef,
        // NOT the stale `levelComplete` closure value. On level completion, badges are
        // awarded and this dismiss fires AFTER setLevelComplete(true) — but the closure
        // captured levelComplete=false, so it wrongly restarted the clock on the
        // "Level Complete!" screen. The startTimer() guard also blocks if awaiting first tap.
        if (!pausedRef.current && !levelCompleteRef.current && !awaitingFirstTapRef.current) startTimer();
        // v162 (v1.2 #2): the whole badge queue has now had its solo moment — release the
        // Level-Clear mascot so it pops in. Guard on levelCompleteRef so this only fires
        // when we're actually on the Level Complete screen (not a mid-play badge).
        if (levelCompleteRef.current) setMascotReady(true);
      }
    }, 5000);
  }, [stopTimer, startTimer, levelComplete]);

  // v164: extracted verbatim from the old inline loot block so the haptic + slot-machine
  // chime fire WITH the loot overlay (from the drain), not 2s early at submit time.
  const playLootChime = useCallback(() => {
    // Haptic feedback (1-2 sharp pulses, slot-machine win style)
    try { if (navigator.vibrate) navigator.vibrate([60, 40, 120]); } catch {}
    // Sound effect if not muted
    try {
      if (musicOn) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const playTone = (freq, time, dur=0.15) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain); gain.connect(audioCtx.destination);
          osc.frequency.value = freq;
          osc.type = "triangle";
          gain.gain.setValueAtTime(0, audioCtx.currentTime + time);
          gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + time + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + time + dur);
          osc.start(audioCtx.currentTime + time); osc.stop(audioCtx.currentTime + time + dur);
        };
        // Slot-machine ascending chime
        playTone(523.25, 0);     // C5
        playTone(659.25, 0.08);  // E5
        playTone(783.99, 0.16);  // G5
        playTone(1046.50, 0.24, 0.3); // C6 (held)
      }
    } catch {}
  }, [musicOn]);

  // v164 (v1.2 #6): drains the celebration queue one overlay at a time. This is the
  // ONLY place a celebration touches the timer. The clock was already stopped the moment
  // the celebration was enqueued (see enqueueCelebration), so it stays frozen for the whole
  // chain — the player is not charged for the flash beat or any of the dwell time. On the
  // final overlay we run the standard guarded resume (frozen if the level completed /
  // awaiting first tap / paused), then release any badges that were waiting.
  const drainCelebrationQueue = useCallback(() => {
    if (celebrationActiveRef.current) return;      // one at a time
    if (flashActiveRef.current) return;            // flash still on screen — wait for it
    // v167: single hand-off point for "celebrations are done, who's next?" Both exits below
    // route through this so a new stage can never be added to one path and forgotten on the
    // other. Badges run next if any; otherwise the mascot is released.
    const handOff = () => {
      if (badgeQueueRef.current.length > 0) processBadgeQueue();
      else if (levelCompleteRef.current) setMascotReady(true);
    };
    const next = celebrationQueueRef.current.shift();
    if (!next) { handOff(); return; }
    celebrationActiveRef.current = true;
    if (next.kind === "wotd") {
      setWotdCelebration(next.payload || true); // v298: object { bonus } (or true from legacy paths)
      setConfetti(true); setTimeout(() => setConfetti(false), next.dwellMs);
    } else if (next.kind === "loot") {
      setLootCelebration(next.payload);
      playLootChime();
    } else if (next.kind === "greatWord") {
      setGreatWordCelebration(next.payload);
      triggerHaptic("medium");
    }
    if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = setTimeout(() => {
      celebrationTimerRef.current = null;
      if (next.kind === "wotd") setWotdCelebration(false);
      else if (next.kind === "loot") setLootCelebration(null);
      else if (next.kind === "greatWord") setGreatWordCelebration(null);
      celebrationActiveRef.current = false;
      if (celebrationQueueRef.current.length > 0) {
        // More celebrations pending (e.g. a loot word that is ALSO the Word of the Day).
        // Brief beat between them, same rhythm as the badge queue.
        setTimeout(() => drainCelebrationQueue(), 400);
      } else {
        // Last celebration done — guarded resume (v80 stop-only model).
        if (awaitingFirstTapRef.current || levelCompleteRef.current || pausedRef.current) {
          stopTimer();
        } else {
          startTimer();
        }
        handOff();
      }
    }, next.dwellMs);
  }, [stopTimer, startTimer, processBadgeQueue, playLootChime]);

  // v164: enqueue a celebration. Freezes the clock IMMEDIATELY so the 2s flash that
  // precedes the overlay is not charged to the player, then attempts a drain (which
  // no-ops while the flash is up — showFlash's dismiss timer kicks it).
  const enqueueCelebration = useCallback((kind, payload, dwellMs) => {
    celebrationQueueRef.current.push({ kind, payload, dwellMs });
    stopTimer();
    drainCelebrationQueue();
  }, [stopTimer, drainCelebrationQueue]);

  // v164: hard-clear any in-flight or pending celebration. Called from the reset paths
  // (fresh game / replay level / next level / PLAY NOW) so a descriptor queued behind a
  // flash on the last word of a level can't surface on the NEXT level's board.
  const clearCelebrationQueue = useCallback(() => {
    if (celebrationTimerRef.current) { clearTimeout(celebrationTimerRef.current); celebrationTimerRef.current = null; }
    celebrationQueueRef.current = [];
    celebrationActiveRef.current = false;
    setWotdCelebration(false);
    setLootCelebration(null);
    setGreatWordCelebration(null);
  }, []);

  // v198 (Finisher step 4): single dismiss path for the FinisherOverlay. Closes the overlay,
  // then runs the deferred Level-Clear sequence exactly once (guarded by nulling the ref first,
  // so the "Dismiss Page" button and the 10s auto-timeout can't both fire it). On the DEBUG
  // preview path there is no pending sequence, so this just closes the overlay.
  const dismissFinisherOverlay = useCallback(() => {
    setFinisherOverlay(null);
    const pending = pendingBoardClearRef.current;
    pendingBoardClearRef.current = null;
    if (pending) pending();
  }, []);

  // v301 (Item 1-B): called by every full-game reset. Drops a pending deferred board-clear
  // sequence, closes a lingering FF overlay, and cancels a queued repeat-PD modal, so nothing
  // from the finished game can fire over the fresh one.
  const cancelDeferredEndgame = useCallback(() => {
    pendingBoardClearRef.current = null;
    setFinisherOverlay(null);
    if (repeatPdTimerRef.current) { clearTimeout(repeatPdTimerRef.current); repeatPdTimerRef.current = null; }
  }, []);

  // v163 (v1.2 #5): single entry point for the green/red flash popup. Marks the flash
  // active (which holds the badge queue), then on dismiss clears the flag and drains any
  // badges that were queued while it was up. Later calls cancel an earlier pending timer,
  // so an overwrite (word flash → "BOARD CLEAR!" in the same submit) has ONE lifetime and
  // the queue is released exactly once, when the last flash clears.
  const showFlash = useCallback((payload, ms = 2000) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashActiveRef.current = true;
    setFlash(payload);
    flashTimerRef.current = setTimeout(() => {
      flashTimerRef.current = null;
      setFlash(null);
      flashActiveRef.current = false;
      // v167: always route through drainCelebrationQueue. It no-ops if the queue is empty
      // and owns the hand-off (badges next, else release the mascot), so there is exactly
      // ONE place that decides what follows a celebration. Previously this branched here
      // AND inside the drain, which is how the mascot got orphaned on the loot/WoD path.
      drainCelebrationQueue();
    }, ms);
  }, [processBadgeQueue, drainCelebrationQueue]);

  const awardBadge = useCallback((id, extraLabel) => {
    const def = BADGE_DEFS.find(b => b.id === id);
    if (!def) return;
    // Synchronous store check + write — avoid React batching issues by using
    // localStorage as the source of truth for the deduplication check
    const currentStore = (() => {
      try { return JSON.parse(localStorage.getItem("ll_badges_v2") || "null") || { lifetime: [], weekly: {}, daily: {} }; }
      catch { return { lifetime: [], weekly: {}, daily: {} }; }
    })();
    const todayKey = getTodayKey(); const weekKey = getWeekKey();
    const lifetimeHas = (currentStore.lifetime || []).includes(id);
    const weeklyHas = (currentStore.weekly?.[weekKey] || []).includes(id);
    const dailyHas = (currentStore.daily?.[todayKey] || []).includes(id);
    let needsAward = false;
    if (def.scope === "lifetime" && !lifetimeHas) needsAward = true;
    if (def.scope === "daily" && !dailyHas) needsAward = true;
    if (def.scope === "weekly" && !weeklyHas) needsAward = true;
    if (def.scope === "all" && (!lifetimeHas || !weeklyHas || !dailyHas)) needsAward = true;
    // Apply update to localStorage and React state (only if not yet recorded)
    if (needsAward) {
      const updated = awardBadgeToStore(currentStore, id, def.scope);
      saveBadgeStore(updated);
      setBadgeStore(updated);
    }
    // BUG FIX (May 2026): Determine if this should pop a celebration.
    // Previously: only celebrated FIRST lifetime earn — silenced every replay.
    // Now: session-significant badges (rocket, long_10, perfect_day, etc.) celebrate
    // every game they're earned in. One-time milestones (first_word, points_1k, etc.)
    // keep the old behavior — only celebrate on first lifetime earn.
    // sessionBadgesShownRef prevents duplicate popups within a single game session
    // (so 3 rocket-tier words in one game = 1 popup, not 3).
    let showPopup = false;
    if (SESSION_BADGE_IDS.has(id)) {
      // Session-significant: show once per game session, every game
      if (!sessionBadgesShownRef.current.has(id)) {
        showPopup = true;
        sessionBadgesShownRef.current.add(id);
      }
    } else {
      // One-time milestone: original behavior — show only on first lifetime earn
      showPopup = !lifetimeHas || (def.scope === "daily" && !dailyHas) || (def.scope === "all" && !dailyHas);
    }
    if (showPopup) {
      // Queue for serial display
      badgeQueueRef.current.push({ id, extraLabel });
      processBadgeQueue();
    }
  }, [processBadgeQueue]);

  const flashNewRecord = useCallback((type, value, lvl) => {
    const label = type === "score" ? `🏆 New Level ${lvl} High Score: ${value.toLocaleString()} pts!` : `⚡ New Level ${lvl} Best Time: ${formatTime(value)}!`;
    setNewRecord({ type, value, level: lvl, label });
    if (type === "score") { setPulseScore(true); setTimeout(() => setPulseScore(false), 2000); }
    else { setPulseTime(true); setTimeout(() => setPulseTime(false), 2000); }
    setTimeout(() => setNewRecord(null), 2500);
  }, []);

  // v100 (item #2c): Perfect Day is a one-clean-shot-per-day challenge. Forfeiting eligibility
  // (level reset/re-do or buying a level — NOT UNDO, which is PD-safe) stamps a per-day flag so
  // that "Start New Game" (handleFullReset) can NOT restore PD eligibility for the rest of today.
  // Replays remain fully playable; they just can't yield today's Perfect Day. The flag is keyed on
  // today's date, so it goes stale automatically at the next day rollover — no cleanup needed.
  // UNDO (handleUndo) never calls this, so it never forfeits PD.
  const forfeitPerfectDay = useCallback(() => {
    setPerfectDaySync(false);
    try { localStorage.setItem("ll_pd_forfeited_today", getTodayKey()); } catch {}
  }, [setPerfectDaySync]);

  const handleFullReset = useCallback((opts = {}) => {
    cancelDeferredEndgame(); // v301 (Item 1-B)
    const skipWelcome = opts.skipWelcome === true;
    const skipReady = opts.skipReady === true; // v130: debug jump goes straight to target level's Welcome map, no Ready screen
    const rng = seededRandom(getDailySeed());
    const bp = getBonusPositions(42, getBonusCount(1), rng);
    setTiles(generateLevelTiles(1, 0, rng, bp));
    tileCountRef.current = 42; setLevel(1); setSelected([]);
    setSubmitted([]); submittedRef.current = [];
    setTotalScore(0); totalRef.current = 0;
    setLevelScore(0); levelScoreRef.current = 0;
    greatWordFiredRef.current = 0; greatWordIdxRef.current = -1; // v116 (#16): fresh game re-arms + resets Great Word rotation
    clearCelebrationQueue(); // v164: drop any celebration queued behind a flash
    setStreak(0); setShowBadge(null);
    setLevelComplete(false); setShowBuyModal(false); setShowNameInput(false);
    setShowResetConfirm(false); setShowStuckModal(false); setPaused(false);
    // v100 (item #2c): only restore Perfect Day eligibility if it has NOT already been forfeited
    // today. Once a player has reset a level / re-done / bought a level today, "Start New Game"
    // starts non-PD-eligible for the rest of the day — you get one clean shot at Perfect Day.
    const pdForfeitedToday = (() => { try { return localStorage.getItem("ll_pd_forfeited_today") === getTodayKey(); } catch { return false; } })();
    setPerfectDaySync(!pdForfeitedToday); setPerfectDayAchieved(false); longestWordTodayRef.current = ""; setLongestWordToday("");
    setShowRepeatPerfect(false); setNewBestTime(false); setFinisherBonusEarned(0);
    setUndoUsed(false); setLastValidEntry(null); setShowUndoConfirm(false);
    setBonusRetryUsed(false); setShowBonusUnsuccessful(false); setShowBonusRestart(false); setShowBonusNo(false); setBonusRestartChoice(null);
    setPerfectDayStreakBonus(0); setShowStreakBonus(false); setStreakBonusCount(1);
    levelResetCount.current = 0; levelCleanRef.current = true; clearedLevelsRef.current = {};
    // BUG FIX (May 2026): Clear session-significant badge tracking so new game
    // starts fresh — every qualifying achievement gets a celebration again.
    sessionBadgesShownRef.current = new Set();
    // ── Multi-game WoD: re-sync from localStorage on reset ──
    // Player can attempt WoD across multiple games per day until they find it.
    // Once found, it stays found (sticky). Each new game: if not yet found,
    // the reminder fires again and they have a new chance.
    try {
      const cachedWotd = getCachedWordOfTheDay();
      if (cachedWotd) {
        setWotdFound(cachedWotd.found || false);
        if (cachedWotd.found && cachedWotd.foundLevel) {
          // v300: include foundBonus — without it a relaunch showed "+1,000" for a grown find.
          setWotdFoundDetails({ level: cachedWotd.foundLevel, score: cachedWotd.foundScore, bonus: cachedWotd.foundBonus || 1000 });
        } else {
          setWotdFoundDetails(null);
        }
      }
    } catch {}
    TPROBE("FULL RESET (fresh game): BOTH clocks -> 0");
    stopTimer(); levelTimeRef.current = 0; totalTimeRef.current = 0;
    setLevelTime(0); setTotalTime(0);
    // v77 FIX: do NOT startTimer() here — this fresh-game reset routes to the Welcome/
    // Ready screen and the clock must stay frozen until the player's first tap. Arming
    // awaitingFirstTap keeps the fair-timer effect from running the clock. (This stray
    // startTimer() was the recurrent "timer moving before any taps" leak.)
    setAwaitingFirstTap(true); awaitingFirstTapRef.current = true;
    gameIndexRef.current += 1;
    clearLocalSession();
    justResetRef.current = true;
    playerActedRef.current = true; // v256 #8 Layer C: explicit new game — replays after a finished day must save
    // After reset, drop to Welcome OR directly to Ready, never both.
    // Setting both causes a double-prompt: Welcome → Let's Go → Ready → Let's Go again.
    if (skipReady) {
      // v130: debug jump — no Welcome, no Ready screen; the caller immediately fires the
      // target level's Welcome map page via handleNextLevel(false, targetLevel).
      setShowReadyScreen(false);
      setShowIntro(false);
    } else if (skipWelcome) {
      setShowReadyScreen(true);
      setShowIntro(false);
    } else {
      setShowReadyScreen(false);
      setShowIntro(true);
    }
  }, [startTimer, stopTimer, setPerfectDaySync, clearCelebrationQueue, cancelDeferredEndgame]);

  const doLevelReset = useCallback(() => {
    if (ENABLE_BONUS_LEVELS && isBonusLevel(level)) {
      if (bonusRetryUsed) return; // no more retries on bonus levels
      setBonusRetryUsed(true);
      forfeitPerfectDay();
    } else if (level === 5) {
      if (totalRef.current < 1000) return;
      totalRef.current -= 1000; setTotalScore(totalRef.current);
      forfeitPerfectDay();
    } else {
      // Any retry on levels 1-4 forfeits Perfect Day
      forfeitPerfectDay();
    }
    levelResetCount.current += 1;
    levelCleanRef.current = false; // #18b: any reset/re-do disqualifies this level's cloud time
    greatWordFiredRef.current = 0; // v116 (#16): replaying the level re-arms Great Word
    clearCelebrationQueue(); // v164: drop any celebration queued behind a flash
    setTiles(prev => prev.map(t => ({ ...t, used: false })));
    // v79 FIX: a level reset/replay must also freeze the clock until the first tap.
    // Previously this only called resetLevelTimer() (zeroed the clock) but left the
    // timer running and the gate unarmed — a source of the pre-tap timer leak.
    setSelected([]); resetLevelTimer(); stopTimer(); setAwaitingFirstTap(true); awaitingFirstTapRef.current = true; setNewBestTime(false); setFinisherBonusEarned(0);
    setShowResetConfirm(false); setShowStuckModal(false);
  }, [resetLevelTimer, stopTimer, level, forfeitPerfectDay, clearCelebrationQueue]);

  const handleUndo = useCallback(() => {
    if (undoUsed || !lastValidEntry || totalRef.current < 1000) return;
    const { word, score, tileIds, levelScoreDelta } = lastValidEntry;
    const undoCost = isBonusLevel(level) ? 10000 : 1000;
    totalRef.current -= (undoCost + score); setTotalScore(totalRef.current);
    levelScoreRef.current -= levelScoreDelta; setLevelScore(levelScoreRef.current);
    lifetimeRef.current -= score; setLifetimePoints(lifetimeRef.current);
    saveLifetimeData(lifetimeRef.current); // v306: mirror locally for ALL players
    setTiles(prev => prev.map(t => tileIds.includes(t.id) ? { ...t, used: false } : t));
    const newSubmitted = [...submittedRef.current];
    const lastIdx = [...newSubmitted].map(s=>s.word).lastIndexOf(word);
    if (lastIdx !== -1) newSubmitted.splice(lastIdx, 1);
    submittedRef.current = newSubmitted; setSubmitted(newSubmitted);
    setUndoUsed(true); setLastValidEntry(null); setShowUndoConfirm(false);
    showFlash({ word: `↩️ UNDO: ${word}`, score: 0, valid: true }, 2000);
  }, [undoUsed, lastValidEntry, isGuest, showFlash]);

  const handleNameSave = async () => {
    if (!playerName.trim()) return;
    if (containsProfanity(playerName)) {
      setNameError("Please choose a different name.");
      const last = localStorage.getItem("ll_name") || "";
      setPlayerName(last);
      playerNameRef.current = last;
      setTimeout(() => setNameError(""), 4000);
      return;
    }
    setNameError("");
    localStorage.setItem("ll_name", playerName); playerNameRef.current = playerName;
    setEditingName(false);
    if (!isGuest && user) await updatePlayerName(user.id, playerName);
  };

  // ── v223: Finishing Flourish share BLOCK. Was a flat list of repetitive lines buried in the
  // stats stack; now a rule-bounded block so v1.2's flagship feature reads as a feature.
  // Shape (Daryl's sketch, Option A):
  //     ____________________________
  //     🏴‍☠️ FINISHING FLOURISH BONUS
  //     L1 · QUARTZ · 500pts
  //     L3 · JUKEBOXES · 6,500pts
  //     ____________________________
  // Rules chosen over box-drawing chars (┏━┓): those only hold their shape in a MONOSPACE font,
  // and SMS/email render proportional — the borders would misalign, and some Android/Gmail
  // clients show tofu boxes for them. Rules render identically everywhere. Matters more with
  // Android on the roadmap.
  // The block's BOTTOM rule IS the pre-existing divider before "Check it out" — do NOT add a
  // second one in the return strings or they'll double up.
  // Header hoisted so rows don't repeat "Finishing Flourish Bonus" 5×. v224: header says
  // "BONUS" in full — v223 dropped it for width, but Daryl: the WORD isn't the point-grabber,
  // the word's LENGTH is, and "Bonus" is what names the payload. It's the feature's name; the
  // header is the one place it must appear in full. Also keeps the header consistent with the
  // no-finisher line below, which always said "Finishing Flourish Bonus". Rows show the WORD (not
  // "x letters") per Daryl — the finishing word is the brag. Score format: "500pts", no space,
  // no plus sign (Daryl, v223).
  // Both builders MUST call this — never inline it twice.
  const buildFFBlock = useCallback(() => {
    const ffEntries = submittedRef.current.filter(s => s.valid && s.finisher > 0).sort((a,b)=>a.level-b.level);
    const RULE = "____________________________";
    if (!ffEntries.length) {
      // No-finisher case: Daryl — keep the exact pre-v1.2 wording, now inside the block.
      // Trailing "~" is INTENTIONAL. Do not "fix" it.
      return `\n${RULE}\n🏴‍☠️ Finishing Flourish Bonus — Not today, but tomorrow offers great promise!~\n${RULE}`;
    }
    const rows = ffEntries.map(s => `\nL${s.level} · ${s.word} · ${s.finisher.toLocaleString()}pts`).join("");
    return `\n${RULE}\n🏴‍☠️ FINISHING FLOURISH BONUS${rows}\n${RULE}`;
  }, []);

  const getPerfectDayShareText = useCallback(() => {
    const allValid = submittedRef.current.filter(s => s.valid);
    // v222: loot words are now INCLUDED in Best/Longest. The old exclusion dated from when the
    // loot letter was HIDDEN — a shared word's score/length could have exposed it. The app now
    // REVEALS the loot letter on every level (min. 2 tiles carry it), so the secret is WHICH tile
    // is live, not which letter. A shared word can't give that away. The filter was guarding a
    // secret that no longer exists — and it was silently deleting players' best words from their
    // own share posts (player reports via Daryl). The `loot` flag stays on entries; the History
    // page still badges loot words with 💥.
    const shareableWords = allValid;
    const bestWord = shareableWords.reduce((b, s) => !b || s.score > b.score ? s : b, null);
    const longestW = shareableWords.reduce((b, s) => !b || s.word.length > b.word.length ? s : b, null);
    const sharer = playerName ? `${playerName} had a 🌈🏆 Perfect Day on LetterLoot!` : "🌈🏆 PERFECT DAY on LetterLoot!";
    const bonusLine = perfectDayStreakBonus > 0 ? `\n🌈🏆 Streak Bonus: +${perfectDayStreakBonus.toLocaleString()} pts` : "";
    const wotdLine = wotdFoundDetails ? `\n🎯 Word of the Day: ${wotd} — Found! Scored ${wotdFoundDetails.score} pts` : "";
    const timeLine = `\n⏱️ Total Time: ${formatTime(totalTimeRef.current)}`;
    // v223: FF block (rule-bounded, header + one row per level). See buildFFBlock above.
    const ffLines = buildFFBlock();
    return `${sharer}\n${getShortDate()} · Score: ${totalRef.current} pts${bonusLine}${timeLine}${wotdLine}\n📏 Longest Word: ${longestW?.word || "—"} — ${longestW?.word?.length || 0} letters\n🏆 Best Scoring Word: ${bestWord?.word || "—"} — ${bestWord?.score || 0} pts${ffLines}\nCheck it out — ${getShareUrlLabel()}\n${getShareUrl()}\n🌈🏆`;
  }, [playerName, perfectDayStreakBonus, wotd, wotdFoundDetails, buildFFBlock]);

  // Non-Perfect-Day "day's results" share (item 6, added v72). Mirrors the Perfect Day
  // builder but without the Perfect Day framing — for players who want to share their
  // progress even when they didn't get a Perfect Day. Includes levels reached, score,
  // total time, WoD status, best-scoring word, longest word. v222: loot words are INCLUDED
  // (see the note in getPerfectDayShareText — the loot letter is revealed on every level now,
  // so including a loot word leaks nothing). Both builders MUST stay identical here.
  const getDayResultsShareText = useCallback(() => {
    const allValid = submittedRef.current.filter(s => s.valid);
    const shareableWords = allValid;
    const bestWord = shareableWords.reduce((b, s) => !b || s.score > b.score ? s : b, null);
    const longestW = shareableWords.reduce((b, s) => !b || s.word.length > b.word.length ? s : b, null);
    const sharer = playerName ? `${playerName} had a Great Day on LetterLoot today!` : "My LetterLoot results today!";
    const levelsLine = `\nSuccessfully completed ${Math.min(level, 5)} of 5 levels`;
    const timeLine = `\n⏱️ Total Time: ${formatTime(totalTimeRef.current)}`;
    const wotdLine = wotdFoundDetails
      ? `\n🎯 Word of the Day: ${wotd} — Found! Scored ${wotdFoundDetails.score} pts`
      : `\n🎯 Word of the Day: not found today`;
    // v223: FF block — SAME helper as the Perfect Day builder. Never inline this twice.
    const ffLines = buildFFBlock();
    return `${sharer}\n${getShortDate()} · Score: ${totalRef.current} pts${levelsLine}${timeLine}${wotdLine}\n📏 Longest Word: ${longestW?.word || "—"} — ${longestW?.word?.length || 0} letters\n🏆 Best Scoring Word: ${bestWord?.word || "—"} — ${bestWord?.score || 0} pts${ffLines}\nGive it a try! 😊 — ${getShareUrlLabel()}\n${getShareUrl()}`;
  }, [playerName, level, wotd, wotdFoundDetails, buildFFBlock]);

  // v74 (Option A): triggerFarewell passes the precomputed day-results share text up to
  // the App-level Farewell screen, so it can offer Text/Email/Copy without needing
  // GameScreen's share machinery in scope. Placed AFTER getDayResultsShareText to avoid
  // a temporal-dead-zone reference in the useCallback dependency array.
  const triggerFarewell = useCallback(() => {
    const bestEntry = submittedRef.current.filter(s => s.valid).reduce((best, s) => !best || s.score > best.score ? s : best, null);
    // v260 #3/#5: tell the farewell whether today\u2019s PD is banked. getLocalStats() is
    // updated synchronously at award time, so this is stale-closure-proof.
    let pdBanked = false;
    try { const s = getLocalStats(); const t = getTodayKey(); pdBanked = s.lastPerfectDate === t || ((s.perfectDaysWeek || {})[t] || 0) > 0; } catch {}
    if (pdAlreadyBankedTodayRef.current) pdBanked = true;
    onFarewell({ totalScore: totalRef.current, bestWord: bestEntry?.word || "", bestWordScore: bestEntry?.score || 0, shareText: getDayResultsShareText(), perfectDay: pdBanked });
  }, [onFarewell, getDayResultsShareText]);

  // v302: Continue on the Today's Summary card — carry out what the player already chose.
  const closeDaySummary = useCallback((choice) => {
    setShowDaySummary(false);
    const next = choice || afterSummaryRef.current; afterSummaryRef.current = "farewell"; // v303: button passes its own choice
    if (next === "now") { handleFullReset({ skipWelcome: true }); }
    else { setLevelComplete(false); triggerFarewell(); }
  }, [handleFullReset, triggerFarewell]);

  // Unified share helper (added May 25, 2026): opens the iOS native Share Sheet
  // via the Capacitor Share plugin (iMessage, Mail, Twitter/X, Notes, Copy, etc.).
  // Falls back to web Share API, then to clipboard if neither is available.
  // navigator.clipboard.writeText() previously failed silently inside the
  // Capacitor WebView because the capacitor:// scheme isn't a "secure context"
  // for the Clipboard API — that's why "Share Perfect Day" was doing nothing.
  // Custom Share Menu approach (v54 May 25, 2026): instead of Capacitor's
  // native iOS share sheet (which on simulator showed only Reminders/Copy/Save
  // to Files and on real devices is a moving target depending on what apps
  // the user has installed), present a custom 3-button menu with reliable
  // channel-specific actions: Text Message (sms:), Email (mailto:), Copy
  // (Capacitor Clipboard plugin). The Clipboard plugin is used because
  // navigator.clipboard.writeText silently fails in the Capacitor WebView
  // (capacitor:// scheme isn't a "secure context" for Web Clipboard API).
  const sharePerfectDay = useCallback(() => {
    setShareMode("perfect");
    setShowShareMenu(true);
  }, []);

  // v72: open the share menu for a non-Perfect-Day day's-results share (item 6).
  const shareDayResults = useCallback(() => {
    setShareMode("results");
    setShowShareMenu(true);
  }, []);

  // Pick the active text-builder based on which share was opened.
  const getActiveShareText = useCallback(() => {
    return shareMode === "results" ? getDayResultsShareText() : getPerfectDayShareText();
  }, [shareMode, getDayResultsShareText, getPerfectDayShareText]);

  // Share menu handlers — each does one thing reliably.
  const shareViaTextMessage = useCallback(() => {
    const text = getActiveShareText();
    // sms: URL with body. iOS Messages opens with body pre-filled, user picks recipient.
    // Note: spec says use &body= (after the SMS number) but iOS also accepts ?body= for no-recipient.
    const url = `sms:&body=${encodeURIComponent(text)}`;
    window.location.href = url;
    setShowShareMenu(false);
  }, [getActiveShareText]);

  const shareViaEmail = useCallback(() => {
    const text = getActiveShareText();
    const subject = shareMode === "results" ? "My LetterLoot results today" : "My Perfect Day on LetterLoot";
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.location.href = url;
    setShowShareMenu(false);
  }, [getActiveShareText, shareMode]);

  const shareViaCopy = useCallback(async () => {
    const text = getActiveShareText();
    try {
      // Capacitor Clipboard plugin — reliable in WebView, unlike navigator.clipboard.
      await Clipboard.write({ string: text });
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 4000);
    } catch (e) {
      // Fallback to navigator.clipboard (probably won't work in Capacitor WebView,
      // but might work if someone runs the app in browser for testing).
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          setShareCopied(true);
          setTimeout(() => setShareCopied(false), 4000);
        }
      } catch (e2) {
        alert("Copy failed. Please try Text Message or Email instead.");
      }
    }
    setShowShareMenu(false);
  }, [getActiveShareText]);

  // v72: shared render for the Text/Email/Copy share menu, used by both the in-game
  // Perfect Day flow and the Farewell-screen "Share My Results" flow. Title adapts to shareMode.
  const renderShareMenu = () => {
    const title = shareMode === "results" ? "Share Your Results" : "Share Your Perfect Day";
    const subtitle = shareMode === "results" ? "Choose how to share your day" : "Choose how to share your accomplishment";
    return (
      <div style={{position:"fixed",inset:0,zIndex:99999,background:"rgba(0,0,0,0.78)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}} onClick={()=>setShowShareMenu(false)}>
        <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:20,padding:`${ipadTour(24)}px ${ipadTour(20)}px`,border:"2px solid rgba(246,211,101,0.5)",fontFamily:"Georgia,serif",color:"#f5f0e8",maxWidth:ipadTour(340),width:"100%",textAlign:"center"}}>
          <div style={{fontSize:ipadTour(20),fontWeight:"bold",color:"#f6d365",marginBottom:6,letterSpacing:1}}>{title}</div>
          <div style={{fontSize:ipadTour(11),color:"rgba(255,255,255,0.65)",marginBottom:ipadTour(20)}}>{subtitle}</div>
          <button onClick={shareViaTextMessage} style={{width:"100%",padding:`${ipadTour(14)}px ${ipadTour(16)}px`,marginBottom:ipadTour(10),borderRadius:12,background:"linear-gradient(135deg,#34d399,#10b981)",color:"#003322",fontSize:ipadTour(15),fontWeight:"bold",fontFamily:"Georgia,serif",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            💬 Text Message
          </button>
          <button onClick={shareViaEmail} style={{width:"100%",padding:`${ipadTour(14)}px ${ipadTour(16)}px`,marginBottom:ipadTour(10),borderRadius:12,background:"linear-gradient(135deg,#60a5fa,#3b82f6)",color:"#fff",fontSize:ipadTour(15),fontWeight:"bold",fontFamily:"Georgia,serif",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            ✉️ Email
          </button>
          <button onClick={shareViaCopy} style={{width:"100%",padding:`${ipadTour(14)}px ${ipadTour(16)}px`,marginBottom:ipadTour(14),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(15),fontWeight:"bold",fontFamily:"Georgia,serif",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            📋 Copy
          </button>
          <div style={{fontSize:ipadTour(10),color:"rgba(255,255,255,0.45)",marginBottom:ipadTour(14),fontStyle:"italic"}}>Copy works for Twitter, Facebook, Notes, and anywhere else you want to paste.</div>
          <button onClick={()=>setShowShareMenu(false)} style={{width:"100%",padding:`${ipadTour(10)}px ${ipadTour(14)}px`,borderRadius:11,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.85)",fontSize:ipadTour(13),fontFamily:"Georgia,serif",cursor:"pointer"}}>
            ← Cancel
          </button>
        </div>
      </div>
    );
  };

  const fetchLeaderboard = async () => {
    try {
      const base = `${import.meta.env.VITE_SUPABASE_URL || "https://zcevszxmoggmcmvyxjtn.supabase.co"}/rest/v1`;
      const hdrs = { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZXZzenhtb2dnbWNtdnl4anRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDExNDIsImV4cCI6MjA5MTE3NzE0Mn0.nZhiDxv5ssCrkHXxaboZ5ziH-M4NqNqPMop2s_gA6NM", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZXZzenhtb2dnbWNtdnl4anRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDExNDIsImV4cCI6MjA5MTE3NzE0Mn0.nZhiDxv5ssCrkHXxaboZ5ziH-M4NqNqPMop2s_gA6NM"}` };
      const fetchWithAbort = (url) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        return fetch(url, { headers:hdrs, signal:ctrl.signal }).finally(() => clearTimeout(timer));
      };
      // weekSessions: fetch all, filter client-side using numeric date comparison
      // (server-side date_key=gte is unreliable due to lexicographic comparison
      // bugs e.g. "2026-5-10" < "2026-5-3")
      const [gsRes, todayRes, weekRes, wotdAllRes, allWordSessionsRes, ffWordsRes] = await Promise.all([
        fetchWithAbort(`${base}/game_state?select=player_id,player_name,lifetime_points,current_streak,longest_streak,stats,badges&order=lifetime_points.desc&limit=100`),
        fetchWithAbort(`${base}/daily_sessions?select=player_id,date_key,total_score,perfect_day,longest_word_today,wotd_found,top_word,top_word_score&date_key=eq.${(()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();})()}&limit=100`),
        fetchWithAbort(`${base}/daily_sessions?select=player_id,date_key,total_score,perfect_day,wotd_found,longest_word_today,top_word,top_word_score&limit=2000`),
        fetchWithAbort(`${base}/daily_sessions?select=player_id,date_key,wotd_found&wotd_found=eq.true&limit=2000`),
        fetchWithAbort(`${base}/daily_sessions?select=player_id,date_key,longest_word_today,top_word,top_word_score&limit=2000`),
        // v291: Flourish board feed — longest board-clearing words (ff_words, written in v287).
        // Server-sorted length desc, created_at asc (Daryl's tie-break ruling, Aug 21).
        fetchWithAbort(`${base}/ff_words?select=player_id,date_key,level,word,length,score,created_at&order=length.desc,created_at.asc&limit=500`),
      ]);
      const gsRaw = gsRes.ok ? await gsRes.json() : [];
      // v59: Filter out Guest entries from the leaderboard. Per spec, Guest
      // players never appear in rankings. Belt-and-suspenders: syncToCloud
      // already returns early for Guests so no NEW Guest data writes, but
      // leftover cloud rows with name="Guest" from before this guard or
      // from old development data need to be filtered client-side too.
      const gs = gsRaw.filter(g => {
        const name = (g.player_name || "").trim().toLowerCase();
        return name !== "guest" && name !== "";
      });
      const todaySessions = todayRes.ok ? await todayRes.json() : [];
      // Filter weekSessions client-side using numeric date comparison
      const weekAgoNum = (() => { const d = new Date(Date.now() - 7*86400000); return d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate(); })();
      const allWeekRaw = weekRes.ok ? await weekRes.json() : [];
      const weekSessions = allWeekRaw.filter(s => dateKeyToNum(s.date_key) >= weekAgoNum);
      const wotdAllSessions = wotdAllRes.ok ? await wotdAllRes.json() : [];
      const allWordSessions = allWordSessionsRes.ok ? await allWordSessionsRes.json() : [];
      const ffWords = ffWordsRes.ok ? await ffWordsRes.json() : [];
      return { gs, todaySessions, weekSessions, wotdAllSessions, allWordSessions, ffWords };
    } catch { return null; }
  };

  // #18b: Cloud Time Leaderboard fetch. Pulls the whole best_times table (one row per
  // player per slot: '1'..'5' or 'perfect'), groups by slot, sorts ascending (fastest
  // first), and slices top-5 per level + top-10 perfect. All-time only by nature of the
  // table (upsert-on-improve keeps a single best-ever row per player/slot). Mirrors the
  // fetchLeaderboard REST/abort pattern. Guests never reach this (leaderboard screen is
  // registered-only), but RLS also blocks unauthenticated reads as belt-and-suspenders.
  const fetchTimeLeaderboard = async () => {
    try {
      const base = `${import.meta.env.VITE_SUPABASE_URL || "https://zcevszxmoggmcmvyxjtn.supabase.co"}/rest/v1`;
      const hdrs = { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZXZzenhtb2dnbWNtdnl4anRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDExNDIsImV4cCI6MjA5MTE3NzE0Mn0.nZhiDxv5ssCrkHXxaboZ5ziH-M4NqNqPMop2s_gA6NM", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZXZzenhtb2dnbWNtdnl4anRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDExNDIsImV4cCI6MjA5MTE3NzE0Mn0.nZhiDxv5ssCrkHXxaboZ5ziH-M4NqNqPMop2s_gA6NM"}` };
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${base}/best_times?select=player_id,player_name,slot,seconds,date&limit=2000`, { headers: hdrs, signal: ctrl.signal }).finally(() => clearTimeout(timer));
      if (!res.ok) return null; // v259 #10b: a REJECTED response is a failure, not "no times yet" - surface the honest could-not-load message instead of an empty board (#6 principle: never report OUR failure as THEIR absence)
      const rows = await res.json();
      // Filter out any blank/Guest names defensively (mirrors the score board's guard).
      const clean = rows.filter(r => {
        const n = (r.player_name || "").trim().toLowerCase();
        return n !== "" && n !== "guest";
      });
      const levels = { "1": [], "2": [], "3": [], "4": [], "5": [] };
      const perfect = [];
      clean.forEach(r => {
        const entry = { name: r.player_name, seconds: r.seconds, date: r.date || "" };
        if (r.slot === "perfect") perfect.push(entry);
        else if (levels[r.slot]) levels[r.slot].push(entry);
      });
      [1,2,3,4,5].forEach(l => {
        levels[l].sort((a,b) => a.seconds - b.seconds);
        levels[l] = levels[l].slice(0, 5);
      });
      perfect.sort((a,b) => a.seconds - b.seconds);
      return { levels, perfect: perfect.slice(0, 10) };
    } catch { return null; }
  };

  const handlePhotoChange = async () => {
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        width: 400,
        height: 400,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        promptLabelHeader: 'Profile Photo',
        promptLabelPhoto: 'Choose from Library',
        promptLabelPicture: 'Take Photo',
      });
      const dataUrl = photo.dataUrl;
      if (!dataUrl) return;
      setProfilePhoto(dataUrl);
      localStorage.setItem('ll_photo', dataUrl);
      // Sync to Supabase if signed in
      if (!isGuest && user) savePlayerPhoto(user.id, dataUrl);
    } catch (err) {
      // User cancelled or denied permission — silent fail, no crash
      return;
    }
  };
  const handleNicknameSave = async (val) => {
    if (containsProfanity(val)) {
      setNameError("Please choose a different nickname.");
      // Revert to last clean value from localStorage
      const last = localStorage.getItem("ll_nickname") || "";
      setProfileNickname(last);
      setTimeout(() => setNameError(""), 4000);
      return false;
    }
    setNameError("");
    const clean = (val || "").trim();
    setProfileNickname(clean);
    localStorage.setItem("ll_nickname", clean);
    // v70: the nickname IS the public leaderboard display name. For signed-in
    // users, push it to the cloud player_name (used by the leaderboard) and update
    // the local refs so subsequent syncs carry it. Guests have no cloud row to update.
    if (!isGuest && user && clean) {
      playerNameRef.current = clean;
      setPlayerName(clean);
      try { await updatePlayerName(user.id, clean); } catch {}
      try { await syncToCloud(); } catch {}
    }
    return true;
  };

  const handleSubmit = async () => {
    if (currentWord.length < 3 || validating || paused) return;
    if (!online) { showFlash({ word: "No internet connection!", score: 0, valid: false }, 2000); return; }
    playerActedRef.current = true; // v256 #8 Layer C: real play this session — the settled-day sync guard lifts
    setValidating(true);
    // Hard safety timeout — if validation hangs for any reason, force-clear after 15s
    const safetyTimer = setTimeout(() => {
      setValidating(false);
      showFlash({ word: "Connection slow — try again", score: 0, valid: false }, 2000);
    }, 15000);
    let result;
    try {
      result = await validateWord(currentWord);
    } catch(e) {
      clearTimeout(safetyTimer);
      setValidating(false);
      return;
    }
    clearTimeout(safetyTimer);
    if (result.source === "timeout" || result.valid === null) {
      // v261 #6: OUR failure, not their word. Attempt is NOT consumed — no rejection recorded,
      // no streak reset, and the tiles stay selected so Submit retries the same word instantly.
      showFlash({ word: "\uD83D\uDCE1 Can't reach the dictionary \u2014 please check connection", score: 0, valid: false, lookupFail: true }, 3000);
      setValidating(false); return;
    }
    const valid = result.valid;
    const isMedical = result.source === "medical";
    const isCollegiate = result.source === "collegiate";
    // ── Dragon badge tracking: 100 valid words in a row, resets on misspelling ──
    if (currentWord.length >= 3) {
      if (valid) {
        const dStats = getLocalStats();
        const newCount = (dStats.consecutiveValidWords || 0) + 1;
        dStats.consecutiveValidWords = newCount;
        saveLocalStats(dStats);
        if (newCount >= 100) awardBadge("all_time_100");
      } else {
        // Misspelling resets the streak
        const dStats = getLocalStats();
        dStats.consecutiveValidWords = 0;
        saveLocalStats(dStats);
      }
    }
    const baseScore = valid ? currentScoreReal : 0; // v109: real score (5x loot applied) — display used the hidden value
    const longBonus = valid ? getLongWordBonus(currentWord.length) : 0;
    const score = baseScore + longBonus;
    const newStreak = valid ? streak + 1 : 0;
    setStreak(newStreak);
    let flashMsg = currentWord;
    if (valid && longBonus > 0) flashMsg = `${currentWord}  +${longBonus} bonus!`;
    showFlash({ word: flashMsg, score, valid, medical: isMedical, collegiate: isCollegiate }, 2000);
    if (valid) {
      triggerHaptic("medium");
    } else {
      triggerHaptic("light");
      setShake(true); setTimeout(() => setShake(false), 500);
      // Word reporting moved to History page — no in-game popup
    }
    // Detect Loot Letter use early (before history append) so we can flag it
    // Loot detection: must be selected, must be the loot tile, must be unused,
    // AND must not have been used previously in this game (lootUsed flag persists across replays)
    const usedLootTile = valid ? tiles.find(t => selected.includes(t.id) && t.isLoot && !t.used && !t.lootUsed) : null;
    const isLootWord = !!usedLootTile;
    // v88 (item 17): flag the Word of the Day in History so it gets its own badge,
    // parallel to the Loot Letter. Only the FIRST time the WoD is found counts (matches
    // the wotdFound award gate below), so re-submitting the same word later isn't re-badged.
    // v299 (Malleable WoD rule A): root-stem match — see wotdRoot()/isWotdMatch() by the WoD
    // cache helpers. v298's strict containment missed SURPRISING/UNSURPRISING (no "ED" block).
    const isWotdWord = !!(valid && wotd && !wotdFound && isWotdMatch(currentWord, wotd));
    // v202 (Finishing Flourish share, step 3, Option A): tag each entry with the LEVEL it was played
    // on and a FINISHER field (points earned if this word cleared the board, else 0). `finisher`
    // starts at 0 here because the real value isn't computed until the board-clear block below;
    // that block back-fills this same entry (it's the last in submittedRef). The "Share My Results"
    // builders read these off submittedRef — which already persists/restores with the session — so
    // no separate day-level ref/reset plumbing is needed.
    const newEntry = { word: currentWord, score, valid, medical: isMedical, collegiate: isCollegiate, likelyValid: result.likelyValid || false, loot: isLootWord, wotd: isWotdWord, level, finisher: 0 };
    const newSubmitted = [...submittedRef.current, newEntry];
    submittedRef.current = newSubmitted; setSubmitted(newSubmitted);
    appendToDailyHistory(currentWord, score, valid, isMedical, isCollegiate, gameIndexRef.current, isLootWord, isWotdWord);
    setDailyHistory(getDailyHistory());
    // Track guest games — fire once per session (when first word is submitted)
    if (isGuest && submittedRef.current.length === 1) {
      try { supabase.rpc('increment_guest_plays').catch(()=>{}); } catch(e) {}
    }

    if (valid) {
      const newTotal = totalRef.current + score;
      totalRef.current = newTotal; setTotalScore(newTotal);
      const newLevelScore = levelScoreRef.current + score;
      levelScoreRef.current = newLevelScore; setLevelScore(newLevelScore);
      const newLifetime = lifetimeRef.current + score;
      lifetimeRef.current = newLifetime; setLifetimePoints(newLifetime);
      saveLifetimeData(newLifetime); // v306: mirror locally for ALL players
      // ── Word of the Day check (v299 Malleable WoD rule A) — root-stem match, once per day.
      // Bonus: 1,000 base + 200 per letter beyond the LISTED WoD's length (Daryl, Aug 23). ──
      if (wotd && !wotdFound && isWotdMatch(currentWord, wotd)) {
        const bonus = 1000 + 200 * Math.max(0, currentWord.length - wotd.length);
        setWotdFound(true);
        setWotdFoundDetails({ level, score, bonus });
        markWordOfTheDayFound(level, score, bonus);
        totalRef.current += bonus; setTotalScore(totalRef.current);
        lifetimeRef.current += bonus; setLifetimePoints(lifetimeRef.current);
        saveLifetimeData(lifetimeRef.current); // v306: mirror locally for ALL players
        // Trigger celebration
        // v164: enqueued, not fired directly. enqueueCelebration() stops the clock now and
        // the drain runs it after the flash clears. Confetti + guarded resume live in the drain.
        enqueueCelebration("wotd", { bonus, grew: currentWord.length > wotd.length }, 8000); // v172: 4s -> 8s (Daryl). v300: bonus + grew flag for the saying.
      }
      const newTiles = tiles.map(t => {
        if (!selected.includes(t.id)) return t;
        // Mark used; if this was the loot letter, also flag lootUsed for persistent styling
        return t.isLoot ? { ...t, used: true, lootUsed: true } : { ...t, used: true };
      });
      // ── Loot Letter detection (already determined above as usedLootTile) ──
      if (usedLootTile) {
        // v178 CO-FIRE RULE (Daryl, July 12 — supersedes the July03e "Loot WINS" lock):
        // a loot word that ALSO clears the Great Word threshold now fires BOTH celebrations.
        // The old rule suppressed Great Word to avoid two overlays stacking — but the v164
        // celebration QUEUE already serializes celebrations 400ms apart, so stacking is no
        // longer a risk, and suppressing a reward the player earned works against the goal of
        // always making the game fun and rewarding. Order is B1: Loot FIRST, then Great Word
        // (this branch enqueues before the Great Word branch below; the queue drains in
        // enqueue order). We deliberately do NOT set greatWordFiredRef here anymore — the
        // Great Word branch sets its own once-per-level guard when it fires.
        // Fire celebration: popup, haptic, sound (no confetti per spec)
        // v164: enqueued. The haptic + slot-machine chime ride along in onShow so they
        // land WITH the overlay, not 2s early under the flash.
        enqueueCelebration("loot", { word: currentWord, score, letter: usedLootTile.letter }, 4000);
      }
      // ── v116 (#16): GREAT WORD moment ──────────────────────────────────────────
      // Fires when a SINGLE submitted word's score meets the per-level threshold, once per
      // level, gated behind the mascot toggle. v178: a loot word CAN now also fire Great Word
      // (co-fire — see the loot branch above); the `!isLootWord` suppression was removed.
      //
      // v164 (v1.2 #7): use `score` (= currentScoreReal + longBonus), NOT currentScoreReal.
      // The bubble previously interpolated the BASE score while the green flash showed
      // base+bonus — so an 11-letter word read "+128 worth o' plunder" under a "+138 pts"
      // banner. Daryl's call (July 9): the bonus counts for BOTH the displayed number and
      // for QUALIFYING. In practice qualification is unchanged — an 8+ letter word scoring
      // under its level threshold on base alone is effectively unreachable.
      if (
        greatWordFiredRef.current !== level &&
        showMascotCelebrations() &&
        score >= (GREAT_WORD_THRESH[level] || 40)
      ) {
        greatWordFiredRef.current = level;
        greatWordIdxRef.current = greatWordIdxRef.current + 1;
        const gwLine = pickGreatWordSaying(greatWordIdxRef.current).replace("[score]", String(score));
        // v164: enqueued; haptic rides along in the drain so it lands with the overlay.
        enqueueCelebration("greatWord", { line: gwLine }, 5000); // v117: Great Word dwell 5s
      }
      setTiles(newTiles);
      setLastValidEntry({ word: currentWord, score, tileIds: [...selected], levelScoreDelta: score });
      const ats = getAllTimeStats(); ats.words += 1; ats.score += score; saveAllTimeStats(ats);
      const currentBest = statsData.bestScorePerLevel?.[String(level)];
      if (!currentBest || newLevelScore > currentBest.score) flashNewRecord("score", newLevelScore, level);
      const updated = updateLocalStats({
        score: newTotal, wordScore: score, word: currentWord, source: result.source,
        ...(longBonus > 0 ? { longWordBonus: longBonus, wordLength: currentWord.length } : {}),
        levelScore: newLevelScore, levelNum: level,
        ...(score > 200 ? { infinityScore: score } : {}),
      });
      setStatsData(updated);
      if (currentWord.length > (longestWordTodayRef.current.length||0)) { longestWordTodayRef.current = currentWord; setLongestWordToday(currentWord); } // v259 #10a: ref updates synchronously so the game-ending FF word is never missed by the completion sync
      if (currentWord.length > (longestWordAllTime.length||0)) { setLongestWordAllTime(currentWord); localStorage.setItem("ll_longest", currentWord); }
      if (isMedical) awardBadge("medical_word");
      const validCount = newSubmitted.filter(s => s.valid).length;
      // Space badge ladder — update date on each earn
      if (score >= 100) { awardBadge("rocket"); updateLocalStats({ spaceBadge: "rocket" }); }
      if (score >= 125) { awardBadge("shuttle"); updateLocalStats({ spaceBadge: "shuttle" }); }
      if (score >= 150) { awardBadge("moon"); updateLocalStats({ spaceBadge: "moon" }); }
      if (score >= 175) { awardBadge("mars"); updateLocalStats({ spaceBadge: "mars" }); }
      if (score > 200) { awardBadge("infinity", `${score} pts!`); updateLocalStats({ spaceBadge: "infinity", infinityScore: score }); }
      if (currentWord.length >= 8) awardBadge("long_8");
      if (currentWord.length >= 10) awardBadge("long_10");
      if (currentWord.length >= 13) awardBadge("long_13");
      if (currentWord.toUpperCase().includes("Q") && currentWord.length >= 8) awardBadge("perfect_q");
      if (newLifetime >= 1000) awardBadge("points_1k");
      if (newLifetime >= 5000) awardBadge("points_5k");
      if (newLifetime >= 10000) awardBadge("points_10k");
      if (newLifetime >= 100000) awardBadge("points_100k");
      if (newLifetime >= 1000000) awardBadge("points_1m");
      if (updated.currentStreak >= 7) awardBadge("streak_7");
      if (updated.currentStreak >= 30) awardBadge("streak_30");
      const allUsed = newTiles.every(t => t.used);
      if (allUsed) {
        const bonus = 100 * level;
        totalRef.current += bonus; setTotalScore(totalRef.current);
        levelScoreRef.current += bonus; setLevelScore(levelScoreRef.current);
        lifetimeRef.current += bonus; setLifetimePoints(lifetimeRef.current);
        saveLifetimeData(lifetimeRef.current); // v306: mirror locally for ALL players
        // ── v186 Finisher SCORING (real) ──────────────────────────────────────────
        // The word that cleared the board earns a length-scaled finisher bonus that STACKS
        // on top of the level-clear bonus just applied (decision #2), and coexists with any
        // long-word / Great Word bonuses already counted this word (decision #3 — all stack).
        // Sub-5 clears earn 0 (decision #4). Applied the SAME three ways as the level-clear
        // bonus (total, levelScore, lifetime; guests persist lifetime) so it's a real,
        // persisted score. Celebration/animation is a SEPARATE later step — none here yet.
        const finisher = finisherBonus(currentWord.length);
        setFinisherBonusEarned(finisher);
        if (finisher > 0) {
          totalRef.current += finisher; setTotalScore(totalRef.current);
          levelScoreRef.current += finisher; setLevelScore(levelScoreRef.current);
          lifetimeRef.current += finisher; setLifetimePoints(lifetimeRef.current);
          saveLifetimeData(lifetimeRef.current); // v306: mirror locally for ALL players
          // v202 (share step 3): back-fill the finisher onto THIS word's entry (the last one
          // pushed to submittedRef just above), so the "Share My Results" builders can list it.
          const _last = submittedRef.current[submittedRef.current.length - 1];
          if (_last && _last.word === currentWord) _last.finisher = finisher;
          // v302: local FF log (30 days, guests included) + drop the STATS cloud cache so it refetches.
          appendFFLog({ date: getTodayKey(), game: gameIndexRef.current || 0, level, word: currentWord, score: finisher, ts: Date.now() });
          setMyFFCloud(null);
          // v285: Longest Flourish board feed. Signed-in players only (guests have no
          // player_id; board banner says "Registered players only"). Fire-and-forget —
          // a failed insert must never touch the game. Ties resolved on the board by
          // created_at asc (Daryl's ruling, Aug 21).
          if (!isGuest && user?.id) {
            supabase.from("ff_words").insert({ player_id: user.id, date_key: getTodayKey(), level, word: currentWord.toLowerCase(), length: currentWord.length, score: finisher })
              .then(({ error }) => { if (error && DEBUG_MODE) console.warn("[FF_WORDS] insert failed", error.message); })
              .catch(e => { if (DEBUG_MODE) console.warn("[FF_WORDS] insert threw", e?.message); });
          }
        }
        // ── v198 Finisher step 4: DEFERRED VISIBLE LEVEL-CLEAR SEQUENCE ──────────────
        // Everything the player SEES for a board clear — the BOARD CLEAR! flash, confetti,
        // speed/No-Retreat badges, New-Best-Time flash, level-advance card, and the entire
        // L5 endgame (Perfect Day / streak / bonus-unlock / farewell) — is collected here as
        // one closure. On a FINISHER clear it runs AFTER the FinisherOverlay is dismissed (so
        // the FF celebration plays first, then the Level-Clear screen the player already knows,
        // intact). On a sub-5 clear it runs INLINE immediately — byte-identical to pre-v198.
        // Scoring/refs above already ran; only the visible presentation is gated. syncToCloud
        // stays at the tail, unchanged.
        const runBoardClearSequence = async () => {
        showFlash({ word: "BOARD CLEAR!", score: bonus, valid: true }, 2000);
        setConfetti(true); setTimeout(() => setConfetti(false), 4000);
        triggerHaptic("heavy");
        stopTimer();
        const clearedTime = levelTimeRef.current;
        const clearedLevelScore = levelScoreRef.current;
        clearedLevelsRef.current[level] = clearedTime;
        // ── Speed badges (lifetime, first qualifying level) ──
        if (clearedTime < 90) awardBadge("ferrari");
        else if (clearedTime < 120) awardBadge("speed_demon");
        else if (clearedTime < 180) awardBadge("left_lane");
        else if (clearedTime < 300) awardBadge("slow_lane");
        // ── No Retreat — clear without resets, replays, or bought levels (UNDO is OK) ──
        if (perfectDayRef.current) awardBadge("no_retreat");
        // ── Item 16 (v184): "⚡ New Best Time!" must match the "Best:" line shown on the
        // card. That line (see render ~6375) displays the CLOUD all-time best for this level:
        // timeLeaderboard.levels[level][0].seconds. Previously the banner compared only the
        // LOCAL personal best (statsData.fastestLevels), so it could fire on a 00:49 run while
        // the card showed a faster cloud Best of 00:48 — a contradiction. Daryl's intent
        // (Option B1): the banner means "you beat the all-time best per level shown on the
        // card." So:
        //   - If a cloud best EXISTS for this level → fire only if clearedTime strictly beats
        //     it (clearedTime < shown best). This guarantees the banner never contradicts the
        //     visible "Best:" line.
        //   - If NO cloud best exists (guest sessions never fetch the leaderboard; also
        //     first-ever clear, or fetch not yet loaded/failed) → there is no "Best:" line to
        //     contradict, so fall back to the LOCAL personal-best test, so guests and
        //     first-timers are still rewarded (Daryl: even unregistered guests should enjoy it).
        const existingTime = statsData.fastestLevels?.[String(level)];
        const existingSecs = existingTime ? existingTime.seconds : null;
        const cloudBestArr = timeLeaderboard?.levels?.[level];
        const cloudBestSecs = (cloudBestArr && cloudBestArr.length > 0) ? cloudBestArr[0].seconds : null;
        const isNewTimeRecord = (cloudBestSecs !== null)
          ? (clearedTime < cloudBestSecs)                          // beat the shown all-time best
          : (existingSecs === null || clearedTime < existingSecs); // no cloud best shown → local PB fallback
        if (isNewTimeRecord) setNewBestTime(true);
        const updatedStats = updateLocalStats({ levelTime: clearedTime, levelNum: level, score: totalRef.current, levelScore: clearedLevelScore });
        setStatsData(updatedStats);
        const updatedTimes = addLocalLevelTime(playerName||"You", level, clearedTime);
        setTimeLeaderboard(updatedTimes);
        // #18b: Cloud Time Leaderboard — registered-only, clean-clear only (no reset/re-do/buy
        // on this level; UNDO is OK). saveBestTime upserts-on-improve, so it's safe to call every
        // clean clear. Fire-and-forget; failures never block gameplay.
        if (!isGuest && user && levelCleanRef.current) {
          saveBestTime(user.id, playerName || "", String(level), clearedTime).catch(() => {});
        }
        if (isNewTimeRecord) setTimeout(() => flashNewRecord("time", clearedTime, level), 1500);
        if (level < 5) {
          // v108: advance the A-hybrid rotation once per genuine clear + capture
          // the line to show (captured here so re-renders/re-shows don't advance it).
          clearSayingIdxRef.current = clearSayingIdxRef.current + 1;
          setClearSayingText(pickClearSaying(level, clearSayingIdxRef.current));
          setTimeout(() => setLevelComplete(true), 1200);
        } else {
          localStorage.setItem("ll_completed_today", getTodayKey());
          // v241 Bug-B FIX: Level 5 completion must set levelComplete=true, exactly as levels 1–4
          // do (see the `if (level < 5)` branch above). Without this, a finished L5 game — including
          // a Finishing-Flourish clear that leaves tiles on the board — was saved to ll_session with
          // levelComplete:false, so the same-day restore treated it as in-progress and dropped the
          // player back onto the finished board (re-awarding points). Setting it true here makes the
          // save guard and the restore path both recognise the game as done and route to the
          // Perfect Day / Play Again summary instead. Set the ref immediately too, so the
          // visibilitychange save guard (which reads the ref) is correct without a one-render gap.
          setLevelComplete(true);
          levelCompleteRef.current = true;
          // v241 Bug-B FIX (part 2 — the core fix): clear the stale ll_session. On a Finishing
          // Flourish the board IS fully cleared (all tiles used), but the completion sequence is
          // deferred up to 10s behind the finisher overlay. The empty-board save is blocked by the
          // dead-board guard, so the save that REMAINS in storage is the one from just BEFORE the
          // final word — when the FF's letters were still unused. Nothing overwrote or cleared it,
          // so on same-day re-open that pre-final-word snapshot restores and the already-used FF
          // letters RE-APPEAR on an L5 board. Clearing the session here removes that snapshot so
          // there is nothing to resurrect. The Play Again / Perfect Day summary reads
          // ll_completed_today, not ll_session, so nothing is lost.
          clearLocalSession();
          // ── Game completion badges ──
          awardBadge("first_word"); // First Loot — first complete game
          awardBadge("level_5"); // Diamond Looter — completed Level 5
          if (totalRef.current >= 2000) awardBadge("daily_500"); // Loot Master
          if (totalRef.current >= 3000) awardBadge("daily_1000"); // Treasure Chest
          if (perfectDayRef.current && wotdFoundRef.current) {
            // Force-clear any stuck validation/scanning overlays
            setValidating(false); setCheckingStuck(false);
            awardBadge("perfect_day");
            // ── Perfect Day Speed Badges (totalTimeRef in seconds) ──
            const pdSec = totalTimeRef.current || 0;
            if (pdSec > 0 && pdSec < 1800) awardBadge("pd_dawdler");      // < 30 min
            if (pdSec > 0 && pdSec < 900)  awardBadge("pd_scooter");      // < 15 min
            if (pdSec > 0 && pdSec < 720)  awardBadge("pd_velocirap");    // < 12 min
            if (pdSec > 0 && pdSec < 600)  awardBadge("pd_flux");         // < 10 min
              // ── Streak bonus: First PD = 2,000 pts, each consecutive PD adds 1,000 ──
              // v57: Guests do NOT accumulate streak bonuses. They see the +2000
              // PD bonus on the regular PD modal, but no streak tracking, no
              // streak modal, no point pile-up. Sign-in is required for streaks.
              // (Guests see a one-time upsell popup explaining this — see
              // markPDAcknowledged at line ~2647.)
              if (!isGuest) {
                // Read FRESH stats from localStorage (statsData state may be stale)
                const freshStats = getLocalStats();
                const yKey = getYesterdayKey();
                const wasPDYesterday = freshStats.lastPerfectDate === yKey;
                const alreadyPDToday = freshStats.lastPerfectDate === getTodayKey() || pdAlreadyBankedTodayRef.current === true;
                // If already PD today (replay): keep existing streak. Else if yesterday: increment. Else: reset to 1.
                const newStreakCount = alreadyPDToday
                  ? (freshStats.consecutivePerfectDays || 1)
                  : (wasPDYesterday ? (freshStats.consecutivePerfectDays || 0) + 1 : 1);
                const perfStreak = newStreakCount;
                const streakBonus = 1000 + (perfStreak * 1000);
                // v249 DOUBLE-PAY FIX (supersedes v248's local-only guard): a Perfect Day is a
                // once-per-day, per-ACCOUNT achievement. v248 guarded on alreadyPDToday alone —
                // local stats only — which failed across devices: PD on the phone, then a same-day
                // PD on the iPad paid the bonus a SECOND time (+15,000) and pushed the streak
                // 13→14, because the iPad's local stats had no record of the phone's PD. We now
                // OR in pdAlreadyBankedTodayRef, which is raised at init from the merged
                // cloud+local stats AND from today's cloud daily_sessions perfect_day flag — so
                // the account-level truth applies on whatever device is playing, as long as the
                // player is signed in. (This whole block is already !isGuest.) On a repeat we skip
                // the payout AND the streak modal — showing "+15,000" while awarding 0 would be
                // its own bug. The Perfect Day celebration itself still shows.
                const pdRepeatToday = alreadyPDToday || pdAlreadyBankedTodayRef.current === true;
                if (!pdRepeatToday) {
                  setPerfectDayStreakBonus(streakBonus);
                  setStreakBonusCount(perfStreak);
                  totalRef.current += streakBonus; setTotalScore(totalRef.current);
                  lifetimeRef.current += streakBonus; setLifetimePoints(lifetimeRef.current);
                  // Show streak bonus first — PD screen shows when player taps Continue
                  triggerHaptic("heavy");
                  setTimeout(() => setShowStreakBonus(true), 1200);
                  // Bank it immediately so any further PD this session is treated as a repeat,
                  // without waiting for a stats/cloud round-trip.
                  pdAlreadyBankedTodayRef.current = true;
                } else {
                  // v250: SAME-DAY REPEAT Perfect Day — acknowledge it (Daryl's decision) but award
                  // NO streak bonus. Force the bonus to 0 so the repeat modal's bonus block (gated
                  // on perfectDayStreakBonus > 0) stays hidden, then show the existing
                  // showRepeatPerfect modal (which already carries the "tracked daily / still worth
                  // celebrating" line and awards nothing). Level/all-tiles/Finishing-Flourish points
                  // still stand — only the once-per-day streak bonus is withheld.
                  setPerfectDayStreakBonus(0);
                  triggerHaptic("medium");
                  repeatPdTimerRef.current = setTimeout(() => setShowRepeatPerfect(true), 600); // v301: cancellable
                }
                // ── Check bonus level unlock ──
                if (ENABLE_BONUS_LEVELS) {
                  const newConsecutive = getConsecutivePerfectDays({...statsData, perfectDaysAllTime: (statsData.perfectDaysAllTime||0)+1});
                  if (newConsecutive >= BONUS_CONSECUTIVE_REQUIRED && !bonusLevelUnlocked) {
                    setBonusLevelUnlocked(true);
                    awardBadge("vault_streak");
                    setTimeout(() => setShowBonusUnlock(true), 3000);
                  }
                }
              }
              setRainbowConfetti(true); setTimeout(() => setRainbowConfetti(false), 6000);
              const perfStats = updateLocalStats({ perfectDay: true }); setStatsData(perfStats);
              const updatedTimes2 = addLocalPerfectTime(playerName||"You", totalTimeRef.current);
              setTimeLeaderboard(updatedTimes2);
              // #18b: Cloud Time Leaderboard — Perfect Day time. A Perfect Day is clean by
              // definition (no resets/re-dos/buys all day), so no clean-flag check needed.
              // Registered-only; upsert-on-improve; fire-and-forget.
              if (!isGuest && user) {
                saveBestTime(user.id, playerName || "", "perfect", totalTimeRef.current).catch(() => {});
              }
          } else {
            // Level 5 complete WITHOUT Perfect Day — game over, show farewell instead of "Play Level 6"
            setValidating(false); setCheckingStuck(false);
            const perfStats = updateLocalStats({ perfectDay: false }); setStatsData(perfStats);
            // v76 (item 15): near-miss — the run was otherwise clean (PD-eligible) but the
            // Word of the Day wasn't found, which is now required for a Perfect Day. Show an
            // encouraging note explaining why, then proceed to the Farewell summary.
            if (perfectDayRef.current && !wotdFoundRef.current) {
              setTimeout(() => setShowWotdMissedPD(true), 1200);
            } else {
              setTimeout(() => openDaySummary("farewell"), 1500); // v302: summary first, then farewell
            }
          }
        }
        if (!isGuest && user) await syncToCloud();
        }; // end runBoardClearSequence
        // ── v198/v199 Finisher step 4: GATE ─────────────────────────────────────────
        // Finisher earned → the FinisherOverlay is the star and plays FIRST. Supersede is now
        // SELECTIVE (v199, Daryl): clearCelebrationQueue() drops the QUEUED celebrations so
        // nothing drains behind FF — this kills the Great Word visual for this word (no artifact,
        // points already counted, so nothing lost). BUT the Loot Letter is a tangible earned
        // item the player is tracking, so if this clearing word USED a loot tile we re-fire the
        // Loot celebration DIRECTLY (bypassing the queue) so it co-fires WITH the FF overlay.
        // The Loot overlay repositions to the BOTTOM (below the chest, over the Dismiss button)
        // whenever finisherOverlay is active — see its renderer. It self-dismisses in ~4s while
        // FF holds until the player dismisses it → player is double-rewarded, nothing hidden.
        // Sub-5 clear (finisher === 0) → run the sequence inline now, exactly as before v198.
        if (finisher > 0) {
          clearCelebrationQueue();              // drop queued visuals (kills Great Word for this word)
          if (usedLootTile) {                    // v199: but LET LOOT THROUGH — fire it directly, co-firing with FF
            setLootCelebration({ word: currentWord, score, letter: usedLootTile.letter });
            // Fired directly (not via the queue), so the queue-drain never clears it — self-clear
            // after the 4s wotdPop animation so it doesn't linger under/after the FF overlay.
            setTimeout(() => setLootCelebration(null), 4000);
          }
          pendingBoardClearRef.current = runBoardClearSequence;
          setFinisherOverlay({ len: currentWord.length, bonus: finisher });
          // 10s max dwell — if the player never taps "Dismiss Page", auto-dismiss releases the
          // deferred Level-Clear sequence. Routes through dismissFinisherOverlay so the sequence
          // fires exactly once (the ref guard prevents a double-run if they also tap the button).
          setTimeout(() => dismissFinisherOverlay(), 10000);
        } else {
          await runBoardClearSequence();
        }
      } else {
        scheduleSyncToCloud();
        stopTimer();
        // Only check for stuck if game isn't complete
        const allUsedNow = newTiles.every(t => t.used);
        if (!allUsedNow) {
        setCheckingStuck(true);
        // Safety: cap at 10s — if the scan hangs, just skip it
        const scanPromise = hasValidWordsRemaining(newTiles);
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(true), 10000));
        const hasWords = await Promise.race([scanPromise, timeoutPromise]);
        setCheckingStuck(false);
        if (!paused) startTimer();
        if (!hasWords) {
          if (ENABLE_BONUS_LEVELS && isBonusLevel(level)) {
            if (bonusRetryUsed) {
              // 2nd failure — show restart modal
              setTimeout(() => setShowBonusRestart(true), 600);
            } else {
              // 1st failure — show unsuccessful, offer 1 retry
              setTimeout(() => setShowBonusUnsuccessful(true), 600);
            }
          } else {
            setTimeout(() => setShowStuckModal(true), 600);
          }
        }
        } else {
          // All tiles used but didn't trigger board clear — just restart timer
          if (!paused) startTimer();
        }
      }
    }
    setSelected([]); setValidating(false);
  };

  // ── v119: fire the V/C danger pulse for `state` ("starve"|"over") ──────────────
  // Sets vcPulse (which the render maps to a CSS animation on the V + C boxes) and
  // clears it after VC_PULSE_MS. Re-firing while one is already running restarts it
  // cleanly (clear old timer, blip to null so the CSS animation re-triggers, then set).
  // Non-blocking: never touches the timer / pause / gameplay — pure visual.
  const fireVcPulse = (state) => {
    if (!state) return;
    if (vcPulseTimerRef.current) clearTimeout(vcPulseTimerRef.current);
    // v120: bump the nonce (remounts the boxes → animation restarts cleanly) and set
    // the active state in the same commit. No rAF, no null-blip needed.
    setVcPulseNonce(n => n + 1);
    setVcPulse(state);
    vcPulseTimerRef.current = setTimeout(() => {
      setVcPulse(null);
      vcPulseTimerRef.current = null;
    }, VC_PULSE_MS);
  };

  const handleNextLevel = (bought = false, explicitLevel = null) => {
    if (bought) forfeitPerfectDay();
    // Hard cap: cannot go beyond Level 5 unless bonus levels are enabled
    if (!ENABLE_BONUS_LEVELS && level >= 5 && explicitLevel == null) return;
    // v130: explicitLevel lets the debug Jump-to-Ln set the target DIRECTLY (avoids the stale-closure
    // bug where chaining handleNextLevel read a stale `level` and only advanced one step). Normal play
    // passes no explicitLevel → computes level+1 as before.
    const newLevel = explicitLevel != null ? explicitLevel : level + 1;
    setLevel(newLevel); setShowBuyModal(false);
    levelScoreRef.current = 0; setLevelScore(0);
    greatWordFiredRef.current = 0; // v116 (#16): new level → Great Word can fire again
    clearCelebrationQueue(); // v164: drop any celebration queued behind a flash
    const rng = seededRandom(getDailySeed() + newLevel * 999);
    const count = 42 + (newLevel - 1) * 7;
    // v130: for a direct jump, derive the cumulative tile-count offset for the target level so tile
    // identity stays deterministic (normal play accumulates this incrementally via tileCountRef).
    if (explicitLevel != null) {
      let cum = 42; // L1 base
      for (let L = 2; L <= newLevel; L++) cum += 42 + (L - 1) * 7;
      tileCountRef.current = cum - count; // offset BEFORE this level's tiles
    }
    const bp = getBonusPositions(count, getBonusCount(newLevel), rng);
    const newTiles = generateLevelTiles(newLevel, tileCountRef.current, rng, bp);
    tileCountRef.current += count;
    // v140: mount the Level Welcome scrim FIRST so it's painted before the new board hits the
    // screen — kills the one-frame glimpse of the board swapping on L2-L5 opens. The board setters
    // (tiles + their paired awaiting-first-tap / timer resets) are deferred one frame via rAF so they
    // apply UNDER the already-painted scrim. newTiles/rng are computed above, so identity is unchanged.
    fireLevelStartSequence(newLevel); // v128/v129: Level Welcome map page → then Loot + WoD
    requestAnimationFrame(() => {
      setTiles(newTiles); setSelected([]);
      // v142: clear the Level Complete celebration HERE (not synchronously at the top). It stays up
      // as the cover during the frame the map scrim mounts, so the board is never exposed between the
      // celebration tearing down and the map painting — kills the L2-L5 board glimpse.
      setLevelComplete(false);
      levelResetCount.current = 0; levelCleanRef.current = true; resetLevelTimer(); stopTimer(); setAwaitingFirstTap(true); awaitingFirstTapRef.current = true; setNewBestTime(false); setFinisherBonusEarned(0);
    });
    if (newLevel === 5) awardBadge("level_5");
  };

  // (v106) Fire the brief Loot Letter announcement for a level. Self-dismisses
  // after 2s. Informational only — does NOT pause the timer (the level is already
  // frozen awaiting first tap) and is NOT gated by the mascot toggle.
  const fireLootAnnounce = (lvl) => {
    if (lootAnnounceTimerRef.current) clearTimeout(lootAnnounceTimerRef.current);
    setLootAnnounceLevel(lvl);
    lootAnnounceTimerRef.current = setTimeout(() => {
      setLootAnnounceLevel(null);
      lootAnnounceTimerRef.current = null;
    }, 2500);
  };

  // (v128) Level-start announcement SEQUENCE. Single entry point for every place a level
  // opens (handleNextLevel, Ready "Let's Go", ReadyToPlay replay). v129 flow:
  //   1. Show the full-screen TREASURE MAP Level Welcome page (map + text + accumulating coin piles).
  //   2. It dwells 10s (auto) OR the player taps "Course is Set. Let's Sail!" to dismiss early.
  //   3. EITHER path → dismissLevelWelcome() → fires Loot + WoD sequence, board becomes visible.
  // The Loot letter also lives permanently in the "Tap tiles…" row, so an early dismiss loses nothing.
  const fireLevelStartSequence = (lvl) => {
    if (levelSeqTimerRef.current) clearTimeout(levelSeqTimerRef.current);
    setMapReady(false); // v138: re-arm the map-decode gate for this open
    setLevelAnnounceNum(lvl);
    // 10s auto-dismiss safety timer; manual button dismiss clears this and calls the same handler.
    levelSeqTimerRef.current = setTimeout(() => { dismissLevelWelcome(); }, 10000);
  };
  // v129: dismiss the Level Welcome map page (from the 10s timer OR the "Let's Sail" button), then
  // hand off to the existing Loot + WoD announcement sequence. Idempotent-safe: guards on the timer ref.
  const dismissLevelWelcome = () => {
    if (levelSeqTimerRef.current) { clearTimeout(levelSeqTimerRef.current); levelSeqTimerRef.current = null; }
    const lvl = levelAnnounceNum;
    setLevelAnnounceNum(null);
    if (lvl != null) {
      // v262 #4(c): resumes skip the Loot Letter card — it's already in the submit line.
      if (!resumeSkipLootRef.current) fireLootAnnounce(lvl);
      resumeSkipLootRef.current = false;
      if (wotd && !wotdFound) showWotdReminderWithPause();
    }
  };

  // WoD reminder helpers — pause timer, show 5s, fair-timer effect resumes
  const showWotdReminderWithPause = () => {    if (!wotd || wotdFound) return;
    stopTimer();
    setShowWotdReminder(true);
    setTimeout(() => {
      setShowWotdReminder(false);
      // v80: resume explicitly, but the startTimer() guard keeps it frozen if we're
      // still awaiting the first tap of the level (the common case — reminder shows on
      // level entry). Only resumes if the player was already mid-play.
      if (!pausedRef.current) startTimer();
    }, 5000);
  };
  const dismissWotdReminder = () => {
    setShowWotdReminder(false);
    // v80: same as above — guard-protected resume; stays frozen until first tap.
    if (!pausedRef.current) startTimer();
  };

  // Smart return-to-game routing — if game is complete (Level 5 done),
  // bring back the appropriate "Play Again?" screen. Otherwise just go to play tab.
  const returnToGame = () => {
    setTab("play");
    // Priority 1: If they had a Perfect Day this session and aren't seeing the modal, restore it.
    // BUG FIX (May 24, 2026): Only re-show the modal if today's game is actually complete.
    // perfectDayRef defaults to true for fresh games (eligibility), so without the completion
    // gate this would incorrectly fire on Return-to-Game from History/Leaderboard mid-game.
    const completedToday = (()=>{ try { return localStorage.getItem("ll_completed_today") === getTodayKey(); } catch { return false; } })();
    if (perfectDayRef.current && !perfectDayAchieved && completedToday) {
      setPerfectDayAchieved(true);
      return;
    }
    // Priority 2: If game is fully complete today (Level 5 finished), show Play Again screen
    try {
      if (localStorage.getItem("ll_completed_today") === getTodayKey()) {
        if (perfectDayRef.current) {
          setShowRepeatPerfect(true);
        } else {
          // Non-Perfect-Day completion → show the Play Again screen too (was triggerFarewell, but that exits the game)
          setShowRepeatPerfect(true);
        }
        return;
      }
    } catch {}
    // Priority 3: Edge case — Level 5 reached and all tiles used but ll_completed_today not set
    // (e.g. the level completion modal was dismissed before flag was written)
    const remaining = tiles.filter(t => !t.used).length;
    if (level >= 5 && remaining === 0) {
      try { localStorage.setItem("ll_completed_today", getTodayKey()); } catch {}
      setShowRepeatPerfect(true);
      return;
    }
    // Priority 4: If a level is mid-completion (modal was dismissed but level still done)
    // re-show levelComplete modal so they can advance
    if (level < 5 && remaining === 0 && !levelComplete) {
      // v108: re-showing the SAME clear — do NOT advance the rotation. Only
      // capture a line if we somehow have none yet (e.g. after a reload).
      if (!clearSayingText) {
        clearSayingIdxRef.current = clearSayingIdxRef.current + 1;
        setClearSayingText(pickClearSaying(level, clearSayingIdxRef.current));
      }
      setLevelComplete(true);
      return;
    }
    // Otherwise: mid-game, just go to play tab (no extra action needed)
  };

  const handleBuyLevel = () => {
    if (totalRef.current < buyCost) return;
    totalRef.current -= buyCost; setTotalScore(totalRef.current);
    setShowBuyModal(false); setShowStuckModal(false);
    handleNextLevel(true);
  };
  const handleExtendLevel5 = () => {
    if (totalRef.current < 5000) return;
    totalRef.current -= 5000; setTotalScore(totalRef.current);
    // Does NOT forfeit Perfect Day — fresh tiles, not a retry
    const rng = seededRandom(getDailySeed() + level * 999 + Date.now());
    const count = 42 + (level - 1) * 7;
    const bp = getBonusPositions(count, getBonusCount(level), rng);
    setTiles(generateLevelTiles(level, tileCountRef.current, rng, bp));
    tileCountRef.current += count; setSelected([]); setShowStuckModal(false); startTimer();
  };
  const handleSaveScore = async () => {
    if (!playerName.trim()) return;
    if (containsProfanity(playerName)) {
      setNameError("Please choose a different name.");
      setTimeout(() => setNameError(""), 4000);
      return;
    }
    setNameError("");
    localStorage.setItem("ll_name", playerName);
    if (!isGuest && user) { await updatePlayerName(user.id, playerName); await syncToCloud(); }
    setShowNameInput(false); clearLocalSession();
  };
  // v72 (item 6 follow-up): "End & Save Score" / "Give Up" from the stuck modal now
  // routes to the Farewell summary screen (which shows the day's results + Share My
  // Results button) instead of silently resetting to Level 1. The reset happens when
  // the player dismisses the Farewell screen. Previously handleFullReset() ran here,
  // skipping the summary/share entirely.
  const handleGiveUp = () => { setShowStuckModal(false); triggerFarewell(); };
  const medalFor = (i) => i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`;

  const todayKey = getTodayKey();
  const weekKey = getWeekKey();
  const dailyBadgeIds = badgeStore.daily?.[todayKey] || [];
  const weeklyBadgeIds = badgeStore.weekly?.[weekKey] || [];
  const lifetimeBadgeIds = badgeStore.lifetime || [];

  const renderBadgeIcon = (b) => {
    if (b.id === "century") return <DoubloonIcon size={36}/>;
    if (b.id === "infinity") return <span style={{fontSize:28,fontWeight:"bold",color:"#a78bfa"}}>∞</span>;
    return <div style={{fontSize:24}}>{b.icon}</div>;
  };

  // ── TIPS data (item 10) ────────────────────────────────────
  const TIPS = [
    // v297: 1.7 features lead the list (Daryl's ruling — Spyglass 1st, Finishing Flourish 2nd).
    { emoji:"🔭", title:"Scout with the Spyglass", body:"Not sure a word is in the LL dictionary? Tap the blue SCOUT chip beside your built word to check it without committing your tiles. The clock keeps running, so certainty costs time. Words we don't know can be sent to the Cap'n with Submit fer Review." },
    { emoji:"🦜", title:"Finish with a Flourish", body:"Clear the board with a 5+ letter word to pocket a Finishing Flourish Bonus — the longer the word, the bigger the haul. Your best board-clearing words also land on the new 🏴‍☠️ Flourish leaderboard tab (registered players only)." },
    { emoji:"🎯", title:"Grow the Word of the Day", body:"The Word of the Day is a root minimum — any valid word containing it counts! Spell a longer form (add a prefix, suffix, or both) and the 1,000-pt bonus grows by 200 pts for every extra letter." },
    { emoji:"👁️", title:"Watch Your Letters", body:"Remaining vowels and consonants are listed in the upper section of each level. Keep a close eye on these as tiles run low." },
    { emoji:"🌈🏆", title:"Perfect Day? Stay Relaxed", body:"Going for a Perfect Day (with rainbows!)? Don't stress the timer. Take your time, think it through, and enjoy the hunt." },
    { emoji:"⚠️", title:"Beware of Q's", body:"Only one U is guaranteed when a Q is present. Use it wisely before it's gone — a stranded Q can cost you the level." },
    { emoji:"💡", title:"Think Big First", body:"Start with big, high-value words. Long words with rare letters earn serious points — and long-word bonuses stack up fast." },
    { emoji:"✨", title:"Stack Bonus Tiles", body:"Gold (2×) and purple (3×) bonus tiles multiply your letter score. Save them for your longer words to maximize your loot." },
    { emoji:"💥", title:"Hunt the Loot Letter", body:"Every level has its own Loot Letter, named at the top of the screen. Two or more of that letter are on the board, but only one tile is the loot — use it in a valid word for a 5× bonus!" },
    { emoji:"⏸️", title:"Use Pause", body:"The Pause button stops your timer completely. Use it whenever you need a moment to plan your next move without the clock running." },
    { emoji:"📜", title:"History Tracks Everything", body:"The History button shows all words played — and tried but not accepted — for the entire current day across all your games." },
    { emoji:"🎯", title:"Save Your UNDO", body:"You get one UNDO per game for 1,000 pts. Save it for a strategic moment in a later level when you really need to reverse a costly mistake." },
    { emoji:"🍀", title:"Good Luck Looting!", body:"Every tile has a value. Every word is a score. Every day is a fresh board. Now go get that loot!" },
  ];

  if (showIntro && editingProfile) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0a0820 0%,#1e1a4a 50%,#0f0e28 100%)",fontFamily:"Georgia,serif",color:"#f5f0e8",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 24px",position:"relative",overflow:"hidden"}}>
      <Starfield/>
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:ipadW(360),textAlign:"center"}}>
        {/* Back to Welcome button — always visible, top-left */}
        <div style={{width:"100%",display:"flex",justifyContent:"flex-start",marginBottom:ipadProfile(12)}}>
          <button onClick={()=>setEditingProfile(false)} style={{padding:`${ipadProfilePad(10)}px ${ipadProfilePad(18)}px`,borderRadius:10,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.9)",fontSize:ipadProfile(14),fontFamily:"Georgia,serif",cursor:"pointer"}}>
            ← Back to Welcome
          </button>
        </div>
        {/* Smaller logo — 50% of welcome size (160 → 80) */}
        <PencilLogo size={ipadProfile(100)}/>
        <div style={{marginTop:ipadProfile(14),fontSize:ipadProfile(26),fontWeight:"bold",color:"#22d3ee",letterSpacing:1}}>Setup Your Profile</div>
        <div style={{fontSize:ipadProfile(14),color:"rgba(255,255,255,0.75)",marginTop:6,marginBottom:ipadProfile(24)}}>Add a photo and a nickname to personalize your game.</div>
        {/* Profile editor card */}
        <div style={{width:"100%",background:"rgba(255,255,255,0.05)",borderRadius:16,padding:`${ipadProfilePad(24)}px ${ipadProfilePad(22)}px`,border:"1px solid rgba(255,255,255,0.15)"}}>
          {/* Photo upload */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:ipadProfile(14),marginBottom:ipadProfile(22)}}>
            {profilePhoto
              ? <img src={profilePhoto} alt="profile" style={{width:ipadProfile(120),height:ipadProfile(120),borderRadius:"50%",objectFit:"cover",border:"2.5px solid rgba(34,211,238,0.7)"}}/>
              : <div style={{width:ipadProfile(120),height:ipadProfile(120),borderRadius:"50%",background:"rgba(34,211,238,0.1)",border:"2px dashed rgba(34,211,238,0.5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:ipadProfile(44)}}>👤</div>
            }
            <button onClick={handlePhotoChange} style={{padding:`${ipadProfilePad(13)}px ${ipadProfilePad(26)}px`,borderRadius:10,background:"rgba(34,211,238,0.15)",border:"1px solid rgba(34,211,238,0.5)",color:"#22d3ee",fontSize:ipadProfile(16),fontFamily:"Georgia,serif",cursor:"pointer",fontWeight:"bold"}}>
              📷 Choose / Take Photo
            </button>
            {profilePhoto && <button onClick={()=>{ setProfilePhoto(null); localStorage.removeItem("ll_photo"); }} style={{padding:`${ipadProfilePad(8)}px ${ipadProfilePad(16)}px`,borderRadius:10,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.85)",fontSize:ipadProfile(13),fontFamily:"Georgia,serif",cursor:"pointer"}}>Remove Photo</button>}
          </div>
          {/* Nickname input */}
          <div style={{marginBottom:ipadProfile(20)}}>
            <div style={{fontSize:ipadProfile(13),color:"rgba(255,255,255,0.85)",marginBottom:8,textAlign:"left"}}>Nickname (shown on the leaderboard)</div>
            <input
              value={profileNickname}
              onChange={e=>setProfileNickname(e.target.value)}
              placeholder={playerName || "Enter a nickname…"}
              style={{width:"100%",padding:`${ipadProfilePad(14)}px ${ipadProfilePad(16)}px`,borderRadius:10,border:"1px solid rgba(34,211,238,0.4)",background:"rgba(34,211,238,0.08)",color:"#f5f0e8",fontSize:ipadProfile(17),fontFamily:"Georgia,serif",outline:"none",textAlign:"center",boxSizing:"border-box"}}
            />
            {nameError && <div style={{marginTop:6,fontSize:ipadProfile(13),color:"#fca5a5",textAlign:"center"}}>{nameError}</div>}
          </div>
          {/* Save button */}
          <button onClick={async ()=>{ if (await handleNicknameSave(profileNickname)) setEditingProfile(false); }} style={{width:"100%",padding:ipadProfilePad(16),borderRadius:12,background:"linear-gradient(135deg,#22d3ee,#0ea5e9)",color:"#0a0820",fontSize:ipadProfile(17),fontWeight:"bold",fontFamily:"Georgia,serif",border:"none",cursor:"pointer"}}>
            ✓ Save Profile
          </button>
        </div>
        {/* Show sign out option if authenticated */}
        {!isGuest && (
          <button onClick={onSignOut} style={{marginTop:ipadProfile(20),padding:`${ipadProfilePad(8)}px ${ipadProfilePad(18)}px`,borderRadius:10,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.85)",fontSize:ipadProfile(13),fontFamily:"Georgia,serif",cursor:"pointer"}}>
            Sign Out
          </button>
        )}
      </div>
    </div>
  );

  if (showIntro) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0a0820 0%,#1e1a4a 50%,#0f0e28 100%)",fontFamily:"Georgia,serif",color:"#f5f0e8",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 24px",position:"relative",overflow:"hidden"}}>
      <Starfield/>
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:ipadW(360),textAlign:"center"}}>
        <PencilLogo size={ipadIcon(160)}/>
        <div style={{marginTop:ipadIntro(12),background:"rgba(139,92,246,0.25)",border:"2.5px solid rgba(167,139,250,0.95)",borderRadius:14,padding:`${ipadIntroPad(8)}px ${ipadIntroPad(24)}px`,boxShadow:"0 0 28px rgba(139,92,246,0.5)"}}>
          <span style={{fontSize:ipadIntro(28),fontWeight:"bold",letterSpacing:5,color:"#ffffff",textShadow:"0 0 16px rgba(167,139,250,0.85)"}}>LetterLoot</span>
        </div>
        <div style={{fontSize:ipadIntro(12),color:"rgba(255,255,255,0.6)",marginTop:6,letterSpacing:1}}>Daily word puzzle · Every letter has a value</div>

        {/* ── Profile section ── */}
        <div style={{marginTop:ipadIntro(16),width:"100%",background:"rgba(255,255,255,0.05)",borderRadius:16,padding:`${ipadIntroPad(16)}px`,border:"1px solid rgba(255,255,255,0.12)"}}>
          {!editingProfile ? (
            <div>
              {/* Top: photo + name */}
              <div style={{display:"flex",alignItems:"center",gap:ipadIntro(14),marginBottom:ipadIntro(12)}}>
                {/* Photo */}
                <div style={{position:"relative",flexShrink:0}} onClick={()=>setEditingProfile(true)}>
                  {profilePhoto
                    ? <img src={profilePhoto} alt="profile" style={{width:ipadIntro(60),height:ipadIntro(60),borderRadius:"50%",objectFit:"cover",border:"2.5px solid rgba(34,211,238,0.7)",cursor:"pointer"}}/>
                    : <div style={{width:ipadIntro(60),height:ipadIntro(60),borderRadius:"50%",background:"rgba(34,211,238,0.1)",border:"2px dashed rgba(34,211,238,0.5)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:ipadIntro(22)}}>👤</div>
                  }
                  <div style={{position:"absolute",bottom:0,right:0,background:"rgba(34,211,238,0.9)",borderRadius:"50%",width:ipadIntro(18),height:ipadIntro(18),display:"flex",alignItems:"center",justifyContent:"center",fontSize:ipadIntro(10),cursor:"pointer"}}>✏️</div>
                </div>
                {/* Name/nickname */}
                <div style={{flex:1,textAlign:"left"}}>
                  <div style={{fontSize:ipadIntro(16),fontWeight:"bold",color:"#22d3ee"}}>
                    {profileNickname || playerName || "Guest"}
                  </div>
                  {profileNickname && playerName && profileNickname !== playerName &&
                    <div style={{fontSize:ipadIntro(11),color:"rgba(255,255,255,0.7)",marginTop:2}}>{playerName}</div>
                  }
                </div>
              </div>
              {/* Bottom: side-by-side action buttons */}
              <div style={{display:"flex",gap:ipadIntro(8)}}>
                <button onClick={()=>setEditingProfile(true)} style={{flex:1,padding:`${ipadIntroPad(10)}px ${ipadIntroPad(12)}px`,borderRadius:10,background:"rgba(34,211,238,0.15)",border:"1px solid rgba(34,211,238,0.6)",color:"#22d3ee",fontSize:ipadIntro(12),fontWeight:"bold",fontFamily:"Georgia,serif",cursor:"pointer"}}>
                  ✏️ Edit Profile
                </button>
                {isGuest ? (
                  <button onClick={onSignOut} style={{flex:1,padding:`${ipadIntroPad(10)}px ${ipadIntroPad(12)}px`,borderRadius:10,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadIntro(12),fontWeight:"bold",fontFamily:"Georgia,serif",border:"none",cursor:"pointer"}}>
                    🔑 Sign In
                  </button>
                ) : (
                  <button onClick={onSignOut} style={{flex:1,padding:`${ipadIntroPad(10)}px ${ipadIntroPad(12)}px`,borderRadius:10,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.3)",color:"rgba(255,255,255,0.9)",fontSize:ipadIntro(12),fontWeight:"bold",fontFamily:"Georgia,serif",cursor:"pointer"}}>
                    Sign Out
                  </button>
                )}
              </div>
              {isGuest && (
                <div style={{marginTop:ipadIntro(8),fontSize:ipadIntro(10),color:"rgba(255,255,255,0.7)",textAlign:"center"}}>
                  🏆 Create an account to join the Leaderboard
                </div>
              )}
              {/* v76 (item 7): subtle Delete Account link for signed-in users on the Welcome
                  screen. Opens the SAME two-step (type DELETE) confirmation modal used in-game. */}
              {!isGuest && (
                <div style={{textAlign:"center",marginTop:ipadIntro(10)}}>
                  <button onClick={()=>setShowDeleteAccount(true)} style={{background:"transparent",border:"none",color:"rgba(248,113,113,0.65)",fontSize:ipadIntro(11),fontFamily:"Georgia,serif",cursor:"pointer",textDecoration:"underline",padding:4}}>
                    Delete Account
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {/* Photo upload */}
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{position:"relative",flexShrink:0}}>
                  {profilePhoto
                    ? <img src={profilePhoto} alt="profile" style={{width:64,height:64,borderRadius:"50%",objectFit:"cover",border:"2.5px solid rgba(34,211,238,0.7)"}}/>
                    : <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(34,211,238,0.1)",border:"2px dashed rgba(34,211,238,0.5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>👤</div>
                  }
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,flex:1}}>
                  <button onClick={handlePhotoChange} style={{padding:"6px 10px",borderRadius:10,background:"rgba(34,211,238,0.15)",border:"1px solid rgba(34,211,238,0.5)",color:"#22d3ee",fontSize:11,fontFamily:"Georgia,serif",cursor:"pointer",fontWeight:"bold"}}>
                    📷 Choose / Take Photo
                  </button>
                  {profilePhoto && <button onClick={()=>{ setProfilePhoto(null); localStorage.removeItem("ll_photo"); }} style={{padding:"4px 10px",borderRadius:10,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.4)",fontSize:10,fontFamily:"Georgia,serif",cursor:"pointer"}}>Remove Photo</button>}
                </div>
              </div>
              {/* Nickname input */}
              <div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginBottom:4,textAlign:"left"}}>Nickname (shown on the leaderboard)</div>
                <input
                  value={profileNickname}
                  onChange={e=>setProfileNickname(e.target.value)}
                  placeholder={playerName || "Enter a nickname…"}
                  style={{width:"100%",padding:"8px 12px",borderRadius:10,border:"1px solid rgba(34,211,238,0.4)",background:"rgba(34,211,238,0.08)",color:"#f5f0e8",fontSize:13,fontFamily:"Georgia,serif",outline:"none",textAlign:"center"}}
                />
                {nameError && <div style={{marginTop:6,fontSize:11,color:"#fca5a5",textAlign:"center"}}>{nameError}</div>}
              </div>
              <button onClick={async ()=>{ if (await handleNicknameSave(profileNickname)) setEditingProfile(false); }} style={{padding:"8px",borderRadius:10,background:"linear-gradient(135deg,#22d3ee,#0ea5e9)",color:"#0a0820",fontSize:12,fontWeight:"bold",fontFamily:"Georgia,serif",border:"none",cursor:"pointer"}}>
                ✓ Save Profile
              </button>
            </div>
          )}
        </div>

        {/* Welcome message */}
        <div style={{marginTop:ipadIntro(12),fontSize:ipadIntro(17),fontWeight:"bold",color:"#22d3ee"}}>
          {(profileNickname||playerName) ? `Welcome back, ${profileNickname||playerName}! 👋` : "Welcome! 👋"}
        </div>



        <button onClick={()=>{
          setEditingProfile(false);
          // Only reset if game is truly finished (all tiles used on level 5)
          const allUsed = tiles.every(t => t.used);
          // v247 Bug-B FIX (the real root cause): PLAY NOW only reset to a fresh Level 1 when
          // `allUsed` (every tile consumed) AND level===5. But a FINISHED game — especially a
          // Perfect Day won without clearing every tile — leaves tiles on the board, so allUsed
          // is false, gameComplete was false, the reset was SKIPPED, and PLAY NOW just showed the
          // Ready prompt over the STALE finished board (the resurrection). A game is "complete"
          // when it's board-cleared on L5 (allUsed) OR the loaded session was already finished
          // (ssLocalFinished = levelComplete-on-L5 or Perfect Day, computed once at mount from the
          // saved session). Using ssLocalFinished — NOT the live perfectDayRef, which defaults true
          // and would misfire on a fresh in-progress L5. Mid-game (L1-4) untouched: level===5 required.
          const gameComplete = level === 5 && (allUsed || levelComplete === true || ssLocalFinished === true);
          if (gameComplete) {
            cancelDeferredEndgame(); // v301 (Item 1-B)
            const rng = seededRandom(getDailySeed());
            const bp = getBonusPositions(42, getBonusCount(1), rng);
            setTiles(generateLevelTiles(1, 0, rng, bp));
            tileCountRef.current = 42; setLevel(1); setSelected([]);
            setSubmitted([]); submittedRef.current = [];
            setTotalScore(0); totalRef.current = 0;
            setLevelScore(0); levelScoreRef.current = 0;
            greatWordFiredRef.current = 0; greatWordIdxRef.current = -1; // v116 (#16): new game via PLAY NOW re-arms + resets rotation
            clearCelebrationQueue(); // v164: drop any celebration queued behind a flash
            setStreak(0); setLevelComplete(false);
            // v100 (item #2c): respect the per-day PD forfeit flag here too — starting another
            // game today via PLAY NOW must not re-open a Perfect Day shot once forfeited.
            const pdForfeitedToday2 = (() => { try { return localStorage.getItem("ll_pd_forfeited_today") === getTodayKey(); } catch { return false; } })();
            setPerfectDaySync(!pdForfeitedToday2); longestWordTodayRef.current = ""; setLongestWordToday("");
            setUndoUsed(false); setLastValidEntry(null);
            TPROBE("FULL RESET (PLAY NOW replay): BOTH clocks -> 0");
            stopTimer(); levelTimeRef.current = 0; totalTimeRef.current = 0;
            setLevelTime(0); setTotalTime(0);
            // v77 FIX: no startTimer() here — routes to Ready prompt; clock stays frozen
            // until first tap. Arm the gate. (Was a source of the pre-tap timer leak.)
            setAwaitingFirstTap(true); awaitingFirstTapRef.current = true;
            clearLocalSession();
          }
          // Show ready prompt — timer starts only when player taps Ready
          stopTimer();
          setShowIntro(false);
          // Show the "Ready, Daryl?" screen (with green Let's Go) for non-reset entries too
          setShowReadyScreen(true);
          // No setShowReadyToPlay — the showReadyScreen ("Ready, Daryl?")
          // already handles the pre-game prompt with timer-on-tap behavior.
        }} style={{marginTop:20,width:"100%",padding:"16px",borderRadius:16,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:18,fontWeight:"bold",letterSpacing:2,border:"none",cursor:"pointer",fontFamily:"Georgia,serif",boxShadow:"0 0 28px rgba(246,211,101,0.4)"}}>
          PLAY NOW
        </button>
        {/* Word of the Day card */}
        {wotd && (
          <div style={{marginTop:18,width:"100%",background:"linear-gradient(135deg,rgba(167,139,250,0.18),rgba(167,139,250,0.06))",border:"1.5px solid rgba(167,139,250,0.5)",borderRadius:14,padding:"14px 16px",textAlign:"center"}}>
            {/* v299: label 10->13 and brighter, bottom line 11->13.5 and 0.6->0.92 white (Daryl:
                "far too light and small for humans with any visual limitations"), copy updated
                for the Malleable WoD rule, found-line shows the REAL banked bonus. */}
            <div style={{fontSize:16,color:"#d8ccfd",letterSpacing:3,fontWeight:"bold",marginBottom:6}}>🎯 WORD OF THE DAY</div>
            <div style={{fontSize:24,fontWeight:"bold",color:"#f6d365",letterSpacing:2,marginBottom:6,fontFamily:"Georgia,serif"}}>{wotd}</div>
            <div style={{fontSize:wotdFound?16:15.5,fontWeight:"bold",color:wotdFound?"#4ade80":"rgba(255,255,255,0.98)",lineHeight:1.5}}>
              {wotdFound ? `✓ You found it! +${((wotdFoundDetails && wotdFoundDetails.bonus) || 1000).toLocaleString("en-US")} pts` : "Spell it — or any longer form of it! 1,000 pts, +200 per extra letter."}
            </div>
          </div>
        )}
      </div>
      {/* v98 fix: delete-account modal duplicated into the Welcome (showIntro) branch.
          The original modal (in the final render branch) is unreachable from the Welcome
          screen because showIntro returns early — so the Welcome-screen Delete Account
          button set showDeleteAccount=true but nothing rendered until navigating in-game.
          This copy makes the confirmation modal appear on the Welcome screen itself. */}
      {showDeleteAccount&&<div style={{position:"fixed",inset:0,zIndex:9300,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:`${ipadTour(28)}px ${ipadTour(24)}px`,textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.85)",border:"2px solid rgba(239,68,68,0.5)",maxWidth:ipadTour(340),width:"100%",fontFamily:"Georgia,serif",color:"#f5f0e8"}}>
          <div style={{fontSize:ipadTour(40),marginBottom:6}}>⚠️</div>
          <div style={{fontSize:ipadTour(18),fontWeight:"bold",color:"#fca5a5",marginBottom:10}}>Delete Your Account?</div>
          <div style={{fontSize:ipadTour(13),color:"rgba(255,255,255,0.95)",lineHeight:1.6,marginBottom:14,textAlign:"left"}}>
            This will <strong style={{color:"#fca5a5"}}>permanently delete</strong>:
          </div>
          <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:`${ipadTour(10)}px ${ipadTour(14)}px`,marginBottom:14,fontSize:ipadTour(12),color:"rgba(255,255,255,0.95)",lineHeight:1.9,textAlign:"left"}}>
            <div>✗ Your account &amp; email</div>
            <div>✗ All game history &amp; stats</div>
            <div>✗ Perfect Days, streaks, badges</div>
            <div>✗ Leaderboard entries</div>
          </div>
          <div style={{fontSize:ipadTour(12),color:"rgba(255,255,255,0.9)",marginBottom:10,lineHeight:1.5}}>
            This cannot be undone. To confirm, type <strong style={{color:"#fca5a5"}}>DELETE</strong> below:
          </div>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e)=>setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            style={{width:"100%",padding:`${ipadTour(10)}px ${ipadTour(12)}px`,borderRadius:10,border:"1.5px solid rgba(239,68,68,0.4)",background:"rgba(0,0,0,0.3)",color:"#fff",fontSize:ipadTour(14),fontFamily:"Georgia,serif",textAlign:"center",letterSpacing:2,marginBottom:14,boxSizing:"border-box"}}
            disabled={deletingAccount}
          />
          <button
            onClick={async ()=>{
              if (deleteConfirmText.trim().toUpperCase() !== "DELETE") return;
              setDeletingAccount(true);
              try { await onDeleteAccount?.(); } catch {}
              setDeletingAccount(false);
              setShowDeleteAccount(false);
              setDeleteConfirmText("");
            }}
            disabled={deletingAccount || deleteConfirmText.trim().toUpperCase() !== "DELETE"}
            style={{width:"100%",padding:ipadTour(13),borderRadius:12,border:"none",background: (deletingAccount || deleteConfirmText.trim().toUpperCase() !== "DELETE") ? "rgba(239,68,68,0.25)" : "linear-gradient(135deg,#dc2626,#991b1b)",color:"#fff",fontSize:ipadTour(14),fontWeight:"bold",fontFamily:"Georgia,serif",cursor: (deletingAccount || deleteConfirmText.trim().toUpperCase() !== "DELETE") ? "not-allowed" : "pointer",marginBottom:8,opacity: deletingAccount ? 0.7 : 1}}
          >
            {deletingAccount ? "Deleting…" : "Delete My Account Permanently"}
          </button>
          <button
            onClick={()=>{ setShowDeleteAccount(false); setDeleteConfirmText(""); }}
            disabled={deletingAccount}
            style={{width:"100%",padding:ipadTour(10),borderRadius:12,background:"transparent",color:"rgba(255,255,255,0.95)",fontSize:ipadTour(13),fontFamily:"Georgia,serif",border:"1px solid rgba(255,255,255,0.25)",cursor: deletingAccount ? "not-allowed" : "pointer"}}
          >
            Cancel
          </button>
        </div>
      </div>}
    </div>
  );

  // v122: WHAT'S NEW in v1.1 — one-time gate before the Ready screen (shows once for
  // everyone; re-openable via Tour later per #33). Content locked with Daryl July04.
  if (showWhatsNew && showReadyScreen) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0a0820 0%,#1e1a4a 50%,#0f0e28 100%)",fontFamily:"Georgia,serif",color:"#f5f0e8",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",padding:"40px 12px",position:"relative",overflowY:"auto",overflowX:"hidden"}}>
      <Starfield/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:isIpadWidth()?ipadW(440):400,minHeight:"calc(100vh - 80px)",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{textAlign:"center",marginBottom:ipadIntro(18)}}>
          <div style={{fontSize:ipadIntro(11),letterSpacing:2,color:"#a78bfa",fontWeight:"bold",marginBottom:ipadIntro(6)}}>WHAT'S NEW</div>
          <div style={{fontSize:ipadIntro(22),color:"#f6d365",fontWeight:"bold"}}>Fresh treasure in v1.8</div>
          <div style={{fontSize:ipadIntro(13),color:"rgba(245,240,232,0.75)",marginTop:ipadIntro(6),lineHeight:1.5}}>A few things have changed since you last played — here's what to look for.</div>
        </div>
        {/* FF featured card */}
        <div style={{display:"flex",flexDirection:"column",gap:ipadIntro(12)}}>
          {/* v304: FEATURED Malleable WoD card (1.8) — gold box, bold red title. */}
          <div style={{background:"rgba(246,211,101,0.16)",border:"2.5px solid rgba(246,211,101,0.85)",borderRadius:14,padding:`${ipadIntroPad(18)}px ${ipadIntroPad(18)}px`,boxShadow:"0 0 28px rgba(246,211,101,0.35)"}}>
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
              <span style={{fontSize:ipadIntro(24)}}>🎯</span>
              <span style={{fontSize:ipadIntro(21),color:"#ff4444",fontWeight:"bold",textShadow:"0 0 10px rgba(255,68,68,0.45)"}}>Malleable Word of the Day</span>
            </div>
            <div style={{fontSize:ipadIntro(17.5),color:"rgba(245,240,232,0.98)",lineHeight:1.6}}>The Word of the Day now bends to yer will. Any word that carries the WoD's root — SURPRISING, UNSURPRISED, SURPRISES for SURPRISED — counts as found, so long as it's at least as long as the listed word. Grow it and the bonus grows too: <strong style={{color:'#f6d365'}}>1,000 pts plus 200 for every extra letter</strong>.</div>
          </div>
          {/* v304: second card — Today's Summary & My Flourishes (1.8). */}
          <div style={{background:"rgba(167,139,250,0.14)",border:"2px solid rgba(167,139,250,0.7)",borderRadius:14,padding:`${ipadIntroPad(14)}px ${ipadIntroPad(16)}px`,boxShadow:"0 0 18px rgba(167,139,250,0.25)"}}>
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
              <span style={{fontSize:ipadIntro(20)}}>📊</span>
              <span style={{fontSize:ipadIntro(18),color:"#c4b5fd",fontWeight:"bold"}}>Today's Summary & My Flourishes</span>
            </div>
            <div style={{fontSize:ipadIntro(15.5),color:"rgba(245,240,232,0.95)",lineHeight:1.55}}>Every game now ends with a <strong style={{color:'#c4b5fd'}}>Today's Summary</strong> card — Perfect Day and streak, yer Finishing Flourishes, Word of the Day, and total time — with Leaderboard, Share, and Play Again right there. And under Stats, a new <strong style={{color:'#c4b5fd'}}>My Flourishes</strong> log keeps every board-clearing word you've ever flourished, by day and level.</div>
          </div>
        </div>
        {/* v212: proportional spacer — content distributes down the screen to fill the space. */}
        <div style={{flex:0.8,minHeight:ipadIntro(20)}} />
        {/* v209/v212: Tour note — boxed, bigger font, STRONGER border. */}
        <div style={{textAlign:"center",fontSize:ipadIntro(17),color:"#f5f0e8",lineHeight:1.5,padding:`${ipadIntroPad(14)}px ${ipadIntroPad(16)}px`,background:"rgba(167,139,250,0.16)",border:"1.5px solid rgba(167,139,250,0.65)",borderRadius:10}}>Want to see this again? Tap <strong style={{color:"#f6d365"}}>↺ Tour</strong> anytime to review these changes.</div>
        {/* v212: proportional spacer below the note. */}
        <div style={{flex:0.8,minHeight:ipadIntro(20)}} />
        {/* v203/v212: "still worth knowing" recap — bigger font, STRONGER border. */}
        <div style={{background:"rgba(255,255,255,0.05)",border:"1.5px solid rgba(255,255,255,0.28)",borderRadius:12,padding:`${ipadIntroPad(16)}px ${ipadIntroPad(18)}px`}}>
            <div style={{fontSize:ipadIntro(14),letterSpacing:1,color:"rgba(245,240,232,0.7)",fontWeight:"bold",marginBottom:ipadIntro(11),textTransform:"uppercase"}}>Still worth knowing</div>
            <div style={{fontSize:ipadIntro(17),color:"rgba(245,240,232,0.92)",lineHeight:1.6}}>🔭 <strong style={{color:"#7cc4ff"}}>The Spyglass</strong> — tap SCOUT beside yer built word to check it before committing; the clock keeps runnin'.</div>
            <div style={{fontSize:ipadIntro(17),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:ipadIntro(9)}}>🏴‍☠️ <strong style={{color:"#c4b5fd"}}>Flourish Leaderboard</strong> — the longest board-clearing Flourish words across all Looters.</div>
            <div style={{fontSize:ipadIntro(17),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:ipadIntro(9)}}>🦜 <strong style={{color:"#ff4444"}}>Finishing Flourish Bonus</strong> — clear the board with a 5+ letter word for bonus treasure; longer = bigger haul.</div>
            <div style={{fontSize:ipadIntro(17),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:ipadIntro(9)}}>✨ <strong style={{color:"#f6d365"}}>Loot Letters</strong> — one hidden tile per level scores 5×.</div>
            <div style={{fontSize:ipadIntro(17),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:ipadIntro(9)}}>🏴‍☠️ <strong style={{color:"#c4b5fd"}}>Pirate Celebrations</strong> — cheers for big moments (toggle on or off on the "Ready?" screen).</div>
            <div style={{fontSize:ipadIntro(17),color:"rgba(245,240,232,0.92)",lineHeight:1.6,marginTop:ipadIntro(9)}}>⚠️ <strong style={{color:"#7cc4ff"}}>Vowel / Consonant Alert</strong> — the letter boxes pulse when your balance gets risky.</div>
        </div>
        {/* v212: small spacer before the button so the recap isn't glued to it when filling. */}
        <div style={{flex:0.5,minHeight:ipadIntro(14)}} />
        {/* Acknowledge button — deliberately NOT "Let's Go" so it isn't reflex-tapped */}
        <button onClick={dismissWhatsNew} style={{width:"100%",marginTop:ipadIntro(14),marginBottom:ipadIntro(24),padding:`${ipadIntroPad(15)}px`,borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadIntro(16),fontWeight:"bold",border:"none",cursor:"pointer",fontFamily:"Georgia,serif"}}>
          Got it — let's play! 🎯
        </button>
      </div>
    </div>
  );

  if (showReadyScreen) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0a0820 0%,#1e1a4a 50%,#0f0e28 100%)",fontFamily:"Georgia,serif",color:"#f5f0e8",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"30px 24px",position:"relative",overflow:"hidden"}}>
      <Starfield/>
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:ipadW(360),textAlign:"center"}}>
        {profilePhoto
          ? <img src={profilePhoto} alt="profile" style={{width:ipadIcon(80),height:ipadIcon(80),borderRadius:"50%",objectFit:"cover",border:"3px solid rgba(34,211,238,0.7)",marginBottom:ipadIntro(16)}}/>
          : <PencilLogo size={ipadIcon(160)}/>
        }
        <div style={{fontSize:ipadIntro(22),fontWeight:"bold",color:"#22d3ee",marginBottom:ipadIntro(22),marginTop:ipadIntro(8)}}>
          {profileNickname||playerName ? `Ready, ${profileNickname||playerName}?` : "Ready to Play?"}
        </div>
        {/* v104: reworded + brightened box with visible purple border */}
        <div style={{background:"rgba(255,255,255,0.10)",borderRadius:16,padding:`${ipadIntroPad(18)}px ${ipadIntroPad(22)}px`,border:"2px solid rgba(167,139,250,0.85)",marginBottom:ipadIntro(22),width:"100%",fontSize:ipadIntro(13),color:"rgba(255,255,255,0.92)",lineHeight:2.0}}>
          <div style={{marginBottom:ipadIntro(6)}}>✦ Each level hides one <strong style={{color:"#f6d365"}}>Loot Letter</strong> worth <strong style={{color:"#f6d365"}}>5× its value</strong> — we'll name the letter, but only 1 tile pockets the loot</div>
          <div style={{marginBottom:ipadIntro(6)}}>✦ Game Timer begins with your <strong style={{color:"#f6d365"}}>first letter tapped</strong></div>
          <div style={{marginBottom:ipadIntro(6)}}>✦ Tap the blue <strong style={{color:"#f6d365"}}>🔭 SCOUT</strong> chip to Spyglass-check yer built word — the clock keeps runnin'!</div>
          <div>✦ Clear all 5 levels + find the Word of the Day to enjoy and share a <span style={{color:"#6ee7b7",fontWeight:"bold"}}>Perfect Day! 🌈🏆</span></div>
          <div style={{marginTop:ipadIntro(6)}}>✦ Toggle <strong style={{color:"#c4b5fd"}}>Show Mascot Celebrations</strong> below on or off anytime — your choice, every game</div>
        </div>
        {/* v104: Show Mascot Celebrations toggle — plain iOS-style switch, backed by ll_show_mascots (default ON) */}
        <div onClick={()=>setMascotsPref(!showMascotsPref)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",boxSizing:"border-box",padding:`${ipadIntroPad(12)}px ${ipadIntroPad(16)}px`,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,marginBottom:ipadIntro(22),cursor:"pointer"}}>
          <span style={{fontSize:ipadIntro(13),color:"rgba(255,255,255,0.85)"}}>Show Mascot Celebrations</span>
          <div style={{width:ipadIntro(48),height:ipadIntro(28),borderRadius:ipadIntro(14),background:showMascotsPref?"#00c853":"rgba(255,255,255,0.2)",position:"relative",flexShrink:0,transition:"background 0.2s",boxShadow:"inset 0 0 0 1px rgba(255,255,255,0.15)"}}>
            <div style={{position:"absolute",top:ipadIntro(3),left:showMascotsPref?ipadIntro(23):ipadIntro(3),width:ipadIntro(22),height:ipadIntro(22),borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
          </div>
        </div>
        <button onClick={()=>{ setShowReadyScreen(false); stopTimer(); setAwaitingFirstTap(true); awaitingFirstTapRef.current = true; fireLevelStartSequence(level); /* v263 #4: announce the ACTUAL level — hardcoded 1 mislabeled resumed games */ }} style={{width:"100%",padding:`${ipadIntroPad(20)}px`,borderRadius:16,background:"linear-gradient(135deg,#00c853,#00e676)",color:"#003300",fontSize:ipadIntro(20),fontWeight:"bold",letterSpacing:2,border:"none",cursor:"pointer",fontFamily:"Georgia,serif",boxShadow:"0 0 32px rgba(0,200,83,0.5)"}}>
          Let's Go! 🎯
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#0a0820 0%,#1e1a4a 50%,#0f0e28 100%)", fontFamily:"Georgia,serif", color:"#f5f0e8", display:"flex", flexDirection:"column", alignItems:"center", paddingBottom:40, position:"relative", overflowY:"auto", overflowX:"hidden" }}>
      <Starfield/>
      <style>{`
        @keyframes twinkle{from{opacity:0.08}to{opacity:0.7}}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
        @keyframes pop{0%{transform:translate(-50%,-50%) scale(0.6);opacity:0}60%{transform:translate(-50%,-50%) scale(1.08)}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
        @keyframes slideUp{from{transform:translateY(18px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes badgePop{0%{transform:translateX(-50%) translateY(40px) scale(0.8);opacity:0}8%{transform:translateX(-50%) translateY(0) scale(1.05);opacity:1}90%{transform:translateX(-50%) translateY(0) scale(1);opacity:1}100%{transform:translateX(-50%) translateY(-20px) scale(0.9);opacity:0}}
        @keyframes wotdPop{0%{transform:scale(0.8) translateY(40px);opacity:0}8%{transform:scale(1.05) translateY(0);opacity:1}90%{transform:scale(1) translateY(0);opacity:1}100%{transform:scale(0.9) translateY(-20px);opacity:0}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes ll-pulse{0%,100%{box-shadow:0 0 0 0 rgba(246,211,101,0.7);transform:scale(1)}50%{box-shadow:0 0 0 10px rgba(246,211,101,0);transform:scale(1.04)}}
        @keyframes rainbow{0%{color:#ff0000}16%{color:#ff8800}33%{color:#ffff00}50%{color:#00ff00}66%{color:#0088ff}83%{color:#8800ff}100%{color:#ff0000}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes pdPiratesRise{0%{bottom:-380px;opacity:0;transform:translateX(-50%) scale(0.85)}60%{bottom:${PD_PIRATE_BOTTOM + 2}%;opacity:1;transform:translateX(-50%) scale(1.04)}100%{bottom:${PD_PIRATE_BOTTOM}%;opacity:1;transform:translateX(-50%) scale(1)}}
        @keyframes pdPiratesJig{0%{bottom:${PD_PIRATE_BOTTOM}%;opacity:1;transform:translateX(-50%) rotate(0deg) translateY(0)}12%{bottom:${PD_PIRATE_BOTTOM}%;opacity:1;transform:translateX(-70%) rotate(-5deg) translateY(-14px)}25%{bottom:${PD_PIRATE_BOTTOM}%;opacity:1;transform:translateX(-70%) rotate(-3deg) translateY(0)}37%{bottom:${PD_PIRATE_BOTTOM}%;opacity:1;transform:translateX(-50%) rotate(0deg) translateY(-14px)}50%{bottom:${PD_PIRATE_BOTTOM}%;opacity:1;transform:translateX(-50%) rotate(0deg) translateY(0)}62%{bottom:${PD_PIRATE_BOTTOM}%;opacity:1;transform:translateX(-30%) rotate(5deg) translateY(-14px)}75%{bottom:${PD_PIRATE_BOTTOM}%;opacity:1;transform:translateX(-30%) rotate(3deg) translateY(0)}87%{bottom:${PD_PIRATE_BOTTOM}%;opacity:1;transform:translateX(-50%) rotate(0deg) translateY(-14px)}100%{bottom:${PD_PIRATE_BOTTOM}%;opacity:1;transform:translateX(-50%) rotate(0deg) translateY(0)}}
        @keyframes pdPiratesOut{0%{bottom:${PD_PIRATE_BOTTOM}%;opacity:1;transform:translateX(-50%) scale(1)}100%{bottom:-380px;opacity:0;transform:translateX(-50%) scale(0.9)}}
        @keyframes pdSparkleFloat{0%{opacity:0;transform:translateY(0) scale(0.5) rotate(0deg)}30%{opacity:1;transform:translateY(-40px) scale(1.2) rotate(40deg)}100%{opacity:0;transform:translateY(-90px) scale(0.4) rotate(120deg)}}
        @keyframes pdFlash{0%,100%{background:rgba(0,0,0,0)}50%{background:rgba(246,211,101,0.18)}}
        /* v94: per-level pirate level-clear entrances — each level feels different */
        @keyframes plClearL1{0%{transform:scale(0.2) rotate(-12deg);opacity:0}55%{transform:scale(1.15) rotate(6deg);opacity:1}75%{transform:scale(0.95) rotate(-3deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}
        @keyframes plClearL2{0%{transform:translateX(-160px) rotate(-20deg);opacity:0}60%{transform:translateX(12px) rotate(8deg);opacity:1}80%{transform:translateX(-4px) rotate(-3deg)}100%{transform:translateX(0) rotate(0deg);opacity:1}}
        @keyframes plClearL3{0%{transform:translateY(140px) scale(0.7);opacity:0}50%{transform:translateY(-18px) scale(1.1);opacity:1}70%{transform:translateY(8px) scale(0.97)}100%{transform:translateY(0) scale(1);opacity:1}}
        @keyframes plClearL4{0%{transform:scale(0.4);opacity:0}20%{transform:scale(1.1) rotate(-6deg);opacity:1}35%{transform:scale(1.05) rotate(6deg)}50%{transform:scale(1.08) rotate(-5deg)}65%{transform:scale(1.04) rotate(4deg)}80%{transform:scale(1.06) rotate(-2deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}
        @keyframes plClearL5{0%{transform:translateY(160px) scale(0.5) rotate(-15deg);opacity:0}40%{transform:translateY(-22px) scale(1.2) rotate(8deg);opacity:1}55%{transform:translateY(0) scale(1.1) rotate(-5deg)}70%{transform:translateY(-10px) scale(1.12) rotate(5deg)}85%{transform:translateY(0) scale(1.05) rotate(-2deg)}100%{transform:translateY(0) scale(1) rotate(0deg);opacity:1}}
        @keyframes plSpeechIn{0%{opacity:0;transform:translateY(8px) scale(0.9)}100%{opacity:1;transform:translateY(0) scale(1)}}
        /* v109: speech-bubble pop-in — scale-up bounce, origin bottom (tail). Replaces caption-below with a real PNG bubble above the mascot's head. */
        @keyframes bubbleIn{0%{opacity:0;transform:translateX(-50%) scale(0.9)}100%{opacity:1;transform:translateX(-50%) scale(1)}}
        @keyframes lootAnnounce{0%{transform:scale(0.85) translateY(20px);opacity:0}12%{transform:scale(1.03) translateY(0);opacity:1}85%{transform:scale(1) translateY(0);opacity:1}100%{transform:scale(0.95) translateY(-12px);opacity:0}}
        /* v128: Level-start banner — quick scale-in, hold, fade up. 2.5s total. */
        @keyframes levelAnnounce{0%{transform:scale(0.96) translateY(8px)}100%{transform:scale(1) translateY(0)}}
        /* v133: Trail-of-Loot target-pile flash (Stage 2). The coins for the level the player is HEADED
           to pulse (opacity + slight scale) to say "here's where you're going." Cleared piles stay static.
           1.2s loop, scale 1.22x, opacity dips to 0.55. --tx is the coin's per-coin x offset so the
           translate(-50%,-50%) centering is preserved through the scale. */
        @keyframes coinFlash{0%,100%{opacity:1;transform:translate(-50%,-50%) scale(1)}50%{opacity:0.55;transform:translate(-50%,-50%) scale(1.22)}}
        .ll-coin-flash{animation:coinFlash 1.2s ease-in-out infinite;}
        /* v133: L4->L5 chest fill. Each WP4 coin flies from its resting spot up into the chest and fades.
           --fx/--fy are the per-coin px delta from its position to the chest center (set inline). A short
           hold, then a launch arc, then shrink+fade as it drops into the chest. --dly staggers the pour. */
        @keyframes chestFly{
          0%{transform:translate(-50%,-50%) scale(1);opacity:1}
          22%{transform:translate(-50%,-50%) scale(1);opacity:1}
          60%{transform:translate(calc(-50% + var(--fx) * 0.6),calc(-50% + var(--fy) * 0.6)) scale(1.05);opacity:1}
          100%{transform:translate(calc(-50% + var(--fx)),calc(-50% + var(--fy))) scale(0.35);opacity:0}
        }
        .ll-coin-fly{animation:chestFly 0.9s cubic-bezier(.55,-0.2,.4,1) forwards;animation-delay:var(--dly);}
        @keyframes provethat{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
        @keyframes warningPulse{0%,100%{background:rgba(220,38,38,0.2)}50%{background:rgba(220,38,38,0.4)}}
        @keyframes purseGlow{0%,100%{box-shadow:0 0 18px rgba(139,92,246,0.7)}50%{box-shadow:0 0 32px rgba(167,139,250,0.95)}}
        /* v119: V/C danger pulse — smooth alternating rise/fade (NOT a strobe). The V
           box and C box run the SAME 2.5s two-beat cycle but OFFSET half a cycle, so
           the brightness peak walks V -> C -> V -> C. 2 iterations x 2.5s = ~5s, ~5-6
           perceived pulses across both boxes. filter+box-shadow only (no transform, no
           layout); when it ends the box drops back to its inline v118 resting glow.
           Smooth curve keeps it under Apple's flash/seizure guidance a hard blink would risk. */
        @keyframes vcPulseV{0%,100%{filter:brightness(1);box-shadow:0 0 8px rgba(255,255,255,0.15)}25%{filter:brightness(2.2);box-shadow:0 0 22px 4px rgba(255,255,255,0.55)}50%{filter:brightness(1);box-shadow:0 0 8px rgba(255,255,255,0.15)}}
        @keyframes vcPulseC{0%,50%,100%{filter:brightness(1);box-shadow:0 0 8px rgba(255,255,255,0.15)}75%{filter:brightness(2.2);box-shadow:0 0 22px 4px rgba(255,255,255,0.55)}}
        @keyframes recordFade{0%{opacity:1;transform:translateX(-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translateX(-50%) scale(0.92)}}
        @keyframes pulseBig{0%,100%{transform:scale(1);filter:brightness(1)}40%{transform:scale(1.22);filter:brightness(1.5)}70%{transform:scale(1.1);filter:brightness(1.3)}}
        @keyframes savedFade{0%{opacity:1}80%{opacity:1}100%{opacity:0}}
        .ll-tile{transition:all 0.14s ease;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;}
        .ll-tile:active{transform:scale(0.88)!important;}
        .ll-tile.sel{transform:translateY(-6px) scale(1.12);}
        .ll-tile.used{opacity:0.15;cursor:default;filter:grayscale(1);}
        .ll-tile.paused-tile{pointer-events:none;}
        .ll-tab{border:none;cursor:pointer;transition:all 0.2s;font-family:Georgia,serif;}
        .ll-btn{transition:all 0.14s;font-family:Georgia,serif;border:none;cursor:pointer;}
        .ll-btn:active{transform:scale(0.95);}
        .bonus-double{box-shadow:0 0 12px 3px rgba(255,215,0,0.8)!important;}
        .bonus-triple{box-shadow:0 0 14px 4px rgba(255,100,255,0.9)!important;}
        /* When a bonus tile is selected, the universal green selection glow
           must override the gold/purple bonus glow. Use !important to beat the
           !important above. */
        .ll-tile.sel.bonus-double,
        .ll-tile.sel.bonus-triple{box-shadow:0 0 12px 3px rgba(0,230,118,0.85),0 0 4px rgba(0,230,118,0.5)!important;}
        .perfect-text{animation:rainbow 2s linear infinite;}
        .replay-btn{animation:provethat 2s ease-in-out infinite;}
        .warning-box{animation:warningPulse 2s ease-in-out infinite;}
        .tour-btn{animation:purseGlow 2s ease-in-out infinite;}
        .pulse-big{animation:pulseBig 0.6s ease-out 3;}
        .saved-indicator{animation:savedFade 2s ease forwards;}
      `}</style>

      <ConfettiCanvas active={confetti && !rainbowConfetti} rainbow={false}/>
      <ConfettiCanvas active={rainbowConfetti} rainbow={true}/>

      {!online&&<div style={{position:"fixed",top:0,left:0,right:0,zIndex:99990,background:"rgba(220,38,38,0.95)",padding:"8px",textAlign:"center",fontSize:12,color:"#fff",fontFamily:"Georgia,serif"}}>📡 No internet — dictionary unavailable. Please reconnect.</div>}
      {cloudSyncing&&<div style={{position:"fixed",top:12,right:12,zIndex:9995,background:"rgba(167,139,250,0.2)",border:"1px solid rgba(167,139,250,0.4)",borderRadius:20,padding:"4px 12px",fontSize:10,color:"#a78bfa"}}>☁️ Syncing…</div>}
      {savedIndicator&&<div className="saved-indicator" style={{position:"fixed",top:12,left:"50%",transform:"translateX(-50%)",zIndex:9994,background:"rgba(110,231,183,0.2)",border:"1px solid rgba(110,231,183,0.4)",borderRadius:20,padding:"4px 12px",fontSize:10,color:"#6ee7b7",pointerEvents:"none"}}>✓ Progress saved</div>}

      {newRecord&&<div style={{position:"fixed",top:"35%",left:"50%",zIndex:9998,animation:"recordFade 2.5s ease forwards",background:newRecord.type==="score"?"linear-gradient(135deg,rgba(246,211,101,0.97),rgba(253,160,133,0.97))":"linear-gradient(135deg,rgba(96,165,250,0.97),rgba(139,92,246,0.97))",borderRadius:20,padding:`${ipadTour(16)}px ${ipadTour(28)}px`,boxShadow:"0 8px 40px rgba(0,0,0,0.7)",textAlign:"center",whiteSpace:"nowrap",border:"2px solid rgba(255,255,255,0.5)"}}>
        <div style={{fontSize:ipadTour(22),fontWeight:"bold",color:"#1a1a2e",letterSpacing:1}}>{newRecord.label}</div>
        <div style={{fontSize:ipadTour(11),color:"rgba(0,0,0,0.55)",marginTop:4,letterSpacing:2}}>PERSONAL BEST</div>
      </div>}

      {showTour&&<VisualTour onDone={completeTour}/>}

      {/* Word of the Day reminder toast — shows at level start until found */}
      {showWotdReminder && wotd && !wotdFound && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:9500,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:"12vh",paddingLeft:"20px",paddingRight:"20px",pointerEvents:"none"}}>
          {/* v130: anchored to LOWER area (bottom + 12vh) instead of center±90px. Now clearly below Loot. */}
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",border:"2px solid rgba(167,139,250,0.6)",borderRadius:18,padding:`${ipadTour(18)}px ${ipadTour(22)}px`,boxShadow:"0 10px 36px rgba(0,0,0,0.7)",fontFamily:"Georgia,serif",color:"#f5f0e8",maxWidth:ipadTour(300),width:"100%",textAlign:"center",pointerEvents:"auto"}}>
            <div style={{fontSize:ipadTour(10),color:"#a78bfa",letterSpacing:3,fontWeight:"bold",marginBottom:6}}>🎯 WORD OF THE DAY</div>
            <div style={{fontSize:ipadTour(22),fontWeight:"bold",color:"#f6d365",letterSpacing:2,marginBottom:8}}>{wotd}</div>
            <div style={{fontSize:ipadTour(12),color:"rgba(255,255,255,0.95)",marginBottom:12,lineHeight:1.5}}>Spell it — or any longer form — for <strong style={{color:"#fda085"}}>+1,000 pts, +200 per extra letter!</strong></div>
            <button onClick={dismissWotdReminder} style={{padding:`${ipadTour(8)}px ${ipadTour(22)}px`,borderRadius:11,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.25)",color:"#fff",fontFamily:"Georgia,serif",fontSize:ipadTour(12),fontWeight:"bold",cursor:"pointer"}}>Got it ✓</button>
          </div>
        </div>
      )}

      {/* Word of the Day celebration — fires when player spells the WoD */}
      {wotdCelebration && (
        <div style={{position:"fixed",inset:0,zIndex:9650,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",padding:"20px"}}>
          {/* v169-v171 (v1.2 #12): illustrated WoD panel. Was a purple card with a 🎯✨ emoji, a
              "WORD OF THE DAY!" label, the word, and "+1,000 pts!".
              Now: the pirate and one line. Nothing else.
              Rationale (Daryl, July 9): finding, spelling and submitting the Word of the Day is an
              exceedingly deliberate act the player just performed — there is no question what the
              celebration is for, so the label is redundant, and so is echoing the word back. The
              saying carries the +1,000 itself.
              NOT gated by the mascot toggle: WoD is a STANDALONE celebration, fires at most once
              per game, and is the biggest single prize. Every player sees it. */}
          <div style={{background:"linear-gradient(135deg,#a78bfa,#7c3aed)",border:"3px solid #f6d365",borderRadius:22,padding:`${ipadIntro(22)}px ${ipadIntro(24)}px`,boxShadow:"0 0 60px rgba(246,211,101,0.6),0 12px 40px rgba(0,0,0,0.7)",fontFamily:"Georgia,serif",textAlign:"center",animation:"wotdPop 8s forwards",maxWidth:ipadIntro(340),width:"100%"}}>
            <img src="/wotd-pirate.png" alt="" style={{display:"block",height:ipadIntro(340),width:"auto",margin:"0 auto",filter:"drop-shadow(0 6px 12px rgba(0,0,0,0.5))",animation:"plClearL4 0.9s cubic-bezier(.34,1.56,.64,1) forwards"}}/>
            {/* Darkened band behind the saying. The card is a gradient, and gold (#f6d365) on its
                LIGHT end (#a78bfa) measures 1.87:1 contrast — unreadable, the same mistake we just
                fixed on the speech bubbles. Off-white on a 22% black scrim holds contrast wherever
                the gradient lands. (Daryl chose the band over plain off-white.) */}
            <div style={{marginTop:ipadIntro(14),background:"rgba(0,0,0,0.22)",borderRadius:14,padding:`${ipadIntro(10)}px ${ipadIntro(12)}px`}}>
              <div style={{fontSize:ipadIntro(15),color:"#fdf6e3",fontStyle:"italic",fontWeight:"bold",lineHeight:1.45}}>{pickWotdSaying((typeof wotdCelebration === "object" && wotdCelebration && wotdCelebration.bonus) || 1000, !!(typeof wotdCelebration === "object" && wotdCelebration && wotdCelebration.grew))}</div>
            </div>
          </div>
        </div>
      )}

      {/* (v129) TREASURE MAP LEVEL WELCOME PAGE — Kim's "Trail of Loot" (STAGE 1: static).
          Full-screen map interlude on each level open. Shows the current level, a Good Luck line, the
          timer note, and ACCUMULATING gold-doubloon coin piles at trail waypoints charting progress
          (L1=1 coin … L4=4 coins, clockwise from the X to the chest). Dwells 10s auto OR the
          "Course is Set. Let's Sail!" button dismisses early — either path calls dismissLevelWelcome()
          which fires the Loot+WoD sequence and reveals the board. NOT gated by the mascot toggle.
          Stage 2 (v130) will add: pulse on the next-target pile, trail-fill, chest-fills-at-L5. */}
      {levelAnnounceNum != null && (() => {
        // Waypoint coords as fractions of the map image (traced off level-map-bg). Clockwise from X.
        // Each entry: the level it represents + its position. Coin count shown = the level number,
        // for every level ALREADY CLEARED (i.e. < current level). Accumulating & persistent.
        const WAYPTS = [
          { lvl: 1, x: 0.729, y: 0.631 }, // right
          { lvl: 2, x: 0.332, y: 0.705 }, // lower-left
          { lvl: 3, x: 0.255, y: 0.474 }, // mid-left
          { lvl: 4, x: 0.339, y: 0.276 }, // upper-left
        ];
        const COIN = isIpadWidth() ? 64 : 42; // on-map coin diameter (px), tunable
        // v133: chest center traced off the actual level-map-bg art (952x1288). The L5 "treasure
        // reached" payoff flies the WP4 coins into this point.
        const CHEST = { x: 0.495, y: 0.145 };
        // Map render box in px (min(92vw,62vh)) — needed to convert the chest's fractional position
        // into the per-coin px delta the fly animation uses. Aspect-locked 1085:1450.
        const mapW = Math.min(window.innerWidth * 0.92, window.innerHeight * 0.62);
        const mapH = mapW * (1450 / 1085);
        // Render a pile of `n` coins clustered around a waypoint (sunflower stagger).
        // mode: "static" (cleared, no anim), "flash" (target level — pulse), "fly" (L5 chest fill).
        // v147: optional `n` override — the L5 chest fly emits 5 (the L5 clear's own coins going to the
        // treasure), while the resting WP4 pile keeps its 4. Defaults to wp.lvl for static/flash.
        const pile = (wp, mode = "static", n = wp.lvl) => {
          const coins = [];
          for (let i = 0; i < n; i++) {
            // v131: wider spread so all coins in a pile are distinct/countable (L4's 4 coins were
            // overlapping to look like 3). Larger radius + golden-angle fan; small pile-specific
            // layouts keep them tidy. Slight vertical lift per coin for a stacked-pile feel.
            const ang = i * 2.399 + 0.6;
            const rad = i === 0 ? 0 : COIN * 0.62 * Math.sqrt(i);
            const ox = Math.cos(ang) * rad;
            const oy = Math.sin(ang) * rad - i * 5;
            const cls = mode === "flash" ? "ll-coin-flash" : mode === "fly" ? "ll-coin-fly" : undefined;
            const extra = {};
            if (mode === "fly") {
              // px delta from this coin's resting spot to the chest center.
              const fx = (CHEST.x - wp.x) * mapW - ox;
              const fy = (CHEST.y - wp.y) * mapH - oy;
              extra["--fx"] = `${fx}px`;
              extra["--fy"] = `${fy}px`;
              extra["--dly"] = `${0.55 + i * 0.22}s`; // stagger the pour, after a brief look
            }
            coins.push(
              <img key={`${wp.lvl}-${i}-${mode}`} src="/trail-coin.png" alt="" className={cls} style={{
                position:"absolute", width:COIN, height:"auto",
                left:`calc(${wp.x*100}% + ${ox}px)`, top:`calc(${wp.y*100}% + ${oy}px)`,
                transform:"translate(-50%,-50%)", pointerEvents:"none",
                // v161: golden glow (lighter than the coin edge) so coins pop off the busy parchment
                // WITHOUT the dark drop-shadow "oxidation/tarnish" look. Layered light-gold halos.
                filter:"drop-shadow(0 0 6px rgba(255,214,90,0.95)) drop-shadow(0 0 14px rgba(255,190,40,0.7))",
                ...extra,
              }} />
            );
          }
          return coins;
        };
        return (
          <div style={{position:"fixed",inset:0,zIndex:9620,display:"flex",alignItems:"center",justifyContent:"center",background:"#0a0719"
              /* v143: scrim is now FULLY OPAQUE (#0a0719). A 55%-translucent scrim let the freshly
                 swapped tile board show through during the map-<img> decode gap — the real cause of the
                 L2-L5 glimpse. Solid dark hides everything behind until the map paints on top. */}}>
            {/* Map container — aspect-ratio locked so waypoint % coords land correctly on the art.
                v135: the parchment is now a real <img> (below) instead of a CSS background-image.
                A CSS background-image decodes async and paints one frame late while the overlay's
                levelAnnounce fade runs — so the coins/text (immediate DOM) showed first and the map
                "flashed" in. An <img> (already preloaded on mount) paints with the element, no pop. */}
            <div style={{position:"relative",width:"min(92vw, 62vh)",aspectRatio:"1085 / 1450",fontFamily:"Georgia,serif",boxShadow:"0 12px 60px rgba(0,0,0,0.7)",
                /* v139: the map container is held hidden until its <img> decodes, then settles in.
                   visibility:hidden keeps the <img> mounted so onLoad/ref still fire. The scrim above
                   is already visible, so the reveal is scrim → map, never board → map. */
                visibility: mapReady ? "visible" : "hidden",
                animation: mapReady ? "levelAnnounce 0.4s ease-out" : "none"}}>
              <img src="/level-map-bg.jpg" alt=""
                   onLoad={() => setMapReady(true)}
                   ref={(el) => { if (el && el.complete && el.naturalWidth > 0) setMapReady(true); }}
                   style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",pointerEvents:"none"}} />
              {/* Static accumulating piles for every CLEARED level below the current target.
                  v147: WP4 now KEEPS its static 4-coin pile on L5 too (consistency — L4 is cleared, so
                  its checkpoint stays populated). The chest fly (below) is a SEPARATE set of 5 coins. */}
              {WAYPTS.filter(wp => wp.lvl < levelAnnounceNum)
                     .flatMap(wp => pile(wp, "static"))}
              {/* v133: FLASHING target pile — the level the player is HEADED to (L2-L4). Opacity+scale
                  pulse says "here's where you're going next." L5 has no WP5, so it uses the chest fly. */}
              {levelAnnounceNum <= 4 && (() => {
                const t = WAYPTS.find(wp => wp.lvl === levelAnnounceNum);
                return t ? pile(t, "flash") : null;
              })()}
              {/* v133: L4->L5 chest fill — the L5 clear's own 5 doubloons fly up into the chest (the
                  payoff). v147: 5 coins (was 4) and INDEPENDENT of the resting WP4 pile above. */}
              {levelAnnounceNum === 5 && pile(WAYPTS.find(wp => wp.lvl === 4), "fly", 5)}
              {/* v173: Title + dismiss button are ONE flow column, not two absolutely-positioned
                  blocks. Two bugs were compounding here:
                    1. The text sized with `vh` (VIEWPORT height) while both blocks positioned with
                       `%` (CONTAINER height). The map container is roughly half the viewport on a
                       phone, so "Level N" rendered at 7vh = 64px inside a ~430px box — the text
                       block grew until it ran under the button, which sat at a fixed top:50%.
                    2. Two absolute siblings can't push each other apart, so nothing could give.
                  Now: one flex column bounded to the map's empty middle band (20%..60%). The button
                  follows the text in normal flow, so it can NEVER overlap it, whatever the fonts
                  resolve to. The band's bottom edge (60%) also keeps the button clear of the
                  flashing L1 coin at WP1 (~63%) — the constraint v134 was hand-tuning for.
                  Fonts now scale to the container via clamp() on `%`-free px values. */}
              <div style={{position:"absolute",top:"20%",bottom:"40%",left:0,right:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:isIpadWidth()?14:9,padding:"0 10%",pointerEvents:"none"}}>
                <div style={{textAlign:"center",pointerEvents:"none"}}>
                  <div style={{color:"#961c18",fontWeight:"bold",fontSize:isIpadWidth()?64:34,textShadow:"2px 2px 0 rgba(70,45,20,0.5)",lineHeight:1}}>Level {levelAnnounceNum}</div>
                  <div style={{color:"#8a6a1c",fontWeight:"bold",fontSize:isIpadWidth()?38:21,marginTop:"0.35em",textShadow:"1px 1px 0 rgba(70,45,20,0.4)",lineHeight:1.1}}>Good Luck!</div>
                </div>
                <button onClick={dismissLevelWelcome} style={{pointerEvents:"auto",padding:`${isIpadWidth()?10:7}px ${isIpadWidth()?22:16}px`,borderRadius:10,background:"rgba(250,243,220,0.92)",color:"#1a1208",fontFamily:"Georgia,serif",fontWeight:"bold",fontStyle:"italic",fontSize:isIpadWidth()?19:14,border:"2px solid #2a1c0a",boxShadow:"0 3px 10px rgba(0,0,0,0.4)",cursor:"pointer",whiteSpace:"nowrap"}}>Tap to Dismiss Map</button>
              </div>
              {/* v231: GUEST-ONLY account prompt on the level map. Daryl: "There's plenty of room on
                  the Level Map page... they will stick out like a sore thumb. But only in guest play."
                  WHY HERE: the in-flow button at the bottom of the game screen (~7104) is COMPLETELY
                  INVISIBLE without scrolling on a narrow iPhone — measured pageOver 111-141px on the
                  Air, and the button sits ~121px below the board. A conversion element below the fold
                  is effectively absent. The level map is a natural pause, has empty space, and a guest
                  passes through it on every level.
                  PLACEMENT: deliberately NOT a third child of the flex column above — see the v134
                  note there. That column is bounded 20%..60% precisely so the text and dismiss button
                  can't collide, and so the stack stays clear of the flashing L1 coin at ~63%. Adding
                  a child would grow the stack downward and re-break it. This sits in its own absolute
                  band well below the coin instead.
                  NOT added to the end-of-game screens: those already have a full benefits panel
                  (~6495), a streak upsell (~6442), and a leaderboard nudge (~5867). */}
              {isGuest&&<div style={{position:"absolute",left:0,right:0,bottom:"6%",display:"flex",justifyContent:"center",pointerEvents:"none"}}>
                <button onClick={(e)=>{e.stopPropagation();onSignUpRequest?.();}} style={{pointerEvents:"auto",padding:`${isIpadWidth()?12:9}px ${isIpadWidth()?26:18}px`,borderRadius:12,border:"none",background:"linear-gradient(135deg,#a78bfa,#7c3aed)",color:"#fff",fontWeight:"bold",fontSize:isIpadWidth()?18:13,boxShadow:"0 4px 18px rgba(124,58,237,0.65)",cursor:"pointer"}}>
                  ☁️ Create Account to Save Progress
                </button>
              </div>}
            </div>
          </div>
        );
      })()}

      {/* (v106) Loot Letter announcement — brief informational popup at level open.
          NOT a celebration; ungated by the mascot toggle. Auto-dismisses (2s via
          fireLootAnnounce). Non-interactive (pointerEvents none). */}
      {lootAnnounceLevel != null && (
        <div style={{position:"fixed",top:0,left:0,right:0,zIndex:9600,display:"flex",alignItems:"flex-start",justifyContent:"center",pointerEvents:"none",paddingTop:"12vh",paddingLeft:"20px",paddingRight:"20px"}}>
          {/* v130: anchored to UPPER area (top + 12vh) instead of center±90px, which wasn't enough
              separation — Loot and WoD were still overlapping. Now Loot sits high, WoD sits low. */}
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:`${ipadIntro(24)}px ${ipadIntro(34)}px`,textAlign:"center",border:"1.5px solid rgba(246,211,101,0.5)",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",fontFamily:"Georgia,serif",animation:"lootAnnounce 2.5s forwards"}}>
            <div style={{fontSize:ipadIntro(13),color:"#fde68a",fontWeight:"bold",letterSpacing:1,marginBottom:2}}>💥 LOOT LETTER</div>
            <div style={{fontSize:ipadIntro(18),color:"#f6d365",fontWeight:"bold",marginBottom:ipadIntro(16)}}>Level {lootAnnounceLevel}</div>
            <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:ipadIntro(88),height:ipadIntro(88),borderRadius:16,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadIntro(56),fontWeight:"bold",boxShadow:"0 0 28px rgba(246,211,101,0.6)"}}>{getLootLetterForLevel(lootAnnounceLevel)}</div>
          </div>
        </div>
      )}

      {/* Loot Letter celebration — fires when player uses a level's Loot Letter in a valid word (one per level, 5 per game) */}
      {lootCelebration && (
        <div style={{position:"fixed",inset:0,zIndex:finisherOverlay?9730:9700,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",padding:"20px"}}>
          {/* v199: when the FinisherOverlay is active, this co-fires WITH it — anchored to the
              BOTTOM so it sits below the chest (OK to cover the Dismiss Page button), and z-raised
              above FF (9720) so it's visible on the dark FF backdrop. Otherwise: unchanged (centered). */}
          {/* v200/v201: scaler wrapper — the card's own wotdPop animation drives transform, so the
              co-fire shrink lives HERE on a separate element (0.4 → ~60% smaller). v201: the card is
              CENTERED (in the chest region) and pushed DOWN by FF_LOOT_NUDGE so it lands on the BROWN
              chest body, below the gold coins (gold-on-gold would camouflage it). translateY is applied
              BEFORE scale so the nudge is in real screen pixels. Both numbers are tunable on-device:
              nudge = how far down onto the chest; 0.4 = size. */}
          <div style={finisherOverlay?{transform:`translateY(${ipadTour(150)}px) scale(0.4)`,transformOrigin:"center center"}:{transform:`scale(${LOOT_SCALE})`,transformOrigin:"center center"}}>
          <div style={{background:"linear-gradient(135deg,#f6d365,#fda085)",border:"3px solid #00e676",borderRadius:22,padding:`${ipadIntro(24)}px ${ipadIntro(32)}px`,boxShadow:"0 0 80px rgba(246,211,101,0.9),0 0 30px rgba(0,230,118,0.6),0 12px 40px rgba(0,0,0,0.7)",fontFamily:"Georgia,serif",textAlign:"center",animation:"wotdPop 4s forwards",maxWidth:ipadIntro(340),width:"90%",margin:"0 auto"}}>
            <div style={{fontSize:ipadIntro(42),marginBottom:6}}>💥✨</div>
            <div style={{fontSize:ipadIntro(18),color:"#1a1a2e",letterSpacing:4,fontWeight:"bold",marginBottom:10}}>💥 LOOT LETTER! 💥</div>
            {/* Big tile-style display of today's actual Loot Letter */}
            {lootCelebration.letter && (
              <div style={{display:"inline-block",background:"linear-gradient(135deg,#1a1a2e,#2d1b69)",border:"3px solid #00e676",borderRadius:14,padding:`${ipadIntro(12)}px ${ipadIntro(22)}px`,marginBottom:12,boxShadow:"0 0 20px rgba(0,230,118,0.6),inset 0 0 12px rgba(255,255,255,0.1)"}}>
                <div style={{fontSize:ipadIntro(42),fontWeight:"bold",color:"#f6d365",letterSpacing:2,lineHeight:1,textShadow:"0 0 12px rgba(246,211,101,0.8)"}}>{lootCelebration.letter}</div>
              </div>
            )}
            <div style={{fontSize:ipadIntro(13),color:"#2d1b00",fontWeight:"bold",marginBottom:6}}>Loot Letter Found!</div>
            <div style={{fontSize:ipadIntro(16),fontWeight:"bold",color:"#003300"}}>5× Letter Bonus Applied!</div>
            <div style={{fontSize:ipadIntro(14),fontWeight:"bold",color:"#003300",marginTop:4}}>+{lootCelebration.score} pts on this word</div>
          </div>
          </div>
        </div>
      )}

      {/* PREVIEW render (debug-triggered via greatWordPreview). v168: shares GreatWordOverlay
          with the live block, so the preview is guaranteed to show exactly what players see.
          State stays isolated (own variable, no rotation counter / guard touched). */}
      {greatWordPreview && <GreatWordOverlay line={greatWordPreview.line}/>}
      {finisherOverlay && <FinisherOverlay len={finisherOverlay.len} bonus={finisherOverlay.bonus} onDismiss={dismissFinisherOverlay}/>}

      {/* v116 (#16): LIVE render (real word-submit trigger via greatWordCelebration).
          v168: same GreatWordOverlay component as the preview above — separate STATE, shared
          markup, so the two can never drift apart again (they had: bw 1.15 vs 1.27). */}
      {greatWordCelebration && <GreatWordOverlay line={greatWordCelebration.line}/>}

      {showBadge&&(()=>{ const b=BADGE_DEFS.find(x=>x.id===showBadge); return b?(<div style={{position:"fixed",top:72,left:"50%",zIndex:9998,animation:"badgePop 5s forwards",background:"linear-gradient(135deg,#f6d365,#fda085)",borderRadius:20,padding:`${ipadTour(12)}px ${ipadTour(26)}px`,boxShadow:"0 8px 32px rgba(0,0,0,0.7)",textAlign:"center",whiteSpace:"nowrap"}}>
        <div style={{display:"flex",justifyContent:"center"}}>{renderBadgeIcon(b)}</div>
        <div style={{fontWeight:"bold",color:"#1a1a2e",fontSize:ipadTour(13)}}>Badge Earned!</div>
        <div style={{color:"#2d1b00",fontSize:ipadTour(12),fontWeight:"bold"}}>{b.label}{showBadgeExtra?` — ${showBadgeExtra}`:""}</div>
      </div>):null; })()}

      {flash&&<div style={{position:"fixed",top:"40%",left:"50%",zIndex:9997,animation:"pop 0.3s ease forwards",background:flash.valid?(flash.medical?"rgba(0,150,200,0.97)":"rgba(30,160,70,0.97)"):"rgba(190,30,30,0.96)",borderRadius:18,padding:`${ipadTour(14)}px ${ipadTour(30)}px`,boxShadow:"0 6px 28px rgba(0,0,0,0.7)",textAlign:"center"}}>
        <div style={{fontSize:ipadTour(20),fontWeight:"bold",letterSpacing:3,color:"#fff"}}>{flash.word}</div>
        <div style={{fontSize:flash.valid?ipadTour(16):ipadTour(13),color:"#fff",marginTop:4}}>{flash.valid&&flash.score>0?`+${flash.score} pts ${flash.medical?"🩺 Medical":flash.collegiate?"📖":""}`:flash.valid?"":(flash.lookupFail?"Tap Submit to retry":"Not a valid word!")}</div>
      </div>}

      {showShareMenu && renderShareMenu()}

      {showGuestStreakUpsell&&<div style={{position:"fixed",inset:0,zIndex:9750,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}} onClick={()=>setShowGuestStreakUpsell(false)}>
        <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:20,padding:`${ipadTour(24)}px ${ipadTour(20)}px`,border:"2px solid rgba(246,211,101,0.5)",fontFamily:"Georgia,serif",color:"#f5f0e8",maxWidth:ipadTour(320),width:"100%",textAlign:"center"}}>
          <div style={{fontSize:ipadTour(36),marginBottom:4}}>🌈🏆</div>
          <div style={{fontSize:ipadTour(17),fontWeight:"bold",color:"#f6d365",marginBottom:6}}>Sign in to compete + stack points</div>
          <div style={{fontSize:ipadTour(12),color:"rgba(255,255,255,0.85)",marginBottom:ipadTour(16),lineHeight:1.5,fontStyle:"italic"}}>Get on the Leaderboard. Earn streak bonuses that REALLY add up.</div>
          <div style={{background:"rgba(246,211,101,0.1)",borderRadius:12,padding:`${ipadTour(12)}px ${ipadTour(10)}px`,marginBottom:ipadTour(16),border:"1px solid rgba(246,211,101,0.3)"}}>
            <div style={{fontSize:ipadTour(11),color:"rgba(255,255,255,0.7)",marginBottom:6}}>Streak Bonus Example</div>
            <div style={{fontSize:ipadTour(13),color:"#f6d365",fontWeight:"bold"}}>7 days = +8,000 pts</div>
            <div style={{fontSize:ipadTour(13),color:"#f6d365",fontWeight:"bold"}}>14 days = +15,000 pts</div>
          </div>
          <button onClick={()=>{ setShowGuestStreakUpsell(false); onSignUpRequest?.(); }} style={{width:"100%",padding:`${ipadTour(12)}px ${ipadTour(16)}px`,marginBottom:ipadTour(8),borderRadius:12,background:"linear-gradient(135deg,#a78bfa,#7c3aed)",color:"#fff",fontSize:ipadTour(14),fontWeight:"bold",fontFamily:"Georgia,serif",border:"none",cursor:"pointer"}}>
            Create Free Account
          </button>
          <button onClick={()=>setShowGuestStreakUpsell(false)} style={{width:"100%",padding:`${ipadTour(10)}px ${ipadTour(14)}px`,borderRadius:11,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.85)",fontSize:ipadTour(13),fontFamily:"Georgia,serif",cursor:"pointer"}}>
            Maybe Later
          </button>
        </div>
      </div>}

      {/* v60: removed rejectedWord modal — was dead code, live game uses showStuckModal (bug #14) */}

      {(validating||checkingStuck)&&<div style={{position:"fixed",top:"40%",left:"50%",transform:"translate(-50%,-50%)",background:"rgba(10,8,30,0.97)",borderRadius:20,padding:`${ipadTour(18)}px ${ipadTour(34)}px`,zIndex:9996,boxShadow:"0 6px 30px rgba(0,0,0,0.8)",textAlign:"center",border:"1px solid rgba(255,255,255,0.2)"}}>
        <div style={{animation:"spin 1s linear infinite",display:"inline-block",transformOrigin:"center"}}><PencilIcon size={ipadTour(60)}/></div>
        <div style={{fontSize:ipadTour(12),marginTop:8,color:"#ccc",letterSpacing:2}}>{checkingStuck?"SCANNING TILES…":"CHECKING…"}</div>
      </div>}

      {showUndoConfirm&&<div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:ipadTour(32),textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,255,255,0.18)",maxWidth:ipadTour(300),width:"90%"}}>
          <div style={{fontSize:ipadTour(40)}}>↩️</div>
          <div style={{fontSize:ipadTour(18),fontWeight:"bold",color:"#f5f0e8",marginTop:8}}>Undo Last Word?</div>
          <div style={{fontSize:ipadTour(13),color:"#ddd",marginTop:8,lineHeight:1.6}}>Reverse <span style={{color:"#f6d365",fontWeight:"bold"}}>{lastValidEntry?.word}</span> (+{lastValidEntry?.score} pts)<br/>Cost: <span style={{color:"#fb7185",fontWeight:"bold"}}>{isBonusLevel(level)?"10,000 pts":"1,000 pts"}</span><br/>Your balance: {totalScore} pts</div>
          <div style={{fontSize:ipadTour(11),color:"#6ee7b7",marginTop:6}}>✓ Your Perfect Day stays intact</div>
          <button className="ll-btn" onClick={handleUndo} style={{marginTop:16,width:"100%",padding:ipadTour(13),borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(14),fontWeight:"bold"}}>↩️ Yes, Undo — 1,000 pts</button>
          <button className="ll-btn" onClick={()=>setShowUndoConfirm(false)} style={{marginTop:8,width:"100%",padding:ipadTour(10),borderRadius:12,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.9)",fontSize:ipadTour(12)}}>Keep It</button>
        </div>
      </div>}

      {/* (v103) "Start a New Game?" confirm modal removed along with its mid-play button. */}

      {showEndGameConfirm&&<div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:ipadTour(32),textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,255,255,0.18)",maxWidth:ipadTour(320),width:"90%",fontFamily:"Georgia,serif",color:"#f5f0e8"}}>
          <div style={{fontSize:ipadTour(40)}}>🏁</div>
          <div style={{fontSize:ipadTour(18),fontWeight:"bold",color:"#f5f0e8",marginTop:8}}>End Game &amp; Share Results?</div>
          <div style={{fontSize:ipadTour(13),color:"rgba(255,255,255,0.9)",marginTop:10,lineHeight:1.5}}>This ends today's game and takes you to your results, where you can share them.</div>
          <div style={{fontSize:ipadTour(12),color:"#ddd",marginTop:8,lineHeight:1.5}}>Level {level} · Score: {totalScore.toLocaleString()} pts · Words played: {(submittedRef.current||[]).filter(s=>s.valid).length}</div>
          <button className="ll-btn" onClick={()=>{ setShowEndGameConfirm(false); triggerFarewell(); }} style={{marginTop:16,width:"100%",padding:ipadTour(13),borderRadius:14,background:"linear-gradient(135deg,#34d399,#10b981)",color:"#003322",fontSize:ipadTour(14),fontWeight:"bold",border:"none"}}>
            🏁 End Game &amp; Share Results
          </button>
          <button className="ll-btn" onClick={()=>setShowEndGameConfirm(false)} style={{marginTop:8,width:"100%",padding:ipadTour(10),borderRadius:12,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.95)",fontSize:ipadTour(13),fontWeight:"bold"}}>Keep Playing</button>
        </div>
      </div>}

      {showGuestUpsell&&<div style={{position:"fixed",inset:0,zIndex:9200,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:`${ipadTour(28)}px ${ipadTour(24)}px`,textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,255,255,0.2)",maxWidth:ipadTour(320),width:"100%",fontFamily:"Georgia,serif",color:"#f5f0e8"}}>
          <div style={{fontSize:ipadTour(36),marginBottom:6}}>🏆</div>
          <div style={{fontSize:ipadTour(16),fontWeight:"bold",color:"#f6d365",marginBottom:10}}>Sign up to unlock more</div>
          <div style={{fontSize:ipadTour(12),color:"rgba(255,255,255,0.95)",lineHeight:1.6,marginBottom:14}}>Create a free account to:</div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:10,padding:`${ipadTour(12)}px ${ipadTour(14)}px`,marginBottom:18,fontSize:ipadTour(12),color:"rgba(255,255,255,0.95)",lineHeight:2,textAlign:"left"}}>
            <div>✓ Save your game progress</div>
            <div>✓ Share Perfect Day successes</div>
            <div>✓ View the Leaderboard</div>
            <div>✓ Track stats &amp; history</div>
          </div>
          <button className="ll-btn" onClick={onSignUpRequest} style={{width:"100%",padding:ipadTour(13),borderRadius:12,border:"none",background:"linear-gradient(135deg,#a78bfa,#7c3aed)",color:"#fff",fontSize:ipadTour(14),fontWeight:"bold",fontFamily:"Georgia,serif",cursor:"pointer",marginBottom:8}}>
            Create Free Account
          </button>
          <button className="ll-btn" onClick={()=>{ setShowGuestUpsell(false); setShowIntro(true); setTab("play"); setPerfectDayAchieved(false); setShowRepeatPerfect(false); }} style={{width:"100%",padding:ipadTour(10),borderRadius:12,background:"transparent",color:"rgba(255,255,255,0.9)",fontSize:ipadTour(12),fontFamily:"Georgia,serif",border:"1px solid rgba(255,255,255,0.18)",cursor:"pointer"}}>
            Maybe Later
          </button>
        </div>
      </div>}

      {/* Delete Account two-step confirmation (May 15, 2026) */}
      {showDeleteAccount&&<div style={{position:"fixed",inset:0,zIndex:9300,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:`${ipadTour(28)}px ${ipadTour(24)}px`,textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.85)",border:"2px solid rgba(239,68,68,0.5)",maxWidth:ipadTour(340),width:"100%",fontFamily:"Georgia,serif",color:"#f5f0e8"}}>
          <div style={{fontSize:ipadTour(40),marginBottom:6}}>⚠️</div>
          <div style={{fontSize:ipadTour(18),fontWeight:"bold",color:"#fca5a5",marginBottom:10}}>Delete Your Account?</div>
          <div style={{fontSize:ipadTour(13),color:"rgba(255,255,255,0.95)",lineHeight:1.6,marginBottom:14,textAlign:"left"}}>
            This will <strong style={{color:"#fca5a5"}}>permanently delete</strong>:
          </div>
          <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:`${ipadTour(10)}px ${ipadTour(14)}px`,marginBottom:14,fontSize:ipadTour(12),color:"rgba(255,255,255,0.95)",lineHeight:1.9,textAlign:"left"}}>
            <div>✗ Your account &amp; email</div>
            <div>✗ All game history &amp; stats</div>
            <div>✗ Perfect Days, streaks, badges</div>
            <div>✗ Leaderboard entries</div>
          </div>
          <div style={{fontSize:ipadTour(12),color:"rgba(255,255,255,0.9)",marginBottom:10,lineHeight:1.5}}>
            This cannot be undone. To confirm, type <strong style={{color:"#fca5a5"}}>DELETE</strong> below:
          </div>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e)=>setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            style={{width:"100%",padding:`${ipadTour(10)}px ${ipadTour(12)}px`,borderRadius:10,border:"1.5px solid rgba(239,68,68,0.4)",background:"rgba(0,0,0,0.3)",color:"#fff",fontSize:ipadTour(14),fontFamily:"Georgia,serif",textAlign:"center",letterSpacing:2,marginBottom:14,boxSizing:"border-box"}}
            disabled={deletingAccount}
          />
          <button
            onClick={async ()=>{
              if (deleteConfirmText.trim().toUpperCase() !== "DELETE") return;
              setDeletingAccount(true);
              try { await onDeleteAccount?.(); } catch {}
              setDeletingAccount(false);
              setShowDeleteAccount(false);
              setDeleteConfirmText("");
            }}
            disabled={deletingAccount || deleteConfirmText.trim().toUpperCase() !== "DELETE"}
            style={{width:"100%",padding:ipadTour(13),borderRadius:12,border:"none",background: (deletingAccount || deleteConfirmText.trim().toUpperCase() !== "DELETE") ? "rgba(239,68,68,0.25)" : "linear-gradient(135deg,#dc2626,#991b1b)",color:"#fff",fontSize:ipadTour(14),fontWeight:"bold",fontFamily:"Georgia,serif",cursor: (deletingAccount || deleteConfirmText.trim().toUpperCase() !== "DELETE") ? "not-allowed" : "pointer",marginBottom:8,opacity: deletingAccount ? 0.7 : 1}}
          >
            {deletingAccount ? "Deleting…" : "Delete My Account Permanently"}
          </button>
          <button
            onClick={()=>{ setShowDeleteAccount(false); setDeleteConfirmText(""); }}
            disabled={deletingAccount}
            style={{width:"100%",padding:ipadTour(10),borderRadius:12,background:"transparent",color:"rgba(255,255,255,0.95)",fontSize:ipadTour(13),fontFamily:"Georgia,serif",border:"1px solid rgba(255,255,255,0.25)",cursor: deletingAccount ? "not-allowed" : "pointer"}}
          >
            Cancel
          </button>
        </div>
      </div>}

      {showResetConfirm&&<div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:"32px",textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,255,255,0.18)",maxWidth:300,width:"90%"}}>
          <div style={{fontSize:40}}>🔄</div>
          <div style={{fontSize:18,fontWeight:"bold",color:"#f5f0e8",marginTop:8}}>Try Level {level} Again?</div>
          {level===5?(<>
            <div style={{fontSize:13,color:"#fb7185",marginTop:8,lineHeight:1.6,fontWeight:"bold"}}>⚠️ Retrying Level 5 costs 1,000 pts</div>
            <div style={{fontSize:12,color:"#bbb",marginTop:4}}>Your balance: {totalScore} pts · {totalScore>=1000?<span style={{color:"#6ee7b7"}}>✓ Enough</span>:<span style={{color:"#fb7185"}}>✗ Not enough</span>}</div>
          </>):(<div style={{fontSize:13,color:"#bbb",marginTop:8,lineHeight:1.6}}>Progress on Level {level} will be lost.<br/>Total score is kept · Same tiles used.</div>)}
          <button className="ll-btn" onClick={doLevelReset} disabled={level===5&&totalScore<1000} style={{marginTop:16,width:"100%",padding:"13px",borderRadius:14,background:level===5&&totalScore<1000?"rgba(255,255,255,0.1)":"linear-gradient(135deg,#fb7185,#e11d48)",color:level===5&&totalScore<1000?"rgba(255,255,255,0.3)":"#fff",fontSize:14,fontWeight:"bold",cursor:level===5&&totalScore<1000?"default":"pointer"}}>
            {level===5?"🔄 ReTry L5 — 1,000 pts":`Yes, Try Level ${level} Again`}
          </button>
          <button className="ll-btn" onClick={()=>setShowResetConfirm(false)} style={{marginTop:8,width:"100%",padding:"10px",borderRadius:12,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.5)",fontSize:12}}>Keep Playing</button>
        </div>
      </div>}

      {showStuckModal&&<div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:ipadTour(32),textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,255,255,0.18)",maxWidth:ipadTour(320),width:"90%"}}>
          <div style={{fontSize:ipadTour(52)}}>😬</div>
          <div style={{fontSize:ipadTour(20),fontWeight:"bold",color:"#f5f0e8",marginTop:8}}>No More Valid Words!</div>
          <div style={{fontSize:ipadTour(13),color:"#bbb",marginTop:8,lineHeight:1.6}}>No valid words can be formed from the remaining tiles.</div>
          <div style={{fontSize:ipadTour(22),color:"#f6d365",fontWeight:"bold",marginTop:10}}>{totalScore} pts so far</div>
          {/* UNDO option if still available — full width */}
          {!undoUsed&&lastValidEntry&&totalRef.current>=1000&&(
            <button className="ll-btn" onClick={()=>{ setShowStuckModal(false); setShowUndoConfirm(true); }} style={{marginTop:14,width:"100%",padding:ipadTour(12),borderRadius:12,background:"linear-gradient(135deg,rgba(251,113,133,0.6),rgba(225,29,72,0.5))",border:"1px solid rgba(251,113,133,0.9)",color:"#ffffff",fontSize:ipadTour(13),fontWeight:"bold"}}>
              ↩️ UNDO Last Word — 1,000 pts
              <div style={{fontSize:ipadTour(10),color:"rgba(255,255,255,0.7)",fontWeight:"normal",marginTop:2}}>Reverse "{lastValidEntry?.word}" and try different tiles</div>
            </button>
          )}
          {/* Try Again + Buy/Fresh side by side (half width each) */}
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <button className="ll-btn" onClick={doLevelReset} disabled={level===5&&totalRef.current<1000} style={{flex:1,padding:ipadTour(12),borderRadius:12,background:level===5&&totalRef.current<1000?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#60a5fa,#3b82f6)",color:level===5&&totalRef.current<1000?"rgba(255,255,255,0.6)":"#fff",fontSize:ipadTour(12),fontWeight:"bold",cursor:level===5&&totalRef.current<1000?"default":"pointer"}}>
              {level===5?`🔄 ReTry L5 — 1,000 pts${totalRef.current<1000?" (too few pts)":""}`:`🔄 Try Level ${level} Again`}
            </button>
            {level<5&&<button className="ll-btn" onClick={handleBuyLevel} disabled={!canBuy} style={{flex:1,padding:ipadTour(12),borderRadius:12,background:canBuy?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.08)",color:canBuy?"#1a1a2e":"rgba(255,255,255,0.6)",fontSize:ipadTour(12),fontWeight:"bold",cursor:canBuy?"pointer":"default"}}>🔓 Buy Level {level+1} — {buyCost} pts{!canBuy?" (too few pts)":""}</button>}
            {level===5&&<button className="ll-btn" onClick={handleExtendLevel5} disabled={totalRef.current<5000} style={{flex:1,padding:ipadTour(12),borderRadius:12,background:totalRef.current>=5000?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.08)",color:totalRef.current>=5000?"#1a1a2e":"rgba(255,255,255,0.6)",fontSize:ipadTour(12),fontWeight:"bold",cursor:totalRef.current>=5000?"pointer":"default"}}>
              🆕 Fresh Tiles — 5,000 pts{totalRef.current<5000?" (too few pts)":""}
            </button>}
          </div>
          {/* End Day & Share Results — full width, brightened/prominent */}
          <button className="ll-btn" onClick={handleGiveUp} style={{marginTop:8,width:"100%",padding:ipadTour(13),borderRadius:12,background:"linear-gradient(135deg,#34d399,#10b981)",border:"none",color:"#003322",fontSize:ipadTour(14),fontWeight:"bold",cursor:"pointer",boxShadow:"0 0 18px rgba(52,211,153,0.4)"}}>📤 End Day &amp; Share Results</button>
        </div>
      </div>}

      {showBuyModal&&<div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:ipadTour(32),textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,255,255,0.18)",maxWidth:ipadTour(300),width:"90%"}}>
          <div style={{fontSize:ipadTour(44)}}>🔓</div>
          <div style={{fontSize:ipadTour(20),fontWeight:"bold",color:"#f5f0e8",marginTop:8}}>Buy Level {level+1}?</div>
          <div style={{fontSize:ipadTour(13),color:"#bbb",marginTop:8,lineHeight:1.6}}>Spend points to unlock the next level.</div>
          <div style={{fontSize:ipadTour(24),color:"#f6d365",fontWeight:"bold",marginTop:12}}>{buyCost} pts</div>
          <div style={{fontSize:ipadTour(12),color:totalScore>=buyCost?"#6ee7b7":"#fb7185",marginTop:4}}>You have: {totalScore} pts · {totalScore>=buyCost?"✓ Enough":"✗ Not enough"}</div>
          <div style={{fontSize:ipadTour(11),color:"#f093fb",marginTop:6}}>⚠️ Buying forfeits Perfect Day and time records</div>
          <button className="ll-btn" onClick={handleBuyLevel} disabled={!canBuy} style={{marginTop:16,width:"100%",padding:ipadTour(13),borderRadius:14,background:canBuy?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.1)",color:canBuy?"#1a1a2e":"rgba(255,255,255,0.3)",fontSize:ipadTour(14),fontWeight:"bold",cursor:canBuy?"pointer":"default"}}>{canBuy?`Unlock Level ${level+1} — ${buyCost} pts`:"Not enough points"}</button>
          <button className="ll-btn" onClick={()=>setShowBuyModal(false)} style={{marginTop:8,width:"100%",padding:ipadTour(10),borderRadius:12,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.5)",fontSize:ipadTour(12)}}>Keep Playing</button>
        </div>
      </div>}

      {showStreakBonus&&<div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <div style={{background:"linear-gradient(135deg,#1a0a40,#2d1b69)",borderRadius:28,padding:`${ipadTour(32)}px ${ipadTour(28)}px`,textAlign:"center",boxShadow:"0 0 60px rgba(246,211,101,0.4)",border:"2px solid rgba(246,211,101,0.6)",maxWidth:ipadTour(340),width:"100%",position:"relative"}}>
          <ConfettiCanvas active={true} rainbow={true}/>
          <div style={{fontSize:ipadTour(52),marginBottom:8}}>🌈🏆</div>
          <div style={{fontSize:ipadTour(22),fontWeight:"bold",color:"#f6d365",marginBottom:6,lineHeight:1.3}}>
            {streakBonusCount === 1 ? "Perfect Day Bonus!" : `${streakBonusCount} Consecutive Perfect Days!`}
          </div>

          <div style={{background:"rgba(246,211,101,0.15)",border:"2px solid rgba(246,211,101,0.6)",borderRadius:16,padding:ipadTour(16),marginBottom:20}}>
            <div style={{fontSize:ipadTour(13),color:"rgba(255,255,255,0.6)",marginBottom:4}}>Rainbow's End Bonus</div>
            <div style={{fontSize:ipadTour(36),fontWeight:"bold",color:"#f6d365"}}>+{perfectDayStreakBonus.toLocaleString()}</div>
            <div style={{fontSize:ipadTour(13),color:"rgba(255,255,255,0.5)"}}>pts added to your score</div>
            {streakBonusCount > 1 && <div style={{fontSize:ipadTour(11),color:"rgba(255,255,255,0.4)",marginTop:4}}>2,000 + {streakBonusCount-1} × 1,000 pts streak bonus</div>}
          </div>
          <button className="ll-btn" onClick={()=>{ setShowStreakBonus(false); setTimeout(()=>setPerfectDayAchieved(true), 200); }} style={{width:"100%",padding:ipadTour(14),borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(15),fontWeight:"bold",border:"none",cursor:"pointer"}}>
            🎉 Awesome! Continue →
          </button>
        </div>
      </div>}

      {showWotdMissedPD&&<div style={{position:"fixed",inset:0,zIndex:9500,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:`${ipadTour(28)}px ${ipadTour(24)}px`,textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.85)",border:"2px solid rgba(246,211,101,0.5)",maxWidth:ipadTour(340),width:"100%",fontFamily:"Georgia,serif",color:"#f5f0e8"}}>
          <div style={{fontSize:ipadTour(46),marginBottom:8}}>🎯</div>
          <div style={{fontSize:ipadTour(20),fontWeight:"bold",color:"#f6d365",marginBottom:10}}>Wow! So close!</div>
          <div style={{fontSize:ipadTour(14),color:"rgba(255,255,255,0.95)",lineHeight:1.6,marginBottom:20}}>
            Remember, finding the Word of the Day is part of accomplishing a LetterLoot Perfect Day.
          </div>
          <button className="ll-btn" onClick={()=>{ setShowWotdMissedPD(false); openDaySummary("farewell"); }} style={{width:"100%",padding:ipadTour(13),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(14),fontWeight:"bold",border:"none",cursor:"pointer"}}>
            See My Results →
          </button>
        </div>
      </div>}

      {/* v91: Perfect Day pirate+leprechaun DANCE celebration — full-screen overlay that
          plays first (rise → dance → sparkles), auto-dismisses after ~5.2s, revealing the
          stats modal beneath. zIndex above the PD modal (9500). */}
      {/* v225: DAY-ROLLOVER MODAL. Fires when the app RESUMES from the background on a later
          calendar day than it mounted (see the visibilitychange effect). z-index 9999 — above
          every celebration and overlay, because the board behind it belongs to yesterday and must
          not be playable. No dismiss-without-reload path on purpose: there is nothing valid to go
          back to. The reload re-runs every date-keyed initializer together (session, WoD, stats),
          and loadLocalSession()'s date guard then discards yesterday's save on its own. */}
      {/* v227 INSTRUMENTATION (TEMPORARY — strip after capture). Reports REAL measured geometry so
          the iPhone board-overflow fix is arithmetic, not a guess. Daryl: screenshot this on the
          iPhone Air at EACH level (1-5), and once on the 17 Pro Max sim for the known-good
          comparison. OVER = how many px the page exceeds the viewport = the exact overflow. */}
      {DEBUG_MODE&&boardMetrics&&<div style={{position:"fixed",top:64,left:4,zIndex:10000,background:"rgba(0,0,0,0.94)",color:"#0f0",fontFamily:"monospace",fontSize:11,lineHeight:1.45,padding:"5px 7px",borderRadius:4,pointerEvents:"none",border:"1px solid #0f0"}}>
        L{boardMetrics.level} vw{boardMetrics.vw} vh{boardMetrics.vh}<br/>
        chromeTop {boardMetrics.chromeTop}<br/>
        boardH {boardMetrics.boardH}<br/>
        boardBot {boardMetrics.boardBottom}<br/>
        pageH {boardMetrics.pageH}<br/>
        <span style={{color:boardMetrics.overflow>0?"#fa0":"#0f0"}}>pageOver {boardMetrics.overflow}</span><br/>
        <span style={{color:boardMetrics.boardOver>0?"#f55":"#0f0",fontWeight:"bold"}}>BOARDOVER {boardMetrics.boardOver}</span>
      </div>}
      {dayRolledOver&&<div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(10,8,30,0.94)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:28,padding:`${ipadTour(32)}px ${ipadTour(28)}px`,textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:"2px solid #f6d365",maxWidth:ipadTour(340),width:"90%",margin:"0 auto"}}>
          <div style={{fontSize:ipadTour(42),marginBottom:ipadTour(8)}}>🌅</div>
          <div style={{fontSize:ipadTour(22),fontWeight:"bold",color:"#f6d365",marginBottom:ipadTour(14)}}>A New Day Has Dawned!</div>
          <div style={{fontSize:ipadTour(15),color:"#f5f0e8",lineHeight:1.5,marginBottom:ipadTour(22)}}>Yesterday's voyage has ended, and fresh tiles await ye. Time to set sail on today's hunt!</div>
          <button onClick={()=>window.location.reload()} style={{background:"linear-gradient(135deg,#f6d365,#fda085)",border:"none",borderRadius:14,padding:`${ipadTour(14)}px ${ipadTour(28)}px`,fontSize:ipadTour(16),fontWeight:"bold",color:"#2d1b69",cursor:"pointer",width:"100%"}}>⚓ Start Today's Game</button>
        </div>
      </div>}
      {showPirateDance&&<div style={{position:"fixed",inset:0,zIndex:9600,background:"rgba(10,8,30,0.92)",overflow:"hidden",animation:"pdFlash 1.4s ease"}}>
        {/* sparkles scattered around the dancers */}
        {Array.from({length:18}).map((_,i)=>(
          <div key={i} style={{position:"absolute",left:`${8+Math.random()*84}%`,bottom:`${20+Math.random()*55}%`,fontSize:`${20+Math.random()*18}px`,opacity:0,animation:`pdSparkleFloat ${1.1+Math.random()*0.8}s ease ${0.3+Math.random()*3.5}s forwards`,pointerEvents:"none"}}>{["✨","⭐","💫","🌟","🎉"][i%5]}</div>
        ))}
        <div style={{position:"absolute",top:"16%",left:0,right:0,textAlign:"center",fontSize:ipadTour(26),fontWeight:"bold",letterSpacing:1}} className="perfect-text">PERFECT DAY! 🌈</div>
        <img src="/pirates-m-f-celebration.png" alt="" style={{position:"absolute",left:"50%",bottom:"-380px",transform:"translateX(-50%)",width:ipadTour(PD_PIRATE_W),height:"auto",pointerEvents:"none",filter:"drop-shadow(0 8px 16px rgba(0,0,0,0.6))",animation:"pdPiratesRise 0.7s cubic-bezier(.34,1.56,.64,1) 0.1s forwards, pdPiratesJig 1.0s ease 1.0s 3 forwards, pdPiratesOut 0.6s ease-in 4.4s forwards"}}/>
      </div>}

      {perfectDayAchieved&&!showPirateDance&&<div style={{position:"fixed",inset:0,zIndex:9500,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",overflowY:"auto"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:28,padding:`${ipadTour(pdAir(32))}px ${ipadTour(28)}px`,textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:"2px solid rgba(255,215,0,0.5)",maxWidth:ipadTour(340),width:"90%",margin:"20px auto"}}>
          {/* Title row: PERFECT DAY! 🌈 + PotOfGold inline */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:0,marginBottom:pdAir(6),flexWrap:"nowrap"}}>
            <div style={{fontSize:ipadTour(22),fontWeight:"bold",whiteSpace:"nowrap"}} className="perfect-text">PERFECT DAY! 🌈</div>
            <PotOfGold size={ipadTour(48)}/>
          </div>
          {/* Bonus inline accent under title — hidden for Guests since they
              do not receive the +2,000 PD bonus or streak bonuses. The
              upsell popup after Now/Later/Tomorrow tells them about it. */}
          {!isGuest&&<div style={{fontSize:ipadTour(14),color:"#fda085",fontWeight:"bold",marginBottom:pdAir(10)}}>Bonus: +2,000 pts</div>}
          {/* Tagline - shrunk font size so the 10 rotating taglines fit 1-2 lines naturally */}
          <div style={{fontSize:ipadTour(12),color:"#f5f0e8",marginBottom:pdAir(14),lineHeight:1.5,fontStyle:"italic"}}>"{congratsMsg}"</div>
          {/* Stats - 2 rows (was 4) with dot separators */}
          <div style={{background:"rgba(255,255,255,0.08)",borderRadius:12,padding:`${ipadTour(10)}px ${ipadTour(12)}px`,fontSize:ipadTour(12),color:"#f5f0e8",lineHeight:1.6,marginBottom:ipadTour(pdAir(10))}}>
            <div>🏆 {playerName||"You"} · {getShortDate()}</div>
            <div style={{color:"rgba(255,255,255,0.85)"}}>Score: {totalScore} pts · 💰 Lifetime: {lifetimePoints.toLocaleString()} pts</div>
          </div>
          {wotdFoundDetails && (
            <div style={{marginTop:8,background:"linear-gradient(135deg,rgba(167,139,250,0.18),rgba(167,139,250,0.06))",border:"1.5px solid rgba(167,139,250,0.5)",borderRadius:12,padding:"10px",fontSize:ipadTour(12),color:"#f5f0e8",lineHeight:1.5,textAlign:"center"}}>
              <span style={{fontSize:ipadTour(11),color:"#a78bfa",letterSpacing:2,fontWeight:"bold"}}>🎯 WORD OF THE DAY</span><br/>
              <strong style={{color:"#f6d365"}}>{wotd}</strong> — L{wotdFoundDetails.level}, {wotdFoundDetails.score} pts
            </div>
          )}
          {/* Tracking note - brightened, no bold */}
          <div style={{fontSize:ipadTour(11),color:"rgba(255,255,255,0.9)",lineHeight:1.5,marginTop:pdAir(12),marginBottom:pdAir(14)}}>Perfect Days are tracked daily toward your total — but every one is worth celebrating!</div>
          {/* Action buttons - Leaderboard + Share Perfect Day side by side
              v59: Leaderboard button is LOCKED for Guests. Dimmed colors,
              🔒 icon, tap → Guest Upsell modal. Visible reminder of what
              they're missing. */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:pdAir(6),marginBottom:pdAir(6)}}>
            <button className="ll-btn" onClick={()=>{
              if (isGuest) { setPerfectDayAchieved(false); setShowGuestUpsell(true); return; }
              markPDAcknowledged(); setLeaderboardFromPerfectDay(true); setPerfectDayAchieved(false); setLevelComplete(false); setTab('leaderboard'); // v260 #3: clear levelComplete so the L5-Complete modal can't zombie over the leaderboard
            }} style={{padding:`${ipadTour(11)}px ${ipadTour(6)}px`,borderRadius:12,background:isGuest?"rgba(255,255,255,0.04)":"rgba(246,211,101,0.18)",border:isGuest?"1px solid rgba(255,255,255,0.15)":"1px solid rgba(246,211,101,0.6)",color:isGuest?"rgba(255,255,255,0.5)":"#fef3c7",fontSize:ipadTour(12),fontWeight:"bold",fontFamily:"Georgia,serif",cursor:"pointer"}}>
              {isGuest?<span><span style={{filter:"grayscale(0.6)",opacity:0.55}}>🏆</span> Leaderboard <span style={{color:"rgba(167,139,250,0.85)"}}>🔒</span></span>:"🏆 Leaderboard"}
            </button>
            <button className="ll-btn" onClick={()=>{
              sharePerfectDay();
            }} style={{padding:`${ipadTour(11)}px ${ipadTour(6)}px`,borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(12),fontWeight:"bold",fontFamily:"Georgia,serif",border:"none",cursor:"pointer"}}>
              {shareCopied?"✓ Copied!":"📋 Share Perfect Day"}
            </button>
          </div>
          {shareCopied&&<div style={{fontSize:ipadTour(11),color:"#6ee7b7",marginTop:4}}>Copied! Paste into a text or email to share.</div>}
          {/* v64 (May 26): Simplified — Now + Later only.
              Now → dismiss PD + start new game at L1 (skipWelcome).
              Later → dismiss PD + return to Welcome screen.
              Tomorrow button removed (merged into Later).
              No intermediate playAgainChoice states — single-tap routing. */}
          <div style={{marginTop:14}}>
            <div style={{fontSize:ipadTour(11),color:"rgba(255,255,255,0.7)",marginBottom:6}}>Want to play again?</div>
            <div style={{display:"flex",gap:6}}>
              <button className="ll-btn replay-btn" onClick={()=>{ markPDAcknowledged(); setPerfectDayAchieved(false); openDaySummary("now"); }} style={{flex:1,padding:ipadTour(10),borderRadius:10,background:"linear-gradient(135deg,#00c853,#00e676)",color:"#003300",fontSize:ipadTour(12),fontWeight:"bold",border:"none"}}>✏️ Now</button>
              <button className="ll-btn" onClick={()=>{ markPDAcknowledged(); setPerfectDayAchieved(false); openDaySummary("later"); }} style={{flex:1,padding:ipadTour(10),borderRadius:10,background:"linear-gradient(135deg,rgba(96,165,250,0.3),rgba(59,130,246,0.2))",border:"1px solid rgba(96,165,250,0.6)",color:"#dbeafe",fontSize:ipadTour(12),fontWeight:"bold"}}>🌅 Later</button>
            </div>
          </div>
        </div>
      </div>}

      {showDaySummary&&(()=>{
        // v302 Today's Summary (Daryl, option C, Aug 29): PD / Great Game headline with the streak,
        // this game's FF rows, WoD, total time. A repeat PD shows the bonus banked earlier today.
        const isPD = perfectDayRef.current === true && wotdFoundRef.current === true;
        const streakN = (()=>{ try { return getLocalStats().consecutivePerfectDays || 0; } catch { return 0; } })();
        const bonusPaid = perfectDayStreakBonus > 0;
        const bonusAmt = bonusPaid ? perfectDayStreakBonus : (1000 + streakN * 1000);
        const ffs = submittedRef.current.filter(x => x.valid && x.finisher > 0).sort((a,b)=>a.level-b.level);
        const gi = gameIndexRef.current || 0;
        return <div style={{position:"fixed",inset:0,zIndex:9500,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",overflowY:"auto"}}>
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:28,padding:`${ipadTour(28)}px ${ipadTour(26)}px`,textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:"2px solid rgba(255,215,0,0.5)",maxWidth:ipadTour(340),width:"90%",margin:"20px auto"}}>
            <div style={{fontSize:ipadTour(11),color:"rgba(255,255,255,0.6)",letterSpacing:3}}>TODAY'S SUMMARY{gi>0?` · GAME ${gi+1}`:""}</div>
            <div style={{fontSize:ipadTour(12),color:"rgba(255,255,255,0.8)",marginTop:4}}>🏆 {playerName||"You"} · {getShortDate()}</div>
            {isPD
              ? <div style={{marginTop:12}}>
                  <div className="perfect-text" style={{fontSize:ipadTour(22),fontWeight:"bold"}}>🌈🏆 PERFECT DAY!</div>
                  {!isGuest && streakN > 0 && <div style={{fontSize:ipadTour(13),color:"#f6d365",marginTop:4}}>{streakN} consecutive {streakN===1?"day":"days"} · +{bonusAmt.toLocaleString()} pts{bonusPaid?"":" banked earlier today"}</div>}
                </div>
              : <div style={{marginTop:12,fontSize:ipadTour(22),fontWeight:"bold",color:"#f6d365"}}>🏴‍☠️ GREAT GAME!</div>}
            <div style={{marginTop:10,fontSize:ipadTour(14),color:"#f5f0e8"}}>Score: <strong>{totalRef.current.toLocaleString()}</strong> pts</div>
            <div style={{marginTop:10,background:"rgba(255,255,255,0.08)",borderRadius:12,padding:"10px"}}>
              <div style={{fontSize:ipadTour(11),color:"#fbbf24",letterSpacing:2,fontWeight:"bold",marginBottom:6}}>🏴‍☠️ FINISHING FLOURISHES</div>
              {ffs.length
                ? ffs.map(f => <div key={f.level} style={{display:"flex",justifyContent:"space-between",fontSize:ipadTour(12),color:"#f5f0e8",lineHeight:1.7}}><span>L{f.level} · {f.word}</span><span style={{color:"#fbbf24"}}>+{f.finisher.toLocaleString()}</span></div>)
                : <div style={{fontSize:ipadTour(11),color:"rgba(255,255,255,0.6)",fontStyle:"italic"}}>Not today, but tomorrow offers great promise!</div>}
            </div>
            <div style={{marginTop:8,background:"linear-gradient(135deg,rgba(167,139,250,0.18),rgba(167,139,250,0.06))",border:"1.5px solid rgba(167,139,250,0.5)",borderRadius:12,padding:"10px",fontSize:ipadTour(12),color:"#f5f0e8",lineHeight:1.5}}>
              <span style={{fontSize:ipadTour(11),color:"#a78bfa",letterSpacing:2,fontWeight:"bold"}}>🎯 WORD OF THE DAY</span><br/>
              {wotdFoundDetails ? <><strong style={{color:"#f6d365"}}>{wotd}</strong> — L{wotdFoundDetails.level}, {wotdFoundDetails.score} pts</> : <span style={{color:"rgba(255,255,255,0.6)"}}>Not found today</span>}
            </div>
            <div style={{marginTop:8,fontSize:ipadTour(12),color:"#60a5fa",fontWeight:"bold"}}>⏱️ Total time: {formatTime(totalTimeRef.current)}</div>
            {/* v303 (option B): Leaderboard · Share · Play Now · Later */}
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
          </div>
        </div>;
      })()}

      {showRepeatPerfect&&<div style={{position:"fixed",inset:0,zIndex:9500,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",overflowY:"auto"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:28,padding:`${ipadTour(32)}px ${ipadTour(28)}px`,textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:"2px solid rgba(255,215,0,0.5)",maxWidth:ipadTour(340),width:"90%",margin:"20px auto"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:4}}><RainbowPot size={ipadTour(130)}/></div>
          <div style={{fontSize:ipadTour(24),fontWeight:"bold",marginTop:8}} className="perfect-text">PERFECT DAY!</div>
          <div style={{fontSize:ipadTour(13),color:"#f5f0e8",marginTop:10,lineHeight:1.7,fontStyle:"italic"}}>"{repeatPdMsg}"</div>
          {perfectDayStreakBonus > 0 && (
            <div style={{marginTop:10,background:"linear-gradient(135deg,rgba(246,211,101,0.2),rgba(253,160,133,0.15))",borderRadius:12,padding:"10px",border:"1px solid rgba(246,211,101,0.5)",textAlign:"center"}}>
              <div style={{fontSize:ipadTour(20),fontWeight:"bold",color:"#f6d365"}}>+{perfectDayStreakBonus.toLocaleString()} pts 🌈🏆</div>
            </div>
          )}
          <div style={{marginTop:10,background:"rgba(255,255,255,0.08)",borderRadius:12,padding:"10px",fontSize:ipadTour(12),color:"#ccc",lineHeight:1.6}}>
            🏆 {playerName||"You"}<br/>{getShortDate()}<br/>
            Score: {totalRef.current} pts<br/>
            💰 Lifetime: {lifetimePoints.toLocaleString()} pts
          </div>
          {wotdFoundDetails && (
            <div style={{marginTop:8,background:"linear-gradient(135deg,rgba(167,139,250,0.18),rgba(167,139,250,0.06))",border:"1.5px solid rgba(167,139,250,0.5)",borderRadius:12,padding:"10px",fontSize:ipadTour(12),color:"#f5f0e8",lineHeight:1.5,textAlign:"center"}}>
              <span style={{fontSize:ipadTour(11),color:"#a78bfa",letterSpacing:2,fontWeight:"bold"}}>🎯 WORD OF THE DAY</span><br/>
              <strong style={{color:"#f6d365"}}>{wotd}</strong> — L{wotdFoundDetails.level}, {wotdFoundDetails.score} pts
            </div>
          )}
          <div style={{fontSize:ipadTour(11),color:"rgba(255,255,255,0.45)",marginTop:8,lineHeight:1.5}}>
            Perfect Days are tracked daily toward your total — but every one is worth celebrating!
          </div>
          <button className="ll-btn" onClick={()=>{
            if (isGuest) { setShowRepeatPerfect(false); setShowGuestUpsell(true); return; }
            markPDAcknowledged(); setLeaderboardFromPerfectDay(true); setShowRepeatPerfect(false); setLevelComplete(false); setTab('leaderboard'); // v260 #3: clear levelComplete so the L5-Complete modal can't zombie over the leaderboard
          }} style={{marginTop:12,width:"100%",padding:ipadTour(11),borderRadius:14,background:isGuest?"rgba(255,255,255,0.04)":"rgba(246,211,101,0.15)",border:isGuest?"1px solid rgba(255,255,255,0.15)":"1px solid rgba(246,211,101,0.5)",color:isGuest?"rgba(255,255,255,0.5)":"#f6d365",fontSize:ipadTour(13),fontWeight:"bold"}}>
            {isGuest?<span><span style={{filter:"grayscale(0.6)",opacity:0.55}}>🏆</span> Check Leaderboard <span style={{color:"rgba(167,139,250,0.85)"}}>🔒</span></span>:"🏆 Check Leaderboard"}
          </button>
          <button className="ll-btn" onClick={()=>{
            sharePerfectDay();
          }} style={{marginTop:8,width:"100%",padding:ipadTour(12),borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(13),fontWeight:"bold"}}>
            {shareCopied?"✓ Copied!":"📋 Save & Share!"}
          </button>
          {shareCopied&&<div style={{fontSize:ipadTour(11),color:"#6ee7b7",marginTop:4}}>Copied! Paste into a text or email to share.</div>}
          <div style={{fontSize:ipadTour(12),color:"rgba(255,255,255,0.65)",marginTop:14,marginBottom:8}}>Want to play again?</div>
          {/* v64 (May 26): Simplified — Now + Later only. Tomorrow removed. */}
          <div style={{display:"flex",flexDirection:"row",gap:6}}>
            <button className="ll-btn replay-btn" onClick={()=>{ markPDAcknowledged(); setShowRepeatPerfect(false); openDaySummary("now"); }} style={{flex:1,padding:`${ipadTour(11)}px ${ipadTour(4)}px`,borderRadius:12,background:"linear-gradient(135deg,#00c853,#00e676)",color:"#003300",fontSize:ipadTour(12),fontWeight:"bold",border:"none"}}>✏️ Now</button>
            <button className="ll-btn" onClick={()=>{ markPDAcknowledged(); setShowRepeatPerfect(false); openDaySummary("later"); }} style={{flex:1,padding:`${ipadTour(11)}px ${ipadTour(4)}px`,borderRadius:12,background:"linear-gradient(135deg,rgba(96,165,250,0.3),rgba(59,130,246,0.2))",border:"1px solid rgba(96,165,250,0.6)",color:"#bfdbfe",fontSize:ipadTour(12),fontWeight:"bold"}}>🌅 Later</button>
          </div>
        </div>
      </div>}

      {spyglass && <div style={{position:"fixed",inset:0,zIndex:9500,background:"rgba(6,4,24,0.9)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif"}} onClick={()=>setSpyglass(null)}>
        <div onClick={(e)=>e.stopPropagation()} style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:22,padding:`${ipadTour(36)}px ${ipadTour(30)}px`,textAlign:"center",border:"1.5px solid rgba(246,211,101,0.6)",maxWidth:ipadTour(400),width:"94%",boxShadow:"0 12px 48px rgba(0,0,0,0.8)"}}>
          <div style={{fontSize:ipadTour(44),marginBottom:6,filter:"drop-shadow(0 0 8px rgba(124,196,255,0.6))"}}>🔭</div>
          <div style={{fontSize:ipadTour(22),fontWeight:"bold",color:"#f6d365",marginBottom:4}}>The Spyglass</div>
          <div style={{fontSize:ipadTour(15),fontStyle:"italic",color:"#e8e0d0",marginBottom:14}}>Scout yer word before committin' the tiles</div>
          <div style={{fontSize:ipadTour(24),fontWeight:"bold",color:"#fff",letterSpacing:2,marginBottom:12}}>{spyglass.word}</div>
          {spyglass.status==="checking" && <div style={{fontSize:ipadTour(13),color:"rgba(255,255,255,0.75)",marginBottom:12}}>Scoutin' the word…</div>}
          {spyglass.status==="valid" && <div style={{fontSize:ipadTour(15),fontWeight:"bold",color:"#6ee7b7",marginBottom:12}}>✓ Accepted in the LL dictionary!</div>}
          {spyglass.status==="invalid" && (<>
            <div style={{fontSize:ipadTour(15),fontWeight:"bold",color:"#fda4af",marginBottom:10}}>✗ Not in the LL dictionary</div>
            {!spyglass.reported
              ? <button className="ll-btn" onClick={spyglassReport} style={{width:"100%",padding:ipadTour(10),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(13),fontWeight:"bold",border:"none",marginBottom:10}}>🏴‍☠️ Submit fer Review</button>
              : <div style={{fontSize:ipadTour(12),color:"#6ee7b7",fontWeight:"bold",marginBottom:10}}>Sent to the Cap'n fer review!</div>}
          </>)}
          {spyglass.status==="error" && (<>
            <div style={{fontSize:ipadTour(13),fontWeight:"bold",color:"#fda4af",marginBottom:10}}>📡 Can't reach the dictionary — please check connection</div>
            <button className="ll-btn" onClick={openSpyglass} style={{width:"100%",padding:ipadTour(10),borderRadius:12,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.35)",color:"#fff",fontSize:ipadTour(13),fontWeight:"bold",marginBottom:10}}>Scout Again</button>
          </>)}
          {!paused && tab==="play" && <div style={{fontSize:ipadTour(14),fontWeight:"bold",color:"#f6d365",marginBottom:12}}>⏱️ The game clock be runnin'!</div>}
          <button className="ll-btn" onClick={()=>setSpyglass(null)} style={{width:"100%",padding:ipadTour(10),borderRadius:12,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.3)",color:"#f0e8d8",fontSize:ipadTour(13),fontWeight:"bold"}}>Back to the Hunt</button>
        </div>
      </div>}
      {welcomeBack && <div style={{position:"fixed",inset:0,zIndex:9600,background:"rgba(6,4,24,0.96)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:`${ipadTour(34)}px ${ipadTour(30)}px`,textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(246,211,101,0.45)",maxWidth:ipadTour(330),width:"90%"}}>
          <div style={{fontSize:ipadTour(34),marginBottom:8}}>{welcomeBack.variant==="finish"?"\u2693":"\uD83C\uDF0A"}</div>
          <div style={{fontSize:ipadTour(24),fontWeight:"bold",color:"#f6d365",marginBottom:10}}>Welcome Back{playerName?`, ${playerName}`:""}!</div>
          <div style={{fontSize:ipadTour(17),fontWeight:"bold",color:"rgba(255,255,255,0.95)",lineHeight:1.55,marginBottom:20}}>{/* v265: bigger, bolder — Daryl: the message should land */}
            {welcomeBack.variant==="finish" ? `Level ${welcomeBack.level} be conquered \u2014 let\u2019s get this finished!`
             : welcomeBack.variant==="return" ? `Yer Level ${welcomeBack.level} voyage awaits, right where ye left it.`
             : `Ready to chart Level ${welcomeBack.level}, matey?`}
          </div>
          <button className="ll-btn" onClick={()=>{
            const wb = welcomeBack; setWelcomeBack(null);
            if (wb.variant === "chart") { resumeSkipLootRef.current = true; fireLevelStartSequence(wb.level); }
            // v274 RULING B: "Return to Level N" is declared intent — the clock starts the
            // moment the live board appears. Exception: a session restored PAUSED keeps its
            // frozen clock until Resume (which now also clears the gate). Fresh games and
            // the "chart" new-level path keep the first-tap gate untouched.
            if (wb.variant === "return" && !pausedRef.current) {
              awaitingFirstTapRef.current = false; setAwaitingFirstTap(false);
              resumeIntentRef.current = true; // v275: survives a late-arriving init
              startTimer();
            }
            // "return": straight to the live board. "finish": the Level-Complete modal is
            // already rendered beneath this overlay \u2014 dismissing reveals it (existing flow).
          }} style={{width:"100%",padding:ipadTour(14),borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(18),fontWeight:"bold",border:"none"}}>
            {welcomeBack.variant==="finish"?"\u2693 Finish the Day":welcomeBack.variant==="return"?`\u2693 Return to Level ${welcomeBack.level}`:`\u2693 Set Sail \u2014 Level ${welcomeBack.level}`}
          </button>
        </div>
      </div>}
      {levelComplete&&level<5&&<div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:`${ipadTour(36)}px ${ipadTour(32)}px`,textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,215,0,0.35)",maxWidth:ipadTour(320),width:"90%"}}>
          {/* v94: celebrating pirate with a per-level entrance animation + level-specific saying */}
          {/* v104: mascot image + saying gated behind showMascotCelebrations(); results below always show */}
          {/* v162 (v1.2 #2): also gated on mascotReady so it pops in only AFTER the badge queue drains */}
          {showMascotCelebrations() && mascotReady && (()=>{
            // v109: speech bubble above the mascot's head, replacing the old caption-below.
            // Geometry from the lab (gap≈10px@162 → fraction, textTop=11%, textHeight=66%).
            // bubbleWidthPct: 115 (v109) → 127 (v162) → 185 (v165).
            // Source PNG is square with transparent margin; solid bubble crops to 1.44:1 (w:h).
            const pw = ipadTour(120);                     // rendered pirate width
            const bw = pw * 1.85;                          // v165: 1.27→1.85 — widen for legibility (Daryl, July 9). v162 groupDrop absorbs the extra upward extent.
            const cropWR = 786/1024, cropHR = 546/1024;   // solid-bubble fraction of the square img
            const solidBottomFrac = (1 + cropHR)/2;       // ~0.766 within the square
            const marginBelow = bw * (1 - solidBottomFrac);
            const gap = pw * (10/162);                     // lab gap normalized to pirate width (≈17px @ iPad)
            const bubbleTop = -bw + marginBelow - gap;     // tail tip sits `gap` above top of head
            // v162: the bubble extends upward by roughly |bubbleTop|; add that as top margin on
            // the group so the whole mascot+bubble drops down, clearing the top clip AND moving
            // clear of the badge banner zone (fixed top:72). Small safety pad on top.
            const groupDrop = Math.max(0, -bubbleTop) + ipadTour(14);
            const cropLeftFrac = (1 - cropWR)/2, cropTopFrac = (1 - cropHR)/2;
            const zLeft = (cropLeftFrac + (9.4/100)*cropWR) * 100;
            const zWidth = (81.7/100) * cropWR * 100;
            const zTop = (cropTopFrac + (11/100)*cropHR) * 100;   // v115: textTopPct 16→11 (band grew, stays centered)
            const zHeight = (66/100) * cropHR * 100;              // v115: textHeightPct 54→66 uses more bubble interior
            // v176: same Item-14 fix as GreatWordOverlay — compute the zone in PIXELS from bw so
            // the box height never depends on async image decode. bw-wide square PNG → height bw.
            // For the warm-cache case this is identical to the old %-of-image; it only removes the
            // cold-load 0-height race. Level-Clear appearance is unchanged (Daryl: "perfectly sized").
            const boxWpx = bw * (zWidth/100);
            const boxHpx = bw * (zHeight/100);
            const line = clearSayingText || pickClearSaying(level, Math.max(0, clearSayingIdxRef.current));
            return (
              <div style={{position:"relative",display:"inline-block",marginBottom:4,marginTop:groupDrop}}>
                {/* speech bubble overlay — absolute, above head */}
                <div style={{position:"absolute",left:"50%",top:bubbleTop,width:bw,transformOrigin:"bottom center",pointerEvents:"none",animation:"bubbleIn 0.55s cubic-bezier(.34,1.56,.64,1) 0.35s both",zIndex:2}}>
                  <img src="/Speech_Bubble.png" alt="" style={{display:"block",width:"100%",height:"auto"}}/>
                  {/* v114: auto-shrink text to fit the fixed zone (was static fontSize → clipped long lines) */}
                  <BubbleFitText text={line} zLeft={zLeft} zTop={zTop} boxWpx={boxWpx} boxHpx={boxHpx} maxPx={ipadTour(22)}/>
                </div>
                <img key={level} src={PIRATE_CLEAR_IMG[level]||"/pirate-cheer.png"} alt="" style={{display:"block",width:pw,height:"auto",filter:"drop-shadow(0 6px 12px rgba(0,0,0,0.5))",animation:`${PIRATE_CLEAR_ANIM[level]||"plClearL1"} 0.9s cubic-bezier(.34,1.56,.64,1) forwards`}}/>
              </div>
            );
          })()}
          <div style={{fontSize:ipadTour(26),fontWeight:"bold",color:"#f6d365",marginTop:8}}>Level {level} Complete!</div>
          <div style={{fontSize:ipadTour(13),color:"#ccc",marginTop:8}}>You used every tile!</div>
          <div style={{fontSize:ipadTour(22),color:"#fda085",fontWeight:"bold",marginTop:10}}>+{100*level} Bonus Points!</div>
          {finisherBonusEarned > 0 && (
            <div style={{fontSize:ipadTour(20),color:"#fbbf24",fontWeight:"bold",marginTop:8}}>🏴‍☠️ Finishing Flourish Bonus: +{finisherBonusEarned.toLocaleString()}!</div>
          )}
          <div style={{fontSize:ipadTour(13),color:"#60a5fa",fontWeight:"bold",marginTop:6}}>⏱️ Time: {formatTime(levelTimeRef.current)}</div>
          {newBestTime&&<div style={{fontSize:ipadTour(12),color:"#6ee7b7",fontWeight:"bold",marginTop:4}}>⚡ New Best Time!</div>}
          {(()=>{ const ffs = getTodayFFs(); if (!ffs.length) return null; return <div style={{fontSize:ipadTour(11),color:"#fbbf24",marginTop:6}}>🏴‍☠️ Today's Flourishes: {ffs.map(f=>`L${f.level} ${f.word}`).join(" · ")}</div>; })()}
          {timeLeaderboard.levels?.[level]?.length>0&&<div style={{marginTop:8,background:"rgba(255,255,255,0.06)",borderRadius:10,padding:"8px",fontSize:ipadTour(11),color:"#aaa"}}>Best: {formatTime(timeLeaderboard.levels[level][0].seconds)} by {timeLeaderboard.levels[level][0].name}</div>}
          {level < 5 && <div style={{fontSize:ipadTour(12),color:"#aaa",marginTop:6}}>Level {level+1}: {42+level*7} tiles · {getBonusCount(level+1)} bonus tiles</div>}
          {level < 5
            ? <button className="ll-btn" onClick={()=>handleNextLevel(false)} style={{marginTop:20,width:"100%",padding:ipadTour(14),borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(15),fontWeight:"bold"}}>Play Level {level+1} →</button>
            : <button className="ll-btn" onClick={()=>{ setLevelComplete(false); triggerFarewell(); }} style={{marginTop:20,width:"100%",padding:ipadTour(14),borderRadius:14,background:"linear-gradient(135deg,#a78bfa,#7c3aed)",color:"#fff",fontSize:ipadTour(15),fontWeight:"bold"}}>📊 See Today's Summary</button>
          }
        </div>
      </div>}

      {false&&<div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:"36px 32px",textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:`1px solid ${perfectDay?"rgba(255,215,0,0.35)":"rgba(255,255,255,0.18)"}`,maxWidth:320,width:"90%"}}>
          <div style={{fontSize:44}}>{perfectDay?"🌈":level===5?"🏆":"📊"}</div>
          <div style={{fontSize:22,fontWeight:"bold",color:perfectDay?"#f6d365":level===5?"#fda085":"#60a5fa",marginTop:8}}>{perfectDay?"Perfect Day!":level===5?"Level 5 Complete!":`Level ${level} — Game Over`}</div>
          <div style={{fontSize:28,fontWeight:"bold",color:"#fff",marginTop:8}}>{totalScore} pts</div>
          <div style={{fontSize:13,color:"#6ee7b7",marginTop:4}}>💰 Lifetime: {lifetimePoints.toLocaleString()} pts</div>
          <div style={{fontSize:12,color:"#aaa",marginTop:4}}>{getShortDate()} · ⏱️ {formatTime(totalTimeRef.current)}</div>
          {!isGuest&&<div style={{fontSize:11,color:"#a78bfa",marginTop:4}}>☁️ Progress saved to your account</div>}
          <input value={playerName} onChange={e=>setPlayerName(e.target.value)} placeholder="Your name…" style={{width:"100%",marginTop:14,padding:"11px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.1)",color:"#f5f0e8",fontSize:15,fontFamily:"Georgia,serif",outline:"none",textAlign:"center"}}/>
          <button className="ll-btn" onClick={async()=>{ await handleSaveScore(); triggerFarewell(); }} style={{marginTop:12,width:"100%",padding:"12px",borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:14,fontWeight:"bold"}}>Save Score 🏆</button>
          <button className="ll-btn" onClick={()=>{setShowNameInput(false);setTab("stats");}} style={{marginTop:8,width:"100%",padding:"10px",borderRadius:12,background:"linear-gradient(135deg,#a78bfa,#7c3aed)",color:"#fff",fontSize:13,fontWeight:"bold"}}>📊 View My Stats</button>
          <button className="ll-btn replay-btn" onClick={()=>{setShowNameInput(false);handleFullReset();}} style={{marginTop:10,width:"100%",padding:"20px",borderRadius:16,background:perfectDay?"linear-gradient(135deg,#00c853,#00e676)":"linear-gradient(135deg,#2979ff,#00b0ff)",color:perfectDay?"#003300":"#fff",fontSize:18,fontWeight:"bold",boxShadow:perfectDay?"0 0 28px rgba(0,200,83,0.6)":"0 0 28px rgba(41,121,255,0.6)",border:"none"}}>
            {perfectDay?"🧠 WOW! You're a Smart One!\nWant to Do it Again?":"✏️ Want to Try Again?"}
          </button>
          <button className="ll-btn" onClick={()=>setShowNameInput(false)} style={{marginTop:8,width:"100%",padding:"10px",borderRadius:12,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.4)",fontSize:11}}>Done for now</button>
        </div>
      </div>}

      {/* ── HEADER ── */}
      <div style={{zIndex:1,width:"100%",maxWidth:ipadBoardW()||ipadW(480),padding:"calc(var(--ll-safe-top, 0px) + 8px) 10px 0",minHeight:0}}>

        {/* ROW 1: Name · Date · Level · Tour — v126: added the red Level pill (bright-white text)
            and switched to justifyContent:space-between so all four items distribute EVENLY across
            the row regardless of the date string's length day-to-day. Date is no longer flex:1 (that
            pinned Name left / Tour right); each item is natural width and the row spaces them out. */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:ipadChrome(3),marginBottom:ipadChrome(3)}}>
          <span style={{fontSize:isIpadWidth()?21:11,color:"#22d3ee",fontWeight:"bold",whiteSpace:"nowrap",flexShrink:0,border:"1.5px solid rgba(34,211,238,0.6)",borderRadius:8,padding:`${ipadChrome(1)}px ${ipadChrome(7)}px`,background:"rgba(34,211,238,0.1)"}}>{playerName||"Guest"}</span>
          <span style={{fontSize:isIpadWidth()?21:11,color:"rgba(255,255,255,0.95)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textAlign:"center",flexShrink:1,minWidth:0}}>{getCalendarDate()}</span>
          {tab==="play" && <span style={{fontSize:isIpadWidth()?20:11,color:"#ffffff",fontWeight:"bold",whiteSpace:"nowrap",flexShrink:0,border:"1.5px solid rgba(220,38,38,0.95)",borderRadius:8,padding:`${ipadChrome(1)}px ${ipadChrome(7)}px`,background:"rgba(220,38,38,0.18)",letterSpacing:0.5}}>✦ Level {level} ✦</span>}
          {tab==="play" && <button onClick={()=>setShowTour(true)} style={{background:"rgba(167,139,250,0.25)",border:"1.5px solid rgba(167,139,250,0.7)",borderRadius:12,padding:`${ipadChrome(3)}px ${ipadChrome(10)}px`,cursor:"pointer",fontSize:isIpadWidth()?21:10,color:"#e0d4ff",fontFamily:"Georgia,serif",fontWeight:"bold",flexShrink:0}}>↺ Tour</button>}
        </div>

        {/* ROW 2: Replay Level# · Buy Level#+1 · UNDO — only on play tab (Start New Game removed v103; UNDO moved here from Row 4 in v118). On L5 there is no Buy button, so Replay + UNDO fill the row. */}
        {tab==="play" && (
        <div style={{display:"flex",gap:3,marginBottom:3}}>
          <button className="ll-btn" onClick={()=>!paused&&setShowResetConfirm(true)} style={{flex:1,padding:`${ipadChrome(7)}px ${ipadChrome(4)}px`,borderRadius:9,fontSize:ipadChrome(10),background:"rgba(96,165,250,0.15)",border:"1px solid rgba(96,165,250,0.55)",color:"#bfdbfe",textAlign:"center",fontFamily:"Georgia,serif",fontWeight:"bold"}}>{level===5?"🔄 Replay Level 5":"🔄 Replay Level "+level}</button>
          {level<5&&<button className="ll-btn" onClick={()=>setShowBuyModal(true)} style={{flex:1,padding:`${ipadChrome(7)}px ${ipadChrome(4)}px`,borderRadius:9,fontSize:ipadChrome(10),background:canBuy?"rgba(246,211,101,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${canBuy?"rgba(246,211,101,0.55)":"rgba(255,255,255,0.12)"}`,color:canBuy?"#fef08a":"rgba(255,255,255,0.3)",textAlign:"center",fontFamily:"Georgia,serif",fontWeight:"bold"}}>🔓 Buy Level {level+1} — {buyCost} pts</button>}
          <button className="ll-btn" onClick={()=>{ if(!undoUsed&&lastValidEntry&&totalRef.current>=1000) setShowUndoConfirm(true); }}
            disabled={undoUsed||!lastValidEntry||totalRef.current<1000||paused}
            style={{flex:1,padding:`${ipadChrome(7)}px ${ipadChrome(4)}px`,borderRadius:9,fontSize:ipadChrome(10),background:!undoUsed&&lastValidEntry&&totalRef.current>=1000&&!paused?"linear-gradient(135deg,rgba(251,113,133,0.6),rgba(225,29,72,0.5))":"rgba(255,255,255,0.05)",border:`1px solid ${!undoUsed&&lastValidEntry&&totalRef.current>=1000&&!paused?"rgba(251,113,133,0.9)":"rgba(255,255,255,0.25)"}`,color:!undoUsed&&lastValidEntry&&totalRef.current>=1000&&!paused?"#ffffff":"rgba(255,255,255,0.85)",textAlign:"center",fontWeight:"bold",fontFamily:"Georgia,serif",lineHeight:1.2}}>
            {undoUsed?"↩️ UNDO Used":(totalRef.current>=1000?`↩️ UNDO — 1,000 pts`:<span>↩️ UNDO at <span style={{color:"#fda085"}}>1,000 pts</span></span>)}
          </button>
        </div>
        )}

        {/* ROW 3: L5 · TIME · Level 00:00 · Total 00:00 · Pause — only on play tab */}
        {tab==="play" && (<>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.07)",borderRadius:7,padding:`${ipadChrome(3)}px ${ipadChrome(8)}px`,marginBottom:3,border:"1px solid rgba(255,255,255,0.18)",gap:4}}>
          {/* v126: the old level pill was removed from here — the level now lives in the top row (Row 1) as the red Level pill. */}
          {/* v126b: "TIME" label recolored to the Level-pill red; "Level"/"Total" labels enlarged + brightened
              (were tiny 0.5-opacity, barely visible); clock VALUES recolored to the Loot-box gold (#f6d365,
              top stop of the LOOT tile's gradient) so the running times stand clear of the blue/green/purple
              letter-counter boxes on the line below. */}
          <span style={{fontSize:ipadChrome(11),color:"#ff4444",fontWeight:"bold",letterSpacing:1,flexShrink:0}}>TIME</span>
          <span style={{fontSize:ipadChrome(11),color:"rgba(255,255,255,0.95)",fontWeight:"bold",flexShrink:0}}>Level</span>
          <span className={pulseTime?"pulse-big":""} style={{fontSize:ipadChrome(12),fontWeight:"bold",color:"#f6d365",fontFamily:"monospace",flexShrink:0}}>{formatTime(levelTime)}</span>
          <span style={{fontSize:ipadChrome(11),color:"rgba(255,255,255,0.95)",fontWeight:"bold",flexShrink:0}}>Total</span>
          <span style={{fontSize:ipadChrome(12),fontWeight:"bold",color:"#f6d365",fontFamily:"monospace",flexShrink:0}}>{formatTime(totalTime)}</span>
          <button className="ll-btn" onClick={handlePause} style={{background:paused?"linear-gradient(135deg,#00c853,#00e676)":"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:10,padding:`${ipadChrome(2)}px ${ipadChrome(8)}px`,fontSize:ipadChrome(9),color:paused?"#003300":"#ffffff",fontWeight:"bold",flexShrink:0}}>
            {paused?"▶️ Resume":"⏸️ Pause"}
          </button>
        </div>
        </>)}

        {/* ROW 4: Remaining · Vowels · Consonants — only on play tab. UNDO moved to Row 2 in v118.
            Boxes brightened v118: 2px full-color borders + soft glow, taller padding, bigger
            color-coded glowing numbers (blue/teal/violet), matching tinted labels — makes this
            row read as the critical at-a-glance gauge for successful play. (v119 will add the
            V/C-ratio danger pulse on top of this styling.) */}
        {tab==="play" && (
        <div style={{display:"flex",gap:5,marginBottom:3}}>
          <div style={{flex:1.4,background:"rgba(96,165,250,0.16)",border:"2px solid #60a5fa",borderRadius:9,padding:`${ipadChrome(6)}px ${ipadChrome(3)}px`,textAlign:"center",boxShadow:"0 0 8px rgba(96,165,250,0.45)"}}>
            <div style={{fontSize:ipadChrome(17),fontWeight:"bold",color:"#7cc4ff",textShadow:"0 0 8px rgba(96,165,250,0.7)"}}>{availableTiles.length}</div>
            <div style={{fontSize:ipadChrome(9),color:"#bfdbfe",fontWeight:"bold",letterSpacing:0.5}}>{isIpadWidth()?"REMAINING LETTERS":"REMAINING"}</div>
          </div>
          <div key={`vcv-${vcPulseNonce}`} style={{flex:1,background:"rgba(52,211,153,0.16)",border:"2px solid #34d399",borderRadius:9,padding:`${ipadChrome(6)}px ${ipadChrome(3)}px`,textAlign:"center",boxShadow:"0 0 8px rgba(52,211,153,0.4)",animation:vcPulse?"vcPulseV 2s ease-in-out 3":"none"}}>
            <div style={{fontSize:ipadChrome(17),fontWeight:"bold",color:"#6ee7b7",textShadow:"0 0 8px rgba(52,211,153,0.7)"}}>{vowelsRemaining}</div>
            <div style={{fontSize:ipadChrome(9),color:"#a7f3d0",fontWeight:"bold",letterSpacing:0.5}}>VOWELS</div>
          </div>
          <div key={`vcc-${vcPulseNonce}`} style={{flex:1,background:"rgba(167,139,250,0.16)",border:"2px solid #a78bfa",borderRadius:9,padding:`${ipadChrome(6)}px ${ipadChrome(3)}px`,textAlign:"center",boxShadow:"0 0 8px rgba(167,139,250,0.4)",animation:vcPulse?"vcPulseC 2s ease-in-out 3":"none"}}>
            <div style={{fontSize:ipadChrome(17),fontWeight:"bold",color:"#c4b5fd",textShadow:"0 0 8px rgba(167,139,250,0.7)"}}>{consonantsRemaining}</div>
            <div style={{fontSize:ipadChrome(9),color:"#ddd6fe",fontWeight:"bold",letterSpacing:0.5}}>CONSON.</div>
          </div>
        </div>
        )}

      </div>

      {/* ── MENU HUB TAB ── (new, May 2026) — replaces the old top-row tab pills.
          Players tap 📋 Menu from the Play screen to reach this hub of secondary destinations. */}
      {tab==="menu"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:ipadW(480),padding:"0 14px 14px",animation:"slideUp 0.3s ease"}}>
          <button className="ll-btn" onClick={()=>setTab("play")} style={{width:"100%",padding:ipadMenu(10),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadMenu(13),fontWeight:"bold",border:"none",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            ✏️ Back to Game
          </button>

          <div style={{fontSize:ipadMenu(11),color:"#f6d365",letterSpacing:3,fontWeight:"bold",textAlign:"center",marginBottom:14}}>📋 MENU</div>

          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
            <button className="ll-btn" onClick={()=>setTab("history")} style={{padding:`${ipadMenu(14)}px ${ipadMenu(14)}px`,borderRadius:14,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.22)",color:"#f5f0e8",fontFamily:"Georgia,serif",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:ipadMenu(14),width:"100%"}}>
              <div style={{fontSize:ipadMenu(28),flexShrink:0,lineHeight:1}}>📜</div>
              <div style={{flex:1,textAlign:"left"}}>
                <div style={{fontSize:ipadMenu(13),fontWeight:"bold",color:"#f5f0e8",marginBottom:2}}>History</div>
                <div style={{fontSize:ipadMenu(10),color:"rgba(255,255,255,0.9)",lineHeight:1.4}}>Every word you've played — including rejected words you can submit for review</div>
              </div>
            </button>

            <button className="ll-btn" onClick={()=>setTab("stats")} style={{padding:`${ipadMenu(14)}px ${ipadMenu(14)}px`,borderRadius:14,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.22)",color:"#f5f0e8",fontFamily:"Georgia,serif",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:ipadMenu(14),width:"100%"}}>
              <div style={{fontSize:ipadMenu(28),flexShrink:0,lineHeight:1}}>📊</div>
              <div style={{flex:1,textAlign:"left"}}>
                <div style={{fontSize:ipadMenu(13),fontWeight:"bold",color:"#f5f0e8",marginBottom:2}}>Stats</div>
                <div style={{fontSize:ipadMenu(10),color:"rgba(255,255,255,0.9)",lineHeight:1.4}}>Your scores, streaks, Perfect Days &amp; records</div>
              </div>
            </button>

            <button className="ll-btn" onClick={()=>setTab("badges")} style={{padding:`${ipadMenu(14)}px ${ipadMenu(14)}px`,borderRadius:14,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.22)",color:"#f5f0e8",fontFamily:"Georgia,serif",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:ipadMenu(14),width:"100%"}}>
              <div style={{fontSize:ipadMenu(28),flexShrink:0,lineHeight:1}}>🏅</div>
              <div style={{flex:1,textAlign:"left"}}>
                <div style={{fontSize:ipadMenu(13),fontWeight:"bold",color:"#f5f0e8",marginBottom:2}}>Badges</div>
                <div style={{fontSize:ipadMenu(10),color:"rgba(255,255,255,0.9)",lineHeight:1.4}}>Achievements you've earned</div>
              </div>
            </button>

            {/* Leaderboard — LOCKED for Guests (v57 spec).
                Guests see: dimmed colors, 🔒 lock icon, "Sign in to access" hint.
                Tap → opens Guest Upsell modal. */}
            <button className="ll-btn" onClick={()=>{
              if (isGuest) { setShowGuestUpsell(true); return; }
              setTab("leaderboard");
            }} style={{padding:`${ipadMenu(14)}px ${ipadMenu(14)}px`,borderRadius:14,background:isGuest?"rgba(255,255,255,0.03)":"rgba(255,255,255,0.06)",border:isGuest?"1px solid rgba(255,255,255,0.12)":"1px solid rgba(255,255,255,0.22)",color:isGuest?"rgba(255,255,255,0.45)":"#f5f0e8",fontFamily:"Georgia,serif",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:ipadMenu(14),width:"100%"}}>
              <div style={{fontSize:ipadMenu(28),flexShrink:0,lineHeight:1,filter:isGuest?"grayscale(0.6)":"none",opacity:isGuest?0.55:1}}>🏆</div>
              <div style={{flex:1,textAlign:"left"}}>
                <div style={{fontSize:ipadMenu(13),fontWeight:"bold",color:isGuest?"rgba(255,255,255,0.55)":"#f5f0e8",marginBottom:2,display:"flex",alignItems:"center",gap:6}}>
                  Leaders {isGuest&&<span style={{fontSize:ipadMenu(12),color:"rgba(167,139,250,0.85)"}}>🔒</span>}
                </div>
                <div style={{fontSize:ipadMenu(10),color:isGuest?"rgba(167,139,250,0.75)":"rgba(255,255,255,0.9)",lineHeight:1.4,fontStyle:isGuest?"italic":"normal"}}>{isGuest?"Sign in to access":"Top scores, longest words, Perfect Days"}</div>
              </div>
            </button>
          </div>

          {/* Tips — also as horizontal row for consistency */}
          <button className="ll-btn" onClick={()=>setTab("info")} style={{width:"100%",padding:`${ipadMenu(14)}px ${ipadMenu(14)}px`,borderRadius:14,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.22)",color:"#f5f0e8",fontFamily:"Georgia,serif",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:ipadMenu(14)}}>
            <div style={{fontSize:ipadMenu(24),flexShrink:0,lineHeight:1}}>ℹ️</div>
            <div style={{flex:1,textAlign:"left"}}>
              <div style={{fontSize:ipadMenu(13),fontWeight:"bold",color:"#f5f0e8",marginBottom:2}}>Tips &amp; How to Play</div>
              <div style={{fontSize:ipadMenu(10),color:"rgba(255,255,255,0.9)",lineHeight:1.4}}>Rules, scoring, strategy</div>
            </div>
          </button>

          {/* v210: Special Features — dedicated Menu page (B1). Same horizontal card style as Tips. */}
          <button className="ll-btn" onClick={()=>setTab("features")} style={{width:"100%",marginTop:8,padding:`${ipadMenu(14)}px ${ipadMenu(14)}px`,borderRadius:14,background:"rgba(246,211,101,0.08)",border:"1px solid rgba(246,211,101,0.35)",color:"#f5f0e8",fontFamily:"Georgia,serif",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:ipadMenu(14)}}>
            <div style={{fontSize:ipadMenu(24),flexShrink:0,lineHeight:1}}>🏴‍☠️</div>
            <div style={{flex:1,textAlign:"left"}}>
              <div style={{fontSize:ipadMenu(13),fontWeight:"bold",color:"#f5f0e8",marginBottom:2}}>Special Features</div>
              <div style={{fontSize:ipadMenu(10),color:"rgba(255,255,255,0.9)",lineHeight:1.4}}>The extras that make LetterLoot shine</div>
            </div>
          </button>

          {/* Settings — music toggle */}
          <div style={{marginTop:12,padding:`${ipadMenu(10)}px ${ipadMenu(14)}px`,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:ipadMenu(12),color:"#f5f0e8",fontFamily:"Georgia,serif"}}>♫ Background Music</span>
            <button onClick={()=>setMusicOn(m=>!m)} style={{background:musicOn?"linear-gradient(135deg,#00c853,#00e676)":"rgba(255,255,255,0.08)",border:`1px solid ${musicOn?"rgba(0,230,118,0.7)":"rgba(255,255,255,0.3)"}`,borderRadius:14,padding:`${ipadMenu(4)}px ${ipadMenu(14)}px`,cursor:"pointer",fontSize:ipadMenu(11),color:musicOn?"#003300":"rgba(255,255,255,0.85)",fontFamily:"Georgia,serif",fontWeight:"bold"}}>
              {musicOn?"ON":"OFF"}
            </button>
          </div>

          {/* Account section — only for signed-in (non-guest) users */}
          {!isGuest && (
            <div style={{marginTop:18,paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.1)"}}>
              <div style={{fontSize:ipadMenu(10),color:"rgba(255,255,255,0.85)",letterSpacing:2,fontWeight:"bold",textAlign:"center",marginBottom:8}}>ACCOUNT</div>
              <button onClick={onSignOut} style={{width:"100%",padding:ipadMenu(10),borderRadius:12,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.3)",color:"rgba(255,255,255,0.95)",fontSize:ipadMenu(12),fontFamily:"Georgia,serif",fontWeight:"bold",cursor:"pointer",marginBottom:8}}>
                Sign Out
              </button>
              <button onClick={()=>setShowDeleteAccount(true)} style={{width:"100%",padding:ipadMenu(10),borderRadius:12,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.4)",color:"#fca5a5",fontSize:ipadMenu(12),fontFamily:"Georgia,serif",fontWeight:"bold",cursor:"pointer"}}>
                Delete Account
              </button>
              <div style={{fontSize:ipadMenu(9),color:"rgba(255,255,255,0.7)",textAlign:"center",marginTop:6,lineHeight:1.5}}>
                Deleting your account permanently removes all your data and cannot be undone.
              </div>
            </div>
          )}

          {/* v308: in-app version line. Shown to EVERY player, guests included — the entire
              point is that a player can read their version off the screen instead of being
              walked through the App Store product page. Deliberately quiet: small, dim,
              bottom of the panel, no border box. APP_VERSION is bumped by each ship patch. */}
          <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.08)",textAlign:"center",fontSize:ipadMenu(9),color:"rgba(255,255,255,0.38)",fontFamily:"Georgia,serif",letterSpacing:0.5}}>
            LetterLoot {APP_VERSION}
          </div>
        </div>
      )}

      {/* ── PLAY TAB ── */}
      {tab==="play"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:ipadBoardW()||ipadW(480),padding:isIpadWidth()?"0 0 6px":"0 10px 6px",animation:"slideUp 0.3s ease",
          /* v144: hide the whole play/board view while the Level Welcome map overlay is up. The board
             is always mounted (only gated by tab==="play"), so on L2-L5 the freshly-swapped tiles could
             paint a frame before the map overlay composited over them — the real cause of the glimpse.
             With the board hidden until the map dismisses, there is nothing to glimpse. */
          visibility: levelAnnounceNum != null ? "hidden" : "visible"}}>

          {/* ROW 5: Submit Word · SCORE · Clear · Menu — Replay/Buy/UNDO all in Row 2 above tile board (v118) */}
          <div style={{display:"flex",gap:3,marginBottom:3}}>
            <button className="ll-btn" onClick={handleSubmit} disabled={currentWord.length<3||validating||paused||!online} style={{flex:3,padding:`${ipadChrome(9)}px ${ipadChrome(4)}px`,borderRadius:9,fontSize:ipadChrome(11),fontWeight:"bold",background:currentWord.length>=3&&!validating&&!paused&&online?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.08)",color:currentWord.length>=3&&!validating&&!paused&&online?"#1a1a2e":"rgba(255,255,255,0.3)",cursor:currentWord.length>=3&&!validating&&!paused&&online?"pointer":"default",textAlign:"center"}}>{validating?"Checking…":paused?"Paused":!online?"Offline":"Submit Word"}</button>
            <div style={{flex:1.5,padding:`${ipadChrome(4)}px ${ipadChrome(4)}px`,borderRadius:9,background:"linear-gradient(135deg,rgba(246,211,101,0.2),rgba(253,160,133,0.15))",border:"1.5px solid rgba(246,211,101,0.55)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",lineHeight:1.1}}>
              <div style={{fontSize:ipadChrome(7),color:"rgba(246,211,101,0.9)",fontWeight:"bold",letterSpacing:1}}>SCORE</div>
              <div style={{fontSize:ipadChrome(13),color:"#f6d365",fontWeight:"bold",fontFamily:"Georgia,serif"}}>{totalScore.toLocaleString()}</div>
            </div>
            <button className="ll-btn" onClick={()=>!validating&&!paused&&setSelected([])} style={{flex:1,padding:`${ipadChrome(9)}px ${ipadChrome(4)}px`,borderRadius:9,fontSize:ipadChrome(10),fontWeight:"bold",background:"rgba(192,132,252,0.25)",border:"2px solid rgba(216,180,254,0.95)",color:"#ede9fe",textAlign:"center"}}>✕ Clear</button>
            <button className="ll-btn" onClick={()=>setTab("menu")} style={{flex:1,padding:`${ipadChrome(9)}px ${ipadChrome(4)}px`,borderRadius:9,fontSize:ipadChrome(11),background:"rgba(246,211,101,0.15)",border:"1px solid rgba(246,211,101,0.6)",color:"#f6d365",textAlign:"center",fontWeight:"bold",fontFamily:"Georgia,serif"}}>📋 Menu</button>
          </div>

          {/* ROW 7: Tap tiles to build a word */}
          {spyHint && <div style={{textAlign:"center",fontSize:ipadWord(10),color:"#f6d365",fontWeight:"bold",marginBottom:3,animation:"slideUp 0.3s ease"}}>🔭 New! Tap the blue SCOUT chip to scout yer word first</div>}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.05)",borderRadius:8,padding:`${ipadWord(4)}px ${ipadWord(8)}px`,marginBottom:3,border:"1.5px solid rgba(255,255,255,0.8)",minHeight:ipadWord(30),animation:shake?"shake 0.4s ease":"none"}}>
            <div style={{display:"flex",gap:3,alignItems:"center",flex:1,flexWrap:"wrap"}}>
              {selected.length===0
                ?<div style={{color:"rgba(255,255,255,0.6)",fontSize:ipadWord(10),fontStyle:"italic"}}>Tap tiles to build a word…</div>
                :selected.map(id=>{ const tile=tiles.find(t=>t.id===id); return(
                  <div key={id} onClick={(e)=>{e.stopPropagation(); if(!validating&&!paused)setSelected(prev=>prev.filter(i=>i!==id));}} style={{background:tile?.bonus==="triple"?"linear-gradient(135deg,#e040fb,#7b1fa2)":tile?.bonus==="double"?"linear-gradient(135deg,#ffd700,#f57c00)":"linear-gradient(135deg,#5c6bc0,#512da8)",borderRadius:5,padding:`${ipadWord(3)}px ${ipadWord(6)}px`,fontSize:ipadWord(14),fontWeight:"bold",color:"#fff",cursor:"pointer",lineHeight:1}}>{tile?.letter}</div>
                );})
              }
            </div>
            {currentWord.length>0&&(
              <div style={{textAlign:"right",marginLeft:6,flexShrink:0}}>
                <div style={{fontSize:ipadWord(11),color:"#f6d365",fontWeight:"bold"}}>+{currentScore}{getLongWordBonus(currentWord.length)>0&&<span style={{color:"#6ee7b7",fontSize:ipadWord(9)}}> +{getLongWordBonus(currentWord.length)}!</span>}</div>
                <div style={{fontSize:ipadWord(7),color:"rgba(255,255,255,0.4)"}}>{currentWord.length} ltrs</div>
              </div>
            )}
            {currentWord.length>=3 && (
              <div onClick={(e)=>{e.stopPropagation(); openSpyglass();}} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,marginLeft:ipadWord(5),flexShrink:0,background:"linear-gradient(135deg,rgba(124,196,255,0.18),rgba(96,165,250,0.12))",border:"1.5px solid rgba(124,196,255,0.65)",borderRadius:8,padding:`${ipadWord(3)}px ${ipadWord(6)}px`,cursor:"pointer",boxShadow:spyUsed?"none":"0 0 10px rgba(124,196,255,0.55)",animation:spyUsed?"none":"pulse 2.2s ease-in-out infinite"}} title="Spyglass-check this word">
                <span style={{fontSize:ipadWord(6),color:"#7cc4ff",fontWeight:"bold",letterSpacing:0.5,whiteSpace:"nowrap"}}>SCOUT</span>
                <span style={{fontSize:ipadWord(15),lineHeight:1}}>🔭</span>
              </div>
            )}
            {/* (v106) Persistent Loot Letter reminder — Option B block pinned at the strip's right edge */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,marginLeft:ipadWord(6),flexShrink:0,background:"linear-gradient(135deg,rgba(246,211,101,0.16),rgba(253,160,133,0.12))",border:"1.5px solid rgba(246,211,101,0.55)",borderRadius:8,padding:`${ipadWord(3)}px ${ipadWord(7)}px`}}>
              <span style={{fontSize:ipadWord(6),color:"#fde68a",fontWeight:"bold",letterSpacing:0.5,whiteSpace:"nowrap"}}>💥 LOOT</span>
              <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:ipadWord(20),height:ipadWord(20),padding:`0 ${ipadWord(3)}px`,borderRadius:5,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadWord(14),fontWeight:"bold",lineHeight:1,boxShadow:"0 0 8px rgba(246,211,101,0.5)"}}>{getLootLetterForLevel(level)}</span>
            </div>
          </div>

          <div ref={boardMeasureRef} style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"6px 4px",border:"1px solid rgba(255,255,255,0.18)",position:"relative"}}>
            {paused&&<div style={{position:"absolute",inset:0,borderRadius:12,background:"rgba(0,0,0,0.82)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:5,backdropFilter:"blur(2px)"}}>
              <div style={{fontSize:40,marginBottom:8}}>⏸️</div>
              <div style={{fontSize:24,fontWeight:"bold",color:"#f6d365",letterSpacing:2}}>Paused</div>
              <button className="ll-btn" onClick={handlePause} style={{marginTop:18,padding:"12px 32px",borderRadius:14,background:"linear-gradient(135deg,#00c853,#00e676)",color:"#003300",fontSize:15,fontWeight:"bold",border:"none",cursor:"pointer",fontFamily:"Georgia,serif",boxShadow:"0 0 20px rgba(0,200,83,0.5)"}}>▶️ Resume</button>
            </div>}
            {tileRows.map((row,ri)=>(
              <div key={ri} style={{display:"flex",justifyContent:"center",gap:ipadTile(3,level),marginBottom:ipadTile(3,level)}}>
                {row.map(tile=>{ const isSel=selected.includes(tile.id); const isDouble=tile.bonus==="double"; const isTriple=tile.bonus==="triple"; const isLootUsed=tile.lootUsed; return(
                  <div key={tile.id} className={`ll-tile${isSel?" sel":""}${tile.used?" used":""}${isDouble?" bonus-double":""}${isTriple?" bonus-triple":""}${isLootUsed?" loot-used":""}${paused?" paused-tile":""}`} onClick={()=>!tile.used&&!validating&&!paused&&(awaitingFirstTapRef.current&&(awaitingFirstTapRef.current=false,setAwaitingFirstTap(false),!levelCompleteRef.current&&startTimer()),triggerHaptic("light"),setSelected(prev=>prev.includes(tile.id)?prev.filter(i=>i!==tile.id):[...prev,tile.id]))} style={{width:ipadTileW(38,level),height:ipadTile(44,level),background:isLootUsed?"linear-gradient(135deg,#f6d365,#fda085)":tile.used?"rgba(255,255,255,0.02)":isSel?"linear-gradient(135deg,#5c6bc0,#512da8)":isTriple?"linear-gradient(135deg,rgba(224,64,251,0.35),rgba(123,31,162,0.25))":isDouble?"linear-gradient(135deg,rgba(255,215,0,0.35),rgba(245,124,0,0.25))":"linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.07))",borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:isLootUsed?"2px solid #00e676":isSel?"2px solid #9fa8da":isTriple?"1px solid rgba(224,64,251,0.7)":isDouble?"1px solid rgba(255,215,0,0.7)":"1px solid rgba(255,255,255,0.22)",boxShadow:isLootUsed?"0 0 12px rgba(246,211,101,0.6),0 0 4px rgba(0,230,118,0.5)":isSel?`0 0 ${ipadTile(12,level)}px ${ipadTile(3,level)}px rgba(0,230,118,0.85), 0 0 ${ipadTile(4,level)}px rgba(0,230,118,0.5)`:"none",position:"relative"}}>
                    <div style={{fontSize:ipadTile(17,level),fontWeight:"bold",lineHeight:1,color:isLootUsed?"#1a1a2e":tile.used?"rgba(255,255,255,0.2)":"#fff"}}>{tile.letter}</div>
                    <div style={{fontSize:ipadTile(7,level),fontWeight:"bold",marginTop:1,color:isLootUsed?"#1a1a2e":tile.used?"rgba(255,255,255,0.1)":isTriple?"#e040fb":isDouble?"#ffd700":"#fda085"}}>{isLootUsed?"5×":isTriple?"3×":isDouble?"2×":tile.value}</div>
                    {isLootUsed&&<div style={{position:"absolute",top:-4,right:-4,fontSize:ipadTile(10,level)}}>✨</div>}
                  </div>
                );})}
              </div>
            ))}
          </div>

          {/* v83 (item 18): "End Game & Share Results" at the true BASE of the tile board.
              Understated; requires confirmation; routes to the Farewell summary + share. */}
          <div style={{marginTop:ipadChrome(8)}}>
            <button className="ll-btn" onClick={()=>setShowEndGameConfirm(true)} style={{width:"100%",padding:`${ipadChrome(8)}px ${ipadChrome(8)}px`,borderRadius:10,background:"rgba(255,255,255,0.05)",border:"1.5px solid rgba(239,68,68,0.85)",color:"#f6d365",fontSize:ipadChrome(14),fontWeight:"bold",fontFamily:"Georgia,serif",cursor:"pointer",letterSpacing:0.5}}>
              🏁 End Game &amp; Share Results
            </button>
          </div>

          {isGuest&&<div style={{marginTop:ipadChrome(8),textAlign:"center"}}><button className="ll-btn" onClick={onSignOut} style={{padding:`${ipadChrome(9)}px ${ipadChrome(20)}px`,borderRadius:12,background:"linear-gradient(135deg,#a78bfa,#7c3aed)",color:"#fff",fontSize:ipadChrome(13),fontWeight:"bold",border:"1px solid rgba(255,255,255,0.25)",boxShadow:"0 2px 8px rgba(124,58,237,0.5)"}}>☁️ Create Account to Save Progress</button></div>}
        </div>
      )}

      {/* ── BADGES TAB ── */}
      {tab==="badges"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:ipadW(480),padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          <button className="ll-btn" onClick={()=>setTab("menu")} style={{width:"100%",padding:"10px",borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:13,fontWeight:"bold",border:"none",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            ← Back to Menu
          </button>

          {[["core","⚡ Core Badges"],["level","📈 Level Badges"],["word","📝 Word Badges"],["alltime","🐉 All-Time Badges"]].map(([cat,title])=>(
            <div key={cat} style={{marginBottom:14}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",letterSpacing:3,marginBottom:4,paddingLeft:4}}>🏆 LIFETIME — {title}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                {BADGE_DEFS.filter(b=>(b.scope==="lifetime"||b.scope==="all")&&b.cat===cat).map(b=>{
                  const earned = lifetimeBadgeIds.includes(b.id);
                  const badgeDate = statsData.spaceBadgeDates?.[b.id];
                  return(<div key={b.id+"_l"} style={{background:earned?"linear-gradient(135deg,rgba(246,211,101,0.18),rgba(253,160,133,0.12))":"rgba(255,255,255,0.05)",border:earned?"1px solid rgba(246,211,101,0.45)":"1px solid rgba(255,255,255,0.14)",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                    <div style={{filter:earned?"none":"grayscale(1)",opacity:earned?1:0.22,display:"flex",justifyContent:"center"}}>{renderBadgeIcon(b)}</div>
                    <div style={{fontSize:11,fontWeight:"bold",marginTop:4,color:earned?"#f6d365":"rgba(255,255,255,0.4)"}}>{b.label}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.55)",marginTop:2,lineHeight:1.4}}>{b.desc}</div>
                    {earned&&<div style={{marginTop:3,fontSize:8,color:"#fda085",letterSpacing:2}}>✓ EARNED{badgeDate?` · ${badgeDate}`:""}</div>}
                    {b.id==="infinity"&&statsData.infinityBest>0&&<div style={{fontSize:9,color:"#a78bfa",marginTop:2}}>Best: {statsData.infinityBest} pts</div>}
                  </div>);
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab==="history"&&(()=>{
        const history = getDailyHistory();
        const returnButton = (<button className="ll-btn" onClick={()=>setTab("menu")} style={{width:"100%",padding:ipadMenu(10),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadMenu(13),fontWeight:"bold",border:"none",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>← Back to Menu</button>);
        const allGames = history.games || [];
        const hasAny = allGames.some(g => g && g.length > 0);
        const grandTotal = allGames.flat().filter(s=>s&&s.valid).reduce((a,s)=>a+s.score,0);
        return (
          <div style={{zIndex:1,width:"100%",maxWidth:ipadW(480),padding:"0 11px",animation:"slideUp 0.3s ease"}}>
            {!hasAny
              ?<div>{returnButton}<div style={{textAlign:"center",color:"rgba(255,255,255,0.35)",marginTop:40,fontSize:ipadMenu(12),fontStyle:"italic"}}>No words yet — go loot some letters!</div></div>
              :<div style={{display:"flex",flexDirection:"column",gap:5}}>{returnButton}
                {allGames.map((game, gi) => game && game.length > 0 ? (
                  <div key={gi}>
                    {allGames.filter(g=>g&&g.length>0).length > 1 && (
                      <div style={{textAlign:"center",fontSize:ipadMenu(9),color:"rgba(255,255,255,0.35)",letterSpacing:2,padding:"6px 0",marginBottom:2}}>— Game {gi+1} —</div>
                    )}
                    {[...game].sort((a,b)=>(b.score||0)-(a.score||0)).map((s,i)=>{
                      // Track which words have been reported (so button can show "Reported")
                      const reportedKey = "ll_reported_words";
                      const getReported = () => { try { return JSON.parse(localStorage.getItem(reportedKey)||"[]"); } catch { return []; } };
                      const isReported = getReported().includes(s.word.toLowerCase());
                      // Allow reporting of ANY invalid word (3+ letters) — admin reviews
                      const canReport = !s.valid && s.word.length >= 3 && !isReported;
                      return (
                      <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:s.loot?"linear-gradient(135deg,rgba(246,211,101,0.2),rgba(253,160,133,0.15))":s.wotd?"linear-gradient(135deg,rgba(167,139,250,0.2),rgba(124,58,237,0.15))":s.valid?(s.medical?"rgba(0,150,200,0.1)":"rgba(80,220,100,0.1)"):"rgba(220,80,80,0.1)",border:`1.5px solid ${s.loot?"rgba(0,230,118,0.7)":s.wotd?"rgba(167,139,250,0.7)":(s.valid?(s.medical?"rgba(0,150,200,0.3)":"rgba(80,220,100,0.3)"):"rgba(220,80,80,0.25)")}`,borderRadius:10,padding:`${ipadMenu(8)}px ${ipadMenu(12)}px`,marginBottom:4,boxShadow:s.loot?"0 0 12px rgba(246,211,101,0.4)":s.wotd?"0 0 12px rgba(167,139,250,0.35)":"none"}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:ipadMenu(14),fontWeight:"bold",letterSpacing:3,color:s.loot?"#f6d365":s.wotd?"#c4b5fd":"#f5f0e8"}}>{s.loot?"💥 ":s.wotd?"🎯 ":""}{s.word}{s.loot?" ✨":s.wotd?" ⭐":""}</div>
                          <div style={{fontSize:ipadMenu(9),color:"rgba(255,255,255,0.9)",marginTop:1}}>{s.loot?<span style={{color:"#f6d365",fontWeight:"bold"}}>💥 LOOT LETTER! 5× bonus{s.wotd?" · 🎯 WORD OF THE DAY!":""}</span>:s.wotd?<span style={{color:"#c4b5fd",fontWeight:"bold"}}>🎯 WORD OF THE DAY!</span>:s.valid?(s.medical?<span style={{color:"#60a5fa"}}>🩺 Medical</span>:<span style={{color:"#6ee7b7"}}>📖 Collegiate</span>):<span>Invalid ✗</span>}</div>
                          {!s.valid && (canReport ? (
                            <button onClick={async (e)=>{
                              e.stopPropagation();
                              try {
                                const { data, error } = await supabase
                                  .from("word_reports")
                                  .insert({ word: s.word.toLowerCase(), player_name: playerName||"Guest", email: user?.email || null })
                                  .select();
                                if (error) {
                                  console.error("Word report failed:", error);
                                  alert("Report failed: " + (error.message || JSON.stringify(error)));
                                  return;
                                }
                                if (!data || data.length === 0) {
                                  console.error("Word report: no row returned", data);
                                  alert("Report submitted but no confirmation received. Please try again.");
                                  return;
                                }
                                console.log("Word report success:", data);
                                const reported = getReported();
                                if (!reported.includes(s.word.toLowerCase())) reported.push(s.word.toLowerCase());
                                localStorage.setItem(reportedKey, JSON.stringify(reported));
                                setDailyHistory({...getDailyHistory()});
                                // Fire-and-forget admin notification (never blocks the report)
                                fetch("https://letterloot-6k6v.vercel.app/api/send-word-email", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    type: "admin_notify",
                                    word: s.word.toLowerCase(),
                                    playerName: playerName || "Guest",
                                    email: user?.email || "guest",
                                    reportedAt: new Date().toISOString()
                                  })
                                }).catch(err => console.error("Admin notify failed:", err));
                              } catch(err) { 
                                console.error("Word report exception:", err);
                                alert("Report failed: " + (err.message || "network error"));
                              }
                            }} style={{marginTop:6,padding:`${ipadMenu(4)}px ${ipadMenu(10)}px`,borderRadius:8,background:"linear-gradient(135deg,rgba(246,211,101,0.25),rgba(253,160,133,0.18))",border:"1px solid rgba(246,211,101,0.5)",color:"#f6d365",fontSize:ipadMenu(10),fontWeight:"bold",fontFamily:"Georgia,serif",cursor:"pointer"}}>📝 Report for review</button>
                          ) : isReported ? (
                            <div style={{marginTop:6,fontSize:ipadMenu(10),color:"#6ee7b7"}}>✓ Reported — thanks!</div>
                          ) : null)}
                        </div>
                        <div style={{textAlign:"right",marginLeft:8}}>
                          <div style={{fontSize:ipadMenu(17),fontWeight:"bold",color:s.valid?"#6ee7b7":"rgba(255,255,255,0.25)"}}>{s.valid?`+${s.score}`:"—"}</div>
                          {s.valid&&<div style={{fontSize:ipadMenu(9),color:"rgba(255,255,255,0.85)"}}>pts</div>}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ) : null)}
                <div style={{textAlign:"center",padding:ipadMenu(10),background:"rgba(255,255,255,0.07)",borderRadius:10,marginTop:2,border:"1px solid rgba(255,255,255,0.15)"}}>
                  <div style={{fontSize:ipadMenu(10),color:"rgba(255,255,255,0.9)"}}>TODAY'S TOTAL ({allGames.filter(g=>g&&g.length>0).length} game{allGames.filter(g=>g&&g.length>0).length!==1?"s":""})</div>
                  <div style={{fontSize:ipadMenu(24),fontWeight:"bold",color:"#f6d365"}}>{grandTotal}</div>
                </div>
              </div>
            }
          </div>
        );
      })()}

      {/* ── STATS TAB ── */}
      {tab==="stats"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:ipadW(480),padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          <button className="ll-btn" onClick={()=>setTab("badges")} style={{width:"100%",padding:ipadDense(13),borderRadius:14,background:"linear-gradient(135deg,rgba(240,147,251,0.25),rgba(167,139,250,0.2))",border:"2px solid rgba(240,147,251,0.6)",color:"#f093fb",fontSize:ipadDense(14),fontWeight:"bold",marginBottom:8,letterSpacing:1}}>🏅 View My Badges — {lifetimeBadgeIds.length}/{BADGE_DEFS.filter(b=>b.scope==="lifetime"||b.scope==="all").length} Earned</button>
          <button className="ll-btn" onClick={()=>setTab("menu")} style={{width:"100%",padding:ipadDense(10),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadDense(13),fontWeight:"bold",border:"none",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            ← Back to Menu
          </button>

          <div style={{background:"linear-gradient(135deg,rgba(246,211,101,0.15),rgba(253,160,133,0.1))",borderRadius:14,padding:ipadDense(16),marginBottom:8,border:"2px solid rgba(246,211,101,0.35)",textAlign:"center"}}>
            <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:3,marginBottom:5}}>💰 LIFETIME POINTS</div>
            <div style={{fontSize:ipadDense(44),fontWeight:"bold",color:"#f6d365"}}>{lifetimePoints.toLocaleString()}</div>
            <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",marginTop:3}}>Lifetime points</div>
            {!isGuest&&<div style={{marginTop:6,fontSize:ipadDense(10),color:"#a78bfa"}}>☁️ Saved to your account</div>}
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:ipadDense(12),marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:3,marginBottom:10}}>📅 DAYS & STREAKS</div>
            <div style={{display:"flex",justifyContent:"space-around"}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(26),fontWeight:"bold",color:"#60a5fa"}}>{statsData.daysPlayed}</div><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>Total Days</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(26),fontWeight:"bold",color:"#fda085"}}>🔥 {statsData.currentStreak}</div><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>Current Streak</div>{statsData.currentStreak>0&&statsData.currentStreak===statsData.longestStreak&&<div style={{fontSize:ipadDense(8),color:"#6ee7b7"}}>Personal Best!</div>}</div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(26),fontWeight:"bold",color:"#f6d365"}}>🏆 {statsData.longestStreak}</div><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>Longest Streak</div></div>
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:ipadDense(12),marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:3,marginBottom:10}}>🌈🏆 PERFECT DAYS</div>
            <div style={{display:"flex",justifyContent:"space-around"}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(26),fontWeight:"bold",color:"#6ee7b7"}}>{weekPerfectCount}</div><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>This Week</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(26),fontWeight:"bold",color:"#f6d365"}}>{statsData.perfectDaysAllTime}</div><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>All Time</div></div>
            </div>
          </div>
          {(()=>{
            // v302: My Flourishes — local 30-day log (guests too) merged with the cloud ff_words rows
            // (signed-in), deduped on date|level|word. Local first so the Game 1/2 tag survives.
            const seen = new Set(); const rows = [];
            const push = (date, level, word, score, game) => { const w = String(word || "").toUpperCase(); const k = `${date}|${level}|${w}`; if (!date || seen.has(k)) return; seen.add(k); rows.push({ date, level, word: w, score: score || 0, game }); };
            getFFLog().forEach(e => push(e.date, e.level, e.word, e.score, e.game));
            (myFFCloud || []).forEach(r => push(r.date_key, r.level, r.word, r.score, null));
            const byDay = {}; rows.forEach(r => { (byDay[r.date] = byDay[r.date] || []).push(r); });
            const days = Object.keys(byDay).sort((a, b) => dateKeyToNum(b) - dateKeyToNum(a));
            const total = rows.reduce((t, r) => t + r.score, 0);
            const longest = rows.reduce((b, r) => (!b || r.word.length > b.word.length) ? r : b, null);
            const fmtDay = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
            return <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:ipadDense(12),marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
              <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:3,marginBottom:10}}>🏴‍☠️ MY FLOURISHES</div>
              <div style={{display:"flex",justifyContent:"space-around",marginBottom:10}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(17),fontWeight:"bold",color:"#fbbf24"}}>{rows.length}</div><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>Flourishes</div></div>
                <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
                <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(17),fontWeight:"bold",color:"#f6d365"}}>{total.toLocaleString()}</div><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>Bonus pts</div></div>
                <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
                <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(17),fontWeight:"bold",color:"#c4b5fd"}}>{longest ? longest.word : "—"}</div><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>Longest{longest ? ` (${longest.word.length})` : ""}</div></div>
              </div>
              {!days.length
                ? <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.5)",fontStyle:"italic",textAlign:"center"}}>No Flourishes logged yet — clear a board with a 5+ letter word!</div>
                : days.slice(0, 30).map(k => <div key={k} style={{paddingTop:6,borderTop:"1px solid rgba(255,255,255,0.07)",marginTop:6}}>
                    <div style={{fontSize:ipadDense(10),color:"#a78bfa",fontWeight:"bold",marginBottom:2}}>{fmtDay(k)}</div>
                    {byDay[k].sort((a, b) => ((a.game || 0) - (b.game || 0)) || (a.level - b.level)).map((r, i) => <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:ipadDense(11),color:"#f5f0e8",lineHeight:1.6}}><span>L{r.level} · {r.word}{r.game > 0 ? <span style={{color:"rgba(255,255,255,0.45)",fontSize:ipadDense(9)}}> Game {r.game + 1}</span> : null}</span><span style={{color:"#fbbf24"}}>+{r.score.toLocaleString()}</span></div>)}
                  </div>)}
              {!isGuest && myFFCloud === null && <div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.4)",marginTop:6,textAlign:"center"}}>☁️ Loading cloud history…</div>}
            </div>;
          })()}
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:ipadDense(12),marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:3,marginBottom:10}}>📈 DAILY SCORES</div>
            <div style={{display:"flex",justifyContent:"space-around",marginBottom:10}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(17),fontWeight:"bold",color:"#fda085"}}>{statsData.highScoreToday||"—"}</div><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>Best Today</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(17),fontWeight:"bold",color:"#fda085"}}>{weekHighScore||"—"}</div><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>Week Best</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(17),fontWeight:"bold",color:"#f6d365"}}>{statsData.highScoreAllTime||"—"}</div><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>Best Ever</div></div>
            </div>
            <div style={{display:"flex",justifyContent:"space-around",paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(17),fontWeight:"bold",color:"#a78bfa"}}>{avgDaily.toLocaleString()}</div><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>Daily Avg</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(17),fontWeight:"bold",color:"#6ee7b7"}}>{allTimeTotal.toLocaleString()}</div><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>All-Time Total</div></div>
            </div>
            <div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.85)",marginTop:10,marginBottom:5,textAlign:"center",letterSpacing:1}}>LAST 7 DAYS</div>
            <div style={{display:"flex",gap:3,alignItems:"flex-end",height:ipadDense(44),justifyContent:"space-around"}}>
              {last7Days.map((d,i)=>(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{width:"100%",background:d.score>0?"linear-gradient(180deg,#f6d365,#fda085)":"rgba(255,255,255,0.08)",borderRadius:"3px 3px 0 0",height:d.score>0?`${Math.max(4,(d.score/maxDayScore)*ipadDense(36))}px`:"4px",transition:"height 0.3s ease"}}/>
                  <div style={{fontSize:ipadDense(7),color:"rgba(255,255,255,0.75)"}}>{d.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:ipadDense(12),marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:3,marginBottom:10}}>💎 HIGHEST WORD SCORE</div>
            <div style={{display:"flex",justifyContent:"space-around"}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(17),fontWeight:"bold",color:"#f093fb"}}>{statsData.highWordToday||"—"}</div>{statsData.highWordTodayWord&&<div style={{fontSize:ipadDense(8),color:"#a78bfa",letterSpacing:1}}>{statsData.highWordTodayWord}</div>}<div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>Today</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(17),fontWeight:"bold",color:"#f093fb"}}>{weekHighWord||"—"}</div><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>This Week</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(17),fontWeight:"bold",color:"#a78bfa"}}>{statsData.highWordAllTime||"—"}</div>{statsData.highWordAllTimeWord&&<div style={{fontSize:ipadDense(8),color:"#a78bfa",letterSpacing:1}}>{statsData.highWordAllTimeWord}</div>}<div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>All Time</div></div>
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:ipadDense(12),marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:3,marginBottom:10}}>🏆 BEST SCORE PER LEVEL</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[1,2,3,4,5].map(lvl=>{
                const best=statsData.bestScorePerLevel?.[String(lvl)];
                return(<div key={lvl} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.04)",borderRadius:9,padding:`${ipadDense(7)}px ${ipadDense(12)}px`,border:best?"1px solid rgba(246,211,101,0.25)":"1px solid rgba(255,255,255,0.07)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{fontSize:ipadDense(11),fontWeight:"bold",color:best?"#f6d365":"rgba(255,255,255,0.3)",minWidth:ipadDense(28)}}>L{lvl}</div>{best&&<div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.75)"}}>{best.date}</div>}</div>
                  <div style={{fontSize:best?ipadDense(17):ipadDense(13),fontWeight:"bold",color:best?"#fda085":"rgba(255,255,255,0.2)"}}>{best?`${best.score.toLocaleString()} pts`:"—"}</div>
                </div>);
              })}
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:ipadDense(12),marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:3,marginBottom:8}}>⏱️ FASTEST LEVEL TIMES</div>
            <div style={{display:"flex",gap:5,justifyContent:"center",marginBottom:10}}>
              {[1,2,3,4,5].map(l=>(<button key={l} className="ll-tab" onClick={()=>setSelectedLevelView(l)} style={{width:ipadDense(36),height:ipadDense(36),borderRadius:8,fontSize:ipadDense(11),fontWeight:"bold",background:selectedLevelView===l?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.08)",color:selectedLevelView===l?"#1a1a2e":"rgba(255,255,255,0.9)",border:selectedLevelView===l?"none":"1px solid rgba(255,255,255,0.15)"}}>L{l}</button>))}
            </div>
            {(()=>{ const best=statsData.fastestLevels?.[selectedLevelView]; return best?(<div style={{textAlign:"center",marginBottom:8,background:"rgba(96,165,250,0.1)",borderRadius:9,padding:ipadDense(8),border:"1px solid rgba(96,165,250,0.3)"}}><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)",marginBottom:2,letterSpacing:1}}>PERSONAL BEST</div><div style={{fontSize:ipadDense(22),fontWeight:"bold",color:"#60a5fa",fontFamily:"monospace"}}>{formatTime(best.seconds)}</div>{best.date&&<div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.75)",marginTop:2}}>{best.date}</div>}</div>):(<div style={{textAlign:"center",color:"rgba(255,255,255,0.3)",fontSize:ipadDense(11),fontStyle:"italic",padding:"6px 0",marginBottom:8}}>No best time yet for Level {selectedLevelView}</div>); })()}
            {!timeLeaderboard.levels?.[selectedLevelView]?.length?<div style={{textAlign:"center",color:"rgba(255,255,255,0.3)",fontSize:ipadDense(11),fontStyle:"italic",padding:"8px 0"}}>No times yet — clear the board to record!</div>
              :timeLeaderboard.levels[selectedLevelView].map((entry,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,background:i===0?"rgba(96,165,250,0.1)":"rgba(255,255,255,0.03)",border:i===0?"1px solid rgba(96,165,250,0.3)":"1px solid rgba(255,255,255,0.06)",borderRadius:9,padding:`${ipadDense(7)}px ${ipadDense(10)}px`,marginBottom:5}}><div style={{fontSize:ipadDense(16),minWidth:ipadDense(24),textAlign:"center"}}>{medalFor(i)}</div><div style={{flex:1}}><div style={{fontSize:ipadDense(12),fontWeight:"bold",color:"#f5f0e8"}}>{entry.name}</div><div style={{fontSize:ipadDense(8),color:"rgba(255,255,255,0.75)"}}>{entry.date}</div></div><div style={{fontSize:ipadDense(15),fontWeight:"bold",color:"#60a5fa",fontFamily:"monospace"}}>{formatTime(entry.seconds)}</div></div>))
            }
            <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:2,marginBottom:8}}>🌈🏆 PERFECT DAY TIMES</div>
              {!timeLeaderboard.perfect?.length?<div style={{textAlign:"center",color:"rgba(255,255,255,0.3)",fontSize:ipadDense(11),fontStyle:"italic",padding:"6px 0"}}>No Perfect Day times yet!</div>
                :timeLeaderboard.perfect.slice(0,5).map((entry,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,background:i===0?"linear-gradient(135deg,rgba(246,211,101,0.1),rgba(253,160,133,0.06))":"rgba(255,255,255,0.02)",border:i===0?"1px solid rgba(246,211,101,0.25)":"1px solid rgba(255,255,255,0.06)",borderRadius:9,padding:`${ipadDense(7)}px ${ipadDense(10)}px`,marginBottom:4}}><div style={{fontSize:ipadDense(16),minWidth:ipadDense(24),textAlign:"center"}}>{medalFor(i)}</div><div style={{flex:1}}><div style={{fontSize:ipadDense(12),fontWeight:"bold",color:"#f5f0e8"}}>{entry.name} 🌈🏆</div><div style={{fontSize:ipadDense(8),color:"rgba(255,255,255,0.75)"}}>{entry.date}</div></div><div style={{fontSize:ipadDense(15),fontWeight:"bold",color:"#f6d365",fontFamily:"monospace"}}>{formatTime(entry.seconds)}</div></div>))
              }
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:ipadDense(12),marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:3,marginBottom:10}}>📚 DICTIONARY BREAKDOWN</div>
            <div style={{display:"flex",justifyContent:"space-around"}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(22),fontWeight:"bold",color:"#6ee7b7"}}>{statsData.collegiateWords||0}</div><div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)"}}>📖 Collegiate</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(22),fontWeight:"bold",color:"#60a5fa"}}>{statsData.medicalWords||0}</div><div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)"}}>🩺 Medical</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(22),fontWeight:"bold",color:"#f6d365"}}>{(statsData.collegiateWords||0)+(statsData.medicalWords||0)}</div><div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)"}}>Total Valid</div></div>
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:ipadDense(12),marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:3,marginBottom:8}}>📏 LONGEST WORDS</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.07)"}}><div style={{fontSize:ipadDense(11),color:"rgba(255,255,255,0.9)"}}>Today's Best</div><div style={{fontSize:ipadDense(12),fontWeight:"bold",color:"#a78bfa",letterSpacing:2}}>{statsData.longestWordToday||"—"}{statsData.longestWordToday&&<span style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.85)",marginLeft:6}}>({statsData.longestWordToday.length} letters)</span>}</div></div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0"}}><div style={{fontSize:ipadDense(11),color:"rgba(255,255,255,0.9)"}}>All-Time Best</div><div style={{fontSize:ipadDense(12),fontWeight:"bold",color:"#f093fb",letterSpacing:2}}>{statsData.longestWordAllTime||"—"}{statsData.longestWordAllTime&&<span style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.85)",marginLeft:6}}>({statsData.longestWordAllTime.length} letters)</span>}</div></div>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:ipadDense(12),marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:3,marginBottom:8}}>🌟 LONG WORD BONUSES</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,justifyContent:"center"}}>
              {[["8","+1"],["9","+3"],["10","+6"],["11","+10"],["12","+15"],["13","+25"],["14+","+35+"]].map(([len,bonus])=>(
                <div key={len} style={{textAlign:"center",background:"rgba(255,255,255,0.06)",borderRadius:9,padding:`${ipadDense(6)}px ${ipadDense(8)}px`,border:"1px solid rgba(255,255,255,0.1)",minWidth:ipadDense(46)}}>
                  <div style={{fontSize:ipadDense(14),fontWeight:"bold",color:(statsData.longWordBonuses?.[len]||0)>0?"#f6d365":"rgba(255,255,255,0.2)"}}>{statsData.longWordBonuses?.[len]||0}</div>
                  <div style={{fontSize:ipadDense(7),color:"rgba(255,255,255,0.85)"}}>{len} ltrs</div>
                  <div style={{fontSize:ipadDense(7),color:"rgba(255,255,255,0.35)"}}>{bonus}</div>
                </div>
              ))}
            </div>
          </div>
          {/* ── Bonus Level Progress (shown when ENABLE_BONUS_LEVELS=true) ── */}
          {ENABLE_BONUS_LEVELS && (
            <div style={{background:"linear-gradient(135deg,rgba(246,211,101,0.1),rgba(253,160,133,0.08))",borderRadius:14,padding:ipadDense(14),marginBottom:8,border:"2px solid rgba(246,211,101,0.3)",textAlign:"center"}}>
              <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:3,marginBottom:6}}>🏛️ BONUS LEVELS</div>
              {bonusLevelUnlocked
                ? <div style={{fontSize:ipadDense(13),color:"#f6d365",fontWeight:"bold"}}>The Vault is unlocked! 🏛️</div>
                : <>
                    <div style={{fontSize:ipadDense(13),color:"#f5f0e8",marginBottom:6}}>
                      <span style={{color:"#f6d365",fontWeight:"bold",fontSize:ipadDense(20)}}>{consecutivePerfect}</span>
                      <span style={{color:"rgba(255,255,255,0.9)"}}> / {BONUS_CONSECUTIVE_REQUIRED} consecutive Perfect Days</span>
                    </div>
                    <div style={{background:"rgba(255,255,255,0.1)",borderRadius:6,height:8,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.min(100,(consecutivePerfect/BONUS_CONSECUTIVE_REQUIRED)*100)}%`,background:"linear-gradient(90deg,#f6d365,#fda085)",borderRadius:6,transition:"width 0.5s ease"}}/>
                    </div>
                    <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.85)",marginTop:6}}>Unlock The Vault — Level 6 with 1.5× letter values!</div>
                  </>
              }
            </div>
          )}
          <div style={{textAlign:"center",marginBottom:8}}>
            <button onClick={()=>setShowTour(true)} style={{background:"rgba(139,92,246,0.15)",border:"1px solid rgba(167,139,250,0.4)",color:"#a78bfa",padding:`${ipadDense(8)}px ${ipadDense(20)}px`,borderRadius:20,fontSize:ipadDense(11),cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:"bold"}}>↺ Replay Tour</button>
          </div>
          <div style={{textAlign:"center",marginBottom:8}}>
            {!confirmResetStats
              ? <button onClick={()=>setConfirmResetStats(true)} style={{background:"none",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.3)",padding:`${ipadDense(5)}px ${ipadDense(14)}px`,borderRadius:20,fontSize:ipadDense(9),cursor:"pointer",fontFamily:"Georgia,serif"}}>Reset Stats</button>
              : <div style={{background:"rgba(220,38,38,0.1)",border:"1px solid rgba(220,38,38,0.3)",borderRadius:12,padding:`${ipadDense(10)}px ${ipadDense(12)}px`,display:"inline-flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:ipadDense(10),color:"#fca5a5"}}>Are you sure?</span>
                  <button onClick={()=>{ const def={daysPlayed:0,lastPlayedDate:null,currentStreak:0,longestStreak:0,lastStreakDate:null,perfectDaysAllTime:0,perfectDaysWeek:{},weekKey:"",highScoreAllTime:0,highScoreWeek:{},highScoreToday:0,highWordAllTime:0,highWordWeek:{},highWordToday:0,highWordTodayWord:"",highWordAllTimeWord:"",fastestLevels:{"1":null,"2":null,"3":null,"4":null,"5":null},bestScorePerLevel:{"1":null,"2":null,"3":null,"4":null,"5":null},dailyScores:{},collegiateWords:0,medicalWords:0,longestWordToday:"",longestWordAllTime:"",longWordBonuses:{"8":0,"9":0,"10":0,"11":0,"12":0,"13":0,"14+":0},infinityBest:0,infinityBestDate:"",spaceBadgeDates:{}}; saveLocalStats(def); setStatsData(def); setConfirmResetStats(false); }} style={{background:"rgba(220,38,38,0.4)",border:"1px solid rgba(220,38,38,0.6)",borderRadius:8,padding:`${ipadDense(3)}px ${ipadDense(10)}px`,fontSize:ipadDense(9),color:"#fff",cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:"bold"}}>Yes, Reset</button>
                  <button onClick={()=>setConfirmResetStats(false)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,padding:`${ipadDense(3)}px ${ipadDense(10)}px`,fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)",cursor:"pointer",fontFamily:"Georgia,serif"}}>Cancel</button>
                </div>
            }
          </div>
        </div>
      )}

      {/* ── LEADERBOARD TAB ── */}
      {tab==="leaderboard"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:ipadW(480),padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          {/* Header */}
          <div style={{background:"linear-gradient(135deg,rgba(246,211,101,0.15),rgba(253,160,133,0.1))",borderRadius:14,padding:`${ipadMenu(12)}px ${ipadMenu(16)}px`,marginBottom:8,border:"2px solid rgba(246,211,101,0.35)",textAlign:"center"}}>
            <div style={{fontSize:ipadMenu(16),fontWeight:"bold",color:"#f6d365",letterSpacing:2,marginBottom:3}}>🏆 LEADERBOARD</div>
            <div style={{fontSize:ipadMenu(10),color:"rgba(255,255,255,0.9)"}}>Registered players only · Updated live</div>
            {isGuest&&<div style={{marginTop:8,background:"rgba(167,139,250,0.15)",borderRadius:10,padding:`${ipadMenu(8)}px ${ipadMenu(12)}px`,border:"1px solid rgba(167,139,250,0.4)"}}>
              <div style={{fontSize:ipadMenu(11),color:"#a78bfa",fontWeight:"bold"}}>Want to appear on the leaderboard?</div>
              <div style={{fontSize:ipadMenu(10),color:"rgba(255,255,255,0.9)",marginTop:2}}>Create a free account to save your scores and compete!</div>
              <button className="ll-btn" onClick={onSignOut} style={{marginTop:6,padding:`${ipadMenu(5)}px ${ipadMenu(14)}px`,borderRadius:10,background:"linear-gradient(135deg,#a78bfa,#7c3aed)",color:"#fff",fontSize:ipadMenu(10),fontWeight:"bold"}}>Create Account →</button>
            </div>}
          </div>

          {/* Prominent return button at top — only shown when arrived from Perfect Day */}
          {leaderboardFromPerfectDay&&(
            <button className="ll-btn" onClick={()=>{ setLeaderboardFromPerfectDay(false); setTab('play'); setPerfectDayAchieved(true); }} style={{width:"100%",padding:ipadMenu(12),borderRadius:14,background:"linear-gradient(135deg,rgba(255,215,0,0.25),rgba(255,165,0,0.2))",border:"2px solid rgba(255,215,0,0.6)",color:"#f6d365",fontSize:ipadMenu(13),fontWeight:"bold",marginBottom:8}}>
              🌈 ← Back to Perfect Day
            </button>
          )}

          {/* Quick nav to History — players often want to review today's words / report rejected ones after seeing leaderboard */}
          <button className="ll-btn" onClick={()=>setTab("history")} style={{width:"100%",padding:ipadMenu(10),borderRadius:12,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.3)",color:"#f5f0e8",fontSize:ipadMenu(12),fontWeight:"bold",fontFamily:"Georgia,serif",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            📜 View Today's History & Report Words
          </button>

          {/* Category tabs */}
          <div style={{display:"flex",gap:3,marginBottom:6}}>
            {[{id:"scores",label:"💰 Scores"},{id:"words",label:"💎 Words"},{id:"longest",label:"📏 Longest"},{id:"flourish",label:"🏴‍☠️ Flourish"},{id:"perfect",label:"🌈🏆 Perfect"},{id:"times",label:"⏱️ Times"},{id:"streaks",label:"🔥 Streaks"}].map(t=>(
              <button key={t.id} className="ll-tab" onClick={()=>setLeaderboardTab(t.id)} style={{flex:1,padding:`${ipadMenu(4)}px ${ipadMenu(2)}px`,borderRadius:10,fontSize:ipadMenu(8),background:leaderboardTab===t.id?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.08)",color:leaderboardTab===t.id?"#1a1a2e":"#f0e8d8",fontWeight:leaderboardTab===t.id?"bold":"normal",border:leaderboardTab===t.id?"none":"1px solid rgba(255,255,255,0.2)",whiteSpace:"nowrap",textAlign:"center"}}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Period tabs — hidden for streaks AND times (both are all-time / lifetime only) */}
          {leaderboardTab!=="streaks"&&leaderboardTab!=="times"&&(
            <div style={{display:"flex",gap:3,marginBottom:8}}>
              {[{id:"daily",label:"☀️ Today"},{id:"weekly",label:"📅 This Week"},{id:"alltime",label:"🏆 All-Time"}].map(p=>(
                <button key={p.id} className="ll-tab" onClick={()=>setLeaderboardPeriod(p.id)} style={{flex:1,padding:`${ipadMenu(4)}px ${ipadMenu(2)}px`,borderRadius:10,fontSize:ipadMenu(9),background:leaderboardPeriod===p.id?"linear-gradient(135deg,#a78bfa,#7c3aed)":"rgba(255,255,255,0.06)",color:leaderboardPeriod===p.id?"#fff":"rgba(255,255,255,0.9)",fontWeight:leaderboardPeriod===p.id?"bold":"normal",border:leaderboardPeriod===p.id?"none":"1px solid rgba(255,255,255,0.15)",textAlign:"center"}}>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* ── TIMES sub-tab (#18b) — own data source (timeCloudData), all-time only, level selector ── */}
          {leaderboardTab==="times"&&(<>
            {timeCloudLoading&&<div style={{textAlign:"center",padding:ipadMenu(30),color:"rgba(255,255,255,0.4)",fontSize:ipadMenu(12)}}>Loading times…</div>}
            {!timeCloudLoading&&!timeCloudData&&<div style={{textAlign:"center",padding:ipadMenu(30),color:"rgba(255,255,255,0.3)",fontSize:ipadMenu(11),fontStyle:"italic"}}>Could not load times. Check your connection.</div>}
            {!timeCloudLoading&&timeCloudData&&(<div>
              {/* Level selector — mirrors the Longest/Word-Scores level pattern */}
              <div style={{display:"flex",gap:5,justifyContent:"center",marginBottom:10}}>
                {[1,2,3,4,5].map(l=>(<button key={l} className="ll-tab" onClick={()=>setSelectedLevelView(l)} style={{width:ipadMenu(38),height:ipadMenu(34),borderRadius:8,fontSize:ipadMenu(11),fontWeight:"bold",background:selectedLevelView===l?"linear-gradient(135deg,#60a5fa,#3b82f6)":"rgba(255,255,255,0.08)",color:selectedLevelView===l?"#fff":"rgba(255,255,255,0.9)",border:selectedLevelView===l?"none":"1px solid rgba(255,255,255,0.15)"}}>L{l}</button>))}
              </div>
              <div style={{textAlign:"center",fontSize:ipadMenu(10),color:"rgba(255,255,255,0.5)",marginBottom:8,letterSpacing:1}}>FASTEST LEVEL {selectedLevelView} TIMES · ALL-TIME</div>
              {!timeCloudData.levels?.[selectedLevelView]?.length
                ?<div style={{textAlign:"center",color:"rgba(255,255,255,0.3)",fontSize:ipadMenu(11),fontStyle:"italic",padding:ipadMenu(14)}}>No times recorded yet for Level {selectedLevelView}.</div>
                :timeCloudData.levels[selectedLevelView].map((entry,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,background:i===0?"rgba(96,165,250,0.12)":"rgba(255,255,255,0.03)",border:i===0?"1px solid rgba(96,165,250,0.35)":"1px solid rgba(255,255,255,0.06)",borderRadius:9,padding:`${ipadMenu(7)}px ${ipadMenu(10)}px`,marginBottom:5}}><div style={{fontSize:ipadMenu(16),minWidth:ipadMenu(24),textAlign:"center"}}>{medalFor(i)}</div><div style={{flex:1}}><div style={{fontSize:ipadMenu(12),fontWeight:"bold",color:"#f5f0e8"}}>{entry.name}</div>{entry.date&&<div style={{fontSize:ipadMenu(8),color:"rgba(255,255,255,0.75)"}}>{entry.date}</div>}</div><div style={{fontSize:ipadMenu(15),fontWeight:"bold",color:"#60a5fa",fontFamily:"monospace"}}>{formatTime(entry.seconds)}</div></div>))
              }
              {/* Perfect Day times — top 10, all-time */}
              <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.08)"}}>
                <div style={{textAlign:"center",fontSize:ipadMenu(10),color:"rgba(255,255,255,0.5)",marginBottom:8,letterSpacing:1}}>🌈🏆 FASTEST PERFECT DAYS · ALL-TIME</div>
                {!timeCloudData.perfect?.length
                  ?<div style={{textAlign:"center",color:"rgba(255,255,255,0.3)",fontSize:ipadMenu(11),fontStyle:"italic",padding:ipadMenu(12)}}>No Perfect Day times recorded yet.</div>
                  :timeCloudData.perfect.map((entry,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,background:i===0?"linear-gradient(135deg,rgba(246,211,101,0.12),rgba(253,160,133,0.07))":"rgba(255,255,255,0.02)",border:i===0?"1px solid rgba(246,211,101,0.3)":"1px solid rgba(255,255,255,0.06)",borderRadius:9,padding:`${ipadMenu(7)}px ${ipadMenu(10)}px`,marginBottom:4}}><div style={{fontSize:ipadMenu(16),minWidth:ipadMenu(24),textAlign:"center"}}>{medalFor(i)}</div><div style={{flex:1}}><div style={{fontSize:ipadMenu(12),fontWeight:"bold",color:"#f5f0e8"}}>{entry.name} 🌈🏆</div>{entry.date&&<div style={{fontSize:ipadMenu(8),color:"rgba(255,255,255,0.75)"}}>{entry.date}</div>}</div><div style={{fontSize:ipadMenu(15),fontWeight:"bold",color:"#f6d365",fontFamily:"monospace"}}>{formatTime(entry.seconds)}</div></div>))
                }
              </div>
            </div>)}
          </>)}

          {leaderboardTab!=="times"&&leaderboardLoading&&<div style={{textAlign:"center",padding:ipadMenu(30),color:"rgba(255,255,255,0.4)",fontSize:ipadMenu(12)}}>Loading leaderboard…</div>}
          {leaderboardTab!=="times"&&!leaderboardLoading&&!leaderboardData&&<div style={{textAlign:"center",padding:ipadMenu(30),color:"rgba(255,255,255,0.3)",fontSize:ipadMenu(11),fontStyle:"italic"}}>Could not load leaderboard. Check your connection.</div>}

          {leaderboardTab!=="times"&&!leaderboardLoading&&leaderboardData&&(()=>{
            const { gs=[], todaySessions=[], weekSessions=[], wotdAllSessions=[], allWordSessions=[], ffWords=[] } = leaderboardData;
            const medal = (i) => i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`;
            const isMe = (name) => name === playerName;
            const rowStyle = (name, i) => ({
              display:"flex", alignItems:"center", gap:8,
              background: isMe(name)?"rgba(34,211,238,0.1)":i===0?"rgba(246,211,101,0.08)":"rgba(255,255,255,0.03)",
              border: isMe(name)?"1px solid rgba(34,211,238,0.4)":i===0?"1px solid rgba(246,211,101,0.25)":"1px solid rgba(255,255,255,0.06)",
              borderRadius:10, padding:`${ipadMenu(8)}px ${ipadMenu(10)}px`, marginBottom:5
            });

            // Build today/week best scores per player
            // Build maps by player_id from actual session data
            const todayBestById = {};
            const todayPerfectById = {};
            const todayLongestById = {};
            const todayWotdById = {};
            todaySessions.forEach(s=>{
              if(!todayBestById[s.player_id]||s.total_score>todayBestById[s.player_id]) todayBestById[s.player_id]=s.total_score;
              if(s.perfect_day) todayPerfectById[s.player_id]=true;
              if(s.longest_word_today&&(!todayLongestById[s.player_id]||s.longest_word_today.length>todayLongestById[s.player_id].length)) todayLongestById[s.player_id]={word:s.longest_word_today,length:s.longest_word_today.length};
              if(s.wotd_found) todayWotdById[s.player_id]=true;
            });
            const weekBestById = {};
            const weekPerfectById = {};
            const weekWotdById = {};
            weekSessions.forEach(s=>{
              if(!weekBestById[s.player_id]||s.total_score>weekBestById[s.player_id]) weekBestById[s.player_id]=s.total_score;
              if(s.perfect_day) weekPerfectById[s.player_id]=(weekPerfectById[s.player_id]||0)+1;
              if(s.wotd_found) weekWotdById[s.player_id]=(weekWotdById[s.player_id]||0)+1;
            });
            // ── All-time WoD aggregation ──
            const wotdAllById = {};
            const wotdDatesById = {};
            wotdAllSessions.forEach(s=>{
              if(s.wotd_found) {
                wotdAllById[s.player_id]=(wotdAllById[s.player_id]||0)+1;
                if(!wotdDatesById[s.player_id]) wotdDatesById[s.player_id]=[];
                wotdDatesById[s.player_id].push(s.date_key);
              }
            });
            // Compute current WoD streaks (consecutive days finding WoD up to today)
            const wotdStreakById = {};
            Object.keys(wotdDatesById).forEach(pid => {
              const dates = wotdDatesById[pid].sort();
              let streak = 0;
              const today = new Date(); today.setHours(0,0,0,0);
              for (let i = 0; i < 365; i++) {
                const d = new Date(today); d.setDate(d.getDate() - i);
                const key = d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
                if (dates.includes(key)) streak++;
                else if (i > 0) break;
              }
              wotdStreakById[pid] = streak;
            });

            const empty = <div style={{textAlign:"center",padding:ipadMenu(20),color:"rgba(255,255,255,0.3)",fontSize:ipadMenu(11),fontStyle:"italic"}}>No data yet for this period</div>;

            // ── Helper to render a ranked list ──
            const renderRows = (rows) => (
              <div>
                {rows.map((r,i)=>(
                  <div key={i} style={rowStyle(r.name,i)}>
                    <div style={{fontSize:ipadMenu(16),minWidth:ipadMenu(24),textAlign:"center"}}>{medal(i)}</div>
                    <div style={{flex:1}}>
                      {r.word
                        ? <><div style={{fontSize:ipadMenu(13),fontWeight:"bold",color:r.wordColor||"#f093fb",letterSpacing:2}}>{r.word}</div>
                            <div style={{fontSize:ipadMenu(9),color:isMe(r.name)?"#22d3ee":"rgba(255,255,255,0.4)",marginTop:1}}>{r.name||"Guest"}{isMe(r.name)&&" ← you"}{r.date&&<span style={{fontSize:ipadMenu(11),color:"rgba(255,255,255,0.75)",marginLeft:6}}>· {formatDateKey(r.date)}</span>}{r.level&&<span style={{fontSize:ipadMenu(11),color:"rgba(255,255,255,0.75)",marginLeft:6}}>· L{r.level}</span>}</div></>
                        : <><span style={{fontSize:ipadMenu(12),fontWeight:"bold",color:isMe(r.name)?"#22d3ee":"#f5f0e8"}}>{r.name||"Guest"}</span>
                            {isMe(r.name)&&<span style={{fontSize:ipadMenu(9),color:"#22d3ee",marginLeft:4}}>← you</span>}
                            {r.sub&&<div style={{fontSize:ipadMenu(9),color:"#fda085",marginTop:1}}>{r.sub}</div>}</>
                      }
                    </div>
                    <div style={{textAlign:"right"}}>
                      <span style={{fontSize:ipadMenu(15),fontWeight:"bold",color:r.valColor||"#f6d365"}}>{r.val}</span>
                      {r.suffix&&<span style={{fontSize:ipadMenu(12),color:"rgba(255,255,255,0.8)",marginLeft:3}}>{r.suffix}</span>}
                    </div>
                  </div>
                ))}
              </div>
            );

            // ── Your Best panel (period-aware: shows YOUR best for the active period) ──
            const myData = gs.find(g=>g.player_name===playerName);
            const myId = myData?.player_id;
            const todayKey = (()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();})();
            const weekAgoKey = (()=>{const d=new Date(Date.now()-7*86400000);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();})();
            // Compute period-scoped values for the YOU panel
            let periodLabel = "All-Time";
            let myBestScore = 0;
            let myLongestWord = "";
            let myBestWord = "";
            let myBestWordScore = 0;
            let myPerfectDays = 0;
            if (leaderboardPeriod === "alltime") {
              periodLabel = "All-Time";
              myBestScore = myData?.lifetime_points || 0;
              myLongestWord = myData?.stats?.longestWordAllTime || "";
              myBestWord = myData?.stats?.highWordAllTimeWord || "";
              myBestWordScore = myData?.stats?.highWordAllTime || 0;
              myPerfectDays = myData?.stats?.perfectDaysAllTime || 0;
            } else if (leaderboardPeriod === "daily") {
              periodLabel = "Today";
              const myToday = todaySessions.find(s => s.player_id === myId);
              myBestScore = myToday?.total_score || 0;
              const myTodayWord = allWordSessions.find(s => s.player_id === myId && s.date_key === todayKey);
              myLongestWord = myTodayWord?.longest_word_today || "";
              myBestWord = myTodayWord?.top_word || "";
              myBestWordScore = myTodayWord?.top_word_score || 0;
              myPerfectDays = (myToday?.perfect_day) ? 1 : 0;
            } else if (leaderboardPeriod === "weekly") {
              periodLabel = "This Week";
              // best scoring session this week
              const myWeekSessions = weekSessions.filter(s => s.player_id === myId);
              myBestScore = myWeekSessions.reduce((m,s)=>Math.max(m, s.total_score||0), 0);
              const myWeekWordSessions = allWordSessions.filter(s => s.player_id === myId && dateKeyToNum(s.date_key) >= dateKeyToNum(weekAgoKey));
              myLongestWord = myWeekWordSessions.reduce((b,s)=>!b||(s.longest_word_today?.length||0)>(b.length||0)?s.longest_word_today:b, "");
              const myBestWordEntry = myWeekWordSessions.reduce((b,s)=>!b||(s.top_word_score||0)>(b.top_word_score||0)?s:b, null);
              myBestWord = myBestWordEntry?.top_word || "";
              myBestWordScore = myBestWordEntry?.top_word_score || 0;
              myPerfectDays = myWeekSessions.filter(s => s.perfect_day === true).length;
            }
            const yourBest = !isGuest && myData ? (
              <div style={{marginTop:12,background:"rgba(167,139,250,0.1)",border:"1.5px solid rgba(167,139,250,0.4)",borderRadius:12,padding:`${ipadMenu(10)}px ${ipadMenu(10)}px`}}>
                <div style={{fontSize:ipadMenu(10),color:"#a78bfa",fontWeight:"bold",letterSpacing:2,textAlign:"center",marginBottom:8}}>── YOUR BEST · {periodLabel.toUpperCase()} ──</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  <div style={{background:"rgba(255,255,255,0.05)",borderRadius:8,padding:`${ipadMenu(6)}px ${ipadMenu(8)}px`,minWidth:0}}>
                    <div style={{fontSize:ipadMenu(9),color:"rgba(255,255,255,0.85)",marginBottom:2}}>🏆 Top Score</div>
                    <div style={{fontSize:ipadMenu(13),fontWeight:"bold",color:"#f6d365",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{myBestScore.toLocaleString()}</div>
                    <div style={{fontSize:ipadMenu(8),color:"rgba(255,255,255,0.4)"}}>{leaderboardPeriod==="alltime"?"lifetime pts":"pts"}</div>
                  </div>
                  <div style={{background:"rgba(255,255,255,0.05)",borderRadius:8,padding:`${ipadMenu(6)}px ${ipadMenu(8)}px`,minWidth:0}}>
                    <div style={{fontSize:ipadMenu(9),color:"rgba(255,255,255,0.85)",marginBottom:2}}>📏 Longest</div>
                    <div style={{fontSize:ipadMenu(13),fontWeight:"bold",color:"#a78bfa",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{myLongestWord||"—"}</div>
                    <div style={{fontSize:ipadMenu(8),color:"rgba(255,255,255,0.4)"}}>{myLongestWord?(myLongestWord.length+" letters"):"none yet"}</div>
                  </div>
                  <div style={{background:"rgba(255,255,255,0.05)",borderRadius:8,padding:`${ipadMenu(6)}px ${ipadMenu(8)}px`,minWidth:0}}>
                    <div style={{fontSize:ipadMenu(9),color:"rgba(255,255,255,0.85)",marginBottom:2}}>💎 Best Scoring Word</div>
                    <div style={{fontSize:ipadMenu(13),fontWeight:"bold",color:"#f093fb",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{myBestWord||"—"}</div>
                    <div style={{fontSize:ipadMenu(8),color:"rgba(255,255,255,0.4)"}}>{myBestWordScore?(myBestWordScore+" pts"):"none yet"}</div>
                  </div>
                  <div style={{background:"rgba(255,255,255,0.05)",borderRadius:8,padding:`${ipadMenu(6)}px ${ipadMenu(8)}px`,minWidth:0}}>
                    <div style={{fontSize:ipadMenu(9),color:"rgba(255,255,255,0.85)",marginBottom:2}}>🌈🏆 Perfect</div>
                    <div style={{fontSize:ipadMenu(13),fontWeight:"bold",color:"#6ee7b7"}}>{myPerfectDays}</div>
                    <div style={{fontSize:ipadMenu(8),color:"rgba(255,255,255,0.4)"}}>{leaderboardPeriod==="alltime"?"all-time":leaderboardPeriod==="weekly"?"this week":"today"}</div>
                  </div>
                </div>
              </div>
            ) : null;

            // ── SCORES — multiple entries per player ──
            if (leaderboardTab==="scores") {
              let rows = [];
              if (leaderboardPeriod==="alltime") {
                // Collect all sessions scored + lifetime, allow multiple per player
                const allScores = [];
                gs.forEach(g => {
                  if (g.lifetime_points > 0) allScores.push({name:g.player_name, val:(g.lifetime_points||0).toLocaleString(), suffix:"pts", raw:g.lifetime_points||0});
                });
                rows = allScores.sort((a,b)=>b.raw-a.raw).slice(0,10);
              }
              if (leaderboardPeriod==="daily") {
                const allScores = [];
                todaySessions.forEach(s => {
                  const g = gs.find(x=>x.player_id===s.player_id);
                  if (s.total_score > 0) allScores.push({name:g?.player_name||"Guest", val:(s.total_score||0).toLocaleString(), suffix:"pts", raw:s.total_score||0});
                });
                rows = allScores.sort((a,b)=>b.raw-a.raw).slice(0,10);
              }
              if (leaderboardPeriod==="weekly") {
                const allScores = [];
                weekSessions.forEach(s => {
                  const g = gs.find(x=>x.player_id===s.player_id);
                  if (s.total_score > 0) allScores.push({name:g?.player_name||"Guest", val:(s.total_score||0).toLocaleString(), suffix:"pts", raw:s.total_score||0});
                });
                rows = allScores.sort((a,b)=>b.raw-a.raw).slice(0,10);
              }
              if (!rows.length) return <div>{empty}{yourBest}</div>;
              return <div>{renderRows(rows)}{yourBest}</div>;
            }

            // Build a player_id → name map (used for words/longest multi-entry leaderboards)
            const playerNameMap = {};
            gs.forEach(g => { if (g.player_id) playerNameMap[g.player_id] = g.player_name || 'Guest'; });

            // ── BEST WORD SCORES ──
            // Multi-entry: each daily session contributes one entry; same player can appear multiple times
            if (leaderboardTab==="words") {
              let rows = [];
              const todayKey = (()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();})();
              const weekAgoKey = (()=>{const d=new Date(Date.now()-7*86400000);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();})();
              if (leaderboardPeriod==="alltime") {
                rows = allWordSessions
                  .filter(s=>s.top_word && s.top_word_score>0)
                  .map(s=>({ name: playerNameMap[s.player_id] || 'Guest', word: s.top_word, score: s.top_word_score, date: s.date_key }))
                  .sort((a,b)=>b.score-a.score)
                  .slice(0,25)
                  .map(s=>({name:s.name, word:s.word, date:s.date, wordColor:"#f093fb", val:s.score+" pts", valColor:"#f6d365"}));
              }
              if (leaderboardPeriod==="daily") {
                rows = allWordSessions
                  .filter(s=>s.top_word && s.top_word_score>0 && s.date_key===todayKey)
                  .map(s=>({ name: playerNameMap[s.player_id] || 'Guest', word: s.top_word, score: s.top_word_score, date: s.date_key }))
                  .sort((a,b)=>b.score-a.score)
                  .slice(0,25)
                  .map(s=>({name:s.name, word:s.word, date:s.date, wordColor:"#f093fb", val:s.score+" pts", valColor:"#f6d365"}));
              }
              if (leaderboardPeriod==="weekly") {
                const weekAgoNum = dateKeyToNum(weekAgoKey);
                rows = allWordSessions
                  .filter(s=>s.top_word && s.top_word_score>0 && dateKeyToNum(s.date_key)>=weekAgoNum)
                  .map(s=>({ name: playerNameMap[s.player_id] || 'Guest', word: s.top_word, score: s.top_word_score, date: s.date_key }))
                  .sort((a,b)=>b.score-a.score)
                  .slice(0,25)
                  .map(s=>({name:s.name, word:s.word, date:s.date, wordColor:"#f093fb", val:s.score+" pts", valColor:"#f6d365"}));
              }
              if (!rows.length) return <div>{empty}{yourBest}</div>;
              return <div>{renderRows(rows)}{yourBest}</div>;
            }

            // ── LONGEST WORDS ──
            // Multi-entry: each daily session contributes one entry; same player can appear multiple times
            if (leaderboardTab==="longest") {
              let rows = [];
              const todayKey = (()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();})();
              const weekAgoKey = (()=>{const d=new Date(Date.now()-7*86400000);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();})();
              if (leaderboardPeriod==="alltime") {
                rows = allWordSessions
                  .filter(s=>s.longest_word_today && s.longest_word_today.length>0)
                  .map(s=>({ name: playerNameMap[s.player_id] || 'Guest', word: s.longest_word_today, len: s.longest_word_today.length, date: s.date_key }))
                  .sort((a,b)=>b.len-a.len || a.word.localeCompare(b.word))
                  .slice(0,25)
                  .map(s=>({name:s.name, word:s.word, date:s.date, wordColor:"#a78bfa", val:s.len, suffix:"ltrs", valColor:"#22d3ee"}));
              }
              if (leaderboardPeriod==="daily") {
                rows = allWordSessions
                  .filter(s=>s.longest_word_today && s.longest_word_today.length>0 && s.date_key===todayKey)
                  .map(s=>({ name: playerNameMap[s.player_id] || 'Guest', word: s.longest_word_today, len: s.longest_word_today.length, date: s.date_key }))
                  .sort((a,b)=>b.len-a.len || a.word.localeCompare(b.word))
                  .slice(0,25)
                  .map(s=>({name:s.name, word:s.word, date:s.date, wordColor:"#a78bfa", val:s.len, suffix:"ltrs", valColor:"#22d3ee"}));
              }
              if (leaderboardPeriod==="weekly") {
                const weekAgoNum = dateKeyToNum(weekAgoKey);
                rows = allWordSessions
                  .filter(s=>s.longest_word_today && s.longest_word_today.length>0 && dateKeyToNum(s.date_key)>=weekAgoNum)
                  .map(s=>({ name: playerNameMap[s.player_id] || 'Guest', word: s.longest_word_today, len: s.longest_word_today.length, date: s.date_key }))
                  .sort((a,b)=>b.len-a.len || a.word.localeCompare(b.word))
                  .slice(0,25)
                  .map(s=>({name:s.name, word:s.word, date:s.date, wordColor:"#a78bfa", val:s.len, suffix:"ltrs", valColor:"#22d3ee"}));
              }
              if (!rows.length) return <div>{empty}{yourBest}</div>;
              return <div>{renderRows(rows)}{yourBest}</div>;
            }

            // ── FLOURISH (v291) — longest board-clearing (Finishing Flourish) words ──
            // Source: ff_words (registered players only; populated from 1.7 onward).
            // Row layout = Longest tab (Ruling C) + level tag. Ties: length desc, created_at asc.
            if (leaderboardTab==="flourish") {
              const ffEmpty = <div style={{textAlign:"center",padding:ipadMenu(20),color:"rgba(255,255,255,0.3)",fontSize:ipadMenu(11),fontStyle:"italic"}}>No Flourishes logged yet — the board fills from 1.7 onward. Registered players only.</div>;
              const weekAgoNum = dateKeyToNum(weekAgoKey);
              const inPeriod = (f) => leaderboardPeriod==="daily" ? f.date_key===todayKey
                              : leaderboardPeriod==="weekly" ? dateKeyToNum(f.date_key)>=weekAgoNum
                              : true;
              const rows = ffWords
                .filter(f=>f.word && f.length>0 && inPeriod(f))
                .sort((a,b)=>b.length-a.length || (a.created_at||"").localeCompare(b.created_at||""))
                .slice(0,25)
                .map(f=>({name: playerNameMap[f.player_id] || 'Guest', word: f.word.toUpperCase(), date: f.date_key, level: f.level, wordColor:"#a78bfa", val:f.length, suffix:"ltrs", valColor:"#22d3ee"}));
              if (!rows.length) return <div>{ffEmpty}{yourBest}</div>;
              return <div>{renderRows(rows)}{yourBest}</div>;
            }

            // ── PERFECT DAYS ──
            if (leaderboardTab==="perfect") {
              let rows = [];
              if (leaderboardPeriod==="alltime") rows = [...gs].filter(g=>g.stats?.perfectDaysAllTime>0).sort((a,b)=>(b.stats?.perfectDaysAllTime||0)-(a.stats?.perfectDaysAllTime||0)).slice(0,10).map(g=>({name:g.player_name,val:g.stats.perfectDaysAllTime,suffix:"days",valColor:"#6ee7b7"}));
              if (leaderboardPeriod==="daily") rows = [...gs].filter(g=>todayPerfectById[g.player_id]).map(g=>({name:g.player_name,val:"🌈🏆",valColor:"#6ee7b7"})).slice(0,10);
              if (leaderboardPeriod==="weekly") rows = [...gs].filter(g=>weekPerfectById[g.player_id]>0).sort((a,b)=>(weekPerfectById[b.player_id]||0)-(weekPerfectById[a.player_id]||0)).slice(0,10).map(g=>({name:g.player_name,val:weekPerfectById[g.player_id],suffix:"days",valColor:"#6ee7b7"}));
              if (!rows.length) return <div>{empty}{yourBest}</div>;
              return <div>{renderRows(rows)}{yourBest}</div>;
            }

            // ── STREAKS — ALL-TIME ONLY ──
            if (leaderboardTab==="streaks") {
              const rows = [...gs].sort((a,b)=>(b.longest_streak||0)-(a.longest_streak||0)).slice(0,10).map(g=>({
                name:g.player_name,
                val:"🔥 "+( g.longest_streak||0)+"d",
                valColor:"#fda085",
                sub:g.current_streak>0?"🔥 On "+g.current_streak+"d streak":null
              }));
              if (!rows.length) return <div>{empty}{yourBest}</div>;
              return (
                <div>
                  <div style={{textAlign:"center",fontSize:ipadMenu(10),color:"rgba(255,255,255,0.4)",marginBottom:8,letterSpacing:1}}>ALL-TIME LONGEST STREAKS</div>
                  {renderRows(rows)}
                  {yourBest}
                </div>
              );
            }
          })()}

          <div style={{marginTop:10,display:"flex",gap:8}}>
            <button className="ll-btn" onClick={()=>{ if(leaderboardTab==="times"){ setTimeCloudData(null); setTimeCloudLoading(true); fetchTimeLeaderboard().then(d=>{ setTimeCloudData(d); setTimeCloudLoading(false); }); } else { setLeaderboardData(null); setLeaderboardLoading(true); fetchLeaderboard().then(d=>{ setLeaderboardData(d); setLeaderboardLoading(false); }); } }} style={{flex:1,padding:ipadMenu(7),borderRadius:12,background:"rgba(167,139,250,0.2)",border:"1px solid rgba(167,139,250,0.7)",color:"#c4b5fd",fontSize:ipadMenu(10),fontWeight:"bold"}}>↺ Refresh</button>
            <button className="ll-btn" onClick={()=>{ if(leaderboardFromPerfectDay){ setLeaderboardFromPerfectDay(false); setPerfectDayAchieved(true); setTab("play"); } else { setTab("menu"); } }} style={{flex:2,padding:ipadMenu(10),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadMenu(12),fontWeight:"bold",border:"none"}}>{leaderboardFromPerfectDay?"🌈 Back to Perfect Day":"← Back to Menu"}</button>
          </div>
        </div>
      )}

      {/* ── SPECIAL FEATURES TAB (v210) ── dedicated Menu page (B1). Mirrors the Tips page pattern.
          Content matches the walkthrough Special Features scene + the What's New screens. */}
      {tab==="features"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:ipadW(480),padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          <div style={{background:"linear-gradient(135deg,rgba(246,211,101,0.18),rgba(253,160,133,0.12))",borderRadius:16,padding:`${ipadMenu(18)}px ${ipadMenu(16)}px`,marginBottom:12,border:"2px solid rgba(246,211,101,0.5)",textAlign:"center"}}>
            <div style={{fontSize:ipadMenu(30),marginBottom:4}}>🏴‍☠️</div>
            <div style={{fontSize:ipadMenu(17),fontWeight:"bold",color:"#f6d365",letterSpacing:2,marginBottom:4}}>SPECIAL FEATURES</div>
            <div style={{fontSize:ipadMenu(11),color:"rgba(255,255,255,0.9)"}}>The extras that make LetterLoot shine</div>
          </div>
          <button className="ll-btn" onClick={()=>setTab("menu")} style={{width:"100%",padding:ipadMenu(10),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadMenu(13),fontWeight:"bold",border:"none",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            ← Back to Menu
          </button>

          <div style={{background:"rgba(110,231,183,0.1)",border:"1px solid rgba(110,231,183,0.35)",borderRadius:13,padding:`${ipadMenu(14)}px ${ipadMenu(16)}px`,marginBottom:8,display:"flex",gap:13,alignItems:"flex-start"}}>
            <div style={{fontSize:ipadMenu(26),flexShrink:0,marginTop:1,minWidth:ipadMenu(32),textAlign:"center"}}>✨</div>
            <div style={{flex:1}}>
              <div style={{fontSize:ipadMenu(13),fontWeight:"bold",marginBottom:5,color:"#6ee7b7"}}>Loot Letters</div>
              <div style={{fontSize:ipadMenu(12),color:"rgba(255,255,255,0.95)",lineHeight:1.65}}>Every level hides one Loot Letter — a single tile worth 5× its normal value. We'll tell you which letter it is, but not which tile holds it. Use it in a word to pocket the bonus.</div>
            </div>
          </div>

          {/* v300: Word of the Day card — Malleable WoD rule (1.8). */}
          <div style={{background:"rgba(167,139,250,0.12)",border:"1px solid rgba(167,139,250,0.4)",borderRadius:13,padding:`${ipadMenu(14)}px ${ipadMenu(16)}px`,marginBottom:8,display:"flex",gap:13,alignItems:"flex-start"}}>
            <div style={{fontSize:ipadMenu(26),flexShrink:0,marginTop:1,minWidth:ipadMenu(32),textAlign:"center"}}>🎯</div>
            <div style={{flex:1}}>
              <div style={{fontSize:ipadMenu(13),fontWeight:"bold",marginBottom:5,color:"#a78bfa"}}>Word of the Day</div>
              <div style={{fontSize:ipadMenu(12),color:"rgba(255,255,255,0.95)",lineHeight:1.65}}>Each day names one word to hunt — and it's a root minimum: spell it OR any longer word containing it (SURPRISED counts SURPRISING, UNSURPRISING…). Worth 1,000 pts, plus 200 pts for every letter beyond the listed word. Once per day, and it's required for a Perfect Day.</div>
            </div>
          </div>

          <div style={{background:"rgba(246,211,101,0.12)",border:"1px solid rgba(246,211,101,0.45)",borderRadius:13,padding:`${ipadMenu(14)}px ${ipadMenu(16)}px`,marginBottom:8,display:"flex",gap:13,alignItems:"flex-start"}}>
            <div style={{fontSize:ipadMenu(26),flexShrink:0,marginTop:1,minWidth:ipadMenu(32),textAlign:"center"}}>🦜</div>
            <div style={{flex:1}}>
              <div style={{fontSize:ipadMenu(13),fontWeight:"bold",marginBottom:5,color:"#ff4444"}}>Finishing Flourish Bonus</div>
              <div style={{fontSize:ipadMenu(12),color:"rgba(255,255,255,0.95)",lineHeight:1.65}}>Use a 5+ letter word as your final, board-clearing word to pocket a Finishing Flourish Bonus — treasure that grows with every extra letter. The longer that finishing word, the bigger the haul!</div>
            </div>
          </div>

          <div style={{background:"rgba(124,196,255,0.1)",border:"1px solid rgba(124,196,255,0.35)",borderRadius:13,padding:`${ipadMenu(14)}px ${ipadMenu(16)}px`,marginBottom:8,display:"flex",gap:13,alignItems:"flex-start"}}>
            <div style={{fontSize:ipadMenu(26),flexShrink:0,marginTop:1,minWidth:ipadMenu(32),textAlign:"center"}}>⚠️</div>
            <div style={{flex:1}}>
              <div style={{fontSize:ipadMenu(13),fontWeight:"bold",marginBottom:5,color:"#7cc4ff"}}>Vowel / Consonant Alert</div>
              <div style={{fontSize:ipadMenu(12),color:"rgba(255,255,255,0.95)",lineHeight:1.65}}>When your remaining letters tip into a risky vowel-to-consonant balance, the Vowels and Consonants boxes pulse — a heads-up to adjust your strategy before you strand yourself.</div>
            </div>
          </div>

          <div style={{background:"rgba(167,139,250,0.12)",border:"1px solid rgba(167,139,250,0.4)",borderRadius:13,padding:`${ipadMenu(14)}px ${ipadMenu(16)}px`,marginBottom:8,display:"flex",gap:13,alignItems:"flex-start"}}>
            <div style={{fontSize:ipadMenu(26),flexShrink:0,marginTop:1,minWidth:ipadMenu(32),textAlign:"center"}}>🏴‍☠️</div>
            <div style={{flex:1}}>
              <div style={{fontSize:ipadMenu(13),fontWeight:"bold",marginBottom:5,color:"#c4b5fd"}}>Pirate Celebrations</div>
              <div style={{fontSize:ipadMenu(12),color:"rgba(255,255,255,0.95)",lineHeight:1.65}}>Our pirate crew cheers your big moments — clearing a level, a great word, a Perfect Day. Want them on or off? Toggle <strong style={{color:"#c4b5fd"}}>Show Mascot Celebrations</strong> on the "Ready?" screen before each game begins.</div>
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

          <div style={{textAlign:"center",marginBottom:16,marginTop:4}}>
            <button className="ll-btn" onClick={()=>setTab("menu")} style={{padding:`${ipadMenu(11)}px ${ipadMenu(28)}px`,borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadMenu(13),fontWeight:"bold",letterSpacing:1}}>
              ← Back to Menu
            </button>
          </div>
        </div>
      )}

            {/* ── INFO / TIPS TAB ── item 10 */}
      {tab==="info"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:ipadW(480),padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          {/* Header card */}
          <div style={{background:"linear-gradient(135deg,rgba(139,92,246,0.2),rgba(96,165,250,0.15))",borderRadius:16,padding:`${ipadMenu(18)}px ${ipadMenu(16)}px`,marginBottom:12,border:"2px solid rgba(167,139,250,0.45)",textAlign:"center"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:8}}><PencilLogo size={ipadIcon(100)}/></div>
            <div style={{fontSize:ipadMenu(17),fontWeight:"bold",color:"#a78bfa",letterSpacing:3,marginBottom:4}}>HINTS & TIPS</div>
            <div style={{fontSize:ipadMenu(11),color:"rgba(255,255,255,0.9)"}}>Play smarter · Loot harder</div>
          </div>
          <button className="ll-btn" onClick={()=>setTab("menu")} style={{width:"100%",padding:ipadMenu(10),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadMenu(13),fontWeight:"bold",border:"none",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            ← Back to Menu
          </button>


          {/* Tip cards */}
          {TIPS.map((tip, i) => (
            <div key={i} style={{
              background: i === TIPS.length - 1
                ? "linear-gradient(135deg,rgba(0,200,83,0.12),rgba(0,230,118,0.07))"
                : "rgba(255,255,255,0.05)",
              border: i === TIPS.length - 1
                ? "1px solid rgba(0,200,83,0.35)"
                : "1px solid rgba(255,255,255,0.12)",
              borderRadius:13, padding:`${ipadMenu(14)}px ${ipadMenu(16)}px`, marginBottom:8,
              display:"flex", gap:13, alignItems:"flex-start"
            }}>
              <div style={{fontSize:ipadMenu(26),flexShrink:0,marginTop:1,minWidth:ipadMenu(32),textAlign:"center"}}>{tip.emoji}</div>
              <div style={{flex:1}}>
                <div style={{
                  fontSize:ipadMenu(13), fontWeight:"bold", marginBottom:5,
                  color: i === TIPS.length - 1 ? "#6ee7b7" : "#f6d365"
                }}>{tip.title}</div>
                <div style={{fontSize:ipadMenu(12),color:"rgba(255,255,255,0.95)",lineHeight:1.65}}>{tip.body}</div>
              </div>
            </div>
          ))}

          <div style={{textAlign:"center",marginBottom:16,marginTop:4}}>
            <button className="ll-btn" onClick={()=>setTab("menu")} style={{padding:`${ipadMenu(11)}px ${ipadMenu(28)}px`,borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadMenu(13),fontWeight:"bold",letterSpacing:1}}>
              ← Back to Menu
            </button>
          </div>
        </div>
      )}

      {/* ── BONUS LEVEL UNLOCK MODAL (dormant when ENABLE_BONUS_LEVELS=false) ── */}
      {ENABLE_BONUS_LEVELS && showBonusUnlock && (
        <div style={{position:"fixed",inset:0,zIndex:9600,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"linear-gradient(135deg,#1a0a2e,#2d1b4a)",borderRadius:28,padding:"36px 28px",textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:"2px solid rgba(255,215,0,0.8)",maxWidth:340,width:"90%"}}>
            <div style={{fontSize:56}}>🏛️</div>
            <div style={{fontSize:24,fontWeight:"bold",marginTop:10,color:"#f6d365",letterSpacing:2}}>THE VAULT UNLOCKED!</div>
            <div style={{fontSize:14,color:"#f5f0e8",marginTop:12,lineHeight:1.7}}>
              You've achieved <span style={{color:"#f6d365",fontWeight:"bold"}}>{BONUS_CONSECUTIVE_REQUIRED} consecutive Perfect Days</span>!<br/><br/>
              Level 6 — <em>The Vault</em> — is now available.<br/>
              All letter values are <span style={{color:"#fda085",fontWeight:"bold"}}>1.5×</span> — but the stakes are higher.<br/><br/>
              <span style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>⚠️ Retrying or buying on a bonus level breaks your Perfect Day streak.</span>
            </div>
            <div style={{marginTop:16,background:"rgba(255,215,0,0.1)",borderRadius:12,padding:"10px",border:"1px solid rgba(255,215,0,0.3)"}}>
              <div style={{fontSize:11,color:"#f6d365"}}>🏛️ The Vault · 💫 The Sanctum · 🏔️ The Summit</div>
              <div style={{fontSize:11,color:"#f6d365",marginTop:4}}>🌌 The Cosmos · ∞ Infinity</div>
            </div>
            <button className="ll-btn" onClick={()=>setShowBonusUnlock(false)} style={{marginTop:20,width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:14,fontWeight:"bold"}}>
              Let's Enter The Vault! 🏛️
            </button>
          </div>
        </div>
      )}

      {/* ── BONUS LEVEL PROGRESS INDICATOR (dormant when ENABLE_BONUS_LEVELS=false) ── */}
      {ENABLE_BONUS_LEVELS && !bonusLevelUnlocked && consecutivePerfect > 0 && (
        <div style={{position:"fixed",bottom:80,right:12,zIndex:100,background:"rgba(246,211,101,0.15)",border:"1px solid rgba(246,211,101,0.4)",borderRadius:12,padding:"6px 10px",fontSize:10,color:"#f6d365",fontFamily:"Georgia,serif"}}>
          🏛️ {consecutivePerfect}/{BONUS_CONSECUTIVE_REQUIRED} Perfect Days
        </div>
      )}

      {/* ── BONUS LEVEL UNSUCCESSFUL (1st failure — retry available) ── */}
      {ENABLE_BONUS_LEVELS && showBonusUnsuccessful && (
        <div style={{position:"fixed",inset:0,zIndex:9600,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"linear-gradient(135deg,#1a0a2e,#2d1b4a)",borderRadius:28,padding:"32px 28px",textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:"2px solid rgba(246,211,101,0.5)",maxWidth:340,width:"90%"}}>
            <div style={{fontSize:48}}>{BONUS_LEVEL_EMOJIS[level]||"🏛️"}</div>
            <div style={{fontSize:20,fontWeight:"bold",color:"#f6d365",marginTop:10}}>{BONUS_LEVEL_NAMES[level]||"The Vault"}</div>
            <div style={{fontSize:14,color:"#f5f0e8",marginTop:12,lineHeight:1.8}}>
              The {BONUS_LEVEL_NAMES[level]||"Vault"} was tough today — but you gave it everything!<br/><br/>
              You have <span style={{color:"#6ee7b7",fontWeight:"bold"}}>1 retry</span> remaining for this level.
            </div>
            <div style={{marginTop:12,background:"rgba(255,255,255,0.06)",borderRadius:12,padding:"10px",fontSize:11,color:"rgba(255,255,255,0.55)",lineHeight:1.7}}>
              💡 If this attempt is also unsuccessful, you'll need to earn your way back via 3 consecutive Perfect Days.
            </div>
            <button className="ll-btn" onClick={()=>{ setShowBonusUnsuccessful(false); doLevelReset(); }} style={{marginTop:18,width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:14,fontWeight:"bold"}}>
              🔄 Use My Retry
            </button>
            <button className="ll-btn" onClick={()=>{ setShowBonusUnsuccessful(false); setShowBonusRestart(true); }} style={{marginTop:8,width:"100%",padding:"11px",borderRadius:12,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.6)",fontSize:12}}>
              I'm done for today
            </button>
          </div>
        </div>
      )}

      {/* ── BONUS LEVEL RESTART? (2nd failure or chose done) ── */}
      {ENABLE_BONUS_LEVELS && showBonusRestart && !bonusRestartChoice && (
        <div style={{position:"fixed",inset:0,zIndex:9600,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"linear-gradient(135deg,#1a0a2e,#2d1b4a)",borderRadius:28,padding:"32px 28px",textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:"2px solid rgba(167,139,250,0.5)",maxWidth:340,width:"90%"}}>
            <div style={{fontSize:48}}>💪</div>
            <div style={{fontSize:20,fontWeight:"bold",color:"#a78bfa",marginTop:10}}>Restart Game?</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",marginTop:10,lineHeight:1.7}}>
              You'll need to earn your way back to {BONUS_LEVEL_NAMES[level]||"The Vault"} via <span style={{color:"#f6d365",fontWeight:"bold"}}>3 consecutive Perfect Days</span>.
            </div>
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button className="ll-btn" onClick={()=>setBonusRestartChoice("yes")} style={{flex:1,padding:"13px",borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:14,fontWeight:"bold",border:"none"}}>Yes</button>
              <button className="ll-btn" onClick={()=>{ setShowBonusNo(true); setShowBonusRestart(false); }} style={{flex:1,padding:"13px",borderRadius:14,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.3)",color:"#f5f0e8",fontSize:14,fontWeight:"bold"}}>No</button>
            </div>
          </div>
        </div>
      )}

      {/* ── BONUS RESTART YES — Welcome screen with inspirational message ── */}
      {ENABLE_BONUS_LEVELS && showBonusRestart && bonusRestartChoice==="yes" && (
        <div style={{position:"fixed",inset:0,zIndex:9600,background:"linear-gradient(160deg,#0a0820 0%,#1e1a4a 50%,#0f0e28 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:"30px 24px"}}>
          <Starfield/>
          <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:ipadW(360),textAlign:"center"}}>
            <PencilLogo size={ipadIcon(160)}/>
            <div style={{marginTop:14,background:"rgba(139,92,246,0.25)",border:"2.5px solid rgba(167,139,250,0.95)",borderRadius:14,padding:"8px 24px",boxShadow:"0 0 28px rgba(139,92,246,0.5)"}}>
              <span style={{fontSize:26,fontWeight:"bold",letterSpacing:4,color:"#ffffff",textShadow:"0 0 16px rgba(167,139,250,0.85)"}}>LetterLoot</span>
            </div>
            <div style={{marginTop:20,background:"rgba(255,255,255,0.06)",borderRadius:16,padding:"20px",border:"1px solid rgba(167,139,250,0.3)",width:"100%"}}>
              <div style={{fontSize:28,marginBottom:10}}>🌟</div>
              <div style={{fontSize:14,color:"#f5f0e8",lineHeight:1.9,fontStyle:"italic"}}>
                "Every master was once a beginner.<br/>Your Perfect Day streak starts now —<br/>and The Vault will be waiting.<br/><br/>Let's go get it! 🏛️"
              </div>
            </div>
            <div style={{marginTop:20,fontSize:12,color:"rgba(255,255,255,0.55)",marginBottom:12}}>Ready to play again?</div>
            <div style={{display:"flex",flexDirection:"column",gap:8,width:"100%"}}>
              <button className="ll-btn replay-btn" onClick={()=>{ setShowBonusRestart(false); setBonusRestartChoice(null); handleFullReset(); }} style={{width:"100%",padding:"16px",borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:15,fontWeight:"bold",border:"none"}}>✏️ Play Now</button>
              <button className="ll-btn" onClick={()=>{ setBonusRestartChoice("later"); }} style={{width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,rgba(96,165,250,0.3),rgba(59,130,246,0.2))",border:"1px solid rgba(96,165,250,0.6)",color:"#bfdbfe",fontSize:14,fontWeight:"bold"}}>🌅 Maybe Later Today</button>
              <button className="ll-btn" onClick={()=>{ setBonusRestartChoice("tomorrow"); }} style={{width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,rgba(167,139,250,0.3),rgba(124,58,237,0.2))",border:"1px solid rgba(167,139,250,0.6)",color:"#e9d5ff",fontSize:14,fontWeight:"bold"}}>🌙 Tomorrow</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LATER TODAY response ── */}
      {ENABLE_BONUS_LEVELS && showBonusRestart && bonusRestartChoice==="later" && (
        <div style={{position:"fixed",inset:0,zIndex:9600,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"linear-gradient(135deg,#1a0a2e,#2d1b4a)",borderRadius:28,padding:"36px 28px",textAlign:"center",maxWidth:340,width:"90%",border:"1px solid rgba(96,165,250,0.4)"}}>
            <div style={{fontSize:48}}>🌅</div>
            <div style={{fontSize:20,fontWeight:"bold",color:"#bfdbfe",marginTop:10}}>Great! See you later.</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginTop:10,lineHeight:1.7}}>Your Perfect Day journey continues whenever you're ready.</div>
          </div>
        </div>
      )}

      {/* ── TOMORROW response ── */}
      {ENABLE_BONUS_LEVELS && showBonusRestart && bonusRestartChoice==="tomorrow" && (
        <div style={{position:"fixed",inset:0,zIndex:9600,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"linear-gradient(135deg,#1a0a2e,#2d1b4a)",borderRadius:28,padding:"36px 28px",textAlign:"center",maxWidth:340,width:"90%",border:"1px solid rgba(167,139,250,0.4)"}}>
            <div style={{fontSize:48}}>🌙</div>
            <div style={{fontSize:20,fontWeight:"bold",color:"#e9d5ff",marginTop:10}}>New boards. Another Perfect Day awaits!</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginTop:10,lineHeight:1.7}}>Rest up — The Vault will be waiting for you tomorrow. 🏛️</div>
          </div>
        </div>
      )}

      {/* ── BONUS RESTART NO — Beautiful closing message ── */}
      {ENABLE_BONUS_LEVELS && showBonusNo && (
        <div style={{position:"fixed",inset:0,zIndex:9600,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"}}>
          <div style={{background:"linear-gradient(135deg,#1a0a2e,#2d1b4a)",borderRadius:28,padding:"36px 28px",textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:"2px solid rgba(167,139,250,0.5)",maxWidth:340,width:"90%"}}>
            <div style={{fontSize:52}}>🌟</div>
            <div style={{fontSize:20,fontWeight:"bold",color:"#a78bfa",marginTop:10}}>Remarkable Effort.</div>
            <div style={{fontSize:13,color:"#f5f0e8",marginTop:14,lineHeight:1.9,fontStyle:"italic"}}>
              "What you accomplished today took real intelligence, dedication, and vocabulary power.<br/><br/>
              Reaching {BONUS_LEVEL_NAMES[level]||"The Vault"} puts you in rare company.<br/><br/>
              Rest up — I'm confident you'll return and conquer it soon. See you tomorrow! 🏛️"
            </div>
            <div style={{marginTop:20,fontSize:28}}>🌅</div>
          </div>
        </div>
      )}

      {/* ── READY TO PLAY MODAL ── */}
      {showReadyToPlay&&<div style={{position:"fixed",inset:0,zIndex:9800,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:28,padding:`${ipadTour(36)}px ${ipadTour(28)}px`,textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:"2px solid rgba(246,211,101,0.5)",maxWidth:ipadTour(320),width:"90%"}}>
          <div style={{display:"flex",justifyContent:"center"}}><PencilLogo size={ipadTour(72)}/></div>
          <div style={{fontSize:ipadTour(22),fontWeight:"bold",color:"#f6d365",marginTop:10}}>Ready to play?</div>
          <div style={{fontSize:ipadTour(13),color:"rgba(255,255,255,0.9)",marginTop:10,lineHeight:1.7}}>Your timer starts on your first tap!</div>
          <div style={{marginTop:12,background:"rgba(255,255,255,0.06)",borderRadius:12,padding:ipadTour(10),fontSize:ipadTour(12),color:"rgba(255,255,255,0.9)"}}>
            Level 1 · Fresh tiles · Good luck! 🍀
          </div>
          <button className="ll-btn replay-btn" onClick={()=>{ setShowReadyToPlay(false); stopTimer(); setAwaitingFirstTap(true); awaitingFirstTapRef.current = true; fireLevelStartSequence(1); }} style={{marginTop:20,width:"100%",padding:ipadTour(16),borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(16),fontWeight:"bold",border:"none"}}>
            Let's Go! 🎯
          </button>
        </div>
      </div>}

    </div>
  );
}
