#!/usr/bin/env python3
# patch_v310.py — LetterLoot v310 (opens the 2.0 dev cycle)
# SPYGLASS OPEN SEARCH + WoD VERDICT (spec: claude_v308-spyglass-spec.md; all rulings folded in)
#   1. SCOUT chip also renders with ZERO tiles staged -> opens typed mode. (1-2 staged: hidden, as today.)
#   2. Typed mode: input in the Spyglass modal, letters only, 3+ to check. Same validateWord()
#      path, binary verdict, Submit fer Review, sets ll_spyglass_used, clock runs, blocked paused.
#   3. WoD verdict in BOTH modes, only on a VALID dictionary verdict (rule C):
#      hit (not yet found) -> plain line (Daryl ruled plain, Sep 1); already found -> claimed line;
#      genuine near-miss (contains a root variant, shorter than the WoD, not yet found) -> "Not
#      quite" line; everything else silent. Never shows the bonus value.
#   4. DEBUG_MODE -> TRUE (Daryl-initiated, verify cycle). Flip back before any submission.
#      APP_VERSION stays "1.9.1 (309)" until the 2.0 ship patch.
# Anchors: count==1 each, refuses to write on any mismatch.
import sys, io

PATH = "src/App.jsx"
src = io.open(PATH, encoding="utf-8").read()

