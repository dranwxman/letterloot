p='src/App.jsx'; s=open(p).read()
def rep(old,new):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f"STOP: anchor found {n} times, expected 1: {old[:70]!r}")
    s=s.replace(old,new)

rep('(v291: Flourish board tab)', '(v292: Flourish board tab + brighter row meta)')

# date + level tag: 9pt/35% -> 11pt/75%
rep('''{r.date&&<span style={{color:"rgba(255,255,255,0.35)",marginLeft:6}}>· {formatDateKey(r.date)}</span>}{r.level&&<span style={{color:"rgba(255,255,255,0.35)",marginLeft:6}}>· L{r.level}</span>}</div></>''',
    '''{r.date&&<span style={{fontSize:ipadMenu(11),color:"rgba(255,255,255,0.75)",marginLeft:6}}>· {formatDateKey(r.date)}</span>}{r.level&&<span style={{fontSize:ipadMenu(11),color:"rgba(255,255,255,0.75)",marginLeft:6}}>· L{r.level}</span>}</div></>''')

# "ltrs"/"pts" suffix: 9pt/35% -> 12pt/80%
rep('''{r.suffix&&<span style={{fontSize:ipadMenu(9),color:"rgba(255,255,255,0.35)",marginLeft:2}}>{r.suffix}</span>}''',
    '''{r.suffix&&<span style={{fontSize:ipadMenu(12),color:"rgba(255,255,255,0.8)",marginLeft:3}}>{r.suffix}</span>}''')

open(p,'w').write(s); print("v292 applied OK")
