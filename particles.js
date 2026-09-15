'use strict';

// Compatibility fixes that must run before the main UI boot handler.
(() => {
  // Force future Supabase email-confirmation links to point back to production.
  // Supabase Dashboard must also allow https://vertexsoccerai.com/ as a Redirect URL.
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
      .replace(/\s+[\-–—]\s+/g, ' vs ')
      .replace(/\s+(?:versus)\s+/gi, ' vs ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // Accept natural input such as "Elche - Real Madrid" in addition to "Elche vs Real Madrid".
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
      fpsLimit: 60,
      fullScreen: { enable: false },
      detectRetina: true,
      particles: {
        number: {
          value: 76,
          density: { enable: true, area: 980 }
        },
        color: {
          value: ['#27e2ff', '#5ab5ff', '#8b72ff']
        },
        shape: { type: 'circle' },
        opacity: {
          value: { min: 0.34, max: 0.82 },
          animation: {
            enable: true,
            speed: 0.55,
            minimumValue: 0.24,
            sync: false
          }
        },
        size: {
          value: { min: 1.15, max: 3.15 },
          animation: {
            enable: true,
            speed: 0.75,
            minimumValue: 0.9,
            sync: false
          }
        },
        links: {
          enable: true,
          distance: 175,
          color: '#28d9ff',
          opacity: 0.29,
          width: 1.05,
          triangles: { enable: false }
        },
        move: {
          enable: true,
          speed: 0.48,
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
