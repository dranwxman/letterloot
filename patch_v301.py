#!/usr/bin/env python3
# v301: Item 1 fix (Aug 29) — Welcome-screen intrusion during a Finishing Flourish on L5,
# followed by a repeat-Perfect-Day modal drawn over a zeroed, freshly reset game.
#   A) The empty-board guard stays silent while a Finisher overlay / deferred board-clear is pending.
#   B) Every full-game reset cancels the deferred board-clear sequence and any pending
#      repeat-PD modal timer, so a reset can never be followed by a stale endgame.
import re, sys
P = "src/App.jsx"
s = open(P).read()

def rep(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        print(f"ABORT: anchor '{label}' found {n} times (expected 1). No changes written."); sys.exit(1)
    s = s.replace(old, new)

# 0) version marker
rep("const DEBUG_MODE = true; // v300 dev cycle OPEN",
    "const DEBUG_MODE = true; // v301 dev cycle OPEN", "version marker")

# 1) new ref for the repeat-PD 600ms timer
rep("  const pendingBoardClearRef = useRef(null);\n",
    "  const pendingBoardClearRef = useRef(null);\n"
    "  // v301 (Item 1-B): handle for the 600ms repeat-Perfect-Day modal timer so a full reset can cancel it.\n"
    "  const repeatPdTimerRef = useRef(null);\n", "pendingBoardClearRef decl")

# 2) guard: hold while a Finisher overlay / deferred clear is in flight
rep("    if (showRepeatPerfect || perfectDayAchieved || levelComplete || showIntro || showReadyScreen) return;\n",
    "    if (showRepeatPerfect || perfectDayAchieved || levelComplete || showIntro || showReadyScreen) return;\n"
    "    // v301 (Item 1-A): on a Finishing Flourish the board empties immediately but the endgame is\n"
    "    // deferred behind the FF overlay (up to 10s). This guard used to see \"empty L5 + PD acknowledged\"\n"
    "    // in that window and route to Welcome; a Play tap there reset the game, and the deferred\n"
    "    // sequence then drew the repeat-PD modal over a 0-pt fresh board (Daryl, Aug 28). Hold.\n"
    "    if (finisherOverlay || pendingBoardClearRef.current) return;\n", "guard early return")
rep("  }, [tab, tiles, level, showRepeatPerfect, perfectDayAchieved, levelComplete, showIntro, showReadyScreen]);\n",
    "  }, [tab, tiles, level, showRepeatPerfect, perfectDayAchieved, levelComplete, showIntro, showReadyScreen, finisherOverlay]);\n", "guard deps")

# 3) cancel helper, after dismissFinisherOverlay
rep("    if (pending) pending();\n  }, []);\n",
    "    if (pending) pending();\n  }, []);\n\n"
    "  // v301 (Item 1-B): called by every full-game reset. Drops a pending deferred board-clear\n"
    "  // sequence, closes a lingering FF overlay, and cancels a queued repeat-PD modal, so nothing\n"
    "  // from the finished game can fire over the fresh one.\n"
    "  const cancelDeferredEndgame = useCallback(() => {\n"
    "    pendingBoardClearRef.current = null;\n"
    "    setFinisherOverlay(null);\n"
    "    if (repeatPdTimerRef.current) { clearTimeout(repeatPdTimerRef.current); repeatPdTimerRef.current = null; }\n"
    "  }, []);\n", "cancelDeferredEndgame insert")

# 4) handleFullReset calls it
rep("  const handleFullReset = useCallback((opts = {}) => {\n    const skipWelcome = opts.skipWelcome === true;\n",
    "  const handleFullReset = useCallback((opts = {}) => {\n    cancelDeferredEndgame(); // v301 (Item 1-B)\n    const skipWelcome = opts.skipWelcome === true;\n", "handleFullReset head")
rep("  }, [startTimer, stopTimer, setPerfectDaySync, clearCelebrationQueue]);\n",
    "  }, [startTimer, stopTimer, setPerfectDaySync, clearCelebrationQueue, cancelDeferredEndgame]);\n", "handleFullReset deps")

# 5) PLAY NOW reset calls it
rep("          if (gameComplete) {\n            const rng = seededRandom(getDailySeed());\n",
    "          if (gameComplete) {\n            cancelDeferredEndgame(); // v301 (Item 1-B)\n            const rng = seededRandom(getDailySeed());\n", "PLAY NOW reset")

# 6) repeat-PD timer goes through the ref
rep("setTimeout(() => setShowRepeatPerfect(true), 600);",
    "repeatPdTimerRef.current = setTimeout(() => setShowRepeatPerfect(true), 600); // v301: cancellable", "repeat-PD timer")

open(P, "w").write(s)
print("v301 applied OK")
