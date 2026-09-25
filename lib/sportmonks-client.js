'use strict';

const { boundedFetch: fetch } = require('./analysis-budget');

const BASE_URL = 'https://api.sportmonks.com/v3/football';

function cleanToken(value) {
  return String(value || '').trim().replace(/^['\"]+|['\"]+$/g, '').trim();
}

async function requestJson(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => null);
    return { response, data };
  } finally {
    clearTimeout(timer);
  }
}

function resultFrom(response, data, authMode) {
  return {
    ok: response.ok && Array.isArray(data?.data),
    status: response.status,
    data,
    authMode,
    message: data?.message || data?.error?.message || null
  };
}

async function sportmonksGet(path, params = {}) {
  const token = cleanToken(process.env.SPORTMONKS_API_TOKEN);
  if (!token) return { ok: false, reason: 'not_configured', status: null, data: null, message: null };

  const base = new URL(`${BASE_URL}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') base.searchParams.set(name, String(value));
  }

  const queryUrl = new URL(base);
  queryUrl.searchParams.set('api_token', token);
  let last = null;

  // Sportmonks documents both api_token query authentication and a raw
  // Authorization header. Bearer is retained only as a compatibility fallback.
  const attempts = [
    { mode: 'query', url: queryUrl, headers: { Accept: 'application/json' } },
    { mode: 'raw-authorization', url: base, headers: { Accept: 'application/json', Authorization: token } },
    { mode: 'bearer', url: base, headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } }
  ];

  for (const attempt of attempts) {
    try {
      const { response, data } = await requestJson(attempt.url, { headers: attempt.headers });
      const normalized = resultFrom(response, data, attempt.mode);
      last = normalized;

      if (normalized.ok) return normalized;
      // 403 means the token was understood but the current plan cannot access
      // the requested feed; retrying another auth format cannot fix plan scope.
      if (normalized.status === 403) return normalized;
      if (normalized.status !== 401) return normalized;
    } catch (error) {
      last = { ok: false, status: null, data: null, authMode: attempt.mode, message: error?.message || 'request_failed' };
    }
  }

  return last || { ok: false, status: null, data: null, authMode: 'all', message: 'Sportmonks request failed' };
}

async function checkSportmonks() {
  const token = cleanToken(process.env.SPORTMONKS_API_TOKEN);
  const result = await sportmonksGet('/leagues', { per_page: 1 });
  return {
    configured: Boolean(token),
    ok: Boolean(result.ok),
    status: result.status || null,
    results: Array.isArray(result.data?.data) ? result.data.data.length : 0,
    authMode: result.authMode || null,
    message: result.ok ? null : (result.message || null)
  };
}

module.exports = { sportmonksGet, checkSportmonks };
