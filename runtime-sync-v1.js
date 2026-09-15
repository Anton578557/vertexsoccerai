'use strict';

(() => {
  if (window.__vertexRuntimeSyncV1) return;
  window.__vertexRuntimeSyncV1 = true;

  const SUPABASE_URL = 'https://bznjdzgtiddggcdhxadj.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_kWwttoQARBmC6H_NqsEL_A_A5I7wDON';
  let client = null;
  let user = null;
  let ready = false;
  let lastAnalysis = null;

  function localRead(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (_) { return fallback; }
  }

  function localWrite(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function safeInt(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
  }

  async function init() {
    if (ready || !window.supabase?.createClient) return;
    try {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      const { data } = await client.auth.getSession();
      user = data?.session?.user || null;
      ready = true;
      client.auth.onAuthStateChange((_event, session) => {
        user = session?.user || null;
        if (user) hydrateUserState();
      });
      if (user) await hydrateUserState();
    } catch (error) {
      console.warn('[Vertex sync] init:', error?.message || error);
    }
  }

  async function hydrateUserState() {
    if (!client || !user) return;
    try {
      const [strategyResult, historyResult, savedResult] = await Promise.all([
        client.from('strategy_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        client.from('analysis_history').select('home_team,away_team,created_at,confidence,data_quality,main_scenario').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
        client.from('saved_matches').select('home_team,away_team,created_at,fixture_date,note').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
      ]);

      if (strategyResult.data) {
        const row = strategyResult.data;
        localWrite('vertex_strategy_profile', {
          bankroll: Number(row.bankroll_reference || 0),
          experience: row.experience || 'Intermediate',
          risk: row.risk_profile || 'Balanced',
          objective: row.objective || 'Controlled growth',
          markets: Array.isArray(row.markets) ? row.markets : [],
          leagues: Array.isArray(row.leagues) ? row.leagues : [],
          updatedAt: row.updated_at || new Date().toISOString()
        });
      }

      if (Array.isArray(historyResult.data) && historyResult.data.length) {
        localWrite('vertex_recent_analyses', historyResult.data.map((row) => ({
          match: `${row.home_team} vs ${row.away_team}`,
          date: row.created_at,
          confidence: row.confidence,
          dataQuality: row.data_quality,
          mainScenario: row.main_scenario
        })));
      }

      if (Array.isArray(savedResult.data) && savedResult.data.length) {
        localWrite('vertex_saved_analyses', savedResult.data.map((row) => ({
          match: `${row.home_team} vs ${row.away_team}`,
          savedAt: row.created_at,
          fixtureDate: row.fixture_date,
          note: row.note || null
        })));
      }

      document.dispatchEvent(new CustomEvent('vertex:cloudsync'));
    } catch (error) {
      console.warn('[Vertex sync] hydrate:', error?.message || error);
    }
  }

  async function persistAnalysis(analysis) {
    lastAnalysis = analysis || null;
    if (!client || !user || !analysis?.teams?.home?.name || !analysis?.teams?.away?.name) return;
    try {
      const payload = {
        user_id: user.id,
        home_team: String(analysis.teams.home.name).slice(0, 120),
        away_team: String(analysis.teams.away.name).slice(0, 120),
        fixture_date: analysis.fixture?.date || null,
        main_scenario: analysis.model?.mainScenario || null,
        confidence: safeInt(analysis.confidence),
        data_quality: safeInt(analysis.dataQuality),
        analysis_payload: analysis
      };
      const { error } = await client.from('analysis_history').insert([payload]);
      if (error) throw error;
    } catch (error) {
      console.warn('[Vertex sync] analysis history:', error?.message || error);
    }
  }

  async function persistSavedMatch() {
    if (!client || !user || !lastAnalysis?.teams?.home?.name || !lastAnalysis?.teams?.away?.name) return;
    try {
      const row = {
        user_id: user.id,
        home_team: String(lastAnalysis.teams.home.name).slice(0, 120),
        away_team: String(lastAnalysis.teams.away.name).slice(0, 120),
        fixture_date: lastAnalysis.fixture?.date || null,
        note: lastAnalysis.model?.mainScenario ? `Vertex: ${lastAnalysis.model.mainScenario}` : 'Vertex analysis saved'
      };
      const { error } = await client.from('saved_matches').insert([row]);
      if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error;
    } catch (error) {
      console.warn('[Vertex sync] saved match:', error?.message || error);
    }
  }

  async function persistStrategy() {
    if (!client || !user) return;
    const profile = localRead('vertex_strategy_profile', null);
    if (!profile) return;
    try {
      const row = {
        user_id: user.id,
        bankroll_reference: Number(profile.bankroll || 0) || null,
        experience: profile.experience || null,
        risk_profile: profile.risk || null,
        objective: profile.objective || null,
        leagues: Array.isArray(profile.leagues) ? profile.leagues : [],
        markets: Array.isArray(profile.markets) ? profile.markets : [],
        updated_at: new Date().toISOString()
      };
      const { error } = await client.from('strategy_profiles').upsert([row], { onConflict: 'user_id' });
      if (error) throw error;
    } catch (error) {
      console.warn('[Vertex sync] strategy:', error?.message || error);
    }
  }

  async function loadPerformance() {
    if (!client) return;
    try {
      const { data, error } = await client.from('model_evaluations').select('is_correct,data_quality').not('is_correct', 'is', null).limit(10000);
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      const evaluated = rows.length;
      const correct = rows.filter((row) => row.is_correct === true).length;
      const qualityRows = rows.map((row) => Number(row.data_quality)).filter(Number.isFinite);
      const avgQuality = qualityRows.length ? Math.round(qualityRows.reduce((a, b) => a + b, 0) / qualityRows.length) : null;
      const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
      set('perfEvaluated', String(evaluated));
      set('perfCorrect', String(correct));
      set('perfAccuracy', evaluated ? `${Math.round(correct / evaluated * 100)}%` : '—');
      set('perfQuality', avgQuality == null ? '—' : `${avgQuality}%`);
    } catch (error) {
      console.warn('[Vertex sync] performance:', error?.message || error);
    }
  }

  // Observe successful analyzer responses without changing the main UI pipeline.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const input = args[0];
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/api/analyze') && response.ok) {
        response.clone().json().then((payload) => {
          if (payload?.analysis) persistAnalysis(payload.analysis);
        }).catch(() => {});
      }
    } catch (_) {}
    return response;
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="save-analysis"]')) setTimeout(persistSavedMatch, 0);
    const resultsTab = event.target.closest('.nav a[data-tab="results"]');
    if (resultsTab) setTimeout(loadPerformance, 80);
  }, true);

  document.addEventListener('submit', (event) => {
    if (event.target?.id === 'strategyForm') setTimeout(persistStrategy, 80);
  }, true);

  document.addEventListener('vertex:cloudsync', () => {
    if (location.hash.includes('results')) loadPerformance();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
