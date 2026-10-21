// Gemini позиви на серверу. Исто понашање као у апликацији (два покушаја, 429/503 чекање).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function belgradeDate(d = new Date()) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Belgrade' }); // YYYY-MM-DD
}

export function makeS({ key, model }) {
  const S = {
    sleep,
    uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    today: () => belgradeDate(),
    r2: (x) => Math.round(x * 100) / 100,
    uniqGrounding(list) {
      const seen = {}, out = [];
      (list || []).forEach((g) => { if (!seen[g.title]) { seen[g.title] = 1; out.push(g); } });
      return out;
    },
    parseJson(text) {
      const t = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
      const a = t.search(/[\[{]/);
      const b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
      if (a < 0 || b < a) throw new Error('JSON није пронађен.');
      return JSON.parse(t.slice(a, b + 1));
    },
    async pool(items, limit, fn) {
      let i = 0;
      const workers = [];
      for (let k = 0; k < limit; k++) {
        workers.push((async () => {
          while (true) { const idx = i++; if (idx >= items.length) return; await fn(items[idx], idx); }
        })());
      }
      await Promise.all(workers);
    },
    async callGemini(sys, user, opts = {}) {
      if (!key) throw new Error('На серверу није постављен GEMINI_API_KEY.');
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
      const body = {
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: opts.temp == null ? 0.3 : opts.temp },
      };
      if (sys) body.systemInstruction = { parts: [{ text: sys }] };
      if (opts.json) body.generationConfig.responseMimeType = 'application/json';
      if (opts.search) body.tools = [{ google_search: {} }];
      let lastErr = 'Непозната грешка.';
      for (let attempt = 0; attempt < 3; attempt++) {
        let r;
        try {
          r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
        } catch (e) { lastErr = 'Нема везе са сервисом.'; await sleep(1500 * (attempt + 1)); continue; }
        let j = null; try { j = await r.json(); } catch (e) {}
        if (r.status === 429 || r.status === 503) { lastErr = 'Сервис је преоптерећен (' + r.status + ').'; await sleep(3000 * (attempt + 1)); continue; }
        if (!r.ok) throw new Error(j && j.error && j.error.message ? j.error.message : 'HTTP ' + r.status);
        const c = j && j.candidates && j.candidates[0];
        const txt = c && c.content && c.content.parts ? c.content.parts.map((p) => p.text || '').join('') : '';
        const gr = [];
        try {
          const ch = c && c.groundingMetadata && c.groundingMetadata.groundingChunks;
          if (ch) ch.forEach((x) => { if (x.web && x.web.uri) gr.push({ title: x.web.title || x.web.uri, uri: x.web.uri }); });
        } catch (e) {}
        if (txt.trim()) return { text: txt, grounding: gr };
        if (j && j.promptFeedback && j.promptFeedback.blockReason) throw new Error('Захтев је блокиран (' + j.promptFeedback.blockReason + ').');
        lastErr = 'Модел је вратио празан одговор.';
        await sleep(1500);
      }
      throw new Error(lastErr);
    },
  };
  return S;
}
