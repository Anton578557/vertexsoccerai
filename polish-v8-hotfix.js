'use strict';

(() => {
  if (window.__vertexPolishV8Hotfix) return;
  window.__vertexPolishV8Hotfix = true;

  const lang = () => window.VertexI18n?.getLanguage?.() || localStorage.getItem('vertex_language') || 'en';

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

  function refreshLanguageSoon() {
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('vertex:languagechange', { detail: { language: lang() } }));
      scrubNode(document.body);
      detachStrategyFromLegacyObserver();
    }, 90);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-action="edit-strategy"], [data-action="scan-strategy"], .nav a[data-tab="strategy"]')) refreshLanguageSoon();
    if (event.target.closest?.('.nav a[data-tab="reviews"]')) setTimeout(() => scrubNode(document.getElementById('tab-reviews')), 250);
  });

  document.addEventListener('submit', (event) => {
    if (event.target?.id === 'strategyForm') refreshLanguageSoon();
  });

  document.addEventListener('vertex:languagechange', () => setTimeout(() => scrubNode(document.body), 0));

  function boot() {
    scrubNode(document.body);
    detachStrategyFromLegacyObserver();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
