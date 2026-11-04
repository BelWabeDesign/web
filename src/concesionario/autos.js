// Stock de Flyline: ficha comercial y geometría de cada auto.
// Archivo compartido: lo leen la página y scripts/build-cars.mjs (sin dependencias).
//
// Geometría en metros. Eje X = largo (el frente hacia +X), Y = alto, Z = ancho.
// Cada auto se modela con sus vistas, como en un plano de carrocería:
//   outline  silueta lateral cerrada (de la trompa por arriba hasta la cola y por debajo)
//   width    medio ancho de la carrocería en planta
//   cabin    medio ancho del habitáculo a la altura de la línea de cintura
//   belt     línea de cintura (donde empiezan los vidrios)
// El script combina las vistas en un volumen, lo redondea, recorta los pasos de
// rueda, separa pintura, vidrios y plásticos, y añade ruedas, alerón y espejos.

export const autos = [
  {
    id: 'gt3rs',
    largo: 4572, ancho: 1900, alto: 1322, batalla: 2457,
    marca: 'Porsche',
    modelo: '911 GT3 RS',
    generacion: '992',
    anio: 2023,
    km: 4800,
    color: 'Frozen Berry metalizado',
    precio: 365000,
    motor: '6 cilindros bóxer, 4.0 l atmosférico',
    potencia: 525,
    aceleracion: 3.2,
    velocidad: 296,
    caja: 'PDK de 7 marchas',
    traccion: 'Trasera',
    resumen: 'Paquete Weissach, techo y capó de carbono, llantas de magnesio y elevador del eje delantero.',
    fotos: ['gt3rs-lateral', 'gt3rs-tres-cuartos', 'gt3rs-frente'],
    pintura: { color: '#c8949f', metalness: 0.38, roughness: 0.32 },
    llantas: '#17181a',
    pinzas: '#b3202a',
    geo: {
      outline: [
        [2.3, 0.12], [2.35, 0.19], [2.35, 0.34], [2.3, 0.47], [2.18, 0.6], [1.98, 0.705], [1.62, 0.76],
        [1.25, 0.785], [0.85, 0.815], [0.62, 0.855], [0.3, 1.03], [-0.05, 1.255], [-0.4, 1.322], [-0.8, 1.3],
        [-1.2, 1.21], [-1.58, 1.09], [-1.92, 0.99], [-2.12, 0.94], [-2.26, 0.86], [-2.33, 0.7], [-2.35, 0.52],
        [-2.31, 0.34], [-2.2, 0.18], [-2.0, 0.12], [-1.0, 0.115], [1.0, 0.115], [2.0, 0.115],
      ],
      width: [
        [2.35, 0.66], [2.25, 0.8], [2.0, 0.86], [1.6, 0.875], [1.23, 0.88], [0.8, 0.865], [0.2, 0.86],
        [-0.5, 0.865], [-0.9, 0.89], [-1.23, 0.905], [-1.7, 0.895], [-2.1, 0.82], [-2.35, 0.66],
      ],
      cabin: [[0.7, 0.76], [0.3, 0.75], [-0.2, 0.72], [-0.8, 0.68], [-1.4, 0.62], [-2.0, 0.55], [-2.35, 0.5]],
      belt: [[2.35, 0.7], [1.8, 0.74], [1.2, 0.77], [0.6, 0.84], [0.0, 0.88], [-0.6, 0.9], [-1.3, 0.93], [-2.35, 0.88]],
      tumble: 0.42,
      hood: { from: 0.65, to: 2.25, dip: 0.065, inner: 0.28, outer: 0.56 },
      fenders: [
        { x: 1.4, y: 0.42, z: 0.74, rx: 0.92, ry: 0.34, rz: 0.2 },
        { x: -1.25, y: 0.5, z: 0.7, rx: 0.9, ry: 0.44, rz: 0.26 },
      ],
      edge: 0.14,
      wheels: {
        front: { x: 1.23, track: 1.58, r: 0.35, w: 0.275, rim: 0.254 },
        rear: { x: -1.227, track: 1.56, r: 0.367, w: 0.335, rim: 0.267 },
      },
      glass: {
        side: { a: [[0.56, 0.86], [-0.06, 1.25]], c: [[-1.1, 0.94], [-0.66, 1.25]], top: 0.05, pillars: [[-0.5, -0.45]] },
        front: { x: [-0.08, 0.6], inset: 0.085 },
        rear: { x: [-1.5, -0.78], inset: 0.15 },
      },
      black: [
        { n: 'front', x: [2.0, 2.5], y: [0.16, 0.32], z: [0, 0.5] },
        { n: 'front', x: [2.0, 2.5], y: [0.17, 0.38], z: [0.58, 0.8] },
        { n: 'top', x: [1.5, 1.82], y: [0, 2], z: [0.18, 0.34] },
        { n: 'side', x: [0.64, 0.8], y: [0.48, 0.68], z: [0, 2] },
        { n: 'side', x: [-0.84, -0.77], y: [0.52, 0.78], z: [0, 2] },
        { n: 'top', x: [-1.95, -1.65], y: [0, 2], z: [0, 0.32] },
        { n: 'any', x: [-2.5, -1.98], y: [0, 0.38], z: [0, 2] },
      ],
      sill: 0.195,
      lightbar: [0.8, 0.845],
      headlights: { y: 0.65, z: 0.67, r: 0.112 },
      mirror: { x: 0.44, y: 0.95 },
      wing: { type: 'swan', front: -2.02, rear: -2.37, y: 1.27, span: 1.7, mount: -1.88 },
      splitter: { x: 2.33, from: 1.95, y: 0.11, w: 0.76 },
    },
  },
  {
    id: 'carreras',
    largo: 4542, ancho: 1852, alto: 1296, batalla: 2450,
    marca: 'Porsche',
    modelo: '911 Carrera S',
    generacion: '992.2',
    anio: 2025,
    km: 2300,
    color: 'Azul Genciana metalizado',
    precio: 162000,
    motor: '6 cilindros bóxer, 3.0 l biturbo',
    potencia: 480,
    aceleracion: 3.3,
    velocidad: 308,
    caja: 'PDK de 8 marchas',
    traccion: 'Trasera',
    resumen: 'Sport Chrono, escape deportivo, asientos de 18 vías y eje trasero direccional.',
    fotos: [],
    pintura: { color: '#24365e', metalness: 0.6, roughness: 0.3 },
    llantas: '#9ea3a8',
    pinzas: '#b3202a',
    geo: {
      outline: [
        [2.27, 0.15], [2.31, 0.24], [2.31, 0.36], [2.27, 0.48], [2.15, 0.6], [1.96, 0.7], [1.62, 0.755],
        [1.25, 0.78], [0.85, 0.81], [0.62, 0.85], [0.3, 1.02], [-0.05, 1.235], [-0.4, 1.296], [-0.8, 1.275],
        [-1.2, 1.18], [-1.58, 1.07], [-1.92, 0.98], [-2.12, 0.93], [-2.24, 0.86], [-2.3, 0.7], [-2.31, 0.52],
        [-2.27, 0.34], [-2.16, 0.2], [-2.0, 0.14], [-1.0, 0.135], [1.0, 0.135], [2.0, 0.14],
      ],
      width: [
        [2.31, 0.65], [2.22, 0.79], [2.0, 0.845], [1.6, 0.86], [1.23, 0.865], [0.8, 0.85], [0.2, 0.845],
        [-0.5, 0.85], [-0.9, 0.87], [-1.22, 0.885], [-1.7, 0.875], [-2.1, 0.8], [-2.31, 0.65],
      ],
      cabin: [[0.7, 0.75], [0.3, 0.74], [-0.2, 0.71], [-0.8, 0.67], [-1.4, 0.61], [-2.0, 0.54], [-2.3, 0.49]],
      belt: [[2.3, 0.7], [1.8, 0.735], [1.2, 0.77], [0.6, 0.84], [0.0, 0.875], [-0.6, 0.895], [-1.3, 0.925], [-2.3, 0.875]],
      tumble: 0.42,
      hood: { from: 0.65, to: 2.22, dip: 0.06, inner: 0.28, outer: 0.56 },
      fenders: [
        { x: 1.4, y: 0.41, z: 0.72, rx: 0.92, ry: 0.33, rz: 0.2 },
        { x: -1.24, y: 0.49, z: 0.68, rx: 0.9, ry: 0.43, rz: 0.255 },
      ],
      edge: 0.14,
      wheels: {
        front: { x: 1.23, track: 1.59, r: 0.34, w: 0.245, rim: 0.254 },
        rear: { x: -1.22, track: 1.56, r: 0.358, w: 0.305, rim: 0.267 },
      },
      glass: {
        side: { a: [[0.56, 0.85], [-0.06, 1.23]], c: [[-1.1, 0.93], [-0.66, 1.23]], top: 0.05, pillars: [[-0.5, -0.45]] },
        front: { x: [-0.08, 0.6], inset: 0.085 },
        rear: { x: [-1.5, -0.78], inset: 0.15 },
      },
      black: [
        { n: 'front', x: [2.0, 2.5], y: [0.2, 0.32], z: [0, 0.42] },
        { n: 'front', x: [2.0, 2.5], y: [0.2, 0.38], z: [0.56, 0.78] },
        { n: 'top', x: [-1.9, -1.66], y: [0, 2], z: [0, 0.32] },
        { n: 'any', x: [-2.5, -2.02], y: [0, 0.34], z: [0, 2] },
      ],
      sill: 0.2,
      lightbar: [0.79, 0.83],
      headlights: { y: 0.645, z: 0.655, r: 0.108 },
      mirror: { x: 0.42, y: 0.96 },
      wing: { type: 'duck', front: -1.98, rear: -2.2, y: 0.97 },
      splitter: null,
    },
  },
  {
    id: 'gt4rs',
    largo: 4456, ancho: 1822, alto: 1267, batalla: 2484,
    marca: 'Porsche',
    modelo: '718 Cayman GT4 RS',
    generacion: '982',
    anio: 2023,
    km: 6100,
    color: 'Verde Python',
    precio: 214000,
    motor: '6 cilindros bóxer, 4.0 l atmosférico, central',
    potencia: 500,
    aceleracion: 3.4,
    velocidad: 315,
    caja: 'PDK de 7 marchas',
    traccion: 'Trasera',
    resumen: 'Motor central que gira a 9.000 rpm, tomas de aire en las ventanillas traseras y alerón de cuello de cisne.',
    fotos: [],
    pintura: { color: '#71b843', metalness: 0.05, roughness: 0.26 },
    llantas: '#17181a',
    pinzas: '#d8a31a',
    geo: {
      outline: [
        [2.2, 0.12], [2.24, 0.2], [2.23, 0.36], [2.15, 0.49], [1.98, 0.62], [1.7, 0.72], [1.3, 0.76],
        [0.9, 0.79], [0.62, 0.85], [0.3, 1.04], [0.0, 1.22], [-0.3, 1.267], [-0.7, 1.245], [-1.0, 1.15],
        [-1.28, 1.02], [-1.6, 0.99], [-1.95, 0.98], [-2.16, 0.95], [-2.24, 0.86], [-2.25, 0.6], [-2.2, 0.32],
        [-2.08, 0.16], [-1.9, 0.115], [-1.0, 0.11], [1.0, 0.11], [1.9, 0.115],
      ],
      width: [
        [2.24, 0.64], [2.1, 0.78], [1.85, 0.84], [1.2, 0.85], [0.7, 0.84], [0.1, 0.835],
        [-0.6, 0.845], [-1.05, 0.86], [-1.284, 0.865], [-1.8, 0.86], [-2.12, 0.8], [-2.25, 0.66],
      ],
      cabin: [[0.75, 0.74], [0.3, 0.72], [-0.2, 0.69], [-0.7, 0.64], [-1.1, 0.6], [-1.6, 0.62], [-2.25, 0.6]],
      belt: [[2.24, 0.7], [1.7, 0.74], [1.2, 0.77], [0.62, 0.84], [0.0, 0.88], [-0.6, 0.9], [-1.2, 0.95], [-2.25, 0.92]],
      tumble: 0.42,
      hood: { from: 0.75, to: 2.15, dip: 0.065, inner: 0.28, outer: 0.56 },
      fenders: [
        { x: 1.35, y: 0.41, z: 0.7, rx: 0.9, ry: 0.33, rz: 0.2 },
        { x: -1.3, y: 0.48, z: 0.66, rx: 0.85, ry: 0.42, rz: 0.25 },
      ],
      edge: 0.14,
      wheels: {
        front: { x: 1.2, track: 1.54, r: 0.34, w: 0.245, rim: 0.254 },
        rear: { x: -1.284, track: 1.53, r: 0.343, w: 0.295, rim: 0.254 },
      },
      glass: {
        side: { a: [[0.58, 0.86], [-0.02, 1.2]], c: [[-0.98, 0.96], [-0.62, 1.2]], top: 0.05, pillars: [] },
        front: { x: [-0.04, 0.6], inset: 0.085 },
        rear: { x: [-1.16, -0.74], inset: 0.18 },
      },
      black: [
        { n: 'front', x: [1.9, 2.5], y: [0.15, 0.34], z: [0, 0.5] },
        { n: 'front', x: [1.9, 2.5], y: [0.17, 0.4], z: [0.56, 0.8] },
        { n: 'top', x: [1.5, 1.8], y: [0, 2], z: [0.14, 0.3] },
        { n: 'side', x: [-0.6, -0.4], y: [0.5, 0.8], z: [0, 2] },
        { n: 'top', x: [-1.95, -1.4], y: [0, 2], z: [0, 0.4] },
        { n: 'any', x: [-2.5, -1.95], y: [0, 0.38], z: [0, 2] },
      ],
      sill: 0.215,
      lightbar: [0.78, 0.82],
      headlights: { y: 0.66, z: 0.65, r: 0.09 },
      mirror: { x: 0.48, y: 0.97 },
      wing: { type: 'swan', front: -1.92, rear: -2.27, y: 1.24, span: 1.62, mount: -1.82 },
      splitter: { x: 2.25, from: 1.88, y: 0.105, w: 0.72 },
    },
  },
  {
    id: 'taycan',
    largo: 4963, ancho: 1966, alto: 1378, batalla: 2900,
    marca: 'Porsche',
    modelo: 'Taycan Turbo S',
    generacion: 'J1.2',
    anio: 2025,
    km: 9800,
    color: 'Blanco Carrara metalizado',
    precio: 198000,
    motor: 'Dos motores eléctricos, batería de 105 kWh',
    potencia: 952,
    aceleracion: 2.4,
    velocidad: 260,
    caja: 'Dos marchas en el eje trasero',
    traccion: 'Total',
    resumen: 'Hasta 630 km de autonomía WLTP, carga a 320 kW y suspensión activa Porsche Active Ride.',
    fotos: [],
    pintura: { color: '#e6e5e0', metalness: 0.3, roughness: 0.28 },
    llantas: '#2a2c2f',
    pinzas: '#c9a227',
    geo: {
      outline: [
        [2.46, 0.15], [2.49, 0.24], [2.47, 0.4], [2.38, 0.53], [2.2, 0.65], [1.9, 0.75], [1.5, 0.79],
        [1.1, 0.83], [0.85, 0.9], [0.5, 1.1], [0.1, 1.32], [-0.35, 1.378], [-0.9, 1.355], [-1.35, 1.27],
        [-1.8, 1.13], [-2.15, 1.04], [-2.4, 0.98], [-2.48, 0.84], [-2.5, 0.6], [-2.46, 0.34], [-2.36, 0.19],
        [-2.2, 0.14], [-1.0, 0.13], [1.0, 0.13], [2.2, 0.14],
      ],
      width: [
        [2.49, 0.68], [2.35, 0.84], [2.1, 0.9], [1.52, 0.925], [1.0, 0.92], [0.2, 0.915],
        [-0.7, 0.92], [-1.15, 0.935], [-1.38, 0.94], [-1.9, 0.93], [-2.32, 0.85], [-2.5, 0.72],
      ],
      cabin: [[0.95, 0.8], [0.4, 0.78], [-0.3, 0.76], [-1.0, 0.74], [-1.6, 0.7], [-2.1, 0.64], [-2.5, 0.58]],
      belt: [[2.49, 0.76], [1.9, 0.78], [1.3, 0.83], [0.85, 0.89], [0.0, 0.93], [-0.8, 0.95], [-1.6, 0.97], [-2.5, 0.92]],
      tumble: 0.4,
      hood: { from: 0.9, to: 2.4, dip: 0.06, inner: 0.32, outer: 0.62 },
      fenders: [
        { x: 1.65, y: 0.44, z: 0.8, rx: 1.0, ry: 0.34, rz: 0.18 },
        { x: -1.4, y: 0.5, z: 0.78, rx: 1.0, ry: 0.42, rz: 0.21 },
      ],
      edge: 0.15,
      wheels: {
        front: { x: 1.52, track: 1.69, r: 0.36, w: 0.265, rim: 0.267 },
        rear: { x: -1.38, track: 1.66, r: 0.358, w: 0.305, rim: 0.267 },
      },
      glass: {
        side: { a: [[0.82, 0.93], [0.08, 1.31]], c: [[-1.62, 1.0], [-1.1, 1.3]], top: 0.05, pillars: [[-0.36, -0.28]] },
        front: { x: [0.08, 0.8], inset: 0.09 },
        rear: { x: [-2.2, -1.3], inset: 0.16 },
      },
      black: [
        { n: 'front', x: [2.2, 2.7], y: [0.18, 0.32], z: [0, 0.6] },
        { n: 'front', x: [2.2, 2.7], y: [0.2, 0.42], z: [0.7, 0.86] },
        { n: 'any', x: [-2.7, -2.2], y: [0, 0.34], z: [0, 2] },
      ],
      sill: 0.2,
      lightbar: [0.84, 0.88],
      headlights: { y: 0.7, z: 0.72, r: 0.1 },
      mirror: { x: 0.74, y: 1.0 },
      wing: null,
      splitter: null,
    },
  },
];

export const autoById = (id) => autos.find((a) => a.id === id) ?? autos[0];
export const nombre = (a) => `${a.marca} ${a.modelo}`;

// Números al estilo hispano: punto de miles y coma decimal (US$ 365.000, 4,57 m).
export const numero = (n, d = 0) =>
  new Intl.NumberFormat('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' }).format(n);
export const dolares = (n) => `US$ ${numero(n)}`;
export const kms = (n) => `${numero(n)} km`;

// Financiamiento de ejemplo (tasa fija anual). Cambiar por la de la financiera real.
export const FINANCIAMIENTO = { tasa: 0.099, plazos: [24, 36, 48, 60], enganche: [0.2, 0.6] };

/** Cuota mensual de un préstamo francés (cuota fija). */
export function cuota(precio, enganchePct, meses, tasa = FINANCIAMIENTO.tasa) {
  const capital = precio * (1 - enganchePct);
  const i = tasa / 12;
  return (capital * i) / (1 - Math.pow(1 + i, -meses));
}
