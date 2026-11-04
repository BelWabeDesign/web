// Genera public/models/autos/<id>.glb a partir de src/concesionario/autos.js.
//
//   npm run cars            (todos)
//   npm run cars -- gt3rs   (uno)
//
// Cómo se construye cada auto:
//  1. Campo de distancia: la silueta lateral, el ancho en planta (con caída del
//     habitáculo) y el capó hundido entre los guardabarros se combinan con
//     uniones suaves; los pasos de rueda se recortan con cilindros.
//  2. Se extrae la superficie con «surface nets» sobre una rejilla de 14 mm.
//  3. Cada triángulo se clasifica por zona: pintura, vidrio, plástico negro
//     (tomas de aire, faldones, difusor), luz trasera y paso de rueda.
//  4. Se simplifica cada zona respetando sus bordes (meshoptimizer).
//  5. Se añaden piezas sueltas: ruedas, faros, espejos y alerón.
//  6. Se escribe un .glb cuantizado y comprimido con meshopt.

import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Matrix4,
  Quaternion,
  Shape,
  SphereGeometry,
  SplineCurve,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { autos } from '../src/concesionario/autos.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'public', 'models', 'autos');
const H = 0.014; // lado del vóxel, en metros

// ---------- utilidades ----------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
};

/** Curva y(x) suave por puntos, muestreada en las x de la rejilla. */
function lut(points, xs) {
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  const dense = new SplineCurve(sorted.map(([x, y]) => new Vector2(x, y))).getPoints(1200).sort((a, b) => a.x - b.x);
  const out = new Float32Array(xs.length);
  let p = 0;
  xs.forEach((x, i) => {
    if (x <= dense[0].x) return (out[i] = dense[0].y);
    if (x >= dense[dense.length - 1].x) return (out[i] = dense[dense.length - 1].y);
    while (dense[p + 1].x < x) p++;
    const a = dense[p];
    const b = dense[p + 1];
    out[i] = a.y + ((x - a.x) / Math.max(1e-9, b.x - a.x)) * (b.y - a.y);
  });
  return out;
}

/** Distancia con signo a un polígono 2D (negativa dentro). */
function polygonSdf(poly, px, py) {
  let d = Infinity;
  let s = 1;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const vi = poly[i];
    const vj = poly[j];
    const ex = vj[0] - vi[0];
    const ey = vj[1] - vi[1];
    const wx = px - vi[0];
    const wy = py - vi[1];
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1);
    const bx = wx - ex * t;
    const by = wy - ey * t;
    d = Math.min(d, bx * bx + by * by);
    const c1 = py >= vi[1];
    const c2 = py < vj[1];
    const c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}

