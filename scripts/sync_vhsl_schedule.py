#!/usr/bin/env python3
"""Sync remaining 2026 VHSL Class 2-6 varsity football schedules into Supabase."""
import hashlib, os, re, sys
from collections import Counter, defaultdict
from datetime import date, datetime
from zoneinfo import ZoneInfo
import requests
from bs4 import BeautifulSoup

SEASON=2026
SOURCE="VirginiaPreps / On3"
SOURCE_URL="https://www.on3.com/sites/virginia-preps/news/2026-vhsl-football-team-by-team-schedules-with-results/"
TARGET_CLASSES={2,3,4,5,6}
MONTHS={"Sep":9,"Oct":10,"Nov":11}
WEEK_WINDOWS={6:(date(2026,9,28),date(2026,10,4)),7:(date(2026,10,5),date(2026,10,11)),8:(date(2026,10,12),date(2026,10,18)),9:(date(2026,10,19),date(2026,10,25)),10:(date(2026,10,26),date(2026,11,1)),11:(date(2026,11,2),date(2026,11,8))}

TEAM_DISPLAY_ALIASES={
    "james river midlothian":"James River (Chesterfield)",
    "james river chesterfield":"James River (Chesterfield)",
}

def clean(v): return re.sub(r"\s+"," ",v.replace("’","'").replace("–","-").replace("—","-")).strip()
def week_for_date(d):
    for w,(a,b) in WEEK_WINDOWS.items():
        if a<=d<=b:return w

def display_team(v):
    v=clean(v);v=re.sub(r"\s*\(\d+\s+games?\)\s*$","",v,flags=re.I)
    if v==v.upper():v=v.title()
    v=re.sub(r"'S\b","'s",v)
    for a,b in {"J.r.":"J.R.","L.c.":"L.C.","C.d.":"C.D.","I.c.":"I.C.","C.g.":"C.G."}.items():v=v.replace(a,b)
    alias_key=re.sub(r"\s+"," ",re.sub(r"[^a-z0-9]+"," ",v.lower())).strip()
    return TEAM_DISPLAY_ALIASES.get(alias_key,v)

def team_key(v): return re.sub(r"\s+"," ",re.sub(r"[^a-z0-9]+"," ",clean(v).lower())).strip()
def matchup_key(d,a,b):
    t=sorted((team_key(a),team_key(b)));return(str(d),t[0],t[1])
def stable_source_id(d,a,b): return hashlib.sha256(f"{SEASON}|{'|'.join(matchup_key(d,a,b))}".encode()).hexdigest()[:32]
def looks_like_team_heading(line):
    c = re.sub(r"\s*\(\d+\s+games?\)\s*$", "", line, flags=re.I).strip()
    if not c or len(c) > 70:
        return False
    if re.match(r"^(?:W|L|TIE)(?:\s|$)|^(?:SEP|OCT|NOV)\b", c, re.I):
        return False
    if c.upper().startswith(("REGION ", "CLASS ")):
        return False
    if any(x in c.upper() for x in ("SCHEDULE", "RESULT", "SCOREBOARD", "FOOTBALL")):
        return False
    heading = re.sub(r"^Mc(?=[A-Z])", "MC", c)
    return bool(re.sub(r"[^A-Za-z]", "", c)) and heading == heading.upper()

