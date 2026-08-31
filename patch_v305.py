#!/usr/bin/env python3
# v305 (Aug 30): SHIP FLAG ONLY — DEBUG_MODE=false for the 1.8 App Store archive. No other change.
import sys
P = "src/App.jsx"
s = open(P).read()
old = "const DEBUG_MODE = true; // v304 dev cycle OPEN"
new = "const DEBUG_MODE = false; // v305 SHIP 1.8"
n = s.count(old)
if n != 1:
    print(f"ABORT: DEBUG_MODE anchor found {n} times (expected 1). No changes written."); sys.exit(1)
s = s.replace(old, new)
open(P, "w").write(s)
print("v305 applied OK")
