'use strict';

const { buildBaseAnalysis } = require('../lib/base-analysis-v2');
const { enhanceAnalysis } = require('../lib/analysis-enhancer');
const { enhanceGranularAnalysis } = require('../lib/granular-enrichment');
const { enrichApiFootballFallback } = require('../lib/api-football-fallback');
const { enrichFootballData } = require('../lib/football-data-enrichment');
const { finalizeVertexModelV2 } = require('../lib/vertex-model-v2');
const { recordModelEvaluations } = require('../lib/model-evaluation-store');
const { requireUser } = require('../lib/api-auth');
const { enforceRateLimit } = require('../lib/rate-limit');
const { cachedProviderCall } = require('../lib/provider-cache');
const { resolveTeamName } = require('../lib/team-aliases');

function clean(value, max = 80) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeKey(value) {
  return clean(value, 80)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

function readTeams(req) {
  const source = req.method === 'POST' ? req.body : req.query;
  const homeInput = clean(source?.home, 80);
  const awayInput = clean(source?.away, 80);
  return {
    homeInput,
    awayInput,
    home: resolveTeamName(homeInput),
    away: resolveTeamName(awayInput)
  };
}

async function attachModelContext(analysis) {
  if (!analysis?.teams?.home?.name || !analysis?.teams?.away?.name) return analysis;
  const fd = await enrichFootballData(
    analysis.teams.home.name,
    analysis.teams.away.name,
    analysis.fixture?.league || ''
  );
  if (fd?.ok) {
    analysis.advanced = fd.advanced || analysis.advanced || null;
    analysis.leagueContext = fd.leagueContext || analysis.leagueContext || null;
    analysis.h2h = fd.h2h || analysis.h2h || null;
    analysis.sourceStatus = {
      ...(analysis.sourceStatus || {}),
      vertexModelContext: 'Football-Data opponent-adjusted form + league baseline + H2H'
    };
  }
  return analysis;
}

async function buildAnalysisCore(home, away) {
  const base = await buildBaseAnalysis(home, away);
  let analysis = await enhanceAnalysis(base);

  let apiFootballFallback = { used: false, cacheHits: 0 };
  if (!analysis.model) {
    apiFootballFallback = await enrichApiFootballFallback(analysis);
    analysis = apiFootballFallback.analysis;

    if (apiFootballFallback.used) {
      analysis = await enhanceAnalysis(analysis);
      analysis.sourceStatus = {
        ...(analysis.sourceStatus || {}),
        primaryFootball: analysis.model
          ? 'API-Football fallback + multi-source context'
          : (analysis.sourceStatus?.primaryFootball || 'API-Football fallback')
      };
    }
  }

  analysis = await enhanceGranularAnalysis(analysis);
  analysis = await attachModelContext(analysis);
  analysis = finalizeVertexModelV2(analysis);

  return {
    analysis,
    providerMeta: {
      apiFootballFallbackUsed: Boolean(apiFootballFallback.used),
      apiFootballCacheHits: Number(apiFootballFallback.cacheHits || 0)
    }
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireUser(req, res);
  if (!user) return;
  if (!(await enforceRateLimit(req, res, user, 'analyze', { windowSeconds: 3600, limit: 30 }))) return;

  const { homeInput, awayInput, home, away } = readTeams(req);
  if (!homeInput || !awayInput) return res.status(400).json({ error: 'Enter two team names.' });
  if (!home || !away || safeKey(home) === safeKey(away)) return res.status(400).json({ error: 'Choose two different teams.' });

  try {
    const analysisKey = `analysis-core:v4:${safeKey(home)}:${safeKey(away)}`;
    const cached = await cachedProviderCall({
      cacheKey: analysisKey,
      provider: 'Vertex Analysis Core',
      ttlSeconds: 300,
      staleSeconds: 1800,
      loader: () => buildAnalysisCore(home, away)
    });

    if (!cached.payload?.analysis) throw new Error('Analysis providers did not return a usable result.');
    const analysis = cached.payload.analysis;
    const providerMeta = cached.payload.providerMeta || {};

    analysis.input = {
      home: homeInput,
      away: awayInput,
      resolvedHome: home,
      resolvedAway: away
    };
    analysis.engine = {
      ...(analysis.engine || {}),
      quotaPolicy: 'open-and-cached-first',
      apiFootballFallbackUsed: Boolean(providerMeta.apiFootballFallbackUsed),
      apiFootballCacheHits: Number(providerMeta.apiFootballCacheHits || 0),
      authenticated: true,
      distributedRateLimit: true,
      sharedAnalysisCache: true,
      analysisCacheHit: Boolean(cached.cacheHit),
      analysisCacheStale: Boolean(cached.staleHit),
      sharedInflight: Boolean(cached.shared)
    };

    if (!cached.cacheHit && !cached.staleHit) {
      const evaluationWrite = await recordModelEvaluations(analysis);
      analysis.engine.modelSnapshotRecorded = Number(evaluationWrite.recorded || 0) > 0;
    } else {
      analysis.engine.modelSnapshotRecorded = Boolean(analysis.model && analysis.fixture?.date);
    }

    return res.status(200).json({ analysis });
  } catch (error) {
    console.error('analyze', error.message, { homeInput, awayInput, home, away, userId: user.id });
    const message = error.message && error.message.length < 180 ? error.message : 'Analysis failed.';
    return res.status(502).json({ error: message });
  }
};
