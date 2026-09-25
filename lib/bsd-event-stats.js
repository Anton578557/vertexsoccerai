'use strict';

const { configuration, resolveTeam, teamHistory, requestMatchStats } = require('./bsd-history');
const { buildGranularFromRows } = require('./football-data-uk');
const { cachedProviderCall } = require('./provider-cache');
const { sameTeam } = require('./match-integrity');
const FIELDS = { HC:'corner_kicks', AC:'corner_kicks', HY:'yellow_cards', AY:'yellow_cards', HR:'red_cards', AR:'red_cards' };

function validCount(value, key) {
  const max = /R$/.test(key) ? 11 : /Y$/.test(key) ? 30 : 50;
  // BSD explicitly distinguishes missing null from observed 0. No coercion.
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : null;
}

function statsRow(event, payload) {
  const id = Number(String(event.id || '').replace(/^bsd:/, ''));
  if (!event.regulationVerified || event.eventStatsRegulation !== true || Number(payload?.event_id) !== id) return null;
  const day = new Date(event.date);
  if (!Number.isFinite(day.getTime())) return null;
  const row = { Date: `${String(day.getUTCDate()).padStart(2,'0')}/${String(day.getUTCMonth()+1).padStart(2,'0')}/${day.getUTCFullYear()}`,
    HomeTeam: event.home, AwayTeam: event.away, FTHG: event.homeScore, FTAG: event.awayScore };
  for (const [key, field] of Object.entries(FIELDS)) row[key] = validCount(payload?.stats?.[key[0] === 'H' ? 'home' : 'away']?.[field], key);
  return row;
}

function eligibleEvents(events, cutoff) {
  const end = Math.min(Date.now(), Date.parse(cutoff));
  const startOfDay = Math.floor(end / 864e5) * 864e5;
  return events.filter(event => /^bsd:\d+$/.test(event.id || '') && event.regulationVerified && event.eventStatsRegulation === true &&
    Date.parse(event.date) < startOfDay && Date.parse(event.date) >= end - 90 * 864e5)
    .sort((a,b) => Date.parse(b.date)-Date.parse(a.date)).slice(0,12);
}

async function loadModel(analysis, cutoff) {
  const teams = await Promise.all(['home','away'].map(async side => {
    const team = analysis.teams[side];
    return Number.isSafeInteger(team.bsdId) && team.bsdId > 0 ? { ...team, id:team.bsdId, canonicalName:team.name } : resolveTeam(team);
  }));
  if (teams.some(team => !team) || teams[0].id === teams[1].id) return {ok:false, source:'BSD', reason:'teams_unavailable'};
  const histories = await Promise.all(teams.map(team => teamHistory(team, teams, cutoff)));
  const chosen = histories.map(events => eligibleEvents(events, cutoff));
  // Interleave sides so a slow provider cannot spend the whole budget on home.
  const queue = [], seen = new Set();
  for (let i=0;i<12;i++) for (const side of chosen) if (side[i] && !seen.has(side[i].id)) { seen.add(side[i].id); queue.push(side[i]); }
  const started = Date.now();
  const rows = [], errors = [];
  let cursor = 0, stopped = false;
  await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{
    while (cursor < queue.length && !stopped && Date.now()-started < 12000) {
      const event = queue[cursor++];
      try {
        const row = statsRow(event, await requestMatchStats(Number(event.id.slice(4))));
        if (row) rows.push(row);
      } catch (error) {
        errors.push(error.message);
        if (['quota_exhausted','access_denied'].includes(error.message)) stopped = true;
      }
    }
  }));
  const model = buildGranularFromRows(rows, analysis.teams.home.name, analysis.teams.away.name, {source:'BSD',fixtureDate:cutoff});
  const counts = ['home','away'].map(side => rows.filter(row => sameTeam(row.HomeTeam,analysis.teams[side].name) || sameTeam(row.AwayTeam,analysis.teams[side].name)).length);
  model.collection = {requested:cursor,available:rows.length,homeMatches:counts[0],awayMatches:counts[1],complete:cursor===queue.length,
    reason:errors.includes('quota_exhausted')?'quota_exhausted':errors.includes('access_denied')?'access_denied':errors.length?'some_stats_unavailable':cursor<queue.length?'time_budget':null};
  if (!model.ok) model.reason = model.collection.reason || 'Insufficient verified corner and card statistics.';
  return model;
}

async function buildBsdEventModel(analysis) {
  if (!configuration().enabled || !configuration().configured) return {ok:false,source:'BSD',reason:'not_configured'};
  const cutoff = analysis.fixture?.date || new Date().toISOString();
  const identity = side => `${analysis.teams[side].bsdId || ''}:${analysis.teams[side].name}:${analysis.teams[side].country || ''}`;
  try {
    const { payload } = await cachedProviderCall({cacheKey:`bsd-event-model:v1:${identity('home')}:${identity('away')}:${String(cutoff).slice(0,10)}`,
      provider:'BSD Event Statistics',ttlSeconds:300,staleSeconds:600,loader:()=>loadModel(analysis,cutoff)});
    return payload;
  } catch (error) { return {ok:false,source:'BSD',reason:error.message || 'temporarily_unavailable'}; }
}

// Keep each market's entire two-team sample together, with its own provenance.
function mergeEventModels(primary, fallback) {
  if (!fallback?.ok) return primary;
  if (!primary?.ok) return fallback;
  const merged = {...primary,coverage:{...primary.coverage},yellowHistory:{...primary.yellowHistory},eventSamples:{...primary.eventSamples}};
  const used = new Set([primary.source]);
  for (const key of ['corners','cards','redCards','shots','shotsOnTarget','offsides','fouls']) {
    const old = primary[key], next = fallback[key];
    const newestRed = value => Math.min(...['home','away'].map(side=>Date.parse(value?.[side]?.through)||0));
    const select = next && (!old || (key === 'redCards' && newestRed(next) > newestRed(old)));
    const value = select ? next : old;
    if (value) merged[key] = {...value, source:select?fallback.source:primary.source};
    if (select) { merged.coverage[key] = true; merged.eventSamples[key] = fallback.eventSamples?.[key]; used.add(fallback.source); }
    if (key === 'cards' && select) merged.yellowHistory = fallback.yellowHistory;
  }
  for (const side of ['home','away']) if (!merged.yellowHistory?.[side] && fallback.yellowHistory?.[side]) {
    merged.yellowHistory[side] = {...fallback.yellowHistory[side],source:fallback.source}; used.add(fallback.source);
  }
  merged.source = [...used].join(' + ');
  merged.forecastsAvailable = ['corners','cards','shots','shotsOnTarget','offsides','fouls'].some(key=>Boolean(merged[key]));
  merged.collection = fallback.collection;
  return merged;
}

module.exports = { buildBsdEventModel, statsRow, eligibleEvents, mergeEventModels };
