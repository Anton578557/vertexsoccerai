'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { competitionCode, seasonYears, normalizeMatches, enrichOpenLigaDb } = require('../lib/openligadb-history');

function event(overrides = {}) {
  return { matchID: 123, leagueShortcut: 'bl1', matchIsFinished: true, matchDateTimeUTC: '2026-09-19T13:30:00Z',
    team1: {teamName: 'FC Bayern München'}, team2: {teamName: 'Borussia Dortmund'},
    matchResults: [{resultTypeID: 1, pointsTeam1: 0, pointsTeam2: 1}, {resultTypeID: 2, pointsTeam1: 2, pointsTeam2: 1}], ...overrides };
}

test('OpenLigaDB only maps official German regular leagues and correct season boundaries', () => {
  assert.equal(competitionCode('German Bundesliga', 'Germany'), 'bl1');
  assert.equal(competitionCode('German 2. Bundesliga', 'Germany'), 'bl2');
  assert.equal(competitionCode('3. Liga', 'Germany'), 'bl3');
  assert.equal(competitionCode('Germany Liga 3', 'Germany'), 'bl3');
  assert.equal(competitionCode('German 3. Liga', 'Germany'), 'bl3');
  assert.equal(competitionCode('Bundesliga', 'Austria'), null);
  assert.equal(competitionCode('DFB Pokal', 'Germany'), null);
  assert.deepEqual(seasonYears(new Date('2026-09-23')), [2026, 2025]);
  assert.deepEqual(seasonYears(new Date('2026-02-23')), [2025, 2024]);
});

test('OpenLigaDB takes explicit final results, never half-time, live, missing, ambiguous or local-time scores', () => {
  const rows = [event(), event({matchIsFinished: false}), event({matchDateTimeUTC: null}), event({matchDateTimeUTC: '2026-09-19T13:30:00'}),
    event({matchDateTimeUTC: '2026-09-24T13:30:00Z'}), event({leagueShortcut: 'dfb'}),
    event({matchResults: [{resultTypeID: 1, pointsTeam1: 1, pointsTeam2: 0}]}),
    event({matchResults: [{resultTypeID: 2, pointsTeam1: '2', pointsTeam2: 1}]}),
    event({matchResults: [event().matchResults[1], event().matchResults[1]]})];
  const result = normalizeMatches(rows, 'bl1', [{name:'Bayern Munich'},{name:'Borussia Dortmund'}], new Date('2026-09-23'));
  assert.equal(result.length, 1); assert.equal(result[0].home, 'Bayern Munich'); assert.equal(result[0].homeScore, 2);
  assert.deepEqual(normalizeMatches([event()], 'dfb'), []);
});

test('OpenLigaDB enriches through the actual cached adapter and refuses uncovered leagues without fetching', async () => {
  const original = global.fetch;
  const urls = [];
  global.fetch = async url => { urls.push(String(url)); return {ok: true, json: async () => Array.from({length: 6}, (_,i) => event({matchID: i + 1, matchDateTimeUTC: new Date(Date.now() - (i + 1) * 864e5).toISOString()}))}; };
  const analysis = () => ({teams:{home:{name:'Bayern Munich',country:'Germany'},away:{name:'Borussia Dortmund',country:'Germany'}},fixture:{league:'German Bundesliga'},form:{home:{played:0},away:{played:0}},sourceStatus:{}});
  try {
    const result = await enrichOpenLigaDb(analysis());
    assert.equal(result.form.home.played, 6); assert.equal(result.form.away.played, 6);
    assert.equal(result.history.source, 'OpenLigaDB'); assert.equal(result.leagueContext, null);
    assert.equal(urls.length, 2); assert.ok(urls.every(url => url.startsWith('https://api.openligadb.de/getmatchdata/bl1/')));
    const uncovered = analysis(); uncovered.fixture.league = 'DFB Pokal';
    await enrichOpenLigaDb(uncovered); assert.equal(uncovered.form.home.played, 0); assert.equal(urls.length, 2);
  } finally {global.fetch = original;}
});
