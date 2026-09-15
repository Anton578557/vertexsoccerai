'use strict';

const { upcomingMatches } = require('../lib/football');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=240');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const matches = await upcomingMatches();
    if (matches === null) {
      return res.status(503).json({
        error: 'Upcoming-match provider is not configured yet.',
        code: 'UPCOMING_PROVIDER_NOT_CONFIGURED',
        matches: []
      });
    }
    return res.status(200).json({ matches, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('upcoming', error.message);
    return res.status(502).json({ error: 'Upcoming-match provider is temporarily unavailable.', matches: [] });
  }
};
