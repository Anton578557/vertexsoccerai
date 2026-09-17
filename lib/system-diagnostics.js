'use strict';

const { checkApiFootball } = require('./api-football-client');
const { checkSportmonks } = require('./sportmonks-client');
const { rapidHosts } = require('./football-feed');

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
  const hosts = rapidHosts();
  if (!key || !hosts.length) return { configured: false, ok: false, status: null };

  let lastProbe = null;
  for (const host of hosts) {
    const probe = await fetchProbe(`https://${host}/football-get-all-leagues`, {
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host, Accept: 'application/json' }
    });
    lastProbe = probe;
    if (probe.ok) return publicResult(probe, { configured: true, hostUsed: host });
    if (![401, 403, 404].includes(Number(probe.status))) break;
  }
  return publicResult(lastProbe || {}, { configured: true, hostUsed: null, hostsTried: hosts.length });
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
  if (!url) return { configured: false, ok: false, status: null, anonConfigured: Boolean(anon), serverSecretConfigured: Boolean(secret), serverSecretOk: false };

  const [authProbe, serverProbe] = await Promise.all([
    fetchProbe(`${url}/auth/v1/health`, { headers: anon ? { apikey: anon } : {} }),
    secret
      ? fetchProbe(`${url}/rest/v1/provider_cache?select=cache_key&limit=1`, { headers: { apikey: secret, Accept: 'application/json' } })
      : Promise.resolve({ ok: false, status: null, error: 'secret_not_configured' })
  ]);

  return {
    configured: true,
    ok: Boolean(authProbe.ok && serverProbe.ok),
    status: authProbe.status ?? null,
    latencyMs: Math.max(Number(authProbe.latencyMs || 0), Number(serverProbe.latencyMs || 0)) || null,
    anonConfigured: Boolean(anon),
    serverSecretConfigured: Boolean(secret),
    serverSecretOk: Boolean(serverProbe.ok),
    serverStatus: serverProbe.status ?? null,
    error: authProbe.error || serverProbe.error || null
  };
}

async function checkResend() {
  const key = String(process.env.RESEND_API_KEY || '').trim();
  const fromConfigured = configured(process.env.RESEND_FROM_EMAIL);
  const replyToConfigured = configured(process.env.RESEND_REPLY_TO_EMAIL);
  return {
    configured: Boolean(key),
    ok: Boolean(key && fromConfigured && replyToConfigured),
    status: null,
    fromConfigured,
    replyToConfigured,
    verificationMode: 'sending-config'
  };
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

  // Vertex deliberately has redundant football providers. A single optional
  // provider outage must not make the whole platform unhealthy while the mesh
  // still has multiple working football feeds.
  const footballKeys = ['apiFootball', 'sportmonks', 'rapidApi', 'footballData'];
  const workingFootballProviders = footballKeys.filter((key) => providers[key]?.ok);
  const coreOk = workingFootballProviders.length >= 1 && Boolean(theSportsDb?.ok) && Boolean(supabase?.ok);

  const requiredFailures = [];
  if (!workingFootballProviders.length) requiredFailures.push('footballMesh');
  if (!theSportsDb?.ok) requiredFailures.push('theSportsDb');
  if (!supabase?.ok) requiredFailures.push('supabase');

  const optionalFailures = Object.entries(providers)
    .filter(([key, value]) => value?.configured && !value?.ok && !requiredFailures.includes(key))
    .map(([key]) => key);

  return {
    ok: coreOk,
    degraded: requiredFailures.length > 0,
    coreOk,
    requiredFailures,
    optionalFailures,
    configuredFailures: [...requiredFailures, ...optionalFailures],
    footballMesh: {
      working: workingFootballProviders,
      workingCount: workingFootballProviders.length,
      configuredCount: footballKeys.filter((key) => providers[key]?.configured).length
    },
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
