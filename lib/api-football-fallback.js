'use strict';

const { apiFootballGet } = require('./api-football-client');
const { cachedProviderCall } = require('./provider-cache');

function clean(value, max = 120) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalize(value) {
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\b(fc|cf|afc|sc|club|de|the|ud|cd|real|rcd|ac|as|ss)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function nameScore(a, b) {
  const x = normalize(a); const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.92;
  const xs = new Set(x.split(' ')); const ys = new Set(y.split(' '));
  const common = [...xs].filter((token) => ys.has(token)).length;
  return common / Math.max(xs.size, ys.size, 1);
}

function sameTeam(a, b) { return nameScore(a, b) >= 0.58; }
function youthOrReserveName(value) { return /\b(youth|academy|reserve|reserves|u\s?-?\d{2}|under\s?-?\d{2}|primavera|b team|ii)\b/i.test(clean(value)); }
function wantsYouthOrReserve(value) { return youthOrReserveName(value); }

function candidateScore(row, query) {
  const name = row?.team?.name || '';
  let score = nameScore(name, query);
  if (!wantsYouthOrReserve(query) && youthOrReserveName(name)) score -= 0.8;
  return score;
}

function safeKey(value) {
  return clean(value, 80).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'unknown';
}

async function cachedApi(path, params, cacheKey, ttlSeconds) {
  const { payload, cacheHit } = await cachedProviderCall({
    cacheKey,
    provider: 'API-Football',
    ttlSeconds,
    loader: async () => {
      const result = await apiFootballGet(path, params);
      if (!result.ok) return null;
      return result.data;
    }
  });
  return { data: payload, cacheHit };
}

async function resolveTeam(name) {
  const key = `api-football:v3:team:${safeKey(name)}`;
  const { data, cacheHit } = await cachedApi('/teams', { search: clean(name, 80) }, key, 7 * 24 * 3600);
  const rows = Array.isArray(data?.response) ? data.response : [];
  if (!rows.length) return { team: null, cacheHit };
  rows.sort((a, b) => candidateScore(b, name) - candidateScore(a, name));

  let hit = rows[0];
  if (!wantsYouthOrReserve(name)) {
    const senior = rows.find((row) => !youthOrReserveName(row?.team?.name) && nameScore(row?.team?.name, name) >= 0.58);
    if (senior) hit = senior;
    else if (youthOrReserveName(hit?.team?.name)) return { team: null, cacheHit };
  }

  return {
    cacheHit,
    team: {
      id: hit?.team?.id || null,
      name: hit?.team?.name || clean(name, 80),
      badge: hit?.team?.logo || null,
      country: hit?.team?.country || null,
      venue: hit?.venue || null
    }
  };
}

function mapFixture(item) {
  return {
    id: String(item?.fixture?.id || ''), date: item?.fixture?.date || null, league: item?.league?.name || null,
    leagueId: item?.league?.id || null, country: item?.league?.country || null,
    home: item?.teams?.home?.name || '', away: item?.teams?.away?.name || '',
    homeScore: Number.isFinite(item?.goals?.home) ? item.goals.home : null,
    awayScore: Number.isFinite(item?.goals?.away) ? item.goals.away : null,
    venue: item?.fixture?.venue?.name || null, city: item?.fixture?.venue?.city || null,
    status: item?.fixture?.status?.short || null, source: 'API-Football'
  };
}

async function recentFixtures(teamId, count = 8) {
  if (!teamId) return { rows: [], cacheHit: false };
  const key = `api-football:recent:${teamId}:${count}`;
  const { data, cacheHit } = await cachedApi('/fixtures', { team: teamId, last: count }, key, 6 * 3600);
  return { rows: (Array.isArray(data?.response) ? data.response : []).map(mapFixture), cacheHit };
}

async function upcomingFixtures(teamId) {
  if (!teamId) return { rows: [], cacheHit: false };
  const key = `api-football:next:${teamId}:15`;
  const { data, cacheHit } = await cachedApi('/fixtures', { team: teamId, next: 15 }, key, 45 * 60);
  return { rows: (Array.isArray(data?.response) ? data.response : []).map(mapFixture), cacheHit };
}

function formStats(events, teamName) {
  const rows = events.filter((m) => (sameTeam(m.home, teamName) || sameTeam(m.away, teamName)) && Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 8);
  let gf = 0; let ga = 0; let wins = 0; let draws = 0; let losses = 0; const sequence = [];
  for (const match of rows) {
    const isHome = sameTeam(match.home, teamName);
    const scored = isHome ? match.homeScore : match.awayScore;
    const conceded = isHome ? match.awayScore : match.homeScore;
    gf += scored; ga += conceded;
    if (scored > conceded) { wins += 1; sequence.push('W'); }
    else if (scored === conceded) { draws += 1; sequence.push('D'); }
    else { losses += 1; sequence.push('L'); }
  }
  const played = wins + draws + losses;
  return { played, wins, draws, losses, sequence, avgFor: played ? gf / played : null, avgAgainst: played ? ga / played : null, ppg: played ? (wins * 3 + draws) / played : null };
}

async function enrichApiFootballFallback(analysis) {
  if (!process.env.API_FOOTBALL_KEY || !analysis?.teams?.home?.name || !analysis?.teams?.away?.name) return { analysis, used: false, cacheHits: 0 };

  const currentHome = Number(analysis?.form?.home?.played || 0);
  const currentAway = Number(analysis?.form?.away?.played || 0);
  const needForm = !analysis.model && (currentHome < 3 || currentAway < 3);
  const needFixture = !analysis.fixture?.date;
  if (!needForm && !needFixture) return { analysis, used: false, cacheHits: 0 };

  const homeName = analysis.teams.home.name;
  const awayName = analysis.teams.away.name;
  const [homeResolved, awayResolved] = await Promise.all([resolveTeam(homeName), resolveTeam(awayName)]);
  if (!homeResolved.team?.id || !awayResolved.team?.id) {
    analysis.sourceStatus = { ...(analysis.sourceStatus || {}), apiFootball: 'Fallback unavailable · team resolution failed' };
    return { analysis, used: false, cacheHits: Number(homeResolved.cacheHit) + Number(awayResolved.cacheHit) };
  }

  let homeRecent = { rows: [], cacheHit: false };
  let awayRecent = { rows: [], cacheHit: false };
  let changed = false;

  if (needForm) {
    [homeRecent, awayRecent] = await Promise.all([recentFixtures(homeResolved.team.id, 8), recentFixtures(awayResolved.team.id, 8)]);
    const homeForm = formStats(homeRecent.rows, homeResolved.team.name);
    const awayForm = formStats(awayRecent.rows, awayResolved.team.name);
    if (homeForm.played > currentHome) { analysis.form.home = homeForm; changed = true; }
    if (awayForm.played > currentAway) { analysis.form.away = awayForm; changed = true; }
  }

  analysis.teams.home = {
    ...analysis.teams.home,
    name: homeResolved.team.name || analysis.teams.home.name,
    badge: analysis.teams.home.badge || homeResolved.team.badge || null,
    country: analysis.teams.home.country || homeResolved.team.country || null
  };
  analysis.teams.away = {
    ...analysis.teams.away,
    name: awayResolved.team.name || analysis.teams.away.name,
    badge: analysis.teams.away.badge || awayResolved.team.badge || null,
    country: analysis.teams.away.country || awayResolved.team.country || null
  };

  let upcomingCacheHit = false;
  if (needFixture) {
    const next = await upcomingFixtures(homeResolved.team.id);
    upcomingCacheHit = next.cacheHit;
    const match = next.rows.find((fixture) => sameTeam(fixture.home, awayResolved.team.name) || sameTeam(fixture.away, awayResolved.team.name));
    if (match) {
      analysis.fixture = {
        ...(analysis.fixture || {}),
        id: match.id,
        date: match.date,
        league: match.league || analysis.fixture?.league || null,
        leagueId: match.leagueId || null,
        venue: match.venue || homeResolved.team.venue?.name || analysis.fixture?.venue || null,
        city: match.city || homeResolved.team.venue?.city || analysis.fixture?.city || null,
        source: 'API-Football fixture resolver'
      };
      changed = true;
    }
  }

  const cacheHits = [homeResolved.cacheHit, awayResolved.cacheHit, homeRecent.cacheHit, awayRecent.cacheHit, upcomingCacheHit].filter(Boolean).length;
  analysis.sourceStatus = {
    ...(analysis.sourceStatus || {}),
    apiFootball: changed ? `Fallback used · ${cacheHits} cached calls` : `Fallback checked · ${cacheHits} cached calls`
  };

  return { analysis, used: changed, cacheHits };
}

module.exports = { enrichApiFootballFallback };
