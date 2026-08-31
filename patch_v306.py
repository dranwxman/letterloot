#!/usr/bin/env python3
"""
patch_v306.py — LetterLoot v306
FIX: the Aug 30 leaderboard erasure (Mack's name blanked + lifetime_points clobbered
     on two accounts) and the ungated ?admin=1 panel.
"""
import re, sys, io

PATH = "src/App.jsx"

def die(msg):
    print("REFUSED: " + msg)
    sys.exit(1)

src = io.open(PATH, encoding="utf-8").read()
orig = src

def sub_once(needle, replacement, label):
    global src
    n = src.count(needle)
    if n != 1:
        die("anchor [%s] found %d times, expected 1" % (label, n))
    src = src.replace(needle, replacement, 1)
    print("  ok  %s" % label)

def sub_n(needle, replacement, count, label):
    global src
    n = src.count(needle)
    if n != count:
        die("anchor [%s] found %d times, expected %d" % (label, n, count))
    src = src.replace(needle, replacement)
    print("  ok  %s (x%d)" % (label, count))

print("patch_v306 — anchors:")

m = re.search(r"^const DEBUG_MODE = (?:true|false);.*$", src, re.M)
if not m:
    die("DEBUG_MODE line not found")
if len(re.findall(r"^const DEBUG_MODE = ", src, re.M)) != 1:
    die("DEBUG_MODE declared more than once")
debug_line = m.group(0)
src = src.replace(debug_line, debug_line + """
// v306: ?admin=1 is NOT authorization. The admin panel reads every player's game_state
// row, so it renders only for a DEBUG build or one of these signed-in accounts.
const ADMIN_EMAILS = ["dranwxman@letterloot.net", "dranwxman@gmail.com"];""", 1)
print("  ok  ADMIN_EMAILS constant")

sub_once(
    """  const [showAdmin, setShowAdmin] = useState(() => new URLSearchParams(window.location.search).get('admin') === '1');""",
    """  const [showAdmin, setShowAdmin] = useState(() => new URLSearchParams(window.location.search).get('admin') === '1');
  // v306: the URL param only REQUESTS the panel; this decides whether it opens.
  const adminAllowed = DEBUG_MODE || ADMIN_EMAILS.includes(((user && user.email) || "").trim().toLowerCase());""",
    "showAdmin + adminAllowed")

sub_once(
    """  if (showAdmin) return withBadge(<AdminScreen onExit={()=>setShowAdmin(false)}/>);""",
    """  if (showAdmin && adminAllowed) return withBadge(<AdminScreen onExit={()=>setShowAdmin(false)}/>);""",
    "AdminScreen render gate")

sub_n("if (isGuest) saveLifetimeData(lifetimeRef.current);",
      "saveLifetimeData(lifetimeRef.current); // v306: mirror locally for ALL players",
      4, "saveLifetimeData(lifetimeRef.current)")

sub_n("if (isGuest) saveLifetimeData(newLifetime);",
      "saveLifetimeData(newLifetime); // v306: mirror locally for ALL players",
      1, "saveLifetimeData(newLifetime)")

sub_once(
    """  const lifetimeRef = useRef(lifetimeData.current.total || 0);""",
    """  const lifetimeRef = useRef(lifetimeData.current.total || 0);
  // v306: lifetime/name are only safe to WRITE once this session has PROVEN it can read
  // the cloud row. An unread row is UNKNOWN, not zero — treating unknown as zero is what
  // erased Mack's name and two lifetime totals on Aug 30.
  const lifetimeHydratedRef = useRef(false);
  const cloudLifetimeRef = useRef(0);
  const cloudNameRef = useRef("");""",
    "hydration refs")

sub_once(
    """          const bestPts = Math.max(cloudPts, localPts);
          lifetimeRef.current = bestPts;
          setLifetimePoints(bestPts);""",
    """          const bestPts = Math.max(cloudPts, localPts);
          lifetimeRef.current = bestPts;
          setLifetimePoints(bestPts);
          // v306: a real row came back — this session may now write game_state.
          lifetimeHydratedRef.current = true;
          cloudLifetimeRef.current = cloudPts;
          if (gameState.player_name) cloudNameRef.current = gameState.player_name;""",
    "init hydration flag")

sub_once(
    """        // v249 DOUBLE-PAY FIX: today's cloud daily_sessions row is the most direct account-level""",
    """        // v306: a null/empty gameState is AMBIGUOUS — brand-new player, or a failed read.
        // Probe REST directly; only a confirmed 200 marks the session safe to write.
        if (!lifetimeHydratedRef.current) {
          try {
            const probe = await fetch(
              ADMIN_SUPABASE_URL + "/rest/v1/game_state?select=lifetime_points,player_name&player_id=eq." + user.id,
              { headers: { apikey: ADMIN_ANON_KEY, Authorization: "Bearer " + ADMIN_ANON_KEY } }
            );
            if (probe.ok) {
              const rows = await probe.json();
              const row = Array.isArray(rows) ? rows[0] : null;
              cloudLifetimeRef.current = (row && row.lifetime_points) || 0;
              cloudNameRef.current = (row && row.player_name) || "";
              if (cloudLifetimeRef.current > (lifetimeRef.current || 0)) {
                lifetimeRef.current = cloudLifetimeRef.current;
                setLifetimePoints(cloudLifetimeRef.current);
              }
              lifetimeHydratedRef.current = true;
            }
          } catch {}
        }
        // v249 DOUBLE-PAY FIX: today's cloud daily_sessions row is the most direct account-level""",
    "init REST probe")

sub_once(
    """    await Promise.all([
      saveDailySession(user.id, todayKey, {""",
    """    // v306: game_state is written ONLY by a session that proved it could read the row.
    // daily_sessions still saves either way — today's game is never lost by this guard.
    const canWriteGameState = lifetimeHydratedRef.current === true;
    if (!canWriteGameState && DEBUG_MODE) console.log("[SYNCGUARD v306] game_state write skipped - cloud never hydrated this session");
    await Promise.all([
      saveDailySession(user.id, todayKey, {""",
    "syncToCloud hydration gate")

sub_once(
    """      saveGameState(user.id, (() => {""",
    """      !canWriteGameState ? Promise.resolve(null) : saveGameState(user.id, (() => {""",
    "saveGameState conditional")

sub_once(
    """          playerName: playerNameRef.current || playerName || '',
          lifetimePoints: lifetimeRef.current, lastPlayedDate: todayKey,""",
    """          // v306: never write an empty name over a good one, and never write a lifetime
          // lower than the last value actually READ from the cloud.
          playerName: playerNameRef.current || playerName || cloudNameRef.current || '',
          lifetimePoints: Math.max(lifetimeRef.current || 0, cloudLifetimeRef.current || 0), lastPlayedDate: todayKey,""",
    "lifetime floor + name fallback")

src = src.replace(debug_line, re.sub(r"// v\d+ [^\n]*", "// v306 dev cycle OPEN - leaderboard erasure guards + admin gate", debug_line, count=1), 1)

if src == orig:
    die("no changes written")

io.open(PATH, "w", encoding="utf-8").write(src)
print("v306 applied OK")
