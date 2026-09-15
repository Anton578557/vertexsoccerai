'use strict';

const { clean, buildAnalysis } = require('../lib/football');

function readTeams(req) {
  if (req.method === 'POST') {
    return {
      home: clean(req.body?.home, 80),
      away: clean(req.body?.away, 80)
    };
  }
  return {
    home: clean(req.query?.home, 80),
    away: clean(req.query?.away, 80)
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

  const { home, away } = readTeams(req);
  if (!home || !away) return res.status(400).json({ error: 'Enter two team names.' });

  try {
    const analysis = await buildAnalysis(home, away);
    return res.status(200).json({ analysis });
  } catch (error) {
    console.error('analyze', error.message);
    const message = error.message && error.message.length < 180 ? error.message : 'Analysis failed.';
    return res.status(502).json({ error: message });
  }
};
