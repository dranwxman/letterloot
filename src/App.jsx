import { useState, useCallback, useRef, useEffect } from "react";

const LETTER_VALUES = {};
"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((l, i) => { LETTER_VALUES[l] = i + 1; });

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}
function getDailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function getDayOfYear() {
  const now = new Date();
  return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
}
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
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
  return pool.slice(0, count).map((l, i) => ({
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
const LEVEL_BUY_COST = [0, 250, 500, 750, 1000];

const BADGE_DEFS = [
  { id:"first_word",   icon:"✨", label:"First Loot",     desc:"Submit your first word",          cat:"core" },
  { id:"score_50",     icon:"🔥", label:"On Fire",        desc:"Score 50+ in one word",           cat:"core" },
  { id:"score_100",    icon:"💯", label:"Century",        desc:"Score 100+ in one word",          cat:"core" },
  { id:"score_200",    icon:"🚀", label:"Rocket",         desc:"Score 200+ in one word",          cat:"core" },
  { id:"long_word",    icon:"📏", label:"Long Haul",      desc:"Use 7+ letters in a word",        cat:"core" },
  { id:"streak_3",     icon:"⚡", label:"Streak x3",     desc:"3 valid words in a row",          cat:"core" },
  { id:"streak_5",     icon:"🌪️", label:"Streak x5",     desc:"5 valid words in a row",          cat:"core" },
  { id:"daily_500",    icon:"🏆", label:"Loot Master",    desc:"500+ total daily score",          cat:"core" },
  { id:"daily_1000",   icon:"💰", label:"Treasure Chest", desc:"1000+ total daily score",         cat:"core" },
  { id:"perfect_q",    icon:"👑", label:"Q Master",       desc:"Use the letter Q",                cat:"core" },
  { id:"vowel_rich",   icon:"🎵", label:"Vowel Rich",     desc:"Word with 4+ vowels",             cat:"core" },
  { id:"level_2",      icon:"🥈", label:"Level 2",        desc:"Reach Level 2",                   cat:"level" },
  { id:"level_3",      icon:"🥇", label:"Level 3",        desc:"Reach Level 3",                   cat:"level" },
  { id:"level_4",      icon:"🎖️", label:"Level 4",        desc:"Reach Level 4",                   cat:"level" },
  { id:"level_5",      icon:"💎", label:"Diamond",        desc:"Reach Level 5",                   cat:"level" },
  { id:"all_tiles_1",  icon:"🌟", label:"Clear L1",       desc:"Use all tiles on Level 1",        cat:"level" },
  { id:"all_tiles_2",  icon:"🌟", label:"Clear L2",       desc:"Use all tiles on Level 2",        cat:"level" },
  { id:"all_tiles_3",  icon:"🌟", label:"Clear L3",       desc:"Use all tiles on Level 3",        cat:"level" },
  { id:"all_tiles_4",  icon:"🌟", label:"Clear L4",       desc:"Use all tiles on Level 4",        cat:"level" },
  { id:"all_tiles_5",  icon:"🌟", label:"Clear L5",       desc:"Use all tiles on Level 5",        cat:"level" },
  { id:"perfect_day",  icon:"🌈", label:"Perfect Day",    desc:"All 5 levels cleared, no buys!",  cat:"level" },
  { id:"word_6",       icon:"📖", label:"6 Letters",      desc:"Spell a 6-letter word",           cat:"word" },
  { id:"word_8",       icon:"📚", label:"8 Letters",      desc:"Spell an 8-letter word",          cat:"word" },
  { id:"word_10",      icon:"🧠", label:"10 Letters",     desc:"Spell a 10-letter word!",         cat:"word" },
  { id:"longest_day",  icon:"🎯", label:"Daily Best",     desc:"Beat your longest word today",    cat:"word" },
  { id:"speed_demon",  icon:"⏱️", label:"Speed Demon",    desc:"Complete a level in under 3 min", cat:"word" },
  { id:"no_retreat",   icon:"🎗️", label:"No Retreat",     desc:"Complete level without resetting",cat:"word" },
  { id:"all_time_50",  icon:"🦁", label:"Veteran",        desc:"Submit 50 valid words all-time",  cat:"alltime" },
  { id:"all_time_100", icon:"🐉", label:"Dragon",         desc:"Submit 100 valid words all-time", cat:"alltime" },
  { id:"all_time_10k", icon:"👸", label:"Legend",         desc:"10,000+ all-time score",          cat:"alltime" },
];

const wordCache = {};
async function validateWordWithAI(word) {
  const key = word.toLowerCase();
  if (wordCache[key] !== undefined) return wordCache[key];
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 50,
        messages: [{ role: "user", content: `Is "${word}" a real standard English dictionary word (not a proper noun, abbreviation, or slang)? Reply with only YES or NO.` }]
      })
    });
    const data = await response.json();
    const valid = (data.content?.[0]?.text || "NO").trim().toUpperCase().startsWith("YES");
    wordCache[key] = valid;
    return valid;
  } catch { return word.length >= 3; }
}

