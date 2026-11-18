import { MUSCLES, EXERCISES, RULES, videoLink } from './data.js';
import { createBody } from './body3d.js';
import * as store from './store.js';

const $ = (s) => document.querySelector(s);
let data = store.load();
let day = localStorage.getItem('gym.day') || 'A';
let date = store.todayISO();
let selected = null;           // muscle id filter
let body = null;

const planFor = (d) => EXERCISES.filter(e => e.day === d);

/* ---------- muscle heat ---------- */
function heat() {
  const out = {};
  for (const ex of planFor(day)) {
    const e = store.getEntry(store.getSession(data, date, day), ex);
    const doneSets = e.sets.filter(s => s.done).length;
    for (const [m, w] of Object.entries(ex.muscles)) {
      const o = out[m] ||= { planned: true, done: 0, total: 0 };
      o.total += ex.sets * w;
      o.done += doneSets * w;
    }
  }
  const state = {};
  for (const [m, o] of Object.entries(out)) {
    state[m] = { planned: true, ratio: o.total ? Math.min(1, o.done / o.total) : 0 };
  }
  return state;
}

/* ---------- rest timer ---------- */
let timerId = null, timerLeft = 0;
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

function paintTimer() {
  const el = $('#timer');
  const running = timerLeft > 0;
  el.textContent = running ? mmss(timerLeft) : 'rest';
  el.classList.toggle('running', running);
  $('#restbar').hidden = !running;
  document.body.classList.toggle('resting', running);
  if (running) $('#restLeft').textContent = mmss(timerLeft);
}
function stopTimer() { clearInterval(timerId); timerId = null; timerLeft = 0; paintTimer(); }
function startTimer(sec = 90) {
  clearInterval(timerId);
  timerLeft = sec;
  paintTimer();
  timerId = setInterval(() => {
    timerLeft--;
    if (timerLeft <= 0) { clearInterval(timerId); timerId = null; timerLeft = 0; paintTimer(); beep(); return; }
    paintTimer();
  }, 1000);
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.start(); o.stop(ctx.currentTime + 0.6);
  } catch {}
}

