import { defineConfig } from 'vite';
import { products, glazes, sizes, euros, priceOf, glazeById } from './src/data/catalog.js';

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

const catalogPlugin = () => ({
  name: 'torno-catalogo',
  transformIndexHtml(html) {
    return html
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
    chunkSizeWarningLimit: 900,
  },
});
