# Upper Body Lab

A single-page planner / tracker / 3D muscle map for a two-day upper-body split (Day A push, Day B pull).
No build step, no server-side anything: plain HTML + ES modules + a vendored copy of three.js.
Your log is stored in the browser (localStorage) and the app works offline once loaded.

The figure is a real anatomical model — Z-Anatomy muscle meshes, one mesh per anatomical
structure — assembled into the muscle groups this program trains by `tools/build-anatomy.mjs`.

## Run it

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (ES modules need `http://`, opening the file directly will not work.)

On a phone: open that URL on the same wifi, or host the folder on GitHub Pages / Netlify and
use "Add to home screen" — it is a PWA and caches itself for offline use at the gym.

## What it does

- **3D muscle map** — the whole body, muscle by muscle. The muscles in today's plan are
  anatomical pink-red; everything else (untrained muscle, bone) is pale grey, so the plan reads
  at a glance. As you tick sets off, the trained muscles warm from pink → amber → deep red.
  Drag to turn, scroll or pinch to zoom, front/back/left/right, upper body / whole body.
  Tap a muscle to filter the exercise list to the lifts that hit it.
  Groups: pecs (upper/mid/lower, the real clavicular, sternocostal and abdominal heads),
  deltoid (front/side/rear), biceps, brachialis, triceps, forearm flexors and extensors,
  lats, rhomboids, traps.
- **Day A / Day B plans** — exactly the split in `js/data.js`, with sets × reps, the do/don't cue
  for each lift, and a one-tap swap to the backup exercise when a machine is occupied.
- **One-tap set logging** — each set row has − / + steppers for weight and reps, and the boxes
  are pre-filled (as placeholders) with your previous set, or your last session's best. Tick the
  set and whatever the placeholder showed is what gets logged, so a normal set is one tap.
- **"Next set ↓"** jumps to the first exercise you have not finished; that card is outlined.
- **Rest timer** — starts by itself when you tick a set (75 s on high-rep work, 120 s on heavy),
  runs in a bar at the bottom of the screen with +30 s and Skip, and beeps when it is done.
- **Weekly volume per muscle** — effective sets over the last 7 days, weighted by how much each
  exercise actually contributes to that muscle. Anything under 6 sets a week is flagged.
- **Phone layout** — Body / Today's plan tabs, so the list is not buried under the model.
- **Form videos** — each exercise links to a YouTube search for that exact machine and lift.
- **Export / import** — JSON backup of your whole log.

## Files

| File | Purpose |
|---|---|
| `index.html` | Layout |
| `styles.css` | Styling |
| `js/data.js` | The training plan: exercises, cues, muscle contributions. **Edit this to change the program.** |
| `js/body3d.js` | three.js scene, muscle materials and the heat map |
| `js/store.js` | localStorage log + history lookups |
| `js/app.js` | UI wiring |
| `sw.js`, `manifest.webmanifest` | Offline / installable support |
| `models/anatomy-upper.glb` | The anatomy model: 28 named muscle meshes + context + bone |
| `tools/build-anatomy.mjs` | Rebuilds that model (`npm run build:anatomy`) |
| `tools/vendor-three.mjs` | Re-copies three.js into `vendor/` (`npm run vendor`) |
| `vendor/` | three.js r169 (vendored so the app works with no network) |

## Changing the program

Everything lives in `js/data.js`. An exercise entry looks like:

```js
{ id: 'a6', day: 'A', target: 'Side delts',
  main: 'Lateral raise machine', backup: 'Single-arm cable lateral raise',
  sets: 4, reps: '12–20',
  do: 'Lead with your elbows and stop at shoulder height.',
  dont: "Don't shrug or swing.",
  muscles: { delt_side: 1, traps: 0.2 } }
```

`muscles` maps a muscle id (see `MUSCLES` at the top of the file) to how much of the work it takes —
`1` for the prime mover, lower for helpers. That is what drives both the 3D heat map and the
weekly volume numbers.

## Rebuilding the 3D model

```bash
npm install
npm run build:anatomy
```

`tools/build-anatomy.mjs` reads the Z-Anatomy geometry from `@authorod/svitylo-3d-anatomy-data`,
where every muscle is a separate named structure, and:

- maps the structures this program trains onto the muscle groups in `js/data.js`
  (`MUSCLE_OF` at the top of the file — e.g. the clavicular head of pectoralis major is
  `chest_upper`, the acromial part of the deltoid is `delt_side`);
- reads those chunks at full quality and the rest of the body at a lighter one, so the untrained
  muscles, the ribs and the skeleton are still there as context;
- simplifies **per structure**, never across two muscles that touch, which is what keeps each
  muscle's own outline instead of fusing neighbours into one blob;
- recomputes smooth normals and writes `models/anatomy-upper.glb` (~6.6 MB, ~300k triangles).

Mesh names are `<muscleId>#l` / `<muscleId>#r` for the trained groups, plus `context` and `bone`.

## Credits

Anatomy: [Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) — the libre 3D atlas of
anatomy, CC BY-SA 4.0, derived from BodyParts3D © The Database Center for Life Science — as
packaged in the [Svitylo 3D Anatomy Atlas](https://github.com/authorOd/3d-anatomy-atlas) data
release (`@authorod/svitylo-3d-anatomy-data`). The model in `models/` is an adaptation of that
geometry and is therefore **CC BY-SA 4.0** as well.
three.js (MIT), meshoptimizer (MIT). Not a medical device — not for diagnosis.