edits = [
  # 1. dev-cycle marker + DEBUG true
  ('const DEBUG_MODE = false; // v309 dev cycle OPEN - version line on Welcome screen (1.9.1 ship patch)',
   'const DEBUG_MODE = true; // v310 dev cycle OPEN - Spyglass Open Search + WoD verdict (2.0 feature)'),

  # 2. chip renders with zero tiles staged too (typed-mode entry)
  ('            {currentWord.length>=3 && (\n              <div onClick={(e)=>{e.stopPropagation(); openSpyglass();}}',
   '            {/* v310: chip also shows with NOTHING staged — tapping opens typed mode. 1-2 staged: hidden as before. */}\n'
   '            {(currentWord.length>=3 || selected.length===0) && (\n              <div onClick={(e)=>{e.stopPropagation(); openSpyglass();}}'),

  # 3. openSpyglass branches on context (spec item 1) + typed-check path
  ('''  const openSpyglass = async () => {
    if (!currentWord || currentWord.length < 3 || validating || pausedRef.current) return;
    const w = currentWord;
    localStorage.setItem("ll_spyglass_used", "1"); setSpyUsed(true); setSpyHint(false);
    setSpyglass({ word: w, status: "checking", reported: false });
    try {
      const r = await validateWord(w);
      setSpyglass(s => s && s.word === w ? { ...s, status: r.valid === true ? "valid" : (r.valid === null || r.source === "timeout") ? "error" : "invalid" } : s);
    } catch { setSpyglass(s => s && s.word === w ? { ...s, status: "error" } : s); }
  };''',
   '''  // v310 OPEN SEARCH (Chelsea; spec claude_v308-spyglass-spec.md): same button, branches on
  // context. Tiles spelled (3+) -> instant board verdict, exactly as before. NOTHING spelled ->
  // typed mode: the modal opens with an input. Unlimited typed checks (Daryl overruled the
  // Aug 27 cap of 3 — clock running is the only fee). Typed checks flip ll_spyglass_used too.
  const openSpyglass = async () => {
    if (validating || pausedRef.current) return;
    if (!currentWord || currentWord.length < 3) {
      if (selected.length === 0) setSpyglass({ word: "", status: "input", mode: "typed", reported: false });
      return;
    }
    const w = currentWord;
    localStorage.setItem("ll_spyglass_used", "1"); setSpyUsed(true); setSpyHint(false);
    setSpyglass({ word: w, status: "checking", mode: "board", reported: false });
    try {
      const r = await validateWord(w);
      setSpyglass(s => s && s.word === w ? { ...s, status: r.valid === true ? "valid" : (r.valid === null || r.source === "timeout") ? "error" : "invalid" } : s);
    } catch { setSpyglass(s => s && s.word === w ? { ...s, status: "error" } : s); }
  };
  // v310: run the typed word through the SAME pipeline as the board verdict. No prefill from
  // tiles (spec item 7), no score preview, binary verdict only. Retryable on error.
  const spyglassTypedCheck = async () => {
    if (!spyglass || spyglass.mode !== "typed" || pausedRef.current) return;
    const w = (spyglass.word || "").trim().toUpperCase();
    if (w.length < 3 || !/^[A-Z]+$/.test(w)) return;
    localStorage.setItem("ll_spyglass_used", "1"); setSpyUsed(true); setSpyHint(false);
    setSpyglass({ word: w, status: "checking", mode: "typed", reported: false });
    try {
      const r = await validateWord(w);
      setSpyglass(s => s && s.word === w ? { ...s, status: r.valid === true ? "valid" : (r.valid === null || r.source === "timeout") ? "error" : "invalid" } : s);
    } catch { setSpyglass(s => s && s.word === w ? { ...s, status: "error" } : s); }
  };'''),

  # 4. modal: subtitle + word line become mode-aware; input UI for typed mode
  ('''          <div style={{fontSize:ipadTour(15),fontStyle:"italic",color:"#e8e0d0",marginBottom:14}}>Scout yer word before committin' the tiles</div>
          <div style={{fontSize:ipadTour(24),fontWeight:"bold",color:"#fff",letterSpacing:2,marginBottom:12}}>{spyglass.word}</div>''',
   '''          <div style={{fontSize:ipadTour(15),fontStyle:"italic",color:"#e8e0d0",marginBottom:14}}>{spyglass.mode==="typed" ? "Scout any word ye be wonderin' about" : "Scout yer word before committin' the tiles"}</div>
          {spyglass.status==="input"
            ? (<>{/* v310 typed mode: letters only, 3+ enables the check. Enter submits. */}
              <input autoFocus value={spyglass.word} onChange={(e)=>{const v=e.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,20); setSpyglass(s=>s?{...s,word:v}:s);}} onKeyDown={(e)=>{if(e.key==="Enter")spyglassTypedCheck();}} placeholder="TYPE A WORD" style={{width:"100%",boxSizing:"border-box",padding:`${ipadTour(10)}px ${ipadTour(12)}px`,borderRadius:12,border:"1.5px solid rgba(124,196,255,0.65)",background:"rgba(255,255,255,0.08)",color:"#fff",fontSize:ipadTour(20),fontWeight:"bold",letterSpacing:2,textAlign:"center",fontFamily:"Georgia,serif",outline:"none",marginBottom:10}} />
              <button className="ll-btn" onClick={spyglassTypedCheck} disabled={(spyglass.word||"").length<3} style={{width:"100%",padding:ipadTour(10),borderRadius:12,background:(spyglass.word||"").length<3?"rgba(255,255,255,0.12)":"linear-gradient(135deg,#7cc4ff,#60a5fa)",color:(spyglass.word||"").length<3?"rgba(255,255,255,0.4)":"#0a1a3a",fontSize:ipadTour(13),fontWeight:"bold",border:"none",marginBottom:12,cursor:(spyglass.word||"").length<3?"default":"pointer"}}>🔭 Scout It</button>
            </>)
            : <div style={{fontSize:ipadTour(24),fontWeight:"bold",color:"#fff",letterSpacing:2,marginBottom:12}}>{spyglass.word}</div>}'''),

  # 5. WoD verdict block (rule C) directly under the VALID line
  ('''          {spyglass.status==="valid" && <div style={{fontSize:ipadTour(15),fontWeight:"bold",color:"#6ee7b7",marginBottom:12}}>✓ Accepted in the LL dictionary!</div>}''',
   '''          {spyglass.status==="valid" && <div style={{fontSize:ipadTour(15),fontWeight:"bold",color:"#6ee7b7",marginBottom:12}}>✓ Accepted in the LL dictionary!</div>}
          {/* v310 WoD VERDICT (Daryl's rule C, wording ruled PLAIN Sep 1): only on a VALID
              verdict, both modes. Hit -> confirm. Already claimed -> say so. Genuine near-miss
              (contains a root variant but shorter than the listed WoD) -> "Not quite" line.
              Anything else -> SILENT. NEVER show the bonus value (standing Spyglass rule). */}
          {spyglass.status==="valid" && wotd && (()=>{
            const P = spyglass.word.toUpperCase(), W = wotd.toUpperCase();
            if (isWotdMatch(P, W)) return wotdFound
              ? <div style={{fontSize:ipadTour(13),fontWeight:"bold",color:"#f6d365",marginBottom:12}}>Today's Word of the Day is already claimed.</div>
              : <div style={{fontSize:ipadTour(13),fontWeight:"bold",color:"#f6d365",marginBottom:12}}>🎯 That's today's Word of the Day.</div>;
            if (!wotdFound && P.length < W.length && wotdRootVariants(W).some(r => P.includes(r)))
              return <div style={{fontSize:ipadTour(13),fontWeight:"bold",color:"#f6d365",marginBottom:12}}>Not quite — today's word is {W}, and it has to be at least that long.</div>;
            return null;
          })()}'''),

  # 6. error-state "Scout Again" retries down the right pipeline for the mode
  ('''            <button className="ll-btn" onClick={openSpyglass} style={{width:"100%",padding:ipadTour(10),borderRadius:12,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.35)",color:"#fff",fontSize:ipadTour(13),fontWeight:"bold",marginBottom:10}}>Scout Again</button>''',
   '''            <button className="ll-btn" onClick={spyglass.mode==="typed" ? spyglassTypedCheck : openSpyglass} style={{width:"100%",padding:ipadTour(10),borderRadius:12,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.35)",color:"#fff",fontSize:ipadTour(13),fontWeight:"bold",marginBottom:10}}>Scout Again</button>'''),

  # 7. typed mode: after any verdict, offer another typed check (unlimited checks need re-entry)
  ('''          {!paused && tab==="play" && <div style={{fontSize:ipadTour(14),fontWeight:"bold",color:"#f6d365",marginBottom:12}}>⏱️ The game clock be runnin'!</div>}''',
   '''          {spyglass.mode==="typed" && (spyglass.status==="valid"||spyglass.status==="invalid") &&
            <button className="ll-btn" onClick={()=>setSpyglass({ word: "", status: "input", mode: "typed", reported: false })} style={{width:"100%",padding:ipadTour(10),borderRadius:12,background:"rgba(124,196,255,0.15)",border:"1px solid rgba(124,196,255,0.5)",color:"#7cc4ff",fontSize:ipadTour(13),fontWeight:"bold",marginBottom:10}}>🔭 Scout Another Word</button>}
          {!paused && tab==="play" && <div style={{fontSize:ipadTour(14),fontWeight:"bold",color:"#f6d365",marginBottom:12}}>⏱️ The game clock be runnin'!</div>}'''),
]

for i, (old, new) in enumerate(edits, 1):
    n = src.count(old)
    if n != 1:
        sys.exit(f"REFUSED: anchor {i} matched {n} times (expected 1). Nothing written.")

for old, new in edits:
    src = src.replace(old, new, 1)

io.open(PATH, "w", encoding="utf-8").write(src)
print("v310 applied OK")
