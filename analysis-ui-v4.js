'use strict';

(() => {
  if (window.__vertexUxV7) return;
  window.__vertexUxV7 = true;
  window.__vertexUxV6 = true;

  function ensureStylesheet(href) {
    if (document.querySelector(`link[href^="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
  ensureStylesheet('ux-v6.css');

  const SUPABASE_URL = 'https://bznjdzgtiddggcdhxadj.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_kWwttoQARBmC6H_NqsEL_A_A5I7wDON';
  let db = null;
  let lastAnalysis = null;
  let cabinetOpen = false;
  let lastPersistFingerprint = '';

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value || 0)));
  const lang = () => window.VertexI18n?.getLanguage?.() || localStorage.getItem('vertex_language') || 'en';
  const locale = () => ({ ru: 'ru-RU', es: 'es-ES', en: 'en-GB' }[lang()] || 'en-GB');

  const copy = {
    ru: {
      home: 'Победа хозяев', draw: 'Ничья', away: 'Победа гостей', summary: 'Что видит Vertex',
      likely: 'Наиболее вероятный исход', safer: 'Более осторожный сценарий', expectedGoals: 'Ожидаемые голы',
      btts: 'Обе забьют', over25: 'Тотал больше 2.5', confidence: 'Достоверность анализа', quality: 'Качество данных',
      probabilities: 'Вероятности исхода', form: 'Текущая форма', matches: 'матчей учтено', gf: 'Забито за матч', ga: 'Пропущено за матч', ppg: 'Очков за матч',
      why: 'Почему Vertex так считает', drivers: 'Факторы, которые реально изменили расчёт', events: 'Событийные рынки', corners: 'Угловые', cards: 'Жёлтые карточки', shots: 'Удары', sot: 'Удары в створ', offsides: 'Офсайды', fouls: 'Фолы', expected: 'Ожидание',
      penalty: 'Оценка пенальти', penaltyNote: 'Основано только на проверенной истории реализованных пенальти. Оценка намеренно консервативная.', penaltyMissing: 'Для оценки пенальти пока не хватает проверенной истории.',
      context: 'Контекст и состав', news: 'Новости', availability: 'Доступность игроков', noNews: 'Сильных новостных сигналов, меняющих модель, не найдено.',
      technical: 'Технические данные', source: 'Источники', save: 'СОХРАНИТЬ АНАЛИЗ', copy: 'КОПИРОВАТЬ СВОДКУ',
      saved: 'Анализ сохранён в личный кабинет.', copied: 'Сводка анализа скопирована.', withheld: 'Прогноз не выдан',
      withheldText: 'Vertex пока не собрал достаточно проверенной истории завершённых матчей по обеим командам.',
      noRecent: 'Нет свежих данных', noDrivers: 'Дополнительные факторы не были достаточно сильными, чтобы отдельно изменить модель.',
      fixtureLimited: 'Данные о матче ограничены для этого расчёта', homeLabel: 'Хозяева', awayLabel: 'Гости',
      cabinet: 'Личный кабинет', workspace: 'Ваше рабочее пространство Vertex', active: 'Аккаунт активен', recent: 'Последние анализы', savedMatches: 'Сохранённые матчи', strategy: 'Стратегия', activity: 'Активность', account: 'Аккаунт', language: 'Язык', member: 'Дата регистрации', email: 'Email', logout: 'ВЫЙТИ', back: 'НА ГЛАВНУЮ', openStrategy: 'ОТКРЫТЬ СТРАТЕГИЮ', noAnalyses: 'Анализов пока нет.', noSaved: 'Сохранённых матчей пока нет.', analyzeAgain: 'АНАЛИЗИРОВАТЬ СНОВА', cloudError: 'Не удалось загрузить облачную историю; показываем локальные данные.'
    },
    es: {
      home: 'Victoria local', draw: 'Empate', away: 'Victoria visitante', summary: 'Lo que ve Vertex',
      likely: 'Resultado más probable', safer: 'Escenario más prudente', expectedGoals: 'Goles esperados',
      btts: 'Ambos marcan', over25: 'Más de 2.5 goles', confidence: 'Confianza del análisis', quality: 'Calidad de datos',
      probabilities: 'Probabilidades del partido', form: 'Forma reciente', matches: 'partidos usados', gf: 'Goles a favor / partido', ga: 'Goles en contra / partido', ppg: 'Puntos / partido',
      why: 'Por qué Vertex piensa esto', drivers: 'Factores que realmente cambiaron el cálculo', events: 'Mercados de eventos', corners: 'Córners', cards: 'Tarjetas amarillas', shots: 'Tiros', sot: 'Tiros a puerta', offsides: 'Fueras de juego', fouls: 'Faltas', expected: 'Esperado',
      penalty: 'Estimación de penalti', penaltyNote: 'Basado solo en historial verificado de penaltis convertidos. La estimación es deliberadamente conservadora.', penaltyMissing: 'Aún no hay suficiente historial verificado para estimar penaltis.',
      context: 'Contexto y plantilla', news: 'Noticias', availability: 'Disponibilidad de jugadores', noNews: 'Ninguna señal fuerte de noticias cambió el modelo.',
      technical: 'Detalles técnicos', source: 'Fuentes', save: 'GUARDAR ANÁLISIS', copy: 'COPIAR RESUMEN',
      saved: 'Análisis guardado en Mi panel.', copied: 'Resumen copiado.', withheld: 'Pronóstico retenido',
      withheldText: 'Vertex aún no tiene suficiente historial verificado de partidos finalizados para ambos equipos.',
      noRecent: 'Sin datos recientes', noDrivers: 'Ningún factor adicional fue lo bastante fuerte como para cambiar el modelo por sí solo.',
      fixtureLimited: 'Los detalles del partido son limitados en este cálculo', homeLabel: 'Local', awayLabel: 'Visitante',
      cabinet: 'Mi panel', workspace: 'Tu espacio de trabajo Vertex', active: 'Cuenta activa', recent: 'Análisis recientes', savedMatches: 'Partidos guardados', strategy: 'Estrategia', activity: 'Actividad', account: 'Cuenta', language: 'Idioma', member: 'Miembro desde', email: 'Email', logout: 'CERRAR SESIÓN', back: 'VOLVER AL INICIO', openStrategy: 'ABRIR ESTRATEGIA', noAnalyses: 'Aún no hay análisis.', noSaved: 'Aún no hay partidos guardados.', analyzeAgain: 'ANALIZAR DE NUEVO', cloudError: 'No se pudo cargar el historial en la nube; mostramos datos locales.'
    },
    en: {
      home: 'Home win', draw: 'Draw', away: 'Away win', summary: 'What Vertex sees',
      likely: 'Most likely outcome', safer: 'Safer scenario', expectedGoals: 'Expected goals', btts: 'Both teams score', over25: 'Over 2.5 goals', confidence: 'Analysis confidence', quality: 'Data quality',
      probabilities: 'Match probabilities', form: 'Recent form', matches: 'matches used', gf: 'Goals scored / match', ga: 'Goals conceded / match', ppg: 'Points / match',
      why: 'Why Vertex thinks this', drivers: 'Factors that actually changed the calculation', events: 'Event markets', corners: 'Corners', cards: 'Yellow cards', shots: 'Shots', sot: 'Shots on target', offsides: 'Offsides', fouls: 'Fouls', expected: 'Expected',
      penalty: 'Penalty estimate', penaltyNote: 'Based only on verified scored-penalty history. The estimate is deliberately conservative.', penaltyMissing: 'More verified history is needed for a penalty estimate.',
      context: 'Context and availability', news: 'News', availability: 'Player availability', noNews: 'No strong news signal changed the model.',
      technical: 'Technical details', source: 'Sources', save: 'SAVE ANALYSIS', copy: 'COPY SUMMARY', saved: 'Analysis saved to My Cabinet.', copied: 'Analysis summary copied.', withheld: 'Prediction withheld',
      withheldText: 'Vertex does not yet have enough verified completed-match history for both teams.', noRecent: 'No recent data', noDrivers: 'No additional factor was strong enough to change the model on its own.', fixtureLimited: 'Fixture details are limited for this run', homeLabel: 'Home', awayLabel: 'Away',
      cabinet: 'My Cabinet', workspace: 'Your Vertex workspace', active: 'Account active', recent: 'Recent analyses', savedMatches: 'Saved matches', strategy: 'Strategy', activity: 'Activity', account: 'Account', language: 'Language', member: 'Member since', email: 'Email', logout: 'LOG OUT', back: 'BACK TO HOME', openStrategy: 'OPEN STRATEGY', noAnalyses: 'No analyses yet.', noSaved: 'No saved matches yet.', analyzeAgain: 'ANALYZE AGAIN', cloudError: 'Could not load cloud history; showing local data.'
    }
  };

  const t = (key) => (copy[lang()] || copy.en)[key] || copy.en[key] || key;

  function fmtDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''), window.location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? esc(url.href) : '';
    } catch (_) { return ''; }
  }

  function getDb() {
    if (window.__vertexApiAuthClient) return window.__vertexApiAuthClient;
    if (window.__vertexSupabaseClient) return window.__vertexSupabaseClient;
    if (db) return db;
    if (!window.supabase?.createClient) return null;
    try {
      db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      window.__vertexSupabaseClient = db;
      return db;
    } catch (_) { return null; }
  }

  function readLocal(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; }
  }

  function writeLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function toast(message, ms = 3400) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.add('hidden'), ms);
  }

  function resultLabel(result) {
    const code = String(result || '').toUpperCase();
    const map = {
      ru: { W: 'В', D: 'Н', L: 'П' },
      es: { W: 'G', D: 'E', L: 'P' },
      en: { W: 'W', D: 'D', L: 'L' }
    };
    return map[lang()]?.[code] || code;
  }

  function formPills(stats = {}) {
    const rows = Array.isArray(stats.sequence) ? stats.sequence.slice(0, 8) : [];
    if (!rows.length) return `<span class="v6-event-note">${esc(t('noRecent'))}</span>`;
    return rows.map((result) => `<span class="v6-pill ${esc(String(result).toLowerCase())}">${esc(resultLabel(result))}</span>`).join('');
  }

  function formCard(team, stats = {}) {
    return `<div class="v6-form-card"><div class="v6-form-title"><strong>${esc(team)}</strong><span>${Number(stats.played || 0)} ${esc(t('matches'))}</span></div><div class="v6-form-pills">${formPills(stats)}</div><div class="v6-form-metrics"><div><span>${esc(t('gf'))}</span><strong>${Number.isFinite(Number(stats.avgFor)) ? Number(stats.avgFor).toFixed(2) : '—'}</strong></div><div><span>${esc(t('ga'))}</span><strong>${Number.isFinite(Number(stats.avgAgainst)) ? Number(stats.avgAgainst).toFixed(2) : '—'}</strong></div><div><span>${esc(t('ppg'))}</span><strong>${Number.isFinite(Number(stats.ppg)) ? Number(stats.ppg).toFixed(2) : '—'}</strong></div></div></div>`;
  }

  function bestDoubleChance(dc = {}) {
    return [['1X', Number(dc.oneX)], ['X2', Number(dc.xTwo)], ['12', Number(dc.oneTwo)]].filter(([, v]) => Number.isFinite(v)).sort((a, b) => b[1] - a[1])[0] || ['—', null];
  }

  function outcomeLabel(raw) {
    if (raw === 'Home win') return t('home');
    if (raw === 'Away win') return t('away');
    if (raw === 'Draw') return t('draw');
    return raw || '—';
  }

  function marketLineLabel(label) {
    const match = String(label || '').match(/^O(\d+(?:\.\d+)?)$/i);
    if (!match) return String(label || '');
    if (lang() === 'ru') return `Больше ${match[1]}`;
    if (lang() === 'es') return `Más de ${match[1]}`;
    return `Over ${match[1]}`;
  }

  function eventLines(rows) {
    return `<div class="v6-lines">${rows.map(([label, value]) => `<div class="v6-line"><span>${esc(marketLineLabel(label))}</span><strong>${Number.isFinite(Number(value)) ? `${Math.round(Number(value))}%` : '—'}</strong></div>`).join('')}</div>`;
  }

  function eventCard(label, metric, rows = []) {
    if (!metric) return '';
    return `<div class="v6-event-card"><div class="v6-event-top"><span>${esc(label)}</span><strong>${esc(t('expected'))} ${Number.isFinite(Number(metric.expectedTotal)) ? Number(metric.expectedTotal).toFixed(1) : '—'}</strong></div><div class="v6-event-split"><span>${esc(t('homeLabel'))}: <b>${Number.isFinite(Number(metric.expectedHome)) ? Number(metric.expectedHome).toFixed(1) : '—'}</b></span><span>${esc(t('awayLabel'))}: <b>${Number.isFinite(Number(metric.expectedAway)) ? Number(metric.expectedAway).toFixed(1) : '—'}</b></span></div>${rows.length ? eventLines(rows) : ''}</div>`;
  }

  function renderEvents(analysis) {
    const g = analysis?.granularModel;
    const p = analysis?.penaltyModel;
    const cards = [];
    if (g?.ok) {
      cards.push(eventCard(t('corners'), g.corners, [['O7.5', g.corners?.over75], ['O8.5', g.corners?.over85], ['O9.5', g.corners?.over95]]));
      cards.push(eventCard(t('cards'), g.cards, [['O3.5', g.cards?.over35], ['O4.5', g.cards?.over45], ['O5.5', g.cards?.over55]]));
      cards.push(eventCard(t('shots'), g.shots, [['O21.5', g.shots?.over215], ['O23.5', g.shots?.over235], ['O25.5', g.shots?.over255]]));
      cards.push(eventCard(t('sot'), g.shotsOnTarget, [['O6.5', g.shotsOnTarget?.over65], ['O7.5', g.shotsOnTarget?.over75], ['O8.5', g.shotsOnTarget?.over85]]));
      cards.push(eventCard(t('offsides'), g.offsides, [['O2.5', g.offsides?.over25], ['O3.5', g.offsides?.over35], ['O4.5', g.offsides?.over45]]));
      cards.push(eventCard(t('fouls'), g.fouls));
    }
    cards.push(`<div class="v6-event-card v6-penalty-card"><div class="v6-event-top"><span>${esc(t('penalty'))}</span><strong>${p?.ok ? `${Math.round(Number(p.probabilityPct || 0))}%` : '—'}</strong></div>${p?.ok ? `<div class="v6-event-split"><span>${esc(t('homeLabel'))}: <b>${Math.round(Number(p.homeProbabilityPct || 0))}%</b></span><span>${esc(t('awayLabel'))}: <b>${Math.round(Number(p.awayProbabilityPct || 0))}%</b></span></div><p class="v6-event-note">${esc(t('penaltyNote'))}</p>` : `<p class="v6-event-note">${esc(t('penaltyMissing'))}</p>`}</div>`);
    return `<section class="v6-section"><div class="v6-section-head"><div><span class="v6-section-kicker">${esc(t('events'))}</span><h4>${esc(t('corners'))} · ${esc(t('cards'))} · ${esc(t('shots'))} · ${esc(t('penalty'))}</h4></div></div><div class="v6-event-grid">${cards.filter(Boolean).join('')}</div></section>`;
  }

  function renderDrivers(analysis, home, away) {
    const rows = Array.isArray(analysis?.vertexModel?.drivers) ? analysis.vertexModel.drivers.slice(0, 5) : [];
    if (!rows.length) return `<div class="v6-cabinet-empty">${esc(t('noDrivers'))}</div>`;
    const labels = {
      en: { form: 'Recent form', 'schedule-strength': 'Opponent strength', 'home-fatigue': 'Recovery / schedule', 'away-fatigue': 'Recovery / schedule', 'news-home': 'News / squad', 'news-away': 'News / squad', weather: 'Weather', 'shot-pressure': 'Shot pressure', h2h: 'Head-to-head' },
      ru: { form: 'Текущая форма', 'schedule-strength': 'Сила соперников', 'home-fatigue': 'Восстановление / календарь', 'away-fatigue': 'Восстановление / календарь', 'news-home': 'Новости / состав', 'news-away': 'Новости / состав', weather: 'Погода', 'shot-pressure': 'Давление по ударам в створ', h2h: 'Очные встречи' },
      es: { form: 'Forma reciente', 'schedule-strength': 'Fuerza de los rivales', 'home-fatigue': 'Recuperación / calendario', 'away-fatigue': 'Recuperación / calendario', 'news-home': 'Noticias / plantilla', 'news-away': 'Noticias / plantilla', weather: 'Clima', 'shot-pressure': 'Presión de tiros a puerta', h2h: 'Enfrentamientos directos' }
    };
    return `<div class="v6-driver-list">${rows.map((driver) => {
      const side = driver.side === 'home' ? home : driver.side === 'away' ? away : `${home} / ${away}`;
      const label = labels[lang()]?.[driver.key] || labels.en[driver.key] || driver.label || driver.key || 'Vertex';
      return `<div class="v6-driver"><span class="v6-driver-icon">•</span><div><strong>${esc(label)} · ${esc(side)}</strong><small>${esc(driver.source || 'Vertex')}</small></div><b>${Number(driver.magnitudePct || 0)}%</b></div>`;
    }).join('')}</div>`;
  }

  function renderContext(analysis) {
    const cards = [];
    for (const side of ['home', 'away']) {
      const team = side === 'home' ? analysis.teams?.home?.name : analysis.teams?.away?.name;
      for (const signal of (analysis?.squad?.[side]?.signals || []).slice(0, 2)) {
        const rawState = String(signal.state || 'doubtful').toLowerCase();
        const stateLabels = {
          en: { out: 'OUT', doubtful: 'DOUBTFUL', available: 'AVAILABLE' },
          ru: { out: 'ВЫБЫЛ', doubtful: 'ПОД ВОПРОСОМ', available: 'ДОСТУПЕН' },
          es: { out: 'BAJA', doubtful: 'DUDA', available: 'DISPONIBLE' }
        };
        const state = stateLabels[lang()]?.[rawState] || rawState.toUpperCase();
        const player = signal.player || (lang() === 'ru' ? 'Ключевой игрок' : lang() === 'es' ? 'Jugador clave' : 'Key player');
        const reason = signal.suspension ? (lang() === 'ru' ? 'дисквалификация' : lang() === 'es' ? 'suspensión' : 'suspension') : (lang() === 'ru' ? 'травма / доступность' : lang() === 'es' ? 'lesión / disponibilidad' : 'injury / availability');
        cards.push(`<div class="v6-context-card"><span>${esc(t('availability'))}</span><strong>${esc(team)} · ${esc(player)} · ${esc(state)}</strong><p>${esc(reason)}</p></div>`);
      }
    }
    const news = Array.isArray(analysis?.news) ? analysis.news.slice(0, 3) : [];
    if (!news.length) cards.push(`<div class="v6-context-card"><span>${esc(t('news'))}</span><strong>${esc(t('noNews'))}</strong></div>`);
    else news.forEach((item) => cards.push(`<div class="v6-context-card"><span>${esc(t('news'))}</span><strong>${esc(item.title || item.signal || 'Context update')}</strong><p>${esc(item.source || 'News')}${item.publishedAt ? ` · ${esc(fmtDate(item.publishedAt))}` : ''}</p></div>`));
    return `<section class="v6-section"><div class="v6-section-head"><div><span class="v6-section-kicker">${esc(t('context'))}</span><h4>${esc(t('news'))} · ${esc(t('availability'))}</h4></div></div><div class="v6-context-grid">${cards.join('')}</div></section>`;
  }

  function renderModel(analysis, homeName, awayName) {
    const model = analysis?.model;
    if (!model) return `<div class="v6-withheld"><strong>${esc(t('withheld'))}</strong><p>${esc(t('withheldText'))}</p></div>`;
    const rows = [
      { label: t('home'), value: clamp(model.oneXtwo?.home, 0, 100) },
      { label: t('draw'), value: clamp(model.oneXtwo?.draw, 0, 100) },
      { label: t('away'), value: clamp(model.oneXtwo?.away, 0, 100) }
    ];
    const best = [...rows].sort((a, b) => b.value - a.value)[0];
    const [dc, dcValue] = bestDoubleChance(model.doubleChance || {});
    const confidence = analysis.confidence == null ? null : clamp(analysis.confidence, 0, 100);
    const quality = clamp(analysis.dataQuality, 0, 100);
    return `<section class="v6-summary"><span class="v6-summary-kicker">${esc(t('summary'))}</span><h3>${esc(outcomeLabel(model.mainScenario))} · ${Math.round(best.value)}%</h3><div class="v6-summary-grid"><div class="v6-summary-stat"><span>${esc(t('likely'))}</span><strong>${esc(outcomeLabel(model.mainScenario))}</strong><small>${Math.round(best.value)}%</small></div><div class="v6-summary-stat"><span>${esc(t('safer'))}</span><strong>${esc(dc)} · ${dcValue == null ? '—' : `${Math.round(dcValue)}%`}</strong><small>${esc(dc === '1X' ? `${homeName} / ${t('draw')}` : dc === 'X2' ? `${t('draw')} / ${awayName}` : `${homeName} / ${awayName}`)}</small></div><div class="v6-summary-stat"><span>${esc(t('expectedGoals'))}</span><strong>${model.expectedGoals?.home ?? '—'} : ${model.expectedGoals?.away ?? '—'}</strong><small>${esc(t('over25'))}: ${model.over25 ?? '—'}%</small></div><div class="v6-summary-stat"><span>${esc(t('btts'))}</span><strong>${model.btts ?? '—'}%</strong><small>BTTS</small></div></div></section><div class="v6-quality-row"><div class="v6-quality-card"><div class="v6-quality-head"><span>${esc(t('confidence'))}</span><strong>${confidence ?? '—'}%</strong></div><div class="v6-track"><i style="width:${confidence ?? 0}%"></i></div></div><div class="v6-quality-card"><div class="v6-quality-head"><span>${esc(t('quality'))}</span><strong>${quality}%</strong></div><div class="v6-track"><i style="width:${quality}%"></i></div></div></div><section class="v6-section"><div class="v6-section-head"><div><span class="v6-section-kicker">1X2</span><h4>${esc(t('probabilities'))}</h4></div></div><div class="v6-prob-grid">${rows.map((row) => `<div class="v6-prob ${row === best ? 'best' : ''}"><span>${esc(row.label)}</span><strong>${Math.round(row.value)}%</strong></div>`).join('')}</div></section>`;
  }

  function renderAnalysis(analysis) {
    const home = analysis?.teams?.home || {};
    const away = analysis?.teams?.away || {};
    const homeName = home.name || t('homeLabel');
    const awayName = away.name || t('awayLabel');
    const fixture = analysis?.fixture || {};
    const fixtureMeta = [fixture.league, fmtDate(fixture.date), fixture.venue, fixture.city].filter(Boolean).join(' · ');
    const sourceRows = Object.entries(analysis?.sourceStatus || {}).slice(0, 12);
    const limitations = Array.isArray(analysis?.limitations) ? analysis.limitations.slice(0, 8) : [];
    const homeBadge = safeUrl(home.badge);
    const awayBadge = safeUrl(away.badge);
    return `<div class="analysis-card v6-analysis-card"><div class="v6-match-head"><div class="v6-team">${homeBadge ? `<img src="${homeBadge}" alt="">` : ''}<strong>${esc(homeName)}</strong><small>${esc(home.country || '')}</small></div><div class="v6-vs">VS</div><div class="v6-team">${awayBadge ? `<img src="${awayBadge}" alt="">` : ''}<strong>${esc(awayName)}</strong><small>${esc(away.country || '')}</small></div></div><div class="v6-fixture-meta">${esc(fixtureMeta || t('fixtureLimited'))}</div>${renderModel(analysis, homeName, awayName)}<section class="v6-section"><div class="v6-section-head"><div><span class="v6-section-kicker">${esc(t('form'))}</span><h4>${esc(homeName)} · ${esc(awayName)}</h4></div></div><div class="v6-form-grid">${formCard(homeName, analysis?.form?.home || {})}${formCard(awayName, analysis?.form?.away || {})}</div></section>${analysis?.model ? `<section class="v6-section"><div class="v6-section-head"><div><span class="v6-section-kicker">VERTEX MODEL 2.0</span><h4>${esc(t('why'))}</h4></div><p>${esc(t('drivers'))}</p></div>${renderDrivers(analysis, homeName, awayName)}</section>` : ''}${renderEvents(analysis)}${renderContext(analysis)}<details class="v6-tech"><summary>${esc(t('technical'))}</summary><div class="v6-tech-body">${sourceRows.length ? `<p><strong>${esc(t('source'))}:</strong> ${sourceRows.map(([k,v]) => `${esc(k)}: ${esc(v)}`).join(' · ')}</p>` : ''}${limitations.length ? `<ul>${limitations.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}</div></details><div class="v6-actions"><button class="btn-secondary" data-action="save-analysis" type="button">${esc(t('save'))}</button><button class="btn-secondary" data-action="copy-analysis" type="button">${esc(t('copy'))}</button></div></div>`;
  }

  function rememberAnalysis(analysis) {
    const row = { match: `${analysis?.teams?.home?.name || 'Home'} vs ${analysis?.teams?.away?.name || 'Away'}`, date: new Date().toISOString(), confidence: analysis?.confidence, dataQuality: analysis?.dataQuality, mainScenario: analysis?.model?.mainScenario || null };
    const list = [row, ...readLocal('vertex_recent_analyses', []).filter((item) => item.match !== row.match)].slice(0, 20);
    writeLocal('vertex_recent_analyses', list);
  }

  function compactPayload(analysis) {
    return {
      version: 'ux7', teams: analysis.teams || null, fixture: analysis.fixture || null,
      confidence: analysis.confidence ?? null, dataQuality: analysis.dataQuality ?? null,
      model: analysis.model || null,
      vertexModel: analysis.vertexModel ? { decision: analysis.vertexModel.decision || null, drivers: (analysis.vertexModel.drivers || []).slice(0, 8) } : null,
      form: analysis.form || null, penaltyModel: analysis.penaltyModel || null, granularModel: analysis.granularModel || null,
      news: Array.isArray(analysis.news) ? analysis.news.slice(0, 5) : [],
      squad: analysis.squad ? { home: { signals: (analysis.squad.home?.signals || []).slice(0, 4) }, away: { signals: (analysis.squad.away?.signals || []).slice(0, 4) } } : null,
      generatedAt: analysis.generatedAt || new Date().toISOString()
    };
  }

  async function persistAnalysis(analysis) {
    const client = getDb();
    if (!client || !analysis?.teams?.home?.name || !analysis?.teams?.away?.name) return;
    if (Number(analysis?.dataQuality || 0) <= 0) return;
    try {
      const session = (await client.auth.getSession()).data?.session;
      if (!session?.user) return;
      await client.from('analysis_history').insert([{
        user_id: session.user.id,
        home_team: analysis.teams.home.name,
        away_team: analysis.teams.away.name,
        fixture_date: analysis.fixture?.date || null,
        main_scenario: analysis.model?.mainScenario || null,
        confidence: analysis.confidence == null ? null : Math.round(Number(analysis.confidence)),
        data_quality: analysis.dataQuality == null ? null : Math.round(Number(analysis.dataQuality)),
        analysis_payload: compactPayload(analysis)
      }]);
    } catch (error) { console.warn('[Vertex UX7] history', error?.message || error); }
  }

  function idlePersist(analysis) {
    const run = () => persistAnalysis(analysis);
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2500 });
    else setTimeout(run, 400);
  }

  function analysisFingerprint(analysis) {
    return [
      analysis?.generatedAt || '',
      analysis?.teams?.home?.name || '',
      analysis?.teams?.away?.name || '',
      analysis?.fixture?.date || ''
    ].join('|');
  }

  function acceptAnalysis(analysis, options = {}) {
    if (!analysis?.teams?.home?.name || !analysis?.teams?.away?.name) return;
    lastAnalysis = analysis;
    const target = document.getElementById('analysisResult');
    if (target) {
      target.innerHTML = renderAnalysis(analysis);
      target.dataset.vertexV7Key = `${analysis.generatedAt || Date.now()}-${lang()}`;
    }

    const fingerprint = analysisFingerprint(analysis);
    const shouldPersist = options.persist !== false
      && Number(analysis?.dataQuality || 0) > 0
      && fingerprint !== lastPersistFingerprint;

    if (shouldPersist) {
      lastPersistFingerprint = fingerprint;
      rememberAnalysis(analysis);
      idlePersist(analysis);
    }

    document.dispatchEvent(new CustomEvent('vertex:analysis-rendered', { detail: { analysis } }));
  }

  async function saveCurrent() {
    if (!lastAnalysis) return;
    const row = { match: `${lastAnalysis.teams.home.name} vs ${lastAnalysis.teams.away.name}`, savedAt: new Date().toISOString(), confidence: lastAnalysis.confidence, dataQuality: lastAnalysis.dataQuality, mainScenario: lastAnalysis.model?.mainScenario || null };
    writeLocal('vertex_saved_analyses', [row, ...readLocal('vertex_saved_analyses', []).filter((x) => x.match !== row.match)].slice(0, 50));
    const client = getDb();
    try {
      const session = client ? (await client.auth.getSession()).data?.session : null;
      if (session?.user) await client.from('saved_matches').upsert([{ user_id: session.user.id, home_team: lastAnalysis.teams.home.name, away_team: lastAnalysis.teams.away.name, fixture_date: lastAnalysis.fixture?.date || null }], { onConflict: 'user_id,home_team,away_team,fixture_date' });
    } catch (error) { console.warn('[Vertex UX7] save', error?.message || error); }
    toast(t('saved'));
  }

  async function copyCurrent() {
    if (!lastAnalysis) return;
    const text = [`Vertex Soccer AI — ${lastAnalysis.teams.home.name} vs ${lastAnalysis.teams.away.name}`, `${t('quality')}: ${lastAnalysis.dataQuality ?? '—'}%`, `${t('confidence')}: ${lastAnalysis.confidence ?? '—'}%`, `${t('likely')}: ${outcomeLabel(lastAnalysis.model?.mainScenario)}`].join('\n');
    try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch (_) {}
  }

  function ensureCabinetSection() {
    let section = document.getElementById('tab-cabinet');
    if (section) return section;
    section = document.createElement('section');
    section.id = 'tab-cabinet'; section.className = 'tab-content';
    document.querySelector('main.main-content')?.appendChild(section);
    return section;
  }

  function cabinetRows(rows, emptyText) {
    if (!rows.length) return `<div class="v6-cabinet-empty">${esc(emptyText)}</div>`;
    return `<div class="v6-cabinet-list">${rows.slice(0, 10).map((row) => { const match = row.match || [row.home_team, row.away_team].filter(Boolean).join(' vs '); const date = row.created_at || row.date || row.savedAt || row.fixture_date; return `<div class="v6-cabinet-row"><div><strong>${esc(match)}</strong><small>${esc(date ? fmtDate(date) : '')}</small></div><button type="button" data-v7-analyze="${esc(match)}">${esc(t('analyzeAgain'))}</button></div>`; }).join('')}</div>`;
  }

  async function openCabinet() {
    const section = ensureCabinetSection();
    document.querySelectorAll('.tab-content').forEach((node) => node.classList.remove('active'));
    document.querySelectorAll('.nav a[data-tab]').forEach((node) => node.classList.remove('active'));
    section.classList.add('active'); cabinetOpen = true;
    if (history.replaceState) history.replaceState(null, '', '#/cabinet');
    section.innerHTML = `<div class="v6-cabinet"><div class="v6-cabinet-loading">${esc(t('workspace'))}</div></div>`;

    const client = getDb();
    let session = null, cloudHistory = [], cloudSaved = [], strategy = null, cloudError = false;
    try { session = client ? (await client.auth.getSession()).data?.session : null; } catch (_) {}
    if (!session?.user) { cabinetOpen = false; document.getElementById('btnLogin')?.click(); return; }
    try {
      const [h, s, p] = await Promise.all([
        client.from('analysis_history').select('home_team,away_team,fixture_date,main_scenario,confidence,data_quality,created_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(15),
        client.from('saved_matches').select('home_team,away_team,fixture_date,created_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(15),
        client.from('strategy_profiles').select('*').eq('user_id', session.user.id).maybeSingle()
      ]);
      if (h.error || s.error) throw h.error || s.error;
      cloudHistory = h.data || []; cloudSaved = s.data || []; strategy = p.data || null;
    } catch (error) { cloudError = true; console.warn('[Vertex UX7] cabinet', error?.message || error); }
    const localHistory = readLocal('vertex_recent_analyses', []); const localSaved = readLocal('vertex_saved_analyses', []);
    const recent = [...cloudHistory, ...localHistory].slice(0, 20); const saved = [...cloudSaved, ...localSaved].slice(0, 20);
    const joined = session.user.created_at ? fmtDate(session.user.created_at) : '—';
    section.innerHTML = `<div class="v6-cabinet"><div class="v6-cabinet-hero"><div><span class="v6-section-kicker">VERTEX ACCOUNT</span><h2>${esc(t('cabinet'))}</h2><p>${esc(t('workspace'))}</p></div><div class="v6-account-badge">● ${esc(t('active'))}</div></div>${cloudError ? `<div class="v6-cabinet-empty">${esc(t('cloudError'))}</div>` : ''}<div class="v6-cabinet-stats"><div class="v6-cabinet-stat"><span>${esc(t('recent'))}</span><strong>${recent.length}</strong></div><div class="v6-cabinet-stat"><span>${esc(t('savedMatches'))}</span><strong>${saved.length}</strong></div><div class="v6-cabinet-stat"><span>${esc(t('strategy'))}</span><strong>${strategy || readLocal('vertex_strategy_profile', null) ? 'ACTIVE' : '—'}</strong></div><div class="v6-cabinet-stat"><span>${esc(t('activity'))}</span><strong>${recent.length}</strong></div></div><div class="v6-cabinet-layout"><div><section class="v6-cabinet-panel"><h3>${esc(t('recent'))}</h3>${cabinetRows(recent, t('noAnalyses'))}</section><section class="v6-cabinet-panel"><h3>${esc(t('savedMatches'))}</h3>${cabinetRows(saved, t('noSaved'))}</section></div><aside><section class="v6-cabinet-panel"><h3>${esc(t('account'))}</h3><div class="v6-setting-grid"><div class="v6-setting"><span>${esc(t('email'))}</span><strong>${esc(session.user.email || '—')}</strong></div><div class="v6-setting"><span>${esc(t('member'))}</span><strong>${esc(joined)}</strong></div><div class="v6-setting"><span>${esc(t('language'))}</span><strong>${esc(lang().toUpperCase())}</strong></div></div><div class="v6-cabinet-actions"><button class="btn-primary" type="button" data-v7-strategy>${esc(t('openStrategy'))}</button><button class="btn-secondary" type="button" data-v7-home>${esc(t('back'))}</button><button class="btn-secondary" type="button" data-v7-logout>${esc(t('logout'))}</button></div></section></aside></div></div>`;
  }

  document.addEventListener('vertex:analysis-ready', (event) => acceptAnalysis(event.detail?.analysis), false);
  window.VertexAnalysisUI = { acceptAnalysis };

  document.addEventListener('click', (event) => {
    if (event.target.closest('#btnCabinet')) { event.preventDefault(); event.stopImmediatePropagation(); openCabinet(); return; }
    if (event.target.closest('[data-action="save-analysis"]')) { event.preventDefault(); event.stopImmediatePropagation(); saveCurrent(); return; }
    if (event.target.closest('[data-action="copy-analysis"]')) { event.preventDefault(); event.stopImmediatePropagation(); copyCurrent(); return; }
    const again = event.target.closest('[data-v7-analyze]');
    if (again) { event.preventDefault(); const input = document.getElementById('analyzerSearch'); if (input) input.value = again.dataset.v7Analyze; document.querySelector('.nav a[data-tab="analyzer"]')?.click(); setTimeout(() => document.getElementById('btnAnalyzeMatch')?.click(), 60); return; }
    if (event.target.closest('[data-v7-strategy]')) { cabinetOpen = false; document.querySelector('.nav a[data-tab="strategy"]')?.click(); return; }
    if (event.target.closest('[data-v7-home]')) { cabinetOpen = false; document.querySelector('.nav a[data-tab="home"]')?.click(); return; }
    if (event.target.closest('[data-v7-logout]')) { getDb()?.auth.signOut().finally(() => window.location.reload()); }
  }, true);

  document.addEventListener('vertex:languagechange', () => {
    if (lastAnalysis) acceptAnalysis(lastAnalysis, { persist: false });
    if (cabinetOpen) openCabinet();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureCabinetSection, { once: true });
  else ensureCabinetSection();
})();
