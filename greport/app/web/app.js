'use strict';
/* GReport – Notizen zu Störungen. Bedienung wie der Notiz-Teil von GLighter, eigenes Erscheinungsbild. */
/* „Notiz jetzt“ (Erfassung) steht in erfassung.js – gemeinsam mit GLighter, GReport ist die Quelle. Hier: Anbindung (Adapter) und alles andere. */
const E = Erfassung;
const $ = id => document.getElementById(id) || E.popEl(id);     // auch im abgedockten Fenster
const { popOn, popDoc } = E;
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const el = (tag, props) => { const e = document.createElement(tag); Object.assign(e, props || {}); return e; };
const option = (sel, v, label) => { const o = el('option', { value: String(v), textContent: label }); sel.appendChild(o); return o; };
const isoDay = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const dtl = d => isoDay(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
// Zeit fürs Speichern immer mit Offset des Browsers (z. B. +01:00), damit der Zeitpunkt eindeutig ist – auch in der doppelten Stunde
// bei der Zeitumstellung und wenn Home Assistant in einer anderen Zeitzone läuft.
const tzo = d => { const m = -d.getTimezoneOffset(), a = Math.abs(m); return (m < 0 ? '-' : '+') + pad(Math.floor(a / 60)) + ':' + pad(a % 60); };
const dto = d => dtl(d) + tzo(d);
// Eingabefeld (Ortszeit ohne Offset) -> ISO mit Offset; unverändertes Feld behält den gespeicherten Zeitpunkt (orig)
const inIso = (v, orig) => !v ? '' : orig && dtl(new Date(orig)) === v ? orig : isNaN(new Date(v).getTime()) ? v : dto(new Date(v));
const nowMs = () => Date.now();
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(r => r.json());
let lang = (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
function t(k, v) {
  let s = (I18N[lang] || I18N.de)[k];
  if (s === undefined) s = I18N.de[k];
  if (s === undefined) return k;
  if (v) for (const x in v) s = s.split('{' + x + '}').join(v[x]);
  return s;
}
function tr() {
  document.documentElement.lang = lang; document.title = t('title');
  document.querySelectorAll('[data-i]').forEach(e => { e.textContent = t(e.dataset.i); });
  document.querySelectorAll('[data-ia]').forEach(e => { e.title = t(e.dataset.ia); e.setAttribute('aria-label', t(e.dataset.ia)); });
  document.querySelectorAll('[data-iph]').forEach(e => { e.placeholder = t(e.dataset.iph); });
}
function toast(msg, ms) {
  const pd = popDoc(), doc = pd && pd.hasFocus() ? pd : document;    // abgedockt: Meldung dort, wo getippt wird
  let e = doc.getElementById('toast'); if (!e) { e = el('div', { id: 'toast', className: 'toast' }); e.setAttribute('role', 'status'); doc.body.appendChild(e); }
  e.textContent = msg; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), ms || 3500);
}
/* ---------- Datum und Uhrzeit (einstellbar) ---------- */
let PF = { date: 'dmy4', time: 'hms', rel: true, wd: false };
const MON = { de: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
const WD = { de: ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
function fDate(ms, p) {
  p = p || PF; const d = new Date(ms), y = d.getFullYear(), m = d.getMonth(), dd = d.getDate(), wd = WD[lang][d.getDay()];
  let s;
  if (p.date === 'dmy2') s = pad(dd) + '.' + pad(m + 1) + '.' + String(y).slice(2);
  else if (p.date === 'wdm') s = wd + ' ' + pad(dd) + '.' + pad(m + 1) + '.';
  else if (p.date === 'iso') s = y + '-' + pad(m + 1) + '-' + pad(dd);
  else if (p.date === 'long') s = lang === 'en' ? dd + ' ' + MON.en[m] + ' ' + y : dd + '. ' + MON.de[m] + ' ' + y;
  else s = pad(dd) + '.' + pad(m + 1) + '.' + y;
  return p.wd && p.date !== 'wdm' ? wd + ' ' + s : s;
}
function fTime(ms, p) {
  p = p || PF; const d = new Date(ms), h = d.getHours();
  if (p.time === 'hm') return pad(h) + ':' + pad(d.getMinutes());
  if (p.time === 'h12') return ((h % 12) || 12) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + (h < 12 ? ' AM' : ' PM');
  return pad(h) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}
function fDay(ms) {                                  // Überschrift in der Liste: „Heute“, „Gestern“ oder das Datum
  if (PF.rel) { const a = new Date(ms), n = new Date(); const d0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(), dd = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    if (dd === d0) return t('gr_today'); if (dd === d0 - 86400000) return t('gr_yesterday'); }
  return fDate(ms);
}
/* ---------- Design (hell/dunkel/wie Home Assistant) ---------- */
const THEME_SVG = { auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  light: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>',
  dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" fill="currentColor"/></svg>' };
let THEME = 'auto'; try { THEME = localStorage.getItem('gr_theme') || 'auto'; } catch (e) { }
function haDark() { try { const p = window.parent; if (!p || p === window) return null; const ha = p.document.querySelector('home-assistant'), d = ha && ha.hass && ha.hass.themes && ha.hass.themes.darkMode; return typeof d === 'boolean' ? d : null; } catch (e) { return null; } }
function applyTheme() {
  let res = THEME === 'light' || THEME === 'dark' ? THEME : null;
  if (!res) { const h = haDark(); if (h !== null) res = h ? 'dark' : 'light'; }
  for (const doc of [document, popDoc()]) if (doc) { const r = doc.documentElement; if (res) r.setAttribute('data-theme', res); else r.removeAttribute('data-theme'); }
  const b = document.getElementById('themebtn'); if (b) { b.innerHTML = THEME_SVG[THEME]; b.title = t('th_' + THEME) + ' – ' + t('th_tip'); b.setAttribute('aria-label', b.title); }
}
/* ---------- Zustand (Pro, GLighter, Home Assistant) ---------- */
let ST = { pro: { ok: false }, glighter: {}, ha: {}, persons: [] };
const PRO = () => !!(ST.pro && ST.pro.ok);
async function stLoad() {
  try { ST = await (await fetch('state', { cache: 'no-store' })).json(); } catch (e) { }
  if (ST.lang === 'de' || ST.lang === 'en') lang = ST.lang;
  if (ST.prefs) PF = ST.prefs;
  secMigrate(); widthApply(); viewLight();
  stShow(); witList();
}
function stShow() {
  const b = $('grstat'); if (!b) return; b.innerHTML = '';
  const dot = (txt, on, tip) => { const c = el('span', { textContent: txt, className: on ? 'on' : '' }); c.title = tip; c.setAttribute('role', 'img'); c.setAttribute('aria-label', tip); b.appendChild(c); };
  const g = ST.glighter || {};
  if (g.found && ST.prefs && ST.prefs.gl === false) dot('🔗', false, t('gr_gl_off'));
  else if (g.linked) dot('🔗', true, t('gr_gl_linked') + ' – ' + t('gr_gl_linked_tip'));
  else if (g.found) dot('🔗', false, 'GLighter ' + t('gr_gl_found') + ' – ' + t('gr_gl_found_tip'));
  if (ST.mqtt) dot('🏠', true, t('gr_ha_ok_tip'));
  else if (ST.ha && ST.ha.api) dot('🏠', false, t('gr_ha_log_tip'));
}
/* ---------- Schnellwahl, Notiz jetzt, Layout anpassen: aus erfassung.js ---------- */
const { NTS, FNP, G_DEF, ntGroup, ntLabel, wordGroups, gCustom, gLabel, gColor, gAttr, tagMk, ntAll, ntOrdered, ntsLoad, ntsPost, gcolApply,
  viewGet, viewLight, fbLoad, layOpen } = E;
const fnpStart = () => E.start(), fnpShow = () => E.show(), fnpReset = () => E.reset(), fnpEdit = n => E.edit(n);
/* ---------- Tipps (aus der Rechtsprechung abgeleitet, keine Rechtsberatung): einzeln wegklickbar, global abschaltbar ---------- */
let TIPX = new Set(); try { TIPX = new Set(JSON.parse(localStorage.getItem('gr_tipx') || '[]')); } catch (e) { }
const tipModeOf = p => p.tipmode || (p.tips === false ? 'off' : 'hover');
const tipMode = () => tipModeOf(PF);                   // angedockt (Einstellungen); abgedockt: eigene Ansicht, siehe viewGet
const docTipMode = doc => doc && doc !== document ? viewGet('pop').tipmode : tipMode();
function tipModeApply() {                              // Seite und abgedocktes Fenster, jeweils mit der Tipp-Art ihrer Ansicht
  for (const doc of [document, popDoc()]) if (doc && doc.body) doc.body.classList.toggle('tipshover', docTipMode(doc) === 'hover');
}
/* 💡 immer rechts, senkrecht mittig am zugehörigen Block; mehrere Tipps eines Blocks übereinander */
function tipDock(sl) {
  if (sl.parentElement && sl.parentElement.classList.contains('tipdock')) return;
  if (sl.dataset.tips === 'cap') {                                   // Hinweise zur Erfassung: in die Kopfzeile neben ▦ (nicht mitten in den Block)
    const hd = sl.ownerDocument.querySelector('#fnpanel .caphead'), lb = hd && hd.querySelector('#laybtn');
    if (hd && sl.parentElement !== hd) { hd.insertBefore(sl, lb || null); sl.classList.add('tiphead'); }
    return;
  }
  const a = sl.dataset.tips === 'cap' || sl.dataset.tips === '3' ? sl.previousElementSibling : sl.parentElement; if (!a) return;
  let d = a.querySelector(':scope > .tipdock'); if (!d) { d = el('div', { className: 'tipdock' }); a.appendChild(d); }
  a.classList.add('tipanchor'); d.appendChild(sl);
}
function tipsDraw(root) {
  const roots = root ? [root] : [document, popDoc()].filter(Boolean);              // auch im abgedockten Fenster
  for (const r of roots) r.querySelectorAll('.tipslot').forEach(sl => {
    tipDock(sl);
    const want = sl.dataset.tips === 'cap' ? (FNP.edit ? ['8'] : ['1', '2', '7']) : sl.dataset.tips.split(',');
    const md = docTipMode(sl.ownerDocument), n = md !== 'off' ? want.find(x => !TIPX.has(x)) : null;
    if (sl.dataset.cur === String(n || '') && sl.dataset.lang === lang) return;
    sl.dataset.cur = n || ''; sl.dataset.lang = lang;
    if (!n) { sl.innerHTML = ''; return; }
    sl.innerHTML = `<div class="tip" role="note"><button type="button" class="tipi" aria-expanded="false" aria-label="${esc(t('gr_tip_show'))}" title="${esc(t('gr_tip_' + n))}">💡</button><div class="tipb"><span class="tipt">${esc(t('gr_tip_' + n))}</span><details class="why"><summary>${esc(t('gr_tip_why'))}</summary><small>${esc(t('gr_tip_src', { s: t('gr_tip_' + n + '_s') }))}</small></details><button type="button" class="tipx" aria-label="${esc(t('gr_tip_x'))}" title="${esc(t('gr_tip_x'))}">✕</button></div></div>`;
    const tb = sl.querySelector('.tipi'); const side = () => { const r = tb.getBoundingClientRect(), tp = tb.closest('.tip'), w = tb.ownerDocument.defaultView || window; tp.classList.toggle('r', r.left > w.innerWidth / 2); tp.classList.toggle('u', r.top > w.innerHeight * 0.6);
      tp.style.setProperty('--tipw', Math.max(180, Math.floor(tp.getBoundingClientRect().right - 12)) + 'px'); };   // Blase rechtsbündig: nie über den linken Rand tb.onmouseenter = side; tb.onfocus = side;
    tb.onclick = () => { side(); const o = tb.closest('.tip').classList.toggle('open'); tb.setAttribute('aria-expanded', String(o)); };
    sl.querySelector('.tipx').onclick = () => { TIPX.add(n); try { localStorage.setItem('gr_tipx', JSON.stringify([...TIPX])); } catch (e) { } tipsDraw(); };
  });
}
/* ---------- Weitere Angaben (Mehr): Häufigkeit, Polizei, Meldung, Folgen, Attest, Drohung/Gewalt; Rolle/Erreichbarkeit des Zeugen ---------- */
const ROLES = ['mitbewohner', 'nachbar', 'hausverwaltung', 'vermieter', 'polizei', 'sonstige'];
function extInit() {
  const r = $('fnpwrole'); r.innerHTML = ''; option(r, '', t('gr_w_role_none')); for (const k of ROLES) option(r, k, t('gr_role_' + k));
  const p = $('xrepto'); p.innerHTML = ''; option(p, '', t('gr_x_rep_none')); for (const k of ['hv', 'verm', 'sonst']) option(p, k, t('gr_rep_' + k));
  $('fnpwit').addEventListener('input', witX); $('fnpwit').addEventListener('change', witFill);
  $('xpolnr').addEventListener('input', () => { if ($('xpolnr').value.trim()) $('xpol').checked = true; });
  for (const id of ['xfreq', 'xpolnr', 'xhealth', 'xattest', 'fnpwcon']) $(id).addEventListener('input', () => { if ($(id).value.trim()) fnpStart(); });
}
function witX() { $('fnpwitx').hidden = !$('fnpwit').value.trim(); }
function witFill() {                                   // bekannte Person: Rolle und Erreichbarkeit aus der Personenliste vorschlagen
  const n = $('fnpwit').value.split(',')[0].trim(), i = (ST.persons_info || {})[n];
  if (i) { if (!$('fnpwrole').value && i.r) $('fnpwrole').value = i.r; if (!$('fnpwcon').value && i.c) $('fnpwcon').value = i.c; }
  witX();
}
function extOld() {                                    // alte feste Eingaben unter „Mehr“ (nur ohne Standard-Felder)
  const v = id => $(id).value.trim(), x = {};
  if (v('xfreq')) x.freq = v('xfreq');
  if ($('xpol').checked || v('xpolnr')) { x.pol = true; if (v('xpolnr')) x.pol_nr = v('xpolnr'); }
  if (v('xrepto')) x.rep_to = v('xrepto'); if (v('xrepdate')) x.rep_date = v('xrepdate');
  if (v('xhealth')) x.health = v('xhealth'); if (v('xattest')) x.attest = v('xattest');
  if ($('xthreat').checked) x.threat = true;
  if ($('fnpwit').value.trim()) { if (v('fnpwrole')) x.wrole = v('fnpwrole'); if (v('fnpwcon')) x.wcontact = v('fnpwcon'); }
  return x;
}
function extFill(x) {
  x = x || {};
  $('xfreq').value = x.freq || ''; $('xpol').checked = !!x.pol; $('xpolnr').value = x.pol_nr || ''; $('xrepto').value = x.rep_to || ''; $('xrepdate').value = x.rep_date || '';
  $('xhealth').value = x.health || ''; $('xattest').value = x.attest || ''; $('xthreat').checked = !!x.threat;
  $('fnpwrole').value = x.wrole || ''; $('fnpwcon').value = x.wcontact || '';
  $('secmore').open = ['freq', 'pol', 'rep_to', 'rep_date', 'health', 'attest', 'threat'].some(k => x[k]);
  witX();
}
function extTxt(n) {                                   // kurze Anzeige in Zeitleiste und Tabelle
  const x = n.ext || {}, p = [];
  if (x.threat) p.push('⚠ ' + t('gr_x_threat_s'));
  if (x.pol) p.push('🚓 ' + t('gr_x_pol_s') + (x.pol_nr ? ' ' + x.pol_nr : ''));
  if (x.rep_to || x.rep_date) p.push('📨 ' + (x.rep_to ? t('gr_rep_' + x.rep_to) : t('gr_x_rep_s')) + (x.rep_date ? ' ' + fDate(Date.parse(x.rep_date + 'T12:00:00')) : ''));
  if (x.freq) p.push('↻ ' + x.freq);
  if (x.health) p.push('⚕ ' + x.health);
  if (x.attest) p.push('📄 ' + t('gr_x_attest_s') + ': ' + x.attest);
  if (n.src_doc) p.push('🔎 ' + t('gr_from_doc', { n: n.src_doc.name || n.src_doc.id, p: n.src_doc.page || '–', l: n.src_doc.line || '–' }));
  return p;
}
const witTxt = n => { const x = n.ext || {}, r = x.wrole ? t('gr_role_' + x.wrole) : ''; return n.witness + (r || x.wcontact ? ' (' + [r, x.wcontact].filter(Boolean).join(', ') + ')' : ''); };
function witList() {                                   // Pro: gespeicherte Personen zum Antippen (mehrere Zeugen)
  const box = $('fnpwitl'); if (!box) return; box.innerHTML = '';
  if (!PRO()) return;
  for (const p of ST.persons || []) {
    const b = el('button', { type: 'button', className: 'chip', textContent: p });
    b.onclick = () => { const w = $('fnpwit'), cur = w.value.split(',').map(x => x.trim()).filter(Boolean); if (!cur.includes(p)) cur.push(p); w.value = cur.join(', '); fnpStart(); };
    box.appendChild(b);
  }
}
/* Schnell-Schalter früherer Versionen (nur dieser Browser, gr_sechide) einmal in die angedockte Ansicht übernehmen */
function secMigrate() {
  let old = null; try { old = JSON.parse(localStorage.getItem('gr_sechide') || 'null'); } catch (e) { }
  if (!Array.isArray(old) || secMigrate.busy) return;
  const done = () => { try { localStorage.removeItem('gr_sechide'); } catch (e) { } };
  if (Array.isArray(PF.sechide) || !old.length) { done(); return; }
  PF.sechide = old; secMigrate.busy = true;
  post('prefs', { sechide: old }).then(j => { if (j.ok) { delete j.ok; PF = j; done(); } }).catch(() => { }).finally(() => { secMigrate.busy = false; });
}
/* ---------- Eigene Felder: Definitionen in felder.json, die Erfassung zeigt sie (erfassung.js) ---------- */
const FB = Felder.S;
/* Statistik: je Zähler die letzten 14 Tage als kleine Balken über der Liste */
function statsDraw() {
  const box = document.getElementById('grstats'); if (!box) return;
  const cs = Felder.active().filter(b => b.type === 'counter' && (!b.hide || (FB.daily[b.id] || []).some(x => x[1])));
  box.hidden = !cs.length; box.innerHTML = cs.map(Felder.chart).join('');
}
/* ---------- Liste: Zeitleiste nach Tagen oder Tabelle (nur Anzeige – gespeichert wird nichts anders) ---------- */
const cnt = n => t(n === 1 ? 'gr_count_1' : 'gr_count', { n });
const LST = { all: [], notes: [], q: '', tag: '', range: 'all', from: '', to: '', view: 'tl' };
try { LST.view = localStorage.getItem('gr_view') === 'tb' ? 'tb' : 'tl'; } catch (e) { }
const NOTIME = '__notime';                             // Filter „ohne Zeitpunkt“ in der Zeitleiste
const RANGES = ['all', 'today', 'd7', 'd30', 'custom'];
const dayStart = s => { const d = new Date(s + 'T00:00:00'); return isNaN(d.getTime()) ? null : d; };
function rangeMs() {                                   // gewählter Zeitraum als [von, bis] in ms (null = offen)
  const n = new Date(), back = k => new Date(n.getFullYear(), n.getMonth(), n.getDate() - k).getTime();
  if (LST.range === 'today') return [back(0), null];
  if (LST.range === 'd7') return [back(6), null];
  if (LST.range === 'd30') return [back(29), null];
  if (LST.range === 'custom') {
    const f = dayStart(LST.from), e = dayStart(LST.to);
    return [f ? f.getTime() : null, e ? new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1).getTime() - 1 : null];
  }
  return [null, null];
}
function rangeTitle() {
  if (LST.range === 'custom') {
    const f = dayStart(LST.from), e = dayStart(LST.to), a = f ? fDate(f.getTime()) : '', b = e ? fDate(e.getTime()) : '';
    return a && b ? t('gr_ttl_ft', { a, b }) : a ? t('gr_ttl_f', { a }) : b ? t('gr_ttl_t', { b }) : t('gr_list');
  }
  return t({ today: 'gr_ttl_today', d7: 'gr_ttl_d7', d30: 'gr_ttl_d30' }[LST.range] || 'gr_list');
}
async function listLoad() {
  const [f, e] = rangeMs(); let u = 'notes?limit=5000';
  if (f != null) u += '&from=' + f; if (e != null) u += '&to=' + e;
  try {
    const fresh = (await (await fetch(u, { cache: 'no-store' })).json()).notes || [];
    const old = new Map(LST.all.map(n => [n.id, n]));     // unveränderte Notizen behalten (Tabelle zeichnet dann nichts neu)
    LST.all = fresh.map(n => { const o = old.get(n.id); return o && JSON.stringify(o) === JSON.stringify(n) ? o : n; });
  } catch (x) { }
  listDraw();
}
// „erfasst 14:32:10, Taste: vor 5 Min.“ – Erfassungszeit und gewählter Zeitpunkt getrennt; ≈ = ungefähr
function metaTxt(n) {
  const p = [];
  if (n.notime) return '';
  if (n.cap && !n.wk && Math.abs(n.cap - n.a) > 60000) p.push(t('gr_capinfo_only', { t: fTime(n.cap) + (isoDay(new Date(n.cap)) !== isoDay(new Date(n.a)) ? ' (' + fDate(n.cap) + ')' : '') }));
  if (n.wk) p.push(t('gr_capinfo', { t: n.cap ? fTime(n.cap) + (isoDay(new Date(n.cap)) !== isoDay(new Date(n.a)) ? ' (' + fDate(n.cap) + ')' : '') : '–', k: n.wl || ntLabel(n.wk) }));
  if (n.approx) p.push(t('gr_approx'));
  return p.join(' · ');
}
const qMatch = (n, q) => ([n.text || '', n.witness || ''].concat(n.tagl || [], (n.tags || []).map(ntLabel), Felder.compact(n.fields)).join(' ')).toLowerCase().includes(q);
const fxHtml = (n, cls) => Felder.compact(n.fields).map(x => `<span class="${cls || 'by fx'}">${esc(x)}</span>`).join('');
function countShow(n, m, f) {
  const c = document.getElementById('grcount'), s = f ? t('gr_cnt_f', { n, m }) : cnt(m);
  if (c.textContent !== s) c.textContent = s;
  document.getElementById('grclr').hidden = !f;
}
function filtDraw() {
  const box = document.getElementById('grfilt'); if (!box) return;
  const cnt = {}; for (const n of LST.notes) for (const k of n.tags || []) cnt[k] = (cnt[k] || 0) + 1;
  const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 10);
  const nn = LST.notes.filter(n => n.notime).length;
  const kc = {}; for (const n of LST.notes) if (n.kind) kc[n.kind] = (kc[n.kind] || 0) + 1;      // Notiz-Arten als Filter (ab 1.11)
  const kh = Object.keys(kc).filter(k => Felder.kindOf(k)).map(k => { const x = Felder.kindOf(k), on = LST.tag === 'kind:' + k;
    return `<button type="button" class="tag fbkind${on ? ' on' : ''}" style="--kc:${esc(x.col || '#5f6b78')}" data-t="kind:${esc(k)}" aria-pressed="${on}">${x.ico ? esc(x.ico) + ' ' : ''}${esc(x.l)} <small>${kc[k]}</small></button>`; }).join('');
  box.innerHTML = kh + (top.length > 1 ? top.map(k => `<button type="button" class="tag ${gAttr(ntGroup(k)).replace('"', LST.tag === k ? ' on"' : '"')} data-t="${esc(k)}" aria-pressed="${LST.tag === k}">${esc(ntLabel(k))} <small>${cnt[k]}</small></button>`).join('') : '')
    + (nn ? `<button type="button" class="tag ${gAttr('when').replace('"', LST.tag === NOTIME ? ' on"' : '"')} data-t="${NOTIME}" aria-pressed="${LST.tag === NOTIME}">${esc(t('gr_notime'))} <small>${nn}</small></button>` : '');
  box.querySelectorAll('.tag').forEach(b => b.onclick = () => { LST.tag = LST.tag === b.dataset.t ? '' : b.dataset.t; listDraw(); });
}
/* Breite: ganze Breite (Standard, wie die Tabelle) oder schmale Spalte; die Tabelle ist immer breit */
function widthApply(w) { document.body.classList.toggle('grwide', (w || (PF && PF.width) || 'wide') === 'wide'); }
function viewShow() {
  const tb = LST.view === 'tb';
  document.getElementById('grnotes').hidden = tb; document.getElementById('grgrid').hidden = !tb;
  document.getElementById('grfilt').hidden = tb; document.getElementById('grcols').hidden = !tb;
  if (!tb) colMenuClose();
  document.getElementById('logsec').classList.toggle('tbl', tb);
  widthApply();
  document.querySelectorAll('#grview button').forEach(b => { const on = b.dataset.v === LST.view; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
}
async function noteDel(n) {
  if (!confirm(t('fn_del_q'))) return;
  try { await post('note', { action: 'del', id: n.id }); } catch (e) { }
  if (FNP.edit && FNP.edit.id === n.id) fnpReset(); listLoad();
}
function listDraw() {
  const q = LST.q.trim().toLowerCase().slice(0, 80);
  LST.notes = q ? LST.all.filter(n => qMatch(n, q)) : LST.all;
  const ttl = document.getElementById('logttl'), tt = rangeTitle(); if (ttl.textContent !== tt) ttl.textContent = tt;
  viewShow();
  if (LST.view === 'tb' && window.agGrid) { tblDraw(); return; }
  const box = document.getElementById('grnotes'); if (!box) return; box.innerHTML = ''; box.hidden = false;
  filtDraw();
  const list = LST.tag === NOTIME ? LST.notes.filter(n => n.notime) : LST.tag.startsWith('kind:') ? LST.notes.filter(n => 'kind:' + n.kind === LST.tag) : LST.tag ? LST.notes.filter(n => (n.tags || []).includes(LST.tag)) : LST.notes;
  countShow(list.length, LST.all.length, !!(q || LST.tag));
  if (!list.length) { box.appendChild(el('div', { className: 'empty', textContent: t(q || LST.tag || LST.range !== 'all' ? 'gr_none_q' : 'gr_none') })); return; }
  const days = new Map(); for (const n of list) { const k = isoDay(new Date(n.a)); if (!days.has(k)) days.set(k, []); days.get(k).push(n); }
  for (const [, ns] of days) {
    const h = el('div', { className: 'day' }); h.innerHTML = `<span>${esc(fDay(ns[0].a))}</span><small>${esc(cnt(ns.length))}</small>`; box.appendChild(h);
    for (const n of ns) {
      const r = el('div', { className: 'note' + (FNP.edit && FNP.edit.id === n.id ? ' cur' : '') });
      const by = n.by === 'homeassistant' ? '🏠 Home Assistant' : n.by === 'import' ? t('gr_imported') : '';
      r.innerHTML = `<div class="t">${n.notime ? `<small class="nt">${esc(t('gr_notime'))}</small>` : esc((n.approx ? '≈ ' : '') + fTime(n.a))}${n.to ? `<small>${esc(t('gr_until', { t: fTime(n.b) }))}</small>` : ''}</div>
        <div class="c">${n.kind ? Felder.kindChip(n.kind, true) : ''}${(n.tags || []).filter(k => k !== 'zeuge' || !n.witness).map(tagMk).join('')}${n.text ? `<span class="tx">${esc(n.text)}</span>` : ''}${n.witness ? `<span class="who">👤 ${esc(witTxt(n))}</span>` : ''}${fxHtml(n)}${extTxt(n).map(x => `<span class="by ext">${esc(x)}</span>`).join('')}${(n.att || []).length ? `<button type="button" class="by attb" aria-label="${esc(t('gr_att_open') + ': ' + n.att.map(a => a.name).join(', '))}" title="${esc(n.att.map(a => a.name).join(', '))}">📎 ${n.att.length}</button>` : ''}${by ? `<span class="by">${esc(by)}</span>` : ''}${metaTxt(n) ? `<span class="by meta">${esc(metaTxt(n))}</span>` : ''}${n.edited ? `<button type="button" class="by histb" data-h="${esc(n.id)}">${esc(t('gr_edited_at', { t: fDate(Date.parse(n.edited)) + ' ' + fTime(Date.parse(n.edited)) }))}</button>` : ''}</div>
        <div class="a"><button type="button" class="e" aria-label="${esc(t('nt_edit'))}" title="${esc(t('nt_edit'))}">✎</button><button type="button" class="d" aria-label="${esc(t('nt_del'))}" title="${esc(t('nt_del'))}">🗑</button></div>`;
      r.querySelector('.e').onclick = () => fnpEdit(n);
      r.querySelector('.d').onclick = () => noteDel(n);
      const hb = r.querySelector('.histb'); if (hb) hb.onclick = () => histOpen(n);
      const ab = r.querySelector('.attb'); if (ab) ab.onclick = () => attOpen(n.id);
      box.appendChild(r);
    }
  }
}
/* Tabelle (AG Grid Community, MIT – liegt der App bei, kein Internet nötig). Farben kommen aus den CSS-Variablen von GReport,
   dadurch folgen hell, dunkel und der Design-Knopf automatisch. */
let GRID = null, GRID_FMT = '', GRID_EDIT = null, GRID_COLS = '';
const NARROW = () => matchMedia('(max-width:600px)').matches;
const COLS = 'day time text tags witness'.split(' ');
/* eigene Felder als Spalten: alle nicht gelöschten, gelöschte nur, wenn eine Notiz einen Wert hat */
const fbCols = () => FB.defs.filter(b => !b.bind && (!b.del || LST.all.some(n => n.fields && b.id in n.fields)));   // Zeuge/„Mehr“ haben eigene Spalten
const colsAll = () => (GRID && GRID.getColumn('kind') ? 'day time kind text tags witness'.split(' ') : COLS).concat(fbCols().map(b => b.id));
/* Tabelle einstellen (ab 1.11): Reihenfolge, gezeigte Spalten, Breiten – gespeichert in GReport (je breit/schmal), Browser als Rückfall */
const tblV = () => NARROW() ? 'n' : 'w';
const tblSt = () => ((PF && PF.tbl) || {})[tblV()] || {};
function tblPut(patch) {
  const all = JSON.parse(JSON.stringify((PF && PF.tbl) || {})), v = tblV(); all[v] = Object.assign(all[v] || {}, patch);
  if (PF) PF.tbl = all;
  clearTimeout(tblPut.tm); tblPut.tm = setTimeout(() => post('prefs', { tbl: all }).then(j => { if (j && j.ok) { delete j.ok; PF = j; } }).catch(() => { }), 500);
}
function tblOrderApply() {
  if (!GRID) return; const o = tblSt().order; if (!o || !o.length) return;
  const have = GRID.getColumns().map(c => c.getColId()).filter(c => c !== 'act'), ord = o.filter(c => have.includes(c)).concat(have.filter(c => !o.includes(c)));
  GRID.applyColumnState({ state: ord.map(colId => ({ colId })), applyOrder: true });
  const wd = tblSt().wd || {}; const ws = Object.entries(wd).filter(([c]) => GRID.getColumn(c)).map(([key, newWidth]) => ({ key, newWidth })); if (ws.length) GRID.setColumnWidths(ws, true);
}
const tblOrderNow = () => GRID ? GRID.getAllGridColumns().map(c => c.getColId()).filter(c => c !== 'act') : [];
const colKey = () => 'gr_cols' + (NARROW() ? '_n' : '');
function colVisible() {
  const v = NARROW() ? { day: true, time: false, kind: false, text: true, tags: false, witness: false } : { day: true, time: true, kind: true, text: true, tags: true, witness: true };
  for (const b of fbCols()) v[b.id] = !NARROW() && (!b.hide || LST.all.some(n => n.fields && b.id in n.fields));   // ausgeblendet, aber mit Werten: Spalte zeigen
  try { Object.assign(v, JSON.parse(localStorage.getItem(colKey()) || '{}')); } catch (e) { }
  Object.assign(v, tblSt().vis || {});                 // in GReport gespeichert: geht vor
  return v;
}
function colApply() {
  if (!GRID) return; const v = colVisible(), all = colsAll().filter(c => GRID.getColumn(c));
  GRID.setColumnsVisible(all.filter(c => v[c]), true); GRID.setColumnsVisible(all.filter(c => !v[c]), false);
  GRID.setColumnWidths([{ key: 'act', newWidth: NARROW() ? 80 : 104 }]); GRID.refreshHeader();   // schmal: Aktionen ohne Überschrift
  GRID.refreshCells({ columns: ['day'], force: true });   // ohne Spalte „Uhrzeit“ steht die Uhrzeit unter dem Datum
}
const gridTheme = () => agGrid.themeQuartz.withParams({
  backgroundColor: 'var(--card)', foregroundColor: 'var(--ink)', textColor: 'var(--ink)', subtleTextColor: 'var(--mut)',
  chromeBackgroundColor: 'var(--soft)', headerBackgroundColor: 'var(--soft)', headerTextColor: 'var(--ink)', headerFontWeight: 650,
  borderColor: 'var(--line)', rowBorder: { color: 'var(--line)' }, accentColor: 'var(--acc)', rangeSelectionBorderColor: 'var(--acc)',
  rowHoverColor: 'color-mix(in srgb, var(--acc) 7%, transparent)', selectedRowBackgroundColor: 'color-mix(in srgb, var(--acc) 12%, transparent)',
  inputBackgroundColor: 'var(--card)', inputBorder: { color: 'var(--line)' }, inputTextColor: 'var(--ink)', inputPlaceholderTextColor: 'var(--mut)',
  inputFocusBorder: { color: 'var(--acc)', width: 2 }, focusShadow: '0 0 0 2px var(--acc)', menuBackgroundColor: 'var(--card)', menuTextColor: 'var(--ink)',
  fontFamily: 'inherit', fontSize: 14, headerFontSize: 13.5, wrapperBorderRadius: 10, borderRadius: 8, spacing: 7, browserColorScheme: 'inherit',
  iconColor: 'var(--mut)'
});
const agText = p => {                                  // Texte der Tabelle selbst (Filter, Hinweise für Screenreader)
  let s = (I18N[lang] || I18N.de)['ag_' + p.key]; if (s == null) return p.defaultValue;
  for (const v of p.variableValues || []) s = s.replace('${variable}', v);
  return s;
};
class TagFilter {                                      // Mehrfachauswahl: Notizen mit mindestens einem der gewählten Wörter
  init(p) { this.p = p; this.sel = new Set(); this.gui = el('div', { className: 'tagf' }); this.draw(); }
  words() { const c = {}; for (const n of LST.notes) for (const k of n.tags || []) c[k] = (c[k] || 0) + 1; for (const k of this.sel) c[k] = c[k] || 0; return Object.keys(c).sort((a, b) => c[b] - c[a] || ntLabel(a).localeCompare(ntLabel(b))).map(k => [k, c[k]]); }
  draw() {
    const ws = this.words();
    this.gui.innerHTML = `<fieldset><legend>${esc(t('gr_f_words'))}</legend>${ws.length ? ws.map(([k, n]) => `<label class="check"><input type="checkbox" value="${esc(k)}"${this.sel.has(k) ? ' checked' : ''}><span class="mk ${gAttr(ntGroup(k))}>${esc(ntLabel(k))}</span><small>${n}</small></label>`).join('') : `<p class="hint">${esc(t('gr_none_q'))}</p>`}</fieldset>
      <div class="tagfb"><button type="button" class="btn"${this.sel.size ? '' : ' disabled'}>${esc(t('gr_f_none'))}</button></div>`;
    this.gui.querySelectorAll('input').forEach(i => i.onchange = () => { i.checked ? this.sel.add(i.value) : this.sel.delete(i.value); this.gui.querySelector('.tagfb button').disabled = !this.sel.size; this.p.filterChangedCallback(); });
    this.gui.querySelector('.tagfb button').onclick = () => { this.sel.clear(); this.draw(); this.p.filterChangedCallback(); const f = this.gui.querySelector('input'); if (f) f.focus(); };
  }
  getGui() { return this.gui; }
  afterGuiAttached() { this.draw(); const f = this.gui.querySelector('input'); if (f) f.focus(); }
  isFilterActive() { return this.sel.size > 0; }
  doesFilterPass(p) { const tg = p.data.tags || []; for (const k of this.sel) if (tg.includes(k)) return true; return false; }
  getModel() { return this.sel.size ? { values: [...this.sel] } : null; }
  setModel(m) { this.sel = new Set((m && m.values) || []); this.draw(); }
}
class TagFloat {                                       // Kopfzeile: zeigt „Alle“ oder „2 gewählt“, öffnet die Auswahl
  init(p) { this.b = el('button', { type: 'button', className: 'tagff tagw' }); this.b.onclick = () => p.showParentFilter(); this.onParentModelChanged(null); }
  onParentModelChanged(m) { const n = m && m.values ? m.values.length : 0; this.b.textContent = n ? t('gr_f_n', { n }) : t('gr_f_all'); this.b.setAttribute('aria-label', t('gr_c_tags') + ': ' + this.b.textContent); }
  getGui() { return this.b; }
}
class ChoiceFilter {                                   // eigene Felder (Auswahl, Ja/Nein): Mehrfachauswahl der Werte
  init(p) { this.p = p; this.b = p.b; this.sel = new Set(); this.gui = el('div', { className: 'tagf' }); this.draw(); }
  vals(n) { const v = (n.fields || {})[this.b.id]; return v == null ? [] : Array.isArray(v) ? v.map(String) : [this.b.type === 'yesno' ? (v ? '1' : '0') : String(v)]; }
  label(x) { return this.b.type === 'yesno' ? t(x === '1' ? 'fb_yes' : 'fb_no') : x; }
  draw() {
    const c = {}; for (const n of LST.notes) for (const x of this.vals(n)) c[x] = (c[x] || 0) + 1;
    for (const x of (this.b.type === 'yesno' ? ['1', '0'] : this.b.opts || []).concat([...this.sel])) c[x] = c[x] || 0;
    const ws = Object.keys(c);
    this.gui.innerHTML = `<fieldset><legend>${esc(this.b.l)}</legend>${ws.length ? ws.map(k => `<label class="check"><input type="checkbox" value="${esc(k)}"${this.sel.has(k) ? ' checked' : ''}> ${esc(this.label(k))} <small>${c[k]}</small></label>`).join('') : `<p class="hint">${esc(t('gr_none_q'))}</p>`}</fieldset>
      <div class="tagfb"><button type="button" class="btn"${this.sel.size ? '' : ' disabled'}>${esc(t('gr_f_none'))}</button></div>`;
    this.gui.querySelectorAll('input').forEach(i => i.onchange = () => { i.checked ? this.sel.add(i.value) : this.sel.delete(i.value); this.gui.querySelector('.tagfb button').disabled = !this.sel.size; this.p.filterChangedCallback(); });
    this.gui.querySelector('.tagfb button').onclick = () => { this.sel.clear(); this.draw(); this.p.filterChangedCallback(); };
  }
  getGui() { return this.gui; }
  afterGuiAttached() { this.draw(); const f = this.gui.querySelector('input'); if (f) f.focus(); }
  isFilterActive() { return this.sel.size > 0; }
  doesFilterPass(p) { return this.vals(p.data).some(x => this.sel.has(x)); }
  getModel() { return this.sel.size ? { values: [...this.sel] } : null; }
  setModel(m) { this.sel = new Set((m && m.values) || []); this.draw(); }
}
class ChoiceFloat {
  init(p) { this.p = p; this.b = el('button', { type: 'button', className: 'tagff' }); this.b.onclick = () => p.showParentFilter(); this.onParentModelChanged(null); }
  onParentModelChanged(m) { const n = m && m.values ? m.values.length : 0; this.b.textContent = n ? t('gr_f_n', { n }) : t('gr_f_all'); this.b.setAttribute('aria-label', (this.p.b || {}).l + ': ' + this.b.textContent); }
  getGui() { return this.b; }
}
function fbColDef(b, tf) {
  const num = ['counter', 'number', 'scale', 'duration'].includes(b.type), choice = b.type === 'yesno' || b.type === 'select', val = p => ((p.data && p.data.fields) || {})[b.id];
  const c = { colId: b.id, headerName: b.l, flex: 1, minWidth: 110, wrapText: true, autoHeight: true, cellDataType: false, sortable: true,
    valueGetter: p => { const v = val(p); return num ? (typeof v === 'number' ? v : null) : Felder.fmt(b, v); },
    getQuickFilterText: p => Felder.fmt(b, val(p)) };
  if (num) Object.assign(c, { cellClass: 'num', valueFormatter: p => p.value == null ? '' : Felder.fmt(b, p.value), filter: 'agNumberColumnFilter',
    filterParams: { filterOptions: ['greaterThanOrEqual', 'lessThanOrEqual', 'equals', 'inRange', 'blank', 'notBlank'], defaultOption: 'greaterThanOrEqual', maxNumConditions: 1, buttons: ['reset'] } });
  else if (choice) Object.assign(c, { filter: ChoiceFilter, filterParams: { b }, floatingFilterComponent: ChoiceFloat, floatingFilterComponentParams: { b }, sortable: true });
  else Object.assign(c, { filter: 'agTextColumnFilter', filterParams: tf });
  return c;
}
class DateFloat {                                     // Kopfzeile Datum: zeigt den gewählten Zeitraum, öffnet den Datumsfilter
  init(p) { this.b = el('button', { type: 'button', className: 'tagff datef' }); this.b.onclick = () => p.showParentFilter(); this.onParentModelChanged(null); }
  onParentModelChanged(m) {
    const d = s => s ? fDate(new Date(String(s).slice(0, 10) + 'T12:00:00').getTime()) : '';
    const v = !m ? t('gr_f_all') : m.type === 'inRange' ? d(m.dateFrom) + ' – ' + d(m.dateTo) : m.type === 'lessThan' ? t('gr_f_before', { d: d(m.dateFrom) }) : m.type === 'greaterThan' ? t('gr_f_after', { d: d(m.dateFrom) }) : d(m.dateFrom);
    this.b.textContent = v; this.b.setAttribute('aria-label', t('gr_c_day') + ': ' + v);
  }
  getGui() { return this.b; }
}
class TimeFilter {                                     // Uhrzeit: mit Zeitpunkt / ohne Zeitpunkt / per Taste / ungefähr
  init(p) { this.p = p; this.sel = new Set(); this.gui = el('div', { className: 'tagf' }); this.draw(); }
  draw() {
    const o = ['with', 'none', 'key', 'approx'];
    this.gui.innerHTML = `<fieldset><legend>${esc(t('gr_c_time'))}</legend>${o.map(x => `<label class="check"><input type="checkbox" value="${x}"${this.sel.has(x) ? ' checked' : ''}> ${esc(t('gr_tf_' + x))}</label>`).join('')}</fieldset>`;
    this.gui.querySelectorAll('input').forEach(i => i.onchange = () => { i.checked ? this.sel.add(i.value) : this.sel.delete(i.value); this.p.filterChangedCallback(); });
  }
  getGui() { return this.gui; }
  afterGuiAttached() { const f = this.gui.querySelector('input'); if (f) f.focus(); }
  isFilterActive() { return this.sel.size > 0; }
  doesFilterPass(p) { const n = p.data; return (this.sel.has('with') && !n.notime) || (this.sel.has('none') && n.notime) || (this.sel.has('key') && !!n.wk) || (this.sel.has('approx') && !!n.approx); }
  getModel() { return this.sel.size ? { values: [...this.sel] } : null; }
  setModel(m) { this.sel = new Set((m && m.values) || []); this.draw(); }
}
class TimeFloat {
  init(p) { this.b = el('button', { type: 'button', className: 'tagff timef' }); this.b.onclick = () => p.showParentFilter(); this.onParentModelChanged(null); }
  onParentModelChanged(m) { const v = m && m.values && m.values.length ? m.values.map(x => t('gr_tf_' + x)).join(', ') : t('gr_f_all'); this.b.textContent = v; this.b.setAttribute('aria-label', t('gr_c_time') + ': ' + v); }
  getGui() { return this.b; }
}
class KindFilter {                                     // Notiz-Art: mehrere wählbar, auch „ohne Art“
  init(p) { this.p = p; this.sel = new Set(); this.gui = el('div', { className: 'tagf' }); this.draw(); }
  draw() {
    const o = [...Felder.kindsActive().map(k => [k.id, k.l]), ['', t('fk_none')]];
    this.gui.innerHTML = `<fieldset><legend>${esc(t('fk_col_h'))}</legend>${o.map(([v, l]) => `<label class="check"><input type="checkbox" value="${esc(v)}"${this.sel.has(v) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}</fieldset>`;
    this.gui.querySelectorAll('input').forEach(i => i.onchange = () => { i.checked ? this.sel.add(i.value) : this.sel.delete(i.value); this.p.filterChangedCallback(); });
  }
  getGui() { return this.gui; }
  afterGuiAttached() { this.draw(); const f = this.gui.querySelector('input'); if (f) f.focus(); }
  isFilterActive() { return this.sel.size > 0; }
  doesFilterPass(p) { return this.sel.has(p.data.kind || ''); }
  getModel() { return this.sel.size ? { values: [...this.sel] } : null; }
  setModel(m) { this.sel = new Set((m && m.values) || []); this.draw(); }
}
class KindFloat {
  init(p) { this.b = el('button', { type: 'button', className: 'tagff kindf' }); this.b.onclick = () => p.showParentFilter(); this.onParentModelChanged(null); }
  onParentModelChanged(m) { const v = m && m.values && m.values.length ? m.values.map(x => x ? (Felder.kindOf(x) || {}).l || x : t('fk_none')).join(', ') : t('gr_f_all'); this.b.textContent = v; this.b.setAttribute('aria-label', t('fk_col_h') + ': ' + v); }
  getGui() { return this.b; }
}
const dayOf = ms => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const secOfDay = ms => { const d = new Date(ms); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); };
const timeTxt = n => n.notime ? t('gr_notime') : (n.approx ? '≈ ' : '') + fTime(n.a) + (n.to ? ' – ' + fTime(n.b) : '');
function actCell(p) {
  const w = el('div', { className: 'acts' });
  w.innerHTML = `<button type="button" class="e" tabindex="-1" aria-label="${esc(t('nt_edit'))}" title="${esc(t('nt_edit'))}">✎</button><button type="button" class="d" tabindex="-1" aria-label="${esc(t('nt_del'))}" title="${esc(t('nt_del'))}">🗑</button>`;
  w.querySelector('.e').onclick = () => fnpEdit(p.data); w.querySelector('.d').onclick = () => noteDel(p.data);
  w.addEventListener('keydown', e => {                 // in der Zelle: ←/→ und Tab wechseln zwischen ✎ und 🗑, Esc zurück zur Zelle
    const bs = [...w.querySelectorAll('button')], i = bs.indexOf(document.activeElement); if (i < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || (e.key === 'Tab' && (e.shiftKey ? i === 1 : i === 0))) { e.preventDefault(); bs[1 - i].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); p.api.setFocusedCell(p.node.rowIndex, 'act'); }
  });
  return w;
}
function gridCols() {
  const tf = { maxNumConditions: 1, buttons: ['reset'], filterOptions: ['contains', 'notContains', 'equals', 'startsWith', 'blank', 'notBlank'] };
  return [
      { colId: 'day', field: 'a', headerName: t('gr_c_day'), sort: 'desc', flex: 1.1, minWidth: 96, filter: 'agDateColumnFilter',
        filterParams: { comparator: (fd, v) => { const d = dayOf(v); return d < fd.getTime() ? -1 : d > fd.getTime() ? 1 : 0; }, filterOptions: ['inRange', 'equals', 'lessThan', 'greaterThan'], defaultOption: 'inRange', inRangeInclusive: true, maxNumConditions: 1, buttons: ['reset'] },
        floatingFilterComponent: DateFloat, cellRenderer: p => `<span>${esc(fDay(p.data.a))}</span>${GRID && !GRID.getColumn('time').isVisible() ? `<small class="tm">${esc(timeTxt(p.data))}</small>` : ''}`,
        getQuickFilterText: () => '' },
      { colId: 'time', headerName: t('gr_c_time'), valueGetter: p => p.data.notime ? -1 : secOfDay(p.data.a), flex: 1.2, minWidth: 124, wrapText: true, autoHeight: true, cellClass: 'num',
        cellRenderer: p => `<span>${esc(timeTxt(p.data))}</span>${metaTxt(p.data) ? `<small class="tm">${esc(metaTxt(p.data))}</small>` : ''}${p.data.edited ? `<small class="tm">${esc(t('gr_edited'))}</small>` : ''}`,
        filter: TimeFilter, floatingFilterComponent: TimeFloat, getQuickFilterText: p => timeTxt(p.data) },
      ...(Felder.kindsActive().length || LST.all.some(n => n.kind) ? [{ colId: 'kind', field: 'kind', headerName: t('fk_col_h'), flex: 1, minWidth: 110, filter: KindFilter, floatingFilterComponent: KindFloat,
        valueGetter: p => (Felder.kindOf(p.data.kind) || {}).l || '', cellRenderer: p => p.data.kind ? Felder.kindChip(p.data.kind, true) : '', getQuickFilterText: p => (Felder.kindOf(p.data.kind) || {}).l || '' }] : []),
      { colId: 'text', field: 'text', headerName: t('gr_c_text'), flex: 3, minWidth: 100, wrapText: true, autoHeight: true, filter: 'agTextColumnFilter', filterParams: tf,
        cellRenderer: p => `<span>${esc(p.data.text || '')}</span>${(p.data.att || []).length ? ` <button type="button" class="attb linkbtn" tabindex="-1" aria-label="${esc(t('gr_att_open'))}">📎 ${p.data.att.length}</button>` : ''}${extTxt(p.data).map(x => `<small class="tm">${esc(x)}</small>`).join('')}`, getQuickFilterText: p => (p.data.text || '') + ' ' + extTxt(p.data).join(' ') },
      { colId: 'tags', field: 'tags', headerName: t('gr_c_tags'), cellDataType: false, flex: 2.2, minWidth: 150, sortable: false, wrapText: true, autoHeight: true, filter: TagFilter, floatingFilterComponent: TagFloat,
        cellRenderer: p => `<div class="mks">${(p.data.tags || []).filter(k => k !== 'zeuge' || !p.data.witness).map(tagMk).join('')}</div>` },
      { colId: 'witness', field: 'witness', headerName: t('gr_c_witness'), flex: 1.2, minWidth: 100, wrapText: true, autoHeight: true, filter: 'agTextColumnFilter', filterParams: tf,
        valueFormatter: p => p.data.witness ? witTxt(p.data) : '' },
      ...fbCols().map(b => fbColDef(b, tf)),
      { colId: 'act', lockPosition: 'right', suppressMovable: true, headerName: t('gr_c_act'), headerValueGetter: () => NARROW() ? '' : t('gr_c_act'), headerTooltip: t('gr_act_tip'), width: NARROW() ? 80 : 104, minWidth: 80, maxWidth: 104, sortable: false, resizable: false, floatingFilter: false, cellClass: 'actc', cellRenderer: actCell,
        suppressKeyboardEvent: p => !!(p.event.target && p.event.target.closest && p.event.target.closest('.acts button')) }
  ];
}
function gridOpts() {
  return {
    theme: gridTheme(), getLocaleText: agText, rowData: [], getRowId: p => String(p.data.id),
    defaultColDef: { sortable: true, resizable: true, suppressHeaderMenuButton: true, floatingFilter: true, filter: false },
    columnDefs: gridCols(),
    rowClassRules: { cur: p => !!(FNP.edit && p.data && FNP.edit.id === p.data.id) },
    tabToNextCell: () => false,                        // Tab verlässt die Tabelle (Pfeiltasten bewegen sich darin)
    tooltipShowDelay: 400, suppressCellFocus: false, animateRows: false, enableCellTextSelection: true, ensureDomOrder: true,
    onCellKeyDown: p => { if (p.column.getColId() === 'act' && (p.event.key === 'Enter' || p.event.key === 'F2') && !p.event.target.closest('.acts button')) { const c = p.event.target.querySelector && p.event.target.querySelector('.acts button'); if (c) { p.event.preventDefault(); c.focus(); } } },
    onFilterChanged: tblCount, onModelUpdated: tblCount,
    onColumnMoved: p => { if (p.finished && p.source === 'uiColumnMoved') tblPut({ order: tblOrderNow() }); },
    onColumnResized: p => { if (p.finished && p.source === 'uiColumnResized' && p.column) { const wd = Object.assign({}, tblSt().wd || {}); wd[p.column.getColId()] = Math.round(p.column.getActualWidth()); tblPut({ wd }); } },
    onCellClicked: p => { const b = p.event && p.event.target && p.event.target.closest && p.event.target.closest('.attb'); if (b) attOpen(p.data.id); },
    overlayNoRowsTemplate: `<span class="empty">${esc(t('gr_none_q'))}</span>`
  };
}
function tblCount() { if (GRID) countShow(GRID.getDisplayedRowCount(), LST.all.length, GRID.isAnyFilterPresent() || !!LST.q.trim()); }
function tblDraw() {
  if (!GRID) { GRID = agGrid.createGrid(document.getElementById('grgrid'), gridOpts()); GRID_COLS = JSON.stringify([fbCols(), FB.kinds, LST.all.some(n => n.kind)]); colApply(); tblOrderApply(); }
  const ck = JSON.stringify([fbCols(), FB.kinds, LST.all.some(n => n.kind)]); if (ck !== GRID_COLS) { GRID_COLS = ck; GRID.setGridOption('columnDefs', gridCols()); colApply(); tblOrderApply(); }   // eigene Felder geändert
  const fk = JSON.stringify([PF, lang, NTS.ren, NTS.own, NTS.grp, FB.defs]);
  GRID.setGridOption('rowData', LST.notes);
  if (fk !== GRID_FMT) { GRID_FMT = fk; GRID.refreshCells({ force: true }); }
  const ed = FNP.edit ? FNP.edit.id : null; if (ed !== GRID_EDIT) { GRID_EDIT = ed; GRID.redrawRows(); }
  tblCount();
}
function colMenuClose() { const m = document.getElementById('grcolm'); if (m && !m.hidden) { m.hidden = true; document.getElementById('grcols').setAttribute('aria-expanded', 'false'); } }
function colMenu() {
  const m = document.getElementById('grcolm'), b = document.getElementById('grcols');
  if (!m.hidden) { colMenuClose(); return; }
  const v = colVisible();
  const cl = GRID ? tblOrderNow().filter(c => colsAll().includes(c)).concat(colsAll().filter(c => !tblOrderNow().includes(c))) : colsAll();   // in der aktuellen Reihenfolge
  m.innerHTML = `<b class="colttl">${esc(t('gr_cols'))}</b>` + cl.map(c => `<label class="check"><input type="checkbox" data-c="${c}"${v[c] ? ' checked' : ''}> ${esc(Felder.isId(c) ? (Felder.byId(c) || {}).l || c : t('gr_c_' + c))}</label>`).join('');
  const boxes = [...m.querySelectorAll('input')];
  const lock = () => { const on = boxes.filter(x => x.checked); boxes.forEach(x => { x.disabled = on.length === 1 && x.checked; }); };   // mindestens eine Spalte bleibt
  boxes.forEach(x => x.onchange = () => { const nv = colVisible(); nv[x.dataset.c] = x.checked; try { localStorage.setItem(colKey(), JSON.stringify(nv)); } catch (e) { } tblPut({ vis: nv }); colApply(); lock(); });
  m.querySelectorAll('label.check').forEach(l => {                       // Reihenfolge: ← → je Spalte (auch per Tastatur); Ziehen im Tabellenkopf geht ebenso
    const c = l.querySelector('input').dataset.c, mv = d => { const o = tblOrderNow(), i = o.indexOf(c), j = i + d; if (i < 0 || j < 0 || j >= o.length) return; o.splice(j, 0, o.splice(i, 1)[0]); tblPut({ order: o }); tblOrderApply(); colMenuClose(); colMenu(); const f = document.querySelector(`#grcolm .colmv[data-c="${c}"][data-d="${d}"]`); if (f) f.focus(); const lv = document.getElementById('grcollive'); if (lv) lv.textContent = t('gr_col_moved', { c: l.textContent.trim(), i: j + 1, n: o.length }); };
    const w = el('span', { className: 'colmvw' });
    for (const [d, s_, k] of [[-1, '←', 'gr_col_left'], [1, '→', 'gr_col_right']]) { const bt = el('button', { type: 'button', className: 'colmv', textContent: s_ }); bt.dataset.c = c; bt.dataset.d = d; bt.setAttribute('aria-label', t(k, { c: l.textContent.trim() })); bt.onclick = e => { e.preventDefault(); e.stopPropagation(); mv(d); }; w.appendChild(bt); }
    l.after(w); const row = el('div', { className: 'colrow' }); l.before(row); row.append(l, w);
  });
  const rs = el('button', { type: 'button', className: 'btn colrst', textContent: t('gr_col_reset') });
  rs.onclick = e => { e.stopPropagation(); try { localStorage.removeItem(colKey()); } catch (e) { } const all = JSON.parse(JSON.stringify((PF && PF.tbl) || {})); delete all[tblV()]; if (PF) PF.tbl = all; post('prefs', { tbl: Object.keys(all).length ? all : null }).then(j => { if (j && j.ok) { delete j.ok; PF = j; } }).catch(() => { }); GRID.setGridOption('columnDefs', gridCols()); GRID.resetColumnState(); colApply(); colMenuClose(); document.getElementById('grcols').focus(); };
  m.append(rs, el('span', { className: 'sr', id: 'grcollive' })); m.querySelector('#grcollive').setAttribute('aria-live', 'polite');
  lock(); m.hidden = false; b.setAttribute('aria-expanded', 'true'); boxes[0].focus();
  m.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); colMenuClose(); b.focus(); } };
}
function initList() {
  const rs = document.getElementById('grrange'); rs.innerHTML = ''; for (const r of RANGES) option(rs, r, t('gr_r_' + r));
  rs.value = LST.range;
  const cust = () => { const c = LST.range === 'custom'; document.getElementById('grcust').hidden = !c; };
  rs.onchange = () => {
    LST.range = rs.value; cust();
    if (LST.range === 'custom' && !LST.from && !LST.to) { const d = new Date(); LST.to = isoDay(d); LST.from = isoDay(new Date(d.getFullYear(), d.getMonth() - 1, d.getDate())); document.getElementById('grfrom').value = LST.from; document.getElementById('grto').value = LST.to; }
    listLoad();
  };
  for (const id of ['grfrom', 'grto']) document.getElementById(id).addEventListener('change', e => { LST[id === 'grfrom' ? 'from' : 'to'] = e.target.value; listLoad(); });
  cust();
  document.querySelectorAll('#grview button').forEach(b => b.onclick = () => { LST.view = b.dataset.v; try { localStorage.setItem('gr_view', LST.view); } catch (e) { } listDraw(); });
  document.getElementById('grclr').onclick = () => {
    LST.q = ''; LST.tag = ''; document.getElementById('grq').value = ''; if (GRID) GRID.setFilterModel(null);
    listDraw(); document.getElementById('grq').focus();
  };
  document.getElementById('grcols').onclick = e => { e.stopPropagation(); colMenu(); };
  document.addEventListener('click', e => { if (!e.target.closest('#grcolm,#grcols')) colMenuClose(); });
  matchMedia('(max-width:600px)').addEventListener('change', () => { colMenuClose(); colApply(); });
  viewShow();
}
/* ---------- Schnellwahl bearbeiten (Dialog): umbenennen, Gruppe, Reihenfolge, ausblenden, zurücksetzen ---------- */
function qtOpen(focus) {
  const d = document.getElementById('qtdlg');
  const gsel = document.getElementById('qtnewg'); gsel.innerHTML = ''; for (const g of wordGroups()) option(gsel, g, gLabel(g)); gsel.value = 'own';
  qtDraw(focus); if (!d.open) d.showModal();
  if (!focus) setTimeout(() => document.getElementById('qtnew').focus(), 50);
}
function qtDraw(focus) {
  const box = document.getElementById('qtlist'); box.innerHTML = '';
  document.querySelectorAll('#qtdlg .seg button').forEach(b => { const on = b.dataset.mode === NTS.mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); b.setAttribute('role', 'radio'); });
  const ownN = Object.keys(NTS.own).filter(k => !NTS.del.has(k)).length;
  document.getElementById('qtinfo').textContent = (PRO() ? t('gr_qt_pro', { n: ownN, m: NTS.max }) + ' ' : t('gr_qt_free', { n: ownN, m: NTS.max }) + ' ') + t(NTS.mode === 'fixed' ? 'gr_mode_fixed_h' : 'gr_mode_use_h');
  const lim = document.getElementById('qtlim');
  lim.innerHTML = `<label>${esc(t('gr_lim_own'))} <input type="number" id="qtlimn" min="5" max="${NTS.proMax}" value="${NTS.limit}"${PRO() ? '' : ' disabled'}></label><label>${esc(t('gr_lim_show'))} <input type="number" id="qtshown" min="0" max="50" value="${NTS.show}"${PRO() ? '' : ' disabled'}></label>${PRO() ? '' : '<span>🔒 Pro</span>'}`;
  if (PRO()) {
    document.getElementById('qtlimn').onchange = e => ntsPost({ action: 'limit', n: +e.target.value }).then(() => qtDraw()).catch(x => alert(x.message));
    document.getElementById('qtshown').onchange = e => ntsPost({ action: 'show', n: +e.target.value }).then(() => qtDraw()).catch(x => alert(x.message));
  }
  const sg = document.getElementById('qtsug'); sg.innerHTML = NTS.sug.map(w => `<button type="button" class="chip" data-w="${esc(w.w)}">💡 ${esc(w.w)} (${w.n}×) ＋</button>`).join('');
  sg.querySelectorAll('button').forEach(b => b.onclick = () => ntsPost({ action: 'add', l: b.dataset.w }).then(() => qtDraw()).catch(e => alert(e.message)));
  const all = ntOrdered(ntAll()), by = {}; for (const k of all) (by[ntGroup(k)] = by[ntGroup(k)] || []).push(k);
  for (const g of wordGroups()) {
    const ks = by[g] || []; if (!ks.length) continue;
    const sec = el('div', { className: 'qtg ' + (gCustom(g) ? 'g-cu' : 'g-' + g) }); if (gCustom(g)) { sec.style.setProperty('--uc', gColor(g)); sec.style.setProperty('--udc', gColor(g)); } const gc = (NTS.gcol || {})[g];
 const rq = NTS.req && NTS.req.has(g);
    sec.innerHTML = `<h4>${esc(gLabel(g))}<label class="reqc" title="${esc(t('gr_req_tip'))}"><input type="checkbox"${rq ? ' checked' : ''}> ${esc(t('gr_req'))}</label><input type="color" value="${esc(gc || G_DEF[g] || gColor(g))}" aria-label="${esc(t('gr_gcol', { g: gLabel(g) }))}" title="${esc(t('gr_gcol', { g: gLabel(g) }))}">${gc ? `<button type="button" class="gcr" title="${esc(t('gr_gcol_reset'))}" aria-label="${esc(t('gr_gcol_reset'))}">↺</button>` : ''}</h4>`;
    sec.querySelector('.reqc input').onchange = e => ntsPost({ action: 'req', g, on: e.target.checked }).then(() => qtDraw()).catch(x => alert(x.message));
    const ci = sec.querySelector('input[type=color]');
    ci.addEventListener('input', () => { NTS.gcol = Object.assign({}, NTS.gcol, { [g]: ci.value }); gcolApply(); });
    ci.addEventListener('change', () => ntsPost({ action: 'gcol', g, c: ci.value }).then(() => qtDraw()).catch(e => alert(e.message)));
    const cr = sec.querySelector('.gcr'); if (cr) cr.onclick = () => ntsPost({ action: 'gcol', g, c: '' }).then(() => qtDraw());
    const rows = el('div', { className: 'qtrows' });
    for (const k of ks) {
      const own = NTS.own[k] != null, off = NTS.hide.has(k);
      const r = el('div', { className: 'qtr' + (off ? ' off' : '') }); r.dataset.k = k; r.draggable = true;
      r.innerHTML = `<span class="hd" title="${esc(t('gr_drag'))}" aria-hidden="true">⠿</span><input type="text" maxlength="30" value="${esc(ntLabel(k))}" aria-label="${esc(t('qt_ren'))}"><select aria-label="${esc(t('gr_group'))}">${wordGroups().map(x => `<option value="${x}"${x === g ? ' selected' : ''}>${esc(gLabel(x))}</option>`).join('')}</select>
        <span class="b"><button type="button" class="up" aria-label="${esc(t('gr_up'))}" title="${esc(t('gr_up'))}">▲</button><button type="button" class="dn" aria-label="${esc(t('gr_down'))}" title="${esc(t('gr_down'))}">▼</button>${own ? `<button type="button" class="del" aria-label="${esc(t('nt_del'))}" title="${esc(t('nt_del'))}">🗑</button>` : `<label class="vis" title="${esc(t('gr_shown_tip'))}"><input type="checkbox"${off ? '' : ' checked'}> ${esc(t('gr_shown'))}</label>`}</span>`;
      const inp = r.querySelector('input');
      const ren = () => { const v = inp.value.trim(); if (v && v !== ntLabel(k)) ntsPost({ action: 'ren', k, l: v }).then(() => qtDraw()).catch(e => alert(e.message)); };
      inp.addEventListener('change', ren); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
      r.querySelector('select').onchange = e => ntsPost({ action: 'grp', k, g: e.target.value }).then(() => qtDraw()).catch(x => alert(x.message));
      r.querySelector('.up').onclick = () => qtMove(k, -1); r.querySelector('.dn').onclick = () => qtMove(k, 1);
      const vb = r.querySelector('.vis input'); if (vb) vb.onchange = () => ntsPost({ action: 'hide', k, on: !vb.checked }).then(() => qtDraw());
      const db = r.querySelector('.del'); if (db) db.onclick = () => { if (confirm(t('qt_del_q', { n: ntLabel(k) }))) ntsPost({ action: 'del', k }).then(() => qtDraw()); };
      r.addEventListener('dragstart', e => { r.classList.add('drag'); e.dataTransfer.setData('text/plain', k); e.dataTransfer.effectAllowed = 'move'; });
      r.addEventListener('dragend', () => r.classList.remove('drag'));
      r.addEventListener('dragover', e => { e.preventDefault(); r.classList.add('over'); });
      r.addEventListener('dragleave', () => r.classList.remove('over'));
      r.addEventListener('drop', e => { e.preventDefault(); r.classList.remove('over'); const from = e.dataTransfer.getData('text/plain'); if (from && from !== k) qtPlace(from, k); });
      rows.appendChild(r);
      if (focus === k) setTimeout(() => { inp.focus(); inp.select(); r.scrollIntoView({ block: 'center' }); }, 60);
    }
    sec.appendChild(rows); box.appendChild(sec);
  }
}
function qtSaveOrder(list) { return ntsPost({ action: 'order', keys: list }).then(() => qtDraw()).catch(e => alert(e.message)); }
function qtMove(k, dir) {                              // ▲▼ innerhalb der Gruppe
  const all = ntOrdered(ntAll()), g = ntGroup(k), same = all.filter(x => ntGroup(x) === g), i = same.indexOf(k), j = i + dir;
  if (j < 0 || j >= same.length) return;
  const a = all.indexOf(k), b = all.indexOf(same[j]); [all[a], all[b]] = [all[b], all[a]]; qtSaveOrder(all);
}
function qtPlace(from, before) {                        // Ziehen: vor das Ziel setzen (Gruppe des Ziels übernehmen)
  const all = ntOrdered(ntAll()).filter(x => x !== from); all.splice(all.indexOf(before), 0, from);
  const g = ntGroup(before);
  (ntGroup(from) !== g ? ntsPost({ action: 'grp', k: from, g }) : Promise.resolve()).then(() => qtSaveOrder(all));
}
function initQt() {
  document.querySelectorAll('#qtdlg .seg button').forEach(b => b.onclick = () => ntsPost(b.dataset.mode === 'fixed' ? { action: 'order', keys: ntOrdered(ntAll()) } : { action: 'mode', mode: 'use' }).then(() => qtDraw()));
  document.getElementById('qtreset').onclick = () => { if (confirm(t('gr_reset_q'))) ntsPost({ action: 'reset' }).then(() => qtDraw()); };
  const add = () => { const v = document.getElementById('qtnew').value.trim(); if (!v) return; ntsPost({ action: 'add', l: v, g: document.getElementById('qtnewg').value }).then(() => { document.getElementById('qtnew').value = ''; qtDraw(); }).catch(e => alert(e.message)); };
  document.getElementById('qtaddok').onclick = add;
  document.getElementById('qtnew').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
}
/* ---------- Anzeige: Datum und Uhrzeit ---------- */
function prefOpen() {
  const ds = document.getElementById('pfdate'), ts = document.getElementById('pftime'), ex = Date.now();
  ds.innerHTML = ''; for (const f of ['dmy4', 'dmy2', 'wdm', 'iso', 'long']) option(ds, f, fDate(ex, Object.assign({}, PF, { date: f, wd: false })));
  ts.innerHTML = ''; for (const f of ['hms', 'hm', 'h12']) option(ts, f, fTime(ex, Object.assign({}, PF, { time: f })));
  ds.value = PF.date; ts.value = PF.time; document.getElementById('pfrel').checked = PF.rel; document.getElementById('pfwd').checked = PF.wd;
  document.getElementById('pfauto').value = String(PF.autosave || 0);
  document.getElementById('pftipmode').value = tipMode();
  document.getElementById('pftipsr').onclick = () => { TIPX.clear(); try { localStorage.removeItem('gr_tipx'); } catch (e) { } tipsDraw(); toast('✓ ' + t('gr_p_tips_done')); };
  const upd = () => { const p = prefRead(); document.getElementById('pfex').textContent = fDate(ex, p) + ', ' + fTime(ex, p); };
  for (const x of [ds, ts, document.getElementById('pfrel'), document.getElementById('pfwd')]) x.onchange = upd;
  upd(); document.getElementById('prefdlg').showModal();
}
const prefRead = () => ({ date: document.getElementById('pfdate').value, time: document.getElementById('pftime').value, rel: document.getElementById('pfrel').checked, wd: document.getElementById('pfwd').checked, autosave: +document.getElementById('pfauto').value || 0, tipmode: document.getElementById('pftipmode').value, tips: document.getElementById('pftipmode').value !== 'off' });
/* ---------- Textdatei & Import/Export (Pro) ---------- */
const TXT = { st: null, content: null };
const txtErr = e => { const k = 'gr_err_' + String(e || 'x').replace(/\W/g, '_'); const v = t(k); return v === k ? t('gr_err_x') + (e ? ' (' + e + ')' : '') : v; };
async function txtOpen() {
  const d = document.getElementById('txtdlg');
  try { TXT.st = await (await fetch('textfile', { cache: 'no-store' })).json(); } catch (e) { TXT.st = {}; }
  const s = TXT.st || {};
  document.getElementById('txton').checked = !!s.on; document.getElementById('txtmon').checked = !!s.monthly;
  document.getElementById('txtfmt').value = s.fmt || 'txt';
  const pth = document.getElementById('txtpath'); pth.value = s.path || ''; pth.placeholder = s.default || '/share/greport/export/greport_tagebuch.txt';
  txtStatus();
  const lk = document.getElementById('txtpro'); lk.hidden = PRO(); lk.textContent = '🔒 ' + t('gr_txt_pro');
  if (PRO()) d.removeAttribute('data-locked'); else d.setAttribute('data-locked', '');
  d.querySelectorAll('.blk').forEach(b => { b.inert = !PRO(); });     // ohne Pro: gesperrt, auch für Tastatur und Screenreader
  expPath(); tipsDraw(d); document.getElementById('impres').hidden = true; document.getElementById('impgo').disabled = true; TXT.content = null;
  document.getElementById('imppath').value = '';
  d.showModal();
}
function txtStatus() {
  const s = TXT.st || {}, el_ = document.getElementById('txtst');
  el_.textContent = (s.moved ? '⚠ ' + t('gr_txt_moved', { o: s.moved, n: s.default || '' }) + ' ' : '') + (s.error ? '⚠ ' + txtErr(s.error) : s.last ? '✓ ' + t('gr_txt_last', { t: fDate(new Date(s.last).getTime()) + ' ' + fTime(new Date(s.last).getTime()), f: (s.files || []).slice(-1)[0] || '' }) : t('gr_txt_roots', { r: (s.roots || ['/share/greport/export', '/media/greport']).join(', ') }));
}
function expPath() {
  const f = document.getElementById('expfmt').value, p = document.getElementById('exppath');
  p.placeholder = '/share/greport/export/greport_export_' + isoDay(new Date()) + '.' + f;
}
function impShow(r) {
  const box = document.getElementById('impres'); box.hidden = false;
  if (!r.ok) { box.textContent = '⚠ ' + txtErr(r.error); document.getElementById('impgo').disabled = true; return; }
  box.innerHTML = r.applied != null ? `✓ ${esc(t('gr_imp_done', { n: r.applied, w: r.words_made || 0 }))}`
    : `${esc(t('gr_imp_found', { n: r.new, d: r.dup, b: r.bad }))}${r.words && r.words.length ? `<br>${esc(t('gr_imp_words', { w: r.words.join(', ') }))}` : ''}${r.sample && r.sample.length ? `<ul>${r.sample.map(x => `<li>${esc(fDate(new Date(x.from).getTime()) + ' ' + fTime(new Date(x.from).getTime()))} – ${esc(x.text || '…')}</li>`).join('')}</ul>` : ''}`;
  document.getElementById('impgo').disabled = r.applied != null || !r.new;
}
function impBody(apply) {
  const p = document.getElementById('imppath').value.trim();
  return TXT.content != null && !p ? { content: TXT.content, apply } : { path: p, apply };
}
function initTxt() {
  document.getElementById('txtsave').onclick = async () => {
    const j = await post('textfile', { on: document.getElementById('txton').checked, monthly: document.getElementById('txtmon').checked, fmt: document.getElementById('txtfmt').value, path: document.getElementById('txtpath').value.trim() }).catch(() => ({ ok: false }));
    if (!j.ok) { document.getElementById('txtst').textContent = '⚠ ' + txtErr(j.error); return; }
    TXT.st = j; txtStatus(); toast('✓ ' + t('gr_txt_saved'));
  };
  document.getElementById('txtnow').onclick = async () => { const j = await post('textfile', { action: 'write' }).catch(() => ({ ok: false })); TXT.st = Object.assign(TXT.st || {}, j); if (!j.ok) TXT.st.error = j.error; txtStatus(); };
  document.getElementById('expfmt').onchange = expPath;
  document.getElementById('expdl').onclick = () => { location.href = 'export?fmt=' + document.getElementById('expfmt').value; };
  document.getElementById('expgo').onclick = async () => {
    const j = await post('export_file', { fmt: document.getElementById('expfmt').value, path: document.getElementById('exppath').value.trim() }).catch(() => ({ ok: false }));
    document.getElementById('expst').textContent = j.ok ? '✓ ' + t('gr_exp_done', { n: j.n, p: j.path }) : '⚠ ' + txtErr(j.error);
  };
  document.getElementById('impfile').onclick = () => document.getElementById('impf').click();
  document.getElementById('impf').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    TXT.content = await f.text(); document.getElementById('imppath').value = ''; document.getElementById('imppath').placeholder = '📎 ' + f.name;
    impShow(await post('import', impBody(false)).catch(() => ({ ok: false })));
  };
  document.getElementById('imppath').addEventListener('input', () => { TXT.content = null; document.getElementById('impgo').disabled = true; });
  document.getElementById('impprev').onclick = async () => impShow(await post('import', impBody(false)).catch(() => ({ ok: false })));
  document.getElementById('impgo').onclick = async () => { const r = await post('import', impBody(true)).catch(() => ({ ok: false })); impShow(r); if (r.ok) { ntsLoad(); listLoad(); } };
}
/* ---------- Nachweis: Kette prüfen, Verlauf einer Notiz, Papierkorb ---------- */
const OPS = { start: 'gr_op_start', add: 'gr_op_add', edit: 'gr_op_edit', del: 'gr_op_del', restore: 'gr_op_restore', extern: 'gr_op_extern', extern_del: 'gr_op_extern' };
const fIso = s => { const v = Date.parse(s); return isNaN(v) ? String(s || '–') : fDate(v) + ' ' + fTime(v); };
async function verOpen() {
  const d = document.getElementById('verdlg'), box = document.getElementById('verbox'); box.textContent = '…';
  const [rf, rt] = rangeMs(), q = (rf != null ? '&from=' + rf : '') + (rt != null ? '&to=' + rt : '');     // Bericht für den angezeigten Zeitraum
  document.getElementById('repdl').href = 'bericht?gs=0' + q; document.getElementById('repgs').href = 'bericht?gs=1' + q; tipsDraw(d);
  if (!d.open) d.showModal();
  let v; try { v = await (await fetch('verify', { cache: 'no-store' })).json(); } catch (e) { box.textContent = t('saveerr'); return; }
  const head = v.empty ? t('gr_ver_empty') : v.ok ? t('gr_ver_ok', { t: fIso(v.since) }) : t('gr_ver_bad', { n: v.problems.length });
  box.innerHTML = `<p class="verhead ${v.ok ? 'ok' : 'bad'}">${v.ok ? '✓' : '⚠'} ${esc(head)}</p>
    ${v.problems.length ? `<ul class="verlist">${v.problems.map(p => `<li>${esc(p.what)}</li>`).join('')}</ul>` : ''}
    ${v.warnings.length ? `<p class="hint">${esc(t('gr_ver_warn'))}</p><ul class="verlist">${v.warnings.map(p => `<li>${esc(p.what)}</li>`).join('')}</ul>` : ''}
    <dl class="verdl"><dt>${esc(t('gr_ver_n'))}</dt><dd>${v.n} · ${esc(t('gr_ver_notes', { n: v.notes }))}</dd>
      <dt>${esc(t('gr_ver_first'))}</dt><dd><code>${esc(v.first_hash || '–')}</code></dd><dt>${esc(t('gr_ver_last'))}</dt><dd><code>${esc(v.last_hash || '–')}</code> (${esc(fIso(v.last))})</dd>
      <dt>${esc(t('gr_ver_keyed'))}</dt><dd>${v.keyed} / ${v.n}</dd><dt>${esc(t('gr_ver_files'))}</dt><dd>${esc(t('gr_ver_files_n', { n: v.files || 0, a: v.files_active || 0 }))}</dd><dt>${esc(t('gr_ver_clock'))}</dt><dd>${esc(v.clock)}${v.tz ? ' · ' + esc(v.tz) : ''}</dd></dl>
    <p class="hint">${esc(t('gr_ver_h'))}</p>`;
  trashDraw();
}
async function trashDraw() {
  const box = document.getElementById('trashbox');
  let j; try { j = await (await fetch('trash', { cache: 'no-store' })).json(); } catch (e) { return; }
  const ns = (j.notes || []).slice().reverse();
  box.innerHTML = ns.length ? ns.map(n => `<div class="histrow"><span>${esc(fDate(n.a) + ' ' + (n.notime ? t('gr_notime') : fTime(n.a)))} – ${esc(n.text || (n.tagl || []).join(', ') || Felder.compact(n.fields).join(' · '))}<small>${esc(t('gr_deleted_at', { t: fIso(n.deleted) }))}</small></span><button type="button" class="btn" data-r="${esc(n.id)}">${esc(t('gr_restore'))}</button></div>`).join('') : `<p class="hint">${esc(t('gr_trash_empty'))}</p>`;
  box.querySelectorAll('[data-r]').forEach(b => b.onclick = async () => { const r = await post('note', { action: 'restore', id: b.dataset.r }).catch(() => ({})); if (r.ok) { toast('✓ ' + t('gr_restored')); trashDraw(); listLoad(); } });
}
async function histOpen(n) {
  const d = document.getElementById('histdlg'), box = document.getElementById('histbox'); box.textContent = '…'; d.showModal(); tipsDraw(d);
  let j; try { j = await (await fetch('history?id=' + encodeURIComponent(n.id), { cache: 'no-store' })).json(); } catch (e) { box.textContent = t('saveerr'); return; }
  const ver = x => { if (!x) return ''; const p = Object.assign({ a: Date.parse(x.from) || Date.parse(x.at || x.ts) }, x); return `${esc(fDate(p.a) + ' ' + (p.notime ? t('gr_notime') : fTime(p.a)))}${p.to ? ' – ' + esc(fTime(Date.parse(p.to))) : ''} · ${esc(p.text || '')}${(p.tags || []).length ? ' · ' + esc(p.tags.map(ntLabel).join(', ')) : ''}${p.witness ? ' · 👤 ' + esc(p.witness) : ''}${p.fields ? Felder.compact(p.fields).map(x => ' · ' + esc(x)).join('') : ''}`; };
  box.innerHTML = (j.items || []).map(e => {
    const x = e.op === 'start' ? (e.note || null) : e.note;
    return `<div class="histrow"><span><b>${esc(t(OPS[e.op] || 'gr_op_edit'))}</b> · ${esc(fIso(e.iso))}${x ? `<small>${ver(x)}</small>` : ''}${e.prev && e.op !== 'start' ? `<small class="old">${esc(t('gr_hist_before'))}: ${ver(e.prev)}</small>` : ''}</span></div>`;
  }).join('') || `<p class="hint">${esc(t('gr_hist_none'))}</p>`;
}
/* ---------- Kleine Hilfe ---------- */
const HELP = ['now', 'tags', 'req', 'time', 'when', 'more', 'att', 'scan', 'lay', 'list', 'ver', 'doc', 'ha', 'gl', 'txt', 'pro'];
function helpOpen() {
  document.getElementById('helpbody').innerHTML = HELP.map(k => `<details${k === 'now' ? ' open' : ''}><summary>${esc(t('gr_h_' + k))}</summary><p>${esc(t('gr_h_' + k + '_t'))}</p></details>`).join('');
  document.getElementById('helpdlg').showModal();
}
/* ---------- Menü ---------- */
function menu() {
  const m = document.getElementById('grmenul');
  if (!m.hidden) { m.hidden = true; return; }
  const lock = PRO() ? '' : '🔒 Pro';
  const items = [['✎', t('qt_title'), () => qtOpen()], ['🕒', t('gr_prefs'), prefOpen], ['▦', t('gr_lay'), () => layOpen()], ['🔗', t('gr_gl_title'), glOpen], ['🏠', t('gr_dash'), dashOpen], null,
    ['📎', t('gr_att_title'), () => attOpen()], ['⤓', t('gr_backup'), () => { location.href = 'backup'; }], ['✔', t('gr_ver_title'), verOpen],
    ['📄', t('gr_txt_title'), txtOpen, lock],
    ['👤', t('gr_persons'), () => PRO() ? perOpen() : proOpen(), lock], null,
    ['?', t('gr_help'), helpOpen], ['⭐', PRO() ? t('gr_pro_on') : t('gr_pro_get'), proOpen]];
  m.innerHTML = '';
  for (const it of items) {
    if (!it) { m.appendChild(el('hr')); continue; }
    const b = el('button', { type: 'button' }); b.setAttribute('role', 'menuitem');
    b.append(el('span', { textContent: it[0], className: 'mi' }), el('span', { textContent: it[1] })); if (it[3]) b.appendChild(el('span', { className: 'lock', textContent: it[3] }));
    b.onclick = () => { m.hidden = true; it[2](); }; m.appendChild(b);
  }
  m.hidden = false; m.querySelector('button').focus();
  m.onkeydown = e => {                                  // Pfeiltasten im Menü
    const bs = [...m.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); bs[(i + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus(); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); bs[e.key === 'Home' ? 0 : bs.length - 1].focus(); }
    else if (e.key === 'Escape' || e.key === 'Tab') { m.hidden = true; document.getElementById('grmenu').focus(); }
  };
}
/* Dashboard-Vorlage für Home Assistant */
let DASH_ON = false;
function dashOpen() {
  const d = document.getElementById('dashdlg');
  if (!DASH_ON && window.HADash) { DASH_ON = true; HADash.mount(document.getElementById('dashbox'), { lang, get: 'hadash', post: 'hadash_apply', preview: 'hadash',
    parts: { karte: t('hd_karte'), felder: t('hd_felder'), letzte: t('hd_letzte'), heute: t('hd_heute'), oeffnen: t('hd_oeffnen') } }); }
  d.showModal();
}
function proOpen() {
  const p = ST.pro || {};
  document.getElementById('prost').textContent = p.ok ? t('pro_active', { d: p.until || '' }) : p.state === 'expired' ? t('gr_pro_expired', { d: p.until || '' }) : t('gr_pro_none');
  document.getElementById('probuy').href = p.buy || 'https://www.gsimulations.de/greport/#buypro';
  document.getElementById('prodel').hidden = !(p.ok || p.state === 'expired'); document.getElementById('promsg').textContent = '';
  document.getElementById('prodlg').showModal();
}
/* GLighter: Notizen weitergeben (an/aus) */
function glOpen() {
  const g = ST.glighter || {}, on = !(ST.prefs && ST.prefs.gl === false);
  document.getElementById('glshare').checked = on;
  document.getElementById('glst').textContent = !g.found ? t('gr_gl_none') : g.linked ? t('gr_gl_linked') : 'GLighter ' + t('gr_gl_found') + ' – ' + t('gr_gl_found_tip');
  document.getElementById('gldlg').showModal();
}
function perOpen() {                                   // Zeilen „Name; Rolle; Erreichbarkeit“
  const inf = ST.persons_info || {};
  document.getElementById('perlist').value = (ST.persons || []).map(p => { const i = inf[p]; return i && (i.r || i.c) ? [p, i.r ? t('gr_role_' + i.r) : '', i.c || ''].join('; ') : p; }).join('\n');
  document.getElementById('perdlg').showModal();
}
function initDialogs() {
  document.querySelectorAll('dialog .dlgx').forEach(b => b.onclick = () => b.closest('dialog').close());
  document.querySelectorAll('dialog').forEach((d, i) => { const h = d.querySelector('h3'); if (h && !d.hasAttribute('aria-labelledby')) { h.id = h.id || 'dlgh' + i; d.setAttribute('aria-labelledby', h.id); } });
  document.getElementById('prosave').onclick = async () => {
    const k = document.getElementById('prokey').value.trim(); if (!k) return;
    const j = await post('pro', { key: k }).catch(() => ({ ok: false }));
    const m = document.getElementById('promsg'); m.className = 'msg' + (j.ok ? '' : ' err'); m.textContent = j.ok ? '✓ ' + t('gr_pro_ok') : t(j.error === 'offline' ? 'gr_pro_offline' : 'gr_pro_bad');
    if (j.ok) { document.getElementById('prokey').value = ''; await stLoad(); ntsLoad(); setTimeout(() => document.getElementById('prodlg').close(), 900); }
  };
  document.getElementById('prodel').onclick = async () => { if (!confirm(t('pro_remove_q'))) return; await post('pro', { action: 'del' }).catch(() => { }); await stLoad(); proOpen(); };
  document.getElementById('persave').onclick = async () => {
    const lst = document.getElementById('perlist').value.split('\n').map(x => x.trim()).filter(Boolean);
    const j = await post('persons', { list: lst }).catch(() => ({ ok: false }));
    if (j.ok) { ST.persons = j.list; ST.persons_info = j.info || {}; witList(); document.getElementById('perdlg').close(); } else alert(t('saveerr'));
  };
  document.getElementById('pfsave').onclick = async () => {
    const j = await post('prefs', prefRead()).catch(() => ({ ok: false }));
    if (j.ok) { delete j.ok; PF = j; widthApply(); viewLight(); tipsDraw(); document.getElementById('prefdlg').close(); fnpShow(); listDraw(); } else alert(t('saveerr'));
  };
  document.getElementById('glsave').onclick = async () => {
    const j = await post('prefs', { gl: document.getElementById('glshare').checked }).catch(() => ({ ok: false }));
    if (j.ok) { ST.prefs = Object.assign(ST.prefs || {}, { gl: j.gl }); PF = Object.assign(PF || {}, { gl: j.gl }); stShow(); document.getElementById('gldlg').close(); toast(t(j.gl ? 'gr_gl_on_ok' : 'gr_gl_off_ok')); } else alert(t('saveerr'));
  };
  document.getElementById('grimpf').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const j = await (await fetch('import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await f.text() })).json(); toast(j.ok ? t('gr_imported_n', { n: j.n }) : t('gr_import_bad')); listLoad(); } catch (x) { toast(t('gr_import_bad')); }
  };
  document.getElementById('veragain').onclick = verOpen;
  initQt(); initTxt();
}
/* ---------- Anlagen (frei): an Notizen hängen, ansehen, herunterladen; Papierkorb statt Löschen ---------- */
const ATT = { pend: [], st: null, note: null };
const ATT_KINDS = ['pdf', 'txt', 'text', 'log', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'docx', 'odt', 'eml'];
const fSize = n => n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', lang === 'de' ? ',' : '.') + ' MB' : Math.max(1, Math.round((n || 0) / 1024)) + ' KB';
const attIcon = k => ({ pdf: '📄', jpg: '🖼', png: '🖼', heic: '🖼', txt: '📝', eml: '✉', docx: '📃', odt: '📃' }[k] || '📎');
const attExt = n => (String(n || '').split('.').pop() || '').toLowerCase();
function attErr(r, name) {
  const e = (r && r.error) || 'x', m = fSize((r && r.max) || ((ST.att || {}).max_file) || 0);
  return t({ kind: 'gr_att_err_kind', 'too big': 'gr_att_err_big', full: 'gr_att_err_full', type: 'gr_att_err_type' }[e] || 'gr_att_err_x', { n: name, m });
}
function attPick(files) {                               // im Erfassen-Bereich vormerken, hochgeladen wird beim Speichern
  const max = (ST.att || {}).max_file || 25 * 1048576;
  for (const f of files) {
    if (!ATT_KINDS.includes(attExt(f.name))) { toast(attErr({ error: 'kind' }, f.name), 6000); continue; }
    if (f.size > max) { toast(attErr({ error: 'too big', max }, f.name), 6000); continue; }
    ATT.pend.push({ f, desc: '' });
  }
  fnpStart(); attPendDraw();
}
function attPendDraw() {
  const box = $('fnpatts'); if (!box) return;
  const cur = (FNP.edit && FNP.edit.att) || [];
  box.hidden = !ATT.pend.length && !cur.length;
  box.innerHTML = cur.map(a => `<div class="attp"><button type="button" class="linkbtn" data-v="${esc(a.id)}">${attIcon(a.kind)} ${esc(a.name)}</button><small>${esc(fSize(a.size))}</small><span class="grow"></span><button type="button" class="icon sm" data-x="${esc(a.id)}" aria-label="${esc(t('gr_att_rm', { n: a.name }))}" title="${esc(t('gr_att_rm', { n: a.name }))}">🗑</button></div>`).join('')
    + ATT.pend.map((p, i) => `<div class="attp pend"><span>${attIcon(attExt(p.f.name).replace('jpeg', 'jpg'))} ${esc(p.f.name)}</span><small>${esc(fSize(p.f.size))} · ${esc(t('gr_att_pend'))}</small><input type="text" maxlength="300" data-d="${i}" value="${esc(p.desc)}" placeholder="${esc(t('gr_att_desc_ph'))}" aria-label="${esc(t('gr_att_desc') + ': ' + p.f.name)}"><button type="button" class="icon sm" data-r="${i}" aria-label="${esc(t('gr_att_x'))}" title="${esc(t('gr_att_x'))}">✕</button></div>`).join('');
  box.querySelectorAll('[data-d]').forEach(x => x.oninput = () => { ATT.pend[+x.dataset.d].desc = x.value; });
  box.querySelectorAll('[data-r]').forEach(x => x.onclick = () => { ATT.pend.splice(+x.dataset.r, 1); attPendDraw(); });
  box.querySelectorAll('[data-v]').forEach(x => x.onclick = () => { const a = cur.find(y => y.id === x.dataset.v); if (a) prevOpen(a); });
  box.querySelectorAll('[data-x]').forEach(x => x.onclick = async () => {
    const a = cur.find(y => y.id === x.dataset.x); if (!a || !confirm(t('gr_att_del_q', { n: a.name }))) return;
    const r = await post('file', { action: 'del', id: a.id }).catch(() => ({}));
    if (r.ok) { FNP.edit.att = cur.filter(y => y.id !== a.id); attPendDraw(); listLoad(); }
  });
}
async function attUpload(f, desc, notes) {
  const u = 'upload?name=' + encodeURIComponent(f.name) + '&desc=' + encodeURIComponent(desc || '') + '&note=' + encodeURIComponent((notes || []).join(',')) + '&mtime=' + (f.lastModified || '');
  try { return await (await fetch(u, { method: 'POST', body: f })).json(); } catch (e) { return { ok: false, error: 'x' }; }
}
async function attUploadAll(items, notes, msgEl) {      // nacheinander hochladen, Fehler je Datei melden
  let ok = 0;
  for (const p of items) {
    if (msgEl) { msgEl.className = 'msg'; msgEl.textContent = t('gr_att_upl', { n: p.f.name }); }
    const r = await attUpload(p.f, p.desc, notes);
    if (r.ok) ok++; else toast(attErr(r, p.f.name), 7000);
  }
  return ok;
}
async function attOpen(noteId) {
  ATT.note = noteId || null;
  const d = document.getElementById('attdlg'); if (!d.open) d.showModal();
  await attLoad();
}
async function attLoad() {
  try { ATT.st = await (await fetch('files', { cache: 'no-store' })).json(); } catch (e) { ATT.st = { files: [], trash: [] }; }
  attDraw();
}
function attNotesTxt(a) { const n = (a.notes || []).length; return n === 0 ? t('gr_att_n0') : n === 1 ? t('gr_att_n1') : t('gr_att_nn', { n }); }
function attRow(a, trash) {
  const info = t('gr_att_info', { s: fSize(a.size), t: fIso(a.up), n: attNotesTxt(a) }) + (a.txt ? ' · ' + t('gr_att_txt') : '');
  return `<div class="histrow attrow" data-id="${esc(a.id)}"><span class="grow"><b>${attIcon(a.kind)} ${esc(a.name)}</b><small>${esc(info)}</small><small class="hash">${esc(t('gr_att_hash', { h: a.sha256 }))}</small>
    ${trash ? `<small>${esc(t('gr_deleted_at', { t: fIso(a.del) }))}</small>` : `<input type="text" class="attdesc" maxlength="300" value="${esc(a.desc || '')}" placeholder="${esc(t('gr_att_desc_ph'))}" aria-label="${esc(t('gr_att_desc') + ': ' + a.name)}">`}</span>
    <span class="attacts">${trash ? `<button type="button" class="btn" data-a="restore">${esc(t('gr_restore'))}</button>` : `<button type="button" class="btn" data-a="view">${esc(t('gr_att_view'))}</button><button type="button" class="btn" data-a="scan">${esc(t('gr_att_scan'))}</button><button type="button" class="icon sm" data-a="del" aria-label="${esc(t('gr_att_del') + ': ' + a.name)}" title="${esc(t('gr_att_del'))}">🗑</button>`}</span></div>`;
}
function attDraw() {
  const s = ATT.st || {}, n = ATT.note, note = n ? LST.all.find(x => x.id === n) : null;
  const fs = (s.files || []).filter(a => !n || (a.notes || []).includes(n));
  document.getElementById('attuse').textContent = t('gr_att_use', { u: fSize(s.used || 0), m: fSize(s.max_total || 0) });
  const fo = document.getElementById('attfor'); fo.hidden = !n;
  fo.innerHTML = n ? `${esc(t('gr_att_for', { t: note ? fDate(note.a) + (note.notime ? '' : ' ' + fTime(note.a)) : '–' }))} <button type="button" class="linkbtn" id="attallb">${esc(t('gr_att_all'))}</button>` : '';
  const ab = document.getElementById('attallb'); if (ab) ab.onclick = () => { ATT.note = null; attDraw(); };
  const box = document.getElementById('attlist');
  box.innerHTML = fs.length ? fs.map(a => attRow(a)).join('') : `<p class="hint">${esc(t('gr_att_none'))}</p>`;
  const tr = document.getElementById('atttrash'), tl = s.trash || [];
  tr.innerHTML = tl.length ? tl.map(a => attRow(a, true)).join('') : `<p class="hint">${esc(t('gr_att_trash_empty'))}</p>`;
  const tl_ = s.tools || {}, hint = [];
  if (!tl_.pdftotext) hint.push(t('gr_att_nopdf'));
  if (!tl_.tesseract) hint.push(t('gr_att_noocr')); else hint.push(t('gr_att_ocr_ok', { l: (tl_.langs || []).join(', ') || '–' }));
  document.getElementById('atttools').textContent = hint.join(' ');
  for (const root of [box, tr]) root.querySelectorAll('.attrow').forEach(r => {
    const a = (s.files || []).concat(s.trash || []).find(x => x.id === r.dataset.id); if (!a) return;
    const de = r.querySelector('.attdesc'); if (de) de.onchange = () => post('file', { action: 'desc', id: a.id, desc: de.value }).then(j => { if (j.ok) a.desc = j.file.desc; });
    r.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      const act = b.dataset.a;
      if (act === 'view') return prevOpen(a);
      if (act === 'scan') return docOpen(a);
      if (act === 'del' && !confirm(t('gr_att_del_q', { n: a.name }))) return;
      const j = await post('file', { action: act, id: a.id }).catch(() => ({}));
      if (j.ok) { await attLoad(); listLoad(); }
    });
  });
}
function prevOpen(a) {
  const d = document.getElementById('prevdlg'), box = document.getElementById('prevbox'), u = 'file?id=' + encodeURIComponent(a.id);
  document.getElementById('prevttl').textContent = a.name;
  box.innerHTML = a.kind === 'jpg' || a.kind === 'png' ? `<img src="${u}&inline=1" alt="${esc(a.desc || a.name)}">`
    : a.kind === 'pdf' || a.kind === 'txt' || a.kind === 'eml' ? `<iframe src="${u}&inline=1" title="${esc(a.name)}"></iframe>` : `<p class="hint">${esc(t('gr_att_noprev'))}</p>`;
  document.getElementById('previnfo').textContent = [fSize(a.size), a.desc || '', t('gr_att_hash', { h: a.sha256 || '' })].filter(Boolean).join(' · ');
  const dl = document.getElementById('prevdl'); dl.href = u; dl.setAttribute('download', a.name);
  const tx = document.getElementById('prevtxt'); tx.hidden = !a.txt; tx.href = u + '&txt=1';
  if (!d.open) d.showModal();
}
function initAtt() {
  const coarse = matchMedia('(pointer:coarse)').matches;
  $('fnpatt').onclick = () => document.getElementById('attf').click();
  $('fnpcam').hidden = !coarse; $('fnpcam').onclick = () => { ATT.camFor = 'fnp'; document.getElementById('attcam').click(); };
  document.getElementById('attupcam').hidden = !coarse;
  document.getElementById('attupcam').onclick = () => { ATT.camFor = 'dlg'; document.getElementById('attcam').click(); };
  document.getElementById('attup').onclick = () => { ATT.upDlg = true; document.getElementById('attf').click(); };
  const take = async (files, toDlg) => {
    if (!toDlg) { attPick(files); return; }
    const m = document.getElementById('attmsg'), n = await attUploadAll(files.map(f => ({ f, desc: '' })), ATT.note ? [ATT.note] : [], m);
    m.textContent = n ? '✓ ' + t('gr_att_upok', { n }) : ''; await attLoad(); listLoad();
  };
  document.getElementById('attf').onchange = e => { const fs = [...e.target.files]; e.target.value = ''; const dlg = !!ATT.upDlg; ATT.upDlg = false; if (fs.length) take(fs, dlg); };
  document.getElementById('attcam').onchange = e => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) take(fs, ATT.camFor === 'dlg'); };
}
/* ---------- Notizen aus einem Dokument vorschlagen: erkennen (offline), prüfen, ändern, übernehmen ---------- */
const DOC = { a: null, res: null, timer: 0 };
const docErr = e => { const k = 'gr_doc_e_' + String(e || 'x').replace(/\W/g, '_'), v = t(k); return v === k ? t('gr_doc_e_x') : v; };
async function docOpen(a, again) {
  DOC.a = a; DOC.res = null; clearTimeout(DOC.timer);
  const d = document.getElementById('docdlg'); if (!d.open) d.showModal();
  document.getElementById('docinfo').textContent = a.name; document.getElementById('doclist').innerHTML = ''; document.getElementById('docbar').hidden = true;
  document.getElementById('docgo').disabled = true; document.getElementById('docagain').hidden = true;
  const st = document.getElementById('docst'); st.className = 'msg'; st.textContent = t('gr_doc_run');
  const r = await post('scan', { id: a.id, again: !!again }).catch(() => ({ ok: false }));
  if (!r.ok) { st.className = 'msg err'; st.textContent = t('gr_doc_err', { e: docErr(r.error) }); return; }
  docPoll(r);
}
async function docPoll(r) {
  const st = document.getElementById('docst'), d = document.getElementById('docdlg');
  if (!d.open) return;
  if (!r || r.state === 'run' || r.state === undefined) {
    DOC.timer = setTimeout(async () => { let j; try { j = await (await fetch('scan?id=' + encodeURIComponent(DOC.a.id), { cache: 'no-store' })).json(); } catch (e) { j = null; } docPoll(j); }, 1500);
    return;
  }
  document.getElementById('docagain').hidden = false;
  if (r.state === 'err' || !r.ok) { st.className = 'msg err'; st.textContent = t('gr_doc_err', { e: docErr(r.error) + (r.error === 'tool' && r.detail ? ' ' + r.detail : '') }); return; }
  if (r.state === 'none') { st.textContent = ''; return; }
  DOC.res = r; docDraw();
}
function docDraw() {
  const r = DOC.res, st = document.getElementById('docst'), box = document.getElementById('doclist');
  const m = t('gr_m_' + String(r.method || 'text').replace('+', '')) + (r.pages > 1 ? ', ' + t('gr_m_pages', { n: r.pages }) : '');
  document.getElementById('docinfo').textContent = t(r.doc_date_known ? 'gr_doc_info' : 'gr_doc_info_u', { n: r.name, m, d: fDate(Date.parse(r.doc_date)) });
  const sg = r.suggestions || [];
  if (!sg.length) { st.className = 'msg'; st.textContent = t('gr_doc_empty'); box.innerHTML = ''; return; }
  document.getElementById('docbar').hidden = false;
  box.innerHTML = sg.map(s => {
    const on = !s.dup && s.dup_of == null && s.conf !== 'unklar', pos = t('gr_doc_pos', { p: s.page, l: s.line });
    return `<div class="docrow${on ? ' on' : ''}" data-i="${s.i}">
      <div class="dochead"><label class="check"><input type="checkbox" class="dsel"${on ? ' checked' : ''} aria-label="${esc(t('gr_doc_pick', { p: pos }))}"> <b>${esc(pos)}</b></label>
        <span class="conf c-${s.conf}">${esc(t('gr_doc_c_' + s.conf))}</span>${s.date_only ? `<span class="conf c-day">${esc(t('gr_doc_day'))}</span>` : ''}${s.dup ? `<span class="conf c-dup">${esc(t('gr_doc_dup'))}</span>` : s.dup_of != null ? `<span class="conf c-dup">${esc(t('gr_doc_dup2'))}</span>` : ''}</div>
      <div class="row wrap"><label class="field inl"><span>${esc(t('per_from'))}</span><input type="datetime-local" step="1" class="dfrom" value="${esc(dtl(new Date(s.from)))}"></label>
        <label class="field inl"><span>${esc(t('per_to'))}</span><input type="datetime-local" step="1" class="dto" value="${s.to ? esc(dtl(new Date(s.to))) : ''}"></label></div>
      <textarea rows="2" maxlength="500" class="dtext" aria-label="${esc(t('gr_doc_text'))}">${esc(s.text)}</textarea>
      <div class="mks dtags">${(s.tags || []).map(k => `<button type="button" class="tag ${gAttr(ntGroup(k)).replace('"', ' on"')} data-t="${esc(k)}" aria-pressed="true">${esc(ntLabel(k))}</button>`).join('')}</div>
      <input type="text" class="dwit" maxlength="200" value="${esc(s.witness || '')}" placeholder="${esc(t('fn_wit'))}" aria-label="${esc(t('gr_doc_wit'))}">
      <small class="ctx">${esc(t('gr_doc_ctx'))}: „${esc(s.sentence)}“</small></div>`;
  }).join('') + (r.more ? `<p class="hint">${esc(t('gr_doc_more', { n: r.more }))}</p>` : '');
  box.querySelectorAll('.docrow').forEach(row => {
    row.querySelector('.dsel').onchange = e => { row.classList.toggle('on', e.target.checked); docCount(); };
    row.querySelectorAll('.dtags .tag').forEach(b => b.onclick = () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); });
  });
  const go = document.getElementById('docgo'); go.textContent = PRO() ? t('gr_doc_go') : t('gr_doc_go_pro'); go.title = PRO() ? '' : t('gr_doc_pro');
  docCount();
}
function docCount() {
  const rows = [...document.querySelectorAll('#doclist .docrow')], k = rows.filter(r => r.querySelector('.dsel').checked).length;
  document.getElementById('docst').className = 'msg'; document.getElementById('docst').textContent = t('gr_doc_found', { n: rows.length, k }) + (PRO() ? '' : ' ' + t('gr_doc_pro'));
  document.getElementById('doccnt').textContent = k + ' / ' + rows.length;
  document.getElementById('docgo').disabled = !k;
}
async function docApply() {
  if (!PRO()) { proOpen(); return; }
  const sg = new Map((DOC.res.suggestions || []).map(s => [String(s.i), s])), items = [];
  for (const row of document.querySelectorAll('#doclist .docrow')) {
    if (!row.querySelector('.dsel').checked) continue;
    const s = sg.get(row.dataset.i), f = row.querySelector('.dfrom').value, to = row.querySelector('.dto').value;
    items.push({ i: s.i, from: f ? inIso(f, s.from) : s.from, to: to ? inIso(to, s.to) : '', text: row.querySelector('.dtext').value, witness: row.querySelector('.dwit').value,
      tags: [...row.querySelectorAll('.dtags .tag[aria-pressed="true"]')].map(b => b.dataset.t), page: s.page, line: s.line, conf: s.conf, date_only: !!s.date_only && f === dtl(new Date(s.from)) });
  }
  const r = await post('doc_apply', { id: DOC.a.id, items }).catch(() => ({ ok: false }));
  if (!r.ok) { const st = document.getElementById('docst'); st.className = 'msg err'; st.textContent = r.error === 'pro' ? t('gr_doc_pro') : t('saveerr'); return; }
  toast('✓ ' + t('gr_doc_done', { n: r.n }), 5000); document.getElementById('docdlg').close(); listLoad(); if (document.getElementById('attdlg').open) attLoad();
}
function initDoc() {
  const sel = on => { document.querySelectorAll('#doclist .docrow').forEach(r => { r.querySelector('.dsel').checked = on; r.classList.toggle('on', on); }); docCount(); };
  document.getElementById('docall').onclick = () => sel(true); document.getElementById('docnone').onclick = () => sel(false);
  document.getElementById('docgo').onclick = docApply;
  document.getElementById('docagain').onclick = () => DOC.a && docOpen(DOC.a, true);
  document.getElementById('docdlg').addEventListener('close', () => clearTimeout(DOC.timer));
}
/* ---------- Anbindung an die gemeinsame Erfassung (erfassung.js) ---------- */
const GR_WIT = '<div id="fnpwitl" class="witlist"></div><div id="fnpwitx" class="witx" hidden><select id="fnpwrole" data-ia="gr_w_role"></select><input type="text" id="fnpwcon" maxlength="120" data-iph="gr_w_con_ph" data-ia="gr_w_con"></div>';
const GR_MORE = `
        <div id="moreold">
        <div class="moregrid">
          <label class="field"><span data-i="gr_x_freq"></span><input type="text" id="xfreq" maxlength="80" data-iph="gr_x_freq_ph"></label>
          <div class="field"><label class="check"><input type="checkbox" id="xpol"> <span data-i="gr_x_pol"></span></label><input type="text" id="xpolnr" maxlength="40" data-iph="gr_x_polnr" data-ia="gr_x_polnr"></div>
          <div class="field"><span id="xrepl" data-i="gr_x_rep"></span><div class="row wrap"><select id="xrepto" aria-labelledby="xrepl"></select><input type="date" id="xrepdate" data-ia="gr_x_repdate"></div></div>
          <label class="field"><span data-i="gr_x_health"></span><textarea id="xhealth" rows="2" maxlength="300" data-iph="gr_x_health_ph"></textarea></label>
          <label class="field"><span data-i="gr_x_attest"></span><input type="text" id="xattest" maxlength="200" data-iph="gr_x_attest_ph"></label>
          <label class="check"><input type="checkbox" id="xthreat"> <span data-i="gr_x_threat"></span></label>
        </div>
        </div>
        <p class="hint" data-i="gr_x_lvl_h"></p>
        <div class="tipslot" data-tips="5,6"></div>`;
let WSLOT = null;
function erfassungSetup() {
  E.setup({
    name: 'GReport', t, lang: () => lang, toast, now: nowMs, fTime: ms => fTime(ms), fDate: ms => fDate(ms),
    secs: ['txt', 'tags', 'wit', 'more', 'time'], viewOpts: ['width', 'dens', 'tipmode'],
    ui: { witExtra: GR_WIT, witMax: 200, more: GR_MORE, att: true, tips: true, tplFirst: true },
    layout: {                                          // Überschrift, Reihenfolge, Darstellung, Ansicht „abgedockt“, Schnell-Schalter: Einstellungen (prefs);
      get: () => ({ title: PF.cap_title, sub: PF.cap_sub, order: PF.cap_order, width: PF.width, dens: PF.dens, pop: PF.pop, sechide: PF.sechide, sechide_pop: PF.sechide_pop }),
      saveFb: async fb => { const j = await post('felder', Object.assign({ action: 'set' }, fb)); if (j.ok) Felder.load(j); return j; },   // Felder, Bereiche (auch ausgeblendet), Arten: felder.json
      save: async pf => {
        const o = { cap_title: pf.title, cap_sub: pf.sub }; for (const [a, b] of [['order', 'cap_order'], ['width', 'width'], ['tipmode', 'tipmode'], ['dens', 'dens'], ['pop', 'pop']]) if (a in pf) o[b] = pf[a];
        const j = await post('prefs', o); if (j.ok) { delete j.ok; PF = j; } return true;
      },
      saveQuick: (key, list) => { PF[key] = list; return post('prefs', { [key]: list }).then(j => { if (j.ok) { delete j.ok; PF = j; return true; } return false; }); },
      reset: async () => {
        const p = await post('prefs', { cap_title: '', cap_sub: '', cap_order: [], width: 'wide', dens: 'normal', pop: null }); if (p.ok) { delete p.ok; PF = p; }   // abgedockt folgt wieder
        const f = await post('felder', { action: 'set', sec: {} }); if (f.ok) Felder.load(f);      // eigene Felder bleiben, eingebaute Bereiche wie geliefert
        return true;
      }
    },
    saveNote: body => post('note', body),
    tagsChanged: () => listDraw(), list: () => listDraw(), stats: () => statsDraw(), onSaved: () => listLoad(),
    tips: root => tipsDraw(root), tipMode: () => tipMode(), tipModeApply: () => tipModeApply(),
    witSlot: (box, body) => { const ws = WSLOT || (WSLOT = body.ownerDocument.querySelector('.tipslot[data-tips="4"]')); if (ws) { box.appendChild(ws); box.classList.remove('tipanchor'); tipDock(ws); } },   // Hinweis zum Zeugen am Zeugen-Feld
    extOld, extFill: x => extFill(x), persons: () => PRO() ? ST.persons || [] : [], personsInfo: () => ST.persons_info || {},
    onPop: () => applyTheme(), width: w => widthApply(w), autosave: () => +(PF.autosave || 0), manage: () => qtOpen(),
    afterTpl: j => { if (j.prefs) PF = j.prefs; },
    att: { pending: () => ATT.pend.slice(), reset: () => { ATT.pend = []; attPendDraw(); }, draw: () => attPendDraw(), upload: (items, id, msg) => attUploadAll(items, [id], msg) }
  });
  E.mount(document.getElementById('fnpanel'));
}
/* ---------- Start ---------- */
async function init() {
  Felder.setup({ t, esc, lang: () => lang, fmtDT: ms => fDate(ms) + ' ' + fTime(ms, Object.assign({}, PF, { time: PF.time === 'hms' ? 'hm' : PF.time })), dtl, dto, nowMs });
  Felder.S.foldOK = true;                             // GReport hat die Klappe „Mehr“ für eingeklappte Felder
  erfassungSetup();
  await stLoad(); tr(); applyTheme(); E.refresh();                  // Einstellungen geladen: Überschrift, Abschnitte, Ansicht
  document.getElementById('themebtn').onclick = () => { THEME = THEME === 'auto' ? 'light' : THEME === 'light' ? 'dark' : 'auto'; try { localStorage.setItem('gr_theme', THEME); } catch (e) { } applyTheme(); };
  setInterval(() => { if (THEME === 'auto') applyTheme(); }, 4000);
  document.getElementById('grmenu').onclick = e => { e.stopPropagation(); menu(); };
  document.getElementById('helpbtn').onclick = helpOpen;
  document.addEventListener('click', e => { const m = document.getElementById('grmenul'); if (!m.hidden && !e.target.closest('#grmenul')) m.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.getElementById('grmenul').hidden = true; });
  let qt = 0; document.getElementById('grq').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { LST.q = e.target.value; listDraw(); }, 200); });
  initDialogs(); extInit(); initAtt(); initDoc(); initList(); await fbLoad(); await ntsLoad(); listLoad(); tipsDraw();
  setInterval(() => { if (!document.hidden) { stLoad(); if (!FNP.edit) listLoad(); } }, 30000);   // z. B. neue Notiz aus Home Assistant
}
init();
