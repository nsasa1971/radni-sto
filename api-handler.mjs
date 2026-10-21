import { authOk, json } from './http.mjs';
import { loadState, updateState, mergeInto } from './store.mjs';
import { ARRAY_KEYS, OBJ_KEYS } from './merge.mjs';

export async function handle(req, { store, env, fetchImpl = fetch }) {
  const token = env('ACCESS_TOKEN');
  if (!token || token.length < 16) return json({ error: 'На серверу није постављен ACCESS_TOKEN (бар 16 знакова).', kod: 'bez_tokena' }, 503);
  if (!authOk(req, token)) return json({ error: 'Погрешан приступни токен.', kod: 'token' }, 401);

  const path = new URL(req.url).pathname;

  if (path === '/api/status' && req.method === 'GET') {
    const st = await loadState(store);
    const logs = (st.data.auto_log || []).slice(-6).reverse();
    const auto = (st.data.iw_data || []).filter((s) => s.auto).length;
    return json({
      ok: true,
      gemini: !!env('GEMINI_API_KEY'),
      model: env('GEMINI_MODEL') || 'gemini-3.8-flash',
      auto_scenarija: auto,
      log: logs,
      vreme: new Date().toISOString(),
    });
  }

  if (path === '/api/sync' && req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch (e) { return json({ error: 'Неисправан захтев.' }, 400); }
    const incoming = { data: {}, tomb: body.tomb || {} };
    ARRAY_KEYS.concat(OBJ_KEYS).forEach((k) => { if (body.data && body.data[k] !== undefined) incoming.data[k] = body.data[k]; });
    const merged = await updateState(store, mergeInto(incoming));
    return json({ ok: true, data: merged.data, tomb: merged.tomb });
  }

  if (path === '/api/run' && req.method === 'POST') {
    let body = {};
    try { body = await req.json(); } catch (e) {}
    const what = ['sve', 'iw', 'brifing'].indexOf(body.what) > -1 ? body.what : 'sve';
    const origin = new URL(req.url).origin;
    const r = await fetchImpl(origin + '/.netlify/functions/auto-run-background', {
      method: 'POST', headers: { 'x-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ what }),
    });
    return json({ ok: r.status === 202 || r.ok, pokrenuto: what, status: r.status }, r.status === 202 || r.ok ? 202 : 502);
  }

  return json({ error: 'Непозната путања.' }, 404);
}
