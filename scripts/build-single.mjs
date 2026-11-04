// Genera dist-single/torno.html: la tienda entera en un solo archivo HTML
// (código, estilos, fuentes, modelos 3D e imágenes incrustados) que se abre
// con doble clic, sin servidor.
//
//   npm run build:single
//
// Pesa unos 3 MB. Para publicar en un servidor usa `npm run build` (dist/),
// que carga cada recurso por separado y solo cuando hace falta.

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tmp = path.join(root, 'node_modules', '.cache', 'torno-single');
const outDir = path.join(root, 'dist-single');

await build({
  root,
  logLevel: 'warn',
  build: {
    outDir: tmp,
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000, // fuentes dentro del CSS
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { codeSplitting: false } },
  },
});

const types = { '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml' };
const dataUri = async (rel) => {
  const buf = await readFile(path.join(root, 'public', rel));
  return `data:${types[path.extname(rel)]};base64,${buf.toString('base64')}`;
};

let html = await readFile(path.join(tmp, 'index.html'), 'utf8');

// CSS y JS dentro del HTML.
const cssHref = html.match(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/);
const css = await readFile(path.join(tmp, cssHref[1]), 'utf8');
html = html.replace(cssHref[0], () => `<style>\n${css}\n</style>`);

const jsTag = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/);
const js = (await readFile(path.join(tmp, jsTag[1]), 'utf8')).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
html = html.replace(jsTag[0], '');

// Modelos e imágenes que el JavaScript pide por su ruta.
const assets = {};
for (const dir of ['models', 'renders']) {
  for (const f of await readdir(path.join(root, 'public', dir))) assets[`${dir}/${f}`] = await dataUri(`${dir}/${f}`);
}
const boot = `<script>window.__TORNO_ASSETS=${JSON.stringify(assets)};</script>\n<script type="module">\n${js}\n</script>`;
html = html.replace('</body>', () => `${boot}\n</body>`);

// Imágenes del HTML, favicon y la precarga del modelo (ya va incrustado).
html = html.replace(/\s*<link rel="preload"[^>]*>/, '');
const refs = [...new Set(html.match(/\.\/(?:renders|images\/manises)\/[\w-]+\.webp|\.\/favicon\.svg/g))];
for (const ref of refs) {
  const uri = await dataUri(ref.slice(2));
  html = html.split(`"${ref}"`).join(`"${uri}"`);
}

await mkdir(outDir, { recursive: true });
const file = path.join(outDir, 'torno.html');
await writeFile(file, html);
console.log(`${path.relative(root, file)}  ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
