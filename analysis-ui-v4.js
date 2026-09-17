'use strict';

(() => {
  if (window.__vertexUxV6) return;
  window.__vertexUxV6 = true;

  function ensureStylesheet(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
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
  let renderTimer = null;
  let cabinetOpen = false;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value || 0)));
  const lang = () => window.VertexI18n?.getLanguage?.() || localStorage.getItem('vertex_language') || 'en';
  const locale = () => window.VertexI18n?.getLocale?.() || ({ ru: 'ru-RU', es: 'es-ES', en: 'en-GB' }[lang()] || 'en-GB');

  const dict = {
    ru: {
      'Match analysis': 'Разбор матча', 'What Vertex sees': 'Что видит Vertex', 'Most likely outcome': 'Наиболее вероятный исход',
      'Safer scenario': 'Более осторожный сценарий', 'Expected goals': 'Ожидаемые голы', 'Both teams score': 'Обе забьют',
      'Model decision': 'Решение модели', 'WATCH': 'НАБЛЮДАТЬ', 'STRONG WATCH': 'СИЛЬНЫЙ СИГНАЛ', 'PASS': 'ПРОПУСТИТЬ',
      'This is a probability, not a guarantee.': 'Это вероятность, а не гарантия результата.',
      'Analysis confidence': 'Достоверность анализа', 'Data quality': 'Качество данных',
      'How decisive the model is after uncertainty is considered.': 'Насколько уверенно модель различает сценарии после учёта неопределённости.',
      'How complete and reliable the source data is for this exact match.': 'Насколько полные и надёжные данные собраны именно для этого матча.',
      'Match probabilities': 'Вероятности исхода', 'Home win': 'Победа хозяев', 'Draw': 'Ничья', 'Away win': 'Победа гостей',
      'Vertex currently gives the highest probability to {outcome} ({pct}%).': 'Сейчас Vertex даёт наибольшую вероятность сценарию «{outcome}» — {pct}%.',
      'Recent form': 'Текущая форма', 'matches used': 'матчей учтено', 'Goals scored / match': 'Забито за матч',
      'Goals conceded / match': 'Пропущено за матч', 'Points / match': 'Очков за матч', 'No recent data': 'Нет свежих данных',
      'Why Vertex thinks this': 'Почему Vertex так считает', 'The strongest factors that actually changed the model.': 'Самые сильные факторы, которые реально изменили расчёт.',
      'Recent form is stronger for {team}.': 'Текущая форма сильнее у {team}.', 'Recent opponents were stronger for {team}.': 'Последние соперники были сильнее у {team}.',
      'Recovery and schedule density favour {team}.': 'Отдых и плотность календаря дают преимущество {team}.',
      'Verified news and availability favour {team}.': 'Проверенные новости и доступность игроков в пользу {team}.',
      'Weather changes the expected goal environment.': 'Погода меняет ожидаемую результативность матча.',
      'Shot-on-target pressure favours {team}.': 'Давление по ударам в створ в пользу {team}.', 'Recent head-to-head slightly favours {team}.': 'Последние очные встречи немного в пользу {team}.',
      'Model factor': 'Фактор модели', 'Event markets': 'Событийные рынки', 'Historical event data, shown only when a real sample exists.': 'Исторические event-данные показываются только при реальной выборке.',
      'Corners': 'Угловые', 'Yellow cards': 'Жёлтые карточки', 'Shots': 'Удары', 'Shots on target': 'Удары в створ', 'Offsides': 'Офсайды', 'Fouls': 'Фолы',
      'Expected': 'Ожидание', 'Home': 'Хозяева', 'Away': 'Гости', 'Penalty estimate': 'Оценка пенальти',
      'Scored-penalty probability proxy': 'Прокси-вероятность реализованного пенальти',
      'Based on verified scored penalties in this competition. Missed penalties are not included, so this is deliberately conservative.': 'Основано на проверенной истории реализованных пенальти в турнире. Нереализованные пенальти источник не учитывает, поэтому оценка намеренно консервативная.',
      'Penalty model needs more verified history for these teams/competition.': 'Для модели пенальти пока не хватает проверенной истории по этим командам/турниру.',
      'Context and availability': 'Контекст и состав', 'News checked': 'Новости проверены', 'Weather checked': 'Погода проверена', 'Player availability': 'Доступность игроков',
      'Negative team update': 'Негативная новость по команде', 'Positive availability update': 'Позитивная новость по составу',
      'Line-up / availability update': 'Новость о составе / доступности', 'Context update': 'Контекстная новость',
      'Vertex found a relevant negative signal for {team}.': 'Vertex нашёл релевантный негативный сигнал для {team}.',
      'Vertex found a relevant positive availability signal for {team}.': 'Vertex нашёл позитивный сигнал по доступности игроков {team}.',
      'Vertex reviewed a relevant team update for {team}.': 'Vertex учёл релевантную новость по {team}.',
      'Original source headline': 'Оригинальный заголовок источника', 'No strong news signal changed the model.': 'Сильных новостных сигналов, меняющих модель, не найдено.',
      'OUT': 'ВЫБЫЛ', 'DOUBTFUL': 'ПОД ВОПРОСОМ', 'AVAILABLE': 'ДОСТУПЕН', 'suspension': 'дисквалификация', 'injury / availability': 'травма / доступность',
      'Key player': 'Ключевой игрок', 'Top scorer rank': 'Место среди бомбардиров', 'goals': 'голов',
      'Prediction withheld': 'Прогноз не выдан', 'Vertex does not yet have enough verified completed-match history for both teams.': 'Vertex пока не собрал достаточно проверенной истории завершённых матчей по обеим командам.',
      'Completed matches found': 'Найдено завершённых матчей', 'Vertex tried tournament and cross-competition sources before withholding the forecast.': 'Перед отказом от прогноза Vertex проверил турнирные и межтурнирные источники данных.',
      'Technical details': 'Технические данные', 'Additional source limitation.': 'Дополнительное ограничение источника данных.',
      'SAVE ANALYSIS': 'СОХРАНИТЬ АНАЛИЗ', 'COPY SUMMARY': 'КОПИРОВАТЬ СВОДКУ', 'Analysis saved to My Cabinet.': 'Анализ сохранён в личный кабинет.',
      'My Cabinet': 'Личный кабинет', 'Your Vertex workspace': 'Ваше рабочее пространство Vertex', 'Account active': 'Аккаунт активен',
      'Recent analyses': 'Последние анализы', 'Saved matches': 'Сохранённые матчи', 'Strategy': 'Стратегия', 'Activity': 'Активность',
      'ACTIVE': 'АКТИВНА', 'NOT SET': 'НЕ НАСТРОЕНА', 'analyses': 'анализов', 'Overview': 'Обзор', 'Account': 'Аккаунт',
      'No analyses yet. Run Match Analyzer and they will appear here.': 'Анализов пока нет. Запустите «Анализ матча», и они появятся здесь.',
      'No saved matches yet.': 'Сохранённых матчей пока нет.', 'ANALYZE AGAIN': 'АНАЛИЗИРОВАТЬ СНОВА', 'OPEN STRATEGY': 'ОТКРЫТЬ СТРАТЕГИЮ',
      'Language': 'Язык', 'Member since': 'Дата регистрации', 'Email': 'Email', 'LOG OUT': 'ВЫЙТИ', 'BACK TO HOME': 'НА ГЛАВНУЮ',
      'Loading your cabinet…': 'Загружаем личный кабинет…', 'Could not load cloud history; showing local data.': 'Не удалось загрузить облачную историю; показываем локальные данные.',
      'Data from your account is protected by Supabase RLS.': 'Данные аккаунта защищены политиками Supabase RLS.',
      'Fixture details are limited for this run': 'Данные о матче ограничены для этого расчёта', 'Source': 'Источник',
      'No model-changing factor was strong enough to list.': 'Ни один дополнительный фактор не был достаточно сильным, чтобы отдельно изменить модель.'
    },
    es: {
      'Match analysis': 'Análisis del partido', 'What Vertex sees': 'Lo que ve Vertex', 'Most likely outcome': 'Resultado más probable',
      'Safer scenario': 'Escenario más prudente', 'Expected goals': 'Goles esperados', 'Both teams score': 'Ambos marcan',
      'Model decision': 'Decisión del modelo', 'WATCH': 'VIGILAR', 'STRONG WATCH': 'SEÑAL FUERTE', 'PASS': 'PASAR',
      'This is a probability, not a guarantee.': 'Es una probabilidad, no una garantía.',
      'Analysis confidence': 'Confianza del análisis', 'Data quality': 'Calidad de datos',
      'How decisive the model is after uncertainty is considered.': 'Qué tan clara es la señal del modelo después de considerar la incertidumbre.',
      'How complete and reliable the source data is for this exact match.': 'Qué tan completos y fiables son los datos para este partido concreto.',
      'Match probabilities': 'Probabilidades del partido', 'Home win': 'Victoria local', 'Draw': 'Empate', 'Away win': 'Victoria visitante',
      'Vertex currently gives the highest probability to {outcome} ({pct}%).': 'Vertex da ahora la mayor probabilidad a «{outcome}» ({pct}%).',
      'Recent form': 'Forma reciente', 'matches used': 'partidos usados', 'Goals scored / match': 'Goles a favor / partido',
      'Goals conceded / match': 'Goles en contra / partido', 'Points / match': 'Puntos / partido', 'No recent data': 'Sin datos recientes',
      'Why Vertex thinks this': 'Por qué Vertex piensa esto', 'The strongest factors that actually changed the model.': 'Los factores más fuertes que realmente modificaron el cálculo.',
      'Recent form is stronger for {team}.': 'La forma reciente es mejor para {team}.', 'Recent opponents were stronger for {team}.': 'Los rivales recientes fueron más fuertes para {team}.',
      'Recovery and schedule density favour {team}.': 'El descanso y el calendario favorecen a {team}.',
      'Verified news and availability favour {team}.': 'Las noticias verificadas y la disponibilidad favorecen a {team}.',
      'Weather changes the expected goal environment.': 'El clima modifica el entorno esperado de goles.',
      'Shot-on-target pressure favours {team}.': 'La presión de tiros a puerta favorece a {team}.', 'Recent head-to-head slightly favours {team}.': 'Los enfrentamientos recientes favorecen ligeramente a {team}.',
      'Model factor': 'Factor del modelo', 'Event markets': 'Mercados de eventos', 'Historical event data, shown only when a real sample exists.': 'Datos históricos de eventos, mostrados solo cuando existe una muestra real.',
      'Corners': 'Córners', 'Yellow cards': 'Tarjetas amarillas', 'Shots': 'Tiros', 'Shots on target': 'Tiros a puerta', 'Offsides': 'Fueras de juego', 'Fouls': 'Faltas',
      'Expected': 'Esperado', 'Home': 'Local', 'Away': 'Visitante', 'Penalty estimate': 'Estimación de penalti',
      'Scored-penalty probability proxy': 'Proxy de probabilidad de penalti convertido',
      'Based on verified scored penalties in this competition. Missed penalties are not included, so this is deliberately conservative.': 'Se basa en penaltis convertidos verificados en esta competición. Los penaltis fallados no están incluidos, por lo que la estimación es deliberadamente conservadora.',
      'Penalty model needs more verified history for these teams/competition.': 'El modelo de penaltis necesita más historial verificado de estos equipos/competición.',
      'Context and availability': 'Contexto y disponibilidad', 'News checked': 'Noticias revisadas', 'Weather checked': 'Clima revisado', 'Player availability': 'Disponibilidad de jugadores',
      'Negative team update': 'Noticia negativa del equipo', 'Positive availability update': 'Noticia positiva de disponibilidad',
      'Line-up / availability update': 'Actualización de alineación / disponibilidad', 'Context update': 'Actualización de contexto',
      'Vertex found a relevant negative signal for {team}.': 'Vertex encontró una señal negativa relevante para {team}.',
      'Vertex found a relevant positive availability signal for {team}.': 'Vertex encontró una señal positiva de disponibilidad para {team}.',
      'Vertex reviewed a relevant team update for {team}.': 'Vertex revisó una actualización relevante de {team}.',
      'Original source headline': 'Titular original de la fuente', 'No strong news signal changed the model.': 'Ninguna señal fuerte de noticias cambió el modelo.',
      'OUT': 'BAJA', 'DOUBTFUL': 'DUDA', 'AVAILABLE': 'DISPONIBLE', 'suspension': 'suspensión', 'injury / availability': 'lesión / disponibilidad',
      'Key player': 'Jugador clave', 'Top scorer rank': 'Puesto entre goleadores', 'goals': 'goles',
      'Prediction withheld': 'Pronóstico retenido', 'Vertex does not yet have enough verified completed-match history for both teams.': 'Vertex aún no tiene suficiente historial verificado de partidos finalizados para ambos equipos.',
      'Completed matches found': 'Partidos finalizados encontrados', 'Vertex tried tournament and cross-competition sources before withholding the forecast.': 'Antes de retener el pronóstico, Vertex revisó fuentes del torneo y de otras competiciones.',
      'Technical details': 'Detalles técnicos', 'Additional source limitation.': 'Limitación adicional de la fuente.',
      'SAVE ANALYSIS': 'GUARDAR ANÁLISIS', 'COPY SUMMARY': 'COPIAR RESUMEN', 'Analysis saved to My Cabinet.': 'Análisis guardado en Mi panel.',
      'My Cabinet': 'Mi panel', 'Your Vertex workspace': 'Tu espacio de trabajo Vertex', 'Account active': 'Cuenta activa',
      'Recent analyses': 'Análisis recientes', 'Saved matches': 'Partidos guardados', 'Strategy': 'Estrategia', 'Activity': 'Actividad',
      'ACTIVE': 'ACTIVA', 'NOT SET': 'NO CONFIGURADA', 'analyses': 'análisis', 'Overview': 'Resumen', 'Account': 'Cuenta',
      'No analyses yet. Run Match Analyzer and they will appear here.': 'Aún no hay análisis. Ejecuta el Analizador y aparecerán aquí.',
      'No saved matches yet.': 'Aún no hay partidos guardados.', 'ANALYZE AGAIN': 'ANALIZAR DE NUEVO', 'OPEN STRATEGY': 'ABRIR ESTRATEGIA',
      'Language': 'Idioma', 'Member since': 'Miembro desde', 'Email': 'Email', 'LOG OUT': 'CERRAR SESIÓN', 'BACK TO HOME': 'VOLVER AL INICIO',
      'Loading your cabinet…': 'Cargando tu panel…', 'Could not load cloud history; showing local data.': 'No se pudo cargar el historial en la nube; mostramos los datos locales.',
      'Data from your account is protected by Supabase RLS.': 'Los datos de tu cuenta están protegidos por Supabase RLS.',
      'Fixture details are limited for this run': 'Los detalles del partido son limitados en este cálculo', 'Source': 'Fuente',
      'No model-changing factor was strong enough to list.': 'Ningún factor adicional fue lo bastante fuerte como para cambiar el modelo por sí solo.'
    }
  };

  function tx(key, vars = {}) {
    let value = lang() === 'en' ? key : (dict[lang()]?.[key] || window.VertexI18n?.t?.(key) || key);
    Object.entries(vars).forEach(([name, item]) => { value = value.replaceAll(`{${name}}`, String(item)); });
    return value;
  }

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

  function localCountry(value) {
    const names = {
      ru: { Spain: 'Испания', England: 'Англия', Italy: 'Италия', Germany: 'Германия', France: 'Франция', Portugal: 'Португалия', Netherlands: 'Нидерланды', Brazil: 'Бразилия' },
      es: { Spain: 'España', England: 'Inglaterra', Italy: 'Italia', Germany: 'Alemania', France: 'Francia', Portugal: 'Portugal', Netherlands: 'Países Bajos', Brazil: 'Brasil' }
    };
    return names[lang()]?.[value] || value || '';
  }

  function getDb() {
    if (db) return db;
    if (!window.supabase?.createClient) return null;
    try {
      db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false } });
      return db;
    } catch (_) { return null; }
  }

  function outcomeLabel(raw) {
    if (raw === 'Home win') return tx('Home win');
    if (raw === 'Away win') return tx('Away win');
    if (raw === 'Draw') return tx('Draw');
    return raw || '—';
  }

  function bestDoubleChance(dc = {}) {
    return [['1X', Number(dc.oneX)], ['X2', Number(dc.xTwo)], ['12', Number(dc.oneTwo)]]
      .filter(([, value]) => Number.isFinite(value)).sort((a, b) => b[1] - a[1])[0] || ['—', null];
  }

  function formPills(stats = {}) {
    const rows = Array.isArray(stats.sequence) ? stats.sequence.slice(0, 8) : [];
    if (!rows.length) return `<span class="v6-event-note">${esc(tx('No recent data'))}</span>`;
    return rows.map((result) => `<span class="v6-pill ${esc(String(result).toLowerCase())}">${esc(result)}</span>`).join('');
  }

  function formCard(team, stats = {}) {
    return `<div class="v6-form-card">
      <div class="v6-form-title"><strong>${esc(team)}</strong><span>${Number(stats.played || 0)} ${esc(tx('matches used'))}</span></div>
      <div class="v6-form-pills">${formPills(stats)}</div>
      <div class="v6-form-metrics">
        <div><span>${esc(tx('Goals scored / match'))}</span><strong>${Number.isFinite(Number(stats.avgFor)) ? Number(stats.avgFor).toFixed(2) : '—'}</strong></div>
        <div><span>${esc(tx('Goals conceded / match'))}</span><strong>${Number.isFinite(Number(stats.avgAgainst)) ? Number(stats.avgAgainst).toFixed(2) : '—'}</strong></div>
        <div><span>${esc(tx('Points / match'))}</span><strong>${Number.isFinite(Number(stats.ppg)) ? Number(stats.ppg).toFixed(2) : '—'}</strong></div>
      </div>
    </div>`;
  }

  function sideTeam(side, home, away) {
    if (side === 'home') return home;
    if (side === 'away') return away;
    return `${home} / ${away}`;
  }

  function driverText(driver, home, away) {
    const team = sideTeam(driver.side, home, away);
    const map = {
      form: ['◒', 'Recent form is stronger for {team}.'],
      'schedule-strength': ['◆', 'Recent opponents were stronger for {team}.'],
      'home-fatigue': ['⌛', 'Recovery and schedule density favour {team}.'],
      'away-fatigue': ['⌛', 'Recovery and schedule density favour {team}.'],
      'news-home': ['✚', 'Verified news and availability favour {team}.'],
      'news-away': ['✚', 'Verified news and availability favour {team}.'],
      weather: ['☁', 'Weather changes the expected goal environment.'],
      'shot-pressure': ['◎', 'Shot-on-target pressure favours {team}.'],
      h2h: ['↔', 'Recent head-to-head slightly favours {team}.']
    };
    const row = map[driver.key] || ['•', 'Model factor'];
    return { icon: row[0], text: tx(row[1], { team }) };
  }

  function renderDrivers(analysis, home, away) {
    const rows = Array.isArray(analysis?.vertexModel?.drivers) ? analysis.vertexModel.drivers.slice(0, 5) : [];
    if (!rows.length) return `<div class="v6-cabinet-empty">${esc(tx('No model-changing factor was strong enough to list.'))}</div>`;
    return `<div class="v6-driver-list">${rows.map((driver) => {
      const info = driverText(driver, home, away);
      return `<div class="v6-driver"><span class="v6-driver-icon">${esc(info.icon)}</span><div><strong>${esc(info.text)}</strong><small>${esc(driver.source || 'Vertex')}</small></div><b>${Number(driver.magnitudePct || 0)}%</b></div>`;
    }).join('')}</div>`;
  }

  function eventLines(rows) {
    return `<div class="v6-lines">${rows.map(([label, value]) => `<div class="v6-line"><span>${esc(label)}</span><strong>${Number.isFinite(Number(value)) ? `${Math.round(Number(value))}%` : '—'}</strong></div>`).join('')}</div>`;
  }

  function eventCard(label, metric, rows = []) {
    if (!metric) return '';
    return `<div class="v6-event-card"><div class="v6-event-top"><span>${esc(label)}</span><strong>${esc(tx('Expected'))} ${Number.isFinite(Number(metric.expectedTotal)) ? Number(metric.expectedTotal).toFixed(1) : '—'}</strong></div><div class="v6-event-split"><span>${esc(tx('Home'))}: <b>${Number.isFinite(Number(metric.expectedHome)) ? Number(metric.expectedHome).toFixed(1) : '—'}</b></span><span>${esc(tx('Away'))}: <b>${Number.isFinite(Number(metric.expectedAway)) ? Number(metric.expectedAway).toFixed(1) : '—'}</b></span></div>${rows.length ? eventLines(rows) : ''}</div>`;
  }

  function renderEvents(analysis) {
    const g = analysis?.granularModel;
    const p = analysis?.penaltyModel;
    const cards = [];
    if (g?.ok) {
      cards.push(eventCard(tx('Corners'), g.corners, [['O7.5', g.corners?.over75], ['O8.5', g.corners?.over85], ['O9.5', g.corners?.over95]]));
      cards.push(eventCard(tx('Yellow cards'), g.cards, [['O3.5', g.cards?.over35], ['O4.5', g.cards?.over45], ['O5.5', g.cards?.over55]]));
      cards.push(eventCard(tx('Shots'), g.shots, [['O21.5', g.shots?.over215], ['O23.5', g.shots?.over235], ['O25.5', g.shots?.over255]]));
      cards.push(eventCard(tx('Shots on target'), g.shotsOnTarget, [['O6.5', g.shotsOnTarget?.over65], ['O7.5', g.shotsOnTarget?.over75], ['O8.5', g.shotsOnTarget?.over85]]));
      cards.push(eventCard(tx('Offsides'), g.offsides, [['O2.5', g.offsides?.over25], ['O3.5', g.offsides?.over35], ['O4.5', g.offsides?.over45]]));
      cards.push(eventCard(tx('Fouls'), g.fouls));
    }
    if (p?.ok) {
      cards.push(`<div class="v6-event-card v6-penalty-card"><div class="v6-event-top"><span>${esc(tx('Penalty estimate'))}</span><strong>${Number(p.probabilityPct || 0)}%</strong></div><div class="v6-event-split"><span>${esc(tx('Home'))}: <b>${Number(p.homeProbabilityPct || 0)}%</b></span><span>${esc(tx('Away'))}: <b>${Number(p.awayProbabilityPct || 0)}%</b></span></div><p class="v6-event-note"><strong>${esc(tx('Scored-penalty probability proxy'))}.</strong> ${esc(tx('Based on verified scored penalties in this competition. Missed penalties are not included, so this is deliberately conservative.'))}</p></div>`);
    } else {
      cards.push(`<div class="v6-event-card v6-penalty-card"><div class="v6-event-top"><span>${esc(tx('Penalty estimate'))}</span><strong>—</strong></div><p class="v6-event-note">${esc(tx('Penalty model needs more verified history for these teams/competition.'))}</p></div>`);
    }
    if (!cards.filter(Boolean).length) return '';
    return `<section class="v6-section"><div class="v6-section-head"><div><span class="v6-section-kicker">${esc(tx('Event markets'))}</span><h4>${esc(tx('Corners'))} · ${esc(tx('Yellow cards'))} · ${esc(tx('Shots'))} · ${esc(tx('Penalty estimate'))}</h4></div><p>${esc(tx('Historical event data, shown only when a real sample exists.'))}</p></div><div class="v6-event-grid">${cards.filter(Boolean).join('')}</div></section>`;
  }

  function newsSignalText(item, team) {
    const signal = String(item?.signal || 'context');
    if (signal === 'negative') return { title: tx('Negative team update'), body: tx('Vertex found a relevant negative signal for {team}.', { team }) };
    if (signal === 'positive') return { title: tx('Positive availability update'), body: tx('Vertex found a relevant positive availability signal for {team}.', { team }) };
    if (signal === 'lineup') return { title: tx('Line-up / availability update'), body: tx('Vertex reviewed a relevant team update for {team}.', { team }) };
    return { title: tx('Context update'), body: tx('Vertex reviewed a relevant team update for {team}.', { team }) };
  }

  function renderNewsCards(analysis) {
    const rows = Array.isArray(analysis?.news) ? analysis.news.slice(0, 3) : [];
    if (!rows.length) return `<div class="v6-context-card"><span>${esc(tx('News checked'))}</span><strong>${esc(tx('No strong news signal changed the model.'))}</strong></div>`;
    return rows.map((item) => {
      const sides = Array.isArray(item.teams) ? item.teams : [];
      const team = sides[0] === 'away' ? analysis.teams?.away?.name : analysis.teams?.home?.name;
      const info = newsSignalText(item, team || 'team');
      return `<div class="v6-context-card"><span>${esc(info.title)}</span><strong>${esc(info.body)}</strong><p>${esc(item.source || tx('News checked'))}${item.publishedAt ? ` · ${esc(fmtDate(item.publishedAt))}` : ''}</p>${item.title ? `<details><summary>${esc(tx('Original source headline'))}</summary><p>${esc(item.title)}</p></details>` : ''}</div>`;
    }).join('');
  }

  function renderAvailability(analysis) {
    const squad = analysis?.squad;
    const rows = [];
    for (const side of ['home', 'away']) {
      const team = side === 'home' ? analysis.teams?.home?.name : analysis.teams?.away?.name;
      for (const signal of (squad?.[side]?.signals || []).slice(0, 2)) {
        const stateKey = String(signal.state || '').toUpperCase();
        const state = tx(stateKey || 'DOUBTFUL');
        const reason = signal.suspension ? tx('suspension') : tx('injury / availability');
        const player = signal.player || tx('Key player');
        const extra = [Number.isFinite(Number(signal.goals)) ? `${signal.goals} ${tx('goals')}` : null, signal.rank ? `${tx('Top scorer rank')}: #${signal.rank}` : null].filter(Boolean).join(' · ');
        rows.push(`<div class="v6-context-card"><span>${esc(tx('Player availability'))}</span><strong>${esc(team)} · ${esc(player)} · ${esc(state)}</strong><p>${esc(reason)}${extra ? ` · ${esc(extra)}` : ''}</p></div>`);
      }
    }
    return rows.join('');
  }

  function localizeLimitation(value) {
    const text = String(value || '');
    if (lang() === 'en') return text;
    let m = text.match(/Recent-form sample is limited \((\d+)\s*\/\s*(\d+)/i);
    if (m) return lang() === 'ru' ? `Ограниченная выборка формы: ${m[1]} / ${m[2]} завершённых матчей.` : `Muestra de forma limitada: ${m[1]} / ${m[2]} partidos finalizados.`;
    if (/at least three verified completed matches/i.test(text)) return lang() === 'ru' ? 'Для расчёта нужны минимум три проверенных завершённых матча каждой команды.' : 'Se necesitan al menos tres partidos finalizados verificados de cada equipo.';
    if (/structured injury|confirmed-lineup/i.test(text)) return lang() === 'ru' ? 'Структурированный feed травм/подтверждённых составов доступен не для всех матчей; проверенные новости всё равно учитываются.' : 'El feed estructurado de lesiones/alineaciones no está disponible para todos los partidos; las noticias verificadas sí se consideran.';
    if (/no sufficiently relevant recent news/i.test(text)) return lang() === 'ru' ? 'Релевантных свежих новостей для изменения модели не найдено.' : 'No se encontraron noticias recientes suficientemente relevantes para modificar el modelo.';
    if (/weather was checked/i.test(text)) return lang() === 'ru' ? 'Погода проверена, но не была достаточно экстремальной, чтобы изменить расчёт.' : 'El clima fue revisado, pero no fue lo bastante extremo para modificar el cálculo.';
    return tx('Additional source limitation.');
  }

  function renderModel(analysis, home, away) {
    const model = analysis?.model;
    const homeName = home.name || tx('Home');
    const awayName = away.name || tx('Away');
    if (!model) {
      const hp = Number(analysis?.form?.home?.played || 0);
      const ap = Number(analysis?.form?.away?.played || 0);
      return `<div class="v6-withheld"><strong>${esc(tx('Prediction withheld'))}</strong><p>${esc(tx('Vertex does not yet have enough verified completed-match history for both teams.'))}</p><div class="v6-withheld-grid"><div>${esc(homeName)}<br><strong>${hp}</strong> ${esc(tx('Completed matches found'))}</div><div>${esc(awayName)}<br><strong>${ap}</strong> ${esc(tx('Completed matches found'))}</div></div><p>${esc(tx('Vertex tried tournament and cross-competition sources before withholding the forecast.'))}</p></div>`;
    }

    const rows = [
      { key: 'home', label: tx('Home win'), value: clamp(model.oneXtwo?.home, 0, 100) },
      { key: 'draw', label: tx('Draw'), value: clamp(model.oneXtwo?.draw, 0, 100) },
      { key: 'away', label: tx('Away win'), value: clamp(model.oneXtwo?.away, 0, 100) }
    ];
    const best = [...rows].sort((a, b) => b.value - a.value)[0];
    const [dc, dcValue] = bestDoubleChance(model.doubleChance || {});
    const decisionRaw = analysis?.vertexModel?.decision?.action || 'PASS';
    const decision = tx(decisionRaw);
    const confidence = analysis.confidence == null ? null : clamp(analysis.confidence, 0, 100);
    const quality = clamp(analysis.dataQuality, 0, 100);
    const totalXg = Number(model.expectedGoals?.total ?? (Number(model.expectedGoals?.home || 0) + Number(model.expectedGoals?.away || 0)));

    return `<section class="v6-summary"><span class="v6-summary-kicker">${esc(tx('What Vertex sees'))}</span><h3>${esc(outcomeLabel(model.mainScenario))} · ${Math.round(best.value)}%</h3><p>${esc(tx('Vertex currently gives the highest probability to {outcome} ({pct}%).', { outcome: outcomeLabel(model.mainScenario), pct: Math.round(best.value) }))} ${esc(tx('This is a probability, not a guarantee.'))}</p><div class="v6-summary-grid">
      <div class="v6-summary-stat"><span>${esc(tx('Most likely outcome'))}</span><strong>${esc(outcomeLabel(model.mainScenario))}</strong><small>${Math.round(best.value)}%</small></div>
      <div class="v6-summary-stat"><span>${esc(tx('Safer scenario'))}</span><strong>${esc(dc)} · ${dcValue == null ? '—' : `${Math.round(dcValue)}%`}</strong><small>${esc(dc === '1X' ? `${homeName} / ${tx('Draw')}` : dc === 'X2' ? `${tx('Draw')} / ${awayName}` : `${homeName} / ${awayName}`)}</small></div>
      <div class="v6-summary-stat"><span>${esc(tx('Expected goals'))}</span><strong>${model.expectedGoals?.home ?? '—'} : ${model.expectedGoals?.away ?? '—'}</strong><small>${Number.isFinite(totalXg) ? `Σ ${totalXg.toFixed(2)}` : ''}</small></div>
      <div class="v6-summary-stat"><span>${esc(tx('Model decision'))}</span><strong>${esc(decision)}</strong><small>${esc(tx('This is a probability, not a guarantee.'))}</small></div>
    </div></section>
    <div class="v6-quality-row"><div class="v6-quality-card"><div class="v6-quality-head"><span>${esc(tx('Analysis confidence'))}</span><strong>${confidence ?? '—'}%</strong></div><div class="v6-track"><i style="width:${confidence ?? 0}%"></i></div><p>${esc(tx('How decisive the model is after uncertainty is considered.'))}</p></div><div class="v6-quality-card"><div class="v6-quality-head"><span>${esc(tx('Data quality'))}</span><strong>${quality}%</strong></div><div class="v6-track"><i style="width:${quality}%"></i></div><p>${esc(tx('How complete and reliable the source data is for this exact match.'))}</p></div></div>
    <section class="v6-section"><div class="v6-section-head"><div><span class="v6-section-kicker">1X2</span><h4>${esc(tx('Match probabilities'))}</h4></div></div><div class="v6-prob-grid">${rows.map((row) => `<div class="v6-prob ${row.key === best.key ? 'best' : ''}"><span>${esc(row.label)}</span><strong>${Math.round(row.value)}%</strong></div>`).join('')}</div><p class="v6-prob-explain">${esc(tx('Vertex currently gives the highest probability to {outcome} ({pct}%).', { outcome: best.label, pct: Math.round(best.value) }))}</p></section>`;
  }

  function renderAnalysis(analysis) {
    const home = analysis?.teams?.home || {};
    const away = analysis?.teams?.away || {};
    const fixture = analysis?.fixture || {};
    const homeName = home.name || tx('Home');
    const awayName = away.name || tx('Away');
    const fixtureMeta = [fixture.league, fmtDate(fixture.date), fixture.venue, fixture.city].filter(Boolean).join(' · ');
    const modelPart = renderModel(analysis, home, away);
    const availability = renderAvailability(analysis);
    const limitations = Array.isArray(analysis?.limitations) ? analysis.limitations : [];
    const sourceRows = Object.entries(analysis?.sourceStatus || {}).slice(0, 12);
    const homeBadge = safeUrl(home.badge);
    const awayBadge = safeUrl(away.badge);

    return `<div class="analysis-card v6-analysis-card">
      <div class="v6-match-head"><div class="v6-team">${homeBadge ? `<img src="${homeBadge}" alt="">` : ''}<strong>${esc(homeName)}</strong><small>${esc(localCountry(home.country))}</small></div><div class="v6-vs">VS</div><div class="v6-team">${awayBadge ? `<img src="${awayBadge}" alt="">` : ''}<strong>${esc(awayName)}</strong><small>${esc(localCountry(away.country))}</small></div></div>
      <div class="v6-fixture-meta">${esc(fixtureMeta || tx('Fixture details are limited for this run'))}</div>
      ${modelPart}
      <section class="v6-section"><div class="v6-section-head"><div><span class="v6-section-kicker">${esc(tx('Recent form'))}</span><h4>${esc(homeName)} · ${esc(awayName)}</h4></div></div><div class="v6-form-grid">${formCard(homeName, analysis?.form?.home || {})}${formCard(awayName, analysis?.form?.away || {})}</div></section>
      ${analysis?.model ? `<section class="v6-section"><div class="v6-section-head"><div><span class="v6-section-kicker">VERTEX MODEL 2.0</span><h4>${esc(tx('Why Vertex thinks this'))}</h4></div><p>${esc(tx('The strongest factors that actually changed the model.'))}</p></div>${renderDrivers(analysis, homeName, awayName)}</section>` : ''}
      ${renderEvents(analysis)}
      <section class="v6-section"><div class="v6-section-head"><div><span class="v6-section-kicker">${esc(tx('Context and availability'))}</span><h4>${esc(tx('News checked'))} · ${esc(tx('Player availability'))}</h4></div></div><div class="v6-context-grid">${availability}${renderNewsCards(analysis)}</div></section>
      <details class="v6-tech"><summary>${esc(tx('Technical details'))}</summary><div class="v6-tech-body">${sourceRows.length ? `<p><strong>${esc(tx('Source'))}:</strong> ${sourceRows.map(([k,v]) => `${esc(k)}: ${esc(v)}`).join(' · ')}</p>` : ''}${limitations.length ? `<ul>${limitations.map((item) => `<li>${esc(localizeLimitation(item))}</li>`).join('')}</ul>` : ''}</div></details>
      <div class="v6-actions"><button class="btn-secondary" data-action="save-analysis" type="button">${esc(tx('SAVE ANALYSIS'))}</button><button class="btn-secondary" data-action="copy-analysis" type="button">${esc(tx('COPY SUMMARY'))}</button></div>
    </div>`;
  }

  function scheduleRender(force = false) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      const target = document.getElementById('analysisResult');
      if (!target || !lastAnalysis) return;
      const key = `${lastAnalysis.generatedAt || `${lastAnalysis.teams?.home?.name}-${lastAnalysis.teams?.away?.name}`}-${lang()}`;
      if (!force && target.dataset.vertexV6Key === key && target.querySelector('.v6-analysis-card')) return;
      target.innerHTML = renderAnalysis(lastAnalysis);
      target.dataset.vertexV6Key = key;
    }, 90);
  }

  function readLocal(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; }
  }

  function matchNameFromRow(row) {
    return row.match || [row.home_team, row.away_team].filter(Boolean).join(' vs ');
  }

  async function session() {
    const client = getDb();
    if (!client) return null;
    try { return (await client.auth.getSession()).data?.session || null; } catch (_) { return null; }
  }

  async function persistAnalysis(analysis) {
    const client = getDb();
    const s = await session();
    if (!client || !s?.user || !analysis?.teams?.home?.name || !analysis?.teams?.away?.name) return;
    try {
      await client.from('analysis_history').insert([{
        user_id: s.user.id,
        home_team: analysis.teams.home.name,
        away_team: analysis.teams.away.name,
        fixture_date: analysis.fixture?.date || null,
        main_scenario: analysis.model?.mainScenario || null,
        confidence: analysis.confidence == null ? null : Math.round(Number(analysis.confidence)),
        data_quality: analysis.dataQuality == null ? null : Math.round(Number(analysis.dataQuality)),
        analysis_payload: analysis
      }]);
    } catch (error) { console.warn('[Vertex UX6] history', error?.message || error); }
  }

  async function persistSavedMatch() {
    if (!lastAnalysis) return;
    const client = getDb(); const s = await session();
    if (!client || !s?.user) return;
    try {
      await client.from('saved_matches').upsert([{
        user_id: s.user.id,
        home_team: lastAnalysis.teams?.home?.name || 'Home',
        away_team: lastAnalysis.teams?.away?.name || 'Away',
        fixture_date: lastAnalysis.fixture?.date || null
      }], { onConflict: 'user_id,home_team,away_team,fixture_date' });
      setTimeout(() => {
        const toast = document.getElementById('toast');
        if (toast) toast.textContent = tx('Analysis saved to My Cabinet.');
      }, 20);
    } catch (error) { console.warn('[Vertex UX6] save', error?.message || error); }
  }

  async function persistStrategy() {
    const profile = readLocal('vertex_strategy_profile', null);
    const client = getDb(); const s = await session();
    if (!profile || !client || !s?.user) return;
    try {
      await client.from('strategy_profiles').upsert([{
        user_id: s.user.id,
        bankroll_reference: Number(profile.bankroll || 0) || null,
        experience: profile.experience || null,
        risk_profile: profile.risk || null,
        objective: profile.objective || null,
        leagues: profile.leagues || [],
        markets: profile.markets || [],
        updated_at: new Date().toISOString()
      }], { onConflict: 'user_id' });
    } catch (error) { console.warn('[Vertex UX6] strategy', error?.message || error); }
  }

  function ensureCabinetSection() {
    let section = document.getElementById('tab-cabinet');
    if (section) return section;
    section = document.createElement('section');
    section.id = 'tab-cabinet';
    section.className = 'tab-content';
    section.innerHTML = `<div class="v6-cabinet"><div class="v6-cabinet-loading">${esc(tx('Loading your cabinet…'))}</div></div>`;
    document.querySelector('main.main-content')?.appendChild(section);
    return section;
  }

  function mergeLocalAndCloud(cloud, local, limit = 20) {
    const out = []; const seen = new Set();
    [...(cloud || []), ...(local || [])].forEach((row) => {
      const name = matchNameFromRow(row);
      const key = `${name}:${row.fixture_date || row.date || row.savedAt || row.created_at || ''}`;
      if (!name || seen.has(key)) return;
      seen.add(key); out.push(row);
    });
    return out.slice(0, limit);
  }

  function analysisRows(rows, emptyText) {
    if (!rows.length) return `<div class="v6-cabinet-empty">${esc(emptyText)}</div>`;
    return `<div class="v6-cabinet-list">${rows.slice(0, 10).map((row) => {
      const name = matchNameFromRow(row);
      const date = row.created_at || row.date || row.savedAt || row.fixture_date;
      const meta = [date ? fmtDate(date) : null, row.confidence != null ? `${tx('Analysis confidence')} ${row.confidence}%` : null, row.data_quality != null ? `${tx('Data quality')} ${row.data_quality}%` : row.dataQuality != null ? `${tx('Data quality')} ${row.dataQuality}%` : null].filter(Boolean).join(' · ');
      return `<div class="v6-cabinet-row"><div><strong>${esc(name)}</strong><small>${esc(meta)}</small></div><button type="button" data-v6-analyze="${esc(name)}">${esc(tx('ANALYZE AGAIN'))}</button></div>`;
    }).join('')}</div>`;
  }

  async function openCabinet() {
    const section = ensureCabinetSection();
    document.querySelectorAll('.tab-content').forEach((node) => node.classList.remove('active'));
    document.querySelectorAll('.nav a[data-tab]').forEach((node) => node.classList.remove('active'));
    section.classList.add('active');
    cabinetOpen = true;
    if (history.replaceState) history.replaceState(null, '', '#/cabinet');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    section.innerHTML = `<div class="v6-cabinet"><div class="v6-cabinet-loading">${esc(tx('Loading your cabinet…'))}</div></div>`;

    const s = await session();
    if (!s?.user) {
      cabinetOpen = false;
      document.getElementById('btnLogin')?.click();
      return;
    }

    const client = getDb();
    let cloudHistory = [], cloudSaved = [], strategy = null, analysesCount = null, cloudError = false;
    if (client) {
      try {
        const [historyRes, savedRes, strategyRes, activityRes] = await Promise.all([
          client.from('analysis_history').select('id,home_team,away_team,fixture_date,main_scenario,confidence,data_quality,created_at').eq('user_id', s.user.id).order('created_at', { ascending: false }).limit(20),
          client.from('saved_matches').select('id,home_team,away_team,fixture_date,created_at,note').eq('user_id', s.user.id).order('created_at', { ascending: false }).limit(20),
          client.from('strategy_profiles').select('*').eq('user_id', s.user.id).maybeSingle(),
          client.from('activity').select('analyses_count').eq('user_id', s.user.id).maybeSingle()
        ]);
        if (historyRes.error) throw historyRes.error;
        cloudHistory = historyRes.data || [];
        cloudSaved = savedRes.data || [];
        strategy = strategyRes.data || null;
        analysesCount = activityRes.data?.analyses_count ?? null;
      } catch (error) { cloudError = true; console.warn('[Vertex UX6] cabinet', error?.message || error); }
    }

    const localHistory = readLocal('vertex_recent_analyses', []);
    const localSaved = readLocal('vertex_saved_analyses', []);
    const localStrategy = readLocal('vertex_strategy_profile', null);
    const recent = mergeLocalAndCloud(cloudHistory, localHistory);
    const saved = mergeLocalAndCloud(cloudSaved, localSaved);
    const strategyActive = Boolean(strategy || localStrategy);
    const joined = s.user.created_at ? fmtDate(s.user.created_at) : '—';
    const totalActivity = analysesCount == null ? recent.length : Number(analysesCount || 0);

    section.innerHTML = `<div class="v6-cabinet">
      <div class="v6-cabinet-hero"><div><span class="v6-section-kicker">VERTEX ACCOUNT</span><h2>${esc(tx('My Cabinet'))}</h2><p>${esc(tx('Your Vertex workspace'))}</p></div><div class="v6-account-badge">● ${esc(tx('Account active'))}</div></div>
      ${cloudError ? `<div class="v6-cabinet-empty" style="margin-bottom:14px">${esc(tx('Could not load cloud history; showing local data.'))}</div>` : ''}
      <div class="v6-cabinet-stats"><div class="v6-cabinet-stat"><span>${esc(tx('Recent analyses'))}</span><strong>${recent.length}</strong></div><div class="v6-cabinet-stat"><span>${esc(tx('Saved matches'))}</span><strong>${saved.length}</strong></div><div class="v6-cabinet-stat"><span>${esc(tx('Strategy'))}</span><strong>${esc(strategyActive ? tx('ACTIVE') : tx('NOT SET'))}</strong></div><div class="v6-cabinet-stat"><span>${esc(tx('Activity'))}</span><strong>${totalActivity}</strong></div></div>
      <div class="v6-cabinet-layout"><div><section class="v6-cabinet-panel"><span class="v6-section-kicker">${esc(tx('Overview'))}</span><h3>${esc(tx('Recent analyses'))}</h3>${analysisRows(recent, tx('No analyses yet. Run Match Analyzer and they will appear here.'))}</section><section class="v6-cabinet-panel"><span class="v6-section-kicker">${esc(tx('Saved matches'))}</span><h3>${esc(tx('Saved matches'))}</h3>${analysisRows(saved, tx('No saved matches yet.'))}</section></div><aside><section class="v6-cabinet-panel"><span class="v6-section-kicker">${esc(tx('Account'))}</span><h3>${esc(tx('Account'))}</h3><div class="v6-setting-grid"><div class="v6-setting"><span>${esc(tx('Email'))}</span><strong>${esc(s.user.email || '—')}</strong></div><div class="v6-setting"><span>${esc(tx('Member since'))}</span><strong>${esc(joined)}</strong></div><div class="v6-setting"><span>${esc(tx('Language'))}</span><strong>${esc(lang().toUpperCase())}</strong></div><div class="v6-setting"><span>${esc(tx('Strategy'))}</span><strong>${esc(strategyActive ? tx('ACTIVE') : tx('NOT SET'))}</strong></div></div><p class="v6-event-note">${esc(tx('Data from your account is protected by Supabase RLS.'))}</p><div class="v6-cabinet-actions"><button class="btn-primary" type="button" data-v6-strategy>${esc(tx('OPEN STRATEGY'))}</button><button class="btn-secondary" type="button" data-v6-home>${esc(tx('BACK TO HOME'))}</button><button class="btn-secondary" type="button" data-v6-logout>${esc(tx('LOG OUT'))}</button></div></section></aside></div>
    </div>`;
  }

  function installLanguageButtons() {
    const wrap = document.getElementById('vertexLanguage');
    if (!wrap || wrap.classList.contains('v6-language-switcher')) return;
    wrap.classList.add('v6-language-switcher');
    ['en','ru','es'].forEach((code) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `v6-lang-btn ${lang() === code ? 'active' : ''}`;
      button.dataset.v6Lang = code;
      button.textContent = code.toUpperCase();
      wrap.appendChild(button);
    });
  }

  function refreshLanguageButtons() {
    document.querySelectorAll('[data-v6-lang]').forEach((button) => button.classList.toggle('active', button.dataset.v6Lang === lang()));
  }

  function analyzeAgain(match) {
    const parsed = String(match || '').split(/\s+vs\s+/i);
    if (parsed.length !== 2) return;
    const input = document.getElementById('analyzerSearch');
    if (input) input.value = `${parsed[0]} vs ${parsed[1]}`;
    document.querySelector('.nav a[data-tab="analyzer"]')?.click();
    setTimeout(() => document.getElementById('btnAnalyzeMatch')?.click(), 80);
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const input = args[0];
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/api/analyze') && response.ok) {
        response.clone().json().then((payload) => {
          if (!payload?.analysis) return;
          lastAnalysis = payload.analysis;
          scheduleRender(true);
          persistAnalysis(payload.analysis);
        }).catch(() => {});
      }
    } catch (_) {}
    return response;
  };

  document.addEventListener('click', (event) => {
    const cabinet = event.target.closest('#btnCabinet');
    if (cabinet) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openCabinet();
      return;
    }
    const langButton = event.target.closest('[data-v6-lang]');
    if (langButton) {
      window.VertexI18n?.setLanguage?.(langButton.dataset.v6Lang);
      return;
    }
    const again = event.target.closest('[data-v6-analyze]');
    if (again) { analyzeAgain(again.dataset.v6Analyze); return; }
    if (event.target.closest('[data-v6-strategy]')) { cabinetOpen = false; document.querySelector('.nav a[data-tab="strategy"]')?.click(); return; }
    if (event.target.closest('[data-v6-home]')) { cabinetOpen = false; document.querySelector('.nav a[data-tab="home"]')?.click(); return; }
    if (event.target.closest('[data-v6-logout]')) {
      getDb()?.auth.signOut().finally(() => { cabinetOpen = false; window.location.hash = '#/'; window.location.reload(); });
      return;
    }
    if (event.target.closest('[data-action="save-analysis"]')) setTimeout(persistSavedMatch, 0);
  }, true);

  document.addEventListener('submit', (event) => {
    if (event.target?.id === 'strategyForm') setTimeout(persistStrategy, 50);
  });

  document.addEventListener('vertex:languagechange', () => {
    refreshLanguageButtons();
    if (lastAnalysis) scheduleRender(true);
    if (cabinetOpen) openCabinet();
  });

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { installLanguageButtons(); refreshLanguageButtons(); ensureCabinetSection(); }, 0);
    const target = document.getElementById('analysisResult');
    if (target) new MutationObserver(() => {
      if (lastAnalysis && !target.querySelector('.v6-analysis-card')) scheduleRender();
    }).observe(target, { childList: true, subtree: false });

    document.getElementById('homeOpenAnalyzer')?.addEventListener('click', () => document.querySelector('.nav a[data-tab="analyzer"]')?.click());
    document.getElementById('homeOpenStrategy')?.addEventListener('click', () => document.querySelector('.nav a[data-tab="strategy"]')?.click());
  });
})();
