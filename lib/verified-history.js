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
  const homeForm = basicStats(homeRows, home, 8, cutoff), awayForm = basicStats(awayRows, away, 8, cutoff);
  const fresh = batch => batch.length && Math.min(Date.now(), Date.parse(cutoff)) - Date.parse(batch.at(-1).date) < 90 * 864e5;
  const ok = homeForm.played >= 3 && awayForm.played >= 3 && fresh(homeRows) && fresh(awayRows);
  return { ok: Boolean(ok), source, reason: ok ? null : 'insufficient_recent_history', homeForm, awayForm,
    advanced: { home: advancedStats(rows, home, table, cutoff, 'home'), away: advancedStats(rows, away, table, cutoff, 'away') },
    leagueContext: leagueRows.length >= 30 ? buildLeagueContext(leagueRows) : null,
    h2h: buildH2h(rows, home, away), history: { source, home: homeRows.slice(-12).reverse(), away: awayRows.slice(-12).reverse() } };
}

function historyStrength(form, advanced, history, league) {
  const latest = ['home', 'away'].map(side => Math.max(0, ...(history?.[side] || []).map(row => Date.parse(row.date) || 0)));
  return { sample: Math.min(form?.home?.played || 0, form?.away?.played || 0),
    extended: Math.min(advanced?.home?.sample || 0, advanced?.away?.sample || 0),
    latest: Math.min(...latest), league: Number(league?.sample || 0) >= 30 };
}

function needsMoreHistory(analysis) {
  const current = historyStrength(analysis.form, analysis.advanced, analysis.history, analysis.leagueContext);
  return current.sample < 8 || current.extended < 12 || !current.latest || Date.now() - current.latest > 21 * 864e5;
}

function applyHistory(analysis, context) {
  const current = historyStrength(analysis.form, analysis.advanced, analysis.history, analysis.leagueContext);
  const incoming = historyStrength({home: context.homeForm, away: context.awayForm}, context.advanced, context.history, context.leagueContext);
  // Compare complete provider bundles. Never assemble home/away form from
  // different providers, or replace fresh history with a larger stale sample.
  let reason = context.reason || 'insufficient_recent_history';
  let use = false;
  if (context.ok) {
    const staleCandidate = current.latest && incoming.latest && current.latest - incoming.latest > 7 * 864e5;
    const fresher = incoming.latest && (!current.latest || incoming.latest - current.latest > 7 * 864e5);
    use = current.sample < 3 || (!staleCandidate && (fresher || incoming.sample > current.sample ||
      (incoming.sample === current.sample && (incoming.extended > current.extended ||
        (incoming.extended === current.extended && incoming.league && !current.league)))));
    reason = use ? 'selected' : staleCandidate ? 'older_than_selected_history' : 'selected_history_at_least_as_complete';
  }
  analysis.historySelection = analysis.historySelection || { candidates: [] };
  analysis.historySelection.candidates.push({source: context.source, sample: incoming.sample, extendedSample: incoming.extended,
    latest: incoming.latest ? new Date(incoming.latest).toISOString() : null, reason});
  if (!use) return false;
  analysis.form = { home: context.homeForm, away: context.awayForm };
  analysis.advanced = context.advanced;
  analysis.leagueContext = context.leagueContext;
  analysis.h2h = context.h2h;
  analysis.history = { ...context.history, source: context.source };
  analysis.historySelection.selected = context.source;
  analysis.sourceStatus ||= {};
  analysis.sourceStatus.primaryFootball = context.source;
  analysis.sourceStatus.vertexModelContext = `${context.source} · verified regulation-time results`;
  analysis.contextSources = { ...(analysis.contextSources || {}), form: context.source, advanced: context.source,
    league: context.leagueContext ? context.source : null, h2h: context.h2h?.sample ? context.source : null };
  return true;
}

function refreshScheduleContext(analysis) {
  const kickoff = Date.parse(analysis.fixture?.date);
  // A distant fixture may have intervening games not present in result history.
  // A comparison without a kickoff has no verified pre-match rest interval.
  const usable = Number.isFinite(kickoff) && kickoff > Date.now() && kickoff - Date.now() <= 48 * 36e5;
  for (const side of ['home','away']) {
    const advanced = analysis.advanced?.[side];
    if (!advanced) continue;
    const rows = (analysis.history?.[side] || []).filter(row => Date.parse(row.date) < Math.min(Date.now(), kickoff));
    const latest = Math.max(0, ...rows.map(row => Date.parse(row.date) || 0));
    advanced.restDays = usable && latest ? (kickoff - latest) / 864e5 : null;
    advanced.restReferenceDate = usable ? analysis.fixture.date : null;
    advanced.scheduleVerified = Boolean(usable && latest);
    for (const days of [7,14,30]) advanced[`matches${days}`] = usable ? rows.filter(row => kickoff - Date.parse(row.date) <= days * 864e5).length : 0;
  }
  return analysis;
}

module.exports = { verifiedRows, contextFromHistory, applyHistory, needsMoreHistory, historyStrength, refreshScheduleContext };
