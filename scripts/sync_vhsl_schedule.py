#!/usr/bin/env python3
"""Sync verified 2026 VHSL Class 2-6 varsity football schedules into Supabase."""
import hashlib, os, re, sys
from collections import Counter, defaultdict
from datetime import date, datetime
from zoneinfo import ZoneInfo
import requests
from vhsl_official_source import parse_official_schedule

SEASON=2026
SOURCE="VirginiaPreps / On3"
SOURCE_URL="https://www.on3.com/sites/virginia-preps/news/2026-vhsl-football-team-by-team-schedules-with-results/"
OVERRIDES_PATH=Path(__file__).resolve().parents[1]/"data"/"vhsl_schedule_overrides.json"
TARGET_CLASSES={2,3,4,5,6}
MONTHS={"Sep":9,"Oct":10,"Nov":11}
WEEK_WINDOWS={6:(date(2026,9,28),date(2026,10,4)),7:(date(2026,10,5),date(2026,10,11)),8:(date(2026,10,12),date(2026,10,18)),9:(date(2026,10,19),date(2026,10,25)),10:(date(2026,10,26),date(2026,11,1)),11:(date(2026,11,2),date(2026,11,8))}

def clean(v): return re.sub(r"\s+"," ",v.replace("’","'").replace("–","-").replace("—","-")).strip()
def team_key(v): return re.sub(r"\s+"," ",re.sub(r"[^a-z0-9]+"," ",clean(v).lower())).strip()
def week_for_date(d):
    for w,(a,b) in WEEK_WINDOWS.items():
        if a<=d<=b:return w

def display_team(v):
    v=clean(v);v=re.sub(r"\s*\(\d+\s+games?\)\s*$","",v,flags=re.I)
    if v==v.upper():v=v.title()
    v=re.sub(r"'S\b","'s",v)
    for a,b in {"J.r.":"J.R.","L.c.":"L.C.","C.d.":"C.D.","I.c.":"I.C.","C.g.":"C.G."}.items():v=v.replace(a,b)
    return v

def matchup_key(d,a,b):
    t=sorted((team_key(a),team_key(b)));return(str(d),t[0],t[1])
def stable_source_id(d,a,b): return hashlib.sha256(f"{SEASON}|{'|'.join(matchup_key(d,a,b))}".encode()).hexdigest()[:32]
def looks_like_team_heading(line):
    c=re.sub(r"\s*\(\d+\s+games?\)\s*$","",line,flags=re.I).strip()
    if not c or len(c)>70 or re.match(r"^(W|L|TIE|SEP|OCT|NOV)\b",c,re.I):return False
    if c.upper().startswith(("REGION ","CLASS ")):return False
    if any(x in c.upper() for x in ("SCHEDULE","RESULT","SCOREBOARD","FOOTBALL")):return False
    letters=re.sub(r"[^A-Za-z]","",c);return bool(letters) and c==c.upper()

def load_overrides():
    if not OVERRIDES_PATH.exists():return []
    data=json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    if data.get("season")!=SEASON:raise RuntimeError(f"Override registry season must be {SEASON}.")
    return data.get("overrides",[])

def override_matches(game,rule):
    if rule.get("week") and game["week"]!=rule["week"]:return False
    if rule.get("date") and game["date"]!=rule["date"]:return False
    wanted={team_key(x) for x in rule.get("matchup",[])}
    actual={team_key(game["away_team"]),team_key(game["home_team"])}
    return len(wanted)==2 and wanted==actual

def apply_overrides(raw):
    rules=load_overrides();out=[];hits=Counter()
    for game in raw:
        current=dict(game);excluded=False
        for i,rule in enumerate(rules):
            if not override_matches(current,rule):continue
            action=rule.get("action")
            if action=="exclude":excluded=True;hits[i]+=1;break
            if action=="replace":
                for field in ("date","away_team","home_team"):
                    if rule.get(field):current[field]=rule[field]
                gd=date.fromisoformat(current["date"]);current["week"]=week_for_date(gd)
                if not current["week"]:raise RuntimeError(f"Override moved game outside supported weeks: {rule}")
                hits[i]+=1
            else:raise RuntimeError(f"Unknown override action: {action}")
        if not excluded:out.append(current)
    for i,rule in enumerate(rules):
        if not hits[i]:raise RuntimeError(f"Verified schedule override matched no source rows: {rule}")
        print(f"Override applied ({hits[i]} source row(s)): {rule.get('reason','verified schedule correction')}")
    return out

def parse_schedule():
    # Official VHSL master schedule is now authoritative for varsity matchups,
    # dates, kickoff times, home/away orientation, and class/region metadata.
    return parse_official_schedule(), []

