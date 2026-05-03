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
  return { data };
}
export async function signOut() {
  await supabase.auth.signOut();
}
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://letterloot-6k6v.vercel.app",
  });
  return { error };
}
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
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
  const { error } = await supabase.from("game_state").upsert({
    player_id: playerId,
    player_name: state.playerName || "",
    lifetime_points: state.lifetimePoints || 0,
    last_played_date: state.lastPlayedDate || null,
    current_streak: state.currentStreak || 0,
    longest_streak: state.longestStreak || 0,
    last_streak_date: state.lastStreakDate || null,
    badges: state.badges || [],
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
    .select("total_score, perfect_day, longest_word_today")
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
    completed: session.completed || false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "player_id, date_key" });
  return { error };
}
// ── Player name & photo ────────────────────────────────────────
export async function updatePlayerName(playerId, name) {
  const { error } = await supabase
    .from("players")
    .update({ name })
    .eq("id", playerId);
  await supabase
    .from("game_state")
    .update({ player_name: name })
    .eq("player_id", playerId);
  return { error };
}
export async function savePlayerPhoto(playerId, photoBase64) {
  const { error } = await supabase
    .from("players")
    .update({ photo: photoBase64 })
    .eq("id", playerId);
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
