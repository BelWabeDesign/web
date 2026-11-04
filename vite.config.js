import { defineConfig } from 'vite';
import { CatmullRomCurve3, Vector3 } from 'three';
import { products, glazes, sizes, euros, priceOf, glazeById } from './src/data/catalog.js';
import { autos, dolares, kms, numero } from './src/concesionario/autos.js';

// Escribe en el HTML, al servir y al compilar, las fichas del catálogo y los
// controles del configurador a partir de src/data/catalog.js. Así la página
// tiene todo su contenido aunque el JavaScript o el WebGL no lleguen a cargar.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const layout = {
  albufera: 'is-wide is-tall',
  turia: '',
  albarelo: '',
  horno: '',
  alba: '',
  reflejo: 'is-wide',
};

function catalogo() {
  return products
    .map((p) => {
      const g = glazeById(p.glaze);
      const dims = p.diameter > p.height ? `Ø ${p.diameter} × ${p.height} cm` : `${p.height} × Ø ${p.diameter} cm`;
      return `
        <article class="pieza ${layout[p.id] ?? ''}" data-product="${p.id}">
          <a class="pieza-foto" href="#esmaltes" data-config="${p.id}" aria-label="Ver ${esc(p.name)} en 3D">
            <img src="./renders/${p.id}.webp" width="1000" height="1250" loading="lazy" decoding="async"
                 alt="${esc(p.name)} en ${esc(g.name)}, modelo 3D renderizado" />
          </a>
          <div class="pieza-texto">
            <h3 class="pieza-nombre">${esc(p.name)}</h3>
            <p class="pieza-precio">${euros(p.price)}</p>
            <p class="pieza-linea">${esc(p.line)}</p>
            <p class="pieza-meta">${dims} · ${esc(g.name)}</p>
            <div class="pieza-acciones">
              <button class="boton boton-tinta" type="button" data-add="${p.id}">Añadir a la cesta</button>
              <a class="enlace" href="#esmaltes" data-config="${p.id}">Ver en 3D y elegir esmalte</a>
            </div>
          </div>
        </article>`;
    })
    .join('');
}

function piezas() {
  return products
    .map(
      (p, i) => `
        <label class="opcion-pieza">
          <input type="radio" name="pieza" value="${p.id}" ${i === 0 ? 'checked' : ''} />
          <img src="./renders/${p.id}-sm.webp" width="240" height="300" alt="" loading="lazy" />
          <span>${esc(p.kind)}</span>
        </label>`,
    )
    .join('');
}

function esmaltes() {
  return glazes
    .map(
      (g, i) => `
        <label class="opcion-esmalte">
          <input type="radio" name="esmalte" value="${g.id}" ${i === 0 ? 'checked' : ''} />
          <span class="muestra" style="--muestra:${g.color}"></span>
          <span class="opcion-nombre">${esc(g.name)}${g.extra ? ` <span class="opcion-extra">+${g.extra} €</span>` : ''}</span>
        </label>`,
    )
    .join('');
}

function tamanos() {
  const p = products[0];
  return sizes
    .map(
      (s) => `
        <label class="opcion-tamano">
          <input type="radio" name="tamano" value="${s.id}" ${s.id === 'm' ? 'checked' : ''} />
          <span class="opcion-nombre">${esc(s.name)}</span>
          <span class="opcion-dato" data-size-dims="${s.id}">${Math.round(p.height * s.scale)} cm</span>
        </label>`,
    )
    .join('');
}

// ---------- Flyline (concesionario.html) ----------
const num = numero;

