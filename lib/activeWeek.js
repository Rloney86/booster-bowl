import { CURRENT_WEEK, SEASON } from "./config";
import { supabase } from "./supabase";

export async function resolveActiveWeek() {
  const { data, error } = await supabase.rpc("get_active_contest_week", {
    p_season: Number(SEASON),
  });
  const week = Number(data);
  return !error && Number.isInteger(week) && week > 0 ? week : CURRENT_WEEK;
}
