'use strict';

const { withBudget, stage, remaining } = require('../lib/analysis-budget');
const { enrichMatchContext } = require('../lib/match-context');
const { applyHistory } = require('../lib/verified-history');
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
  const started = Date.now();
  return withBudget(43000, async () => {
    let analysis = {generatedAt:new Date().toISOString(),
      teams:{home:{name:home,resolved:false},away:{name:away,resolved:false}},
      fixture:{date:null}, form:{home:{played:0},away:{played:0}},
      news:[], sourceStatus:{},limitations:[]};
    analysis = await stage(analysis,'identity',9500,()=>buildBaseAnalysis(home,away,original));
    analysis = await stage(analysis,'fixture',3500,preResolveFixture);
    analysis = await stage(analysis,'history',12500,async base=>{
      // Independent sources compete on freshness/completeness, not response order.
      const [primary,bsd] = await Promise.all([
        enhanceAnalysis(structuredClone(base)), enrichBsdHistory(structuredClone(base))
      ]);
      for(const side of ['home','away']) {
        const t=bsd.teams[side];
        if(t.bsdId) primary.teams[side]={...t,...primary.teams[side],bsdId:t.bsdId,
          name:primary.teams[side].resolved?primary.teams[side].name:t.name,
          resolved:true,country:primary.teams[side].country || t.country,
          badge:primary.teams[side].badge || t.badge,
          badgeCandidates:[...new Set([...(primary.teams[side].badgeCandidates || []),...(t.badgeCandidates || [])])]};
      }
      primary.sourceStatus ||= {};
      primary.sourceStatus.bsd=bsd.sourceStatus?.bsd;
      if(bsd.history?.source === 'BSD') applyHistory(primary,{ok:true,source:'BSD',
        homeForm:bsd.form.home,awayForm:bsd.form.away,advanced:bsd.advanced,
        leagueContext:bsd.leagueContext,h2h:bsd.h2h,history:bsd.history});
      primary.dataSources=[...(primary.dataSources || []),...(bsd.dataSources || [])];
      return primary;
    });
    if(needsMoreHistory(analysis) && remaining()>16000) analysis=await stage(analysis,'open-history',4500,enrichOpenFootball);
    if(needsMoreHistory(analysis) && remaining()>13000) analysis=await stage(analysis,'open-league',4500,async a=>enrichOpenLigaDb(await resolveOpenLigaClubs(a)));
    const enough=()=>Math.min(analysis.form?.home?.played || 0,analysis.form?.away?.played || 0)>=3;
    if(!enough() && remaining()>9000) analysis=await stage(analysis,'sportmonks',4500,enrichSportmonksHistory);
    let apiFootballFallback={used:false,cacheHits:0};
    if(!enough() && remaining()>6000) analysis=await stage(analysis,'api-football',4000,async a=>{
      const fallback=await enrichApiFootballFallback(a);apiFootballFallback=fallback;return fallback.analysis;
    });
    analysis=await stage(analysis,'match-context',6500,enrichMatchContext);
    analysis=await stage(analysis,'event-statistics',Math.min(14500,remaining()-1800),enhanceGranularAnalysis);
    if(remaining()>1000) analysis=await stage(analysis,'league-context',1800,attachModelContext);
    if((analysis.news || []).length && remaining()>500) analysis=await stage(analysis,'availability',1600,enrichAvailabilityIntelligence);
    analysis=finalizeVertexModelV2(refreshScheduleContext(analysis));
    analysis.engine={...(analysis.engine || {}),analysisDurationMs:Date.now()-started,
      collectionComplete:!(analysis.collection || []).some(s=>s.status!=='completed'),
      collectionStages:analysis.collection || [],refreshIntervalSeconds:300};
    return {analysis,providerMeta:{apiFootballFallbackUsed:Boolean(apiFootballFallback.used),apiFootballCacheHits:Number(apiFootballFallback.cacheHits || 0)}};
  });
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
    const analysisKey = `analysis-core:v22:${safeKey(home)}:${safeKey(away)}`;
    const cached = await cachedProviderCall({
      cacheKey: analysisKey,
      provider: 'Vertex Analysis Core',
      ttlSeconds: 120,
      staleSeconds: 0,
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
