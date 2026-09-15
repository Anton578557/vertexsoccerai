'use strict';

(() => {
  if (window.__vertexAnalysisUiV4) return;
  window.__vertexAnalysisUiV4 = true;

  function ensureStylesheet(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  ensureStylesheet('ui-v4.css');

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value || 0)));
  const tr = (text) => window.VertexI18n?.t ? window.VertexI18n.t(text) : text;
  const locale = () => window.VertexI18n?.getLocale?.() || 'en-GB';

  function safeAssetUrl(value) {
    try {
      const url = new URL(String(value || ''), window.location.origin);
      return ['https:', 'http:'].includes(url.protocol) ? esc(url.href) : '';
    } catch (_) {
      return '';
    }
  }

  function fmtDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function formPills(stats = {}) {
    const sequence = Array.isArray(stats.sequence) ? stats.sequence.slice(0, 8) : [];
    if (!sequence.length) return `<span class="v4-form-empty">${esc(tr('No recent data'))}</span>`;
    return sequence.map((result) => {
      const key = String(result || '').toLowerCase();
      return `<span class="v4-form-pill v4-form-${esc(key)}">${esc(result)}</span>`;
    }).join('');
  }

  function bestDoubleChance(dc = {}) {
    const rows = [
      ['1X', Number(dc.oneX)],
      ['X2', Number(dc.xTwo)],
      ['12', Number(dc.oneTwo)]
    ].filter(([, value]) => Number.isFinite(value));
    rows.sort((a, b) => b[1] - a[1]);
    return rows[0] || ['—', null];
  }

  function scenarioData(model, homeName, awayName) {
    const home = clamp(model?.oneXtwo?.home, 0, 100);
    const draw = clamp(model?.oneXtwo?.draw, 0, 100);
    const away = clamp(model?.oneXtwo?.away, 0, 100);
    const rows = [
      { key: 'home', raw: 'Home win', label: tr('Home win'), team: homeName, value: home },
      { key: 'draw', raw: 'Draw', label: tr('Draw'), team: tr('Draw'), value: draw },
      { key: 'away', raw: 'Away win', label: tr('Away win'), team: awayName, value: away }
    ].sort((a, b) => b.value - a.value);
    const best = rows[0];
    const second = rows[1];
    const edge = Math.max(0, best.value - second.value);
    const edgeLabel = edge >= 15 ? tr('Strong edge') : edge >= 8 ? tr('Moderate edge') : tr('Small edge');
    return { home, draw, away, best, edge, edgeLabel };
  }

  function doubleChanceExplanation(label, homeName, awayName) {
    if (label === '1X') return `${homeName} / ${tr('Draw')}`;
    if (label === 'X2') return `${tr('Draw')} / ${awayName}`;
    if (label === '12') return `${homeName} / ${awayName}`;
    return '—';
  }

  function renderNews(analysis) {
    const news = Array.isArray(analysis.news) ? analysis.news.slice(0, 3) : [];
    if (!news.length) {
      return `<div class="v4-context-empty">${esc(tr('No sufficiently relevant team news was strong enough to include in this run.'))}</div>`;
    }

    return news.map((item) => {
      const teams = Array.isArray(item.teams)
        ? item.teams.map((team) => team === 'home' ? analysis.teams?.home?.name : analysis.teams?.away?.name).filter(Boolean).join(' · ')
        : '';
      const rawSignal = String(item.signal || 'context').toUpperCase();
      const signal = tr(rawSignal);
      return `
        <article class="v4-news-item">
          <div class="v4-news-topline"><span class="v4-news-signal v4-news-${esc(String(item.signal || 'context'))}">${esc(signal)}</span><span>${esc(teams)}</span></div>
          <strong>${esc(item.summary || item.title || 'Team update')}</strong>
          <small>${esc(item.source || tr('News'))}${item.publishedAt ? ` · ${esc(fmtDate(item.publishedAt))}` : ''}</small>
        </article>`;
    }).join('');
  }

  function renderCoreModel(model, analysis, home, away) {
    const confidence = analysis?.confidence == null ? null : clamp(analysis.confidence, 0, 100);
    const quality = clamp(analysis?.dataQuality, 0, 100);
    const scenario = scenarioData(model, home.name || 'Home', away.name || 'Away');
    const [dcLabel, dcValue] = bestDoubleChance(model?.doubleChance || {});
    const ext = model?.extended || {};
    const totalXg = Number(model?.expectedGoals?.total ?? ((Number(model?.expectedGoals?.home) || 0) + (Number(model?.expectedGoals?.away) || 0)));

    return `
      <div class="v5-model-shell">
        <div class="v4-quality-row v5-quality-row">
          <div class="v4-quality"><span>${esc(tr('Analysis confidence'))}</span><strong>${confidence ?? '—'}%</strong><i><b style="width:${confidence ?? 0}%"></b></i></div>
          <div class="v4-quality"><span>${esc(tr('Data quality'))}</span><strong>${quality}%</strong><i><b style="width:${quality}%"></b></i></div>
        </div>

        <div class="v5-core-heading">
          <div><span>${esc(tr('CORE MODEL'))}</span><strong>${esc(tr('Match probability overview'))}</strong></div>
          <div class="v5-edge-badge"><span>${esc(scenario.edgeLabel)}</span><b>+${Math.round(scenario.edge)}%</b></div>
        </div>

        <div class="v5-primary-grid">
          <section class="v5-primary-outlook">
            <span>${esc(tr('PRIMARY OUTLOOK'))}</span>
            <div class="v5-primary-value"><strong>${esc(scenario.best.label)}</strong><b>${Math.round(scenario.best.value)}%</b></div>
            <p>${esc(tr('Most likely match outcome'))}: <strong>${esc(scenario.best.team)}</strong></p>
          </section>

          <section class="v5-1x2-panel">
            <div class="v5-panel-title"><span>${esc(tr('1X2 PROBABILITY'))}</span><small>100%</small></div>
            <div class="v5-probability-bar" aria-label="1X2 probabilities">
              <i class="home" style="width:${scenario.home}%"></i>
              <i class="draw" style="width:${scenario.draw}%"></i>
              <i class="away" style="width:${scenario.away}%"></i>
            </div>
            <div class="v5-probability-labels">
              <div><span>${esc(home.name || tr('Home'))}</span><strong>${Math.round(scenario.home)}%</strong></div>
              <div><span>${esc(tr('Draw'))}</span><strong>${Math.round(scenario.draw)}%</strong></div>
              <div><span>${esc(away.name || tr('Away'))}</span><strong>${Math.round(scenario.away)}%</strong></div>
            </div>
          </section>
        </div>

        <div class="v5-signal-grid">
          <section class="v5-signal-card safety">
            <span>${esc(tr('Best safety option'))}</span>
            <strong>${esc(dcLabel)} · ${dcValue == null ? '—' : `${Math.round(dcValue)}%`}</strong>
            <small>${esc(doubleChanceExplanation(dcLabel, home.name || tr('Home'), away.name || tr('Away')))}</small>
          </section>
          <section class="v5-signal-card xg">
            <span>${esc(tr('Expected goals'))}</span>
            <strong>${model.expectedGoals?.home ?? '—'} <em>:</em> ${model.expectedGoals?.away ?? '—'}</strong>
            <small>${esc(home.name || tr('Home'))} · ${esc(away.name || tr('Away'))}${Number.isFinite(totalXg) ? ` · Σ ${totalXg.toFixed(2)}` : ''}</small>
          </section>
          <section class="v5-signal-card goals">
            <span>${esc(tr('Goal outlook'))}</span>
            <strong>O2.5 ${model.over25 ?? '—'}%</strong>
            <small>U3.5 ${ext.under35 ?? '—'}%</small>
          </section>
          <section class="v5-signal-card btts">
            <span>${esc(tr('Both teams to score'))}</span>
            <strong>${model.btts ?? '—'}%</strong>
            <small>${esc(tr('Likely score'))}: ${esc(model.correctScore || '—')}</small>
          </section>
        </div>
      </div>`;
  }

  function renderAnalyzerV4(analysis) {
    const home = analysis?.teams?.home || {};
    const away = analysis?.teams?.away || {};
    const fixture = analysis?.fixture || {};
    const homeForm = analysis?.form?.home || {};
    const awayForm = analysis?.form?.away || {};
    const model = analysis?.model || null;
    const fixtureMeta = [fixture.league, fmtDate(fixture.date), fixture.venue, fixture.city].filter(Boolean).join(' · ');
    const ext = model?.extended || {};
    const newsImpact = analysis?.newsImpact || {};
    const weatherImpact = analysis?.weatherImpact || {};

    const predictions = model ? `
      ${renderCoreModel(model, analysis, home, away)}

      <div class="v4-market-title v4-secondary-title"><span>${esc(tr('EXTENDED GOAL MARKETS'))}</span><strong>${esc(tr('Derived from the same score distribution'))}</strong></div>
      <div class="v4-market-grid v4-market-grid-secondary">
        <div class="v4-market mini"><span>Over 1.5</span><strong>${ext.over15 ?? '—'}%</strong></div>
        <div class="v4-market mini"><span>Over 3.5</span><strong>${ext.over35 ?? '—'}%</strong></div>
        <div class="v4-market mini"><span>${esc(home.name || tr('Home'))} ${esc(tr('to score'))}</span><strong>${ext.homeToScore ?? '—'}%</strong></div>
        <div class="v4-market mini"><span>${esc(away.name || tr('Away'))} ${esc(tr('to score'))}</span><strong>${ext.awayToScore ?? '—'}%</strong></div>
        <div class="v4-market mini"><span>${esc(home.name || tr('Home'))} ${esc(tr('2+ goals'))}</span><strong>${ext.homeOver15 ?? '—'}%</strong></div>
        <div class="v4-market mini"><span>${esc(away.name || tr('Away'))} ${esc(tr('2+ goals'))}</span><strong>${ext.awayOver15 ?? '—'}%</strong></div>
        <div class="v4-market mini"><span>${esc(home.name || tr('Home'))} ${esc(tr('clean sheet'))}</span><strong>${ext.homeCleanSheet ?? '—'}%</strong></div>
        <div class="v4-market mini"><span>${esc(away.name || tr('Away'))} ${esc(tr('clean sheet'))}</span><strong>${ext.awayCleanSheet ?? '—'}%</strong></div>
      </div>

      <div class="v4-verdict"><span>${esc(tr('VERTEX MATCH VERDICT'))}</span><strong>${esc(tr(model.mainScenario || '—'))}</strong><p>${esc(tr('Model output combines recent scoring form with verified context signals. Confidence is reduced when the input data is incomplete.'))}</p></div>
    ` : `
      <div class="v4-withheld"><strong>${esc(tr('PREDICTION WITHHELD'))}</strong><p>${esc(tr('Vertex does not have enough completed-match data to calculate responsible probabilities for this match.'))}</p></div>
    `;

    const newsModelled = Boolean(newsImpact.appliedToModel);
    const weatherModelled = Boolean(weatherImpact.appliedToModel);
    const source = analysis?.sourceStatus?.primaryFootball || 'Multi-source';
    const limitations = Array.isArray(analysis?.limitations) ? analysis.limitations : [];
    const homeBadge = safeAssetUrl(home.badge);
    const awayBadge = safeAssetUrl(away.badge);

    return `
      <div class="analysis-card v4-analysis-card">
        <div class="v4-match-head">
          <div class="v4-team">${homeBadge ? `<img src="${homeBadge}" alt="">` : ''}<strong>${esc(home.name || tr('Home'))}</strong><small>${esc(home.country || '')}</small></div>
          <div class="v4-versus">VS</div>
          <div class="v4-team">${awayBadge ? `<img src="${awayBadge}" alt="">` : ''}<strong>${esc(away.name || tr('Away'))}</strong><small>${esc(away.country || '')}</small></div>
        </div>
        <div class="v4-fixture-meta">${esc(fixtureMeta || 'Fixture metadata is limited for this run')}</div>

        <div class="v4-form-strip">
          <div class="v4-form-team">
            <div class="v4-form-label"><strong>${esc(home.name || tr('Home'))}</strong><span>${esc(tr(`${homeForm.played || 0} matches`))}</span></div>
            <div class="v4-form-pills">${formPills(homeForm)}</div>
            <div class="v4-form-numbers"><span>GF <b>${Number.isFinite(homeForm.avgFor) ? Number(homeForm.avgFor).toFixed(2) : '—'}</b></span><span>GA <b>${Number.isFinite(homeForm.avgAgainst) ? Number(homeForm.avgAgainst).toFixed(2) : '—'}</b></span><span>PPG <b>${Number.isFinite(homeForm.ppg) ? Number(homeForm.ppg).toFixed(2) : '—'}</b></span></div>
          </div>
          <div class="v4-form-divider"></div>
          <div class="v4-form-team">
            <div class="v4-form-label"><strong>${esc(away.name || tr('Away'))}</strong><span>${esc(tr(`${awayForm.played || 0} matches`))}</span></div>
            <div class="v4-form-pills">${formPills(awayForm)}</div>
            <div class="v4-form-numbers"><span>GF <b>${Number.isFinite(awayForm.avgFor) ? Number(awayForm.avgFor).toFixed(2) : '—'}</b></span><span>GA <b>${Number.isFinite(awayForm.avgAgainst) ? Number(awayForm.avgAgainst).toFixed(2) : '—'}</b></span><span>PPG <b>${Number.isFinite(awayForm.ppg) ? Number(awayForm.ppg).toFixed(2) : '—'}</b></span></div>
          </div>
        </div>

        ${predictions}

        <div class="v4-context-head"><div><span>${esc(tr('CONTEXT INTELLIGENCE'))}</span><strong>${esc(tr('Only relevant signals, no article dump'))}</strong></div><div class="v4-context-flags"><span class="${newsModelled ? 'active' : ''}">${esc(tr(newsModelled ? 'NEWS MODELLED' : 'NEWS REVIEWED'))}</span><span class="${weatherModelled ? 'active' : ''}">${esc(tr(weatherModelled ? 'WEATHER MODELLED' : 'WEATHER MONITORED'))}</span><span>${esc(source)}</span></div></div>
        <div class="v4-news-grid">${renderNews(analysis)}</div>

        <div class="v4-granular-note"><div><span>${esc(tr('GRANULAR MARKETS'))}</span><strong>${esc(tr('Corners · Cards · Penalties · Shots · Offsides'))}</strong></div><p>${esc(tr('These forecasts stay hidden until a verified historical event-stat feed is connected. Vertex will not manufacture them from goal data.'))}</p></div>

        <details class="v4-tech-details">
          <summary>${esc(tr('Data notes & limitations'))}</summary>
          <div class="v4-tech-body">
            <p><strong>News adjustment:</strong> home ${newsImpact.homePct ?? 0}% · away ${newsImpact.awayPct ?? 0}%</p>
            <p><strong>Weather context:</strong> ${weatherModelled ? `applied ${weatherImpact.goalEnvironmentPct ?? 0}% to goal environment` : 'not applied to this model run'}</p>
            ${limitations.length ? `<ul>${limitations.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p>No major limitations reported.</p>'}
          </div>
        </details>

        <div class="strategy-actions v4-actions"><button class="btn-secondary" data-action="save-analysis" type="button">${esc(tr('SAVE ANALYSIS'))}</button><button class="btn-secondary" data-action="copy-analysis" type="button">${esc(tr('COPY SUMMARY'))}</button></div>
      </div>`;
  }

  let lastAnalysis = null;
  let renderTimer = null;

  function scheduleRender(force = false) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      const target = document.getElementById('analysisResult');
      if (!target || !lastAnalysis || !target.querySelector('.analysis-card')) return;
      const key = `${String(lastAnalysis.generatedAt || `${lastAnalysis.teams?.home?.name}-${lastAnalysis.teams?.away?.name}`)}-${window.VertexI18n?.getLanguage?.() || 'en'}`;
      if (!force && target.dataset.vertexV4Key === key) return;
      target.innerHTML = renderAnalyzerV4(lastAnalysis);
      target.dataset.vertexV4Key = key;
    }, 0);
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const input = args[0];
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/api/analyze') && response.ok) {
        response.clone().json().then((payload) => {
          if (payload?.analysis) {
            lastAnalysis = payload.analysis;
            scheduleRender(true);
          }
        }).catch(() => {});
      }
    } catch (_) {}
    return response;
  };

  document.addEventListener('vertex:languagechange', () => scheduleRender(true));

  document.addEventListener('DOMContentLoaded', () => {
    const target = document.getElementById('analysisResult');
    if (target) new MutationObserver(() => scheduleRender()).observe(target, { childList: true, subtree: true });

    document.getElementById('homeOpenAnalyzer')?.addEventListener('click', () => {
      document.querySelector('.nav a[data-tab="analyzer"]')?.click();
    });
    document.getElementById('homeOpenStrategy')?.addEventListener('click', () => {
      document.querySelector('.nav a[data-tab="strategy"]')?.click();
    });
  });
})();