'use strict';

const { cachedProviderCall } = require('./provider-cache');
const { sameTeam, regulationScore } = require('./match-integrity');
const { completedOpenLigaMatches } = require('./openligadb-history');
const { completedCsvMatches } = require('./football-data-uk');
const { completedBsdMatches } = require('./bsd-history');

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';

function cfg() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SECRET_KEY || '').trim();
  return url && key ? { url, key } : null;
}

function dbHeaders(key, extra = {}) {
  return {
    apikey: key,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extra
  };
}

function isoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseFixtureKey(key) {
  const [date, homeSlug, awaySlug] = String(key || '').split('|');
  if (!date || !homeSlug || !awaySlug) return null;
  return { date, home: homeSlug.replace(/-/g, ' '), away: awaySlug.replace(/-/g, ' ') };
}

async function supabaseSelect(path, params = {}) {
  const config = cfg();
  if (!config) return [];
  const url = new URL(`${config.url}/rest/v1/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: dbHeaders(config.key), signal: AbortSignal.timeout(7500) });
  if (!response.ok) throw new Error(`Supabase select ${response.status}`);
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function patchEvaluation(id, values) {
  const config = cfg();
  if (!config || !id) return false;
  const url = new URL(`${config.url}/rest/v1/model_evaluations`);
  url.searchParams.set('id', `eq.${id}`);
  url.searchParams.set('actual_value', 'is.null');
  const response = await fetch(url, {
    method: 'PATCH',
    signal: AbortSignal.timeout(7500),
    headers: dbHeaders(config.key, { Prefer: 'return=minimal' }),
    body: JSON.stringify(values)
  });
  return response.ok;
}

async function footballDataMatches(date) {
  const key = String(process.env.FOOTBALL_DATA_KEY || '').trim();
  if (!key || !date) return [];
  const cacheKey = `football-data:final:v2:${date}`;
  const { payload } = await cachedProviderCall({
    cacheKey,
    provider: 'Football-Data',
    ttlSeconds: 900,
    loader: async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7500);
      try {
        const nextDate = new Date(Date.parse(date) + 864e5).toISOString().slice(0,10);
        const response = await fetch(`${FOOTBALL_DATA_BASE}/matches?dateFrom=${encodeURIComponent(date)}&dateTo=${encodeURIComponent(nextDate)}`, {
          signal: controller.signal,
          headers: { 'X-Auth-Token': key, Accept: 'application/json', 'User-Agent': 'VertexSoccerAI/4.0' }
        });
        if (!response.ok) return null;
        return response.json().catch(() => null);
      } finally { clearTimeout(timer); }
    }
  });
  return (payload?.matches || []).flatMap((match) => {
    const score = regulationScore(match);
    return score && isoDate(match.utcDate) === date ? [{ status: 'FINISHED', source:'Football-Data', date:match.utcDate, home: match.homeTeam?.name || '', away: match.awayTeam?.name || '', homeScore: score.home, awayScore: score.away }] : [];
  });
}

function findMatch(matches, home, away) {
  const hits = matches.filter((match) => match.status === 'FINISHED').flatMap((match) => {
    if (sameTeam(match.home, home) && sameTeam(match.away, away)) return [{ ...match, reversed: false }];
    if (sameTeam(match.home, away) && sameTeam(match.away, home)) return [{ ...match, reversed: true }];
    return [];
  });
  return hits.length === 1 ? hits[0] : null;
}

function actualForMarket(market, match) {
  const home = match.reversed ? match.awayScore : match.homeScore;
  const away = match.reversed ? match.homeScore : match.awayScore;
  if (![home,away].every(value => Number.isInteger(value) && value >= 0 && value <= 30)) return null;
  const outcome = home > away ? 'HOME' : home < away ? 'AWAY' : 'DRAW';
  const total = home + away;
  if (market === '1X2') return { actual: outcome, score: `${home}-${away}` };
  if (market === 'GOALS_OU_2_5') return { actual: total >= 3 ? 'OVER' : 'UNDER', score: `${home}-${away}` };
  if (market === 'BTTS') return { actual: home > 0 && away > 0 ? 'YES' : 'NO', score: `${home}-${away}` };
  if (market === 'DOUBLE_CHANCE') {
    const actual = outcome === 'HOME' ? '1' : outcome === 'AWAY' ? '2' : 'X';
    return { actual, score: `${home}-${away}` };
  }
  return null;
}

function predictionCorrect(market, predicted, actual) {
  if (market === 'DOUBLE_CHANCE') {
    if (predicted === '1X') return actual === '1' || actual === 'X';
    if (predicted === 'X2') return actual === 'X' || actual === '2';
    if (predicted === '12') return actual === '1' || actual === '2';
    return false;
  }
  return String(predicted || '').toUpperCase() === String(actual || '').toUpperCase();
}

async function resolveFinalMatch(forecast, date, initial = [], loaders = {}, deadline = Date.now() + 40000) {
  const home = forecast?.teams?.home, away = forecast?.teams?.away;
  if (!home?.name || !away?.name) return null;
  const sameDate = rows => rows.filter(row => isoDate(row.date) === date);
  let match = findMatch(sameDate(initial), home.name, away.name);
  if (match) return match;
  const league = forecast.fixture?.league || '', country = home.country || '';
  const calls = [
    () => (loaders.openLiga || completedOpenLigaMatches)(league,country,date),
    () => (loaders.csv || completedCsvMatches)(league,country,date),
    () => (loaders.bsd || completedBsdMatches)(home,away,date)
  ];
  for (const load of calls) {
    if (Date.now() > deadline) break;
    try { match = findMatch(sameDate(await load()), home.name, away.name); } catch (_) { match = null; }
    if (match) return match;
  }
  return null;
}

async function evaluatePendingModels(limit = 60) {
  if (!cfg()) return { evaluated: 0, checkedFixtures: 0, reason: 'supabase_not_configured' };
  const cutoff = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  const rows = await supabaseSelect('model_evaluations', {
    select: 'id,fixture_key,fixture_date,market,predicted_value,created_at,forecast,model_version',
    actual_value: 'is.null', evaluation_status:'eq.pending', fixture_date: `lt.${cutoff}`,
    order: 'checked_at.asc.nullsfirst,fixture_date.asc',
    limit: String(Math.max(4, Math.min(Number(limit) || 60, 80)))
  });
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.fixture_key)) groups.set(row.fixture_key, []);
    groups.get(row.fixture_key).push(row);
  }
  const deadline = Date.now() + 40000;
  const matchesByDate = new Map();
  let evaluated = 0, checkedFixtures = 0, pending = 0;
  const entries = [...groups.values()].slice(0, 8);
  // Two fixtures concurrently; checked_at rotates unresolved games to the back.
  for (let i = 0; i < entries.length && Date.now() < deadline; i += 2) {
    const results = await Promise.all(entries.slice(i,i+2).map(async group => {
      const first = group[0], date = isoDate(first.fixture_date), parsed = parseFixtureKey(first.fixture_key);
      if (!date || !parsed) return {evaluated:0,checked:0,pending:0};
      if (!matchesByDate.has(date)) matchesByDate.set(date, footballDataMatches(date).catch(() => []));
      const fallback = {teams:{home:{name:parsed.home},away:{name:parsed.away}},fixture:{date:first.fixture_date}};
      const match = await resolveFinalMatch(first.forecast || fallback,date,await matchesByDate.get(date),{},deadline);
      const checkedAt = new Date().toISOString();
      let count = 0;
      await Promise.all(group.map(async row => {
        const timely = Date.parse(row.created_at) < Date.parse(row.fixture_date);
        const result = timely && match ? actualForMarket(row.market, match) : null;
        const values = {checked_at:checkedAt};
        if (!timely) values.evaluation_status = 'excluded_late';
        if (result) Object.assign(values, {actual_value:`${result.actual} · ${result.score}`,
          is_correct:predictionCorrect(row.market,row.predicted_value,result.actual), evaluated_at:checkedAt,
          evaluation_status:'evaluated', evaluation_source:match.source || 'Football-Data'});
        if (await patchEvaluation(row.id, values).catch(() => false)) { if (result) count++; }
      }));
      return {evaluated:count,checked:1,pending:match ? 0 : 1};
    }));
    for (const result of results) {evaluated += result.evaluated; checkedFixtures += result.checked; pending += result.pending;}
  }
  return {evaluated,checkedFixtures,pendingFixtures:pending,pendingRowsChecked:rows.length};
}

function summarizeEvaluations(input) {
  const rows = input.filter((row) => typeof row.is_correct === 'boolean' && Date.parse(row.created_at) < Date.parse(row.fixture_date));
  const byMarket = {};
  for (const row of rows) {
    const bucket = byMarket[row.market] ||= { evaluated: 0, correct: 0, squaredError: 0, probabilityCount: 0, bins: {} };
    bucket.evaluated++;
    if (row.is_correct) bucket.correct++;
    const p = row.predicted_probability == null ? NaN : Number(row.predicted_probability) / 100;
    if (Number.isFinite(p) && p >= 0 && p <= 1) {
      bucket.squaredError += (p - Number(row.is_correct)) ** 2;
      bucket.probabilityCount++;
      const label = String(Math.min(90, Math.floor(p * 10) * 10));
      const bin = bucket.bins[label] ||= { count: 0, predicted: 0, correct: 0 };
      bin.count++; bin.predicted += p; bin.correct += Number(row.is_correct);
    }
  }
  for (const bucket of Object.values(byMarket)) {
    bucket.accuracy = Math.round(100 * bucket.correct / bucket.evaluated);
    bucket.brierScore = bucket.probabilityCount ? Number((bucket.squaredError / bucket.probabilityCount).toFixed(4)) : null;
    bucket.brierBasis = 'selected_event';
    bucket.calibration = Object.entries(bucket.bins).map(([lower, bin]) => ({ fromPct: Number(lower), count: bin.count, predictedPct: Math.round(100 * bin.predicted / bin.count), observedPct: Math.round(100 * bin.correct / bin.count) }));
    delete bucket.squaredError; delete bucket.probabilityCount; delete bucket.bins;
  }
  const quality = rows.filter((row) => row.data_quality != null).map((row) => Number(row.data_quality)).filter(Number.isFinite);
  const fixtures = new Set(rows.map((row) => row.fixture_key)).size;
  // Score all three mutually exclusive outcomes when the original distribution
  // exists. Legacy rows contain only the selected event and cannot supply this.
  const outcomeErrors = rows.filter(row => row.market === '1X2').flatMap(row => {
    const actual = String(row.actual_value || '').split(' · ')[0];
    const outcomes = ['HOME','DRAW','AWAY'];
    const raw = outcomes.map(key => row.forecast?.model?.oneXtwo?.[key.toLowerCase()]);
    if (!outcomes.includes(actual) || !raw.every(p => typeof p === 'number' && p >= 0 && p <= 100)) return [];
    const total = raw.reduce((a,b) => a+b,0);
    if (total < 99 || total > 101) return [];
    return [raw.reduce((sum,p,i) => sum + (p/total - Number(outcomes[i] === actual))**2,0)];
  });
  return {
    evaluated: rows.length, fixtures, correct: rows.filter((row) => row.is_correct).length,
    // An aggregate across overlapping markets is not model accuracy.
    accuracy: null, accuracyBasis: 'per_market_only',
    averageDataQuality: quality.length ? Math.round(quality.reduce((a, b) => a + b, 0) / quality.length) : null,
    byMarket, calibrationStatus: 'not_calibrated',
    oneXtwoDistribution: { fixtures:outcomeErrors.length, brierScore:outcomeErrors.length ? Number((outcomeErrors.reduce((a,b)=>a+b,0)/outcomeErrors.length).toFixed(4)) : null },
    sampleStatus: fixtures < 100 ? 'collecting' : 'review_required',
    evaluatedModelVersions: [...new Set(rows.map(row => row.model_version || 'legacy_unversioned'))]
  };
}

async function performanceSummary() {
  if (!cfg()) return summarizeEvaluations([]);
  const rows = await supabaseSelect('model_evaluations', {
    select: 'is_correct,data_quality,market,predicted_probability,fixture_key,fixture_date,created_at,model_version,forecast,actual_value',
    is_correct: 'not.is.null', order: 'fixture_date.desc', limit: '10000'
  });
  const summary = summarizeEvaluations(rows);
  summary.byVersion = Object.fromEntries([...new Set(rows.map(row => row.model_version || 'legacy_unversioned'))].map(version =>
    [version,summarizeEvaluations(rows.filter(row => (row.model_version || 'legacy_unversioned') === version))]));
  return summary;
}

module.exports = { evaluatePendingModels, performanceSummary, findMatch, actualForMarket, summarizeEvaluations, resolveFinalMatch, footballDataMatches };