def parse_schedule():
    r=requests.get(SOURCE_URL,timeout=45,headers={"User-Agent":"BoosterBowlScheduleSync/4.0"});r.raise_for_status()
    soup=BeautifulSoup(r.text,"html.parser");article=soup.find("article") or soup
    lines=[clean(x) for x in article.get_text("\n").splitlines() if clean(x)]
    current_class=current_region=current_team=None;teams={};raw=[]
    for line in lines:
        m=re.fullmatch(r"CLASS\s+([1-6]):?",line.upper())
        if m:current_class=int(m.group(1));current_region=None;current_team=None;continue
        m=re.fullmatch(r"REGION\s+([1-6])([A-D])",line.upper())
        if m:current_class=int(m.group(1));current_region=m.group(2);current_team=None;continue
        if current_class not in TARGET_CLASSES:continue
        if looks_like_team_heading(line):current_team=display_team(line);teams[team_key(current_team)]=(current_class,current_region);continue
        if not current_team:continue
        m=re.match(r"^(Sep|Oct|Nov)\s+(\d{1,2}),\s+(.+)$",line,re.I)
        if not m:continue
        month,day,opp=m.groups();opp=clean(opp)
        if re.search(r"\b(canceled|cancelled|ppd\.?|susp\.?|postponed)\b",opp,re.I):continue
        opp=re.sub(r",\s*.*$","",opp).strip();away=opp.lower().startswith("at ");opponent=display_team(opp[3:].strip() if away else opp)
        gd=date(SEASON,MONTHS[month.title()],int(day));week=week_for_date(gd)
        if week:raw.append({"date":gd.isoformat(),"week":week,"away_team":current_team if away else opponent,"home_team":opponent if away else current_team,"listed_by":current_team})

    grouped=defaultdict(list)
    for game in raw:grouped[matchup_key(game["date"],game["away_team"],game["home_team"])].append(game)
    verified=[];quarantined=[]
    for key,listings in grouped.items():
        sample=listings[0]
        akey=team_key(sample["away_team"]);hkey=team_key(sample["home_team"])
        known_pair=akey in teams and hkey in teams
        listers={team_key(x["listed_by"]) for x in listings}
        orientations={(team_key(x["away_team"]),team_key(x["home_team"])) for x in listings}
        if len(orientations)>1:
            quarantined.append(("home/away disagreement",listings));continue
        if known_pair and not {akey,hkey}.issubset(listers):
            quarantined.append(("missing reciprocal team listing",listings));continue
        verified.append(sample)

    # A team cannot play two varsity games in one VHSL week. Rather than fail the
    # entire statewide import, quarantine every still-conflicting matchup. This is
    # deliberately conservative: ambiguous games never reach Supabase.
    team_week=defaultdict(list)
    for game in verified:
        for team in (game["away_team"],game["home_team"]):
            team_week[(game["week"],team_key(team))].append(game)
    conflict_ids=set()
    for games in team_week.values():
        if len(games)>1:
            conflict_ids.update(id(g) for g in games)
    if conflict_ids:
        keep=[]
        for game in verified:
            if id(game) in conflict_ids:
                quarantined.append(("team-week conflict",[game]))
            else:
                keep.append(game)
        verified=keep

    if quarantined:
        print(f"WARNING: {len(quarantined)} unverified matchups quarantined; they will NOT be synced:",file=sys.stderr)
        for reason,listings in quarantined:
            g=listings[0];who=", ".join(sorted({x['listed_by'] for x in listings}))
            print(f"  W{g['week']} {g['date']}: {g['away_team']} at {g['home_team']} [{reason}; listed by: {who}]",file=sys.stderr)

    now=datetime.now(tz=ZoneInfo("UTC")).isoformat();rows=[]
    for game in verified:
        am=teams.get(team_key(game["away_team"]));hm=teams.get(team_key(game["home_team"]));kick=datetime.fromisoformat(game["date"]+"T19:00:00").replace(tzinfo=ZoneInfo("America/New_York")).isoformat()
        rows.append({"season":SEASON,"week":game["week"],"away_team":game["away_team"],"home_team":game["home_team"],"kickoff_at":kick,"sport":"football","away_class":f"Class {am[0]}" if am else None,"away_region":f"Region {am[1]}" if am and am[1] else None,"home_class":f"Class {hm[0]}" if hm else None,"home_region":f"Region {hm[1]}" if hm and hm[1] else None,"source":SOURCE,"source_game_id":stable_source_id(game["date"],game["away_team"],game["home_team"]),"source_url":SOURCE_URL,"synced_at":now,"sync_status":"scheduled"})
    return rows,quarantined

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

def validate(rows,quarantined):
    if not rows:raise RuntimeError("No Week 6-11 Class 2-6 games were parsed.")
    counts=Counter(r["week"] for r in rows);missing=[w for w in WEEK_WINDOWS if counts[w]==0]
    if missing:raise RuntimeError(f"Parser returned zero games for week(s): {missing}")
    suspicious=varsity_conflicts(rows)
    if suspicious:
        print(f"WARNING: {len(suspicious)} team-week conflicts remain after quarantine:",file=sys.stderr)
        for w,t,games in suspicious:print(f"  W{w} {t}: {' | '.join(games)}",file=sys.stderr)
        raise RuntimeError(f"Schedule verification required before Supabase write: {len(suspicious)} team-week conflicts remain.")
    jm=[r for r in rows if r["week"]==6 and {team_key(r["away_team"]),team_key(r["home_team"])}=={team_key("John Marshall"),team_key("Woodbridge")}]
    if len(jm)!=1 or team_key(jm[0]["away_team"])!=team_key("John Marshall") or team_key(jm[0]["home_team"])!=team_key("Woodbridge"):raise RuntimeError("Venue validation failed: expected John Marshall at Woodbridge in Week 6.")
    print("Venue check: John Marshall at Woodbridge OK")
    print(f"Verification quarantine: {len(quarantined)} questionable matchups excluded from sync.")
    if len(rows)<150:raise RuntimeError(f"Only {len(rows)} verified games remain; expected statewide slate. Refusing live sync.")
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
    rows,quarantined=parse_schedule();counts=validate(rows,quarantined)
    print(f"Parsed {len(rows)} verified unique Week 6-11 games.");print("Games by week:",", ".join(f"W{w}={counts[w]}" for w in sorted(counts)))
    if os.getenv("DRY_RUN")=="1":print("DRY_RUN complete. Supabase was not changed.");return
    c,u,f=sync(rows);print(f"Supabase sync complete: {c} created, {u} updated, {f} finalized rows preserved.")

if __name__=="__main__":
    try:main()
    except Exception as exc:print(f"Schedule sync failed: {exc}",file=sys.stderr);sys.exit(1)
