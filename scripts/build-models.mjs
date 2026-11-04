// Genera public/models/<id>.glb a partir de los perfiles de src/data/catalog.js.
//
//   npm run models
//
// Cada perfil (media silueta exterior, en cm) se muestrea con una spline, se
// le da grosor de pared desplazándolo por su normal, se redondea el labio y se
// hace girar 360° (LatheGeometry), igual que una pieza en el torno.
// Salen dos primitivas con materiales distintos: «esmalte» y «pie» (el anillo
// de barro sin esmaltar). Después se cuantiza y se comprime con meshopt.

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LatheGeometry, SplineCurve, Vector2 } from 'three';
import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { products, glazeById, clay } from '../src/data/catalog.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'public', 'models');
const CM = 0.01; // glTF trabaja en metros
const SEGMENTS = 80;
const STEP_CM = 0.4; // separación entre puntos del perfil

const hexToLinear = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
};

/** Perfil cerrado (exterior + labio + interior) en cm, y cuántos puntos son pie. */
function closedProfile(product) {
  const ctrl = product.profile.map(([r, y]) => new Vector2(r, y));
  const curve = new SplineCurve(ctrl);
  const n = Math.min(120, Math.max(36, Math.ceil(curve.getLength() / STEP_CM)));
  const outer = curve.getSpacedPoints(n);
  outer[0].x = 0;

  const t = product.wall;
  const normalAt = (pts, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const d = new Vector2().subVectors(b, a).normalize();
    return new Vector2(-d.y, d.x); // hacia dentro de la pieza
  };

  const inner = outer.map((p, i) => p.clone().addScaledVector(normalAt(outer, i), t));
  // El interior termina en el eje: quitar lo que lo cruce y cerrar en r = 0.
  while (inner.length > 2 && inner[1].x <= 0.05) inner.shift();
  inner[0] = new Vector2(0, Math.max(inner[0].y, outer[0].y + t));

  // Labio: medio círculo del borde exterior al interior.
  const P = outer[outer.length - 1];
  const Q = inner[inner.length - 1];
  const C = new Vector2().addVectors(P, Q).multiplyScalar(0.5);
  const a = new Vector2().subVectors(P, C);
  const tan = new Vector2().subVectors(P, outer[outer.length - 2]).normalize().multiplyScalar(a.length());
  const lip = [];
  for (let k = 1; k < 8; k++) {
    const th = (k / 8) * Math.PI;
    lip.push(new Vector2(C.x + a.x * Math.cos(th) + tan.x * Math.sin(th), C.y + a.y * Math.cos(th) + tan.y * Math.sin(th)));
  }

  const points = [...outer, ...lip, ...inner.reverse()];
  // Pie sin esmaltar: el tramo exterior por debajo de la línea de esmalte.
  let footCount = 0;
  while (footCount < outer.length && outer[footCount].y < product.footLine) footCount++;
  let length = 0;
  for (let i = 1; i < points.length; i++) length += points[i].distanceTo(points[i - 1]);
  return { points, footCount, lengthCm: length };
}

async function build(product, io) {
  const { points, footCount, lengthCm } = closedProfile(product);
  const geo = new LatheGeometry(points.map((p) => p.clone().multiplyScalar(CM)), SEGMENTS);
  const pos = geo.getAttribute('position').array;
  const nor = geo.getAttribute('normal').array;
  const uv = geo.getAttribute('uv').array;

  // LatheGeometry: vértice (i, j) = i * points.length + j; i = segmento, j = punto del perfil.
  const P = points.length;
  const glazeIdx = [];
  const footIdx = [];
  for (let i = 0; i < SEGMENTS; i++) {
    for (let j = 0; j < P - 1; j++) {
      const a = i * P + j;
      const b = a + P;
      const c = a + P + 1;
      const d = a + 1;
      const target = j < footCount ? footIdx : glazeIdx;
      target.push(a, b, d, c, d, b);
    }
  }

  const doc = new Document().setLogger(new Logger(Logger.Verbosity.WARN));
  const buffer = doc.createBuffer();
  const position = doc.createAccessor('POSITION').setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer);
  const normal = doc.createAccessor('NORMAL').setType('VEC3').setArray(new Float32Array(nor)).setBuffer(buffer);
  const texcoord = doc.createAccessor('TEXCOORD_0').setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buffer);

  const glaze = glazeById(product.glaze);
  const glazeMat = doc
    .createMaterial('esmalte')
    .setBaseColorFactor([...hexToLinear(glaze.color), 1])
    .setRoughnessFactor(glaze.roughness)
    .setMetallicFactor(glaze.metalness);
  const footMat = doc
    .createMaterial('pie')
    .setBaseColorFactor([...hexToLinear(clay.foot), 1])
    .setRoughnessFactor(0.9)
    .setMetallicFactor(0);

  const prim = (indices, material) =>
    doc
      .createPrimitive()
      .setAttribute('POSITION', position)
      .setAttribute('NORMAL', normal)
      .setAttribute('TEXCOORD_0', texcoord)
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer))
      .setMaterial(material);

  const mesh = doc.createMesh(product.id).addPrimitive(prim(glazeIdx, glazeMat)).addPrimitive(prim(footIdx, footMat));
  const node = doc
    .createNode(product.id)
    .setMesh(mesh)
    .setExtras({
      heightCm: product.height,
      diameterCm: product.diameter,
      profileLengthCm: Number(lengthCm.toFixed(2)),
    });
  doc.createScene('pieza').addChild(node);
  doc.getRoot().getAsset().generator = 'Torno · scripts/build-models.mjs';

  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const file = path.join(outDir, `${product.id}.glb`);
  await io.write(file, doc);
  const tris = (glazeIdx.length + footIdx.length) / 3;
  return { file: path.relative(root, file), verts: pos.length / 3, tris };
}

await MeshoptEncoder.ready;
await mkdir(outDir, { recursive: true });
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const { stat } = await import('node:fs/promises');
for (const product of products) {
  const r = await build(product, io);
  const kb = ((await stat(path.join(root, r.file))).size / 1024).toFixed(1);
  console.log(`${r.file}  ${r.verts} vértices · ${r.tris} triángulos · ${kb} KB`);
}
