'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVertexModelV2 } = require('../lib/vertex-model-v2');

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
  assert.equal(result.meta.version, 'Vertex Model 2.0');
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
