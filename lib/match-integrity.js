'use strict';

const { resolveTeamName } = require('./team-aliases');

// Resolve known aliases first; never identify two clubs by one shared token.
function teamIdentity(value) {
  const stripped = resolveTeamName(String(value || '').replace(/\b([FA]?)\.\s*([FC])\./gi, '$1$2')).replace(/\b(?:FC|CF|AFC|SC|CD|UD)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  return resolveTeamName(stripped).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\b(?:fc|cf|afc|sc|cd|ud)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function sameTeam(a, b) {
  const left = teamIdentity(a);
  return Boolean(left && left === teamIdentity(b));
}

// Football-data fullTime is also the running score and may include extra time.
function regulationScore(match) {
  if (String(match?.status).toUpperCase() !== 'FINISHED') return null;
  const score = match.score || {};
  const valid = (pair) => pair && ['home', 'away'].every((key) => Number.isInteger(pair[key]) && pair[key] >= 0);
  if (valid(score.regularTime)) return score.regularTime;
  if ((!score.duration || score.duration === 'REGULAR') && valid(score.fullTime)) return score.fullTime;
  return null;
}

module.exports = { sameTeam, teamIdentity, regulationScore };