// ---------- campo de distancia ----------
function buildField(geo) {
  const ring = new CatmullRomCurve3(
    geo.outline.map(([x, y]) => new Vector3(x, y, 0)),
    true,
    'centripetal',
  );
  const poly = ring.getSpacedPoints(720).slice(0, -1).map((v) => [v.x, v.y]);
  const xs0 = Math.min(...poly.map((p) => p[0])) - 0.08;
  const xs1 = Math.max(...poly.map((p) => p[0]), geo.splitter?.x ?? -9) + 0.08;
  const yTop = Math.max(...poly.map((p) => p[1])) + 0.06;
  const zMax = Math.max(...geo.width.map((p) => p[1]), ...(geo.fenders ?? []).map((f) => f.z + f.rz)) + 0.08;

  const nx = Math.ceil((xs1 - xs0) / H) + 1;
  const ny = Math.ceil(yTop / H) + 1;
  const nzh = Math.ceil(zMax / H) + 1;
  const nz = nzh * 2 - 1;
  const origin = [xs0, 0, -(nzh - 1) * H];
  const xs = Array.from({ length: nx }, (_, i) => xs0 + i * H);

  const side = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) side[i + nx * j] = polygonSdf(poly, xs[i], j * H);

  const wb = lut(geo.width, xs);
  const wc = lut(geo.cabin, xs);
  const belt = lut(geo.belt, xs);
  const top = new Float32Array(nx);
  for (let i = 0; i < nx; i++) {
    let t = 0;
    for (let j = ny - 1; j > 0; j--) {
      const a = side[i + nx * j];
      const b = side[i + nx * (j - 1)];
      if (a >= 0 && b < 0) {
        t = (j - a / (a - b)) * H;
        break;
      }
    }
    top[i] = t;
  }
  const hood = geo.hood;
  const dip = Float32Array.from(xs, (x) =>
    hood ? hood.dip * smoothstep(hood.from, hood.from + 0.3, x) * (1 - smoothstep(hood.to - 0.25, hood.to, x)) : 0,
  );

  const wheels = [geo.wheels.front, geo.wheels.rear].map((w) => ({
    x: w.x,
    y: w.r,
    ra: w.r + 0.035,
    zin: w.track / 2 - w.w / 2 - 0.045,
  }));
  const sp = geo.splitter;

  const ctx = { geo, poly, nx, ny, nz, nzh, origin, xs, side, wb, wc, belt, top, dip, wheels };

  // Distancia en un punto de la rejilla (i, j) a |z| = az.
  ctx.sample = (i, j, x, y, az, ds) => {
    if (ds > 0.25) return ds;
    const yb = belt[i];
    const t = smoothstep(yb - 0.03, yb + 0.1, y);
    let w = wb[i] * (1 - t) + (wc[i] - Math.max(0, y - yb) * geo.tumble) * t;
    if (y < 0.36) {
      const u = 0.36 - y;
      w -= u * u * 1.6;
    }
    let d = smax(ds, az - w, geo.edge);
    if (dip[i] > 0) {
      const bell = 1 - smoothstep(hood.inner, hood.outer, az);
      d = smax(d, y - (top[i] - dip[i] * bell), 0.06);
    }
    // Guardabarros: volúmenes redondos sobre cada rueda, fundidos con la carrocería.
    for (const f of geo.fenders ?? []) {
      const px = (x - f.x) / f.rx;
      const py = (y - f.y) / f.ry;
      const pz = (az - f.z) / f.rz;
      const k0 = Math.hypot(px, py, pz);
      const k1 = Math.hypot(px / f.rx, py / f.ry, pz / f.rz);
      d = smin(d, (k0 * (k0 - 1)) / k1, 0.14);
    }
    for (const wh of wheels) {
      const cyl = Math.hypot(x - wh.x, y - wh.y) - wh.ra;
      const arch = Math.max(cyl, wh.zin - az);
      d = smax(d, -arch, 0.03);
    }
    if (sp) {
      const cx = (sp.x + sp.from) / 2;
      const qx = Math.abs(x - cx) - (sp.x - sp.from) / 2;
      const qy = Math.abs(y - (sp.y + 0.012)) - 0.012;
      const qz = az - sp.w;
      const box = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - 0.008;
      d = Math.min(d, box);
    }
    return d;
  };

  // Distancia en un punto cualquiera (para apoyar faros y espejos en la carrocería).
  ctx.at = (x, y, z) => {
    const fi = clamp((x - xs0) / H, 0, nx - 1.001);
    const fj = clamp(y / H, 0, ny - 1.001);
    const i = Math.floor(fi);
    const j = Math.floor(fj);
    const u = fi - i;
    const v = fj - j;
    const s = (a, b) => side[a + nx * b];
    const ds = (s(i, j) * (1 - u) + s(i + 1, j) * u) * (1 - v) + (s(i, j + 1) * (1 - u) + s(i + 1, j + 1) * u) * v;
    return ctx.sample(Math.round(fi), j, x, y, Math.abs(z), ds);
  };
  ctx.normalAt = (x, y, z) => {
    const e = 0.004;
    return new Vector3(
      ctx.at(x + e, y, z) - ctx.at(x - e, y, z),
      ctx.at(x, y + e, z) - ctx.at(x, y - e, z),
      ctx.at(x, y, z + e) - ctx.at(x, y, z - e),
    ).normalize();
  };
  // Interpolación de las curvas en una x cualquiera.
  ctx.curve = (arr, x) => {
    const f = clamp((x - xs0) / H, 0, nx - 1.001);
    const i = Math.floor(f);
    return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
  };

  const field = new Float32Array(nx * ny * nz);
  for (let kh = 0; kh < nzh; kh++) {
    const az = kh * H;
    const kp = (nzh - 1 + kh) * nx * ny;
    const km = (nzh - 1 - kh) * nx * ny;
    for (let j = 0; j < ny; j++) {
      const y = j * H;
      for (let i = 0; i < nx; i++) {
        const d = ctx.sample(i, j, xs[i], y, az, side[i + nx * j]);
        field[kp + i + nx * j] = d;
        field[km + i + nx * j] = d;
      }
    }
  }
  ctx.field = field;
  return ctx;
}

