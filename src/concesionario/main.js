import './flyline.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { autoById, nombre, dolares, kms, cuota, numero } from './autos.js';
import { asset } from '../asset.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
document.documentElement.classList.add('js');
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const num1 = (n) => numero(n, 1);

/* ---------- Barra y menú ---------- */
const menu = document.getElementById('menu');
const menuBtn = document.querySelector('.boton-menu');
menuBtn.addEventListener('click', () => {
  const open = menuBtn.getAttribute('aria-expanded') !== 'true';
  menuBtn.setAttribute('aria-expanded', String(open));
  menu.classList.toggle('is-open', open);
});
menu.addEventListener('click', (e) => {
  if (!e.target.closest('a')) return;
  menuBtn.setAttribute('aria-expanded', 'false');
  menu.classList.remove('is-open');
});
const bar = document.querySelector('.barra');
const onScroll = () => bar.toggleAttribute('data-scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- Showroom: ficha, pestañas y cuota ---------- */
const state = { id: 'gt3rs' };
const ficha = document.getElementById('ficha');
const field = (k) => ficha.querySelector(`[data-f="${k}"]`);
const tabs = [...document.querySelectorAll('.pestana')];
const cuotaForm = document.querySelector('[data-cuota]');
const fallback = document.querySelector('[data-showroom-fallback]');
let showroom = null;

function updateCuota() {
  const a = autoById(state.id);
  const pct = Number(cuotaForm.enganche.value) / 100;
  const meses = Number(cuotaForm.querySelector('input[name="plazo"]:checked').value);
  cuotaForm.querySelector('[data-enganche-out]').textContent = `${Math.round(pct * 100)} % · ${dolares(a.precio * pct)}`;
  cuotaForm.querySelector('[data-cuota-out]').textContent = dolares(cuota(a.precio, pct, meses));
}
cuotaForm.addEventListener('input', updateCuota);
cuotaForm.addEventListener('submit', (e) => e.preventDefault());

function select(id, { focusTab = false } = {}) {
  const a = autoById(id);
  const changed = a.id !== state.id;
  state.id = a.id;
  field('nombre').textContent = nombre(a);
  field('meta').textContent = `${a.anio} · ${kms(a.km)} · ${a.color}`;
  field('resumen').textContent = a.resumen;
  field('potencia').textContent = `${a.potencia} CV`;
  field('aceleracion').textContent = `${num1(a.aceleracion)} s`;
  field('velocidad').textContent = `${a.velocidad} km/h`;
  field('motor').textContent = a.motor;
  field('caja').textContent = a.caja;
  field('precio').textContent = dolares(a.precio);
  field('fotos').hidden = a.fotos.length === 0;
  fallback.src = asset(`renders/autos/${a.id}.webp`);
  ficha.setAttribute('aria-labelledby', `tab-${a.id}`);
  tabs.forEach((t) => {
    const on = t.dataset.show === a.id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    if (on && focusTab) t.focus();
  });
  document.querySelector('[data-visit]').dataset.visit = a.id;
  updateCuota();
  if (changed && showroom) showroom.show(a.id).then((v) => v.reveal(1500));
}

tabs.forEach((t, i) =>
  t.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: tabs.length - 1 - i }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    select(tabs[(i + step + tabs.length) % tabs.length].dataset.show, { focusTab: true });
  }),
);

// Cualquier «Ver en 3D» de la página lleva el auto al showroom.
document.addEventListener('click', (e) => {
  const show = e.target.closest('[data-show]');
  if (show) select(show.dataset.show);
  const visit = e.target.closest('[data-visit]');
  if (visit?.dataset.visit) document.getElementById('v-auto').value = visit.dataset.visit;
});
select('gt3rs');

