// Спајање стања клијента и сервера. Једина истина је „upd“ (време последње измене ставке).
export const ARRAY_KEYS = ['bg_arhiva', 'ach_arhiva', 'iw_data', 'narr_arhiva', 'pm_arhiva', 'auto_log'];
export const OBJ_KEYS = ['bg_tpl', 'bg_settings', 'auto_cfg'];
const TOMB_TTL = 90 * 24 * 3600 * 1000;

const stamp = (x) => (x && (x.upd || x.created || 0)) || 0;

function unionBy(a, b, keyFn) {
  const m = new Map();
  (a || []).concat(b || []).forEach((x) => { const k = keyFn(x); if (!m.has(k)) m.set(k, x); });
  return Array.from(m.values());
}

// I&W сценарији се спајају паметније: историје индикатора и скенирања се здружују.
function mergeScenario(a, b) {
  const base = stamp(a) >= stamp(b) ? a : b;
  const other = base === a ? b : a;
  const out = JSON.parse(JSON.stringify(base));
  out.skeniranja = unionBy(base.skeniranja, other.skeniranja, (x) => x.ts).sort((x, y) => x.ts - y.ts);
  const otherInd = {};
  (other.indikatori || []).forEach((i) => { otherInd[i.id] = i; });
  (out.indikatori || []).forEach((i) => {
    const o = otherInd[i.id];
    if (o) i.istorija = unionBy(i.istorija, o.istorija, (x) => x.ts + ':' + x.status + ':' + (x.rucno ? 'r' : '')).sort((x, y) => x.ts - y.ts);
  });
  out.upd = Math.max(stamp(a), stamp(b));
  return out;
}

function mergeArray(key, a, b, tomb) {
  const m = new Map();
  (a || []).concat(b || []).forEach((it) => {
    if (!it || !it.id) return;
    const cur = m.get(it.id);
    if (!cur) m.set(it.id, it);
    else if (key === 'iw_data') m.set(it.id, mergeScenario(cur, it));
    else if (stamp(it) > stamp(cur)) m.set(it.id, it);
  });
  const out = [];
  m.forEach((it, id) => {
    const t = tomb && tomb[id];
    if (t && t >= stamp(it)) return; // обрисано касније од последње измене
    out.push(it);
  });
  return out;
}

export function mergeTombs(a, b) {
  const out = {};
  const now = Date.now();
  [a || {}, b || {}].forEach((t) => {
    Object.keys(t).forEach((k) => {
      out[k] = out[k] || {};
      Object.keys(t[k] || {}).forEach((id) => {
        if (now - t[k][id] > TOMB_TTL) return;
        out[k][id] = Math.max(out[k][id] || 0, t[k][id]);
      });
    });
  });
  return out;
}

// стање: { data:{кључ: низ|објекат}, tomb:{кључ:{id:ts}} }
export function mergeState(server, client) {
  const s = server || { data: {}, tomb: {} }, c = client || { data: {}, tomb: {} };
  const tomb = mergeTombs(s.tomb, c.tomb);
  const data = {};
  ARRAY_KEYS.forEach((k) => {
    if (s.data[k] === undefined && c.data[k] === undefined) return;
    data[k] = mergeArray(k, s.data[k], c.data[k], tomb[k]);
  });
  OBJ_KEYS.forEach((k) => {
    const a = s.data[k], b = c.data[k];
    if (a === undefined && b === undefined) return;
    if (a === undefined || a === null) data[k] = b;
    else if (b === undefined || b === null) data[k] = a;
    else data[k] = (b._upd || 0) > (a._upd || 0) ? b : a;
  });
  return { data, tomb };
}
