'use strict';

const BASE_URL = 'https://api.sportmonks.com/v3/football';

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  return { response, data };
}

async function sportmonksGet(path, params = {}) {
  const token = String(process.env.SPORTMONKS_API_TOKEN || '').trim();
  if (!token) return { ok: false, reason: 'not_configured' };

  // Sportmonks officially supports api_token in the query string as well as
  // Authorization-based auth. Query auth is used here because it is the most
  // compatible option across Sportmonks v3 deployments and avoids 401s seen
  // with some Bearer-header requests.
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('api_token', token);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(name, String(value));
    }
  }

  const { response, data } = await requestJson(url, {
    headers: { Accept: 'application/json' }
  });

  return {
    ok: response.ok && Array.isArray(data?.data),
    status: response.status,
    data,
    message: data?.message || data?.error?.message || null
  };
}

async function checkSportmonks() {
  const result = await sportmonksGet('/leagues', { per_page: 1 });
  return {
    configured: Boolean(String(process.env.SPORTMONKS_API_TOKEN || '').trim()),
    ok: Boolean(result.ok),
    status: result.status || null,
    results: Array.isArray(result.data?.data) ? result.data.data.length : 0,
    message: result.ok ? null : (result.message || null)
  };
}

module.exports = { sportmonksGet, checkSportmonks };