// ---------- surface nets ----------
function surfaceNets({ field, nx, ny, nz, origin }) {
  const cx = nx - 1;
  const cy = ny - 1;
  const R = [1, cx, cx * cy];
  const buffer = new Int32Array(cx * cy * (nz - 1)).fill(-1);
  const pos = [];
  const faces = [];
  const corners = [0, 1, nx, nx + 1, nx * ny, nx * ny + 1, nx * ny + nx, nx * ny + nx + 1];
  const cornerXYZ = [0, 1, 2, 3, 4, 5, 6, 7].map((c) => [c & 1, (c >> 1) & 1, (c >> 2) & 1]);
  const edges = [];
  for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) if ([1, 2, 4].includes(a ^ b)) edges.push([a, b]);
  const v = new Float32Array(8);

  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const g = i + nx * (j + ny * k);
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          v[c] = field[g + corners[c]];
          if (v[c] < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [a, b] of edges) {
          if ((v[a] < 0) === (v[b] < 0)) continue;
          const t = v[a] / (v[a] - v[b]);
          const A = cornerXYZ[a];
          const B = cornerXYZ[b];
          sx += A[0] + (B[0] - A[0]) * t;
          sy += A[1] + (B[1] - A[1]) * t;
          sz += A[2] + (B[2] - A[2]) * t;
          n++;
        }
        const m = i + cx * (j + cy * k);
        buffer[m] = pos.length / 3;
        pos.push(origin[0] + (i + sx / n) * H, origin[1] + (j + sy / n) * H, origin[2] + (k + sz / n) * H);

        const x = [i, j, k];
        for (let ax = 0; ax < 3; ax++) {
          if (!(mask & 1) === !(mask & (1 << (1 << ax)))) continue;
          const iu = (ax + 1) % 3;
          const iv = (ax + 2) % 3;
          if (x[iu] === 0 || x[iv] === 0) continue;
          const du = R[iu];
          const dv = R[iv];
          const q = [buffer[m], buffer[m - du], buffer[m - du - dv], buffer[m - dv]];
          if (q.some((e) => e < 0)) continue;
          if (mask & 1) faces.push(q[0], q[1], q[2], q[0], q[2], q[3]);
          else faces.push(q[0], q[3], q[2], q[0], q[2], q[1]);
        }
      }
  return { positions: new Float32Array(pos), indices: new Uint32Array(faces) };
}

function vertexNormals(positions, indices) {
  const n = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const fx = uy * vz - uz * vy;
    const fy = uz * vx - ux * vz;
    const fz = ux * vy - uy * vx;
    for (const p of [a, b, c]) {
      n[p] += fx;
      n[p + 1] += fy;
      n[p + 2] += fz;
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l;
    n[i + 1] /= l;
    n[i + 2] /= l;
  }
  return n;
}

