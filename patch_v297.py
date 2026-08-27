p='src/App.jsx'; s=open(p).read()
def rep(old,new):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f"STOP: anchor found {n} times, expected 1: {old[:70]!r}")
    s=s.replace(old,new)

rep("// v296 — 1.7 SHIP CANDIDATE (Aug 22): Spyglass (chip only) + Flourish board + What's New + Menu Special Features cards. DEBUG OFF.",
    "// v297 — 1.7 SHIP CANDIDATE (Aug 22): Spyglass (chip only) + Flourish board + What's New + Special Features + Hints&Tips entries. DEBUG OFF.")

rep('''  const TIPS = [
    { emoji:"👁️", title:"Watch Your Letters",''',
    '''  const TIPS = [
    // v297: 1.7 features lead the list (Daryl's ruling — Spyglass 1st, Finishing Flourish 2nd).
    { emoji:"🔭", title:"Scout with the Spyglass", body:"Not sure a word is in the LL dictionary? Tap the blue SCOUT chip beside your built word to check it without committing your tiles. The clock keeps running, so certainty costs time. Words we don't know can be sent to the Cap'n with Submit fer Review." },
    { emoji:"🦜", title:"Finish with a Flourish", body:"Clear the board with a 5+ letter word to pocket a Finishing Flourish Bonus — the longer the word, the bigger the haul. Your best board-clearing words also land on the new 🏴‍☠️ Flourish leaderboard tab (registered players only)." },
    { emoji:"👁️", title:"Watch Your Letters",''')

open(p,'w').write(s); print("v297 applied OK")
