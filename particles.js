document.addEventListener('DOMContentLoaded', function() {
    tsParticles.load("particles-js", {
        particles: {
            number: { value: 100, density: { enable: true, value_area: 800 } },
            color: { value: ["#00d4ff", "#8b5cf6", "#00ff87", "#ffffff"] },
            shape: { type: "circle" },
            opacity: { value: 0.7, random: true, anim: { enable: true, speed: 1, opacity_min: 0.3 } },
            size: { value: 3, random: true, anim: { enable: true, speed: 2, size_min: 1 } },
            line_linked: { enable: true, distance: 150, color: "#00d4ff", opacity: 0.5, width: 1 },
            move: { enable: true, speed: 1.5, direction: "none", random: true, out_mode: "out" }
        },
        interactivity: {
            detect_on: "canvas",
            events: {
                onhover: { enable: true, mode: "grab" },
                onclick: { enable: true, mode: "push" },
                resize: true
            },
            modes: {
                grab: { distance: 140, line_linked: { opacity: 0.6 } },
                push: { particles_nb: 4 }
            }
        },
        retina_detect: true
    });
});