// ---------- zonas de la carrocería ----------
function classify(ctx, positions, normals, indices) {
  const { geo } = ctx;
  const g = geo.glass;
  const lineX = (seg, y) => {
    const [[x0, y0], [x1, y1]] = seg;
    return x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
  };
  const xMin = Math.min(...ctx.poly.map((p) => p[0]));
  const groups = { pintura: [], cristal: [], negro: [], piloto: [] };

  for (let t = 0; t < indices.length; t += 3) {
    const ids = [indices[t], indices[t + 1], indices[t + 2]];
    let cx = 0, cy = 0, cz = 0, nx = 0, ny = 0, nz = 0;
    for (const id of ids) {
      cx += positions[id * 3] / 3;
      cy += positions[id * 3 + 1] / 3;
      cz += positions[id * 3 + 2] / 3;
      nx += normals[id * 3];
      ny += normals[id * 3 + 1];
      nz += normals[id * 3 + 2];
    }
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const az = Math.abs(cz);

    // Fondo plano: nunca se ve.
    if (cy < 0.16 && ny < -0.75) continue;

    const belt = ctx.curve(ctx.belt, cx);
    const top = ctx.curve(ctx.top, cx);
    const cab = ctx.curve(ctx.wc, cx) - Math.max(0, cy - belt) * geo.tumble;
    let zone = 'pintura';

    const inWheel = ctx.wheels.some((w) => Math.hypot(cx - w.x, cy - w.y) < w.ra + 0.03 && az < w.zin + 0.25 && (az < w.zin + 0.02 || Math.hypot(cx - w.x, cy - w.y) < w.ra + 0.012));
    if (inWheel || cy < geo.sill) zone = 'negro';
    else if (
      Math.abs(nz) > 0.45 && cy > belt + 0.015 && cy < top - g.side.top &&
      cx <= lineX(g.side.a, cy) && cx >= lineX(g.side.c, cy)
    ) {
      zone = g.side.pillars.some(([a, b]) => cx > a && cx < b) ? 'negro' : 'cristal';
    } else if (g.front && cx > g.front.x[0] && cx < g.front.x[1] && nx > 0.3 && cy > belt + 0.03 && az < cab - g.front.inset) {
      zone = 'cristal';
    } else if (g.rear && cx > g.rear.x[0] && cx < g.rear.x[1] && nx < -0.15 && ny > 0.2 && cy > belt + 0.01 && az < cab - g.rear.inset) {
      zone = 'cristal';
    } else if (nx < -0.45 && cy > geo.lightbar[0] && cy < geo.lightbar[1] && cx < xMin + 0.4) {
      zone = 'piloto';
    } else {
      for (const b of geo.black) {
        const facing =
          b.n === 'any' ||
          (b.n === 'front' && nx > 0.4) ||
          (b.n === 'rear' && nx < -0.4) ||
          (b.n === 'top' && ny > 0.6) ||
          (b.n === 'side' && Math.abs(nz) > 0.5);
        if (facing && cx >= b.x[0] && cx <= b.x[1] && cy >= b.y[0] && cy <= b.y[1] && az >= b.z[0] && az <= b.z[1]) {
          zone = 'negro';
          break;
        }
      }
    }
    groups[zone].push(...ids);
  }
  return groups;
}

/** Copia compacta de una zona, simplificada sin mover sus bordes. */
function simplifyGroup(positions, normals, ids, ratio) {
  const map = new Map();
  const p = [];
  const n = [];
  const idx = new Uint32Array(ids.length);
  ids.forEach((id, i) => {
    let v = map.get(id);
    if (v === undefined) {
      v = p.length / 3;
      map.set(id, v);
      p.push(positions[id * 3], positions[id * 3 + 1], positions[id * 3 + 2]);
      n.push(normals[id * 3], normals[id * 3 + 1], normals[id * 3 + 2]);
    }
    idx[i] = v;
  });
  const P = new Float32Array(p);
  const target = Math.max(3, Math.floor((idx.length * ratio) / 3) * 3);
  const [simple] = MeshoptSimplifier.simplify(idx, P, 3, target, 0.0012, ['LockBorder']);
  // Quitar vértices sin uso.
  const keep = new Map();
  const p2 = [];
  const n2 = [];
  const out = new Uint32Array(simple.length);
  simple.forEach((v, i) => {
    let k = keep.get(v);
    if (k === undefined) {
      k = p2.length / 3;
      keep.set(v, k);
      p2.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
      n2.push(n[v * 3], n[v * 3 + 1], n[v * 3 + 2]);
    }
    out[i] = k;
  });
  return { positions: new Float32Array(p2), normals: new Float32Array(n2), indices: out };
}

// ---------- piezas ----------
const clean = (g) => {
  const ng = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(ng.attributes)) if (k !== 'position' && k !== 'normal') ng.deleteAttribute(k);
  if (!ng.attributes.normal) ng.computeVertexNormals();
  return ng;
};

