'use strict';

const MODEL_VERSION = 'Vertex Model 2.4';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
}

function finite(value, fallback = null) {
  if (value == null || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pct(value) {
  return Math.round(clamp(value, 0, 1) * 100);
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function factorial(n) {
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
}

function poisson(lambda, k) {
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
}

function sampleReliability(sample) {
  const n = Math.max(0, finite(sample, 0));
  return clamp((n - 2) / 10, 0, 1);
}

function shrinkRatio(value, baseline, reliability) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline <= 0) return 1;
  const raw = clamp(value / baseline, 0.45, 1.8);
  return 1 + (raw - 1) * clamp(reliability, 0, 1);
}

function dixonColesTau(homeGoals, awayGoals, homeLambda, awayLambda, rho) {
  if (homeGoals === 0 && awayGoals === 0) return 1 - homeLambda * awayLambda * rho;
  if (homeGoals === 0 && awayGoals === 1) return 1 + homeLambda * rho;
  if (homeGoals === 1 && awayGoals === 0) return 1 + awayLambda * rho;
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
  return 1;
}

function scoreDistribution(homeLambda, awayLambda, rho = -0.06, maxGoals = 16) {
  const cells = [];
  let total = 0;
  for (let home = 0; home <= maxGoals; home++) {
    for (let away = 0; away <= maxGoals; away++) {
      const raw = poisson(homeLambda, home) * poisson(awayLambda, away);
      const adjusted = Math.max(0, raw * dixonColesTau(home, away, homeLambda, awayLambda, rho));
      cells.push({ home, away, raw: adjusted });
      total += adjusted;
    }
  }
  const denom = total || 1;
  return cells.map((cell) => ({ ...cell, p: cell.raw / denom }));
}

function probabilitiesFromDistribution(cells) {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let btts = 0;
  let homeToScore = 0;
  let awayToScore = 0;
  let homeOver15 = 0;
  let awayOver15 = 0;
  let homeCleanSheet = 0;
  let awayCleanSheet = 0;
  let best = { p: 0, home: 0, away: 0 };

  for (const cell of cells) {
    const { home, away, p } = cell;
    if (home > away) homeWin += p;
    else if (home === away) draw += p;
    else awayWin += p;
    if (home + away >= 2) over15 += p;
    if (home + away >= 3) over25 += p;
    if (home + away >= 4) over35 += p;
    if (home > 0 && away > 0) btts += p;
    if (home > 0) homeToScore += p;
    if (away > 0) awayToScore += p;
    if (home >= 2) homeOver15 += p;
    if (away >= 2) awayOver15 += p;
    if (away === 0) homeCleanSheet += p;
    if (home === 0) awayCleanSheet += p;
    if (p > best.p) best = { p, home, away };
  }

  return {
    homeWin, draw, awayWin,
    over15, over25, over35,
    btts, homeToScore, awayToScore,
    homeOver15, awayOver15,
    homeCleanSheet, awayCleanSheet,
    best
  };
}

function teamState(form = {}, advanced = {}, venue = 'overall', leagueTeamGoals = 1.3) {
  const sample = finite(advanced.sample, finite(form.played, 0));
  const reliability = finite(advanced.sampleReliability, sampleReliability(sample));
  const weightedFor = finite(advanced.weightedAvgFor, finite(form.avgFor, leagueTeamGoals));
  const weightedAgainst = finite(advanced.weightedAvgAgainst, finite(form.avgAgainst, leagueTeamGoals));
  const weightedPpg = finite(advanced.weightedPpg, finite(form.ppg, 1.35));
  const venueBlock = advanced.venue || {};
  const venueSample = finite(venueBlock.matches, 0);
  const venueRel = sampleReliability(venueSample);
  const venueFor = finite(venueBlock.avgFor, null);
  const venueAgainst = finite(venueBlock.avgAgainst, null);
  const venuePpg = finite(venueBlock.ppg, null);

  const venueBlend = venueSample >= 3 ? Math.min(0.58, 0.25 + venueRel * 0.33) : 0;
  const attackRate = Number.isFinite(venueFor)
    ? weightedFor * (1 - venueBlend) + venueFor * venueBlend
    : weightedFor;
  const defenceRate = Number.isFinite(venueAgainst)
    ? weightedAgainst * (1 - venueBlend) + venueAgainst * venueBlend
    : weightedAgainst;
  const ppg = Number.isFinite(venuePpg)
    ? weightedPpg * (1 - venueBlend) + venuePpg * venueBlend
    : weightedPpg;

  return {
    venue,
    sample,
    reliability,
    attackRate,
    defenceRate,
    ppg,
    attackStrength: shrinkRatio(attackRate, leagueTeamGoals, reliability),
    defenceWeakness: shrinkRatio(defenceRate, leagueTeamGoals, reliability),
    opponentStrength: finite(advanced.opponentStrength, 1.35),
    scoringRate: finite(advanced.scoringRate, null),
    cleanSheetRate: finite(advanced.cleanSheetRate, null),
    restDays: finite(advanced.restDays, null),
    matches7: finite(advanced.matches7, 0),
    matches14: finite(advanced.matches14, 0),
    matches30: finite(advanced.matches30, 0)
  };
}

function fatigueAdjustment(state) {
  let adjustment = 0;
  const reasons = [];
  if (Number.isFinite(state.restDays)) {
    if (state.restDays <= 2) { adjustment -= 0.08; reasons.push('very short rest'); }
    else if (state.restDays <= 3) { adjustment -= 0.045; reasons.push('short rest'); }
    else if (state.restDays >= 7) { adjustment += 0.012; reasons.push('full recovery window'); }
  }
  if (state.matches7 >= 3) { adjustment -= 0.055; reasons.push('3+ matches in 7 days'); }
  else if (state.matches14 >= 5) { adjustment -= 0.035; reasons.push('dense 14-day schedule'); }
  return { adjustment: clamp(adjustment, -0.12, 0.03), reasons };
}

function granularPressure(granular) {
  if (!granular?.ok || granular.forecastsAvailable === false) return { shift: 0, available: false, reason: null };
  const homeSot = finite(granular?.shotsOnTarget?.expectedHome, null);
  const awaySot = finite(granular?.shotsOnTarget?.expectedAway, null);
  if (!Number.isFinite(homeSot) || !Number.isFinite(awaySot) || homeSot + awaySot <= 0) {
    return { shift: 0, available: false, reason: null };
  }
  const share = homeSot / (homeSot + awaySot);
  const shift = clamp((share - 0.5) * 0.18, -0.055, 0.055);
  return { shift, available: true, reason: `expected shots-on-target share ${Math.round(share * 100)}%/${100 - Math.round(share * 100)}%` };
}

function h2hAdjustment(h2h) {
  const sample = finite(h2h?.sample, 0);
  if (sample < 2) return { shift: 0, available: false };
  const homePpg = finite(h2h?.homePpg, 1.5);
  const awayPpg = finite(h2h?.awayPpg, 1.5);
  const shift = clamp(((homePpg - awayPpg) / 3) * 0.025, -0.025, 0.025);
  return { shift, available: true };
}

function leagueContext(analysis) {
  const ctx = analysis?.leagueContext || {};
  const homeGoals = clamp(finite(ctx.homeGoals, 1.45), 0.7, 2.4);
  const awayGoals = clamp(finite(ctx.awayGoals, 1.18), 0.55, 2.1);
  const teamGoalAvg = clamp(finite(ctx.teamGoalAvg, (homeGoals + awayGoals) / 2), 0.7, 2.1);
  return {
    homeGoals,
    awayGoals,
    teamGoalAvg,
    sample: finite(ctx.sample, 0),
    homeWinRate: finite(ctx.homeWinRate, null),
    drawRate: finite(ctx.drawRate, null),
    awayWinRate: finite(ctx.awayWinRate, null)
  };
}

function pushDriver(drivers, driver) {
  if (!driver || !driver.reason) return;
  drivers.push({
    key: driver.key,
    label: driver.label,
    scope: driver.scope || 'outcome',
    side: driver.side || 'neutral',
    magnitudePct: Math.round(Math.abs(finite(driver.magnitude, 0)) * 100),
    reason: driver.reason,
    source: driver.source || 'Vertex'
  });
}

function qualityScore(analysis, home, away, league, pressure, h2h) {
  const minReliability = Math.min(home.reliability, away.reliability);
  const newsReviewed = (analysis?.news || []).some(item => item.relevanceVerified === true);
  const metadata = Boolean(analysis?.teams?.home?.badge && analysis?.teams?.away?.badge);
  const venueSplits = Boolean((analysis?.advanced?.home?.venue?.matches || 0) >= 3 && (analysis?.advanced?.away?.venue?.matches || 0) >= 3);
  const structuredSquad = Boolean(analysis?.squad?.structured === true);

  const breakdown = {
    recentForm: Math.round(25 * minReliability),
    leagueContext: league.sample >= 30 ? 15 : league.sample >= 12 ? 9 : 0,
    opponentStrength: ['home','away'].every(side => (analysis?.advanced?.[side]?.opponentSample || 0) >= 3) ? 10 : 0,
    venueSplits: venueSplits ? 10 : 0,
    fixtureResolved: analysis?.fixture?.date ? 8 : 0,
    newsReviewed: newsReviewed ? 7 : 0,
    weather: analysis?.weather && analysis.fixture?.date && Math.abs(Date.parse(analysis.fixture.date) - Date.now()) <= 8 * 36e5 ? 4 : 0,
    granularStats: pressure.available || (analysis?.granularModel?.ok && analysis.granularModel.forecastsAvailable !== false) ? 10 : 0,
    h2h: h2h.available ? 3 : 0,
    teamMetadata: metadata ? 5 : 0,
    structuredSquad: structuredSquad ? 3 : 0
  };
  const total = clamp(Object.values(breakdown).reduce((sum, value) => sum + value, 0), 0, 100);
  return { total: Math.round(total), breakdown, structuredSquad };
}

function decisionLayer(model, dataQuality, confidence) {
  if (!model) return { action: 'PASS', market: null, selection: null, probability: null, reason: 'Insufficient verified match data.' };
  const candidates = [
    { market: '1X2', selection: 'HOME', probability: model.oneXtwo.home },
    { market: '1X2', selection: 'DRAW', probability: model.oneXtwo.draw },
    { market: '1X2', selection: 'AWAY', probability: model.oneXtwo.away },
    { market: 'DOUBLE_CHANCE', selection: '1X', probability: model.doubleChance.oneX },
    { market: 'DOUBLE_CHANCE', selection: 'X2', probability: model.doubleChance.xTwo },
    { market: 'GOALS_OU_2_5', selection: 'OVER', probability: model.over25 },
    { market: 'GOALS_OU_2_5', selection: 'UNDER', probability: model.under25 },
    { market: 'BTTS', selection: 'YES', probability: model.btts },
    { market: 'BTTS', selection: 'NO', probability: model.noBtts }
  ].filter((row) => Number.isFinite(row.probability)).sort((a, b) => b.probability - a.probability);

  const best = candidates[0] || null;
  if (!best) return { action: 'PASS', market: null, selection: null, probability: null, reason: 'No supported market probability.' };
  if (dataQuality < 62 || confidence < 58) {
    return { action: 'PASS', ...best, reason: 'Data quality or model confidence is below the Vertex threshold.' };
  }
  if (dataQuality >= 78 && confidence >= 74 && best.probability >= 75) {
    return { action: 'STRONG WATCH', ...best, reason: 'Strong probability signal with high data coverage. Odds are still required before any value decision.' };
  }
  if (best.probability >= 66) {
    return { action: 'WATCH', ...best, reason: 'Supported probability signal. Vertex does not call this value without market odds.' };
  }
  return { action: 'PASS', ...best, reason: 'No supported market is strong enough to clear the watch threshold.' };
}

function buildVertexModelV2(analysis) {
  const homeForm = analysis?.form?.home || {};
  const awayForm = analysis?.form?.away || {};
  const validForm = (form) => finite(form.played, 0) >= 3 && ['avgFor', 'avgAgainst'].every((key) => finite(form[key]) != null && finite(form[key]) >= 0);
  if (!validForm(homeForm) || !validForm(awayForm)) {
    return {
      model: null,
      dataQuality: 0,
      confidence: null,
      meta: {
        version: MODEL_VERSION,
        decision: { action: 'PASS', market: null, selection: null, probability: null, reason: 'At least three verified completed matches per team are required.' },
        coverage: { recentForm: false },
        drivers: []
      }
    };
  }

  const league = leagueContext(analysis);
  const home = teamState(homeForm, analysis?.advanced?.home || {}, 'home', league.teamGoalAvg);
  const away = teamState(awayForm, analysis?.advanced?.away || {}, 'away', league.teamGoalAvg);
  const drivers = [];
  const formSource = analysis.sourceStatus?.primaryFootball || 'Verified match history';

  let homeLambda = league.homeGoals * Math.sqrt(home.attackStrength * away.defenceWeakness);
  let awayLambda = league.awayGoals * Math.sqrt(away.attackStrength * home.defenceWeakness);

  const ppgDiff = clamp((home.ppg - away.ppg) / 3, -1, 1);
  const formTilt = ppgDiff * 0.075;
  homeLambda *= Math.exp(formTilt);
  awayLambda *= Math.exp(-formTilt);
  if (Math.abs(formTilt) >= 0.008) {
    pushDriver(drivers, {
      key: 'form', label: 'Opponent-adjusted recent form', side: formTilt > 0 ? 'home' : 'away', magnitude: formTilt,
      reason: `weighted PPG ${round(home.ppg, 2)} vs ${round(away.ppg, 2)}`, source: formSource
    });
  }

  const opponentDiff = clamp((home.opponentStrength - away.opponentStrength) / 3, -0.4, 0.4);
  const scheduleTilt = opponentDiff * 0.045;
  homeLambda *= Math.exp(scheduleTilt);
  awayLambda *= Math.exp(-scheduleTilt);
  if (Math.abs(scheduleTilt) >= 0.006) {
    pushDriver(drivers, {
      key: 'schedule-strength', label: 'Strength of recent opposition', side: scheduleTilt > 0 ? 'home' : 'away', magnitude: scheduleTilt,
      reason: `opponent PPG ${round(home.opponentStrength, 2)} vs ${round(away.opponentStrength, 2)}`, source: formSource
    });
  }

  const homeFatigue = analysis.advanced?.home?.scheduleVerified === true ? fatigueAdjustment(home) : {adjustment:0,reasons:[]};
  const awayFatigue = analysis.advanced?.away?.scheduleVerified === true ? fatigueAdjustment(away) : {adjustment:0,reasons:[]};
  homeLambda *= 1 + homeFatigue.adjustment;
  awayLambda *= 1 + awayFatigue.adjustment;
  if (homeFatigue.adjustment) pushDriver(drivers, { key: 'home-fatigue', label: 'Home recovery / congestion', side: homeFatigue.adjustment > 0 ? 'home' : 'away', magnitude: homeFatigue.adjustment, reason: homeFatigue.reasons.join(', '), source: formSource });
  if (awayFatigue.adjustment) pushDriver(drivers, { key: 'away-fatigue', label: 'Away recovery / congestion', side: awayFatigue.adjustment > 0 ? 'away' : 'home', magnitude: awayFatigue.adjustment, reason: awayFatigue.reasons.join(', '), source: formSource });

  const newsVerified = analysis?.newsImpact?.verifiedAttribution === true;
  const newsHome = newsVerified ? clamp(finite(analysis?.newsImpact?.homePct, 0) / 100, -0.08, 0.08) : 0;
  const newsAway = newsVerified ? clamp(finite(analysis?.newsImpact?.awayPct, 0) / 100, -0.08, 0.08) : 0;
  homeLambda *= 1 + newsHome + Math.max(0, -newsAway) * 0.22;
  awayLambda *= 1 + newsAway + Math.max(0, -newsHome) * 0.22;
  if (Math.abs(newsHome) >= 0.005) pushDriver(drivers, { key: 'news-home', label: 'Home availability / news', side: newsHome > 0 ? 'home' : 'away', magnitude: newsHome, reason: `${Math.abs(Math.round(newsHome * 100))}% verified news adjustment`, source: 'News intelligence' });
  if (Math.abs(newsAway) >= 0.005) pushDriver(drivers, { key: 'news-away', label: 'Away availability / news', side: newsAway > 0 ? 'away' : 'home', magnitude: newsAway, reason: `${Math.abs(Math.round(newsAway * 100))}% verified news adjustment`, source: 'News intelligence' });

  const weather = clamp(finite(analysis?.weatherImpact?.goalEnvironmentPct, 0) / 100, -0.08, 0.02);
  homeLambda *= 1 + weather;
  awayLambda *= 1 + weather;
  if (Math.abs(weather) >= 0.005) pushDriver(drivers, { key: 'weather', label: 'Weather goal environment', scope: 'goals', side: 'neutral', magnitude: weather, reason: (analysis?.weatherImpact?.reasons || []).join(', ') || 'verified weather conditions', source: 'OpenWeather' });

  const pressure = granularPressure(analysis?.granularModel);
  if (pressure.available) {
    homeLambda *= 1 + pressure.shift;
    awayLambda *= 1 - pressure.shift;
    pushDriver(drivers, { key: 'shot-pressure', label: 'Shot-on-target pressure', side: pressure.shift >= 0 ? 'home' : 'away', magnitude: pressure.shift, reason: pressure.reason, source: analysis?.granularModel?.source || 'event stats' });
  }

  const h2h = h2hAdjustment(analysis?.h2h);
  if (h2h.available && Math.abs(h2h.shift) >= 0.004) {
    homeLambda *= 1 + h2h.shift;
    awayLambda *= 1 - h2h.shift;
    pushDriver(drivers, { key: 'h2h', label: 'Recent head-to-head', side: h2h.shift > 0 ? 'home' : 'away', magnitude: h2h.shift, reason: `${analysis.h2h.sample} recent meetings; capped low-weight signal`, source: formSource });
  }

  homeLambda = clamp(homeLambda, 0.25, 3.8);
  awayLambda = clamp(awayLambda, 0.25, 3.8);

  const distribution = scoreDistribution(homeLambda, awayLambda);
  const topScores = [...distribution].sort((a, b) => b.p - a.p).slice(0, 5);
  const probability = predicate => round(distribution.reduce((sum, cell) => sum + (predicate(cell) ? cell.p : 0), 0) * 100, 1);
  const probs = probabilitiesFromDistribution(distribution);
  const dnbTotal = probs.homeWin + probs.awayWin || 1;
  const outcomes = [
    { label: 'Home win', p: probs.homeWin },
    { label: 'Draw', p: probs.draw },
    { label: 'Away win', p: probs.awayWin }
  ].sort((a, b) => b.p - a.p);

  const model = {
    engineVersion: MODEL_VERSION,
    expectedGoals: { home: round(homeLambda), away: round(awayLambda), total: round(homeLambda + awayLambda) },
    oneXtwo: { home: pct(probs.homeWin), draw: pct(probs.draw), away: pct(probs.awayWin) },
    doubleChance: { oneX: pct(probs.homeWin + probs.draw), xTwo: pct(probs.draw + probs.awayWin), oneTwo: pct(probs.homeWin + probs.awayWin) },
    drawNoBet: { home: pct(probs.homeWin / dnbTotal), away: pct(probs.awayWin / dnbTotal) },
    over25: pct(probs.over25), under25: pct(1 - probs.over25),
    btts: pct(probs.btts), noBtts: pct(1 - probs.btts),
    correctScore: `${probs.best.home}-${probs.best.away}`,
    correctScoreProbability: pct(probs.best.p),
    scoreScenarios: topScores.map(cell => ({ score: `${cell.home}-${cell.away}`, probability: round(cell.p * 100, 1) })),
    otherScoreProbability: round((1 - topScores.reduce((sum, cell) => sum + cell.p, 0)) * 100, 1),
    handicapLines: [-2.5, -1.5, -.5, .5, 1.5, 2.5].map(line => {
      const home = probability(cell => cell.home + line > cell.away);
      return { line, home, away: round(100 - home, 1) };
    }),
    winningMargins: {
      homeOne: probability(cell => cell.home - cell.away === 1),
      homeTwo: probability(cell => cell.home - cell.away === 2),
      homeThreePlus: probability(cell => cell.home - cell.away >= 3),
      draw: probability(cell => cell.home === cell.away),
      awayOne: probability(cell => cell.away - cell.home === 1),
      awayTwo: probability(cell => cell.away - cell.home === 2),
      awayThreePlus: probability(cell => cell.away - cell.home >= 3)
    },
    goalLines: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5].map((line) => {
      const over = pct(distribution.reduce((sum, cell) => sum + (cell.home + cell.away > line ? cell.p : 0), 0));
      return { line, over, under: 100 - over };
    }),
    teamGoalLines: Object.fromEntries(['home', 'away'].map((side) => [side, [0.5, 1.5, 2.5].map((line) => {
      const over = pct(distribution.reduce((sum, cell) => sum + (cell[side] > line ? cell.p : 0), 0));
      return { line, over, under: 100 - over };
    })])),
    mainScenario: outcomes[0].label,
    extended: {
      over15: pct(probs.over15), under15: pct(1 - probs.over15),
      over35: pct(probs.over35), under35: pct(1 - probs.over35),
      homeToScore: pct(probs.homeToScore), awayToScore: pct(probs.awayToScore),
      homeOver15: pct(probs.homeOver15), awayOver15: pct(probs.awayOver15),
      homeCleanSheet: pct(probs.homeCleanSheet), awayCleanSheet: pct(probs.awayCleanSheet)
    },
    contextAdjustments: {
      newsHomePct: Math.round(newsHome * 100), newsAwayPct: Math.round(newsAway * 100),
      weatherGoalEnvironmentPct: Math.round(weather * 100),
      shotPressurePct: Math.round(pressure.shift * 100),
      h2hTiltPct: Math.round(h2h.shift * 100)
    }
  };

  const quality = qualityScore(analysis, home, away, league, pressure, h2h);
  const separation = Math.max(0, outcomes[0].p - outcomes[1].p);
  const confidence = Math.round(clamp(25 + quality.total * 0.6 + separation * 30, 30, 92));
  const decision = decisionLayer(model, quality.total, confidence);

  return {
    model,
    dataQuality: quality.total,
    confidence,
    meta: {
      version: MODEL_VERSION,
      decision,
      drivers: drivers.sort((a, b) => b.magnitudePct - a.magnitudePct),
      qualityBreakdown: quality.breakdown,
      coverage: {
        recentForm: Math.min(home.sample, away.sample) >= 3,
        opponentAdjustedForm: quality.breakdown.opponentStrength > 0,
        homeAwaySplits: Boolean((analysis?.advanced?.home?.venue?.matches || 0) >= 3 && (analysis?.advanced?.away?.venue?.matches || 0) >= 3),
        leagueBaseline: league.sample >= 12,
        fixture: Boolean(analysis?.fixture?.date),
        news: quality.breakdown.newsReviewed > 0,
        structuredInjuriesAndLineups: quality.structuredSquad,
        weather: quality.breakdown.weather > 0,
        granularEventStats: Boolean(analysis?.granularModel?.ok && analysis.granularModel.forecastsAvailable !== false),
        h2h: h2h.available
      },
      teamPower: {
        home: { attack: round(home.attackStrength, 3), defenceWeakness: round(home.defenceWeakness, 3), weightedPpg: round(home.ppg), opponentStrength: round(home.opponentStrength), restDays: home.restDays, matches7: home.matches7 },
        away: { attack: round(away.attackStrength, 3), defenceWeakness: round(away.defenceWeakness, 3), weightedPpg: round(away.ppg), opponentStrength: round(away.opponentStrength), restDays: away.restDays, matches7: away.matches7 }
      },
      calibration: 'Initial deterministic ensemble weights. Probabilities are recorded for post-match calibration before any automated retraining is promoted.'
    }
  };
}

