import { useState, useCallback, useRef } from "react";

const LETTER_VALUES = {};
"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((l, i) => {
  LETTER_VALUES[l] = i + 1;
});

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function getDailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function generateDailyTiles() {
  const seed = getDailySeed();
  const rng = seededRandom(seed);
  const freq = {
    A:9,B:2,C:2,D:4,E:12,F:2,G:3,H:2,I:9,J:1,K:1,L:4,M:2,
    N:6,O:8,P:2,Q:1,R:6,S:4,T:6,U:4,V:2,W:2,X:1,Y:2,Z:1
  };
  const pool = [];
  Object.entries(freq).forEach(([l, count]) => {
    for (let i = 0; i < count; i++) pool.push(l);
  });
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 42).map((l, i) => ({
    id: i, letter: l, value: LETTER_VALUES[l], used: false,
  }));
}

function getDayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
}

function calcWordScore(word) {
  return word.toUpperCase().split("").reduce((sum, l) => sum + (LETTER_VALUES[l] || 0), 0);
}

const VOWELS = new Set(["A","E","I","O","U"]);

const BADGE_DEFS = [
  { id:"first_word", icon:"✨", label:"First Loot",   desc:"Submit your first word" },
  { id:"score_50",   icon:"🔥", label:"On Fire",      desc:"Score 50+ in one word" },
  { id:"score_100",  icon:"💯", label:"Century",      desc:"Score 100+ in one word" },
  { id:"long_word",  icon:"📏", label:"Long Haul",    desc:"Use 7+ letters in a word" },
  { id:"streak_3",   icon:"⚡", label:"Streak x3",   desc:"3 valid words in a row" },
  { id:"daily_500",  icon:"🏆", label:"Loot Master",  desc:"500+ total daily score" },
  { id:"perfect_q",  icon:"👑", label:"Q Master",     desc:"Use the letter Q" },
  { id:"vowel_rich", icon:"🎵", label:"Vowel Rich",   desc:"Word with 4+ vowels" },
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
        model: "claude-sonnet-4-20250514",
        max_tokens: 50,
        messages: [{
          role: "user",
          content: `Is "${word}" a real standard English dictionary word (not a proper noun, abbreviation, or slang)? Reply with only YES or NO.`
        }]
      })
    });
    const data = await response.json();
    const answer = (data.content?.[0]?.text || "NO").trim().toUpperCase();
    const valid = answer.startsWith("YES");
    wordCache[key] = valid;
    return valid;
  } catch {
    return word.length >= 3;
  }
}

