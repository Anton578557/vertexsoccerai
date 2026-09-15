# Vertex Soccer AI — Production Setup

## Vercel environment variables

Add provider credentials in **Vercel → Project → Settings → Environment Variables**. Never place these values in `script.js` or commit them to GitHub.

Recommended names:

- `API_FOOTBALL_KEY` — API-Sports / API-Football server key. Enables broad form data, upcoming fixtures and Live Match Center.
- `FOOTBALL_DATA_KEY` — football-data.org token. Used as a lower-cost primary/fallback source for supported competitions.
- `OPENWEATHER_KEY` — OpenWeather API key. Venue/city is geocoded server-side and weather is requested by coordinates.
- `NEWSAPI_KEY` — NewsAPI key. Requested server-side via header, never from the browser.
- `THESPORTSDB_KEY` — optional TheSportsDB v1 key. If omitted, development metadata search uses the public `123` key.
- `THESPORTSDB_V2_KEY` — optional premium key for TheSportsDB v2 live scores.

After changing environment variables, redeploy the project so the Serverless Functions receive the new values.

## Important security action

Older revisions of this repository exposed third-party provider keys in browser JavaScript. Those keys must be treated as compromised. Rotate/revoke them at the provider dashboards before putting replacement values into Vercel.

The Supabase publishable/anon client key remains in browser code by design. Security for browser access depends on correct Row Level Security policies.

## Supabase

Existing beta functionality uses Supabase Auth plus the existing `activity` and `reviews` tables.

For the full 2.0 account/history data model, review and run:

`supabase/schema.sql`

This adds:

- `profiles`
- `analysis_history`
- `saved_matches`
- `strategy_profiles`
- `model_evaluations`

## Current provider strategy

1. Team identity / badges / venue metadata: TheSportsDB.
2. Completed-match data: Football-Data when configured; API-Football for wider/deeper coverage.
3. Weather: OpenWeather through server-side coordinates.
4. News: NewsAPI through the server.
5. Live center: API-Football or TheSportsDB premium.
6. Statistical model: Vertex server function; probabilities are calculated from real completed-match scoring rates using a Poisson model. If data is insufficient, the UI withholds the prediction rather than inventing percentages.

## Free beta

Payments and credits are intentionally not part of this release. The product remains free while usage and real model performance are collected.
