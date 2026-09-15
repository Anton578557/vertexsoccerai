'use strict';

const BASE_URL = 'https://api.sportmonks.com/v3/football';

async function sportmonksGet(path, params = {}) {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) return { ok: false, reason: 'not_configured' };
  const url = new URL(`${BASE_URL}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
  }
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok && Array.isArray(data?.data), status: response.status, data };
}

async function checkSportmonks() {
  const result = await sportmonksGet('/leagues', { per_page: 1 });
  return {
    configured: Boolean(process.env.SPORTMONKS_API_TOKEN),
    ok: Boolean(result.ok),
    status: result.status || null,
    results: Array.isArray(result.data?.data) ? result.data.data.length : 0
  };
}

module.exports = { sportmonksGet, checkSportmonks };
