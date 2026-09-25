'use strict';

const { buildBaseAnalysis } = require('../lib/base-analysis-v2');
const { enhanceAnalysis } = require('../lib/analysis-enhancer');
const { enhanceGranularAnalysis } = require('../lib/granular-enrichment');
const { enrichApiFootballFallback } = require('../lib/api-football-fallback');
const { enrichFootballData, resolveUpcomingFixture } = require('../lib/football-data-enrichment');
const { enrichAvailabilityIntelligence } = require('../lib/squad-availability');
const { finalizeVertexModelV2 } = require('../lib/vertex-model-v2');
const { recordModelEvaluations } = require('../lib/model-evaluation-store');
const { requireUser } = require('../lib/api-auth');
const { enforceRateLimit } = require('../lib/rate-limit');
const { cachedProviderCall } = require('../lib/provider-cache');
const { resolveTeamName, ambiguousTeamChoices } = require('../lib/team-aliases');
const { enrichOpenFootball } = require('../lib/openfootball-history');
const { enrichOpenLigaDb, resolveOpenLigaClubs } = require('../lib/openligadb-history');
const { needsMoreHistory, refreshScheduleContext } = require('../lib/verified-history');
const { enrichBsdHistory } = require('../lib/bsd-history');
const { enrichEspnAnalysis } = require('../lib/espn-football');
const { enrichSportmonksHistory } = require('../lib/sportmonks-history');

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

async function preResolveFixture(base) {
  if (!base?.teams?.home?.name || !base?.teams?.away?.name) return base;
  if (base.fixture?.date) return base;
  const fixture = await resolveUpcomingFixture(base.teams.home.name, base.teams.away.name, 21);
  if (!fixture) return base;
  if (fixture.reversed) base = await buildBaseAnalysis(base.teams.away.name, base.teams.home.name);
  base.fixture = {
    ...(base.fixture || {}),
    date: fixture.date || null,
    league: fixture.league || base.fixture?.league || null,
    venue: fixture.venue || base.fixture?.venue || null,
    source: 'Football-Data fixture resolver',
    inputReversed: Boolean(fixture.reversed)
  };
  base.sourceStatus = {
    ...(base.sourceStatus || {}),
    fixtureResolver: fixture.reversed ? 'Football-Data · teams entered in reverse order' : 'Football-Data · exact upcoming fixture'
  };
  return base;
}

async function attachModelContext(analysis) {
  if (!analysis?.teams?.home?.name || !analysis?.teams?.away?.name) return analysis;
  if (analysis?.advanced?.home && analysis?.advanced?.away && analysis?.leagueContext) return analysis;
  const fd = await enrichFootballData(
    analysis.teams.home.name,
    analysis.teams.away.name,
    analysis.fixture?.league || '',
    analysis.teams.home.country || ''
  );
  if (fd?.ok) {
    // Preserve the selected form bundle. Supplement league/H2H separately,
    // keeping explicit provenance instead of silently replacing advanced form.
    analysis.leagueContext = fd.leagueContext || analysis.leagueContext || null;
    analysis.h2h = fd.h2h || analysis.h2h || null;
    analysis.contextSources = {...(analysis.contextSources || {}),
      league: fd.leagueContext ? 'Football-Data' : analysis.contextSources?.league,
      h2h: fd.h2h?.sample ? 'Football-Data' : analysis.contextSources?.h2h};
    if (fd.penaltyModel?.ok) analysis.penaltyModel = fd.penaltyModel;
    analysis.sourceStatus = {
      ...(analysis.sourceStatus || {}),
      vertexModelContext: `${analysis.contextSources?.form || analysis.sourceStatus.primaryFootball} · form; Football-Data · league/H2H context`,
      penaltyHistory: fd.penaltyModel?.ok ? 'Football-Data verified scored-penalty history' : (fd.penaltyModel?.reason || 'Penalty sample unavailable')
    };
    analysis.marketCoverage = {
      ...(analysis.marketCoverage || {}),
      granular: {
        ...(analysis.marketCoverage?.granular || {}),
        penalties: Boolean(fd.penaltyModel?.ok)
      }
    };
  }
  return analysis;
}

