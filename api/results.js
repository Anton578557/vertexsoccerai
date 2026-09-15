'use strict';

const { getProviderCache, setProviderCache } = require('../lib/provider-cache');
const { evaluatePendingModels, performanceSummary } = require('../lib/model-evaluator');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    let maintenance = { ran: false, evaluated: 0, checkedFixtures: 0 };
    const lockKey = 'maintenance:model-evaluation:v1';
    const lock = await getProviderCache(lockKey);

    // Lazy scheduled maintenance: the first Results visit in a four-hour window
    // verifies any finished predictions; later visitors reuse the cached result.
    if (!lock) {
      await setProviderCache(lockKey, 'Vertex Maintenance', { startedAt: new Date().toISOString() }, 4 * 3600);
      const evaluated = await evaluatePendingModels(120);
      maintenance = { ran: true, ...evaluated };
    }

    const summary = await performanceSummary();
    return res.status(200).json({
      ok: true,
      summary,
      maintenance,
      verifiedOnly: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('results', error?.message || error);
    return res.status(500).json({ error: 'Verified results service is temporarily unavailable.' });
  }
};
