'use strict';

(() => {
  if (window.__vertexAnalyzerInputCleanup) return;
  window.__vertexAnalyzerInputCleanup = true;

  function closeSuggestions() {
    ['analyzerSuggestions', 'searchSuggestions'].forEach((id) => {
      const box = document.getElementById(id);
      if (!box) return;
      box.classList.remove('active');
      box.innerHTML = '';
      box.setAttribute('aria-hidden', 'true');
    });
  }

  function installStyle() {
    if (document.getElementById('vertexAnalyzerInputCleanupStyle')) return;
    const style = document.createElement('style');
    style.id = 'vertexAnalyzerInputCleanupStyle';
    style.textContent = `
      #analyzerSuggestions,#searchSuggestions{display:none!important}
      html[data-analysis-busy="true"] #analyzerSearch,
      html[data-analysis-busy="true"] #searchInput{pointer-events:none;opacity:.82}
      html[data-analysis-busy="true"] #analysisResult{contain:layout paint style}
      html[data-analysis-busy="true"] .analysis-card:not(.vertex-analysis-loader){content-visibility:auto}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#btnAnalyzeMatch,#btnAnalyze')) closeSuggestions();
    else if (!event.target.closest?.('#analyzerSearch,#searchInput')) closeSuggestions();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.closest?.('#analyzerSearch,#searchInput')) closeSuggestions();
  }, true);

  document.addEventListener('vertex:languagechange', closeSuggestions);

  function boot() {
    installStyle();
    closeSuggestions();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
