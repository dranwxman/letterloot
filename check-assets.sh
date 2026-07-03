#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# check-assets.sh — LetterLoot pre-submission asset gate (backlog #24)
#
# Verifies every file the shipped app depends on is actually present in public/.
# Run this as STEP 0 before any App Store archive or TestFlight build — a silently
# wiped/untracked PNG (or a missing privacy page) would break the build or the
# review. Exits non-zero if anything is missing, so it can gate a build script.
#
# Created July 3, 2026 (Option B — full public/ coverage, not just mascot art).
# When you add a NEW required file to public/, add its name to REQUIRED below.
# ─────────────────────────────────────────────────────────────────────────────

set -u

# Resolve public/ relative to this script's own location, so it works no matter
# what directory you run it from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR/public"

# Every file the app requires in public/. Filenames are EXACT (case-sensitive) —
# e.g. Speech_Bubble.png keeps its capitalization.
REQUIRED=(
  # Icons / PWA
  "icon-512.png"
  "icon-192.png"
  "apple-touch-icon.png"
  "manifest.json"
  # Mascot / game art
  "pirate-cheer.png"
  "pirate-captain-female.png"
  "perfect-day-pirates.png"
  "great-word-pirate.png"
  "wotd-pirate-chest.png"
  "wotd-coin.png"
  "Speech_Bubble.png"
  # Required HTML pages (privacy is an App Store review requirement)
  "privacy.html"
  "reset-password.html"
  "support.html"
)

echo "Checking ${#REQUIRED[@]} required files in $PUBLIC_DIR ..."
echo

missing=0
for f in "${REQUIRED[@]}"; do
  if [ -f "$PUBLIC_DIR/$f" ]; then
    printf '  OK    %s\n' "$f"
  else
    printf '  MISSING  %s\n' "$f"
    missing=$((missing + 1))
  fi
done

echo
if [ "$missing" -eq 0 ]; then
  echo "PASS — all ${#REQUIRED[@]} required assets present."
  exit 0
else
  echo "FAIL — $missing required asset(s) MISSING. Do not archive until resolved."
  exit 1
fi
