'use strict';

const { enrichFootballData } = require('./football-data-enrichment');
const { buildOpenHistoricalContext } = require('./football-data-uk');
const { getNewsIntelligence } = require('./news-intelligence');

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function pct(v) { return Math.round(clamp(v, 0, 1) * 100); }
function factorial(n) { let out = 1; for (let i = 2; i <= n; i++) out *= i; return out; }
function poisson(lambda, k) { return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k); }

function weatherContext(weather, fixtureDate) {
  const out = { adjustment: 0, applied: false, reasons: [] };
  if (!weather || !fixtureDate) return out;
  const kickoff = new Date(fixtureDate).getTime();
  if (!Number.isFinite(kickoff)) return out;

  const hoursToKickoff = Math.abs(kickoff - Date.now()) / 36e5;
  if (hoursToKickoff > 8) return out;

  const condition = String(weather.condition || '').toLowerCase();
  const numeric = value => value == null || value === '' ? NaN : Number(value);
  const wind = numeric(weather.windMs);
  const temp = numeric(weather.tempC);
  const humidity = numeric(weather.humidity);

  if (/thunderstorm|storm|heavy rain|snow|sleet/.test(condition)) {
    out.adjustment -= 0.04;
    out.reasons.push('severe precipitation');
  } else if (/rain|drizzle/.test(condition)) {
    out.adjustment -= 0.02;
    out.reasons.push('rain');
  }

  if (Number.isFinite(wind) && wind >= 10) {
    out.adjustment -= 0.03;
    out.reasons.push('strong wind');
  }

  if (Number.isFinite(temp) && (temp >= 32 || temp <= 0)) {
    out.adjustment -= 0.02;
    out.reasons.push('temperature extreme');
  }

  if (Number.isFinite(humidity) && humidity >= 90 && Number.isFinite(temp) && temp >= 24) {
    out.adjustment -= 0.01;
    out.reasons.push('high humidity');
  }

  out.adjustment = clamp(out.adjustment, -0.08, 0);
  out.applied = Math.abs(out.adjustment) > 0;
  return out;
}

function probabilityModel(home, away, newsImpact = { home: 0, away: 0 }, weatherImpact = { adjustment: 0 }) {
  if ((home?.played || 0) < 3 || (away?.played || 0) < 3 || home.avgFor == null || away.avgFor == null) return null;
  const homeFormBoost = clamp(((home.ppg || 1.2) - 1.35) * 0.08, -0.16, 0.16);
  const awayFormBoost = clamp(((away.ppg || 1.2) - 1.35) * 0.08, -0.16, 0.16);
  const homeNews = clamp(Number(newsImpact.home || 0), -0.08, 0.08);
  const awayNews = clamp(Number(newsImpact.away || 0), -0.08, 0.08);
  const weatherAdj = clamp(Number(weatherImpact.adjustment || 0), -0.08, 0);

  let homeXg = (home.avgFor * 0.56 + away.avgAgainst * 0.44) * 1.08 + homeFormBoost;
  let awayXg = (away.avgFor * 0.56 + home.avgAgainst * 0.44) * 0.94 + awayFormBoost;
  homeXg *= 1 + homeNews - Math.min(0, awayNews) * 0.18;
  awayXg *= 1 + awayNews - Math.min(0, homeNews) * 0.18;
  homeXg *= 1 + weatherAdj;
  awayXg *= 1 + weatherAdj;
  homeXg = clamp(homeXg, 0.2, 4.0);
  awayXg = clamp(awayXg, 0.2, 4.0);

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

  for (let h = 0; h <= 7; h++) {
    for (let a = 0; a <= 7; a++) {
      const p = poisson(homeXg, h) * poisson(awayXg, a);
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
      if (h + a >= 2) over15 += p;
      if (h + a >= 3) over25 += p;
      if (h + a >= 4) over35 += p;
      if (h > 0 && a > 0) btts += p;
      if (h > 0) homeToScore += p;
      if (a > 0) awayToScore += p;
      if (h >= 2) homeOver15 += p;
      if (a >= 2) awayOver15 += p;
      if (a === 0) homeCleanSheet += p;
      if (h === 0) awayCleanSheet += p;
      if (p > best.p) best = { p, home: h, away: a };
    }
  }

  const total = homeWin + draw + awayWin;
  homeWin /= total;
  draw /= total;
  awayWin /= total;
  const dnbTotal = homeWin + awayWin || 1;

  const outcomes = [
    { label: 'Home win', p: homeWin },
    { label: 'Draw', p: draw },
    { label: 'Away win', p: awayWin }
  ].sort((a, b) => b.p - a.p);

  return {
    expectedGoals: { home: homeXg, away: awayXg, total: homeXg + awayXg },
    oneXtwo: { home: homeWin, draw, away: awayWin },
    doubleChance: { oneX: homeWin + draw, xTwo: draw + awayWin, oneTwo: homeWin + awayWin },
    drawNoBet: { home: homeWin / dnbTotal, away: awayWin / dnbTotal },
    over15,
    under15: 1 - over15,
    over25,
    under25: 1 - over25,
    over35,
    under35: 1 - over35,
    btts,
    noBtts: 1 - btts,
    homeToScore,
    awayToScore,
    homeOver15,
    awayOver15,
    homeCleanSheet,
    awayCleanSheet,
    correctScore: `${best.home}-${best.away}`,
    correctScoreProbability: best.p,
    mainOutcome: outcomes[0],
    secondOutcome: outcomes[1],
    separation: outcomes[0].p - outcomes[1].p,
    newsAdjustment: { home: homeNews, away: awayNews },
    weatherAdjustment: weatherAdj
  };
}

