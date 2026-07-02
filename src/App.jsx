import { useState, useCallback, useRef, useEffect } from "react";
import { supabase, signUp, signIn, signOut, resetPassword, getSession, loadGameState, saveGameState, loadDailySession, saveDailySession, updatePlayerName, savePlayerPhoto, loadPlayerPhoto } from "./supabase";
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
const DEBUG_MODE = true;

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

// ── iPad responsive width helper (May 21, 2026) ──────────────
// On iPad-sized screens (≥768px wide), bump page-container widths so the
// app fills the screen comfortably instead of looking like a tiny phone
// app marooned in the middle. Modal cards keep their original widths —
// they're meant to feel focused, not stretched.
const isIpadWidth = () => typeof window !== "undefined" && window.innerWidth >= 768;
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
const IPAD_TILE_SCALE_BY_LEVEL = { 1: 2.2, 2: 2.2, 3: 2.0, 4: 1.6, 5: 1.5 };
const IPAD_TILE_WIDTH_SCALE_BY_LEVEL = { 1: 2.2, 2: 2.2, 3: 2.1, 4: 2.15, 5: 2.05 }; // v60: L4 1.9→2.15, L5 1.85→2.05 (bug #13)
// iPhone per-level scaling (added May 24, 2026): L1 had only 4 rows of 7 tiles
// on a big iPhone screen like the 17 Pro Max — tiles felt tiny with empty space
// below. Scale UP on early levels, gradually returning closer to base by L5 where
// the board grows to 10 rows. Curve refined after iPhone 17 Pro Max smoke test
// showed L3-L5 had room to grow comfortably.
const IPHONE_TILE_SCALE_BY_LEVEL = { 1: 1.45, 2: 1.30, 3: 1.20, 4: 1.10, 5: 1.05 };
const ipadTile = (base, level = 1) => {
  if (!isIpadWidth()) {
    // iPhone path: apply per-level iPhone scale
    const phoneScale = IPHONE_TILE_SCALE_BY_LEVEL[level] || 1.00;
    return Math.round(base * phoneScale);
  }
  const scale = IPAD_TILE_SCALE_BY_LEVEL[level] || 1.65; // fallback for any future levels
  return Math.round(base * scale);
};
const ipadTileW = (base, level = 1) => {
  if (!isIpadWidth()) {
    // iPhone path: apply per-level iPhone scale (same curve as height for symmetric tiles)
    const phoneScale = IPHONE_TILE_SCALE_BY_LEVEL[level] || 1.00;
    return Math.round(base * phoneScale);
  }
  const scale = IPAD_TILE_WIDTH_SCALE_BY_LEVEL[level] || 2.05;
  return Math.round(base * scale);
};
const ipadChrome = (base) => isIpadWidth() ? Math.round(base * 1.5) : base;
const ipadIntro = (base) => isIpadWidth() ? Math.round(base * 2.0) : base; // welcome/intro card content
const ipadIntroPad = (base) => isIpadWidth() ? Math.round(base * 2.0) : base; // welcome/intro card padding
// ipadProfile (added v48): Profile Setup screen — 2.0× was overflowing on 11" iPad
// (Save button below the safe area). 1.5× on iPad keeps everything visible while
// still feeling proportional. iPhone unchanged.
const ipadProfile = (base) => isIpadWidth() ? Math.round(base * 1.5) : base;
const ipadProfilePad = (base) => isIpadWidth() ? Math.round(base * 1.5) : base;
const ipadTour = (base) => isIpadWidth() ? Math.round(base * 2.3) : base; // tour scenes - slightly larger than intro
const ipadMenu = (base) => isIpadWidth() ? Math.round(base * 1.75) : base; // menu hub - moderate scale, fits all cards on screen
const ipadDense = (base) => isIpadWidth() ? Math.round(base * 1.6) : base; // dense screens (Stats, Debug Menu) - v60: bumped 1.3→1.6 for readability (bug #15)
const ipadWord = (base) => isIpadWidth() ? Math.round(base * 2.5) : base; // word-being-built row (largest scale)
const ipadIcon = (base) => isIpadWidth() ? Math.round(base * 1.8) : base; // pencil/letterloot icon
const ipadBoardW = () => isIpadWidth() ? 1500 : undefined; // wider tile-board container on iPad
// 360 → 640, 480 → 854 (UI rows). Game board itself goes to 1400px on iPad.
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
    if (tile.isLoot && !tile.lootUsed && !hideLoot) val = tile.value * 5; // Loot Letter: 5x base value (one-time per game)
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
    const shuffled = [...tier].sort(() => rng() - 0.5);
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
function saveCachedWordOfTheDay(word) {
  try { localStorage.setItem("ll_wotd", JSON.stringify({ date: getTodayKey(), word, found: false, version: WOTD_CACHE_VERSION })); } catch {}
}
function markWordOfTheDayFound(level, score) {
  try {
    const cached = getCachedWordOfTheDay();
    if (cached) {
      cached.found = true;
      cached.foundLevel = level;
      cached.foundScore = score;
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
// Kick off load on module init
loadApprovedWords();

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
  if (!navigator.onLine) { wordCache[key] = { valid: false, source: "offline" }; return wordCache[key]; }
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
  // If still timing out, use common words fallback so game stays playable
  if (result.source === "timeout") {
    result = { valid: COMMON_WORDS.has(key), source: "fallback" };
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
  const [cur, setCur] = useState(0);
  const [pulseOn, setPulseOn] = useState(false);
  const pulseRef = useRef(null);

  function startPulse() {
    if (pulseRef.current) clearInterval(pulseRef.current);
    let on = true;
    pulseRef.current = setInterval(() => { on = !on; setPulseOn(on); }, 700);
  }

  useEffect(() => {
    setPulseOn(false);
    if (pulseRef.current) clearInterval(pulseRef.current);
    if (cur !== 1) setTimeout(startPulse, 400);
    return () => { if (pulseRef.current) clearInterval(pulseRef.current); };
  }, [cur]);

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
      content: () => (
        <div style={{textAlign:'center'}}>
          <div style={{display:'flex',justifyContent:'center',marginBottom:ipadTour(14)}}>
            <div style={{background:"rgba(246,211,101,0.15)",border:"2px solid rgba(246,211,101,0.7)",color:"#f6d365",padding:`${ipadTour(10)}px ${ipadTour(28)}px`,borderRadius:12,fontSize:ipadTour(18),fontWeight:"bold",fontFamily:"Georgia,serif",boxShadow: pulseOn ? '0 0 20px 6px rgba(246,211,101,0.85)' : 'none',transform: pulseOn ? 'scale(1.06)' : 'scale(1)',transition:'box-shadow 0.7s ease, transform 0.7s ease'}}>📋 Menu</div>
          </div>
          <div style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:14,padding:ipadTour(14),fontSize:ipadTour(12.5),color:'#f5f0e8',lineHeight:1.85,textAlign:'left',marginBottom:ipadTour(10)}}>
            The <strong style={{color:'#f6d365'}}>📋 Menu</strong> button (under the tile board, next to UNDO) opens your hub. From there you can reach:
            <div style={{marginTop:ipadTour(8),paddingLeft:ipadTour(6),fontSize:ipadTour(12),lineHeight:2}}>
              📜 <strong>History</strong> — every word you've played<br/>
              📊 <strong>Stats</strong> — your scores, streaks, Perfect Days<br/>
              🏅 <strong>Badges</strong> — achievements you've earned<br/>
              🏆 <strong>Leaders</strong> — top players today<br/>
              ℹ️ <strong>Tips</strong> — rules &amp; strategy
            </div>
          </div>
          <div style={{fontSize:ipadTour(10),color:'rgba(255,255,255,0.55)',fontStyle:'italic'}}>
            Each menu page has a ← Back to Menu button. From the menu, ✏️ Back to Game returns to play.
          </div>
        </div>
      )
    },

    {
      title: "📜 History Keeps Everything",
      desc:  "Even the words that didn't count.",
      content: () => (
        <div style={{textAlign:'center'}}>
          <div style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:14,padding:ipadTour(14),fontSize:ipadTour(13),color:'#f5f0e8',lineHeight:1.8,textAlign:'left',marginBottom:ipadTour(10)}}>
            History saves <strong style={{color:'#f6d365'}}>every word you played today</strong> — valid words AND rejected ones.
            <div style={{marginTop:ipadTour(10),padding:`${ipadTour(10)}px ${ipadTour(12)}px`,background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.5)',borderRadius:10}}>
              <div style={{fontSize:ipadTour(11),color:'#c4b5fd',letterSpacing:1.5,fontWeight:'bold',marginBottom:ipadTour(4)}}>📝 REPORT FOR REVIEW</div>
              <div style={{fontSize:ipadTour(12),color:'rgba(255,255,255,0.85)',lineHeight:1.7}}>
                Think a rejected word should count? Tap <strong style={{color:'#f6d365'}}>📝 Report for review</strong> next to it in History. We review every submission and add valid ones to the dictionary.
              </div>
            </div>
          </div>
          <div style={{fontSize:ipadTour(10),color:'rgba(255,255,255,0.55)',fontStyle:'italic'}}>
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
            🎯 Find the Word of the Day<br/>
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

  return (
    <div style={{position:'fixed',inset:0,zIndex:99999,background:'linear-gradient(160deg,#0a0820 0%,#1e1a4a 50%,#0f0e28 100%)',fontFamily:'Georgia,serif',color:'#f5f0e8',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',padding:ipadIntroPad(16),overflowY:'auto'}}>
      <div style={{width:'100%',maxWidth:ipadW(400)}}>
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
            <button className="ll-btn" onClick={()=>cur>0?setCur(c=>c-1):onDone()} style={{flex:1,padding:ipadTour(10),borderRadius:12,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.5)',fontFamily:'Georgia,serif',fontSize:ipadTour(12),cursor:'pointer'}}>
              {cur===0?'Skip':'← Back'}
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
    stats.perfectDaysAllTime += 1;
    stats.perfectDaysWeek[todayKey] = (stats.perfectDaysWeek[todayKey]||0) + 1;
    // Track consecutive perfect days
    if (stats.lastPerfectDate === yesterdayKey) {
      stats.consecutivePerfectDays = (stats.consecutivePerfectDays || 0) + 1;
    } else if (stats.lastPerfectDate === todayKey) {
      // Same day - keep current streak
    } else {
      stats.consecutivePerfectDays = 1;
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
function saveLocalSession(state) { try { localStorage.setItem("ll_session", JSON.stringify({ ...state, savedDate: getTodayKey() })); } catch {} }
function loadLocalSession() {
  try { const data = JSON.parse(localStorage.getItem("ll_session") || "null"); if (!data || data.savedDate !== getTodayKey()) return null; return data; } catch { return null; }
}
function clearLocalSession() { try { localStorage.removeItem("ll_session"); } catch {} }
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

function FarewellScreen({ totalScore, bestWord, bestWordScore, onDone, onViewStats, onViewLeaderboard, onPlayAgain, onShareResults, isGuest }) {
  // v87 (C+): feedback state for the "Share LetterLoot with a friend" copy action.
  const [inviteCopied, setInviteCopied] = useState(false);
  return (
    <div style={{ position:"fixed", inset:0, zIndex:99999, background:"#0a0820", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"30px 24px", fontFamily:"Georgia,serif", color:"#f5f0e8", overflowY:"auto" }}>
      <Starfield/>
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:ipadW(360)}}>
        <div style={{textAlign:"center",marginBottom:20}}><LetterLootLogo titleFontSize={ipadTour(32)} boxPadding={`${ipadTour(10)}px ${ipadTour(28)}px`}/></div>
        <div style={{textAlign:"center",width:"100%"}}>
          <div style={{fontSize:ipadTour(22),fontWeight:"bold",color:"#f6d365",marginBottom:14}}>Great effort today! 🎉</div>
          <div style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:14,padding:ipadIntro(14),marginBottom:16,width:"100%"}}>
            <div style={{fontSize:ipadIntro(11),color:"rgba(255,255,255,0.95)",fontWeight:"bold",letterSpacing:0.5,marginBottom:6}}>Highest scoring word:</div>
            <div style={{fontSize:ipadTour(22),fontWeight:"bold",color:"#a78bfa",letterSpacing:3,marginBottom:4}}>{bestWord||"—"}</div>
            <div style={{fontSize:ipadTour(14),color:"#fda085",fontWeight:"bold",marginBottom:10}}>{bestWordScore||0} points</div>
            <div style={{height:1,background:"rgba(255,255,255,0.12)",marginBottom:10}}/>
            <div style={{fontSize:ipadIntro(11),color:"rgba(255,255,255,0.95)",fontWeight:"bold",letterSpacing:0.5,marginBottom:4}}>Total Score Today</div>
            <div style={{fontSize:ipadTour(30),fontWeight:"bold",color:"#f6d365"}}>{totalScore||0}</div>
          </div>
          <div style={{fontSize:ipadIntro(13),color:"#ffffff",lineHeight:1.6,fontWeight:"bold",marginBottom:14}}>
            Try again? Replay for a higher score, but no Perfect Day chance today.
          </div>
          {/* v64 (May 26): Simplified — Now + Later only. Tomorrow removed. */}
          <div style={{fontSize:ipadIntro(11),color:"rgba(255,255,255,0.95)",fontWeight:"bold",letterSpacing:1.5,marginBottom:6}}>PLAY AGAIN</div>
          <div style={{display:"flex",gap:6,marginBottom:14}}>
            <button onClick={()=>onPlayAgain && onPlayAgain("now")} style={{flex:1,padding:`${ipadChrome(10)}px ${ipadChrome(4)}px`,borderRadius:12,background:"linear-gradient(135deg,#00c853,#00e676)",color:"#003300",fontSize:ipadChrome(12),fontWeight:"bold",border:"none",cursor:"pointer",fontFamily:"Georgia,serif"}}>✏️ Now</button>
            <button onClick={()=>onPlayAgain && onPlayAgain("later")} style={{flex:1,padding:`${ipadChrome(10)}px ${ipadChrome(4)}px`,borderRadius:12,background:"linear-gradient(135deg,rgba(96,165,250,0.35),rgba(59,130,246,0.25))",border:"1px solid rgba(96,165,250,0.7)",color:"#dbeafe",fontSize:ipadChrome(12),fontWeight:"bold",cursor:"pointer",fontFamily:"Georgia,serif"}}>🌅 Later</button>
          </div>
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
  const hasSignedInBefore = !!(localStorage.getItem("ll_name") || localStorage.getItem("ll_session"));
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
      const wordReports = await adminQuery('word_reports', '*', '&order=reported_at.desc&limit=50').catch(()=>[]);
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
          <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',letterSpacing:3,marginBottom:10}}>📝 REPORTED WORDS ({(data?.wordReports||[]).length})</div>
          {!(data?.wordReports?.length)?<div style={{textAlign:'center',color:'rgba(255,255,255,0.25)',fontSize:11,padding:10}}>No words reported yet</div>:
          <table style={tbl}><thead><tr><th style={th}>Word</th><th style={th}>Reported by</th><th style={th}>When</th><th style={th}>Status</th><th style={th}>Action</th></tr></thead><tbody>
            {(data.wordReports||[]).map((r,i)=>(
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
                          loadData();
                        }catch(e){alert('Reject error: '+e.message);}
                      }} style={{padding:'3px 8px',borderRadius:6,border:'1px solid rgba(251,113,133,0.5)',background:'rgba(251,113,133,0.15)',color:'#fda4af',fontSize:10,fontWeight:'bold',cursor:'pointer'}}>✗ Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody></table>}
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
          <div style={headerStyle}>⚙️ State Helpers</div>
          <div style={gridStyle}>
            {btn("🆕 Start Fresh Game", "fresh-game", "#22d3ee")}
            {btn("🏁 Near Game End", "near-end", "#22d3ee")}
            {btn("🗑 Wipe localStorage", "wipe-local", "#fb7185")}
            {btn("📋 Welcome Screen", "go-welcome", "#22d3ee")}
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
        setUser(session.user); setAuthState("playing");
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
        const keysToClear = [
          "ll_guest","ll_guest_returning","ll_stats","ll_lifetime","ll_badges_v2",
          "ll_times","ll_alltime","ll_daily_history","ll_session","ll_completed_today",
          "ll_pd_acknowledged_today","ll_wotd","ll_name","ll_photo","ll_nickname","ll_longest",
          "ll_show_mascots"
        ];
        keysToClear.forEach(k => { try { localStorage.removeItem(k); } catch {} });
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

  if (showAdmin) return withBadge(<AdminScreen onExit={()=>setShowAdmin(false)}/>);
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
  // (v106) Loot Letter announcement: a brief, self-dismissing INFORMATIONAL popup
  // ("💥 Loot Letter · Level N · X") shown at each level open. NOT a celebration —
  // ungated by showMascotCelebrations(). Auto-clears after 2s; no button. The
  // persistent reminder lives in the Tap-tiles strip badge.
  const [lootAnnounceLevel, setLootAnnounceLevel] = useState(null); // level number or null
  const lootAnnounceTimerRef = useRef(null);
  // v108: A-hybrid rotating Level Clear line — running session counter. Starts at
  // -1; the render advances it once per clear (first clear of session uses the
  // deterministic daily line, subsequent clears advance). Resets on app launch.
  const clearSayingIdxRef = useRef(-1);
  // Captured line to display for the current clear (set when the clear fires so
  // the counter doesn't advance on unrelated re-renders).
  const [clearSayingText, setClearSayingText] = useState("");
  const [wotdFoundDetails, setWotdFoundDetails] = useState(() => {
    try {
      const cached = getCachedWordOfTheDay();
      return cached?.foundLevel ? { level: cached.foundLevel, score: cached.foundScore } : null;
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
  const levelResetCount = useRef(0);
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
  const [levelComplete, setLevelComplete] = useState(ss?.levelComplete || false);
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
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // (v103) showNewGameConfirm state removed — the mid-play Start New Game button and its confirm modal were deleted.
  const [showStuckModal, setShowStuckModal] = useState(false);
  // v83 (item 18): confirm dialog for the always-available "End Game & Share Results"
  // button at the base of the tile board — lets a player end their day and share their
  // results anytime, without needing the game to detect they're "stuck".
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  const [musicOn, setMusicOn] = useState(false);
  const [statsData, setStatsData] = useState(() => getLocalStats());
  const [timeLeaderboard, setTimeLeaderboard] = useState(() => getLocalTimeLeaderboard());
  const [showNameInput, setShowNameInput] = useState(false);
  const [perfectDay, setPerfectDay] = useState(ss?.perfectDay ?? true);
  const perfectDayRef = useRef(ss?.perfectDay ?? true);
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
  const [longestWordToday, setLongestWordToday] = useState(ss?.longestWordToday || "");
  const [longestWordAllTime, setLongestWordAllTime] = useState(localStorage.getItem("ll_longest") || "");
  const [perfectDayAchieved, setPerfectDayAchieved] = useState(false);
  // v91: full-screen pirate+leprechaun dance celebration that plays BEFORE the Perfect Day
  // stats modal. Triggered the first time perfectDayAchieved flips true (see effect below).
  const [showPirateDance, setShowPirateDance] = useState(false);
  const pirateDancePlayedRef = useRef(false);
  // v91: when a Perfect Day is achieved (first time this session), play the pirate dance
  // celebration overlay, then auto-dismiss it (~5.2s) leaving the stats modal underneath.
  useEffect(() => {
    if (perfectDayAchieved && !pirateDancePlayedRef.current) {
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
      const sess = JSON.parse(localStorage.getItem("ll_session") || "null");
      const d = new Date();
      const todayKey = d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();
      // Stale Perfect Day on launch fix (May 15, 2026):
      // If the player completed and acknowledged a Perfect Day today, show Welcome screen
      // on re-launch (not the stale completed-game state that triggered the modal). They
      // can decide from Welcome whether to play another round or just check stats.
      const pdAcknowledged = localStorage.getItem("ll_pd_acknowledged_today") === todayKey;
      if (pdAcknowledged) return true;
      // Restore if: same day AND (has submitted words OR is on level > 1)
      const hasActiveGame = sess && sess.savedDate === todayKey && (
        (sess.submitted && sess.submitted.length > 0) || (sess.level && sess.level > 1)
      );
      return !hasActiveGame;
    } catch { return true; }
  });
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
  const [playAgainChoice, setPlayAgainChoice] = useState(null);
  const [perfectDayStreakBonus, setPerfectDayStreakBonus] = useState(0);
  const [showStreakBonus, setShowStreakBonus] = useState(false);
  // v57: New popup shown to Guests after PD modal — Guests don't accumulate
  // streak bonuses, so we tell them what they're missing and offer a sign-up.
  const [showGuestStreakUpsell, setShowGuestStreakUpsell] = useState(false);
  const [streakBonusCount, setStreakBonusCount] = useState(1);
  const [confirmResetStats, setConfirmResetStats] = useState(false);
  const [showReadyScreen, setShowReadyScreen] = useState(false);
  const [leaderboardFromPerfectDay, setLeaderboardFromPerfectDay] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState('scores');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('alltime');
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
          // Reset to L1, then advance to target level via handleNextLevel
          handleFullReset({skipWelcome: true});
          // Advance levels via timer to let React state settle
          let i = 1;
          const advance = () => {
            if (i >= targetLevel) return;
            handleNextLevel(false);
            i++;
            setTimeout(advance, 50);
          };
          setTimeout(advance, 100);
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
    } catch (e) {
      // Silent — debug action errors shouldn't crash gameplay
      console.error("Debug action error:", e);
    }
    onDebugConsumed?.();
  }, [debugAction]);

  // GLOBAL GUARD: If user lands on the play tab with a completed game (or empty L5+ board),
  // force-show the Play Again screen instead of a dead board. Catches all entry paths
  // (tab clicks, modal closes, etc.), not just returnToGame().
  useEffect(() => {
    if (tab !== "play") return;
    if (showRepeatPerfect || perfectDayAchieved || levelComplete || showIntro || showReadyScreen) return;
    try {
      // Stale Perfect Day on launch fix (May 15, 2026):
      // If the player has already acknowledged (dismissed) today's Perfect Day modal,
      // don't auto-pop it again on a fresh app open. They've seen it; they're back to
      // start a fresh game / play around. The Welcome screen / fresh game flow handles
      // them from here.
      const acknowledged = localStorage.getItem("ll_pd_acknowledged_today") === getTodayKey();
      if (acknowledged) return;
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
  }, [tab, tiles, level, showRepeatPerfect, perfectDayAchieved, levelComplete, showIntro, showReadyScreen]);

  useEffect(() => {
    if (tab === 'leaderboard' && !leaderboardData && !leaderboardLoading) {
      setLeaderboardLoading(true);
      const timer = setTimeout(() => { setLeaderboardLoading(false); setLeaderboardData(null); }, 10000);
      fetchLeaderboard().then(d => { clearTimeout(timer); setLeaderboardData(d); setLeaderboardLoading(false); });
    }
  }, [tab]);

  const timerRef = useRef(null);
  const justResetRef = useRef(false);
  const [showReadyToPlay, setShowReadyToPlay] = useState(false);
  const levelTimeRef = useRef(ss?.levelTime || 0);
  const totalTimeRef = useRef(ss?.totalTime || 0);
  const submittedRef = useRef(ss?.submitted || []);
  const totalRef = useRef(ss?.totalScore || 0);
  const levelScoreRef = useRef(ss?.levelScore || 0);
  const lifetimeRef = useRef(lifetimeData.current.total || 0);
  const audioCtxRef = useRef(null);
  const musicLoopRef = useRef(null);
  const nextLoopRef = useRef(0);
  const clearedLevelsRef = useRef({});
  const syncTimerRef = useRef(null);

  const availableTiles = tiles.filter(t => !t.used);
  const vowelsRemaining = availableTiles.filter(t => VOWELS.has(t.letter)).length;
  const consonantsRemaining = availableTiles.filter(t => !VOWELS.has(t.letter)).length;
  const tileRows = [];
  for (let i = 0; i < tiles.length; i += 7) tileRows.push(tiles.slice(i, i + 7));
  const currentWord = selected.map(id => tiles.find(t => t.id === id)?.letter).join("");
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
          };
          setStatsData(mergedStats);
          saveLocalStats(mergedStats);
          setTimeLeaderboard(prev => ({...prev, ...(gameState.time_records || {})}));
        }
        if (dailySession && dailySession.level != null && !justResetRef.current) {
          // Only restore cloud session if it's further along than local session
          const localLevel = ss?.level || 1;
          const localSubmitted = ss?.submitted?.length || 0;
          const cloudLevel = dailySession.level || 1;
          const cloudSubmitted = (dailySession.submitted || []).length;
          const useCloud = cloudLevel > localLevel || (cloudLevel === localLevel && cloudSubmitted >= localSubmitted);
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
            setLongestWordToday(dailySession.longest_word_today || "");
            levelTimeRef.current = dailySession.level_time || 0; totalTimeRef.current = dailySession.total_time || 0;
            setLevelTime(dailySession.level_time || 0); setTotalTime(dailySession.total_time || 0);
            if (dailySession.level_complete) { setLevelComplete(true); restoredComplete = true; }
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
      if (!alreadyComplete) {
        stopTimer();
        setAwaitingFirstTap(true); awaitingFirstTapRef.current = true;
      }
      if (!localStorage.getItem("ll_tour_done")) setShowTour(true);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") scheduleNotifications();
    };
    init();
  }, [user, isGuest]);

  const syncToCloud = useCallback(async () => {
    if (isGuest || !user) return;
    const todayKey = getTodayKey();
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
    await Promise.all([
      saveDailySession(user.id, todayKey, {
        level, totalScore: totalRef.current, levelScore: levelScoreRef.current,
        tiles, submitted: submittedRef.current, perfectDay: cloudPerfectDay,
        tileCount: tileCountRef.current, levelTime: levelTimeRef.current,
        totalTime: totalTimeRef.current, longestWordToday, levelComplete, newBestTime, undoUsed,
        gameIndex: gameIndexRef.current, wotdFound: wotdFound,
        topWord: topEntry?.word || "", topWordScore: topEntry?.score || 0,
      }),
      saveGameState(user.id, (() => {
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
          playerName: playerNameRef.current || playerName || '',
          lifetimePoints: lifetimeRef.current, lastPlayedDate: todayKey,
          currentStreak: statsData.currentStreak, longestStreak: statsData.longestStreak,
          lastStreakDate: statsData.lastStreakDate, badges: liveBadges,
          stats: {...statsData, playerName: playerNameRef.current || playerName}, timeRecords: timeLeaderboard,
        };
      })()),
    ]);
  }, [user, isGuest, level, tiles, longestWordToday, badgeStore, statsData, timeLeaderboard, playerName, levelComplete, newBestTime, undoUsed]);

  const scheduleSyncToCloud = useCallback(() => {
    if (isGuest || !user) return;
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(syncToCloud, 3000);
  }, [syncToCloud, isGuest, user]);

  const showSavedIndicator = useCallback(() => { setSavedIndicator(true); setTimeout(() => setSavedIndicator(false), 2000); }, []);

  useEffect(() => {
    saveLocalSession({ level, tiles, totalScore: totalRef.current, levelScore: levelScoreRef.current, submitted: submittedRef.current, badges: badgeStore.lifetime, streak, perfectDay: perfectDayRef.current, longestWordToday, tileCount: tileCountRef.current, levelTime: levelTimeRef.current, totalTime: totalTimeRef.current, levelComplete, newBestTime, undoUsed, gameIndex: gameIndexRef.current });
    showSavedIndicator();
    scheduleSyncToCloud();
  }, [level, tiles, badgeStore, streak, longestWordToday, levelComplete, newBestTime, undoUsed]);

  // Save immediately when user switches away (text message, other app, etc.)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveLocalSession({ level, tiles, totalScore: totalRef.current, levelScore: levelScoreRef.current, submitted: submittedRef.current, badges: badgeStore.lifetime, streak, perfectDay: perfectDayRef.current, longestWordToday, tileCount: tileCountRef.current, levelTime: levelTimeRef.current, totalTime: totalTimeRef.current, levelComplete, newBestTime, undoUsed, gameIndex: gameIndexRef.current });
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
    if (awaitingFirstTapRef.current) return;
    if (timerRef.current) return;
    timerRef.current = setInterval(() => { levelTimeRef.current += 1; totalTimeRef.current += 1; setLevelTime(levelTimeRef.current); setTotalTime(totalTimeRef.current); }, 1000);
  }, []);
  const stopTimer = useCallback(() => { clearInterval(timerRef.current); timerRef.current = null; }, []);
  // v79 CENTRAL FIX: resetLevelTimer now also stops the clock AND arms the first-tap
  // gate. Every level-entry/reset path calls resetLevelTimer(), so doing the freeze
  // here guarantees the timer stays at 0 until the player's first tap — regardless of
  // which path (handleNextLevel, doLevelReset, buy, fresh game) triggered the new level.
  // This replaces the fragile per-caller gate-arming that kept leaking.
  const resetLevelTimer = useCallback(() => {
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
    if (paused) { setPaused(false); startTimer(); if (musicOn) startMusic(); }
    else { setPaused(true); stopTimer(); stopMusic(); }
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
      }
    }, 5000);
  }, [stopTimer, startTimer, levelComplete]);

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
    const skipWelcome = opts.skipWelcome === true;
    const rng = seededRandom(getDailySeed());
    const bp = getBonusPositions(42, getBonusCount(1), rng);
    setTiles(generateLevelTiles(1, 0, rng, bp));
    tileCountRef.current = 42; setLevel(1); setSelected([]);
    setSubmitted([]); submittedRef.current = [];
    setTotalScore(0); totalRef.current = 0;
    setLevelScore(0); levelScoreRef.current = 0;
    setStreak(0); setShowBadge(null);
    setLevelComplete(false); setShowBuyModal(false); setShowNameInput(false);
    setShowResetConfirm(false); setShowStuckModal(false); setPaused(false);
    // v100 (item #2c): only restore Perfect Day eligibility if it has NOT already been forfeited
    // today. Once a player has reset a level / re-done / bought a level today, "Start New Game"
    // starts non-PD-eligible for the rest of the day — you get one clean shot at Perfect Day.
    const pdForfeitedToday = (() => { try { return localStorage.getItem("ll_pd_forfeited_today") === getTodayKey(); } catch { return false; } })();
    setPerfectDaySync(!pdForfeitedToday); setPerfectDayAchieved(false); setLongestWordToday("");
    setShowRepeatPerfect(false); setNewBestTime(false);
    setUndoUsed(false); setLastValidEntry(null); setShowUndoConfirm(false);
    setBonusRetryUsed(false); setShowBonusUnsuccessful(false); setShowBonusRestart(false); setShowBonusNo(false); setBonusRestartChoice(null);
    setPerfectDayStreakBonus(0); setShowStreakBonus(false); setStreakBonusCount(1);
    levelResetCount.current = 0; clearedLevelsRef.current = {};
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
          setWotdFoundDetails({ level: cachedWotd.foundLevel, score: cachedWotd.foundScore });
        } else {
          setWotdFoundDetails(null);
        }
      }
    } catch {}
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
    // After reset, drop to Welcome OR directly to Ready, never both.
    // Setting both causes a double-prompt: Welcome → Let's Go → Ready → Let's Go again.
    if (skipWelcome) {
      setShowReadyScreen(true);
      setShowIntro(false);
    } else {
      setShowReadyScreen(false);
      setShowIntro(true);
    }
  }, [startTimer, stopTimer, setPerfectDaySync]);

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
    setTiles(prev => prev.map(t => ({ ...t, used: false })));
    // v79 FIX: a level reset/replay must also freeze the clock until the first tap.
    // Previously this only called resetLevelTimer() (zeroed the clock) but left the
    // timer running and the gate unarmed — a source of the pre-tap timer leak.
    setSelected([]); resetLevelTimer(); stopTimer(); setAwaitingFirstTap(true); awaitingFirstTapRef.current = true; setNewBestTime(false);
    setShowResetConfirm(false); setShowStuckModal(false);
  }, [resetLevelTimer, stopTimer, level, forfeitPerfectDay]);

  const handleUndo = useCallback(() => {
    if (undoUsed || !lastValidEntry || totalRef.current < 1000) return;
    const { word, score, tileIds, levelScoreDelta } = lastValidEntry;
    const undoCost = isBonusLevel(level) ? 10000 : 1000;
    totalRef.current -= (undoCost + score); setTotalScore(totalRef.current);
    levelScoreRef.current -= levelScoreDelta; setLevelScore(levelScoreRef.current);
    lifetimeRef.current -= score; setLifetimePoints(lifetimeRef.current);
    if (isGuest) saveLifetimeData(lifetimeRef.current);
    setTiles(prev => prev.map(t => tileIds.includes(t.id) ? { ...t, used: false } : t));
    const newSubmitted = [...submittedRef.current];
    const lastIdx = [...newSubmitted].map(s=>s.word).lastIndexOf(word);
    if (lastIdx !== -1) newSubmitted.splice(lastIdx, 1);
    submittedRef.current = newSubmitted; setSubmitted(newSubmitted);
    setUndoUsed(true); setLastValidEntry(null); setShowUndoConfirm(false);
    setFlash({ word: `↩️ UNDO: ${word}`, score: 0, valid: true });
    setTimeout(() => setFlash(null), 2000);
  }, [undoUsed, lastValidEntry, isGuest]);

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

  const getPerfectDayShareText = useCallback(() => {
    const allValid = submittedRef.current.filter(s => s.valid);
    // CRITICAL: exclude loot words from share — score/length would expose the loot letter
    // to other players today. Loot Letter must remain a daily mystery.
    const shareableWords = allValid.filter(s => !s.loot);
    const bestWord = shareableWords.reduce((b, s) => !b || s.score > b.score ? s : b, null);
    const longestW = shareableWords.reduce((b, s) => !b || s.word.length > b.word.length ? s : b, null);
    const sharer = playerName ? `${playerName} had a 🌈🏆 Perfect Day on LetterLoot!` : "🌈🏆 PERFECT DAY on LetterLoot!";
    const bonusLine = perfectDayStreakBonus > 0 ? `\n🌈🏆 Streak Bonus: +${perfectDayStreakBonus.toLocaleString()} pts` : "";
    const wotdLine = wotdFoundDetails ? `\n🎯 Word of the Day: ${wotd} — Found! Scored ${wotdFoundDetails.score} pts` : "";
    const timeLine = `\n⏱️ Total Time: ${formatTime(totalTimeRef.current)}`;
    return `${sharer}\n${getShortDate()} · Score: ${totalRef.current} pts${bonusLine}${timeLine}${wotdLine}\n🏆 Best Scoring Word: ${bestWord?.word || "—"} — ${bestWord?.score || 0} pts\n📏 Longest Word: ${longestW?.word || "—"} — ${longestW?.word?.length || 0} letters\n____________________________\nCheck it out — ${getShareUrlLabel()}\n${getShareUrl()}\n🌈🏆`;
  }, [playerName, perfectDayStreakBonus, wotd, wotdFoundDetails]);

  // Non-Perfect-Day "day's results" share (item 6, added v72). Mirrors the Perfect Day
  // builder but without the Perfect Day framing — for players who want to share their
  // progress even when they didn't get a Perfect Day. Includes levels reached, score,
  // total time, WoD status, best-scoring word, longest word. Keeps the loot-word
  // exclusion so the daily Loot Letter isn't leaked.
  const getDayResultsShareText = useCallback(() => {
    const allValid = submittedRef.current.filter(s => s.valid);
    const shareableWords = allValid.filter(s => !s.loot);
    const bestWord = shareableWords.reduce((b, s) => !b || s.score > b.score ? s : b, null);
    const longestW = shareableWords.reduce((b, s) => !b || s.word.length > b.word.length ? s : b, null);
    const sharer = playerName ? `${playerName} had a Great Day on LetterLoot today!` : "My LetterLoot results today!";
    const levelsLine = `\nSuccessfully completed ${Math.min(level, 5)} of 5 levels`;
    const timeLine = `\n⏱️ Total Time: ${formatTime(totalTimeRef.current)}`;
    const wotdLine = wotdFoundDetails
      ? `\n🎯 Word of the Day: ${wotd} — Found! Scored ${wotdFoundDetails.score} pts`
      : `\n🎯 Word of the Day: not found today`;
    return `${sharer}\n${getShortDate()} · Score: ${totalRef.current} pts${levelsLine}${timeLine}${wotdLine}\n🏆 Best Scoring Word: ${bestWord?.word || "—"} — ${bestWord?.score || 0} pts\n📏 Longest Word: ${longestW?.word || "—"} — ${longestW?.word?.length || 0} letters\n____________________________\nGive it a try! 😊 — ${getShareUrlLabel()}\n${getShareUrl()}`;
  }, [playerName, level, wotd, wotdFoundDetails]);

  // v74 (Option A): triggerFarewell passes the precomputed day-results share text up to
  // the App-level Farewell screen, so it can offer Text/Email/Copy without needing
  // GameScreen's share machinery in scope. Placed AFTER getDayResultsShareText to avoid
  // a temporal-dead-zone reference in the useCallback dependency array.
  const triggerFarewell = useCallback(() => {
    const bestEntry = submittedRef.current.filter(s => s.valid).reduce((best, s) => !best || s.score > best.score ? s : best, null);
    onFarewell({ totalScore: totalRef.current, bestWord: bestEntry?.word || "", bestWordScore: bestEntry?.score || 0, shareText: getDayResultsShareText() });
  }, [onFarewell, getDayResultsShareText]);

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
      const [gsRes, todayRes, weekRes, wotdAllRes, allWordSessionsRes] = await Promise.all([
        fetchWithAbort(`${base}/game_state?select=player_id,player_name,lifetime_points,current_streak,longest_streak,stats,badges&order=lifetime_points.desc&limit=100`),
        fetchWithAbort(`${base}/daily_sessions?select=player_id,date_key,total_score,perfect_day,longest_word_today,wotd_found,top_word,top_word_score&date_key=eq.${(()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();})()}&limit=100`),
        fetchWithAbort(`${base}/daily_sessions?select=player_id,date_key,total_score,perfect_day,wotd_found,longest_word_today,top_word,top_word_score&limit=2000`),
        fetchWithAbort(`${base}/daily_sessions?select=player_id,date_key,wotd_found&wotd_found=eq.true&limit=2000`),
        fetchWithAbort(`${base}/daily_sessions?select=player_id,date_key,longest_word_today,top_word,top_word_score&limit=2000`),
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
      return { gs, todaySessions, weekSessions, wotdAllSessions, allWordSessions };
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
    if (!online) { setFlash({ word: "No internet connection!", score: 0, valid: false }); setTimeout(() => setFlash(null), 2000); return; }
    setValidating(true);
    // Hard safety timeout — if validation hangs for any reason, force-clear after 15s
    const safetyTimer = setTimeout(() => {
      setValidating(false);
      setFlash({ word: "Connection slow — try again", score: 0, valid: false });
      setTimeout(() => setFlash(null), 2000);
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
    if (result.source === "timeout") {
      setFlash({ word: "Dictionary lookup timed out — try again.", score: 0, valid: false });
      setTimeout(() => setFlash(null), 3000);
      setShake(true); setTimeout(() => setShake(false), 500);
      setSelected([]); setValidating(false); return;
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
    setFlash({ word: flashMsg, score, valid, medical: isMedical, collegiate: isCollegiate });
    setTimeout(() => setFlash(null), 2000);
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
    const isWotdWord = !!(valid && wotd && !wotdFound && currentWord.toUpperCase() === wotd.toUpperCase());
    const newEntry = { word: currentWord, score, valid, medical: isMedical, collegiate: isCollegiate, likelyValid: result.likelyValid || false, loot: isLootWord, wotd: isWotdWord };
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
      if (isGuest) saveLifetimeData(newLifetime);
      // ── Word of the Day check — award 1,000 bonus once per day ──
      if (wotd && !wotdFound && currentWord.toUpperCase() === wotd.toUpperCase()) {
        setWotdFound(true);
        setWotdFoundDetails({ level, score });
        markWordOfTheDayFound(level, score);
        const bonus = 1000;
        totalRef.current += bonus; setTotalScore(totalRef.current);
        lifetimeRef.current += bonus; setLifetimePoints(lifetimeRef.current);
        if (isGuest) saveLifetimeData(lifetimeRef.current);
        // Trigger celebration
        stopTimer();
        setConfetti(true); setTimeout(() => setConfetti(false), 5000);
        setWotdCelebration(true);
        setTimeout(() => {
          setWotdCelebration(false);
          // v80 (stop-only model): the fair-timer effect no longer auto-resumes. Resume
          // explicitly here for the normal mid-play case (player found the WoD while
          // playing). The startTimer() guard + these checks keep it FROZEN if the level
          // was completed during the celebration or we're awaiting the next level's first tap.
          if (awaitingFirstTapRef.current || levelCompleteRef.current || pausedRef.current) {
            stopTimer();
          } else {
            startTimer();
          }
        }, 5000);
      }
      const newTiles = tiles.map(t => {
        if (!selected.includes(t.id)) return t;
        // Mark used; if this was the loot letter, also flag lootUsed for persistent styling
        return t.isLoot ? { ...t, used: true, lootUsed: true } : { ...t, used: true };
      });
      // ── Loot Letter detection (already determined above as usedLootTile) ──
      if (usedLootTile) {
        // Fire celebration: popup, haptic, sound (no confetti per spec)
        stopTimer();
        setLootCelebration({ word: currentWord, score, letter: usedLootTile.letter });
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
        // Auto-dismiss after 5s; the fair-timer useEffect handles restart.
        setTimeout(() => {
          setLootCelebration(null);
          // v80 (stop-only model): resume explicitly for the normal mid-play case;
          // stay frozen if level just completed / awaiting first tap / paused.
          if (awaitingFirstTapRef.current || levelCompleteRef.current || pausedRef.current) {
            stopTimer();
          } else {
            startTimer();
          }
        }, 5000);
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
      if (currentWord.length > (longestWordToday.length||0)) { setLongestWordToday(currentWord); }
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
        if (isGuest) saveLifetimeData(lifetimeRef.current);
        setFlash({ word: "BOARD CLEAR!", score: bonus, valid: true });
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
        const existingTime = statsData.fastestLevels?.[String(level)];
        const existingSecs = existingTime ? existingTime.seconds : null;
        const isNewTimeRecord = existingSecs === null || clearedTime < existingSecs;
        if (isNewTimeRecord) setNewBestTime(true);
        const updatedStats = updateLocalStats({ levelTime: clearedTime, levelNum: level, score: totalRef.current, levelScore: clearedLevelScore });
        setStatsData(updatedStats);
        const updatedTimes = addLocalLevelTime(playerName||"You", level, clearedTime);
        setTimeLeaderboard(updatedTimes);
        if (isNewTimeRecord) setTimeout(() => flashNewRecord("time", clearedTime, level), 1500);
        if (level < 5) {
          // v108: advance the A-hybrid rotation once per genuine clear + capture
          // the line to show (captured here so re-renders/re-shows don't advance it).
          clearSayingIdxRef.current = clearSayingIdxRef.current + 1;
          setClearSayingText(pickClearSaying(level, clearSayingIdxRef.current));
          setTimeout(() => setLevelComplete(true), 1200);
        } else {
          localStorage.setItem("ll_completed_today", getTodayKey());
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
                const alreadyPDToday = freshStats.lastPerfectDate === getTodayKey();
                // If already PD today (replay): keep existing streak. Else if yesterday: increment. Else: reset to 1.
                const newStreakCount = alreadyPDToday
                  ? (freshStats.consecutivePerfectDays || 1)
                  : (wasPDYesterday ? (freshStats.consecutivePerfectDays || 0) + 1 : 1);
                const perfStreak = newStreakCount;
                const streakBonus = 1000 + (perfStreak * 1000);
                setPerfectDayStreakBonus(streakBonus);
                setStreakBonusCount(perfStreak);
                totalRef.current += streakBonus; setTotalScore(totalRef.current);
                lifetimeRef.current += streakBonus; setLifetimePoints(lifetimeRef.current);
                // Show streak bonus first — PD screen shows when player taps Continue
                triggerHaptic("heavy");
                setTimeout(() => setShowStreakBonus(true), 1200);
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
              setTimeout(() => triggerFarewell(), 1500);
            }
          }
        }
        if (!isGuest && user) await syncToCloud();
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

  const handleNextLevel = (bought = false) => {
    if (bought) forfeitPerfectDay();
    // Hard cap: cannot go beyond Level 5 unless bonus levels are enabled
    if (!ENABLE_BONUS_LEVELS && level >= 5) return;
    const newLevel = level + 1;
    setLevel(newLevel); setLevelComplete(false); setShowBuyModal(false);
    levelScoreRef.current = 0; setLevelScore(0);
    const rng = seededRandom(getDailySeed() + newLevel * 999);
    const count = 42 + (newLevel - 1) * 7;
    const bp = getBonusPositions(count, getBonusCount(newLevel), rng);
    const newTiles = generateLevelTiles(newLevel, tileCountRef.current, rng, bp);
    tileCountRef.current += count;
    setTiles(newTiles); setSelected([]);
    levelResetCount.current = 0; resetLevelTimer(); stopTimer(); setAwaitingFirstTap(true); awaitingFirstTapRef.current = true; setNewBestTime(false);
    fireLootAnnounce(newLevel);
    if (wotd && !wotdFound) showWotdReminderWithPause();
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
          const gameComplete = allUsed && level === 5;
          if (gameComplete) {
            const rng = seededRandom(getDailySeed());
            const bp = getBonusPositions(42, getBonusCount(1), rng);
            setTiles(generateLevelTiles(1, 0, rng, bp));
            tileCountRef.current = 42; setLevel(1); setSelected([]);
            setSubmitted([]); submittedRef.current = [];
            setTotalScore(0); totalRef.current = 0;
            setLevelScore(0); levelScoreRef.current = 0;
            setStreak(0); setLevelComplete(false);
            // v100 (item #2c): respect the per-day PD forfeit flag here too — starting another
            // game today via PLAY NOW must not re-open a Perfect Day shot once forfeited.
            const pdForfeitedToday2 = (() => { try { return localStorage.getItem("ll_pd_forfeited_today") === getTodayKey(); } catch { return false; } })();
            setPerfectDaySync(!pdForfeitedToday2); setLongestWordToday("");
            setUndoUsed(false); setLastValidEntry(null);
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
            <div style={{fontSize:10,color:"#a78bfa",letterSpacing:3,fontWeight:"bold",marginBottom:6}}>🎯 WORD OF THE DAY</div>
            <div style={{fontSize:24,fontWeight:"bold",color:"#f6d365",letterSpacing:2,marginBottom:6,fontFamily:"Georgia,serif"}}>{wotd}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",lineHeight:1.5}}>
              {wotdFound ? "✓ You found it! +1,000 pts" : "Find & spell it during today's game for a 1,000 pt bonus!"}
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
          <div>✦ Clear all 5 levels + find the Word of the Day to enjoy and share a <span style={{color:"#6ee7b7",fontWeight:"bold"}}>Perfect Day! 🌈🏆</span></div>
        </div>
        {/* v104: Show Mascot Celebrations toggle — plain iOS-style switch, backed by ll_show_mascots (default ON) */}
        <div onClick={()=>setMascotsPref(!showMascotsPref)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",boxSizing:"border-box",padding:`${ipadIntroPad(12)}px ${ipadIntroPad(16)}px`,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,marginBottom:ipadIntro(22),cursor:"pointer"}}>
          <span style={{fontSize:ipadIntro(13),color:"rgba(255,255,255,0.85)"}}>Show Mascot Celebrations</span>
          <div style={{width:ipadIntro(48),height:ipadIntro(28),borderRadius:ipadIntro(14),background:showMascotsPref?"#00c853":"rgba(255,255,255,0.2)",position:"relative",flexShrink:0,transition:"background 0.2s",boxShadow:"inset 0 0 0 1px rgba(255,255,255,0.15)"}}>
            <div style={{position:"absolute",top:ipadIntro(3),left:showMascotsPref?ipadIntro(23):ipadIntro(3),width:ipadIntro(22),height:ipadIntro(22),borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
          </div>
        </div>
        <button onClick={()=>{ setShowReadyScreen(false); stopTimer(); setAwaitingFirstTap(true); awaitingFirstTapRef.current = true; fireLootAnnounce(1); }} style={{width:"100%",padding:`${ipadIntroPad(20)}px`,borderRadius:16,background:"linear-gradient(135deg,#00c853,#00e676)",color:"#003300",fontSize:ipadIntro(20),fontWeight:"bold",letterSpacing:2,border:"none",cursor:"pointer",fontFamily:"Georgia,serif",boxShadow:"0 0 32px rgba(0,200,83,0.5)"}}>
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
        @keyframes pdPiratesRise{0%{bottom:-380px;opacity:0;transform:translateX(-50%) scale(0.85)}60%{bottom:8%;opacity:1;transform:translateX(-50%) scale(1.04)}100%{bottom:6%;opacity:1;transform:translateX(-50%) scale(1)}}
        @keyframes pdPiratesJig{0%{bottom:6%;opacity:1;transform:translateX(-50%) rotate(0deg) translateY(0)}12%{bottom:6%;opacity:1;transform:translateX(-70%) rotate(-5deg) translateY(-14px)}25%{bottom:6%;opacity:1;transform:translateX(-70%) rotate(-3deg) translateY(0)}37%{bottom:6%;opacity:1;transform:translateX(-50%) rotate(0deg) translateY(-14px)}50%{bottom:6%;opacity:1;transform:translateX(-50%) rotate(0deg) translateY(0)}62%{bottom:6%;opacity:1;transform:translateX(-30%) rotate(5deg) translateY(-14px)}75%{bottom:6%;opacity:1;transform:translateX(-30%) rotate(3deg) translateY(0)}87%{bottom:6%;opacity:1;transform:translateX(-50%) rotate(0deg) translateY(-14px)}100%{bottom:6%;opacity:1;transform:translateX(-50%) rotate(0deg) translateY(0)}}
        @keyframes pdPiratesOut{0%{bottom:6%;opacity:1;transform:translateX(-50%) scale(1)}100%{bottom:-380px;opacity:0;transform:translateX(-50%) scale(0.9)}}
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
        @keyframes provethat{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
        @keyframes warningPulse{0%,100%{background:rgba(220,38,38,0.2)}50%{background:rgba(220,38,38,0.4)}}
        @keyframes purseGlow{0%,100%{box-shadow:0 0 18px rgba(139,92,246,0.7)}50%{box-shadow:0 0 32px rgba(167,139,250,0.95)}}
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
        <div style={{position:"fixed",inset:0,zIndex:9500,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",pointerEvents:"none"}}>
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",border:"2px solid rgba(167,139,250,0.6)",borderRadius:18,padding:`${ipadTour(18)}px ${ipadTour(22)}px`,boxShadow:"0 10px 36px rgba(0,0,0,0.7)",fontFamily:"Georgia,serif",color:"#f5f0e8",maxWidth:ipadTour(300),width:"100%",textAlign:"center",pointerEvents:"auto"}}>
            <div style={{fontSize:ipadTour(10),color:"#a78bfa",letterSpacing:3,fontWeight:"bold",marginBottom:6}}>🎯 WORD OF THE DAY</div>
            <div style={{fontSize:ipadTour(22),fontWeight:"bold",color:"#f6d365",letterSpacing:2,marginBottom:8}}>{wotd}</div>
            <div style={{fontSize:ipadTour(11),color:"rgba(255,255,255,0.9)",marginBottom:12,lineHeight:1.5}}>Spell it for a <strong style={{color:"#fda085"}}>+1,000 pt bonus!</strong></div>
            <button onClick={dismissWotdReminder} style={{padding:`${ipadTour(8)}px ${ipadTour(22)}px`,borderRadius:11,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.25)",color:"#fff",fontFamily:"Georgia,serif",fontSize:ipadTour(12),fontWeight:"bold",cursor:"pointer"}}>Got it ✓</button>
          </div>
        </div>
      )}

      {/* Word of the Day celebration — fires when player spells the WoD */}
      {wotdCelebration && (
        <div style={{position:"fixed",inset:0,zIndex:9650,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",padding:"20px"}}>
          <div style={{background:"linear-gradient(135deg,#a78bfa,#7c3aed)",border:"3px solid #f6d365",borderRadius:22,padding:`${ipadIntro(24)}px ${ipadIntro(32)}px`,boxShadow:"0 0 60px rgba(246,211,101,0.6),0 12px 40px rgba(0,0,0,0.7)",fontFamily:"Georgia,serif",textAlign:"center",animation:"wotdPop 5s forwards",maxWidth:ipadIntro(340),width:"100%"}}>
            <div style={{fontSize:ipadIntro(42),marginBottom:6}}>🎯✨</div>
            <div style={{fontSize:ipadIntro(14),color:"#f6d365",letterSpacing:3,fontWeight:"bold",marginBottom:6}}>WORD OF THE DAY!</div>
            <div style={{fontSize:ipadIntro(26),fontWeight:"bold",color:"#fff",letterSpacing:2,marginBottom:8}}>{wotd}</div>
            <div style={{fontSize:ipadIntro(18),fontWeight:"bold",color:"#6ee7b7"}}>+1,000 pts!</div>
          </div>
        </div>
      )}

      {/* (v106) Loot Letter announcement — brief informational popup at level open.
          NOT a celebration; ungated by the mascot toggle. Auto-dismisses (2s via
          fireLootAnnounce). Non-interactive (pointerEvents none). */}
      {lootAnnounceLevel != null && (
        <div style={{position:"fixed",inset:0,zIndex:9600,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",padding:"20px"}}>
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:`${ipadIntro(24)}px ${ipadIntro(34)}px`,textAlign:"center",border:"1.5px solid rgba(246,211,101,0.5)",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",fontFamily:"Georgia,serif",animation:"lootAnnounce 2.5s forwards"}}>
            <div style={{fontSize:ipadIntro(13),color:"#fde68a",fontWeight:"bold",letterSpacing:1,marginBottom:2}}>💥 LOOT LETTER</div>
            <div style={{fontSize:ipadIntro(18),color:"#f6d365",fontWeight:"bold",marginBottom:ipadIntro(16)}}>Level {lootAnnounceLevel}</div>
            <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:ipadIntro(88),height:ipadIntro(88),borderRadius:16,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadIntro(56),fontWeight:"bold",boxShadow:"0 0 28px rgba(246,211,101,0.6)"}}>{getLootLetterForLevel(lootAnnounceLevel)}</div>
          </div>
        </div>
      )}

      {/* Loot Letter celebration — fires when player uses the daily Loot Letter in a valid word */}
      {lootCelebration && (
        <div style={{position:"fixed",inset:0,zIndex:9700,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",padding:"20px"}}>
          <div style={{background:"linear-gradient(135deg,#f6d365,#fda085)",border:"3px solid #00e676",borderRadius:22,padding:`${ipadIntro(24)}px ${ipadIntro(32)}px`,boxShadow:"0 0 80px rgba(246,211,101,0.9),0 0 30px rgba(0,230,118,0.6),0 12px 40px rgba(0,0,0,0.7)",fontFamily:"Georgia,serif",textAlign:"center",animation:"wotdPop 5s forwards",maxWidth:ipadIntro(340),width:"100%"}}>
            <div style={{fontSize:ipadIntro(42),marginBottom:6}}>💥✨</div>
            <div style={{fontSize:ipadIntro(18),color:"#1a1a2e",letterSpacing:4,fontWeight:"bold",marginBottom:10}}>💥 LOOT LETTER! 💥</div>
            {/* Big tile-style display of today's actual Loot Letter */}
            {lootCelebration.letter && (
              <div style={{display:"inline-block",background:"linear-gradient(135deg,#1a1a2e,#2d1b69)",border:"3px solid #00e676",borderRadius:14,padding:`${ipadIntro(12)}px ${ipadIntro(22)}px`,marginBottom:12,boxShadow:"0 0 20px rgba(0,230,118,0.6),inset 0 0 12px rgba(255,255,255,0.1)"}}>
                <div style={{fontSize:ipadIntro(42),fontWeight:"bold",color:"#f6d365",letterSpacing:2,lineHeight:1,textShadow:"0 0 12px rgba(246,211,101,0.8)"}}>{lootCelebration.letter}</div>
              </div>
            )}
            <div style={{fontSize:ipadIntro(13),color:"#2d1b00",fontWeight:"bold",marginBottom:6}}>You found the hidden Loot Letter!</div>
            <div style={{fontSize:ipadIntro(16),fontWeight:"bold",color:"#003300"}}>5× Letter Bonus Applied!</div>
            <div style={{fontSize:ipadIntro(14),fontWeight:"bold",color:"#003300",marginTop:4}}>+{lootCelebration.score} pts on this word</div>
          </div>
        </div>
      )}

      {showBadge&&(()=>{ const b=BADGE_DEFS.find(x=>x.id===showBadge); return b?(<div style={{position:"fixed",top:72,left:"50%",zIndex:9998,animation:"badgePop 5s forwards",background:"linear-gradient(135deg,#f6d365,#fda085)",borderRadius:20,padding:`${ipadTour(12)}px ${ipadTour(26)}px`,boxShadow:"0 8px 32px rgba(0,0,0,0.7)",textAlign:"center",whiteSpace:"nowrap"}}>
        <div style={{display:"flex",justifyContent:"center"}}>{renderBadgeIcon(b)}</div>
        <div style={{fontWeight:"bold",color:"#1a1a2e",fontSize:ipadTour(13)}}>Badge Earned!</div>
        <div style={{color:"#2d1b00",fontSize:ipadTour(12),fontWeight:"bold"}}>{b.label}{showBadgeExtra?` — ${showBadgeExtra}`:""}</div>
      </div>):null; })()}

      {flash&&<div style={{position:"fixed",top:"40%",left:"50%",zIndex:9997,animation:"pop 0.3s ease forwards",background:flash.valid?(flash.medical?"rgba(0,150,200,0.97)":"rgba(30,160,70,0.97)"):"rgba(190,30,30,0.96)",borderRadius:18,padding:`${ipadTour(14)}px ${ipadTour(30)}px`,boxShadow:"0 6px 28px rgba(0,0,0,0.7)",textAlign:"center"}}>
        <div style={{fontSize:ipadTour(20),fontWeight:"bold",letterSpacing:3,color:"#fff"}}>{flash.word}</div>
        <div style={{fontSize:flash.valid?ipadTour(16):ipadTour(13),color:"#fff",marginTop:4}}>{flash.valid&&flash.score>0?`+${flash.score} pts ${flash.medical?"🩺 Medical":flash.collegiate?"📖":""}`:flash.valid?"":("Not a valid word!")}</div>
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
          <button className="ll-btn" onClick={()=>{ setShowWotdMissedPD(false); triggerFarewell(); }} style={{width:"100%",padding:ipadTour(13),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(14),fontWeight:"bold",border:"none",cursor:"pointer"}}>
            See My Results →
          </button>
        </div>
      </div>}

      {/* v91: Perfect Day pirate+leprechaun DANCE celebration — full-screen overlay that
          plays first (rise → dance → sparkles), auto-dismisses after ~5.2s, revealing the
          stats modal beneath. zIndex above the PD modal (9500). */}
      {showPirateDance&&<div style={{position:"fixed",inset:0,zIndex:9600,background:"rgba(10,8,30,0.92)",overflow:"hidden",animation:"pdFlash 1.4s ease"}}>
        {/* sparkles scattered around the dancers */}
        {Array.from({length:18}).map((_,i)=>(
          <div key={i} style={{position:"absolute",left:`${8+Math.random()*84}%`,bottom:`${20+Math.random()*55}%`,fontSize:`${20+Math.random()*18}px`,opacity:0,animation:`pdSparkleFloat ${1.1+Math.random()*0.8}s ease ${0.3+Math.random()*3.5}s forwards`,pointerEvents:"none"}}>{["✨","⭐","💫","🌟","🎉"][i%5]}</div>
        ))}
        <div style={{position:"absolute",top:"16%",left:0,right:0,textAlign:"center",fontSize:ipadTour(26),fontWeight:"bold",letterSpacing:1}} className="perfect-text">PERFECT DAY! 🌈</div>
        <img src="/perfect-day-pirates.png" alt="" style={{position:"absolute",left:"50%",bottom:"-380px",transform:"translateX(-50%)",width:ipadTour(280),height:"auto",pointerEvents:"none",filter:"drop-shadow(0 8px 16px rgba(0,0,0,0.6))",animation:"pdPiratesRise 0.7s cubic-bezier(.34,1.56,.64,1) 0.1s forwards, pdPiratesJig 1.0s ease 1.0s 3 forwards, pdPiratesOut 0.6s ease-in 4.4s forwards"}}/>
      </div>}

      {perfectDayAchieved&&!showPirateDance&&<div style={{position:"fixed",inset:0,zIndex:9500,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",overflowY:"auto"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:28,padding:`${ipadTour(32)}px ${ipadTour(28)}px`,textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:"2px solid rgba(255,215,0,0.5)",maxWidth:ipadTour(340),width:"90%",margin:"20px auto"}}>
          {/* Title row: PERFECT DAY! 🌈 + PotOfGold inline */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:0,marginBottom:6,flexWrap:"nowrap"}}>
            <div style={{fontSize:ipadTour(22),fontWeight:"bold",whiteSpace:"nowrap"}} className="perfect-text">PERFECT DAY! 🌈</div>
            <PotOfGold size={ipadTour(48)}/>
          </div>
          {/* Bonus inline accent under title — hidden for Guests since they
              do not receive the +2,000 PD bonus or streak bonuses. The
              upsell popup after Now/Later/Tomorrow tells them about it. */}
          {!isGuest&&<div style={{fontSize:ipadTour(14),color:"#fda085",fontWeight:"bold",marginBottom:10}}>Bonus: +2,000 pts</div>}
          {/* Tagline - shrunk font size so the 10 rotating taglines fit 1-2 lines naturally */}
          <div style={{fontSize:ipadTour(12),color:"#f5f0e8",marginBottom:14,lineHeight:1.5,fontStyle:"italic"}}>"{congratsMsg}"</div>
          {/* Stats - 2 rows (was 4) with dot separators */}
          <div style={{background:"rgba(255,255,255,0.08)",borderRadius:12,padding:`${ipadTour(10)}px ${ipadTour(12)}px`,fontSize:ipadTour(12),color:"#f5f0e8",lineHeight:1.6,marginBottom:ipadTour(10)}}>
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
          <div style={{fontSize:ipadTour(11),color:"rgba(255,255,255,0.9)",lineHeight:1.5,marginTop:12,marginBottom:14}}>Perfect Days are tracked daily toward your total — but every one is worth celebrating!</div>
          {/* Action buttons - Leaderboard + Share Perfect Day side by side
              v59: Leaderboard button is LOCKED for Guests. Dimmed colors,
              🔒 icon, tap → Guest Upsell modal. Visible reminder of what
              they're missing. */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
            <button className="ll-btn" onClick={()=>{
              if (isGuest) { setPerfectDayAchieved(false); setShowGuestUpsell(true); return; }
              markPDAcknowledged(); setLeaderboardFromPerfectDay(true); setPerfectDayAchieved(false); setTab('leaderboard');
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
              <button className="ll-btn replay-btn" onClick={()=>{ markPDAcknowledged(); setPerfectDayAchieved(false); handleFullReset({skipWelcome:true}); }} style={{flex:1,padding:ipadTour(10),borderRadius:10,background:"linear-gradient(135deg,#00c853,#00e676)",color:"#003300",fontSize:ipadTour(12),fontWeight:"bold",border:"none"}}>✏️ Now</button>
              <button className="ll-btn" onClick={()=>{ markPDAcknowledged(); setPerfectDayAchieved(false); setShowIntro(true); }} style={{flex:1,padding:ipadTour(10),borderRadius:10,background:"linear-gradient(135deg,rgba(96,165,250,0.3),rgba(59,130,246,0.2))",border:"1px solid rgba(96,165,250,0.6)",color:"#dbeafe",fontSize:ipadTour(12),fontWeight:"bold"}}>🌅 Later</button>
            </div>
          </div>
        </div>
      </div>}

      {showRepeatPerfect&&<div style={{position:"fixed",inset:0,zIndex:9500,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",overflowY:"auto"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:28,padding:`${ipadTour(32)}px ${ipadTour(28)}px`,textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:"2px solid rgba(255,215,0,0.5)",maxWidth:ipadTour(340),width:"90%",margin:"20px auto"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:4}}><RainbowPot size={ipadTour(130)}/></div>
          <div style={{fontSize:ipadTour(24),fontWeight:"bold",marginTop:8}} className="perfect-text">PERFECT DAY!</div>
          <div style={{fontSize:ipadTour(13),color:"#f5f0e8",marginTop:10,lineHeight:1.7,fontStyle:"italic"}}>"{congratsMsg}"</div>
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
            markPDAcknowledged(); setLeaderboardFromPerfectDay(true); setShowRepeatPerfect(false); setTab('leaderboard');
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
            <button className="ll-btn replay-btn" onClick={()=>{ markPDAcknowledged(); setShowRepeatPerfect(false); handleFullReset({skipWelcome:true}); }} style={{flex:1,padding:`${ipadTour(11)}px ${ipadTour(4)}px`,borderRadius:12,background:"linear-gradient(135deg,#00c853,#00e676)",color:"#003300",fontSize:ipadTour(12),fontWeight:"bold",border:"none"}}>✏️ Now</button>
            <button className="ll-btn" onClick={()=>{ markPDAcknowledged(); setShowRepeatPerfect(false); setShowIntro(true); }} style={{flex:1,padding:`${ipadTour(11)}px ${ipadTour(4)}px`,borderRadius:12,background:"linear-gradient(135deg,rgba(96,165,250,0.3),rgba(59,130,246,0.2))",border:"1px solid rgba(96,165,250,0.6)",color:"#bfdbfe",fontSize:ipadTour(12),fontWeight:"bold"}}>🌅 Later</button>
          </div>
        </div>
      </div>}

      {levelComplete&&<div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:`${ipadTour(36)}px ${ipadTour(32)}px`,textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,215,0,0.35)",maxWidth:ipadTour(320),width:"90%"}}>
          {/* v94: celebrating pirate with a per-level entrance animation + level-specific saying */}
          {/* v104: mascot image + saying gated behind showMascotCelebrations(); results below always show */}
          {showMascotCelebrations() && (()=>{
            // v109: speech bubble above the mascot's head, replacing the old caption-below.
            // Geometry locked in the lab (bubbleWidthPct=115, gap≈10px@162 → fraction, textTop=16%, textHeight=54%).
            // Source PNG is square with transparent margin; solid bubble crops to 1.44:1 (w:h).
            const pw = ipadTour(120);                     // rendered pirate width
            const bw = pw * 1.15;                          // bubbleWidthPct=115
            const cropWR = 786/1024, cropHR = 546/1024;   // solid-bubble fraction of the square img
            const solidBottomFrac = (1 + cropHR)/2;       // ~0.766 within the square
            const marginBelow = bw * (1 - solidBottomFrac);
            const gap = pw * (10/162);                     // lab gap normalized to pirate width (≈17px @ iPad)
            const bubbleTop = -bw + marginBelow - gap;     // tail tip sits `gap` above top of head
            const cropLeftFrac = (1 - cropWR)/2, cropTopFrac = (1 - cropHR)/2;
            const zLeft = (cropLeftFrac + (9.4/100)*cropWR) * 100;
            const zWidth = (81.7/100) * cropWR * 100;
            const zTop = (cropTopFrac + (16/100)*cropHR) * 100;   // textTopPct=16
            const zHeight = (54/100) * cropHR * 100;              // textHeightPct=54
            const line = clearSayingText || pickClearSaying(level, Math.max(0, clearSayingIdxRef.current));
            return (
              <div style={{position:"relative",display:"inline-block",marginBottom:4}}>
                {/* speech bubble overlay — absolute, above head */}
                <div style={{position:"absolute",left:"50%",top:bubbleTop,width:bw,transformOrigin:"bottom center",pointerEvents:"none",animation:"bubbleIn 0.55s cubic-bezier(.34,1.56,.64,1) 0.35s both",zIndex:2}}>
                  <img src="/Speech_Bubble.png" alt="" style={{display:"block",width:"100%",height:"auto"}}/>
                  <div style={{position:"absolute",left:`${zLeft}%`,top:`${zTop}%`,width:`${zWidth}%`,height:`${zHeight}%`,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",color:"#5a3a12",fontFamily:"Georgia,serif",fontWeight:"bold",lineHeight:1.15,fontSize:ipadTour(11),overflow:"hidden",wordBreak:"break-word"}}>{line}</div>
                </div>
                <img key={level} src={PIRATE_CLEAR_IMG[level]||"/pirate-cheer.png"} alt="" style={{display:"block",width:pw,height:"auto",filter:"drop-shadow(0 6px 12px rgba(0,0,0,0.5))",animation:`${PIRATE_CLEAR_ANIM[level]||"plClearL1"} 0.9s cubic-bezier(.34,1.56,.64,1) forwards`}}/>
              </div>
            );
          })()}
          <div style={{fontSize:ipadTour(26),fontWeight:"bold",color:"#f6d365",marginTop:8}}>Level {level} Complete!</div>
          <div style={{fontSize:ipadTour(13),color:"#ccc",marginTop:8}}>You used every tile!</div>
          <div style={{fontSize:ipadTour(22),color:"#fda085",fontWeight:"bold",marginTop:10}}>+{100*level} Bonus Points!</div>
          <div style={{fontSize:ipadTour(13),color:"#60a5fa",fontWeight:"bold",marginTop:6}}>⏱️ Time: {formatTime(levelTimeRef.current)}</div>
          {newBestTime&&<div style={{fontSize:ipadTour(12),color:"#6ee7b7",fontWeight:"bold",marginTop:4}}>⚡ New Best Time!</div>}
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

        {/* ROW 1: Name · Date · Tour */}
        <div style={{display:"flex",alignItems:"center",gap:ipadChrome(3),marginBottom:ipadChrome(3)}}>
          <span style={{fontSize:isIpadWidth()?21:11,color:"#22d3ee",fontWeight:"bold",whiteSpace:"nowrap",flexShrink:0,border:"1.5px solid rgba(34,211,238,0.6)",borderRadius:8,padding:`${ipadChrome(1)}px ${ipadChrome(7)}px`,background:"rgba(34,211,238,0.1)"}}>{playerName||"Guest"}</span>
          <span style={{flex:1,fontSize:isIpadWidth()?21:11,color:"rgba(255,255,255,0.95)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textAlign:"center"}}>{getCalendarDate()}</span>
          {tab==="play" && <button onClick={()=>setShowTour(true)} style={{background:"rgba(167,139,250,0.25)",border:"1.5px solid rgba(167,139,250,0.7)",borderRadius:12,padding:`${ipadChrome(3)}px ${ipadChrome(10)}px`,cursor:"pointer",fontSize:isIpadWidth()?21:10,color:"#e0d4ff",fontFamily:"Georgia,serif",fontWeight:"bold",flexShrink:0}}>↺ Tour</button>}
        </div>

        {/* ROW 2: Replay Level# · Buy Level#+1 — only on play tab (Start New Game removed v103) */}
        {tab==="play" && (
        <div style={{display:"flex",gap:3,marginBottom:3}}>
          <button className="ll-btn" onClick={()=>!paused&&setShowResetConfirm(true)} style={{flex:1,padding:`${ipadChrome(7)}px ${ipadChrome(4)}px`,borderRadius:9,fontSize:ipadChrome(10),background:"rgba(96,165,250,0.15)",border:"1px solid rgba(96,165,250,0.55)",color:"#bfdbfe",textAlign:"center",fontFamily:"Georgia,serif",fontWeight:"bold"}}>{level===5?"🔄 Replay Level 5":"🔄 Replay Level "+level}</button>
          {level<5&&<button className="ll-btn" onClick={()=>setShowBuyModal(true)} style={{flex:1,padding:`${ipadChrome(7)}px ${ipadChrome(4)}px`,borderRadius:9,fontSize:ipadChrome(10),background:canBuy?"rgba(246,211,101,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${canBuy?"rgba(246,211,101,0.55)":"rgba(255,255,255,0.12)"}`,color:canBuy?"#fef08a":"rgba(255,255,255,0.3)",textAlign:"center",fontFamily:"Georgia,serif",fontWeight:"bold"}}>🔓 Buy Level {level+1} — {buyCost} pts</button>}
        </div>
        )}

        {/* ROW 3: L5 · TIME · Level 00:00 · Total 00:00 · Pause — only on play tab */}
        {tab==="play" && (<>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.07)",borderRadius:7,padding:`${ipadChrome(3)}px ${ipadChrome(8)}px`,marginBottom:3,border:"1px solid rgba(255,255,255,0.18)",gap:4}}>
          <span style={{padding:`${ipadChrome(2)}px ${ipadChrome(8)}px`,borderRadius:10,fontSize:ipadChrome(9),fontWeight:"bold",background:"rgba(139,92,246,0.22)",border:"1.5px solid rgba(167,139,250,0.7)",color:"#e9d5ff",whiteSpace:"nowrap",letterSpacing:1,flexShrink:0}}>✦ L{level} ✦</span>
          <span style={{fontSize:ipadChrome(9),color:"rgba(255,255,255,0.7)",fontWeight:"bold",letterSpacing:1,flexShrink:0}}>TIME</span>
          <span style={{fontSize:ipadChrome(8),color:"rgba(255,255,255,0.5)",flexShrink:0}}>Level</span>
          <span className={pulseTime?"pulse-big":""} style={{fontSize:ipadChrome(12),fontWeight:"bold",color:"#60a5fa",fontFamily:"monospace",flexShrink:0}}>{formatTime(levelTime)}</span>
          <span style={{fontSize:ipadChrome(8),color:"rgba(255,255,255,0.5)",flexShrink:0}}>Total</span>
          <span style={{fontSize:ipadChrome(12),fontWeight:"bold",color:"#a78bfa",fontFamily:"monospace",flexShrink:0}}>{formatTime(totalTime)}</span>
          <button className="ll-btn" onClick={handlePause} style={{background:paused?"linear-gradient(135deg,#00c853,#00e676)":"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:10,padding:`${ipadChrome(2)}px ${ipadChrome(8)}px`,fontSize:ipadChrome(9),color:paused?"#003300":"#ffffff",fontWeight:"bold",flexShrink:0}}>
            {paused?"▶️ Resume":"⏸️ Pause"}
          </button>
        </div>
        </>)}

        {/* ROW 4: Remaining · Vowels · Consonants · UNDO — only on play tab */}
        {tab==="play" && (
        <div style={{display:"flex",gap:4,marginBottom:3}}>
          <div style={{flex:1.4,background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.4)",borderRadius:8,padding:`${ipadChrome(3)}px ${ipadChrome(3)}px`,textAlign:"center"}}>
            <div style={{fontSize:ipadChrome(12),fontWeight:"bold",color:"#60a5fa"}}>{availableTiles.length}</div>
            <div style={{fontSize:ipadChrome(8),color:"rgba(255,255,255,0.95)",fontWeight:"bold",letterSpacing:0.5}}>{isIpadWidth()?"REMAINING LETTERS":"REMAINING"}</div>
          </div>
          <div style={{flex:1,background:"rgba(110,231,183,0.08)",border:"1px solid rgba(110,231,183,0.35)",borderRadius:8,padding:`${ipadChrome(3)}px ${ipadChrome(3)}px`,textAlign:"center"}}>
            <div style={{fontSize:ipadChrome(12),fontWeight:"bold",color:"#6ee7b7"}}>{vowelsRemaining}</div>
            <div style={{fontSize:ipadChrome(8),color:"rgba(255,255,255,0.95)",fontWeight:"bold",letterSpacing:0.5}}>VOWELS</div>
          </div>
          <div style={{flex:1,background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.35)",borderRadius:8,padding:`${ipadChrome(3)}px ${ipadChrome(3)}px`,textAlign:"center"}}>
            <div style={{fontSize:ipadChrome(12),fontWeight:"bold",color:"#a78bfa"}}>{consonantsRemaining}</div>
            <div style={{fontSize:ipadChrome(8),color:"rgba(255,255,255,0.95)",fontWeight:"bold",letterSpacing:0.5}}>CONSON.</div>
          </div>
          <button className="ll-btn" onClick={()=>{ if(!undoUsed&&lastValidEntry&&totalRef.current>=1000) setShowUndoConfirm(true); }}
            disabled={undoUsed||!lastValidEntry||totalRef.current<1000||paused}
            style={{flex:2,padding:`${ipadChrome(3)}px ${ipadChrome(4)}px`,borderRadius:8,fontSize:ipadChrome(9),background:!undoUsed&&lastValidEntry&&totalRef.current>=1000&&!paused?"linear-gradient(135deg,rgba(251,113,133,0.6),rgba(225,29,72,0.5))":"rgba(255,255,255,0.05)",border:`1px solid ${!undoUsed&&lastValidEntry&&totalRef.current>=1000&&!paused?"rgba(251,113,133,0.9)":"rgba(255,255,255,0.25)"}`,color:!undoUsed&&lastValidEntry&&totalRef.current>=1000&&!paused?"#ffffff":"rgba(255,255,255,0.85)",textAlign:"center",fontWeight:"bold",fontFamily:"Georgia,serif",lineHeight:1.2}}>
            {undoUsed?"↩️ UNDO Used":(totalRef.current>=1000?`↩️ UNDO — 1,000 pts`:<span>↩️ UNDO at <span style={{color:"#fda085"}}>1,000 pts</span></span>)}
          </button>
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
        </div>
      )}

      {/* ── PLAY TAB ── */}
      {tab==="play"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:ipadBoardW()||ipadW(480),padding:isIpadWidth()?"0 0 6px":"0 10px 6px",animation:"slideUp 0.3s ease"}}>

          {/* ROW 5: Submit Word · SCORE · Clear · Menu — Replay/Buy moved to Row 2 above tile board, UNDO moved to Row 4 */}
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
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.05)",borderRadius:8,padding:`${ipadWord(4)}px ${ipadWord(8)}px`,marginBottom:3,border:"1.5px solid rgba(255,255,255,0.8)",minHeight:ipadWord(30),animation:shake?"shake 0.4s ease":"none"}}>
            <div style={{display:"flex",gap:3,alignItems:"center",flex:1,flexWrap:"wrap"}}>
              {selected.length===0
                ?<div style={{color:"rgba(255,255,255,0.6)",fontSize:ipadWord(10),fontStyle:"italic"}}>Tap tiles to build a word…</div>
                :selected.map(id=>{ const tile=tiles.find(t=>t.id===id); return(
                  <div key={id} onClick={()=>!validating&&!paused&&setSelected(prev=>prev.filter(i=>i!==id))} style={{background:tile?.bonus==="triple"?"linear-gradient(135deg,#e040fb,#7b1fa2)":tile?.bonus==="double"?"linear-gradient(135deg,#ffd700,#f57c00)":"linear-gradient(135deg,#5c6bc0,#512da8)",borderRadius:5,padding:`${ipadWord(3)}px ${ipadWord(6)}px`,fontSize:ipadWord(14),fontWeight:"bold",color:"#fff",cursor:"pointer",lineHeight:1}}>{tile?.letter}</div>
                );})
              }
            </div>
            {currentWord.length>0&&(
              <div style={{textAlign:"right",marginLeft:6,flexShrink:0}}>
                <div style={{fontSize:ipadWord(11),color:"#f6d365",fontWeight:"bold"}}>+{currentScore}{getLongWordBonus(currentWord.length)>0&&<span style={{color:"#6ee7b7",fontSize:ipadWord(9)}}> +{getLongWordBonus(currentWord.length)}!</span>}</div>
                <div style={{fontSize:ipadWord(7),color:"rgba(255,255,255,0.4)"}}>{currentWord.length} ltrs</div>
              </div>
            )}
            {/* (v106) Persistent Loot Letter reminder — Option B block pinned at the strip's right edge */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,marginLeft:ipadWord(6),flexShrink:0,background:"linear-gradient(135deg,rgba(246,211,101,0.16),rgba(253,160,133,0.12))",border:"1.5px solid rgba(246,211,101,0.55)",borderRadius:8,padding:`${ipadWord(3)}px ${ipadWord(7)}px`}}>
              <span style={{fontSize:ipadWord(6),color:"#fde68a",fontWeight:"bold",letterSpacing:0.5,whiteSpace:"nowrap"}}>💥 LOOT</span>
              <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:ipadWord(20),height:ipadWord(20),padding:`0 ${ipadWord(3)}px`,borderRadius:5,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadWord(14),fontWeight:"bold",lineHeight:1,boxShadow:"0 0 8px rgba(246,211,101,0.5)"}}>{getLootLetterForLevel(level)}</span>
            </div>
          </div>

          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"6px 4px",border:"1px solid rgba(255,255,255,0.18)",position:"relative"}}>
            {paused&&<div style={{position:"absolute",inset:0,borderRadius:12,background:"rgba(0,0,0,0.82)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:5,backdropFilter:"blur(2px)"}}>
              <div style={{fontSize:40,marginBottom:8}}>⏸️</div>
              <div style={{fontSize:24,fontWeight:"bold",color:"#f6d365",letterSpacing:2}}>Paused</div>
              <button className="ll-btn" onClick={handlePause} style={{marginTop:18,padding:"12px 32px",borderRadius:14,background:"linear-gradient(135deg,#00c853,#00e676)",color:"#003300",fontSize:15,fontWeight:"bold",border:"none",cursor:"pointer",fontFamily:"Georgia,serif",boxShadow:"0 0 20px rgba(0,200,83,0.5)"}}>▶️ Resume</button>
            </div>}
            {tileRows.map((row,ri)=>(
              <div key={ri} style={{display:"flex",justifyContent:"center",gap:ipadTile(3,level),marginBottom:ipadTile(3,level)}}>
                {row.map(tile=>{ const isSel=selected.includes(tile.id); const isDouble=tile.bonus==="double"; const isTriple=tile.bonus==="triple"; const isLootUsed=tile.lootUsed; return(
                  <div key={tile.id} className={`ll-tile${isSel?" sel":""}${tile.used?" used":""}${isDouble?" bonus-double":""}${isTriple?" bonus-triple":""}${isLootUsed?" loot-used":""}${paused?" paused-tile":""}`} onClick={()=>!tile.used&&!validating&&!paused&&(awaitingFirstTapRef.current&&(awaitingFirstTapRef.current=false,setAwaitingFirstTap(false)),triggerHaptic("light"),setSelected(prev=>prev.includes(tile.id)?prev.filter(i=>i!==tile.id):[...prev,tile.id]))} style={{width:ipadTileW(38,level),height:ipadTile(44,level),background:isLootUsed?"linear-gradient(135deg,#f6d365,#fda085)":tile.used?"rgba(255,255,255,0.02)":isSel?"linear-gradient(135deg,#5c6bc0,#512da8)":isTriple?"linear-gradient(135deg,rgba(224,64,251,0.35),rgba(123,31,162,0.25))":isDouble?"linear-gradient(135deg,rgba(255,215,0,0.35),rgba(245,124,0,0.25))":"linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.07))",borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:isLootUsed?"2px solid #00e676":isSel?"2px solid #9fa8da":isTriple?"1px solid rgba(224,64,251,0.7)":isDouble?"1px solid rgba(255,215,0,0.7)":"1px solid rgba(255,255,255,0.22)",boxShadow:isLootUsed?"0 0 12px rgba(246,211,101,0.6),0 0 4px rgba(0,230,118,0.5)":isSel?`0 0 ${ipadTile(12,level)}px ${ipadTile(3,level)}px rgba(0,230,118,0.85), 0 0 ${ipadTile(4,level)}px rgba(0,230,118,0.5)`:"none",position:"relative"}}>
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
                                  .insert({ word: s.word.toLowerCase(), player_name: playerName||"Guest" })
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
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:ipadDense(12),marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:3,marginBottom:10}}>📈 DAILY SCORES</div>
            <div style={{display:"flex",justifyContent:"space-around",marginBottom:10}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:ipadDense(17),fontWeight:"bold",color:"#fda085"}}>{statsData.highScoreToday||"—"}</div><div style={{fontSize:ipadDense(9),color:"rgba(255,255,255,0.9)"}}>Today</div></div>
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
            {[{id:"scores",label:"💰 Scores"},{id:"words",label:"💎 Word Scores"},{id:"longest",label:"📏 Longest Words"},{id:"perfect",label:"🌈🏆 Perfect"},{id:"streaks",label:"🔥 Streaks"}].map(t=>(
              <button key={t.id} className="ll-tab" onClick={()=>setLeaderboardTab(t.id)} style={{flex:1,padding:`${ipadMenu(4)}px ${ipadMenu(2)}px`,borderRadius:10,fontSize:ipadMenu(8),background:leaderboardTab===t.id?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.08)",color:leaderboardTab===t.id?"#1a1a2e":"#f0e8d8",fontWeight:leaderboardTab===t.id?"bold":"normal",border:leaderboardTab===t.id?"none":"1px solid rgba(255,255,255,0.2)",whiteSpace:"nowrap",textAlign:"center"}}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Period tabs — only show for non-streaks (streaks is lifetime-only) */}
          {leaderboardTab!=="streaks"&&(
            <div style={{display:"flex",gap:3,marginBottom:8}}>
              {[{id:"daily",label:"☀️ Today"},{id:"weekly",label:"📅 This Week"},{id:"alltime",label:"🏆 All-Time"}].map(p=>(
                <button key={p.id} className="ll-tab" onClick={()=>setLeaderboardPeriod(p.id)} style={{flex:1,padding:`${ipadMenu(4)}px ${ipadMenu(2)}px`,borderRadius:10,fontSize:ipadMenu(9),background:leaderboardPeriod===p.id?"linear-gradient(135deg,#a78bfa,#7c3aed)":"rgba(255,255,255,0.06)",color:leaderboardPeriod===p.id?"#fff":"rgba(255,255,255,0.9)",fontWeight:leaderboardPeriod===p.id?"bold":"normal",border:leaderboardPeriod===p.id?"none":"1px solid rgba(255,255,255,0.15)",textAlign:"center"}}>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {leaderboardLoading&&<div style={{textAlign:"center",padding:ipadMenu(30),color:"rgba(255,255,255,0.4)",fontSize:ipadMenu(12)}}>Loading leaderboard…</div>}
          {!leaderboardLoading&&!leaderboardData&&<div style={{textAlign:"center",padding:ipadMenu(30),color:"rgba(255,255,255,0.3)",fontSize:ipadMenu(11),fontStyle:"italic"}}>Could not load leaderboard. Check your connection.</div>}

          {!leaderboardLoading&&leaderboardData&&(()=>{
            const { gs=[], todaySessions=[], weekSessions=[], wotdAllSessions=[], allWordSessions=[] } = leaderboardData;
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
                            <div style={{fontSize:ipadMenu(9),color:isMe(r.name)?"#22d3ee":"rgba(255,255,255,0.4)",marginTop:1}}>{r.name||"Guest"}{isMe(r.name)&&" ← you"}{r.date&&<span style={{color:"rgba(255,255,255,0.35)",marginLeft:6}}>· {formatDateKey(r.date)}</span>}</div></>
                        : <><span style={{fontSize:ipadMenu(12),fontWeight:"bold",color:isMe(r.name)?"#22d3ee":"#f5f0e8"}}>{r.name||"Guest"}</span>
                            {isMe(r.name)&&<span style={{fontSize:ipadMenu(9),color:"#22d3ee",marginLeft:4}}>← you</span>}
                            {r.sub&&<div style={{fontSize:ipadMenu(9),color:"#fda085",marginTop:1}}>{r.sub}</div>}</>
                      }
                    </div>
                    <div style={{textAlign:"right"}}>
                      <span style={{fontSize:ipadMenu(15),fontWeight:"bold",color:r.valColor||"#f6d365"}}>{r.val}</span>
                      {r.suffix&&<span style={{fontSize:ipadMenu(9),color:"rgba(255,255,255,0.35)",marginLeft:2}}>{r.suffix}</span>}
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
            <button className="ll-btn" onClick={()=>{ setLeaderboardData(null); setLeaderboardLoading(true); fetchLeaderboard().then(d=>{ setLeaderboardData(d); setLeaderboardLoading(false); }); }} style={{flex:1,padding:ipadMenu(7),borderRadius:12,background:"rgba(167,139,250,0.2)",border:"1px solid rgba(167,139,250,0.7)",color:"#c4b5fd",fontSize:ipadMenu(10),fontWeight:"bold"}}>↺ Refresh</button>
            <button className="ll-btn" onClick={()=>{ if(leaderboardFromPerfectDay){ setLeaderboardFromPerfectDay(false); setPerfectDayAchieved(true); setTab("play"); } else { setTab("menu"); } }} style={{flex:2,padding:ipadMenu(10),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadMenu(12),fontWeight:"bold",border:"none"}}>{leaderboardFromPerfectDay?"🌈 Back to Perfect Day":"← Back to Menu"}</button>
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
          <button className="ll-btn replay-btn" onClick={()=>{ setShowReadyToPlay(false); stopTimer(); setAwaitingFirstTap(true); awaitingFirstTapRef.current = true; if (wotd && !wotdFound) showWotdReminderWithPause(); }} style={{marginTop:20,width:"100%",padding:ipadTour(16),borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(16),fontWeight:"bold",border:"none"}}>
            Let's Go! 🎯
          </button>
        </div>
      </div>}

    </div>
  );
}
