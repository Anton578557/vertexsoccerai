'use strict';

const { upcomingMatches } = require('../lib/football');
const { primaryUpcomingMatches } = require('../lib/football-feed');
const { requireUser } = require('../lib/api-auth');
const { enforceRateLimit } = require('../lib/rate-limit');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireUser(req, res);
  if (!user) return;
  if (!(await enforceRateLimit(req, res, user, 'upcoming', { windowSeconds: 3600, limit: 120 }))) return;

  try {
    const matches = await primaryUpcomingMatches(() => upcomingMatches());
    if (matches === null) {
      return res.status(503).json({
        error: 'Upcoming-match provider is not configured yet.',
        code: 'UPCOMING_PROVIDER_NOT_CONFIGURED',
        matches: []
      });
    }
    return res.status(200).json({ matches, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('upcoming', error.message, { userId: user.id });
    return res.status(502).json({ error: 'Upcoming-match provider is temporarily unavailable.', matches: [] });
  }
};
