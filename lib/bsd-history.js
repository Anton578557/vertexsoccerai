'use strict';

// BSD v2 free football API. Live Brazil/Colombia payloads verified 2026-09-23.
// The explicit switch keeps account setup separate from activation.
const { cachedProviderCall, getProviderCache, setProviderCache } = require('./provider-cache');
const { sameTeam } = require('./match-integrity');
const { providerAliases } = require('./team-aliases');
const { contextFromHistory, applyHistory } = require('./verified-history');
const ROOT = 'https://sports.bzzoiro.com/api/v2';
const COUNTRIES = { Brazil: 'BR', Colombia: 'CO', Bolivia: 'BO', England: 'GB', Germany: 'DE', Spain: 'ES', Italy: 'IT', France: 'FR',
  Portugal: 'PT', Netherlands: 'NL', Argentina: 'AR', Belgium: 'BE', Scotland: 'GB', Turkey: 'TR', Mexico: 'MX', USA: 'US', 'United States': 'US', Japan: 'JP' };

function configuration() {
  return { configured: Boolean(String(process.env.BSD_API_KEY || '').trim()), enabled: process.env.BSD_FOOTBALL_ENABLED === 'true' };
}

function retrySeconds(value, now = Date.now()) {
  const numeric = /^\d+$/.test(String(value || '')) ? Number(value) : null;
  const date = numeric === null ? Date.parse(value) : NaN;
  if (Number.isFinite(numeric)) return Math.max(60, numeric);
  if (Number.isFinite(date) && date > now) return Math.max(60, Math.ceil((date - now) / 1000));
  // Free football allowance resets at midnight UTC. No repeated quota probes.
  return Math.max(60, Math.ceil((Math.floor(now / 864e5) * 864e5 + 864e5 - now) / 1000));
}

async function request(path, params, ttlSeconds = 3600) {
  const query = new URLSearchParams(params).toString();
  const result = await cachedProviderCall({ cacheKey: `bsd:v1:${path}?${query}`, provider: 'BSD', ttlSeconds, staleSeconds: 0,
    loader: async () => {
      const paused = await getProviderCache('bsd:v1:cooldown');
      if (paused && Date.parse(paused.retryAt) > Date.now()) throw new Error(paused.reason);
      const response = await fetch(`${ROOT}/${path}/?${query}`, {
        headers: { Accept: 'application/json', Authorization: `Token ${String(process.env.BSD_API_KEY || '').trim()}` },
        signal: AbortSignal.timeout(5500)
      });
      if (!response.ok) {
        const reason = response.status === 429 ? 'quota_exhausted' : [401, 402, 403].includes(response.status) ? 'access_denied' : 'temporarily_unavailable';
        if ([401, 402, 403, 429].includes(response.status)) {
          const seconds = response.status === 429 ? retrySeconds(response.headers.get('retry-after')) : 900;
          await setProviderCache('bsd:v1:cooldown', 'BSD', { reason, retryAt: new Date(Date.now() + seconds * 1000).toISOString() }, seconds);
        }
        throw new Error(reason);
      }
      const data = await response.json();
      if (!Array.isArray(data?.results)) throw new Error('invalid_dataset');
      return data;
    } });
  return result.payload;
}

function selectTeam(rows, team, countryCode, aliases = []) {
  const names = [team.name, ...(team.aliases || []), ...aliases];
  const matches = (rows || []).filter(row => Number.isInteger(row.id) && row.id > 0 && row.is_women !== true &&
    (!team.country || !row.country || row.country === team.country || (countryCode === 'US' && ['USA','United States'].includes(row.country))) &&
    (!countryCode || !row.country_code || row.country_code === countryCode) && names.some(name => sameTeam(name, row.name)));
  const unique = new Map(matches.map(row => [row.id, row]));
  return unique.size === 1 ? { ...[...unique.values()][0], canonicalName: team.name } : null;
}

async function resolveTeam(team) {
  const countryCode = COUNTRIES[team.country];
  // This shortened provider spelling is scoped to the verified Brazilian club.
  const aliases = [...(team.country === 'Brazil' && sameTeam(team.name, 'Sport Recife') ? ['Sport'] : []), ...providerAliases(team.name)];
  // Country is an optional API filter, not a prerequisite for identification.
  // Never choose a partial-name hit, multiple IDs, or a truncated result set.
  for (const name of [...new Set([team.name, ...aliases, ...(team.aliases || [])])].filter(Boolean).slice(0, 3)) {
    const data = await request('teams', { name, ...(countryCode ? { country_code: countryCode } : {}), is_women: 'false', limit: '200', offset: '0' }, 86400);
    if (data.next) continue; // A truncated, ambiguous search is not an identity.
    const match = selectTeam(data.results, team, countryCode, aliases);
    if (match) return match;
  }
  return null;
}

