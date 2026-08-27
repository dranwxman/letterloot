p='src/App.jsx'; s=open(p).read()
def rep(old,new):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f"STOP: anchor found {n} times, expected 1: {old[:70]!r}")
    s=s.replace(old,new)

rep("const DEBUG_MODE = true; // v278 dev cycle OPEN (v293: What's New 1.7 — Spyglass + Flourish board; Tips card) (Aug 20) — 1.7: Spyglass + Flourish board; flip false pre-archive",
    "const DEBUG_MODE = false; // v294 — 1.7 SHIP CANDIDATE (Aug 22): Spyglass + Flourish board + What's New. DEBUG OFF.")

open(p,'w').write(s); print("v294 applied OK")