async function buildAnalysisCore(home, away, original = {}) {
  if ([home, away].some(name => ambiguousTeamChoices(name).length)) throw new Error('TEAM_AMBIGUOUS');
  let base = await buildBaseAnalysis(home, away, original);
  base = await resolveOpenLigaClubs(base);
  base = await preResolveFixture(base);
  let analysis = await enhanceAnalysis(base);

  const enoughHistory = () => Math.min(analysis.form?.home?.played || 0, analysis.form?.away?.played || 0) >= 3;
  if (needsMoreHistory(analysis)) analysis = await enrichOpenFootball(analysis);
  if (needsMoreHistory(analysis)) analysis = await enrichOpenLigaDb(analysis);
  if (needsMoreHistory(analysis)) analysis = await enrichBsdHistory(analysis);
  if (process.env.ESPN_FOOTBALL_ENABLED === 'true' && (!enoughHistory() || !analysis.fixture?.date)) analysis = await enrichEspnAnalysis(analysis);
  if (!enoughHistory()) analysis = await enrichSportmonksHistory(analysis);

  let apiFootballFallback = { used: false, cacheHits: 0 };
  if (!enoughHistory()) {
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
  analysis = await enrichAvailabilityIntelligence(analysis);
  analysis = refreshScheduleContext(analysis);
  analysis = finalizeVertexModelV2(analysis);

  if (analysis.penaltyModel?.ok) {
    analysis.marketCoverage = {
      ...(analysis.marketCoverage || {}),
      granular: {
        ...(analysis.marketCoverage?.granular || {}),
        penalties: true,
        penaltySource: analysis.penaltyModel.source,
        penaltyBasis: analysis.penaltyModel.basis
      }
    };
  }

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

  const { homeInput, awayInput, home, away } = readTeams(req);
  if (!homeInput || !awayInput) return res.status(400).json({ error: 'Enter two team names.' });
  if (!home || !away || safeKey(home) === safeKey(away)) return res.status(400).json({ error: 'Choose two different teams.' });
  const ambiguous = [['home', homeInput], ['away', awayInput]].flatMap(([side, input]) => {
    const candidates = ambiguousTeamChoices(input);
    return candidates.length ? [{ side, input, candidates }] : [];
  });
  if (ambiguous.length) return res.status(409).json({ code: 'TEAM_AMBIGUOUS', error: 'Clarify the team.', teams: ambiguous });
  if (!(await enforceRateLimit(req, res, user, 'analyze', { windowSeconds: 3600, limit: 30 }))) return;

  try {
    const analysisKey = `analysis-core:v19:${safeKey(home)}:${safeKey(away)}`;
    const cached = await cachedProviderCall({
      cacheKey: analysisKey,
      provider: 'Vertex Analysis Core',
      ttlSeconds: 300,
      staleSeconds: 1800,
      loader: () => buildAnalysisCore(home, away, { home: homeInput, away: awayInput })
    });

    if (!cached.payload?.analysis) throw new Error('Analysis providers did not return a usable result.');
    const analysis = cached.payload.analysis;
    const providerMeta = cached.payload.providerMeta || {};

    analysis.input = { home: homeInput, away: awayInput, resolvedHome: analysis.teams.home.name, resolvedAway: analysis.teams.away.name };
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
      sharedInflight: Boolean(cached.shared),
      availabilityIntelligence: true,
      europeanFixtureResolver: true,
      penaltyHistoryModel: Boolean(analysis.penaltyModel?.ok)
    };

    const evaluationWrite = await recordModelEvaluations(analysis);
    analysis.engine.modelSnapshotRecorded = Boolean(evaluationWrite.recorded || evaluationWrite.existing);
    analysis.engine.modelSnapshotStatus = evaluationWrite.reason || 'saved';

    return res.status(200).json({ analysis });
  } catch (error) {
    console.error('analyze', error.message, { homeInput, awayInput, home, away, userId: user.id });
    const message = error.message && error.message.length < 180 ? error.message : 'Analysis failed.';
    return res.status(502).json({ error: message });
  }
};
module.exports.buildAnalysisCore = buildAnalysisCore;
