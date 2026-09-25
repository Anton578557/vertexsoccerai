'use strict';

const { boundedFetch: fetch } = require('./analysis-budget');

const { cachedProviderCall } = require('./provider-cache');
const { sameTeam } = require('./match-integrity');
const { contextFromHistory, applyHistory } = require('./verified-history');
const { providerCooldown, recordProviderFailure } = require('./provider-cooldown');

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
// Public website feed, not a contracted API. Cache and validate every response;
// never rely on this source as the only provider or as a guaranteed service.
const LEAGUES = [
  ['bra.2', 'Brazil', /brazilian serie b|brasileiro serie b/], ['bra.1', 'Brazil', /brasil|brazilian serie a/],
  ['col.1', 'Colombia', /colombia|primera a|liga betplay/], ['arg.1', 'Argentina', /argentin|liga profesional/],
  ['eng.1', 'England', /premier league/], ['eng.2', 'England', /championship/],
  ['esp.1', 'Spain', /la liga|laliga|primera division/], ['esp.2', 'Spain', /segunda/],
  ['ger.1', 'Germany', /^(german )?bundesliga$/], ['ger.2', 'Germany', /2\. bundesliga|bundesliga 2/],
  ['ita.1', 'Italy', /serie a/], ['ita.2', 'Italy', /serie b/], ['fra.1', 'France', /ligue 1/],
  ['por.1', 'Portugal', /primeira|liga portugal/], ['ned.1', 'Netherlands', /eredivisie/],
  ['mex.1', 'Mexico', /liga mx|mexic/], ['usa.1', 'United States', /mls|major league soccer/],
  ['jpn.1', 'Japan', /j1|j.league division 1/], ['sco.1', 'Scotland', /premier/],
  ['chi.1', 'Chile', /chile|primera/], ['per.1', 'Peru', /peru|liga 1|primera/],
  ['uru.1', 'Uruguay', /uruguay|primera/], ['ecu.1', 'Ecuador', /ecuador|liga pro|serie a/]
];
const leagueCode = (league, country) => LEAGUES.find(([, nation, re]) => country === nation && re.test(String(league || '').toLowerCase()))?.[0] || null;
const compactDate = date => new Date(date).toISOString().slice(0, 10).replace(/-/g, '');
const scoreValue = value => {
  const raw = typeof value === 'object' && value !== null ? value.value ?? value.displayValue : value;
  if (raw == null || typeof raw === 'boolean' || String(raw).trim() === '') return null;
  const n = Number(raw); return Number.isInteger(n) && n >= 0 && n <= 30 ? n : null;
};

