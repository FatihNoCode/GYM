import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

// anatomy-upper.glb: BodyParts3D muscles (CC BY 4.0, via open-anatomy-3d),
// split per training muscle group. Mesh names are `<muscleId>#l` / `#r`, plus `context`.
const MODEL = 'models/anatomy-upper.glb';
const MODEL_B64 = 'models/anatomy-upper.glb.b64.txt';

const CTX_COLOR = 0x39414f;   // bones and muscles outside the plan
const IDLE      = 0x8793a8;   // in today's plan, nothing done yet
const COOL = new THREE.Color(0x3fa7ff);
const WARM = new THREE.Color(0xffb020);
const HOT  = new THREE.Color(0xff3b30);

export function createBody(container, onSelect) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const PIVOT = new THREE.Vector3(0, 1.15, 0);   // chest height; model stands on y = 0
  camera.position.set(0, 1.25, 1.55);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(PIVOT);
  controls.enablePan = false;
  controls.minDistance = 0.5;
  controls.maxDistance = 3.2;
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x0e1219, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(1.5, 2.5, 2.5); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fc0ff, 0.8); fill.position.set(-2, 1, -2.5); scene.add(fill);
  const top = new THREE.DirectionalLight(0xffffff, 0.5); top.position.set(0, 3, -0.5); scene.add(top);

  const root = new THREE.Group();
  scene.add(root);

  const muscleMeshes = {};     // muscleId -> [mesh]
  const pickable = [];
  let state = {}, selected = null, hovered = null, ready = false;

  const onLoad = (gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const id = o.name.split('#')[0];
      o.material = new THREE.MeshStandardMaterial({
        color: CTX_COLOR, roughness: 0.62, metalness: 0.02, emissive: new THREE.Color(0x000000),
      });
      if (id && id !== 'context') {
        o.userData.muscle = id;
        (muscleMeshes[id] ||= []).push(o);
        pickable.push(o);
      }
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
    if (!s || !s.planned) return { color: new THREE.Color(CTX_COLOR), emissive: 0 };
    if (s.ratio <= 0) return { color: new THREE.Color(IDLE), emissive: 0.05 };
    const c = s.ratio < 0.5
      ? COOL.clone().lerp(WARM, s.ratio / 0.5)
      : WARM.clone().lerp(HOT, (s.ratio - 0.5) / 0.5);
    return { color: c, emissive: 0.2 + 0.5 * s.ratio };
  }

  function apply() {
    if (!ready) return;
    for (const [id, meshes] of Object.entries(muscleMeshes)) {
      const { color, emissive } = colorFor(id);
      const lit = id === hovered || id === selected;
      for (const m of meshes) {
        m.material.color.copy(color);
        m.material.emissive.copy(lit ? new THREE.Color(0xffffff) : color);
        m.material.emissiveIntensity = lit ? 0.4 : emissive;
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
    const m = pick(e);
    if (m !== hovered) { hovered = m; renderer.domElement.style.cursor = m ? 'pointer' : 'grab'; apply(); }
  });
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved < 5) onSelect(pick(e));
  });

  /* ---------- public API ---------- */
  function setState(next, sel) { state = next; selected = sel ?? null; apply(); }

  function view(which) {
    const d = camera.position.distanceTo(controls.target);
    const p = {
      front: [0, PIVOT.y, d], back: [0, PIVOT.y, -d],
      left: [-d, PIVOT.y, 0], right: [d, PIVOT.y, 0],
    }[which];
    camera.position.set(...p);
    controls.target.copy(PIVOT);
    controls.update();
  }

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
    controls.update();
    renderer.render(scene, camera);
  })();

  return { setState, view };
}
