'use strict';

const { resolveTeamName } = require('./team-aliases');
const { cachedProviderCall } = require('./provider-cache');

const TSB_KEY = process.env.THESPORTSDB_KEY || '123';
const TSB_BASE = `https://www.thesportsdb.com/api/v1/json/${TSB_KEY}`;

function clean(value, max = 120) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalize(value) {
  return clean(resolveTeamName(value))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|afc|sc|club|de|the|ud|cd|ac|as|ss)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeKey(value) {
  return clean(value, 100).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'unknown';
}

function scoreName(a, b) {
  const x = normalize(a); const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  // Partial names must not silently resolve to a different club or squad.
  if (youthOrReserveName(a) !== youthOrReserveName(b)) return 0;
  if (/\b(women|ladies)\b/i.test(a) !== /\b(women|ladies)\b/i.test(b)) return 0;
  const xs = new Set(x.split(' ')); const ys = new Set(y.split(' '));
  const common = [...xs].filter((token) => ys.has(token)).length;
  return common / Math.max(xs.size, ys.size, 1);
}

function sameTeam(a, b) {
  return scoreName(a, b) >= 0.58;
}

function youthOrReserveName(value) {
  const text = clean(value).toLowerCase();
  return /\b(youth|academy|reserve|reserves|u\s?-?\d{2}|under\s?-?\d{2}|primavera|b team|ii)\b/i.test(text);
}

function queryWantsYouthOrReserve(value) {
  return youthOrReserveName(value);
}

function teamCandidateScore(team, query) {
  const name = team?.strTeam || '';
  let score = scoreName(name, query);
  if (!queryWantsYouthOrReserve(query) && youthOrReserveName(name)) score -= 0.8;
  if (team?.strLeague && !/youth|u\s?-?\d{2}|academy|reserve/i.test(team.strLeague)) score += 0.05;
  if (team?.strStadium) score += 0.02;
  return score;
}

function chooseTeamCandidate(teams, query) {
  const ranked = [...teams].sort((a, b) => teamCandidateScore(b, query) - teamCandidateScore(a, query));
  if (!ranked.length) return null;
  const eligible = ranked.filter((team) => scoreName(team?.strTeam, query) >= 0.8);
  if (!eligible.length) return null;
  if (eligible.length > 1 && scoreName(eligible[0].strTeam, query) === scoreName(eligible[1].strTeam, query) && eligible[0].idTeam !== eligible[1].idTeam) return null;
  return eligible[0];
}

async function fetchJson(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'VertexSoccerAI/4.1', ...(options.headers || {}) }
    });
    if (!response.ok) throw new Error(`Upstream ${response.status}`);
    return response.json();
  } finally { clearTimeout(timer); }
}

async function findTeam(name) {
  try {
    const { payload } = await cachedProviderCall({
      cacheKey: `thesportsdb:team:v4:${safeKey(name)}`,
      provider: 'TheSportsDB',
      ttlSeconds: 7 * 24 * 3600,
      staleSeconds: 30 * 24 * 3600,
      loader: async () => {
        const query = encodeURIComponent(clean(name, 80));
        const data = await fetchJson(`${TSB_BASE}/searchteams.php?t=${query}`);
        const teams = (data?.teams || []).filter((team) => team?.strSport === 'Soccer');
        if (!teams.length) return null;
        const team = chooseTeamCandidate(teams, name);
        if (!team) return null;
        return {
          id: team.idTeam || null,
          name: team.strTeam || clean(name, 80),
          badge: team.strBadge || null,
          league: team.strLeague || null,
          country: team.strCountry || null,
          stadium: team.strStadium || null,
          stadiumLocation: team.strStadiumLocation || null
        };
      }
    });
    return payload || null;
  } catch (_) {
    return null;
  }
}

async function recentEvents(teamId) {
  if (!teamId) return [];
  try {
    const { payload } = await cachedProviderCall({
      cacheKey: `thesportsdb:recent:${String(teamId).slice(0, 60)}`,
      provider: 'TheSportsDB',
      ttlSeconds: 600,
      staleSeconds: 21600,
      loader: async () => {
        const data = await fetchJson(`${TSB_BASE}/eventslast.php?id=${encodeURIComponent(teamId)}`);
        return (data?.results || data?.events || []).map((item) => ({
          status: item.strStatus || null,
          date: item.strTimestamp || item.dateEvent || null,
          home: item.strHomeTeam || '',
          away: item.strAwayTeam || '',
          homeScore: item.intHomeScore === null || item.intHomeScore === '' ? null : Number(item.intHomeScore),
          awayScore: item.intAwayScore === null || item.intAwayScore === '' ? null : Number(item.intAwayScore)
        }));
      }
    });
    return Array.isArray(payload) ? payload : [];
  } catch (_) {
    return [];
  }
}

