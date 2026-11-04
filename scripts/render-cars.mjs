// Renderiza cada auto de public/models/autos/ para el listado de stock:
// public/renders/autos/<id>.webp (3/4 delantero) y <id>-sm.webp.
//
//   npm run car-renders
//
// Usa el mismo visor de la página (src/concesionario/visor.js) en Chromium.

import { spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { autos } from '../src/concesionario/autos.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'public', 'renders', 'autos');
const { chromium } = createRequire(import.meta.url)('playwright');

const server = await createServer({ root, logLevel: 'error', server: { port: 5196 } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await mkdir(outDir, { recursive: true });
const convert = (args) => {
  if (spawnSync('convert', args, { stdio: 'inherit' }).status !== 0) throw new Error(`convert ${args.join(' ')}`);
};

const shots = [['', 0.95, 0.17, 1.0]];
for (const a of autos) {
  for (const [suffix, az, el, fit] of shots) {
    await page.goto(`${url}tools/render-car.html?id=${a.id}&az=${az}&el=${el}&fit=${fit}&w=1600&h=900`);
    await page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
    const png = path.join(outDir, `${a.id}${suffix}.png`);
    await writeFile(png, await page.locator('canvas').screenshot({ omitBackground: true }));
    convert([png, '-quality', '84', '-define', 'webp:alpha-quality=90', path.join(outDir, `${a.id}${suffix}.webp`)]);
    if (!suffix) convert([png, '-resize', '480x270', '-quality', '80', path.join(outDir, `${a.id}-sm.webp`)]);
    await rm(png);
  }
  console.log(`public/renders/autos/${a.id}.webp`);
}
await browser.close();
await server.close();
