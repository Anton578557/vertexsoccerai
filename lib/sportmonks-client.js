'use strict';

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

  // Primary documented auth path: api_token query parameter.
  const queryUrl = new URL(base);
  queryUrl.searchParams.set('api_token', token);
  let first;
  try {
    first = await requestJson(queryUrl, { headers: { Accept: 'application/json' } });
    const normalized = resultFrom(first.response, first.data, 'query');
    if (normalized.ok || ![401, 403].includes(normalized.status)) return normalized;
  } catch (error) {
    first = null;
  }

  // Compatibility fallback for accounts/proxies that accept Bearer auth.
  try {
    const second = await requestJson(base, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
    });
    return resultFrom(second.response, second.data, 'bearer');
  } catch (error) {
    return {
      ok: false,
      status: first?.response?.status || null,
      data: first?.data || null,
      authMode: 'query+bearer',
      message: error?.message || 'Sportmonks request failed'
    };
  }
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
