'use strict';

(() => {
  if (window.__vertexPolishV7) return;
  window.__vertexPolishV7 = true;

  function ensureStylesheet(href) {
    if (document.querySelector('link[href^="polish-v7.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
  ensureStylesheet('polish-v7.css?v=7');

  const language = () => window.VertexI18n?.getLanguage?.() || localStorage.getItem('vertex_language') || 'en';

  const homeCopy = {
    en: {
      slogan: 'Where AI Meets Football',
      stats: [
        ['DATA', 'Multiple verified sources'],
        ['CONTEXT', 'News + weather'],
        ['QUALITY', 'Transparent confidence'],
        ['BETA', 'Free access']
      ],
      cards: [
        ['MATCH ANALYSIS', 'Probabilities built from real match data', 'Vertex compares recent form, scoring rates, opponent strength and fixture context, then explains which factors actually changed the calculation.'],
        ['MATCH CONTEXT', 'News, availability and weather are real model inputs', 'Only relevant verified signals are allowed into the model. Their influence is capped so one headline or one condition cannot distort the whole forecast.'],
        ['PERSONAL STRATEGY', 'Sometimes the correct decision is to pass', 'Vertex does not force a pick on every match. Weak data, conflicting signals or an unsupported market can correctly lead to a PASS decision.']
      ],
      stripLabel: 'VERTEX CHECKS',
      strip: ['Recent form', 'Goals', 'Schedule', 'Opponent strength', 'Squad', 'News', 'Weather', 'Data quality'],
      trust: 'No invented accuracy and no made-up statistics. A market appears only when the connected sources provide enough real data.'
    },
    ru: {
      slogan: 'Где ИИ встречается с футболом',
      stats: [
        ['ДАННЫЕ', 'Несколько проверенных источников'],
        ['КОНТЕКСТ', 'Новости + погода'],
        ['КАЧЕСТВО', 'Понятная достоверность'],
        ['БЕТА', 'Бесплатный доступ']
      ],
      cards: [
        ['АНАЛИЗ МАТЧА', 'Вероятности на основе реальных данных', 'Vertex сравнивает текущую форму, результативность, силу последних соперников и условия матча, а затем показывает, какие факторы действительно изменили расчёт.'],
        ['КОНТЕКСТ МАТЧА', 'Новости, состав и погода действительно учитываются', 'В модель попадают только релевантные проверенные сигналы: травмы, дисквалификации, доступность игроков, погода и важные новости. Их влияние ограничено, чтобы один фактор не искажал весь прогноз.'],
        ['ПЕРСОНАЛЬНАЯ СТРАТЕГИЯ', 'Иногда лучшее решение — пропустить матч', 'Vertex не обязан давать прогноз на каждую игру. При слабых данных, конфликтующих сигналах или неподходящем рынке система может правильно рекомендовать пропустить матч.']
      ],
      stripLabel: 'VERTEX УЧИТЫВАЕТ',
      strip: ['Текущая форма', 'Голы', 'Календарь', 'Сила соперников', 'Состав', 'Новости', 'Погода', 'Качество данных'],
      trust: 'Без выдуманной точности и выдуманной статистики. Рынок показывается только тогда, когда подключённые источники дают достаточно реальных данных.'
    },
    es: {
      slogan: 'Donde la IA se encuentra con el fútbol',
      stats: [
        ['DATOS', 'Varias fuentes verificadas'],
        ['CONTEXTO', 'Noticias + clima'],
        ['CALIDAD', 'Confianza transparente'],
        ['BETA', 'Acceso gratuito']
      ],
      cards: [
        ['ANÁLISIS DEL PARTIDO', 'Probabilidades basadas en datos reales', 'Vertex compara la forma reciente, la producción de goles, la fuerza de los últimos rivales y el contexto del partido, y después explica qué factores cambiaron realmente el cálculo.'],
        ['CONTEXTO DEL PARTIDO', 'Noticias, disponibilidad y clima sí cuentan', 'Solo entran en el modelo señales relevantes y verificadas: lesiones, sanciones, disponibilidad, clima y noticias importantes. Su impacto está limitado para que un solo factor no distorsione el pronóstico.'],
        ['ESTRATEGIA PERSONAL', 'A veces la mejor decisión es pasar', 'Vertex no fuerza una selección en cada partido. Datos débiles, señales contradictorias o un mercado sin soporte pueden llevar correctamente a una decisión de PASAR.']
      ],
      stripLabel: 'VERTEX TIENE EN CUENTA',
      strip: ['Forma reciente', 'Goles', 'Calendario', 'Fuerza de rivales', 'Plantilla', 'Noticias', 'Clima', 'Calidad de datos'],
      trust: 'Sin precisión inventada ni estadísticas ficticias. Un mercado se muestra solo cuando las fuentes conectadas aportan suficientes datos reales.'
    }
  };

  function applyHomeCopy() {
    const root = document.getElementById('tab-home');
    if (!root) return;
    const copy = homeCopy[language()] || homeCopy.en;
    const slogan = root.querySelector('.hero-slogan');
    if (slogan) slogan.textContent = copy.slogan;
    const trust = root.querySelector('.home-trust-line');
    if (trust) trust.textContent = copy.trust;

    const statItems = [...root.querySelectorAll('.stats-grid .stat-item')];
    copy.stats.forEach(([headline, label], index) => {
      const item = statItems[index];
      if (!item) return;
      const number = item.querySelector('.stat-number');
      const caption = item.querySelector('.stat-label');
      if (number) number.textContent = headline;
      if (caption) caption.textContent = label;
    });

    const cards = [...root.querySelectorAll('.home-value-card')];
    copy.cards.forEach(([kicker, title, body], index) => {
      const card = cards[index];
      if (!card) return;
      const kickerNode = card.querySelector(':scope > span');
      const titleNode = card.querySelector(':scope > strong');
      const bodyNode = card.querySelector(':scope > p');
      if (kickerNode) kickerNode.textContent = kicker;
      if (titleNode) titleNode.textContent = title;
      if (bodyNode) bodyNode.textContent = body;
    });

    const strip = root.querySelector('.home-data-strip');
    if (strip) {
      const label = strip.querySelector(':scope > span');
      if (label) label.textContent = copy.stripLabel;
      const pills = [...strip.querySelectorAll(':scope > b')];
      copy.strip.forEach((text, index) => { if (pills[index]) pills[index].textContent = text; });
    }
  }

  function cleanDuplicateLanguageSwitcher() {
    const wrap = document.getElementById('vertexLanguage');
    if (!wrap) return;
    wrap.querySelectorAll('[data-v6-lang]').forEach((node) => node.remove());
    wrap.classList.remove('v6-language-switcher');
  }

  function normalizeMatchExpression(value) {
    let text = String(value || '').trim();
    if (!text) return text;
    text = text
      .replace(/\s+(?:против|contra|versus|vs\.?|v\.?)\s+/gi, ' vs ')
      .replace(/\s*[–—]\s*/g, ' vs ')
      .replace(/(\S)\s*-\s+(\S)/g, '$1 vs $2')
      .replace(/(\S)\s+-\s*(\S)/g, '$1 vs $2')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return text;
  }

  function normalizeInput(input) {
    if (!input || !['searchInput', 'analyzerSearch'].includes(input.id)) return;
    const next = normalizeMatchExpression(input.value);
    if (next && next !== input.value) input.value = next;
  }

  const toastCopy = {
    ru: {
      'Use the format “Home Team vs Away Team”.': 'Введите матч в формате «Команда 1 — Команда 2». Например: Малага — Вильярреал.',
      'Run an analysis first.': 'Сначала запустите анализ матча.',
      'Analysis saved to My Cabinet.': 'Анализ сохранён в личном кабинете.',
      'Analysis summary copied.': 'Сводка анализа скопирована.',
      'Clipboard permission is unavailable.': 'Браузер не разрешил доступ к буферу обмена.',
      'Signed out.': 'Вы вышли из аккаунта.',
      'Signed in. Vertex is unlocked.': 'Вход выполнен. Функции Vertex доступны.',
      'Account created. Vertex is unlocked.': 'Аккаунт создан. Функции Vertex доступны.',
      'Verification email sent. Confirm your email, then sign in.': 'Письмо для подтверждения отправлено. Подтвердите email и затем войдите.'
    },
    es: {
      'Use the format “Home Team vs Away Team”.': 'Introduce el partido como «Equipo 1 — Equipo 2». Ejemplo: Málaga — Villarreal.',
      'Run an analysis first.': 'Primero ejecuta un análisis del partido.',
      'Analysis saved to My Cabinet.': 'Análisis guardado en Mi panel.',
      'Analysis summary copied.': 'Resumen del análisis copiado.',
      'Clipboard permission is unavailable.': 'El navegador no permite acceder al portapapeles.',
      'Signed out.': 'Sesión cerrada.',
      'Signed in. Vertex is unlocked.': 'Sesión iniciada. Vertex está disponible.',
      'Account created. Vertex is unlocked.': 'Cuenta creada. Vertex está disponible.',
      'Verification email sent. Confirm your email, then sign in.': 'Correo de verificación enviado. Confirma tu email y después inicia sesión.'
    }
  };

  function localizeToast() {
    const toast = document.getElementById('toast');
    if (!toast) return;
    const current = language();
    if (current === 'en') return;
    const original = toast.textContent.trim();
    const translated = toastCopy[current]?.[original];
    if (translated) toast.textContent = translated;
  }

  const infoCopy = {
    en: {
      about: {
        kicker: 'ABOUT VERTEX', title: 'Vertex Soccer AI',
        lead: 'A football intelligence platform that turns real match data into a clear, traceable analysis instead of a black-box prediction.',
        cards: [
          ['REAL DATA', 'Multiple-source match intelligence', 'Team form, fixtures, results, event statistics, news, player availability and weather are combined only when the connected sources actually provide them.'],
          ['TRANSPARENT MODEL', 'Every percentage needs a reason', 'Vertex shows confidence, data quality and the strongest factors behind the calculation. Unsupported markets are withheld instead of invented.'],
          ['PERSONAL WORKSPACE', 'Analysis that becomes useful over time', 'Your cabinet keeps recent analyses, saved matches and your strategy profile so the platform can become a consistent football-analysis workflow.']
        ],
        note: 'Vertex Soccer AI is in Free Beta. The goal is not to promise guaranteed results; it is to make football analysis more structured, understandable and honest about uncertainty.'
      },
      terms: { kicker: 'TERMS', title: 'Responsible analysis', lead: 'Vertex provides informational football analysis based on probabilities and available source data.', note: 'Predictions are not guarantees, financial advice or a promise of profit. Always treat probabilities as uncertain estimates.' },
      privacy: { kicker: 'PRIVACY', title: 'Privacy and data handling', lead: 'Account authentication is handled through Supabase. Football, weather and news provider secrets stay on the server.', note: 'Your personal cabinet data is protected by row-level security. Vertex does not need your payment details during the Free Beta.' },
      close: 'CLOSE'
    },
    ru: {
      about: {
        kicker: 'О ПРОЕКТЕ', title: 'Vertex Soccer AI',
        lead: 'Футбольная аналитическая платформа, которая превращает реальные данные матча в понятный и проверяемый разбор, а не выдаёт прогноз из «чёрного ящика».',
        cards: [
          ['РЕАЛЬНЫЕ ДАННЫЕ', 'Несколько источников в одном анализе', 'Форма команд, календарь, результаты, событийная статистика, новости, доступность игроков и погода объединяются только тогда, когда подключённые источники действительно дают эти данные.'],
          ['ПРОЗРАЧНАЯ МОДЕЛЬ', 'У каждой цифры должна быть причина', 'Vertex показывает достоверность, качество данных и главные факторы расчёта. Если рынок не подтверждён данными, система скрывает его, а не придумывает.'],
          ['ЛИЧНОЕ ПРОСТРАНСТВО', 'Аналитика, которой удобно пользоваться постоянно', 'В личном кабинете сохраняются последние анализы, выбранные матчи и ваша стратегия, чтобы Vertex работал как единая система, а не как одноразовый прогноз.']
        ],
        note: 'Vertex Soccer AI находится в бесплатной бета-версии. Цель проекта — не обещать гарантированный результат, а сделать футбольный анализ системным, понятным и честным по отношению к неопределённости.'
      },
      terms: { kicker: 'УСЛОВИЯ', title: 'Ответственный анализ', lead: 'Vertex предоставляет информационный футбольный анализ на основе вероятностей и доступных данных источников.', note: 'Прогнозы не являются гарантией результата, финансовой консультацией или обещанием прибыли. Любая вероятность остаётся оценкой с неопределённостью.' },
      privacy: { kicker: 'КОНФИДЕНЦИАЛЬНОСТЬ', title: 'Конфиденциальность и данные', lead: 'Авторизация аккаунта работает через Supabase. Ключи футбольных, погодных и новостных API хранятся только на сервере.', note: 'Данные личного кабинета защищены политиками доступа. Во время бесплатной беты Vertex не запрашивает платёжные данные.' },
      close: 'ЗАКРЫТЬ'
    },
    es: {
      about: {
        kicker: 'SOBRE VERTEX', title: 'Vertex Soccer AI',
        lead: 'Una plataforma de inteligencia de fútbol que convierte datos reales del partido en un análisis claro y rastreable, en lugar de ofrecer un pronóstico de caja negra.',
        cards: [
          ['DATOS REALES', 'Varias fuentes en un solo análisis', 'Forma, calendario, resultados, estadísticas de eventos, noticias, disponibilidad de jugadores y clima se combinan solo cuando las fuentes conectadas realmente aportan esos datos.'],
          ['MODELO TRANSPARENTE', 'Cada porcentaje debe tener una razón', 'Vertex muestra confianza, calidad de datos y los factores principales del cálculo. Los mercados sin soporte se ocultan en lugar de inventarse.'],
          ['ESPACIO PERSONAL', 'Análisis útil de forma continua', 'Tu panel guarda análisis recientes, partidos guardados y tu perfil de estrategia para convertir Vertex en un flujo de trabajo consistente.']
        ],
        note: 'Vertex Soccer AI está en Beta gratuita. El objetivo no es prometer resultados garantizados, sino hacer el análisis de fútbol más estructurado, comprensible y honesto respecto a la incertidumbre.'
      },
      terms: { kicker: 'TÉRMINOS', title: 'Análisis responsable', lead: 'Vertex ofrece análisis informativo de fútbol basado en probabilidades y en los datos disponibles de las fuentes.', note: 'Los pronósticos no son garantías, asesoramiento financiero ni promesas de beneficio. Toda probabilidad sigue siendo una estimación incierta.' },
      privacy: { kicker: 'PRIVACIDAD', title: 'Privacidad y tratamiento de datos', lead: 'La autenticación de la cuenta se gestiona mediante Supabase. Las claves de proveedores de fútbol, clima y noticias permanecen en el servidor.', note: 'Los datos de tu panel están protegidos por políticas de acceso. Durante la Beta gratuita Vertex no necesita datos de pago.' },
      close: 'CERRAR'
    }
  };

  function infoModal(kind) {
    const current = infoCopy[language()] || infoCopy.en;
    const data = current[kind];
    if (!data) return;
    const overlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('modalContent');
    if (!overlay || !modal) return;
    const cards = Array.isArray(data.cards) ? `<div class="v7-info-grid">${data.cards.map(([kicker, title, body]) => `<article class="v7-info-card"><span>${kicker}</span><strong>${title}</strong><p>${body}</p></article>`).join('')}</div>` : '';
    modal.className = 'modal vertex-info-v7';
    modal.innerHTML = `<div class="v7-info-head"><span class="v7-info-kicker">${data.kicker}</span><h2>${data.title}</h2><p class="v7-info-lead">${data.lead}</p></div>${cards}<div class="v7-info-note">${data.note}</div><div class="v7-info-actions"><button type="button" data-modal-action="close">${current.close}</button></div>`;
    overlay.classList.remove('hidden');
  }

  document.addEventListener('input', (event) => {
    const input = event.target.closest?.('#searchInput, #analyzerSearch');
    if (input) normalizeInput(input);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') normalizeInput(event.target.closest?.('#searchInput, #analyzerSearch'));
  }, true);

  document.addEventListener('click', (event) => {
    const analyze = event.target.closest?.('#btnAnalyze, #btnAnalyzeMatch');
    if (analyze) normalizeInput(document.getElementById(analyze.id === 'btnAnalyze' ? 'searchInput' : 'analyzerSearch'));

    const about = event.target.closest?.('#linkAbout');
    const terms = event.target.closest?.('#linkTerms');
    const privacy = event.target.closest?.('#linkPrivacy');
    if (about || terms || privacy) {
      event.preventDefault();
      event.stopImmediatePropagation();
      infoModal(about ? 'about' : terms ? 'terms' : 'privacy');
    }
  }, true);

  document.addEventListener('vertex:languagechange', () => {
    setTimeout(() => {
      cleanDuplicateLanguageSwitcher();
      applyHomeCopy();
      localizeToast();
    }, 0);
  });

  function boot() {
    cleanDuplicateLanguageSwitcher();
    applyHomeCopy();
    localizeToast();

    const nav = document.getElementById('nav');
    if (nav) new MutationObserver(() => cleanDuplicateLanguageSwitcher()).observe(nav, { childList: true, subtree: true });

    const toast = document.getElementById('toast');
    if (toast) new MutationObserver(() => localizeToast()).observe(toast, { childList: true, characterData: true, subtree: true });

    setTimeout(cleanDuplicateLanguageSwitcher, 250);
    setTimeout(cleanDuplicateLanguageSwitcher, 900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
