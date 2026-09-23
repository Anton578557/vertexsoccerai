'use strict';

const { cachedProviderCall } = require('./provider-cache');
const { sameTeam, regulationScore } = require('./match-integrity');

const BASE = 'https://api.football-data.org/v4';

function clean(value, max = 120) { return String(value || '').replace(/[<>]/g, '').trim().slice(0, max); }
function normalize(value) { return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\b(fc|cf|afc|sc|club|de|the|ud|cd)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function clamp(v, min, max) { return Math.min(max, Math.max(min, Number(v) || 0)); }
function isoDate(date) { return new Date(date).toISOString().slice(0, 10); }

function competitionCode(league, country = '') {
  const text = normalize(league), nation = normalize(country);
  const european = [[/champions league|uefa champions/, 'CL'], [/europa league|uefa europa|uefa cup/, 'EL'], [/conference league|uefa conference/, 'UCL']];
  if (/uefa|^champions league$|^europa league$|^conference league$/.test(text)) return european.find(([re]) => re.test(text))?.[1] || null;
  const rules = [
    [/brasileirao|brazilian serie a/, 'BSA', 'brazil'],
    [/^premier league$|english premier/, 'PL', 'england'],
    [/^la liga$|spanish la liga|^primera division$/, 'PD', 'spain'],
    [/^bundesliga$|german bundesliga/, 'BL1', 'germany'],
    [/^serie a$|italian serie a/, 'SA', 'italy'],
    [/^ligue 1$|french ligue 1/, 'FL1', 'france'],
    [/eredivisie/, 'DED', 'netherlands'],
    [/primeira liga|liga portugal/, 'PPL', 'portugal'],
    [/^championship$|english championship/, 'ELC', 'england']
  ];
  const hit = rules.find(([re, , expected]) => re.test(text) && (!nation || nation === expected));
  // Primera División is used in many countries; do not silently assume Spain.
  if (text === 'primera division' && nation !== 'spain') return null;
  if (text === 'serie a' && nation === 'brazil') return 'BSA';
  return hit?.[1] || null;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY, 'User-Agent': 'VertexSoccerAI/6.0' }
    });
    if (!response.ok) {
      const error = new Error(`Football-Data ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  } finally { clearTimeout(timer); }
}

function mapMatch(match) {
  const score = regulationScore(match);
  return {
    id: String(match.id || ''), date: match.utcDate || null, status: match.status || null,
    league: match.competition?.name || null, leagueCode: match.competition?.code || null,
    home: match.homeTeam?.name || '', away: match.awayTeam?.name || '',
    homeId: match.homeTeam?.id || null, awayId: match.awayTeam?.id || null,
    homeScore: score?.home ?? null,
    awayScore: score?.away ?? null,
    venue: match.venue || null,
    source: 'Football-Data'
  };
}

function completedFor(events, team, limit = 12) {
  return events.filter((m) => new Date(m.date).getTime() < Date.now() && new Date(m.date).getTime() > Date.now() - 365 * 864e5 && (sameTeam(m.home, team) || sameTeam(m.away, team)) && Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, limit);
}

function basicStats(events, team, limit = 8) {
  const rows = completedFor(events, team, limit);
  let gf = 0, ga = 0, wins = 0, draws = 0, losses = 0; const sequence = [];
  for (const m of rows) {
    const isHome = sameTeam(m.home, team); const scored = isHome ? m.homeScore : m.awayScore; const conceded = isHome ? m.awayScore : m.homeScore;
    if (!Number.isFinite(scored) || !Number.isFinite(conceded)) continue;
    gf += scored; ga += conceded;
    if (scored > conceded) { wins++; sequence.push('W'); } else if (scored === conceded) { draws++; sequence.push('D'); } else { losses++; sequence.push('L'); }
  }
  const played = wins + draws + losses;
  return { played, wins, draws, losses, sequence, avgFor: played ? gf / played : null, avgAgainst: played ? ga / played : null, ppg: played ? (wins * 3 + draws) / played : null };
}

function leagueTable(events) {
  const table = new Map();
  const ensure = (name) => {
    const key = normalize(name);
    if (!table.has(key)) table.set(key, { name, played: 0, points: 0, gf: 0, ga: 0 });
    return table.get(key);
  };
  for (const m of events) {
    if (!Number.isFinite(m.homeScore) || !Number.isFinite(m.awayScore)) continue;
    const home = ensure(m.home); const away = ensure(m.away);
    home.played++; away.played++;
    home.gf += m.homeScore; home.ga += m.awayScore;
    away.gf += m.awayScore; away.ga += m.homeScore;
    if (m.homeScore > m.awayScore) home.points += 3;
    else if (m.homeScore < m.awayScore) away.points += 3;
    else { home.points++; away.points++; }
  }
  for (const row of table.values()) row.ppg = row.played ? row.points / row.played : 1.35;
  return table;
}

function opponentName(match, team) {
  if (sameTeam(match.home, team)) return match.away;
  if (sameTeam(match.away, team)) return match.home;
  return null;
}

function matchView(match, team) {
  const isHome = sameTeam(match.home, team);
  if (!isHome && !sameTeam(match.away, team)) return null;
  const scored = isHome ? match.homeScore : match.awayScore;
  const conceded = isHome ? match.awayScore : match.homeScore;
  return { date: match.date, isHome, scored, conceded, points: scored > conceded ? 3 : scored === conceded ? 1 : 0, opponent: opponentName(match, team) };
}

function weightedAverage(rows, valueKey, weightKey = 'weight') {
  let num = 0; let den = 0;
  for (const row of rows) {
    if (!Number.isFinite(row[valueKey]) || !Number.isFinite(row[weightKey])) continue;
    num += row[valueKey] * row[weightKey]; den += row[weightKey];
  }
  return den ? num / den : null;
}

function advancedStats(events, team, table, fixtureDate, expectedVenue) {
  const cutoff = Math.min(Date.now(), new Date(fixtureDate || Date.now()).getTime());
  const recent = completedFor(events.filter(m => new Date(m.date).getTime() < cutoff), team, 12).map((match, index) => {
    const view = matchView(match, team);
    const opponent = table.get(normalize(view?.opponent)) || null;
    const opponentPpg = Number.isFinite(opponent?.ppg) ? opponent.ppg : 1.35;
    const recencyWeight = Math.pow(0.87, index);
    const oppositionWeight = clamp(0.82 + (opponentPpg / 3) * 0.36, 0.82, 1.18);
    return { ...view, opponentPpg, weight: recencyWeight * oppositionWeight, recencyWeight };
  }).filter(Boolean);

  const venueRows = recent.filter((row) => expectedVenue === 'home' ? row.isHome : !row.isHome).slice(0, 8);
  const weightedAvgFor = weightedAverage(recent, 'scored');
  const weightedAvgAgainst = weightedAverage(recent, 'conceded');
  const weightedPpg = weightedAverage(recent, 'points');
  const opponentStrength = weightedAverage(recent, 'opponentPpg');
  const venueAvgFor = weightedAverage(venueRows, 'scored', 'recencyWeight');
  const venueAvgAgainst = weightedAverage(venueRows, 'conceded', 'recencyWeight');
  const venuePpg = weightedAverage(venueRows, 'points', 'recencyWeight');
  const scoringRate = recent.length ? recent.filter((row) => row.scored > 0).length / recent.length : null;
  const cleanSheetRate = recent.length ? recent.filter((row) => row.conceded === 0).length / recent.length : null;

  const targetTime = new Date(fixtureDate || Date.now()).getTime();
  const pastRows = recent.filter((row) => new Date(row.date || 0).getTime() < targetTime).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const lastTime = pastRows[0] ? new Date(pastRows[0].date).getTime() : null;
  const restDays = Number.isFinite(lastTime) ? Math.max(0, (targetTime - lastTime) / 864e5) : null;
  const countWindow = (days) => pastRows.filter((row) => targetTime - new Date(row.date || 0).getTime() <= days * 864e5).length;

  return {
    sample: recent.length,
    sampleReliability: clamp((recent.length - 2) / 10, 0, 1),
    weightedAvgFor, weightedAvgAgainst, weightedPpg, opponentStrength, scoringRate, cleanSheetRate, restDays,
    matches7: countWindow(7), matches14: countWindow(14), matches30: countWindow(30),
    venue: { type: expectedVenue, matches: venueRows.length, avgFor: venueAvgFor, avgAgainst: venueAvgAgainst, ppg: venuePpg }
  };
}

function buildLeagueContext(completed) {
  if (!completed.length) return null;
  let homeGoals = 0, awayGoals = 0, homeWins = 0, draws = 0, awayWins = 0;
  for (const m of completed) {
    homeGoals += m.homeScore; awayGoals += m.awayScore;
    if (m.homeScore > m.awayScore) homeWins++;
    else if (m.homeScore < m.awayScore) awayWins++;
    else draws++;
  }
  const n = completed.length;
  return { sample: n, homeGoals: homeGoals / n, awayGoals: awayGoals / n, teamGoalAvg: (homeGoals + awayGoals) / (2 * n), homeWinRate: homeWins / n, drawRate: draws / n, awayWinRate: awayWins / n };
}

function buildH2h(completed, homeName, awayName) {
  const rows = completed.filter((m) => (sameTeam(m.home, homeName) && sameTeam(m.away, awayName)) || (sameTeam(m.home, awayName) && sameTeam(m.away, homeName)))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 5);
  let homePoints = 0, awayPoints = 0, homeGoals = 0, awayGoals = 0;
  rows.forEach((m, index) => {
    const weight = Math.pow(0.82, index);
    const currentHomeIsMatchHome = sameTeam(m.home, homeName);
    const hg = currentHomeIsMatchHome ? m.homeScore : m.awayScore;
    const ag = currentHomeIsMatchHome ? m.awayScore : m.homeScore;
    homeGoals += hg * weight; awayGoals += ag * weight;
    if (hg > ag) homePoints += 3 * weight;
    else if (hg < ag) awayPoints += 3 * weight;
    else { homePoints += weight; awayPoints += weight; }
  });
  const weightTotal = rows.reduce((sum, _, index) => sum + Math.pow(0.82, index), 0);
  return { sample: rows.length, homePpg: weightTotal ? homePoints / weightTotal : null, awayPpg: weightTotal ? awayPoints / weightTotal : null, homeGoalDiff: weightTotal ? (homeGoals - awayGoals) / weightTotal : null };
}

function dedupeMatches(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.id || `${row.date}:${normalize(row.home)}:${normalize(row.away)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findTeamId(matches, teamName) {
  for (const match of matches) {
    if (sameTeam(match.home, teamName) && match.homeId) return match.homeId;
    if (sameTeam(match.away, teamName) && match.awayId) return match.awayId;
  }
  return null;
}

async function fetchTeamRecent(teamId) {
  if (!teamId) return [];
  try {
    const { payload } = await cachedProviderCall({
      cacheKey: `football-data:v3:team-recent:${teamId}:18`,
      provider: 'Football-Data team history',
      ttlSeconds: 900,
      staleSeconds: 21600,
      loader: () => fetchJson(`${BASE}/teams/${teamId}/matches?status=FINISHED&limit=18`)
    });
    return (payload?.matches || []).map(mapMatch);
  } catch (_) {
    return [];
  }
}

async function resolveUpcomingFixture(homeName, awayName, days = 14) {
  if (!process.env.FOOTBALL_DATA_KEY || !homeName || !awayName) return null;
  try {
    const from = new Date();
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + Math.max(2, Math.min(Number(days) || 14, 30)));
    const fromIso = isoDate(from); const toIso = isoDate(to);
    const { payload } = await cachedProviderCall({
      cacheKey: `football-data:v3:global-upcoming:${fromIso}:${toIso}`,
      provider: 'Football-Data fixture resolver',
      ttlSeconds: 300,
      staleSeconds: 1800,
      loader: () => fetchJson(`${BASE}/matches?dateFrom=${fromIso}&dateTo=${toIso}`)
    });
    const rows = (payload?.matches || []).map(mapMatch).filter((match) => new Date(match.date || 0).getTime() >= Date.now() - 6 * 3600e3);
    const direct = rows.find((match) => sameTeam(match.home, homeName) && sameTeam(match.away, awayName));
    const reverse = rows.find((match) => sameTeam(match.home, awayName) && sameTeam(match.away, homeName));
    const hit = direct || reverse || null;
    return hit ? { ...hit, reversed: Boolean(!direct && reverse) } : null;
  } catch (_) {
    return null;
  }
}

async function fetchScorers(code) {
  if (!code) return [];
  try {
    const { payload } = await cachedProviderCall({
      cacheKey: `football-data:v3:scorers:${code}:100`,
      provider: 'Football-Data scorers',
      ttlSeconds: 1800,
      staleSeconds: 21600,
      loader: () => fetchJson(`${BASE}/competitions/${code}/scorers?limit=100`)
    });
    return Array.isArray(payload?.scorers) ? payload.scorers : [];
  } catch (_) {
    return [];
  }
}

function buildPenaltyContext(scorers, completed, homeName, awayName) {
  const competitionMatches = Array.isArray(completed) ? completed.filter((m) => Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore)) : [];
  const rows = Array.isArray(scorers) ? scorers : [];
  if (competitionMatches.length < 12 || !rows.length) return { ok: false, reason: 'insufficient_verified_penalty_sample' };

  const teamMatches = (name) => competitionMatches.filter((m) => sameTeam(m.home, name) || sameTeam(m.away, name)).length;
  const teamPenaltyGoals = (name) => rows.reduce((sum, row) => sameTeam(row?.team?.name, name) ? sum + Math.max(0, Number(row?.penalties || 0)) : sum, 0);
  const allPenaltyGoals = rows.reduce((sum, row) => sum + Math.max(0, Number(row?.penalties || 0)), 0);
  const homeMatches = teamMatches(homeName); const awayMatches = teamMatches(awayName);
  if (homeMatches < 4 || awayMatches < 4) return { ok: false, reason: 'insufficient_team_penalty_sample', sample: { home: homeMatches, away: awayMatches, competition: competitionMatches.length } };

  const competitionRate = clamp(allPenaltyGoals / competitionMatches.length, 0.02, 0.5);
  const baselineTeamRate = competitionRate / 2;
  const shrink = (goals, matches) => {
    const observed = matches ? goals / matches : baselineTeamRate;
    const reliability = matches / (matches + 10);
    return observed * reliability + baselineTeamRate * (1 - reliability);
  };
  const homePenaltyGoals = teamPenaltyGoals(homeName); const awayPenaltyGoals = teamPenaltyGoals(awayName);
  const homeRate = shrink(homePenaltyGoals, homeMatches);
  const awayRate = shrink(awayPenaltyGoals, awayMatches);
  const expectedScoredPenalties = clamp(homeRate + awayRate, 0.02, 0.65);
  const anyScoredPenaltyProbability = 1 - Math.exp(-expectedScoredPenalties);

  return {
    ok: true,
    source: 'Football-Data',
    basis: 'verified scored penalties in current competition',
    expectedScoredPenalties: Number(expectedScoredPenalties.toFixed(3)),
    probabilityPct: Math.round(anyScoredPenaltyProbability * 100),
    homeProbabilityPct: Math.round((1 - Math.exp(-homeRate)) * 100),
    awayProbabilityPct: Math.round((1 - Math.exp(-awayRate)) * 100),
    observed: { homePenaltyGoals, awayPenaltyGoals, competitionPenaltyGoals: allPenaltyGoals },
    sample: { home: homeMatches, away: awayMatches, competition: competitionMatches.length },
    limitation: 'This is a conservative penalty-goal proxy. Missed penalties are not counted by this source, so it is not presented as a full awarded-penalty rate.'
  };
}

async function enrichFootballData(homeName, awayName, leagueName, country = '') {
  if (!process.env.FOOTBALL_DATA_KEY) return { ok: false, reason: 'not_configured' };
  const code = competitionCode(leagueName, country);
  if (!code) return { ok: false, reason: 'competition_unknown' };
  try {
    const now = new Date(); const from = new Date(now); const to = new Date(now);
    from.setDate(from.getDate() - 365); to.setDate(to.getDate() + 45);
    const fromIso = isoDate(from); const toIso = isoDate(to);

    const [{ payload: data }, scorers] = await Promise.all([
      cachedProviderCall({
        cacheKey: `football-data:v3:competition:${code}:${fromIso}:${toIso}`,
        provider: 'Football-Data',
        ttlSeconds: 600,
        staleSeconds: 21600,
        loader: () => fetchJson(`${BASE}/competitions/${code}/matches?dateFrom=${fromIso}&dateTo=${toIso}`)
      }),
      fetchScorers(code)
    ]);

    const all = (data?.matches || []).map(mapMatch);
    const completed = all.filter((m) => new Date(m.date).getTime() < Date.now() && Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore));
    const relevant = all.filter((m) => sameTeam(m.home, homeName) || sameTeam(m.away, homeName) || sameTeam(m.home, awayName) || sameTeam(m.away, awayName));
    const homeId = findTeamId(all, homeName); const awayId = findTeamId(all, awayName);
    const [homeRecentAll, awayRecentAll] = await Promise.all([fetchTeamRecent(homeId), fetchTeamRecent(awayId)]);

    const homeEvents = completedFor(homeRecentAll.length ? homeRecentAll : relevant, homeName, 12);
    const awayEvents = completedFor(awayRecentAll.length ? awayRecentAll : relevant, awayName, 12);
    const fixture = relevant.filter((m) => {
      const exact = sameTeam(m.home, homeName) && sameTeam(m.away, awayName);
      return exact && ['SCHEDULED', 'TIMED'].includes(m.status) && new Date(m.date || 0).getTime() > Date.now();
    }).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))[0] || null;

    const table = leagueTable(completed);
    const fixtureDate = fixture?.date || new Date();
    const crossCompetitionContext = dedupeMatches([...homeEvents, ...awayEvents]);
    const advanced = {
      home: advancedStats(crossCompetitionContext, homeName, table, fixtureDate, 'home'),
      away: advancedStats(crossCompetitionContext, awayName, table, fixtureDate, 'away')
    };

    return {
      ok: true,
      code,
      homeEvents,
      awayEvents,
      homeForm: basicStats(homeEvents, homeName, 8),
      awayForm: basicStats(awayEvents, awayName, 8),
      fixture,
      advanced,
      leagueContext: buildLeagueContext(completed),
      h2h: buildH2h(completed, homeName, awayName),
      penaltyModel: buildPenaltyContext(scorers, completed, homeName, awayName),
      crossCompetitionForm: Boolean(homeRecentAll.length || awayRecentAll.length)
    };
  } catch (error) {
    return { ok: false, reason: `http_${error.status || 'error'}`, code };
  }
}

module.exports = { basicStats, leagueTable, enrichFootballData, resolveUpcomingFixture, competitionCode, advancedStats, buildLeagueContext, buildH2h, buildPenaltyContext };