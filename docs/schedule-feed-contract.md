# Booster Bowl schedule feed contract

The automated sync endpoint expects a JSON response shaped like this:

```json
{
  "source": "provider-name",
  "season": 2026,
  "week": 1,
  "games": [
    {
      "source_game_id": "provider-unique-game-id",
      "away_team": "Cosby",
      "home_team": "Manchester",
      "kickoff_at": "2026-09-18T23:00:00Z",
      "sport": "football",
      "district": "Dominion",
      "away_class": "Class 6",
      "away_region": "Region A",
      "home_class": "Class 6",
      "home_region": "Region A",
      "is_featured": false,
      "away_score": null,
      "home_score": null,
      "is_final": false,
      "source_url": "https://provider.example/game/123"
    }
  ]
}
```

## Required fields

At the top level:

- `season`
- `week`
- `games`

For each game:

- `source_game_id` (or `id`)
- `away_team` (or `away`)
- `home_team` (or `home`)

## Why source_game_id matters

Booster Bowl upserts on `(source, source_game_id)`. Re-running the sync updates the same game rather than creating a duplicate.

## Results updates

The same feed can later return:

- `away_score`
- `home_score`
- `is_final: true`

That lets the existing winner/scoring trigger update player results without creating a second game row.

## Environment variables

Production sync expects:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `SCHEDULE_FEED_URL`
- optional `SCHEDULE_FEED_TOKEN`
- optional `SCHEDULE_FEED_NAME`

Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, or provider tokens to browser code.
