'use strict';

const { liveMatches } = require('../lib/football');
const { primaryLiveMatches } = require('../lib/football-feed');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=90');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const matches = await primaryLiveMatches(() => liveMatches());
    if (matches === null) {
      return res.status(503).json({
        error: 'Live provider is not configured yet.',
        code: 'LIVE_PROVIDER_NOT_CONFIGURED',
        matches: []
      });
    }
    return res.status(200).json({ matches, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('live', error.message);
    return res.status(502).json({ error: 'Live-data provider is temporarily unavailable.', matches: [] });
  }
};
