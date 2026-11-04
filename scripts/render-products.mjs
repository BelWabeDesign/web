// Renderiza cada pieza de public/models/ a una imagen con fondo transparente
// para el catálogo (public/renders/<id>.webp y <id>-sm.webp).
//
//   npm run renders
//
// Usa el mismo visor que la página (src/three/viewer.js) dentro de Chromium
// con Playwright, así lo que se ve en la ficha coincide con el modelo 3D.

import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { products } from '../src/data/catalog.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'public', 'renders');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const server = await createServer({ root, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await mkdir(outDir, { recursive: true });

const convert = (args) => {
  const r = spawnSync('convert', args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`convert ${args.join(' ')}`);
};

for (const p of products) {
  const angle = { reflejo: 0.2, horno: 0.4 }[p.id] ?? 0.5;
  await page.goto(`${url}tools/render.html?id=${p.id}&angle=${angle}`);
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const png = path.join(outDir, `${p.id}.png`);
  await writeFile(png, await page.locator('canvas').screenshot({ omitBackground: true }));
  convert([png, '-resize', '1000x1250', '-quality', '86', '-define', 'webp:alpha-quality=90', path.join(outDir, `${p.id}.webp`)]);
  convert([path.join(outDir, `${p.id}.webp`), '-resize', '240x300', '-quality', '82', path.join(outDir, `${p.id}-sm.webp`)]);
  await rm(png);
  console.log(`public/renders/${p.id}.webp`);
}

await browser.close();
await server.close();
