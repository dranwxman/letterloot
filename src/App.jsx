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

const FREQ = { A:9,B:2,C:2,D:4,E:12,F:2,G:3,H:2,I:9,J:1,K:1,L:4,M:2,N:6,O:8,P:2,Q:1,R:6,S:4,T:6,U:4,V:2,W:2,X:1,Y:2,Z:1 };
function buildPool(rng) {
  const pool = [];
  Object.entries(FREQ).forEach(([l, c]) => { for (let i = 0; i < c; i++) pool.push(l); });
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool;
}
function generateLevelTiles(level, existingCount, rng, bonusPositions) {
  const pool = buildPool(rng);
  const count = 42 + (level - 1) * 6;
  return pool.slice(0, count).map((l, i) => ({
    id: existingCount + i, letter: l, value: LETTER_VALUES[l], used: false,
    bonus: bonusPositions.includes(i) ? (Math.random() < 0.5 ? "double" : "triple") : null,
  }));
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

function calcWordScore(word, tileIds, tiles) {
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

const BADGE_DEFS = [
  { id:"first_word", icon:"✨", label:"First Loot",  desc:"Submit your first word" },
  { id:"score_50",   icon:"🔥", label:"On Fire",     desc:"Score 50+ in one word" },
  { id:"score_100",  icon:"💯", label:"Century",     desc:"Score 100+ in one word" },
  { id:"long_word",  icon:"📏", label:"Long Haul",   desc:"Use 7+ letters in a word" },
  { id:"streak_3",   icon:"⚡", label:"Streak x3",  desc:"3 valid words in a row" },
  { id:"daily_500",  icon:"🏆", label:"Loot Master", desc:"500+ total daily score" },
  { id:"perfect_q",  icon:"👑", label:"Q Master",    desc:"Use the letter Q" },
  { id:"vowel_rich", icon:"🎵", label:"Vowel Rich",  desc:"Word with 4+ vowels" },
  { id:"level_2",    icon:"🥈", label:"Level 2",     desc:"Reach Level 2" },
  { id:"level_3",    icon:"🥇", label:"Level 3",     desc:"Reach Level 3" },
  { id:"level_5",    icon:"💎", label:"Diamond",     desc:"Reach Level 5" },
  { id:"all_tiles",  icon:"🌟", label:"Full Board",  desc:"Use all tiles in a level" },
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

function createGuitar(ctx) {
  function pluck(freq, time, duration = 2.0, gain = 0.4) {
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.round(sampleRate / freq);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3000;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(gain, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.03;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    gainNode.connect(ctx.destination);
    delay.connect(ctx.destination);
    source.start(time);
    source.stop(time + duration + 0.5);
  }
  return { pluck };
}

const MELODY = [
  { freq: 196.00, beat: 0 },
  { freq: 246.94, beat: 0.5 },
  { freq: 392.00, beat: 1.0 },
  { freq: 329.63, beat: 1.5 },
  { freq: 293.66, beat: 2.0 },
  { freq: 246.94, beat: 2.5 },
  { freq: 392.00, beat: 3.0 },
  { freq: 329.63, beat: 3.5 },
  { freq: 261.63, beat: 4.0 },
  { freq: 329.63, beat: 4.5 },
  { freq: 392.00, beat: 5.0 },
  { freq: 329.63, beat: 5.5 },
  { freq: 261.63, beat: 6.0 },
  { freq: 246.94, beat: 6.5 },
  { freq: 329.63, beat: 7.0 },
  { freq: 261.63, beat: 7.5 },
  { freq: 293.66, beat: 8.0 },
  { freq: 369.99, beat: 8.5 },
  { freq: 440.00, beat: 9.0 },
  { freq: 369.99, beat: 9.5 },
  { freq: 293.66, beat:10.0 },
  { freq: 246.94, beat:10.5 },
  { freq: 369.99, beat:11.0 },
  { freq: 293.66, beat:11.5 },
  { freq: 164.81, beat:12.0 },
  { freq: 246.94, beat:12.5 },
  { freq: 329.63, beat:13.0 },
  { freq: 246.94, beat:13.5 },
  { freq: 196.00, beat:14.0 },
  { freq: 246.94, beat:14.5 },
  { freq: 329.63, beat:15.0 },
  { freq: 246.94, beat:15.5 },
];
const BEAT_DURATION = 0.32;
const LOOP_DURATION = 16 * BEAT_DURATION;

function ConfettiCanvas({ active }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particles = useRef([]);

  useEffect(() => {
    if (!active) { particles.current = []; return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#f6d365","#fda085","#f093fb","#a78bfa","#6ee7b7","#60a5fa","#fb7185"];
    particles.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 100,
      w: 8 + Math.random() * 8,
      h: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.15,
      vx: (Math.random() - 0.5) * 4,
      vy: 3 + Math.random() * 4,
      opacity: 1,
    }));
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;
        if (p.y > canvas.height * 0.7) p.opacity -= 0.02;
      });
      particles.current = particles.current.filter(p => p.opacity > 0);
      if (particles.current.length > 0) animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} style={{ position:"fixed", inset:0, zIndex:9999, pointerEvents:"none" }} />;
}

function getLeaderboard() {
  try { return JSON.parse(localStorage.getItem("ll_leaderboard") || "[]"); } catch { return []; }
}
function saveLeaderboard(board) {
  try { localStorage.setItem("ll_leaderboard", JSON.stringify(board)); } catch {}
}
function addScore(name, score, level) {
  const board = getLeaderboard();
  board.push({ name, score, level, date: new Date().toLocaleDateString() });
  board.sort((a, b) => b.score - a.score);
  const trimmed = board.slice(0, 10);
  saveLeaderboard(trimmed);
  return trimmed;
}

export default function App() {
  const [level, setLevel] = useState(1);
  const [tiles, setTiles] = useState(() => {
    const rng = seededRandom(getDailySeed());
    const count = 42;
    const bonusPositions = getBonusPositions(count, getBonusCount(1), rng);
    return generateLevelTiles(1, 0, rng, bonusPositions);
  });
  const tileCountRef = useRef(42);
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
  const [levelComplete, setLevelComplete] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [leaderboard, setLeaderboard] = useState(getLeaderboard());
  const [playerName, setPlayerName] = useState(localStorage.getItem("ll_name") || "");
  const [showNameInput, setShowNameInput] = useState(false);
  const submittedRef = useRef([]);
  const totalRef = useRef(0);
  const audioCtxRef = useRef(null);
  const musicLoopRef = useRef(null);
  const nextLoopTimeRef = useRef(0);

  const today = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });
  const dayNum = getDayOfYear();
  const availableTiles = tiles.filter(t => !t.used);
  const tileRows = [];
  for (let i = 0; i < tiles.length; i += 7) tileRows.push(tiles.slice(i, i + 7));

  const startMusic = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    const guitar = createGuitar(ctx);
    const scheduleLoop = () => {
      const now = ctx.currentTime;
      const start = Math.max(now, nextLoopTimeRef.current);
      MELODY.forEach(({ freq, beat }) => {
        guitar.pluck(freq, start + beat * BEAT_DURATION, 1.8, 0.35);
      });
      nextLoopTimeRef.current = start + LOOP_DURATION;
      musicLoopRef.current = setTimeout(scheduleLoop, (nextLoopTimeRef.current - ctx.currentTime - 0.1) * 1000);
    };
    scheduleLoop();
  }, []);

  const stopMusic = useCallback(() => {
    clearTimeout(musicLoopRef.current);
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
  }, []);

  useEffect(() => {
    if (musicOn) startMusic(); else stopMusic();
    return () => stopMusic();
  }, [musicOn]);

  const awardBadge = useCallback((id) => {
    setBadges(prev => {
      if (prev.includes(id)) return prev;
      setShowBadge(id);
      setTimeout(() => setShowBadge(null), 2500);
      return [...prev, id];
    });
  }, []);

  const handleTileClick = (tile) => {
    if (tile.used || validating) return;
    setSelected(prev => prev.includes(tile.id) ? prev.filter(id => id !== tile.id) : [...prev, tile.id]);
  };

  const currentWord = selected.map(id => tiles.find(t => t.id === id)?.letter).join("");
  const currentScore = calcWordScore(currentWord, selected, tiles);

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
      const validCount = newSubmitted.filter(s => s.valid).length;
      if (validCount === 1) awardBadge("first_word");
      if (score >= 50) awardBadge("score_50");
      if (score >= 100) awardBadge("score_100");
      if (currentWord.length >= 7) awardBadge("long_word");
      if (newStreak >= 3) awardBadge("streak_3");
      if (newTotal >= 500) awardBadge("daily_500");
      if (currentWord.toUpperCase().includes("Q")) awardBadge("perfect_q");
      const vowelCount = currentWord.toUpperCase().split("").filter(l => VOWELS.has(l)).length;
      if (vowelCount >= 4) awardBadge("vowel_rich");
      const allUsed = newTiles.every(t => t.used);
      if (allUsed) {
        awardBadge("all_tiles");
        const bonus = 100 * level;
        totalRef.current += bonus;
        setTotalScore(totalRef.current);
        setFlash({ word: `BOARD CLEAR!`, score: bonus, valid: true });
        setConfetti(true);
        setTimeout(() => setConfetti(false), 3500);
        if (level < 5) setTimeout(() => setLevelComplete(true), 1200);
        else setTimeout(() => setShowNameInput(true), 1500);
      }
    }
    setSelected([]);
    setValidating(false);
  };

  const handleNextLevel = () => {
    const newLevel = level + 1;
    setLevel(newLevel);
    setLevelComplete(false);
    const rng = seededRandom(getDailySeed() + newLevel * 999);
    const count = 42 + (newLevel - 1) * 6;
    const bonusPositions = getBonusPositions(count, getBonusCount(newLevel), rng);
    const newTiles = generateLevelTiles(newLevel, tileCountRef.current, rng, bonusPositions);
    tileCountRef.current += count;
    setTiles(newTiles);
    setSelected([]);
    if (newLevel === 2) awardBadge("level_2");
    if (newLevel === 3) awardBadge("level_3");
    if (newLevel === 5) awardBadge("level_5");
  };

  const handleSaveScore = () => {
    if (!playerName.trim()) return;
    localStorage.setItem("ll_name", playerName);
    const board = addScore(playerName, totalRef.current, level);
    setLeaderboard(board);
    setShowNameInput(false);
  };

  const handleReset = () => {
    const rng = seededRandom(getDailySeed());
    const bonusPositions = getBonusPositions(42, getBonusCount(1), rng);
    setTiles(generateLevelTiles(1, 0, rng, bonusPositions));
    tileCountRef.current = 42;
    setLevel(1);
    setSelected([]);
    setSubmitted([]);
    submittedRef.current = [];
    setTotalScore(0);
    totalRef.current = 0;
    setStreak(0);
    setBadges([]);
    setShowBadge(null);
    setLevelComplete(false);
    setShowNameInput(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#0f0c29 0%,#302b63 50%,#24243e 100%)", fontFamily:"Georgia,serif", color:"#f0e6d3", display:"flex", flexDirection:"column", alignItems:"center", paddingBottom:50, position:"relative", overflow:"hidden" }}>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        {[...Array(40)].map((_,i)=>(
          <div key={i} style={{ position:"absolute", width:(i%3===0?2:1)+"px", height:(i%3===0?2:1)+"px", background:"#fff", borderRadius:"50%", opacity:0.05+((i*7)%5)*0.08, top:((i*37)%100)+"%", left:((i*53)%100)+"%", animation:`twinkle ${2+(i%4)}s infinite alternate`, animationDelay:`${(i%5)*0.4}s` }}/>
        ))}
      </div>

      <style>{`
        @keyframes twinkle{from{opacity:0.05}to{opacity:0.55}}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
        @keyframes pop{0%{transform:translate(-50%,-50%) scale(0.6);opacity:0}60%{transform:translate(-50%,-50%) scale(1.08)}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
        @keyframes slideUp{from{transform:translateY(18px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes badgePop{0%{transform:translateX(-50%) translateY(40px) scale(0.8);opacity:0}20%{transform:translateX(-50%) translateY(0) scale(1.05);opacity:1}80%{transform:translateX(-50%) translateY(0) scale(1);opacity:1}100%{transform:translateX(-50%) translateY(-20px) scale(0.9);opacity:0}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes levelPop{0%{transform:translate(-50%,-50%) scale(0.5);opacity:0}60%{transform:translate(-50%,-50%) scale(1.05);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
        .ll-tile{transition:all 0.14s ease;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;}
        .ll-tile:active{transform:scale(0.88)!important;}
        .ll-tile.sel{transform:translateY(-5px) scale(1.1);}
        .ll-tile.used{opacity:0.18;cursor:default;filter:grayscale(1);}
        .ll-tab{border:none;cursor:pointer;transition:all 0.2s;font-family:Georgia,serif;}
        .ll-btn{transition:all 0.14s;font-family:Georgia,serif;border:none;cursor:pointer;}
        .ll-btn:active{transform:scale(0.95);}
        .bonus-double{box-shadow:0 0 10px 2px rgba(246,211,101,0.7)!important;border:2px solid #f6d365!important;}
        .bonus-triple{box-shadow:0 0 12px 3px rgba(240,147,251,0.8)!important;border:2px solid #f093fb!important;}
      `}</style>

      <ConfettiCanvas active={confetti} />

      {showBadge && (()=>{ const b=BADGE_DEFS.find(x=>x.id===showBadge); return b?(<div style={{position:"fixed",top:72,left:"50%",zIndex:999,animation:"badgePop 2.5s forwards",background:"linear-gradient(135deg,#f6d365,#fda085)",borderRadius:20,padding:"12px 26px",boxShadow:"0 8px 32px rgba(0,0,0,0.5)",textAlign:"center",whiteSpace:"nowrap"}}><div style={{fontSize:28}}>{b.icon}</div><div style={{fontWeight:"bold",color:"#1a1a2e",fontSize:13}}>Badge Earned!</div><div style={{color:"#2d1b00",fontSize:11}}>{b.label}</div></div>):null; })()}

      {flash&&(<div style={{position:"fixed",top:"40%",left:"50%",zIndex:998,animation:"pop 0.3s ease forwards",background:flash.valid?"rgba(55,200,85,0.96)":"rgba(205,55,55,0.94)",borderRadius:18,padding:"14px 30px",boxShadow:"0 6px 28px rgba(0,0,0,0.55)",textAlign:"center"}}><div style={{fontSize:20,fontWeight:"bold",letterSpacing:3,color:"#fff"}}>{flash.word}</div><div style={{fontSize:flash.valid?17:13,color:"#fff",marginTop:4}}>{flash.valid?`+${flash.score} pts`:"Not a valid word!"}</div></div>)}

      {validating&&(<div style={{position:"fixed",top:"40%",left:"50%",transform:"translate(-50%,-50%)",background:"rgba(18,14,46,0.96)",borderRadius:20,padding:"18px 34px",zIndex:997,boxShadow:"0 6px 30px rgba(0,0,0,0.65)",textAlign:"center",border:"1px solid rgba(255,255,255,0.13)"}}><div style={{fontSize:26,animation:"spin 1s linear infinite",display:"inline-block"}}>🔍</div><div style={{fontSize:12,marginTop:8,opacity:0.65,letterSpacing:2}}>CHECKING…</div></div>)}

      {levelComplete&&(<div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{background:"linear-gradient(135deg,#1a1a3e,#302b63)",borderRadius:24,padding:"36px 40px",textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.7)",border:"1px solid rgba(255,255,255,0.15)",maxWidth:320}}><div style={{fontSize:52}}>🎉</div><div style={{fontSize:26,fontWeight:"bold",background:"linear-gradient(90deg,#f6d365,#fda085)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginTop:8}}>Level {level} Complete!</div><div style={{fontSize:13,opacity:0.6,marginTop:8}}>You used every tile!</div><div style={{fontSize:20,color:"#f6d365",fontWeight:"bold",marginTop:12}}>+{100*level} Bonus Points!</div><div style={{fontSize:12,opacity:0.5,marginTop:4}}>Level {level+1}: {42+level*6} tiles · {getBonusCount(level+1)} bonus tiles</div><button className="ll-btn" onClick={handleNextLevel} style={{marginTop:20,padding:"14px 32px",borderRadius:14,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:15,fontWeight:"bold",boxShadow:"0 4px 16px rgba(246,211,101,0.3)"}}>Play Level {level+1} →</button></div></div>)}

      {showNameInput&&(<div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{background:"linear-gradient(135deg,#1a1a3e,#302b63)",borderRadius:24,padding:"36px 40px",textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.7)",border:"1px solid rgba(255,255,255,0.15)",maxWidth:320,width:"90%"}}><div style={{fontSize:44}}>🏆</div><div style={{fontSize:22,fontWeight:"bold",color:"#f6d365",marginTop:8}}>Game Complete!</div><div style={{fontSize:28,fontWeight:"bold",color:"#fff",marginTop:8}}>{totalScore} pts</div><div style={{fontSize:13,opacity:0.5,marginTop:4}}>Day #{dayNum}</div><div style={{fontSize:13,opacity:0.6,marginTop:16,marginBottom:8}}>Enter your name:</div><input value={playerName} onChange={e=>setPlayerName(e.target.value)} placeholder="Your name…" style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)",color:"#f0e6d3",fontSize:15,fontFamily:"Georgia,serif",outline:"none",textAlign:"center"}}/><button className="ll-btn" onClick={handleSaveScore} style={{marginTop:14,width:"100%",padding:"12px",borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:14,fontWeight:"bold"}}>Save Score 🏆</button><button className="ll-btn" onClick={()=>setShowNameInput(false)} style={{marginTop:8,width:"100%",padding:"10px",borderRadius:12,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.4)",fontSize:12}}>Skip</button></div></div>)}

      {/* HEADER */}
      <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"14px 14px 0"}}>
        <div style={{textAlign:"center",marginBottom:6}}>
          <div style={{fontSize:34,fontWeight:"bold",letterSpacing:5,background:"linear-gradient(90deg,#f6d365,#fda085,#f093fb,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>LetterLoot</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginTop:4}}>
            <div style={{fontSize:9,opacity:0.4,letterSpacing:2}}>LEVEL {level}/5 · DAY #{dayNum}</div>
            <button onClick={()=>setMusicOn(m=>!m)} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",borderRadius:20,padding:"3px 10px",cursor:"pointer",fontSize:11,color:musicOn?"#f6d365":"rgba(255,255,255,0.4)",fontFamily:"Georgia,serif"}}>{musicOn?"🎸 ON":"🎸 OFF"}</button>
          </div>
          <div style={{marginTop:8,background:"rgba(255,255,255,0.08)",borderRadius:10,height:6,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${((level-1)/5)*100}%`,background:"linear-gradient(90deg,#f6d365,#fda085)",borderRadius:10,transition:"width 0.5s ease"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:2,padding:"0 2px"}}>
            {[1,2,3,4,5].map(l=>(<div key={l} style={{fontSize:8,opacity:l<=level?0.8:0.3,color:l<=level?"#f6d365":"#fff"}}>L{l}</div>))}
          </div>
        </div>

        <div style={{display:"flex",gap:6,justifyContent:"center",margin:"8px 0",flexWrap:"wrap"}}>
          {[["play","🎮 Play"],["badges","🏅 Badges"],["history","📜 History"],["leaderboard","🏆 Board"]].map(([id,label])=>(
            <button key={id} className="ll-tab" onClick={()=>setTab(id)} style={{padding:"5px 11px",borderRadius:20,fontSize:10,background:tab===id?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.07)",color:tab===id?"#1a1a2e":"#f0e6d3",fontWeight:tab===id?"bold":"normal"}}>{label}</button>
          ))}
        </div>

        <div style={{display:"flex",justifyContent:"space-around",alignItems:"center",background:"rgba(255,255,255,0.055)",borderRadius:13,padding:"9px 6px",marginBottom:9,border:"1px solid rgba(255,255,255,0.07)"}}>
          {[[totalScore,"PTS","#f6d365"],[`⚡${streak}`,"STREAK","#fda085"],[`${badges.length}/${BADGE_DEFS.length}`,"BADGES","#f093fb"],[submitted.filter(s=>s.valid).length,"WORDS","#a8edea"],[availableTiles.length,"LEFT","#86efac"]].map(([val,label,color])=>(
            <div key={label} style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:"bold",color}}>{val}</div><div style={{fontSize:7,opacity:0.4,letterSpacing:1.5}}>{label}</div></div>
          ))}
        </div>
      </div>

      {/* PLAY TAB */}
      {tab==="play"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          <div style={{background:"rgba(255,255,255,0.045)",borderRadius:15,padding:"12px",marginBottom:9,border:"1px solid rgba(255,255,255,0.08)",minHeight:72}}>
            <div style={{fontSize:9,opacity:0.4,letterSpacing:3,marginBottom:7}}>YOUR WORD</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,minHeight:40,alignItems:"center",animation:shake?"shake 0.4s ease":"none"}}>
              {selected.length===0
                ?<div style={{opacity:0.28,fontSize:12,fontStyle:"italic"}}>Tap tiles below to start…</div>
                :selected.map(id=>{
                  const tile=tiles.find(t=>t.id===id);
                  return(<div key={id} onClick={()=>!validating&&handleTileClick(tile)} style={{background:tile?.bonus==="triple"?"linear-gradient(135deg,#f093fb,#764ba2)":tile?.bonus==="double"?"linear-gradient(135deg,#f6d365,#f97316)":"linear-gradient(135deg,#667eea,#764ba2)",borderRadius:8,padding:"5px 9px",display:"flex",flexDirection:"column",alignItems:"center",boxShadow:"0 3px 9px rgba(0,0,0,0.4)",cursor:"pointer",minWidth:32}}>
                    <div style={{fontSize:17,fontWeight:"bold",lineHeight:1}}>{tile?.letter}</div>
                    <div style={{fontSize:7,color:"#fff",opacity:0.9}}>{tile?.bonus==="triple"?"3×":tile?.bonus==="double"?"2×":tile?.value}</div>
                  </div>);
                })
              }
            </div>
            {currentWord.length>0&&(<div style={{marginTop:7,display:"flex",justifyContent:"space-between"}}><div style={{fontSize:10,opacity:0.55}}>Value: <span style={{color:"#f6d365",fontWeight:"bold"}}>{currentScore}</span>{currentWord.length<3&&<span style={{color:"#fda085",marginLeft:6,fontSize:9}}>need 3+</span>}</div><div style={{fontSize:9,opacity:0.35}}>{currentWord.length} letters</div></div>)}
          </div>

          <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:8}}>
            <div style={{fontSize:9,opacity:0.6,display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:"#f6d365",boxShadow:"0 0 6px #f6d365"}}/>2× Double</div>
            <div style={{fontSize:9,opacity:0.6,display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:"#f093fb",boxShadow:"0 0 6px #f093fb"}}/>3× Triple</div>
            <div style={{fontSize:9,opacity:0.4}}>+{100*level} clear bonus</div>
          </div>

          <div style={{display:"flex",gap:7,marginBottom:9}}>
            <button className="ll-btn" onClick={()=>!validating&&setSelected([])} style={{flex:1,padding:"10px",borderRadius:11,fontSize:12,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.11)",color:"#f0e6d3"}}>Clear</button>
            <button className="ll-btn" onClick={handleSubmit} disabled={currentWord.length<3||validating} style={{flex:2,padding:"10px",borderRadius:11,fontSize:13,fontWeight:"bold",background:currentWord.length>=3&&!validating?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.07)",color:currentWord.length>=3&&!validating?"#1a1a2e":"rgba(255,255,255,0.22)",cursor:currentWord.length>=3&&!validating?"pointer":"default"}}>{validating?"Checking…":"Submit Word"}</button>
          </div>

          <div style={{background:"rgba(255,255,255,0.035)",borderRadius:15,padding:"10px 6px",border:"1px solid rgba(255,255,255,0.065)"}}>
            <div style={{fontSize:9,opacity:0.38,letterSpacing:2,marginBottom:8,textAlign:"center"}}>LEVEL {level} · {availableTiles.length} of {tiles.length} tiles remaining</div>
            {tileRows.map((row,ri)=>(
              <div key={ri} style={{display:"flex",justifyContent:"center",gap:4,marginBottom:4}}>
                {row.map(tile=>{
                  const isSel=selected.includes(tile.id);
                  const isDouble=tile.bonus==="double";
                  const isTriple=tile.bonus==="triple";
                  return(
                    <div key={tile.id} className={`ll-tile${isSel?" sel":""}${tile.used?" used":""}${isDouble?" bonus-double":""}${isTriple?" bonus-triple":""}`} onClick={()=>!tile.used&&!validating&&handleTileClick(tile)} style={{width:42,height:50,background:tile.used?"rgba(255,255,255,0.025)":isSel?"linear-gradient(135deg,#667eea,#764ba2)":isTriple?"linear-gradient(135deg,rgba(240,147,251,0.25),rgba(118,75,162,0.15))":isDouble?"linear-gradient(135deg,rgba(246,211,101,0.25),rgba(249,115,22,0.15))":"linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))",borderRadius:9,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:isSel?"2px solid #a78bfa":isTriple?"1px solid rgba(240,147,251,0.5)":isDouble?"1px solid rgba(246,211,101,0.5)":"1px solid rgba(255,255,255,0.08)"}}>
                      <div style={{fontSize:18,fontWeight:"bold",lineHeight:1}}>{tile.letter}</div>
                      <div style={{fontSize:8,fontWeight:"bold",marginTop:1,color:isTriple?"#f093fb":isDouble?"#f6d365":"#fda085"}}>{isTriple?"3×":isDouble?"2×":tile.value}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{textAlign:"center",marginTop:11}}>
            <button onClick={handleReset} style={{background:"none",border:"1px solid rgba(255,255,255,0.11)",color:"rgba(255,255,255,0.3)",padding:"6px 16px",borderRadius:20,fontSize:9,cursor:"pointer",fontFamily:"Georgia,serif"}}>↺ Reset Today's Puzzle</button>
          </div>
        </div>
      )}

      {/* BADGES TAB */}
      {tab==="badges"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
            {BADGE_DEFS.map(b=>{ const earned=badges.includes(b.id); return(
              <div key={b.id} style={{background:earned?"linear-gradient(135deg,rgba(246,211,101,0.11),rgba(253,160,133,0.11))":"rgba(255,255,255,0.03)",border:earned?"1px solid rgba(246,211,101,0.32)":"1px solid rgba(255,255,255,0.055)",borderRadius:13,padding:"13px 9px",textAlign:"center"}}>
                <div style={{fontSize:28,filter:earned?"none":"grayscale(1)",opacity:earned?1:0.22}}>{b.icon}</div>
                <div style={{fontSize:11,fontWeight:"bold",marginTop:4,color:earned?"#f6d365":"rgba(255,255,255,0.32)"}}>{b.label}</div>
                <div style={{fontSize:9,opacity:0.42,marginTop:2,lineHeight:1.4}}>{b.desc}</div>
                {earned&&<div style={{marginTop:4,fontSize:8,color:"#fda085",letterSpacing:2}}>✓ EARNED</div>}
              </div>
            );})}
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {tab==="history"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          {submitted.length===0
            ?<div style={{textAlign:"center",opacity:0.32,marginTop:40,fontSize:12,fontStyle:"italic"}}>No words yet — go loot some letters!</div>
            :<div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[...submitted].reverse().map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:s.valid?"rgba(80,220,100,0.065)":"rgba(220,80,80,0.065)",border:`1px solid ${s.valid?"rgba(80,220,100,0.16)":"rgba(220,80,80,0.13)"}`,borderRadius:11,padding:"9px 13px"}}>
                  <div><div style={{fontSize:14,fontWeight:"bold",letterSpacing:3}}>{s.word}</div><div style={{fontSize:9,opacity:0.4,marginTop:1}}>{s.valid?"Valid ✓":"Invalid ✗"}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:18,fontWeight:"bold",color:s.valid?"#6ee7b7":"rgba(255,255,255,0.18)"}}>{s.valid?`+${s.score}`:"—"}</div>{s.valid&&<div style={{fontSize:9,opacity:0.4}}>points</div>}</div>
                </div>
              ))}
              <div style={{textAlign:"center",padding:"12px",background:"rgba(255,255,255,0.04)",borderRadius:12,marginTop:2}}>
                <div style={{fontSize:10,opacity:0.45}}>TOTAL LOOT</div>
                <div style={{fontSize:26,fontWeight:"bold",color:"#f6d365"}}>{totalScore}</div>
              </div>
            </div>
          }
        </div>
      )}

      {/* LEADERBOARD TAB */}
      {tab==="leaderboard"&&(
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          <div style={{textAlign:"center",marginBottom:14}}><div style={{fontSize:11,opacity:0.4,letterSpacing:3}}>TOP LOOTERS</div></div>
          {leaderboard.length===0
            ?<div style={{textAlign:"center",opacity:0.32,marginTop:40,fontSize:12,fontStyle:"italic"}}>No scores yet — clear a level to appear here!</div>
            :leaderboard.map((entry,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,background:i===0?"linear-gradient(135deg,rgba(246,211,101,0.12),rgba(253,160,133,0.08))":"rgba(255,255,255,0.03)",border:i===0?"1px solid rgba(246,211,101,0.25)":"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"11px 14px",marginBottom:7}}>
                <div style={{fontSize:20,minWidth:30,textAlign:"center"}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`}</div>
                <div style={{flex:1}}><div style={{fontSize:14,fontWeight:"bold"}}>{entry.name}</div><div style={{fontSize:9,opacity:0.4}}>Level {entry.level} · {entry.date}</div></div>
                <div style={{fontSize:20,fontWeight:"bold",color:"#f6d365"}}>{entry.score}</div>
              </div>
            ))
          }
          <div style={{textAlign:"center",marginTop:12}}>
            <button onClick={()=>{saveLeaderboard([]);setLeaderboard([]);}} style={{background:"none",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.25)",padding:"6px 14px",borderRadius:20,fontSize:9,cursor:"pointer",fontFamily:"Georgia,serif"}}>Clear Leaderboard</button>
          </div>
        </div>
      )}
    </div>
  );
}
