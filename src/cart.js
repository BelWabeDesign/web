// Cesta: se guarda en este navegador (localStorage) y el pedido sale por correo.
// Cuando haya pasarela de pago, sustituir checkoutHref() por la llamada real.

import { SHIPPING, euros, glazeById, priceOf, productById, sizeById } from './data/catalog.js';
import { asset } from './asset.js';

const KEY = 'torno-cesta-v1';
const ORDER_EMAIL = 'pedidos@torno.example';
const listeners = new Set();

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((l) => l && l.product && l.qty > 0) : [];
  } catch {
    return [];
  }
}

let lines = read();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* Navegación privada o almacenamiento bloqueado: la cesta dura lo que la visita. */
  }
  listeners.forEach((fn) => fn(lines));
}

const keyOf = (l) => `${l.product}|${l.glaze}|${l.size}`;

export const cart = {
  get lines() {
    return lines;
  },
  subscribe(fn) {
    listeners.add(fn);
    fn(lines);
    return () => listeners.delete(fn);
  },
  add(product, glaze, size = 'm', qty = 1) {
    const p = productById(product);
    const line = { product: p.id, glaze: glaze ?? p.glaze, size, qty };
    const found = lines.find((l) => keyOf(l) === keyOf(line));
    if (found) found.qty = Math.min(20, found.qty + qty);
    else lines = [...lines, line];
    save();
    return line;
  },
  setQty(key, qty) {
    lines = lines.map((l) => (keyOf(l) === key ? { ...l, qty: Math.max(0, Math.min(20, qty)) } : l)).filter((l) => l.qty > 0);
    save();
  },
  remove(key) {
    lines = lines.filter((l) => keyOf(l) !== key);
    save();
  },
  count: () => lines.reduce((n, l) => n + l.qty, 0),
  subtotal: () => lines.reduce((n, l) => n + priceOf(l.product, l.glaze, l.size) * l.qty, 0),
  shipping() {
    const s = this.subtotal();
    return s === 0 || s >= SHIPPING.freeFrom ? 0 : SHIPPING.flat;
  },
  keyOf,
};

export function describe(l) {
  return `${glazeById(l.glaze).name} · ${sizeById(l.size).name}`;
}

function checkoutHref() {
  const rows = lines.map(
    (l) => `${l.qty} × ${productById(l.product).name} (${describe(l)}): ${euros(priceOf(l.product, l.glaze, l.size) * l.qty)}`,
  );
  const body = [
    'Hola, quiero hacer este pedido:',
    '',
    ...rows,
    '',
    `Piezas: ${euros(cart.subtotal())}`,
    `Envío: ${cart.shipping() ? euros(cart.shipping()) : 'gratis'}`,
    `Total: ${euros(cart.subtotal() + cart.shipping())}`,
    '',
    'Nombre:',
    'Dirección de envío:',
    'Teléfono:',
  ].join('\n');
  return `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent('Pedido Torno')}&body=${encodeURIComponent(body)}`;
}

/** Conecta la cesta con su diálogo y con los botones de la página. */
export function mountCart({ onAdd } = {}) {
  const dialog = document.getElementById('cesta');
  const list = dialog.querySelector('[data-cart-list]');
  const empty = dialog.querySelector('[data-cart-empty]');
  const summary = dialog.querySelector('[data-cart-summary]');
  const counts = document.querySelectorAll('[data-cart-count]');
  const toast = document.querySelector('[data-toast]');
  let toastTimer = 0;

  const open = () => {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };
  const close = () => (dialog.close ? dialog.close() : dialog.removeAttribute('open'));

  document.querySelectorAll('[data-open-cart]').forEach((b) => b.addEventListener('click', open));
  dialog.querySelectorAll('[data-close-cart]').forEach((b) => b.addEventListener('click', close));
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close(); // clic en el fondo
  });

  const say = (msg) => {
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2600);
  };

  const render = () => {
    const n = cart.count();
    counts.forEach((c) => (c.textContent = String(n)));
    empty.hidden = n > 0;
    summary.hidden = n === 0;
    list.replaceChildren(
      ...cart.lines.map((l) => {
        const p = productById(l.product);
        const key = cart.keyOf(l);
        const li = document.createElement('li');
        li.className = 'linea';
        li.innerHTML = `
          <img src="${asset(`renders/${p.id}-sm.webp`)}" width="240" height="300" alt="" />
          <p class="linea-nombre"></p>
          <p class="linea-precio">${euros(priceOf(l.product, l.glaze, l.size) * l.qty)}</p>
          <p class="linea-detalle"></p>
          <div class="linea-controles">
            <button type="button" data-step="-1" aria-label="Quitar una">−</button>
            <output aria-live="polite">${l.qty}</output>
            <button type="button" data-step="1" aria-label="Añadir una">+</button>
            <button type="button" class="quitar">Quitar</button>
          </div>`;
        li.querySelector('.linea-nombre').textContent = p.name;
        li.querySelector('.linea-detalle').textContent = describe(l);
        li.querySelectorAll('[data-step]').forEach((b) =>
          b.addEventListener('click', () => cart.setQty(key, l.qty + Number(b.dataset.step))),
        );
        li.querySelector('.quitar').addEventListener('click', () => cart.remove(key));
        return li;
      }),
    );
    const sub = cart.subtotal();
    const ship = cart.shipping();
    dialog.querySelector('[data-cart-subtotal]').textContent = euros(sub);
    dialog.querySelector('[data-cart-shipping]').textContent = ship ? euros(ship) : 'Gratis';
    dialog.querySelector('[data-cart-total]').textContent = euros(sub + ship);
    dialog.querySelector('[data-cart-free]').textContent =
      sub > 0 && sub < SHIPPING.freeFrom ? `Te faltan ${euros(SHIPPING.freeFrom - sub)} para el envío gratis.` : '';
    dialog.querySelector('[data-checkout]').href = checkoutHref();
  };

  cart.subscribe(render);

  // Botones «Añadir a la cesta» del catálogo y de la portada.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    const line = cart.add(btn.dataset.add);
    const p = productById(line.product);
    say(`${p.name} en la cesta`);
    btn.dataset.added = '';
    const label = btn.textContent;
    btn.textContent = 'Añadida';
    setTimeout(() => {
      delete btn.dataset.added;
      btn.textContent = label;
    }, 1500);
    onAdd?.(btn);
  });

  return { open, say };
}
