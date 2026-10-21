// Аутоматско освежавање: I&W скенирање + брифинзи (дневни, недељни, месечни).
import { makeIW } from './iw-port.mjs';
import { makeBrief } from './brief-port.mjs';
import { belgradeDate } from './gemini.mjs';
import { loadState, updateState, mergeInto } from './store.mjs';

const DEFAULT_CFG = { iw: true, dnevni: true, nedeljni: true, mesecni: true, pretraga: true, dani: 14 };
const DAY = 24 * 3600 * 1000;

function stripHtml(h) {
  return String(h || '').replace(/<\/(p|h\d|li|div|tr)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n').trim();
}
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
function weekdayOf(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay(); } // 1 = понедељак

export async function scanScenario(IW, S, sc, days) {
  const results = []; let errs = 0, firstErr = '';
  await S.pool(sc.indikatori, 3, async (ind) => {
    let res;
    try { res = await IW.scanInd(sc, ind); }
    catch (e) {
      errs++; firstErr = firstErr || e.message;
      res = { status: 'nema', dokaz: 'Скенирање није успело: ' + e.message, vest: '', pouz: '', izvori: [], greska: true };
    }
    results.push({ ind, res });
  });
  if (errs === results.length) throw new Error('Скенирање није успело: ' + firstErr);
  const prev = {};
  sc.indikatori.forEach((i) => { const l = IW.latest(i); prev[i.id] = l ? l.status : null; });
  const hadPrev = (sc.skeniranja || []).length > 0;
  const nowTs = Date.now();
  results.forEach((r) => {
    r.ind.istorija = r.ind.istorija || [];
    r.ind.istorija.push({ datum: S.today(), ts: nowTs, status: r.res.status, dokaz: r.res.dokaz, vest: r.res.vest, pouz: r.res.pouz, izvori: r.res.izvori || [], rucno: false, greska: !!r.res.greska, auto: true });
  });
  const T = IW.temperature(sc);
  const promene = [];
  if (hadPrev) sc.indikatori.forEach((i) => { const l = IW.latest(i); if (prev[i.id] && l && prev[i.id] !== l.status) promene.push({ ind: i.naziv, od: prev[i.id], nova: l.status }); });
  const rec = { datum: S.today(), ts: nowTs, avg: T.avg, label: T.label, coverage: T.coverage, promene, prvo: !hadPrev, sazetak: '', auto: true };
  sc.skeniranja = sc.skeniranja || [];
  sc.skeniranja.push(rec);
  try { rec.sazetak = await IW.summarizeScan(sc, T, promene, hadPrev); } catch (e) {}
  sc.upd = Date.now();
  return { T, greske: errs };
}

function summarizeIw(IW, sc) {
  const T = IW.temperature(sc);
  let t = 'I&W СЦЕНАРИО: ' + sc.naziv + '\n' + (sc.opis ? sc.opis + '\n' : '');
  t += 'Тренутна температура: ' + T.labelCyr + ' (покривеност података ' + Math.round(T.coverage * 100) + '%)\n';
  (sc.indikatori || []).forEach((i) => {
    const l = IW.latest(i);
    t += '- ' + i.naziv + ': ' + (l ? IW.LAB[l.status] + (l.dokaz ? ' (' + l.dokaz + ')' : '') : 'нема провере') + '\n';
  });
  const last = sc.skeniranja && sc.skeniranja.length ? sc.skeniranja[sc.skeniranja.length - 1] : null;
  if (last && last.sazetak) t += 'Резиме последње промене: ' + last.sazetak + '\n';
  return t;
}
function summarizeOther(key, e) {
  if (key === 'ach') return 'ACH АНАЛИЗА\nПитање: ' + e.pitanje + '\nОбразложење:\n' + stripHtml(e.narativHtml);
  if (key === 'pm') {
    const top = (e.uzroci || []).slice().sort((a, b) => b.rizik - a.rizik).slice(0, 6);
    return 'PRE-MORTEM АНАЛИЗА\nПлан: ' + e.plan + '\nНајозбиљнији ризици:\n' + top.map((u) => '- ' + u.naziv + ' (ризик ' + u.rizik + ')').join('\n') + '\nОбразложење:\n' + stripHtml(e.narativHtml);
  }
  if (key === 'narr') {
    let t = 'ПРАЋЕЊЕ НАРАТИВА\nТема: ' + e.tema + '\n';
    (e.narativi || []).forEach((x) => { t += '- ' + x.naziv + ': ' + x.opis + '\n'; });
    return t + 'Образложење:\n' + stripHtml(e.narativHtml);
  }
  return '';
}

export async function makeOneBrief({ B, S, IW, state, cfg, tip, date }) {
  const data = state.data;
  const tpl = Object.assign({}, B.DEFAULT_TPL[tip], (data.bg_tpl || {})[tip] || {});
  const span = tip === 'dnevni' ? 1 : (tip === 'nedeljni' ? 7 : 30);
  const od = addDays(date, -span), do_ = date;
  const secs = B.parseSections(tpl.sections);
  const implik = !!tpl.implik;
  const sections = implik ? secs : secs.filter((s) => !/импликациј|сценариј/i.test(s.name));
  const alati = [];
  (data.iw_data || []).filter((s) => s.auto && (s.indikatori || []).length).forEach((s) => alati.push({ label: 'I&W: ' + s.naziv, text: summarizeIw(IW, s) }));
  const fromTs = Date.parse(od + 'T00:00:00Z') - DAY;
  [['ach', 'ach_arhiva', 'ACH'], ['pm', 'pm_arhiva', 'Pre-mortem'], ['narr', 'narr_arhiva', 'Наративи']].forEach(([k, arrKey, tag]) => {
    (data[arrKey] || []).filter((e) => (e.created || 0) >= fromTs).slice(-4).forEach((e) => alati.push({ label: tag + ': ' + (e.pitanje || e.plan || e.tema || ''), text: summarizeOther(k, e) }));
  });
  const lower = tip === 'nedeljni' ? ['dnevni'] : (tip === 'mesecni' ? ['dnevni', 'nedeljni'] : []);
  const prethodni = (data.bg_arhiva || []).filter((a) => lower.indexOf(a.tip) > -1 && (a.created || 0) >= fromTs)
    .sort((a, b) => (a.created || 0) - (b.created || 0)).slice(-8).map((a) => ({ tipNaziv: a.tipNaziv, naslov: a.naslov, text: a.text }));
  const ctx = { tipNaziv: tpl.naziv, naslov: '', od, do: do_, fokus: '', duzina: tpl.duzina || 'standardno', sections, implik, rucno: '', prethodni, sources: [], alati };
  if (!alati.length && !prethodni.length && !cfg.pretraga) return null;
  const r = await S.callGemini(B.SYSTEM, B.buildUser(ctx), { search: !!cfg.pretraga, temp: 0.35 });
  const st = data.bg_settings || {};
  const srcs = S.uniqGrounding(r.grounding).slice(0, 12).map((g) => ({ name: g.title, url: '' }));
  const meta = { tip, tipNaziv: tpl.naziv, naslov: '', od, do: do_, datum: date, broj: '', org: st.org || '', kls: st.kls || 'Само за интерну употребу', autor: st.autor || 'Аутоматски' };
  const html = B.buildDocHtml(meta, r.text, srcs, true);
  const now = Date.now();
  return { id: S.uid(), tip, tipNaziv: tpl.naziv, naslov: 'Аутоматски', datum: date, od, do: do_, html, text: stripHtml(html), created: now, upd: now, auto: true };
}

// what: 'sve' | 'iw' | 'brifing'
export async function runAuto({ store, S, what = 'sve', now = new Date() }) {
  const date = belgradeDate(now);
  const log = { id: 'L' + Date.now().toString(36), created: Date.now(), upd: Date.now(), datum: date, trajanje: 0, stavke: [], greske: [] };
  const t0 = Date.now();
  const state = await loadState(store);
  const cfg = Object.assign({}, DEFAULT_CFG, state.data.auto_cfg || {});
  const IW = makeIW(S, cfg.dani || 14);
  const B = makeBrief();
  const outScenarios = [], outBriefs = [];

  if ((what === 'sve' || what === 'iw') && cfg.iw !== false) {
    for (const sc of (state.data.iw_data || [])) {
      if (!sc.auto) continue;
      if (!sc.zakljucano) { log.stavke.push('I&W „' + sc.naziv + '“ прескочен: прагови нису закључани.'); continue; }
      if (!(sc.indikatori || []).length) continue;
      const copy = JSON.parse(JSON.stringify(sc));
      try {
        const r = await scanScenario(IW, S, copy, cfg.dani || 14);
        outScenarios.push(copy);
        log.stavke.push('I&W „' + sc.naziv + '“: ' + r.T.labelCyr + (r.greske ? ' (' + r.greske + ' индикатора није успело)' : ''));
      } catch (e) { log.greske.push('I&W „' + sc.naziv + '“: ' + e.message); }
    }
  }

  if (what === 'sve' || what === 'brifing') {
    const merged = { data: Object.assign({}, state.data, { iw_data: (state.data.iw_data || []).map((s) => outScenarios.find((o) => o.id === s.id) || s) }), tomb: {} };
    const tipovi = [];
    if (cfg.dnevni) tipovi.push('dnevni');
    if (cfg.nedeljni && weekdayOf(date) === 1) tipovi.push('nedeljni');
    if (cfg.mesecni && date.slice(8, 10) === '01') tipovi.push('mesecni');
    for (const tip of tipovi) {
      const postoji = (state.data.bg_arhiva || []).some((a) => a.auto && a.tip === tip && a.datum === date);
      if (postoji && what === 'sve') { log.stavke.push('Брифинг (' + tip + ') за ' + date + ' већ постоји, прескочен.'); continue; }
      try {
        const e = await makeOneBrief({ B, S, IW, state: merged, cfg, tip, date });
        if (e) { outBriefs.push(e); merged.data.bg_arhiva = (merged.data.bg_arhiva || []).concat([e]); log.stavke.push('Брифинг: ' + e.tipNaziv); }
        else log.stavke.push('Брифинг (' + tip + ') није направљен: нема материјала.');
      } catch (e) { log.greske.push('Брифинг (' + tip + '): ' + e.message); }
    }
  }

  log.trajanje = Math.round((Date.now() - t0) / 1000);
  if (!log.stavke.length && !log.greske.length) log.stavke.push('Није било шта да се уради (проверите да ли је неки I&W сценарио означен као аутоматски).');
  const incoming = { data: { iw_data: outScenarios, bg_arhiva: outBriefs, auto_log: [log] }, tomb: {} };
  await updateState(store, (base) => {
    const m = mergeInto(incoming)(base);
    if (m.data.auto_log) m.data.auto_log = m.data.auto_log.sort((a, b) => (a.created || 0) - (b.created || 0)).slice(-30);
    return m;
  });
  return log;
}
