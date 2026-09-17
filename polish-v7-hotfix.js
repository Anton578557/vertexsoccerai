'use strict';

(() => {
  if (window.__vertexPolishV7Hotfix) return;
  window.__vertexPolishV7Hotfix = true;

  const lang = () => window.VertexI18n?.getLanguage?.() || localStorage.getItem('vertex_language') || 'en';

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
      if (key) pill.textContent = resultLetters[key];
    });

    root.querySelectorAll?.('.v6-line span').forEach((label) => {
      const raw = String(label.textContent || '').trim();
      const match = raw.match(/^(?:O|Over|Б|Más)\s*([0-9]+(?:\.[0-9]+)?)$/i);
      if (!match) return;
      label.textContent = current === 'ru' ? `Больше ${match[1]}` : current === 'es' ? `Más de ${match[1]}` : `Over ${match[1]}`;
    });

    root.querySelectorAll?.('.v6-vs').forEach((node) => { node.textContent = '—'; });

    const cabinetKicker = root.querySelector?.('.v6-cabinet-hero .v6-section-kicker');
    if (cabinetKicker) cabinetKicker.textContent = current === 'ru' ? 'АККАУНТ VERTEX' : current === 'es' ? 'CUENTA VERTEX' : 'VERTEX ACCOUNT';
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#btnLogin, #btnSignup, #btnCabinet')) resetInfoModalClass();
    if (event.target.closest?.('[data-modal-action="close"]')) resetInfoModalClass();
    if (event.target.id === 'modalOverlay') resetInfoModalClass();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') resetInfoModalClass();
  }, true);

  document.addEventListener('vertex:languagechange', () => setTimeout(() => localizeAnalysisDetails(document), 20));

  function boot() {
    localizeAnalysisDetails(document);
    const host = document.getElementById('analysisResult');
    if (host) new MutationObserver(() => localizeAnalysisDetails(host)).observe(host, { childList: true, subtree: true });
    const cabinet = document.querySelector('main.main-content');
    if (cabinet) new MutationObserver(() => localizeAnalysisDetails(cabinet)).observe(cabinet, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
