'use strict';

const { checkApiFootball } = require('../lib/api-football-client');
const { checkSportmonks } = require('../lib/sportmonks-client');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  const [apiFootball, sportmonks] = await Promise.all([
    checkApiFootball(),
    checkSportmonks()
  ]);

  const ok = (!apiFootball.configured || apiFootball.ok) && (!sportmonks.configured || sportmonks.ok);
  return res.status(ok ? 200 : 207).json({
    ok,
    providers: { apiFootball, sportmonks },
    timestamp: new Date().toISOString()
  });
};