function stock() {
  return autos
    .map(
      (a, i) => `
        <article class="auto ${i % 2 ? 'is-invertido' : ''}" data-auto="${a.id}" aria-labelledby="auto-${a.id}">
          <a class="auto-foto" href="#showroom" data-show="${a.id}" aria-label="Ver el ${esc(a.modelo)} en 3D">
            <img src="./renders/autos/${a.id}.webp" width="1600" height="900" loading="lazy" decoding="async"
                 alt="${esc(a.marca)} ${esc(a.modelo)} en ${esc(a.color)}, modelo 3D" />
          </a>
          <div class="auto-texto">
            <h3 class="auto-nombre" id="auto-${a.id}">${esc(a.marca)} ${esc(a.modelo)}</h3>
            <p class="auto-meta">${a.anio} · ${kms(a.km)} · ${esc(a.color)}</p>
            <p class="auto-resumen">${esc(a.resumen)}</p>
            <dl class="auto-datos">
              <div><dt>Potencia</dt><dd>${a.potencia} CV</dd></div>
              <div><dt>0 a 100 km/h</dt><dd>${num(a.aceleracion, 1)} s</dd></div>
              <div><dt>Velocidad máxima</dt><dd>${a.velocidad} km/h</dd></div>
            </dl>
            <p class="auto-precio">${dolares(a.precio)}</p>
            <div class="acciones">
              <a class="boton boton-tinta" href="#showroom" data-show="${a.id}">Ver en 3D</a>
              <a class="enlace" href="#visita" data-visit="${a.id}">Agendar visita</a>
            </div>
          </div>
        </article>`,
    )
    .join('');
}

function pestanas() {
  return autos
    .map(
      (a, i) => `
        <button class="pestana" type="button" role="tab" id="tab-${a.id}" aria-controls="ficha"
                aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-show="${a.id}">
          <img src="./renders/autos/${a.id}-sm.webp" width="480" height="270" alt="" />
          <span>${esc(a.modelo)}</span>
        </button>`,
    )
    .join('');
}

// Silueta lateral de cada auto (la misma curva que usa el generador 3D),
// escalada al largo de fábrica y alineada en el eje delantero.
const PX = 200; // píxeles por metro
const X0 = -1.4; // metros (delante del eje delantero)
const X1 = 3.9;
const Y1 = 1.55;
const PAD = { l: 8, r: 8, t: 10, b: 36 };
const W = (X1 - X0) * PX + PAD.l + PAD.r;
const HH = Y1 * PX + PAD.t + PAD.b;
const sx = (m) => PAD.l + (m - X0) * PX;
const sy = (m) => PAD.t + (Y1 - m) * PX;

