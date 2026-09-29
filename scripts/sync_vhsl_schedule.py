#!/usr/bin/env python3
"""Sync remaining VHSL Class 2-6 varsity football schedules into Supabase.

Source: VirginiaPreps/On3 team-by-team 2026 schedule article. The source is
publicly readable and is refreshed during the season. This importer deliberately
keeps source attribution on every inserted game and only imports Classes 2-6.

Required env vars:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
Optional:
  DRY_RUN=1
"""
import os, re, sys
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

SEASON = 2026
SOURCE_NAME = "VirginiaPreps / On3"
SOURCE_URL = "https://www.on3.com/sites/virginia-preps/news/2026-vhsl-football-team-by-team-schedules-with-results/"
TARGET_CLASSES = {2, 3, 4, 5, 6}
# Booster Bowl numbering requested by product: Oct 2 is Week 6 and Nov 6 Week 11.
WEEK_BY_DATE = {
    "2026-10-01": 6, "2026-10-02": 6, "2026-10-03": 6,
    "2026-10-08": 7, "2026-10-09": 7, "2026-10-10": 7,
    "2026-10-15": 8, "2026-10-16": 8, "2026-10-17": 8,
    "2026-10-22": 9, "2026-10-23": 9, "2026-10-24": 9,
    "2026-10-29": 10, "2026-10-30": 10, "2026-10-31": 10,
    "2026-11-05": 11, "2026-11-06": 11, "2026-11-07": 11,
}
MONTHS = {"Sep": 9, "Oct": 10, "Nov": 11}


def clean(s):
    return re.sub(r"\s+", " ", s.replace("’", "'").replace("–", "-")).strip()


def region_letter(region):
    m = re.search(r"([A-D])$", region or "")
    return m.group(1) if m else ""


def parse_schedule():
    r = requests.get(SOURCE_URL, timeout=30, headers={"User-Agent": "BoosterBowlScheduleSync/1.0"})
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    article = soup.find("article") or soup
    lines = [clean(x) for x in article.get_text("\n").splitlines() if clean(x)]

    current_class = None
    current_region = None
    current_team = None
    teams = {}  # canonical team -> (class number, region letter)
    raw_games = []

    for line in lines:
        m = re.fullmatch(r"CLASS\s+([1-6]):?", line.upper())
        if m:
            current_class = int(m.group(1)); current_region = None; current_team = None
            continue
        m = re.fullmatch(r"REGION\s+([1-6])([A-D])", line.upper())
        if m:
            current_class = int(m.group(1)); current_region = m.group(2); current_team = None
            continue
        if current_class not in TARGET_CLASSES:
            continue

        # Team headings are uppercase text that are not result/schedule/status lines.
        if (line == line.upper() and not re.match(r"^(W|L|TIE|SEP|OCT|NOV)\b", line)
                and len(line) <= 55 and not line.startswith("REGION") and not line.startswith("CLASS")):
            team = re.sub(r"\s*\(\d+\s+games?\)\s*$", "", line, flags=re.I)
            if team and not any(x in team for x in ("SCHEDULE", "RESULT", "HERE", "FOOTBALL")):
                current_team = team.title().replace("J.r.", "J.R.").replace("L.c.", "L.C.").replace("I.c.", "I.C.")
                teams[current_team.lower()] = (current_class, current_region)
            continue

        if not current_team:
            continue
        m = re.match(r"^(Sep|Oct|Nov)\s+(\d{1,2}),\s+(.+)$", line, re.I)
        if not m:
            continue
        month, day, opponent_text = m.groups()
        opponent_text = clean(opponent_text)
        # Ignore explicitly canceled/postponed/suspended entries until a firm date is published.
        if re.search(r"\b(canceled|cancelled|ppd\.?|susp\.?|postponed)\b", opponent_text, re.I):
            continue
        opponent_text = re.sub(r",\s*.*$", "", opponent_text).strip()
        away = opponent_text[3:].strip() if opponent_text.lower().startswith("at ") else current_team
        home = current_team if opponent_text.lower().startswith("at ") else opponent_text
        date = datetime(SEASON, MONTHS[month.title()], int(day)).date().isoformat()
        if date not in WEEK_BY_DATE:
            continue
        raw_games.append({
            "date": date, "week": WEEK_BY_DATE[date], "away_team": away, "home_team": home,
            "anchor_team": current_team, "anchor_class": current_class, "anchor_region": current_region,
        })

    # Dedupe because each in-scope matchup can appear on both teams' schedules.
    games = {}
    for g in raw_games:
        key = (g["date"], g["away_team"].lower(), g["home_team"].lower())
        games[key] = g

    rows = []
    for g in games.values():
        ac = teams.get(g["away_team"].lower())
        hc = teams.get(g["home_team"].lower())
        # 7 PM Eastern is the safest default when the source lists date but not kickoff time.
        kickoff = datetime.fromisoformat(g["date"] + "T19:00:00").replace(tzinfo=ZoneInfo("America/New_York")).isoformat()
        rows.append({
            "season": SEASON,
            "week": g["week"],
            "away_team": g["away_team"],
            "home_team": g["home_team"],
            "kickoff_at": kickoff,
            "sport": "football",
            "away_class": f"Class {ac[0]}" if ac else None,
            "away_region": f"Region {ac[1]}" if ac and ac[1] else None,
            "home_class": f"Class {hc[0]}" if hc else None,
            "home_region": f"Region {hc[1]}" if hc and hc[1] else None,
            "source_name": SOURCE_NAME,
            "source_url": SOURCE_URL,
        })
    return rows


def sync(rows):
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    existing = requests.get(
        f"{url}/rest/v1/games?select=id,season,week,away_team,home_team&season=eq.{SEASON}&week=gte.6&week=lte.11",
        headers=headers, timeout=30,
    )
    existing.raise_for_status()
    by_key = {(x["week"], x["away_team"].lower(), x["home_team"].lower()): x["id"] for x in existing.json()}
    created = updated = 0
    for row in rows:
        k = (row["week"], row["away_team"].lower(), row["home_team"].lower())
        if os.getenv("DRY_RUN") == "1":
            print("UPDATE" if k in by_key else "CREATE", row)
            continue
        if k in by_key:
            resp = requests.patch(f"{url}/rest/v1/games?id=eq.{by_key[k]}", headers=headers, json=row, timeout=30)
            updated += 1
        else:
            resp = requests.post(f"{url}/rest/v1/games", headers={**headers, "Prefer": "return=minimal"}, json=row, timeout=30)
            created += 1
        resp.raise_for_status()
    return created, updated


if __name__ == "__main__":
    rows = parse_schedule()
    if not rows:
        sys.exit("No future Class 2-6 games parsed; refusing to alter the database.")
    print(f"Parsed {len(rows)} unique remaining Class 2-6 games.")
    if os.getenv("DRY_RUN") == "1":
        for row in rows[:20]: print(row)
    else:
        c, u = sync(rows)
        print(f"Supabase sync complete: {c} created, {u} updated.")