function wheelParts({ r, w, rim, spokes = 10 }) {
  const parts = { neumatico: [], llanta: [], disco: [], pinza: [] };
  // Neumático: perfil redondeado que gira alrededor del eje.
  const c = 0.045;
  const prof = [new Vector2(rim + 0.004, -w / 2 + 0.012), new Vector2(r - c, -w / 2)];
  for (let a = 1; a < 6; a++) {
    const th = -Math.PI / 2 + (a / 6) * (Math.PI / 2);
    prof.push(new Vector2(r - c + Math.cos(th) * c, -w / 2 + c + Math.sin(th) * c));
  }
  prof.push(new Vector2(r, -w / 2 + c), new Vector2(r + 0.002, 0), new Vector2(r, w / 2 - c));
  for (let a = 1; a < 6; a++) {
    const th = (a / 6) * (Math.PI / 2);
    prof.push(new Vector2(r - c + Math.cos(th) * c, w / 2 - c + Math.sin(th) * c));
  }
  prof.push(new Vector2(r - c, w / 2), new Vector2(rim + 0.004, w / 2 - 0.012));
  parts.neumatico.push(new LatheGeometry(prof, 72).rotateX(Math.PI / 2));

  // Llanta: barril, aro exterior y radios hasta la tuerca central.
  const barrel = [
    new Vector2(rim - 0.018, -w / 2 + 0.03), new Vector2(rim - 0.006, -w / 2 + 0.012), new Vector2(rim + 0.01, -w / 2 + 0.01),
    new Vector2(rim + 0.01, -w / 2 + 0.002), new Vector2(rim - 0.02, -w / 2), new Vector2(rim - 0.03, w / 2 - 0.06),
    new Vector2(rim - 0.022, w / 2 - 0.012), new Vector2(rim + 0.012, w / 2 - 0.004), new Vector2(rim + 0.012, w / 2 + 0.004),
    new Vector2(rim - 0.01, w / 2 + 0.004),
  ];
  parts.llanta.push(new LatheGeometry(barrel, 72).rotateX(Math.PI / 2));
  const face = w / 2 - 0.035;
  for (let s = 0; s < spokes; s++) {
    const a = (s / spokes) * Math.PI * 2;
    const len = rim - 0.075;
    const spoke = new BoxGeometry(len, 0.024, 0.03);
    spoke.translate(0.07 + len / 2, 0, 0);
    // Radio cóncavo: la punta exterior más hundida que el centro.
    spoke.applyMatrix4(new Matrix4().makeRotationY(-0.12));
    spoke.translate(0, 0, face);
    spoke.rotateZ(a);
    parts.llanta.push(spoke);
  }
  parts.llanta.push(new CylinderGeometry(0.075, 0.08, 0.05, 32).rotateX(Math.PI / 2).translate(0, 0, face - 0.005));
  parts.llanta.push(new CylinderGeometry(0.042, 0.042, 0.05, 6).rotateX(Math.PI / 2).translate(0, 0, face + 0.02));

  // Freno: disco y pinza arriba, visibles entre los radios.
  parts.disco.push(new CylinderGeometry(rim - 0.055, rim - 0.055, 0.032, 48).rotateX(Math.PI / 2).translate(0, 0, w / 2 - 0.13));
  const caliper = new BoxGeometry(0.2, 0.075, 0.075);
  caliper.translate(0, rim - 0.085, w / 2 - 0.105);
  parts.pinza.push(caliper);
  return parts;
}

