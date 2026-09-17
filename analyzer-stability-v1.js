'use strict';

(() => {
  if (window.__vertexAnalyzerStabilityV1) return;
  window.__vertexAnalyzerStabilityV1 = true;

  let busy = false;
  let activeController = null;
  const nativeFetch = window.fetch.bind(window);

  function isAnalyzeRequest(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url || '';
      const url = new URL(raw, window.location.origin);
      return url.origin === window.location.origin && url.pathname === '/api/analyze';
    } catch (_) {
      return false;
    }
  }

  function setBusy(next) {
    busy = Boolean(next);
    document.documentElement.dataset.analysisBusy = busy ? 'true' : 'false';
    ['btnAnalyzeMatch', 'btnAnalyze'].forEach((id) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.disabled = busy;
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
    });

    try {
      const instance = window.tsParticles?.dom?.()?.[0] || window.tsParticles?.domItem?.(0);
      if (busy) instance?.pause?.();
      else instance?.play?.();
    } catch (_) {}
  }

  function ensureStyle() {
    if (document.getElementById('vertexAnalyzerStabilityStyle')) return;
    const style = document.createElement('style');
    style.id = 'vertexAnalyzerStabilityStyle';
    style.textContent = `
      html[data-analysis-busy="true"] #particles-js{opacity:.45;transition:opacity .18s ease}
      #btnAnalyzeMatch[disabled],#btnAnalyze[disabled]{cursor:wait;opacity:.72;filter:saturate(.8)}
      #btnAnalyzeMatch[aria-busy="true"]::after,#btnAnalyze[aria-busy="true"]::after{content:' …'}
    `;
    document.head.appendChild(style);
  }

  window.fetch = async (input, init = {}) => {
    if (!isAnalyzeRequest(input)) return nativeFetch(input, init);

    // The base UI used a 15 second AbortSignal. A full multi-provider analysis
    // can legitimately take longer, so analyzer requests receive their own
    // bounded timeout instead of being cancelled prematurely.
    activeController?.abort?.();
    const controller = new AbortController();
    activeController = controller;
    const timer = setTimeout(() => controller.abort(), 38000);
    setBusy(true);

    try {
      return await nativeFetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      if (activeController === controller) activeController = null;
      setBusy(false);
    }
  };

  // Block accidental double-clicks before a second analyzer request is created.
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#btnAnalyzeMatch, #btnAnalyze');
    if (!button || !busy) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  ensureStyle();
})();
