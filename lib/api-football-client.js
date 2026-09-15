'use strict';

const BASE_URL = 'https://v3.football.api-sports.io';

async function apiFootballGet(path, params = {}) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return { ok: false, reason: 'not_configured' };
  const url = new URL(`${BASE_URL}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
  }
  const response = await fetch(url, { headers: { 'x-apisports-key': key, Accept: 'application/json' } });
  const data = await response.json().catch(() => null);
  const errors = data?.errors;
  const hasErrors = Array.isArray(errors) ? errors.length > 0 : Boolean(errors && Object.keys(errors).length);
  return {
    ok: response.ok && !hasErrors,
    status: response.status,
    data,
    remaining: response.headers.get('x-ratelimit-requests-remaining') || null
  };
}

async function checkApiFootball() {
  const result = await apiFootballGet('/countries');
  return {
    configured: Boolean(process.env.API_FOOTBALL_KEY),
    ok: Boolean(result.ok),
    status: result.status || null,
    results: Number(result.data?.results || 0),
    remaining: result.remaining || null
  };
}

module.exports = { apiFootballGet, checkApiFootball };
