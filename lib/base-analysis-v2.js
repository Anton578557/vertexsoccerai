'use strict';

const TSB_KEY = process.env.THESPORTSDB_KEY || '123';
const TSB_BASE = `https://www.thesportsdb.com/api/v1/json/${TSB_KEY}`;

function clean(value, max = 120) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalize(value) {
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\b(fc|cf|afc|sc|club|de|the|ud|cd)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreName(a, b) {
  const x = normalize(a); const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.92;
  const xs = new Set(x.split(' ')); const ys = new Set(y.split(' '));
  const common = [...xs].filter((token) => ys.has(token)).length;
  return common / Math.max(xs.size, ys.size, 1);
}

async function fetchJson(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'VertexSoccerAI/4.0', ...(options.headers || {}) }
    });
    if (!response.ok) throw new Error(`Upstream ${response.status}`);
    return response.json();
  } finally { clearTimeout(timer); }
}

async function findTeam(name) {
  const query = encodeURIComponent(clean(name, 80));
  try {
    const data = await fetchJson(`${TSB_BASE}/searchteams.php?t=${query}`);
    const teams = (data?.teams || []).filter((team) => team?.strSport === 'Soccer');
    if (!teams.length) return null;
    teams.sort((a, b) => scoreName(b.strTeam, name) - scoreName(a.strTeam, name));
    const team = teams[0];
    return {
      id: team.idTeam || null,
      name: team.strTeam || clean(name, 80),
      badge: team.strBadge || null,
      league: team.strLeague || null,
      country: team.strCountry || null,
      stadium: team.strStadium || null,
      stadiumLocation: team.strStadiumLocation || null
    };
  } catch (_) {
    return null;
  }
}

async function weatherForLocation(location) {
  const key = String(process.env.OPENWEATHER_KEY || '').trim();
  if (!key || !location) return null;
  try {
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
  } catch (_) {
    return null;
  }
}

function emptyForm() {
  return { played: 0, wins: 0, draws: 0, losses: 0, sequence: [], avgFor: null, avgAgainst: null, ppg: null };
}

async function buildBaseAnalysis(homeInput, awayInput) {
  const homeName = clean(homeInput, 80);
  const awayName = clean(awayInput, 80);
  if (!homeName || !awayName) throw new Error('Two team names are required.');
  if (normalize(homeName) === normalize(awayName)) throw new Error('Choose two different teams.');

  const [homeMeta, awayMeta] = await Promise.all([findTeam(homeName), findTeam(awayName)]);
  const resolvedHome = homeMeta?.name || homeName;
  const resolvedAway = awayMeta?.name || awayName;
  const location = homeMeta?.stadiumLocation || homeMeta?.country || null;
  const weather = await weatherForLocation(location);

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
    form: { home: emptyForm(), away: emptyForm() },
    model: null,
    confidence: null,
    dataQuality: 0,
    weather,
    news: [],
    sourceStatus: {
      primaryFootball: 'Pending',
      teamMetadata: homeMeta && awayMeta ? 'TheSportsDB' : 'Partial',
      weather: weather ? 'OpenWeather' : 'Not connected / unavailable'
    },
    limitations: []
  };
}

module.exports = { buildBaseAnalysis };
