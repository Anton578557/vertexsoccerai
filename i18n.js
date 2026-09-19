'use strict';

(() => {
  if (window.VertexI18n) return;

  const STORAGE_KEY = 'vertex_language';
  const supported = ['en', 'ru', 'es'];
  const localeMap = { en: 'en-GB', ru: 'ru-RU', es: 'es-ES' };

  const dictionary = {
    ru: {
      'Home': 'Главная',
      'Match Analyzer': 'Анализ матча',
      'My Strategy': 'Моя стратегия',
      'Live': 'Лайв',
      'Results': 'Результаты',
      'Leaderboard': 'Рейтинг',
      'Reviews': 'Отзывы',
      'FAQ': 'FAQ',
      'Contact': 'Контакты',
      'Sign In': 'Войти',
      'Sign Up': 'Регистрация',
      'My Cabinet': 'Мой кабинет',
      'FREE BETA · FOOTBALL INTELLIGENCE': 'БЕСПЛАТНАЯ БЕТА · ФУТБОЛЬНАЯ АНАЛИТИКА',
      'Where AI Meets Football': 'Где AI встречается с футболом',
      'Real match data. Context-aware modelling. Transparent confidence.': 'Реальные данные матчей. Контекстная модель. Понятная достоверность.',
      'OPEN MATCH ANALYZER': 'ОТКРЫТЬ АНАЛИЗ МАТЧА',
      'BUILD MY STRATEGY': 'СОЗДАТЬ МОЮ СТРАТЕГИЮ',
      'No fake accuracy. No invented statistics. Unsupported markets stay hidden until real data exists.': 'Без выдуманной точности и статистики. Рынки показываются только когда для них есть реальные данные.',
      'Source Engine': 'Источники данных',
      'News + Weather': 'Новости + погода',
      'Confidence Layer': 'Слой достоверности',
      'Beta Access': 'Бета-доступ',
      'MATCH INTELLIGENCE': 'АНАЛИТИКА МАТЧА',
      'Probabilities with evidence': 'Вероятности, основанные на данных',
      'Form, scoring rates and fixture context are normalized before the model produces a verdict.': 'Форма, результативность и контекст матча нормализуются до формирования прогноза.',
      'CONTEXT ENGINE': 'КОНТЕКСТНЫЙ ДВИЖОК',
      'News and weather are inputs, not decoration': 'Новости и погода — часть модели, а не декор',
      'Only relevant context signals are allowed to change the model, and their influence is deliberately bounded.': 'На модель влияют только релевантные сигналы, и их вес специально ограничен.',
      'PERSONAL STRATEGY': 'ПЕРСОНАЛЬНАЯ СТРАТЕГИЯ',
      'PASS is a valid decision': 'PASS — тоже правильное решение',
      'Your risk profile and market preferences filter matches instead of forcing a recommendation on every fixture.': 'Ваш риск-профиль и выбранные рынки фильтруют матчи вместо принудительного прогноза на каждый матч.',
      'VERTEX READS': 'VERTEX УЧИТЫВАЕТ',
      'Recent Form': 'Текущая форма',
      'Goals': 'Голы',
      'Fixtures': 'Матчи',
      'Team Data': 'Данные команд',
      'News': 'Новости',
      'Weather': 'Погода',
      'Venue': 'Стадион',
      'Data Quality': 'Качество данных',
      'ANALYSIS PIPELINE': 'ЭТАПЫ АНАЛИЗА',
      'How Vertex thinks': 'Как думает Vertex',
      'Every prediction should be traceable to the data used to produce it.': 'Каждый прогноз должен быть связан с данными, на которых он построен.',
      'Match Data': 'Данные матча',
      'Fixtures, results, standings, team identity': 'Матчи, результаты, таблицы, команды',
      'Context': 'Контекст',
      'Form, venue, weather, news, availability': 'Форма, стадион, погода, новости, доступность игроков',
      'Model': 'Модель',
      'Statistical probabilities and scenario scoring': 'Статистические вероятности и оценка сценариев',
      'Verdict': 'Вердикт',
      'Confidence, data quality and transparent reasoning': 'Достоверность, качество данных и прозрачная логика',
      'DATA LAYER': 'СЛОЙ ДАННЫХ',
      'VERTEX ANALYSIS ENGINE': 'АНАЛИТИЧЕСКИЙ ДВИЖОК VERTEX',
      'One match. Multiple data sources. No invented statistics.': 'Один матч. Несколько источников. Никакой выдуманной статистики.',
      'HOW IT WORKS': 'КАК ЭТО РАБОТАЕТ',
      'Enter two teams → Vertex resolves the teams → collects current data → calculates probabilities → shows confidence and data quality.': 'Введите две команды → Vertex определит их → соберёт данные → рассчитает вероятности → покажет достоверность и качество данных.',
      '⚡ RUN ANALYSIS': '⚡ ЗАПУСТИТЬ АНАЛИЗ',
      'Ready for a match': 'Готов к анализу',
      'Vertex will show only the information actually returned by the connected data sources.': 'Vertex покажет только те данные, которые реально получили подключённые источники.',
      'PERSONAL DECISION ENGINE': 'ПЕРСОНАЛЬНЫЙ ДВИЖОК РЕШЕНИЙ',
      'A personal filter for risk, leagues and markets — not a promise of profit.': 'Персональный фильтр риска, лиг и рынков — без обещаний прибыли.',
      'Build your Vertex profile': 'Создайте профиль Vertex',
      'Set your risk profile, experience, preferred competitions and markets. Vertex turns that into rules for which matches to consider — and which ones to reject.': 'Укажите риск-профиль, опыт, любимые турниры и рынки. Vertex превратит это в правила отбора матчей.',
      '✓ Personal risk framework': '✓ Персональный риск-профиль',
      '✓ Preferred market filters': '✓ Фильтры рынков',
      '✓ League and data-quality thresholds': '✓ Порог качества данных и лиг',
      '✓ Direct PASS / WATCH / FIT verdicts': '✓ Вердикты PASS / WATCH / FIT',
      'SET UP MY PROFILE': 'НАСТРОИТЬ ПРОФИЛЬ',
      'MATCH CENTER': 'МАТЧ-ЦЕНТР',
      'Current matches from the connected live-data provider.': 'Текущие матчи из подключённого live-источника.',
      'REFRESH': 'ОБНОВИТЬ',
      'Live center ready': 'Live-центр готов',
      'Open this tab to load current matches.': 'Откройте вкладку, чтобы загрузить текущие матчи.',
      'VERIFIED PERFORMANCE': 'ПРОВЕРЕННЫЕ РЕЗУЛЬТАТЫ',
      'No fake 85%. Performance appears only after predictions have been matched against final results.': 'Никаких фейковых 85%. Статистика появится только после сверки прогнозов с реальными результатами.',
      'MODEL STATUS': 'СТАТУС МОДЕЛИ',
      'COLLECTING VERIFIED DATA': 'СОБИРАЕМ ПРОВЕРЕННЫЕ ДАННЫЕ',
      'Vertex will publish accuracy only when enough real, evaluated predictions exist.': 'Vertex покажет точность только после накопления достаточного количества проверенных прогнозов.',
      'Evaluated': 'Проверено',
      'Correct': 'Верно',
      'Accuracy': 'Точность',
      'Data quality': 'Качество данных',
      'VERTEX COMMUNITY': 'СООБЩЕСТВО VERTEX',
      'Top members by analysis activity.': 'Самые активные пользователи анализа.',
      'COMMUNITY FEEDBACK': 'ОТЗЫВЫ СООБЩЕСТВА',
      'Only reviews submitted by registered Vertex users.': 'Только отзывы зарегистрированных пользователей Vertex.',
      'Leave a review': 'Оставить отзыв',
      'SUBMIT REVIEW': 'ОТПРАВИТЬ ОТЗЫВ',
      'TRANSPARENCY': 'ПРОЗРАЧНОСТЬ',
      'How does Match Analyzer work?': 'Как работает анализ матча?',
      'Is Vertex Soccer AI free?': 'Vertex Soccer AI бесплатный?',
      'What does Data Quality mean?': 'Что означает качество данных?',
      'Can Vertex analyze smaller leagues?': 'Vertex анализирует небольшие лиги?',
      'Are predictions guaranteed?': 'Прогнозы гарантированы?',
      'Vertex collects available match and team data, normalizes it, calculates statistical scenarios and shows both confidence and data quality. If a source is missing, the interface marks it as missing instead of inventing a value.': 'Vertex собирает доступные данные о матче и командах, нормализует их, рассчитывает статистические сценарии и показывает достоверность вместе с качеством данных. Если источник не вернул значение, система отмечает пробел, а не придумывает его.',
      'Yes. The current product is a free beta. Monetization is not enabled.': 'Да. Сейчас сервис доступен бесплатно. Платные функции не подключены.',
      'It measures how complete the input is for that specific analysis: recent form, team identity, fixture information, venue/weather and news context. High confidence with poor data quality is deliberately prevented.': 'Показывает, насколько полны данные именно для этого анализа: свежая форма, идентификация команд, информация о матче, стадион, погода и новостной контекст. Высокая достоверность при слабых данных намеренно не допускается.',
      'Coverage depends on the connected providers. Vertex can search globally, but it will only calculate a full prediction when enough reliable match data is available.': 'Покрытие зависит от подключённых источников. Vertex ищет команды глобально, но полный прогноз выдаётся только при достаточном объёме надёжной истории матчей.',
      'No. Football is uncertain. Vertex provides statistical analysis and decision support, not guaranteed outcomes or financial advice.': 'Нет. Футбол содержит неопределённость. Vertex предоставляет статистический анализ и поддержку решений, а не гарантированный результат или финансовую консультацию.',
      'Football Intelligence Engine': 'Футбольный аналитический движок',
      'Analysis Engine': 'Аналитический движок',
      'Responsible use': 'Ответственное использование',
      'SUPPORT': 'ПОДДЕРЖКА',
      'Questions, bugs or data-source issues — tell us what happened and which match you were analyzing.': 'Вопросы, ошибки или проблемы с источниками данных — напишите, что произошло и какой матч вы анализировали.',
      'EMAIL': 'ПОЧТА',
      'Football Intelligence Engine · Free Beta': 'Футбольный аналитический движок · Бесплатная бета',
      'About': 'О проекте',
      'Terms': 'Условия',
      'Privacy': 'Конфиденциальность',
      'Analysis is not a guarantee of results.': 'Анализ не гарантирует результат.',
      'FREE BETA ACCESS': 'ДОСТУП К БЕСПЛАТНОЙ БЕТЕ',
      'Sign in to unlock Vertex': 'Войдите, чтобы открыть Vertex',
      'CREATE FREE ACCOUNT': 'СОЗДАТЬ БЕСПЛАТНЫЙ АККАУНТ',
      'CLOSE': 'ЗАКРЫТЬ',
      'VERTEX FREE BETA': 'VERTEX · БЕСПЛАТНАЯ БЕТА',
      'Create your account': 'Создать аккаунт',
      'No payment details. Create an account to unlock the football intelligence tools.': 'Без платёжных данных. Создайте аккаунт, чтобы открыть инструменты футбольной аналитики.',
      'Already registered? Sign in': 'Уже зарегистрированы? Войти',
      'WELCOME BACK': 'С ВОЗВРАЩЕНИЕМ',
      'Password': 'Пароль',
      'Loading community activity…': 'Загружаем активность сообщества…',
      'Loading reviews…': 'Загружаем отзывы…',
      'Collecting match data and calculating the Vertex model…': 'Собираем данные матча и рассчитываем модель Vertex…',
      'No recent results': 'Нет свежих результатов',
      'SAVE ANALYSIS': 'СОХРАНИТЬ АНАЛИЗ',
      'COPY SUMMARY': 'КОПИРОВАТЬ СВОДКУ',
      'No recent data': 'Нет свежих данных',
      'Analysis confidence': 'Достоверность анализа',
      'CORE MODEL': 'ОСНОВНАЯ МОДЕЛЬ',
      'Match probability overview': 'Обзор вероятностей матча',
      'PRIMARY OUTLOOK': 'ОСНОВНОЙ СЦЕНАРИЙ',
      'Most likely match outcome': 'Наиболее вероятный исход матча',
      '1X2 PROBABILITY': 'ВЕРОЯТНОСТИ 1X2',
      'Home win': 'Победа хозяев',
      'Draw': 'Ничья',
      'Away win': 'Победа гостей',
      'Best safety option': 'Лучший страхующий вариант',
      'Expected goals': 'Ожидаемые голы',
      'Goal outlook': 'Прогноз по голам',
      'Both teams to score': 'Обе команды забьют',
      'Likely score': 'Вероятный счёт',
      'EXTENDED GOAL MARKETS': 'РАСШИРЕННЫЕ РЫНКИ ГОЛОВ',
      'Derived from the same score distribution': 'Рассчитано из того же распределения счёта',
      'to score': 'забьёт',
      '2+ goals': '2+ гола',
      'clean sheet': 'сухой матч',
      'VERTEX MATCH VERDICT': 'ВЕРДИКТ МАТЧА VERTEX',
      'Model output combines recent scoring form with verified context signals. Confidence is reduced when the input data is incomplete.': 'Модель объединяет текущую результативность и проверенные контекстные сигналы. При неполных данных достоверность снижается.',
      'PREDICTION WITHHELD': 'ПРОГНОЗ НЕ ВЫДАН',
      'Vertex does not have enough completed-match data to calculate responsible probabilities for this match.': 'Vertex пока не имеет достаточно завершённых матчей, чтобы корректно рассчитать вероятности.',
      'CONTEXT INTELLIGENCE': 'КОНТЕКСТНЫЙ АНАЛИЗ',
      'Only relevant signals, no article dump': 'Только важные сигналы, без списка ссылок',
      'NEWS MODELLED': 'НОВОСТИ УЧТЕНЫ',
      'NEWS REVIEWED': 'НОВОСТИ ПРОВЕРЕНЫ',
      'WEATHER MODELLED': 'ПОГОДА УЧТЕНА',
      'WEATHER MONITORED': 'ПОГОДА ПРОВЕРЕНА',
      'GRANULAR MARKETS': 'ДЕТАЛЬНЫЕ РЫНКИ',
      'Corners · Cards · Penalties · Shots · Offsides': 'Угловые · Карточки · Пенальти · Удары · Офсайды',
      'These forecasts stay hidden until a verified historical event-stat feed is connected. Vertex will not manufacture them from goal data.': 'Эти прогнозы скрыты, пока не подключён проверенный источник исторической event-статистики. Vertex не будет выдумывать их на основе голов.',
      'Data notes & limitations': 'Данные и ограничения',
      'LINEUP': 'СОСТАВ',
      'NEGATIVE': 'НЕГАТИВ',
      'POSITIVE': 'ПОЗИТИВ',
      'CONTEXT': 'КОНТЕКСТ',
      'TRANSFER': 'ТРАНСФЕР',
      'Strong edge': 'Сильное преимущество',
      'Moderate edge': 'Умеренное преимущество',
      'Small edge': 'Небольшое преимущество'
    },
    es: {
      'Home': 'Inicio',
      'Match Analyzer': 'Analizador',
      'My Strategy': 'Mi estrategia',
      'Live': 'En vivo',
      'Results': 'Resultados',
      'Leaderboard': 'Clasificación',
      'Reviews': 'Reseñas',
      'FAQ': 'FAQ',
      'Contact': 'Contacto',
      'Sign In': 'Entrar',
      'Sign Up': 'Registrarse',
      'My Cabinet': 'Mi panel',
      'FREE BETA · FOOTBALL INTELLIGENCE': 'BETA GRATIS · INTELIGENCIA DE FÚTBOL',
      'Where AI Meets Football': 'Donde la IA se encuentra con el fútbol',
      'Real match data. Context-aware modelling. Transparent confidence.': 'Datos reales. Modelo con contexto. Confianza transparente.',
      'OPEN MATCH ANALYZER': 'ABRIR ANALIZADOR',
      'BUILD MY STRATEGY': 'CREAR MI ESTRATEGIA',
      'No fake accuracy. No invented statistics. Unsupported markets stay hidden until real data exists.': 'Sin precisión falsa ni estadísticas inventadas. Los mercados sin datos reales permanecen ocultos.',
      'Source Engine': 'Motor de fuentes',
      'News + Weather': 'Noticias + clima',
      'Confidence Layer': 'Capa de confianza',
      'Beta Access': 'Acceso beta',
      'MATCH INTELLIGENCE': 'INTELIGENCIA DEL PARTIDO',
      'Probabilities with evidence': 'Probabilidades con evidencia',
      'Form, scoring rates and fixture context are normalized before the model produces a verdict.': 'La forma, los goles y el contexto se normalizan antes de que el modelo genere un veredicto.',
      'CONTEXT ENGINE': 'MOTOR DE CONTEXTO',
      'News and weather are inputs, not decoration': 'Noticias y clima son entradas del modelo',
      'Only relevant context signals are allowed to change the model, and their influence is deliberately bounded.': 'Solo las señales relevantes pueden modificar el modelo y su influencia está limitada.',
      'PERSONAL STRATEGY': 'ESTRATEGIA PERSONAL',
      'PASS is a valid decision': 'PASS también es una buena decisión',
      'Your risk profile and market preferences filter matches instead of forcing a recommendation on every fixture.': 'Tu perfil de riesgo y mercados preferidos filtran partidos sin forzar una recomendación en cada encuentro.',
      'VERTEX READS': 'VERTEX ANALIZA',
      'Recent Form': 'Forma reciente',
      'Goals': 'Goles',
      'Fixtures': 'Partidos',
      'Team Data': 'Datos de equipos',
      'News': 'Noticias',
      'Weather': 'Clima',
      'Venue': 'Estadio',
      'Data Quality': 'Calidad de datos',
      'ANALYSIS PIPELINE': 'FLUJO DE ANÁLISIS',
      'How Vertex thinks': 'Cómo piensa Vertex',
      'Every prediction should be traceable to the data used to produce it.': 'Cada pronóstico debe poder relacionarse con los datos que lo generaron.',
      'Match Data': 'Datos del partido',
      'Fixtures, results, standings, team identity': 'Partidos, resultados, clasificación e identidad de equipos',
      'Context': 'Contexto',
      'Form, venue, weather, news, availability': 'Forma, estadio, clima, noticias y disponibilidad',
      'Model': 'Modelo',
      'Statistical probabilities and scenario scoring': 'Probabilidades estadísticas y valoración de escenarios',
      'Verdict': 'Veredicto',
      'Confidence, data quality and transparent reasoning': 'Confianza, calidad de datos y razonamiento transparente',
      'DATA LAYER': 'CAPA DE DATOS',
      'VERTEX ANALYSIS ENGINE': 'MOTOR DE ANÁLISIS VERTEX',
      'One match. Multiple data sources. No invented statistics.': 'Un partido. Varias fuentes. Sin estadísticas inventadas.',
      'HOW IT WORKS': 'CÓMO FUNCIONA',
      'Enter two teams → Vertex resolves the teams → collects current data → calculates probabilities → shows confidence and data quality.': 'Introduce dos equipos → Vertex los identifica → recopila datos → calcula probabilidades → muestra confianza y calidad de datos.',
      '⚡ RUN ANALYSIS': '⚡ EJECUTAR ANÁLISIS',
      'Ready for a match': 'Listo para un partido',
      'Vertex will show only the information actually returned by the connected data sources.': 'Vertex solo mostrará la información realmente devuelta por las fuentes conectadas.',
      'PERSONAL DECISION ENGINE': 'MOTOR DE DECISIÓN PERSONAL',
      'A personal filter for risk, leagues and markets — not a promise of profit.': 'Un filtro personal de riesgo, ligas y mercados — sin promesas de beneficio.',
      'Build your Vertex profile': 'Crea tu perfil Vertex',
      'Set your risk profile, experience, preferred competitions and markets. Vertex turns that into rules for which matches to consider — and which ones to reject.': 'Define tu riesgo, experiencia, competiciones y mercados preferidos. Vertex los convierte en reglas para aceptar o descartar partidos.',
      '✓ Personal risk framework': '✓ Perfil personal de riesgo',
      '✓ Preferred market filters': '✓ Filtros de mercados',
      '✓ League and data-quality thresholds': '✓ Umbrales de ligas y calidad',
      '✓ Direct PASS / WATCH / FIT verdicts': '✓ Veredictos PASS / WATCH / FIT',
      'SET UP MY PROFILE': 'CONFIGURAR MI PERFIL',
      'MATCH CENTER': 'CENTRO DE PARTIDOS',
      'Current matches from the connected live-data provider.': 'Partidos actuales del proveedor de datos en vivo.',
      'REFRESH': 'ACTUALIZAR',
      'Live center ready': 'Centro en vivo listo',
      'Open this tab to load current matches.': 'Abre esta pestaña para cargar los partidos actuales.',
      'VERIFIED PERFORMANCE': 'RENDIMIENTO VERIFICADO',
      'No fake 85%. Performance appears only after predictions have been matched against final results.': 'Sin 85% falso. El rendimiento aparece solo después de comparar pronósticos con resultados reales.',
      'MODEL STATUS': 'ESTADO DEL MODELO',
      'COLLECTING VERIFIED DATA': 'RECOPILANDO DATOS VERIFICADOS',
      'Vertex will publish accuracy only when enough real, evaluated predictions exist.': 'Vertex publicará la precisión solo cuando haya suficientes pronósticos evaluados.',
      'Evaluated': 'Evaluados',
      'Correct': 'Correctos',
      'Accuracy': 'Precisión',
      'Data quality': 'Calidad de datos',
      'VERTEX COMMUNITY': 'COMUNIDAD VERTEX',
      'Top members by analysis activity.': 'Usuarios con mayor actividad de análisis.',
      'COMMUNITY FEEDBACK': 'OPINIONES DE LA COMUNIDAD',
      'Only reviews submitted by registered Vertex users.': 'Solo reseñas de usuarios registrados de Vertex.',
      'Leave a review': 'Dejar una reseña',
      'SUBMIT REVIEW': 'ENVIAR RESEÑA',
      'TRANSPARENCY': 'TRANSPARENCIA',
      'How does Match Analyzer work?': '¿Cómo funciona el analizador?',
      'Is Vertex Soccer AI free?': '¿Vertex Soccer AI es gratis?',
      'What does Data Quality mean?': '¿Qué significa calidad de datos?',
      'Can Vertex analyze smaller leagues?': '¿Vertex puede analizar ligas pequeñas?',
      'Are predictions guaranteed?': '¿Los pronósticos están garantizados?',
      'Vertex collects available match and team data, normalizes it, calculates statistical scenarios and shows both confidence and data quality. If a source is missing, the interface marks it as missing instead of inventing a value.': 'Vertex recopila los datos disponibles del partido y de los equipos, los normaliza, calcula escenarios estadísticos y muestra la confianza junto con la calidad de los datos. Si una fuente no aporta un dato, se marca como ausente en lugar de inventarlo.',
      'Yes. The current product is a free beta. Monetization is not enabled.': 'Sí. Actualmente el servicio se puede usar de forma gratuita. No hay funciones de pago activadas.',
      'It measures how complete the input is for that specific analysis: recent form, team identity, fixture information, venue/weather and news context. High confidence with poor data quality is deliberately prevented.': 'Indica lo completos que son los datos para ese análisis: forma reciente, identidad de equipos, información del partido, estadio, clima y contexto de noticias. Se evita deliberadamente mostrar alta confianza con datos débiles.',
      'Coverage depends on the connected providers. Vertex can search globally, but it will only calculate a full prediction when enough reliable match data is available.': 'La cobertura depende de los proveedores conectados. Vertex puede buscar equipos a nivel global, pero solo calcula un pronóstico completo cuando existe suficiente historial fiable.',
      'No. Football is uncertain. Vertex provides statistical analysis and decision support, not guaranteed outcomes or financial advice.': 'No. El fútbol es incierto. Vertex ofrece análisis estadístico y apoyo a la decisión, no resultados garantizados ni asesoramiento financiero.',
      'Football Intelligence Engine': 'Motor de inteligencia de fútbol',
      'Analysis Engine': 'Motor de análisis',
      'Responsible use': 'Uso responsable',
      'SUPPORT': 'SOPORTE',
      'Questions, bugs or data-source issues — tell us what happened and which match you were analyzing.': 'Preguntas, errores o problemas de datos: dinos qué ocurrió y qué partido estabas analizando.',
      'EMAIL': 'EMAIL',
      'Football Intelligence Engine · Free Beta': 'Motor de inteligencia de fútbol · Beta gratis',
      'About': 'Acerca de',
      'Terms': 'Términos',
      'Privacy': 'Privacidad',
      'Analysis is not a guarantee of results.': 'El análisis no garantiza resultados.',
      'FREE BETA ACCESS': 'ACCESO A LA BETA GRATIS',
      'Sign in to unlock Vertex': 'Inicia sesión para desbloquear Vertex',
      'CREATE FREE ACCOUNT': 'CREAR CUENTA GRATIS',
      'CLOSE': 'CERRAR',
      'VERTEX FREE BETA': 'VERTEX · BETA GRATIS',
      'Create your account': 'Crea tu cuenta',
      'No payment details. Create an account to unlock the football intelligence tools.': 'Sin datos de pago. Crea una cuenta para acceder a las herramientas de inteligencia de fútbol.',
      'Already registered? Sign in': '¿Ya estás registrado? Entrar',
      'WELCOME BACK': 'BIENVENIDO DE NUEVO',
      'Password': 'Contraseña',
      'Loading community activity…': 'Cargando actividad de la comunidad…',
      'Loading reviews…': 'Cargando reseñas…',
      'Collecting match data and calculating the Vertex model…': 'Recopilando datos y calculando el modelo Vertex…',
      'No recent results': 'Sin resultados recientes',
      'SAVE ANALYSIS': 'GUARDAR ANÁLISIS',
      'COPY SUMMARY': 'COPIAR RESUMEN',
      'No recent data': 'Sin datos recientes',
      'Analysis confidence': 'Confianza del análisis',
      'CORE MODEL': 'MODELO PRINCIPAL',
      'Match probability overview': 'Resumen de probabilidades',
      'PRIMARY OUTLOOK': 'ESCENARIO PRINCIPAL',
      'Most likely match outcome': 'Resultado más probable',
      '1X2 PROBABILITY': 'PROBABILIDAD 1X2',
      'Home win': 'Victoria local',
      'Draw': 'Empate',
      'Away win': 'Victoria visitante',
      'Best safety option': 'Mejor opción de cobertura',
      'Expected goals': 'Goles esperados',
      'Goal outlook': 'Perspectiva de goles',
      'Both teams to score': 'Ambos equipos marcan',
      'Likely score': 'Marcador probable',
      'EXTENDED GOAL MARKETS': 'MERCADOS DE GOLES AMPLIADOS',
      'Derived from the same score distribution': 'Derivado de la misma distribución de marcadores',
      'to score': 'marcará',
      '2+ goals': '2+ goles',
      'clean sheet': 'portería a cero',
      'VERTEX MATCH VERDICT': 'VEREDICTO VERTEX',
      'Model output combines recent scoring form with verified context signals. Confidence is reduced when the input data is incomplete.': 'El modelo combina la forma goleadora reciente con señales de contexto verificadas. La confianza baja cuando faltan datos.',
      'PREDICTION WITHHELD': 'PRONÓSTICO RETENIDO',
      'Vertex does not have enough completed-match data to calculate responsible probabilities for this match.': 'Vertex no tiene suficientes partidos finalizados para calcular probabilidades responsables.',
      'CONTEXT INTELLIGENCE': 'INTELIGENCIA DE CONTEXTO',
      'Only relevant signals, no article dump': 'Solo señales relevantes, sin lista de enlaces',
      'NEWS MODELLED': 'NOTICIAS MODELADAS',
      'NEWS REVIEWED': 'NOTICIAS REVISADAS',
      'WEATHER MODELLED': 'CLIMA MODELADO',
      'WEATHER MONITORED': 'CLIMA REVISADO',
      'GRANULAR MARKETS': 'MERCADOS DETALLADOS',
      'Corners · Cards · Penalties · Shots · Offsides': 'Córners · Tarjetas · Penaltis · Tiros · Fueras de juego',
      'These forecasts stay hidden until a verified historical event-stat feed is connected. Vertex will not manufacture them from goal data.': 'Estos pronósticos permanecen ocultos hasta conectar un feed histórico verificado. Vertex no los inventará a partir de datos de goles.',
      'Data notes & limitations': 'Notas y limitaciones',
      'LINEUP': 'ALINEACIÓN',
      'NEGATIVE': 'NEGATIVO',
      'POSITIVE': 'POSITIVO',
      'CONTEXT': 'CONTEXTO',
      'TRANSFER': 'FICHAJE',
      'Strong edge': 'Ventaja fuerte',
      'Moderate edge': 'Ventaja moderada',
      'Small edge': 'Ventaja pequeña'
    }
  };

  const placeholderDictionary = {
    ru: {
      'Borussia Dortmund vs Villarreal': 'Боруссия Дортмунд vs Вильярреал',
      'Email': 'Email',
      'Password · minimum 6 characters': 'Пароль · минимум 6 символов',
      'What did you like? What should Vertex improve?': 'Что вам понравилось? Что Vertex стоит улучшить?'
    },
    es: {
      'Borussia Dortmund vs Villarreal': 'Borussia Dortmund vs Villarreal',
      'Email': 'Email',
      'Password · minimum 6 characters': 'Contraseña · mínimo 6 caracteres',
      'What did you like? What should Vertex improve?': '¿Qué te gustó? ¿Qué debería mejorar Vertex?'
    }
  };

  let current = (() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (supported.includes(saved)) return saved;
    const browser = String(navigator.language || 'en').slice(0, 2).toLowerCase();
    return supported.includes(browser) ? browser : 'en';
  })();

  const originalText = new WeakMap();
  const originalPlaceholder = new WeakMap();
  let observer = null;
  let applying = false;

  function translatePattern(text, lang) {
    if (lang === 'en') return text;
    let match = text.match(/^(\d+) matches$/i);
    if (match) return lang === 'ru' ? `${match[1]} матчей` : `${match[1]} partidos`;
    match = text.match(/^(\d+) matches sampled$/i);
    if (match) return lang === 'ru' ? `Проанализировано матчей: ${match[1]}` : `Partidos analizados: ${match[1]}`;
    return null;
  }

  function t(text, vars = {}, lang = current) {
    const source = String(text ?? '');
    let translated = lang === 'en' ? source : (dictionary[lang]?.[source] || translatePattern(source, lang) || source);
    Object.entries(vars).forEach(([key, value]) => {
      translated = translated.replaceAll(`{${key}}`, String(value));
    });
    return translated;
  }

  function preserveWhitespace(original, translated) {
    const leading = original.match(/^\s*/)?.[0] || '';
    const trailing = original.match(/\s*$/)?.[0] || '';
    return `${leading}${translated}${trailing}`;
  }

  function translateTextNode(node) {
    if (!node?.nodeValue || !node.parentElement) return;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) return;
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const original = originalText.get(node);
    const trimmed = original.trim();
    if (!trimmed) return;
    const translated = t(trimmed);
    node.nodeValue = preserveWhitespace(original, translated);
  }

  function translateElementAttributes(root) {
    const elements = root.querySelectorAll ? root.querySelectorAll('input[placeholder], textarea[placeholder]') : [];
    elements.forEach((el) => {
      if (!originalPlaceholder.has(el)) originalPlaceholder.set(el, el.getAttribute('placeholder') || '');
      const original = originalPlaceholder.get(el);
      el.setAttribute('placeholder', current === 'en' ? original : (placeholderDictionary[current]?.[original] || original));
    });
  }

  function apply(root = document.body) {
    if (!root || applying) return;
    applying = true;
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) translateTextNode(node);
      translateElementAttributes(root);
      document.documentElement.lang = current;
      const select = document.getElementById('vertexLanguageSelect');
      if (select && select.value !== current) select.value = current;
    } finally {
      applying = false;
    }
  }

  function injectSwitcher() {
    if (document.getElementById('vertexLanguage')) return;
    const nav = document.getElementById('nav');
    if (!nav) return;
    const wrap = document.createElement('div');
    wrap.id = 'vertexLanguage';
    wrap.className = 'vertex-language';
    wrap.innerHTML = `
      <span aria-hidden="true">◎</span>
      <select id="vertexLanguageSelect" aria-label="Language">
        <option value="en">EN</option>
        <option value="ru">RU</option>
        <option value="es">ES</option>
      </select>`;
    const authAnchor = document.getElementById('btnLogin') || document.getElementById('btnCabinet');
    if (authAnchor) nav.insertBefore(wrap, authAnchor); else nav.appendChild(wrap);
    wrap.querySelector('select').value = current;
    wrap.querySelector('select').addEventListener('change', (event) => setLanguage(event.target.value));
  }

  function setLanguage(lang) {
    if (!supported.includes(lang)) return;
    current = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    apply(document.body);
    document.dispatchEvent(new CustomEvent('vertex:languagechange', { detail: { language: lang, locale: localeMap[lang] } }));
  }

  function getLanguage() { return current; }
  function getLocale() { return localeMap[current] || localeMap.en; }

  function boot() {
    injectSwitcher();
    // Static UI is translated once at startup and again only when the user
    // explicitly changes language. Large analysis reports localize themselves,
    // so a body-wide MutationObserver is unnecessary and can stall Chromium.
    apply(document.body);
  }

  window.VertexI18n = { t, setLanguage, getLanguage, getLocale, apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