function countryCode(name) {
  const map = { Spain: 'ES', England: 'GB', Germany: 'DE', Italy: 'IT', France: 'FR', Netherlands: 'NL', Portugal: 'PT', Brazil: 'BR', Argentina: 'AR', Peru: 'PE', Bolivia: 'BO', Japan: 'JP', Mexico: 'MX', 'United States': 'US' };
  return map[name] || null;
}

function weatherLooksWrong(weather, homeCountry) {
  if (!weather?.location || !homeCountry) return false;
  const expected = countryCode(homeCountry);
  if (!expected) return false;
  const suffix = String(weather.location).match(/,\s*([A-Z]{2})\s*$/)?.[1];
  return Boolean(suffix && suffix !== expected);
}

async function enhanceAnalysis(base) {
  if (!base?.teams?.home?.name || !base?.teams?.away?.name) return base;
  const homeName = base.teams.home.name;
  const awayName = base.teams.away.name;
  const league = base.fixture?.league || '';

  const [fd, newsIntel, openHistory] = await Promise.all([
    enrichFootballData(homeName, awayName, league, base.teams.home.country || ''),
    getNewsIntelligence(homeName, awayName),
    buildOpenHistoricalContext(homeName, awayName, league, base.teams.home.country || '', base.fixture?.date).catch(() => ({ok:false,reason:'upstream_unavailable'}))
  ]);

  if (fd.ok) {
    const oldHome = base.form?.home?.played || 0;
    const oldAway = base.form?.away?.played || 0;
    if ((fd.homeForm?.played || 0) > oldHome) base.form.home = fd.homeForm;
    if ((fd.awayForm?.played || 0) > oldAway) base.form.away = fd.awayForm;
    if (fd.fixture) {
      base.fixture = {
        ...base.fixture,
        date: fd.fixture.date || base.fixture?.date || null,
        league: fd.fixture.league || base.fixture?.league || null,
        source: 'Football-Data'
      };
    }
    base.sourceStatus = { ...(base.sourceStatus || {}), footballData: 'Connected', competitionCode: fd.code };
    if ((fd.homeForm?.played || 0) || (fd.awayForm?.played || 0)) base.sourceStatus.primaryFootball = 'Football-Data';

    // Keep the richer context from this same provider call so the final model
    // does not need to repeat an identical enrichment pass later.
    if (fd.advanced) base.advanced = fd.advanced;
    if (fd.leagueContext) base.leagueContext = fd.leagueContext;
    if (fd.h2h) base.h2h = fd.h2h;
    if (fd.penaltyModel?.ok) base.penaltyModel = fd.penaltyModel;
    base.sourceStatus.vertexModelContext = fd.crossCompetitionForm
      ? 'Football-Data cross-competition form + competition baseline + H2H'
      : 'Football-Data competition form + league baseline + H2H';
  } else {
    base.sourceStatus = { ...(base.sourceStatus || {}), footballData: fd.reason || 'Unavailable', competitionCode: fd.code || 'Unknown' };
  }

  const openMin = Math.min(openHistory.homeForm?.played || 0, openHistory.awayForm?.played || 0);
  const currentMin = Math.min(base.form?.home?.played || 0, base.form?.away?.played || 0);
  if (openHistory.ok && (openMin > currentMin || !base.leagueContext)) {
    base.form = { home: openHistory.homeForm, away: openHistory.awayForm };
    base.advanced = openHistory.advanced;
    base.leagueContext = openHistory.leagueContext;
    base.h2h = openHistory.h2h;
    base.history = openHistory.history;
    base.sourceStatus.primaryFootball = 'Football-Data.co.uk';
    base.sourceStatus.vertexModelContext = 'Football-Data.co.uk · verified results, venue splits and league baseline';
  }
  base.sourceStatus.openResults = openHistory.ok ? `Football-Data.co.uk · ${openHistory.code}` : openHistory.reason;

  base.news = newsIntel.items;
  base.newsImpact = {
    homePct: Math.round(newsIntel.impact.home * 100),
    awayPct: Math.round(newsIntel.impact.away * 100),
    usedSignals: newsIntel.impact.usedSignals,
    appliedToModel: false
  };
  base.sourceStatus.news = newsIntel.items.length ? 'NewsAPI · summarized' : 'Unavailable';

  if (weatherLooksWrong(base.weather, base.teams.home.country)) {
    base.weather = null;
    base.sourceStatus.weather = 'Withheld · venue geocode mismatch';
  }

  const weatherIntel = weatherContext(base.weather, base.fixture?.date);
  base.weatherImpact = {
    appliedToModel: weatherIntel.applied,
    goalEnvironmentPct: Math.round(weatherIntel.adjustment * 100),
    reasons: weatherIntel.reasons
  };

  const homeForm = base.form?.home || {};
  const awayForm = base.form?.away || {};
  const model = probabilityModel(homeForm, awayForm, newsIntel.impact, weatherIntel);

  if (model) {
    base.model = {
      expectedGoals: {
        home: Number(model.expectedGoals.home.toFixed(2)),
        away: Number(model.expectedGoals.away.toFixed(2)),
        total: Number(model.expectedGoals.total.toFixed(2))
      },
      oneXtwo: {
        home: pct(model.oneXtwo.home),
        draw: pct(model.oneXtwo.draw),
        away: pct(model.oneXtwo.away)
      },
      doubleChance: {
        oneX: pct(model.doubleChance.oneX),
        xTwo: pct(model.doubleChance.xTwo),
        oneTwo: pct(model.doubleChance.oneTwo)
      },
      drawNoBet: {
        home: pct(model.drawNoBet.home),
        away: pct(model.drawNoBet.away)
      },
      over25: pct(model.over25),
      under25: pct(model.under25),
      btts: pct(model.btts),
      noBtts: pct(model.noBtts),
      correctScore: model.correctScore,
      correctScoreProbability: pct(model.correctScoreProbability),
      mainScenario: model.mainOutcome.label,
      extended: {
        over15: pct(model.over15),
        under15: pct(model.under15),
        over35: pct(model.over35),
        under35: pct(model.under35),
        homeToScore: pct(model.homeToScore),
        awayToScore: pct(model.awayToScore),
        homeOver15: pct(model.homeOver15),
        awayOver15: pct(model.awayOver15),
        homeCleanSheet: pct(model.homeCleanSheet),
        awayCleanSheet: pct(model.awayCleanSheet)
      },
      contextAdjustments: {
        newsHomePct: Math.round(model.newsAdjustment.home * 100),
        newsAwayPct: Math.round(model.newsAdjustment.away * 100),
        newsSignalsUsed: newsIntel.impact.usedSignals,
        weatherGoalEnvironmentPct: Math.round(model.weatherAdjustment * 100)
      }
    };

    const qualityBase = Math.min(48, (homeForm.played || 0) * 4 + (awayForm.played || 0) * 4);
    const context = (base.fixture?.date ? 14 : 0) + (base.weather ? 5 : 0) + (newsIntel.items.length ? 8 : 0) + (fd.ok ? 10 : 4);
    base.dataQuality = clamp(18 + qualityBase + context, 0, 92);
    base.confidence = clamp(Math.round(pct(model.mainOutcome.p) * (0.64 + base.dataQuality / 100 * 0.36) + model.separation * 18), 35, 94);
    base.newsImpact.appliedToModel = newsIntel.impact.usedSignals > 0;
  } else {
    base.model = null;
    base.confidence = null;
  }

  base.marketCoverage = {
    core: ['1X2', 'Double Chance', 'Goals', 'BTTS', 'Team Goals', 'Clean Sheet'],
    granular: {
      corners: false,
      cards: false,
      penalties: false,
      shots: false,
      offsides: false,
      reason: 'Detailed historical event-stat feed is not connected yet.'
    }
  };

  const keep = (base.limitations || []).filter((x) => !/recent-form sample|not enough completed-match data|recent news/i.test(x));
  if ((homeForm.played || 0) < 5 || (awayForm.played || 0) < 5) keep.push(`Recent-form sample is limited (${homeForm.played || 0} / ${awayForm.played || 0} completed matches).`);
  if (!model) keep.push('At least three completed matches per team are required before Vertex calculates probabilities.');
  if (!newsIntel.items.length) keep.push('No sufficiently relevant recent news was included.');
  else if (!newsIntel.impact.usedSignals) keep.push('Recent news was reviewed, but none was strong enough to alter the model.');
  if (!weatherIntel.applied && base.weather) keep.push('Weather was checked but was not severe enough, or close enough to kickoff, to alter the model.');
  base.limitations = [...new Set(keep)];

  return base;
}

module.exports = { enhanceAnalysis, weatherContext, weatherLooksWrong };