/* ---------- Comparativa: siluetas a escala ---------- */
const perfiles = document.querySelector('[data-perfiles]');
const svg = perfiles.querySelector('svg');
const tooltip = perfiles.querySelector('[data-tooltip]');
const etiqueta = svg.querySelector('[data-etiqueta]');
const grupos = [...svg.querySelectorAll('.perfil')];
const botones = [...perfiles.querySelectorAll('.leyenda-boton')];

function activar(id) {
  grupos.forEach((g) => g.classList.toggle('is-activo', g.dataset.perfil === id));
  botones.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.perfil === id)));
  const g = grupos.find((x) => x.dataset.perfil === id);
  // El activo se dibuja encima de los demás.
  svg.insertBefore(g, etiqueta);
  const [x, y] = g.dataset.peak.split(',').map(Number);
  const a = autoById(id);
  etiqueta.textContent = `${a.modelo} · ${numero(a.largo / 1000, 2)} m de largo`;
  etiqueta.setAttribute('x', String(x));
  etiqueta.setAttribute('y', String(y - 14));
  etiqueta.setAttribute('text-anchor', 'middle');
}
botones.forEach((b) => b.addEventListener('click', () => activar(b.dataset.perfil)));
grupos.forEach((g) => {
  g.addEventListener('pointerenter', () => g.classList.add('is-hover'));
  g.addEventListener('pointerleave', () => {
    g.classList.remove('is-hover');
    tooltip.hidden = true;
  });
  g.addEventListener('pointermove', (e) => {
    const box = perfiles.getBoundingClientRect();
    tooltip.textContent = g.dataset.dato;
    tooltip.hidden = false;
    const left = Math.min(e.clientX - box.left + 14, box.width - tooltip.offsetWidth - 4);
    tooltip.style.left = `${Math.max(0, left)}px`;
    tooltip.style.top = `${e.clientY - box.top - tooltip.offsetHeight - 12}px`;
  });
  g.addEventListener('click', () => activar(g.dataset.perfil));
});
activar('gt3rs');

/* ---------- Visita ---------- */
const form = document.querySelector('[data-visita]');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const err = form.querySelector('[data-error]');
  const ok = form.querySelector('[data-ok]');
  const missing = ['nombre', 'contacto'].filter((n) => !form[n].value.trim());
  ['nombre', 'contacto'].forEach((n) => form[n].setAttribute('aria-invalid', String(missing.includes(n))));
  if (missing.length) {
    err.textContent = 'Falta tu nombre y un teléfono o correo para confirmarte la cita.';
    err.hidden = false;
    form[missing[0]].focus();
    return;
  }
  err.hidden = true;
  const a = form.auto.value === 'otro' ? null : autoById(form.auto.value);
  const body = [
    `Nombre: ${form.nombre.value.trim()}`,
    `Contacto: ${form.contacto.value.trim()}`,
    `Auto: ${a ? `${nombre(a)} (${dolares(a.precio)})` : 'Otro / vender el mío'}`,
    `Día preferido: ${form.fecha.value || 'cualquiera'}`,
    '',
    form.mensaje.value.trim(),
  ].join('\n');
  ok.textContent = 'Se abrirá tu correo con la solicitud lista. Si no se abre, escríbenos a citas@flyline.example.';
  ok.hidden = false;
  window.location.href = `mailto:citas@flyline.example?subject=${encodeURIComponent('Cita en Flyline')}&body=${encodeURIComponent(body)}`;
});

/* ---------- Visores 3D ---------- */
function webgl() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function startViewers() {
  if (!webgl()) return;
  const { CarViewer } = await import('./visor.js');
  const heroFig = document.querySelector('[data-viewer="hero"]');
  const hero = new CarViewer(heroFig.querySelector('canvas'), { spin: 0.08, azimuth: 0.95, elevation: 0.16, fit: 0.98 });
  await hero.show('gt3rs');
  heroFig.classList.add('is-live');
  heroFig.classList.remove('is-pending');
  hero.reveal(2400);

  const roomFig = document.querySelector('[data-viewer="showroom"]');
  showroom = new CarViewer(roomFig.querySelector('canvas'), { spin: 0.12, azimuth: 0.85, elevation: 0.18, fit: 1.02 });
  showroom.ground.material.opacity = 0.45;
  await showroom.show(state.id);
  roomFig.classList.add('is-live');
}
if (webgl()) document.querySelector('[data-viewer="hero"]').classList.add('is-pending');
startViewers().catch((err) => {
  console.warn('Visor 3D no disponible:', err);
  document.querySelectorAll('.visor').forEach((f) => f.classList.remove('is-pending'));
});

