// „-background“ у називу значи да ради до 15 минута (одмах враћа 202).
import { getStore } from '@netlify/blobs';
import { authOk } from '../lib/http.mjs';
import { makeS } from '../lib/gemini.mjs';
import { runAuto } from '../lib/auto.mjs';
import { updateState, mergeInto } from '../lib/store.mjs';

export default async (req) => {
  if (!authOk(req, Netlify.env.get('ACCESS_TOKEN'))) return new Response('Забрањено', { status: 401 });
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const store = getStore({ name: 'radni-sto', consistency: 'strong' });
  const S = makeS({ key: Netlify.env.get('GEMINI_API_KEY'), model: Netlify.env.get('GEMINI_MODEL') || 'gemini-3.8-flash' });
  try {
    await runAuto({ store, S, what: body.what || 'sve' });
  } catch (e) {
    const log = { id: 'L' + Date.now().toString(36), created: Date.now(), upd: Date.now(), datum: S.today(), trajanje: 0, stavke: [], greske: ['Грешка: ' + (e && e.message ? e.message : e)] };
    try { await updateState(store, mergeInto({ data: { auto_log: [log] }, tomb: {} })); } catch (e2) {}
  }
};
