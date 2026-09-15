# Vertex Soccer AI — Production Setup

## Goal

Vertex Soccer AI 2.0 uses a server-side provider layer on Vercel. Browser JavaScript calls our own `/api/*` endpoints. Third-party secrets stay in Vercel Environment Variables and are never committed to GitHub.

## Vercel environment variables

Open **Vercel → vertexsoccerai → Settings → Environment Variables**.

For each secret:

1. Add the variable name exactly as shown below.
2. Paste only the raw key/token as the value — no quotes and no `const ... =` wrapper.
3. Enable it for **Production** and **Preview**. Development is optional unless local Vercel development is used.
4. Save the variable.
5. After adding or changing variables, create a new deployment / redeploy the latest Production deployment.

### Core provider variables

- `API_FOOTBALL_KEY` — **direct API-Sports / API-Football** key used with `https://v3.football.api-sports.io` and the `x-apisports-key` header. Do not put a RapidAPI marketplace key here unless that key is also valid for direct API-Sports authentication.
- `FOOTBALL_DATA_KEY` — football-data.org token. Sent server-side in the `X-Auth-Token` header.
- `OPENWEATHER_KEY` — OpenWeather API key. Venue/city is geocoded server-side and weather is fetched by coordinates.
- `NEWSAPI_KEY` — NewsAPI key. Sent server-side in a header and treated as an optional news source.

### TheSportsDB variables

- `THESPORTSDB_KEY` — optional TheSportsDB v1 key. If omitted, the application currently falls back to the public free v1 key `123` for supported metadata endpoints.
- `THESPORTSDB_V2_KEY` — optional premium TheSportsDB v2 key. Used for premium livescore support via `X-API-KEY`.

### RapidAPI compatibility

The old DeepSeek project also used RapidAPI. RapidAPI credentials are a separate integration from direct API-Sports/API-Football.

When we enable a RapidAPI provider, use separate variables instead of reusing `API_FOOTBALL_KEY`:

- `RAPIDAPI_KEY`
- `RAPIDAPI_HOST`

The server adapter must match the exact RapidAPI product/host and response schema before these variables are used. This avoids silently sending a RapidAPI key to the wrong API-Football endpoint.

### Email (later in the free beta)

Resend will be connected server-side for welcome emails, support mail and reports. When enabled, use:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

The domain should be verified in Resend/Vercel before production mail is enabled.

### Supabase

The browser uses the Supabase project URL and publishable key with Row Level Security enabled. The publishable client key is not treated as a server secret.

If we later add trusted server-only database jobs, a service-role key may be added as a Vercel secret. It must never be exposed in browser JavaScript.

## Provider architecture

### Tier 1 — authoritative/core football data

1. **API-Football / API-Sports**
   - team search
   - fixtures
   - recent form/results
   - live scores
   - broader/deeper football coverage when available

2. **Football-Data.org**
   - supported competitions
   - fixtures/results
   - fallback completed-match data

### Tier 2 — metadata and additional football context

3. **TheSportsDB**
   - team identity
   - badges
   - stadium / location metadata
   - fallback recent events
   - premium live scores when v2 is configured

### Tier 3 — environment/context

4. **OpenWeather**
   - geocode the stadium/city
   - current conditions by coordinates

5. **NewsAPI**
   - recent team headlines
   - optional news signal

### Tier 4 — keyless / fallback sources to add behind adapters

6. **Google News / RSS**
   - optional news fallback
   - no secret stored in the browser

7. **ESPN site data endpoints**
   - optional schedules/news/live fallback where technically suitable
   - treated as non-critical because the endpoints are not an official public developer API and may change

### Tier 5 — platform services

8. **Supabase**
   - authentication
   - profiles
   - analysis history
   - saved matches
   - strategy profiles
   - reviews/activity
   - model evaluation history

9. **Resend**
   - welcome email
   - support notifications
   - later: weekly reports and user alerts

10. **Vercel Cron / scheduled jobs**
   - later: update fixtures
   - check finished matches
   - evaluate stored predictions
   - update public model performance
   - strategy refresh jobs

## Payments

Payments, credits and subscriptions are deliberately disabled during the **Free Beta**. NOWPayments/Cryptomus-style payment integrations are not part of the current production path. They can be introduced later after real usage exists.

## Current analysis flow

`Browser → /api/analyze → provider adapters → normalized match data → Vertex statistical model → confidence/data quality → UI → Supabase history`

Current model probabilities are calculated from completed-match scoring data using a Poisson-based model. When the dataset is too weak, the UI should withhold the prediction instead of inventing a percentage.

## Current provider strategy in code

1. Team identity / badges / venue metadata: TheSportsDB.
2. Completed-match data: API-Football first when configured; Football-Data fallback; TheSportsDB development fallback.
3. Weather: OpenWeather through server-side venue/city coordinates.
4. News: NewsAPI through the server.
5. Live center: TheSportsDB premium first when configured, otherwise API-Football.
6. Statistical model: Vertex server function.

## Health check

After variables are saved and the Production deployment is rebuilt, open:

`https://vertexsoccerai.com/api/health`

The response reports whether the server can see the expected environment variables without revealing their values.

Expected shape:

```json
{
  "ok": true,
  "services": {
    "teamMetadata": true,
    "apiFootball": true,
    "footballData": true,
    "openWeather": true,
    "newsApi": true,
    "livePremium": false
  }
}
```

`livePremium: false` is normal if TheSportsDB v2 premium is not configured; Live can still use API-Football when `API_FOOTBALL_KEY` is available.

## Free beta

The site remains free while we collect real usage and verified model performance. Monetization is a later phase.