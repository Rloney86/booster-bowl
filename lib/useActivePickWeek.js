import { useEffect, useState } from "react";
import { SEASON, CURRENT_WEEK, PICKS_OPEN, PICKS_DEADLINE_TEXT } from "./config";
import { supabase } from "./supabase";

const fallback = {
  season: Number(SEASON),
  week: Number(CURRENT_WEEK),
  picksOpen: PICKS_OPEN,
  deadlineText: PICKS_DEADLINE_TEXT,
};

export function useActivePickWeek() {
  const [activeWeek, setActiveWeek] = useState(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data, error } = await supabase.rpc("get_active_pick_week");
      if (!alive) return;

      if (!error && data?.[0]) {
        const row = data[0];
        setActiveWeek({
          season: Number(row.season),
          week: Number(row.week),
          picksOpen: Boolean(row.picks_open),
          deadlineText: row.deadline_text || fallback.deadlineText,
        });
      }
      setLoading(false);
    })();

    return () => { alive = false; };
  }, []);

  return { ...activeWeek, loading };
}