/* ---------- rendering ---------- */
function render() {
  $('#dateInput').value = date;
  for (const b of document.querySelectorAll('[data-day]'))
    b.classList.toggle('active', b.dataset.day === day);

  const session = store.getSession(data, date, day);
  const plan = planFor(day);
  const list = $('#list');
  list.innerHTML = '';
  let nextMarked = false;

  for (const ex of plan) {
    const e = store.getEntry(session, ex);
    const hitsSelected = selected ? ex.muscles[selected] : null;

    const card = document.createElement('article');
    card.className = 'card';
    if (selected) card.classList.add(hitsSelected ? 'match' : 'dim');
    const finished = e.sets.every(s => s.done);
    if (finished) card.classList.add('complete');
    if (!finished && !nextMarked) { card.classList.add('next'); card.dataset.next = '1'; nextMarked = true; }

    const name = e.variant === 'main' ? ex.main : ex.backup;
    const last = store.lastPerformance(data, ex, date);

    card.innerHTML = `
      <header>
        <div>
          <div class="target">${ex.target}${hitsSelected ? ` · ${Math.round(hitsSelected * 100)}% of the work` : ''}</div>
          <h3>${name}</h3>
          <div class="meta">${ex.sets} × ${ex.reps}
            ${last ? `<span class="last">last ${last.date}: ${last.best.w || '–'} kg × ${last.best.r || '–'}</span>` : '<span class="last">no history yet</span>'}
          </div>
        </div>
        <div class="card-actions">
          <button class="ghost swap" title="Switch to the ${e.variant === 'main' ? 'backup' : 'main'} exercise">
            ${e.variant === 'main' ? 'Use backup' : 'Use main'}
          </button>
          <a class="ghost" target="_blank" rel="noopener" href="${videoLink(name)}" title="Form videos for this machine">▶ Form</a>
        </div>
      </header>
      <div class="sets"></div>
      <details>
        <summary>Cues &amp; muscles</summary>
        <p class="do">✔ ${ex.do}</p>
        <p class="dont">✘ ${ex.dont}</p>
        <p class="mus">${Object.entries(ex.muscles).map(([m, w]) =>
          `<button class="chip${m === selected ? ' on' : ''}" data-muscle="${m}">${MUSCLES[m].name} ${Math.round(w * 100)}%</button>`).join('')}</p>
      </details>`;

    const setsEl = card.querySelector('.sets');
    e.sets.forEach((s, i) => {
      // what to suggest: the set before it, else the best set of the last session
      const prev = e.sets.slice(0, i).reverse().find(x => x.w !== '' || x.r !== '');
      const hintW = prev?.w || last?.best.w || '';
      const hintR = prev?.r || last?.best.r || String(parseInt(ex.reps, 10) || '');

      const row = document.createElement('div');
      row.className = 'set' + (s.done ? ' done' : '');
      row.innerHTML = `
        <span class="n">${i + 1}</span>
        <span class="field">
          <button class="step" data-step="-2.5" title="2.5 kg less">−</button>
          <input class="w" type="number" inputmode="decimal" step="0.5"
                 placeholder="${hintW || 'kg'}" value="${s.w}" aria-label="weight in kg">
          <button class="step" data-step="2.5" title="2.5 kg more">+</button>
        </span>
        <span class="field">
          <button class="step r" data-step="-1" title="one rep less">−</button>
          <input class="r" type="number" inputmode="numeric"
                 placeholder="${hintR || 'reps'}" value="${s.r}" aria-label="reps">
          <button class="step r" data-step="1" title="one rep more">+</button>
        </span>
        <button class="tick" title="${s.done ? 'Undo this set' : 'Tick this set off'}">✓</button>`;

      const wEl = row.querySelector('input.w'), rEl = row.querySelector('input.r');
      wEl.oninput = (ev) => { s.w = ev.target.value; persist(false); };
      rEl.oninput = (ev) => { s.r = ev.target.value; persist(false); };
      for (const b of row.querySelectorAll('.step')) {
        b.onclick = () => {
          const reps = b.classList.contains('r');
          const el = reps ? rEl : wEl;
          const base = Number(el.value || (reps ? hintR : hintW) || 0);
          const next = Math.max(0, base + Number(b.dataset.step));
          el.value = reps ? String(Math.round(next)) : String(Math.round(next * 2) / 2);
          if (reps) s.r = el.value; else s.w = el.value;
          persist(false);
        };
      }
      row.querySelector('.tick').onclick = () => {
        s.done = !s.done;
        if (s.done) {
          // one tap is enough: fill in what the placeholders were showing
          if (s.w === '') s.w = String(hintW);
          if (s.r === '') s.r = String(hintR);
          startTimer(ex.sets >= 4 ? 75 : 120);
        }
        persist();
      };
      setsEl.appendChild(row);
    });

    card.querySelector('.swap').onclick = () => {
      e.variant = e.variant === 'main' ? 'backup' : 'main';
      persist();
    };
    for (const chip of card.querySelectorAll('[data-muscle]'))
      chip.onclick = () => selectMuscle(chip.dataset.muscle === selected ? null : chip.dataset.muscle);

    list.appendChild(card);
  }

  updateStats();
  $('#selName').textContent = selected ? MUSCLES[selected].name : 'Whole body';
  $('#clearSel').hidden = !selected;

  body?.setState(heat(), selected);
  renderHistory();
}

/** Set count, progress bar and volume — cheap enough to refresh on every keystroke. */
function updateStats() {
  const session = store.getSession(data, date, day);
  let done = 0, total = 0, volume = 0;
  for (const ex of planFor(day)) {
    total += ex.sets;
    for (const s of store.getEntry(session, ex).sets)
      if (s.done) { done++; volume += (Number(s.w) || 0) * (Number(s.r) || 0); }
  }
  $('#progress').textContent = `${done}/${total} sets`;
  $('#progressBar').style.width = total ? `${(done / total) * 100}%` : '0%';
  $('#volume').textContent = `${Math.round(volume).toLocaleString()} kg lifted`;
  $('#jump').hidden = done >= total;
}

