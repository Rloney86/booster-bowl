#!/usr/bin/env python3
"""Sync remaining 2026 VHSL Class 2-6 varsity football schedules into Supabase."""
import hashlib
import os
import re
import sys
from collections import Counter
from datetime import date, datetime
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

SEASON = 2026
SOURCE = "VirginiaPreps / On3"
SOURCE_URL = "https://www.on3.com/sites/virginia-preps/news/2026-vhsl-football-team-by-team-schedules-with-results/"
TARGET_CLASSES = {2, 3, 4, 5, 6}
MONTHS = {"Sep": 9, "Oct": 10, "Nov": 11}
WEEK_WINDOWS = {
    6: (date(2026, 9, 28), date(2026, 10, 4)),
    7: (date(2026, 10, 5), date(2026, 10, 11)),
    8: (date(2026, 10, 12), date(2026, 10, 18)),
    9: (date(2026, 10, 19), date(2026, 10, 25)),
    10: (date(2026, 10, 26), date(2026, 11, 1)),
    11: (date(2026, 11, 2), date(2026, 11, 8)),
}

def clean(value):
    return re.sub(r"\s+", " ", value.replace("’", "'").replace("–", "-").replace("—", "-")).strip()

def week_for_date(game_date):
    for week, (start, end) in WEEK_WINDOWS.items():
        if start <= game_date <= end:
            return week
    return None

def display_team(value):
    value = clean(value)
    value = re.sub(r"\s*\(\d+\s+games?\)\s*$", "", value, flags=re.I)
    if value == value.upper(): value = value.title()
    value = re.sub(r"'S\b", "'s", value)
    for old, new in {"J.r.":"J.R.","L.c.":"L.C.","C.d.":"C.D.","I.c.":"I.C.","C.g.":"C.G."}.items(): value=value.replace(old,new)
    return value

def team_key(value):
    value = clean(value).lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()

def stable_source_id(game_date, away, home):
    return hashlib.sha256(f"{SEASON}|{game_date}|{team_key(away)}|{team_key(home)}".encode()).hexdigest()[:32]

def looks_like_team_heading(line):
    candidate = re.sub(r"\s*\(\d+\s+games?\)\s*$", "", line, flags=re.I).strip()
    if not candidate or len(candidate)>70 or re.match(r"^(W|L|TIE|SEP|OCT|NOV)\b",candidate,re.I): return False
    if candidate.upper().startswith(("REGION ","CLASS ")): return False
    if any(word in candidate.upper() for word in ("SCHEDULE","RESULT","SCOREBOARD","FOOTBALL")): return False
    letters=re.sub(r"[^A-Za-z]","",candidate)
    return bool(letters) and candidate==candidate.upper()

def parse_schedule():
    response=requests.get(SOURCE_URL,timeout=45,headers={"User-Agent":"BoosterBowlScheduleSync/2.0"}); response.raise_for_status()
    soup=BeautifulSoup(response.text,"html.parser"); article=soup.find("article") or soup
    lines=[clean(x) for x in article.get_text("\n").splitlines() if clean(x)]
    current_class=current_region=current_team=None; teams={}; raw_games=[]
    for line in lines:
        m=re.fullmatch(r"CLASS\s+([1-6]):?",line.upper())
        if m: current_class=int(m.group(1)); current_region=None; current_team=None; continue
        m=re.fullmatch(r"REGION\s+([1-6])([A-D])",line.upper())
        if m: current_class=int(m.group(1)); current_region=m.group(2); current_team=None; continue
        if current_class not in TARGET_CLASSES: continue
        if looks_like_team_heading(line):
            current_team=display_team(line); teams[team_key(current_team)]=(current_class,current_region); continue
        if not current_team: continue
        m=re.match(r"^(Sep|Oct|Nov)\s+(\d{1,2}),\s+(.+)$",line,re.I)
        if not m: continue
        month,day,opponent_text=m.groups(); opponent_text=clean(opponent_text)
        if re.search(r"\b(canceled|cancelled|ppd\.?|susp\.?|postponed)\b",opponent_text,re.I): continue
        opponent_text=re.sub(r",\s*.*$","",opponent_text).strip(); is_away=opponent_text.lower().startswith("at ")
        opponent=display_team(opponent_text[3:].strip() if is_away else opponent_text)
        game_date=date(SEASON,MONTHS[month.title()],int(day)); week=week_for_date(game_date)
        if not week: continue
        raw_games.append({"date":game_date.isoformat(),"week":week,"away_team":opponent if is_away else current_team,"home_team":current_team if is_away else opponent})
    unique={}
    for game in raw_games: unique[(game["date"],team_key(game["away_team"]),team_key(game["home_team"]))]=game
    now_iso=datetime.now(tz=ZoneInfo("UTC")).isoformat(); rows=[]
    for game in unique.values():
        away_meta=teams.get(team_key(game["away_team"])); home_meta=teams.get(team_key(game["home_team"]))
        kickoff=datetime.fromisoformat(game["date"]+"T19:00:00").replace(tzinfo=ZoneInfo("America/New_York")).isoformat()
        rows.append({"season":SEASON,"week":game["week"],"away_team":game["away_team"],"home_team":game["home_team"],"kickoff_at":kickoff,"sport":"football","away_class":f"Class {away_meta[0]}" if away_meta else None,"away_region":f"Region {away_meta[1]}" if away_meta and away_meta[1] else None,"home_class":f"Class {home_meta[0]}" if home_meta else None,"home_region":f"Region {home_meta[1]}" if home_meta and home_meta[1] else None,"source":SOURCE,"source_game_id":stable_source_id(game["date"],game["away_team"],game["home_team"]),"source_url":SOURCE_URL,"synced_at":now_iso,"sync_status":"scheduled"})
    return rows

