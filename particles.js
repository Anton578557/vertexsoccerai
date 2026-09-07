document.addEventListener('DOMContentLoaded', function() {
    tsParticles.load("particles-js", {
        particles: {
            number: { value: 60, density: { enable: true, value_area: 800 } },
            color: { value: ["#00d4ff", "#8b5cf6", "#00ff87"] },
            shape: { type: "circle" },
            opacity: { value: 0.4, random: true, anim: { enable: true, speed: 1, opacity_min: 0.1 } },
            size: { value: 2, random: true },
            line_linked: { enable: true, distance: 150, color: "#00d4ff", opacity: 0.2, width: 0.5 },
            move: { enable: true, speed: 0.8, random: true, out_mode: "out" }
        },
        interactivity: {
            detect_on: "canvas",
            events: {
                onhover: { enable: true, mode: "grab" },
                onclick: { enable: true, mode: "push" }
            },
            modes: {
                grab: { distance: 140, line_linked: { opacity: 0.4 } },
                push: { particles_nb: 3 }
            }
        },
        retina_detect: true
    });
});
