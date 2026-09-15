'use strict';

const TSB_KEY = process.env.THESPORTSDB_KEY || '123';
const TSB_BASE = `https://www.thesportsdb.com/api/v1/json/${TSB_KEY}`;
const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';

function clean(value, max = 120) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function normalizeName(value) {
  return clean(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|afc|sc|calcio|club|de|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameScore(a, b) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const xs = new Set(x.split(' '));
  const ys = new Set(y.split(' '));
  const common = [...xs].filter((v) => ys.has(v)).length;
  return common / Math.max(xs.size, ys.size, 1);
}

function sameTeam(a, b) {
  return nameScore(a, b) >= 0.6;
}

async function fetchJson(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VertexSoccerAI/2.0',
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const error = new Error(`Upstream ${response.status}`);
      error.status = response.status;
      error.details = text.slice(0, 240);
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchTheSportsDbTeam(name) {
  const query = encodeURIComponent(clean(name, 80));
  const data = await fetchJson(`${TSB_BASE}/searchteams.php?t=${query}`);
  const teams = (data.teams || []).filter((team) => team.strSport === 'Soccer');
  if (!teams.length) return null;
  teams.sort((a, b) => nameScore(b.strTeam, name) - nameScore(a.strTeam, name));
  const team = teams[0];
  return {
    source: 'TheSportsDB',
    id: team.idTeam,
    name: team.strTeam,
    shortName: team.strTeamShort || null,
    badge: team.strBadge || null,
    league: team.strLeague || null,
    leagueId: team.idLeague || null,
    country: team.strCountry || null,
    stadium: team.strStadium || null,
    stadiumLocation: team.strStadiumLocation || null,
    website: team.strWebsite || null
  };
}

async function searchTheSportsDbTeams(query) {
  const q = encodeURIComponent(clean(query, 80));
  const data = await fetchJson(`${TSB_BASE}/searchteams.php?t=${q}`);
  return (data.teams || [])
    .filter((team) => team.strSport === 'Soccer')
    .slice(0, 8)
    .map((team) => ({
      id: team.idTeam,
      name: team.strTeam,
      league: team.strLeague || '',
      country: team.strCountry || '',
      badge: team.strBadge || null
    }));
}

async function searchApiFootballTeam(name) {
  if (!process.env.API_FOOTBALL_KEY) return null;
  const data = await fetchJson(`${API_FOOTBALL_BASE}/teams?search=${encodeURIComponent(clean(name, 80))}`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
  });
  const items = data.response || [];
  if (!items.length) return null;
  items.sort((a, b) => nameScore(b.team?.name, name) - nameScore(a.team?.name, name));
  const hit = items[0];
  return {
    id: hit.team?.id,
    name: hit.team?.name,
    badge: hit.team?.logo || null,
    country: hit.team?.country || null,
    venue: hit.venue || null
  };
}

async function apiFootballRecent(teamId, count = 8) {
  if (!process.env.API_FOOTBALL_KEY || !teamId) return [];
  const data = await fetchJson(`${API_FOOTBALL_BASE}/fixtures?team=${encodeURIComponent(teamId)}&last=${count}`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
  });
  return (data.response || []).map((item) => ({
    id: String(item.fixture?.id || ''),
    date: item.fixture?.date || null,
    status: item.fixture?.status?.short || null,
    league: item.league?.name || null,
    home: item.teams?.home?.name || '',
    away: item.teams?.away?.name || '',
    homeScore: Number.isFinite(item.goals?.home) ? item.goals.home : null,
    awayScore: Number.isFinite(item.goals?.away) ? item.goals.away : null,
    venue: item.fixture?.venue?.name || null,
    city: item.fixture?.venue?.city || null,
    source: 'API-Football'
  }));
}

async function apiFootballUpcoming(homeId, awayName) {
  if (!process.env.API_FOOTBALL_KEY || !homeId) return null;
  const data = await fetchJson(`${API_FOOTBALL_BASE}/fixtures?team=${encodeURIComponent(homeId)}&next=12`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
  });
  const items = data.response || [];
  const item = items.find((fixture) => {
    const home = fixture.teams?.home?.name || '';
    const away = fixture.teams?.away?.name || '';
    return sameTeam(home, awayName) || sameTeam(away, awayName);
  });
  if (!item) return null;
  return {
    id: String(item.fixture?.id || ''),
    date: item.fixture?.date || null,
    league: item.league?.name || null,
    home: item.teams?.home?.name || '',
    away: item.teams?.away?.name || '',
    venue: item.fixture?.venue?.name || null,
    city: item.fixture?.venue?.city || null,
    source: 'API-Football'
  };
}

function isoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

async function footballDataWindow(homeName, awayName) {
  if (!process.env.FOOTBALL_DATA_KEY) return { matches: [], fixture: null };
  const today = new Date();
  const from = new Date(today);
  const to = new Date(today);
  from.setDate(from.getDate() - 75);
  to.setDate(to.getDate() + 21);

  const url = `${FOOTBALL_DATA_BASE}/matches?dateFrom=${isoDate(from)}&dateTo=${isoDate(to)}`;
  const data = await fetchJson(url, {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY }
  });

  const all = (data.matches || []).map((match) => ({
    id: String(match.id || ''),
    date: match.utcDate || null,
    status: match.status || null,
    league: match.competition?.name || null,
    home: match.homeTeam?.name || '',
    away: match.awayTeam?.name || '',
    homeScore: Number.isFinite(match.score?.fullTime?.home) ? match.score.fullTime.home : null,
    awayScore: Number.isFinite(match.score?.fullTime?.away) ? match.score.fullTime.away : null,
    venue: null,
    city: null,
    source: 'Football-Data'
  }));

  const relevant = all.filter((m) =>
    sameTeam(m.home, homeName) || sameTeam(m.away, homeName) || sameTeam(m.home, awayName) || sameTeam(m.away, awayName)
  );

  const fixture = relevant.find((m) => {
    const exact = (sameTeam(m.home, homeName) && sameTeam(m.away, awayName)) ||
      (sameTeam(m.home, awayName) && sameTeam(m.away, homeName));
    return exact && new Date(m.date || 0).getTime() >= Date.now() - 6 * 60 * 60 * 1000;
  }) || null;

  return { matches: relevant, fixture };
}

async function theSportsDbRecent(teamId) {
  if (!teamId) return [];
  try {
    const data = await fetchJson(`${TSB_BASE}/eventslast.php?id=${encodeURIComponent(teamId)}`);
    return (data.results || data.events || []).map((item) => ({
      id: String(item.idEvent || ''),
      date: item.strTimestamp || item.dateEvent || null,
      status: item.strStatus || null,
      league: item.strLeague || null,
      home: item.strHomeTeam || '',
      away: item.strAwayTeam || '',
      homeScore: item.intHomeScore === null || item.intHomeScore === '' ? null : Number(item.intHomeScore),
      awayScore: item.intAwayScore === null || item.intAwayScore === '' ? null : Number(item.intAwayScore),
      venue: item.strVenue || null,
      city: null,
      source: 'TheSportsDB'
    }));
  } catch (_) {
    return [];
  }
}

function completedForTeam(events, teamName, limit = 8) {
  return events
    .filter((m) => (sameTeam(m.home, teamName) || sameTeam(m.away, teamName)) && Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, limit);
}

