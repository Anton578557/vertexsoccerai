'use strict';

const { boundedFetch: fetch } = require('./analysis-budget');

const { cachedProviderCall } = require('./provider-cache');
const { sameTeam, teamIdentity } = require('./match-integrity');
const { contextFromHistory, applyHistory } = require('./verified-history');

const ROOT = 'https://raw.githubusercontent.com/openfootball/football.json/master';
// Only verified current datasets, all regular domestic leagues. Cup totals may
// include extra time and are deliberately not accepted by this adapter.
const COVERAGE = [
  ['en.1', 'England', /^(english )?premier league$/],
  ['en.2', 'England', /championship/], ['de.1', 'Germany', /^(german )?bundesliga$/],
  ['es.1', 'Spain', /^(spanish )?(la ?liga|primera division)$/],
  ['it.1', 'Italy', /^(italian )?serie a$/], ['fr.1', 'France', /^(french )?ligue 1$/],
  ['nl.1', 'Netherlands', /eredivisie/], ['pt.1', 'Portugal', /primeira|liga portugal/],
  ['br.1', 'Brazil', /^(brazilian )?(serie a|brasileirao|campeonato brasileiro serie a)$/]
];
const competitionCode = (league, country) => COVERAGE.find(([, nation, re]) => country === nation && re.test(String(league || '').toLowerCase()))?.[0] || null;

function seasonPaths(code, now = new Date()) {
  const year = now.getUTCFullYear();
  if (code === 'br.1') return [`${year}/${code}.json`, `${year - 1}/${code}.json`];
  const start = now.getUTCMonth() >= 6 ? year : year - 1;
  return [start, start - 1].map(y => `${y}-${String(y + 1).slice(-2)}/${code}.json`);
}

function normalizeMatches(data, code, teams = [], now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const name = value => teams.find(team => [team.name, ...(team.aliases || [])].some(alias => sameTeam(alias, value)))?.name || value;
  return (Array.isArray(data.matches) ? data.matches : []).flatMap(match => {
    const score = Array.isArray(match.score) ? match.score : match.score?.ft;
    // These files have dates without a timezone or a reliable live status. Use
    // only completed prior calendar days, never a partially played match today.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(match.date || '') || match.date >= today || !match.team1 || !match.team2 ||
      !Array.isArray(score) || score.length !== 2 || !score.every(x => Number.isInteger(x) && x >= 0 && x <= 30) ||
      match.score?.et || match.score?.p || match.score?.pen || match.score?.aet) return [];
    return [{ id: `openfootball:${code}:${match.date}:${teamIdentity(match.team1)}:${teamIdentity(match.team2)}`,
      date: `${match.date}T23:59:59Z`, home: name(match.team1), away: name(match.team2),
      homeScore: score[0], awayScore: score[1], regulationVerified: true,
      league: data.name || code, source: 'OpenFootball' }];
  });
}

async function loadSeason(path) {
  const result = await cachedProviderCall({cacheKey:`openfootball:v1:${path}`, provider:'OpenFootball', ttlSeconds:3600, staleSeconds:86400,
    loader: async () => {
      const response = await fetch(`${ROOT}/${path}`, {headers:{Accept:'application/json'},signal:AbortSignal.timeout(5500)});
      if (response.status === 404) return {matches:[], missing:true};
      if (!response.ok) throw new Error(`OpenFootball ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.matches)) throw new Error('invalid_dataset');
      return data;
    }});
  return result.payload;
}

async function enrichOpenFootball(analysis) {
  const code = competitionCode(analysis.fixture?.league, analysis.teams?.home?.country);
  if (!code || analysis.teams.home.country !== analysis.teams.away.country) {
    analysis.sourceStatus.openFootball = 'league_not_covered'; return analysis;
  }
  try {
    const paths = seasonPaths(code);
    const datasets = await Promise.all(paths.map(path => loadSeason(path).catch(() => null)));
    if (!datasets.some(data => data && !data.missing)) throw new Error('datasets_unavailable');
    const teams = [analysis.teams.home, analysis.teams.away];
    const rows = datasets.flatMap(data => data ? normalizeMatches(data, code, teams) : []);
    const context = contextFromHistory(rows, teams[0].name, teams[1].name, {
      source:'OpenFootball', cutoff:analysis.fixture?.date || new Date(), leagueEvents:rows
    });
    const used = applyHistory(analysis, context);
    analysis.sourceStatus.openFootball = used ? 'Connected · verified match history' : context.reason || 'Available';
    analysis.dataSources = [...(analysis.dataSources || []), {name:'OpenFootball',url:'https://github.com/openfootball/football.json',license:'CC0-1.0',used,
      homeSample:context.homeForm.played,awaySample:context.awayForm.played}];
  } catch (_) { analysis.sourceStatus.openFootball = 'temporarily_unavailable'; }
  return analysis;
}

module.exports = { enrichOpenFootball, normalizeMatches, competitionCode, seasonPaths };
