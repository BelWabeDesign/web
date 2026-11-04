// Visor 3D de autos: carga public/models/autos/<id>.glb, aplica la pintura de
// cada auto y deja girarlo y mirarlo desde arriba o desde abajo.
// Solo dibuja mientras el lienzo está en pantalla y baja la resolución si el
// equipo no llega a ~30 fps.

import {
  BackSide,
  Box3,
  BoxGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { asset } from '../asset.js';
import { autoById } from './autos.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
export const loadAuto = (id) => {
  if (!cache.has(id)) cache.set(id, loader.loadAsync(asset(`models/autos/${id}.glb`)));
  return cache.get(id);
};

/** Estudio fotográfico: sala oscura con cajas de luz, para que la pintura tenga reflejos con contraste. */
function studio(renderer) {
  const scene = new Scene();
  const room = new Mesh(new BoxGeometry(24, 12, 24), new MeshBasicMaterial({ color: 0x1d1e20, side: BackSide }));
  room.position.y = 5;
  scene.add(room);
  const floor = new Mesh(new PlaneGeometry(24, 24), new MeshBasicMaterial({ color: 0x5d5e60 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.98;
  scene.add(floor);
  const box = (w, h, pos, rot, k) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(k, k, k), side: DoubleSide }));
    m.position.set(...pos);
    m.rotation.set(...rot);
    scene.add(m);
  };
  box(10, 4, [0, 10.8, 0], [Math.PI / 2, 0, 0], 5);
  box(7, 3.5, [-11.8, 3.5, 0], [0, Math.PI / 2, 0], 2.4);
  box(7, 3.5, [11.8, 3.5, 3], [0, -Math.PI / 2, 0], 1.8);
  box(14, 1.4, [0, 2.2, -11.8], [0, 0, 0], 1.3);
  box(14, 1.4, [0, 2.2, 11.8], [0, Math.PI, 0], 1.1);
  const pmrem = new PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.015).texture;
  pmrem.dispose();
  return tex;
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function makeMaterial(name, auto) {
  const base = { side: DoubleSide };
  switch (name) {
    case 'pintura':
      return new MeshPhysicalMaterial({
        ...base,
        color: new Color(auto.pintura.color),
        metalness: auto.pintura.metalness,
        roughness: auto.pintura.roughness,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
      });
    case 'cristal':
      return new MeshPhysicalMaterial({ ...base, color: 0x0d0f12, roughness: 0.04, metalness: 0, clearcoat: 1 });
    case 'negro':
      return new MeshPhysicalMaterial({ ...base, color: 0x111214, roughness: 0.55, metalness: 0 });
    case 'piloto':
      return new MeshPhysicalMaterial({ ...base, color: 0x5e070c, roughness: 0.2, emissive: 0x9a0a12, emissiveIntensity: 0.9, clearcoat: 1 });
    case 'faro':
      return new MeshPhysicalMaterial({ ...base, color: 0x262b31, roughness: 0.04, metalness: 0.3, clearcoat: 1 });
    case 'luz':
      return new MeshBasicMaterial({ color: 0xf4f7fa });
    case 'neumatico':
      return new MeshPhysicalMaterial({ ...base, color: 0x161616, roughness: 0.9, metalness: 0 });
    case 'llanta':
      return new MeshPhysicalMaterial({ ...base, color: new Color(auto.llantas), roughness: 0.34, metalness: 0.75 });
    case 'disco':
      return new MeshPhysicalMaterial({ ...base, color: 0x77797d, roughness: 0.42, metalness: 0.9 });
    case 'pinza':
      return new MeshPhysicalMaterial({ ...base, color: new Color(auto.pinzas), roughness: 0.35, metalness: 0.1, clearcoat: 0.6 });
    default:
      return new MeshPhysicalMaterial({ ...base, color: 0x888888 });
  }
}

