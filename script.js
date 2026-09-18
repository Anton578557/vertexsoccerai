'use strict';

(() => {
  const SUPABASE_URL = 'https://bznjdzgtiddggcdhxadj.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_kWwttoQARBmC6H_NqsEL_A_A5I7wDON';
  const SUPPORT_EMAIL = 'vertexsoccerai@outlook.com';

  let supabaseClient = null;
  let currentUser = null;
  let selectedRating = 5;
  let suggestionTimer = null;
  let lastAnalysis = null;
  let liveLoaded = false;

  function ensureStylesheet(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  ensureStylesheet('components.css');
  ensureStylesheet('visual-v3.css');

  const byId = (id) => document.getElementById(id);
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const on = (id, event, handler) => {
    const element = byId(id);
    if (element) element.addEventListener(event, handler);
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  function safeUrl(value) {
    try {
      const url = new URL(value, window.location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
    } catch (_) {
      return '#';
    }
  }

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function fmtDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function showToast(message, ms = 3400) {
    const toast = byId('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add('hidden'), ms);
  }

  function openModal(html) {
    const overlay = byId('modalOverlay');
    const content = byId('modalContent');
    if (!overlay || !content) return;
    content.innerHTML = html;
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => content.querySelector('input, button, select, textarea')?.focus());
  }

  function closeModal() {
    byId('modalOverlay')?.classList.add('hidden');
  }

  function isProtected(tabId) {
    return qs(`.nav a[data-tab="${tabId}"]`)?.dataset.protected === 'true';
  }

  function closeMobileNav() {
    byId('nav')?.classList.remove('open');
    byId('mobileMenuButton')?.setAttribute('aria-expanded', 'false');
  }

  function activateTab(tabId, { bypassAuth = false } = {}) {
    if (!bypassAuth && isProtected(tabId) && !currentUser) {
      showAccessModal(tabId);
      return false;
    }

    const target = byId(`tab-${tabId}`);
    if (!target) {
      console.warn('[Vertex] Missing tab:', tabId);
      return false;
    }

    qsa('.tab-content').forEach((section) => section.classList.remove('active'));
    target.classList.add('active');
    qsa('.nav a[data-tab]').forEach((link) => link.classList.toggle('active', link.dataset.tab === tabId));
    closeMobileNav();

    if (history.replaceState) history.replaceState(null, '', tabId === 'home' ? '#/' : `#/${tabId}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabId === 'live' && !liveLoaded) loadLiveMatches();
    if (tabId === 'leaderboard') loadLeaderboard();
    if (tabId === 'reviews') loadReviews();
    if (tabId === 'results') loadPerformance();
    if (tabId === 'strategy') renderStrategy();
    return true;
  }

  function showAccessModal(targetTab = 'analyzer') {
    openModal(`
      <span class="kicker">FREE BETA ACCESS</span>
      <h2>Sign in to unlock Vertex</h2>
      <p class="modal-copy">Match Analyzer, My Strategy, Live, Results and your saved history are available to registered beta users.</p>
      <button data-modal-action="signup" data-target-tab="${escapeHtml(targetTab)}">CREATE FREE ACCOUNT</button>
      <button class="btn-close-modal" data-modal-action="login" data-target-tab="${escapeHtml(targetTab)}">SIGN IN</button>
      <button class="btn-close-modal" data-modal-action="close">CLOSE</button>
    `);
  }

  function showSignupModal(targetTab = '') {
    openModal(`
      <span class="kicker">VERTEX FREE BETA</span>
      <h2>Create your account</h2>
      <p class="modal-copy">No payment details. Create an account to unlock the football intelligence tools.</p>
      <input type="email" id="signupEmail" placeholder="Email" autocomplete="email">
      <input type="password" id="signupPassword" placeholder="Password · minimum 6 characters" autocomplete="new-password">
      <button data-modal-action="do-signup" data-target-tab="${escapeHtml(targetTab)}">SIGN UP</button>
      <button class="btn-close-modal" data-modal-action="login" data-target-tab="${escapeHtml(targetTab)}">Already registered? Sign in</button>
      <button class="btn-close-modal" data-modal-action="close">CLOSE</button>
    `);
  }

  function showLoginModal(targetTab = '') {
    openModal(`
      <span class="kicker">WELCOME BACK</span>
      <h2>Sign in</h2>
      <input type="email" id="loginEmail" placeholder="Email" autocomplete="email">
      <input type="password" id="loginPassword" placeholder="Password" autocomplete="current-password">
      <button data-modal-action="do-login" data-target-tab="${escapeHtml(targetTab)}">SIGN IN</button>
      <button class="btn-close-modal" data-modal-action="signup" data-target-tab="${escapeHtml(targetTab)}">Create free account</button>
      <button class="btn-close-modal" data-modal-action="close">CLOSE</button>
    `);
  }

  async function initAuth() {
    if (!window.supabase?.createClient) {
      console.warn('[Vertex] Supabase client library did not load. Public tabs still work.');
      updateAuthUI();
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      currentUser = data?.session?.user || null;
      updateAuthUI();
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        updateAuthUI();
      });
    } catch (error) {
      console.error('[Vertex] Auth init:', error);
      showToast('Authentication is temporarily unavailable. Public pages still work.');
    }
  }

  function updateAuthUI() {
    byId('btnLogin')?.classList.toggle('hidden', Boolean(currentUser));
    byId('btnSignup')?.classList.toggle('hidden', Boolean(currentUser));
    byId('btnCabinet')?.classList.toggle('hidden', !currentUser);
    byId('reviewForm')?.classList.toggle('hidden', !currentUser);
  }

  async function signup(targetTab = '') {
    const email = byId('signupEmail')?.value.trim();
    const password = byId('signupPassword')?.value || '';
    if (!email || password.length < 6) return showToast('Enter a valid email and a password of at least 6 characters.');
    if (!supabaseClient) return showToast('Authentication service is unavailable.');

    try {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      closeModal();
      if (data?.session) {
        currentUser = data.user;
        updateAuthUI();
        showToast('Account created. Vertex is unlocked.');
        if (targetTab) activateTab(targetTab, { bypassAuth: true });
      } else {
        showToast('Verification email sent. Confirm your email, then sign in.', 6000);
      }
    } catch (error) {
      showToast(`Sign up failed: ${error.message}`, 5000);
    }
  }

  async function login(targetTab = '') {
    const email = byId('loginEmail')?.value.trim();
    const password = byId('loginPassword')?.value || '';
    if (!email || !password) return showToast('Enter your email and password.');
    if (!supabaseClient) return showToast('Authentication service is unavailable.');

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      currentUser = data.user;
      closeModal();
      updateAuthUI();
      showToast('Signed in. Vertex is unlocked.');
      if (targetTab) activateTab(targetTab, { bypassAuth: true });
    } catch (error) {
      showToast(`Sign in failed: ${error.message}`, 5000);
    }
  }

  async function logout() {
    try { await supabaseClient?.auth.signOut(); } catch (_) {}
    currentUser = null;
    closeModal();
    updateAuthUI();
    activateTab('home', { bypassAuth: true });
    showToast('Signed out.');
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data?.error || `Request failed (${response.status})`);
        error.status = response.status;
        error.code = data?.code;
        throw error;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  function parseMatchInput(value) {
    const text = String(value || '').trim();
    const parts = text.split(/\s+(?:vs\.?|v\.?|–|—)\s+/i).map((part) => part.trim()).filter(Boolean);
    return parts.length === 2 && parts.every((part) => part.length >= 2) ? { home: parts[0], away: parts[1] } : null;
  }

  function suggestionQuery(value) {
    const text = String(value || '').trim();
    const split = text.split(/\s+(?:vs\.?|v\.?|–|—)\s+/i);
    return split.at(-1)?.trim() || '';
  }

  function applySuggestion(original, teamName) {
    const text = String(original || '').trim();
    const match = text.match(/^(.*?\s+(?:vs\.?|v\.?|–|—)\s+)(.*)$/i);
    return match ? `${match[1]}${teamName}` : teamName;
  }

  async function showSuggestions(input, box) {
    const query = suggestionQuery(input.value);
    if (query.length < 2) {
      box.classList.remove('active');
      box.innerHTML = '';
      return;
    }

    try {
      const data = await fetchJson(`/api/team-search?q=${encodeURIComponent(query)}`);
      const teams = data.teams || [];
      if (!teams.length) throw new Error('No suggestions');
      box.innerHTML = teams.slice(0, 8).map((team) => `
        <button class="suggestion-item" type="button" data-team-name="${escapeHtml(team.name)}">
          <strong>${escapeHtml(team.name)}</strong>
          <small>${escapeHtml([team.league, team.country].filter(Boolean).join(' · '))}</small>
        </button>
      `).join('');
      box.classList.add('active');
    } catch (_) {
      box.classList.remove('active');
      box.innerHTML = '';
    }
  }

  function bindSearch(inputId, suggestionsId, submitHandler) {
    const input = byId(inputId);
    const box = byId(suggestionsId);
    if (!input || !box) return;

    input.addEventListener('input', () => {
      clearTimeout(suggestionTimer);
      suggestionTimer = setTimeout(() => showSuggestions(input, box), 220);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitHandler();
      }
    });

    box.addEventListener('click', (event) => {
      const item = event.target.closest('[data-team-name]');
      if (!item) return;
      input.value = applySuggestion(input.value, item.dataset.teamName);
      box.classList.remove('active');
      input.focus();
    });
  }

  function setMatchInputs(value) {
    if (byId('searchInput')) byId('searchInput').value = value;
    if (byId('analyzerSearch')) byId('analyzerSearch').value = value;
  }

  function startHomeAnalysis() {
    if (!currentUser) return showAccessModal('analyzer');
    const parsed = parseMatchInput(byId('searchInput')?.value);
    if (!parsed) return showToast('Use the format “Home Team vs Away Team”.');
    setMatchInputs(`${parsed.home} vs ${parsed.away}`);
    activateTab('analyzer', { bypassAuth: true });
    performAnalysis(parsed.home, parsed.away);
  }

  function startAnalyzerAnalysis() {
    if (!currentUser) return showAccessModal('analyzer');
    const parsed = parseMatchInput(byId('analyzerSearch')?.value);
    if (!parsed) return showToast('Use the format “Home Team vs Away Team”.');
    performAnalysis(parsed.home, parsed.away);
  }

  function formSequence(stats = {}) {
    if (!stats.sequence?.length) return '<span class="form-empty">No recent results</span>';
    return stats.sequence.map((result) => `<span class="form-pill form-${escapeHtml(result.toLowerCase())}">${escapeHtml(result)}</span>`).join('');
  }

  function renderWeather(weather) {
    if (!weather) return '<p>Weather was not available for this run.</p>';
    const parts = [
      Number.isFinite(weather.tempC) ? `${weather.tempC}°C` : null,
      weather.condition,
      Number.isFinite(weather.humidity) ? `${weather.humidity}% humidity` : null,
      Number.isFinite(weather.windMs) ? `${weather.windMs} m/s wind` : null
    ].filter(Boolean);
    return `<p><strong>${escapeHtml(weather.location || 'Venue area')}</strong><br>${escapeHtml(parts.join(' · '))}</p>`;
  }

  function renderNews(news = []) {
    if (!news.length) return '<p>No verified recent news was included in this run.</p>';
    return `<ul>${news.slice(0, 5).map((item) => `
      <li><a href="${safeUrl(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a><small>${escapeHtml(item.source || 'News')} · ${escapeHtml(item.signal || 'neutral')}</small></li>
    `).join('')}</ul>`;
  }

  function renderAnalysis(analysis) {
    const home = analysis?.teams?.home || {};
    const away = analysis?.teams?.away || {};
    const fixture = analysis?.fixture || {};
    const homeForm = analysis?.form?.home || {};
    const awayForm = analysis?.form?.away || {};
    const model = analysis?.model;
    const quality = clamp(Number(analysis?.dataQuality || 0), 0, 100);
    const confidence = analysis?.confidence == null ? null : clamp(Number(analysis.confidence), 0, 100);
    const sources = Object.entries(analysis?.sourceStatus || {}).map(([key, value]) => `${key}: ${value}`).join(' · ');
    const fixtureMeta = [fixture.league, fmtDate(fixture.date), fixture.venue, fixture.city].filter(Boolean).join(' · ');

    const modelBlock = model ? `
      <div class="quality-row">
        <div class="quality-card"><div class="quality-head"><span>Analysis confidence</span><strong>${confidence ?? '—'}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${confidence ?? 0}%"></div></div></div>
        <div class="quality-card"><div class="quality-head"><span>Data quality</span><strong>${quality}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${quality}%"></div></div></div>
      </div>
      <div class="prediction-grid">
        <div class="prediction-item featured"><span>Main scenario</span><strong>${escapeHtml(model.mainScenario || '—')}</strong></div>
        <div class="prediction-item"><span>1X2</span><strong>H ${model.oneXtwo?.home ?? '—'}% · D ${model.oneXtwo?.draw ?? '—'}% · A ${model.oneXtwo?.away ?? '—'}%</strong></div>
        <div class="prediction-item"><span>Over 2.5</span><strong>${model.over25 ?? '—'}%</strong></div>
        <div class="prediction-item"><span>BTTS</span><strong>${model.btts ?? '—'}%</strong></div>
        <div class="prediction-item"><span>Expected goals</span><strong>${model.expectedGoals?.home ?? '—'} — ${model.expectedGoals?.away ?? '—'}</strong></div>
        <div class="prediction-item"><span>Likely score</span><strong>${escapeHtml(model.correctScore || '—')}</strong></div>
      </div>
      <div class="verdict-box"><span>VERTEX MATCH VERDICT</span><p>Primary statistical scenario: <strong>${escapeHtml(model.mainScenario || '—')}</strong>. Confidence is adjusted by the amount and quality of data available for this specific match.</p></div>
    ` : `
      <div class="analysis-error"><strong>PREDICTION WITHHELD</strong><p>The connected providers did not return enough completed-match data for a responsible probability model. Vertex will not invent percentages.</p></div>
    `;

    const limitations = analysis?.limitations?.length
      ? `<ul>${analysis.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '<p>No major data limitations were reported.</p>';

    return `
      <div class="analysis-card">
        <div class="analysis-header">
          <div class="analysis-team">${home.badge ? `<img src="${safeUrl(home.badge)}" alt="">` : ''}<strong>${escapeHtml(home.name || 'Home')}</strong><small>${escapeHtml(home.country || '')}</small></div>
          <div class="analysis-vs">VS</div>
          <div class="analysis-team">${away.badge ? `<img src="${safeUrl(away.badge)}" alt="">` : ''}<strong>${escapeHtml(away.name || 'Away')}</strong><small>${escapeHtml(away.country || '')}</small></div>
        </div>
        <div class="analysis-meta-line">${escapeHtml(fixtureMeta || 'Fixture metadata is limited for this run')}</div>
        <div class="metric-grid">
          <div class="metric-card"><span>${escapeHtml(home.name || 'Home')} form</span><strong class="form-sequence">${formSequence(homeForm)}</strong><em>${homeForm.played || 0} matches sampled</em></div>
          <div class="metric-card"><span>${escapeHtml(away.name || 'Away')} form</span><strong class="form-sequence">${formSequence(awayForm)}</strong><em>${awayForm.played || 0} matches sampled</em></div>
          <div class="metric-card"><span>Home goals / match</span><strong>${Number.isFinite(homeForm.avgFor) ? Number(homeForm.avgFor).toFixed(2) : '—'}</strong><em>Conceded ${Number.isFinite(homeForm.avgAgainst) ? Number(homeForm.avgAgainst).toFixed(2) : '—'}</em></div>
          <div class="metric-card"><span>Away goals / match</span><strong>${Number.isFinite(awayForm.avgFor) ? Number(awayForm.avgFor).toFixed(2) : '—'}</strong><em>Conceded ${Number.isFinite(awayForm.avgAgainst) ? Number(awayForm.avgAgainst).toFixed(2) : '—'}</em></div>
        </div>
        ${modelBlock}
        <div class="data-evidence">
          <div class="evidence-card"><h4>WEATHER / VENUE</h4>${renderWeather(analysis.weather)}</div>
          <div class="evidence-card"><h4>RECENT NEWS</h4>${renderNews(analysis.news)}</div>
          <div class="evidence-card"><h4>DATA SOURCES USED</h4><p>${escapeHtml(sources || 'Provider details unavailable')}</p></div>
          <div class="evidence-card"><h4>LIMITATIONS</h4>${limitations}</div>
        </div>
        <div class="strategy-actions"><button class="btn-secondary" data-action="save-analysis" type="button">SAVE ANALYSIS</button><button class="btn-secondary" data-action="copy-analysis" type="button">COPY SUMMARY</button></div>
      </div>
    `;
  }

  async function performAnalysis(home, away) {
    const target = byId('analysisResult');
    if (!target) return;
    target.innerHTML = '<div class="loading-state">Collecting match data and calculating the Vertex model…</div>';
    try {
      const data = await fetchJson(`/api/analyze?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`);
      lastAnalysis = data.analysis;

      // Render the analysis exactly once. UX7 owns the production report UI.
      // The legacy renderer remains only as a defensive fallback if UX7 failed to load.
      if (window.VertexAnalysisUI?.acceptAnalysis) {
        window.VertexAnalysisUI.acceptAnalysis(data.analysis);
      } else {
        document.dispatchEvent(new CustomEvent('vertex:analysis-ready', { detail: { analysis: data.analysis } }));
        if (!target.querySelector('.v6-analysis-card')) target.innerHTML = renderAnalysis(data.analysis);
        rememberAnalysis(data.analysis);
      }

      incrementActivity();
    } catch (error) {
      target.innerHTML = `<div class="analysis-error"><strong>ANALYSIS UNAVAILABLE</strong><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  function analysisKey(analysis) {
    return `${analysis?.teams?.home?.name || 'Home'} vs ${analysis?.teams?.away?.name || 'Away'}`;
  }

  function readLocal(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (_) { return fallback; }
  }

  function rememberAnalysis(analysis) {
    const row = {
      match: analysisKey(analysis),
      date: new Date().toISOString(),
      confidence: analysis?.confidence,
      dataQuality: analysis?.dataQuality,
      mainScenario: analysis?.model?.mainScenario || null
    };
    const list = [row, ...readLocal('vertex_recent_analyses', []).filter((item) => item.match !== row.match)].slice(0, 20);
    localStorage.setItem('vertex_recent_analyses', JSON.stringify(list));
  }

  function saveCurrentAnalysis() {
    if (!lastAnalysis) return showToast('Run an analysis first.');
    const row = {
      match: analysisKey(lastAnalysis),
      savedAt: new Date().toISOString(),
      confidence: lastAnalysis.confidence,
      dataQuality: lastAnalysis.dataQuality,
      mainScenario: lastAnalysis.model?.mainScenario || null
    };
    const list = [row, ...readLocal('vertex_saved_analyses', []).filter((item) => item.match !== row.match)].slice(0, 50);
    localStorage.setItem('vertex_saved_analyses', JSON.stringify(list));
    showToast('Analysis saved to My Cabinet.');
  }

  async function copyCurrentAnalysis() {
    if (!lastAnalysis) return;
    const summary = [
      `Vertex Soccer AI — ${analysisKey(lastAnalysis)}`,
      `Data quality: ${lastAnalysis.dataQuality ?? '—'}%`,
      lastAnalysis.confidence != null ? `Confidence: ${lastAnalysis.confidence}%` : null,
      lastAnalysis.model ? `Main scenario: ${lastAnalysis.model.mainScenario}` : 'Prediction withheld: insufficient verified data'
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(summary);
      showToast('Analysis summary copied.');
    } catch (_) {
      showToast('Clipboard permission is unavailable.');
    }
  }

  function getStrategyProfile() {
    return readLocal('vertex_strategy_profile', null);
  }

  function renderStrategy() {
    const target = byId('strategyContent');
    if (!target) return;
    const profile = getStrategyProfile();

    if (!profile) {
      target.innerHTML = `
        <div class="trainer-card strategy-intro">
          <span class="kicker">FREE BETA</span>
          <h3>Build your Vertex profile</h3>
          <p class="strategy-copy">Set your experience, risk profile and preferred markets. Vertex uses these rules to decide when a match deserves attention and when PASS is the better decision.</p>
          <ul class="trainer-features"><li>Personal risk framework</li><li>Preferred market filters</li><li>Data-quality threshold</li><li>PASS / WATCH / FIT decision logic</li></ul>
          <button class="btn-primary" id="btnTryStrategy" type="button">SET UP MY PROFILE</button>
        </div>`;
      on('btnTryStrategy', 'click', showStrategySetup);
      return;
    }

    const threshold = profile.risk === 'Conservative' ? 76 : profile.risk === 'Aggressive' ? 60 : 68;
    target.innerHTML = `
      <div class="strategy-dashboard">
        <div class="strategy-panel"><span class="kicker">YOUR PROFILE</span><h3>${escapeHtml(profile.risk)} · ${escapeHtml(profile.experience)}</h3><div class="profile-score"><div><span>Bankroll reference</span><strong>${escapeHtml(profile.bankroll)}</strong></div><div><span>Data threshold</span><strong>${threshold}%</strong></div><div><span>Markets</span><strong>${escapeHtml(profile.markets.join(', '))}</strong></div><div><span>Objective</span><strong>${escapeHtml(profile.objective)}</strong></div></div><div class="strategy-actions"><button class="btn-secondary" data-action="edit-strategy" type="button">EDIT PROFILE</button><button class="btn-primary" data-action="scan-strategy" type="button">SCAN TODAY</button></div></div>
        <div class="strategy-panel"><span class="kicker">VERTEX RULES</span><h3>NO CHASING. NO FORCED PICKS.</h3><ul class="strategy-rules"><li>Reject matches below ${threshold}% data quality.</li><li>Pass when recent form or team availability is too weak.</li><li>Only use markets supported by the available source data.</li><li>More matches do not mean better decisions.</li></ul></div>
      </div><div id="strategyScanResults" class="strategy-scan-results"></div>`;
  }

  function showStrategySetup() {
    const target = byId('strategyContent');
    if (!target) return;
    const previous = getStrategyProfile() || {};
    target.innerHTML = `
      <form class="strategy-form" id="strategyForm">
        <div class="form-grid">
          <div class="field"><label>Bankroll reference</label><input id="strategyBankroll" type="number" min="1" value="${escapeHtml(previous.bankroll || 1000)}"></div>
          <div class="field"><label>Experience</label><select id="strategyExperience"><option>Beginner</option><option selected>Intermediate</option><option>Advanced</option></select></div>
          <div class="field"><label>Risk profile</label><select id="strategyRisk"><option>Conservative</option><option selected>Balanced</option><option>Aggressive</option></select></div>
          <div class="field"><label>Objective</label><select id="strategyObjective"><option>Protect bankroll</option><option selected>Controlled growth</option><option>Learn disciplined analysis</option></select></div>
          <div class="field full"><label>Preferred markets</label><div class="market-options">${['1X2','Double Chance','Goals','BTTS','Corners','Cards'].map((item) => `<label class="check-chip"><input type="checkbox" name="strategyMarket" value="${item}" ${['1X2','Goals'].includes(item) ? 'checked' : ''}><span>${item}</span></label>`).join('')}</div></div>
        </div>
        <button class="btn-primary" type="submit">SAVE STRATEGY</button>
      </form>`;
    byId('strategyForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const profile = {
        bankroll: Number(byId('strategyBankroll')?.value || 0),
        experience: byId('strategyExperience')?.value || 'Intermediate',
        risk: byId('strategyRisk')?.value || 'Balanced',
        objective: byId('strategyObjective')?.value || 'Controlled growth',
        markets: qsa('input[name="strategyMarket"]:checked').map((item) => item.value),
        updatedAt: new Date().toISOString()
      };
      if (!profile.bankroll || !profile.markets.length) return showToast('Complete the strategy profile first.');
      localStorage.setItem('vertex_strategy_profile', JSON.stringify(profile));
      renderStrategy();
      showToast('Strategy profile saved.');
    });
  }

  async function scanStrategyMatches() {
    const target = byId('strategyScanResults');
    if (!target) return;
    target.innerHTML = '<div class="loading-state">Scanning today’s available fixtures…</div>';
    try {
      const data = await fetchJson('/api/upcoming');
      const matches = (data.matches || []).slice(0, 12);
      if (!matches.length) {
        target.innerHTML = '<div class="empty-state"><h3>PASS</h3><p>No current fixtures were returned by the connected provider.</p></div>';
        return;
      }
      target.innerHTML = `<div class="live-grid">${matches.map((match) => `<div class="live-card"><div class="live-meta"><span>${escapeHtml(match.league || 'Competition')}</span><span>${escapeHtml(fmtDate(match.date))}</span></div><div class="live-team-row"><strong>${escapeHtml(match.home)}</strong></div><div class="live-team-row"><strong>${escapeHtml(match.away)}</strong></div><button class="btn-secondary full-width" data-analyze-match="${escapeHtml(`${match.home} vs ${match.away}`)}" type="button">ANALYZE MATCH</button></div>`).join('')}</div>`;
    } catch (error) {
      target.innerHTML = `<div class="analysis-error"><strong>SCAN UNAVAILABLE</strong><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  async function loadLiveMatches() {
    const target = byId('liveMatches');
    const status = byId('liveStatus');
    if (!target) return;
    target.innerHTML = '<div class="loading-state">Loading live matches…</div>';
    if (status) status.textContent = 'Connecting to live provider…';
    try {
      const data = await fetchJson('/api/live');
      const matches = data.matches || [];
      liveLoaded = true;
      if (status) status.textContent = `Updated ${fmtDate(data.updatedAt) || 'now'} · ${matches.length} live matches`;
      if (!matches.length) {
        target.innerHTML = '<div class="empty-state"><h3>No live matches right now</h3><p>The provider is connected but returned no active fixtures.</p></div>';
        return;
      }
      target.innerHTML = matches.map((match) => `<div class="live-card"><div class="live-meta"><span>${escapeHtml(match.league || 'Competition')}</span><span class="live-badge">${escapeHtml(match.minute || 'LIVE')}</span></div><div class="live-team-row"><strong>${escapeHtml(match.home)}</strong><span class="live-score">${escapeHtml(match.homeScore ?? '—')}</span></div><div class="live-team-row"><strong>${escapeHtml(match.away)}</strong><span class="live-score">${escapeHtml(match.awayScore ?? '—')}</span></div></div>`).join('');
    } catch (error) {
      liveLoaded = false;
      if (status) status.textContent = 'Live provider unavailable';
      target.innerHTML = `<div class="analysis-error"><strong>LIVE CENTER UNAVAILABLE</strong><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  function loadPerformance() {
    byId('perfEvaluated') && (byId('perfEvaluated').textContent = '0');
    byId('perfCorrect') && (byId('perfCorrect').textContent = '0');
    byId('perfAccuracy') && (byId('perfAccuracy').textContent = '—');
    byId('perfQuality') && (byId('perfQuality').textContent = '—');
  }

  async function incrementActivity() {
    if (!supabaseClient || !currentUser) return;
    try {
      const { data } = await supabaseClient.from('activity').select('analyses_count').eq('user_id', currentUser.id).maybeSingle();
      if (data) await supabaseClient.from('activity').update({ analyses_count: Number(data.analyses_count || 0) + 1 }).eq('user_id', currentUser.id);
      else await supabaseClient.from('activity').insert([{ user_id: currentUser.id, analyses_count: 1 }]);
    } catch (error) {
      console.warn('[Vertex] activity:', error.message);
    }
  }

  async function loadLeaderboard() {
    const target = byId('leaderboard');
    if (!target) return;
    if (!supabaseClient) return (target.innerHTML = '<div class="empty-state"><p>Community database is unavailable.</p></div>');
    target.innerHTML = '<div class="loading-state">Loading community activity…</div>';
    try {
      const { data, error } = await supabaseClient.from('activity').select('user_id, analyses_count').order('analyses_count', { ascending: false }).limit(20);
      if (error) throw error;
      target.innerHTML = data?.length ? data.map((row, index) => `<div class="result-row"><span>#${index + 1} Vertex Member</span><strong>${Number(row.analyses_count || 0)} analyses</strong></div>`).join('') : '<div class="empty-state"><p>No analysis activity yet.</p></div>';
    } catch (error) {
      target.innerHTML = `<div class="analysis-error"><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  async function loadReviews() {
    const list = byId('reviewsList');
    if (!list) return;
    byId('reviewForm')?.classList.toggle('hidden', !currentUser);
    if (!supabaseClient) return (list.innerHTML = '<div class="empty-state"><p>Reviews database is unavailable.</p></div>');
    list.innerHTML = '<div class="loading-state">Loading reviews…</div>';
    try {
      const { data, error } = await supabaseClient.from('reviews').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      list.innerHTML = data?.length ? data.map((review) => `<div class="result-row review-row"><div><strong class="review-stars">${'★'.repeat(clamp(Number(review.rating || 0), 0, 5))}</strong><p>${escapeHtml(review.review_text || '')}</p></div><small>${escapeHtml(fmtDate(review.created_at))}</small></div>`).join('') : '<div class="empty-state"><p>No reviews yet. Be the first beta user to leave one.</p></div>';
    } catch (error) {
      list.innerHTML = `<div class="analysis-error"><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  async function submitReview() {
    if (!currentUser) return showAccessModal('reviews');
    const text = byId('reviewText')?.value.trim();
    if (!text || text.length < 5) return showToast('Write a little more before submitting.');
    try {
      const { error } = await supabaseClient.from('reviews').insert([{ user_id: currentUser.id, rating: selectedRating, review_text: text.slice(0, 1000) }]);
      if (error) throw error;
      byId('reviewText').value = '';
      showToast('Review submitted.');
      loadReviews();
    } catch (error) {
      showToast(`Review failed: ${error.message}`);
    }
  }

  function showCabinet() {
    if (!currentUser) return showAccessModal('home');
    const recent = readLocal('vertex_recent_analyses', []).slice(0, 5);
    const saved = readLocal('vertex_saved_analyses', []).slice(0, 5);
    const profile = getStrategyProfile();
    openModal(`
      <span class="kicker">MY CABINET</span>
      <h2>Vertex account</h2>
      <p class="cabinet-email">${escapeHtml(currentUser.email || '')}</p>
      <div class="cabinet-stats"><div><span>Recent</span><strong>${recent.length}</strong></div><div><span>Saved</span><strong>${saved.length}</strong></div><div><span>Strategy</span><strong>${profile ? 'ACTIVE' : 'NOT SET'}</strong></div></div>
      <button data-modal-action="open-strategy">OPEN MY STRATEGY</button>
      <button class="btn-close-modal" data-modal-action="logout">LOG OUT</button>
      <button class="btn-close-modal" data-modal-action="close">CLOSE</button>
    `);
  }

  function showAboutPage() {
    openModal(`<span class="kicker">ABOUT</span><h2>Vertex Soccer AI</h2><p class="modal-copy">A football intelligence platform built around real source data, transparent data quality and responsible probability modelling.</p><button data-modal-action="close">CLOSE</button>`);
  }

  function showTermsPage() {
    openModal(`<span class="kicker">TERMS</span><h2>Responsible analysis</h2><p class="modal-copy">Vertex provides informational football analysis. Predictions are probabilistic and are not guarantees or financial advice.</p><button data-modal-action="close">CLOSE</button>`);
  }

  function showPrivacyPage() {
    openModal(`<span class="kicker">PRIVACY</span><h2>Privacy</h2><p class="modal-copy">Authentication is handled through Supabase. Third-party football, weather and news API secrets are kept server-side.</p><button data-modal-action="close">CLOSE</button>`);
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const tabLink = event.target.closest('.nav a[data-tab]');
      if (tabLink) {
        event.preventDefault();
        activateTab(tabLink.dataset.tab);
        return;
      }

      const actionButton = event.target.closest('[data-action]');
      if (actionButton) {
        const action = actionButton.dataset.action;
        if (action === 'save-analysis') saveCurrentAnalysis();
        if (action === 'copy-analysis') copyCurrentAnalysis();
        if (action === 'edit-strategy') showStrategySetup();
        if (action === 'scan-strategy') scanStrategyMatches();
      }

      const analyzeMatch = event.target.closest('[data-analyze-match]');
      if (analyzeMatch) {
        const match = analyzeMatch.dataset.analyzeMatch;
        setMatchInputs(match);
        activateTab('analyzer', { bypassAuth: true });
        const parsed = parseMatchInput(match);
        if (parsed) performAnalysis(parsed.home, parsed.away);
      }

      const modalAction = event.target.closest('[data-modal-action]');
      if (modalAction) {
        const action = modalAction.dataset.modalAction;
        const targetTab = modalAction.dataset.targetTab || '';
        if (action === 'close') closeModal();
        if (action === 'signup') showSignupModal(targetTab);
        if (action === 'login') showLoginModal(targetTab);
        if (action === 'do-signup') signup(targetTab);
        if (action === 'do-login') login(targetTab);
        if (action === 'logout') logout();
        if (action === 'open-strategy') { closeModal(); activateTab('strategy', { bypassAuth: true }); }
      }
    });

    on('logo', 'click', (event) => { event.preventDefault(); activateTab('home', { bypassAuth: true }); });
    on('btnAnalyze', 'click', startHomeAnalysis);
    on('btnAnalyzeMatch', 'click', startAnalyzerAnalysis);
    on('btnLogin', 'click', (event) => { event.preventDefault(); showLoginModal(); });
    on('btnSignup', 'click', (event) => { event.preventDefault(); showSignupModal(); });
    on('btnCabinet', 'click', (event) => { event.preventDefault(); showCabinet(); });
    on('btnRefreshLive', 'click', loadLiveMatches);
    on('btnSubmitReview', 'click', submitReview);
    on('linkAbout', 'click', (event) => { event.preventDefault(); showAboutPage(); });
    on('linkTerms', 'click', (event) => { event.preventDefault(); showTermsPage(); });
    on('linkPrivacy', 'click', (event) => { event.preventDefault(); showPrivacyPage(); });

    on('mobileMenuButton', 'click', () => {
      const nav = byId('nav');
      const button = byId('mobileMenuButton');
      if (!nav || !button) return;
      const open = nav.classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
    });

    byId('modalOverlay')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeModal();
    });

    qsa('.star-rating').forEach((star) => star.addEventListener('click', () => {
      selectedRating = Number(star.dataset.rating || 5);
      qsa('.star-rating').forEach((item) => item.classList.toggle('active', Number(item.dataset.rating) <= selectedRating));
    }));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });
  }

  function tabFromHash() {
    const value = window.location.hash.replace(/^#\/?/, '').trim();
    return byId(`tab-${value}`) ? value : 'home';
  }

  async function checkHealth() {
    try {
      const health = await fetchJson('/api/health');
      document.documentElement.dataset.engineReady = health.ok ? 'true' : 'false';
      document.documentElement.dataset.rapidReady = health.services?.rapidApi ? 'true' : 'false';
    } catch (_) {
      document.documentElement.dataset.engineReady = 'false';
    }
  }

  async function boot() {
    try {
      if (byId('footerYear')) byId('footerYear').textContent = new Date().getFullYear();
      bindEvents();
      bindSearch('searchInput', 'suggestions', startHomeAnalysis);
      bindSearch('analyzerSearch', 'analyzerSuggestions', startAnalyzerAnalysis);
      await initAuth();
      const initialTab = tabFromHash();
      activateTab(initialTab, { bypassAuth: initialTab === 'home' || !isProtected(initialTab) });
      checkHealth();
      console.info('[Vertex] UI initialized');
    } catch (error) {
      console.error('[Vertex] boot failed:', error);
      document.documentElement.dataset.engineReady = 'false';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