function addParts(ctx, bag) {
  const { geo } = ctx;
  const push = (mat, g, matrix) => {
    const c = g.clone();
    if (matrix) c.applyMatrix4(matrix);
    (bag[mat] ??= []).push(clean(c));
  };
  const mirrorZ = new Matrix4().makeScale(1, 1, -1);

  // Ruedas
  for (const wh of [geo.wheels.front, geo.wheels.rear]) {
    const parts = wheelParts(wh);
    for (const side of [1, -1]) {
      const m = new Matrix4().makeTranslation(wh.x, wh.r, (side * wh.track) / 2);
      if (side < 0) m.multiply(mirrorZ);
      for (const [mat, list] of Object.entries(parts)) list.forEach((g) => push(mat, g, m));
    }
  }

  // Faros: se apoyan sobre la superficie del guardabarros delantero.
  const hl = geo.headlights;
  let x = Math.max(...ctx.poly.map((p) => p[0])) + 0.2;
  while (x > 0 && ctx.at(x, hl.y, hl.z) > 0) x -= 0.004;
  const nrm = ctx.normalAt(x, hl.y, hl.z);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), nrm);
  for (const side of [1, -1]) {
    const base = new Matrix4().compose(new Vector3(x, hl.y, hl.z).addScaledVector(nrm, 0.004), q, new Vector3(1, 1, 1));
    const m = side < 0 ? new Matrix4().multiplyMatrices(mirrorZ, base) : base;
    // Faro: lente oscura, aro negro y el anillo de luz diurna por dentro.
    push('faro', new SphereGeometry(hl.r, 32, 16).scale(1, 1, 0.38), m);
    push('negro', new TorusGeometry(hl.r, 0.011, 8, 48), m);
    push('luz', new TorusGeometry(hl.r * 0.62, 0.007, 6, 48).translate(0, 0, hl.r * 0.3), m);
  }

  // Espejos
  const mr = geo.mirror;
  let z = 1.3;
  while (z > 0 && ctx.at(mr.x, mr.y - 0.04, z) > 0) z -= 0.004;
  for (const side of [1, -1]) {
    const m = side < 0 ? mirrorZ : new Matrix4();
    push('negro', new SphereGeometry(1, 24, 14).scale(0.07, 0.052, 0.105).translate(mr.x - 0.02, mr.y + 0.01, z + 0.13), m);
    push('negro', new BoxGeometry(0.07, 0.022, 0.14).translate(mr.x + 0.005, mr.y - 0.03, z + 0.05), m);
  }

  // Alerón
  const wg = geo.wing;
  if (wg?.type === 'swan') {
    const chord = wg.front - wg.rear;
    const shape = new Shape();
    const n = 24;
    const pt = (s, upper) => {
      const xx = wg.front - s * chord;
      const lift = s * 0.075;
      const yy = upper ? wg.y + lift + 0.042 * Math.sin(Math.PI * Math.pow(s, 0.6)) : wg.y + lift - 0.01 * Math.sin(Math.PI * s);
      return [xx, yy];
    };
    shape.moveTo(...pt(0, true));
    for (let i = 1; i <= n; i++) shape.lineTo(...pt(i / n, true));
    for (let i = n; i >= 0; i--) shape.lineTo(...pt(i / n, false));
    const blade = new ExtrudeGeometry(shape, { depth: wg.span, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -wg.span / 2);
    push('pintura', blade);
    const plate = new Shape();
    plate.moveTo(wg.front + 0.02, wg.y - 0.035);
    plate.lineTo(wg.rear - 0.015, wg.y + 0.02);
    plate.lineTo(wg.rear - 0.02, wg.y + 0.135);
    plate.lineTo(wg.front - 0.03, wg.y + 0.07);
    plate.closePath();
    for (const side of [1, -1]) {
      const g = new ExtrudeGeometry(plate, { depth: 0.012, bevelEnabled: false }).translate(0, 0, side > 0 ? wg.span / 2 : -wg.span / 2 - 0.012);
      push('negro', g);
    }
    const deckY = ctx.curve(ctx.top, wg.mount) - 0.02;
    const mid = (wg.front + wg.rear) / 2;
    const neck = new CatmullRomCurve3([
      new Vector3(wg.mount, deckY, 0),
      new Vector3(wg.mount - 0.05, (deckY + wg.y) / 2 + 0.04, 0),
      new Vector3(mid + 0.05, wg.y + 0.085, 0),
      new Vector3(mid - 0.02, wg.y + 0.05, 0),
    ]);
    for (const side of [1, -1]) push('negro', new TubeGeometry(neck, 48, 0.026, 10).scale(1, 1, 0.45).translate(0, 0, side * 0.38));
  } else if (wg?.type === 'duck') {
    const lip = new Shape();
    lip.moveTo(wg.front, wg.y - 0.012);
    lip.lineTo(wg.rear, wg.y + 0.012);
    lip.lineTo(wg.rear + 0.01, wg.y + 0.035);
    lip.lineTo(wg.front, wg.y + 0.004);
    lip.closePath();
    const span = ctx.curve(ctx.wc, wg.rear) * 2 + 0.18;
    push('negro', new ExtrudeGeometry(lip, { depth: span, bevelEnabled: false }).translate(0, 0, -span / 2));
  }
}

// ---------- materiales y escritura ----------
const hexToLinear = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
};

