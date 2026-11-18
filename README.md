# Upper Body Lab

A single-page planner / tracker / 3D muscle map for a two-day upper-body split (Day A push, Day B pull).
No build step, no server-side anything: plain HTML + ES modules + a vendored copy of three.js.
Your log is stored in the browser (localStorage) and the app works offline once loaded.

The 3D figure is a real anatomical model — BodyParts3D cadaver-derived muscle meshes, not
hand-made shapes — split per trained muscle group by `tools/build-anatomy.mjs`.

## Run it

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (ES modules need `http://`, opening the file directly will not work.)

On a phone: open that URL on the same wifi, or host the folder on GitHub Pages / Netlify and
use "Add to home screen" — it is a PWA and caches itself for offline use at the gym.

## What it does

- **3D muscle map** — a real anatomy model (pecs split into upper/mid/lower, deltoid into
  front/side/rear, biceps / triceps / brachialis, forearm flexors and extensors, lats, rhomboids,
  traps). Drag to rotate, scroll to zoom, front/back/left/right buttons.
  Muscles in today's plan light up; they warm from blue → amber → red as you tick sets off,
  so you can see at a glance what is still untouched. Click a muscle to filter the exercise list.
- **Day A / Day B plans** — exactly the split in `js/data.js`, with sets × reps, the do/don't cue
  for each lift, and a one-tap swap to the backup exercise when a machine is occupied.
- **Set ticking + logging** — weight and reps per set, running set count and total volume,
  and the previous session's best set shown on each card so you know what to beat.
- **Rest timer** — starts automatically when you tick a set (75 s on high-rep work, 120 s on heavy),
  beeps when done. Tap the timer for a manual 90 s.
- **Weekly volume per muscle** — effective sets over the last 7 days, weighted by how much each
  exercise actually contributes to that muscle. Anything under 6 sets a week is flagged.
- **Form videos** — each exercise links to a YouTube search for that exact machine and lift.
- **Export / import** — JSON backup of your whole log.

## Files

| File | Purpose |
|---|---|
| `index.html` | Layout |
| `styles.css` | Styling |
| `js/data.js` | The training plan: exercises, cues, muscle contributions. **Edit this to change the program.** |
| `js/body3d.js` | three.js muscle model and highlighting |
| `js/store.js` | localStorage log + history lookups |
| `js/app.js` | UI wiring |
| `sw.js`, `manifest.webmanifest` | Offline / installable support |
| `models/anatomy-upper.glb` | The anatomy model: 28 named muscle meshes + a context body |
| `tools/build-anatomy.mjs` | Rebuilds that model from `open-anatomy-3d` (`npm run build:anatomy`) |
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

`tools/build-anatomy.mjs` loads the BodyParts3D male model from `open-anatomy-3d`, cuts each
anatomical group into the muscles this program trains (a triangle-level split on world-space
landmarks — e.g. the pectoralis is cut at chest heights 1.352 m and 1.268 m, the deltoid by
depth), decimates everything else into a single context mesh with meshoptimizer, and writes
`models/anatomy-upper.glb` (~8 MB). Adjust the `SPLIT` rules at the top of that file to change
where the cuts fall.

## Credits

Anatomy: BodyParts3D © The Database Center for Life Science (CC BY 4.0), via
[open-anatomy-3d](https://github.com/MervinR07/open-anatomy-3d) (CC BY 4.0).
three.js (MIT), meshoptimizer (MIT). Not a medical device — not for diagnosis.
