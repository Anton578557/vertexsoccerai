'use strict';

const { getProviderCache, setProviderCache } = require('../lib/provider-cache');
const { evaluatePendingModels, performanceSummary } = require('../lib/model-evaluator');
const { cleanupRuntimeData } = require('../lib/runtime-maintenance');
const { timingSafeEqual } = require('node:crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const scheduled = req.query?.maintenance === '1';
  if (scheduled) {
    const secret = String(process.env.CRON_SECRET || '');
    const actual = Buffer.from(String(req.headers?.authorization || ''));
    const expected = Buffer.from(`Bearer ${secret}`);
    if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return res.status(401).json({error:'Unauthorized'});
  }
  res.setHeader('Cache-Control', scheduled ? 'no-store' : 's-maxage=300, stale-while-revalidate=600');

  try {
    let maintenance = { ran: false, evaluated: 0, checkedFixtures: 0 };
    let cleanup = { ran: false, providerCacheDeleted: 0, rateLimitDeleted: 0 };
    const lockKey = 'maintenance:model-evaluation:v3';
    const lock = await getProviderCache(lockKey);

    // Vercel Cron invokes the protected route daily, even with no site visits.
    if (scheduled && !lock) {
      await setProviderCache(lockKey, 'Vertex Maintenance', { startedAt: new Date().toISOString() }, 900);
      const [evaluated, cleaned] = await Promise.all([
        evaluatePendingModels(120),
        cleanupRuntimeData()
      ]);
      maintenance = { ran: true, ...evaluated };
      cleanup = cleaned;
      await setProviderCache('maintenance:model-evaluation:last', 'Vertex Maintenance', { ...maintenance, completedAt:new Date().toISOString(), ok:true }, 7 * 86400);
    }

    const summary = await performanceSummary();
    return res.status(200).json({
      ok: true,
      summary,
      maintenance,
      cleanup,
      automation: {schedule:'daily', lastRun:await getProviderCache('maintenance:model-evaluation:last')},
      verifiedOnly: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('results', error?.message || error);
    return res.status(500).json({ error: 'Verified results service is temporarily unavailable.' });
  }
};
