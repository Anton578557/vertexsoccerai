'use strict';

const { runSystemDiagnostics } = require('../lib/system-diagnostics');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Active probes may consume a provider request, so cache the diagnostic result
  // briefly instead of re-checking every refresh.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const report = await runSystemDiagnostics();
    return res.status(report.ok ? 200 : 207).json(report);
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
