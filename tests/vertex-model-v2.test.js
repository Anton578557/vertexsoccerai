'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVertexModelV2 } = require('../lib/vertex-model-v2');
const { buildAvailabilityFromNews, parseDurationDays } = require('../lib/squad-availability');

function baseAnalysis() {
  return {
    teams: {
      home: { name: 'Home FC', badge: 'home.png', country: 'England' },
      away: { name: 'Away FC', badge: 'away.png', country: 'England' }
    },
    fixture: { date: new Date(Date.now() + 48 * 3600e3).toISOString(), league: 'Premier League' },
    form: {
      home: { played: 8, avgFor: 1.9, avgAgainst: 0.9, ppg: 2.15 },
      away: { played: 8, avgFor: 1.1, avgAgainst: 1.65, ppg: 1.0 }
    },
    advanced: {
      home: { sample: 12, sampleReliability: 1, weightedAvgFor: 2.0, weightedAvgAgainst: 0.95, weightedPpg: 2.2, opponentStrength: 1.55, restDays: 6, matches7: 1, venue: { matches: 6, avgFor: 2.2, avgAgainst: 0.8, ppg: 2.5 } },
      away: { sample: 12, sampleReliability: 1, weightedAvgFor: 1.05, weightedAvgAgainst: 1.7, weightedPpg: 0.95, opponentStrength: 1.3, restDays: 4, matches7: 2, venue: { matches: 6, avgFor: 0.9, avgAgainst: 1.8, ppg: 0.8 } }
    },
    leagueContext: { sample: 120, homeGoals: 1.55, awayGoals: 1.2, teamGoalAvg: 1.375 },
    h2h: { sample: 3, homePpg: 2.1, awayPpg: 0.7 },
    sourceStatus: { news: 'NewsAPI · summarized' },
    newsImpact: { homePct: 0, awayPct: 0 },
    weatherImpact: { goalEnvironmentPct: 0, reasons: [] },
    weather: { tempC: 18 },
    granularModel: {
      ok: true,
      source: 'Football-Data.co.uk',
      shotsOnTarget: { expectedHome: 6.2, expectedAway: 3.4 }
    },
    marketCoverage: {}
  };
}

test('stronger home profile produces a higher home-win probability', () => {
  const result = buildVertexModelV2(baseAnalysis());
  assert.ok(result.model);
  assert.ok(result.model.oneXtwo.home > result.model.oneXtwo.away);
  const sum = result.model.oneXtwo.home + result.model.oneXtwo.draw + result.model.oneXtwo.away;
  assert.ok(sum >= 99 && sum <= 101);
  assert.equal(result.meta.version, 'Vertex Model 2.1');
  assert.ok(result.dataQuality >= 70);
});

test('negative home news lowers home expected goals', () => {
  const neutral = buildVertexModelV2(baseAnalysis());
  const impactedInput = baseAnalysis();
  impactedInput.newsImpact.homePct = -8;
  const impacted = buildVertexModelV2(impactedInput);
  assert.ok(impacted.model.expectedGoals.home < neutral.model.expectedGoals.home);
});

test('severe weather lowers the total goal environment', () => {
  const neutral = buildVertexModelV2(baseAnalysis());
  const badWeather = baseAnalysis();
  badWeather.weatherImpact = { goalEnvironmentPct: -8, reasons: ['strong wind', 'heavy rain'] };
  const impacted = buildVertexModelV2(badWeather);
  assert.ok(impacted.model.expectedGoals.total < neutral.model.expectedGoals.total);
});

test('insufficient samples are withheld rather than invented', () => {
  const input = baseAnalysis();
  input.form.home.played = 2;
  const result = buildVertexModelV2(input);
  assert.equal(result.model, null);
  assert.equal(result.meta.decision.action, 'PASS');
});

test('structured squad coverage is not falsely claimed', () => {
  const result = buildVertexModelV2(baseAnalysis());
  assert.equal(result.meta.coverage.structuredInjuriesAndLineups, false);
});

test('duration parser understands multi-week absences', () => {
  assert.equal(parseDurationDays('The striker is ruled out for three weeks with a hamstring injury.'), 21);
});

test('confirmed top-scorer absence still affects a forecast one week ahead', () => {
  const fixtureDate = new Date(Date.now() + 7 * 864e5).toISOString();
  const result = buildAvailabilityFromNews({
    homeName: 'Home FC',
    awayName: 'Away FC',
    fixtureDate,
    news: [{
      title: 'Home FC striker Alex Star ruled out for three weeks',
      summary: 'Home FC leading scorer Alex Star will miss the next matches with a hamstring injury.',
      source: 'Club News',
      publishedAt: new Date(Date.now() - 12 * 3600e3).toISOString(),
      teams: ['home']
    }],
    scorers: [
      { name: 'Alex Star', team: 'Home FC', goals: 12 },
      { name: 'Other Forward', team: 'Home FC', goals: 5 }
    ]
  });
  assert.equal(result.usedSignals, 1);
  assert.ok(result.home.incrementalAttackPct <= -5);
  assert.equal(result.home.signals[0].rank, 1);
});

