// Builds models/anatomy-upper.glb from the open-anatomy-3d BodyParts3D model:
// keeps the upper-body muscles, splits them per trained muscle group, decimates
// the rest of the body to a context mesh.  Run: npm i && npm run build:anatomy
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require_ = createRequire(import.meta.url);
const MODEL_SRC = path.join(path.dirname(require_.resolve('open-anatomy-3d/package.json')), 'models/anatomy-male.glb');
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

// minimal FileReader for the exporter in Node
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((b) => {
    this.result = 'data:application/octet-stream;base64,' + Buffer.from(b).toString('base64'); this.onloadend?.(); }); }
};

const OUT = process.argv[2] || new URL('../models/anatomy-upper.glb', import.meta.url).pathname;

// Source meshes kept from the BodyParts3D model. Anything not listed is dropped.
const CONTEXT = [
  'skull', 'hand_l', 'hand_r', 'foot_l', 'foot_r', 'pelvis',
  'abdominal_muscles', 'neck_muscles_l', 'neck_muscles_r',
  'back_muscles_l', 'back_muscles_r', 
  'quadriceps_l', 'quadriceps_r', 'hamstrings_l', 'hamstrings_r',
  'calf_l', 'calf_r', 'gluteal_l', 'gluteal_r', 'shin_muscles_l', 'shin_muscles_r',
  'adductors_l', 'adductors_r', 'hand_muscles_l', 'hand_muscles_r', 'foot_muscles_l', 'foot_muscles_r',
];

// Triangle-level split of the anatomical groups into the muscles the program trains.
// y = height (m, feet at 0), z = forward, x = left(+)/right(-).
const SPLIT = {
  chest_muscles: (c) => (c.y > 1.352 ? 'chest_upper' : c.y > 1.268 ? 'chest_mid' : 'chest_lower'),
  deltoid:       (c) => (c.z > -0.012 ? 'delt_front' : c.z < -0.055 ? 'delt_rear' : 'delt_side'),
  upper_arm_muscles: (c) => (c.z >= -0.028 ? (c.y < 1.16 ? 'brachialis' : 'biceps') : 'triceps'),
  forearm_muscles:   (c) => (c.z > 0.012 ? 'forearm_flex' : 'forearm_ext'),
  trapezius:         () => 'traps',
  shoulder_muscles:  (c) => (c.z < -0.015 ? (c.y < 1.33 ? 'lats' : 'back_mid') : 'context'),
};

const CONTEXT_RATIO = 0.35, MUSCLE_RATIO = 0.8;

function simplify(geo, ratio, sloppy = false) {
  const index = geo.getIndex().array;
  const pos = geo.getAttribute('position').array;
  const tris = index.length / 3;
  const target = Math.min(index.length, Math.max(300, Math.floor(tris * ratio)) * 3);
  if (target >= index.length) return geo;
  const idx32 = index instanceof Uint32Array ? index : new Uint32Array(index);
  const [dst, err] = sloppy
    ? MeshoptSimplifier.simplifySloppy(idx32, pos, 3, null, target, 0.2)
    : MeshoptSimplifier.simplify(idx32, pos, 3, target, 0.05, []);
  void err;
  const out = geo.clone();
  out.setIndex(new THREE.BufferAttribute(dst, 1));
  return out;
}

const buf = fs.readFileSync(MODEL_SRC);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

await MeshoptSimplifier.ready;
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(ab, '', (gltf) => {
  gltf.scene.updateMatrixWorld(true);
  const groups = {};   // id -> { pos:[], nor:[] }
  const push = (id, p, n) => {
    const g = (groups[id] ||= { pos: [], nor: [] });
    g.pos.push(...p); g.nor.push(...n);
  };

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c2 = new THREE.Vector3(), cen = new THREE.Vector3();

  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const base = o.name.replace(/_(l|r)$/, '');
    const isCtx = CONTEXT.includes(o.name);
    const splitter = SPLIT[base];
    if (!isCtx && !splitter) return;

    const src = o.geometry;
    const g = new THREE.BufferGeometry();
    for (const key of ['position', 'normal']) {
      const at = src.getAttribute(key);
      if (!at) continue;
      const out = new Float32Array(at.count * 3);
      for (let i = 0; i < at.count; i++) { out[i*3] = at.getX(i); out[i*3+1] = at.getY(i); out[i*3+2] = at.getZ(i); }
      g.setAttribute(key, new THREE.BufferAttribute(out, 3));
    }
    if (src.index) g.setIndex(src.index.clone());
    g.applyMatrix4(o.matrixWorld);
    // simplify per source mesh, where the topology is still clean
    const welded = mergeVertices(g.index ? g : g.toNonIndexed(), 1e-5);
    const reduced = simplify(welded, isCtx ? CONTEXT_RATIO : MUSCLE_RATIO, false);
    const gi = reduced.toNonIndexed();
    const pos = gi.attributes.position.array;
    const nor = gi.attributes.normal?.array;
    const side = o.name.endsWith('_r') ? 'r' : o.name.endsWith('_l') ? 'l' : '';

    for (let i = 0; i < pos.length; i += 9) {
      a.set(pos[i], pos[i + 1], pos[i + 2]);
      b.set(pos[i + 3], pos[i + 4], pos[i + 5]);
      c2.set(pos[i + 6], pos[i + 7], pos[i + 8]);
      cen.copy(a).add(b).add(c2).multiplyScalar(1 / 3);
      let id = isCtx ? 'context' : splitter(cen);
      if (id !== 'context' && side) id = `${id}#${side}`;
      const p = [pos[i], pos[i+1], pos[i+2], pos[i+3], pos[i+4], pos[i+5], pos[i+6], pos[i+7], pos[i+8]];
      const n = nor ? [nor[i], nor[i+1], nor[i+2], nor[i+3], nor[i+4], nor[i+5], nor[i+6], nor[i+7], nor[i+8]]
                    : new Array(9).fill(0);
      push(id, p, n);
    }
  });

  const scene = new THREE.Scene();
  let tris = 0;
  for (const [id, g] of Object.entries(groups)) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.pos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(g.nor), 3));
    if (!g.nor.some(Boolean)) geo.computeVertexNormals();
    const merged = mergeVertices(geo, 1e-5);
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial());
    mesh.name = id;
    scene.add(mesh);
    const t = merged.getIndex().count / 3;
    tris += t;
    console.log(id.padEnd(16), t);
  }
  console.log('total triangles', tris);

  new GLTFExporter().parse(scene, (glb) => {
    fs.mkdirSync(OUT.replace(/\/[^/]+$/, ''), { recursive: true });
    fs.writeFileSync(OUT, Buffer.from(glb));
    console.log('wrote', OUT, (fs.statSync(OUT).size / 1e6).toFixed(2), 'MB');
  }, (e) => console.error('export error', e), { binary: true });
}, (e) => console.error('parse error', e));