function silhouette(a) {
  const g = a.geo;
  const xs = g.outline.map((p) => p[0]);
  const scale = a.largo / 1000 / (Math.max(...xs) - Math.min(...xs));
  const fx = (x) => (g.wheels.front.x - x) * scale; // metros por detrás del eje delantero
  const ring = new CatmullRomCurve3(g.outline.map(([x, y]) => new Vector3(x, y, 0)), true, 'centripetal');
  const pts = ring.getSpacedPoints(260);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(fx(p.x)).toFixed(1)} ${sy(p.y).toFixed(1)}`).join('') + 'Z';
  const wheel = (w) => `<circle cx="${sx(fx(w.x)).toFixed(1)}" cy="${sy(w.r).toFixed(1)}" r="${(w.r * PX).toFixed(1)}" />`;
  const peak = pts.reduce((m, p) => (p.y > m.y ? p : m), pts[0]);
  return { d, wheels: wheel(g.wheels.front) + wheel(g.wheels.rear), peak: [sx(fx(peak.x)), sy(peak.y)] };
}

function leyenda() {
  return autos
    .map(
      (a, i) => `<button class="leyenda-boton" type="button" aria-pressed="${i === 0}" data-perfil="${a.id}">
          <span class="leyenda-trazo" aria-hidden="true"></span>${esc(a.modelo)}</button>`,
    )
    .join('');
}

function perfiles() {
  const ticks = [];
  for (let m = -1; m <= 3; m++) {
    ticks.push(`<line class="eje-marca" x1="${sx(m)}" x2="${sx(m)}" y1="${sy(0)}" y2="${sy(0) + 6}" />`);
    ticks.push(`<text class="eje-texto" x="${sx(m)}" y="${sy(0) + 24}" text-anchor="middle">${m === 0 ? 'eje delantero' : `${m} m`}</text>`);
  }
  const shapes = autos
    .map((a, i) => {
      const s = silhouette(a);
      return `<g class="perfil ${i === 0 ? 'is-activo' : ''}" data-perfil="${a.id}" data-peak="${s.peak.map((v) => v.toFixed(0)).join(',')}"
                 data-dato="${esc(a.modelo)}: ${num(a.largo / 1000, 2)} m de largo, ${num(a.alto / 1000, 2)} m de alto, ${num(a.batalla / 1000, 2)} m entre ejes">
          <path class="perfil-trazo" d="${s.d}" />
          <g class="perfil-ruedas">${s.wheels}</g>
          <path class="perfil-tocar" d="${s.d}" />
        </g>`;
    })
    .join('');
  return `<svg class="perfiles-svg" viewBox="0 0 ${W.toFixed(0)} ${HH.toFixed(0)}" role="img"
       aria-label="Siluetas laterales superpuestas de los cuatro autos, a escala; la tabla de abajo tiene los mismos datos.">
      <line class="eje-suelo" x1="${PAD.l}" x2="${W - PAD.r}" y1="${sy(0)}" y2="${sy(0)}" />
      ${ticks.join('')}
      ${shapes}
      <text class="perfil-etiqueta" data-etiqueta x="0" y="0"></text>
    </svg>`;
}

function tabla() {
  const rows = [
    ['Potencia', (a) => `${a.potencia} CV`],
    ['0 a 100 km/h', (a) => `${num(a.aceleracion, 1)} s`],
    ['Velocidad máxima', (a) => `${a.velocidad} km/h`],
    ['Largo', (a) => `${num(a.largo / 1000, 2)} m`],
    ['Alto', (a) => `${num(a.alto / 1000, 2)} m`],
    ['Entre ejes', (a) => `${num(a.batalla / 1000, 2)} m`],
    ['Tracción', (a) => esc(a.traccion)],
    ['Precio', (a) => dolares(a.precio)],
  ];
  const head = `<thead><tr><th scope="col"><span class="oculto">Dato</span></th>${autos.map((a) => `<th scope="col">${esc(a.modelo)}</th>`).join('')}</tr></thead>`;
  const body = rows.map(([label, f]) => `<tr><th scope="row">${label}</th>${autos.map((a) => `<td>${f(a)}</td>`).join('')}</tr>`).join('');
  return `${head}<tbody>${body}</tbody>`;
}

function opcionesAuto() {
  return autos.map((a) => `<option value="${a.id}">${esc(a.marca)} ${esc(a.modelo)} · ${dolares(a.precio)}</option>`).join('') +
    '<option value="otro">Otro / quiero vender el mío</option>';
}

const catalogPlugin = () => ({
  name: 'torno-catalogo',
  transformIndexHtml(html) {
    return html
      .replace('<!--stock-->', stock)
      .replace('<!--pestanas-->', pestanas)
      .replace('<!--leyenda-->', leyenda)
      .replace('<!--perfiles-->', perfiles)
      .replace('<!--tabla-->', tabla)
      .replace('<!--opciones-auto-->', opcionesAuto)
      .replace('<!--catalogo-->', catalogo())
      .replace('<!--piezas-->', piezas())
      .replace('<!--esmaltes-->', esmaltes())
      .replace('<!--tamanos-->', tamanos())
      .replace('<!--precio-inicial-->', euros(priceOf(products[0].id, glazes[0].id, 'm')));
  },
});

export default defineConfig({
  base: './',
  plugins: [catalogPlugin()],
  build: {
    target: 'es2022',
    rollupOptions: { input: { torno: 'index.html', flyline: 'concesionario.html' } },
    chunkSizeWarningLimit: 900,
  },
});