function renderHistory() {
  const dates = Object.keys(data.sessions).sort().reverse();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toLocaleDateString('sv-SE');

  // sets per muscle, last 7 days
  const perMuscle = {};
  for (const d of dates.filter(d => d >= weekAgo)) {
    const s = data.sessions[d];
    for (const ex of EXERCISES) {
      const n = s.entries?.[ex.id]?.sets?.filter(x => x.done).length || 0;
      if (!n) continue;
      for (const [m, w] of Object.entries(ex.muscles)) perMuscle[m] = (perMuscle[m] || 0) + n * w;
    }
  }
  const max = Math.max(1, ...Object.values(perMuscle));
  $('#weekly').innerHTML = Object.entries(MUSCLES).map(([m, info]) => {
    const v = perMuscle[m] || 0;
    const low = v < 6;
    return `<div class="bar-row"><span>${info.name}</span>
      <div class="bar"><i style="width:${(v / max) * 100}%"></i></div>
      <b class="${low ? 'low' : ''}">${v.toFixed(1)}</b></div>`;
  }).join('') + `<p class="hint">Effective sets per muscle over the last 7 days. 10–20 is a good weekly range; numbers under 6 are marked.</p>`;

  $('#sessions').innerHTML = dates.slice(0, 12).map(d => {
    const s = data.sessions[d];
    let n = 0, vol = 0;
    for (const e of Object.values(s.entries || {}))
      for (const st of e.sets || []) if (st.done) { n++; vol += (Number(st.w) || 0) * (Number(st.r) || 0); }
    return `<li><button data-goto="${d}" data-day="${s.day}">${d}</button>
      <span>Day ${s.day} · ${n} sets · ${Math.round(vol).toLocaleString()} kg</span></li>`;
  }).join('') || '<li class="hint">No sessions logged yet.</li>';

  for (const b of $('#sessions').querySelectorAll('[data-goto]'))
    b.onclick = () => { date = b.dataset.goto; day = data.sessions[date].day; render(); };
}

function selectMuscle(m) {
  selected = m;
  render();
  // on a phone the plan is behind a tab: picking a muscle should show it
  if (m && window.matchMedia('(max-width:900px)').matches) setTab('plan');
}

function setTab(which) {
  document.body.classList.toggle('tab-plan', which === 'plan');
  document.body.classList.toggle('tab-body', which === 'body');
  for (const b of document.querySelectorAll('[data-tab]'))
    b.classList.toggle('active', b.dataset.tab === which);
}

/** Scroll to the first set still to do, and put the cursor in its weight box. */
function jumpToNext() {
  const card = $('#list [data-next]');
  if (!card) return;
  setTab('plan');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.querySelector('.set:not(.done) input.w')?.focus({ preventScroll: true });
}
function persist(full = true) {
  store.save(data);
  if (full) render();
  else { updateStats(); body?.setState(heat(), selected); }
}

/* ---------- wiring ---------- */
function init() {
  $('#rules').innerHTML = RULES.map(r => `<li>${r}</li>`).join('');
  body = createBody($('#canvasWrap'), selectMuscle);

  for (const b of document.querySelectorAll('[data-day]'))
    b.onclick = () => { day = b.dataset.day; localStorage.setItem('gym.day', day); render(); };
  for (const b of document.querySelectorAll('[data-view]'))
    b.onclick = () => {
      body.view(b.dataset.view);
      if (b.dataset.frame)
        for (const o of document.querySelectorAll('[data-frame]'))
          o.classList.toggle('active', o === b);
    };
  for (const b of document.querySelectorAll('[data-tab]'))
    b.onclick = () => setTab(b.dataset.tab);
  setTab('body');

  $('#jump').onclick = jumpToNext;
  $('#restPlus').onclick = () => startTimer(timerLeft + 30);
  $('#restSkip').onclick = stopTimer;

  $('#dateInput').onchange = (e) => { date = e.target.value || store.todayISO(); render(); };
  $('#clearSel').onclick = () => selectMuscle(null);
  $('#timer').onclick = () => (timerLeft > 0 ? stopTimer() : startTimer(90));

  $('#resetDay').onclick = () => {
    if (!confirm(`Clear all logged sets for ${date}?`)) return;
    delete data.sessions[date];
    persist();
  };
  $('#export').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `gym-log-${store.todayISO()}.json`;
    a.click();
  };
  $('#import').onchange = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d.sessions) throw new Error('not a gym log');
      data = d; persist();
    } catch (err) { alert('Could not read that file: ' + err.message); }
    e.target.value = '';
  };

  // suggest the day you did not do last time
  const prev = Object.keys(data.sessions).sort().reverse().find(d => d < store.todayISO());
  if (prev && !data.sessions[store.todayISO()]) {
    day = data.sessions[prev].day === 'A' ? 'B' : 'A';
    localStorage.setItem('gym.day', day);
  }

  render();
}
init();
