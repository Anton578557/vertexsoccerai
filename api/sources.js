'use strict';

const { getPublicProviderStatus } = require('../lib/provider-mesh');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const providers = getPublicProviderStatus();
  const configured = Object.entries(providers)
    .filter(([, provider]) => provider.configured)
    .map(([key]) => key);

  return res.status(200).json({
    ok: true,
    configuredCount: configured.length,
    configured,
    providers,
    timestamp: new Date().toISOString()
  });
};
