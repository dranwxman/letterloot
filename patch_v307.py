#!/usr/bin/env python3
"""
patch_v307.py — LetterLoot v307

Two changes, both to the Word of the Day matcher:

1. RULE B (silent-E stem, ungated) — Daryl's ruling, Sep 1 2026.
   wotdRoot() strips ONE grammatical ending off the WoD. That only rescues days when the
   WoD is ALREADY an inflected form (SURPRISED -> SURPRIS, so SURPRISING matches). When the
   WoD is the plain form ending in a silent E (STOCKPILE), nothing strips, the root stays
   whole, and English's E-drop before a vowel suffix breaks containment: STOCKPILING has no
   "STOCKPILE" block. Reported by a player Sep 1. Second time this CLASS of bug has needed a
   store release, which is what change 2 exists to end.
   Fix: also accept the root minus a trailing E (floor 5, same as wotdRoot).
   DELIBERATELY LIBERAL: this admits some non-forms (WoD CREATE accepts CREATURE via CREAT).
   Errors run in the PLAYER'S favor, by design.

2. SERVER-SIDE EXTRA ROOTS — Option 1, Daryl's ruling, Sep 1 2026.
   Additional accepted roots load from Supabase at launch, same pattern as loadApprovedWords().
   A future edge case becomes one INSERT in the SQL editor instead of an App Store release.
   Fails safe: any fetch error leaves the list empty and the baked-in rule B still applies.
   Guard: roots shorter than 4 chars are ignored, so a typo row can't make everything match.

Usage:
    python3 patch_v307.py                 # patches src/App.jsx in place
    python3 patch_v307.py path/to/App.jsx # patches the given file (dry-run against PK copy)

Refuses and changes nothing unless every anchor matches exactly once.
"""

import re
import sys
import pathlib

target = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "src/App.jsx")
if not target.exists():
    sys.exit(f"REFUSED: {target} not found (are you in ~/Documents/letterloot ?)")

text = target.read_text()
original = text


def require_once(anchor: str, label: str) -> None:
    n = text.count(anchor)
    if n != 1:
        sys.exit(f"REFUSED: anchor [{label}] found {n} times, expected exactly 1. Nothing changed.")


# ── Anchor 1: the current matcher ────────────────────────────────────────────
A1 = """function isWotdMatch(playedWord, wotdWord) {
  if (!playedWord || !wotdWord) return false;
  const P = playedWord.toUpperCase(), W = wotdWord.toUpperCase();
  return P.length >= W.length && P.includes(wotdRoot(W));
}"""

R1 = """// v307 (Malleable WoD rule B — Daryl, Sep 1): SILENT-E STEM, UNGATED.
// wotdRoot() strips ONE ending off the WoD, which only helps when the WoD is already an
// inflected form (SURPRISED -> SURPRIS). When the WoD is the plain form ending in a silent E
// (STOCKPILE) nothing strips, the root stays whole, and English's E-drop before a vowel suffix
// breaks containment: STOCKPILING has no "STOCKPILE" block. Player-reported Sep 1.
// Fix: accept the root OR the root minus a trailing E (floor 5, same as wotdRoot).
// DELIBERATELY LIBERAL per Daryl's ruling: admits some non-forms (WoD CREATE accepts CREATURE
// via the CREAT stem). Errors run in the PLAYER'S favor, by design.
// v307 also folds in server-supplied extra roots (see WOTD_EXTRA_ROOTS below) so the NEXT
// edge case is a Supabase INSERT, not an App Store release.
function wotdRootVariants(wotdWord) {
  const W = (wotdWord || "").toUpperCase();
  const root = wotdRoot(W);
  const out = [root];
  if (root.endsWith("E") && root.length - 1 >= 5) out.push(root.slice(0, -1));
  for (const row of WOTD_EXTRA_ROOTS) {
    // Global rows (no wotd_word) apply to every day; targeted rows only to their own WoD.
    if (row.root && (!row.wotd || row.wotd === W)) out.push(row.root);
  }
  return out;
}
function isWotdMatch(playedWord, wotdWord) {
  if (!playedWord || !wotdWord) return false;
  const P = playedWord.toUpperCase(), W = wotdWord.toUpperCase();
  if (P.length < W.length) return false;
  return wotdRootVariants(W).some(r => P.includes(r));
}"""

# ── Anchor 2: module-init load of the approved-words whitelist ───────────────
A2 = """// Kick off load on module init
loadApprovedWords();"""

R2 = """// ── WoD extra accepted roots (v307, Option 1) ──
// Server-side safety net for WoD matching. Rows here add accepted roots WITHOUT a store
// release: fix a wrongly-rejected word with one INSERT in the Supabase SQL editor and every
// player — native and web — picks it up on next launch.
//   wotd_word  = the WoD this applies to (uppercase), or NULL to apply to every day
//   extra_root = the additional accepted root (uppercase)
// Fails safe: any error leaves the list empty and the baked-in rule B still applies.
// Guard: roots under 4 chars are dropped so a typo row can't make every word match.
let WOTD_EXTRA_ROOTS = [];
let wotdExtraRootsLoaded = false;
async function loadWotdExtraRoots() {
  if (wotdExtraRootsLoaded) return;
  try {
    const url = "https://zcevszxmoggmcmvyxjtn.supabase.co/rest/v1/wotd_extra_roots?select=wotd_word,extra_root&active=eq.true&limit=500";
    // Same anon key literal already used by loadApprovedWords() above — kept inline for
    // symmetry with that function rather than introducing a new shared constant.
    const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZXZzenhtb2dnbWNtdnl4anRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDExNDIsImV4cCI6MjA5MTE3NzE0Mn0.nZhiDxv5ssCrkHXxaboZ5ziH-M4NqNqPMop2s_gA6NM";
    const r = await fetch(url, { headers: {
      apikey: anonKey,
      Authorization: "Bearer " + anonKey
    }});
    if (r.ok) {
      const rows = await r.json();
      WOTD_EXTRA_ROOTS = rows
        .map(x => ({
          wotd: (x.wotd_word || "").toUpperCase() || null,
          root: (x.extra_root || "").toUpperCase()
        }))
        .filter(x => x.root.length >= 4);
      wotdExtraRootsLoaded = true;
      try { console.log(`[WoD] Loaded ${WOTD_EXTRA_ROOTS.length} extra root(s) from server.`); } catch {}
    }
  } catch (e) { console.warn("Failed to load WoD extra roots:", e); }
}

// Kick off load on module init
loadApprovedWords();
loadWotdExtraRoots();"""

require_once(A1, "isWotdMatch")
require_once(A2, "loadApprovedWords module-init")

# ── Dev-cycle marker bump ────────────────────────────────────────────────────
marker_matches = re.findall(r"// v\d+ dev cycle", text)
if len(marker_matches) != 1:
    sys.exit(f"REFUSED: dev-cycle marker found {len(marker_matches)} times, expected exactly 1. Nothing changed.")
old_marker = marker_matches[0]

text = text.replace(A1, R1, 1)
text = text.replace(A2, R2, 1)
text = text.replace(old_marker, "// v307 dev cycle", 1)

if text == original:
    sys.exit("REFUSED: no change produced. Nothing written.")

target.write_text(text)
print(f"v307 applied OK  ({old_marker} -> // v307 dev cycle)")
print("  1. isWotdMatch -> rule B (silent-E stem) + server extra roots")
print("  2. loadWotdExtraRoots() added and kicked off at module init")