/* ---------- Movimiento ---------- */
const mm = gsap.matchMedia();
mm.add('(prefers-reduced-motion: no-preference)', () => {
  document.fonts.ready.then(() => {
    const split = SplitText.create('.titular', { type: 'lines', mask: 'lines', aria: 'auto' });
    gsap
      .timeline({ defaults: { ease: 'expo.out' } })
      .from(split.lines, { yPercent: 110, duration: 1.1, stagger: 0.1 })
      .from('.portada-entrada', { y: 24, opacity: 0, duration: 0.9 }, '-=0.8')
      .from('.portada-lado .acciones > *', { y: 18, opacity: 0, duration: 0.8, stagger: 0.07 }, '-=0.7')
      .from('.portada-ficha > *', { y: 14, opacity: 0, duration: 0.8, stagger: 0.06 }, 0.9)
      .from('.marca, .menu a, .boton-barra', { y: -12, opacity: 0, duration: 0.7, stagger: 0.04 }, 0);
  });

  const groups = [
    ['#stock', ['.titulo-seccion', '.cabecera-texto']],
    ['#showroom', ['.titulo-seccion', '.pestana', '.ficha > *']],
    ['#comparar', ['.titulo-seccion', '.cabecera-texto', '.leyenda-boton', '.tabla-envoltura']],
    ['#garantia', ['.titulo-seccion', '.pasos li']],
    ['#visita', ['.titulo-seccion', '.visita-texto > p', '.contacto', '.formulario > *']],
    ['.pie', ['.pie-columnas > *']],
  ];
  for (const [sel, parts] of groups) {
    const root = document.querySelector(sel);
    const items = parts.flatMap((p) => [...root.querySelectorAll(p)]);
    ScrollTrigger.batch(items, {
      start: 'top 88%',
      once: true,
      onEnter: (batch) =>
        gsap.fromTo(batch, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.07, overwrite: true }),
    });
  }

  // Cada auto del stock entra rodando desde su lado.
  gsap.utils.toArray('.auto').forEach((row) => {
    const img = row.querySelector('.auto-foto img');
    const dir = row.classList.contains('is-invertido') ? 1 : -1;
    gsap
      .timeline({ scrollTrigger: { trigger: row, start: 'top 80%', once: true } })
      .from(img, { xPercent: 18 * dir, opacity: 0, duration: 1.3, ease: 'power3.out' })
      .from(row.querySelectorAll('.auto-texto > *'), { y: 22, opacity: 0, duration: 0.8, stagger: 0.07, ease: 'power3.out' }, 0.15);
  });

  // Las siluetas se dibujan de la trompa a la cola.
  const trazos = svg.querySelectorAll('.perfil-trazo');
  trazos.forEach((p) => {
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
  });
  gsap.to(trazos, {
    strokeDashoffset: 0,
    duration: 1.8,
    ease: 'power2.inOut',
    stagger: 0.15,
    scrollTrigger: { trigger: svg, start: 'top 80%', once: true },
    onComplete: () => trazos.forEach((p) => (p.style.strokeDasharray = 'none')),
  });

  const mark = SplitText.create('.pie-marca', { type: 'chars', aria: 'none' });
  gsap.from(mark.chars, {
    yPercent: 70,
    opacity: 0,
    stagger: 0.04,
    duration: 1,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.pie', start: 'top 85%', once: true },
  });
});
window.addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
