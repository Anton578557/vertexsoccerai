'use strict';

const { cachedProviderCall } = require('./provider-cache');
const { buildAnalysisCore } = require('../api/analyze');
const { resolveTeamName } = require('./team-aliases');

// Fixed regression cases, not an anonymous analysis API. Run once per day,
// share provider caches, never record these probes as pre-match predictions.
const CASES = [
  ['Operario-PR', 'Ceará'],
  ['Новоризонтино', 'Сан-Бернардо'],
  ['Tomayapo', 'Nacional Potosi'],
  ['Real Betis', 'Mallorca']
];

async function checkAnalyzerCases() {
  const { payload } = await cachedProviderCall({
    cacheKey: 'analyzer-health:v5', provider: 'Vertex Diagnostics', ttlSeconds: 86400, staleSeconds: 86400,
    loader: async () => ({ timestamp: new Date().toISOString(), checks: await Promise.all(CASES.map(async ([home, away]) => {
      try {
        const { analysis } = await buildAnalysisCore(resolveTeamName(home), resolveTeamName(away), {home, away});
        return { input: [home, away], teams: ['home','away'].map(side => ({
          name: analysis.teams[side].name, resolved: analysis.teams[side].resolved === true,
          country: analysis.teams[side].country, badge: Boolean(analysis.teams[side].badge),
          history: analysis.form[side].played
        })), modelReady: Boolean(analysis.model), source: analysis.sourceStatus.primaryFootball,
        coverage: analysis.marketCoverage?.granular || null,
        eventStatsSource: analysis.granularModel?.source || null,
        eventStatsStatus: analysis.sourceStatus.bsdEventStats || null, availability: analysis.availability?.code,
        historySelection: analysis.historySelection?.candidates || [] };
      } catch (_) { return {input:[home,away],modelReady:false,error:'probe_failed'}; }
    })) })
  });
  return payload;
}

module.exports = { checkAnalyzerCases };
