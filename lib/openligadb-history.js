'use strict';

const { boundedFetch: fetch } = require('./analysis-budget');

const { cachedProviderCall } = require('./provider-cache');
const { sameTeam } = require('./match-integrity');
const { contextFromHistory, applyHistory } = require('./verified-history');

const ROOT = 'https://api.openligadb.de';
// Official community shortcuts. Restrict to regular leagues: a cup's final
// result can include extra time, unlike these 90-minute league results.
function competitionCode(league, country) {
  if (country !== 'Germany') return null;
  const name = String(league || '').toLowerCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:(?:german|germany) )?(?:1 )?bundesliga$/.test(name)) return 'bl1';
  if (/^(?:(?:german|germany) )?(?:2 bundesliga|bundesliga 2)$/.test(name)) return 'bl2';
  if (/^(?:(?:german|germany) )?(?:3 liga|liga 3)$/.test(name)) return 'bl3';
  return null;
}

function seasonYears(now = new Date()) {
  const year = now.getUTCFullYear() - (now.getUTCMonth() < 6 ? 1 : 0);
  return [year, year - 1];
}

function normalizeMatches(matches, code, teams = [], now = new Date()) {
  if (!['bl1', 'bl2', 'bl3'].includes(code)) return [];
  const name = value => teams.find(team => [team.name, ...(team.aliases || [])].some(alias => sameTeam(alias, value)))?.name || value;
  return (Array.isArray(matches) ? matches : []).flatMap(match => {
    if (match.matchIsFinished !== true || (match.leagueShortcut && match.leagueShortcut !== code)) return [];
    // Never use the local-time timestamp when the UTC field is absent.
    const date = match.matchDateTimeUTC;
    if (!/Z$|[+-]\d{2}:\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(date)) || Date.parse(date) >= now.getTime()) return [];
    const finals = (match.matchResults || []).filter(result => result.resultTypeID === 2);
    if (finals.length !== 1 || !match.team1?.teamName || !match.team2?.teamName || !Number.isInteger(match.matchID)) return [];
    const score = finals[0];
    if (![score.pointsTeam1, score.pointsTeam2].every(x => Number.isInteger(x) && x >= 0 && x <= 30)) return [];
    return [{ id: `openligadb:${match.matchID}`, date, home: name(match.team1.teamName), away: name(match.team2.teamName),
      homeScore: score.pointsTeam1, awayScore: score.pointsTeam2, regulationVerified: true,
      league: match.leagueName || code, source: 'OpenLigaDB' }];
  });
}

