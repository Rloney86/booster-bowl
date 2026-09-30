"""Parser for the official 2026 VHSL football master schedule PDF."""
import hashlib
import re
from collections import defaultdict
from datetime import date, datetime
from io import BytesIO
from zoneinfo import ZoneInfo

import requests
from pypdf import PdfReader

SEASON = 2026
FILE_ID = "1jpJ8LAEGjmX3oIC15zPZInAtp1L1UptY"
DOWNLOAD_URL = f"https://drive.google.com/uc?export=download&id={FILE_ID}"
PAGE_URL = f"https://drive.google.com/file/d/{FILE_ID}/view"
SOURCE = "VHSL official master schedule"

WEEK_WINDOWS = {
    6: (date(2026, 9, 28), date(2026, 10, 3)),
    7: (date(2026, 10, 5), date(2026, 10, 10)),
    8: (date(2026, 10, 12), date(2026, 10, 17)),
    9: (date(2026, 10, 19), date(2026, 10, 24)),
    10: (date(2026, 10, 26), date(2026, 10, 31)),
    11: (date(2026, 11, 2), date(2026, 11, 7)),
}
REGION_RE = re.compile(r"^Region\s+([2-6])([A-D])$", re.I)
HEADING_RE = re.compile(r"^(.+?)\s*\[([1-6])\]\s*([A-Za-z][A-Za-z .&'()/-]*)$")
SCHOOL_CLASS_RE = re.compile(r"^(.+?)\s*\[([1-6])\]\s*$")
CLASS_ONLY_RE = re.compile(r"^\[([1-6])\]$")
DATE_LINE_RE = re.compile(r"^\d{1,2}/\d{1,2}\s+\d{1,2}(?::\d{2})?[ap]\b", re.I)
DATE_PAIR_RE = re.compile(r"(.+?)(\d{1,2}/\d{1,2}\s+\d{1,2}(?::\d{2})?[ap])(?=\s|$)", re.I)

def clean(value):
    return re.sub(r"\s+", " ", value.replace("\xa0", " ").replace("’", "'").replace("–", "-").replace("—", "-")).strip()

def team_key(value):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", clean(value).lower())).strip()

def compact_key(value):
    return re.sub(r"[^a-z0-9]+", "", clean(value).lower())

def week_for_date(game_date):
    for week, (start, end) in WEEK_WINDOWS.items():
        if start <= game_date <= end:
            return week
    return None

def matchup_key(game_date, team_a, team_b):
    teams = sorted((team_key(team_a), team_key(team_b)))
    return (str(game_date), teams[0], teams[1])

def stable_source_id(game_date, away, home):
    return hashlib.sha256(f"{SEASON}|{'|'.join(matchup_key(game_date, away, home))}".encode()).hexdigest()[:32]

def kickoff_iso(game_date, text):
    match = re.fullmatch(r"(\d{1,2})(?::(\d{2}))?([ap])", text.lower())
    if not match:
        raise RuntimeError(f"Unsupported VHSL kickoff time: {text}")
    hour = int(match.group(1)); minute = int(match.group(2) or 0)
    if match.group(3) == "p" and hour != 12: hour += 12
    if match.group(3) == "a" and hour == 12: hour = 0
    return datetime(game_date.year, game_date.month, game_date.day, hour, minute, tzinfo=ZoneInfo("America/New_York")).isoformat()

def download_text():
    response = requests.get(DOWNLOAD_URL, timeout=90, headers={"User-Agent": "BoosterBowlScheduleSync/7.0"})
    response.raise_for_status()
    if not response.content.startswith(b"%PDF"):
        raise RuntimeError("VHSL master schedule URL did not return a PDF.")
    text = "\n".join((page.extract_text() or "") for page in PdfReader(BytesIO(response.content)).pages)
    if "2026 VHSL Football Schedule" not in text:
        raise RuntimeError("Downloaded file is not the expected 2026 VHSL schedule.")
    return text

def parse_opponent(raw, canonical):
    text = clean(raw)
    text = re.sub(r"^(?:BYE\s+)+", "", text, flags=re.I)
    text = re.sub(r"^CONFLICT\s+", "", text, flags=re.I)
    text = re.sub(r"^\*\*\s*", "", text)
    is_away = bool(re.match(r"^@\s*", text))
    text = re.sub(r"^@\s*", "", text)
    class_match = re.search(r"\[([1-6])\]\s*$", text)
    opponent_class = int(class_match.group(1)) if class_match else None
    text = re.sub(r"\s*\[[1-6]\]\s*$", "", text).strip()
    if not text or text.upper() == "BYE":
        return None, opponent_class, is_away
    return canonical.get(compact_key(text), text), opponent_class, is_away

