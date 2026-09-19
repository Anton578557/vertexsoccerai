'use strict';

(() => {
  if (window.__vertexAnalyzerStabilityV1) return;
  window.__vertexAnalyzerStabilityV1 = true;

  let busy = false;
  let stageTimer = null;
  let stageIndex = 0;

  const copy = {
    en: {
      button: 'COLLECTING DATA',
      kicker: 'VERTEX DATA MESH',
      title: 'Building the match intelligence layer',
      foot: 'Analysis in progress — one request at a time',
      stages: [
        'Resolving teams and competition…',
        'Collecting recent form and completed matches…',
        'Checking squad, news and match context…',
        'Cross-checking sources and data quality…',
        'Calculating Vertex probabilities and confidence…'
      ]
    },
    ru: {
      button: 'СОБИРАЕМ ДАННЫЕ',
      kicker: 'СЕТЬ ДАННЫХ VERTEX',
      title: 'Собираем картину матча',
      foot: 'Идёт анализ — одновременно выполняется только один запрос',
      stages: [
        'Определяем команды и турнир…',
        'Собираем форму и последние завершённые матчи…',
        'Проверяем состав, новости и контекст матча…',
        'Сверяем источники и качество данных…',
        'Рассчитываем вероятности и достоверность Vertex…'
      ]
    },
    es: {
      button: 'RECOPILANDO DATOS',
      kicker: 'RED DE DATOS VERTEX',
      title: 'Construyendo el contexto del partido',
      foot: 'Análisis en curso — una sola solicitud a la vez',
      stages: [
        'Identificando equipos y competición…',
        'Recopilando forma reciente y partidos finalizados…',
        'Revisando plantilla, noticias y contexto…',
        'Contrastando fuentes y calidad de datos…',
        'Calculando probabilidades y confianza de Vertex…'
      ]
    }
  };

  function lang() {
    return window.VertexI18n?.getLanguage?.() || localStorage.getItem('vertex_language') || 'en';
  }

  function currentCopy() {
    return copy[lang()] || copy.en;
  }

  function isAnalyzeRequest(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url || '';
      const url = new URL(raw, window.location.origin);
      return url.origin === window.location.origin && url.pathname === '/api/analyze';
    } catch (_) {
      return false;
    }
  }

  function meshMarkup() {
    const c = currentCopy();
    return `
      <div class="vertex-analysis-loader" role="status" aria-live="polite">
        <div class="vertex-loader-mesh" aria-hidden="true">
          <span class="vertex-loader-ring ring-a"></span>
          <span class="vertex-loader-ring ring-b"></span>
          <span class="vertex-loader-link link-a"></span>
          <span class="vertex-loader-link link-b"></span>
          <span class="vertex-loader-link link-c"></span>
          <span class="vertex-loader-node node-a"></span>
          <span class="vertex-loader-node node-b"></span>
          <span class="vertex-loader-node node-c"></span>
          <span class="vertex-loader-node node-d"></span>
          <span class="vertex-loader-node node-e"></span>
          <span class="vertex-loader-core"><i></i></span>
        </div>
        <div class="vertex-loader-copy">
          <span class="vertex-loader-kicker">${c.kicker}</span>
          <h3>${c.title}</h3>
          <p id="vertexAnalysisStage">${c.stages[0]}</p>
          <div class="vertex-loader-track" aria-hidden="true"><i></i></div>
          <div class="vertex-loader-foot"><span></span>${c.foot}</div>
        </div>
      </div>`;
  }

  function renderLoader() {
    const target = document.getElementById('analysisResult');
    if (!target) return;
    target.innerHTML = meshMarkup();
    stageIndex = 0;
    clearInterval(stageTimer);
    stageTimer = setInterval(() => {
      if (!busy) return;
      const c = currentCopy();
      stageIndex = (stageIndex + 1) % c.stages.length;
      const node = document.getElementById('vertexAnalysisStage');
      if (!node) return;
      node.classList.remove('vertex-stage-in');
      node.textContent = c.stages[stageIndex];
      requestAnimationFrame(() => node.classList.add('vertex-stage-in'));
    }, 3600);
  }

  function stopLoaderTimer() {
    clearInterval(stageTimer);
    stageTimer = null;
  }

  function setButtonBusy(button, next) {
    if (!button) return;
    if (next) {
      if (!button.dataset.vertexIdleHtml) button.dataset.vertexIdleHtml = button.innerHTML;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.innerHTML = `<span class="vertex-button-mesh" aria-hidden="true"><i></i><i></i><i></i><b></b></span><span>${currentCopy().button}</span>`;
    } else {
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
      if (button.dataset.vertexIdleHtml) button.innerHTML = button.dataset.vertexIdleHtml;
    }
  }

  function setBusy(next) {
    busy = Boolean(next);
    document.documentElement.dataset.analysisBusy = busy ? 'true' : 'false';
    ['btnAnalyzeMatch', 'btnAnalyze'].forEach((id) => setButtonBusy(document.getElementById(id), busy));

    if (busy) renderLoader();
    else stopLoaderTimer();

    try {
      const instance = window.tsParticles?.dom?.()?.[0] || window.tsParticles?.domItem?.(0);
      if (busy) instance?.pause?.();
      else instance?.play?.();
    } catch (_) {}
  }

  function ensureStyle() {
    if (document.getElementById('vertexAnalyzerStabilityStyle')) return;
    const style = document.createElement('style');
    style.id = 'vertexAnalyzerStabilityStyle';
    style.textContent = `
      html[data-analysis-busy="true"] #particles-js{opacity:.24;transition:opacity .22s ease}
      #btnAnalyzeMatch[disabled],#btnAnalyze[disabled]{cursor:not-allowed;opacity:.92;filter:saturate(.92);pointer-events:none;box-shadow:0 0 28px rgba(31,215,255,.12),inset 0 0 28px rgba(31,215,255,.05)}
      #btnAnalyzeMatch[aria-busy="true"],#btnAnalyze[aria-busy="true"]{display:flex;align-items:center;justify-content:center;gap:12px;letter-spacing:.055em}
      .vertex-button-mesh{position:relative;width:27px;height:18px;display:inline-block;flex:0 0 27px}
      .vertex-button-mesh i{position:absolute;width:5px;height:5px;border-radius:50%;background:#e8fbff;box-shadow:0 0 8px #3fe8ff;animation:vertexBtnPulse 1.15s ease-in-out infinite}
      .vertex-button-mesh i:nth-child(1){left:1px;top:7px}.vertex-button-mesh i:nth-child(2){left:11px;top:1px;animation-delay:.16s}.vertex-button-mesh i:nth-child(3){right:1px;top:10px;animation-delay:.32s}
      .vertex-button-mesh b,.vertex-button-mesh:before{content:'';position:absolute;height:1px;background:linear-gradient(90deg,rgba(86,232,255,.1),rgba(86,232,255,.85),rgba(86,232,255,.1));transform-origin:left center}
      .vertex-button-mesh b{width:13px;left:4px;top:8px;transform:rotate(-30deg)}.vertex-button-mesh:before{width:13px;left:14px;top:5px;transform:rotate(38deg)}

      .vertex-analysis-loader{min-height:300px;display:grid;grid-template-columns:220px minmax(0,1fr);align-items:center;gap:40px;padding:38px 46px;border:1px solid rgba(42,218,244,.19);border-radius:20px;background:linear-gradient(145deg,rgba(4,16,27,.92),rgba(5,13,24,.78));box-shadow:0 24px 80px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.025);overflow:hidden;position:relative}
      .vertex-analysis-loader:before{content:'';position:absolute;inset:auto -15% -65% 30%;height:260px;background:radial-gradient(circle,rgba(38,219,255,.11),transparent 68%);pointer-events:none}
      .vertex-loader-mesh{position:relative;width:190px;height:190px;margin:auto;filter:drop-shadow(0 0 15px rgba(34,218,255,.15))}
      .vertex-loader-ring{position:absolute;border-radius:50%;border:1px solid rgba(53,220,255,.16);inset:22px;animation:vertexRing 8s linear infinite}.vertex-loader-ring.ring-b{inset:42px;border-color:rgba(124,92,255,.2);animation-direction:reverse;animation-duration:5.8s}
      .vertex-loader-ring:before,.vertex-loader-ring:after{content:'';position:absolute;width:5px;height:5px;border-radius:50%;background:#3ce9ff;box-shadow:0 0 10px #29ddff}.vertex-loader-ring:before{top:-3px;left:50%}.vertex-loader-ring:after{bottom:-3px;left:24%;background:#8c79ff;box-shadow:0 0 10px #7c5cff}
      .vertex-loader-core{position:absolute;left:50%;top:50%;width:58px;height:58px;transform:translate(-50%,-50%);border:1px solid rgba(67,232,255,.5);border-radius:15px;background:radial-gradient(circle at 50% 45%,rgba(52,231,255,.22),rgba(4,17,28,.92) 65%);box-shadow:0 0 24px rgba(31,222,255,.14),inset 0 0 18px rgba(39,218,255,.06);display:grid;place-items:center;animation:vertexCoreFloat 2.8s ease-in-out infinite}
      .vertex-loader-core:before,.vertex-loader-core:after{content:'';position:absolute;border:1px solid rgba(64,223,255,.16);border-radius:12px;inset:-8px;animation:vertexCoreScan 2s ease-in-out infinite}.vertex-loader-core:after{inset:-17px;border-color:rgba(124,92,255,.12);animation-delay:.55s}
      .vertex-loader-core i{width:8px;height:8px;border-radius:50%;background:#69f0ff;box-shadow:0 0 8px #35e4ff,0 0 20px rgba(53,228,255,.8);animation:vertexCorePulse 1.25s ease-in-out infinite}
      .vertex-loader-node{position:absolute;width:8px;height:8px;border-radius:50%;background:#34e3ff;box-shadow:0 0 10px rgba(52,227,255,.9);animation:vertexNode 1.8s ease-in-out infinite}.vertex-loader-node.node-a{left:18px;top:54px}.vertex-loader-node.node-b{right:24px;top:28px;animation-delay:.25s}.vertex-loader-node.node-c{right:11px;bottom:49px;animation-delay:.5s}.vertex-loader-node.node-d{left:35px;bottom:20px;animation-delay:.75s}.vertex-loader-node.node-e{left:10px;top:121px;animation-delay:1s;background:#8d7bff;box-shadow:0 0 10px rgba(124,92,255,.9)}
      .vertex-loader-link{position:absolute;height:1px;transform-origin:left center;background:linear-gradient(90deg,rgba(49,224,255,.05),rgba(49,224,255,.48),rgba(49,224,255,.04));opacity:.7;animation:vertexLink 1.9s ease-in-out infinite}.vertex-loader-link.link-a{width:70px;left:25px;top:59px;transform:rotate(25deg)}.vertex-loader-link.link-b{width:74px;left:99px;top:74px;transform:rotate(-35deg);animation-delay:.4s}.vertex-loader-link.link-c{width:81px;left:44px;top:145px;transform:rotate(-48deg);animation-delay:.8s}
      .vertex-loader-copy{position:relative;z-index:1}.vertex-loader-kicker{font:600 10px/1.2 'JetBrains Mono',monospace;letter-spacing:.19em;color:#4ee5ff}.vertex-loader-copy h3{margin:10px 0 8px;font-size:clamp(22px,2.5vw,31px);line-height:1.15;color:#f5fbff}.vertex-loader-copy p{min-height:28px;margin:0;color:#a8bbc7;font-size:14px;line-height:1.55;transition:opacity .18s ease,transform .18s ease}.vertex-loader-copy p.vertex-stage-in{animation:vertexStageIn .28s ease}
      .vertex-loader-track{height:3px;margin:21px 0 13px;overflow:hidden;border-radius:99px;background:rgba(92,211,236,.08);position:relative}.vertex-loader-track i{position:absolute;inset:0 auto 0 -35%;width:35%;border-radius:99px;background:linear-gradient(90deg,transparent,#27dfff,#8070ff,transparent);box-shadow:0 0 14px rgba(40,222,255,.45);animation:vertexTrack 2.4s cubic-bezier(.45,0,.55,1) infinite}
      .vertex-loader-foot{display:flex;align-items:center;gap:9px;color:#6f8797;font:500 10px/1.45 'JetBrains Mono',monospace;letter-spacing:.035em}.vertex-loader-foot>span{width:6px;height:6px;border-radius:50%;background:#23e6a8;box-shadow:0 0 9px rgba(35,230,168,.8);animation:vertexNode 1.4s ease-in-out infinite}

      @keyframes vertexBtnPulse{0%,100%{transform:scale(.72);opacity:.45}50%{transform:scale(1.18);opacity:1}}
      @keyframes vertexRing{to{transform:rotate(360deg)}}
      @keyframes vertexCoreFloat{0%,100%{transform:translate(-50%,-50%) translateY(0)}50%{transform:translate(-50%,-50%) translateY(-4px)}}
      @keyframes vertexCoreScan{0%,100%{opacity:.15;transform:scale(.94)}50%{opacity:.7;transform:scale(1.04)}}
      @keyframes vertexCorePulse{0%,100%{transform:scale(.8);opacity:.55}50%{transform:scale(1.25);opacity:1}}
      @keyframes vertexNode{0%,100%{opacity:.35;transform:scale(.72)}50%{opacity:1;transform:scale(1.16)}}
      @keyframes vertexLink{0%,100%{opacity:.22}50%{opacity:.82}}
      @keyframes vertexTrack{0%{left:-38%}55%{left:82%}100%{left:115%}}
      @keyframes vertexStageIn{from{opacity:.25;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}

      @media (max-width:700px){.vertex-analysis-loader{grid-template-columns:1fr;gap:10px;padding:28px 20px;text-align:center}.vertex-loader-mesh{width:150px;height:150px;transform:scale(.84);transform-origin:center}.vertex-loader-foot{justify-content:center}.vertex-loader-copy h3{font-size:22px}}
      @media (prefers-reduced-motion:reduce){.vertex-analysis-loader *, .vertex-button-mesh *{animation-duration:8s!important;animation-iteration-count:1!important}.vertex-loader-track i{animation:none;left:32%;width:36%}}
    `;
    document.head.appendChild(style);
  }

  // Analysis networking is owned by script.js. Keeping the busy lifecycle
  // outside window.fetch prevents nested fetch wrappers, response cloning and
  // premature unlocks while JSON parsing / report rendering is still running.
  window.VertexAnalyzerState = Object.freeze({
    begin() {
      if (busy) return false;
      setBusy(true);
      return true;
    },
    end() {
      if (!busy) return;
      setBusy(false);
    },
    isBusy() {
      return busy;
    }
  });

  // Block accidental repeat clicks and Enter presses while one analysis is running.
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#btnAnalyzeMatch, #btnAnalyze');
    if (!button || !busy) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (!busy || event.key !== 'Enter') return;
    if (!event.target.closest?.('#searchInput, #analyzerSearch')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('vertex:languagechange', () => {
    if (!busy) return;
    ['btnAnalyzeMatch', 'btnAnalyze'].forEach((id) => setButtonBusy(document.getElementById(id), true));
    renderLoader();
  });

  ensureStyle();
})();
