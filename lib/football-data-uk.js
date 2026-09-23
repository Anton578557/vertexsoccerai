'use strict';

const { sameTeam } = require('./match-integrity');
const { cachedProviderCall } = require('./provider-cache');
const { basicStats, leagueTable, advancedStats, buildLeagueContext, buildH2h } = require('./football-data-enrichment');

const BASE = 'https://www.football-data.co.uk/mmz4281';
function clean(value) {
  return String(value || '').trim();
}

const INTERNATIONAL = {
  ARG: { country: 'argentina', league: /argentin|liga profesional/ },
  BRA: { country: 'brazil', league: /brasil|brazil|serie a/ },
  MEX: { country: 'mexico', league: /mexic|liga mx/ },
  USA: { country: 'united states', league: /major league soccer|mls/ },
  JPN: { country: 'japan', league: /japan j1|j1 league|j.league division 1/ }
};
function leagueCode(leagueName, country = '') {
  const value = clean(leagueName).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const nation = clean(country).toLowerCase();
  if (!value) return null;
  for (const [code, meta] of Object.entries(INTERNATIONAL)) {
    if ((!nation || nation === meta.country) && meta.league.test(value) && !/segunda|division 2|j2|serie b/.test(value)) return code;
  }
  const rules = [
    ['E1', 'england', /championship/], ['E2', 'england', /league one|league 1 england/],
    ['E3', 'england', /league two|league 2 england/], ['E0', 'england', /^(english )?premier league$/],
    ['SP2', 'spain', /segunda division|laliga 2/], ['SP1', 'spain', /^(spanish )?(la liga|laliga|primera division)$/],
    ['D2', 'germany', /2\. bundesliga|bundesliga 2/], ['D1', 'germany', /^(german )?bundesliga$/],
    ['I2', 'italy', /^(italian )?serie b$/], ['I1', 'italy', /^(italian )?serie a$/],
    ['F2', 'france', /^(french )?ligue 2$/], ['F1', 'france', /^(french )?ligue 1$/],
    ['N1', 'netherlands', /eredivisie/], ['P1', 'portugal', /primeira liga|liga portugal/],
    ['B1', 'belgium', /jupiler|belgian first|pro league/], ['SC0', 'scotland', /scottish premiership|premiership scotland/],
    ['G1', 'greece', /greek super|super league greece/], ['T1', 'turkey', /turkish super|super lig/]
  ];
  // Generic Primera División is ambiguous without a country.
  if (value === 'primera division' && nation !== 'spain') return null;
  return rules.find(([, expected, pattern]) => (!nation || nation === expected) && pattern.test(value))?.[0] || null;
}

function seasonCode(date = new Date()) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const start = month >= 7 ? year : year - 1;
  const end = start + 1;
  return `${String(start).slice(-2)}${String(end).slice(-2)}`;
}

function previousSeasonCode(code) {
  const start = Number(code.slice(0, 2));
  const end = Number(code.slice(2, 4));
  return `${String((start + 99) % 100).padStart(2, '0')}${String((end + 99) % 100).padStart(2, '0')}`;
}

function parseCsvLine(line) {
  const out = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(value);
      value = '';
    } else value += ch;
  }
  out.push(value);
  return out;
}

function parseCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((x) => x.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => { row[header] = values[index] ?? ''; });
    return { ...row, HomeTeam: row.HomeTeam || row.Home, AwayTeam: row.AwayTeam || row.Away, FTHG: row.FTHG ?? row.HG, FTAG: row.FTAG ?? row.AG };
  }).filter((row) => row.HomeTeam && row.AwayTeam);
}

