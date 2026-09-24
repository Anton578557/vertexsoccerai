'use strict';

const { runSystemDiagnostics } = require('../lib/system-diagnostics');
const { cachedProviderCall } = require('../lib/provider-cache');
const { enforceRateLimit } = require('../lib/rate-limit');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await enforceRateLimit(req, res, null, 'provider-check', { windowSeconds: 3600, limit: 12 }))) return;

  // Active provider probes consume real quotas. The fixed server-side cache key
  // makes query-string cache busting harmless and protects free-tier APIs.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');

  try {
    const { payload, staleHit, cacheHit } = await cachedProviderCall({
      cacheKey: 'system-diagnostics:v10',
      provider: 'Vertex Diagnostics',
      ttlSeconds: 300,
      staleSeconds: 1800,
      loader: runSystemDiagnostics
    });
    const report = payload || { ok: false, degraded: true, error: 'Diagnostics unavailable.' };
    return res.status(report.ok ? 200 : 207).json({
      ...report,
      diagnosticCacheHit: Boolean(cacheHit),
      diagnosticCacheStale: Boolean(staleHit)
    });
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