def parse_official_schedule():
    lines = [clean(x) for x in download_text().splitlines() if clean(x)]
    teams = {}
    school_blocks = []
    region = None
    i = 0

    def heading_at(index):
        line = lines[index]
        hm = HEADING_RE.match(line)
        if hm:
            school = clean(hm.group(1)); school_class = int(hm.group(2)); district = clean(hm.group(3))
            if district:
                return school, school_class, district, index + 1

        scm = SCHOOL_CLASS_RE.match(line)
        if scm and index + 1 < len(lines):
            next_line = lines[index + 1]
            if next_line and not DATE_LINE_RE.match(next_line) and not REGION_RE.match(next_line) and "[" not in next_line:
                return clean(scm.group(1)), int(scm.group(2)), clean(next_line), index + 2

        if index + 2 < len(lines):
            wrapped = SCHOOL_CLASS_RE.match(lines[index + 1])
            district_line = lines[index + 2]
            if (
                wrapped and line
                and not DATE_LINE_RE.match(line)
                and not REGION_RE.match(line)
                and "[" not in line
                and not re.search(r"\bBYE\b", line, re.I)
                and not line.startswith(("@", "**"))
                and not line.upper().startswith("CONFLICT")
                and district_line
                and not DATE_LINE_RE.match(district_line)
                and not REGION_RE.match(district_line)
                and "[" not in district_line
            ):
                school = clean(f"{line} {wrapped.group(1)}")
                return school, int(wrapped.group(2)), clean(district_line), index + 3

            cm = CLASS_ONLY_RE.match(lines[index + 1])
            if cm and district_line and not DATE_LINE_RE.match(district_line) and not REGION_RE.match(district_line) and "[" not in district_line:
                return clean(line), int(cm.group(1)), clean(district_line), index + 3
        return None

    while i < len(lines):
        rm = REGION_RE.match(lines[i])
        if rm:
            region = rm.group(2).upper(); i += 1; continue
        heading = heading_at(i)
        if not heading:
            i += 1; continue
        school, school_class, district, content_start = heading
        teams[team_key(school)] = (school_class, region)
        parts = []
        j = content_start
        while j < len(lines) and not REGION_RE.match(lines[j]) and not heading_at(j):
            if not lines[j].startswith("** District Game Week"):
                parts.append(lines[j])
            j += 1
        school_blocks.append((school, school_class, region, district, clean(" ".join(parts))))
        i = j

    canonical = {compact_key(school): school for school, _, _, _, _ in school_blocks}
    candidates = []
    for school, school_class, _, _, schedule_text in school_blocks:
        if school_class not in {2, 3, 4, 5, 6}: continue
        for match in DATE_PAIR_RE.finditer(schedule_text):
            opponent, _, away_marker = parse_opponent(match.group(1), canonical)
            if not opponent: continue
            date_text, kickoff = match.group(2).split(" ", 1)
            month, day = map(int, date_text.split("/")); game_date = date(SEASON, month, day)
            week = week_for_date(game_date)
            if not week: continue
            away = school if away_marker else opponent; home = opponent if away_marker else school
            candidates.append({"date": game_date.isoformat(), "week": week, "away_team": away, "home_team": home, "kickoff_at": kickoff_iso(game_date, kickoff), "listed_by": school})

    grouped = defaultdict(list)
    for game in candidates: grouped[matchup_key(game["date"], game["away_team"], game["home_team"])].append(game)
    unique = {}; venue_conflicts = []; kickoff_conflicts = []
    for key, found in grouped.items():
        orientations = {(team_key(g["away_team"]), team_key(g["home_team"])) for g in found}; kickoffs = {g["kickoff_at"] for g in found}
        if len(orientations) > 1: venue_conflicts.append(found); continue
        if len(kickoffs) > 1: kickoff_conflicts.append(found); continue
        unique[key] = found[0]
    if venue_conflicts:
        sample = " | ".join(" / ".join(f"{g['away_team']} at {g['home_team']}" for g in found) for found in venue_conflicts[:5])
        raise RuntimeError(f"Official VHSL source has {len(venue_conflicts)} unresolved venue conflicts: {sample}")
    if kickoff_conflicts:
        sample = " | ".join(f"{found[0]['away_team']} at {found[0]['home_team']}" for found in kickoff_conflicts[:5])
        raise RuntimeError(f"Official VHSL source has {len(kickoff_conflicts)} unresolved kickoff conflicts: {sample}")
    if teams.get(team_key("Huguenot")) != (4, "B"): raise RuntimeError(f"Expected Huguenot 4B, got {teams.get(team_key('Huguenot'))}")
    if teams.get(team_key("Strasburg")) != (2, "B"): raise RuntimeError(f"Expected Strasburg 2B, got {teams.get(team_key('Strasburg'))}")

    now = datetime.now(tz=ZoneInfo("UTC")).isoformat(); rows = []
    for game in unique.values():
        away_meta = teams.get(team_key(game["away_team"])); home_meta = teams.get(team_key(game["home_team"]))
        rows.append({"season": SEASON, "week": game["week"], "away_team": game["away_team"], "home_team": game["home_team"], "kickoff_at": game["kickoff_at"], "sport": "football", "away_class": f"Class {away_meta[0]}" if away_meta else None, "away_region": f"Region {away_meta[1]}" if away_meta else None, "home_class": f"Class {home_meta[0]}" if home_meta else None, "home_region": f"Region {home_meta[1]}" if home_meta else None, "source": SOURCE, "source_game_id": stable_source_id(game["date"], game["away_team"], game["home_team"]), "source_url": PAGE_URL, "synced_at": now, "sync_status": "scheduled"})

    team_week = defaultdict(list)
    for row in rows:
        for team in (row["away_team"], row["home_team"]): team_week[(row["week"], team_key(team))].append(row)
    multi = [(key, found) for key, found in team_week.items() if len(found) > 1]
    if multi:
        print(f"NOTICE: {len(multi)} official team-week multi-game cases retained (possible makeups/reschedules).")
        for (week, team), found in multi[:10]: print(f"  W{week} {team}: " + " | ".join(f"{g['away_team']} at {g['home_team']} ({str(g['kickoff_at'])[:10]})" for g in found))

    jm = [row for row in rows if row["week"] == 6 and {team_key(row["away_team"]), team_key(row["home_team"])} == {team_key("John Marshall"), team_key("Woodbridge")}]
    if len(jm) != 1 or team_key(jm[0]["away_team"]) != team_key("John Marshall") or team_key(jm[0]["home_team"]) != team_key("Woodbridge"):
        raise RuntimeError("Expected official Week 6 matchup: John Marshall at Woodbridge.")
    print(f"Official VHSL source checks passed: {len(teams)} teams; {len(rows)} Week 6-11 games; John Marshall @ Woodbridge; Huguenot 4B; Strasburg 2B")
    return rows