export default function App() {
  const [tiles, setTiles] = useState(() => generateDailyTiles());
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
  const submittedRef = useRef([]);
  const totalRef = useRef(0);

  const currentWord = selected.map(id => tiles.find(t => t.id === id)?.letter).join("");
  const currentScore = calcWordScore(currentWord);
  const today = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });
  const dayNum = getDayOfYear();
  const availableTiles = tiles.filter(t => !t.used);
  const tileRows = [];
  for (let i = 0; i < tiles.length; i += 7) tileRows.push(tiles.slice(i, i + 7));

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
    setSelected(prev =>
      prev.includes(tile.id) ? prev.filter(id => id !== tile.id) : [...prev, tile.id]
    );
  };

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
      setTiles(prev => prev.map(t => selected.includes(t.id) ? { ...t, used: true } : t));

      const validCount = newSubmitted.filter(s => s.valid).length;
      if (validCount === 1) awardBadge("first_word");
      if (score >= 50)  awardBadge("score_50");
      if (score >= 100) awardBadge("score_100");
      if (currentWord.length >= 7) awardBadge("long_word");
      if (newStreak >= 3) awardBadge("streak_3");
      if (newTotal >= 500) awardBadge("daily_500");
      if (currentWord.toUpperCase().includes("Q")) awardBadge("perfect_q");
      const vowelCount = currentWord.toUpperCase().split("").filter(l => VOWELS.has(l)).length;
      if (vowelCount >= 4) awardBadge("vowel_rich");
    }
    setSelected([]);
    setValidating(false);
  };

  const handleReset = () => {
    setTiles(generateDailyTiles());
    setSelected([]);
    setSubmitted([]);
    submittedRef.current = [];
    setTotalScore(0);
    totalRef.current = 0;
    setStreak(0);
    setBadges([]);
    setShowBadge(null);
  };

  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(160deg,#0f0c29 0%,#302b63 50%,#24243e 100%)",
      fontFamily:"Georgia,serif", color:"#f0e6d3",
      display:"flex", flexDirection:"column", alignItems:"center",
      paddingBottom:50, position:"relative", overflow:"hidden",
    }}>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        {[...Array(40)].map((_,i)=>(
          <div key={i} style={{
            position:"absolute",
            width:(i%3===0?2:1)+"px",height:(i%3===0?2:1)+"px",
            background:"#fff",borderRadius:"50%",
            opacity:0.05+((i*7)%5)*0.08,
            top:((i*37)%100)+"%",left:((i*53)%100)+"%",
            animation:`twinkle ${2+(i%4)}s infinite alternate`,
            animationDelay:`${(i%5)*0.4}s`,
          }}/>
        ))}
      </div>

      <style>{`
        @keyframes twinkle{from{opacity:0.05}to{opacity:0.55}}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
        @keyframes pop{0%{transform:translate(-50%,-50%) scale(0.6);opacity:0}60%{transform:translate(-50%,-50%) scale(1.08)}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
        @keyframes slideUp{from{transform:translateY(18px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes badgePop{0%{transform:translateX(-50%) translateY(40px) scale(0.8);opacity:0}20%{transform:translateX(-50%) translateY(0) scale(1.05);opacity:1}80%{transform:translateX(-50%) translateY(0) scale(1);opacity:1}100%{transform:translateX(-50%) translateY(-20px) scale(0.9);opacity:0}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .ll-tile{transition:all 0.14s ease;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;}
        .ll-tile:active{transform:scale(0.88)!important;}
        .ll-tile.sel{transform:translateY(-5px) scale(1.1);}
        .ll-tile.used{opacity:0.18;cursor:default;filter:grayscale(1);}
        .ll-tab{border:none;cursor:pointer;transition:all 0.2s;font-family:Georgia,serif;}
        .ll-btn{transition:all 0.14s;font-family:Georgia,serif;border:none;cursor:pointer;}
        .ll-btn:active{transform:scale(0.95);}
      `}</style>

      {showBadge && (()=>{
        const b = BADGE_DEFS.find(x=>x.id===showBadge);
        return b ? (
          <div style={{
            position:"fixed",top:72,left:"50%",zIndex:999,
            animation:"badgePop 2.5s forwards",
            background:"linear-gradient(135deg,#f6d365,#fda085)",
            borderRadius:20,padding:"12px 26px",
            boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
            textAlign:"center",whiteSpace:"nowrap",
          }}>
            <div style={{fontSize:28}}>{b.icon}</div>
            <div style={{fontWeight:"bold",color:"#1a1a2e",fontSize:13}}>Badge Earned!</div>
            <div style={{color:"#2d1b00",fontSize:11}}>{b.label}</div>
          </div>
        ) : null;
      })()}

      {flash && (
        <div style={{
          position:"fixed",top:"40%",left:"50%",zIndex:998,
          animation:"pop 0.3s ease forwards",
          background:flash.valid?"rgba(55,200,85,0.96)":"rgba(205,55,55,0.94)",
          borderRadius:18,padding:"14px 30px",
          boxShadow:"0 6px 28px rgba(0,0,0,0.55)",textAlign:"center",
        }}>
          <div style={{fontSize:24,fontWeight:"bold",letterSpacing:4,color:"#fff"}}>{flash.word}</div>
          <div style={{fontSize:flash.valid?17:13,color:"#fff",marginTop:4}}>
            {flash.valid ? `+${flash.score} pts` : "Not a valid word!"}
          </div>
        </div>
      )}

      {validating && (
        <div style={{
          position:"fixed",top:"40%",left:"50%",transform:"translate(-50%,-50%)",
          background:"rgba(18,14,46,0.96)",borderRadius:20,padding:"18px 34px",
          zIndex:997,boxShadow:"0 6px 30px rgba(0,0,0,0.65)",textAlign:"center",
          border:"1px solid rgba(255,255,255,0.13)",
        }}>
          <div style={{fontSize:26,animation:"spin 1s linear infinite",display:"inline-block"}}>🔍</div>
          <div style={{fontSize:12,marginTop:8,opacity:0.65,letterSpacing:2}}>CHECKING…</div>
        </div>
      )}

      <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"14px 14px 0"}}>
        <div style={{textAlign:"center",marginBottom:6}}>
          <div style={{
            fontSize:36,fontWeight:"bold",letterSpacing:5,
            background:"linear-gradient(90deg,#f6d365,#fda085,#f093fb,#a78bfa)",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
          }}>LetterLoot</div>
          <div style={{fontSize:9,opacity:0.45,letterSpacing:3,marginTop:2}}>DAILY WORD PUZZLE · AI VALIDATED</div>
          <div style={{fontSize:9,opacity:0.3,marginTop:1}}>{today} · Day #{dayNum}</div>
        </div>

        <div style={{display:"flex",gap:7,justifyContent:"center",margin:"9px 0"}}>
          {[["play","🎮 Play"],["badges","🏅 Badges"],["history","📜 History"]].map(([id,label])=>(
            <button key={id} className="ll-tab" onClick={()=>setTab(id)} style={{
              padding:"6px 13px",borderRadius:20,fontSize:11,
              background:tab===id?"linear-gradient(135deg,#f6d365,#fda085)":"rgba(255,255,255,0.07)",
              color:tab===id?"#1a1a2e":"#f0e6d3",
              fontWeight:tab===id?"bold":"normal",
              boxShadow:tab===id?"0 3px 10px rgba(0,0,0,0.3)":"none",
            }}>{label}</button>
          ))}
        </div>

        <div style={{
          display:"flex",justifyContent:"space-around",alignItems:"center",
          background:"rgba(255,255,255,0.055)",borderRadius:13,
          padding:"9px 6px",marginBottom:9,
          border:"1px solid rgba(255,255,255,0.07)",
        }}>
          {[
            [totalScore,"PTS","#f6d365"],
            [`⚡${streak}`,"STREAK","#fda085"],
            [`${badges.length}/${BADGE_DEFS.length}`,"BADGES","#f093fb"],
            [submitted.filter(s=>s.valid).length,"WORDS","#a8edea"],
            [availableTiles.length,"LEFT","#86efac"],
          ].map(([val,label,color])=>(
            <div key={label} style={{textAlign:"center"}}>
              <div style={{fontSize:17,fontWeight:"bold",color}}>{val}</div>
              <div style={{fontSize:8,opacity:0.4,letterSpacing:1.5}}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {tab==="play" && (
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          <div style={{
            background:"rgba(255,255,255,0.045)",borderRadius:15,
            padding:"12px",marginBottom:9,
            border:"1px solid rgba(255,255,255,0.08)",minHeight:72,
          }}>
            <div style={{fontSize:9,opacity:0.4,letterSpacing:3,marginBottom:7}}>YOUR WORD</div>
            <div style={{
              display:"flex",flexWrap:"wrap",gap:4,minHeight:40,alignItems:"center",
              animation:shake?"shake 0.4s ease":"none",
            }}>
              {selected.length===0
                ? <div style={{opacity:0.28,fontSize:12,fontStyle:"italic"}}>Tap tiles below to start…</div>
                : selected.map(id=>{
                    const tile=tiles.find(t=>t.id===id);
                    return (
                      <div key={id} onClick={()=>!validating&&handleTileClick(tile)} style={{
                        background:"linear-gradient(135deg,#667eea,#764ba2)",
                        borderRadius:8,padding:"5px 9px",
                        display:"flex",flexDirection:"column",alignItems:"center",
                        boxShadow:"0 3px 9px rgba(0,0,0,0.4)",cursor:"pointer",minWidth:32,
                      }}>
                        <div style={{fontSize:17,fontWeight:"bold",lineHeight:1}}>{tile?.letter}</div>
                        <div style={{fontSize:8,color:"#f6d365"}}>{tile?.value}</div>
                      </div>
                    );
                  })
              }
            </div>
            {currentWord.length>0 && (
              <div style={{marginTop:7,display:"flex",justifyContent:"space-between"}}>
                <div style={{fontSize:10,opacity:0.55}}>
                  Value: <span style={{color:"#f6d365",fontWeight:"bold"}}>{currentScore}</span>
                  {currentWord.length<3 && <span style={{color:"#fda085",marginLeft:6,fontSize:9}}>need 3+ letters</span>}
                </div>
                <div style={{fontSize:9,opacity:0.35}}>{currentWord.length} letters</div>
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:7,marginBottom:9}}>
            <button className="ll-btn" onClick={()=>!validating&&setSelected([])} style={{
              flex:1,padding:"10px",borderRadius:11,fontSize:12,
              background:"rgba(255,255,255,0.06)",
              border:"1px solid rgba(255,255,255,0.11)",color:"#f0e6d3",
            }}>Clear</button>
            <button className="ll-btn" onClick={handleSubmit}
              disabled={currentWord.length<3||validating}
              style={{
                flex:2,padding:"10px",borderRadius:11,fontSize:13,fontWeight:"bold",
                background:currentWord.length>=3&&!validating
                  ?"linear-gradient(135deg,#f6d365,#fda085)"
                  :"rgba(255,255,255,0.07)",
                color:currentWord.length>=3&&!validating?"#1a1a2e":"rgba(255,255,255,0.22)",
                boxShadow:currentWord.length>=3&&!validating?"0 4px 14px rgba(246,211,101,0.22)":"none",
                cursor:currentWord.length>=3&&!validating?"pointer":"default",
              }}>
              {validating ? "Checking…" : "Submit Word"}
            </button>
          </div>

          <div style={{
            background:"rgba(255,255,255,0.035)",borderRadius:15,
            padding:"10px 6px",
            border:"1px solid rgba(255,255,255,0.065)",
          }}>
            <div style={{fontSize:9,opacity:0.38,letterSpacing:2.5,marginBottom:9,textAlign:"center"}}>
              TILES · {availableTiles.length} of {tiles.length} remaining
            </div>
            {tileRows.map((row,ri)=>(
              <div key={ri} style={{display:"flex",justifyContent:"center",gap:4,marginBottom:4}}>
                {row.map(tile=>{
                  const isSel=selected.includes(tile.id);
                  return (
                    <div key={tile.id}
                      className={`ll-tile${isSel?" sel":""}${tile.used?" used":""}`}
                      onClick={()=>!tile.used&&!validating&&handleTileClick(tile)}
                      style={{
                        width:42,height:50,
                        background:tile.used
                          ?"rgba(255,255,255,0.025)"
                          :isSel
                            ?"linear-gradient(135deg,#667eea,#764ba2)"
                            :"linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))",
                        borderRadius:9,
                        display:"flex",flexDirection:"column",
                        alignItems:"center",justifyContent:"center",
                        boxShadow:isSel?"0 5px 16px rgba(102,126,234,0.5)":tile.used?"none":"0 2px 7px rgba(0,0,0,0.3)",
                        border:isSel?"2px solid #a78bfa":"1px solid rgba(255,255,255,0.08)",
                      }}>
                      <div style={{fontSize:18,fontWeight:"bold",lineHeight:1}}>{tile.letter}</div>
                      <div style={{fontSize:8,fontWeight:"bold",marginTop:1,color:isSel?"#f6d365":"#fda085"}}>{tile.value}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div style={{textAlign:"center",marginTop:11}}>
            <button onClick={handleReset} style={{
              background:"none",border:"1px solid rgba(255,255,255,0.11)",
              color:"rgba(255,255,255,0.3)",padding:"6px 16px",
              borderRadius:20,fontSize:9,cursor:"pointer",fontFamily:"Georgia,serif",
            }}>↺ Reset Today's Puzzle</button>
          </div>
        </div>
      )}

      {tab==="badges" && (
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
            {BADGE_DEFS.map(b=>{
              const earned=badges.includes(b.id);
              return (
                <div key={b.id} style={{
                  background:earned
                    ?"linear-gradient(135deg,rgba(246,211,101,0.11),rgba(253,160,133,0.11))"
                    :"rgba(255,255,255,0.03)",
                  border:earned?"1px solid rgba(246,211,101,0.32)":"1px solid rgba(255,255,255,0.055)",
                  borderRadius:13,padding:"13px 9px",textAlign:"center",transition:"all 0.3s",
                }}>
                  <div style={{fontSize:30,filter:earned?"none":"grayscale(1)",opacity:earned?1:0.22}}>{b.icon}</div>
                  <div style={{fontSize:11,fontWeight:"bold",marginTop:5,color:earned?"#f6d365":"rgba(255,255,255,0.32)"}}>{b.label}</div>
                  <div style={{fontSize:9,opacity:0.42,marginTop:3,lineHeight:1.4}}>{b.desc}</div>
                  {earned&&<div style={{marginTop:5,fontSize:8,color:"#fda085",letterSpacing:2}}>✓ EARNED</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==="history" && (
        <div style={{zIndex:1,width:"100%",maxWidth:480,padding:"0 11px",animation:"slideUp 0.3s ease"}}>
          {submitted.length===0
            ? <div style={{textAlign:"center",opacity:0.32,marginTop:40,fontSize:12,fontStyle:"italic"}}>No words yet — go loot some letters!</div>
            : (
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {[...submitted].reverse().map((s,i)=>(
                  <div key={i} style={{
                    display:"flex",alignItems:"center",justifyContent:"space-between",
                    background:s.valid?"rgba(80,220,100,0.065)":"rgba(220,80,80,0.065)",
                    border:`1px solid ${s.valid?"rgba(80,220,100,0.16)":"rgba(220,80,80,0.13)"}`,
                    borderRadius:11,padding:"9px 13px",
                  }}>
                    <div>
                      <div style={{fontSize:14,fontWeight:"bold",letterSpacing:3}}>{s.word}</div>
                      <div style={{fontSize:9,opacity:0.4,marginTop:1}}>{s.valid?"Valid ✓":"Invalid ✗"}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:18,fontWeight:"bold",color:s.valid?"#6ee7b7":"rgba(255,255,255,0.18)"}}>
                        {s.valid?`+${s.score}`:"—"}
                      </div>
                      {s.valid&&<div style={{fontSize:9,opacity:0.4}}>points</div>}
                    </div>
                  </div>
                ))}
                <div style={{
                  textAlign:"center",padding:"12px",
                  background:"rgba(255,255,255,0.04)",borderRadius:12,marginTop:2,
                }}>
                  <div style={{fontSize:10,opacity:0.45}}>TOTAL LOOT</div>
                  <div style={{fontSize:26,fontWeight:"bold",color:"#f6d365"}}>{totalScore}</div>
                </div>
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}
