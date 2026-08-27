p='src/App.jsx'; s=open(p).read()
def rep(old,new):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f"STOP: anchor found {n} times, expected 1: {old[:70]!r}")
    s=s.replace(old,new)

rep('const DEBUG_MODE = true; // v278 dev cycle OPEN (v287: ff_words insert) (Aug 20)',
    'const DEBUG_MODE = true; // v278 dev cycle OPEN (v291: Flourish board tab) (Aug 20)')

rep('''      const [gsRes, todayRes, weekRes, wotdAllRes, allWordSessionsRes] = await Promise.all([''',
    '''      const [gsRes, todayRes, weekRes, wotdAllRes, allWordSessionsRes, ffWordsRes] = await Promise.all([''')
rep('''        fetchWithAbort(`${base}/daily_sessions?select=player_id,date_key,longest_word_today,top_word,top_word_score&limit=2000`),
      ]);''',
    '''        fetchWithAbort(`${base}/daily_sessions?select=player_id,date_key,longest_word_today,top_word,top_word_score&limit=2000`),
        // v291: Flourish board feed — longest board-clearing words (ff_words, written in v287).
        // Server-sorted length desc, created_at asc (Daryl's tie-break ruling, Aug 21).
        fetchWithAbort(`${base}/ff_words?select=player_id,date_key,level,word,length,score,created_at&order=length.desc,created_at.asc&limit=500`),
      ]);''')
rep('''      const allWordSessions = allWordSessionsRes.ok ? await allWordSessionsRes.json() : [];
      return { gs, todaySessions, weekSessions, wotdAllSessions, allWordSessions };''',
    '''      const allWordSessions = allWordSessionsRes.ok ? await allWordSessionsRes.json() : [];
      const ffWords = ffWordsRes.ok ? await ffWordsRes.json() : [];
      return { gs, todaySessions, weekSessions, wotdAllSessions, allWordSessions, ffWords };''')

rep('''{id:"words",label:"💎 Word Scores"},{id:"longest",label:"📏 Longest Words"},{id:"perfect",label:"🌈🏆 Perfect"},''',
    '''{id:"words",label:"💎 Words"},{id:"longest",label:"📏 Longest"},{id:"flourish",label:"🏴‍☠️ Flourish"},{id:"perfect",label:"🌈🏆 Perfect"},''')

rep('''            const { gs=[], todaySessions=[], weekSessions=[], wotdAllSessions=[], allWordSessions=[] } = leaderboardData;''',
    '''            const { gs=[], todaySessions=[], weekSessions=[], wotdAllSessions=[], allWordSessions=[], ffWords=[] } = leaderboardData;''')

rep('''{r.date&&<span style={{color:"rgba(255,255,255,0.35)",marginLeft:6}}>· {formatDateKey(r.date)}</span>}</div></>''',
    '''{r.date&&<span style={{color:"rgba(255,255,255,0.35)",marginLeft:6}}>· {formatDateKey(r.date)}</span>}{r.level&&<span style={{color:"rgba(255,255,255,0.35)",marginLeft:6}}>· L{r.level}</span>}</div></>''')

rep('''            // ── PERFECT DAYS ──
            if (leaderboardTab==="perfect") {''',
    '''            // ── FLOURISH (v291) — longest board-clearing (Finishing Flourish) words ──
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
            if (leaderboardTab==="perfect") {''')

open(p,'w').write(s); print("v291 applied OK")
