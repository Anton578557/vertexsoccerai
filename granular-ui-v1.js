'use strict';

(() => {
  if (window.__vertexGranularUiV1) return;
  window.__vertexGranularUiV1 = true;

  if (!document.querySelector('link[href="granular-ui-v1.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'granular-ui-v1.css';
    document.head.appendChild(link);
  }

  let lastAnalysis = null;

  const dict = {
    en: {
      eyebrow: 'EVENT MARKETS', title: 'Corners · Cards · Shots · Offsides',
      source: 'historical source', matches: 'matches per team', expected: 'Expected',
      corners: 'Corners', cards: 'Yellow cards', shots: 'Shots', sot: 'Shots on target', offsides: 'Offsides', fouls: 'Fouls',
      home: 'Home', away: 'Away', penalties: 'Penalties', penaltyText: 'Penalty probability stays withheld until Vertex has a much larger verified event sample. Rare-event markets need more evidence than corners or cards.'
    },
    ru: {
      eyebrow: 'СОБЫТИЙНЫЕ РЫНКИ', title: 'Угловые · Карточки · Удары · Офсайды',
      source: 'исторический источник', matches: 'матчей на команду', expected: 'Ожидание',
      corners: 'Угловые', cards: 'Жёлтые карточки', shots: 'Удары', sot: 'Удары в створ', offsides: 'Офсайды', fouls: 'Фолы',
      home: 'Хозяева', away: 'Гости', penalties: 'Пенальти', penaltyText: 'Вероятность пенальти пока скрыта: для редкого события Vertex требует намного большую проверенную выборку, чем для угловых или карточек.'
    },
    es: {
      eyebrow: 'MERCADOS DE EVENTOS', title: 'Córners · Tarjetas · Tiros · Fueras de juego',
      source: 'fuente histórica', matches: 'partidos por equipo', expected: 'Esperado',
      corners: 'Córners', cards: 'Tarjetas amarillas', shots: 'Tiros', sot: 'Tiros a puerta', offsides: 'Fueras de juego', fouls: 'Faltas',
      home: 'Local', away: 'Visitante', penalties: 'Penaltis', penaltyText: 'La probabilidad de penalti permanece oculta hasta disponer de una muestra de eventos verificada mucho mayor. Los eventos raros necesitan más evidencia.'
    }
  };

  function lang() {
    return window.VertexI18n?.getLanguage?.() || localStorage.getItem('vertex_language') || 'en';
  }

  function t(key) {
    return dict[lang()]?.[key] || dict.en[key] || key;
  }

  function n(value, digits = 1) {
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(digits) : '—';
  }

  function p(value) {
    const num = Number(value);
    return Number.isFinite(num) ? `${Math.round(num)}%` : '—';
  }

  function lines(items) {
    return `<div class="vertex-granular-lines">${items.map(([label, value]) => `<div class="vertex-granular-line"><span>${label}</span><b>${value}</b></div>`).join('')}</div>`;
  }

  function card(label, metric, marketLines = []) {
    if (!metric) return '';
    return `<section class="vertex-granular-card">
      <div class="top"><span>${label}</span><strong>${t('expected')} ${n(metric.expectedTotal)}</strong></div>
      <div class="split"><span>${t('home')}: <b>${n(metric.expectedHome)}</b></span><span>${t('away')}: <b>${n(metric.expectedAway)}</b></span></div>
      ${marketLines.length ? lines(marketLines) : ''}
    </section>`;
  }

  function render(analysis) {
    const model = analysis?.granularModel;
    if (!model?.ok) return '';
    const sample = Math.min(Number(model.sample?.home || 0), Number(model.sample?.away || 0));
    return `<section class="vertex-granular-model" data-vertex-granular="1">
      <div class="vertex-granular-head">
        <div><span>${t('eyebrow')}</span><strong>${t('title')}</strong></div>
        <small>${model.source || 'Football-Data.co.uk'} · ${sample || '—'} ${t('matches')} · ${t('source')}</small>
      </div>
      <div class="vertex-granular-grid">
        ${card(t('corners'), model.corners, [['O7.5', p(model.corners?.over75)], ['O8.5', p(model.corners?.over85)], ['O9.5', p(model.corners?.over95)]])}
        ${card(t('cards'), model.cards, [['O3.5', p(model.cards?.over35)], ['O4.5', p(model.cards?.over45)], ['O5.5', p(model.cards?.over55)]])}
        ${card(t('shots'), model.shots, [['O21.5', p(model.shots?.over215)], ['O23.5', p(model.shots?.over235)], ['O25.5', p(model.shots?.over255)]])}
        ${card(t('sot'), model.shotsOnTarget, [['O6.5', p(model.shotsOnTarget?.over65)], ['O7.5', p(model.shotsOnTarget?.over75)], ['O8.5', p(model.shotsOnTarget?.over85)]])}
        ${card(t('offsides'), model.offsides, [['O2.5', p(model.offsides?.over25)], ['O3.5', p(model.offsides?.over35)], ['O4.5', p(model.offsides?.over45)]])}
        ${card(t('fouls'), model.fouls)}
      </div>
      <div class="vertex-granular-note"><b>${t('penalties')}:</b> ${t('penaltyText')}</div>
    </section>`;
  }

  function apply() {
    const target = document.querySelector('#analysisResult .analysis-card');
    if (!target || !lastAnalysis?.granularModel?.ok) return;
    target.querySelector('[data-vertex-granular="1"]')?.remove();
    const old = target.querySelector('.v4-granular-note');
    if (old) old.classList.add('vertex-granular-replaced');
    const context = target.querySelector('.v4-context-head');
    if (context) context.insertAdjacentHTML('beforebegin', render(lastAnalysis));
    else target.insertAdjacentHTML('beforeend', render(lastAnalysis));
  }

  const previousFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await previousFetch(...args);
    try {
      const input = args[0];
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/api/analyze') && response.ok) {
        response.clone().json().then((payload) => {
          if (!payload?.analysis) return;
          lastAnalysis = payload.analysis;
          setTimeout(apply, 80);
          setTimeout(apply, 250);
        }).catch(() => {});
      }
    } catch (_) {}
    return response;
  };

  document.addEventListener('vertex:languagechange', () => setTimeout(apply, 40));
  document.addEventListener('DOMContentLoaded', () => {
    const host = document.getElementById('analysisResult');
    if (host) new MutationObserver(() => {
      if (lastAnalysis?.granularModel?.ok) setTimeout(apply, 0);
    }).observe(host, { childList: true, subtree: true });
  });
})();
