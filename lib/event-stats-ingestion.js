'use strict';

const { boundedFetch: fetch } = require('./analysis-budget');

const { sameTeam } = require('./match-integrity');
const { historicalRows, fetchSeason, num } = require('./football-data-uk');

const BASE = 'https://www.football-data.co.uk/mmz4281';

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

function alias(value) {
  const key = normalize(value);
  const aliases = {
    'athletic': 'ath bilbao',
    'athletic bilbao': 'ath bilbao',
    'athletic bilbao athletic': 'ath bilbao',
    'atletico madrid': 'ath madrid',
    'sociedad': 'sociedad',
    'rayo vallecano': 'vallecano',
    'real betis': 'betis',
    'celta vigo': 'celta',
    'deportivo alaves': 'alaves',
    'espanyol': 'espanol',
    'rcd espanyol': 'espanol'
  };
  return aliases[key] || key;
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
  const headers = parseCsvLine(lines[0]).map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => { row[header] = values[index] ?? ''; });
    return row;
  }).filter((row) => row.HomeTeam && row.AwayTeam);
}

function isoFixtureDate(value) {
  const raw = clean(value);
  if (!raw) return null;
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime()) && /^\d{4}[-/]/.test(raw)) return direct.toISOString();
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function matchId(code, season, row) {
  return [code, season, clean(row.Date), normalize(row.HomeTeam), normalize(row.AwayTeam)].join('|').slice(0, 240);
}

function recentRelevant(rows, homeName, awayName, limit = 12) {
  const homeRows = rows.filter((row) => sameTeam(row.HomeTeam, homeName) || sameTeam(row.AwayTeam, homeName)).slice(-limit);
  const awayRows = rows.filter((row) => sameTeam(row.HomeTeam, awayName) || sameTeam(row.AwayTeam, awayName)).slice(-limit);
  const unique = new Map();
  [...homeRows, ...awayRows].forEach((item) => unique.set(`${item.Date}|${item.HomeTeam}|${item.AwayTeam}`, item));
  return [...unique.values()];
}

function toDatabaseRow(row, { code, season, competition }) {
  return {
    provider: 'Football-Data.co.uk',
    provider_match_id: matchId(code, season, row),
    fixture_date: isoFixtureDate(row.Date),
    competition: competition || code,
    home_team: clean(row.HomeTeam).slice(0, 120),
    away_team: clean(row.AwayTeam).slice(0, 120),
    corners_home: num(row, 'HC'),
    corners_away: num(row, 'AC'),
    yellow_cards_home: num(row, 'HY'),
    yellow_cards_away: num(row, 'AY'),
    red_cards_home: num(row, 'HR'),
    red_cards_away: num(row, 'AR'),
    shots_home: num(row, 'HS'),
    shots_away: num(row, 'AS'),
    shots_on_target_home: num(row, 'HST'),
    shots_on_target_away: num(row, 'AST'),
    offsides_home: num(row, 'HO'),
    offsides_away: num(row, 'AO'),
    fouls_home: num(row, 'HF'),
    fouls_away: num(row, 'AF'),
    penalties_home: null,
    penalties_away: null,
    xg_home: null,
    xg_away: null,
    possession_home: null,
    possession_away: null,
    raw_payload: {
      season,
      division: row.Div || code,
      date: row.Date || null,
      referee: row.Referee || null,
      fullTimeHome: num(row, 'FTHG'),
      fullTimeAway: num(row, 'FTAG')
    },
    collected_at: new Date().toISOString()
  };
}

async function upsertRows(rows) {
  const url = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
  const secret = clean(process.env.SUPABASE_SECRET_KEY);
  if (!url || !secret || !rows.length) return { saved: 0, skipped: true };

  const response = await fetch(`${url}/rest/v1/match_event_stats?on_conflict=provider,provider_match_id`, {
    method: 'POST',
    headers: {
      apikey: secret,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!response.ok) {
    const details = (await response.text().catch(() => '')).slice(0, 300);
    throw new Error(`Supabase event stats ${response.status}: ${details}`);
  }
  return { saved: rows.length, skipped: false };
}

async function ingestFootballDataUkStats({ code, seasons, homeName, awayName, competition }) {
  if (!code || !Array.isArray(seasons) || !seasons.length) return { saved: 0, skipped: true };
  const output = [];
  for (const season of seasons.slice(-2)) {
    try {
      const rows = await fetchSeason(code, season);
      recentRelevant(historicalRows(rows), homeName, awayName, 12).forEach((row) => {
        output.push(toDatabaseRow(row, { code, season, competition }));
      });
    } catch (_) {}
  }
  const unique = new Map(output.map((row) => [`${row.provider}|${row.provider_match_id}`, row]));
  return upsertRows([...unique.values()]);
}

module.exports = { ingestFootballDataUkStats };