function normalizeEvents(events, team, knownTeams = [], now = new Date()) {
  return (events || []).flatMap(event => {
    if (event.status !== 'finished' || event.replaced_by != null || !Number.isInteger(event.id) || !event.home_team || !event.away_team ||
      ![event.home_score, event.away_score].every(x => Number.isInteger(x) && x >= 0 && x <= 30)) return [];
    if (!/Z$|[+-]\d{2}:\d{2}$/.test(event.event_date || '') || !Number.isFinite(Date.parse(event.event_date)) || Date.parse(event.event_date) >= now.getTime()) return [];
    const home = event.home_team_id === team.id && sameTeam(event.home_team, team.name);
    const away = event.away_team_id === team.id && sameTeam(event.away_team, team.name);
    if (home === away) return []; // Require the queried ID AND its verified name.
    const canonical = (id, name) => knownTeams.find(item => item.id === id && sameTeam(item.name, name))?.canonicalName || name;
    // BSD documents home_score/away_score as 90-minute scores; separate ET and
    // penalty fields are never added. Ignore estimated xG and AI lineups.
    return [{ id: `bsd:${event.id}`, date: event.event_date,
      home: canonical(event.home_team_id, event.home_team), away: canonical(event.away_team_id, event.away_team),
      homeScore: event.home_score, awayScore: event.away_score, regulationVerified: true, source: 'BSD', league: event.league_id || null }];
  });
}

async function teamHistory(team, knownTeams, cutoff) {
  const end = Math.min(Date.now(), Date.parse(cutoff));
  const params = { team_id: String(team.id), status: 'finished', date_from: new Date(end - 180 * 864e5).toISOString().slice(0, 10),
    date_to: new Date(end).toISOString().slice(0, 10), limit: '200' };
  const rows = [];
  for (let page = 0; page < 2; page++) {
    const data = await request('events', { ...params, offset: String(page * 200) });
    rows.push(...data.results);
    if (!data.next) return normalizeEvents(rows, team, knownTeams);
  }
  // Ordering is not guaranteed. Do not analyse a partially retrieved history.
  throw new Error('history_truncated');
}

async function enrichBsdHistory(analysis, { verifyConnection = false } = {}) {
  const config = configuration();
  if (!config.configured || (!config.enabled && !verifyConnection)) {
    analysis.sourceStatus.bsd = config.configured ? 'awaiting_verification' : 'not_configured'; return analysis;
  }
  try {
    const teams = await Promise.all([analysis.teams.home, analysis.teams.away].map(resolveTeam));
    teams.forEach((team, index) => {
      if (!team) return;
      const target = analysis.teams[index === 0 ? 'home' : 'away'];
      target.resolved = true;
      target.bsdId = team.id;
      target.country ||= team.country || Object.keys(COUNTRIES).find(country => COUNTRIES[country] === team.country_code) || null;
      // BSD's documented public crest endpoint uses the verified API identity.
      const crest = `https://sports.bzzoiro.com/img/team/${team.id}/`;
      target.badgeCandidates = [...new Set([target.badge, ...(target.badgeCandidates || []), crest].filter(Boolean))];
      target.badge ||= crest;
      target.metadataSource ||= 'BSD';
    });
    if (teams.some(team => !team) || teams[0].id === teams[1].id) {
      analysis.sourceStatus.bsd = 'teams_unavailable'; return analysis;
    }
    const cutoff = analysis.fixture?.date || new Date();
    const histories = await Promise.all(teams.map(team => teamHistory(team, teams, cutoff)));
    const context = contextFromHistory(histories.flat(), teams[0].canonicalName, teams[1].canonicalName, { source: 'BSD', cutoff });
    // An archive stalled for months is not current team form.
    const end = Math.min(Date.now(), Date.parse(cutoff));
    if ([context.history.home, context.history.away].some(rows => !rows.length || end - Date.parse(rows[0].date) > 45 * 864e5)) {
      context.ok = false; context.reason = 'insufficient_recent_history';
    }
    const used = applyHistory(analysis, context);
    analysis.sourceStatus.bsd = used ? 'Connected · verified match history' : context.reason || 'Available';
    analysis.dataSources = [...(analysis.dataSources || []), { name: 'BSD', url: 'https://goaldir.com/', used,
      homeSample: context.homeForm.played, awaySample: context.awayForm.played }];
  } catch (error) {
    analysis.sourceStatus.bsd = ['quota_exhausted', 'access_denied', 'invalid_dataset', 'history_truncated'].includes(error.message) ? error.message : 'temporarily_unavailable';
  }
  return analysis;
}

async function completedBsdMatches(homeTeam, awayTeam, date) {
  if (!configuration().enabled || !configuration().configured) return [];
  const home = await resolveTeam(homeTeam);
  if (!home) return [];
  const data = await request('events', {team_id:String(home.id), status:'finished', date_from:date, date_to:date, limit:'200', offset:'0'}, 900);
  if (data.next) return [];
  return normalizeEvents(data.results, home, [home]).filter(row => row.date.slice(0,10) === date &&
    ((sameTeam(row.home, homeTeam.name) && sameTeam(row.away, awayTeam.name)) ||
     (sameTeam(row.away, homeTeam.name) && sameTeam(row.home, awayTeam.name)))).map(row => ({...row,status:'FINISHED'}));
}

module.exports = { enrichBsdHistory, configuration, selectTeam, normalizeEvents, retrySeconds, completedBsdMatches };
