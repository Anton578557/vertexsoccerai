'use strict';

// Load the multilingual input/language enhancement layer.
(() => {
  if (document.querySelector('script[src^="language-input-v2.js"]')) return;
  const script = document.createElement('script');
  script.src = 'language-input-v2.js?v=2';
  script.async = true;
  document.head.appendChild(script);
})();

// Load the event-market presentation layer (corners/cards/shots/offsides).
(() => {
  if (document.querySelector('script[src^="granular-ui-v1.js"]')) return;
  const script = document.createElement('script');
  script.src = 'granular-ui-v1.js?v=1';
  script.async = true;
  document.head.appendChild(script);
})();

// Load cloud persistence / verified-results synchronization.
(() => {
  if (document.querySelector('script[src^="runtime-sync-v1.js"]')) return;
  const script = document.createElement('script');
  script.src = 'runtime-sync-v1.js?v=1';
  script.async = true;
  document.head.appendChild(script);
})();

// Load the production Contact form wired to /api/contact -> Resend.
(() => {
  if (document.querySelector('script[src^="contact-runtime-v1.js"]')) return;
  const script = document.createElement('script');
  script.src = 'contact-runtime-v1.js?v=1';
  script.async = true;
  document.head.appendChild(script);
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
      .replace(/\s+[\-–—]\s+/g, ' vs ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

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
          value: 66,
          density: { enable: true, area: 1040 }
        },
        color: {
          value: ['#24dcff', '#24dcff', '#24dcff', '#24dcff', '#55adff', '#39e6b0']
        },
        shape: { type: 'circle' },
        opacity: {
          value: { min: 0.30, max: 0.76 },
          animation: {
            enable: true,
            speed: 0.34,
            minimumValue: 0.20,
            sync: false
          }
        },
        size: {
          value: { min: 1.0, max: 2.75 },
          animation: {
            enable: true,
            speed: 0.42,
            minimumValue: 0.8,
            sync: false
          }
        },
        links: {
          enable: true,
          distance: 158,
          color: '#2ad8ef',
          opacity: 0.22,
          width: 0.82,
          triangles: { enable: false }
        },
        move: {
          enable: true,
          speed: 0.30,
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
