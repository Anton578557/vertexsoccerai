'use strict';

const { cachedProviderCall } = require('./provider-cache');
const { sameTeam } = require('./match-integrity');
const { contextFromHistory, applyHistory } = require('./verified-history');

const ROOT = 'https://api.openligadb.de';
// Official community shortcuts. Restrict to regular leagues: a cup's final
// result can include extra time, unlike these 90-minute league results.
function competitionCode(league, country) {
  if (country !== 'Germany') return null;
  const name = String(league || '').toLowerCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(german )?bundesliga$/.test(name)) return 'bl1';
  if (/^(german )?2 bundesliga$/.test(name)) return 'bl2';
  if (/^(german )?3 liga$/.test(name)) return 'bl3';
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

module.exports = { enrichOpenLigaDb, competitionCode, seasonYears, normalizeMatches };