async function espnGet(path, params = {}, ttl = 900) {
  if (process.env.ESPN_FOOTBALL_ENABLED !== 'true' || process.env.ESPN_FOOTBALL_DISABLED === 'true') throw new Error('source_disabled');
  const url = new URL(`${BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const result = await cachedProviderCall({ cacheKey: `espn:v1:${url.pathname}:${url.search}`, provider: 'ESPN', ttlSeconds: ttl, staleSeconds: 21600,
    loader: async () => {
      if (await providerCooldown('espn')) throw new Error('source_cooldown');
      const response = await fetch(url, { signal: AbortSignal.timeout(6500), headers: { Accept: 'application/json', 'User-Agent': 'VertexSoccerAI/2.0' } });
      if (!response.ok) { await recordProviderFailure('espn', response.status, ''); throw new Error(`ESPN ${response.status}`); }
      return response.json();
    } });
  return result.payload;
}

function normalizeEvent(event, league, teams = []) {
  const competition = event.competitions?.[0];
  if (!competition) return null;
  const competitors = competition.competitors || [];
  const home = competitors.find(x => x.homeAway === 'home'), away = competitors.find(x => x.homeAway === 'away');
  if (!home?.team?.id || !away?.team?.id || home.team.id === away.team.id) return null;
  const status = competition.status || event.status || {};
  const type = status.type || {};
  // Only an explicit normal full-time state is safe. AET / penalties / awarded
  // games never become 90-minute observations from an ambiguous total score.
  const regulationVerified = type.completed === true && type.name === 'STATUS_FULL_TIME';
  const name = item => teams.find(t => String(t.espnId || '') === String(item.team.id))?.name || item.team.displayName || item.team.name;
  return { id: `espn:${event.id || competition.id}`, date: competition.date || event.date,
    home: name(home), away: name(away), homeId: String(home.team.id), awayId: String(away.team.id),
    homeScore: regulationVerified ? scoreValue(home.score) : null, awayScore: regulationVerified ? scoreValue(away.score) : null,
    regulationVerified, status: type.name, scheduled: type.state === 'pre' && ['STATUS_SCHEDULED', 'STATUS_TIMED'].includes(type.name),
    league: league || event.leagues?.[0]?.name || null, source: 'ESPN', venue: competition.venue?.fullName || null,
    homeBadge: home.team.logo || home.team.logos?.[0]?.href || null, awayBadge: away.team.logo || away.team.logos?.[0]?.href || null };
}

async function findEspnTeam(team, league) {
  if (/^\d+$/.test(String(team.espnId || ''))) {
    const data = await espnGet(`all/teams/${team.espnId}`, {}, 7 * 86400);
    const item = data.team;
    if (String(item?.id) !== String(team.espnId)) return null;
    return { ...team, name: item.displayName || team.name, aliases: [...(team.aliases || []), team.name], badge: item.logos?.[0]?.href || team.badge, resolved: true };
  }
  if (!league) return null;
  const data = await espnGet(`${league}/teams`, { limit: '100' }, 86400);
  const rows = (data.sports?.[0]?.leagues?.[0]?.teams || []).map(x => x.team).filter(Boolean);
  const hits = rows.filter(row => [row.displayName, row.name, row.shortDisplayName].some(label => [team.name, ...(team.aliases || [])].some(name => sameTeam(label, name))));
  if (hits.length !== 1) return null;
  const item = hits[0];
  return { ...team, espnId: String(item.id), aliases: [...(team.aliases || []), item.displayName], badge: team.badge || item.logos?.[0]?.href, resolved: true };
}

function findUpcoming(events, home, away, now = Date.now()) {
  return events.filter(e => e.scheduled && Date.parse(e.date) > now && Date.parse(e.date) < now + 30 * 864e5 &&
    ((e.homeId === home.espnId && e.awayId === away.espnId) || (e.homeId === away.espnId && e.awayId === home.espnId)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0] || null;
}

async function enrichEspnAnalysis(analysis) {
  if (process.env.ESPN_FOOTBALL_ENABLED !== 'true') { analysis.sourceStatus.espn = 'source_disabled'; return analysis; }
  const code = leagueCode(analysis.fixture?.league, analysis.teams?.home?.country);
  try {
    const [home, away] = await Promise.all([findEspnTeam(analysis.teams.home, code), findEspnTeam(analysis.teams.away, code)]);
    if (!home || !away || home.espnId === away.espnId) { analysis.sourceStatus.espn = 'teams_not_resolved'; return analysis; }
    analysis.teams = { home, away };
    const start = compactDate(Date.now() - 210 * 864e5), end = compactDate(Date.now() + 28 * 864e5);
    let events = [], leagueEvents = [];
    if (code) {
      const data = await espnGet(`${code}/scoreboard`, { dates: `${start}-${end}`, limit: '1000' }, 900);
      const label = data.leagues?.[0]?.name || analysis.fixture.league;
      events = (data.events || []).map(e => normalizeEvent(e, label, [home, away])).filter(Boolean);
      leagueEvents = events;
    }
    let context = contextFromHistory(events, home.name, away.name, { source: 'ESPN', leagueEvents });
    if (!context.ok) {
      const batches = await Promise.all([home, away].map(team => espnGet(`${code || 'all'}/teams/${team.espnId}/schedule`, { season: String(new Date().getUTCFullYear()) }, 900).catch(() => null)));
      events = events.concat(batches.flatMap(data => (data?.events || []).map(e => normalizeEvent(e, analysis.fixture.league, [home, away])).filter(Boolean)));
    }
    const fixture = findUpcoming(events, home, away);
    if (fixture) {
      if (fixture.homeId === away.espnId) {
        analysis.teams = { home: away, away: home };
        analysis.form = { home: analysis.form.away, away: analysis.form.home };
        if (analysis.advanced) analysis.advanced = { home: analysis.advanced.away, away: analysis.advanced.home };
        analysis.history = null; analysis.h2h = null; analysis.weather = null;
      }
      analysis.fixture = { ...analysis.fixture, date: fixture.date, league: fixture.league, venue: fixture.venue, source: 'ESPN', inputReversed: fixture.homeId === away.espnId };
    }
    context = contextFromHistory(events, analysis.teams.home.name, analysis.teams.away.name, { source: 'ESPN', cutoff: analysis.fixture.date || new Date(), leagueEvents });
    const used = applyHistory(analysis, context);
    analysis.sourceStatus.espn = used ? 'Connected · verified match history' : context.reason || 'Available';
    analysis.dataSources = [...(analysis.dataSources || []), { name: 'ESPN', url: 'https://www.espn.com/soccer/', used, homeSample: context.homeForm.played, awaySample: context.awayForm.played }];
    return analysis;
  } catch (error) {
    analysis.sourceStatus.espn = /disabled|cooldown/.test(error.message) ? error.message : 'temporarily_unavailable';
    return analysis;
  }
}

module.exports = { enrichEspnAnalysis, espnGet, normalizeEvent, scoreValue, leagueCode, findUpcoming, findEspnTeam };
