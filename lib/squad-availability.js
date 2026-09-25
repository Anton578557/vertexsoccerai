'use strict';

const { boundedFetch: fetch } = require('./analysis-budget');

const { sameTeam } = require('./match-integrity');
const { cachedProviderCall } = require('./provider-cache');

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';

function clean(value, max = 520) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalize(value) {
  return clean(value, 220)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|afc|sc|club|de|the|ud|cd)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clamp(value, min, max) {
  const n = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : 0));
}

function nameMentioned(text, playerName) {
  const haystack = normalize(text);
  const name = normalize(playerName);
  if (!haystack || !name) return false;
  return (` ${haystack} `).includes(` ${name} `);
}

function playerStateMentioned(text, playerName) {
  const haystack = ` ${normalize(text)} `;
  const name = normalize(playerName);
  const index = haystack.indexOf(` ${name} `);
  if (index < 0) return false;
  const afterName = haystack.slice(index + name.length + 2);
  return /^(?:(?:is|was|has been|will be|remains|reportedly) )?(?:ruled out|will miss|set to miss|out for|sidelined|unavailable|suspended|banned|doubtful|injured|returns? from injury|back in training|declared fit|cleared to play|available again|recovered|fit again)\b/.test(afterName);
}

function wordNumber(value) {
  const map = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const lower = String(value || '').toLowerCase();
  return map[lower] || Number(lower) || null;
}

function parseDurationDays(text) {
  const lower = String(text || '').toLowerCase();
  if (/rest of (?:the )?season|out for (?:the )?season|season-ending/.test(lower)) return 180;
  const match = lower.match(/(?:out|sidelined|ruled out|miss|missing|absent|injured|suspended|banned)[^.!?]{0,40}?\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s*(day|days|week|weeks|month|months)\b/)
    || lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s*(day|days|week|weeks|month|months)\b/);
  if (!match) return null;
  const amount = wordNumber(match[1]);
  if (!amount) return null;
  const unit = match[2];
  if (unit.startsWith('week')) return amount * 7;
  if (unit.startsWith('month')) return amount * 30;
  return amount;
}

function classifyAvailabilityText(text) {
  const lower = String(text || '').toLowerCase();
  const transfer = /transfer|signing|signs for|bid|fee|deal|linked with|target|rumou?r/.test(lower);
  if (transfer) return { state: 'context', confidence: 0 };

  const positive = /returns? from injury|back in training|declared fit|cleared to play|available again|recovered|fit again/.test(lower);
  if (positive) return { state: 'available', confidence: 0.85 };

  const suspension = /suspended|suspension|one-match ban|two-match ban|match ban|banned|serves? (?:a )?ban|red-card ban/.test(lower);
  const confirmed = /ruled out|will miss|set to miss|out for|sidelined|unavailable|surgery|fracture|torn|suspended|banned|match ban/.test(lower);
  const uncertain = /doubtful|doubt|fitness concern|late fitness test|race against time|questionable|50-50/.test(lower);
  const injury = /injur|hamstring|ankle|knee|calf|groin|muscle|illness|concussion/.test(lower);

  if (suspension || confirmed) return { state: 'out', confidence: suspension ? 0.96 : 0.9, suspension };
  if (uncertain && injury) return { state: 'doubtful', confidence: 0.55, suspension: false };
  if (injury) return { state: 'doubtful', confidence: 0.42, suspension: false };
  return { state: 'context', confidence: 0 };
}

function fixtureHorizon(fixtureDate) {
  const kickoff = new Date(fixtureDate || '').getTime();
  if (!Number.isFinite(kickoff)) return { days: null, weight: 0.65 };
  const days = (kickoff - Date.now()) / 864e5;
  if (days <= 0.5) return { days, weight: 1 };
  if (days <= 2) return { days, weight: 0.98 };
  if (days <= 4) return { days, weight: 0.9 };
  if (days <= 8) return { days, weight: 0.78 };
  return { days, weight: 0.55 };
}

function articleStillApplies(item, text, fixtureDate, state) {
  if (state === 'available' || state === 'context') return true;
  const kickoff = new Date(fixtureDate || '').getTime();
  if (!Number.isFinite(kickoff)) return true;
  const published = new Date(item?.publishedAt || '').getTime();
  const durationDays = parseDurationDays(text);

  if (Number.isFinite(published) && Number.isFinite(durationDays)) {
    const estimatedReturn = published + durationDays * 864e5;
    return estimatedReturn >= kickoff - 6 * 3600e3;
  }

  const lower = String(text || '').toLowerCase();
  if (/rest of (?:the )?season|season-ending/.test(lower)) return true;
  if (/will miss (?:the )?(?:next|upcoming) match|ruled out of|suspended for (?:the )?match/.test(lower)) return true;

  const daysToKickoff = (kickoff - Date.now()) / 864e5;
  if (!Number.isFinite(published)) return daysToKickoff <= 7;
  const articleAgeDays = Math.max(0, (Date.now() - published) / 864e5);
  return daysToKickoff <= 7.5 && articleAgeDays <= 10;
}

