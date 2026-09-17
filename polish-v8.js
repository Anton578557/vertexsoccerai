'use strict';

(() => {
  if (window.__vertexPolishV8) return;
  window.__vertexPolishV8 = true;

  function ensureStylesheet() {
    if (document.querySelector('link[href^="polish-v8.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'polish-v8.css?v=8';
    document.head.appendChild(link);
  }
  ensureStylesheet();

  const lang = () => window.VertexI18n?.getLanguage?.() || localStorage.getItem('vertex_language') || 'en';
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  const readLocal = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (_) { return fallback; }
  };
  const setText = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };

  const strategyCopy = {
    en: {
      kicker: 'PERSONAL DECISION ENGINE', title: 'My Strategy', subtitle: 'A personal filter for risk, competitions and markets — not a promise of profit.',
      profile: 'YOUR PROFILE', rules: 'VERTEX RULES', bankroll: 'BANKROLL REFERENCE', threshold: 'DATA THRESHOLD', markets: 'MARKETS', objective: 'OBJECTIVE',
      edit: 'EDIT PROFILE', scan: 'SCAN TODAY', rulesTitle: 'NO CHASING. NO FORCED PICKS.',
      rule1: (n) => `Reject matches below ${n}% data quality.`, rule2: 'Pass when recent form or team availability is too weak.', rule3: 'Only use markets supported by the available source data.', rule4: 'More matches do not mean better decisions.',
      introKicker: 'VERTEX STRATEGY', introTitle: 'Build your Vertex profile', introBody: 'Set your experience, risk profile and preferred markets. Vertex uses these rules to decide when a match deserves attention and when PASS is the better decision.',
      features: ['Personal risk framework', 'Preferred market filters', 'Data-quality threshold', 'PASS / WATCH / FIT decision logic'], setup: 'SET UP MY PROFILE',
      form: { bankroll: 'Bankroll reference', experience: 'Experience', risk: 'Risk profile', objective: 'Objective', markets: 'Preferred markets', save: 'SAVE STRATEGY' },
      scanLoading: 'Scanning today’s available fixtures…', scanEmpty: 'No current fixtures were returned by the connected provider.', analyze: 'ANALYZE MATCH'
    },
    ru: {
      kicker: 'ПЕРСОНАЛЬНЫЙ ДВИЖОК РЕШЕНИЙ', title: 'Моя стратегия', subtitle: 'Персональный фильтр риска, турниров и рынков — без обещаний прибыли.',
      profile: 'ВАШ ПРОФИЛЬ', rules: 'ПРАВИЛА VERTEX', bankroll: 'ОРИЕНТИР БАНКРОЛЛА', threshold: 'ПОРОГ КАЧЕСТВА', markets: 'РЫНКИ', objective: 'ЦЕЛЬ',
      edit: 'ИЗМЕНИТЬ ПРОФИЛЬ', scan: 'СКАНИРОВАТЬ МАТЧИ', rulesTitle: 'БЕЗ ПОГОНИ. БЕЗ НАТЯНУТЫХ ПРОГНОЗОВ.',
      rule1: (n) => `Отклонять матчи с качеством данных ниже ${n}%.`, rule2: 'Пропускать матч, если свежая форма или данные по составу слишком слабые.', rule3: 'Использовать только рынки, которые подтверждаются доступными данными.', rule4: 'Больше матчей не означает более качественное решение.',
      introKicker: 'СТРАТЕГИЯ VERTEX', introTitle: 'Настройте свой профиль Vertex', introBody: 'Укажите опыт, отношение к риску и интересующие рынки. Vertex превратит это в правила: какие матчи стоит рассматривать, а какие лучше пропустить.',
      features: ['Персональные правила риска', 'Фильтры по рынкам', 'Минимальный порог качества данных', 'Логика ПРОПУСТИТЬ / НАБЛЮДАТЬ / ПОДХОДИТ'], setup: 'НАСТРОИТЬ ПРОФИЛЬ',
      form: { bankroll: 'Ориентир банкролла', experience: 'Опыт', risk: 'Профиль риска', objective: 'Цель', markets: 'Предпочтительные рынки', save: 'СОХРАНИТЬ СТРАТЕГИЮ' },
      scanLoading: 'Сканируем доступные матчи…', scanEmpty: 'Подключённый источник не вернул доступных матчей.', analyze: 'АНАЛИЗИРОВАТЬ МАТЧ'
    },
    es: {
      kicker: 'MOTOR PERSONAL DE DECISIÓN', title: 'Mi estrategia', subtitle: 'Un filtro personal de riesgo, competiciones y mercados — sin promesas de beneficio.',
      profile: 'TU PERFIL', rules: 'REGLAS VERTEX', bankroll: 'BANCA DE REFERENCIA', threshold: 'UMBRAL DE DATOS', markets: 'MERCADOS', objective: 'OBJETIVO',
      edit: 'EDITAR PERFIL', scan: 'ESCANEAR PARTIDOS', rulesTitle: 'SIN PERSEGUIR. SIN FORZAR PRONÓSTICOS.',
      rule1: (n) => `Descartar partidos con calidad de datos inferior al ${n}%.`, rule2: 'Pasar cuando la forma reciente o la disponibilidad del equipo sea demasiado débil.', rule3: 'Usar solo mercados respaldados por los datos disponibles.', rule4: 'Más partidos no significa mejores decisiones.',
      introKicker: 'ESTRATEGIA VERTEX', introTitle: 'Configura tu perfil Vertex', introBody: 'Define tu experiencia, perfil de riesgo y mercados preferidos. Vertex convierte esas preferencias en reglas para decidir qué partidos merecen atención y cuáles conviene pasar.',
      features: ['Marco personal de riesgo', 'Filtros de mercados', 'Umbral mínimo de calidad de datos', 'Lógica PASAR / VIGILAR / ENCAJA'], setup: 'CONFIGURAR PERFIL',
      form: { bankroll: 'Banca de referencia', experience: 'Experiencia', risk: 'Perfil de riesgo', objective: 'Objetivo', markets: 'Mercados preferidos', save: 'GUARDAR ESTRATEGIA' },
      scanLoading: 'Escaneando partidos disponibles…', scanEmpty: 'La fuente conectada no devolvió partidos disponibles.', analyze: 'ANALIZAR PARTIDO'
    }
  };

  const valueLabels = {
    risk: {
      Conservative: { en: 'Conservative', ru: 'Консервативный', es: 'Conservador' },
      Balanced: { en: 'Balanced', ru: 'Сбалансированный', es: 'Equilibrado' },
      Moderate: { en: 'Moderate', ru: 'Средний', es: 'Moderado' },
      Aggressive: { en: 'Aggressive', ru: 'Агрессивный', es: 'Agresivo' }
    },
    experience: {
      Beginner: { en: 'Beginner', ru: 'Новичок', es: 'Principiante' },
      Intermediate: { en: 'Intermediate', ru: 'Средний', es: 'Intermedio' },
      Advanced: { en: 'Advanced', ru: 'Опытный', es: 'Avanzado' }
    },
    objective: {
      'Protect bankroll': { en: 'Protect bankroll', ru: 'Сохранение банкролла', es: 'Proteger la banca' },
      'Controlled growth': { en: 'Controlled growth', ru: 'Контролируемый рост', es: 'Crecimiento controlado' },
      'Learn disciplined analysis': { en: 'Learn disciplined analysis', ru: 'Освоить дисциплинированный анализ', es: 'Aprender análisis disciplinado' }
    },
    market: {
      '1X2': { en: '1X2', ru: '1X2', es: '1X2' },
      'Double Chance': { en: 'Double Chance', ru: 'Двойной шанс', es: 'Doble oportunidad' },
      Goals: { en: 'Goals', ru: 'Голы', es: 'Goles' },
      BTTS: { en: 'BTTS', ru: 'Обе забьют', es: 'Ambos marcan' },
      Corners: { en: 'Corners', ru: 'Угловые', es: 'Córners' },
      Cards: { en: 'Cards', ru: 'Карточки', es: 'Tarjetas' }
    }
  };

  function canonicalFromVariants(group, value) {
    const text = String(value || '').trim();
    for (const [canonical, labels] of Object.entries(valueLabels[group] || {})) {
      if (canonical === text || Object.values(labels).includes(text)) return canonical;
    }
    return text;
  }
  function localized(group, value) {
    const canonical = canonicalFromVariants(group, value);
    return valueLabels[group]?.[canonical]?.[lang()] || canonical;
  }

  function strategyThreshold(profile) {
    const risk = canonicalFromVariants('risk', profile?.risk || 'Balanced');
    return risk === 'Conservative' ? 76 : risk === 'Aggressive' ? 60 : 68;
  }

  function renderStrategyProfile() {
    const root = document.getElementById('tab-strategy');
    const target = document.getElementById('strategyContent');
    if (!root || !target) return;
    const copy = strategyCopy[lang()] || strategyCopy.en;
    setText(root.querySelector('.section-heading .kicker'), copy.kicker);
    setText(root.querySelector('.section-heading .section-title'), copy.title);
    setText(root.querySelector('.section-heading .section-subtitle'), copy.subtitle);

    const profile = readLocal('vertex_strategy_profile', null);
    const form = target.querySelector('#strategyForm');
    if (form) return localizeStrategyForm(form, profile);

    if (!profile) {
      const intro = target.querySelector('.strategy-intro');
      if (!intro) return;
      setText(intro.querySelector('.kicker, .eyebrow'), copy.introKicker);
      setText(intro.querySelector('h3'), copy.introTitle);
      setText(intro.querySelector('.strategy-copy'), copy.introBody);
      [...intro.querySelectorAll('.trainer-features li')].forEach((li, i) => { if (copy.features[i]) setText(li, copy.features[i]); });
      setText(intro.querySelector('#btnTryStrategy'), copy.setup);
      return;
    }

    if (!target.querySelector('.strategy-dashboard')) return;
    const threshold = strategyThreshold(profile);
    const markets = (profile.markets || []).map((item) => localized('market', item)).join(', ');
    const objective = localized('objective', profile.objective || 'Controlled growth');
    const risk = localized('risk', profile.risk || 'Balanced');
    const experience = localized('experience', profile.experience || 'Intermediate');

    target.innerHTML = `
      <div class="strategy-dashboard">
        <div class="strategy-panel">
          <span class="kicker">${esc(copy.profile)}</span>
          <h3>${esc(risk)} · ${esc(experience)}</h3>
          <div class="profile-score">
            <div><span>${esc(copy.bankroll)}</span><strong>${esc(profile.bankroll || 1000)}</strong></div>
            <div><span>${esc(copy.threshold)}</span><strong>${threshold}%</strong></div>
            <div><span>${esc(copy.markets)}</span><strong>${esc(markets || '—')}</strong></div>
            <div><span>${esc(copy.objective)}</span><strong>${esc(objective)}</strong></div>
          </div>
          <div class="strategy-actions">
            <button class="btn-secondary" data-action="edit-strategy" type="button">${esc(copy.edit)}</button>
            <button class="btn-primary" data-action="scan-strategy" type="button">${esc(copy.scan)}</button>
          </div>
        </div>
        <div class="strategy-panel">
          <span class="kicker">${esc(copy.rules)}</span>
          <h3>${esc(copy.rulesTitle)}</h3>
          <ul class="strategy-rules">
            <li>${esc(copy.rule1(threshold))}</li><li>${esc(copy.rule2)}</li><li>${esc(copy.rule3)}</li><li>${esc(copy.rule4)}</li>
          </ul>
        </div>
      </div>
      <div id="strategyScanResults" class="strategy-scan-results"></div>`;
  }

  function localizeStrategyForm(form, profile) {
    const copy = strategyCopy[lang()] || strategyCopy.en;
    const labels = [...form.querySelectorAll('.field > label')];
    [copy.form.bankroll, copy.form.experience, copy.form.risk, copy.form.objective, copy.form.markets].forEach((text, i) => setText(labels[i], text));

    const selectGroups = [
      ['#strategyExperience', 'experience', profile?.experience],
      ['#strategyRisk', 'risk', profile?.risk],
      ['#strategyObjective', 'objective', profile?.objective]
    ];
    selectGroups.forEach(([selector, group, selected]) => {
      const select = form.querySelector(selector);
      if (!select) return;
      [...select.options].forEach((option) => {
        const canonical = canonicalFromVariants(group, option.value || option.textContent);
        option.value = canonical;
        option.textContent = localized(group, canonical);
      });
      if (selected) select.value = canonicalFromVariants(group, selected);
    });

    form.querySelectorAll('input[name="strategyMarket"]').forEach((input) => {
      const canonical = canonicalFromVariants('market', input.value);
      input.value = canonical;
      setText(input.nextElementSibling, localized('market', canonical));
      if (profile?.markets?.length) input.checked = profile.markets.map((x) => canonicalFromVariants('market', x)).includes(canonical);
    });
    setText(form.querySelector('button[type="submit"]'), copy.form.save);
  }

  function localizeStrategyScan() {
    const box = document.getElementById('strategyScanResults');
    if (!box) return;
    const copy = strategyCopy[lang()] || strategyCopy.en;
    const loading = box.querySelector('.loading-state');
    if (loading && /Scanning|Скан|Escaneando/i.test(loading.textContent)) setText(loading, copy.scanLoading);
    box.querySelectorAll('[data-analyze-match]').forEach((button) => setText(button, copy.analyze));
    const empty = box.querySelector('.empty-state p');
    if (empty && /current fixtures|доступных матчей|partidos disponibles/i.test(empty.textContent)) setText(empty, copy.scanEmpty);
  }

  const footerCopy = {
    en: { engine: 'Football Intelligence Engine', line: '18+ · Informational analysis · No guarantees · Not a bookmaker', about: 'About', terms: 'Terms', privacy: 'Privacy', responsible: 'Responsible use' },
    ru: { engine: 'Футбольный аналитический движок', line: '18+ · Информационная аналитика · Без гарантий · Vertex не является букмекером', about: 'О проекте', terms: 'Условия', privacy: 'Конфиденциальность', responsible: 'Ответственное использование' },
    es: { engine: 'Motor de inteligencia de fútbol', line: '18+ · Análisis informativo · Sin garantías · Vertex no es una casa de apuestas', about: 'Sobre Vertex', terms: 'Términos', privacy: 'Privacidad', responsible: 'Uso responsable' }
  };

  function removeBetaAndPolishFooter() {
    const current = footerCopy[lang()] || footerCopy.en;
    const footer = document.querySelector('.footer');
    if (!footer) return;
    const brandMeta = footer.querySelector('.footer-inner > div:first-child span');
    setText(brandMeta, current.engine);
    const legalLine = footer.querySelector('.footer-inner > p');
    if (legalLine) legalLine.innerHTML = `© <span id="footerYear">${new Date().getFullYear()}</span> Vertex Soccer AI. ${esc(current.line)}`;
    setText(document.getElementById('linkAbout'), current.about);
    setText(document.getElementById('linkTerms'), current.terms);
    setText(document.getElementById('linkPrivacy'), current.privacy);
    let responsible = document.getElementById('linkResponsible');
    if (!responsible) {
      responsible = document.createElement('a');
      responsible.href = '#';
      responsible.id = 'linkResponsible';
      footer.querySelector('.footer-links')?.appendChild(responsible);
    }
    setText(responsible, current.responsible);

    document.querySelectorAll('.eyebrow, .strategy-intro .kicker').forEach((node) => {
      if (/FREE BETA|БЕСПЛАТН|BETA GRATUITA/i.test(node.textContent || '')) {
        const replacement = lang() === 'ru' ? 'ФУТБОЛЬНАЯ АНАЛИТИКА' : lang() === 'es' ? 'INTELIGENCIA DE FÚTBOL' : 'FOOTBALL INTELLIGENCE';
        setText(node, replacement);
      }
    });
    document.querySelectorAll('.stat-number').forEach((node) => {
      if (/^BETA$/i.test(node.textContent.trim())) setText(node, lang() === 'ru' ? 'ДОСТУП' : lang() === 'es' ? 'ACCESO' : 'ACCESS');
    });

    const faq = document.getElementById('tab-faq');
    if (faq) {
      [...faq.querySelectorAll('.faq-item')].forEach((item) => {
        const h = item.querySelector('h3'); const p = item.querySelector('p');
        if (h && /free\?/i.test(h.textContent)) {
          if (lang() === 'ru') { setText(h, 'Vertex Soccer AI бесплатный?'); setText(p, 'Да. Сейчас сервис доступен бесплатно. Платные функции не подключены.'); }
          else if (lang() === 'es') { setText(h, '¿Vertex Soccer AI es gratuito?'); setText(p, 'Sí. Actualmente el servicio se puede usar de forma gratuita. No hay funciones de pago activadas.'); }
          else { setText(h, 'Is Vertex Soccer AI free?'); setText(p, 'Yes. The service is currently free to use. Paid features are not enabled.'); }
        }
      });
    }
  }

  const legal = {
    en: {
      close: 'CLOSE',
      about: { kicker: 'ABOUT VERTEX', title: 'Vertex Soccer AI', lead: 'A football intelligence platform designed to make probabilistic analysis clear, traceable and grounded in real source data.', sections: [
        ['What the service does', 'Vertex combines available football data, form, event statistics, team context, news, availability and weather. A forecast is shown only when the model has enough verified input.'],
        ['What the service does not do', 'Vertex is not a bookmaker, does not accept wagers, does not hold betting funds and does not guarantee any sporting or financial outcome.'],
        ['Transparency', 'Confidence and data quality describe the strength of the available input, not certainty about the result. Provider gaps and unsupported markets should remain visible.'],
        ['Contact', 'Support and privacy requests: vertexsoccerai@outlook.com.']
      ], warning: 'Football outcomes are uncertain. Treat every probability as an estimate, not a promise.' },
      terms: { kicker: 'TERMS OF USE', title: 'Terms and responsible use', lead: 'By using Vertex Soccer AI you agree to use the service as an informational football-analysis tool.', sections: [
        ['18+ and local law', 'The service is intended for adults aged 18+. You are responsible for complying with the laws and gambling rules that apply where you live or use the service.'],
        ['No betting service or financial advice', 'Vertex is not a bookmaker, betting exchange, gambling operator, investment service or financial adviser. It does not take bets, hold stakes, provide credit or promise profit.'],
        ['Probabilities, not guarantees', 'Predictions are statistical estimates built from available data. Injuries, line-ups, weather, provider errors, late news and random match events can make any forecast wrong.'],
        ['Third-party data', 'Football, weather and news information may come from third-party providers. Availability, accuracy and timeliness can change without notice. Team names, badges and trademarks belong to their respective owners.'],
        ['User responsibility', 'Do not rely on Vertex as the sole basis for a financial decision. If you choose to bet elsewhere, the decision, stake and consequences remain entirely your responsibility.'],
        ['Acceptable use', 'Do not abuse the service, bypass access controls, attack the infrastructure, automate excessive requests, scrape protected data or use Vertex for unlawful activity.'],
        ['Availability and changes', 'Features, providers and models may change, be limited or be unavailable. We may suspend access where necessary for security, maintenance, abuse prevention or legal reasons.'],
        ['Liability', 'To the maximum extent permitted by applicable law, Vertex is provided without a guarantee of uninterrupted service, data accuracy or specific results. Nothing in these terms limits rights that cannot legally be excluded.']
      ], warning: 'If betting stops being entertainment, stop. Never chase losses or use money you cannot afford to lose.' },
      privacy: { kicker: 'PRIVACY', title: 'Privacy and data handling', lead: 'This notice explains the main categories of personal data used by Vertex Soccer AI and how the service handles them.', sections: [
        ['Data controller contact', 'Service/privacy contact: Vertex Soccer AI — vertexsoccerai@outlook.com.'],
        ['Data we may process', 'Account email and user ID; language and strategy preferences; saved matches and analysis history; support messages; technical/security logs needed to operate and protect the service.'],
        ['Why we process it', 'To provide accounts and requested features, save your settings and history, secure the service, prevent abuse, respond to support requests and improve reliability.'],
        ['Infrastructure and processors', 'The service uses infrastructure and service providers such as Supabase, Vercel and Resend. Football, weather and news providers are queried server-side and should not receive your account password.'],
        ['Storage and retention', 'Browser storage is used for language, strategy and session-related functionality. Account-related data is kept only as long as needed for the service, security, legal obligations or dispute handling.'],
        ['Your rights', 'Where GDPR or similar law applies, you may have rights to information, access, correction, deletion, restriction, objection and portability, and the right to complain to a supervisory authority.'],
        ['International processing', 'Some service providers may process data outside your country. Where required, transfers should rely on an applicable legal transfer mechanism and provider safeguards.'],
        ['No sale of personal data', 'Vertex does not sell your personal information to advertisers. Payment-card data is not requested by the current service.']
      ], warning: 'For access, correction or deletion requests, contact vertexsoccerai@outlook.com from the email linked to your account.' },
      responsible: { kicker: 'RESPONSIBLE USE', title: 'Use probabilities responsibly', lead: 'Vertex is built to support analysis, not to encourage compulsive or high-risk betting behaviour.', sections: [
        ['No certainty', 'A 70% probability can still lose. The purpose of the model is to quantify uncertainty, not remove it.'],
        ['No chasing', 'Do not increase stakes to recover a previous loss. A PASS decision is a valid analytical outcome.'],
        ['Set limits', 'If you choose to bet on a third-party service, use only money you can afford to lose and set your own time and spending limits.'],
        ['Get help when needed', 'If gambling is causing stress, debt or loss of control, stop and seek support from an appropriate local health or gambling-support service.']
      ], warning: 'Vertex never requires you to place a bet in order to use the analysis.' }
    },
    ru: {
      close: 'ЗАКРЫТЬ',
      about: { kicker: 'О ПРОЕКТЕ', title: 'Vertex Soccer AI', lead: 'Футбольная аналитическая платформа, созданная для понятного, проверяемого и основанного на реальных данных вероятностного анализа.', sections: [
        ['Что делает сервис', 'Vertex объединяет доступные футбольные данные, форму, событийную статистику, контекст команд, новости, доступность игроков и погоду. Прогноз показывается только при достаточном объёме проверенной информации.'],
        ['Чего сервис не делает', 'Vertex не является букмекером, не принимает ставки, не хранит игровые средства и не гарантирует спортивный или финансовый результат.'],
        ['Прозрачность', 'Достоверность и качество данных показывают силу входной информации, а не гарантированность результата. Пробелы источников и неподдерживаемые рынки должны быть видны пользователю.'],
        ['Контакт', 'Поддержка и запросы по персональным данным: vertexsoccerai@outlook.com.']
      ], warning: 'Результат футбольного матча всегда содержит неопределённость. Любая вероятность — это оценка, а не обещание.' },
      terms: { kicker: 'УСЛОВИЯ ИСПОЛЬЗОВАНИЯ', title: 'Условия и ответственное использование', lead: 'Используя Vertex Soccer AI, вы соглашаетесь использовать сервис как информационный инструмент футбольной аналитики.', sections: [
        ['18+ и местное законодательство', 'Сервис предназначен для совершеннолетних пользователей 18+. Пользователь самостоятельно обязан соблюдать законодательство и правила азартных игр, действующие в его стране или регионе.'],
        ['Не букмекер и не финансовая консультация', 'Vertex не является букмекером, биржей ставок, оператором азартных игр, инвестиционным сервисом или финансовым консультантом. Сервис не принимает ставки, не хранит денежные средства, не выдаёт кредит и не обещает прибыль.'],
        ['Вероятности, а не гарантии', 'Прогнозы являются статистическими оценками на основе доступных данных. Травмы, составы, погода, ошибки источников, поздние новости и случайные события матча могут сделать любой прогноз неверным.'],
        ['Сторонние данные', 'Футбольная, погодная и новостная информация может поступать от сторонних поставщиков. Доступность, точность и своевременность данных могут меняться. Названия команд, эмблемы и товарные знаки принадлежат их владельцам.'],
        ['Ответственность пользователя', 'Не используйте Vertex как единственное основание для финансового решения. Если вы самостоятельно делаете ставку в стороннем сервисе, решение, размер ставки и последствия остаются вашей ответственностью.'],
        ['Допустимое использование', 'Запрещено злоупотреблять сервисом, обходить ограничения доступа, атаковать инфраструктуру, создавать чрезмерную автоматическую нагрузку, собирать защищённые данные или использовать Vertex в незаконных целях.'],
        ['Доступность и изменения', 'Функции, поставщики данных и модели могут изменяться, ограничиваться или временно быть недоступны. Доступ может быть приостановлен по причинам безопасности, обслуживания, предотвращения злоупотреблений или выполнения закона.'],
        ['Ограничение ответственности', 'В максимальной степени, разрешённой применимым законодательством, Vertex не гарантирует непрерывную работу, абсолютную точность данных или конкретный результат. Права, которые нельзя законно исключить, сохраняются.']
      ], warning: 'Если ставки перестали быть развлечением — остановитесь. Не отыгрывайте потери и не используйте деньги, потерю которых вы не можете себе позволить.' },
      privacy: { kicker: 'КОНФИДЕНЦИАЛЬНОСТЬ', title: 'Конфиденциальность и обработка данных', lead: 'Здесь описаны основные категории персональных данных, которые может использовать Vertex Soccer AI, и цели их обработки.', sections: [
        ['Контакт контролёра данных', 'Контакт сервиса и по вопросам приватности: Vertex Soccer AI — vertexsoccerai@outlook.com.'],
        ['Какие данные могут обрабатываться', 'Email и ID аккаунта; язык и настройки стратегии; сохранённые матчи и история анализов; сообщения в поддержку; технические и защитные журналы, необходимые для работы и безопасности сервиса.'],
        ['Зачем они нужны', 'Для работы аккаунта и запрошенных функций, сохранения настроек и истории, защиты сервиса, предотвращения злоупотреблений, ответа на обращения и повышения надёжности.'],
        ['Инфраструктура и обработчики', 'Сервис использует инфраструктуру и поставщиков услуг, включая Supabase, Vercel и Resend. Запросы к футбольным, погодным и новостным источникам выполняются на сервере и не должны передавать поставщикам пароль вашего аккаунта.'],
        ['Хранение', 'В браузере сохраняются данные, необходимые для языка, стратегии и сессии. Данные аккаунта хранятся только столько, сколько необходимо для работы сервиса, безопасности, выполнения закона или разрешения споров.'],
        ['Ваши права', 'Если применяется GDPR или аналогичное законодательство, у вас могут быть права на информацию, доступ, исправление, удаление, ограничение обработки, возражение и переносимость данных, а также право подать жалобу в надзорный орган.'],
        ['Международная обработка', 'Некоторые поставщики услуг могут обрабатывать данные за пределами вашей страны. Когда это требуется, передача должна опираться на допустимый правовой механизм и защитные меры поставщика.'],
        ['Продажа данных', 'Vertex не продаёт персональные данные рекламодателям. Текущая версия сервиса не запрашивает данные банковских карт.']
      ], warning: 'Для запроса доступа, исправления или удаления данных напишите на vertexsoccerai@outlook.com с email, привязанного к аккаунту.' },
      responsible: { kicker: 'ОТВЕТСТВЕННОЕ ИСПОЛЬЗОВАНИЕ', title: 'Используйте вероятности ответственно', lead: 'Vertex создан для поддержки анализа, а не для поощрения компульсивных или высокорисковых ставок.', sections: [
        ['Нет гарантии', 'Даже вероятность 70% может не реализоваться. Модель измеряет неопределённость, а не устраняет её.'],
        ['Не отыгрывайтесь', 'Не увеличивайте размер ставки ради возврата предыдущей потери. Решение ПРОПУСТИТЬ является полноценным аналитическим результатом.'],
        ['Устанавливайте лимиты', 'Если вы самостоятельно используете сторонний букмекерский сервис, ставьте только те средства, потерю которых можете позволить, и заранее определяйте собственные лимиты времени и расходов.'],
        ['Обратитесь за помощью', 'Если азартная игра вызывает стресс, долги или потерю контроля, остановитесь и обратитесь в подходящую местную медицинскую службу или организацию помощи игрокам.']
      ], warning: 'Vertex никогда не требует делать ставку для использования аналитики.' }
    },
    es: {
      close: 'CERRAR',
      about: { kicker: 'SOBRE VERTEX', title: 'Vertex Soccer AI', lead: 'Una plataforma de inteligencia de fútbol diseñada para ofrecer análisis probabilístico claro, rastreable y basado en datos reales.', sections: [
        ['Qué hace el servicio', 'Vertex combina datos de fútbol disponibles, forma, estadísticas de eventos, contexto de equipos, noticias, disponibilidad de jugadores y clima. Solo se muestra un pronóstico cuando existe suficiente información verificada.'],
        ['Qué no hace', 'Vertex no es una casa de apuestas, no acepta apuestas, no custodia fondos de juego y no garantiza resultados deportivos o financieros.'],
        ['Transparencia', 'La confianza y la calidad de datos describen la solidez de la información disponible, no la certeza del resultado. Las carencias de proveedores y los mercados sin soporte deben seguir siendo visibles.'],
        ['Contacto', 'Soporte y solicitudes de privacidad: vertexsoccerai@outlook.com.']
      ], warning: 'El resultado de un partido siempre contiene incertidumbre. Cada probabilidad es una estimación, no una promesa.' },
      terms: { kicker: 'TÉRMINOS DE USO', title: 'Términos y uso responsable', lead: 'Al usar Vertex Soccer AI aceptas utilizar el servicio como una herramienta informativa de análisis de fútbol.', sections: [
        ['18+ y legislación local', 'El servicio está destinado a adultos de 18 años o más. Eres responsable de cumplir las leyes y normas sobre juego aplicables donde vivas o utilices el servicio.'],
        ['No es un servicio de apuestas ni asesoramiento financiero', 'Vertex no es una casa de apuestas, bolsa de apuestas, operador de juego, servicio de inversión ni asesor financiero. No acepta apuestas, no custodia fondos, no concede crédito y no promete beneficios.'],
        ['Probabilidades, no garantías', 'Los pronósticos son estimaciones estadísticas construidas con los datos disponibles. Lesiones, alineaciones, clima, errores de proveedores, noticias tardías y sucesos aleatorios pueden hacer que cualquier pronóstico falle.'],
        ['Datos de terceros', 'La información de fútbol, clima y noticias puede proceder de terceros. Su disponibilidad, precisión y actualidad pueden cambiar. Los nombres, escudos y marcas pertenecen a sus respectivos titulares.'],
        ['Responsabilidad del usuario', 'No uses Vertex como única base para una decisión financiera. Si decides apostar en un servicio externo, la decisión, el importe y las consecuencias son tu responsabilidad.'],
        ['Uso permitido', 'No abuses del servicio, eludas controles de acceso, ataques la infraestructura, generes solicitudes automatizadas excesivas, extraigas datos protegidos ni uses Vertex para actividades ilegales.'],
        ['Disponibilidad y cambios', 'Las funciones, proveedores y modelos pueden cambiar, limitarse o quedar temporalmente no disponibles. El acceso puede suspenderse por seguridad, mantenimiento, prevención de abuso o motivos legales.'],
        ['Responsabilidad', 'En la máxima medida permitida por la ley aplicable, Vertex no garantiza servicio ininterrumpido, exactitud absoluta de los datos ni resultados concretos. Los derechos que legalmente no puedan excluirse permanecen vigentes.']
      ], warning: 'Si apostar deja de ser entretenimiento, detente. No persigas pérdidas ni uses dinero que no puedas permitirte perder.' },
      privacy: { kicker: 'PRIVACIDAD', title: 'Privacidad y tratamiento de datos', lead: 'Este aviso describe las principales categorías de datos personales que puede utilizar Vertex Soccer AI y sus finalidades.', sections: [
        ['Contacto del responsable', 'Contacto del servicio y privacidad: Vertex Soccer AI — vertexsoccerai@outlook.com.'],
        ['Datos que podemos tratar', 'Email e ID de cuenta; idioma y preferencias de estrategia; partidos guardados e historial de análisis; mensajes de soporte; registros técnicos y de seguridad necesarios para operar y proteger el servicio.'],
        ['Finalidad', 'Proporcionar la cuenta y las funciones solicitadas, guardar ajustes e historial, proteger el servicio, prevenir abusos, responder al soporte y mejorar la fiabilidad.'],
        ['Infraestructura y encargados', 'El servicio utiliza infraestructura y proveedores como Supabase, Vercel y Resend. Las consultas a fuentes de fútbol, clima y noticias se realizan en el servidor y no deberían transmitir la contraseña de tu cuenta.'],
        ['Almacenamiento', 'El navegador guarda datos necesarios para idioma, estrategia y sesión. Los datos de cuenta se conservan solo durante el tiempo necesario para prestar el servicio, seguridad, obligaciones legales o resolución de disputas.'],
        ['Tus derechos', 'Cuando se aplique el RGPD o una ley similar, puedes tener derechos de información, acceso, rectificación, supresión, limitación, oposición y portabilidad, además del derecho a reclamar ante una autoridad de control.'],
        ['Tratamiento internacional', 'Algunos proveedores pueden tratar datos fuera de tu país. Cuando sea necesario, las transferencias deben apoyarse en un mecanismo jurídico aplicable y salvaguardas del proveedor.'],
        ['Venta de datos', 'Vertex no vende tus datos personales a anunciantes. El servicio actual no solicita datos de tarjetas de pago.']
      ], warning: 'Para solicitar acceso, corrección o eliminación, escribe a vertexsoccerai@outlook.com desde el email vinculado a tu cuenta.' },
      responsible: { kicker: 'USO RESPONSABLE', title: 'Usa las probabilidades con responsabilidad', lead: 'Vertex está diseñado para apoyar el análisis, no para fomentar apuestas compulsivas o de alto riesgo.', sections: [
        ['No existe certeza', 'Incluso una probabilidad del 70% puede perder. El modelo cuantifica la incertidumbre, no la elimina.'],
        ['No persigas pérdidas', 'No aumentes apuestas para recuperar una pérdida anterior. Una decisión de PASAR es un resultado analítico válido.'],
        ['Establece límites', 'Si decides apostar en un servicio externo, usa solo dinero que puedas permitirte perder y fija tus propios límites de tiempo y gasto.'],
        ['Busca ayuda cuando sea necesario', 'Si el juego provoca estrés, deuda o pérdida de control, detente y busca apoyo en un servicio sanitario o de ayuda al juego de tu zona.']
      ], warning: 'Vertex nunca exige realizar una apuesta para utilizar el análisis.' }
    }
  };

  function openLegal(kind) {
    const copy = legal[lang()] || legal.en;
    const data = copy[kind];
    const overlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('modalContent');
    if (!data || !overlay || !modal) return;
    modal.className = 'modal vertex-legal-v8';
    modal.innerHTML = `<div class="v8-legal-scroll"><div class="v8-legal-head"><span class="v8-legal-kicker">${esc(data.kicker)}</span><h2>${esc(data.title)}</h2><p>${esc(data.lead)}</p></div><div class="v8-legal-grid">${data.sections.map(([title, body]) => `<section class="v8-legal-card"><h3>${esc(title)}</h3><p>${esc(body)}</p></section>`).join('')}</div><div class="v8-legal-warning">${esc(data.warning)}</div><div class="v8-legal-actions"><button type="button" data-modal-action="close">${esc(copy.close)}</button></div></div>`;
    overlay.classList.remove('hidden');
  }

  const cabinetCopy = {
    en: { kicker:'VERTEX ACCOUNT', title:'My Cabinet', subtitle:'Your analysis workspace', active:'● ACCOUNT ACTIVE', recent:'Recent analyses', saved:'Saved matches', strategy:'Strategy', activity:'Activity', account:'Account', email:'Email', language:'Language', openStrategy:'OPEN STRATEGY', home:'BACK TO HOME', logout:'LOG OUT', emptyRecent:'No analyses yet. Run Match Analyzer and they will appear here.', emptySaved:'No saved matches yet.', again:'ANALYZE AGAIN', enabled:'ACTIVE', disabled:'NOT SET' },
    ru: { kicker:'АККАУНТ VERTEX', title:'Личный кабинет', subtitle:'Ваше пространство для аналитики', active:'● АККАУНТ АКТИВЕН', recent:'Последние анализы', saved:'Сохранённые матчи', strategy:'Стратегия', activity:'Активность', account:'Аккаунт', email:'Email', language:'Язык', openStrategy:'ОТКРЫТЬ СТРАТЕГИЮ', home:'НА ГЛАВНУЮ', logout:'ВЫЙТИ', emptyRecent:'Анализов пока нет. Запустите анализ матча, и они появятся здесь.', emptySaved:'Сохранённых матчей пока нет.', again:'АНАЛИЗИРОВАТЬ СНОВА', enabled:'АКТИВНА', disabled:'НЕ НАСТРОЕНА' },
    es: { kicker:'CUENTA VERTEX', title:'Mi panel', subtitle:'Tu espacio de análisis', active:'● CUENTA ACTIVA', recent:'Análisis recientes', saved:'Partidos guardados', strategy:'Estrategia', activity:'Actividad', account:'Cuenta', email:'Email', language:'Idioma', openStrategy:'ABRIR ESTRATEGIA', home:'VOLVER AL INICIO', logout:'CERRAR SESIÓN', emptyRecent:'Aún no hay análisis. Ejecuta Match Analyzer y aparecerán aquí.', emptySaved:'Aún no hay partidos guardados.', again:'ANALIZAR DE NUEVO', enabled:'ACTIVA', disabled:'NO CONFIGURADA' }
  };
  let cabinetSection = null;
  let cabinetSession = null;
  let cabinetDb = null;

  function matchName(row) { return row?.match || [row?.home_team, row?.away_team].filter(Boolean).join(' vs ') || '—'; }
  function listRows(rows, empty, buttonText) {
    if (!rows?.length) return `<div class="v8-cabinet-empty">${esc(empty)}</div>`;
    return `<div class="v8-cabinet-list">${rows.slice(0, 8).map((row) => `<div class="v8-cabinet-row"><div><strong>${esc(matchName(row))}</strong><small>${esc(row.created_at || row.date || row.savedAt || '')}</small></div><button type="button" data-v8-analyze="${esc(matchName(row))}">${esc(buttonText)}</button></div>`).join('')}</div>`;
  }

  function renderFastCabinet() {
    const copy = cabinetCopy[lang()] || cabinetCopy.en;
    const recent = readLocal('vertex_recent_analyses', []);
    const saved = readLocal('vertex_saved_analyses', []);
    const profile = readLocal('vertex_strategy_profile', null);
    if (!cabinetSection) {
      cabinetSection = document.createElement('section');
      cabinetSection.id = 'tab-cabinet-v8';
      cabinetSection.className = 'tab-content';
      document.querySelector('main.main-content')?.appendChild(cabinetSection);
    }
    document.querySelectorAll('.tab-content').forEach((node) => node.classList.remove('active'));
    document.querySelectorAll('.nav a[data-tab]').forEach((node) => node.classList.remove('active'));
    cabinetSection.classList.add('active');
    history.replaceState?.(null, '', '#/cabinet');
    cabinetSection.innerHTML = `<div class="v8-cabinet"><div class="v8-cabinet-hero"><div><span class="kicker">${esc(copy.kicker)}</span><h2>${esc(copy.title)}</h2><p>${esc(copy.subtitle)}</p></div><div class="v8-account-pill">${esc(copy.active)}</div></div><div class="v8-cabinet-stats"><div class="v8-cabinet-stat"><span>${esc(copy.recent)}</span><strong>${recent.length}</strong></div><div class="v8-cabinet-stat"><span>${esc(copy.saved)}</span><strong>${saved.length}</strong></div><div class="v8-cabinet-stat"><span>${esc(copy.strategy)}</span><strong>${esc(profile ? copy.enabled : copy.disabled)}</strong></div><div class="v8-cabinet-stat"><span>${esc(copy.activity)}</span><strong>${recent.length}</strong></div></div><div class="v8-cabinet-grid"><div><section class="v8-cabinet-panel"><h3>${esc(copy.recent)}</h3>${listRows(recent, copy.emptyRecent, copy.again)}</section><section class="v8-cabinet-panel" style="margin-top:14px"><h3>${esc(copy.saved)}</h3>${listRows(saved, copy.emptySaved, copy.again)}</section></div><aside><section class="v8-cabinet-panel"><h3>${esc(copy.account)}</h3><div class="v8-cabinet-account"><div><span>${esc(copy.email)}</span><strong id="v8CabinetEmail">${esc(cabinetSession?.user?.email || '—')}</strong></div><div><span>${esc(copy.language)}</span><strong>${esc(lang().toUpperCase())}</strong></div><div><span>${esc(copy.strategy)}</span><strong>${esc(profile ? copy.enabled : copy.disabled)}</strong></div></div><div class="v8-cabinet-actions"><button class="btn-primary" type="button" data-v8-strategy>${esc(copy.openStrategy)}</button><button class="btn-secondary" type="button" data-v8-home>${esc(copy.home)}</button><button class="btn-secondary" type="button" data-v8-logout>${esc(copy.logout)}</button></div></section></aside></div></div>`;
    window.scrollTo({ top: 0, behavior: 'auto' });
    hydrateCabinetSession();
  }

  async function hydrateCabinetSession() {
    if (cabinetSession?.user) return;
    try {
      if (!cabinetDb && window.supabase?.createClient) {
        cabinetDb = window.supabase.createClient('https://bznjdzgtiddggcdhxadj.supabase.co', 'sb_publishable_kWwttoQARBmC6H_NqsEL_A_A5I7wDON', { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false } });
      }
      const result = await Promise.race([
        cabinetDb?.auth?.getSession?.(),
        new Promise((resolve) => setTimeout(() => resolve(null), 1400))
      ]);
      cabinetSession = result?.data?.session || null;
      const email = document.getElementById('v8CabinetEmail');
      if (email && cabinetSession?.user?.email) setText(email, cabinetSession.user.email);
    } catch (_) {}
  }

  function detectPerformanceMode() {
    const cores = Number(navigator.hardwareConcurrency || 8);
    const memory = Number(navigator.deviceMemory || 8);
    if (cores <= 4 || memory <= 4) document.documentElement.classList.add('vertex-performance-lite');
  }

  function bindWindowInterceptors() {
    window.addEventListener('click', (event) => {
      const cabinet = event.target.closest?.('#btnCabinet');
      if (cabinet) {
        event.preventDefault(); event.stopImmediatePropagation();
        renderFastCabinet();
        return;
      }
      const link = event.target.closest?.('#linkAbout, #linkTerms, #linkPrivacy, #linkResponsible');
      if (link) {
        event.preventDefault(); event.stopImmediatePropagation();
        openLegal(link.id === 'linkAbout' ? 'about' : link.id === 'linkTerms' ? 'terms' : link.id === 'linkPrivacy' ? 'privacy' : 'responsible');
      }
    }, true);
  }

  document.addEventListener('click', (event) => {
    const again = event.target.closest?.('[data-v8-analyze]');
    if (again) {
      const input = document.getElementById('analyzerSearch');
      if (input) input.value = again.dataset.v8Analyze;
      document.querySelector('.nav a[data-tab="analyzer"]')?.click();
      return;
    }
    if (event.target.closest?.('[data-v8-strategy]')) document.querySelector('.nav a[data-tab="strategy"]')?.click();
    if (event.target.closest?.('[data-v8-home]')) document.querySelector('.nav a[data-tab="home"]')?.click();
    if (event.target.closest?.('[data-v8-logout]')) {
      hydrateCabinetSession().finally(() => cabinetDb?.auth?.signOut?.().finally(() => window.location.reload()));
    }
    const nav = event.target.closest?.('.nav a[data-tab]');
    if (nav) setTimeout(() => { renderStrategyProfile(); localizeStrategyScan(); removeBetaAndPolishFooter(); }, 30);
  });

  document.addEventListener('vertex:languagechange', () => {
    setTimeout(() => {
      renderStrategyProfile(); localizeStrategyScan(); removeBetaAndPolishFooter();
      if (cabinetSection?.classList.contains('active')) renderFastCabinet();
    }, 0);
  });

  function boot() {
    detectPerformanceMode();
    bindWindowInterceptors();
    renderStrategyProfile();
    localizeStrategyScan();
    removeBetaAndPolishFooter();

    const strategy = document.getElementById('strategyContent');
    if (strategy) {
      let raf = 0;
      new MutationObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { renderStrategyProfile(); localizeStrategyScan(); });
      }).observe(strategy, { childList: true, subtree: true });
    }
    setTimeout(() => { renderStrategyProfile(); removeBetaAndPolishFooter(); }, 350);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