function finalizeVertexModelV2(analysis) {
  if (!analysis || typeof analysis !== 'object') return analysis;
  const result = buildVertexModelV2(analysis);
  analysis.model = result.model;
  analysis.dataQuality = result.dataQuality;
  analysis.confidence = result.confidence;
  analysis.vertexModel = result.meta;
  analysis.engine = { ...(analysis.engine || {}), modelVersion: MODEL_VERSION, calibratedFromOwnHistory: false };
  const missingTeams = ['home', 'away'].filter(side => analysis.teams?.[side]?.resolved === false).map(side => analysis.teams[side].name);
  const accessLimited = Object.values(analysis.sourceStatus || {}).some(value => /account_suspended|quota_exhausted|subscription_coverage|access_denied/.test(String(value)));
  analysis.availability = { code: result.model ? 'ready' : missingTeams.length ? 'team_unresolved' : accessLimited ? 'source_access_limited' : 'insufficient_history', missingTeams };

  analysis.marketCoverage = {
    ...(analysis.marketCoverage || {}),
    core: result.model ? ['1X2', 'Double Chance', 'Draw No Bet', 'Goals', 'BTTS', 'Team Goals', 'Clean Sheet', 'Score Scenarios', 'Half-goal Handicaps', 'Winning Margins'] : []
  };

  const limitations = Array.isArray(analysis.limitations) ? analysis.limitations.filter((item) => !/at least three (?:verified )?completed matches|recent-form sample|not enough completed-match data|structured injury and confirmed-lineup/i.test(String(item))) : [];
  if (Math.min(analysis.form?.home?.played || 0, analysis.form?.away?.played || 0) < 5) limitations.push(`Recent-form sample is limited (${analysis.form?.home?.played || 0} / ${analysis.form?.away?.played || 0} completed matches).`);
  if (!result.model) limitations.push('At least three verified completed matches per team with valid goals scored and conceded are required before Vertex calculates probabilities.');
  if (!result.meta.coverage.structuredInjuriesAndLineups) limitations.push('Structured injury and confirmed-lineup feeds are not yet available for this fixture; only verified news availability signals are applied.');
  analysis.limitations = [...new Set(limitations)];
  return analysis;
}

module.exports = {
  MODEL_VERSION,
  buildVertexModelV2,
  finalizeVertexModelV2,
  scoreDistribution,
  probabilitiesFromDistribution
};
