// Boot cleanup — runs before React mounts
try {
  const _sess = JSON.parse(localStorage.getItem("ll_session") || "null");
  if (_sess && _sess.level === 5) { localStorage.removeItem("ll_session"); }
} catch(e) {}

import { useState, useCallback, useRef, useEffect } from "react";
import { supabase, signUp, signIn, signOut, resetPassword, getSession, loadGameState, saveGameState, loadDailySession, saveDailySession, updatePlayerName, savePlayerPhoto, loadPlayerPhoto } from "./supabase";

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
  // How many consecutive perfect days (approximated via streak + perfectDaysWeek)
  return Math.min(statsData.currentStreak || 0, statsData.perfectDaysAllTime || 0);
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
function generateLevelTiles(level, startId, rng, bonusPositions) {
  const pool = buildPool(rng);
  const count = 42 + (level - 1) * 6;
  let letters = pool.slice(0, count);
  if (letters.includes("Q") && !letters.includes("U")) {
    const replaceIdx = letters.findIndex(l => !["Q","A","E","I","O","U"].includes(l));
    if (replaceIdx !== -1) letters[replaceIdx] = "U";
  }
  return letters.map((l, i) => ({
    id: startId + i, letter: l, value: LETTER_VALUES[l], used: false,
    bonus: bonusPositions.includes(i) ? (Math.random() < 0.5 ? "double" : "triple") : null,
  }));
}
function calcWordScore(tileIds, tiles) {
  let score = 0;
  tileIds.forEach(id => {
    const tile = tiles.find(t => t.id === id);
    if (!tile) return;
    if (tile.bonus === "double") score += tile.value * 2;
    else if (tile.bonus === "triple") score += tile.value * 3;
    else score += tile.value;
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
  { id:"first_word",   icon:"✨", label:"First Loot",      desc:"Submit your first word",                cat:"core",    scope:"lifetime" },
  { id:"rocket",       icon:"🚀", label:"Rocket",          desc:"Score 100+ in one word",                cat:"core",    scope:"lifetime" },
  { id:"shuttle",      icon:"🛸", label:"Space Shuttle",   desc:"Score 125+ in one word",                cat:"core",    scope:"lifetime" },
  { id:"moon",         icon:"🌙", label:"Moon",            desc:"Score 150+ in one word",                cat:"core",    scope:"lifetime" },
  { id:"mars",         icon:"🔴", label:"Mars",            desc:"Score 175+ in one word",                cat:"core",    scope:"lifetime" },
  { id:"jupiter",      icon:"🪐", label:"Jupiter",         desc:"Score 200+ in one word",                cat:"core",    scope:"lifetime" },
  { id:"infinity",     icon:"∞",  label:"Infinity",        desc:"Score 200+ pts — shows your best!",     cat:"core",    scope:"lifetime" },
  { id:"century",      icon:"💰", label:"Century",         desc:"Score 100+ in one word",                cat:"core",    scope:"all" },
  { id:"score_200",    icon:"🚀", label:"Rocket (Legacy)", desc:"Score 200+ in one word",                cat:"core",    scope:"lifetime" },
  { id:"long_word",    icon:"📏", label:"Long Haul",       desc:"Use 7+ letters in a word",              cat:"core",    scope:"lifetime" },
  { id:"streak_3",     icon:"⚡", label:"Streak x3",       desc:"3 valid words in a row",                cat:"core",    scope:"daily" },
  { id:"streak_5",     icon:"🌪️", label:"Streak x5",       desc:"5 valid words in a row",                cat:"core",    scope:"daily" },
  { id:"daily_500",    icon:"🏆", label:"Loot Master",     desc:"500+ total daily score",                cat:"core",    scope:"lifetime" },
  { id:"daily_1000",   icon:"💰", label:"Treasure Chest",  desc:"1000+ total daily score",               cat:"core",    scope:"lifetime" },
  { id:"perfect_q",    icon:"👑", label:"Q Master",        desc:"Use the letter Q",                      cat:"core",    scope:"daily" },
  { id:"vowel_rich",   icon:"🎵", label:"Vowel Rich",      desc:"Word with 4+ vowels",                   cat:"core",    scope:"lifetime" },
  { id:"medical_word", icon:"🩺", label:"Doctor's Orders", desc:"Use a medical dictionary word",         cat:"core",    scope:"lifetime" },
  { id:"long_8",       icon:"📖", label:"8 Letters",       desc:"Spell an 8-letter word",                cat:"core",    scope:"daily" },
  { id:"long_10",      icon:"📚", label:"10 Letters",      desc:"Spell a 10-letter word",                cat:"core",    scope:"daily" },
  { id:"long_13",      icon:"🧠", label:"Wordsmith",       desc:"Spell a 13+ letter word!",              cat:"core",    scope:"daily" },
  { id:"level_2",      icon:"🥈", label:"Level 2",         desc:"Reach Level 2",                         cat:"level",   scope:"lifetime" },
  { id:"level_3",      icon:"🥇", label:"Level 3",         desc:"Reach Level 3",                         cat:"level",   scope:"lifetime" },
  { id:"level_4",      icon:"🎖️", label:"Level 4",         desc:"Reach Level 4",                         cat:"level",   scope:"lifetime" },
  { id:"level_5",      icon:"💎", label:"Diamond",         desc:"Reach Level 5",                         cat:"level",   scope:"lifetime" },
  { id:"all_tiles_1",  icon:"🌟", label:"Clear L1",        desc:"Use all tiles on Level 1",              cat:"level",   scope:"lifetime" },
  { id:"all_tiles_2",  icon:"🌟", label:"Clear L2",        desc:"Use all tiles on Level 2",              cat:"level",   scope:"lifetime" },
  { id:"all_tiles_3",  icon:"🌟", label:"Clear L3",        desc:"Use all tiles on Level 3",              cat:"level",   scope:"lifetime" },
  { id:"all_tiles_4",  icon:"🌟", label:"Clear L4",        desc:"Use all tiles on Level 4",              cat:"level",   scope:"lifetime" },
  { id:"all_tiles_5",  icon:"🌟", label:"Clear L5",        desc:"Use all tiles on Level 5",              cat:"level",   scope:"lifetime" },
  { id:"perfect_day",  icon:"🌈🏆", label:"Perfect Day",     desc:"All 5 levels cleared, no buys!",        cat:"level",   scope:"lifetime" },
  { id:"speed_demon",  icon:"⏱️", label:"Speed Demon",     desc:"Complete a level in under 3 min",       cat:"word",    scope:"lifetime" },
  { id:"no_retreat",   icon:"🎗️", label:"No Retreat",      desc:"Complete level without resetting",      cat:"word",    scope:"lifetime" },
  { id:"longest_day",  icon:"🎯", label:"Daily Best",      desc:"Beat your longest word today",          cat:"word",    scope:"lifetime" },
  { id:"points_1k",    icon:"💫", label:"1K Points",       desc:"Accumulate 1,000 lifetime points",      cat:"alltime", scope:"lifetime" },
  { id:"points_5k",    icon:"⭐", label:"5K Points",       desc:"Accumulate 5,000 lifetime points",      cat:"alltime", scope:"lifetime" },
  { id:"points_10k",   icon:"🌠", label:"10K Points",      desc:"Accumulate 10,000 lifetime points",     cat:"alltime", scope:"lifetime" },
  { id:"streak_7",     icon:"🔥", label:"Week Streak",     desc:"Play 7 days in a row",                  cat:"alltime", scope:"lifetime" },
  { id:"streak_30",    icon:"👑", label:"Month Streak",    desc:"Play 30 days in a row",                 cat:"alltime", scope:"lifetime" },
  { id:"all_time_50",  icon:"🦁", label:"Veteran",         desc:"Submit 50 valid words all-time",        cat:"alltime", scope:"lifetime" },
  { id:"all_time_100", icon:"🐉", label:"Dragon",          desc:"Submit 100 valid words all-time",       cat:"alltime", scope:"lifetime" },
  // ── Bonus Level Badges (hidden until ENABLE_BONUS_LEVELS = true) ──
  { id:"vault_clear",    icon:"🏛️", label:"The Vault",       desc:"Clear Level 6 — The Vault",             cat:"bonus",   scope:"lifetime" },
  { id:"sanctum_clear",  icon:"💫", label:"The Sanctum",     desc:"Clear Level 7 — The Sanctum",           cat:"bonus",   scope:"lifetime" },
  { id:"summit_clear",   icon:"🏔️", label:"The Summit",      desc:"Clear Level 8 — The Summit",            cat:"bonus",   scope:"lifetime" },
  { id:"cosmos_clear",   icon:"🌌", label:"The Cosmos",      desc:"Clear Level 9 — The Cosmos",            cat:"bonus",   scope:"lifetime" },
  { id:"infinity_clear", icon:"∞",  label:"Infinity",        desc:"Clear Level 10 — Infinity",             cat:"bonus",   scope:"lifetime" },
  { id:"vault_streak",   icon:"🔱", label:"Streak Master",   desc:"3 consecutive Perfect Days",            cat:"bonus",   scope:"lifetime" },
];

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
async function validateWord(word) {
  const key = word.toLowerCase();
  if (wordCache[key] !== undefined) return wordCache[key];
  if (!navigator.onLine) { wordCache[key] = { valid: false, source: "offline" }; return wordCache[key]; }
  const fetchWithTimeout = (url, ms = 12000) => {
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
    await new Promise(r => setTimeout(r, 1000)); // wait 1 sec before retry
    result = await tryMW();
  }
  // If still timing out, use common words fallback so game stays playable
  if (result.source === "timeout") {
    result = { valid: COMMON_WORDS.has(key), source: "fallback" };
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

const TOUR_HTML_CONTENT = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\"/>\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no\"/>\n<title>LetterLoot Visual Tour</title>\n<style>\n*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}\nbody{background:#0a0820;font-family:Georgia,serif;color:#f5f0e8;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:16px;}\n.stars{position:fixed;inset:0;pointer-events:none;z-index:0;}\n.star{position:absolute;border-radius:50%;background:#fff;}\n.wrap{position:relative;z-index:1;width:100%;max-width:380px;display:flex;flex-direction:column;align-items:center;gap:10px;}\n.scene-box{width:100%;background:linear-gradient(135deg,#1a1040,#2d1b69);border-radius:24px;padding:20px;border:2px solid rgba(167,139,250,0.5);box-shadow:0 16px 60px rgba(0,0,0,0.8);}\n.dots{display:flex;gap:6px;justify-content:center;}\n.dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.2);transition:all 0.3s;cursor:pointer;}\n.dot.active{width:20px;background:#a78bfa;}\n.dot.done{background:rgba(167,139,250,0.5);}\n.scene-title{font-size:16px;font-weight:bold;color:#f6d365;margin-bottom:6px;text-align:center;}\n.scene-desc{font-size:13px;color:rgba(255,255,255,0.88);text-align:center;line-height:1.7;margin-bottom:14px;font-weight:bold;}\n.nav{display:flex;gap:10px;margin-top:16px;}\n.btn-back{flex:1;padding:10px;border-radius:12px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.5);font-family:Georgia,serif;font-size:12px;cursor:pointer;}\n.btn-next{flex:2;padding:12px;border-radius:12px;background:linear-gradient(135deg,#f6d365,#fda085);color:#1a1a2e;font-family:Georgia,serif;font-size:14px;font-weight:bold;border:none;cursor:pointer;}\n.btn-done{flex:2;padding:12px;border-radius:12px;background:linear-gradient(135deg,#00c853,#00e676);color:#003300;font-family:Georgia,serif;font-size:14px;font-weight:bold;border:none;cursor:pointer;}\n.tile{width:42px;height:48px;border-radius:8px;background:linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.07));border:1px solid rgba(255,255,255,0.22);display:inline-flex;flex-direction:column;align-items:center;justify-content:center;font-weight:bold;font-size:16px;color:#fff;transition:all 0.2s;position:relative;}\n.tv{font-size:7px;color:#fda085;font-weight:bold;}\n.tile.sel{background:linear-gradient(135deg,#5c6bc0,#512da8);border-color:#9fa8da;transform:translateY(-5px) scale(1.1);}\n.tile.dbl{box-shadow:0 0 12px 3px rgba(255,215,0,0.8);border-color:rgba(255,215,0,0.7);}\n.tile.trp{box-shadow:0 0 14px 4px rgba(255,100,255,0.9);border-color:rgba(224,64,251,0.7);}\n.tbv{font-size:7px;font-weight:bold;}\n.trow{display:flex;gap:5px;justify-content:center;margin-bottom:5px;}\n.wbox{width:100%;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.8);border-radius:8px;padding:8px 12px;min-height:36px;display:flex;align-items:center;gap:6px;margin:8px 0;position:relative;}\n.wl{background:linear-gradient(135deg,#5c6bc0,#512da8);border-radius:5px;padding:4px 7px;font-size:14px;font-weight:bold;color:#fff;}\n.ws{position:absolute;right:10px;font-size:12px;color:#f6d365;font-weight:bold;}\n.finger{position:absolute;font-size:26px;pointer-events:none;z-index:10;transition:left 0.35s ease,top 0.35s ease,opacity 0.3s;opacity:0;}\n.flash{position:absolute;top:20%;left:50%;transform:translate(-50%,-50%) scale(0);background:rgba(30,160,70,0.97);border-radius:16px;padding:12px 24px;font-size:18px;font-weight:bold;color:#fff;text-align:center;z-index:20;transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1);pointer-events:none;white-space:nowrap;}\n.flash.show{transform:translate(-50%,-50%) scale(1);}\n.dbtn{padding:6px 8px;border-radius:8px;font-size:9px;font-family:Georgia,serif;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#f0e8d8;cursor:pointer;transition:all 0.2s;white-space:nowrap;display:inline-block;margin:2px;}\n.dbtn.hl{border-color:#f6d365;background:rgba(246,211,101,0.2);color:#f6d365;transform:scale(1.08);}\n.dbtn.pb{background:linear-gradient(135deg,#f6d365,#fda085);color:#1a1a2e;font-weight:bold;border:none;}\n.dbtn.lp{background:rgba(139,92,246,0.22);border:1.5px solid rgba(167,139,250,0.7);color:#e9d5ff;font-weight:bold;}\n.callout{background:rgba(246,211,101,0.15);border:1.5px solid rgba(246,211,101,0.6);border-radius:12px;padding:10px 14px;font-size:12px;color:#f6d365;text-align:center;margin-top:10px;line-height:1.6;width:100%;display:none;}\n@keyframes rb{0%{color:#f00}16%{color:#f80}33%{color:#ff0}50%{color:#0f0}66%{color:#08f}83%{color:#80f}100%{color:#f00}}\n.rb{animation:rb 2s linear infinite;}\n@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(246,211,101,0.7);transform:scale(1)}50%{box-shadow:0 0 0 10px rgba(246,211,101,0);transform:scale(1.04)}}\n.btn-next.pulse{animation:pulse 1.2s ease-in-out infinite;}\n.btn-done.pulse{animation:pulse 1.2s ease-in-out infinite;}\n</style>\n</head>\n<body>\n<div class=\"stars\" id=\"stars\"></div>\n<div class=\"wrap\">\n\n  <div class=\"dots\" id=\"dots\"></div>\n  <div class=\"scene-box\" id=\"sb\"></div>\n</div>\n<script>\nvar sc=document.getElementById(\"stars\");\nfor(var i=0;i<50;i++){var s=document.createElement(\"div\");s.className=\"star\";var r=Math.random()*1.5+0.5;s.style.cssText=\"width:\"+(r*2)+\"px;height:\"+(r*2)+\"px;opacity:\"+(Math.random()*0.4+0.1)+\";left:\"+(Math.random()*100)+\"%;top:\"+(Math.random()*100)+\"%\";sc.appendChild(s);}\n\nvar cur=0;\n\nvar CL={\n  date:\"Shows today date -- tiles reset at midnight local time\",\n  music:\"Toggle background guitar music on or off\",\n  reset:\"Resets everything back to Level 1 -- WARNING: you will lose your Perfect Day status and streak bonus!\",\n  tour:\"Replays this visual walkthrough anytime\",\n  history:\"See every word played today, sorted by score\",\n  stats:\"Your scores, streaks, Perfect Days and personal records\",\n  tips:\"Hints and strategies to play smarter\",\n  leaders:\"Global Leaderboard -- Registered players only! Top Scores, Best Words, Longest Words, Perfect Days and Streaks\",\n  level:\"Shows your current level\",\n  pause:\"Stops your timer completely -- use it anytime you need a moment\",\n  share:\"Copy a link to share the game with friends\",\n  undo:\"Reverse your last word for 1,000 pts -- one use per game\",\n  submit:\"Checks your word against the Merriam-Webster dictionary\",\n  clear:\"Removes your tile selection without submitting\",\n  retry:\"Retry the current level with the same tiles -- forfeits Perfect Day\",\n  buy:\"Spend earned points to unlock the next level -- forfeits Perfect Day\"\n};\n\nfunction showC(k,el){\n  var c=document.getElementById(\"callout\");\n  if(!c)return;\n  c.style.display=\"block\";\n  c.textContent=CL[k]||\"\";\n  document.querySelectorAll(\".dbtn\").forEach(function(b){b.classList.remove(\"hl\");});\n  if(el)el.classList.add(\"hl\");\n}\n\nfunction s1(){\n  return \"<div style='text-align:center;padding:10px 0'>\"\n    +\"<div style='font-size:72px;margin-bottom:14px'>&#9999;&#65039;</div>\"\n    +\"<div style='font-size:13px;color:#f5f0e8;line-height:1.9'>Every day you get a <strong style='color:#f6d365'>fresh set of tiles</strong>.<br>Every letter has a <strong style='color:#fda085'>point value</strong>.<br>Spell words &middot; Score points &middot; Clear 5 levels<br>for a <strong class='rb'>PERFECT DAY! <svg viewBox='0 0 300 160' width='80' height='50' xmlns='http://www.w3.org/2000/svg' style='vertical-align:-12px;display:inline-block'><path d='M 5 130 A 130 120 0 0 1 185 68' fill='none' stroke='#8B00FF' stroke-width='14' stroke-linecap='round' opacity='0.9'/><path d='M 17 135 A 116 106 0 0 1 181 76' fill='none' stroke='#0055FF' stroke-width='14' stroke-linecap='round' opacity='0.9'/><path d='M 29 140 A 102 92 0 0 1 177 84' fill='none' stroke='#00AA00' stroke-width='14' stroke-linecap='round' opacity='0.9'/><path d='M 41 145 A 88 78 0 0 1 173 92' fill='none' stroke='#FFD700' stroke-width='14' stroke-linecap='round' opacity='0.9'/><path d='M 53 150 A 74 64 0 0 1 169 100' fill='none' stroke='#FF2200' stroke-width='14' stroke-linecap='round' opacity='0.9'/><path d='M 179 158 Q 179 132 215 132 Q 251 132 251 158 Z' fill='#111111'/><rect x='179' y='130' width='72' height='28' fill='#111111'/><ellipse cx='215' cy='158' rx='36' ry='9' fill='#111111' stroke='#666' stroke-width='1.5'/><ellipse cx='215' cy='130' rx='36' ry='11' fill='#333333' stroke='#888' stroke-width='2'/><ellipse cx='215' cy='128' rx='30' ry='7' fill='#444444'/><ellipse cx='205' cy='123' rx='11' ry='5' fill='#CC9900' stroke='#FFD700' stroke-width='1.5'/><ellipse cx='225' cy='123' rx='11' ry='5' fill='#CC9900' stroke='#FFD700' stroke-width='1.5'/><ellipse cx='215' cy='118' rx='12' ry='5.5' fill='#DDAA00' stroke='#FFE044' stroke-width='1.5'/><ellipse cx='209' cy='124' rx='11' ry='5' fill='#DDAA00' stroke='#FFE044' stroke-width='1.5'/><ellipse cx='221' cy='124' rx='11' ry='5' fill='#DDAA00' stroke='#FFE044' stroke-width='1.5'/><ellipse cx='215' cy='119' rx='13' ry='6' fill='#FFD700' stroke='#FFEE88' stroke-width='2'/><text x='215' y='122' text-anchor='middle' font-family='Georgia,serif' font-size='7' font-weight='bold' fill='#5a3a00'>LL</text><text x='250' y='118' font-family='Georgia,serif' font-size='10' fill='#FFD700'>&#10022;</text><text x='174' y='122' font-family='Georgia,serif' font-size='8' fill='#FFD700' opacity='0.9'>&#10022;</text></svg></strong></div>\"\n    +\"<div style='margin-top:16px;background:rgba(255,255,255,0.06);border-radius:12px;padding:14px;font-size:11px;color:rgba(255,255,255,0.6);line-height:1.8'>&#10022; Same tiles for every player worldwide<br>&#10022; Resets at midnight your local time<br>&#10022; Compete on the Global Leaderboard</div>\"\n    +\"</div>\";\n}\n\nfunction s2(){\n  return \"<div style='position:relative'>\"\n    +\"<div id='board' style='margin:0 auto 6px'>\"\n    // Row 1: Q . . . E\n    +\"<div class='trow'>\"\n    +\"<div class='tile' id='tQ'>Q<span class='tv'>20</span></div>\"\n    +\"<div class='tile' id='tR1'>R<span class='tv'>5</span></div>\"\n    +\"<div class='tile dbl' id='tA1'>A<span class='tbv' style='color:#ffd700'>2x</span></div>\"\n    +\"<div class='tile' id='tN1'>N<span class='tv'>4</span></div>\"\n    +\"<div class='tile' id='tE'>E<span class='tv'>3</span></div>\"\n    +\"</div>\"\n    // Row 2: . . . . .\n    +\"<div class='trow'>\"\n    +\"<div class='tile' id='tL1'>L<span class='tv'>6</span></div>\"\n    +\"<div class='tile trp' id='tB1'>B<span class='tbv' style='color:#e040fb'>3x</span></div>\"\n    +\"<div class='tile' id='tS1'>S<span class='tv'>5</span></div>\"\n    +\"<div class='tile' id='tM1'>M<span class='tv'>7</span></div>\"\n    +\"<div class='tile' id='tD1'>D<span class='tv'>6</span></div>\"\n    +\"</div>\"\n    // Row 3: . U . . .\n    +\"<div class='trow'>\"\n    +\"<div class='tile' id='tF1'>F<span class='tv'>8</span></div>\"\n    +\"<div class='tile' id='tU'>U<span class='tv'>7</span></div>\"\n    +\"<div class='tile' id='tH1'>H<span class='tv'>6</span></div>\"\n    +\"<div class='tile' id='tW1'>W<span class='tv'>9</span></div>\"\n    +\"<div class='tile' id='tO1'>O<span class='tv'>4</span></div>\"\n    +\"</div>\"\n    // Row 4: . . I . T\n    +\"<div class='trow'>\"\n    +\"<div class='tile' id='tP1'>P<span class='tv'>8</span></div>\"\n    +\"<div class='tile' id='tV1'>V<span class='tv'>11</span></div>\"\n    +\"<div class='tile' id='tI'>I<span class='tv'>4</span></div>\"\n    +\"<div class='tile' id='tK1'>K<span class='tv'>12</span></div>\"\n    +\"<div class='tile' id='tT'>T<span class='tv'>3</span></div>\"\n    +\"</div>\"\n    +\"</div>\"\n    +\"<div class='finger' id='fg'>&#128070;</div>\"\n    +\"<div class='wbox' id='wb'><span style='color:rgba(255,255,255,0.3);font-size:11px;font-style:italic'>Tap tiles to build a word...</span></div>\"\n    +\"<div style='display:flex;gap:6px;margin:0 0 6px'><div id='submitbtn' style='flex:2;padding:7px;border-radius:8px;background:rgba(246,211,101,0.15);border:1px solid rgba(246,211,101,0.4);color:#f6d365;font-size:10px;font-weight:bold;text-align:center;transition:transform 0.15s,background 0.2s'>Submit Word</div><div id='cbtn' style='flex:1;padding:7px;border-radius:8px;background:rgba(192,132,252,0.2);border:2px solid rgba(216,180,254,0.8);color:#ede9fe;font-size:10px;font-weight:bold;text-align:center;transition:background 0.2s'>&#10005; Clear</div></div>\"+\"<div style='font-size:10px;color:rgba(255,255,255,0.5);text-align:center'>Tiles can be anywhere on the board -- no adjacency needed!</div>\"\n    +\"</div>\";\n}\n\nfunction a2(){\n  var wrong=[\"Q\",\"I\",\"U\",\"E\"];\n  var wrongIds=[\"tQ\",\"tI\",\"tU\",\"tE\"];\n  var correct=[\"Q\",\"U\",\"I\",\"E\",\"T\"];\n  var correctIds=[\"tQ\",\"tU\",\"tI\",\"tE\",\"tT\"];\n  var scores={Q:20,U:7,I:4,E:3,T:3};\n  var step=0;\n  var word=[];\n\n  function getTileCenter(id){\n    var el=document.getElementById(id);\n    var board=document.getElementById(\"board\");\n    if(!el||!board)return{x:0,y:0};\n    var er=el.getBoundingClientRect();\n    var br=board.getBoundingClientRect();\n    return{x:er.left-br.left+er.width/2-16, y:er.top-br.top+er.height/2-10};\n  }\n\n  function getClearBtnPos(){\n    var cb=document.getElementById(\"cbtn\");\n    var board=document.getElementById(\"board\");\n    if(!cb||!board)return{x:120,y:110};\n    var cr=cb.getBoundingClientRect();\n    var br=board.getBoundingClientRect();\n    return{x:cr.left-br.left+cr.width/2-14, y:cr.top-br.top+cr.height/2-4};\n  }\n\n  function updateWordBox(){\n    var wb=document.getElementById(\"wb\");\n    if(!wb)return;\n    if(word.length===0){\n      wb.innerHTML=\"<span style='color:rgba(255,255,255,0.3);font-size:11px;font-style:italic'>Tap tiles to build a word...</span>\";\n      return;\n    }\n    var total=word.reduce(function(a,l){return a+(scores[l]||0);},0);\n    wb.innerHTML=word.map(function(l){return \"<span class='wl'>\"+l+\"</span>\";}).join(\"\")+\"<span class='ws'>+\"+total+\" pts</span>\";\n  }\n\n  function moveFinger(pos, cb, moveDuration, waitAfter){\n    var fg=document.getElementById(\"fg\");\n    if(!fg)return;\n    fg.style.transition=\"left \"+moveDuration+\"ms cubic-bezier(0.4,0,0.2,1), top \"+moveDuration+\"ms cubic-bezier(0.4,0,0.2,1), opacity 0.3s, font-size 0.3s\";\n    fg.style.opacity=\"1\";\n    fg.style.left=pos.x+\"px\";\n    fg.style.top=pos.y+\"px\";\n    setTimeout(cb, moveDuration+(waitAfter||150));\n  }\n\n  function tapTile(id, letter){\n    var el=document.getElementById(id);\n    if(el){\n      el.classList.add(\"sel\");\n      el.style.transition=\"transform 0.15s\";\n    }\n    word.push(letter);\n    updateWordBox();\n  }\n\n  function spellWrong(){\n    if(step>=wrong.length){\n      step=0;\n      setTimeout(pauseThenClear, 780);\n      return;\n    }\n    moveFinger(getTileCenter(wrongIds[step]), function(){\n      tapTile(wrongIds[step], wrong[step]);\n      step++;\n      setTimeout(spellWrong, 650);\n    }, 450, 150);\n  }\n\n  function pauseThenClear(){\n    // Grow finger bigger to signal \"watch this\"\n    var fg=document.getElementById(\"fg\");\n    if(fg){fg.style.fontSize=\"36px\";}\n    setTimeout(function(){\n      // Slowly glide to Clear button\n      moveFinger(getClearBtnPos(), function(){\n        // Tap Clear with visible press\n        var cb=document.getElementById(\"cbtn\");\n        if(cb){\n          cb.style.transition=\"background 0.2s, transform 0.15s\";\n          cb.style.background=\"rgba(216,180,254,0.75)\";\n          cb.style.transform=\"scale(0.9)\";\n          setTimeout(function(){\n            if(cb){cb.style.background=\"\";cb.style.transform=\"\";}\n            document.querySelectorAll(\".tile.sel\").forEach(function(t){t.classList.remove(\"sel\");});\n            word=[];\n            updateWordBox();\n            // Shrink finger back to normal\n            if(fg)fg.style.fontSize=\"26px\";\n            setTimeout(spellCorrect, 650);\n          }, 500);\n        }\n      }, 585, 130);\n    }, 400);\n  }\n\n  function spellCorrect(){\n    if(step>=correct.length){\n      var fg=document.getElementById(\"fg\");\n      if(fg){\n        var sb=document.getElementById(\"submitbtn\");\n        if(sb){\n          // Get positions relative to viewport then offset to finger container\n          var sr=sb.getBoundingClientRect();\n          var pr=fg.parentElement.getBoundingClientRect();\n          fg.style.transition=\"left 0.5s ease, top 0.5s ease, opacity 0.3s\";\n          fg.style.left=(sr.left-pr.left+sr.width/2-14)+\"px\";\n          fg.style.top=(sr.top-pr.top+sr.height/2-4)+\"px\";\n          setTimeout(function(){\n            // Tap animation on submit button\n            sb.style.transition=\"transform 0.12s, background 0.2s\";\n            sb.style.transform=\"scale(0.92)\";\n            sb.style.background=\"rgba(246,211,101,0.45)\";\n            setTimeout(function(){\n              sb.style.transform=\"\";\n              sb.style.background=\"\";\n              fg.style.opacity=\"0\";\n              // Flash score in word box\n              var wb=document.getElementById(\"wb\");\n              if(wb){\n                wb.style.borderColor=\"#22d3ee\";\n                wb.innerHTML=\"<span class='wl'>Q</span><span class='wl'>U</span><span class='wl'>I</span><span class='wl'>E</span><span class='wl'>T</span>\"\n                  +\"<span style='position:absolute;right:8px;color:#22d3ee;font-size:13px;font-weight:bold'>&#10003; +37 pts!</span>\";\n              }\n              flashNext();\n            }, 200);\n          }, 500);\n        } else {\n          fg.style.opacity=\"0\";\n          flashNext();\n        }\n      }\n      return;\n    }\n    moveFinger(getTileCenter(correctIds[step]), function(){\n      tapTile(correctIds[step], correct[step]);\n      step++;\n      setTimeout(spellCorrect, 490);\n    }, 247, 98);\n  }\n\n  setTimeout(spellWrong, 585);\n}\n\nfunction s3(){\n  return \"<div style='position:relative'>\"\n    +\"<div class='wbox' style='border-color:#f6d365'>\"\n    +\"<span class='wl'>Q</span><span class='wl'>U</span><span class='wl'>I</span><span class='wl'>E</span><span class='wl'>T</span>\"\n    +\"<span class='ws'>+37 pts</span>\"\n    +\"</div>\"\n    +\"<div style='display:flex;gap:6px;margin:8px 0'>\"\n    +\"<div id='sbtn' style='flex:2;padding:10px;border-radius:9px;background:linear-gradient(135deg,#f6d365,#fda085);color:#1a1a2e;font-size:12px;font-weight:bold;text-align:center;cursor:pointer;font-family:Georgia,serif;transition:transform 0.1s'>Submit Word</div>\"\n    +\"<div style='flex:1;padding:10px;border-radius:9px;background:rgba(192,132,252,0.25);border:2px solid rgba(216,180,254,0.95);color:#ede9fe;font-size:10px;font-weight:bold;text-align:center'>Clear</div>\"\n    +\"</div>\"\n    +\"<div class='flash' id='flash'>QUIET &#10003;<br><span style='font-size:14px'>+37 pts</span></div>\"\n    +\"<div style='margin-top:8px;background:rgba(255,255,255,0.06);border-radius:12px;padding:12px;font-size:11px;color:rgba(255,255,255,0.7);line-height:1.8;text-align:center'>\"\n    +\"Words checked against<br><strong style='color:#f6d365'>Merriam-Webster Dictionary</strong><br>Collegiate + Medical editions\"\n    +\"</div>\"\n    +\"<div class='finger' id='fg2' style='bottom:130px;left:calc(33% - 14px)'>&#128070;</div>\"\n    +\"</div>\";\n}\n\nfunction a3(){\n  var fg=document.getElementById(\"fg2\");\n  var btn=document.getElementById(\"submitbtn\");\n  var fl=document.getElementById(\"flash\");\n  if(!fg||!btn||!fl)return;\n  setTimeout(function(){\n    fg.style.opacity=\"1\";\n    setTimeout(function(){\n      fg.style.opacity=\"0\";\n      btn.style.transform=\"scale(0.93)\";\n      setTimeout(function(){\n        btn.style.transform=\"scale(1)\";\n        fl.classList.add(\"show\");\n        setTimeout(function(){fl.classList.remove(\"show\");flashNext();},2200);\n      },150);\n    },455);\n  },500);\n}\n\nfunction s4(){\n  return \"<div>\"\n    +\"<div style='margin-bottom:10px;text-align:center'>\"\n    +\"<div style='font-size:12px;color:rgba(255,255,255,0.85);margin-bottom:8px;font-weight:bold'>Rare letters score big!</div>\"\n    +\"<div style='display:flex;gap:6px;justify-content:center'>\"\n    +\"<div class='tile' style='width:44px;height:50px;font-size:16px'>Z<span class='tv'>22</span></div>\"\n    +\"<div class='tile' style='width:44px;height:50px;font-size:16px'>J<span class='tv'>16</span></div>\"\n    +\"<div class='tile' style='width:44px;height:50px;font-size:16px'>K<span class='tv'>12</span></div>\"\n    +\"<div class='tile' style='width:44px;height:50px;font-size:16px'>X<span class='tv'>14</span></div>\"\n    +\"</div></div>\"\n    +\"<div style='font-size:12px;color:rgba(255,255,255,0.85);text-align:center;margin-bottom:6px;font-weight:bold'>Bonus tiles multiply your score!</div>\"\n    +\"<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px'>\"\n    +\"<div style='background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.4);border-radius:10px;padding:10px;text-align:center'><div class='tile dbl' style='width:40px;height:46px;font-size:15px;margin:0 auto 6px'>B<span class='tbv' style='color:#ffd700'>2x</span></div><div style='font-size:10px;color:#ffd700'>Gold = 2x letter value</div></div>\"\n    +\"<div style='background:rgba(224,64,251,0.08);border:1px solid rgba(224,64,251,0.4);border-radius:10px;padding:10px;text-align:center'><div class='tile trp' style='width:40px;height:46px;font-size:15px;margin:0 auto 6px'>V<span class='tbv' style='color:#e040fb'>3x</span></div><div style='font-size:10px;color:#e040fb'>Purple = 3x letter value</div></div>\"\n    +\"</div>\"\n    +\"<div style='background:rgba(110,231,183,0.08);border:1px solid rgba(110,231,183,0.3);border-radius:10px;padding:8px;text-align:center;font-size:11px;color:#6ee7b7'>&#128161; Spell 8+ letter words for long-word bonuses!</div>\"\n    +\"<div style='margin-top:6px;background:rgba(255,255,255,0.06);border-radius:10px;padding:8px;text-align:center;font-size:11px;color:rgba(255,255,255,0.85);line-height:1.6'>Words checked against<br><strong style='color:#f6d365'>Merriam-Webster Dictionary</strong><br>Collegiate + Medical editions</div>\"\n    +\"</div>\";\n}\n\nfunction s5(){\n  return \"<div><div style='font-size:16px;font-weight:bold;color:#f6d365;text-align:center;margin-bottom:12px;letter-spacing:1px'>&#128073; Tap any button to learn what it does!</div><div style='font-size:9px;color:rgba(255,255,255,0.4);letter-spacing:2px;margin-bottom:4px'>TOP ROW</div><div style='margin-bottom:8px'><span class='dbtn' onclick='showC(\\\"date\\\",this)'>&#128197; Date</span><span class='dbtn' onclick='showC(\\\"music\\\",this)' style='background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.6);color:#ffffff;font-size:11px'>&#9835; Music</span><span class='dbtn' onclick='showC(\\\"reset\\\",this)'>&#8634; Reset Full Game</span><span class='dbtn' onclick='showC(\\\"tour\\\",this)'>&#8634; Tour</span></div><div style='font-size:9px;color:rgba(255,255,255,0.4);letter-spacing:2px;margin-bottom:4px'>NAV TABS</div><div style='margin-bottom:8px'><span class='dbtn' onclick='showC(\\\"history\\\",this)'>&#128220; History</span><span class='dbtn' onclick='showC(\\\"stats\\\",this)'>&#128202; Stats</span><span class='dbtn' onclick='showC(\\\"tips\\\",this)'>&#8505;&#65039; Tips</span><span class='dbtn' onclick='showC(\\\"leaders\\\",this)'>&#127942; Leaders</span><span class='dbtn lp' onclick='showC(\\\"level\\\",this)'>&#10022; L1 &#10022;</span></div><div style='font-size:9px;color:rgba(255,255,255,0.4);letter-spacing:2px;margin-bottom:4px'>GAME CONTROLS</div><div style='margin-bottom:4px'><span class='dbtn' onclick='showC(\\\"pause\\\",this)'>&#9208;&#65039; Pause</span><span class='dbtn' onclick='showC(\\\"share\\\",this)'>&#128228; Share LetterLoot</span><span class='dbtn' onclick='showC(\\\"undo\\\",this)'>&#8617;&#65039; UNDO last word</span></div><div><span class='dbtn pb' onclick='showC(\\\"submit\\\",this)'>Submit Word</span><span class='dbtn' onclick='showC(\\\"clear\\\",this)'>&#10005; Clear</span><span class='dbtn' onclick='showC(\\\"retry\\\",this)'>&#128260; Replay L1</span><span class='dbtn' onclick='showC(\\\"buy\\\",this)'>&#128275; Buy L2</span></div><div class='callout' id='callout'></div></div>\";\n}\n\nfunction s6(){\n  var lvls=[{l:1,t:42,b:100,c:\"#6ee7b7\"},{l:2,t:48,b:200,c:\"#60a5fa\"},{l:3,t:54,b:300,c:\"#a78bfa\"},{l:4,t:60,b:400,c:\"#fda085\"},{l:5,t:66,b:500,c:\"#f6d365\"}];\n  var html=\"<div style='display:flex;flex-direction:column;gap:7px'>\";\n  for(var i=0;i<lvls.length;i++){\n    var lv=lvls[i];\n    html+=\"<div style='display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:9px 12px'>\";\n    html+=\"<div style='font-size:15px;font-weight:bold;color:\"+lv.c+\";min-width:22px'>L\"+lv.l+\"</div>\";\n    html+=\"<div style='flex:1'><div style='font-size:11px;color:#f5f0e8;font-weight:bold'>\"+lv.t+\" tiles</div><div style='font-size:9px;color:rgba(255,255,255,0.4);margin-top:2px'>Clear all for +\"+lv.b+\" bonus pts</div></div>\";\n    html+=\"<div style='background:rgba(255,255,255,0.06);border-radius:6px;padding:3px 8px;font-size:9px;color:\"+lv.c+\"'>+\"+lv.b+\"</div></div>\";\n  }\n  html+=\"<div style='text-align:center;font-size:11px;color:rgba(255,255,255,0.5);margin-top:4px'>Stuck? <span style='color:#fda085'>Buy next level</span> with points or <span style='color:#60a5fa'>Replay</span> same tiles</div></div>\";\n  return html;\n}\n\nfunction s7(){\n  var bigPot=\"<div style='display:flex;justify-content:center;margin:8px 0'>\"+\"<svg viewBox='0 0 300 160' width='220' height='118' xmlns='http://www.w3.org/2000/svg'>\"+\"<path d='M 10 140 A 160 150 0 0 1 200 80' fill='none' stroke='#8B00FF' stroke-width='13' stroke-linecap='round' opacity='0.9'/>\"+\"<path d='M 20 143 A 147 137 0 0 1 197 86' fill='none' stroke='#4400CC' stroke-width='13' stroke-linecap='round' opacity='0.9'/>\"+\"<path d='M 30 146 A 134 124 0 0 1 194 92' fill='none' stroke='#0055FF' stroke-width='13' stroke-linecap='round' opacity='0.9'/>\"+\"<path d='M 40 149 A 121 111 0 0 1 191 98' fill='none' stroke='#00AA00' stroke-width='13' stroke-linecap='round' opacity='0.9'/>\"+\"<path d='M 50 152 A 108 98 0 0 1 188 104' fill='none' stroke='#FFD700' stroke-width='13' stroke-linecap='round' opacity='0.9'/>\"+\"<path d='M 60 155 A 95 85 0 0 1 185 110' fill='none' stroke='#FF8C00' stroke-width='13' stroke-linecap='round' opacity='0.9'/>\"+\"<path d='M 70 158 A 82 72 0 0 1 182 116' fill='none' stroke='#FF2200' stroke-width='13' stroke-linecap='round' opacity='0.9'/>\"+\"<path d='M 172 158 Q 172 132 200 132 Q 228 132 228 158 Z' fill='#111'/>\"+\"<rect x='172' y='130' width='56' height='28' fill='#111'/>\"+\"<ellipse cx='200' cy='158' rx='28' ry='8' fill='#111' stroke='#666' stroke-width='1.5'/>\"+\"<ellipse cx='200' cy='130' rx='28' ry='9' fill='#333' stroke='#888' stroke-width='2'/>\"+\"<ellipse cx='191' cy='123' rx='10' ry='5' fill='#CC9900' stroke='#FFD700' stroke-width='1.5'/>\"+\"<ellipse cx='209' cy='123' rx='10' ry='5' fill='#CC9900' stroke='#FFD700' stroke-width='1.5'/>\"+\"<ellipse cx='200' cy='119' rx='12' ry='6' fill='#FFD700' stroke='#FFEE88' stroke-width='2'/>\"+\"<text x='200' y='122' text-anchor='middle' font-family='Georgia,serif' font-size='6' font-weight='bold' fill='#5a3a00'>LL</text>\"+\"<text x='228' y='119' font-family='Georgia,serif' font-size='10' fill='#FFD700' opacity='0.9'>&#10022;</text>\"+\"<text x='166' y='122' font-family='Georgia,serif' font-size='8' fill='#FFD700' opacity='0.8'>&#10022;</text>\"+\"</svg></div>\";\n  return \"<div style='text-align:center'>\"\n    +bigPot\n    +\"<div style='background:rgba(255,255,255,0.07);border:1.5px solid rgba(255,255,255,0.2);border-radius:14px;padding:14px;font-size:13px;color:#f5f0e8;line-height:2.1;text-align:left'>\"\n    +\"&#10024; Clear all 5 levels without buying or repeating<br>\"\n    +\"<svg viewBox='0 0 300 160' width='36' height='22' xmlns='http://www.w3.org/2000/svg' style='vertical-align:-5px;display:inline-block'><path d='M 5 130 A 130 120 0 0 1 185 68' fill='none' stroke='#8B00FF' stroke-width='18' stroke-linecap='round' opacity='0.9'/><path d='M 22 137 A 108 98 0 0 1 178 84' fill='none' stroke='#00AA00' stroke-width='18' stroke-linecap='round' opacity='0.9'/><path d='M 39 144 A 86 76 0 0 1 171 100' fill='none' stroke='#FF2200' stroke-width='18' stroke-linecap='round' opacity='0.9'/><path d='M 175 158 Q 175 133 210 133 Q 245 133 245 158 Z' fill='#111'/><rect x='175' y='131' width='70' height='27' fill='#111'/><ellipse cx='210' cy='131' rx='35' ry='10' fill='#333' stroke='#888' stroke-width='2'/><ellipse cx='210' cy='120' rx='13' ry='6' fill='#FFD700' stroke='#FFEE88' stroke-width='1.5'/><text x='210' y='123' text-anchor='middle' font-family='Georgia,serif' font-size='7' font-weight='bold' fill='#5a3a00'>LL</text></svg> Experience a <strong>PERFECT DAY</strong><br>\"\n    +\"&#127881; Big Bonuses at the end of the Rainbow!\"\n    +\"</div>\"\n    +\"<div style='margin-top:10px;background:rgba(246,211,101,0.1);border:1px solid rgba(246,211,101,0.4);border-radius:12px;padding:10px;font-size:12px;color:rgba(255,255,255,0.75);line-height:1.7'>\"\n    +\"Score a Perfect Day to find out what's waiting...<br>\"\n    +\"<strong style='color:#f6d365'>Perfect Day streaks earn increasingly large bonuses!</strong>\"\n    +\"</div>\"\n    +\"</div>\";\n}\n\nfunction s8(){\n  return \"<div style='text-align:center;padding:8px 0'>\"\n    +\"<div style='font-size:48px;margin-bottom:6px'>&#9999;&#65039;</div>\"\n    +\"<div style='font-size:13px;color:#f5f0e8;line-height:1.9;margin-bottom:10px'>\"\n    +\"Tap <strong style='color:#f6d365'>any tiles</strong> to build words<br>\"\n    +\"<strong style='color:#fda085'>Score big</strong> with rare letters and bonus tiles<br>\"\n    +\"Compete on the <strong style='color:#a78bfa'>Global Leaderboard</strong>\"\n    +\"</div>\"\n    +\"<div style='display:flex;justify-content:center;margin:6px 0'><svg viewBox='0 0 300 160' width='200' height='107' xmlns='http://www.w3.org/2000/svg'><path d='M 10 140 A 160 150 0 0 1 200 80' fill='none' stroke='#8B00FF' stroke-width='13' stroke-linecap='round' opacity='0.9'/><path d='M 20 143 A 147 137 0 0 1 197 86' fill='none' stroke='#4400CC' stroke-width='13' stroke-linecap='round' opacity='0.9'/><path d='M 30 146 A 134 124 0 0 1 194 92' fill='none' stroke='#0055FF' stroke-width='13' stroke-linecap='round' opacity='0.9'/><path d='M 40 149 A 121 111 0 0 1 191 98' fill='none' stroke='#00AA00' stroke-width='13' stroke-linecap='round' opacity='0.9'/><path d='M 50 152 A 108 98 0 0 1 188 104' fill='none' stroke='#FFD700' stroke-width='13' stroke-linecap='round' opacity='0.9'/><path d='M 60 155 A 95 85 0 0 1 185 110' fill='none' stroke='#FF8C00' stroke-width='13' stroke-linecap='round' opacity='0.9'/><path d='M 70 158 A 82 72 0 0 1 182 116' fill='none' stroke='#FF2200' stroke-width='13' stroke-linecap='round' opacity='0.9'/><path d='M 172 158 Q 172 132 200 132 Q 228 132 228 158 Z' fill='#111'/><rect x='172' y='130' width='56' height='28' fill='#111'/><ellipse cx='200' cy='158' rx='28' ry='8' fill='#111' stroke='#666' stroke-width='1.5'/><ellipse cx='200' cy='130' rx='28' ry='9' fill='#333' stroke='#888' stroke-width='2'/><ellipse cx='191' cy='123' rx='10' ry='5' fill='#CC9900' stroke='#FFD700' stroke-width='1.5'/><ellipse cx='209' cy='123' rx='10' ry='5' fill='#CC9900' stroke='#FFD700' stroke-width='1.5'/><ellipse cx='200' cy='119' rx='12' ry='6' fill='#FFD700' stroke='#FFEE88' stroke-width='2'/><text x='200' y='122' text-anchor='middle' font-family='Georgia,serif' font-size='6' font-weight='bold' fill='#5a3a00'>LL</text><text x='228' y='119' font-family='Georgia,serif' font-size='10' fill='#FFD700' opacity='0.9'>&#10022;</text><text x='166' y='122' font-family='Georgia,serif' font-size='8' fill='#FFD700' opacity='0.8'>&#10022;</text></svg></div>\"\n    +\"<div style='background:rgba(246,211,101,0.1);border:1px solid rgba(246,211,101,0.3);border-radius:14px;padding:12px;font-size:12px;color:rgba(255,255,255,0.7);line-height:1.7'>\"\n    +\"&#128161; Tap <strong style='color:#f6d365;font-size:13px'>&#8634; TOUR</strong> anytime to replay this walkthrough!\"\n    +\"</div>\"\n    +\"<div style='margin-top:10px;text-align:center'>\"\n    +\"<span onclick='goTo(0)' style='display:inline-block;padding:7px 20px;border-radius:10px;background:linear-gradient(135deg,rgba(246,211,101,0.2),rgba(253,160,133,0.15));border:1.5px solid rgba(246,211,101,0.6);color:#f6d365;font-size:12px;font-weight:bold;cursor:pointer;font-family:Georgia,serif;letter-spacing:1px'>&#8634; TOUR</span>\"\n    +\"</div>\"\n    +\"</div>\";\n}\n\nvar SCENES=[\n  {title:\"Welcome to LetterLoot!\",desc:\"A daily word puzzle where every letter has a point value.\",fn:s1,enter:null,last:false},\n  {title:\"Tap Tiles to Spell a Word\",desc:\"Tap any tiles in any order -- no adjacency rules! Watch the demo:\",fn:s2,enter:a2,last:false},\n  {title:\"Letter Values\",desc:\"Every letter has value.\",fn:s4,enter:null,last:false},\n  {title:\"Your Buttons\",desc:\"\",fn:s5,enter:null,last:false},\n  {title:\"5 Levels of Looting\",desc:\"Each level has more tiles. Clear the board for a bonus!\",fn:s6,enter:null,last:false},\n  {title:\"The Perfect Day\",desc:\"Find the Pot of Loot at the end of the Rainbow!\",fn:s7,enter:null,last:false},\n  {title:\"Ready to Loot!\",desc:\"You have everything you need. Now go get that loot!\",fn:s8,enter:null,last:true}\n];\n\nfunction flashNext(){\n  setTimeout(function(){\n    var btn=document.querySelector(\".btn-next\")||document.querySelector(\".btn-done\");\n    if(btn)btn.classList.add(\"pulse\");\n  }, 200);\n}\n\nfunction render(){\n  var scene=SCENES[cur];\n  var dotsEl=document.getElementById(\"dots\");\n  var dhtml=\"\";\n  for(var i=0;i<SCENES.length;i++){\n    var cls=\"dot\"+(i===cur?\" active\":i<cur?\" done\":\"\");\n    dhtml+=\"<div class=\\\"\"+cls+\"\\\" onclick=\\\"goTo(\"+i+\")\\\"></div>\";\n  }\n  dotsEl.innerHTML=dhtml;\n  var box=document.getElementById(\"sb\");\n  var backLabel=cur===0?\"Skip\":\"Back\";\n  box.innerHTML=\"<div class=\\\"scene-title\\\">\"+scene.title+\"</div>\"\n    +\"<div class=\\\"scene-desc\\\">\"+scene.desc+\"</div>\"\n    +scene.fn()\n    +\"<div class=\\\"nav\\\">\"\n    +\"<button class=\\\"btn-back\\\" onclick=\\\"back()\\\">\"+backLabel+\"</button>\"\n    +(scene.last?\"<button class=\\\"btn-done\\\" onclick=\\\"done()\\\">&#9999;&#65039; Lets Play!</button>\":\"<button class=\\\"btn-next\\\" onclick=\\\"next()\\\">Next &rarr;</button>\")\n    +\"</div>\";\n  if(scene.enter)setTimeout(scene.enter,150);\n  else flashNext();\n}\n\nfunction next(){if(cur<SCENES.length-1){cur++;render();}}\nfunction back(){if(cur>0){cur--;render();}else{done();}}\nfunction goTo(i){cur=i;render();}\nfunction done(){try{window.parent.postMessage(\"tour-done\",\"*\");}catch(e){}}\n\nrender();\n</script>\n</body>\n</html>\n";

function VisualTour({ onDone }) {
  React.useEffect(() => {
    const handler = (e) => { if (e.data === "tour-done") onDone(); };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onDone]);
  return (
    <div style={{position:"fixed",inset:0,zIndex:99999}}>
      <iframe
        srcDoc={TOUR_HTML_CONTENT}
        style={{width:"100%",height:"100%",border:"none",display:"block"}}
        title="LetterLoot Tour"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}

function PencilLogo({ size = 120 }) {
  const fontSize = Math.round(size * 0.35);
  return <span style={{fontSize:fontSize, lineHeight:1, display:"inline-block"}}>&#9999;&#65039;</span>;
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

function LetterLootLogo({ titleFontSize = 28, boxPadding = "8px 24px", showSubtitle = false }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <PencilLogo size={140} />
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
  try {
    const data = JSON.parse(localStorage.getItem("ll_lifetime") || "null");
    if (!data) return { total: 0, lastPlayedDate: null, missedDays: 0 };
    const todayKey = getTodayKey(); const yesterdayKey = getYesterdayKey();
    if (!data.lastPlayedDate || data.lastPlayedDate === todayKey || data.lastPlayedDate === yesterdayKey) return { ...data, missedDays: 0 };
    const last = new Date(data.lastPlayedDate); const today = new Date(todayKey);
    const diffDays = Math.floor((today - last) / 86400000);
    const missedDays = diffDays - 1;
    if (missedDays >= 3) return { total: 0, lastPlayedDate: null, missedDays: 3, wasReset: true, originalTotal: data.total };
    if (missedDays === 2) return { total: Math.floor(data.total * (1/3)), lastPlayedDate: data.lastPlayedDate, missedDays: 2, wasDecayed: true, originalTotal: data.total };
    if (missedDays === 1) return { total: Math.floor(data.total * (2/3)), lastPlayedDate: data.lastPlayedDate, missedDays: 1, wasDecayed: true, originalTotal: data.total };
    return { ...data, missedDays: 0 };
  } catch { return { total: 0, lastPlayedDate: null, missedDays: 0 }; }
}
function saveLifetimeData(total) { try { localStorage.setItem("ll_lifetime", JSON.stringify({ total, lastPlayedDate: getTodayKey() })); } catch {} }

function getLocalStats() {
  const def = {
    daysPlayed:0, lastPlayedDate:null, currentStreak:0, longestStreak:0, lastStreakDate:null,
    perfectDaysAllTime:0, perfectDaysWeek:{}, weekKey:"",
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
  if (stats.lastPlayedDate !== todayKey) {
    stats.daysPlayed += 1;
    const yesterdayKey = getYesterdayKey();
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
  if (updates.perfectDay) { stats.perfectDaysAllTime += 1; stats.perfectDaysWeek[todayKey] = (stats.perfectDaysWeek[todayKey]||0) + 1; }
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
    if (data) return data;
    const oldBadges = JSON.parse(localStorage.getItem("ll_stats") || "{}").badges || [];
    return { lifetime: oldBadges, weekly: {}, daily: {} };
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
function appendToDailyHistory(word, score, valid, medical, collegiate, gameIndex) {
  const history = getDailyHistory();
  if (!history.games[gameIndex]) history.games[gameIndex] = [];
  history.games[gameIndex].push({ word, score, valid, medical, collegiate });
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

const TOUR_STEPS = [
  { emoji:"✏️", title:"Welcome to LetterLoot!", body:"A daily word puzzle where every letter has a point value. Fresh tiles every day at midnight — same board for every player worldwide!", warning:false },
  { emoji:"✨", title:"Letters Don't Need to Connect!", body:"Unlike other word games, tap ANY tiles in ANY order to spell words. No adjacency rules — pure vocabulary power!", warning:false },
  { emoji:"💎", title:"Every Letter Has a Value", body:"Common letters (E, T, A) score 3–5 pts. Rare letters score big — Q=20, Z=22, J=16!\n\nGold tiles = 2× the letter's value\nPurple tiles = 3× the letter's value!", warning:false },
  { emoji:"✏️", title:"What the Buttons Do", body:"Submit Word — checks your word\n✕ Clear — removes your selection\n🔄 ReTry Level — same tiles, fresh start\n⏸️ Pause — stops your timer\n🔓 Buy Level — spend points to advance", warning:false },
  { emoji:"↩️", title:"The UNDO Button", body:"Find yourself in a pinch to finish a level?\n\nYou have an optional UNDO available for 1 word per game for 1,000 points.\n\nIt will keep your Perfect Day on track!", warning:false },
  { emoji:"🌟", title:"Clearing a Level", body:"Use ALL tiles to clear the board and earn a big bonus! Can't finish? Spend earned points to buy the next level, or retry with the same tiles.", warning:false },
  { emoji:"💰", title:"Your Points Are Everything!", body:"", warning:true },
];

function FarewellScreen({ totalScore, bestWord, bestWordScore, onDone, onViewStats }) {
  const [opacity, setOpacity] = useState(1);
  const fadeTimerRef = useRef(null);
  const startFade = useCallback(() => {
    fadeTimerRef.current = setTimeout(() => {
      let op = 1;
      const fade = setInterval(() => { op -= 0.02; setOpacity(op); if (op <= 0) { clearInterval(fade); onDone(); } }, 30);
    }, 6000);
  }, [onDone]);
  useEffect(() => { startFade(); return () => clearTimeout(fadeTimerRef.current); }, []);
  const handleViewStats = () => { clearTimeout(fadeTimerRef.current); setOpacity(1); onViewStats(); };
  return (
    <div style={{ position:"fixed", inset:0, zIndex:99999, background:"#0a0820", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"30px 24px", fontFamily:"Georgia,serif", color:"#f5f0e8", opacity, transition:"opacity 0.5s" }}>
      <Starfield/>
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:360}}>
        <div style={{textAlign:"center",marginBottom:28}}><LetterLootLogo titleFontSize={32} boxPadding="10px 28px"/></div>
        <div style={{textAlign:"center",width:"100%"}}>
          <div style={{fontSize:22,fontWeight:"bold",color:"#f6d365",marginBottom:16}}>Great effort today! 🎉</div>
          <div style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:14,padding:"16px",marginBottom:20,width:"100%"}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:8}}>Highest scoring word:</div>
            <div style={{fontSize:24,fontWeight:"bold",color:"#a78bfa",letterSpacing:3,marginBottom:4}}>{bestWord||"—"}</div>
            <div style={{fontSize:15,color:"#fda085",fontWeight:"bold",marginBottom:12}}>{bestWordScore||0} points</div>
            <div style={{height:1,background:"rgba(255,255,255,0.12)",marginBottom:12}}/>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:4}}>Total Score Today</div>
            <div style={{fontSize:34,fontWeight:"bold",color:"#f6d365"}}>{totalScore||0}</div>
          </div>
          <div style={{background:"rgba(110,231,183,0.08)",border:"1px solid rgba(110,231,183,0.3)",borderRadius:14,padding:"18px",marginBottom:20}}>
            <div style={{fontSize:16,color:"#ffffff",lineHeight:1.9,fontWeight:"bold"}}>Come back tomorrow for a brand new<br/>LetterLoot challenge —<br/>fresh tiles, fresh start,<br/>same great game!</div>
          </div>
          <button onClick={handleViewStats} style={{width:"100%",padding:"12px",borderRadius:14,background:"linear-gradient(135deg,#a78bfa,#7c3aed)",color:"#fff",fontSize:14,fontWeight:"bold",fontFamily:"Georgia,serif",border:"none",cursor:"pointer",marginBottom:12}}>📊 View My Stats</button>
          <div style={{fontSize:28,marginBottom:10}}>🌅</div>
          <div style={{fontSize:20,fontWeight:"bold",color:"#6ee7b7",marginBottom:8}}>See you tomorrow!</div>
          <div style={{fontSize:15,color:"#ffffff",fontWeight:"bold",letterSpacing:1}}>{getShortDate()}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:12}}>Fading to home screen…</div>
        </div>
      </div>
    </div>
  );
}

function AuthScreen({ onGuest, onLogin }) {
  // If player has a saved name or previous session, go straight to Sign In
  const isReturning = !!(localStorage.getItem("ll_name") || localStorage.getItem("ll_session"));
  const [mode, setMode] = useState(isReturning ? "login" : "welcome");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const handleSignUp = async () => {
    if (!email || !password || !name) { setError("Please fill in all fields"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
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
  const inputStyle = { width:"100%", padding:"11px 14px", borderRadius:10, border:"1px solid rgba(255,255,255,0.25)", background:"rgba(255,255,255,0.08)", color:"#f5f0e8", fontSize:14, fontFamily:"Georgia,serif", outline:"none", marginBottom:10, boxSizing:"border-box" };
  const btnStyle = (bg, color="#1a1a2e") => ({ width:"100%", padding:"13px", borderRadius:12, border:"none", background:bg, color, fontSize:14, fontWeight:"bold", fontFamily:"Georgia,serif", cursor:"pointer", marginBottom:8 });
  return (
    <div style={{ minHeight:"100vh", background:"#0a0820", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px", fontFamily:"Georgia,serif", color:"#f5f0e8", position:"relative" }}>
      <Starfield/>
      <div style={{zIndex:1, width:"100%", maxWidth:360}}>
        <div style={{textAlign:"center", marginBottom:28}}><LetterLootLogo titleFontSize={30} boxPadding="8px 24px" showSubtitle={true}/></div>
        {mode==="welcome"&&(
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:20,padding:"28px 24px",border:"1px solid rgba(255,255,255,0.15)"}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:14,fontWeight:"bold",color:"#f6d365",marginBottom:8}}>Welcome!</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",lineHeight:1.6}}>Sign in to save your progress across devices, or play as a guest to try it out.</div>
            </div>
            <button style={btnStyle("linear-gradient(135deg,#f6d365,#fda085)")} onClick={()=>setMode("login")}>Sign In</button>
            <button style={btnStyle("linear-gradient(135deg,#a78bfa,#7c3aed)","#fff")} onClick={()=>setMode("signup")}>Create Account</button>
            <button style={{...btnStyle("rgba(255,255,255,0.08)","rgba(255,255,255,0.7)"),border:"1px solid rgba(255,255,255,0.2)"}} onClick={onGuest}>Play as Guest<div style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:"normal",marginTop:2}}>Progress saved on this device only</div></button>
          </div>
        )}
        {mode==="login"&&(
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:20,padding:"28px 24px",border:"1px solid rgba(255,255,255,0.15)"}}>
            <div style={{textAlign:"center",marginBottom:18}}>
              {isReturning && localStorage.getItem("ll_name") && (
                <div style={{fontSize:16,fontWeight:"bold",color:"#22d3ee",marginBottom:8}}>
                  Welcome back, {localStorage.getItem("ll_name")}! 👋
                </div>
              )}
              <div style={{fontSize:13,fontWeight:"bold",color:"#f6d365",letterSpacing:2}}>SIGN IN</div>
              {isReturning && <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:4}}>Sign in to sync your progress across devices</div>}
            </div>
            {error&&<div style={{background:"rgba(220,38,38,0.2)",border:"1px solid rgba(220,38,38,0.4)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#fca5a5",marginBottom:10}}>{error}</div>}
            {success&&<div style={{background:"rgba(34,197,94,0.2)",border:"1px solid rgba(34,197,94,0.4)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#86efac",marginBottom:10}}>{success}</div>}
            <input style={inputStyle} type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSignIn()}/>
            <input style={inputStyle} type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSignIn()}/>
            <button style={btnStyle("linear-gradient(135deg,#f6d365,#fda085)")} onClick={handleSignIn} disabled={loading}>{loading?"Signing in…":"Sign In"}</button>
            <div style={{textAlign:"center",marginTop:4}}><span style={{fontSize:11,color:"rgba(255,255,255,0.4)",cursor:"pointer"}} onClick={()=>{setMode("forgot");setError("");}}>Forgot password?</span></div>
            <div style={{textAlign:"center",marginTop:12,fontSize:12,color:"rgba(255,255,255,0.4)"}}>Don't have an account? <span style={{color:"#a78bfa",cursor:"pointer"}} onClick={()=>{setMode("signup");setError("");}}>Sign up</span></div>
            <button style={{...btnStyle("transparent","rgba(255,255,255,0.3)"),border:"none",fontSize:12,marginTop:4}} onClick={()=>setMode("welcome")}>← Back</button>
          </div>
        )}
        {mode==="signup"&&(
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:20,padding:"28px 24px",border:"1px solid rgba(255,255,255,0.15)"}}>
            <div style={{textAlign:"center",marginBottom:18}}><div style={{fontSize:13,fontWeight:"bold",color:"#a78bfa",letterSpacing:2}}>CREATE ACCOUNT</div></div>
            {error&&<div style={{background:"rgba(220,38,38,0.2)",border:"1px solid rgba(220,38,38,0.4)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#fca5a5",marginBottom:10}}>{error}</div>}
            {success&&<div style={{background:"rgba(34,197,94,0.2)",border:"1px solid rgba(34,197,94,0.4)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#86efac",marginBottom:10}}>{success}</div>}
            <input style={inputStyle} type="text" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)}/>
            <input style={inputStyle} type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
            <input style={inputStyle} type="password" placeholder="Password (6+ characters)" value={password} onChange={e=>setPassword(e.target.value)}/>
            <button style={btnStyle("linear-gradient(135deg,#a78bfa,#7c3aed)","#fff")} onClick={handleSignUp} disabled={loading}>{loading?"Creating account…":"Create Account"}</button>
            <div style={{textAlign:"center",marginTop:8,fontSize:12,color:"rgba(255,255,255,0.4)"}}>Already have an account? <span style={{color:"#f6d365",cursor:"pointer"}} onClick={()=>{setMode("login");setError("");}}>Sign in</span></div>
            <button style={{...btnStyle("transparent","rgba(255,255,255,0.3)"),border:"none",fontSize:12,marginTop:4}} onClick={()=>setMode("welcome")}>← Back</button>
          </div>
        )}
        {mode==="forgot"&&(
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:20,padding:"28px 24px",border:"1px solid rgba(255,255,255,0.15)"}}>
            <div style={{textAlign:"center",marginBottom:18}}><div style={{fontSize:13,fontWeight:"bold",color:"#60a5fa",letterSpacing:2}}>RESET PASSWORD</div></div>
            {error&&<div style={{background:"rgba(220,38,38,0.2)",border:"1px solid rgba(220,38,38,0.4)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#fca5a5",marginBottom:10}}>{error}</div>}
            {success&&<div style={{background:"rgba(34,197,94,0.2)",border:"1px solid rgba(34,197,94,0.4)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#86efac",marginBottom:10}}>{success}</div>}
            <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:14,lineHeight:1.6}}>Enter your email and we'll send you a reset link.</div>
            <input style={inputStyle} type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
            <button style={btnStyle("linear-gradient(135deg,#60a5fa,#3b82f6)","#fff")} onClick={handleForgot} disabled={loading}>{loading?"Sending…":"Send Reset Link"}</button>
            <button style={{...btnStyle("transparent","rgba(255,255,255,0.3)"),border:"none",fontSize:12,marginTop:4}} onClick={()=>setMode("login")}>← Back to Sign In</button>
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
      const gameStates = await adminQuery('game_state', 'player_name,lifetime_points,last_played_date,current_streak,longest_streak,stats,badges', '&order=lifetime_points.desc');
      const today = new Date().toISOString().split('T')[0];
      const twoWeeksAgo = new Date(Date.now()-14*86400000).toISOString().split('T')[0];
      const weekAgo = new Date(Date.now()-7*86400000).toISOString().split('T')[0];
      const todaySessions = await adminQuery('daily_sessions', 'user_id,session_date,total_score,perfect_day', `&session_date=eq.${today}`);
      const recentSessions = await adminQuery('daily_sessions', 'session_date', `&session_date=gte.${twoWeeksAgo}`);
      const weekSessions = await adminQuery('daily_sessions', 'user_id,session_date', `&session_date=gte.${weekAgo}`);
      // Build top 25 longest words and top word scores from stats
      const allWords = [];
      gameStates.forEach(g => {
        if (g.stats?.longestWordAllTime) allWords.push({ player: g.player_name||'Guest', word: g.stats.longestWordAllTime, letters: g.stats.longestWordAllTime.length, type:'longest' });
        if (g.stats?.highWordAllTimeWord) allWords.push({ player: g.player_name||'Guest', word: g.stats.highWordAllTimeWord, score: g.stats.highWordAllTime||0, type:'score' });
      });
      const top25Longest = [...allWords].filter(w=>w.type==='longest').sort((a,b)=>b.letters-a.letters).slice(0,25);
      const top25Score = [...allWords].filter(w=>w.type==='score').sort((a,b)=>b.score-a.score).slice(0,25);
      setData({ gameStates, todaySessions, recentSessions, weekSessions, today, top25Longest, top25Score });
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
        <PencilLogo size={140}/>
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
  const newThisWeek = new Set((data?.weekSessions||[]).map(s=>s.user_id)).size;
  const perfectTotal = gs.reduce((a,g)=>a+(g.stats?.perfectDaysAllTime||0),0);
  const longestStreak = gs.reduce((a,g)=>Math.max(a,g.longest_streak||0),0);

  // Chart data
  const chartCounts = {};
  const chartLabels = [];
  for(let i=13;i>=0;i--){
    const d=new Date(Date.now()-i*86400000);
    const key=d.toISOString().split('T')[0];
    chartCounts[key]=0;
    chartLabels.push({key,label:d.toLocaleDateString('en-US',{weekday:'short'})});
  }
  (data?.recentSessions||[]).forEach(s=>{ if(chartCounts[s.session_date]!==undefined) chartCounts[s.session_date]++; });
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
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:14}}>
          {[
            {label:'TOTAL PLAYERS',val:total,color:'246,211,101',vc:'#f6d365'},
            {label:'PLAYED TODAY',val:playedToday,color:'34,211,238',vc:'#22d3ee'},
            {label:'NEW THIS WEEK',val:newThisWeek,color:'167,139,250',vc:'#a78bfa'},
            {label:'PERFECT DAYS',val:perfectTotal,color:'110,231,183',vc:'#6ee7b7'},
            {label:'LONGEST STREAK',val:longestStreak+'d',color:'253,160,133',vc:'#fda085'},
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
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
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
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
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

export default function App() {
  const [authState, setAuthState] = useState("loading");
  const [user, setUser] = useState(null);
  const [showFarewell, setShowFarewell] = useState(false);
  const [farewellData, setFarewellData] = useState({ totalScore:0, bestWord:"", bestWordScore:0 });
  const [postFarewellTab, setPostFarewellTab] = useState(null);
  useEffect(() => {
    getSession().then(session => {
      if (session) { setUser(session.user); setAuthState("playing"); }
      else { const isGuest = localStorage.getItem("ll_guest") === "1"; if (isGuest) setAuthState("playing"); else setAuthState("auth"); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) { setUser(session.user); setAuthState("playing"); }
      if (event === "SIGNED_OUT") { setUser(null); setAuthState("auth"); }
    });
    return () => subscription.unsubscribe();
  }, []);
  const [showCelebrate, setShowCelebrate] = useState(() => window.location.hash === '#celebrate');
  const [showAdmin, setShowAdmin] = useState(() => new URLSearchParams(window.location.search).get('admin') === '1');
  const handleGuest = () => { localStorage.setItem("ll_guest","1"); setAuthState("playing"); };
  const handleLogin = async () => { const session = await getSession(); if (session) { setUser(session.user); setAuthState("playing"); } };
  const handleSignOut = async () => { await signOut(); localStorage.removeItem("ll_guest"); setAuthState("auth"); };
  const handleShowFarewell = (data) => { setFarewellData(data); setShowFarewell(true); };
  const handleFarewellDone = () => { setShowFarewell(false); setAuthState("auth"); };
  const handleFarewellStats = () => { setShowFarewell(false); setPostFarewellTab("stats"); };
  if (showAdmin) return <AdminScreen onExit={()=>setShowAdmin(false)}/>;
  if (showCelebrate) return (
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
          ✏️ Play LetterLoot Free!
        </button>
        <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:14}}>Tap anywhere to dismiss</div>
      </div>
    </div>
  );
  if (showFarewell) return <FarewellScreen {...farewellData} onDone={handleFarewellDone} onViewStats={handleFarewellStats}/>;
  if (authState === "loading") return (
    <div style={{ minHeight:"100vh", background:"#0a0820", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Georgia,serif", position:"relative" }}>
      <Starfield/><div style={{textAlign:"center",zIndex:1}}><LetterLootLogo titleFontSize={28} boxPadding="8px 24px"/><div style={{fontSize:12,color:"rgba(255,255,255,0.4)",letterSpacing:2,marginTop:16}}>LOADING…</div></div>
    </div>
  );
  if (authState === "auth") return <AuthScreen onGuest={handleGuest} onLogin={handleLogin}/>;
  return <GameScreen user={user} onSignOut={handleSignOut} onFarewell={handleShowFarewell} initialTab={postFarewellTab} onTabConsumed={()=>setPostFarewellTab(null)}/>;
}

function GameScreen({ user, onSignOut, onFarewell, initialTab, onTabConsumed }) {
  const isGuest = !user;
  const [playerName, setPlayerName] = useState("");
  const playerNameRef = useRef("");
  const [editingName, setEditingName] = useState(false);
  const [showTour, setShowTour] = useState(false);
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
  const [level, setLevel] = useState(ss?.level || 1);
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
  const [tab, setTab] = useState(initialTab || "play");
  const [confetti, setConfetti] = useState(false);
  const [rainbowConfetti, setRainbowConfetti] = useState(false);
  const [levelComplete, setLevelComplete] = useState(ss?.levelComplete || false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showStuckModal, setShowStuckModal] = useState(false);
  const [paused, setPaused] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [statsData, setStatsData] = useState(() => getLocalStats());
  const [timeLeaderboard, setTimeLeaderboard] = useState(() => getLocalTimeLeaderboard());
  const [showNameInput, setShowNameInput] = useState(false);
  const [perfectDay, setPerfectDay] = useState(ss?.perfectDay ?? true);
  const perfectDayRef = useRef(ss?.perfectDay ?? true);
  const setPerfectDaySync = useCallback((val) => { perfectDayRef.current = val; setPerfectDay(val); }, []);
  const [showRepeatPerfect, setShowRepeatPerfect] = useState(false);
  const [longestWordToday, setLongestWordToday] = useState(ss?.longestWordToday || "");
  const [longestWordAllTime, setLongestWordAllTime] = useState(localStorage.getItem("ll_longest") || "");
  const [perfectDayAchieved, setPerfectDayAchieved] = useState(false);
  const [levelTime, setLevelTime] = useState(ss?.levelTime || 0);
  const [totalTime, setTotalTime] = useState(ss?.totalTime || 0);
  const [selectedLevelView, setSelectedLevelView] = useState(1);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [newRecord, setNewRecord] = useState(null);
  const [pulseScore, setPulseScore] = useState(false);
  const [pulseTime, setPulseTime] = useState(false);
  const [newBestTime, setNewBestTime] = useState(ss?.newBestTime || false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLLCopied, setShareLLCopied] = useState(false);
  const [showIntro, setShowIntro] = useState(() => {
    try {
      const sess = JSON.parse(localStorage.getItem("ll_session") || "null");
      const d = new Date();
      const todayKey = d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();
      const hasActiveGame = sess && sess.savedDate === todayKey && sess.submitted && sess.submitted.length > 0;
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

  useEffect(() => { if (initialTab) { setTab(initialTab); onTabConsumed?.(); } }, [initialTab]);
  useEffect(() => {
    if (tab === 'leaderboard' && !leaderboardData && !leaderboardLoading) {
      setLeaderboardLoading(true);
      fetchLeaderboard().then(d => { setLeaderboardData(d); setLeaderboardLoading(false); });
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
  const currentScore = calcWordScore(selected, tiles);
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
      if (!isGuest && user) {
        setCloudSyncing(true);
        const [gameState, dailySession] = await Promise.all([loadGameState(user.id), loadDailySession(user.id, getTodayKey())]);
        setCloudSyncing(false);
        if (gameState && gameState.lifetime_points != null) {
          lifetimeRef.current = gameState.lifetime_points || 0;
          setLifetimePoints(gameState.lifetime_points || 0);
          setBadgeStore(prev => ({ ...prev, lifetime: gameState.badges || prev.lifetime }));
          setStatsData(prev => ({...prev, ...(gameState.stats || {})}));
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
            setLevel(cloudLevel);
            setTotalScore(dailySession.total_score || 0); totalRef.current = dailySession.total_score || 0;
            setLevelScore(dailySession.level_score || 0); levelScoreRef.current = dailySession.level_score || 0;
            if (dailySession.tiles && dailySession.tiles.length > 0) setTiles(dailySession.tiles);
            tileCountRef.current = dailySession.tile_count || 42;
            setSubmitted(dailySession.submitted || []); submittedRef.current = dailySession.submitted || [];
            setPerfectDaySync(dailySession.perfect_day ?? true);
            setLongestWordToday(dailySession.longest_word_today || "");
            levelTimeRef.current = dailySession.level_time || 0; totalTimeRef.current = dailySession.total_time || 0;
            setLevelTime(dailySession.level_time || 0); setTotalTime(dailySession.total_time || 0);
            if (dailySession.level_complete) setLevelComplete(true);
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
      if (!localStorage.getItem("ll_tour_done")) setShowTour(true);
      if (Notification.permission === "granted") scheduleNotifications();
    };
    init();
  }, [user, isGuest]);

  const syncToCloud = useCallback(async () => {
    if (isGuest || !user) return;
    const todayKey = getTodayKey();
    await Promise.all([
      saveDailySession(user.id, todayKey, {
        level, totalScore: totalRef.current, levelScore: levelScoreRef.current,
        tiles, submitted: submittedRef.current, perfectDay: perfectDayRef.current,
        tileCount: tileCountRef.current, levelTime: levelTimeRef.current,
        totalTime: totalTimeRef.current, longestWordToday, levelComplete, newBestTime, undoUsed,
        gameIndex: gameIndexRef.current,
      }),
      saveGameState(user.id, {
        playerName: playerNameRef.current || playerName || '',
        lifetimePoints: lifetimeRef.current, lastPlayedDate: todayKey,
        currentStreak: statsData.currentStreak, longestStreak: statsData.longestStreak,
        lastStreakDate: statsData.lastStreakDate, badges: badgeStore.lifetime,
        stats: {...statsData, playerName: playerNameRef.current || playerName}, timeRecords: timeLeaderboard,
      }),
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

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => { levelTimeRef.current += 1; totalTimeRef.current += 1; setLevelTime(levelTimeRef.current); setTotalTime(totalTimeRef.current); }, 1000);
  }, []);
  const stopTimer = useCallback(() => { clearInterval(timerRef.current); timerRef.current = null; }, []);
  const resetLevelTimer = useCallback(() => { levelTimeRef.current = 0; setLevelTime(0); }, []);
  useEffect(() => { stopTimer(); return () => stopTimer(); }, []); // timer starts on Lets Go

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
  const awardBadge = useCallback((id, extraLabel) => {
    const def = BADGE_DEFS.find(b => b.id === id);
    if (!def) return;
    setBadgeStore(prev => {
      const todayKey = getTodayKey(); const weekKey = getWeekKey();
      const lifetimeHas = prev.lifetime.includes(id);
      const weeklyHas = (prev.weekly[weekKey] || []).includes(id);
      const dailyHas = (prev.daily[todayKey] || []).includes(id);
      let needsAward = false;
      if (def.scope === "lifetime" && !lifetimeHas) needsAward = true;
      if (def.scope === "daily" && !dailyHas) needsAward = true;
      if (def.scope === "weekly" && !weeklyHas) needsAward = true;
      if (def.scope === "all") {
        if (!lifetimeHas || !weeklyHas || !dailyHas) needsAward = true;
      }
      if (!needsAward) return prev;
      const showPopup = !lifetimeHas || (def.scope === "daily" && !dailyHas) || (def.scope === "all" && !dailyHas);
      if (showPopup) {
        setShowBadge(id);
        setShowBadgeExtra(extraLabel || "");
        setTimeout(() => { setShowBadge(null); setShowBadgeExtra(""); }, 2800);
      }
      const updated = awardBadgeToStore(prev, id, def.scope);
      saveBadgeStore(updated);
      return updated;
    });
  }, []);

  const flashNewRecord = useCallback((type, value, lvl) => {
    const label = type === "score" ? `🏆 New Level ${lvl} High Score: ${value.toLocaleString()} pts!` : `⚡ New Level ${lvl} Best Time: ${formatTime(value)}!`;
    setNewRecord({ type, value, level: lvl, label });
    if (type === "score") { setPulseScore(true); setTimeout(() => setPulseScore(false), 2000); }
    else { setPulseTime(true); setTimeout(() => setPulseTime(false), 2000); }
    setTimeout(() => setNewRecord(null), 2500);
  }, []);

  const handleFullReset = useCallback(() => {
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
    setPerfectDaySync(true); setPerfectDayAchieved(false); setLongestWordToday("");
    setShowRepeatPerfect(false); setNewBestTime(false);
    setUndoUsed(false); setLastValidEntry(null); setShowUndoConfirm(false);
    setBonusRetryUsed(false); setShowBonusUnsuccessful(false); setShowBonusRestart(false); setShowBonusNo(false); setBonusRestartChoice(null);
    setPerfectDayStreakBonus(0);
    levelResetCount.current = 0; clearedLevelsRef.current = {};
    stopTimer(); levelTimeRef.current = 0; totalTimeRef.current = 0;
    setLevelTime(0); setTotalTime(0); startTimer();
    gameIndexRef.current += 1;
    clearLocalSession();
    justResetRef.current = true;
    setShowReadyScreen(true);
    // Don't wipe cloud session — justResetRef flag prevents stale reload
    setShowIntro(true);
  }, [startTimer, stopTimer, setPerfectDaySync]);

  const doLevelReset = useCallback(() => {
    if (ENABLE_BONUS_LEVELS && isBonusLevel(level)) {
      if (bonusRetryUsed) return; // no more retries on bonus levels
      setBonusRetryUsed(true);
      setPerfectDaySync(false);
    } else if (level === 5) {
      if (totalRef.current < 1000) return;
      totalRef.current -= 1000; setTotalScore(totalRef.current);
      setPerfectDaySync(false);
    } else {
      // Any retry on levels 1-4 forfeits Perfect Day
      setPerfectDaySync(false);
    }
    levelResetCount.current += 1;
    setTiles(prev => prev.map(t => ({ ...t, used: false })));
    setSelected([]); resetLevelTimer(); setNewBestTime(false);
    setShowResetConfirm(false); setShowStuckModal(false);
  }, [resetLevelTimer, level, setPerfectDaySync]);

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
    localStorage.setItem("ll_name", playerName); playerNameRef.current = playerName;
    setEditingName(false);
    if (!isGuest && user) await updatePlayerName(user.id, playerName);
  };

  const triggerFarewell = useCallback(() => {
    const bestEntry = submittedRef.current.filter(s => s.valid).reduce((best, s) => !best || s.score > best.score ? s : best, null);
    onFarewell({ totalScore: totalRef.current, bestWord: bestEntry?.word || "", bestWordScore: bestEntry?.score || 0 });
  }, [onFarewell]);

  const getPerfectDayShareText = useCallback(() => {
    const allValid = submittedRef.current.filter(s => s.valid);
    const bestWord = allValid.reduce((b, s) => !b || s.score > b.score ? s : b, null);
    const longestW = allValid.reduce((b, s) => !b || s.word.length > b.word.length ? s : b, null);
    const sharer = playerName ? `${playerName} had a 🌈🏆 Perfect Day on LetterLoot!` : "🌈🏆 PERFECT DAY on LetterLoot!";
    const bonusLine = perfectDayStreakBonus > 0 ? `\n🌈🏆 Streak Bonus: +${perfectDayStreakBonus.toLocaleString()} pts` : "";
    return `${sharer}\n${getShortDate()} · Score: ${totalRef.current} pts · Time: ${formatTime(totalTimeRef.current)} ⏱️${bonusLine}\n🏆 Best Word: ${bestWord?.word || "—"} — ${bestWord?.score || 0} pts\n📏 Longest Word: ${longestW?.word || "—"} — ${longestW?.word?.length || 0} letters\n____________________________\nCheck it out — play free at:\nhttps://letterloot-6k6v.vercel.app/#celebrate\n🌈🏆`;
  }, [playerName, perfectDayStreakBonus]);

  const fetchLeaderboard = async () => {
    try {
      const base = `${import.meta.env.VITE_SUPABASE_URL || "https://zcevszxmoggmcmvyxjtn.supabase.co"}/rest/v1`;
      const hdrs = { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZXZzenhtb2dnbWNtdnl4anRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDExNDIsImV4cCI6MjA5MTE3NzE0Mn0.nZhiDxv5ssCrkHXxaboZ5ziH-M4NqNqPMop2s_gA6NM", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZXZzenhtb2dnbWNtdnl4anRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDExNDIsImV4cCI6MjA5MTE3NzE0Mn0.nZhiDxv5ssCrkHXxaboZ5ziH-M4NqNqPMop2s_gA6NM"}` };
      const [gsRes, todayRes, weekRes] = await Promise.all([
        fetch(`${base}/game_state?select=player_id,player_name,lifetime_points,current_streak,longest_streak,stats&order=lifetime_points.desc&limit=100`, {headers:hdrs}),
        fetch(`${base}/daily_sessions?select=player_id,date_key,total_score,perfect_day,longest_word_today&date_key=eq.${(()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();})()}&limit=100`, {headers:hdrs}),
        fetch(`${base}/daily_sessions?select=player_id,date_key,total_score,perfect_day&date_key=gte.${(()=>{const d=new Date(Date.now()-7*86400000);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();})()}&limit=500`, {headers:hdrs}),
      ]);
      const gs = gsRes.ok ? await gsRes.json() : [];
      const todaySessions = todayRes.ok ? await todayRes.json() : [];
      const weekSessions = weekRes.ok ? await weekRes.json() : [];
      return { gs, todaySessions, weekSessions };
    } catch { return null; }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setProfilePhoto(dataUrl);
      localStorage.setItem('ll_photo', dataUrl);
      // Sync to Supabase if signed in
      if (!isGuest && user) savePlayerPhoto(user.id, dataUrl);
    };
    reader.readAsDataURL(file);
  };
  const handleNicknameSave = (val) => {
    setProfileNickname(val);
    localStorage.setItem("ll_nickname", val);
  };

  const handleSubmit = async () => {
    if (currentWord.length < 3 || validating || paused) return;
    if (!online) { setFlash({ word: "No internet connection!", score: 0, valid: false }); setTimeout(() => setFlash(null), 2000); return; }
    setValidating(true);
    const result = await validateWord(currentWord);
    if (result.source === "timeout") {
      setFlash({ word: "Dictionary lookup timed out — try again.", score: 0, valid: false });
      setTimeout(() => setFlash(null), 3000);
      setShake(true); setTimeout(() => setShake(false), 500);
      setSelected([]); setValidating(false); return;
    }
    const valid = result.valid;
    const isMedical = result.source === "medical";
    const isCollegiate = result.source === "collegiate";
    const baseScore = valid ? currentScore : 0;
    const longBonus = valid ? getLongWordBonus(currentWord.length) : 0;
    const score = baseScore + longBonus;
    const newStreak = valid ? streak + 1 : 0;
    setStreak(newStreak);
    let flashMsg = currentWord;
    if (valid && longBonus > 0) flashMsg = `${currentWord}  +${longBonus} bonus!`;
    setFlash({ word: flashMsg, score, valid, medical: isMedical, collegiate: isCollegiate });
    setTimeout(() => setFlash(null), 2000);
    if (!valid) { setShake(true); setTimeout(() => setShake(false), 500); }
    const newEntry = { word: currentWord, score, valid, medical: isMedical, collegiate: isCollegiate };
    const newSubmitted = [...submittedRef.current, newEntry];
    submittedRef.current = newSubmitted; setSubmitted(newSubmitted);
    appendToDailyHistory(currentWord, score, valid, isMedical, isCollegiate, gameIndexRef.current);
    setDailyHistory(getDailyHistory());

    if (valid) {
      const newTotal = totalRef.current + score;
      totalRef.current = newTotal; setTotalScore(newTotal);
      const newLevelScore = levelScoreRef.current + score;
      levelScoreRef.current = newLevelScore; setLevelScore(newLevelScore);
      const newLifetime = lifetimeRef.current + score;
      lifetimeRef.current = newLifetime; setLifetimePoints(newLifetime);
      if (isGuest) saveLifetimeData(newLifetime);
      const newTiles = tiles.map(t => selected.includes(t.id) ? { ...t, used: true } : t);
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
      if (currentWord.length > (longestWordToday.length||0)) { setLongestWordToday(currentWord); awardBadge("longest_day"); }
      if (currentWord.length > (longestWordAllTime.length||0)) { setLongestWordAllTime(currentWord); localStorage.setItem("ll_longest", currentWord); }
      if (isMedical) awardBadge("medical_word");
      const validCount = newSubmitted.filter(s => s.valid).length;
      if (validCount === 1) awardBadge("first_word");
      // Space badge ladder — update date on each earn
      if (score >= 100) { awardBadge("rocket"); updateLocalStats({ spaceBadge: "rocket" }); }
      if (score >= 125) { awardBadge("shuttle"); updateLocalStats({ spaceBadge: "shuttle" }); }
      if (score >= 150) { awardBadge("moon"); updateLocalStats({ spaceBadge: "moon" }); }
      if (score >= 175) { awardBadge("mars"); updateLocalStats({ spaceBadge: "mars" }); }
      if (score >= 200) { awardBadge("jupiter"); updateLocalStats({ spaceBadge: "jupiter" }); }
      if (score > 200) { awardBadge("infinity", `${score} pts!`); updateLocalStats({ spaceBadge: "infinity", infinityScore: score }); }
      if (score >= 100) awardBadge("century");
      if (currentWord.length >= 7) awardBadge("long_word");
      if (currentWord.length >= 8) awardBadge("long_8");
      if (currentWord.length >= 10) awardBadge("long_10");
      if (currentWord.length >= 13) awardBadge("long_13");
      if (newStreak >= 3) awardBadge("streak_3");
      if (newStreak >= 5) awardBadge("streak_5");
      if (newTotal >= 500) awardBadge("daily_500");
      if (newTotal >= 1000) awardBadge("daily_1000");
      if (currentWord.toUpperCase().includes("Q")) awardBadge("perfect_q");
      if (currentWord.toUpperCase().split("").filter(l => VOWELS.has(l)).length >= 4) awardBadge("vowel_rich");
      if (ats.words >= 50) awardBadge("all_time_50");
      if (ats.words >= 100) awardBadge("all_time_100");
      if (newLifetime >= 1000) awardBadge("points_1k");
      if (newLifetime >= 5000) awardBadge("points_5k");
      if (newLifetime >= 10000) awardBadge("points_10k");
      if (updated.currentStreak >= 7) awardBadge("streak_7");
      if (updated.currentStreak >= 30) awardBadge("streak_30");
      if (levelTimeRef.current < 180) awardBadge("speed_demon");
      if (levelResetCount.current === 0) awardBadge("no_retreat");
      const allUsed = newTiles.every(t => t.used);
      if (allUsed) {
        awardBadge(`all_tiles_${level}`);
        const bonus = 100 * level;
        totalRef.current += bonus; setTotalScore(totalRef.current);
        levelScoreRef.current += bonus; setLevelScore(levelScoreRef.current);
        lifetimeRef.current += bonus; setLifetimePoints(lifetimeRef.current);
        if (isGuest) saveLifetimeData(lifetimeRef.current);
        setFlash({ word: "BOARD CLEAR!", score: bonus, valid: true });
        setConfetti(true); setTimeout(() => setConfetti(false), 4000);
        stopTimer();
        const clearedTime = levelTimeRef.current;
        const clearedLevelScore = levelScoreRef.current;
        clearedLevelsRef.current[level] = clearedTime;
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
          setTimeout(() => setLevelComplete(true), 1200);
        } else {
          localStorage.setItem("ll_completed_today", getTodayKey());
          if (perfectDayRef.current) {
            const alreadyPerfectToday = (statsData.perfectDaysWeek?.[getTodayKey()] || 0) >= 1;
            if (alreadyPerfectToday) {
              setTimeout(() => setShowRepeatPerfect(true), 1000);
            } else {
              setPerfectDayAchieved(true); awardBadge("perfect_day");
              // ── Streak bonus: 2,000 × consecutive perfect days ──
              const perfStreak = Math.max(1, (statsData.currentStreak || 1));
              const streakBonus = perfStreak * 2000;
              setPerfectDayStreakBonus(streakBonus);
              totalRef.current += streakBonus; setTotalScore(totalRef.current);
              lifetimeRef.current += streakBonus; setLifetimePoints(lifetimeRef.current);
              if (isGuest) saveLifetimeData(lifetimeRef.current);
              // ── Check bonus level unlock ──
              if (ENABLE_BONUS_LEVELS) {
                const newConsecutive = getConsecutivePerfectDays({...statsData, perfectDaysAllTime: (statsData.perfectDaysAllTime||0)+1});
                if (newConsecutive >= BONUS_CONSECUTIVE_REQUIRED && !bonusLevelUnlocked) {
                  setBonusLevelUnlocked(true);
                  awardBadge("vault_streak");
                  setTimeout(() => setShowBonusUnlock(true), 3000);
                }
              }
              setRainbowConfetti(true); setTimeout(() => setRainbowConfetti(false), 6000);
              const perfStats = updateLocalStats({ perfectDay: true }); setStatsData(perfStats);
              const updatedTimes2 = addLocalPerfectTime(playerName||"You", totalTimeRef.current);
              setTimeLeaderboard(updatedTimes2);
              setTimeout(() => setShowNameInput(true), 1000);
            }
          } else setTimeout(() => setShowNameInput(true), 1500);
        }
        if (!isGuest && user) await syncToCloud();
      } else {
        scheduleSyncToCloud();
        stopTimer();
        setCheckingStuck(true);
        const hasWords = await hasValidWordsRemaining(newTiles);
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
      }
    }
    setSelected([]); setValidating(false);
  };

  const handleNextLevel = (bought = false) => {
    if (bought) setPerfectDaySync(false);
    const newLevel = level + 1;
    setLevel(newLevel); setLevelComplete(false); setShowBuyModal(false);
    levelScoreRef.current = 0; setLevelScore(0);
    const rng = seededRandom(getDailySeed() + newLevel * 999);
    const count = 42 + (newLevel - 1) * 6;
    const bp = getBonusPositions(count, getBonusCount(newLevel), rng);
    const newTiles = generateLevelTiles(newLevel, tileCountRef.current, rng, bp);
    tileCountRef.current += count;
    setTiles(newTiles); setSelected([]);
    levelResetCount.current = 0; resetLevelTimer(); startTimer(); setNewBestTime(false);
    if (newLevel === 2) awardBadge("level_2");
    if (newLevel === 3) awardBadge("level_3");
    if (newLevel === 4) awardBadge("level_4");
    if (newLevel === 5) awardBadge("level_5");
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
    const count = 42 + (level - 1) * 6;
    const bp = getBonusPositions(count, getBonusCount(level), rng);
    setTiles(generateLevelTiles(level, tileCountRef.current, rng, bp));
    tileCountRef.current += count; setSelected([]); setShowStuckModal(false); startTimer();
  };
  const handleSaveScore = async () => {
    if (!playerName.trim()) return;
    localStorage.setItem("ll_name", playerName);
    if (!isGuest && user) { await updatePlayerName(user.id, playerName); await syncToCloud(); }
    setShowNameInput(false); clearLocalSession();
  };
  const handleGiveUp = () => { setShowStuckModal(false); setShowNameInput(true); };
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
    { emoji:"⏸️", title:"Use Pause", body:"The Pause button stops your timer completely. Use it whenever you need a moment to plan your next move without the clock running." },
    { emoji:"📜", title:"History Tracks Everything", body:"The History button shows all words played — and tried but not accepted — for the entire current day across all your games." },
    { emoji:"🎯", title:"Save Your UNDO", body:"You get one UNDO per game for 1,000 pts. Save it for a strategic moment in a later level when you really need to reverse a costly mistake." },
    { emoji:"🍀", title:"Good Luck Looting!", body:"Every tile has a value. Every word is a score. Every day is a fresh board. Now go get that loot!" },
  ];

  if (showIntro) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0a0820 0%,#1e1a4a 50%,#0f0e28 100%)",fontFamily:"Georgia,serif",color:"#f5f0e8",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 24px",position:"relative",overflow:"hidden"}}>
      <Starfield/>
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:360,textAlign:"center"}}>
        <PencilLogo size={160}/>
        <div style={{marginTop:12,background:"rgba(139,92,246,0.25)",border:"2.5px solid rgba(167,139,250,0.95)",borderRadius:14,padding:"8px 24px",boxShadow:"0 0 28px rgba(139,92,246,0.5)"}}>
          <span style={{fontSize:28,fontWeight:"bold",letterSpacing:5,color:"#ffffff",textShadow:"0 0 16px rgba(167,139,250,0.85)"}}>LetterLoot</span>
        </div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:6,letterSpacing:1}}>Daily word puzzle · Every letter has a value</div>

        {/* ── Profile section ── */}
        <div style={{marginTop:16,width:"100%",background:"rgba(255,255,255,0.05)",borderRadius:16,padding:"16px",border:"1px solid rgba(255,255,255,0.12)"}}>
          {!editingProfile ? (
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              {/* Photo */}
              <div style={{position:"relative",flexShrink:0}} onClick={()=>setEditingProfile(true)}>
                {profilePhoto
                  ? <img src={profilePhoto} alt="profile" style={{width:60,height:60,borderRadius:"50%",objectFit:"cover",border:"2.5px solid rgba(34,211,238,0.7)",cursor:"pointer"}}/>
                  : <div style={{width:60,height:60,borderRadius:"50%",background:"rgba(34,211,238,0.1)",border:"2px dashed rgba(34,211,238,0.5)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:22}}>👤</div>
                }
                <div style={{position:"absolute",bottom:0,right:0,background:"rgba(34,211,238,0.9)",borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,cursor:"pointer"}}>✏️</div>
              </div>
              {/* Name/nickname */}
              <div style={{flex:1,textAlign:"left"}}>
                <div style={{fontSize:16,fontWeight:"bold",color:"#22d3ee"}}>
                  {profileNickname || playerName || "Guest"}
                </div>
                {profileNickname && playerName && profileNickname !== playerName &&
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2}}>{playerName}</div>
                }
                <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:4,cursor:"pointer"}} onClick={()=>setEditingProfile(true)}>
                  Tap to edit profile ✏️
                </div>
                {/* Show sign in prompt if not authenticated */}
                {isGuest && (
                  <button onClick={onSignOut} style={{marginTop:6,padding:"4px 12px",borderRadius:10,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:10,fontWeight:"bold",fontFamily:"Georgia,serif",border:"none",cursor:"pointer"}}>
                    🔑 Sign In to sync across devices
                  </button>
                )}
                {/* Show sign out option if authenticated */}
                {!isGuest && (
                  <button onClick={onSignOut} style={{marginTop:6,padding:"3px 10px",borderRadius:10,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.4)",fontSize:9,fontFamily:"Georgia,serif",cursor:"pointer"}}>
                    Sign Out
                  </button>
                )}
              </div>
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
                  <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{display:"none"}}/>
                  <button onClick={()=>photoInputRef.current?.click()} style={{padding:"6px 10px",borderRadius:10,background:"rgba(34,211,238,0.15)",border:"1px solid rgba(34,211,238,0.5)",color:"#22d3ee",fontSize:11,fontFamily:"Georgia,serif",cursor:"pointer",fontWeight:"bold"}}>
                    📷 Choose / Take Photo
                  </button>
                  {profilePhoto && <button onClick={()=>{ setProfilePhoto(null); localStorage.removeItem("ll_photo"); }} style={{padding:"4px 10px",borderRadius:10,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.4)",fontSize:10,fontFamily:"Georgia,serif",cursor:"pointer"}}>Remove Photo</button>}
                </div>
              </div>
              {/* Nickname input */}
              <div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginBottom:4,textAlign:"left"}}>Nickname (shown on welcome screen)</div>
                <input
                  value={profileNickname}
                  onChange={e=>setProfileNickname(e.target.value)}
                  onBlur={e=>handleNicknameSave(e.target.value)}
                  placeholder={playerName || "Enter a nickname…"}
                  style={{width:"100%",padding:"8px 12px",borderRadius:10,border:"1px solid rgba(34,211,238,0.4)",background:"rgba(34,211,238,0.08)",color:"#f5f0e8",fontSize:13,fontFamily:"Georgia,serif",outline:"none",textAlign:"center"}}
                />
              </div>
              <button onClick={()=>{ handleNicknameSave(profileNickname); setEditingProfile(false); }} style={{padding:"8px",borderRadius:10,background:"linear-gradient(135deg,#22d3ee,#0ea5e9)",color:"#0a0820",fontSize:12,fontWeight:"bold",fontFamily:"Georgia,serif",border:"none",cursor:"pointer"}}>
                ✓ Save Profile
              </button>
            </div>
          )}
        </div>

        {/* Welcome message */}
        <div style={{marginTop:12,fontSize:17,fontWeight:"bold",color:"#22d3ee"}}>
          {(profileNickname||playerName) ? `Welcome back, ${profileNickname||playerName}! 👋` : "Welcome! 👋"}
        </div>

        {/* Game info */}
        <div style={{marginTop:12,background:"rgba(255,255,255,0.06)",borderRadius:16,padding:"16px",border:"1px solid rgba(255,255,255,0.15)",width:"100%"}}>
          <div style={{fontSize:14,color:"#f5f0e8",lineHeight:1.8}}>Spell words from the tiles.<br/>Every letter has a point value.<br/>Clear all 5 levels for a <span style={{color:"#f6d365",fontWeight:"bold"}}>Perfect Day 🌈🏆</span>!</div>
          <div style={{marginTop:10,fontSize:12,color:"#22d3ee",fontFamily:"Georgia,serif",lineHeight:1.6}}>
            ✨ Fresh board every day at midnight<br/>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>(your local time — {(()=>{ const d=new Date(); d.setHours(24,0,0,0); return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', timeZoneName:'short'}); })()})</span>
          </div>
          <div style={{marginTop:10,background:"rgba(246,211,101,0.1)",borderRadius:10,padding:"8px 10px",border:"1px solid rgba(246,211,101,0.3)"}}>
            <div style={{fontSize:11,color:"#f6d365",fontWeight:"bold"}}>🏆 Global Leaderboard available to all registered players!</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:3}}>Top Scores · Best Words · Longest Words · Perfect Days · Streaks</div>
          </div>
        </div>

        <button onClick={()=>{
          setEditingProfile(false);
          // If all tiles used (completed game), force a fresh reset before showing play screen
          const allUsed = tiles.every(t => t.used);
          if (allUsed || level === 5) {
            const rng = seededRandom(getDailySeed());
            const bp = getBonusPositions(42, getBonusCount(1), rng);
            setTiles(generateLevelTiles(1, 0, rng, bp));
            tileCountRef.current = 42; setLevel(1); setSelected([]);
            setSubmitted([]); submittedRef.current = [];
            setTotalScore(0); totalRef.current = 0;
            setLevelScore(0); levelScoreRef.current = 0;
            setStreak(0); setLevelComplete(false);
            setPerfectDaySync(true); setLongestWordToday("");
            setUndoUsed(false); setLastValidEntry(null);
            stopTimer(); levelTimeRef.current = 0; totalTimeRef.current = 0;
            setLevelTime(0); setTotalTime(0); startTimer();
            clearLocalSession();
          }
          // Show ready prompt — timer starts only when player taps Ready
          stopTimer();
          setShowIntro(false);
          setShowReadyToPlay(true);
        }} style={{marginTop:20,width:"100%",padding:"16px",borderRadius:16,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:18,fontWeight:"bold",letterSpacing:2,border:"none",cursor:"pointer",fontFamily:"Georgia,serif",boxShadow:"0 0 28px rgba(246,211,101,0.4)"}}>
          ✏️ PLAY NOW
        </button>
      </div>
    </div>
  );

  if (showReadyScreen) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0a0820 0%,#1e1a4a 50%,#0f0e28 100%)",fontFamily:"Georgia,serif",color:"#f5f0e8",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"30px 24px",position:"relative",overflow:"hidden"}}>
      <Starfield/>
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:360,textAlign:"center"}}>
        {profilePhoto
          ? <img src={profilePhoto} alt="profile" style={{width:80,height:80,borderRadius:"50%",objectFit:"cover",border:"3px solid rgba(34,211,238,0.7)",marginBottom:16}}/>
          : <div style={{fontSize:56,marginBottom:16}}>✏️</div>
        }
        <div style={{fontSize:22,fontWeight:"bold",color:"#22d3ee",marginBottom:8}}>
          {profileNickname||playerName ? `Ready, ${profileNickname||playerName}?` : "Ready to Play?"}
        </div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",marginBottom:24,lineHeight:1.7}}>
          Your tiles are set.<br/>The clock starts when you do.
        </div>
        <div style={{background:"rgba(255,255,255,0.06)",borderRadius:16,padding:"16px 20px",border:"1px solid rgba(255,255,255,0.12)",marginBottom:28,width:"100%",fontSize:12,color:"rgba(255,255,255,0.6)",lineHeight:1.9}}>
          <div>✦ Level 1 — 42 tiles ready</div>
          <div>✦ Timer starts on <strong style={{color:"#f6d365"}}>Let's Go!</strong></div>
          <div>✦ Clear all 5 levels for a <span style={{color:"#6ee7b7",fontWeight:"bold"}}>Perfect Day 🌈🏆</span></div>
        </div>
        <button onClick={()=>{ setShowReadyScreen(false); startTimer(); }} style={{width:"100%",padding:"20px",borderRadius:16,background:"linear-gradient(135deg,#00c853,#00e676)",color:"#003300",fontSize:20,fontWeight:"bold",letterSpacing:2,border:"none",cursor:"pointer",fontFamily:"Georgia,serif",boxShadow:"0 0 32px rgba(0,200,83,0.5)"}}>
          Let's Go! 🎯
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#0a0820 0%,#1e1a4a 50%,#0f0e28 100%)", fontFamily:"Georgia,serif", color:"#f5f0e8", display:"flex", flexDirection:"column", alignItems:"center", paddingBottom:40, position:"relative", overflow:"hidden" }}>
      <Starfield/>
      <style>{`
        @keyframes twinkle{from{opacity:0.08}to{opacity:0.7}}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
        @keyframes pop{0%{transform:translate(-50%,-50%) scale(0.6);opacity:0}60%{transform:translate(-50%,-50%) scale(1.08)}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
        @keyframes slideUp{from{transform:translateY(18px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes badgePop{0%{transform:translateX(-50%) translateY(40px) scale(0.8);opacity:0}20%{transform:translateX(-50%) translateY(0) scale(1.05);opacity:1}80%{transform:translateX(-50%) translateY(0) scale(1);opacity:1}100%{transform:translateX(-50%) translateY(-20px) scale(0.9);opacity:0}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes rainbow{0%{color:#ff0000}16%{color:#ff8800}33%{color:#ffff00}50%{color:#00ff00}66%{color:#0088ff}83%{color:#8800ff}100%{color:#ff0000}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
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

      {newRecord&&<div style={{position:"fixed",top:"35%",left:"50%",zIndex:9998,animation:"recordFade 2.5s ease forwards",background:newRecord.type==="score"?"linear-gradient(135deg,rgba(246,211,101,0.97),rgba(253,160,133,0.97))":"linear-gradient(135deg,rgba(96,165,250,0.97),rgba(139,92,246,0.97))",borderRadius:20,padding:"16px 28px",boxShadow:"0 8px 40px rgba(0,0,0,0.7)",textAlign:"center",whiteSpace:"nowrap",border:"2px solid rgba(255,255,255,0.5)"}}>
        <div style={{fontSize:22,fontWeight:"bold",color:"#1a1a2e",letterSpacing:1}}>{newRecord.label}</div>
        <div style={{fontSize:11,color:"rgba(0,0,0,0.55)",marginTop:4,letterSpacing:2}}>PERSONAL BEST</div>
      </div>}

      {showDecayWarning&&<div style={{position:"fixed",inset:0,zIndex:99998,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:decayInfo.wasReset?"linear-gradient(135deg,#1a0a0a,#3d1010)":"linear-gradient(135deg,#1a0a0a,#2d1a10)",borderRadius:28,padding:"40px 32px",textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:`2px solid ${decayInfo.wasReset?"rgba(220,38,38,0.6)":"rgba(251,146,60,0.6)"}`,maxWidth:340,width:"90%"}}>
          <div style={{fontSize:56}}>{decayInfo.wasReset?"😱":"⚠️"}</div>
          <div style={{fontSize:22,fontWeight:"bold",color:decayInfo.wasReset?"#ef4444":"#fb923c",marginTop:10}}>{decayInfo.wasReset?"Points Reset to Zero!":decayInfo.missedDays===1?"You Missed 1 Day!":"You Missed 2 Days!"}</div>
          <div style={{fontSize:14,color:"#f5f0e8",marginTop:12,lineHeight:1.7}}>
            {decayInfo.wasReset?<>Your lifetime points have reset to <span style={{color:"#ef4444",fontWeight:"bold",fontSize:18}}>ZERO</span>.<br/>Play every day to protect your points!</>
            :decayInfo.missedDays===1?<>You lost <span style={{color:"#fb923c",fontWeight:"bold"}}>1/3</span> of your lifetime points.<br/>Don't miss another day!</>
            :<>You've lost <span style={{color:"#fb923c",fontWeight:"bold"}}>2/3</span> of your lifetime points.<br/>One more missed day → <span style={{color:"#ef4444",fontWeight:"bold"}}>ZERO</span>!</>}
          </div>
          {!decayInfo.wasReset&&<div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginTop:8}}>Remaining: <span style={{color:"#f6d365",fontWeight:"bold"}}>{lifetimePoints.toLocaleString()} pts</span></div>}
          <button className="ll-btn" onClick={()=>setShowDecayWarning(false)} style={{marginTop:24,width:"100%",padding:"14px",borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:15,fontWeight:"bold"}}>I'll Play Every Day! 💪</button>
        </div>
      </div>}

      {showTour&&<VisualTour onDone={completeTour}/>}

      {showBadge&&(()=>{ const b=BADGE_DEFS.find(x=>x.id===showBadge); return b?(<div style={{position:"fixed",top:72,left:"50%",zIndex:9998,animation:"badgePop 2.8s forwards",background:"linear-gradient(135deg,#f6d365,#fda085)",borderRadius:20,padding:"12px 26px",boxShadow:"0 8px 32px rgba(0,0,0,0.7)",textAlign:"center",whiteSpace:"nowrap"}}>
        <div style={{display:"flex",justifyContent:"center"}}>{renderBadgeIcon(b)}</div>
        <div style={{fontWeight:"bold",color:"#1a1a2e",fontSize:13}}>Badge Earned!</div>
        <div style={{color:"#2d1b00",fontSize:12,fontWeight:"bold"}}>{b.label}{showBadgeExtra?` — ${showBadgeExtra}`:""}</div>
      </div>):null; })()}

      {flash&&<div style={{position:"fixed",top:"40%",left:"50%",zIndex:9997,animation:"pop 0.3s ease forwards",background:flash.valid?(flash.medical?"rgba(0,150,200,0.97)":"rgba(30,160,70,0.97)"):"rgba(190,30,30,0.96)",borderRadius:18,padding:"14px 30px",boxShadow:"0 6px 28px rgba(0,0,0,0.7)",textAlign:"center"}}>
        <div style={{fontSize:20,fontWeight:"bold",letterSpacing:3,color:"#fff"}}>{flash.word}</div>
        <div style={{fontSize:flash.valid?16:13,color:"#fff",marginTop:4}}>{flash.valid&&flash.score>0?`+${flash.score} pts ${flash.medical?"🩺 Medical":flash.collegiate?"📖":""}`:flash.valid?"":("Not a valid word!")}</div>
      </div>}

      {(validating||checkingStuck)&&<div style={{position:"fixed",top:"40%",left:"50%",transform:"translate(-50%,-50%)",background:"rgba(10,8,30,0.97)",borderRadius:20,padding:"18px 34px",zIndex:9996,boxShadow:"0 6px 30px rgba(0,0,0,0.8)",textAlign:"center",border:"1px solid rgba(255,255,255,0.2)"}}>
        <div style={{animation:"spin 1s linear infinite",display:"inline-block",transformOrigin:"center"}}><PencilIcon size={60}/></div>
        <div style={{fontSize:12,marginTop:8,color:"#ccc",letterSpacing:2}}>{checkingStuck?"SCANNING TILES…":"CHECKING…"}</div>
      </div>}

      {showUndoConfirm&&<div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:"32px",textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,255,255,0.18)",maxWidth:300,width:"90%"}}>
          <div style={{fontSize:40}}>↩️</div>
          <div style={{fontSize:18,fontWeight:"bold",color:"#f5f0e8",marginTop:8}}>Undo Last Word?</div>
          <div style={{fontSize:13,color:"#bbb",marginTop:8,lineHeight:1.6}}>Reverse <span style={{color:"#f6d365",fontWeight:"bold"}}>{lastValidEntry?.word}</span> (+{lastValidEntry?.score} pts)<br/>Cost: <span style={{color:"#fb7185",fontWeight:"bold"}}>{isBonusLevel(level)?"10,000 pts":"1,000 pts"}</span><br/>Your balance: {totalScore} pts</div>
          <div style={{fontSize:11,color:"#6ee7b7",marginTop:6}}>✓ Your Perfect Day stays intact</div>
          <button className="ll-btn" onClick={handleUndo} style={{marginTop:16,width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:14,fontWeight:"bold"}}>↩️ Yes, Undo — 1,000 pts</button>
          <button className="ll-btn" onClick={()=>setShowUndoConfirm(false)} style={{marginTop:8,width:"100%",padding:"10px",borderRadius:12,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.5)",fontSize:12}}>Keep It</button>
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
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:"32px",textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,255,255,0.18)",maxWidth:320,width:"90%"}}>
          <div style={{fontSize:52}}>😬</div>
          <div style={{fontSize:20,fontWeight:"bold",color:"#f5f0e8",marginTop:8}}>No More Valid Words!</div>
          <div style={{fontSize:13,color:"#bbb",marginTop:8,lineHeight:1.6}}>No valid words can be formed from the remaining tiles.</div>
          <div style={{fontSize:22,color:"#f6d365",fontWeight:"bold",marginTop:10}}>{totalScore} pts so far</div>
          {/* UNDO option if still available */}
          {!undoUsed&&lastValidEntry&&totalRef.current>=1000&&(
            <button className="ll-btn" onClick={()=>{ setShowStuckModal(false); setShowUndoConfirm(true); }} style={{marginTop:14,width:"100%",padding:"12px",borderRadius:12,background:"linear-gradient(135deg,rgba(251,113,133,0.6),rgba(225,29,72,0.5))",border:"1px solid rgba(251,113,133,0.9)",color:"#ffffff",fontSize:13,fontWeight:"bold"}}>
              ↩️ UNDO Last Word — 1,000 pts
              <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",fontWeight:"normal",marginTop:2}}>Reverse "{lastValidEntry?.word}" and try different tiles</div>
            </button>
          )}
          <button className="ll-btn" onClick={doLevelReset} disabled={level===5&&totalRef.current<1000} style={{marginTop:8,width:"100%",padding:"12px",borderRadius:12,background:level===5&&totalRef.current<1000?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#60a5fa,#3b82f6)",color:level===5&&totalRef.current<1000?"rgba(255,255,255,0.3)":"#fff",fontSize:13,fontWeight:"bold",cursor:level===5&&totalRef.current<1000?"default":"pointer"}}>
            {level===5?`🔄 ReTry L5 — 1,000 pts${totalRef.current<1000?" (not enough)":""}`:` 🔄 Try Level ${level} Again`}
          </button>
          {level<5&&<button className="ll-btn" onClick={handleBuyLevel} disabled={!canBuy} style={{marginTop:8,width:"100%",padding:"12px",borderRadius:12,background:canBuy?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.08)",color:canBuy?"#1a1a2e":"rgba(255,255,255,0.3)",fontSize:13,fontWeight:"bold",cursor:canBuy?"pointer":"default"}}>🔓 Buy Level {level+1} — {buyCost} pts{!canBuy?" (not enough)":""}</button>}
          {level===5&&<button className="ll-btn" onClick={handleExtendLevel5} disabled={totalRef.current<5000} style={{marginTop:8,width:"100%",padding:"12px",borderRadius:12,background:totalRef.current>=5000?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.08)",color:totalRef.current>=5000?"#1a1a2e":"rgba(255,255,255,0.3)",fontSize:13,fontWeight:"bold",cursor:totalRef.current>=5000?"pointer":"default"}}>
    🆕 Fresh Tiles — 5,000 pts{totalRef.current<5000?" (not enough)":""}
    <div style={{fontSize:10,fontWeight:"normal",marginTop:2,opacity:0.8}}>Brand new set of Level 5 tiles · Perfect Day stays intact!</div>
  </button>}
          <button className="ll-btn" onClick={handleGiveUp} style={{marginTop:8,width:"100%",padding:"12px",borderRadius:12,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.5)",fontSize:12}}>{level===5?"😬 Give Up — See Summary":"📊 End & Save Score"}</button>
        </div>
      </div>}

      {showBuyModal&&<div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:"32px",textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,255,255,0.18)",maxWidth:300,width:"90%"}}>
          <div style={{fontSize:44}}>🔓</div>
          <div style={{fontSize:20,fontWeight:"bold",color:"#f5f0e8",marginTop:8}}>Buy Level {level+1}?</div>
          <div style={{fontSize:13,color:"#bbb",marginTop:8,lineHeight:1.6}}>Spend points to unlock the next level.</div>
          <div style={{fontSize:24,color:"#f6d365",fontWeight:"bold",marginTop:12}}>{buyCost} pts</div>
          <div style={{fontSize:12,color:totalScore>=buyCost?"#6ee7b7":"#fb7185",marginTop:4}}>You have: {totalScore} pts · {totalScore>=buyCost?"✓ Enough":"✗ Not enough"}</div>
          <div style={{fontSize:11,color:"#f093fb",marginTop:6}}>⚠️ Buying forfeits Perfect Day and time records</div>
          <button className="ll-btn" onClick={handleBuyLevel} disabled={!canBuy} style={{marginTop:16,width:"100%",padding:"13px",borderRadius:14,background:canBuy?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.1)",color:canBuy?"#1a1a2e":"rgba(255,255,255,0.3)",fontSize:14,fontWeight:"bold",cursor:canBuy?"pointer":"default"}}>{canBuy?`Unlock Level ${level+1} — ${buyCost} pts`:"Not enough points"}</button>
          <button className="ll-btn" onClick={()=>setShowBuyModal(false)} style={{marginTop:8,width:"100%",padding:"10px",borderRadius:12,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.5)",fontSize:12}}>Keep Playing</button>
        </div>
      </div>}

      {perfectDayAchieved&&<div style={{position:"fixed",inset:0,zIndex:9500,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",overflowY:"auto"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:28,padding:"32px 28px",textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:"2px solid rgba(255,215,0,0.5)",maxWidth:340,width:"90%",margin:"20px auto"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:4}}><RainbowPot size={130}/></div>
          <div style={{fontSize:24,fontWeight:"bold",marginTop:8}} className="perfect-text">PERFECT DAY!</div>
          <div style={{fontSize:13,color:"#f5f0e8",marginTop:10,lineHeight:1.7,fontStyle:"italic"}}>"{congratsMsg}"</div>
          <div style={{marginTop:12,background:"rgba(255,255,255,0.08)",borderRadius:12,padding:"10px",fontSize:12,color:"#ccc",lineHeight:1.6}}>🏆 {playerName||"You"}<br/>{getShortDate()}<br/>Score: {totalScore} pts · Time: {formatTime(totalTimeRef.current)}<br/>💰 Lifetime: {lifetimePoints.toLocaleString()} pts</div>
          <button className="ll-btn" onClick={()=>{ setLeaderboardFromPerfectDay(true); setPerfectDayAchieved(false); setTab('leaderboard'); }} style={{marginTop:12,width:"100%",padding:"11px",borderRadius:14,background:"rgba(246,211,101,0.15)",border:"1px solid rgba(246,211,101,0.5)",color:"#f6d365",fontSize:13,fontWeight:"bold"}}>
            🏆 Check Leaderboard
          </button>
          <button className="ll-btn" onClick={()=>{
            navigator.clipboard?.writeText(getPerfectDayShareText());
            setShareCopied(true); setTimeout(() => setShareCopied(false), 4000);
          }} style={{marginTop:8,width:"100%",padding:"12px",borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:13,fontWeight:"bold"}}>
            {shareCopied?"✓ Copied!":"📋 Save & Share!"}
          </button>
          {shareCopied&&<div style={{fontSize:11,color:"#6ee7b7",marginTop:4}}>Copied! Paste into a text or email to share.</div>}
          {!playAgainChoice&&(
            <div style={{marginTop:14}}>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.65)",marginBottom:8}}>Want to play again?</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <button className="ll-btn replay-btn" onClick={()=>{ setPlayAgainChoice("now"); setTimeout(()=>{ setPerfectDayAchieved(false); setPlayAgainChoice(null); handleFullReset(); },2000); }} style={{width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,#00c853,#00e676)",color:"#003300",fontSize:14,fontWeight:"bold",border:"none"}}>✏️ Play Now</button>
                <button className="ll-btn" onClick={()=>setPlayAgainChoice("later")} style={{width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,rgba(96,165,250,0.3),rgba(59,130,246,0.2))",border:"1px solid rgba(96,165,250,0.6)",color:"#bfdbfe",fontSize:14,fontWeight:"bold"}}>🌅 Later Today</button>
                <button className="ll-btn" onClick={()=>setPlayAgainChoice("tomorrow")} style={{width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,rgba(167,139,250,0.3),rgba(124,58,237,0.2))",border:"1px solid rgba(167,139,250,0.6)",color:"#e9d5ff",fontSize:14,fontWeight:"bold"}}>🌙 Tomorrow</button>
              </div>
            </div>
          )}
          {playAgainChoice==="now"&&<div style={{marginTop:14,fontSize:20,fontWeight:"bold",color:"#00e676"}}>Let's Go! 🎯</div>}
          {playAgainChoice==="later"&&(<div style={{marginTop:14}}>
            <div style={{fontSize:15,color:"#bfdbfe",lineHeight:1.7,fontWeight:"bold"}}>Nice work so far.<br/>See you later! 🌅</div>
            <button className="ll-btn replay-btn" onClick={()=>{setPerfectDayAchieved(false);setPlayAgainChoice(null);handleFullReset();}} style={{marginTop:14,width:"100%",padding:"14px",borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:14,fontWeight:"bold",border:"none"}}>✏️ Play Now</button>
            <button className="ll-btn" onClick={()=>{setPerfectDayAchieved(false);setPlayAgainChoice(null);handleFullReset();setShowIntro(false);}} style={{marginTop:8,width:"100%",padding:"10px",borderRadius:12,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.6)",fontSize:12}}>Close — I'll be back later</button>
          </div>)}
          {playAgainChoice==="tomorrow"&&(<div style={{marginTop:14}}><div style={{fontSize:14,color:"#e9d5ff",lineHeight:1.8,fontWeight:"bold"}}>New Boards, New Words.<br/>Another Perfect Day will be waiting! 🌙</div><button className="ll-btn" onClick={()=>{setPerfectDayAchieved(false);setPlayAgainChoice(null);}} style={{marginTop:12,width:"100%",padding:"10px",borderRadius:12,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.6)",fontSize:12}}>Close</button></div>)}
        </div>
      </div>}

      {showRepeatPerfect&&<div style={{position:"fixed",inset:0,zIndex:9500,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",overflowY:"auto"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:28,padding:"32px 28px",textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:"2px solid rgba(255,215,0,0.5)",maxWidth:340,width:"90%",margin:"20px auto"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:4}}><RainbowPot size={130}/></div>
          <div style={{fontSize:24,fontWeight:"bold",marginTop:8}} className="perfect-text">PERFECT DAY!</div>
          <div style={{fontSize:13,color:"#f5f0e8",marginTop:10,lineHeight:1.7,fontStyle:"italic"}}>"{congratsMsg}"</div>
          {perfectDayStreakBonus > 0 && (
            <div style={{marginTop:10,background:"linear-gradient(135deg,rgba(246,211,101,0.2),rgba(253,160,133,0.15))",borderRadius:12,padding:"10px",border:"1px solid rgba(246,211,101,0.5)",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:"bold",color:"#f6d365"}}>+{perfectDayStreakBonus.toLocaleString()} pts 🌈🏆</div>
            </div>
          )}
          <div style={{marginTop:10,background:"rgba(255,255,255,0.08)",borderRadius:12,padding:"10px",fontSize:12,color:"#ccc",lineHeight:1.6}}>
            🏆 {playerName||"You"}<br/>{getShortDate()}<br/>
            Score: {totalRef.current} pts · Time: {formatTime(totalTimeRef.current)}<br/>
            💰 Lifetime: {lifetimePoints.toLocaleString()} pts
          </div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:8,lineHeight:1.5}}>
            Only 1 Perfect Day counts per day toward your total — but every one is worth celebrating!
          </div>
          <button className="ll-btn" onClick={()=>{ setLeaderboardFromPerfectDay(true); setShowRepeatPerfect(false); setTab('leaderboard'); }} style={{marginTop:12,width:"100%",padding:"11px",borderRadius:14,background:"rgba(246,211,101,0.15)",border:"1px solid rgba(246,211,101,0.5)",color:"#f6d365",fontSize:13,fontWeight:"bold"}}>
            🏆 Check Leaderboard
          </button>
          <button className="ll-btn" onClick={()=>{
            navigator.clipboard?.writeText(getPerfectDayShareText());
            setShareCopied(true); setTimeout(()=>setShareCopied(false),4000);
          }} style={{marginTop:8,width:"100%",padding:"12px",borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:13,fontWeight:"bold"}}>
            {shareCopied?"✓ Copied!":"📋 Save & Share!"}
          </button>
          {shareCopied&&<div style={{fontSize:11,color:"#6ee7b7",marginTop:4}}>Copied! Paste into a text or email to share.</div>}
          <div style={{fontSize:12,color:"rgba(255,255,255,0.65)",marginTop:14,marginBottom:8}}>Want to play again?</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button className="ll-btn replay-btn" onClick={()=>{setShowRepeatPerfect(false);handleFullReset();}} style={{width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,#00c853,#00e676)",color:"#003300",fontSize:14,fontWeight:"bold",border:"none"}}>✏️ Play Now</button>
            <button className="ll-btn" onClick={()=>{ setShowRepeatPerfect(false); handleFullReset(); }} style={{width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,rgba(96,165,250,0.3),rgba(59,130,246,0.2))",border:"1px solid rgba(96,165,250,0.6)",color:"#bfdbfe",fontSize:14,fontWeight:"bold"}}>🌅 Later Today</button>
            <button className="ll-btn" onClick={()=>{ setShowRepeatPerfect(false); triggerFarewell(); }} style={{width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,rgba(167,139,250,0.3),rgba(124,58,237,0.2))",border:"1px solid rgba(167,139,250,0.6)",color:"#e9d5ff",fontSize:14,fontWeight:"bold"}}>🌙 Tomorrow</button>
          </div>
        </div>
      </div>}

      {levelComplete&&<div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:"36px 32px",textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,215,0,0.35)",maxWidth:320,width:"90%"}}>
          <div style={{fontSize:52}}>🎉</div>
          <div style={{fontSize:26,fontWeight:"bold",color:"#f6d365",marginTop:8}}>Level {level} Complete!</div>
          <div style={{fontSize:13,color:"#ccc",marginTop:8}}>You used every tile!</div>
          <div style={{fontSize:22,color:"#fda085",fontWeight:"bold",marginTop:10}}>+{100*level} Bonus Points!</div>
          <div style={{fontSize:13,color:"#60a5fa",fontWeight:"bold",marginTop:6}}>⏱️ Time: {formatTime(levelTimeRef.current)}</div>
          {newBestTime&&<div style={{fontSize:12,color:"#6ee7b7",fontWeight:"bold",marginTop:4}}>⚡ New Best Time!</div>}
          {timeLeaderboard.levels?.[level]?.length>0&&<div style={{marginTop:8,background:"rgba(255,255,255,0.06)",borderRadius:10,padding:"8px",fontSize:11,color:"#aaa"}}>Best: {formatTime(timeLeaderboard.levels[level][0].seconds)} by {timeLeaderboard.levels[level][0].name}</div>}
          <div style={{fontSize:12,color:"#aaa",marginTop:6}}>Level {level+1}: {42+level*6} tiles · {getBonusCount(level+1)} bonus tiles</div>
          <button className="ll-btn" onClick={()=>handleNextLevel(false)} style={{marginTop:20,width:"100%",padding:"14px",borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:15,fontWeight:"bold"}}>Play Level {level+1} →</button>
        </div>
      </div>}

      {showNameInput&&<div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center"}}>
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
      <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"6px 10px 0"}}>

        {/* ROW 1: Name · Date (center) · 🎸 · Reset · Tour */}
        <div style={{display:"flex",alignItems:"center",gap:3,marginBottom:3}}>
          <span style={{fontSize:11,color:"#22d3ee",fontWeight:"bold",whiteSpace:"nowrap",flexShrink:0,border:"1.5px solid rgba(34,211,238,0.6)",borderRadius:8,padding:"1px 7px",background:"rgba(34,211,238,0.1)"}}>{playerName||"Guest"}</span>
          <span style={{flex:1,fontSize:9,color:"rgba(255,255,255,0.7)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textAlign:"center"}}>{getCalendarDate()}</span>
          <button onClick={()=>setMusicOn(m=>!m)} style={{background:"none",border:"1px solid rgba(255,255,255,0.35)",borderRadius:12,padding:"2px 5px",cursor:"pointer",fontSize:9,color:musicOn?"#f6d365":"rgba(255,255,255,0.6)",fontFamily:"Georgia,serif",flexShrink:0}}>♫</button>
          <button onClick={handleFullReset} style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.5)",borderRadius:12,padding:"2px 7px",cursor:"pointer",fontSize:9,color:"#fca5a5",fontFamily:"Georgia,serif",fontWeight:"bold",flexShrink:0}}>↺ Reset Full Game</button>
          <button onClick={()=>setShowTour(true)} style={{background:"rgba(167,139,250,0.15)",border:"1px solid rgba(167,139,250,0.5)",borderRadius:12,padding:"2px 7px",cursor:"pointer",fontSize:9,color:"#c4b5fd",fontFamily:"Georgia,serif",fontWeight:"bold",flexShrink:0}}>↺ Tour</button>
        </div>

        {/* ROW 2: History · Stats · Tips · Level pill */}
        <div style={{display:"flex",gap:3,alignItems:"center",marginBottom:3}}>
          {[{id:"history",label:"📜 History"},{id:"stats",label:"📊 Stats"},{id:"info",label:"ℹ️ Tips"},{id:"leaderboard",label:"🏆 Leaders"}].map(t=>(
            <button key={t.id} className="ll-tab" onClick={()=>setTab(t.id)} style={{flex:1,padding:"4px 3px",borderRadius:12,fontSize:9,background:tab===t.id?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.1)",color:tab===t.id?"#1a1a2e":"#f0e8d8",fontWeight:tab===t.id?"bold":"normal",border:tab===t.id?"none":"1px solid rgba(255,255,255,0.3)",whiteSpace:"nowrap",textAlign:"center"}}>
              {t.label}
            </button>
          ))}
          <div style={{padding:"4px 10px",borderRadius:12,fontSize:9,fontWeight:"bold",background:"rgba(139,92,246,0.22)",border:"1.5px solid rgba(167,139,250,0.7)",color:"#e9d5ff",whiteSpace:"nowrap",letterSpacing:1,flexShrink:0}}>✦ L{level} ✦</div>
        </div>

        {/* ROW 3: TIME · Level 00:00 · Total 00:00 · Pause */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.07)",borderRadius:7,padding:"3px 8px",marginBottom:3,border:"1px solid rgba(255,255,255,0.18)",gap:4}}>
          <span style={{fontSize:9,color:"rgba(255,255,255,0.7)",fontWeight:"bold",letterSpacing:1,flexShrink:0}}>TIME</span>
          <span style={{fontSize:8,color:"rgba(255,255,255,0.5)",flexShrink:0}}>Level</span>
          <span className={pulseTime?"pulse-big":""} style={{fontSize:12,fontWeight:"bold",color:"#60a5fa",fontFamily:"monospace",flexShrink:0}}>{formatTime(levelTime)}</span>
          <span style={{fontSize:8,color:"rgba(255,255,255,0.5)",flexShrink:0}}>Total</span>
          <span style={{fontSize:12,fontWeight:"bold",color:"#a78bfa",fontFamily:"monospace",flexShrink:0}}>{formatTime(totalTime)}</span>
          <button className="ll-btn" onClick={handlePause} style={{background:paused?"linear-gradient(135deg,#00c853,#00e676)":"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:10,padding:"2px 8px",fontSize:9,color:paused?"#003300":"#ffffff",fontWeight:"bold",flexShrink:0}}>
            {paused?"▶️ Resume":"⏸️ Pause"}
          </button>
        </div>

        {/* ROW 4: Remaining · Vowels · Consonants */}
        <div style={{display:"flex",gap:4,marginBottom:3}}>
          <div style={{flex:1.4,background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.4)",borderRadius:8,padding:"3px 3px",textAlign:"center"}}>
            <div style={{fontSize:12,fontWeight:"bold",color:"#60a5fa"}}>{availableTiles.length}</div>
            <div style={{fontSize:6,color:"rgba(255,255,255,0.75)"}}>REMAINING</div>
          </div>
          <div style={{flex:1,background:"rgba(110,231,183,0.08)",border:"1px solid rgba(110,231,183,0.35)",borderRadius:8,padding:"3px 3px",textAlign:"center"}}>
            <div style={{fontSize:12,fontWeight:"bold",color:"#6ee7b7"}}>{vowelsRemaining}</div>
            <div style={{fontSize:6,color:"rgba(255,255,255,0.75)"}}>VOWELS</div>
          </div>
          <div style={{flex:1,background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.35)",borderRadius:8,padding:"3px 3px",textAlign:"center"}}>
            <div style={{fontSize:12,fontWeight:"bold",color:"#a78bfa"}}>{consonantsRemaining}</div>
            <div style={{fontSize:6,color:"rgba(255,255,255,0.75)"}}>CONSON.</div>
          </div>
        </div>

      </div>

      {/* ── PLAY TAB ── */}
      {tab==="play"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 10px 6px",animation:"slideUp 0.3s ease"}}>

          {/* ROW 5: Share LetterLoot + UNDO */}
          <div style={{display:"flex",gap:3,marginBottom:3}}>
            <button className="ll-btn" onClick={()=>{
              navigator.clipboard?.writeText("✏️ Play LetterLoot — the daily word puzzle where every letter has a value! Free at: https://letterloot-6k6v.vercel.app");
              setShareLLCopied(true); setTimeout(()=>setShareLLCopied(false),4000);
            }} style={{flex:1,padding:"4px 4px",borderRadius:8,fontSize:9,background:"rgba(34,211,238,0.1)",border:"1px solid rgba(34,211,238,0.6)",color:"#22d3ee",textAlign:"center",fontWeight:"bold",display:"flex",flexDirection:"row",alignItems:"center",justifyContent:"center",gap:4}}>
              {shareLLCopied ? <span style={{color:"#22d3ee"}}>✓ Copied!</span> : <><span style={{fontSize:11,color:"#22d3ee",fontWeight:"bold",letterSpacing:1}}>Share</span><div style={{display:"flex",flexDirection:"column",alignItems:"center",lineHeight:1}}><PencilIcon size={38}/><span style={{fontSize:7,color:"#F5C518",fontWeight:"bold",letterSpacing:1,marginTop:1}}>LetterLoot</span></div></>}
            </button>
            <button className="ll-btn" onClick={()=>{ if(!undoUsed&&lastValidEntry&&totalRef.current>=1000) setShowUndoConfirm(true); }}
              disabled={undoUsed||!lastValidEntry||totalRef.current<1000||paused}
              style={{flex:1,padding:"6px 4px",borderRadius:8,fontSize:9,background:!undoUsed&&lastValidEntry&&totalRef.current>=1000&&!paused?"linear-gradient(135deg,rgba(251,113,133,0.6),rgba(225,29,72,0.5))":"rgba(255,255,255,0.05)",border:`1px solid ${!undoUsed&&lastValidEntry&&totalRef.current>=1000&&!paused?"rgba(251,113,133,0.9)":"rgba(255,255,255,0.1)"}`,color:!undoUsed&&lastValidEntry&&totalRef.current>=1000&&!paused?"#ffffff":"rgba(255,255,255,0.25)",textAlign:"center",fontWeight:"bold"}}>
              {undoUsed?"↩️ UNDO Used":`↩️ UNDO last word — 1,000 pts`}
            </button>
          </div>
          {shareLLCopied&&<div style={{textAlign:"center",fontSize:9,color:"#6ee7b7",marginBottom:2}}>Copied! Share with your friends.</div>}

          {/* ROW 6: Submit · Clear · ReTry · Buy */}
          <div style={{display:"flex",gap:3,marginBottom:3}}>
            <button className="ll-btn" onClick={handleSubmit} disabled={currentWord.length<3||validating||paused||!online} style={{flex:2,padding:"9px 4px",borderRadius:9,fontSize:11,fontWeight:"bold",background:currentWord.length>=3&&!validating&&!paused&&online?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.08)",color:currentWord.length>=3&&!validating&&!paused&&online?"#1a1a2e":"rgba(255,255,255,0.3)",cursor:currentWord.length>=3&&!validating&&!paused&&online?"pointer":"default",textAlign:"center"}}>{validating?"Checking…":paused?"Paused":!online?"Offline":"Submit Word"}</button>
            <button className="ll-btn" onClick={()=>!validating&&!paused&&setSelected([])} style={{flex:1,padding:"9px 4px",borderRadius:9,fontSize:10,fontWeight:"bold",background:"rgba(192,132,252,0.25)",border:"2px solid rgba(216,180,254,0.95)",color:"#ede9fe",textAlign:"center"}}>✕ Clear</button>
            <button className="ll-btn" onClick={()=>!paused&&setShowResetConfirm(true)} style={{flex:1,padding:"9px 4px",borderRadius:9,fontSize:9,background:"rgba(96,165,250,0.15)",border:"1px solid rgba(96,165,250,0.55)",color:"#bfdbfe",textAlign:"center"}}>{level===5?"🔄 Replay L5":"🔄 Replay L"+level}</button>
            {level<5&&<button className="ll-btn" onClick={()=>setShowBuyModal(true)} style={{flex:1,padding:"9px 4px",borderRadius:9,fontSize:9,background:canBuy?"rgba(246,211,101,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${canBuy?"rgba(246,211,101,0.55)":"rgba(255,255,255,0.12)"}`,color:canBuy?"#fef08a":"rgba(255,255,255,0.3)",textAlign:"center"}}>🔓 Buy L{level+1} — {buyCost} pts</button>}
          </div>

          {/* ROW 7: Tap tiles to build a word */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"4px 8px",marginBottom:3,border:"1.5px solid rgba(255,255,255,0.8)",minHeight:30,animation:shake?"shake 0.4s ease":"none"}}>
            <div style={{display:"flex",gap:3,alignItems:"center",flex:1,flexWrap:"wrap"}}>
              {selected.length===0
                ?<div style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontStyle:"italic"}}>Tap tiles to build a word…</div>
                :selected.map(id=>{ const tile=tiles.find(t=>t.id===id); return(
                  <div key={id} onClick={()=>!validating&&!paused&&setSelected(prev=>prev.filter(i=>i!==id))} style={{background:tile?.bonus==="triple"?"linear-gradient(135deg,#e040fb,#7b1fa2)":tile?.bonus==="double"?"linear-gradient(135deg,#ffd700,#f57c00)":"linear-gradient(135deg,#5c6bc0,#512da8)",borderRadius:5,padding:"3px 6px",fontSize:14,fontWeight:"bold",color:"#fff",cursor:"pointer",lineHeight:1}}>{tile?.letter}</div>
                );})
              }
            </div>
            {currentWord.length>0&&(
              <div style={{textAlign:"right",marginLeft:6,flexShrink:0}}>
                <div style={{fontSize:11,color:"#f6d365",fontWeight:"bold"}}>+{currentScore}{getLongWordBonus(currentWord.length)>0&&<span style={{color:"#6ee7b7",fontSize:9}}> +{getLongWordBonus(currentWord.length)}!</span>}</div>
                <div style={{fontSize:7,color:"rgba(255,255,255,0.4)"}}>{currentWord.length} ltrs</div>
              </div>
            )}
          </div>

          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"6px 4px",border:"1px solid rgba(255,255,255,0.18)",position:"relative"}}>
            {paused&&<div style={{position:"absolute",inset:0,borderRadius:12,background:"rgba(0,0,0,0.82)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:5,backdropFilter:"blur(2px)"}}>
              <div style={{fontSize:40,marginBottom:8}}>⏸️</div>
              <div style={{fontSize:20,fontWeight:"bold",color:"#f6d365"}}>PAUSED</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:6}}>Tap Resume above to continue</div>
            </div>}
            {tileRows.map((row,ri)=>(
              <div key={ri} style={{display:"flex",justifyContent:"center",gap:3,marginBottom:3}}>
                {row.map(tile=>{ const isSel=selected.includes(tile.id); const isDouble=tile.bonus==="double"; const isTriple=tile.bonus==="triple"; return(
                  <div key={tile.id} className={`ll-tile${isSel?" sel":""}${tile.used?" used":""}${isDouble?" bonus-double":""}${isTriple?" bonus-triple":""}${paused?" paused-tile":""}`} onClick={()=>!tile.used&&!validating&&!paused&&setSelected(prev=>prev.includes(tile.id)?prev.filter(i=>i!==tile.id):[...prev,tile.id])} style={{width:38,height:44,background:tile.used?"rgba(255,255,255,0.02)":isSel?"linear-gradient(135deg,#5c6bc0,#512da8)":isTriple?"linear-gradient(135deg,rgba(224,64,251,0.35),rgba(123,31,162,0.25))":isDouble?"linear-gradient(135deg,rgba(255,215,0,0.35),rgba(245,124,0,0.25))":"linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.07))",borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:isSel?"2px solid #9fa8da":isTriple?"1px solid rgba(224,64,251,0.7)":isDouble?"1px solid rgba(255,215,0,0.7)":"1px solid rgba(255,255,255,0.22)"}}>
                    <div style={{fontSize:17,fontWeight:"bold",lineHeight:1,color:tile.used?"rgba(255,255,255,0.2)":"#fff"}}>{tile.letter}</div>
                    <div style={{fontSize:7,fontWeight:"bold",marginTop:1,color:tile.used?"rgba(255,255,255,0.1)":isTriple?"#e040fb":isDouble?"#ffd700":"#fda085"}}>{isTriple?"3×":isDouble?"2×":tile.value}</div>
                  </div>
                );})}
              </div>
            ))}
          </div>

          {isGuest&&<div style={{marginTop:4,textAlign:"center"}}><button className="ll-btn" onClick={onSignOut} style={{padding:"4px 12px",borderRadius:10,background:"linear-gradient(135deg,#a78bfa,#7c3aed)",color:"#fff",fontSize:9}}>☁️ Create Account to Save Progress</button></div>}
        </div>
      )}

      {/* ── BADGES TAB ── */}
      {tab==="badges"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          <button className="ll-btn" onClick={()=>setTab("play")} style={{width:"100%",padding:"10px",borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:13,fontWeight:"bold",border:"none",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            ✏️ Return to Game
          </button>

          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",letterSpacing:3,marginBottom:4,paddingLeft:4}}>☀️ DAILY BADGES</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginBottom:7,paddingLeft:4}}>Reset each day — earn them fresh every session</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
              {BADGE_DEFS.filter(b=>b.scope==="daily"||b.scope==="all").map(b=>{
                const earned = dailyBadgeIds.includes(b.id);
                return(<div key={b.id+"_d"} style={{background:earned?"linear-gradient(135deg,rgba(246,211,101,0.18),rgba(253,160,133,0.12))":"rgba(255,255,255,0.05)",border:earned?"1px solid rgba(246,211,101,0.45)":"1px solid rgba(255,255,255,0.14)",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                  <div style={{filter:earned?"none":"grayscale(1)",opacity:earned?1:0.22,display:"flex",justifyContent:"center"}}>{renderBadgeIcon(b)}</div>
                  <div style={{fontSize:11,fontWeight:"bold",marginTop:4,color:earned?"#f6d365":"rgba(255,255,255,0.4)"}}>{b.label}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.55)",marginTop:2,lineHeight:1.4}}>{b.desc}</div>
                  {earned&&<div style={{marginTop:3,fontSize:8,color:"#fda085",letterSpacing:2}}>✓ TODAY</div>}
                </div>);
              })}
            </div>
          </div>
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
        const returnButton = (<button className="ll-btn" onClick={()=>setTab("play")} style={{width:"100%",padding:"10px",borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:13,fontWeight:"bold",border:"none",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>✏️ Return to Game</button>);
        const allGames = history.games || [];
        const hasAny = allGames.some(g => g && g.length > 0);
        const grandTotal = allGames.flat().filter(s=>s&&s.valid).reduce((a,s)=>a+s.score,0);
        return (
          <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
            {!hasAny
              ?<div>{returnButton}<div style={{textAlign:"center",color:"rgba(255,255,255,0.35)",marginTop:40,fontSize:12,fontStyle:"italic"}}>No words yet — go loot some letters!</div></div>
              :<div style={{display:"flex",flexDirection:"column",gap:5}}>{returnButton}
                {allGames.map((game, gi) => game && game.length > 0 ? (
                  <div key={gi}>
                    {allGames.filter(g=>g&&g.length>0).length > 1 && (
                      <div style={{textAlign:"center",fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:2,padding:"6px 0",marginBottom:2}}>— Game {gi+1} —</div>
                    )}
                    {[...game].sort((a,b)=>(b.score||0)-(a.score||0)).map((s,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:s.valid?(s.medical?"rgba(0,150,200,0.1)":"rgba(80,220,100,0.1)"):"rgba(220,80,80,0.1)",border:`1px solid ${s.valid?(s.medical?"rgba(0,150,200,0.3)":"rgba(80,220,100,0.3)"):"rgba(220,80,80,0.25)"}`,borderRadius:10,padding:"8px 12px",marginBottom:4}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:"bold",letterSpacing:3,color:"#f5f0e8"}}>{s.word}</div>
                          <div style={{fontSize:9,color:"rgba(255,255,255,0.55)",marginTop:1}}>{s.valid?(s.medical?<span style={{color:"#60a5fa"}}>🩺 Medical</span>:<span style={{color:"#6ee7b7"}}>📖 Collegiate</span>):<span>Invalid ✗</span>}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:17,fontWeight:"bold",color:s.valid?"#6ee7b7":"rgba(255,255,255,0.25)"}}>{s.valid?`+${s.score}`:"—"}</div>
                          {s.valid&&<div style={{fontSize:9,color:"rgba(255,255,255,0.45)"}}>pts</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null)}
                <div style={{textAlign:"center",padding:"10px",background:"rgba(255,255,255,0.07)",borderRadius:10,marginTop:2,border:"1px solid rgba(255,255,255,0.15)"}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>TODAY'S TOTAL ({allGames.filter(g=>g&&g.length>0).length} game{allGames.filter(g=>g&&g.length>0).length!==1?"s":""})</div>
                  <div style={{fontSize:24,fontWeight:"bold",color:"#f6d365"}}>{grandTotal}</div>
                </div>
              </div>
            }
          </div>
        );
      })()}

      {/* ── STATS TAB ── */}
      {tab==="stats"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          <button className="ll-btn" onClick={()=>setTab("badges")} style={{width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,rgba(240,147,251,0.25),rgba(167,139,250,0.2))",border:"2px solid rgba(240,147,251,0.6)",color:"#f093fb",fontSize:14,fontWeight:"bold",marginBottom:8,letterSpacing:1}}>🏅 View My Badges — {lifetimeBadgeIds.length}/{BADGE_DEFS.filter(b=>b.scope==="lifetime"||b.scope==="all").length} Earned</button>
          <button className="ll-btn" onClick={()=>setTab("play")} style={{width:"100%",padding:"10px",borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:13,fontWeight:"bold",border:"none",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            ✏️ Return to Game
          </button>

          <div style={{background:"linear-gradient(135deg,rgba(246,211,101,0.15),rgba(253,160,133,0.1))",borderRadius:14,padding:"16px",marginBottom:8,border:"2px solid rgba(246,211,101,0.35)",textAlign:"center"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.65)",letterSpacing:3,marginBottom:5}}>💰 LIFETIME POINTS</div>
            <div style={{fontSize:44,fontWeight:"bold",color:"#f6d365"}}>{lifetimePoints.toLocaleString()}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:3}}>Accumulates every day you play</div>
            <div style={{marginTop:6,background:"rgba(220,38,38,0.12)",borderRadius:8,padding:"6px 10px",border:"1px solid rgba(220,38,38,0.25)"}}>
              <div style={{fontSize:10,color:"#ef4444",fontWeight:"bold"}}>⚠️ Lose 1/3 per missed day — Zero after 3 missed days</div>
            </div>
            {!isGuest&&<div style={{marginTop:6,fontSize:10,color:"#a78bfa"}}>☁️ Saved to your account</div>}
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:"12px",marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",letterSpacing:3,marginBottom:10}}>📅 DAYS & STREAKS</div>
            <div style={{display:"flex",justifyContent:"space-around"}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:"bold",color:"#60a5fa"}}>{statsData.daysPlayed}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>Total Days</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:"bold",color:"#fda085"}}>🔥 {statsData.currentStreak}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>Current Streak</div>{statsData.currentStreak>0&&statsData.currentStreak===statsData.longestStreak&&<div style={{fontSize:8,color:"#6ee7b7"}}>Personal Best!</div>}</div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:"bold",color:"#f6d365"}}>🏆 {statsData.longestStreak}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>Longest Streak</div></div>
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:"12px",marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",letterSpacing:3,marginBottom:10}}>🌈🏆 PERFECT DAYS</div>
            <div style={{display:"flex",justifyContent:"space-around"}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:"bold",color:"#6ee7b7"}}>{weekPerfectCount}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>This Week</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:"bold",color:"#f6d365"}}>{statsData.perfectDaysAllTime}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>All Time</div></div>
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:"12px",marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",letterSpacing:3,marginBottom:10}}>📈 DAILY SCORES</div>
            <div style={{display:"flex",justifyContent:"space-around",marginBottom:10}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:17,fontWeight:"bold",color:"#fda085"}}>{statsData.highScoreToday||"—"}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>Today</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:17,fontWeight:"bold",color:"#fda085"}}>{weekHighScore||"—"}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>Week Best</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:17,fontWeight:"bold",color:"#f6d365"}}>{statsData.highScoreAllTime||"—"}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>Best Ever</div></div>
            </div>
            <div style={{display:"flex",justifyContent:"space-around",paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:17,fontWeight:"bold",color:"#a78bfa"}}>{avgDaily.toLocaleString()}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>Daily Avg</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:17,fontWeight:"bold",color:"#6ee7b7"}}>{allTimeTotal.toLocaleString()}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>All-Time Total</div></div>
            </div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.45)",marginTop:10,marginBottom:5,textAlign:"center",letterSpacing:1}}>LAST 7 DAYS</div>
            <div style={{display:"flex",gap:3,alignItems:"flex-end",height:44,justifyContent:"space-around"}}>
              {last7Days.map((d,i)=>(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{width:"100%",background:d.score>0?"linear-gradient(180deg,#f6d365,#fda085)":"rgba(255,255,255,0.08)",borderRadius:"3px 3px 0 0",height:d.score>0?`${Math.max(4,(d.score/maxDayScore)*36)}px`:"4px",transition:"height 0.3s ease"}}/>
                  <div style={{fontSize:7,color:"rgba(255,255,255,0.4)"}}>{d.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:"12px",marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",letterSpacing:3,marginBottom:10}}>💎 HIGHEST WORD SCORE</div>
            <div style={{display:"flex",justifyContent:"space-around"}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:17,fontWeight:"bold",color:"#f093fb"}}>{statsData.highWordToday||"—"}</div>{statsData.highWordTodayWord&&<div style={{fontSize:8,color:"#a78bfa",letterSpacing:1}}>{statsData.highWordTodayWord}</div>}<div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>Today</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:17,fontWeight:"bold",color:"#f093fb"}}>{weekHighWord||"—"}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>This Week</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:17,fontWeight:"bold",color:"#a78bfa"}}>{statsData.highWordAllTime||"—"}</div>{statsData.highWordAllTimeWord&&<div style={{fontSize:8,color:"#a78bfa",letterSpacing:1}}>{statsData.highWordAllTimeWord}</div>}<div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>All Time</div></div>
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:"12px",marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",letterSpacing:3,marginBottom:10}}>🏆 BEST SCORE PER LEVEL</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[1,2,3,4,5].map(lvl=>{
                const best=statsData.bestScorePerLevel?.[String(lvl)];
                return(<div key={lvl} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.04)",borderRadius:9,padding:"7px 12px",border:best?"1px solid rgba(246,211,101,0.25)":"1px solid rgba(255,255,255,0.07)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{fontSize:11,fontWeight:"bold",color:best?"#f6d365":"rgba(255,255,255,0.3)",minWidth:28}}>L{lvl}</div>{best&&<div style={{fontSize:9,color:"rgba(255,255,255,0.4)"}}>{best.date}</div>}</div>
                  <div style={{fontSize:best?17:13,fontWeight:"bold",color:best?"#fda085":"rgba(255,255,255,0.2)"}}>{best?`${best.score.toLocaleString()} pts`:"—"}</div>
                </div>);
              })}
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:"12px",marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",letterSpacing:3,marginBottom:8}}>⏱️ FASTEST LEVEL TIMES</div>
            <div style={{display:"flex",gap:5,justifyContent:"center",marginBottom:10}}>
              {[1,2,3,4,5].map(l=>(<button key={l} className="ll-tab" onClick={()=>setSelectedLevelView(l)} style={{width:36,height:36,borderRadius:8,fontSize:11,fontWeight:"bold",background:selectedLevelView===l?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.08)",color:selectedLevelView===l?"#1a1a2e":"rgba(255,255,255,0.6)",border:selectedLevelView===l?"none":"1px solid rgba(255,255,255,0.15)"}}>L{l}</button>))}
            </div>
            {(()=>{ const best=statsData.fastestLevels?.[selectedLevelView]; return best?(<div style={{textAlign:"center",marginBottom:8,background:"rgba(96,165,250,0.1)",borderRadius:9,padding:"8px",border:"1px solid rgba(96,165,250,0.3)"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.5)",marginBottom:2,letterSpacing:1}}>PERSONAL BEST</div><div style={{fontSize:22,fontWeight:"bold",color:"#60a5fa",fontFamily:"monospace"}}>{formatTime(best.seconds)}</div>{best.date&&<div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:2}}>{best.date}</div>}</div>):(<div style={{textAlign:"center",color:"rgba(255,255,255,0.3)",fontSize:11,fontStyle:"italic",padding:"6px 0",marginBottom:8}}>No best time yet for Level {selectedLevelView}</div>); })()}
            {!timeLeaderboard.levels?.[selectedLevelView]?.length?<div style={{textAlign:"center",color:"rgba(255,255,255,0.3)",fontSize:11,fontStyle:"italic",padding:"8px 0"}}>No times yet — clear the board to record!</div>
              :timeLeaderboard.levels[selectedLevelView].map((entry,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,background:i===0?"rgba(96,165,250,0.1)":"rgba(255,255,255,0.03)",border:i===0?"1px solid rgba(96,165,250,0.3)":"1px solid rgba(255,255,255,0.06)",borderRadius:9,padding:"7px 10px",marginBottom:5}}><div style={{fontSize:16,minWidth:24,textAlign:"center"}}>{medalFor(i)}</div><div style={{flex:1}}><div style={{fontSize:12,fontWeight:"bold",color:"#f5f0e8"}}>{entry.name}</div><div style={{fontSize:8,color:"rgba(255,255,255,0.4)"}}>{entry.date}</div></div><div style={{fontSize:15,fontWeight:"bold",color:"#60a5fa",fontFamily:"monospace"}}>{formatTime(entry.seconds)}</div></div>))
            }
            <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",letterSpacing:2,marginBottom:8}}>🌈🏆 PERFECT DAY TIMES</div>
              {!timeLeaderboard.perfect?.length?<div style={{textAlign:"center",color:"rgba(255,255,255,0.3)",fontSize:11,fontStyle:"italic",padding:"6px 0"}}>No Perfect Day times yet!</div>
                :timeLeaderboard.perfect.slice(0,5).map((entry,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,background:i===0?"linear-gradient(135deg,rgba(246,211,101,0.1),rgba(253,160,133,0.06))":"rgba(255,255,255,0.02)",border:i===0?"1px solid rgba(246,211,101,0.25)":"1px solid rgba(255,255,255,0.06)",borderRadius:9,padding:"7px 10px",marginBottom:4}}><div style={{fontSize:16,minWidth:24,textAlign:"center"}}>{medalFor(i)}</div><div style={{flex:1}}><div style={{fontSize:12,fontWeight:"bold",color:"#f5f0e8"}}>{entry.name} 🌈🏆</div><div style={{fontSize:8,color:"rgba(255,255,255,0.4)"}}>{entry.date}</div></div><div style={{fontSize:15,fontWeight:"bold",color:"#f6d365",fontFamily:"monospace"}}>{formatTime(entry.seconds)}</div></div>))
              }
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:"12px",marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",letterSpacing:3,marginBottom:10}}>📚 DICTIONARY BREAKDOWN</div>
            <div style={{display:"flex",justifyContent:"space-around"}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:"bold",color:"#6ee7b7"}}>{statsData.collegiateWords||0}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>📖 Collegiate</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:"bold",color:"#60a5fa"}}>{statsData.medicalWords||0}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>🩺 Medical</div></div>
              <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
              <div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:"bold",color:"#f6d365"}}>{(statsData.collegiateWords||0)+(statsData.medicalWords||0)}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>Total Valid</div></div>
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:"12px",marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",letterSpacing:3,marginBottom:8}}>📏 LONGEST WORDS</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.07)"}}><div style={{fontSize:11,color:"rgba(255,255,255,0.55)"}}>Today's Best</div><div style={{fontSize:12,fontWeight:"bold",color:"#a78bfa",letterSpacing:2}}>{statsData.longestWordToday||"—"}{statsData.longestWordToday&&<span style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginLeft:6}}>({statsData.longestWordToday.length} letters)</span>}</div></div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0"}}><div style={{fontSize:11,color:"rgba(255,255,255,0.55)"}}>All-Time Best</div><div style={{fontSize:12,fontWeight:"bold",color:"#f093fb",letterSpacing:2}}>{statsData.longestWordAllTime||"—"}{statsData.longestWordAllTime&&<span style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginLeft:6}}>({statsData.longestWordAllTime.length} letters)</span>}</div></div>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:"12px",marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",letterSpacing:3,marginBottom:8}}>🌟 LONG WORD BONUSES</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,justifyContent:"center"}}>
              {[["8","+1"],["9","+3"],["10","+6"],["11","+10"],["12","+15"],["13","+25"],["14+","+35+"]].map(([len,bonus])=>(
                <div key={len} style={{textAlign:"center",background:"rgba(255,255,255,0.06)",borderRadius:9,padding:"6px 8px",border:"1px solid rgba(255,255,255,0.1)",minWidth:46}}>
                  <div style={{fontSize:14,fontWeight:"bold",color:(statsData.longWordBonuses?.[len]||0)>0?"#f6d365":"rgba(255,255,255,0.2)"}}>{statsData.longWordBonuses?.[len]||0}</div>
                  <div style={{fontSize:7,color:"rgba(255,255,255,0.45)"}}>{len} ltrs</div>
                  <div style={{fontSize:7,color:"rgba(255,255,255,0.35)"}}>{bonus}</div>
                </div>
              ))}
            </div>
          </div>
          {/* ── Bonus Level Progress (shown when ENABLE_BONUS_LEVELS=true) ── */}
          {ENABLE_BONUS_LEVELS && (
            <div style={{background:"linear-gradient(135deg,rgba(246,211,101,0.1),rgba(253,160,133,0.08))",borderRadius:14,padding:"14px",marginBottom:8,border:"2px solid rgba(246,211,101,0.3)",textAlign:"center"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.65)",letterSpacing:3,marginBottom:6}}>🏛️ BONUS LEVELS</div>
              {bonusLevelUnlocked
                ? <div style={{fontSize:13,color:"#f6d365",fontWeight:"bold"}}>The Vault is unlocked! 🏛️</div>
                : <>
                    <div style={{fontSize:13,color:"#f5f0e8",marginBottom:6}}>
                      <span style={{color:"#f6d365",fontWeight:"bold",fontSize:20}}>{consecutivePerfect}</span>
                      <span style={{color:"rgba(255,255,255,0.5)"}}> / {BONUS_CONSECUTIVE_REQUIRED} consecutive Perfect Days</span>
                    </div>
                    <div style={{background:"rgba(255,255,255,0.1)",borderRadius:6,height:8,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.min(100,(consecutivePerfect/BONUS_CONSECUTIVE_REQUIRED)*100)}%`,background:"linear-gradient(90deg,#f6d365,#fda085)",borderRadius:6,transition:"width 0.5s ease"}}/>
                    </div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginTop:6}}>Unlock The Vault — Level 6 with 1.5× letter values!</div>
                  </>
              }
            </div>
          )}
          <div style={{textAlign:"center",marginBottom:8}}>
            <button onClick={()=>setShowTour(true)} style={{background:"rgba(139,92,246,0.15)",border:"1px solid rgba(167,139,250,0.4)",color:"#a78bfa",padding:"8px 20px",borderRadius:20,fontSize:11,cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:"bold"}}>↺ Replay Tour</button>
          </div>
          <div style={{textAlign:"center",marginBottom:8}}>
            {!confirmResetStats
              ? <button onClick={()=>setConfirmResetStats(true)} style={{background:"none",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.3)",padding:"5px 14px",borderRadius:20,fontSize:9,cursor:"pointer",fontFamily:"Georgia,serif"}}>Reset Stats</button>
              : <div style={{background:"rgba(220,38,38,0.1)",border:"1px solid rgba(220,38,38,0.3)",borderRadius:12,padding:"10px 12px",display:"inline-flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:10,color:"#fca5a5"}}>Are you sure?</span>
                  <button onClick={()=>{ const def={daysPlayed:0,lastPlayedDate:null,currentStreak:0,longestStreak:0,lastStreakDate:null,perfectDaysAllTime:0,perfectDaysWeek:{},weekKey:"",highScoreAllTime:0,highScoreWeek:{},highScoreToday:0,highWordAllTime:0,highWordWeek:{},highWordToday:0,highWordTodayWord:"",highWordAllTimeWord:"",fastestLevels:{"1":null,"2":null,"3":null,"4":null,"5":null},bestScorePerLevel:{"1":null,"2":null,"3":null,"4":null,"5":null},dailyScores:{},collegiateWords:0,medicalWords:0,longestWordToday:"",longestWordAllTime:"",longWordBonuses:{"8":0,"9":0,"10":0,"11":0,"12":0,"13":0,"14+":0},infinityBest:0,infinityBestDate:"",spaceBadgeDates:{}}; saveLocalStats(def); setStatsData(def); setConfirmResetStats(false); }} style={{background:"rgba(220,38,38,0.4)",border:"1px solid rgba(220,38,38,0.6)",borderRadius:8,padding:"3px 10px",fontSize:9,color:"#fff",cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:"bold"}}>Yes, Reset</button>
                  <button onClick={()=>setConfirmResetStats(false)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"3px 10px",fontSize:9,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:"Georgia,serif"}}>Cancel</button>
                </div>
            }
          </div>
        </div>
      )}

      {/* ── LEADERBOARD TAB ── */}
      {tab==="leaderboard"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          {/* Header */}
          <div style={{background:"linear-gradient(135deg,rgba(246,211,101,0.15),rgba(253,160,133,0.1))",borderRadius:14,padding:"12px 16px",marginBottom:8,border:"2px solid rgba(246,211,101,0.35)",textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:"bold",color:"#f6d365",letterSpacing:2,marginBottom:3}}>🏆 LEADERBOARD</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>Registered players only · Updated live</div>
            {isGuest&&<div style={{marginTop:8,background:"rgba(167,139,250,0.15)",borderRadius:10,padding:"8px 12px",border:"1px solid rgba(167,139,250,0.4)"}}>
              <div style={{fontSize:11,color:"#a78bfa",fontWeight:"bold"}}>Want to appear on the leaderboard?</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:2}}>Create a free account to save your scores and compete!</div>
              <button className="ll-btn" onClick={onSignOut} style={{marginTop:6,padding:"5px 14px",borderRadius:10,background:"linear-gradient(135deg,#a78bfa,#7c3aed)",color:"#fff",fontSize:10,fontWeight:"bold"}}>Create Account →</button>
            </div>}
          </div>

          {/* Category tabs */}
          <div style={{display:"flex",gap:3,marginBottom:6}}>
            {[{id:"scores",label:"💰 Scores"},{id:"words",label:"💎 Words"},{id:"longest",label:"📏 Longest"},{id:"perfect",label:"🌈🏆 Perfect"},{id:"streaks",label:"🔥 Streaks"}].map(t=>(
              <button key={t.id} className="ll-tab" onClick={()=>setLeaderboardTab(t.id)} style={{flex:1,padding:"4px 2px",borderRadius:10,fontSize:8,background:leaderboardTab===t.id?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.08)",color:leaderboardTab===t.id?"#1a1a2e":"#f0e8d8",fontWeight:leaderboardTab===t.id?"bold":"normal",border:leaderboardTab===t.id?"none":"1px solid rgba(255,255,255,0.2)",whiteSpace:"nowrap",textAlign:"center"}}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Period tabs — only show for non-streaks */}
          {leaderboardTab!=="streaks"&&(
            <div style={{display:"flex",gap:3,marginBottom:8}}>
              {[{id:"daily",label:"☀️ Today"},{id:"weekly",label:"📅 This Week"},{id:"alltime",label:"🏆 All-Time"}].map(p=>(
                <button key={p.id} className="ll-tab" onClick={()=>setLeaderboardPeriod(p.id)} style={{flex:1,padding:"4px 2px",borderRadius:10,fontSize:9,background:leaderboardPeriod===p.id?"linear-gradient(135deg,#a78bfa,#7c3aed)":"rgba(255,255,255,0.06)",color:leaderboardPeriod===p.id?"#fff":"rgba(255,255,255,0.55)",fontWeight:leaderboardPeriod===p.id?"bold":"normal",border:leaderboardPeriod===p.id?"none":"1px solid rgba(255,255,255,0.15)",textAlign:"center"}}>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {leaderboardLoading&&<div style={{textAlign:"center",padding:"30px",color:"rgba(255,255,255,0.4)",fontSize:12}}>Loading leaderboard…</div>}
          {!leaderboardLoading&&!leaderboardData&&<div style={{textAlign:"center",padding:"30px",color:"rgba(255,255,255,0.3)",fontSize:11,fontStyle:"italic"}}>Could not load leaderboard. Check your connection.</div>}

          {!leaderboardLoading&&leaderboardData&&(()=>{
            const { gs=[], todaySessions=[], weekSessions=[] } = leaderboardData;
            const medal = (i) => i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`;
            const isMe = (name) => name === playerName;
            const rowStyle = (name, i) => ({
              display:"flex", alignItems:"center", gap:8,
              background: isMe(name)?"rgba(34,211,238,0.1)":i===0?"rgba(246,211,101,0.08)":"rgba(255,255,255,0.03)",
              border: isMe(name)?"1px solid rgba(34,211,238,0.4)":i===0?"1px solid rgba(246,211,101,0.25)":"1px solid rgba(255,255,255,0.06)",
              borderRadius:10, padding:"8px 10px", marginBottom:5
            });

            // Build today/week best scores per player
            // Build maps by player_id from actual session data
            const todayBestById = {};
            const todayPerfectById = {};
            const todayLongestById = {};
            todaySessions.forEach(s=>{
              if(!todayBestById[s.player_id]||s.total_score>todayBestById[s.player_id]) todayBestById[s.player_id]=s.total_score;
              if(s.perfect_day) todayPerfectById[s.player_id]=true;
              if(s.longest_word_today&&(!todayLongestById[s.player_id]||s.longest_word_today.length>todayLongestById[s.player_id].length)) todayLongestById[s.player_id]={word:s.longest_word_today,length:s.longest_word_today.length};
            });
            const weekBestById = {};
            const weekPerfectById = {};
            weekSessions.forEach(s=>{
              if(!weekBestById[s.player_id]||s.total_score>weekBestById[s.player_id]) weekBestById[s.player_id]=s.total_score;
              if(s.perfect_day) weekPerfectById[s.player_id]=(weekPerfectById[s.player_id]||0)+1;
            });

            const empty = <div style={{textAlign:"center",padding:"20px",color:"rgba(255,255,255,0.3)",fontSize:11,fontStyle:"italic"}}>No data yet for this period</div>;

            // ── SCORES ──
            if (leaderboardTab==="scores") {
              let ranked = [];
              if (leaderboardPeriod==="alltime") ranked = [...gs].sort((a,b)=>(b.lifetime_points||0)-(a.lifetime_points||0)).slice(0,10).map(g=>({name:g.player_name,val:(g.lifetime_points||0).toLocaleString(),suffix:"pts"}));
              if (leaderboardPeriod==="daily") ranked = [...gs].filter(g=>todayBestById[g.player_id]>0).sort((a,b)=>(todayBestById[b.player_id]||0)-(todayBestById[a.player_id]||0)).slice(0,10).map(g=>({name:g.player_name,val:(todayBestById[g.player_id]||0).toLocaleString(),suffix:"pts"}));
              if (leaderboardPeriod==="weekly") ranked = [...gs].filter(g=>weekBestById[g.player_id]>0).sort((a,b)=>(weekBestById[b.player_id]||0)-(weekBestById[a.player_id]||0)).slice(0,10).map(g=>({name:g.player_name,val:(weekBestById[g.player_id]||0).toLocaleString(),suffix:"pts"}));
              if (!ranked.length) return empty;
              return <div>{ranked.map((r,i)=>(
                <div key={i} style={rowStyle(r.name,i)}>
                  <div style={{fontSize:16,minWidth:24,textAlign:"center"}}>{medal(i)}</div>
                  <div style={{flex:1}}><span style={{fontSize:12,fontWeight:"bold",color:isMe(r.name)?"#22d3ee":"#f5f0e8"}}>{r.name||"Guest"}</span>{isMe(r.name)&&<span style={{fontSize:9,color:"#22d3ee",marginLeft:4}}>← you</span>}</div>
                  <span style={{fontSize:15,fontWeight:"bold",color:"#f6d365"}}>{r.val}</span>
                  <span style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginLeft:2}}>{r.suffix}</span>
                </div>
              ))}</div>;
            }

            // ── BEST WORD SCORES ──
            if (leaderboardTab==="words") {
              let ranked = [];
              if (leaderboardPeriod==="alltime") ranked = [...gs].filter(g=>g.stats?.highWordAllTimeWord).sort((a,b)=>(b.stats?.highWordAllTime||0)-(a.stats?.highWordAllTime||0)).slice(0,10).map(g=>({name:g.player_name,word:g.stats.highWordAllTimeWord,val:g.stats.highWordAllTime||0}));
              if (leaderboardPeriod==="daily") ranked = [...gs].filter(g=>todayBestById[g.player_id]&&g.stats?.highWordTodayWord&&g.stats?.highWordToday>0).sort((a,b)=>(b.stats?.highWordToday||0)-(a.stats?.highWordToday||0)).slice(0,10).map(g=>({name:g.player_name,word:g.stats.highWordTodayWord,val:g.stats.highWordToday||0}));
              if (leaderboardPeriod==="weekly") ranked = [...gs].filter(g=>weekBestById[g.player_id]&&g.stats?.highWordAllTimeWord).sort((a,b)=>(b.stats?.highWordAllTime||0)-(a.stats?.highWordAllTime||0)).slice(0,10).map(g=>({name:g.player_name,word:g.stats.highWordAllTimeWord,val:g.stats.highWordAllTime||0}));
              if (!ranked.length) return empty;
              return <div>{ranked.map((r,i)=>(
                <div key={i} style={rowStyle(r.name,i)}>
                  <div style={{fontSize:16,minWidth:24,textAlign:"center"}}>{medal(i)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:"bold",color:"#f093fb",letterSpacing:2}}>{r.word}</div>
                    <div style={{fontSize:9,color:isMe(r.name)?"#22d3ee":"rgba(255,255,255,0.4)",marginTop:1}}>{r.name||"Guest"}{isMe(r.name)&&" ← you"}</div>
                  </div>
                  <span style={{fontSize:15,fontWeight:"bold",color:"#f6d365"}}>{r.val} pts</span>
                </div>
              ))}</div>;
            }

            // ── LONGEST WORDS ──
            if (leaderboardTab==="longest") {
              let ranked = [];
              if (leaderboardPeriod==="alltime") ranked = [...gs].filter(g=>g.stats?.longestWordAllTime).sort((a,b)=>(b.stats?.longestWordAllTime?.length||0)-(a.stats?.longestWordAllTime?.length||0)).slice(0,10).map(g=>({name:g.player_name,word:g.stats.longestWordAllTime,val:g.stats.longestWordAllTime?.length||0}));
              if (leaderboardPeriod==="daily") ranked = [...gs].filter(g=>todayLongestById[g.player_id]).sort((a,b)=>(todayLongestById[b.player_id]?.length||0)-(todayLongestById[a.player_id]?.length||0)).slice(0,10).map(g=>({name:g.player_name,word:todayLongestById[g.player_id]?.word||"—",val:todayLongestById[g.player_id]?.length||0}));
              if (leaderboardPeriod==="weekly") ranked = [...gs].filter(g=>weekBestById[g.player_id]&&g.stats?.longestWordAllTime).sort((a,b)=>(b.stats?.longestWordAllTime?.length||0)-(a.stats?.longestWordAllTime?.length||0)).slice(0,10).map(g=>({name:g.player_name,word:g.stats.longestWordAllTime,val:g.stats.longestWordAllTime?.length||0}));
              if (!ranked.length) return empty;
              return <div>{ranked.map((r,i)=>(
                <div key={i} style={rowStyle(r.name,i)}>
                  <div style={{fontSize:16,minWidth:24,textAlign:"center"}}>{medal(i)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:"bold",color:"#a78bfa",letterSpacing:2}}>{r.word}</div>
                    <div style={{fontSize:9,color:isMe(r.name)?"#22d3ee":"rgba(255,255,255,0.4)",marginTop:1}}>{r.name||"Guest"}{isMe(r.name)&&" ← you"}</div>
                  </div>
                  <span style={{fontSize:15,fontWeight:"bold",color:"#22d3ee"}}>{r.val}</span>
                  <span style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginLeft:2}}>ltrs</span>
                </div>
              ))}</div>;
            }

            // ── PERFECT DAYS ──
            if (leaderboardTab==="perfect") {
              let ranked = [];
              if (leaderboardPeriod==="alltime") ranked = [...gs].filter(g=>g.stats?.perfectDaysAllTime>0).sort((a,b)=>(b.stats?.perfectDaysAllTime||0)-(a.stats?.perfectDaysAllTime||0)).slice(0,10).map(g=>({name:g.player_name,val:g.stats.perfectDaysAllTime}));
              if (leaderboardPeriod==="daily") ranked = [...gs].filter(g=>todayPerfectById[g.player_id]).map(g=>({name:g.player_name,val:"🌈🏆",pid:g.player_id})).slice(0,10);
              if (leaderboardPeriod==="weekly") ranked = [...gs].filter(g=>weekPerfectById[g.player_id]>0).sort((a,b)=>(weekPerfectById[b.player_id]||0)-(weekPerfectById[a.player_id]||0)).slice(0,10).map(g=>({name:g.player_name,val:weekPerfectById[g.player_id]}));
              if (!ranked.length) return empty;
              return <div>{ranked.map((r,i)=>(
                <div key={i} style={rowStyle(r.name,i)}>
                  <div style={{fontSize:16,minWidth:24,textAlign:"center"}}>{medal(i)}</div>
                  <div style={{flex:1}}><span style={{fontSize:12,fontWeight:"bold",color:isMe(r.name)?"#22d3ee":"#f5f0e8"}}>{r.name||"Guest"}</span>{isMe(r.name)&&<span style={{fontSize:9,color:"#22d3ee",marginLeft:4}}>← you</span>}</div>
                  <span style={{fontSize:15,fontWeight:"bold",color:"#6ee7b7"}}>{r.val}</span>
                </div>
              ))}</div>;
            }

            // ── STREAKS — ALL-TIME ONLY ──
            if (leaderboardTab==="streaks") {
              const ranked = [...gs].sort((a,b)=>(b.longest_streak||0)-(a.longest_streak||0)).slice(0,10);
              if (!ranked.length) return empty;
              return (
                <div>
                  <div style={{textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.4)",marginBottom:8,letterSpacing:1}}>ALL-TIME LONGEST STREAKS</div>
                  {ranked.map((g,i)=>(
                    <div key={i} style={rowStyle(g.player_name,i)}>
                      <div style={{fontSize:16,minWidth:24,textAlign:"center"}}>{medal(i)}</div>
                      <div style={{flex:1}}>
                        <span style={{fontSize:12,fontWeight:"bold",color:isMe(g.player_name)?"#22d3ee":"#f5f0e8"}}>{g.player_name||"Guest"}</span>
                        {isMe(g.player_name)&&<span style={{fontSize:9,color:"#22d3ee",marginLeft:4}}>← you</span>}
                        {g.current_streak>0&&<div style={{fontSize:9,color:"#fda085",marginTop:1}}>🔥 Currently on {g.current_streak}d streak</div>}
                      </div>
                      <span style={{fontSize:15,fontWeight:"bold",color:"#fda085"}}>🔥 {g.longest_streak||0}d</span>
                    </div>
                  ))}
                </div>
              );
            }
          })()}

          {leaderboardFromPerfectDay&&(
            <button className="ll-btn" onClick={()=>{ setLeaderboardFromPerfectDay(false); setTab('play'); perfectDayAchieved ? setPerfectDayAchieved(true) : setShowRepeatPerfect(true); }} style={{width:"100%",padding:"12px",borderRadius:14,background:"linear-gradient(135deg,rgba(255,215,0,0.25),rgba(255,165,0,0.2))",border:"2px solid rgba(255,215,0,0.6)",color:"#f6d365",fontSize:13,fontWeight:"bold",marginBottom:8}}>
              🌈 ← Back to Perfect Day
            </button>
          )}
          <div style={{marginTop:10,display:"flex",gap:8}}>
            <button className="ll-btn" onClick={()=>{ setLeaderboardData(null); setLeaderboardLoading(true); fetchLeaderboard().then(d=>{ setLeaderboardData(d); setLeaderboardLoading(false); }); }} style={{flex:1,padding:"7px",borderRadius:12,background:"rgba(167,139,250,0.2)",border:"1px solid rgba(167,139,250,0.7)",color:"#c4b5fd",fontSize:10,fontWeight:"bold"}}>↺ Refresh</button>
            <button className="ll-btn" onClick={()=>setTab("play")} style={{flex:2,padding:"10px",borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:12,fontWeight:"bold",border:"none"}}>✏️ Return to Your Game</button>
          </div>
        </div>
      )}

            {/* ── INFO / TIPS TAB ── item 10 */}
      {tab==="info"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          {/* Header card */}
          <div style={{background:"linear-gradient(135deg,rgba(139,92,246,0.2),rgba(96,165,250,0.15))",borderRadius:16,padding:"18px 16px",marginBottom:12,border:"2px solid rgba(167,139,250,0.45)",textAlign:"center"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:8}}><PencilLogo size={100}/></div>
            <div style={{fontSize:17,fontWeight:"bold",color:"#a78bfa",letterSpacing:3,marginBottom:4}}>HINTS & TIPS</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>Play smarter · Loot harder</div>
          </div>
          <button className="ll-btn" onClick={()=>setTab("play")} style={{width:"100%",padding:"10px",borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:13,fontWeight:"bold",border:"none",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            ✏️ Return to Game
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
              borderRadius:13, padding:"14px 16px", marginBottom:8,
              display:"flex", gap:13, alignItems:"flex-start"
            }}>
              <div style={{fontSize:26,flexShrink:0,marginTop:1,minWidth:32,textAlign:"center"}}>{tip.emoji}</div>
              <div style={{flex:1}}>
                <div style={{
                  fontSize:13, fontWeight:"bold", marginBottom:5,
                  color: i === TIPS.length - 1 ? "#6ee7b7" : "#f6d365"
                }}>{tip.title}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",lineHeight:1.65}}>{tip.body}</div>
              </div>
            </div>
          ))}

          <div style={{textAlign:"center",marginBottom:16,marginTop:4}}>
            <button className="ll-btn" onClick={()=>setTab("play")} style={{padding:"11px 28px",borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:13,fontWeight:"bold",letterSpacing:1}}>
              ✏️ Back to Playing!
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
          <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:360,textAlign:"center"}}>
            <PencilLogo size={160}/>
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
        <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:28,padding:"36px 28px",textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:"2px solid rgba(246,211,101,0.5)",maxWidth:320,width:"90%"}}>
          <div style={{fontSize:52}}>✏️</div>
          <div style={{fontSize:22,fontWeight:"bold",color:"#f6d365",marginTop:10}}>Ready to play?</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginTop:10,lineHeight:1.7}}>Your timer starts when you tap Let's Go!</div>
          <div style={{marginTop:12,background:"rgba(255,255,255,0.06)",borderRadius:12,padding:"10px",fontSize:12,color:"rgba(255,255,255,0.5)"}}>
            Level 1 · Fresh tiles · Good luck! 🍀
          </div>
          <button className="ll-btn replay-btn" onClick={()=>{ setShowReadyToPlay(false); startTimer(); }} style={{marginTop:20,width:"100%",padding:"16px",borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:16,fontWeight:"bold",border:"none"}}>
            Let's Go! 🎯
          </button>
        </div>
      </div>}

    </div>
  );
}
