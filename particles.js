'use strict';

// Visual layer only. Runtime modules are loaded explicitly from index.html
// so their order is deterministic and analysis cannot race module injection.
document.addEventListener('DOMContentLoaded', async () => {
  const host = document.getElementById('particles-js');
  if (!host) return;

  if (!window.tsParticles?.load) {
    console.warn('[Vertex] tsParticles library did not load.');
    return;
  }

  try {
    await window.tsParticles.load('particles-js', {
      fpsLimit: 42,
      fullScreen: { enable: false },
      detectRetina: false,
      particles: {
        number: {
          value: 44,
          density: { enable: true, area: 1220 }
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
          speed: 0.22,
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