function formStats(events, teamName) {
  let gf = 0;
  let ga = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  const sequence = [];

  for (const match of events) {
    const isHome = sameTeam(match.home, teamName);
    const scored = isHome ? match.homeScore : match.awayScore;
    const conceded = isHome ? match.awayScore : match.homeScore;
    if (!Number.isFinite(scored) || !Number.isFinite(conceded)) continue;
    gf += scored;
    ga += conceded;
    if (scored > conceded) { wins++; sequence.push('W'); }
    else if (scored === conceded) { draws++; sequence.push('D'); }
    else { losses++; sequence.push('L'); }
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function factorial(n) {
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
}

function poisson(lambda, k) {
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
}

function probabilityModel(home, away) {
  if (!home.played || !away.played || home.avgFor === null || away.avgFor === null) return null;

  const homeFormBoost = clamp(((home.ppg || 1.2) - 1.35) * 0.08, -0.16, 0.16);
  const awayFormBoost = clamp(((away.ppg || 1.2) - 1.35) * 0.08, -0.16, 0.16);

  const homeXg = clamp((home.avgFor * 0.56 + away.avgAgainst * 0.44) * 1.08 + homeFormBoost, 0.2, 4.0);
  const awayXg = clamp((away.avgFor * 0.56 + home.avgAgainst * 0.44) * 0.94 + awayFormBoost, 0.2, 4.0);

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over25 = 0;
  let btts = 0;
  let best = { p: 0, home: 0, away: 0 };

  for (let h = 0; h <= 7; h++) {
    for (let a = 0; a <= 7; a++) {
      const p = poisson(homeXg, h) * poisson(awayXg, a);
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
      if (h + a >= 3) over25 += p;
      if (h > 0 && a > 0) btts += p;
      if (p > best.p) best = { p, home: h, away: a };
    }
  }

  const total = homeWin + draw + awayWin;
  homeWin /= total;
  draw /= total;
  awayWin /= total;

  const outcomes = [
    { key: 'HOME', label: 'Home win', p: homeWin },
    { key: 'DRAW', label: 'Draw', p: draw },
    { key: 'AWAY', label: 'Away win', p: awayWin }
  ].sort((a, b) => b.p - a.p);

  return {
    expectedGoals: { home: homeXg, away: awayXg, total: homeXg + awayXg },
    oneXtwo: { home: homeWin, draw, away: awayWin },
    doubleChance: { oneX: homeWin + draw, xTwo: draw + awayWin, oneTwo: homeWin + awayWin },
    over25,
    under25: 1 - over25,
    btts,
    noBtts: 1 - btts,
    correctScore: `${best.home}-${best.away}`,
    correctScoreProbability: best.p,
    mainOutcome: outcomes[0],
    secondOutcome: outcomes[1],
    separation: outcomes[0].p - outcomes[1].p
  };
}

async function weatherForLocation(location) {
  if (!process.env.OPENWEATHER_KEY || !location) return null;
  try {
    const geocode = await fetchJson(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(clean(location, 100))}&limit=1&appid=${process.env.OPENWEATHER_KEY}`);
    if (!Array.isArray(geocode) || !geocode[0]) return null;
    const { lat, lon, name, country } = geocode[0];
    const current = await fetchJson(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.OPENWEATHER_KEY}`);
    return {
      location: [name, country].filter(Boolean).join(', '),
      tempC: Number.isFinite(current.main?.temp) ? Math.round(current.main.temp) : null,
      feelsLikeC: Number.isFinite(current.main?.feels_like) ? Math.round(current.main.feels_like) : null,
      humidity: current.main?.humidity ?? null,
      windMs: current.wind?.speed ?? null,
      condition: current.weather?.[0]?.description || null,
      context: 'Current conditions near the venue area'
    };
  } catch (_) {
    return null;
  }
}

function classifyHeadline(title) {
  const text = String(title || '').toLowerCase();
  const negative = ['injury', 'injured', 'out ', 'suspended', 'suspension', 'doubt', 'miss ', 'ruled out', 'crisis'];
  const positive = ['returns', 'return ', 'fit ', 'boost', 'back in training', 'recovered'];
  if (negative.some((term) => text.includes(term))) return 'negative';
  if (positive.some((term) => text.includes(term))) return 'positive';
  return 'neutral';
}

async function newsForTeams(homeName, awayName) {
  if (!process.env.NEWSAPI_KEY) return [];
  try {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const q = `\"${clean(homeName, 60)}\" OR \"${clean(awayName, 60)}\"`;
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&searchIn=title,description&language=en&sortBy=publishedAt&pageSize=6&from=${isoDate(from)}`;
    const data = await fetchJson(url, { headers: { 'X-Api-Key': process.env.NEWSAPI_KEY } });
    return (data.articles || []).slice(0, 6).map((article) => ({
      title: article.title,
      source: article.source?.name || null,
      publishedAt: article.publishedAt || null,
      url: article.url || null,
      signal: classifyHeadline(article.title)
    }));
  } catch (_) {
    return [];
  }
}

function pct(value) {
  return Math.round(clamp(value, 0, 1) * 100);
}

function qualityScore({ homeForm, awayForm, homeMeta, awayMeta, fixture, weather, news, source }) {
  let score = 10;
  score += Math.min(20, homeForm.played * 4);
  score += Math.min(20, awayForm.played * 4);
  if (homeMeta && awayMeta) score += 12;
  if (fixture) score += 12;
  if (weather) score += 8;
  if (news?.length) score += 8;
  if (source === 'API-Football') score += 10;
  else if (source === 'Football-Data') score += 7;
  return clamp(Math.round(score), 0, 100);
}

async function buildAnalysis(homeInput, awayInput) {
  const homeName = clean(homeInput, 80);
  const awayName = clean(awayInput, 80);
  if (!homeName || !awayName) throw new Error('Two team names are required.');
  if (normalizeName(homeName) === normalizeName(awayName)) throw new Error('Choose two different teams.');

  const [homeMeta, awayMeta, homeApi, awayApi] = await Promise.all([
    searchTheSportsDbTeam(homeName).catch(() => null),
    searchTheSportsDbTeam(awayName).catch(() => null),
    searchApiFootballTeam(homeName).catch(() => null),
    searchApiFootballTeam(awayName).catch(() => null)
  ]);

  const resolvedHome = homeApi?.name || homeMeta?.name || homeName;
  const resolvedAway = awayApi?.name || awayMeta?.name || awayName;

  let source = null;
  let homeEvents = [];
  let awayEvents = [];
  let fixture = null;

  if (process.env.API_FOOTBALL_KEY && homeApi?.id && awayApi?.id) {
    const [h, a, upcoming] = await Promise.all([
      apiFootballRecent(homeApi.id, 8).catch(() => []),
      apiFootballRecent(awayApi.id, 8).catch(() => []),
      apiFootballUpcoming(homeApi.id, resolvedAway).catch(() => null)
    ]);
    homeEvents = h;
    awayEvents = a;
    fixture = upcoming;
    if (h.length || a.length) source = 'API-Football';
  }

  if (!source && process.env.FOOTBALL_DATA_KEY) {
    try {
      const window = await footballDataWindow(resolvedHome, resolvedAway);
      homeEvents = completedForTeam(window.matches, resolvedHome, 8);
      awayEvents = completedForTeam(window.matches, resolvedAway, 8);
      fixture = window.fixture;
      if (homeEvents.length || awayEvents.length) source = 'Football-Data';
    } catch (_) {
      // Fall through to TheSportsDB development fallback.
    }
  }

  if (!source) {
    const [h, a] = await Promise.all([
      theSportsDbRecent(homeMeta?.id).catch(() => []),
      theSportsDbRecent(awayMeta?.id).catch(() => [])
    ]);
    homeEvents = h;
    awayEvents = a;
    if (h.length || a.length) source = 'TheSportsDB';
  }

  homeEvents = completedForTeam(homeEvents, resolvedHome, 8);
  awayEvents = completedForTeam(awayEvents, resolvedAway, 8);
  const homeForm = formStats(homeEvents, resolvedHome);
  const awayForm = formStats(awayEvents, resolvedAway);
  const model = homeForm.played >= 2 && awayForm.played >= 2 ? probabilityModel(homeForm, awayForm) : null;

  const venueLocation = fixture?.city || homeApi?.venue?.city || homeMeta?.stadiumLocation || homeMeta?.country || null;
  const [weather, news] = await Promise.all([
    weatherForLocation(venueLocation),
    newsForTeams(resolvedHome, resolvedAway)
  ]);

  const quality = qualityScore({ homeForm, awayForm, homeMeta, awayMeta, fixture, weather, news, source });
  const confidence = model
    ? clamp(Math.round(pct(model.mainOutcome.p) * (0.66 + (quality / 100) * 0.34) + model.separation * 20), 35, 94)
    : null;

  return {
    generatedAt: new Date().toISOString(),
    teams: {
      home: { name: resolvedHome, badge: homeApi?.badge || homeMeta?.badge || null, country: homeApi?.country || homeMeta?.country || null },
      away: { name: resolvedAway, badge: awayApi?.badge || awayMeta?.badge || null, country: awayApi?.country || awayMeta?.country || null }
    },
    fixture: fixture ? {
      date: fixture.date,
      league: fixture.league,
      venue: fixture.venue || homeApi?.venue?.name || homeMeta?.stadium || null,
      city: fixture.city || venueLocation || null,
      source: fixture.source
    } : {
      date: null,
      league: homeMeta?.league || awayMeta?.league || null,
      venue: homeApi?.venue?.name || homeMeta?.stadium || null,
      city: venueLocation,
      source: null
    },
    form: { home: homeForm, away: awayForm },
    model: model ? {
      expectedGoals: {
        home: Number(model.expectedGoals.home.toFixed(2)),
        away: Number(model.expectedGoals.away.toFixed(2)),
        total: Number(model.expectedGoals.total.toFixed(2))
      },
      oneXtwo: { home: pct(model.oneXtwo.home), draw: pct(model.oneXtwo.draw), away: pct(model.oneXtwo.away) },
      doubleChance: { oneX: pct(model.doubleChance.oneX), xTwo: pct(model.doubleChance.xTwo), oneTwo: pct(model.doubleChance.oneTwo) },
      over25: pct(model.over25),
      under25: pct(model.under25),
      btts: pct(model.btts),
      noBtts: pct(model.noBtts),
      correctScore: model.correctScore,
      correctScoreProbability: pct(model.correctScoreProbability),
      mainScenario: model.mainOutcome.label
    } : null,
    confidence,
    dataQuality: quality,
    weather,
    news,
    sourceStatus: {
      primaryFootball: source || 'Unavailable',
      teamMetadata: homeMeta && awayMeta ? 'TheSportsDB' : 'Partial',
      weather: weather ? 'OpenWeather' : 'Not connected / unavailable',
      news: news.length ? 'NewsAPI' : 'Not connected / unavailable'
    },
    limitations: [
      homeForm.played < 5 || awayForm.played < 5 ? 'Recent-form sample is smaller than the preferred five completed matches.' : null,
      !fixture?.date ? 'Exact scheduled fixture was not resolved from the current providers.' : null,
      !weather ? 'Weather was not included in this run.' : null,
      !news.length ? 'Recent news was not included in this run.' : null,
      !model ? 'Not enough completed-match data to calculate a responsible probability model.' : null
    ].filter(Boolean)
  };
}

async function liveMatches() {
  if (process.env.THESPORTSDB_V2_KEY) {
    try {
      const data = await fetchJson('https://www.thesportsdb.com/api/v2/json/livescore/soccer', {
        headers: { 'X-API-KEY': process.env.THESPORTSDB_V2_KEY }
      });
      const events = data.events || data.livescores || data || [];
      if (Array.isArray(events)) {
        return events.slice(0, 50).map((item) => ({
          id: String(item.idEvent || item.id || ''),
          league: item.strLeague || item.league || null,
          minute: item.strProgress || item.strStatus || 'LIVE',
          home: item.strHomeTeam || item.homeTeam || '',
          away: item.strAwayTeam || item.awayTeam || '',
          homeScore: item.intHomeScore ?? item.homeScore ?? null,
          awayScore: item.intAwayScore ?? item.awayScore ?? null,
          source: 'TheSportsDB'
        }));
      }
    } catch (_) {}
  }

  if (process.env.API_FOOTBALL_KEY) {
    const data = await fetchJson(`${API_FOOTBALL_BASE}/fixtures?live=all`, {
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });
    return (data.response || []).slice(0, 50).map((item) => ({
      id: String(item.fixture?.id || ''),
      league: item.league?.name || null,
      minute: item.fixture?.status?.elapsed ? `${item.fixture.status.elapsed}'` : (item.fixture?.status?.short || 'LIVE'),
      home: item.teams?.home?.name || '',
      away: item.teams?.away?.name || '',
      homeScore: item.goals?.home ?? null,
      awayScore: item.goals?.away ?? null,
      source: 'API-Football'
    }));
  }

  return null;
}

async function upcomingMatches() {
  if (process.env.API_FOOTBALL_KEY) {
    const today = new Date();
    const date = isoDate(today);
    const data = await fetchJson(`${API_FOOTBALL_BASE}/fixtures?date=${date}`, {
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });
    return (data.response || []).slice(0, 100).map((item) => ({
      id: String(item.fixture?.id || ''),
      date: item.fixture?.date || null,
      league: item.league?.name || null,
      country: item.league?.country || null,
      home: item.teams?.home?.name || '',
      away: item.teams?.away?.name || '',
      source: 'API-Football'
    }));
  }
  return null;
}

module.exports = {
  clean,
  searchTheSportsDbTeams,
  buildAnalysis,
  liveMatches,
  upcomingMatches
};
