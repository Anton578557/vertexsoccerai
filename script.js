'use strict';

// Supabase publishable client settings are safe to use in the browser when RLS is enabled.
const SUPABASE_URL = 'https://bznjdzgtiddggcdhxadj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_kWwttoQARBmC6H_NqsEL_A_A5I7wDON';
const SUPPORT_EMAIL = 'vertexsoccerai@outlook.com';

let supabase = null;
let currentUser = null;
let selectedRating = 5;
let suggestionTimer = null;
let lastAnalysis = null;
let liveLoaded = false;

// Load the component layer without duplicating the large base stylesheet.
(() => {
  if (!document.querySelector('link[href="components.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'components.css';
    document.head.appendChild(link);
  }
})();

function byId(id) { return document.getElementById(id); }
function qs(selector, root = document) { return root.querySelector(selector); }
function qsa(selector, root = document) { return [...root.querySelectorAll(selector)]; }
function on(id, event, handler) { const el = byId(id); if (el) el.addEventListener(event, handler); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch (_) { return '#'; }
}
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function fmtDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function showToast(message, ms = 3200) {
  const toast = byId('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => toast.classList.add('hidden'), ms);
}

function closeMobileNav() {
  const nav = byId('nav');
  const button = byId('mobileMenuButton');
  if (nav) nav.classList.remove('open');
  if (button) button.setAttribute('aria-expanded', 'false');
}

function isProtected(tabId) {
  const link = qs(`.nav a[data-tab="${tabId}"]`);
  return link?.dataset.protected === 'true';
}

function switchTab(tabId, { bypassAuth = false } = {}) {
  if (!bypassAuth && isProtected(tabId) && !currentUser) {
    showAccessModal(tabId);
    return;
  }

  qsa('.tab-content').forEach((tab) => tab.classList.remove('active'));
  const active = byId(`tab-${tabId}`);
  if (!active) return;
  active.classList.add('active');

  qsa('.nav a[data-tab]').forEach((link) => {
    link.classList.toggle('active', link.dataset.tab === tabId);
  });

  closeMobileNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (tabId === 'leaderboard') loadLeaderboard();
  if (tabId === 'reviews') loadReviews();
  if (tabId === 'strategy') showStrategyDashboard();
  if (tabId === 'live' && !liveLoaded) loadLiveMatches();
  if (tabId === 'results') loadPerformance();
}

function parseMatchInput(value) {
  const text = String(value || '').trim();
  const parts = text.split(/\s+(?:vs\.?|v\.?|–|—)\s+/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  if (parts[0].length < 2 || parts[1].length < 2) return null;
  return { home: parts[0], away: parts[1] };
}

function setSearchValue(value) {
  const homeInput = byId('searchInput');
  const analyzerInput = byId('analyzerSearch');
  if (homeInput) homeInput.value = value;
  if (analyzerInput) analyzerInput.value = value;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  let data = null;
  try { data = await response.json(); } catch (_) { data = {}; }
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }
  return data;
}

function suggestionQuery(raw) {
  const text = String(raw || '').trim();
  const split = text.split(/\s+(?:vs\.?|v\.?|–|—)\s+/i);
  return split.length > 1 ? split[split.length - 1].trim() : text;
}

function applySuggestion(original, teamName) {
  const text = String(original || '').trim();
  const match = text.match(/^(.*?\s+(?:vs\.?|v\.?|–|—)\s+)(.*)$/i);
  return match ? `${match[1]}${teamName}` : teamName;
}

async function showSuggestions(input, box) {
  if (!input || !box) return;
  const q = suggestionQuery(input.value);
  if (q.length < 2) {
    box.classList.remove('active');
    box.innerHTML = '';
    return;
  }

  try {
    const data = await fetchJson(`/api/team-search?q=${encodeURIComponent(q)}`);
    const teams = data.teams || [];
    if (!teams.length) {
      box.classList.remove('active');
      box.innerHTML = '';
      return;
    }

    box.innerHTML = teams.map((team) => `
      <button class="suggestion-item" type="button" data-team-name="${escapeHtml(team.name)}">
        <strong>${escapeHtml(team.name)}</strong>
        <small>${escapeHtml([team.league, team.country].filter(Boolean).join(' · '))}</small>
      </button>
    `).join('');
    box.classList.add('active');
  } catch (_) {
    box.classList.remove('active');
  }
}

function bindSearch(inputId, suggestionsId) {
  const input = byId(inputId);
  const suggestions = byId(suggestionsId);
  if (!input || !suggestions) return;

  input.addEventListener('input', () => {
    clearTimeout(suggestionTimer);
    suggestionTimer = setTimeout(() => showSuggestions(input, suggestions), 220);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (inputId === 'searchInput') startHomeAnalysis();
      else startAnalyzerAnalysis();
    }
  });

  suggestions.addEventListener('click', (event) => {
    const item = event.target.closest('[data-team-name]');
    if (!item) return;
    input.value = applySuggestion(input.value, item.dataset.teamName);
    suggestions.classList.remove('active');
    input.focus();
  });
}

function accessRequired() {
  if (currentUser) return true;
  showAccessModal('analyzer');
  return false;
}

function startHomeAnalysis() {
  if (!accessRequired()) return;
  const value = byId('searchInput')?.value || '';
  const parsed = parseMatchInput(value);
  if (!parsed) {
    showToast('Enter a match as “Home Team vs Away Team”.');
    return;
  }
  setSearchValue(`${parsed.home} vs ${parsed.away}`);
  switchTab('analyzer', { bypassAuth: true });
  performAnalysis(parsed.home, parsed.away);
}

function startAnalyzerAnalysis() {
  if (!accessRequired()) return;
  const value = byId('analyzerSearch')?.value || '';
  const parsed = parseMatchInput(value);
  if (!parsed) {
    showToast('Enter a match as “Home Team vs Away Team”.');
    return;
  }
  performAnalysis(parsed.home, parsed.away);
}

function qualityLabel(value) {
  if (value >= 80) return 'Strong';
  if (value >= 60) return 'Good';
  if (value >= 40) return 'Limited';
  return 'Low';
}

function probabilityLevel(value) {
  if (value >= 70) return 'high';
  if (value >= 55) return 'medium';
  return 'low';
}

function formSequence(stats) {
  if (!stats?.sequence?.length) return '<span class="form-empty">No recent results</span>';
  return stats.sequence.map((result) => `<span class="form-pill form-${result.toLowerCase()}">${result}</span>`).join('');
}

function renderNews(news) {
  if (!news?.length) return '<p>No verified recent news was included in this run.</p>';
  return `<ul>${news.slice(0, 5).map((item) => {
    const title = escapeHtml(item.title);
    const source = escapeHtml(item.source || 'News');
    const signal = escapeHtml(item.signal || 'neutral');
    const href = safeUrl(item.url);
    return `<li><a href="${href}" target="_blank" rel="noopener">${title}</a><small>${source} · ${signal}</small></li>`;
  }).join('')}</ul>`;
}

function renderWeather(weather) {
  if (!weather) return '<p>Weather source was not connected or the venue location could not be resolved.</p>';
  const parts = [
    weather.tempC !== null ? `${weather.tempC}°C` : null,
    weather.condition,
    weather.humidity !== null ? `${weather.humidity}% humidity` : null,
    weather.windMs !== null ? `${weather.windMs} m/s wind` : null
  ].filter(Boolean);
  return `<p><strong>${escapeHtml(weather.location || 'Venue area')}</strong><br>${escapeHtml(parts.join(' · '))}<br><small>${escapeHtml(weather.context || '')}</small></p>`;
}

function renderAnalysis(analysis) {
  const model = analysis.model;
  const home = analysis.teams.home;
  const away = analysis.teams.away;
  const fixture = analysis.fixture || {};
  const homeForm = analysis.form?.home || {};
  const awayForm = analysis.form?.away || {};
  const quality = clamp(Number(analysis.dataQuality || 0), 0, 100);
  const confidence = analysis.confidence === null ? null : clamp(Number(analysis.confidence), 0, 100);

  const fixtureBits = [fixture.league, fmtDate(fixture.date), fixture.venue, fixture.city].filter(Boolean);
  const sourceBits = Object.entries(analysis.sourceStatus || {}).map(([key, value]) => `${key}: ${value}`);

  const modelHtml = model ? `
    <div class="quality-row">
      <div class="quality-card">
        <div class="quality-head"><span>Analysis confidence</span><strong>${confidence}%</strong></div>
        <div class="progress-track"><div class="progress-fill" style="width:${confidence}%"></div></div>
      </div>
      <div class="quality-card">
        <div class="quality-head"><span>Data quality</span><strong>${quality}% · ${qualityLabel(quality)}</strong></div>
        <div class="progress-track"><div class="progress-fill" style="width:${quality}%"></div></div>
      </div>
    </div>

    <div class="prediction-grid">
      <div class="prediction-item"><div class="prediction-label">Main scenario</div><div class="prediction-value">${escapeHtml(model.mainScenario)}</div><div class="prediction-prob prob-${probabilityLevel(Math.max(model.oneXtwo.home, model.oneXtwo.draw, model.oneXtwo.away))}">${Math.max(model.oneXtwo.home, model.oneXtwo.draw, model.oneXtwo.away)}%</div></div>
      <div class="prediction-item"><div class="prediction-label">1X2</div><div class="prediction-value">H ${model.oneXtwo.home}% · D ${model.oneXtwo.draw}% · A ${model.oneXtwo.away}%</div></div>
      <div class="prediction-item"><div class="prediction-label">Double chance 1X</div><div class="prediction-value">${model.doubleChance.oneX}%</div></div>
      <div class="prediction-item"><div class="prediction-label">Over 2.5 goals</div><div class="prediction-value">${model.over25}%</div><div class="prediction-prob prob-${probabilityLevel(model.over25)}">${model.over25}%</div></div>
      <div class="prediction-item"><div class="prediction-label">Under 2.5 goals</div><div class="prediction-value">${model.under25}%</div></div>
      <div class="prediction-item"><div class="prediction-label">Both teams score</div><div class="prediction-value">${model.btts}% YES</div></div>
      <div class="prediction-item"><div class="prediction-label">Expected goals</div><div class="prediction-value">${model.expectedGoals.home} — ${model.expectedGoals.away}</div><div class="prediction-prob prob-medium">${model.expectedGoals.total}</div></div>
      <div class="prediction-item"><div class="prediction-label">Most likely score</div><div class="prediction-value">${escapeHtml(model.correctScore)}</div><div class="prediction-prob prob-low">${model.correctScoreProbability}%</div></div>
    </div>

    <div class="verdict-box">
      <div class="verdict-title">VERTEX MATCH VERDICT</div>
      <div class="verdict-text">Primary statistical scenario: <strong>${escapeHtml(model.mainScenario)}</strong>. The model uses recent completed-match scoring rates and a Poisson probability distribution. Confidence is reduced automatically when input coverage is incomplete.</div>
    </div>
  ` : `
    <div class="analysis-error">
      <strong>NOT ENOUGH VERIFIED MATCH DATA</strong>
      <p>Vertex resolved the teams, but the connected providers did not return enough completed matches for a responsible probability calculation. No fake percentages were generated.</p>
    </div>
  `;

  const limitations = analysis.limitations?.length
    ? `<ul>${analysis.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p>No major data limitations reported for this run.</p>';

  return `
    <div class="analysis-card">
      <div class="analysis-header">
        <div class="analysis-team">
          ${home.badge ? `<img src="${safeUrl(home.badge)}" alt="">` : ''}
          <strong>${escapeHtml(home.name)}</strong>
          <small>${escapeHtml(home.country || '')}</small>
        </div>
        <div class="analysis-vs">VS</div>
        <div class="analysis-team">
          ${away.badge ? `<img src="${safeUrl(away.badge)}" alt="">` : ''}
          <strong>${escapeHtml(away.name)}</strong>
          <small>${escapeHtml(away.country || '')}</small>
        </div>
      </div>

      <div class="analysis-meta-line">${escapeHtml(fixtureBits.length ? fixtureBits.join(' · ') : 'Fixture metadata is limited for this run')}</div>

      <div class="metric-grid">
        <div class="metric-card"><span>${escapeHtml(home.name)} form</span><strong class="form-sequence">${formSequence(homeForm)}</strong><em>${homeForm.played || 0} matches sampled</em></div>
        <div class="metric-card"><span>${escapeHtml(away.name)} form</span><strong class="form-sequence">${formSequence(awayForm)}</strong><em>${awayForm.played || 0} matches sampled</em></div>
        <div class="metric-card"><span>Home goals / match</span><strong>${homeForm.avgFor !== null && homeForm.avgFor !== undefined ? Number(homeForm.avgFor).toFixed(2) : '—'}</strong><em>Conceded ${homeForm.avgAgainst !== null && homeForm.avgAgainst !== undefined ? Number(homeForm.avgAgainst).toFixed(2) : '—'}</em></div>
        <div class="metric-card"><span>Away goals / match</span><strong>${awayForm.avgFor !== null && awayForm.avgFor !== undefined ? Number(awayForm.avgFor).toFixed(2) : '—'}</strong><em>Conceded ${awayForm.avgAgainst !== null && awayForm.avgAgainst !== undefined ? Number(awayForm.avgAgainst).toFixed(2) : '—'}</em></div>
      </div>

      ${modelHtml}

      <div class="data-evidence">
        <div class="evidence-card"><h4>WEATHER / VENUE CONTEXT</h4>${renderWeather(analysis.weather)}</div>
        <div class="evidence-card news-evidence"><h4>RECENT NEWS SIGNALS</h4>${renderNews(analysis.news)}</div>
        <div class="evidence-card"><h4>DATA SOURCES USED</h4><p>${escapeHtml(sourceBits.join(' · '))}</p></div>
        <div class="evidence-card"><h4>LIMITATIONS</h4>${limitations}</div>
      </div>

      <div class="strategy-actions">
        <button class="btn-secondary" type="button" data-action="save-analysis">SAVE ANALYSIS</button>
        <button class="btn-secondary" type="button" data-action="copy-analysis">COPY SUMMARY</button>
      </div>
    </div>
  `;
}

async function performAnalysis(home, away) {
  const result = byId('analysisResult');
  if (!result) return;
  result.innerHTML = `<div class="loading-state">Vertex is resolving teams, collecting data and calculating the model…</div>`;

  try {
    const data = await fetchJson(`/api/analyze?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`);
    lastAnalysis = data.analysis;
    result.innerHTML = renderAnalysis(data.analysis);
    rememberAnalysis(data.analysis);
    await incrementActivity();
  } catch (error) {
    result.innerHTML = `<div class="analysis-error"><strong>ANALYSIS UNAVAILABLE</strong><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function analysisKey(analysis) {
  return `${analysis.teams?.home?.name || 'Home'} vs ${analysis.teams?.away?.name || 'Away'}`;
}

function recentAnalyses() {
  try { return JSON.parse(localStorage.getItem('vertex_recent_analyses') || '[]'); }
  catch (_) { return []; }
}

function savedAnalyses() {
  try { return JSON.parse(localStorage.getItem('vertex_saved_analyses') || '[]'); }
  catch (_) { return []; }
}

function rememberAnalysis(analysis) {
  const row = {
    match: analysisKey(analysis),
    date: new Date().toISOString(),
    confidence: analysis.confidence,
    dataQuality: analysis.dataQuality,
    mainScenario: analysis.model?.mainScenario || null
  };
  const list = [row, ...recentAnalyses().filter((item) => item.match !== row.match)].slice(0, 20);
  localStorage.setItem('vertex_recent_analyses', JSON.stringify(list));
}

function saveCurrentAnalysis() {
  if (!lastAnalysis) return showToast('Run an analysis first.');
  const match = analysisKey(lastAnalysis);
  const row = {
    match,
    savedAt: new Date().toISOString(),
    confidence: lastAnalysis.confidence,
    dataQuality: lastAnalysis.dataQuality,
    mainScenario: lastAnalysis.model?.mainScenario || null,
    expectedGoals: lastAnalysis.model?.expectedGoals || null
  };
  const list = [row, ...savedAnalyses().filter((item) => item.match !== match)].slice(0, 50);
  localStorage.setItem('vertex_saved_analyses', JSON.stringify(list));
  showToast('Analysis saved to My Cabinet.');
}

async function copyCurrentAnalysis() {
  if (!lastAnalysis) return;
  const model = lastAnalysis.model;
  const summary = [
    `Vertex Soccer AI — ${analysisKey(lastAnalysis)}`,
    `Data quality: ${lastAnalysis.dataQuality}%`,
    lastAnalysis.confidence !== null ? `Confidence: ${lastAnalysis.confidence}%` : null,
    model ? `Main scenario: ${model.mainScenario}` : 'Prediction withheld: insufficient verified data',
    model ? `1X2: ${model.oneXtwo.home}% / ${model.oneXtwo.draw}% / ${model.oneXtwo.away}%` : null,
    model ? `Expected goals: ${model.expectedGoals.home} - ${model.expectedGoals.away}` : null
  ].filter(Boolean).join('\n');
  try {
    await navigator.clipboard.writeText(summary);
    showToast('Analysis summary copied.');
  } catch (_) {
    showToast('Clipboard permission was not available.');
  }
}

function getStrategyProfile() {
  try { return JSON.parse(localStorage.getItem('vertex_strategy_profile') || 'null'); }
  catch (_) { return null; }
}

function showStrategySetup() {
  const content = byId('strategyContent');
  if (!content) return;
  const previous = getStrategyProfile() || {};
  const selectedLeagues = new Set(previous.leagues || ['Premier League', 'La Liga', 'Bundesliga']);
  const selectedMarkets = new Set(previous.markets || ['1X2', 'Goals']);
  const leagues = ['Premier League','La Liga','Serie A','Bundesliga','Ligue 1','Champions League','Europa League','Eredivisie','Primeira Liga','Saudi Pro League','J1 League','Thai League','Liga 1 Indonesia'];
  const markets = ['1X2','Double Chance','Goals','BTTS','Corners','Cards'];

  content.innerHTML = `
    <form class="strategy-form" id="strategyForm">
      <div class="form-grid">
        <div class="field"><label>Bankroll reference</label><input id="strategyBankroll" type="number" min="1" step="1" value="${escapeHtml(previous.bankroll || 1000)}"></div>
        <div class="field"><label>Experience</label><select id="strategyExperience"><option ${previous.experience === 'Beginner' ? 'selected' : ''}>Beginner</option><option ${!previous.experience || previous.experience === 'Intermediate' ? 'selected' : ''}>Intermediate</option><option ${previous.experience === 'Advanced' ? 'selected' : ''}>Advanced</option></select></div>
        <div class="field"><label>Risk profile</label><select id="strategyRisk"><option ${previous.risk === 'Conservative' ? 'selected' : ''}>Conservative</option><option ${!previous.risk || previous.risk === 'Balanced' ? 'selected' : ''}>Balanced</option><option ${previous.risk === 'Aggressive' ? 'selected' : ''}>Aggressive</option></select></div>
        <div class="field"><label>Objective</label><select id="strategyObjective"><option ${previous.objective === 'Protect bankroll' ? 'selected' : ''}>Protect bankroll</option><option ${!previous.objective || previous.objective === 'Controlled growth' ? 'selected' : ''}>Controlled growth</option><option ${previous.objective === 'Learn disciplined analysis' ? 'selected' : ''}>Learn disciplined analysis</option><option ${previous.objective === 'Higher variance' ? 'selected' : ''}>Higher variance</option></select></div>
        <div class="field full"><label>Preferred leagues</label><div class="league-options">${leagues.map((item) => `<label class="check-chip"><input type="checkbox" name="strategyLeague" value="${escapeHtml(item)}" ${selectedLeagues.has(item) ? 'checked' : ''}><span>${escapeHtml(item)}</span></label>`).join('')}</div></div>
        <div class="field full"><label>Preferred markets</label><div class="market-options">${markets.map((item) => `<label class="check-chip"><input type="checkbox" name="strategyMarket" value="${escapeHtml(item)}" ${selectedMarkets.has(item) ? 'checked' : ''}><span>${escapeHtml(item)}</span></label>`).join('')}</div></div>
      </div>
      <button class="btn-primary" style="margin-top:20px" type="submit">BUILD MY STRATEGY</button>
    </form>
  `;

  byId('strategyForm')?.addEventListener('submit', saveStrategyProfile);
}

function strategyRules(profile) {
  const risk = profile.risk;
  const baseThreshold = risk === 'Conservative' ? 76 : risk === 'Aggressive' ? 60 : 68;
  const exposure = risk === 'Conservative' ? '1–2%' : risk === 'Aggressive' ? '3–4%' : '2–3%';
  const maxMatches = risk === 'Conservative' ? '2' : risk === 'Aggressive' ? '5' : '3';
  return {
    dataThreshold: baseThreshold,
    exposure,
    maxMatches,
    rules: [
      `Reject any match below ${baseThreshold}% data quality.`,
      `Reference exposure per match: ${exposure} of bankroll. Never chase losses.`,
      `Maximum ${maxMatches} shortlisted matches in one session. More action is not better analysis.`,
      `Prefer ${profile.markets.join(', ') || 'markets supported by the strongest data'}; skip markets not backed by source coverage.`,
      'If team availability or recent form is missing, PASS beats guessing.'
    ]
  };
}

function saveStrategyProfile(event) {
  event?.preventDefault();
  const bankroll = Number(byId('strategyBankroll')?.value || 0);
  const experience = byId('strategyExperience')?.value || 'Intermediate';
  const risk = byId('strategyRisk')?.value || 'Balanced';
  const objective = byId('strategyObjective')?.value || 'Controlled growth';
  const leagues = qsa('input[name="strategyLeague"]:checked').map((el) => el.value);
  const markets = qsa('input[name="strategyMarket"]:checked').map((el) => el.value);
  if (!bankroll || bankroll < 1) return showToast('Enter a valid bankroll reference.');
  if (!leagues.length) return showToast('Select at least one league.');
  if (!markets.length) return showToast('Select at least one market.');
  const profile = { bankroll, experience, risk, objective, leagues, markets, updatedAt: new Date().toISOString() };
  localStorage.setItem('vertex_strategy_profile', JSON.stringify(profile));
  showStrategyDashboard();
  showToast('Strategy profile updated.');
}

function showStrategyDashboard() {
  const content = byId('strategyContent');
  if (!content) return;
  const profile = getStrategyProfile();
  if (!profile) {
    content.innerHTML = `
      <div class="trainer-card strategy-intro">
        <div class="eyebrow"><span class="status-dot"></span> FREE BETA</div>
        <h3>Build your Vertex profile</h3>
        <p class="strategy-copy">Set your risk profile, experience, preferred competitions and markets. Vertex turns that into rules for which matches to consider — and which ones to reject.</p>
        <ul class="trainer-features"><li>✓ Personal risk framework</li><li>✓ Preferred market filters</li><li>✓ League and data-quality thresholds</li><li>✓ Direct PASS / WATCH / FIT verdicts</li></ul>
        <button class="btn-primary" id="btnTryStrategy" type="button">SET UP MY PROFILE</button>
      </div>`;
    on('btnTryStrategy', 'click', showStrategySetup);
    return;
  }

  const rules = strategyRules(profile);
  content.innerHTML = `
    <div class="strategy-dashboard">
      <div class="strategy-panel">
        <span class="kicker">VERTEX STRATEGY PROFILE</span>
        <h3>${escapeHtml(profile.risk.toUpperCase())} / ${escapeHtml(profile.experience.toUpperCase())}</h3>
        <div class="profile-score">
          <div><span>Bankroll reference</span><strong>${escapeHtml(profile.bankroll)}</strong></div>
          <div><span>Data threshold</span><strong>${rules.dataThreshold}%</strong></div>
          <div><span>Exposure guide</span><strong>${escapeHtml(rules.exposure)}</strong></div>
          <div><span>Max shortlist</span><strong>${escapeHtml(rules.maxMatches)}</strong></div>
        </div>
        <div class="strategy-actions"><button class="btn-secondary" type="button" data-action="edit-strategy">EDIT PROFILE</button><button class="btn-primary" type="button" data-action="scan-strategy">SCAN TODAY</button></div>
      </div>
      <div class="strategy-panel">
        <span class="kicker">YOUR RULES</span>
        <h3>NO CHASING. NO FORCED PICKS.</h3>
        <ul class="strategy-rules">${rules.rules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join('')}</ul>
      </div>
    </div>
    <div id="strategyScanResults" style="max-width:980px;margin:16px auto 0"></div>
  `;
}

async function scanStrategyMatches() {
  const target = byId('strategyScanResults');
  const profile = getStrategyProfile();
  if (!target || !profile) return;
  target.innerHTML = '<div class="loading-state">Scanning today’s available fixtures…</div>';
  try {
    const data = await fetchJson('/api/upcoming');
    let matches = data.matches || [];
    if (profile.leagues?.length) {
      const selected = profile.leagues.map((x) => x.toLowerCase());
      const filtered = matches.filter((match) => selected.some((league) => String(match.league || '').toLowerCase().includes(league.toLowerCase())));
      if (filtered.length) matches = filtered;
    }
    matches = matches.slice(0, 12);
    if (!matches.length) {
      target.innerHTML = '<div class="empty-state"><h3>PASS</h3><p>No current fixtures matched your selected leagues from the connected provider.</p></div>';
      return;
    }
    target.innerHTML = `<div class="live-grid">${matches.map((match) => `
      <div class="live-card">
        <div class="live-meta"><span>${escapeHtml(match.league || 'Competition')}</span><span>${escapeHtml(fmtDate(match.date) || '')}</span></div>
        <div class="live-team-row"><strong>${escapeHtml(match.home)}</strong></div>
        <div class="live-team-row"><strong>${escapeHtml(match.away)}</strong></div>
        <button class="btn-secondary" style="width:100%;margin-top:10px" type="button" data-analyze-match="${escapeHtml(`${match.home} vs ${match.away}`)}">ANALYZE FIT</button>
      </div>`).join('')}</div>`;
  } catch (error) {
    target.innerHTML = `<div class="analysis-error"><strong>SCAN NOT READY</strong><p>${escapeHtml(error.message)} Add the live football provider key in Vercel to activate automatic match scanning.</p></div>`;
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
    liveLoaded = true;
    const matches = data.matches || [];
    if (status) status.textContent = `Updated ${fmtDate(data.updatedAt) || 'now'} · ${matches.length} live matches`;
    if (!matches.length) {
      target.innerHTML = '<div class="empty-state"><div class="empty-icon">○</div><h3>No live matches right now</h3><p>The live provider is connected, but it returned no active fixtures.</p></div>';
      return;
    }
    target.innerHTML = matches.map((match) => `
      <div class="live-card">
        <div class="live-meta"><span>${escapeHtml(match.league || 'Competition')}</span><span class="live-badge">${escapeHtml(match.minute || 'LIVE')}</span></div>
        <div class="live-team-row"><strong>${escapeHtml(match.home)}</strong><span class="live-score">${escapeHtml(match.homeScore ?? '—')}</span></div>
        <div class="live-team-row"><strong>${escapeHtml(match.away)}</strong><span class="live-score">${escapeHtml(match.awayScore ?? '—')}</span></div>
      </div>`).join('');
  } catch (error) {
    liveLoaded = false;
    if (status) status.textContent = 'Live provider not connected';
    target.innerHTML = `<div class="analysis-error"><strong>LIVE CENTER WAITING FOR PROVIDER</strong><p>${escapeHtml(error.message)} The interface is ready; a server-side live key must be configured before scores can be shown.</p></div>`;
  }
}

async function loadPerformance() {
  const evaluated = byId('perfEvaluated');
  const correct = byId('perfCorrect');
  const accuracy = byId('perfAccuracy');
  const quality = byId('perfQuality');
  if (!evaluated) return;

  // We intentionally refuse to manufacture historical accuracy. These values stay blank
  // until an evaluation table is populated by the result-checking automation.
  evaluated.textContent = '0';
  correct.textContent = '0';
  accuracy.textContent = '—';
  quality.textContent = '—';
}

async function loadLeaderboard() {
  const target = byId('leaderboard');
  if (!target) return;
  target.innerHTML = '<div class="loading-state">Loading community activity…</div>';
  if (!supabase) {
    target.innerHTML = '<div class="empty-state"><p>Community database is unavailable.</p></div>';
    return;
  }
  try {
    const { data, error } = await supabase.from('activity').select('user_id, analyses_count').order('analyses_count', { ascending: false }).limit(20);
    if (error) throw error;
    if (!data?.length) {
      target.innerHTML = '<div class="empty-state"><p>No analysis activity yet.</p></div>';
      return;
    }
    target.innerHTML = data.map((row, index) => `<div class="result-row"><span>#${index + 1} Vertex Member</span><strong>${Number(row.analyses_count || 0)} analyses</strong></div>`).join('');
  } catch (error) {
    target.innerHTML = `<div class="analysis-error"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function loadReviews() {
  const list = byId('reviewsList');
  const form = byId('reviewForm');
  if (!list) return;
  if (form) form.classList.toggle('hidden', !currentUser);
  if (!supabase) {
    list.innerHTML = '<div class="empty-state"><p>Reviews database is unavailable.</p></div>';
    return;
  }
  try {
    const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    if (!data?.length) {
      list.innerHTML = '<div class="empty-state"><p>No reviews yet. Early beta users can be the first.</p></div>';
      return;
    }
    list.innerHTML = data.map((review) => `
      <div class="result-row review-row">
        <div><strong class="review-stars">${'★'.repeat(clamp(Number(review.rating || 0), 0, 5))}</strong><p>${escapeHtml(review.review_text || '')}</p></div>
        <small>${escapeHtml(fmtDate(review.created_at) || '')}</small>
      </div>`).join('');
  } catch (error) {
    list.innerHTML = `<div class="analysis-error"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function submitReview() {
  if (!currentUser) return showAccessModal('reviews');
  const textarea = byId('reviewText');
  const text = textarea?.value.trim();
  if (!text || text.length < 5) return showToast('Write a little more before submitting.');
  if (!supabase) return showToast('Reviews database is unavailable.');
  try {
    const { error } = await supabase.from('reviews').insert([{ user_id: currentUser.id, rating: selectedRating, review_text: text.slice(0, 1000) }]);
    if (error) throw error;
    textarea.value = '';
    showToast('Review submitted. Thank you.');
    loadReviews();
  } catch (error) {
    showToast(`Review failed: ${error.message}`);
  }
}

function initStars() {
  qsa('.star-rating').forEach((star) => {
    star.addEventListener('click', () => {
      selectedRating = Number(star.dataset.rating || 5);
      qsa('.star-rating').forEach((item) => item.classList.toggle('active', Number(item.dataset.rating) <= selectedRating));
    });
  });
}

async function incrementActivity() {
  if (!supabase || !currentUser) return;
  try {
    const { data, error } = await supabase.from('activity').select('analyses_count').eq('user_id', currentUser.id).maybeSingle();
    if (error) throw error;
    if (data) await supabase.from('activity').update({ analyses_count: Number(data.analyses_count || 0) + 1 }).eq('user_id', currentUser.id);
    else await supabase.from('activity').insert([{ user_id: currentUser.id, analyses_count: 1 }]);
  } catch (error) {
    console.warn('Activity counter:', error.message);
  }
}

async function getActivityCount() {
  if (!supabase || !currentUser) return 0;
  try {
    const { data } = await supabase.from('activity').select('analyses_count').eq('user_id', currentUser.id).maybeSingle();
    return Number(data?.analyses_count || 0);
  } catch (_) { return 0; }
}

function openModal(html) {
  const overlay = byId('modalOverlay');
  const content = byId('modalContent');
  if (!overlay || !content) return;
  content.innerHTML = html;
  overlay.classList.remove('hidden');
  const first = content.querySelector('input,button,select,textarea');
  setTimeout(() => first?.focus(), 30);
}

function closeModal() {
  byId('modalOverlay')?.classList.add('hidden');
}

function showAccessModal(targetTab = 'analyzer') {
  openModal(`
    <span class="kicker">ACCESS VERTEX</span>
    <h2>Free account required</h2>
    <p class="modal-copy">Create a free beta account to unlock Match Analyzer, My Strategy, Live, Results and your personal cabinet.</p>
    <button data-modal-action="signup" data-target-tab="${escapeHtml(targetTab)}">CREATE FREE ACCOUNT</button>
    <button class="btn-close-modal" data-modal-action="login" data-target-tab="${escapeHtml(targetTab)}">I ALREADY HAVE AN ACCOUNT</button>
    <button class="btn-close-modal" data-modal-action="close">CLOSE</button>
  `);
}

function showSignupModal(targetTab = '') {
  openModal(`
    <span class="kicker">FREE BETA</span>
    <h2>Create account</h2>
    <p class="modal-copy">No payment. Registration unlocks the product while Vertex is in beta.</p>
    <input type="email" id="signupEmail" placeholder="Email" autocomplete="email">
    <input type="password" id="signupPassword" placeholder="Password (minimum 6 characters)" autocomplete="new-password">
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
    <button class="btn-close-modal" data-modal-action="signup" data-target-tab="${escapeHtml(targetTab)}">Create an account</button>
    <button class="btn-close-modal" data-modal-action="close">CLOSE</button>
  `);
}

async function signup(targetTab = '') {
  const email = byId('signupEmail')?.value.trim();
  const password = byId('signupPassword')?.value || '';
  if (!email || password.length < 6) return showToast('Enter a valid email and a password of at least 6 characters.');
  if (!supabase) return showToast('Authentication service is unavailable.');
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    closeModal();
    if (data.session) {
      currentUser = data.user;
      updateAuthUI();
      showToast('Account created. Welcome to Vertex.');
      if (targetTab) switchTab(targetTab, { bypassAuth: true });
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
  if (!supabase) return showToast('Authentication service is unavailable.');
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    closeModal();
    updateAuthUI();
    showToast('Signed in. Vertex is unlocked.');
    if (targetTab) switchTab(targetTab, { bypassAuth: true });
  } catch (error) {
    showToast(`Sign in failed: ${error.message}`, 5000);
  }
}

async function logout() {
  if (supabase) await supabase.auth.signOut();
  currentUser = null;
  closeModal();
  updateAuthUI();
  switchTab('home', { bypassAuth: true });
  showToast('Signed out.');
}

function updateAuthUI() {
  byId('btnLogin')?.classList.toggle('hidden', Boolean(currentUser));
  byId('btnSignup')?.classList.toggle('hidden', Boolean(currentUser));
  byId('btnCabinet')?.classList.toggle('hidden', !currentUser);
  byId('reviewForm')?.classList.toggle('hidden', !currentUser);
}

async function initAuth() {
  if (!window.supabase) return;
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  try {
    const { data } = await supabase.auth.getSession();
    currentUser = data?.session?.user || null;
    updateAuthUI();
  } catch (error) {
    console.warn('Auth session:', error.message);
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    updateAuthUI();
  });
}

async function showCabinet() {
  if (!currentUser) return showAccessModal('home');
  const count = await getActivityCount();
  const recent = recentAnalyses().slice(0, 5);
  const saved = savedAnalyses().slice(0, 5);
  const strategy = getStrategyProfile();
  openModal(`
    <span class="kicker">MY CABINET</span>
    <h2>Vertex account</h2>
    <p class="cabinet-email">${escapeHtml(currentUser.email || '')}</p>
    <div class="cabinet-stats">
      <div><span>Analyses</span><strong>${count}</strong></div>
      <div><span>Saved</span><strong>${saved.length}</strong></div>
      <div><span>Strategy</span><strong>${strategy ? 'ACTIVE' : 'NOT SET'}</strong></div>
    </div>
    <div class="cabinet-list"><h3>Recent analyses</h3>${recent.length ? recent.map((item) => `<p><strong>${escapeHtml(item.match)}</strong><span>${escapeHtml(item.mainScenario || 'Data review')} · ${escapeHtml(fmtDate(item.date) || '')}</span></p>`).join('') : '<p>No recent analyses yet.</p>'}</div>
    <button data-modal-action="open-strategy">OPEN MY STRATEGY</button>
    <button class="btn-close-modal" data-modal-action="logout">LOG OUT</button>
    <button class="btn-close-modal" data-modal-action="close">CLOSE</button>
  `);
}

function showAboutPage() {
  openModal(`<span class="kicker">ABOUT</span><h2>Vertex Soccer AI</h2><p class="modal-copy">Vertex is a football intelligence platform built around transparent data quality. The goal is to combine match data, statistical modelling, context and a personal strategy layer without pretending missing data exists.</p><button data-modal-action="close">CLOSE</button>`);
}

function showTermsPage() {
  openModal(`<span class="kicker">TERMS</span><h2>Responsible analysis</h2><p class="modal-copy">Vertex provides informational football analysis. Predictions are probabilistic, not guarantees. Users must be 18+ where applicable and remain responsible for their own decisions. The free beta may change as data providers and product features evolve.</p><button data-modal-action="close">CLOSE</button>`);
}

function showPrivacyPage() {
  openModal(`<span class="kicker">PRIVACY</span><h2>Privacy</h2><p class="modal-copy">Authentication is handled through Supabase. Vertex does not need to expose football, weather or news provider API keys in your browser; those connections run through server-side endpoints. Local strategy and saved-analysis data currently remains in this browser during beta.</p><button data-modal-action="close">CLOSE</button>`);
}

function bindGlobalEvents() {
  qsa('.nav a[data-tab]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    switchTab(link.dataset.tab);
  }));

  on('logo', 'click', (event) => { event.preventDefault(); switchTab('home', { bypassAuth: true }); });
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

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'save-analysis') saveCurrentAnalysis();
    if (action === 'copy-analysis') copyCurrentAnalysis();
    if (action === 'edit-strategy') showStrategySetup();
    if (action === 'scan-strategy') scanStrategyMatches();

    const analyzeButton = event.target.closest('[data-analyze-match]');
    if (analyzeButton) {
      const match = analyzeButton.dataset.analyzeMatch;
      setSearchValue(match);
      switchTab('analyzer', { bypassAuth: true });
      const parsed = parseMatchInput(match);
      if (parsed) performAnalysis(parsed.home, parsed.away);
    }

    const modalAction = event.target.closest('[data-modal-action]');
    if (modalAction) {
      const type = modalAction.dataset.modalAction;
      const target = modalAction.dataset.targetTab || '';
      if (type === 'close') closeModal();
      if (type === 'signup') showSignupModal(target);
      if (type === 'login') showLoginModal(target);
      if (type === 'do-signup') signup(target);
      if (type === 'do-login') login(target);
      if (type === 'logout') logout();
      if (type === 'open-strategy') { closeModal(); switchTab('strategy', { bypassAuth: true }); }
    }
  });
}

async function init() {
  if (byId('footerYear')) byId('footerYear').textContent = new Date().getFullYear();
  bindSearch('searchInput', 'suggestions');
  bindSearch('analyzerSearch', 'analyzerSuggestions');
  bindGlobalEvents();
  initStars();
  await initAuth();

  try {
    const health = await fetchJson('/api/health');
    document.documentElement.dataset.engineReady = health.ok ? 'true' : 'false';
  } catch (_) {
    document.documentElement.dataset.engineReady = 'false';
  }
}

document.addEventListener('DOMContentLoaded', init);
