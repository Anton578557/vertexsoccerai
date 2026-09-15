'use strict';

const { buildGranularHistoricalModel } = require('./football-data-uk');

async function enhanceGranularAnalysis(analysis) {
  if (!analysis?.teams?.home?.name || !analysis?.teams?.away?.name) return analysis;

  let granular = null;
  try {
    granular = await buildGranularHistoricalModel(
      analysis.teams.home.name,
      analysis.teams.away.name,
      analysis.fixture?.league || '',
      analysis.fixture?.date || new Date()
    );
  } catch (error) {
    granular = { ok: false, source: 'Football-Data.co.uk', reason: error.message || 'Historical event-stat source failed.' };
  }

  analysis.granularModel = granular?.ok ? granular : null;
  analysis.sourceStatus = {
    ...(analysis.sourceStatus || {}),
    footballDataCoUk: granular?.ok ? `Connected · ${granular.code || 'mapped league'}` : (granular?.reason || 'Unavailable')
  };

  const coverage = granular?.coverage || {};
  analysis.marketCoverage = {
    ...(analysis.marketCoverage || {}),
    granular: {
      corners: Boolean(coverage.corners),
      cards: Boolean(coverage.cards),
      penalties: false,
      shots: Boolean(coverage.shots),
      shotsOnTarget: Boolean(coverage.shotsOnTarget),
      offsides: Boolean(coverage.offsides),
      fouls: Boolean(coverage.fouls),
      source: granular?.ok ? granular.source : null,
      sample: granular?.ok ? granular.sample : null,
      reason: granular?.ok
        ? 'Historical event-stat model is available for supported markets. Penalties remain withheld until a sufficiently large verified event sample is available.'
        : (granular?.reason || 'Historical event-stat model is unavailable for this league.')
    }
  };

  if (granular?.ok) {
    const boost = Math.min(5, Math.max(1, Math.round((granular.quality || 0) / 25)));
    if (Number.isFinite(analysis.dataQuality)) analysis.dataQuality = Math.min(97, analysis.dataQuality + boost);

    const limitations = Array.isArray(analysis.limitations) ? analysis.limitations : [];
    analysis.limitations = limitations.filter((item) => !/detailed historical event-stat feed|granular market/i.test(String(item)));
  }

  return analysis;
}

module.exports = { enhanceGranularAnalysis };
