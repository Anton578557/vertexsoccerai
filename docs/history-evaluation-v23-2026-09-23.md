# Vertex 2.3: data coverage and forecast evaluation

## Changes

- Current OpenLigaDB season catalogues resolve German league clubs, identifiers, crests and fixtures. `Germany Liga 3`, `3. Liga` and `German 3. Liga` resolve to the same competition. Reserves remain separate identities.
- Added provider abbreviations and RU names for clubs found in the independent coverage audit. Exact aliases supplement provider directories; partial city names do not identify a club.
- History fallback continues toward 8 recent form matches and 12 extended matches per team. A provider bundle includes both teams, advanced form and provenance. More than seven days older history cannot replace a fresh bundle just for a larger sample. Missing opponent statistics do not earn quality points.
- Non-football namesakes and other squads are excluded from news. News connection status alone does not earn quality points. The report explicitly distinguishes missing confirmed lineups/full injury coverage from an injury-free squad.
- Rest/congestion adjustments require an imminent confirmed kickoff and dated history. Comparisons and distant fixtures do not receive a presumed recovery advantage.
- First pre-kickoff probability snapshots are immutable and versioned. Evaluation uses confirmed regulation-time results for the same teams/date, with Football-Data, OpenLigaDB, Football-Data.co.uk and BSD fallbacks. Live/extra-time-only scores cannot settle a forecast.
- Protected Vercel Cron runs daily at 03:17 UTC, independently of visitors. Pending checks rotate, source/status/time are recorded, and summaries separate model versions and selected-event scores from full 1X2 Brier scores.

## Rollout

Additive Supabase migration: `20260923203726_versioned_forecast_evaluation.sql`. Existing rows and predictions preserved; historical unversioned records are explicitly labelled legacy. Production cron secret stored only in Vercel environment settings.

Tests cover source replacement/freshness, aliases, reserve-team identity, catalogue lookup, news filtering, quality, rest timing, immutable snapshots, final-result fallback, nonempty date ranges, cron authorization and probability invariants.

Independent post-deployment sample fixed before running: Coventry City–Brighton, Rayo Vallecano–Espanyol, Porto–Benfica, Vissel Kobe–V-Varen Nagasaki. Selected reproducibly from the last 25 scored rows in E0/SP1/P1/JPN with seed `vertex-v23-20260923-independent`. These are team comparisons unless a future fixture is independently resolved; selecting a completed pair is not an out-of-sample accuracy test.

This release repairs data handling. No predictive-accuracy claim or coefficient optimization is justified by passing software tests; prospective versioned outcomes must accumulate first. Confirmed lineups, complete injuries and granular event coverage still depend on each provider/league.