test('an absence that expires before kickoff is not applied', () => {
  const fixtureDate = new Date(Date.now() + 7 * 864e5).toISOString();
  const result = buildAvailabilityFromNews({
    homeName: 'Home FC',
    awayName: 'Away FC',
    fixtureDate,
    news: [{
      title: 'Home FC striker Alex Star out for two days',
      summary: 'Alex Star is sidelined for two days with a minor knock.',
      source: 'Club News',
      publishedAt: new Date(Date.now() - 24 * 3600e3).toISOString(),
      teams: ['home']
    }],
    scorers: [{ name: 'Alex Star', team: 'Home FC', goals: 12 }]
  });
  assert.equal(result.usedSignals, 0);
  assert.equal(result.home.incrementalAttackPct, 0);
});


test('missing recovery values do not create an artificial fatigue penalty', () => {
  const unknown = baseAnalysis();
  unknown.advanced.home.restDays = null;
  unknown.advanced.away.restDays = null;
  const absent = structuredClone(unknown);
  delete absent.advanced.home.restDays;
  delete absent.advanced.away.restDays;
  assert.deepEqual(buildVertexModelV2(unknown).model, buildVertexModelV2(absent).model);
  assert.equal(buildVertexModelV2(unknown).meta.drivers.some((d) => /fatigue/.test(d.key)), false);
  const shortRest = structuredClone(unknown);
  shortRest.advanced.home.restDays = 0;
  assert.ok(buildVertexModelV2(shortRest).model.expectedGoals.home < buildVertexModelV2(unknown).model.expectedGoals.home);
});

test('unknown, blank, negative or nonnumeric goal rates withhold a forecast', () => {
  for (const value of [null, undefined, '', ' ', -1, 'unknown', false, NaN]) {
    const input = baseAnalysis();
    input.form.away.avgAgainst = value;
    assert.equal(buildVertexModelV2(input).model, null, String(value));
  }
  const zero = baseAnalysis();
  zero.form.away.avgAgainst = 0;
  assert.ok(buildVertexModelV2(zero).model);
});

test('all goal lines are complementary, monotone and agree with existing markets', () => {
  const { model: m } = buildVertexModelV2(baseAnalysis());
  for (const rows of [m.goalLines, m.teamGoalLines.home, m.teamGoalLines.away]) {
    for (let i = 0; i < rows.length; i++) {
      assert.equal(rows[i].over + rows[i].under, 100);
      if (i) assert.ok(rows[i].over <= rows[i-1].over);
    }
  }
  assert.equal(m.goalLines.find((r) => r.line === 2.5).over, m.over25);
  assert.equal(m.teamGoalLines.home[0].over, m.extended.homeToScore);
  assert.equal(m.teamGoalLines.home[0].under, m.extended.awayCleanSheet);
  assert.equal(m.scoreScenarios.length, 5);
  assert.equal(m.scoreScenarios[0].score, m.correctScore);
  assert.ok(m.scoreScenarios.reduce((sum, row) => sum + row.probability, 0) < 100);
});

test('Poisson distribution matches analytic totals over the full supported lambda range', () => {
  const { scoreDistribution, probabilitiesFromDistribution } = require('../lib/vertex-model-v2');
  for (const home of [.25, .7, 1.3, 2.1, 3.8]) for (const away of [.25, .7, 1.3, 2.1, 3.8]) {
    const cells = scoreDistribution(home, away, 0);
    assert.ok(cells.every((cell) => cell.p >= 0 && cell.p <= 1));
    assert.ok(Math.abs(cells.reduce((sum, cell) => sum + cell.p, 0) - 1) < 1e-12);
    const probs = probabilitiesFromDistribution(cells);
    const lambda = home + away;
    const analyticOver = 1 - Math.exp(-lambda) * (1 + lambda + lambda*lambda/2);
    assert.ok(Math.abs(probs.over25 - analyticOver) < 1e-6);
    assert.ok(Math.abs(probs.homeWin + probs.draw + probs.awayWin - 1) < 1e-12);
  }
});

test('full recovery supports the recovering team and unavailable news is not coverage', () => {
  const input = baseAnalysis(); input.advanced.home.restDays = 8; input.sourceStatus.news = 'Unavailable';
  const result = buildVertexModelV2(input);
  assert.equal(result.meta.drivers.find((d) => d.key === 'home-fatigue').side, 'home');
  assert.equal(result.meta.coverage.news, false);
});
