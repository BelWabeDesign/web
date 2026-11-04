// Capa de movimiento. Todo es transform y opacidad, y con «reducir movimiento»
// el contenido aparece quieto. Si este archivo falla, la página se lee igual:
// nada empieza oculto en el HTML ni en el CSS.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Pequeño golpe de escala para confirmar un cambio (precio, contador de la cesta). */
export function bump(el) {
  if (!el || reduce()) return;
  gsap.fromTo(el, { scale: 1.25 }, { scale: 1, duration: 0.5, ease: 'back.out(3)', overwrite: true });
}

let processScene = null;
let lastStage = -1;

/** El visor de «La hornada» llega cuando su modelo ha cargado. */
export function attachProcess(scene) {
  processScene = scene;
  document.querySelector('.hornada')?.classList.add('js-scene');
  ScrollTrigger.refresh();
  if (lastStage >= 0) scene.setStage(lastStage);
}

export function setupMotion() {
  const mm = gsap.matchMedia();

  // La semana de la pieza avanza con el scroll (también con movimiento reducido:
  // es un cambio de estado, no un desplazamiento).
  const days = [...document.querySelectorAll('.dia')];
  const stageTrigger = (start, end) =>
    ScrollTrigger.create({
      trigger: '.dias',
      start,
      end,
      onUpdate(self) {
        const s = self.progress * 5;
        lastStage = s;
        processScene?.setStage(s);
        const on = Math.min(5, Math.round(s));
        days.forEach((d, i) => d.classList.toggle('is-on', i === on));
      },
    });
  // En móvil el visor tapa la mitad de arriba: la línea de lectura va más abajo.
  mm.add('(min-width: 861px)', () => {
    stageTrigger('top 62%', 'bottom 70%');
  });
  mm.add('(max-width: 860px)', () => {
    stageTrigger('top 80%', 'bottom 92%');
  });
  days[0]?.classList.add('is-on');

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // Portada: el titular sube por líneas, luego el texto y la ficha.
    document.fonts.ready.then(() => {
      const split = SplitText.create('.portada-titulo', { type: 'lines', mask: 'lines', aria: 'auto' });
      gsap
        .timeline({ defaults: { ease: 'expo.out' } })
        .from(split.lines, { yPercent: 110, duration: 1.1, stagger: 0.09 })
        .from('.portada-entrada', { y: 24, opacity: 0, duration: 0.9 }, '-=0.75')
        .from('.portada-acciones > *', { y: 20, opacity: 0, duration: 0.8, stagger: 0.07 }, '-=0.7')
        .from('.portada-pieza', { y: 24, opacity: 0, duration: 0.9 }, '-=0.6')
        .from('.marca, .menu a, .boton-cesta', { y: -12, opacity: 0, duration: 0.7, stagger: 0.04 }, 0);
    });

    // Entrada de cada sección: el titular, luego el texto, luego las imágenes.
    const groups = [
      ['#piezas', ['.titulo-seccion', '.cabecera-texto', '.pieza']],
      ['#esmaltes', ['.titulo-seccion', '.config-entrada', '.grupo', '.config-compra']],
      ['#hornada', ['.titulo-seccion', '.hornada-entrada']],
      ['#manises', ['.titulo-seccion', '.manises-texto', '.foto']],
      ['#envios', ['.titulo-seccion', '.cifras > div', 'details']],
      ['.pie', ['.pie-columnas > div', '.pie-firma']],
    ];
    for (const [section, selectors] of groups) {
      const root = document.querySelector(section);
      if (!root) continue;
      const items = selectors.flatMap((s) => [...root.querySelectorAll(s)]);
      ScrollTrigger.batch(items, {
        start: 'top 88%',
        once: true,
        onEnter: (batch) =>
          gsap.fromTo(
            batch,
            { y: 28, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.08, overwrite: true },
          ),
      });
    }

    // Las fotos del catálogo entran con un pequeño giro, como sobre el torno.
    gsap.utils.toArray('.pieza-foto img').forEach((img) => {
      gsap.from(img, {
        rotate: -4,
        scale: 0.94,
        duration: 1.2,
        ease: 'power3.out',
        scrollTrigger: { trigger: img, start: 'top 90%', once: true },
      });
    });

    // Manises: el plato se acerca despacio mientras pasa; el resto se desliza un poco.
    gsap.fromTo(
      '.foto-plato img',
      { scale: 1.14 },
      { scale: 1, ease: 'none', scrollTrigger: { trigger: '.foto-plato', start: 'top bottom', end: 'bottom 40%', scrub: true } },
    );
    gsap.utils.toArray('.foto:not(.foto-plato) img').forEach((img, i) => {
      gsap.fromTo(
        img,
        { yPercent: 6 + (i % 2) * 4, scale: 1.08 },
        {
          yPercent: -4,
          scale: 1.08,
          ease: 'none',
          scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
        },
      );
    });

    // El nombre del taller sube a su sitio al final de la página.
    const mark = SplitText.create('.pie-marca', { type: 'chars', aria: 'none' });
    gsap.from(mark.chars, {
      yPercent: 60,
      opacity: 0,
      ease: 'power3.out',
      stagger: 0.05,
      duration: 1,
      scrollTrigger: { trigger: '.pie', start: 'top 85%', once: true },
    });
  });

  // Recalcular posiciones cuando cargan fuentes e imágenes.
  window.addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
