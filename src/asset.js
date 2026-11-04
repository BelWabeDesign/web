// Ruta de un archivo de public/. En la versión de un solo archivo
// (npm run build:single) los archivos vienen incrustados en window.__TORNO_ASSETS.
const base = import.meta.env?.BASE_URL ?? '/';

export const asset = (path) => globalThis.__TORNO_ASSETS?.[path] ?? `${base}${path}`;
