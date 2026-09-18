 'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveTeamName } = require('../lib/team-aliases');
const { chooseTeamCandidate, formStats } = require('../lib/base-analysis-v2');
const { sameTeam } = require('../lib/football-data-enrichment');
const { weatherContext } = require('../lib/analysis-enhancer');

test('Bavaria resolves to Bayern while Bavarian United retains its identity', () => {
  for (const name of ['Bavaria', 'Бавария', 'FC Bayern München', 'Bayern']) assert.equal(resolveTeamName(name), 'Bayern Munich');
  assert.equal(resolveTeamName('Bavarian United'), 'Bavarian United');
  const wrong = { idTeam: 'wrong', strTeam: 'Bavarian United', strLeague: 'US League' };
  const right = { idTeam: 'right', strTeam: 'FC Bayern München', strLeague: 'Bundesliga' };
  assert.equal(chooseTeamCandidate([wrong, right], 'Bavaria'), right);
  assert.equal(chooseTeamCandidate([wrong], 'Bavaria'), null);
});
test('uncertain search results do not become an arbitrary team', () => {
  assert.equal(chooseTeamCandidate([{strTeam: 'Unrelated FC', strStadium: 'Stadium'}], 'Unknown'), null);
  assert.equal(chooseTeamCandidate([{strTeam: 'Arsenal U21'}], 'Arsenal'), null);
  assert.equal(chooseTeamCandidate([{strTeam: 'Arsenal Women'}], 'Arsenal'), null);
});
test('football-data joins distinguish clubs sharing a city', () => {
  assert.equal(sameTeam('Manchester United FC', 'Manchester City'), false);
  assert.equal(sameTeam('FC Bayern München', 'Bavaria'), true);
  assert.equal(sameTeam('1. FC Union Berlin', 'Унион Берлин'), true);
});
test('recent form excludes future and unfinished games', () => {
  const past = new Date(Date.now() - 86400000).toISOString();
  const future = new Date(Date.now() + 86400000).toISOString();
  const rows = [
    { date: past, status: 'Match Finished', home: 'Arsenal', away: 'Chelsea', homeScore: 2, awayScore: 1 },
    { date: future, home: 'Arsenal', away: 'Chelsea', homeScore: 0, awayScore: 0 },
    { date: past, status: '1H', home: 'Arsenal', away: 'Chelsea', homeScore: 0, awayScore: 0 }
  ];
  assert.equal(formStats(rows, 'Arsenal').played, 1);
});
test('missing temperature does not become freezing weather', () => {
  const result = weatherContext({tempC: null, windMs: null, humidity: null}, new Date().toISOString());
  assert.equal(result.applied, false);
  assert.equal(result.adjustment, 0);
});
