'use strict';

const { enrichFootballData } = require('./football-data-enrichment');
const { getNewsIntelligence } = require('./news-intelligence');

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function pct(v) { return Math.round(clamp(v, 0, 1) * 100); }
function factorial(n) { let out = 1; for (let i = 2; i <= n; i++) out *= i; return out; }
function poisson(lambda, k) { return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k); }

function probabilityModel(home, away, newsImpact = { home: 0, away: 0 }) {
  if ((home?.played || 0) < 3 || (away?.played || 0) < 3 || home.avgFor == null || away.avgFor == null) return null;
  const homeFormBoost = clamp(((home.ppg || 1.2) - 1.35) * 0.08, -0.16, 0.16);
  const awayFormBoost = clamp(((away.ppg || 1.2) - 1.35) * 0.08, -0.16, 0.16);
  const homeNews = clamp(Number(newsImpact.home || 0), -0.08, 0.08);
  const awayNews = clamp(Number(newsImpact.away || 0), -0.08, 0.08);

  let homeXg = (home.avgFor * 0.56 + away.avgAgainst * 0.44) * 1.08 + homeFormBoost;
  let awayXg = (away.avgFor * 0.56 + home.avgAgainst * 0.44) * 0.94 + awayFormBoost;
  homeXg *= 1 + homeNews - Math.min(0, awayNews) * 0.18;
  awayXg *= 1 + awayNews - Math.min(0, homeNews) * 0.18;
  homeXg = clamp(homeXg, 0.2, 4.0); awayXg = clamp(awayXg, 0.2, 4.0);

  let homeWin = 0, draw = 0, awayWin = 0, over25 = 0, btts = 0, best = { p: 0, home: 0, away: 0 };
  for (let h = 0; h <= 7; h++) for (let a = 0; a <= 7; a++) {
    const p = poisson(homeXg, h) * poisson(awayXg, a);
    if (h > a) homeWin += p; else if (h === a) draw += p; else awayWin += p;
    if (h + a >= 3) over25 += p; if (h > 0 && a > 0) btts += p;
    if (p > best.p) best = { p, home: h, away: a };
  }
  const total = homeWin + draw + awayWin; homeWin /= total; draw /= total; awayWin /= total;
  const outcomes = [
    { label: 'Home win', p: homeWin }, { label: 'Draw', p: draw }, { label: 'Away win', p: awayWin }
  ].sort((a, b) => b.p - a.p);
  return {
    expectedGoals: { home: homeXg, away: awayXg, total: homeXg + awayXg },
    oneXtwo: { home: homeWin, draw, away: awayWin },
    doubleChance: { oneX: homeWin + draw, xTwo: draw + awayWin, oneTwo: homeWin + awayWin },
    over25, under25: 1 - over25, btts, noBtts: 1 - btts,
    correctScore: `${best.home}-${best.away}`, correctScoreProbability: best.p,
    mainOutcome: outcomes[0], secondOutcome: outcomes[1], separation: outcomes[0].p - outcomes[1].p,
    newsAdjustment: { home: homeNews, away: awayNews }
  };
}

function countryCode(name) {
  const map = { Spain: 'ES', England: 'GB', Germany: 'DE', Italy: 'IT', France: 'FR', Netherlands: 'NL', Portugal: 'PT', Brazil: 'BR' };
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
  const homeName = base.teams.home.name; const awayName = base.teams.away.name;
  const league = base.fixture?.league || '';

  const [fd, newsIntel] = await Promise.all([
    enrichFootballData(homeName, awayName, league),
    getNewsIntelligence(homeName, awayName)
  ]);

  if (fd.ok) {
    const oldHome = base.form?.home?.played || 0; const oldAway = base.form?.away?.played || 0;
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
  } else {
    base.sourceStatus = { ...(base.sourceStatus || {}), footballData: fd.reason || 'Unavailable', competitionCode: fd.code || 'Unknown' };
  }

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

  const homeForm = base.form?.home || {}; const awayForm = base.form?.away || {};
  const model = probabilityModel(homeForm, awayForm, newsIntel.impact);
  if (model) {
    base.model = {
      expectedGoals: { home: Number(model.expectedGoals.home.toFixed(2)), away: Number(model.expectedGoals.away.toFixed(2)), total: Number(model.expectedGoals.total.toFixed(2)) },
      oneXtwo: { home: pct(model.oneXtwo.home), draw: pct(model.oneXtwo.draw), away: pct(model.oneXtwo.away) },
      doubleChance: { oneX: pct(model.doubleChance.oneX), xTwo: pct(model.doubleChance.xTwo), oneTwo: pct(model.doubleChance.oneTwo) },
      over25: pct(model.over25), under25: pct(model.under25), btts: pct(model.btts), noBtts: pct(model.noBtts),
      correctScore: model.correctScore, correctScoreProbability: pct(model.correctScoreProbability), mainScenario: model.mainOutcome.label,
      contextAdjustments: { newsHomePct: Math.round(model.newsAdjustment.home * 100), newsAwayPct: Math.round(model.newsAdjustment.away * 100), newsSignalsUsed: newsIntel.impact.usedSignals }
    };
    const qualityBase = Math.min(48, (homeForm.played || 0) * 4 + (awayForm.played || 0) * 4);
    const context = (base.fixture?.date ? 14 : 0) + (base.weather ? 6 : 0) + (newsIntel.items.length ? 8 : 0) + (fd.ok ? 10 : 4);
    base.dataQuality = clamp(18 + qualityBase + context, 0, 100);
    base.confidence = clamp(Math.round(pct(model.mainOutcome.p) * (0.64 + base.dataQuality / 100 * 0.36) + model.separation * 18), 35, 94);
    base.newsImpact.appliedToModel = newsIntel.impact.usedSignals > 0;
  } else {
    base.model = null;
    base.confidence = null;
  }

  const keep = (base.limitations || []).filter((x) => !/recent-form sample|not enough completed-match data|recent news/i.test(x));
  if ((homeForm.played || 0) < 5 || (awayForm.played || 0) < 5) keep.push(`Recent-form sample is limited (${homeForm.played || 0} / ${awayForm.played || 0} completed matches).`);
  if (!model) keep.push('At least three completed matches per team are required before Vertex calculates probabilities.');
  if (!newsIntel.items.length) keep.push('No sufficiently relevant recent news was included.');
  else if (!newsIntel.impact.usedSignals) keep.push('Recent news was reviewed, but none was strong enough to alter the model.');
  base.limitations = [...new Set(keep)];
  return base;
}

module.exports = { enhanceAnalysis };
