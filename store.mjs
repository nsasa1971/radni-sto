// Чување стања у Netlify Blobs (један запис „state“), са поновним покушајем при истовременој измени.
import { mergeState } from './merge.mjs';
const KEY = 'state';
const EMPTY = () => ({ data: {}, tomb: {} });

export async function loadState(store) {
  const v = await store.get(KEY, { type: 'json' });
  return v && v.data ? v : EMPTY();
}

// mutator(stanje) → ново стање. Враћа сачувано стање.
export async function updateState(store, mutator) {
  for (let i = 0; i < 5; i++) {
    const cur = await store.getWithMetadata(KEY, { type: 'json' });
    const base = cur && cur.data && cur.data.data ? cur.data : EMPTY();
    const next = mutator(base);
    const opts = cur && cur.etag ? { onlyIfMatch: cur.etag } : { onlyIfNew: true };
    const r = await store.setJSON(KEY, next, opts);
    if (r && r.modified === false) { await new Promise((res) => setTimeout(res, 150 * (i + 1))); continue; }
    return next;
  }
  throw new Error('Стање је истовремено мењано, покушајте поново.');
}

export const mergeInto = (incoming) => (base) => mergeState(base, incoming);
