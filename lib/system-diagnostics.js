'use strict';

const { buildOpenHistoricalContext } = require('./football-data-uk');
const { checkApiFootball } = require('./api-football-client');
const { checkSportmonks } = require('./sportmonks-client');
const { providerCooldown, recordProviderFailure } = require('./provider-cooldown');
const { rapidHosts } = require('./football-feed');
const { enrichEspnAnalysis } = require('./espn-football');
const { enrichOpenFootball } = require('./openfootball-history');
const { enrichOpenLigaDb } = require('./openligadb-history');
const { enrichBsdHistory, configuration: bsdConfiguration } = require('./bsd-history');
const { searchClubDirectory } = require('./club-directory');
const { checkAnalyzerCases } = require('./analyzer-health');

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

  const paused = await providerCooldown('rapidApi');
  if (paused) return {configured:true,ok:false,...paused,quotaExhausted:paused.reason === 'quota_exhausted',cooldown:true};
  let lastProbe = null;
  for (const host of hosts) {
    const probe = await fetchProbe(`https://${host}/football-get-all-leagues`, {
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host, Accept: 'application/json' }
    });
    lastProbe = probe;
    if (!probe.ok) await recordProviderFailure('rapidApi',probe.status,probe.text || '');
    if (probe.ok) return publicResult(probe, { configured: true, hostUsed: host });
    if (![401, 403, 404].includes(Number(probe.status))) break;
  }
  const result = publicResult(lastProbe || {}, { configured: true, hostUsed: null, hostsTried: hosts.length });
  if (Number(result.status) === 429 || String(result.remaining || '') === '0') {
    result.quotaExhausted = true;
    result.reason = 'quota_exhausted';
  }
  return result;
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
  return publicResult(probe, { configured: true, keyMode: key === '123' ? 'shared_demo' : 'personal_key', check: 'team_metadata_only', historyVerified: false, results: Array.isArray(probe.data?.teams) ? probe.data.teams.length : null });
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
  const started = Date.now();
  try {
    const context = await buildOpenHistoricalContext('Racing Club','Boca Juniors','Argentinian Primera Division','Argentina');
    return { configured:true, openData:true, ok:context.ok, status:null, latencyMs:Date.now()-started,
      check:'verified_result_history', sample:{home:context.homeForm?.played || 0,away:context.awayForm?.played || 0},
      latest:context.history?.home?.[0]?.date || null, error:context.reason || null };
  } catch (_) { return {configured:true,openData:true,ok:false,error:'history_unavailable'}; }
}

async function checkOpenLigaDb() {
  const started = Date.now();
  const result = await enrichOpenLigaDb({teams:{home:{name:'Bayern Munich',country:'Germany'},away:{name:'Borussia Dortmund',country:'Germany'}},fixture:{league:'German Bundesliga'},form:{home:{played:0},away:{played:0}},sourceStatus:{}});
  return {configured:true,activeInAnalysis:true,openData:true,ok:result.sourceStatus.primaryFootball === 'OpenLigaDB',latencyMs:Date.now()-started,
    check:'verified_result_history',sample:{home:result.form.home.played,away:result.form.away.played},reason:result.sourceStatus.openLigaDb,latest:result.history?.home?.[0]?.date || null};
}

async function checkBsd() {
  const config = bsdConfiguration();
  if (!config.configured) return {configured:false,activeInAnalysis:false,ok:false,reason:'free_account_required'};
  const started = Date.now();
  const pairs = [['Nautico','Sport Recife','Brazil'],['Independiente Medellin','Millonarios','Colombia']];
  const checks = await Promise.all(pairs.map(async ([home,away,country]) => {
    const result = await enrichBsdHistory({teams:{home:{name:home,country},away:{name:away,country}},fixture:{},form:{home:{played:0},away:{played:0}},sourceStatus:{}}, {verifyConnection:true});
    return {home,away,ok:result.sourceStatus.primaryFootball === 'BSD',reason:result.sourceStatus.bsd,
      sample:{home:result.form.home.played,away:result.form.away.played},latest:result.history?.home?.[0]?.date || null};
  }));
  return {configured:true,activeInAnalysis:config.enabled,ok:checks.every(check => check.ok),latencyMs:Date.now()-started,check:'verified_result_history',checks};
}

async function checkOpenMeteo() {
  const probe = await fetchProbe('https://geocoding-api.open-meteo.com/v1/search?name=Madrid&count=1&language=en&format=json');
  return publicResult(probe, { configured: true, openData: true, results: Array.isArray(probe.data?.results) ? probe.data.results.length : null });
}

