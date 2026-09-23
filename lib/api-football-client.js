'use strict';

const { providerCooldown, recordProviderFailure } = require('./provider-cooldown');

const BASE_URL = 'https://v3.football.api-sports.io';

async function apiFootballGet(path, params = {}, timeoutMs = 8500) {
  const key = String(process.env.API_FOOTBALL_KEY || '').trim();
  if (!key) return { ok: false, reason: 'not_configured', status: null, data: null };
  const paused = await providerCooldown('apiFootball');
  if (paused) return {ok:false,status:paused.status,data:null,reason:paused.reason,message:paused.reason,retryAt:paused.retryAt};
  const url = new URL(`${BASE_URL}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'x-apisports-key': key, Accept: 'application/json', 'User-Agent': 'VertexSoccerAI/4.0' }
    });
    const data = await response.json().catch(() => null);
    const errors = data?.errors;
    const hasErrors = Array.isArray(errors) ? errors.length > 0 : Boolean(errors && Object.keys(errors).length);
    if (!response.ok || hasErrors) await recordProviderFailure('apiFootball', response.status, JSON.stringify(errors || ''));
    return {
      ok: response.ok && !hasErrors,
      status: response.status,
      data,
      remaining: response.headers.get('x-ratelimit-requests-remaining') || null,
      message: hasErrors ? JSON.stringify(errors).slice(0, 220) : null
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      data: null,
      remaining: null,
      message: error?.name === 'AbortError' ? 'timeout' : (error?.message || 'request_failed')
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkApiFootball() {
  const result = await apiFootballGet('/countries');
  return {
    configured: Boolean(String(process.env.API_FOOTBALL_KEY || '').trim()),
    ok: Boolean(result.ok),
    status: result.status || null,
    results: Number(result.data?.results || 0),
    remaining: result.remaining || null,
    message: result.ok ? null : (result.message || null)
  };
}

module.exports = { apiFootballGet, checkApiFootball };
