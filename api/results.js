'use strict';

const { getProviderCache, setProviderCache } = require('../lib/provider-cache');
const { evaluatePendingModels, performanceSummary } = require('../lib/model-evaluator');
const { cleanupRuntimeData } = require('../lib/runtime-maintenance');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    let maintenance = { ran: false, evaluated: 0, checkedFixtures: 0 };
    let cleanup = { ran: false, providerCacheDeleted: 0, rateLimitDeleted: 0 };
    const lockKey = 'maintenance:model-evaluation:v2';
    const lock = await getProviderCache(lockKey);

    // Lazy scheduled maintenance: the first Results visit in a four-hour window
    // verifies finished predictions and cleans expired runtime rows. Later
    // visitors reuse the cached result instead of repeating provider/DB work.
    if (!lock) {
      await setProviderCache(lockKey, 'Vertex Maintenance', { startedAt: new Date().toISOString() }, 4 * 3600);
      const [evaluated, cleaned] = await Promise.all([
        evaluatePendingModels(120),
        cleanupRuntimeData()
      ]);
      maintenance = { ran: true, ...evaluated };
      cleanup = cleaned;
    }

    const summary = await performanceSummary();
    return res.status(200).json({
      ok: true,
      summary,
      maintenance,
      cleanup,
      verifiedOnly: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('results', error?.message || error);
    return res.status(500).json({ error: 'Verified results service is temporarily unavailable.' });
  }
};
