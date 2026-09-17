'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { competitionCode, buildPenaltyContext } = require('../lib/football-data-enrichment');

test('maps UEFA competitions to football-data competition codes', () => {
  assert.equal(competitionCode('UEFA Champions League'), 'CL');
  assert.equal(competitionCode('Champions League'), 'CL');
  assert.equal(competitionCode('UEFA Europa League'), 'EL');
  assert.equal(competitionCode('Europa League'), 'EL');
  assert.equal(competitionCode('UEFA Conference League'), 'UCL');
});

function completedMatch(id, home, away) {
  return { id: String(id), home, away, homeScore: 1, awayScore: 0, date: `2026-0${(id % 8) + 1}-01T12:00:00Z` };
}

test('builds a conservative penalty proxy only with a verified sample', () => {
  const completed = [];
  for (let i = 0; i < 8; i += 1) completed.push(completedMatch(i + 1, 'Home FC', `Opponent ${i}`));
  for (let i = 0; i < 8; i += 1) completed.push(completedMatch(i + 20, `Other ${i}`, 'Away FC'));
  completed.push(completedMatch(50, 'Third A', 'Third B'));
  completed.push(completedMatch(51, 'Third C', 'Third D'));

  const scorers = [
    { team: { name: 'Home FC' }, player: { name: 'Home Striker' }, penalties: 3 },
    { team: { name: 'Away FC' }, player: { name: 'Away Striker' }, penalties: 1 },
    { team: { name: 'Third A' }, player: { name: 'Other' }, penalties: 2 }
  ];

  const result = buildPenaltyContext(scorers, completed, 'Home FC', 'Away FC');
  assert.equal(result.ok, true);
  assert.ok(result.probabilityPct > 0 && result.probabilityPct < 100);
  assert.ok(result.homeProbabilityPct > result.awayProbabilityPct);
  assert.equal(result.observed.homePenaltyGoals, 3);
  assert.match(result.limitation, /missed penalties/i);
});

test('withholds penalty probability when the verified sample is too small', () => {
  const result = buildPenaltyContext(
    [{ team: { name: 'Home FC' }, player: { name: 'A' }, penalties: 1 }],
    [completedMatch(1, 'Home FC', 'Away FC')],
    'Home FC',
    'Away FC'
  );
  assert.equal(result.ok, false);
});
