import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';

// anatomy-upper.glb: Z-Anatomy muscles (CC BY-SA 4.0, via the Svitylo atlas data),
// one mesh per trained muscle group. Mesh names are `<muscleId>#l` / `#r`, plus `context`.
const MODEL = 'models/anatomy-upper.glb';
const MODEL_B64 = 'models/anatomy-upper.glb.b64.txt';

// Anatomical palette: everything is muscle-coloured, the plan only changes how
// alive it looks - resting flesh -> fresh pink -> worked amber -> fully worked red.
const CONTEXT = new THREE.Color(0xa36c63);   // muscle outside today's plan: dull flesh
const BONE    = new THREE.Color(0xd9d2c4);   // skeleton
const RESTING = new THREE.Color(0xa36c63);   // a trained group, but not today
const FRESH   = new THREE.Color(0xc93a2e);   // in the plan, nothing done yet
const WORKED  = new THREE.Color(0xd4821f);
const SPENT   = new THREE.Color(0xbe1d12);

export function createBody(container, onSelect) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // soft image-based lighting: the thing that stops muscle looking like plastic
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const PIVOT = new THREE.Vector3(0, 1.26, 0);   // upper-body framing by default   // chest height; model stands on y = 0
  camera.position.set(0, 1.3, 2.05);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(PIVOT);
  controls.enablePan = false;
  controls.minDistance = 0.6;
  controls.maxDistance = 4.5;
  controls.enableDamping = true;
  controls.rotateSpeed = 0.85;
  controls.zoomSpeed = 0.8;

  scene.add(new THREE.HemisphereLight(0xfff1e8, 0x1a1114, 0.38));
  const key = new THREE.DirectionalLight(0xfff4ec, 1.15); key.position.set(1.6, 2.4, 2.2); scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcd4ff, 0.32); fill.position.set(-2.2, 1.0, 1.4); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffd9c8, 0.65); rim.position.set(-0.6, 1.8, -2.6); scene.add(rim);

  const root = new THREE.Group();
  scene.add(root);

  const muscleMeshes = {};     // muscleId -> [mesh]
  const pickable = [];
  let state = {}, selected = null, hovered = null, ready = false;

  const muscleMaterial = () => new THREE.MeshPhysicalMaterial({
    color: RESTING.clone(),
    roughness: 0.52, metalness: 0,
    clearcoat: 0.45, clearcoatRoughness: 0.55,     // the damp sheen of fresh muscle
    sheen: 0.4, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xff9f94),
    emissive: new THREE.Color(0x000000), emissiveIntensity: 0,
  });

  const onLoad = (gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const id = o.name.split('#')[0];
      if (id === 'bone') {
        o.material = new THREE.MeshStandardMaterial({ color: BONE.clone(), roughness: 0.7, metalness: 0 });
        return;
      }
      if (!id || id === 'context') {
        o.material = muscleMaterial();     // same flesh, just not part of the plan
        o.material.color.copy(CONTEXT);
        return;
      }
      o.material = muscleMaterial();
      o.userData.muscle = id;
      (muscleMeshes[id] ||= []).push(o);
      pickable.push(o);
    });
    root.add(gltf.scene);
    ready = true;
    container.classList.remove('loading');
    apply();
  };
  const onError = (err) => {
    console.error('anatomy model failed to load', err);
    container.classList.remove('loading');
    container.classList.add('failed');
  };

  // Normally the .glb is fetched directly. Some static hosts refuse to serve
  // binary types they don't know, so fall back to a base64 copy of the same file.
  (async () => {
    const loader = new GLTFLoader();
    try {
      const res = await fetch(MODEL);
      if (res.ok) return loader.parse(await res.arrayBuffer(), '', onLoad, onError);
    } catch { /* fall through */ }
    try {
      const b64 = (await (await fetch(MODEL_B64)).text()).trim();
      const bin = atob(b64);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      loader.parse(buf.buffer, '', onLoad, onError);
    } catch (err) { onError(err); }
  })();

  /* ---------- colouring ---------- */
  function colorFor(id) {
    const s = state[id];
    if (!s || !s.planned) return { color: RESTING.clone(), emissive: 0 };
    if (s.ratio <= 0) return { color: FRESH.clone(), emissive: 0.08 };
    const c = s.ratio < 0.5
      ? FRESH.clone().lerp(WORKED, s.ratio / 0.5)
      : WORKED.clone().lerp(SPENT, (s.ratio - 0.5) / 0.5);
    return { color: c, emissive: 0.12 + 0.35 * s.ratio };
  }

  function apply() {
    if (!ready) return;
    for (const [id, meshes] of Object.entries(muscleMeshes)) {
      const { color, emissive } = colorFor(id);
      const lit = id === hovered || id === selected;
      for (const m of meshes) {
        m.material.color.copy(color);
        m.material.emissive.copy(lit ? color.clone().lerp(new THREE.Color(0xffffff), 0.6) : color);
        m.material.emissiveIntensity = lit ? 0.55 : emissive;
      }
    }
  }

  /* ---------- picking ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(ev) {
    if (!ready) return null;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(pickable, false)[0]?.object.userData.muscle ?? null;
  }
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const m = pick(e);
    if (m !== hovered) { hovered = m; renderer.domElement.style.cursor = m ? 'pointer' : 'grab'; apply(); }
  });
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved < 6) onSelect(pick(e));
  });

  /* ---------- public API ---------- */
  function setState(next, sel) { state = next; selected = sel ?? null; apply(); }

  // turn to a view instead of snapping, so you keep your bearings
  const FRAMES = {
    upper: { y: 1.26, d: 2.05 },     // shoulders to hips
    full:  { y: 0.95, d: 3.60 },     // head to feet
  };
  let frame = 'upper';
  let spin = null;
  const sph = new THREE.Spherical();

  function view(which) {
    if (which === 'upper' || which === 'full') return goto({ frame: which });
    const theta = { front: 0, back: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }[which];
    if (theta === undefined) return;
    goto({ theta, phi: Math.PI / 2 - 0.05 });
  }

  function goto({ theta, phi, frame: nextFrame }) {
    if (nextFrame) frame = nextFrame;
    const f = FRAMES[frame];
    sph.setFromVector3(camera.position.clone().sub(controls.target));
    const from = sph.theta;
    let to = theta ?? from;
    while (to - from > Math.PI) to -= 2 * Math.PI;
    while (to - from < -Math.PI) to += 2 * Math.PI;
    spin = {
      t0: performance.now(), ms: 480,
      theta0: from, theta1: to,
      phi0: sph.phi, phi1: phi ?? sph.phi,
      d0: sph.radius, d1: nextFrame ? f.d : sph.radius,
      y0: controls.target.y, y1: f.y,
    };
  }

  function stepSpin() {
    if (!spin) return;
    const k = Math.min(1, (performance.now() - spin.t0) / spin.ms);
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const mix = (a, b) => a + (b - a) * e;
    controls.target.y = mix(spin.y0, spin.y1);
    sph.set(mix(spin.d0, spin.d1), mix(spin.phi0, spin.phi1), mix(spin.theta0, spin.theta1));
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
    if (k >= 1) spin = null;
  }
  // a drag or a scroll cancels the animation
  renderer.domElement.addEventListener('pointerdown', () => { spin = null; }, true);
  renderer.domElement.addEventListener('wheel', () => { spin = null; }, { passive: true });

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  (function loop() {
    requestAnimationFrame(loop);
    stepSpin();
    controls.update();
    renderer.render(scene, camera);
  })();

  return { setState, view };
}
