'use strict';

(() => {
  const core = window.VertexStrategyCore;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const lang = () => window.VertexI18n?.getLanguage?.() || 'ru';
  const copy = {
    ru: {
      title:'Моя стратегия', subtitle:'Ваш фокус. Ваш темп. Решения с объяснением.', free:'БЕСПЛАТНО', kicker:'ПЕРСОНАЛЬНЫЙ ПЛАН',
      hero:'Меньше шума.', heroAccent:'Больше смысла.', intro:'Выберите лиги, рынки и свой темп. Vertex проверит ближайшие матчи, объяснит отбор и сохранит прогнозы для проверки после игры.',
      start:'Создать мой план', guest:'Бесплатно после регистрации. Можно пользоваться без денежных ставок.',
      steps:[['Задайте фокус','До двух лиг и только интересующие вас рынки.'],['Поймите решение','Подходит, наблюдать или пропустить — с конкретными причинами.'],['Проверьте результат','Исходный прогноз сохраняется. Результат проверяется автоматически.']],
      tabs:['На неделю','Мой журнал','Настройки'], coach:'VERTEX ГОВОРИТ ПРЯМО',
      coachBase:'Хорошая стратегия умеет пропускать. Заполнять план любой ценой не будем.',
      coachFocus:'Две лиги — уже работа. Разбирайтесь в своих матчах, а не гонитесь за количеством.',
      coachLearn:'Сначала научитесь читать матч. Проверять идеи можно без денежных ставок.',
      coachCaution:'Серия неудач — повод снизить темп. Ужесточаем отбор, суммы не увеличиваем.',
      coachLimit:'План на эту неделю заполнен. Новые матчи могут подождать.',
      coachNote:'Это система правил. Она учитывает результаты вашего журнала; самообучение модели и прибыль не обещаются.',
      quality:'Порог качества данных', dataQuality:'Качество данных', excluded:'НЕ ОЦЕНИВАЕТСЯ', qualityNote:'Это полнота данных, не вероятность победы.', slots:'Матчей в плане за неделю', settled:'Проверенных матчей', limits:'ВАШИ ПРАВИЛА',
      focus:'Фокус', allLeagues:'Доступные лиги', markets:'Рынки', noMoney:'Режим наблюдения без денежных ставок', cap:'Ваш верхний лимит на одну ставку', capNote:'Личный потолок, а не рекомендация поставить эту сумму. Vertex ставок не совершает.',
      scanTitle:'Матчи под ваш профиль', scanIntro:'Ближайшие 7 дней. Проверяем по 6 матчей за проход, используем текущие источники анализа. Подходящих матчей может оказаться ноль.', scan:'Обновить подбор', next:'Проверить следующие', scanning:'Проверяем матч', of:'из', stop:'Остановить',
      empty:'Подтверждённых ближайших матчей по этим фильтрам сейчас нет. Измените лиги или проверьте позже.',
      notScanned:'Подбор обновится автоматически при открытии плана. Можно запустить проверку сейчас.',
      noProfile:'Сначала настройте профиль.', noCandidates:'Матч не проверен', analyze:'Открыть анализ', track:'В мой журнал', tracked:'В журнале',
      statuses:{ FIT:'ПОДХОДИТ', WATCH:'НАБЛЮДАТЬ', PASS:'ПРОПУСТИТЬ' }, probability:'вероятность модели', why:'Почему такое решение', sources:'История и контекст', history:'Матчей в истории',
      missingSources:'Источник не указан', noOdds:'Коэффициенты букмекеров не сравниваются. Выгодность ставки не оценена.',
      reason:{ no_fixture:'Ближайший матч не подтверждён расписанием.', started:'Матч уже начался или завершён.', outside_week:'Матч за пределами ближайших семи дней.', fixture_changed:'Дата в анализе отличается от расписания. Нужна повторная проверка.', league:'Матч не соответствует выбранным лигам.', no_model:'Данных для расчёта модели недостаточно.', quality:'Качество данных ниже вашего порога.', history:'Менее пяти проверенных матчей хотя бы у одной команды.', market:'Выбранные рынки недоступны для автоматического отбора.', probability:'Вероятность ниже порога вашего профиля.', event_markets:'Угловые и карточки доступны в полном анализе при наличии статистики; автоматический журнал их пока не оценивает.', squads:'Подтверждённые составы и полный список травм недоступны.', lineups_soon:'До начала менее трёх часов, составы ещё не подтверждены.', early:'До матча более трёх дней. Перепроверьте ближе к началу.', stale:'Использован более старый расчёт. Перепроверьте перед матчем.', weekly_limit:'Достигнут ваш недельный лимит наблюдений.', criteria:'Подходит по лиге, рынку, истории и вашим порогам данных и вероятности.' },
      journal:'Мой журнал', journalIntro:'Показаны последние 150 записей; сводка рассчитана по ним. Один исходный прогноз на матч. Здесь учитываются наблюдения, а не реальные ставки или доход.', journalEmpty:'Пока записей нет. Добавьте интересующий матч из недельного подбора.',
      win:'ПРОГНОЗ СБЫЛСЯ', loss:'НЕ СБЫЛСЯ', pending:'ОЖИДАЕМ РЕЗУЛЬТАТ', checked:'Проверено', matches:'матчей', correct:'Сбылись', week:'За неделю', total:'Всего в журнале', waiting:'Ожидают проверки', weeklyReview:'НЕДЕЛЬНЫЙ РАЗБОР',
      smallSample:'Меньше 20 завершённых наблюдений — процент успеха пока не показываем. Даже большая выборка требует отдельной проверки по рынкам.', reviewNote:'После каждого подтверждённого результата разбор пересчитывается. При 3 неудачах подряд и минимум 6 результатах порог качества повышается на 5 пунктов, недельный лимит временно уменьшается вдвое.',
      updateNote:'Результаты сверяются ежедневно. Разбор обновляется при открытии и каждую минуту, пока вкладка активна. Недельный счётчик — с понедельника, UTC.',
      settings:'Настройте свой план', settingsIntro:'Начните с фокуса и небольшого числа наблюдений. Любую настройку можно изменить.',
      experience:'Ваш опыт', risk:'Строгость отбора', objective:'Цель', bankroll:'Банк для расчёта лимита (необязательно)', bankrollHelp:'0 — наблюдение без денежных ставок. Доход и срок удвоения не рассчитываются.', currency:'Валюта', stake:'Ваш потолок на одну ставку, %', stakeHelp:'От 0,1% до 2%. Никогда автоматически не увеличивается после проигрыша.', weekly:'Максимум наблюдений в неделю', leagues:'Лиги — максимум две', leagueHelp:'Ничего не выбрано — все лиги из доступного расписания. Покрытие источников ограничено.', noLeagues:'Список лиг временно недоступен. Существующие настройки сохранены.', marketHelp:'1X2, тотал 2,5, обе забьют и двойной шанс поддерживают автоматическую проверку. Выберите хотя бы один рынок.', save:'Сохранить план', saving:'Сохраняем…', cancel:'Назад',
      saved:'План сохранён в аккаунте.', loading:'Загружаем ваш план…', error:'Не удалось загрузить данные. Попробуйте ещё раз.', retry:'Повторить',
      errors:{ CHOOSE_MARKETS:'Выберите хотя бы один рынок.', PROFILE_REQUIRED:'Сначала сохраните профиль.', FORECAST_UNAVAILABLE:'Исходный предматчевый прогноз недоступен или матч уже начался.', PROFILE_MISMATCH:'Сохранённый исходный прогноз не проходит ваши текущие фильтры.', WEEKLY_LIMIT:'Недельный лимит заполнен.', AUTH_REQUIRED:'Войдите, чтобы пользоваться стратегией.', STORAGE_UNAVAILABLE:'Не удалось сохранить данные в аккаунте. Попробуйте ещё раз.', RATE_LIMITED:'Лимит запросов достигнут. Повторите позже.' },
      options:{ Beginner:'Новичок', Intermediate:'Есть опыт', Advanced:'Опытный', Conservative:'Строгий', Balanced:'Сбалансированный', Aggressive:'Расширенный', 'Protect bankroll':'Контроль риска', 'Controlled growth':'Дисциплина решений', 'Learn disciplined analysis':'Учиться анализировать', 'Double Chance':'Двойной шанс', Goals:'Тотал 2,5', BTTS:'Обе забьют', Corners:'Угловые', Cards:'Карточки' },
      picks:{ HOME:'Победа хозяев', DRAW:'Ничья', AWAY:'Победа гостей', OVER:'Тотал больше 2,5', UNDER:'Тотал меньше 2,5', YES:'Обе забьют — да', NO:'Обе забьют — нет', '1X':'Хозяева или ничья', X2:'Гости или ничья', '12':'Без ничьей' },
      initial:'В журнал попадёт первый сохранённый предматчевый прогноз. При повторном анализе вероятности могут отличаться.', counted:'проверенных наблюдений', noLearning:'Результат одного матча не доказывает ошибку решения.',
    },
    en: {
      title:'My strategy', subtitle:'Your focus. Your pace. Decisions explained.', free:'FREE', kicker:'PERSONAL PLAN', hero:'Less noise.', heroAccent:'More insight.', intro:'Choose leagues, markets and your pace. Vertex checks upcoming games, explains the selection and saves forecasts to review after the match.', start:'Create my plan', guest:'Free with an account. No monetary betting required.',
      steps:[['Set your focus','Up to two leagues and the markets you care about.'],['Understand each decision','Fit, watch or pass — with specific reasons.'],['Review the result','The original forecast is preserved. Results are checked automatically.']],
      tabs:['This week','My journal','Settings'], coach:'VERTEX, STRAIGHT UP', coachBase:'A good strategy knows when to pass. We will not fill your plan at any cost.', coachFocus:'Two leagues are already work. Understand your matches before adding more.', coachLearn:'Learn to read the match first. You can test ideas without betting money.', coachCaution:'A losing run calls for a slower pace. We tighten the filter, not increase stakes.', coachLimit:'Your weekly plan is full. More matches can wait.', coachNote:'A rule-based system using your journal results. No promised self-learning or profit.',
      quality:'Minimum data quality', dataQuality:'Data quality', excluded:'NOT EVALUATED', qualityNote:'Data completeness, not the chance of winning.', slots:'Matches in your weekly plan', settled:'Settled matches', limits:'YOUR RULES', focus:'Focus', allLeagues:'Available leagues', markets:'Markets', noMoney:'Observation mode — no monetary betting', cap:'Your maximum per bet', capNote:'A personal ceiling, not a suggested stake. Vertex does not place bets.',
      scanTitle:'Matches for your profile', scanIntro:'Next 7 days. Up to 6 checks per scan, using the current analysis sources. There may be no suitable matches.', scan:'Refresh selection', next:'Check next matches', scanning:'Checking match', of:'of', stop:'Stop', empty:'No confirmed upcoming matches match these filters. Change leagues or check later.', notScanned:'Selection refreshes automatically when you open your plan. You can also start a check now.', noProfile:'Set up your profile first.', noCandidates:'Not checked', analyze:'Open analysis', track:'Add to journal', tracked:'In journal', statuses:{FIT:'FIT',WATCH:'WATCH',PASS:'PASS'}, probability:'model probability', why:'Why this decision', sources:'History and context', history:'History sample', missingSources:'Source not specified', noOdds:'Bookmaker odds are not compared. Betting value has not been assessed.',
      reason:{ no_fixture:'No confirmed upcoming fixture.', started:'The match has started or finished.', outside_week:'Outside the next seven days.', fixture_changed:'Analysis date differs from the schedule. Recheck required.', league:'Outside your selected leagues.', no_model:'Insufficient data for the model.', quality:'Data quality below your threshold.', history:'Fewer than five verified matches for at least one team.', market:'Selected markets are unavailable for automatic selection.', probability:'Probability below your profile threshold.', event_markets:'Corners and cards appear in full analysis where covered; automatic journal evaluation is not yet available for them.', squads:'Confirmed lineups and complete injury coverage unavailable.', lineups_soon:'Less than three hours to kickoff; lineups not confirmed.', early:'More than three days until kickoff. Recheck closer to the game.', stale:'An older calculation was used. Recheck before kickoff.', weekly_limit:'Your weekly observation limit is reached.', criteria:'Meets your league, market, history, quality and probability criteria.' },
      journal:'My journal', journalIntro:'Showing the latest 150 entries; the review uses this sample. One original forecast per match. These are observations, not actual bets or earnings.', journalEmpty:'No entries yet. Add a match from your weekly selection.', win:'CORRECT', loss:'INCORRECT', pending:'AWAITING RESULT', checked:'Checked', matches:'matches', correct:'Correct', week:'This week', total:'Journal total', waiting:'Awaiting results', weeklyReview:'WEEKLY REVIEW', smallSample:'Fewer than 20 settled observations: a success percentage is not shown yet. Larger samples still need separate analysis by market.', reviewNote:'Review recalculates after each confirmed outcome. Three consecutive misses with at least six results raise the quality threshold by five points and temporarily halve the weekly limit.', updateNote:'Results are checked daily. Review refreshes when opened and every minute while this tab is active. Weeks start Monday, UTC.',
      settings:'Make it your plan', settingsIntro:'Start with a focus and a small number of observations. You can change every setting.', experience:'Experience', risk:'Selection strictness', objective:'Objective', bankroll:'Bankroll for your limit (optional)', bankrollHelp:'0 means observation without monetary betting. No earnings or doubling-time estimates.', currency:'Currency', stake:'Your maximum per bet, %', stakeHelp:'0.1% to 2%. Never automatically increased after a loss.', weekly:'Maximum weekly observations', leagues:'Leagues — up to two', leagueHelp:'None selected means all leagues in the available schedule. Provider coverage is limited.', noLeagues:'Leagues temporarily unavailable. Your existing preferences are retained.', marketHelp:'1X2, goals 2.5, BTTS and double chance support automatic evaluation. Choose at least one market.', save:'Save plan', saving:'Saving…', cancel:'Back', saved:'Plan saved to your account.', loading:'Loading your plan…', error:'Unable to load data. Please try again.', retry:'Retry', errors:{ CHOOSE_MARKETS:'Choose at least one market.', PROFILE_REQUIRED:'Save your profile first.', FORECAST_UNAVAILABLE:'Original forecast unavailable or kickoff has passed.', PROFILE_MISMATCH:'The original saved forecast does not meet your current filters.', WEEKLY_LIMIT:'Weekly limit reached.', AUTH_REQUIRED:'Sign in to use your strategy.', STORAGE_UNAVAILABLE:'Could not save to your account. Please retry.', RATE_LIMITED:'Request limit reached. Try later.' },
      options:{ Beginner:'Beginner', Intermediate:'Intermediate', Advanced:'Advanced', Conservative:'Strict', Balanced:'Balanced', Aggressive:'Expanded', 'Protect bankroll':'Risk control', 'Controlled growth':'Decision discipline', 'Learn disciplined analysis':'Learn match analysis', 'Double Chance':'Double chance', Goals:'Goals 2.5', BTTS:'Both teams to score', Corners:'Corners', Cards:'Cards' }, picks:{HOME:'Home win',DRAW:'Draw',AWAY:'Away win',OVER:'Over 2.5 goals',UNDER:'Under 2.5 goals',YES:'Both teams score — yes',NO:'Both teams score — no','1X':'Home or draw',X2:'Away or draw','12':'No draw'}, initial:'Your journal uses the first saved pre-match forecast. Probabilities may differ in a later analysis.', counted:'settled observations', noLearning:'One match result does not prove a decision was wrong.'
    },
    es: {
      title:'Mi estrategia', subtitle:'Tu enfoque. Tu ritmo. Decisiones explicadas.', free:'GRATIS', kicker:'PLAN PERSONAL', hero:'Menos ruido.', heroAccent:'Más criterio.', intro:'Elige ligas, mercados y tu ritmo. Vertex revisa los próximos partidos, explica la selección y guarda los pronósticos para comprobarlos al final.', start:'Crear mi plan', guest:'Gratis con una cuenta. No es necesario apostar dinero.', steps:[['Elige tu enfoque','Hasta dos ligas y tus mercados preferidos.'],['Entiende la decisión','Encaja, observar o pasar, con motivos concretos.'],['Revisa el resultado','El pronóstico original se conserva. Comprobación automática de resultados.']],
      tabs:['Esta semana','Mi registro','Ajustes'], coach:'VERTEX HABLA CLARO', coachBase:'Una buena estrategia sabe pasar. No llenaremos el plan a cualquier precio.', coachFocus:'Dos ligas ya exigen trabajo. Entiende tus partidos antes de añadir más.', coachLearn:'Primero aprende a leer el partido. Puedes probar ideas sin apostar dinero.', coachCaution:'Una mala racha pide bajar el ritmo. Endurecemos el filtro, sin subir las apuestas.', coachLimit:'Tu plan semanal está completo. Los demás partidos pueden esperar.', coachNote:'Sistema de reglas que considera tu registro. Sin promesas de autoaprendizaje ni beneficio.', quality:'Calidad mínima de datos', dataQuality:'Calidad de datos', excluded:'SIN EVALUACIÓN', qualityNote:'Cobertura de datos, no probabilidad de ganar.', slots:'Partidos en tu plan semanal', settled:'Partidos comprobados', limits:'TUS REGLAS', focus:'Enfoque', allLeagues:'Ligas disponibles', markets:'Mercados', noMoney:'Modo observación sin apostar dinero', cap:'Tu máximo por apuesta', capNote:'Un límite personal, no una apuesta recomendada. Vertex no realiza apuestas.', scanTitle:'Partidos para tu perfil', scanIntro:'Próximos 7 días. Hasta 6 partidos por revisión, con las fuentes actuales. Puede que ninguno cumpla los criterios.', scan:'Actualizar selección', next:'Revisar siguientes', scanning:'Revisando partido', of:'de', stop:'Detener', empty:'No hay próximos partidos confirmados para estos filtros. Cambia las ligas o vuelve más tarde.', notScanned:'La selección se actualiza al abrir el plan. También puedes iniciar la revisión ahora.', noProfile:'Configura tu perfil primero.', noCandidates:'Sin comprobar', analyze:'Abrir análisis', track:'Añadir al registro', tracked:'En el registro', statuses:{FIT:'ENCAJA',WATCH:'OBSERVAR',PASS:'PASAR'}, probability:'probabilidad del modelo', why:'Motivos de la decisión', sources:'Historial y contexto', history:'Muestra de partidos', missingSources:'Fuente no indicada', noOdds:'No se comparan cuotas de casas de apuestas. No se ha evaluado el valor de la apuesta.',
      reason:{no_fixture:'No hay próximo partido confirmado.',started:'El partido ha empezado o terminado.',outside_week:'Fuera de los próximos siete días.',fixture_changed:'La fecha del análisis difiere del calendario. Hay que revisarla.',league:'Fuera de tus ligas elegidas.',no_model:'Datos insuficientes para el modelo.',quality:'Calidad inferior a tu umbral.',history:'Menos de cinco partidos verificados para algún equipo.',market:'Mercados no disponibles para selección automática.',probability:'Probabilidad inferior al umbral de tu perfil.',event_markets:'Córners y tarjetas se muestran en el análisis completo cuando hay datos; el registro aún no los evalúa automáticamente.',squads:'Sin alineaciones confirmadas ni cobertura completa de lesiones.',lineups_soon:'Menos de tres horas para el inicio, sin alineaciones confirmadas.',early:'Faltan más de tres días. Revísalo más cerca del partido.',stale:'Cálculo antiguo. Revisa antes del inicio.',weekly_limit:'Has alcanzado tu límite semanal.',criteria:'Cumple tus criterios de liga, mercado, historial, calidad y probabilidad.'},
      journal:'Mi registro',journalIntro:'Se muestran las últimas 150 entradas; el resumen utiliza esta muestra. Un pronóstico original por partido. Son observaciones, no apuestas reales ni ganancias.',journalEmpty:'Aún no hay entradas. Añade un partido de tu selección semanal.',win:'ACERTADO',loss:'NO ACERTADO',pending:'ESPERANDO RESULTADO',checked:'Comprobado',matches:'partidos',correct:'Acertados',week:'Esta semana',total:'Total del registro',waiting:'Pendientes',weeklyReview:'REVISIÓN SEMANAL',smallSample:'Menos de 20 observaciones resueltas: aún no mostramos un porcentaje de acierto. Una muestra mayor también necesita revisión por mercado.',reviewNote:'Se recalcula tras cada resultado confirmado. Tres fallos seguidos con al menos seis resultados elevan el umbral de calidad cinco puntos y reducen temporalmente el límite semanal a la mitad.',updateNote:'Los resultados se comprueban diariamente. La revisión se actualiza al abrir y cada minuto con esta pestaña activa. La semana empieza el lunes, UTC.',settings:'Configura tu plan',settingsIntro:'Empieza con un enfoque y pocas observaciones. Puedes cambiar todos los ajustes.',experience:'Experiencia',risk:'Exigencia de selección',objective:'Objetivo',bankroll:'Banca para calcular tu límite (opcional)',bankrollHelp:'0: observación sin apostar dinero. Sin estimaciones de beneficio ni de duplicación.',currency:'Moneda',stake:'Tu máximo por apuesta, %',stakeHelp:'Entre 0,1% y 2%. Nunca aumenta automáticamente tras una pérdida.',weekly:'Máximo de observaciones por semana',leagues:'Ligas: hasta dos',leagueHelp:'Ninguna seleccionada: todas las ligas del calendario disponible. La cobertura es limitada.',noLeagues:'Ligas no disponibles temporalmente. Conservamos tus preferencias.',marketHelp:'1X2, goles 2,5, ambos marcan y doble oportunidad admiten evaluación automática. Elige al menos un mercado.',save:'Guardar plan',saving:'Guardando…',cancel:'Volver',saved:'Plan guardado en tu cuenta.',loading:'Cargando tu plan…',error:'No se han podido cargar los datos. Inténtalo de nuevo.',retry:'Reintentar',errors:{CHOOSE_MARKETS:'Elige al menos un mercado.',PROFILE_REQUIRED:'Guarda tu perfil primero.',FORECAST_UNAVAILABLE:'Pronóstico original no disponible o partido ya iniciado.',PROFILE_MISMATCH:'El pronóstico original no cumple tus filtros actuales.',WEEKLY_LIMIT:'Límite semanal alcanzado.',AUTH_REQUIRED:'Inicia sesión para usar tu estrategia.',STORAGE_UNAVAILABLE:'No se pudo guardar. Inténtalo de nuevo.',RATE_LIMITED:'Límite de solicitudes alcanzado. Vuelve más tarde.'},options:{Beginner:'Principiante',Intermediate:'Intermedio',Advanced:'Avanzado',Conservative:'Estricto',Balanced:'Equilibrado',Aggressive:'Ampliado','Protect bankroll':'Control de riesgo','Controlled growth':'Disciplina de decisiones','Learn disciplined analysis':'Aprender análisis','Double Chance':'Doble oportunidad',Goals:'Goles 2,5',BTTS:'Ambos marcan',Corners:'Córners',Cards:'Tarjetas'},picks:{HOME:'Victoria local',DRAW:'Empate',AWAY:'Victoria visitante',OVER:'Más de 2,5 goles',UNDER:'Menos de 2,5 goles',YES:'Ambos marcan: sí',NO:'Ambos marcan: no','1X':'Local o empate',X2:'Visitante o empate','12':'Sin empate'},initial:'El registro utiliza el primer pronóstico guardado antes del partido. Las probabilidades pueden cambiar en análisis posteriores.',counted:'observaciones comprobadas',noLearning:'Un resultado no demuestra por sí solo que la decisión fuera errónea.'
    }
  };
  let owner = null, epoch = 0, loaded = false, pendingLoad = null, model = {profile:null,journal:[],review:core.review([])};
  let panel = 'week', schedule = null, cards = [], cursor = 0, batchEnd = 0, running = false, scanAbort = null, scanEpoch = 0, lastScan = 0, error = '', notice = '', draft = null;
  const c = () => copy[lang()] || copy.en;
  const root = () => document.getElementById('strategyContent');
  const active = () => document.getElementById('tab-strategy')?.classList.contains('active');
  const date = value => value ? new Intl.DateTimeFormat(lang(),{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : '—';
  const label = v => c().options[v] || v;
  const button = (action, text, primary=false, extra='') => `<button type="button" class="vs-button ${primary?'primary':''}" data-vs="${action}" ${extra}>${esc(text)}</button>`;
  const metric = (value, text) => `<div class="vs-metric"><strong>${esc(value)}</strong><span>${esc(text)}</span></div>`;
  const message = e => c().errors[e?.message] || (e?.status===429 ? c().errors.RATE_LIMITED : c().error);
  async function request(path, options = {}) {
    const response = await fetch(path, {...options, headers:{'Content-Type':'application/json', ...options.headers}});
    const data = await response.json().catch(()=>({}));
    if (!response.ok) { const e = new Error(data.code || data.error || 'REQUEST_FAILED'); e.status=response.status; throw e; }
    return data;
  }
  function accept(data) { model=data; loaded=true; if (data.profile) localStorage.setItem('vertex_strategy_profile',JSON.stringify(data.profile)); }
  function coach() {
    const p=model.profile, r=core.rules(p,model.review);
    return model.review.cautious ? c().coachCaution : model.review.weeklySelected>=r.weeklyLimit ? c().coachLimit : p.bankroll===0 || p.experience==='Beginner' ? c().coachLearn : p.leagues.length===2 ? c().coachFocus : c().coachBase;
  }
  function render() {
    const el=root(); if(!el) return;
    const t=c(), p=model.profile;
    const heading=document.querySelector('#tab-strategy .section-heading');
    if(heading) { heading.querySelector('.kicker').textContent=t.kicker; heading.querySelector('h2').textContent=t.title; heading.querySelector('p').textContent=t.subtitle; }
    el.className='vs-root';
    if(!owner || (loaded&&!p&&panel!=='settings')) {
      el.innerHTML=`<div class="vs-hero"><div><span class="vs-tag">${t.free}</span><h3>${t.hero}<span>${t.heroAccent}</span></h3><p>${t.intro}</p><div class="vs-actions">${button('setup',t.start,true)}</div><p class="vs-mini" style="margin-top:14px">${t.guest}</p></div><div class="vs-steps">${t.steps.map((s,i)=>`<div class="vs-step"><b>0${i+1}</b><div><h4>${s[0]}</h4><p>${s[1]}</p></div></div>`).join('')}</div></div>`;
    } else if(!loaded) el.innerHTML=`<div class="vs-empty">${error?esc(error):t.loading}${error?`<div class="vs-actions">${button('retry',t.retry)}</div>`:''}</div>`;
    else {
      el.innerHTML=`<div class="vs-toolbar"><div class="vs-tabs" role="tablist" aria-label="${esc(t.title)}">${['week','journal','settings'].map((v,i)=>`<button type="button" role="tab" data-vs="tab" data-panel="${v}" aria-selected="${panel===v}">${t.tabs[i]}</button>`).join('')}</div><span class="vs-tag">${t.free}</span></div>${panel==='settings'?formHTML():panel==='journal'?journalHTML():weekHTML()}${notice?`<p class="vs-notice" role="status">${esc(notice)}</p>`:''}${error?`<p class="vs-notice error" role="alert">${esc(error)} ${button('retry',t.retry)}</p>`:''}`;
    }
  }
  function weekHTML() {
    if(!model.profile) return `<div class="vs-empty">${c().noProfile}${button('setup',c().start)}</div>`;
    const t=c(), p=model.profile, r=core.rules(p,model.review);
    return `<div class="vs-grid"><section class="vs-panel vs-coach"><span class="vs-kicker">${t.coach}</span><blockquote>«${esc(coach())}»</blockquote><p class="vs-mini">${t.coachNote}</p><div class="vs-metrics">${metric(`${r.quality}%`,t.quality)}${metric(`${model.review.weeklySelected} / ${r.weeklyLimit}`,t.slots)}${metric(model.review.settled,t.settled)}</div></section><aside class="vs-panel"><span class="vs-kicker">${t.limits}</span><h3>${esc(label(p.risk))}</h3><ul class="vs-list"><li>${t.focus}: ${esc(p.leagues.length?p.leagues.map(x=>x.replace('|',' · ')).join(', '):t.allLeagues)}</li><li>${t.markets}: ${esc(p.markets.map(label).join(', '))}</li><li>${r.cap==null?t.noMoney:`${t.cap}: ${esc(new Intl.NumberFormat(lang(),{style:'currency',currency:p.settings.currency}).format(r.cap))} (${p.settings.stakeCapPct}%)`}</li></ul><p class="vs-mini" style="margin-top:16px">${r.cap==null?t.qualityNote:t.capNote}</p></aside></div><div class="vs-section-head"><div><h3>${t.scanTitle}</h3><p>${t.scanIntro}</p></div>${running?button('stop',t.stop):button('scan',t.scan)}</div>${running?`<div class="vs-progress" role="status" aria-live="polite"><span class="vs-spinner" aria-hidden="true"></span>${t.scanning} ${cursor+1} ${t.of} ${batchEnd || "…"}</div>`:''}<div class="vs-cards">${cards.map(cardHTML).join('')}</div>${!cards.length&&!running?`<div class="vs-empty">${lastScan?t.empty:t.notScanned}</div>`:''}${!running&&schedule&&cursor<core.fixtures(schedule.matches,p).length?`<div class="vs-actions">${button('next',t.next)}</div>`:''}<p class="vs-notice">${t.noOdds}<br>${t.initial}</p>`;
  }
  function cardHTML(item,index) {
    const t=c(), a=item.analysis, result=a?core.assess(a,model.profile,model.review,Date.now(),item.fixture):null;
    const pick=result?.pick, tracked=model.journal.some(x=>x.fixture_key===item.key);
    const reasons=result?[...result.reasons,...result.warnings].map(x=>t.reason[x]).filter(Boolean):[item.error||t.noCandidates];
    return `<article class="vs-card"><header><span>${esc(item.fixture.league||'')}<br>${esc(date(item.fixture.date))}</span><span class="vs-status ${result?.status||'PASS'}">${t.statuses[result?.status||'PASS']}</span></header><h4>${esc(a?.teams?.home?.name||item.fixture.home)} — ${esc(a?.teams?.away?.name||item.fixture.away)}</h4>${pick?`<div class="vs-pick"><b>${esc(t.picks[pick.value]||pick.value)}</b><div><strong>${Math.round(pick.probability)}%</strong><small>${t.probability}</small></div></div>`:''}<div class="vs-card-meta">${result?`${t.dataQuality}: ${result.quality}% · ${t.history}: ${result.samples.home} / ${result.samples.away}`:''}</div><details open><summary>${t.why}</summary><ul class="vs-list">${reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${result?`<p class="vs-mini">${t.sources}: ${esc(result.sources.join(' · ')||t.missingSources)}</p>`:''}</details><footer>${result&&result.status!=='PASS'&&pick&&item.key?button('track',tracked?t.tracked:t.track,true,`data-index="${index}" ${tracked||model.review.weeklySelected>=result.rules.weeklyLimit?'disabled':''}`):''}<button type="button" class="vs-button" data-analyze-match="${esc(`${item.fixture.home} vs ${item.fixture.away}`)}">${t.analyze}</button></footer></article>`;
  }
  function journalHTML() {
    const t=c(), rv=model.review;
    return `<section class="vs-panel"><span class="vs-kicker">${t.weeklyReview}</span><h3>${esc(model.profile?coach():t.journal)}</h3><div class="vs-metrics">${metric(`${rv.weeklyCorrect} / ${rv.weeklySettled}`,`${t.week} · ${t.correct}`)}${metric(rv.settled,`${t.total} · ${t.checked}`)}${metric(rv.pending,t.waiting)}</div><p style="margin-top:18px" class="vs-mini">${rv.accuracy==null?t.smallSample:`${rv.accuracy}% · ${rv.settled} ${t.counted}. ${t.noLearning}`}</p><p class="vs-mini" style="margin-top:10px">${t.reviewNote}</p>${Object.entries(rv.byMarket).length?`<ul class="vs-list">${Object.entries(rv.byMarket).map(([market,s])=>`<li>${esc(label(Object.keys(core.marketIds).find(k=>core.marketIds[k]===market)||market))}: ${s.correct} / ${s.settled}</li>`).join('')}</ul>`:''}</section><div class="vs-section-head"><div><h3>${t.journal}</h3><p>${t.journalIntro}</p></div>${button('refresh',t.retry)}</div><div class="vs-cards">${model.journal.map(j=>{const e=j.evaluation||{}, f=e.forecast||{}; const decided=typeof e.is_correct==='boolean'; const excluded=String(e.evaluation_status||'').startsWith('excluded_'); return `<article class="vs-card"><header><span>${esc(date(e.fixture_date))}</span><span class="vs-status ${!decided?'WATCH':e.is_correct?'FIT':'PASS'}">${excluded?t.excluded:!decided?t.pending:e.is_correct?t.win:t.loss}</span></header><h4>${esc(f.teams?.home?.name||'—')} — ${esc(f.teams?.away?.name||'—')}</h4><div class="vs-pick"><b>${esc(t.picks[e.predicted_value]||e.predicted_value)}</b><div><strong>${esc(e.predicted_probability)}%</strong><small>${t.probability}</small></div></div><p class="vs-mini">${esc(e.model_version||'—')} · ${t.dataQuality}: ${esc(e.data_quality)}%</p>${e.evaluated_at?`<p class="vs-mini">${t.checked}: ${esc(date(e.evaluated_at))} · ${esc(e.evaluation_source||'')}</p>`:''}</article>`;}).join('')}</div>${!model.journal.length?`<div class="vs-empty">${t.journalEmpty}</div>`:''}<p class="vs-notice">${t.updateNote}</p>`;
  }
  function formHTML() {
    const t=c(), p=draft||model.profile||core.profile({markets:['1X2','Goals']});
    const options = (values, selected) => values.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(label(v))}</option>`).join('');
    const field = (id,text,html,help='') => `<div class="vs-field"><label for="${id}">${text}</label>${html}${help?`<small>${help}</small>`:''}</div>`;
    const leagues=[...new Set([...(schedule?.matches||[]).map(core.leagueKey).filter(x=>x!=='|'),...p.leagues])].sort();
    return `<form class="vs-panel vs-form" id="vsProfileForm"><span class="vs-kicker">${t.free}</span><h3>${t.settings}</h3><p>${t.settingsIntro}</p><div class="vs-form-grid">${field('vsExperience',t.experience,`<select id="vsExperience" name="experience">${options(['Beginner','Intermediate','Advanced'],p.experience)}</select>`)}${field('vsRisk',t.risk,`<select id="vsRisk" name="risk">${options(['Conservative','Balanced','Aggressive'],p.risk)}</select>`)}${field('vsObjective',t.objective,`<select id="vsObjective" name="objective">${options(['Learn disciplined analysis','Protect bankroll','Controlled growth'],p.objective)}</select>`)}${field('vsWeekly',t.weekly,`<input id="vsWeekly" name="weeklyLimit" type="number" required min="1" max="6" step="1" value="${p.settings.weeklyLimit}">`)}<fieldset class="vs-field full"><legend>${t.markets}</legend><div class="vs-chips">${core.MARKETS.map(m=>`<label class="vs-check"><input type="checkbox" name="markets" value="${esc(m)}" ${p.markets.includes(m)?'checked':''}>${esc(label(m))}</label>`).join('')}</div><small>${t.marketHelp}</small></fieldset><fieldset class="vs-field full"><legend>${t.leagues}</legend><div class="vs-chips">${leagues.map(l=>`<label class="vs-check"><input type="checkbox" name="leagues" value="${esc(l)}" ${p.leagues.includes(l)?'checked':''}>${esc(l.replace('|',' · '))}</label>`).join('')}</div><small>${schedule?t.leagueHelp:t.noLeagues}</small></fieldset>${field('vsBankroll',t.bankroll,`<input id="vsBankroll" name="bankroll" type="number" min="0" max="100000000" step="0.01" value="${p.bankroll}">`,t.bankrollHelp)}${field('vsCurrency',t.currency,`<select id="vsCurrency" name="currency">${options(['EUR','USD','RUB','GBP'],p.settings.currency)}</select>`)}${field('vsStake',t.stake,`<input id="vsStake" name="stakeCapPct" type="number" required min="0.1" max="2" step="0.1" value="${p.settings.stakeCapPct}">`,t.stakeHelp)}</div><div class="vs-actions"><button class="vs-button primary" type="submit">${t.save}</button>${button('cancel',t.cancel)}</div></form>`;
  }
  function readForm() {
    const form=document.getElementById('vsProfileForm'); if(!form) return null;
    const f=new FormData(form);
    return core.profile({bankroll:f.get('bankroll'),risk:f.get('risk'),experience:f.get('experience'),objective:f.get('objective'),markets:f.getAll('markets'),leagues:f.getAll('leagues'),settings:{weeklyLimit:f.get('weeklyLimit'),currency:f.get('currency'),stakeCapPct:f.get('stakeCapPct')}});
  }
  async function load(silent=false) {
    if(!owner) return;
    if(pendingLoad) return pendingLoad;
    const expected=epoch;
    pendingLoad=(async()=>{
      try { const data=await request('/api/strategy'); if(expected!==epoch)return; accept(data); error=''; if(panel!=='settings')render(); }
      catch(e){ if(expected===epoch&&!silent){error=message(e);render();} }
      finally{if(expected===epoch)pendingLoad=null;}
    })();
    await pendingLoad;
  }
  async function getSchedule() {
    const expected=epoch;
    const data=await request('/api/upcoming');
    if(expected!==epoch)return;
    schedule=data;
  }
  async function setup() {
    if(!window.VertexAccess.requireAccount('strategy'))return;
    panel='settings'; draft=model.profile; render(); const expected=epoch;
    try { if(!schedule) { await getSchedule(); if(expected===epoch&&panel==='settings'){draft=readForm();render();} } } catch(_) { /* Existing profile remains editable even if schedule is down. */ }
  }
  async function scan(reset=true) {
    if(!owner||!model.profile||running)return;
    const expected=epoch, thisScan=++scanEpoch;
    running=true;error='';scanAbort=new AbortController();
    if(reset){cards=[];cursor=0;batchEnd=0;} render();
    try {
      if(reset||!schedule) await getSchedule();
      if(expected!==epoch||thisScan!==scanEpoch)return;
      const candidates=core.fixtures(schedule?.matches,model.profile); const end=batchEnd=Math.min(cursor+6,candidates.length);
      while(cursor<end && running && expected===epoch && thisScan===scanEpoch) {
        const fixture=candidates[cursor];render();
        try {
          const data=await request('/api/analyze',{method:'POST',body:JSON.stringify({home:fixture.home,away:fixture.away}),signal:scanAbort.signal});
          if(expected!==epoch||thisScan!==scanEpoch)return;
          const a=data.analysis; const slug=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90);
          const key=a?.fixture?.date?`${new Date(a.fixture.date).toISOString()}|${slug(a.teams?.home?.name)}|${slug(a.teams?.away?.name)}`:null;
          cards.push({fixture,analysis:a,key});
        } catch(e) {
          if(expected!==epoch||thisScan!==scanEpoch)return;
          if(e.name==='AbortError')break;
          if(e.status===429||e.status===401){error=message(e);break;}
          cards.push({fixture,error:message(e)});
        }
        cursor++;
      }
      if(expected===epoch&&thisScan===scanEpoch)lastScan=Date.now();
    } catch(e){if(expected===epoch&&thisScan===scanEpoch)error=message(e);}
    finally{if(expected===epoch&&thisScan===scanEpoch){running=false;render();}}
  }
  function stop() {running=false;scanEpoch++;scanAbort?.abort();render();}
  async function mount(userId) {
    if(owner===(userId||null) && panel==='settings') draft=readForm() || draft;
    if(owner!==(userId||null)) {stop();owner=userId||null;epoch++;pendingLoad=null;loaded=false;model={profile:null,journal:[],review:core.review([])};panel='week';cards=[];schedule=null;lastScan=0;error='';notice='';draft=null;localStorage.removeItem('vertex_strategy_profile');}
    render(); if(!owner)return;
    if(!loaded)await load();
    if(active()&&panel==='week'&&model.profile&&Date.now()-lastScan>6*3600000)scan();
  }
  document.addEventListener('click',async event=>{
    const b=event.target.closest('[data-vs]');if(!b)return;
    const action=b.dataset.vs;
    if(action==='setup')return setup();
    if(!owner)return;
    if(action==='tab'){if(running)stop();draft=panel==='settings'?readForm():draft;panel=b.dataset.panel;notice='';error='';if(panel==='settings')return setup();render();if(panel==='journal')load(true);return;}
    if(action==='cancel'){panel='week';draft=null;error='';render();return;}
    if(action==='scan'||action==='next')return scan(action==='scan');
    if(action==='stop')return stop();
    if(action==='retry'||action==='refresh'){await load();if(!schedule&&panel==='settings')setup();return;}
    if(action==='track'){
      const item=cards[Number(b.dataset.index)];if(!item)return;
      const result=core.assess(item.analysis,model.profile,model.review,Date.now(),item.fixture);if(result.status==='PASS'||!result.pick)return;
      const expected=epoch;b.disabled=true;
      try {const data=await request('/api/strategy',{method:'POST',body:JSON.stringify({action:'track',fixtureKey:item.key,market:result.pick.market})});if(expected!==epoch)return;accept(data);notice=c().initial;error='';}
      catch(e){if(expected===epoch)error=message(e);}finally{if(expected===epoch)render();}
    }
  });
  document.addEventListener('change',event=>{
    if(event.target.matches('#vsProfileForm input[name=leagues]')){
      const selected=[...document.querySelectorAll('#vsProfileForm input[name=leagues]:checked')];
      if(selected.length>2)event.target.checked=false;
    }
  });
  document.addEventListener('submit',async event=>{
    if(event.target.id!=='vsProfileForm')return;event.preventDefault();
    const profile=readForm();if(!profile?.markets.length){draft=profile;error=c().errors.CHOOSE_MARKETS;render();return;}
    const expected=epoch;const b=event.target.querySelector('button[type=submit]');b.disabled=true;b.textContent=c().saving;
    try {const data=await request('/api/strategy',{method:'POST',body:JSON.stringify({action:'profile',profile})});if(expected!==epoch)return;accept(data);panel='week';draft=null;notice=c().saved;error='';lastScan=0;render();scan();}
    catch(e){if(expected===epoch){draft=profile;error=message(e);render();}}
  });
  document.addEventListener('vertex:languagechange',()=>{if(panel==='settings')draft=readForm();render();});
  setInterval(()=>{if(owner&&loaded&&active()&&panel!=='settings'&&!document.hidden)load(true);},60000);
  window.VertexStrategy={mount,edit:setup,scan:()=>scan(),profile:()=>owner?model.profile:null};
})();
