import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ── Auth helpers ───────────────────────────────────────────────
export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error };
  if (data.user) {
    await supabase.from("players").upsert({ id: data.user.id, email, name });
  }
  return { data };
}
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error };
  // Defensive: if the players row was wiped (e.g., beta data wipe), ensure it exists.
  // This is idempotent — if the row exists, this only updates email/last-seen.
  if (data.user) {
    try { await ensurePlayerRecord(data.user.id, email); } catch {}
  }
  return { data };
}
export async function signOut() {
  await supabase.auth.signOut();
}
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://letterloot-6k6v.vercel.app/reset-password.html",
  });
  return { error };
}
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
// ── Player record ensurer (May 19, 2026 — added after beta wipe) ────────────
// Idempotent upsert that creates the players row if missing.
// Safe to call any time we need to guarantee the FK parent exists before
// game_state or daily_sessions inserts run.
export async function ensurePlayerRecord(playerId, email, name) {
  const payload = { id: playerId };
  if (email) payload.email = email;
  if (name)  payload.name = name;
  const { error } = await supabase
    .from("players")
    .upsert(payload, { onConflict: "id", ignoreDuplicates: false });
  return { error };
}
// ── Game state sync ────────────────────────────────────────────
export async function loadGameState(playerId) {
  const { data, error } = await supabase
    .from("game_state")
    .select("*")
    .eq("player_id", playerId)
    .single();
  if (error) return null;
  return data;
}
export async function saveGameState(playerId, state) {
  // Union-merge badges with existing cloud record to prevent any stale local sync
  // from stripping badges that another session/device may have added.
  let mergedBadges = state.badges || [];
  try {
    const { data: existing } = await supabase
      .from("game_state")
      .select("badges")
      .eq("player_id", playerId)
      .maybeSingle();
    if (existing && Array.isArray(existing.badges)) {
      const set = new Set([...mergedBadges, ...existing.badges]);
      mergedBadges = Array.from(set);
    }
  } catch {}
  const { error } = await supabase.from("game_state").upsert({
    player_id: playerId,
    player_name: state.playerName || "",
    lifetime_points: state.lifetimePoints || 0,
    last_played_date: state.lastPlayedDate || null,
    current_streak: state.currentStreak || 0,
    longest_streak: state.longestStreak || 0,
    last_streak_date: state.lastStreakDate || null,
    badges: mergedBadges,
    stats: state.stats || {},
    time_records: state.timeRecords || {},
    updated_at: new Date().toISOString(),
  }, { onConflict: "player_id" });
  return { error };
}
// ── Daily session sync ─────────────────────────────────────────
export async function loadDailySession(playerId, dateKey) {
  const { data, error } = await supabase
    .from("daily_sessions")
    .select("*")
    .eq("player_id", playerId)
    .eq("date_key", dateKey)
    .single();
  if (error) return null;
  return data;
}
export async function saveDailySession(playerId, dateKey, session) {
  // First, fetch existing record to preserve highest score of the day
  const { data: existing } = await supabase
    .from("daily_sessions")
    .select("total_score, perfect_day, longest_word_today, wotd_found, top_word, top_word_score")
    .eq("player_id", playerId)
    .eq("date_key", dateKey)
    .maybeSingle();

  const existingScore = existing?.total_score || 0;
  const newScore = session.totalScore || 0;
  // Take the HIGHER of existing and new score for the day
  const bestScore = Math.max(existingScore, newScore);
  // Once perfect_day is true for the day, keep it true regardless of subsequent games
  const bestPerfectDay = (existing?.perfect_day === true) || (session.perfectDay === true);
  // Keep the longest word ever played today
  const existingLongest = existing?.longest_word_today || "";
  const newLongest = session.longestWordToday || "";
  const bestLongest = newLongest.length > existingLongest.length ? newLongest : existingLongest;
  // wotd_found sticky once true
  const wotdFound = (existing?.wotd_found === true) || (session.wotdFound === true);
  // Top scoring word of the day (preserved across multi-game days)
  const existingTopScore = existing?.top_word_score || 0;
  const newTopScore = session.topWordScore || 0;
  const bestTopScore = Math.max(existingTopScore, newTopScore);
  const bestTopWord = newTopScore > existingTopScore ? (session.topWord || "") : (existing?.top_word || session.topWord || "");

  const { error } = await supabase.from("daily_sessions").upsert({
    player_id: playerId,
    date_key: dateKey,
    level: session.level || 1,
    total_score: bestScore,           // always the day's best
    level_score: session.levelScore || 0,
    tiles: session.tiles || null,
    submitted: session.submitted || [],
    perfect_day: bestPerfectDay,      // sticky once true
    tile_count: session.tileCount || 42,
    level_time: session.levelTime || 0,
    total_time: session.totalTime || 0,
    longest_word_today: bestLongest,  // longest of the day
    wotd_found: wotdFound,            // did player find the Word of the Day
    top_word: bestTopWord,            // highest-scoring word of the day
    top_word_score: bestTopScore,     // its score
    completed: session.completed || false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "player_id, date_key" });
  return { error };
}
// ── Player name & photo ────────────────────────────────────────
// Changed from .update() to .upsert() (May 19, 2026) so the row is created
// if missing. Previously, after the beta data wipe, .update() would silently
// no-op because there was no row to modify, breaking the FK chain for game_state.
export async function updatePlayerName(playerId, name) {
  const { error } = await supabase
    .from("players")
    .upsert({ id: playerId, name }, { onConflict: "id" });
  await supabase
    .from("game_state")
    .update({ player_name: name })
    .eq("player_id", playerId);
  return { error };
}
export async function savePlayerPhoto(playerId, photoBase64) {
  const { error } = await supabase
    .from("players")
    .upsert({ id: playerId, photo: photoBase64 }, { onConflict: "id" });
  return { error };
}
export async function loadPlayerPhoto(playerId) {
  const { data, error } = await supabase
    .from("players")
    .select("photo")
    .eq("id", playerId)
    .single();
  if (error || !data?.photo) return null;
  return data.photo;
}
// ── Best-times leaderboard (#18b — Cloud Time Leaderboard) ─────────────────
// One row per player per slot ('1'..'5' or 'perfect'), holding their PERSONAL
// BEST seconds for that slot. Upsert-on-improve: we only write when the new
// time is faster than what's already stored (or no row exists yet). RLS on the
// table guarantees a player can only ever write their own row.
//
// Caller is responsible for the eligibility gate (registered-only + clean-clear
// for level slots; Perfect Day is clean by definition). This function assumes
// the time being passed is already eligible to be recorded.
export async function saveBestTime(playerId, playerName, slot, seconds) {
  if (!playerId || !slot || !(seconds > 0)) return { error: "invalid-args" };
  try {
    // Read the player's current best for this slot (may not exist yet).
    const { data: existing } = await supabase
      .from("best_times")
      .select("seconds")
      .eq("player_id", playerId)
      .eq("slot", String(slot))
      .maybeSingle();
    // Only write if this is a genuine improvement (or first-ever time for the slot).
    if (existing && typeof existing.seconds === "number" && seconds >= existing.seconds) {
      return { skipped: true };  // not faster — leave the standing record alone
    }
    const { error } = await supabase.from("best_times").upsert({
      player_id: playerId,
      player_name: playerName || "",
      slot: String(slot),
      seconds,
      date: shortDate(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "player_id, slot" });
    return { error };
  } catch (e) {
    return { error: e };
  }
}
// Small local date stamp for display on the board, e.g. "Jul 4".
function shortDate() {
  try {
    return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}
