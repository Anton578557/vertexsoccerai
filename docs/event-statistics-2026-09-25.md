# Corners and card statistics integration — 2026-09-25

## Root cause

BSD history requested match result lists only. Those responses contain goals but not the separate `/events/{id}/stats/` payload. Event models therefore depended entirely on Football-Data.co.uk, leaving leagues such as Brazil Série B uncovered even when eight goal-history matches were available.

## Change

- Retain complete Football-Data.co.uk markets; use the existing enabled BSD account for missing corners, yellow-card estimates and red-card history.
- Resolve verified provider identities, collect up to 12 recent completed matches per team, and deduplicate shared fixtures. Exclude current-day, future, extra-time and shootout event statistics.
- Require numeric nonnegative counts. Missing/null is unknown, never zero. Each team's own and opponent counts use the same paired sample.
- Use the existing count model for corners and yellow cards, with at least three paired observations for each team and recent coverage. These are baseline probabilities, not calibrated accuracy claims.
- Red cards remain observed historical frequency, with dates and sample sizes. A short sample cannot establish a reliable pre-match dismissal probability.
- Cache individual statistics for a day and combined samples for five minutes. Limit collection to four concurrent requests, 24 fixtures and a 12-second scheduling budget; stop scheduling on quota/access failures.
- Show independent sample counts and source attribution in RU/EN/ES. Fixed production diagnostic cases report event coverage without exposing forecasts or saving test predictions.

## Verification

Regression checks cover identity, regulation time, absent versus zero values, per-market source merging, free-quota backoff, response validation, compact cache payloads and localized report rendering. Production coverage must still be checked after deployment: provider documentation promises field presence, not complete statistics for every fixture.

Official API contract: https://www.goaldir.com/docs/football/events/
