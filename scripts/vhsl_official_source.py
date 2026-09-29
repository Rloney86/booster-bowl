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
TEAM_RE = re.compile(r"^(.+?)\s*\[([1-6])\]$")
DATE_RE = re.compile(r"^(\d{1,2})/(\d{1,2})\s+(\d{1,2}(?::\d{2})?[ap])$", re.I)


def clean(value):
    return re.sub(r"\s+", " ", value.replace("’", "'").replace("–", "-").replace("—", "-")).strip()


def team_key(value):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", clean(value).lower())).strip()


def week_for_date(game_date):
    for week, (start, end) in WEEK_WINDOWS.items():
        if start <= game_date <= end:
            return week
    return None


def matchup_key(game_date, team_a, team_b):
    teams = sorted((team_key(team_a), team_key(team_b)))
    return (str(game_date), teams[0], teams[1])


def stable_source_id(game_date, away, home):
    return hashlib.sha256(
        f"{SEASON}|{'|'.join(matchup_key(game_date, away, home))}".encode()
    ).hexdigest()[:32]


def kickoff_iso(game_date, text):
    match = re.fullmatch(r"(\d{1,2})(?::(\d{2}))?([ap])", text.lower())
    if not match:
        raise RuntimeError(f"Unsupported VHSL kickoff time: {text}")
    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    if match.group(3) == "p" and hour != 12:
        hour += 12
    if match.group(3) == "a" and hour == 12:
        hour = 0
    return datetime(
        game_date.year, game_date.month, game_date.day, hour, minute,
        tzinfo=ZoneInfo("America/New_York")
    ).isoformat()


def download_text():
    response = requests.get(
        DOWNLOAD_URL, timeout=90,
        headers={"User-Agent": "BoosterBowlScheduleSync/5.0"}
    )
    response.raise_for_status()
    if not response.content.startswith(b"%PDF"):
        raise RuntimeError("VHSL master schedule URL did not return a PDF.")
    text = "\n".join(
        (page.extract_text() or "")
        for page in PdfReader(BytesIO(response.content)).pages
    )
    if "2026 VHSL Football Schedule" not in text:
        raise RuntimeError("Downloaded file is not the expected 2026 VHSL schedule.")
    return text


def is_school_heading(lines, index):
    match = TEAM_RE.match(lines[index])
    if not match or index + 1 >= len(lines):
        return False
    if lines[index].startswith(("@", "**", "BYE")):
        return False
    next_line = lines[index + 1]
    return (
        not DATE_RE.match(next_line)
        and not REGION_RE.match(next_line)
        and "[" not in next_line
    )


def parse_opponent(raw):
    text = clean(raw)
    text = re.sub(r"^BYE\s+", "", text, flags=re.I)
    text = re.sub(r"^\*\*\s*", "", text)
    is_away = bool(re.match(r"^@\s*", text))
    text = re.sub(r"^@\s*", "", text)
    match = TEAM_RE.match(text)
    if match:
        return clean(match.group(1)), int(match.group(2)), is_away
    class_match = re.search(r"\[([1-6])\]\s*$", text)
    opponent_class = int(class_match.group(1)) if class_match else None
    text = re.sub(r"\s*\[[1-6]\]\s*$", "", text).strip()
    return text, opponent_class, is_away


