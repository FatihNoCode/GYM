import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';

const BASE = 0x2a323f;   // untargeted body
const IDLE = 0x6c7f9e;   // muscle in today's plan, nothing done yet
const COOL = new THREE.Color(0x3fa7ff);
const WARM = new THREE.Color(0xffb020);
const HOT  = new THREE.Color(0xff3b30);

export function createBody(container, onSelect) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.5, 2.15);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.48, 0);
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 5;
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x14181f, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.9); rim.position.set(-2, 1, -3); scene.add(rim);

  const root = new THREE.Group();
  scene.add(root);

  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const muscleMeshes = {};   // id -> [mesh]

  function blob({ pos, scale, rot = [0, 0, 0], muscle = null, color = BASE, mirror = false }) {
    const make = (sx) => {
      const m = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({
        color, roughness: 0.55, metalness: 0.05,
        emissive: 0x000000, emissiveIntensity: 0.9,
      }));
      m.position.set(pos[0] * sx, pos[1], pos[2]);
      m.scale.set(scale[0], scale[1], scale[2]);
      m.rotation.set(rot[0], rot[1] * sx, rot[2] * sx);
      if (muscle) {
        m.userData.muscle = muscle;
        (muscleMeshes[muscle] ||= []).push(m);
      }
      root.add(m);
      return m;
    };
    make(1);
    if (mirror) make(-1);
  }

  // ---- neutral body ----
  blob({ pos: [0, 0.93, 0], scale: [0.1, 0.12, 0.105] });                      // head
  blob({ pos: [0, 0.79, -0.01], scale: [0.05, 0.055, 0.05] });                 // neck
  blob({ pos: [0, 0.56, 0], scale: [0.195, 0.235, 0.105] });                   // ribcage
  blob({ pos: [0, 0.3, 0], scale: [0.15, 0.13, 0.088] });                      // abs
  blob({ pos: [0, 0.08, 0], scale: [0.175, 0.1, 0.1] });                       // pelvis
  blob({ pos: [0.09, -0.24, 0], scale: [0.088, 0.27, 0.095], mirror: true });  // thigh
  blob({ pos: [0.095, -0.62, 0], scale: [0.065, 0.2, 0.072], mirror: true });  // calf
  blob({ pos: [0.095, -0.85, 0.03], scale: [0.05, 0.038, 0.1], mirror: true });// foot
  blob({ pos: [0.3, 0.14, 0], scale: [0.042, 0.055, 0.045], mirror: true });   // hand
  blob({ pos: [0.26, 0.36, 0], scale: [0.042, 0.045, 0.045], mirror: true });  // elbow

  // ---- muscles (sit on the surface of the torso / arms) ----
  blob({ muscle: 'chest_upper', pos: [0.082, 0.665, 0.082], scale: [0.095, 0.05, 0.06], rot: [0, 0, -0.3], mirror: true });
  blob({ muscle: 'chest_mid',   pos: [0.088, 0.59, 0.09], scale: [0.1, 0.055, 0.062], mirror: true });
  blob({ muscle: 'chest_lower', pos: [0.082, 0.515, 0.082], scale: [0.092, 0.045, 0.056], rot: [0, 0, 0.25], mirror: true });

  blob({ muscle: 'delt_front', pos: [0.2, 0.665, 0.055], scale: [0.05, 0.055, 0.045], mirror: true });
  blob({ muscle: 'delt_side',  pos: [0.225, 0.675, 0], scale: [0.055, 0.065, 0.06], mirror: true });
  blob({ muscle: 'delt_rear',  pos: [0.2, 0.665, -0.055], scale: [0.05, 0.055, 0.045], mirror: true });

  blob({ muscle: 'biceps',  pos: [0.243, 0.5, 0.035], scale: [0.04, 0.078, 0.04], rot: [0, 0, 0.08], mirror: true });
  blob({ muscle: 'triceps', pos: [0.245, 0.5, -0.04], scale: [0.042, 0.088, 0.042], rot: [0, 0, 0.08], mirror: true });

  blob({ muscle: 'brachialis',   pos: [0.268, 0.33, 0.025], scale: [0.038, 0.05, 0.04], mirror: true });
  blob({ muscle: 'forearm_flex', pos: [0.275, 0.245, 0.035], scale: [0.035, 0.072, 0.036], mirror: true });
  blob({ muscle: 'forearm_ext',  pos: [0.285, 0.25, -0.03], scale: [0.034, 0.072, 0.035], mirror: true });

  blob({ muscle: 'lats',     pos: [0.135, 0.48, -0.055], scale: [0.095, 0.155, 0.08], rot: [0, 0, 0.2], mirror: true });
  blob({ muscle: 'back_mid', pos: [0.07, 0.615, -0.086], scale: [0.09, 0.1, 0.055], mirror: true });
  blob({ muscle: 'traps',    pos: [0.08, 0.745, -0.035], scale: [0.095, 0.055, 0.065], rot: [0, 0, -0.4], mirror: true });

  // ---- interaction ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;
  const pickable = Object.values(muscleMeshes).flat();

  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(pickable, false)[0]?.object.userData.muscle ?? null;
  }

  renderer.domElement.addEventListener('pointermove', (e) => {
    const m = pick(e);
    if (m !== hovered) { hovered = m; renderer.domElement.style.cursor = m ? 'pointer' : 'grab'; applyHover(); }
  });
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved < 5) onSelect(pick(e));
  });

  // ---- colouring ----
  let state = {};  // muscleId -> { planned:bool, ratio:0..1 }
  let selected = null;

  function colorFor(id) {
    const s = state[id];
    if (!s || !s.planned) return { color: new THREE.Color(BASE), emissive: 0 };
    if (s.ratio <= 0) return { color: new THREE.Color(IDLE), emissive: 0.06 };
    const c = s.ratio < 0.5
      ? COOL.clone().lerp(WARM, s.ratio / 0.5)
      : WARM.clone().lerp(HOT, (s.ratio - 0.5) / 0.5);
    return { color: c, emissive: 0.25 + 0.6 * s.ratio };
  }

  function applyHover() {
    for (const [id, meshes] of Object.entries(muscleMeshes)) {
      const { color, emissive } = colorFor(id);
      const lit = id === hovered || id === selected;
      for (const m of meshes) {
        m.material.color.copy(color);
        m.material.emissive.copy(lit ? new THREE.Color(0xffffff) : color);
        m.material.emissiveIntensity = lit ? 0.35 : emissive;
      }
    }
  }

  function setState(next, sel) { state = next; selected = sel ?? null; applyHover(); }

  function view(which) {
    const d = camera.position.distanceTo(controls.target);
    const p = { front: [0, 0.5, d], back: [0, 0.5, -d], left: [-d, 0.5, 0], right: [d, 0.5, 0] }[which];
    camera.position.set(...p);
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

  applyHover();
  return { setState, view };
}
