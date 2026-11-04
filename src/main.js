import './styles.css';
import { glazeById, priceOf, productById, sizes, euros, clay } from './data/catalog.js';
import { mountCart, cart } from './cart.js';
import { asset } from './asset.js';
import { setupMotion, attachProcess, bump } from './motion.js';

document.documentElement.classList.add('js');

/* ---------- Menú en móvil y barra ---------- */
const menu = document.getElementById('menu');
const menuBtn = document.querySelector('.boton-menu');
menuBtn.addEventListener('click', () => {
  const open = menuBtn.getAttribute('aria-expanded') !== 'true';
  menuBtn.setAttribute('aria-expanded', String(open));
  menu.classList.toggle('is-open', open);
});
menu.addEventListener('click', (e) => {
  if (e.target.closest('a')) {
    menuBtn.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
  }
});
const bar = document.querySelector('.barra');
const onScroll = () => bar.toggleAttribute('data-scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- Cesta ---------- */
const cartUi = mountCart({ onAdd: () => bump(document.querySelector('.cesta-num')) });

/* ---------- Configurador (sin WebGL también funciona: precio y foto) ---------- */
const form = document.querySelector('[data-config-form]');
const state = { product: 'albufera', glaze: 'azul', size: 'm' };
const priceOut = form.querySelector('[data-config-price]');
const note = form.querySelector('[data-glaze-note]');
const caption = document.querySelector('[data-config-caption]');
const fallback = document.querySelector('[data-config-fallback]');
let configViewer = null;

function syncConfig() {
  const p = productById(state.product);
  const g = glazeById(state.glaze);
  priceOut.textContent = euros(priceOf(state.product, state.glaze, state.size));
  note.textContent = g.note;
  caption.textContent = `${p.name} en ${g.name}`;
  fallback.src = asset(`renders/${p.id}.webp`);
  for (const s of sizes) {
    const el = form.querySelector(`[data-size-dims="${s.id}"]`);
    const main = p.diameter > p.height ? p.diameter : p.height;
    el.textContent = `${Math.round(main * s.scale)} cm${p.diameter > p.height ? ' de ancho' : ' de alto'}`;
  }
}

function selectProduct(id, { glaze } = {}) {
  const p = productById(id);
  state.product = p.id;
  state.glaze = glaze ?? p.glaze;
  form.querySelector(`input[name="pieza"][value="${p.id}"]`).checked = true;
  form.querySelector(`input[name="esmalte"][value="${state.glaze}"]`).checked = true;
  syncConfig();
  configViewer?.show(p.id, { glaze: state.glaze, size: state.size, sweep: 0 }).then((v) => v.turn(1100));
}

form.addEventListener('change', (e) => {
  const { name, value } = e.target;
  if (name === 'pieza') return selectProduct(value);
  if (name === 'esmalte') {
    state.glaze = value;
    configViewer?.setGlaze(value);
  }
  if (name === 'tamano') {
    state.size = value;
    configViewer?.setSize(value);
  }
  syncConfig();
  bump(priceOut);
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  cart.add(state.product, state.glaze, state.size);
  const p = productById(state.product);
  cartUi.say(`${p.name} en ${glazeById(state.glaze).name}, en la cesta`);
  bump(document.querySelector('.cesta-num'));
});

// Enlaces «Ver en 3D» del catálogo: llevan la pieza al configurador.
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-config]');
  if (link) selectProduct(link.dataset.config);
});

syncConfig();

/* ---------- Visores 3D ---------- */
const live = (fig) => fig.classList.add('is-live');

// La semana de una pieza: del barro húmedo al esmalte cocido.
const final = glazeById('azul');
const stages = [
  { color: clay.raw, roughness: 0.34, clearcoat: 0.5, foot: clay.raw },
  { color: clay.leather, roughness: 0.82, clearcoat: 0, foot: clay.leather },
  { color: clay.bisque, roughness: 0.92, clearcoat: 0, foot: clay.bisque },
  { color: clay.glazeRaw, roughness: 0.96, clearcoat: 0, foot: clay.bisque },
  { color: '#1c0f0a', roughness: 0.3, clearcoat: 0.6, foot: '#3a1a0e', emissive: '#e8420c', emissiveIntensity: 1.05 },
  { color: final.color, roughness: final.roughness, clearcoat: final.clearcoat, foot: clay.foot },
];
const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Lunes'];

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s) => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
  const [r1, g1, b1] = ch(pa);
  const [r2, g2, b2] = ch(pb);
  const m = (x, y) => Math.round(x + (y - x) * t);
  return `#${((1 << 24) | (m(r1, r2) << 16) | (m(g1, g2) << 8) | m(b1, b2)).toString(16).slice(1)}`;
}

function processLook(s) {
  const i = Math.min(stages.length - 2, Math.floor(s));
  const t = Math.min(1, Math.max(0, s - i));
  const a = stages[i];
  const b = stages[i + 1];
  const lerp = (x = 0, y = 0) => x + (y - x) * t;
  return {
    color: mixHex(a.color, b.color, t),
    roughness: lerp(a.roughness, b.roughness),
    clearcoat: lerp(a.clearcoat, b.clearcoat),
    foot: mixHex(a.foot, b.foot, t),
    emissive: b.emissive ?? a.emissive ?? '#000000',
    emissiveIntensity: lerp(a.emissiveIntensity, b.emissiveIntensity),
  };
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

async function startViewers() {
  if (!webglAvailable()) return null;
  // three.js se carga aparte: el texto de la página no lo espera.
  const { Viewer } = await import('./three/viewer.js');
  const heroFig = document.querySelector('[data-viewer="hero"]');
  const configFig = document.querySelector('[data-viewer="config"]');
  const processFig = document.querySelector('[data-viewer="process"]');

  const hero = new Viewer(heroFig.querySelector('canvas'), { spin: 0.3, fit: 1.08 });
  await hero.show('albufera', { sweep: 0 });
  live(heroFig);
  heroFig.classList.remove('is-pending');
  hero.turn(2600);

  configViewer = new Viewer(configFig.querySelector('canvas'), { spin: 0.22, fit: 1.04, fitToLarge: true });
  await configViewer.show(state.product, { glaze: state.glaze, size: state.size });
  live(configFig);

  const process = new Viewer(processFig.querySelector('canvas'), {
    spin: 0.45,
    fit: 1.2,
    lineColor: '#eeefea',
    lineWidth: 2.2,
    interactive: false,
  });
  process.ground.material.opacity = 0.32;
  await process.show('albarelo', { sweep: 0 });
  process.setLook(processLook(0));
  live(processFig);

  const label = processFig.querySelector('[data-day-label]');
  return {
    /** s va de 0 (lunes en el torno) a 5 (lunes, de camino). */
    setStage(s) {
      process.setSweep(Math.min(1, s / 0.8));
      process.setLook(processLook(s));
      label.textContent = days[Math.min(5, Math.round(s))];
    },
  };
}

setupMotion();
if (webglAvailable()) document.querySelector('[data-viewer="hero"]').classList.add('is-pending');
startViewers()
  .then((scene) => scene && attachProcess(scene))
  .catch((err) => {
    console.warn('Visor 3D no disponible:', err);
    document.querySelectorAll('.visor').forEach((f) => f.classList.remove('is-pending'));
  });
