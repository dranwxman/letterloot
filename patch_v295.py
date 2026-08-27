p='src/App.jsx'; s=open(p).read()
def rep(old,new):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f"STOP: anchor found {n} times, expected 1: {old[:70]!r}")
    s=s.replace(old,new)

rep("const DEBUG_MODE = false; // v294 — 1.7 SHIP CANDIDATE (Aug 22): Spyglass + Flourish board + What's New. DEBUG OFF.",
    "const DEBUG_MODE = false; // v295 — 1.7 SHIP CANDIDATE (Aug 22): Spyglass (chip only, double-tap removed) + Flourish board + What's New. DEBUG OFF.")

# ── code: remove the double-tap route (Daryl's ruling A, Aug 22 — letter chips own single-tap deselect, so double-tap on letters removed two letters) ──
rep('''<div onClick={()=>{ if(!currentWord||validating||paused) return; const now=Date.now(); if(now-spyglassTapRef.current<300){ spyglassTapRef.current=0; openSpyglass(); } else { spyglassTapRef.current=now; } }} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.05)",borderRadius:8,''',
    '''<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.05)",borderRadius:8,''')
rep('''  const spyglassTapRef = useRef(0);
''', '''  // v295: double-tap route removed (ruling A) — the SCOUT 🔭 chip is the sole access.
''')
rep('''  // glyph in the word row remains the always-on affordance; double-tap stays the shortcut.''',
    '''  // glyph in the word row remains the always-on affordance (v295: sole access — double-tap removed).''')

# ── copy: in-game hint line ──
rep('''🔭 New! Tap the spyglass (or double-tap yer word) to scout it first</div>}''',
    '''🔭 New! Tap the blue SCOUT chip to scout yer word first</div>}''')
# ── copy: Ready-screen tip line ──
rep('''✦ Double-tap yer built word to <strong style={{color:"#f6d365"}}>🔭 Spyglass-check</strong> it — the clock keeps runnin'!</div>''',
    '''✦ Tap the blue <strong style={{color:"#f6d365"}}>🔭 SCOUT</strong> chip to Spyglass-check yer built word — the clock keeps runnin'!</div>''')
# ── copy: Tips / Tour Spyglass card ──
rep('''Tap the <strong style={{color:'#f6d365'}}>🔭</strong> beside yer staged word (or double-tap the word itself) to scout it before ye commit yer tiles.''',
    '''Tap the blue <strong style={{color:'#f6d365'}}>🔭 SCOUT</strong> chip beside yer staged word to scout it before ye commit yer tiles.''')
# ── copy: What's New popup + Latest Updates (same text, 2 places) ──
old="Tap the blue <strong style={{color:'#7cc4ff'}}>🔭 SCOUT</strong> chip beside yer built word (or double-tap the word itself) to check it — without committing yer tiles."
new="Tap the blue <strong style={{color:'#7cc4ff'}}>🔭 SCOUT</strong> chip beside yer built word to check it — without committing yer tiles."
n=s.count(old)
if n!=2: raise SystemExit(f"STOP: What's New Spyglass text found {n} times, expected 2")
s=s.replace(old,new)

open(p,'w').write(s); print("v295 applied OK")
