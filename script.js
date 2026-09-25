'use strict';

(() => {
  const SUPABASE_URL = 'https://bznjdzgtiddggcdhxadj.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_kWwttoQARBmC6H_NqsEL_A_A5I7wDON';
  const SUPPORT_EMAIL = 'vertexsoccerai@outlook.com';

  let supabaseClient = null;
  let currentUser = null;
  let selectedRating = 5;
  let suggestionTimer = null;
  let suggestionRequest = null;
  let suggestionRevision = 0;
  let lastAnalysis = null;
  let liveLoaded = false;
  let reviewRows = null;
  let reviewsVisible = 6;
  let reviewAllowance = null;
  let reviewOwner = null;
  let reviewSubmitting = false;
  let leaderboardRows = null;

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
  const tr = (text,vars={}) => window.VertexI18n?.t(text,vars) || text;
  const errorKey = (error,fallback) => window.VertexI18n?.errorKey(error,fallback) || fallback;
  function localizedHTML(target,html) { if(target){target.innerHTML=html;window.VertexI18n?.apply(target);} }

  function fmtDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(window.VertexI18n?.getLocale() || 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function showToast(message, ms = 3400) {
    const toast = byId('toast');
    if (!toast) return;
    if(window.VertexI18n) window.VertexI18n.setText(toast,message); else toast.textContent=message;
    toast.classList.remove('hidden');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add('hidden'), ms);
  }

  function openModal(html) {
    const overlay = byId('modalOverlay');
    const content = byId('modalContent');
    if (!overlay || !content) return;
    content.innerHTML = html;
    delete content.dataset.legalKind;
    content.removeAttribute('data-i18n-owned');
    window.VertexI18n?.apply?.(content);
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => content.querySelector('input, button, select, textarea')?.focus());
  }

  function closeModal() {
    byId('modalOverlay')?.classList.add('hidden');
  }

  function requireAccount(targetTab = 'analyzer') {
    if (currentUser) return true;
    showAccessModal(targetTab);
    return false;
  }

  window.VertexAccess = { signedIn: () => Boolean(currentUser), requireAccount };

  function closeMobileNav() {
    byId('nav')?.classList.remove('open');
    byId('mobileMenuButton')?.setAttribute('aria-expanded', 'false');
  }

  function activateTab(tabId) {
    if (tabId === 'results') tabId = 'season';
    const target = byId(`tab-${tabId}`);
    if (!target) {
      console.warn('[Vertex] Missing tab:', tabId);
      return false;
    }

    qsa('.tab-content').forEach((section) => section.classList.remove('active'));
    target.classList.add('active');
    qsa('.nav a[data-tab]').forEach((link) => link.classList.toggle('active', link.dataset.tab === tabId));
    qsa('.nav a[data-tab]').forEach((link) => {
      if (link.dataset.tab === tabId) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    closeMobileNav();

    if (history.replaceState) history.replaceState(null, '', tabId === 'home' ? '#/' : `#/${tabId}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabId === 'leaderboard') loadLeaderboard();
    if (tabId === 'reviews') loadReviews();
    if (tabId === 'strategy') renderStrategy();
    window.VertexI18n?.apply?.(target);
    return true;
  }

  function showAccessModal(targetTab = 'analyzer') {
    openModal(`
      <span class="kicker">VERTEX ACCESS</span>
      <h2>Sign in to continue</h2>
      <p class="modal-copy">Explore every section freely. Create a free account to run analyses, use your strategy and save your work.</p>
      <button data-modal-action="signup" data-target-tab="${escapeHtml(targetTab)}">CREATE FREE ACCOUNT</button>
      <button class="btn-close-modal" data-modal-action="login" data-target-tab="${escapeHtml(targetTab)}">SIGN IN</button>
      <button class="btn-close-modal" data-modal-action="close">CLOSE</button>
    `);
  }

  function showSignupModal(targetTab = '') {
    openModal(`
      <span class="kicker">VERTEX ACCOUNT</span>
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
      supabaseClient = window.__vertexSupabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      window.__vertexSupabaseClient = supabaseClient;
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      currentUser = data?.session?.user || null;
      updateAuthUI();
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        // Run UI effects outside the Supabase auth lock (they can request a session).
        setTimeout(updateAuthUI, 0);
      });
    } catch (error) {
      console.error('[Vertex] Auth init:', error);
      showToast('Authentication is temporarily unavailable. Public pages still work.');
    }
  }

  function updateAuthUI() {
    window.VertexGuide?.onSession(supabaseClient, currentUser);
    if (reviewOwner !== (currentUser?.id || null)) {
      reviewOwner = currentUser?.id || null;
      reviewAllowance = null;
      renderReviewAllowance();
      if (byId('tab-reviews')?.classList.contains('active')) setTimeout(loadReviewAllowance, 0);
    }
    byId('btnLogin')?.classList.toggle('hidden', Boolean(currentUser));
    byId('btnSignup')?.classList.toggle('hidden', Boolean(currentUser));
    byId('btnCabinet')?.classList.toggle('hidden', !currentUser);
    byId('reviewForm')?.classList.toggle('hidden', !currentUser);
    byId('reviewGuest')?.classList.toggle('hidden', Boolean(currentUser));
    if (reviewRows) renderReviews();
    renderStrategy();
  }

  async function signup(targetTab = '') {
    const email = byId('signupEmail')?.value.trim();
    const password = byId('signupPassword')?.value || '';
    if (!email || password.length < 6) return showToast('Enter a valid email and a password of at least 6 characters.');
    if (!supabaseClient) return showToast('Authentication service is unavailable.');

    try {
      const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/` } });
      if (error) throw error;
      closeModal();
      if (data?.session) {
        currentUser = data.user;
        updateAuthUI();
        showToast('Account created. Vertex is unlocked.');
        if (targetTab) activateTab(targetTab);
      } else {
        showToast('Verification email sent. Confirm your email, then sign in.', 6000);
      }
    } catch (error) {
      showToast(errorKey(error,'Could not create your account. Please try again.'), 5000);
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
      if (targetTab) activateTab(targetTab);
    } catch (error) {
      showToast(errorKey(error,'Could not sign in. Please try again.'), 5000);
    }
  }

  async function logout() {
    try { await supabaseClient?.auth.signOut(); } catch (_) {}
    currentUser = null;
    closeModal();
    updateAuthUI();
    activateTab('home');
    showToast('Signed out.');
  }

  async function fetchJson(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const externalSignal = options?.signal;
    const forwardAbort = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    else externalSignal?.addEventListener?.('abort', forwardAbort, { once: true });

    const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 15000));
    const { signal: _ignoredSignal, ...fetchOptions } = options || {};
    try {
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data?.error || `Request failed (${response.status})`);
        error.status = response.status;
        error.code = data?.code;
        error.details = data;
        throw error;
      }
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error('Analysis took too long. Please try again — the request was stopped safely.');
        timeoutError.code = 'REQUEST_TIMEOUT';
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener?.('abort', forwardAbort);
    }
  }

  function matchParts(value) {
    return window.VertexMatchInput.parts(value);
  }

  function parseMatchInput(value) {
    return window.VertexMatchInput.parse(value);
  }

  function suggestionQuery(value) {
    const split = matchParts(value);
    return split.at(-1)?.trim() || '';
  }

  function applySuggestion(original, teamName) {
    const parts = matchParts(original);
    return parts.length === 2 ? `${parts[0].trim()} vs ${teamName}` : teamName;
  }

  function hideSuggestions(input, box) {
    suggestionRevision += 1;
    clearTimeout(suggestionTimer);
    suggestionRequest?.abort();
    box.classList.remove('active');
    box.innerHTML = '';
    box.setAttribute('aria-hidden', 'true');
    input.setAttribute('aria-expanded', 'false');
  }

  async function showSuggestions(input, box) {
    const query = suggestionQuery(input.value);
    if (query.length < 2 || document.activeElement !== input || document.documentElement.dataset.analysisBusy === 'true') return;
    const revision = ++suggestionRevision;
    const original = input.value;
    suggestionRequest = new AbortController();

    try {
      const data = await fetchJson(`/api/team-search?q=${encodeURIComponent(query)}`, { signal: suggestionRequest.signal });
      if (revision !== suggestionRevision || input.value !== original || document.activeElement !== input) return;
      const teams = data.teams || [];
      if (!teams.length) throw new Error('No suggestions');
      box.innerHTML = teams.slice(0, 8).map((team) => `
        <button class="suggestion-item" type="button" data-team-name="${escapeHtml(team.name)}">
          <strong>${escapeHtml(team.name)}</strong>
          <small>${escapeHtml([team.league, window.VertexLocaleContent?.country(team.country,window.VertexI18n.getLanguage()) || team.country].filter(Boolean).join(' · '))}</small>
        </button>
      `).join('');
      box.classList.add('active');
      box.setAttribute('aria-hidden', 'false');
      input.setAttribute('aria-expanded', 'true');
    } catch (_) {
      if (revision === suggestionRevision) hideSuggestions(input, box);
    }
  }

  function bindSearch(inputId, suggestionsId, submitHandler) {
    const input = byId(inputId);
    const box = byId(suggestionsId);
    if (!input || !box) return;

    input.addEventListener('input', () => {
      hideSuggestions(input, box);
      suggestionTimer = setTimeout(() => showSuggestions(input, box), 220);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideSuggestions(input, box);
      if (event.key === 'ArrowDown' && box.classList.contains('active')) {
        event.preventDefault();
        box.querySelector('button')?.focus();
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        hideSuggestions(input, box);
        submitHandler();
      }
    });

    box.addEventListener('click', (event) => {
      const item = event.target.closest('[data-team-name]');
      if (!item) return;
      input.value = applySuggestion(input.value, item.dataset.teamName);
      hideSuggestions(input, box);
      input.focus();
    });
    document.addEventListener('vertex:suggestions-close', () => hideSuggestions(input, box));
    box.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      hideSuggestions(input, box);
      input.focus();
    });
  }

  function setMatchInputs(value) {
    if (byId('searchInput')) byId('searchInput').value = value;
    if (byId('analyzerSearch')) byId('analyzerSearch').value = value;
  }

  let analysisUiPromise = null;
  let analysisInFlight = null;
  function ensureAnalysisUi() {
    if (window.VertexAnalysisUI?.acceptAnalysis) return Promise.resolve(true);
    if (analysisUiPromise) return analysisUiPromise;
    analysisUiPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[src^="analysis-ui-v4.js"]');
      if (existing) {
        const started = Date.now();
        const wait = () => {
          if (window.VertexAnalysisUI?.acceptAnalysis) return resolve(true);
          if (Date.now() - started > 2500) return resolve(false);
          setTimeout(wait, 40);
        };
        wait();
        return;
      }
      const script = document.createElement('script');
      script.src = 'analysis-ui-v4.js?v=21';
      script.async = false;
      script.onload = () => resolve(Boolean(window.VertexAnalysisUI?.acceptAnalysis));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    }).finally(() => { analysisUiPromise = null; });
    return analysisUiPromise;
  }

  function startHomeAnalysis() {
    if (!currentUser) return showAccessModal('analyzer');
    const parsed = parseMatchInput(byId('searchInput')?.value);
    if (!parsed) return showToast('Use the format “Home Team vs Away Team”.');
    setMatchInputs(`${parsed.home} vs ${parsed.away}`);
    activateTab('analyzer');
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
    if (!requireAccount('analyzer')) return;
    const target = byId('analysisResult');
    if (!target) return;
    if (analysisInFlight) return analysisInFlight;

    const state = window.VertexAnalyzerState;
    if (state?.isBusy?.()) return;

    analysisInFlight = (async () => {
      const began = state?.begin?.() ?? true;
      if (!began) return;

      try {
        const uiReady = await ensureAnalysisUi();
        if (!state) localizedHTML(target,'<div class="loading-state">Collecting match data and calculating the Vertex model…</div>');

        // Vercel Fluid Compute allows the server enough time for cold provider calls.
        // Keep a client-side upper bound so a broken upstream can never leave the UI stuck.
        const data = await fetchJson(
          `/api/analyze?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`,
          {},
          55000
        );
        if (!data?.analysis) throw new Error('Analysis providers did not return a usable result.');

        lastAnalysis = data.analysis;

        // Production has one report renderer. Avoid dispatching a second render
        // when UX7 is already present.
        if (uiReady && window.VertexAnalysisUI?.acceptAnalysis) {
          window.VertexAnalysisUI.acceptAnalysis(data.analysis);
        } else {
          localizedHTML(target,renderAnalysis(data.analysis));
          rememberAnalysis(data.analysis);
        }

        // Activity is non-critical. Do not block rendering on this write.
        incrementActivity();

        // Give Chromium a paint opportunity before re-enabling particles/buttons.
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      } catch (error) {
        const message = errorKey(error,'Analysis is temporarily unavailable. Please try again.');
        if (error.code === 'TEAM_AMBIGUOUS' && Array.isArray(error.details?.teams)) {
          localizedHTML(target, `<div class="analysis-error"><strong>Clarify the team</strong><p>Several clubs share this name. Choose a club below or enter its full name.</p>${error.details.teams.map(team => `<div class="analyzer-team-choices"><p>${escapeHtml(team.input)}</p>${team.candidates.map(club => `<button type="button" class="btn-outline" data-resolve-side="${escapeHtml(team.side)}" data-resolve-team="${escapeHtml(club.name)}">${escapeHtml(club.name)} · ${escapeHtml(window.VertexLocaleContent?.country(club.country, window.VertexI18n.getLanguage()) || club.country)}</button>`).join('')}</div>`).join('')}</div>`);
        } else {
          const signIn = error.status === 401 ? '<button type="button" class="btn-outline" data-modal-action="login" data-target-tab="analyzer">Sign in to continue</button>' : '';
          localizedHTML(target,`<div class="analysis-error"><strong>ANALYSIS UNAVAILABLE</strong><p data-i18n="${escapeHtml(message)}">${escapeHtml(tr(message))}</p>${signIn}</div>`);
        }
      } finally {
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        state?.end?.();
      }
    })().finally(() => {
      analysisInFlight = null;
    });

    return analysisInFlight;
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
    if (!requireAccount('analyzer')) return;
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
    if (!requireAccount('analyzer')) return;
    if (!lastAnalysis) return;
    const summary = [
      `Vertex Soccer AI — ${analysisKey(lastAnalysis)}`,
      `${tr('Data quality')}: ${lastAnalysis.dataQuality ?? '—'}%`,
      lastAnalysis.confidence != null ? `${tr('Confidence')}: ${lastAnalysis.confidence}%` : null,
      lastAnalysis.model ? `${tr('Main scenario')}: ${lastAnalysis.model.mainScenario}` : tr('Prediction withheld: insufficient verified data')
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(summary);
      showToast('Analysis summary copied.');
    } catch (_) {
      showToast('Clipboard permission is unavailable.');
    }
  }

  function getStrategyProfile() {
    return currentUser ? window.VertexStrategy?.profile() || null : null;
  }

  function renderStrategy() {
    window.VertexStrategy?.mount(currentUser?.id || null);
  }

  function showStrategySetup() {
    window.VertexStrategy?.edit();
  }

  function scanStrategyMatches() {
    window.VertexStrategy?.scan();
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

  async function loadPerformance() {
    const evaluated = byId('perfEvaluated');
    const correct = byId('perfCorrect');
    const accuracy = byId('perfAccuracy');
    const quality = byId('perfQuality');
    if (!evaluated || !correct || !accuracy || !quality) return;

    evaluated.textContent = '…';
    correct.textContent = '…';
    accuracy.textContent = '…';
    quality.textContent = '…';

    try {
      const data = await fetchJson('/api/results');
      const summary = data?.summary || {};
      const count = Number(summary.evaluated || 0);
      evaluated.textContent = String(count);
      correct.textContent = String(Number(summary.correct || 0));
      accuracy.textContent = count && summary.accuracy != null && Number.isFinite(Number(summary.accuracy)) ? `${Math.round(Number(summary.accuracy))}%` : '—';
      quality.textContent = summary.averageDataQuality != null && Number.isFinite(Number(summary.averageDataQuality)) ? `${Math.round(Number(summary.averageDataQuality))}%` : '—';
      const details = byId('performanceDetails');
      if (details) {
        const language = window.VertexI18n?.getLanguage?.() || 'en';
        const words = {
          ru: ['Завершённых матчей', 'Результаты по рынкам', 'Выборок', 'Угадано', 'Частота попаданий', 'История ещё накапливается. Несколько рынков одного матча не являются независимыми прогнозами. Калибровка точности не выполнена.', 'Ошибка вероятностей Brier: меньше — лучше. Рассчитана для выбранного исхода каждого рынка; это не оценка всего распределения 1X2.'],
          es: ['Partidos finalizados', 'Resultados por mercado', 'Muestras', 'Aciertos', 'Tasa observada', 'El historial sigue creciendo. Los mercados de un partido no son pronósticos independientes. La precisión aún no está calibrada.', 'Error Brier: cuanto menor, mejor. Evalúa la selección de cada mercado, no toda la distribución 1X2.'],
          en: ['Completed fixtures', 'Results by market', 'Samples', 'Correct', 'Observed hit rate', 'History is still being collected. Markets from one match are not independent predictions. Accuracy has not been calibrated.', 'Brier error: lower is better. Scored for the selected event in each market, not the full 1X2 distribution.']
        }[language] || [];
        const marketNames = {
          ru: {'1X2':'Исход 1X2', GOALS_OU_2_5:'Тотал 2,5', BTTS:'Обе забьют', DOUBLE_CHANCE:'Двойной шанс'},
          es: {'1X2':'Resultado 1X2', GOALS_OU_2_5:'Total 2,5', BTTS:'Ambos marcan', DOUBLE_CHANCE:'Doble oportunidad'},
          en: {'1X2':'Result 1X2', GOALS_OU_2_5:'Total 2.5', BTTS:'Both teams score', DOUBLE_CHANCE:'Double chance'}
        };
        details.innerHTML = `<p><strong>${words[0]}: ${Number(summary.fixtures || 0)}</strong></p><p>${words[5]}</p><div class="v8-table-wrap"><table class="v8-goal-table"><caption>${words[1]}</caption><thead><tr><th>${words[2]}</th><th>${words[3]}</th><th>${words[4]}</th><th>Brier</th></tr></thead><tbody>${Object.entries(summary.byMarket || {}).map(([market, row]) => `<tr><th scope="row">${escapeHtml(marketNames[language]?.[market] || market)} · ${Number(row.evaluated)}</th><td>${Number(row.correct)}</td><td>${row.accuracy == null ? '—' : `${Number(row.accuracy)}%`}</td><td>${row.brierScore == null ? '—' : Number(row.brierScore).toFixed(3)}</td></tr>`).join('')}</tbody></table></div><p class="v8-note">${words[6]}</p>`;
      }
    } catch (error) {
      evaluated.textContent = '—';
      correct.textContent = '—';
      accuracy.textContent = '—';
      quality.textContent = '—';
      console.warn('[Vertex] results:', error?.message || error);
    }
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

  function renderLeaderboard() {
    if (!leaderboardRows) return;
    const target=byId('leaderboard');
    const html=leaderboardRows.length ? leaderboardRows.map((row,index)=>`<div class="result-row"><span>#${index+1} ${escapeHtml(tr('Vertex member'))}</span><strong>${escapeHtml(tr('{count} analyses',{count:Number(row.analyses_count||0)}))}</strong></div>`).join('') : `<div class="empty-state"><p>${escapeHtml(tr('No analysis activity yet.'))}</p></div>`;
    target.innerHTML=`<div data-i18n-owned>${html}</div>`;
  }

  async function loadLeaderboard() {
    const target = byId('leaderboard');
    if (!target) return;
    if (!supabaseClient) return localizedHTML(target,'<div class="empty-state"><p>Community database is unavailable.</p></div>');
    localizedHTML(target,'<div class="loading-state">Loading community activity…</div>');
    try {
      const { data, error } = await supabaseClient.from('activity').select('user_id, analyses_count').order('analyses_count', { ascending: false }).limit(20);
      if (error) throw error;
      leaderboardRows=data||[];
      renderLeaderboard();
    } catch (error) {
      leaderboardRows=null;
      localizedHTML(target,'<div class="analysis-error"><p>Could not load community activity. Please try again.</p></div>');
    }
  }

  function reviewWords() {
    const language = window.VertexI18n?.getLanguage?.() || 'en';
    return {
      ru: { member: 'Участник Vertex', own: 'Ваш отзыв', more: 'Читать полностью', less: 'Свернуть', next: 'Показать ещё отзывы', count: 'Показано', of: 'из последних', empty: 'Пока нет отзывов. Поделитесь первым впечатлением о Vertex.', unavailable: 'Не удалось загрузить отзывы. Попробуйте открыть вкладку ещё раз.' },
      es: { member: 'Miembro de Vertex', own: 'Tu reseña', more: 'Leer más', less: 'Leer menos', next: 'Mostrar más reseñas', count: 'Mostrando', of: 'de las últimas', empty: 'Aún no hay reseñas. Comparte tu experiencia con Vertex.', unavailable: 'No se pudieron cargar las reseñas. Vuelve a abrir esta sección.' },
      en: { member: 'Vertex member', own: 'Your review', more: 'Read more', less: 'Show less', next: 'Show more reviews', count: 'Showing', of: 'of the latest', empty: 'No reviews yet. Share your experience with Vertex.', unavailable: 'Could not load reviews. Please open this section again.' }
    }[language];
  }

  function renderReviews() {
    if (!reviewRows) return;
    const list = byId('reviewsList');
    if (!list) return;
    const words = reviewWords();
    const locale = window.VertexI18n?.getLocale?.() || 'en-GB';
    list.innerHTML = reviewRows.length ? reviewRows.slice(0, reviewsVisible).map((review, index) => {
      const rating = clamp(Math.round(Number(review.rating) || 0), 0, 5);
      const text = String(review.review_text || '').trim();
      const long = text.length > 220 || text.split('\n').length > 4;
      const excerpt = text.replace(/\s+/g, ' ').slice(0, 220);
      const date = new Date(review.created_at);
      const dateLabel = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
      const author = currentUser?.id === review.user_id ? words.own : words.member;
      const body = long ? `<details class="review-details"><summary><span class="review-excerpt" translate="no">${escapeHtml(excerpt)}…</span><span class="review-read-more">${words.more}</span><span class="review-read-less">${words.less}</span></summary><p class="review-text" translate="no">${escapeHtml(text)}</p></details>` : `<p class="review-text" translate="no">${escapeHtml(text)}</p>`;
      return `<article class="review-card"><header class="review-card-header"><span class="review-avatar" aria-hidden="true">V</span><div><strong>${escapeHtml(author)}</strong><time datetime="${escapeHtml(review.created_at || '')}">${escapeHtml(dateLabel)}</time></div><span class="review-score">${rating}<small> / 5</small></span></header><div class="review-card-stars" aria-label="${escapeHtml(tr('Rating: {count} out of 5',{count:rating}))}"><span aria-hidden="true">${'★'.repeat(rating)}<span class="review-star-empty">${'★'.repeat(5 - rating)}</span></span></div>${body}</article>`;
    }).join('') : `<div class="empty-state"><p>${escapeHtml(words.empty)}</p></div>`;
    byId('reviewsCount').textContent = reviewRows.length ? `${words.count} ${Math.min(reviewsVisible, reviewRows.length)} ${words.of} ${reviewRows.length}` : '';
    byId('reviewsMore').textContent = words.next;
    byId('reviewsMore').classList.toggle('hidden', reviewsVisible >= reviewRows.length);
  }

  async function loadReviews() {
    const list = byId('reviewsList');
    if (!list) return;
    byId('reviewForm')?.classList.toggle('hidden', !currentUser);
    if (!supabaseClient) return localizedHTML(list,'<div class="empty-state"><p>Reviews database is unavailable.</p></div>');
    localizedHTML(list,'<div class="loading-state">Loading reviews…</div>');
    byId('reviewsCount').textContent = '';
    byId('reviewsMore').classList.add('hidden');
    try {
      const [{ data, error }] = await Promise.all([
        supabaseClient.from('reviews').select('*').order('created_at', { ascending: false }).limit(50),
        loadReviewAllowance()
      ]);
      if (error) throw error;
      reviewRows = data || [];
      reviewsVisible = 6;
      renderReviews();
    } catch (error) {
      reviewRows = null;
      localizedHTML(list,'<div class="analysis-error"><p>Could not load reviews. Please open this section again.</p></div>');
    }
  }

  function renderReviewAllowance() {
    const t = (text,vars) => window.VertexI18n?.t?.(text,vars) || text;
    const reached = reviewAllowance != null && reviewAllowance >= 2;
    const pending = reviewAllowance == null;
    const note = byId('reviewLimit');
    if (note) {
      note.textContent = reached ? t('You have published 2 of 2 reviews. Thank you for your feedback!')
        : pending ? t('Checking your review limit…') : t('Your reviews: {count} of 2. Up to 2 reviews per account.',{count:reviewAllowance});
      note.classList.toggle('reached',reached);
    }
    const disabled = !currentUser || pending || reached || reviewSubmitting;
    byId('btnSubmitReview') && (byId('btnSubmitReview').disabled = disabled);
    byId('reviewText') && (byId('reviewText').disabled = disabled);
    qsa('.star-rating').forEach(button => { button.disabled = disabled; });
  }

  async function loadReviewAllowance() {
    const id = currentUser?.id;
    if (!id || !supabaseClient) { reviewAllowance = null; renderReviewAllowance(); return; }
    try {
      const {count,error} = await supabaseClient.from('reviews').select('id',{count:'exact',head:true}).eq('user_id',id);
      if (currentUser?.id !== id) return;
      if (error || count == null) throw error || new Error('Missing review count');
      reviewAllowance = count;
      renderReviewAllowance();
    } catch (_) {
      if (currentUser?.id !== id) return;
      reviewAllowance = null;
      renderReviewAllowance();
      if (byId('reviewLimit')) byId('reviewLimit').textContent = window.VertexI18n?.t?.('Could not check your review limit. Reopen this section to retry.');
    }
  }

  async function submitReview() {
    if (!currentUser) return showAccessModal('reviews');
    if (reviewAllowance >= 2) return showToast('You have published 2 of 2 reviews. Thank you for your feedback!');
    if (reviewAllowance == null || reviewSubmitting) return;
    const text = byId('reviewText')?.value.trim();
    if (!text || text.length < 5) return showToast('Write a little more before submitting.');
    const button = byId('btnSubmitReview');
    if (button.disabled) return;
    reviewSubmitting = true;
    renderReviewAllowance();
    button.setAttribute('aria-busy', 'true');
    try {
      const { error } = await supabaseClient.from('reviews').insert([{ user_id: currentUser.id, rating: selectedRating, review_text: text.slice(0, 1000) }]);
      if (error) throw error;
      byId('reviewText').value = '';
      byId('reviewCharCount').textContent = '0 / 1000';
      showToast('Review submitted.');
      await loadReviews();
    } catch (error) {
      if (String(error.message).includes('REVIEW_LIMIT_REACHED')) showToast('You have published 2 of 2 reviews. Thank you for your feedback!');
      else showToast(errorKey(error,'Could not publish the review. Please try again.'));
    } finally {
      reviewSubmitting = false;
      await loadReviewAllowance();
      button.removeAttribute('aria-busy');
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
      const routeLink = event.target.closest('[data-route]');
      if (routeLink) {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        activateTab(routeLink.dataset.route);
        return;
      }

      const authAction = event.target.closest('[data-auth-action]');
      if (authAction) {
        event.preventDefault();
        showAccessModal(authAction.dataset.authAction);
        return;
      }

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
        if (!requireAccount('analyzer')) return;
        const match = analyzeMatch.dataset.analyzeMatch;
        setMatchInputs(match);
        activateTab('analyzer');
        const parsed = parseMatchInput(match);
        if (parsed) performAnalysis(parsed.home, parsed.away);
      }

      const teamChoice = event.target.closest('[data-resolve-team]');
      if (teamChoice) {
        const pair = parseMatchInput(byId('analyzerSearch')?.value || '');
        const side = teamChoice.dataset.resolveSide;
        if (pair && ['home', 'away'].includes(side)) {
          pair[side] = teamChoice.dataset.resolveTeam;
          setMatchInputs(`${pair.home} vs ${pair.away}`);
          startAnalyzerAnalysis();
        }
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
        if (action === 'open-strategy') { closeModal(); activateTab('strategy'); }
      }
    });

    on('logo', 'click', (event) => { event.preventDefault(); activateTab('home'); });
    on('btnAnalyze', 'click', startHomeAnalysis);
    on('btnAnalyzeMatch', 'click', startAnalyzerAnalysis);
    on('btnLogin', 'click', (event) => { event.preventDefault(); showLoginModal(); });
    on('btnSignup', 'click', (event) => { event.preventDefault(); showSignupModal(); });
    on('btnCabinet', 'click', (event) => { event.preventDefault(); showCabinet(); });
    on('btnRefreshLive', 'click', loadLiveMatches);
    on('btnSubmitReview', 'click', submitReview);
    on('reviewsMore', 'click', () => { reviewsVisible += 6; renderReviews(); });
    on('reviewText', 'input', () => { byId('reviewCharCount').textContent = `${byId('reviewText').value.length} / 1000`; });
    document.addEventListener('vertex:languagechange', () => {
      renderReviews(); renderReviewAllowance(); renderLeaderboard();
      qsa('.star-rating').forEach(button => button.setAttribute('aria-label',tr('Rate {count} out of 5',{count:button.dataset.rating})));
    });
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
      qsa('.star-rating').forEach((item) => {
        item.classList.toggle('active', Number(item.dataset.rating) <= selectedRating);
        item.setAttribute('aria-pressed', String(Number(item.dataset.rating) === selectedRating));
      });
      byId('reviewRatingValue').textContent = `${selectedRating} / 5`;
    }));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });
    window.addEventListener('hashchange', () => activateTab(tabFromHash()));
  }

  function tabFromHash() {
    const raw = window.location.hash.replace(/^#\/?/, '').trim();
    const value = raw === 'results' ? 'season' : raw;
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
      bindSearch('analyzerSearch', 'analyzerSuggestions', startAnalyzerAnalysis);
      await initAuth();
      const initialTab = tabFromHash();
      activateTab(initialTab);
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
