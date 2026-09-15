'use strict';

const { checkApiFootball } = require('./api-football-client');
const { checkSportmonks } = require('./sportmonks-client');

function configured(value) {
  return Boolean(String(value || '').trim());
}

async function fetchProbe(url, options = {}, timeoutMs = 8500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text().catch(() => '');
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) {}
    return {
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - started,
      data,
      text: text.slice(0, 240),
      remaining: response.headers.get('x-ratelimit-requests-remaining') || null
    };
  } catch (error) {
    return { ok: false, status: null, latencyMs: Date.now() - started, error: error?.name === 'AbortError' ? 'timeout' : (error?.message || 'request_failed') };
  } finally {
    clearTimeout(timer);
  }
}

function publicResult(probe, extra = {}) {
  return {
    ...extra,
    ok: Boolean(probe?.ok),
    status: probe?.status ?? null,
    latencyMs: probe?.latencyMs ?? null,
    remaining: probe?.remaining ?? null,
    error: probe?.error || null
  };
}

async function checkRapidApi() {
  const key = String(process.env.RAPIDAPI_KEY || '').trim();
  const host = String(process.env.RAPIDAPI_HOST || '').trim();
  if (!key || !host) return { configured: false, ok: false, status: null };
  if (!/^[a-z0-9.-]+\.p\.rapidapi\.com$/i.test(host)) return { configured: true, ok: false, status: null, error: 'invalid_host' };
  const probe = await fetchProbe(`https://${host}/football-get-all-leagues`, {
    headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host, Accept: 'application/json' }
  });
  return publicResult(probe, { configured: true });
}

async function checkFootballData() {
  const key = String(process.env.FOOTBALL_DATA_KEY || '').trim();
  if (!key) return { configured: false, ok: false, status: null };
  const probe = await fetchProbe('https://api.football-data.org/v4/competitions?plan=TIER_ONE', {
    headers: { 'X-Auth-Token': key, Accept: 'application/json' }
  });
  return publicResult(probe, { configured: true, results: Array.isArray(probe.data?.competitions) ? probe.data.competitions.length : null });
}

async function checkTheSportsDb() {
  const key = String(process.env.THESPORTSDB_KEY || '123').trim() || '123';
  const probe = await fetchProbe(`https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(key)}/searchteams.php?t=Arsenal`);
  return publicResult(probe, { configured: true, results: Array.isArray(probe.data?.teams) ? probe.data.teams.length : null });
}

async function checkOpenWeather() {
  const key = String(process.env.OPENWEATHER_KEY || '').trim();
  if (!key) return { configured: false, ok: false, status: null };
  const probe = await fetchProbe(`https://api.openweathermap.org/geo/1.0/direct?q=Madrid&limit=1&appid=${encodeURIComponent(key)}`);
  return publicResult(probe, { configured: true, results: Array.isArray(probe.data) ? probe.data.length : null });
}

async function checkNewsApi() {
  const key = String(process.env.NEWSAPI_KEY || '').trim();
  if (!key) return { configured: false, ok: false, status: null };
  const probe = await fetchProbe('https://newsapi.org/v2/top-headlines?country=gb&pageSize=1', {
    headers: { 'X-Api-Key': key, Accept: 'application/json' }
  });
  return publicResult(probe, { configured: true, results: Array.isArray(probe.data?.articles) ? probe.data.articles.length : null });
}

async function checkSupabase() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const anon = String(process.env.SUPABASE_ANON_KEY || '').trim();
  const secret = String(process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!url) return { configured: false, ok: false, status: null, anonConfigured: Boolean(anon), serverSecretConfigured: Boolean(secret) };
  const probe = await fetchProbe(`${url}/auth/v1/health`, { headers: anon ? { apikey: anon } : {} });
  return publicResult(probe, { configured: true, anonConfigured: Boolean(anon), serverSecretConfigured: Boolean(secret) });
}

async function checkResend() {
  const key = String(process.env.RESEND_API_KEY || '').trim();
  if (!key) return { configured: false, ok: false, status: null, fromConfigured: configured(process.env.RESEND_FROM_EMAIL), replyToConfigured: configured(process.env.RESEND_REPLY_TO_EMAIL) };
  const probe = await fetchProbe('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }
  });
  const domains = Array.isArray(probe.data?.data) ? probe.data.data : [];
  const vertex = domains.find((item) => String(item?.name || '').toLowerCase() === 'vertexsoccerai.com');
  return publicResult(probe, {
    configured: true,
    fromConfigured: configured(process.env.RESEND_FROM_EMAIL),
    replyToConfigured: configured(process.env.RESEND_REPLY_TO_EMAIL),
    domainFound: Boolean(vertex),
    domainStatus: vertex?.status || null
  });
}

async function checkFootballDataUk() {
  const probe = await fetchProbe('https://www.football-data.co.uk/mmz4281/2526/E0.csv', { headers: { Accept: 'text/csv,*/*' } });
  return publicResult(probe, { configured: true, openData: true });
}

async function checkOpenLigaDb() {
  const probe = await fetchProbe('https://api.openligadb.de/getavailableleagues');
  return publicResult(probe, { configured: true, openData: true, results: Array.isArray(probe.data) ? probe.data.length : null });
}

async function checkOpenMeteo() {
  const probe = await fetchProbe('https://geocoding-api.open-meteo.com/v1/search?name=Madrid&count=1&language=en&format=json');
  return publicResult(probe, { configured: true, openData: true, results: Array.isArray(probe.data?.results) ? probe.data.results.length : null });
}

async function runSystemDiagnostics() {
  const [apiFootball, sportmonks, rapidApi, footballData, theSportsDb, openWeather, newsApi, supabase, resend, footballDataCoUk, openLigaDb, openMeteo] = await Promise.all([
    checkApiFootball(),
    checkSportmonks(),
    checkRapidApi(),
    checkFootballData(),
    checkTheSportsDb(),
    checkOpenWeather(),
    checkNewsApi(),
    checkSupabase(),
    checkResend(),
    checkFootballDataUk(),
    checkOpenLigaDb(),
    checkOpenMeteo()
  ]);

  const providers = { apiFootball, sportmonks, rapidApi, footballData, theSportsDb, openWeather, newsApi, supabase, resend, footballDataCoUk, openLigaDb, openMeteo };
  const coreKeys = ['rapidApi', 'footballData', 'theSportsDb', 'supabase'];
  const coreOk = coreKeys.every((key) => providers[key]?.ok);
  const configuredFailures = Object.entries(providers)
    .filter(([, value]) => value?.configured && !value?.ok)
    .map(([key]) => key);

  return {
    ok: coreOk,
    degraded: configuredFailures.length > 0,
    coreOk,
    configuredFailures,
    providers,
    staticSources: {
      openFootball: { configured: true, mode: 'dataset/fallback' },
      statsBombOpen: { configured: true, mode: 'research/training' },
      gdelt: { configured: true, mode: 'news fallback', activeProbe: false }
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = { runSystemDiagnostics };
