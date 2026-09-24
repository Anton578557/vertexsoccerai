'use strict';

// Shared deterministic rules. No generated odds, profit targets or learned weights.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VertexStrategyCore = api;
})(typeof window === 'object' ? window : this, function () {
  const DAY = 86400000;
  const MARKETS = ['1X2', 'Double Chance', 'Goals', 'BTTS', 'Corners', 'Cards'];
  const marketIds = { '1X2': '1X2', 'Double Chance': 'DOUBLE_CHANCE', Goals: 'GOALS_OU_2_5', BTTS: 'BTTS' };
  const finite = (v) => v !== null && v !== '' && typeof v !== 'boolean' && Number.isFinite(Number(v));
  const num = (v, fallback = 0) => finite(v) ? Number(v) : fallback;
  const norm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9а-яё]+/g, ' ').trim();
  const unique = (v, max) => [...new Set((Array.isArray(v) ? v : []).filter(x => typeof x === 'string').map(x => x.trim().slice(0, 120)).filter(Boolean))].slice(0, max);
  const dateMs = (v) => v ? new Date(v).getTime() : NaN;
  function profile(input = {}) {
    const riskMap = { 'Консервативный': 'Conservative', Conservador: 'Conservative', 'Сбалансированный': 'Balanced', Equilibrado: 'Balanced', Moderate: 'Balanced', 'Агрессивный': 'Aggressive', Agresivo: 'Aggressive' };
    const risk = riskMap[input.risk] || input.risk;
    const experienceMap = { 'Новичок': 'Beginner', Principiante: 'Beginner', 'Средний': 'Intermediate', Intermedio: 'Intermediate', 'Опытный': 'Advanced', Avanzado: 'Advanced' };
    const experience = experienceMap[input.experience] || input.experience;
    const settings = input.settings && typeof input.settings === 'object' ? input.settings : {};
    return {
      bankroll: Math.max(0, Math.min(num(input.bankroll), 100000000)),
      risk: ['Conservative', 'Balanced', 'Aggressive'].includes(risk) ? risk : 'Balanced',
      experience: ['Beginner', 'Intermediate', 'Advanced'].includes(experience) ? experience : 'Beginner',
      objective: ['Protect bankroll', 'Controlled growth', 'Learn disciplined analysis'].includes(input.objective) ? input.objective : 'Learn disciplined analysis',
      markets: unique(input.markets, 6).filter(x => MARKETS.includes(x)),
      leagues: unique(input.leagues, 2),
      settings: {
        weeklyLimit: Math.max(1, Math.min(6, Math.round(num(settings.weeklyLimit, 4)))),
        stakeCapPct: Math.max(0.1, Math.min(2, num(settings.stakeCapPct, 0.5))),
        currency: ['EUR', 'USD', 'RUB', 'GBP'].includes(settings.currency) ? settings.currency : 'EUR'
      }
    };
  }
  function fromRow(row) {
    return row ? profile({ bankroll: row.bankroll_reference, risk: row.risk_profile, experience: row.experience, objective: row.objective, markets: row.markets, leagues: row.leagues, settings: row.settings }) : null;
  }
  function weekStart(now = Date.now()) {
    const d = new Date(now); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.getTime();
  }
  function review(rows = [], now = Date.now()) {
    // One fixture per journal entry. Never mistake pending/null for a loss.
    const settled = rows.filter(r => typeof r.evaluation?.is_correct === 'boolean' && dateMs(r.selected_at) < dateMs(r.evaluation.fixture_date) && r.evaluation.model_version)
      .sort((a, b) => dateMs(b.evaluation.fixture_date) - dateMs(a.evaluation.fixture_date));
    let lossRun = 0;
    for (const r of settled) { if (r.evaluation.is_correct) break; lossRun++; }
    const start = weekStart(now);
    const weekly = rows.filter(r => dateMs(r.selected_at) >= start && dateMs(r.selected_at) <= now);
    const weekSettled = settled.filter(r => dateMs(r.evaluation.fixture_date) >= start && dateMs(r.evaluation.fixture_date) <= now);
    const cautious = settled.length >= 6 && lossRun >= 3;
    return {
      settled: settled.length, correct: settled.filter(r => r.evaluation.is_correct).length,
      pending: rows.filter(r => r.evaluation?.is_correct == null && !['excluded_late', 'excluded_after_kickoff', 'excluded_invalid'].includes(r.evaluation?.evaluation_status)).length,
      weeklySelected: weekly.length, weeklySettled: weekSettled.length, weeklyCorrect: weekSettled.filter(r => r.evaluation.is_correct).length,
      lossRun, cautious, qualityExtra: cautious ? 5 : 0, weekStart: new Date(start).toISOString(),
      accuracy: settled.length >= 20 ? Math.round(settled.filter(r => r.evaluation.is_correct).length / settled.length * 100) : null,
      byMarket: Object.fromEntries([...new Set(settled.map(r => r.evaluation.market))].map(m => {
        const sample = settled.filter(r => r.evaluation.market === m);
        return [m, { settled: sample.length, correct: sample.filter(r => r.evaluation.is_correct).length }];
      }))
    };
  }
  function rules(input, feedback = {}) {
    const p = profile(input);
    const threshold = { Conservative: 76, Balanced: 68, Aggressive: 62 }[p.risk];
    return {
      quality: Math.min(90, Math.max(threshold, p.experience === 'Beginner' ? 72 : 0) + num(feedback.qualityExtra)),
      probability: { Conservative: 65, Balanced: 60, Aggressive: 55 }[p.risk],
      weeklyLimit: feedback.cautious ? Math.max(1, Math.floor(p.settings.weeklyLimit / 2)) : p.settings.weeklyLimit,
      cap: p.bankroll > 0 ? Math.floor(p.bankroll * p.settings.stakeCapPct) / 100 : null
    };
  }
  function leagueKey(m) { return `${m.country || ''}|${m.league || ''}`; }
  function leagueIdentity(key) {
    const [countryRaw, leagueRaw] = String(key).includes('|') ? String(key).split('|') : ['', key];
    const country = norm(countryRaw).replace(/^the /, '');
    let league = norm(leagueRaw);
    const groups = {
      england: [['premier league','english premier league'],['championship','english championship']],
      spain: [['primera division','la liga','laliga','spanish la liga']],
      germany: [['bundesliga','german bundesliga'],['2 bundesliga','german 2 bundesliga'],['3 liga','germany liga 3','german 3 liga']],
      italy: [['serie a','italian serie a']], france: [['ligue 1','french ligue 1']],
      portugal: [['primeira liga','portuguese primeira liga','liga portugal']],
      netherlands: [['eredivisie','dutch eredivisie']]
    };
    for (const variants of groups[country] || []) if (variants.includes(league)) league = variants[0];
    return `${country}|${league}`;
  }
  function leagueMatches(p, m) {
    return !p.leagues.length || p.leagues.some(l => leagueIdentity(l.includes('|') ? l : `${m.country || ''}|${l}`) === leagueIdentity(leagueKey(m)));
  }
  function fixtures(matches, input, now = Date.now()) {
    const p = profile(input); const seen = new Set();
    return (matches || []).filter(m => {
      const time = dateMs(m.date); const key = `${norm(m.home)}|${norm(m.away)}|${time}`;
      if (!m.home || !m.away || !Number.isFinite(time) || time <= now || time > now + 7 * DAY || /FINISHED|CANCELLED|POSTPONED|SUSPENDED|IN_PLAY|LIVE|PAUSED/i.test(m.status || '') || !leagueMatches(p, m) || seen.has(key)) return false;
      seen.add(key); return true;
    }).sort((a, b) => dateMs(a.date) - dateMs(b.date));
  }
  function picks(model) {
    if (!model) return [];
    const groups = [
      ['1X2', [['HOME', model.oneXtwo?.home], ['DRAW', model.oneXtwo?.draw], ['AWAY', model.oneXtwo?.away]]],
      ['DOUBLE_CHANCE', [['1X', model.doubleChance?.oneX], ['X2', model.doubleChance?.xTwo], ['12', model.doubleChance?.oneTwo]]],
      ['GOALS_OU_2_5', [['OVER', model.over25], ['UNDER', model.under25]]],
      ['BTTS', [['YES', model.btts], ['NO', model.noBtts]]]
    ];
    return groups.flatMap(([market, values]) => {
      if (values.some(([, v]) => !finite(v) || Number(v) < 0 || Number(v) > 100)) return [];
      const best = [...values].sort((a, b) => Number(b[1]) - Number(a[1]))[0];
      return [{ market, value: best[0], probability: Number(best[1]) }];
    });
  }
  function assess(analysis, input, feedback = {}, now = Date.now(), expectedFixture = null) {
    const p = profile(input); const r = rules(p, feedback); const a = analysis || {};
    const reasons = []; const warnings = []; let status = 'FIT';
    const reject = (code) => { status = 'PASS'; reasons.push(code); };
    const watch = (code) => { if (status !== 'PASS') status = 'WATCH'; reasons.push(code); };
    const kickoff = dateMs(a.fixture?.date);
    if (!Number.isFinite(kickoff)) reject('no_fixture');
    else if (kickoff <= now) reject('started');
    else if (kickoff > now + 7 * DAY) reject('outside_week');
    if (expectedFixture && (!Number.isFinite(kickoff) || Math.abs(kickoff - dateMs(expectedFixture.date)) > 5 * 60000)) reject('fixture_changed');
    const m = { league: a.fixture?.league, country: a.fixture?.country || a.teams?.home?.country };
    if (!leagueMatches(p, m)) reject('league');
    if (!a.model) reject('no_model');
    const quality = num(a.dataQuality);
    if (quality < r.quality) reject('quality');
    const home = num(a.form?.home?.played ?? a.samples?.home); const away = num(a.form?.away?.played ?? a.samples?.away);
    if (Math.min(home, away) < 5) reject('history');
    const supported = p.markets.map(x => marketIds[x]).filter(Boolean);
    // Market order reflects the user's preference; unlike sorting unlike markets
    // by probability, double chance cannot win simply because it covers 2 outcomes.
    const allPicks = picks(a.model);
    const selected = supported.map(market => allPicks.find(x => x.market === market)).filter(Boolean);
    const pick = selected.find(x => x.probability >= r.probability) || selected[0] || null;
    if (!pick) reject('market');
    else if (pick.probability < r.probability) watch('probability');
    if (p.markets.some(market => !marketIds[market])) warnings.push('event_markets');
    if (!a.vertexModel?.coverage?.structuredInjuriesAndLineups && !a.coverage?.structuredInjuriesAndLineups) {
      warnings.push('squads');
      if (kickoff > now && kickoff - now < 3 * 3600000) watch('lineups_soon');
    }
    if (kickoff > now + 3 * DAY) watch('early');
    if (dateMs(a.generatedAt) < now - DAY || a.engine?.analysisCacheStale) watch('stale');
    if (num(feedback.weeklySelected) >= r.weeklyLimit) watch('weekly_limit');
    if (status === 'FIT') reasons.push('criteria');
    return { status, reasons: [...new Set(reasons)], warnings, pick, quality, samples: { home, away }, rules: r,
      sources: [...new Set(Object.values(a.contextSources || a.sources || {}).filter(x => typeof x === 'string' && x))],
      modelVersion: a.engine?.modelVersion || a.version || a.model?.engineVersion || null };
  }
  return { profile, fromRow, weekStart, review, rules, leagueKey, leagueMatches, fixtures, picks, assess, marketIds, MARKETS };
});
