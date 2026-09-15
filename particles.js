document.addEventListener('DOMContentLoaded', function () {
    tsParticles.load('particles-js', {
        fpsLimit: 60,
        fullScreen: { enable: false },
        detectRetina: true,
        particles: {
            number: {
                value: 58,
                density: { enable: true, area: 1150 }
            },
            color: {
                value: ['#16d9ff', '#4ea7ff', '#7c5cff']
            },
            shape: { type: 'circle' },
            opacity: {
                value: { min: 0.18, max: 0.52 },
                animation: {
                    enable: true,
                    speed: 0.45,
                    minimumValue: 0.12,
                    sync: false
                }
            },
            size: {
                value: { min: 0.8, max: 2.2 },
                animation: {
                    enable: true,
                    speed: 0.7,
                    minimumValue: 0.6,
                    sync: false
                }
            },
            links: {
                enable: true,
                distance: 165,
                color: '#18c9f5',
                opacity: 0.16,
                width: 0.8,
                triangles: { enable: false }
            },
            move: {
                enable: true,
                speed: 0.55,
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
                onHover: { enable: true, mode: 'grab' },
                onClick: { enable: false },
                resize: true
            },
            modes: {
                grab: {
                    distance: 125,
                    links: { opacity: 0.28 }
                }
            }
        },
        background: { color: 'transparent' },
        pauseOnBlur: true,
        pauseOnOutsideViewport: true
    });
});
