// Visor 3D de piezas de cerámica: carga los .glb de public/models/, les pone
// el esmalte elegido y los hace girar como en el torno.
//
// Un mismo visor sirve para la portada, el configurador y la semana de la
// pieza. Solo dibuja mientras el lienzo está en pantalla.

import {
  NeutralToneMapping,
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  ShadowMaterial,
  SplineCurve,
  SRGBColorSpace,
  TubeGeometry,
  CatmullRomCurve3,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clay, glazeById, productById, sizeById } from '../data/catalog.js';
import { asset } from '../asset.js';

const TAU = Math.PI * 2;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

/** Carga (una vez) el .glb de una pieza. */
export function loadPiece(id) {
  if (!cache.has(id)) cache.set(id, loader.loadAsync(asset(`models/${id}.glb`)));
  return cache.get(id);
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

// Las líneas que deja el torno: un mapa de normales de ondas horizontales.
let ridgeSource = null;
function ridgeTexture(repeatY) {
  if (!ridgeSource) {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 128;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(4, 128);
    for (let y = 0; y < 128; y++) {
      // Dos ondas superpuestas para que no parezca mecánico.
      // Anillos irregulares: tres ondas de distinta frecuencia en una vuelta.
      const v = (y / 128) * TAU;
      const slope = 0.5 * Math.cos(v * 2) + 0.3 * Math.cos(v * 3 + 1.3) + 0.2 * Math.cos(v * 7 + 0.4);
      const n = new Vector3(0, slope, 1).normalize();
      for (let x = 0; x < 4; x++) {
        const i = (y * 4 + x) * 4;
        img.data[i] = (n.x * 0.5 + 0.5) * 255;
        img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
        img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ridgeSource = c;
  }
  const tex = new CanvasTexture(ridgeSource);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(1, repeatY);
  return tex;
}

// Corte angular: descarta lo que aún no ha «girado». uSweep va de 0 a 1.
function addSweep(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSweep = uniforms.uSweep;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLathe;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLathe = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLathe;\nuniform float uSweep;')
      .replace(
        'void main() {',
        `void main() {
          if (uSweep < 0.9999) {
            // Empieza en el costado (+x), donde el perfil se ve de lado.
            float ang = atan(vLathe.x, vLathe.z) - 1.57079632679;
            ang = mod(ang + 12.5663706144, 6.28318530718);
            if (ang > uSweep * 6.28318530718) discard;
          }`,
      );
  };
  material.customProgramCacheKey = () => 'torno-sweep';
}

function glazeMaterial(glaze, ridges, uniforms) {
  const m = new MeshPhysicalMaterial({
    color: new Color(glaze.color),
    roughness: glaze.roughness,
    metalness: glaze.metalness,
    clearcoat: glaze.clearcoat,
    clearcoatRoughness: 0.12,
    iridescence: glaze.iridescence ?? 0,
    iridescenceIOR: 1.7,
    normalMap: ridges,
    normalScale: new Vector2(0.1, 0.1),
    envMapIntensity: 1,
    side: DoubleSide,
  });
  addSweep(m, uniforms);
  return m;
}

function footMaterial(ridges, uniforms) {
  const m = new MeshPhysicalMaterial({
    color: new Color(clay.foot),
    roughness: 0.92,
    metalness: 0,
    normalMap: ridges,
    normalScale: new Vector2(0.3, 0.3),
    side: DoubleSide,
  });
  addSweep(m, uniforms);
  return m;
}

/** La silueta exterior de una pieza como un hilo fino, para el corte del torno. */
function profileLine(product, color, width = 1) {
  const curve = new SplineCurve(product.profile.map(([r, y]) => new Vector2(r, y)));
  const pts = curve.getSpacedPoints(120).map((p) => new Vector3(p.x * 0.01 + 0.0012, p.y * 0.01, 0));
  const geo = new TubeGeometry(new CatmullRomCurve3(pts), 240, Math.max(0.0016, product.height * 0.00009) * width, 6);
  const mesh = new Mesh(geo, new MeshBasicMaterial({ color, transparent: true, depthTest: true }));
  mesh.renderOrder = 2;
  return mesh;
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Viewer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ spin?: number, fov?: number, tilt?: number, fit?: number, lineColor?: string, interactive?: boolean, preserve?: boolean }} opts
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = { spin: 0.32, fov: 30, tilt: 0.24, fit: 1.12, lineColor: '#1d3db8', interactive: true, ...opts };
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: !!opts.preserve,
      powerPreference: 'high-performance',
    });
    this.maxRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.ratio = this.maxRatio;
    this.slowFrames = 0;
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;

    this.scene = new Scene();
    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.85;
    pmrem.dispose();

    const key = new DirectionalLight(0xffffff, 2.1);
    key.position.set(-1.2, 2.4, 1.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 6;
    key.shadow.bias = -0.0004;
    const sc = key.shadow.camera;
    sc.left = sc.bottom = -0.4;
    sc.right = sc.top = 0.4;
    sc.near = 0.5;
    sc.far = 5;
    this.scene.add(key);

    this.ground = new Mesh(new PlaneGeometry(4, 4), new ShadowMaterial({ opacity: 0.16 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.camera = new PerspectiveCamera(this.opts.fov, 1, 0.01, 20);
    this.turntable = new Group();
    this.scene.add(this.turntable);

    this.fitScale = this.opts.fitToLarge ? 1.2 : 1;
    this.uniforms = { uSweep: { value: 1 } };
    this.angle = 0;
    this.velocity = 0;
    this.look = null;
    this.piece = null;
    this.line = null;
    this.visible = true;
    this.running = false;
    this.last = performance.now();
    this.onFrame = null;

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) this.start();
    });
    this.io.observe(canvas);
    if (this.opts.interactive) this.bindDrag();
  }

  bindDrag() {
    const c = this.canvas;
    let x0 = null;
    let lastT = 0;
    c.addEventListener('pointerdown', (e) => {
      x0 = e.clientX;
      lastT = performance.now();
      c.setPointerCapture(e.pointerId);
      c.dataset.dragging = 'true';
    });
    c.addEventListener('pointermove', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      const now = performance.now();
      const d = (dx / c.clientWidth) * Math.PI * 1.6;
      this.angle += d;
      this.velocity = d / Math.max(0.016, (now - lastT) / 1000);
      x0 = e.clientX;
      lastT = now;
      this.start();
    });
    const end = () => {
      x0 = null;
      delete c.dataset.dragging;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    // Teclado: flechas para girar la pieza.
    c.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.velocity += e.key === 'ArrowLeft' ? -2.4 : 2.4;
        this.start();
      }
    });
  }

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.piece) this.frame();
    this.renderOnce();
  }

  /** Muestra una pieza. Devuelve cuando el modelo está cargado. */
  async show(productId, { glaze, size = 'm', sweep = 1 } = {}) {
    const product = productById(productId);
    const gltf = await loadPiece(product.id);
    const root = gltf.scene.clone(true);
    const extras = root.children[0]?.userData ?? {};
    const ridges = ridgeTexture((extras.profileLengthCm ?? 60) / 4.2);
    const glazeMat = glazeMaterial(glazeById(glaze ?? product.glaze), ridges, this.uniforms);
    const foot = footMaterial(ridges, this.uniforms);
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.name === 'pie' ? foot : glazeMat;
      o.castShadow = true;
      o.receiveShadow = true;
    });

    this.clearPiece();
    this.product = product;
    this.piece = root;
    this.materials = { glaze: glazeMat, foot, ridges };
    this.turntable.add(root);
    this.line = profileLine(product, this.opts.lineColor, this.opts.lineWidth ?? 1);
    this.line.visible = sweep < 1;
    this.turntable.add(this.line);
    this.setSize(size, true);
    this.setSweep(sweep);
    this.look = null;
    this.start();
    return this;
  }

  clearPiece() {
    if (!this.piece) return;
    this.turntable.remove(this.piece);
    this.turntable.remove(this.line);
    this.line.geometry.dispose();
    this.line.material.dispose();
    this.materials.glaze.dispose();
    this.materials.foot.dispose();
    this.materials.ridges.dispose();
    // La geometría se comparte con la caché del .glb: no se libera aquí.
    this.piece = null;
  }

  /** Encaja la cámara en la pieza (al tamaño grande, para que se note el cambio). */
  frame() {
    const p = this.product;
    const h = p.height * 0.01 * this.fitScale;
    const r = (p.diameter / 2) * 0.01 * this.fitScale;
    const tilt = this.opts.tiltOverride ?? p.tilt ?? this.opts.tilt;
    const vFov = (this.camera.fov * Math.PI) / 180;
    const needH = (h + r * 2 * Math.sin(tilt)) * this.opts.fit;
    const needW = r * 2 * this.opts.fit * 1.08;
    const distH = needH / 2 / Math.tan(vFov / 2);
    const distW = needW / 2 / Math.tan(vFov / 2) / this.camera.aspect;
    const dist = Math.max(distH, distW) + r;
    const target = new Vector3(0, h * 0.5, 0);
    this.camera.position.set(0, target.y + Math.sin(tilt) * dist, Math.cos(tilt) * dist);
    this.camera.lookAt(target);
    this.camera.near = dist / 20;
    this.camera.far = dist * 6;
    this.camera.updateProjectionMatrix();
  }

  setSize(sizeId, refit = false) {
    if (!this.piece) return;
    const s = sizeById(sizeId).scale;
    this.piece.scale.setScalar(s);
    this.line.scale.setScalar(s);
    if (refit) this.frame();
    this.renderOnce();
  }

  setGlaze(glazeId) {
    if (!this.piece) return;
    const g = glazeById(glazeId);
    const m = this.materials.glaze;
    m.color.set(g.color);
    m.roughness = g.roughness;
    m.metalness = g.metalness;
    m.clearcoat = g.clearcoat;
    m.iridescence = g.iridescence ?? 0;
    m.emissive.set(0x000000);
    this.start();
  }

  /** Aspecto libre (para la semana de la pieza): color, rugosidad, brillo, incandescencia. */
  setLook({ color, roughness, clearcoat = 0, metalness = 0, emissive = '#000000', emissiveIntensity = 0, foot }) {
    if (!this.piece) return;
    const m = this.materials.glaze;
    m.color.set(color);
    m.roughness = roughness;
    m.clearcoat = clearcoat;
    m.metalness = metalness;
    m.iridescence = 0;
    m.emissive.set(emissive);
    m.emissiveIntensity = emissiveIntensity;
    const f = this.materials.foot;
    f.color.set(foot ?? color);
    f.emissive.set(emissive);
    f.emissiveIntensity = emissiveIntensity;
    this.renderOnce();
  }

  setSweep(t) {
    const v = Math.min(1, Math.max(0, t));
    this.uniforms.uSweep.value = v;
    if (this.line) {
      this.line.visible = v < 0.999;
      this.line.rotation.y = v * TAU;
    }
    this.renderOnce();
  }

  /** Anima el giro que forma la pieza, de su perfil al volumen completo. */
  turn(duration = 2000) {
    if (reduceMotion()) {
      this.setSweep(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / duration);
        const e = 1 - Math.pow(1 - k, 3);
        this.setSweep(e);
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      this.setSweep(0);
      requestAnimationFrame(step);
    });
  }

  start() {
    if (this.running || !this.visible) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.visible) {
        this.running = false;
        return;
      }
      const raw = (now - this.last) / 1000;
      const dt = Math.min(0.05, raw);
      this.last = now;
      this.adapt(raw);
      const spin = reduceMotion() ? 0 : this.opts.spin;
      this.velocity *= Math.pow(0.04, dt);
      if (this.canvas.dataset.dragging !== 'true') this.angle += (spin + this.velocity) * dt;
      this.turntable.rotation.y = this.angle;
      this.onFrame?.(dt);
      this.renderer.render(this.scene, this.camera);
      // Sin giro y sin inercia no hace falta seguir dibujando.
      if (spin === 0 && Math.abs(this.velocity) < 0.01 && this.canvas.dataset.dragging !== 'true') {
        this.running = false;
        return;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Resolución adaptativa: si el equipo no llega a ~30 fps, baja la nitidez. */
  adapt(frameTime) {
    if (frameTime > 0.2) return; // pestaña en segundo plano o primer fotograma
    this.slowFrames = frameTime > 1 / 28 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 45 && this.ratio > 0.6) {
      this.ratio = Math.max(0.6, this.ratio - 0.25);
      this.slowFrames = 0;
      this.renderer.setPixelRatio(this.ratio);
      this.resize();
    }
  }

  renderOnce() {
    if (!this.running) this.renderer.render(this.scene, this.camera);
  }
}
