'use strict';

(() => {
  let lastAnalysis = null;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const rawUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (rawUrl.includes('/api/analyze')) {
        response.clone().json().then((payload) => {
          lastAnalysis = payload?.analysis || null;
          setTimeout(renderNewsIntelligence, 0);
          setTimeout(renderNewsIntelligence, 120);
        }).catch(() => {});
      }
    } catch (_) {}
    return response;
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function signalLabel(signal) {
    if (signal === 'negative') return 'NEGATIVE';
    if (signal === 'positive') return 'POSITIVE';
    if (signal === 'lineup') return 'LINEUP';
    return 'CONTEXT';
  }

  function fmtDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function renderNewsIntelligence() {
    if (!lastAnalysis) return;
    const cards = [...document.querySelectorAll('#analysisResult .evidence-card')];
    const card = cards.find((node) => node.querySelector('h4')?.textContent?.toUpperCase().includes('RECENT NEWS'));
    if (!card) return;

    const items = Array.isArray(lastAnalysis.news) ? lastAnalysis.news.slice(0, 3) : [];
    const impact = lastAnalysis.newsImpact || {};
    const model = lastAnalysis.model;
    const homeName = lastAnalysis.teams?.home?.name || 'Home';
    const awayName = lastAnalysis.teams?.away?.name || 'Away';

    const impactText = impact.appliedToModel
      ? `<div class="vertex-news-impact"><strong>USED BY MODEL</strong><span>${esc(homeName)} ${Number(impact.homePct || 0) >= 0 ? '+' : ''}${Number(impact.homePct || 0)}% · ${esc(awayName)} ${Number(impact.awayPct || 0) >= 0 ? '+' : ''}${Number(impact.awayPct || 0)}%</span></div>`
      : `<div class="vertex-news-impact muted"><strong>NEWS CHECK</strong><span>${model ? 'No verified news signal was strong enough to change the probabilities.' : 'News was reviewed, but the statistical model is still withheld because match-history data is insufficient.'}</span></div>`;

    const list = items.length ? items.map((item) => {
      const teams = (item.teams || []).map((team) => team === 'home' ? homeName : awayName).join(' / ');
      return `<article class="vertex-news-item">
        <div class="vertex-news-top"><span class="vertex-news-signal signal-${esc(item.signal || 'context')}">${signalLabel(item.signal)}</span><span>${esc(teams || 'Match context')}</span></div>
        <p>${esc(item.summary || item.title || '')}</p>
        <small>${esc(item.source || 'News')}${fmtDate(item.publishedAt) ? ` · ${esc(fmtDate(item.publishedAt))}` : ''}</small>
      </article>`;
    }).join('') : '<p class="vertex-news-empty">No sufficiently relevant recent news was found for this match.</p>';

    card.innerHTML = `<h4>NEWS INTELLIGENCE</h4>${impactText}<div class="vertex-news-list">${list}</div><p class="vertex-news-note">Only recent injury, suspension, fitness and confirmed availability signals can adjust the model. Transfer rumours and generic headlines are context only.</p>`;
  }

  const style = document.createElement('style');
  style.textContent = `
    .vertex-news-impact{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:10px 12px;margin:10px 0 12px;border:1px solid rgba(54,231,173,.22);border-radius:10px;background:rgba(54,231,173,.055)}
    .vertex-news-impact strong{font-size:9px;letter-spacing:.12em;color:#45e9b3}.vertex-news-impact span{font-size:11px;color:#c6d6e1;text-align:right}
    .vertex-news-impact.muted{border-color:rgba(84,174,214,.18);background:rgba(45,124,160,.045)}.vertex-news-impact.muted strong{color:#70d8f2}
    .vertex-news-list{display:grid;gap:9px}.vertex-news-item{padding:11px 12px;border-radius:10px;border:1px solid rgba(78,164,194,.14);background:rgba(2,11,19,.48)}
    .vertex-news-top{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:7px;font-size:9px;color:#7f95a5}.vertex-news-signal{font-weight:800;letter-spacing:.08em;color:#9cb2c1}
    .signal-negative{color:#ff8295}.signal-positive{color:#51e5b0}.signal-lineup{color:#ffd166}.vertex-news-item p{margin:0;color:#d8e8f2;font-size:12px;line-height:1.5}.vertex-news-item small{display:block;margin-top:7px;color:#758a99;font-size:9px}
    .vertex-news-note{margin:10px 0 0!important;color:#6f8290!important;font-size:9px!important;line-height:1.45}.vertex-news-empty{color:#879aa8!important}.news-evidence a,.evidence-card a{pointer-events:none}
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(() => renderNewsIntelligence());
  document.addEventListener('DOMContentLoaded', () => {
    const target = document.getElementById('analysisResult');
    if (target) observer.observe(target, { childList: true, subtree: true });
  });
})();
