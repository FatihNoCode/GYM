// Muscle groups shown on the 3D model. `side` controls which view they live on.
export const MUSCLES = {
  chest_upper:  { name: 'Upper chest (clavicular pec)', side: 'front' },
  chest_mid:    { name: 'Mid chest (sternal pec)',      side: 'front' },
  chest_lower:  { name: 'Lower chest',                  side: 'front' },
  delt_front:   { name: 'Front delts',                  side: 'front' },
  delt_side:    { name: 'Side delts',                   side: 'front' },
  delt_rear:    { name: 'Rear delts',                   side: 'back'  },
  triceps:      { name: 'Triceps',                      side: 'back'  },
  biceps:       { name: 'Biceps',                       side: 'front' },
  brachialis:   { name: 'Brachialis / outer forearm',   side: 'front' },
  forearm_flex: { name: 'Forearm flexors (inner)',      side: 'front' },
  forearm_ext:  { name: 'Forearm extensors (back)',     side: 'back'  },
  lats:         { name: 'Lats',                         side: 'back'  },
  back_mid:     { name: 'Mid / upper back (rhomboids)', side: 'back'  },
  traps:        { name: 'Traps',                        side: 'back'  },
};

// weight = share of the work this exercise gives the muscle (1 = prime mover)
export const EXERCISES = [
  // ---------------- DAY A ----------------
  { id: 'a1', day: 'A', target: 'Upper chest',
    main: 'Incline chest press machine', backup: 'Low-to-high cable fly',
    sets: 3, reps: '6–10',
    do: 'Keep your shoulder blades pinned back.',
    dont: "Don't let your shoulders roll forward at the top.",
    muscles: { chest_upper: 1, delt_front: 0.5, triceps: 0.4 } },

  { id: 'a2', day: 'A', target: 'Mid chest',
    main: 'Seated chest press machine', backup: 'Standing cable chest press',
    sets: 3, reps: '8–12',
    do: 'Set the handles at mid-chest height.',
    dont: "Don't lock your elbows hard at the end.",
    muscles: { chest_mid: 1, chest_upper: 0.3, delt_front: 0.4, triceps: 0.5 } },

  { id: 'a3', day: 'A', target: 'Lower chest + triceps',
    main: 'Dips (assisted dip machine)', backup: 'High-to-low cable fly',
    sets: 3, reps: '6–12',
    do: 'Lean slightly forward, go down until your upper arm is parallel to the floor.',
    dont: "Don't drop deeper if your shoulders hurt.",
    muscles: { chest_lower: 1, chest_mid: 0.5, triceps: 0.8, delt_front: 0.3 } },

  { id: 'a4', day: 'A', target: 'Chest (stretch)',
    main: 'Pec fly machine', backup: 'Cable crossover',
    sets: 3, reps: '10–15',
    do: 'Keep a slight bend in your elbows and control the stretch.',
    dont: "Don't let the stack bounce at the back.",
    muscles: { chest_mid: 1, chest_upper: 0.4, chest_lower: 0.4, delt_front: 0.2 } },

  { id: 'a5', day: 'A', target: 'Front delts',
    main: 'Shoulder press machine', backup: 'Cable front raise',
    sets: 3, reps: '8–12',
    do: 'Keep your back flat against the pad.',
    dont: "Don't arch your lower back to push the weight.",
    muscles: { delt_front: 1, delt_side: 0.5, triceps: 0.5, traps: 0.3 } },

  { id: 'a6', day: 'A', target: 'Side delts',
    main: 'Lateral raise machine', backup: 'Single-arm cable lateral raise',
    sets: 4, reps: '12–20',
    do: 'Lead with your elbows and stop at shoulder height.',
    dont: "Don't shrug or swing.",
    muscles: { delt_side: 1, traps: 0.2 } },

  { id: 'a7', day: 'A', target: 'Triceps long head',
    main: 'Overhead cable extension (rope)', backup: 'Dumbbell overhead extension',
    sets: 3, reps: '10–15',
    do: 'Get a deep stretch behind your head.',
    dont: "Don't let your elbows flare wide.",
    muscles: { triceps: 1 } },

  { id: 'a8', day: 'A', target: 'Triceps lateral + medial head',
    main: 'Cable pushdown (rope or bar)', backup: 'Triceps extension machine',
    sets: 3, reps: '10–15',
    do: 'Keep your elbows pinned to your sides.',
    dont: "Don't lean over the weight.",
    muscles: { triceps: 1 } },

  // ---------------- DAY B ----------------
  { id: 'b1', day: 'B', target: 'Lats + biceps',
    main: 'Chin-ups, underhand grip (assisted machine)', backup: 'Underhand lat pulldown',
    sets: 3, reps: '6–10',
    do: 'Start from a full hang and pull your chest towards the bar.',
    dont: "Don't kick or do half reps.",
    muscles: { lats: 1, biceps: 0.7, back_mid: 0.5, brachialis: 0.3 } },

  { id: 'b2', day: 'B', target: 'Lats (width)',
    main: 'Lat pulldown, wide grip', backup: 'Single-arm kneeling cable pulldown',
    sets: 3, reps: '8–12',
    do: 'Pull your elbows down towards your hips.',
    dont: "Don't lean far back or pull behind your neck.",
    muscles: { lats: 1, back_mid: 0.4, biceps: 0.4 } },

  { id: 'b3', day: 'B', target: 'Mid and upper back',
    main: 'Seated row machine with chest pad', backup: 'Seated cable row',
    sets: 3, reps: '8–12',
    do: 'Keep your chest on the pad and squeeze your shoulder blades.',
    dont: "Don't yank with your arms.",
    muscles: { back_mid: 1, lats: 0.6, delt_rear: 0.5, biceps: 0.4, traps: 0.4 } },

  { id: 'b4', day: 'B', target: 'Rear delts + upper back',
    main: 'Rear delt fly (reverse pec deck)', backup: 'Cable face pull',
    sets: 3, reps: '12–15',
    do: 'Sweep your arms out wide and light.',
    dont: "Don't squeeze your shoulder blades together — that turns it into a back exercise.",
    muscles: { delt_rear: 1, back_mid: 0.3 } },

  { id: 'b5', day: 'B', target: 'Traps',
    main: 'Smith machine shrug', backup: 'Cable shrug',
    sets: 3, reps: '10–15',
    do: 'Lift straight up and pause for 1 second.',
    dont: "Don't roll your shoulders.",
    muscles: { traps: 1 } },

  { id: 'b6', day: 'B', target: 'Biceps long head',
    main: 'Cable curl facing away from the low pulley', backup: 'Incline dumbbell curl',
    sets: 3, reps: '10–15',
    do: 'Let your arm hang behind your body for the stretch.',
    dont: "Don't let your elbow drift forward.",
    muscles: { biceps: 1, brachialis: 0.3 } },

  { id: 'b7', day: 'B', target: 'Biceps short head + brachialis',
    main: 'Biceps curl machine (preacher)', backup: 'Cable preacher curl',
    sets: 3, reps: '10–15',
    do: 'Lower slowly to almost straight.',
    dont: "Don't lift your elbows off the pad.",
    muscles: { biceps: 1, brachialis: 0.5 } },

  { id: 'b8', day: 'B', target: 'Forearm (outer) + brachialis',
    main: 'Cable hammer curl (rope)', backup: 'Dumbbell hammer curl',
    sets: 2, reps: '10–15',
    do: 'Keep your thumbs pointing up.',
    dont: "Don't swing your body.",
    muscles: { brachialis: 1, biceps: 0.5, forearm_ext: 0.3 } },

  { id: 'b9', day: 'B', target: 'Forearm (inner side)',
    main: 'Cable wrist curl', backup: 'Dumbbell wrist curl',
    sets: 2, reps: '12–20',
    do: 'Rest your forearms on your thighs and use the full range.',
    dont: "Don't go heavy and jerky.",
    muscles: { forearm_flex: 1 } },

  { id: 'b10', day: 'B', target: 'Forearm (back side)',
    main: 'Cable reverse wrist curl', backup: 'Dumbbell reverse wrist curl',
    sets: 2, reps: '12–20',
    do: 'Go light and slow.',
    dont: "Don't let your wrists drop fast — that strains the tendons.",
    muscles: { forearm_ext: 1 } },
];

export const RULES = [
  'Every exercise: take about 2–3 seconds to lower the weight.',
  'Warm-up: 1–2 light sets on your first chest and your first back exercise before the working sets.',
  'Beat last session by a rep or a small weight jump on the main lifts — that is what drives growth.',
];

// Form reference: a YouTube search link always resolves, unlike a hard-coded video id.
export const videoLink = (name) =>
  'https://www.youtube.com/results?search_query=' + encodeURIComponent(name + ' proper form technique');