async function fetchSeason(code, season) {
  const international = Boolean(INTERNATIONAL[code]);
  const { payload } = await cachedProviderCall({
    cacheKey: `football-data-uk:rows:v2:${code}:${international ? 'all' : season}`,
    provider: 'Football-Data.co.uk', ttlSeconds: 3600, staleSeconds: 21600,
    loader: async () => {
      const url = international ? `https://www.football-data.co.uk/new/${code}.csv` : `${BASE}/${season}/${code}.csv`;
      const response = await fetch(url, { signal: AbortSignal.timeout(18000), headers: { Accept: 'text/csv,*/*' } });
      if (!response.ok) throw new Error(`Football-Data.co.uk ${response.status}`);
      const rows = parseCsv(await response.text());
      // Keep a bounded recent window in the shared cache, not fourteen years of odds.
      return rows.filter(row => rowDate(row) > Date.now() - 760 * 864e5).map(row => {
        const out = {};
        for (const key of ['Date','Time','HomeTeam','AwayTeam','FTHG','FTAG','HC','AC','HY','AY','HR','AR','HS','AS','HST','AST','HF','AF','HO','AO']) if (row[key] != null) out[key] = row[key];
        return out;
      });
    }
  });
  return Array.isArray(payload) ? payload : [];
}

function num(row, key) {
  const raw = row?.[key];
  if (raw == null || String(raw).trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function rowDate(row) {
  const m = String(row.Date || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return NaN;
  const year = +m[3] < 100 ? 2000 + +m[3] : +m[3];
  const value = Date.UTC(year, +m[2]-1, +m[1]);
  const date = new Date(value);
  return date.getUTCDate() === +m[1] && date.getUTCMonth() === +m[2]-1 ? value : NaN;
}

function historicalRows(rows, cutoff = new Date(), days = 365) {
  // Daily CSV times have no guaranteed time zone. Exclude the entire target day.
  const before = new Date(Math.min(Date.now(), new Date(cutoff).getTime()));
  const end = Date.UTC(before.getUTCFullYear(), before.getUTCMonth(), before.getUTCDate());
  const unique = new Map();
  for (const row of rows) {
    const date = rowDate(row);
    if (!Number.isFinite(date) || date >= end || date < end - days*864e5 || !Number.isInteger(num(row,'FTHG')) || !Number.isInteger(num(row,'FTAG'))) continue;
    unique.set(`${date}:${row.HomeTeam}:${row.AwayTeam}`, row);
  }
  return [...unique.values()].sort((a,b) => rowDate(a)-rowDate(b));
}

async function loadHistoricalRows(code, fixtureDate) {
  const current = seasonCode(new Date(Math.min(Date.now(), new Date(fixtureDate || Date.now()).getTime())));
  const seasons = INTERNATIONAL[code] ? ['all'] : [previousSeasonCode(current), current];
  const batches = await Promise.all(seasons.map(season => fetchSeason(code, season).catch(error => { console.warn('open-results', { code, season, error: error.name || 'upstream_failed' }); return []; })));
  return { rows: historicalRows(batches.flat(), fixtureDate || new Date()), seasons };
}

function historyContext(rows, homeName, awayName, cutoff = new Date()) {
  const cleanRows = historicalRows(rows, cutoff);
  const events = cleanRows.map(row => ({ date: new Date(rowDate(row)).toISOString(), home: row.HomeTeam, away: row.AwayTeam, homeScore: num(row,'FTHG'), awayScore: num(row,'FTAG') }));
  const table = leagueTable(events);
  const homeEvents = events.filter(m => sameTeam(m.home,homeName) || sameTeam(m.away,homeName));
  const awayEvents = events.filter(m => sameTeam(m.home,awayName) || sameTeam(m.away,awayName));
  const homeForm = basicStats(homeEvents, homeName), awayForm = basicStats(awayEvents, awayName);
  const end = Math.min(Date.now(), new Date(cutoff).getTime());
  const fresh = matches => matches.length && end - new Date(matches.at(-1).date).getTime() <= 90*864e5;
  const ok = homeForm.played >= 3 && awayForm.played >= 3 && fresh(homeEvents) && fresh(awayEvents);
  return { ok: Boolean(ok), source: 'Football-Data.co.uk', reason: ok ? null : 'Insufficient recent results for both teams in this league.', homeForm, awayForm,
    advanced: { home: advancedStats(events,homeName,table,cutoff,'home'), away: advancedStats(events,awayName,table,cutoff,'away') },
    leagueContext: buildLeagueContext(events), h2h: buildH2h(events,homeName,awayName),
    history: { home: homeEvents.slice(-12).reverse(), away: awayEvents.slice(-12).reverse() } };
}

async function buildOpenHistoricalContext(homeName, awayName, leagueName, country, fixtureDate) {
  const code = leagueCode(leagueName,country);
  if (!code) return {ok:false,reason:'league_not_covered'};
  const {rows} = await loadHistoricalRows(code,fixtureDate);
  return {...historyContext(rows,homeName,awayName,fixtureDate || new Date()), code};
}

function metricForTeam(row, teamName, forKeyHome, forKeyAway, againstKeyHome, againstKeyAway) {
  const isHome = sameTeam(row.HomeTeam, teamName);
  const isAway = sameTeam(row.AwayTeam, teamName);
  if (!isHome && !isAway) return null;
  return {
    for: isHome ? num(row, forKeyHome) : num(row, forKeyAway),
    against: isHome ? num(row, againstKeyHome) : num(row, againstKeyAway)
  };
}

function teamRows(rows, teamName, limit = 12) {
  return rows
    .filter((row) => sameTeam(row.HomeTeam, teamName) || sameTeam(row.AwayTeam, teamName))
    .slice(-Math.max(1, limit));
}

function average(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : null;
}

function teamProfile(rows, teamName) {
  const sample = teamRows(rows, teamName, 12);
  const collect = (homeFor, awayFor, homeAgainst, awayAgainst) => {
    const values = sample.map((row) => metricForTeam(row, teamName, homeFor, awayFor, homeAgainst, awayAgainst)).filter(Boolean);
    return {
      for: average(values.map((v) => v.for)),
      against: average(values.map((v) => v.against)),
      n: values.filter((v) => Number.isFinite(v.for) && Number.isFinite(v.against)).length
    };
  };

  return {
    matches: sample.length,
    corners: collect('HC', 'AC', 'AC', 'HC'),
    yellowCards: collect('HY', 'AY', 'AY', 'HY'),
    redCards: collect('HR', 'AR', 'AR', 'HR'),
    shots: collect('HS', 'AS', 'AS', 'HS'),
    shotsOnTarget: collect('HST', 'AST', 'AST', 'HST'),
    fouls: collect('HF', 'AF', 'AF', 'HF'),
    offsides: collect('HO', 'AO', 'AO', 'HO')
  };
}

function blendedExpected(homeMetric, awayMetric) {
  const values = [homeMetric?.for, awayMetric?.against].filter(Number.isFinite);
  if (!values.length) return null;
  if (values.length === 1) return values[0];
  return values[0] * 0.56 + values[1] * 0.44;
}

function factorial(n) {
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
}

function poisson(lambda, k) {
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
}

function poissonOver(lambda, line) {
  if (!Number.isFinite(lambda) || lambda < 0) return null;
  const min = Math.floor(line) + 1;
  let under = 0;
  for (let k = 0; k < min; k++) under += poisson(lambda, k);
  return Math.max(0, Math.min(1, 1 - under));
}

function pct(value) {
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function expectedPair(homeProfile, awayProfile, metric) {
  if ((homeProfile?.[metric]?.n || 0) < 3 || (awayProfile?.[metric]?.n || 0) < 3) return {home:null,away:null,total:null};
  const home = blendedExpected(homeProfile?.[metric], awayProfile?.[metric]);
  const away = blendedExpected(awayProfile?.[metric], homeProfile?.[metric]);
  return { home, away, total: Number.isFinite(home) && Number.isFinite(away) ? home + away : null };
}

async function buildGranularHistoricalModel(homeName, awayName, leagueName, fixtureDate, country = '') {
  const code = leagueCode(leagueName, country);
  if (!code) return { ok: false, reason: 'League is not mapped to Football-Data.co.uk.', source: 'Football-Data.co.uk' };

  const { rows, seasons } = await loadHistoricalRows(code, fixtureDate);
  if (!rows.length) return { ok: false, reason: 'No historical CSV rows returned.', source: 'Football-Data.co.uk', code };

  const home = teamProfile(rows, homeName);
  const away = teamProfile(rows, awayName);
  if (!home.matches || !away.matches) {
    return { ok: false, reason: 'Teams were not matched in the historical CSV.', source: 'Football-Data.co.uk', code };
  }

  const corners = expectedPair(home, away, 'corners');
  const cards = expectedPair(home, away, 'yellowCards');
  const shots = expectedPair(home, away, 'shots');
  const shotsOnTarget = expectedPair(home, away, 'shotsOnTarget');
  const offsides = expectedPair(home, away, 'offsides');
  const fouls = expectedPair(home, away, 'fouls');

  const coverage = {
    corners: Number.isFinite(corners.total),
    cards: Number.isFinite(cards.total),
    shots: Number.isFinite(shots.total),
    shotsOnTarget: Number.isFinite(shotsOnTarget.total),
    offsides: Number.isFinite(offsides.total),
    fouls: Number.isFinite(fouls.total)
  };

  const sample = Math.min(home.matches, away.matches);
  const quality = Math.max(0, Math.min(100, Math.round(38 + Math.min(sample, 12) * 4.5)));

  return {
    ok: Object.values(coverage).some(Boolean),
    source: 'Football-Data.co.uk',
    code,
    seasons,
    sample: { home: home.matches, away: away.matches },
    quality,
    methodology: 'Recent historical event averages blended with opponent allowed averages; Poisson baseline for count-market thresholds.',
    coverage,
    corners: coverage.corners ? {
      expectedHome: round(corners.home), expectedAway: round(corners.away), expectedTotal: round(corners.total),
      over75: pct(poissonOver(corners.total, 7.5)), over85: pct(poissonOver(corners.total, 8.5)),
      over95: pct(poissonOver(corners.total, 9.5)), over105: pct(poissonOver(corners.total, 10.5))
    } : null,
    cards: coverage.cards ? {
      expectedHome: round(cards.home), expectedAway: round(cards.away), expectedTotal: round(cards.total),
      over35: pct(poissonOver(cards.total, 3.5)), over45: pct(poissonOver(cards.total, 4.5)),
      over55: pct(poissonOver(cards.total, 5.5))
    } : null,
    shots: coverage.shots ? {
      expectedHome: round(shots.home), expectedAway: round(shots.away), expectedTotal: round(shots.total),
      over215: pct(poissonOver(shots.total, 21.5)), over235: pct(poissonOver(shots.total, 23.5)), over255: pct(poissonOver(shots.total, 25.5))
    } : null,
    shotsOnTarget: coverage.shotsOnTarget ? {
      expectedHome: round(shotsOnTarget.home), expectedAway: round(shotsOnTarget.away), expectedTotal: round(shotsOnTarget.total),
      over65: pct(poissonOver(shotsOnTarget.total, 6.5)), over75: pct(poissonOver(shotsOnTarget.total, 7.5)), over85: pct(poissonOver(shotsOnTarget.total, 8.5))
    } : null,
    offsides: coverage.offsides ? {
      expectedHome: round(offsides.home), expectedAway: round(offsides.away), expectedTotal: round(offsides.total),
      over25: pct(poissonOver(offsides.total, 2.5)), over35: pct(poissonOver(offsides.total, 3.5)), over45: pct(poissonOver(offsides.total, 4.5))
    } : null,
    fouls: coverage.fouls ? {
      expectedHome: round(fouls.home), expectedAway: round(fouls.away), expectedTotal: round(fouls.total)
    } : null
  };
}

async function completedCsvMatches(league, country, date) {
  const code = leagueCode(league,country);
  // CSV has no reliable live status/timezone: only settle after its calendar day.
  if (!code || date >= new Date().toISOString().slice(0,10)) return [];
  const cutoff = new Date(Date.parse(date) + 864e5);
  const {rows} = await loadHistoricalRows(code, cutoff);
  return rows.filter(row => new Date(rowDate(row)).toISOString().slice(0,10) === date).map(row => ({
    home:row.HomeTeam,away:row.AwayTeam,homeScore:num(row,'FTHG'),awayScore:num(row,'FTAG'),date:new Date(rowDate(row)).toISOString(),status:'FINISHED',source:'Football-Data.co.uk'
  }));
}

module.exports = { buildOpenHistoricalContext, historyContext, buildGranularHistoricalModel, leagueCode, seasonCode, parseCsv, num, rowDate, historicalRows, fetchSeason, teamProfile, completedCsvMatches };
