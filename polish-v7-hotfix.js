'use strict';

(() => {
  if (window.__vertexPolishV7Hotfix) return;
  window.__vertexPolishV7Hotfix = true;

  const lang = () => window.VertexI18n?.getLanguage?.() || localStorage.getItem('vertex_language') || 'en';

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function resetInfoModalClass() {
    const modal = document.getElementById('modalContent');
    if (modal?.classList.contains('vertex-info-v7')) modal.className = 'modal';
  }

  function localizeAnalysisDetails(root = document) {
    const current = lang();
    const resultLetters = {
      en: { w: 'W', d: 'D', l: 'L' },
      ru: { w: 'В', d: 'Н', l: 'П' },
      es: { w: 'G', d: 'E', l: 'P' }
    }[current] || { w: 'W', d: 'D', l: 'L' };

    root.querySelectorAll?.('.v6-pill').forEach((pill) => {
      const key = pill.classList.contains('w') ? 'w' : pill.classList.contains('d') ? 'd' : pill.classList.contains('l') ? 'l' : null;
      if (key) setText(pill, resultLetters[key]);
    });

    root.querySelectorAll?.('.v6-line span').forEach((label) => {
      const raw = String(label.textContent || '').trim();
      const match = raw.match(/^(?:O|Over|Больше|Más de)\s*([0-9]+(?:\.[0-9]+)?)$/i);
      if (!match) return;
      setText(label, current === 'ru' ? `Больше ${match[1]}` : current === 'es' ? `Más de ${match[1]}` : `Over ${match[1]}`);
    });

    root.querySelectorAll?.('.v6-vs').forEach((node) => setText(node, '—'));

    const cabinetKicker = root.querySelector?.('.v6-cabinet-hero .v6-section-kicker');
    if (cabinetKicker) {
      setText(cabinetKicker, current === 'ru' ? 'АККАУНТ VERTEX' : current === 'es' ? 'CUENTA VERTEX' : 'VERTEX ACCOUNT');
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#btnLogin, #btnSignup, #btnCabinet')) {
      resetInfoModalClass();
      if (event.target.closest?.('#btnCabinet')) setTimeout(() => localizeAnalysisDetails(document), 40);
    }
    if (event.target.closest?.('[data-modal-action="close"]')) resetInfoModalClass();
    if (event.target.id === 'modalOverlay') resetInfoModalClass();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') resetInfoModalClass();
  }, true);

  // Run only on explicit lifecycle events. The old MutationObservers rewrote
  // textContent while observing childList changes, which could create a
  // self-triggering mutation loop and freeze Chromium on large analysis reports.
  document.addEventListener('vertex:analysis-rendered', () => {
    requestAnimationFrame(() => localizeAnalysisDetails(document.getElementById('analysisResult') || document));
  });

  document.addEventListener('vertex:languagechange', () => {
    requestAnimationFrame(() => localizeAnalysisDetails(document));
  });

  function boot() {
    localizeAnalysisDetails(document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
