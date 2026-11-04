// Catálogo de Torno: piezas, esmaltes y tamaños.
// Archivo compartido: lo leen el navegador y los scripts de Node
// (scripts/build-models.mjs y scripts/render-products.mjs). Sin dependencias.
//
// Cada pieza se define por su PERFIL: la media silueta exterior que el torno
// hace girar, en centímetros, de la base (r = 0) al labio. El script de modelos
// la cierra con el grosor de pared y la convierte en un .glb en public/models/.
// Para usar un modelo escaneado de verdad basta con sustituir ese .glb.

export const glazes = [
  {
    id: 'azul',
    name: 'Azul Manises',
    note: 'Cobalto sobre blanco de estaño, el azul de los alfares de Manises.',
    color: '#172a66',
    roughness: 0.16,
    metalness: 0,
    clearcoat: 1,
    extra: 0,
  },
  {
    id: 'estano',
    name: 'Blanco estaño',
    note: 'Blanco opaco y algo frío, con el barro asomando en los cantos.',
    color: '#e9e7df',
    roughness: 0.22,
    metalness: 0,
    clearcoat: 0.8,
    extra: 0,
  },
  {
    id: 'reflejo',
    name: 'Reflejo',
    note: 'Lustre metálico de cobre y plata. Pide una tercera cocción.',
    color: '#a3804b',
    roughness: 0.3,
    metalness: 0.7,
    clearcoat: 0.6,
    iridescence: 0.35,
    extra: 12,
  },
  {
    id: 'verde',
    name: 'Verde Paterna',
    note: 'Óxido de cobre, el verde de la loza de Paterna del siglo XIV.',
    color: '#2c5745',
    roughness: 0.18,
    metalness: 0,
    clearcoat: 1,
    extra: 0,
  },
  {
    id: 'ceniza',
    name: 'Ceniza de naranjo',
    note: 'Mate y terroso, hecho con la ceniza de la poda de los naranjos.',
    color: '#b3a88f',
    roughness: 0.72,
    metalness: 0,
    clearcoat: 0,
    extra: 0,
  },
  {
    id: 'manganeso',
    name: 'Negro manganeso',
    note: 'Casi negro, con brillo de pizarra mojada.',
    color: '#211d1b',
    roughness: 0.24,
    metalness: 0.05,
    clearcoat: 1,
    extra: 0,
  },
];

export const sizes = [
  { id: 's', name: 'Pequeña', scale: 0.8, factor: 0.82 },
  { id: 'm', name: 'Mediana', scale: 1, factor: 1 },
  { id: 'l', name: 'Grande', scale: 1.2, factor: 1.3 },
];

// Barro sin esmaltar del pie y estados intermedios de la semana de una pieza.
export const clay = {
  raw: '#8b6a55', // lunes, barro húmedo en el torno
  leather: '#a98c76', // martes, dureza de cuero
  bisque: '#e2c8b4', // miércoles, bizcocho a 980 °C
  glazeRaw: '#c9ccd2', // jueves, esmalte crudo, polvo mate
  foot: '#c7a68c', // el pie que queda sin esmaltar
};

export const products = [
  {
    id: 'albufera',
    name: 'Jarrón Albufera',
    kind: 'Jarrón',
    line: 'Panza ancha y cuello estrecho para una sola rama.',
    height: 32,
    diameter: 18,
    price: 89,
    glaze: 'azul',
    wall: 0.65,
    footLine: 0.7,
    profile: [
      [0, 0], [3, 0], [5.2, 0], [5.6, 0.5], [7.4, 4], [8.9, 10], [8.6, 16],
      [6.8, 21.5], [4.2, 25.5], [3.6, 28], [4.1, 30.8], [4.8, 32],
    ],
  },
  {
    id: 'turia',
    name: 'Botella Turia',
    kind: 'Botella',
    line: 'Cuello largo de un solo tirón de torno.',
    height: 26,
    diameter: 17,
    price: 68,
    glaze: 'verde',
    wall: 0.6,
    footLine: 0.7,
    profile: [
      [0, 0], [3, 0], [5.4, 0], [5.8, 0.6], [7.8, 5], [8.6, 9.5], [7.6, 14],
      [4.2, 17.5], [1.9, 19.5], [1.6, 22], [1.7, 24.6], [2.2, 26],
    ],
  },
  {
    id: 'albarelo',
    name: 'Albarelo Manises',
    kind: 'Albarelo',
    line: 'El tarro de botica de cintura estrecha, como los del siglo XV.',
    height: 18,
    diameter: 11,
    price: 54,
    glaze: 'azul',
    wall: 0.55,
    footLine: 0.6,
    profile: [
      [0, 0], [2, 0], [4.6, 0], [5, 0.5], [5.4, 2], [5.1, 4.5], [4.3, 9],
      [5.0, 13.5], [5.3, 15], [4.4, 16.3], [4.2, 17.2], [4.6, 18],
    ],
  },
  {
    id: 'horno',
    name: 'Cuenco Horno',
    kind: 'Cuenco',
    line: 'Abierto y hondo, para fruta o para la mesa del día.',
    height: 9,
    diameter: 22,
    price: 46,
    glaze: 'ceniza',
    tilt: 0.42,
    wall: 0.55,
    footLine: 0.55,
    profile: [
      [0, 0.3], [3.1, 0.3], [3.4, 0], [4.1, 0], [4.4, 0.6], [6.6, 2.7],
      [9.2, 5.3], [10.6, 7.6], [11, 9],
    ],
  },
  {
    id: 'alba',
    name: 'Taza Alba',
    kind: 'Taza',
    line: 'Sin asa, cabe en la mano y guarda el calor.',
    height: 9.5,
    diameter: 8.6,
    price: 24,
    glaze: 'estano',
    wall: 0.45,
    footLine: 0.5,
    profile: [
      [0, 0], [2, 0], [3.0, 0], [3.3, 0.4], [3.5, 1.2], [3.9, 4], [4.2, 7.5], [4.3, 9.5],
    ],
  },
  {
    id: 'reflejo',
    name: 'Plato Reflejo',
    kind: 'Plato',
    line: 'Ala ancha y fondo hundido, el perfil de los platos de reflejo.',
    height: 3.2,
    diameter: 28,
    price: 42,
    glaze: 'reflejo',
    tilt: 0.78,
    wall: 0.5,
    footLine: 0.45,
    profile: [
      [0, 0.3], [4.6, 0.3], [4.9, 0], [5.5, 0], [5.9, 0.5], [8, 1.4],
      [9.8, 1.8], [12.6, 2.4], [14, 3.0],
    ],
  },
];

export const SHIPPING = { flat: 6, freeFrom: 80 };

export const glazeById = (id) => glazes.find((g) => g.id === id) ?? glazes[0];
export const sizeById = (id) => sizes.find((s) => s.id === id) ?? sizes[1];
export const productById = (id) => products.find((p) => p.id === id) ?? products[0];

/** Precio en euros enteros de una pieza con su esmalte y tamaño. */
export function priceOf(productId, glazeId = null, sizeId = 'm') {
  const p = productById(productId);
  const g = glazeById(glazeId ?? p.glaze);
  const s = sizeById(sizeId);
  return Math.round(p.price * s.factor) + g.extra;
}

export const euros = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