async function checkEspn() {
  if (process.env.ESPN_FOOTBALL_ENABLED !== 'true') return {configured:false,activeInAnalysis:false,ok:false,reason:'disabled_after_access_denial'};
  const started = Date.now();
  const result = await enrichEspnAnalysis({teams:{home:{name:'Nautico',country:'Brazil'},away:{name:'Sport Recife',country:'Brazil'}},fixture:{league:'Brazilian Serie B'},form:{home:{played:0},away:{played:0}},sourceStatus:{}});
  return {configured:process.env.ESPN_FOOTBALL_DISABLED !== 'true',activeInAnalysis:true,ok:result.sourceStatus.primaryFootball === 'ESPN',latencyMs:Date.now()-started,
    check:'verified_result_history',sample:{home:result.form.home.played,away:result.form.away.played},reason:result.sourceStatus.espn,latest:result.history?.home?.[0]?.date || null};
}

async function checkOpenFootball() {
  const started = Date.now();
  const result = await enrichOpenFootball({teams:{home:{name:'Arsenal',country:'England'},away:{name:'Chelsea',country:'England'}},fixture:{league:'English Premier League'},form:{home:{played:0},away:{played:0}},sourceStatus:{}});
  return {configured:true,activeInAnalysis:true,openData:true,ok:result.sourceStatus.primaryFootball === 'OpenFootball',latencyMs:Date.now()-started,check:'verified_result_history',sample:{home:result.form.home.played,away:result.form.away.played},reason:result.sourceStatus.openFootball,latest:result.history?.home?.[0]?.date || null};
}

async function checkWikidata() {
  const teams = await searchClubDirectory('Лутон Таун');
  return {configured:true,activeInAnalysis:true,ok:teams.length > 0,results:teams.length,check:'localized_club_identity'};
}

async function runSystemDiagnostics() {
  const [apiFootball, sportmonks, rapidApi, footballData, theSportsDb, openWeather, newsApi, supabase, resend, footballDataCoUk, openLigaDb, openMeteo, espn, wikidata, openFootball, bsd, analysisCases] = await Promise.all([
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
    checkOpenMeteo(),
    checkEspn(),
    checkWikidata(),
    checkOpenFootball(),
    checkBsd(),
    checkAnalyzerCases().catch(() => ({error:'diagnostic_unavailable'}))
  ]);

  openMeteo.activeInAnalysis = false;
  sportmonks.activeInAnalysis = true;
  sportmonks.check = 'credential_access; fixture coverage checked per match';
  footballDataCoUk.activeInAnalysis = true;
  const providers = { apiFootball, sportmonks, rapidApi, footballData, theSportsDb, openWeather, newsApi, supabase, resend, footballDataCoUk, openLigaDb, openMeteo, espn, wikidata, openFootball, bsd };
  if (apiFootball?.configured && !apiFootball?.ok && /suspend/i.test(String(apiFootball?.message || ''))) {
    apiFootball.reason = 'account_suspended';
  }

  // Vertex deliberately has redundant football providers. A single optional
  // provider outage must not make the whole platform unhealthy while the mesh
  // still has multiple working football feeds.
  const footballKeys = ['apiFootball', 'sportmonks', 'rapidApi', 'footballData', 'espn', 'openFootball', 'openLigaDb', ...(bsd.activeInAnalysis ? ['bsd'] : [])];
  const workingFootballProviders = footballKeys.filter((key) => providers[key]?.ok);
  const metadataOk = Boolean(theSportsDb?.ok || wikidata.ok || espn.ok);
  const coreOk = (workingFootballProviders.length >= 1 || footballDataCoUk.ok) && metadataOk && Boolean(supabase?.ok);

  const requiredFailures = [];
  if (!workingFootballProviders.length && !footballDataCoUk.ok) requiredFailures.push('footballMesh');
  if (!metadataOk) requiredFailures.push('teamMetadata');
  if (!supabase?.ok) requiredFailures.push('supabase');

  const optionalFailures = Object.entries(providers)
    .filter(([key, value]) => value?.configured && !value?.ok && !requiredFailures.includes(key))
    .map(([key]) => key);

  return {
    ok: coreOk,
    degraded: requiredFailures.length > 0 || optionalFailures.length > 0,
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
    analysisCases,
    staticSources: {
      statsBombOpen: { configured: false, activeInAnalysis: false, mode: 'research only' },
      gdelt: { configured: false, activeInAnalysis: false, mode: 'registered only', activeProbe: false }
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = { runSystemDiagnostics };