// ── Soft Piano via Web Audio ──────────────────────────────────
// Simulates a gentle piano note: quick attack, soft decay, warm tone
function playPianoNote(ctx, freq, startTime, duration = 3.5, volume = 0.18) {
  // Sine + small harmonic for warmth
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const osc3 = ctx.createOscillator();
  osc1.type = "sine";
  osc2.type = "sine";
  osc3.type = "sine";
  osc1.frequency.value = freq;
  osc2.frequency.value = freq * 2;      // octave harmonic
  osc3.frequency.value = freq * 3.01;   // soft third harmonic

  const gainMain = ctx.createGain();
  const gainHarm = ctx.createGain();
  const gainHarm2 = ctx.createGain();
  const masterGain = ctx.createGain();

  // Piano-like envelope: quick attack, long soft decay
  gainMain.gain.setValueAtTime(0, startTime);
  gainMain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gainMain.gain.exponentialRampToValueAtTime(volume * 0.3, startTime + 0.4);
  gainMain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  gainHarm.gain.setValueAtTime(0, startTime);
  gainHarm.gain.linearRampToValueAtTime(volume * 0.15, startTime + 0.01);
  gainHarm.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.6);

  gainHarm2.gain.setValueAtTime(0, startTime);
  gainHarm2.gain.linearRampToValueAtTime(volume * 0.06, startTime + 0.01);
  gainHarm2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.3);

  // Gentle low-pass for warmth
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1800;
  filter.Q.value = 0.5;

  // Soft reverb via convolver simulation with delay
  const delay = ctx.createDelay();
  delay.delayTime.value = 0.22;
  const delayGain = ctx.createGain();
  delayGain.gain.value = 0.12;

  osc1.connect(gainMain); gainMain.connect(filter);
  osc2.connect(gainHarm); gainHarm.connect(filter);
  osc3.connect(gainHarm2); gainHarm2.connect(filter);
  filter.connect(masterGain);
  masterGain.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(masterGain);
  masterGain.connect(ctx.destination);

  osc1.start(startTime); osc1.stop(startTime + duration + 0.5);
  osc2.start(startTime); osc2.stop(startTime + duration + 0.5);
  osc3.start(startTime); osc3.stop(startTime + duration + 0.5);
}

// Slow, calm piano melody in C major — 4 bars, meditative pace
// Each beat = 0.9 seconds (~67bpm) — very relaxed
const BEAT = 0.9;
const PIANO_MELODY = [
  // Bar 1 — gentle descending C major
  { freq: 523.25, beat: 0,    dur: 3.2 },   // C5
  { freq: 392.00, beat: 2,    dur: 2.8 },   // G4
  { freq: 329.63, beat: 4,    dur: 2.8 },   // E4
  { freq: 261.63, beat: 6,    dur: 3.5 },   // C4
  // Bar 2 — soft walk up
  { freq: 293.66, beat: 8,    dur: 2.8 },   // D4
  { freq: 349.23, beat: 10,   dur: 2.8 },   // F4
  { freq: 440.00, beat: 12,   dur: 3.2 },   // A4
  { freq: 392.00, beat: 14,   dur: 3.5 },   // G4
  // Bar 3 — dreamy arpeggios
  { freq: 261.63, beat: 16,   dur: 2.5 },   // C4
  { freq: 329.63, beat: 17.5, dur: 2.5 },   // E4
  { freq: 392.00, beat: 19,   dur: 2.5 },   // G4
  { freq: 523.25, beat: 20.5, dur: 3.2 },   // C5
  { freq: 392.00, beat: 22,   dur: 2.5 },   // G4
  { freq: 329.63, beat: 23.5, dur: 2.8 },   // E4
  // Bar 4 — peaceful resolution
  { freq: 246.94, beat: 25,   dur: 3.0 },   // B3
  { freq: 261.63, beat: 27,   dur: 3.0 },   // C4
  { freq: 293.66, beat: 29,   dur: 2.8 },   // D4
  { freq: 261.63, beat: 31,   dur: 5.0 },   // C4 — long hold
];
const LOOP_DURATION = 34 * BEAT; // full loop length in seconds

