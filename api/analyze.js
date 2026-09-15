'use strict';

const { clean, buildAnalysis } = require('../lib/football');
const { enhanceAnalysis } = require('../lib/analysis-enhancer');
const { enhanceGranularAnalysis } = require('../lib/granular-enrichment');
const { resolveTeamName } = require('../lib/team-aliases');

function readTeams(req) {
  const source = req.method === 'POST' ? req.body : req.query;
  const homeInput = clean(source?.home, 80);
  const awayInput = clean(source?.away, 80);
  return {
    homeInput,
    awayInput,
    home: resolveTeamName(homeInput),
    away: resolveTeamName(awayInput)
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

  const { homeInput, awayInput, home, away } = readTeams(req);
  if (!homeInput || !awayInput) return res.status(400).json({ error: 'Enter two team names.' });

  try {
    const base = await buildAnalysis(home, away);
    let analysis = await enhanceAnalysis(base);
    analysis = await enhanceGranularAnalysis(analysis);
    analysis.input = {
      home: homeInput,
      away: awayInput,
      resolvedHome: home,
      resolvedAway: away
    };
    return res.status(200).json({ analysis });
  } catch (error) {
    console.error('analyze', error.message, { homeInput, awayInput, home, away });
    const message = error.message && error.message.length < 180 ? error.message : 'Analysis failed.';
    return res.status(502).json({ error: message });
  }
};
