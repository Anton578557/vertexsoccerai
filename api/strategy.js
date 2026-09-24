'use strict';

const { requireUser } = require('../lib/api-auth');
const { enforceRateLimit } = require('../lib/rate-limit');
const core = require('../strategy-core');

function database(req, admin = false) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = admin ? process.env.SUPABASE_SECRET_KEY : process.env.SUPABASE_ANON_KEY;
  if (!base || !key) throw new Error('STORAGE_UNAVAILABLE');
  return async (table, params = {}, options = {}) => {
    const url = new URL(`${base}/rest/v1/${table}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetch(url, {
      ...options, signal: AbortSignal.timeout(8000),
      headers: { apikey: key, ...(!admin ? { Authorization: req.headers.authorization } : {}),
        'Content-Type': 'application/json', Accept: 'application/json', ...options.headers }
    });
    if (!response.ok) { const error = new Error('STORAGE_UNAVAILABLE'); error.status = response.status; throw error; }
    return response.status === 204 ? null : response.json();
  };
}
async function state(db, userId) {
  const [profiles, journal] = await Promise.all([
    db('strategy_profiles', { user_id: `eq.${userId}`, select: '*', limit: '1' }),
    db('strategy_journal', { user_id: `eq.${userId}`, select: 'id,selected_at,fixture_key,evaluation:model_evaluations(id,fixture_date,market,predicted_value,predicted_probability,data_quality,model_version,forecast,is_correct,actual_value,evaluated_at,evaluation_status,evaluation_source)', order: 'selected_at.desc', limit: '150' })
  ]);
  return { profile: core.fromRow(profiles[0]), journal, review: core.review(journal), updatedAt: new Date().toISOString() };
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const user = await requireUser(req, res);
  if (!user) return;
  if (!await enforceRateLimit(req, res, user, 'strategy', { windowSeconds: 3600, limit: 120 })) return;
  try {
    const db = database(req);
    if (req.method === 'GET') return res.status(200).json(await state(db, user.id));
    const body = req.body || {};
    if (body.action === 'profile') {
      const p = core.profile(body.profile);
      if (!p.markets.length) return res.status(400).json({ error: 'CHOOSE_MARKETS' });
      await db('strategy_profiles', { on_conflict: 'user_id' }, {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: user.id, bankroll_reference: p.bankroll, experience: p.experience,
          risk_profile: p.risk, objective: p.objective, markets: p.markets, leagues: p.leagues, settings: p.settings, updated_at: new Date().toISOString() })
      });
      return res.status(200).json(await state(db, user.id));
    }
    if (body.action !== 'track' || typeof body.fixtureKey !== 'string' || body.fixtureKey.length > 250 || !Object.values(core.marketIds).includes(body.market)) return res.status(400).json({ error: 'INVALID_SELECTION' });
    const s = await state(db, user.id);
    if (!s.profile) return res.status(400).json({ error: 'PROFILE_REQUIRED' });
    // Clients may only choose an existing server forecast; cannot post odds/results.
    const rows = await db('model_evaluations', { fixture_key: `eq.${body.fixtureKey}`, market: `eq.${body.market}`, select: '*', limit: '1' });
    const e = rows[0];
    if (!e?.model_version || !e.forecast?.model || e.is_correct != null || !(new Date(e.fixture_date).getTime() > Date.now()) || !(new Date(e.created_at).getTime() < new Date(e.fixture_date).getTime())) return res.status(409).json({ error: 'FORECAST_UNAVAILABLE' });
    if (s.journal.some(x => x.fixture_key === body.fixtureKey)) return res.status(200).json(s);
    const assessment = core.assess(e.forecast, s.profile, s.review);
    if (assessment.status === 'PASS' || !s.profile.markets.some(x => core.marketIds[x] === e.market)) return res.status(409).json({ error: 'PROFILE_MISMATCH' });
    if (s.review.weeklySelected >= core.rules(s.profile, s.review).weeklyLimit) return res.status(409).json({ error: 'WEEKLY_LIMIT' });
    await database(req, true)('strategy_journal', { on_conflict: 'user_id,fixture_key' }, {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: user.id, fixture_key: e.fixture_key, evaluation_id: e.id })
    });
    return res.status(200).json(await state(db, user.id));
  } catch (error) {
    console.warn('strategy', error.message, { status: error.status || null });
    return res.status(503).json({ error: 'STORAGE_UNAVAILABLE' });
  }
};