function formStats(events, teamName, limit = 8) {
  const usable = events
    .filter((match) => match.date && Number.isFinite(new Date(match.date).getTime()) && new Date(match.date).getTime() <= Date.now() && (!match.status || /^(match finished|ft|aet|pen|finished)$/i.test(match.status)))
    .filter((match) => (sameTeam(match.home, teamName) || sameTeam(match.away, teamName)) && Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, limit);

  let gf = 0; let ga = 0; let wins = 0; let draws = 0; let losses = 0;
  const sequence = [];
  for (const match of usable) {
    const isHome = sameTeam(match.home, teamName);
    const scored = isHome ? match.homeScore : match.awayScore;
    const conceded = isHome ? match.awayScore : match.homeScore;
    gf += scored; ga += conceded;
    if (scored > conceded) { wins += 1; sequence.push('W'); }
    else if (scored === conceded) { draws += 1; sequence.push('D'); }
    else { losses += 1; sequence.push('L'); }
  }
  const played = wins + draws + losses;
  return {
    played,
    wins,
    draws,
    losses,
    sequence,
    avgFor: played ? gf / played : null,
    avgAgainst: played ? ga / played : null,
    ppg: played ? (wins * 3 + draws) / played : null
  };
}

async function weatherForLocation(location) {
  const key = String(process.env.OPENWEATHER_KEY || '').trim();
  if (!key || !location) return null;
  try {
    const { payload } = await cachedProviderCall({
      cacheKey: `openweather:current:${safeKey(location)}`,
      provider: 'OpenWeather',
      ttlSeconds: 600,
      staleSeconds: 3600,
      loader: async () => {
        const geo = await fetchJson(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(clean(location, 100))}&limit=1&appid=${encodeURIComponent(key)}`);
        if (!Array.isArray(geo) || !geo[0]) return null;
        const { lat, lon, name, country } = geo[0];
        const current = await fetchJson(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${encodeURIComponent(key)}`);
        return {
          location: [name, country].filter(Boolean).join(', '),
          tempC: Number.isFinite(current?.main?.temp) ? Math.round(current.main.temp) : null,
          feelsLikeC: Number.isFinite(current?.main?.feels_like) ? Math.round(current.main.feels_like) : null,
          humidity: current?.main?.humidity ?? null,
          windMs: current?.wind?.speed ?? null,
          condition: current?.weather?.[0]?.description || null,
          context: 'Current conditions near the venue area'
        };
      }
    });
    return payload || null;
  } catch (_) {
    return null;
  }
}

function emptyForm() {
  return { played: 0, wins: 0, draws: 0, losses: 0, sequence: [], avgFor: null, avgAgainst: null, ppg: null };
}

async function buildBaseAnalysis(homeInput, awayInput) {
  const homeName = clean(resolveTeamName(homeInput), 80);
  const awayName = clean(resolveTeamName(awayInput), 80);
  if (!homeName || !awayName) throw new Error('Two team names are required.');
  if (normalize(homeName) === normalize(awayName)) throw new Error('Choose two different teams.');

  const [homeMeta, awayMeta] = await Promise.all([findTeam(homeName), findTeam(awayName)]);
  const resolvedHome = homeMeta?.name || homeName;
  const resolvedAway = awayMeta?.name || awayName;
  const location = homeMeta?.stadiumLocation || homeMeta?.country || null;

  const [homeEvents, awayEvents, weather] = await Promise.all([
    recentEvents(homeMeta?.id),
    recentEvents(awayMeta?.id),
    weatherForLocation(location)
  ]);

  const homeForm = homeEvents.length ? formStats(homeEvents, resolvedHome) : emptyForm();
  const awayForm = awayEvents.length ? formStats(awayEvents, resolvedAway) : emptyForm();
  const hasFallbackForm = homeForm.played > 0 || awayForm.played > 0;

  return {
    generatedAt: new Date().toISOString(),
    teams: {
      home: { name: resolvedHome, badge: homeMeta?.badge || null, country: homeMeta?.country || null },
      away: { name: resolvedAway, badge: awayMeta?.badge || null, country: awayMeta?.country || null }
    },
    fixture: {
      date: null,
      league: homeMeta?.league || awayMeta?.league || null,
      venue: homeMeta?.stadium || null,
      city: location,
      source: null
    },
    form: { home: homeForm, away: awayForm },
    model: null,
    confidence: null,
    dataQuality: 0,
    weather,
    news: [],
    sourceStatus: {
      primaryFootball: hasFallbackForm ? 'TheSportsDB fallback' : 'Pending',
      teamMetadata: homeMeta && awayMeta ? 'TheSportsDB' : 'Partial',
      weather: weather ? 'OpenWeather' : 'Not connected / unavailable'
    },
    limitations: []
  };
}

module.exports = { buildBaseAnalysis, chooseTeamCandidate, formStats };
