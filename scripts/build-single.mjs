// Genera versiones de un solo archivo HTML (código, estilos, fuentes, modelos 3D
// e imágenes incrustados) que se abren con doble clic, sin servidor:
//
//   dist-single/torno.html     la tienda de cerámica (index.html)
//   dist-single/flyline.html   el concesionario (concesionario.html)
//
//   npm run build:single
//
// Pesan unos 3–4 MB. Para publicar en un servidor usa `npm run build` (dist/),
// que carga cada recurso por separado y solo cuando hace falta.

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'dist-single');

const pages = [
  { html: 'index.html', out: 'torno.html', assets: ['models', 'renders'] },
  { html: 'concesionario.html', out: 'flyline.html', assets: ['models/autos', 'renders/autos'] },
];

const types = { '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.png': 'image/png' };
const dataUri = async (rel) => {
  const buf = await readFile(path.join(root, 'public', rel));
  return `data:${types[path.extname(rel)]};base64,${buf.toString('base64')}`;
};

await mkdir(outDir, { recursive: true });
for (const page of pages) {
  const tmp = path.join(root, 'node_modules', '.cache', 'single', page.out);
  await build({
    root,
    logLevel: 'warn',
    build: {
      outDir: tmp,
      emptyOutDir: true,
      copyPublicDir: false,
      assetsInlineLimit: 100_000_000, // fuentes dentro del CSS
      cssCodeSplit: false,
      modulePreload: false,
      rollupOptions: { input: path.join(root, page.html), output: { codeSplitting: false } },
    },
  });

  let html = await readFile(path.join(tmp, page.html), 'utf8');

  // CSS y JS dentro del HTML.
  for (const tag of html.match(/<link rel="stylesheet"[^>]*>/g) ?? []) {
    const href = tag.match(/href="\.\/([^"]+)"/)[1];
    const css = await readFile(path.join(tmp, href), 'utf8');
    html = html.replace(tag, () => `<style>\n${css}\n</style>`);
  }
  const jsTag = html.match(/<script type="module"[^>]*src="\.\/([^"]+\.js)"[^>]*><\/script>/);
  const js = (await readFile(path.join(tmp, jsTag[1]), 'utf8')).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  html = html.replace(jsTag[0], '');

  // Modelos e imágenes que el JavaScript pide por su ruta.
  const assets = {};
  for (const dir of page.assets) {
    for (const f of await readdir(path.join(root, 'public', dir), { withFileTypes: true })) {
      if (f.isFile()) assets[`${dir}/${f.name}`] = await dataUri(`${dir}/${f.name}`);
    }
  }
  const boot = `<script>window.__TORNO_ASSETS=${JSON.stringify(assets)};</script>\n<script type="module">\n${js}\n</script>`;
  html = html.replace('</body>', () => `${boot}\n</body>`);

  // Imágenes del HTML y favicon; la precarga de modelos sobra.
  html = html.replace(/\s*<link rel="preload"[^>]*>/g, '');
  const refs = [...new Set(html.match(/\.\/(?:renders|images)\/[\w/-]+\.(?:webp|png|svg)|\.\/favicon[\w-]*\.svg/g) ?? [])];
  for (const ref of refs) {
    const uri = await dataUri(ref.slice(2));
    html = html.split(`"${ref}"`).join(`"${uri}"`);
  }

  const file = path.join(outDir, page.out);
  await writeFile(file, html);
  console.log(`${path.relative(root, file)}  ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
}
