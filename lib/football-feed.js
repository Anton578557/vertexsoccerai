'use strict';

const { sportmonksGet } = require('./sportmonks-client');
const { cachedProviderCall } = require('./provider-cache');

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
const RAPID_LIVE_ENDPOINT = 'football-current-live';
const RAPID_DEFAULT_HOST = 'free-api-live-football-data-cheaper-version.p.rapidapi.com';

function isoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function validRapidHost(host) {
  return /^[a-z0-9.-]+\.p\.rapidapi\.com$/i.test(String(host || '').trim());
}

function rapidHosts() {
  const configured = String(process.env.RAPIDAPI_HOST || '').trim().toLowerCase();
  const out = [RAPID_DEFAULT_HOST];
  if (validRapidHost(configured) && !out.includes(configured)) out.push(configured);
  return out;
}

function hasRapidApi() {
  return Boolean(String(process.env.RAPIDAPI_KEY || '').trim() && rapidHosts().length);
}

async function fetchJson(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VertexSoccerAI/4.1',
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const error = new Error(`Upstream ${response.status}`);
      error.status = response.status;
      error.details = (await response.text().catch(() => '')).slice(0, 240);
      throw error;
    }

    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

function parseScoreString(value) {
  const match = String(value || '').match(/(-?\d+)\s*[-:]\s*(-?\d+)/);
  if (!match) return [null, null];
  return [Number(match[1]), Number(match[2])];
}

function normalizeRapidLive(data) {
  const live = data?.response?.live;
  if (!Array.isArray(live)) return [];

  return live.slice(0, 80).map((item) => {
    const [scoreHome, scoreAway] = parseScoreString(item?.status?.scoreStr);
    const liveTime = item?.status?.liveTime;
    const minute = liveTime?.short || liveTime?.long || item?.status?.reason?.short || item?.status?.reason?.long || 'LIVE';

    return {
      id: String(item?.id || item?.matchId || item?.eventId || ''),
      league: item?.league?.name || item?.tournament?.name || item?.parentLeague?.name || null,
      minute,
      home: item?.home?.name || item?.homeTeam?.name || '',
      away: item?.away?.name || item?.awayTeam?.name || '',
      homeScore: Number.isFinite(item?.home?.score) ? item.home.score : scoreHome,
      awayScore: Number.isFinite(item?.away?.score) ? item.away.score : scoreAway,
      source: 'RapidAPI Live Football'
    };
  }).filter((match) => match.home && match.away);
}

async function rapidRequest(path) {
  const key = String(process.env.RAPIDAPI_KEY || '').trim();
  if (!key) return null;

  let lastError = null;
  for (const host of rapidHosts()) {
    try {
      return await fetchJson(`https://${host}/${path}`, {
        headers: {
          'x-rapidapi-key': key,
          'x-rapidapi-host': host
        }
      });
    } catch (error) {
      lastError = error;
      if (![401, 403, 404].includes(Number(error?.status))) break;
    }
  }
  if (lastError) throw lastError;
  return null;
}

async function rapidLiveMatches() {
  if (!hasRapidApi()) return null;
  const { payload } = await cachedProviderCall({
    cacheKey: 'rapidapi:live:v2',
    provider: 'RapidAPI Live Football',
    ttlSeconds: 20,
    staleSeconds: 120,
    loader: async () => normalizeRapidLive(await rapidRequest(RAPID_LIVE_ENDPOINT))
  });
  return Array.isArray(payload) ? payload : [];
}

function participantLocation(participant) {
  return String(participant?.meta?.location || participant?.meta?.position || participant?.location || '').toLowerCase();
}

