'use strict';

const { buildGranularHistoricalModel } = require('./football-data-uk');
const { ingestFootballDataUkStats } = require('./event-stats-ingestion');

function normalized(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function footballDataUkTeamName(name) {
  const key = normalized(name);
  const aliases = {
    'athletic': 'Ath Bilbao',
    'athletic club': 'Ath Bilbao',
    'athletic bilbao': 'Ath Bilbao',
    'atletico madrid': 'Ath Madrid',
    'real sociedad': 'Sociedad',
    'rayo vallecano': 'Vallecano',
    'real betis': 'Betis',
    'celta vigo': 'Celta',
    'deportivo alaves': 'Alaves',
    'rcd espanyol': 'Espanol',
    'espanyol': 'Espanol'
  };
  return aliases[key] || name;
}

async function enhanceGranularAnalysis(analysis) {
  if (!analysis?.teams?.home?.name || !analysis?.teams?.away?.name) return analysis;

  const sourceHomeName = footballDataUkTeamName(analysis.teams.home.name);
  const sourceAwayName = footballDataUkTeamName(analysis.teams.away.name);

  let granular = null;
  try {
    granular = await buildGranularHistoricalModel(
      sourceHomeName,
      sourceAwayName,
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

    try {
      const ingestion = await ingestFootballDataUkStats({
        code: granular.code,
        seasons: granular.seasons,
        homeName: sourceHomeName,
        awayName: sourceAwayName,
        competition: analysis.fixture?.league || granular.code
      });
      analysis.sourceStatus.eventStatsStorage = ingestion?.saved
        ? `Cached ${ingestion.saved} historical event-stat rows`
        : 'Historical event-stat cache already current or unavailable';
    } catch (error) {
      console.warn('event stats ingestion', error?.message || error);
      analysis.sourceStatus.eventStatsStorage = 'Historical event-stat cache write failed';
    }
  }

  return analysis;
}

module.exports = { enhanceGranularAnalysis };
