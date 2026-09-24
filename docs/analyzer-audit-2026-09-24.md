# Analyzer reliability audit — 24 September 2026

## Confirmed failures and changes

- Input split required spaces on both sides of an ASCII hyphen. A shared parser now accepts `Cambridge United -Wimbledon` and the Russian equivalent while retaining internal club hyphens. Suggestions use the same parser.
- Verified TheSportsDB identities added: Cambridge United 134586, AFC Wimbledon 134241, Atlético Junior 137615, Real Tomayapo 140725. Wimbledon FC (1889) remains a separate identity. RU/ES/EN aliases resolve consistently.
- BSD can identify an exact, unique club without a country filter, checks up to three verified alternate names, and carries country, identity and public crest fallback back to the report. It never chooses a partial-name or ambiguous match.
- Event-statistics caches now preserve home/away order. Paired averages use only rows with both valid counts. English League 1/2 labels map to their correct CSV competitions.
- Historical event counts older than 90 days cannot produce current count-market probabilities, alter goal probabilities or increase the quality index. Card history remains available with dates, sample sizes and an explicit historical label.
- Model 2.4 records these data-eligibility corrections. Goal-model coefficients were not tuned to make scorelines look more varied. No empirical accuracy claim is made.

## Report

Seven views: outcomes, totals, team goals, score scenarios, handicaps/margins, cards, events. The summary shows three score scenarios. Detailed scores include the remaining probability mass. Half-goal handicaps and disjoint winning margins come from the same normalized score distribution.

Yellow cards: count estimates/thresholds only with sufficient recent paired statistics; otherwise dated historical averages. Red cards: observed dismissal frequencies with sample counts, not a fabricated future probability. Zero observed dismissals does not imply zero risk. Missing referee, lineup and card data are explicit. All additions have EN/RU/ES copy.

## Production evidence

The fixed server diagnostics run the actual analysis core without recording test cases as predictions. Cached once daily; public output contains health/coverage only, not arbitrary anonymous analyses.

After identity recovery, observed on production:

| Pair | Identity/crests | Recent completed matches | Result |
| --- | --- | --- | --- |
| Cambridge United — AFC Wimbledon | Both resolved | 8 / 8, BSD | Model available |
| Atlético Nacional — Atlético Junior | Both resolved | 8 / 8, BSD | Model available |
| Real Tomayapo — Nacional Potosí | Both resolved | 1 / 1, TheSportsDB | Withheld; BSD returns empty history |
| Real Betis — Mallorca | Both resolved | 8 / 8, BSD | Model available |

The first production event-stat probe exposed Betis/Mallorca CSV statistics last updated in May. This led to the freshness guard described above; those rows must not be represented as current card forecasts.

Browser checks: Russian second-team suggestions after a one-sided hyphen; choosing AFC Wimbledon preserves the first team. Junior and Real Tomayapo crest URLs both loaded as 512px images. Browser session was signed out, so authenticated submission/result-layout checks were not claimed. Report rendering and escaping checked in all three languages by tests.

## Remaining external limits

- Supabase email concerns explicit grants for newly created public tables from 30 October. Existing public tables were checked: RLS enabled and required service-role CRUD grants present. Existing permissions were not broadened.
- API-Football reports `account_suspended`; RapidAPI reports `quota_exhausted`. ESPN remains explicitly disabled after its earlier access denial. No access controls or paid restrictions were bypassed.
- A working metadata lookup does not mean history or discipline coverage exists. Bolivia has known identities but insufficient returned completed results, so no numerical forecast is invented.
- Own evaluation data: four settled fixtures in older unversioned records, zero settled fixtures carrying model version 2.3 at audit time. This cannot establish predictive accuracy for 2.4.

## Verification

111 tests pass, including the reported parser cases, ambiguous identities, BSD alias/country recovery, directional cache, paired missing values, red-card zero/missing distinction, stale-stat isolation, probability conservation, complementary/monotone handicaps, localized report output and diagnostics envelope.

Primary references used to verify identities and free endpoints:
- https://www.thesportsdb.com/documentation
- https://www.thesportsdb.com/team/134586-cambridge-united
- https://www.thesportsdb.com/team/134241-AFC-Wimbledon
- https://www.thesportsdb.com/team/137615-atletico-junior
- https://www.thesportsdb.com/team/140725-real-tomayapo
- https://goaldir.com/docs/football/teams-players/
- https://goaldir.com/docs/guides/images/
