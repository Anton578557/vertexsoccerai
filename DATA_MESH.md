# Vertex Soccer AI — Data Mesh

Vertex does not trust one provider for every task. Each source has a defined role, a confidence level and a fallback path.

## Current / live layer

| Source | Auth | Role | Status |
| --- | --- | --- | --- |
| RapidAPI · Free API Live Football Data | `RAPIDAPI_KEY` + `RAPIDAPI_HOST` | live matches, detailed match stats, xG, shots, corners, cards, lineups/referee where covered | connected when env vars exist |
| Football-Data.org | `FOOTBALL_DATA_KEY` | fixtures, results, standings, recent form | connected when env var exists |
| API-Football | `API_FOOTBALL_KEY` | optional fallback for fixtures/events/stats/injuries/lineups/H2H | optional |
| TheSportsDB | optional keys | team metadata, badges, stadiums, fallback recent results | active via v1 fallback; premium optional |
| Sportmonks | `SPORTMONKS_API_TOKEN` | optional structured fallback for selected free-plan leagues | optional |

## Free historical event layer

### Football-Data.co.uk

Used directly by the Analyzer for mapped competitions. Vertex downloads the current and previous season CSV, matches each team and builds recent event profiles from real columns when they exist:

- shots / shots on target
- corners
- fouls
- offsides
- yellow / red cards
- referee field in the source data

The current granular model blends the team's recent event average with the opponent's recent allowed average and applies a transparent Poisson count baseline to totals such as corners/cards/shots.

### OpenLigaDB

No authentication. ODbL community results/fixtures fallback, especially useful for German competitions. It is a fallback source, not a granular-stat source.

### OpenFootball

CC0/public-domain football results, competitions, clubs and aliases. Useful for identity normalization, historical results and competition mapping.

### StatsBomb Open Data

Detailed event data useful for research, feature engineering and model validation. Keep attribution and review the StatsBomb public-data agreement before using their data in a commercial production output. Vertex treats this as a research/training source rather than a silent runtime feed.

## Context layer

| Source | Role |
| --- | --- |
| OpenWeather | venue weather/geocoding |
| Open-Meteo | optional weather/geocoding/historical fallback; free public endpoint is non-commercial |
| NewsAPI | team-news context |
| GDELT | no-key news/search fallback candidate |

## Storage

Production Supabase contains `match_event_stats` for normalized event statistics and `source_ingestion_runs` for ingestion/audit history. Browser clients have no public RLS policy for these tables; future harvesters should write server-side only.

## Market policy

Vertex may show a market only when the source returns a usable historical sample. It never derives corners/cards/shots from goals alone.

Current priority:

1. Corners
2. Yellow cards
3. Shots / shots on target
4. Offsides / fouls
5. Penalties only after a much larger rare-event sample is available

## Source routing principle

`current provider -> fallback provider -> normalized historical store -> feature engine -> market model -> data-quality gate -> verdict`
