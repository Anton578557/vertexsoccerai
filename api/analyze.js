'use strict';

const { buildBaseAnalysis } = require('../lib/base-analysis-v2');
const { enhanceAnalysis } = require('../lib/analysis-enhancer');
const { enhanceGranularAnalysis } = require('../lib/granular-enrichment');
const { enrichApiFootballFallback } = require('../lib/api-football-fallback');
const { recordModelEvaluations } = require('../lib/model-evaluation-store');
const { requireUser } = require('../lib/api-auth');
const { enforceRateLimit } = require('../lib/rate-limit');
const { resolveTeamName } = require('../lib/team-aliases');

function clean(value, max = 80) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
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

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireUser(req, res);
  if (!user) return;
  if (!(await enforceRateLimit(req, res, user, 'analyze', { windowSeconds: 3600, limit: 30 }))) return;

  const { homeInput, awayInput, home, away } = readTeams(req);
  if (!homeInput || !awayInput) return res.status(400).json({ error: 'Enter two team names.' });

  try {
    // Free/open providers first. This deliberately avoids consuming the
    // 100-request/day API-Football allowance on every normal analysis.
    const base = await buildBaseAnalysis(home, away);
    let analysis = await enhanceAnalysis(base);

    let apiFootballFallback = { used: false, cacheHits: 0 };
    if (!analysis.model) {
      apiFootballFallback = await enrichApiFootballFallback(analysis);
      analysis = apiFootballFallback.analysis;

      // Rebuild model/context only when the fallback actually improved the data.
      if (apiFootballFallback.used) {
        analysis = await enhanceAnalysis(analysis);
        analysis.sourceStatus = {
          ...(analysis.sourceStatus || {}),
          primaryFootball: analysis.model ? 'API-Football fallback + multi-source context' : (analysis.sourceStatus?.primaryFootball || 'API-Football fallback')
        };
      }
    }

    analysis = await enhanceGranularAnalysis(analysis);
    analysis.input = {
      home: homeInput,
      away: awayInput,
      resolvedHome: home,
      resolvedAway: away
    };
    analysis.engine = {
      ...(analysis.engine || {}),
      quotaPolicy: 'open-and-cached-first',
      apiFootballFallbackUsed: Boolean(apiFootballFallback.used),
      apiFootballCacheHits: Number(apiFootballFallback.cacheHits || 0),
      authenticated: true,
      distributedRateLimit: true
    };

    // Store only real pre-match model selections that can later be compared
    // with final results. This never blocks the user if persistence is down.
    const evaluationWrite = await recordModelEvaluations(analysis);
    analysis.engine.modelSnapshotRecorded = Number(evaluationWrite.recorded || 0) > 0;

    return res.status(200).json({ analysis });
  } catch (error) {
    console.error('analyze', error.message, { homeInput, awayInput, home, away, userId: user.id });
    const message = error.message && error.message.length < 180 ? error.message : 'Analysis failed.';
    return res.status(502).json({ error: message });
  }
};