export class CarViewer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ spin?: number, fov?: number, elevation?: number, azimuth?: number, fit?: number, interactive?: boolean, preserve?: boolean, scanColor?: string }} opts
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = { spin: 0.1, fov: 26, elevation: 0.2, azimuth: -0.62, fit: 1.04, interactive: true, scanColor: '#e7a8b9', ...opts };
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!opts.preserve });
    this.maxRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.ratio = this.maxRatio;
    this.slow = 0;
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.localClippingEnabled = true;

    this.scene = new Scene();
    this.scene.environment = studio(this.renderer);
    this.scene.environmentIntensity = 1.25;

    const key = new DirectionalLight(0xffffff, 1.6);
    key.position.set(2.5, 6, 3.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 4;
    key.shadow.bias = -0.0005;
    Object.assign(key.shadow.camera, { left: -3.4, right: 3.4, top: 3.4, bottom: -3.4, near: 1, far: 14 });
    this.scene.add(key);

    this.ground = new Mesh(new PlaneGeometry(16, 16), new ShadowMaterial({ opacity: 0.22 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.camera = new PerspectiveCamera(this.opts.fov, 1, 0.1, 60);
    this.turntable = new Group();
    this.scene.add(this.turntable);

    // Escáner: un plano que recorre el auto de la trompa a la cola.
    this.clip = new Plane(new Vector3(1, 0, 0), 99);
    this.scan = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({ color: new Color(this.opts.scanColor), transparent: true, opacity: 0.55, side: DoubleSide, depthWrite: false }),
    );
    this.scan.visible = false;
    this.turntable.add(this.scan);

    this.azimuth = this.opts.azimuth;
    this.elevation = this.opts.elevation;
    this.velocity = 0;
    this.visible = true;
    this.running = false;
    this.last = performance.now();
    this.idle = 0;

    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) this.start();
    }).observe(canvas);
    if (this.opts.interactive) this.bind();
  }

  bind() {
    const c = this.canvas;
    let p0 = null;
    let lastT = 0;
    c.addEventListener('pointerdown', (e) => {
      p0 = [e.clientX, e.clientY];
      lastT = performance.now();
      c.setPointerCapture(e.pointerId);
      c.dataset.dragging = '';
    });
    c.addEventListener('pointermove', (e) => {
      if (!p0) return;
      const dx = e.clientX - p0[0];
      const dy = e.clientY - p0[1];
      const now = performance.now();
      const d = (dx / c.clientWidth) * Math.PI * 1.4;
      this.azimuth += d;
      this.velocity = d / Math.max(0.016, (now - lastT) / 1000);
      if (e.pointerType !== 'touch') this.elevation = Math.min(0.62, Math.max(0.02, this.elevation + (dy / c.clientHeight) * 0.9));
      p0 = [e.clientX, e.clientY];
      lastT = now;
      this.idle = 0;
      this.frame();
      this.start();
    });
    const end = () => {
      p0 = null;
      delete c.dataset.dragging;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('keydown', (e) => {
      const step = { ArrowLeft: [-0.3, 0], ArrowRight: [0.3, 0], ArrowUp: [0, 0.06], ArrowDown: [0, -0.06] }[e.key];
      if (!step) return;
      e.preventDefault();
      this.azimuth += step[0];
      this.elevation = Math.min(0.62, Math.max(0.02, this.elevation + step[1]));
      this.idle = 0;
      this.frame();
      this.start();
    });
  }

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.car) this.frame();
    this.camera.updateProjectionMatrix();
    this.renderOnce();
  }

  async show(id) {
    const auto = autoById(id);
    const gltf = await loadAuto(auto.id);
    const car = gltf.scene.clone(true);
    const mats = new Map();
    car.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.material.name;
      if (!mats.has(name)) {
        const m = makeMaterial(name, auto);
        m.clippingPlanes = [this.clip];
        mats.set(name, m);
      }
      o.material = mats.get(name);
      o.castShadow = true;
      o.receiveShadow = true;
    });
    if (this.car) {
      this.turntable.remove(this.car);
      this.mats?.forEach((m) => m.dispose());
    }
    this.car = car;
    this.mats = mats;
    this.auto = auto;
    this.turntable.add(car);
    this.box = new Box3().setFromObject(car);
    this.clip.constant = 99;
    this.frame();
    this.start();
    return this;
  }

  /** Coloca la cámara según el giro y la altura actuales, encuadrando el auto. */
  frame() {
    if (!this.box) return;
    const size = this.box.getSize(new Vector3());
    const center = this.box.getCenter(new Vector3());
    const r = Math.hypot(size.x, size.z) / 2;
    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const dist = (Math.max(r / Math.tan(hFov / 2), (size.y * 1.9) / 2 / Math.tan(vFov / 2)) * this.opts.fit) + r * 0.3;
    const target = new Vector3(center.x * 0, size.y * 0.42, 0);
    this.camera.position.set(
      Math.sin(this.azimuth) * Math.cos(this.elevation) * dist,
      target.y + Math.sin(this.elevation) * dist,
      Math.cos(this.azimuth) * Math.cos(this.elevation) * dist,
    );
    this.camera.lookAt(target);
    this.camera.near = dist / 30;
    this.camera.far = dist * 4;
    this.camera.updateProjectionMatrix();
  }

  /** El auto aparece de la trompa a la cola, como si lo escanearan. */
  reveal(duration = 2200) {
    if (!this.box || reduceMotion()) {
      this.clip.constant = 99;
      this.renderOnce();
      return Promise.resolve();
    }
    const x0 = this.box.max.x + 0.05;
    const x1 = this.box.min.x - 0.05;
    const size = this.box.getSize(new Vector3());
    this.scan.scale.set(size.z + 0.2, size.y + 0.25, 1);
    this.scan.rotation.y = Math.PI / 2;
    this.scan.position.y = (size.y + 0.25) / 2 - 0.05;
    this.scan.visible = true;
    return new Promise((resolve) => {
      const t0 = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / duration);
        const e = 1 - Math.pow(1 - k, 3);
        const x = x0 + (x1 - x0) * e;
        this.scanX = x;
        this.scan.position.x = x;
        this.scan.material.opacity = 0.55 * (1 - Math.pow(k, 4));
        this.start();
        if (k < 1) requestAnimationFrame(tick);
        else {
          this.scan.visible = false;
          this.scanX = null;
          this.clip.constant = 99;
          this.renderOnce();
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  updateClip() {
    if (this.scanX == null) return;
    // El plano sigue el eje largo del auto aunque la plataforma gire.
    const n = new Vector3(-1, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), this.turntable.rotation.y);
    this.clip.normal.copy(n);
    this.clip.constant = this.scanX;
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
      this.idle += dt;
      this.velocity *= Math.pow(0.03, dt);
      if (!('dragging' in this.canvas.dataset)) {
        this.azimuth += this.velocity * dt + (this.idle > 1.5 ? spin * dt : 0);
        this.frame();
      }
      this.updateClip();
      this.renderer.render(this.scene, this.camera);
      const still = spin === 0 && Math.abs(this.velocity) < 0.01 && this.scanX == null && !('dragging' in this.canvas.dataset);
      if (still) {
        this.running = false;
        return;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  adapt(frameTime) {
    if (frameTime > 0.2) return;
    this.slow = frameTime > 1 / 28 ? this.slow + 1 : Math.max(0, this.slow - 1);
    if (this.slow > 45 && this.ratio > 0.6) {
      this.ratio = Math.max(0.6, this.ratio - 0.25);
      this.slow = 0;
      this.renderer.setPixelRatio(this.ratio);
      this.resize();
    }
  }

  renderOnce() {
    if (!this.running) this.renderer.render(this.scene, this.camera);
  }
}
