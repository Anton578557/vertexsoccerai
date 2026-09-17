'use strict';

const { runSystemDiagnostics } = require('../lib/system-diagnostics');
const { cachedProviderCall } = require('../lib/provider-cache');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Diagnostics are deliberately expensive because they actively probe external
  // providers. Cache the full report so public refreshes cannot burn free quotas.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');

  try {
    const { payload, staleHit } = await cachedProviderCall({
      cacheKey: 'system-diagnostics:v3',
      provider: 'Vertex Diagnostics',
      ttlSeconds: 1800,
      staleSeconds: 21600,
      loader: runSystemDiagnostics
    });
    const report = payload || { ok: false, degraded: true, error: 'Diagnostics unavailable.' };
    return res.status(report.ok ? 200 : 207).json({ ...report, diagnosticCacheStale: Boolean(staleHit) });
  } catch (error) {
    console.error('provider-check', error?.message || error);
    return res.status(500).json({
      ok: false,
      degraded: true,
      error: 'System diagnostics failed.',
      timestamp: new Date().toISOString()
    });
  }
};