function materials(doc, auto) {
  const m = (name, hex, rough, metal, emissive) => {
    const mat = doc.createMaterial(name).setBaseColorFactor([...hexToLinear(hex), 1]).setRoughnessFactor(rough).setMetallicFactor(metal);
    if (emissive) mat.setEmissiveFactor(hexToLinear(emissive));
    mat.setDoubleSided(true);
    return mat;
  };
  return {
    pintura: m('pintura', auto.pintura.color, auto.pintura.roughness, auto.pintura.metalness),
    cristal: m('cristal', '#0e1013', 0.05, 0.0),
    negro: m('negro', '#121315', 0.55, 0.0),
    piloto: m('piloto', '#6d0b10', 0.25, 0.0, '#5a0408'),
    faro: m('faro', '#2a3036', 0.05, 0.2),
    luz: m('luz', '#f2f5f8', 0.2, 0.0, '#f2f5f8'),
    neumatico: m('neumatico', '#141414', 0.88, 0.0),
    llanta: m('llanta', auto.llantas, 0.36, 0.7),
    disco: m('disco', '#77797d', 0.42, 0.9),
    pinza: m('pinza', auto.pinzas, 0.35, 0.1),
  };
}

async function build(auto, io) {
  const t0 = Date.now();
  const ctx = buildField(auto.geo);
  const mesh = surfaceNets(ctx);
  let normals = vertexNormals(mesh.positions, mesh.indices);
  // Orientar hacia fuera: el volumen firmado debe ser positivo.
  let vol = 0;
  const P = mesh.positions;
  const I = mesh.indices;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3];
    vol += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
  }
  if (vol < 0) {
    for (let t = 0; t < I.length; t += 3) [I[t + 1], I[t + 2]] = [I[t + 2], I[t + 1]];
    normals = vertexNormals(P, I);
  }

  const groups = classify(ctx, P, normals, I);
  const doc = new Document().setLogger(new Logger(Logger.Verbosity.WARN));
  const buffer = doc.createBuffer();
  const mats = materials(doc, auto);
  const accessor = (arr, type) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
  const body = doc.createMesh('carroceria');
  let tris = 0;
  for (const [name, ids] of Object.entries(groups)) {
    if (!ids.length) continue;
    const g = simplifyGroup(P, normals, ids, name === 'pintura' ? 0.3 : 0.45);
    tris += g.indices.length / 3;
    body.addPrimitive(
      doc
        .createPrimitive()
        .setAttribute('POSITION', accessor(g.positions, 'VEC3'))
        .setAttribute('NORMAL', accessor(g.normals, 'VEC3'))
        .setIndices(accessor(g.indices, 'SCALAR'))
        .setMaterial(mats[name]),
    );
  }

  const bag = {};
  addParts(ctx, bag);
  const parts = doc.createMesh('piezas');
  for (const [name, list] of Object.entries(bag)) {
    const merged = mergeVertices(mergeGeometries(list), 1e-5);
    tris += merged.index.count / 3;
    parts.addPrimitive(
      doc
        .createPrimitive()
        .setAttribute('POSITION', accessor(new Float32Array(merged.attributes.position.array), 'VEC3'))
        .setAttribute('NORMAL', accessor(new Float32Array(merged.attributes.normal.array), 'VEC3'))
        .setIndices(accessor(new Uint32Array(merged.index.array), 'SCALAR'))
        .setMaterial(mats[name]),
    );
  }

  const scene = doc.createScene(auto.id);
  const node = doc.createNode(auto.id).setExtras({ modelo: `${auto.marca} ${auto.modelo}` });
  node.addChild(doc.createNode('carroceria').setMesh(body));
  node.addChild(doc.createNode('piezas').setMesh(parts));
  scene.addChild(node);
  doc.getRoot().getAsset().generator = 'Flyline · scripts/build-cars.mjs';
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const file = path.join(outDir, `${auto.id}.glb`);
  await io.write(file, doc);
  const kb = ((await stat(file)).size / 1024).toFixed(0);
  console.log(`public/models/autos/${auto.id}.glb  ${tris.toLocaleString('es')} triángulos · ${kb} KB · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
await mkdir(outDir, { recursive: true });
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const only = process.argv.slice(2);
for (const auto of autos) if (!only.length || only.includes(auto.id)) await build(auto, io);
