// Copies the three.js pieces the app uses into vendor/ and rewrites their bare
// 'three' imports to relative ones, so the app runs with no bundler and no CDN.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const root = path.resolve(path.dirname(req.resolve('three')), '..');
const out = new URL('../vendor/', import.meta.url).pathname;

const FILES = [
  'build/three.module.js',
  'examples/jsm/controls/OrbitControls.js',
  'examples/jsm/loaders/GLTFLoader.js',
  'examples/jsm/utils/BufferGeometryUtils.js',
];

fs.mkdirSync(out, { recursive: true });
for (const f of FILES) {
  const name = path.basename(f);
  const src = fs.readFileSync(path.join(root, f), 'utf8')
    .replace(/from 'three';/g, "from './three.module.js';")
    .replace(/from '\.\.\/utils\/BufferGeometryUtils\.js'/g, "from './BufferGeometryUtils.js'");
  fs.writeFileSync(path.join(out, name), src);
  console.log('vendored', name);
}
