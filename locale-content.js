'use strict';

// Canonical UI copy and provider diagnostics. Never translate user input, club
// identities, quoted articles or review bodies with a UI dictionary.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VertexLocaleContent = api;
})(typeof window === 'object' ? window : this, function () {
  const entries = [
    ['Enter a match in Russian, English or Spanish. Vertex checks the teams and shows probabilities based on available data.','Введите матч на русском, английском или испанском. Vertex проверит команды и покажет вероятности на основе доступных данных.','Introduce un partido en ruso, inglés o español. Vertex comprueba los equipos y muestra probabilidades según los datos disponibles.'],
    ['Authentication is temporarily unavailable. Please try again.','Сервис входа временно недоступен. Попробуйте ещё раз.','El servicio de acceso no está disponible temporalmente. Inténtalo de nuevo.'],
    ['Clarify the team','Уточните команду','Confirma el equipo'],
    ['Several clubs share this name. Choose a club below or enter its full name.','Это название используют несколько клубов. Уточните команду ниже или введите её полное название.','Varios clubes comparten este nombre. Elige un club o introduce su nombre completo.'],
    ['Sign in to continue','Войти и продолжить','Iniciar sesión para continuar'],
    ['Language','Язык','Idioma'],
    ['SIGN UP','ЗАРЕГИСТРИРОВАТЬСЯ','REGISTRARSE'],
    ['FAQ','Вопросы','Preguntas'],
    ['EMAIL','ЭЛЕКТРОННАЯ ПОЧТА','CORREO ELECTRÓNICO'],
    ['VERTEX STRATEGY','СТРАТЕГИЯ VERTEX','ESTRATEGIA VERTEX'],
    ['Weather','Погода','Clima'],
    ['News','Новости','Noticias'],
    ['News intelligence','Новостной анализ','Análisis de noticias'],
    ['event stats','Статистика событий','Estadísticas de eventos'],
    ['Data quality','Качество данных','Calidad de los datos'],
    ['Confidence','Достоверность','Confianza'],
    ['Main scenario','Основной сценарий','Escenario principal'],
    ['Prediction withheld: insufficient verified data','Прогноз не выдан: недостаточно проверенных данных','Pronóstico no emitido: datos verificados insuficientes'],
    ['Detailed historical event-stat feed is not connected yet.','Подробная история статистики событий пока не подключена.','El historial detallado de estadísticas de eventos aún no está conectado.'],
    ['Insufficient recent results for both teams in this league.','Недостаточно свежих результатов обеих команд в этом турнире.','No hay suficientes resultados recientes de ambos equipos en esta competición.'],
    ['League is not mapped to Football-Data.co.uk.','Турнир не сопоставлен с Football-Data.co.uk.','La competición no está vinculada a Football-Data.co.uk.'],
    ['No historical CSV rows returned.','Источник не вернул историю матчей.','La fuente no ha devuelto historial de partidos.'],
    ['Teams were not matched in the historical CSV.','Команды не найдены в исторических данных источника.','No se han identificado los equipos en el historial de la fuente.'],
    ['Team suggestions','Подсказки команд','Sugerencias de equipos'],
    ['Main navigation','Основная навигация','Navegación principal'],
    ['Open menu','Открыть меню','Abrir menú'],
    ['Vertex Soccer AI Home','Vertex Soccer AI — главная','Vertex Soccer AI — inicio'],
    ['Vertex dialog','Окно Vertex','Ventana de Vertex'],
    ['Vertex Soccer AI — Football Intelligence Engine','Vertex Soccer AI — Футбольная аналитика','Vertex Soccer AI — Análisis de fútbol'],
    ['Email','Электронная почта','Correo electrónico'],
    ['Password','Пароль','Contraseña'],
    ['Your name','Ваше имя','Tu nombre'],
    ['Describe the issue, match or question…','Опишите проблему, матч или вопрос…','Describe el problema, partido o pregunta…'],
    ['VERTEX ACCESS','ДОСТУП К VERTEX','ACCESO A VERTEX'],
    ['VERTEX ACCOUNT','АККАУНТ VERTEX','CUENTA VERTEX'],
    ['WELCOME BACK','С ВОЗВРАЩЕНИЕМ','TE DAMOS LA BIENVENIDA'],
    ['Authentication is temporarily unavailable. Public pages still work.','Вход временно недоступен. Публичные страницы работают.','El acceso no está disponible temporalmente. Las páginas públicas siguen disponibles.'],
    ['Enter a valid email and a password of at least 6 characters.','Укажите корректную почту и пароль минимум из 6 символов.','Introduce un correo válido y una contraseña de al menos 6 caracteres.'],
    ['Authentication service is unavailable.','Сервис входа временно недоступен.','El servicio de acceso no está disponible temporalmente.'],
    ['Account created. Vertex is unlocked.','Аккаунт создан. Функции Vertex доступны.','Cuenta creada. Ya puedes usar las funciones de Vertex.'],
    ['Verification email sent. Confirm your email, then sign in.','Письмо отправлено. Подтвердите почту и войдите в аккаунт.','Correo de verificación enviado. Confirma tu correo e inicia sesión.'],
    ['Enter your email and password.','Введите почту и пароль.','Introduce tu correo y contraseña.'],
    ['Signed in. Vertex is unlocked.','Вы вошли. Функции Vertex доступны.','Sesión iniciada. Ya puedes usar las funciones de Vertex.'],
    ['Signed out.','Вы вышли из аккаунта.','Has cerrado la sesión.'],
    ['Use the format “Home Team vs Away Team”.','Введите матч в формате «Хозяева — Гости».','Introduce el partido en el formato «Local contra Visitante».'],
    ['Run an analysis first.','Сначала запустите анализ.','Primero ejecuta un análisis.'],
    ['Analysis saved to My Cabinet.','Анализ сохранён в личном кабинете.','Análisis guardado en Mi panel.'],
    ['Analysis summary copied.','Краткий разбор скопирован.','Resumen del análisis copiado.'],
    ['Clipboard permission is unavailable.','Не удалось скопировать. Проверьте разрешение на доступ к буферу обмена.','No se pudo copiar. Comprueba el permiso del portapapeles.'],
    ['Write a little more before submitting.','Напишите отзыв хотя бы из 5 символов.','Escribe una reseña de al menos 5 caracteres.'],
    ['Review submitted.','Отзыв опубликован.','Reseña publicada.'],
    ['Could not publish the review. Please try again.','Не удалось опубликовать отзыв. Попробуйте ещё раз.','No se pudo publicar la reseña. Inténtalo de nuevo.'],
    ['Could not sign in. Please try again.','Не удалось войти. Попробуйте ещё раз.','No se pudo iniciar sesión. Inténtalo de nuevo.'],
    ['Could not create your account. Please try again.','Не удалось создать аккаунт. Попробуйте ещё раз.','No se pudo crear la cuenta. Inténtalo de nuevo.'],
    ['Invalid email or password.','Неверная почта или пароль.','Correo o contraseña incorrectos.'],
    ['Confirm your email before signing in.','Перед входом подтвердите электронную почту.','Confirma tu correo antes de iniciar sesión.'],
    ['An account with this email already exists.','Аккаунт с этой почтой уже существует.','Ya existe una cuenta con este correo.'],
    ['Use a stronger password with at least 6 characters.','Придумайте более надёжный пароль минимум из 6 символов.','Usa una contraseña más segura de al menos 6 caracteres.'],
    ['Too many requests. Please try again later.','Слишком много запросов. Попробуйте позже.','Demasiadas solicitudes. Inténtalo más tarde.'],
    ['Check your connection and try again.','Проверьте интернет-соединение и попробуйте ещё раз.','Comprueba tu conexión e inténtalo de nuevo.'],
    ['Your session has expired. Please sign in again.','Сессия закончилась. Войдите ещё раз.','Tu sesión ha caducado. Inicia sesión de nuevo.'],
    ['Analysis took too long. Please try again — the request was stopped safely.','Анализ занял слишком много времени. Запрос остановлен; попробуйте ещё раз.','El análisis ha tardado demasiado. La solicitud se ha detenido; inténtalo de nuevo.'],
    ['Analysis is temporarily unavailable. Please try again.','Анализ временно недоступен. Попробуйте ещё раз.','El análisis no está disponible temporalmente. Inténtalo de nuevo.'],
    ['ANALYSIS UNAVAILABLE','АНАЛИЗ НЕДОСТУПЕН','ANÁLISIS NO DISPONIBLE'],
    ['Collecting match data and calculating the Vertex model…','Собираем данные матча и рассчитываем модель Vertex…','Recopilando datos del partido y calculando el modelo Vertex…'],
    ['Community database is unavailable.','Данные сообщества временно недоступны.','Los datos de la comunidad no están disponibles temporalmente.'],
    ['Could not load community activity. Please try again.','Не удалось загрузить рейтинг. Попробуйте ещё раз.','No se pudo cargar la clasificación. Inténtalo de nuevo.'],
    ['No analysis activity yet.','Пока нет выполненных анализов.','Aún no hay actividad de análisis.'],
    ['Vertex member','Участник Vertex','Miembro de Vertex'],
    ['{count} analyses','Анализов: {count}','Análisis: {count}'],
    ['Reviews database is unavailable.','Отзывы временно недоступны.','Las reseñas no están disponibles temporalmente.'],
    ['Rating','Оценка','Valoración'],
    ['Could not load reviews. Please open this section again.','Не удалось загрузить отзывы. Откройте раздел повторно.','No se pudieron cargar las reseñas. Vuelve a abrir esta sección.'],
    ['Rate {count} out of 5','Оценить на {count} из 5','Valorar con {count} de 5'],
    ['Rating: {count} out of 5','Оценка: {count} из 5','Valoración: {count} de 5'],
    ['Original article','Оригинал статьи','Artículo original'],
    ['Source language','На языке источника','En el idioma de la fuente'],
    ['Read original','Читать оригинал','Leer original'],
    ['Context update','Новостной контекст','Actualización de contexto'],
    ['Verified results','Проверенные результаты','Resultados verificados'],
    ['Verified match history','Проверенная история матчей','Historial verificado'],
    ['Home','Главная','Inicio'],
    ['Scheduled fixture','Матч в расписании','Partido programado'],
    ['Recent form','Текущая форма','Forma reciente'],
    ['Team metadata','Данные команд','Datos de los equipos'],
    ['Primary football data','Основные футбольные данные','Datos principales de fútbol'],
    ['League code','Код турнира','Código de competición'],
    ['Model context','Контекст модели','Contexto del modelo'],
    ['Player availability','Доступность игроков','Disponibilidad de jugadores'],
    ['Penalty history','История пенальти','Historial de penaltis'],
    ['Source status','Состояние источника','Estado de la fuente'],
    ['Exact scheduled fixture was not resolved from the current providers.','Подключённые источники не подтвердили ближайший матч этой пары.','Las fuentes conectadas no han confirmado el próximo partido entre estos equipos.'],
    ['Weather was not included in this run.','Погода не учтена в этом расчёте.','El clima no se ha incluido en este cálculo.'],
    ['Recent news was not included in this run.','Свежие новости не учтены в этом расчёте.','No se han incluido noticias recientes en este cálculo.'],
    ['Recent-form sample is smaller than the preferred five completed matches.','История формы содержит менее пяти завершённых матчей.','La muestra de forma contiene menos de cinco partidos finalizados.'],
    ['Recent-form sample is limited ({home} / {away} completed matches).','История формы ограничена: завершённых матчей {home} / {away}.','Muestra de forma limitada: {home} / {away} partidos finalizados.'],
    ['At least three verified completed matches per team with valid goals scored and conceded are required before Vertex calculates probabilities.','Для расчёта нужны минимум три проверенных завершённых матча каждой команды с данными о забитых и пропущенных голах.','Para calcular probabilidades se necesitan al menos tres partidos finalizados y verificados por equipo con goles a favor y en contra.'],
    ['Not enough completed-match data to calculate a responsible probability model.','Для расчёта вероятностей недостаточно данных о завершённых матчах.','No hay suficientes datos de partidos finalizados para calcular probabilidades.'],
    ['Structured injury and confirmed-lineup feeds are not yet available for this fixture; only verified news availability signals are applied.','Для этого матча нет полных данных о травмах и подтверждённых составах. Учтены только проверенные новостные сведения о доступности игроков.','No hay datos completos de lesiones ni alineaciones confirmadas para este partido. Solo se consideran señales verificadas de disponibilidad en las noticias.'],
    ['Connected','Подключён','Conectada'],
    ['Available','Доступен','Disponible'],
    ['Unavailable','Недоступен','No disponible'],
    ['Partial','Частично','Parcial'],
    ['Pending','Ожидается','Pendiente'],
    ['Unknown','Неизвестно','Desconocido'],
    ['Not connected / unavailable','Не подключён или недоступен','Sin conexión o no disponible'],
    ['Connected · verified match history','Подключён · проверенная история матчей','Conectada · historial verificado'],
    ['Withheld · venue geocode mismatch','Не учтено: местоположение стадиона не совпало','Excluido: la ubicación del estadio no coincide'],
    ['Checked · no key-player availability signal strong enough to alter model','Проверено: существенных сигналов о доступности ключевых игроков нет','Comprobado: no hay señales de disponibilidad de jugadores clave suficientes para ajustar el modelo'],
    ['News availability + Football-Data scorer importance','Доступность по новостям + значимость бомбардиров по Football-Data','Disponibilidad según noticias + importancia de goleadores de Football-Data'],
    ['News availability + role/importance cues','Доступность по новостям + роль и значимость игроков','Disponibilidad según noticias + función e importancia de jugadores'],
    ['Penalty sample unavailable','История пенальти недоступна','Muestra de penaltis no disponible'],
    ['Fallback unavailable · team resolution failed','Резервный источник недоступен: команды не определены','Fuente alternativa no disponible: equipos sin identificar'],
    ['Unknown source status','Нет понятного статуса источника','Estado de la fuente sin especificar'],
    ["Name","Имя","Nombre"],
    ["Your name","Ваше имя","Tu nombre"],
    ["Message","Сообщение","Mensaje"],
    ["Describe the issue, match or question…","Опишите проблему, матч или вопрос…","Describe el problema, partido o pregunta…"],
    ["SEND MESSAGE","ОТПРАВИТЬ СООБЩЕНИЕ","ENVIAR MENSAJE"],
    ["SENDING…","ОТПРАВЛЯЕМ…","ENVIANDO…"],
    ["Enter your name, a valid email and a message.","Укажите имя, корректную почту и сообщение.","Introduce tu nombre, un correo válido y un mensaje."],
    ["Please complete the contact form.","Заполните форму обратной связи.","Completa el formulario de contacto."],
    ["Sending securely through Vertex…","Безопасно отправляем сообщение через Vertex…","Enviando de forma segura a través de Vertex…"],
    ["Message sent. We will reply by email.","Сообщение отправлено. Мы ответим по электронной почте.","Mensaje enviado. Responderemos por correo electrónico."],
    ["Message sent successfully.","Сообщение успешно отправлено.","Mensaje enviado correctamente."],
    ["Message delivery failed. Please try again.","Не удалось отправить сообщение. Попробуйте позже.","No se pudo enviar el mensaje. Inténtalo más tarde."]
  ];
  const catalogue = {ru:{},es:{}};
  for (const [en,ru,es] of entries) { catalogue.ru[en]=ru;catalogue.es[en]=es; }
  const text = (key, language='en', vars={}) => Object.entries(vars).reduce((s,[k,v])=>s.replaceAll(`{${k}}`,String(v)),catalogue[language]?.[key]||key);

  const sourceKeys = {primaryFootball:'Primary football data',teamMetadata:'Team metadata',weather:'Weather',news:'News',footballData:'Football-Data',competitionCode:'League code',openResults:'Football-Data.co.uk',footballDataCoUk:'Football-Data.co.uk',eventStatsStorage:'Source status',openFootball:'OpenFootball',openLigaDb:'OpenLigaDB',bsd:'BSD',bsdHistory:'BSD',sportmonks:'Sportmonks',espn:'ESPN',apiFootball:'API-Football',vertexModelContext:'Model context',fixtureResolver:'Scheduled fixture',playerAvailability:'Player availability',penaltyHistory:'Penalty history'};
  const statuses = {
    awaiting_verification:['Awaiting verification','Ожидает проверки','Pendiente de verificación'],
    upstream_unavailable:['Source unavailable','Источник недоступен','Fuente no disponible'],
    not_configured:['Not configured','Не настроен','Sin configurar'],
    source_disabled:['Disabled','Отключён','Desactivada'],
    league_not_covered:['League not covered','Турнир не покрывается','Competición sin cobertura'],
    unsupported_league:['League not covered','Турнир не покрывается','Competición sin cobertura'],
    teams_not_resolved:['Teams could not be identified','Команды не определены','Equipos sin identificar'],
    team_not_found:['Team not found','Команда не найдена','Equipo no encontrado'],
    teams_unavailable:['Team data unavailable','Данные команд недоступны','Datos de equipos no disponibles'],
    temporarily_unavailable:['Temporarily unavailable','Временно недоступен','Temporalmente no disponible'],
    insufficient_history:['Insufficient verified history','Недостаточно проверенной истории','Historial verificado insuficiente'],
    insufficient_team_history:['Insufficient team history','Недостаточно истории команд','Historial de equipos insuficiente'],
    no_matches:['No matches returned','Матчи не найдены','No se encontraron partidos'],
    invalid_dataset:['Invalid source data','Некорректные данные источника','Datos de la fuente no válidos'],
    history_truncated:['Incomplete history returned','Получена неполная история','Historial recibido incompleto'],
    datasets_unavailable:['History data unavailable','История матчей недоступна','Historial no disponible'],
    account_suspended:['Provider account suspended','Аккаунт источника приостановлен','Cuenta del proveedor suspendida'],
    quota_exhausted:['Provider quota reached','Лимит источника исчерпан','Cuota del proveedor agotada'],
    subscription_coverage:['Outside the available coverage','Вне доступного покрытия','Fuera de la cobertura disponible'],
    access_denied:['Provider access denied','Источник отказал в доступе','Acceso denegado por el proveedor'],
    no_penalty_data:['No verified penalty history','Нет проверенной истории пенальти','Sin historial verificado de penaltis'],
    missing_credentials:['Provider not configured','Источник не настроен','Proveedor sin configurar'],
    disabled:['Disabled','Отключён','Desactivada'],
    cooldown:['Source temporarily paused','Источник временно приостановлен','Fuente pausada temporalmente']
  };
  Object.assign(statuses,{
    insufficient_recent_history:['Insufficient recent history','Недостаточно свежей истории','Historial reciente insuficiente'],
    competition_unknown:['Competition not identified','Турнир не определён','Competición sin identificar'],
    insufficient_verified_penalty_sample:['Insufficient verified penalty sample','Недостаточно проверенной истории пенальти','Muestra verificada de penaltis insuficiente'],
    insufficient_team_penalty_sample:['Insufficient team penalty sample','Недостаточно истории пенальти команд','Muestra de penaltis de los equipos insuficiente']
  });
  const languageIndex = lang => ({en:0,ru:1,es:2}[lang]??0);
  function diagnostic(value,lang='en') {
    const raw=String(value||'');
    if(statuses[raw])return statuses[raw][languageIndex(lang)];
    if(catalogue[lang]?.[raw])return text(raw,lang);
    if(raw==='http_error')return lang==='ru'?'Ошибка источника':lang==='es'?'Error de la fuente':'Source error';
    if (/^http_(\d+)$/.test(raw)) return lang==='ru'?`Ошибка источника (${raw.slice(5)})`:lang==='es'?`Error de la fuente (${raw.slice(5)})`:`Source error (${raw.slice(5)})`;
    let m=raw.match(/^Recent-form sample is limited \((\d+) \/ (\d+) completed matches\)\.$/);
    if(m)return text('Recent-form sample is limited ({home} / {away} completed matches).',lang,{home:m[1],away:m[2]});
    m=raw.match(/^Fallback (used|checked) · (\d+) cached calls$/);
    if(m)return lang==='ru'?`Резерв ${m[1]==='used'?'использован':'проверен'} · запросов из кэша: ${m[2]}`:lang==='es'?`Fuente alternativa ${m[1]==='used'?'utilizada':'comprobada'} · consultas en caché: ${m[2]}`:raw;
    const fragments = [
      ['verified regulation-time results','проверенные результаты основного времени','resultados verificados del tiempo reglamentario'],
      ['verified scored-penalty history','проверенная история реализованных пенальти','historial verificado de penaltis marcados'],
      ['teams entered in reverse order','порядок команд исправлен','orden de equipos corregido'],
      ['exact upcoming fixture','подтверждённый ближайший матч','próximo partido confirmado'],
      ['league/H2H context','контекст лиги и очных встреч','contexto de liga y enfrentamientos'],
      ['verified match history','проверенная история матчей','historial verificado'],
      ['multi-source context','контекст из нескольких источников','contexto de varias fuentes'],
      ['fixture resolver','поиск матча','búsqueda de partido'],
      ['form + league/H2H','форма + лига и очные встречи','forma + liga y enfrentamientos'],
      ['summarized','сводка','resumen'],['fallback','резерв','alternativa'],['form','форма','forma']
    ];
    let result=raw;
    if(lang!=='en')for(const f of fragments)result=result.replaceAll(f[0],f[languageIndex(lang)]);
    return result;
  }
  function errorKey(error,fallback='Analysis is temporarily unavailable. Please try again.') {
    const code=String(error?.code||error?.error_code||'').toLowerCase();
    const message=String(error?.message||'').toLowerCase();
    if(/invalid_credentials/.test(code)||/invalid login credentials/.test(message))return 'Invalid email or password.';
    if(/email_not_confirmed/.test(code)||/email not confirmed/.test(message))return 'Confirm your email before signing in.';
    if(/user_already_exists|email_exists/.test(code)||/already registered/.test(message))return 'An account with this email already exists.';
    if(/weak_password/.test(code)||/password should|weak password/.test(message))return 'Use a stronger password with at least 6 characters.';
    if(/rate|too_many/.test(code)||Number(error?.status)===429||/rate limit|too many requests/.test(message))return 'Too many requests. Please try again later.';
    if(/request_timeout/.test(code)||error?.name==='AbortError')return 'Analysis took too long. Please try again — the request was stopped safely.';
    if(code==='auth_unavailable')return 'Authentication is temporarily unavailable. Please try again.';
    if(/auth_required|session|jwt/.test(code)||[401,403].includes(Number(error?.status)))return 'Your session has expired. Please sign in again.';
    if(/failed to fetch|network|fetch failed/.test(message))return 'Check your connection and try again.';
    return fallback;
  }
  let regionCodes;
  function country(value,lang='en') {
    const raw=String(value||'');
    const special={England:['England','Англия','Inglaterra'],Scotland:['Scotland','Шотландия','Escocia'],Wales:['Wales','Уэльс','Gales'],'Northern Ireland':['Northern Ireland','Северная Ирландия','Irlanda del Norte'],International:['International','Международный','Internacional']};
    if(special[raw])return special[raw][languageIndex(lang)];
    if(!regionCodes){
      regionCodes=new Map();const display=new Intl.DisplayNames(['en'],{type:'region'});
      for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=display.of(code);if(name!==code)regionCodes.set(name.toLowerCase(),code);}
      for(const [name,code] of Object.entries({'czech republic':'CZ','south korea':'KR','ivory coast':'CI','usa':'US','russia':'RU','turkey':'TR'}))regionCodes.set(name,code);
    }
    const code=/^[A-Z]{2}$/.test(raw)?raw:regionCodes.get(raw.toLowerCase());
    return code?new Intl.DisplayNames([lang],{type:'region'}).of(code):raw;
  }
  return {catalogue,text,diagnostic,sourceKeys,errorKey,country};
});
