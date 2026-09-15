'use strict';

const { clean } = require('./football');

function normalizeName(value) {
  return clean(value, 120)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|afc|sc|club|de|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameScore(a, b) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.92;
  const xs = new Set(x.split(' '));
  const ys = new Set(y.split(' '));
  const common = [...xs].filter((v) => ys.has(v)).length;
  return common / Math.max(xs.size, ys.size, 1);
}

function rapidHost() {
  const host = String(process.env.RAPIDAPI_HOST || '').trim().toLowerCase();
  if (!host || !/^[a-z0-9.-]+\.p\.rapidapi\.com$/.test(host)) return null;
  return host;
}

function configured() {
  return Boolean(process.env.RAPIDAPI_KEY && rapidHost());
}

async function rapidGet(path, params = {}, timeoutMs = 9000) {
  if (!configured()) return null;
  const host = rapidHost();
  const url = new URL(`https://${host}/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VertexSoccerAI/2.0',
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
        'x-rapidapi-host': host
      }
    });
    if (!response.ok) {
      const error = new Error(`RapidAPI ${response.status}`);
      error.status = response.status;
      error.details = (await response.text().catch(() => '')).slice(0, 240);
      throw error;
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

function pickArray(root) {
  if (Array.isArray(root)) return root;
  if (!root || typeof root !== 'object') return [];
  const candidates = [
    root?.response?.matches,
    root?.response?.fixtures,
    root?.response?.data,
    root?.response,
    root?.matches,
    root?.fixtures,
    root?.data
  ];
  return candidates.find(Array.isArray) || [];
}

function extractTeamName(item, side) {
  const direct = item?.[side]?.name || item?.[`${side}Team`]?.name || item?.teams?.[side]?.name;
  if (direct) return String(direct);
  const text = item?.[side] || item?.[`${side}Team`] || item?.[side === 'home' ? 'HomeTeam' : 'AwayTeam'];
  return typeof text === 'string' ? text : '';
}

function extractEventId(item) {
  return item?.id ?? item?.eventId ?? item?.eventid ?? item?.matchId ?? item?.fixture?.id ?? null;
}

function formatDate(date) {
  const d = new Date(date || Date.now());
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function matchesByDate(date) {
  const formatted = formatDate(date);
  if (!formatted) return [];
  const data = await rapidGet('football-get-matches-by-date', { date: formatted });
  return pickArray(data);
}

async function resolveRapidApiFixture(homeName, awayName, fixtureDate) {
  if (!configured() || !homeName || !awayName || !fixtureDate) return null;
  const date = new Date(fixtureDate);
  if (Number.isNaN(date.getTime())) return null;

  // Check UTC match date and adjacent dates because provider/local timezone
  // boundaries can move evening fixtures across midnight.
  const dates = [-1, 0, 1].map((delta) => {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + delta);
    return d;
  });

  let best = null;
  for (const d of dates) {
    let items = [];
    try { items = await matchesByDate(d); } catch (_) { continue; }
    for (const item of items) {
      const home = extractTeamName(item, 'home');
      const away = extractTeamName(item, 'away');
      const forward = nameScore(home, homeName) + nameScore(away, awayName);
      const reverse = nameScore(home, awayName) + nameScore(away, homeName);
      const score = Math.max(forward, reverse);
      const id = extractEventId(item);
      if (id == null || score < 1.35) continue;
      if (!best || score > best.score) {
        best = {
          eventId: String(id),
          home,
          away,
          score,
          rawDate: item?.date || item?.startTime || item?.utcTime || item?.fixture?.date || null,
          leagueId: item?.league?.id || item?.leagueId || item?.parentLeague?.id || null
        };
      }
    }
  }
  return best;
}

function numberFromStat(value) {
  if (value == null) return null;
  const cleanValue = String(value).split('(')[0].replace('%', '').trim();
  const parsed = Number(cleanValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function canonicalStatKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const STAT_ALIASES = Object.freeze({
  expected_goals: ['expected_goals', 'xg'],
  expected_goals_on_target: ['expected_goals_on_target', 'xgot'],
  total_shots: ['total_shots', 'shots', 'shot_total'],
  shots_on_target: ['shotsontarget', 'shots_on_target', 'shot_on_target'],
  shots_off_target: ['shots_off_target', 'shots_off_goal'],
  blocked_shots: ['blocked_shots'],
  shots_inside_box: ['shots_inside_box'],
  shots_outside_box: ['shots_outside_box'],
  big_chances: ['big_chance', 'big_chances'],
  touches_opposition_box: ['touches_opp_box', 'touches_opposition_box'],
  corners: ['corners', 'corner_kicks'],
  yellow_cards: ['yellow_cards', 'yellow_card'],
  red_cards: ['red_cards', 'red_card'],
  offsides: ['offsides', 'offside'],
  fouls: ['fouls', 'fouls_committed'],
  possession: ['ballpossesion', 'ball_possession', 'possession'],
  penalties: ['penalties', 'penalty', 'penalties_awarded'],
  keeper_saves: ['keeper_saves', 'saves']
});

function normalizeStatsPayload(data) {
  const groups = data?.response?.stats;
  if (!Array.isArray(groups)) return null;
  const flat = new Map();

  for (const group of groups) {
    for (const stat of Array.isArray(group?.stats) ? group.stats : []) {
      const key = canonicalStatKey(stat?.key || stat?.title || stat?.name);
      const values = stat?.stats || stat?.values || stat?.value;
      if (!key || !Array.isArray(values) || values.length < 2 || flat.has(key)) continue;
      flat.set(key, [numberFromStat(values[0]), numberFromStat(values[1])]);
    }
  }

  const out = {};
  for (const [target, aliases] of Object.entries(STAT_ALIASES)) {
    const hit = aliases.map(canonicalStatKey).find((alias) => flat.has(alias));
    if (!hit) continue;
    const values = flat.get(hit);
    if (values && (values[0] != null || values[1] != null)) out[target] = { home: values[0], away: values[1] };
  }

  return Object.keys(out).length ? out : null;
}

async function fetchRapidApiMatchStats(eventId) {
  if (!configured() || !eventId) return null;
  const data = await rapidGet('football-get-match-all-stats', { eventid: eventId });
  if (data?.status && String(data.status).toLowerCase() !== 'success') return null;
  const stats = normalizeStatsPayload(data);
  return stats ? { source: 'RapidAPI', eventId: String(eventId), stats } : null;
}

async function getFixtureStats(homeName, awayName, fixtureDate) {
  const fixture = await resolveRapidApiFixture(homeName, awayName, fixtureDate);
  if (!fixture) return null;
  const detailed = await fetchRapidApiMatchStats(fixture.eventId);
  return detailed ? { ...detailed, fixture } : null;
}

module.exports = {
  configured,
  matchesByDate,
  resolveRapidApiFixture,
  fetchRapidApiMatchStats,
  getFixtureStats,
  normalizeStatsPayload
};
