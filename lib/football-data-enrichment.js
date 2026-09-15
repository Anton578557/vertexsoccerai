'use strict';

const BASE = 'https://api.football-data.org/v4';

function clean(value, max = 120) { return String(value || '').replace(/[<>]/g, '').trim().slice(0, max); }
function normalize(value) { return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\b(fc|cf|afc|sc|club|de|the|ud|cd)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function sameTeam(a, b) {
  const x = normalize(a); const y = normalize(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const xs = new Set(x.split(' ')); const ys = new Set(y.split(' '));
  const common = [...xs].filter((t) => ys.has(t)).length;
  return common / Math.max(xs.size, ys.size, 1) >= 0.5;
}
function isoDate(date) { return new Date(date).toISOString().slice(0, 10); }

function competitionCode(league) {
  const text = normalize(league);
  const rules = [
    [/premier league|english premier/, 'PL'], [/la liga|spanish la liga|primera division/, 'PD'],
    [/bundesliga/, 'BL1'], [/serie a/, 'SA'], [/ligue 1/, 'FL1'], [/eredivisie/, 'DED'],
    [/primeira liga|liga portugal/, 'PPL'], [/championship/, 'ELC'], [/champions league/, 'CL'],
    [/brasileirao|brazilian serie a/, 'BSA']
  ];
  return rules.find(([re]) => re.test(text))?.[1] || null;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY, 'User-Agent': 'VertexSoccerAI/3.0' }
    });
    if (!response.ok) {
      const error = new Error(`Football-Data ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  } finally { clearTimeout(timer); }
}

function mapMatch(match) {
  return {
    id: String(match.id || ''), date: match.utcDate || null, status: match.status || null,
    league: match.competition?.name || null, home: match.homeTeam?.name || '', away: match.awayTeam?.name || '',
    homeScore: Number.isFinite(match.score?.fullTime?.home) ? match.score.fullTime.home : null,
    awayScore: Number.isFinite(match.score?.fullTime?.away) ? match.score.fullTime.away : null,
    source: 'Football-Data'
  };
}

function completedFor(events, team, limit = 8) {
  return events.filter((m) => (sameTeam(m.home, team) || sameTeam(m.away, team)) && Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, limit);
}

function stats(events, team) {
  let gf = 0, ga = 0, wins = 0, draws = 0, losses = 0; const sequence = [];
  for (const m of events) {
    const isHome = sameTeam(m.home, team); const scored = isHome ? m.homeScore : m.awayScore; const conceded = isHome ? m.awayScore : m.homeScore;
    if (!Number.isFinite(scored) || !Number.isFinite(conceded)) continue;
    gf += scored; ga += conceded;
    if (scored > conceded) { wins++; sequence.push('W'); } else if (scored === conceded) { draws++; sequence.push('D'); } else { losses++; sequence.push('L'); }
  }
  const played = wins + draws + losses;
  return { played, wins, draws, losses, sequence, avgFor: played ? gf / played : null, avgAgainst: played ? ga / played : null, ppg: played ? (wins * 3 + draws) / played : null };
}

async function enrichFootballData(homeName, awayName, leagueName) {
  if (!process.env.FOOTBALL_DATA_KEY) return { ok: false, reason: 'not_configured' };
  const code = competitionCode(leagueName);
  if (!code) return { ok: false, reason: 'competition_unknown' };
  try {
    const now = new Date(); const from = new Date(now); const to = new Date(now);
    from.setDate(from.getDate() - 180); to.setDate(to.getDate() + 45);
    const data = await fetchJson(`${BASE}/competitions/${code}/matches?dateFrom=${isoDate(from)}&dateTo=${isoDate(to)}`);
    const all = (data.matches || []).map(mapMatch);
    const relevant = all.filter((m) => sameTeam(m.home, homeName) || sameTeam(m.away, homeName) || sameTeam(m.home, awayName) || sameTeam(m.away, awayName));
    const homeEvents = completedFor(relevant, homeName, 8); const awayEvents = completedFor(relevant, awayName, 8);
    const fixture = relevant.filter((m) => {
      const exact = (sameTeam(m.home, homeName) && sameTeam(m.away, awayName)) || (sameTeam(m.home, awayName) && sameTeam(m.away, homeName));
      return exact && new Date(m.date || 0).getTime() >= Date.now() - 6 * 3600 * 1000;
    }).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))[0] || null;
    return { ok: true, code, homeEvents, awayEvents, homeForm: stats(homeEvents, homeName), awayForm: stats(awayEvents, awayName), fixture };
  } catch (error) {
    return { ok: false, reason: `http_${error.status || 'error'}`, code };
  }
}

module.exports = { enrichFootballData };