def validate(rows):
    if not rows: raise RuntimeError("No Week 6-11 Class 2-6 games were parsed.")
    counts=Counter(row["week"] for row in rows); missing=[w for w in WEEK_WINDOWS if counts[w]==0]
    if missing: raise RuntimeError(f"Parser returned zero games for week(s): {missing}")
    if len(rows)<150: raise RuntimeError(f"Only {len(rows)} unique games parsed; expected a statewide slate. Refusing live sync.")
    classified=sum(1 for row in rows if row.get("away_class") or row.get("home_class"))
    if classified<int(len(rows)*.90): raise RuntimeError(f"Only {classified}/{len(rows)} games have at least one Class 2-6 team; refusing sync.")
    return counts

def check_response(response, operation):
    if response.ok: return
    body=response.text[:2000]
    # Supabase errors do not echo credentials, but defensively redact configured secrets.
    for secret in (os.getenv("SUPABASE_SERVICE_ROLE_KEY"),):
        if secret: body=body.replace(secret,"[REDACTED]")
    raise RuntimeError(f"Supabase {operation} failed: HTTP {response.status_code}; response: {body}")

def sync(rows):
    base_url=os.environ["SUPABASE_URL"].rstrip("/"); key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers={"apikey":key,"Authorization":f"Bearer {key}","Content-Type":"application/json"}
    response=requests.get(f"{base_url}/rest/v1/games?select=id,season,week,away_team,home_team,source_game_id,is_final&season=eq.{SEASON}&week=gte.6&week=lte.11",headers=headers,timeout=45)
    check_response(response,"initial games read"); existing=response.json()
    by_source={row.get("source_game_id"):row for row in existing if row.get("source_game_id")}
    by_matchup={(row["week"],team_key(row["away_team"]),team_key(row["home_team"])):row for row in existing}
    created=updated=skipped_final=0
    for row in rows:
        existing_row=by_source.get(row["source_game_id"]) or by_matchup.get((row["week"],team_key(row["away_team"]),team_key(row["home_team"])))
        if existing_row and existing_row.get("is_final"): skipped_final+=1; continue
        if existing_row:
            resp=requests.patch(f"{base_url}/rest/v1/games?id=eq.{existing_row['id']}",headers={**headers,"Prefer":"return=minimal"},json=row,timeout=45); operation=f"update game id {existing_row['id']}"; updated+=1
        else:
            resp=requests.post(f"{base_url}/rest/v1/games",headers={**headers,"Prefer":"return=minimal"},json=row,timeout=45); operation=f"create {row['away_team']} at {row['home_team']} (week {row['week']})"; created+=1
        check_response(resp,operation)
    return created,updated,skipped_final

def main():
    rows=parse_schedule(); counts=validate(rows)
    print(f"Parsed {len(rows)} unique Week 6-11 games."); print("Games by week:",", ".join(f"W{w}={counts[w]}" for w in sorted(counts)))
    class_region=Counter()
    for row in rows:
        for cv,rv in ((row.get("away_class"),row.get("away_region")),(row.get("home_class"),row.get("home_region"))):
            if cv: class_region[f"{cv}{(rv or '').replace('Region ','')}"]+=1
    print("Classification coverage:",", ".join(f"{k}:{v}" for k,v in sorted(class_region.items())))
    if os.getenv("DRY_RUN")=="1":
        for row in rows[:25]: print(row)
        print("DRY_RUN complete. Supabase was not changed."); return
    created,updated,skipped_final=sync(rows); print(f"Supabase sync complete: {created} created, {updated} updated, {skipped_final} finalized rows preserved.")

if __name__=="__main__":
    try: main()
    except Exception as exc:
        print(f"Schedule sync failed: {exc}",file=sys.stderr); sys.exit(1)