def parse_official_schedule():
    lines = [clean(x) for x in download_text().splitlines() if clean(x)]
    teams = {}
    games = []
    region = None
    i = 0

    while i < len(lines):
        rm = REGION_RE.match(lines[i])
        if rm:
            region = rm.group(2).upper()
            i += 1
            continue

        if region and is_school_heading(lines, i):
            tm = TEAM_RE.match(lines[i])
            school = clean(tm.group(1))
            school_class = int(tm.group(2))
            teams[team_key(school)] = (school_class, region)
            i += 2  # district line
            parts = []

            while i < len(lines):
                if REGION_RE.match(lines[i]) or is_school_heading(lines, i):
                    break
                dm = DATE_RE.match(lines[i])
                if dm:
                    raw_opponent = clean(" ".join(parts))
                    parts = []
                    if raw_opponent and raw_opponent.upper() != "BYE":
                        opponent, _, away_marker = parse_opponent(raw_opponent)
                        if opponent and opponent.upper() != "BYE":
                            game_date = date(SEASON, int(dm.group(1)), int(dm.group(2)))
                            week = week_for_date(game_date)
                            if week:
                                away = school if away_marker else opponent
                                home = opponent if away_marker else school
                                games.append({
                                    "date": game_date.isoformat(),
                                    "week": week,
                                    "away_team": away,
                                    "home_team": home,
                                    "kickoff_at": kickoff_iso(game_date, dm.group(3)),
                                })
                    i += 1
                    continue
                parts.append(lines[i])
                i += 1
            continue
        i += 1

    unique = {}
    for game in games:
        key = matchup_key(game["date"], game["away_team"], game["home_team"])
        prior = unique.get(key)
        if prior:
            if (
                team_key(prior["away_team"]) != team_key(game["away_team"])
                or team_key(prior["home_team"]) != team_key(game["home_team"])
            ):
                raise RuntimeError(
                    f"Official VHSL venue conflict: {prior['away_team']} at "
                    f"{prior['home_team']} vs {game['away_team']} at {game['home_team']}"
                )
            if prior["kickoff_at"] != game["kickoff_at"]:
                raise RuntimeError(
                    f"Official VHSL kickoff conflict for "
                    f"{game['away_team']} at {game['home_team']}"
                )
        else:
            unique[key] = game

    # Explicit regression anchors from the official schedule/alignment.
    if teams.get(team_key("Huguenot")) != (4, "B"):
        raise RuntimeError(f"Expected Huguenot 4B, got {teams.get(team_key('Huguenot'))}")
    if teams.get(team_key("Strasburg")) != (2, "B"):
        raise RuntimeError(f"Expected Strasburg 2B, got {teams.get(team_key('Strasburg'))}")

    now = datetime.now(tz=ZoneInfo("UTC")).isoformat()
    rows = []
    for game in unique.values():
        away_meta = teams.get(team_key(game["away_team"]))
        home_meta = teams.get(team_key(game["home_team"]))
        rows.append({
            "season": SEASON,
            "week": game["week"],
            "away_team": game["away_team"],
            "home_team": game["home_team"],
            "kickoff_at": game["kickoff_at"],
            "sport": "football",
            "away_class": f"Class {away_meta[0]}" if away_meta else None,
            "away_region": f"Region {away_meta[1]}" if away_meta else None,
            "home_class": f"Class {home_meta[0]}" if home_meta else None,
            "home_region": f"Region {home_meta[1]}" if home_meta else None,
            "source": SOURCE,
            "source_game_id": stable_source_id(
                game["date"], game["away_team"], game["home_team"]
            ),
            "source_url": PAGE_URL,
            "synced_at": now,
            "sync_status": "scheduled",
        })

    # A varsity school should not have multiple official games in one VHSL week.
    team_week = defaultdict(list)
    for row in rows:
        for team in (row["away_team"], row["home_team"]):
            team_week[(row["week"], team_key(team))].append(row)
    conflicts = [x for x in team_week.items() if len(x[1]) > 1]
    if conflicts:
        sample = "; ".join(
            f"W{week} {team}: " + " | ".join(
                f"{g['away_team']} at {g['home_team']}" for g in found
            )
            for (week, team), found in conflicts[:10]
        )
        raise RuntimeError(
            f"Official VHSL schedule produced {len(conflicts)} team-week conflicts: {sample}"
        )

    jm = [
        row for row in rows
        if row["week"] == 6
        and {team_key(row["away_team"]), team_key(row["home_team"])}
        == {team_key("John Marshall"), team_key("Woodbridge")}
    ]
    if (
        len(jm) != 1
        or team_key(jm[0]["away_team"]) != team_key("John Marshall")
        or team_key(jm[0]["home_team"]) != team_key("Woodbridge")
    ):
        raise RuntimeError("Expected official Week 6 matchup: John Marshall at Woodbridge.")

    print("Official VHSL source checks: John Marshall @ Woodbridge; Huguenot 4B; Strasburg 2B")
    return rows