function sportmonksScore(fixture, participantId) {
  const scores = Array.isArray(fixture?.scores) ? fixture.scores : [];
  const candidates = scores.filter((entry) => String(entry?.participant_id || entry?.participant?.id || '') === String(participantId || ''));
  if (!candidates.length) return null;
  const preferred = candidates.find((entry) => /current|2nd-half|fulltime|full-time/i.test(String(entry?.description || ''))) || candidates[candidates.length - 1];
  const value = preferred?.score?.goals ?? preferred?.score?.score ?? preferred?.score ?? preferred?.goals;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sportmonksTeams(fixture) {
  const participants = Array.isArray(fixture?.participants) ? fixture.participants : [];
  const home = participants.find((p) => participantLocation(p) === 'home') || participants[0] || null;
  const away = participants.find((p) => participantLocation(p) === 'away') || participants[1] || null;
  if (home && away) return { home, away };
  const nameParts = String(fixture?.name || '').split(/\s+vs\s+/i);
  return {
    home: home || (nameParts[0] ? { name: nameParts[0], id: null } : null),
    away: away || (nameParts[1] ? { name: nameParts[1], id: null } : null)
  };
}

function normalizeSportmonksFixture(fixture, live = false) {
  const { home, away } = sportmonksTeams(fixture);
  if (!home?.name || !away?.name) return null;
  return {
    id: String(fixture?.id || ''),
    date: fixture?.starting_at || fixture?.starting_at_timestamp || null,
    league: fixture?.league?.name || null,
    country: fixture?.league?.country?.name || null,
    minute: live ? (fixture?.state?.short_name || fixture?.state?.name || 'LIVE') : null,
    home: home.name,
    away: away.name,
    homeScore: sportmonksScore(fixture, home.id),
    awayScore: sportmonksScore(fixture, away.id),
    status: fixture?.state?.name || fixture?.state?.short_name || null,
    source: 'Sportmonks'
  };
}

async function sportmonksLiveMatches() {
  if (!process.env.SPORTMONKS_API_TOKEN) return null;
  const { payload } = await cachedProviderCall({
    cacheKey: 'sportmonks:live:v1',
    provider: 'Sportmonks',
    ttlSeconds: 20,
    staleSeconds: 120,
    loader: async () => {
      const result = await sportmonksGet('/livescores/inplay', { include: 'participants;scores;league;state' });
      if (!result.ok) return null;
      return (result.data?.data || []).map((fixture) => normalizeSportmonksFixture(fixture, true)).filter(Boolean).slice(0, 80);
    }
  });
  return Array.isArray(payload) ? payload : null;
}

async function sportmonksUpcoming(days = 7) {
  if (!process.env.SPORTMONKS_API_TOKEN) return null;
  const from = new Date();
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + Math.max(1, Math.min(Number(days) || 7, 14)));
  const fromIso = isoDate(from);
  const toIso = isoDate(to);

  const { payload } = await cachedProviderCall({
    cacheKey: `sportmonks:upcoming:${fromIso}:${toIso}`,
    provider: 'Sportmonks',
    ttlSeconds: 300,
    staleSeconds: 3600,
    loader: async () => {
      const result = await sportmonksGet(`/fixtures/between/${fromIso}/${toIso}`, { include: 'participants;league;state' });
      if (!result.ok) return null;
      return (result.data?.data || [])
        .map((fixture) => normalizeSportmonksFixture(fixture, false))
        .filter(Boolean)
        .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
        .slice(0, 160);
    }
  });
  return Array.isArray(payload) ? payload : null;
}

async function footballDataUpcoming(days = 7) {
  if (!process.env.FOOTBALL_DATA_KEY) return null;

  const from = new Date();
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + Math.max(1, Math.min(Number(days) || 7, 14)));
  const fromIso = isoDate(from);
  const toIso = isoDate(to);

  const { payload } = await cachedProviderCall({
    cacheKey: `football-data:upcoming:${fromIso}:${toIso}`,
    provider: 'Football-Data',
    ttlSeconds: 300,
    staleSeconds: 3600,
    loader: async () => {
      const data = await fetchJson(
        `${FOOTBALL_DATA_BASE}/matches?dateFrom=${fromIso}&dateTo=${toIso}`,
        { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY } }
      );

      const excluded = new Set(['FINISHED', 'POSTPONED', 'CANCELLED', 'SUSPENDED']);
      return (data.matches || [])
        .filter((match) => !excluded.has(String(match.status || '').toUpperCase()))
        .map((match) => ({
          id: String(match.id || ''),
          date: match.utcDate || null,
          league: match.competition?.name || null,
          country: match.area?.name || match.competition?.area?.name || null,
          home: match.homeTeam?.name || '',
          away: match.awayTeam?.name || '',
          status: match.status || null,
          source: 'Football-Data'
        }))
        .filter((match) => match.home && match.away)
        .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
        .slice(0, 160);
    }
  });
  return Array.isArray(payload) ? payload : null;
}

async function footballDataToday() {
  return footballDataUpcoming(7);
}

async function primaryLiveMatches(fallback) {
  if (hasRapidApi()) {
    try {
      const matches = await rapidLiveMatches();
      if (Array.isArray(matches) && matches.length) return matches;
    } catch (error) {
      console.warn('rapidapi live fallback', error.message);
    }
  }

  if (process.env.SPORTMONKS_API_TOKEN) {
    try {
      const matches = await sportmonksLiveMatches();
      if (Array.isArray(matches) && matches.length) return matches;
    } catch (error) {
      console.warn('sportmonks live fallback', error.message);
    }
  }

  return typeof fallback === 'function' ? fallback() : [];
}

async function primaryUpcomingMatches(fallback) {
  if (process.env.FOOTBALL_DATA_KEY) {
    try {
      const matches = await footballDataUpcoming(7);
      if (Array.isArray(matches) && matches.length) return matches;
    } catch (error) {
      console.warn('football-data upcoming fallback', error.message);
    }
  }

  if (process.env.SPORTMONKS_API_TOKEN) {
    try {
      const matches = await sportmonksUpcoming(7);
      if (Array.isArray(matches) && matches.length) return matches;
    } catch (error) {
      console.warn('sportmonks upcoming fallback', error.message);
    }
  }

  return typeof fallback === 'function' ? fallback() : [];
}

module.exports = {
  hasRapidApi,
  rapidHosts,
  rapidRequest,
  rapidLiveMatches,
  sportmonksLiveMatches,
  footballDataToday,
  footballDataUpcoming,
  sportmonksUpcoming,
  primaryLiveMatches,
  primaryUpcomingMatches
};
