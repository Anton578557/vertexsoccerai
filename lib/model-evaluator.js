'use strict';

const { cachedProviderCall } = require('./provider-cache');

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

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\b(fc|cf|afc|sc|club|de|the|ud|cd|real|rcd)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreName(a, b) {
  const x = normalize(a); const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.92;
  const xs = new Set(x.split(' ')); const ys = new Set(y.split(' '));
  const common = [...xs].filter((token) => ys.has(token)).length;
  return common / Math.max(xs.size, ys.size, 1);
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
  const response = await fetch(url, { headers: dbHeaders(config.key) });
  if (!response.ok) throw new Error(`Supabase select ${response.status}`);
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function patchEvaluation(id, values) {
  const config = cfg();
  if (!config || !id) return false;
  const url = new URL(`${config.url}/rest/v1/model_evaluations`);
  url.searchParams.set('id', `eq.${id}`);
  const response = await fetch(url, {
    method: 'PATCH',
    headers: dbHeaders(config.key, { Prefer: 'return=minimal' }),
    body: JSON.stringify(values)
  });
  return response.ok;
}

async function footballDataMatches(date) {
  const key = String(process.env.FOOTBALL_DATA_KEY || '').trim();
  if (!key || !date) return [];
  const cacheKey = `football-data:final:${date}`;
  const { payload } = await cachedProviderCall({
    cacheKey,
    provider: 'Football-Data',
    ttlSeconds: 12 * 3600,
    loader: async () => {
      const response = await fetch(`${FOOTBALL_DATA_BASE}/matches?dateFrom=${encodeURIComponent(date)}&dateTo=${encodeURIComponent(date)}`, {
        headers: { 'X-Auth-Token': key, Accept: 'application/json', 'User-Agent': 'VertexSoccerAI/4.0' }
      });
      if (!response.ok) return null;
      return response.json().catch(() => null);
    }
  });
  return (payload?.matches || []).map((match) => ({
    status: String(match?.status || '').toUpperCase(),
    home: match?.homeTeam?.name || '',
    away: match?.awayTeam?.name || '',
    homeScore: Number.isFinite(match?.score?.fullTime?.home) ? match.score.fullTime.home : null,
    awayScore: Number.isFinite(match?.score?.fullTime?.away) ? match.score.fullTime.away : null
  })).filter((match) => Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore));
}

function findMatch(matches, home, away) {
  let best = null;
  for (const match of matches) {
    const direct = scoreName(match.home, home) + scoreName(match.away, away);
    const reverse = scoreName(match.home, away) + scoreName(match.away, home);
    const score = Math.max(direct, reverse);
    if (score < 1.25) continue;
    if (!best || score > best.score) best = { ...match, score, reversed: reverse > direct };
  }
  return best;
}

function actualForMarket(market, match) {
  const home = match.reversed ? match.awayScore : match.homeScore;
  const away = match.reversed ? match.homeScore : match.awayScore;
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
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

async function evaluatePendingModels(limit = 100) {
  if (!cfg()) return { evaluated: 0, checkedFixtures: 0, reason: 'supabase_not_configured' };
  const cutoff = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  const rows = await supabaseSelect('model_evaluations', {
    select: 'id,fixture_key,fixture_date,market,predicted_value',
    actual_value: 'is.null',
    fixture_date: `lt.${cutoff}`,
    order: 'fixture_date.asc',
    limit: String(Math.max(1, Math.min(Number(limit) || 100, 200)))
  });
  if (!rows.length) return { evaluated: 0, checkedFixtures: 0 };

  const dates = [...new Set(rows.map((row) => isoDate(row.fixture_date)).filter(Boolean))].slice(0, 8);
  const matchesByDate = new Map();
  for (const date of dates) {
    try { matchesByDate.set(date, await footballDataMatches(date)); }
    catch (_) { matchesByDate.set(date, []); }
  }

  let evaluated = 0;
  const seenFixtures = new Set();
  for (const row of rows) {
    const parsed = parseFixtureKey(row.fixture_key);
    const date = isoDate(row.fixture_date);
    if (!parsed || !date || !matchesByDate.has(date)) continue;
    const match = findMatch(matchesByDate.get(date), parsed.home, parsed.away);
    if (!match) continue;
    seenFixtures.add(row.fixture_key);
    const result = actualForMarket(row.market, match);
    if (!result) continue;
    const correct = predictionCorrect(row.market, row.predicted_value, result.actual);
    const ok = await patchEvaluation(row.id, {
      actual_value: `${result.actual} · ${result.score}`,
      is_correct: correct,
      evaluated_at: new Date().toISOString()
    });
    if (ok) evaluated += 1;
  }

  return { evaluated, checkedFixtures: seenFixtures.size };
}

async function performanceSummary() {
  if (!cfg()) return { evaluated: 0, correct: 0, accuracy: null, averageDataQuality: null };
  const rows = await supabaseSelect('model_evaluations', {
    select: 'is_correct,data_quality,market',
    is_correct: 'not.is.null',
    limit: '10000'
  });
  const evaluated = rows.length;
  const correct = rows.filter((row) => row.is_correct === true).length;
  const quality = rows.map((row) => Number(row.data_quality)).filter(Number.isFinite);
  const averageDataQuality = quality.length ? Math.round(quality.reduce((a, b) => a + b, 0) / quality.length) : null;
  const byMarket = {};
  for (const row of rows) {
    const key = row.market || 'UNKNOWN';
    byMarket[key] ||= { evaluated: 0, correct: 0 };
    byMarket[key].evaluated += 1;
    if (row.is_correct === true) byMarket[key].correct += 1;
  }
  for (const value of Object.values(byMarket)) value.accuracy = value.evaluated ? Math.round(value.correct / value.evaluated * 100) : null;
  return { evaluated, correct, accuracy: evaluated ? Math.round(correct / evaluated * 100) : null, averageDataQuality, byMarket };
}

module.exports = { evaluatePendingModels, performanceSummary };
