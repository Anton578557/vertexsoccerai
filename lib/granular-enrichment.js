'use strict';

const { buildBsdEventModel, mergeEventModels } = require('./bsd-event-stats');
const { buildGranularHistoricalModel } = require('./football-data-uk');
const { ingestFootballDataUkStats } = require('./event-stats-ingestion');
const { cachedProviderCall } = require('./provider-cache');

function normalized(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeKey(value) {
  return normalized(value).replace(/\s+/g, '-').slice(0, 80) || 'unknown';
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
  // Expected home/away event counts are directional, so the cache must be too.
  const pairKey = [safeKey(sourceHomeName), safeKey(sourceAwayName)].join(':');
  const leagueKey = safeKey(analysis.fixture?.league || 'unknown-league');
  const dateKey = String(analysis.fixture?.date || new Date().toISOString()).slice(0, 10);

  let granular = null;
  try {
    const { payload } = await cachedProviderCall({
      cacheKey: `granular:v6:${leagueKey}:${pairKey}:${dateKey}`,
      provider: 'Football-Data.co.uk',
      ttlSeconds: 3600,
      staleSeconds: 86400,
      loader: () => buildGranularHistoricalModel(
        sourceHomeName,
        sourceAwayName,
        analysis.fixture?.league || '',
        analysis.fixture?.date || new Date(),
        analysis.teams.home.country || ''
      )
    });
    granular = payload;
  } catch (error) {
    granular = { ok: false, source: 'Football-Data.co.uk', reason: error.message || 'Historical event-stat source failed.' };
  }

  const csvModel = granular;
  let bsdModel = null;
  if (!granular?.coverage?.corners || !granular?.coverage?.cards || !granular?.redCards?.home || !granular?.redCards?.away) {
    bsdModel = await buildBsdEventModel(analysis);
    granular = mergeEventModels(granular, bsdModel);
  }
  if (granular?.ok) for (const key of ['corners','cards','redCards']) {
    if (granular[key] && !granular[key].source) granular[key] = {...granular[key],source:granular.source};
  }
  analysis.granularModel = granular?.ok ? granular : null;
  analysis.sourceStatus = {
    ...(analysis.sourceStatus || {}),
    footballDataCoUk: csvModel?.ok ? `Connected · ${csvModel.code || 'mapped league'}` : (csvModel?.reason || 'Event statistics unavailable; result history is checked separately'),
    bsdEventStats: bsdModel ? (bsdModel.ok ? 'Connected · verified event statistics' : bsdModel.reason) : 'not_needed'
  };

  const coverage = granular?.coverage || {};
  const penaltyAvailable = Boolean(analysis?.penaltyModel?.ok || analysis?.marketCoverage?.granular?.penalties);
  analysis.marketCoverage = {
    ...(analysis.marketCoverage || {}),
    granular: {
      ...(analysis.marketCoverage?.granular || {}),
      eventSamples: granular?.eventSamples || bsdModel?.eventSamples || csvModel?.eventSamples || null,
      bsdCollection: bsdModel?.collection || null,
      corners: Boolean(coverage.corners),
      cards: Boolean(coverage.cards),
      redCards: Boolean(coverage.redCards),
      cardHistory: Boolean(granular?.yellowHistory?.home || granular?.yellowHistory?.away || granular?.redCards),
      forecastsAvailable: granular?.forecastsAvailable !== false && Boolean(granular?.ok),
      penalties: penaltyAvailable,
      shots: Boolean(coverage.shots),
      shotsOnTarget: Boolean(coverage.shotsOnTarget),
      offsides: Boolean(coverage.offsides),
      fouls: Boolean(coverage.fouls),
      source: granular?.ok ? granular.source : (analysis?.marketCoverage?.granular?.source || null),
      sample: granular?.ok ? granular.sample : (analysis?.marketCoverage?.granular?.sample || null),
      reason: penaltyAvailable
        ? 'Historical event-stat markets are available; penalty coverage uses a separate verified scored-penalty history model.'
        : granular?.ok
          ? 'Historical event-stat model is available for supported markets. Penalties require a sufficiently large verified sample.'
          : (granular?.reason || 'Historical event-stat model is unavailable for this league.')
    }
  };

  if (granular?.ok) {
    const boost = Math.min(5, Math.max(1, Math.round((granular.quality || 0) / 25)));
    if (Number.isFinite(analysis.dataQuality)) analysis.dataQuality = Math.min(97, analysis.dataQuality + boost);

    const limitations = Array.isArray(analysis.limitations) ? analysis.limitations : [];
    analysis.limitations = limitations.filter((item) => !/detailed historical event-stat feed|granular market/i.test(String(item)));

    try {
      if (!csvModel?.ok) return analysis;
      const ingestKey = `event-ingest:v2:${csvModel.code}:${(csvModel.seasons || []).join('-')}:${pairKey}`;
      const { payload: ingestion } = await cachedProviderCall({
        cacheKey: ingestKey,
        provider: 'Vertex Event Stats Ingestion',
        ttlSeconds: 21600,
        staleSeconds: 86400,
        loader: () => ingestFootballDataUkStats({
          code: csvModel.code,
          seasons: csvModel.seasons,
          homeName: sourceHomeName,
          awayName: sourceAwayName,
          competition: analysis.fixture?.league || granular.code
        })
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
