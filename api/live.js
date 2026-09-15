'use strict';

const { liveMatches } = require('../lib/football');
const { primaryLiveMatches } = require('../lib/football-feed');
const { requireUser } = require('../lib/api-auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireUser(req, res);
  if (!user) return;

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
    console.error('live', error.message, { userId: user.id });
    return res.status(502).json({ error: 'Live-data provider is temporarily unavailable.', matches: [] });
  }
};