function ConfettiCanvas({ active, rainbow }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particles = useRef([]);
  useEffect(() => {
    if (!active) { particles.current = []; return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
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

function getLeaderboard() {
  try { return JSON.parse(localStorage.getItem("ll_leaderboard") || "[]"); } catch { return []; }
}
function saveLeaderboard(board) {
  try { localStorage.setItem("ll_leaderboard", JSON.stringify(board)); } catch {}
}
function addScore(name, score, level, perfectDay) {
  const board = getLeaderboard();
  board.push({ name, score, level, perfectDay, date: new Date().toLocaleDateString() });
  board.sort((a, b) => b.score - a.score);
  const trimmed = board.slice(0, 10);
  saveLeaderboard(trimmed); return trimmed;
}
function getAllTimeStats() {
  try { return JSON.parse(localStorage.getItem("ll_alltime") || '{"words":0,"score":0}'); } catch { return {words:0,score:0}; }
}
function saveAllTimeStats(stats) {
  try { localStorage.setItem("ll_alltime", JSON.stringify(stats)); } catch {}
}

export default function App() {
  const [playerName, setPlayerName] = useState(localStorage.getItem("ll_name") || "");
  const [editingName, setEditingName] = useState(!localStorage.getItem("ll_name"));
  const [level, setLevel] = useState(1);
  const [tiles, setTiles] = useState(() => {
    const rng = seededRandom(getDailySeed());
    const bp = getBonusPositions(42, getBonusCount(1), rng);
    return generateLevelTiles(1, 0, rng, bp);
  });
  const tileCountRef = useRef(42);
  const levelResetCount = useRef(0);
  const [selected, setSelected] = useState([]);
  const [submitted, setSubmitted] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  const [badges, setBadges] = useState([]);
  const [streak, setStreak] = useState(0);
  const [validating, setValidating] = useState(false);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(null);
  const [showBadge, setShowBadge] = useState(null);
  const [tab, setTab] = useState("play");
  const [confetti, setConfetti] = useState(false);
  const [rainbowConfetti, setRainbowConfetti] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [leaderboard, setLeaderboard] = useState(getLeaderboard());
  const [showNameInput, setShowNameInput] = useState(false);
  const [perfectDay, setPerfectDay] = useState(true);
  const [longestWordToday, setLongestWordToday] = useState("");
  const [longestWordAllTime, setLongestWordAllTime] = useState(localStorage.getItem("ll_longest") || "");
  const [perfectDayAchieved, setPerfectDayAchieved] = useState(false);
  const [levelTime, setLevelTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const timerRef = useRef(null);
  const levelTimeRef = useRef(0);
  const totalTimeRef = useRef(0);
  const submittedRef = useRef([]);
  const totalRef = useRef(0);
  const audioCtxRef = useRef(null);
  const musicLoopRef = useRef(null);
  const nextLoopRef = useRef(0);

  const today = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });
  const dayNum = getDayOfYear();
  const availableTiles = tiles.filter(t => !t.used);
  const tileRows = [];
  for (let i = 0; i < tiles.length; i += 7) tileRows.push(tiles.slice(i, i + 7));
  const currentWord = selected.map(id => tiles.find(t => t.id === id)?.letter).join("");
  const currentScore = calcWordScore(selected, tiles);
  const buyCost = LEVEL_BUY_COST[level] || 0;
  const canBuy = level < 5 && totalRef.current >= buyCost && buyCost > 0;

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      levelTimeRef.current += 1; totalTimeRef.current += 1;
      setLevelTime(levelTimeRef.current); setTotalTime(totalTimeRef.current);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => { clearInterval(timerRef.current); timerRef.current = null; }, []);
  const resetLevelTimer = useCallback(() => { levelTimeRef.current = 0; setLevelTime(0); }, []);

  useEffect(() => { startTimer(); return () => stopTimer(); }, []);

  // ── Soft Piano Music ─────────────────────────────────────────
  const startMusic = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    const scheduleLoop = () => {
      const now = ctx.currentTime;
      const loopStart = Math.max(now, nextLoopRef.current);

      // Schedule every note in the melody
      PIANO_MELODY.forEach(({ freq, beat, dur }) => {
        playPianoNote(ctx, freq, loopStart + beat * BEAT, dur, 0.18);
      });

      nextLoopRef.current = loopStart + LOOP_DURATION;

      // Schedule next loop slightly before it ends for seamless looping
      const msUntilNext = (nextLoopRef.current - ctx.currentTime - 1.0) * 1000;
      musicLoopRef.current = setTimeout(scheduleLoop, Math.max(msUntilNext, 100));
    };

    scheduleLoop();
  }, []);

  const stopMusic = useCallback(() => {
    clearTimeout(musicLoopRef.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    nextLoopRef.current = 0;
  }, []);

  useEffect(() => { if (musicOn) startMusic(); else stopMusic(); return () => stopMusic(); }, [musicOn]);

  const awardBadge = useCallback((id) => {
    setBadges(prev => {
      if (prev.includes(id)) return prev;
      setShowBadge(id);
      setTimeout(() => setShowBadge(null), 2800);
      return [...prev, id];
    });
  }, []);

  const handleSubmit = async () => {
    if (currentWord.length < 3 || validating) return;
    setValidating(true);
    const valid = await validateWordWithAI(currentWord);
    const score = valid ? currentScore : 0;
    const newStreak = valid ? streak + 1 : 0;
    setStreak(newStreak);
    setFlash({ word: currentWord, score, valid });
    setTimeout(() => setFlash(null), 1800);
    if (!valid) { setShake(true); setTimeout(() => setShake(false), 500); }
    const newEntry = { word: currentWord, score, valid };
    const newSubmitted = [...submittedRef.current, newEntry];
    submittedRef.current = newSubmitted;
    setSubmitted(newSubmitted);
    if (valid) {
      const newTotal = totalRef.current + score;
      totalRef.current = newTotal;
      setTotalScore(newTotal);
      const newTiles = tiles.map(t => selected.includes(t.id) ? { ...t, used: true } : t);
      setTiles(newTiles);
      const ats = getAllTimeStats();
      ats.words += 1; ats.score += score;
      saveAllTimeStats(ats);
      if (currentWord.length > (longestWordToday.length || 0)) {
        setLongestWordToday(currentWord); awardBadge("longest_day");
      }
      if (currentWord.length > (longestWordAllTime.length || 0)) {
        setLongestWordAllTime(currentWord);
        localStorage.setItem("ll_longest", currentWord);
      }
      const validCount = newSubmitted.filter(s => s.valid).length;
      if (validCount === 1) awardBadge("first_word");
      if (score >= 50) awardBadge("score_50");
      if (score >= 100) awardBadge("score_100");
      if (score >= 200) awardBadge("score_200");
      if (currentWord.length >= 6) awardBadge("word_6");
      if (currentWord.length >= 7) awardBadge("long_word");
      if (currentWord.length >= 8) awardBadge("word_8");
      if (currentWord.length >= 10) awardBadge("word_10");
      if (newStreak >= 3) awardBadge("streak_3");
      if (newStreak >= 5) awardBadge("streak_5");
      if (newTotal >= 500) awardBadge("daily_500");
      if (newTotal >= 1000) awardBadge("daily_1000");
      if (currentWord.toUpperCase().includes("Q")) awardBadge("perfect_q");
      if (currentWord.toUpperCase().split("").filter(l => VOWELS.has(l)).length >= 4) awardBadge("vowel_rich");
      if (ats.words >= 50) awardBadge("all_time_50");
      if (ats.words >= 100) awardBadge("all_time_100");
      if (ats.score >= 10000) awardBadge("all_time_10k");
      if (levelTimeRef.current < 180) awardBadge("speed_demon");
      if (levelResetCount.current === 0) awardBadge("no_retreat");
      const allUsed = newTiles.every(t => t.used);
      if (allUsed) {
        awardBadge(`all_tiles_${level}`);
        const bonus = 100 * level;
        totalRef.current += bonus;
        setTotalScore(totalRef.current);
        setFlash({ word: "BOARD CLEAR!", score: bonus, valid: true });
        setConfetti(true);
        setTimeout(() => setConfetti(false), 4000);
        stopTimer();
        if (level < 5) setTimeout(() => setLevelComplete(true), 1200);
        else {
          if (perfectDay) {
            setPerfectDayAchieved(true);
            awardBadge("perfect_day");
            setRainbowConfetti(true);
            setTimeout(() => setRainbowConfetti(false), 6000);
            setTimeout(() => setShowNameInput(true), 1000);
          } else setTimeout(() => setShowNameInput(true), 1500);
        }
      }
    }
    setSelected([]);
    setValidating(false);
  };

  const handleNextLevel = (bought = false) => {
    if (bought) setPerfectDay(false);
    const newLevel = level + 1;
    setLevel(newLevel); setLevelComplete(false); setShowBuyModal(false);
    const rng = seededRandom(getDailySeed() + newLevel * 999);
    const count = 42 + (newLevel - 1) * 6;
    const bp = getBonusPositions(count, getBonusCount(newLevel), rng);
    const newTiles = generateLevelTiles(newLevel, tileCountRef.current, rng, bp);
    tileCountRef.current += count;
    setTiles(newTiles); setSelected([]);
    levelResetCount.current = 0;
    resetLevelTimer(); startTimer();
    if (newLevel === 2) awardBadge("level_2");
    if (newLevel === 3) awardBadge("level_3");
    if (newLevel === 4) awardBadge("level_4");
    if (newLevel === 5) awardBadge("level_5");
  };

  const handleLevelReset = () => {
    levelResetCount.current += 1;
    const rng = seededRandom(getDailySeed() + level * 999);
    const count = 42 + (level - 1) * 6;
    const bp = getBonusPositions(count, getBonusCount(level), rng);
    setTiles(generateLevelTiles(level, tileCountRef.current - count, rng, bp));
    setSelected([]); resetLevelTimer();
  };

  const handleBuyLevel = () => {
    const cost = LEVEL_BUY_COST[level];
    if (totalRef.current < cost) return;
    totalRef.current -= cost;
    setTotalScore(totalRef.current);
    handleNextLevel(true);
  };

  const handleSaveScore = () => {
    if (!playerName.trim()) return;
    localStorage.setItem("ll_name", playerName);
    const board = addScore(playerName, totalRef.current, level, perfectDay);
    setLeaderboard(board); setShowNameInput(false);
  };

  const handleFullReset = () => {
    const rng = seededRandom(getDailySeed());
    const bp = getBonusPositions(42, getBonusCount(1), rng);
    setTiles(generateLevelTiles(1, 0, rng, bp));
    tileCountRef.current = 42; setLevel(1); setSelected([]);
    setSubmitted([]); submittedRef.current = [];
    setTotalScore(0); totalRef.current = 0;
    setStreak(0); setBadges([]); setShowBadge(null);
    setLevelComplete(false); setShowBuyModal(false); setShowNameInput(false);
    setPerfectDay(true); setPerfectDayAchieved(false); setLongestWordToday("");
    levelResetCount.current = 0;
    stopTimer();
    levelTimeRef.current = 0; totalTimeRef.current = 0;
    setLevelTime(0); setTotalTime(0); startTimer();
  };

  const handleNameSave = () => {
    if (playerName.trim()) { localStorage.setItem("ll_name", playerName); setEditingName(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#0a0820 0%,#1e1a4a 50%,#0f0e28 100%)", fontFamily:"Georgia,serif", color:"#f5f0e8", display:"flex", flexDirection:"column", alignItems:"center", paddingBottom:60, position:"relative", overflow:"hidden" }}>

      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        {[...Array(50)].map((_,i)=>(
          <div key={i} style={{ position:"absolute", width:(i%4===0?2:1)+"px", height:(i%4===0?2:1)+"px", background:"#fff", borderRadius:"50%", opacity:0.1+((i*7)%5)*0.1, top:((i*37)%100)+"%", left:((i*53)%100)+"%", animation:`twinkle ${2+(i%4)}s infinite alternate`, animationDelay:`${(i%5)*0.4}s` }}/>
        ))}
      </div>

      <style>{`
        @keyframes twinkle{from{opacity:0.08}to{opacity:0.7}}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
        @keyframes pop{0%{transform:translate(-50%,-50%) scale(0.6);opacity:0}60%{transform:translate(-50%,-50%) scale(1.08)}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
        @keyframes slideUp{from{transform:translateY(18px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes badgePop{0%{transform:translateX(-50%) translateY(40px) scale(0.8);opacity:0}20%{transform:translateX(-50%) translateY(0) scale(1.05);opacity:1}80%{transform:translateX(-50%) translateY(0) scale(1);opacity:1}100%{transform:translateX(-50%) translateY(-20px) scale(0.9);opacity:0}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes rainbow{0%{color:#ff0000}16%{color:#ff8800}33%{color:#ffff00}50%{color:#00ff00}66%{color:#0088ff}83%{color:#8800ff}100%{color:#ff0000}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .ll-tile{transition:all 0.14s ease;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;}
        .ll-tile:active{transform:scale(0.88)!important;}
        .ll-tile.sel{transform:translateY(-6px) scale(1.12);}
        .ll-tile.used{opacity:0.15;cursor:default;filter:grayscale(1);}
        .ll-tab{border:none;cursor:pointer;transition:all 0.2s;font-family:Georgia,serif;}
        .ll-btn{transition:all 0.14s;font-family:Georgia,serif;border:none;cursor:pointer;}
        .ll-btn:active{transform:scale(0.95);}
        .bonus-double{box-shadow:0 0 12px 3px rgba(255,215,0,0.8)!important;}
        .bonus-triple{box-shadow:0 0 14px 4px rgba(255,100,255,0.9)!important;}
        .perfect-text{animation:rainbow 2s linear infinite;}
      `}</style>

      <ConfettiCanvas active={confetti && !rainbowConfetti} rainbow={false} />
      <ConfettiCanvas active={rainbowConfetti} rainbow={true} />

      {showBadge&&(()=>{ const b=BADGE_DEFS.find(x=>x.id===showBadge); return b?(<div style={{position:"fixed",top:72,left:"50%",zIndex:9998,animation:"badgePop 2.8s forwards",background:"linear-gradient(135deg,#f6d365,#fda085)",borderRadius:20,padding:"12px 26px",boxShadow:"0 8px 32px rgba(0,0,0,0.7)",textAlign:"center",whiteSpace:"nowrap"}}><div style={{fontSize:28}}>{b.icon}</div><div style={{fontWeight:"bold",color:"#1a1a2e",fontSize:13}}>Badge Earned!</div><div style={{color:"#2d1b00",fontSize:12,fontWeight:"bold"}}>{b.label}</div></div>):null; })()}

      {flash&&<div style={{position:"fixed",top:"40%",left:"50%",zIndex:9997,animation:"pop 0.3s ease forwards",background:flash.valid?"rgba(30,160,70,0.97)":"rgba(190,30,30,0.96)",borderRadius:18,padding:"14px 30px",boxShadow:"0 6px 28px rgba(0,0,0,0.7)",textAlign:"center"}}><div style={{fontSize:20,fontWeight:"bold",letterSpacing:3,color:"#fff"}}>{flash.word}</div><div style={{fontSize:flash.valid?18:13,color:"#fff",marginTop:4}}>{flash.valid?`+${flash.score} pts`:"Not a valid word!"}</div></div>}

      {validating&&<div style={{position:"fixed",top:"40%",left:"50%",transform:"translate(-50%,-50%)",background:"rgba(10,8,30,0.97)",borderRadius:20,padding:"18px 34px",zIndex:9996,boxShadow:"0 6px 30px rgba(0,0,0,0.8)",textAlign:"center",border:"1px solid rgba(255,255,255,0.2)"}}><div style={{fontSize:26,animation:"spin 1s linear infinite",display:"inline-block"}}>🔍</div><div style={{fontSize:12,marginTop:8,color:"#ccc",letterSpacing:2}}>CHECKING…</div></div>}

      {perfectDayAchieved&&(
        <div style={{position:"fixed",inset:0,zIndex:9500,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:28,padding:"40px 32px",textAlign:"center",boxShadow:"0 16px 60px rgba(0,0,0,0.9)",border:"2px solid rgba(255,215,0,0.5)",maxWidth:340,width:"90%"}}>
            <div style={{fontSize:56}}>🌈</div>
            <div style={{fontSize:26,fontWeight:"bold",marginTop:10}} className="perfect-text">PERFECT DAY!</div>
            <div style={{fontSize:15,color:"#f5f0e8",marginTop:12,lineHeight:1.7}}>You completed all 5 levels<br/>without buying a single one!</div>
            <div style={{marginTop:16,background:"rgba(255,255,255,0.08)",borderRadius:12,padding:"12px",fontSize:12,color:"#ccc",lineHeight:1.6}}>
              🏆 {playerName||"You"} achieved a Perfect Day!<br/>Day #{dayNum} · Score: {totalScore} pts
            </div>
            <button className="ll-btn" onClick={()=>{navigator.clipboard?.writeText(`🌈 PERFECT DAY on LetterLoot!\nI completed all 5 levels without buying any!\nDay #${dayNum} · Score: ${totalScore} pts 🏆\nPlay at letterloot-6k6v.vercel.app`); setPerfectDayAchieved(false);}} style={{marginTop:18,width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:14,fontWeight:"bold"}}>📋 Copy & Share!</button>
            <button className="ll-btn" onClick={()=>setPerfectDayAchieved(false)} style={{marginTop:8,width:"100%",padding:"10px",borderRadius:12,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.5)",fontSize:12}}>Continue</button>
          </div>
        </div>
      )}

      {levelComplete&&(
        <div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:"36px 32px",textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,215,0,0.35)",maxWidth:320,width:"90%"}}>
            <div style={{fontSize:52}}>🎉</div>
            <div style={{fontSize:26,fontWeight:"bold",color:"#f6d365",marginTop:8}}>Level {level} Complete!</div>
            <div style={{fontSize:13,color:"#ccc",marginTop:8}}>You used every tile!</div>
            <div style={{fontSize:22,color:"#fda085",fontWeight:"bold",marginTop:10}}>+{100*level} Bonus Points!</div>
            <div style={{fontSize:11,color:"#aaa",marginTop:4}}>Time: {formatTime(levelTimeRef.current)}</div>
            <div style={{fontSize:12,color:"#aaa",marginTop:4}}>Level {level+1}: {42+level*6} tiles · {getBonusCount(level+1)} bonus tiles</div>
            <button className="ll-btn" onClick={()=>handleNextLevel(false)} style={{marginTop:20,width:"100%",padding:"14px",borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:15,fontWeight:"bold"}}>Play Level {level+1} →</button>
          </div>
        </div>
      )}

      {showBuyModal&&(
        <div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:"32px",textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,255,255,0.18)",maxWidth:300,width:"90%"}}>
            <div style={{fontSize:44}}>🔓</div>
            <div style={{fontSize:20,fontWeight:"bold",color:"#f5f0e8",marginTop:8}}>Buy Level {level+1}?</div>
            <div style={{fontSize:13,color:"#bbb",marginTop:8,lineHeight:1.6}}>You haven't cleared all tiles yet.<br/>Spend points to unlock the next level.</div>
            <div style={{fontSize:24,color:"#f6d365",fontWeight:"bold",marginTop:12}}>{buyCost} pts</div>
            <div style={{fontSize:12,color:totalScore>=buyCost?"#6ee7b7":"#fb7185",marginTop:4}}>You have: {totalScore} pts · {totalScore>=buyCost?"✓ Enough":"✗ Not enough"}</div>
            <div style={{fontSize:11,color:"#f093fb",marginTop:6}}>⚠️ Buying forfeits your Perfect Day</div>
            <button className="ll-btn" onClick={handleBuyLevel} disabled={!canBuy} style={{marginTop:16,width:"100%",padding:"13px",borderRadius:14,background:canBuy?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.1)",color:canBuy?"#1a1a2e":"rgba(255,255,255,0.3)",fontSize:14,fontWeight:"bold",cursor:canBuy?"pointer":"default"}}>{canBuy?`Unlock Level ${level+1} — ${buyCost} pts`:"Not enough points"}</button>
            <button className="ll-btn" onClick={()=>setShowBuyModal(false)} style={{marginTop:8,width:"100%",padding:"10px",borderRadius:12,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.5)",fontSize:12}}>Keep Playing</button>
          </div>
        </div>
      )}

      {showNameInput&&(
        <div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"linear-gradient(135deg,#1a1040,#2d1b69)",borderRadius:24,padding:"36px 32px",textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.8)",border:"1px solid rgba(255,215,0,0.35)",maxWidth:320,width:"90%"}}>
            <div style={{fontSize:44}}>{perfectDay?"🌈":"🏆"}</div>
            <div style={{fontSize:22,fontWeight:"bold",color:"#f6d365",marginTop:8}}>{perfectDay?"Perfect Day!":"Game Complete!"}</div>
            <div style={{fontSize:28,fontWeight:"bold",color:"#fff",marginTop:8}}>{totalScore} pts</div>
            <div style={{fontSize:12,color:"#aaa",marginTop:4}}>Level {level} · Day #{dayNum} · {formatTime(totalTimeRef.current)}</div>
            <div style={{fontSize:13,color:"#ccc",marginTop:16,marginBottom:8}}>Save your score to leaderboard:</div>
            <input value={playerName} onChange={e=>setPlayerName(e.target.value)} placeholder="Your name…" style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.1)",color:"#f5f0e8",fontSize:15,fontFamily:"Georgia,serif",outline:"none",textAlign:"center"}}/>
            <button className="ll-btn" onClick={handleSaveScore} style={{marginTop:14,width:"100%",padding:"12px",borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:14,fontWeight:"bold"}}>Save to Leaderboard 🏆</button>
            <button className="ll-btn" onClick={()=>setShowNameInput(false)} style={{marginTop:8,width:"100%",padding:"10px",borderRadius:12,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.4)",fontSize:12}}>Skip</button>
          </div>
        </div>
      )}

      <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"12px 14px 0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:6}}>
          {editingName?(
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <input value={playerName} onChange={e=>setPlayerName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleNameSave()} placeholder="Enter your name…" style={{padding:"5px 12px",borderRadius:20,border:"1px solid rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.1)",color:"#f5f0e8",fontSize:12,fontFamily:"Georgia,serif",outline:"none",width:160,textAlign:"center"}}/>
              <button className="ll-btn" onClick={handleNameSave} style={{padding:"5px 12px",borderRadius:20,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:11,fontWeight:"bold"}}>Save</button>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}} onClick={()=>setEditingName(true)}>
              <span style={{fontSize:13,color:"#f6d365",fontWeight:"bold"}}>👤 {playerName||"Set Name"}</span>
              <span style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>✏️</span>
            </div>
          )}
        </div>

        <div style={{textAlign:"center",marginBottom:6}}>
          <div style={{fontSize:34,fontWeight:"bold",letterSpacing:5,background:"linear-gradient(90deg,#f6d365,#fda085,#f093fb,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>LetterLoot</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginTop:4}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.55)",letterSpacing:2}}>LEVEL {level}/5 · DAY #{dayNum}</div>
            <button onClick={()=>setMusicOn(m=>!m)} style={{background:"none",border:"1px solid rgba(255,255,255,0.25)",borderRadius:20,padding:"3px 10px",cursor:"pointer",fontSize:11,color:musicOn?"#f6d365":"rgba(255,255,255,0.5)",fontFamily:"Georgia,serif"}}>{musicOn?"🎹 ON":"🎹 OFF"}</button>
            {perfectDay&&<div style={{fontSize:9,color:"#6ee7b7",animation:"pulse 2s infinite"}}>🌈 On Track!</div>}
          </div>
        </div>

        <div style={{background:"rgba(255,255,255,0.1)",borderRadius:10,height:6,overflow:"hidden",marginBottom:4}}>
          <div style={{height:"100%",width:`${((level-1)/5)*100}%`,background:"linear-gradient(90deg,#f6d365,#fda085)",borderRadius:10,transition:"width 0.5s ease"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"0 2px",marginBottom:8}}>
          {[1,2,3,4,5].map(l=>(<div key={l} style={{fontSize:8,color:l<=level?"#f6d365":"rgba(255,255,255,0.3)",fontWeight:l===level?"bold":"normal"}}>L{l}</div>))}
        </div>

        <div style={{display:"flex",justifyContent:"center",gap:20,marginBottom:8,background:"rgba(255,255,255,0.06)",borderRadius:12,padding:"8px",border:"1px solid rgba(255,255,255,0.12)"}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:"bold",color:"#60a5fa",fontFamily:"monospace"}}>{formatTime(levelTime)}</div>
            <div style={{fontSize:7,color:"rgba(255,255,255,0.45)",letterSpacing:2}}>LEVEL TIME</div>
          </div>
          <div style={{width:1,background:"rgba(255,255,255,0.15)"}}/>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:"bold",color:"#a78bfa",fontFamily:"monospace"}}>{formatTime(totalTime)}</div>
            <div style={{fontSize:7,color:"rgba(255,255,255,0.45)",letterSpacing:2}}>TOTAL TIME</div>
          </div>
        </div>

        <div style={{display:"flex",gap:5,justifyContent:"center",margin:"6px 0",flexWrap:"wrap"}}>
          {[["play","🎮 Play"],["badges","🏅 Badges"],["history","📜 History"],["leaderboard","🏆 Board"]].map(([id,label])=>(
            <button key={id} className="ll-tab" onClick={()=>setTab(id)} style={{padding:"5px 11px",borderRadius:20,fontSize:10,background:tab===id?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.1)",color:tab===id?"#1a1a2e":"#f5f0e8",fontWeight:tab===id?"bold":"normal",border:tab===id?"none":"1px solid rgba(255,255,255,0.18)"}}>{label}</button>
          ))}
        </div>

        <div style={{display:"flex",justifyContent:"space-around",alignItems:"center",background:"rgba(255,255,255,0.08)",borderRadius:13,padding:"9px 6px",marginBottom:9,border:"1px solid rgba(255,255,255,0.18)"}}>
          {[[totalScore,"PTS","#f6d365"],[`⚡${streak}`,"STREAK","#fda085"],[`${badges.length}/${BADGE_DEFS.length}`,"BADGES","#f093fb"],[submitted.filter(s=>s.valid).length,"WORDS","#6ee7b7"],[availableTiles.length,"LEFT","#60a5fa"]].map(([val,label,color])=>(
            <div key={label} style={{textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:"bold",color}}>{val}</div>
              <div style={{fontSize:7,color:"rgba(255,255,255,0.55)",letterSpacing:1.5}}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {tab==="play"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          <div style={{background:"rgba(255,255,255,0.08)",borderRadius:15,padding:"12px",marginBottom:9,border:"1px solid rgba(255,255,255,0.2)",minHeight:72}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.65)",letterSpacing:3,marginBottom:7}}>YOUR WORD</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,minHeight:40,alignItems:"center",animation:shake?"shake 0.4s ease":"none"}}>
              {selected.length===0
                ?<div style={{color:"rgba(255,255,255,0.35)",fontSize:12,fontStyle:"italic"}}>Tap tiles below to start…</div>
                :selected.map(id=>{ const tile=tiles.find(t=>t.id===id); return(
                  <div key={id} onClick={()=>!validating&&setSelected(prev=>prev.filter(i=>i!==id))} style={{background:tile?.bonus==="triple"?"linear-gradient(135deg,#e040fb,#7b1fa2)":tile?.bonus==="double"?"linear-gradient(135deg,#ffd700,#f57c00)":"linear-gradient(135deg,#5c6bc0,#512da8)",borderRadius:8,padding:"6px 10px",display:"flex",flexDirection:"column",alignItems:"center",boxShadow:"0 3px 10px rgba(0,0,0,0.5)",cursor:"pointer",minWidth:34}}>
                    <div style={{fontSize:17,fontWeight:"bold",lineHeight:1,color:"#fff"}}>{tile?.letter}</div>
                    <div style={{fontSize:8,color:"rgba(255,255,255,0.95)",fontWeight:"bold"}}>{tile?.bonus==="triple"?"3×":tile?.bonus==="double"?"2×":tile?.value}</div>
                  </div>
                );})
              }
            </div>
            {currentWord.length>0&&<div style={{marginTop:7,display:"flex",justifyContent:"space-between"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.65)"}}>Value: <span style={{color:"#f6d365",fontWeight:"bold",fontSize:12}}>{currentScore}</span>{currentWord.length<3&&<span style={{color:"#fb7185",marginLeft:6,fontSize:9}}>need 3+</span>}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.45)"}}>{currentWord.length} letters</div></div>}
          </div>

          <div style={{display:"flex",gap:12,justifyContent:"center",marginBottom:8}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.75)",display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:"#ffd700",boxShadow:"0 0 8px #ffd700"}}/>2× Double</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.75)",display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:"#e040fb",boxShadow:"0 0 8px #e040fb"}}/>3× Triple</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>+{100*level} clear bonus</div>
          </div>

          <div style={{display:"flex",gap:6,marginBottom:8}}>
            <button className="ll-btn" onClick={()=>!validating&&setSelected([])} style={{flex:1,padding:"10px",borderRadius:11,fontSize:11,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.25)",color:"#f5f0e8"}}>Clear</button>
            <button className="ll-btn" onClick={handleSubmit} disabled={currentWord.length<3||validating} style={{flex:2,padding:"10px",borderRadius:11,fontSize:13,fontWeight:"bold",background:currentWord.length>=3&&!validating?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.08)",color:currentWord.length>=3&&!validating?"#1a1a2e":"rgba(255,255,255,0.3)",cursor:currentWord.length>=3&&!validating?"pointer":"default"}}>{validating?"Checking…":"Submit Word"}</button>
          </div>

          <div style={{display:"flex",gap:6,marginBottom:9}}>
            <button className="ll-btn" onClick={handleLevelReset} style={{flex:1,padding:"9px",borderRadius:11,fontSize:11,background:"rgba(96,165,250,0.15)",border:"1px solid rgba(96,165,250,0.45)",color:"#93c5fd"}}>↺ Reset Level</button>
            {level<5&&<button className="ll-btn" onClick={()=>setShowBuyModal(true)} style={{flex:1,padding:"9px",borderRadius:11,fontSize:11,background:canBuy?"rgba(246,211,101,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${canBuy?"rgba(246,211,101,0.45)":"rgba(255,255,255,0.12)"}`,color:canBuy?"#f6d365":"rgba(255,255,255,0.35)"}}>🔓 Buy L{level+1} ({buyCost}pts)</button>}
          </div>

          <div style={{background:"rgba(255,255,255,0.06)",borderRadius:15,padding:"10px 6px",border:"1px solid rgba(255,255,255,0.15)"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",letterSpacing:2,marginBottom:8,textAlign:"center"}}>LEVEL {level} · {availableTiles.length} of {tiles.length} tiles remaining</div>
            {tileRows.map((row,ri)=>(
              <div key={ri} style={{display:"flex",justifyContent:"center",gap:4,marginBottom:4}}>
                {row.map(tile=>{ const isSel=selected.includes(tile.id); const isDouble=tile.bonus==="double"; const isTriple=tile.bonus==="triple"; return(
                  <div key={tile.id} className={`ll-tile${isSel?" sel":""}${tile.used?" used":""}${isDouble?" bonus-double":""}${isTriple?" bonus-triple":""}`} onClick={()=>!tile.used&&!validating&&setSelected(prev=>prev.includes(tile.id)?prev.filter(i=>i!==tile.id):[...prev,tile.id])} style={{width:42,height:50,background:tile.used?"rgba(255,255,255,0.02)":isSel?"linear-gradient(135deg,#5c6bc0,#512da8)":isTriple?"linear-gradient(135deg,rgba(224,64,251,0.35),rgba(123,31,162,0.25))":isDouble?"linear-gradient(135deg,rgba(255,215,0,0.35),rgba(245,124,0,0.25))":"linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.07))",borderRadius:9,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:isSel?"2px solid #9fa8da":isTriple?"1px solid rgba(224,64,251,0.65)":isDouble?"1px solid rgba(255,215,0,0.65)":"1px solid rgba(255,255,255,0.2)"}}>
                    <div style={{fontSize:18,fontWeight:"bold",lineHeight:1,color:tile.used?"rgba(255,255,255,0.2)":"#fff"}}>{tile.letter}</div>
                    <div style={{fontSize:8,fontWeight:"bold",marginTop:1,color:tile.used?"rgba(255,255,255,0.1)":isTriple?"#e040fb":isDouble?"#ffd700":"#fda085"}}>{isTriple?"3×":isDouble?"2×":tile.value}</div>
                  </div>
                );})}
              </div>
            ))}
          </div>

          {longestWordToday&&<div style={{textAlign:"center",marginTop:8,fontSize:10,color:"rgba(255,255,255,0.5)"}}>📏 Today's longest: <span style={{color:"#a78bfa",fontWeight:"bold"}}>{longestWordToday}</span> ({longestWordToday.length} letters){longestWordAllTime&&longestWordAllTime.length>longestWordToday.length&&<span> · All-time: <span style={{color:"#f093fb"}}>{longestWordAllTime}</span></span>}</div>}

          <div style={{textAlign:"center",marginTop:10}}>
            <button onClick={handleFullReset} style={{background:"none",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.35)",padding:"6px 16px",borderRadius:20,fontSize:9,cursor:"pointer",fontFamily:"Georgia,serif"}}>↺ Reset Full Game</button>
          </div>
        </div>
      )}

      {tab==="badges"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          {[["core","⚡ Core Badges"],["level","📈 Level Badges"],["word","📝 Word Badges"],["alltime","🐉 All-Time Badges"]].map(([cat,title])=>(
            <div key={cat} style={{marginBottom:16}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",letterSpacing:3,marginBottom:8,paddingLeft:4}}>{title}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {BADGE_DEFS.filter(b=>b.cat===cat).map(b=>{ const earned=badges.includes(b.id); return(
                  <div key={b.id} style={{background:earned?"linear-gradient(135deg,rgba(246,211,101,0.18),rgba(253,160,133,0.12))":"rgba(255,255,255,0.05)",border:earned?"1px solid rgba(246,211,101,0.45)":"1px solid rgba(255,255,255,0.14)",borderRadius:12,padding:"12px 9px",textAlign:"center"}}>
                    <div style={{fontSize:26,filter:earned?"none":"grayscale(1)",opacity:earned?1:0.22}}>{b.icon}</div>
                    <div style={{fontSize:11,fontWeight:"bold",marginTop:4,color:earned?"#f6d365":"rgba(255,255,255,0.4)"}}>{b.label}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.5)",marginTop:2,lineHeight:1.4}}>{b.desc}</div>
                    {earned&&<div style={{marginTop:4,fontSize:8,color:"#fda085",letterSpacing:2}}>✓ EARNED</div>}
                  </div>
                );})}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="history"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          {submitted.length===0
            ?<div style={{textAlign:"center",color:"rgba(255,255,255,0.35)",marginTop:40,fontSize:12,fontStyle:"italic"}}>No words yet — go loot some letters!</div>
            :<div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[...submitted].reverse().map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:s.valid?"rgba(80,220,100,0.1)":"rgba(220,80,80,0.1)",border:`1px solid ${s.valid?"rgba(80,220,100,0.3)":"rgba(220,80,80,0.25)"}`,borderRadius:11,padding:"9px 13px"}}>
                  <div><div style={{fontSize:14,fontWeight:"bold",letterSpacing:3,color:"#f5f0e8"}}>{s.word}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.5)",marginTop:1}}>{s.valid?"Valid ✓":"Invalid ✗"}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:18,fontWeight:"bold",color:s.valid?"#6ee7b7":"rgba(255,255,255,0.25)"}}>{s.valid?`+${s.score}`:"—"}</div>{s.valid&&<div style={{fontSize:9,color:"rgba(255,255,255,0.45)"}}>points</div>}</div>
                </div>
              ))}
              <div style={{textAlign:"center",padding:"12px",background:"rgba(255,255,255,0.07)",borderRadius:12,marginTop:2,border:"1px solid rgba(255,255,255,0.15)"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.55)"}}>TOTAL LOOT</div>
                <div style={{fontSize:26,fontWeight:"bold",color:"#f6d365"}}>{totalScore}</div>
              </div>
            </div>
          }
        </div>
      )}

      {tab==="leaderboard"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          <div style={{textAlign:"center",marginBottom:14}}><div style={{fontSize:11,color:"rgba(255,255,255,0.55)",letterSpacing:3}}>TOP LOOTERS</div></div>
          {leaderboard.length===0
            ?<div style={{textAlign:"center",color:"rgba(255,255,255,0.35)",marginTop:40,fontSize:12,fontStyle:"italic"}}>No scores yet — clear a level to appear here!</div>
            :leaderboard.map((entry,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,background:i===0?"linear-gradient(135deg,rgba(246,211,101,0.18),rgba(253,160,133,0.1))":"rgba(255,255,255,0.05)",border:i===0?"1px solid rgba(246,211,101,0.4)":"1px solid rgba(255,255,255,0.13)",borderRadius:12,padding:"11px 14px",marginBottom:7}}>
                <div style={{fontSize:20,minWidth:30,textAlign:"center"}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:"bold",color:"#f5f0e8"}}>{entry.name}{entry.perfectDay?" 🌈":""}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.45)"}}>Level {entry.level} · {entry.date}</div>
                </div>
                <div style={{fontSize:20,fontWeight:"bold",color:"#f6d365"}}>{entry.score}</div>
              </div>
            ))
          }
          <div style={{textAlign:"center",marginTop:12}}>
            <button onClick={()=>{saveLeaderboard([]);setLeaderboard([]);}} style={{background:"none",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.3)",padding:"6px 14px",borderRadius:20,fontSize:9,cursor:"pointer",fontFamily:"Georgia,serif"}}>Clear Leaderboard</button>
          </div>
        </div>
      )}
    </div>
  );
}
