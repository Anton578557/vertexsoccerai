'use strict';

const { clean, searchTheSportsDbTeams } = require('../lib/football');
const { localizedSuggestions, searchQuery } = require('../lib/team-aliases');
const { enforceRateLimit } = require('../lib/rate-limit');

function isYouthOrReserve(value) {
  return /\b(youth|academy|reserve|reserves|u\s?-?\d{2}|under\s?-?\d{2}|primavera|b team|ii)\b/i.test(String(value || ''));
}

function mergeTeams(localNames, providerTeams, rawQuery = '') {
  const out = [];
  const seen = new Set();
  const wantsYouth = isYouthOrReserve(rawQuery);
  const push = (team) => {
    const name = String(team?.name || '').trim();
    if (!name) return;
    if (!wantsYouth && isYouthOrReserve(name)) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(team);
  };

  for (const name of localNames) push({ name, league: '', country: '', badge: null, localized: true });
  for (const team of providerTeams || []) push(team);
  return out.slice(0, 8);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await enforceRateLimit(req, res, null, 'team-search', { windowSeconds: 60, limit: 120 }))) return;

  const q = clean(req.query?.q, 80);
  if (q.length < 2) return res.status(200).json({ teams: [] });

  const local = localizedSuggestions(q, 8);
  const providerQuery = searchQuery(q);
  // Known names must remain searchable even when the upstream quota is exhausted.
  if (local.length) return res.status(200).json({ teams: mergeTeams(local, [], q) });

  try {
    const provider = providerQuery.length >= 2 ? await searchTheSportsDbTeams(providerQuery) : [];
    return res.status(200).json({ teams: mergeTeams(local, provider, q) });
  } catch (error) {
    console.error('team-search', error.message, { q, providerQuery });
    if (local.length) return res.status(200).json({ teams: mergeTeams(local, [], q) });
    return res.status(502).json({ error: 'Team search provider is temporarily unavailable.', teams: [] });
  }
};
