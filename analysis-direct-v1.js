'use strict';

(() => {
  if (window.__vertexDirectAnalyzerV1) return;
  window.__vertexDirectAnalyzerV1 = true;

  let inFlight = false;

  const lang = () => window.VertexI18n?.getLanguage?.() || localStorage.getItem('vertex_language') || 'en';
  const copy = {
    en: { format: 'Use the format “Home Team vs Away Team”.', error: 'Analysis unavailable' },
    ru: { format: 'Введите матч в формате «Команда 1 — Команда 2».', error: 'Анализ недоступен' },
    es: { format: 'Introduce el partido como «Equipo 1 — Equipo 2».', error: 'Análisis no disponible' }
  };

  function c() { return copy[lang()] || copy.en; }
  function esc(value) { return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch])); }

  function normalize(value) {
    return String(value || '')
      .replace(/\s+(?:против|contra|versus|vs\.?|v\.?)\s+/gi, ' vs ')
      .replace(/\s*[–—]\s*/g, ' vs ')
      .replace(/(\S)\s*-\s+(\S)/g, '$1 vs $2')
      .replace(/(\S)\s+-\s*(\S)/g, '$1 vs $2')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function parse(value) {
    const text = normalize(value);
    const parts = text.split(/\s+vs\s+/i).map((x) => x.trim()).filter(Boolean);
    if (parts.length !== 2 || parts.some((x) => x.length < 2)) return null;
    return { home: parts[0], away: parts[1], normalized: `${parts[0]} vs ${parts[1]}` };
  }

  function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.add('hidden'), 4200);
  }

  function closeSuggestions() {
    ['analyzerSuggestions', 'searchSuggestions'].forEach((id) => {
      const box = document.getElementById(id);
      if (!box) return;
      box.classList.remove('active');
      box.innerHTML = '';
    });
  }

  function showError(error) {
    const target = document.getElementById('analysisResult');
    if (!target) return;
    target.innerHTML = `<div class="analysis-error"><strong>${esc(c().error.toUpperCase())}</strong><p>${esc(error?.message || c().error)}</p></div>`;
  }

  async function run(input) {
    if (inFlight) return;
    const parsed = parse(input?.value);
    if (!parsed) return toast(c().format);

    input.value = parsed.normalized;
    closeSuggestions();
    inFlight = true;
    document.documentElement.dataset.vertexDirectBusy = 'true';

    try {
      const response = await fetch(`/api/analyze?home=${encodeURIComponent(parsed.home)}&away=${encodeURIComponent(parsed.away)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.analysis) throw new Error(payload?.error || `Request failed (${response.status})`);

      // One parsed response, one renderer. No legacy intermediate card and no
      // response.clone().json() work on the main thread.
      if (window.VertexAnalysisUI?.acceptAnalysis) window.VertexAnalysisUI.acceptAnalysis(payload.analysis);
      else document.dispatchEvent(new CustomEvent('vertex:analysis-ready', { detail: { analysis: payload.analysis } }));
    } catch (error) {
      showError(error);
    } finally {
      inFlight = false;
      delete document.documentElement.dataset.vertexDirectBusy;
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#btnAnalyzeMatch, #btnAnalyze');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (inFlight) return;
    const input = document.getElementById(button.id === 'btnAnalyze' ? 'searchInput' : 'analyzerSearch');
    if (input) run(input);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const input = event.target.closest?.('#analyzerSearch, #searchInput');
    if (!input) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!inFlight) run(input);
  }, true);
})();
