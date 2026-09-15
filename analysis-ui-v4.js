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

  function fmtDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function formPills(stats = {}) {
    const sequence = Array.isArray(stats.sequence) ? stats.sequence.slice(0, 8) : [];
    if (!sequence.length) return '<span class="v4-form-empty">No recent data</span>';
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

  function renderNews(analysis) {
    const news = Array.isArray(analysis.news) ? analysis.news.slice(0, 3) : [];
    if (!news.length) {
      return '<div class="v4-context-empty">No sufficiently relevant team news was strong enough to include in this run.</div>';
    }

    return news.map((item) => {
      const teams = Array.isArray(item.teams) ? item.teams.map((team) => team === 'home' ? analysis.teams?.home?.name : analysis.teams?.away?.name).filter(Boolean).join(' · ') : '';
      const signal = String(item.signal || 'context').toUpperCase();
      return `
        <article class="v4-news-item">
          <div class="v4-news-topline"><span class="v4-news-signal v4-news-${esc(String(item.signal || 'context'))}">${esc(signal)}</span><span>${esc(teams)}</span></div>
          <strong>${esc(item.summary || item.title || 'Team update')}</strong>
          <small>${esc(item.source || 'News')}${item.publishedAt ? ` · ${esc(fmtDate(item.publishedAt))}` : ''}</small>
        </article>`;
    }).join('');
  }

  function renderAnalyzerV4(analysis) {
    const home = analysis?.teams?.home || {};
    const away = analysis?.teams?.away || {};
    const fixture = analysis?.fixture || {};
    const homeForm = analysis?.form?.home || {};
    const awayForm = analysis?.form?.away || {};
    const model = analysis?.model || null;
    const quality = clamp(analysis?.dataQuality, 0, 100);
    const confidence = analysis?.confidence == null ? null : clamp(analysis.confidence, 0, 100);
    const fixtureMeta = [fixture.league, fmtDate(fixture.date), fixture.venue, fixture.city].filter(Boolean).join(' · ');
    const [dcLabel, dcValue] = bestDoubleChance(model?.doubleChance || {});
    const ext = model?.extended || {};
    const newsImpact = analysis?.newsImpact || {};
    const weatherImpact = analysis?.weatherImpact || {};

    const predictions = model ? `
      <div class="v4-quality-row">
        <div class="v4-quality"><span>Analysis confidence</span><strong>${confidence ?? '—'}%</strong><i><b style="width:${confidence ?? 0}%"></b></i></div>
        <div class="v4-quality"><span>Data quality</span><strong>${quality}%</strong><i><b style="width:${quality}%"></b></i></div>
      </div>

      <div class="v4-market-title"><span>CORE MODEL</span><strong>Most useful probabilities</strong></div>
      <div class="v4-market-grid v4-market-grid-core">
        <div class="v4-market featured"><span>Main scenario</span><strong>${esc(model.mainScenario || '—')}</strong></div>
        <div class="v4-market"><span>1X2</span><strong>H ${model.oneXtwo?.home ?? '—'} · D ${model.oneXtwo?.draw ?? '—'} · A ${model.oneXtwo?.away ?? '—'}%</strong></div>
        <div class="v4-market"><span>Double chance</span><strong>${esc(dcLabel)} ${dcValue == null ? '—' : `${dcValue}%`}</strong></div>
        <div class="v4-market"><span>Expected goals</span><strong>${model.expectedGoals?.home ?? '—'} — ${model.expectedGoals?.away ?? '—'}</strong></div>
        <div class="v4-market"><span>Over 2.5</span><strong>${model.over25 ?? '—'}%</strong></div>
        <div class="v4-market"><span>BTTS</span><strong>${model.btts ?? '—'}%</strong></div>
        <div class="v4-market"><span>Likely score</span><strong>${esc(model.correctScore || '—')}</strong></div>
        <div class="v4-market"><span>Under 3.5</span><strong>${ext.under35 ?? '—'}%</strong></div>
      </div>

      <div class="v4-market-title v4-secondary-title"><span>EXTENDED GOAL MARKETS</span><strong>Derived from the same score distribution</strong></div>
      <div class="v4-market-grid v4-market-grid-secondary">
        <div class="v4-market mini"><span>Over 1.5</span><strong>${ext.over15 ?? '—'}%</strong></div>
        <div class="v4-market mini"><span>Over 3.5</span><strong>${ext.over35 ?? '—'}%</strong></div>
        <div class="v4-market mini"><span>${esc(home.name || 'Home')} to score</span><strong>${ext.homeToScore ?? '—'}%</strong></div>
        <div class="v4-market mini"><span>${esc(away.name || 'Away')} to score</span><strong>${ext.awayToScore ?? '—'}%</strong></div>
        <div class="v4-market mini"><span>${esc(home.name || 'Home')} 2+ goals</span><strong>${ext.homeOver15 ?? '—'}%</strong></div>
        <div class="v4-market mini"><span>${esc(away.name || 'Away')} 2+ goals</span><strong>${ext.awayOver15 ?? '—'}%</strong></div>
        <div class="v4-market mini"><span>${esc(home.name || 'Home')} clean sheet</span><strong>${ext.homeCleanSheet ?? '—'}%</strong></div>
        <div class="v4-market mini"><span>${esc(away.name || 'Away')} clean sheet</span><strong>${ext.awayCleanSheet ?? '—'}%</strong></div>
      </div>

      <div class="v4-verdict"><span>VERTEX MATCH VERDICT</span><strong>${esc(model.mainScenario || '—')}</strong><p>Model output combines recent scoring form with verified context signals. Confidence is reduced when the input data is incomplete.</p></div>
    ` : `
      <div class="v4-withheld"><strong>PREDICTION WITHHELD</strong><p>Vertex does not have enough completed-match data to calculate responsible probabilities for this match.</p></div>
    `;

    const newsModelled = Boolean(newsImpact.appliedToModel);
    const weatherModelled = Boolean(weatherImpact.appliedToModel);
    const source = analysis?.sourceStatus?.primaryFootball || 'Multi-source';
    const limitations = Array.isArray(analysis?.limitations) ? analysis.limitations : [];

    return `
      <div class="analysis-card v4-analysis-card">
        <div class="v4-match-head">
          <div class="v4-team">${home.badge ? `<img src="${esc(home.badge)}" alt="">` : ''}<strong>${esc(home.name || 'Home')}</strong><small>${esc(home.country || '')}</small></div>
          <div class="v4-versus">VS</div>
          <div class="v4-team">${away.badge ? `<img src="${esc(away.badge)}" alt="">` : ''}<strong>${esc(away.name || 'Away')}</strong><small>${esc(away.country || '')}</small></div>
        </div>
        <div class="v4-fixture-meta">${esc(fixtureMeta || 'Fixture metadata is limited for this run')}</div>

        <div class="v4-form-strip">
          <div class="v4-form-team">
            <div class="v4-form-label"><strong>${esc(home.name || 'Home')}</strong><span>${homeForm.played || 0} matches</span></div>
            <div class="v4-form-pills">${formPills(homeForm)}</div>
            <div class="v4-form-numbers"><span>GF <b>${Number.isFinite(homeForm.avgFor) ? Number(homeForm.avgFor).toFixed(2) : '—'}</b></span><span>GA <b>${Number.isFinite(homeForm.avgAgainst) ? Number(homeForm.avgAgainst).toFixed(2) : '—'}</b></span><span>PPG <b>${Number.isFinite(homeForm.ppg) ? Number(homeForm.ppg).toFixed(2) : '—'}</b></span></div>
          </div>
          <div class="v4-form-divider"></div>
          <div class="v4-form-team">
            <div class="v4-form-label"><strong>${esc(away.name || 'Away')}</strong><span>${awayForm.played || 0} matches</span></div>
            <div class="v4-form-pills">${formPills(awayForm)}</div>
            <div class="v4-form-numbers"><span>GF <b>${Number.isFinite(awayForm.avgFor) ? Number(awayForm.avgFor).toFixed(2) : '—'}</b></span><span>GA <b>${Number.isFinite(awayForm.avgAgainst) ? Number(awayForm.avgAgainst).toFixed(2) : '—'}</b></span><span>PPG <b>${Number.isFinite(awayForm.ppg) ? Number(awayForm.ppg).toFixed(2) : '—'}</b></span></div>
          </div>
        </div>

        ${predictions}

        <div class="v4-context-head"><div><span>CONTEXT INTELLIGENCE</span><strong>Only relevant signals, no article dump</strong></div><div class="v4-context-flags"><span class="${newsModelled ? 'active' : ''}">NEWS ${newsModelled ? 'MODELLED' : 'REVIEWED'}</span><span class="${weatherModelled ? 'active' : ''}">WEATHER ${weatherModelled ? 'MODELLED' : 'MONITORED'}</span><span>${esc(source)}</span></div></div>
        <div class="v4-news-grid">${renderNews(analysis)}</div>

        <div class="v4-granular-note"><div><span>GRANULAR MARKETS</span><strong>Corners · Cards · Penalties · Shots · Offsides</strong></div><p>These forecasts stay hidden until a verified historical event-stat feed is connected. Vertex will not manufacture them from goal data.</p></div>

        <details class="v4-tech-details">
          <summary>Data notes & limitations</summary>
          <div class="v4-tech-body">
            <p><strong>News adjustment:</strong> home ${newsImpact.homePct ?? 0}% · away ${newsImpact.awayPct ?? 0}%</p>
            <p><strong>Weather context:</strong> ${weatherModelled ? `applied ${weatherImpact.goalEnvironmentPct ?? 0}% to goal environment` : 'not applied to this model run'}</p>
            ${limitations.length ? `<ul>${limitations.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p>No major limitations reported.</p>'}
          </div>
        </details>

        <div class="strategy-actions v4-actions"><button class="btn-secondary" data-action="save-analysis" type="button">SAVE ANALYSIS</button><button class="btn-secondary" data-action="copy-analysis" type="button">COPY SUMMARY</button></div>
      </div>`;
  }

  let lastAnalysis = null;
  let renderTimer = null;

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      const target = document.getElementById('analysisResult');
      if (!target || !lastAnalysis || !target.querySelector('.analysis-card')) return;
      const key = String(lastAnalysis.generatedAt || `${lastAnalysis.teams?.home?.name}-${lastAnalysis.teams?.away?.name}`);
      if (target.dataset.vertexV4Key === key) return;
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
            scheduleRender();
          }
        }).catch(() => {});
      }
    } catch (_) {}
    return response;
  };

  document.addEventListener('DOMContentLoaded', () => {
    const target = document.getElementById('analysisResult');
    if (target) new MutationObserver(scheduleRender).observe(target, { childList: true, subtree: true });

    document.getElementById('homeOpenAnalyzer')?.addEventListener('click', () => {
      document.querySelector('.nav a[data-tab="analyzer"]')?.click();
    });
    document.getElementById('homeOpenStrategy')?.addEventListener('click', () => {
      document.querySelector('.nav a[data-tab="strategy"]')?.click();
    });
  });
})();
