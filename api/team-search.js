'use strict';

const { clean, searchTheSportsDbTeams } = require('../lib/football');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = clean(req.query?.q, 80);
  if (q.length < 2) return res.status(200).json({ teams: [] });

  try {
    const teams = await searchTheSportsDbTeams(q);
    return res.status(200).json({ teams });
  } catch (error) {
    console.error('team-search', error.message);
    return res.status(502).json({ error: 'Team search provider is temporarily unavailable.', teams: [] });
  }
};
