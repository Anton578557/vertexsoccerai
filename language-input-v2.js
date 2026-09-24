'use strict';

(() => {
  if (window.__vertexLanguageInputV2) return;
  window.__vertexLanguageInputV2 = true;

  function ensureStylesheet(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
  ensureStylesheet('language-input-v2.css');

  const extra = {
    ru: {
      'YOUR PROFILE': 'ВАШ ПРОФИЛЬ',
      'VERTEX RULES': 'ПРАВИЛА VERTEX',
      'BANKROLL REFERENCE': 'ОРИЕНТИР БАНКРОЛЛА',
      'DATA THRESHOLD': 'ПОРОГ КАЧЕСТВА',
      'MARKETS': 'РЫНКИ',
      'OBJECTIVE': 'ЦЕЛЬ',
      'EDIT PROFILE': 'ИЗМЕНИТЬ ПРОФИЛЬ',
      'SCAN TODAY': 'СКАНИРОВАТЬ МАТЧИ',
      'NO CHASING. NO FORCED PICKS.': 'БЕЗ ПОГОНИ. БЕЗ НАТЯНУТЫХ ПРОГНОЗОВ.',
      'Reject matches below 68% data quality.': 'Отклонять матчи с качеством данных ниже 68%.',
      'Pass when recent form or team availability is too weak.': 'Пропускать матч, если форма или данные по составу слишком слабые.',
      'Only use markets supported by the available source data.': 'Использовать только рынки, которые подтверждаются доступными данными.',
      'More matches do not mean better decisions.': 'Больше матчей не означает лучшее решение.',
      'Conservative': 'Консервативный',
      'Moderate': 'Средний',
      'Aggressive': 'Агрессивный',
      'Beginner': 'Новичок',
      'Intermediate': 'Средний',
      'Advanced': 'Опытный',
      'Choose two different teams.': 'Выберите две разные команды.',
      'Enter two team names.': 'Введите названия двух команд.',
      'ANALYSIS UNAVAILABLE': 'АНАЛИЗ НЕДОСТУПЕН',
      'Run an analysis first.': 'Сначала запустите анализ.'
    },
    es: {
      'YOUR PROFILE': 'TU PERFIL',
      'VERTEX RULES': 'REGLAS VERTEX',
      'BANKROLL REFERENCE': 'BANCA DE REFERENCIA',
      'DATA THRESHOLD': 'UMBRAL DE DATOS',
      'MARKETS': 'MERCADOS',
      'OBJECTIVE': 'OBJETIVO',
      'EDIT PROFILE': 'EDITAR PERFIL',
      'SCAN TODAY': 'ESCANEAR PARTIDOS',
      'NO CHASING. NO FORCED PICKS.': 'SIN PERSEGUIR. SIN FORZAR PRONÓSTICOS.',
      'Reject matches below 68% data quality.': 'Descartar partidos con calidad de datos inferior al 68%.',
      'Pass when recent form or team availability is too weak.': 'Pasar cuando la forma reciente o la disponibilidad sea demasiado débil.',
      'Only use markets supported by the available source data.': 'Usar solo mercados respaldados por los datos disponibles.',
      'More matches do not mean better decisions.': 'Más partidos no significa mejores decisiones.',
      'Conservative': 'Conservador',
      'Moderate': 'Moderado',
      'Aggressive': 'Agresivo',
      'Beginner': 'Principiante',
      'Intermediate': 'Intermedio',
      'Advanced': 'Avanzado',
      'Choose two different teams.': 'Elige dos equipos diferentes.',
      'Enter two team names.': 'Introduce dos equipos.',
      'ANALYSIS UNAVAILABLE': 'ANÁLISIS NO DISPONIBLE',
      'Run an analysis first.': 'Primero ejecuta un análisis.'
    }
  };

  const allBase = new Map();
  Object.entries(extra).forEach(([code, table]) => {
    Object.entries(table).forEach(([en, translated]) => {
      allBase.set(en, en);
      allBase.set(translated, en);
    });
  });

  function lang() {
    return window.VertexI18n?.getLanguage?.() || localStorage.getItem('vertex_language') || 'en';
  }

  // This translation helper is intentionally run only on boot and explicit
  // language changes. The old version watched the entire document and walked
  // every new analysis node, which became expensive when a large match report
  // was rendered.
  function translateExtra(root = document.body) {
    if (!root) return;
    const current = lang();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const raw = node.nodeValue || '';
      if (node.parentElement?.closest('[data-i18n-owned], [translate="no"], .vs-root, script, style')) continue;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const base = allBase.get(trimmed);
      if (!base) continue;
      const next = current === 'en' ? base : (extra[current]?.[base] || base);
      if (next === trimmed) continue;
      const leading = raw.match(/^\s*/)?.[0] || '';
      const trailing = raw.match(/\s*$/)?.[0] || '';
      node.nodeValue = `${leading}${next}${trailing}`;
    }
  }

  function buildLanguageButtons() {
    const wrap = document.getElementById('vertexLanguage');
    if (!wrap || wrap.querySelector('.vertex-lang-buttons')) return;
    const select = document.getElementById('vertexLanguageSelect');
    if (select) select.classList.add('vertex-language-native');

    const buttons = document.createElement('div');
    buttons.className = 'vertex-lang-buttons';
    buttons.setAttribute('role', 'group');
    buttons.setAttribute('aria-label', 'Language');
    buttons.innerHTML = `
      <button type="button" data-vertex-lang="en" title="English" translate="no"><span>EN</span></button>
      <button type="button" data-vertex-lang="ru" title="Русский" translate="no"><span>RU</span></button>
      <button type="button" data-vertex-lang="es" title="Español" translate="no"><span>ES</span></button>`;
    wrap.appendChild(buttons);

    buttons.addEventListener('click', (event) => {
      const button = event.target.closest('[data-vertex-lang]');
      if (!button) return;
      window.VertexI18n?.setLanguage?.(button.dataset.vertexLang);
    });
    syncLanguageButtons();
  }

  function syncLanguageButtons() {
    const current = lang();
    document.querySelector('.vertex-lang-buttons')?.setAttribute('aria-label',window.VertexI18n?.t('Language') || 'Language');
    document.querySelectorAll('[data-vertex-lang]').forEach((button) => {
      const active = button.dataset.vertexLang === current;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function normalizeMatchExpression(value) {
    return String(value || '')
      .replace(/\s+(?:против|vs\.?|v\.?|versus|contra)\s+/gi, ' vs ')
      .replace(/\s+[\-–—]\s+/g, ' vs ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function normalizeTarget(target) {
    if (!target || !['searchInput', 'analyzerSearch'].includes(target.id)) return;
    const normalized = normalizeMatchExpression(target.value);
    if (normalized && normalized !== target.value) target.value = normalized;
  }

  function updateAnalyzerPlaceholder() {
    const input = document.getElementById('analyzerSearch');
    if (!input) return;
    input.setAttribute('data-i18n-owned','');
    const current = lang();
    input.placeholder = current === 'ru'
      ? 'Например: Реал Мадрид — Барселона'
      : current === 'es'
        ? 'Ejemplo: Real Madrid contra Barcelona'
        : 'Example: Real Madrid vs Barcelona';
  }

  document.addEventListener('input', (event) => {
    const input = event.target.closest?.('#searchInput, #analyzerSearch');
    if (!input) return;
    if (/\s(?:против|contra|versus)\s/i.test(input.value)) normalizeTarget(input);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') normalizeTarget(event.target.closest?.('#searchInput, #analyzerSearch'));
  }, true);

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#btnAnalyze, #btnAnalyzeMatch');
    if (!button) return;
    normalizeTarget(document.getElementById(button.id === 'btnAnalyze' ? 'searchInput' : 'analyzerSearch'));
  }, true);

  document.addEventListener('vertex:languagechange', () => {
    syncLanguageButtons();
    requestAnimationFrame(() => {
      translateExtra(document.body);
      updateAnalyzerPlaceholder();
    });
  });

  function boot() {
    buildLanguageButtons();
    syncLanguageButtons();
    updateAnalyzerPlaceholder();
    translateExtra(document.body);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
