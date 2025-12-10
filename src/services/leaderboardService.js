import { supabase } from './supabase.js';

export async function fetchLeaderboard(limit = 50) {
  const { data, error } = await supabase.rpc('get_leaderboard', { limit_count: limit });
  if (error) throw error;
  return data;
}
