'use strict';

const { sportmonksGet } = require('./sportmonks-client');
const { cachedProviderCall } = require('./provider-cache');
const { sameTeam } = require('./match-integrity');
const { contextFromHistory, applyHistory } = require('./verified-history');
const { providerCooldown, recordProviderFailure } = require('./provider-cooldown');

async function get(path, params, ttl = 900) {
  const result = await cachedProviderCall({ cacheKey: `sportmonks:history:v1:${path}:${JSON.stringify(params)}`, provider: 'Sportmonks', ttlSeconds: ttl, staleSeconds: 21600,
    loader: async () => {
      if (await providerCooldown('sportmonks')) throw new Error('source_cooldown');
      const response = await sportmonksGet(path, params);
      if (!response.ok) { await recordProviderFailure('sportmonks', response.status, response.message || ''); throw new Error(response.status === 403 ? 'subscription_coverage' : 'temporarily_unavailable'); }
      return response.data;
    } });
  return result.payload;
}

async function findTeam(team) {
  const data = await get(`/teams/search/${encodeURIComponent(team.name)}`, { include: 'country', per_page: 25 }, 86400);
  const matches = (data.data || []).filter(row => row.sport_id === 1 && !row.placeholder &&
    [team.name, ...(team.aliases || [])].some(name => sameTeam(row.name, name)) &&
    (!team.country || !row.country?.name || team.country === row.country.name));
  return matches.length === 1 ? { ...team, sportmonksId: matches[0].id, badge: team.badge || matches[0].image_path, country: team.country || matches[0].country?.name, resolved: true } : null;
}

function normalizeFixture(fixture, teams = []) {
  const home = fixture.participants?.find(p => p.meta?.location === 'home');
  const away = fixture.participants?.find(p => p.meta?.location === 'away');
  if (!home || !away || home.id === away.id) return null;
  const state = fixture.state?.short_name || fixture.state?.developer_name || '';
  const finished = ['FT', 'AET', 'FT_PEN'].includes(state);
  const score = id => {
    const rows = (fixture.scores || []).filter(s => String(s.participant_id) === String(id));
    const valid = value => Number.isInteger(value) && value >= 0 ? value : null;
    const regulation = rows.find(s => s.description === '2ND_HALF');
    if (regulation) return valid(regulation.score?.goals);
    return state === 'FT' ? valid(rows.find(s => s.description === 'CURRENT')?.score?.goals) : null;
  };
  const homeScore = finished ? score(home.id) : null, awayScore = finished ? score(away.id) : null;
  const name = row => teams.find(t => String(t.sportmonksId) === String(row.id))?.name || row.name;
  const date = fixture.starting_at_timestamp ? new Date(fixture.starting_at_timestamp * 1000).toISOString() : String(fixture.starting_at || '').replace(' ', 'T') + 'Z';
  return { id: `sportmonks:${fixture.id}`, date, home: name(home), away: name(away), homeId: home.id, awayId: away.id,
    homeScore, awayScore, regulationVerified: finished && homeScore !== null && awayScore !== null,
    status: state, scheduled: state === 'NS', league: fixture.league?.name || null, source: 'Sportmonks' };
}

async function teamHistory(team) {
  const from = new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
  const rows = [];
  // Bounded pagination respects both API quota and serverless request duration.
  for (let page = 1; page <= 3; page++) {
    const data = await get(`/fixtures/between/${from}/${to}/${team.sportmonksId}`, { include: 'participants;scores;state;league', per_page: 50, page, order: 'desc' });
    rows.push(...(data.data || []));
    if (!data.pagination?.has_more) break;
  }
  return rows;
}

async function enrichSportmonksHistory(analysis) {
  if (!process.env.SPORTMONKS_API_TOKEN) { analysis.sourceStatus.sportmonks = 'not_configured'; return analysis; }
  try {
    const [home, away] = await Promise.all([findTeam(analysis.teams.home), findTeam(analysis.teams.away)]);
    if (!home || !away || home.sportmonksId === away.sportmonksId) { analysis.sourceStatus.sportmonks = 'teams_unavailable'; return analysis; }
    analysis.teams = { home, away };
    const batches = await Promise.all([teamHistory(home), teamHistory(away)]);
    const events = batches.flat().map(row => normalizeFixture(row, [home, away])).filter(Boolean);
    const fixture = events.filter(e => e.scheduled && Date.parse(e.date) > Date.now() &&
      ((e.homeId === home.sportmonksId && e.awayId === away.sportmonksId) || (e.homeId === away.sportmonksId && e.awayId === home.sportmonksId)))
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0];
    if (fixture && !analysis.fixture.date) {
      if (fixture.homeId === away.sportmonksId) {
        analysis.teams = { home: away, away: home }; analysis.form = { home: analysis.form.away, away: analysis.form.home };
        if (analysis.advanced) analysis.advanced = { home: analysis.advanced.away, away: analysis.advanced.home };
        analysis.history = null; analysis.h2h = null; analysis.weather = null;
      }
      analysis.fixture = { ...analysis.fixture, date: fixture.date, league: fixture.league, source: 'Sportmonks', inputReversed: fixture.homeId === away.sportmonksId };
    }
    const context = contextFromHistory(events, analysis.teams.home.name, analysis.teams.away.name, { source: 'Sportmonks', cutoff: analysis.fixture.date || new Date() });
    const used = applyHistory(analysis, context);
    analysis.sourceStatus.sportmonks = used ? 'Connected · verified match history' : context.reason || 'Available';
    analysis.dataSources = [...(analysis.dataSources || []), { name: 'Sportmonks', url: 'https://www.sportmonks.com/football-api/', used, homeSample: context.homeForm.played, awaySample: context.awayForm.played }];
  } catch (error) { analysis.sourceStatus.sportmonks = error.message === 'subscription_coverage' ? error.message : 'temporarily_unavailable'; }
  return analysis;
}

module.exports = { enrichSportmonksHistory, normalizeFixture };
