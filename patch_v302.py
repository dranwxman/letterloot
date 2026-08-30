#!/usr/bin/env python3
# v302 (Aug 29): Finishing Flourish review + Today's Summary (Daryl's option C).
#   1. Local 30-day FF log (ll_ff_log) — guests included; written at FF award time.
#   2. "Today's Flourishes" line on the L1–L4 Level Complete card.
#   3. Today's Summary card closes the L5 endgame: PD/Great Game headline (+streak & bonus,
#      or "banked earlier today" on a repeat), this game's FF rows, WoD, total time, Continue.
#      Order: FF overlay → streak bonus → Perfect Day modal → Summary → (Now / Later / Farewell).
#      Non-PD finish: → Summary → Farewell. The old L5 "Level 5 Complete" card no longer renders.
#   4. STATS: "My Flourishes" — local log merged with the player's cloud ff_words rows,
#      grouped by day, with count / bonus pts / longest header.
import sys
P = "src/App.jsx"
s = open(P).read()

def rep(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        print(f"ABORT: anchor '{label}' found {n} times (expected 1). No changes written."); sys.exit(1)
    s = s.replace(old, new)

# 0) version marker
rep("const DEBUG_MODE = true; // v301 dev cycle OPEN",
    "const DEBUG_MODE = true; // v302 dev cycle OPEN", "version marker")

# 1) module-level FF log
rep('function saveDailyHistory(history) { try { localStorage.setItem("ll_daily_history", JSON.stringify(history)); } catch {} }\n',
    'function saveDailyHistory(history) { try { localStorage.setItem("ll_daily_history", JSON.stringify(history)); } catch {} }\n'
    '\n'
    '// v302: persistent Finishing Flourish log — local, 30-day retention, guests included.\n'
    '// Entry: { date, game, level, word, score, ts }. Written once per FF at award time. The cloud\n'
    '// ff_words table (v285, signed-in only) is the long-term record; this covers guests, offline,\n'
    '// and the per-game (Game 1 / Game 2) split the cloud row does not carry.\n'
    'function getFFLog() { try { const a = JSON.parse(localStorage.getItem("ll_ff_log") || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }\n'
    'function appendFFLog(entry) {\n'
    '  try {\n'
    '    const cutoff = Date.now() - 30 * 86400000;\n'
    '    const log = getFFLog().filter(e => (e.ts || 0) >= cutoff);\n'
    '    log.push(entry);\n'
    '    localStorage.setItem("ll_ff_log", JSON.stringify(log));\n'
    '  } catch {}\n'
    '}\n'
    'function getTodayFFs() { const k = getTodayKey(); return getFFLog().filter(e => e.date === k).sort((a, b) => (a.game || 0) - (b.game || 0) || a.level - b.level); }\n',
    "FF log insert")

# 2) state
rep("  const [showRepeatPerfect, setShowRepeatPerfect] = useState(false);\n",
    "  const [showRepeatPerfect, setShowRepeatPerfect] = useState(false);\n"
    "  // v302 (option C): Today's Summary card — the closing beat of the L5 endgame. Shown after the\n"
    "  // Perfect Day modal (or straight after a non-PD finish). afterSummaryRef carries the choice the\n"
    "  // player already made on the PD modal (now / later) or 'farewell', for Continue to carry out.\n"
    "  const [showDaySummary, setShowDaySummary] = useState(false);\n"
    "  const afterSummaryRef = useRef(\"farewell\");\n"
    "  const openDaySummary = useCallback((next) => { afterSummaryRef.current = next || \"farewell\"; setShowDaySummary(true); }, []);\n"
    "  // v302: My Flourishes (STATS) — this player's cloud ff_words rows; null = not fetched yet.\n"
    "  const [myFFCloud, setMyFFCloud] = useState(null);\n",
    "state insert")

# 3) guard holds while the summary is up
rep("    if (finisherOverlay || pendingBoardClearRef.current) return;\n",
    "    if (finisherOverlay || pendingBoardClearRef.current) return;\n"
    "    if (showDaySummary) return; // v302: summary card is a modal in the same family\n",
    "guard summary")
rep("  }, [tab, tiles, level, showRepeatPerfect, perfectDayAchieved, levelComplete, showIntro, showReadyScreen, finisherOverlay]);\n",
    "  }, [tab, tiles, level, showRepeatPerfect, perfectDayAchieved, levelComplete, showIntro, showReadyScreen, finisherOverlay, showDaySummary]);\n",
    "guard deps")

# 4) cloud fetch for My Flourishes, before the global guard
rep("  // GLOBAL GUARD: If user lands on the play tab with a completed game",
    "  // v302: My Flourishes — fetch this player's ff_words the first time STATS opens this session\n"
    "  // (signed-in only). Fire-and-forget; a failure just leaves the local log on its own.\n"
    "  useEffect(() => {\n"
    "    if (tab !== \"stats\" || isGuest || !user?.id || myFFCloud !== null) return;\n"
    "    supabase.from(\"ff_words\").select(\"date_key,level,word,score,created_at\").eq(\"player_id\", user.id).order(\"created_at\", { ascending: false }).limit(400)\n"
    "      .then(({ data, error }) => { if (error) { if (DEBUG_MODE) console.warn(\"[FF_WORDS] fetch failed\", error.message); setMyFFCloud([]); } else setMyFFCloud(data || []); })\n"
    "      .catch(() => setMyFFCloud([]));\n"
    "  }, [tab, isGuest, user, myFFCloud]);\n\n"
    "  // GLOBAL GUARD: If user lands on the play tab with a completed game",
    "cloud fetch effect")

# 5) closeDaySummary after triggerFarewell
rep("  }, [onFarewell, getDayResultsShareText]);\n",
    "  }, [onFarewell, getDayResultsShareText]);\n\n"
    "  // v302: Continue on the Today's Summary card — carry out what the player already chose.\n"
    "  const closeDaySummary = useCallback(() => {\n"
    "    setShowDaySummary(false);\n"
    "    const next = afterSummaryRef.current; afterSummaryRef.current = \"farewell\";\n"
    "    if (next === \"now\") { handleFullReset({ skipWelcome: true }); }\n"
    "    else { setLevelComplete(false); triggerFarewell(); }\n"
    "  }, [handleFullReset, triggerFarewell]);\n",
    "closeDaySummary insert")

# 6) FF award → local log; invalidate the cloud cache so STATS refetches
rep("          if (_last && _last.word === currentWord) _last.finisher = finisher;\n",
    "          if (_last && _last.word === currentWord) _last.finisher = finisher;\n"
    "          // v302: local FF log (30 days, guests included) + drop the STATS cloud cache so it refetches.\n"
    "          appendFFLog({ date: getTodayKey(), game: gameIndexRef.current || 0, level, word: currentWord, score: finisher, ts: Date.now() });\n"
    "          setMyFFCloud(null);\n",
    "FF award log")

# 7) non-PD L5 finish → summary (was farewell)
rep("              setTimeout(() => triggerFarewell(), 1500);\n",
    "              setTimeout(() => openDaySummary(\"farewell\"), 1500); // v302: summary first, then farewell\n",
    "non-PD finish")

# 8) WoD-missed modal → summary
rep("onClick={()=>{ setShowWotdMissedPD(false); triggerFarewell(); }}",
    "onClick={()=>{ setShowWotdMissedPD(false); openDaySummary(\"farewell\"); }}",
    "WoD missed button")

# 9) PD modal + repeat modal Now/Later → summary carries the choice
rep("onClick={()=>{ markPDAcknowledged(); setPerfectDayAchieved(false); handleFullReset({skipWelcome:true}); }}",
    "onClick={()=>{ markPDAcknowledged(); setPerfectDayAchieved(false); openDaySummary(\"now\"); }}", "PD Now")
rep("onClick={()=>{ markPDAcknowledged(); setPerfectDayAchieved(false); setLevelComplete(false); triggerFarewell(); }}",
    "onClick={()=>{ markPDAcknowledged(); setPerfectDayAchieved(false); openDaySummary(\"later\"); }}", "PD Later")
rep("onClick={()=>{ markPDAcknowledged(); setShowRepeatPerfect(false); handleFullReset({skipWelcome:true}); }}",
    "onClick={()=>{ markPDAcknowledged(); setShowRepeatPerfect(false); openDaySummary(\"now\"); }}", "repeat Now")
rep("onClick={()=>{ markPDAcknowledged(); setShowRepeatPerfect(false); setLevelComplete(false); triggerFarewell(); }}",
    "onClick={()=>{ markPDAcknowledged(); setShowRepeatPerfect(false); openDaySummary(\"later\"); }}", "repeat Later")

# 10) L5 no longer renders the Level Complete card (summary replaces it)
rep('      {levelComplete&&<div style={{position:"fixed",inset:0,zIndex:9000,',
    '      {levelComplete&&level<5&&<div style={{position:"fixed",inset:0,zIndex:9000,',
    "L5 card gate")

# 11) Today's Flourishes line on the L1–L4 card
rep('          {newBestTime&&<div style={{fontSize:ipadTour(12),color:"#6ee7b7",fontWeight:"bold",marginTop:4}}>⚡ New Best Time!</div>}\n',
    '          {newBestTime&&<div style={{fontSize:ipadTour(12),color:"#6ee7b7",fontWeight:"bold",marginTop:4}}>⚡ New Best Time!</div>}\n'
    '          {(()=>{ const ffs = getTodayFFs(); if (!ffs.length) return null; return <div style={{fontSize:ipadTour(11),color:"#fbbf24",marginTop:6}}>🏴‍☠️ Today\'s Flourishes: {ffs.map(f=>`L${f.level} ${f.word}`).join(" · ")}</div>; })()}\n',
    "Today's Flourishes line")

# 12) Today's Summary card, rendered ahead of the repeat-PD modal
rep('      {showRepeatPerfect&&<div style={{position:"fixed",inset:0,zIndex:9500,',
    '''      {showDaySummary&&(()=>{
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
            <button className="ll-btn" onClick={closeDaySummary} style={{marginTop:14,width:"100%",padding:ipadTour(13),borderRadius:12,background:"linear-gradient(135deg,#f6d365,#fda085)",color:"#1a1a2e",fontSize:ipadTour(14),fontWeight:"bold",border:"none"}}>Continue →</button>
          </div>
        </div>;
      })()}

      {showRepeatPerfect&&<div style={{position:"fixed",inset:0,zIndex:9500,''',
    "summary card")

# 13) STATS — My Flourishes card ahead of DAILY SCORES
rep('          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:13,padding:ipadDense(12),marginBottom:7,border:"1px solid rgba(255,255,255,0.14)"}}>\n            <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:3,marginBottom:10}}>📈 DAILY SCORES</div>',
    '''          {(()=>{
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
            <div style={{fontSize:ipadDense(10),color:"rgba(255,255,255,0.9)",letterSpacing:3,marginBottom:10}}>📈 DAILY SCORES</div>''',
    "STATS My Flourishes")

open(P, "w").write(s)
print("v302 applied OK")
