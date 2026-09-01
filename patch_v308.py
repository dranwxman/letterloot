#!/usr/bin/env python3
"""
patch_v308.py — LetterLoot v308  (ship patch for App Store version 1.9.1)

1. APP_VERSION constant beside DEBUG_MODE, and an in-app version line at the bottom of
   Menu -> Settings/Account reading "LetterLoot 1.9.1 (308)".
   WHY: Sep 1 — a player could not tell Daryl which version she was on, and he had to walk
   her through the App Store product page to find out. There was no version readout anywhere
   in the app. Now there is.
   Placed OUTSIDE the {!isGuest && (...)} account block on purpose: guests need it too.

2. Fixes the v307 cosmetic nit — the dev-cycle marker shares a line with DEBUG_MODE, and the
   v307 patch bumped the number but left v306's description ("leaderboard erasure guards +
   admin gate") in place. Rewritten to describe v308.

Usage:
    python3 patch_v308.py                 # patches src/App.jsx in place
    python3 patch_v308.py path/to/App.jsx # dry-run against a copy

Refuses and changes nothing unless every anchor matches exactly once.

RELEASES: bump APP_VERSION in the next ship patch. It is the string players will quote back.
"""

import re
import sys
import pathlib

APP_VERSION_STRING = "1.9.1 (308)"

target = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "src/App.jsx")
if not target.exists():
    sys.exit(f"REFUSED: {target} not found (are you in ~/Documents/letterloot ?)")

text = target.read_text()
original = text

# ── Anchor 1: DEBUG_MODE / dev-cycle marker line ─────────────────────────────
# Matched by regex so the em-dash-vs-hyphen in the comment tail can't break the anchor.
marker_re = re.compile(r"^const DEBUG_MODE = (true|false); // v(\d+) dev cycle.*$", re.MULTILINE)
marker_hits = marker_re.findall(text)
if len(marker_hits) != 1:
    sys.exit(f"REFUSED: DEBUG_MODE dev-cycle line found {len(marker_hits)} times, expected 1. Nothing changed.")
debug_value, old_version = marker_hits[0]
if debug_value != "false":
    sys.exit(f"REFUSED: DEBUG_MODE is {debug_value}, expected false for a ship patch. Nothing changed.")

marker_replacement = (
    "const DEBUG_MODE = false; // v308 dev cycle OPEN - in-app version line (1.9.1 ship patch)\n"
    "// v308: the string players read off Menu -> Account and quote back when reporting an\n"
    "// issue. Bump this in every ship patch; it is the app's only self-identification.\n"
    f'const APP_VERSION = "{APP_VERSION_STRING}";'
)

# ── Anchor 2: end of the Menu settings block, just before the PLAY TAB ───────
# The version line goes AFTER the {!isGuest && (...)} account section closes, so guests see
# it too, but still INSIDE the settings container.
A2 = """            </div>
          )}
        </div>
      )}

      {/* ── PLAY TAB ── */}"""

R2 = """            </div>
          )}

          {/* v308: in-app version line. Shown to EVERY player, guests included — the entire
              point is that a player can read their version off the screen instead of being
              walked through the App Store product page. Deliberately quiet: small, dim,
              bottom of the panel, no border box. APP_VERSION is bumped by each ship patch. */}
          <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.08)",textAlign:"center",fontSize:ipadMenu(9),color:"rgba(255,255,255,0.38)",fontFamily:"Georgia,serif",letterSpacing:0.5}}>
            LetterLoot {APP_VERSION}
          </div>
        </div>
      )}

      {/* ── PLAY TAB ── */}"""

if text.count(A2) != 1:
    sys.exit(f"REFUSED: settings-block anchor found {text.count(A2)} times, expected 1. Nothing changed.")

text = marker_re.sub(lambda m: marker_replacement, text, count=1)
text = text.replace(A2, R2, 1)

if text == original:
    sys.exit("REFUSED: no change produced. Nothing written.")

target.write_text(text)
print(f"v308 applied OK  (v{old_version} -> v308)")
print(f"  1. APP_VERSION = \"{APP_VERSION_STRING}\" added beside DEBUG_MODE")
print("  2. Version line added to Menu -> Account (visible to guests too)")
print("  3. v307 cosmetic nit fixed - marker description now describes v308")
