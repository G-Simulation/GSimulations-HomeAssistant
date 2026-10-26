/* Lärmprotokoll / Noise Log – Oberfläche */
(function () {
'use strict';

/* ================= Grundlagen ================= */
let FNPOP = null;                                    // Fenster, in das der Notizbereich abgedockt ist (Pro)
const $ = id => document.getElementById(id) || (FNPOP && !FNPOP.closed ? FNPOP.document.getElementById(id) : null);
const popOn = () => !!(FNPOP && !FNPOP.closed);
const popDoc = () => popOn() ? FNPOP.document : null;
/* Fenster, in dem der Notizbereich gerade steht: Rückfragen und Animation dort (im Bild-im-Bild-Fenster in der Seite) */
const pwin = () => { const p = $('fnpanel'), w = p && p.ownerDocument.defaultView; return w && w !== window && !(window.documentPictureInPicture && documentPictureInPicture.window === w) ? w : window; };
const DPR = () => window.devicePixelRatio || 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad = n => String(n).padStart(2, '0');
const hms = ms => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const numTxt = x => { x = String(x).replace('-', '−'); return typeof lang !== 'undefined' && lang === 'en' ? x : x.replace('.', ','); };   // deutsche Schreibweise „−70,7“
const f1 = v => v == null || v === '' || !isFinite(+v) ? '–' : numTxt((+v).toFixed(1));
const f2 = v => v == null || v === '' || !isFinite(+v) ? '–' : numTxt((+v).toFixed(2));
const fdb = v => v == null || v === '' || !isFinite(+v) ? (v || '–') : numTxt(String(v));   // Werte aus der Liste (Text) wie gespeichert, nur anders geschrieben
const fmtDur = v => { const x = parseFloat(v); return isNaN(x) ? '–' : numTxt(x < 10 ? x.toFixed(2) : x.toFixed(1)) + ' s'; };

let lang = 'de';
function pickLang(s) { lang = (s && s !== 'auto') ? s : ((navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en'); }
function t(k, v) {
  let s = (I18N[lang] || I18N.de)[k];
  if (s === undefined) s = I18N.de[k];
  if (s === undefined) return k;
  if (v) { s = s.replace(/\{(\w+)\|([^|}]*)\|([^}]*)\}/g, (m, x, one, more) => x in v ? (+v[x] === 1 ? one : more) : m);   // ab 1.85.32: {n|Beispiel|Beispiele}
    for (const x in v) s = s.split('{' + x + '}').join(v[x]); }
  return s;
}
function tr() {
  document.documentElement.lang = lang;
  document.title = t('title');
  document.querySelectorAll('[data-i]').forEach(e => { e.textContent = t(e.dataset.i); });
  document.querySelectorAll('[data-ia]').forEach(e => { e.title = t(e.dataset.ia); e.setAttribute('aria-label', t(e.dataset.ia)); });
  document.querySelectorAll('[data-iph]').forEach(e => { e.placeholder = t(e.dataset.iph); });
  { const b = $('themebtn'); if (b) { b.textContent = (THEME === 'auto' ? '🌓 ' : THEME === 'dark' ? '🌙 ' : '☀ ') + t('th_' + THEME); b.title = t('th_tip'); } }   // nach Sprachwechsel
  if (matchMedia('(pointer: coarse)').matches && $('livenote')) $('livenote').textContent = t('livenote_touch');   // Handy: passende Bedienhinweise
  if (matchMedia('(pointer: coarse)').matches && $('dthint')) $('dthint').textContent = t('dt_hint_touch');
  let seen = true; try { seen = !!localStorage.getItem('laerm_help'); localStorage.setItem('laerm_help', '1'); } catch (e) { }
  if (!seen) document.querySelectorAll('details.hlp').forEach(x => { x.open = true; });     // beim ersten Besuch offen, danach zugeklappt
}

/* Hinweis "sehr leise" wegklickbar (gilt fuer diese Sitzung im Browser) */
const BOFF = new Set((() => { try { return JSON.parse(sessionStorage.getItem('laerm_boff') || '[]'); } catch (e) { return []; } })());
const BX = () => `<button class="bclose" type="button" aria-label="${esc(t('a_close'))}" title="${esc(t('a_close'))}">✕</button>`;
document.addEventListener('click', e => { const b = e.target.closest('.banner .bclose'); if (!b) return; const id = b.closest('.banner').id; BOFF.add(id); try { sessionStorage.setItem('laerm_boff', JSON.stringify([...BOFF])); } catch (x) { } $(id).style.display = 'none'; });
/* Kopfzeile auf dem Handy: Stoppen und Design wandern ins Menue "⋯" */
const MOBILE = matchMedia('(max-width: 600px)');
function placeHeader() {
  const m = $('hmenu'), hd = document.querySelector('header'), into = MOBILE.matches;
  for (const id of ['recbtn', 'themebtn', 'hbbtn']) { const b = $(id); if (into && b.parentNode !== m) m.appendChild(b); if (!into && b.parentNode === m) hd.insertBefore(b, $('sbtn')); }
  if (!into) m.hidden = true;
}
/* Handbuch (eigene Seite, Wiki) – an einer bestimmten Stelle öffnen */
function hbOpen(at) { const th = document.documentElement.getAttribute('data-theme') || ''; const w = window.open('handbuch.html?lang=' + lang + (th ? '&theme=' + th : '') + '#' + (at || ''), 'gaslighter_hb'); if (w) w.focus(); }
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-hb]'); if (!a) return; e.preventDefault(); e.stopPropagation(); hbOpen(a.dataset.hb); });
const HB_SEC = { s_pro: 'pro', s_thr: 'einstellungen/s_thr', s_time: 'einstellungen/s_time', s_ha: 'home-assistant/regeln', habox: 'home-assistant/regeln', s_hadash: 'home-assistant/dashboard', hdbox: 'home-assistant/dashboard', s_sched: 'einstellungen/s_sched', schedbox: 'einstellungen/s_sched',
  s_notes: 'einstellungen/s_notes', s_quiet: 'einstellungen/s_notes', s_ki: 'ki', s_place: 'einstellungen/s_place', s_keep: 'einstellungen/s_keep', s_list: 'einstellungen/s_list', s_rec: 'einstellungen/s_rec', s_wav: 'einstellungen/s_wav', s_video: 'einstellungen/s_video', s_misc: 'einstellungen/s_misc', s_greport: 'einstellungen/s_greport', s_audio: 'einstellungen/s_audio',
  srcbox: 'geraete', srcbox1: 'geraete/karte', calbox: 'geraete/einpegeln', s_cal: 'geraete/einpegeln', pfbox: 'ki/tonprofile', s_prof: 'ki/tonprofile', s_muster: 'einstellungen/muster', mfbox: 'einstellungen/muster', bkbox: 'sicherung', s_backup: 'sicherung', s_mirror: 'sicherung/ziel',
  rsbox: 'sicherung/zuruecksetzen', s_reset: 'sicherung/zuruecksetzen', diagset: 'fehlerbehebung', s_diag: 'fehlerbehebung' };
function toggleHMenu(e) {
  e.stopPropagation(); const m = $('hmenu'); m.hidden = !m.hidden;
  if (!m.hidden) { const r = $('hmore').getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.right = Math.max(8, innerWidth - r.right) + 'px'; }
}
document.addEventListener('click', e => { const m = $('hmenu'); if (m && !m.hidden && !e.target.closest('#hmenu,#hmore')) m.hidden = true; });
/* Datum/Uhrzeit lesbar: "So 04.10. 12:25:20" */
function fmtDay(ds) {
  const d = new Date(ds + 'T12:00:00'); if (isNaN(d)) return ds;
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(',', '');
}
/* Nachweis: Abstand der Spitze zum lautesten Pegel der Zeit davor (ohne Störungen), z. B. laufender Fernseher */
function preInfo(g, pk) {
  if (!g || g.pre_max == null || !g.pre_s || isNaN(pk)) return [];
  const s = g.pre_s, w = s >= 60 ? Math.round(s / 60) + ' min' : s + ' s', d = pk - g.pre_max;
  return [[t(d > 0 ? 'pre_col' : 'pre_col_lt'), (d > 0 ? '+' + numTxt(d.toFixed(1)) : numTxt((-d).toFixed(1))) + ' dB · ' + w, t(d > 0 ? 'pre_tip' : 'pre_tip_no', { w, m: g.pre_max.toFixed(1), d: d.toFixed(1) })]];
}
function fmtWhen(iso) {
  const d = new Date(iso); if (isNaN(d)) return String(iso || '').replace('T', ' ');
  const L = lang === 'en' ? 'en-GB' : 'de-DE';
  return d.toLocaleDateString(L, { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(',', '') + ' ' + d.toLocaleTimeString(L, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
/* Design: Auto (folgt Home Assistant, sonst dem Browser), Hell, Dunkel */
let THEME = 'auto'; try { THEME = localStorage.getItem('laerm_theme') || 'auto'; } catch (e) { }
function haDark() {          // Ingress laeuft im selben Ursprung wie Home Assistant: dessen Design laesst sich auslesen
  try {
    const p = window.parent; if (!p || p === window) return null;
    const ha = p.document.querySelector('home-assistant'), d = ha && ha.hass && ha.hass.themes && ha.hass.themes.darkMode;
    return typeof d === 'boolean' ? d : null;
  } catch (e) { return null; }
}
function applyTheme() {
  let res = THEME === 'light' || THEME === 'dark' ? THEME : null;
  if (!res) { const h = haDark(); if (h !== null) res = h ? 'dark' : 'light'; }
  const r = document.documentElement, was = r.getAttribute('data-theme');
  if (res) r.setAttribute('data-theme', res); else r.removeAttribute('data-theme');
  const pd = typeof FNPOP !== 'undefined' && FNPOP && !FNPOP.closed ? FNPOP.document.documentElement : null;   // abgedocktes Fenster mitziehen
  if (pd) { if (res) pd.setAttribute('data-theme', res); else pd.removeAttribute('data-theme'); }
  const b = $('themebtn');
  if (b) { b.textContent = (THEME === 'auto' ? '🌓 ' : THEME === 'dark' ? '🌙 ' : '☀ ') + t('th_' + THEME); b.title = t('th_tip'); }
  if (was !== res) { readColors(); if (typeof NV !== 'undefined' && NV.open) drawNight(); }
}
let C = {};
function readColors() {
  try { readNC(); } catch (e) { }
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  C = { tx: g('--tx'), mut: g('--mut'), bd: g('--bd'), grid: g('--grid'), acc: g('--acc'), thr: g('--thr'), bgl: g('--bgl'), red: g('--red'), pv: g('--pv'), card: g('--card') };
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);

function fit(c) {
  const r = DPR(), w = Math.round(c.clientWidth * r), h = Math.round(c.clientHeight * r);
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
}

/* ================= Daten ================= */
const MAXR = 6000, RING = 6000, NB = 32, DELAY = 350;
let recs = [];            // {s, ts, l, b, t, a, w:Int16Array(20), sp:Uint8Array(32)}
let lastSeq = -1, firstAvail = 0, boot = null, st = null, off = 0, offInit = false, CUR = null, bands = [];
let lastCount = -1, lastOk = 0;
let selSrc = 'main', SOURCES = [], PHONE = { port: null, ip: null, tls: false, tls_error: '', ffmpeg: true };

function decode(r) {
  const wb = atob(r[6]), sb = atob(r[7]);
  const nw = Math.min(30, wb.length >> 1), w = new Int16Array(30);   // 20 Min/Max + 10 Effektivwerte (ab 1.7.1)
  for (let i = 0; i < nw; i++) { let v = wb.charCodeAt(2 * i) | (wb.charCodeAt(2 * i + 1) << 8); if (v > 32767) v -= 65536; w[i] = v; }
  const sp = new Uint8Array(NB);
  for (let i = 0; i < NB && i < sb.length; i++) sp[i] = sb.charCodeAt(i);
  return { s: r[0], ts: r[1], l: r[2], b: r[3], t: r[4], a: r[5], w, sp };
}
function lowerBound(ts) { let lo = 0, hi = recs.length; while (lo < hi) { const m = (lo + hi) >> 1; if (recs[m].ts < ts) lo = m + 1; else hi = m; } return lo; }

function resetData() { recs = []; lastSeq = -1; firstAvail = 0; clearRing(); }

async function poll() {
  let again = false;
  try {
    const want = selSrc;
    const res = await fetch((lastSeq < 0 ? 'data?limit=1200' : 'data?since=' + lastSeq) + '&src=' + encodeURIComponent(want), { cache: 'no-store' });
    const j = await res.json();
    if (want !== selSrc || j.src !== selSrc) throw new Error('source switched');   // Antwort einer alten Quelle verwerfen
    if (boot !== null && j.boot !== boot) resetData();          // Add-on wurde neu gestartet
    boot = j.boot;
    const o = j.now - Date.now();
    off = offInit ? off + clamp((o - off) * 0.05, -5, 5) : o; offInit = true;   // Uhrabgleich ganz sanft (Netz-Schwankungen ließen die Anzeige ruckeln)
    firstAvail = j.first; st = j.st; lastOk = Date.now();
    if (st.bands && st.bands.length) bands = st.bands;
    if (j.r.length) {
      const nr = j.r.map(decode);
      if (recs.length && nr[0].s <= recs[recs.length - 1].s) {          // Ueberlappung entfernen
        const ls = recs[recs.length - 1].s; while (nr.length && nr[0].s <= ls) nr.shift();
      }
      for (const r of nr) { recs.push(r); specWrite(r); }
      if (recs.length > MAXR) recs.splice(0, recs.length - MAXR);
      if (nr.length) lastSeq = nr[nr.length - 1].s;
      again = j.r.length >= 1200 && j.last > lastSeq;
    } else if (lastSeq < 0 && j.last > 0) {
      lastSeq = j.last;
    }
    updateStatus();
  } catch (e) { /* naechster Versuch */ }
  setTimeout(poll, again ? 0 : (document.hidden || NV.open || PV.open ? 1000 : 250));
}

/* Wächter: kommen länger keine Daten (z. B. über Nacht die Anmeldung bei Home Assistant abgelaufen oder der Rechner schlief),
   wird geprüft, ob der Server antwortet. Antwortet er nicht mit Daten, sondern mit Anmeldeseite/Fehler, lädt die Seite neu. */
setInterval(async () => {
  if (document.hidden || !lastOk || Date.now() - lastOk < 30000) return;
  let bad = false;
  try {
    const r = await fetch('data?limit=1&src=' + encodeURIComponent(selSrc), { cache: 'no-store' });
    if (r.status === 401 || r.status === 403 || !(r.headers.get('content-type') || '').includes('json')) bad = true;
    else { resetData(); lastOk = Date.now(); }            // Server da: Live-Daten frisch holen
  } catch (e) { return; }                                // Server (noch) nicht erreichbar: weiter warten
  if (bad) {
    let last = 0; try { last = +sessionStorage.getItem('laerm_reload') || 0; } catch (e) { }
    if (Date.now() - last > 120000) { try { sessionStorage.setItem('laerm_reload', String(Date.now())); } catch (e) { } try { (window.top || window).location.reload(); } catch (e) { location.reload(); } }
  }
}, 10000);
document.addEventListener('visibilitychange', () => {    // Rechner/Tab wieder wach: sofort frische Daten
  if (!document.hidden && lastOk && Date.now() - lastOk > 30000) { resetData(); }
});
let loadingOld = false, lastOld = 0;
async function loadOlder() {
  if (loadingOld || !recs.length || recs[0].s <= firstAvail || recs.length >= MAXR || Date.now() - lastOld < 300) return;
  lastOld = Date.now();
  loadingOld = true;
  try {
    const want = selSrc;
    const j = await (await fetch('data?before=' + recs[0].s + '&limit=1200&src=' + encodeURIComponent(want), { cache: 'no-store' })).json();
    if (want !== selSrc || j.src !== selSrc) { loadingOld = false; return; }
    const nr = j.r.map(decode).filter(r => !recs.length || r.s < recs[0].s);
    if (nr.length) { recs = nr.concat(recs); nr.forEach(specWrite); if (recs.length > MAXR) recs.splice(0, recs.length - MAXR); }
  } catch (e) { }
  loadingOld = false;
}

/* ================= Ansicht ================= */
const SPANS = [10, 30, 60, 120, 300, 600];
const view = { live: true, end: 0, span: 60, mode: 'level' };
const yv = { auto: true, lo: -100, hi: -30 };
const wg = { auto: true, g: 50 };
let hoverX = null;

function nowServer() { return Date.now() + off; }
/* Live: Wiedergabe mit kleiner, sich anpassender Verzögerung. Die Messwerte kommen in Paketen; läuft die Anzeige schneller als
   die Daten, endet die Kurve vor dem rechten Rand und springt beim nächsten Paket nach (sieht aus, als ändere sie die Länge).
   Deshalb wird die Verzögerung so geführt, dass immer schon Daten bis zum Rand da sind – sanft, ohne Sprünge. */
const PLAY = { delay: DELAY, minLead: 1e9, t: 0 };
function playAdapt(dt) {
  if (!recs.length || !view.live) return;
  const lead = recs[recs.length - 1].ts - (nowServer() - PLAY.delay);       // so viel liegt schon bereit
  if (lead < 60) PLAY.delay = Math.min(4000, PLAY.delay + Math.min(dt * 0.25, 60 - lead));   // knapp: Anzeige etwas langsamer
  PLAY.minLead = Math.min(PLAY.minLead, lead);
  if (performance.now() - PLAY.t > 3000) {        // 3 s lang immer reichlich da: Verzögerung langsam verkleinern
    if (PLAY.minLead > 250) PLAY.delay = Math.max(DELAY, PLAY.delay - Math.min(100, (PLAY.minLead - 250) / 3));
    PLAY.minLead = 1e9; PLAY.t = performance.now();
  }
}
function viewRange() {
  if (view.live) view.end = nowServer() - PLAY.delay;
  return [view.end - view.span * 1000, view.end];
}
function setLive(on) {
  view.live = on;
  const b = $('livebtn'); b.classList.toggle('paused', !on);
  b.querySelector('b').textContent = t(on ? 'live' : 'paused');
  const g = $('cvbtns'); if (g) g.hidden = on;           // "Zurueck zu Live" / "Bereich pruefen" nur nach dem Zurueckblaettern
}
/* Aufzeichnung starten/stoppen */
let REC_PAUSED = null;
function syncRec(s) {
  const pz = !!(s && s.paused); REC_PAUSED = pz;
  const b = $('recbtn'); b.classList.toggle('off', pz);
  b.querySelector('span').textContent = t(pz ? 'rec_start' : 'rec_stop');
  b.title = t(pz ? 'rec_start_tip' : 'rec_stop_tip');
  const since = s && s.paused_since ? new Date(s.paused_since) : null;
  const until = s && s.paused_until ? new Date(s.paused_until) : null, L = lang === 'en' ? 'en-GB' : 'de-DE';
  const html = !pz ? '' : until && !isNaN(until)
    ? t('rec_banner_until', { u: until.toLocaleTimeString(L, { hour: '2-digit', minute: '2-digit' }), r: s.paused_reason ? ' (' + esc(s.paused_reason) + ')' : '' })
    : t('rec_banner', { t: since && !isNaN(since) ? since.toLocaleString(L, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '–' });
  const e = $('b_rec');
  e.style.display = pz ? 'block' : 'none'; if (e.innerHTML !== html) e.innerHTML = html;
}
/* Stoppen: fuer 15 min / 1 h / bis man wieder startet */
function recMenu() {
  let m = $('recmenu');
  if (!m) { m = el('div', { id: 'recmenu', className: 'hmenu recmenu' }); document.body.appendChild(m); document.addEventListener('click', e => { if (!m.hidden && !e.target.closest('#recmenu,#recbtn')) m.hidden = true; }); }
  let last = 30; try { last = +localStorage.getItem('laerm_pausemin') || 30; } catch (e) { }
  m.innerHTML = `<small>${esc(t('rec_menu_t'))}</small>` + [[15, t('rec_15')], [60, t('rec_60')], [180, t('rec_180')]].map(([n, l]) => `<button type="button" class="chip" data-m="${n}">${esc(l)}</button>`).join('') +
    `<div class="recrow"><span class="recin"><input type="number" id="recmin" min="1" max="1440" step="1" value="${last}" inputmode="numeric" aria-label="${esc(t('rec_min'))}"><span>${esc(t('rec_min'))}</span></span><button type="button" class="chip pri" id="recminok">OK</button></div>` +
    `<div class="recrow"><span class="recin"><span>${esc(t('rec_until'))}</span><input type="time" id="recuntil" aria-label="${esc(t('rec_until'))}"></span><button type="button" class="chip pri" id="recuntilok">OK</button></div>` +
    `<input type="text" id="recwhy" maxlength="80" placeholder="${esc(t('rec_reason'))}">` +
    `<button type="button" class="chip" data-m="0">${esc(t('rec_stop_open'))}</button>`;
  const go = async n => {
    m.hidden = true;
    try { const r = await (await fetch('pause', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes: n, reason: $('recwhy').value }) })).json(); if (st) Object.assign(st, { paused: r.paused, paused_since: r.since, paused_until: r.until, paused_reason: r.reason }); syncRec(st || {}); updateStatus(); } catch (e) { alert(t('saveerr')); }
  };
  m.querySelectorAll('button[data-m]').forEach(b => b.onclick = () => { const n = +b.dataset.m; if (n > 0) go(n); else { m.hidden = true; toggleRec(true); } });
  $('recminok').onclick = () => { const n = Math.round(+$('recmin').value); if (!(n >= 1)) return; try { localStorage.setItem('laerm_pausemin', Math.min(1440, n)); } catch (e) { } go(Math.min(1440, n)); };
  $('recmin').onkeydown = e => { if (e.key === 'Enter') $('recminok').click(); };
  $('recuntilok').onclick = () => {                      // bis Uhrzeit (heute, sonst morgen)
    const v = $('recuntil').value; if (!/^\d\d:\d\d$/.test(v)) return;
    const now = new Date(), u = new Date(now); u.setHours(+v.slice(0, 2), +v.slice(3), 0, 0); if (u <= now) u.setDate(u.getDate() + 1);
    go(Math.max(1, Math.ceil((u - now) / 60000)));
  };
  m.hidden = false;
  const r = $('recbtn').getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, r.left)) + 'px'; m.style.right = 'auto';
}
async function toggleRec(sure) {
  const on = REC_PAUSED === true;                     // gestoppt -> starten
  if (!on && sure !== true) { recMenu(); return; }
  if (!on && !confirm(t('rec_confirm'))) return;
  const b = $('recbtn'); b.disabled = true;
  try {
    const r = await (await fetch('recording', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on }) })).json();
    if (!r.ok) throw new Error(r.error || 'error');
    if (st) { st.paused = r.paused; st.paused_since = r.since; st.paused_until = null; }
    syncRec({ paused: r.paused, paused_since: r.since }); updateStatus();
  } catch (e) { alert(t('saveerr') + ' ' + e.message); }
  b.disabled = false;
}
/* Eigene Referenzlinien des gewaehlten Geraets */
const REF_COLORS = ['#7048e8', '#2b8a3e', '#e8590c', '#1c7ed6', '#c2255c', '#868e96'];
function curRefs(id) { const s = srcById(id || selSrc); return (s && s.refs) || []; }
// Linienbeschriftung mit halbdurchsichtigem Hintergrund (wie bei den Referenzlinien), damit sie ueber der Kurve lesbar bleibt
/* Schwelle außerhalb der Skala: gestrichelt am oberen bzw. unteren Rand (nur die Abschnitte außerhalb), Beschriftung mit Pfeil.
   pts: [[x, Wert], ...] in Zeitfolge. Liefert true, wenn etwas am Rand gezeichnet wurde. */
function thrEdge(c, pts, lo, hi, L, T, pw, ph, d, col, w) {
  let any = false;
  for (const [edge, test] of [[T + 1 * d, v => v > hi], [T + ph - 1 * d, v => v < lo]]) {
    c.beginPath(); let on = false;
    for (const [x, v] of pts) { if (v != null && test(v)) { if (!on) { c.moveTo(Math.max(L, x), edge); on = true; } else c.lineTo(Math.min(L + pw, x), edge); any = true; } else on = false; }
    c.setLineDash([7 * d, 4 * d]); c.strokeStyle = col; c.lineWidth = (w || 2) * d; c.stroke(); c.setLineDash([]);
  }
  return any;
}
const thrTxt = (v, lo, hi) => t('threshold') + ' ' + v.toFixed(1) + ' dB' + (v > hi ? ' ↑' : v < lo ? ' ↓' : '');
function lblBox(c, txt, x, y, col, d) {
  const tw = c.measureText(txt).width, al = c.textAlign, x0 = al === 'right' ? x - tw : al === 'center' ? x - tw / 2 : x;
  c.save(); c.fillStyle = C.card; c.globalAlpha = .85; c.fillRect(x0 - 4 * d, y - 11 * d, tw + 8 * d, 15 * d); c.restore();
  c.fillStyle = col; c.fillText(txt, x, y);
}
// yOf(v) -> Liste von y-Positionen (Balken: oben und gespiegelt unten); lo/hi = sichtbarer Bereich
function drawRefs(c, refs, yOf, lo, hi, L, pw, T, ph, d) {
  if (!refs.length) return;
  c.save(); c.font = '600 ' + (11 * d) + 'px system-ui'; c.textAlign = 'left';
  for (const r of refs) {
    const lab = (r.label ? r.label + ' ' : '') + r.db.toFixed(1) + ' dB';
    if (r.db < lo || r.db > hi) {                        // ausserhalb: kleiner Hinweis am Rand
      const up = r.db > hi, y = up ? T + 12 * d : T + ph - 4 * d;
      c.fillStyle = r.color; c.globalAlpha = .9; c.fillText((up ? '▲ ' : '▼ ') + lab, L + 6 * d, y); c.globalAlpha = 1;
      continue;
    }
    c.strokeStyle = r.color; c.lineWidth = 1.5 * d; c.setLineDash([2 * d, 3 * d]);
    for (const y of yOf(r.db)) { c.beginPath(); c.moveTo(L, y); c.lineTo(L + pw, y); c.stroke(); }
    c.setLineDash([]);
    const y = yOf(r.db)[0], tw = c.measureText(lab).width;
    c.fillStyle = C.card; c.globalAlpha = .85; c.fillRect(L + 4 * d, y - 13 * d, tw + 8 * d, 15 * d); c.globalAlpha = 1;
    c.fillStyle = r.color; c.fillText(lab, L + 8 * d, y - 2 * d);
  }
  c.restore();
}
function goLive() { histExit(); setLive(true); yv.auto = true; if (typeof wg !== 'undefined') wg.auto = true; syncAutoBtn(); markDirty(); }
function spanLabel(s) {
  s = Math.round(s); if (s < 60) return s + ' s';
  if (s >= 172800) { const dd = s / 86400; return (Number.isInteger(dd) ? dd : dd.toFixed(1)) + ' d'; }
  if (s < 3600) return (s % 60 ? Math.floor(s / 60) + ':' + pad(s % 60) : s / 60) + ' min';
  const m = Math.round(s / 60); return (m % 60 ? Math.floor(m / 60) + ':' + pad(m % 60) : m / 60) + ' h';
}
function spanSel(s) {                                // Auswahl „Zeitfenster“: feste Stufe oder der gezoomte Wert
  const sel = $('span'); if (!sel) return; let c = sel.querySelector('option[data-cus]');
  const o = [...sel.options].find(x => !x.dataset.cus && +x.value === s);
  if (o) { if (c) c.remove(); sel.value = o.value; return; }
  if (!c) { c = document.createElement('option'); c.dataset.cus = '1'; }
  c.value = String(s); c.textContent = spanLabel(s);
  const nx = [...sel.options].find(x => !x.dataset.cus && +x.value > s); sel.insertBefore(c, nx || null); sel.value = c.value;
}
function setSpan(s) { const was = histOn(); view.span = s; spanSel(s); if (LDT.hist && LDT.zoom) { const e = LDT.to; LDT.from = e - s * 1000; } else if (LONG_SPAN(s)) LDT.zoom = false; if (was || histOn()) syncLongSpan(); }
function setMode(m) {
  view.mode = m;
  $('m_level').classList.toggle('on', m === 'level'); $('m_wave').classList.toggle('on', m === 'wave'); if ($('laybtn')) $('laybtn').hidden = m === 'wave';
  syncAutoBtn();
}
function syncAutoBtn() { if (yv.auto) yv.tlo = yv.thi = null; syncAutoBtn2(); }
function syncAutoBtn2() { $('zauto').classList.toggle('on', yv.auto); $('main').classList.toggle('yfree', !yv.auto); }

/* Auto-Zoom: Bereich eng um die sichtbaren Werte (Pegel, Hintergrund und – Standard – die Schwelle), mind. minSpan dB.
   Mit Hysterese: das Ziel aendert sich nur, wenn Werte herausragen oder der Bereich deutlich zu gross ist. */
const autoThr = () => !CUR || CUR.auto_thr !== 'data';   // Einstellung „Auto-Höhe“: mit Schwelle (Standard) oder nur Messwerte
function autoY(mn, mx, minSpan, padF) {
  const sp = Math.max(mx - mn, 0.5), pad = Math.max(0.4, sp * padF);
  let lo = mn - pad, hi = mx + pad;
  if (hi - lo < minSpan) { const m = (hi + lo) / 2; lo = m - minSpan / 2; hi = m + minSpan / 2; }
  if (yv.tlo == null || lo < yv.tlo || hi > yv.thi || (yv.thi - yv.tlo) > 1.5 * (hi - lo) + 1) {
    const q = (hi - lo) < 12 ? 0.5 : 1;                   // auf 0,5 bzw. 1 dB runden
    yv.tlo = Math.floor(lo / q) * q; yv.thi = Math.ceil(hi / q) * q;
  }
  const k = smoothK(250);
  yv.lo += (yv.tlo - yv.lo) * k; yv.hi += (yv.thi - yv.hi) * k;
  if (Math.abs(yv.tlo - yv.lo) > 0.05 || Math.abs(yv.thi - yv.hi) > 0.05) animating = true;
}
function timeTicks(t0, t1, maxTicks, minor) {
  const span = (t1 - t0) / 1000;
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const sub = { 1: 0.2, 2: 0.5, 5: 1, 10: 2, 15: 5, 30: 5, 60: 10, 120: 30, 300: 60, 600: 120 };
  let step = steps[steps.length - 1];
  for (const s of steps) if (span / s <= maxTicks) { step = s; break; }
  const out = [], ms = Math.round((minor ? sub[step] : step) * 1000);
  for (let x = Math.ceil(t0 / ms) * ms; x <= t1; x += ms) out.push(x);
  return out;
}
/* dB-Skala: Hauptschritt so fein wie moeglich (Beschriftungen mind. minPx auseinander), dazu Zwischenstriche.
   px = Hoehe (bzw. Breite) in Geraetepixeln fuer den Bereich lo..hi. Liefert [{v, major}] und das Format. */
function dbTicks(lo, hi, px, minPx) {
  const per = px / Math.max(1e-6, hi - lo), d = DPR();
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
  let major = 50; for (const st of steps) if (st * per >= minPx * d) { major = st; break; }
  let minor = major / ((major === 2 || major === 20 || major === 0.2) ? 4 : 5);
  if (minor * per < 5 * d) minor = major / 2;
  if (minor * per < 5 * d) minor = major;
  const out = [], k0 = Math.ceil(lo / minor - 1e-9), k1 = Math.floor(hi / minor + 1e-9);
  for (let k = k0; k <= k1 && out.length < 2000; k++) {
    const v = Math.round(k * minor * 100) / 100, q = v / major;
    out.push({ v, major: Math.abs(q - Math.round(q)) < 1e-6 });
  }
  return { ticks: out, fmt: v => major < 1 ? v.toFixed(1) : String(v) };
}
/* Zeitraster: Hauptlinien und zarte Zwischenlinien */
function timeGrid(c, X, t0, t1, T, ph, col) {
  c.lineWidth = 1; c.strokeStyle = col;
  c.globalAlpha = .4;
  for (const tk of timeTicks(t0, t1, 8, true)) { const x = Math.round(X(tk)) + .5; c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke(); }
  c.globalAlpha = 1;
  for (const tk of timeTicks(t0, t1, 8)) { const x = Math.round(X(tk)) + .5; c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke(); }
}
/* Raster zeichnen: Hauptlinien kraeftiger mit Beschriftung, Zwischenlinien zart, kurze Striche an der Achse */
function drawDbGrid(c, ys, L, pw, d, label, gridCol, labCol) {
  for (const { y, major, text } of ys) {
    const yy = Math.round(y) + .5;
    c.strokeStyle = gridCol; c.lineWidth = 1; c.globalAlpha = major ? 1 : .45;
    c.beginPath(); c.moveTo(L, yy); c.lineTo(L + pw, yy); c.stroke();
    c.globalAlpha = 1; c.strokeStyle = labCol;
    c.beginPath(); c.moveTo(L - (major ? 5 : 3) * d, yy); c.lineTo(L, yy); c.stroke();
    if (major && label && text != null) { c.fillStyle = labCol; c.fillText(text, L - 7 * d, yy + 4 * d); }
  }
}
// Lücke vor Messwert i: fehlende Messnummer ODER Zeitsprung (Aufnahme stand kurz) – wie im Tagesverlauf, damit Live und angehalten gleich aussehen
const GAP_MS = 400;
const gapBefore = i => i > 0 && (recs[i].s !== recs[i - 1].s + 1 || recs[i].ts - recs[i - 1].ts > GAP_MS);
function eventSpans(i0, i1, cb, core) {          // core: nur der Teil ueber der Schwelle (a=2), sonst mit Nachlauf
  let s = -1;
  for (let i = i0; i <= i1 + 1; i++) {
    const on = i <= i1 && recs[i] && (core ? recs[i].a === 2 : recs[i].a);
    if (s >= 0 && (!on || gapBefore(i))) { cb(recs[s].ts - 100, recs[i - 1].ts); s = -1; }
    if (on && s < 0) s = i;
  }
}

/* Vorlauf: Zeit vor dem Ausloesen, die zum Ereignis gehoert (KI-Auswertung, ggf. Ton). Beim Ausloesen rueckwirkend
   markieren - so lang wie fuer das Geraet eingestellt, aber nie in ein vorheriges Ereignis oder ueber eine Datenluecke hinweg. */
function preRollSpans(i0, i1, cb) {
  const c = effCfg(selSrc), pre = (c && c.pre_roll_s != null ? +c.pre_roll_s : 5) * 1000;
  if (!c || !c.save_audio) return groupSpans(i0, i1, cb);   // ohne echten Ton gibt es keinen Vorlauf: Störungen kurz hintereinander zusammenfassen
  if (!(pre > 0)) return;
  for (let i = Math.max(i0, 1); i <= i1; i++) {
    if (!recs[i] || recs[i].a !== 2 || (recs[i - 1].a && !gapBefore(i))) continue;   // nur echter Beginn einer Stoerung
    const end = recs[i].ts - 100; let j = i - 1;
    while (j >= 0 && !recs[j].a && !gapBefore(j + 1) && recs[j].ts - 100 >= end - pre) j--;
    const start = Math.max(end - pre, recs[j + 1] ? recs[j + 1].ts - 100 : end);
    if (end > start) cb(start, end);
  }
}

/* Ohne echten Ton: Störungen, die höchstens „Gruppe: höchste Pause“ auseinander liegen, hell verbunden (wie die Gruppen in der Liste) */
function groupSpans(i0, i1, cb) {
  const gap = ((CUR && CUR.group_pause_s) || 120) * 1000, sp = [];
  eventSpans(i0, i1, (a, b) => sp.push([a, b]), true);
  let cur = null, n = 0;
  for (const [a, b] of sp) {
    if (cur && a - cur[1] <= gap) { cur[1] = b; n++; continue; }
    if (cur && n > 1) cb(cur[0], cur[1]);
    cur = [a, b]; n = 1;
  }
  if (cur && n > 1) cb(cur[0], cur[1]);
}
/* ---------- Pegelspur ---------- */
/* ================= Ebenen (Layer): zusaetzliche Kurven nach Lautstaerke und Frequenz ================= */
const LAY = { lvl: true, bg: true, thr: true, lo: false, mid: false, hi: false, dom: false, cen: false };
try { Object.assign(LAY, JSON.parse(localStorage.getItem('laerm_layers') || '{}')); } catch (e) { }
const LCOL = { lo: '#e8590c', mid: '#2b8a3e', hi: '#7048e8', dom: '#d6336c', cen: '#f59f00' };
const layersOn = () => LAY.lo || LAY.mid || LAY.hi || LAY.dom || LAY.cen;
function deriv(r, centers) {          // aus den 32 Frequenzbaendern: Pegel tief/mittel/hoch, dominante Frequenz, Klangschwerpunkt
  if (r.dv !== undefined) return r.dv;
  if (!centers || centers.length !== NB || !r.sp) return (r.dv = null);
  let pl = 0, pm = 0, ph = 0, mx = -1, mi = 0, sp = 0, sl = 0;
  for (let k = 0; k < NB; k++) {
    const p = Math.pow(10, (r.sp[k] / 2 - 130) / 10), f = centers[k];
    if (f < 250) pl += p; else if (f < 2000) pm += p; else ph += p;
    if (r.sp[k] > mx) { mx = r.sp[k]; mi = k; }
    sp += p; sl += p * Math.log(f);
  }
  const dB = p => p > 0 ? 10 * Math.log10(p) : null;
  return (r.dv = { lo: dB(pl), mid: dB(pm), hi: dB(ph), dom: centers[mi], cen: sp > 0 ? Math.exp(sl / sp) : null });
}
const isSound = r => r.l != null && (r.a || (r.b != null && r.l >= r.b + 6));
function accLayers(acc, r, centers) {
  if (!layersOn()) return;
  const dv = deriv(r, centers); if (!dv) return;
  if (LAY.lo) acc(dv.lo); if (LAY.mid) acc(dv.mid); if (LAY.hi) acc(dv.hi);
}
/* pts: [{x, r, brk}] sichtbare Datensaetze mit Pixel-x. Y = dB-Achse, Frequenz-Ebenen laufen logarithmisch von 50 Hz bis 8 kHz ueber die Hoehe. */
function drawLayers(c, pts, Y, centers, d, L, pw, T, ph) {
  if (!layersOn() || !pts.length) return;
  const F0 = Math.log(50), F1 = Math.log(8000), Yf = f => T + ph * (1 - (Math.log(f) - F0) / (F1 - F0));
  const lines = [['lo', v => v.lo], ['mid', v => v.mid], ['hi', v => v.hi]];
  for (const [id, g] of lines) if (LAY[id]) {
    c.beginPath(); let on = false;
    for (const p of pts) { const dv = deriv(p.r, centers), v = dv ? g(dv) : null; if (v == null || p.brk) on = false; if (v == null) continue; const y = Y(v); if (!on) { c.moveTo(p.x, y); on = true; } else c.lineTo(p.x, y); }
    c.strokeStyle = LCOL[id]; c.lineWidth = 1.5 * d; c.lineJoin = 'round'; c.globalAlpha = .95; c.stroke(); c.globalAlpha = 1;
  }
  if (LAY.cen) {
    c.beginPath(); let on = false;
    for (const p of pts) { const dv = deriv(p.r, centers); if (!dv || !isSound(p.r) || p.brk) on = false; if (!dv || !isSound(p.r)) continue; const y = Yf(dv.cen); if (!on) { c.moveTo(p.x, y); on = true; } else c.lineTo(p.x, y); }
    c.strokeStyle = LCOL.cen; c.lineWidth = 1.6 * d; c.lineJoin = 'round'; c.stroke();
  }
  if (LAY.dom) {
    c.fillStyle = LCOL.dom; c.globalAlpha = .75;
    for (const p of pts) { const dv = deriv(p.r, centers); if (!dv || !isSound(p.r)) continue; c.beginPath(); c.arc(p.x, Yf(dv.dom), 1.8 * d, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  }
  // rechte Frequenzachse (nur wenn eine Frequenz-Ebene an ist) und Legende
  c.font = '600 ' + (10 * d) + 'px system-ui'; c.textAlign = 'right';
  if (LAY.dom || LAY.cen) {
    c.fillStyle = LAY.dom ? LCOL.dom : LCOL.cen; c.globalAlpha = .85;
    for (const f of [100, 200, 500, 1000, 2000, 5000]) { const y = Yf(f); c.fillText((f >= 1000 ? f / 1000 + ' kHz' : f + ' Hz'), L + pw - 4 * d, y - 2 * d); c.fillRect(L + pw - 3 * d, y, 3 * d, 1 * d); }
    c.globalAlpha = 1;
  }
  let lx = L + 8 * d; c.textAlign = 'left';
  for (const id of ['lo', 'mid', 'hi', 'dom', 'cen']) if (LAY[id]) { c.fillStyle = LCOL[id]; const s = '■ ' + t('lay_s_' + id); c.fillText(s, lx, T + 14 * d); lx += c.measureText(s).width + 12 * d; }
}
function buildLayerPop(anchor) {
  let pop = $('laypop');
  if (!pop) { pop = el('div', { id: 'laypop', className: 'laypop' }); document.body.appendChild(pop); document.addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('.laybtn')) pop.hidden = true; }); }
  const rows = [['lvl', ''], ['bg', ''], ['thr', ''], ['lo', LCOL.lo], ['mid', LCOL.mid], ['hi', LCOL.hi], ['dom', LCOL.dom], ['cen', LCOL.cen]];
  pop.innerHTML = `<b>${esc(t('lay_title'))}</b>` + rows.map(([id, col], i) => `${i === 3 ? `<hr><small>${esc(t('lay_freq_grp'))}</small>` : ''}<label><input type="checkbox" data-l="${id}"${LAY[id] ? ' checked' : ''}><i style="background:${col || (id === 'lvl' ? C.acc : id === 'bg' ? C.bgl : C.thr)}"></i>${esc(t('lay_' + id))}</label>`).join('') + `<small class="lh">${esc(t('lay_hint'))}</small>`;
  pop.querySelectorAll('input').forEach(i => i.onchange = () => {
    LAY[i.dataset.l] = i.checked; try { localStorage.setItem('laerm_layers', JSON.stringify(LAY)); } catch (e) { }
    markDirty(); if ($('evdlg').open) evDraw(); if (histOn()) dtDraw(LDT);
  });
  const host = $('evdlg').open ? $('evdlg') : document.body;
  if (pop.parentNode !== host) host.appendChild(pop);
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  pop.style.top = Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 6) + 'px';
  pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth)) + 'px';
}

/* ================= Kurven mit uPlot (MIT, github.com/leeoniya/uPlot) =================
   uPlot zeichnet Raster, Achsen und die Pegel-Kurven bzw. Lautstärke-Balken. Unsere Leinwand liegt genau darüber
   (durchsichtig): Bedienung, Störungen, Notizen, Beschriftungen, Tooltips. Spektrogramm und Druck bleiben eigene Bilder. */
const UPS = new WeakMap();
function dayTicks(a, b, maxT) {                      // Zeitmarken für lange Zeiträume, auf volle Ortszeit
  const steps = [1e3, 2e3, 5e3, 10e3, 30e3, 60e3, 120e3, 300e3, 600e3, 900e3, 1800e3, 3600e3, 7200e3, 10800e3, 21600e3, 43200e3, 864e5, 1728e5, 6048e5];
  const st = steps.find(s2 => (b - a) / s2 <= maxT) || 6048e5, tz = new Date(a).getTimezoneOffset() * 60000, out = [];
  for (let x = Math.ceil((a - tz) / st) * st + tz; x <= b && out.length < 200; x += st) out.push(x);
  return { ticks: out, step: st };
}
function upLabel(ms, step) { const d = new Date(ms); return step < 60e3 ? hms(ms) : step < 864e5 ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.'; }
function upHide(cv) { const e = UPS.get(cv); if (e) e.host.style.display = 'none'; }
/* cfg: { kind: 'lvl' | 'wave', L, R, T, B (CSS-Pixel wie unsere Zeichnung), pal(): Farben, day: lange Zeitachse, act: Störung rot auf der Kurve } */
const AXL = () => innerWidth < 600 ? 40 : 52;     // Live-Bild: Breite der dB-Beschriftung (Handy schmaler, ohne „dB“ je Zahl)
function upGet(cv, cfg) {
  const key = [cfg.kind, cfg.L, cfg.R, cfg.T, cfg.B, !!cfg.day, !!cfg.act, !!cfg.rel].join('|');
  let e = UPS.get(cv);
  if (e && e.key !== key) { e.u.destroy(); e.host.remove(); e = null; }
  if (!e) {
    let wrap = cv.parentNode;
    if (!wrap.classList.contains('upw')) {
      if (wrap.classList.contains('ndcvw')) wrap.classList.add('upw');
      else { wrap = document.createElement('div'); wrap.className = 'upw'; cv.parentNode.insertBefore(wrap, cv); wrap.appendChild(cv); }
    }
    const host = document.createElement('div'); host.className = 'uphost'; wrap.insertBefore(host, cv);
    const P = cfg.pal, font = '11px system-ui', axisCol = () => P().mut, gridCol = () => P().grid;
    const xAxis = { scale: 'x', size: cfg.B, stroke: axisCol, font, gap: 4, grid: { stroke: gridCol, width: 1 }, ticks: { stroke: gridCol, width: 1, size: 4 },
      splits: (u, ai, a, b) => {
        if (cfg.rel) { const st = ([0.5, 1, 2, 5, 10, 15, 30, 60].find(q => (b - a) / 1000 / q <= 10) || 60) * 1000, out = []; for (let x = Math.ceil(a / st) * st; x <= b; x += st) out.push(x); return out; }
        return cfg.day ? dayTicks(a, b, Math.max(3, Math.min(12, Math.floor(u.bbox.width / DPR() / 72)))).ticks : timeTicks(a, b, Math.max(3, Math.min(8, Math.floor(u.bbox.width / DPR() / 80))));   // schmal (Handy): weniger Uhrzeiten
      },
      values: (u, sp) => { const st = sp.length > 1 ? sp[1] - sp[0] : 60e3; return sp.map(v => cfg.rel ? (Math.round(v / 100) / 10) + ' s' : cfg.day ? upLabel(v, st) : hms(v)); } };
    let yAxis;
    if (cfg.kind === 'wave') {                        // Balken gespiegelt um die Mitte: Beschriftung oben in dB
      yAxis = { scale: 'y', size: cfg.L, stroke: axisCol, font, gap: 4, grid: { stroke: gridCol, width: 1 }, ticks: { show: false },
        splits: u => { const m = u._wv; if (!m) return [0]; const out = [0]; for (const k of m.ticks) { const f = m.F(k.v); if (f > 0.04) out.push(f, -f); } return out; },
        values: (u, sp) => sp.map(v => { const m = u._wv; if (!m || v <= 0) return ''; const k = m.ticks.find(q => Math.abs(m.F(q.v) - v) < 1e-9); return k ? m.fmt(k.v) + '' : ''; }) };
    } else {
      yAxis = { scale: 'y', size: cfg.L, stroke: axisCol, font, gap: 4, grid: { stroke: gridCol, width: 1 }, ticks: { stroke: gridCol, width: 1, size: 3 },
        splits: (u, ai, a, b) => dbTicks(a, b, u.bbox.height, cfg.day ? 18 : 24).ticks.filter(k => k.major).map(k => k.v),
        values: (u, sp) => { const f = dbTicks(u.scales.y.min, u.scales.y.max, u.bbox.height, cfg.day ? 18 : 24).fmt; return sp.map(v => f(v)); } };
    }
    let series;
    if (cfg.kind === 'wave') {
      const bars = uPlot.paths.bars({ size: [0.82, Infinity, 1], align: 1 });
      const mk = (col, a) => ({ scale: 'y', paths: bars, fill: () => ca(P()[col], a), stroke: () => 'transparent', width: 0, fillTo: () => 0, points: { show: false } });
      series = [{}, mk('acc', 0.75), mk('warn', 1), mk('red', 1), mk('acc', 0.75), mk('warn', 1), mk('red', 1)];
    } else {
      series = [{}, { scale: 'y', stroke: () => P().acc, width: cfg.day ? 1.2 : 1.6, fill: () => ca(P().acc, cfg.day ? 0.22 : 0.15), fillTo: u => u.scales.y.min, points: { show: false } },   // Fläche nach unten (sonst bis 0 dB nach oben)
        { scale: 'y', stroke: () => P().bgl, width: 1.5, points: { show: false } },
        { scale: 'y', stroke: () => P().thr, width: cfg.day ? 1.5 : 2, dash: cfg.day ? [4, 3] : [7, 4], paths: uPlot.paths.stepped({ align: 1 }), points: { show: false } }];
      if (cfg.act) series.push({ scale: 'y', stroke: () => P().red, width: 1.6, points: { show: false } });
    }
    const opts = { width: Math.max(50, cv.clientWidth), height: Math.max(40, cv.clientHeight), pxAlign: 1, legend: { show: false }, select: { show: false },
      cursor: { show: false, drag: { x: false, y: false }, points: { show: false } },
      padding: [cfg.T, cfg.R, 0, 0], scales: { x: { time: false, auto: false }, y: { auto: false, range: (u, a, b) => [a, b] } },
      axes: [xAxis, yAxis], series };
    const u = new uPlot(opts, series.map(() => []), host);
    e = { u, host, key, dk: null }; UPS.set(cv, e);
  }
  e.host.style.display = '';
  const w = Math.max(50, cv.clientWidth), h = Math.max(40, cv.clientHeight);
  if (e.u.width !== w || e.u.height !== h) e.u.setSize({ width: w, height: h });
  return e;
}
const dayPal = () => ({ acc: NC.acc, bgl: NC.mut, thr: NC.warn, red: NC.red, warn: NC.warn, grid: NC.grid, mut: NC.mut });
let UPID = 0;
function dayData(r, wave, F) {                       // Verlauf: Abschnitte (Mitte), Lücken unterbrechen die Linie
  const step = r.step || (r.to - r.from) / 1200, half = step / 2, gapMs = Math.max(400, 3 * step);
  if (wave) {
    const X = [], S = [[], [], [], [], [], []];
    for (const p of r.pts) { if (p[1] == null) continue; const v = Math.max(0.012, F(p[1])), tv = p[4], k = tv == null ? 0 : p[1] >= tv ? 2 : p[1] >= tv - 3 ? 1 : 0;
      X.push(p[0]); for (let j = 0; j < 6; j++) S[j].push(j === k ? v : j === k + 3 ? -v : null); }
    return [X, ...S];
  }
  const X = [], P = [], Bg = [], Th = [], Ac = []; let prev = null;
  for (const p of r.pts) {
    if (prev != null && p[0] - prev > gapMs) { X.push(prev + half + 1); P.push(null); Bg.push(null); Th.push(null); Ac.push(null); }
    X.push(p[0] + half); P.push(p[1]); Bg.push(p[3]); Th.push(p[4]); Ac.push(p[5] && p[1] != null ? p[1] : null); prev = p[0];
  }
  return [X, P, Bg, Th, Ac];
}
const livePal = () => ({ acc: (getComputedStyle(document.documentElement).getPropertyValue('--nacc') || '').trim() || C.acc, bgl: C.bgl, thr: C.thr, red: C.red, warn: C.thr, grid: C.grid, mut: C.mut });
function liveLvlData(bw) {                           // Live-Pegelspur: Zeit, Pegel, Hintergrund, Schwelle (Lücken unterbrechen die Linie)
  const n = recs.length, X = [], P = [], Bg = [], Th = [];
  /* Mehr Messwerte als Bildpunkte: je Bildpunkt-Spalte (feste Zeitraster, an der Uhrzeit ausgerichtet) der leiseste und der
     lauteste Wert. So sieht die Kurve live, angehalten und beim Zoomen gleich aus und flimmert nicht, während sie weiterläuft. */
  if (bw > 250) {
    let cur = null;
    const flush = () => {
      if (!cur) return;
      const a = cur.k * bw;
      if (cur.mn == null) { X.push(a + bw / 2); P.push(null); }
      else {
        const lo = [a + bw * 0.25, cur.mn], hi = [a + bw * 0.75, cur.mx];
        for (const [t, v] of cur.imn <= cur.imx ? [lo, hi] : [[lo[0], cur.mx], [hi[0], cur.mn]]) { X.push(t); P.push(v); }
      }
      while (Bg.length < X.length) { Bg.push(cur.b); Th.push(cur.t); }
      cur = null;
    };
    for (let i = 0; i < n; i++) {
      const r = recs[i], k = Math.floor((r.ts - 50) / bw);
      if (cur && (k !== cur.k || gapBefore(i))) {
        const brk = gapBefore(i); flush();
        if (brk) { X.push(X.length ? X[X.length - 1] + 1 : r.ts - 51); P.push(null); Bg.push(null); Th.push(null); }   // Lücke: Linie unterbrechen
      }
      if (!cur) cur = { k, mn: null, mx: null, imn: 0, imx: 0, b: null, t: null };
      const v = r.l != null && r.l > -125 ? r.l : null;
      if (v != null) { if (cur.mn == null || v < cur.mn) { cur.mn = v; cur.imn = i; } if (cur.mx == null || v > cur.mx) { cur.mx = v; cur.imx = i; } }
      if (r.b != null) cur.b = r.b; if (r.t != null) cur.t = r.t;
    }
    flush();
    return [X, P, Bg, Th];
  }
  for (let i = 0; i < n; i++) {
    const r = recs[i];
    if (i && gapBefore(i)) { X.push(r.ts - 51); P.push(null); Bg.push(null); Th.push(null); }
    X.push(r.ts - 50); P.push(r.l != null && r.l > -125 ? r.l : null); Bg.push(r.b != null ? r.b : null); Th.push(r.t != null ? r.t : null);
  }
  return [X, P, Bg, Th];
}
function waveData(group, F) {                       // Lautstärke-Balken: je Gruppe der lauteste Block, Farbe nach Abstand zur Schwelle
  const X = [], S = [[], [], [], [], [], []]; let cur = null;
  const push = () => { if (!cur) return; const v = Math.max(0.012, F(cur.l)), k = cur.t == null ? 0 : cur.l >= cur.t ? 2 : cur.l >= cur.t - 3 ? 1 : 0;
    X.push(cur.ts0); for (let j = 0; j < 6; j++) S[j].push(j === k ? v : j === k + 3 ? -v : null); };
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i], gid = Math.floor(r.s / group);
    if (!cur || cur.gid !== gid || gapBefore(i)) { push(); cur = { gid, ts0: r.ts - 100, l: r.l, t: r.t }; }
    else { if (r.l > cur.l) cur.l = r.l; if (r.t != null) cur.t = r.t; }
  }
  push();
  return [X, ...S];
}
/* Daten und Ausschnitt setzen; dk: Kennung der Daten (nur bei Änderung neu übergeben) */
function upDraw(e, dk, mkData, x0, x1, y0, y1) {
  const u = e.u;
  u.batch(() => {
    if (e.dk !== dk) { e.dk = dk; u.setData(mkData(), false); }
    u.setScale('x', { min: x0, max: x1 });
    u.setScale('y', { min: y0, max: y1 });
  });
}
/* Live-Pegelspur: KI-Symbole oben, Sensor-Fähnchen und rote Marken unten – wie im Verlauf, auch beim Zoomen */
const LOV = { el: { cv: 'main' }, data: null, key: '', at: 0, busy: false, ahits: [] };
function lovFetch(t0, t1) {
  const now = Date.now(), key = selSrc + '|' + Math.round(t0 / 2000) + '|' + Math.round(t1 / 2000);
  if (LOV.busy || (key === LOV.key && now - LOV.at < 5000)) return;
  LOV.busy = true; LOV.key = key; LOV.at = now;
  const date = isoDay(new Date(t1));
  fetch('daytrack?src=' + encodeURIComponent(selSrc || 'main') + '&date=' + date + '&n=60&free=1&nospec=1&from=' + Math.floor(t0) + '&to=' + Math.ceil(t1), { cache: 'no-store' })
    .then(r => r.json()).then(j => { LOV.data = j && (j.art || j.subs || j.ha) ? j : null; }).catch(() => { }).finally(() => { LOV.busy = false; });
}
function lovHas() { const r = LOV.data; return !!(r && ((r.art || []).length || (r.subs || []).length || (r.ha || []).some(a => a[5] === 'event' || a[5] === 'note'))); }
function lovDraw(c, X, L, T, pw, ph, d, t0, t1) {
  LOV.ahits = []; const r = LOV.data; if (!r) return;
  const span = t1 - t0, haV = (r.ha || []).filter(a => a[5] !== 'pause' && a[5] !== 'quiet' && !SHIDE.has('ha:' + a[2]) && a[1] >= t0 && a[0] <= t1), haLane = haLanes(haV);
  c.save(); c.beginPath(); c.rect(L, 0, pw, T + ph + 12 * d); c.clip();
  for (const a of haV) {                               // Fähnchen oben im Bild, gestrichelte Linie ab Oberkante des Fähnchens, rote Marke unter dem Bild
    const x0 = X(Math.max(a[0], t0)), x1 = Math.max(X(Math.min(a[1], t1)), x0 + 3 * d), hb = a[7] ? 2 : 1, ly = T + (haLane.get(a[2]) || 0) * HA_LS * d;
    const ev = a[5] === 'event', col = ev ? sensCol(a) : '#1c7ed6';
    if (ev) { c.fillStyle = ca(col, 0.10); c.fillRect(x0, T, x1 - x0, ph);
      c.strokeStyle = ca(col, 0.8); c.lineWidth = hb * d; c.setLineDash([3 * d, 3 * d]); c.beginPath(); c.moveTo(x0 + 0.5 * d, ly); c.lineTo(x0 + 0.5 * d, T + ph); c.stroke(); c.setLineDash([]); }
    c.fillStyle = col; c.fillRect(x0, ly, x1 - x0, (a[4] ? 5 : 4) * d * hb);
    if (ev) { haFlag(c, x0, ly, d, hb, col); c.fillStyle = col; c.fillRect(x0 - 1 * d * hb, T + ph + 1 * d, Math.max(3 * d, x1 - x0), (a[7] ? 8 : 4) * d); }
  }
  c.restore();
  const y0 = T - 20 * d, fine = r.fine || {}; let lastX = -1e9;
  c.save(); c.beginPath(); c.rect(L - 10 * d, 0, pw + 20 * d, T); c.clip(); c.textAlign = 'center'; c.font = (12 * d) + 'px system-ui';
  const icon = (xx, g, ic, nm, col) => {
    if (ART_MUTE.has(g)) return; const hs = ART_HI.has(g) ? 2 : 1;
    c.fillStyle = col; c.fillRect(xx - 0.75 * d * hs, y0 + 14 * d, 1.5 * d * hs, T - y0 - 14 * d);
    if (xx - lastX <= 16 * d * hs) return;
    c.font = (12 * hs * d) + 'px system-ui'; c.fillText(ic, xx, y0 + 12 * d); c.font = (12 * d) + 'px system-ui';
    LOV.ahits.push({ x: xx / d, y: (y0 + 6 * d) / d, w: 12 * hs, g, n: nm, i: ic }); lastX = xx;
    if (nm && span <= 20 * 60000) { c.font = '600 ' + (9.5 * d) + 'px system-ui'; c.textAlign = 'left'; c.fillText(nm, xx + 8 * d * hs, y0 + 11 * d); c.textAlign = 'center'; c.font = (12 * d) + 'px system-ui'; lastX = xx + c.measureText(nm).width; }
  };
  if ((r.subs || []).length) for (const x of r.subs) { const xx = X(x[0]); if (xx < L || xx > L + pw) continue; const f = fine[x[1]] || { icon: '❓', group: 'other', name: x[1] }; icon(xx, f.group, f.icon, f.name, ART_HEX[f.group] || NC.mut); }
  else for (const a of r.art || []) { const xx = X(a[0]); if (xx < L || xx > L + pw) continue; if (a[3]) continue; icon(xx, a[1], ART_ICON[a[1]] || '❓', artName(a[1]), ART_HEX[a[1]] || NC.mut); }
  c.restore();
}
function drawLevel(cv, t0, t1) {
  fit(cv);
  const d = DPR(), c = cv.getContext('2d'), w = cv.width, h = cv.height;
  lovFetch(t0, t1); const ov = lovHas() ? 1 : 0, Tp = ov ? 30 : 10; LOV.geo = [Tp, ov ? 30 : 22];   // oben Platz für KI-Symbole und Fähnchen
  const L = AXL() * d, R = 14 * d, T = Tp * d, B = (ov ? 30 : 22) * d, pw = w - L - R, ph = h - T - B;   // unten Platz für die Zeitachse (und rote Marken)
  const X = ts => L + pw * (ts - t0) / (t1 - t0);
  const i0 = Math.max(0, lowerBound(t0 - 200)), i1 = Math.min(recs.length - 1, lowerBound(t1 + 200));
  // Auto-Zoom
  if (i1 >= i0) {
    let mn = 1e9, mx = -1e9;
    const acc = v => { if (v != null && v > -125) { if (v < mn) mn = v; if (v > mx) mx = v; } };
    let tmn = 1e9, tmx = -1e9;
    for (let i = i0; i <= i1; i++) { const r = recs[i]; if (LAY.lvl) acc(r.l); if (LAY.bg) acc(r.b); accLayers(acc, r, bands); if (r.t != null && r.t > -125) { if (r.t < tmn) tmn = r.t; if (r.t > tmx) tmx = r.t; } }
    if (mn <= mx) {
      yv.dmn = mn; yv.dmx = mx; yv.dmed = recs[Math.min(i1, (i0 + i1) >> 1)].l;
      if (yv.auto) { const w = autoThr() && tmn <= tmx; autoY(w ? Math.min(mn, tmn) : mn, w ? Math.max(mx, tmx) : mx, 3, 0.08); }   // „Auto“ mit Schwelle (einstellbar)
      else if (yv.anchor) {                              // hineingezoomt: unten bündig am tiefsten Wert, nur die Höhe ist gezoomt
        const sp = yv.span || (yv.hi - yv.lo), lo = Math.floor((mn - Math.max(0.3, sp * 0.03)) * 10) / 10, k = smoothK(250);
        yv.lo += (lo - yv.lo) * k; yv.hi += (lo + sp - yv.hi) * k;
        if (Math.abs(lo - yv.lo) > 0.05 || Math.abs(lo + sp - yv.hi) > 0.05) animating = true;
      }
    }
  }
  const Y = v => T + ph * (1 - clamp((v - yv.lo) / (yv.hi - yv.lo), 0, 1));
  c.clearRect(0, 0, w, h);
  // Raster, Achsen, Pegel, Hintergrund, Schwelle: uPlot
  const up = upGet(cv, { kind: 'lvl', L: AXL(), R: 14, T: Tp, B: ov ? 30 : 22, pal: livePal });
  up.u.setSeries(1, { show: !!LAY.lvl }); up.u.setSeries(2, { show: !!LAY.bg }); up.u.setSeries(3, { show: !!LAY.thr });
  const bw = (t1 - t0) / Math.max(50, pw);           // ms je Bildpunkt (fest gerastert, damit live und angehalten gleich aussehen)
  const bwq = bw > 250 ? Math.pow(2, Math.round(Math.log2(bw) * 4) / 4) : 0;
  upDraw(up, recs.length + ':' + (recs.length ? recs[0].s + ':' + recs[recs.length - 1].s : '') + ':' + bwq, () => liveLvlData(bwq), t0, t1, yv.lo, yv.hi);
  if (i1 < i0) return;
  c.save(); c.beginPath(); c.rect(L, T, pw, ph); c.clip();
  // Ereignisse
  { const light = (a, b) => { c.fillStyle = C.red + '06'; c.fillRect(X(a), T, X(b) - X(a), ph); c.fillStyle = C.red + '55'; c.fillRect(X(a), T, X(b) - X(a), 2 * d); };
    eventSpans(i0, i1, light); preRollSpans(i0, i1, light); }               // Nachlauf und Vorlauf hellrot
  eventSpans(i0, i1, (a, b) => { c.fillStyle = C.red + '0e'; c.fillRect(X(a), T, X(b) - X(a), ph); c.fillStyle = C.red; c.fillRect(X(a), T, X(b) - X(a), 3 * d); }, true);
  if (layersOn()) {
    const step = Math.max(1, Math.floor((i1 - i0) / (pw / d * 2))), pts = [];
    for (let i = i0; i <= i1; i += step) pts.push({ x: X(recs[i].ts - 50), r: recs[i], brk: gapBefore(i) });
    drawLayers(c, pts, Y, bands, d, L, pw, T, ph);
  }
  drawRefs(c, curRefs(), v => [Y(v)], yv.lo, yv.hi, L, pw, T, ph, d);
  if (LAY.thr) { const tp = []; for (let i = i0; i <= i1; i++) { if (gapBefore(i)) tp.push([X(recs[i].ts - 51), null]); tp.push([X(recs[i].ts - 50), recs[i].t]); } thrEdge(c, tp, yv.lo, yv.hi, L, T, pw, ph, d, C.thr, 2); }   // Schwelle außerhalb: am Rand
  // Live-Punkt
  const lr = recs[i1];
  if (view.live && lr) {
    const x = X(lr.ts - 50), y = Y(lr.l), p = (Date.now() % 1200) / 1200;
    c.fillStyle = C.acc; c.beginPath(); c.arc(x, y, 3.5 * d, 0, 7); c.fill();
    c.strokeStyle = C.acc; c.globalAlpha = 1 - p; c.lineWidth = 1.5 * d; c.beginPath(); c.arc(x, y, (4 + 9 * p) * d, 0, 7); c.stroke(); c.globalAlpha = 1;
  }
  c.restore();
  lovDraw(c, X, L, T, pw, ph, d, t0, t1);
  // Beschriftung rechts
  if (lr) {
    c.font = '600 ' + (11 * d) + 'px system-ui'; c.textAlign = 'right';
    if (lr.t != null && LAY.thr) {
      const out = lr.t > yv.hi || lr.t < yv.lo;
      lblBox(c, out ? thrTxt(lr.t, yv.lo, yv.hi) : t('threshold') + ' ' + lr.t.toFixed(1), L + pw - 4 * d, lr.t > yv.hi ? T + 16 * d : lr.t < yv.lo ? T + ph - 6 * d : Y(lr.t) - 5 * d, C.thr, d);
    }
    if (lr.b != null && LAY.bg) {                     // außerhalb: unter bzw. über der Schwellen-Beschriftung, mit Pfeil
      const up = lr.b > yv.hi, dn = lr.b < yv.lo;
      lblBox(c, t('background') + ' ' + lr.b.toFixed(1) + (up ? ' ↑' : dn ? ' ↓' : ''), L + pw - 4 * d, up ? T + 34 * d : dn ? T + ph - 24 * d : Y(lr.b) + 14 * d, C.bgl, d);
    }
  }
  drawHover(c, X, Y, L, T, pw, ph, d, t0, t1, false);
}
/* Zeitachse unter der Pegelspur bzw. den Lautstärke-Balken (wie unter dem Spektrogramm) */
function drawTimeAxis(c, X, L, T, pw, ph, h, d, t0, t1) {
  c.save(); c.font = (11 * d) + 'px system-ui'; c.textAlign = 'center'; c.fillStyle = C.mut;
  for (const tk of timeTicks(t0, t1, 8, true)) { const x = X(tk); if (x >= L && x <= L + pw) c.fillRect(x - .5, T + ph, 1, 2 * d); }
  for (const tk of timeTicks(t0, t1, 8)) { const x = X(tk); if (x < L || x > L + pw) continue; c.fillRect(x - .5, T + ph, 1, 5 * d); const s2 = hms(tk), hw = c.measureText(s2).width / 2; if (x - hw < L || x + hw > L + pw) continue; c.fillText(s2, x, h - 5 * d); }
  c.restore();
}

/* ---------- Wellenform ---------- */
function drawWave(cv, t0, t1) {
  /* Lautstaerke-Balken (Sprachmemo-Stil): Balkenhoehe = Pegel in dB, Farbe = unter / nahe / ueber der Schwelle */
  fit(cv);
  const d = DPR(), c = cv.getContext('2d'), w = cv.width, h = cv.height;
  const L = AXL() * d, R = 14 * d, T = 10 * d, B = 22 * d, pw = w - L - R, ph = h - T - B, mid = T + ph / 2;   // unten Platz für die Zeitachse
  const X = ts => L + pw * (ts - t0) / (t1 - t0);
  const i0 = Math.max(0, lowerBound(t0 - 200)), i1 = Math.min(recs.length - 1, lowerBound(t1 + 200));
  if (i1 >= i0) {                                   // gleiche Auto-Skala wie die Pegelspur, unten etwas Luft
    let mn = 1e9, mx = -1e9;
    const acc = v => { if (v != null && v > -125) { if (v < mn) mn = v; if (v > mx) mx = v; } };
    let tmx = -1e9;
    for (let i = i0; i <= i1; i++) { const r = recs[i]; acc(r.l); acc(r.b); if (r.t != null && r.t > tmx) tmx = r.t; }
    if (mn <= mx) { yv.dmn = mn; yv.dmx = mx; yv.dmed = recs[Math.min(i1, (i0 + i1) >> 1)].l; if (yv.auto) autoY(mn - 2, autoThr() && tmx > -125 ? Math.max(mx, tmx) : mx, 5, 0.08); }   // leise Balken bleiben sichtbar
  }
  const F = v => clamp((v - yv.lo) / (yv.hi - yv.lo), 0, 1);      // 0 = unten (leise), 1 = oben (laut)
  const Hh = v => Math.max(1.5 * d, F(v) * ph / 2);
  c.clearRect(0, 0, w, h);
  // Raster, Achsen und Balken: uPlot (gespiegelt um die Mitte; mehrere 100-ms-Blöcke je Balken, feste Gruppen, lautester zählt)
  const pxPer = pw / ((t1 - t0) / 100), group = Math.max(1, Math.ceil((3 * d) / pxPer));
  const up = upGet(cv, { kind: 'wave', L: AXL(), R: 14, T: 10, B: 22, pal: livePal });
  up.u._wv = { ticks: dbTicks(yv.lo, yv.hi, ph / 2, 22).ticks.filter(k => k.major), F, fmt: dbTicks(yv.lo, yv.hi, ph / 2, 22).fmt };
  const ylo = Math.round(yv.lo * 20) / 20, yhi = Math.round(yv.hi * 20) / 20;
  upDraw(up, [recs.length, recs.length ? recs[0].s + ':' + recs[recs.length - 1].s : '', group, ylo, yhi].join('|'), () => waveData(group, F), t0, t1, -1, 1);
  if (i1 < i0) return;
  c.save(); c.beginPath(); c.rect(L, T, pw, ph); c.clip();
  { const light = (a, b) => { c.fillStyle = C.red + '0a'; c.fillRect(X(a), T, X(b) - X(a), ph); }; eventSpans(i0, i1, light); preRollSpans(i0, i1, light); }
  eventSpans(i0, i1, (a, b) => { c.fillStyle = C.red + '14'; c.fillRect(X(a), T, X(b) - X(a), ph); }, true);
  drawRefs(c, curRefs(), v => [mid - F(v) * ph / 2, mid + F(v) * ph / 2], yv.lo, yv.hi, L, pw, T, ph, d);
  // Schwelle und Hintergrund als Linien
  const lr = recs[i1];
  for (const [key, col, lab, dash] of [['b', C.bgl, t('background'), [3, 4]], ['t', C.thr, t('threshold'), [8, 4]]]) {
    // Verlauf ueber die Zeit (wandert mit dem Hintergrund), oben und gespiegelt unten
    c.setLineDash(dash.map(q => q * d)); c.strokeStyle = col; c.lineWidth = 2 * d;
    for (const sg of [1, -1]) {
      c.beginPath(); let on = false, py = 0;
      for (let i = i0; i <= i1; i++) {
        const v = recs[i][key]; if (v == null || gapBefore(i)) { on = false; if (v == null) continue; }
        const x = X(recs[i].ts - 50), y = mid - sg * F(v) * ph / 2;
        if (!on) { c.moveTo(x, y); on = true; } else { c.lineTo(x, py); c.lineTo(x, y); }
        py = y;
      }
      c.stroke();
    }
    c.setLineDash([]);
    const v = lr[key];
    if (v == null || ((v < yv.lo || v > yv.hi) && key !== 't')) continue;
    const off = F(v) * ph / 2; c.textAlign = 'right'; c.font = '600 ' + (11 * d) + 'px system-ui';
    const txt = key === 't' ? thrTxt(v, yv.lo, yv.hi) : lab + ' ' + v.toFixed(1) + ' dB', ty = lab === t('background') ? mid - off + 15 * d : mid - off - 5 * d, tw = c.measureText(txt).width;
    c.fillStyle = C.card; c.globalAlpha = .85; c.fillRect(L + pw - 8 * d - tw, ty - 11 * d, tw + 8 * d, 15 * d); c.globalAlpha = 1;   // lesbar ueber den Balken
    c.fillStyle = col; c.fillText(txt, L + pw - 4 * d, ty);
  }
  c.restore();
  drawHover(c, X, null, L, T, pw, ph, d, t0, t1, true);
}

/* Bereich markieren (Live-Bild und Verlauf in Protokolle): Knopf „🏷 Bereich markieren“, dann Bereich waagerecht aufziehen und
   benennen. Eine vorhandene Art (Tonprofil oder benannter Bereich) kann gewählt werden – gleicher Name = gleiche Art, die KI lernt daraus. */
const MK = { on: false, sel: null, names: null, pop: null };
function toast(msg, ms) {
  let el_ = $('toast'); if (!el_) { el_ = el('div', { id: 'toast', className: 'toast' }); el_.setAttribute('role', 'status'); document.body.appendChild(el_); }
  el_.textContent = msg; el_.classList.add('on'); clearTimeout(el_._t); el_._t = setTimeout(() => el_.classList.remove('on'), ms || 4000);
}
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.mkend')) mkSet(false); });
function mkSet(on) {
  MK.on = !!on; if (MK.on && typeof DR !== 'undefined' && DR.on) drSet(false); document.body.classList.toggle('marking', MK.on);
  document.querySelectorAll('.mkbtn').forEach(b => { b.classList.toggle('on', MK.on); b.setAttribute('aria-pressed', String(MK.on)); });
  if (MK.on) mkNames(); else mkClose();                 // Hinweis steht direkt über dem Graphen (.mkhint)
}
/* 🗑 Bereich löschen (Verlauf in Protokolle): Zeitraum aufziehen, alle Störungen darin löschen – Tagesaufzeichnung und
   Prüfsummen-Kette bleiben unverändert, an der Stelle entsteht eine Notiz als Hinweis */
const DR = { on: false };
function drSet(on) {
  DR.on = !!on; if (DR.on && MK.on) mkSet(false); document.body.classList.toggle('marking', DR.on || MK.on);
  document.querySelectorAll('.drbtn').forEach(b => { b.classList.toggle('on', DR.on); b.setAttribute('aria-pressed', String(DR.on)); });
  if (DR.on) toast(t('dr_on'), 6000);
}
async function drOpen(src, a, b) {
  drSet(false);
  let d = $('drdlg');
  if (!d) { d = el('dialog', { id: 'drdlg', className: 'evdlg drdlg' }); document.body.appendChild(d); }
  const L = locale(), fd = x => new Date(x).toLocaleString(L, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  d.innerHTML = `<h3>🗑 ${esc(t('dr_title'))}</h3><p><b>${esc(fd(a))} – ${esc(fd(b))}</b></p>
    <label class="drl">${esc(t('a_device'))} <select id="drsrc"></select></label>
    <p id="drcnt" class="drcnt">…</p>
    <label class="drl">${esc(t('dr_note'))}<input type="text" id="drnote" maxlength="300" placeholder="${esc(t('dr_note_ph'))}"></label>
    <p class="mut">${esc(t('dr_hint'))}</p>
    <div class="ntedbtns"><button type="button" class="drx">${esc(t('cancel'))}</button><button type="button" class="danger drgo" disabled>🗑 ${esc(t('dr_go'))}</button></div>`;
  const sel = d.querySelector('#drsrc'); option(sel, 'all', t('all_sources')); viewSources().forEach(x => option(sel, x.id, viewName(x.id))); sel.value = [...sel.options].some(o => o.value === src) ? src : 'all';
  const go = d.querySelector('.drgo'), cnt = d.querySelector('#drcnt');
  const count = async () => {
    cnt.textContent = '…'; go.disabled = true;
    try { const j = await (await fetch('delete_range', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a, b, src: sel.value, preview: 1 }) })).json(); cnt.textContent = t('dr_count', { n: j.n || 0 }); go.disabled = !j.n; } catch (e) { cnt.textContent = t('saveerr'); }
  };
  sel.onchange = count; count();
  d.querySelector('.drx').onclick = () => d.close();
  go.onclick = async () => {
    go.disabled = true;
    try {
      const j = await (await fetch('delete_range', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a, b, src: sel.value, note: d.querySelector('#drnote').value }) })).json();
      if (!j.ok) throw new Error(j.error || 'error');
      d.close(); toast(t('dr_done', { n: j.deleted || 0 }));
      lastCount = -1; EVSIG = ''; await loadEvents(); syncDelBar(); loadSources(); if (NV.open) loadNight(); fnRefresh();
    } catch (e) { alert(t('saveerr') + ' ' + e.message); go.disabled = false; }
  };
  d.showModal();
}
async function mkNames() {
  try { const j = await (await fetch('label_names', { cache: 'no-store' })).json(); MK.names = j.names || []; } catch (e) { MK.names = MK.names || []; }
  return MK.names;
}
function mkClose() { if (MK.pop) MK.pop.hidden = true; const s0 = MK.sel; MK.sel = null; if (s0 && s0.redraw) s0.redraw(); }
function mkFmt(ms) { const d = new Date(ms); return hms(ms) + (lang === 'en' ? '.' : ',') + Math.floor(d.getMilliseconds() / 100); }
async function mkOpen(src, a, b, cx, cy, redraw, ext) {
  if (b - a < 150) { toast(t('mk_short')); redraw && redraw(); return; }
  if (b - a > 120000) { toast(t('mk_long')); redraw && redraw(); return; }
  MK.sel = Object.assign({ src, a, b, redraw }, ext || {}); tipHide();
  let p = MK.pop;
  if (!p) {
    p = MK.pop = el('div', { id: 'mkpop', className: 'lbpop mkpop' }); p.setAttribute('role', 'dialog'); p.hidden = true;
    p.innerHTML = `<b id="mktitle"></b><div id="mksub" class="mksub"></div><input id="mkname" type="text" maxlength="60" list="mkdl" autocomplete="off"><datalist id="mkdl"></datalist>
      <div id="mkquick" class="lbquick"></div><small class="mkhint"></small><div class="ntedbtns"><button type="button" id="mkcancel"></button><button type="button" id="mksave" class="pri"></button></div>`;
    document.body.appendChild(p);
    $('mkcancel').onclick = mkClose; $('mksave').onclick = mkSave;
    $('mkname').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); mkSave(); } else if (e.key === 'Escape') mkClose(); });
    document.addEventListener('pointerdown', e => { if (!p.hidden && !p.contains(e.target) && !e.target.closest('canvas')) mkClose(); }, true);
  }
  const nm = (SOURCES.find(x => x.id === src) || {}).name || src, dur = (b - a) / 1000;
  $('mktitle').textContent = '🏷 ' + t('mk_title'); $('mksub').textContent = nm + ' · ' + mkFmt(a) + ' – ' + mkFmt(b) + ' (' + (lang === 'de' ? dur.toFixed(1).replace('.', ',') : dur.toFixed(1)) + ' s)';
  $('mkname').placeholder = t('lb_ph'); $('mkcancel').textContent = t('cancel'); $('mksave').textContent = t('lb_save'); p.querySelector('.mkhint').textContent = t('mk_hint');
  $('mkname').value = '';
  const fill = L => {
    $('mkdl').innerHTML = L.map(n => `<option value="${esc(n.name)}">`).join('');
    $('mkquick').innerHTML = L.length ? `<small class="lbqh">${esc(t('mk_have'))}</small>` + L.slice(0, 16).map(n => `<button type="button" class="chip ntchip" data-n="${esc(n.name)}">${n.pf ? '🧩 ' : '🏷 '}${esc(n.name)}</button>`).join('') : '';
    $('mkquick').querySelectorAll('button').forEach(x => x.onclick = () => { $('mkname').value = x.dataset.n; $('mkquick').querySelectorAll('button').forEach(y => y.classList.toggle('on', y === x)); $('mkname').focus(); });
  };
  fill(MK.names || []);
  p.hidden = false;
  const w = p.offsetWidth, h = p.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
  p.style.position = 'fixed'; p.style.left = clamp(cx - w / 2, 8, Math.max(8, vw - w - 8)) + 'px'; p.style.top = (cy + 14 + h > vh - 8 ? Math.max(8, cy - 14 - h) : cy + 14) + 'px';
  if (matchMedia('(pointer:fine)').matches) $('mkname').focus();
  mkNames().then(L => { if (!p.hidden) fill(L); });
}
async function mkSave() {
  const sel = MK.sel, name = $('mkname').value.trim(); if (!sel) return;
  if (!name) { $('mkname').focus(); return; }
  $('mksave').disabled = true;
  try {
    const j = await (await fetch('mark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ src: sel.src, a: Math.round(sel.a), b: Math.round(sel.b), name }) })).json();
    if (!j.ok) throw new Error(t({ length: 'mk_long', 'no data': 'mk_nodata', 'bad label': 'lb_empty', limit: 'mk_limit' }[j.error] || 'saveerr'));
    if (j.names) MK.names = j.names;
    toast(j.how === 'event' ? t('mk_ok_ev', { n: name }) : t('mk_ok_pf', { n: name }) + (j.emb ? '' : ' ' + t('mk_noemb')), 6000);
    mkClose(); EVSIG = ''; if (NV.open) { loadEvents(); dtLoad(DT, true); } else levLoad(true);
  } catch (e) { toast(e.message || t('saveerr')); }
  finally { $('mksave').disabled = false; }
}
function drawMk(c, X, T, ph, d, live) {               // markierter Bereich (beim Aufziehen und solange das Benennen offen ist)
  const m = MK.sel; if (!m || !!m.live !== !!live) return;
  const x0 = X(Math.min(m.a, m.b)), x1 = X(Math.max(m.a, m.b));
  c.fillStyle = ca(C.acc, 0.22); c.fillRect(x0, T, Math.max(1, x1 - x0), ph);
  c.strokeStyle = C.acc; c.lineWidth = 1.5 * d; c.beginPath(); c.moveTo(x0, T); c.lineTo(x0, T + ph); c.moveTo(x1, T); c.lineTo(x1, T + ph); c.stroke();
}
/* Tooltip zu einer Störung (Live-Bild und Verlauf): Einzelheiten beim Darüberfahren mit der Maus bzw. beim Antippen */
const ETIP = { el: null, html: "", own: "" };
function tipHide(own) { if (!ETIP.el || ETIP.el.hidden || (own && ETIP.own !== own)) return; ETIP.el.hidden = true; ETIP.html = ''; ETIP.own = ''; }
function tipShow(own, html, cx, cy, left) {          // cx/cy: Stelle am Bildschirm (neben dem Strich), left: lieber links davon
  if (!ETIP.el) {
    ETIP.el = el('div', { id: 'evtip', className: 'evtip' }); ETIP.el.hidden = true; ETIP.el.setAttribute('role', 'tooltip'); document.body.appendChild(ETIP.el);
    window.addEventListener('scroll', () => tipHide(), { passive: true, capture: true });
    document.addEventListener('pointerdown', e => { if (e.target.tagName !== 'CANVAS') tipHide(); }, true);   // Touch: Tippen daneben schließt
  }
  if (html !== ETIP.html) { ETIP.el.innerHTML = html; ETIP.html = html; }
  ETIP.own = own; ETIP.el.hidden = false;
  const w = ETIP.el.offsetWidth, h = ETIP.el.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
  let x = left ? cx - 14 - w : cx + 14; if (x + w > vw - 8) x = cx - 14 - w; if (x < 8) x = Math.min(cx + 14, vw - 8 - w); x = Math.max(8, x);
  const y = clamp(cy, 8, Math.max(8, vh - 8 - h));
  ETIP.el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
}
function tipHtml(o) {
  const nm = id => viewName(id) || '';
  const dur = Math.max(0, (o.to - o.from) / 1000), ds = dur < 10 ? dur.toFixed(1) : String(Math.round(dur));
  const rows = [], kv = (k, v) => rows.push(`<dt>${esc(k)}</dt><dd>${v}</dd>`);
  if (o.pk != null) kv(t('peak'), `${esc(f1(o.pk))} dBFS`);
  if (o.th != null) kv(t('threshold'), `${esc(f1(o.th))} dBFS${o.pk != null && o.pk > o.th ? ` <small>+${esc(f1(o.pk - o.th))} dB</small>` : ''}`);
  if (o.bg != null) kv(t('background'), `${esc(f1(o.bg))} dBFS`);
  if (o.art && (!CUR || CUR.classify !== false)) kv(t('tip_art'), artChip(o.art, o.ac, o.am));
  if (o.prof) kv(t('tip_prof'), `<span class="art prof${o.pbg ? ' bgp' : ''}">🧩 ${esc(o.prof)}${o.pc != null ? ` <small>${esc(o.pc)} %</small>` : ''}</span>`);
  if (o.grp > 1) kv(t('tip_grp'), esc(t('tip_grp_n', { n: o.grp })));
  const also = [...new Set((o.also || []).filter(x => x && x !== o.src))];
  if (also.length) kv(t('tip_also'), esc(also.map(nm).join(', ')));
  if (o.nt) kv(t('tip_notes'), String(o.nt));
  return `<div class="evtiph"><i class="evtipd${o.other ? ' oth' : ''}"></i><b>${esc(t(o.other ? 'tip_other' : 'tip_ev'))}</b>${o.run ? `<em>${esc(t('tip_run'))}</em>` : ''}</div>`
    + `<div class="evtips">${esc(nm(o.src))}</div>`
    + `<div class="evtipt">${hms(o.from)} – ${o.run ? '…' : hms(o.to)}<span>${esc(lang === 'de' ? ds.replace('.', ',') : ds)} s</span></div>`
    + (rows.length ? `<dl>${rows.join('')}</dl>` : '');
}
/* Live-Bild: Störung an der Stelle (aus den Messwerten), Einzelheiten aus der Liste „Ereignisse heute“, sobald sie dort steht */
function liveTipAt(i) {
  let a = i, b = i; while (a > 0 && recs[a - 1].a && !gapBefore(a)) a--; while (b < recs.length - 1 && recs[b + 1].a && !gapBefore(b + 1)) b++;
  let pk = -1e9; for (let k = a; k <= b; k++) if (recs[k].l != null && recs[k].l > pk) pk = recs[k].l;
  const from = recs[a].ts - 100, to = recs[b].ts, run = b === recs.length - 1 && nowServer() - DELAY - recs[b].ts < 1500;
  const o = { src: selSrc, from, to, run, pk: pk > -1e9 ? pk : null, th: recs[a].t, bg: recs[a].b };
  const row = ((LEV.data && LEV.data.events) || []).find(r => (r.quelle_id || 'main') === selSrc && (() => { const s0 = new Date(r.start).getTime(), s1 = s0 + (r.dauer_s || 0) * 1000; return s0 <= to + 1500 && s1 >= from - 1500; })());
  if (row) {
    const nm_ = v => v == null || v === '' || !isFinite(+v) ? null : +v;   // Werte aus der Liste kommen als Text
    Object.assign(o, { th: nm_(row.schwelle_dbfs) != null ? nm_(row.schwelle_dbfs) : o.th, bg: nm_(row.hintergrund_dbfs) != null ? nm_(row.hintergrund_dbfs) : o.bg, art: row.art, ac: row.art_c, am: row.art_man,
      prof: row.prof, pc: row.prof_ok ? null : row.prof_c, pbg: row.bg, nt: row.notes, also: (row.devs || []).map(x => x[0]) });
    const g = row.grp != null && LEV.data.grps ? LEV.data.grps[String(row.grp)] : null; if (g) o.grp = g.n;
    if (nm_(row.spitze_dbfs) != null && !run) o.pk = Math.max(o.pk == null ? -1e9 : o.pk, nm_(row.spitze_dbfs));
  }
  return o;
}
function drawHover(c, X, Y, L, T, pw, ph, d, t0, t1) {
  drawMk(c, X, T, ph, d, true); drawZs(c, X, T, ph, d);
  if (hoverX == null || drag) { tipHide('live'); return; }
  const x = hoverX * d; if (x < L || x > L + pw) { tipHide('live'); return; }
  const ts = t0 + (x - L) / pw * (t1 - t0), i = lowerBound(ts); const r = recs[i];
  if (!r || r.ts - 100 > ts + 50) { tipHide('live'); return; }
  c.strokeStyle = C.tx; c.globalAlpha = .4; c.lineWidth = d; c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke(); c.globalAlpha = 1;
  if (Y) { c.fillStyle = C.acc; c.beginPath(); c.arc(x, Y(r.l), 3.5 * d, 0, 7); c.fill(); }
  const ms = new Date(ts).getMilliseconds();
  const lines = [hms(ts) + '.' + Math.floor(ms / 100), t('level') + ': ' + f1(r.l) + ' dBFS', t('background') + ': ' + f1(r.b), t('threshold') + ': ' + f1(r.t)];
  c.font = (12 * d) + 'px system-ui';
  const bw = Math.max(...lines.map(s => c.measureText(s).width)) + 16 * d, bh = lines.length * 17 * d + 10 * d;
  let bx = x + 10 * d; if (bx + bw > L + pw) bx = x - 10 * d - bw;
  const by = T + 6 * d;
  c.fillStyle = C.card; c.strokeStyle = C.bd; c.lineWidth = d; c.beginPath(); c.rect(bx, by, bw, bh); c.fill(); c.stroke();
  c.textAlign = 'left';
  lines.forEach((s, k) => { c.fillStyle = k === 0 ? C.tx : (k === 3 ? C.thr : k === 2 ? C.bgl : C.acc); c.fillText(s, bx + 8 * d, by + 20 * d + k * 17 * d); });
  if (r.a && c.canvas.id !== 'spec' && !MK.sel) {               // auf einer Störung: Einzelheiten darunter
    const rc = c.canvas.getBoundingClientRect(), k = rc.width ? c.canvas.width / rc.width : d;
    try { tipShow('live', tipHtml(liveTipAt(i)), rc.left + x / k, rc.top + (by + bh) / k + 6, bx < x); } catch (e) { tipHide('live'); }
  } else tipHide('live');
}

/* ---------- Spektrogramm ---------- */
const ring = document.createElement('canvas'); ring.width = RING; ring.height = NB;
const rctx = ring.getContext('2d');
const col1 = rctx.createImageData(1, NB);
const LUT = new Uint8ClampedArray(256 * 3);
let sLo = 40, sHi = 150, lastRange = 0;
const STOPS = [[0, 0, 4], [31, 12, 72], [85, 15, 109], [136, 34, 106], [186, 54, 85], [227, 89, 51], [249, 140, 10], [249, 201, 50], [252, 255, 164]];
function cmap(x) {
  const p = clamp(x, 0, 1) * (STOPS.length - 1), i = Math.floor(p), f = p - i, a = STOPS[i], b = STOPS[Math.min(i + 1, STOPS.length - 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
function buildLUT() { for (let v = 0; v < 256; v++) { const c = cmap((v - sLo) / (sHi - sLo)); LUT[3 * v] = c[0]; LUT[3 * v + 1] = c[1]; LUT[3 * v + 2] = c[2]; } }
function clearRing() { rctx.clearRect(0, 0, RING, NB); }
function specWrite(r) {
  const px = col1.data;
  for (let i = 0; i < NB; i++) { const o = 4 * (NB - 1 - i), v = r.sp[i]; px[o] = LUT[3 * v]; px[o + 1] = LUT[3 * v + 1]; px[o + 2] = LUT[3 * v + 2]; px[o + 3] = 255; }
  rctx.putImageData(col1, r.s % RING, 0);
}
function recolorAll() {
  const img = rctx.createImageData(RING, NB), px = img.data;
  for (const r of recs) {
    const x = r.s % RING;
    for (let i = 0; i < NB; i++) { const o = 4 * ((NB - 1 - i) * RING + x), v = r.sp[i]; px[o] = LUT[3 * v]; px[o + 1] = LUT[3 * v + 1]; px[o + 2] = LUT[3 * v + 2]; px[o + 3] = 255; }
  }
  rctx.putImageData(img, 0, 0);
}
function autoRange(i0, i1) {
  if (Date.now() - lastRange < 1000 || i1 < i0) return;
  lastRange = Date.now();
  const hist = new Uint32Array(256); let n = 0;
  const stepI = Math.max(1, Math.floor((i1 - i0) / 1500));
  for (let i = i0; i <= i1; i += stepI) { const sp = recs[i].sp; for (let k = 0; k < NB; k++) { hist[sp[k]]++; n++; } }
  if (n < 32) return;
  const pct = q => { let acc = 0; const lim = q * n; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= lim) return v; } return 255; };
  const lo = pct(0.05), hi = Math.max(pct(0.997), lo + 40);
  if (Math.abs(lo - sLo) > 4 || Math.abs(hi - sHi) > 4) { sLo = lo; sHi = hi; buildLUT(); recolorAll(); }
}
function drawSpec(cv, t0, t1) {
  fit(cv);
  const d = DPR(), c = cv.getContext('2d'), w = cv.width, h = cv.height;
  const L = AXL() * d, R = 14 * d, T = 2 * d, B = 22 * d, pw = w - L - R, ph = h - T - B;
  const X = ts => L + pw * (ts - t0) / (t1 - t0);
  const i0 = Math.max(0, lowerBound(t0 - 200)), i1 = Math.min(recs.length - 1, lowerBound(t1 + 200));
  autoRange(Math.max(0, lowerBound(t0)), Math.min(recs.length - 1, lowerBound(t1)));
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#000004'; c.fillRect(L, T, pw, ph);
  c.save(); c.beginPath(); c.rect(L, T, pw, ph); c.clip();
  c.imageSmoothingEnabled = true;
  let a = i0;
  while (a <= i1) {
    let b = a; while (b < i1 && recs[b + 1].s === recs[b].s + 1) b++;
    const n = b - a + 1, sx = recs[a].s % RING, x0 = X(recs[a].ts - 100), x1 = X(recs[b].ts);
    if (sx + n <= RING) c.drawImage(ring, sx, 0, n, NB, x0, T, x1 - x0, ph);
    else { const n1 = RING - sx, xm = x0 + (x1 - x0) * n1 / n; c.drawImage(ring, sx, 0, n1, NB, x0, T, xm - x0, ph); c.drawImage(ring, 0, 0, n - n1, NB, xm, T, x1 - xm, ph); }
    a = b + 1;
  }
  if (i1 >= i0) { const light = (ea, eb) => { c.fillStyle = C.red + '55'; c.fillRect(X(ea), T, X(eb) - X(ea), 2 * d); }; eventSpans(i0, i1, light); preRollSpans(i0, i1, light); eventSpans(i0, i1, (ea, eb) => { c.fillStyle = C.red; c.fillRect(X(ea), T, X(eb) - X(ea), 3 * d); }, true); }
  drawMk(c, X, T, ph, d, true); drawZs(c, X, T, ph, d);
  if (hoverX != null && !drag) { const x = hoverX * d; if (x >= L && x <= L + pw) { c.strokeStyle = '#fff'; c.globalAlpha = .5; c.lineWidth = d; c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke(); c.globalAlpha = 1; } }
  c.restore();
  // Frequenzachse
  c.font = (11 * d) + 'px system-ui'; c.textAlign = 'right'; c.fillStyle = C.mut;
  if (bands.length === NB) {
    const l0 = Math.log(bands[0]), l1 = Math.log(bands[NB - 1]);
    const fy = f => T + ph * (1 - ((Math.log(f) - l0) / (l1 - l0) * (NB - 1) + 0.5) / NB);
    const labs = ph / d > 110 ? [50, 100, 200, 500, 1000, 2000, 5000] : [100, 500, 2000];
    c.strokeStyle = C.mut; c.lineWidth = 1;
    for (const dec of [10, 100, 1000]) for (let m = 1; m <= 9; m++) {         // Zwischenstriche 20, 30 ... 9000 Hz
      const f = dec * m; if (f < bands[0] || f > bands[NB - 1]) continue;
      const y = Math.round(fy(f)) + .5, big = labs.includes(f);
      c.beginPath(); c.moveTo(L - (big ? 5 : 2.5) * d, y); c.lineTo(L, y); c.stroke();
      if (big) c.fillText(f >= 1000 ? (f / 1000) + 'k' : f, L - 7 * d, y + 4 * d);
    }
    c.save(); c.translate(11 * d, T + ph / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.fillText(t('hz'), 0, 0); c.restore();
  }
  // Zeitachse
  c.textAlign = 'center'; c.fillStyle = C.mut;
  for (const tk of timeTicks(t0, t1, 8, true)) { const x = X(tk); if (x >= L && x <= L + pw) c.fillRect(x - .5, T + ph, 1, 2 * d); }
  // Platz fuer "● LIVE" rechts freihalten, damit keine Uhrzeit darunter liegt
  const tf = c.font, liveTxt = '● ' + t('live'); c.font = '700 ' + (11 * d) + 'px system-ui'; const liveW = view.live ? c.measureText(liveTxt).width + 8 * d : 0; c.font = tf;
  for (const tk of timeTicks(t0, t1, Math.max(3, Math.min(8, Math.floor(pw / d / 80))))) { const x = X(tk); if (x < L || x > L + pw) continue; c.fillRect(x - .5, T + ph, 1, 5 * d); const s = hms(tk), hw = c.measureText(s).width / 2; if (x - hw < L || x + hw > L + pw - liveW) continue; c.fillText(s, x, h - 6 * d); }
  if (view.live) { c.textAlign = 'right'; c.fillStyle = C.red; c.font = '700 ' + (11 * d) + 'px system-ui'; c.fillText(liveTxt, L + pw, h - 6 * d); }
}

/* ---------- Interaktion ---------- */
let drag = null;
function bindCanvas(cv, isSpec) {
  const tAt = e => { const [a0, b0] = viewRange(), r = cv.getBoundingClientRect(); return a0 + clamp((e.clientX - r.left - AXL()) / Math.max(20, r.width - AXL() - 14), 0, 1) * (b0 - a0); };
  let mk = null, zs = null;
  cv.addEventListener('pointerdown', e => {
    if (MK.on && (!e.button)) {                      // Bereich markieren: Bild anhalten, Bereich aufziehen
      const [, end] = viewRange(); if (view.live) { view.live = false; view.end = end; setLive(false); }
      mkClose(); mk = { id: e.pointerId, a: tAt(e), x: e.clientX }; MK.sel = { live: true, a: mk.a, b: mk.a, redraw: markDirty }; cv.setPointerCapture(e.pointerId); markDirty(); return;
    }
    if (e.shiftKey && !e.button) {                    // Umschalt + Ziehen: Bereich aufziehen, darauf zoomen
      const [, end] = viewRange(); if (view.live) { view.live = false; view.end = end; setLive(false); }
      zs = { id: e.pointerId, x: e.clientX }; ZS.sel = { a: tAt(e), b: tAt(e) }; cv.setPointerCapture(e.pointerId); markDirty(); return;
    }
    const [, end] = viewRange(), r = cv.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, end, w: r.width - AXL() - 14, h: r.height - (isSpec ? 18 : 32), lo: yv.lo, hi: yv.hi, moved: false, axis: null };
    if (e.pointerType !== 'mouse') hoverX = e.clientX - r.left;   // Finger/Stift: Tippen zeigt die Werte (und Einzelheiten einer Störung)
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect(); hoverX = e.clientX - r.left;
    if (mk && e.pointerId === mk.id && MK.sel) { MK.sel.b = tAt(e); markDirty(); return; }
    if (zs && e.pointerId === zs.id && ZS.sel) { ZS.sel.b = tAt(e); markDirty(); return; }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    if (!drag.axis) {
      // senkrecht ziehen verschiebt die Skala (nur mit Auto aus, nicht im Spektrogramm), waagerecht blaettert in der Zeit
      drag.axis = (!isSpec && !yv.auto && Math.abs(dy) > Math.abs(dx)) ? 'y' : 'x';
      drag.moved = true; cv.classList.add(drag.axis === 'y' ? 'dragy' : 'drag');
      if (drag.axis === 'x' && view.live) setLive(false);
    }
    if (drag.axis === 'y') {
      yv.anchor = false;
      // Balken: die halbe Hoehe entspricht dem ganzen dB-Bereich, Pegelspur: die ganze Hoehe
      const span = drag.hi - drag.lo, ph = Math.max(40, view.mode === 'wave' ? drag.h / 2 : drag.h);
      const dv = dy / ph * span * (view.mode === 'wave' ? -1 : 1);
      let lo = drag.lo + dv, hi = drag.hi + dv;
      if (lo < -160) { hi += -160 - lo; lo = -160; } if (hi > 10) { lo -= hi - 10; hi = 10; }
      yv.lo = lo; yv.hi = hi; markDirty();
      return;
    }
    const end = drag.end - dx / Math.max(50, drag.w) * view.span * 1000, now = nowServer() - DELAY;
    if (end >= now) { setLive(true); } else { view.live = false; view.end = end; setLive(false); }
    if (!view.live && recs.length && recs[0].s <= firstAvail && end - view.span * 1000 < recs[0].ts - 1000) { drag = null; histEnter(end - view.span * 1000, end); return; }   // weiter zurück als der Arbeitsspeicher: Tagesverlauf
  });
  const up = e => {
    if (zs) {
      const m = zs, z = ZS.sel; zs = null; ZS.sel = null;
      if (z && e.type === 'pointerup' && Math.abs(e.clientX - m.x) >= 4) { const a = Math.min(z.a, z.b), b = Math.max(z.a, z.b); zoomLiveX(Math.max(5, (b - a) / 1000) / view.span, 1, b); }
      markDirty(); return;
    }
    if (mk) { const m = mk; mk = null; if (MK.sel && e.type === 'pointerup') { const a = Math.min(MK.sel.a, MK.sel.b), b = Math.max(MK.sel.a, MK.sel.b); MK.sel = null; if (Math.abs(e.clientX - m.x) < 4) { markDirty(); return; } mkOpen(selSrc, a, b, e.clientX, e.clientY, markDirty, { live: true }); } else mkClose(); markDirty(); return; }
    if (drag && drag.moved) { cv.classList.remove('drag', 'dragy'); if (e.pointerType !== 'mouse') hoverX = null; } drag = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hoverX = null; });
  document.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && e.target !== cv && hoverX != null && !e.target.closest('canvas')) hoverX = null; });
  cv.addEventListener('dblclick', () => { histExit(); setLive(true); yv.auto = true; yv.anchor = false; wg.auto = true; syncAutoBtn(); setSpan(view.preset || 60); });
  bindPinch(cv, () => viewRange(), x => clamp((x - AXL()) / Math.max(20, cv.getBoundingClientRect().width - AXL() - 14), 0, 1), (f, t2) => {   // zwei Finger: Zeit
    const ns = clamp((t2 - f) / 1000, 5, 34560000), now = nowServer() - DELAY;
    if (view.live || t2 >= now) { if (!view.live) setLive(true); setSpan(Math.round(ns * 10) / 10); }
    else { view.end = t2; setSpan(Math.round(ns * 10) / 10); }
    markDirty();
  }, () => { drag = null; }, () => { });
  cv.addEventListener('wheel', e => {
    if (!wheelGate(e, cv)) return;
    e.preventDefault();
    const u = wheelPx(e), r0 = cv.getBoundingClientRect(), xIn = e.clientX - r0.left;
    const side = Math.abs(e.deltaX) > Math.abs(e.deltaY), dy = u * (side ? e.deltaX : e.deltaY); if (!dy) return;
    const yZoom = !isSpec && (e.shiftKey || xIn < AXL()) && !side;     // Umschalt + Mausrad oder über der dB-Beschriftung: Höhe
    if (!yZoom) {
      if (side && !e.shiftKey && !e.ctrlKey) {         // seitlich wischen: in der Zeit verschieben
        const [a, b] = viewRange(), sh = dy / Math.max(50, r0.width - AXL() - 14) * (b - a), now = nowServer() - DELAY;
        const end = (view.live ? now : view.end) + sh; if (end >= now) setLive(true); else { view.live = false; view.end = end; setLive(false); } markDirty(); return;
      }
      zoomLiveX(wheelK(dy, isPinch(e)), (xIn - AXL()) / Math.max(20, r0.width - AXL() - 14)); return;   // Mausrad / Touchpad-Spreizen: Zeit
    } else {
      const f = Math.exp(clamp(dy, -300, 300) * (isPinch(e) ? 0.008 : 0.0014));   // Mausrad-Raster ≈ 15 %, Touchpad fein
      if (view.mode === 'level') {
        const r = cv.getBoundingClientRect(), g_ = view.mode === 'level' ? LOV.geo || [10, 22] : [10, 22], ph = r.height - g_[0] - g_[1], fy = clamp((e.clientY - r.top - g_[0]) / ph, 0, 1);
        zoomY(f, yv.hi - fy * (yv.hi - yv.lo));
      } else zoomY(f);
    }
  }, { passive: false });
}
/* Live-Bild: Zeit zoomen (stufenlos). Live: nur am rechten Rand bleibt „jetzt“, sonst wird angehalten; angehalten: die Stelle unter der Maus bleibt stehen.
   Weiter als der Arbeitsspeicher (10 min) geht es nahtlos in den Tagesverlauf. */
/* Live-Diagramm mit der Tastatur (Fokus mit Tab): + / − Zeit zoomen, ← / → verschieben, ↑ / ↓ Höhe, 0 zurücksetzen, Ende = live */
function bindChartKeys(cv) {
  cv.tabIndex = 0; cv.setAttribute('role', 'img');
  cv.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key, [a, b] = viewRange(), now = nowServer() - DELAY;
    const pan = f => { const end = (view.live ? now : view.end) + f * (b - a); if (end >= now) setLive(true); else { view.live = false; view.end = end; setLive(false); } markDirty(); };
    if (k === '+' || k === '=') zoomLiveX(1 / 1.5, view.live ? 1 : 0.5);
    else if (k === '-' || k === '_') zoomLiveX(1.5, view.live ? 1 : 0.5);
    else if (k === 'ArrowLeft') pan(-0.25);
    else if (k === 'ArrowRight') pan(0.25);
    else if (k === 'ArrowUp') zoomY(1 / 1.3);
    else if (k === 'ArrowDown') zoomY(1.3);
    else if (k === '0' || k === 'Home') cv.dispatchEvent(new MouseEvent('dblclick'));
    else return;
    e.preventDefault(); e.stopPropagation(); chartLabel();
  });
}
let chartLabelT = 0;
function chartLabel(force) {
  const cv = $('main'); if (!cv || (!force && Date.now() - chartLabelT < 2500)) return; chartLabelT = Date.now();
  const lv = st && st.level != null ? fdb(Math.round(st.level * 10) / 10) + ' dBFS' : '–', th = st && st.thr != null ? fdb(Math.round(st.thr * 10) / 10) + ' dBFS' : '–';
  cv.setAttribute('aria-label', t('chart_aria', { l: lv, th, s: st && st.active ? t('event') : $('pill') ? $('pill').textContent : '', w: $('span') && $('span').selectedOptions[0] ? $('span').selectedOptions[0].textContent : '' }));
}
function zoomLiveX(k, fx, end0) {
  const ns = clamp(Math.round(view.span * k * 10) / 10, 5, 34560000); if (ns === view.span) return;
  if (view.live && end0 == null) { setSpan(ns); markDirty(); return; }         // Zoomen hält Live nicht an (rechter Rand bleibt „jetzt“); nur Verschieben pausiert
  const [a, b] = viewRange(), c = a + clamp(fx, 0, 1) * (b - a), now = nowServer() - DELAY;
  let end = end0 != null ? end0 : c + (1 - clamp(fx, 0, 1)) * ns * 1000;
  if (end >= now) { setSpan(ns); setLive(true); markDirty(); return; }
  const start = end - ns * 1000;
  if (ns > 600 || (recs.length && recs[0].s <= firstAvail && start < recs[0].ts - 1000)) { view.span = ns; spanSel(ns); histEnter(start, end); return; }
  view.end = end; setSpan(ns); markDirty();
}
const ZS = { sel: null };                             // Umschalt + Ziehen: aufgezogener Bereich (Live-Bild)
function drawZs(c, X, T, ph, d) {
  const m = ZS.sel; if (!m) return; const x0 = X(Math.min(m.a, m.b)), x1 = X(Math.max(m.a, m.b));
  c.fillStyle = ca(C.acc, 0.18); c.fillRect(x0, T, Math.max(1, x1 - x0), ph); c.strokeStyle = C.acc; c.lineWidth = d; c.strokeRect(x0, T, Math.max(1, x1 - x0), ph);
}
function zoomY(f, center) {
  if (view.mode === 'level' && yv.dmn != null) {      // Pegelspur: unten bündig am tiefsten sichtbaren Wert, die Schwelle spielt keine Rolle
    const sp = clamp((yv.hi - yv.lo) * f, 1, 160), lo = Math.floor((yv.dmn - Math.max(0.3, sp * 0.03)) * 10) / 10;
    yv.lo = Math.max(-160, lo); yv.hi = Math.min(10, yv.lo + sp); yv.span = yv.hi - yv.lo; yv.anchor = true; yv.auto = false; syncAutoBtn(); markDirty(); return;
  }
  let c = center;
  if (c == null) {            // Tasten +/-: um die Mitte der sichtbaren Werte zoomen, damit die Kurve im Bild bleibt
    c = (yv.lo + yv.hi) / 2;
    if (yv.dmn != null && yv.dmx - yv.dmn < (yv.hi - yv.lo) * f) c = (yv.dmn + yv.dmx) / 2;
    else if (f < 1) {                                       // hineinzoomen: dorthin, wo die Kurve meistens liegt
      const i0 = lowerBound(viewRange()[0]), i1 = recs.length - 1, v = [];
      for (let i = Math.max(0, i0); i <= i1 && v.length < 4000; i++) if (recs[i].l > -125) v.push(recs[i].l);
      if (v.length) { v.sort((a, b) => a - b); c = v[v.length >> 1]; }
    }
  }
  let lo = c - (c - yv.lo) * f, hi = c + (yv.hi - c) * f;
  if (center == null) { const sp = (yv.hi - yv.lo) * f; lo = c - sp / 2; hi = c + sp / 2; }   // Tasten: Kurve in die Mitte holen
  if (hi - lo < 1) { lo = c - 0.5; hi = c + 0.5; }          // feinster Zoom: 1 dB ueber die ganze Hoehe
  if (hi - lo > 160) return;
  yv.lo = Math.max(-160, lo); yv.hi = Math.min(10, hi); yv.auto = false; syncAutoBtn();
}

/* ================= Status, Kennzahlen ================= */
function winText(s) { return s.bg_window + ' ' + (s.bg_unit === 'min' ? 'min' : 's'); }
function updateStatus() {
  if (!st) return;
  const p = $('pill'); p.className = 'pill'; let txt = t('quiet');
  if (st.enabled === false) { txt = t('src_off'); p.classList.add('w'); }
  else if (st.type === 'phone' && (st.age > 3 || !st.phone_online)) { txt = t('phone_wait'); p.classList.add('w'); }
  else if (st.age > 3) { txt = t('nodata'); p.classList.add('w'); }
  else if (st.silent) { txt = t('silent'); p.classList.add('w'); }
  else if (st.learning) { txt = t('learning', { p: st.learn_pct || 0 }); p.classList.add('w'); }
  else if (st.active) { txt = t('event'); p.classList.add('a'); }
  else if (st.paused) { txt = t('stopped'); p.classList.add('w'); }
  else if (st.ha_hold) { txt = t('ha_pill', { l: st.ha_hold.label }); p.classList.add('w'); }
  else if (st.ha_quiet) { txt = t('ha_qpill', { l: st.ha_quiet.label }); p.classList.add('w'); }
  else if (st.ha_raise && st.listening && txt === t('quiet')) { txt = t('ha_rpill', { l: st.ha_raise.label, d: fmtDb(st.ha_raise.db) }); }
  else if (st.sustained != null && st.listening && txt === t('quiet')) { txt = t('sus_pill', { d: fdb(st.sustained) }); }   // ab 1.85.44: Dauerpegel (Fernseher, Radio, Laptop)
  else if (st.forced) { txt = t('outside_forced'); p.classList.add('man'); }
  else if (!st.listening) { txt = t('outside'); p.classList.add('w'); }
  const clk = !!st.forced || (!st.listening && !st.paused && txt === t('outside'));
  p.classList.toggle('clk', clk); p.tabIndex = clk ? 0 : -1; p.title = clk ? t(st.forced ? 'outside_off_tip' : 'outside_on_tip') : '';
  p.tabIndex = clk ? 0 : -1;
  if (clk && (txt === t('outside') || txt === t('outside_forced'))) txt += st.forced ? ' · ⏹' : ' · ▶ ' + t('outside_go');   // Zusatz nur beim passenden Zustand
  p.onclick = clk ? async () => {
    try { await fetch('force', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: !st.forced, src: selSrc }) }); } catch (e) { }
    if (typeof poll === 'function') poll();
  } : null;
  p.textContent = txt; chartLabel();
  const E = liveCfg(selSrc), mode = CUR ? E.thr_mode : 'bounded';
  // Im Rundlauf: geraetebezogene Hinweise kompakt in der Leiste (sonst springt die Seite bei jedem Wechsel)
  const compact = TILE.on && liveDevs().length > 1, warns = [];
  const DEVB = { b_sil: 'w_sil', b_flo: 'w_flo', b_low: 'w_low', b_ha: '' };
  const ban = (id, show, html) => {
    const e = $(id), inBar = compact && id in DEVB;
    if (inBar && show) warns.push({ id, html, short: id === 'b_ha' ? '⏸ ' + t('ha_pill', { l: st.ha_hold ? st.ha_hold.label : '' }) : '⚠ ' + t(DEVB[id]) });
    e.style.display = show && !inBar ? 'block' : 'none'; if (show && e.innerHTML !== html) e.innerHTML = html;
  };
  ban('b_err', !!st.error, t('errmsg', { e: esc(st.error) }));
  { const h = st.ha_hold; ban('b_ha', !!h && !st.paused, h ? (h.until ? t('ha_banner_after', { l: esc(h.label), u: new Date(h.until).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'de-DE', { hour: '2-digit', minute: '2-digit' }) }) : t('ha_banner', { l: esc(h.label), s: esc(h.state || '') })) : ''); }
  syncRec(st);
  ban('b_sil', !st.error && st.silent, t('silentmsg'));
  ban('b_flo', !st.silent && (st.floor || st.ceil) && !BOFF.has('b_flo'), (st.floor ? t('floormsg', { v: f1(st.thr) }) : t('ceilmsg', { v: f1(st.thr) })) + BX());
  ban('b_low', !st.silent && !st.floor && st.base != null && st.base < -85 && !BOFF.has('b_low'), t('lowmsg', { v: f1(st.base) }) + BX());
  { const tw = $('tilewarn'), key = JSON.stringify(warns.map(w => w.short));
    if (tw.dataset.k !== key) { tw.dataset.k = key; tw.innerHTML = warns.map(w => `<span class="twarn${w.id === 'b_ha' ? ' ha' : ''}" title="${esc(w.html.replace(/<[^>]+>/g, '').replace('✕', '').trim())}">${esc(w.short)}</span>`).join(''); } }
  renderTiles(st, selSrc);
  if (st.all_total !== lastCount) { lastCount = st.all_total; evRefreshSoon(); }
}

/* Neue Störungen: Listen höchstens alle 5 s neu laden (Live-Tabelle: alle 15 s – bei einem lauten Handy kommt sonst alle paar Sekunden eine
   Anfrage, die auf dem Server Sekunden kostet) und nicht mitten in einer Störung (sonst ruckelt das Live-Bild) */
const EVR = { t: 0, timer: 0 };
function evRefreshSoon() {
  clearTimeout(EVR.timer);
  const wait = Math.max(0, (NV.open ? 5000 : 15000) - (Date.now() - EVR.t)) + (st && st.active && Date.now() - EVR.t < 20000 ? 2000 : 0);
  EVR.timer = setTimeout(() => { if (st && st.active && Date.now() - EVR.t < 20000) return evRefreshSoon(); EVR.t = Date.now(); loadEvents(); levLoad(); }, wait);
}
/* Kacheln (Pegel, Hintergrund, Schwelle, Geraeusch, Ereignisse) fuer ein Geraet */
function renderTiles(S, sid) {
  if (!S) return;
  const E = liveCfg(sid), mode = CUR ? E.thr_mode : 'bounded';
  { const la = S.live_art, on = !!la && S.enabled !== false && !S.silent, box = $('livart');
    box.style.display = on ? '' : 'none';
    if (on) {
      const q = la.g === 'quiet', g = la.g;
      $('vart').textContent = q ? t('live_quiet') : (ART_ICON[g] || '❓') + ' ' + artName(g);
      $('vart').style.color = q ? 'var(--mut)' : (ART_COL[g] || 'inherit');
      $('vartm').textContent = q ? '' : (g !== 'other' ? la.c + ' %' : '') + (la.top ? (g !== 'other' ? ' · ' : '') + la.top : '');
    } }
  $('vl').textContent = S.silent ? '–' : f1(S.level);
  $('vb').textContent = mode === 'fixed' ? '–' : f1(S.base);
  $('vt').textContent = f1(S.thr);
  if (CUR) {
    $('vbm').textContent = mode === 'fixed' ? t('bg_fixed') : t({ median: 'bg_median', max: 'bg_max', min: 'bg_min', mean: 'bg_mean' }[E.bg_stat] || 'bg_quiet', { w: winText(E) });
    let m = mode === 'fixed' ? t('m_fixed') : mode === 'dynamic' ? t('m_dynamic', { o: numTxt(E.offset_db) }) : t('m_bounded', { o: numTxt(E.offset_db), lo: numTxt(E.min_db), hi: numTxt(E.thr_max_db) });
    if (srcById(sid) && srcById(sid).own) m += ' · ' + t('own_tag');
    if (S.slot) m += ' · ' + t('slot_tag', { s: S.slot });
    if (S.floor) m += ' · ' + t('at_floor'); if (S.ceil) m += ' · ' + t('at_ceil');
    $('vtm').textContent = m;
  }
  $('vc').textContent = S.count_today;
  $('vct').textContent = t('today_total', { n: S.count_total }) + (SOURCES.length > 1 ? ' · ' + t('all_src', { n: S.all_today }) : '');
}
/* Rundlauf: wechselt automatisch durch alle Geraete, die live sind (Kacheln, Grafik und Live-Bild), mit Animation.
   Haelt an, solange man etwas tut: in der Zeit zurueckblaettern, anhoeren, Dialoge, Nachtbericht, kurz nach manueller Auswahl. */
const lsNum = (k, d, lo, hi) => { try { const v = +localStorage.getItem(k); return v >= lo && v <= hi ? v : d; } catch (e) { return d; } };
const TILE = { on: (() => { try { return localStorage.getItem('laerm_tileshow') !== '0'; } catch (e) { return true; } })(), at: Date.now(), manual: false, busy: false, key: '',
  ms: lsNum('laerm_tile_s', 8, 3, 120) * 1000, anim: lsNum('laerm_tile_anim', 600, 150, 3000) };
const rotActive = () => TILE.on && !TILE.manual && liveDevs().length > 1;    // Rundlauf laeuft (nicht von Hand angehalten)
/* ab 1.85.46: ein Geraet bleibt im Rundlauf, wenn es nur kurz nicht meldet (Handy: Funkloch, Sperrbildschirm) – sonst
   verschwindet die Leiste, springt zurueck und der Rundlauf wirkt unruhig. Nach 30 s ohne Meldung faellt es heraus. */
const SEEN = {}; const SEEN_MS = 30000;
function liveDevs() {
  const now = Date.now();
  return SOURCES.filter(x => { if (x.enabled === false) return false; if (x.online) SEEN[x.id] = now; return x.online || now - (SEEN[x.id] || 0) < SEEN_MS; });
}
function tileHeld() {
  return !view.live || document.hidden || NV.open || PV.open || !!document.querySelector('dialog[open]') || !!drag;
}
function tileBar() {
  const devs = liveDevs(), bar = $('tilebar'), show = devs.length > 1;
  bar.hidden = !show; if (!show) return;
  const run = rotActive(), held = run && tileHeld(), s = srcById(selSrc);
  const key = JSON.stringify([devs.map(d => d.id), selSrc, run, held, TILE.at, TILE.ms, lang]);
  if (key === TILE.key) return; TILE.key = key;
  $('tilename').textContent = (SRC_ICON[s && s.type] || '') + ' ' + (s ? s.name : '') + (s && s.rec_only ? ' · ⏺ ' + t('rec_only_b') : '');
  const left = Math.max(0, TILE.ms - (Date.now() - TILE.at));
  $('tiledots').innerHTML = devs.map(d => `<button type="button" class="tdot${d.id === selSrc ? ' cur' : ''}${run && !held && d.id === selSrc ? ' run' : ''}" data-id="${esc(d.id)}" title="${esc(d.name)}" aria-label="${esc(d.name)}" style="--dur:${left}ms;--from:${(1 - left / TILE.ms).toFixed(3)}"></button>`).join('');
  $('tiledots').querySelectorAll('.tdot').forEach(b => b.onclick = () => { TILE.manual = true; TILE.key = ''; if (b.dataset.id !== selSrc) tileGo(b.dataset.id, true); else { tileBar(); evFollow(); } });
  const pb = $('tileplay'); pb.textContent = run ? '⏸' : '▶'; pb.title = t(run ? 'tile_pause' : 'tile_play'); pb.setAttribute('aria-label', pb.title);
  bar.classList.toggle('held', held); bar.classList.toggle('stopped', !run);
}

/* Slider: der aktuelle Inhalt schiebt sich komplett nach links hinaus, das naechste Geraet gleichzeitig von rechts herein.
   Beide bleiben voll deckend. Technik: Kopie des alten Inhalts (Grafiken pixelgenau) liegt im Rahmen, darunter wird
   sofort auf das neue Geraet umgestellt; dann gleiten beide um die volle Breite. */
function slideCopy(vp) {
  const inner = vp.querySelector(':scope > .slideinner'); if (!inner) return null;
  const cl = inner.cloneNode(true); cl.classList.add('slidecopy'); cl.removeAttribute('id');
  cl.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
  const fi = inner.querySelectorAll('select,input'), fc = cl.querySelectorAll('select,input');   // aktuelle Werte der Auswahlfelder mitnehmen
  fi.forEach((f, k) => { const g = fc[k]; if (!g) return; if (f.type === 'checkbox' || f.type === 'radio') g.checked = f.checked; else g.value = f.value; });
  const src = inner.querySelectorAll('canvas'), dst = cl.querySelectorAll('canvas');
  src.forEach((c, k) => { const d = dst[k]; if (!d) return; d.width = c.width; d.height = c.height; try { d.getContext('2d').drawImage(c, 0, 0); } catch (e) { } });
  cl.querySelectorAll('.cvbtns').forEach(e => e.remove());
  vp.style.height = vp.offsetHeight + 'px';                // Hoehe waehrend der Bewegung festhalten
  vp.appendChild(cl);
  return { vp, inner, cl };
}
async function tileGo(id, now) {
  if (TILE.busy || id === selSrc) return;
  TILE.busy = true;
  try { await tileGo1(id, now); } catch (e) { console.warn('Rundlauf', e); }
  finally { TILE.at = Date.now(); TILE.busy = false; TILE.pf = null; TILE.pfp = null; tileBar(); }   // busy nie haengen lassen
}
const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
async function tileGo1(id, now) {
  const c = DCACHE[id], from = selSrc;
  if (!c || Date.now() - c.t > 4000) { try { await withTimeout(TILE.pfp || prefetchDev(id), 2500); } catch (e) { } }   // hoechstens kurz warten, sonst ohne Vorrat wechseln (Daten kommen dann live)
  if (selSrc !== from || (!now && !rotActive())) return;      // inzwischen von Hand gewaehlt
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parts = reduce ? [] : [...document.querySelectorAll('#liveview .slidevp')].filter(v => v.offsetParent).map(slideCopy).filter(Boolean);   // alle geräteabhängigen Bereiche (Kennzahlen, Graph, Video, Spuren, Spektrogramm) gleiten zusammen
  parts.forEach(p => { p.inner.style.transition = 'none'; p.inner.style.transform = 'translateX(100%)'; });
  selectSource(id, true);
  markDirty(); updateStatus();
  await withTimeout(new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))), 1000);   // neues Geraet ist gezeichnet (noch rechts ausserhalb); im Hintergrund-Tab kommt kein Frame
  const d = TILE.anim, ease = 'cubic-bezier(.65,0,.35,1)';
  parts.forEach(p => {
    p.vp.style.height = Math.max(p.vp.offsetHeight, p.inner.offsetHeight) + 'px';
    p.cl.style.transition = p.inner.style.transition = `transform ${d}ms ${ease}`;
    p.cl.style.transform = 'translateX(-100%)'; p.inner.style.transform = 'translateX(0)';
  });
  if (parts.length) await new Promise(r => setTimeout(r, d + 30));
  parts.forEach(p => { p.cl.remove(); p.inner.style.transition = p.inner.style.transform = ''; p.vp.style.height = ''; });
}
/* Einstellungen des Rundlaufs (pro Browser): Anzeigedauer je Geraet und Geschwindigkeit des Schiebens */
function tileSetPop() {
  let m = $('tilepop');
  if (!m) { m = el('div', { id: 'tilepop', className: 'hmenu tilepop' }); document.body.appendChild(m); document.addEventListener('click', e => { if (!m.hidden && !e.target.closest('#tilepop,#tileset')) m.hidden = true; }); }
  m.innerHTML = `<b>${esc(t('tile_set'))}</b>
    <label>${esc(t('tile_show'))} <span><input type="range" id="tsms" min="3" max="60" step="1" value="${TILE.ms / 1000}"> <output id="tsmsv">${TILE.ms / 1000} s</output></span></label>
    <label>${esc(t('tile_speed'))} <span><input type="range" id="tsan" min="150" max="2000" step="50" value="${TILE.anim}"> <output id="tsanv">${(TILE.anim / 1000).toFixed(2)} s</output></span></label>
    <small>${esc(t('tile_set_hint'))}</small>`;
  $('tsms').oninput = e => { TILE.ms = +e.target.value * 1000; $('tsmsv').textContent = e.target.value + ' s'; try { localStorage.setItem('laerm_tile_s', e.target.value); } catch (x) { } TILE.key = ''; tileBar(); };
  $('tsan').oninput = e => { TILE.anim = +e.target.value; $('tsanv').textContent = (TILE.anim / 1000).toFixed(2) + ' s'; try { localStorage.setItem('laerm_tile_anim', e.target.value); } catch (x) { } };
  m.hidden = false;
  const r = $('tileset').getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.right = Math.max(8, innerWidth - r.right) + 'px'; m.style.left = 'auto';
}
function tileTick() {
  const devs = liveDevs();
  if (rotActive() && !TILE.busy) {
    if (tileHeld()) TILE.at = Date.now();             // waehrend man etwas tut: Zeit laeuft nicht
    else {
      const i = devs.findIndex(d => d.id === selSrc), nx = devs[(i + 1) % devs.length].id;
      if (Date.now() - TILE.at >= TILE.ms - 2500 && TILE.pf !== nx) { TILE.pf = nx; TILE.pfp = prefetchDev(nx).catch(() => { }); }   // naechstes Geraet vorab laden (tileGo wartet hoechstens kurz darauf)
      if (Date.now() - TILE.at >= TILE.ms || i < 0) tileGo(nx);
    }
  }
  tileBar();
}
/* ================= Geraeuschart (lokale KI) ================= */
let ART_HI = new Set(); try { ART_HI = new Set(JSON.parse(localStorage.getItem('laerm_arthi') || '[]')); } catch (e) { }
let ART_MUTE = new Set(); try { ART_MUTE = new Set(JSON.parse(localStorage.getItem('laerm_artmute') || '[]')); } catch (e) { }
const artMuteSave = () => { try { localStorage.setItem('laerm_artmute', JSON.stringify([...ART_MUTE])); } catch (e) { } };
const artSilent = () => new Set(String((typeof CUR !== 'undefined' && CUR && CUR.art_silent) || '').split(',').filter(Boolean));
async function artSilentSet(g, on) {
  const q = artSilent(); if (on) q.add(g); else q.delete(g);
  try { const r = await (await fetch('settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ art_silent: [...q].join(',') }) })).json(); if (r.ok) CUR = r.settings; else toast(t('saveerr')); } catch (e) { toast(t('saveerr')); }
}
const artHiSave = () => { try { localStorage.setItem('laerm_arthi', JSON.stringify([...ART_HI])); } catch (e) { } };
const ART_ORDER = ['knock', 'door', 'steps', 'voice', 'tv', 'scrape', 'signal', 'animal', 'noise', 'other'];
const ART_ICON = { knock: '🔨', door: '🚪', steps: '👣', voice: '🗣', tv: '📺', scrape: '🔩', signal: '🔔', animal: '🐾', noise: '〰', other: '❓' };
const ART_COL = { knock: '#e0314b', door: '#e8590c', steps: '#f0a500', voice: '#7048e8', tv: '#1c7ed6', scrape: '#c2255c', signal: '#2b8a3e', animal: '#66a80f', noise: '#868e96', other: '#adb5bd' };
const artName = g => t('art_' + (ART_ORDER.includes(g) ? g : 'other'));
function artChip(g, c, man, k, lki) {               // k: Störung – dann ist das Kästchen ein Knopf zum Bestätigen oder Korrigieren; lki (ab 1.84.0): Vorschlag aus Korrekturen, Art der Erkennung
  if (!g) return '';
  const lern = lki != null && !man;
  const tip = man ? t('art_man_tip') : lern ? t('art_lern_tip', { c, k: lki ? artName(lki) : '–' }) : (c != null ? t('art_sugg', { c }) : t('art_sugg0')) + '. ' + t('art_ai_tip');
  const inner = `${ART_ICON[g] || '❓'} ${esc(artName(g))}${c != null && !man && g !== 'other' ? ` <small>${lern ? '🎓 ' : ''}${c} %</small>` : ''}`;
  if (k) return `<button type="button" class="art artck a-${g}${man ? ' man' : ''}" data-k="${esc(k)}" tabindex="-1" title="${esc(tip + ' ' + t('art_ck'))}" aria-label="${esc(artName(g) + ': ' + tip + '. ' + t('art_ck'))}">${inner}</button>`;
  return `<span class="art a-${g}${man ? ' man' : ''}" title="${esc(tip)}">${inner}</span>`;
}
function artResultHTML(res) {
  const bars = Object.entries(res.groups || {}).filter(([, v]) => v > 0).slice(0, 5).map(([g, v]) =>
    `<div class="gbar"><span>${ART_ICON[g] || ''} ${esc(artName(g))}</span><div><i style="width:${Math.max(2, v)}%;background:${ART_COL[g] || '#888'}"></i></div><span>${v} %</span></div>`).join('');
  const tl = (res.timeline || []).map(p => `<i style="background:${ART_COL[p.g] || '#888'}" title="${esc(p.t.toFixed(1) + ' s · ' + artName(p.g) + ' ' + p.pct + ' % · ' + p.db + ' dB')}"></i>`).join('');
  const used = [...new Set((res.timeline || []).map(p => p.g))];
  const leg = used.map(g => `<span><b style="color:${ART_COL[g]}">■</b> ${esc(artName(g))}</span>`).join('');
  const top = (res.top || []).slice(0, 5).map(x => `<span>${esc(x.name)} ${x.pct} %</span>`).join('');
  return `<div class="big">${ART_ICON[res.art] || '❓'} ${esc(artName(res.art))} <small>${res.art === 'other' ? esc(t('art_unclear')) : res.conf + ' % ' + esc(t('art_sure'))}</small></div>
    <div class="gbars">${bars}</div>
    ${tl ? `<div><small>${esc(t('art_timeline', { s: res.seconds }))}${res.cut ? ' · ' + esc(t('art_cut')) : ''}</small><div class="tline">${tl}</div><div class="tlleg">${leg}</div></div>` : ''}
    ${top ? `<div><small>${esc(t('art_top'))}</small><div class="topc">${top}</div></div>` : ''}`;
}
/* Einstellungen: läuft der KI-Fingerabdruck? (heute gespeichert je Gerät, übersprungen, Rechenzeit) */
async function fpStat() {
  let s = null; try { s = (await (await fetch('art_status', { cache: 'no-store' })).json()).fp; } catch (e) { }
  const b = $('fpstat'); if (!b || !s) return;
  const dv = (s.devs || []).filter(d => !DEV || d.id === DEV);
  b.textContent = !s.ki ? '⚠ ' + t(s.why === 'model' ? 'pt_kimodel' : 'fp_st_noki') : !s.on ? '⚠ ' + t('fp_st_off')
    : '✔ ' + t('fp_st_on', { d: dv.map(d => (SOURCES.length > 1 ? d.name + ': ' : '') + (d.on ? d.today : t('fp_off'))).join(' · '), s: s.skip, ms: Math.round(s.ms) });
  b.classList.toggle('warn', !s.ki || !s.on);
}
async function loadArtStatus() {
  try {
    const s = await (await fetch('art_status', { cache: 'no-store' })).json(), el = $('artstat');
    if (!s.available || !s.enabled) { el.textContent = ''; return; }
    const ln = s.learn && s.learn.on && s.learn.ex ? ' 🎓 ' + t('art_lern_st', { n: s.learn.ex }) + (s.learn.sug ? t('art_lern_sug', { s: s.learn.sug }) : '') : '';   // ab 1.84.0: Korrekturen lernen
    el.textContent = (s.pending > 0 ? '🔎 ' + t('art_running', { n: s.pending }) : (s.error ? '⚠ ' + s.error : '')) + ln;
  } catch (e) { }
}
/* Ereignisse nachtraeglich mit der KI pruefen (auch bereits eingeordnete neu) */
let ART_WAIT = 0;
async function recheckEvents(files, after) {
  files = files.filter(Boolean); if (!files.length) return;
  try {
    const r = await (await fetch('classify_events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }) })).json();
    if (!r.ok) { alert(t(r.error === 'off' ? 'art_off_msg' : 'art_err') + (r.error && r.error !== 'off' ? ' (' + r.error + ')' : '')); return; }
    if (!r.queued) { alert(t('art_noemb')); return; }
    $('artstat').textContent = '⏳ ' + t('art_recheck_run', { n: r.queued });
  } catch (e) { alert(t('saveerr') + ' ' + e.message); return; }
  clearTimeout(ART_WAIT);
  const t0 = Date.now();
  const wait = async () => {
    let s = null; try { s = await (await fetch('art_status', { cache: 'no-store' })).json(); } catch (e) { }
    if (s && s.pending > 0 && Date.now() - t0 < 600000) { $('artstat').textContent = '⏳ ' + t('art_recheck_run', { n: s.pending }); ART_WAIT = setTimeout(wait, 1500); return; }
    await loadEvents(); if (after) after();
    $('artstat').textContent = '✔ ' + t('art_recheck_done'); setTimeout(loadArtStatus, 6000);
  };
  ART_WAIT = setTimeout(wait, 1200);
}
async function classifyRange() {
  const [t0, t1] = viewRange(), box = $('classres'), b = $('classrange');
  b.disabled = true; box.hidden = false; box.textContent = '⏳ ' + t('art_analysing');
  try {
    const r = await fetch(`classify_range?src=${encodeURIComponent(selSrc)}&from=${Math.floor(t0)}&to=${Math.ceil(Math.min(t1, t0 + 60000))}`, { cache: 'no-store' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'error');
    box.innerHTML = `<div class="row"><b>${esc(t('art_range_res', { s: j.seconds }))}</b><button class="chip" id="classx" type="button">✕</button></div>` + artResultHTML(j);
    $('classx').onclick = () => { box.hidden = true; };
  } catch (e) { box.textContent = '⚠ ' + t('art_err') + ' ' + e.message; }
  b.disabled = false;
}
async function checkFile(f) {
  const box = $('chkres'), au = $('chkaudio');
  if (!f) return;
  $('chkname').textContent = f.name + ' (' + (f.size / 1048576).toFixed(1) + ' MB)';
  if (au.dataset.u) URL.revokeObjectURL(au.dataset.u);
  au.dataset.u = URL.createObjectURL(f); au.src = au.dataset.u; au.hidden = false;
  box.hidden = false; box.textContent = '⏳ ' + t('art_analysing');
  try {
    const j = await (await fetch('classify', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: f })).json();
    if (!j.ok) throw new Error(j.error || 'error');
    box.innerHTML = artResultHTML(j);
  } catch (e) { box.textContent = '⚠ ' + t('art_err') + ' ' + e.message; }
}
async function setArt(k, group) {
  try {
    const r = await (await fetch('art_set', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k, group }) })).json();
    if (!r.ok) throw new Error(r.error || 'error');
    loadEvents(); return r;
  } catch (e) { alert(t('saveerr') + ' ' + e.message); }
}
function renderEvProf(j) {                          // gelerntes Profil der Störung: anzeigen, bestätigen, ändern, lösen
  const box = $('evprof'), p = j.prof || {}, names = j.pnames || [];
  if (!names.length && !p.prof) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<span class="art prof${p.bg ? ' bgp' : ''}">🧩 ${p.prof ? esc(p.prof) + (p.prof_ok ? ' ✓' : p.prof_c != null ? ' <small>' + p.prof_c + ' %</small>' : '') : esc(t('pf_none_ev'))}${p.bg ? ' · ' + esc(t('pf_bg_short')) : ''}</span>
    ${p.prof && !p.prof_ok ? `<button type="button" class="chip" id="evpfok">✓ ${esc(t('pf_confirm'))}</button>` : ''}
    <label><small>${esc(t('pf_change'))}</small> <select id="evpfsel"><option value="">${esc(t('pf_none_opt'))}</option>${names.map(n => `<option${n === p.prof ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
  const set = async name => {
    try { await fetch('profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm', datei: EVV.row.datei, name }) }); } catch (e) { }
    const j2 = await (await fetch('event?k=' + encodeURIComponent(EVV.k), { cache: 'no-store' })).json(); if (j2.ok) renderEvProf(j2); EVSIG = ''; if (NV.open) loadEvents();
  };
  const ok = $('evpfok'); if (ok) ok.onclick = () => set(p.prof);
  $('evpfsel').onchange = e => set(e.target.value);
}
function renderEvArt(j) {
  const box = $('evart'), a = j.art, r = j.row;
  if (!r.datei) { box.innerHTML = ''; return; }
  // Neu bewerten geht nur ohne Ton: aus gespeicherten KI-Fingerabdruecken (Einstellung "KI-Fingerabdruck speichern")
  const canRe = !!(j.ki && j.ki.emb) && !(CUR && CUR.classify === false);
  const reBtn = canRe ? ` <button type="button" class="chip" id="evrecheck" title="${esc(t('art_recheck_tip'))}">🔎 ${esc(t('art_recheck'))}</button>` : '';
  const bindRe = () => { const b = $('evrecheck'); if (b) b.onclick = () => { b.disabled = true; b.textContent = '⏳ ' + t('art_analysing'); recheckEvents([r.datei], async () => { const j2 = await (await fetch('event?k=' + encodeURIComponent(EVV.k), { cache: 'no-store' })).json(); if (j2.ok && $('evdlg').open) { renderEvArt(j2); EVV.marks = (j2.ki && j2.ki.marks) || []; evDraw(); } }); }; };
  if (!a) {
    box.innerHTML = `<span class="art a-other">❓ ${esc(t(CUR && CUR.classify === false ? 'art_off_short' : j.legacy ? 'art_none' : 'art_pending'))}</span>` + reBtn;
    bindRe(); return;
  }
  const fm = {}; for (const m of (j.ki && j.ki.marks) || []) fm[m[2]] = Math.max(fm[m[2]] || 0, m[3]);
  const g = a.man || a.g, fk = Object.keys(fm).sort((u, v) => fm[v] - fm[u]).slice(0, 3);
  const top = fk.length ? fk.map(k => `${esc(((j.fine || {})[k] || {}).name || k)} ${fm[k]} %`).join(' · ') : (a.top || []).slice(0, 3).map(x => `${esc(x[0])} ${x[1]} %`).join(' · ');
  const kd = kindsHTML(j.ki && j.ki.kinds, j.fine);                 // Liste, was alles vorkam (mit Anzahl bzw. Dauer)
  box.innerHTML = `${artChip(g, a.c, !!a.man)}${kd ? `<span class="evkinds" title="${esc(t('kinds_col'))}">${kd}</span>` : `<span title="${esc(t('art_top'))}"><small>${top}</small></span>`}${reBtn}
    <label class="chip" title="${esc(t('art_hi_tip'))}"><input type="checkbox" id="evarthi"${ART_HI.has(g) ? ' checked' : ''}> ${esc(t('art_hi'))}</label>
    <label class="chip" title="${esc(t('art_mute_tip'))}"><input type="checkbox" id="evartmu"${ART_MUTE.has(g) ? ' checked' : ''}> ${esc(t('art_mute'))}</label>
    <label class="chip" title="${esc(t('art_silent_tip'))}"><input type="checkbox" id="evartsi"${artSilent().has(g) ? ' checked' : ''}> ${esc(t('art_silent'))}</label>
    <label><small>${esc(t('art_correct'))}</small> <select id="evartsel"><option value="">${esc(t('art_auto'))}</option>${ART_ORDER.map(x => `<option value="${x}"${a.man === x ? ' selected' : ''}>${ART_ICON[x]} ${esc(artName(x))}</option>`).join('')}</select></label>`;
  bindRe();
  $('evarthi').onchange = e => { if (e.target.checked) ART_HI.add(g); else ART_HI.delete(g); artHiSave(); window.dispatchEvent(new Event('resize')); };
  $('evartmu').onchange = e => { if (e.target.checked) ART_MUTE.add(g); else ART_MUTE.delete(g); artMuteSave(); window.dispatchEvent(new Event('resize')); };
  $('evartsi').onchange = e => artSilentSet(g, e.target.checked);
  $('evartsel').onchange = async e => {
    const r2 = await setArt(EVV.k, e.target.value);
    if (r2) { const j2 = await (await fetch('event?k=' + encodeURIComponent(EVV.k), { cache: 'no-store' })).json(); if (j2.ok) renderEvArt(j2); }
  };
}

/* ================= Ereignisse ================= */
let EV = null;
let EVN = (() => { try { const v = localStorage.getItem('laerm_evn'); return v == null ? 200 : +v; } catch (e) { return 200; } })();   // Anzahl Zeilen (0 = alle)
async function loadEvents() {
  if (!NV.open) return;                             // Ereignisliste gibt es nur im Reiter Protokolle
  const q = perQuery(); if (q == null) return;
  const want = q + '&n=' + EVN, fresh = want !== EVQ;
  if (fresh) busy(EV_AREAS, true);
  if (EVWAIT) { EVWAIT = false; busy(EV_AREAS, false); }   // ab hier zählt die Abfrage der Liste selbst
  try { const j = await (await fetch('events?' + want, { cache: 'no-store' })).json(); if (want !== perQuery() + '&n=' + EVN) return; EV = j; EVQ = want; renderEvents(); loadArtStatus(); } catch (e) { }
  finally { if (fresh) busy(EV_AREAS, false); }
}
var EVQ = '', EVWAIT = false;                         // EVQ: Abfrage der gezeigten Liste; EVWAIT: Liste wartet noch auf die Kopfdaten
function renderEvents() {
  if (!EV) return;
  const mxh = Math.max(1, ...EV.hours);
  $('hours').innerHTML = EV.hours.map((c, h) => `<div class="hb" title="${h}:00 – ${c}"><em>${c || ''}</em><i style="height:${Math.round(100 * c / mxh)}%"></i><span>${h}</span></div>`).join('');
  const mxd = Math.max(1, ...EV.days.map(x => x[1]));
  tabGrid($('days'), `<table><tr><th>${t('date')}</th><th></th><th>${t('count')}</th></tr>` + (EV.days.length ? EV.days.map(([d, c]) =>
    `<tr><td>${esc(fmtDay(d))}</td><td class="bw"><div class="dbar" style="width:${Math.max(3, Math.round(100 * c / mxd))}%"></div></td><td>${c}</td></tr>`).join('') : `<tr><td colspan="3" class="empty">${t('none')}</td></tr>`) + '</table>');
  const useArt = !CUR || CUR.classify !== false;
  syncLabelFilter(); sfltBuild();
  $('artflt').querySelectorAll('option').forEach(o => { if (o.value && o.value !== '_notes' && !o.value.startsWith('lb:')) o.hidden = !useArt; }); artMsBuild();
  const one = (r, flt) => flt === '_notes' ? r.notes > 0 : flt.startsWith('lb:') ? (r.labels || []).includes(flt.slice(3)) : !useArt ? true : flt === '_none' ? !r.art : r.art === flt;
  const evs = EV.events.filter(r => !mfHide(r)); for (const r of evs) r.__hid = evSrcHid(r) || !!(ARTSEL.size && ![...ARTSEL].some(f => one(r, f)));   // ab 1.85.23: ausgeblendete bleiben in Ereignissen mit sichtbarem Sensor/Notiz   // Musterfilter: ausgefilterte nur mit „ausgefilterte zeigen“   // Art: Mehrfachauswahl, eine passende genügt
  // Nur neu aufbauen, wenn sich etwas geaendert hat. Der Player ist von der Tabelle getrennt: Wiedergabe laeuft weiter.
  const grpMode = EVVIEW === 'grp';
  const sv = sensAll();
  const sig = JSON.stringify([useArt, lang, grpMode, [...SHIDE], [...ARTSEL], evs.map(r => [r.k, r.ha_on, r.raise_on, r.start, r.art, r.art_c, r.art_man, r.video, r.audio, r.datei, r.notes, r.labels, r.kinds, r.prof, r.prof_c, r.prof_ok, r.inc, r.grp, r.lead, r.devs, r.bg, r.mf, r.art_ok, r.sc]), MF.show, SOURCES.map(x => [x.id, x.name]), sv, [...SHIDE]]);
  const sig2 = sig + JSON.stringify([(EV.fnotes || []).map(n => [n.id, n.a, n.b, n.text, n.tags, n.witness]), fnShow(), EV.fn_pre_min, EV.fn_post_min]);
  const ss = $('scsum'); if (ss) { const tx = scSumTxt(EV.sc_sum); ss.textContent = tx; ss.hidden = !tx; }
  if (sig2 === EVSIG) return;
  EVSIG = sig2;
  evGrid(evs, sv, useArt, grpMode);
}
/* ================= Ereignistabelle (AG Grid, siehe glGrid) =================
   Eine Zeile je Störung bzw. Sensor-Ereignis; Gruppen als aufklappbare Zeilen (Kindzeilen unter der Gruppe).
   Sortieren per Klick auf die Spaltenüberschrift, Filter mit Mehrfachauswahl unter Quelle und Art. */
let TBL = null, TBL_KEY = '', EVDATA = [], TBLEXT = null;
const SEL = new Set();                               // ausgewählte Störungen (Schlüssel k) – überlebt Neuzeichnen, Sortieren, Filtern
const ek = r => r.k || `${r.start}|${r.quelle_id || 'main'}|${r.datei || ''}|0`;
function evSrcName(r) { const s = SOURCES.find(x => x.id === (r.quelle_id || 'main')); return r.quelle || (s && s.name) || r.quelle_id || ''; }
function evTags(r) { const a = []; for (const id of r.mf || []) a.push('⊘ ' + mfInfo(id).name); if (r.prof) a.push('🧩 ' + r.prof); for (const n of r.labels || []) a.push('🏷 ' + n); if (r.art) a.push((ART_ICON[r.art] || '') + ' ' + artName(r.art)); return a; }
/* Freie Notizen als eigene Zeilen, automatisch der Störung zugeordnet (ab 1.82): Ereigniszeit der Notiz (nicht die Erfassungszeit)
   im Fenster [Störungsbeginn − Vorlauf, Störungsende + Nachlauf] (Standard −2 / +15 min), bei mehreren die nächste zum Beginn.
   Notizen zählen nie als Sensor-Bestätigung. Rückgabe je Notiz: [Notiz, Störung oder null, Abstand ms (Notiz − Störungsbeginn)] */
const fnWin = (j, n) => { j = j || {};                // GReport-Notizen eigenes Fenster (ab 1.83, Standard −10 / +30 min)
  if (n && n.asg) return [n.asg.pre * 60000, n.asg.post * 60000];
  if (n && n.gr) return [(j.fn_gr_pre_min != null ? +j.fn_gr_pre_min : 10) * 60000, (j.fn_gr_post_min != null ? +j.fn_gr_post_min : 30) * 60000];
  const post = j.fn_post_min != null ? +j.fn_post_min : j.fn_assign_min != null ? +j.fn_assign_min : 15; return [(j.fn_pre_min != null ? +j.fn_pre_min : 2) * 60000, post * 60000]; };
function fnLink(notes, evs, j) {                       // Zuordnung kommt vom Server (n.asg, auch „von Hand“); sonst hier nach dem Fenster
  const span = r => { const a = new Date(r.start).getTime(); return [a, a + (+r.dauer_s || 0) * 1000 + 100]; };
  const lst = (evs || []).map(r => [r, ...span(r)]);
  return (notes || []).map(n => {
    if (n.asg) { const ev = n.asg.k ? (evs || []).find(r => (r.k || '') === n.asg.k) || null : null; return [n, ev, ev ? n.asg.d : null]; }
    const a = n.a, b = Math.max(n.b || a, a), [pre, post] = fnWin(j, n);
    let best = null, bd = 1e18;
    for (const [r, s0, s1] of lst) {
      if ((r.quelle_id || 'main') !== (n.src || 'all') && (n.src || 'all') !== 'all') continue;
      if (a <= s1 + post && b >= s0 - pre) { const dd = (j && j.fn_pick === 'near') ? Math.abs(s0 - a) : -(+r.spitze_dbfs || -999); if (dd < bd) { bd = dd; best = r; } }   // ab 1.85.26: lauteste im Fenster (Einstellung)
    }
    return [n, best, best ? a - new Date(best.start).getTime() : null];
  });
}
/* „Notiz zugeordnet (5 min danach)“ – automatisch, mit Fenster */
function fnAsgD(dms) { const s = Math.round(Math.abs(dms) / 1000), m = Math.round(s / 60), v = s < 60 ? s + ' s' : m + ' min'; return s < 5 ? t('fn_asg_same') : t(dms >= 0 ? 'fn_asg_after' : 'fn_asg_before', { v }); }   // „5 min danach“
function fnAsgTxt(dms) { return t('fn_asg', { d: fnAsgD(dms) }); }
function fnAsgHow(n, j) {                              // „automatisch (Fenster −2 / +15 min)“ bzw. „von Hand“, dazu „2 weitere möglich“
  const [pre, post] = fnWin(j, n), a = n.asg || {};
  return (a.man ? t('fn_asg_man') : t('fn_asg_auto', { a: pre / 60000, b: post / 60000 })) + (a.n > 1 ? ' · ' + t('fn_asg_more', { n: a.n - 1 }) : '');
}
function fnAsgHTML(list, j) {
  if (!list || !list.length) return '';
  return list.map(([n, dms]) => `<div class="fnrowt fnon" title="${esc(t('fn_on_ev'))}">📝 <small class="fnasg${(n.asg || {}).man ? ' fnman' : ''}">${esc(fnAsgTxt(dms))} · ${esc(fnAsgHow(n, j))}</small> ${fnText(n)}</div>`).join('');
}
/* ---------- Sensor-Bestätigung (nur Anzeige, auf dem Server beim Lesen berechnet) ---------- */
const SC_IC = { ok: '✓', no: '○', nb: '⊘', own: '⌂' }, SC_ST = ['ok', 'no', 'nb', 'own'];
const scSec = d => { const a = Math.abs(d); return (a < 10 ? numTxt(String(Math.round(a * 10) / 10)) : String(Math.round(a))) + ' s'; };
const scDt = d => d == null ? '' : Math.abs(d) < 0.5 ? t('sc_same') : t(d > 0 ? 'sc_after' : 'sc_before', { s: scSec(d) });
const scLabel = st => t('sc_f_' + st);
function scAria(sc) {
  if (sc.s === 'ok') return t('sc_a_ok', { n: sc.n, m: sc.m }) + (sc.first ? '; ' + sc.first[0] + ' ' + scDt(sc.first[1]) : '');
  if (sc.s === 'no') return t('sc_a_no', { m: sc.m });
  if (sc.s === 'nb') return sc.nb && sc.nb.length ? t('sc_a_nb2', { s: sc.nb.map(x => x[0] + ' ' + t('sc_wy_' + x[1])).join(', ') }) : t('sc_a_nb');
  return t('sc_a_own', { s: (sc.own || []).map(x => x[0] + (x[1] != null ? ' ' + scDt(x[1]) : '')).join(', ') });
}
function scChip(sc) {
  if (!sc || !sc.s) return '';
  const lab = sc.s === 'ok' ? t('sc_c_ok', { n: sc.n, m: sc.m }) : sc.s === 'no' ? t('sc_c_no', { m: sc.m }) : t('sc_c_' + sc.s), a = scAria(sc);
  return `<span class="scc sc-${sc.s}" role="img" aria-label="${esc(a)}" title="${esc(a)}"><span aria-hidden="true">${SC_IC[sc.s]}</span> ${esc(lab)}</span>`;
}
function scOf(d) {                                     // Zustand einer Tabellenzeile (Gruppe: der „stärkste“ ihrer Störungen)
  if (d._t === 'ev') return (d.r.sc || {}).s || '';
  if (d._t === 'grp') { const ss = (d._children || []).map(scOf); return ['own', 'ok', 'no', 'nb'].find(x => ss.includes(x)) || ''; }
  return '';
}
function scSumTxt(sm) {
  if (!sm || !sm.n) return '';
  let x = t('sc_sum', { ok: sm.ok, chk: sm.chk, no: sm.no });          // ab 1.85.32: in ganzen Sätzen, leere Teile weg
  if (sm.nb) x += ' ' + t('sc_sum_nb', { nb: sm.nb });
  if (sm.own) x += ' ' + t('sc_sum_own', { own: sm.own });
  if (sm.exp != null && sm.chk) {
    x += ' ' + (sm.exp < 0.1 ? t('sc_sum_exp0') : t('sc_sum_exp', { e: numTxt(String(Math.round(sm.exp * 10) / 10)) }));
    if (sm.exp >= 0.5 && sm.ok <= sm.exp * 1.5 + 1) x += ' ' + t('sc_sum_chance');            // nicht mehr als Zufall: offen sagen
  }
  return x;
}
function scPct(p) { if (p == null) return '–'; const v = p * 100; return v < 1 ? t('sc_p_lt1') : t('sc_p_ca', { v: v < 10 ? numTxt(v.toFixed(1)) : Math.round(v) }); }
const scWin = y => '−' + y.pre + ' / +' + y.post + ' s';
function scWhy(y) {
  const w = y.why;
  if (w === 'offline') return t('sc_w_off', { a: y.off ? fmtWhen(new Date(y.off[0]).toISOString()) : '', b: y.off ? clockOf(new Date(y.off[1]).toISOString()) : '' });
  if (w === 'lock') return t('sc_w_lock', { s: scSec(y.ago_s), l: y.lock });
  if (w === 'active') return t('sc_w_active', { s: scSec(y.since_s) });
  if (w === 'nodata') return t('sc_w_nodata');
  if (w === 'clock') return t('sc_w_clock', { s: Math.abs(y.clock_off || 0) });
  if (w === 'running') return t('sc_w_running');
  return '';
}
function renderEvSc(sc) {
  const box = $('evscbox'); if (!box) return;
  const res = sc && sc.on ? sc.res || [] : [];
  box.hidden = !res.length; if (!res.length) return;
  $('evschead').innerHTML = esc(t('sc_head')) + ' ' + scChip(sc.sum);
  const st = y => t('sc_r_' + y.st), role = y => t('sc_role_' + y.role);
  $('evsclist').innerHTML = `<table class="sctab"><caption class="sr">${esc(t('sc_head'))}</caption><thead><tr><th scope="col">${esc(t('sc_t_sens'))}</th><th scope="col">${esc(t('sc_t_res'))}</th><th scope="col">Δt</th><th scope="col">${esc(t('sc_t_win'))}</th><th scope="col">${esc(t('sc_t_p'))}</th><th scope="col">${esc(t('sc_t_note'))}</th></tr></thead><tbody>` +
    res.map(y => `<tr class="sc-${y.st}"><th scope="row">${esc(y.name)}<small>${esc(role(y))}</small></th><td><span class="scc sc-${y.st === 'free' ? 'no' : y.st}"><span aria-hidden="true">${SC_IC[y.st === 'free' ? 'no' : y.st]}</span> ${esc(st(y))}</span></td>
      <td>${y.dt != null ? esc((y.dt > 0 ? '+' : y.dt < 0 ? '−' : '±') + scSec(y.dt)) : '–'}</td><td>${esc(scWin(y))}${y.lock ? `<small>${esc(t('sc_t_lock', { l: y.lock }))}</small>` : ''}</td>
      <td>${y.role === 'ok' && (y.st === 'ok' || y.st === 'no') ? esc(scPct(y.p)) + (y.per_h != null ? `<small>${esc(t('sc_rate', { r: numTxt(String(y.per_h)), d: numTxt(String(y.days)) }))}${y.unsure ? ' · ' + esc(t('sc_unsure')) : ''}</small>` : '') : '–'}</td>
      <td>${esc([scWhy(y), y.near != null ? t('sc_near', { d: (y.near > 0 ? '+' : '−') + scSec(y.near), w: scWin(y) }) : '', y.same && y.role === 'ok' ? t('sc_same_dev') : ''].filter(Boolean).join(' · '))}</td></tr>`).join('') + '</tbody></table>';
  $('evscrule').textContent = t('sc_rule');
  const ck = $('evscclock'); if (ck) ck.innerHTML = clockHTML(sc.clock);
}
/* Uhrabgleich (ab 1.83): „Uhrabgleich: Abweichung Home Assistant 0 s, Handy 1 s“ – grob auf Sekunden, Warnung über der Schwelle */
function clockTxt(ck) {
  if (!ck) return '';
  const k = (ck.items || []).filter(x => x.off != null);
  if (!k.length) return t('ck_none');
  return t('ck_txt', { s: k.map(x => (x.kind === 'ha' ? 'Home Assistant' : t('ck_phone', { n: x.name.replace(/^(Handy|Phone) /, '') })) + ' ' + Math.abs(x.off) + ' s').join(', ') });
}
function clockHTML(ck) {
  if (!ck) return '';
  return `<p class="scclock${ck.warn ? ' warn' : ''}">${ck.warn ? `<span class="ckbadge" role="img" aria-label="${esc(t('ck_warn_a', { s: ck.warn_s }))}" title="${esc(t('ck_warn_a', { s: ck.warn_s }))}"><span aria-hidden="true">⚠</span> ${esc(t('ck_warn'))}</span> ` : ''}${esc(clockTxt(ck))}${ck.warn ? ' – ' + esc(t('ck_warn_h', { s: ck.warn_s })) : ''}</p>`;
}
/* ---------- Sensor-Spuren (ab 1.83): je Sensor eine dünne Spur unter dem Pegelverlauf, live und im Verlauf gleich gezeichnet ----------
   Auslösungen (steigende Flanken) als Marken, Zeit „an“ als schmaler Balken, „nicht erreichbar“ schraffiert, Suchfenster der gewählten
   Störung als weiches Band. Gemeinsame Zeitachse: gleiche Ränder (L, R) wie der Graph darüber. Text dazu als aria-label, die Tabelle bleibt die Textfassung. */
const SL = { sel: null, c: {} }, SL_H = 10, SL_GAP = 4, SL_LH = 14;   // je Spur: Name darüber (SL_LH), Balken (SL_H)
function slSel(k, start) { const t0 = new Date(start).getTime(); SL.sel = k && isFinite(t0) ? { k, t0 } : null; slRedraw(); }
function slRedraw() { for (const id of ['scmain', 'scld', 'scnd']) { const c = SL.c[id]; if (c && c.last) slPaint(id, ...c.last); } }
function slGet(id, from, to, maxAge) {             // Daten der Spuren (zwischengespeichert, mit Rand zum Schieben)
  const c = SL.c[id] || (SL.c[id] = { a: 0, b: 0, at: 0, data: null, busy: false, last: null });
  const fresh = c.data && from >= c.a && to <= c.b && Date.now() - c.at < maxAge;
  if (!fresh && !c.busy) {
    const sp = Math.max(60000, to - from), a = Math.floor(from - sp * 0.5), b = Math.ceil(to + sp * 0.5);
    c.busy = true;
    fetch('sclanes?from=' + a + '&to=' + b, { cache: 'no-store' }).then(r => r.json()).then(j => { if (j && j.ok) { c.data = j; c.a = a; c.b = b; c.at = Date.now(); if (c.last) slPaint(id, ...c.last); } })
      .catch(() => { c.at = Date.now(); }).finally(() => { c.busy = false; });
  }
  return c.data;
}
function slDraw(id, from, to, L, R, maxAge, ax) {    // von den Graphen aufgerufen (L, R: Ränder in CSS-Pixeln wie im Graphen; ax: eigene Zeitachse, wenn darüber kein Graph steht)
  const host = $(id); if (!host) return;
  const c = SL.c[id] || (SL.c[id] = { a: 0, b: 0, at: 0, data: null, busy: false, last: null });
  c.last = [from, to, L, R, !!ax]; slGet(id, from, to, maxAge || 15000); slPaint(id, from, to, L, R, !!ax);
}
function slHide(id) { const h = $(id); if (h) h.hidden = true; const c = SL.c[id]; if (c) c.last = null; }
function slPaint(id, from, to, L, R, ax) {
  const host = $(id), c0 = SL.c[id], j = c0 && c0.data; if (!host) return;
  const lanes = j && j.on ? j.lanes || [] : [];
  if (!lanes.length) { host.hidden = true; return; }
  host.hidden = false;
  let cv = host.querySelector('canvas'), lg = host.querySelector('.sclg');
  if (!cv) { cv = el('canvas'); cv.setAttribute('aria-hidden', 'true'); lg = el('div', { className: 'sclg' }); lg.setAttribute('aria-hidden', 'true'); host.append(cv, lg); }
  const own = lanes.some(x => x.role === 'own'), hasOff = lanes.some(x => (x.off || []).some(([a, b]) => b > from && a < to)), hasDown = (j.down || []).some(([a, b]) => b > from && a < to),
    hasSel = !!(SL.sel && SL.sel.t0 >= from && SL.sel.t0 <= to), lk = [lang, own, hasOff, hasDown, hasSel].join();   // Legende: nur, was zu sehen ist (gleich live und im Verlauf)
  if (lg.dataset.k !== lk) { lg.dataset.k = lk; lg.innerHTML = `<span><i class="sclk ed"></i>${esc(t('sl_edge'))}</span>${own ? `<span><i class="sclk ed own"></i>${esc(t('sl_edge_own'))}</span>` : ''}<span><i class="sclk on"></i>${esc(t('sl_on'))}</span>${hasOff ? `<span><i class="sclk off"></i>${esc(t('sl_off'))}</span>` : ''}${hasDown ? `<span><i class="sclk down"></i>${esc(t('sl_down'))}</span>` : ''}${hasSel ? `<span><i class="sclk win"></i>${esc(t('sl_win'))}</span>` : ''}`; }
  const LANE = SL_LH + SL_H + SL_GAP, H = lanes.length * LANE + SL_GAP + (ax ? 16 : 0); cv.style.height = H + 'px'; fit(cv);
  const d = DPR(), g = cv.getContext('2d'), w = cv.width, pw = w - (L + R) * d, X = t2 => L * d + pw * (t2 - from) / (to - from);
  g.clearRect(0, 0, w, cv.height); g.textBaseline = 'middle';
  for (const [a, b] of (j.down || [])) {                                                         // GLighter lief nicht: über alle Spuren, schlicht grau (kein Sensorfehler)
    const x0 = X(Math.max(a, from)), x1 = X(Math.min(b, to)); if (x1 - x0 < 0.5) continue;
    g.fillStyle = ca(C.mut, 0.14); g.fillRect(x0, 0, x1 - x0, lanes.length * LANE * d); }
  const sel = SL.sel && SL.sel.t0 >= from - 3600000 && SL.sel.t0 <= to + 3600000 ? SL.sel : null, say = [];
  lanes.forEach((ln, i) => {
    const yl = (SL_GAP + i * LANE) * d, y = yl + SL_LH * d, hh = SL_H * d, col = ln.role === 'own' ? C.thr : ln.role === 'ctx' ? C.mut : C.acc;
    g.save(); g.beginPath(); g.rect(L * d, y, pw, hh); g.clip();
    g.fillStyle = ca(C.mut, 0.22); g.fillRect(L * d, y + hh / 2 - 0.5 * d, pw, 1 * d);               // Spur: dünne Grundlinie statt grauem Kasten
    for (const [a, b] of ln.off || []) {                                                         // nicht erreichbar: schraffiert
      const x0 = X(Math.max(a, from)), x1 = X(Math.min(b, to)); if (x1 - x0 < 0.5) continue;
      g.save(); g.beginPath(); g.rect(x0, y, x1 - x0, hh); g.clip(); g.fillStyle = ca(C.mut, 0.12); g.fillRect(x0, y, x1 - x0, hh);
      g.strokeStyle = ca(C.mut, 0.55); g.lineWidth = d; g.beginPath(); for (let x = x0 - hh; x < x1; x += 5 * d) { g.moveTo(x, y + hh); g.lineTo(x + hh, y); } g.stroke(); g.restore(); }
    if (sel) { const a = sel.t0 - (ln.pre || 0) * 1000, b = sel.t0 + (ln.post || 0) * 1000, x0 = X(a), x1 = Math.max(x0 + 2 * d, X(b));   // Suchfenster der gewählten Störung
      g.fillStyle = ca(C.tx, 0.13); g.fillRect(x0, y, x1 - x0, hh); g.fillStyle = ca(C.tx, 0.6); g.fillRect(X(sel.t0) - 0.5 * d, y, 1 * d, hh); }
    for (const [a, b] of ln.on || []) { const x0 = X(a), x1 = Math.max(x0 + 1, X(b)); g.fillStyle = ca(col, 0.35); g.fillRect(x0, y + hh * 0.35, x1 - x0, hh * 0.3); }   // Zeit „an“
    g.fillStyle = col; let lx = -1e9;
    for (const e of ln.edges || []) { const x = X(e); if (x < L * d - 2 || x > L * d + pw + 2) continue; if (x - lx < 1) continue; g.fillRect(x - 1 * d, y + 1 * d, 2 * d, hh - 2 * d); lx = x; }   // Auslösung
    g.restore();
    const nm = ln.name;                                                                           // Name über der Spur – verdeckt keine Marken
    g.font = '600 ' + (11 * d) + 'px system-ui'; g.fillStyle = C.tx; g.textAlign = 'left'; g.fillText(nm, L * d, yl + SL_LH * d / 2);
    if (ln.nodata) { const tw = g.measureText(nm).width; g.font = (10.5 * d) + 'px system-ui'; g.fillStyle = C.mut; g.fillText('· ' + t('sl_nodata'), L * d + tw + 6 * d, yl + SL_LH * d / 2); }
    const ne = (ln.edges || []).filter(e => e >= from && e <= to), no = (ln.off || []).filter(([a, b]) => b > from && a < to);
    say.push(t('sl_a_lane', { s: nm, n: ne.length + (ln.cut ? '+' : '') }) + (no.length ? ', ' + t('sl_a_off', { r: no.slice(0, 3).map(([a, b]) => hms(Math.max(a, from)).slice(0, 5) + '–' + hms(Math.min(b, to)).slice(0, 5)).join(', ') + (no.length > 3 ? ' …' : '') }) : '')
      + (sel ? ', ' + t('sl_a_win', { a: ln.pre, b: ln.post, c: hms(sel.t0) }) : ''));
  });
  if (ax) {                                          // Zeitachse (nur ohne Graph darüber, z. B. Tag ohne Tagesaufzeichnung)
    const sp = to - from, st = [1e3, 2e3, 5e3, 1e4, 3e4, 6e4, 12e4, 3e5, 6e5, 9e5, 18e5, 36e5, 72e5, 108e5, 216e5, 432e5, 864e5].find(q => sp / q <= Math.max(3, Math.floor(pw / d / 80))) || 864e5;
    const tz = new Date(from).getTimezoneOffset() * 60000, y0 = (lanes.length * LANE + SL_GAP) * d;
    g.fillStyle = C.mut; g.font = (10.5 * d) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'top';
    for (let t2 = Math.ceil((from - tz) / st) * st + tz; t2 <= to; t2 += st) { const x = X(t2), dd = new Date(t2); g.fillRect(x - 0.5 * d, y0, 1 * d, 3 * d);
      g.fillText(st >= 864e5 ? pad(dd.getDate()) + '.' + pad(dd.getMonth() + 1) + '.' : pad(dd.getHours()) + ':' + pad(dd.getMinutes()) + (st < 6e4 ? ':' + pad(dd.getSeconds()) : ''), x, y0 + 4 * d); }
  }
  host.setAttribute('aria-label', t('sl_a', { a: hms(from).slice(0, 5), b: hms(to).slice(0, 5) }) + ' ' + say.join('; ') + '.');
}
const fnShow = () => !SHIDE.has('_fn') && (!ARTSEL.size || ARTSEL.has('_notes') || ARTSEL.has('_fn'));
const fnText = n => `${n.gr ? '<span class="art grsrc" title="' + esc(t('gr_from_tip')) + '">GReport</span>' : ''}${n.kind_l ? `<span class="fbkind sm" style="--kc:${esc(/^#[0-9a-f]{6}$/i.test(n.kind_c || '') ? n.kind_c : '#5f6b78')}"${n.noassign ? ` title="${esc(t('fk_noassign'))}"` : ''}>${n.kind_i ? esc(n.kind_i) + ' ' : ''}${esc(n.kind_l)}</span>` : ''}${n.notime ? `<span class="art mut" title="${esc(t('fk_notime_l'))}">${esc(t('fk_notime'))}</span>` : ''}${(n.tags || []).map(ntTag).join('')}${n.text ? `<span class="ntt" title="${esc(n.text)}">${esc(n.text)}</span>` : ''}${n.witness ? `<span class="ntw">👤 ${esc(n.witness)}</span>` : ''}${fbx(n)}`;
function evRows(evs, sv, grpMode) {
  const G = EV.grps || {}, out = [], seen = new Map();
  const one = r => ({ _t: 'ev', _hid: !!r.__hid, id: ek(r), r, start: new Date(r.start).getTime(), src: evSrcName(r), tags: evTags(r), dur: +r.dauer_s || 0, pk: r.spitze_dbfs, thr: r.schwelle_dbfs, bg: r.hintergrund_dbfs });
  for (const r of evs) {
    if (grpMode && r.inc != null && !r.lead) continue;      // gleiche Störung an mehreren Geräten: eine Zeile (lautestes Gerät), Spalte „Geräte“ zeigt die anderen
    const g = grpMode && r.grp != null ? G[r.grp] : null;
    if (g && g.n > 1) {
      let p = seen.get(r.grp);
      if (!p) { p = { _t: 'grp', id: 'g' + r.grp, gid: String(r.grp), g, start: new Date(g.a).getTime(), src: '', tags: [], dur: +g.dur || 0, pk: null, _children: [] }; seen.set(r.grp, p); out.push(p); }
      const c = one(r); p._children.push(c); for (const x of c.tags) if (!p.tags.includes(x)) p.tags.push(x); if (!p.src) p.src = c.src; else if (p.src !== c.src && !p.srcs) p.srcs = true;
      if (c.pk != null && (p.pk == null || c.pk > p.pk)) p.pk = c.pk;
    } else out.push(one(r));
  }
  const fnV = fnShow(); for (const [n, ev, dms] of fnLink(EV.fnotes, EV.events, EV)) {
    out.push({ _t: 'note', _hid: !fnV, id: 'n:' + n.id, n, ev, dms, start: n.a, src: (n.src || 'all') === 'all' ? t('all_sources') : viewName(n.src), tags: ['📝 ' + t('fn_row')].concat(n.kind_l ? [(n.kind_i ? n.kind_i + ' ' : '') + n.kind_l] : []), dur: Math.max(0, ((n.b || n.a) - n.a) / 1000), pk: null });
    if (ev) for (const d of out) if (d._t === 'ev' && d.r === ev) (d.fn = d.fn || []).push([n, dms]);   // auch an der Störung sichtbar, mit Abstand
  }
  for (const x of sv) out.push({ _t: 'sens', _hid: !!x.__hid, id: 's:' + x.key, x, start: x.a, src: x.kind === 'ha' ? 'Home Assistant' : x.name || '', tags: [sensIcon(x.kind) + ' ' + sensLabel(x)], dur: Math.max(0, (x.b - x.a) / 1000), pk: x.peak != null ? x.peak : null });
  const res = evVisible(grpMode ? evCluster(out, EV || {}) : out);
  res.sort((a, b) => b.start - a.start);
  return res;
}
/* ab 1.85.18: in der Gruppen-Ansicht zusammenfassen – (1) Sensor-Ereignisse und Notizen, die in eine Störungsgruppe fallen (bis „Gruppe endet … s nach der
   letzten Störung“), (2) eine Notiz mit allen Störungen und Sensor-Ereignissen in ihrem Zeitfenster (Einstellungen „Notiz gehört zur Störung …“). Nur Anzeige. */
function evCluster(out, j) {
  const mix = j.grp_mix !== false, fng = j.fn_grp !== false; if (!mix && !fng) return out;
  const tail = (j.grp_tail_s != null ? +j.grp_tail_s : j.group_pause_s != null ? +j.group_pause_s : 120) * 1000;
  const itv = c => c._t === 'ev' ? [c.start, c.start + (c.dur || 0) * 1000] : c._t === 'note' ? [c.n.a, Math.max(c.n.b || c.n.a, c.n.a)] : c._t === 'sens' ? [c.x.a, Math.max(c.x.b || c.x.a, c.x.a)] : [c.start, c.start];
  const U = out.map(d => { const ch = d._t === 'grp' ? d._children : [d]; let a = Infinity, b = -Infinity, ev = false; for (const c of ch) { const [x, y] = itv(c); if (x < a) a = x; if (y > b) b = y; if (c._t === 'ev') ev = true; } return { d, ch, a, b, ev }; });
  const P = U.map((_, i) => i), f = i => { while (P[i] !== i) { P[i] = P[P[i]]; i = P[i]; } return i; }, un = (i, k) => { const x = f(i), y = f(k); if (x !== y) P[y] = x; };
  const evs = U.map((u, i) => [u, i]).filter(([u]) => u.ev), oth = U.map((u, i) => [u, i]).filter(([u]) => !u.ev);
  if (mix) {                                         // ein Ereignis läuft weiter, solange binnen „Gruppe endet … s“ nach dem letzten Eintrag wieder etwas kommt (Störung, Sensor oder Notiz)
    const ord = U.map((u, i) => i).sort((x, y) => U[x].a - U[y].a); let last = -1, end = -Infinity;
    let evEnd = -Infinity;                           // ab 1.85.35: spätestes Ende einer Störung bis hier (statt jedes Mal alle Störungen zu durchsuchen)
    for (const i of ord) { const u = U[i]; if (last >= 0 && u.a <= end + tail && (u.ev || U[last].ev || evEnd + tail >= U[last].a)) un(last, i); else if (last >= 0 && u.a > end + tail) end = -Infinity; end = Math.max(end, u.b); if (u.ev) evEnd = Math.max(evEnd, u.b); last = i; }
  }
  if (fng) { const ord = U.map((u, i) => i).sort((x, y) => U[x].a - U[y].a), A = ord.map(i => U[i].a), md = Math.max(0, ...U.map(u => u.b - u.a));
    const lb = v => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m] < v) lo = m + 1; else hi = m; } return lo; };
    for (const [n, i] of oth) { if (n.d._t !== 'note') continue; const [pre, post] = fnWin(j, n.d.n);   // ab 1.85.35: nur Einträge im Zeitfenster ansehen
      for (let q = lb(n.a - post - md); q < A.length && A[q] <= n.b + pre; q++) { const k = ord[q], u = U[k];
        if (k !== i && (u.d._t !== 'note' ? u.b >= n.a - post && u.a <= n.b + pre : u.a >= n.a - post && u.a <= n.b + pre)) un(i, k); } } }   // auch mehrere Notizen im selben Zeitfenster
  const by = new Map(); U.forEach((u, i) => { const r = f(i); (by.get(r) || by.set(r, []).get(r)).push(u); });
  const res = [];
  for (const us of by.values()) {
    if (us.length === 1) { res.push(us[0].d); continue; }
    const ch = us.flatMap(u => u.ch).sort((x, y) => itv(x)[0] - itv(y)[0]), a = Math.min(...us.map(u => u.a)), b = Math.max(...us.map(u => u.b));
    const base = (us.find(u => u.d._t === 'grp') || {}).d, g = Object.assign({}, base ? base.g : {}, { a: new Date(a).toISOString(), b: new Date(b).toISOString(), n: ch.length, mix: true,
      ne: ch.filter(c => c._t === 'ev').length, nn: ch.filter(c => c._t === 'note').length, ns: ch.filter(c => c._t === 'sens').length });
    const gid = 'm' + String(ch[0].id);
    const p = { _t: 'grp', id: 'g' + gid, gid, g, start: a, src: '', tags: [], dur: (b - a) / 1000, pk: null, _children: ch };
    for (const c of ch) { for (const x of c.tags || []) if (!p.tags.includes(x)) p.tags.push(x); if (!p.src) p.src = c.src; else if (c.src && p.src !== c.src) p.srcs = true; if (c.pk != null && c._t === 'ev' && (p.pk == null || c.pk > p.pk)) p.pk = c.pk; }
    res.push(p);
  }
  return res;
}
function grpSpan(p) { let a = Infinity, b = -Infinity; for (const c of p._children || []) { const x = c._t === 'note' ? [c.n.a, Math.max(c.n.b || c.n.a, c.n.a)] : c._t === 'sens' ? [c.x.a, Math.max(c.x.b || c.x.a, c.x.a)] : [c.start, c.start + (c.dur || 0) * 1000]; a = Math.min(a, x[0]); b = Math.max(b, x[1]); } return [a, Math.max(b, a + 1000)]; }
function grpShow(p, live) {                           // ab 1.85.22: ganzer Zeitraum des Ereignisses im Graphen (erster bis letzter Eintrag, mit Rand), markiert
  const [a, b] = grpSpan(p), pad = Math.max(15000, (b - a) * 0.08);
  if (live) { liveJump(a, b, grpN(p.g)); return; }
  DT.mark = [a, b]; DT.from = a - pad; DT.to = b + pad; dtLoad(DT, true);
}
/* Pillen einer Gruppe zusammenfassen: gleiche Art (Text ohne Zahlen/Zeiten) nur einmal, dahinter „×n“; Verweise einer Notiz auf eine Störung entfallen */
function pillMerge(list, max) {                       // ab 1.85.24: nur echte Pillen (.art/.kd), gleiche einmal mit Summe „×n“, nach Anzahl sortiert, höchstens max, Rest als „+n“
  max = max || 3; const tmp = document.createElement('div'), seen = new Map();
  for (const h of list) { if (!h) continue; tmp.innerHTML = h;
    for (const e of tmp.querySelectorAll('.art, .kd')) { if (e.matches('.fnlk, .grpmix') || e.parentElement.closest('.art, .kd')) continue;
      const bx = e.querySelector('b'), bt = bx ? bx.textContent.trim() : '', mul = /^×\s*(\d+)$/.exec(bt);
      const lab = e.cloneNode(true); lab.querySelectorAll('b, small, .pcnt').forEach(x => x.remove());
      const key = lab.textContent.replace(/[\d.,:%]+\s*(s|min)?/g, '').replace(/\s+/g, ' ').trim(); if (!key) continue;
      const add = mul ? +mul[1] : 1, o = seen.get(key);
      if (o) o.n += add; else seen.set(key, { lab, n: add, title: key }); } }
  const all = [...seen.values()].sort((a, b) => b.n - a.n);       // alle, nach Anzahl; was nicht in die Spalte passt, blendet pmFit aus und zählt es in „+n“
  return '<span class="pmerge">' + all.map(x => { const l = x.lab; l.classList.add('pm'); l.dataset.t = x.title + ' ×' + x.n; l.insertAdjacentHTML('beforeend', ` <b class="pcnt">×${x.n}</b>`); return l.outerHTML; }).join('')
    + '<span class="art pmore" hidden></span></span>';
}
function pmFit(root) {                                // Pillen einer zusammengefassten Zeile: so viele wie in die Spalte passen, Rest als „+n“ (Liste beim Darüberfahren)
  for (const el of (root || document).querySelectorAll('.pmerge')) {
    const ps = [...el.querySelectorAll(':scope > .pm')], mo = el.querySelector(':scope > .pmore'); if (!mo || !el.clientWidth) continue;
    // ab 1.85.35: einmal messen, dann in einem Durchgang ein-/ausblenden (vorher: Layout je ausgeblendeter Pille)
    ps.forEach(x => { x.hidden = false; }); mo.hidden = false; mo.textContent = '+' + ps.length;
    const cw = el.clientWidth, gap = parseFloat(getComputedStyle(el).columnGap) || 4, mw = mo.offsetWidth + gap, ws = ps.map(x => x.offsetWidth + gap);
    const tot = ws.reduce((a, b) => a + b, 0); let keep = ps.length;
    if (tot - gap > cw + 1) { let w = mw; keep = 0; for (let i = 0; i < ps.length && w + ws[i] <= cw + 1; i++) { w += ws[i]; keep++; } keep = Math.max(1, keep); }
    const n = ps.length - keep; ps.forEach((x, i) => { x.hidden = i >= keep; }); mo.hidden = !n;
    if (n) { mo.textContent = '+' + n; mo.title = ps.slice(keep).map(x => x.dataset.t).join(', '); }
  }
}
const fmtSpan = v => { const x = +v || 0; return x >= 60 ? Math.floor(x / 60) + ':' + String(Math.round(x % 60)).padStart(2, '0') + ' min' : fmtDur(x); };   // Dauer eines Ereignisses
/* Filter (Sensoren/Art/Notizen) erst nach dem Zusammenfassen: ein Ereignis bleibt, wenn etwas darin sichtbar ist – dann ganz, mit allen Einträgen */
function evVisible(rows) {                             // ab 1.85.35: in einem Ereignis nur die sichtbaren Einträge (z. B. „nur Sensoren“); bleibt einer, steht er allein
  const out = [];
  for (const d of rows) {
    if (d._t !== 'grp') { if (!d._hid) out.push(d); continue; }
    const ch = d._children.filter(c => !c._hid);
    if (!ch.length) continue;
    if (ch.length === d._children.length) { out.push(d); continue; }
    if (ch.length === 1) { delete ch[0]._pid; out.push(ch[0]); continue; }
    out.push(grpOf(d, ch));
  }
  return out;
}
function grpOf(p, ch) {                                // Gruppe mit einem Teil ihrer Einträge (Kopf: Zeitraum, Anzahl, Spitze, Pillen nur daraus)
  const iv = c => c._t === 'note' ? [c.n.a, Math.max(c.n.b || c.n.a, c.n.a)] : c._t === 'sens' ? [c.x.a, Math.max(c.x.b || c.x.a, c.x.a)] : [c.start, c.start + (c.dur || 0) * 1000];
  let a = Infinity, b = -Infinity; for (const c of ch) { const [x, y] = iv(c); a = Math.min(a, x); b = Math.max(b, y); }
  const g = Object.assign({}, p.g, { a: new Date(a).toISOString(), b: new Date(b).toISOString(), n: ch.length, mix: true,
    ne: ch.filter(c => c._t === 'ev').length, nn: ch.filter(c => c._t === 'note').length, ns: ch.filter(c => c._t === 'sens').length });
  const q = Object.assign({}, p, { g, start: a, dur: (b - a) / 1000, pk: null, tags: [], src: '', srcs: false, _children: ch });
  for (const c of ch) { for (const x of c.tags || []) if (!q.tags.includes(x)) q.tags.push(x); if (!q.src) q.src = c.src; else if (c.src && q.src !== c.src) q.srcs = true; if (c.pk != null && c._t === 'ev' && (q.pk == null || c.pk > q.pk)) q.pk = c.pk; }
  return q;
}
const grpN = g => g && g.mix ? t('grp_nx', { n: g.n }) + ' (' + [[g.ne, 'grp_pe'], [g.ns, 'grp_ps'], [g.nn, 'grp_pf']].filter(x => x[0]).map(([v, k]) => t(k, { v })).join(', ') + ')' : t('grp_n', { n: g.n });   // ab 1.85.35: Einzahl/Mehrzahl, leere Teile weg
/* Detailansicht einer Gruppe: alle Störungen, Sensor-Ereignisse und Notizen des Zeitraums, jede einzeln zu öffnen, dazu „Im Verlauf zeigen“ */
function grpOpen(p) {
  let d = $('grpdlg'); if (!d) { d = el('dialog', { id: 'grpdlg', className: 'evdlg prognd grpdlg' }); d.setAttribute('aria-labelledby', 'grpdlgh'); document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d) d.close(); }); }
  const g = p.g, a = new Date(g.a).getTime(), b = new Date(g.b).getTime(), ev = p._children.filter(c => c._t === 'ev');
  const row = (c, i) => { const w = c._t === 'ev' ? '📈' : c._t === 'note' ? '📝' : sensIcon(c.x.kind);
    const what = c._t === 'ev' ? esc(c.src) + (c.tags.length ? ' · ' + esc(c.tags.join(', ')) : '') : c._t === 'note' ? esc(c.n.text || (c.n.tags || []).map(x => ntLabel(x)).join(', ') || t('fn_row')) : esc(sensLabel(c.x));
    const val = c._t === 'ev' ? esc(fmtDur(c.dur)) + (c.pk != null ? ' · ' + esc(fdb(c.pk)) + ' dBFS' : '') : c._t === 'sens' && c.dur ? esc(fmtDur(c.dur)) : '';
    return `<li class="grpit"><span class="grpic" aria-hidden="true">${w}</span><b class="grpt">${esc(clockOf(new Date(c.start).toISOString()))}</b><span class="grpw">${what}</span><small class="mut">${val}</small><button type="button" class="chip grpgo" data-i="${i}">${esc(t('grp_open1'))}</button></li>`; };
  const chips = [[t('grp_c_ev'), ev.length], [t('grp_c_sens'), g.ns || 0], [t('grp_c_fn'), g.nn || 0]].filter(x => x[1]).map(([l, n]) => `<span class="chip">${n} ${esc(l)}</span>`).join('');
  d.innerHTML = `<div class="dh"><h3 id="grpdlgh">🗂 ${esc(clockOf(g.a))}–${esc(clockOf(g.b))} · ${esc(fmtDur((b - a) / 1000))}</h3><button type="button" class="grpx" aria-label="${esc(t('a_close'))}">✕</button></div>
    <div class="dbody"><div class="grpchips">${chips}${p.pk != null ? `<span class="chip">${esc(t('peak'))} ${esc(fdb(p.pk))} dBFS</span>` : ''}</div>
    <ol class="grplist">${p._children.map(row).join('')}</ol></div>
    <div class="df"><button type="button" class="chip grpgraph">📈 ${esc(t('grp_graph'))}</button><span class="grow"></span><button type="button" class="pri grpdone">${esc(t('a_close'))}</button></div>`;
  d.querySelector('.grpx').onclick = d.querySelector('.grpdone').onclick = () => d.close();
  d.querySelector('.grpgraph').onclick = () => { d.close(); NV.open ? dtFocus(...grpSpan(p)) : grpShow(p, true); };
  d.querySelectorAll('.grpgo').forEach(bt => bt.onclick = () => { const c = p._children[+bt.dataset.i]; d.close();
    if (c._t === 'ev') openEvent(c.k || c.id); else if (c._t === 'note') fnOpenId(c.n); else if (c._t === 'sens') { if (c.x.kind === 'ha') haPop({ a: c.x.a, b: c.x.b, name: sensLabel(c.x), note: c.x.note || '', key: c.x.key }); else dtFocus(c.x.a, c.x.b); } });
  d.showModal(); setTimeout(() => d.querySelector('.grpdone').focus(), 50);
}
function evAllEv() { const out = []; if (!TBL) return out; const walk = rows => { for (const d of rows) { if (d._t === 'ev') out.push(d); if (d._children) walk(d._children); } }; walk(TBL.top()); return out; }
let EVCUR = '', EVMENU = '';                          // zuletzt im Verlauf gezeigte Störung, Zeile mit offenem Menü ⋮
const NARW = { start: 70, dur: 58 };                 // Handy: Mindestbreiten, damit neben „Start“ noch Dauer/Quelle passen
const narWhen = iso => { const d = new Date(iso); if (isNaN(d)) return ''; const td = new Date(nowServer()); return (d.toDateString() === td.toDateString() ? '' : pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '. ') + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
function evSelToggle(keys, on) {                     // eine Störung = alle Geräte: Auswahl gilt für alle Zeilen derselben Störung
  for (const k of keys) { const r = EV.events.find(y => ek(y) === k); const sib = r && r.inc != null ? EV.events.filter(y => y.inc === r.inc).map(ek) : [k]; for (const x of sib) on ? SEL.add(x) : SEL.delete(x); }
  if (TBL) TBL.redraw();
  syncDelBar();
}
function evGrid(evs, sv, useArt, grpMode) {
  const box = $('events'); if (!box || typeof agGrid === 'undefined') return;
  const data = EVDATA = evRows(evs, sv, grpMode), hasDev = evs.some(r => (r.devs || []).length > 1), hasPlay = evs.some(r => r.play);
  const clipHTML = r => `${r.audio ? `<span class="sndmk" title="${esc(t('snd_mark'))}">🔊</span>` : ''}${r.video ? `<button class="vbtn" type="button" title="${esc(t('vid_open'))}" aria-label="${esc(t('vid_open'))}">🎥</button>` : ''}${r.clip_s && !(r.datei || '').endsWith('.ltv') ? `<span class="cs">${esc(r.clip_s)} s</span>` : ''}`;
  const hasSc = evs.some(r => r.sc && r.sc.s), hasClip = evs.some(r => clipHTML(r) !== ''), hasKinds = useArt && evs.some(r => kindsHTML(r.kinds, EV.fine) !== '');   // „Spur“ und „Was vorkam“ nur, wenn mindestens eine Zeile dort etwas zeigt
  const valid = new Set(EV.events.map(ek)); for (const k of [...SEL]) if (!valid.has(k)) SEL.delete(k);
  const nar = matchMedia('(max-width:600px)').matches, key = JSON.stringify([lang, useArt, nar]);
  const chk = d => d._t === 'ev' ? `<input type="checkbox" class="ckc" tabindex="-1"${SEL.has(d.id) ? ' checked' : ''} aria-label="${esc(t('ev_sel'))}">`
    : d._t === 'grp' ? `<input type="checkbox" class="ckg" tabindex="-1"${d._children.filter(c => c._t === 'ev').every(c => SEL.has(c.id)) ? ' checked' : ''} aria-label="${esc(t('sel_all'))}">` : '';
  const profChip = r => r.prof ? `<span class="art prof${r.bg ? ' bgp' : ''}" title="${esc(t(r.prof_ok ? 'pf_ok_tip' : 'pf_auto_tip'))}">🧩 ${esc(r.prof)}${r.prof_ok ? ' ✓' : r.prof_c != null ? ` <small>${r.prof_c} %</small>` : ''}${r.bg ? ' · ' + esc(t('pf_bg_short')) : ''}</span>` : '';
  const srcHTML = r => srcCell(r).replace(/^<td[^>]*>/, '').replace(/<\/td>$/, '');
  const cols = [
    { f: 'sel', title: t('sel_all'), sort: false, w: nar ? 32 : 40, prio: 0, cls: 'ck', hide: true,
      head: () => { const c = document.createElement('input'); c.type = 'checkbox'; c.id = 'ckall'; c.title = t('sel_all'); c.setAttribute('aria-label', t('sel_all')); c.onclick = e => e.stopPropagation(); c.onchange = () => { evSelToggle(evAllEv().map(d => d.id), c.checked); }; setTimeout(syncDelBar, 0); return c; },
      html: chk,
      click: (e, d) => { if (d._t === 'ev') evSelToggle([d.id], !SEL.has(d.id)); else if (d._t === 'grp') { const evc = d._children.filter(c => c._t === 'ev'), all = evc.every(c => SEL.has(c.id)); evSelToggle(evc.map(c => c.id), !all); } } },
    { f: 'play', title: t('ev_play_snd'), sort: false, w: 48, vis: hasPlay, prio: 0, cls: 'pl', hide: true,
      html: d => d._t === 'ev' && d.r.play ? `<button class="pbtn" type="button" aria-label="${esc(t('ev_play_snd'))}" title="${esc(t('ev_play_snd'))}">▶</button>` : '',
      click: (e, d) => { if (d._t === 'ev' && e.target.closest('.pbtn')) { e.stopPropagation(); openEvent(d.id, null, true); } else return false; } },
    { f: 'start', title: t('start'), sort: 'num', minW: nar ? 120 : 230, grow: 2, prio: 0, cls: 'tm',
      html: d => (d._t === 'grp' ? `<button type="button" class="gtog" tabindex="-1" aria-expanded="${EVOPEN.has(d.gid) ? 'true' : 'false'}" aria-label="${esc(t('g_grp'))}">${EVOPEN.has(d.gid) ? '▾' : '▸'}</button><b title="${esc(grpN(d.g))}">${esc(clockOf(d.g.a).slice(0, 5))}${nar ? '' : '–' + esc(clockOf(d.g.b).slice(0, 5))}</b>${grpBadge(d)}<span class="sr">${esc(grpN(d.g))}</span>`
        : d._t === 'sens' ? `${esc(fmtWhen(new Date(d.x.a).toISOString()))}${d.x.note ? `<span class="ntc" title="${esc(d.x.note)}">📝</span>` : ''}`
        : d._t === 'note' ? `${esc(fmtWhen(new Date(d.n.a).toISOString()))}${d.n.b > d.n.a ? '–' + esc(d.n.clock_to || '') : ''}${d.n.rz ? ' 🌙' : ''}`
        : `${esc(nar ? narWhen(d.r.start) : fmtWhen(d.r.start))}${d.r.notes ? `<span class="ntc" title="${esc(t('nt_title', { n: d.r.notes }))}">📝 ${d.r.notes}</span>` : ''}`) },
    { f: 'src', title: t('src_col'), minW: 160, grow: 2, prio: 2, cls: 'srcc', flt: 'ms',
      vals: () => [...new Set(EVDATA.flatMap(function f(d) { return [d.src].concat((d._children || []).flatMap(f)); }).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
      html: d => d._t === 'ev' ? srcHTML(d.r) : d._t === 'note' ? `<span class="si">📝</span><span class="sn"><b>${esc(d.src)}</b></span>` : d._t === 'sens' ? `<span class="si">${d.x.kind === 'ha' ? '🏠' : '📱'}</span><span class="sn"><b>${esc(d.src)}</b></span>` : d.srcs ? '<span class="mut">…</span>' : `<span class="sn"><b>${esc(d.src)}</b></span>` },
    { f: 'tags', title: t('art_col'), minW: nar ? 110 : 210, grow: 2, vis: useArt, prio: 1, cls: 'artc', sort: false, flt: 'ms',
      vals: () => [...new Set(EVDATA.flatMap(function f(d) { return d.tags.concat((d._children || []).flatMap(f)); }).concat(((EV && EV.ha_names) || []).filter(x => x[1] === 'event').map(x => sensIcon('ha') + ' ' + x[0])))].sort((a, b) => a.localeCompare(b)),
      fpass: (v, d) => (d.tags || []).some(x => v.includes(x)),
      html: d => {
        if (d._t === 'sens') return `<span class="art sensc">${sensIcon(d.x.kind)} ${esc(sensLabel(d.x))}</span>${d.x.note ? `<div class="hant">📝 ${esc(d.x.note)}</div>` : ''}`;
        if (d._t === 'note') return `<span class="art fnc">📝 ${esc(t('fn_row'))}</span>${d.ev ? `<button type="button" class="chip fnlink" tabindex="-1" title="${esc(t('fn_link_tip'))}">🔗 ${esc(t('fn_link', { c: clockOf(d.ev.start) }))}</button> <small class="fnasg${(d.n.asg || {}).man ? ' fnman' : ''}">${esc(fnAsgHow(d.n, EV))}</small>` : (d.n.asg && d.n.asg.man ? ` <small class="fnasg fnman">${esc(t('fn_asg_detached'))}</small>` : '')}<div class="fnrowt">${fnText(d.n)}</div>`;
        if (d._t === 'grp' && d._children && d._children.length) return pillMerge(d._children.map(c => cols.find(x => x.f === 'tags').html(c)));   // ab 1.85.23: gleiche Pillen der Gruppe einmal, mit Anzahl
        if (d._t === 'grp') return d.g.prof ? `<span class="art prof">🧩 ${esc(d.g.kind)}</span>` : d.g.kind && d.g.kind !== '?' ? artChip(d.g.kind, null, false) : esc(t('art_pending'));
        const r = d.r; return `${fnAsgHTML(d.fn, EV)}${(r.ha_on || []).filter(n => !SHIDE.has('ha:' + n)).map(n => `<span class="art haon" title="${esc(t('ha_on_tip'))}">📡 ${esc(n)} ${esc(t('ha_on'))}</span>`).join('')}${(r.raise_on || []).map(x => `<span class="art haraisec" title="${esc(t('ha_raise_tip'))}">📈 ${esc(x[0])} +${esc(fmtDb(x[1]))} dB</span>`).join('')}${profChip(r)}${(r.labels || []).map(n => `<span class="art lbl" title="${esc(t('lb_own'))}">🏷 ${esc(n)}</span>`).join('')}${mfChip(r)}${r.art && !(r.prof && r.art === 'other' && !r.art_man) ? artChip(r.art, r.art_c, r.art_man || r.art_ok, CUR && CUR.classify === false ? '' : r.k, r.art_lern != null ? r.art_lki : null) : (r.datei && !(r.labels || []).length && !r.prof ? '<span class="noclip" title="' + esc(t('art_pending')) + '">…</span>' : (r.labels || []).length || r.prof ? '' : '<span class="noclip">–</span>')}`; } },
    { f: 'sc', title: t('sc_col'), minW: 165, vis: hasSc, prio: 3, sort: false, cls: 'scol', flt: 'ms', aria: t('sc_col_a'),
      vals: () => SC_ST.map(scLabel), fpass: (v, d) => v.includes(scLabel(scOf(d))),
      html: d => d._t === 'ev' ? (scChip(d.r.sc) || '<span class="noclip">–</span>') : '<span class="noclip">–</span>' },
    { f: 'kinds', title: t('kinds_col'), minW: 150, grow: 2, vis: hasKinds, prio: 4, sort: false, cls: 'kinds', html: d => (d._t === 'ev' ? kindsHTML(d.r.kinds, EV.fine) : d._t === 'grp' ? pillMerge(d._children.filter(c => c._t === 'ev').map(c => kindsHTML(c.r.kinds, EV.fine))) : '') || '<span class="noclip">–</span>' },
    { f: 'devs', title: t('devs_col'), minW: 130, vis: hasDev, prio: 5, sort: false, cls: 'devc',
      html: d => { if (d._t !== 'ev') return ''; const x = d.r.devs || []; if (x.length < 2) return '<span class="noclip">–</span>';
        return x.map((v, i) => `<span class="dvp${i === 0 ? ' top' : ''}${v[3] === d.r.k ? ' own' : ''}" title="${esc(v[1])}">${esc(shortName(v[1]))} ${v[2] != null ? v[2].toFixed(0) : '–'}</span>`).join(''); } },
    { f: 'dur', title: t('dur'), sort: 'num', minW: 90, prio: 2, cls: 'dur', html: d => d._t === 'grp' ? esc(fmtSpan(d.dur)) : d._t === 'note' && !d.dur ? '–' : esc(fmtDur(d.dur)) + (d._t === 'sens' && d.x.open ? ' · ' + esc(t('mot_open')) : '') },
    { f: 'pk', title: t('peak'), sort: 'num', minW: 105, prio: 3, cls: 'pk',
      html: d => d.pk == null ? '<span class="noclip">–</span>' : d._t === 'sens' ? esc(f2(d.pk)) + ' <small>' + esc(d.x.unit || '') + '</small>' : esc(fdb(d.pk)) + ' <small>dBFS</small>' },
    { f: 'thr', title: t('thr_col'), sort: 'num', minW: 120, prio: 6, html: d => d._t === 'ev' ? esc(fdb(d.thr)) : d._t === 'grp' && d._children.some(c => c._t === 'ev') ? esc(fdb(Math.min(...d._children.filter(c => c._t === 'ev').map(c => c.thr)))) : '<span class="noclip">–</span>' },
    { f: 'bg', title: t('bg_col'), sort: 'num', minW: 140, prio: 6, html: d => d._t === 'ev' ? esc(fdb(d.bg)) : d._t === 'grp' && d._children.some(c => c._t === 'ev') ? esc(fdb(Math.max(...d._children.filter(c => c._t === 'ev').map(c => c.bg)))) : '<span class="noclip">–</span>' },
    { f: 'clip', title: t('spur_col'), sort: false, minW: 70, vis: hasClip, prio: 5, cls: 'clipc',
      html: d => d._t === 'ev' ? clipHTML(d.r) : '',
      click: (e, d) => { if (d._t === 'ev' && e.target.closest('.vbtn')) { e.stopPropagation(); openEvent(d.id); } else return false; } },
    { f: 'act', title: t('actions'), sort: false, w: nar ? 40 : 50, prio: 0, cls: 'act', hide: true,
      html: d => d._t === 'ev' ? `<button class="more" type="button" tabindex="-1" title="${esc(t('actions'))}" aria-label="${esc(t('actions'))}" aria-haspopup="menu">⋮</button>` : d._t === 'note' ? `<button class="sned" type="button" tabindex="-1" title="${esc(t('nt_edit'))}" aria-label="${esc(t('nt_edit'))}">✎</button>` : d._t === 'sens' ? `<button class="sned" type="button" tabindex="-1" title="${esc(t('ha_note'))}" aria-label="${esc(t('ha_note'))}">✎</button>` : '',
      click: (e, d, cell) => { e.stopPropagation();
        if (d._t === 'ev') { const b = (cell || e.target).getBoundingClientRect(); openRowMenu(evRowRef(d, cell), b.right - 190, b.bottom + 4); }
        else if (d._t === 'sens') haPop({ a: d.x.a, b: d.x.b, name: sensLabel(d.x), note: d.x.note || '', key: d.x.key });
        else if (d._t === 'note') fnOpenId(d.n); } },
  ];
  if (!TBL || TBL_KEY !== key) {
    if (TBL) { TBL.destroy(); TBL = null; }
    TBL_KEY = key;
    TBL = glGrid(box, {
      cols, rows: data, max: '75vh', ph: t('none'), key: 'gl_evtbl_sort', wkey: 'prot_ev', colAt: document.querySelector('#nightview .evacts'), sort: [{ colId: 'start', sort: 'desc' }], label: t('events'),
      isOpen: p => EVOPEN.has(p.gid || ''), ext: d => !TBLEXT || TBLEXT(d), kid: kidCell,
      rowCls: d => { const a = []; if (d._t === 'grp') a.push('grph'); if (d._t === 'sens') a.push('sensr'); if (d._t === 'note') a.push('fnr');
        if (d._t === 'ev' && SEL.has(d.id)) a.push('sel'); if (d._t === 'ev' && d.id === EVCUR) a.push('cur'); if (d._t === 'ev' && d.id === EVMENU) a.push('menu');
        if (d._t === 'ev' ? d.r.bg || d.r.inc_bg : d._t === 'grp' && d.g.bg) a.push('bgrow'); return a; },
      onRow: (e, d, rowEl) => { if (e.target.closest && e.target.closest('input,button:not(.gtog),a,.ck')) { if (!(d._t === 'note' && e.target.closest('.fnlink'))) return; }
        if (d._t === 'ev') dtJump(d.id);
        else if (d._t === 'grp') { EVOPEN.has(d.gid) ? EVOPEN.delete(d.gid) : EVOPEN.add(d.gid); TBL.redraw(x => x === d); TBL.refilter(); grpShow(d, false); }
        else if (d._t === 'sens') { const x = d.x; dtFocus(x.a, x.b); }
        else if (d._t === 'note') { if (e.target.closest && e.target.closest('.fnlink') && d.ev) { openEvent(ek(d.ev)); return; } dtFocus(d.n.a, Math.max(d.n.b || d.n.a, d.n.a + 1000)); } },
      onDbl: (e, d) => { if (e.target.closest('input,button,a')) return; if (d._t === 'grp') { grpOpen(d); return; } if (d._t === 'ev') openEvent(d.id); else if (d._t === 'note') fnOpenId(d.n); else if (d._t === 'sens' && d.x.kind === 'ha') haPop({ a: d.x.a, b: d.x.b, name: sensLabel(d.x), note: d.x.note || '', key: d.x.key }); },
      onCtx: (e, d, rowEl) => { if (d._t !== 'ev') return; e.preventDefault(); openRowMenu(evRowRef(d, rowEl), e.clientX, e.clientY); },
      onModel: G => { evCount(G.top()); syncDelBar(); },
    });
    TBL._built = true;
  } else {
    TBL.setRows(data);
    for (const [f, v] of [['play', hasPlay], ['devs', hasDev], ['clip', hasClip], ['kinds', hasKinds], ['sc', hasSc]]) TBL.setVis(f, v);
  }
  evCount(TBL.top()); syncDelBar();
}
/* Zeile für das Menü ⋮: Schlüssel und Datei der Störung; markiert die Zeile, solange das Menü offen ist */
function evRowRef(d, elx) {                          // Zeile nur per Klasse markieren: Neuzeichnen würde den Fokus in die Zelle zurückholen und das Menü sofort schließen
  EVMENU = d.id; const box = $('events'), row = elx && elx.closest && elx.closest('.ag-row');
  if (box) box.querySelectorAll('.ag-row.menu').forEach(r => r.classList.remove('menu')); if (row) row.classList.add('menu');
  return { dataset: { k: d.id, f: d.r.datei || '' }, el: elx }; }
matchMedia('(max-width:600px)').addEventListener('change', () => { EVSIG = ''; renderEvents(); });
/* ================= Tabellen mit AG Grid Community (MIT, ag-grid.com) =================
   Ein gemeinsamer Aufbau für alle Tabellen: Farben aus den App-Variablen (hell, dunkel, Umschalter), Filterzeile unter den
   Köpfen (Mehrfachauswahl „alle …“, Mindestwert „≥“, Text „…“), Sortieren per Klick, Zeilen nur im sichtbaren Teil gezeichnet.
   Wird es zu schmal, verschwinden die weniger wichtigen Spalten (prio hoch zuerst) und lassen sich je Zeile mit ＋ aufklappen.
   Gruppen (Protokolle) als Elternzeile mit Kindzeilen darunter (_children), auf- und zuklappbar.
   Spalte: { f, title, html(d), click(e, d, el), sort: false | 'num' | fn(a, b), flt: 'ms' | 'num' | 'txt', vals(), fpass(v, d),
             minW, w (feste Breite), grow, prio (0 = immer sichtbar), cls, vis, head() (eigener Kopf), hide (Kopftext nur für Screenreader) } */
const AG_DE = {
  noRowsToShow: 'Keine Einträge', noMatchingRows: 'Keine passenden Einträge', loadingOoo: 'Wird geladen …', page: 'Seite', of: 'von', to: 'bis', more: 'mehr',
  ariaChecked: 'ausgewählt', ariaUnchecked: 'nicht ausgewählt', ariaIndeterminate: 'teilweise ausgewählt', ariaColumnFiltered: 'Spalte gefiltert',
  ariaFilterColumn: 'Strg und Eingabe öffnen den Filter', ariaLabelColumnFilter: 'Spaltenfilter', ariaFilterValue: 'Filterwert', ariaFilterFromValue: 'Filter ab Wert',
  ariaFilterToValue: 'Filter bis Wert', ariaFilteringOperator: 'Filterbedingung', ariaDateFilterInput: 'Datumsfilter', ariaSortableColumn: 'Eingabe sortiert',
  ariaSortableColumnWithCellSelection: 'Alt und Eingabe sortieren', ariaMenuColumn: 'Alt und Pfeil nach unten öffnen das Spaltenmenü', ariaLabelColumnMenu: 'Spaltenmenü',
  ariaLabelTooltip: 'Hinweis', ariaHidden: 'verborgen', ariaVisible: 'sichtbar', ariaSearch: 'Suchen', ariaRowSelect: 'Leertaste wählt die Zeile aus',
  ariaRowDeselect: 'Leertaste hebt die Auswahl auf', ariaRowToggleSelection: 'Leertaste ändert die Auswahl', ariaRowSelectAll: 'Leertaste wählt alle Zeilen aus oder ab',
  ariaHeaderSelection: 'Spalte mit Auswahl im Kopf', ariaColumnGroupExpansion: 'Eingabe klappt die Spaltengruppe auf oder zu', ariaToggleCellValue: 'Leertaste ändert den Wert',
  ariaInputEditor: 'Eingabefeld', ariaPendingChange: 'Änderung noch nicht gespeichert', ariaCalculatedColumn: 'berechnete Spalte', ariaHasNote: 'Diese Zelle hat eine Notiz.',
  ariaValidationErrorPrefix: 'Eingabe prüfen', ariaSortAscending: 'aufsteigend', ariaSortDescending: 'absteigend',
};
let AG_THEME = null;
function agTheme() {                                  // Farben = CSS-Variablen der App: hell/dunkel und der Umschalter wirken ohne Neuaufbau
  // Kopfzeile und Zellen deckend (var(--card)): beim Scrollen laufen Zeilen nicht sichtbar durch die Kopfzeile
  return AG_THEME || (AG_THEME = agGrid.themeQuartz.withParams({
    backgroundColor: 'var(--card)', chromeBackgroundColor: 'var(--card)', headerBackgroundColor: 'var(--card)', foregroundColor: 'var(--tx)', textColor: 'var(--tx)',
    accentColor: 'var(--acc)', borderColor: 'var(--bd)', headerTextColor: 'var(--mut)', headerFontWeight: 600, headerFontSize: 12, fontFamily: 'inherit', fontSize: 14,
    rowHoverColor: 'var(--nl1)', oddRowBackgroundColor: 'transparent', selectedRowBackgroundColor: 'transparent', wrapperBorder: false, wrapperBorderRadius: 0,
    columnBorder: false, headerColumnBorder: false, rowBorder: true, headerRowBorder: true, cellHorizontalPadding: 10, spacing: 4, rowHeight: 46, headerHeight: 30,
    inputBackgroundColor: 'var(--card)', inputBorder: { color: 'var(--bd)' }, inputTextColor: 'var(--tx)', inputFocusBorder: { color: 'var(--acc)' },
    focusShadow: { spread: 2, color: 'var(--acc)' }, headerColumnResizeHandleColor: 'transparent', iconSize: 12, browserColorScheme: 'inherit', menuBackgroundColor: 'var(--card)', menuTextColor: 'var(--tx)',
  }));
}
const gCmp = (a, b) => (typeof a === 'number' || a == null) && (typeof b === 'number' || b == null) ? (a == null ? -Infinity : a) - (b == null ? -Infinity : b)
  : String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), undefined, { numeric: true });
const gOn = v => Array.isArray(v) ? v.length > 0 : v !== '' && v != null;
function gPass1(c, v, d) {                            // ein Spaltenfilter auf eine Zeile
  if (c.fpass) return c.fpass(v, d);
  const x = d[c.f];
  if (c.flt === 'ms') return Array.isArray(x) ? x.some(y => v.includes(y)) : v.includes(x);
  if (c.flt === 'num') return x != null && x >= +v;
  return String(x == null ? '' : x).toLowerCase().includes(String(v).toLowerCase());
}
const gPass = (c, v, d) => gPass1(c, v, d) || (d._children || []).some(k => gPass1(c, v, k));   // Gruppe: passt, wenn eine Störung darin passt
/* Spaltenfilter (für AG Grid): Wert kommt aus der Filterzeile; die Prüfung macht gPass */
class GLFilter {
  init(p) { this.p = p; this.c = p.colDef.context; this.v = null; this.gui = document.createElement('span'); (p.colDef.context.G.flt[this.c.f] = this); }
  getGui() { return this.gui; }
  isFilterActive() { return gOn(this.v); }
  doesFilterPass(p) { const d = p.data; return !d || gPass(this.c, this.v, d._det ? d._ofd : d); }
  getModel() { return this.isFilterActive() ? { v: this.v } : null; }
  setModel(m) { this.v = m ? m.v : null; }
  set(v) { this.v = gOn(v) ? v : null; this.p.filterChangedCallback(); }
}
/* Filterzeile: Mehrfachauswahl als Knopf mit Häkchen-Liste, sonst ein beschriftetes Eingabefeld */
class GLFloat {
  init(p) {
    this.p = p; const c = this.c = p.column.getColDef().context, lab = t('g_flt', { c: c.title || '' });
    if (c.flt === 'ms') { this.e = msButton(c.vals, () => this.v || [], v => this.set(v)); this.b = this.e.querySelector('.msf'); }
    else {
      this.e = el('input', { type: c.flt === 'num' ? 'number' : 'text', placeholder: c.flt === 'num' ? '≥' : '…', className: 'gfi' });
      if (c.flt === 'num') this.e.step = 'any';
      let tm = 0; this.e.oninput = () => { clearTimeout(tm); tm = setTimeout(() => this.set(this.e.value.trim()), 250); };
    }
    (this.b || this.e).setAttribute('aria-label', lab); (this.b || this.e).title = lab;
  }
  set(v) { this.v = gOn(v) ? v : null; this.p.parentFilterInstance(f => f.set(this.v)); }
  onParentModelChanged(m) { this.v = m ? m.v : null; if (this.c.flt === 'ms') this.b._label(); else if (document.activeElement !== this.e) this.e.value = this.v == null ? '' : this.v; }
  getGui() { return this.e; }
}
class GLHead { init(p) { this.e = p.column.getColDef().context.head(); } getGui() { return this.e; } refresh() { return false; } }
function msButton(valuesFn, getCur, onChange) {      // „alle …“ bzw. Auswahl; Liste mit Häkchen als Shoelace-Dropdown (ab 1.85.46: schließt bei Klick daneben/Esc, bleibt beim Ankreuzen offen)
  const w = el('sl-dropdown', { className: 'sfltd msfd' }); w.setAttribute('placement', 'bottom-start'); w.setAttribute('distance', '4'); w.setAttribute('hoist', ''); w.setAttribute('stay-open-on-select', '');
  const b = el('button', { type: 'button', className: 'msf' }); b.setAttribute('slot', 'trigger'); b.setAttribute('aria-haspopup', 'true');
  const pop = el('div', { className: 'sfltl' }); pop.setAttribute('role', 'group'); w.append(b, pop);
  b._label = () => { const cur = getCur(); b.textContent = (!cur.length ? t('sf_any') : cur.length === 1 ? cur[0] : t('ms_n', { n: cur.length })) + ' ▾'; b.classList.toggle('on', cur.length > 0); pop.setAttribute('aria-label', b.getAttribute('aria-label') || ''); };
  b._label();
  const build = () => {
    let cur = getCur().slice(); const base = typeof valuesFn === 'function' ? valuesFn() : [], vals = base.concat(cur.filter(x => !base.includes(x)));
    pop.innerHTML = `<div class="sfltb"><button type="button" class="chip" data-a="all">${esc(t('sf_all'))}</button><button type="button" class="chip" data-a="none">${esc(t('ms_clear'))}</button></div>` +
      (vals.length ? vals.map((v, i) => `<label><input type="checkbox" data-i="${i}"${cur.includes(v) ? ' checked' : ''}> ${esc(v)}</label>`).join('') : `<small class="mut">${esc(t('ms_empty'))}</small>`);
    const apply = () => { onChange(cur.slice()); b._label(); };
    pop.querySelectorAll('input[data-i]').forEach(c => c.onchange = () => { const v = vals[+c.dataset.i]; cur = c.checked ? [...new Set(cur.concat([v]))] : cur.filter(x => x !== v); apply(); });
    pop.querySelector('[data-a=all]').onclick = () => { cur = vals.slice(); pop.querySelectorAll('input[data-i]').forEach(c => c.checked = true); apply(); };
    pop.querySelector('[data-a=none]').onclick = () => { cur = []; pop.querySelectorAll('input[data-i]').forEach(c => c.checked = false); apply(); };
  };
  w.addEventListener('sl-show', build);                 // Werte-Liste beim Öffnen frisch (neue Geräte, Arten, Sensoren)
  w.addEventListener('sl-after-show', () => { const f = pop.querySelector('input[data-i]') || pop.querySelector('button'); if (f) f.focus({ preventScroll: true }); });
  w.addEventListener('sl-after-hide', () => b.focus({ preventScroll: true }));
  pop.addEventListener('click', ev => ev.stopPropagation());
  return w;
}
const gHtml = h => { const s = document.createElement('div'); s.className = 'gc'; s.innerHTML = h == null ? '' : h; return s; };
/* Tabelle bauen. o: { cols, rows, max ('60vh'), ph (Text ohne Zeilen), onRow(e, d, rowEl), onDbl(e, d), onCtx(e, d, rowEl), rowCls(d) -> [Klassen],
   ext(d) (zusätzlicher Filter), isOpen(d) (Gruppe aufgeklappt), sort ([{colId, sort}]), key (Sortierung merken), onModel(G), label (Name der Tabelle),
   wkey (Name, unter dem gezogene Spaltenbreiten mit dem Layout auf dem Server gemerkt werden) } */
// ab 1.85.32: aufgeklappte Zeile einer Gruppe – flach, einzeilig, nur was sich von der Gruppe unterscheidet (Uhrzeit statt Datum,
// gleiche Quelle, „0 von n Sensoren“ und „Unbekannt ×1“ fallen weg). null = Zelle wie sonst.
function kidCell(f, d, p) {
  const r = d.r;
  if (f === 'start') {
    const ms = r ? new Date(r.start).getTime() : d.n ? d.n.a : d.x ? d.x.a : d.start;
    const tm = clockOf(new Date(ms).toISOString()), to = d.n && d.n.b > d.n.a ? '–' + clockOf(new Date(d.n.b).toISOString()).slice(0, 5) : '';
    return `<span class="kidt">${esc(tm + to)}</span>${r && r.notes ? `<span class="ntc" title="${esc(t('nt_title', { n: r.notes }))}">📝 ${r.notes}</span>` : ''}`;
  }
  if (f === 'src') { const ss = new Set(((p && p._children) || []).map(c => c.src)); return ss.size === 1 && (d._t === 'ev' || d._t === 'grp') ? '' : null; }
  if (f === 'sc') return r && (!r.sc || !r.sc.s || r.sc.s === 'no') ? '' : null;
  if (f === 'kinds') return r && (r.kinds || []).every(x => x[0] === 'unknown') ? '' : null;
  return null;
}
function grpBadge(p) { const n = (p._children || []).length; return n ? `<small class="gcnt" title="${esc(grpN(p.g))}" aria-hidden="true">${n}</small>` : ''; }
function glGrid(box, o) {
  if (box._G) box._G.destroy();
  box.innerHTML = ''; box.classList.add('glg');
  const G = { o, box, flt: {}, det: new Set(), hid: new Set(), ff: true, byId: new Map(), cols: o.cols, ph: o.ph || t('none'), phEls: new Set() };
  box._G = G;
  const wk = o.wkey ? String(o.wkey).replace(/[^A-Za-z0-9_]/g, '_').slice(0, 40) : '', TP = tblPref(wk);   // ab 1.84.0: Reihenfolge, ausgeblendete Spalten, Dichte
  G.wk = wk; G.uhid = new Set(Array.isArray(TP.hide) ? TP.hide : (o.hide0 || [])); G.dense = TP.dense === 'compact';
  box.classList.toggle('gdense', G.dense);
  const vis0 = c => c.vis !== false && !G.uhid.has(c.f);
  const isNar = () => G.hid.size > 0;
  G.colPass = d => Object.values(G.flt).every(f => !f.isFilterActive() || gPass(f.c, f.v, d));
  const visD = d => {
    if (d._det) return visD(d._ofd);
    if (o.ext && !o.ext(d)) return false;
    if (d._pid) { const p = G.byId.get(d._pid); return !!p && (!o.isOpen || o.isOpen(p)) && visD(p) && G.colPass(p); }
    return true;
  };
  const flat = rows => { const out = []; G.byId.clear();
    const add = (d, pid) => { if (pid) d._pid = pid; else delete d._pid; out.push(d); G.byId.set(String(d.id), d); if (G.det.has(String(d.id)) && G.hasDet(d)) out.push({ _det: 1, id: 'd:' + d.id, _ofd: d }); for (const k of d._children || []) add(k, String(d.id)); };
    for (const d of rows) add(d, null);
    for (const k of [...G.det]) if (!G.byId.has(k)) G.det.delete(k);
    return out; };
  const hEmpty = h => h === '' || h == null || (!/<(button|input|img|svg|audio|video)/.test(String(h)) && /^[\s–\-·]*$/.test(String(h).replace(/<[^>]*>/g, '')));
  G.hasDet = d => G.cols.some(c => G.hid.has(c.f) && vis0(c) && !hEmpty(c.html ? c.html(d) : d[c.f]));   // ab 1.85.33: nur aufklappen, wenn es etwas zu zeigen gibt
  const detBody = d => { const wrap = document.createElement('div'); wrap.className = 'gdet';
    for (const c of G.cols) if (G.hid.has(c.f) && vis0(c)) { const h = c.html ? c.html(d) : esc(d[c.f]); if (hEmpty(h)) continue;
      const r = document.createElement('div'); r.className = 'gdl'; r.dataset.c = c.f; r.innerHTML = `<b>${esc(c.title || '')}</b><span class="gc ${c.cls || ''}">${h}</span>`; wrap.appendChild(r); }
    wrap.onclick = e => { const r = e.target.closest('.gdl'), c = r && G.cols.find(x => x.f === r.dataset.c); if (c && c.click) c.click(e, d, r); };
    return wrap; };
  class PH { init() { this.e = el('span', { className: 'glph', textContent: G.ph }); G.phEls.add(this.e); } getGui() { return this.e; } destroy() { G.phEls.delete(this.e); } }
  const togCol = { colId: '_rc', headerName: t('g_more'), headerClass: 'ghid', width: 32, minWidth: 32, maxWidth: 32, resizable: false, sortable: false, suppressMovable: true, lockPosition: 'left', cellClass: 'rcol', initialHide: true,
    cellRenderer: p => { const d = p.data; if (!d || d._det || !G.hasDet(d)) return ''; const on = G.det.has(String(d.id)), b = el('button', { type: 'button', className: 'gtg' + (on ? ' on' : ''), textContent: on ? '−' : '+' });
      b.setAttribute('aria-expanded', on ? 'true' : 'false'); b.setAttribute('aria-label', t(on ? 'g_less' : 'g_more')); b.tabIndex = -1; return b; },
  };
  const saved = (() => { try { return o.key ? JSON.parse(localStorage.getItem(o.key) || 'null') : null; } catch (e) { return null; } })();
  const sort0 = saved && saved.length ? saved : (o.sort || []);
  const wsav = colWidths(wk) || {};
  const colDefs = [togCol].concat(G.cols.map(c => {
    const s = sort0.find(x => x.colId === c.f);
    const cd = { colId: c.f, field: c.f, headerName: c.title || '', context: Object.assign(c, { G }), initialHide: !vis0(c), minWidth: c.w ? c.w : matchMedia('(max-width:600px)').matches ? Math.min(c.minW || 60, NARW[c.f] || 84) : (c.minW || 60), suppressMovable: !!c.head || c.f === 'act', lockPosition: c.head ? 'left' : c.f === 'act' ? 'right' : undefined,   // Spaltenköpfe ziehen = Reihenfolge (gemerkt)
      sortable: c.sort !== false, initialSort: s ? s.sort : null, comparator: typeof c.sort === 'function' ? (a, b, na, nb) => c.sort(na.data, nb.data) : gCmp,
      cellRenderer: p => { const d = p.data; if (!d) return ''; let h = c.html ? c.html(d) : esc(d[c.f] == null ? '' : d[c.f]);
        if (d._pid && !d._det && o.kid) { const v = o.kid(c.f, d, G.byId.get(d._pid)); if (v != null) h = v; }   // ab 1.85.32: aufgeklappte Zeile – nur was sich von der Gruppe unterscheidet
        return gHtml(h); },
      cellClass: ['gcell'].concat(c.cls ? c.cls.split(/\s+/) : []), headerClass: c.head ? 'ghcust' : c.hide ? 'ghid' : undefined, autoHeight: true, wrapText: !c.one,   // one: eine Zeile mit „…“ (ganzer Text im Hinweis)
      suppressHeaderMenuButton: true, suppressHeaderFilterButton: true, suppressFloatingFilterButton: true, headerTooltip: c.hide ? c.title : undefined };
    if (c.w) { cd.width = c.w; cd.maxWidth = c.w; cd.resizable = false; } else if (wsav[c.f]) cd.width = Math.max(cd.minWidth, wsav[c.f]); else cd.flex = c.grow || 1;   // gemerkte Breite (gezogen)
    if (c.flt) { cd.filter = GLFilter; cd.floatingFilter = true; cd.floatingFilterComponent = GLFloat; } else { cd.filter = false; cd.floatingFilter = false; }   // ab 1.85.46: ohne eigenen Filter auch kein Standard-Knopf von AG Grid in der Filterzeile
    if (c.head) cd.headerComponent = GLHead;
    return cd;
  }));
  G.defOrder = G.cols.map(c => c.f);
  G.ordIds = sv => {                                   // gemerkte Reihenfolge; neue Spalten stehen hinter ihrem Vorgänger aus der Standard-Reihenfolge
    const ids = G.defOrder, k = (sv || []).filter((x, i, a) => ids.includes(x) && a.indexOf(x) === i);
    ids.forEach((id, i) => { if (k.includes(id)) return; let at = 0; for (let j = i - 1; j >= 0; j--) { const q = k.indexOf(ids[j]); if (q >= 0) { at = q + 1; break; } } k.splice(at, 0, id); });
    return k;
  };
  if (Array.isArray(TP.order) && TP.order.length) { const ord = G.ordIds(TP.order); colDefs.sort((a, b) => (a.colId === '_rc' ? -1 : ord.indexOf(a.colId)) - (b.colId === '_rc' ? -1 : ord.indexOf(b.colId))); }
  const anyFlt = G.cols.some(c => c.flt);
  const rowEl = e => e && e.target && e.target.closest ? e.target.closest('.ag-row') : null;
  const opts = {
    theme: agTheme(), localeText: lang === 'de' ? AG_DE : undefined, columnDefs: colDefs, rowData: flat(o.rows || []), getRowId: p => String(p.data.id),
    defaultColDef: { resizable: true, sortingOrder: ['asc', 'desc'], cellDataType: false }, suppressDragLeaveHidesColumns: true, ensureDomOrder: true, enableCellTextSelection: true, maintainColumnOrder: true, rowHeight: G.dense ? 32 : 46,
    onColumnMoved: p => { if (p.finished && p.source !== 'api' && p.source !== 'gridOptionsChanged' && p.source !== 'flex') G.saveP(); },   // gezogen: Reihenfolge merken
    suppressRowHoverHighlight: false, animateRows: false, rowBuffer: 15, headerHeight: anyFlt ? 30 : 36, floatingFiltersHeight: 34,
    noRowsOverlayComponent: PH, noMatchingRowsOverlayComponent: PH,
    isFullWidthRow: p => !!(p.rowNode.data && p.rowNode.data._det), fullWidthCellRenderer: p => { if (!p.data) return ''; const w = detBody(p.data._ofd);
      requestAnimationFrame(() => { const h = w.offsetHeight; if (h && p.node.rowHeight !== h && !G.api.isDestroyed()) { p.node.setRowHeight(h); G.api.onRowHeightChanged(); } });   // Höhe wie der Inhalt
      return w; },
    getRowHeight: p => p.data && p.data._det ? 12 + 26 * Math.max(1, G.cols.filter(c => G.hid.has(c.f) && vis0(c)).length) : undefined,
    getRowClass: p => { const d = p.data; if (!d) return; if (d._det) return 'gdetr'; const a = o.rowCls ? o.rowCls(d) : []; if (d._pid) a.push('gm'); return a; },
    isExternalFilterPresent: () => !!(o.ext || o.isOpen || G.det.size), doesExternalFilterPass: n => !n.data || visD(n.data),
    postSortRows: p => { const ns = p.nodes; if (!ns.some(n => n.data && (n.data._pid || n.data._det))) return;
      const kids = new Map(), top = [];
      for (const n of ns) { const k = n.data && (n.data._det ? String(n.data._ofd.id) : n.data._pid); if (k) { let l = kids.get(k); if (!l) kids.set(k, l = []); n.data._det ? l.unshift(n) : l.push(n); } else top.push(n); }
      const out = [], emit = n => { out.push(n); const l = kids.get(String(n.data.id)); if (l) { kids.delete(String(n.data.id)); l.forEach(emit); } };
      top.forEach(emit); for (const l of kids.values()) out.push(...l);
      ns.length = 0; ns.push(...out); },
    onRowClicked: p => { const d = p.data, e = p.event; if (!d || d._det || !e) return;   // Klick in eine Spalte mit eigener Aktion (Auswahl, ⋮, ▶, ＋) – sonst Aktion der Zeile
      const cell = e.target.closest && e.target.closest('.ag-cell'), cid = cell && cell.getAttribute('col-id');
      if (cid === '_rc') { if (G.hasDet(d)) G.toggleDet(d); return; }
      const ack = e.target.closest && e.target.closest('.artck');   // Geräuschart: Klick auf das Kästchen bestätigt oder korrigiert (statt die Störung zu öffnen)
      if (ack) { const r = evByK(ack.dataset.k) || d.r; const b = ack.getBoundingClientRect(); artConfirmPop(r, b.left, b.bottom + 4); return; }
      const c = cid && G.cols.find(x => x.f === cid);
      if (c && c.click && c.click(e, d, cell) !== false) return;
      if (o.onRow) o.onRow(e, d, rowEl(e)); },
    onRowDoubleClicked: p => { const d = p.data; if (d && !d._det && o.onDbl) o.onDbl(p.event, d); },
    onCellKeyDown: p => { const e = p.event; if (!e || !p.data || p.data._det) return;
      if (o.onDbl && (e.key === 'F2' || (e.key === 'Enter' && (e.shiftKey || e.ctrlKey)))) { e.preventDefault(); o.onDbl({ target: e.target }, p.data); return; }   // öffnen wie Doppelklick
      if (e.key !== 'Enter' && e.key !== ' ') return;    // Tastatur: Eingabe/Leertaste wie Klick
      const cell = e.target.closest && e.target.closest('.ag-cell'); if (!cell || e.target !== cell) return;
      const b = cell.querySelector('button:not([disabled]),input:not([disabled]),a[href]');
      if (b) { e.preventDefault(); b.click(); return; }
      if (e.key === 'Enter' && o.onRow) { e.preventDefault(); o.onRow({ target: cell, type: 'keydown' }, p.data, cell.closest('.ag-row')); } },
    onSortChanged: () => { if (o.key) try { localStorage.setItem(o.key, JSON.stringify(G.api.getColumnState().filter(s => s.sort).map(s => ({ colId: s.colId, sort: s.sort })))); } catch (e) { } },
    onModelUpdated: () => { G.sizeSoon(); G.pmSoon(); if (o.onModel) o.onModel(G); }, onViewportChanged: () => G.pmSoon(), onBodyScrollEnd: () => G.pmSoon(),
    onGridSizeChanged: () => { G.fit(); G.pmSoon(); }, onFirstDataRendered: () => { G.fit(); G.sizeSoon(); G.pmSoon(); },
    onColumnResized: p => { G.pmSoon(); if (!wk || !p.finished || p.source !== 'uiColumnResized' || !p.column) return;     // von Hand gezogen: Breite merken
      const id = p.column.getColId(); if (id && id !== '_rc') colSave(wk, id, Math.round(p.column.getActualWidth())); },
  };
  G.maxPx = () => { const m = String(o.max || '70vh').match(/^([\d.]+)(vh|px)$/); return m ? (m[2] === 'vh' ? innerHeight * m[1] / 100 : +m[1]) : innerHeight * 0.7; };
  G.size = () => {                                    // Höhe wie „max-height“: so hoch wie der Inhalt, höchstens max, darüber rollt die Tabelle
    if (!G.api || G.api.isDestroyed()) return;
    const n = G.api.getDisplayedRowCount(); let body = 64;
    if (n) { const l = G.api.getDisplayedRowAtIndex(n - 1); body = (l.rowTop || 0) + (l.rowHeight || 46); }
    const hd = box.querySelector('.ag-header'), hs = box.querySelector('.ag-body-horizontal-scroll:not(.ag-scrollbar-invisible)');
    const h = Math.ceil(Math.min(G.maxPx(), (hd ? hd.offsetHeight : 36) + body + (hs ? hs.offsetHeight : 0) + 2));
    if (Math.abs(box.offsetHeight - h) > 1) box.style.height = h + 'px';
  };
  G.sizeSoon = () => { cancelAnimationFrame(G.raf); G.raf = requestAnimationFrame(G.size); };
  G.pmSoon = () => { clearTimeout(G.pmt); G.pmt = setTimeout(() => pmFit(box), 30); };   // Pillen an die Spaltenbreite anpassen
  G.fit = () => {                                     // schmal: weniger wichtige Spalten ausblenden (höchste prio, ganz rechts zuerst)
    if (!G.api || G.api.isDestroyed()) return;
    const w = box.clientWidth; if (!w) return;
    const nar = w < 520, cs = G.cols.filter(vis0), mw = c => c.w || (nar ? Math.min(c.minW || 60, NARW[c.f] || 84) : c.minW || 60);   // Handy: schmalere Mindestbreiten, damit mehr als „Start“ passt
    let sum = cs.reduce((s, c) => s + mw(c), 0); const hid = new Set();
    const order = cs.map((c, i) => [c, i]).filter(x => x[0].prio > 0).sort((a, b) => b[0].prio - a[0].prio || b[1] - a[1]).map(x => x[0]);
    for (const c of order) { if (sum + (hid.size ? 32 : 0) <= w) break; hid.add(c.f); sum -= mw(c); }
    const same = hid.size === G.hid.size && [...hid].every(x => G.hid.has(x));
    if (same && G.fitted) return;
    G.fitted = true; G.hid = hid;
    G.api.applyColumnState({ state: [{ colId: '_rc', hide: !hid.size }].concat(G.cols.map(c => ({ colId: c.f, hide: !vis0(c) || hid.has(c.f) }))) });
    const ff = G.cols.some(c => c.flt && vis0(c) && !hid.has(c.f));    // Filterzeile nur, wenn eine sichtbare Spalte einen Filter hat
    if (ff !== G.ff) { G.ff = ff; G.api.setGridOption('columnDefs', colDefs.map(d => d.filter ? Object.assign({}, d, { floatingFilter: ff }) : d)); }
    if (!hid.size && G.det.size) { G.det.clear(); G.setRows(G.rows); }
    else if (G.det.size) { G.api.resetRowHeights(); G.api.redrawRows(); }
  };
  G.toggleDet = d => { const k = String(d.id); G.det.has(k) ? G.det.delete(k) : G.det.add(k); G.setRows(G.rows); const n = G.api.getRowNode(k); if (n) G.api.redrawRows({ rowNodes: [n] }); };
  G.rows = o.rows || [];
  G.setRows = rows => { G.rows = rows; G.api.setGridOption('rowData', flat(rows));
    G.api.refreshCells({ force: true }); };           // ab 1.85.46: Zeilen mit gleicher Kennung, aber neuem Inhalt (Ereignis gewachsen: Zeitraum, Anzahl, Pillen) neu zeichnen
  G.setVis = (f, on) => { const c = G.cols.find(x => x.f === f); if (!c || (c.vis !== false) === !!on) return; c.vis = !!on; G.fitted = false; G.fit(); };
  G.setPh = txt => { G.ph = txt; for (const e of G.phEls) e.textContent = txt; };
  G.redraw = pred => { const ns = []; G.api.forEachNode(n => { if (n.data && !n.data._det && (!pred || pred(n.data))) ns.push(n); }); if (ns.length) G.api.redrawRows({ rowNodes: ns }); };
  G.refilter = () => G.api.onFilterChanged();
  G.nFilters = () => Object.keys(G.api.getFilterModel() || {}).length;
  G.clearFilters = () => G.api.setFilterModel(null);
  G.shown = () => { let n = 0; G.api.forEachNodeAfterFilter(x => { if (x.data && !x.data._det) n++; }); return n; };
  G.top = () => { const a = []; G.api.forEachNodeAfterFilter(x => { if (x.data && !x.data._det && !x.data._pid) a.push(x.data); }); return a; };   // angezeigte Zeilen oben (Gruppen mit _children)
  G.destroy = () => { try { G.api.destroy(); } catch (e) { } box._G = null; box.style.height = ''; };
  /* ab 1.84.0: Spalten wählen, Reihenfolge (auch per Tastatur), Dichte, zurücksetzen – nur Anzeige, je Tabelle gemerkt */
  G.curOrder = () => G.api.getColumnState().map(s => s.colId).filter(id => id !== '_rc');
  G.saveP = () => { if (!wk || !G.api || G.api.isDestroyed()) return; tblSave(wk, { order: G.curOrder(), hide: [...G.uhid], dense: G.dense ? 'compact' : 'normal' }); };
  const fixedCol = id => { const c = G.cols.find(x => x.f === id); return !c || !!c.head || c.f === 'act'; };
  G.setU = (f, on) => { if (on) G.uhid.delete(f); else G.uhid.add(f); G.fitted = false; G.fit(); G.sizeSoon(); G.saveP(); };
  G.move = (f, dir) => {
    const ord = G.curOrder(), mv = ord.filter(id => !fixedCol(id) && (G.cols.find(c => c.f === id) || {}).vis !== false), i = mv.indexOf(f), j = i + dir; if (i < 0 || j < 0 || j >= mv.length) return false;
    const a = ord.indexOf(mv[i]), b = ord.indexOf(mv[j]); [ord[a], ord[b]] = [ord[b], ord[a]];
    G.api.applyColumnState({ state: [{ colId: '_rc' }].concat(ord.map(colId => ({ colId }))), applyOrder: true }); G.saveP(); return true;
  };
  G.setDense = on => { G.dense = !!on; box.classList.toggle('gdense', G.dense); G.api.setGridOption('rowHeight', G.dense ? 32 : 46); G.api.resetRowHeights(); G.sizeSoon(); G.saveP(); };
  G.reset = () => {
    G.uhid = new Set(o.hide0 || []); G.dense = false; box.classList.remove('gdense'); G.api.setGridOption('rowHeight', 46);
    if (wk) { delete LAYOUT.cols[wk]; layoutPush({ cols: { [wk]: null } }); tblSave(wk, null); }
    G.api.applyColumnState({ state: [{ colId: '_rc' }].concat(G.cols.map(c => c.w ? { colId: c.f, width: c.w } : { colId: c.f, flex: c.grow || 1 })), applyOrder: true });
    G.fitted = false; G.fit(); G.api.resetRowHeights(); G.sizeSoon();
  };
  G.colMenu = anchor => glColMenu(G, anchor);
  { let b = o.colBtn || null;                          // Knopf „Spalten ▾“: vorgegeben, in o.colAt, sonst schmale Leiste über der Tabelle (ab 4 Spalten)
    if (!b && o.colAt) b = o.colAt.querySelector(':scope > .gcolbtn') || o.colAt.appendChild(el('button', { type: 'button', className: 'chip gcolbtn' }));
    if (!b && G.cols.filter(c => !c.head && c.f !== 'act').length >= 4 && o.colBar !== false) {
      let bar = box.previousElementSibling; if (!bar || !bar.classList.contains('gtools')) { bar = el('div', { className: 'gtools' }); box.before(bar); }
      b = bar.querySelector('.gcolbtn') || bar.appendChild(el('button', { type: 'button', className: 'chip gcolbtn' }));
    }
    if (b) { b.textContent = '▥ ' + t('g_cols') + ' ▾'; b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false'); b.title = t('g_cols_t');
      b.onclick = e => { e.stopPropagation(); const g = box._G; if (g) g.colMenu(b); }; G.colBtnEl = b; }
  }
  G.api = agGrid.createGrid(box, opts);
  if (o.label) requestAnimationFrame(() => { const r = box.querySelector('[role=treegrid],[role=grid]'); if (r && !r.getAttribute('aria-label')) r.setAttribute('aria-label', o.label); });
  box.oncontextmenu = e => { const r = rowEl(e); if (!r || !o.onCtx) return; const d = G.byId.get(r.getAttribute('row-id')); if (d) o.onCtx(e, d, r); };
  requestAnimationFrame(() => G.fit());
  return G;
}
/* Menü „Spalten ▾“ (ab 1.84.0): je Spalte an/aus und ← → (Reihenfolge, auch ohne Maus), Dichte bequem/kompakt, „Spalten zurücksetzen“.
   Esc oder Klick daneben schließt, der Fokus geht zurück auf den Knopf. */
let GCOL_N = 0;
function glColMenu(G, anchor) {
  document.querySelectorAll('.gcolpop').forEach(x => x._close ? x._close(false) : x.remove());
  const pop = el('div', { className: 'gcolpop' }), uid = 'gcp' + (++GCOL_N);
  pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-labelledby', uid + 'h');
  const name = c => c.menu || (/[\p{L}\d]/u.test(c.title || '') ? c.title : (c.aria || c.title || c.f));
  const render = focus => {
    const ord = G.curOrder(), list = ord.map(id => G.cols.find(c => c.f === id)).filter(c => c && !c.head && c.f !== 'act' && c.vis !== false);
    pop.innerHTML = `<b id="${uid}h" class="gcph">${esc(t('g_cols_t'))}</b><ul class="gcpl">` + list.map((c, i) => { const n = esc(name(c));
      return `<li data-f="${esc(c.f)}"><label><input type="checkbox"${G.uhid.has(c.f) ? '' : ' checked'}> <span>${n}</span></label>` +
        `<button type="button" class="gcpm" data-d="-1" aria-label="${esc(t('g_col_l', { c: name(c) }))}" title="${esc(t('g_col_l', { c: name(c) }))}"${i ? '' : ' disabled'}>←</button>` +
        `<button type="button" class="gcpm" data-d="1" aria-label="${esc(t('g_col_r', { c: name(c) }))}" title="${esc(t('g_col_r', { c: name(c) }))}"${i < list.length - 1 ? '' : ' disabled'}>→</button></li>`; }).join('') + `</ul>
      <fieldset class="gcpdn"><legend>${esc(t('g_dense'))}</legend><label><input type="radio" name="${uid}d" value="normal"${G.dense ? '' : ' checked'}> ${esc(t('g_dense_n'))}</label><label><input type="radio" name="${uid}d" value="compact"${G.dense ? ' checked' : ''}> ${esc(t('g_dense_c'))}</label></fieldset>
      <small class="gcphint">${esc(t('g_cols_hint'))}</small><small class="gcpmsg" role="status"></small>
      <div class="gcpb"><button type="button" class="chip gcpr">↺ ${esc(t('g_cols_reset'))}</button><button type="button" class="chip pri gcpx">${esc(t('dash_done'))}</button></div>`;
    pop.querySelectorAll('li').forEach(li => {
      const f = li.dataset.f, cb = li.querySelector('input');
      cb.onchange = () => { if (!cb.checked && !G.cols.some(c => c.f !== f && c.vis !== false && !c.head && c.f !== 'act' && !G.uhid.has(c.f))) { cb.checked = true; pop.querySelector('.gcpmsg').textContent = t('g_cols_min'); return; } G.setU(f, cb.checked); };
      li.querySelectorAll('.gcpm').forEach(b => b.onclick = () => { if (G.move(f, +b.dataset.d)) { render(`li[data-f="${CSS.escape(f)}"] .gcpm[data-d="${b.dataset.d}"]`); const m = pop.querySelector('.gcpmsg'); const k = G.curOrder().filter(id => list.some(c => c.f === id)).indexOf(f); if (m) m.textContent = t('g_col_pos', { c: name(G.cols.find(c => c.f === f)), i: k + 1, n: list.length }); } });
    });
    pop.querySelectorAll('input[type=radio]').forEach(r => r.onchange = () => G.setDense(r.value === 'compact'));
    pop.querySelector('.gcpr').onclick = () => { G.reset(); render('.gcpr'); pop.querySelector('.gcpmsg').textContent = t('g_cols_done'); };
    pop.querySelector('.gcpx').onclick = () => close(true);
    if (focus) { let f = pop.querySelector(focus); if (f && f.disabled) f = f.parentElement.querySelector('.gcpm:not([disabled])') || f.parentElement.querySelector('input'); if (f) f.focus(); }
  };
  const close = back => { pop.remove(); anchor.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', out, true); removeEventListener('resize', place); if (back) anchor.focus(); };
  const out = e => { if (!pop.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) close(false); };
  const place = () => { const r = anchor.getBoundingClientRect(), w = Math.min(320, innerWidth - 16); pop.style.width = w + 'px';
    pop.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
    const top = r.bottom + 4, h = pop.offsetHeight; pop.style.top = (top + h > innerHeight - 8 && r.top - h - 4 > 8 ? r.top - h - 4 : Math.max(8, Math.min(top, innerHeight - Math.min(h, innerHeight - 16) - 8))) + 'px'; };
  pop._close = close;
  pop.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } };
  pop.onclick = e => e.stopPropagation();
  document.body.appendChild(pop); render('li input'); anchor.setAttribute('aria-expanded', 'true'); place();
  setTimeout(() => document.addEventListener('click', out, true), 0); addEventListener('resize', place);
}
/* Gemeinsame Tabelle für alle kleinen Listen: aus einer einfachen <table> werden Spaltenfilter (Auswahl / Mindestwert / Text) und Sortierung.
   o.onRow(dataset, event) = Klick oder Eingabe auf einer Zeile (data-* der <tr>), o.head = Überschrift davor, o.max = maximale Höhe */
function tabGrid(box, html, o) {
  o = o || {};
  if (!box) return;
  if (box._G) box._G.destroy();
  const tpl = document.createElement('template'); tpl.innerHTML = html;
  const tb = tpl.content.querySelector('table');
  if (!tb || typeof agGrid === 'undefined') { box.innerHTML = html; return; }
  const rest = [...tpl.content.childNodes].filter(n => n !== tb && !(n.contains && n.contains(tb)));
  const trs = [...tb.querySelectorAll('tr')], hr = trs.find(r => r.querySelector('th')); const heads = hr ? [...hr.children].map(c => c.textContent.trim()) : [];
  const body = trs.filter(r => r !== hr && r.querySelector('td'));
  let placeholder = t('none');
  const data = [];
  body.forEach((r, i) => {
    if (r.children.length === 1 && r.children[0].getAttribute('colspan')) { placeholder = r.textContent.trim() || placeholder; return; }
    const d = { id: i, cls: r.className || '', ds: Object.assign({}, r.dataset) };
    [...r.children].forEach((c, j) => { d['c' + j] = c.innerHTML; d['t' + j] = c.textContent.trim(); d['k' + j] = c.className || ''; });
    data.push(d);
  });
  const toNum = s => { const m = String(s).replace('−', '-').replace(',', '.').match(/^[+\-]?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
  const cols = heads.map((h, j) => {
    const txt = data.map(d => d['t' + j]), nonEmpty = txt.filter(Boolean);
    const numeric = nonEmpty.length > 0 && nonEmpty.every(s => !isNaN(toNum(s)) && /^[+\-−]?\d[\d.,]*\s*[a-zA-Z%°²/ ]*$/.test(s));
    const distinct = [...new Set(nonEmpty)];
    const c = { f: 't' + j, title: h, minW: h ? 80 : 46, html: d => d['c' + j], cls: data.length && data[0]['k' + j] || '' };
    if (!h) { c.sort = false; c.w = 46; c.title = heads[j] || ''; return c; }
    if (numeric) { c.sort = (a, b) => (toNum(a['t' + j]) || 0) - (toNum(b['t' + j]) || 0); c.flt = 'num'; c.fpass = (v, d) => toNum(d['t' + j]) >= +v; }
    else if (distinct.length > 1 && distinct.length <= 25) { c.flt = 'ms'; c.vals = () => distinct.slice().sort((p, q) => p.localeCompare(q)); }
    else c.flt = 'txt';
    return c;
  });
  box.innerHTML = '';
  if (o.head) { const hd = document.createElement('div'); hd.innerHTML = o.head; box.append(...hd.childNodes); }
  const gd = document.createElement('div'); gd.className = 'tabg'; box.append(gd, ...rest);
  box._G = glGrid(gd, { cols, rows: data, max: o.max || '70vh', ph: placeholder, wkey: o.wkey || (box.id ? 'tg_' + box.id : ''), label: o.label || (box.querySelector('h3,h4') || {}).textContent || undefined,
    rowCls: d => d.cls ? d.cls.split(/\s+/).filter(Boolean).concat(o.onRow ? ['gclk'] : []) : (o.onRow ? ['gclk'] : []),
    onRow: o.onRow ? (e, d) => o.onRow(d.ds || {}, e) : null });
}
function evCount(rows) {                             // Zählung über der Tabelle: Störungen und Sensor-Ereignisse getrennt
  let e = 0, s = 0; const walk = l => { for (const d of l) { if (d._t === 'ev') e++; else if (d._t === 'sens') s++; if (d._children) walk(d._children); } }; walk(rows || []);
  const el = $('evcnt'); if (el) el.textContent = (t('ev_cnt', { e }) + (s ? t('ev_cnt_s', { s }) : '')) + (EV ? mfCountTxt(EV.events) : '');
}
const EVOPEN = new Set();
/* Sensor-Filter (Mehrfachauswahl): ausgeblendete Sensoren als 'ha:<Name>', 'vib', 'cam', '_ev' (Störungen) */
let SHIDE = (() => { try { return new Set(JSON.parse(localStorage.getItem('gl_shide') || '[]')); } catch (e) { return new Set(); } })();
const HA_LS = 11;                                    // Höhe je Sensor-Spur im Verlauf (px): gleichzeitige Fähnchen liegen übereinander, alle sichtbar
const haOk = (S, a) => !SHIDE.has('ha:' + a[2]) && !(S && S.hs && S.hs.has(a[2]));   // global ausgeblendet oder in dieser Zeile abgewählt
/* Filter „Art“ oben als Mehrfachauswahl (z. B. Stimme + Musik): die versteckte Auswahl #artflt liefert die Einträge */
const ARTSEL = new Set();
function artApply() { NV.art = !ARTSEL.size ? '' : ARTSEL.size === 1 ? [...ARTSEL][0] : JSON.stringify([...ARTSEL]); EVSIG = ''; loadNight(); if (EV) renderEvents(); artMsBuild(); }
function artMsBuild() {
  const sel = $('artflt'); if (!sel) return; let box = $('artms');
  if (!box) { box = el('span', { id: 'artms', className: 'sflt artms' }); sel.after(box); }
  const items = [...sel.options].filter(o => o.value && !o.hidden).map(o => [o.value, o.textContent]);
  {                                                  // dazu alle Sensoren aus den Regeln und die Handys als Bewegungsmelder
    const ha = new Set(); for (const x of (EV && EV.ha_names) || []) ha.add(x[0]); for (const x of (EV && EV.sens) || []) if (x.kind === 'ha') ha.add(x.name);
    for (const n of [...ha].sort((a, b) => a.localeCompare(b))) items.push(['ha:' + n, '📡 ' + n]);
    items.push(['vib', '🫨 ' + t('sens_vib')], ['tilt', '📐 ' + t('sens_tilt')], ['cam', '🏃 ' + t('sens_cam')]);
  }
  for (const k of [...ARTSEL]) if (!items.some(i => i[0] === k)) ARTSEL.delete(k);
  const sig = JSON.stringify([items, [...ARTSEL]]); if (box.dataset.sig === sig) return;
  const wasOpen = slOpen(box);
  const lbl = !ARTSEL.size ? t('art_all') : ARTSEL.size === 1 ? (items.find(i => ARTSEL.has(i[0])) || ['', ''])[1] : t('art_n', { n: ARTSEL.size });
  if (wasOpen && box.dataset.isig === JSON.stringify(items)) {          // offen: nur Häkchen und Beschriftung, das Menü bleibt offen
    box.dataset.sig = sig; box.querySelectorAll('input[data-k]').forEach(c => { c.checked = ARTSEL.has(c.dataset.k); });
    const tb = box.querySelector('button[slot=trigger]'); tb.textContent = lbl + ' ▾'; tb.classList.toggle('pri', !!ARTSEL.size); return; }
  box.dataset.sig = sig; box.dataset.isig = JSON.stringify(items);
  box.innerHTML = slDrop(`class="chip${ARTSEL.size ? ' pri' : ''}">${esc(lbl)} ▾`, `<div class="sfltb"><button type="button" class="chip" data-a="none">${esc(t('art_all'))}</button></div>
    ${items.map(([k, l]) => `<label><input type="checkbox" data-k="${esc(k)}"${ARTSEL.has(k) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}`, wasOpen); slKeep(box, wasOpen);
  box.querySelectorAll('input[data-k]').forEach(c => c.onchange = () => { c.checked ? ARTSEL.add(c.dataset.k) : ARTSEL.delete(c.dataset.k); artApply(); });
  box.querySelector('button[data-a=none]').onclick = () => { ARTSEL.clear(); artApply(); };
}
/* ab 1.85.21: Aufklapp-Menüs über Shoelace (sl-dropdown, MIT): schließt bei Klick daneben und mit Esc, liegt über allem (hoist), Tastatur/Screenreader */
function slDrop(trig, panel, open, cls) { return `<sl-dropdown class="sfltd ${cls || ''}" placement="bottom-start" distance="4" hoist stay-open-on-select${open ? ' open' : ''}><button type="button" slot="trigger" ${trig}</button><div class="sfltl">${panel}</div></sl-dropdown>`; }
function slOpen(box) { const x = box && box.querySelector('sl-dropdown'); return !!(x && x.open); }
function slKeep(box, was) { if (!was) return; const x = box.querySelector('sl-dropdown'); if (x) customElements.whenDefined('sl-dropdown').then(() => requestAnimationFrame(() => x.show())); }   // nach Neuaufbau offen lassen
function evSrcHid(r) { return SHIDE.has('_ev') || SHIDE.has('src:' + ((r && r.quelle_id) || 'main')); }   // ab 1.85.35: Störungen je Gerät (z. B. Server-Mikrofon) ausblenden
function shideSave() { try { localStorage.setItem('gl_shide', JSON.stringify([...SHIDE])); } catch (e) { } }
const sensKey = x => x.kind === 'ha' ? 'ha:' + x.name : x.kind;
const sensIcon = k => k === 'vib' ? '🫨' : k === 'tilt' ? '📐' : k === 'cam' ? '🏃' : '📡';
const sensLabel = x => x.kind === 'ha' ? x.name : t(x.kind === 'vib' ? 'sens_vib' : x.kind === 'tilt' ? 'sens_tilt' : 'sens_cam');
function sensAll() { const vis = new Set(sensVis()); return ((EV && EV.sens) || []).map(x => (x.__hid = !vis.has(x), x)); }   // alle Sensor-Ereignisse, ausgeblendete markiert
function sensVis() { return ((EV && EV.sens) || []).filter(x => !SHIDE.has(sensKey(x)) && (!ARTSEL.size || ARTSEL.has(sensKey(x)))); }   // Art: gewählte Sensoren
/* Auswahlliste „Sensoren“ (Mehrfachauswahl): Störungen, jede HA-Regel, Handy-Erschütterung, Handy-Bewegung */
function levData() { try { return LEV.data; } catch (e) { return null; } }
function sfltBuild() {
  const ha = new Set(); for (const src of [EV, levData()]) for (const x of (src && src.sens) || []) if (x.kind === 'ha') ha.add(x.name); for (const a of (NV.data && NV.data.ha) || []) ha.add(a[2]);
  for (const r of (HAR && HAR.rules) || []) if (r.enabled !== false && r.mode !== 'pause') ha.add(r.label || r.name || r.entity);
  for (const src of [EV, levData()]) for (const x of (src && src.ha_names) || []) ha.add(x[0]);   // alle angelegten Regeln, auch ohne Meldung im Zeitraum
  if (SHIDE.has('_ev')) { SHIDE.delete('_ev'); for (const x of SOURCES) SHIDE.add('src:' + x.id); shideSave(); }   // alt: „Störungen“ = alle Geräte
  const devs = SOURCES.filter(x => !x.former).map(x => ['src:' + x.id, '🎙 ' + t('sf_dev', { n: x.name || x.id })]);
  const items = [...(devs.length ? devs : [['src:main', '🎙 ' + t('sf_ev')]]), ...[...ha].filter(Boolean).sort((a, b) => a.localeCompare(b)).map(n => ['ha:' + n, '📡 ' + n]), ['vib', '🫨 ' + t('sens_vib')], ['tilt', '📐 ' + t('sens_tilt')], ['cam', '🏃 ' + t('sens_cam')], ['_fn', '📝 ' + t('sf_fn')]];
  for (const box of [$('sflt'), $('lsflt')]) {
    if (!box) continue;
    const sig = JSON.stringify([items, [...SHIDE], lang]); if (box.dataset.sig === sig) continue; box.dataset.sig = sig;
    const on = items.filter(i => !SHIDE.has(i[0])).length, wasOpen = slOpen(box);
    box.innerHTML = slDrop(`class="chip${on < items.length ? ' pri' : ''}">👁 ${esc(t('sf_btn'))} <small>${on}/${items.length}</small>`, `<div class="sfltb"><button type="button" class="chip" data-a="all">${esc(t('sf_all'))}</button><button type="button" class="chip" data-a="sens">📡 ${esc(t('sf_sens'))}</button><button type="button" class="chip" data-a="none">${esc(t('sf_none'))}</button></div>
    ${items.map(([k, l]) => `<label><input type="checkbox" data-k="${esc(k)}"${SHIDE.has(k) ? '' : ' checked'}> ${esc(l)}</label>`).join('')}`, wasOpen); slKeep(box, wasOpen);
    const apply = () => { shideSave(); EVSIG = ''; renderEvents(); if (NV.open && typeof renderNight === 'function' && NV.data) renderNight(); dtLoad(DT, true); levRender(); sfltBuild(); };
    box.querySelectorAll('input[data-k]').forEach(c => c.onchange = () => { c.checked ? SHIDE.delete(c.dataset.k) : SHIDE.add(c.dataset.k); apply(); });
    box.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => { const m = b.dataset.a; for (const [k] of items) (m === 'all' || (m === 'sens' && !k.startsWith('src:') && k !== '_fn')) ? SHIDE.delete(k) : SHIDE.add(k); apply(); });   // „nur Sensoren“: Störungen und Notizen aus
  }
}
/* ================= Dashboard-Designer: Bereiche und Kacheln als Panels (GridStack 14, MIT) =================
   Jeder Bereich hat oben eine Leiste: ⠿ verschieben (nur im Modus „Layout anpassen“), Titel, ▾ einklappen, ✕ ausblenden;
   im Bearbeiten zusätzlich ↑ ↓ (Reihenfolge, auch am Handy) und ✎ (eigene Überschrift). Breite ändern an der Seite,
   die Höhe folgt dem Inhalt. Am Handy stehen alle untereinander. Mit der Tastatur: Bereich fokussieren, Pfeiltasten verschieben,
   Umschalt + ← → Breite, Umschalt + ↑ ↓ ein-/ausklappen, F2 Überschrift, Entf entfernen.
   Gespeichert in layout.json auf dem Server (PC und Handy gleich), im Browser nur als Rückfall; Spaltenbreiten der Tabellen ebenso. */
const DASH = { grids: {}, def: {}, st: {}, edit: false, ro: null, slot: null };
const LAYOUT = { srv: null, exists: false, cols: {}, t: 0, pend: {} };
async function layoutFetch() {
  try { const j = await (await fetch('layout', { cache: 'no-store' })).json();
    if (j && j.ok) { LAYOUT.srv = j.layout || { views: {}, cols: {} }; LAYOUT.exists = !!j.exists; LAYOUT.cols = (j.layout && j.layout.cols) || {}; } } catch (e) { }
}
function layoutPush(b) {                               // gesammelt senden (Ziehen, Tippen) – auf dem Server gespeichert
  if (b.views) LAYOUT.pend.views = Object.assign(LAYOUT.pend.views || {}, JSON.parse(JSON.stringify(b.views)));
  if (b.cols) { const c = LAYOUT.pend.cols = LAYOUT.pend.cols || {}; for (const [k, v] of Object.entries(b.cols)) c[k] = v == null ? null : Object.assign(c[k] || {}, v); }
  if (b.tbl) LAYOUT.pend.tbl = Object.assign(LAYOUT.pend.tbl || {}, JSON.parse(JSON.stringify(b.tbl)));   // Tabellen: ganzer Stand je Tabelle (null = Standard)
  clearTimeout(LAYOUT.t);
  LAYOUT.t = setTimeout(layoutFlush, 700);
}
async function layoutFlush() {
  clearTimeout(LAYOUT.t); const body = LAYOUT.pend; LAYOUT.pend = {}; if (!body.views && !body.cols && !body.tbl) return;
  try { const j = await (await fetch('layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); if (j && j.ok) { LAYOUT.srv = j.layout; LAYOUT.exists = true; } } catch (e) { }
}
addEventListener('pagehide', () => { if (LAYOUT.pend.views || LAYOUT.pend.cols || LAYOUT.pend.tbl) try { navigator.sendBeacon('layout', new Blob([JSON.stringify(LAYOUT.pend)], { type: 'application/json' })); LAYOUT.pend = {}; } catch (e) { } });
function colWidths(key) { return (key && LAYOUT.cols[key]) || null; }
function colSave(key, col, w) { if (!key) return; (LAYOUT.cols[key] = LAYOUT.cols[key] || {})[col] = w; layoutPush({ cols: { [key]: { [col]: w } } }); }
/* ab 1.84.0 je Tabelle: Reihenfolge der Spalten, ausgeblendete Spalten, Dichte – in layout.json („tbl“), im Browser als Rückfall. Nur Anzeige. */
function tblPref(key) {
  const s = key && LAYOUT.srv && LAYOUT.srv.tbl && LAYOUT.srv.tbl[key]; if (s) return JSON.parse(JSON.stringify(s));
  try { return (key && JSON.parse(localStorage.getItem('gl_tbl_' + key) || 'null')) || {}; } catch (e) { return {}; }
}
function tblSave(key, p) {
  if (!key) return; LAYOUT.srv = LAYOUT.srv || { views: {}, cols: {} }; const tb = LAYOUT.srv.tbl = LAYOUT.srv.tbl || {};
  if (p == null) delete tb[key]; else tb[key] = p;
  try { if (p == null) localStorage.removeItem('gl_tbl_' + key); else localStorage.setItem('gl_tbl_' + key, JSON.stringify(p)); } catch (e) { }
  layoutPush({ tbl: { [key]: p } });
}
function dashDefs() {
  const lv = $('liveview'), nv = $('nightview'), pg = nv.querySelector('.pgrid');
  let ha = $('nhalist'); if (!ha) { ha = el('div', { id: 'nhalist', className: 'nnotes nhalist' }); $('nnotes').after(ha); }
  return {
    live: [
      { id: 'fn', t: 'pn_fn', nodes: [$('fnpanel')], w: 12 },
      { id: 'live', t: 'pn_stats', nodes: [$('srcbar') && $('srcbar').parentElement, $('tilebar'), $('vp0')], w: 12 },
      { id: 'video', t: 'pn_video', nodes: [$('vpvid')], w: 12, auto: true, emp: () => $('vidlive').hidden },   // ab 1.84.0: Video, Spuren und Spektrogramm eigene Bereiche
      { id: 'graph', t: 'livetitle', nodes: [$('vp1')], w: 12 },   // ab 1.83.2 eigener Bereich: Notizen u. a. lassen sich zwischen Kacheln und Graph schieben
      { id: 'lanes', t: 'pn_lanes', nodes: [$('vpsc')], w: 12, auto: true, emp: () => $('scmain').hidden && $('scld').hidden },
      { id: 'spec', t: 'pn_spec', nodes: [$('vpsp')], w: 12 },
      { id: 'ldev', t: 'lev_title', nodes: [$('ldevcard')], w: 12 }],
    prot: [
      { id: 'sum', t: 'pn_sum', nodes: [$('nweek'), nv.querySelector('.nsum')], w: 12 },
      { id: 'run', t: 'pn_run', nodes: [$('nrun')], w: 12, auto: true },
      { id: 'day', t: 'dt_title', nodes: [$('ndaybox')], w: 12 },
      { id: 'ev', t: 'list', nodes: [nv.querySelector('.pevcard')], w: 12, vis: true },
      { id: 'notes', t: 'pn_notes', nodes: [$('nnotes')], w: 12, auto: true },
      { id: 'dlanes', t: 'pn_lanes', nodes: [$('scnd')], w: 12, auto: true, emp: () => $('scnd').hidden },
      { id: 'ha', t: 'pn_ha', nodes: [ha], w: 12, off: true, vis: true, auto: true },
      { id: 'hours', t: 'hours', nodes: [pg && pg.children[0]], w: 6 },
      { id: 'days', t: 'days', nodes: [pg && pg.children[1]], w: 6 }],
  };
}
function dashLoadSt(v) {
  const sv = LAYOUT.srv && LAYOUT.srv.views && LAYOUT.srv.views[v];
  if (sv) return JSON.parse(JSON.stringify(sv));
  let ls = {}; try { ls = JSON.parse(localStorage.getItem('gl_dash_' + v) || 'null') || {}; } catch (e) { }
  if (LAYOUT.srv && Object.keys(ls).length) ls._mig = true;      // Server hat noch nichts: Anordnung dieses Browsers übernehmen
  return ls;
}
function dashSave(v) {
  const g = DASH.grids[v], st = DASH.st[v]; if (!g) return;
  if (g.getColumn() === 12) st.lay = g.save(false).map(x => ({ id: x.id, x: x.x || 0, y: x.y || 0, w: x.w || 12 }));   // Handy (eine Spalte): Anordnung des PCs bleibt, ↑ ↓ ändern sie direkt
  if (v === 'prot') st.o3 = true;                       // Reihenfolge ab 1.85.3 gilt als übernommen (danach nie wieder umsortieren)
  const keep = Object.assign({}, st); delete keep._mig;
  try { localStorage.setItem('gl_dash_' + v, JSON.stringify(keep)); } catch (e) { }
  layoutPush({ views: { [v]: keep } });
}
const dashName = (v, p) => (DASH.st[v] && DASH.st[v].ttl && DASH.st[v].ttl[p.id]) || (p.title != null ? p.title : t(p.t));
function dashTitleApply(v, p, b) {                     // Überschrift: eigene (✎) vor der eingebauten; Sprachwechsel nur ohne eigene
  if (!b) { const it = dashItem(v, p.id); b = it && it.querySelector('.ptitle'); } if (!b) return;
  const own = DASH.st[v] && DASH.st[v].ttl && DASH.st[v].ttl[p.id];
  if (!own && p.title == null) b.dataset.i = p.t; else delete b.dataset.i;
  b.textContent = dashName(v, p);
  const it = b.closest('.grid-stack-item'); if (it) it.setAttribute('aria-label', t('dash_panel') + ': ' + dashName(v, p) + (DASH.edit ? '. ' + t('dash_kbd') : ''));
}
function dashMk(v, p, st, lay, gEl, items) {          // ein Bereich als Panel (auch nachträglich, z. B. Kachel)
  const ns = p.nodes.filter(Boolean); if (!ns.length) return;
  const it = el('div', { className: 'grid-stack-item' }), ct = el('div', { className: 'grid-stack-item-content' }), pn = el('div', { className: 'pnl' }); pn.dataset.p = p.id;
  it.setAttribute('role', 'group');
  const hd = el('div', { className: 'pnlhd' });
  const bt = (cls, key, txt) => `<button type="button" class="${cls}" aria-label="${esc(t(key))}" title="${esc(t(key))}">${txt}</button>`;
  hd.innerHTML = `<span class="pdrag" title="${esc(t('dash_drag'))}" aria-hidden="true">⠿</span><b class="ptitle"></b><span class="pnlx"></span>` +
    (p.vis ? `<button type="button" class="pvis" title="${esc(t('dash_vis_tip'))}">⌖ ${esc(t('dash_vis'))}</button>` : '') +
    bt('pedit pup', 'dash_up', '↑') + bt('pedit pdown', 'dash_down', '↓') + bt('pedit pren', 'dash_ren', '✎') +
    `<select class="pedit pw" aria-label="${esc(t('dash_w'))}" title="${esc(t('dash_w_tip'))}">${DASH_W.map(([w, l]) => `<option value="${w}">${esc(w === 12 ? t('dash_w_full') : l)}</option>`).join('')}</select>` +
    bt('pcol', 'dash_col', '▾') + bt('phide', 'dash_hide', '✕');
  dashTitleApply(v, p, hd.querySelector('.ptitle'));
  const bd = el('div', { className: 'pnlbd' }); ns.forEach(n => bd.appendChild(n));
  pn.append(hd, bd); ct.appendChild(pn); it.appendChild(ct);
  const L = lay[p.id]; it.setAttribute('gs-id', p.id); it.setAttribute('gs-w', String(L ? L.w : p.w)); if (L) { it.setAttribute('gs-x', L.x); it.setAttribute('gs-y', L.y); }
  it.setAttribute('aria-label', t('dash_panel') + ': ' + dashName(v, p));
  gEl.appendChild(it); items.push([p, it, pn]);
  hd.querySelector('.pcol').onclick = () => dashCol(v, p.id);
  hd.querySelector('.phide').onclick = () => dashHide(v, p.id);
  hd.querySelector('.pup').onclick = () => dashMove(v, p.id, -1);
  hd.querySelector('.pdown').onclick = () => dashMove(v, p.id, 1);
  hd.querySelector('.pren').onclick = () => dashRename(v, p.id);
  hd.querySelector('.pw').onchange = e => dashWidth(v, p.id, +e.target.value);
  hd.ondblclick = e => { if (!e.target.closest('button')) hd.querySelector('.pcol').click(); };
  if (p.vis) hd.querySelector('.pvis').onclick = () => { st.vis[p.id] = !st.vis[p.id]; dashApply(v); dashSave(v); visChanged(); };
  if (p.auto && p.emp) {                              // Bereich ohne Inhalt (keine Sensoren, kein Video): außerhalb von „Layout anpassen“ ganz ausgeblendet
    pn.classList.add('phe'); const sync = () => { const e = !!p.emp(); if (e !== pn.classList.contains('pempty')) { pn.classList.toggle('pempty', e); if (DASH.grids[v]) dashApply(v); if (!e) dashResized(); } };
    new MutationObserver(sync).observe(ns[0], { attributes: true, attributeFilter: ['hidden'], subtree: true }); sync();
  } else if (p.auto) { const n0 = ns[0]; pn.classList.add('phe');   // ab 1.85: leer (z. B. keine Unterbrechungen) außerhalb von „Layout anpassen“ ganz weg statt leerer Balken
    const sync = () => { const e0 = !!n0.hidden || !n0.childElementCount; if (e0 !== pn.classList.contains('pempty')) { pn.classList.toggle('pempty', e0); if (DASH.grids[v]) dashApply(v); if (!e0) dashResized(); } const q = n0.classList.contains('quiet') && !n0.hidden && !!n0.childElementCount; if (!q) pn.classList.remove('pqopen'); pn.classList.toggle('pquiet', q); pn.querySelector('.pcol').textContent = pn.classList.contains('pcolx') || (q && !pn.classList.contains('pqopen')) ? '▸' : '▾'; }; new MutationObserver(sync).observe(n0, { attributes: true, attributeFilter: ['hidden', 'class'], childList: true }); sync(); }
}
/* ab 1.85.2: Breite je Bereich (Layout anpassen): ganz, ¾, ⅔, ½, ⅓, ¼ – setzt GridStack, die Nachbarn rücken nach */
const DASH_W = [[12, ''], [9, '¾'], [8, '⅔'], [6, '½'], [4, '⅓'], [3, '¼']];
function dashWidth(v, id, w) {
  const g = DASH.grids[v], it = dashItem(v, id), n = it && it.gridstackNode; if (!g || !n || !(w >= 1 && w <= 12)) return;
  g.update(it, { w, x: Math.min(n.x, 12 - w) }); dashEq(g); dashSave(v); dashResized();
  const s = it.querySelector('.pw'); if (s) s.focus(); dashSay(v, id);
}
function dashWSync(it) {                               // Auswahl zeigt die aktuelle Breite (auch nach Ziehen am Rand)
  const s = it.querySelector('.pnlhd .pw'), n = it.gridstackNode; if (!s || !n) return;
  if (!DASH_W.some(x => x[0] === n.w) && !s.querySelector(`option[value="${n.w}"]`)) { const o = document.createElement('option'); o.value = n.w; o.textContent = n.w + '/12'; s.appendChild(o); }
  s.value = String(n.w);
}
function dashNextNode(v, id) {                        // leer gewesener Bereich kommt vor den, der in der Standard-Reihenfolge nach ihm steht (ab 1.85.3)
  const g = DASH.grids[v], defs = DASH.def[v] || [], i = defs.findIndex(p => p.id === id); if (!g || i < 0) return null;
  for (const p of defs.slice(i + 1)) { const n = g.engine.nodes.find(x => x.id === p.id); if (n) return n; }
  return null;
}
function dashItem(v, id) { const g = DASH.grids[v]; return g && (g.el.querySelector(`:scope > .grid-stack-item[gs-id="${CSS.escape(id)}"]`) || dashStash(g).querySelector(`:scope > .grid-stack-item[gs-id="${CSS.escape(id)}"]`)); }
/* ab 1.85.21: ausgeblendete/leere Bereiche liegen außerhalb des Rasters – sonst stimmt die Reihenfolge für GridStack nie und es sortiert bei jeder
   Änderung alle Bereiche neu (nimmt sie dabei kurz aus der Seite, offene Menüs gehen zu) */
function dashStash(g) { if (!g._stash || !g._stash.isConnected) { g._stash = el('div', { className: 'dashstash' }); g._stash.hidden = true; g.el.after(g._stash); } return g._stash; }
const dashAll = g => [...g.el.querySelectorAll(':scope > .grid-stack-item'), ...dashStash(g).children];
function dashCol(v, id) {
  const it = dashItem(v, id), pn = it && it.querySelector('.pnl'), st = DASH.st[v]; if (!pn) return;
  if (pn.classList.contains('pquiet') && !pn.classList.contains('pcolx')) { const o = pn.classList.toggle('pqopen'); pn.querySelector('.pcol').textContent = o ? '▾' : '▸'; dashResized(); dashRefresh(); return; }
  st.col[id] = !st.col[id]; if (!st.col[id]) delete st.col[id]; dashApply(v); dashSave(v);
}
function dashHide(v, id) {
  const st = DASH.st[v]; if (!st.off.includes(id)) st.off.push(id);
  const it = dashItem(v, id), next = it && (it.nextElementSibling || it.previousElementSibling);
  dashApply(v); dashSave(v); dashBar(v);
  if (DASH.edit && next) next.focus();
}
function dashRename(v, id) {
  const p = (DASH.def[v] || []).find(x => x.id === id); if (!p) return;
  const st = DASH.st[v], cur = dashName(v, p), orig = p.title != null ? p.title : t(p.t);
  const nv = prompt(t('dash_ren_q'), cur); if (nv == null) return;
  const s = nv.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);
  st.ttl = st.ttl || {}; if (!s || s === orig) delete st.ttl[id]; else st.ttl[id] = s;
  dashTitleApply(v, p); dashSave(v); dashBar(v);
  const it = dashItem(v, id); if (it && DASH.edit) it.focus();
}
function dashOrder(v) {                                // sichtbare Bereiche in Lesereihenfolge (oben nach unten, links nach rechts)
  const g = DASH.grids[v]; return g ? g.engine.nodes.slice().sort((a, b) => a.y - b.y || a.x - b.x) : [];
}
function dashFlow(ids, ws) {                           // 12er-Anordnung aus einer Reihenfolge (wie GridStack sie auffüllt)
  let x = 0, y = 0; const out = [];
  for (const id of ids) { const w = Math.max(1, Math.min(12, ws[id] || 12)); if (x + w > 12) { x = 0; y += 10; } out.push({ id, x, y, w }); x += w; if (x >= 12) { x = 0; y += 10; } }
  return out;
}
function dashMove(v, id, dir) {
  const g = DASH.grids[v], st = DASH.st[v]; if (!g) return;
  const ns = dashOrder(v), i = ns.findIndex(n => n.id === id), j = i + dir; if (i < 0 || j < 0 || j >= ns.length) return;
  const a = ns[i], b = ns[j];
  if (g.getColumn() === 12) {
    const pa = { x: a.x, y: a.y }, pb = { x: b.x, y: b.y };
    if (a.y === b.y) { g.batchUpdate(); g.update(a.el, { x: Math.min(pb.x, 12 - a.w), y: pb.y }); g.update(b.el, { x: Math.min(pa.x, 12 - b.w), y: pa.y }); g.batchUpdate(false); }
    else {                                             // übereinander (ab 1.84.0 auch bei ungleicher Höhe): der obere Platz bekommt den, der nach oben soll, der andere direkt darunter
      const top = a.y < b.y ? a : b, bot = top === a ? b : a, first = dir < 0 ? a : b, second = first === a ? b : a, y0 = top.y, tx = top.x, bx = bot.x;
      g.batchUpdate(); g.update(second.el, { y: y0 + first.h + 1000 }); g.update(first.el, { x: Math.min(tx, 12 - first.w), y: y0 }); g.update(second.el, { x: Math.min(bx, 12 - second.w), y: y0 + first.h }); g.batchUpdate(false);
    }
  } else {                                             // eine Spalte (Handy): Reihenfolge tauschen, dieselbe Vertauschung in der PC-Anordnung
    const order = ns.map(n => n.id); [order[i], order[j]] = [order[j], order[i]];
    const lay = {}; for (const x of st.lay || []) lay[x.id] = x;
    if (lay[a.id] && lay[b.id] && order.every(k => lay[k])) { const la = lay[a.id], lb = lay[b.id]; [la.x, lb.x] = [Math.min(lb.x, 12 - la.w), Math.min(la.x, 12 - lb.w)]; [la.y, lb.y] = [lb.y, la.y]; }
    else { const ws = {}; for (const p of DASH.def[v] || []) ws[p.id] = lay[p.id] ? lay[p.id].w : p.w; st.lay = dashFlow(order, ws).concat((st.lay || []).filter(x => !order.includes(x.id))); }
    const by = {}; for (const n of ns) by[n.id] = n;
    g.batchUpdate(); let y = 0; for (const k of order) { g.update(by[k].el, { x: 0, y }); y += by[k].h || 1; } g.batchUpdate(false);
  }
  dashSave(v); dashResized();
  const it = dashItem(v, id); if (it) { it.focus(); dashSay(v, id); }
}
function dashSay(v, id) {                              // Screenreader: neue Lage ansagen
  const live = $('dashlive'), n = (DASH.grids[v] && DASH.grids[v].engine.nodes.find(x => x.id === id)), p = (DASH.def[v] || []).find(x => x.id === id); if (!live || !n || !p) return;
  const ord = dashOrder(v);
  live.textContent = DASH.grids[v].getColumn() === 12 ? t('dash_pos', { n: dashName(v, p), x: n.x + 1, y: ord.indexOf(n) + 1, w: n.w }) : t('dash_pos1', { n: dashName(v, p), i: ord.indexOf(n) + 1, k: ord.length });
}
function dashKey(v, e) {                               // Tastatur im Bearbeiten (Fokus auf einem Bereich)
  if (!DASH.edit) return;
  const it = e.target; if (!it.classList || !it.classList.contains('grid-stack-item')) return;
  const g = DASH.grids[v], id = it.getAttribute('gs-id'), n = it.gridstackNode; if (!n) return;
  const one = g.getColumn() !== 12, k = e.key;
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); const p = (DASH.def[v] || []).find(x => x.id === id); if (p && confirm(t('dash_rm_q', { n: dashName(v, p) }))) dashHide(v, id); return; }
  if (k === 'F2') { e.preventDefault(); dashRename(v, id); return; }
  if (!/^Arrow/.test(k)) return;
  e.preventDefault();
  if (e.shiftKey && (k === 'ArrowUp' || k === 'ArrowDown')) { const col = !!DASH.st[v].col[id]; if ((k === 'ArrowUp') !== col) dashCol(v, id); it.focus(); return; }
  if (k === 'ArrowUp' || k === 'ArrowDown') { dashMove(v, id, k === 'ArrowUp' ? -1 : 1); return; }
  if (one) return;                                     // eine Spalte: nur die Reihenfolge
  if (e.shiftKey) { const w = Math.max(2, Math.min(12 - n.x, n.w + (k === 'ArrowRight' ? 1 : -1))); if (w !== n.w) g.update(it, { w }); }
  else { const x = Math.max(0, Math.min(12 - n.w, n.x + (k === 'ArrowRight' ? 1 : -1))); if (x !== n.x) g.update(it, { x }); }
  dashSave(v); dashResized(); it.focus(); dashSay(v, id);
}
function dashAddPanel(v, p) {
  const g = DASH.grids[v], st = DASH.st[v]; if (!g) return;
  const lay = {}; for (const x of st.lay || []) lay[x.id] = x;
  (DASH.def[v] = DASH.def[v] || []).push(p);
  const items = []; dashMk(v, p, st, lay, g.el, items); if (!items.length) { DASH.def[v].pop(); return; }
  const [, it, pn] = items[0]; if (!lay[p.id]) it.setAttribute('gs-y', '9999');
  if (st.off.includes(p.id)) { it.style.display = 'none'; dashStash(g).appendChild(it); } else g.makeWidget(it);
  DASH.ro.observe(pn); dashApply(v); dashBar(v); dashSlotUse(v, it);
}
/* ab 1.85.4: freie Stelle im Raster (Layout anpassen): „＋ Bereich hier“ öffnet die Auswahl, der neue Bereich kommt genau dorthin */
function dashSlotUse(v, it) {
  const sl = DASH.slot, g = DASH.grids[v]; if (!sl || sl.v !== v || !g || !it || !it.gridstackNode) return;
  DASH.slot = null; g.update(it, { x: sl.x, y: sl.y, w: sl.w }); dashEq(g); dashSave(v); dashResized();
  if (DASH.edit) { it.tabIndex = 0; it.focus(); dashSay(v, it.getAttribute('gs-id')); }
}
function dashSlots(g) {
  const old = g.el.querySelector(':scope > .dslots'); if (old) old.remove();
  if (!DASH.edit || g.getColumn() !== 12) return;
  const v = g.el.dataset.view, rows = {};
  for (const n of g.engine.nodes) if (n.el && n.el.style.display !== 'none') (rows[n.y] = rows[n.y] || []).push(n);
  const box = el('div', { className: 'dslots' }), W = g.el.clientWidth;
  for (const r of Object.values(rows)) {
    const used = r.reduce((a, n) => a + n.w, 0), end = Math.max(...r.map(n => n.x + n.w)); if (used >= 12 || end >= 12) continue;
    const w = 12 - end, top = Math.min(...r.map(n => n.el.offsetTop)), hgt = Math.max(...r.map(n => n.el.offsetHeight));
    const b = el('button', { type: 'button', className: 'dslot' });
    b.innerHTML = `<span aria-hidden="true">＋</span> ${esc(t('dash_slot'))}`; b.setAttribute('aria-label', t('dash_slot_a', { w }));
    Object.assign(b.style, { left: (end / 12 * W + 6) + 'px', top: (top + 6) + 'px', width: (w / 12 * W - 12) + 'px', height: Math.max(40, hgt - 12) + 'px' });
    b.onclick = () => { DASH.slot = { v, x: end, y: r[0].y, w }; dashLib(v, null, true); };
    box.appendChild(b);
  }
  if (box.childElementCount) g.el.appendChild(box);
}
function dashRemovePanel(v, id) {
  const g = DASH.grids[v]; if (!g) return;
  const it = dashItem(v, id);
  if (it) { if (it.gridstackNode) g.removeWidget(it, true); else it.remove(); }
  DASH.def[v] = (DASH.def[v] || []).filter(p => p.id !== id); const st = DASH.st[v]; st.off = st.off.filter(x => x !== id); if (st.ttl) delete st.ttl[id]; dashSave(v); dashBar(v);
}
function dashTitle(v, id, title) {
  const p = (DASH.def[v] || []).find(x => x.id === id); if (p) { p.title = title; dashTitleApply(v, p); }
}
function dashInit() {
  if (typeof GridStack === 'undefined' || DASH.inited) return; DASH.inited = true;
  const defs = dashDefs();
  if (!$('dashlive')) { const l = el('div', { id: 'dashlive', className: 'sr' }); l.setAttribute('aria-live', 'polite'); document.body.appendChild(l); }
  DASH.ro = new ResizeObserver(ents => { const gs = new Set(); for (const e of ents) { const it = e.target.closest('.grid-stack-item'), g = it && it.gridstackNode && it.gridstackNode.grid; if (g) gs.add(g); } gs.forEach(g => dashEq(g, false)); });
  for (const [v, list] of Object.entries(defs)) {
    const host = v === 'live' ? $('liveview') : $('nightview'), first = list.map(p => p.nodes[0]).find(Boolean); if (!first) continue;
    const st = DASH.st[v] = dashLoadSt(v); st.col = st.col || {}; st.off = st.off || list.filter(p => p.off).map(p => p.id); st.vis = st.vis || {}; st.ttl = st.ttl || {};
    if (v === 'prot' && st.lay && st.lay.length && !st.o3) {   // ab 1.85.3 einmalig: Standard-Reihenfolge (Übersicht, Unterbrechungen, Verlauf, Ereignisse, Notizen, Sensordaten, Statistik), Breiten bleiben
      const ws = {}; for (const x of st.lay) ws[x.id] = x.w; for (const p of list) if (ws[p.id] == null) ws[p.id] = p.w;
      st.lay = dashFlow(list.map(p => p.id), ws); st.o3 = true; st._mig = true;
    }
    if (v === 'prot') st.o3 = true;
    const bar = el('div', { className: 'dashbar' }), gEl = el('div', { className: 'grid-stack dashgrid' }); gEl.dataset.view = v;
    first.before(gEl); (DASH.bars = DASH.bars || {})[v] = bar;
    const fb = v === 'prot' && host.querySelector('.nfbar');           // ab 1.85.4: Protokolle – Layout-Knöpfe in derselben Menüzeile wie die Filter
    if (fb) { bar.classList.add('inbar'); const ex = fb.querySelector('.nexp'); (ex || fb).appendChild(bar); } else gEl.before(bar);
    if (v === 'live' && st.lay && st.lay.length && !st.lay.some(x => x.id === 'graph') && st.lay.some(x => x.id === 'live')) {   // ältere Anordnung (Kacheln und Graph in einem Bereich): Graph direkt danach
      const ord = [...st.lay].sort((a, b) => a.y - b.y || a.x - b.x).map(x => x.id), ws = {}; for (const x of st.lay) ws[x.id] = x.w;
      ord.splice(ord.indexOf('live') + 1, 0, 'graph'); ws.graph = ws.live || 12;
      st.lay = dashFlow(ord, ws); st._mig = true;
    }
    {                                                  // ab 1.84.0: Teile von „Live“ bzw. „Verlauf“ als eigene Bereiche – ältere Anordnung sieht gleich aus (direkt um den Graph, gleiche Breite, ausgeblendet/eingeklappt wie er)
      const base = v === 'live' ? 'graph' : 'day', pre = v === 'live' ? ['video'] : [], post = v === 'live' ? ['lanes', 'spec'] : ['dlanes'], nw = pre.concat(post);
      const known = id => (st.lay || []).some(x => x.id === id) || st.off.includes(id) || !!st.col[id];
      if (st.lay && st.lay.length && !nw.some(known) && (st.lay.some(x => x.id === base) || st.off.includes(base))) {
        const ord = [...st.lay].sort((a, b) => a.y - b.y || a.x - b.x).map(x => x.id), ws = {}; for (const x of st.lay) ws[x.id] = x.w;
        const i = ord.indexOf(base);
        if (i >= 0) { ord.splice(i + 1, 0, ...post); ord.splice(i, 0, ...pre); nw.forEach(id => { ws[id] = ws[base] || 12; }); st.lay = dashFlow(ord, ws); }
        if (st.off.includes(base)) nw.forEach(id => st.off.push(id));
        if (st.col[base]) post.forEach(id => { st.col[id] = true; });
        st._mig = true;
      }
    }
    const lay = {}; for (const x of st.lay || []) lay[x.id] = x;
    const items = [];
    DASH.def[v] = list;
    for (const p of list) dashMk(v, p, st, lay, gEl, items);
    pg_cleanup(host);
    const g = DASH.grids[v] = GridStack.init({ column: 12, cellHeight: 8, margin: 6, mode: 'top', staticGrid: true, sizeToContent: true, handle: '.pdrag', animate: true,
      resizable: { handles: 'e,w' }, columnOpts: { breakpoints: [{ w: 760, c: 1 }], layout: 'list' } }, gEl);
    g.on('change', () => { if (DASH.edit) dashSave(v); });     // auch Höhenänderungen durch den Inhalt: nur im Bearbeiten speichern
    g.on('resizestop dragstop', () => { dashSave(v); dashEq(g); dashResized(); });
    gEl.addEventListener('keydown', e => dashKey(v, e));
    items.forEach(([p, it, pn]) => DASH.ro.observe(pn));
    dashApply(v); dashBar(v);
    if (st._mig) dashSave(v);                          // Anordnung aus diesem Browser auf den Server übernehmen
  }
}
function pg_cleanup(host) { const pg = host.querySelector('.pgrid'); if (pg && !pg.children.length) pg.remove(); }
function dashApply(v) {
  const g = DASH.grids[v], st = DASH.st[v]; if (!g) return;
  dashAll(g).forEach(it => { const id = it.getAttribute('gs-id'), pn = it.querySelector('.pnl');
    pn.classList.toggle('pcolx', !!st.col[id]); pn.querySelector('.pcol').textContent = st.col[id] || (pn.classList.contains('pquiet') && !pn.classList.contains('pqopen')) ? '▸' : '▾';
    pn.querySelector('.pcol').setAttribute('aria-expanded', st.col[id] ? 'false' : 'true');
    const vb = pn.querySelector('.pvis'); if (vb) { vb.classList.toggle('on', !!st.vis[id]); vb.setAttribute('aria-pressed', st.vis[id] ? 'true' : 'false'); }
    const emp = !DASH.edit && pn.classList.contains('phe') && pn.classList.contains('pempty');   // leer (kein Video, keine Sensoren): ohne Lücke weg, Platz gemerkt
    const off = st.off.includes(id) || emp;
    if (off && it.gridstackNode) { if (emp) { it.dataset.ex = it.gridstackNode.x; it.dataset.ey = it.gridstackNode.y; } else { delete it.dataset.ex; delete it.dataset.ey; } g.removeWidget(it, false, false); it.style.display = 'none'; dashStash(g).appendChild(it); }
    else if (!off && !it.gridstackNode) { g.el.appendChild(it); it.style.display = ''; if (it.dataset.ey != null) { const nx = dashNextNode(v, id); it.setAttribute('gs-y', nx ? nx.y : 9999); it.setAttribute('gs-x', nx ? nx.x : 0); delete it.dataset.ex; delete it.dataset.ey; } else { it.setAttribute('gs-y', '9999'); it.removeAttribute('gs-x'); } g.makeWidget(it); }   // wieder eingeblendet: unten anfügen (leer gewesene an ihren Platz)
    if (off) it.removeAttribute('tabindex'); else if (DASH.edit) it.tabIndex = 0; else it.removeAttribute('tabindex');
  });
  dashEq(g);
}
/* ab 1.85.2: Bereiche nebeneinander (gleiche Zeile) so hoch wie der höchste; Inhalt bestimmt weiter die eigene Höhe */
function dashEq(g, pack) {                             // pack=false: nur Höhen (Inhalt geändert) – nicht neu ordnen, sonst nimmt GridStack offene Menüs kurz aus der Seite
  if (!g || !g.el) return;
  const v = g.el.dataset.view, col = g.getColumn(), st = DASH.st[v];
  if (col === 12 && g._col && g._col !== 12 && st && st.lay) {      // vom Handy zurück: gespeicherte PC-Anordnung (GridStack rechnet sonst aus der Liste zurück)
    const lay = {}; for (const x of st.lay) lay[x.id] = x;
    g.batchUpdate(); for (const n of g.engine.nodes) { const L = lay[n.id]; if (L) g.update(n.el, { x: L.x, y: L.y, w: L.w }); } g.batchUpdate(false);
  }
  g._col = col;
  const its = g.getGridItems().filter(it => it.style.display !== 'none' && it.gridstackNode);
  its.forEach(it => { const p = it.querySelector('.pnl'); if (p) p.style.minHeight = ''; g.resizeToContent(it); });
  if (col === 12 && pack !== false) g.compact('list');                      // GridStack „list“: in Reihenfolge auffüllen – halbe Bereiche nebeneinander, Rest der Zeile frei, nichts springt nach oben
  if (col === 12) {                                  // gleiche Zeile: der kürzere Inhalt wird so hoch wie der höchste, GridStack passt die Zelle an (sizeToContent)
    const rows = {}; its.forEach(it => { const n = it.gridstackNode; (rows[n.y] = rows[n.y] || []).push(it); });
    for (const r of Object.values(rows)) {
      if (r.length < 2) continue; const ps = r.map(it => it.querySelector('.pnl')), hp = Math.max(...ps.map(p => p.offsetHeight));
      ps.forEach((p, i) => { if (p.offsetHeight < hp - 1) { p.style.minHeight = hp + 'px'; g.resizeToContent(r[i]); } });
    }
  }
  its.forEach(dashWSync); dashSlots(g);
}
function dashResized() { clearTimeout(DASH.rt); DASH.rt = setTimeout(() => { window.dispatchEvent(new Event('resize')); if (TBL) try { TBL.fit(); } catch (e) { } }, 120); }
function dashRefresh() { for (const v of Object.keys(DASH.grids)) { const g = DASH.grids[v]; g.onResize(); dashEq(g); } }
function dashEdit(on) {
  DASH.edit = on; if (!on) DASH.slot = null;
  for (const k of Object.keys(DASH.grids)) { DASH.grids[k].setStatic(!on); DASH.grids[k].el.classList.toggle('dashedit', on); dashApply(k); dashBar(k); for (const p of DASH.def[k] || []) dashTitleApply(k, p); }
  if (!on) { for (const k of Object.keys(DASH.grids)) dashSave(k); layoutFlush(); }
  dashRefresh();
}
function dashBar(v) {
  const g = DASH.grids[v], st = DASH.st[v], bar = g && DASH.bars && DASH.bars[v]; if (!bar) return;
  const nh = !DASH.edit && st.off.length ? `<span class="dhid" title="${esc(t('dash_hidden', { n: st.off.length }))}">${st.off.length}</span><span class="sr">${esc(t('dash_hidden', { n: st.off.length }))}</span>` : '';   // ausgeblendete: Zahl am Knopf statt eigener Text
  const inb = bar.classList.contains('inbar'), fbar = inb && bar.closest('.nfbar'); if (fbar) fbar.classList.toggle('dashediting', DASH.edit);   // Bearbeiten: rechts die Layout-Werkzeuge statt Protokoll/Bild
  const lbl = DASH.edit ? t('dash_done') : inb ? t('dash_edit_s') : t('dash_edit');
  bar.innerHTML = `<button type="button" class="chip dedit${DASH.edit ? ' pri' : ''}" aria-pressed="${DASH.edit}" title="${esc(t(DASH.edit ? 'dash_done' : 'dash_edit'))}"${inb && !DASH.edit ? ` aria-label="${esc(t('dash_edit') + (st.off.length ? ', ' + t('dash_hidden', { n: st.off.length }) : ''))}"` : ''}>▦ ${esc(lbl)}${nh}</button>` +
    (DASH.edit ? `<button type="button" class="chip dlib" title="${esc(t('dash_kbd'))}">＋ ${esc(t('dash_add'))}</button>` : '') +
    (MF.list.length ? `<button type="button" class="chip dmf${MF.show ? ' on' : ''}" aria-pressed="${MF.show}" title="${esc(t('mf_show_tip'))}">⊘ ${esc(t('mf_show'))}</button>` : '') +
    (DASH.edit ? `<button type="button" class="chip dreset" title="${esc(t('dash_reset'))}"${inb ? ` aria-label="${esc(t('dash_reset'))}"` : ''}>↺${inb ? '' : ' ' + esc(t('dash_reset'))}</button><span class="sr">${esc(t('dash_kbd'))}</span>` : '');
  bar.querySelector('.dedit').onclick = () => dashEdit(!DASH.edit);
  const mfb = bar.querySelector('.dmf'); if (mfb) mfb.onclick = mfToggle;
  const lb = bar.querySelector('.dlib'); if (lb) lb.onclick = () => dashLib(v);
  const rs = bar.querySelector('.dreset'); if (rs) rs.onclick = async () => {
    if (!confirm(t('dash_reset_q'))) return;
    LAYOUT.pend = {}; clearTimeout(LAYOUT.t);
    try { await fetch('layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: v }) }); } catch (e) { }
    try { localStorage.removeItem('gl_dash_' + v); } catch (e) { } location.reload(); };
}
/* Bibliothek: Bereiche dieser Ansicht ein- und ausblenden, neue Kachel (Art wählen) oder fertige Vorlage */
const TILE_TYPES = [['num', '🔢', 'none', 'sel'], ['line', '📈', 'day', '30'], ['bar', '📊', 'hour', 'sel'], ['list', '📋', 'art', '7'], ['table', '▦', 'dev', '30']];
function dashLib(v, focus, keepSlot) {
  if (!keepSlot) DASH.slot = null;
  let dlg = $('dlibdlg'); if (!dlg) { dlg = el('dialog', { id: 'dlibdlg', className: 'stdlg dlibdlg' }); document.body.appendChild(dlg); }
  const st = DASH.st[v], defs = DASH.def[v] || [];
  const tpls = STATS.tpls.slice().sort((a, b) => (a.view === v ? 0 : 1) - (b.view === v ? 0 : 1));
  dlg.innerHTML = `<div class="sthead"><h3 id="dlibh">＋ ${esc(t('dash_lib'))}</h3><button type="button" class="chip stx" aria-label="${esc(t('a_close'))}">✕</button></div>
    <h4>${esc(t('dash_lib_secs'))}</h4>
    <ul class="dliblist">${defs.map(p => { const off = st.off.includes(p.id);
      return `<li><span class="dlibn">${p.stat ? '📊 ' : ''}${esc(dashName(v, p))}</span><small class="mut">${esc(t(off ? 'dash_hidden1' : 'dash_shown'))}</small><button type="button" class="chip${off ? ' pri' : ''}" data-p="${esc(p.id)}" data-a="${off ? 'show' : 'hide'}">${esc(t(off ? 'dash_show' : 'dash_remove'))}</button></li>`; }).join('')}</ul>
    <h4 id="dlibtiles">${esc(t('dash_lib_tiles'))}</h4><p class="mut">${esc(t(STATS.pro ? 'dash_lib_tiles_h' : 'dash_lib_tiles_free'))}</p>
    <div class="dlibtypes">${TILE_TYPES.map(([k, ic]) => `<button type="button" class="dlibtype" data-tt="${k}"><span aria-hidden="true">${ic}</span><b>${esc(t('tl_' + k))}</b><small>${esc(t('tl_' + k + '_h'))}</small></button>`).join('')}</div>
    <h4>${esc(t('dash_lib_tpl'))}</h4><div class="sttpl">${tpls.map(x => `<button type="button" class="chip" data-tpl="${esc(x.tpl)}">${esc(x.name[lang === 'en' ? 1 : 0])}</button>`).join('')}</div>
    <p class="mut">${esc(t('st_ha_h'))}</p>
    <div class="stbtns"><button type="button" class="chip dcolrs">↺ ${esc(t('dash_cols_reset'))}</button><span class="sthsp"></span><span class="stmsg" role="status"></span><button type="button" class="pri stcancel">${esc(t('dash_done'))}</button></div>`;
  dlg.setAttribute('aria-labelledby', 'dlibh');
  dlg.querySelector('.stx').onclick = dlg.querySelector('.stcancel').onclick = () => dlg.close();
  dlg.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const id = b.dataset.p; st.off = st.off.filter(x => x !== id); if (b.dataset.a === 'hide') st.off.push(id); dashApply(v); if (b.dataset.a === 'show' && DASH.slot) { dashSlotUse(v, dashItem(v, id)); dlg.close(); return; } dashSave(v); dashBar(v); dashLib(v, null, true); const nb = dlg.querySelector(`[data-p="${CSS.escape(id)}"]`); if (nb) nb.focus(); });
  dlg.querySelectorAll('[data-tt]').forEach(b => b.onclick = () => { dlg.close(); statNew(v, b.dataset.tt); });
  dlg.querySelectorAll('[data-tpl]').forEach(b => b.onclick = async () => {
    try { const j = await (await fetch('stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', tpl: b.dataset.tpl, view: v }) })).json();
      if (!j.ok) { dlg.querySelector('.stmsg').textContent = t(j.error === 'limit' ? 'st_limit' : 'saveerr'); return; } STATS.list = j.list; statSync(); dlg.close(); } catch (e) { dlg.querySelector('.stmsg').textContent = t('saveerr'); } });
  dlg.querySelector('.dcolrs').onclick = async () => { if (!confirm(t('dash_cols_q'))) return; LAYOUT.cols = {}; LAYOUT.pend.cols = null; delete LAYOUT.pend.cols;
    try { await fetch('layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: 'cols' }) }); } catch (e) { } location.reload(); };
  if (!dlg.open) dlg.showModal();
  if (focus === 'tiles') { const f = dlg.querySelector('[data-tt]'); if (f) f.focus(); }
}
/* „nur sichtbarer Bereich“: Tabelle bzw. Sensor-Liste folgen dem Zoom im Verlauf */
function dashVis(id) { const st = DASH.st.prot; return !!(st && st.vis && st.vis[id]) && DT.from != null && DT.to != null; }
function visChanged() { clearTimeout(DASH.vt); DASH.vt = setTimeout(() => { tblFilter(); haListRender(); }, 250); }
function tblFilter() {                               // Tabelle Protokolle: nur sichtbarer Bereich und/oder Klick in einer Statistik
  if (!(TBL && TBL._built)) return;
  const fs = []; if (dashVis('ev')) fs.push(d => d.start + (d.dur || 0) * 1000 >= DT.from && d.start <= DT.to);
  const sf = STATS.filt.prot; if (sf) fs.push(d => statMatch(sf, d, 'prot'));
  TBLEXT = fs.length ? d => fs.every(f => f(d)) : null; TBL.refilter();
}

/* Anklickbare Stelle im Verlauf: bei Überlappung (z. B. Fernseher und Türsensor gleichzeitig) gewinnt die engste Fläche */
function hitAt(S, x, y) {
  let best = null, bs = Infinity;
  for (const q of S.downHit || []) { if (x < q[0] || x > q[1] || (q[4] != null && y > q[4]) || (q[5] != null && y < q[5])) continue;
    const sp = (q[4] != null ? q[4] : 1e4) - (q[5] != null ? q[5] : -1e4) + (q[1] - q[0]) * 1e-3; if (sp < bs) { bs = sp; best = q; } }
  return best;
}
/* Farbe je Sensor (Regel „als Ereignis“): selbst gewählt, sonst fest aus dem Namen – gleich in allen Zeilen und Ansichten */
const SENS_PAL = ['#e8590c', '#d6336c', '#7048e8', '#0ca678', '#f59f00', '#1098ad', '#ae3ec9', '#74b816'];
function sensCol(a) { if (a && a[6]) return a[6]; const n = String((a && a[2]) || ''); let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return SENS_PAL[h % SENS_PAL.length]; }
function haLanes(list) { const m = new Map(); for (const n of [...new Set(list.map(a => a[2]))].sort((a, b) => a.localeCompare(b))) m.set(n, m.size); return m; }   // feste Reihenfolge der Spuren (nach Name), gleich in allen Zeilen                            // aufgeklappte Gruppen
let EVVIEW = (() => { try { return localStorage.getItem('laerm_evview') || 'grp'; } catch (e) { return 'grp'; } })();
const clockOf = iso => { const d = new Date(iso); return isNaN(d) ? '' : pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };
const shortName = n => { n = String(n || ''); return n.length > 12 ? n.slice(0, 11) + '…' : n; };
let EVSIG = '';
/* Filter "Art": eigene Namen der benannten Bereiche zusaetzlich zu den Geraeuscharten */
function syncLabelFilter() {
  const sel = $('artflt'), want = [...new Set(EV.events.flatMap(r => r.labels || []))].sort((a, b) => a.localeCompare(b));
  const have = [...sel.options].filter(o => o.value.startsWith('lb:')).map(o => o.value.slice(3));
  if (JSON.stringify(want) === JSON.stringify(have)) return;
  const cur = sel.value;
  [...sel.options].filter(o => o.value.startsWith('lb:')).forEach(o => o.remove());
  const none = [...sel.options].find(o => o.value === '_none');
  for (const n of want) { const o = document.createElement('option'); o.value = 'lb:' + n; o.textContent = '🏷 ' + n; sel.insertBefore(o, none || null); }
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : '';
}
const SRC_ICON = { local: '🎙', phone: '📱', url: '📡' };
function srcCell(r) {
  const s = SOURCES.find(x => x.id === (r.quelle_id || 'main'));
  const type = s ? s.type : (r.quelle_id === 'main' || !r.quelle_id ? 'local' : '');
  const name = r.quelle || (s && s.name) || r.quelle_id || '';
  const dev = s ? (s.device_info || (type === 'local' ? t('input_dev', { d: (CUR && CUR.device) || 'default' }) : t('type_' + type))) : t('src_gone');
  return `<td class="srcc"><span class="si" title="${esc(type ? t('type_' + type) : t('src_gone'))}">${SRC_ICON[type] || '❓'}</span><span class="sn"><b>${esc(name)}</b><small>${esc(dev)}</small></span></td>`;
}
function selectedKeys() { return [...SEL]; }
function syncDelBar() {
  const n = selectedKeys().length, bar = $('delbar');
  bar.style.display = n ? 'flex' : 'none'; $('artsel').hidden = !!(CUR && CUR.classify === false); $('events').classList.toggle('selmode', n > 0);
  $('delcount').textContent = t('sel_count', { n });
  const all = $('ckall'), tot = evAllEv().length;
  if (all) { all.checked = n > 0 && n >= tot; all.indeterminate = n > 0 && n < tot; }
}
async function deleteEvents(keys) {
  if (!keys.length) return;
  if (!confirm(keys.length === 1 ? t('confirm_del_ev') : t('confirm_del_evs', { n: keys.length }))) return;
  try {
    const r = await (await fetch('delete_events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys }) })).json();
    if (!r.ok) throw new Error(r.error || 'error');
    if (r.deleted < keys.length) alert(t('del_partial', { n: r.deleted, m: keys.length }));
    lastCount = -1; await loadEvents(); syncDelBar(); loadSources(); if (NV.open) loadNight();   // Kopfzahlen und Verlauf auch neu
  } catch (e) { alert(t('saveerr') + ' ' + e.message); }
}
/* Kontextmenue je Zeile (Knopf ⋮ oder Rechtsklick) */
function openRowMenu(tr, x, y) {
  const m = $('rowmenu'), f = tr.dataset.f;
  const dl = m.querySelector('a.dl');
  if (f && !/\.wav$/i.test(f)) { dl.href = 'clips/' + encodeURIComponent(f); dl.setAttribute('download', f); dl.classList.remove('dis'); dl.removeAttribute('aria-disabled'); }
  else { dl.removeAttribute('href'); dl.classList.add('dis'); dl.setAttribute('aria-disabled', 'true'); }
  m.querySelector('.del1').onclick = () => { closeRowMenu(); deleteEvents([tr.dataset.k]); };
  m.querySelector('.view1').onclick = () => { closeRowMenu(); openEvent(tr.dataset.k); };
  const a1 = m.querySelector('.art1'); a1.hidden = !f || /\.wav$/i.test(f) || (CUR && CUR.classify === false);
  a1.onclick = () => { closeRowMenu(); recheckEvents([f]); };
  m.querySelector('.sel1').onclick = () => { closeRowMenu(); evSelToggle([tr.dataset.k], !SEL.has(tr.dataset.k)); };
  { const r = evByK(tr.dataset.k), c1 = m.querySelector('.conf1'), m1 = m.querySelector('.mf1');
    if (c1) { c1.hidden = !r || (CUR && CUR.classify === false); c1.onclick = () => { const b = c1.getBoundingClientRect(); closeRowMenu(); artConfirmPop(r, b.left, b.bottom + 4); }; }
    if (m1) { m1.hidden = !r; m1.onclick = () => { closeRowMenu(); mfFromEvent(r); }; } }
  { const on = SEL.has(tr.dataset.k), s1 = m.querySelector('.sel1'); s1.querySelector('.mi').textContent = on ? '☑' : '☐'; s1.querySelector('span').textContent = t(on ? 'm_unselect' : 'm_select'); }
  m.style.display = 'block';
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + 'px';
  const first = m.querySelector('a.dl:not(.dis)') || m.querySelector('.sel1'); MENU_AT = Date.now(); if (first) first.focus({ preventScroll: true });
}
/* ---------- Ereignis ansehen: gespeicherte Laermspur, "Ablauf zeigen", Marker und benannte Bereiche ---------- */
/* Ablauf ohne Ton: eine Uhr mit derselben Schnittstelle wie ein Mediaplayer (currentTime, play, pause ...),
   damit Abspiel-Linie, Sprung zu Notizen und das stumme Video unveraendert funktionieren. */
class VClock {
  constructor(dur) { this.duration = dur; this.t = 0; this.paused = true; this.ended = false; this.raf = 0; this.readyState = 4; this.onplay = this.onpause = this.onended = this.ontimeupdate = null; }
  get currentTime() { if (!this.paused) this.t = Math.min(this.duration, this.t0 + (performance.now() - this.p0) / 1000); return this.t; }
  set currentTime(v) { this.t = clamp(v || 0, 0, this.duration); this.t0 = this.t; this.p0 = performance.now(); this.ended = false; if (this.ontimeupdate) this.ontimeupdate(); }
  play() {
    if (!this.paused) return Promise.resolve();
    if (this.t >= this.duration - 0.01) this.t = 0;
    this.paused = false; this.ended = false; this.t0 = this.t; this.p0 = performance.now();
    const tick = () => {
      if (this.paused) return;
      const ct = this.currentTime; if (this.ontimeupdate) this.ontimeupdate();
      if (ct >= this.duration) { this.paused = true; this.ended = true; if (this.onended) this.onended(); return; }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick); if (this.onplay) this.onplay();
    return Promise.resolve();
  }
  pause() { if (this.paused) return; this.t = this.currentTime; this.paused = true; cancelAnimationFrame(this.raf); if (this.onpause) this.onpause(); }
  addEventListener(_e, f) { f(); }
}
const EVV = { g: null, row: null, a: null, k: null, raf: 0, lut: null, labels: { l: [], rej: [] }, sugg: [], marks: [], fine: {}, names: [], hit: [] };
function evDecode(g) {
  const nb = (g.bands || []).length || NB;
  const R = g.recs.map(r => { const sb = atob(r[5] || ''), sp = new Uint8Array(nb); for (let i = 0; i < nb && i < sb.length; i++) sp[i] = sb.charCodeAt(i); return { o: r[0], l: r[1], b: r[2], t: r[3], a: r[4], sp }; });
  R.nb = nb; R.step = g.step || 100;
  return R;
}
const ART_HEX = { knock: '#e0314b', door: '#e8590c', steps: '#f0a500', voice: '#7048e8', tv: '#1c7ed6', scrape: '#c2255c', signal: '#2b8a3e', animal: '#66a80f', noise: '#868e96', other: '#868e96' };
const darkUI = () => { const r = document.documentElement.getAttribute('data-theme'); return r ? r === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
const lbCol = (name, dk) => { let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 70% ${(dk ?? darkUI()) ? 64 : 45}%)`; };   // dunkel: heller, sonst kaum lesbar
async function openEvent(k, seekOff, autoPlay) {
  const d = $('evdlg'); EVV.k = k; EVV.notes = []; EVV.sel = null; ntEditorClose(); lbPopClose(); renderNotes();
  $('evinfo').textContent = t('listen_load'); $('evnone').textContent = ''; if (!d.open) d.showModal();
  let j;
  try { j = await (await fetch('event?k=' + encodeURIComponent(k), { cache: 'no-store' })).json(); } catch (e) { j = { ok: false }; }
  if (!j.ok) { $('evinfo').textContent = t('ev_gone'); return; }
  const r = j.row; EVV.row = r; EVV.g = j.graph; EVV.spc = null;
  EVV.d = j.graph ? evDecode(j.graph) : [];
  EVV.marks = (j.ki && j.ki.marks) || []; EVV.fine = j.fine || {}; EVV.labels = j.labels || { l: [], rej: [] }; EVV.sugg = j.sugg || []; EVV.names = j.names || [];
  EVV.vOff = j.graph && j.graph.core ? j.graph.core[0] / 1000 : 0;          // Video beginnt mit dem Ereignis, die Spur mit dem Umfeld davor
  $('evtitle').textContent = '📈 ' + fmtWhen(r.start) + ' · ' + (r.quelle || r.quelle_id || '');
  $('evinfo').innerHTML = [[t('dur'), fmtDur(r.dauer_s)], [t('peak'), fdb(r.spitze_dbfs) + ' dBFS'], [t('thr_col'), fdb(r.schwelle_dbfs) + ' dBFS'],
    [t('bg_col'), fdb(r.hintergrund_dbfs) + ' dBFS'], [t('spur_len'), r.clip_s ? r.clip_s + ' s' : '–']].concat(preInfo(j.graph, parseFloat(r.spitze_dbfs))).concat(haInfo(j.graph)).map(([a, b, tip]) => `<span${tip ? ` title="${esc(tip)}"` : ''}><small>${esc(a)}</small><b>${esc(String(b))}</b></span>`).join('');
  renderEvArt(j); renderEvProf(j);
  EVV.notes = j.notes || []; if (j.note_tags) NOTE_TAGS = j.note_tags; renderNotes(); renderLabels(); EVV.snote = j.snote || {}; renderSubs(j); enoteShow(j.enote || ''); renderEvLists(j.plists); renderCmp(j); renderEvFn(j.fnotes); renderEvSc(j.sc); slSel(r.k || k, r.start);
  $('evnone').textContent = !j.graph ? t('ev_nograph') : j.graph.final === false ? t('ev_partial') : '';
  document.querySelector('.evcvs').style.display = j.graph ? '' : 'none';
  if (EVV.a) { EVV.a.pause(); EVV.a = null; }
  const pb = $('evplay'), dl = $('evdl'), vdl = $('evvdl');
  const vbox = $('evvidbox'), vv = $('evvid'); vbox.hidden = !r.video; vv.pause(); vv.removeAttribute('src'); vv.load(); vv.muted = true;
  const au = $('evaudio'); au.pause(); au.removeAttribute('src'); au.load();
  const snd = EVV.snd = !!j.wav;                          // echter Ton nur, wenn fuer das Geraet eingeschaltet
  if (snd) au.src = 'clips/' + encodeURIComponent(j.wav);
  EVV.aOff = j.graph && j.graph.core && /\.lsp$/i.test(r.datei || '') ? j.graph.core[0] / 1000 : 0;   // Ton beginnt mit dem Vorlauf
  const stem = r.datei ? r.datei.replace(/\.(wav|lsp)$/i, '') : '';
  if (j.graph) {
    const total = Math.max(0.5, parseFloat(j.graph.clip_s) || (EVV.d.length ? EVV.d[EVV.d.length - 1].o / 1000 : 0));
    const a = EVV.a = new VClock(total);
    if (r.video) vv.src = 'clips/' + encodeURIComponent(stem + '.mp4');
    const lbl = snd ? 'ev_play_snd' : 'ev_show';
    a.onended = a.onpause = () => { pb.textContent = '▶ ' + t(lbl); if (!vv.paused) vv.pause(); if (!au.paused) au.pause(); evDraw(); };
    a.onplay = () => { pb.textContent = '⏸ ' + t('ev_show_stop'); evLoop(); };
    a.ontimeupdate = () => {
      $('evtime').textContent = a.currentTime.toFixed(1) + ' / ' + total.toFixed(1) + ' s';
      if (snd && au.readyState >= 1) {                     // Ton (falls gespeichert) an der richtigen Stelle mitlaufen lassen
        const at = a.currentTime - EVV.aOff;
        if (at < 0 || at > (au.duration || 0)) { if (!au.paused) au.pause(); }
        else { if (Math.abs(au.currentTime - at) > 0.25) au.currentTime = at; if (!a.paused && au.paused) au.play().catch(() => { }); if (a.paused && !au.paused) au.pause(); }
      }
      if (r.video && vv.readyState >= 1) {                 // stummes Video mitlaufen lassen
        const vt = a.currentTime - EVV.vOff;
        if (vt < 0 || vt > (vv.duration || 0)) { if (!vv.paused) vv.pause(); vv.currentTime = clamp(vt, 0, vv.duration || 0); }
        else { if (Math.abs(vv.currentTime - vt) > 0.35) vv.currentTime = vt; if (!a.paused && vv.paused) vv.play().catch(() => { }); if (a.paused && !vv.paused) vv.pause(); }
      }
    };
    pb.disabled = false; pb.textContent = '▶ ' + t(lbl); $('evtime').textContent = '0.0 / ' + total.toFixed(1) + ' s';
  } else { pb.disabled = true; pb.textContent = '▶ ' + t('ev_show'); $('evtime').textContent = ''; }
  pb.hidden = !snd; $('evtime').hidden = !snd;          // Abspielen nur mit gespeichertem echtem Ton (sonst ausgeblendet)
  const lsp = /\.lsp$/i.test(r.datei || '');
  dl.style.display = lsp ? '' : 'none'; if (lsp) { dl.href = 'clips/' + encodeURIComponent(r.datei); dl.setAttribute('download', r.datei); }
  vdl.style.display = r.video ? '' : 'none'; if (r.video) { vdl.href = 'clips/' + encodeURIComponent(stem + '.mp4'); vdl.setAttribute('download', stem + '.mp4'); }
  $('evlegacy').hidden = !j.legacy || snd;
  const wn = $('evwavnote'); wn.hidden = !j.wav_skip && !(j.has_wav && !snd && !j.legacy);
  wn.textContent = j.wav_skip === 'voice' ? t('snd_skip_voice') : j.wav_skip === 'error' ? t('snd_skip_err') : t('snd_off_hint');
  requestAnimationFrame(evDraw);
  if (seekOff != null) ntSeek(seekOff); else if (autoPlay && EVV.a && snd) EVV.a.play();
}
function evLoop() { cancelAnimationFrame(EVV.raf); const f = () => { evDraw(); if (EVV.a && !EVV.a.paused) EVV.raf = requestAnimationFrame(f); }; EVV.raf = requestAnimationFrame(f); }
/* ================= Protokolllisten ================= */
const PV = { open: false, lists: [], cur: '', ev: null, form: '' };
try { PV.cur = localStorage.getItem('laerm_plist') || ''; } catch (e) { }
async function plFetch() { try { PV.lists = (await (await fetch('plists', { cache: 'no-store' })).json()).lists || []; } catch (e) { } plFillMove(); return PV.lists; }
async function plPost(name, body) {
  const r = await (await fetch(name, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  if (!r.ok) throw new Error(r.error || 'error'); if (r.lists) { PV.lists = r.lists; plFillMove(); } return r;
}
function plName(id) { const x = PV.lists.find(l => l.id === id); return x ? x.name : id; }
function plFillMove() {                                     // Auswahlleiste der Gesamtliste: "In Liste uebernehmen"
  const sel = $('plmove'); if (!sel) return;
  sel.innerHTML = `<option value="">📋 ${esc(t('pl_move'))}</option>` + PV.lists.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('');
  sel.hidden = !PV.lists.length; sel.setAttribute('aria-label', t('pl_move'));
}
function plRefresh() {                               // Filter „Liste“ im Reiter Protokolle, dazu Werkzeuge und Notiz der gewählten Liste
  if (PV.cur && !PV.lists.some(l => l.id === PV.cur)) PV.cur = '';
  const sel = $('nplist'); sel.innerHTML = `<option value="">${esc(t('pl_all'))}</option>` + PV.lists.map(l => `<option value="${esc(l.id)}">📋 ${esc(l.name)} (${l.n})</option>`).join(''); sel.value = PV.cur;
  const has = !!PV.cur; $('plbody').hidden = !has; $('plren').hidden = $('pldel').hidden = !has; $('plrmsel').hidden = !has;
  $('pladd').title = t('pl_new'); $('plren').title = t('pl_rename'); $('pldel').title = t('pl_delete');
  if (!has) return;
  const L = PV.lists.find(l => l.id === PV.cur);
  const ta = $('plnote'); if (document.activeElement !== ta) { ta.value = L.note || ''; ta.dataset.old = L.note || ''; }
  const rules = SOURCES.flatMap(s => (s.plists || []).filter(r => r.id === PV.cur).map(r => s.name + (r.from || r.to ? ` ${r.from || '00:00'}–${r.to || '24:00'}` : ` (${t('pl_always')})`)));
  $('plinfo').textContent = rules.length ? t('pl_auto', { r: rules.join(' · ') }) : t('pl_auto_none');
}
function plFormOpen(kind) {
  PV.form = kind; $('plform').hidden = false; const i = $('plname');
  i.value = kind === 'ren' ? plName(PV.cur) : ''; i.focus(); i.select();
}
async function plFormOk() {
  const v = $('plname').value.trim(); if (!v) return;
  try {
    if (PV.form === 'add') { const r = await plPost('plist_add', { name: v }); PV.cur = r.id; try { localStorage.setItem('laerm_plist', PV.cur); } catch (e) { } }
    else await plPost('plist_edit', { id: PV.cur, name: v });
    $('plform').hidden = true; plRefresh(); loadNight();
  } catch (e) { alert(t('saveerr')); }
}
async function plNoteSave() {
  const ta = $('plnote'); if (!PV.cur || ta.value.trim() === (ta.dataset.old || '').trim()) return;
  $('plstat').textContent = t('en_saving');
  try { await plPost('plist_edit', { id: PV.cur, note: ta.value }); ta.dataset.old = ta.value; $('plstat').textContent = t('en_saved'); } catch (e) { $('plstat').textContent = t('saveerr'); }
}
/* Ereignisfenster: in welchen Listen steht das Ereignis, von Hand hinzufuegen */
function renderEvLists(ids) {
  const box = $('evlists'); EVV.plists = ids || [];
  if (!PV.lists.length) { box.innerHTML = ''; return; }
  const rest = PV.lists.filter(l => !EVV.plists.includes(l.id));
  box.innerHTML = `<small>${esc(t('pl_in'))}</small>` + EVV.plists.map(id => `<span class="art lbl plchip">📋 ${esc(plName(id))}<button type="button" class="plx" data-id="${esc(id)}" title="${esc(t('pl_remove'))}" aria-label="${esc(t('pl_remove'))}">✕</button></span>`).join('') +
    (rest.length ? `<select class="pladd" aria-label="${esc(t('pl_move'))}"><option value="">＋ ${esc(t('pl_move'))}</option>${rest.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}</select>` : '');
  box.querySelectorAll('.plx').forEach(b => b.onclick = async () => { try { await plPost('plist_mem', { id: b.dataset.id, keys: [EVV.k], add: false }); renderEvLists(EVV.plists.filter(x => x !== b.dataset.id)); } catch (e) { alert(t('saveerr')); } });
  const sel = box.querySelector('.pladd'); if (sel) sel.onchange = async () => { const id = sel.value; if (!id) return; try { await plPost('plist_mem', { id, keys: [EVV.k], add: true }); renderEvLists(EVV.plists.concat(id)); } catch (e) { alert(t('saveerr')); } };
}

/* Was kam in einer Stoerung vor: "✊ Klopfen ×10 · 🍽 Geschirr ×3 · 🎵 Musik 12 s" */
function kindsHTML(list, fine) {
  if (!list || !list.length) return '';
  const dur = s => s >= 60 ? Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0') + ' min' : (s < 10 ? s.toFixed(1) : Math.round(s)) + ' s';
  return list.map(([k, n, d]) => { const f = (fine || {})[k] || {}; return `<span class="kd" title="${esc((f.name || k) + (n != null ? ' · ' + dur(d) : ''))}">${f.icon || '•'} ${esc(f.name || k)} <b>${n != null ? '×' + n : dur(d)}</b></span>`; }).join('');
}
function fineName(k) { const f = EVV.fine[k]; return f ? f.name : k; }
function fineIcon(k) { const f = EVV.fine[k]; return f ? f.icon : '•'; }
// Text in einer Pille; liefert die Breite
function pill(c, txt, x, y, bg, fg, d, dashed) {
  c.font = '600 ' + (10.5 * d) + 'px system-ui'; const w = c.measureText(txt).width + 10 * d, h = 15 * d;
  c.fillStyle = bg; c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, 7 * d) : c.rect(x, y, w, h); c.fill();
  if (dashed) { c.setLineDash([3 * d, 2 * d]); c.strokeStyle = fg; c.lineWidth = 1 * d; c.stroke(); c.setLineDash([]); }
  c.fillStyle = fg; c.textAlign = 'left'; c.fillText(txt, x + 5 * d, y + 11 * d);
  return w;
}
function evDraw() {
  const g = EVV.g, R = EVV.d; if (!g || !R || !R.length || !$('evdlg').open) return;
  const NBe = R.nb || NB, stp = R.step || 100;
  const total = Math.max(500, (g.clip_s || 0) * 1000, R[R.length - 1].o);
  // Pegel
  const cv = $('evcv'); fit(cv);
  const d = DPR(), c = cv.getContext('2d'), w = cv.width, h = cv.height, L = 52 * d, Rr = 14 * d, T = 10 * d, B = 22 * d, pw = w - L - Rr, ph = h - T - B;
  const X = o => L + pw * o / total;
  let mn = 1e9, mx = -1e9; for (const r of R) { for (const v of [LAY.lvl ? r.l : null, LAY.bg ? r.b : null, LAY.thr ? r.t : null]) if (v != null && v > -125) { mn = Math.min(mn, v); mx = Math.max(mx, v); } accLayers(v => { if (v != null && v > -125) { mn = Math.min(mn, v); mx = Math.max(mx, v); } }, r, g.bands); }
  if (mn > mx) { mn = -90; mx = -30; }
  const pad = Math.max(1, (mx - mn) * 0.08); let lo = mn - pad, hi = mx + pad; if (hi - lo < 6) { const m = (hi + lo) / 2; lo = m - 3; hi = m + 3; }
  const Y = v => T + ph * (1 - clamp((v - lo) / (hi - lo), 0, 1));
  c.clearRect(0, 0, w, h); c.font = (11 * d) + 'px system-ui'; c.textAlign = 'right'; c.lineWidth = 1;
  // Raster, dB-Achse, Zeitachse (Sekunden ab Beginn der Spur), Pegel, Hintergrund, Schwelle: uPlot
  const up = upGet(cv, { kind: 'lvl', L: 52, R: 14, T: 10, B: 22, pal: livePal, rel: true });
  up.u.setSeries(1, { show: !!LAY.lvl }); up.u.setSeries(2, { show: !!LAY.bg }); up.u.setSeries(3, { show: !!LAY.thr });
  upDraw(up, (R._uid || (R._uid = ++UPID)) + '', () => { const Xs = [], P = [], Bg = [], Th = []; for (const r of R) { Xs.push(r.o - stp / 2); P.push(r.l != null && r.l > -125 ? r.l : null); Bg.push(r.b != null ? r.b : null); Th.push(r.t != null ? r.t : null); } return [Xs, P, Bg, Th]; }, 0, total, lo, hi);
  c.save(); c.beginPath(); c.rect(L, T, pw, ph); c.clip();
  // Ereignis (rot) und Nachlauf; a=2 ueber der Schwelle, a=1 Nachlauf (heller); aeltere Ereignisse kennen nur a=1
  const hasCore = R.some(r => r.a === 2);
  const spans = (test, fill, bar, bh) => { let s0 = -1; for (let i = 0; i <= R.length; i++) { const on = i < R.length && test(R[i].a); if (on && s0 < 0) s0 = i; if (!on && s0 >= 0) { const a0 = X(R[s0].o - stp), a1 = X(R[i - 1].o); c.fillStyle = fill; c.fillRect(a0, T, a1 - a0, ph); c.fillStyle = bar; c.fillRect(a0, T, a1 - a0, bh * d); s0 = -1; } } };
  if (hasCore) spans(a => a === 1, C.red + '0c', C.red + '55', 2);
  if (hasCore) {                                      // Vorlauf hellrot wie der Nachlauf
    const c0 = g.core && g.core[0] != null ? g.core[0] : (R[0].o - stp), first = R.find(r => r.a === 2);
    if (first && first.o - stp > c0) { const a0 = X(c0), a1 = X(first.o - stp); c.fillStyle = C.red + '0c'; c.fillRect(a0, T, a1 - a0, ph); c.fillStyle = C.red + '55'; c.fillRect(a0, T, a1 - a0, 2 * d); }
  }
  spans(a => hasCore ? a === 2 : !!a, C.red + '26', C.red, 3);
  // Benannte Bereiche (von Hand) und Vorschlaege
  for (const x of EVV.labels.l || []) { const col = lbCol(x.name), a0 = X(x.a), a1 = X(x.b); c.fillStyle = col.replace(')', ' / .16)'); c.fillRect(a0, T, a1 - a0, ph); c.fillStyle = col; c.fillRect(a0, T + ph - 3 * d, a1 - a0, 3 * d); }
  const core = g.core && g.core.length > 1 && g.core[0] != null ? g.core : null, outside = x => core && (x[1] < core[0] || x[0] > core[1]);   // Vorschläge außerhalb der Störung zurücknehmen
  for (const x of EVV.sugg || []) { const col = lbCol(x[2]), a0 = X(x[0]), a1 = X(x[1]); c.globalAlpha = outside(x) ? 0.3 : 1; c.strokeStyle = col; c.lineWidth = 1.5 * d; c.setLineDash([5 * d, 4 * d]); c.strokeRect(a0, T + 1 * d, a1 - a0, ph - 2 * d); c.setLineDash([]); }
  c.globalAlpha = 1;
  if (core) { c.strokeStyle = C.red; c.lineWidth = 1.5 * d; c.beginPath(); for (const o of [core[0], core[1]]) { const x = X(o); c.moveTo(x, T); c.lineTo(x, T + ph); } c.stroke(); }   // Beginn und Ende der Störung
  if (EVV.sel) { const a0 = X(Math.min(EVV.sel.a, EVV.sel.b)), a1 = X(Math.max(EVV.sel.a, EVV.sel.b)); c.fillStyle = C.acc + '33'; c.fillRect(a0, T, a1 - a0, ph); c.strokeStyle = C.acc; c.lineWidth = 1.5 * d; c.strokeRect(a0, T, a1 - a0, ph); }
  const line = (key, col, wd, dash) => { c.beginPath(); let on = false; for (const r of R) { const v = r[key]; if (v == null) { on = false; continue; } const x = X(r.o - stp / 2), y = Y(v); if (!on) { c.moveTo(x, y); on = true; } else c.lineTo(x, y); } c.setLineDash(dash.map(q => q * d)); c.strokeStyle = col; c.lineWidth = wd * d; c.stroke(); c.setLineDash([]); };
  // Pegel, Hintergrund und Schwelle zeichnet uPlot
  drawLayers(c, R.map(r => ({ x: X(r.o - stp / 2), r, brk: false })), Y, g.bands, d, L, pw, T, ph);
  drawRefs(c, g.refs || [], v => [Y(v)], lo, hi, L, pw, T, ph, d);
  // KI-Marker: Leiste unten in der Grafik (Symbol und Name, wenn Platz ist)
  EVV.hit = [];
  for (const m of EVV.marks) {                        // Farbe wie die Geraeuschart-Gruppe, Text nur wenn er hineinpasst
    const a0 = X(m[0]), a1 = Math.max(X(m[1]), X(m[0]) + 3 * d), y = T + ph - 19 * d, txt = fineIcon(m[2]) + ' ' + fineName(m[2]) + ' ' + m[3] + ' %';
    const col = ART_HEX[(EVV.fine[m[2]] || {}).group] || ART_HEX.other;
    c.save(); c.globalAlpha = .22; c.fillStyle = col; c.fillRect(a0, y, a1 - a0, 16 * d); c.globalAlpha = 1; c.fillStyle = col; c.fillRect(a0, y + 14 * d, a1 - a0, 2 * d); c.restore();
    c.font = '600 ' + (10 * d) + 'px system-ui'; c.textAlign = 'left';
    const short = fineIcon(m[2]), lab = c.measureText(txt).width + 6 * d <= a1 - a0 ? txt : c.measureText(short).width + 4 * d <= a1 - a0 ? short : '';
    if (lab) { c.fillStyle = C.tx; c.fillText(lab, a0 + 3 * d, y + 11.5 * d); }
    EVV.hit.push({ x0: a0 / d, x1: a1 / d, y0: y / d, y1: (y + 16 * d) / d, tip: fineName(m[2]) + ' ' + m[3] + ' %' });
  }
  // Notizen: Linie + Faehnchen mit Nummer
  (EVV.notes || []).forEach((n, i) => {
    const x = X(n.off * 1000), col = noteCol(n), hl = EVV.ntHi === n.id;
    c.strokeStyle = col; c.lineWidth = (hl ? 2.5 : 1.5) * d; c.setLineDash([4 * d, 3 * d]); c.beginPath(); c.moveTo(x, T + 16 * d); c.lineTo(x, T + ph); c.stroke(); c.setLineDash([]);
    c.fillStyle = col; c.beginPath(); c.arc(x, T + 9 * d, 8 * d, 0, 2 * Math.PI); c.fill();
    c.fillStyle = '#fff'; c.font = '700 ' + (10 * d) + 'px system-ui'; c.textAlign = 'center'; c.fillText(String(i + 1), x, T + 12.5 * d);
  });
  // Beschriftung der Bereiche (oben, unter den Notiz-Faehnchen); ueberlappende Beschriftungen weichen in die naechste Zeile aus
  const lanes = [], lane = (x0, wdt) => { let i = 0; while (lanes[i] != null && lanes[i] > x0 - 4 * d) i++; lanes[i] = x0 + wdt; return T + 20 * d + i * 18 * d; };
  c.font = '600 ' + (10.5 * d) + 'px system-ui';
  for (const x of (EVV.labels.l || []).slice().sort((u, v) => u.a - v.a)) { const txt = '🏷 ' + x.name, x0 = X(x.a) + 2 * d; pill(c, txt, x0, lane(x0, c.measureText(txt).width + 10 * d), lbCol(x.name), '#fff', d); }
  for (const x of (EVV.sugg || []).slice().sort((u, v) => u[0] - v[0])) {
    const txt = x[2] + '? ' + x[3] + ' %', x0 = X(x[0]) + 2 * d; c.font = '600 ' + (10.5 * d) + 'px system-ui';
    c.globalAlpha = outside(x) ? 0.35 : 1;
    const y0 = lane(x0, c.measureText(txt).width + 10 * d), wdt = pill(c, txt, x0, y0, C.card, lbCol(x[2]), d, true); c.globalAlpha = 1;
    EVV.hit.push({ x0: x0 / d, x1: (x0 + wdt) / d, y0: y0 / d, y1: (y0 + 15 * d) / d, sugg: x });
  }
  if (NTE && !NTE.id) { const x = X((EVV.ntPrev != null ? EVV.ntPrev : NTE.off) * 1000); c.strokeStyle = C.acc; c.lineWidth = 2 * d; c.setLineDash([2 * d, 3 * d]); c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke(); c.setLineDash([]); }
  // Ablauf-Linie
  if (EVV.a && (EVV.a.currentTime > 0 || !EVV.a.paused)) { const x = X(EVV.a.currentTime * 1000); c.strokeStyle = '#2b8a3e'; c.lineWidth = 2.5 * d; c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke(); }
  c.restore();
  c.textAlign = 'right'; c.font = '600 ' + (11 * d) + 'px system-ui';
  if (g.thr != null && LAY.thr) {
    const out = g.thr > hi || g.thr < lo;
    if (out) thrEdge(c, R.map(r => [X(r.o - stp / 2), r.t != null ? r.t : g.thr]), lo, hi, L, T, pw, ph, d, C.thr, 2);
    lblBox(c, out ? thrTxt(g.thr, lo, hi) : t('threshold') + ' ' + g.thr.toFixed(1), L + pw - 4 * d, g.thr > hi ? T + 16 * d : g.thr < lo ? T + ph - 6 * d : Y(g.thr) - 5 * d, C.thr, d);
  }
  // Spektrum
  const sv = $('evsp'); fit(sv);
  const s = sv.getContext('2d'), sw = sv.width, sh = sv.height, sT = 2 * d, sB = 4 * d, sph = sh - sT - sB;
  s.clearRect(0, 0, sw, sh); s.fillStyle = C.grid; s.fillRect(L, sT, pw, sph);   // Bereich ohne Daten neutral (wie die leere Pegelgrafik), nicht schwarz
  if (!EVV.spc || EVV.spc.R !== R) {                  // Spektrogramm-Bild nur einmal pro Ereignis berechnen
    const hist = new Uint32Array(256); let n = 0; for (const r of R) for (let k = 0; k < NBe; k++) { hist[r.sp[k]]++; n++; }
    const pct = q => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= q * n) return v; } return 255; };
    const lo2 = pct(0.05), hi2 = Math.max(pct(0.997), lo2 + 40);
    const tc = document.createElement('canvas'); tc.width = R.length; tc.height = NBe;
    const img = tc.getContext('2d').createImageData(R.length, NBe), px = img.data;
    R.forEach((r, x) => { for (let k = 0; k < NBe; k++) { const cc = cmap((r.sp[k] - lo2) / (hi2 - lo2)), o = 4 * ((NBe - 1 - k) * R.length + x); px[o] = cc[0]; px[o + 1] = cc[1]; px[o + 2] = cc[2]; px[o + 3] = 255; } });
    tc.getContext('2d').putImageData(img, 0, 0); EVV.spc = { R, tc };
  }
  const tmp = EVV.spc.tc;
  s.imageSmoothingEnabled = true; s.drawImage(tmp, X(R[0].o - stp), sT, X(R[R.length - 1].o) - X(R[0].o - stp), sph);
  for (const x of EVV.labels.l || []) { const col = lbCol(x.name); s.strokeStyle = col; s.lineWidth = 2 * d; s.strokeRect(X(x.a), sT + 1 * d, X(x.b) - X(x.a), sph - 2 * d); }
  if (EVV.sel) { const a0 = X(Math.min(EVV.sel.a, EVV.sel.b)), a1 = X(Math.max(EVV.sel.a, EVV.sel.b)); s.fillStyle = '#ffffff33'; s.fillRect(a0, sT, a1 - a0, sph); s.strokeStyle = C.acc; s.lineWidth = 1.5 * d; s.strokeRect(a0, sT, a1 - a0, sph); }
  (EVV.notes || []).forEach(n => { const x = X(n.off * 1000); s.strokeStyle = noteCol(n); s.lineWidth = 1.5 * d; s.beginPath(); s.moveTo(x, sT); s.lineTo(x, sT + sph); s.stroke(); });
  if (EVV.a && (EVV.a.currentTime > 0 || !EVV.a.paused)) { const x = X(EVV.a.currentTime * 1000); s.strokeStyle = '#fff'; s.lineWidth = 2 * d; s.beginPath(); s.moveTo(x, sT); s.lineTo(x, sT + sph); s.stroke(); }
  EVV.geo = { L: L / d, pw: pw / d, total };
  drawCmp();
}
function evAt(e) { const r = e.currentTarget.getBoundingClientRect(), gg = EVV.geo; return gg ? clamp((e.clientX - r.left - gg.L) / gg.pw, 0, 1) * gg.total : 0; }
function evSeek(e) {
  if (EVV.lpDone) { EVV.lpDone = false; return; }      // langes Druecken hat eine Notiz angelegt
  if (EVV.dragDone) { EVV.dragDone = false; return; }  // Bereich wurde aufgezogen
  if (!EVV.a || !EVV.geo) return;
  if (e.currentTarget.id === 'evcv') {                 // Klick auf einen Vorschlag: bestaetigen oder ablehnen
    const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const h = EVV.hit.find(q => q.sugg && x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
    if (h) { suggPop(h.sugg, e.clientX, e.clientY); return; }
  }
  EVV.a.currentTime = evAt(e) / 1000; if (EVV.a.paused) EVV.a.play(); evDraw();
}
/* Bereich aufziehen (Maus oder Finger waagerecht ziehen) und benennen */
function lbBind() {
  for (const id of ['evcv', 'evsp']) {
    const cv = $(id); let st = null;
    cv.addEventListener('pointerdown', e => { if (e.button && e.button !== 0) return; st = { x: e.clientX, y: e.clientY, a: evAt(e), id: e.pointerId, on: false }; });
    cv.addEventListener('pointermove', e => {
      if (!st || e.pointerId !== st.id) return;
      if (!st.on && Math.abs(e.clientX - st.x) > 8 && Math.abs(e.clientX - st.x) > Math.abs(e.clientY - st.y)) { st.on = true; try { cv.setPointerCapture(e.pointerId); } catch (x) { } lbPopClose(); if (EVV.a && !EVV.a.paused) EVV.a.pause(); }
      if (st.on) { EVV.sel = { a: st.a, b: evAt(e) }; evDraw(); }
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;     // Hinweis beim Zeigen auf einen KI-Marker
      const h = !st.on && EVV.hit.find(q => q.tip && x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1); cv.title = h ? h.tip : '';
    });
    const end = e => {
      if (!st) return;
      if (st.on) { EVV.dragDone = true; const a = Math.min(EVV.sel.a, EVV.sel.b), b = Math.max(EVV.sel.a, EVV.sel.b); if (b - a >= 150) lbPopOpen({ a, b }, e.clientX, e.clientY); else { EVV.sel = null; evDraw(); } }
      st = null;
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', () => { st = null; EVV.sel = null; evDraw(); });
  }
  $('evlbl').onclick = () => { EVV.lbHint = !EVV.lbHint; $('evlbhint').hidden = !EVV.lbHint; };
}
const fmtRange = (a, b) => fmtOff(Math.round(a / 100) / 10) + '–' + fmtOff(Math.round(b / 100) / 10);
function lbPopClose() { const p = $('lbpop'); if (p) p.hidden = true; }
function popPlace(p, x, y) { const dr = $('evdlg').getBoundingClientRect(); p.hidden = false; const w = p.offsetWidth, h = p.offsetHeight; p.style.left = clamp(x - dr.left - w / 2, 8, dr.width - w - 8) + 'px'; p.style.top = clamp(y - dr.top + 12, 8, dr.height - h - 8) + 'px'; }
function lbPopOpen(sel, x, y, edit) {
  const p = $('lbpop'); EVV.sel = sel; EVV.lbEdit = edit || null;
  // Vorschlaege fuer den Namen: KI-Marker in diesem Bereich, dann eigene Namen, dann alle Arten
  const inR = EVV.marks.filter(m => Math.min(m[1], sel.b) - Math.max(m[0], sel.a) > 0).sort((u, v) => v[3] - u[3]).map(m => fineName(m[2]));
  const own = EVV.names.map(n => n.name), kiN = [...new Set(inR)].filter(n => !own.includes(n)).slice(0, 6);
  $('lbtitle').textContent = t(edit ? 'lb_edit_t' : 'lb_title', { r: fmtRange(sel.a, sel.b) });
  $('lbname').value = edit ? edit.name : '';
  $('lbquick').innerHTML = (own.length ? `<small class="lbqh">${esc(t('mk_have'))}</small>` + EVV.names.slice(0, 16).map(n => `<button type="button" class="chip ntchip" data-n="${esc(n.name)}">${n.pf ? '🧩 ' : '🏷 '}${esc(n.name)}</button>`).join('') : '')
    + (kiN.length ? `<small class="lbqh">${esc(t('mk_ki'))}</small>` + kiN.map(n => `<button type="button" class="chip ntchip" data-n="${esc(n)}">${esc(n)}</button>`).join('') : '');
  $('lbquick').querySelectorAll('button').forEach(b => b.onclick = () => { $('lbname').value = b.dataset.n; $('lbname').focus(); });
  $('lbdl').innerHTML = [...new Set([...EVV.names.map(n => n.name), ...Object.values(EVV.fine).map(f => f.name)])].map(n => `<option value="${esc(n)}">`).join('');
  popPlace(p, x, y); $('lbname').focus(); evDraw();
}
async function lbPost(action, data) {
  const r = await (await fetch('label_' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ k: EVV.k }, data)) })).json();
  if (!r.ok) throw new Error(r.error === 'bad label' ? t('lb_empty') : (r.error || 'error'));
  EVV.labels = r.labels; EVV.sugg = r.sugg || []; EVV.names = r.names || EVV.names; renderLabels(); evDraw(); EVSIG = ''; loadEvents();
  return r;
}
async function lbSave() {
  const name = $('lbname').value.trim(), sel = EVV.sel; if (!sel) return;
  if (!name) { $('lbname').focus(); return; }
  try { await lbPost(EVV.lbEdit ? 'edit' : 'add', { id: EVV.lbEdit && EVV.lbEdit.id, a: Math.round(sel.a), b: Math.round(sel.b), name }); EVV.sel = null; lbPopClose(); evDraw(); }
  catch (e) { alert(t('saveerr') + ' ' + e.message); }
}
function suggPop(x, cx, cy) {
  const p = $('sgpop');
  $('sgtitle').textContent = t('lb_sugg_q', { n: x[2], p: x[3], r: fmtRange(x[0], x[1]) });
  $('sgyes').onclick = async () => { p.hidden = true; try { await lbPost('add', { a: x[0], b: x[1], name: x[2] }); } catch (e) { alert(e.message); } };
  $('sgno').onclick = async () => { p.hidden = true; try { await lbPost('reject', { a: x[0], b: x[1], name: x[2] }); } catch (e) { alert(e.message); } };
  $('sgshow').onclick = () => { p.hidden = true; EVV.a.currentTime = Math.max(0, x[0] / 1000 - 1); EVV.a.play(); };
  popPlace(p, cx, cy);
}
/* Einzelereignisse innerhalb der Stoerung: jede Spitze bzw. jedes Geraeusch mit Uhrzeit, Art, Sicherheit, Spitze und Dauer */
function renderSubs(j) {
  const box = $('subbox'), L = (j.ki && j.ki.subs) || [];
  box.hidden = !j.ki;
  if (!j.ki) return;
  const t0 = j.graph && j.graph.t0, fine = j.fine || {};
  const clk = ms => { if (!t0) return fmtOffS(ms); const d = new Date(t0 + ms); return d.toLocaleTimeString(lang === 'en' ? 'en-GB' : 'de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + (lang === 'en' ? '.' : ',') + Math.floor(d.getMilliseconds() / 100); };
  $('subhead').textContent = t('sub_head', { n: L.length });
  $('sublist').innerHTML = L.length ? L.map(([ms, k, pct, pk, dur], i) => { const f = fine[k] || {};
    const sn = (EVV.snote || {})[String(ms)] || '';
    return `<div class="ntrow subrow" data-ms="${ms}" tabindex="0"><span class="ntnum subic">${f.icon || '•'}</span><span class="ntoff">${esc(clk(ms))}</span><span class="nttx"><b>${esc(f.name || k)}</b>${pct ? ` <small>${pct} %</small>` : ''}${sn ? `<span class="subnote">📝 ${esc(sn)}</span>` : ''}</span><span class="subpk">${pk != null ? esc(pk.toFixed(1)) + ' <small>dBFS</small>' : ''}</span><span class="subdur">${dur ? esc((dur / 1000).toFixed(1)) + ' s' : ''}</span><span class="ntact"><button type="button" class="subed" title="${esc(t(sn ? 'sn_edit' : 'sn_add'))}" aria-label="${esc(t(sn ? 'sn_edit' : 'sn_add'))}">✎</button></span></div>`; }).join('')
    : `<div class="ntnone">${esc(t('sub_none'))}</div>`;
  $('sublist').querySelectorAll('.subrow').forEach(r => {
    r.onclick = e => { if (e.target.closest('.subed,.subin')) return; if (!EVV.a) return; EVV.a.currentTime = Math.max(0, +r.dataset.ms / 1000 - 1); EVV.a.play(); };
    r.onkeydown = e => { if (e.key === 'Enter' && e.target === r) r.click(); };
    r.querySelector('.subed').onclick = () => subNoteEdit(r, j);
  });
}
/* Notiz zu einem Einzelereignis: direkt in der Zeile bearbeiten (Enter = speichern, Esc = abbrechen, leer = loeschen) */
function subNoteEdit(r, j) {
  if (r.querySelector('.subin')) return;
  const ms = r.dataset.ms, old = (EVV.snote || {})[ms] || '';
  const inp = el('input', { type: 'text', className: 'subin', maxLength: 500, value: old, placeholder: t('sn_ph') });
  r.querySelector('.nttx').appendChild(inp); inp.focus();
  const done = async save => {
    if (!inp.isConnected) return;
    if (save && inp.value.trim() !== old) {
      try { const x = await (await fetch('snote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: EVV.k, ms: +ms, text: inp.value }) })).json(); if (!x.ok) throw new Error(x.error); EVV.snote = x.snote; EVSIG = ''; loadEvents(); } catch (e) { alert(t('saveerr')); }
    }
    renderSubs(j);
  };
  inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); done(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } };
  inp.onblur = () => done(true);
}
/* Notiz zum Gesamtereignis: wird beim Verlassen des Feldes gespeichert */
function enoteShow(text) {
  const ta = $('enote'); ta.value = text; ta.dataset.old = text; $('enstat').textContent = '';
}
async function enoteSave() {
  const ta = $('enote'); if (ta.value.trim() === (ta.dataset.old || '').trim()) return;
  $('enstat').textContent = t('en_saving');
  try {
    const x = await (await fetch('enote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: EVV.k, text: ta.value }) })).json();
    if (!x.ok) throw new Error(x.error);
    ta.dataset.old = x.enote; $('enstat').textContent = t('en_saved'); EVSIG = ''; loadEvents();
  } catch (e) { $('enstat').textContent = t('saveerr'); }
}
function fmtOffS(ms) { const s = ms / 1000; return Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0'); }
function renderLabels() {
  const box = $('lblist'); if (!box) return;
  const L = (EVV.labels.l || []).slice().sort((a, b) => a.a - b.a), S = EVV.sugg || [];
  $('lbhead').textContent = t('lb_list', { n: L.length });
  box.innerHTML = (L.length || S.length ? '' : `<div class="ntnone">${esc(t('lb_none'))}</div>`) +
    L.map(x => `<div class="ntrow lbrow" data-id="${esc(x.id)}" tabindex="0"><span class="ntnum" style="background:${lbCol(x.name)}">🏷</span><span class="ntoff">${esc(fmtRange(x.a, x.b))}</span><span class="nttx"><b>${esc(x.name)}</b></span>
      <span class="ntact"><button type="button" class="lbsim" title="${esc(t('lb_similar'))}" aria-label="${esc(t('lb_similar'))}">🔎</button><button type="button" class="lbed" title="${esc(t('nt_edit'))}" aria-label="${esc(t('nt_edit'))}">✎</button><button type="button" class="lbdel" title="${esc(t('nt_del'))}" aria-label="${esc(t('nt_del'))}">🗑</button></span></div>`).join('') +
    S.map((x, i) => `<div class="ntrow lbrow sg" data-s="${i}" tabindex="0"><span class="ntnum sgn" style="border-color:${lbCol(x[2])};color:${lbCol(x[2])}">?</span><span class="ntoff">${esc(fmtRange(x[0], x[1]))}</span><span class="nttx">${esc(t('lb_sugg'))}: <b>${esc(x[2])}</b> <small>${x[3]} %</small></span>
      <span class="ntact"><button type="button" class="sgy" title="${esc(t('lb_yes'))}">✓</button><button type="button" class="sgn2" title="${esc(t('lb_no'))}">✕</button></span></div>`).join('');
  box.querySelectorAll('.lbrow:not(.sg)').forEach(row => {
    const x = L.find(q => q.id === row.dataset.id);
    row.onclick = e => { if (e.target.closest('button')) return; EVV.a && (EVV.a.currentTime = Math.max(0, x.a / 1000 - 1), EVV.a.play()); };
    row.querySelector('.lbed').onclick = e => { const b = e.currentTarget.getBoundingClientRect(); lbPopOpen({ a: x.a, b: x.b }, b.left, b.bottom, x); };
    row.querySelector('.lbdel').onclick = async () => { if (!confirm(t('lb_del_q', { n: x.name }))) return; try { await lbPost('del', { id: x.id }); } catch (e) { alert(e.message); } };
    row.querySelector('.lbsim').onclick = () => openSimilar(x.name);
  });
  box.querySelectorAll('.lbrow.sg').forEach(row => {
    const x = S[+row.dataset.s];
    row.onclick = e => { if (e.target.closest('button')) return; EVV.a && (EVV.a.currentTime = Math.max(0, x[0] / 1000 - 1), EVV.a.play()); };
    row.querySelector('.sgy').onclick = async () => { try { await lbPost('add', { a: x[0], b: x[1], name: x[2] }); } catch (e) { alert(e.message); } };
    row.querySelector('.sgn2').onclick = async () => { try { await lbPost('reject', { a: x[0], b: x[1], name: x[2] }); } catch (e) { alert(e.message); } };
  });
}
/* Aehnliche finden: alle Ereignisse nach einem gelernten Namen durchsuchen */
async function openSimilar(name) {
  const dl = $('simdlg'); $('simtitle').textContent = '🔎 ' + t('lb_sim_title', { n: name }); $('simlist').innerHTML = `<div class="ntnone">⏳ ${esc(t('lb_sim_run'))}</div>`; $('siminfo').textContent = '';
  if (!dl.open) dl.showModal();
  let j; try { j = await (await fetch('similar?name=' + encodeURIComponent(name), { cache: 'no-store' })).json(); } catch (e) { j = { ok: false, error: e.message }; }
  if (!j.ok) { $('simlist').innerHTML = `<div class="ntnone">${esc(j.error === 'no examples' ? t('lb_sim_noex') : t('art_err'))}</div>`; return; }
  $('siminfo').textContent = t('lb_sim_count', { n: j.n, m: j.searched }) + (j.cut ? ' · ' + t('lb_sim_cut') : '');
  $('simlist').innerHTML = j.hits.length ? j.hits.map((x, i) => `<div class="ntrow simrow" data-i="${i}" tabindex="0"><span class="ntnum" style="background:${lbCol(name)}">${x.own ? '🏷' : '▶'}</span><span class="ntoff" data-clk=" · ${esc(x.quelle)}">${esc(fmtWhen(x.start))}</span><span class="ntclk">${esc(x.quelle)}</span><span class="nttx">${esc(fmtRange(x.a, x.b))} · ${x.own ? esc(t('lb_own')) : x.pct + ' %'}</span><span></span></div>`).join('')
    : `<div class="ntnone">${esc(t('lb_sim_none'))}</div>`;
  $('simlist').querySelectorAll('.simrow').forEach(r => { const x = j.hits[+r.dataset.i]; r.onclick = () => { dl.close(); openEvent(x.k, Math.max(0, x.a / 1000)); }; r.onkeydown = e => { if (e.key === 'Enter') r.click(); }; });
}
/* ================= Alle Notizen (Uebersicht, CSV, Protokoll) ================= */
const NTA = { tags: new Set(), list: [] };
function ntaParams(extra) {
  const p = new URLSearchParams();
  if ($('ntafrom').value) p.set('from', $('ntafrom').value); if ($('ntato').value) p.set('to', $('ntato').value);
  if ($('ntasrc').value !== 'all') p.set('src', $('ntasrc').value);
  if (NTA.tags.size) p.set('tags', [...NTA.tags].join(',')); if ($('ntaq').value.trim()) p.set('q', $('ntaq').value.trim());
  for (const k in (extra || {})) if (extra[k]) p.set(k, extra[k]);
  return p.toString();
}
async function ntaLoad() {
  try { NTA.list = (await (await fetch('notes?' + ntaParams(), { cache: 'no-store' })).json()).notes || []; } catch (e) { NTA.list = []; }
  const L = NTA.list.slice().reverse();
  $('ntacount').textContent = t('nt_title', { n: L.length });
  $('ntalist').innerHTML = L.length ? L.map((n, i) => `<div class="ntrow nta" data-i="${i}" tabindex="0"><span class="ntnum" style="background:${noteCol(n)}">▶</span>
      <span class="ntoff" data-clk=" · ${esc(n.clock)}${n.rz ? ' 🌙' : ''}">${esc(fmtDay(n.date || n.start.slice(0, 10)))}</span><span class="ntclk">${esc(n.clock)}${n.rz ? ' 🌙' : ''}</span>
      <span class="nttx">${(n.tags || []).map(ntTag).join('')}${n.text ? `<span class="ntt">${esc(n.text)}</span>` : ''}${n.witness ? `<span class="ntw">👤 ${esc(n.witness)}</span>` : ''}${fbx(n)}<span class="ntw">${esc(n.quelle)}</span></span><span></span></div>`).join('')
    : `<div class="ntnone">${esc(t('nt_none_all'))}</div>`;
  $('ntalist').querySelectorAll('.ntrow').forEach(r => { const n = L[+r.dataset.i]; r.onclick = () => { $('ntadlg').close(); if (n.free) fnOpen(n); else openEvent(n.k, n.off); }; r.onkeydown = e => { if (e.key === 'Enter') r.click(); }; });
  ntaLinks();
}
function ntaLinks() {
  const pr = { name: $('ntaname').value.trim(), addr: $('ntaaddr').value.trim(), flat: $('ntaflat').value.trim(), all: $('ntaall').checked ? '1' : '', mfo: $('ntamfo').checked ? '1' : '' };
  try { localStorage.setItem('laerm_proto', JSON.stringify(pr)); } catch (e) { }
  $('ntacsv').href = 'notes.csv?' + ntaParams(); $('ntaproto').href = 'protokoll.html?' + ntaParams(pr);
  $('ntaraw').href = 'ereignisse.csv?' + ntaParams({ mfo: pr.mfo }); $('ntazip').href = 'protokoll.zip?' + ntaParams(pr);   // Rohdaten und Beweispaket (Protokoll, Zeitachse, Prüfsummen, Methode)
}
function openAllNotes() {
  const sel = $('ntasrc'), opts = [['all', t('all_sources')]].concat(SOURCES.map(x => [x.id, x.name]));
  sel.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  NT_AREAS.ntatags = () => { $('ntatags').innerHTML = ntList(NTA.tags, true).map(tg => ntChip(tg, NTA.tags.has(tg))).join(''); ntChipBind($('ntatags'), NTA.tags, () => ntaLoad()); };
  NT_AREAS.ntatags();
  try { const pr = JSON.parse(localStorage.getItem('laerm_proto') || '{}'); $('ntaname').value = pr.name || ''; $('ntaaddr').value = pr.addr || ''; $('ntaflat').value = pr.flat || ''; $('ntaall').checked = pr.all === '1'; $('ntamfo').checked = pr.mfo === '1'; } catch (e) { }
  $('ntadlg').showModal(); ntaLoad();
}
function ntaBind() {
  for (const id of ['ntafrom', 'ntato', 'ntasrc']) $(id).onchange = ntaLoad;
  let tq = 0; $('ntaq').oninput = () => { clearTimeout(tq); tq = setTimeout(ntaLoad, 300); };
  for (const id of ['ntaname', 'ntaaddr', 'ntaflat', 'ntaall', 'ntamfo']) $(id).addEventListener('input', ntaLinks), $(id).addEventListener('change', ntaLinks);
  $('ntax').onclick = () => $('ntadlg').close();
}
/* ================= Notizen zu Zeitpunkten im Clip ================= */
let NOTE_TAGS = { src: ['oben', 'unten', 'nebenan', 'treppenhaus', 'tuer_o', 'draussen', 'unklar'], kind: ['klopfen', 'schritte', 'musik', 'stimmen', 'tuer', 'moebel', 'bohren', 'hund'],
  lvl: ['leicht', 'deutlich', 'stark'], eff: ['aufgewacht', 'kind_geweckt', 'kein_schlaf', 'gestoert'], act: ['geklingelt', 'angesprochen', 'verwaltung', 'polizei'], misc: ['zeuge', 'serie'] };
const NT_GCOL = { src: '#0ca678', kind: '#e0314b', lvl: '#f08c00', eff: '#7048e8', act: '#1c7ed6', misc: '#868e96' };
function ntGroup(tag) { if (NTS.grp && NTS.grp[tag]) return NTS.grp[tag]; for (const g in NOTE_TAGS) if (NOTE_TAGS[g].includes(tag)) return g; return NTS.own[tag] != null || String(tag).startsWith('g:') ? 'own' : 'misc'; }
/* ===== Schnellwahl: eigene Tasten, ausgeblendete eingebaute, Reihenfolge nach Gebrauch, gelernte Vorschläge ===== */
const NTS = { own: {}, del: new Set(), hide: new Set(), use: {}, sug: [], ren: {}, grp: {}, order: [], mode: 'use', gcol: {}, req: new Set(), gall: [] };
function ntLabel(tg) { return NTS.own[tg] != null ? NTS.own[tg] : NTS.ren[tg] ? NTS.ren[tg] : String(tg).startsWith('g:') ? tg.slice(2) : t('nt_' + tg); }   // g: = eigene Taste aus GReport
function ntsApply(j) {
  if (!j || !j.ok) return;
  if (j.tags) NOTE_TAGS = j.tags;
  NTS.own = {}; NTS.del = new Set(); for (const o of j.own || []) { NTS.own[o.k] = o.l; if (o.del) NTS.del.add(o.k); }
  NTS.hide = new Set(j.hide || []); NTS.use = j.use || {}; NTS.sug = j.suggest || [];
  Object.assign(NTS, { ren: j.ren || {}, grp: j.grp || {}, order: j.order || [], mode: j.mode || 'use', gcol: j.gcol || {}, req: new Set(j.req || []), gall: j.gall || [], max: j.own_max || 40, gone: new Set(j.gone || []), ghelp: j.ghelp || {} });
  fcColApply();
}
async function ntsLoad() { try { ntsApply(await (await fetch('notetags', { cache: 'no-store' })).json()); } catch (e) { } ntsRedraw(); }
async function ntsPost(body) {
  const j = await (await fetch('notetags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  if (!j.ok) throw new Error(j.error === 'limit' ? t('qt_limit') : j.error === 'empty' ? t('qt_empty') : (j.error || 'error'));
  ntsApply(j); ntsRedraw(); return j;
}
const NT_AREAS = {};                                   // Element-ID -> Neu-Zeichnen (alle Schnellwahl-Felder bleiben gleich)
function ntsRedraw() { for (const id in NT_AREAS) { const e = $(id); if (e && e.isConnected) try { NT_AREAS[id](); } catch (x) { } } }
function ntList(sel, all) {                            // flache Liste: häufigste zuerst, ausgeblendete/gelöschte nur wenn gewählt (Filter: alle)
  const out = [], seen = new Set(), add = tg => { if (!seen.has(tg)) { seen.add(tg); out.push(tg); } };
  for (const g in NOTE_TAGS) for (const tg of NOTE_TAGS[g]) if (all || !NTS.hide.has(tg) || (sel && sel.has(tg))) add(tg);
  for (const k in NTS.own) if (all || !NTS.del.has(k) || (sel && sel.has(k))) add(k);
  const pos = new Map(out.map((x, i) => [x, i]));
  return out.sort((a, b) => ((NTS.use[b] || 0) - (NTS.use[a] || 0)) || (pos.get(a) - pos.get(b)));
}
function ntGrouped(sel) {                              // nach Gruppen (Clip-Notiz), innerhalb der Gruppe häufigste zuerst
  const L = ntList(sel), G = {}; for (const tg of L) (G[ntGroup(tg)] = G[ntGroup(tg)] || []).push(tg);
  const gs = [...Object.keys(NOTE_TAGS), 'own']; for (const g in G) if (!gs.includes(g)) gs.splice(gs.length - 1, 0, g);   // eigene Rubriken vor „Eigene“
  return gs.filter(g => G[g] && G[g].length).map(g => [g, G[g]]);
}
const ntChip = (tg, on, cls) => `<button type="button" class="${cls || 'chip ntchip'} g-${ntGroup(tg)}${on ? ' on' : ''}" data-t="${esc(tg)}" aria-pressed="${!!on}" title="${esc(t('qt_tip'))}">${NTS.own[tg] != null ? '★ ' : ''}${esc(ntLabel(tg))}</button>`;
const ntAddBtn = () => `<button type="button" class="chip ntadd" title="${esc(t('qt_add_tip'))}">＋ ${esc(t('qt_add'))}</button>`;
function ntSugHtml() {
  const w = NTS.sug[0]; if (!w) return '';
  return `<span class="ntsug" data-w="${esc(w.w)}" data-k="${esc(w.k)}">💡 ${esc(t('qt_sug', { w: w.w, n: w.n }))} <button type="button" class="chip ntsugy">＋</button><button type="button" class="chip ntsugn" title="${esc(t('qt_sug_no'))}">✕</button></span>`;
}
/* Lange drücken (Maus, Stift oder Finger, ~0,55 s ohne zu bewegen) oder Rechtsklick: onHold statt Klick */
function holdBind(b, onHold) {
  let tm = 0, x0 = 0, y0 = 0, fired = false;
  b.addEventListener('pointerdown', e => { if (e.button !== 0) return; fired = false; x0 = e.clientX; y0 = e.clientY; clearTimeout(tm);
    tm = setTimeout(() => { fired = true; try { navigator.vibrate && navigator.vibrate(15); } catch (x) { } onHold(); }, 550); });
  b.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 8) clearTimeout(tm); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => clearTimeout(tm));
  b.addEventListener('click', e => { if (fired) { fired = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  b.oncontextmenu = e => { e.preventDefault(); clearTimeout(tm); onHold(); };
}
function fclOpenAt(k) {
  if (!FCL.on) fclOpen();
  pwin().requestAnimationFrame(() => { const c = $('fnptags') && $('fnptags').querySelector(`.layk[data-k="${CSS.escape(k)}"]`); if (!c) return;
    c.classList.add('picked'); setTimeout(() => c.classList.remove('picked'), 2400); const n = c.querySelector('.lkn'); if (n) { n.focus(); c.scrollIntoView({ block: 'nearest' }); }
    fclSay(t('fc_lay_picked', { k: n ? n.textContent : k })); });
}
function ntChipBind(box, sel, onTog) {                     // Klick = wählen, Rechtsklick/lange drücken = verwalten, ＋ = eigene anlegen
  box.querySelectorAll('.ntchip').forEach(b => {
    b.onclick = () => { const tg = b.dataset.t; sel.has(tg) ? sel.delete(tg) : sel.add(tg); b.classList.toggle('on', sel.has(tg)); b.setAttribute('aria-pressed', sel.has(tg)); if (onTog) onTog(tg); };
    if (box.id === 'fnptags') holdBind(b, () => fclOpenAt(b.dataset.t));   // Notiz-Bereich: lange drücken = Layout anpassen mit dieser Taste
    else b.oncontextmenu = e => { e.preventDefault(); ntManage(box, b.dataset.t); };
  });
  const a = box.querySelector('.ntadd'); if (a) a.onclick = () => ntManage(box);
  const sg = box.querySelector('.ntsug');
  if (sg) {
    sg.querySelector('.ntsugy').onclick = async () => { try { const j = await ntsPost({ action: 'add', l: sg.dataset.w }); if (j.k) { sel.add(j.k); if (onTog) onTog(j.k); ntsRedraw(); } } catch (e) { alert(e.message); } };
    sg.querySelector('.ntsugn').onclick = () => ntsPost({ action: 'nope', w: sg.dataset.k }).catch(e => alert(e.message));
  }
}
function ntManage(box, focus) {                        // Verwalten direkt unter den Tasten (geht auch im abgedockten Fenster)
  const doc = box.ownerDocument; let m = doc.getElementById(box.id + '_qt');
  if (m && !focus) { m.remove(); return; }
  if (!m) { m = doc.createElement('div'); m.id = box.id + '_qt'; m.className = 'qtman'; m.style.cssText = 'border:1px solid #8884;border-radius:8px;padding:8px;margin:6px 0;display:flex;flex-direction:column;gap:6px'; box.after(m); }
  const draw = () => {
    const own = Object.keys(NTS.own).filter(k => !NTS.del.has(k)), built = []; for (const g in NOTE_TAGS) built.push(...NOTE_TAGS[g]);
    m.innerHTML = `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b style="flex:1">${esc(t('qt_title'))}</b><button type="button" class="chip qtx">✕</button></div>
      <div style="display:flex;gap:6px"><input type="text" class="qtnew" maxlength="30" placeholder="${esc(t('qt_new_ph'))}" style="flex:1;min-width:0"><button type="button" class="pri qtaddok">${esc(t('qt_create'))}</button></div>
      ${NTS.sug.length ? `<small>${esc(t('qt_sug_h'))}</small><div style="display:flex;gap:5px;flex-wrap:wrap">${NTS.sug.map(w => `<span class="chip qtsg" data-w="${esc(w.w)}" data-k="${esc(w.k)}">💡 ${esc(w.w)} (${w.n}×) <a href="#" class="qtsy">＋</a> <a href="#" class="qtsn">✕</a></span>`).join('')}</div>` : `<small>${esc(t('qt_learn_h'))}</small>`}
      ${own.length ? `<small>${esc(t('qt_own_h'))}</small>` + own.map(k => `<div class="qtrow" data-k="${esc(k)}" style="display:flex;gap:6px"><input type="text" maxlength="30" value="${esc(NTS.own[k])}" style="flex:1;min-width:0"><button type="button" class="chip qtren">${esc(t('qt_ren'))}</button><button type="button" class="chip qtdel">🗑</button></div>`).join('') : ''}
      <small>${esc(t('qt_built_h'))}</small><div style="display:flex;gap:5px;flex-wrap:wrap">${built.map(k => `<button type="button" class="chip qtb${NTS.hide.has(k) ? '' : ' on'}" data-k="${esc(k)}" style="${NTS.hide.has(k) ? 'opacity:.5;text-decoration:line-through' : ''}">${esc(ntLabel(k))}</button>`).join('')}</div>`;
    const go = p => ntsPost(p).then(draw).catch(e => alert(e.message));
    m.querySelector('.qtx').onclick = () => m.remove();
    const nw = m.querySelector('.qtnew'), addIt = () => { const v = nw.value.trim(); if (v) go({ action: 'add', l: v }); };
    m.querySelector('.qtaddok').onclick = addIt; nw.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addIt(); } };
    m.querySelectorAll('.qtsg').forEach(x => { x.querySelector('.qtsy').onclick = e => { e.preventDefault(); go({ action: 'add', l: x.dataset.w }); }; x.querySelector('.qtsn').onclick = e => { e.preventDefault(); go({ action: 'nope', w: x.dataset.k }); }; });
    m.querySelectorAll('.qtrow').forEach(r => {
      const k = r.dataset.k, inp = r.querySelector('input');
      r.querySelector('.qtren').onclick = () => go({ action: 'ren', k, l: inp.value });
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go({ action: 'ren', k, l: inp.value }); } };
      r.querySelector('.qtdel').onclick = () => { if (confirm(t('qt_del_q', { n: NTS.own[k] }))) go({ action: 'del', k }); };
    });
    m.querySelectorAll('.qtb').forEach(b => b.onclick = () => go({ action: 'hide', k: b.dataset.k, on: !NTS.hide.has(b.dataset.k) }));
    if (focus) { const r = m.querySelector(`.qtrow[data-k="${CSS.escape(focus)}"] input`), b = m.querySelector(`.qtb[data-k="${CSS.escape(focus)}"]`); (r || b || nw).focus(); if (r) r.select(); focus = null; }
    else nw.focus();
  };
  draw();
}
function noteCol(n) {                                  // Farbe nach wichtigstem Tag: Auswirkung > Art > Massnahme > Rest
  const tg = n.tags || []; for (const g of ['eff', 'kind', 'act', 'lvl', 'src', 'misc']) if (tg.some(x => ntGroup(x) === g)) return NT_GCOL[g];
  return C.acc;
}
const ntTag = tg => `<span class="ntag g-${ntGroup(tg)}">${esc(ntLabel(tg))}</span>`;
const fmtOff = o => { const m = Math.floor(o / 60), s2 = o - m * 60; return m + ':' + (s2 < 10 ? '0' : '') + s2.toFixed(1); };
function ntNow() {                                     // Position fuer eine neue Notiz: Ablauf-Linie, sonst Spitze
  if (EVV.a && EVV.a.currentTime > 0) return Math.round(EVV.a.currentTime * 10) / 10;
  const R = EVV.d || [], st2 = (R.step || 100) / 2; let best = null; for (const r of R) if (r.l != null && (!best || r.l > best.l)) best = r;
  return best ? Math.max(0, Math.round((best.o - st2) / 100) / 10) : 0;
}
function ntSyncBtn() { const b = $('evnote'); if (b) b.innerHTML = '📝 ' + esc(t('nt_add_at', { t: fmtOff(ntNow()) })); }
let NTE = null;                                        // offene Eingabe: { id|null, off, tags:Set }
function ntEditorOpen(off, note) {
  if (EVV.a && !EVV.a.paused) EVV.a.pause();
  NTE = { id: note ? note.id : null, off: note ? note.off : off, tags: new Set(note ? note.tags || [] : []) }; EVV.ntPrev = NTE.off;
  const box = $('nted'); box.hidden = false;
  $('ntoff').value = NTE.off.toFixed(1); $('nttext').value = note ? note.text || '' : ''; $('ntwit').value = note ? note.witness || '' : '';
  $('ntsave').textContent = t(note ? 'nt_update' : 'nt_save'); $('ntedtitle').textContent = t(note ? 'nt_edit_t' : 'nt_new');
  NT_AREAS.nttags = () => { if (!NTE) return; $('nttags').innerHTML = ntGrouped(NTE.tags).map(([g, L]) => `<div class="ntgrp g-${g}"><div class="ntgl">${esc(gCustom(g) ? gLabel(g) : t('ntg_' + g))}</div><div class="ntgc">${L.map(tg => ntChip(tg, NTE.tags.has(tg), 'ntchip')).join('')}</div></div>`).join('') + `<div class="ntgrp"><div class="ntgc">${ntSugHtml()}${ntAddBtn()}</div></div>`; ntChipBind($('nttags'), NTE.tags, () => ntWit()); };
  NT_AREAS.nttags();
  ntClock();
  ntWit(); EVV.ntHi = NTE.id; evDraw();
  box.scrollIntoView({ block: 'nearest' }); setTimeout(() => $('nttext').focus({ preventScroll: true }), 30);
}
function ntClock() {                                  // echte Uhrzeit zur eingestellten Stelle
  const g = EVV.g, off = parseFloat($('ntoff').value) || 0, el2 = $('ntclock');
  if (!g || !g.t0) { el2.textContent = ''; return; }
  const d = new Date(g.t0 + off * 1000);
  el2.textContent = '🕒 ' + d.toLocaleTimeString(lang === 'en' ? 'en-GB' : 'de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function ntWit() { $('ntwitl').hidden = !NTE || !NTE.tags.has('zeuge'); }
function ntEditorClose() { NTE = null; EVV.ntPrev = null; const b = $('nted'); if (b) b.hidden = true; EVV.ntHi = null; }
async function ntPost(action, body) {
  const r = await (await fetch('note_' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ k: EVV.k }, body)) })).json();
  if (!r.ok) throw new Error(r.error === 'empty' ? t('nt_empty') : r.error === 'limit' ? t('nt_limit') : (r.error || 'error'));
  EVV.notes = r.notes; renderNotes(); evDraw(); EVSIG = ''; loadEvents();
  return r;
}
/* Aus den Markierungen einen Satz bilden (nur wenn kein eigener Text da ist), z. B. „Deutliche Schritte im Treppenhaus“ */
const TS_DE = {
  kind: { klopfen: ['Klopfen', 'n'], schritte: ['Schritte', 'p'], musik: ['Musik/Bass', 'p'], stimmen: ['Stimmen', 'p'], tuer: ['Türgeräusch', 'n'], moebel: ['Möbelrücken', 'n'], bohren: ['Bohren', 'n'], hund: ['Hundegebell', 'n'] },
  lvl: { leicht: ['Leichtes', 'Leichte', 'leicht'], deutlich: ['Deutliches', 'Deutliche', 'deutlich'], stark: ['Starkes', 'Starke', 'stark'] },
  src: { oben: 'von oben', unten: 'von unten', nebenan: 'von nebenan', treppenhaus: 'im Treppenhaus', draussen: 'von draußen', unklar: 'Herkunft unklar' },
  rest: { aufgewacht: 'aufgewacht', kind_geweckt: 'Kind geweckt', kein_schlaf: 'kein Einschlafen', gestoert: 'gestört', geklingelt: 'geklingelt', angesprochen: 'Nachbarn angesprochen', verwaltung: 'Hausverwaltung informiert', polizei: 'Polizei/Ordnungsamt informiert', zeuge: 'Zeuge anwesend', serie: 'wiederholt' }, noise: 'Geräusche', and: ' und ' };
const TS_EN = {
  kind: { klopfen: ['knocking', 'n'], schritte: ['footsteps', 'p'], musik: ['music/bass', 'n'], stimmen: ['voices', 'p'], tuer: ['door noise', 'n'], moebel: ['moving furniture', 'n'], bohren: ['drilling', 'n'], hund: ['dog barking', 'n'] },
  lvl: { leicht: ['Slight', 'Slight', 'slight'], deutlich: ['Clear', 'Clear', 'clear'], stark: ['Strong', 'Strong', 'strong'] },
  src: { oben: 'from above', unten: 'from below', nebenan: 'from next door', treppenhaus: 'in the stairwell', draussen: 'from outside', unklar: 'origin unclear' },
  rest: { aufgewacht: 'woke up', kind_geweckt: 'child woken', kein_schlaf: 'could not sleep', gestoert: 'disturbed', geklingelt: 'rang the bell', angesprochen: 'talked to them', verwaltung: 'informed management', polizei: 'police/authority informed', zeuge: 'witness present', serie: 'repeated' }, noise: 'noise', and: ' and ' };
function tagSentence(tags) {
  const tg = [...(tags || [])]; if (!tg.length) return '';
  const D = lang === 'en' ? TS_EN : TS_DE, de = lang !== 'en';
  const kinds = tg.filter(x => D.kind[x]), lvl = tg.find(x => D.lvl[x]), src = tg.find(x => D.src[x]);
  const rest = tg.filter(x => D.rest[x] && !(x === 'serie' && false)).map(x => D.rest[x]).concat(tg.filter(x => NTS.own[x] != null).map(x => NTS.own[x]));
  let main = '';
  if (kinds.length === 1) { const [nm, g] = D.kind[kinds[0]]; main = lvl ? (de ? D.lvl[lvl][g === 'n' ? 0 : 1] + ' ' + nm : D.lvl[lvl][0] + ' ' + nm) : nm; }
  else if (kinds.length > 1) main = kinds.map(x => D.kind[x][0]).join(', ').replace(/, ([^,]*)$/, D.and + '$1') + (lvl ? ' (' + D.lvl[lvl][2] + ')' : '');
  else if (lvl) main = de ? D.lvl[lvl][1] + ' ' + D.noise : D.lvl[lvl][0] + ' ' + D.noise;
  else if (src && src !== 'unklar') main = D.noise;
  if (src) main = main ? main + ' ' + D.src[src] : D.src[src];
  const out = [main, ...rest].filter(Boolean).join(', ');
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : '';
}
const autoText = (text, tags) => (text || '').trim() ? text : tagSentence(tags);
async function ntSave() {
  if (!NTE) return;
  const off = clamp(parseFloat($('ntoff').value) || 0, 0, 3600);
  const body = { off, text: autoText($('nttext').value, NTE.tags), typed: !!$('nttext').value.trim(), tags: [...NTE.tags], witness: $('ntwit').value };
  try { await ntPost(NTE.id ? 'edit' : 'add', NTE.id ? Object.assign(body, { id: NTE.id }) : body); ntEditorClose(); evDraw(); ntsLoad(); }
  catch (e) { alert(e.message); }
}
let NT_UNDO = null;
async function ntDelete(n) {
  try { await ntPost('del', { id: n.id }); } catch (e) { alert(e.message); return; }
  clearTimeout(NT_UNDO && NT_UNDO.timer);
  NT_UNDO = { n, timer: setTimeout(() => { NT_UNDO = null; renderNotes(); }, 5000) }; renderNotes();
}
async function ntUndo() {
  if (!NT_UNDO) return; const n = NT_UNDO.n; clearTimeout(NT_UNDO.timer); NT_UNDO = null;
  try { await ntPost('add', { off: n.off, text: n.text, tags: n.tags, witness: n.witness }); } catch (e) { alert(e.message); }
}
function ntSeek(off) {                                 // Ablauf 1 s vor der Notiz beginnen (Zusammenhang sehen)
  if (!EVV.a) return;
  EVV.a.currentTime = Math.max(0, off - 1); EVV.a.play(); evDraw();
}
function renderNotes() {
  const box = $('ntlist'); if (!box) return;
  const ns = EVV.notes || [];
  $('nthead').textContent = t('nt_title', { n: ns.length });
  box.innerHTML = (ns.length ? ns.map((n, i) => `<div class="ntrow${EVV.ntHi === n.id ? ' hi' : ''}" data-id="${esc(n.id)}" tabindex="0">
      <span class="ntnum" style="background:${noteCol(n)}">${i + 1}</span>
      <span class="ntoff" data-clk="${n.clock ? ' · ' + esc(n.clock) + (n.approx ? '*' : '') + (n.rz ? ' 🌙' : '') : ''}">${fmtOff(n.off)}</span><span class="ntclk">${esc(n.clock || '')}${n.approx ? '*' : ''}${n.rz ? ' <span class="ntrz" title="' + esc(t('nt_rz_tip')) + '">🌙</span>' : ''}</span>
      <span class="nttx">${(n.tags || []).map(ntTag).join('')}${n.text ? `<span class="ntt">${esc(n.text)}</span>` : ''}${n.witness ? `<span class="ntw">👤 ${esc(n.witness)}</span>` : ''}${fbx(n)}</span>
      <span class="ntact"><button type="button" class="nted1" title="${esc(t('nt_edit'))}" aria-label="${esc(t('nt_edit'))}">✎</button><button type="button" class="ntdel1" title="${esc(t('nt_del'))}" aria-label="${esc(t('nt_del'))}">🗑</button></span></div>`).join('')
    : `<div class="ntnone">${esc(t('nt_none'))}</div>`) +
    (NT_UNDO ? `<div class="ntundo">${esc(t('nt_deleted'))} <button type="button" id="ntundo" class="chip">${esc(t('nt_undo'))}</button></div>` : '');
  box.querySelectorAll('.ntrow').forEach(row => {
    const n = ns.find(x => x.id === row.dataset.id);
    row.onclick = e => { if (e.target.closest('button')) return; ntSeek(n.off); };
    row.onkeydown = e => { if (e.key === 'Enter') ntSeek(n.off); };
    row.querySelector('.nted1').onclick = () => ntEditorOpen(n.off, n);
    row.querySelector('.ntdel1').onclick = () => ntDelete(n);
  });
  const u = $('ntundo'); if (u) u.onclick = ntUndo;
  ntSyncBtn();
}
function ntBind() {
  $('evnote').onclick = () => ntEditorOpen(ntNow());
  $('ntsave').onclick = ntSave; $('ntcancel').onclick = () => { ntEditorClose(); evDraw(); };
  const nudge = dv => { const v = Math.max(0, (parseFloat($('ntoff').value) || 0) + dv); $('ntoff').value = v.toFixed(1); if (NTE) { NTE.off = v; EVV.ntPrev = v; } ntClock(); evDraw(); };
  $('ntminus').onclick = () => nudge(-0.1); $('ntplus').onclick = () => nudge(0.1);
  $('ntoff').oninput = () => { if (NTE) EVV.ntPrev = parseFloat($('ntoff').value) || 0; ntClock(); evDraw(); };
  enterSave($('nttext'), ntSave);
  $('nttext').onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ntEditorClose(); evDraw(); } };
  $('evdlg').addEventListener('keydown', e => {          // Taste N: Notiz an der Abspiel-Linie
    if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.closest('input,textarea,select')) { e.preventDefault(); ntEditorOpen(ntNow()); }
  });
  // langes Druecken (Handy) bzw. Rechtsklick auf die Grafik: Notiz an dieser Stelle
  for (const id of ['evcv', 'evsp']) {
    const cv = $(id); let lp = null;
    const offAt = x => { const gg = EVV.geo; return gg ? Math.round(clamp((x - gg.L) / gg.pw, 0, 1) * gg.total / 100) / 10 : 0; };
    cv.addEventListener('pointerdown', e => {
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y0 = e.clientY;
      clearTimeout(lp && lp.t); lp = { x: e.clientX, y: y0, t: setTimeout(() => { EVV.lpDone = true; if (navigator.vibrate) navigator.vibrate(20); ntEditorOpen(offAt(x)); }, 550) };
    });
    cv.addEventListener('pointermove', e => { if (lp && (Math.abs(e.clientX - lp.x) > 8 || Math.abs(e.clientY - lp.y) > 8)) { clearTimeout(lp.t); lp = null; } });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) cv.addEventListener(ev, () => { if (lp) { clearTimeout(lp.t); lp = null; } });
    cv.addEventListener('contextmenu', e => { e.preventDefault(); if (lp) { clearTimeout(lp.t); lp = null; } const r = cv.getBoundingClientRect(); ntEditorOpen(offAt(e.clientX - r.left)); });
  }
  setInterval(() => { if ($('evdlg').open && !NTE) ntSyncBtn(); }, 250);
}
function closeRowMenu() { $('rowmenu').style.display = 'none'; if (EVMENU) { EVMENU = ''; if (TBL) TBL.redraw(x => x._t === 'ev'); } }
document.addEventListener('click', e => { if (!e.target.closest('#rowmenu')) closeRowMenu(); });
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; const k = $('rowmenu').style.display === 'block' && e.target.closest && e.target.closest('#rowmenu') ? EVMENU : ''; closeRowMenu();
  if (k && TBL && TBL.api) { const n = TBL.api.getRowNode(k); if (n && n.rowIndex != null) TBL.api.setFocusedCell(n.rowIndex, 'act'); } });   // Esc im Menü ⋮: Fokus zurück auf die Zeile
document.addEventListener('focusin', e => { if ($('rowmenu').style.display === 'block' && !e.target.closest('#rowmenu')) closeRowMenu(); });
let MENU_AT = 0;
window.addEventListener('scroll', () => { if (Date.now() - MENU_AT > 400) closeRowMenu(); }, true);   // nicht direkt nach dem Oeffnen (Fokus kann kurz scrollen)
/* ================= Quellen (Server-Mikrofon, Handys, Streams) ================= */
function srcState(s) {
  if (!s.enabled) return ['off', t('src_off')];
  if (s.pro_lock) return ['off', '🔒 ' + t('pro_src_lock')];
  if (s.error && !s.online) return ['err', s.error];
  if (s.disturbed) return ['err', t('phone_disturbed')];     // Verbindungen vom Handy wurden abgewiesen (zu viele / Handshake zu langsam)
  if (!s.online) return ['wait', s.type === 'phone' ? t('phone_wait') : t('src_wait')];
  if (s.silent) return ['wait', t('src_silent')];
  if (s.active) return ['ev', t('event')];
  return ['ok', t('src_ok')];
}
/* Live-Bild: nur wenn das gewaehlte Geraet Video sendet und das Live-Bild eingeschaltet ist */
const VID_SIZES = [240, 420, 680];
let VID = { src: null, timer: 0, rot: 0, size: (() => { try { return Math.min(2, +localStorage.getItem('laerm_vidsize') || 1); } catch (e) { return 1; } })() };
function vidLayout() {
  const img = $('vidimg'), fr = $('vidframe'), box = $('vidlive');
  const nw = img.naturalWidth, nh = img.naturalHeight; if (!nw || !nh) return;
  const side = VID.rot % 180 !== 0, ar = side ? nh / nw : nw / nh;      // Seitenverhaeltnis nach dem Drehen
  const full = !!document.fullscreenElement;
  const maxW = full ? innerWidth : box.clientWidth, maxH = full ? innerHeight : VID_SIZES[VID.size];
  let dw = Math.min(maxW, maxH * ar), dh = dw / ar;
  fr.style.width = dw + 'px'; fr.style.height = dh + 'px';
  img.style.width = (side ? dh : dw) + 'px'; img.style.height = (side ? dw : dh) + 'px';
  img.style.transform = `translate(-50%,-50%) rotate(${VID.rot}deg)`;
  $('vidsz').textContent = ['S', 'M', 'L'][VID.size];
}
function vidSize() { VID.size = (VID.size + 1) % 3; try { localStorage.setItem('laerm_vidsize', VID.size); } catch (e) { } vidLayout(); }
async function vidRotate() {
  const s = srcById(selSrc); if (!s) return;
  const rot = ((s.video_rot || 0) + 90) % 360; s.video_rot = rot; VID.rot = rot; vidLayout();
  try { await srcPost({ action: 'update', id: s.id, video_rot: rot }); } catch (e) { alert(t('saveerr') + ' ' + e.message); }
}
function vidFull() { const f = $('vidframe'); if (document.fullscreenElement) document.exitFullscreen(); else if (f.requestFullscreen) f.requestFullscreen().catch(() => { }); }
function syncVideo() {
  const s = srcById(selSrc), box = $('vidlive'), on = !!(s && s.video_show);
  box.hidden = !on;
  if (on) {
    $('vidcap').textContent = '🎥 ' + s.name + ' · ' + t('vid_live') + (s.video_fps ? ' · ' + s.video_fps + ' ' + t('vid_fps') : '') + ' · ' + (s.video_rec ? '⏺ ' + t('vid_rec_on') : t('vid_rec_off'));
    if (VID.rot !== (s.video_rot || 0)) { VID.rot = s.video_rot || 0; vidLayout(); }
  }
  if (on && !VID.timer) {
    const img = $('vidimg');
    const next = () => { VID.timer = 0; const cur = srcById(selSrc); if (!cur || !cur.video_show || document.hidden) { if (cur && cur.video_show) VID.timer = setTimeout(next, 1000); return; } img.src = 'video_live?src=' + encodeURIComponent(selSrc) + '&t=' + Date.now(); };
    img.onload = () => { vidLayout(); VID.timer = setTimeout(next, VID_SIZES[VID.size] > 300 ? 250 : 500); };
    img.onerror = () => { VID.timer = setTimeout(next, 2000); };
    VID.timer = -1; next();
  }
  if (!on && VID.timer) { clearTimeout(VID.timer); VID.timer = 0; $('vidimg').removeAttribute('src'); }
}
async function loadSources() {
  try {
    const j = await (await fetch('sources', { cache: 'no-store' })).json();
    SOURCES = j.sources || []; FORMER = (j.former || []).map(x => ({ id: x.id, name: x.name, former: true }));
    PHONE = { port: j.phone_port, ip: j.lan_ip, tls: j.tls, tls_error: j.tls_error, ffmpeg: j.ffmpeg };
    if (!SOURCES.some(s => s.id === selSrc)) selectSource('main');
    renderSrcBar(); evFollow(); syncVideo(); if ($('fnpsrc')) fnpSrc();
    if ($('dlg').open) refreshSourceRows();
  } catch (e) { }
}
function renderSrcBar() {
  const bar = $('srcbar');
  const html = SOURCES.map(s => {
    const [cls, tip] = srcState(s);
    const M = s.motion || {}, mo = (M.vib && M.vib.active ? '<b class="motact" title="' + esc(t('mot_vib')) + '">🫨</b>' : '') + (M.tilt && M.tilt.active ? '<b class="motact" title="' + esc(t('mot_tilt')) + '">📐</b>' : '') + (M.cam && M.cam.active ? '<b class="motact" title="' + esc(t('mot_cam')) + '">🏃</b>' : '');
    return `<button class="chip${s.id === selSrc ? ' sel' : ''}" data-id="${esc(s.id)}" title="${esc(tip)}"><i class="dot ${cls}"></i><span class="cn">${esc(s.name)}</span>${mo}<em>${s.count_today || 0}</em></button>`;
  }).join('');
  if (bar.dataset.h !== html) {
    bar.dataset.h = html; bar.innerHTML = html;
    bar.querySelectorAll('.chip').forEach(b => b.onclick = () => {      // von Hand gewaehlt: Rundlauf steht, Wechsel gleitet wie im Rundlauf
      TILE.manual = true; TILE.key = '';
      if (b.dataset.id === selSrc) { tileBar(); evFollow(); return; }
      if (liveDevs().length > 1) tileGo(b.dataset.id, true); else selectSource(b.dataset.id);
    });
  }
}
/* Zwischenspeicher je Geraet: beim Wechsel sofort die letzten Daten zeigen (kein leeres Bild), danach nur Neues nachladen */
const DCACHE = {};
const DC_MAX_AGE = 100000;
function cacheCur() { if (recs.length && lastSeq >= 0) DCACHE[selSrc] = { recs, lastSeq, firstAvail, st, bands, boot, t: Date.now() }; }
async function prefetchDev(id) {
  const c = DCACHE[id], fresh = c && Date.now() - c.t < DC_MAX_AGE && c.boot === boot;
  const r = await fetch((fresh ? 'data?since=' + c.lastSeq : 'data?limit=1200') + '&src=' + encodeURIComponent(id), { cache: 'no-store' });
  const j = await r.json(); if (j.src !== id || id === selSrc) return;
  let R = fresh ? c.recs.slice() : [], ls = fresh ? c.lastSeq : -1;
  for (const x of j.r.map(decode)) if (x.s > ls) { R.push(x); ls = x.s; }
  if (R.length > MAXR) R.splice(0, R.length - MAXR);
  DCACHE[id] = { recs: R, lastSeq: R.length ? ls : (j.last || -1), firstAvail: j.first, st: j.st, bands: (j.st && j.st.bands && j.st.bands.length) ? j.st.bands : bands, boot: j.boot, t: Date.now() };
}
function selectSource(id, auto) {
  if (id === selSrc) return;
  if (!auto) { TILE.manual = true; TILE.at = Date.now(); }   // von Hand gewaehlt: Rundlauf steht, bis neu geladen oder ▶ gedrueckt wird
  cacheCur();
  const c = DCACHE[id];
  selSrc = id;
  if (c && Date.now() - c.t < DC_MAX_AGE && c.boot === boot && c.recs.length) {
    recs = c.recs; lastSeq = c.lastSeq; firstAvail = c.firstAvail; st = c.st; if (c.bands && c.bands.length) bands = c.bands; recolorAll();
  } else { resetData(); st = null; }
  lastCount = -1; yv.auto = true; wg.auto = true; syncAutoBtn(); setLive(true); if (st) updateStatus();
  if (histOn()) dtLoad(LDT, true);                 // zurückgespult: Tagesverlauf des neuen Geräts
  renderSrcBar(); markDirty(); evFollow();
}
/* Ereignisliste und Statistik: folgen standardmaessig dem Geraet der Live-Ansicht (auch im Rundlauf) */
let EVSRC = (() => { try { return localStorage.getItem('laerm_evsrc') || 'live'; } catch (e) { return 'live'; } })();
function evSrc() { return NV.src || 'all'; }        // Ereignisliste: Gerät aus dem Filter des Reiters Protokolle
let EVLAST = null;
function evFollow() {                                  // nur neu laden, wenn sich die Auswahl der Liste wirklich aendert
  syncEvFilter();
  const want = evSrc(); if (want === EVLAST) return;
  EVLAST = want; EVSIG = ''; loadEvents();
}
function syncEvFilter() {
  const sel = $('evsrc'), cur = EVSRC; if (!sel) return;   // Gerät wählt jetzt der Filter im Reiter Protokolle
  const ls = srcById(selSrc);
  const opts = [['live', rotActive() ? t('ev_auto_all') : t('ev_follow', { n: ls ? ls.name : '' })], ['all', t('all_sources')]].concat(SOURCES.map(s => [s.id, s.name]));
  const key = JSON.stringify(opts);
  if (sel.dataset.k === key) return;
  sel.dataset.k = key; sel.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  sel.value = opts.some(o => o[0] === cur) ? cur : 'live'; EVSRC = sel.value;
  sel.parentElement.style.display = SOURCES.length > 1 ? '' : 'none';
}
async function srcPost(body) {
  const r = await (await fetch('sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  if (!r.ok) throw new Error(r.error || 'error');
  SOURCES = r.sources; renderSrcBar(); syncEvFilter();
  return r;
}
/* ================= Regeln (Home Assistant): eigener Reiter ================= */
const HAR = { rules: [], info: {}, ents: null, timer: 0, open: new Set(), wiz: null, cal: null };
const HA_MODES = [['raise', '📈'], ['quiet', '🔕'], ['pause', '⏸'], ['note', '📝'], ['event', '🚩']];
const haIcon = m => (HA_MODES.find(x => x[0] === m) || ['', '⏸'])[1];
const HA_STS = { media_player: ['on', 'playing', 'paused', 'idle', 'standby', 'buffering', 'off'], assist_satellite: ['listening', 'processing', 'responding', 'idle'],
  vacuum: ['cleaning', 'returning', 'paused', 'idle', 'docked'], device_tracker: ['home', 'not_home'], climate: ['heat', 'cool', 'auto', 'off'] };
const haStsFor = ent => { const d = (ent || '').split('.')[0]; return HA_STS[d] || (['sensor'].includes(d) ? [] : ['on', 'off']); };
function haDefaults(ent, mode) {
  const dom = (ent || '').split('.')[0];
  if (mode === 'raise') return { states: dom === 'media_player' ? 'on, playing' : 'on', after_min: 0.5, max_h: 12, raise_db: 10, vol_scale: dom === 'media_player' };
  if (dom === 'media_player') return { states: 'on, playing', after_min: 1, max_h: 8 };
  if (dom === 'assist_satellite') return { states: '!idle', after_min: 0.5, max_h: 1, mode: 'quiet', pre_s: 3 };   // Sprachassistent: Rufwort und Antwort nicht als Störung
  if (dom === 'sensor') return { states: '>1', after_min: 30, max_h: 2 };
  return { states: 'on', after_min: 1, max_h: 8 };
}
function haBox() {
  const fs = el('fieldset', { id: 'habox', className: 'ff' }); fs.dataset.sec = 's_ha';
  const lg = el('legend', { textContent: t('s_ha') }); const ti = tipIcon('t_ha'); if (ti) lg.appendChild(ti); fs.appendChild(lg);
  fs.appendChild(el('small', { className: 'schedhelp', textContent: t('h_ha') }));
  fs.appendChild(el('div', { id: 'hastat', className: 'hastat' }));
  fs.appendChild(el('div', { id: 'hawiz', className: 'hawiz', hidden: true }));
  fs.appendChild(el('div', { id: 'halist', className: 'halist' }));
  const add = el('button', { type: 'button', className: 'pri haadd', textContent: '＋ ' + t('ha_add') });
  add.onclick = () => haWizard();
  fs.appendChild(add);
  fs.appendChild(el('datalist', { id: 'haents' }));
  haLoad(); haLoadEnts();
  clearInterval(HAR.timer); HAR.timer = setInterval(() => { if (!$('dlg').open || !$('habox')) { clearInterval(HAR.timer); return; } if (!HAR.cal) haLoad(true); }, 5000);
  return fs;
}
/* Sensor-Bestätigung: an/aus, je Sensor Art, Fenster vor/nach, Sperrzeit, Rolle (gespeichert sofort, nur Anzeige) */
function scBox() {
  const fs = el('fieldset', { id: 'scbox', className: 'ff' }); fs.dataset.sec = 's_sc';
  fs.appendChild(el('legend', { textContent: t('s_sc') }));
  fs.appendChild(el('small', { className: 'schedhelp', textContent: t('h_sc') }));
  const body = el('div', { className: 'scset' }); fs.appendChild(body);
  const msg = el('small', { className: 'msg', role: 'status' }); msg.setAttribute('aria-live', 'polite'); fs.appendChild(msg);
  let D = null;
  const save = async (patch, focusSel) => {
    try { const r = await (await fetch('bestaetigung', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })).json(); if (!r.ok) throw 0; D = r; draw(focusSel); msg.textContent = '✓ ' + t('saved'); EVSIG = ''; }
    catch (e) { msg.textContent = t('saveerr'); }
  };
  const draw = focusSel => {
    if (!D) return;
    const opt = (vs, cur, lab) => vs.map(v => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(lab(v))}</option>`).join('');
    body.innerHTML = `<label class="check"><input type="checkbox" class="sc_on"${D.on ? ' checked' : ''}> ${esc(t('sc_on'))}</label>` +
      `<label class="check"><input type="checkbox" class="sc_lanes"${D.lanes !== false ? ' checked' : ''}> ${esc(t('sl_set'))}</label>` +
      `<label class="scck">${esc(t('ck_set'))} <input type="number" class="sc_ck" min="1" max="600" step="1" inputmode="numeric" value="${esc(String(D.clock_warn || 5))}"> s</label>${clockHTML(D.clock)}` +
      (D.sensors.length ? `<div class="sctw"><table class="sctab scedit"><caption class="sr">${esc(t('s_sc'))}</caption><thead><tr><th scope="col">${esc(t('sc_t_sens'))}</th><th scope="col">${esc(t('sc_e_type'))}</th><th scope="col">${esc(t('sc_e_role'))}</th><th scope="col">${esc(t('sc_e_pre'))}</th><th scope="col">${esc(t('sc_e_post'))}</th><th scope="col">${esc(t('sc_e_lock'))}</th><th scope="col">${esc(t('sc_e_rate'))}</th><th scope="col"><span class="sr">${esc(t('sc_cal'))}</span></th></tr></thead><tbody>` +
        D.sensors.map(x => `<tr data-id="${esc(x.id)}"${x.off ? ' class="off"' : ''}><th scope="row"><label class="check"><input type="checkbox" class="sc_use"${x.off ? '' : ' checked'} aria-label="${esc(t('sc_e_use', { s: x.name }))}"> ${esc(x.name)}</label></th>
          <td><select class="sc_type" aria-label="${esc(t('sc_e_type') + ': ' + x.name)}">${opt(D.types, x.type, v => t('sc_ty_' + v))}</select></td>
          <td><select class="sc_role" aria-label="${esc(t('sc_e_role') + ': ' + x.name)}">${opt(D.roles, x.role, v => t('sc_role_' + v))}</select></td>
          ${['pre', 'post', 'lock'].map(k => `<td><input type="number" class="sc_${k}" min="0" max="${k === 'lock' ? 3600 : 600}" step="1" inputmode="numeric" value="${x[k]}" aria-label="${esc(t('sc_e_' + k) + ': ' + x.name)}"></td>`).join('')}
          <td>${x.rate != null ? esc(t('sc_rate', { r: numTxt(String(x.rate)), d: numTxt(String(x.days)) })) : '–'}${x.rate_d != null ? `<small>${esc(t('sc_rate_dn', { d: numTxt(String(x.rate_d)), n: numTxt(String(x.rate_n)) }))}</small>` : ''}</td>
          <td><button type="button" class="chip sc_cal" aria-label="${esc(t('sc_cal') + ': ' + x.name)}">📊 ${esc(t('sc_cal'))}</button></td></tr>`).join('') + '</tbody></table></div>'
        : `<p class="hint">${esc(t('sc_none'))}</p>`);
    body.querySelector('.sc_on').onchange = e => save({ on: e.target.checked }, '.sc_on');
    body.querySelector('.sc_lanes').onchange = e => { save({ lanes: e.target.checked }, '.sc_lanes'); for (const c of Object.values(SL.c)) c.at = 0; };
    body.querySelector('.sc_ck').onchange = e => save({ clock_warn: +e.target.value }, '.sc_ck');
    body.querySelectorAll('tr[data-id]').forEach(tr => {
      const id = tr.dataset.id, x = D.sensors.find(y => y.id === id), q = c => tr.querySelector('.' + c);
      const cur = () => ({ type: q('sc_type').value, role: q('sc_role').value, pre: +q('sc_pre').value, post: +q('sc_post').value, lock: +q('sc_lock').value, off: !q('sc_use').checked });
      const sel = c => `tr[data-id="${CSS.escape(id)}"] .${c}`;
      q('sc_type').onchange = () => { const df = D.def[q('sc_type').value] || {}; save({ sens: { [id]: Object.assign(cur(), { pre: df.pre, post: df.post, lock: df.lock, role: df.role }) } }, sel('sc_type')); };   // neue Art: deren Voreinstellung
      for (const c of ['sc_role', 'sc_use']) q(c).onchange = () => save({ sens: { [id]: cur() } }, sel(c));
      for (const c of ['sc_pre', 'sc_post', 'sc_lock']) q(c).onchange = () => save({ sens: { [id]: cur() } }, sel(c));
      q('sc_cal').onclick = () => scCalib(id, x.name, w => save({ sens: { [id]: Object.assign(cur(), { pre: w[0], post: w[1] }) } }, sel('sc_pre')), q('sc_cal'));
    });
    if (focusSel) { const f = body.querySelector(focusSel); if (f) f.focus(); }
  };
  fetch('bestaetigung', { cache: 'no-store' }).then(r => r.json()).then(j => { D = j; draw(); }).catch(() => { body.textContent = t('saveerr'); });
  return fs;
}
/* Kalibrieren (1.84.1): Δt-Verteilung (nächste Auslösung zum Störungsbeginn) und Verschiebe-Test – nur Anzeige; Fenster nur auf Knopfdruck übernehmen */
async function scCalib(id, name, apply, back) {
  let d = $('scaldlg'); if (!d) { d = el('dialog', { id: 'scaldlg', className: 'evdlg prognd scaldlg' }); d.setAttribute('aria-labelledby', 'scalh'); document.body.appendChild(d); d.addEventListener('close', () => { if (d._back) d._back.focus(); }); }
  d._back = back;
  d.innerHTML = `<div class="dh"><h3 id="scalh">📊 ${esc(t('sc_cal_t', { s: name }))}</h3><button type="button" class="scalx" aria-label="${esc(t('a_close'))}">✕</button></div><div class="dbody"><p class="mut">${esc(t('loading'))}</p></div>`;
  d.querySelector('.scalx').onclick = () => d.close(); d.showModal();
  let j; try { j = await (await fetch('bc_calib?id=' + encodeURIComponent(id), { cache: 'no-store' })).json(); } catch (e) { j = { ok: false }; }
  const bd = d.querySelector('.dbody');
  if (!j.ok) { bd.innerHTML = `<p>${esc(t('saveerr'))}</p>`; return; }
  const mx = Math.max(1, ...j.hist), W = 100 / j.hist.length, tot = j.hist.reduce((a, b) => a + b, 0);
  const bars = j.hist.map((v, i) => { const b0 = j.bins[i], inw = b0 + j.bin_s > -j.pre && b0 < j.post; return `<rect x="${(i * W + W * 0.1).toFixed(2)}" y="${(40 - 38 * v / mx).toFixed(2)}" width="${(W * 0.8).toFixed(2)}" height="${(38 * v / mx).toFixed(2)}" class="${inw ? 'in' : 'out'}"><title>${b0} … ${b0 + j.bin_s} s: ${v}</title></rect>`; }).join('');
  const zx = (j.bins.indexOf(0) * W).toFixed(2);
  const verdict = j.p == null ? '' : j.p <= 0.05 ? t('sc_cal_p_ok', { p: numTxt(String(Math.round(j.p * 100))) }) : t('sc_cal_p_no', { p: numTxt(String(Math.round(j.p * 100))) });
  bd.innerHTML = `<p>${esc(t('sc_cal_n', { n: j.n, d: j.days, m: tot }))}</p>
    <figure class="scalfig"><svg viewBox="0 0 100 44" preserveAspectRatio="none" role="img" aria-label="${esc(t('sc_cal_a', { b: j.hist.map((v, i) => j.bins[i] + ' s: ' + v).filter((x, i) => j.hist[i]).join(', ') || '–' }))}">${bars}<line x1="${zx}" x2="${zx}" y1="0" y2="40" class="zero"/></svg>
      <figcaption><span>−${j.bins.length ? -j.bins[0] : 60} s</span><span>${esc(t('sc_cal_zero'))}</span><span>+${j.bins.length ? j.bins[j.bins.length - 1] + j.bin_s : 60} s</span></figcaption></figure>
    <p>${esc(t('sc_cal_win', { a: j.pre, b: j.post, r: j.real, m: numTxt(String(j.shift_mean ?? '–')) }))}</p>
    ${verdict ? `<p><b>${esc(verdict)}</b></p>` : ''}
    ${j.sug ? `<p>${esc(t('sc_cal_sug', { a: j.sug[0], b: j.sug[1] }))} <button type="button" class="chip scalok">${esc(t('sc_cal_take'))}</button></p>` : `<p class="mut">${esc(t('sc_cal_few'))}</p>`}
    <p class="mut">${esc(t('sc_cal_h'))}</p>`;
  const ok = bd.querySelector('.scalok'); if (ok) ok.onclick = () => { apply(j.sug); d.close(); };
}
/* Dashboard-Vorlage für Home Assistant (legt nur auf Knopfdruck etwas an) */
function hadashBox() {
  const fs = el('fieldset', { id: 'hdbox', className: 'ff' }); fs.dataset.sec = 's_hadash';
  fs.appendChild(el('legend', { textContent: t('s_hadash') }));
  const b = el('div'); fs.appendChild(b);
  if (window.HADash) HADash.mount(b, { lang, get: 'hadash', post: 'hadash_apply', preview: 'hadash',
    parts: { live: t('hd_live'), verlauf: t('hd_verlauf'), notiz: t('hd_notiz'), ruhe: t('hd_ruhe'), pause: t('hd_pause'), quellen: t('hd_quellen'), kacheln: t('hd_kacheln'), oeffnen: t('hd_oeffnen') } });
  return fs;
}
async function haLoad(onlyState) {
  try { const r = await (await fetch('ha_rules', { cache: 'no-store' })).json(); HAR.info = r;
    const loc = HAR.rules.filter(x => x.entity), same = onlyState && loc.length === r.rules.length && loc.every((x, i) => x.id === r.rules[i].id);
    if (same) { r.rules.forEach((x, i) => { for (const k of ['now_state', 'name', 'active', 'hold', 'until', 'capped', 'err', 'hist', 'vol', 'mute', 'raise_now']) loc[i][k] = x[k]; }); haStates(HAR.rules); }
    else if (!onlyState || !document.activeElement || !document.activeElement.closest('#halist,#hawiz')) { HAR.rules = r.rules; haRender(); }
  } catch (e) { }
}
async function haLoadEnts() {
  try { const r = await (await fetch('ha_entities', { cache: 'no-store' })).json(); HAR.ents = r.entities || []; const dl = $('haents'); if (dl) dl.innerHTML = HAR.ents.map(e => `<option value="${esc(e.id)}">${esc(e.name)} (${esc(e.state)})</option>`).join(''); if (HAR.wiz && HAR.wiz.step === 2) haWizRender(); } catch (e) { }
}
function haHistTxt(r) {
  const h = r.hist; if (!h) return '';
  if (h.ok === false) return ' · ⚠ ' + t('ha_hist_err', { e: h.err || '?' });
  if (h.ok == null) return '';
  return ' · ' + t('ha_hist_ok', { n: h.n, l: h.last ? new Date(h.last).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'de-DE') : '–' });
}
const haName = r => r.label || (r.name && r.name !== r.entity ? r.name : '') || r.entity || t('ha_new');
function haStateTxt(r) { return haStateTxt0(r) + haHistTxt(r); }
function haStateTxt0(r) {
  if (!r.entity) return '';
  if (r.enabled === false) return t('ha_disabled');
  if (r.err) return '⚠ ' + r.err;
  if (r.now_state == null) return t('ha_wait');
  const now = t('ha_now', { s: haStLabel(r.now_state) }) + (r.vol != null && r.active ? ' · 🔊 ' + (r.mute ? t('ha_muted') : r.vol + ' %') : '');
  if (r.mode === 'note' || r.mode === 'event') return now + ' · 📝 ' + t(r.active ? 'ha_noting' : 'ha_noting_off');
  if (r.mode === 'raise') { if (!HAR.info.pro) return now + ' · 🔒 ' + t('ha_r_nopro'); if (r.hold) return now + ' · 📈 ' + t('ha_r_on', { d: fmtDb(r.raise_now || 0) }) + (r.active ? '' : ' · ' + haUntil(r)); return now + ' · ' + (r.capped ? '⚠ ' + t('ha_capped') : t('ha_r_off')); }
  return now + ' · ' + (r.hold ? (r.active ? (r.mode === 'quiet' ? '🔕 ' + t('ha_qholding') : '⏸ ' + t('ha_holding')) : (r.mode === 'quiet' ? '🔕 ' : '⏸ ') + haUntil(r)) : (r.capped ? '⚠ ' + t('ha_capped') : '▶ ' + t('ha_rec')));
}
const fmtDb = v => (Math.round(v * 10) / 10).toLocaleString(lang === 'en' ? 'en-GB' : 'de-DE');
const haUntil = r => t('ha_after', { u: r.until ? new Date(r.until).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'de-DE', { hour: '2-digit', minute: '2-digit' }) : '' });
function haStLabel(s) { const k = 'hs_' + String(s).toLowerCase(); const v = t(k); return v && v !== k ? v : String(s); }
function haStates(rows) {
  rows.forEach(r => { const c = document.querySelector(`#halist .hacard[data-id="${r.id}"]`); if (!c) return; const e = c.querySelector('.hanow'); if (e) { e.textContent = haStateTxt(r); e.classList.toggle('hold', !!r.hold); } c.classList.toggle('hon', !!r.hold && r.enabled !== false); });
  haOverview(rows);
}
function haOverview(rows) {
  const st = $('hastat'); if (!st) return; const i = HAR.info || {};
  st.innerHTML = '';
  if (i.available === false) { st.textContent = '⚠ ' + t('ha_noapi'); return; }
  if (i.ok === false && i.error) { st.textContent = '⚠ ' + t('ha_err', { e: i.error }); return; }
  const on = (rows || []).filter(r => r.enabled !== false && (r.hold || ((r.mode === 'note' || r.mode === 'event') && r.active)));
  st.appendChild(el('span', { className: 'haok', textContent: '✓ ' + t('ha_conn') }));
  if (!on.length) st.appendChild(el('span', { className: 'mut', textContent: ' · ' + t('ha_none_on') }));
  else { st.appendChild(document.createTextNode(' · ' + t('ha_on_now') + ' ')); on.forEach(r => st.appendChild(el('span', { className: 'chip haonc m-' + r.mode, textContent: haIcon(r.mode) + ' ' + haName(r) + (r.mode === 'raise' && r.raise_now ? ' +' + fmtDb(r.raise_now) + ' dB' : '') }))); }
}
/* Neue Regel: erst die Art (Kacheln), dann das Gerät (Liste mit Suche) */
function haWizard() { HAR.wiz = { step: 1, mode: '', q: '' }; haWizRender(); $('hawiz').scrollIntoView({ block: 'nearest' }); }
function haWizRender() {
  const w = $('hawiz'); if (!w) return; const z = HAR.wiz; w.hidden = !z; w.innerHTML = ''; if (!z) return;
  const top = el('div', { className: 'hawtop' });
  top.append(el('b', { textContent: z.step === 1 ? t('ha_w1') : t('ha_w2', { m: t('ha_mode_' + z.mode) }) }));
  const x = el('button', { type: 'button', className: 'hadel', textContent: '✕', title: t('cancel') }); x.onclick = () => { HAR.wiz = null; haWizRender(); }; top.append(x); w.appendChild(top);
  if (z.step === 1) {
    const g = el('div', { className: 'hatiles' });
    for (const [m, ic] of HA_MODES) {
      const b = el('button', { type: 'button', className: 'hatile m-' + m });
      b.innerHTML = `<span class="hati">${ic}</span><b>${esc(t('ha_mode_' + m))}</b><small>${esc(t('ha_md_' + m))}</small>`;
      if (m === 'raise' && !PRO.ok) b.appendChild(proLockTag());
      b.onclick = () => { if (m === 'raise' && !PRO.ok) { proGate('raise'); return; } z.mode = m; z.step = 2; haWizRender(); setTimeout(() => { const q = $('hawq'); if (q) q.focus(); }, 30); };
      g.appendChild(b);
    }
    w.appendChild(g); return;
  }
  const q = el('input', { type: 'search', id: 'hawq', className: 'hawq', value: z.q, placeholder: t('ha_w_search') });
  const list = el('div', { className: 'hawlist' });
  const pref = { raise: ['media_player'], quiet: ['assist_satellite', 'media_player'], pause: ['vacuum', 'switch', 'fan'], note: ['media_player'], event: ['binary_sensor'] }[z.mode] || [];
  const fill = () => {
    list.innerHTML = ''; const s = q.value.trim().toLowerCase(); z.q = q.value;
    const all = (HAR.ents || []).filter(e => !s || e.id.includes(s) || (e.name || '').toLowerCase().includes(s));
    all.sort((a, b) => { const pa = pref.indexOf(a.id.split('.')[0]), pb = pref.indexOf(b.id.split('.')[0]); return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || (a.name || a.id).localeCompare(b.name || b.id); });
    all.slice(0, 80).forEach(e => { const b = el('button', { type: 'button', className: 'hawent' }); b.innerHTML = `<b>${esc(e.name || e.id)}</b><small>${esc(e.id)} · ${esc(haStLabel(e.state))}</small>`; b.onclick = () => haWizPick(e.id, e.name); list.appendChild(b); });
    if (HAR.ents == null) list.appendChild(el('div', { className: 'mut', textContent: t('ha_w_loading') }));
    else if (!all.length) list.appendChild(el('div', { className: 'mut', textContent: t('ha_w_noent') }));
    if (/^[a-z_]+\.[a-z0-9_]+$/.test(s) && !all.some(e => e.id === s)) { const b = el('button', { type: 'button', className: 'chip', textContent: t('ha_w_manual', { e: s }) }); b.onclick = () => haWizPick(s, ''); list.prepend(b); }
  };
  q.addEventListener('input', fill); q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const b = list.querySelector('button'); if (b) b.click(); } });
  const back = el('button', { type: 'button', className: 'chip', textContent: '← ' + t('ha_w_back') }); back.onclick = () => { z.step = 1; haWizRender(); };
  w.append(q, list, back); fill();
}
function haWizPick(ent, name) {
  const m = HAR.wiz.mode, d = haDefaults(ent, m);
  const r = Object.assign({ id: '', entity: ent, src: 'all', enabled: true, label: '' }, d, { mode: m });
  if (m !== 'quiet') r.pre_s = 0;
  HAR.rules.push(r); HAR.wiz = null; haWizRender();
  HAR.open.add('#new'); haRender(); haSave().then(() => { const c = $('halist').lastElementChild; if (c) c.scrollIntoView({ block: 'nearest' }); });
}
function haRender() {
  const box = $('halist'); if (!box) return;
  haOverview(HAR.rules);
  box.innerHTML = '';
  box.appendChild(haPresence());
  if (!HAR.rules.length) box.appendChild(el('div', { className: 'ntnone', textContent: t('ha_none') }));
  HAR.rules.forEach((r, idx) => box.appendChild(haCard(r, idx)));
}
/* ab 1.85.48: Anwesenheit als Einstellung – Person/Handy aus Home Assistant; dahinter steckt eine Regel „nur festhalten“ mit fester Kennung */
function haPresence() {
  const cur = HAR.rules.find(r => r.id === 'presence'), ent = cur ? cur.entity : '';
  const L = el('label', { className: 'hafld hapres' }); L.append(el('span', { textContent: t('ha_pres') }));
  const sel = el('select'); option(sel, '', t('ha_pres_none'));
  const ents = (HAR.ents || []).filter(e => /^(person|device_tracker)\./.test(e.id));
  if (ent && !ents.some(e => e.id === ent)) ents.unshift({ id: ent, name: ent, state: '' });
  ents.forEach(e => option(sel, e.id, (e.name || e.id) + (e.state ? ' (' + e.state + ')' : '')));
  sel.value = ent; L.appendChild(sel); L.title = t('ha_pres_hint');
  sel.onchange = () => {
    const v = sel.value;
    if (!v) HAR.rules = HAR.rules.filter(r => r.id !== 'presence');
    else if (cur) cur.entity = v;
    else HAR.rules.unshift({ id: 'presence', entity: v, states: 'home', mode: 'note', label: t('ha_pres_lbl'), src: 'all', enabled: true, dur: 'state', cap_min: 0, after_min: 0, max_h: 0, dur_s: 5 });
    haSave().then(haRender);
  };
  const w = el('div', { className: 'hapresbox' }); w.append(L, el('small', { className: 'hint', textContent: t('ha_pres_hint') }));
  return w;
}
function haCard(r, idx) {
  const key = r.id || '#new';
  const open = HAR.open.has(key);
  const c = el('div', { className: 'harow hacard m-' + (r.mode || 'pause') + (open ? ' open' : '') + (r.enabled === false ? ' off' : '') + (r.hold && r.enabled !== false ? ' hon' : '') }); c.dataset.id = r.id || '';
  const hd = el('div', { className: 'hahead' });
  const on = el('input', { type: 'checkbox', className: 'haon', checked: r.enabled !== false, title: t('ha_enabled') });
  const ttl = el('button', { type: 'button', className: 'hattl hatg' }); ttl.setAttribute('aria-expanded', String(open));   // Aufklappen: eigener Knopf (Schalter daneben bleibt bedienbar)
  ttl.innerHTML = `<b>${esc(haIcon(r.mode))} ${esc(haName(r))}</b><small>${esc(t('ha_mode_' + (r.mode || 'pause')))}${r.mode === 'raise' ? ' +' + esc(fmtDb(r.raise_db ?? 10)) + ' dB' + (r.vol_scale ? ' 🔊' : '') : ''} · ${esc(r.entity || '')}${r.src && r.src !== 'all' ? ' · ' + esc((SOURCES.find(x => x.id === r.src) || {}).name || r.src) : ''}</small>`;
  const now = el('small', { className: 'hanow' + (r.hold ? ' hold' : ''), textContent: haStateTxt(r) }); ttl.appendChild(now);
  const chev = el('span', { className: 'hachev', textContent: open ? '▾' : '▸' }); chev.setAttribute('aria-hidden', 'true');
  hd.append(on, ttl, chev);
  const flip = () => { if (open) HAR.open.delete(key); else HAR.open.add(key); haRender(); };
  hd.onclick = e => { if (e.target === on) return; flip(); };
  on.addEventListener('change', () => { r.enabled = on.checked; haSave().then(haRender); });
  c.appendChild(hd);
  if (open) c.appendChild(haBody(r, idx));
  return c;
}
function haBody(r, idx) {
  const b = el('div', { className: 'habody' });
  const lab = (txt, inp, unit, tip) => { const L = el('label', { className: 'hafld' }); L.append(el('span', { textContent: txt }), inp); if (unit) L.append(el('em', { textContent: unit })); if (tip) L.title = tip; return L; };
  const save = () => haSave();
  const nmi = el('input', { type: 'text', value: r.label || '', maxLength: 60, placeholder: r.name && r.name !== r.entity ? r.name : t('ha_name_ph'), title: t('ha_name_tip') });
  nmi.addEventListener('change', () => { r.label = nmi.value.trim(); save(); });
  const md = el('select', { className: 'hamode' });
  for (const [m, ic] of HA_MODES) option(md, m, ic + ' ' + t('ha_mode_' + m) + (m === 'raise' && !PRO.ok ? ' 🔒' : ''));
  md.value = r.mode || 'pause';
  md.addEventListener('change', () => { if (md.value === 'raise' && !PRO.ok) { md.value = r.mode; proGate('raise'); return; } r.mode = md.value; if (r.mode === 'raise') Object.assign(r, Object.assign(haDefaults(r.entity, 'raise'), { states: r.states })); save().then(haRender); });
  const ent = el('input', { type: 'text', value: r.entity || '', placeholder: 'media_player.fernseher', className: 'haent' }); ent.setAttribute('list', 'haents');
  ent.addEventListener('change', () => { r.entity = ent.value.trim(); save().then(haRender); });
  const src = el('select', { className: 'hasrc', title: t('ha_src') });
  option(src, 'all', t('all_sources')); SOURCES.forEach(x => option(src, x.id, x.name)); src.value = r.src || 'all';
  src.addEventListener('change', () => { r.src = src.value; save(); });
  const g1 = el('div', { className: 'hagrid' }); g1.append(lab(t('ha_name'), nmi), lab(t('ha_model'), md), lab(t('ha_dev'), ent), lab(t('ha_src'), src));
  b.appendChild(g1);
  /* Wann aktiv: Zustände zum Anhaken (dazu frei als Text, z. B. !off oder >1) */
  const wn = el('div', { className: 'hawhen' });
  wn.appendChild(el('span', { className: 'hawl', textContent: t(['pause', 'quiet', 'raise'].includes(r.mode) ? 'ha_when' : 'ha_whenn') }));
  const toks = String(r.states || '').split(',').map(x => x.trim()).filter(Boolean);
  const pos = new Set(toks.filter(x => !/^[!<>]/.test(x)).map(x => x.toLowerCase())), extra = toks.filter(x => /^[!<>]/.test(x));
  const cand = [...new Set([...haStsFor(r.entity), ...pos, ...(r.now_state && !/^(unknown|unavailable)$/.test(r.now_state) ? [String(r.now_state).toLowerCase()] : [])])];
  const sts = el('input', { type: 'text', value: r.states || '', className: 'hasts', placeholder: 'on, playing  ·  !off  ·  >1', title: t('ha_states_tip') });
  const chips = el('div', { className: 'hachips' });
  cand.forEach(s => { const L = el('label', { className: 'chip hachk' + (pos.has(s) ? ' on' : '') }); const cb = el('input', { type: 'checkbox', checked: pos.has(s) }); L.append(cb, document.createTextNode(' ' + haStLabel(s) + (haStLabel(s).toLowerCase() !== s ? ' (' + s + ')' : ''))); cb.addEventListener('change', () => { if (cb.checked) pos.add(s); else pos.delete(s); r.states = [...cand.filter(x => pos.has(x)), ...[...pos].filter(x => !cand.includes(x)), ...extra].join(', '); sts.value = r.states; L.classList.toggle('on', cb.checked); save(); }); chips.appendChild(L); });
  sts.addEventListener('change', () => { r.states = sts.value; save().then(haRender); });
  const adv = el('details', { className: 'haadv' }); adv.open = !!extra.length || !cand.length; adv.append(el('summary', { textContent: t('ha_adv') }), sts, el('small', { className: 'mut', textContent: t('ha_states_tip') }));
  wn.append(chips, adv); b.appendChild(wn);
  /* Zeiten */
  const g2 = el('div', { className: 'hagrid' });
  if (['pause', 'quiet', 'raise'].includes(r.mode)) {
    const aft = el('input', { type: 'number', min: 0, max: 240, step: 0.5, value: r.after_min ?? 1, className: 'n' }); aft.addEventListener('change', () => { r.after_min = +aft.value; save(); });
    const mx = el('input', { type: 'number', min: 0, max: 48, step: 1, value: r.max_h ?? 8, className: 'n' }); mx.addEventListener('change', () => { r.max_h = +mx.value; save(); });
    g2.append(lab(t('ha_afterl'), aft, 'min', t('ha_after_tip')), lab(t('ha_maxl'), mx, 'h', t('ha_max_tip')));
  }
  if (r.mode === 'quiet') { const preI = el('input', { type: 'number', min: 0, max: 30, step: 0.5, value: r.pre_s || 0, className: 'n' }); preI.addEventListener('change', () => { r.pre_s = +preI.value || 0; save(); }); g2.append(lab(t('ha_pre'), preI, 's', t('ha_pre_tip'))); }
  if (r.mode === 'event' || r.mode === 'note') {        // Dauer (1.83.2): einmal auslösen (feste Länge) oder solange gemeldet (mit Obergrenze)
    const dsel = el('select', { className: 'hadur' });
    for (const [v, l] of [['state', t('ha_dur_state')], ['pulse', t('ha_dur_pulse')]]) dsel.appendChild(el('option', { value: v, textContent: l, selected: (r.dur || 'state') === v }));
    dsel.addEventListener('change', () => { r.dur = dsel.value; save().then(haRender); });
    g2.append(lab(t('ha_dur'), dsel, '', t('ha_dur_tip')));
    if (r.dur === 'pulse') {
      const ds = el('input', { type: 'number', min: 1, max: 3600, step: 1, value: r.dur_s ?? 5, className: 'n' }); ds.addEventListener('change', () => { r.dur_s = +ds.value || 5; save(); });
      g2.append(lab(t('ha_dur_s'), ds, 's', t('ha_dur_s_tip')));
    } else {
      const cm = el('input', { type: 'number', min: 0, max: 1440, step: 1, value: r.cap_min ?? 0, className: 'n' }); cm.addEventListener('change', () => { r.cap_min = +cm.value || 0; save(); });
      g2.append(lab(t('ha_cap'), cm, 'min', t('ha_cap_tip')));
    }
  }
  if (r.mode === 'event') {
    const nmNow = r.label || r.name || r.entity || '';
    const colI = el('input', { type: 'color', className: 'hacol', value: r.color || sensCol([0, 0, nmNow]), title: t('ha_col_tip') });
    const colR = el('button', { type: 'button', className: 'chip hacolr', textContent: '↺', title: t('ha_col_auto'), hidden: !r.color });
    colI.addEventListener('change', () => { r.color = colI.value; colR.hidden = false; save(); });
    colR.onclick = () => { r.color = ''; colI.value = sensCol([0, 0, nmNow]); colR.hidden = true; save(); };
    const lc = lab(t('ha_col'), colI); lc.appendChild(colR);
    const bigI = el('input', { type: 'checkbox', checked: !!r.big }); bigI.addEventListener('change', () => { r.big = bigI.checked; save(); });
    g2.append(lc, lab(t('ha_big'), bigI, '', t('ha_big_tip')));
  }
  if (g2.childNodes.length) b.appendChild(g2);
  if (r.mode === 'raise') b.appendChild(haRaiseBox(r));
  /* Testen, Kopieren, Löschen */
  const ft = el('div', { className: 'hafoot' });
  const res = el('small', { className: 'hatest' });
  const tst = el('button', { type: 'button', className: 'chip', textContent: '▶ ' + t('ha_test') });
  tst.onclick = async () => { res.textContent = '…'; try { const j = await (await fetch('ha_test?entity=' + encodeURIComponent(r.entity || '') + '&states=' + encodeURIComponent(r.states || ''), { cache: 'no-store' })).json(); res.className = 'hatest ' + (j.ok ? (j.match ? 'yes' : 'no') : 'err'); res.textContent = j.ok ? t('ha_test_res', { n: j.name, s: haStLabel(j.state) }) + (j.vol != null ? ' · 🔊 ' + (j.mute ? t('ha_muted') : j.vol + ' %') : '') + ' → ' + t(j.match ? 'ha_test_yes' : 'ha_test_no') : '⚠ ' + (j.error === 'notfound' ? t('ha_test_nf') : j.error); } catch (e) { res.textContent = '⚠ ' + e.message; } };
  const cp = el('button', { type: 'button', className: 'chip', textContent: '⧉ ' + t('ha_copy') });
  cp.onclick = () => { const n = Object.assign({}, r, { id: '', label: (r.label || r.name || r.entity) + ' (2)' }); ['now_state', 'name', 'active', 'hold', 'until', 'capped', 'err', 'hist', 'vol', 'mute', 'raise_now'].forEach(k => delete n[k]); HAR.rules.splice(idx + 1, 0, n); HAR.open.add('#new'); haSave().then(haRender); };
  const del = el('button', { type: 'button', className: 'chip hadelb', textContent: '✕ ' + t('nt_del') });
  del.onclick = () => { if (!confirm(t('ha_del_q', { n: haName(r) }))) return; HAR.rules.splice(idx, 1); haSave().then(haRender); };
  ft.append(tst, cp, del, res); b.appendChild(ft);
  return b;
}
/* Schwelle anheben: Stärke, mit der Lautstärke mitgehen, Einpegeln (Taste gedrückt halten) */
function haRaiseBox(r) {
  const w = el('div', { className: 'haraise' });
  if (!PRO.ok) { const p = el('div', { className: 'haprow' }); p.append(proLockTag(), document.createTextNode(' ' + t('ha_r_nopro_l'))); w.appendChild(p); }
  const row = el('div', { className: 'hagrid' });
  const sl = el('input', { type: 'range', min: 0, max: 40, step: 0.5, value: r.raise_db ?? 10, className: 'haslider' });
  const nv = el('input', { type: 'number', min: 0, max: 40, step: 0.5, value: r.raise_db ?? 10, className: 'n' });
  sl.addEventListener('input', () => { nv.value = sl.value; }); sl.addEventListener('change', () => { r.raise_db = +sl.value; haSave(); });
  nv.addEventListener('change', () => { sl.value = nv.value; r.raise_db = +nv.value; haSave(); });
  const L = el('label', { className: 'hafld hawide' }); L.append(el('span', { textContent: t('ha_r_db') }), sl, nv, el('em', { textContent: 'dB' }));
  const vs = el('input', { type: 'checkbox', checked: !!r.vol_scale }); vs.addEventListener('change', () => { r.vol_scale = vs.checked; haSave().then(haRender); });
  const L2 = el('label', { className: 'hafld hachkl' }); L2.title = t('ha_r_vol_tip'); L2.append(vs, el('span', { textContent: ' ' + t('ha_r_vol') }));
  row.append(L, L2); w.appendChild(row);
  if (r.vol_scale) w.appendChild(el('small', { className: 'mut', textContent: r.cal_vol ? t('ha_r_vol_ex', { d: fmtDb(r.raise_db ?? 10), v: r.cal_vol, h: fmtDb((r.raise_db ?? 10) / 2), v2: Math.round(r.cal_vol / 2) }) : t('ha_r_vol_nocal') }));
  const cb = el('div', { className: 'hacalrow' });
  const btn = el('button', { type: 'button', className: 'pri hacalb', textContent: '🎚 ' + t('ha_cal') }); btn.title = t('ha_cal_tip');
  const info = el('small', { className: 'hacalinfo' });
  info.textContent = r.cal_at ? t('ha_cal_last', { d: new Date(r.cal_at).toLocaleString(lang === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'short', timeStyle: 'short' }), l: r.cal_lvl != null ? fmtDb(r.cal_lvl) : '–', v: r.cal_vol != null ? r.cal_vol + ' %' : '–' }) : t('ha_cal_none');
  if (!PRO.ok) { btn.disabled = true; btn.appendChild(proLockTag()); }
  let t0 = 0, tick = 0, busy = false, held = false;
  const start = async e => {
    held = true; if (e) e.preventDefault(); if (busy || HAR.cal || !PRO.ok) return; busy = true;
    if (!r.id) await haSave();
    if (!r.id) { busy = false; return; }
    try { btn.setPointerCapture && e && e.pointerId != null && btn.setPointerCapture(e.pointerId); } catch (x) { }
    const j = await (await fetch('ha_cal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', rid: r.id, src: r.src || 'all', entity: r.entity }) })).json().catch(() => ({ ok: false }));
    if (!j.ok) { busy = false; info.textContent = '⚠ ' + t('ha_cal_e_' + (j.error || 'x')); return; }
    HAR.cal = r.id; t0 = Date.now(); btn.classList.add('on'); w.classList.add('caling');
    const up = () => { const s = (Date.now() - t0) / 1000; info.textContent = '🎚 ' + t('ha_cal_run', { s: fmtDb(Math.floor(s * 10) / 10) }) + (s < 3 ? ' · ' + t('ha_cal_hold') : ' · ' + t('ha_cal_ok')); };
    up(); tick = setInterval(up, 200); busy = false;
    $('dlg').addEventListener('close', () => { held = false; if (HAR.cal === r.id) stop(); }, { once: true });   // ab 1.85.35: Fenster zu, während die Taste gedrückt ist: Einpegeln beenden
    if (!held) stop();              // schon losgelassen, während der Start lief
  };
  const stop = async () => {
    held = false; if (HAR.cal !== r.id || busy) return;
    clearInterval(tick); btn.classList.remove('on'); w.classList.remove('caling'); busy = true;
    const j = await (await fetch('ha_cal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) })).json().catch(() => ({ ok: false }));
    HAR.cal = null; busy = false;
    if (!j.ok) { info.textContent = '⚠ ' + t('ha_cal_e_' + (j.error || 'x')); return; }
    Object.assign(r, { raise_db: j.raise_db, cal_lvl: j.cal_lvl, cal_at: j.cal_at }); if (j.cal_vol != null) r.cal_vol = j.cal_vol;
    await haSave(); haRender();
    const c = document.querySelector(`#halist .hacard[data-id="${r.id}"] .hacalinfo`); if (c) { c.textContent = '✓ ' + t('ha_cal_done', { d: fmtDb(j.raise_db), l: fmtDb(j.cal_lvl), th: fmtDb(j.thr), v: j.cal_vol != null ? j.cal_vol + ' %' : '–' }); c.classList.add('ok'); }
  };
  btn.addEventListener('pointerdown', e => start(e));
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, () => stop());
  btn.addEventListener('contextmenu', e => e.preventDefault());
  btn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e); });
  btn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') stop(); });
  cb.append(btn, info); w.appendChild(cb);
  w.appendChild(el('small', { className: 'mut', textContent: t('ha_cal_help') }));
  return w;
}
async function haSave() {
  try {
    const r = await (await fetch('ha_rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: HAR.rules.filter(x => x.entity) }) })).json();
    if (r.ok) {
      const keep = HAR.rules.filter(x => !x.entity);
      if (HAR.open.has('#new')) { HAR.open.delete('#new'); const nw = r.rules.find(x => !HAR.rules.some(o => o.id && o.id === x.id)); if (nw) HAR.open.add(nw.id); }
      const loc = HAR.rules.filter(x => x.entity);   // Objekte behalten (Bezüge in offenen Karten), nur mit dem Server abgleichen
      r.rules.forEach((x, i) => { if (loc[i]) Object.assign(loc[i], x); });
      HAR.info = r; HAR.rules = (loc.length === r.rules.length ? loc : r.rules).concat(keep); haStates(HAR.rules); flash($('habox'));
    }
  } catch (e) { alert(t('saveerr') + ' ' + e.message); }
}
/* Einstellungs-Bereiche einklappbar; Zustand pro Browser gemerkt */
const SEC_OPEN_DEFAULT = { s_pro: true, s_greport: true, s_prof: true, srcbox1: true, srcbox: true, s_audio: true, s_time: true, s_quiet: true, s_thr: true, s_ki: true, s_ha: true, s_hadash: true, s_rec: true, s_keep: true, s_backup: true, s_mirror: true, s_misc: true, s_list: true, s_diag: true };
function secState() { try { return JSON.parse(localStorage.getItem('laerm_secs') || '{}'); } catch (e) { return {}; } }
function makeCollapsible() {
  const st = secState();
  $('sbody').querySelectorAll(':scope > fieldset').forEach(fs => {
    const key = fs.dataset.sec || fs.id; if (!key || key === 'devbox' || fs.dataset.coll) return;
    const lg = fs.querySelector(':scope > legend'); if (!lg) return;
    fs.dataset.coll = '1'; fs.classList.add('coll');
    const open = key in st ? st[key] : !!SEC_OPEN_DEFAULT[key];
    fs.classList.toggle('shut', !open);
    // Aufklappen über einen eigenen Knopf in der Überschrift (Hilfe-Symbol und Handbuch-Link bleiben daneben bedienbar)
    const tg = el('button', { type: 'button', className: 'legtg' }); tg.setAttribute('aria-expanded', String(open));
    for (const n of [...lg.childNodes]) { if (n.nodeType === 1 && n.matches('.tip,.tipi,.hbleg,button,input,a')) break; tg.appendChild(n); }
    lg.prepend(tg);
    const flip = () => { const o = fs.classList.toggle('shut') === false; tg.setAttribute('aria-expanded', String(o)); const s2 = secState(); s2[key] = o; try { localStorage.setItem('laerm_secs', JSON.stringify(s2)); } catch (e) { } };
    lg.onclick = e => { if (e.target.closest('.tip,.tipi,input,a') || (e.target.closest('button') && !e.target.closest('.legtg'))) return; flip(); };
    const hbk = HB_SEC[key]; if (hbk && !lg.querySelector('.hbleg')) { const a = el('a', { href: '#', className: 'hbleg', textContent: '📖', title: t('hb_more') }); a.dataset.hb = hbk; lg.appendChild(a); }   // Kapitel im Handbuch
  });
}
function openSec(key) { if (SEC_TAB[key]) setSTab(SEC_TAB[key]); const fs = $('sbody').querySelector(`fieldset[data-sec="${key}"], fieldset#${key}`); if (fs && fs.classList.contains('shut')) fs.querySelector(':scope > legend').click(); return fs; }
/* Einstellungen in Reitern; Inhalte der Bereiche bleiben unveraendert. Bereiche ohne Reiter (Auswahl des Geraets) stehen in jedem Reiter. */
const STABS = [['dev', 'st_dev'], ['det', 'st_det'], ['time', 'st_time'], ['rules', 'st_rules'], ['save', 'st_save'], ['gen', 'st_gen']];
const SEC_TAB = { s_ki: 'det', s_quiet: 'time', s_place: 'save', s_keep: 'save', s_list: 'gen', s_pro: 'gen', s_wav: 'save', s_mirror: 'save', s_reset: 'gen', rsbox: 'gen', s_greport: 'gen', grbox: 'gen', s_prof: 'det', pfbox: 'det', s_muster: 'det', mfbox: 'det', srcbox1: 'dev', diagset: 'gen', s_diag: 'gen', srcbox: 'dev', calbox: 'dev', s_cal: 'dev', s_audio: 'dev', s_thr: 'det', s_time: 'time', s_sched: 'time', schedbox: 'time', s_ha: 'rules', habox: 'rules', s_hadash: 'rules', hdbox: 'rules', s_notes: 'time', s_rec: 'save', s_video: 'save', s_misc: 'gen', s_backup: 'save', bkbox: 'save' };
let STAB = 'dev'; try { STAB = localStorage.getItem('laerm_stab') || 'dev'; } catch (e) { }
if (!STABS.some(x => x[0] === STAB)) STAB = 'dev';
function applySTab() {
  $('sbody').querySelectorAll(':scope > fieldset').forEach(fs => { const k = SEC_TAB[fs.dataset.sec] || SEC_TAB[fs.id]; fs.classList.toggle('tabhide', !!k && k !== STAB); });
}
function setSTab(k, keep) {
  STAB = k;
  $('stabs').querySelectorAll('.stab').forEach(x => { const on = x.dataset.tab === k; x.classList.toggle('cur', on); x.setAttribute('aria-selected', String(on)); if (on) { const b = $('stabs'); if (x.offsetLeft < b.scrollLeft || x.offsetLeft + x.offsetWidth > b.scrollLeft + b.clientWidth) b.scrollLeft = x.offsetLeft - 8; } });
  applySTab(); if (!keep) $('sbody').scrollTop = 0; hideTip();
  try { localStorage.setItem('laerm_stab', k); } catch (e) { }
}
function initSTabs() {
  const b = $('stabs'); b.innerHTML = '';
  for (const [k, l] of STABS) { const x = el('button', { type: 'button', className: 'stab', textContent: t(l) }); x.dataset.tab = k; x.setAttribute('role', 'tab'); x.onclick = () => setSTab(k); b.appendChild(x); }
  setSTab(STAB, true); syncSTabs();
  if (!initSTabs.obs) { initSTabs.obs = new MutationObserver(applySTab); initSTabs.obs.observe($('sbody'), { childList: true }); }
}
/* Diagnosemodus: blendet unten die Diagnose (Mikrofon, Soundkarte) ein; gilt pro Browser */
function diagOn() { try { return localStorage.getItem('laerm_diag') === '1'; } catch (e) { return false; } }
function diagApply() { const on = diagOn(); $('diagbox').hidden = !on; if (on) { $('diagbox').open = true; diagT = 0; loadDiag(); } }
function diagBox() {
  const fs = el('fieldset', { id: 'diagset' }); fs.dataset.sec = 's_diag';
  const lg = el('legend', { textContent: t('s_diag') }); const ti = tipIcon('t_diagmode'); if (ti) lg.appendChild(ti); fs.appendChild(lg);
  const l = el('label', { className: 'bkchk' }); const cb = el('input', { type: 'checkbox', id: 'diagmode', checked: diagOn() });
  l.append(cb, el('span', { textContent: t('diag_mode') })); fs.appendChild(l);
  fs.appendChild(el('small', { className: 'bkhelp', textContent: t('h_diagmode') }));
  cb.onchange = () => { try { localStorage.setItem('laerm_diag', cb.checked ? '1' : '0'); } catch (e) { } diagApply(); };
  return fs;
}
/* Komplette Sicherung: herunterladen und einspielen (zusammenfuehren) */
/* Zurücksetzen: gewählte Teile löschen; vorher Sicherung anbieten, ohne Sicherung doppelte Abfrage */
function rsBox() {
  const fs = el('fieldset', { id: 'rsbox' }); fs.dataset.sec = 's_reset';
  fs.appendChild(el('legend', { textContent: t('s_reset') }));
  fs.appendChild(el('small', { className: 'bkhelp', textContent: t('h_reset') }));
  const box = el('div', { className: 'rsparts' });
  for (const k of ['data', 'notes', 'profiles', 'settings']) { const l = el('label', { className: 'chip' }), c = el('input', { type: 'checkbox', checked: true }); c.dataset.p = k; l.append(c, document.createTextNode(' ' + t('rs_' + k))); box.appendChild(l); }
  fs.appendChild(box);
  const r = el('div', { className: 'bkrow' }), go = el('button', { type: 'button', className: 'danger', textContent: t('rs_go') });
  const step = el('div', { className: 'rsstep', hidden: true }), msg = el('div', { className: 'calst' });
  r.appendChild(go); fs.append(r, step, msg);
  const parts = () => [...box.querySelectorAll('input:checked')].map(c => c.dataset.p);
  const names = () => parts().map(p => t('rs_' + p)).join(', ');
  const run = async () => {
    msg.textContent = t('rs_running');
    try { const j = await (await fetch('reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parts: parts(), confirm: 'RESET' }) })).json();
      if (!j.ok) throw new Error(j.error); formDirty = false; msg.textContent = '✓ ' + t('rs_done'); setTimeout(() => location.reload(), 1500);
    } catch (e) { msg.textContent = t('saveerr') + ' ' + e.message; }
  };
  go.onclick = () => {
    if (!parts().length) { msg.textContent = t('rs_none'); return; }
    step.hidden = false; msg.textContent = '';
    step.innerHTML = `<b>${esc(t('rs_backup_q'))}</b><div class="bkrow"><a class="chip pri" id="rsdl" href="backup.zip" download>⬇ ${esc(t('bk_down'))}</a><button type="button" class="chip" id="rsnodl">${esc(t('rs_nobackup'))}</button><button type="button" class="chip" id="rsx">${esc(t('cancel'))}</button></div><div id="rsok" class="bkrow" hidden><button type="button" class="danger" id="rsnow">${esc(t('rs_now'))}</button></div>`;
    $('rsx').onclick = () => { step.hidden = true; };
    $('rsdl').onclick = () => { $('rsok').hidden = false; msg.textContent = t('rs_after_dl'); };
    $('rsnow').onclick = () => { if (confirm(t('rs_q1', { p: names() }))) run(); };
    $('rsnodl').onclick = () => { if (confirm(t('rs_q2', { p: names() }))) run(); };   // ohne Sicherung: eine deutliche Abfrage
  };
  return fs;
}
function bkBox() {
  const fs = el('fieldset', { id: 'bkbox' }); fs.dataset.sec = 's_backup';
  const lg = el('legend', { textContent: t('s_backup') }); const ti = tipIcon('t_backup'); if (ti) lg.appendChild(ti); fs.appendChild(lg);
  fs.appendChild(el('small', { className: 'bkhelp', textContent: t('h_backup') }));
  const r1 = el('div', { className: 'bkrow' });
  const dl = el('a', { className: 'chip', href: 'backup.zip', textContent: '⬇ ' + t('bk_down') }); dl.setAttribute('download', '');
  r1.appendChild(dl); fs.appendChild(r1);
  {                                                  // Umzug auf ein neues Gerät: Kettenschlüssel und Zugangsdaten mit Passphrase verschlüsselt dazu
    const mv = el('details', { className: 'bkmove' }); mv.appendChild(el('summary', { textContent: '🔑 ' + t('bk_move') }));
    mv.appendChild(el('small', { className: 'bkhelp', textContent: t('h_bk_move') }));
    const row = el('div', { className: 'bkrow' });
    const p1 = el('input', { type: 'password', autocomplete: 'new-password', minLength: 8, maxLength: 200, placeholder: t('bk_move_pass') }); p1.setAttribute('aria-label', t('bk_move_pass'));
    const p2 = el('input', { type: 'password', autocomplete: 'new-password', minLength: 8, maxLength: 200, placeholder: t('bk_move_pass2') }); p2.setAttribute('aria-label', t('bk_move_pass2'));
    const b = el('button', { type: 'button', className: 'chip pri', textContent: '⬇ ' + t('bk_move_dl') });
    const m = el('span', { className: 'bkmsg' }); m.setAttribute('aria-live', 'polite');
    b.onclick = async () => {
      if (p1.value.length < 8) { m.textContent = t('bk_move_short'); p1.focus(); return; }
      if (p1.value !== p2.value) { m.textContent = t('bk_move_diff'); p2.focus(); return; }
      let j = {}; try { j = await (await fetch('backup_move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pass: p1.value }) })).json(); } catch (e) { }
      if (!j.ok || !j.token) { m.textContent = t('saveerr'); return; }
      const a = el('a', { href: 'backup.zip?move=' + encodeURIComponent(j.token) }); a.setAttribute('download', 'glighter_umzug.zip'); document.body.appendChild(a); a.click(); a.remove();
      p1.value = p2.value = ''; m.textContent = t('bk_move_ok');
    };
    row.append(p1, p2, b, m); mv.appendChild(row); fs.appendChild(mv);
  }
  const r2 = el('div', { className: 'bkrow' });
  const pick = el('label', { className: 'chip pickbtn' }); const fi = el('input', { type: 'file', id: 'bkfile', accept: '.zip,application/zip', hidden: true });
  pick.append('📂 ' + t('bk_pick'), fi);
  const fname = el('span', { className: 'chkname', id: 'bkname' });
  r2.append(pick, fname); fs.appendChild(r2);
  const r3 = el('label', { className: 'bkchk' }); const cb = el('input', { type: 'checkbox', id: 'bkset', checked: true });
  r3.append(cb, el('span', { textContent: t('bk_settings') })); fs.appendChild(r3);
  const r4 = el('div', { className: 'bkrow' });
  const go = el('button', { type: 'button', className: 'pri', id: 'bkgo', textContent: t('bk_restore'), disabled: true });
  const msg = el('span', { id: 'bkmsg', className: 'bkmsg' }); msg.setAttribute('aria-live', 'polite');
  r4.append(go, msg); fs.appendChild(r4);
  fi.onchange = () => { const f = fi.files[0]; fname.textContent = f ? f.name + ' · ' + (f.size / 1048576).toFixed(1) + ' MB' : ''; go.disabled = !f; msg.textContent = ''; };
  const pv = el('div', { id: 'bkpv', className: 'bkpv' }); pv.hidden = true; fs.appendChild(pv);
  const reset = () => { go.disabled = !fi.files[0]; pick.classList.remove('off'); };
  go.onclick = () => {                               // 1. hochladen und ansehen, 2. Geräte wählen, 3. einspielen
    const f = fi.files[0]; if (!f) return;
    go.disabled = true; pick.classList.add('off'); pv.hidden = true;
    // in Teilen zu 8 MB hochladen: Home Assistant lässt über die Seitenleiste nur ~16 MB je Anfrage durch
    const fail = e => { msg.textContent = t('bk_err', { e }); reset(); };
    const id = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join(''), CH = 8 * 1048576;
    (async () => {
      let off = 0, r = {};
      while (off < f.size) {
        const part = f.slice(off, Math.min(f.size, off + CH));
        let ok = false;
        for (let tr = 0; tr < 3 && !ok; tr++) {
          try {
            const res = await fetch(`restore_part?id=${id}&off=${off}&total=${f.size}`, { method: 'POST', body: part, headers: { 'Content-Type': 'application/octet-stream' } });
            r = {}; try { r = await res.json(); } catch (e) { r = { ok: false, error: res.status }; }
            if (r.ok || (r.error !== 'incomplete' && r.error !== 'order' && res.status < 500)) ok = true;
            else if (r.error === 'order' && r.have != null) { off = r.have; ok = true; r = { ok: true, retry: true }; }
          } catch (e) { r = { ok: false, error: 'network' }; await new Promise(z => setTimeout(z, 1500)); }
        }
        if (!r.ok) return fail(r.error === 'space' ? t('bk_space', { n: r.need_mb, f: r.free_mb }) : r.error === 'busy' ? t('bk_busy') : (r.error || 'network'));
        if (r.retry) continue;
        off += part.size;
        msg.textContent = t('bk_up', { p: Math.floor(off / f.size * 100) });
      }
      msg.textContent = ''; bkPreview(pv, r, cb, msg, reset);
    })();
  };
  {                                                  // Suchverzeichnis (SQLite): nur abgeleitete Daten, Originale bleiben unberührt
    const r9 = el('div', { className: 'bkrow sidxrow' }), info = el('small', { className: 'mut' }), clr = el('button', { type: 'button', className: 'chip', textContent: '↻ ' + t('sx_clear') });
    const load = async () => { try { const j = await (await fetch('sidx', { cache: 'no-store' })).json();
      info.textContent = j.ok === false && j.err ? t('sx_off') : t('sx_info', { d: j.chain || 0, a: j.agg || 0, s: ((j.size || 0) / 1048576).toFixed(1) }); } catch (e) { } };
    clr.onclick = async () => { if (!confirm(t('sx_clear_q'))) return; try { await fetch('sidx_clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } catch (e) { } load(); };
    r9.append(el('span', { textContent: '🗂 ' + t('sx_title') + ' ' }), info, clr); fs.appendChild(r9);
    fs.appendChild(el('small', { className: 'bkhelp', textContent: t('sx_help') })); load();
  }
  return fs;
}
/* Vorschau der Sicherung: welche Geräte, wie es hier aussieht; Auswahl, dann einspielen */
function bkPreview(pv, r, cb, msg, reset) {
  const L = locale(), when = r.created ? new Date(r.created).toLocaleString(L) : '';
  const st = d => d.status === 'unreachable' ? '⚠ ' + t('bk_d_unreach') : d.status === 'phone' ? '📱 ' + t('bk_d_phone') : '✔ ' + t('bk_d_ok');
  const rows = r.devices.map(d => `<label class="bkdev"><input type="checkbox" data-id="${esc(d.id)}" data-off="${d.status === 'unreachable' ? 1 : 0}" checked>
      <b>${esc(d.name)}</b><small>${esc(t(d.exists ? 'bk_d_exists' : 'bk_d_new'))} · ${esc(st(d))}</small></label>`).join('');
  pv.innerHTML = `<div class="bkpvh">${esc(t('bk_pv_head', { v: r.app || '?', d: when, n: r.files || 0 }))}</div>
    <div class="bkpvdev"${cb.checked ? '' : ' hidden'}><small>${esc(t('bk_pv_devs'))}</small>${rows || `<small>–</small>`}
      ${r.keep && r.keep.length ? `<small class="bkkeep">${esc(t('bk_pv_keep', { l: r.keep.map(k => k.name).join(', ') }))}</small>` : ''}
      ${r.mic && !r.mic.found ? `<small class="bkwarn">⚠ ${esc(t('bk_pv_mic', { d: r.mic.device }))}</small>` : ''}</div>
    <div class="bkpvdev"${cb.checked ? ' hidden' : ''}><small>${esc(t('bk_pv_noset'))}</small></div>
    ${r.move ? `<div class="bkpvmove"><small>🔑 ${esc(t('bk_pv_move'))}</small><input type="password" class="bkmvpass" autocomplete="off" maxlength="200" placeholder="${esc(t('bk_move_pass'))}" aria-label="${esc(t('bk_move_pass'))}"></div>` : `<small class="bkkeep">ⓘ ${esc(t('bk_pv_nomove'))}</small>`}
    <div class="ntedbtns"><button type="button" class="bkcancel">${esc(t('cancel'))}</button><button type="button" class="pri bkrun">${esc(t('bk_restore_go'))}</button></div>`;
  if (r.pro_needed) {                               // ohne Pro (kostenloser Import schon genutzt): nur ansehen
    const run = pv.querySelector('.bkrun'); const g = el('button', { type: 'button', className: 'pri', textContent: '🔒 ' + t('bk_restore_go') });
    g.onclick = () => proGate('imp'); run.replaceWith(g);
    pv.querySelector('.ntedbtns').before(el('small', { className: 'bkwarn', textContent: '🔒 ' + t('pro_imp_need') }));
  } else if (r.free_import) pv.querySelector('.ntedbtns').before(el('small', { className: 'bkkeep', textContent: 'ℹ ' + t('pro_imp_free') }));
  pv.hidden = false;
  cb.onchange = () => { const b = pv.querySelectorAll('.bkpvdev'); if (b.length) { b[0].hidden = !cb.checked; b[1].hidden = cb.checked; } };
  pv.querySelector('.bkcancel').onclick = async () => { try { await fetch('restore_go', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"cancel":true}' }); } catch (e) { } pv.hidden = true; reset(); };
  pv.querySelector('.bkrun').onclick = async () => {
    const sel = [...pv.querySelectorAll('.bkdev input')], pick = sel.filter(x => x.checked).map(x => x.dataset.id), off = sel.filter(x => x.checked && x.dataset.off === '1').map(x => x.dataset.id);
    if (!confirm(t('bk_confirm', { n: '' }).replace(/„\s*“\s*/, '') + (cb.checked ? '\n\n' + t('bk_confirm_set') : ''))) return;
    const mp = pv.querySelector('.bkmvpass'), move_pass = mp && mp.value ? mp.value : undefined;
    let j = {}; try { j = await (await fetch('restore_go', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: cb.checked, pick, off, move_pass }) })).json(); } catch (e) { }
    if (j.error === 'pro') { proGate('imp'); return; }
    if (!j.ok) { msg.textContent = t('bk_err', { e: j.error === 'busy' ? t('bk_busy') : (j.error || '') }); return; }
    pv.hidden = true; bkPoll(msg, reset);
  };
}
async function bkPoll(msg, done) {
  let r = {};
  try { r = await (await fetch('backup_status', { cache: 'no-store' })).json(); } catch (e) { }
  if (r.state === 'running') { msg.textContent = t('bk_run', { d: r.done || 0, t: r.total || '…' }); return setTimeout(() => bkPoll(msg, done), 1000); }
  done();
  if (r.state === 'error') { msg.textContent = t('bk_err', { e: r.msg || '' }); return; }
  const s = r.stats || {};
  msg.textContent = t('bk_done', { a: s.new || 0, b: s.same || 0, r: s.rows || 0, l: s.lists || 0 });
  const nm = id => viewName(id), dd = x => x.slice(8, 10) + '.' + x.slice(5, 7) + '.';
  const rep = [];                                    // ausführlicher Bericht, bleibt stehen
  if ((s.days_repaired || []).length) rep.push('✔ ' + t('bk_r_repaired', { l: s.days_repaired.map(x => dd(x[0]) + ' ' + nm(x[1])).join(', ') }));
  if ((s.days_merged || []).length) rep.push('✔ ' + t('bk_r_merged', { l: s.days_merged.map(x => dd(x[0]) + ' ' + nm(x[1]) + ' (+' + x[2] + ' min)').join(', ') }));
  if ((s.days_skipped || []).length) rep.push('⚠ ' + t('bk_r_skipped', { l: s.days_skipped.map(x => dd(x[0]) + ' ' + nm(x[1])).join(', ') }));
  if (s.devices) rep.push('✔ ' + t('bk_r_devs', { n: s.devices.length }) + (s.devices_off && s.devices_off.length ? ' · ' + t('bk_r_off', { n: s.devices_off.length }) : ''));
  if (s.mic_kept) rep.push('⚠ ' + t('bk_r_mic', { d: s.mic_kept }));
  if (s.sched_kept) rep.push('ⓘ ' + t('bk_r_sched'));
  if (s.chain_keys) rep.push('✔ ' + t('bk_r_keys'));
  if (s.move_skipped) rep.push('ⓘ ' + t('bk_r_move_skip'));
  if (s.chain_nokey) rep.push('ⓘ ' + t('bk_r_nokey', { n: s.chain_nokey }));
  if ((s.pair_again || []).length) rep.push('⚠ ' + t('bk_r_pair', { l: s.pair_again.join(', ') }));
  if ((s.password_missing || []).length) rep.push('⚠ ' + t('bk_r_pw', { l: s.password_missing.join(', ') }));
  let box = $('bkrep'); if (!box) { box = el('div', { id: 'bkrep', className: 'bkrep' }); msg.parentNode.after(box); }
  box.innerHTML = rep.map(x => `<div>${esc(x)}</div>`).join(''); box.hidden = !rep.length;
  if (r.restart) { msg.textContent += ' ' + t('bk_reload'); setTimeout(() => location.reload(), rep.length ? 8000 : 2500); return; }
  EVSIG = ''; loadEvents(); plFetch();
}
function buildSources() {
  const body = $('sbody');
  const old = $('srcbox'); if (old) old.remove();
  const fs = el('fieldset', { id: 'srcbox' }); if (DEV) fs.dataset.sec = 'srcbox1';   // beim Gerät: nur seine Karte, standardmäßig offen
  fs.appendChild(el('legend', { textContent: t(DEV ? 'st_dev1' : 's_sources') }));
  const note = el('div', { className: 'srcnote' }); fs.appendChild(note);
  if (!PHONE.tls) note.textContent = t('tls_missing', { e: PHONE.tls_error || '' });
  else if (!PHONE.port) note.textContent = t('port_missing');
  const list = el('div', { id: 'srclist' }); fs.appendChild(list);
  for (const s of SOURCES) if (!DEV || s.id === DEV) list.appendChild(sourceRow(s));
  const add = el('div', { className: 'srcadd' }); add.hidden = !!DEV;
  const b1 = el('button', { textContent: '+ ' + t('add_phone'), className: 'pri' });
  const b2 = el('button', { textContent: '+ ' + t('add_url') });
  b1.onclick = async () => { try { const r = await srcPost({ action: 'add', type: 'phone' }); refreshDevBox(); buildSources(); showQR(r.id); } catch (e) { alert(t('saveerr') + ' ' + e.message); } };
  b2.onclick = async () => { try { await srcPost({ action: 'add', type: 'url' }); refreshDevBox(); buildSources(); } catch (e) { alert(t('saveerr') + ' ' + e.message); } };
  add.appendChild(b1); add.appendChild(b2);
  if (SOURCES.length >= 9) { b1.disabled = b2.disabled = true; }
  if (!PRO.ok) { b1.onclick = b2.onclick = () => proGate('dev'); b1.appendChild(proLockTag()); b2.appendChild(proLockTag()); }
  fs.appendChild(add);
  fs.appendChild(el('small', { className: 'srchelp', textContent: t('src_help') }));
  body.insertBefore(fs, body.firstChild);
  const oc = $('calbox'); if (oc) oc.remove(); if (!DEV) { const au = $('sbody').querySelector(':scope > fieldset[data-sec="s_audio"]'); (au || fs).after(calBox()); }
  fs.insertBefore(qtCard(9), list);
  makeCollapsible();
}
function sourceRow(s) {
  const row = el('div', { className: 'src' }); row.dataset.id = s.id;
  const top = el('div', { className: 'srctop' });
  const dot = el('i', { className: 'dot' });
  const name = el('input', { type: 'text', value: s.name, maxLength: 40, className: 'srcname', title: t('src_name') });
  const kind = el('span', { className: 'srctype', textContent: t('type_' + s.type) });
  const en = el('label', { className: 'srcen' }); const cb = el('input', { type: 'checkbox', checked: !!s.enabled }); en.appendChild(cb); en.appendChild(document.createTextNode(t('src_on')));
  top.append(dot, name, kind, en);
  row.appendChild(top);
  if (s.check) row.appendChild(el('div', { className: 'srccheck', textContent: '⚠ ' + t('src_check') }));   // aus einer Sicherung, war nicht erreichbar
  const sub = el('div', { className: 'srcsub' });
  const gain = el('input', { type: 'number', min: -20, max: 40, step: 0.5, value: s.gain_db || 0, className: 'n', title: t('gain_db') });
  const gl = el('label', { textContent: t('gain_db') + ' ' }); gl.appendChild(gain); sub.appendChild(gl);
  const cs = s.cal_state || {};                   // Stand des Einpegelns
  sub.appendChild(el('small', { className: 'calbadge' + (cs.ok ? ' ok' : cs.changed ? ' warn' : ''), textContent: cs.ok ? t('cal_ok_at', { d: fmtStamp(cs.at) }) + (Date.now() - new Date(cs.at).getTime() > 90 * 864e5 ? ' · ' + t('cal_old') : '') : cs.changed ? t('cal_changed') : t('cal_none') }));
  const hum = el('select', { className: 'humsel', title: t('t_hum') });
  option(hum, '0', t('hum_off')); option(hum, '50', t('hum_50')); option(hum, '60', t('hum_60'));
  hum.value = String(s.hum || 0);
  const hl = el('label', { textContent: t('hum') + ' ' }); hl.appendChild(hum); const hti = tipIcon('t_hum'); if (hti) hl.appendChild(hti); sub.appendChild(hl);
  if (s.hum && s.hum_ok === false) sub.appendChild(el('small', { textContent: t('hum_na') }));
  hum.addEventListener('change', () => upd({ hum: hum.value }));
  { const rl = el('label', { className: 'recolab' }), rc = el('input', { type: 'checkbox', checked: !!s.rec_only });   // nur aufzeichnen, keine Erkennung
    rl.append(rc, ' ⏺ ' + t('rec_only')); rc.onchange = () => upd({ rec_only: rc.checked }); sub.appendChild(rl); sub.appendChild(el('small', { className: 'recoh', textContent: t('h_rec_only') })); }
  {                                                   // Messangaben fürs Lärmprotokoll: Messort, Fenster, Fenstersensor aus Home Assistant
    const ms = el('div', { className: 'srcmeas' }); ms.appendChild(el('small', { className: 'mut srcmh', textContent: t('meas_h') }));
    const pl = el('input', { type: 'text', value: s.place || '', maxLength: 120, placeholder: t('meas_place_ph'), className: 'srcplace' });
    const pll = el('label', { textContent: t('meas_place') + ' ' }); pll.appendChild(pl); ms.appendChild(pll);
    const wi = el('select', { className: 'srcwin' }); for (const [v, k] of [['', 'meas_win_na'], ['closed', 'meas_win_closed'], ['open', 'meas_win_open'], ['mixed', 'meas_win_mixed']]) option(wi, v, t(k)); wi.value = s.window || '';
    const wil = el('label', { textContent: t('meas_win') + ' ' }); wil.appendChild(wi); ms.appendChild(wil);
    const wr = el('select', { className: 'srcwinr' }); option(wr, '', t('meas_wsens_none')); for (const r of (HAR.rules && HAR.rules.length ? HAR.rules : MF.rules).filter(x => x.mode === 'note' && x.id)) option(wr, r.id, r.label || r.name || r.entity || r.id);
    if (s.win_rule && ![...wr.options].some(o => o.value === s.win_rule)) option(wr, s.win_rule, s.win_rule); wr.value = s.win_rule || '';
    const wrl = el('label', { textContent: t('meas_wsens') + ' ' }); wrl.appendChild(wr); ms.appendChild(wrl);
    pl.addEventListener('change', () => upd({ place: pl.value })); wi.onchange = () => upd({ window: wi.value }); wr.onchange = () => upd({ win_rule: wr.value });
    sub.appendChild(ms);
  }
  let url = null, user = null, pass = null;
  if (s.type === 'url') {
    url = el('input', { type: 'url', value: s.url || '', placeholder: 'http://192.168.178.50:8080/audio.wav', className: 'srcurl' });
    sub.appendChild(url);
    if (!PHONE.ffmpeg) sub.appendChild(el('small', { textContent: t('no_ffmpeg') }));
  }
  if (s.type === 'phone') { const q = el('button', { textContent: t('connect_phone') }); q.onclick = () => showQR(s.id); sub.appendChild(q); }
  if (s.type === 'phone' || s.type === 'url') {   // Handy als Bewegungsmelder (Erschütterung, Neigung, Bewegung im Kamerabild) – Browser-Seite oder IP Webcam
    const mb = el('div', { className: 'srcmot' }), M = s.motion || {};
    mb.appendChild(el('b', { textContent: t(s.type === 'url' ? 'mot_title_ipc' : 'mot_title') }));
    const mk = (key, kind) => { const l = el('label'), c = el('input', { type: 'checkbox', checked: !!(M[kind] && M[kind].on) }); l.append(c, ' ' + t(key)); c.onchange = () => upd({ ['motion_' + kind]: c.checked }); return l; };
    mb.append(mk('mot_vib', 'vib'), mk('mot_tilt', 'tilt'), mk('mot_cam', 'cam'));
    const sens = el('select', { className: 'motsens' }); option(sens, 'high', t('mot_s_high')); option(sens, 'mid', t('mot_s_mid')); option(sens, 'low', t('mot_s_low'));
    sens.value = s.motion_sens || 'mid'; sens.onchange = () => upd({ motion_sens: sens.value });
    const sl = el('label', { textContent: t('mot_sens') + ' ' }); sl.appendChild(sens); mb.appendChild(sl);
    mb.appendChild(el('small', { textContent: t(s.type === 'url' ? 'h_mot_ipc' : 'h_mot') }));
    if (s.type === 'url' && s.motion_err) mb.appendChild(el('small', { className: 'moterr', textContent: '⚠ ' + s.motion_err.split(',').map(x => t('mot_err_' + x)).join(' ') }));
    sub.appendChild(mb);
  }
  const ds = el('button', { textContent: '⚙ ' + t('dev_settings') }); ds.onclick = () => { if (DEV !== s.id) setDev(s.id, true); setSTab('det'); }; sub.appendChild(ds);
  if (s.id !== 'main') {
    const del = el('button', { textContent: t('delete'), className: 'danger' });
    del.onclick = async () => { if (!confirm(t('confirm_del', { n: s.name }))) return; try { await srcPost({ action: 'delete', id: s.id }); if (DEV === s.id) { formDirty = false; DEV = ''; } refreshDevBox(); buildSources(); } catch (e) { alert(e.message); } };
    sub.appendChild(del);
  }
  row.appendChild(sub);
  row.appendChild(refEditor(s));
  if (s.type === 'url') {                    // Zugangsdaten (z. B. IP Webcam mit Login)
    const lg = el('div', { className: 'srcsub srclogin' });
    user = el('input', { type: 'text', value: s.user || '', placeholder: t('src_user'), autocomplete: 'off', className: 'srcuser', title: t('src_user') });
    pass = el('input', { type: 'password', value: '', placeholder: s.has_password ? t('src_pass_saved') : t('src_pass'), autocomplete: 'new-password', className: 'srcpass', title: t('src_pass') });
    const eye = el('button', { type: 'button', textContent: '👁', className: 'eye', title: t('src_show') });
    eye.onclick = () => { pass.type = pass.type === 'password' ? 'text' : 'password'; };
    const l1 = el('label', { textContent: t('src_login') + ' ' });
    const pw = el('span', { className: 'srcpw' }); pw.append(pass, eye);   // Auge bleibt immer neben dem Passwortfeld
    lg.append(l1, user, pw);
    row.appendChild(lg);
  }
  let vcb = null, vvw = null, vrot = null, vurl = null, vdir = null, vdelay = null;
  if (s.type === 'url') {                    // Video (z. B. IP Webcam): pro Geraet ein/aus, eigener Pfad
    const vb = el('div', { className: 'srcsub srcvideo' });
    vcb = el('input', { type: 'checkbox', checked: !!s.video });
    const vl = el('label', { className: 'srcen' }); vl.append(vcb, document.createTextNode('🎥 ' + t('vid_rec'))); const vti = tipIcon('t_vid_rec'); if (vti) vl.appendChild(vti);
    vvw = el('input', { type: 'checkbox', checked: s.video_view == null ? !!s.video : !!s.video_view });
    const vw = el('label', { className: 'srcen' }); vw.append(vvw, document.createTextNode('📺 ' + t('vid_view'))); const wti = tipIcon('t_vid_view'); if (wti) vw.appendChild(wti);
    vrot = el('select', { title: t('vid_rot') });
    for (const a of [0, 90, 180, 270]) vrot.appendChild(el('option', { value: a, textContent: a + '°', selected: (s.video_rot || 0) === a }));
    const rl = el('label', { textContent: '⟳ ' + t('vid_rot') + ' ' }); rl.appendChild(vrot);
    vurl = el('input', { type: 'url', value: s.video_url || '', placeholder: t('vid_url_ph'), className: 'srcurl', title: t('vid_url') });
    vdir = el('input', { type: 'text', value: s.video_dir || '', placeholder: t('vid_dir_ph'), className: 'srcurl', title: t('vid_dir') });
    vdelay = el('input', { type: 'number', min: -3000, max: 3000, step: 50, value: s.video_delay_ms || 0, className: 'n', title: t('vid_delay') });
    const dl = el('label', { textContent: t('vid_delay') + ' ' }); dl.appendChild(vdelay); dl.append(' ms'); const dti = tipIcon('t_vid_delay'); if (dti) dl.appendChild(dti);
    vb.append(vw, vl, rl, vurl, vdir, dl);
    row.appendChild(vb);
  }
  // Protokolllisten: in welche Listen dieses Geraet eintraegt, je mit Uhrzeit (leer = immer)
  const plb = el('div', { className: 'srcsub srcpl' });
  const plRules = () => [...plb.querySelectorAll('.plrule')].map(r => ({ id: r.querySelector('select').value, from: r.querySelector('.plf').value, to: r.querySelector('.plt').value })).filter(x => x.id);
  const plDraw = rules => {
    plb.innerHTML = '';
    const lab = el('span', { className: 'srcpll', textContent: t('pl_dev') }); const ti = tipIcon('t_pl_dev'); if (ti) lab.appendChild(ti); plb.appendChild(lab);
    if (!PV.lists.length) { plb.appendChild(el('small', { textContent: t('pl_dev_none') })); return; }
    for (const r of rules) {
      const line = el('span', { className: 'plrule' });
      const sel = el('select', { title: t('pl_list') }); for (const l of PV.lists) sel.appendChild(el('option', { value: l.id, textContent: l.name, selected: l.id === r.id }));
      const f = el('input', { type: 'time', value: r.from || '', className: 'plf', title: t('pl_from') }), to = el('input', { type: 'time', value: r.to || '', className: 'plt', title: t('pl_to') });
      const x = el('button', { type: 'button', className: 'hadel', textContent: '✕', title: t('pl_rule_del') }); x.setAttribute('aria-label', t('pl_rule_del'));
      line.append(sel, f, el('span', { textContent: '–' }), to, x); plb.appendChild(line);
      [sel, f, to].forEach(e => e.addEventListener('change', () => upd({ plists: plRules() })));
      x.onclick = () => { line.remove(); upd({ plists: plRules() }); };
    }
    const add = el('button', { type: 'button', className: 'chip', textContent: '＋ ' + t('pl_rule_add') });
    add.onclick = () => { plDraw(plRules().concat({ id: PV.lists[0].id, from: '', to: '' })); upd({ plists: plRules() }); };
    plb.appendChild(add);
  };
  plDraw(s.plists || []); row.appendChild(plb);
  const stat = el('small', { className: 'srcstat' }); row.appendChild(stat);
  const upd = async (patch) => {
    try {
      const r = await srcPost(Object.assign({ action: 'update', id: s.id }, patch)); flash(row);
      const ns = (r.sources || []).find(x => x.id === s.id);
      if (url && ns && 'url' in patch) url.value = ns.url || '';      // vom Server korrigierte Adresse anzeigen
      if (user && ns && 'user' in patch) user.value = ns.user || '';
      if (pass && ns && ('password' in patch || 'user' in patch || 'url' in patch)) {
        if ('password' in patch) pass.value = '';
        pass.placeholder = ns.has_password ? t('src_pass_saved') : t('src_pass');
      }
    } catch (e) { alert(t('saveerr') + ' ' + e.message); }
  };
  name.addEventListener('change', () => upd({ name: name.value }));
  cb.addEventListener('change', () => upd({ enabled: cb.checked }));
  gain.addEventListener('change', () => upd({ gain_db: gain.value }));
  if (url) url.addEventListener('change', () => upd({ url: url.value }));
  if (vcb) { vcb.addEventListener('change', () => upd({ video: vcb.checked })); vvw.addEventListener('change', () => upd({ video_view: vvw.checked })); vrot.addEventListener('change', () => upd({ video_rot: +vrot.value })); vurl.addEventListener('change', () => upd({ video_url: vurl.value })); vdir.addEventListener('change', () => upd({ video_dir: vdir.value })); vdelay.addEventListener('change', () => upd({ video_delay_ms: vdelay.value })); }
  if (user) user.addEventListener('change', () => upd({ user: user.value }));
  if (pass) pass.addEventListener('change', () => { if (pass.value !== '') upd({ password: pass.value }); });
  paintRow(row, s);
  return row;
}
function refEditor(s) {
  const box = el('details', { className: 'refs' });
  const sum = el('summary', { textContent: '📏 ' + t('refs_title') + ((s.refs || []).length ? ' (' + s.refs.length + ')' : '') });
  box.appendChild(sum);
  const ti = tipIcon('t_refs'); if (ti) box.appendChild(ti);   // Hilfe-Symbol nicht in der Aufklapp-Zeile (sonst verschachtelt bedienbar)
  const list = el('div', { className: 'reflist' }); box.appendChild(list);
  let refs = JSON.parse(JSON.stringify(s.refs || []));
  const save = async () => {
    try { const r = await srcPost({ action: 'update', id: s.id, refs }); const ns = (r.sources || []).find(x => x.id === s.id); refs = JSON.parse(JSON.stringify((ns && ns.refs) || [])); render(); markDirty(); }
    catch (e) { alert(t('saveerr') + ' ' + e.message); }
  };
  const render = () => {
    list.innerHTML = '';
    sum.firstChild.textContent = '📏 ' + t('refs_title') + (refs.length ? ' (' + refs.length + ')' : '');
    refs.forEach((r, i) => {
      const rw = el('div', { className: 'refrow' });
      const lab = el('input', { type: 'text', value: r.label, placeholder: t('refs_label'), maxLength: 30, className: 'reflab' });
      const db = el('input', { type: 'number', value: r.db, step: 0.5, min: -130, max: 0, className: 'n' });
      const col = el('select', { className: 'refcol' });
      REF_COLORS.forEach((cc, k) => { const o = option(col, cc, '●'); o.style.color = cc; });
      col.value = r.color; col.style.color = r.color;
      const del = el('button', { type: 'button', className: 'danger', textContent: '✕', title: t('delete') });
      lab.onchange = () => { r.label = lab.value; save(); };
      db.onchange = () => { r.db = parseFloat(db.value); save(); };
      col.onchange = () => { r.color = col.value; col.style.color = col.value; save(); };
      del.onclick = () => { refs.splice(i, 1); save(); };
      rw.append(lab, db, el('span', { textContent: 'dB' }), col, del); list.appendChild(rw);
    });
    const add = el('div', { className: 'refadd' });
    const b1 = el('button', { type: 'button', textContent: '+ ' + t('refs_add') });
    const b2 = el('button', { type: 'button', textContent: '+ ' + t('refs_add_now'), title: t('refs_add_now_tip') });
    b1.onclick = () => { if (refs.length >= 8) return; refs.push({ label: '', db: -50, color: REF_COLORS[refs.length % REF_COLORS.length] }); save(); };
    b2.onclick = () => {
      if (refs.length >= 8) return;
      const lv = (srcById(s.id) || {}).level; if (lv == null) { alert(t('refs_nolevel')); return; }
      refs.push({ label: t('refs_now_label'), db: Math.round(lv * 2) / 2, color: REF_COLORS[refs.length % REF_COLORS.length] }); save();
    };
    if (refs.length >= 8) b1.disabled = b2.disabled = true;
    add.append(b1, b2); list.appendChild(add);
  };
  render();
  return box;
}
function paintRow(row, s) {
  const [cls, txt] = srcState(s);
  row.querySelector('.dot').className = 'dot ' + cls;
  const lv = s.online && s.level != null ? ' · ' + t('level') + ' ' + f1(s.level) + ' dBFS' : '';
  row.querySelector('.srcstat').textContent = txt + lv + ' · ' + t('src_counts', { d: s.count_today || 0, n: s.count_total || 0 }) + (s.own ? ' · ' + t('own_tag') : '') + (s.video_on ? ' · 🎥 ' + (s.video_sending ? t('vid_sending', { f: s.video_fps }) : (s.video_error || t('vid_wait'))) : '');
}
function refreshSourceRows() {
  for (const s of SOURCES) { const r = document.querySelector(`#srclist .src[data-id="${CSS.escape(s.id)}"]`); if (r) paintRow(r, s); }
}
function flash(row) { row.classList.add('saved'); setTimeout(() => row.classList.remove('saved'), 900); }
async function showQR(id) {
  try {
    const j = await (await fetch('phonelink?id=' + encodeURIComponent(id), { cache: 'no-store' })).json();
    const host = j.ip || location.hostname;
    const box = $('qrbody');
    if (!j.port) { box.innerHTML = `<p class="qwarn">${esc(t('port_missing'))}</p>`; $('qrdlg').showModal(); return; }
    const link = `https://${host}:${j.port}/m/${j.token}`;
    const qr = qrcode(0, 'M'); qr.addData(link); qr.make();
    box.innerHTML = `<h4>${esc(j.name)}</h4><div class="qr">${qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true })}</div>
      <div class="qlink"><input readonly value="${esc(link)}"><button id="qcopy">${esc(t('copy'))}</button></div>
      ${/\.local$/.test(host) ? `<p class="qwarn">${esc(t('mdns_hint'))}</p>` : ''}
      <ol class="qsteps">${t('qr_steps').split('|').map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <p class="qsmall">${esc(t('qr_secret'))} <button id="qrot">${esc(t('new_link'))}</button></p>`;
    $('qcopy').onclick = () => { const i = box.querySelector('input'); i.select(); try { navigator.clipboard.writeText(link); } catch (e) { document.execCommand('copy'); } $('qcopy').textContent = '✓'; };
    $('qrot').onclick = async () => { if (!confirm(t('confirm_rot'))) return; await srcPost({ action: 'token', id }); showQR(id); };
    if (!$('qrdlg').open) $('qrdlg').showModal();
  } catch (e) { alert(t('saveerr')); }
}

let diagT = 0;
async function loadDiag() {
  if ($('diagbox').hidden || !$('diagbox').open || Date.now() - diagT < 5000) return; diagT = Date.now();
  try { const j = await (await fetch('diag', { cache: 'no-store' })).json(); $('diag').textContent = 'v' + j.version + '  ·  ' + t('device') + ': ' + j.settings.device + '  ·  ' + j.settings.sample_rate + ' Hz\n\n' + j.text; } catch (e) { }
}

/* ================= GLighter Pro: Lizenz, Sperren, „Pro kaufen“ ================= */
let PRO = { ok: false, state: 'none', free_import: true, buy: 'https://www.gsimulations.de/gaslighter/#buypro' };
async function proLoad() { try { const j = await (await fetch('pro', { cache: 'no-store' })).json(); if (j && j.state) PRO = j; } catch (e) { } proBanner(); return PRO; }
function proDate(d) { try { return new Date(d + 'T12:00:00').toLocaleDateString(locale()); } catch (e) { return d; } }
function proBuyLink(cls) { const a = el('a', { className: cls || 'chip pri', href: PRO.buy, target: '_blank', rel: 'noopener', textContent: '🛒 ' + t('pro_buy') }); return a; }
/* Hinweis kurz vor Ablauf (14 Tage) bzw. nach Ablauf – einmal je Ablaufdatum wegklickbar */
function proBanner() {
  { const pb = $('fnppop'); if (pb) { const tg = pb.querySelector('.protag'); if (!PRO.ok && !tg) pb.appendChild(proLockTag()); else if (PRO.ok && tg) tg.remove(); } }
  const b = $('b_pro'); if (!b) return;
  let key = '', html = '';
  if (PRO.ok && PRO.days_left != null && PRO.days_left <= 14) { key = 'soon_' + PRO.until; html = t('pro_soon', { d: esc(proDate(PRO.until)), n: PRO.days_left }); }
  else if (PRO.state === 'expired') { key = 'exp_' + PRO.until; html = t('pro_expired_ban', { d: esc(proDate(PRO.until)) }); }
  let gone = false; try { gone = localStorage.getItem('laerm_proban') === key; } catch (e) { }
  if (!key || gone) { b.style.display = 'none'; return; }
  b.innerHTML = html + ` <a href="${esc(PRO.buy)}" target="_blank" rel="noopener">${esc(t('pro_renew'))}</a> ${BX()}`;
  b.style.display = 'block';
  b.querySelector('.bclose').onclick = () => { try { localStorage.setItem('laerm_proban', key); } catch (e) { } b.style.display = 'none'; };
}
/* Kleines Fenster an gesperrten Stellen: was die Funktion kann, „Pro kaufen“, „Schlüssel eintragen“ */
function proGate(feat) {
  let d = $('prognd');
  if (!d) { d = el('dialog', { id: 'prognd', className: 'evdlg prognd' }); document.body.appendChild(d); }
  d.innerHTML = `<h3>🔒 ${esc(t('pro_title'))}</h3><p><b>${esc(t('pro_f_' + feat))}</b></p><p>${esc(t('pro_g_' + feat))}</p><p class="mut">${esc(t('pro_gate_free'))}</p>
    <div class="ntedbtns"><button type="button" class="pgx">${esc(t('a_close'))}</button><button type="button" class="pgkey">🔑 ${esc(t('pro_enter'))}</button></div>`;
  d.querySelector('.ntedbtns').insertBefore(proBuyLink('chip pri'), d.querySelector('.pgkey').nextSibling);
  d.querySelector('.pgx').onclick = () => d.close();
  d.querySelector('.pgkey').onclick = async () => { d.close(); if (!$('dlg').open) await openSettings(); openSec('s_pro'); const k = $('prokey'); if (k) { k.scrollIntoView({ block: 'center' }); k.focus(); } };
  d.showModal();
}
function proLockTag() { const s = el('span', { className: 'protag', textContent: '🔒 Pro' }); s.title = t('pro_title'); return s; }
/* Einstellungen → Allgemein → Pro */
/* Tägliche Sicherung ins Ziel (Netzlaufwerk/NAS/USB): Stand und „Jetzt sichern“ */
/* GReport (eigene App für Notizen): erkannt? Mit Pro erscheinen ihre Notizen hier mit */
function grBox() {
  const fs = el('fieldset', { id: 'grbox', className: 'ff' }); fs.dataset.sec = 's_greport';
  fs.appendChild(el('legend', { textContent: t('s_greport') }));
  const st = el('div', { className: 'grst' }); fs.appendChild(st);
  fs.appendChild(el('small', { className: 'schedhelp', textContent: t('h_greport') }));
  (async () => {
    let j = {}; try { j = await (await fetch('greport', { cache: 'no-store' })).json(); } catch (e) { }
    st.innerHTML = '';
    if (!j.found) st.textContent = t('gr_nf');
    else if (!j.pro) { st.append(proLockTag(), document.createTextNode(' ' + t('gr_found_nopro'))); }
    else if (j.shared === false) st.textContent = t('gr_unshared');
    else st.textContent = '✓ ' + t('gr_linked', { n: j.n || 0, v: j.v || '' }) + (j.running ? '' : ' · ' + t('gr_not_running'));
  })();
  return fs;
}
function mirrorBox() {
  const b = el('div', { className: 'mirrorbox', id: 'mirrorbox' });
  const show = m => {
    m = m || {}; const L = locale(), when = x => x ? new Date(x * 1000).toLocaleString(L, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–';
    const st = !PRO.ok ? t(CUR && CUR.mirror_dir ? 'mir_pro_off' : 'mir_pro') : !CUR || !CUR.mirror_dir ? t('mir_none') : m.running ? '⏳ ' + t('mir_running') : m.ok === false ? '⚠ ' + t('mir_err', { e: m.error || '' }) : m.ok ? '✓ ' + t('mir_ok', { a: when(m.last), n: m.files || 0, c: m.copied || 0 }) : t('mir_wait');
    b.innerHTML = `<div class="${m.ok === false ? 'bad' : ''}">${esc(st)}</div>${m.next ? `<small>${esc(t('mir_next', { a: when(m.next) }))}</small>` : ''}${m.offloaded ? `<small>${esc(t('mir_off', { n: m.offloaded }))}</small>` : ''}
      <button type="button" class="chip" id="mirnow"${!PRO.ok || !CUR || !CUR.mirror_dir || m.running ? ' disabled' : ''}>💾 ${esc(t('mir_now'))}</button>`;
    const nb = b.querySelector('#mirnow'); nb.onclick = async () => {
      nb.disabled = true;
      try { const r = await (await fetch('mirror_now', { method: 'POST' })).json(); if (!r.ok) { show(Object.assign({}, m, r.mirror || {}, { ok: false, error: r.error })); return; } } catch (e) { toast(t('saveerr')); }
      poll();
    };
  };
  let n = 0; const poll = async () => { if (n && (!b.isConnected || !$('dlg').open)) return; try { const r = await (await fetch('mirror_state', { method: 'POST' })).json(); show(r.mirror); if (r.mirror && r.mirror.running && n++ < 600) setTimeout(poll, 2000); } catch (e) { } };
  show(MIRROR_ST); poll();
  return b;
}
function proBox() {
  const fs = el('fieldset', { id: 'probox' }); fs.dataset.sec = 's_pro';
  fs.appendChild(el('legend', { textContent: t('s_pro') }));
  const st = el('div', { className: 'prost' }); fs.appendChild(st);
  const P = PRO;
  if (P.ok) st.innerHTML = `<b class="prook">✔ ${esc(t('pro_active', { d: proDate(P.until) }))}</b>` + (P.order ? `<small>${esc(t('pro_order', { o: P.order }))}${P.key_hint ? ' · ' + esc(P.key_hint) : ''}</small>` : '');
  else if (P.state === 'expired') st.innerHTML = `<b class="proexp">⚠ ${esc(t('pro_expired', { d: proDate(P.until) }))}</b>`;
  else st.innerHTML = `<b>${esc(t('pro_free'))}</b>`;
  const ul = el('ul', { className: 'prolist' });
  for (const f of ['imp', 'thr', 'dev', 'pop']) ul.appendChild(el('li', { textContent: (P.ok ? '✔ ' : '🔒 ') + t('pro_f_' + f) }));
  fs.appendChild(ul);
  fs.appendChild(el('small', { className: 'prohelp', textContent: t('h_pro') + (!P.ok && P.free_import ? ' ' + t('pro_free_import') : '') }));
  const row = el('div', { className: 'bkrow prorow' });
  if (P.ok) {
    const del = el('button', { type: 'button', className: 'chip', textContent: t('pro_remove') });
    del.onclick = async () => { if (!confirm(t('pro_remove_q'))) return; try { const j = await (await fetch('pro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"del"}' })).json(); PRO = j.pro || PRO; } catch (e) { } proRefresh(); };
    row.append(del, proBuyLink('chip'));
    fs.appendChild(row);
  } else {
    const ta = el('textarea', { id: 'prokey', className: 'prokey', rows: 3, placeholder: 'GL1-XXXXX-XXXXX-…', spellcheck: false });
    ta.setAttribute('autocomplete', 'off');
    const go = el('button', { type: 'button', className: 'pri', textContent: '🔑 ' + t('pro_activate') });
    const msg = el('span', { className: 'bkmsg', id: 'promsg' }); msg.setAttribute('aria-live', 'polite');
    go.onclick = async () => {
      const key = ta.value.trim(); if (!key) { ta.focus(); return; }
      go.disabled = true; msg.textContent = '';
      try {
        const j = await (await fetch('pro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })).json();
        if (j.ok) { PRO = j.pro; proRefresh(); return; }
        msg.textContent = '⚠ ' + t('pro_err_' + (['expired', 'signature', 'product', 'format', 'empty', 'offline', 'server', 'disabled', 'zu_oft', 'invalid'].includes(j.error) ? j.error : 'format'));
      } catch (e) { msg.textContent = '⚠ ' + t('saveerr'); }
      go.disabled = false;
    };
    fs.appendChild(ta);
    row.append(go, proBuyLink('chip'), msg); fs.appendChild(row);
  }
  return fs;
}
/* Nach Eintragen/Entfernen: Formular neu aufbauen (Sperren an/aus), Pro-Bereich offen lassen */
function proRefresh() {
  proBanner();
  if (!$('dlg').open) return;
  const body = $('sbody'), sc = body.scrollTop;
  buildForm(CUR); buildSources(); applySTab(); openSec('s_pro'); body.scrollTop = sc;
}
/* Ohne Pro: Erweiterte Einstellungen der Erkennung nur ansehen */
function proApplyForm() {
  { const mf = $('sbody').querySelector('fieldset[data-sec="s_mirror"]');      // tägliche Sicherung / Platz sparen: Pro
    if (mf) { mf.classList.toggle('prolocked', !PRO.ok); const o = mf.querySelector('.proban'); if (o) o.remove();
      if (!PRO.ok) { mf.querySelectorAll('input,select,textarea,button').forEach(x => { x.disabled = true; });
        const ban = el('div', { className: 'proban' }); ban.append(proLockTag(), el('span', { textContent: ' ' + t('pro_mir_ban') + ' ' }));
        const more = el('button', { type: 'button', className: 'chip', textContent: t('pro_more') }); more.onclick = () => proGate('mir'); ban.append(more);
        const lg = mf.querySelector(':scope > legend'); if (lg) lg.after(ban); else mf.prepend(ban);
        if (lg && !lg.querySelector('.protag')) lg.appendChild(proLockTag()); } } }
  const fs = $('sbody').querySelector('fieldset[data-sec="s_thr"]'); if (!fs) return;
  fs.classList.toggle('prolocked', !PRO.ok);
  const old = fs.querySelector('.proban'); if (old) old.remove();
  if (PRO.ok) return;
  fs.querySelectorAll('input,select,textarea').forEach(x => { x.disabled = true; });
  const ban = el('div', { className: 'proban' });
  ban.append(proLockTag(), el('span', { textContent: ' ' + t('pro_thr_ban') + ' ' }));
  const more = el('button', { type: 'button', className: 'chip', textContent: t('pro_more') }); more.onclick = () => proGate('thr');
  ban.append(more);
  const lg = fs.querySelector(':scope > legend'); if (lg) lg.after(ban); else fs.prepend(ban);
  if (lg && !lg.querySelector('.protag')) lg.appendChild(proLockTag());
}
/* ================= Einstellungen ================= */
const BG_STATS = ['quiet', 'median', 'min', 'mean', 'max'];   // So wird „normal“ berechnet
const FORM = [
  ['s_time', [['active_from', 'time'], ['active_to', 'time']]],
  ['s_audio', [['device', 'device'], ['mic_port', 'port'], ['mic_volume', 'range', 0, 400, 1], ['sample_rate', 'sel', [16000, 22050, 44100, 48000]]]],
  ['s_thr', [
    ['thr_mode', 'sel', ['bounded', 'dynamic', 'fixed'], { bounded: 'o_bounded', dynamic: 'o_dynamic', fixed: 'o_fixed' }],
    ['thr_fixed_db', 'num', -120, 0, 0.1, null, ['fixed']],
    ['offset_db', 'num', 0.5, 40, 0.1, null, ['dynamic', 'bounded']],
    ['min_db', 'num', -120, -10, 0.1, null, ['bounded']],
    ['thr_max_db', 'num', -120, 0, 0.1, null, ['bounded']],
    ['bg_window', 'window', 1, 3600, 1, null, ['dynamic', 'bounded']],
    ['bg_stat', 'sel', BG_STATS, { quiet: 'o_quiet', median: 'o_median', min: 'o_min', mean: 'o_mean', max: 'o_max' }, null, null, ['dynamic', 'bounded']],
    ['rise_s', 'num', 0.5, 3600, 0.5, null, ['dynamic', 'bounded']],
    ['fall_s', 'num', 0.5, 3600, 0.5, null, ['dynamic', 'bounded']],
    ['min_event_ms', 'num', 0, 2000, 20], ['short_ms', 'num', 0, 500, 10], ['short_over_db', 'num', 0, 30, 0.5], ['sus_on', 'chk'], ['sus_s', 'num', 5, 600, 5, 'sus_on'], ['sus_over_db', 'num', 1, 30, 0.5, 'sus_on'], ['sus_max_db', 'num', 5, 60, 1, 'sus_on']]],
  ['s_ki', [['classify', 'chk'], ['ki_min', 'num', 5, 90, 1, 'classify'], ['ki_bg', 'chk', 'classify'], ['ki_short', 'chk', 'classify'], ['ki_short_ms', 'num', 20, 1000, 10, 'ki_short'], ['ki_damp', 'text', 'classify'], ['ki_learn_fix', 'chk', 'classify'], ['ki_learn_min', 'num', 60, 98, 1, 'ki_learn_fix'], ['ki_notes', 'chk'], ['ki_embed', 'chk'], ['fp_store', 'chk']]],
  ['s_quiet', [['quiet_from', 'time'], ['quiet_to', 'time'], ['quiet_sunday', 'chk']]],
  ['s_rec', [['ctx_s', 'num', 0, 120, 1], ['day_layers', 'chk'], ['day_spec', 'chk'], ['co_record', 'chk']]],
  ['s_wav', [['save_audio', 'chk'], ['audio_novoice', 'chk', 'save_audio'], ['pre_roll_s', 'num', 0, 30, 0.1, 'save_audio'], ['post_roll_s', 'num', 0.1, 60, 0.1, 'save_audio'], ['max_clip_s', 'num', 1, 300, 0.5, 'save_audio']]],
  ['s_video', [['video_width', 'num', 0, 3840, 10], ['video_fps', 'num', 1, 30, 1], ['video_crf', 'num', 18, 40, 1]]],
  ['s_place', [['clip_dir', 'text']]],
  ['s_keep', [['auto_delete', 'chk'], ['retention_days', 'num', 1, 3650, 1]]],
  ['s_mirror', [['mirror_dir', 'text'], ['mirror_time', 'time'], ['mirror_offload', 'chk']]],
  ['s_misc', [['language', 'sel', ['auto', 'de', 'en'], { auto: 'lauto', de: '#Deutsch', en: '#English' }], ['wheel_zoom', 'sel', ['ctrl', 'always'], { ctrl: 'wz_ctrl', always: 'wz_always' }], ['auto_thr', 'sel', ['thr', 'data'], { thr: 'at_thr', data: 'at_data' }], ['tip_mode', 'sel', ['hover', 'always', 'off'], { hover: 'tm_hover', always: 'tm_always', off: 'tm_off' }]]],
  ['s_list', [['fn_pick', 'sel', ['peak', 'near'], { peak: 'fnp_peak', near: 'fnp_near' }], ['group_pause_s', 'num', 10, 3600, 10], ['grp_tail_s', 'num', 0, 3600, 10], ['grp_mix', 'chk'], ['fn_grp', 'chk'], ['fn_pre_min', 'num', 0, 120, 1], ['fn_post_min', 'num', 0, 120, 1], ['fn_gr_pre_min', 'num', 0, 120, 1], ['fn_gr_post_min', 'num', 0, 120, 1]]],
];
/* Reihenfolge der Kästen je Reiter (nach dem, was man tun will) */
const SEC_ORDER = ['srcbox', 's_audio', 's_cal', 's_thr', 's_ki', 's_prof', 's_muster', 's_time', 's_quiet', 's_sched', 's_ha',
  's_rec', 's_wav', 's_video', 's_place', 's_keep', 's_backup', 's_mirror', 's_misc', 's_list', 's_pro', 's_reset', 's_diag'];
function secOrder(body) {
  for (const k of SEC_ORDER) { const f = body.querySelector(`:scope > fieldset[data-sec="${k}"], :scope > fieldset#${k}`); if (f) body.appendChild(f); }
  body.querySelectorAll(':scope > fieldset').forEach(f => { const k = f.dataset.sec || f.id; if (k && !SEC_ORDER.includes(k) && k !== 'devbox') body.appendChild(f); });
  for (const k of SEC_ORDER) { const f = body.querySelector(`:scope > fieldset[data-sec="${k}"], :scope > fieldset#${k}`); if (!f || f.querySelector(':scope > .secintro')) continue;   // eine Zeile in einfachen Worten: wofür ist dieser Kasten?
    const s0 = t('si_' + k); if (s0 === 'si_' + k) continue; const lg = f.querySelector(':scope > legend'); const p = el('p', { className: 'secintro', textContent: s0 }); if (lg) lg.after(p); else f.prepend(p); }
}
let SRC = [], SRC_DET = [], DEF_SRC = '';
function portsFor(dev) {
  const name = !dev || dev === 'default' || dev === 'pulse' ? DEF_SRC : dev;
  const d = SRC_DET.find(x => x.name === name);
  return d ? d.ports : [];
}
function fillPorts(sel, dev, val) {
  sel.innerHTML = ''; option(sel, '', t('port_auto'));
  const ps = portsFor(dev);
  for (const p of ps) option(sel, p.name, p.desc + (p.avail ? '' : ' (' + t('port_na') + ')'));
  if (val && !ps.some(p => p.name === val)) option(sel, val, val);
  sel.value = val || '';
  const row = sel.closest('.f'); if (row) row.classList.toggle('hide', ps.length < 2 && !val);
}
/* Pro Geraet einstellbare Werte (wie PER_KEYS im Server) */
const PER = ['thr_mode', 'offset_db', 'thr_fixed_db', 'min_db', 'thr_max_db', 'bg_window', 'bg_unit', 'bg_stat', 'rise_s', 'fall_s',
  'min_event_ms', 'short_ms', 'short_over_db', 'sus_on', 'sus_s', 'sus_over_db', 'sus_max_db', 'pre_roll_s', 'post_roll_s', 'max_clip_s', 'active_from', 'active_to', 'save_audio', 'audio_novoice', 'day_track', 'day_layers', 'day_spec', 'fp_store'];
const GLOBAL_ONLY = ['mirror_dir', 'mirror_time', 'mirror_offload', 'retention_days', 'auto_delete', 'classify', 'ki_min', 'ki_bg', 'ki_short', 'ki_short_ms', 'ki_damp', 'ki_learn_fix', 'ki_learn_min', 'ki_embed', 'ctx_s', 'co_record', 'group_pause_s', 'fn_pre_min', 'fn_post_min', 'fn_gr_pre_min', 'fn_gr_post_min', 'clip_dir', 'video_width', 'video_fps', 'video_crf', 'quiet_from', 'quiet_to', 'quiet_sunday'];
let DEV = '';                                  // '' = Alle Geraete (Standard), sonst Quellen-ID
function srcById(id) { return SOURCES.find(s => s.id === id); }
/* Geräte zum Ansehen: eingerichtete und ehemalige (Daten vorhanden, Gerät nicht mehr eingerichtet, z. B. nach dem Einspielen) */
let FORMER = [];
function viewSources() { return SOURCES.concat(FORMER); }
function viewName(id) { const s = viewSources().find(x => x.id === id); return s ? s.name + (s.former ? ' (' + t('src_former') + ')' : '') : id; }
function effCfg(id) { const s = id && srcById(id); return s && s.own && s.cfg ? Object.assign({}, CUR || {}, s.cfg) : (CUR || {}); }
let formDirty = false;
function liveCfg(id) {                           // gerade gueltige Werte inkl. aktivem Zeitprofil (fuer die Statuskarte)
  const s = id && srcById(id), base = effCfg(id), slots = s && s.own ? (s.sched || []) : SCHED;
  const hit = slots.find(slotActive);
  return hit ? Object.assign({}, base, hit.cfg) : base;
}
function setDev(id, scroll) {
  if (formDirty && (id || '') !== DEV && !confirm(t('dev_discard'))) return;
  formDirty = false;
  DEV = id || '';
  const body = $('sbody'), sc = body.scrollTop;
  buildForm(CUR); buildSources();
  if (DEV && selSrc !== DEV && srcById(DEV)) selectSource(DEV);   // Live-Pegel oben zeigt dieses Geraet
  if (scroll) body.scrollTop = 0; else body.scrollTop = sc;
}
/* Oben in den Einstellungen: Auswahl „Allgemein (alle Geräte)“ oder ein Gerät; darunter die Reiter dafür */
function devBox() {
  const bar = $('sdev'); bar.innerHTML = '';
  const chips = el('div', { className: 'sdevchips', id: 'devsel' }); chips.setAttribute('role', 'tablist');
  const chip = (id, label) => { const b = el('button', { type: 'button', className: 'chip sdevc' + (DEV === id ? ' cur' : ''), textContent: label }); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(DEV === id)); b.onclick = () => { if (DEV !== id) setDev(id); }; chips.appendChild(b); };
  chip('', '⚙ ' + t('dev_gen'));
  for (const s of SOURCES) chip(s.id, (SRC_ICON[s.type] || '') + ' ' + s.name + (s.own ? ' · ' + t('own_short') : ''));
  const crow = el('div', { className: 'sdevrow' }); crow.appendChild(chips);
  const ti = tipIcon('t_dev'); if (ti) crow.appendChild(ti);   // Hilfe-Symbol neben (nicht in) der Reiterleiste
  bar.appendChild(crow);
  requestAnimationFrame(() => { const c = chips.querySelector('.cur'); if (c && chips.scrollWidth > chips.clientWidth) chips.scrollLeft = c.offsetLeft - chips.offsetLeft - 8; });   // Handy: gewähltes Gerät sichtbar
  if (DEV) {
    const s = srcById(DEV), r2 = el('div', { className: 'sdevown' });
    const cb = el('input', { type: 'checkbox', id: 'devown', checked: !!(s && s.own) });
    const ol = el('label', { htmlFor: 'devown', textContent: ' ' + t('f_devown') }); ol.prepend(cb); const oti = tipIcon('t_devown'); if (oti) ol.appendChild(oti);
    const hint = el('small', { id: 'devhint', textContent: t(cb.checked ? 'h_devown_on' : 'h_devown_off') });
    r2.append(ol, hint); bar.appendChild(r2);
    cb.onchange = () => {
      formDirty = true;
      hint.textContent = t(cb.checked ? 'h_devown_on' : 'h_devown_off');
      const sd = srcById(DEV);
      if (!cb.checked) setVals(CUR);                 // zeigt wieder die allgemeinen Werte
      else if (sd && sd.cfg) setVals(Object.assign({}, CUR, sd.cfg));   // gespeicherte Geraete-Werte zurueckholen
      renderSched();
      applyDevState();
    };
  } else bar.appendChild(el('small', { className: 'sdevhint', textContent: t('h_dev') }));
  syncSTabs();
}
/* Reiter je Auswahl: beim Gerät ohne „Allgemein“, „Geräte“ heißt dann „Gerät“ */
function syncSTabs() {
  const b = $('stabs'); if (!b) return;
  b.querySelectorAll('.stab').forEach(x => { if (x.dataset.tab === 'gen') x.hidden = !!DEV; if (x.dataset.tab === 'dev') x.textContent = t(DEV ? 'st_dev1' : 'st_dev'); });
  if (DEV && STAB === 'gen') setSTab('dev', true);
}
/* KI einlernen: Profile aufnehmen und verwalten (öffnet das Fenster „Profile“) */
function profBox() {
  const fs = el('fieldset', { id: 'pfbox' }); fs.dataset.sec = 's_prof';
  const lg = el('legend', { textContent: t('s_prof') }); const ti = tipIcon('t_prof'); if (ti) lg.appendChild(ti); fs.appendChild(lg);
  fs.appendChild(el('small', { className: 'calhelp', textContent: t('h_prof') }));
  const r = el('div', { className: 'calrow' });
  const b1 = el('button', { type: 'button', className: 'pri', textContent: '🧩 ' + t('pf_teach_btn') }), b2 = el('button', { type: 'button', textContent: t('s_prof_list') });
  b1.onclick = () => pfOpen('teach'); b2.onclick = () => pfOpen('list');
  r.append(b1, b2); fs.appendChild(r);
  return fs;
}
/* ---------- Zeitprofile ---------- */
let SCHED = [];                                  // allgemeine Zeitprofile (vom Server)
const SLOT_FIELDS = [['offset_db', 0.5, 40, 0.1, ['dynamic', 'bounded']], ['min_db', -120, -10, 0.1, ['bounded']], ['thr_max_db', -120, 0, 0.1, ['bounded']],
  ['thr_fixed_db', -120, 0, 0.1, ['fixed']], ['min_event_ms', 0, 2000, 20, null]];
function slotActive(sl) {
  const p = x => { const m = /^(\d{1,2}):(\d{2})$/.exec(x || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  const a = p(sl.from), b = p(sl.to), n = new Date(), m = n.getHours() * 60 + n.getMinutes();
  if (a == null || b == null || a === b) return false;
  return a < b ? (a <= m && m < b) : (m >= a || m < b);
}
function scopeSlots() {
  if (!DEV) return SCHED;
  const s = srcById(DEV), own = $('devown') ? $('devown').checked : !!(s && s.own);
  if (!own) return SCHED;
  return (s && s.own && s.sched) ? s.sched : (s && s.sched && s.sched.length ? s.sched : JSON.parse(JSON.stringify(SCHED)));
}
function slotRow(sl) {
  const box = el('div', { className: 'slot' });
  const r1 = el('div', { className: 'slotrow' });
  const fr = el('input', { type: 'time', value: sl.from || '22:00' }); fr.dataset.k = 'from';
  const to = el('input', { type: 'time', value: sl.to || '06:00' }); to.dataset.k = 'to';
  const md = el('select'); md.dataset.k = 'thr_mode';
  for (const m of ['bounded', 'dynamic', 'fixed']) option(md, m, t('o_' + m));
  const base = Object.assign({}, DEV ? effCfg(DEV) : CUR, sl.cfg || {});
  md.value = base.thr_mode;
  const del = el('button', { type: 'button', className: 'danger', textContent: '✕', title: t('delete') });
  del.onclick = () => { box.remove(); formDirty = true; markSlots(); };
  const act = el('span', { className: 'slotnow', textContent: t('slot_now') });
  r1.append(el('span', { textContent: t('from') }), fr, el('span', { textContent: t('to') }), to, md, act, del);
  const r2 = el('div', { className: 'slotrow' });
  for (const [k, lo, hi, step, modes] of SLOT_FIELDS) {
    const lab = el('label', { className: 'slotf' }); if (modes) lab.dataset.modes = modes.join(',');
    const inp = el('input', { type: 'number', min: lo, max: hi, step, value: base[k], className: 'n' }); inp.dataset.k = k;
    lab.append(el('small', { textContent: t('f_' + k) }), inp); r2.appendChild(lab);
  }
  const bl = el('label', { className: 'slotf' }); bl.dataset.modes = 'dynamic,bounded';   // So wird „normal“ berechnet (auch je Uhrzeit)
  const bs = el('select'); bs.dataset.k = 'bg_stat';
  for (const m of BG_STATS) option(bs, m, t('o_' + m));
  bs.value = base.bg_stat || 'quiet';
  bl.append(el('small', { textContent: t('f_bg_stat') }), bs); r2.appendChild(bl);
  box.append(r1, r2);
  const sync = () => { const m = md.value; r2.querySelectorAll('.slotf[data-modes]').forEach(l => l.classList.toggle('hide', !l.dataset.modes.split(',').includes(m))); markSlots(); };
  md.addEventListener('change', sync); fr.addEventListener('change', markSlots); to.addEventListener('change', markSlots);
  box.querySelectorAll('input,select').forEach(e => { e.addEventListener('input', () => { formDirty = true; }); e.addEventListener('change', () => { formDirty = true; }); });
  sync();
  return box;
}
function readSlots() {
  return [...document.querySelectorAll('#slotlist .slot')].map(b => {
    const g = k => b.querySelector(`[data-k="${k}"]`).value, cfg = { thr_mode: g('thr_mode') };
    for (const [k] of SLOT_FIELDS) cfg[k] = g(k);
    cfg.bg_stat = g('bg_stat');
    return { from: g('from'), to: g('to'), cfg };
  });
}
function markSlots() {                           // "jetzt aktiv" am ersten passenden Profil
  let found = false;
  document.querySelectorAll('#slotlist .slot').forEach(b => {
    const on = !found && slotActive({ from: b.querySelector('[data-k=from]').value, to: b.querySelector('[data-k=to]').value });
    if (on) found = true; b.classList.toggle('now', on);
  });
}
function schedBox() {
  const fs = el('fieldset', { id: 'schedbox', className: 'ff' }); fs.dataset.sec = 's_sched';
  const lg = el('legend', { textContent: t('s_sched') }); const sti = tipIcon('t_sched'); if (sti) lg.appendChild(sti); fs.appendChild(lg);
  fs.appendChild(el('small', { className: 'schedhelp', textContent: t('h_sched') }));
  const list = el('div', { id: 'slotlist' }); fs.appendChild(list);
  for (const sl of scopeSlots()) list.appendChild(slotRow(sl));
  const add = el('button', { type: 'button', id: 'slotadd', textContent: '+ ' + t('slot_add') });
  add.onclick = () => {
    if (list.children.length >= 12) return;
    const v = formValues(), cfg = {}; cfg.thr_mode = v.thr_mode; for (const [k] of SLOT_FIELDS) cfg[k] = v[k]; cfg.bg_stat = v.bg_stat;
    list.appendChild(slotRow({ from: '22:00', to: '06:00', cfg })); formDirty = true; markSlots();
  };
  fs.appendChild(add);
  setTimeout(markSlots, 0);
  return fs;
}
function renderSched() {
  const old = $('schedbox'); if (!old) return;
  const nb = schedBox(); old.replaceWith(nb); applyDevState();
}
function refreshDevBox() {                       // Geraeteliste neu (nach Hinzufuegen/Loeschen), Formular bleibt
  if (!$('sdev')) return;
  if (DEV && !srcById(DEV)) { setDev(''); return; }
  devBox();
}
function setVals(obj) {
  for (const k of PER) {
    const e = $('in_' + k); if (!e || obj[k] === undefined) continue;
    if (e.type === 'checkbox') e.checked = !!obj[k]; else e.value = obj[k];
    e.dispatchEvent(new Event('input'));
  }
  syncModeRows(); syncAudioRows();
}
/* Echter Ton: Stimm-Sicherung bleibt immer sichtbar (wie „Löschen nach (Tagen)“), der Hinweis sagt, wann sie wirkt */
function syncAudioRows() {                       // Vor-/Nachlauf, Länge, Mitspeichern und Stimm-Sicherung nur bei echtem Ton
  document.querySelectorAll('#sbody .f[data-need]').forEach(r => { const c = $('in_' + r.dataset.need); r.classList.toggle('needhide', !!c && !c.checked); });
}
function applyDevState() {
  const own = !!(DEV && $('devown') && $('devown').checked);
  document.querySelectorAll('#sbody fieldset.ff').forEach(fs => {
    const sec = fs.dataset.sec;
    fs.classList.toggle('devhide', !!DEV && (['s_misc', 's_list', 's_mirror', 's_video', 's_place', 's_keep', 's_quiet', 's_ki'].includes(sec) || (sec === 's_audio' && DEV !== 'main')));
    fs.querySelectorAll('.f[data-key]').forEach(r => {
      const k = r.dataset.key, per = PER.includes(k);
      r.classList.toggle('devhide', !!DEV && GLOBAL_ONLY.includes(k));
      r.classList.toggle('inherit', !!DEV && per && !own);
      r.querySelectorAll('input,select').forEach(i => { i.disabled = !!DEV && per && !own; });
    });
  });
  const sb = $('schedbox');
  if (sb) { const inh = !!DEV && !own; sb.classList.toggle('inherit', inh); sb.querySelectorAll('input,select,button').forEach(i => { i.disabled = inh; }); }
}
/* Hilfe: ⓘ-Hinweise mit Erklaerung (Maus drueber, antippen oder Tab). Abschaltbar, gilt pro Browser. */
function tipIcon(key) {
  const txt = t(key); if (!txt || txt === key) return null;
  const i = el('span', { className: 'tipi', textContent: 'ⓘ', tabIndex: 0 }); i.setAttribute('role', 'button'); i.setAttribute('aria-label', txt);
  i.dataset.tip = txt;
  return i;
}
function showTip(i) {
  const b = $('tipbox'), dlg = $('dlg'); b.textContent = i.dataset.tip; b.classList.add('on');
  const r = i.getBoundingClientRect(), dr = dlg.getBoundingClientRect(), w = Math.min(340, dr.width - 24);
  b.style.width = w + 'px';
  let x = r.left - dr.left - 20; x = Math.max(12, Math.min(x, dr.width - w - 12));
  let y = r.bottom - dr.top + 6; if (y + b.offsetHeight > dr.height - 8) y = r.top - dr.top - b.offsetHeight - 6;
  b.style.left = x + 'px'; b.style.top = Math.max(8, y) + 'px'; if (TIP !== i) TIP_T = Date.now(); TIP = i;
}
let TIP = null, TIP_T = 0;
function hideTip() { $('tipbox').classList.remove('on'); TIP = null; }
function initHelp() {
  let on = true; try { on = localStorage.getItem('laerm_help') !== '0'; } catch (e) { }
  const cb = $('helpon'); cb.checked = on; $('dlg').classList.toggle('nohelp', !on);
  cb.addEventListener('change', () => { $('dlg').classList.toggle('nohelp', !cb.checked); hideTip(); setTimeout(qtRefresh, 0); try { localStorage.setItem('laerm_help', cb.checked ? '1' : '0'); } catch (e) { } });
  $('helptg').title = t('help_tip');
  const dlg = $('dlg');
  dlg.addEventListener('pointerover', e => { if (e.pointerType !== 'mouse') return; const i = e.target.closest && e.target.closest('.tipi'); if (i) showTip(i); });
  dlg.addEventListener('pointerout', e => { if (e.pointerType !== 'mouse') return; const i = e.target.closest && e.target.closest('.tipi'); if (i && TIP === i) hideTip(); });
  dlg.addEventListener('click', e => { const i = e.target.closest && e.target.closest('.tipi'); if (i) { e.preventDefault(); if (TIP === i && Date.now() - TIP_T > 500) hideTip(); else showTip(i); } else if (TIP) hideTip(); });   // Antippen: erst zeigen, zweites Tippen schliesst
  dlg.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('tipi')) showTip(e.target); });
  dlg.addEventListener('focusout', e => { if (e.target.classList && e.target.classList.contains('tipi')) hideTip(); });
  $('sbody').addEventListener('scroll', hideTip);
}
function el(tag, props) { const e = document.createElement(tag); Object.assign(e, props || {}); return e; }
function option(sel, v, label) { const o = el('option', { value: String(v), textContent: label }); sel.appendChild(o); return o; }
function buildForm(base) { FVC = null;
  const body = $('sbody'); body.innerHTML = '';
  if (DEV && !srcById(DEV)) DEV = '';
  const cur = DEV ? effCfg(DEV) : base;
  devBox();
  for (const [sec, fields] of FORM) {
    const fs = el('fieldset', { className: 'ff' }); fs.dataset.sec = sec; fs.appendChild(el('legend', { textContent: t(sec) }));
    if (sec === 's_wav') fs.appendChild(el('div', { className: 'wavwarn', textContent: t('h_wav') }));   // warum man das ausgeschaltet lassen sollte
    for (const fd of fields) {
      const [k, type] = fd, row = el('div', { className: 'f' }), ctl = el('div', { className: 'ctl' });
      row.dataset.key = k;
      const modes = type === 'sel' ? fd[6] : fd[6];
      if (modes) row.dataset.modes = modes.join(',');
      const need = type === 'chk' ? fd[2] : type === 'num' ? fd[5] : null;      // nur sichtbar, wenn dieser Schalter an ist (z. B. echter Ton)
      if (typeof need === 'string') row.dataset.need = need;
      let inp;
      if (type === 'device') {
        inp = el('select');
        option(inp, 'default', t('dflt'));
        SRC.forEach(s => option(inp, s.name, s.name + (s.state ? ' (' + s.state + ')' : '')));
        if (![...inp.options].some(o => o.value === cur[k])) option(inp, cur[k], cur[k]);
        option(inp, '__custom', t('custom'));
        inp.value = cur[k];
        inp.addEventListener('change', () => {
          if (inp.value !== '__custom') return;
          const v = prompt(t('custom_prompt'), cur[k]);
          if (v && v.trim()) { const o = el('option', { value: v.trim(), textContent: v.trim() }); inp.insertBefore(o, inp.lastChild); inp.value = v.trim(); }
          else inp.value = cur[k];
        });
        ctl.appendChild(inp);
      } else if (type === 'port') {             // Buchse der Soundkarte (nur wenn es mehrere gibt)
        inp = el('select'); ctl.appendChild(inp);
        fillPorts(inp, cur.device, cur[k]);
      } else if (type === 'range') {
        const rg = el('input', { type: 'range', min: fd[2], max: fd[3], step: fd[4], value: cur[k] }); rg.setAttribute('aria-label', t('f_' + k));
        inp = el('input', { type: 'number', min: fd[2], max: fd[3], step: fd[4], value: cur[k], className: 'n' });
        rg.addEventListener('input', () => { inp.value = rg.value; });
        inp.addEventListener('input', () => { rg.value = inp.value; });
        ctl.appendChild(rg); ctl.appendChild(inp); ctl.appendChild(el('span', { textContent: '%' }));
      } else if (type === 'sel') {
        inp = el('select');
        for (const v of fd[2]) { const lk = fd[3] && fd[3][v]; option(inp, v, lk ? (lk[0] === '#' ? lk.slice(1) : t(lk)) : v); }
        inp.value = String(cur[k]);
        ctl.appendChild(inp);
      } else if (type === 'chk') {
        inp = el('input', { type: 'checkbox', checked: !!cur[k] }); ctl.appendChild(inp);
      } else if (type === 'text') {
        inp = el('input', { type: 'text', value: cur[k] || '', placeholder: t('ph_' + k), className: 'wide' }); ctl.appendChild(inp);
      } else if (type === 'time') {
        inp = el('input', { type: 'time', value: cur[k] || '' }); ctl.appendChild(inp);
        const clr = el('button', { type: 'button', className: 'chip tclr', textContent: '✕', title: t('time_clear') });   // Uhrzeit mit einem Klick leeren
        clr.setAttribute('aria-label', t('time_clear'));
        const syncClr = () => { clr.disabled = !inp.value; };
        clr.onclick = () => { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); syncClr(); };
        inp.addEventListener('input', syncClr); inp.addEventListener('change', syncClr); syncClr();
        ctl.appendChild(clr);
      } else if (type === 'window') {
        inp = el('input', { type: 'number', min: fd[2], max: fd[3], step: fd[4], value: cur[k], className: 'n' });
        const u = el('select', { name: 'bg_unit', id: 'in_bg_unit' }); u.setAttribute('aria-label', t('a_unit'));
        option(u, 's', t('u_s')); option(u, 'min', t('u_min')); u.value = cur.bg_unit;
        ctl.appendChild(inp); ctl.appendChild(u);
      } else {
        inp = el('input', { type: 'number', min: fd[2], max: fd[3], step: fd[4], value: cur[k] }); ctl.appendChild(inp);
      }
      inp.name = k; inp.id = 'in_' + k;
      const lab = el('label', { htmlFor: inp.id, textContent: t('f_' + k) });
      const ti = tipIcon('t_' + k); if (ti) lab.appendChild(ti);
      row.appendChild(lab); row.appendChild(ctl);
      const help = ('h_' + k) in I18N.de ? t('h_' + k) : ''; if (help) row.appendChild(el('small', { textContent: help }));
      if (k === 'fp_store') { row.appendChild(el('small', { id: 'fpstat', className: 'fpstat' })); fpStat(); }
      fs.appendChild(row);
    }
    body.appendChild(fs);
  }
  const thrFs = body.querySelector('fieldset[data-sec="s_thr"]'); if (thrFs) { thrFs.after(schedBox()); thrFs.after(profBox()); }
  body.appendChild(musterBox());
  { const rec = body.querySelector('fieldset[data-sec="s_rec"]'); if (rec) rec.appendChild(qtCard(11));                     // kurze Hinweise (💡 Hilfe anzeigen)
    const misc = body.querySelector('fieldset[data-sec="s_misc"]'); if (misc) misc.append(qtCard(14), qtCard(15)); }
  const timeFs = body.querySelector('fieldset[data-sec="s_time"]'); if (timeFs) timeFs.after(haBox(), scBox(), hadashBox());
  $('in_thr_mode').addEventListener('change', syncModeRows);
  if ($('in_save_audio')) $('in_save_audio').addEventListener('change', e => {   // Einschalten nur nach Bestaetigung des Hinweises
    if (e.target.checked && !confirm(t('audio_confirm'))) e.target.checked = false;
    syncAudioRows();
  });
  syncAudioRows();
  if ($('in_device') && $('in_mic_port')) { $('in_device').addEventListener('change', () => fillPorts($('in_mic_port'), $('in_device').value, '')); fillPorts($('in_mic_port'), $('in_device').value, $('in_mic_port').value); }
  syncModeRows();
  applyDevState();
  body.appendChild(bkBox()); body.appendChild(rsBox()); body.appendChild(diagBox());
  { const mf = body.querySelector('fieldset[data-sec="s_mirror"]'); if (mf) mf.appendChild(mirrorBox()); }
  { const pf = body.querySelector('fieldset[data-sec="s_pro"]'); if (pf) pf.after(grBox()); else body.appendChild(grBox()); }
  { const misc = body.querySelector('fieldset[data-sec="s_misc"]'); const pb = proBox(); if (misc) misc.before(pb); else body.appendChild(pb); }
  proApplyForm();
  secOrder(body); formDirty = false; makeCollapsible();
  body.querySelectorAll('fieldset.ff [name], #devown').forEach(e => { e.addEventListener('input', () => { formDirty = true; }); e.addEventListener('change', () => { formDirty = true; }); });
}
function syncModeRows() {
  const m = $('in_thr_mode').value;
  document.querySelectorAll('#sbody .f[data-modes]').forEach(r => r.classList.toggle('hide', !r.dataset.modes.split(',').includes(m)));
}
function formValues() {
  const data = {};
  $('sbody').querySelectorAll('[name]').forEach(e => { data[e.name] = e.type === 'checkbox' ? e.checked : e.value; });
  return data;
}
let FVC = null, FVC_L = 0;
function previewThr(base) {
  const box = $('sbody'); if (!box.childElementCount) return null;
  if (!FVC) { FVC = formValues(); if (!FVC_L) { FVC_L = 1; const z = () => { FVC = null; }; $('dlg').addEventListener('input', z, true); $('dlg').addEventListener('change', z, true); } }   // ab 1.85.35: Formular nicht 5× je Sekunde auslesen
  const v = FVC, m = v.thr_mode, num = k => parseFloat(v[k]);
  if (m === 'fixed') return num('thr_fixed_db');
  if (base == null) return null;
  let x = base + num('offset_db');
  if (m === 'bounded') x = clamp(x, num('min_db'), Math.max(num('min_db') + 1, num('thr_max_db')));
  return x;
}
async function openSettings() {                         // ab 1.85.34: sofort öffnen (zuletzt geladene Werte), frische Werte kommen im Hintergrund nach
  if (openSettings.busy) return; openSettings.busy = true;
  $('smsg').textContent = ''; $('calmsg').textContent = t('calhint');
  const tmo = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  const take = r => { if (r.pro && r.pro.state) { PRO = r.pro; proBanner(); }
    MIRROR_ST = r.mirror || null; SRC = r.sources || []; CUR = r.settings; SCHED = r.schedule || []; SRC_DET = r.src_details || []; DEF_SRC = r.default_source || ''; };
  const show = () => { initSTabs(); buildForm(CUR); buildSources(); applySTab(); if (!$('dlg').open) $('dlg').showModal(); };
  try {
    const fresh = tmo(fetch('settings', { cache: 'no-store' }).then(x => x.json()), 20000);
    if (CUR) { show(); $('smsg').textContent = t('set_loading'); }   // schon geladen: gleich zeigen
    let r = null; try { r = await fresh; } catch (e) { r = null; }
    const was = $('dlg').open ? JSON.stringify([CUR, SCHED, SRC_DET, DEF_SRC]) : '';
    if (r) { take(r); if (!$('dlg').open) show();
      else if (!formDirty && JSON.stringify([CUR, SCHED, SRC_DET, DEF_SRC]) !== was) { const sc = $('sbody'), y = sc ? sc.scrollTop : 0; show(); if (sc) sc.scrollTop = y; } }   // ab 1.85.35: nur neu aufbauen, wenn sich etwas geändert hat
    else if (!CUR) throw new Error('no settings');
    await tmo(loadSources(), 8000).catch(() => 0); await tmo(plFetch(), 8000).catch(() => 0);
    if (!$('dlg').open) show();
    $('smsg').textContent = r ? '' : t('set_stale');
  } catch (e) { console.error(e); toast(t('set_open_err')); }
  finally { openSettings.busy = false; }
}
async function saveSettings() {
  $('smsg').textContent = t('saving'); $('ssave').disabled = true;
  try {
    const v = formValues();
    let devChanged = false;
    if (DEV) {                                  // Geraete-Werte gehen an die Quelle, nicht in die allgemeinen Einstellungen
      const s = srcById(DEV), own = !!($('devown') && $('devown').checked), per = {};
      for (const k of PER) if (k in v) { per[k] = v[k]; delete v[k]; }
      const before = JSON.stringify([!!(s && s.own), (s && s.own && s.cfg) || null, (s && s.own && s.sched) || null]);
      const rs = await srcPost(Object.assign({ action: 'update', id: DEV, own }, own ? { cfg: per, sched: readSlots() } : {}));
      const ns = srcById(DEV);
      devChanged = before !== JSON.stringify([!!(ns && ns.own), (ns && ns.own && ns.cfg) || null, (ns && ns.own && ns.sched) || null]);
    } else {                                    // allgemeine Zeitprofile
      const rr = await (await fetch('schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slots: readSlots() }) })).json();
      if (!rr.ok) throw new Error(rr.error || 'error');
      SCHED = rr.slots; devChanged = rr.changed;
    }
    const r = await (await fetch('settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) })).json();
    if (!r.ok) throw new Error(r.error || 'error');
    CUR = r.settings; renderEvents();
    if (r.changed.includes('language')) { pickLang(CUR.language); tr(); setLive(view.live); renderEvents(); } if (r.changed.includes('tip_mode')) qtModeApply();
    if (r.changed.length || devChanged) { const sc = $('sbody').scrollTop; buildForm(CUR); buildSources(); $('sbody').scrollTop = sc; }
    if (devChanged || r.changed.some(k => ['bg_window', 'bg_unit', 'bg_stat', 'thr_mode'].includes(k))) yv.auto = true;
    $('smsg').textContent = !r.changed.length && !devChanged ? t('nochange') : !r.changed.length ? (DEV ? t('saved_dev', { n: (srcById(DEV) || {}).name || '' }) : t('saved')) :
      (t(r.restart ? 'savedr' : 'saved') + (r.supervisor ? ' ' + t('sup') : (r.supervisor_available ? ' ' + t('nosup') : '')));
    formDirty = false; updateStatus();
  } catch (e) { $('smsg').textContent = t('saveerr'); }
  $('ssave').disabled = false;
}
/* Live-Pegel im Dialog */
function drawMeter() {
  const cv = $('meter'); fit(cv);
  const d = DPR(), c = cv.getContext('2d'), w = cv.width, h = cv.height, L = 6 * d, R = 6 * d, pw = w - L - R, by = 6 * d, bh = 20 * d;
  c.clearRect(0, 0, w, h);
  const leg = $('mleg');
  if (!st) { leg.textContent = ''; return; }
  const last = recs.length ? recs[recs.length - 1] : null;
  let pk = null;
  if (last) { const i3 = lowerBound(last.ts - 3000); for (let i = i3; i < recs.length; i++) if (recs[i].l > -125) pk = Math.max(pk == null ? -200 : pk, recs[i].l); }
  const pv = previewThr(st.base);
  const vals = [st.level, st.base, st.thr, pv, pk].filter(v => v != null && isFinite(v) && v > -125);
  let lo = -100, hi = -20;
  if (vals.length) {
    lo = Math.floor((Math.min(...vals) - 10) / 10) * 10; hi = Math.ceil((Math.max(...vals) + 10) / 10) * 10;
    if (hi - lo < 40) hi = lo + 40;
  }
  const X = v => L + pw * clamp((v - lo) / (hi - lo), 0, 1);
  c.fillStyle = C.grid; c.fillRect(L, by, pw, bh);
  if (st.level != null && st.level > -125) { c.fillStyle = st.active ? C.red : C.acc; c.fillRect(L, by, X(st.level) - L, bh); }
  if (pk != null) { c.fillStyle = C.tx; c.fillRect(X(pk) - d, by, 2 * d, bh); }
  const mark = (v, col, dash) => { if (v == null || !isFinite(v)) return; const x = X(v); c.strokeStyle = col; c.lineWidth = 3 * d; c.setLineDash(dash ? [4 * d, 3 * d] : []); c.beginPath(); c.moveTo(x, by - 4 * d); c.lineTo(x, by + bh + 4 * d); c.stroke(); c.setLineDash([]); };
  mark(st.base, C.bgl); mark(st.thr, C.thr); mark(pv, C.pv, true);
  for (const r of curRefs()) if (r.db >= lo && r.db <= hi) { c.fillStyle = r.color; c.fillRect(X(r.db) - d, by - 4 * d, 2 * d, bh + 8 * d); }
  c.font = (11 * d) + 'px system-ui'; c.fillStyle = C.mut; c.textAlign = 'center';
  const mg = dbTicks(lo, hi, pw, 42);
  c.fillStyle = C.mut;
  for (const k of mg.ticks) {
    const x = Math.round(X(k.v)) + .5; c.fillRect(x - .5, by + bh + 1 * d, 1, (k.major ? 5 : 2.5) * d);
    if (k.major) c.fillText(mg.fmt(k.v), clamp(x, L + 12 * d, L + pw - 12 * d), h - 3 * d);
  }
  const html = [[t('level'), st.silent ? null : st.level, st.active ? C.red : C.acc], [t('background'), st.base, C.bgl], [t('threshold'), st.thr, C.thr], [t('preview'), pv, C.pv]]
    .map(([n, v, col]) => `<b><i style="background:${col}"></i>${esc(n)} ${f1(v == null || !isFinite(v) ? null : v)}</b>`).join(' ');
  if (leg.innerHTML !== html) leg.innerHTML = html;
}
let calTimer = null;
/* Schwelle automatisch einstellen: Vorschlag aus der letzten Nacht oder aus einer Messung jetzt – erst nach „Übernehmen“ im Formular, gespeichert mit „Speichern“ */
function calibrate() {
  if (!PRO.ok) { proGate('thr'); return; }
  let box = $('thrauto');
  if (box) { box.remove(); return; }
  box = el('div', { id: 'thrauto', className: 'thrauto' });
  $('calbtn').closest('.mrow').after(box);
  const sid = DEV || (typeof selSrc !== 'undefined' && selSrc) || 'main', name = viewName(sid);
  box.innerHTML = `<div class="tahead"><b>🎯 ${esc(t('ta_title'))}</b> <small>${esc(DEV ? t('ta_for_dev', { n: name }) : t('ta_for_all', { n: name }))}</small><button type="button" class="chip tax" aria-label="${esc(t('a_close'))}">✕</button></div>
    <div class="tarow"><button type="button" class="pri tanight">🌙 ${esc(t('ta_night'))}</button><span class="mut">${esc(t('ta_or'))}</span>
      <button type="button" class="tanow">⏱ ${esc(t('ta_now'))}</button><select class="tasecs">${[30, 60, 300].map(v => `<option value="${v}"${v === 60 ? ' selected' : ''}>${v < 60 ? v + ' s' : v / 60 + ' min'}</option>`).join('')}</select></div>
    <small class="mut">${esc(t('ta_help'))}</small><div class="tast"></div><div class="tares"></div>`;
  const st = box.querySelector('.tast'), res = box.querySelector('.tares');
  box.querySelector('.tax').onclick = () => { clearInterval(calTimer); calTimer = null; box.remove(); };
  const show = async (body) => {
    st.textContent = '⏳ ' + t('ta_eval'); res.innerHTML = '';
    let j; try { j = await (await fetch('thr_suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ src: sid }, body)) })).json(); } catch (e) { st.textContent = t('saveerr'); return; }
    if (!j.ok) { st.textContent = '⚠ ' + t(j.error === 'nodata' ? (body.mode === 'night' ? 'ta_nonight' : 'calfail') : 'saveerr'); return; }
    const L = locale(), hm = x => new Date(x).toLocaleTimeString(L, { hour: '2-digit', minute: '2-digit' });
    st.innerHTML = (j.disturbed ? `<div class="bad">⚠ ${esc(t('ta_disturbed', { p: j.loud_pct }))}</div>` : '') +
      esc(t('ta_meas', { a: hm(j.from), b: hm(j.to), q: j.p10.toFixed(1), m: j.p50.toFixed(1), p: j.p95.toFixed(1) })) + (j.mode === 'night' && j.events ? ' ' + esc(t('ta_events')) : '');
    const keys = ['offset_db', 'min_db', 'thr_max_db', 'thr_fixed_db'], cur = k => { const e = $('in_' + k); return e ? e.value : ''; };
    res.innerHTML = `<table class="caltab"><thead><tr><th></th><th>${esc(t('ta_cur'))}</th><th>${esc(t('ta_sugg'))}</th></tr></thead><tbody>` +
      keys.map(k => `<tr><td>${esc(t('f_' + k))}</td><td>${esc(cur(k))}</td><td><b>${esc(String(j.sugg[k]))}</b></td></tr>`).join('') + `</tbody></table>
      <div class="tarow"><button type="button" class="pri taok">✓ ${esc(t('ta_apply'))}</button><button type="button" class="tano">${esc(t('cal_discard'))}</button></div>`;
    res.querySelector('.tano').onclick = () => { res.innerHTML = ''; st.textContent = ''; };
    res.querySelector('.taok').onclick = () => {
      if (DEV && $('devown') && !$('devown').checked) { $('devown').checked = true; $('devown').dispatchEvent(new Event('change')); }   // gilt dann nur für dieses Gerät
      for (const k of keys) { const e = $('in_' + k); if (e) { e.value = j.sugg[k]; e.dispatchEvent(new Event('input')); } }
      formDirty = true; res.innerHTML = ''; st.textContent = '✓ ' + t('ta_done');
    };
  };
  box.querySelector('.tanight').onclick = () => show({ mode: 'night' });
  box.querySelector('.tanow').onclick = () => {
    if (calTimer) return;
    const dur = +box.querySelector('.tasecs').value, t0 = nowServer(); let left = dur;
    box.querySelectorAll('button:not(.tax),select').forEach(x => { x.disabled = true; });
    st.textContent = t('ta_quiet', { s: left }); res.innerHTML = '';
    calTimer = setInterval(() => {
      left--; if (left > 0) { st.textContent = t('ta_quiet', { s: left }); return; }
      clearInterval(calTimer); calTimer = null; box.querySelectorAll('button,select').forEach(x => { x.disabled = false; });
      show({ mode: 'now', from: Math.round(t0), to: Math.round(nowServer()) });
    }, 1000);
  };
}

/* ================= Start ================= */
let animating = false, dirty = true, lastFrame = performance.now(), frameDt = 16, lastT1 = 0, lastSeqDrawn = -1, lastMeter = 0;
const smoothK = tau => 1 - Math.exp(-frameDt / tau);
function markDirty() { dirty = true; }
function frame(now) {
  frameDt = Math.min(100, now - lastFrame); lastFrame = now;
  if (!document.hidden) {
    try {
      playAdapt(frameDt);
      let [t0, t1] = viewRange();
      if (view.live) { const pxm = (t1 - t0) / Math.max(100, ($('main').clientWidth - AXL() - 14) * DPR()); t1 = Math.floor(t1 / pxm) * pxm; t0 = t1 - view.span * 1000; }   // in ganzen Pixeln weiter
      const hist = histOn();                         // zurückgespult: Tagesverlauf statt Live-Grafik
      if (!hist && recs.length && t0 < recs[0].ts) loadOlder();
      const pxMs = view.span * 1000 / Math.max(100, $('main').clientWidth - AXL() - 14);
      const seq = recs.length ? recs[recs.length - 1].s : -1;
      if (Math.abs(t1 - lastT1) >= pxMs * 0.5 || seq !== lastSeqDrawn || animating || hoverX != null) dirty = true;
      if (hist) slHide('scmain');
      const modal = !!document.querySelector('dialog[open]');   // ab 1.85.35: hinter einem offenen Fenster nur noch ~1× je Sekunde zeichnen
      if (dirty && !NV.open && !PV.open && !hist && (!modal || now - (frame.lastModal || 0) > 1000)) {
        if (modal) frame.lastModal = now;
        dirty = false; animating = false; lastT1 = t1; lastSeqDrawn = seq;
        if (view.mode === 'level') drawLevel($('main'), t0, t1); else drawWave($('main'), t0, t1);
        drawFnLive($('main'), t0, t1);                // freie Notizen an ihrer Stelle
        slDraw('scmain', t0, t1, AXL(), 14, 10000);   // Sensor-Spuren (gleiche Zeitachse wie der Graph)
        drawSpec($('spec'), t0, t1);
      }
      if ($('dlg').open && now - lastMeter > 200) { lastMeter = now; drawMeter(); }
      loadDiag();
    } catch (e) { console.error(e); }
  }
  requestAnimationFrame(frame);
}
window.addEventListener('resize', markDirty);
['click', 'change', 'wheel', 'pointerup'].forEach(ev => document.addEventListener(ev, markDirty, true));

/* ================= Nachtbericht (Schlaf-App-Stil) ================= */
const NV = { per: 'win', art: '', from: null, to: null, date: null, src: 'all', data: null, week: null, hover: null, playing: null, hits: [], timer: null, open: false };
const isoDay = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
/* Tages-Kreise: liegt der gewählte Tag in den letzten 7 Tagen, endet die Leiste bei der neuesten Nacht (nichts verschwindet);
   ältere Tage stehen in der Mitte (3 davor, 3 danach, nie über die neueste hinaus) */
function weekEnd(ds) {
  const last = nightDefault(), d = parseDay(ds), l = parseDay(last), diff = Math.round((l - d) / 864e5);
  if (diff <= 6) return last;
  const e = new Date(d); e.setDate(e.getDate() + 3); return isoDay(e);
}
function nightDefault() {
  // die zuletzt begonnene Nacht: vor Beginn der heutigen Nacht (Erfassung ab, sonst 20:00) ist es die von gestern
  const n = new Date(), d = new Date(n), m = /^(\d{1,2}):(\d{2})$/.exec((CUR && CUR.active_from) || '');
  if (!(m && CUR.active_to && CUR.active_from !== CUR.active_to)) return isoDay(d);   // keine Erfassungszeit: der heutige Tag
  const a = (+m[1]) * 60 + (+m[2]);
  if (n.getHours() * 60 + n.getMinutes() < a) d.setDate(d.getDate() - 1);
  return isoDay(d);
}
const NC = { bg: '', acc: '#38d9c4', accL: '#38d9c4', mut: '#888', grid: '#8883', warn: '#ff922b', red: '#ff6b6b', tx: '#fff', l1: '#8881', l2: '#8883', l3: '#888a' };
function ca(col, a) { if (/^hsl\(/.test(col || '')) return col.replace(')', ` / ${a})`); const m = /^#([0-9a-f]{6})/i.exec(col || ''); if (!m) return col; const v = parseInt(m[1], 16); return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`; }
function readNC() {
  const cs = getComputedStyle($('nightview')), g = n => cs.getPropertyValue(n).trim();
  Object.assign(NC, { bg: g('--card'), acc: g('--nacc') || NC.acc, accL: g('--nacc') || NC.accL, mut: g('--mut'), warn: g('--thr'), red: g('--red'), tx: g('--tx'), l1: g('--nl1'), l2: g('--nl2'), l3: g('--nl3'), grid: g('--nl1') });
}
function locale() { return lang === 'en' ? 'en-GB' : 'de-DE'; }
function showTab(mode) {
  if (mode === true || mode === 'night') mode = 'prot'; else if (mode === false || !mode) mode = 'live';   // Nachtbericht ist jetzt Teil von Protokolle
  const prot = mode === 'prot', live = !prot;
  NV.open = prot; PV.open = prot;
  $('liveview').hidden = !live; $('nightview').hidden = !prot;
  $('tab_live').classList.toggle('on', live); $('tab_prot').classList.toggle('on', prot);
  try { localStorage.setItem('laerm_tab', mode); } catch (e) { }
  if (prot) { if (!NV.date) perSet(NV.per, true); plFetch().then(plRefresh); loadNight(); } else { markDirty(); levLoad(true); }
  setTimeout(dashRefresh, 50);
}
/* Reiter Protokolle: ein Datensatz für Zeitraum + Filter (Gerät, Art, Liste); Kopfzahlen, Verlauf, Diagramme und Tabelle nutzen ihn alle */
function perRange() {
  const d0 = parseDay(NV.date), add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; }, iso = d => isoDay(d) + 'T00:00';
  if (NV.per === 'win') return null;                 // Erfassungszeit: der Server kennt sie
  if (NV.per === 'free') { const a = parseDay(NV.from || NV.date), b = parseDay(NV.to || NV.date); return [iso(a <= b ? a : b), iso(add(a <= b ? b : a, 1))]; }
  const n = NV.per === '7' ? 7 : NV.per === '30' ? 30 : 1;
  return [iso(add(d0, 1 - n)), iso(add(d0, 1))];
}
function perQuery() {                                // gemeinsame Filter für alle Anfragen des Reiters
  const r = perRange(), d = NV.data;
  let q = 'src=' + encodeURIComponent(NV.src || 'all') + '&list=' + encodeURIComponent(PV.cur || '') + '&art=' + encodeURIComponent(NV.art || '');
  if (r) q += '&from=' + r[0] + '&to=' + r[1];
  else if (d && d.start && d.date === NV.date) q += '&from=' + encodeURIComponent(d.start.slice(0, 16)) + '&to=' + encodeURIComponent(d.end.slice(0, 16));
  else return null;
  return q;
}
function perSet(p, quiet) {
  NV.per = p; try { localStorage.setItem('laerm_per', p); } catch (e) { }
  const today = isoDay(new Date());
  if (p === 'win') NV.date = nightDefault();
  else if (p === 'yest') { const d = new Date(); d.setDate(d.getDate() - 1); NV.date = isoDay(d); }
  else NV.date = today;
  if (p === 'free' && !NV.from) { const d = new Date(); d.setDate(d.getDate() - 6); NV.from = isoDay(d); NV.to = today; }
  document.querySelectorAll('#nper button').forEach(b => b.classList.toggle('on', b.dataset.p === NV.per));   // sofort umschalten, nicht erst nach dem Laden
  $('ndate').hidden = NV.per === 'free'; $('nfree').hidden = NV.per !== 'free';
  if (!quiet) loadNight();
}

/* ab 1.85.37: Vorausladen – der Zeitraum davor und danach (Protokolle: ‹ ›, Live: zurückgespult) liegt schon bereit, Umschalten ohne weißes Warten.
   Nur lesende Abfragen (Bericht, Ereignisse, Verlauf); jede Antwort höchstens 2 Minuten (laufender Tag 20 s) aufgehoben. */
const PFC = { c: new Map(), rec: null, on: true };
const PF_RE = /^(night|nights|events|daytrack|runtime|sclanes)\?/;
const _fetch0 = window.fetch.bind(window);
window.fetch = function (u, o) {
  const url = typeof u === 'string' ? u : '';
  if (!url || !PF_RE.test(url) || (o && o.method && o.method !== 'GET')) return _fetch0(u, o);
  if (PFC.rec) PFC.rec.add(url);
  const e = PFC.c.get(url), now = Date.now();
  if (e && now - e.t < e.ttl) { PFC.c.delete(url); return e.p.then(x => new Response(x.body, { status: x.status, headers: { 'Content-Type': x.ct } })); }   // einmal benutzen, danach wieder frisch vom Server
  return _fetch0(u, o);
};
function pfGet(url, ttl) {                             // im Hintergrund laden und aufheben
  if (PFC.c.has(url)) return;
  const p = _fetch0(url, { cache: 'no-store' }).then(async r => ({ status: r.status, ct: r.headers.get('Content-Type') || 'application/json', body: await r.text() }));
  p.catch(() => PFC.c.delete(url));
  PFC.c.set(url, { t: Date.now(), ttl, p });
  if (PFC.c.size > 40) PFC.c.delete(PFC.c.keys().next().value);
}
function pfShift(url, days, ms) {                     // gleiche Abfrage, um n Tage (oder ms) verschoben – Schreibweise der Werte bleibt gleich
  let any = false;
  const fm = /[?&]from=(\d{10,})(?:&|$)/.exec(url), cal = (v, n) => { const d = new Date(+v); d.setDate(d.getDate() + n); return d.getTime(); };
  const out = url.replace(/([?&](?:date|from|to)=)([^&]*)/g, (m, k, raw) => {
    if (days && fm && k.endsWith('to=') && /^\d{10,}$/.test(raw) && +raw > Date.now() - 300000) { any = true; return k + String(cal(cal(fm[1], days), Math.abs(days))); }   // laufender Zeitraum endet „jetzt“: davor ganz
    const enc = /%/.test(raw), v = enc ? decodeURIComponent(raw) : raw;
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) { if (!days) return m; const d = parseDay(v.slice(0, 10)); d.setDate(d.getDate() + days); const nv = isoDay(d) + v.slice(10); any = true; return k + (enc ? encodeURIComponent(nv) : nv); }
    if (/^\d{10,}$/.test(v)) { any = true; if (ms != null) return k + String(+v + ms); const d = new Date(+v); d.setDate(d.getDate() + days); return k + String(d.getTime()); }   // Kalendertage (Zeitumstellung)
    return m;
  });
  return any ? out : null;
}
function pfNeighbors(urls, days, msStep, isFuture) {   // davor (−) und danach (+), nicht in die Zukunft
  setTimeout(() => {
    for (const k of [-1, 1]) {
      if (k > 0 && isFuture()) continue;
      for (const u of urls) { const v = pfShift(u, days ? k * days : 0, msStep ? k * msStep : null); if (v && v !== u) pfGet(v, 120000); }
    }
  }, 1500);
}
function pfProt() {                                   // Protokolle: Tag/Woche/Monat davor und danach
  const urls = [...(PFC.rec || [])]; PFC.rec = null; if (!urls.length || !NV.open) return;
  const n = NV.per === '7' ? 7 : NV.per === '30' ? 30 : NV.per === 'free' ? Math.round((parseDay(NV.to) - parseDay(NV.from)) / 864e5) + 1 : 1;
  const lim = NV.per === 'win' ? nightDefault() : isoDay(new Date());
  pfNeighbors(urls, n, 0, () => { const d = parseDay(NV.per === 'free' ? NV.to : NV.date); d.setDate(d.getDate() + n); return isoDay(d) > lim; });
}
async function loadNight() {
  const ds = NV.date, src = NV.src, rg = perRange(), key = JSON.stringify([ds, src, rg, NV.per, PV.cur, NV.art]);
  const fq = '&src=' + encodeURIComponent(src) + '&list=' + encodeURIComponent(PV.cur || '') + '&art=' + encodeURIComponent(NV.art || '') + (rg ? '&from=' + rg[0] + '&to=' + rg[1] : '');
  const fresh = key !== NV.dkey;                     // anderer Zeitraum/Filter: sofort Ladehinweis über allen Bereichen
  PFC.rec = new Set(); clearTimeout(PFC.tm); PFC.tm = setTimeout(pfProt, 6000);   // Abfragen dieses Zeitraums merken, danach Nachbarn vorausladen
  if (fresh) { busy(PROT_AREAS, true); busy(EV_AREAS, true); EVWAIT = true; }
  try {
    const [n, w] = await Promise.all([
      fetch('night?date=' + ds + fq, { cache: 'no-store' }).then(r => r.json()),
      NV.per === 'win' ? fetch('nights?date=' + weekEnd(ds) + '&src=' + encodeURIComponent(src), { cache: 'no-store' }).then(r => r.json()) : Promise.resolve({ nights: [] })]);
    if (key !== JSON.stringify([NV.date, NV.src, perRange(), NV.per, PV.cur, NV.art])) return;
    const rk = n.start + '|' + n.end + '|' + src;      // anderer Zeitraum: Verlauf wieder ganz zeigen
    if (DT.rk !== rk) { DT.rk = rk; DT.from = DT.to = null; DT.mark = null; }
    DT.src = src;
    NV.data = n; NV.dkey = key; NV.week = w.nights; renderNight(); dtLoad(DT, true); EVSIG = ''; loadEvents(); loadRun();
  } catch (e) { }
  finally { if (fresh) { busy(PROT_AREAS, false); if (EVWAIT) { EVWAIT = false; busy(EV_AREAS, false); } } }
  clearTimeout(NV.timer);
  if (NV.open && NV.data && new Date(NV.data.end) > new Date()) NV.timer = setTimeout(loadNight, 60000);   // laufende Nacht aktualisieren
}
/* Aufzeichnung & Datenkette: Unterbrechungen/Updates im Zeitraum und ob die Tagesaufzeichnung unverändert ist */
async function loadRun() {
  const d = NV.data; if (!d || !d.start) return;
  let j; try { j = await (await fetch('runtime?from=' + new Date(d.start).getTime() + '&to=' + new Date(d.end).getTime(), { cache: 'no-store' })).json(); } catch (e) { return; }
  const box = $('nrun'), L = locale(), fm = iso => { const x = new Date(iso); return isNaN(x) ? '' : x.toLocaleString(L, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
  const ch = j.chains || [], bad = ch.filter(c => c.ok === false), none = ch.filter(c => c.ok == null || c.none);
  const evs = (j.events || []).filter(e => ['down', 'update', 'fallback', 'crash', 'import'].includes(e.kind));
  NV.down = evs.filter(e => e.kind === 'down').map(e => [new Date(e.from).getTime(), new Date(e.to).getTime(), e.note || '', e.key || e.from, e.cause, e]).filter(g => g[1] > g[0]);
  for (const sub of DT.subs || []) if (sub.data) dtDraw(sub);
  if (typeof LDT !== 'undefined' && histOn()) dtDraw(LDT);
  const nk = ch.filter(c => c.nokey).length;
  const chainTxt = !ch.length ? '' : '🛡 ' + t(none.length === ch.length ? 'run_chain_none' : 'run_chain_ok', { n: ch.filter(c => c.ok && !c.nokey).length }) + (nk ? ' · ' + t('run_chain_nokey', { n: nk }) : '');
  const evT = e => e.kind === 'down' && e.cause === 'gap' ? t('run_gap', { a: fm(e.from), b: fm(e.to), s: e.name || viewName(e.sid) }) : e.kind === 'down' ? t('run_down', { a: fm(e.from), b: fm(e.to), v: e.version_new || '', r: t(e.reason === 'update' ? 'run_r_update' : e.cause === 'lost' ? 'run_r_lost' : 'run_r_restart') })
    : e.kind === 'import' ? t('run_import', { a: fm(e.at), s: viewName(e.sid), n: e.minutes })
    : e.kind === 'update' ? t('run_update', { a: fm(e.at), o: e.version_old, n: e.version_new }) : e.kind === 'fallback' ? t('run_fallback', { a: fm(e.at), b: e.to, v: e.version }) : t('run_crash', { a: fm(e.at), v: e.version });
  /* Nur offene (ungelesene) Meldungen anzeigen; bestätigte nur auf Wunsch. Bestätigen ändert nichts an Aufzeichnung, Kette oder Bericht. */
  const all = !!NV.runAll, isBadAck = c => !!c.ack, nAck = evs.filter(e => e.ack).length + bad.filter(isBadAck).length;
  const showEv = all ? evs : evs.filter(e => !e.ack), showBad = all ? bad : bad.filter(c => !c.ack);
  const nOpen = evs.filter(e => !e.ack).length + bad.filter(c => !c.ack).length;
  const lostDays = new Set(ch.filter(c => c.explained).map(c => c.day)), lostN = ch.reduce((a, c) => a + (c.explained || 0), 0);
  const rows = [];
  if (all && chainTxt && !bad.length) rows.push(`<div>${esc(chainTxt)}</div>`);
  for (const c of showBad) {
    const when = c.day.slice(8, 10) + '.' + c.day.slice(5, 7) + '. ' + (c.bad ? new Date(c.bad).toLocaleTimeString(L, { hour: '2-digit', minute: '2-digit' }) : '');
    rows.push(`<div class="${c.ack ? 'ev acked' : 'bad'}" data-ack="${esc(c.ack_key)}">${c.ack ? '' : '⚠ '}${esc(t('run_chain_bad', { l: c.name + ' ' + when }))} ${ackBtn(c.ack_key, c.ack)}</div>`);
  }
  function ackBtn(key, acked, by) {
    if (acked && by === 'auto') return '';
    return acked ? `<button type="button" class="chip ackbtn undo" data-ack="${esc(key)}" data-on="0" title="${esc(t('run_ack_undo'))}">↺</button>`
      : `<button type="button" class="chip ackbtn" data-ack="${esc(key)}" data-on="1" title="${esc(t('run_ack_tip'))}">✓ ${esc(t('run_ack'))}</button>`;
  }
  for (const e of showEv) {
    const x = evT(e), tip = e.kind === 'down' && lostDays.has(String(e.from).slice(0, 10)) && e.cause !== 'gap' ? ` title="${esc(t('run_chain_lost', { n: lostN }))}"` : '';
    if (e.kind !== 'down') { rows.push(`<div class="ev${e.ack ? ' acked' : ''}"${tip}>${esc(x)} ${ackBtn(e.key, e.ack, e.ack_by)}</div>`); continue; }
    rows.push(`<div class="ev rdown${e.ack ? ' acked' : ''}" data-key="${esc(e.key)}"${tip}>${esc(x)}${e.note ? ` <b class="rnote">📝 ${esc(e.note)}</b>` : ''} <button type="button" class="chip rnbtn">${esc(t(e.note ? 'run_note_edit' : 'run_note_add'))}</button> ${ackBtn(e.key, e.ack, e.ack_by)}</div>`);
  }
  if (nOpen > 1 && !all) rows.unshift(`<div class="ackall"><button type="button" class="chip ackbtn" data-all="1">✓ ${esc(t('run_ack_all'))}</button></div>`);
  if (nAck || all) rows.push(`<div class="acktoggle"><button type="button" class="chip rtoggle">${esc(all ? t('run_ack_hide') : t('run_ack_show', { n: nAck }))}</button></div>`);
  box.hidden = !rows.length;
  box.classList.toggle('quiet', !nOpen && !all);
  box.innerHTML = rows.join('');
  const doAck = async (keys, on) => { try { await fetch('run_ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys, on }) }); } catch (er) { } loadRun(); };
  box.querySelectorAll('.ackbtn').forEach(b => b.onclick = () => b.dataset.all ? doAck([...evs.filter(e => !e.ack).map(e => e.key), ...bad.filter(c => !c.ack).map(c => c.ack_key)], true) : doAck([b.dataset.ack], b.dataset.on === '1'));
  box.querySelectorAll('.rtoggle').forEach(b => b.onclick = () => { NV.runAll = !NV.runAll; loadRun(); });
  box.querySelectorAll('.rdown .rnbtn').forEach(b => b.onclick = () => runNoteEdit(b.closest('.rdown'), evs.find(e => e.key === b.closest('.rdown').dataset.key)));
}
/* Kommentar zu einer Unterbrechung (z. B. „Stromausfall“) – ändert nichts an der Aufzeichnung */
function runNoteEdit(row, e) {
  if (!row || !e || row.querySelector('.rnform')) return;
  const f = el('span', { className: 'rnform' }), inp = el('input', { type: 'text', value: e.note || '', maxLength: 300, placeholder: t('run_note_ph') });
  const ok = el('button', { type: 'button', className: 'chip pri', textContent: t('save') }), no = el('button', { type: 'button', className: 'chip', textContent: '✕' });
  no.setAttribute('aria-label', t('cancel'));
  const save = async () => {
    try { const r = await (await fetch('run_note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: e.key || e.from, text: inp.value }) })).json(); if (!r.ok) throw new Error(r.error || 'error'); }
    catch (er) { alert(t('saveerr') + ' ' + er.message); return; }
    loadRun();
  };
  ok.onclick = save; no.onclick = () => loadRun();
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); save(); } if (ev.key === 'Escape') loadRun(); });
  const b = row.querySelector('.rnbtn'); if (b) b.hidden = true;
  f.append(inp, ok, no); row.appendChild(f); inp.focus();
}
function ringSVG(pct, size, stroke, color, inner) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct));
  return `<svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${NC.l2}" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${(c * p / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>${inner || ''}</svg>`;
}
const scoreColor = p => p >= 95 ? NC.acc : p >= 85 ? NC.warn : NC.red;
function renderNight() {
  const d = NV.data; if (!d) return;
  statRefresh('prot');
  const s = new Date(d.start), e = new Date(d.end), L = locale();
  document.querySelectorAll('#nper button').forEach(b => b.classList.toggle('on', b.dataset.p === NV.per));
  $('ndate').hidden = NV.per === 'free'; $('nfree').hidden = NV.per !== 'free';
  if (NV.per === 'free') { $('nfrom').value = NV.from || ''; $('nto').value = NV.to || ''; }
  const rg = perRange(), qs = perQuery() || '';
  $('nday').textContent = NV.per === 'win' || NV.per === 'today' || NV.per === 'yest' ? s.toLocaleDateString(L, { weekday: 'long' }) : t('per_' + NV.per);
  const e1 = new Date(e.getTime() - 1);
  const whole = !s.getHours() && !s.getMinutes() && !e.getHours() && !e.getMinutes() && e - s >= 86e6;   // ohne Erfassungszeit: ganzer Tag
  if (rg) $('nrange').textContent = (isoDay(s) === isoDay(e1) ? s.toLocaleDateString(L, { day: 'numeric', month: 'long', year: 'numeric' }) :
    s.toLocaleDateString(L, { day: 'numeric', month: 'long' }) + ' – ' + e1.toLocaleDateString(L, { day: 'numeric', month: 'long', year: 'numeric' })) + (e > new Date() ? ' · ' + t('n_running') : '');
  else $('nrange').textContent = (whole ? s.toLocaleDateString(L, { day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + t('n_wholeday') :
    s.toLocaleDateString(L, { day: 'numeric', month: 'long' }) + ' – ' + e.toLocaleDateString(L, { day: 'numeric', month: 'long', year: 'numeric' }) +
    ' · ' + pad(s.getHours()) + ':' + pad(s.getMinutes()) + '\u2060–\u2060' + pad(e.getHours()) + ':' + pad(e.getMinutes())) + (e > new Date() ? ' · ' + t('n_running') : '');
  $('ndate').value = d.date;
  $('nnext').disabled = e > new Date();
  $('nsvg').href = 'night.svg?date=' + d.date + '&' + qs;
  $('nsvg').setAttribute('download', 'laerm_' + (rg ? rg[0].slice(0, 10) + '_' + isoDay(e1) : d.date) + '.svg');
  { let pr = {}; try { pr = JSON.parse(localStorage.getItem('laerm_proto') || '{}'); } catch (x) { }   // Lärmprotokoll für genau diese Auswahl
    const pp = { from: isoDay(s), to: isoDay(e1), src: NV.src || 'all', list: PV.cur || '', all: '1', name: pr.name || '', addr: pr.addr || '', flat: pr.flat || '' };
    $('plproto').href = 'protokoll.html?' + new URLSearchParams(Object.fromEntries(Object.entries(pp).filter(([, v]) => v))).toString(); }
  $('nweek').hidden = NV.per !== 'win';
  // Quellen-Auswahl
  const sel = $('nsrc'), opts = [['all', t('all_sources')]].concat(viewSources().map(x => [x.id, viewName(x.id)])), key = JSON.stringify(opts);
  if (sel.dataset.k !== key) { sel.dataset.k = key; sel.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join(''); }
  if (!opts.some(o => o[0] === NV.src)) NV.src = 'all';
  sel.value = NV.src; sel.closest('label').style.display = SOURCES.length > 1 ? '' : 'none';
  // Wochenleiste
  $('nweek').innerHTML = (NV.week || []).map(n => {
    const wd = parseDay(n.date).toLocaleDateString(L, { weekday: 'short' }).replace('.', '').slice(0, 2);
    const ok = n.data && n.quiet_pct != null, col = ok ? scoreColor(n.quiet_pct) : NC.l3;
    return `<button class="nwd${n.date === d.date ? ' sel' : ''}${n.data ? '' : ' nod'}" data-d="${n.date}" title="${esc(n.date)} · ${n.count} ${esc(t('n_count'))}">
      ${ringSVG(ok ? n.quiet_pct : 0, 44, 5, col, `<text x="22" y="26" text-anchor="middle" font-size="12" font-weight="700" fill="${n.date === d.date ? NC.tx : NC.mut}">${esc(wd)}</text>${n.date === d.date ? '<circle cx="22" cy="22" r="20.5" fill="none" stroke="${NC.tx}" stroke-width="1"/>' : ''}`)}
      <span>${n.count}</span></button>`;
  }).join('');
  $('nweek').querySelectorAll('.nwd').forEach(b => b.onclick = () => { NV.date = b.dataset.d; loadNight(); });
  // Zusammenfassung
  const sm = d.summary, has = d.levels.length || d.events.length, hasQ = sm.quiet_pct != null;
  $('nring').innerHTML = ringSVG(hasQ ? sm.quiet_pct : 0, 150, 14, hasQ ? scoreColor(sm.quiet_pct) : NC.l3,
    `<text x="75" y="76" text-anchor="middle" font-size="34" font-weight="800" fill="${NC.tx}">${hasQ ? Math.round(sm.quiet_pct) : '–'}<tspan font-size="16">${hasQ ? ' %' : ''}</tspan></text>
     <text x="75" y="100" text-anchor="middle" font-size="13" fill="${NC.mut}">${esc(t('n_quiet'))}</text>`);
  const fm = m => m >= 60 ? Math.floor(m / 60) + 'h ' + pad(Math.round(m % 60)) + 'm' : Math.round(m) + ' min';
  const nd = !has;                                  // leere Nacht: keine Nullwerte vortaeuschen
  $('nstats').innerHTML = [[nd ? '–' : sm.count, t('n_count')], [nd ? '–' : fm(sm.disturbed_min), t('n_dist')], [sm.longest_quiet_min != null ? fm(sm.longest_quiet_min) : '–', t('n_longest')],
    [t('n_rec_of', { a: numTxt((sm.recorded_min / 60).toFixed(1).replace(/\.0$/, '')), b: Math.round(sm.minutes / 60) }), t('n_recorded')],
    [sm.loudest != null ? sm.loudest.toFixed(0) + ' dBFS' : '–', t('n_loudest') + (sm.loudest_at ? ' · ' + sm.loudest_at : '')],
    [nd ? '–' : sm.event_s >= 60 ? fm(sm.event_s / 60) : sm.event_s.toFixed(1) + ' s', t('n_evtime')]]
    .map(([v, l], i) => `<div><b style="color:${i === 0 && v > 0 ? NC.warn : NC.tx}">${esc(v)}</b><span>${esc(l)}</span></div>`).join('') +
    (sm.mf_n ? `<div class="mut nmf">${esc(t('mf_n', { n: sm.mf_n }).trim())}${MF.show ? ' · ' + esc(t('mf_shown')) : ''}</div>` : '') +
    (sm.arts && Object.keys(sm.arts).length ? `<div class="narts">${Object.entries(sm.arts).sort((a, b) => b[1] - a[1]).map(([g, n]) => `<span class="art a-${g}">${ART_ICON[g] || '❓'} ${esc(artName(g))} <small>${n}×</small></span>`).join('')}</div>` : '');
  // Die Störungen stehen in der Tabelle unten (gleicher Datensatz)
  const nn = d.events.flatMap(ev => (ev.notes || []).map(n => [ev, n])), fl = d.fnotes || [];
  const mo = (d.motion || []).filter(m => !SHIDE.has(m.kind));                        // Handys als Bewegungsmelder: Erschütterung / Bewegung im Bild
  $('nnotes').hidden = !nn.length && !fl.length && !mo.length;
  {
    const nmv = id => id === 'all' ? t('all_sources') : viewName(id), L = locale(), mk = (m, ic, col) => `<span class="ntnum" style="background:${col}">${ic}</span> `;
    const tx = n => `${(n.tags || []).map(ntTag).join('')}${n.text ? `<span class="ntt">${esc(n.text)}</span>` : ''}${n.witness ? `<span class="ntw">👤 ${esc(n.witness)}</span>` : ''}${fbx(n)}`;
    const rows = [
      ...nn.map(([ev, n], i) => `<tr data-k="n" data-i="${i}"><td>${mk(0, '📝', noteCol(n))}${esc(t('tp_evnote'))}</td><td>${esc(fmtDay(n.date || d.date))}</td><td>${esc(n.clock)}</td><td>${esc(ev.name)}</td><td>${tx(n)}</td><td class="ntact">▶</td></tr>`),
      ...fl.map((n, i) => `<tr data-k="f" data-i="${i}"><td>${mk(0, '📝', '#7048e8')}${esc(t('tp_note'))}</td><td>${esc(fmtDay(n.date))}</td><td>${esc(n.clock)}${n.to ? '–' + esc(n.clock_to) : ''}${n.rz ? ' 🌙' : ''}</td><td>${esc(nmv(n.src || 'all'))}</td><td>${tx(n)}</td><td class="ntact fned" title="${esc(t('nt_edit'))}">✎</td></tr>`),
      ...mo.map((m, i) => { const a1 = new Date(m.a), b1 = new Date(m.b);
        return `<tr data-k="m" data-i="${i}"><td>${mk(0, sensIcon(m.kind), m.kind === 'vib' ? '#e8590c' : m.kind === 'tilt' ? '#9c36b5' : '#1c7ed6')}${esc(t(m.kind === 'vib' ? 'mot_vib' : m.kind === 'tilt' ? 'mot_tilt' : 'mot_cam'))}</td><td>${esc(a1.toLocaleDateString(L, { day: '2-digit', month: '2-digit' }))}</td><td>${esc(a1.toLocaleTimeString(L))}–${esc(b1.toLocaleTimeString(L))}</td><td>${esc(viewName(m.src))}</td><td><span class="ntt">${esc(fmtDur(Math.max(0, (m.b - m.a) / 1000)))} · ${esc(t('mot_peak'))} ${esc(m.kind === 'vib' ? f2(m.peak) + ' m/s²' : f1(m.peak) + ' %')}${m.open ? ' · ' + esc(t('mot_open')) : ''}</span></td><td></td></tr>`; })];
    const goto = (a, b) => dtFocus(a, b);
    tabGrid($('nnotes'), rows.length ? `<table><tr><th>${esc(t('col_type'))}</th><th>${esc(t('date'))}</th><th>${esc(t('col_time'))}</th><th>${esc(t('src_col'))}</th><th>${esc(t('col_text'))}</th><th></th></tr>${rows.join('')}</table>` : '<div></div>',
      { onRow: (ds, e) => { const i = +ds.i;
        if (ds.k === 'n') { const [ev, n] = nn[i]; if (ev.k) openEvent(ev.k, n.off); }
        else if (ds.k === 'f') { const n = fl[i]; if (e.target.closest('.fned')) fnOpen(n); else goto(n.a, n.b); }
        else if (ds.k === 'm') { const m = mo[i]; goto(m.a, m.b); } } });
  }
  haListRender();
  drawNight();
}
/* Liste „Sensoren aus Home Assistant im Zeitraum“ – eigenes Panel, standardmäßig ausgeblendet; optional nur sichtbarer Bereich */
function haListRender() {
  const d = NV.data || {}, box0 = $('nhalist'); if (!box0) return; box0.innerHTML = '';
  const hl = (d.ha || []).filter(x => !SHIDE.has('ha:' + x[2]) && (!dashVis('ha') || (x[1] >= DT.from && x[0] <= DT.to)));                             // Sensoren aus Home Assistant (Regeln „nur festhalten“)
  if (hl.length) {
    const L = locale();
    const rows = hl.map((x, i) => { const dur = Math.max(0, (x[1] - x[0]) / 1000);
      return `<tr data-i="${i}"><td>📡 ${esc(x[2])}</td><td>${esc(new Date(x[0]).toLocaleDateString(L, { day: '2-digit', month: '2-digit' }))}</td><td>${esc(hms(x[0]))}–${esc(hms(x[1]))}</td><td>${esc(dur < 120 ? Math.round(dur) + ' s' : dur < 7200 ? Math.round(dur / 60) + ' min' : Math.floor(dur / 3600) + ' h ' + Math.round(dur % 3600 / 60) + ' min')}</td><td>${x[4] ? `<span class="ntt hant">📝 ${esc(x[4])}</span>` : ''}</td><td class="ntact hanote" title="${esc(t('ha_note'))}">✎</td></tr>`; });
    tabGrid(box0, `<table><tr><th>${esc(t('col_type'))}</th><th>${esc(t('date'))}</th><th>${esc(t('col_time'))}</th><th>${esc(t('dur'))}</th><th>${esc(t('col_text'))}</th><th></th></tr>${rows.join('')}</table>`,
      { head: `<h3>📡 ${esc(t('ha_list', { n: hl.length }))}</h3>`, onRow: (ds, e) => { const x = hl[+ds.i]; if (!x) return;
        if (e.target.closest('.hanote')) { haPop({ a: x[0], b: x[1], name: x[2], rid: x[3], note: x[4] || '' }); return; }
        dtFocus(x[0], x[1]); } });
  }
}
function nightGeom(cv) {
  fit(cv);
  const d = DPR(), w = cv.width, h = cv.height, L = 58 * d, R = 14 * d;
  return { d, w, h, L, R, pw: w - L - R };
}
function smoothLevels(lv) {
  const out = [];
  for (let i = 0; i < lv.length; i++) {
    let s = 0, n = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(lv.length - 1, i + 2); k++) if (lv[k][1] != null && Math.abs(lv[k][0] - lv[i][0]) <= 2) { s += lv[k][1]; n++; }
    out.push([lv[i][0], n ? s / n : null, lv[i][2], lv[i][3]]);
  }
  return out;
}
function curve(c, pts) {                      // weiche Kurve (Catmull-Rom -> Bezier)
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
}
function drawNight() {
  if (!$('ncv').offsetParent) return;                // Minutenkurve ist im Reiter Protokolle durch den Verlauf ersetzt
  const nd = NV.data; if (!nd || !NV.open) return;
  const cv = $('ncv'), g = nightGeom(cv), c = cv.getContext('2d'), { d, w, h, L, pw } = g, T = 26 * d, B = 8 * d, ph = h - T - B;
  const total = Math.max(1, nd.minutes), X = m => L + pw * m / total;
  const lv = smoothLevels(nd.levels);
  const vals = []; lv.forEach(r => { if (r[1] != null) vals.push(r[1]); if (r[2] != null) vals.push(r[2]); }); nd.events.forEach(e => { if (e.peak != null) vals.push(e.peak); });
  let lo = vals.length ? Math.floor((Math.min(...vals) - 5) / 10) * 10 : -100, hi = vals.length ? Math.ceil((Math.max(...vals) + 5) / 10) * 10 : -20;
  if (hi - lo < 30) hi = lo + 30;
  const Y = v => T + ph * (1 - (v - lo) / (hi - lo));
  c.clearRect(0, 0, w, h);
  c.font = (11 * d) + 'px system-ui'; c.textAlign = 'right'; c.lineWidth = 1;
  const ng = dbTicks(lo, hi, ph, 22);
  drawDbGrid(c, ng.ticks.map(k => { const y = Y(k.v); return { y, major: k.major, text: (y < T + 12 * d || y > T + ph - 12 * d) ? null : ng.fmt(k.v) }; }), L, pw, d, true, NC.l2, NC.mut);   // Platz fuer laut/ruhig
  c.textAlign = 'left'; c.fillStyle = NC.mut; c.font = '600 ' + (11 * d) + 'px system-ui';
  c.fillText(t('n_loud'), 4 * d, T + 4 * d); c.fillText(t('n_calm'), 4 * d, T + ph - 2 * d);
  // Stundenlinien
  const s0 = new Date(nd.start);
  const qMin = pw / d / (total / 60) > 90 ? 15 : 30;          // Zwischenlinien je nach Breite alle 15 bzw. 30 min
  c.strokeStyle = NC.l1;
  for (const m of hourMarks(s0, total, qMin)) { const x = Math.round(X(m)) + .5; c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke(); }
  c.strokeStyle = NC.l2;
  for (const m of hourMarks(s0, total)) { const x = Math.round(X(m)) + .5; c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke(); }
  // Segmente ohne Luecken > 3 min
  const segs = []; let seg = null, last = null;
  for (const r of lv) { if (r[1] == null) continue; if (last != null && r[0] - last > 3) seg = null; if (!seg) { seg = []; segs.push(seg); } seg.push([X(r[0]), Y(r[1])]); last = r[0]; }
  const grad = c.createLinearGradient(0, T, 0, T + ph); grad.addColorStop(0, ca(NC.acc, .5)); grad.addColorStop(1, ca(NC.acc, .02));
  for (const sg of segs) {
    if (sg.length < 2) continue;
    c.beginPath(); curve(c, sg); c.lineTo(sg[sg.length - 1][0], T + ph); c.lineTo(sg[0][0], T + ph); c.closePath(); c.fillStyle = grad; c.fill();
    c.beginPath(); curve(c, sg); c.strokeStyle = NC.acc; c.lineWidth = 2.4 * d; c.lineJoin = 'round'; c.stroke();
  }
  // Spitzen (duenn)
  c.beginPath(); last = null;
  for (const r of nd.levels) { if (r[2] == null) { last = null; continue; } const x = X(r[0]), y = Y(r[2]); if (last == null || r[0] - last > 3) c.moveTo(x, y); else c.lineTo(x, y); last = r[0]; }
  c.strokeStyle = ca(NC.acc, .35); c.lineWidth = 1 * d; c.stroke();
  // Schwelle
  const thr = nd.levels.map(r => r[3]).filter(v => v != null).sort((a, b) => a - b);
  if (thr.length) { const tv = thr[thr.length >> 1], y = Y(tv); c.setLineDash([8 * d, 5 * d]); c.strokeStyle = NC.warn; c.lineWidth = 1.6 * d; c.beginPath(); c.moveTo(L, y); c.lineTo(L + pw, y); c.stroke(); c.setLineDash([]);
    c.textAlign = 'left'; lblBox(c, t('threshold') + ' ' + tv.toFixed(1), L + 6 * d, y - 6 * d, NC.warn, d); }
  if (NV.src && NV.src !== 'all') drawRefs(c, curRefs(NV.src), v => [Y(v)], lo, hi, L, pw, T, ph, d);
  // Ereignis-Markierungen in der Kurve
  for (const e of nd.events) { if (e.mf && !MF.show) continue; const x = X(e.o); c.strokeStyle = e.mf ? ca(NC.mut, .3) : ca(NC.red, .35); c.lineWidth = 1 * d; c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke(); }
  // Hover
  const hv = NV.hover;
  if (hv != null) {
    const m = (hv * d - L) / pw * total;
    if (m >= 0 && m <= total) {
      const x = X(m); c.strokeStyle = NC.l3; c.lineWidth = 1 * d; c.beginPath(); c.moveTo(x, T - 6 * d); c.lineTo(x, T + ph); c.stroke();
      let best = null; for (const r of lv) if (r[1] != null && (!best || Math.abs(r[0] - m) < Math.abs(best[0] - m))) best = r;
      if (best && Math.abs(best[0] - m) < 4) { c.fillStyle = NC.tx; c.beginPath(); c.arc(X(best[0]), Y(best[1]), 4 * d, 0, 7); c.fill(); }
      const tm = new Date(s0.getTime() + m * 60000), near = nearEvent(m, 6 * total / (pw / d));
      const b = $('nbubble'); b.style.display = 'block';
      b.innerHTML = `<b>${pad(tm.getHours())}:${pad(tm.getMinutes())}</b> · ${best && best[1] != null ? best[1].toFixed(1) + ' dBFS' : '–'}` +
        (near ? ` · <span style="color:${NC.red}">${esc(near.name)} ${esc(fmtDur(near.dur))}${near.file ? ' ▶' : ''}</span>` : '');
      const bw = b.offsetWidth, cw = cv.clientWidth; b.style.left = clamp(hv, bw / 2 + 2, Math.max(bw / 2 + 2, cw - bw / 2 - 2)) + 'px';
    }
  } else $('nbubble').style.display = 'none';
  drawTrack(total, s0);
}
function hourMarks(s0, total, stepMin) {   // volle Stunden (bzw. Viertelstunden) in echter Zeit (bei Zeitumstellung doppelt bzw. ausgelassen)
  const ms = (stepMin || 60) * 60000, out = [], t0 = s0.getTime(); let h = Math.ceil(t0 / ms) * ms;
  for (; (h - t0) / 60000 <= total; h += ms) out.push((h - t0) / 60000);
  return out;
}
function nearEvent(m, tol) { let best = null; for (const e of NV.data.events) { const dm = Math.abs(e.o - m); if (dm <= tol && (!best || dm < Math.abs(best.o - m))) best = e; } return best; }
function drawTrack(total, s0) {
  const cv = $('ntrack'), g = nightGeom(cv), c = cv.getContext('2d'), { d, w, h, L, pw } = g, mid = 30 * d;
  const X = m => L + pw * m / total;
  c.clearRect(0, 0, w, h);
  c.fillStyle = NC.mut; c.font = '600 ' + (11 * d) + 'px system-ui'; c.textAlign = 'left'; { const lt = t('n_events'), fits = 4 * d + c.measureText(lt).width + 6 * d <= L; c.fillText(lt, 4 * d, fits ? mid + 4 * d : mid - 12 * d); }   // passt der Text nicht vor die Linie (Handy), steht er darueber
  c.strokeStyle = NC.l2; c.lineWidth = 1 * d; c.beginPath(); c.moveTo(L, mid); c.lineTo(L + pw, mid); c.stroke();
  NV.hits = [];
  const peaks = NV.data.events.map(e => e.peak).filter(v => v != null), plo = peaks.length ? Math.min(...peaks) - 3 : -90, phi = peaks.length ? Math.max(...peaks) : -20;
  NV.data.events.forEach((e, i) => {
    const hid = e.mf && !MF.show;                     // nach Muster ausgefiltert: nur gedimmt (nicht anklickbar), mit „ausgefilterte zeigen“ grau und anklickbar
    const x = X(e.o), wd = Math.max(4 * d, X(e.o + (e.dur || 0.02) / 60) - x), hh = (7 + 14 * Math.max(0, Math.min(1, ((e.peak ?? plo) - plo) / Math.max(1, phi - plo)))) * d;
    c.fillStyle = hid ? ca(NC.mut, .18) : e.mf ? ca(NC.mut, .45) : NC.red;
    c.beginPath(); if (c.roundRect) c.roundRect(x - wd / 2, mid - hh, wd, hh * 2, 2 * d); else c.rect(x - wd / 2, mid - hh, wd, hh * 2); c.fill();
    if (!hid) NV.hits.push({ x0: (x - wd / 2 - 6 * d) / d, x1: (x + wd / 2 + 6 * d) / d, i });
  });
  // Stunden
  c.fillStyle = NC.mut; c.font = (12 * d) + 'px system-ui'; c.textAlign = 'center';
  const perH = pw / d / (total / 60), ty = h - 26 * d;
  c.fillStyle = NC.l3;
  for (const m of hourMarks(s0, total, perH > 90 ? 15 : 30)) c.fillRect(Math.round(X(m)), ty, 1 * d, 3 * d);
  c.fillStyle = NC.mut;
  for (const m of hourMarks(s0, total)) {
    const tm = new Date(s0.getTime() + m * 60000), x = X(m);
    c.fillRect(Math.round(x), ty, 1 * d, 6 * d); c.fillText(pad(tm.getHours()) + (perH > 70 || tm.getMinutes() ? ':' + pad(tm.getMinutes()) : ''), x, h - 10 * d);
  }
}
function playEvent(i) {                                // Stoerung im Nachtbericht: Ansicht mit Ablauf oeffnen
  const e = NV.data.events[i];
  if (e && e.k) openEvent(e.k, null, true);
}
function initNight() {
  $('tab_live').onclick = () => showTab('live'); $('tab_prot').onclick = () => showTab('prot');
  try { const p = localStorage.getItem('laerm_per'); if (['win', 'today', 'yest', '7', '30', 'free'].includes(p)) NV.per = p; } catch (e) { }
  const step = k => {                               // ‹ ›: um einen ganzen Zeitraum weiter
    const n = NV.per === '7' ? 7 : NV.per === '30' ? 30 : NV.per === 'free' ? Math.round((parseDay(NV.to) - parseDay(NV.from)) / 864e5) + 1 : 1;
    const mv = ds => { const dd = parseDay(ds); dd.setDate(dd.getDate() + k * n); return isoDay(dd); };
    const lim = NV.per === 'win' ? nightDefault() : isoDay(new Date());
    if (NV.per === 'free') { const nt = mv(NV.to); if (nt > lim) return; NV.from = mv(NV.from); NV.to = nt; }
    else { const nd = mv(NV.date); if (nd > lim) return; NV.date = nd; }
    loadNight();
  };
  $('nprev').onclick = () => step(-1); $('nnext').onclick = () => step(1);
  $('ndate').onchange = e => { if (e.target.value) { const lim = NV.per === 'win' ? nightDefault() : isoDay(new Date()); NV.date = e.target.value > lim ? lim : e.target.value; loadNight(); } };
  $('nfrom').onchange = e => { if (e.target.value) { NV.from = e.target.value; loadNight(); } };
  $('nto').onchange = e => { if (e.target.value) { NV.to = e.target.value; loadNight(); } };
  document.querySelectorAll('#nper button').forEach(b => b.onclick = () => perSet(b.dataset.p));
  $('nsrc').onchange = e => { NV.src = e.target.value; loadNight(); };
  const cv = $('ncv');
  cv.addEventListener('pointermove', e => { NV.hover = e.clientX - cv.getBoundingClientRect().left; drawNight(); });
  cv.addEventListener('pointerleave', () => { NV.hover = null; drawNight(); });
  const pick = (cvx, e) => {
    const x = e.clientX - cvx.getBoundingClientRect().left;
    let hit = NV.hits.find(hh => x >= hh.x0 && x <= hh.x1);
    if (!hit && cvx === cv && NV.data) { const g = nightGeom(cv); const m = (x * g.d - g.L) / g.pw * NV.data.minutes; const ne = nearEvent(m, 6 * NV.data.minutes / (g.pw / g.d)); if (ne) hit = { i: NV.data.events.indexOf(ne) }; }
    if (hit) playEvent(hit.i);
  };
  $('ntrack').addEventListener('click', e => pick($('ntrack'), e)); cv.addEventListener('click', e => pick(cv, e));
  window.addEventListener('resize', () => { if (NV.open) drawNight(); });
  perSet(NV.per, true);                              // gemerkter Zeitraum (z. B. Gestern) gilt auch beim Öffnen
  let tab = 'live'; try { tab = localStorage.getItem('laerm_tab') || 'live'; } catch (e) { }
  if (tab === 'night' || tab === 'prot') showTab(tab);
}

async function init() {
  applyTheme(); readColors(); buildLUT();
  const layP = Promise.race([layoutFetch(), new Promise(r => setTimeout(r, 2500))]);     // Anordnung vom Server (gleich auf PC und Handy)
  try { const r = await (await fetch('settings', { cache: 'no-store' })).json(); CUR = r.settings; setTimeout(qtModeApply, 0); SRC = r.sources || []; SCHED = r.schedule || []; MIRROR_ST = r.mirror || null; if (r.pro && r.pro.state) PRO = r.pro; } catch (e) { }
  pickLang(CUR && CUR.language); await layP; dashInit(); capApply(); statLoad(); mfLoad(); setTimeout(qtPlace, 500); tr(); setLive(true); syncRec(null); initHelp();
  proBanner(); setInterval(proLoad, 6 * 3600 * 1000);
  bindCanvas($('main'), false); bindCanvas($('spec'), true); bindChartKeys($('main')); document.querySelectorAll('dialog').forEach((d, i) => { const h = d.querySelector('h3,h2'); if (h && !d.hasAttribute('aria-labelledby')) { h.id = h.id || 'dlgh' + i; d.setAttribute('aria-labelledby', h.id); } }); $('spec').setAttribute('aria-hidden', 'true'); chartLabel(true);
  $('livebtn').addEventListener('click', () => setLive(!view.live));
  $('vidrot').onclick = vidRotate; $('vidsz').onclick = vidSize; $('vidfs').onclick = vidFull; $('vidframe').onclick = vidFull;
  for (const [id, k] of [['vidrot', 'vid_rot_tip'], ['vidsz', 'vid_size_tip'], ['vidfs', 'vid_full_tip']]) { $(id).title = t(k); $(id).setAttribute('aria-label', t(k)); }
  document.addEventListener('fullscreenchange', vidLayout); addEventListener('resize', () => { if (!$('vidlive').hidden) vidLayout(); });
  $('golive').addEventListener('click', goLive);
  $('themebtn').onclick = () => { THEME = THEME === 'auto' ? 'light' : THEME === 'light' ? 'dark' : 'auto'; try { localStorage.setItem('laerm_theme', THEME); } catch (e) { } applyTheme(); readColors(); if (NV.open) drawNight(); };
  setInterval(() => { if (THEME === 'auto') applyTheme(); }, 4000);
  $('laybtn').onclick = e => buildLayerPop(e.currentTarget); $('evlay').onclick = e => buildLayerPop(e.currentTarget);
  $('classrange').addEventListener('click', classifyRange);
  $('chkopen').onclick = () => $('chkdlg').showModal(); $('chkx').onclick = () => $('chkdlg').close();
  $('chkdlg').addEventListener('close', () => { $('chkaudio').pause(); });
  $('chkfile').onchange = e => { checkFile(e.target.files[0]); e.target.value = ''; };
  { const af = $('artflt'); for (const [v, l] of [['', t('art_all')], ['_notes', '📝 ' + t('nt_with')], ...ART_ORDER.map(g => [g, ART_ICON[g] + ' ' + artName(g)]), ['_none', t('art_none')]]) option(af, v, l); af.onchange = () => { ARTSEL.clear(); if (af.value) ARTSEL.add(af.value); artApply(); }; artMsBuild(); }
  $('notesopen').onclick = openAllNotes; ntaBind();
  $('recbtn').addEventListener('click', e => { e.stopPropagation(); toggleRec(); });
  $('tileplay').onclick = () => {
    if (rotActive()) { TILE.on = false; } else { TILE.on = true; TILE.manual = false; }
    try { localStorage.setItem('laerm_tileshow', TILE.on ? '1' : '0'); } catch (e) { }
    TILE.at = Date.now(); tileBar(); evFollow();
  };
  $('tileset').onclick = e => { e.stopPropagation(); tileSetPop(); };
  setInterval(tileTick, 500);
  $('hbbtn').onclick = () => hbOpen('');
  $('hmore').onclick = toggleHMenu; placeHeader(); MOBILE.addEventListener('change', placeHeader);
  $('evx').onclick = () => $('evdlg').close();
  $('enote').addEventListener('blur', enoteSave);
  $('evdlg').addEventListener('close', () => { if (NV.open) setTimeout(loadNight, 300); });   // Notizen/Listen geaendert: Protokolle auffrischen
  $('evdlg').addEventListener('close', () => { enoteSave(); if (EVV.a) EVV.a.pause(); $('evvid').pause(); $('evaudio').pause(); cancelAnimationFrame(EVV.raf); lbPopClose(); $('sgpop').hidden = true; EVV.sel = null; });
  $('evvid').addEventListener('click', () => $('evplay').click());
  $('evplay').onclick = () => { if (!EVV.a) return; if (EVV.a.paused) { if (EVV.snd && EVV.a.currentTime < 0.05) EVV.a.currentTime = EVV.aOff || 0; EVV.a.play(); } else EVV.a.pause(); };   // mit Ton: am Anfang der Aufnahme beginnen, nicht im stillen Umfeld
  $('evcv').addEventListener('click', evSeek); $('evsp').addEventListener('click', evSeek); ntBind(); lbBind();
  $('lbsave').onclick = lbSave; $('lbcancel').onclick = () => { lbPopClose(); EVV.sel = null; evDraw(); };
  $('lbname').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); lbSave(); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); $('lbcancel').click(); } };
  $('sgpop').addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); $('sgpop').hidden = true; } });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#sgpop,#evcv')) $('sgpop').hidden = true; });
  $('simx').onclick = () => $('simdlg').close();
  window.addEventListener('resize', () => { if ($('evdlg').open) evDraw(); });
  document.addEventListener('keydown', e => {            // Taste Ende oder L = zurueck zu Live
    if (e.target.closest && e.target.closest('input,select,textarea,dialog')) return;
    if ((e.key === 'End' || e.key === 'l' || e.key === 'L') && !NV.open && !e.ctrlKey && !e.metaKey && !e.altKey) { goLive(); e.preventDefault(); }
  });
  $('m_level').onclick = () => { setMode('level'); if (histOn()) dtLoad(LDT, true); }; $('m_wave').onclick = () => { setMode('wave'); if (histOn()) dtLoad(LDT, true); };
  $('span').onchange = e => { const v = parseFloat(e.target.value); if (!e.target.selectedOptions[0].dataset.cus) view.preset = v; setSpan(v); };
  $('zin').onclick = () => zoomY(1 / 1.3);
  $('zout').onclick = () => zoomY(1.3);
  $('zauto').onclick = () => { yv.auto = !yv.auto; syncAutoBtn(); };
  $('sbtn').onclick = openSettings; $('ssave').onclick = saveSettings; $('calbtn').onclick = calibrate;
  // Schliessen mit ungespeicherten Aenderungen: nachfragen (auch bei Escape)
  const closeSettings = () => { if (formDirty && !confirm(t('unsaved_q'))) return; formDirty = false; $('dlg').close(); };
  $('scancel').onclick = closeSettings; $('sx').onclick = closeSettings;
  $('dlg').addEventListener('keydown', e => { if (e.key === 'Escape' && formDirty) { e.preventDefault(); e.stopPropagation(); closeSettings(); } });
  $('dlg').addEventListener('cancel', e => { if (formDirty) e.preventDefault(); });
  $('diagbox').addEventListener('toggle', () => { diagT = 0; loadDiag(); });
  document.addEventListener('keydown', e => { if (e.key === ' ' && !$('dlg').open && e.target === document.body) { e.preventDefault(); setLive(!view.live); } });
  setSpan(60); setMode('level');
  { // Anzahl: feste Werte oder eigene Zahl (1-5000)
    const sel = $('evn'), inp = $('evnc');
    const setN = n => { EVN = n; try { localStorage.setItem('laerm_evn', EVN); } catch (e) { } loadEvents(); };
    const show = () => { sel.value = String(EVN); const fixed = sel.value === String(EVN); if (!fixed) sel.value = 'c'; inp.hidden = sel.value !== 'c'; inp.value = EVN || ''; };
    show();
    sel.onchange = () => { if (sel.value === 'c') { inp.hidden = false; inp.value = EVN || 200; inp.focus(); inp.select(); } else { inp.hidden = true; setN(+sel.value); } };
    const take = () => { const n = Math.round(+inp.value); if (!(n >= 1)) { inp.value = EVN || ''; return; } const v = Math.min(5000, n); inp.value = v; if (v !== EVN) setN(v); };
    inp.onchange = take; inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); take(); inp.blur(); } };
  }
  $('plmove').onchange = async e => { const id = e.target.value; e.target.value = ''; if (!id) return; const keys = selectedKeys(); if (!keys.length) return;
    try { await plPost('plist_mem', { id, keys, add: true }); $('artstat').textContent = t('pl_added', { n: keys.length, l: plName(id) }); } catch (x) { alert(t('saveerr')); } };
  $('pladd').onclick = () => plFormOpen('add'); $('plren').onclick = () => plFormOpen('ren'); $('plok').onclick = plFormOk; $('plcancel').onclick = () => { $('plform').hidden = true; };
  $('plname').onkeydown = e => { if (e.key === 'Enter') plFormOk(); else if (e.key === 'Escape') $('plform').hidden = true; };
  $('nplist').onchange = () => { PV.cur = $('nplist').value; try { localStorage.setItem('laerm_plist', PV.cur); } catch (e) { } plRefresh(); loadNight(); };
  $('pldel').onclick = async () => { if (!PV.cur || !confirm(t('pl_del_q', { n: plName(PV.cur) }))) return; try { await plPost('plist_del', { id: PV.cur }); PV.cur = ''; plRefresh(); loadNight(); } catch (e) { alert(t('saveerr')); } };
  $('plrmsel').onclick = async () => { const keys = selectedKeys(); if (!PV.cur || !keys.length) return; try { await plPost('plist_mem', { id: PV.cur, keys, add: false }); loadNight(); } catch (e) { alert(t('saveerr')); } };
  $('plnote').addEventListener('blur', plNoteSave);
  plFetch();
  $('artsel').onclick = () => recheckEvents([...SEL].map(k => (EV.events.find(r => ek(r) === k) || {}).datei).filter(Boolean));
  $('delsel').onclick = () => deleteEvents(selectedKeys()); $('delnone').onclick = () => { SEL.clear(); evSelToggle([], false); }; $('srcadd').onclick = () => { openSettings().then(() => { const b = openSec('srcbox'); if (b) b.scrollIntoView(); }); };
  $('qx').onclick = () => $('qrdlg').close();
  await loadSources(); setInterval(() => { if (!document.hidden) loadSources(); }, 2000);
  setInterval(() => { if (NV.open && !document.hidden) { loadEvents(); if (DT.from == null && !DT.drag && NV.data && new Date(NV.data.end).getTime() > nowServer()) dtLoad(DT, true); } }, 60000);   // laufender Tag: Verlauf wächst rechts mit
  initNight(); initDayTrack(); initFn(); initLev(); diagApply();
  poll(); requestAnimationFrame(t0 => { lastFrame = t0; frame(t0); });
}
/* ================= Einpegeln der Geräte ================= */
const fmtStamp = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const CALV = { timer: null, last: null };
/* Testgeräusch (gleichmäßiges rosa Rauschen) für das Einpegeln – hier im Browser abgespielt */
const TONE = { ctx: null, src: null, gain: null };
function toneLocal(on, vol) {
  try {
    if (on && !TONE.src) {
      const c = TONE.ctx || (TONE.ctx = new (window.AudioContext || window.webkitAudioContext)()); if (c.state === 'suspended') c.resume();
      const n = c.sampleRate * 4, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
      TONE.gain = c.createGain(); TONE.gain.gain.value = vol == null ? 0.7 : vol; TONE.src = c.createBufferSource(); TONE.src.buffer = b; TONE.src.loop = true; TONE.src.connect(TONE.gain); TONE.gain.connect(c.destination); TONE.src.start();
    } else if (!on && TONE.src) { TONE.src.stop(); TONE.src = null; }
    else if (on && TONE.gain && vol != null) TONE.gain.gain.value = vol;
  } catch (e) { TONE.src = null; }
  return !!TONE.src;
}
function calBox() {
  const fs = el('fieldset', { id: 'calbox' }); fs.dataset.sec = 's_cal';
  const lg = el('legend', { textContent: t('s_cal') }); const ti = tipIcon('t_cal'); if (ti) lg.appendChild(ti); fs.appendChild(lg);
  fs.appendChild(el('small', { className: 'calhelp', textContent: t('h_cal') }));
  const r1 = el('div', { className: 'calrow' });
  let off = new Set(); try { off = new Set(JSON.parse(localStorage.getItem('laerm_caloff') || '[]')); } catch (e) { }   // abgewählte Geräte (pro Browser)
  const devs = el('div', { id: 'caldevs', className: 'caldevs' });
  devs.appendChild(el('span', { className: 'caldl', textContent: t('cal_devs') }));
  SOURCES.forEach(s => { const l = el('label', { className: 'chip' }), c = el('input', { type: 'checkbox', checked: !off.has(s.id) }); c.dataset.id = s.id;
    c.onchange = () => { c.checked ? off.delete(s.id) : off.add(s.id); try { localStorage.setItem('laerm_caloff', JSON.stringify([...off])); } catch (e) { } go.disabled = calIds().length < 2; };
    l.append(c, document.createTextNode(' ' + s.name)); devs.appendChild(l); });
  const calIds = () => [...devs.querySelectorAll('input:checked')].map(c => c.dataset.id);
  fs.appendChild(devs);
  const secs = el('select', { id: 'calsecs', title: t('cal_secs') }); for (const v of [10, 15, 30]) option(secs, v, v + ' s'); secs.value = '15';
  const go = el('button', { type: 'button', className: 'pri', id: 'calgo', textContent: t('cal_start') });
  const L = (txt, e) => { const l = el('label'); l.append(txt + ' ', e); return l; };
  const tone = el('select', { id: 'caltone', title: t('cal_tone_tip') });
  option(tone, '', t('cal_tone_none')); option(tone, 'here', '🔊 ' + t('cal_tone_here'));
  SOURCES.filter(x => x.type === 'phone').forEach(x => option(tone, x.id, '📱 ' + t('cal_tone_phone', { n: x.name })));
  try { const v = localStorage.getItem('laerm_caltone'); if (v != null && [...tone.options].some(o => o.value === v)) tone.value = v; } catch (e) { }
  const probe = el('button', { type: 'button', className: 'chip', textContent: '▶ ' + t('cal_probe') });
  probe.onclick = () => { const on = !TONE.src; toneLocal(on); probe.textContent = (on ? '■ ' : '▶ ') + t(on ? 'cal_probe_stop' : 'cal_probe'); };
  const syncTone = () => { probe.hidden = tone.value !== 'here'; try { localStorage.setItem('laerm_caltone', tone.value); } catch (e) { }
    const ph = tone.value && tone.value !== 'here' ? tone.value : ''; devs.querySelectorAll('input').forEach(c => { const own = c.dataset.id === ph; c.closest('label').classList.toggle('caltonedev', own); c.closest('label').title = own ? t('cal_tone_self') : ''; }); };
  tone.onchange = syncTone;
  r1.append(L(t('cal_secs'), secs), L(t('cal_tone'), tone), probe, go); fs.appendChild(r1); go.disabled = calIds().length < 2; syncTone();
  fs.appendChild(el('small', { className: 'calhelp', textContent: t('cal_place') }));
  fs.appendChild(el('div', { id: 'calsteps', className: 'calsteps', hidden: true }));
  fs.appendChild(el('div', { id: 'callive', className: 'callive', hidden: true }));
  fs.appendChild(el('div', { id: 'calst', className: 'calst' }));
  fs.appendChild(el('div', { id: 'calres', className: 'calres' }));
  const r2 = el('div', { className: 'calrow', id: 'calact' }); r2.hidden = true;
  const note = el('input', { type: 'text', id: 'calnote', maxLength: 300, placeholder: t('cal_note_ph'), className: 'wide' });
  const ap = el('button', { type: 'button', className: 'pri', textContent: t('cal_apply') });
  const ck = el('button', { type: 'button', textContent: t('cal_check') });
  const ds = el('button', { type: 'button', textContent: t('cal_discard') });
  r2.append(note, ap, ck, ds); fs.appendChild(r2);
  fs.appendChild(el('div', { id: 'callog', className: 'callog' }));
  go.onclick = async () => {
    try { const r = await (await fetch('cal_start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secs: +secs.value, ids: calIds().filter(id => id !== tone.value), tone: tone.value && tone.value !== 'here' ? tone.value : null }) })).json(); if (!r.ok) throw new Error(r.error); toneLocal(false); probe.textContent = '▶ ' + t('cal_probe'); calPoll(); }
    catch (e) { $('calst').textContent = t('saveerr') + ' ' + e.message; }
  };
  const fin = async apply => {
    try {
      const r = await (await fetch('cal_apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apply, note: note.value }) })).json();
      if (!r.ok) throw new Error(r.error);
      if (r.sources) SOURCES = r.sources;
      note.value = ''; buildSources(); $('calst').textContent = t(apply ? 'cal_done_apply' : 'cal_done_check');
    } catch (e) { $('calst').textContent = t('saveerr') + ' ' + e.message; }
  };
  ap.onclick = () => fin(true); ck.onclick = () => fin(false);
  ds.onclick = async () => { try { await fetch('cal_cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } catch (e) { } calPoll(); };
  setTimeout(calPoll, 0);
  return fs;
}
async function calPoll() {
  clearTimeout(CALV.timer);
  let c; try { c = await (await fetch('cal_status', { cache: 'no-store' })).json(); } catch (e) { return; }
  if (!$('calbox')) return;
  CALV.last = c;
  const st = $('calst'), go = $('calgo'), act = $('calact'), res = $('calres');
  const sec = x => Math.max(0, Math.ceil((x - c.now) / 1000));
  go.disabled = c.state === 'running' || document.querySelectorAll('#caldevs input:checked').length < 2; act.hidden = c.state !== 'done';
  const stp = $('calsteps'), lv = $('callive'), here = $('caltone') && $('caltone').value === 'here';
  if (c.state === 'running') {
    const ph = c.now < c.q1 ? 1 : c.now < c.t1 ? 2 : 3;
    stp.hidden = false; stp.innerHTML = [t('cal_step1'), t('cal_step2'), t('cal_step3')].map((x, i) => `<span class="${i + 1 === ph ? 'on' : i + 1 < ph ? 'done' : ''}">${i + 1 < ph ? '✓' : i + 1} ${esc(x)}</span>`).join('');
    if (here) toneLocal(c.now >= c.q1 && c.now < c.t1);                 // Testgeräusch hier: nach der Ruhe bis zum Ende der Messung
    const live = c.live || {}; lv.hidden = !Object.keys(live).length;
    lv.innerHTML = Object.keys(live).map(id => { const v = live[id], w = v == null ? 0 : clamp((v + 90) / 70 * 100, 0, 100);
      return `<div class="callv${id === c.tone ? ' tone' : ''}"><span>${esc(viewName(id))}${id === c.tone ? ' 🔊' : ''}</span><i><b style="width:${w}%"></b></i><small>${v == null ? '–' : v.toFixed(1)}</small></div>`; }).join('');
    st.textContent = c.now < c.q1 ? t('cal_q', { s: sec(c.q1) }) : c.now < c.t0 ? t(c.tone || here ? 'cal_on_auto' : 'cal_on', { s: sec(c.t0) }) : c.now < c.t1 ? t('cal_meas', { s: sec(c.t1) }) : t('cal_eval');
    st.className = 'calst run' + (c.now >= c.q1 && c.now < c.t0 ? ' go' : '');
    res.innerHTML = '';
    if ($('dlg').open) CALV.timer = setTimeout(calPoll, 400);
  } else if (c.state === 'done') {
    if (here) toneLocal(false); stp.hidden = true; lv.hidden = true;
    st.className = 'calst'; st.textContent = c.msg === 'few' ? t('cal_few') : t('cal_result') + (c.target != null ? ' ' + t('cal_target', { v: c.target.toFixed(1) }) : '');
    const nm = id => viewName(id);
    tabGrid(res, `<table class="caltab"><thead><tr><th>${esc(t('cmp_dev'))}</th><th>${esc(t('cal_th_quiet'))}</th><th>${esc(t('cal_th_lvl'))}</th><th>${esc(t('cal_th_dev'))}</th><th>${esc(t('cal_th_gain'))}</th></tr></thead><tbody>` +
      c.res.map(e => `<tr class="${e.ok ? '' : 'bad'}"><td>${esc(e.name || nm(e.id))}</td><td>${e.quiet != null ? e.quiet.toFixed(1) : '–'}</td><td>${e.level != null ? e.level.toFixed(1) : '–'}${e.std != null ? ' <small>±' + e.std.toFixed(1) + '</small>' : ''}</td>` +
        `<td>${e.ok ? (e.delta >= 0 ? '+' : '') + e.delta.toFixed(1) + ' dB' : esc(t('cal_bad_' + (e.why || 'nodata')))}<br><small>${esc(t('cal_fix_' + (e.why || 'nodata')))}</small></td><td>${e.ok && e.gain_new != null ? esc(String(e.gain_old)) + ' → <b>' + esc(String(e.gain_new)) + '</b> dB' : '–'}</td></tr>`).join('') + '</tbody></table>');
    act.querySelectorAll('button')[0].disabled = act.querySelectorAll('button')[1].disabled = c.msg === 'few';
  } else { if (here && CALV.wasRun) toneLocal(false); stp.hidden = true; lv.hidden = true; st.className = 'calst'; if (!/✓|festgehalten|recorded/.test(st.textContent)) st.textContent = ''; res.innerHTML = ''; }
  CALV.wasRun = c.state === 'running';
  const lg = $('callog');
  lg.innerHTML = c.log && c.log.length ? `<b>${esc(t('cal_log_head'))}</b>` + c.log.map(e => `<div>${esc(fmtStamp(e.at))} · ${esc(t(e.kind === 'apply' ? 'cal_kind_apply' : 'cal_kind_check'))} · ` +
    (e.res || []).map(x => esc(x.name) + ' ' + (x.ok ? (x.level != null ? x.level.toFixed(1) : '') + (e.kind === 'apply' && x.gain_new != null ? ' (' + x.gain_old + '→' + x.gain_new + ' dB)' : '') : '–')).join(' · ') + (e.note ? ' · ' + esc(e.note) : '') + '</div>').join('') : '';
}

/* ================= Vergleich der Geräte im Ereignis ================= */
function renderCmp(j) {
  const box = $('evcmp'); const c = j.cmp || []; EVV.cmp = null;
  if (c.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
  const v = c.filter(x => x.peak != null).sort((a, b) => b.peak - a.peak), top = v.length ? v[0].peak : null;
  const lead = v.filter(x => top - x.peak < 1).map(x => x.name);
  box.hidden = false;
  tabGrid(box, `<h4 class="nthead">${esc(t('cmp_head'))}</h4><div class="cmplead">${esc(lead.length === 1 ? t('cmp_loudest', { n: lead[0] }) : t('cmp_equal', { n: lead.join(', ') }))}</div>` +
    `<table class="cmptab"><thead><tr><th>${esc(t('cmp_dev'))}</th><th>${esc(t('cmp_peak'))}</th><th>${esc(t('cmp_diff'))}</th><th>${esc(t('cmp_cal'))}</th></tr></thead><tbody>` +
    v.concat(c.filter(x => x.peak == null)).map(x => `<tr${x.peak === top ? ' class="top"' : ''}><td>${esc(x.name)}${x.own ? ' <small>(' + esc(t('cmp_trig')) + ')</small>' : ''}</td><td>${x.peak != null ? x.peak.toFixed(1) + ' dBFS' : '–'}</td>` +
      `<td>${x.peak != null ? (x.peak === top ? '–' : (x.peak - top).toFixed(1) + ' dB') : '–'}</td><td>${x.cal.ok ? '✓ ' + esc(fmtStamp(x.cal.at)) : x.cal.changed ? '⚠ ' + esc(t('cal_changed')) : esc(t('cal_none'))}</td></tr>`).join('') +
    `</tbody></table><div class="cmpcvs" id="cmpcvs"></div><small class="cmphint">${esc(t('cmp_hint'))}</small>`);
  const rows = c.map(x => ({ name: x.name, own: x.own, g: x.own ? EVV.g : x.graph })).filter(x => x.g && x.g.recs && x.g.recs.length);
  const wrap = $('cmpcvs');
  rows.forEach(x => { x.R = x.own ? EVV.d : evDecode(x.g); x.cv = el('canvas', { className: 'cmpcv' }); const lab = el('div', { className: 'cmplab', textContent: x.name }); wrap.append(lab, x.cv); });
  let hist = new Uint32Array(256), n = 0;                  // gemeinsame Farbskala: Lautstärken sind zwischen den Geräten vergleichbar
  rows.forEach(x => { const nb = x.R.nb || NB; for (const r of x.R) for (let k = 0; k < nb; k++) { hist[r.sp[k]]++; n++; } });
  const pct = q => { let a = 0; for (let v2 = 0; v2 < 256; v2++) { a += hist[v2]; if (a >= q * n) return v2; } return 255; };
  const lo = pct(0.05), hi = Math.max(pct(0.997), lo + 40);
  rows.forEach(x => {
    const R = x.R, nb = R.nb || NB, tc = document.createElement('canvas'); tc.width = R.length; tc.height = nb;
    const img = tc.getContext('2d').createImageData(R.length, nb), px = img.data;
    R.forEach((r, xx) => { for (let k = 0; k < nb; k++) { const cc = cmap((r.sp[k] - lo) / (hi - lo)), o = 4 * ((nb - 1 - k) * R.length + xx); px[o] = cc[0]; px[o + 1] = cc[1]; px[o + 2] = cc[2]; px[o + 3] = 255; } });
    tc.getContext('2d').putImageData(img, 0, 0); x.tc = tc; x.off = (x.g.t0 || 0) - (EVV.g.t0 || 0);
  });
  EVV.cmp = rows; drawCmp();
}
function drawCmp() {
  const rows = EVV.cmp, g = EVV.g, R = EVV.d; if (!rows || !g || !R || !R.length) return;
  const total = Math.max(500, (g.clip_s || 0) * 1000, R[R.length - 1].o), d = DPR();
  for (const x of rows) {
    const cv = x.cv; fit(cv); const c = cv.getContext('2d'), w = cv.width, h = cv.height, L = 52 * d, Rr = 14 * d, pw = w - L - Rr;
    const X = o => L + pw * o / total, stp = x.R.step || 125;
    c.clearRect(0, 0, w, h); c.fillStyle = C.grid; c.fillRect(L, 0, pw, h);
    c.save(); c.beginPath(); c.rect(L, 0, pw, h); c.clip();
    c.imageSmoothingEnabled = true; c.drawImage(x.tc, X(x.R[0].o - stp + x.off), 0, X(x.R[x.R.length - 1].o + x.off) - X(x.R[0].o - stp + x.off), h);
    if (g.core) { c.strokeStyle = '#ffffffaa'; c.lineWidth = 1.5 * d; c.setLineDash([4 * d, 3 * d]); for (const o of g.core) { c.beginPath(); c.moveTo(X(o), 0); c.lineTo(X(o), h); c.stroke(); } c.setLineDash([]); }
    if (EVV.a && (EVV.a.currentTime > 0 || !EVV.a.paused)) { const xx = X(EVV.a.currentTime * 1000); c.strokeStyle = '#fff'; c.lineWidth = 2 * d; c.beginPath(); c.moveTo(xx, 0); c.lineTo(xx, h); c.stroke(); }
    c.restore();
  }
}
function haInfo(g) {
  return ((g && g.ha) || []).map(x => [x.label, (x.on ? t('ha_on') : x.on === false ? t('ha_off') : t('ha_unk')) + (x.state && !['on', 'off', 'unknown', 'unavailable'].includes(String(x.state).toLowerCase()) ? ' · ' + x.state : '')   // „aus · off“ doppelt: Rohzustand nur, wenn er mehr sagt (z. B. playing)
    + (x.on && x.mute ? ' · 🔇 ' + t('ha_mute') : x.on && x.vol != null ? ' · 🔊 ' + x.vol + ' %' : '') + (x.raise ? ' · 📈 ' + t('ha_r_on', { d: fmtDb(x.raise) }) : ''), x.entity]);
}

/* ================= Ganzer Tag (Tagesspur): im Nachtbericht und in der Live-Ansicht ================= */
let MIRROR_ST = null;
const DT = { el: { cv: 'ndcv', hover: 'ndhover', none: 'ndnone', range: 'ndrange', reset: 'ndreset' }, hide: (() => { try { return new Set(JSON.parse(localStorage.getItem('laerm_dthide') || '[]')); } catch (e) { return new Set(); } })(), src: '', date: '', from: null, to: null, data: null, drag: null, req: 0 };
const LDT = { el: { cv: 'ldcv', hover: 'ldhover', none: 'ldnone', range: 'ldrange' }, live: true, src: '', date: '', from: null, to: null, data: null, drag: null, req: 0, timer: null };
const LONG_SPAN = s => s > 600;                     // Live-Ansicht: ab 1 h aus der Tagesaufzeichnung
async function dtLoad(S, keep) {
  if (S === true || S === undefined) { keep = S; S = DT; }
  if (S === DT) visChanged();
  let q;
  if (S === LDT) {                                  // Live: letzte 1 h / 6 h oder heute, laufend
    const now = nowServer(), today = isoDay(new Date(now));
    S.src = selSrc; S.date = today;
    if (S.from == null) S.zoom = false;
    if (!S.zoom) {
      if (view.span === 86400) { S.from = parseDay(today).getTime(); S.to = S.from + 86400000; }
      else { S.to = now; S.from = now - view.span * 1000; }
    }
    if (S.zoom) {                                    // ab 1.85.37: zurückgespult – davor und danach gleich mitladen, Verschieben ohne neues Warten
      const sp = S.to - S.from;
      if (S.have && S.data && S.have[3] === S.src && S.from >= S.have[0] && S.to <= S.have[1] && sp >= S.have[2] * 0.6 && sp <= S.have[2] * 1.6) {
        S.data = Object.assign({}, S.data, { from: S.from, to: S.to }); dtRender(S); return; }
      const qa = Math.round(S.from - sp), qb = Math.round(Math.min(now, S.to + sp));
      S.want = [qa, qb, sp, S.src];
      q = 'daytrack?src=' + encodeURIComponent(S.src) + '&date=' + today + '&free=1&from=' + qa + '&to=' + qb;
    } else { S.want = null; S.have = null;
      q = 'daytrack?src=' + encodeURIComponent(S.src) + '&date=' + today + '&free=1&from=' + Math.round(S.from) + '&to=' + Math.round(S.to); }
  } else {
    const date = NV.date; if (!date) return;
    if (!keep || S.date !== date) { S.from = S.to = null; }
    S.date = date;
    if (!S.src) S.src = NV.src || 'all';
    if (S === DT) {
      if (!nvReady()) return;                        // Bericht für diesen Tag noch nicht geladen: der Verlauf kommt gleich mit dem Bericht
      $('ndcv').hidden = true; $('ndmulti').hidden = false; return dtLoadAll(S);
    }   // Verlauf: eingestellte Zeilen untereinander, gemeinsame Zeitachse
    const [wf, wt] = dtWin(S);
    q = 'daytrack?src=' + encodeURIComponent(S.src) + '&date=' + date + '&free=1&from=' + wf + '&to=' + wt;
  }
  const cv = $(S.el.cv); if (!cv) return;
  q += '&n=' + Math.max(100, Math.round((cv.clientWidth || 800) / (S === LDT && view.mode === 'wave' ? 3 : 1) * (S === LDT && S.want ? 3 : 1)));
  if (S.busy) { S.pend = true; return; }             // nur eine Abfrage gleichzeitig, danach sofort die neueste
  S.busy = true; S.pend = false; dtBusy(S, true);
  const id = ++S.req, f0 = S.from, t0_ = S.to;
  try {
    const r = await (await fetch(q, { cache: 'no-store' })).json();
    if (id === S.req) { const wnt = S === LDT ? S.want : null; if (wnt && r && r.has) { S.have = wnt; r.from = S.from; r.to = S.to; } else if (S === LDT) S.have = null;
      if (S.zoom && (S.from !== f0 || S.to !== t0_) && r && r.has) { r.from = S.from; r.to = S.to; } S.data = r; dtRender(S); }
    if (S === LDT) ldDown(f0, t0_);
  } catch (e) { }
  finally { S.busy = false; if (S.pend) { S.pend = false; dtLoad(S, true); } else dtBusy(S, false); }
}
/* Live-Verlauf: Unterbrechungen (Strom weg, Neustart, Lücke) des sichtbaren Zeitfensters laden, damit sie schraffiert und benennbar sind */
let LDDK = '';
async function ldDown(f, t1) {
  const k = Math.floor(f / 60000) + '|' + Math.floor(t1 / 60000); if (k === LDDK) return; LDDK = k;
  try {
    const j = await (await fetch('runtime?nochain=1&from=' + Math.round(f) + '&to=' + Math.round(t1), { cache: 'no-store' })).json();
    LDT.down = (j.events || []).filter(e => e.kind === 'down').map(e => [new Date(e.from).getTime(), new Date(e.to).getTime(), e.note || '', e.key || e.from, e.cause, e]).filter(g => g[1] > g[0]);
    if (LDT.data) dtDraw(LDT);
  } catch (e) { LDDK = ''; }
}
function dtRangeTxt(r) {                             // „Mo., 05.10. 21:55–21:57“ bzw. über mehrere Tage „29.09. – 05.10.“
  const L = locale(), f = new Date(r.from), tt = new Date(r.to), e1 = new Date(r.to - 1), hm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (isoDay(f) !== isoDay(e1)) return f.toLocaleDateString(L, { day: '2-digit', month: '2-digit' }) + ' ' + hm(f) + ' – ' + e1.toLocaleDateString(L, { day: '2-digit', month: '2-digit' }) + ' ' + (hm(tt) === '00:00' ? '24:00' : hm(tt));
  return f.toLocaleDateString(L, { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' ' + hm(f) + '–' + (hm(tt) === '00:00' ? '24:00' : hm(tt));
}
function dtRender(S) {
  S = S || DT; const r = S.data; if (!r) return;
  if (S.el.sel && $(S.el.sel)) {
    const sel = $(S.el.sel), ids = new Set(r.srcs.concat([S.src]));
    sel.innerHTML = ''; option(sel, 'all', t('all_sources')); SOURCES.filter(s => ids.has(s.id)).forEach(s => option(sel, s.id, s.name)); if (![...sel.options].some(o => o.value === S.src)) option(sel, S.src, S.src); sel.value = S.src;
  }
  if (S.el.none && $(S.el.none)) $(S.el.none).hidden = r.has;
  if (S.el.reset) $(S.el.reset).disabled = S.from == null;
  if (S.el.range && $(S.el.range)) $(S.el.range).textContent = (S === LDT ? (S.zoom ? '⏪ ' : '● ') : '') + dtRangeTxt(r);
  dtDraw(S); if (S === LDT) dtSpec(S);
}
/* Gespeichertes Spektrum (ganzer Tag) als Bild: Spalten je Abschnitt, feste Farbskala -110 … -30 dBFS */
function specCols(r) {
  if (!r || !r.spec || !r.spec.b || !r.spec.b.length) return null;
  if (r._sc) return r._sc;
  const nb = r.spec.bands.length, lo = 2 * (-110 + 130), hi = 2 * (-30 + 130);
  const cols = r.spec.b.map(([t2, b]) => { const sb = atob(b), px = new Uint8ClampedArray(nb * 4);
    for (let k = 0; k < nb; k++) { const cc = cmap(((sb.charCodeAt(k) || 0) - lo) / (hi - lo)), o = 4 * (nb - 1 - k); px[o] = cc[0]; px[o + 1] = cc[1]; px[o + 2] = cc[2]; px[o + 3] = 255; }
    return [t2, px]; });
  return (r._sc = { nb, cols });
}
function drawSpecInto(c, r, X, y0, hgt, L, pw, d) {
  const sc = specCols(r); if (!sc) return false;
  const step = r.step || (r.to - r.from) / 1200, w1 = Math.max(1, X(r.from + step) - X(r.from)) + 0.6;
  const cols = sc.cols, n = cols.length; if (!n) return false;
  if (!sc.tc) {                                       // ab 1.85.35: alle Spalten einmal in ein Bild, dann je zusammenhängendem Abschnitt ein drawImage (vorher je Spalte)
    const tc = document.createElement('canvas'); tc.width = n; tc.height = sc.nb; const tx = tc.getContext('2d'), img = tx.createImageData(n, sc.nb);
    for (let i = 0; i < n; i++) { const px = cols[i][1]; for (let k = 0; k < sc.nb; k++) { const o = 4 * k, q = 4 * (k * n + i); img.data[q] = px[o]; img.data[q + 1] = px[o + 1]; img.data[q + 2] = px[o + 2]; img.data[q + 3] = 255; } }
    tx.putImageData(img, 0, 0); sc.tc = tc;
  }
  c.save(); c.beginPath(); c.rect(L, y0, pw, hgt); c.clip(); c.imageSmoothingEnabled = true;
  const gap = Math.max(step * 2.5, 2500);                // längere Lücke = echte Pause: dort nichts zeichnen
  let i0 = 0;
  for (let i = 1; i <= n; i++) {
    if (i < n && cols[i][0] - cols[i - 1][0] <= gap) continue;
    const xa = X(cols[i0][0]), xb = X(cols[i - 1][0] + step);
    if (xb >= L && xa <= L + pw) c.drawImage(sc.tc, i0, 0, i - i0, sc.nb, xa, y0, Math.max(w1, xb - xa + 0.6), hgt);
    i0 = i;
  }
  c.restore(); return true;
}
/* Klick auf das KI-Symbol im Verlauf: kleines Fenster mit „hervorheben“ (nur Anzeige, pro Browser) */
function artHiPop(g, name, icon, ev) {
  let m = $('arthipop');
  if (!m) { m = el('div', { id: 'arthipop', className: 'hmenu tilepop' }); document.body.appendChild(m); document.addEventListener('click', e => { if (!m.hidden && !e.target.closest('#arthipop')) m.hidden = true; }, true); }
  m.innerHTML = `<b>${esc(icon)} ${esc(name)}</b><label class="chip"><input type="checkbox" id="arthic"${ART_HI.has(g) ? ' checked' : ''}> ${esc(t('art_hi'))}</label><label class="chip"><input type="checkbox" id="arthim"${ART_MUTE.has(g) ? ' checked' : ''}> ${esc(t('art_mute'))}</label><label class="chip"><input type="checkbox" id="arthis"${artSilent().has(g) ? ' checked' : ''}> ${esc(t('art_silent'))}</label><small>${esc(t('art_hi_tip'))} ${esc(t('art_mute_tip'))} ${esc(t('art_silent_tip'))}</small>`;
  $('arthis').onchange = e => artSilentSet(g, e.target.checked);
  $('arthim').onchange = e => { if (e.target.checked) ART_MUTE.add(g); else ART_MUTE.delete(g); artMuteSave(); window.dispatchEvent(new Event('resize')); };
  $('arthic').onchange = e => { if (e.target.checked) ART_HI.add(g); else ART_HI.delete(g); artHiSave(); window.dispatchEvent(new Event('resize')); };
  m.hidden = false; m.style.left = Math.max(8, Math.min(innerWidth - 290, ev.clientX - 20)) + 'px'; m.style.top = (ev.clientY + 14) + 'px'; m.style.right = 'auto';
}
document.addEventListener('click', e => {
  const cv = e.target; if (!cv || cv.tagName !== 'CANVAS') return;
  for (const S of [DT, ...(DT.subs || []), LOV]) { if (!S || !S.ahits || !S.el || $(S.el.cv) !== cv) continue;
    const rc = cv.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top;
    const h = S.ahits.find(q => Math.abs(q.x - x) <= q.w * 0.7 + 3 && Math.abs(q.y - y) <= q.w * 0.9 + 3);
    if (h) { e.stopPropagation(); artHiPop(h.g, h.n, h.i, e); return; } }
}, true);
/* ab 1.85.17: Sensoren im Verlauf (Pegelspur und Spektrogramm) – je Sensor eine eigene Höhe (HA_LS px), damit gleichzeitige Fähnchen alle sichtbar sind;
   je Zeile wählbar, welche Sensoren gezeigt werden (row.hs = ausgeblendete Namen) */
function haFlag(c, x, y, d, hb, col) {               // Fähnchen: Stiel und kleine Fahne in der Farbe des Sensors, heller Rand trennt übereinanderliegende
  c.save(); c.fillStyle = col; c.fillRect(x, y, 2 * d * hb, 13 * d * hb);
  c.beginPath(); c.moveTo(x + 2 * d * hb, y); c.lineTo(x + 10 * d * hb, y + 3.5 * d * hb); c.lineTo(x + 2 * d * hb, y + 7 * d * hb); c.closePath(); c.fill();
  c.strokeStyle = ca(NC.bg || '#fff', 0.85); c.lineWidth = 1 * d; c.stroke(); c.restore();
}
function dtDrawRaf(S, x) {                           // ab 1.85.35: höchstens ein Neuzeichnen je Bildschirmbild (Mausbewegung, Ziehen)
  S._rx = x; if (S._raf) return; S._raf = requestAnimationFrame(() => { S._raf = 0; dtDraw(S, S._rx); });
}
function dtDraw(S, hoverX) {
  S = S || DT; const r = S.data, cv = $(S.el.cv); if (!r || !cv || !cv.offsetParent) return;
  fit(cv); readNC();
  const art = (r.art || []).length || (r.subs || []).length || (r.pa || []).length;          // Zeile für die KI-Arten (Muster über den Tag)
  const d = DPR(), c = cv.getContext('2d'), w = cv.width, h = cv.height, L = 44 * d, Rr = 10 * d, T = (art ? 40 : 18) * d, B = 20 * d, pw = w - L - Rr, ph = h - T - B;
  const span = r.to - r.from, X = t2 => L + pw * (t2 - r.from) / span;
  let lo = 1e9, hi = -1e9; for (const p of r.pts) for (const v of [p[1], p[2], p[3]]) if (v != null && v > -125) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (lo > hi) { lo = -90; hi = -30; }               // unten bündig am tiefsten Wert (Schwelle zählt nicht), zu wenig Spanne nur nach oben ergänzen
  { const pad = Math.max(0.5, (hi - lo) * 0.04); lo = Math.floor((lo - pad) * 2) / 2; hi = Math.ceil((hi + pad) * 2) / 2; if (hi - lo < 6) hi = lo + 6; }
  { const yk = (S.parent || S).yk || 1; if (yk < 1) hi = lo + Math.max(1, (hi - lo) * yk); }   // Umschalt + Mausrad: Höhe gezoomt, unten bündig
  const ystep = [0.5, 1, 2, 5, 10, 20].find(q => (hi - lo) / q <= 8) || 20;
  const Y = v => T + ph * (1 - clamp((v - lo) / (hi - lo), 0, 1));
  c.clearRect(0, 0, w, h); c.font = (10.5 * d) + 'px system-ui'; c.fillStyle = NC.mut; c.strokeStyle = NC.grid; c.lineWidth = 1;
  c.textAlign = 'right'; const waveM = S.mode ? S.mode === 'wave' : S === LDT && view.mode === 'wave';
  const specM = S.mode === 'spec';                  // Zeile als Spektrogramm (gespeichertes Spektrum des ganzen Tages)
  if (specM) {                                      // Spektrogramm bleibt unser eigenes Bild (Raster und Zeitachse selbst)
    upHide(cv);
    for (let v = Math.ceil(lo / ystep) * ystep; v <= hi; v += ystep) { const y = Y(v); c.beginPath(); c.moveTo(L, y); c.lineTo(L + pw, y); c.stroke(); }
    const maxT = Math.max(3, Math.min(12, Math.floor(pw / d / 64))), steps = [10e3, 30e3, 60e3, 300e3, 900e3, 1800e3, 3600e3, 7200e3, 10800e3, 21600e3, 43200e3, 864e5, 1728e5, 6048e5], st = steps.find(s2 => span / s2 <= maxT) || 6048e5;
    c.textAlign = 'center';
    const tz = new Date(r.from).getTimezoneOffset() * 60000;     // Raster auf volle Ortszeit
    for (let t2 = Math.ceil((r.from - tz) / st) * st + tz; t2 < r.to - span * 0.015; t2 += st) { const x = X(t2), dd = new Date(t2); c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke(); c.fillText(st >= 864e5 || (st >= 43200e3 && !dd.getHours()) ? pad(dd.getDate()) + '.' + pad(dd.getMonth() + 1) + '.' : pad(dd.getHours()) + ':' + pad(dd.getMinutes()) + (st < 60e3 ? ':' + pad(dd.getSeconds()) : ''), x, h - 5 * d); }
  } else {                                          // Pegelspur bzw. Balken: uPlot (Raster, Achsen, Kurven)
    const up = upGet(cv, { kind: waveM ? 'wave' : 'lvl', L: 44, R: 10, T: art ? 40 : 18, B: 20, pal: dayPal, day: true, act: !waveM });
    const pid = r.pts._uid || (r.pts._uid = ++UPID);
    if (waveM) {
      const F = v => clamp((v - lo) / (hi - lo), 0, 1), tk = dbTicks(lo, hi, ph / 2, 18);
      up.u._wv = { ticks: tk.ticks.filter(k => k.major), F, fmt: tk.fmt };
      upDraw(up, pid + '|' + lo + '|' + hi, () => dayData(r, true, F), r.from, r.to, -1, 1);
    } else upDraw(up, pid + '', () => dayData(r, false), r.from, r.to, lo, hi);
  }
  if (specM) {
    c.clearRect(L - 44 * d, T - 2 * d, pw + 44 * d, ph + 4 * d); c.fillStyle = C.grid; c.fillRect(L, T, pw, ph);
    if (!drawSpecInto(c, r, X, T, ph, L, pw, d)) { c.fillStyle = NC.mut; c.textAlign = 'left'; c.font = (11 * d) + 'px system-ui'; c.fillText(t('dt_spec_nodata'), L + 8 * d, T + ph / 2); }
    c.fillStyle = NC.mut; c.textAlign = 'right'; c.font = (10 * d) + 'px system-ui';
    const bands = (r.spec && r.spec.bands) || []; for (const f of bands.length ? [100, 500, 2000, 8000] : []) { const k = bands.findIndex(x => x >= f); if (k < 0) continue; const y = T + ph * (1 - (k + 0.5) / bands.length); c.fillText(f >= 1000 ? f / 1000 + 'k' : f + '', L - 4 * d, y + 3 * d); }
  }
  S.downHit = [];
  for (const g of (S === LDT ? S.down : NV.down) || []) {                  // Nicht aufgezeichnet (Add-on aus / Neustart): schraffiert, damit es nicht wie Stille aussieht
    if (g[5] && g[5].sid && S.src && S.src !== 'all' && g[5].sid !== S.src) continue;   // Lücke nur eines Geräts: nur in dessen Zeile
    const x0 = X(Math.max(g[0], r.from)), x1 = X(Math.min(g[1], r.to)); if (x1 - x0 < 1) continue;
    const hov = hoverX != null && !MK.on && hoverX * d >= x0 && hoverX * d <= x1;   // darüber: etwas heller (anklickbar)
    c.save(); c.beginPath(); c.rect(x0, T, x1 - x0, ph); c.clip(); c.fillStyle = ca(NC.mut, hov ? 0.16 : 0.07); c.fillRect(x0, T, x1 - x0, ph);
    c.strokeStyle = ca(NC.mut, 0.22); c.lineWidth = 1 * d; c.beginPath(); for (let x = x0 - ph; x < x1; x += 8 * d) { c.moveTo(x, T + ph); c.lineTo(x + ph, T); } c.stroke();
    if (x1 - x0 > 40 * d) {                        // Beschriftung passend zur Breite: zweizeilig, notfalls gekürzt (voller Text als Tooltip)
      c.fillStyle = NC.mut; c.font = (10 * d) + 'px system-ui'; c.textAlign = 'center';
      const mw = x1 - x0 - 8 * d, fitT = s0 => { if (c.measureText(s0).width <= mw) return s0; let a0 = 0, b0 = s0.length; while (a0 < b0) { const m = (a0 + b0 + 1) >> 1; if (c.measureText(s0.slice(0, m) + '…').width <= mw) a0 = m; else b0 = m - 1; } return a0 ? s0.slice(0, a0) + '…' : ''; };
      const lh = 13 * d, maxL = Math.max(1, Math.floor((ph - 6 * d) / lh)), ls = [fitT(t('dt_norec'))];
      if (g[2] && maxL > 1) {                        // Kommentar in Wörtern umbrechen, so viele Zeilen wie Platz ist
        c.font = '600 ' + (10 * d) + 'px system-ui'; let cur = '';
        for (const w of ('📝 ' + g[2]).split(/\s+/)) { const tr = cur ? cur + ' ' + w : w; if (c.measureText(tr).width <= mw || !cur) cur = tr; else { ls.push(cur); cur = w; } }
        if (cur) ls.push(cur);
        if (ls.length > maxL) { ls.length = maxL; ls[maxL - 1] += '…'; }
        for (let i = 1; i < ls.length; i++) ls[i] = fitT(ls[i]);
      }
      const y0 = T + ph / 2 - (ls.length - 1) * lh / 2 + 3 * d;
      ls.forEach((l, i) => { c.font = (i ? '600 ' : '') + (10 * d) + 'px system-ui'; c.fillStyle = i ? NC.tx : NC.mut; c.fillText(l, (x0 + x1) / 2, y0 + i * lh); });
    }
    c.restore();
    (S.downHit || (S.downHit = [])).push([x0 / d, x1 / d, (g[2] ? '📝 ' + g[2] + '\n' : '') + t(g[2] ? 'run_click_edit' : 'run_click_add'), g]);
  }
  const haV = (r.ha || []).filter(a => haOk(S, a)), haLane = haLanes(haV);
  {                                                  // Sensor-Ereignisse (Regel „als Ereignis“): dünne rote Linie über die ganze Höhe – ganz unten, Fähnchen, Punkte und Pegelkurve liegen darüber
    c.save(); c.beginPath(); c.rect(L, 0, pw, T + ph); c.clip();
    for (const a of (r.ha || []).filter(a => a[5] === 'event' && haOk(S, a))) {
      const x0 = X(Math.max(a[0], r.from)), x1 = Math.max(x0 + 2 * d, X(Math.min(a[1], r.to))); if (x1 < L || x0 > L + pw) continue;
      c.fillStyle = ca(sensCol(a), 0.10); c.fillRect(x0, T, x1 - x0, ph);
      c.strokeStyle = ca(sensCol(a), 0.8); c.lineWidth = (a[7] ? 2 : 1) * d; c.setLineDash([3 * d, 3 * d]); c.beginPath(); const fy = T + (haLane.get(a[2]) || 0) * HA_LS * d; c.moveTo(x0 + 0.5 * d, fy); c.lineTo(x0 + 0.5 * d, T + ph); c.stroke(); c.setLineDash([]);   // erst ab Oberkante des Fähnchens
    }
    c.restore();
  }
  for (const a of haV) { const x0 = X(Math.max(a[0], r.from)), x1 = Math.max(X(Math.min(a[1], r.to)), X(Math.max(a[0], r.from)) + 3 * d); if (x1 <= x0 || x1 < L || x0 > L + pw) continue;
    const md = a[5] || 'note', col = md === 'event' ? sensCol(a) : '#1c7ed6', ly = T + haLane.get(a[2]) * HA_LS * d;
    if (md === 'pause') { c.fillStyle = ca(col, specM ? 0.0 : a[4] ? 0.26 : 0.18); c.fillRect(x0, T, x1 - x0, ph); }   // nur „pausieren“ füllt die ganze Höhe (dort wurde nicht ausgewertet)
    c.fillStyle = col; const hb = a[7] ? 2 : 1; c.fillRect(x0, ly, x1 - x0, (a[4] ? 5 : 4) * d * hb);   // „nur festhalten“/„als Ereignis“: schmaler Streifen oben, je Sensor eine Spur (hervorgehoben: doppelt so groß)
    if (md === 'event') haFlag(c, x0, ly, d, hb, col);
    if (a[4] && x1 - x0 > 30 * d) {                  // Notiz zum Sensor-Zeitraum gut sichtbar unter dem Streifen (gekürzt, ganzer Text im Tooltip)
      c.save(); c.beginPath(); c.rect(Math.max(x0, L), T, Math.min(x1, L + pw) - Math.max(x0, L), ph); c.clip();
      c.font = '600 ' + (11 * d) + 'px system-ui'; c.textAlign = 'left'; const tx = '📝 ' + a[4], mw = Math.min(x1, L + pw) - Math.max(x0, L) - 8 * d;
      let s0 = tx; while (s0.length > 4 && c.measureText(s0).width > mw) s0 = s0.slice(0, -2); if (s0 !== tx) s0 = s0.slice(0, -1) + '…';
      const tw = c.measureText(s0).width, xx = Math.max(x0, L) + 4 * d, yy = T + haLane.size * HA_LS * d + 12 * d + haLane.get(a[2]) * 15 * d;   // Notizen unter allen Spuren, je Sensor eine Zeile
      c.fillStyle = ca(NC.bg || '#000', 0.7); c.fillRect(xx - 2 * d, yy - 11 * d, tw + 4 * d, 15 * d); c.fillStyle = md === 'event' ? '#ff922b' : (typeof darkUI === 'function' && !darkUI()) ? '#1864ab' : '#74c0fc'; c.fillText(s0, xx, yy); c.restore();
    } }
  if ((r.hav || []).length && span <= 6 * 3600000) {   // Lautstärke des Fernsehers an den Wechseln
    c.save(); c.beginPath(); c.rect(L, 0, pw, T + ph); c.clip(); c.font = (9.5 * d) + 'px system-ui'; c.textAlign = 'left'; c.fillStyle = '#1c7ed6'; let lastX = -1e9;
    for (const v of r.hav) { const x = X(Math.max(v[0], r.from)); if (x < L - 1 || x > L + pw) continue; if (!(r.ha || []).some(a => v[0] >= a[0] - 6000 && v[0] <= a[1])) continue;
      const tx = v[3] ? '🔇' : '🔊' + (v[2] != null ? v[2] + '%' : ''); if (x - lastX < c.measureText(tx).width + 6 * d) continue;
      c.fillRect(x, T, 1 * d, 6 * d); c.fillText(tx, x + 2 * d, T + 9 * d + (art ? 0 : 0)); lastX = x + c.measureText(tx).width; }
    c.restore();
  }
  if (haV.length) { c.textAlign = 'left'; let lx = L + 4 * d; for (const [nm] of haLane) { const ea = haV.find(a => a[2] === nm && a[5] === 'event'), ev = !!ea; c.fillStyle = ev ? sensCol(ea) : '#1c7ed6'; const tx = (ev ? '◆ ' : '▬ ') + nm; c.fillText(tx, lx, 15 * d); lx += c.measureText(tx).width + 10 * d; } }
  const bw = Math.max(1, pw * (r.step || span / 1200) / span);
  // Spitze als Fläche mit Linie; Lücken (keine Werte, z. B. gestoppt) bleiben offen; Störung rot
  const gapMs = Math.max(400, 3 * (r.step || 0)), segs = []; let cur = null, prevT = null;
  for (const p of r.pts) { if (p[1] == null || (prevT != null && p[0] - prevT > gapMs)) { cur = null; } if (p[1] == null) { prevT = null; continue; } if (!cur) { cur = []; segs.push(cur); } cur.push(p); prevT = p[0]; }
  if (specM) segs.length = 0;
  const wave = waveM, LY = S.lay || LAY, lyOn = LY.lo || LY.mid || LY.hi || LY.dom || LY.cen;   // Zeile: eigene Darstellung und Ebenen
  if (wave && false) {                                // Lautstärke-Balken: jetzt uPlot
    const mid = T + ph / 2, F = v => clamp((v - lo) / (hi - lo), 0, 1), bwB = Math.max(2 * d, bw - 1 * d);
    for (const p of r.pts) { if (p[1] == null) continue; const hh = Math.max(1.5 * d, F(p[1]) * ph / 2), tv = p[4];
      c.fillStyle = tv == null ? NC.acc : p[1] >= tv ? NC.red : p[1] >= tv - 3 ? NC.warn : NC.acc; c.globalAlpha = tv != null && p[1] >= tv - 3 ? 1 : 0.75;
      c.fillRect(X(p[0]), mid - hh, bwB, hh * 2); }
    c.globalAlpha = 1; segs.length = 0;
  }
  segs.length = 0;                                  // Kurve zeichnet uPlot
  for (const sg of segs) {
    c.beginPath(); c.moveTo(X(sg[0][0]) + bw / 2, T + ph); for (const p of sg) c.lineTo(X(p[0]) + bw / 2, Y(p[1])); c.lineTo(X(sg[sg.length - 1][0]) + bw / 2, T + ph); c.closePath();
    c.fillStyle = ca(NC.acc, 0.22); c.fill();
    c.lineWidth = 1.2 * d; c.strokeStyle = NC.acc; c.beginPath(); sg.forEach((p, k) => { const x = X(p[0]) + bw / 2, y = Y(p[1]); if (k) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke();
    c.strokeStyle = NC.red; c.lineWidth = 1.6 * d; c.beginPath(); let on = false;
    sg.forEach(p => { const x = X(p[0]) + bw / 2, y = Y(p[1]); if (p[5]) { if (on) c.lineTo(x, y); else c.moveTo(x, y); on = true; } else on = false; }); c.stroke();
  }
  const line = (k, col, dash) => { c.strokeStyle = col; c.lineWidth = 1.5 * d; c.setLineDash(dash ? [4 * d, 3 * d] : []); c.beginPath(); let on = false; for (const p of r.pts) { if (p[k] == null) { on = false; continue; } const x = X(p[0]) + bw / 2, y = Y(p[k]); if (on) c.lineTo(x, y); else c.moveTo(x, y); on = true; } c.stroke(); c.setLineDash([]); };
  if (PT.v != null && S.parent === DT && !specM) ptDraw(c, r, X, Y, lo, hi, L, T, pw, ph, d, wave, bw);   // Prüf-Schwelle (nur Anzeige)
  // Hintergrund und Schwelle zeichnet uPlot; liegt die Schwelle außerhalb der Skala: gestrichelt am Rand mit Beschriftung und Pfeil
  if (!wave && !specM) {
    const tp = []; let prev = null; for (const p of r.pts) { if (prev != null && p[0] - prev > gapMs) tp.push([X(prev) + bw, null]); tp.push([X(p[0]) + bw / 2, p[4]]); prev = p[0]; }
    if (thrEdge(c, tp, lo, hi, L, T, pw, ph, d, NC.warn, 1.5)) {
      const lt = [...r.pts].reverse().find(p => p[4] != null && (p[4] > hi || p[4] < lo));
      if (lt) { c.font = '600 ' + (10.5 * d) + 'px system-ui'; c.textAlign = 'right'; lblBox(c, thrTxt(lt[4], lo, hi), L + pw - 4 * d, lt[4] > hi ? T + 15 * d : T + ph - 5 * d, NC.warn, d); }
    }
  }
  if (!wave && !specM && lyOn && r.pts.some(p => p.length > 6)) {   // Ebenen: tief/mittel/hoch (dB), dominante Frequenz und Klangschwerpunkt (50 Hz – 8 kHz)
    const F0 = Math.log(50), F1 = Math.log(8000), Yf = f => T + ph * (1 - (Math.log(clamp(f, 50, 8000)) - F0) / (F1 - F0));
    const snd = p => p[1] != null && (p[5] || (p[3] != null && p[1] >= p[3] + 6));
    for (const [id, k] of [['lo', 6], ['mid', 7], ['hi', 8]]) if (LY[id]) line(k, LCOL[id]);
    if (LY.cen) { c.strokeStyle = LCOL.cen; c.lineWidth = 1.6 * d; c.beginPath(); let on = false; for (const p of r.pts) { if (!snd(p) || p[10] == null) { on = false; continue; } const x = X(p[0]) + bw / 2, y = Yf(p[10]); if (on) c.lineTo(x, y); else c.moveTo(x, y); on = true; } c.stroke(); }
    if (LY.dom) { c.fillStyle = LCOL.dom; c.globalAlpha = .75; for (const p of r.pts) { if (!snd(p) || p[9] == null) continue; c.beginPath(); c.arc(X(p[0]) + bw / 2, Yf(p[9]), 1.8 * d, 0, 7); c.fill(); } c.globalAlpha = 1; }
    c.font = '600 ' + (10 * d) + 'px system-ui'; let lx = L + pw; c.textAlign = 'right';
    for (const id of ['cen', 'dom', 'hi', 'mid', 'lo']) if (LY[id]) { c.fillStyle = LCOL[id]; const tx = '■ ' + t('lay_s_' + id); c.fillText(tx, lx, 15 * d); lx -= c.measureText(tx).width + 10 * d; }
  }
  if (art) {                                          // KI: je Störung die erkannte Art, beim Hineinzoomen jedes Einzelereignis mit Symbol
    S.ahits = [];
    const y0 = T - 20 * d, fine = r.fine || {}; c.textAlign = 'center'; c.font = (12 * d) + 'px system-ui'; let lastX = -1e9;
    if ((r.subs || []).length) {
      for (const x of r.subs) { const xx = X(x[0]); if (xx < L || xx > L + pw) continue; const f = fine[x[1]] || { icon: '❓', group: 'other', name: x[1] };
        if (ART_MUTE.has(f.group)) continue;
        c.fillStyle = ART_HEX[f.group] || NC.mut; const hs = ART_HI.has(f.group) ? 2 : 1; c.fillRect(xx - 0.75 * d * hs, y0 + 15 * d, 1.5 * d * hs, T - y0 - 15 * d);
        if (hs > 1) c.font = (24 * d) + 'px system-ui';
        if (xx - lastX > 16 * d * hs) { c.fillText(f.icon, xx, y0 + 12 * d); S.ahits.push({ x: xx / d, y: (y0 + 6 * d) / d, w: 12 * hs, g: f.group, n: f.name, i: f.icon }); lastX = xx; if (hs > 1) c.font = (12 * d) + 'px system-ui';
          if (span <= 20 * 60000) { c.font = '600 ' + (9.5 * d) + 'px system-ui'; c.textAlign = 'left'; c.fillText(f.name, xx + 8 * d, y0 + 11 * d); c.textAlign = 'center'; c.font = (12 * d) + 'px system-ui'; lastX = xx + c.measureText(f.name).width; } } }
    } else {
      for (const a of r.art) { const xx = X(a[0]); if (xx < L || xx > L + pw) continue; if (!a[3] && ART_MUTE.has(a[1])) continue; c.fillStyle = a[4] ? '#adb5bd' : a[3] ? lbCol(a[3]) : (ART_HEX[a[1]] || NC.mut); const hs = !a[3] && ART_HI.has(a[1]) ? 2 : 1; c.fillRect(xx - 1 * d * hs, y0 + 4 * d, 2.5 * d * hs, 14 * d);
        if (xx - lastX > 22 * d * hs && span <= 6 * 3600000) { if (hs > 1) c.font = (24 * d) + 'px system-ui'; c.fillText(a[3] ? '🧩' : (ART_ICON[a[1]] || ''), xx, y0 + 2 * d); if (!a[3]) S.ahits.push({ x: xx / d, y: (y0 - 4 * d) / d, w: 12 * hs, g: a[1], n: artName(a[1]), i: ART_ICON[a[1]] || '' }); lastX = xx; if (hs > 1) c.font = (12 * d) + 'px system-ui'; } }
    }
  }
  for (const a of haV) {                             // Fähnchen der Sensor-Ereignisse nach der Pegelkurve nochmal zeichnen: liegen über Kurve und Linie
    if (a[5] !== 'event') continue;
    const x0 = X(Math.max(a[0], r.from)), x1 = Math.max(X(Math.min(a[1], r.to)), x0 + 3 * d); if (x1 <= x0 || x1 < L || x0 > L + pw) continue;
    const ly = T + haLane.get(a[2]) * HA_LS * d, hb = a[7] ? 2 : 1; c.fillStyle = sensCol(a); c.fillRect(x0, ly, x1 - x0, (a[4] ? 5 : 4) * d * hb); haFlag(c, x0, ly, d, hb, sensCol(a));
  }
  if ((r.pa || []).length) {                         // Bereiche aus „Neu untersuchen“ (Profile, auch unter der Schwelle)
    c.save(); c.beginPath(); c.rect(L, 0, pw, T + ph); c.clip(); let lastX = -1e9;
    // ab 1.85.35: zehntausende Bereiche – Farbe je Name einmal, nur sichtbare, Bereiche im selben Pixel zu einem Streifen zusammen
    const dk = darkUI(), cols = new Map(), colOf = a => { const k = a[4] ? '\u0000bg' : a[2]; let v = cols.get(k);
      if (!v) { const col = a[4] ? '#868e96' : lbCol(a[2], dk); v = [col, ca(col, a[4] ? 0.10 : 0.14)]; cols.set(k, v); } return v; };
    const pa = r.pa, tA = r.from; let lo = 0, hi = pa.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (pa[m][1] < tA) lo = m + 1; else hi = m; }   // Bereiche nach Beginn sortiert: erster, der noch sichtbar sein kann
    c.font = '600 ' + (9.5 * d) + 'px system-ui'; c.textAlign = 'left';
    let run = null; const flush = () => { if (!run) return; const [col, fill] = run.c; c.fillStyle = fill; c.fillRect(run.x0, T, run.x1 - run.x0, ph); c.fillStyle = col; c.fillRect(run.x0, T, run.x1 - run.x0, 3 * d);
      if (run.x1 - run.x0 > 30 * d || (run.x0 - lastX > 60 * d && span <= 2 * 3600000)) { c.fillText('🧩 ' + run.n, run.x0 + 2 * d, T + 13 * d); lastX = run.x0 + c.measureText('🧩 ' + run.n).width; } run = null; };
    for (let i = Math.max(0, lo - 50); i < pa.length; i++) { const a = pa[i]; const x0 = X(Math.max(a[0], r.from)); if (x0 > L + pw) { if (a[0] > r.to) break; continue; }
      const x1 = Math.max(x0 + 2 * d, X(Math.min(a[1], r.to))); if (x1 < L) continue;
      const cc = colOf(a);
      if (run && run.c === cc && x0 <= run.x1 + 1) { if (x1 > run.x1) run.x1 = x1; continue; }
      flush(); run = { x0, x1, c: cc, n: a[2] }; }
    flush();
    c.restore();
  }
  c.fillStyle = ca(NC.red, 0.35); for (const e of r.evx || []) { const x = X(e[0]); if (x >= L && x <= L + pw) c.fillRect(x - 1 * d, T + ph + 2 * d, Math.max(2 * d, X(e[0] + e[1]) - x), 2.5 * d); }   // Störung an einem anderen Gerät
  c.fillStyle = NC.red; for (const e of r.ev || []) { const x = X(e[0]); if (x >= L && x <= L + pw) c.fillRect(x - 1 * d, T + ph + 1 * d, Math.max(2 * d, X(e[0] + e[1]) - x), 4 * d); }
  {                                                  // Sensor-Ereignisse (Regel „als Ereignis“, z. B. Türsensor): rote Marker wie bei Störungen, dazu eine dünne Linie über die ganze Höhe
    c.save(); c.beginPath(); c.rect(L, 0, pw, T + ph + 12 * d); c.clip();
    for (const a of (r.ha || []).filter(a => a[5] === 'event' && haOk(S, a))) {
      const x0 = X(Math.max(a[0], r.from)), x1 = Math.max(x0 + 2 * d, X(Math.min(a[1], r.to))); if (x1 < L || x0 > L + pw) continue;
      c.fillStyle = sensCol(a); c.fillRect(x0 - 1 * d * (a[7] ? 2 : 1), T + ph + 1 * d, Math.max(3 * d, x1 - x0) * (a[7] ? 1 : 1), (a[7] ? 8 : 4) * d);
    }
    c.restore();
  }
  if (S === LDT && !S.zoom) { const x = X(nowServer()); if (x > L && x < L + pw) { c.strokeStyle = NC.tx; c.globalAlpha = 0.4; c.lineWidth = 1 * d; c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke(); c.globalAlpha = 1; } }
  fnMarks(c, r.fn, X, T, ph, L, pw, d, span <= 30 * 60000);    // freie Notizen („Notiz jetzt“)
  {                                                  // Notizen und Home-Assistant-Sensoren anklickbar – Klickfläche breiter als die (oft schmale) Fläche
    const pad = (matchMedia('(pointer:coarse)').matches ? 16 : 8), hits = [];
    for (const n of r.fn || []) { const x0 = X(Math.max(n[0], r.from)) / d, x1 = Math.max(x0, X(Math.min(n[1], r.to)) / d); if (x1 < L / d - pad || x0 > (L + pw) / d + pad) continue;
      hits.push([x0 - pad, x1 + pad, '📝 ' + (n[2] || t('fn_btn')) + '\n' + t('fn_click_edit'), { kind: 'fn', a: n[0], b: n[1], id: n[3] }]); }
    const haV2 = (r.ha || []).filter(a => haOk(S, a)), lanes2 = haLanes(haV2), nl = lanes2.size;
    for (const a of haV2) { const x0 = X(Math.max(a[0], r.from)) / d, x1 = Math.max(x0, X(Math.min(a[1], r.to)) / d); if (x1 < L / d - pad || x0 > (L + pw) / d + pad) continue;
      // Sensoren können gleichzeitig an sein (Fernseher + Türsensor): jede Spur hat ihre eigene Klickfläche, darunter bleibt Ziehen frei
      const ln = lanes2.get(a[2]), ly = T / d + ln * HA_LS, solo = (nl === 1 && x1 - x0 <= 40) || (a[5] === 'event' && x1 - x0 <= 40);   // Ereignis-Sensoren (rote Linie, Marker oben und unten): auf ganzer Höhe anklickbar
      const ymax = solo ? null : a[4] ? T / d + nl * HA_LS + 16 + ln * 15 : ly + HA_LS, ymin = solo ? null : ln === 0 ? null : ly - 2;   // breiter Balken: nur oben anklickbar (Leiste + Notiz), darunter bleibt Ziehen/Markieren frei
      hits.push([x0 - pad, x1 + pad, '📡 ' + a[2] + ' ' + t('ha_on') + ' · ' + hms(a[0]) + '–' + hms(a[1]) + (a[4] ? '\n📝 ' + a[4] : '') + '\n' + t('ha_click'), { kind: 'ha', a: a[0], b: a[1], name: a[2], rid: a[3], note: a[4] || '', S }, ymax, ymin]); }
    S.downHit = hits.concat(S.downHit || []);
  }
  const mk = S.parent ? S.parent.mark : S.mark;        // in der Tabelle gewähltes Ereignis
  if (mk) { const x0 = X(mk[0]), x1 = Math.max(x0 + 2 * d, X(mk[1])); c.fillStyle = ca(NC.warn, 0.22); c.fillRect(x0, T, x1 - x0, ph); c.fillStyle = NC.warn; c.fillRect(x0 - 1 * d, T, 2 * d, ph); }
  if (S.drag) { const a = Math.min(S.drag.a, S.drag.b), b = Math.max(S.drag.a, S.drag.b); c.fillStyle = S.drag.del ? 'rgba(224,49,49,0.25)' : ca(NC.acc, S.drag.mk ? 0.28 : 0.2); c.fillRect(a * d, T, (b - a) * d, ph); }
  if (MK.sel && MK.sel.day === S) drawMk(c, X, T, ph, d, false);
  S.geo = { L: L / d, pw: pw / d, T: T / d, ph: ph / d, lo, hi, wave: !!wave, spec: !!specM };
  if (S === LDT) slDraw('scld', r.from, r.to, 44, 10, 15000);            // Sensor-Spuren: live (lang) und im Verlauf gleich
  else if (S.parent === DT) slDraw('scnd', r.from, r.to, 44, 10, 60000);
  if (hoverX != null) {
    const tq = r.from + span * clamp((hoverX - S.geo.L) / S.geo.pw, 0, 1); let best = null;
    for (const p of r.pts) if (best == null || Math.abs(p[0] - tq) < Math.abs(best[0] - tq)) best = p;
    if (best) { const x = X(best[0]); c.strokeStyle = NC.tx; c.lineWidth = 1 * d; c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke();
      const dd = new Date(best[0]); $(S.el.hover).textContent = (S.name ? S.name + ' · ' : '') + t('dt_at', { t: pad(dd.getHours()) + ':' + pad(dd.getMinutes()) + ':' + pad(dd.getSeconds()), p: best[1] != null ? best[1].toFixed(1) : '–', b: best[3] != null ? best[3].toFixed(1) : '–' }); }
    const tol = span / S.geo.pw * 4, on = e => tq >= e[0] - tol && tq <= e[0] + Math.max(e[1], 0) + tol;   // ±4 px, damit auch kurze Störungen zu treffen sind
    const hit = (r.ev || []).find(on), hx = hit ? null : (r.evx || []).find(on), e = hit || hx;
    if (e && !S.drag && !(MK.sel && MK.sel.day === S)) {
      const o = e[3] && typeof e[3] === 'object' ? e[3] : {}, sid = S.src || r.src || selSrc;
      const tip = hit ? { src: sid, from: e[0], to: e[0] + e[1], pk: e[2], th: o.th, bg: o.bg, art: o.a, ac: o.ac, am: o.am, prof: o.p, pc: o.pc, pbg: o.pbg, nt: o.nt,
        also: (r.evx || []).filter(x => x[0] <= e[0] + e[1] + 1500 && x[0] + x[1] >= e[0] - 1500).map(x => x[3]) } : { other: true, src: e[3], from: e[0], to: e[0] + e[1], pk: e[2] };
      const rc = cv.getBoundingClientRect();
      tipShow('day', tipHtml(tip), rc.left + hoverX, rc.top + T / d, hoverX > rc.width * 0.6);
    } else tipHide('day');
  }
}
/* Zeitraum im Nachtbericht: wie der Bericht (eingestellte Erfassungszeit, sonst ganzer Tag), nach dem Hineinzoomen der gewählte Ausschnitt */
function dtWin(S) {
  if (S.from != null) return [Math.round(S.from), Math.round(S.to)];
  const d = NV.data; if (d && d.start) return nvSpan(d);
  const a = parseDay(S.date).getTime(); return [a, a + 86400000];
}
/* Verlauf: Zeilen frei einstellbar (wie „Zeile hinzufügen“): je Zeile Gerät, Darstellung und Ebenen; pro Browser gemerkt */
function dtRows(have) {
  let rows = null; try { rows = JSON.parse(localStorage.getItem('laerm_dtrows') || 'null'); } catch (e) { }
  if (!Array.isArray(rows) || !rows.length) rows = (have.length ? have.map(([s]) => s.id) : SOURCES.map(s => s.id)).map(src => ({ src, mode: 'level', lay: {} }));
  return rows.filter(r => r && r.src).slice(0, 12);
}
function dtRowsSave(rows) { try { localStorage.setItem('laerm_dtrows', JSON.stringify(rows)); } catch (e) { } }
/* Ladesymbol über den Grafik-Zeilen, solange Daten geladen werden (erscheint erst nach kurzer Zeit, damit es bei schnellen Antworten nicht flackert) */
/* Ladehinweis für ganze Bereiche: busy(Bereich, true) beim Start einer Abfrage, busy(Bereich, false) wenn sie fertig ist.
   Gezählt wird je Bereich, damit sich überlappende Abfragen nicht gegenseitig den Hinweis wegnehmen. Oben im Kopf steht
   zusätzlich „Daten werden geladen …“, solange irgendein Bereich lädt. */
const BUSY = new Map();
function busy(area, on) {
  const els = typeof area === 'string' ? [...document.querySelectorAll(area)] : [area].filter(Boolean);
  for (const b of els) {
    const n = Math.max(0, (BUSY.get(b) || 0) + (on ? 1 : -1));
    if (n) BUSY.set(b, n); else BUSY.delete(b);
    b.classList.add('bzwrap');
    let sp = [...b.children].find(c => c.classList.contains('bz'));
    if (n && !sp) { sp = spinEl(); sp.classList.add('bz'); b.appendChild(sp); }
    b.classList.toggle('loading', !!n);
    if (!n && sp) sp.remove();
  }
  const g = $('gload'); if (g) g.hidden = !BUSY.size;
  clearTimeout(busy.slowT);
  if (BUSY.size) busy.slowT = setTimeout(() => { if (BUSY.size) document.querySelectorAll('.ldspin.bz span, #gload span').forEach(x => { x.textContent = t('loading_slow'); }); }, 4000);
  else document.querySelectorAll('#gload span').forEach(x => { x.textContent = t('loading'); });
}
const PROT_AREAS = '#nweek, #nightview .nsum, #ndaybox';
const EV_AREAS = '#nightview .pevcard, #hours, #days';     // Liste und die Karten „Stunden“/„Tage“ (auch im Dashboard)
function spinEl() { const d = el('div', { className: 'ldspin' }); d.innerHTML = '<i></i><span>' + esc(t('loading')) + '</span>'; return d; }
function dtBusy(S, on) {
  clearTimeout(S._slowT); if (on) S._slowT = setTimeout(() => document.querySelectorAll('.ldspin span').forEach(x => { x.textContent = t('loading_slow'); }), 4000); else document.querySelectorAll('.ldspin span').forEach(x => { x.textContent = t('loading'); });
  if (S === LDT) { const b = $('ldaybox'); if (b) b.classList.toggle('loading', on); return; }
  const box = $('ndmulti'); if (!box) return;
  if (on && !box.querySelector('canvas') && !box.querySelector('.ndph')) { const ph = el('div', { className: 'ndph ndcvw' }); ph.appendChild(spinEl()); box.appendChild(ph); }
  if (!on) { const ph = box.querySelector('.ndph'); if (ph) ph.remove(); }
  box.classList.toggle('loading', on);
}
/* Nur eine Abfrage gleichzeitig: Antworten werden immer gezeigt (auch während weiter gezoomt wird), danach sofort der neueste Ausschnitt */
async function dtLoadAll(S) {
  if (S.busy) { S.pend = true; return; }
  S.busy = true; S.pend = false; dtBusy(S, true);
  try { await dtLoadAll1(S); } finally { S.busy = false; if (S.pend) { S.pend = false; dtLoadAll(S); } else dtBusy(S, false); }
}
/* ================= Prüf-Schwelle (Protokolle → Verlauf): frei wählbarer Wert; zeigt, welche Spitzen darüber liegen.
   Nur Anzeige – gespeicherte Daten, Störungen und Prüfsummen bleiben unverändert. Gezählt wird auf dem Server aus den 125-ms-Werten,
   je Spitze mit nachträglicher KI-Zuordnung (aus der Störung bzw. dem gespeicherten KI-Fingerabdruck). ================= */
const PTCOL = '#be4bdb';
const PT = (() => { let v = null; try { const x = parseFloat(localStorage.getItem('laerm_pthr')); if (isFinite(x)) v = x; } catch (e) { } return { v, list: false, res: {}, req: 0, t: 0 }; })();
function ptSet(v, load) {
  PT.v = v == null || !isFinite(v) ? null : Math.round(clamp(v, -130, 0) * 2) / 2;
  try { if (PT.v == null) localStorage.removeItem('laerm_pthr'); else localStorage.setItem('laerm_pthr', String(PT.v)); } catch (e) { }
  $('ndptbar').hidden = PT.v == null; $('ndpt').classList.toggle('on', PT.v != null); $('ndpt').setAttribute('aria-pressed', String(PT.v != null));
  if (document.activeElement !== $('ndptv')) $('ndptv').value = PT.v == null ? '' : PT.v;
  for (const sub of DT.subs || []) if (sub.data) dtDraw(sub);
  if (PT.v == null) { PT.res = {}; $('ndptlist').hidden = true; $('ndptsum').innerHTML = ''; return; }
  if (load) ptLoadSoon();
}
function ptLoadSoon() { clearTimeout(PT.t); PT.t = setTimeout(ptLoad, 250); }
async function ptLoad() {
  if (PT.v == null || !DT.rows || !NV.open) return;
  const [a, b] = dtWin(DT), srcs = [...new Set(DT.rows.map(r => r.src))], id = ++PT.req, v = PT.v;
  $('ndptsum').innerHTML = '<small>' + esc(t('loading')) + '</small>';
  const res = await Promise.all(srcs.map(sid => fetch('exceed?src=' + encodeURIComponent(sid) + '&from=' + Math.round(a) + '&to=' + Math.round(b) + '&thr=' + v, { cache: 'no-store' }).then(x => x.json()).catch(() => null)));
  if (id !== PT.req) return;
  PT.res = {}; srcs.forEach((sid, i) => { PT.res[sid] = res[i]; }); ptRender();
}
const ptDur = s2 => { s2 = Math.round(s2); return s2 < 60 ? s2 + ' s' : Math.floor(s2 / 60) + ':' + pad(s2 % 60) + ' min'; };
function ptRender() {
  const nm = id => viewName(id);
  const ids = Object.keys(PT.res);
  $('ndptsum').innerHTML = ids.map(id => { const r = PT.res[id]; if (!r || !r.ok) return ''; return '<span>' + (r.n ? esc(t('pt_sum', { d: nm(id), n: r.n, t: ptDur(r.dur_s) })).replace(/^([^:]+):/, '<b>$1:</b>') : esc(t('pt_none', { d: nm(id) }))) + '</span>'; }).join('')
    + ((w => w ? `<span class="ptwarn">⚠ ${esc(t(w.ki_why === 'model' ? 'pt_kimodel' : 'pt_kioff'))}</span>` : '')(ids.map(id => PT.res[id]).find(r => r && r.ok && r.ki === false)));
  $('ndptl').textContent = t(PT.list ? 'pt_list_hide' : 'pt_list');
  const box = $('ndptlist'); box.hidden = !PT.list; if (!PT.list) return;
  const rows = []; let cut = false;
  for (const id of ids) { const r = PT.res[id]; if (!r || !r.ok) continue; if (r.cut) cut = true; for (const x of r.list) rows.push([id, x]); }
  rows.sort((p, q) => p[1][0] - q[1][0]);
  if (!rows.length) { box.innerHTML = `<div class="ndptcut">${esc(t('pt_none', { d: t('pt_col_dev') + ' –' }).replace(/^.*?: /, ''))}</div>`; return; }
  const show = rows.slice(0, 1000); if (rows.length > show.length) cut = true;
  const kiCell = k => {
    if (!k || k.src !== 'ev' && k.src !== 'fp') { const w = !k ? 'pt_nc' : k.src === 'nc' ? 'pt_nc' : k.src === 'day' ? 'pt_noday' : 'pt_nogap'; return `<td colspan="2" title="${esc(t(w + '_tip'))}"><small>${esc(t(w))}</small></td>`; }
    const tip = esc(t(k.src === 'ev' ? 'pt_ev' : 'pt_fp'));
    return `<td title="${tip}">${k.art ? artChip(k.art, k.pct, k.man) : ''}${k.src === 'fp' ? ' <small>ⓕ</small>' : ''}</td><td title="${tip}">${k.prof ? `<span class="art prof${k.pbg ? ' bgp' : ''}">🧩 ${esc(k.prof)}${k.ppct != null ? ` <small>${k.ppct} %</small>` : ''}</span>` : ''}</td>`;
  };
  tabGrid(box, `<table><tr><th>${esc(t('pt_col_dev'))}</th><th>${esc(t('pt_col_t'))}</th><th>${esc(t('pt_col_dur'))}</th><th>${esc(t('pt_col_pk'))}</th><th>${esc(t('pt_col_over'))}</th><th>${esc(t('pt_col_art'))}</th><th>${esc(t('pt_col_prof'))}</th></tr>`
    + show.map(([id, x]) => `<tr data-a="${x[0]}" data-b="${x[1]}"><td>${esc(nm(id))}</td><td>${hms(x[0])}</td><td>${(Math.max(0.125, (x[1] - x[0]) / 1000)).toFixed(1).replace('.', lang === 'de' ? ',' : '.')} s</td><td>${f1(x[2])} dBFS</td><td>+${f1(x[2] - PT.v)} dB</td>${kiCell(x[3])}</tr>`).join('')
    + '</table>' + (cut ? `<div class="ptcut ndptcut">${esc(t('pt_cut', { n: show.length }))}</div>` : ''), { onRow: ds => { if (!ds.a) return; const a = +ds.a, b = +ds.b, padv = Math.max(15000, (b - a) * 3); DT.mark = [a, b]; dtSetWin(DT, a - padv, b + padv, 'now'); $('ndaybox').scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
}
function ptDraw(c, r, X, Y, lo, hi, L, T, pw, ph, d, wave, bw) {
  const v = PT.v, col = PTCOL;
  c.save(); c.beginPath(); c.rect(L, T, pw, ph); c.clip();
  if (wave) {                                         // Balken: gespiegelt; Teil über der Prüf-Schwelle hervorheben
    const mid = T + ph / 2, F = x => clamp((x - lo) / (hi - lo), 0, 1), fv = F(v);
    c.fillStyle = ca(col, 0.75);
    for (const p of r.pts) if (p[1] != null && p[1] > v) { const x = X(p[0]), hh = F(p[1]) * ph / 2, h0 = fv * ph / 2; c.fillRect(x, mid - hh, Math.max(1.5 * d, bw - 1 * d), hh - h0); c.fillRect(x, mid + h0, Math.max(1.5 * d, bw - 1 * d), hh - h0); }
    c.strokeStyle = col; c.lineWidth = 1.6 * d; c.beginPath(); for (const y of [mid - fv * ph / 2, mid + fv * ph / 2]) { c.moveTo(L, y); c.lineTo(L + pw, y); } c.stroke();
  } else {
    const yv0 = v > hi ? T : v < lo ? T + ph : Y(v);
    c.fillStyle = ca(col, 0.6);
    for (const p of r.pts) if (p[1] != null && p[1] > v) { const y = Y(p[1]); if (yv0 - y > 0.5) c.fillRect(X(p[0]), y, Math.max(1.2 * d, bw), yv0 - y); }
    c.strokeStyle = col; c.lineWidth = 1.8 * d; c.setLineDash(v > hi || v < lo ? [7 * d, 4 * d] : []); c.beginPath(); c.moveTo(L, yv0 + (v > hi ? 1 * d : v < lo ? -1 * d : 0)); c.lineTo(L + pw, yv0 + (v > hi ? 1 * d : v < lo ? -1 * d : 0)); c.stroke(); c.setLineDash([]);
  }
  c.restore();
  c.font = '600 ' + (10.5 * d) + 'px system-ui'; c.textAlign = 'left';
  const ty = wave ? T + ph / 2 - clamp((v - lo) / (hi - lo), 0, 1) * ph / 2 - 5 * d : v > hi ? T + 15 * d : v < lo ? T + ph - 5 * d : Y(v) - 5 * d;
  lblBox(c, t('pt_line', { v: f1(v) }) + (v > hi ? ' ↑' : v < lo ? ' ↓' : ''), L + 6 * d, Math.max(T + 12 * d, ty), col, d);
}
function ptNear(S, y) {                              // Maus nahe an der Linie (CSS-Pixel)?
  const g = S.geo; if (PT.v == null || S.parent !== DT || !g || g.spec || !S.data) return false;
  if (g.wave) { const mid = g.T + g.ph / 2, off = clamp((PT.v - g.lo) / (g.hi - g.lo), 0, 1) * g.ph / 2; return Math.abs(y - (mid - off)) < 7 || Math.abs(y - (mid + off)) < 7; }
  const yy = g.T + g.ph * (1 - clamp((PT.v - g.lo) / (g.hi - g.lo), 0, 1)); return Math.abs(y - yy) < 7;
}
function ptVal(S, y) {
  const g = S.geo; if (!g) return null;
  if (g.wave) { const f = clamp(Math.abs(y - (g.T + g.ph / 2)) / (g.ph / 2), 0, 1); return g.lo + f * (g.hi - g.lo); }
  return g.lo + (1 - clamp((y - g.T) / g.ph, 0, 1)) * (g.hi - g.lo);
}
function initPt() {
  if (!$('ndpt')) return;
  $('ndmore').onclick = () => { const o = $('ndtools').classList.toggle('open'); $('ndmore').setAttribute('aria-expanded', String(o)); };
  $('ndpt').onclick = () => {
    if (PT.v != null) return ptSet(null);
    let tv = null; const sub = (DT.subs || []).find(x => x.data && x.data.pts.length);   // Start: knapp über der gespeicherten Schwelle
    if (sub) { const th = sub.data.pts.map(p => p[4]).filter(x => x != null).sort((a, b) => a - b); if (th.length) tv = th[th.length >> 1] + 10; else { const pk = sub.data.pts.map(p => p[1]).filter(x => x != null).sort((a, b) => a - b); if (pk.length) tv = pk[Math.floor(pk.length * 0.9)]; } }
    ptSet(tv != null ? tv : -60, true);
  };
  $('ndptx').onclick = () => ptSet(null);
  $('ndptv').addEventListener('change', () => { const v = parseFloat(String($('ndptv').value).replace(',', '.')); if (isFinite(v)) ptSet(v, true); });
  $('ndptl').onclick = () => { PT.list = !PT.list; ptRender(); };
  if (PT.v != null) { $('ndptbar').hidden = false; $('ndpt').classList.add('on'); $('ndptv').value = PT.v; $('ndptl').textContent = t('pt_list'); }
}
function nvReady() { return NV.dkey === JSON.stringify([NV.date, NV.src, perRange(), NV.per, PV.cur, NV.art]); }
async function dtLoadAll1(S) {
  if (!nvReady()) return;
  const box = $('ndmulti'), date = S.date, id = ++S.req, dkey = NV.dkey;
  const w = Math.max(300, Math.round(box.clientWidth || $('ndaybox').clientWidth || 800));
  const [wf, wt] = dtWin(S);
  const spec = new Set((S.rows || dtRows([])).filter(r => r.mode === 'spec').map(r => r.src));      // Spektrum nur, wo eine Zeile es zeigt
  const q = sid => 'daytrack?src=' + encodeURIComponent(sid) + '&date=' + date + '&n=' + w + '&free=1&from=' + wf + '&to=' + wt + (spec.has(sid) ? '' : '&nospec=1');
  let res;
  const LS = SOURCES.concat(FORMER.filter(f => (S.rows || dtRows([])).some(r => r.src === f.id)));   // ehemalige Geräte nur, wenn eine Zeile sie zeigt
  try { res = await Promise.all(LS.map(s => fetch(q(s.id), { cache: 'no-store' }).then(x => x.json()).catch(() => null))); } catch (e) { return; }
  if (id !== S.req || date !== S.date || dkey !== NV.dkey) return;   // inzwischen anderer Tag/Zeitraum: verwerfen (der neue lädt schon)
  if (S.from != null) setTimeout(() => {               // ab 1.85.37: Ausschnitt davor/danach (◀ ▶, je 80 %) schon laden
    const [b0, b1] = dtBase(S), sp = wt - wf, now = nowServer(), bl = b1 > now && now > b0 ? now : b1;
    for (const k of [-1, 1]) { const fu = clamp(wf + k * sp * 0.8, b0, Math.max(b0, bl - sp)), f = Math.round(fu), t2 = Math.round(fu + sp); if (f === wf) continue;
      for (const s of LS) pfGet(q(s.id).replace('&from=' + wf + '&to=' + wt, '&from=' + f + '&to=' + t2), 120000); }
  }, 800);
  const [cf, ct] = dtWin(S);
  if (cf !== wf || ct !== wt) res.forEach(r => { if (r && r.has) { r.from = cf; r.to = ct; } });   // inzwischen weiter gezoomt: im aktuellen Ausschnitt zeigen, genauer kommt gleich
  const by = {}; LS.forEach((s, i) => { by[s.id] = res[i]; });
  const have = LS.map((s, i) => [s, res[i]]).filter(([s, r]) => r && r.has && !s.former);
  $('ndnone').hidden = have.length > 0; $('ndchips').innerHTML = '';
  S.rows = S.rows && S.rows.length ? S.rows : dtRows(have); S.byData = by;   // Zeilen behalten (Änderungen an Gerät, Darstellung, Höhe gehen sonst verloren)
  const sig = JSON.stringify(S.rows.map(r => [r.src, !!(by[r.src] && by[r.src].has)]));
  const ssig = JSON.stringify(S.rows.map(r => r.src));
  if (S.subs && S.subs.length === S.rows.length && S._ssig === ssig && (S._rsig === sig || S.from != null) && box.querySelector('canvas')) {   // nur neue Daten (Zoomen/Scrollen): Zeilen bleiben stehen, nur neu zeichnen (auch ohne Daten im Ausschnitt, damit nichts verrutscht)
    S.subs.forEach(sub => { const r = by[sub.src]; sub.data = r && r.has ? r : null; if (sub.data) dtDraw(sub); else dtEmpty(sub); });
  } else { S._rsig = sig; S._ssig = ssig; dtRowsRender(S); }
  if (PT.v != null) ptLoadSoon();
  dtBar(S);
  { const [sa, sb] = dtWin(S); slDraw('scnd', sa, sb, 44, 10, 60000, !(S.subs || []).some(x => x.data)); }   // Sensor-Spuren auch ohne Tagesaufzeichnung im Ausschnitt (dann mit eigener Zeitachse)
  if (have.length) {                                  // Kopfzeile
    S.data = have[0][1]; const r = S.data;
    $('ndrange').textContent = dtRangeTxt(r) + (r.coarse ? ' · ' + t('dt_coarse') : '');
    $('ndreset').disabled = $('ndreset').hidden = S.from == null;
  }
}
function dtEmpty(S) {                               // Zeile ohne Daten im gezoomten Ausschnitt: Fläche bleibt gleich hoch, nur Hinweis
  const cv = $(S.el.cv); if (!cv || !cv.offsetParent) return; fit(cv); readNC(); upHide(cv);
  const d = DPR(), c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
  c.fillStyle = C.grid; c.fillRect(44 * d, 18 * d, cv.width - 54 * d, cv.height - 38 * d);
  c.fillStyle = NC.mut; c.font = (11 * d) + 'px system-ui'; c.textAlign = 'left'; c.fillText(t('dt_none_row'), 52 * d, cv.height / 2);
}
const DT_LAYOPEN = new Set();
function dtRowsRender(S) {
  const box = $('ndmulti'); box.innerHTML = ''; S.subs = [];
  const name = id => viewName(id);
  S.rows.forEach((row, i) => {
    const hd = el('div', { className: 'ndrow' });
    const ss = el('select', { className: 'ndrsrc', title: t('src_col') }); viewSources().forEach(s => option(ss, s.id, viewName(s.id))); if (!viewSources().some(s => s.id === row.src)) option(ss, row.src, row.src); ss.value = row.src;
    const ms = el('select', { className: 'ndrmode', title: t('dt_view') }); option(ms, 'level', t('v_level')); option(ms, 'wave', t('v_wave')); option(ms, 'spec', t('dt_mode_spec')); ms.value = row.mode || 'level';
    const lb = el('span', { className: 'ndrlay' });
    for (const k of ['lo', 'mid', 'hi', 'dom', 'cen']) { const l = el('label', { className: 'chip ndchip', title: t('lay_' + k) }); const c = el('input', { type: 'checkbox', checked: !!(row.lay || {})[k] }); l.append(c, el('i', { className: 'ndsw' }), document.createTextNode(t('lay_s_' + k))); l.querySelector('i').style.background = LCOL[k]; c.onchange = () => { row.lay = Object.assign({}, row.lay, { [k]: c.checked }); dtRowsSave(S.rows); dtRowsRender(S); }; lb.appendChild(l); }
    lb.hidden = ms.value !== 'level';
    let lt = null;                                    // Handy: Ebenen hinter einem Knopf, damit der Graph Platz hat
    if (innerWidth < 600 && ms.value === 'level') {
      const n = Object.values(row.lay || {}).filter(Boolean).length, op = DT_LAYOPEN.has(i);
      lt = el('button', { type: 'button', className: 'chip ndrlt' + (n ? ' on' : ''), textContent: '🗂 ' + t('lay_btn') + (n ? ' (' + n + ')' : '') + (op ? ' ▴' : ' ▾') });
      lt.setAttribute('aria-expanded', String(op)); lb.hidden = !op;
      lt.onclick = () => { op ? DT_LAYOPEN.delete(i) : DT_LAYOPEN.add(i); dtRowsRender(S); };
    }
    const up = el('button', { type: 'button', className: 'chip', textContent: '↑', title: t('dt_up') }), dn = el('button', { type: 'button', className: 'chip', textContent: '↓', title: t('dt_down') }), rm = el('button', { type: 'button', className: 'chip danger', textContent: '✕', title: t('dt_rm') });
    up.disabled = i === 0; dn.disabled = i === S.rows.length - 1; rm.disabled = S.rows.length < 2;
    const mv = k => { const r2 = S.rows.splice(i, 1)[0]; S.rows.splice(i + k, 0, r2); dtRowsSave(S.rows); dtRowsRender(S); };
    up.onclick = () => mv(-1); dn.onclick = () => mv(1); rm.onclick = () => { S.rows.splice(i, 1); dtRowsSave(S.rows); dtRowsRender(S); };
    ss.onchange = () => { row.src = ss.value; dtRowsSave(S.rows); dtRowsRender(S); };
    ms.onchange = () => { row.mode = ms.value; dtRowsSave(S.rows); dtRowsRender(S); };
    const mvb = el('span', { className: 'ndrmv' }); mvb.append(up, dn, rm);          // ↑ ↓ ✕ bleiben zusammen (Handy)
    const rd = S.byData && S.byData[row.src], hsN = [...new Set(((rd && rd.ha) || []).map(a => a[2]))].sort((p, q) => p.localeCompare(q));
    let hsB = null;                                   // ab 1.85.17: welche Sensoren diese Zeile zeigt (Pegelspur, Lautstärke, Spektrogramm)
    if (hsN.length) {
      const hid = new Set(row.hs || []), on = hsN.filter(n => !hid.has(n)).length;
      const sfw = el('span', { className: 'sflt' });
      sfw.innerHTML = slDrop(`class="chip" title="${esc(t('dt_hs_tip'))}">📡 ${esc(t('dt_hs'))} <small>${on}/${hsN.length}</small>`, hsN.map(n => `<label><input type="checkbox" data-n="${esc(n)}"${hid.has(n) ? '' : ' checked'}> <i class="ndsw" style="background:${esc(sensCol((rd.ha || []).find(a => a[2] === n)))}"></i> ${esc(n)}</label>`).join(''), false, 'ndrhs');
      hsB = sfw.querySelector('sl-dropdown');
      hsB.querySelectorAll('input').forEach(c => c.onchange = () => { const h = new Set(row.hs || []); c.checked ? h.delete(c.dataset.n) : h.add(c.dataset.n); row.hs = [...h]; if (!row.hs.length) delete row.hs; dtRowsSave(S.rows);
        const sb = S.subs.find(x => x.row === row); if (sb) { sb.hs = new Set(row.hs || []); if (sb.data) dtDraw(sb); } hsB.querySelector('button[slot=trigger] small').textContent = hsN.filter(n => !(row.hs || []).includes(n)).length + '/' + hsN.length; });
      hsB = sfw;
    }
    hd.append(ss, ms, ...(lt ? [lt] : []), ...(hsB ? [hsB] : []), el('span', { className: 'ndrgap' }), mvb, lb);
    const cv = el('canvas', { id: 'ndcv_r' + i, className: 'ndcvm' });
    if (row.h) cv.style.height = row.h + 'px';
    const rz = el('div', { className: 'ndrz', title: t('dt_resize') }); rz.setAttribute('role', 'separator'); rz.setAttribute('aria-orientation', 'horizontal');
    const cw = el('div', { className: 'ndcvw' }); cw.append(cv, spinEl());
    box.append(hd, cw, rz);
    const r = S.byData && S.byData[row.src];
    const sub = { el: { cv: cv.id, hover: 'ndhover' }, src: row.src, name: name(row.src), parent: S, req: 0, mode: row.mode || 'level', row, hs: new Set(row.hs || []), lay: Object.assign({ lo: false, mid: false, hi: false, dom: false, cen: false }, row.lay || {}), data: r && r.has ? r : null };
    if (!sub.data) { cv.hidden = true; hd.appendChild(el('small', { className: 'ndrnone', textContent: t('dt_none_row') })); }
    bindDay(sub, () => { S.from = S.to = null; S.yk = 1; dtLoad(S, true); });
    S.subs.push(sub);
    let rzd = null;                                   // Höhe der Zeile ziehen (Doppelklick = Standard), pro Browser gemerkt
    rz.addEventListener('pointerdown', e => { rzd = { y: e.clientY, h: cv.getBoundingClientRect().height }; rz.setPointerCapture(e.pointerId); rz.classList.add('on'); e.preventDefault(); });
    rz.addEventListener('pointermove', e => { if (!rzd) return; const h = clamp(Math.round(rzd.h + e.clientY - rzd.y), 70, 900); cv.style.height = h + 'px'; if (sub.data) dtDraw(sub); else dtEmpty(sub); });
    const rzUp = () => { if (!rzd) return; rzd = null; rz.classList.remove('on'); const r2 = S.rows[i] || row; r2.h = Math.round(cv.getBoundingClientRect().height); dtRowsSave(S.rows); };   // S.rows wird beim Laden neu erzeugt: dort speichern
    rz.addEventListener('pointerup', rzUp); rz.addEventListener('pointercancel', rzUp);
    rz.addEventListener('dblclick', () => { delete (S.rows[i] || row).h; cv.style.height = ''; dtRowsSave(S.rows); if (sub.data) dtDraw(sub); });
  });
  const add = el('button', { type: 'button', className: 'chip ndradd', textContent: '＋ ' + t('dt_add') });
  add.disabled = S.rows.length >= 12;
  add.onclick = () => { const used = new Set(S.rows.map(r => r.src)), nx = SOURCES.find(s => !used.has(s.id)) || SOURCES[0]; if (!nx) return; S.rows.push({ src: nx.id, mode: 'level', lay: {} }); dtRowsSave(S.rows); dtRowsRender(S); };
  box.appendChild(add);
  for (const sub of S.subs) if (sub.data) dtDraw(sub);
  requestAnimationFrame(() => { for (const sub of S.subs) if (sub.data) dtDraw(sub); });   // nach dem Layout noch einmal in voller Breite
}
function dtJump(k, tr) {                             // Ereignis in der Tabelle gewählt: Verlauf aller Geräte springt dorthin
  const r = EV && EV.events.find(x => (x.k || '') === k); if (!r) return;
  const t0 = new Date(r.start).getTime(), dur = Math.max(+r.dauer_s || 0, 1) * 1000, span = Math.max(+r.clip_s || 0, +r.dauer_s || 0, 10) * 1000;
  DT.mark = [t0, t0 + dur]; DT.from = t0 - Math.max(60000, span * 0.5); DT.to = t0 + span + 60000;   // Störung markiert, mit Umfeld
  slSel(k, r.start);                                 // Sensor-Spuren: Suchfenster dieser Störung als Band
  const es = r.quelle_id || 'main';                // nur eine Zeile und anderes Gerät: die Zeile schaltet auf das Gerät der Störung um
  if (DT.rows && DT.rows.length === 1 && DT.rows[0].src !== es) { DT.rows[0].src = es; dtRowsSave(DT.rows); }
  EVCUR = k; if (TBL) TBL.redraw(x => x._t === 'ev');
  dtLoad(DT, true); $('ndaybox').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
/* Grenzen des Berichts (gewählter Zeitraum): weiter als hier wird nicht gescrollt bzw. herausgezoomt */
function nvSpan(d) {                                 // Zeitraum des Berichts; läuft er noch, endet er bei „jetzt“ (Neuestes rechts bündig)
  const a = new Date(d.start).getTime(), b = new Date(d.end).getTime(), now = nowServer();
  return b > now && now > a ? [a, Math.min(b, Math.ceil((now + clamp((now - a) * 0.015, 60000, 600000)) / 60000) * 60000)] : [a, b];
}
function dtBase(S) { const d = NV.data; if (d && d.start) return nvSpan(d); const a = parseDay(S.date).getTime(); return [a, a + 86400000]; }
/* Neuen Ausschnitt für alle Zeilen setzen: sofort verschoben zeichnen, Daten gedrosselt nachladen */
/* Zu einem Zeitraum springen: im Verlauf auf den Bereich zoomen (Umfeld = halbe Länge, mindestens 15 s) und markieren */
function dtFocus(a, b) {
  const e = Math.max(b, a + 1000), pad = Math.max(15000, (e - a) * 0.5);
  DT.mark = [a, e]; DT.from = a - pad; DT.to = e + pad; dtLoad(DT, true); $('ndaybox').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function dtSetWin(S, f, t2, load) {
  const [b0, b1] = dtBase(S), sp = Math.min(t2 - f, b1 - b0), now = nowServer(), bl = b1 > now && now > b0 ? now : b1;   // nicht über „jetzt“ hinaus schieben
  if (sp >= b1 - b0 - 1000) { S.from = S.to = null; S.zoom = false; }
  else { f = clamp(f, b0, Math.max(b0, bl - sp)); S.from = f; S.to = f + sp; S.zoom = true; }
  const [wf, wt] = dtWin(S);
  for (const sub of S.subs || []) if (sub.data) { sub.data = Object.assign({}, sub.data, { from: wf, to: wt }); dtDraw(sub); }
  if (S === DT) slDraw('scnd', wf, wt, 44, 10, 60000, !(S.subs || []).some(x => x.data));
  if (S.data) $('ndrange').textContent = dtRangeTxt({ from: wf, to: wt }); $('ndreset').disabled = $('ndreset').hidden = S.from == null;
  dtBar(S);
  clearTimeout(S._lt); S._lt = setTimeout(() => dtLoad(S, true), load === 'now' ? 0 : 60);   // kurz sammeln; läuft schon eine Abfrage, folgt die nächste direkt danach
}
function dtZoom(S, k, fx) {                          // k < 1 hinein, > 1 heraus; fx = Stelle (0…1), die stehen bleibt
  const [wf, wt] = dtWin(S), sp = wt - wf, ns = Math.max(30000, sp * k), c0 = wf + fx * sp;
  dtSetWin(S, c0 - fx * ns, c0 - fx * ns + ns);
}
/* Bildlaufleiste unter den Zeilen: zeigt den Ausschnitt im ganzen Zeitraum, ziehen = scrollen, Klick = dorthin */
function dtBar(S) {
  const bar = $('ndbar'); if (!bar) return;
  const [b0, b1] = dtBase(S), [wf, wt] = dtWin(S), on = S.from != null;
  bar.hidden = !on || !(S.subs || []).some(x => x.data); if (bar.hidden) return;
  const th = $('ndthumb'), a = clamp((wf - b0) / (b1 - b0), 0, 1), w = clamp((wt - wf) / (b1 - b0), 0, 1);
  th.style.left = (a * 100) + '%'; th.style.width = Math.max(w * 100, 2) + '%';
}
function initDtBar(S) {
  const bar = $('ndbar'), tr = $('ndtrack'), th = $('ndthumb'); if (!bar) return;
  let dg = null;
  const pos = e => { const r = tr.getBoundingClientRect(); return (e.clientX - r.left) / Math.max(1, r.width); };
  tr.addEventListener('pointerdown', e => {
    const [b0, b1] = dtBase(S), [wf, wt] = dtWin(S), sp = wt - wf;
    if (e.target !== th) { const c = b0 + pos(e) * (b1 - b0); dtSetWin(S, c - sp / 2, c + sp / 2, 'now'); }   // Klick daneben: Ausschnitt dorthin
    const [f2] = dtWin(S); dg = { x: pos(e), f: f2, sp }; tr.setPointerCapture(e.pointerId); e.preventDefault();
  });
  tr.addEventListener('pointermove', e => { if (!dg) return; const [b0, b1] = dtBase(S), f = dg.f + (pos(e) - dg.x) * (b1 - b0); dtSetWin(S, f, f + dg.sp); });
  const up = () => { if (dg) { dg = null; dtLoad(S, true); } };
  tr.addEventListener('pointerup', up); tr.addEventListener('pointercancel', up);
  $('ndzin').onclick = () => dtZoom(S, 0.5, 0.5); $('ndzout').onclick = () => dtZoom(S, 2, 0.5);
  $('ndleft').onclick = () => { const [wf, wt] = dtWin(S), sp = wt - wf; dtSetWin(S, wf - sp * 0.8, wt - sp * 0.8, 'now'); };
  $('ndright').onclick = () => { const [wf, wt] = dtWin(S), sp = wt - wf; dtSetWin(S, wf + sp * 0.8, wt + sp * 0.8, 'now'); };
}
/* Mausrad / Touchpad: Weg in Pixel; Zoomfaktor nach Weg (Mausrad-Raster ≈ 100 px ≈ 25 %, Touchpad-Schritte fein, Touchpad-Zwei-Finger-Spreizen = Strg + Rad) */
function wheelPx(e) { return e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1; }
/* Mausrad über einem Diagramm: Standard „nur mit Strg zoomen“, damit die Seite normal scrollt (Einstellung „Mausrad im Diagramm“).
   Touchpad-Spreizen (Strg ohne Raster), seitliches Wischen und Umschalt + Rad bleiben beim Diagramm. */
const isPinch = e => e.ctrlKey && e.deltaMode === 0 && Math.abs(e.deltaY) < 50;
function wheelGate(e, cv) {
  if (e.ctrlKey || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || (CUR && CUR.wheel_zoom === 'always')) return true;
  const now = Date.now();
  if (!cv._wzT || now - cv._wzT > 4000) { cv._wzT = now; toast(t('wz_hint')); }
  return false;
}
function wheelK(px, pinch) { return Math.exp(clamp(px, -300, 300) * (pinch ? 0.01 : 0.0022)); }
/* Zwei Finger auf Touch-Geräten: zoomen und gleichzeitig verschieben. Läuft über Touch-Ereignisse, damit der Browser
   dabei nicht die Seite scrollt; ein Finger bleibt für Seite scrollen (senkrecht) bzw. Ziehen (waagerecht). */
function bindPinch(cv, win, fxAt, set, cancel, done) {
  let p = null;
  const mx = e => { const r = cv.getBoundingClientRect(), a = e.touches[0], b = e.touches[1]; return { x1: a.clientX - r.left, x2: b.clientX - r.left, w: r.width }; };
  cv.addEventListener('touchstart', e => {
    if (e.touches.length !== 2) return; const w0 = win(); if (!w0) return;
    e.preventDefault(); cancel(); const m = mx(e);
    p = { d: Math.max(20, Math.abs(m.x2 - m.x1)), fx: fxAt((m.x1 + m.x2) / 2), wf: w0[0], wt: w0[1] };
  }, { passive: false });
  cv.addEventListener('touchmove', e => {
    if (!p) return; e.preventDefault(); if (e.touches.length !== 2) return;
    const m = mx(e), sp = p.wt - p.wf, ns = Math.max(30000, sp * p.d / Math.max(20, Math.abs(m.x2 - m.x1))), c0 = p.wf + p.fx * sp, fx = fxAt((m.x1 + m.x2) / 2);
    set(c0 - fx * ns, c0 - fx * ns + ns);           // Stelle unter den Fingern bleibt unter den Fingern (auch beim Verschieben)
  }, { passive: false });
  const end = e => { if (p && e.touches.length < 2) { p = null; done(); } };
  cv.addEventListener('touchend', end); cv.addEventListener('touchcancel', end);
}
/* Verlauf: Mausrad (mit Strg) oder zwei Finger = zoomen, Ziehen = scrollen (wenn hineingezoomt), sonst bzw. mit Umschalt = Bereich aufziehen */
function bindDay(S, reset) {
  const cv = $(S.el.cv); if (!cv) return;
  const tg = S.parent || S;                          // alle Geräte: Zoom und Scrollen gelten für alle Zeilen
  const xAt = e => e.clientX - cv.getBoundingClientRect().left;
  const fxAt = x => S.geo ? clamp((x - S.geo.L) / S.geo.pw, 0, 1) : 0.5;
  const pts = new Map(); let pinch = null, pan = null;
  cv.style.touchAction = 'pan-y';
  let ptd = null;
  const yAt = e => e.clientY - cv.getBoundingClientRect().top;
  cv.addEventListener('pointerdown', e => {
    if (!e.button && ptNear(S, yAt(e))) { ptd = { id: e.pointerId }; cv.setPointerCapture(e.pointerId); e.preventDefault(); return; }   // Prüf-Schwelle ziehen
    if (DR.on && !e.button && S.data && S.geo) { pts.clear(); pinch = null; pan = null; S.drag = { a: xAt(e), b: xAt(e), mk: true, del: true }; cv.setPointerCapture(e.pointerId); dtDraw(S); return; }
    if (MK.on && !e.button && S.data && S.geo) { mkClose(); pts.clear(); pinch = null; pan = null; S.drag = { a: xAt(e), b: xAt(e), mk: true }; cv.setPointerCapture(e.pointerId); dtDraw(S); return; }
    pts.set(e.pointerId, xAt(e)); cv.setPointerCapture(e.pointerId);
    if (pts.size === 2 && e.pointerType === 'touch') { S.drag = null; pan = null; return; }   // zwei Finger: bindPinch
    if (pts.size === 2 && S.parent) {                // zwei Finger: zoomen
      const [x1, x2] = [...pts.values()], [wf, wt] = dtWin(tg); S.drag = null; pan = null;
      pinch = { d: Math.max(20, Math.abs(x2 - x1)), fx: fxAt((x1 + x2) / 2), wf, wt }; return;
    }
    if (pts.size > 1) return;
    if (S.parent && tg.from != null && !e.shiftKey) { const [wf, wt] = dtWin(tg); pan = { x: xAt(e), wf, wt, moved: false }; return; }
    S.drag = { a: xAt(e), b: xAt(e) };
  });
  cv.addEventListener('pointermove', e => {
    if (ptd) { const v = ptVal(S, yAt(e)); if (v != null) ptSet(v, false); return; }
    const dh = !MK.on && !DR.on && hitAt(S, xAt(e), yAt(e));   // anklickbar: Unterbrechung, Notiz, Sensor (breite Sensor-Balken nur oben)
    cv.style.cursor = ptNear(S, yAt(e)) ? 'ns-resize' : dh && !S.drag && !pan ? 'pointer' : '';
    cv.title = dh ? dh[2] : '';
    if (pts.has(e.pointerId)) pts.set(e.pointerId, xAt(e));
    if (pts.size > 1 && e.pointerType === 'touch') return;
    if (pinch && pts.size === 2) {
      const [x1, x2] = [...pts.values()], k = pinch.d / Math.max(20, Math.abs(x2 - x1)), sp = pinch.wt - pinch.wf, ns = Math.max(30000, sp * k), c0 = pinch.wf + pinch.fx * sp;
      dtSetWin(tg, c0 - pinch.fx * ns, c0 - pinch.fx * ns + ns); return;
    }
    if (pan) {
      const dx = xAt(e) - pan.x; if (Math.abs(dx) > 3) pan.moved = true; if (!pan.moved || !S.geo) return;
      const sh = -dx / S.geo.pw * (pan.wt - pan.wf); cv.style.cursor = 'grabbing'; dtSetWin(tg, pan.wf + sh, pan.wt + sh); return;
    }
    if (S.drag) { S.drag.b = xAt(e); dtDrawRaf(S); } else dtDrawRaf(S, xAt(e));
  });
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') tipHide('day'); if (!S.drag && !pan) { $(S.el.hover).textContent = ''; dtDraw(S); } });
  let dcT = 0;                                       // Klick auf eine Unterbrechung: Kommentar (kurz warten, ein Doppelklick hat Vorrang)
  const downClick = (x, e) => {
    if (MK.on || DR.on || e.type !== 'pointerup') return false;
    const y = yAt(e), h = hitAt(S, x, y); if (!h) return false;
    clearTimeout(dcT); const cx = e.clientX, cy = e.clientY; dcT = setTimeout(() => h[3] && h[3].kind === 'fn' ? fnOpenId(h[3]) : h[3] && h[3].kind === 'ha' ? haPop(h[3]) : rnOpen(h[3], cx, cy), 260); return true;
  };
  const up = e => {
    if (ptd) { ptd = null; ptSet(PT.v, true); return; }
    pts.delete(e.pointerId); cv.style.cursor = '';
    if (pinch) { if (pts.size < 2) { pinch = null; dtLoad(tg, true); } return; }
    const tap = e.pointerType !== 'mouse';             // Finger/Stift: Tippen zeigt die Werte an der Stelle (statt Maus darüber)
    if (pan) { const m = pan.moved, x0 = pan.x; pan = null; if (m) dtLoad(tg, true); else if (!downClick(x0, e)) { if (tap) dtDraw(S, x0); } return; }
    const g = S.geo, r = S.data, dr = S.drag; S.drag = null; if (!g || !r || !dr) return;
    const a = Math.min(dr.a, dr.b), b = Math.max(dr.a, dr.b);
    if (dr.mk) {                                     // markierter Bereich: benennen
      if (b - a < 4 || e.type !== 'pointerup') { dtDraw(S); return; }
      const tq2 = x => r.from + (r.to - r.from) * clamp((x - g.L) / g.pw, 0, 1), ta = tq2(a), tb = tq2(b);
      mkOpen(S.src || selSrc, ta, tb, e.clientX, e.clientY, () => dtDraw(S), { day: S }); dtDraw(S); return;
    }
    if (b - a < 6) { if (downClick(dr.a, e)) { dtDraw(S); return; } if (tap) dtDraw(S, dr.a); else dtDraw(S); return; }
    const tq = x => r.from + (r.to - r.from) * clamp((x - g.L) / g.pw, 0, 1);
    tg.from = tq(a); tg.to = Math.max(tq(b), tg.from + 30000); tg.zoom = true; dtLoad(tg, true);
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => {
    if (!wheelGate(e, cv)) return;                 // Mausrad / Touchpad = zoomen, Umschalt + Rad oder seitlich wischen = scrollen
    e.preventDefault();
    if (!S.parent || !S.data || !S.geo) return;
    const u = wheelPx(e), dx = u * e.deltaX, dy = u * e.deltaY, side = Math.abs(dx) > Math.abs(dy) ? dx : 0;
    if (!side && (e.shiftKey || xAt(e) < S.geo.L)) {  // Umschalt + Mausrad oder über der dB-Beschriftung: Höhe (alle Zeilen), unten bündig
      tg.yk = clamp((tg.yk || 1) * wheelK(dy, isPinch(e)), 0.02, 1); for (const sub of tg.subs || [tg]) if (sub.data) dtDraw(sub); return;
    }
    if (side && tg.from != null) { const [wf, wt] = dtWin(tg), sh = side / S.geo.pw * (wt - wf); dtSetWin(tg, wf + sh, wt + sh); return; }
    const z = side || dy; if (!z) return;
    dtZoom(tg, wheelK(z, isPinch(e)), fxAt(xAt(e)));  // Stärke nach Weg: ein Mausrad-Raster ≈ 25 %, Touchpad fein
  }, { passive: false });
  bindPinch(cv, () => S.parent && S.data && S.geo ? dtWin(tg) : null, fxAt, (f, t2) => dtSetWin(tg, f, t2), () => { pts.clear(); pinch = null; pan = null; S.drag = null; }, () => dtLoad(tg, true));
  cv.addEventListener('dblclick', e => { clearTimeout(dcT); reset(e); });
}
/* Kommentar zu einer Unterbrechung direkt im Verlauf: kleines Fenster an der Klickstelle (gleiche Daten wie die Liste in Protokolle) */
const RN = { pop: null, g: null };
function rnClose() { if (RN.pop) RN.pop.hidden = true; RN.g = null; }
function rnOpen(g, cx, cy) {
  if (!g) return; tipHide(); mkClose(); RN.g = g;
  let p = RN.pop;
  if (!p) {
    p = RN.pop = el('div', { id: 'rnpop', className: 'lbpop mkpop rnpop' }); p.setAttribute('role', 'dialog'); p.hidden = true;
    p.innerHTML = `<b id="rntitle"></b><div id="rnsub" class="mksub"></div><input id="rntext" type="text" maxlength="300" autocomplete="off">
      <div class="ntedbtns"><button type="button" id="rndel" class="danger"></button><span class="rngap"></span><button type="button" id="rncancel"></button><button type="button" id="rnsave" class="pri"></button></div>`;
    document.body.appendChild(p);
    const save = async txt => {
      const g2 = RN.g; if (!g2) return;
      try { const r = await (await fetch('run_note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: g2[3], text: txt }) })).json(); if (!r.ok) throw new Error(r.error || 'error'); }
      catch (er) { alert(t('saveerr') + ' ' + er.message); return; }
      rnClose(); loadRun(); LDDK = ''; if (LDT.from != null) ldDown(LDT.from, LDT.to);
    };
    $('rnsave').onclick = () => save($('rntext').value); $('rndel').onclick = () => save(''); $('rncancel').onclick = rnClose;
    $('rntext').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save($('rntext').value); } else if (e.key === 'Escape') rnClose(); });
    document.addEventListener('pointerdown', e => { if (!p.hidden && !p.contains(e.target) && !e.target.closest('canvas')) rnClose(); }, true);
  }
  const L = locale(), fm = ms => new Date(ms).toLocaleString(L, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  $('rntitle').textContent = '📝 ' + (x => x.charAt(0).toUpperCase() + x.slice(1))(t('dt_norec')) + ' ' + fm(g[0]) + ' – ' + fm(g[1]);
  const ev = g[5] || {}; $('rnsub').textContent = t(ev.reason === 'update' ? 'run_r_update' : g[4] === 'lost' ? 'run_r_lost' : 'run_r_restart');
  $('rntext').value = g[2] || ''; $('rntext').placeholder = t('run_note_ph');
  $('rnsave').textContent = t('save'); $('rncancel').textContent = t('cancel'); $('rndel').textContent = t('run_note_del'); $('rndel').hidden = !g[2];
  p.hidden = false;
  const w = p.offsetWidth, h = p.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
  p.style.left = clamp(cx - w / 2, 8, Math.max(8, vw - w - 8)) + 'px'; p.style.top = (cy + 14 + h > vh - 8 ? Math.max(8, cy - 14 - h) : cy + 14) + 'px';
  $('rntext').focus(); $('rntext').select();
}
/* ================= Verlauf drucken („Notenblatt“): Zeitraum, Zeit je Zeile, Geräte, Inhalt, Format -> Vorschau-Seite ================= */
const PR = (() => { let c = null; try { c = JSON.parse(localStorage.getItem('laerm_pr') || 'null'); } catch (e) { } return Object.assign({ line: 10, lvl: true, spec: false, info: true, skip: true, scale: 'same', o: 'l' }, c && typeof c === 'object' ? c : {}); })();
const prDtl = ms => { const d = new Date(ms); return isoDay(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
function prSet(a, b) { $("prfrom").value = prDtl(a); $("prto").value = prDtl(b); prEst(); }
function prVals() {
  const a = new Date($('prfrom').value).getTime(), b = new Date($('prto').value).getTime();
  const devs = [...$('prdevs').querySelectorAll('input:checked')].map(x => x.value);
  return { a, b, devs, line: +$('prline').value, lvl: $('prlvl').checked, spec: $('prspec').checked, info: $('prinfo').checked, skip: $('prskip').checked, scale: $('prscale').value, o: PR.o };
}
function prEst() {
  const v = prVals(), el_ = $('prest');
  if (!(v.b > v.a)) { el_.textContent = t('pr_bad'); el_.className = 'prest warn'; $('prgo').disabled = true; return; }
  if (!v.devs.length || !(v.lvl || v.spec || v.info)) { el_.textContent = t('pr_none'); el_.className = 'prest warn'; $('prgo').disabled = true; return; }
  const lines = Math.ceil((v.b - v.a) / (v.line * 60000));
  const per = (v.lvl ? 22 : 0) + (v.spec ? 14 : 0) + (v.info ? 5 : 0) + (v.devs.length > 1 ? 3 : 0), blk = 6 + per * v.devs.length;
  const pages = Math.max(1, Math.ceil(lines * blk / (v.o === 'p' ? 262 : 175)));
  el_.textContent = t(v.skip ? 'pr_est_max' : 'pr_est', { l: lines, p: pages }) + (PT.v != null ? ' · ' + t('pt_line', { v: f1(PT.v) }) : '') + (pages > 150 ? ' – ' + t('pr_many') : ''); el_.className = 'prest' + (pages > 10 ? ' warn' : '');
  $('prgo').disabled = false;
}
function prOpen() {
  const [wf, wt] = dtWin(DT);
  const rows = new Set((DT.rows || []).map(r => r.src));
  $('prdevs').innerHTML = '';
  for (const s2 of viewSources()) { const l = el('label', { className: 'chip' }), c = el('input', { type: 'checkbox', value: s2.id, checked: rows.size ? rows.has(s2.id) : true }); c.onchange = prEst; l.append(c, document.createTextNode(' ' + s2.name)); $('prdevs').appendChild(l); }
  $('prline').value = String(PR.line); $('prlvl').checked = PR.lvl; $('prspec').checked = PR.spec; $('prinfo').checked = PR.info; $('prskip').checked = PR.skip !== false; $('prev').checked = PR.ev !== false; $('prmfo').checked = !!PR.mfo; $('prscale').value = PR.scale;
  $('prorient').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.o === PR.o));
  prSet(wf, wt); $('prdlg').showModal();
}
function initPrint() {
  if (!$('prdlg')) return;
  $('ndprint').onclick = prOpen; $('prx').onclick = $('prcancel').onclick = () => $('prdlg').close();
  ['prfrom', 'prto', 'prline', 'prlvl', 'prspec', 'prinfo', 'prskip', 'prscale'].forEach(id => { $(id).addEventListener('input', prEst); $(id).addEventListener('change', prEst); });
  $('prorient').querySelectorAll('button').forEach(b => b.onclick = () => { PR.o = b.dataset.o; $('prorient').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); prEst(); });
  $('prq_view').onclick = () => { const [a, b] = dtWin(DT); prSet(a, b); };
  $('prq_per').onclick = () => { const [a, b] = dtBase(DT); prSet(a, b); };
  $('prq_all').onclick = async () => {
    try { const j = await (await fetch('trackdays', { cache: 'no-store' })).json(); if (j.days && j.days.length) prSet(parseDay(j.days[0]).getTime(), Math.ceil(nowServer() / 60000) * 60000); } catch (e) { }
  };
  $('prgo').onclick = () => {
    const v = prVals(); if (!(v.b > v.a) || !v.devs.length) return;
    Object.assign(PR, { line: v.line, lvl: v.lvl, spec: v.spec, info: v.info, skip: v.skip, scale: v.scale, ev: $('prev').checked, mfo: $('prmfo').checked }); try { localStorage.setItem('laerm_pr', JSON.stringify(PR)); } catch (e) { }
    const srcs = v.devs.map(id => [id, viewName(id)]);
    const u = 'druck.html?from=' + v.a + '&to=' + v.b + '&line=' + v.line + '&lvl=' + (v.lvl ? 1 : 0) + '&spec=' + (v.spec ? 1 : 0) + '&info=' + (v.info ? 1 : 0) + '&skip=' + (v.skip ? 1 : 0) + '&ev=' + (PR.ev ? 1 : 0) + '&mfo=' + (PR.mfo ? 1 : 0)
      + '&scale=' + v.scale + '&o=' + v.o + '&pt=' + (PT.v != null ? PT.v : '') + '&lang=' + lang + '&ver=' + encodeURIComponent(((document.querySelector('script[src^="app.js"]') || {}).src || '').split('v=')[1] || '') + '&srcs=' + encodeURIComponent(JSON.stringify(srcs));
    const w = window.open(u, '_blank'); if (!w) alert(t('pr_popup')); else $('prdlg').close();
  };
}
function initDayTrack() {
  initPrint(); initPt();
  if (!$('ndcv')) return;
  bindDay(DT, () => { DT.from = DT.to = null; DT.yk = 1; dtLoad(DT, true); });
  initDtBar(DT);
  $('ndreset').onclick = () => { DT.from = DT.to = null; DT.yk = 1; dtLoad(DT, true); };
  bindLive();
  document.querySelectorAll('.mkbtn').forEach(b => b.onclick = () => mkSet(!MK.on));
  document.querySelectorAll('.drbtn').forEach(b => b.onclick = () => drSet(!DR.on));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && DR.on) drSet(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && MK.on && (!MK.pop || MK.pop.hidden)) mkSet(false); });
  window.addEventListener('resize', () => { if (NV.open) dtLoad(DT, true); if (histOn()) { dtDraw(LDT); dtSpec(LDT); } });
}
/* Live-Ansicht zurückspulen: über die Arbeitsspeicher-Grenze (10 min) hinaus oder mit 1 h / 6 h / Heute zeigt die Grafik
   den Tagesverlauf; das Spektrogramm darunter gibt es nur bei Störungen (aus deren Lärmspuren). Ziehen = spulen, Mausrad = Zeitraum, Doppelklick = Live. */
const SPC = {};                                     // Lärmspur-Cache für das Spektrogramm: Datei -> Promise(R)
function histOn() { return LONG_SPAN(view.span) || LDT.hist; }
function syncLongSpan() {
  const on = histOn();
  $('ldaybox').hidden = !on;
  document.querySelectorAll('.cvwrap').forEach(e => e.classList.toggle('longhide', on));
  $('spec').hidden = on; $('ldsp').hidden = !on; if (!on) slHide('scld');   // Spektrogramm und Spuren stehen in eigenen Bereichen: kurz oder lang
  clearInterval(LDT.timer); LDT.timer = null;
  if (on) {
    dtLoad(LDT, LDT.zoom);
    LDT.timer = setInterval(() => { if (!document.hidden && !NV.open && !PV.open && !LDT.zoom && !LDT.drag) dtLoad(LDT, true); }, 10000);
  }
  markDirty();
}
function histEnter(from, to) {                      // aus dem Live-Bild weiter zurückgespult als der Arbeitsspeicher reicht
  LDT.hist = true; LDT.zoom = true; LDT.from = from; LDT.to = to;
  TILE.manual = true; TILE.at = Date.now();          // Rundlauf steht, solange zurückgespult ist
  syncLongSpan();
}
function histExit() {
  if (!LDT.hist && !LDT.zoom) return;
  LDT.hist = false; LDT.zoom = false;
  if (LONG_SPAN(view.span)) dtLoad(LDT, false); else syncLongSpan();
}
function dtSpec(S) {
  const cv = $('ldsp'), r = S.data; if (!cv || !r || !cv.offsetParent) return;
  fit(cv); const d = DPR(), c = cv.getContext('2d'), w = cv.width, h = cv.height, L = 44 * d, Rr = 10 * d, pw = w - L - Rr;
  const span = r.to - r.from, X = t2 => L + pw * (t2 - r.from) / span;
  c.clearRect(0, 0, w, h); c.fillStyle = C.grid; c.fillRect(L, 0, pw, h);
  c.fillStyle = NC.mut; c.font = (10 * d) + 'px system-ui'; c.textAlign = 'left';
  if (drawSpecInto(c, r, X, 0, h, L, pw, d)) return;  // Spektrum des ganzen Tages gespeichert: durchgehend zeigen
  if (span > 3 * 3600000) { c.fillText(t('dt_spec_zoom'), L + 6 * d, h / 2 + 3 * d); return; }
  if (!(r.sp || []).length) { c.fillText(t('dt_spec_none'), L + 6 * d, h / 2 + 3 * d); return; }
  let vis = r.sp.filter(x => x[1] >= r.from && x[0] <= r.to);
  if (vis.length > 60) { const k = vis.length / 60; vis = Array.from({ length: 60 }, (_, i) => vis[Math.floor(i * k)]); }   // gleichmäßig verteilt, nicht nur die ersten
  for (const x of vis) {
    if (!SPC[x[2]]) {
      const e = SPC[x[2]] = { v: undefined };
      fetch('spur?f=' + encodeURIComponent(x[2]), { cache: 'force-cache' }).then(q => q.ok ? q.json() : null).then(g => g && g.recs && g.recs.length ? { g, R: evDecode(g) } : null)
        .catch(() => null).then(v2 => { e.v = v2; if (v2) dtSpec(S); });
    }
    const v = SPC[x[2]].v; if (!v) continue;
    if (!v.tc) {                                    // Bild der Spur einmal berechnen (feste Farbskala 0,5 dB ab -130 dBFS)
      const R = v.R, nb = R.nb || NB, tc = document.createElement('canvas'); tc.width = R.length; tc.height = nb;
      const img = tc.getContext('2d').createImageData(R.length, nb), px = img.data, lo = 2 * (-110 + 130), hi = 2 * (-30 + 130);
      R.forEach((q, xx) => { for (let k = 0; k < nb; k++) { const cc = cmap((q.sp[k] - lo) / (hi - lo)), o = 4 * ((nb - 1 - k) * R.length + xx); px[o] = cc[0]; px[o + 1] = cc[1]; px[o + 2] = cc[2]; px[o + 3] = 255; } });
      tc.getContext('2d').putImageData(img, 0, 0); v.tc = tc;
    }
    const R = v.R, stp = R.step || 125, a = v.g.t0 + R[0].o - stp, b = v.g.t0 + R[R.length - 1].o;
    c.save(); c.beginPath(); c.rect(L, 0, pw, h); c.clip(); c.imageSmoothingEnabled = true; c.drawImage(v.tc, X(a), 0, Math.max(1, X(b) - X(a)), h); c.restore();
  }
}
function bindLive() {
  const cv = $('ldcv'), S = LDT; if (!cv) return;
  const xAt = e => e.clientX - cv.getBoundingClientRect().left;
  let lastLoad = 0;
  cv.addEventListener('pointerdown', e => {
    if (!S.data) return;
    if (MK.on && !e.button && S.geo) { mkClose(); S.drag = { a: xAt(e), b: xAt(e), mk: true }; cv.setPointerCapture(e.pointerId); dtDraw(S); return; }
    S.drag = { x: xAt(e), from: S.data.from, to: S.data.to, moved: false }; cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (!S.drag) { dtDrawRaf(S, xAt(e)); return; }
    if (S.drag.mk) { S.drag.b = xAt(e); dtDrawRaf(S); return; }
    const g = S.geo; if (!g) return;
    const dx = xAt(e) - S.drag.x; if (Math.abs(dx) > 3) S.drag.moved = true; if (!S.drag.moved) return;
    const span = S.drag.to - S.drag.from, sh = -dx / g.pw * span, now = nowServer();
    let f = S.drag.from + sh, t2 = S.drag.to + sh; if (t2 > now) { t2 = now; f = now - span; }
    S.from = f; S.to = t2; S.zoom = true;
    S.data = Object.assign({}, S.data, { from: f, to: t2 }); dtDrawRaf(S); dtSpec(S);
    if (Date.now() - lastLoad > 300) { lastLoad = Date.now(); dtLoad(S, true); }
  });
  const up = e => {
    if (S.drag && S.drag.mk) {
      const dr = S.drag, g = S.geo, r = S.data; S.drag = null; const a = Math.min(dr.a, dr.b), b = Math.max(dr.a, dr.b);
      if (!g || !r || b - a < 4 || e.type !== 'pointerup') { dtDraw(S); return; }
      const tq2 = x => r.from + (r.to - r.from) * clamp((x - g.L) / g.pw, 0, 1);
      if (dr.del) { drOpen(S.src || NV.src || 'all', tq2(a), tq2(b)); dtDraw(S); return; }
      mkOpen(selSrc, tq2(a), tq2(b), e.clientX, e.clientY, () => dtDraw(S), { day: S }); dtDraw(S); return;
    }
    if (S.drag && S.drag.moved) {
      if (S.to >= nowServer() - 2000) { S.drag = null; if (!LONG_SPAN(view.span)) { goLive(); return; } S.zoom = false; }   // bis jetzt gespult: wieder live
      S.drag = null; dtLoad(S, true); return;
    }
    S.drag = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') tipHide('day'); if (!S.drag) { $(S.el.hover).textContent = ''; dtDraw(S); } });
  cv.addEventListener('wheel', e => {
    if (!wheelGate(e, cv)) return;
    e.preventDefault(); if (!S.data || !S.geo) return;
    const u = wheelPx(e), side = Math.abs(e.deltaX) > Math.abs(e.deltaY), z = side ? u * e.deltaX : u * e.deltaY; if (!z) return;
    if (!side && (e.shiftKey || xAt(e) < S.geo.L)) { S.yk = clamp((S.yk || 1) * wheelK(z, isPinch(e)), 0.02, 1); dtDraw(S); return; }   // Höhe
    if (side) { const sh = z / S.geo.pw * (S.data.to - S.data.from); setWin(S.data.from + sh, S.data.to + sh); return; }   // seitlich wischen: verschieben
    if (!LDT.hist && (!S.zoom || S.data.to >= nowServer() - 3000)) {   // läuft bis „jetzt“: Zeitfenster zoomen, rechter Rand bleibt jetzt (unter 10 min wieder das normale Live-Bild)
      setSpan(clamp(Math.round(view.span * wheelK(z, isPinch(e))), 5, 34560000)); return;
    }
    const r = S.data, span = r.to - r.from, ns = clamp(span * wheelK(z, isPinch(e)), 60000, 400 * 86400000);
    const fx = clamp((xAt(e) - S.geo.L) / S.geo.pw, 0, 1), c0 = r.from + fx * span;
    setWin(c0 - fx * ns, c0 - fx * ns + ns);
  }, { passive: false });
  const setWin = (f, t2) => {                          // nicht über „jetzt“ hinaus; Daten gedrosselt nachladen
    const ns = clamp(t2 - f, 60000, 400 * 86400000), now = nowServer(); t2 = f + ns; if (t2 > now) { t2 = now; f = now - ns; }
    S.from = f; S.to = t2; S.zoom = true; S.data = Object.assign({}, S.data, { from: f, to: t2 }); dtDraw(S); dtSpec(S);
    if (Date.now() - lastLoad > 300) { lastLoad = Date.now(); dtLoad(S, true); }
  };
  bindPinch(cv, () => S.data && S.geo ? [S.data.from, S.data.to] : null, x => S.geo ? clamp((x - S.geo.L) / S.geo.pw, 0, 1) : 0.5, setWin, () => { S.drag = null; }, () => dtLoad(S, true));
  const back = () => { S.yk = 1; if (LONG_SPAN(view.span)) setSpan(view.preset && !LONG_SPAN(view.preset) ? view.preset : 60); goLive(); };     // ● Live: zurück zum normalen Live-Bild
  cv.addEventListener('dblclick', back);
  $('ldlive').onclick = back;
}
/* ================= Dashboard: Ereignisse des Tages als einfache Liste (Spalten und Gerät einstellbar, pro Browser gemerkt) ================= */
const LEV_RNG = ['vis', 'today', '24h', '7d', '30d', 'custom'];
const LEV_COLS = ['tm', 'src', 'art', 'sc', 'kinds', 'devs', 'dur', 'pk', 'thr', 'bg', 'nt'];
const LEV = (() => { let c = null; try { c = JSON.parse(localStorage.getItem('laerm_lev') || 'null'); } catch (e) { } c = c && typeof c === 'object' ? c : {};
  const rng = LEV_RNG.includes(c.rng) ? c.rng : c.vis === false ? 'today' : 'vis';
  return { cols: Array.isArray(c.cols) ? c.cols.filter(x => LEV_COLS.includes(x)) : ['tm', 'src', 'art', 'sc', 'devs', 'dur', 'pk', 'bg', 'nt'], src: c.src === 'sel' ? 'sel' : 'all', rng, cf: c.cf || '', ct: c.ct || '',
    get vis() { return this.rng === 'vis'; }, key: '', data: null, req: 0, fa: 0, fb: 0, sig: '' }; })();
function levSave() { try { localStorage.setItem('laerm_lev', JSON.stringify({ cols: LEV.cols, src: LEV.src, rng: LEV.rng, cf: LEV.cf, ct: LEV.ct })); } catch (e) { } }
/* Anzeigebereich der Tabelle: sichtbarer Bereich des Graphen, heute, letzte 24 h / 7 / 30 Tage oder eigener Zeitraum */
function levRange() {
  const now = nowServer(), d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  const tom = new Date(d0); tom.setDate(tom.getDate() + 1);
  const minute = x => Math.floor(x / 60000) * 60000;
  switch (LEV.rng) {
    case 'today': return [d0.getTime(), tom.getTime()];
    case '24h': return [minute(now - 86400000), minute(now) + 120000];
    case '7d': { const a = new Date(d0); a.setDate(a.getDate() - 6); return [a.getTime(), tom.getTime()]; }
    case '30d': { const a = new Date(d0); a.setDate(a.getDate() - 29); return [a.getTime(), tom.getTime()]; }
    case 'custom': { const a = LEV.cf ? new Date(LEV.cf).getTime() : d0.getTime(), b = LEV.ct ? new Date(LEV.ct).getTime() : now; return isFinite(a) && isFinite(b) && b > a ? [a, b] : [d0.getTime(), now]; }
  }
  return null;
}
function levTitle() {
  const L = locale(), f = x => new Date(x).toLocaleString(L, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  if (LEV.rng === 'custom') { const r = levRange(); return t('lev_t_custom', { a: f(r[0]), b: f(r[1]) }); }
  return t('lev_t_' + LEV.rng);
}
function levTitleSet() {                              // Überschrift von Panel und Karte passend zum Anzeigebereich
  const txt = levTitle();
  const h = $('ldevh'); if (h) { h.removeAttribute('data-i'); h.textContent = txt; }
  dashTitle('live', 'ldev', txt);                     // Bereichs-Überschrift: eine eigene (✎) bleibt stehen
}
function levHead(c) { return { tm: t('start'), src: t('src_col'), art: t('art_col'), sc: t('sc_col'), kinds: t('kinds_col'), devs: t('devs_col'), dur: t('dur'), pk: t('peak'), thr: t('thr_col'), bg: t('bg_col'), nt: '📝' }[c]; }
function levWin() {                                   // im Live-Bild gerade sichtbarer Zeitraum (normales Live-Bild oder Verlauf, auch gezoomt/verschoben)
  if (histOn()) return LDT.data && LDT.data.from ? [LDT.data.from, LDT.data.to] : null;
  return viewRange();
}
async function levLoad(force) {
  if (NV.open || !$('ldev')) return;                 // nur im Live-Reiter
  const now = new Date(nowServer()), nx = new Date(now); nx.setDate(nx.getDate() + 1);
  const w0 = LDT.data && LDT.data.from ? LDT.data.from : (LDT.from || now.getTime() - 86400000);     // Anfang des im Live-Verlauf sichtbaren Bereichs
  const win = LEV.vis ? levWin() : null, rg = LEV.vis ? null : levRange();
  let fa = Math.min(w0, now.getTime()), fb = nx.setHours(0, 0, 0, 0);
  if (win) { fa = Math.floor((win[0] - 60000) / 60000) * 60000; fb = Math.ceil((win[1] + 60000) / 60000) * 60000 + 60000; }   // nur den sichtbaren Bereich holen (mit 1 min Rand)
  else if (rg) { fa = rg[0]; fb = rg[1]; }
  if (win && fb > nowServer()) fb = Math.ceil((win[1] + 60000) / 60000) * 60000 + 300000;   // ab 1.85.46: 5 min Vorlauf nach rechts – sonst läuft das Livebild dem Fenster jede Minute davon
  const src = LEV.src === 'sel' ? selSrc : 'all', key = [lastCount, src, fa, fb, LEV.rng].join('|');
  if (!force && key === LEV.key) return;
  if (LEV.busy) { LEV.again = true; return; }       // ab 1.85.46: nie zwei Anfragen zugleich – eine kann Sekunden dauern, und jede weitere belegt eine der 6 Browser-Verbindungen (Livespur setzt dann aus)
  LEV.key = key; LEV.busy = true; LEV.again = false; LEV.t0 = Date.now();
  const id = ++LEV.req; levTitleSet();
  try { const j = await (await fetch('events?src=' + encodeURIComponent(src) + '&n=' + (win ? 500 : 5000) + '&from=' + dtl(new Date(fa)).slice(0, 16) + '&to=' + dtl(new Date(fb)).slice(0, 16), { cache: 'no-store' })).json(); if (id !== LEV.req) return; LEV.data = j; LEV.at = Date.now(); LEV.fa = fa; LEV.fb = fb; LEV.sig = ''; levRender(); } catch (e) { LEV.key = ''; }
  finally { LEV.busy = false; if (LEV.again) { LEV.again = false; setTimeout(() => levLoad(true), 300); } }
}
function levTick() {                                  // sichtbarer Bereich ändert sich (Live läuft, Zoomen, Verschieben): Tabelle mitführen
  if (NV.open || !$('ldev') || document.hidden) return;
  if (LEV.busy) return;                               // Antwort steht noch aus
  // ab 1.85.43: spätestens alle 30 s neu holen – Sensor-Ereignisse und Notizen aus GReport ändern den Störungszähler nicht (der Server antwortet aus dem Zwischenspeicher)
  const due = Date.now() - Math.max(LEV.at || 0, LEV.t0 || 0) > 30000;
  if (!LEV.vis) { if (due || LEV.rng === '24h' || LEV.rng === 'today') levLoad(due); return; }
  const w = levWin(); if (!w) return;
  if (due || w[0] < LEV.fa || w[1] > LEV.fb - 60000) levLoad(true); else levRender();
}
let LTBL = null, LTBL_KEY = '';
const levGrp = () => { try { return localStorage.getItem('gl_lev_grp') !== 'all'; } catch (e) { return true; } };   // Live-Tabelle: Standard „Ereignisse“ (zusammengefasst)
const LEVOPEN = new Set();                             // aufgeklappte Gruppen der Live-Tabelle
function levRender(force) {
  const j = LEV.data, box = $('ldev'); if (!j || !box) return;
  { const w0 = LEV.vis ? levWin() : null;            // ab 1.85.35: gleiche Daten, gleicher Bereich (auf 2 s), gleiche Filter: gar nicht erst neu rechnen
    const pre = [w0 ? Math.round(w0[0] / 2000) + ':' + Math.round(w0[1] / 2000) : '', [...SHIDE].join(','), [...ARTSEL].join(','), levGrp(), JSON.stringify(STATS.filt.live), MF.show, fnShow(), lang, LEV.rng, LEV.fa, (LEV.cols || []).join(',')].join('|');
    if (!force && LTBL && LEV.sig && LEV.preJ === j && LEV.pre === pre) return;
    LEV.preJ = j; LEV.pre = pre; }
  sfltBuild();
  const evs = (j.events || []).filter(r => r.lead !== false && !mfHide(r));          // je Störung eine Zeile (lautestes Gerät), wie in Protokolle; Musterfilter
  const sens = (j.sens || []);
  const multi = evs.some(r => (r.devs || []).length > 1);
  const useArt = !CUR || CUR.classify !== false;
  const txt = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.trim(); };
  const rows = evs.map(r => ({ _hid: evSrcHid(r), id: 'e' + (r.k || r.start), k: r.k || '', start: new Date(r.start).getTime(), src: r.quelle || (SOURCES.find(x => x.id === (r.quelle_id || 'main')) || {}).name || r.quelle_id || '', r,
    tags: evTags(r), dur: r.dauer_s, pk: r.spitze_dbfs, thr: r.schwelle_dbfs, bg: r.hintergrund_dbfs, nt: r.notes ? '📝 ' + r.notes : '' }))   // ab 1.85.46: wie in Protokolle, mit der Geräuschart (Art-Filter war in Live leer)
    .concat(fnLink(j.fnotes, j.events, j).map(([n, ev, dms]) => ({ _hid: !fnShow(), id: 'n' + n.id, k: '', start: n.a, fdms: dms, src: (n.src || 'all') === 'all' ? t('all_sources') : viewName(n.src), fn: n, fev: ev,
      tags: ['📝 ' + t('fn_row')].concat(n.kind_l ? [(n.kind_i ? n.kind_i + ' ' : '') + n.kind_l] : []), dur: Math.max(0, ((n.b || n.a) - n.a) / 1000), pk: null, nt: '📝 ' + [n.text, ...(n.tags || []).map(x => ntLabel(x)), n.witness ? '👤 ' + n.witness : '', ...fbList(n)].filter(Boolean).join(' · ') + (ev ? ' · 🔗 ' + t('fn_link', { c: clockOf(ev.start) }) : '') })))
    .concat(sens.map(x => ({ _hid: SHIDE.has(sensKey(x)), id: 's' + x.key, k: '', start: x.a, src: x.kind === 'ha' ? 'Home Assistant' : x.name || '', x, tags: [sensIcon(x.kind) + ' ' + sensLabel(x)], dur: Math.max(0, (x.b - x.a) / 1000), pk: x.peak, nt: x.note ? '📝 ' + x.note : '' })));
  const win = LEV.vis ? levWin() : null;
  if (win) {                                          // nur was im sichtbaren Bereich liegt (auch teilweise)
    const inWin = d => { const a = d.start, b = a + (d.dur || 0) * 1000; return b >= win[0] && a <= win[1]; };
    { const k = rows.filter(inWin); rows.length = 0; rows.push(...k); }
  }
  const sf = STATS.filt.live; if (sf) { const k = rows.filter(d => statMatch(sf, d, 'live')); rows.length = 0; rows.push(...k); }
  if (levGrp()) {                                     // ab 1.85.20: wie in Protokolle zusammenfassen (ab 1.85.22 eigener Umschalter „Ereignisse | Alle einzeln“) (Notiz + Störungen + Sensoren eines Ereignisses = eine Zeile)
    for (const d of rows) { d._t = d.r ? 'ev' : d.fn ? 'note' : 'sens'; if (d.fn) d.n = d.fn; }
    const cl = evVisible(evCluster(rows, j)); rows.length = 0; rows.push(...cl);
    for (const g of rows) if (g._t === 'grp') { g.k = ''; g.nt = g._children.map(c => c.nt).filter(Boolean).join(' · '); }
  } else { const k = rows.filter(d => !d._hid); rows.length = 0; rows.push(...k); }   // „Alle einzeln“: Filter wie bisher
  levTitleSet();
  const rs = $('ldevrng'); if (rs && rs.value !== LEV.rng) rs.value = LEV.rng;
  const cw = $('ldevcus'); if (cw) cw.hidden = LEV.rng !== 'custom';
  const sig = rows.map(d => d.id + (d._t === 'grp' ? ':' + d._children.length + ':' + Math.round(d.dur) : '')).join(',') + '|' + (LEV.fa) + '|' + rows.length + '|' + JSON.stringify(sf) + '|' + MF.show;   // ab 1.85.46: gewachsenes Ereignis zählt als Änderung
  if (win && sig === LEV.sig && LTBL) return;          // nichts Neues im Bereich: Tabelle nicht neu aufbauen
  LEV.sig = sig;
  LEV.tot = win ? rows.length : (j.total != null ? j.total : evs.length) + sens.length; LEV.loaded = rows.length;
  for (const d of rows) if (d.fn && d.fev) { const e = rows.find(x => x.k && x.k === d.fev.k); if (e) e.nt = [e.nt, '📝 ' + fnAsgTxt(d.fdms) + ': ' + (d.fn.text || (d.fn.tags || []).map(x => ntLabel(x)).join(', '))].filter(Boolean).join(' · '); }   // Notiz auch an der Störung
  const vals = f => () => [...new Set(rows.flatMap(function v(d) { return (f === 'tags' ? d.tags : [d[f]]).concat((d._children || []).flatMap(v)); }).filter(Boolean))].sort((p, q) => String(p).localeCompare(String(q)));   // ab 1.85.46: auch die Werte der Einträge in einem Ereignis (Gerät, Art)
  const ms = f => ({ flt: 'ms', vals: vals(f), fpass: (v, d) => f === 'tags' ? d.tags.some(x => v.includes(x)) : v.includes(d[f]) });
  const num = () => ({ flt: 'num' });
  const hm = ms_ => { const d = new Date(ms_), td = new Date(nowServer()); return (d.toDateString() === td.toDateString() ? '' : pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '. ') + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };
  const def = {
    tm: { f: 'start', title: levHead('tm'), sort: 'num', minW: 76, prio: 0, flt: 'txt', fpass: (v, d) => hm(d.start).includes(v), html: d => d._t === 'grp'
      ? `<button type="button" class="gtog" tabindex="-1" aria-expanded="${LEVOPEN.has(d.gid) ? 'true' : 'false'}" aria-label="${esc(t('g_grp'))}">${LEVOPEN.has(d.gid) ? '▾' : '▸'}</button><b title="${esc(grpN(d.g))}">${esc(clockOf(d.g.a).slice(0, 5))}–${esc(clockOf(d.g.b).slice(0, 5))}</b>${grpBadge(d)}<span class="sr">${esc(grpN(d.g))}</span>` : esc(hm(d.start)) },
    src: Object.assign({ f: 'src', title: levHead('src'), minW: 150, grow: 2, prio: 3, cls: 'srcc', html: d => d._t === 'grp' ? (q => `<span class="si">🗂</span><span class="sn" title="${esc(q.join(', '))}"><b>${esc(q.length > 1 ? q[0] + ' +' + (q.length - 1) : q[0] || '')}</b></span>`)([...new Set(d._children.map(c => c.src).filter(Boolean))]) : d.fn ? `<span class="si">📝</span><span class="sn"><b>${esc(d.src)}</b></span>` : d.r ? srcCell(d.r).replace(/^<td[^>]*>/, '').replace(/<\/td>$/, '') : `<span class="si">${d.x.kind === 'ha' ? '🏠' : '📱'}</span><span class="sn"><b>${esc(d.src)}</b></span>` }, ms('src')),
    art: Object.assign({ f: 'tags', title: levHead('art'), minW: 120, grow: 2, sort: false, prio: 1, html: d => d.fn ? `<span class="art fnc">📝 ${esc(t('fn_row'))}</span>${d.fev ? `<span class="art fnlk">🔗 ${esc(t('fn_link', { c: clockOf(d.fev.start) }))}</span>` : ''}` : d.r ? `${d.r.prof ? `<span class="art prof${d.r.bg ? ' bgp' : ''}">🧩 ${esc(d.r.prof)}${d.r.prof_ok ? ' ✓' : d.r.prof_c != null ? ` <small>${d.r.prof_c} %</small>` : ''}</span>` : ''}${(d.r.labels || []).map(n => `<span class="art lbl">🏷 ${esc(n)}</span>`).join('')}${mfChip(d.r)}${d.r.art && !(d.r.prof && d.r.art === 'other' && !d.r.art_man) ? artChip(d.r.art, d.r.art_c, d.r.art_man || d.r.art_ok, d.r.k, d.r.art_lern != null ? d.r.art_lki : null) : ''}` : `<span class="art sensc">${sensIcon(d.x.kind)} ${esc(sensLabel(d.x))}</span>${d.x.kind === 'ha' ? `<button type="button" class="chip sned snote" tabindex="-1" aria-label="${esc(t('ha_note'))}" title="${esc(t('ha_note'))}">📝${d.x.note ? ' ' + esc(d.x.note.slice(0, 40)) : ''}</button>` : ''}` }, ms('tags')),
    sc: { f: 'sc', title: levHead('sc'), minW: 130, sort: false, prio: 3, flt: 'ms', aria: t('sc_col_a'), vals: () => SC_ST.map(scLabel), fpass: (v, d) => v.includes(scLabel(d.r ? (d.r.sc || {}).s || '' : '')), html: d => d.r ? scChip(d.r.sc) : '' },
    kinds: { f: 'kinds', title: levHead('kinds'), minW: 140, sort: false, prio: 4, html: d => d.r ? kindsHTML(d.r.kinds, j.fine) : '' },
    devs: { f: 'devs', title: levHead('devs'), minW: 120, sort: false, prio: 6, html: d => d.r && (d.r.devs || []).length > 1 ? d.r.devs.map((x, i) => `<span class="dvp${i === 0 ? ' top' : ''}">${esc(shortName(x[1]))} ${x[2] != null ? x[2].toFixed(0) : '–'}</span>`).join('') : '<span class="noclip">–</span>' },
    dur: Object.assign({ f: 'dur', title: levHead('dur'), sort: 'num', minW: 80, prio: 2, html: d => d.fn && !d.dur ? '–' : esc(fmtDur(d.dur)) }, num()),
    pk: Object.assign({ f: 'pk', title: levHead('pk'), sort: 'num', minW: 100, prio: 5, cls: 'pk', html: d => d.pk == null ? '' : esc(d.r ? fdb(d.pk) : f2(d.pk)) + ' <small>' + esc(d.r ? 'dBFS' : (d.x.unit || '')) + '</small>' }, num()),
    thr: Object.assign({ f: 'thr', title: levHead('thr'), sort: 'num', minW: 100, prio: 7, html: d => d.r ? esc(fdb(d.thr)) : '' }, num()),
    bg: Object.assign({ f: 'bg', title: levHead('bg'), sort: 'num', minW: 100, prio: 7, html: d => d.r ? esc(fdb(d.bg)) : '' }, num()),
    nt: { f: 'nt', title: '📝', minW: 140, grow: 2, prio: 4, flt: 'txt', one: true, cls: 'g1', html: d => d.nt ? `<span class="g1t" title="${esc(d.nt)}">${esc(d.nt)}</span>` : '' },   // eine Zeile, ganzer Text im Hinweis und für Screenreader
  };
  for (const k of Object.keys(def)) { if (k === 'tm' || k === 'src' || k === 'nt') continue; const h0 = def[k].html;   // zusammengefasste Zeile: Werte für das Ganze
    def[k].html = d => { if (d._t !== 'grp') return h0(d);
      const uniq = l => [...new Set(l.filter(Boolean))].join('');
      if (k === 'art') return pillMerge(d._children.map(h0));
      if (k === 'kinds') return pillMerge(d._children.filter(c => c.r).map(h0));
      if (k === 'sc') { const ev = d._children.filter(c => c.r && c.r.sc), rk = x => ['own', 'ok', 'no', 'nb'].indexOf((x.r.sc || {}).s); ev.sort((a, b) => (rk(a) < 0 ? 9 : rk(a)) - (rk(b) < 0 ? 9 : rk(b))); return ev.length ? h0(ev[0]) : ''; }   // bestes Ergebnis der Gruppe
      if (k === 'dur') return esc(fmtSpan(d.dur));
      if (k === 'pk') return d.pk == null ? '<span class="noclip">–</span>' : esc(fdb(d.pk)) + ' <small>dBFS</small>';
      if (k === 'thr' || k === 'bg') { const v = d._children.filter(c => c.r && c[k] != null).map(c => c[k]); return v.length ? esc(fdb(k === 'thr' ? Math.min(...v) : Math.max(...v))) : '<span class="noclip">–</span>'; }   // ab 1.85.46: Gruppe – niedrigste Schwelle, höchster Hintergrund
      return '<span class="noclip">–</span>'; }; }
  // ab 1.85.46: Felder, die es für diese Zeile nicht gibt (Sensor-Ereignis oder Notiz ohne Pegel, Schwelle, Sensor-Prüfung): „–“ statt leer
  for (const k of ['sc', 'kinds', 'pk', 'thr', 'bg', 'devs']) { const h1 = def[k].html; def[k].html = d => { const h = h1(d); return h === '' || h == null ? '<span class="noclip">–</span>' : h; }; }
  def.nt.aria = t('col_text'); def.nt.menu = '📝 ' + t('fn_row'); def.tm.cls = 'tm'; def.tm.minW = levGrp() ? 132 : LEV.rng === 'today' || LEV.vis ? 84 : 128; def.sc.minW = 165;
  const hasSc = evs.some(r => r.sc && r.sc.s);
  // ab 1.84.0: alle passenden Spalten an die Tabelle; an/aus, Reihenfolge und Dichte über „Spalten ▾“ (gemerkt in layout.json). Ältere Auswahl (laerm_lev) gilt als Vorgabe.
  const cols = LEV_COLS.filter(c => (useArt || (c !== 'art' && c !== 'kinds')) && (c !== 'devs' || multi) && (c !== 'sc' || hasSc)).map(c => Object.assign({}, def[c]));
  const hide0 = LEV_COLS.filter(c => !LEV.cols.includes(c)).map(c => def[c].f);
  if (typeof agGrid === 'undefined') return;
  const key = JSON.stringify([lang, useArt, multi, hasSc]);
  const ph = t(LEV.vis ? 'lev_none' : 'lev_none_rng');
  if (!LTBL || LTBL_KEY !== key) {
    if (LTBL) { LTBL.destroy(); LTBL = null; }
    LTBL_KEY = key;
    LTBL = glGrid(box, { cols, rows, max: '60vh', ph, wkey: 'live_ev', hide0, colBtn: $('ldevcfg'), sort: [{ colId: 'start', sort: 'desc' }], label: levTitle(), rowCls: d => d._t === 'grp' ? ['gclk', 'grph'] : ['gclk'], isOpen: p => LEVOPEN.has(p.gid || ''), kid: kidCell,
      onModel: G => levCount(G.shown(), G.nFilters()),
      onRow: (e, d) => {                               // Klick: der Graph springt zur Stelle (1.84.3); öffnen/bearbeiten mit Doppelklick oder der Taste in der Zeile
        const on = s_ => e.target && e.target.closest && e.target.closest(s_);
        if (d._t === 'grp') { LEVOPEN.has(d.gid) ? LEVOPEN.delete(d.gid) : LEVOPEN.add(d.gid); LTBL.redraw(x => x === d); LTBL.refilter(); grpShow(d, true); return; }   // Klick: auf-/zuklappen und ganzen Zeitraum zeigen
        if (d.fn && d.fev && on('.fnlk')) { openEvent(d.fev.k || ''); return; }
        if (d.x && d.x.kind === 'ha' && on('.snote')) { levOpen(d); return; }
        const a = d.fn ? d.fn.a : d.x ? d.x.a : d.start, b = d.fn ? Math.max(d.fn.b || d.fn.a, d.fn.a + 1000) : d.x ? d.x.b : d.start + Math.max(1000, (+(d.r && d.r.dauer_s) || 1) * 1000);
        if (d.k) slSel(d.k, d.r && d.r.start);
        liveJump(a, b, d.fn ? t('fn_row') : d.x ? sensLabel(d.x) : (d.src || ''));
      },
      onDbl: (e, d) => { if (!(e.target && e.target.closest && e.target.closest('input,button,a'))) { if (d._t === 'grp') grpOpen(d); else levOpen(d); } } });
  } else { LTBL.setPh(ph); LTBL.setRows(rows); }
  levCount(LTBL.shown(), LTBL.nFilters());
}
/* Anzahl über der Tabelle: zählt genau, was die Tabelle zeigt (mit Spaltenfiltern), dazu „Filter löschen“ */
function levCount(shown, nf) {
  const box = $('ldevn'); if (!box) return;
  const tot = LEV.tot != null ? LEV.tot : shown;
  box.textContent = (nf ? t('lev_n_filt', { n: shown, t: tot }) : tot > shown ? t('lev_n_of', { n: shown, t: tot }) : t('lev_n', { n: shown })) + (LEV.data && !MF.show ? mfCountTxt(LEV.data.events) : '');
  if (nf) { const b = el('button', { type: 'button', className: 'chip ldevclr', textContent: '✕ ' + t('lev_clr') }); b.onclick = () => { if (LTBL) LTBL.clearFilters(); }; box.append(' ', b); }
}
function levCols() {
  const box = $('ldevcols');
  box.innerHTML = LEV_COLS.map(c => `<label class="chip"><input type="checkbox" data-c="${c}"${LEV.cols.includes(c) ? ' checked' : ''}> ${esc(levHead(c))}</label>`).join('');
  box.querySelectorAll('input').forEach(i => i.onchange = () => { LEV.cols = LEV_COLS.filter(c => box.querySelector(`input[data-c="${c}"]`).checked); levSave(); levRender(); });
}
function initLev() {
  if (!$('ldev')) return;
  $('ldevsrc').value = LEV.src;
  $('ldevsrc').onchange = () => { LEV.src = $('ldevsrc').value; levSave(); levLoad(true); };
  $('ldevcfg').onclick = e => { e.stopPropagation(); if (LTBL) LTBL.colMenu($('ldevcfg')); };   // ab 1.84.0 kompaktes Menü „Spalten ▾“ statt der Kästchen-Reihe (levCols bleibt nur als Rückfall ohne Tabelle)
  { const gb = $('ldevgrp'); if (gb) { const sync = () => gb.querySelectorAll('button').forEach(b => { const on = (b.dataset.v === 'grp') === levGrp(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      gb.querySelectorAll('button').forEach(b => b.onclick = () => { try { localStorage.setItem('gl_lev_grp', b.dataset.v); } catch (e) { } sync(); LEV.sig = ''; levRender(); }); sync(); } }
  const rs = $('ldevrng'); rs.innerHTML = LEV_RNG.map(k => `<option value="${k}">${esc(t('lev_r_' + k))}</option>`).join(''); rs.value = LEV.rng;
  const cf = $('ldevcf'), ct = $('ldevct'); cf.value = LEV.cf || dtl(new Date(new Date(nowServer()).setHours(0, 0, 0, 0))).slice(0, 16); ct.value = LEV.ct || dtl(new Date(nowServer())).slice(0, 16);
  $('ldevcus').hidden = LEV.rng !== 'custom';
  rs.onchange = () => { LEV.rng = rs.value; if (LEV.rng === 'custom') { LEV.cf = cf.value; LEV.ct = ct.value; } $('ldevcus').hidden = LEV.rng !== 'custom'; LTBL_KEY = ''; levSave(); levLoad(true); };
  const cus = () => { LEV.cf = cf.value; LEV.ct = ct.value; levSave(); levLoad(true); }; cf.onchange = cus; ct.onchange = cus;
  setInterval(levTick, 1000);
  setInterval(() => { if (!document.hidden && !NV.open) statRefresh('live'); }, 60000);
}
/* ================= Kacheln (eigene Statistiken): Vorlagen (frei) und selbst eingestellte (Pro), je ein Panel im Dashboard – nur lesen =================
   Darstellung: große Zahl, Trend (Linie), Balken, Liste (die häufigsten), Tabelle (AG Grid). Jede Kachel ist auch ein Sensor in Home Assistant. */
const STATS = { list: [], pro: false, tpls: [], sens: [], profiles: [], filt: { live: null, prot: null }, req: {} };
async function statLoad() {
  try { const j = await (await fetch('stats', { cache: 'no-store' })).json(); if (j.ok) Object.assign(STATS, { list: j.list || [], pro: !!j.pro, tpls: j.tpls || [], sens: j.sens || [], profiles: j.profiles || [] }); } catch (e) { }
  statSync();
}
function statSync() {                                  // je Statistik ein Panel (anlegen, umbenennen, entfernen)
  for (const v of ['live', 'prot']) {
    if (!DASH.grids[v]) continue;
    const want = STATS.list.filter(d => d.view === v);
    for (const d of want) {
      const pid = 'st_' + d.id, p = (DASH.def[v] || []).find(x => x.id === pid);
      if (!p) { const node = el('div', { className: 'statcard' }); node.dataset.sid = d.id; dashAddPanel(v, { id: pid, title: d.name || t('st_unnamed'), nodes: [node], w: d.show === 'num' || d.show === 'list' ? 4 : 6, stat: true }); }
      else dashTitle(v, pid, d.name || t('st_unnamed'));
    }
    for (const p of [...(DASH.def[v] || [])]) if (p.stat && !want.some(d => 'st_' + d.id === p.id)) dashRemovePanel(v, p.id);
    if (STATS.filt[v] && !want.some(d => d.id === STATS.filt[v].sid)) statSetFilt(v, null);
  }
  statRefresh();
}
function statRange(d) {
  const now = nowServer();
  if (d.range === 'today') return [parseDay(isoDay(new Date(now))).getTime(), now + 1000];
  if (d.range === 'custom') { if (d.from_d && d.to_d) { const a = parseDay(d.from_d < d.to_d ? d.from_d : d.to_d), b = parseDay(d.from_d < d.to_d ? d.to_d : d.from_d); b.setDate(b.getDate() + 1); return [a.getTime(), b.getTime()]; } return [now - 7 * 86400000, now + 1000]; }
  if (d.range !== 'sel') return [now - (+d.range) * 86400000, now + 1000];
  if (d.view === 'prot' && NV.date) {                  // Tag in Protokolle schon gewählt (beim Laden der Seite noch nicht)
    const r = perRange(); if (r) return [new Date(r[0]).getTime(), new Date(r[1]).getTime()];
    const nd = NV.data; if (nd && nd.start) return [new Date(nd.start).getTime(), new Date(nd.end).getTime()];
  }
  return [parseDay(isoDay(new Date(now))).getTime(), now + 1000];       // Live: heute
}
function statRefresh(view) { for (const d of STATS.list) if (!view || d.view === view) statDraw(d); }
const weekKey = ms => { const x = new Date(ms); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return isoDay(x); };
function statLabel(d, k) {
  const loc = lang === 'en' ? 'en-GB' : 'de-DE', dd = s_ => { const [y, m, dd_] = s_.split('-'); return dd_ + '.' + m + '.'; };
  switch (d.by) {
    case 'hour': return pad(+k);
    case 'wd': return new Date(2024, 0, 1 + +k).toLocaleDateString(loc, { weekday: 'short' });
    case 'day': return dd(k);
    case 'week': return t('st_wk', { d: dd(k) });
    case 'month': { const [y, m] = k.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString(loc, { month: 'short', year: '2-digit' }); }
    case 'art': if (d.src === 'sens') return sensIcon(k) + ' ' + k; return k.startsWith('p:') ? '🧩 ' + k.slice(2) : (ART_ICON[k] || '') + ' ' + artName(k);
    case 'dev': return k === 'all' ? t('all_sources') : k === 'ha' ? 'Home Assistant' : viewName(k);
    case 'tag': return k === '-' ? t('st_notag') : ntLabel(k);
    case 'none': return '';
    default: return k;
  }
}
function statDur(v) { if (v == null) return '–'; if (v < 120) return numTxt(v.toFixed(v < 10 ? 1 : 0)) + ' s'; if (v < 7200) return numTxt((v / 60).toFixed(1)) + ' min'; return numTxt((v / 3600).toFixed(1)) + ' h'; }
function statFmt(d, v, unit) { if (v == null) return '–'; if (d.metric === 'n') return String(v); if (d.metric === 'dur') return statDur(v); return (d.src === 'ev' ? fdb(v) : f2(v)) + (unit ? ' ' + unit : ''); }
function statRangeText(d) {
  if (d.range === 'sel') return t(d.view === 'prot' ? 'st_r_sel' : 'st_r_today');
  if (d.range === 'today') return t('st_r_today');
  if (d.range === 'custom') { const dd = x => x ? x.slice(8, 10) + '.' + x.slice(5, 7) + '.' + x.slice(2, 4) : '…'; return d.from_d && d.to_d ? dd(d.from_d) + ' – ' + dd(d.to_d) : t('st_r_custom'); }
  return t(d.range === '1' ? 'st_r_24h' : 'st_r_days', { n: d.range });
}
async function statDraw(d) {
  const box = document.querySelector(`.statcard[data-sid="${CSS.escape(d.id)}"]`); if (!box) return;
  if (d.view === 'prot' && !NV.open && box.dataset.drawn) return;           // Reiter nicht sichtbar: später
  const [a, b] = statRange(d), id = (STATS.req[d.id] || 0) + 1; STATS.req[d.id] = id;
  const sk = JSON.stringify([d, Math.round(a / 60000), Math.round(b / 60000), MF.show]), fresh = box.dataset.sk !== sk;   // anderer Zeitraum: Ladehinweis
  if (fresh) busy(box, true);
  try { await statDraw1(d, box, a, b, id, sk); } finally { if (fresh) busy(box, false); }
}
async function statDraw1(d, box, a, b, id, sk) {
  let j = null; try { j = await (await fetch('stat_data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ def: Object.assign({}, d, { mf_show: MF.show }), from: Math.round(a), to: Math.round(b) }) })).json(); } catch (e) { }
  if (STATS.req[d.id] !== id) return;
  box.dataset.drawn = '1'; box.dataset.sk = sk;
  statFill(box, d, j, d.view);
}
function statFill(box, d, j, view) {                   // Kachel zeichnen (auch Vorschau im Dialog); Tabelle mit AG Grid
  const old = box.querySelector('.sttabg'); if (old && old._G) old._G.destroy();
  box.innerHTML = statHtml(d, j, view);
  const tb = box.querySelector('.sttabg');
  if (tb && j && j.ok && typeof agGrid !== 'undefined') {
    const f = view && STATS.filt[view] && STATS.filt[view].sid === d.id ? STATS.filt[view] : null, lab = k => statLabel(d, k);
    const rows = j.keys.map((k, i) => ({ id: i, k, l: lab(k), n: j.vals[i], vt: statFmt(d, j.vals[i], j.unit) }));
    const mk = { n: 'st_m_n', dur: 'st_m_dur', pk_avg: 'st_m_pkavg', pk_max: 'st_m_pkmax' }[d.metric] || 'st_m_n';
    glGrid(tb, { cols: [{ f: 'l', title: d.by === 'none' ? t('st_total') : t('st_by_' + d.by), flt: 'txt', minW: 120, grow: 2 },
      { f: 'n', title: t(mk), sort: (a, b) => (a.n == null ? -1e12 : a.n) - (b.n == null ? -1e12 : b.n), html: r => esc(r.vt), minW: 90 }],
      rows, max: '40vh', ph: t('st_none'), label: d.name || t('st_unnamed'), wkey: d.id ? 'tile_' + d.id : '',
      sort: ['art', 'dev', 'tag', 'sens'].includes(d.by) ? [{ colId: 'n', sort: 'desc' }] : [],
      rowCls: r => (f && f.k === r.k ? ['sel'] : []).concat(view ? ['gclk'] : []),
      onRow: view ? (e, r) => { const ff = STATS.filt[d.view]; statSetFilt(d.view, ff && ff.sid === d.id && ff.k === r.k ? null : { sid: d.id, src: d.src, by: d.by, k: r.k }); } : null });
  }
  if (view) statBind(box, d);
}
function statHtml(d, j, view) {
  const f = view && STATS.filt[view] && STATS.filt[view].sid === d.id ? STATS.filt[view] : null;
  const head = `<div class="sthd"><small class="mut">${esc(statRangeText(d))}${j && j.ok ? ' · ' + esc(t('st_n', { n: j.n })) : ''}</small>${f ? `<button type="button" class="chip on stfx" title="${esc(t('st_flt_off'))}">⏚ ${esc(statLabel(d, f.k))} ✕</button>` : ''}<span class="sthsp"></span>${view ? `<button type="button" class="chip stedit" title="${esc(t('st_edit'))}">⚙</button>` : ''}</div>`;
  if (!j || !j.ok) return head + `<p class="mut">${esc(t('st_err'))}</p>`;
  if (!j.n && d.show !== 'num') return head + `<p class="mut stnone">${esc(t('st_none'))}</p>`;
  const vals = j.vals.map(v => v == null ? 0 : v), mx = Math.max(1e-9, ...vals.map(Math.abs)), lab = k => statLabel(d, k);
  const pkScale = d.metric.startsWith('pk') && d.src === 'ev';          // dBFS: negativ, Balken relativ zwischen kleinstem und größtem Wert
  const lo = pkScale ? Math.min(...vals.filter((v, i) => j.vals[i] != null)) - 3 : 0, hi = pkScale ? Math.max(...vals) : mx;
  const pct = v => v == null ? 0 : Math.max(2, Math.round(100 * (pkScale ? (v - lo) / Math.max(1e-9, hi - lo) : Math.abs(v) / mx)));
  const cat = ['art', 'dev', 'tag', 'sens'].includes(d.by);
  const mlab = t({ n: 'st_m_n', dur: 'st_m_dur', pk_avg: 'st_m_pkavg', pk_max: 'st_m_pkmax' }[d.metric] || 'st_m_n');
  if (d.show === 'list') {
    const L = j.keys.map((k, i) => [k, j.vals[i]]).filter(x => x[1]); if (!cat) L.sort((a, b) => b[1] - a[1]);
    return head + `<ol class="stlist">${L.slice(0, d.top || 5).map(([k, v]) => `<li data-k="${esc(k)}" class="${f && f.k === k ? 'on' : ''}"><span class="sthl">${esc(lab(k))}</span><b>${esc(statFmt(d, v, j.unit))}</b></li>`).join('')}</ol>`;
  }
  if (d.show === 'table') return head + `<div class="sttabg"></div><small class="mut sttot1">${esc(t('st_total'))}: ${esc(statFmt(d, j.total, j.unit))}</small>`;
  if (d.show === 'num') return head + `<div class="stnum">${esc(statFmt(d, j.total, j.unit))}</div><div class="stnuml">${esc(mlab)}</div>` + (d.by !== 'none' && j.keys.length > 1 ? `<div class="stnumsub">${j.keys.slice(0, 4).map((k, i) => `<span>${esc(lab(k))}: <b>${esc(statFmt(d, j.vals[i], j.unit))}</b></span>`).join('')}</div>` : '');
  if (d.show === 'table') return head + `<table class="sttab"><tbody>${j.keys.map((k, i) => `<tr data-k="${esc(k)}" class="${f && f.k === k ? 'on' : ''}"><td>${esc(lab(k))}</td><td>${esc(statFmt(d, j.vals[i], j.unit))}</td></tr>`).join('')}<tr class="sttot"><td>${esc(t('st_total'))}</td><td>${esc(statFmt(d, j.total, j.unit))}</td></tr></tbody></table>`;
  if (d.show === 'line' && !cat && j.keys.length > 1) {
    const n = j.keys.length, W = 600, H = 120, X = i => Math.round(i * (W - 10) / (n - 1)) + 5, Y = v => H - 8 - Math.round((H - 20) * pct(v) / 100);
    const pts = j.vals.map((v, i) => X(i) + ',' + Y(v)).join(' '), step = Math.ceil(n / 8);
    return head + `<svg class="stline" viewBox="0 0 ${W} ${H + 18}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="var(--acc)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>${j.vals.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="var(--acc)"><title>${esc(lab(j.keys[i]) + ': ' + statFmt(d, j.vals[i], j.unit))}</title></circle>`).join('')}${j.keys.map((k, i) => i % step ? '' : `<text x="${X(i)}" y="${H + 14}" font-size="11" fill="var(--mut)" text-anchor="middle">${esc(lab(k))}</text>`).join('')}</svg>`;
  }
  if (cat) return head + `<div class="sthb">${j.keys.slice(0, 20).map((k, i) => `<div class="sth${f && f.k === k ? ' on' : ''}" data-k="${esc(k)}" title="${esc(lab(k) + ': ' + statFmt(d, j.vals[i], j.unit))}"><span class="sthl">${esc(lab(k))}</span><span class="sthbar"><i style="width:${pct(j.vals[i])}%"></i></span><b>${esc(statFmt(d, j.vals[i], j.unit))}</b></div>`).join('')}</div>`;
  const step = Math.ceil(j.keys.length / 12);
  return head + `<div class="stbars">${j.keys.map((k, i) => `<div class="stb${f && f.k === k ? ' on' : ''}" data-k="${esc(k)}" title="${esc(lab(k) + ': ' + statFmt(d, j.vals[i], j.unit))}"><em>${j.vals[i] ? esc(statFmt(d, j.vals[i], j.unit)) : ''}</em><i style="height:${j.vals[i] ? pct(j.vals[i]) : 0}%"></i><small>${i % step ? '' : esc(lab(k))}</small></div>`).join('')}</div>`;
}
function statBind(box, d) {
  const ed = box.querySelector('.stedit'); if (ed) ed.onclick = () => statEdit(d);
  const fx = box.querySelector('.stfx'); if (fx) fx.onclick = () => statSetFilt(d.view, null);
  box.querySelectorAll('[data-k]').forEach(x => { x.onclick = () => { const f = STATS.filt[d.view]; statSetFilt(d.view, f && f.sid === d.id && f.k === x.dataset.k ? null : { sid: d.id, src: d.src, by: d.by, k: x.dataset.k }); };
    x.tabIndex = 0; x.setAttribute('role', 'button'); x.setAttribute('aria-pressed', x.classList.contains('on') ? 'true' : 'false');      // Tastatur: Eingabe/Leertaste filtert wie ein Klick
    if (!x.getAttribute('aria-label')) x.setAttribute('aria-label', x.getAttribute('title') || x.textContent.trim());
    x.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); x.click(); } }; });
}
function statSetFilt(v, f) {                           // Klick auf einen Balken: Ereignis-Tabelle darauf filtern (nochmal klicken = aus)
  const old = STATS.filt[v]; STATS.filt[v] = f;
  for (const d of STATS.list) if (d.view === v && ((old && old.sid === d.id) || (f && f.sid === d.id))) statDraw(d);
  if (v === 'prot') tblFilter(); else { LEV.sig = ''; levRender(); }
}
function statInfo(d, view) {                           // Zeile einer Ereignis-Tabelle -> {kind, ts, art, dev, tags, sens}
  if (view === 'prot') {
    if (d._t === 'ev') return { kind: 'ev', ts: d.start, art: d.r.prof ? 'p:' + d.r.prof : (d.r.art || '?'), dev: d.r.quelle_id || 'main' };
    if (d._t === 'note') return { kind: 'note', ts: d.start, tags: (d.n && d.n.tags) || [], dev: (d.n && d.n.src) || 'all' };
    if (d._t === 'sens') return { kind: 'sens', ts: d.start, art: d.x.kind, sens: d.x.name, dev: d.x.src };
    return null;
  }
  if (d.r) return { kind: 'ev', ts: d.start, art: d.r.prof ? 'p:' + d.r.prof : (d.r.art || '?'), dev: d.r.quelle_id || 'main' };
  if (d.fn) return { kind: 'note', ts: d.start, tags: d.fn.tags || [], dev: d.fn.src || 'all' };
  if (d.x) return { kind: 'sens', ts: d.start, art: d.x.kind, sens: d.x.name, dev: d.x.src };
  return null;
}
function statMatch(f, d, view) {
  if (d._children && d._t === 'grp') return d._children.some(c => statMatch(f, c, view));
  const x = statInfo(d, view); if (!x || x.kind !== f.src) return false;
  const dt_ = new Date(x.ts), k = f.k;
  switch (f.by) {
    case 'hour': return dt_.getHours() === +k;
    case 'wd': return (dt_.getDay() + 6) % 7 === +k;
    case 'day': return isoDay(dt_) === k;
    case 'week': return weekKey(x.ts) === k;
    case 'month': return isoDay(dt_).slice(0, 7) === k;
    case 'art': return x.art === k;
    case 'dev': return x.dev === k;
    case 'tag': return k === '-' ? !(x.tags || []).length : (x.tags || []).includes(k);
    case 'sens': return (x.sens || x.art) === k;
    default: return true;
  }
}
/* ---- Anlegen und Einstellen ---- */
function statNew(v, show) {
  const tt = TILE_TYPES.find(x => x[0] === show);
  statEdit(tt ? { view: v, src: 'ev', metric: 'n', by: tt[2], show: tt[0], range: tt[3], name: '' } : { view: v, src: 'ev', metric: 'n', by: v === 'live' ? 'hour' : 'day', show: 'bar', range: 'sel', name: '' }, true);
}
function statEdit(d0, isNew) {
  let dlg = document.getElementById('stdlg');
  if (!dlg) { dlg = el('dialog', { id: 'stdlg', className: 'stdlg' }); document.body.appendChild(dlg); }
  const d = Object.assign({ art: '', sens: '', tag: '', dev: '', night: false, quiet: false, wkend: false, from_d: '', to_d: '', min_pk: null, min_dur: null, top: 5 }, d0), pro = STATS.pro;
  const opt = (k, list) => `<select data-f="${k}">${list.map(([v, l]) => `<option value="${esc(v)}"${String(d[k]) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const arts = [['', t('st_any')]].concat(ART_ORDER.map(a => [a, (ART_ICON[a] || '') + ' ' + artName(a)]), STATS.profiles.map(p => ['p:' + p, '🧩 ' + p]));
  const tags = [['', t('st_any')]].concat(ntList(new Set()).map(k => [k, ntLabel(k)]));
  const devs = [['', t('all_sources')]].concat(SOURCES.map(x => [x.id, x.name]));
  const tpls = STATS.tpls.slice().sort((a, b) => ((a.show === d.show ? 0 : 2) + (a.view === d.view ? 0 : 1)) - ((b.show === d.show ? 0 : 2) + (b.view === d.view ? 0 : 1)));   // passende Art zuerst
  dlg.innerHTML = `<div class="sthead"><h3>📊 ${esc(t(isNew ? 'st_new' : 'st_edit'))}</h3><button type="button" class="chip stx">✕</button></div>
    ${isNew ? `<p class="mut">${esc(t('st_tpl_h'))}</p><div class="sttpl">${tpls.map(x => `<button type="button" class="chip" data-tpl="${esc(x.tpl)}">${esc(x.name[lang === 'en' ? 1 : 0])}</button>`).join('')}</div><hr>` : ''}
    <p class="mut">${esc(t(pro ? 'st_own_h' : 'st_own_pro'))}</p>
    <fieldset class="stform"${pro ? '' : ' disabled'}>
      <label>${esc(t('st_f_name'))}<input type="text" data-f="name" maxlength="60" value="${esc(d.name || '')}" placeholder="${esc(t('st_name_ph'))}"></label>
      <label>${esc(t('st_f_src'))}${opt('src', [['ev', t('st_src_ev')], ['sens', t('st_src_sens')], ['note', t('st_src_note')]])}</label>
      <label class="st-ev">${esc(t('st_f_art'))}${opt('art', arts)}</label>
      <label class="st-sens">${esc(t('st_f_sens'))}${opt('sens', [['', t('st_any')]].concat(STATS.sens.map(n => [n, n])))}</label>
      <label class="st-note">${esc(t('st_f_tag'))}${opt('tag', tags)}</label>
      <label>${esc(t('st_f_metric'))}${opt('metric', [['n', t('st_m_n')], ['dur', t('st_m_dur')], ['pk_avg', t('st_m_pkavg')], ['pk_max', t('st_m_pkmax')]])}</label>
      <label>${esc(t('st_f_by'))}${opt('by', [['none', t('st_by_none')], ['hour', t('st_by_hour')], ['wd', t('st_by_wd')], ['day', t('st_by_day')], ['week', t('st_by_week')], ['month', t('st_by_month')], ['art', t('st_by_art')], ['dev', t('st_by_dev')], ['tag', t('st_by_tag')], ['sens', t('st_by_sens')]])}</label>
      <label>${esc(t('st_f_show'))}${opt('show', [['num', t('st_s_num')], ['line', t('st_s_line')], ['bar', t('st_s_bar')], ['list', t('st_s_list')], ['table', t('st_s_table')]])}</label>
      <label class="st-list">${esc(t('st_f_top'))}<input type="number" data-f="top" min="3" max="20" step="1" value="${esc(d.top || 5)}"></label>
      <label>${esc(t('st_f_range'))}${opt('range', [['sel', t(d.view === 'prot' ? 'st_r_sel' : 'st_r_today')]].concat(d.view === 'prot' ? [['today', t('st_r_today')]] : [], [['1', t('st_r_24h')], ['7', t('st_r_days', { n: 7 })], ['30', t('st_r_days', { n: 30 })], ['90', t('st_r_days', { n: 90 })], ['365', t('st_r_days', { n: 365 })], ['custom', t('st_r_custom')]]))}</label>
      <label class="st-cus">${esc(t('st_f_from'))}<input type="date" data-f="from_d" value="${esc(d.from_d || '')}"></label>
      <label class="st-cus">${esc(t('st_f_to'))}<input type="date" data-f="to_d" value="${esc(d.to_d || '')}"></label>
      <label>${esc(t('st_f_dev'))}${opt('dev', devs)}</label>
      <label class="st-ev">${esc(t('st_f_minpk'))}<input type="number" data-f="min_pk" min="-120" max="20" step="1" value="${d.min_pk == null ? '' : esc(d.min_pk)}" placeholder="${esc(t('st_off_ph'))}"></label>
      <label>${esc(t('st_f_mindur'))}<input type="number" data-f="min_dur" min="0" step="1" value="${d.min_dur == null ? '' : esc(d.min_dur)}" placeholder="${esc(t('st_off_ph'))}"></label>
      <div class="stchk"><label><input type="checkbox" data-f="night"${d.night ? ' checked' : ''}> ${esc(t('st_night'))}</label><label><input type="checkbox" data-f="quiet"${d.quiet ? ' checked' : ''}> ${esc(t('st_quiet'))}</label><label><input type="checkbox" data-f="wkend"${d.wkend ? ' checked' : ''}> ${esc(t('st_wkend'))}</label></div>
    </fieldset>
    <p class="mut sthah">${esc(t('st_ha_h'))}</p>
    <div class="stprev"></div>
    <div class="stbtns">${!isNew ? `<button type="button" class="chip stdel">🗑 ${esc(t('st_del'))}</button>` : ''}<span class="sthsp"></span><span class="stmsg"></span><button type="button" class="chip stcancel">${esc(t('cancel'))}</button>${pro ? `<button type="button" class="pri stok">${esc(t(isNew ? 'st_create' : 'st_save'))}</button>` : ''}</div>`;
  const read = () => { const o = Object.assign({}, d); dlg.querySelectorAll('[data-f]').forEach(x => { o[x.dataset.f] = x.type === 'checkbox' ? x.checked : x.value; }); return o; };
  const vis = () => { const s_ = (dlg.querySelector('[data-f=src]') || {}).value || d.src; for (const k of ['ev', 'sens', 'note']) dlg.querySelectorAll('.st-' + k).forEach(x => x.style.display = s_ === k ? '' : 'none');
    const rg = (dlg.querySelector('[data-f=range]') || {}).value || d.range, sh = (dlg.querySelector('[data-f=show]') || {}).value || d.show;
    dlg.querySelectorAll('.st-cus').forEach(x => x.style.display = rg === 'custom' ? '' : 'none'); dlg.querySelectorAll('.st-list').forEach(x => x.style.display = sh === 'list' ? '' : 'none'); };
  let pt = 0;
  const prev = () => { clearTimeout(pt); pt = setTimeout(async () => { const o = read(), [a, b] = statRange(o), box = dlg.querySelector('.stprev'); let j = null;
    try { j = await (await fetch('stat_data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ def: o, from: Math.round(a), to: Math.round(b) }) })).json(); } catch (e) { }
    const pv = el('div'); box.innerHTML = `<small class="mut">${esc(t('st_preview'))}</small>`; box.appendChild(pv); statFill(pv, o, j, null); }, 250); };
  const msg = m => { dlg.querySelector('.stmsg').textContent = m; };
  const post = async body => { const j = await (await fetch('stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    if (!j.ok) { msg(t(j.error === 'pro' ? 'st_need_pro' : j.error === 'limit' ? 'st_limit' : 'saveerr')); return false; } STATS.list = j.list; dlg.close(); statSync(); return true; };
  dlg.querySelectorAll('[data-f]').forEach(x => { x.oninput = x.onchange = () => { vis(); prev(); }; });
  dlg.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => post({ action: 'add', tpl: b.dataset.tpl, view: d.view }));
  dlg.querySelector('.stx').onclick = dlg.querySelector('.stcancel').onclick = () => dlg.close();
  const ok = dlg.querySelector('.stok'); if (ok) ok.onclick = () => post(isNew ? { action: 'add', def: read() } : { action: 'edit', id: d.id, def: read() });
  const del = dlg.querySelector('.stdel'); if (del) del.onclick = () => { if (confirm(t('st_del_q', { n: d.name || t('st_unnamed') }))) post({ action: 'del', id: d.id }); };
  vis(); prev(); if (!dlg.open) dlg.showModal();
}
/* ================= Freie Notiz („📝 Notiz jetzt“): einmal gespeichert, mit Zeitraum, an allen Aufzeichnungen dieser Zeit sichtbar ================= */
const FN = { list: [], edit: null, tags: new Set(), t: 0, fv: {} };
const dtl = d => isoDay(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
async function fnOpenId(h) {                        // Notiz aus dem Verlauf öffnen (vollständig vom Server holen)
  try { const j = await (await fetch('fnotes?from=' + (h.a - 1000) + '&to=' + (h.b + 1000) + '&src=all', { cache: 'no-store' })).json(); const n = (j.notes || []).find(x => x.id === h.id); if (n) return fnOpen(n); } catch (e) { }
  toast(t('saveerr'));
}
/* Eintrag angeklickt (1.84.3): Graph, Spektrogramm und Sensor-Spuren springen zu diesem Zeitraum (mit Umfeld, markiert) */
function liveJump(a, b, name) {
  b = Math.max(b || a, a + 1000); const pad = Math.max(30000, (b - a) * 0.25);
  if (NV.open) { dtFocus(a, b); return; }
  LDT.mark = [a, b]; histEnter(a - pad, b + pad);
  const g = $('vp1'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast(t('sens_shown', { n: name || '', a: hms(a), b: hms(b) }) + ' · ' + t('dbl_open'));
}
function sensShow(x) { liveJump(x.a, x.b, sensLabel(x)); }
function levOpen(d) {                                  // Eintrag der Live-Tabelle öffnen (Doppelklick, Eingabe-Taste im Menü, 📝)
  if (d.fn) fnOpenId(d.fn); else if (d.k) openEvent(d.k);
  else if (d.x && d.x.kind === 'ha') haPop({ a: d.x.a, b: d.x.b, name: sensLabel(d.x), note: d.x.note || '', key: d.x.key });
  else if (d.x) sensShow(d.x);
}
function haPop(h) {                                  // Sensor aus Home Assistant angeklickt: Notiz zu diesem Zeitraum schreiben/ändern
  let d = $('hapop'); if (!d) { d = el('dialog', { id: 'hapop', className: 'evdlg prognd' }); document.body.appendChild(d); }
  const L = locale(), dur = Math.max(0, (h.b - h.a) / 1000), fdur = dur < 120 ? Math.round(dur) + ' s' : dur < 7200 ? Math.round(dur / 60) + ' min' : Math.floor(dur / 3600) + ' h ' + Math.round(dur % 3600 / 60) + ' min';
  d.innerHTML = `<h3>📡 ${esc(h.name)}</h3><p><b>${esc(new Date(h.a).toLocaleDateString(L))} · ${esc(hms(h.a))}–${esc(hms(h.b))}</b> · ${esc(fdur)} · ${esc(t('ha_on'))}</p>
    <label class="drl">${esc(t('ha_note'))}<textarea id="hanote" rows="2" maxlength="300" placeholder="${esc(t('ha_note_ph'))}"></textarea></label>
    <p class="mut">${esc(t('ha_pop_hint'))}</p>
    <div class="ntedbtns"><button type="button" class="hpg">📈 ${esc(t('sens_graph'))}</button><button type="button" class="hpl">${esc(t('ha_to_list'))}</button><span style="flex:1"></span>${h.note ? `<button type="button" class="danger hpd">${esc(t('run_note_del'))}</button>` : ''}<button type="button" class="hpx">${esc(t('cancel'))}</button><button type="button" class="pri hps">${esc(t('save'))}</button></div>`;
  const ta = d.querySelector('#hanote'); ta.value = h.note || '';
  const save = async txt => {
    try { const j = await (await fetch('ha_note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: h.key || h.rid + '|' + h.a, text: txt }) })).json(); if (!j.ok) throw new Error(j.error); }
    catch (e) { alert(t('saveerr') + ' ' + e.message); return; }
    d.close(); if (NV.open) loadNight(); dtLoad(DT, true); EVSIG = ''; loadEvents();
  };
  d.querySelector('.hps').onclick = () => save(ta.value.trim());
  if (d.querySelector('.hpd')) d.querySelector('.hpd').onclick = () => save('');
  d.querySelector('.hpx').onclick = () => d.close();
  d.querySelector('.hpg').onclick = () => { d.close(); sensShow({ a: h.a, b: h.b, name: h.name, kind: 'ha' }); };
  d.querySelector('.hpl').onclick = () => { d.close(); const row = document.querySelector(`.har[data-a="${h.a}"]`); if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1500); } };
  enterSave(ta, () => save(ta.value.trim()));
  d.showModal(); setTimeout(() => ta.focus(), 50);
}
/* Notizbereich abdocken (Pro): eigenes Fenster, das über anderen Programmen liegt (Chrome/Edge: „Bild-im-Bild“-Fenster, sonst ein kleines Zusatzfenster) */
async function fnPop() {
  if (!PRO.ok) { proGate('pop'); return; }
  if (FNPOP && !FNPOP.closed) { try { FNPOP.focus(); } catch (e) { } return; }
  const panel = $('fnpanel'); if (!panel) return;
  let w = null, pip = false;
  try { if (window.documentPictureInPicture) { w = await documentPictureInPicture.requestWindow({ width: 460, height: 360 }); pip = true; } } catch (e) { w = null; }
  if (!w) { try { w = window.open('', 'gl_note', 'popup=yes,width=480,height=380'); } catch (e) { w = null; } }
  if (!w) { alert(t('pop_fail')); return; }
  const doc = w.document;
  doc.title = 'GLighter – ' + t('fn_btn');
  const vp = doc.createElement('meta'); vp.name = 'viewport'; vp.content = 'width=device-width,initial-scale=1'; doc.head.appendChild(vp);
  for (const l of document.querySelectorAll('link[rel=stylesheet]')) { const n = doc.createElement('link'); n.rel = 'stylesheet'; n.href = l.href; doc.head.appendChild(n); }
  doc.documentElement.className = document.documentElement.className;
  for (const at of document.documentElement.attributes) if (at.name.startsWith('data-')) doc.documentElement.setAttribute(at.name, at.value);
  doc.body.className = 'fnpopbody';                    // Tipp-Art setzt qtModeApply(), Ansicht „abgedockt“ capApply()
  doc.documentElement.lang = document.documentElement.lang;
  if (FCL.on) fclClose();                              // „Layout anpassen“ gehört zur Ansicht, in der es geöffnet wurde
  const parent = panel.parentNode, next = panel.nextSibling;
  const ph = el('div', { className: 'card fnpph' }); const pb = el('button', { type: 'button', className: 'chip', textContent: t('pop_back') });
  ph.append(document.createTextNode('📝 ' + t('pop_open') + ' '), pb); parent.insertBefore(ph, panel);
  doc.body.appendChild(panel); panel.classList.add('inpop'); FNPOP = w; fcColApply(); qtModeApply(); capApply(); fnpTags();
  const back = () => { if (FNPOP !== w) return; if (FCL.on) fclClose(); FNPOP = null; ph.remove(); try { parent.insertBefore(panel, next && next.parentNode === parent ? next : null); } catch (e) { parent.appendChild(panel); } panel.classList.remove('inpop'); capApply(); fnpTags(); };
  pb.onclick = () => { try { w.close(); } catch (e) { } back(); };
  w.addEventListener('pagehide', back);
  let rz = 0; w.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (FNPOP === w) fnpTags(); }, 150); });   // Fenstergröße geändert: Tasten neu einteilen
  addEventListener('pagehide', () => { try { w.close(); } catch (e) { } });
  const tx = doc.getElementById('fnptext'); if (tx) setTimeout(() => tx.focus(), 100);
}
/* Notizfelder: Enter speichert, Alt+Enter (oder Umschalt+Enter) = neue Zeile */
function enterSave(ta, save) {
  ta.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing) return;
    if (e.altKey || e.shiftKey) { e.preventDefault(); const s = ta.selectionStart, en = ta.selectionEnd; ta.setRangeText('\n', s, en, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); return; }
    e.preventDefault(); save();
  });
}
/* Zuordnung Notiz → Störung (ab 1.83): aktuelle (automatisch / von Hand), weitere mögliche Störungen, neu zuordnen oder lösen.
   Die Wahl von Hand liegt in einer eigenen Datei; Notiz und ihre Zeiten bleiben unverändert. */
async function fnAsgBox(box, key, changed) {
  box.hidden = false; box.innerHTML = `<h4>${esc(t('fna_head'))}</h4><p class="mut">${esc(t('loading'))}</p>`;
  let j; try { j = await (await fetch('fnasg?id=' + encodeURIComponent(key), { cache: 'no-store' })).json(); } catch (e) { j = { ok: false }; }
  if (!j.ok) { box.innerHTML = `<h4>${esc(t('fna_head'))}</h4><p class="mut">${esc(t('fna_none_win', { a: '?', b: '?' }))}</p>`; return; }
  const evTx = e => [fmtWhen(e.start), e.src, e.dauer_s != null ? fmtDur(e.dauer_s) : '', e.art ? artName(e.art) : ''].filter(Boolean).join(' · ');
  const dTx = e => fnAsgD(e.d);
  const hm = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
  const meta = e => [e.art ? artName(e.art) : '', e.dauer_s != null ? fmtDur(e.dauer_s) : '', e.src].filter(Boolean).join(' · ');
  const line = e => `<span class="fnat">${esc(hm(e.start))}</span><span class="fnam">${esc(meta(e))}</span><span class="fnad">${esc(dTx(e))}</span>`;
  const btn = (a, l) => `<button type="button" class="chip" data-a="${a}">${esc(l)}</button>`;
  const how = j.man ? t('fn_asg_man') : t('fn_asg_auto', { a: j.pre, b: j.post });
  const cur = j.cur
    ? `<div class="fnacur" aria-label="${esc(t('fna_cur', { e: evTx(j.cur) }) + ', ' + dTx(j.cur) + ', ' + how)}">${line(j.cur)}<small class="fnah${j.man ? ' fnman' : ''}">🔗 ${esc(how)}</small></div>`
    : `<p class="fnanone">${esc(j.detached ? t('fna_detached') : t('fna_none_win', { a: j.pre, b: j.post }))}</p>`;
  const lid = 'fnacl_' + key.replace(/\W/g, ''), SHOW = 3, nC = j.cand.length;
  const row = (e, i) => `<li${i >= SHOW ? ' class="fnaxtra" hidden' : ''}><button type="button" class="fnarow" data-a="set" data-k="${esc(e.k)}" aria-label="${esc(t('fna_set') + ': ' + evTx(e) + ', ' + dTx(e))}">${line(e)}</button></li>`;
  const acts = (j.cur ? btn('detach', t('fna_detach')) : '') + (j.man ? btn('auto', t('fna_auto')) : '');
  box.innerHTML = `<h4>${esc(t('fna_head'))}</h4>${cur}${acts ? `<div class="fnac">${acts}</div>` : ''}`
    + (nC ? `<div class="fnacl" id="${esc(lid)}"><b>${esc(t('fna_more'))}</b> <small>(${nC}) · ${esc(t('fna_pick'))}</small></div><ul class="fnalist" aria-labelledby="${esc(lid)}">${j.cand.map(row).join('')}</ul>`
      + (nC > SHOW ? `<button type="button" class="chip fnamore" aria-expanded="false">${esc(t('fna_all', { n: nC }))}</button>` : '') : '')
    + `<small class="fnahint">${esc(t('fna_hint'))}</small><span class="sr" aria-live="polite"></span>`;
  const mb = box.querySelector('.fnamore');
  if (mb) mb.onclick = () => {
    const open = mb.getAttribute('aria-expanded') !== 'true';
    box.querySelectorAll('.fnaxtra').forEach(li => { li.hidden = !open; });
    mb.setAttribute('aria-expanded', String(open)); mb.textContent = open ? t('fna_less') : t('fna_all', { n: nC });
  };
  box.querySelectorAll('button[data-a]').forEach(b => b.onclick = async () => {
    let r; try { r = await (await fetch('fnasg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: key, action: b.dataset.a, k: b.dataset.k || '' }) })).json(); } catch (e) { r = { ok: false }; }
    if (!r.ok) { toast(t('saveerr')); return; }
    await fnAsgBox(box, key, changed); const f = box.querySelector('button'); if (f) f.focus();
    const lv = box.querySelector('[aria-live]'); if (lv) lv.textContent = '✓ ' + t('fna_done');
    EVSIG = ''; LEV.sig = ''; LEV.key = ''; if (typeof changed === 'function') changed();
  });
}
function fnAsgDlg(n) {                                // Notiz aus GReport: nur ansehen und zuordnen (geändert wird sie in GReport)
  let d = $('fnadlg'); if (!d) { d = el('dialog', { id: 'fnadlg', className: 'evdlg prognd' }); d.setAttribute('aria-labelledby', 'fnadlgh'); document.body.appendChild(d); }
  d.innerHTML = `<div class="dh"><h3 id="fnadlgh">📝 ${esc(t('fna_gr_title'))}</h3><button type="button" class="fnaxx" aria-label="${esc(t('a_close'))}">✕</button></div>
    <div class="dbody fnadb"><p class="fnawhen"><b>${esc(fmtWhen(new Date(n.a).toISOString()))}${n.b > n.a ? '–' + esc(n.clock_to || '') : ''}</b></p><div class="fnrowt">${fnText(n)}</div>
    <p class="mut">${esc(t('gr_edit_there'))}</p><div class="fnasgbox"></div></div>
    <div class="df"><button type="button" class="pri fnadx">${esc(t('a_close'))}</button></div>`;
  d.querySelector('.fnadx').onclick = () => d.close(); d.querySelector('.fnaxx').onclick = () => d.close();
  if (!d.dataset.bd) { d.dataset.bd = 1; d.addEventListener('click', e => { if (e.target === d) d.close(); }); }   // Klick neben den Dialog schließt
  fnAsgBox(d.querySelector('.fnasgbox'), 'g:' + n.id, () => loadEvents());
  d.showModal(); setTimeout(() => d.querySelector('.fnadx').focus(), 50);
}
/* Eigene Felder im Dialog „Notiz ändern“ (ab 1.83): gleicher Baustein wie in der Erfassung (felder.js); gespeichert über den bisherigen Weg (fnote edit) */
function fbReId(box, pre) {                           // Kennungen im Dialog eindeutig (die Erfassung oben nutzt dieselben)
  const map = {}; box.querySelectorAll('[id]').forEach(x => { map[x.id] = pre + x.id; x.id = pre + x.id; });
  for (const at of ['for', 'aria-labelledby', 'aria-describedby', 'list']) box.querySelectorAll('[' + at + ']').forEach(x => x.setAttribute(at, x.getAttribute(at).split(' ').map(v => map[v] || v).join(' ')));
}
function fnFields() {
  const box = $('fnfields'); if (!box) return; box.innerHTML = '';
  const H = { get: id => FN.fv[id], set: (id, v) => { if (v === undefined) delete FN.fv[id]; else FN.fv[id] = v; }, start: () => { },
    count: (b, dd) => { const n = (+FN.fv[b.id] || 0) + dd; if (n) FN.fv[b.id] = n; else delete FN.fv[b.id]; const c = box.querySelector(`.fbblk[data-b="${b.id}"] .fbcount`); if (c) c.textContent = t('fb_c_note', { n }); } };
  for (const b of Felder.visible().filter(b => !b.bind)) {             // Zeuge hat im Dialog sein eigenes Feld
    const d = el('div'); box.appendChild(d); Felder.render(d, b, FN.fv[b.id], H);
    if (b.type === 'counter' && b.mode !== 'add') { const c = d.querySelector('.fbcount'); if (c) c.textContent = t('fb_c_note', { n: FN.fv[b.id] || 0 }); }
    fbReId(d, 'fe_');
  }
  box.hidden = !box.children.length;
}
function fnOpen(n) {
  if (n && n.gr) { fnAsgDlg(n); return; }             // Notiz aus GReport: dort ändern, hier nur zuordnen
  FN.fromPanel = false; FN.edit = n && n.id ? n : null; FN.tags = new Set((n && n.tags) || []);
  $('fnfrom').value = n && n.from ? dtl(new Date(n.from)) : dtl(new Date(nowServer()));     // „von“ = Zeitpunkt des Öffnens
  $('fnto').value = n && n.to ? dtl(new Date(n.to)) : '';
  const sel = $('fnsrc'); sel.innerHTML = ''; option(sel, 'all', t('all_sources')); SOURCES.forEach(x => option(sel, x.id, x.name));
  let last = 'all'; try { last = localStorage.getItem('laerm_fnsrc') || 'all'; } catch (e) { }
  sel.value = n && n.src ? n.src : (SOURCES.some(x => x.id === last) ? last : 'all');
  $('fntext').value = (n && n.text) || ''; $('fnwit').value = (n && n.witness) || '';
  NT_AREAS.fntags = () => { $('fntags').innerHTML = ntList(FN.tags).map(tg => ntChip(tg, FN.tags.has(tg))).join('') + ntSugHtml() + ntAddBtn(); ntChipBind($('fntags'), FN.tags, () => { $('fnwit').hidden = !FN.tags.has('zeuge'); }); };
  NT_AREAS.fntags();
  $('fnwit').hidden = !FN.tags.has('zeuge'); $('fndel').hidden = !FN.edit; $('fnmsg').textContent = '';
  FN.fv = JSON.parse(JSON.stringify((n && n.fields) || {})); fnFields();
  if (FN.edit) fnAsgBox($('fnasg'), 'f:' + FN.edit.id, () => loadEvents()); else { $('fnasg').hidden = true; $('fnasg').innerHTML = ''; }
  $('fndlg').showModal(); setTimeout(() => $('fntext').focus(), 50);
}
async function fnSave(del) {
  if (!del) { const c = Felder.check(FN.fv, $('fnfields'), Felder.visible().map(b => Object.assign({}, b, { req: false }))); if (c.bad.length) { $('fnmsg').textContent = t('fb_bad', { l: c.bad.join(', ') }); return; } }
  const fields = {}; for (const [k, v] of Object.entries(FN.fv || {})) if (!Felder.isEmpty(v)) fields[k] = v;
  const body = del ? { action: 'del', id: FN.edit.id } : { action: FN.edit ? 'edit' : 'add', id: FN.edit ? FN.edit.id : '', from: $('fnfrom').value, to: $('fnto').value, src: $('fnsrc').value, text: autoText($('fntext').value, FN.tags), typed: !!$('fntext').value.trim(), tags: [...FN.tags], witness: $('fnwit').value, fields };
  if (del && !confirm(t('fn_del_q'))) return;
  try {
    const r = await (await fetch('fnote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    if (!r.ok) { $('fnmsg').textContent = r.error === 'field' ? t('fb_bad', { l: (r.fields || []).map(x => (Felder.byId(x) || {}).l || x).join(', ') }) : t(r.error === 'empty' ? 'fn_empty' : r.error === 'to' ? 'fn_bad_to' : 'saveerr'); return; } if (!del) { ntsLoad(); if (Object.keys(fields).length) fbLoad(true); }
    try { localStorage.setItem('laerm_fnsrc', $('fnsrc').value); } catch (e) { }
    $('fndlg').close(); fnRefresh(); if (FN.fromPanel && !del) fnpReset(); FN.fromPanel = false;
    if (NV.open) loadNight(); if (histOn()) dtLoad(LDT, true);
    if ($('evdlg').open && EVV.k) openEvent(EVV.k);
  } catch (e) { $('fnmsg').textContent = t('saveerr'); }
}
async function fnRefresh() {                         // Notizen der letzten Minuten fürs Live-Bild
  const now = nowServer(); FN.t = Date.now();
  try { FN.list = (await (await fetch('fnotes?from=' + (now - 3600000) + '&to=' + (now + 60000) + '&src=' + encodeURIComponent(selSrc), { cache: 'no-store' })).json()).notes || []; } catch (e) { }
  markDirty();
}
/* Markierung einer freien Notiz in einer Grafik: Band von–bis, gestrichelte Linie, 📝 und (wenn Platz) der Text */
function fnMarks(c, list, X, T, ph, L, pw, d, wide) {
  c.save(); c.beginPath(); c.rect(L, 0, pw, T + ph); c.clip();
  let lastX = -1e9;
  for (const n of list || []) {
    const a = Array.isArray(n) ? n[0] : n.a, b = Array.isArray(n) ? n[1] : n.b, tx = Array.isArray(n) ? n[2] : n.text;
    const x0 = X(a), x1 = Math.max(x0 + 2 * d, X(b)); if (x1 < L || x0 > L + pw) continue;
    c.fillStyle = 'rgba(112,72,232,0.12)'; c.fillRect(x0, T, x1 - x0, ph);
    c.strokeStyle = '#7048e8'; c.lineWidth = 1.5 * d; c.setLineDash([3 * d, 3 * d]); c.beginPath(); c.moveTo(x0, T); c.lineTo(x0, T + ph); c.stroke(); c.setLineDash([]);
    c.font = '600 ' + (11 * d) + 'px system-ui'; c.textAlign = 'left'; c.fillStyle = '#7048e8';
    const lab = '📝' + (wide && tx ? ' ' + (tx.length > 28 ? tx.slice(0, 27) + '…' : tx) : '');
    if (x0 - lastX > 20 * d) { c.fillText(lab, x0 + 3 * d, T + 13 * d); lastX = x0 + c.measureText(lab).width; }
  }
  c.restore();
}
function drawFnLive(cv, t0, t1) {
  if (!FN.list.length) return;
  const g_ = view.mode === 'level' && LOV.geo ? LOV.geo : [10, 22];
  const d = DPR(), c = cv.getContext('2d'), w = cv.width, h = cv.height, L = AXL() * d, R = 14 * d, T = g_[0] * d, B = g_[1] * d, pw = w - L - R, ph = h - T - B;
  const src = selSrc; fnMarks(c, FN.list.filter(n => (n.src || 'all') === 'all' || n.src === src), ts => L + pw * (ts - t0) / (t1 - t0), T, ph, L, pw, d, (t1 - t0) <= 20 * 60000);
}
function renderEvFn(list) {
  const box = $('evfnbox'); list = list || []; box.hidden = !list.length; if (!list.length) return;
  $('evfnhead').textContent = t('fn_in_ev', { n: list.length });
  $('evfnlist').innerHTML = list.map((n, i) => `<div class="ntrow" data-i="${i}"><span class="ntnum" style="background:#7048e8">📝</span><span class="ntoff">${esc(n.clock)}${n.to ? '–' + esc(n.clock_to) : ''}</span><span class="nttx">${(n.tags || []).map(ntTag).join('')}${n.text ? `<span class="ntt">${esc(n.text)}</span>` : ''}${n.witness ? `<span class="ntw">👤 ${esc(n.witness)}</span>` : ''}${fbx(n)}</span><span class="ntact">✎</span></div>`).join('');
  $('evfnlist').querySelectorAll('.ntrow').forEach(r => r.onclick = () => fnOpen(list[+r.dataset.i]));
}
/* Notiz-Leiste oben im Live-Bild („Notiz jetzt“): Aufbau wie in GReport – große Uhr, Rubriken mit Farben, Abschnitte ● / ○,
   „🕒 jetzt · Zeit ändern“ zum Aufklappen. Alles Einstellbare (Rubriken, Tasten, Bereiche, Überschrift, Uhr, Dichte, Tasten-Stil)
   gilt nur für GLighter: Tasten und Rubriken in schnellwahl.json, der Rest in layout.json („cap“). Sofort tippbar; „von“ = Moment der ersten Eingabe. */
const FC_GROUPS = ['src', 'kind', 'lvl', 'eff', 'act', 'misc', 'own'];
const FC_GDEF = { src: '#0c8a6a', kind: '#d6336c', lvl: '#e67700', eff: '#6741d9', act: '#1c6fd6', misc: '#5f6b78', own: '#a61e4d' };
const FC_PAL = ['#2f9e44', '#1098ad', '#7048e8', '#e8590c', '#c2255c', '#5c7cfa', '#868e96'];
const gInfo = g => (NTS.gall || []).find(x => x.g === g);
const gIds = () => NTS.gall && NTS.gall.length ? NTS.gall.map(x => x.g) : FC_GROUPS.slice();
const gCustom = g => /^g_/.test(g);
function gLabel(g) { const i = gInfo(g); return i && (i.custom || i.renamed) && i.l ? i.l : t('fc_g_' + (FC_GDEF[g] ? g : 'own')); }
function gColor(g) { const c = (NTS.gcol || {})[g]; if (c) return c; if (FC_GDEF[g]) return null; let h = 0; for (const ch of g) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return FC_PAL[h % FC_PAL.length]; }
function gAttr(g) { if (!gCustom(g)) return `g-${g}"`; const c = gColor(g); return `g-cu" style="--uc:${c};--udc:color-mix(in srgb, ${c} 72%, #fff)"`; }
function fcColApply() {                                // eigene Rubrikfarben als CSS-Variablen (auch im abgedockten Fenster)
  for (const doc of [document, FNPOP && !FNPOP.closed ? FNPOP.document : null]) {
    if (!doc) continue; const r = doc.documentElement.style;
    for (const g of FC_GROUPS) { const c = (NTS.gcol || {})[g]; if (c) { r.setProperty('--u-' + g, c); r.setProperty('--ud-' + g, `color-mix(in srgb, ${c} 72%, #fff)`); } else { r.removeProperty('--u-' + g); r.removeProperty('--ud-' + g); } }
  }
}
function ntAll() { const out = []; for (const g in NOTE_TAGS) out.push(...NOTE_TAGS[g]); for (const k in NTS.own) if (!NTS.del.has(k)) out.push(k); return out; }
function ntOrdered(list) {                             // fest angeordnet („Layout anpassen“) oder nach Gebrauch
  const base = new Map(ntAll().map((x, i) => [x, i])), b = x => base.has(x) ? base.get(x) : 1e5;
  if (NTS.mode === 'fixed') { const pos = new Map(NTS.order.map((x, i) => [x, i])); return list.sort((x, y) => (pos.has(x) ? pos.get(x) : 1e6 + b(x)) - (pos.has(y) ? pos.get(y) : 1e6 + b(y))); }
  return list.sort((x, y) => ((NTS.use[y] || 0) - (NTS.use[x] || 0)) || (b(x) - b(y)));
}
function ntVisible(sel) { return ntOrdered(ntAll().filter(k => !NTS.hide.has(k) || (sel && sel.has(k))).concat(sel ? [...sel].filter(k => !ntAll().includes(k)) : [])); }
const tagBtn = (tg, on) => `<button type="button" class="tag ${gAttr(ntGroup(tg)).replace('"', on ? ' on"' : '"')} data-t="${esc(tg)}" aria-pressed="${!!on}" title="${esc(t('qt_tip'))}">${esc(ntLabel(tg))}</button>`;
/* Einstellungen der Erfassung (layout.json „cap“) */
const CAP_DEF = { title: '', sub: '', order: [], hide: [], clock: 'big', dense: 'normal', style: 'outline' };
let CAP = Object.assign({}, CAP_DEF);
const SEC_EL = { txt: 'fnptext', tags: 'fnptags', wit: 'secwit', time: 'sectime' };
const SEC_L = { txt: 'fnp_p_txt', tags: 'fnp_p_tags', wit: 'fnp_p_wit', time: 'fc_p_time' };
/* Zwei Ansichten (ab 1.83.2, wie GReport): „angedockt“ (CAP, layout.json „cap“) und „abgedockt“ (CAPPOP, „cap_pop“) – je eigene
   Reihenfolge, ausgeblendete Bereiche/Felder und Rubriken, Uhr, Dichte und Tasten-Stil. Abgedockt folgt der angedockten Ansicht,
   bis sie selbst geändert wird. Nur Anzeige – Tasten, Felder und Notizen sind dieselben. */
let CAPPOP = null;
const VIEW_K = ['order', 'hide', 'ghide', 'clock', 'dense', 'style'];
const viewCur = () => FCL.on && FCL.d ? FCL.d.prof : popOn() ? 'pop' : 'dock';
function viewDock() { return { order: capOrder(null, CAP.order || []), hide: (CAP.hide || []).filter(x => SEC_EL[x]).concat(Felder.active().filter(b => b.hide).map(b => b.id)), ghide: gIds().filter(g => (gInfo(g) || {}).hide), clock: CAP.clock, dense: CAP.dense, style: CAP.style }; }
function viewGet(v) { const d = viewDock(); if (v !== 'pop' || !CAPPOP) return d; const o = Object.assign(d, CAPPOP); o.order = capOrder(null, o.order); return o; }
const viewHid = (k, v) => viewGet(v || viewCur()).hide.includes(k);
const gHid = g => viewGet(viewCur()).ghide.includes(g);
const viewBlocks = v => { const h = new Set(viewGet(v || viewCur()).hide); return Felder.active().filter(b => !h.has(b.id)); };
/* Reihenfolge der Bereiche: eingebaute und eigene Felder (Kennung b_…) gemeinsam; order: einer Ansicht (ohne: der gezeigten) */
function capOrder(list, order) {
  const all_ = list || Felder.active(), wAny = (list || Felder.S.defs || []).some(b => b.bind === 'witness');   // Zeuge als Feld (auch gelöscht): alter fester Bereich nie mehr in der Reihenfolge
  const blocks = all_.filter(b => !b.del).map(b => b.id), ok = x => (SEC_EL[x] && !(x === 'wit' && wAny)) || blocks.includes(x);
  const wb = all_.find(b => b.bind === 'witness' && !b.del), sw = x => x === 'wit' && wb ? wb.id : x, src = order || viewGet(viewCur()).order || [];   // Zeuge als Feld: steht, wo der alte Bereich stand
  const o = [...new Set(src.map(x => wb && src.includes(wb.id) ? x : sw(x)).filter(ok))];
  return o.concat(Object.keys(SEC_EL).map(sw).concat(blocks).filter((x, i, a) => ok(x) && !o.includes(x) && a.indexOf(x) === i));
}
const witB = () => FBS.defs.find(b => b.bind === 'witness' && !b.del);   // ab 1.85: Zeuge als Feld (Wert weiter in „witness“)
function witVal() { const b = witB(); if (!b) return $('fnpwit').value; if (!viewBlocks().some(x => x.id === b.id)) return ''; const v = FNP.fv[b.id]; return v && typeof v === 'object' ? (v.n || '').trim() : ''; }
const secEl = k => Felder.isId(k) ? $('fb_' + k) : $(SEC_EL[k]);
function secApply(order) { const body = $('fnpbody'); if (!body) return;
  for (const k of order || capOrder()) { const e = secEl(k); if (e && k !== 'time') body.appendChild(e); }
  const tm = secEl('time'), tx = secEl('txt'); if (tm) { if (tx && tx.parentElement === body) body.insertBefore(tm, tx); else body.prepend(tm); } }   // ab 1.85.11: „Zeit ändern“ immer direkt über dem Notiz-Textfeld
function capApply() {
  const sv = LAYOUT.srv && LAYOUT.srv.cap; if (sv) { CAP = Object.assign({}, CAP_DEF, sv); if (sv.blocks) Felder.S.defs = sv.blocks; Felder.S.sec = sv.sec || {}; if (sv.tpl) Felder.S.tpl = sv.tpl; }
  if (LAYOUT.srv) CAPPOP = LAYOUT.srv.cap_pop || null;
  { let old = null; try { old = localStorage.getItem('laerm_fnphide'); } catch (e) { }      // Abschnitte aus früheren Versionen (nur dieser Browser) einmal übernehmen
    if (old && LAYOUT.srv && !(CAP.hide || []).length) { try { const h = JSON.parse(old).map(x => x === 'ext' ? 'time' : x).filter(x => SEC_EL[x]); if (h.length) capPost({ hide: h }); } catch (e) { } }
    if (old && LAYOUT.srv) try { localStorage.removeItem('laerm_fnphide'); } catch (e) { } }
  const pn = $('fnpanel'); if (!pn) return;
  const V = viewGet(viewCur());                         // angedockt oder abgedockt
  for (const [k, vs] of [['ck', ['big', 'small', 'off']], ['dn', ['normal', 'compact']], ['ts', ['outline', 'filled']]]) for (const v of vs) pn.classList.toggle(k + '-' + v, V[{ ck: 'clock', dn: 'dense', ts: 'style' }[k]] === v);
  fbMount(); secApply(); secDraw(); fnpShow();
}
async function capPopPost(c) {                         // abgedockte Ansicht speichern (null = wie angedockt)
  CAPPOP = c;
  try { const j = await (await fetch('layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cap_pop: c }) })).json();
    if (j && j.ok) { LAYOUT.srv = j.layout; CAPPOP = j.layout.cap_pop || null; return true; } } catch (e) { }
  return false;
}
async function capPost(c) {
  Object.assign(CAP, c);
  try { const j = await (await fetch('layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c === null ? { reset: 'cap' } : { cap: c }) })).json();
    if (j && j.ok) { LAYOUT.srv = j.layout; CAP = Object.assign({}, CAP_DEF, j.layout.cap || {}); CAPPOP = j.layout.cap_pop || null; return true; } } catch (e) { }
  return false;
}
function secDraw() {                                   // Abschnitte ein- und ausblenden (● an / ○ aus), auch abgedockt
  const bar = $('secbar'); if (!bar) return; bar.innerHTML = ''; const v = viewCur(), hid = new Set(viewGet(v).hide);
  if (FCL.on) return;
  for (const k of capOrder()) {
    const blk = Felder.isId(k), e = secEl(k); if (blk && !e) continue;            // ausgeblendetes Feld: ganz weg
    const off = hid.has(k), l = secLabel(k); if (e) e.hidden = off;
    const n = off && k === 'tags' && FNP.tags.size ? ' · ' + FNP.tags.size : off && k === 'wit' && $('fnpwit').value.trim() ? ' · 1' : off && blk && !Felder.isEmpty(FNP.fv[k]) ? ' · 1' : '';
    const b = el('button', { type: 'button', className: 'secb' + (off ? '' : ' on'), textContent: l + n });
    b.setAttribute('aria-pressed', String(!off)); b.title = t(off ? 'fc_sec_show' : 'fc_sec_hide', { s: l });
    b.onclick = () => {                                 // je Ansicht: angedockt in „cap“, abgedockt in „cap_pop“ (wird dabei eigene Ansicht)
      if (v === 'pop') { const V = viewGet('pop'), h = new Set(V.hide); off ? h.delete(k) : h.add(k); const c = {}; for (const x of VIEW_K) c[x] = V[x]; c.hide = [...h]; CAPPOP = c; secDraw(); capPopPost(c); }
      else { const h = new Set(CAP.hide || []); off ? h.delete(k) : h.add(k); CAP.hide = [...h]; secDraw(); capPost({ hide: CAP.hide }); }
      const nb = [...bar.children].find(x => x.textContent.startsWith(l)); if (nb) nb.focus(); };
    bar.appendChild(b);
  }
}
/* ---------- Eigene Felder (Bausteine, wie in GReport): Zähler, Zahl, Ja/Nein, Auswahl, Skala, Dauer, Datum, Ort, Person, Text ----------
   Definitionen in layout.json (cap.blocks), Werte je freie Notiz in „fields“. Name/Hinweis/Pflicht der eingebauten Bereiche in cap.sec. */
const FBS = Felder.S;
const fbList = n => n.fx || Felder.compact(n.fields);
const fbx = n => fbList(n).map(x => `<span class="ntw fx">${esc(x)}</span>`).join('');
function secLabel(k, sec, list) {
  if (Felder.isId(k)) { const b = (list || FBS.defs).find(x => x.id === k); return b ? b.l : k; }
  return ((sec || FBS.sec)[k] || {}).l || t(SEC_L[k]);
}
const capWait = () => viewHid('txt') && viewBlocks().some(b => b.type === 'counter') ? t('fb_wait_cnt') : t(matchMedia('(pointer:coarse)').matches ? 'fnp_wait_m' : 'fnp_wait');
const FBH = { get: id => FNP.fv[id], set: (id, v) => { if (v === undefined) delete FNP.fv[id]; else FNP.fv[id] = v; if (viewGet(viewCur()).hide.length) secDraw(); },
  start: () => fnpStart(), count: (b, d) => fbCount(b, d) };
function fbMount(list, sec) {                          // list/sec: Entwurf aus „Layout anpassen“ (Vorschau, ausgeblendete blass)
  const body = $('fnpbody'); if (!body) return;
  const vis = list ? list.filter(b => !b.del) : viewBlocks(), ids = new Set(vis.map(b => b.id));
  body.querySelectorAll(':scope > .fbblk').forEach(x => { if (!ids.has(x.dataset.b)) x.remove(); });
  for (const b of vis) {
    let box = $('fb_' + b.id);
    if (!box) { box = body.ownerDocument.createElement('div'); box.id = 'fb_' + b.id; body.appendChild(box); }
    Felder.render(box, b, FNP.fv[b.id], FBH); box.classList.toggle('layoff', !!(list && b.hide));
  }
  const sw_ = $('secwit'); if (sw_ && (list || FBS.defs).some(b => b.bind === 'witness')) { sw_.hidden = true; sw_.dataset.gone = '1'; } else if (sw_) delete sw_.dataset.gone;   // alter Bereich weg
  secMeta(sec);
}
function secMeta(sec) {
  sec = sec || FBS.sec; const g = k => sec[k] || {}, neutral = FBS.tpl && FBS.tpl !== 'laerm';
  const tx = $('fnptext'); if (!tx) return;
  tx.placeholder = g('txt').h || t(neutral ? 'fb_txt_ph' : 'fn_ph');
  const tl = g('txt').l || t('fc_a_text'); tx.setAttribute('aria-label', tl); tx.title = tl;
  if (g('txt').req) tx.setAttribute('aria-required', 'true'); else tx.removeAttribute('aria-required');
  const w = $('fnpwit'), wl = g('wit').l; w.placeholder = wl ? t('fb_wit_ph', { l: wl }) : t('fn_wit'); w.setAttribute('aria-label', wl || t('fc_a_wit')); w.title = wl || t('fc_a_wit');
  if (g('wit').req) w.setAttribute('aria-required', 'true'); else w.removeAttribute('aria-required');
  for (const k of ['time', 'wit']) { const h = $('sech' + k); if (h) { h.textContent = g(k).h || ''; h.hidden = !g(k).h; } }
}
function fbOut() { const bd = new Set(FBS.defs.filter(b => b.bind).map(b => b.id)), o = {}; for (const [k, v] of Object.entries(FNP.fv || {})) if (!Felder.isEmpty(v) && !bd.has(k)) o[k] = v; return o; }   // Zeuge geht nach „witness“
function fbReqOk() {
  const c = Felder.check(FNP.fv, $('fnpbody'), viewBlocks()), msg = $('fnpmsg'), g = k => FBS.sec[k] || {}, hid = new Set(viewGet(viewCur()).hide);   // Pflicht nur, was diese Ansicht zeigt
  if (!hid.has('txt') && g('txt').req && !$('fnptext').value.trim()) c.miss.unshift(secLabel('txt'));
  if (!FBS.defs.some(b => b.bind === 'witness') && !hid.has('wit') && g('wit').req && !$('fnpwit').value.trim()) c.miss.push(secLabel('wit'));
  if (c.bad.length) { msg.className = 'msg fnpmsg err'; msg.textContent = t('fb_bad', { l: c.bad.join(', ') }); return false; }
  const key = c.miss.join('|');
  if (c.miss.length && FNP.reqWarned !== key) { FNP.reqWarned = key; msg.className = 'msg fnpmsg warn'; msg.textContent = t('fb_req_miss', { l: c.miss.join(', ') }); return false; }
  return true;
}
async function fbCount(b, d) {                          // Zähler: jeder Druck ein eigener Eintrag mit genauer Zeit
  const now = nowServer(), msg = $('fnpmsg');
  let r; try { r = await (await fetch('fnote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', from: dtl(new Date(now)), to: '', src: $('fnpsrc').value, text: '', tags: [], fields: { [b.id]: d } }) })).json(); } catch (e) { r = { ok: false }; }
  if (!r.ok) { msg.className = 'msg fnpmsg err'; msg.textContent = t('fb_c_err'); return; }
  FBS.counts[b.id] = (FBS.counts[b.id] || 0) + d; Felder.countShow($('fnpbody'), b);
  msg.className = 'msg fnpmsg'; msg.textContent = '✓ ' + t('fb_c_done', { l: b.l, v: Felder.fmt(b, d), t: r.note ? r.note.clock : '', n: FBS.counts[b.id] });
  clearTimeout(fbCount.tm); fbCount.tm = setTimeout(() => { if (msg.textContent.startsWith('✓')) msg.textContent = ''; }, 5000);
  fnRefresh(); if (histOn()) dtLoad(LDT, true);
}
async function fbLoad(quiet) {
  try { Felder.load(await (await fetch('felder', { cache: 'no-store' })).json()); } catch (e) { }
  if (quiet) { for (const b of viewBlocks()) if (b.type === 'counter') Felder.countShow($('fnpbody'), b); return; }
  if (!FCL.on) { fbMount(); secApply(); secDraw(); fnpShow(); }
}
Felder.setup({ t, esc, lang: () => lang, fmtDT: ms => { const d = new Date(ms); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }, dtl, dto: d => dtl(d), nowMs: nowServer });
async function fbTpl(name) {
  if (!confirm(t('fb_tpl_q', { n: t('fb_tpl_' + name) }))) return;
  let j; try { j = await (await fetch('felder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'tpl', tpl: name, lang }) })).json(); } catch (e) { j = { ok: false }; }
  if (!j.ok) { toast(t('saveerr')); return; }
  Felder.load(j); ntsApply(j.qt); if (j.layout) { LAYOUT.srv = j.layout; CAP = Object.assign({}, CAP_DEF, j.layout.cap || {}); }
  if (FCL.on) fclClose(); else capApply();
  fnpTags(); ntsRedraw(); toast('✓ ' + t('fb_tpl_done', { n: t('fb_tpl_' + name) }));
}
const FNP = { from: null, tags: new Set(), tick: null, fv: {}, reqWarned: null };
function fnpTags() {
  const box = $('fnptags'); if (!box) return;
  if (FCL.on) { fclDraw(); return; }
  const vis = ntVisible(FNP.tags), by = {}; for (const k of vis) (by[ntGroup(k)] = by[ntGroup(k)] || []).push(k);
  const ids = gIds(); for (const g in by) if (!ids.includes(g)) (by.own = by.own || []).push(...by[g]);   // Rubrik gibt es nicht mehr: unter „Eigene“
  let h = ''; const w = NTS.sug[0];
  if (w) h += `<div class="sugline">💡 ${esc(t('qt_sug', { w: w.w, n: w.n }))} <button type="button" class="sugy">＋ ${esc(t('qt_create'))}</button><button type="button" class="sugn" aria-label="${esc(t('qt_sug_no'))}" title="${esc(t('qt_sug_no'))}">✕</button></div>`;
  for (const g of ids) {
    const gi = gInfo(g) || {}, ks = by[g] || []; if (!ks.length && g !== 'own') continue;
    if (gHid(g) && !ks.some(k => FNP.tags.has(k))) continue;                 // ausgeblendete Rubrik dieser Ansicht (gewählte Tasten bleiben sichtbar)
    const rq = NTS.req && NTS.req.has(g);
    h += `<div class="grp${rq ? ' req' : ''}" data-g="${esc(g)}"><span>${esc(gLabel(g))}${rq ? '<i class="reqm" title="' + esc(t('fc_req_tip')) + '"> *</i>' : ''}${(NTS.ghelp || {})[g] ? `<small class="ghelp">${esc(NTS.ghelp[g])}</small>` : ''}</span><div role="group" aria-label="${esc(gLabel(g) + (NTS.gone && NTS.gone.has(g) ? ' – ' + t('fb_g_one') : ''))}">${ks.map(k => tagBtn(k, FNP.tags.has(k))).join('')}${g === 'own' ? `<button type="button" class="tag add" title="${esc(t('qt_add_tip'))}">＋ ${esc(t('qt_add'))}</button>` : ''}</div></div>`;
  }
  box.innerHTML = h;
  box.querySelectorAll('.grp>div').forEach(row => {    // Handy: Hinweis rechts, solange die Zeile weitergeht
    const upd = () => row.parentNode.classList.toggle('ovf', row.scrollWidth - row.scrollLeft - row.clientWidth > 4);
    row.addEventListener('scroll', upd, { passive: true }); requestAnimationFrame(upd);
  });
  box.querySelectorAll('.tag[data-t]').forEach(b => {
    b.onclick = () => { const k = b.dataset.t, g = ntGroup(k);
      if (NTS.gone && NTS.gone.has(g) && !FNP.tags.has(k)) for (const x of [...FNP.tags]) if (ntGroup(x) === g) { FNP.tags.delete(x); const o = box.querySelector(`.tag[data-t="${CSS.escape(x)}"]`); if (o) { o.classList.remove('on'); o.setAttribute('aria-pressed', 'false'); } }   // nur eine Auswahl
      FNP.tags.has(k) ? FNP.tags.delete(k) : FNP.tags.add(k); b.classList.toggle('on', FNP.tags.has(k)); b.setAttribute('aria-pressed', FNP.tags.has(k)); fnpStart(); reqCheck(); if (viewGet(viewCur()).hide.length) secDraw(); };
    b.oncontextmenu = e => { e.preventDefault(); ntManage(box, b.dataset.t); };
    let lp = 0; b.addEventListener('touchstart', () => { lp = setTimeout(() => { lp = -1; ntManage(box, b.dataset.t); }, 600); }, { passive: true });
    b.addEventListener('touchend', e => { if (lp === -1) e.preventDefault(); clearTimeout(lp); });
    b.addEventListener('touchmove', () => clearTimeout(lp), { passive: true });
  });
  const ad = box.querySelector('.tag.add'); if (ad) ad.onclick = () => ntManage(box);
  const sy = box.querySelector('.sugy'); if (sy) sy.onclick = async () => { try { const j = await ntsPost({ action: 'add', l: w.w }); if (j.k) { FNP.tags.add(j.k); fnpTags(); } } catch (e) { alert(e.message); } };
  const sn = box.querySelector('.sugn'); if (sn) sn.onclick = () => ntsPost({ action: 'nope', w: w.k }).catch(e => alert(e.message));
  reqCheck();
}
NT_AREAS.fnptags = () => fnpTags();
function reqCheck() {                                 // alle Pflicht-Rubriken gewählt: gewählte Tasten und „Speichern“ leuchten auf (gespeichert wird immer)
  const req = [...(NTS.req || [])], pn = $('fnpanel'); if (!pn) return;
  const have = new Set([...FNP.tags].map(ntGroup));
  pn.querySelectorAll('.grp.req').forEach(r => r.classList.toggle('done', have.has(r.dataset.g)));
  pn.classList.toggle('alldone', req.length > 0 && req.every(g => have.has(g)));
}
function fnpSrc() {
  const sel = $('fnpsrc'), cur = sel.value; sel.innerHTML = ''; option(sel, 'all', t('all_sources')); SOURCES.forEach(x => option(sel, x.id, x.name));
  let last = cur || 'all'; if (!cur) try { last = localStorage.getItem('laerm_fnsrc') || 'all'; } catch (e) { }
  sel.value = [...sel.options].some(o => o.value === last) ? last : 'all';
}
function fnpStart() { if (FNP.from == null) { FNP.from = nowServer(); fnpShow(); fnpTarget(); } }
async function fnpTarget() {                           // Vorschau: welcher Störung die Notiz zugeordnet wird
  if (FNP.from == null) { FNP.tgt = null; return; }
  try { const j = await (await fetch('fnote_target?at=' + Math.round(FNP.from) + '&src=' + encodeURIComponent($('fnpsrc').value), { cache: 'no-store' })).json(); FNP.tgt = j.target; } catch (e) { FNP.tgt = null; }
  fnpShow();
}
function fnpShow() {
  if (!$('fnpfrom')) return;
  const hm = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };
  const at = FNP.fixed && FNP.from != null ? FNP.from : nowServer(), d = new Date(at);
  $('capclock').textContent = hm(at); $('capclock').dateTime = dtl(d); $('capdate').textContent = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
  const tg = !$('fnprun').checked && FNP.tgt;           // ohne eigene Zeit: wird der letzten Störung zugeordnet
  if (!FCL.on) {                                       // im Bearbeiten sind Überschrift und Untertitel editierbar – nicht überschreiben
    $('capttl').textContent = CAP.title || t('fn_btn');
    $('fnpfrom').textContent = FNP.from == null ? (CAP.sub || capWait())
      : tg ? t('fnp_to_ev', { t: tg.clock, d: tg.devs.map(d => d[0] + (d[1] != null ? ' ' + d[1].toFixed(0) : '')).join(', '), k: tg.prof ? tg.kind : (tg.kind && tg.kind !== '?' ? artName(tg.kind) : '') })
      : t('fnp_from', { t: hm(FNP.from) }) + ($('fnprun').checked ? ' – ' + hm(nowServer()) : '');
  }
  $('fnpfrom').classList.toggle('on', FNP.from != null);
  const to = $('fnptoi').value, run = $('fnprun').checked;
  $('fnptimetxt').textContent = $('fnpnotime') && $('fnpnotime').checked ? t('fk_notime') + ' · ' + t('fc_t_change') : (FNP.fixed ? t('fc_t_at', { t: hm(at) }) : t('fc_t_now')) + (to ? ' – ' + hm(new Date(to).getTime()) : run ? ' – ' + t('fc_t_run') : '') + ' · ' + t('fc_t_change');
}
function timeEdit(open) {
  $('fnpext').hidden = !open; $('fnptimebtn').setAttribute('aria-expanded', String(open));
  if (open && !$('fnpfromi').value) $('fnpfromi').value = dtl(new Date(FNP.fixed && FNP.from != null ? FNP.from : nowServer()));
}
function fnpReset() { FNP.from = null; FNP.tgt = null; FNP.tags = new Set(); FNP.fv = {}; FNP.reqWarned = null; fbMount(); $('fnptext').value = ''; $('fnpwit').value = ''; $('fnpfromi').value = ''; $('fnptoi').value = ''; FNP.fixed = false; $('fnprun').checked = false; $('fnpnotime').checked = false; fnpNotime(); timeEdit(false); fnpTags(); fnpShow(); secDraw(); }
function fnpNotime() {                                 // Erinnerung: Zeitfelder aus, Hinweis statt Uhrzeit
  const nt = $('fnpnotime').checked;
  for (const id of ['fnpfromi', 'fnptoi', 'fnpfnow', 'fnptnow', 'fnptclr', 'fnprun']) { const e = $(id); if (e) e.disabled = nt; }
  $('fnpext').classList.toggle('notime', nt);
  if (nt) $('fnptimetxt').textContent = t('fk_notime') + ' · ' + t('fc_t_change');
}
function fnpFold(open) {
  $('fnpbody').hidden = !open; $('fnptog').setAttribute('aria-expanded', open ? 'true' : 'false'); $('fnpanel').classList.toggle('shut', !open);
  try { localStorage.setItem('laerm_fnp', open ? '1' : '0'); } catch (e) { }
}
async function fnpSave() {
  if (!fbReqOk()) return;
  const nt = $('fnpnotime').checked, run = !nt && $('fnprun').checked;   // ab 1.85.51: Erinnerung = ohne Zeitpunkt (Zeitpunkt: jetzt), keiner Störung zugeordnet
  const fixed = !nt && FNP.fixed && $('fnpfromi').value, tv = nt ? '' : $('fnptoi').value;      // eigene Zeiten („Zeit ändern“); sonst gilt die Uhrzeit beim Speichern
  const body = { action: 'add', id: '', from: fixed ? $('fnpfromi').value : dtl(new Date(nowServer())), to: tv || (run ? dtl(new Date(nowServer())) : ''), src: $('fnpsrc').value, text: autoText($('fnptext').value, FNP.tags), typed: !!$('fnptext').value.trim(), tags: [...FNP.tags].concat(witVal().trim() && !FNP.tags.has('zeuge') ? ['zeuge'] : []), witness: witVal(), auto: !nt && !run && !fixed && !tv, notime: nt, fields: fbOut() };
  const msg = $('fnpmsg'); msg.className = 'msg fnpmsg';
  try {
    const r = await (await fetch('fnote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    if (!r.ok) { msg.textContent = r.error === 'field' ? t('fb_bad', { l: (r.fields || []).map(x => (Felder.byId(x) || {}).l || x).join(', ') }) : t(r.error === 'empty' ? 'fn_empty' : r.error === 'to' ? 'fn_bad_to' : 'saveerr'); msg.classList.add('err'); return; }
    try { localStorage.setItem('laerm_fnsrc', $('fnpsrc').value); } catch (e) { }
    const hadF = Object.keys(body.fields || {}).length; fnpReset(); if (hadF) fbLoad(true); ntsLoad(); msg.textContent = '✓ ' + (r.target ? t('fnp_saved_ev', { t: r.target.clock }) : t('fnp_saved')); setTimeout(() => { if (msg.textContent.startsWith('✓')) msg.textContent = ''; }, 4000);
    fnRefresh(); if (histOn()) dtLoad(LDT, true);
  } catch (e) { msg.textContent = t('saveerr'); msg.classList.add('err'); }
}
function initFnp() {
  if (!$('fnpanel')) return;
  let open = innerWidth >= 700; try { const v = localStorage.getItem('laerm_fnp'); if (v != null) open = v !== '0'; } catch (e) { }   // Handy: zu, damit das Live-Bild oben steht
  fnpFold(open); fnpTags(); fnpSrc(); capApply(); fclInit();
  { const pb = $('fnppop'); if (pb) pb.onclick = fnPop; }
  $('fnptog').onclick = () => { const o = $('fnpbody').hidden; fnpFold(o); if (o) $('fnptext').focus(); };
  $('fnptext').addEventListener('input', () => { if ($('fnptext').value.trim()) fnpStart(); });
  $('fnpwit').addEventListener('input', () => { if ($('fnpwit').value.trim()) fnpStart(); });
  $('fnprun').onchange = () => { fnpStart(); fnpShow(); };
  $('fnpnotime').onchange = () => { fnpNotime(); fnpShow(); };
  $('fnpsrc').addEventListener('change', fnpTarget);
  $('fnpsave').onclick = fnpSave;
  enterSave($('fnptext'), fnpSave);
  $('fnptimebtn').onclick = () => timeEdit($('fnpext').hidden);
  $('fnpfnow').onclick = () => { FNP.fixed = false; $('fnpfromi').value = dtl(new Date(nowServer())); fnpShow(); };
  $('fnpfromi').addEventListener('input', () => { FNP.fixed = true; const v = new Date($('fnpfromi').value).getTime(); if (!isNaN(v)) FNP.from = v; fnpShow(); });
  $('fnptoi').addEventListener('input', fnpShow);
  $('fnptnow').onclick = () => { $('fnptoi').value = dtl(new Date(nowServer())); fnpShow(); };
  $('fnptclr').onclick = () => { $('fnptoi').value = ''; fnpShow(); };
  FNP.tick = setInterval(() => {                    // die Uhr läuft mit, bis die Notiz gespeichert wird (oder die Zeit von Hand gesetzt ist)
    if (document.hidden && !(FNPOP && !FNPOP.closed)) return;     // abgedockt läuft die Uhr auch weiter, wenn die Seite im Hintergrund ist
    const now = nowServer();
    if (!FNP.fixed) {
      if (FNP.from != null) FNP.from = now;
      const fi = $('fnpfromi'); if (fi && !$('fnpext').hidden && fi.ownerDocument.activeElement !== fi) fi.value = dtl(new Date(now));
    }
    fnpShow();
  }, 1000);
  if (open && !matchMedia('(pointer:coarse)').matches) setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) $('fnptext').focus({ preventScroll: true }); }, 300);   // am PC sofort lostippen
}
/* ---------- Layout der Erfassung anpassen (wie GReport, gespeichert nur in GLighter): Tasten und Rubriken anlegen, umbenennen,
   einfärben, ausblenden, löschen und per Ziehen oder Pfeiltasten verschieben, Bereiche anordnen, Überschrift und Untertitel,
   Uhr, Dichte und Tasten-Stil. Änderungen sammeln sich in einem Entwurf; „Fertig“ schickt sie in einem Rutsch, „Abbrechen“ verwirft. */
const FCL = { on: false, d: null, focus: null };
const hex6 = () => Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(16).padStart(2, '0')).join('');
const fclFlat = gs => gs.filter(g => !g.del).flatMap(g => g.keys);
function fclBuild(prof) {
  const groups = gIds().map(g => {
    const gi = gInfo(g) || {}, col = (NTS.gcol || {})[g] || '';
    const one = !!(NTS.gone && NTS.gone.has(g)), hp = (NTS.ghelp || {})[g] || '';
    return { g, l: gLabel(g), l0: gLabel(g), custom: gCustom(g), hide: !!gi.hide, hide0: !!gi.hide, req: !!(NTS.req && NTS.req.has(g)), req0: !!(NTS.req && NTS.req.has(g)), one, one0: one, h: hp, h0: hp, col, col0: col, isNew: false, del: false,
      keys: ntOrdered(ntAll().filter(k => (gIds().includes(ntGroup(k)) ? ntGroup(k) : 'own') === g)) };
  });
  const keys = {};
  for (const gr of groups) for (const k of gr.keys) keys[k] = { k, l: ntLabel(k), l0: ntLabel(k), own: NTS.own[k] != null, hide: NTS.hide.has(k), hide0: NTS.hide.has(k), g0: gr.g, isNew: false, del: false };
  const secs = capOrder(null, CAP.order || []);
  const fb = JSON.parse(JSON.stringify({ blocks: FBS.defs, sec: FBS.sec })), hide = new Set(CAP.hide || []);
  for (const k of Object.keys(SEC_EL)) if (hide.has(k)) (fb.sec[k] = fb.sec[k] || {}).hide = true;     // „zeigen“ der eingebauten Bereiche = cap.hide
  const dock = viewDock(), pop = viewGet('pop');
  FCL.d = { groups, keys, order0: fclFlat(groups).join(), gorder0: groups.map(g => g.g).join(), secs, secs0: secs.join(), clock: CAP.clock, dense: CAP.dense, style: CAP.style,
    fb, fb0: JSON.stringify(Felder.strip(fb)), prof: 'dock', views: { dock, pop }, pop0: fclVKey(pop), popSync: fclVKey(pop), popOwn: !!CAPPOP, popFollow: false };
  if (prof === 'pop') fclViewPut('pop');
}
/* Entwurf je Ansicht: Reihenfolge, Ausblenden (Bereiche/Felder, Rubriken), Uhr, Dichte und Stil der gerade bearbeiteten Ansicht
   stehen im Entwurf (d.secs, d.fb, d.groups, d.clock …); beim Umschalten werden sie in d.views getauscht. */
const fclVKey = v => JSON.stringify([v.order, [...v.hide].sort(), [...v.ghide].sort(), v.clock, v.dense, v.style]);
const fclFollows = () => !FCL.d.popOwn || FCL.d.popFollow;
function fclViewTake() {
  const d = FCL.d, v = d.views[d.prof];
  v.order = d.secs.filter(k => SEC_EL[k] || d.fb.blocks.some(b => b.id === k && !b.del));
  v.hide = Object.keys(SEC_EL).filter(k => (d.fb.sec[k] || {}).hide).concat(d.fb.blocks.filter(b => b.hide && !b.del).map(b => b.id));
  v.ghide = d.groups.filter(g => g.hide && !g.del).map(g => g.g);
  v.clock = d.clock; v.dense = d.dense; v.style = d.style;
}
function fclViewPut(p) {
  const d = FCL.d, v = d.views[p], h = new Set(v.hide), gh = new Set(v.ghide); d.prof = p;
  d.secs = capOrder(d.fb.blocks, v.order);
  for (const k of Object.keys(SEC_EL)) { const s = d.fb.sec[k]; if (h.has(k)) (d.fb.sec[k] = s || {}).hide = true; else if (s && s.hide) { delete s.hide; if (!Object.keys(s).length) delete d.fb.sec[k]; } }
  for (const b of d.fb.blocks) { if (h.has(b.id)) b.hide = true; else delete b.hide; }
  for (const g of d.groups) g.hide = gh.has(g.g);
  d.clock = v.clock; d.dense = v.dense; d.style = v.style;
}
function fclLook() {                                   // Uhr, Dichte, Stil des Entwurfs als Vorschau
  const d = FCL.d, pn = $('fnpanel'); if (!d || !pn) return;
  for (const [m, x] of [['ck', d.clock], ['dn', d.dense], ['ts', d.style]]) { [...pn.classList].filter(c => c.startsWith(m + '-')).forEach(c => pn.classList.remove(c)); pn.classList.add(m + '-' + x); }
}
function fclProf(p) {
  const d = FCL.d; if (!d || d.prof === p) return;
  fclViewTake();
  if (p === 'pop' && fclFollows() && fclVKey(d.views.pop) === d.popSync) { d.views.pop = JSON.parse(JSON.stringify(d.views.dock)); d.popSync = fclVKey(d.views.pop); }   // folgt noch: aktuellen Stand zeigen
  fclViewPut(p); fclBar(); fclDraw(); fclPreview(); fclLook();
  fclSay(t('fc_lay_prof_now', { p: t(p === 'pop' ? 'fc_view_pop' : 'fc_view_dock') }));
  const f = $('caplaybar').querySelector(`.laypb[data-p="${p}"]`); if (f) f.focus();
}
function fclSay(msg) { const e = $('fcllive'); if (e) { e.textContent = ''; setTimeout(() => { e.textContent = msg; }, 30); } }
function fclOpen() {
  if (FCL.on) return;
  if ($('fnpbody').hidden) fnpFold(true);
  FCL.on = true; fclBuild(popOn() ? 'pop' : 'dock');   // im abgedockten Fenster: dessen Ansicht
  const pn = $('fnpanel'); pn.classList.add('lay'); $('caplay').setAttribute('aria-pressed', 'true');
  for (const [id, key, def] of [['capttl', 'title', t('fn_btn')], ['fnpfrom', 'sub', capWait()]]) {
    const e = $(id); e.textContent = CAP[key] || def; try { e.contentEditable = 'plaintext-only'; } catch (x) { e.contentEditable = 'true'; }   // def: siehe capWait()
    if (e.contentEditable !== 'plaintext-only') e.contentEditable = 'true';
    e.setAttribute('role', 'textbox'); e.setAttribute('aria-label', t(id === 'capttl' ? 'fc_lay_title' : 'fc_lay_sub')); e.tabIndex = 0; e.dataset.def = def;
    e.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); e.blur(); } };
  }
  fclBar(); fnpTags(); fclPreview(); secDraw(); fclLook(); const f = $('caplaybar').querySelector('.laysec'); if (f) f.focus();
}
function fclClose() {
  FCL.on = false; FCL.d = null;
  for (const id of ['capttl', 'fnpfrom']) { const e = $(id); e.removeAttribute('contenteditable'); e.removeAttribute('role'); e.removeAttribute('aria-label'); e.removeAttribute('tabindex'); e.onkeydown = null; }
  const pn = $('fnpanel'); pn.classList.remove('lay'); $('caplay').setAttribute('aria-pressed', 'false'); $('caplaybar').hidden = true; $('caplaybar').innerHTML = '';
  for (const k of Object.keys(SEC_EL)) { const e = $(SEC_EL[k]); if (e) e.classList.remove('layoff'); }
  capApply(); fnpTags(); $('caplay').focus();
}
function fclBar() {
  const bar = $('caplaybar'), d = FCL.d, pop = d.prof === 'pop'; bar.hidden = false;
  const sel = (k, vs) => `<label>${esc(t('fc_o_' + k))} <select data-o="${k}">${vs.map(v => `<option value="${v}"${d[k] === v ? ' selected' : ''}>${esc(t('fc_o_' + k + '_' + v))}</option>`).join('')}</select></label>`;
  const st = pop ? (fclFollows() ? t('fc_lay_pop_follow') : t('fc_lay_pop_own')) : t('fc_lay_dock_s');
  bar.innerHTML = `<div class="layprof"><span class="laysl" id="fclpl">${esc(t('fc_lay_prof'))}</span><span class="seg" role="group" aria-labelledby="fclpl">${['dock', 'pop'].map(p => `<button type="button" class="laypb${d.prof === p ? ' on' : ''}" data-p="${p}" aria-pressed="${d.prof === p}">${p === 'pop' ? '⧉' : '▭'} ${esc(t(p === 'pop' ? 'fc_view_pop' : 'fc_view_dock'))}</button>`).join('')}</span>
      <small class="layps" id="fclps">${esc(st)}</small>${pop && !fclFollows() ? `<button type="button" class="btn" id="fclpcopy">${esc(t('fc_lay_pop_copy'))}</button>` : ''}</div>
    <p class="layhint">${esc(t(pop ? 'fc_lay_hint_pop' : 'fc_lay_hint'))}</p>
    <div class="laysecs"><span class="laysl" id="fclsl">${esc(t('fc_lay_secs'))}</span><div class="laysbox" role="group" aria-labelledby="fclsl"></div></div>
    <div class="layopts">${sel('clock', ['big', 'small', 'off'])}${sel('dense', ['normal', 'compact'])}${sel('style', ['outline', 'filled'])}<button type="button" class="btn" id="fcltpl" aria-expanded="false" aria-controls="fcltplbox">${esc(t('fb_tpl'))}</button></div>
    <div id="fcltplbox" class="fbtplbox" hidden></div>
    <div id="fclfb" class="layfb"></div>
    <div class="laybtns"><button type="button" class="btn" id="fclreset">${esc(t('fc_reset'))}</button><span class="grow"></span><button type="button" class="btn" id="fclcancel">${esc(t('cancel'))}</button><button type="button" class="btn primary" id="fcldone">${esc(t('fc_lay_done'))}</button></div>
    <span class="sr" id="fcllive" aria-live="polite"></span>`;
  fclChips(); fclFb();
  $('fcltpl').onclick = () => { const box = $('fcltplbox'), o = box.hidden; box.hidden = !o; $('fcltpl').setAttribute('aria-expanded', String(o)); if (o) { Felder.tplBox(box, FBS.tpl || 'laerm', fbTpl); const f = box.querySelector('button'); if (f) f.focus(); } };
  bar.querySelectorAll('select[data-o]').forEach(s => s.onchange = () => {   // Vorschau sofort, gespeichert mit „Fertig“
    d[s.dataset.o] = s.value; const pn = $('fnpanel'), m = { clock: 'ck', dense: 'dn', style: 'ts' }[s.dataset.o];
    [...pn.classList].filter(c => c.startsWith(m + '-')).forEach(c => pn.classList.remove(c)); pn.classList.add(m + '-' + s.value);
  });
  bar.querySelectorAll('.laypb').forEach(b => b.onclick = () => fclProf(b.dataset.p));
  const cp = $('fclpcopy'); if (cp) cp.onclick = () => {                            // abgedockt wieder wie angedockt (folgt danach)
    fclViewTake(); d.views.pop = JSON.parse(JSON.stringify(d.views.dock)); d.popFollow = true; d.popSync = fclVKey(d.views.pop); fclViewPut('pop'); fclBar(); fclDraw(); fclPreview(); fclLook();
    fclSay(t('fc_lay_pop_copied')); const f = $('caplaybar').querySelector('.laypb[data-p="pop"]'); if (f) f.focus();
  };
  $('fclreset').onclick = fclReset; $('fclcancel').onclick = fclClose; $('fcldone').onclick = fclSave;
}
function fclChips(focus) {                             // Bereiche (eingebaute und eigene Felder): Ziehen oder Pfeiltasten
  const d = FCL.d, box = $('caplaybar').querySelector('.laysbox'); if (!box) return;
  const wAny = d.fb.blocks.some(b => b.bind === 'witness');
  d.secs = d.secs.filter(k => (SEC_EL[k] && !(k === 'wit' && wAny)) || d.fb.blocks.some(b => b.id === k && !b.del));
  const off = k => Felder.isId(k) ? !!(d.fb.blocks.find(b => b.id === k) || {}).hide : !!(d.fb.sec[k] || {}).hide, lab = k => secLabel(k, d.fb.sec, d.fb.blocks);
  box.innerHTML = d.secs.map((k, i) => `<button type="button" class="laysec${off(k) ? ' off' : ''}" data-sec="${esc(k)}" data-drag="sec" aria-label="${esc(t('fc_lay_sec_a', { s: lab(k), i: i + 1, n: d.secs.length }) + (off(k) ? ', ' + t('fc_lay_hidden') : ''))}"><span aria-hidden="true">⠿</span> ${esc(lab(k))}</button>`).join('');
  box.querySelectorAll('.laysec').forEach(b => b.onkeydown = e => {
    const i = d.secs.indexOf(b.dataset.sec), j = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : -2;
    if (j === -2) return; e.preventDefault(); if (j < 0 || j >= d.secs.length) return;
    d.secs.splice(j, 0, d.secs.splice(i, 1)[0]); secApply(d.secs); fclChips(b.dataset.sec); fclFb();
    fclSay(t('fc_lay_moved', { s: lab(b.dataset.sec), i: j + 1, n: d.secs.length }));
  });
  if (focus) { const f = box.querySelector(`.laysec[data-sec="${CSS.escape(focus)}"]`); if (f) f.focus(); }
}
function fclFb(focusId) {                             // Einstellungen je Bereich/Feld, neue Felder
  const d = FCL.d, box = $('fclfb'); if (!box) return;
  const opened = new Set([...box.querySelectorAll('details.fbed[open]')].map(x => x.dataset.id));
  const bw_ = d.fb.blocks.some(b => b.bind === 'witness');
  const items = d.secs.filter(k => !(k === 'wit' && bw_)).map(k => SEC_EL[k] ? { k, l: t(SEC_L[k]), req: k === 'txt' || k === 'wit', help: k === 'wit' || k === 'time' || k === 'txt' } : { b: d.fb.blocks.find(b => b.id === k) }).filter(x => x.k || (x.b && !x.b.del));
  Felder.editor(box, d.fb, items, {
    change: (id, redraw) => { fclChips(); if (redraw) fclFb(); fclPreview(); },
    say: fclSay,
    add: (type, b) => { if (type === 'pills') { fclAddGroup(); return; } d.secs.push(b.id); fclChips(); fclFb(b.id); fclPreview(); }
  });
  box.querySelectorAll('details.fbed').forEach(x => { if (opened.has(x.dataset.id)) x.open = true; });
  if (focusId) { const r = box.querySelector(`details.fbed[data-id="${CSS.escape(focusId)}"]`); if (r) { r.open = true; const i = r.querySelector('.fe_l'); i.focus(); i.select(); } }
}
function fclPreview() {
  const d = FCL.d; if (!d) return; fbMount(d.fb.blocks, d.fb.sec); secApply(d.secs);
  const wAny = d.fb.blocks.some(b => b.bind === 'witness');
  for (const k of Object.keys(SEC_EL)) { const e = $(SEC_EL[k]); if (!e) continue; e.dataset.secel = k; if (k === 'wit' && wAny) { e.hidden = true; continue; } e.hidden = false; e.classList.toggle('layoff', !!(d.fb.sec[k] || {}).hide); }
  Felder.inlineEdit($('fnpbody'), d.fb, {                      // ab 1.85.10: jedes Feld (auch Zeuge) direkt am Element bearbeiten, wie die Rubriken
    change: (id, redraw) => { fclChips(); fclFb(); fclPreview(); const f = $('fnpbody').querySelector(`.fbblk[data-b="${CSS.escape(id)}"] .hd`); if (f && redraw === 'focus') f.focus(); },
    say: fclSay,
    open: id => { const r = $('fclfb') && $('fclfb').querySelector(`details.fbed[data-id="${CSS.escape(id)}"]`); if (!r) return; r.open = true; r.scrollIntoView({ block: 'center' }); const i = r.querySelector('.fe_l'); if (i) i.focus(); },
    move: (id, to) => { const i = d.secs.indexOf(id); if (i < 0) return; const j = typeof to === 'number' ? i + to : d.secs.indexOf(to); if (j < 0 || j >= d.secs.length || j === i) return;
      d.secs.splice(j, 0, d.secs.splice(i, 1)[0]); fclChips(); fclFb(); fclPreview(); fclSay(t('fc_lay_moved', { s: secLabel(id, d.fb.sec, d.fb.blocks), i: j + 1, n: d.secs.length }));
      const f = $('fnpbody').querySelector(`.fbblk[data-b="${CSS.escape(id)}"] .hd`); if (f) f.focus(); }
  });
}
function fclAddGroup() {
  const d = FCL.d, l = t('fc_lay_gnew');                // ohne prompt() (erscheint in der HA-App nicht): Name direkt in der Leiste ändern
  const g = 'g_' + hex6(); d.groups.splice(d.groups.findIndex(x => x.g === 'own'), 0, { g, l: l.trim().slice(0, 30), l0: '', custom: true, hide: false, hide0: false, req: false, req0: false, one: false, one0: false, h: '', h0: '', col: '', col0: '', isNew: true, del: false, keys: [] });
  FCL.focus = `.layg[data-g="${g}"] .lgn`; fclDraw(); fclSay(t('fb_ed_added', { l: l.trim() }));
}
function fclFind(k) { return FCL.d.groups.find(g => g.keys.includes(k)); }
function fclDraw() {
  const box = $('fnptags'), d = FCL.d; if (!box || !d) return;
  const cnt = d.groups.filter(g => !g.del).length;
  let h = '<div class="laygs">';
  d.groups.filter(g => !g.del).forEach((gr, gi) => {
    const col = gr.col || gColor(gr.g) || FC_GDEF[gr.g] || '#5f6b78';
    h += `<div class="layg${gr.hide ? ' off' : ''}" data-g="${esc(gr.g)}" style="--gc:${esc(col)}">
      <div class="laygh"><button type="button" class="hd" data-drag="grp" aria-label="${esc(t('fc_lay_grp_a', { g: gr.l, i: gi + 1, n: cnt }))}" title="${esc(t('fc_drag'))}">⠿</button>
        <input type="text" class="lgn" maxlength="30" value="${esc(gr.l)}" aria-label="${esc(t('fc_lay_gname'))}">
        <input type="color" class="lgc" value="${esc(/^#[0-9a-f]{6}$/i.test(col) ? col : '#5f6b78')}" aria-label="${esc(t('fc_gcol', { g: gr.l }))}" title="${esc(t('fc_gcol', { g: gr.l }))}">
        <label class="check"><input type="checkbox" class="lgh"${gr.hide ? '' : ' checked'}> ${esc(t('fc_shown'))}</label>
        <label class="check" title="${esc(t('fc_req_tip'))}"><input type="checkbox" class="lgr"${gr.req ? ' checked' : ''}> ${esc(t('fc_req'))}</label>
        <label class="check"><input type="checkbox" class="lgo"${gr.one ? ' checked' : ''}> ${esc(t('fb_g_one'))}</label>
        ${gr.custom ? `<button type="button" class="lgd" aria-label="${esc(t('fc_lay_gdel', { g: gr.l }))}" title="${esc(t('fc_lay_gdel', { g: gr.l }))}">🗑</button>` : ''}</div>
      <div class="laygx"><input type="text" class="lgx" maxlength="160" value="${esc(gr.h || '')}" placeholder="${esc(t('fb_ed_help'))}" aria-label="${esc(t('fb_g_help', { g: gr.l }))}"></div>
      <div class="laykeys">${gr.keys.map(k => d.keys[k]).filter(x => x && !x.del).map(x => `<span class="layk tag ${gAttr(gr.g).replace('"', x.hide ? ' off"' : '"')} data-k="${esc(x.k)}"><button type="button" class="lkn" data-drag="key" aria-label="${esc(t('fc_lay_key_a', { k: x.l, g: gr.l }) + (x.hide ? ', ' + t('fc_lay_hidden') : ''))}">${esc(x.l)}</button><button type="button" class="lkx" aria-label="${esc(t(x.own ? 'fc_lay_kdel' : x.hide ? 'fc_lay_kshow' : 'fc_lay_khide', { k: x.l }))}" title="${esc(t(x.own ? 'fc_lay_kdel' : x.hide ? 'fc_lay_kshow' : 'fc_lay_khide', { k: x.l }))}">${x.own ? '✕' : x.hide ? '○' : '●'}</button></span>`).join('')}<button type="button" class="tag add lka">＋ ${esc(t('fc_lay_kadd'))}</button></div>
    </div>`;
  });
  h += `<span class="lgaw"><button type="button" class="btn lga" aria-haspopup="menu" aria-expanded="false">＋ ${esc(t('fc_lay_gadd'))}</button></span></div>`;
  box.innerHTML = h;
  box.querySelectorAll('.layg').forEach(row => {
    const gr = d.groups.find(g => g.g === row.dataset.g);
    row.querySelector('.lgn').onchange = e => { const v = e.target.value.trim(); if (v) gr.l = v.slice(0, 30); else e.target.value = gr.l; };
    row.querySelector('.lgc').oninput = e => { gr.col = e.target.value; row.style.setProperty('--gc', gr.col); };
    row.querySelector('.lgh').onchange = e => { gr.hide = !e.target.checked; row.classList.toggle('off', gr.hide); };
    row.querySelector('.lgr').onchange = e => { gr.req = e.target.checked; };
    row.querySelector('.lgo').onchange = e => { gr.one = e.target.checked; };
    row.querySelector('.lgx').oninput = e => { gr.h = e.target.value.trim(); };
    const del = row.querySelector('.lgd'); if (del) del.onclick = () => {   // Rückfrage im Knopf (kein Browser-Fenster)
      Felder.sure(del, t('fc_lay_gdel_q', { g: gr.l }), () => {
      const own = d.groups.find(g => g.g === 'own'); own.keys.push(...gr.keys); gr.keys = []; gr.del = true; fclDraw(); fclSay(t('fc_lay_gdeleted', { g: gr.l }));
      });
    };
    row.querySelector('.hd').onkeydown = e => fclMoveGroup(e, gr);
    row.querySelector('.lka').onclick = () => fclAddKey(row, gr);
  });
  box.querySelectorAll('.layk').forEach(chip => {
    const x = d.keys[chip.dataset.k], nb = chip.querySelector('.lkn');
    nb.onclick = () => { if (!FCL.dragged) fclRename(chip, x); };
    nb.onkeydown = e => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); fclKeyX(x, chip.querySelector('.lkx')); } else fclMoveKey(e, x); };
    chip.querySelector('.lkx').onclick = ev => fclKeyX(x, ev.currentTarget);
  });
  box.querySelector('.lga').onclick = ev => Felder.addMenu(ev.currentTarget, ty => {   // Klick öffnet die Typauswahl: Tasten → neue Rubrik, sonst neues Feld
    if (ty === 'pills') { fclAddGroup(); return; }
    const b = Felder.addDef(d.fb, ty); if (!b) { fclSay(t('fb_ed_limit', { n: Felder.S.max })); return; }
    d.secs.push(b.id); fclChips(); fclFb(); fclPreview(); fclSay(t('fb_ed_added', { l: b.l }));
    const f = $('fnpbody').querySelector(`.fbblk[data-b="${CSS.escape(b.id)}"] .fil_l`); if (f) { f.focus(); f.select(); f.scrollIntoView({ block: 'center' }); } });
  if (FCL.focus) { const f = box.querySelector(FCL.focus); FCL.focus = null; if (f) { f.focus(); if (f.classList.contains('lgn')) f.select(); } }
}
function fclKeyX(x, btn) {                                  // eigene Taste löschen, eingebaute ein-/ausblenden
  if (x.own) {                                        // eigene Taste: Rückfrage im Knopf (kein Browser-Fenster, das in der HA-App nicht erscheint)
    const bt = btn || document.querySelector(`.layk[data-k="${CSS.escape(x.k)}"] .lkx`); if (!bt) return;
    Felder.sure(bt, t('qt_del_q', { n: x.l }), () => { x.del = true; const g = fclFind(x.k); if (g) g.keys = g.keys.filter(k => k !== x.k); fclSay(t('fc_lay_kdeleted', { k: x.l })); fclDraw(); }); return; }
  else { x.hide = !x.hide; FCL.focus = `.layk[data-k="${x.k}"] .lkx`; fclSay(t(x.hide ? 'fc_lay_khidden' : 'fc_lay_kshown', { k: x.l })); }
  fclDraw();
}
function fclRename(chip, x) {
  const nb = chip.querySelector('.lkn'), inp = el('input', { type: 'text', className: 'lkin', value: x.l, maxLength: 30 });
  inp.setAttribute('aria-label', t('qt_ren')); nb.replaceWith(inp); inp.focus(); inp.select();
  let done = false;
  const fin = ok => { if (done) return; done = true; const v = inp.value.trim(); if (ok && v) x.l = v; FCL.focus = `.layk[data-k="${x.k}"] .lkn`; fclDraw(); };
  inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); fin(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fin(false); } };
  inp.onblur = () => fin(true);
}
function fclAddKey(row, gr) {
  const add = row.querySelector('.lka'), f = el('span', { className: 'lkform' });
  f.innerHTML = `<input type="text" class="lkin" maxlength="30" aria-label="${esc(t('fc_lay_kname'))}" placeholder="${esc(t('fc_lay_kname'))}"><button type="button" class="chip">${esc(t('qt_create'))}</button>`;
  add.replaceWith(f); const n = f.querySelector('input'); n.focus();
  const go = () => {
    const l = n.value.trim(); if (!l) { fclDraw(); return; }
    const k = 'c_' + hex6(); FCL.d.keys[k] = { k, l: l.slice(0, 30), l0: l, own: true, hide: false, g0: gr.g, isNew: true, del: false }; gr.keys.push(k);
    FCL.focus = `.layg[data-g="${gr.g}"] .lka`; fclDraw(); fclSay(t('fc_lay_kadded', { k: l }));
  };
  f.querySelector('button').onclick = go;
  n.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fclDraw(); } };
}
function fclMoveKey(e, x) {                            // ←/→ innerhalb der Rubrik, ↑/↓ in die vorige/nächste Rubrik
  const d = FCL.d, gr = fclFind(x.k); if (!gr) return;
  const vis = gr.keys.filter(k => !d.keys[k].del), i = vis.indexOf(x.k);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault(); const j = i + (e.key === 'ArrowLeft' ? -1 : 1); if (j < 0 || j >= vis.length) return;
    const a = gr.keys.indexOf(x.k), b = gr.keys.indexOf(vis[j]); [gr.keys[a], gr.keys[b]] = [gr.keys[b], gr.keys[a]];
    fclSay(t('fc_lay_moved', { s: x.l, i: j + 1, n: vis.length }));
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    const gs = d.groups.filter(g => !g.del), gi = gs.indexOf(gr), ng = gs[gi + (e.key === 'ArrowUp' ? -1 : 1)]; if (!ng) return;
    gr.keys = gr.keys.filter(k => k !== x.k); ng.keys.splice(Math.min(i, ng.keys.length), 0, x.k);
    fclSay(t('fc_lay_moved_g', { k: x.l, g: ng.l }));
  } else return;
  FCL.focus = `.layk[data-k="${x.k}"] .lkn`; fclDraw();
}
function fclMoveGroup(e, gr) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return; e.preventDefault();
  const gs = FCL.d.groups, i = gs.indexOf(gr); let j = i;
  do { j += e.key === 'ArrowUp' ? -1 : 1; } while (gs[j] && gs[j].del);
  if (j < 0 || j >= gs.length) return;
  gs.splice(i, 1); gs.splice(j, 0, gr);
  const vis = gs.filter(g => !g.del); fclSay(t('fc_lay_moved', { s: gr.l, i: vis.indexOf(gr) + 1, n: vis.length }));
  FCL.focus = `.layg[data-g="${gr.g}"] .hd`; fclDraw();
}
function fclFromDom() {                                // nach dem Ziehen: Reihenfolge aus dem Bildschirm übernehmen
  const d = FCL.d, box = $('fnptags');
  const order = [...box.querySelectorAll('.layg')].map(r => r.dataset.g), pos = g => order.indexOf(g) < 0 ? 1e6 : order.indexOf(g);
  d.groups.sort((a, b) => pos(a.g) - pos(b.g));
  for (const r of box.querySelectorAll('.layg')) {
    const gr = d.groups.find(g => g.g === r.dataset.g), seen = [...r.querySelectorAll('.layk')].map(c => c.dataset.k);
    gr.keys = seen.concat(gr.keys.filter(k => d.keys[k].del && !seen.includes(k)));
  }
  const bs = [...$('caplaybar').querySelectorAll('.laysec')].map(b => b.dataset.sec); if (bs.length) d.secs = bs;
}
function fclPointer(e) {                               // Ziehen mit Maus, Stift oder Finger
  if (!FCL.on || e.button !== 0) return;
  const h = e.target.closest('[data-drag]'); if (!h) return;
  const kind = h.dataset.drag, item = kind === 'key' ? h.closest('.layk') : kind === 'grp' ? h.closest('.layg') : h;
  const x0 = e.clientX, y0 = e.clientY, doc = item.ownerDocument, win = doc.defaultView; let on = false;
  const move = ev => {
    if (!on) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; on = true; item.classList.add('dragging'); }
    ev.preventDefault();
    const u = doc.elementFromPoint(ev.clientX, ev.clientY); if (!u) return;
    if (kind === 'key') {
      const box = u.closest('.laykeys'); if (!box) return;
      const tg = u.closest('.layk');
      if (tg && tg !== item) { const r = tg.getBoundingClientRect(); box.insertBefore(item, ev.clientX > r.left + r.width / 2 ? tg.nextSibling : tg); }
      else if (!tg && item.parentNode !== box) box.insertBefore(item, box.querySelector('.lka, .lkform'));
    } else if (kind === 'grp') {
      const tg = u.closest('.layg'); if (tg && tg !== item) { const r = tg.getBoundingClientRect(); tg.parentNode.insertBefore(item, ev.clientY > r.top + r.height / 2 ? tg.nextSibling : tg); }
    } else {
      const tg = u.closest('.laysec'); if (tg && tg !== item) { const r = tg.getBoundingClientRect(); tg.parentNode.insertBefore(item, ev.clientX > r.left + r.width / 2 ? tg.nextSibling : tg); }
    }
  };
  const end = () => {
    win.removeEventListener('pointermove', move); win.removeEventListener('pointerup', end); win.removeEventListener('pointercancel', end);
    if (!on) return;
    item.classList.remove('dragging'); fclFromDom(); FCL.dragged = true; setTimeout(() => { FCL.dragged = false; }, 0);
    if (kind === 'sec') { secApply(FCL.d.secs); fclChips(); fclFb(); } else fclDraw();
  };
  win.addEventListener('pointermove', move, { passive: false }); win.addEventListener('pointerup', end); win.addEventListener('pointercancel', end);
}
async function fclSave() {
  const d = FCL.d, ops = [];
  fclFromDom(); fclViewTake();
  const dockV = d.views.dock, popV = d.views.pop, pk = fclVKey(popV);
  if (d.prof !== 'dock') fclViewPut('dock');            // Entwurf zurück auf angedockt: wie bisher in „cap“ speichern
  let popOut;                                           // undefined = unverändert, null = folgt angedockt, sonst eigene Ansicht
  if (fclFollows() && (pk === d.popSync || pk === fclVKey(dockV))) { if (CAPPOP) popOut = null; }
  else if (fclFollows() || pk !== d.pop0) { popOut = {}; for (const x of VIEW_K) popOut[x] = popV[x]; }
  const where = {}; for (const gr of d.groups) for (const k of gr.keys) where[k] = gr.g;
  for (const gr of d.groups) if (gr.isNew && !gr.del) ops.push({ action: 'gadd', g: gr.g, l: gr.l });
  for (const x of Object.values(d.keys)) {
    if (x.isNew) { if (!x.del) ops.push({ action: 'add', k: x.k, l: x.l, g: where[x.k] }); continue; }
    if (x.del) { ops.push({ action: 'del', k: x.k }); continue; }
    if (x.l !== x.l0) ops.push({ action: 'ren', k: x.k, l: !x.own && x.l === t('nt_' + x.k) ? '' : x.l });
    if (x.hide !== x.hide0 && !x.own) ops.push({ action: 'hide', k: x.k, on: x.hide });
    if (where[x.k] && where[x.k] !== x.g0) ops.push({ action: 'grp', k: x.k, g: where[x.k] });
  }
  for (const gr of d.groups) {
    if (gr.del) { if (!gr.isNew) ops.push({ action: 'gdel', g: gr.g }); continue; }
    if (gr.isNew) { if (gr.hide) ops.push({ action: 'ghide', g: gr.g, on: true }); if (gr.col) ops.push({ action: 'gcol', g: gr.g, c: gr.col }); if (gr.req) ops.push({ action: 'req', g: gr.g, on: true }); if (gr.one) ops.push({ action: 'gone', g: gr.g, on: true }); if (gr.h) ops.push({ action: 'ghelp', g: gr.g, h: gr.h }); continue; }
    if (gr.l !== gr.l0) ops.push({ action: 'gren', g: gr.g, l: gr.custom || gr.l !== t('fc_g_' + gr.g) ? gr.l : '' });
    if (gr.hide !== gr.hide0) ops.push({ action: 'ghide', g: gr.g, on: gr.hide });
    if (gr.req !== gr.req0) ops.push({ action: 'req', g: gr.g, on: gr.req });
    if (gr.one !== gr.one0) ops.push({ action: 'gone', g: gr.g, on: gr.one });
    if (gr.h !== gr.h0) ops.push({ action: 'ghelp', g: gr.g, h: gr.h });
    if (gr.col !== gr.col0) ops.push({ action: 'gcol', g: gr.g, c: gr.col });
  }
  const flat = fclFlat(d.groups).filter(k => !d.keys[k].del);
  if (flat.join() !== d.order0.split(',').filter(k => d.keys[k] && !d.keys[k].del).join()) ops.push({ action: 'order', keys: flat });
  const gs = d.groups.filter(g => !g.del).map(g => g.g); if (gs.join() !== d.gorder0) ops.push({ action: 'gorder', groups: gs });
  const tt = $('capttl').textContent.trim(), ts = $('fnpfrom').textContent.trim();
  const cap = { title: tt === $('capttl').dataset.def ? '' : tt.slice(0, 60), sub: ts === $('fnpfrom').dataset.def ? '' : ts.slice(0, 160), clock: d.clock, dense: d.dense, style: d.style };
  const secs = d.secs.filter(k => SEC_EL[k] || d.fb.blocks.some(b => b.id === k && !b.del));
  if (secs.join() !== d.secs0) cap.order = secs;
  const fbNew = Felder.strip(d.fb);
  if (JSON.stringify(fbNew) !== d.fb0) {                // eigene Felder; „zeigen“ der eingebauten Bereiche geht nach cap.hide
    const sec = JSON.parse(JSON.stringify(fbNew.sec)), keep = (CAP.hide || []).filter(x => !SEC_EL[x]);
    cap.hide = keep.concat(Object.keys(SEC_EL).filter(k => (sec[k] || {}).hide)); for (const k in sec) delete sec[k].hide;
    cap.blocks = fbNew.blocks; cap.sec = sec;
  }
  try {
    if (ops.length) {
      const j = await (await fetch('notetags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'batch', ops }) })).json();
      if (j.ok) ntsApply(j);
      if (j.errors && j.errors.length) toast(t('fc_lay_errs', { n: j.errors.length }) + (j.errors.some(x => x.error === 'limit') ? ' ' + t('qt_limit') : ''), 6000);
    }
    if (!(await capPost(cap))) throw new Error('cap');
    if (popOut !== undefined && !(await capPopPost(popOut))) throw new Error('cap_pop');
    toast('✓ ' + t('fc_lay_saved'));
    if (cap.blocks) fbLoad(true);
  } catch (x) { toast(t('saveerr')); return; }
  fclClose(); ntsRedraw();
}
async function fclReset() {
  if (!pwin().confirm(t('fc_lay_reset_q'))) return;
  try {
    const j = await (await fetch('notetags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset' }) })).json(); if (j.ok) ntsApply(j);
    if (!(await capPost(null))) throw new Error('cap');
  } catch (x) { toast(t('saveerr')); return; }
  CAPPOP = null;                                        // Standard: abgedockt folgt wieder (Server: reset „cap“)
  const prof = FCL.d ? FCL.d.prof : 'dock'; fclBuild(prof); secApply(FCL.d.secs); fclLook();
  for (const id of ['capttl', 'fnpfrom']) $(id).textContent = $(id).dataset.def;
  fclBar(); fclDraw(); fclSay(t('fc_lay_reset_done')); ntsRedraw();
}
function fclInit() {
  $('caplay').onclick = () => FCL.on ? fclClose() : fclOpen();
  $('fnpanel').addEventListener('pointerdown', fclPointer);
}
/* ================= Profile: aufnehmen (Ruhepegel, dann jeder Ausschlag je Gerät), verwalten, neu untersuchen ================= */
const PF = { list: [], timer: 0, st: null, skip: new Set() };
async function pfLoad() {
  try { const j = await (await fetch('profiles', { cache: 'no-store' })).json(); PF.list = j.profiles || []; PF.st = j.teach; PF.scan = j.scan; } catch (e) { }
  pfRender(); pfTeachRender(); scanRender();
}
function pfScanRange() {                             // Zeitraum: im Reiter Protokolle der gewählte, sonst heute
  if (NV.open) {
    const r = perRange();
    if (r) return [new Date(r[0]).getTime(), new Date(r[1]).getTime()];
    const d = NV.data; if (d && d.start) return [new Date(d.start).getTime(), new Date(d.end).getTime()];
  }
  const a = parseDay(isoDay(new Date(nowServer()))).getTime(); return [a, a + 86400000];
}
function pfOpen(sec) {
  pfLoad();
  const [a, b] = pfScanRange(); $('scanper').textContent = t('scan_per', { r: dtRangeTxt({ from: a, to: b }) });
  const dv = $('pfdevs'); dv.innerHTML = '';
  dv.appendChild(el('span', { className: 'caldl', textContent: t('cal_devs') }));
  SOURCES.forEach(x => { const l = el('label', { className: 'chip' }), c = el('input', { type: 'checkbox', checked: true }); c.dataset.id = x.id; l.append(c, document.createTextNode(' ' + x.name)); dv.appendChild(l); });
  if (!$('profdlg').open) $('profdlg').showModal();
  if (sec === 'teach') setTimeout(() => $('pfname').focus(), 60);
  if (sec === 'scan') setTimeout(() => $('pfscan').scrollIntoView({ block: 'start' }), 60);
  if (sec === 'list') setTimeout(() => $('pflist').scrollIntoView({ block: 'start' }), 60);
}
function pfRender() {
  { const sel = $('scanname'), cur = sel.value; sel.innerHTML = ''; option(sel, '', t('scan_all')); PF.list.forEach(p => option(sel, p.name, p.name)); sel.value = PF.list.some(p => p.name === cur) ? cur : ''; }
  $('pfnames').innerHTML = PF.list.map(p => `<option value="${esc(p.name)}">`).join('');
  const nm = id => viewName(id);
  $('pflist').innerHTML = PF.list.length ? PF.list.map((p, i) => `<div class="pfitem${p.bg ? ' bg' : ''}" data-i="${i}">
      <b class="pfn">🧩 ${esc(p.name)}</b>
      <span class="pfc">${esc(t('pf_n', { n: p.n }))}${Object.keys(p.dev).length ? ' · ' + Object.entries(p.dev).map(([k, v]) => esc(nm(k)) + ' ' + v).join(' · ') : ''}${p.lb ? ' · 🏷 ' + p.lb : ''}</span>
      <label class="chip pfbg" title="${esc(t('pf_bg_tip'))}"><input type="checkbox" class="pfbgc"${p.bg ? ' checked' : ''}> ${esc(t('pf_bg'))}</label>
      <button type="button" class="chip pfmore">＋</button><button type="button" class="chip pfren">✎</button><button type="button" class="chip danger pfdel">🗑</button></div>`).join('')
    : `<div class="ntnone">${esc(t('pf_none'))}</div>`;
  $('pflist').querySelectorAll('.pfitem').forEach(it => {
    const p = PF.list[+it.dataset.i];
    it.querySelector('.pfbgc').onchange = e => pfPost({ action: 'bg', name: p.name, on: e.target.checked });
    it.querySelector('.pfmore').onclick = () => { $('pfname').value = p.name; $('pfname').focus(); $('pfteach').scrollIntoView({ block: 'start' }); };
    it.querySelector('.pfren').onclick = () => { const to = prompt(t('pf_ren_q'), p.name); if (to && to.trim() && to.trim() !== p.name) pfPost({ action: 'rename', name: p.name, to: to.trim() }); };
    it.querySelector('.pfdel').onclick = () => { if (confirm(t('pf_del_q', { n: p.name }))) pfPost({ action: 'delete', name: p.name }); };
  });
}
async function pfPost(body) {
  try { const r = await (await fetch('profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    if (r.profiles) PF.list = r.profiles; pfRender(); EVSIG = ''; if (NV.open) loadEvents(); } catch (e) { alert(t('saveerr')); }
}
function pfTeachRender() {
  const st = PF.st || { state: 'idle' }, box = $('pfstate'), act = $('pfact'), res = $('pfres');
  const run = st.state === 'quiet' || st.state === 'armed', done = st.state === 'done';
  $('pfstart').hidden = run || done; $('pfdevs').hidden = run || done; box.hidden = !(run || done); act.hidden = !(run || done);
  $('pfstop').hidden = !run;
  if (!(run || done)) { res.innerHTML = ''; return; }
  const n = (st.groups || []).length;
  box.className = 'pfstate calst run' + (st.state === 'armed' ? ' go' : '');
  box.textContent = st.state === 'quiet' ? t('pf_quiet', { s: Math.max(0, Math.ceil((st.q1 - st.now) / 1000)) })
    : st.state === 'armed' ? t('pf_armed', { n, s: st.left_s }) : t('pf_done', { n });
  if (done) box.className = 'pfstate calst';
  const nm = id => (st.names || {})[id] || id;
  if (n) tabGrid(res, `<div class="pfscroll"><table class="caltab"><thead><tr><th></th><th>#</th><th>${esc(t('start'))}</th>${(st.ids || []).map(id => `<th>${esc(nm(id))}</th>`).join('')}</tr></thead><tbody>` +
    st.groups.map((g, i) => `<tr><td><input type="checkbox" class="pfsk" data-i="${i}"${PF.skip.has(i) ? '' : ' checked'}></td><td>${i + 1}</td><td>${esc(g.at)}</td>${(st.ids || []).map(id => { const d = g.dev[id];
      return `<td>${d ? '✓ ' + esc(t('pf_heard', { d: (d.over >= 0 ? '+' : '') + d.over.toFixed(0) })) : '<span class="noclip">' + esc(t('pf_not_heard')) + '</span>'}</td>`; }).join('')}</tr>`).join('') + '</tbody></table></div>'); else res.innerHTML = '';
  res.onchange = e => { const c = e.target.closest && e.target.closest('.pfsk'); if (c) { const i = +c.dataset.i; c.checked ? PF.skip.delete(i) : PF.skip.add(i); } };
  $('pfok').disabled = !n;
  clearTimeout(PF.timer); if (run && $('profdlg').open) PF.timer = setTimeout(pfTeachPoll, 500);
}
async function pfTeachPoll() { try { PF.st = await (await fetch('teach_status', { cache: 'no-store' })).json(); } catch (e) { } pfTeachRender(); }
async function pfTeach(action) {
  const body = { action };
  if (action === 'start') { body.name = $('pfname').value.trim(); if (!body.name) { $('pfname').focus(); return; } body.ids = [...$('pfdevs').querySelectorAll('input:checked')].map(c => c.dataset.id); PF.skip = new Set(); }
  if (action === 'finish') body.skip = [...PF.skip];
  try {
    const r = await (await fetch('teach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    if (action === 'stop') PF.st = r;
    else if (action === 'start' && !r.ok) { alert(t(r.error === 'busy' ? 'pf_busy' : 'saveerr')); }
    else if (action === 'finish' || action === 'cancel') { PF.st = { state: 'idle' }; if (r.profiles) PF.list = r.profiles; if (action === 'finish') $('pfstate').hidden = false;
      if (action === 'finish' && r.ok) { pfRender(); pfTeachRender(); const b = $('pfres'); b.innerHTML = `<div class="calst">✓ ${esc(t('pf_saved', { n: r.n }))}</div>`; return; } }
  } catch (e) { alert(t('saveerr')); }
  if (action === 'start') await pfTeachPoll(); else { pfRender(); pfTeachRender(); }
}
function scanRender() {
  const sc = PF.scan || { state: 'idle' }, st = $('scanst');
  $('scango').disabled = sc.state === 'running'; $('scanstop').hidden = sc.state !== 'running';
  st.className = 'calst' + (sc.state === 'running' ? ' run' : '');
  st.textContent = sc.state === 'running' ? t('scan_run', { p: sc.total ? Math.round(100 * sc.done / sc.total) : 0, e: sc.events || 0, a: sc.areas || 0 })
    : sc.state === 'done' ? (sc.msg === 'no_profiles' ? t('scan_noprof') : /^error/.test(sc.msg || '') ? t('saveerr') + ' ' + sc.msg : '✓ ' + t('scan_done', { e: sc.events || 0, a: sc.areas || 0 })) : '';
  clearTimeout(PF.stimer);
  if (sc.state === 'running') PF.stimer = setTimeout(async () => { try { PF.scan = await (await fetch('scan_status', { cache: 'no-store' })).json(); } catch (e) { } scanRender();
    if (PF.scan && PF.scan.state === 'done') { EVSIG = ''; if (NV.open) { loadEvents(); dtLoad(DT, true); } } }, 800);
}
async function scanGo() {
  const [a, b] = pfScanRange();
  try { const r = await (await fetch('scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: a, to: b, name: $('scanname').value, events: $('scanev').checked, areas: $('scanar').checked }) })).json();
    if (!r.ok) { alert(t(r.error === 'busy' ? 'pf_busy' : 'saveerr')); return; } PF.scan = { state: 'running', done: 0, total: 1 }; scanRender(); } catch (e) { alert(t('saveerr')); }
}
function initProf() {
  if (!$('profdlg')) return;
  $('pfx').onclick = () => $('profdlg').close();
  $('pfopen').onclick = () => pfOpen('teach');
  if ($('scanopen')) $('scanopen').onclick = () => pfOpen('scan');
  $('pfgo').onclick = () => pfTeach('start');
  $('pfname').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); pfTeach('start'); } };
  $('pfstop').onclick = () => pfTeach('stop');
  $('pfok').onclick = () => pfTeach('finish');
  $('pfdrop').onclick = () => { if (confirm(t('pf_drop_q'))) pfTeach('cancel'); };
  $('scango').onclick = scanGo;
  if ($('scannt')) $('scannt').onclick = async () => {               // ab 1.85.27: aus Notizen lernen, dann rückwirkend alles neu untersuchen
    try { const r = await (await fetch('scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"notes"}' })).json();
      $('scanst').textContent = r.ok ? t('scan_nt_done', { n: r.n, k: (r.kinds || []).join(', ') || '–' }) : t('saveerr');
      if (r.scan && r.scan.ok) { PF.scan = { state: 'running', done: 0, total: 1 }; setTimeout(scanRender, 1500); } else if (r.scan && r.scan.error === 'busy') alert(t('pf_busy'));
      pfLoad(); } catch (e) { alert(t('saveerr')); }
  };
  $('scanstop').onclick = async () => { try { await fetch('scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"cancel"}' }); } catch (e) { } };
}
function initEvView() {
  const box = $('evview'); if (!box) return;
  const sync = () => box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === EVVIEW));
  box.querySelectorAll('button').forEach(b => b.onclick = () => { EVVIEW = b.dataset.v; try { localStorage.setItem('laerm_evview', EVVIEW); } catch (e) { } sync(); EVSIG = ''; renderEvents(); });
  sync();
}
function initFn() {
  initFnp(); initEvView(); initProf(); ntsLoad(); fbLoad();
  $('fnx').onclick = $('fncancel').onclick = () => $('fndlg').close();
  enterSave($('fntext'), () => fnSave());
  $('fnsave').onclick = () => fnSave(false); $('fndel').onclick = () => fnSave(true);
  $('fnfnow').onclick = () => { $('fnfrom').value = dtl(new Date(nowServer())); };
  $('fntnow').onclick = () => { $('fnto').value = dtl(new Date(nowServer())); };
  $('fntclr').onclick = () => { $('fnto').value = ''; };
  fnRefresh(); setInterval(() => { if (!document.hidden && !NV.open) fnRefresh(); }, 15000);
}
/* ================= Musterfilter: bekannte, wiederkehrende Geräusche ausfiltern – nur in der Anzeige =================
   Ein Muster = Regel aus Gerät, Art/Tonprofil, Uhrzeit, Wochentagen, Dauer, Spitze, Abstand zur Schwelle, Wiederholung, Sensor aus Home Assistant.
   Gefilterte fehlen in Listen, Zählern, Kacheln und Grafiken (Schalter „ausgefilterte zeigen“ holt sie gekennzeichnet zurück).
   Nichts wird gelöscht: log.csv, Tagesaufzeichnung und Prüfsummen bleiben unverändert. Ein Muster frei, mehrere mit Pro. */
const MF = { list: [], pro: false, free: 1, rules: [], profiles: [], show: false };
try { MF.show = localStorage.getItem('gl_mf_show') === '1'; } catch (e) { }
async function mfLoad() {
  try { const j = await (await fetch('muster', { cache: 'no-store' })).json(); if (j.ok) Object.assign(MF, { list: j.list || [], pro: !!j.pro, free: j.free || 1, rules: j.rules || [], profiles: j.profiles || [] }); } catch (e) { }
  for (const v of Object.keys(DASH.grids)) dashBar(v);
  mfRenderBox();
}
const mfInfo = id => MF.list.find(m => m.id === id) || { name: id, color: '#868e96' };
const mfHide = r => !MF.show && !!(r && r.mf && r.mf.length);
const mfChip = r => r && r.mf && r.mf.length ? r.mf.map(id => { const m = mfInfo(id); return `<span class="art mfc" style="--mfc:${esc(m.color)}" title="${esc(t('mf_tip'))}">⊘ ${esc(m.name)}</span>`; }).join('') : '';
function mfCountTxt(list) { const n = (list || []).filter(r => r.mf && r.mf.length && r.lead !== false).length; return n ? ' ' + t('mf_n', { n }) : ''; }
function mfToggle() {
  MF.show = !MF.show; try { localStorage.setItem('gl_mf_show', MF.show ? '1' : '0'); } catch (e) { }
  for (const v of Object.keys(DASH.grids)) dashBar(v);
  EVSIG = ''; renderEvents(); LEV.sig = ''; levRender(); if (NV.open && NV.data) { renderNight(); drawNight(); } statRefresh();
}
function mfWd(wd) { const L = lang === 'en' ? 'en-GB' : 'de-DE'; return (wd || []).map(i => new Date(2024, 0, 1 + i).toLocaleDateString(L, { weekday: 'short' })).join(', '); }
function mfSummary(m) {
  const a = [];
  if (m.dev) a.push(viewName(m.dev));
  if (m.art) a.push(m.art === 'bg' ? t('mf_bg') : m.art.startsWith('p:') ? '🧩 ' + m.art.slice(2) : artName(m.art));
  if (m.t_from) a.push(m.t_from + '–' + m.t_to);
  if (m.wd && m.wd.length) a.push(mfWd(m.wd));
  if (m.rep_every) a.push(t('mf_rep_s', { e: m.rep_every, o: m.rep_off || 0, tol: m.rep_tol }));
  if (m.dur_min != null || m.dur_max != null) a.push(t('mf_dur_s', { a: m.dur_min ?? '0', b: m.dur_max ?? '∞' }));
  if (m.pk_min != null || m.pk_max != null) a.push(t('mf_pk_s', { a: m.pk_min ?? '…', b: m.pk_max ?? '…' }));
  if (m.over_min != null || m.over_max != null) a.push(t('mf_ov_s', { a: m.over_min ?? '…', b: m.over_max ?? '…' }));
  if (m.ha) { const r = MF.rules.find(x => x.id === m.ha); a.push('📡 ' + (r ? r.name : m.ha)); }
  return a.join(' · ') || t('mf_all');
}
/* Abschnitt in den Einstellungen (Reiter Erkennung) */
function musterBox() {
  const fs = el('fieldset', { id: 'mfbox', className: 'ff' }); fs.dataset.sec = 's_muster';
  fs.appendChild(el('legend', { textContent: t('s_muster') }));
  fs.appendChild(el('div', { className: 'mfbody' }));
  setTimeout(mfRenderBox, 0);
  return fs;
}
function mfRenderBox() {
  const b = document.querySelector('#mfbox .mfbody'); if (!b) return;
  b.innerHTML = `<p class="mut">${esc(t('h_muster'))}</p>
    <div class="mflist">${MF.list.length ? MF.list.map(m => `<div class="mfrow${m.active ? '' : ' off'}" data-id="${esc(m.id)}"><i class="mfdot" style="background:${esc(m.color)}"></i>
      <label class="mfon"><input type="checkbox"${m.on ? ' checked' : ''} aria-label="${esc(t('mf_on') + ': ' + m.name)}"></label><b>${esc(m.name)}</b><small class="mut">${esc(mfSummary(m))}${m.on && !m.active ? ' · ' + esc(t('mf_pro_only')) : ''}</small>
      <span class="sthsp"></span><button type="button" class="chip mfed">✎ ${esc(t('mf_edit'))}</button><button type="button" class="chip danger mfdel" aria-label="${esc(t('st_del') + ': ' + m.name)}">🗑</button></div>`).join('') : `<div class="ntnone">${esc(t('mf_none'))}</div>`}</div>
    <button type="button" class="chip mfadd">＋ ${esc(t('mf_add'))}</button>${!MF.pro && MF.list.length >= MF.free ? ' <small class="mut">' + esc(t('mf_free_n', { n: MF.free })) + '</small>' : ''}`;
  b.querySelectorAll('.mfrow').forEach(r => { const m = MF.list.find(x => x.id === r.dataset.id);
    r.querySelector('.mfon input').onchange = e => mfPost({ action: 'on', id: m.id, on: e.target.checked });
    r.querySelector('.mfed').onclick = () => mfEdit(m);
    r.querySelector('.mfdel').onclick = () => { if (confirm(t('mf_del_q', { n: m.name }))) mfPost({ action: 'del', id: m.id }); }; });
  const ad = b.querySelector('.mfadd'); ad.onclick = () => mfNew();
  if (!MF.pro && MF.list.length >= MF.free) ad.appendChild(proLockTag());
}
function mfNew(pre) { if (!MF.pro && MF.list.length >= MF.free) { proGate('muster'); return; } mfEdit(Object.assign({ name: '', color: '#868e96', on: true, wd: [], rep_tol: 2 }, pre || {}), true); }
async function mfPost(body) {
  try { const j = await (await fetch('muster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    if (!j.ok) { alert(t(j.error === 'pro' ? 'mf_need_pro' : j.error === 'limit' ? 'mf_limit' : 'saveerr')); return false; }
    Object.assign(MF, { list: j.list || [], pro: !!j.pro }); mfRenderBox(); for (const v of Object.keys(DASH.grids)) dashBar(v);
    EVSIG = ''; loadEvents(); if (NV.open) loadNight(); LEV.key = ''; levLoad(true); statRefresh(); return true;
  } catch (e) { alert(t('saveerr')); return false; }
}
/* Aus einer Störung: Kriterien vorbelegen (Gerät, Art, Uhrzeit ± 15 Min., Dauer und Spitze ungefähr) */
function mfFromEvent(r) {
  if (!r) return;
  const d = new Date(r.start), mm = d.getHours() * 60 + d.getMinutes(), hm = x => pad(Math.floor(((x + 1440) % 1440) / 60)) + ':' + pad((x + 1440) % 60);
  const dur = +r.dauer_s || 0, pk = r.spitze_dbfs != null ? +r.spitze_dbfs : null;
  const kind = r.prof ? 'p:' + r.prof : r.art || '';
  mfNew({ name: (r.prof || (r.art ? artName(r.art) : t('mf_def_name'))) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()), dev: r.quelle_id || 'main', art: (r.bg || r.inc_bg) ? 'bg' : kind,
    t_from: hm(mm - 15), t_to: hm(mm + 15), dur_min: Math.max(0, Math.floor(dur * 0.5)), dur_max: Math.ceil(dur * 1.5 + 1),
    pk_min: pk != null ? Math.floor(pk - 6) : null, pk_max: pk != null ? Math.ceil(pk + 6) : null });
}
function mfEdit(m0, isNew) {
  let dlg = $('mfdlg'); if (!dlg) { dlg = el('dialog', { id: 'mfdlg', className: 'stdlg mfdlg' }); document.body.appendChild(dlg); }
  const m = Object.assign({ wd: [] }, m0);
  const v = x => x == null ? '' : esc(x);
  const arts = [['', t('st_any')], ['bg', t('mf_bg')]].concat(ART_ORDER.map(a => [a, (ART_ICON[a] || '') + ' ' + artName(a)]), MF.profiles.map(p => ['p:' + p, '🧩 ' + p]));
  const devs = [['', t('all_sources')]].concat(SOURCES.map(x => [x.id, x.name]));
  const rules = [['', t('mf_ha_none')]].concat(MF.rules.map(r => [r.id, r.name]));
  const sel = (k, list) => `<select data-f="${k}">${list.map(([a, l]) => `<option value="${esc(a)}"${String(m[k] || '') === String(a) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const num = (k, ph, st) => `<input type="number" data-f="${k}" step="${st || 1}" value="${v(m[k])}" placeholder="${esc(ph || '')}">`;
  dlg.innerHTML = `<div class="sthead"><h3 id="mfh">⊘ ${esc(t(isNew ? 'mf_new' : 'mf_edit'))}</h3><button type="button" class="chip stx" aria-label="${esc(t('a_close'))}">✕</button></div>
    <p class="mut">${esc(t('h_muster_edit'))}</p>
    <fieldset class="stform">
      <label>${esc(t('st_f_name'))}<input type="text" data-f="name" maxlength="60" value="${v(m.name)}" placeholder="${esc(t('mf_name_ph'))}"></label>
      <label>${esc(t('mf_color'))}<input type="color" data-f="color" value="${v(m.color || '#868e96')}"></label>
      <label>${esc(t('st_f_dev'))}${sel('dev', devs)}</label>
      <label>${esc(t('st_f_art'))}${sel('art', arts)}</label>
      <label>${esc(t('mf_from'))}<input type="time" data-f="t_from" value="${v(m.t_from)}"></label>
      <label>${esc(t('mf_to'))}<input type="time" data-f="t_to" value="${v(m.t_to)}"></label>
      <div class="stchk mfwd" role="group" aria-label="${esc(t('mf_wd'))}"><span class="mut">${esc(t('mf_wd'))}:</span>${[0, 1, 2, 3, 4, 5, 6].map(i => `<label><input type="checkbox" data-wd="${i}"${(m.wd || []).includes(i) ? ' checked' : ''}> ${esc(mfWd([i]))}</label>`).join('')}</div>
      <label>${esc(t('mf_dur_min'))}${num('dur_min', t('st_off_ph'))}</label><label>${esc(t('mf_dur_max'))}${num('dur_max', t('st_off_ph'))}</label>
      <label>${esc(t('mf_pk_min'))}${num('pk_min', t('st_off_ph'))}</label><label>${esc(t('mf_pk_max'))}${num('pk_max', t('st_off_ph'))}</label>
      <label>${esc(t('mf_ov_min'))}${num('over_min', t('st_off_ph'))}</label><label>${esc(t('mf_ov_max'))}${num('over_max', t('st_off_ph'))}</label>
      <label>${esc(t('mf_rep'))}${num('rep_every', t('st_off_ph'))}</label><label>${esc(t('mf_rep_off'))}${num('rep_off', '0')}</label><label>${esc(t('mf_rep_tol'))}${num('rep_tol', '2')}</label>
      <label>${esc(t('mf_ha'))}${sel('ha', rules)}</label>
    </fieldset>
    <div class="stprev mfprev" role="status" aria-live="polite"></div>
    <div class="stbtns"><span class="sthsp"></span><span class="stmsg"></span><button type="button" class="chip stcancel">${esc(t('cancel'))}</button><button type="button" class="pri stok">${esc(t('save'))}</button></div>`;
  dlg.setAttribute('aria-labelledby', 'mfh');
  const read = () => { const o = {}; dlg.querySelectorAll('[data-f]').forEach(x => { o[x.dataset.f] = x.value; }); o.wd = [...dlg.querySelectorAll('[data-wd]:checked')].map(x => +x.dataset.wd); o.on = m.on !== false; return o; };
  let pt = 0;
  const prev = () => { clearTimeout(pt); pt = setTimeout(async () => { const box = dlg.querySelector('.mfprev'); box.textContent = t('mf_prev_wait');
    try { const j = await (await fetch('muster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preview', def: read() }) })).json();
      const L = locale(); box.innerHTML = `<b>${esc(t('mf_prev', { n: j.n, of: j.of, d: j.days }))}</b>` + ((j.examples || []).length ? `<ul class="mfex">${j.examples.map(x => `<li>${esc(new Date(x.start).toLocaleString(L, { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))} · ${esc(x.dev || '')} · ${esc(fmtDur(x.dur || 0))}${x.pk != null ? ' · ' + esc(fdb(x.pk)) + ' dBFS' : ''}</li>`).join('')}</ul>` : '');
    } catch (e) { box.textContent = t('saveerr'); } }, 300); };
  dlg.querySelectorAll('input,select').forEach(x => { x.oninput = x.onchange = prev; });
  dlg.querySelector('.stx').onclick = dlg.querySelector('.stcancel').onclick = () => dlg.close();
  dlg.querySelector('.stok').onclick = async () => { if (await mfPost(isNew ? { action: 'add', def: read() } : { action: 'edit', id: m.id, def: read() })) dlg.close(); };
  prev(); if (!dlg.open) dlg.showModal();
  setTimeout(() => { const f = dlg.querySelector('[data-f=name]'); if (f) f.focus(); }, 50);
}
/* ================= Geräuschart bestätigen oder korrigieren (eigene Bestätigung, die Einordnung der KI bleibt gespeichert) ================= */
function evByK(k) { const all = [].concat((EV && EV.events) || [], (LEV.data && LEV.data.events) || []); return all.find(r => r.k === k) || null; }
function artConfirmPop(r, x, y) {
  if (!r) return;
  let p = $('artcpop'); if (!p) { p = el('div', { id: 'artcpop', className: 'rowmenu artcpop' }); p.setAttribute('role', 'menu'); document.body.appendChild(p); }
  const cur = r.art || '';
  p.innerHTML = `<div class="artch">${esc(t('ac_title'))}${cur ? ': ' + artChip(cur, r.art_c, r.art_man || r.art_ok) : ''}</div>` +
    (cur && !r.art_ok ? `<button type="button" role="menuitem" data-g=""><i class="mi">✓</i><span>${esc(t('ac_ok', { a: artName(cur) }))}</span></button>` : '') +
    ART_ORDER.filter(g => g !== cur).map(g => `<button type="button" role="menuitem" data-g="${g}"><i class="mi">${ART_ICON[g] || ''}</i><span>${esc(t('ac_set', { a: artName(g) }))}</span></button>`).join('') +
    (r.art_ok ? `<button type="button" role="menuitem" data-undo="1"><i class="mi">↺</i><span>${esc(t('ac_undo'))}</span></button>` : '') +
    `<small class="mut artcn">${esc(t('ac_note'))}</small>`;
  p.style.display = 'block'; p.style.position = 'fixed';
  p.style.left = Math.max(8, Math.min(x, innerWidth - p.offsetWidth - 8)) + 'px'; p.style.top = Math.max(8, Math.min(y, innerHeight - p.offsetHeight - 8)) + 'px';
  const close = () => { p.style.display = 'none'; document.removeEventListener('pointerdown', out, true); };
  const out = e => { if (!p.contains(e.target)) close(); };
  setTimeout(() => document.addEventListener('pointerdown', out, true), 0);
  p.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  p.querySelectorAll('button').forEach(b => b.onclick = async () => { close();
    try { const j = await (await fetch('art_confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: r.k, group: b.dataset.g || '', undo: !!b.dataset.undo }) })).json();
      if (!j.ok) throw new Error(j.error || 'error'); toast('✓ ' + t('ac_saved')); EVSIG = ''; loadEvents(); LEV.key = ''; levLoad(true); } catch (e) { alert(t('saveerr') + ' ' + e.message); } });
  const f = p.querySelector('button'); if (f) f.focus();
}
/* ================= Kurze Hinweise (aus der Rechtsrecherche, Quicktipps 9–15): einzeln wegklickbar, gesamt über „💡 Hilfe anzeigen“ ================= */
const QT_SRC = { 9: 'AG Wolfratshausen 5 C 274/20', 10: 'LG Berlin II 56 S 100/23 WEG', 11: 'BGH VIII ZR 1/16 Rn. 14; § 238 Abs. 2 StGB', 12: 'AG München 472 C 18927/16; OLG Celle 4 U 199/09',
  13: '§ 371 ZPO; Irskens, EDVGT 2024', 14: 'BGH VI ZR 1370/20; BVerfG 1 BvR 1611/96; AG München 173 C 11834/23', 15: 'AG München 173 C 11834/23' };
function qtMode() { return (CUR && CUR.tip_mode) || 'hover'; }
function qtOn() { if (qtMode() === 'off') return false; try { return localStorage.getItem('laerm_help') !== '0'; } catch (e) { return true; } }
function qtModeApply() { for (const doc of [document, popDoc()]) if (doc && doc.body) doc.body.classList.toggle('qthover', qtMode() === 'hover'); qtRefresh(); }   // auch im abgedockten Fenster
function qtHidden() { try { return new Set(JSON.parse(localStorage.getItem('gl_qt_hide') || '[]')); } catch (e) { return new Set(); } }
function qtCard(n) {                                 // Hinweis Nr. n als Element (leer, wenn ausgeblendet)
  const box = el('div', { className: 'qtip' }); box.dataset.qt = n;
  const fill = () => {
    box.hidden = !qtOn() || qtHidden().has(n); if (box.hidden) { box.innerHTML = ''; return; }
    box.innerHTML = `<button type="button" class="qti" aria-expanded="false" aria-label="${esc(t('qt_show'))}" title="${esc(t('qt_' + n))}">💡</button><div class="qtb"><span class="qtt">${esc(t('qt_' + n))}</span><details class="qtw"><summary>${esc(t('qt_why'))}</summary><small>${esc(t('qt_src', { s: QT_SRC[n] }))}</small></details><button type="button" class="qtx" aria-label="${esc(t('qt_hide'))}" title="${esc(t('qt_hide'))}">✕</button></div>`;
    const qb = box.querySelector('.qti'); const side = () => { const r = qb.getBoundingClientRect(), w = qb.ownerDocument.defaultView || window; box.classList.toggle('r', r.left > w.innerWidth / 2); box.classList.toggle('u', r.top > w.innerHeight * 0.6); }; qb.onmouseenter = side; qb.onfocus = side;
    qb.onclick = () => { side(); const o = box.classList.toggle('open'); qb.setAttribute('aria-expanded', String(o)); };
    box.querySelector('.qtx').onclick = () => { const h = qtHidden(); h.add(n); try { localStorage.setItem('gl_qt_hide', JSON.stringify([...h])); } catch (e) { } box.hidden = true; box.innerHTML = ''; const d_ = box.parentElement; if (d_ && d_.classList.contains('qtdock')) qtMerge(d_); };
  };
  box._fill = () => { fill(); const d = box.parentElement; if (d && d.classList.contains('qtdock')) qtMerge(d); }; fill(); setTimeout(() => qtDock(box), 0); return box;
}
/* 💡 immer rechts, senkrecht mittig am zugehörigen Block (dem Element, in das der Hinweis gesetzt wurde); mehrere übereinander */
function qtDock(box) {
  const a = box.parentElement; if (!a || a.classList.contains('qtdock')) return;
  const hd = (qtMode() === 'hover' && a.matches('.pevcard, #ldevcard, .pnlbd') && a.closest('.pnl')) ? a.closest('.pnl').querySelector(':scope > .pnlhd') : null;   // ab 1.85.2: Tabellen/Graph – 💡 in die Kopfzeile, keine leere Spalte rechts
  if (hd) { let d = hd.querySelector(':scope > .qtdock'); if (!d) { d = el('div', { className: 'qtdock qthead' }); const x = hd.querySelector('.pnlx'); x ? x.after(d) : hd.appendChild(d); } d.appendChild(box); qtMerge(d); return; }
  let d = a.querySelector(':scope > .qtdock'); if (!d) { d = el('div', { className: 'qtdock' }); a.appendChild(d); }
  a.classList.add('qtanchor'); d.appendChild(box); qtMerge(d);
}
/* Mehrere Hinweise an einem Block (1.84.4): nur eine 💡, ihre Blase zeigt alle (jeder einzeln wegklickbar) */
function qtMerge(d) {
  const tips = [...d.querySelectorAll(':scope > .qtip')].filter(x => !x.hidden && x.querySelector('.qtb'));
  d.classList.toggle('qtmulti', tips.length > 1);
  tips.forEach((x, i) => x.classList.toggle('qtsub', i > 0));
  if (tips.length > 1) {
    const main = tips[0], mb = main.querySelector('.qtb');
    mb.querySelectorAll(':scope > .qtmore').forEach(e => e.remove());
    for (const x of tips.slice(1)) { const c = el('div', { className: 'qtmore' }); c.innerHTML = x.querySelector('.qtb').innerHTML; const xb = c.querySelector('.qtx'); if (xb) xb.onclick = () => { x.querySelector('.qtx').click(); qtMerge(d); }; mb.appendChild(c); }
  }
}
function qtRefresh() { for (const doc of [document, popDoc()]) if (doc) doc.querySelectorAll('.qtip').forEach(b => b._fill && b._fill()); }
function qtPlace() {                                  // feste Stellen: Ereignislisten (10), Live (11), Lärmprotokoll-Dialog (12, 13)
  const put = (sel, n, where) => { const t0 = document.querySelector(sel); if (!t0 || t0.querySelector(`.qtip[data-qt="${n}"]`)) return; const c = qtCard(n); where === 'prepend' ? t0.prepend(c) : t0.appendChild(c); };
  put('#nightview .pevcard', 10, 'prepend'); put('#ldevcard', 10, 'prepend');
  const gp = document.querySelector('.pnl[data-p="graph"] > .pnlbd'); if (gp && !gp.querySelector('.qtip[data-qt="11"]')) gp.appendChild(qtCard(11));   // Live-Tipp am Graphen (eigener Bereich)
  const pr = $('ntaproto'); if (pr && pr.parentElement && !pr.parentElement.querySelector('.qtip')) { pr.parentElement.after(qtCard(12), qtCard(13)); }
}
/* Sperre des Datenordners: läuft schon ein anderer GLighter (normal oder Beta) mit demselben Ordner, nimmt diese App nicht auf */
async function lockPoll() {
  let j = null; try { j = await (await fetch('lockstate', { cache: 'no-store' })).json(); } catch (e) { }
  let ov = document.getElementById('lockov');
  if (j && j.blocked) {
    if (!ov) pickLang((typeof CUR !== 'undefined' && CUR && CUR.language) || 'auto');   // gesperrt: Einstellungen sind nicht abrufbar – Sprache vom Browser
    if (!ov) { ov = el('div', { id: 'lockov', className: 'lockov' }); document.body.appendChild(ov); }
    ov.innerHTML = `<div class="lockbox"><h2>⛔ ${esc(t('lock_title'))}</h2><p>${esc(t('lock_text', { a: j.blocked, d: j.dir || '' }))}</p><p class="mut">${esc(t('lock_how'))}</p></div>`;
    setTimeout(lockPoll, 5000);
  } else if (ov) { ov.remove(); location.reload(); }
  else if (!j) setTimeout(lockPoll, 5000);
}
lockPoll();
init();
})();
