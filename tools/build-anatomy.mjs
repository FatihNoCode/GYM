// Builds models/anatomy-upper.glb from the Svitylo release of the Z-Anatomy atlas.
//
// The source has every muscle as its own named structure (4484 of them), so the
// muscle groups this program trains are picked by name — no coordinate cutting.
// Everything else that is visible on a standing body becomes one "context" mesh.
//
//   npm install && npm run build:anatomy
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

const require_ = createRequire(import.meta.url);
const DATA = path.join(
  path.dirname(require_.resolve('@authorod/svitylo-3d-anatomy-data/package.json')),
  'releases/1.2.0',
);
const OUT = process.argv[2] || new URL('../models/anatomy-upper.glb', import.meta.url).pathname;

// minimal FileReader for the exporter in Node
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((b) => {
    this.result = 'data:application/octet-stream;base64,' + Buffer.from(b).toString('base64'); this.onloadend?.(); }); }
};

/* ------------------------------------------------------------------ *
 * What goes in the model
 * ------------------------------------------------------------------ */

// Structure id (without the _l / _r side suffix) -> muscle group in js/data.js.
const MUSCLE_OF = {
  clavicular_head_of_pectoralis_major_muscle: 'chest_upper',
  sternocostal_head_of_pectoralis_major_muscle: 'chest_mid',
  abdominal_part_of_pectoralis_major_muscle: 'chest_lower',

  clavicular_part_of_deltoid_muscle: 'delt_front',
  acromial_part_of_deltoid_muscle: 'delt_side',
  scapular_spinal_part_of_deltoid_muscle: 'delt_rear',

  long_head_of_biceps_brachii: 'biceps',
  short_head_of_biceps_brachii: 'biceps',
  brachialis_muscle: 'brachialis',
  brachioradialis_muscle: 'brachialis',

  long_head_of_triceps_brachii: 'triceps',
  lateral_head_of_triceps_brachii: 'triceps',
  medial_head_of_triceps_brachii: 'triceps',
  anconeus_muscle: 'triceps',

  flexor_carpi_radialis: 'forearm_flex',
  humeral_head_of_flexor_carpi_ulnaris: 'forearm_flex',
  ulnar_head_of_flexor_carpi_ulnaris: 'forearm_flex',
  palmaris_longus_muscle: 'forearm_flex',
  humero_ulnar_head_of_flexor_digitorum_superficialis: 'forearm_flex',
  radial_head_of_flexor_digitorum_superficialis: 'forearm_flex',
  flexor_digitorum_profundus: 'forearm_flex',
  flexor_pollicis_longus: 'forearm_flex',
  superficial_head_of_pronator_teres: 'forearm_flex',
  deep_head_of_pronator_teres: 'forearm_flex',
  pronator_quadratus: 'forearm_flex',

  extensor_carpi_radialis_longus: 'forearm_ext',
  extensor_carpi_radialis_brevis: 'forearm_ext',
  humeral_head_of_extensor_carpi_ulnaris: 'forearm_ext',
  ulnar_head_of_extensor_carpi_ulnaris: 'forearm_ext',
  extensor_digitorum: 'forearm_ext',
  extensor_digiti_minimi: 'forearm_ext',
  extensor_indicis: 'forearm_ext',
  abductor_pollicis_longus: 'forearm_ext',
  extensor_pollicis_longus: 'forearm_ext',
  extensor_pollicis_brevis: 'forearm_ext',
  supinator: 'forearm_ext',

  latissimus_dorsi_muscle: 'lats',
  teres_major_muscle: 'lats',

  rhomboid_major_muscle: 'back_mid',
  rhomboid_minor_muscle: 'back_mid',

  descending_part_of_trapezius_muscle: 'traps',
  transverse_part_of_trapezius_muscle: 'traps',
  ascending_part_of_trapezius_muscle: 'traps',
  levator_scapulae: 'traps',
};

// Chunks loaded at full ("standard") quality because they hold trained muscles.
const MUSCLE_CHUNKS = [
  'muscular.anterior_compartment_of_arm',          // biceps, brachialis
  'muscular.muscles_of_upper_limb',                // forearm flexors, hand
  'muscular.muscles_of_upper_limb.2',              // triceps, forearm extensors
  'muscular.scapulohumeral_muscles--diaphragm',    // deltoid parts, rotator cuff
  'muscular.hypaxial_muscles_of_back',             // lats, traps, rhomboids
  'muscular.muscles_of_thorax.3',                  // pectoralis major parts
];

// Chunks loaded at "economy" quality purely so the figure reads as a body.
const CONTEXT_CHUNKS = [
  'muscular.cervical_part_of_muscular_system',
  'muscular.muscles_of_thorax.4',                  // serratus anterior
  'muscular.muscles_of_abdomen',
  'muscular.muscles_of_abdomen.2',
  'muscular.muscles_of_abdomen.3',
  'muscular.external_abdominal_oblique_muscle_l',
  'muscular.epaxial_muscles',                      // erectors
  'muscular.muscular_system_of_lower_limb',
  'muscular.anterior_compartment_of_thigh',
  'muscular.posterior_compartment_of_thigh',
  'muscular.medial_compartment_of_thigh',
  'muscular.posterior_compartment_of_leg',
  'muscular.muscles_of_lower_limb',
  'muscular.superficial_gluteal_muscles--bursae_of_upper_limb',
  'muscular.muscles_of_foot',
  'muscular.cranial_part_of_muscular_system',      // a face, so the figure reads as a person
  'skeletal.cranium--extracranial_bones_of_head',  // a head to orient by
];