def varsity_conflicts(rows):
    tw=defaultdict(list)
    for r in rows:
        for team in (r["away_team"],r["home_team"]):tw[(r["week"],team_key(team))].append(r)
    out=[]
    for (week,key),games in tw.items():
        if len(games)>1:
            team=next(t for t in (games[0]["away_team"],games[0]["home_team"]) if team_key(t)==key)
            out.append((week,team,sorted(f"{str(g['kickoff_at'])[:10]} {g['away_team']} at {g['home_team']}" for g in games)))
    return out

def validate(rows,homeaway):
    if not rows:raise RuntimeError("No Week 6-11 Class 2-6 games were parsed.")
    counts=Counter(r["week"] for r in rows);missing=[w for w in WEEK_WINDOWS if counts[w]==0]
    if missing:raise RuntimeError(f"Parser returned zero games for week(s): {missing}")
    suspicious=varsity_conflicts(rows)
    if suspicious:
        print(f"WARNING: {len(suspicious)} team-week conflicts (possible JV/duplicate contamination):",file=sys.stderr)
        for w,t,games in suspicious:print(f"  W{w} {t}: {' | '.join(games)}",file=sys.stderr)
    jm=[r for r in rows if r["week"]==6 and {team_key(r["away_team"]),team_key(r["home_team"])}=={team_key("John Marshall"),team_key("Woodbridge")}]
    if len(jm)!=1 or team_key(jm[0]["away_team"])!=team_key("John Marshall") or team_key(jm[0]["home_team"])!=team_key("Woodbridge"):raise RuntimeError("Venue validation failed: expected John Marshall at Woodbridge in Week 6.")
    print("Venue check: John Marshall at Woodbridge OK")
    blockers=[]
    if homeaway:blockers.append(f"{len(homeaway)} unresolved home/away conflicts")
    if suspicious:blockers.append(f"{len(suspicious)} possible JV/duplicate team-week conflicts")
    if blockers:raise RuntimeError("Schedule verification required before Supabase write: "+"; ".join(blockers)+". Add only verified corrections/exclusions to data/vhsl_schedule_overrides.json.")
    if len(rows)<150:raise RuntimeError(f"Only {len(rows)} unique games parsed; expected statewide slate. Refusing live sync.")
    return counts

def check_response(r,op):
    if r.ok:return
    body=r.text[:2000];secret=os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if secret:body=body.replace(secret,"[REDACTED]")
    raise RuntimeError(f"Supabase {op} failed: HTTP {r.status_code}; response: {body}")

def sync(rows):
    base=os.environ["SUPABASE_URL"].rstrip("/");key=os.environ["SUPABASE_SERVICE_ROLE_KEY"];h={"apikey":key,"Authorization":f"Bearer {key}","Content-Type":"application/json"}
    r=requests.get(f"{base}/rest/v1/games?select=id,season,week,away_team,home_team,source_game_id,is_final,kickoff_at&season=eq.{SEASON}&week=gte.6&week=lte.11",headers=h,timeout=45);check_response(r,"initial games read");existing=r.json()
    by_source={x.get("source_game_id"):x for x in existing if x.get("source_game_id")};by_match={matchup_key(str(x.get("kickoff_at") or "")[:10],x["away_team"],x["home_team"]):x for x in existing};created=updated=final=0
    for row in rows:
        old=by_source.get(row["source_game_id"]) or by_match.get(matchup_key(str(row["kickoff_at"])[:10],row["away_team"],row["home_team"]))
        if old and old.get("is_final"):final+=1;continue
        if old:r=requests.patch(f"{base}/rest/v1/games?id=eq.{old['id']}",headers={**h,"Prefer":"return=minimal"},json=row,timeout=45);op=f"update game id {old['id']}";updated+=1
        else:r=requests.post(f"{base}/rest/v1/games",headers={**h,"Prefer":"return=minimal"},json=row,timeout=45);op=f"create {row['away_team']} at {row['home_team']}";created+=1
        check_response(r,op)
    return created,updated,final

def main():
    rows,homeaway=parse_schedule();counts=validate(rows,homeaway)
    print(f"Parsed {len(rows)} verified unique Week 6-11 games.");print("Games by week:",", ".join(f"W{w}={counts[w]}" for w in sorted(counts)))
    if os.getenv("DRY_RUN")=="1":print("DRY_RUN complete. Supabase was not changed.");return
    c,u,f=sync(rows);print(f"Supabase sync complete: {c} created, {u} updated, {f} finalized rows preserved.")

if __name__=="__main__":
    try:main()
    except Exception as exc:print(f"Schedule sync failed: {exc}",file=sys.stderr);sys.exit(1)
