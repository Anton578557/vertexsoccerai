'use strict';

const BASE = 'https://www.football-data.co.uk/mmz4281';
const CACHE_TTL_MS = 20 * 60 * 1000;
const cache = new Map();

const LEAGUE_CODES = [
  { code: 'E0', patterns: ['premier league', 'english premier'] },
  { code: 'E1', patterns: ['championship', 'efl championship'] },
  { code: 'E2', patterns: ['league one', 'league 1 england'] },
  { code: 'E3', patterns: ['league two', 'league 2 england'] },
  { code: 'SP1', patterns: ['primera division', 'primera división', 'la liga', 'laliga'] },
  { code: 'SP2', patterns: ['segunda division', 'segunda división', 'laliga 2'] },
  { code: 'D1', patterns: ['bundesliga'] },
  { code: 'D2', patterns: ['2. bundesliga', 'bundesliga 2'] },
  { code: 'I1', patterns: ['serie a'] },
  { code: 'I2', patterns: ['serie b'] },
  { code: 'F1', patterns: ['ligue 1'] },
  { code: 'F2', patterns: ['ligue 2'] },
  { code: 'N1', patterns: ['eredivisie'] },
  { code: 'P1', patterns: ['primeira liga', 'liga portugal'] },
  { code: 'B1', patterns: ['jupiler pro league', 'belgian first division', 'pro league'] },
  { code: 'SC0', patterns: ['scottish premiership', 'premiership scotland'] },
  { code: 'G1', patterns: ['super league greece', 'greek super league'] },
  { code: 'T1', patterns: ['super lig', 'süper lig', 'turkish super lig'] }
];

function clean(value) {
  return String(value || '').trim();
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|afc|sc|club|de|the|real|rcd)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameScore(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.92;
  const xs = new Set(x.split(' '));
  const ys = new Set(y.split(' '));
  const common = [...xs].filter((v) => ys.has(v)).length;
  return common / Math.max(xs.size, ys.size, 1);
}

function sameTeam(a, b) {
  return nameScore(a, b) >= 0.58;
}

function leagueCode(leagueName) {
  const value = clean(leagueName).toLowerCase();
  if (!value) return null;
  const exactSecond = LEAGUE_CODES.find((item) => item.code.endsWith('2') && item.patterns.some((pattern) => value.includes(pattern)));
  if (exactSecond) return exactSecond.code;
  const match = LEAGUE_CODES.find((item) => item.patterns.some((pattern) => value.includes(pattern)));
  return match?.code || null;
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
    return row;
  }).filter((row) => row.HomeTeam && row.AwayTeam);
}

async function fetchSeason(code, season) {
  const key = `${season}:${code}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.rows;

  const response = await fetch(`${BASE}/${season}/${code}.csv`, {
    headers: { Accept: 'text/csv,*/*', 'User-Agent': 'VertexSoccerAI/2.0' }
  });
  if (!response.ok) throw new Error(`Football-Data.co.uk ${response.status}`);
  const rows = parseCsv(await response.text());
  cache.set(key, { at: Date.now(), rows });
  return rows;
}

function num(row, key) {
  const value = Number(row?.[key]);
  return Number.isFinite(value) ? value : null;
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
      n: values.filter((v) => Number.isFinite(v.for) || Number.isFinite(v.against)).length
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
  const home = blendedExpected(homeProfile?.[metric], awayProfile?.[metric]);
  const away = blendedExpected(awayProfile?.[metric], homeProfile?.[metric]);
  return { home, away, total: Number.isFinite(home) && Number.isFinite(away) ? home + away : null };
}

async function buildGranularHistoricalModel(homeName, awayName, leagueName, fixtureDate) {
  const code = leagueCode(leagueName);
  if (!code) return { ok: false, reason: 'League is not mapped to Football-Data.co.uk.', source: 'Football-Data.co.uk' };

  const current = seasonCode(fixtureDate || new Date());
  const previous = previousSeasonCode(current);
  let currentRows = [];
  let previousRows = [];

  try { currentRows = await fetchSeason(code, current); } catch (_) {}
  try { previousRows = await fetchSeason(code, previous); } catch (_) {}
  const rows = [...previousRows, ...currentRows];
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
    seasons: [previous, current],
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

module.exports = { buildGranularHistoricalModel, leagueCode, seasonCode };