function explicitImportance(text) {
  const lower = String(text || '').toLowerCase();
  if (/top scorer|leading scorer|top goalscorer|leading goalscorer|golden boot|main striker|star striker|talisman/.test(lower)) return 1;
  if (/key player|star player|captain|first-choice striker|starting striker/.test(lower)) return 0.78;
  return 0;
}

function attackingRole(text) {
  return /striker|forward|winger|attacker|goalscorer|goal scorer|top scorer|leading scorer|number 9|no\. 9/.test(String(text || '').toLowerCase());
}

function scorerProfile(text, sideName, scorers) {
  const teamRows = (scorers || [])
    .filter((row) => sameTeam(row.team, sideName))
    .sort((a, b) => Number(b.goals || 0) - Number(a.goals || 0));
  if (!teamRows.length) return null;
  const topGoals = Math.max(1, Number(teamRows[0]?.goals || 0));
  const matched = teamRows.find((row) => nameMentioned(text, row.name));
  if (!matched) return null;
  const rank = teamRows.findIndex((row) => row === matched) + 1;
  const goalShare = clamp(Number(matched.goals || 0) / topGoals, 0, 1);
  let importance = clamp(0.42 + goalShare * 0.5, 0.42, 0.92);
  if (rank === 1) importance = 1;
  else if (rank <= 3) importance = Math.max(importance, 0.72);
  return { ...matched, rank, importance };
}

function buildAvailabilityFromNews({ homeName, awayName, fixtureDate, news = [], scorers = [] }) {
  const horizon = fixtureHorizon(fixtureDate);
  const seenPlayers = new Set();
  const result = {
    horizonDays: Number.isFinite(horizon.days) ? Number(horizon.days.toFixed(1)) : null,
    home: { incrementalAttackPct: 0, signals: [] },
    away: { incrementalAttackPct: 0, signals: [] },
    usedSignals: 0,
    scorerReferenceAvailable: Array.isArray(scorers) && scorers.length > 0
  };

  for (const item of news || []) {
    if (item.availabilityEligible === false) continue;
    const text = `${clean(item?.title, 240)} ${clean(item?.summary, 420)}`.trim();
    if (!text) continue;
    const classified = classifyAvailabilityText(text);
    if (classified.state === 'context') continue;
    if (!articleStillApplies(item, text, fixtureDate, classified.state)) continue;

    const sides = Array.isArray(item?.teams) && item.teams.length
      ? item.teams
      : [sameTeam(text, homeName) ? 'home' : null, sameTeam(text, awayName) ? 'away' : null].filter(Boolean);

    for (const side of sides) {
      if (!['home', 'away'].includes(side)) continue;
      const teamName = side === 'home' ? homeName : awayName;
      const scorer = scorerProfile(text, teamName, scorers);
      if (!scorer) continue;
      const playerKey = `${side}:${normalize(scorer.name)}`;
      if (seenPlayers.has(playerKey)) continue;
      const playerStatement = [item.title, ...(String(item.summary || '').split(/[.!?]/))]
        .find(statement => playerStateMentioned(statement, scorer.name) && classifyAvailabilityText(statement).state === classified.state);
      if (!playerStatement) continue;
      const phraseImportance = explicitImportance(text);
      const importance = Math.max(scorer?.importance || 0, phraseImportance);
      const isAttacker = Boolean(scorer) || attackingRole(text) || phraseImportance >= 0.95;
      if (!isAttacker || importance < 0.45) continue;

      const durationDays = parseDurationDays(text);
      const durationConfidence = Number.isFinite(durationDays) ? 1 : 0.78;
      const horizonWeight = Number.isFinite(durationDays) ? Math.max(horizon.weight, 0.9) : horizon.weight;
      const confidence = clamp(classified.confidence * durationConfidence * horizonWeight, 0, 1);

      let incremental = 0;
      if (classified.state === 'out') incremental = -(0.028 + 0.05 * importance) * confidence;
      else if (classified.state === 'doubtful') incremental = -(0.014 + 0.03 * importance) * confidence;
      else if (classified.state === 'available') incremental = (0.012 + 0.022 * importance) * confidence;
      incremental = clamp(incremental, -0.075, 0.04);

      const signal = {
        player: scorer?.name || null,
        goals: Number.isFinite(Number(scorer?.goals)) ? Number(scorer.goals) : null,
        rank: scorer?.rank || null,
        state: classified.state,
        suspension: Boolean(classified.suspension),
        durationDays: Number.isFinite(durationDays) ? durationDays : null,
        importance: Number(importance.toFixed(2)),
        confidence: Number(confidence.toFixed(2)),
        incrementalAttackPct: Math.round(incremental * 100),
        source: item?.source || 'News',
        publishedAt: item?.publishedAt || null,
        summary: clean(item?.summary || item?.title, 180)
      };

      result[side].signals.push(signal);
      seenPlayers.add(playerKey);
      result[side].incrementalAttackPct += incremental * 100;
      result.usedSignals += 1;
    }
  }

  for (const side of ['home', 'away']) {
    result[side].signals.sort((a, b) => Math.abs(b.incrementalAttackPct) - Math.abs(a.incrementalAttackPct));
    result[side].signals = result[side].signals.slice(0, 3);
    result[side].incrementalAttackPct = Math.round(clamp(result[side].incrementalAttackPct, -9, 5));
  }

  return result;
}

