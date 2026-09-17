'use strict';

// Load runtime modules in a deterministic order. This avoids race conditions
// between auth, cloud sync, multilingual input and contact wiring.
(() => {
  const queue = [
    'language-input-v2.js?v=2',
    'granular-ui-v1.js?v=1',
    'auth-api-runtime-v1.js?v=1',
    'runtime-sync-v1.js?v=2',
    'contact-runtime-v1.js?v=1',
    'polish-v7.js?v=7',
    'polish-v7-hotfix.js?v=1',
    'polish-v8.js?v=8'
  ];

  function exists(src) {
    const base = src.split('?')[0];
    return Boolean(document.querySelector(`script[src^="${base}"]`));
  }

  function load(index) {
    if (index >= queue.length) return;
    const src = queue[index];
    if (exists(src)) return load(index + 1);
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => load(index + 1);
    script.onerror = () => {
      console.warn('[Vertex] Runtime module failed:', src);
      load(index + 1);
    };
    document.head.appendChild(script);
  }

  load(0);
})();

// Compatibility fixes that must run before user interaction.
(() => {
  // Force future Supabase email-confirmation links to point back to production.
  const originalCreateClient = window.supabase?.createClient;
  if (typeof originalCreateClient === 'function' && !window.__vertexSupabasePatched) {
    window.__vertexSupabasePatched = true;
    window.supabase.createClient = function patchedCreateClient(...args) {
      const client = originalCreateClient.apply(this, args);
      if (client?.auth?.signUp && !client.auth.__vertexSignUpPatched) {
        const originalSignUp = client.auth.signUp.bind(client.auth);
        client.auth.signUp = (credentials = {}) => {
          const options = {
            ...(credentials.options || {}),
            emailRedirectTo: 'https://vertexsoccerai.com/'
          };
          return originalSignUp({ ...credentials, options });
        };
        client.auth.__vertexSignUpPatched = true;
      }
      return client;
    };
  }

  function normalizeMatchSeparator(value) {
    return String(value || '')
      .replace(/\s+(?:против|contra|versus|vs\.?|v\.?)\s+/gi, ' vs ')
      .replace(/\s*[–—]\s*/g, ' vs ')
      .replace(/(\S)\s*-\s+(\S)/g, '$1 vs $2')
      .replace(/(\S)\s+-\s*(\S)/g, '$1 vs $2')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  document.addEventListener('input', (event) => {
    const input = event.target.closest?.('#searchInput, #analyzerSearch');
    if (input) input.value = normalizeMatchSeparator(input.value);
  }, true);

  document.addEventListener('click', (event) => {
    const button = event.target.closest('#btnAnalyze, #btnAnalyzeMatch');
    if (!button) return;
    const input = button.id === 'btnAnalyze' ? document.getElementById('searchInput') : document.getElementById('analyzerSearch');
    if (input) input.value = normalizeMatchSeparator(input.value);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const input = event.target.closest?.('#searchInput, #analyzerSearch');
    if (input) input.value = normalizeMatchSeparator(input.value);
  }, true);
})();

document.addEventListener('DOMContentLoaded', async () => {
  const host = document.getElementById('particles-js');
  if (!host) return;

  if (!window.tsParticles?.load) {
    console.warn('[Vertex] tsParticles library did not load.');
    return;
  }

  try {
    await window.tsParticles.load('particles-js', {
      fpsLimit: 45,
      fullScreen: { enable: false },
      detectRetina: false,
      particles: {
        number: {
          value: 48,
          density: { enable: true, area: 1180 }
        },
        color: {
          value: ['#24dcff', '#24dcff', '#24dcff', '#24dcff', '#55adff', '#39e6b0']
        },
        shape: { type: 'circle' },
        opacity: {
          value: { min: 0.28, max: 0.66 },
          animation: { enable: false }
        },
        size: {
          value: { min: 1.0, max: 2.55 },
          animation: { enable: false }
        },
        links: {
          enable: true,
          distance: 150,
          color: '#2ad8ef',
          opacity: 0.19,
          width: 0.78,
          triangles: { enable: false }
        },
        move: {
          enable: true,
          speed: 0.24,
          direction: 'none',
          random: false,
          straight: false,
          outModes: { default: 'out' },
          attract: { enable: false }
        }
      },
      interactivity: {
        detectsOn: 'canvas',
        events: {
          onHover: { enable: false },
          onClick: { enable: false },
          resize: true
        }
      },
      background: { color: 'transparent' },
      pauseOnBlur: true,
      pauseOnOutsideViewport: true
    });
  } catch (error) {
    console.warn('[Vertex] particles:', error?.message || error);
  }
});
