'use strict';

const { sameTeam } = require('./match-integrity');
const { basicStats, advancedStats, leagueTable, buildLeagueContext, buildH2h } = require('./football-data-enrichment');

function verifiedRows(events, cutoff = new Date()) {
  const end = Math.min(Date.now(), new Date(cutoff).getTime());
  const unique = new Map();
  const conflicts = new Set();
  for (const event of events || []) {
    const time = Date.parse(event.date);
    if (!event.regulationVerified || !Number.isFinite(time) || time >= end || time < end - 365 * 864e5 || !event.home || !event.away || sameTeam(event.home, event.away)) continue;
    if (![event.homeScore, event.awayScore].every(x => Number.isInteger(x) && x >= 0 && x <= 30)) continue;
    const key = event.id || `${event.date}:${event.home}:${event.away}`;
    const previous = unique.get(key);
    if (previous && (previous.homeScore !== event.homeScore || previous.awayScore !== event.awayScore)) conflicts.add(key);
    unique.set(key, event);
  }
  return [...unique].filter(([key]) => !conflicts.has(key)).map(([, event]) => event).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

function contextFromHistory(events, home, away, { source, cutoff = new Date(), leagueEvents = [] } = {}) {
  const rows = verifiedRows(events, cutoff);
  const leagueRows = verifiedRows(leagueEvents, cutoff);
  // A pair of team schedules is not a representative league baseline.
  const table = leagueRows.length >= 30 ? leagueTable(leagueRows) : new Map();
  const homeRows = rows.filter(m => sameTeam(m.home, home) || sameTeam(m.away, home));
  const awayRows = rows.filter(m => sameTeam(m.home, away) || sameTeam(m.away, away));
  const homeForm = basicStats(homeRows, home), awayForm = basicStats(awayRows, away);
  const fresh = batch => batch.length && Math.min(Date.now(), Date.parse(cutoff)) - Date.parse(batch.at(-1).date) < 90 * 864e5;
  const ok = homeForm.played >= 3 && awayForm.played >= 3 && fresh(homeRows) && fresh(awayRows);
  return { ok: Boolean(ok), source, reason: ok ? null : 'insufficient_recent_history', homeForm, awayForm,
    advanced: { home: advancedStats(rows, home, table, cutoff, 'home'), away: advancedStats(rows, away, table, cutoff, 'away') },
    leagueContext: leagueRows.length >= 30 ? buildLeagueContext(leagueRows) : null,
    h2h: buildH2h(rows, home, away), history: { source, home: homeRows.slice(-12).reverse(), away: awayRows.slice(-12).reverse() } };
}

function applyHistory(analysis, context) {
  const current = Math.min(analysis.form?.home?.played || 0, analysis.form?.away?.played || 0);
  const incoming = Math.min(context.homeForm?.played || 0, context.awayForm?.played || 0);
  if (!context.ok || incoming < current) return false;
  analysis.form = { home: context.homeForm, away: context.awayForm };
  analysis.advanced = context.advanced;
  analysis.leagueContext = context.leagueContext;
  analysis.h2h = context.h2h;
  analysis.history = context.history;
  analysis.sourceStatus.primaryFootball = context.source;
  analysis.sourceStatus.vertexModelContext = `${context.source} · verified regulation-time results`;
  return true;
}

module.exports = { verifiedRows, contextFromHistory, applyHistory };