async function loadSeason(code, year) {
  const result = await cachedProviderCall({ cacheKey: `openligadb:v1:${code}:${year}`, provider: 'OpenLigaDB', ttlSeconds: 3600, staleSeconds: 86400,
    loader: async () => {
      const response = await fetch(`${ROOT}/getmatchdata/${code}/${year}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5500) });
      if (!response.ok) throw new Error('source_unavailable');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('invalid_dataset');
      return data;
    } });
  return result.payload;
}

async function enrichOpenLigaDb(analysis) {
  const teams = [analysis.teams.home, analysis.teams.away];
  const code = competitionCode(analysis.fixture?.league, teams[0].country);
  if (!code || teams[0].country !== teams[1].country) {
    analysis.sourceStatus.openLigaDb = 'league_not_covered'; return analysis;
  }
  try {
    const datasets = await Promise.all(seasonYears().map(year => loadSeason(code, year).catch(() => null)));
    if (!datasets.some(Array.isArray)) throw new Error('datasets_unavailable');
    const rows = datasets.flatMap(data => normalizeMatches(data, code, teams));
    const context = contextFromHistory(rows, teams[0].name, teams[1].name, {
      source: 'OpenLigaDB', cutoff: analysis.fixture?.date || new Date(), leagueEvents: rows
    });
    const used = applyHistory(analysis, context);
    analysis.sourceStatus.openLigaDb = used ? 'Connected · verified match history' : context.reason || 'Available';
    analysis.dataSources = [...(analysis.dataSources || []), { name: 'OpenLigaDB', url: 'https://www.openligadb.de/', license: 'ODbL-1.0', used,
      homeSample: context.homeForm.played, awaySample: context.awayForm.played }];
  } catch (_) { analysis.sourceStatus.openLigaDb = 'temporarily_unavailable'; }
  return analysis;
}

// The provider's current-season catalogue is also an identity source. This
// recovers clubs missing from TheSportsDB without fuzzy city-name matching.
async function resolveOpenLigaClubs(analysis) {
  const sides = ['home', 'away'];
  const teams = sides.map(side => analysis.teams[side]);
  if (teams.some(team => team.country && team.country !== 'Germany')) return analysis;
  const knownCode = competitionCode(analysis.fixture?.league, 'Germany');
  // Team directories may retain a previous season's division after promotion.
  const codes = [...new Set([knownCode, 'bl1', 'bl2', 'bl3'].filter(Boolean))];
  const datasets = await Promise.all(codes.map(async code => ({code, rows: await loadSeason(code, seasonYears()[0]).catch(() => [])})));
  for (const side of sides) {
    const team = analysis.teams[side];
    const hits = new Map();
    for (const {code, rows} of datasets) for (const match of rows) for (const club of [match.team1, match.team2]) {
      if (!Number.isInteger(club?.teamId)) continue;
      if (![team.name, ...(team.aliases || [])].some(name => sameTeam(name, club.teamName))) continue;
      hits.set(club.teamId, {...club, code});
    }
    if (hits.size !== 1) continue;
    const club = [...hits.values()][0];
    const badge = /^https:\/\//.test(club.teamIconUrl || '') ? club.teamIconUrl : null;
    analysis.teams[side] = {...team, name: team.name, country: 'Germany', resolved: true,
      openLigaId: club.teamId, openLigaCode: club.code, badge: team.badge || badge,
      aliases: [...new Set([...(team.aliases || []), club.teamName])], metadataSource: team.metadataSource ? `${team.metadataSource} + OpenLigaDB` : 'OpenLigaDB'};
  }
  const home = analysis.teams.home, away = analysis.teams.away;
  if (home.openLigaCode && home.openLigaCode === away.openLigaCode) {
    const code = home.openLigaCode;
    const league = {bl1:'German Bundesliga',bl2:'German 2. Bundesliga',bl3:'German 3. Liga'}[code];
    analysis.fixture.league = league;
    const future = datasets.find(item => item.code === code)?.rows.filter(match => !match.matchIsFinished &&
      /Z$|[+-]\d{2}:\d{2}$/.test(match.matchDateTimeUTC || '') && Date.parse(match.matchDateTimeUTC) > Date.now() &&
      Date.parse(match.matchDateTimeUTC) <= Date.now() + 30 * 864e5 &&
      ((match.team1?.teamId === home.openLigaId && match.team2?.teamId === away.openLigaId) ||
       (match.team2?.teamId === home.openLigaId && match.team1?.teamId === away.openLigaId)))
      .sort((a,b) => Date.parse(a.matchDateTimeUTC) - Date.parse(b.matchDateTimeUTC))[0];
    if (future) {
      const reversed = future.team1.teamId !== home.openLigaId;
      if (reversed) {
        [analysis.teams.home, analysis.teams.away] = [away, home];
        [analysis.form.home, analysis.form.away] = [analysis.form.away, analysis.form.home];
        analysis.fixture.venue = null;
        analysis.weather = null;
      }
      analysis.fixture = {...analysis.fixture, date: future.matchDateTimeUTC, league, id: `openligadb:${future.matchID}`,
        source: 'OpenLigaDB', inputReversed: reversed};
    }
  }
  return analysis;
}

async function completedOpenLigaMatches(league, country, date) {
  const code = competitionCode(league, country);
  if (!code) return [];
  const rows = await loadSeason(code, seasonYears(new Date(date))[0]);
  return normalizeMatches(rows, code).filter(row => row.date.slice(0,10) === date).map(row => ({...row, status:'FINISHED'}));
}

module.exports = { enrichOpenLigaDb, competitionCode, seasonYears, normalizeMatches, resolveOpenLigaClubs, completedOpenLigaMatches };
