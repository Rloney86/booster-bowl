#!/usr/bin/env python3
"""Quarantine stale Week 6-11 VHSL-imported rows without deleting games or picks."""
import os
import sys
import requests

from sync_vhsl_schedule import SEASON, SOURCE, parse_schedule, validate


def check_response(response, operation):
    if response.ok:
        return
    body = response.text[:2000]
    secret = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if secret:
        body = body.replace(secret, "[REDACTED]")
    raise RuntimeError(
        f"Supabase {operation} failed: HTTP {response.status_code}; response: {body}"
    )


def reconcile():
    rows, quarantined = parse_schedule()
    validate(rows, quarantined)

    verified_source_ids = {row["source_game_id"] for row in rows}
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    response = requests.get(
        (
            f"{base}/rest/v1/games"
            f"?select=id,source,source_game_id,is_final,sync_status,away_team,home_team,week"
            f"&season=eq.{SEASON}&week=gte.6&week=lte.11"
        ),
        headers=headers,
        timeout=45,
    )
    check_response(response, "reconciliation read")
    existing = response.json()

    stale = [
        game
        for game in existing
        if game.get("source") == SOURCE
        and game.get("source_game_id")
        and not game.get("is_final")
        and game.get("source_game_id") not in verified_source_ids
        and game.get("sync_status") != "quarantined"
    ]

    for game in stale:
        response = requests.patch(
            f"{base}/rest/v1/games?id=eq.{game['id']}",
            headers={**headers, "Prefer": "return=minimal"},
            json={"sync_status": "quarantined"},
            timeout=45,
        )
        check_response(response, f"quarantine game id {game['id']}")
        print(
            f"Quarantined W{game['week']} VHSL-imported game {game['id']}: "
            f"{game['away_team']} at {game['home_team']}"
        )

    print(
        f"Schedule reconciliation complete: {len(stale)} stale VHSL-imported rows quarantined; "
        "manual/unrelated rows, final games, and all pick records preserved."
    )


if __name__ == "__main__":
    try:
        reconcile()
    except Exception as exc:
        print(f"Schedule reconciliation failed: {exc}", file=sys.stderr)
        sys.exit(1)
