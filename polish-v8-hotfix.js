'use strict';

(() => {
  if (window.__vertexPolishV8Hotfix) return;
  window.__vertexPolishV8Hotfix = true;

  const lang = () => window.VertexI18n?.getLanguage?.() || localStorage.getItem('vertex_language') || 'en';
  const setText = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };

  function detachStrategyFromLegacyObserver() {
    const current = document.getElementById('strategyContent');
    if (!current || current.dataset.v8Detached === 'true') return;
    let profile = null;
    try { profile = JSON.parse(localStorage.getItem('vertex_strategy_profile') || 'null'); } catch (_) {}
    if (!profile || !current.querySelector('.strategy-dashboard')) return;
    const clone = current.cloneNode(true);
    clone.dataset.v8Detached = 'true';
    current.replaceWith(clone);
  }

  const exactBetaReplacements = {
    'FREE BETA': { en: 'FOOTBALL INTELLIGENCE', ru: 'ФУТБОЛЬНАЯ АНАЛИТИКА', es: 'INTELIGENCIA DE FÚTBOL' },
    'Free Beta': { en: 'Football Intelligence', ru: 'Футбольная аналитика', es: 'Inteligencia de fútbol' },
    'Be the first beta user to leave one.': { en: 'Be the first user to leave one.', ru: 'Станьте первым пользователем, который оставит отзыв.', es: 'Sé el primer usuario en dejar una reseña.' },
    'The current product is a free beta. Monetization is not enabled.': { en: 'The service is currently free to use. Paid features are not enabled.', ru: 'Сейчас сервис доступен бесплатно. Платные функции не подключены.', es: 'Actualmente el servicio se puede usar de forma gratuita. No hay funciones de pago activadas.' }
  };

  function scrubNode(root) {
    if (!root) return;
    const currentLang = lang();
    const process = (node) => {
      const raw = node.nodeValue || '';
      const trimmed = raw.trim();
      if (!trimmed) return;
      const replacement = exactBetaReplacements[trimmed]?.[currentLang];
      if (replacement) {
        const lead = raw.match(/^\s*/)?.[0] || '';
        const trail = raw.match(/\s*$/)?.[0] || '';
        node.nodeValue = `${lead}${replacement}${trail}`;
        return;
      }
      if (/\bfree beta\b/i.test(trimmed)) node.nodeValue = raw.replace(/free beta/ig, currentLang === 'ru' ? 'бесплатный доступ' : currentLang === 'es' ? 'acceso gratuito' : 'free access');
      if (/бесплатн\w*\s+бета/i.test(trimmed)) node.nodeValue = raw.replace(/бесплатн\w*\s+бета(?:-версии| версия| версии)?/ig, 'бесплатном доступе');
      if (/beta gratuita/i.test(trimmed)) node.nodeValue = raw.replace(/beta gratuita/ig, 'acceso gratuito');
    };
    if (root.nodeType === Node.TEXT_NODE) return process(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) process(node);
  }

  const faqCopy = {
    en: {
      kicker: 'TRANSPARENCY',
      items: [
        ['How does Match Analyzer work?', 'Vertex collects available match and team data, normalizes it, calculates statistical scenarios and shows confidence together with data quality. Missing source data is marked as missing instead of being invented.'],
        ['Is Vertex Soccer AI free?', 'Yes. The service is currently free to use. Paid features are not enabled.'],
        ['What does Data Quality mean?', 'It shows how complete and reliable the input is for this exact match: recent form, team identity, fixture information, event statistics, availability, venue and context.'],
        ['Can Vertex analyze smaller leagues?', 'Coverage depends on the connected providers. Vertex can search globally, but a full forecast is shown only when enough reliable match history is available.'],
        ['Are predictions guaranteed?', 'No. Football is uncertain. Vertex provides probabilistic analysis and decision support, not guaranteed outcomes or financial advice.']
      ]
    },
    ru: {
      kicker: 'ПРОЗРАЧНОСТЬ',
      items: [
        ['Как работает анализ матча?', 'Vertex собирает доступные данные о матче и командах, нормализует их, рассчитывает статистические сценарии и показывает достоверность вместе с качеством данных. Если источник чего-то не вернул, система отмечает пробел, а не придумывает значение.'],
        ['Vertex Soccer AI бесплатный?', 'Да. Сейчас сервис доступен бесплатно. Платные функции не подключены.'],
        ['Что означает качество данных?', 'Это оценка полноты и надёжности информации именно для этого матча: свежая форма, идентификация команд, данные матча, событийная статистика, доступность игроков, стадион и контекст.'],
        ['Vertex анализирует небольшие лиги?', 'Покрытие зависит от подключённых поставщиков данных. Vertex может искать команды по всему миру, но полный прогноз показывает только тогда, когда есть достаточно надёжной истории матчей.'],
        ['Прогнозы гарантированы?', 'Нет. В футболе всегда есть неопределённость. Vertex даёт вероятностный анализ и поддержку решения, а не гарантированный результат или финансовую консультацию.']
      ]
    },
    es: {
      kicker: 'TRANSPARENCIA',
      items: [
        ['¿Cómo funciona el análisis del partido?', 'Vertex recopila los datos disponibles del partido y de los equipos, los normaliza, calcula escenarios estadísticos y muestra la confianza junto con la calidad de los datos. Si una fuente no aporta un dato, se marca como ausente en lugar de inventarlo.'],
        ['¿Vertex Soccer AI es gratuito?', 'Sí. Actualmente el servicio se puede usar de forma gratuita. No hay funciones de pago activadas.'],
        ['¿Qué significa la calidad de los datos?', 'Indica lo completos y fiables que son los datos para este partido: forma reciente, identidad de los equipos, información del encuentro, estadísticas de eventos, disponibilidad, estadio y contexto.'],
        ['¿Vertex puede analizar ligas pequeñas?', 'La cobertura depende de los proveedores conectados. Vertex puede buscar equipos a nivel global, pero solo muestra un pronóstico completo cuando existe suficiente historial fiable.'],
        ['¿Los pronósticos están garantizados?', 'No. El fútbol es incierto. Vertex ofrece análisis probabilístico y apoyo a la decisión, no resultados garantizados ni asesoramiento financiero.']
      ]
    }
  };

  function localizeFaq() {
    const faq = document.getElementById('tab-faq');
    if (!faq) return;
    const copy = faqCopy[lang()] || faqCopy.en;
    setText(faq.querySelector('.section-heading .kicker'), copy.kicker);
    setText(faq.querySelector('.section-heading .section-title'), 'FAQ');
    const items = [...faq.querySelectorAll('.faq-item')];
    copy.items.forEach(([question, answer], index) => {
      const item = items[index];
      if (!item) return;
      setText(item.querySelector('h3'), question);
      setText(item.querySelector('p'), answer);
    });
  }

  function removeDeprecatedUi() {
    // Live remains available internally as a provider capability, but the public
    // Live tab is intentionally removed from the product UI.
    document.querySelectorAll('.nav a[data-tab="live"]').forEach((node) => node.remove());
    document.getElementById('tab-live')?.remove();

    // Provider names are implementation details; keep them in technical analysis
    // data instead of exposing a noisy provider strip on the home page.
    document.querySelectorAll('.source-strip').forEach((node) => node.remove());

    // Registration no longer requires a separate age/terms checkbox.
    document.getElementById('vertexLegalConsentWrap')?.remove();
    document.getElementById('vertexLegalConsentStyle')?.remove();

    if (/^#\/live\/?$/i.test(location.hash)) {
      history.replaceState?.(null, '', '#/');
      document.querySelector('.nav a[data-tab="home"]')?.click();
    }
  }

  function refreshStrategySoon() {
    setTimeout(() => {
      scrubNode(document.getElementById('tab-strategy'));
      detachStrategyFromLegacyObserver();
    }, 90);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-action="edit-strategy"], [data-action="scan-strategy"], .nav a[data-tab="strategy"]')) refreshStrategySoon();
    if (event.target.closest?.('.nav a[data-tab="reviews"]')) setTimeout(() => scrubNode(document.getElementById('tab-reviews')), 200);
    if (event.target.closest?.('.nav a[data-tab="faq"]')) setTimeout(localizeFaq, 0);
  });

  document.addEventListener('submit', (event) => {
    if (event.target?.id === 'strategyForm') refreshStrategySoon();
  });

  document.addEventListener('vertex:languagechange', () => {
    requestAnimationFrame(() => {
      localizeFaq();
      scrubNode(document.getElementById('tab-strategy'));
      scrubNode(document.getElementById('tab-reviews'));
      removeDeprecatedUi();
    });
  });

  function boot() {
    removeDeprecatedUi();
    localizeFaq();
    scrubNode(document.getElementById('tab-home'));
    scrubNode(document.getElementById('tab-strategy'));
    scrubNode(document.getElementById('tab-reviews'));
    scrubNode(document.querySelector('.footer'));
    detachStrategyFromLegacyObserver();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
