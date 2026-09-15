# Vertex Soccer AI — Production Setup

## Goal

Vertex Soccer AI 2.0 uses a server-side provider layer on Vercel. Browser JavaScript calls our own `/api/*` endpoints. Third-party secrets stay in Vercel Environment Variables and are never committed to GitHub.

## Vercel environment variables

Open **Vercel → vertexsoccerai → Settings → Environments → Production → Environment Variables**.

Add values without quotes and without `const ... =` wrappers. After variables are added or changed, create a new Production deployment or redeploy the latest one.

### Required/current football stack

- `RAPIDAPI_KEY` — RapidAPI secret used by the Free API Live Football Data provider.
- `RAPIDAPI_HOST` — current host: `free-api-live-football-data.p.rapidapi.com`.
- `FOOTBALL_DATA_KEY` — football-data.org token used for fixtures/results and completed-match data.
- `OPENWEATHER_KEY` — OpenWeather API key.
- `NEWSAPI_KEY` — NewsAPI key.

### Optional football providers

- `API_FOOTBALL_KEY` — optional direct API-Sports/API-Football key. It is no longer required for the current Vertex pipeline. If configured, it remains available as an additional fallback/deeper-data provider.
- `THESPORTSDB_KEY` — optional TheSportsDB v1 key. If omitted, supported metadata endpoints use the public free v1 key `123`.
- `THESPORTSDB_V2_KEY` — optional premium TheSportsDB v2 key for premium live scores.

Do not reuse the RapidAPI marketplace key as `API_FOOTBALL_KEY`. They are different authentication paths.

### Supabase

Current Vercel variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY` — server-only secret; never expose it in browser JavaScript.

The browser publishable key is protected by Row Level Security. Server-only jobs may use `SUPABASE_SECRET_KEY` for trusted writes such as result evaluation and scheduled maintenance.

### Resend

Current Vercel variables:

- `RESEND_API_KEY` — Secret.
- `RESEND_FROM_EMAIL` — sender address on the verified `vertexsoccerai.com` domain.
- `RESEND_REPLY_TO_EMAIL` — real mailbox that receives replies, currently the project's Outlook mailbox.

The domain `vertexsoccerai.com` is verified in Resend with DKIM and SPF.

## Current provider architecture

### Core football data

1. **RapidAPI — Free API Live Football Data**
   - primary Live Match Center feed
   - endpoint used by the adapter: `football-current-live`
   - authenticated with `RAPIDAPI_KEY` + `RAPIDAPI_HOST`

2. **Football-Data.org**
   - primary upcoming/today fixtures feed
   - completed-match data for Match Analyzer
   - fallback/core statistical history

3. **TheSportsDB**
   - team identity
   - badges
   - stadium and location metadata
   - recent-event fallback
   - optional premium live fallback

4. **Direct API-Sports / API-Football**
   - optional only
   - can provide additional team/fixture/live depth if a direct key is added later
   - current production setup does not require `API_FOOTBALL_KEY`

### Context data

5. **OpenWeather**
   - venue/city geocoding
   - weather by coordinates

6. **NewsAPI**
   - recent team headlines
   - optional news-impact signal

### Platform services

7. **Supabase**
   - authentication
   - profiles
   - analysis history
   - saved matches
   - strategy profiles
   - reviews/activity
   - model evaluation history

8. **Resend**
   - welcome email
   - support/contact email
   - later: strategy alerts and weekly reports

9. **Vercel Cron / scheduled jobs**
   - later: refresh fixtures
   - check finished matches
   - evaluate stored predictions
   - update model statistics
   - recalculate strategy signals

## Runtime flow

### Match Analyzer

`Browser → /api/analyze → TheSportsDB identity + Football-Data history → OpenWeather + NewsAPI → Vertex model → Data Quality / Confidence → UI → Supabase`

If a direct `API_FOOTBALL_KEY` exists, the legacy direct API-Sports adapter can provide additional data before the Football-Data fallback. It is optional.

### Live Match Center

`Browser → /api/live → RapidAPI Free Live Football Data → optional TheSportsDB/API-Football fallback → normalized matches → UI`

If RapidAPI is configured but temporarily fails, the endpoint attempts the existing fallback providers instead of breaking the page.

### Upcoming matches

`Browser → /api/upcoming → Football-Data.org → optional direct API-Football fallback → normalized matches → UI`

## Model policy

Current model probabilities are calculated from real completed-match scoring data using a Poisson-based model. When the dataset is too weak, Vertex withholds the probability output instead of inventing percentages.

## Health check

After Production redeploy, open:

`https://vertexsoccerai.com/api/health`

The health response never reveals secret values. It only reports whether each integration is configured.

Expected important fields with the current setup:

```json
{
  "ok": true,
  "services": {
    "footballPipeline": true,
    "rapidApi": true,
    "footballData": true,
    "apiFootballDirect": false,
    "apiFootballDirectRequired": false,
    "openWeather": true,
    "newsApi": true,
    "supabase": {
      "url": true,
      "publishable": true,
      "serverSecret": true
    },
    "resend": {
      "apiKey": true,
      "fromEmail": true,
      "replyToEmail": true
    }
  }
}
```

`apiFootballDirect: false` is normal. It does **not** mean the current football pipeline is broken.

## Free beta

Payments, credits and subscriptions are deliberately disabled during the Free Beta. The product remains free while real usage and verified model performance are collected.