// Never useful here: deep, hidden or non-muscular structures.
const DROP = [
  /bursa/, /fascia/, /sheath/, /tendinous_arch/, /ligament/,
  /intercostal/, /levatores_/, /transversus_thoracis/, /subclavius/,
  /diaphragm/, /coccygeus/, /levator_ani/, /pubo/, /anal_sphincter/, /pelvic/,
  /intertransversarii/, /serratus_posterior/, /pectoralis_minor/,
  /longus_colli/, /longus_capitis/, /scalene/, /prevertebral/,
];

// Triangle budgets. The muscles keep enough resolution to stay smooth; the
// context is squeezed hard because it is only ever seen as a silhouette.
const MUSCLE_BUDGET = 9000;    // per muscle group, per side
const CONTEXT_RATIO = 0.22;
const CONTEXT_FLOOR = 300;
const HAND_Y = 0.93;           // below the wrist: hand, not a trained muscle

/* ------------------------------------------------------------------ */

const manifest = JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8'));
const chunkById = new Map(manifest.chunks.map((c) => [c.id, c]));
const structureOfMesh = new Map();
for (const s of manifest.structures) for (const mi of s.meshes || []) structureOfMesh.set(mi, s.id);

const groupFor = (structureId) => {
  const bare = structureId.replace(/^[a-z]+\./, '');
  const sided = bare.match(/^(.*)_(l|r)$/);
  const base = sided ? sided[1] : bare;
  const side = sided ? sided[2] : '';
  if (DROP.some((re) => re.test(base))) return null;
  const muscle = MUSCLE_OF[base];
  if (!muscle) return 'context';
  return side ? `${muscle}#${side}` : muscle;
};

function simplify(geo, targetTris) {
  const index = geo.getIndex().array;
  const tris = index.length / 3;
  if (tris <= targetTris) return geo;
  const target = Math.max(300, Math.floor(targetTris)) * 3;
  const idx32 = index instanceof Uint32Array ? index : new Uint32Array(index);
  const [dst] = MeshoptSimplifier.simplify(idx32, geo.getAttribute('position').array, 3, target, 0.02, ['LockBorder']);
  const out = geo.clone();
  out.setIndex(new THREE.BufferAttribute(dst, 1));
  return out;
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const loadChunk = (id, quality) => new Promise((resolve, reject) => {
  const chunk = chunkById.get(id);
  if (!chunk) return reject(new Error(`unknown chunk ${id}`));
  const file = path.join(DATA, chunk.files[quality].path);
  const buf = fs.readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  loader.parse(ab, '', (gltf) => resolve(gltf), reject);
});

// group id -> { pos: number[] } (normals are recomputed after welding)
const groups = new Map();
const pushTri = (id, p) => {
  let g = groups.get(id);
  if (!g) groups.set(id, (g = { pos: [] }));
  g.pos.push(...p);
};

await MeshoptSimplifier.ready;

const a = new THREE.Vector3();
for (const [list, quality, keepMuscles] of [[MUSCLE_CHUNKS, 'standard', true], [CONTEXT_CHUNKS, 'economy', false]]) {
  for (const chunkId of list) {
    const gltf = await loadChunk(chunkId, quality);
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      // positions arrive quantized (normalized int16); float them before transforming
      const q = geo.getAttribute('position');
      const f = new Float32Array(q.count * 3);
      for (let i = 0; i < q.count; i++) { f[i * 3] = q.getX(i); f[i * 3 + 1] = q.getY(i); f[i * 3 + 2] = q.getZ(i); }
      geo.setAttribute('position', new THREE.BufferAttribute(f, 3));
      geo.applyMatrix4(o.matrixWorld);
      const pos = geo.getAttribute('position');
      const ids = geo.getAttribute('_id');
      for (let t = 0; t < pos.count; t += 3) {
        const structure = structureOfMesh.get(ids ? ids.getX(t) : -1);
        if (!structure) continue;
        let id = groupFor(structure);
        if (!id) continue;
        if (!keepMuscles && id !== 'context') id = 'context';
        const p = [];
        let y = 0;
        for (let k = 0; k < 3; k++) { a.fromBufferAttribute(pos, t + k); p.push(a.x, a.y, a.z); y += a.y / 3; }
        // the long finger tendons are part of the forearm muscles but read as
        // spikes on the hand: keep them, but not as part of the trained group
        if (id !== 'context' && y < HAND_Y) id = 'context';
        pushTri(id, p);
      }
    });
    console.log('read', chunkId.padEnd(52), quality);
  }
}

/* ---------- weld, smooth, simplify, export ---------- */
const scene = new THREE.Scene();
let total = 0;
for (const [id, g] of [...groups.entries()].sort()) {
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.pos), 3));
  geo = mergeVertices(geo, 1e-5);
  const isContext = id === 'context';
  const tris = geo.getIndex().count / 3;
  geo = simplify(geo, isContext ? Math.max(CONTEXT_FLOOR, tris * CONTEXT_RATIO) : MUSCLE_BUDGET);
  geo = mergeVertices(geo, 1e-5);
  geo.computeVertexNormals();          // smooth shading, no faceting
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.name = id;
  scene.add(mesh);
  const out = geo.getIndex().count / 3;
  total += out;
  console.log(id.padEnd(18), String(tris).padStart(7), '->', String(out).padStart(7));
}
console.log('total triangles', total);

new GLTFExporter().parse(scene, (glb) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(glb));
  console.log('wrote', OUT, (fs.statSync(OUT).size / 1e6).toFixed(2), 'MB');
}, (e) => { console.error('export error', e); process.exit(1); }, { binary: true });
