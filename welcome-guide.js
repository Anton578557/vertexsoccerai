'use strict';

(() => {
  const copy = {
    ru: {
      label: 'Как пользоваться', title: 'Ваш первый матч с Vertex', lead: 'Короткая памятка — и можно начинать. Сейчас сервис бесплатный.',
      steps: [
        ['Анализ матча', 'Введите хозяев и гостей, выберите команды из подсказок и нажмите «Запустить анализ». Названия можно вводить на русском, английском и испанском.'],
        ['Читайте отчёт', 'Переключайте исходы, тоталы, голы команд и варианты счёта. Проверяйте форму, качество данных и использованные матчи. Если истории мало, прогноз не выдаётся.'],
        ['Моя стратегия и кабинет', 'Настройте риск и интересующие рынки в «Моей стратегии». Сохраняйте нужные анализы — к ним можно вернуться в личном кабинете.'],
        ['Остальные разделы', '«Прогнозы на сезон» пока в разработке. В «Отзывах» можно оставить до двух отзывов со звёздами. Ответы — в разделе «Вопросы», связь с нами — в «Контактах».']
      ],
      note: 'Проценты — оценки модели, а не гарантия результата. Индекс уверенности не равен измеренной точности.',
      next: 'Далее — важное об использовании', back: 'Назад', done: 'Понятно, начинаем', later: 'Позже', progress: 'Шаг', reopen: 'Памятка всегда доступна по ссылке «Как пользоваться» внизу сайта.'
    },
    en: {
      label: 'How to use Vertex', title: 'Your first match with Vertex', lead: 'A quick introduction, then you are ready. The service is currently free.',
      steps: [
        ['Match Analyzer', 'Enter the home and away teams, select the suggestions and choose Run analysis. Team names work in English, Russian and Spanish.'],
        ['Read the report', 'Explore outcomes, totals, team goals and score scenarios. Check form, data quality and the matches used. A forecast is withheld when history is insufficient.'],
        ['My Strategy and My Cabinet', 'Choose your risk profile and markets in My Strategy. Save useful analyses and return to them in My Cabinet.'],
        ['Explore the site', 'Season forecasts are in development. You can leave up to two reviews with stars. Find answers in FAQ and reach us through Contact.']
      ],
      note: 'Percentages are model estimates, not guarantees. The confidence index is not measured prediction accuracy.',
      next: 'Next — responsible use', back: 'Back', done: 'Got it, let’s start', later: 'Later', progress: 'Step', reopen: 'Reopen this guide anytime using “How to use Vertex” in the footer.'
    },
    es: {
      label: 'Cómo usar Vertex', title: 'Tu primer partido con Vertex', lead: 'Una guía breve para empezar. El servicio es gratuito por ahora.',
      steps: [
        ['Analizar partido', 'Introduce el local y el visitante, elige los equipos sugeridos y pulsa Analizar. Puedes escribir los nombres en español, ruso e inglés.'],
        ['Lee el informe', 'Explora resultados, totales, goles por equipo y marcadores. Revisa la forma, la calidad de los datos y los partidos utilizados. Sin historial suficiente, no se emite un pronóstico.'],
        ['Mi estrategia y Mi panel', 'Configura el riesgo y los mercados en Mi estrategia. Guarda los análisis que te interesen y vuelve a ellos en Mi panel.'],
        ['Más secciones', 'Los pronósticos de temporada están en desarrollo. Puedes publicar hasta dos reseñas con estrellas. Consulta Preguntas o escríbenos desde Contacto.']
      ],
      note: 'Los porcentajes son estimaciones, no garantías. El índice de confianza no es la precisión medida de los pronósticos.',
      next: 'Siguiente — uso responsable', back: 'Atrás', done: 'Entendido, empecemos', later: 'Más tarde', progress: 'Paso', reopen: 'Puedes volver a esta guía desde “Cómo usar Vertex” al pie de la página.'
    }
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const words = () => copy[window.VertexI18n?.getLanguage?.()] || copy.en;
  let client = null, user = null, sessionUser = null, revision = 0, step = 0, dialog = null;
  const key = id => `vertex_guide_v1:${id}`;
  const localDone = id => { try { return localStorage.getItem(key(id)); } catch (_) { return null; } };

  function render() {
    const w = words();
    const responsible = window.VertexResponsibleContent?.();
    const final = step === 1 && responsible;
    const sections = final ? responsible.sections : w.steps;
    dialog.innerHTML = `<div class="guide-top"><span class="kicker">VERTEX / ${esc(w.progress)} ${step+1} / 2</span><button class="guide-dismiss" type="button" data-guide="later">${esc(w.later)} <span aria-hidden="true">×</span></button></div>
      <h2 id="guideTitle" tabindex="-1">${esc(final ? responsible.title : w.title)}</h2>
      <p class="guide-lead">${esc(final ? responsible.lead : w.lead)}</p>
      <div class="guide-grid">${sections.map(([title,body],i)=>`<section><span class="guide-number" aria-hidden="true">${final ? '◇' : `0${i+1}`}</span><h3>${esc(title)}</h3><p>${esc(body)}</p></section>`).join('')}</div>
      <p class="guide-note ${final ? 'guide-responsible' : ''}">${esc(final ? responsible.warning : w.note)}</p>
      <div class="guide-actions">${step ? `<button class="btn-secondary" type="button" data-guide="back">${esc(w.back)}</button>` : ''}<button class="btn-primary" type="button" data-guide="${step ? 'done' : 'next'}">${esc(step ? w.done : w.next)}</button></div>
      <p class="guide-reopen">${esc(w.reopen)}</p>`;
    dialog.scrollTop = 0;
    dialog.querySelector('h2')?.focus();
  }

  function open() {
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'vertexGuide';
      dialog.className = 'vertex-guide';
      dialog.setAttribute('aria-labelledby','guideTitle');
      dialog.setAttribute('data-i18n-owned','');
      dialog.addEventListener('click', async event => {
        const action = event.target.closest('[data-guide]')?.dataset.guide;
        if (action === 'later') dialog.close();
        if (action === 'next') { step = 1; render(); }
        if (action === 'back') { step = 0; render(); }
        if (action === 'done') {
          const completedUser = user;
          const completedAt = new Date().toISOString();
          dialog.close();
          if (!completedUser) return;
          try { localStorage.setItem(key(completedUser.id), completedAt); } catch (_) {}
          await persist(completedUser.id, completedAt);
        }
      });
      document.body.appendChild(dialog);
    }
    step = 0;
    render();
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('h2')?.focus();
  }

  async function persist(id, completedAt) {
    if (!client || user?.id !== id) return;
    try {
      const { error } = await client.from('profiles').upsert({user_id:id,onboarding_completed_at:completedAt},{onConflict:'user_id'});
      if (error) console.warn('[Vertex guide] Could not sync completion.');
    } catch (_) { console.warn('[Vertex guide] Completion saved on this device.'); }
  }

  function onSession(db, activeUser) {
    client = db;
    user = activeUser;
    if ((activeUser?.id || null) === sessionUser) return;
    sessionUser = activeUser?.id || null;
    const ticket = ++revision;
    if (dialog?.open) dialog.close();
    if (!user || !client) return;
    const id = user.id;
    // Defer database calls until the synchronous auth callback releases its lock.
    setTimeout(async () => {
      try {
        const {data,error} = await db.from('profiles').select('onboarding_completed_at').eq('user_id',id).maybeSingle();
        if (ticket !== revision || error) return;
        if (data?.onboarding_completed_at) return;
        const completedAt = localDone(id);
        if (completedAt) { await persist(id,completedAt); return; }
        open();
      } catch (_) { /* The footer guide remains available during a database outage. */ }
    },0);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-open-guide]')) { event.preventDefault(); open(); }
  });
  document.addEventListener('vertex:languagechange', () => { if (dialog?.open) render(); });
  window.VertexGuide = {open,onSession};
})();