async function fetchScorers(competitionCode) {
  if (!competitionCode || !process.env.FOOTBALL_DATA_KEY) return [];
  try {
    const { payload } = await cachedProviderCall({
      cacheKey: `football-data:scorers:v1:${competitionCode}`,
      provider: 'Football-Data scorers',
      ttlSeconds: 21600,
      staleSeconds: 86400,
      loader: async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 9000);
        try {
          const response = await fetch(`${FOOTBALL_DATA_BASE}/competitions/${encodeURIComponent(competitionCode)}/scorers?limit=30`, {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              'X-Auth-Token': process.env.FOOTBALL_DATA_KEY,
              'User-Agent': 'VertexSoccerAI/5.1'
            }
          });
          if (!response.ok) throw new Error(`Football-Data scorers ${response.status}`);
          return response.json();
        } finally {
          clearTimeout(timer);
        }
      }
    });

    return (payload?.scorers || []).map((row) => ({
      name: row?.player?.name || '',
      team: row?.team?.name || '',
      goals: Number(row?.goals || 0),
      assists: Number.isFinite(Number(row?.assists)) ? Number(row.assists) : null,
      penalties: Number.isFinite(Number(row?.penalties)) ? Number(row.penalties) : null
    })).filter((row) => row.name && row.team);
  } catch (_) {
    return [];
  }
}

async function enrichAvailabilityIntelligence(analysis) {
  if (!analysis?.teams?.home?.name || !analysis?.teams?.away?.name) return analysis;
  const code = analysis?.sourceStatus?.competitionCode && !/unknown/i.test(String(analysis.sourceStatus.competitionCode))
    ? String(analysis.sourceStatus.competitionCode)
    : null;
  const scorers = await fetchScorers(code);
  const availability = buildAvailabilityFromNews({
    homeName: analysis.teams.home.name,
    awayName: analysis.teams.away.name,
    fixtureDate: analysis.fixture?.date || null,
    // A published starting XI supersedes an older news absence for that player.
    news: (analysis.news || []).filter(item=>!analysis.matchContext?.lineups?.confirmed ||
      !['home','away'].some(side=>(analysis.matchContext.lineups[side]?.players || []).some(player=>
        String(item.title || '').toLowerCase().includes(player.name.toLowerCase())))),
    scorers
  });

  const homeCombined = Math.round(clamp(availability.home.incrementalAttackPct, -14, 9));
  const awayCombined = Math.round(clamp(availability.away.incrementalAttackPct, -14, 9));

  analysis.newsImpact = {
    ...(analysis.newsImpact || {}),
    homePct: homeCombined,
    awayPct: awayCombined,
    usedSignals: availability.usedSignals,
    verifiedAttribution: availability.usedSignals > 0,
    keyPlayerSignalsUsed: availability.usedSignals,
    appliedToModel: availability.usedSignals > 0
  };

  analysis.squad = {
    ...(analysis.squad || {}),
    structured: Boolean(analysis?.squad?.structured),
    availabilityIntelligence: true,
    forecastHorizonDays: availability.horizonDays,
    scorerReferenceAvailable: availability.scorerReferenceAvailable,
    home: availability.home,
    away: availability.away
  };

  analysis.sourceStatus = {
    ...(analysis.sourceStatus || {}),
    playerAvailability: availability.usedSignals
      ? `News availability + ${availability.scorerReferenceAvailable ? 'Football-Data scorer importance' : 'role/importance cues'}`
      : 'Checked · no key-player availability signal strong enough to alter model'
  };

  return analysis;
}

module.exports = {
  enrichAvailabilityIntelligence,
  buildAvailabilityFromNews,
  parseDurationDays,
  classifyAvailabilityText
};
