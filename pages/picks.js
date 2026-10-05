import { CURRENT_WEEK } from "../lib/config";
import { useEffect, useMemo, useState } from "react";
import { PICK_BOARD_GROUPS } from "../lib/weeklyGames";
import { supabase } from "../lib/supabase";
import { resolveActiveWeek } from "../lib/activeWeek";

const STORAGE_KEY = "bb_selected_booster";
const PLAYER_KEY = "bb_player_profile";
const PICKS_KEY = "bb_weekly_picks";
const BOARD_KEY = "bb_pick_board";
const ICONS = { Featured: "⭐", District: "📍", Classification: "🏆", School: "🏫" };
const slug = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const uniq = (rows) => Array.from(new Map(rows.map((g) => [g.id, g])).values());
const classRegionLabel = (className, regionName) => {
  const classNumber = String(className || "").match(/\d+/)?.[0];
  const regionLetter = String(regionName || "").match(/[A-D]\b/i)?.[0]?.toUpperCase();
  return classNumber && regionLetter ? `${classNumber}${regionLetter}` : "";
};
const mapGame = (g) => ({ id: g.id, away: g.away_team, home: g.home_team, kickoffAt: g.kickoff_at || null, kickoff: g.kickoff_at ? new Date(g.kickoff_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : "TBD", district: g.district || "", awayClass: g.away_class || "", homeClass: g.home_class || "", awayRegion: g.away_region || "", homeRegion: g.home_region || "", isFeatured: !!g.is_featured });

function makeBoards(rows, directoryRows = rows, currentWeek = CURRENT_WEEK) {
  const games = rows.map(mapGame);
  const directoryGames = directoryRows.map(mapGame);
  const boards = [];
  const featured = games.filter((g) => g.isFeatured);
  if (featured.length) boards.push({ id: "featured", type: "featured", group: "Featured", label: "Virginia Games of the Week", shortLabel: "Featured", description: "Booster Bowl's statewide featured matchups.", games: featured });
  [...new Set(games.map((g) => g.district).filter(Boolean))].sort().forEach((d) => boards.push({ id: `district-${slug(d)}`, type: "district", group: "District", label: `${d} District`, shortLabel: d, description: `Week ${currentWeek} games involving ${d} District programs.`, games: games.filter((g) => g.district === d) }));
  const classifications = new Set();
  directoryGames.forEach((g) => { const away = classRegionLabel(g.awayClass, g.awayRegion); const home = classRegionLabel(g.homeClass, g.homeRegion); if (away) classifications.add(away); if (home) classifications.add(home); });
  [...classifications].sort((a, b) => Number(a[0]) - Number(b[0]) || a.localeCompare(b)).forEach((classification) => boards.push({ id: `classification-${classification.toLowerCase()}`, type: "classification", group: "Classification", label: `VHSL Class ${classification}`, shortLabel: `Class ${classification}`, description: `Week ${currentWeek} games involving Class ${classification} programs.`, games: games.filter((g) => classRegionLabel(g.awayClass, g.awayRegion) === classification || classRegionLabel(g.homeClass, g.homeRegion) === classification) }));
  const schools = new Set(); directoryGames.forEach((g) => { schools.add(g.away); schools.add(g.home); });
  [...schools].sort().forEach((s) => boards.push({ id: `school-${slug(s)}`, type: "school", group: "School", label: s, shortLabel: s, description: games.some((g) => g.away === s || g.home === s) ? `Follow ${s}'s Week ${currentWeek} matchup.` : `${s} has no Week ${currentWeek} matchup loaded. The school remains available for upcoming weeks.`, games: games.filter((g) => g.away === s || g.home === s) }));
  return boards.map((b) => ({ ...b, games: uniq(b.games) }));
}

export default function Picks() {
  const [boards, setBoards] = useState([]);
  const [activeWeek, setActiveWeek] = useState(CURRENT_WEEK);
  const [boardId, setBoardId] = useState("");
  const [activeGroup, setActiveGroup] = useState("Classification");
  const [schoolSearch, setSchoolSearch] = useState("");
  const board = useMemo(() => (boardId ? boards.find((b) => b.id === boardId) || null : null), [boards, boardId]);
  const games = board?.games || [];
  const [selectedBooster, setSelectedBooster] = useState(null); const [playerName, setPlayerName] = useState(""); const [user, setUser] = useState(null); const [picks, setPicks] = useState({}); const [submitted, setSubmitted] = useState(false); const [busy, setBusy] = useState(false); const [toast, setToast] = useState(""); const [catalogMessage, setCatalogMessage] = useState("Loading the live schedule..."); const [pickDeadline, setPickDeadline] = useState(null); const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    function loadProfile(profileOverride) {
      try {
        const profile = profileOverride || JSON.parse(localStorage.getItem(PLAYER_KEY) || "{}");
        setPlayerName(profile.playerName || "");
      } catch {}
    }
    try {
      const booster = localStorage.getItem(STORAGE_KEY);
      const savedBoard = localStorage.getItem(BOARD_KEY);
      const savedPicks = localStorage.getItem(PICKS_KEY);
      if (booster) setSelectedBooster(JSON.parse(booster));
      if (savedBoard) setBoardId(savedBoard);
      if (savedPicks) setPicks(JSON.parse(savedPicks));
    } catch {}
    loadProfile();
    const handleProfileUpdate = (event) => loadProfile(event.detail);
    window.addEventListener("booster-bowl-profile-updated", handleProfileUpdate);
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener("booster-bowl-profile-updated", handleProfileUpdate);
    };
  }, []);

  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 30000); return () => window.clearInterval(timer); }, []);

  useEffect(() => {
    let alive = true;
    async function syncActiveWeek() {
      const week = await resolveActiveWeek();
      if (alive) setActiveWeek(week);
    }
    syncActiveWeek();
    const timer = window.setInterval(syncActiveWeek, 60000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const weeks = Array.from({ length: Math.max(1, 13 - activeWeek) }, (_, i) => activeWeek + i);
      const results = await Promise.all(weeks.map((week) => supabase.rpc("get_pick_board_games", { p_season: 2026, p_week: week })));
      if (!alive) return;
      const current = results[0];
      if (current.error) {
        setPickDeadline(null);
        setBoards([]);
        setBoardId("");
        setCatalogMessage("The live schedule is temporarily unavailable. Please try again shortly.");
        return;
      }
      if (!current.data?.length) {
        setPickDeadline(null);
        setBoards([]);
        setBoardId("");
        setCatalogMessage(`No Week ${activeWeek} games are currently available.`);
        return;
      }
      const kickoffTimes = current.data.map((game) => game.kickoff_at ? Date.parse(game.kickoff_at) : NaN).filter(Number.isFinite);
      setPickDeadline(kickoffTimes.length ? new Date(Math.min(...kickoffTimes)).toISOString() : null);
      const seasonRows = results.flatMap((result) => result.error ? [] : (result.data || []));
      const next = makeBoards(current.data, seasonRows.length ? seasonRows : current.data, activeWeek);
      if (!next.length) {
        setBoards([]);
        setBoardId("");
        setCatalogMessage("No pick boards could be built from the live schedule.");
        return;
      }
      setBoards(next);
      setCatalogMessage("");
      setBoardId((currentId) => next.some((b) => b.id === currentId) ? currentId : "");
    })();
    return () => { alive = false; };
  }, [activeWeek, user?.id]);
  useEffect(() => { if (board?.group) setActiveGroup(board.group); }, [board?.group]);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id || !board || !games.length) { if (alive) setSubmitted(false); return; }
      const { data: player, error: playerError } = await supabase.from("players").select("id").eq("user_id", user.id).maybeSingle();
      if (!alive || playerError || !player?.id) { if (alive) setSubmitted(false); return; }
      const gameIds = games.map((g) => g.id);
      const { data: savedPicks, error: picksError } = await supabase.from("picks").select("game_id,selected_team").eq("player_id", player.id).in("game_id", gameIds);
      if (!alive || picksError) { if (alive) setSubmitted(false); return; }
      const savedByGame = new Map((savedPicks || []).map((p) => [p.game_id, p.selected_team])); const restored = {};
      games.forEach((g) => { const team = savedByGame.get(g.id); if (team === g.home) restored[g.id] = "home"; else if (team === g.away) restored[g.id] = "away"; });
      if (!alive) return;
      setPicks((current) => { const next = { ...current, ...restored }; try { localStorage.setItem(PICKS_KEY, JSON.stringify(next)); } catch {} return next; }); setSubmitted(gameIds.every((id) => savedByGame.has(id)));
    })(); return () => { alive = false; };
  }, [user?.id, boardId, boards]);

  const availableGroups = PICK_BOARD_GROUPS.filter((group) => boards.some((b) => b.group === group));
  const groupBoards = boards.filter((b) => b.group === activeGroup);
  const visibleBoards = activeGroup === "School" ? groupBoards.filter((b) => b.label.toLowerCase().includes(schoolSearch.trim().toLowerCase())) : groupBoards;
  const pickedCount = games.filter((g) => picks[g.id]).length;
  const picksOpen = !!pickDeadline && clock < Date.parse(pickDeadline);
  const deadlineText = pickDeadline ? `Picks lock ${new Date(pickDeadline).toLocaleString([], { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}.` : "Picks stay locked until kickoff times are published.";
  function changeBoard(id) { if (submitted || busy) return; setBoardId(id); setToast(""); try { localStorage.setItem(BOARD_KEY, id); } catch {} }
  function choose(id, side) { if (!picksOpen || submitted) return; const next = { ...picks, [id]: side }; setPicks(next); try { localStorage.setItem(PICKS_KEY, JSON.stringify(next)); } catch {} }
  function clearAll() { if (submitted) return; const ids = new Set(games.map((g) => g.id)); const next = Object.fromEntries(Object.entries(picks).filter(([id]) => !ids.has(id))); setPicks(next); try { localStorage.setItem(PICKS_KEY, JSON.stringify(next)); } catch {} }
  async function submit() {
    if (submitted || busy) return; if (!picksOpen) return setToast("Picks are locked because this week’s deadline has passed."); if (!user) {
      setToast("Sign in to submit your picks. Your selections will stay saved.");
      window.dispatchEvent(new CustomEvent("booster-bowl-open-login"));
      return;
    } if (!playerName.trim()) return setToast("Enter your name before submitting."); if (!selectedBooster) return setToast("Choose a booster club before submitting."); if (!games.length) return setToast("There are no games loaded on this board yet."); if (pickedCount !== games.length) return setToast(`Pick ${games.length - pickedCount} more game(s) to submit.`);
    setBusy(true); setToast("Saving your picks..."); const { data: player, error: playerError } = await supabase.from("players").upsert({ user_id: user.id, display_name: playerName.trim(), email: user.email, booster_name: selectedBooster.name || "", school_name: selectedBooster.school || "" }, { onConflict: "user_id" }).select("id").single(); if (playerError) { setBusy(false); return setToast("Could not save your player profile: " + playerError.message); }
    const desiredRows = games.map((g) => ({ player_id: player.id, game_id: g.id, selected_team: picks[g.id] === "home" ? g.home : g.away })); const gameIds = desiredRows.map((r) => r.game_id); const { data: existing, error } = await supabase.from("picks").select("id,game_id,selected_team").eq("player_id", player.id).in("game_id", gameIds); if (error) { setBusy(false); return setToast("Could not check your saved picks: " + error.message); }
    const saved = new Map((existing || []).map((r) => [r.game_id, r])); const inserts = desiredRows.filter((r) => !saved.has(r.game_id)); const updates = desiredRows.filter((r) => saved.has(r.game_id) && saved.get(r.game_id).selected_team !== r.selected_team);
    if (inserts.length) { const { error: e } = await supabase.from("picks").insert(inserts); if (e) { setBusy(false); return setToast("Could not save your new picks: " + e.message); } } for (const r of updates) { const { error: e } = await supabase.from("picks").update({ selected_team: r.selected_team }).eq("id", saved.get(r.game_id).id).eq("player_id", player.id); if (e) { setBusy(false); return setToast("A changed pick could not be updated: " + e.message); } }
    setBusy(false); setSubmitted(true); setToast(`🏈 ${board.shortLabel} picks saved! You're officially in the Booster Bowl.`);
  }

  return <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}><div className="card"><h1 style={{ marginTop: 0 }}>🏈 Choose Your Pick Board</h1><p>Week {activeWeek} — {picksOpen ? "Picks are OPEN" : "Picks are LOCKED"}.</p><p style={{ opacity: .8 }}>{deadlineText}</p>{catalogMessage && <div style={{ marginTop: 12, padding: 12, border: "1px solid #dbe3ef", borderRadius: 12 }}>{catalogMessage}</div>}<div style={{ marginTop: 18 }}><b>1. Choose how you want to pick</b><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>{availableGroups.map((group) => <button key={group} className="button" onClick={() => { setActiveGroup(group); setBoardId(""); setSchoolSearch(""); setToast(""); try { localStorage.removeItem(BOARD_KEY); } catch {} }} disabled={submitted || busy} style={{ opacity: activeGroup === group ? 1 : .58, outline: activeGroup === group ? "2px solid #3b82f6" : "none", padding: "10px 14px" }}>{ICONS[group]} {group}</button>)}</div></div><div style={{ marginTop: 18 }}><b>2. Choose your {activeGroup.toLowerCase()}</b>{activeGroup === "School" && <input value={schoolSearch} onChange={(e) => setSchoolSearch(e.target.value)} placeholder="🔎 Search school name..." style={{ width: "100%", boxSizing: "border-box", marginTop: 10, padding: 13, borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 16 }} />}<select value={visibleBoards.some((b) => b.id === boardId) ? boardId : ""} onChange={(e) => e.target.value && changeBoard(e.target.value)} disabled={submitted || busy} style={{ width: "100%", marginTop: 10, padding: 13, borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 16, background: "white" }}><option value="">Select {activeGroup === "Classification" ? "classification" : activeGroup.toLowerCase()}...</option>{visibleBoards.map((b) => <option key={b.id} value={b.id}>{b.label} — {b.games.length} game{b.games.length === 1 ? "" : "s"}</option>)}</select>{activeGroup === "School" && schoolSearch && !visibleBoards.length && <p style={{ opacity: .7 }}>No school matches “{schoolSearch}”.</p>}</div>{board ? <div style={{ marginTop: 18, padding: 14, border: "1px solid #dbe3ef", borderRadius: 14 }}><div style={{ fontSize: 13, opacity: .7 }}>CURRENT PICK BOARD</div><h2 style={{ margin: "5px 0" }}>{ICONS[board.group]} {board.label}</h2><div style={{ opacity: .8 }}>{board.description}</div><b>{games.length ? `${games.length} matchup${games.length === 1 ? "" : "s"} this week` : `No Week ${activeWeek} matchup`}</b></div> : <div style={{ marginTop: 18, padding: 14, border: "1px dashed #cbd5e1", borderRadius: 14, opacity: .8 }}><b>Choose a {activeGroup === "Classification" ? "classification" : activeGroup.toLowerCase()} above to load this week&apos;s games.</b></div>}{selectedBooster ? <p>Supporting: <b>{selectedBooster.name}</b> ({selectedBooster.school})</p> : <p><a href="/boosters">Choose a booster club first</a>.</p>}<div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}><div>Picks: <b>{pickedCount}</b> / {games.length}</div><button className="button" onClick={submit} disabled={!picksOpen || submitted || busy || !games.length}>{submitted ? "Submitted ✅" : busy ? "Saving..." : board ? `Submit ${board.shortLabel} Picks` : "Choose a Pick Board"}</button><button className="button" onClick={clearAll} disabled={submitted || busy}>Clear Board</button></div>{toast && <div style={{ marginTop: 12, padding: 12, border: "1px solid #2a3b57", borderRadius: 12 }}>{toast}</div>}</div><div style={{ height: 18 }} />{games.map((g, i) => { const picked = picks[g.id]; return <div key={g.id} className="card"><div style={{ fontSize: 13, fontWeight: 700 }}>{board.group.toUpperCase()} • GAME {i + 1} OF {games.length}</div><div style={{ opacity: .8 }}>Kickoff: {g.kickoff}</div><h2>{g.away} <span style={{ opacity: .6 }}>at</span> {g.home}</h2><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><PickButton label={`Pick ${g.away}`} active={picked === "away"} onClick={() => choose(g.id, "away")} disabled={!picksOpen || submitted} /><PickButton label={`Pick ${g.home}`} active={picked === "home"} onClick={() => choose(g.id, "home")} disabled={!picksOpen || submitted} /></div><p>Your pick: <b>{picked ? (picked === "home" ? g.home : g.away) : "—"}</b></p></div>; })}</div>;
}
function PickButton({ label, active, onClick, disabled }) { return <button className="button" onClick={onClick} disabled={disabled} style={{ outline: active ? "2px solid #3b82f6" : "none" }}>{active ? "✅ " : ""}{label}</button>; }