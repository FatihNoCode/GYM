const KEY = 'gym.tracker.v1';

const blank = () => ({ version: 1, sessions: {} });

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const d = JSON.parse(raw);
    return d && d.sessions ? d : blank();
  } catch { return blank(); }
}

export function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.warn('save failed', e); }
}

export const todayISO = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD, local time

export function getSession(data, date, day) {
  let s = data.sessions[date];
  if (!s) s = data.sessions[date] = { day, entries: {} };
  if (s.day !== day) { s.day = day; }
  return s;
}

export function getEntry(session, ex) {
  let e = session.entries[ex.id];
  if (!e) {
    e = session.entries[ex.id] = { variant: 'main', sets: [] };
  }
  while (e.sets.length < ex.sets) e.sets.push({ w: '', r: '', done: false });
  return e;
}

/** Most recent earlier session that has logged work for this exercise. */
export function lastPerformance(data, ex, beforeDate) {
  const dates = Object.keys(data.sessions).filter(d => d < beforeDate).sort().reverse();
  for (const d of dates) {
    const e = data.sessions[d].entries?.[ex.id];
    const done = e?.sets?.filter(s => s.done && (s.w !== '' || s.r !== ''));
    if (done?.length) {
      const best = done.reduce((a, b) => (Number(b.w) || 0) > (Number(a.w) || 0) ? b : a);
      return { date: d, best, sets: done.length };
    }
  }
  return null;
}
