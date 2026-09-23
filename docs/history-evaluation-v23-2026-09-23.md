# Vertex 2.3: data coverage and forecast evaluation

## Changes

- Current OpenLigaDB season catalogues resolve German league clubs, identifiers, crests and fixtures. `Germany Liga 3`, `3. Liga` and `German 3. Liga` resolve to the same competition. Reserves remain separate identities.
- Missing metadata can be recovered from an exact Football-Data team ID already present in the match feed. The club country comes from its team resource, not the opponent or competition area. This repairs the Brighton search collision with the women's team and allows subsequent history fallbacks.
- Added provider abbreviations and RU names for clubs found in the independent coverage audit. Exact aliases supplement provider directories; partial city names do not identify a club.
- History fallback continues toward 8 recent form matches and 12 extended matches per team. A provider bundle includes both teams, advanced form and provenance. More than seven days older history cannot replace a fresh bundle just for a larger sample. Missing opponent statistics do not earn quality points.
- Non-football namesakes and other squads are excluded from news. News connection status alone does not earn quality points. The report explicitly distinguishes missing confirmed lineups/full injury coverage from an injury-free squad.
- Live random checks additionally exposed owner/business profiles, scouting rumors and incidental opponent-injury headlines. These are excluded; old match previews expire after 72 hours. Final limitations are rebuilt after history recovery rather than retaining an earlier provider's short sample warning.
- Rest/congestion adjustments require an imminent confirmed kickoff and dated history. Comparisons and distant fixtures do not receive a presumed recovery advantage.
- First pre-kickoff probability snapshots are immutable and versioned. Evaluation uses confirmed regulation-time results for the same teams/date, with Football-Data, OpenLigaDB, Football-Data.co.uk and BSD fallbacks. Live/extra-time-only scores cannot settle a forecast.
- Protected Vercel Cron is configured daily at 03:17 UTC (Hobby uses a flexible one-hour window), independently of visitors. The documented Vercel user agent selects maintenance, with mandatory secret validation, and the shared endpoint cannot be served from CDN cache. Pending checks rotate, source/status/time are recorded, and summaries separate model versions and selected-event scores from full 1X2 Brier scores.

## Rollout

Additive Supabase migration: `20260923203726_versioned_forecast_evaluation.sql`. Existing rows and predictions preserved; historical unversioned records are explicitly labelled legacy. Production cron secret stored only in Vercel environment settings.

Tests cover source replacement/freshness, aliases, reserve-team identity, catalogue lookup, news filtering, quality, rest timing, immutable snapshots, final-result fallback, nonempty date ranges, cron authorization and probability invariants.

Independent post-deployment sample fixed before running: Coventry City–Brighton, Rayo Vallecano–Espanyol, Porto–Benfica, Vissel Kobe–V-Varen Nagasaki. Selected reproducibly from the last 25 scored rows in E0/SP1/P1/JPN with seed `vertex-v23-20260923-independent`. These are team comparisons unless a future fixture is independently resolved; selecting a completed pair is not an out-of-sample accuracy test.

This release repairs data handling. No predictive-accuracy claim or coefficient optimization is justified by passing software tests; prospective versioned outcomes must accumulate first. Confirmed lineups, complete injuries and granular event coverage still depend on each provider/league.

## Initial production verification

Production commit `684147d` / deployment `Cq9G6gspD7AYo3EiJMTr4Da2fudP` was Ready. Russian Wehen–Aachen recovered 8+8 form matches and 12+12 dated history entries through OpenLigaDB, with both crests loaded. Hoffenheim II–Meppen recovered 8+7; Rayo–Espanyol, Porto–Benfica and Vissel Kobe–V-Varen Nagasaki recovered 8+8. Coventry–Brighton exposed the missing metadata issue above (initially 5+5). Santa Clara's NFL/county articles were absent. V-Varen's crest remains unavailable in the currently returning metadata; initials are shown instead of a broken image.

Authenticated maintenance smoke test: HTTP 200, 4 fixtures checked, 12 newly evaluated market records across 3 finished matches, one unresolved legacy fixture left pending. Unauthenticated maintenance: HTTP 401. Total historical evaluated sample after this run: only 4 fixtures; these predate versioned snapshots and are labelled legacy, not attributed to version 2.3. Daily 03:17 UTC is configured; the first scheduled run is still in the future at verification time.
