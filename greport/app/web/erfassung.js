'use strict';
/* Erfassung („Notiz jetzt“) – gemeinsame Oberfläche von GReport und GLighter. GReport ist die Quelle: geändert wird nur hier
   (greport/app/web/erfassung.js), tools/sync_shared.py kopiert die Datei unverändert nach GLighter.
   Schnellwahl je Rubrik mit leerer „+“-Pille, Rubrik „Zeitpunkt“, Notiz-Arten, Pflicht-Rubriken, von selbst speichern,
   eigene Felder (felder.js), Abschnitte ● / ○, zwei Ansichten (angedockt / abgedockt) und „Layout anpassen“ direkt auf dem Bildschirm.
   Was je App verschieden ist (Speicherort von Layout und Notiz, Texte, Meldungen, Zusätze), gibt die App über Erfassung.setup() mit. */
window.Erfassung = (() => {
  /* ---------- Anbindung an die App (Adapter) ----------
     name        Name der App (Titel des abgedockten Fensters)
     t, lang     Texte und Sprache; toast(Text, ms) Meldung
     now()       Uhrzeit in ms (GLighter: Uhr des Servers); fTime(ms) / fDate(ms) Uhr und Datum in der Kopfzeile
     secs        eingebaute Bereiche (z. B. ['txt','tags','wit','more','time'])
     viewOpts    Ansichts-Einstellungen im Editor, z. B. ['width','dens','tipmode'] oder ['clock','dens','style']
     ui          Zusätze im Bildschirm: { more: HTML der Klappe „Mehr“, witExtra: HTML am Zeugen, witMax, att, tips, tplFirst, src, fold: {key}, head: HTML-Knöpfe }
     layout      { get() → {title, sub, order, width, dens, tipmode, clock, style, pop, sechide, sechide_pop, hideSec?},
                   saveFb(fb), save(pf), saveQuick(key, list), reset() }   – wo „Layout anpassen“ und die Schnell-Schalter gespeichert werden
     saveNote(body, info)  Notiz speichern (Format wie GReport „note“) → {ok, error, fields, note: {id, a}, msg?}
     Hooks (alle freiwillig): qtIn(j), tagsLoaded(), tagsChanged(), onStart(ms), liveInfo(), onReset(), onEdit(n), onSaved(r, body, info),
       manage(box), afterTpl(j), stats(), list(), tips(root), tipModeApply(), witSlot(box, body), extOld(), extFill(x), persons(), personsInfo(),
       popOk(), onPop(doc), onBack(), width(w), autosave(), kindHold, att {pending(), reset(), draw(), upload(items, id, msg)} */
  const H = { name: 'GReport', t: k => k, lang: () => 'de', toast: () => { }, now: () => Date.now(), fTime: ms => new Date(ms).toLocaleTimeString(), fDate: ms => new Date(ms).toLocaleDateString(),
    secs: ['txt', 'tags', 'wit', 'time'], viewOpts: ['dens'], ui: {}, layout: null, saveNote: null };
  const hook = (k, ...a) => typeof H[k] === 'function' ? H[k](...a) : undefined;
  const t = (k, v) => H.t(k, v);
  const LP = () => (H.layout && H.layout.get()) || {};
  /* ---------- Grundlagen ---------- */
  let FNPOP = null;                                    // Fenster, in das „Notiz jetzt“ abgedockt ist
  const popOn = () => !!(FNPOP && !FNPOP.closed);
  const popDoc = () => popOn() ? FNPOP.document : null;
  const popEl = id => popOn() ? FNPOP.document.getElementById(id) : null;
  const $ = id => document.getElementById(id) || popEl(id);
  /* Fenster, in dem „Notiz jetzt“ gerade steht (Seite oder abgedocktes Fenster): Rückfragen, Animation, Ziehen dort */
  const pwin = () => { const p = $('fnpanel'), w = p && p.ownerDocument.defaultView; return w && w !== window && !(window.documentPictureInPicture && documentPictureInPicture.window === w) ? w : window; };
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, props) => { const e = document.createElement(tag); Object.assign(e, props || {}); return e; };
  const isoDay = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dtl = d => isoDay(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  // Zeit fürs Speichern immer mit Offset des Browsers (z. B. +01:00), damit der Zeitpunkt eindeutig ist (doppelte Stunde, andere Zeitzone)
  const tzo = d => { const m = -d.getTimezoneOffset(), a = Math.abs(m); return (m < 0 ? '-' : '+') + pad(Math.floor(a / 60)) + ':' + pad(a % 60); };
  const dto = d => dtl(d) + tzo(d);
  const inIso = (v, orig) => !v ? '' : orig && dtl(new Date(orig)) === v ? orig : isNaN(new Date(v).getTime()) ? v : dto(new Date(v));
  const nowMs = () => H.now();
  const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(r => r.json());
  const fTime = ms => H.fTime(ms), fDate = ms => H.fDate(ms);
  function trIn(root) {                                // Texte im Bereich (data-i, data-ia, data-iph wie in den Apps)
    if (!root) return;
    root.querySelectorAll('[data-i]').forEach(e => { e.textContent = t(e.dataset.i); });
    root.querySelectorAll('[data-ia]').forEach(e => { e.title = t(e.dataset.ia); e.setAttribute('aria-label', t(e.dataset.ia)); });
    root.querySelectorAll('[data-iph]').forEach(e => { e.placeholder = t(e.dataset.iph); });
  }
  /* ---------- Schnellwahl: Wörter, Gruppen, Reihenfolge ---------- */
  let NOTE_TAGS = { src: ['oben', 'unten', 'nebenan', 'treppenhaus', 'tuer_o', 'draussen', 'unklar'], kind: ['klopfen', 'schritte', 'musik', 'stimmen', 'tuer', 'moebel', 'bohren', 'hund'],
    lvl: ['leicht', 'deutlich', 'stark'], eff: ['aufgewacht', 'kind_geweckt', 'kein_schlaf', 'gestoert'], act: ['geklingelt', 'angesprochen', 'verwaltung', 'polizei'], misc: ['zeuge', 'serie'] };
  const GROUPS = ['src', 'kind', 'lvl', 'eff', 'act', 'misc', 'own'];          // eingebaute Wort-Rubriken
  const NTS = { own: {}, del: new Set(), hide: new Set(), use: {}, sug: [], max: 5, ren: {}, grp: {}, order: [], mode: 'use', gall: [], when: [] };
  const WHEN = new Map();                                // Zeitpunkt-Tasten: Schlüssel -> {l, m | at, day | none, own, hide}
  function ntGroup(tag) { if (WHEN.has(tag)) return 'when'; if (NTS.grp[tag]) return NTS.grp[tag]; for (const g in NOTE_TAGS) if (NOTE_TAGS[g].includes(tag)) return g; return 'own'; }
  function ntLabel(tg) { const w = WHEN.get(tg); if (w && w.own) return w.l; return NTS.own[tg] != null ? NTS.own[tg] : NTS.ren[tg] || (String(tg).startsWith('g:') ? tg.slice(2) : t('nt_' + tg)); }   // g: = eigene Taste aus GReport (in GLighter)
  /* Rubriken: eingebaute, „Zeitpunkt“ und eigene (g_…), in der eingestellten Reihenfolge */
  const gInfo = g => (NTS.gall || []).find(x => x.g === g);
  const gIds = () => NTS.gall && NTS.gall.length ? NTS.gall.map(x => x.g) : GROUPS.slice(0, -1).concat('when', 'own');
  const wordGroups = () => gIds().filter(g => g !== 'when');
  const gCustom = g => /^g_/.test(g);
  function gLabel(g) { const i = gInfo(g); return i && (i.custom || i.renamed) && i.l ? i.l : t('gr_g_' + g); }
  const G_PAL = ['#2f9e44', '#1098ad', '#7048e8', '#e8590c', '#c2255c', '#5c7cfa', '#868e96'];
  const G_DEF = { src: '#0c8a6a', kind: '#d6336c', lvl: '#e67700', eff: '#6741d9', act: '#1c6fd6', misc: '#5f6b78', own: '#a61e4d', when: '#0b7285' };
  function gColor(g) { const c = (NTS.gcol || {})[g]; if (c) return c; if (G_DEF[g]) return null; let h = 0; for (const ch of g) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return G_PAL[h % G_PAL.length]; }
  // Klasse und (bei eigenen Rubriken) Farbe für Tasten und Markierungen
  function gAttr(g) { if (!gCustom(g)) return `g-${g}"`; const c = gColor(g); return `g-cu" style="--uc:${c};--udc:color-mix(in srgb, ${c} 72%, #fff)"`; }
  function ntsApply(j) {
    if (!j || !j.ok) return;
    hook('qtIn', j);                                   // App kann die Antwort ihres Servers angleichen
    if (j.tags) NOTE_TAGS = j.tags;
    NTS.own = {}; NTS.del = new Set(); for (const o of j.own || []) { NTS.own[o.k] = o.l; if (o.del) NTS.del.add(o.k); }
    Object.assign(NTS, { hide: new Set(j.hide || []), use: j.use || {}, sug: j.suggest || [], max: j.own_max || 5, ren: j.ren || {}, grp: j.grp || {}, order: j.order || [], mode: j.mode || 'use', gcol: j.gcol || {}, req: new Set(j.req || []), limit: j.limit || 5, show: j.show || 0, proMax: j.pro_max || 200,
      gall: j.gall || [], when: j.when || [], whenMax: j.when_max || 30, gone: new Set(j.gone || []), ghelp: j.ghelp || {} });
    WHEN.clear(); for (const w of NTS.when) WHEN.set(w.k, w);
    gcolApply();
  }
  function gcolApply() {                                 // eigene Gruppenfarben als CSS-Variablen (auch im abgedockten Fenster)
    for (const doc of [document, popDoc()]) {
      if (!doc) continue; const r = doc.documentElement.style;
      for (const g of GROUPS.concat('when')) { const c = (NTS.gcol || {})[g]; if (c) { r.setProperty('--u-' + g, c); r.setProperty('--ud-' + g, `color-mix(in srgb, ${c} 72%, #fff)`); } else { r.removeProperty('--u-' + g); r.removeProperty('--ud-' + g); } }
    }
  }
  async function ntsLoad() { try { ntsApply(await (await fetch('notetags', { cache: 'no-store' })).json()); } catch (e) { } fnpTags(); hook('tagsLoaded'); }
  async function ntsPost(body) {
    const j = await post('notetags', body);
    if (!j.ok) throw new Error(j.error === 'limit_free' ? t('gr_qt_limit_free', { n: NTS.max }) : j.error === 'limit' ? t('qt_limit') : j.error === 'empty' ? t('qt_empty') : (j.error || 'error'));
    ntsApply(j); fnpTags(); hook('tagsChanged'); return j;
  }
  function ntAll() {                                     // alle Wörter (auch ausgeblendete), Standard-Reihenfolge
    const out = []; for (const g in NOTE_TAGS) out.push(...NOTE_TAGS[g]);
    for (const k in NTS.own) if (!NTS.del.has(k)) out.push(k);
    return out;
  }
  function ntOrdered(list) {                             // fest angeordnet oder nach Gebrauch
    const base = new Map(ntAll().map((x, i) => [x, i])), b = x => base.has(x) ? base.get(x) : 1e5;
    if (NTS.mode === 'fixed') { const pos = new Map(NTS.order.map((x, i) => [x, i])); return list.sort((x, y) => (pos.has(x) ? pos.get(x) : 1e6 + b(x)) - (pos.has(y) ? pos.get(y) : 1e6 + b(y))); }
    return list.sort((x, y) => ((NTS.use[y] || 0) - (NTS.use[x] || 0)) || (b(x) - b(y)));
  }
  function ntVisible(sel) { return ntOrdered(ntAll().filter(k => !NTS.hide.has(k) || (sel && sel.has(k)))); }
  const tagBtn = (tg, on) => `<button type="button" class="tag ${gAttr(ntGroup(tg)).replace('"', on ? ' on"' : '"')} data-t="${esc(tg)}" aria-pressed="${!!on}">${esc(ntLabel(tg))}</button>`;
  const tagMk = tg => `<span class="mk ${gAttr(ntGroup(tg))}>${esc(ntLabel(tg))}</span>`;
  /* ---------- Notiz jetzt ---------- */
  const FNP = { from: null, tags: new Set(), edit: null, fixed: false, open: new Set(), notime: false, when: null, approx: false, cap: null, manual: false, pend: null, fv: {}, reqWarned: null, kind: '', kindNt: false };
  /* Notiz-Art: wählen setzt bei Arten „ohne Zeitpunkt“ auch „ohne Zeitpunkt“ (außer die Zeit wurde von Hand gesetzt) */
  function kindSet(id, quiet) {
    const k = Felder.kindOf(id), prev = FNP.kindNt; FNP.kind = k && !k.del ? id : '';
    FNP.kindNt = !!(k && k.notime && !FNP.manual && !FNP.timeTouched);
    if (FNP.kindNt) { FNP.notime = true; FNP.when = null; } else if (prev && FNP.notime && !FNP.manual) FNP.notime = false;
    kindDraw(); if (!quiet) { notimeShow(); fnpShow(); }
  }
  function kindDraw() {
    const b = $('fnpkinds'); if (!b) return; Felder.kindPick(b, FNP.kind, id => kindSet(id));
    if (H.kindHold) b.querySelectorAll('.fbkchip').forEach(c => { c.title = (c.title ? c.title + ' · ' : '') + t('fk_hold'); holdBind(c, () => kindEditAt(c.dataset.k)); });   // lange drücken / Rechtsklick: Art in „Layout anpassen“ bearbeiten
  }
  function kindEditAt(id) {                            // Art zum Bearbeiten öffnen (Reiter „Notiz-Arten“ in „Layout anpassen“)
    if (!Felder.kindOf(id)) return;
    if (!LAY.on) layOpen();
    pwin().requestAnimationFrame(() => { const tb = $('laytab_k'); if (tb) tb.click(); const r = $('laykinds') && $('laykinds').querySelector(`details.fbkrow[data-k="${CSS.escape(id)}"]`); if (!r) return;
      r.open = true; r.scrollIntoView({ block: 'center' }); const i = r.querySelector('.fk_l'); if (i) { i.focus(); i.select(); } });
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
  /* Taste lange drücken: „Layout anpassen“ öffnet sich mit dieser Taste – gleich weiterziehen oder mit den Pfeiltasten verschieben */
  function layOpenAt(k) {
    if (!LAY.on) layOpen();
    pwin().requestAnimationFrame(() => { const c = $('fnptags') && $('fnptags').querySelector(`.layk[data-k="${CSS.escape(k)}"]`); if (!c) return;
      c.classList.add('picked'); setTimeout(() => c.classList.remove('picked'), 2400); const n = c.querySelector('.lkn'); if (n) { n.focus(); c.scrollIntoView({ block: 'nearest' }); }
      laySay(t('gr_lay_picked', { k: n ? n.textContent : k })); });
  }
  function fnpTags() {
    const box = $('fnptags'); if (!box) return;
    const tin = tagInKeep(box);
    if (LAY.on) { layDraw(); return; }
    const vis = ntVisible(FNP.tags), by = {}; for (const k of vis) (by[ntGroup(k)] = by[ntGroup(k)] || []).push(k);
    const ids = gIds(); for (const g in by) if (g !== 'own' && !ids.includes(g)) (by.own = by.own || []).push(...by[g]);   // Rubrik gibt es nicht mehr: Tasten unter „Eigene“
    let h = '';
    const w = NTS.sug[0];
    if (w) h += `<div class="sugline">💡 ${esc(t('qt_sug', { w: w.w, n: w.n }))} <button type="button" class="sugy">＋ ${esc(t('qt_create'))}</button><button type="button" class="sugn" aria-label="${esc(t('qt_sug_no'))}">✕</button></div>`;
    for (const g of ids) {
      const rq = NTS.req && NTS.req.has(g), hm = `${rq ? '<i class="reqm" title="' + esc(t('gr_req_tip')) + '"> *</i>' : ''}${(NTS.ghelp || {})[g] ? `<small class="ghelp">${esc(NTS.ghelp[g])}</small>` : ''}`;
      if (g === 'when') {                                 // Rubrik „Zeitpunkt“: Tasten setzen die Zeit (kein Wort in der Notiz)
        const ws = whenOrdered().filter(k => !WHEN.get(k).hide || FNP.when === k);
        if (!ws.length || (gHid(g) && !FNP.when)) continue;
        h += `<div class="grp${rq ? ' req' : ''}" data-g="when"><span>${esc(gLabel(g))}${hm}</span><div>${ws.map(k => `<button type="button" class="tag ${gAttr('when').replace('"', FNP.when === k ? ' on"' : '"')} data-w="${esc(k)}" aria-pressed="${FNP.when === k}">${esc(ntLabel(k))}</button>`).join('')}</div></div>`;
        continue;
      }
      const ks = by[g] || []; if (!ks.length && g !== 'own') continue;
      if (gHid(g) && !ks.some(k => FNP.tags.has(k))) continue;        // ausgeblendete Rubrik dieser Ansicht (gewählte Wörter bleiben sichtbar)
      const lim = NTS.show > 0 && !FNP.open.has(g) ? NTS.show : 0, shown = lim ? ks.filter((k, i) => i < lim || FNP.tags.has(k)) : ks, hid = ks.length - shown.length;   // Pro: nur die ersten N je Gruppe
      h += `<div class="grp${rq ? ' req' : ''}" data-g="${esc(g)}"><span>${esc(gLabel(g))}${hm}</span><div${NTS.gone && NTS.gone.has(g) ? ` role="group" aria-label="${esc(gLabel(g) + ' – ' + t('fb_g_one'))}"` : ''}>${shown.map(k => tagBtn(k, FNP.tags.has(k))).join('')}${hid > 0 ? `<button type="button" class="tag more" data-g="${esc(g)}">${esc(t('gr_more', { n: hid }))}</button>` : FNP.open.has(g) && NTS.show > 0 && ks.length > NTS.show ? `<button type="button" class="tag more less" data-g="${esc(g)}">${esc(t('gr_less'))}</button>` : ''}<span class="tag add tagin" data-g="${esc(g)}" title="${esc(t('qt_add_here', { g: gLabel(g) }))}"><input type="text" maxlength="30" enterkeyhint="done" placeholder="${esc(g === 'own' ? '+ ' + t('qt_add') : '+')}" aria-label="${esc(t('qt_add_here', { g: gLabel(g) }))}"><button type="button" class="tnok" tabindex="-1" aria-label="${esc(t('save'))}">✓</button></span></div></div>`;
    }
    box.innerHTML = h;
    box.querySelectorAll('.grp>div').forEach(row => {          // Handy: Hinweis rechts, solange die Zeile weitergeht
      const upd = () => row.parentNode.classList.toggle('ovf', row.scrollWidth - row.scrollLeft - row.clientWidth > 4);
      row.addEventListener('scroll', upd, { passive: true }); requestAnimationFrame(upd);
    });
    box.querySelectorAll('.tag[data-t]').forEach(b => {
      b.onclick = () => { const k = b.dataset.t, g = ntGroup(k), one = NTS.gone && NTS.gone.has(g) && !FNP.tags.has(k);
        if (one) for (const x of [...FNP.tags]) if (ntGroup(x) === g) { FNP.tags.delete(x); const o = box.querySelector(`.tag[data-t="${CSS.escape(x)}"]`); if (o) { o.classList.remove('on'); o.setAttribute('aria-pressed', 'false'); } }   // nur eine Auswahl in dieser Rubrik
        FNP.tags.has(k) ? FNP.tags.delete(k) : FNP.tags.add(k); b.classList.toggle('on', FNP.tags.has(k)); b.setAttribute('aria-pressed', FNP.tags.has(k)); fnpStart(); reqCheck(); if (secQuick().size) secDraw(); };
      holdBind(b, () => layOpenAt(b.dataset.t));
    });
    box.querySelectorAll('.tag[data-w]').forEach(b => b.onclick = () => whenPick(b.dataset.w));
    const wg = box.querySelector('.grp[data-g="when"]'); if (wg && H.ui.tips) { const sl = el('div', { className: 'tipslot' }); sl.dataset.tips = '3'; wg.after(sl); hook('tips', box); }
    box.querySelectorAll('.tag.more').forEach(b => b.onclick = () => { const g = b.dataset.g; FNP.open.has(g) ? FNP.open.delete(g) : FNP.open.add(g); fnpTags(); });
    tagInBind(box, () => typeof H.manage === 'function' ? H.manage(box) : layOpen(), tin);   // leere Pille mit „+“ in jeder Rubrik – direkt hineinschreiben
    reqCheck();
    const sy = box.querySelector('.sugy'); if (sy) sy.onclick = async () => { try { const j = await ntsPost({ action: 'add', l: w.w }); if (j.k) { FNP.tags.add(j.k); fnpTags(); } } catch (e) { alert(e.message); } };
    const sn = box.querySelector('.sugn'); if (sn) sn.onclick = () => ntsPost({ action: 'nope', w: w.k }).catch(e => alert(e.message));
  }
  /* Leere Pille mit „+“ in jeder Rubrik: direkt hineinschreiben, Enter (oder ✓) = neue Taste anlegen und wählen, Esc = leeren.
     Rechtsklick auf die leere Pille = Schnellwahl bearbeiten. Beim Neuzeichnen bleibt Getipptes erhalten. */
  function tagInKeep(box) {
    const vals = {}; let foc = null, s = null;
    box.querySelectorAll('.tag.tagin input').forEach(i => { const g = i.parentNode.dataset.g; if (i.value) vals[g] = i.value; if (i.ownerDocument.activeElement === i) { foc = g; s = i.selectionStart; } });
    return { vals, foc, s };
  }
  function tagInBind(box, manage, keep) {
    box.querySelectorAll('.tag.tagin').forEach(w => {
      const i = w.querySelector('input'), ok = w.querySelector('.tnok'), g = w.dataset.g || 'own';
      const upd = () => w.classList.toggle('has', !!i.value.trim());
      if (keep && keep.vals[g]) i.value = keep.vals[g];
      if (keep && keep.foc === g) { i.focus(); try { i.setSelectionRange(keep.s, keep.s); } catch (e) { } }
      upd(); i.oninput = upd;
      const go = async () => {
        const l = i.value.trim(); if (!l || w._busy) return; w._busy = true;
        i.value = ''; upd();                                // vorher leeren: ntsPost zeichnet schon neu (sonst käme der Text in die neue Pille)
        try { const j = await ntsPost({ action: 'add', l, g }); if (j.k) { FNP.tags.add(j.k); fnpStart(); } fnpTags(); reqCheck(); H.toast('✓ ' + t('qt_added', { l }));
          const n = box.querySelector(`.tag.tagin[data-g="${CSS.escape(g)}"] input`); if (n) n.focus(); }   // gleich die nächste eintippen
        catch (e) { const n = box.querySelector(`.tag.tagin[data-g="${CSS.escape(g)}"] input`) || i; n.value = l; alert(e.message); n.focus(); } finally { w._busy = false; }
      };
      i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } else if (e.key === 'Escape') { e.preventDefault(); i.value = ''; upd(); i.blur(); } };
      if (ok) { ok.onmousedown = e => e.preventDefault(); ok.onclick = go; }
      w.onclick = e => { if (e.target === w) i.focus(); };
      w.oncontextmenu = e => { if (i.value) return; e.preventDefault(); manage(); };
    });
  }
  function whenOrdered() {
    const ks = [...WHEN.keys()];
    if (NTS.mode !== 'fixed') return ks;
    const pos = new Map(NTS.order.map((x, i) => [x, i])); return ks.slice().sort((a, b) => (pos.has(a) ? pos.get(a) : 1e6 + ks.indexOf(a)) - (pos.has(b) ? pos.get(b) : 1e6 + ks.indexOf(b)));
  }
  function hmAt(hm, base, back) { const [hh, mm] = hm.split(':').map(Number); return new Date(base.getFullYear(), base.getMonth(), base.getDate() - (back || 0), hh, mm, 0); }
  function whenRange(w, base) {                         // wie im Server: [von, bis] in ms; bis = null wenn ohne
    base = new Date(base);
    if (w.rng) {                                          // ungefährer Zeitraum, z. B. 22:00–06:00 (höchstens bis Erfassungsbeginn)
      const a = hmAt(w.rng[0], base, w.day); if (!w.day && a > base) a.setDate(a.getDate() - 1);
      const b = hmAt(w.rng[1], a); if (b <= a) b.setDate(b.getDate() + 1);
      const e = Math.min(b.getTime(), base.getTime()); return [a.getTime(), e > a.getTime() ? e : null];
    }
    if (w.at) { const d = hmAt(w.at, base, w.day); if (!w.day && d > base) d.setDate(d.getDate() - 1); return [d.getTime(), null]; }
    return [base.getTime() - (w.m || 0) * 60000, null];
  }
  function whenPick(k) {
    // Zeitpunkt-Taste: rechnet immer vom Beginn der Erfassung (erstes Tippen), nicht von der vorigen Taste und nicht vom Speichern.
    // Von Hand gesetzte Zeit hat Vorrang: erst nach Hinweis und zweitem Tippen ersetzen.
    const w = WHEN.get(k); if (!w) return;
    const msg = $('fnpmsg');
    if (FNP.when === k) { FNP.when = null; FNP.notime = false; FNP.approx = false; FNP.fixed = false; $('fnpfromi').value = ''; $('fnptoi').value = ''; }
    else {
      if (FNP.manual && FNP.pend !== k) { FNP.pend = k; msg.className = 'msg warn'; msg.textContent = t('gr_w_manual', { k: ntLabel(k) }); return; }
      FNP.pend = null; FNP.manual = false; if (msg.classList.contains('warn')) { msg.textContent = ''; msg.className = 'msg'; }
      if (FNP.cap == null) FNP.cap = FNP.edit ? (FNP.edit.cap || FNP.edit.a) : nowMs();
      FNP.when = k; FNP.approx = !!w.rng; FNP.notime = !!w.none;
      if (w.none) FNP.fixed = false;
      else { const [a, b] = whenRange(w, FNP.cap); FNP.fixed = true; FNP.from = a; $('fnpfromi').value = dtl(new Date(a)); $('fnptoi').value = b ? dtl(new Date(b)) : ''; $('fnprun').checked = false; }
    }
    if (FNP.from == null) { FNP.from = nowMs(); hook('onStart', FNP.from); }
    if (FNP.when) timeEdit(true);
    notimeShow(); fnpTags(); fnpShow();
  }
  function notimeShow() {                                // „ohne Zeitpunkt“: Zeitfelder sind dann aus
    const nt = !!FNP.notime; $('fnpnotime').checked = nt;
    for (const id of ['fnpfromi', 'fnptoi', 'fnpfnow', 'fnptnow', 'fnptclr', 'fnprun']) { const e = $(id); if (e) e.disabled = nt; }
    const x = $('fnpext'); if (x) x.classList.toggle('notime', nt);
  }
  function reqCheck() {                                 // alle Pflicht-Gruppen gewählt: gewählte Tasten und „Speichern“ leuchten pulsierend auf (gespeichert wird immer)
    const req = [...(NTS.req || [])], pn = $('fnpanel'); if (!pn) return;
    const have = new Set([...FNP.tags].map(ntGroup)); if (FNP.when) have.add('when');
    pn.querySelectorAll('.grp.req').forEach(r => r.classList.toggle('done', have.has(r.dataset.g)));
    const all = req.length > 0 && req.every(g => have.has(g)), was = pn.classList.contains('alldone');
    pn.classList.toggle('alldone', all);
    if (all && !was) { const m = $('fnpmsg'); if (m && !m.textContent) { m.className = 'msg'; m.textContent = '✓ ' + t('gr_req_done'); setTimeout(() => { if (m.textContent === '✓ ' + t('gr_req_done')) m.textContent = ''; }, 3000); } }
    autoSaveCheck();
  }
  /* Speichern von selbst – sobald alles Pflichtige gesetzt ist (Tasten-Rubriken, Pflichtfelder, Pflicht-Text/-Zeuge), läuft ein kurzer
     Countdown auf der Taste „Speichern“. Jede weitere Eingabe startet ihn neu; Klick auf die Taste speichert sofort.
     Nur bei neuen Notizen, nicht beim Ändern. Sekunden aus der App (autosave(), 0 = aus). */
  const ASV = { tm: 0, tick: 0, until: 0 };
  function autoAllReq() {
    const req = [...(NTS.req || [])], have = new Set([...FNP.tags].map(ntGroup)); if (FNP.when) have.add('when');
    if (!req.every(g => have.has(g))) return false;
    const c = Felder.check(FNP.fv, $('fnpbody'), viewBlocks()), g = k => FB.sec[k] || {};
    if (c.bad.length || c.miss.length) return false;
    if (!viewHid('txt') && g('txt').req && !$('fnptext').value.trim()) return false;
    if (!bndOf('witness') && !viewHid('wit') && g('wit').req && !$('fnpwit').value.trim()) return false;
    const anyReq = req.length || viewBlocks().some(b => b.req && b.type !== 'counter') || g('txt').req || g('wit').req;
    return !!anyReq;                                    // ohne ein einziges Pflichtfeld nie von selbst speichern
  }
  function autoSaveStop() { clearTimeout(ASV.tm); clearInterval(ASV.tick); ASV.tm = ASV.tick = 0; ASV.until = 0; const b = $('fnpsave'); if (b) { b.classList.remove('counting'); b.textContent = t(FNP.edit ? 'gr_change' : 'save'); b.style.removeProperty('--p'); } }
  function autoSaveCheck() {
    const secs = +(hook('autosave') || 0); if (!secs || FNP.edit || !$('fnpanel')) { autoSaveStop(); return; }
    if (!autoAllReq()) { autoSaveStop(); return; }
    autoSaveStop();
    const b = $('fnpsave'), t0 = Date.now(); ASV.until = t0 + secs * 1000; b.classList.add('counting');
    const upd = () => { const left = Math.max(0, ASV.until - Date.now()); b.textContent = t('save') + ' · ' + Math.ceil(left / 1000); b.style.setProperty('--p', (100 * (1 - left / (secs * 1000))).toFixed(1) + '%'); };
    upd(); ASV.tick = setInterval(upd, 100);
    ASV.tm = setTimeout(() => { autoSaveStop(); if (autoAllReq()) fnpSave(); }, secs * 1000);
  }
  function fnpStart() { const was = FNP.from == null; if (was) FNP.from = nowMs(); if (FNP.cap == null && !FNP.edit) FNP.cap = FNP.from; fnpShow(); if (was) hook('onStart', FNP.from); }
  function fnpAt() { return FNP.fixed && FNP.from != null ? FNP.from : nowMs(); }
  function fnpShow() {
    if (!$('fnpfrom')) return;
    const at = FNP.edit && !FNP.fixed ? FNP.edit.a : fnpAt(), P = LP();
    const ck = $('capclock'); ck.textContent = fTime(at); ck.dateTime = dtl(new Date(at)); $('capdate').textContent = fDate(at);
    const to = $('fnptoi').value, run = $('fnprun').checked;
    if (!LAY.on) {                                       // im Bearbeiten-Modus sind Überschrift und Hinweis editierbar – nicht überschreiben
      // eigener Hinweis ersetzt nur den Ruhezustand; Zustandsmeldungen (ändern, Zeit gesetzt, läuft) bleiben
      $('fnpfrom').textContent = FNP.edit ? t('gr_editing_s') : FNP.notime ? t('gr_notime') : FNP.fixed ? (FNP.when && FNP.cap ? t('gr_capinfo', { t: fTime(FNP.cap), k: ntLabel(FNP.when) }) : t('gr_t_fixed')) : FNP.from == null ? (P.sub || capWait()) : (hook('liveInfo') || t('gr_t_live'));
      $('capttl').textContent = FNP.edit ? t('gr_change_ttl') : (P.title || t('fn_btn'));
    }
    $('fnptimetxt').textContent = FNP.notime ? t('gr_notime') + ' · ' + t('gr_t_change') : (FNP.approx ? '≈ ' : '') + (FNP.fixed || FNP.edit ? t('gr_t_at', { t: fTime(at) }) : t('gr_t_now')) + (to ? ' – ' + fTime(new Date(to).getTime()) : run ? ' – ' + t('gr_t_run') : '') + ' · ' + t('gr_t_change');
  }
  /* Hinweis unter der Überschrift: passt zur Vorlage (ohne Textfeld, mit Zähler: „Taste ＋1 drücken …“) */
  const capWait = () => viewHid('txt') && viewBlocks().some(b => b.type === 'counter') ? t('fb_wait_cnt') : t(matchMedia('(pointer:coarse)').matches ? 'gr_wait_m' : 'gr_wait');
  function fnpReset() {
    FNP.from = null; FNP.tags = new Set(); FNP.edit = null; FNP.fixed = false; Object.assign(FNP, { notime: false, when: null, approx: false, cap: null, manual: false, pend: null, timeTouched: false });
    $('fnptext').value = ''; $('fnpwit').value = ''; $('fnpfromi').value = ''; $('fnptoi').value = ''; $('fnprun').checked = false;
    FNP.fv = {}; FNP.reqWarned = null; fbMount();
    FNP.kindNt = false; kindSet(FB.kind_keep && Felder.kindOf(FNP.kind) ? FNP.kind : (FB.kind_def || ''), true);   // Art: gemerkt oder Vorgabe
    $('fnpcancel').hidden = true; $('fnpsave').textContent = t('save'); $('fnpanel').classList.remove('editing');
    if (H.att) H.att.reset();
    hook('extFill', null); hook('onReset'); timeEdit(false); notimeShow(); fnpTags(); fnpShow(); hook('list'); reqCheck(); secDraw(); hook('tips');
  }
  function timeEdit(open) {
    $('fnpext').hidden = !open; $('fnptimebtn').setAttribute('aria-expanded', String(open));
    if (open && !$('fnpfromi').value) $('fnpfromi').value = dtl(new Date(fnpAt()));
  }
  const srcVal = () => { const s = $('fnpsrc'); return s && s.value ? s.value : 'all'; };
  async function fnpSave() {
    autoSaveStop();
    const fixed = FNP.fixed && $('fnpfromi').value, tv = $('fnptoi').value, run = $('fnprun').checked, ed = FNP.edit;
    if (!fbReqOk()) return;
    const pend = H.att ? H.att.pending() : [];
    const body = { action: ed ? 'edit' : 'add', id: ed ? ed.id : '', from: fixed ? inIso($('fnpfromi').value, ed && ed.from) : ed ? (ed.from || dto(new Date(ed.a))) : dto(new Date(nowMs())), to: tv ? inIso(tv, ed && ed.to) : run ? dto(new Date(nowMs())) : '',
      src: ed ? (ed.src || 'all') : srcVal(), text: autoText($('fnptext').value, FNP.tags) || (pend.length ? t('gr_att_only', { n: pend.map(p => p.f.name).join(', ') }) : ''), typed: !!$('fnptext').value.trim(), tags: [...FNP.tags], witness: bndOf('witness') ? bndOut().witness : $('fnpwit').value,
      notime: !!FNP.notime, ext: extRead(), fields: fbOut(), kind: FNP.kind || '' };
    if (FNP.when) Object.assign(body, { wk: FNP.when, wl: ntLabel(FNP.when), approx: !!FNP.approx, cap: FNP.cap || nowMs() });   // erfasst um … (Taste: …)
    else if (ed && ed.wk && !FNP.timeTouched) Object.assign(body, { wk: ed.wk, wl: ed.wl, approx: !!ed.approx, cap: ed.cap });
    else if (ed && ed.cap) body.cap = ed.cap;                                    // Erfassungszeit bleibt beim Ändern
    else if (!ed && fixed) body.cap = FNP.cap || nowMs();                      // Zeit von Hand gesetzt: wann notiert wurde, getrennt festhalten
    const msg = $('fnpmsg'), info = { fixed: !!fixed, run, to: tv, edit: ed };
    msg.className = 'msg';
    try {
      const r = await H.saveNote(body, info);
      if (!r.ok) { msg.textContent = r.error === 'field' ? t('fb_bad', { l: (r.fields || []).map(x => (Felder.byId(x) || {}).l || x).join(', ') }) : t(r.error === 'empty' ? 'fn_empty' : r.error === 'to' ? 'fn_bad_to' : 'saveerr'); msg.classList.add('err'); return; }
      const at = r.note && r.note.a, hadF = Object.keys(body.fields || {}).length; fnpReset(); ntsLoad(); if (hadF) fbLoad(true);
      if (pend.length && r.note) await H.att.upload(pend, r.note.id, msg);     // Anlagen an die gerade gespeicherte Notiz
      msg.className = 'msg'; msg.textContent = '✓ ' + (r.msg || t(ed ? 'gr_changed_at' : 'gr_saved_at', { t: at ? fTime(at) : '' })); setTimeout(() => { if (msg.textContent.startsWith('✓')) msg.textContent = ''; }, 5000);
      hook('onSaved', r, body, info);
    } catch (e) { msg.textContent = t('saveerr'); msg.classList.add('err'); }
  }
  function fnpEdit(n) {
    autoSaveStop();
    FNP.edit = n; FNP.tags = new Set(n.tags || []); FNP.fixed = false; FNP.from = n.a;
    Object.assign(FNP, { notime: !!n.notime, when: null, approx: !!n.approx, cap: n.cap || null, manual: false, pend: null, timeTouched: false });
    $('fnptext').value = n.text || ''; $('fnpwit').value = n.witness || '';
    FNP.fv = JSON.parse(JSON.stringify(n.fields || {})); bndFill(n); FNP.reqWarned = null; fbMount();      // eigene Felder (auch gelöschte bleiben erhalten), Zeuge und „Mehr“ aus witness/ext
    FNP.kind = n.kind || ''; FNP.kindNt = false; kindDraw();
    $('fnpfromi').value = n.from ? dtl(new Date(n.from)) : ''; $('fnptoi').value = n.to ? dtl(new Date(n.to)) : ''; $('fnprun').checked = false;
    $('fnpcancel').hidden = false; $('fnpsave').textContent = t('gr_change'); $('fnpanel').classList.add('editing');
    hook('extFill', n.ext); if (H.att) H.att.draw(); hook('onEdit', n); notimeShow(); fnpTags(); fnpShow(); hook('list'); hook('tips'); $('fnpanel').scrollIntoView({ block: 'start', behavior: 'smooth' }); $('fnptext').focus({ preventScroll: true });
  }
  /* Aus den Markierungen einen Satz bilden (nur ohne eigenen Text), z. B. „Deutliche Schritte von oben“ */
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
    const D = H.lang() === 'en' ? TS_EN : TS_DE, de = H.lang() !== 'en';
    const isRen = x => NTS.ren[x];                       // umbenannte Wörter: so wie benannt verwenden
    const kinds = tg.filter(x => D.kind[x] && !isRen(x)), lvl = tg.find(x => D.lvl[x] && !isRen(x)), src = tg.find(x => D.src[x] && !isRen(x));
    const rest = tg.filter(x => D.rest[x] && !isRen(x)).map(x => D.rest[x]).concat(tg.filter(x => NTS.own[x] != null || isRen(x)).map(ntLabel));
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
  function enterSave(ta, save) {                         // Enter speichert, Alt+Enter (oder Umschalt+Enter) = neue Zeile
    ta.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.isComposing) return;
      if (e.altKey || e.shiftKey) { e.preventDefault(); const s = ta.selectionStart, en = ta.selectionEnd; ta.setRangeText('\n', s, en, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); return; }
      e.preventDefault(); save();
    });
  }
  /* Abdocken: „Notiz jetzt“ als eigenes kleines Fenster über anderen Programmen */
  async function fnPop() {
    if (H.popOk && !H.popOk()) return;                   // z. B. GLighter ohne Pro
    if (popOn()) { try { FNPOP.focus(); } catch (e) { } return; }
    const panel = document.getElementById('fnpanel'); if (!panel) return;
    let w = null;
    try { if (window.documentPictureInPicture) w = await documentPictureInPicture.requestWindow({ width: 480, height: 560 }); } catch (e) { w = null; }
    if (!w) { try { w = window.open('', 'gr_note', 'popup=yes,width=500,height=600'); } catch (e) { w = null; } }
    if (!w) { alert(t('pop_fail')); return; }
    const doc = w.document; doc.title = H.name + ' – ' + t('fn_btn');
    const vp = doc.createElement('meta'); vp.name = 'viewport'; vp.content = 'width=device-width,initial-scale=1'; doc.head.appendChild(vp);
    for (const l of document.querySelectorAll('link[rel=stylesheet]')) { const n = doc.createElement('link'); n.rel = 'stylesheet'; n.href = l.href; doc.head.appendChild(n); }
    doc.documentElement.className = document.documentElement.className;
    for (const at of document.documentElement.attributes) if (at.name.startsWith('data-')) doc.documentElement.setAttribute(at.name, at.value);
    doc.documentElement.lang = document.documentElement.lang;
    doc.body.className = 'pop';                          // Tipp-Art und Dichte setzt viewApply() – für das Fenster aus der Ansicht „abgedockt“
    if (LAY.on) layClose();                              // „Layout anpassen“ gehört zur Ansicht, in der es geöffnet wurde
    const parent = panel.parentNode, next = panel.nextSibling;
    const ph = el('div', { className: 'popph' }); const pb = el('button', { type: 'button', className: 'btn', textContent: t('pop_back') });
    ph.append(el('span', { textContent: '📝 ' + t('pop_open'), className: 'grow' }), pb); parent.insertBefore(ph, panel);
    doc.body.appendChild(panel); panel.classList.add('inpop'); FNPOP = w; gcolApply(); hook('onPop', doc); viewApply();
    const back = () => { if (FNPOP !== w) return; if (LAY.on) layClose(); FNPOP = null; ph.remove(); try { parent.insertBefore(panel, next && next.parentNode === parent ? next : null); } catch (e) { parent.appendChild(panel); } panel.classList.remove('inpop'); hook('onBack'); viewApply(); };
    pb.onclick = () => { try { w.close(); } catch (e) { } back(); };
    w.addEventListener('pagehide', back);
    addEventListener('pagehide', () => { try { w.close(); } catch (e) { } });
    setTimeout(() => { const tx = doc.getElementById('fnptext'); if (tx) tx.focus(); }, 100);
  }
  /* ---------- Zwei Ansichten: „angedockt“ (in der Seite) und „abgedockt“ (eigenes Fenster) ----------
     Je Ansicht: Reihenfolge und ausgeblendete Bereiche/Felder, ausgeblendete Rubriken und die Darstellung (Dichte, Tipps, Uhr, Tasten-Stil),
     dazu die Schnell-Schalter ● / ○ (sechide / sechide_pop). Abgedockt folgt der angedockten Ansicht, bis sie selbst geändert wird.
     Nur Anzeige – Notizen, Felder und Tasten bleiben dieselben. */
  const viewCur = () => LAY.on && LAY.d ? LAY.d.prof : popOn() ? 'pop' : 'dock';
  const LOOK = ['tipmode', 'dens', 'clock', 'style'];   // Darstellung je Ansicht (welche es gibt, sagt viewOpts)
  function viewDock() {                                  // angedockt: Ausblenden der Felder in deren Definition, der Rubriken in der Schnellwahl
    const P = LP(), o = H.viewOpts;
    const v = { cap_order: capOrder(null, P.order || []), hide: secs().filter(k => secHidden(k)).concat(Felder.active().filter(b => b.hide).map(b => b.id)),
      ghide: gIds().filter(g => (gInfo(g) || {}).hide), dens: P.dens === 'compact' ? 'compact' : 'normal' };
    if (o.includes('tipmode')) v.tipmode = hook('tipMode') || 'hover';
    if (o.includes('clock')) v.clock = ['big', 'small', 'off'].includes(P.clock) ? P.clock : 'big';
    if (o.includes('style')) v.style = P.style === 'filled' ? 'filled' : 'outline';
    return v;
  }
  function viewGet(v) { const d = viewDock(), pp = LP().pop; if (v !== 'pop' || !pp) return d; const o = Object.assign(d, pp); o.cap_order = capOrder(null, o.cap_order); return o; }
  const viewHid = (k, v) => viewGet(v || viewCur()).hide.includes(k);
  const gHid = g => viewGet(viewCur()).ghide.includes(g);
  const viewBlocks = v => { const h = new Set(viewGet(v || viewCur()).hide); return Felder.active().filter(b => !h.has(b.id)); };
  function secQuick(v) { v = v || viewCur(); const P = LP(); return new Set(v === 'pop' && Array.isArray(P.sechide_pop) ? P.sechide_pop : P.sechide || []); }
  function lookApply(V) {                                // Dichte (und, wo es sie gibt, Uhr und Tasten-Stil) am Bereich
    const pn = $('fnpanel'); if (!pn) return;
    pn.classList.toggle('dn-compact', V.dens === 'compact');
    for (const [m, k, vs] of [['ck', 'clock', ['big', 'small', 'off']], ['ts', 'style', ['outline', 'filled']]]) for (const x of vs) pn.classList.toggle(m + '-' + x, V[k] === x);
  }
  function viewLight() {                                 // Tipp-Art und Darstellung (ohne die Bereiche neu aufzubauen)
    hook('tipModeApply');
    if (!LAY.on) lookApply(viewGet(viewCur()));
  }
  function viewApply() {                                 // Ansicht gewechselt (ab-/angedockt) oder gespeichert: alles neu zeigen
    viewLight();
    if (!LAY.on) { fbMount(); secApply(); secDraw(); fnpTags(); fnpShow(); }
    hook('tips');
  }
  /* Abschnitte von „Notiz jetzt“ schnell ein- und ausblenden – je Ansicht (angedockt / abgedockt), auf dem Server gemerkt */
  function secDraw() {
    const bar = $('secbar'); if (!bar) return; bar.innerHTML = '';
    if (LAY.on) return;
    const q = secQuick(), v = viewCur();
    for (const k of capOrder()) {
      const blk = Felder.isId(k), e = secEl(k);
      if (blk && (Felder.byId(k) || {}).fold) continue;               // in „Mehr“ eingeklappt: der Schalter „Mehr“ gilt
      if (blk ? !e : viewHid(k)) { if (e) e.hidden = true; continue; }            // in „Layout anpassen“ ausgeblendet: ganz weg
      const off = q.has(k), l = secLabel(k); if (e) e.hidden = off;
      const n = off && k === 'tags' && FNP.tags.size ? ' · ' + FNP.tags.size : off && k === 'wit' && $('fnpwit').value.trim() ? ' · 1' : off && blk && !Felder.isEmpty(FNP.fv[k]) ? ' · 1' : '';
      const b = el('button', { type: 'button', className: 'secb' + (off ? '' : ' on'), textContent: l + n });
      b.setAttribute('aria-pressed', String(!off)); b.title = t(off ? 'gr_sec_show' : 'gr_sec_hide', { s: l });
      b.onclick = () => {
        const h = secQuick(v), key = v === 'pop' ? 'sechide_pop' : 'sechide'; off ? h.delete(k) : h.add(k); const list = [...h];
        const done = H.layout.saveQuick(key, list); secDraw();
        const nb = [...bar.children].find(x => x.dataset.sec === k); if (nb) nb.focus();
        Promise.resolve(done).then(ok => { if (ok === false) H.toast(t('saveerr')); }).catch(() => H.toast(t('saveerr')));
      };
      b.dataset.sec = k;
      bar.appendChild(b);
    }
  }
  /* ---------- Eigene Felder (Bausteine): Zähler, Zahl, Ja/Nein, Auswahl, Skala, Dauer, Datum, Ort, Person, Text ----------
     Definitionen beim Server der App, Werte je Notiz in „fields“. Eingebaute Bereiche (Text, Schnellwahl, Zeuge, Mehr, Zeitraum)
     lassen sich umbenennen, mit Hinweis versehen, als Pflicht markieren und ausblenden. */
  const FB = Felder.S;
  function secHidden(k, sec) {                           // eingebauter Bereich ausgeblendet (Entwurf: in sec; sonst beim Speicherort der App)
    if (sec) return !!((sec[k] || {}).hide);
    const hs = LP().hideSec; if (Array.isArray(hs)) return hs.includes(k);
    return !!((FB.sec[k] || {}).hide);
  }
  function secLabel(k, sec, list) {
    if (Felder.isId(k)) { const b = (list || FB.defs).find(x => x.id === k); return b ? b.l : k; }
    return ((sec || FB.sec)[k] || {}).l || t(SEC_L[k]);
  }
  const FBH = { get: id => FNP.fv[id], set: (id, v) => { if (v === undefined) delete FNP.fv[id]; else FNP.fv[id] = v; if (secQuick().size) secDraw(); },
    start: () => fnpStart(), count: (b, d) => fbCount(b, d) };
  /* Felder in „Notiz jetzt“ einhängen (list/sec: Entwurf aus „Layout anpassen“ als Vorschau) */
  function fbMount(list, sec) {
    const body = $('fnpbody'); if (!body) return;
    const more = $('fbmore'), all = list || FB.defs;
    const vis = list ? list.filter(b => !b.del) : viewBlocks(), ids = new Set(vis.map(b => b.id));
    for (const host of [body, more]) if (host) host.querySelectorAll(':scope > .fbblk').forEach(x => { if (!ids.has(x.dataset.b)) x.remove(); });
    for (const b of vis) {
      let box = $('fb_' + b.id); const host = b.fold && more ? more : body;      // „unter Mehr eingeklappt“: in die Klappe „Mehr“
      if (!box) { box = body.ownerDocument.createElement('div'); box.id = 'fb_' + b.id; }
      if (box.parentElement !== host) host.appendChild(box);
      box.dataset.fold = b.fold ? '1' : '';
      Felder.render(box, b, FNP.fv[b.id], FBH); box.classList.toggle('layoff', !!(list && b.hide));
      if (b.bind === 'witness') { witDatalist(box); hook('witSlot', box, body); }   // Hinweis zum Zeugen am Zeugen-Feld
    }
    const bw = all.some(b => b.bind === 'witness'), bx = all.some(b => b.bind && b.bind.startsWith('ext:'));   // auch gelöscht: alter fester Bereich kommt nicht zurück
    const mo = $('moreold'); if (mo) mo.hidden = bx;                                 // Standard-Felder ersetzen die alten festen Eingaben
    secMeta(sec);
    for (const k of secs()) { const e = $(SEC_EL[k]); if (!e) continue; if (k === 'wit' && bw) { e.hidden = true; continue; } if (list) e.hidden = false; e.classList.toggle('layoff', !!(list && secHidden(k, sec || {}))); }   // Vorschau: ausgeblendete blass
    const sm = $('secmore'); if (sm && bx && more && !more.querySelector('.fbblk')) sm.hidden = true;   // nichts eingeklappt: Klappe weg
  }
  /* Standard-Felder: Zeuge und „Mehr“ sind normale Felder, ihre Werte stehen weiter in witness/ext der Notiz */
  const BREP = { hv: ['Hausverwaltung', 'Property management'], verm: ['Vermieter', 'Landlord'], sonst: ['Sonstige', 'Other'] };
  const bndOf = k => FB.defs.find(b => b.bind === k && !b.del);
  function bndOut() {                                     // → { witness, ext } aus den Standard-Feldern (nur gezeigte der Ansicht)
    const vis = new Set(viewBlocks().map(b => b.id)), v = k => { const b = bndOf(k); return b && vis.has(b.id) ? FNP.fv[b.id] : undefined; };
    const w = v('witness'), x = {};
    const s_ = k => { const y = v('ext:' + k); if (y != null && String(y).trim() !== '') x[k] = String(y).trim(); };
    s_('freq'); s_('pol_nr'); s_('health'); s_('attest');
    if (v('ext:pol') === true || x.pol_nr) x.pol = true;
    if (v('ext:threat') === true) x.threat = true;
    const rt = v('ext:rep_to'); if (rt) { const k = Object.keys(BREP).find(k => BREP[k].includes(rt)); if (k) x.rep_to = k; }
    const rd = v('ext:rep_date'); if (rd && /^\d{4}-\d\d-\d\d/.test(rd)) x.rep_date = String(rd).slice(0, 10);
    if (w && typeof w === 'object' && (w.n || '').trim()) { if (w.r) x.wrole = w.r; if ((w.c || '').trim()) x.wcontact = w.c.trim(); }
    return { witness: w && typeof w === 'object' ? (w.n || '').trim() : '', ext: x };
  }
  function bndFill(n) {                                   // Notiz ändern: Werte aus witness/ext in die Standard-Felder
    const x = (n && n.ext) || {}, put = (k, val) => { const b = bndOf(k); if (b && val !== undefined && val !== '' && val !== null) FNP.fv[b.id] = val; };
    if (n && n.witness) put('witness', { n: n.witness, r: x.wrole || '', c: x.wcontact || '' });
    put('ext:freq', x.freq); put('ext:pol_nr', x.pol_nr); put('ext:health', x.health); put('ext:attest', x.attest);
    if (x.pol) put('ext:pol', true); if (x.threat) put('ext:threat', true);
    if (x.rep_to) put('ext:rep_to', (BREP[x.rep_to] || [])[H.lang() === 'en' ? 1 : 0]); if (x.rep_date) put('ext:rep_date', x.rep_date);
    const sm = $('secmore'); if (sm) sm.open = FB.defs.some(b => b.fold && !Felder.isEmpty(FNP.fv[b.id]));
  }
  /* Weitere Angaben (ext): aus den Standard-Feldern; ohne sie aus den alten festen Eingaben der App (extOld) */
  function extRead() {
    if (FB.defs.some(b => b.bind && !b.del)) {               // Standard-Felder: Werte daraus (alte feste Eingaben sind dann aus)
      const o = bndOut().ext;
      const wr = $('fnpwrole'), wc = $('fnpwcon');
      if (!bndOf('witness') && $('fnpwit').value.trim()) { if (wr && wr.value) o.wrole = wr.value; if (wc && wc.value.trim()) o.wcontact = wc.value.trim(); }
      const old = (FNP.edit && FNP.edit.ext) || {}, vis = new Set(viewBlocks().map(b => b.id));      // Feld gelöscht/ausgeblendet: alter Wert der Notiz bleibt
      for (const k of Object.keys(old)) { const bk = k === 'wrole' || k === 'wcontact' ? 'witness' : 'ext:' + k, b = bndOf(bk); if ((!b || !vis.has(b.id)) && !(k in o) && (bk !== 'witness' || !b)) o[k] = old[k]; }
      return o;
    }
    return hook('extOld') || {};
  }
  function witDatalist(box) {                             // Pro: gespeicherte Personen als Vorschläge, Rolle/Erreichbarkeit aus der Personenliste
    const i = box.querySelector('.fbpn'); if (!i) return;
    let dl = box.querySelector('datalist'); if (!dl) { dl = el('datalist', { id: box.id + '_pl' }); box.appendChild(dl); i.setAttribute('list', dl.id); }
    dl.innerHTML = (hook('persons') || []).map(p => `<option value="${esc(p)}"></option>`).join('');
    if (i._wdl) return; i._wdl = true;
    i.addEventListener('change', () => { const nm = i.value.split(',')[0].trim(), inf = (hook('personsInfo') || {})[nm]; if (!inf) return;
      const r = box.querySelector('.fbpr'), c = box.querySelector('.fbpc'); if (r && !r.value && inf.r) { r.value = inf.r; r.dispatchEvent(new Event('change')); } if (c && !c.value && inf.c) { c.value = inf.c; c.dispatchEvent(new Event('input')); } });
  }
  /* Namen, Hinweise und Pflicht der eingebauten Bereiche */
  function secMeta(sec) {
    sec = sec || FB.sec; const g = k => sec[k] || {}, neutral = FB.tpl && FB.tpl !== 'laerm';
    const tx = $('fnptext'); if (!tx) return;
    tx.placeholder = g('txt').h || t(neutral ? 'fb_txt_ph' : 'fn_ph');
    const tl = g('txt').l || t('gr_a_text'); tx.setAttribute('aria-label', tl); tx.title = tl;
    if (g('txt').req) tx.setAttribute('aria-required', 'true'); else tx.removeAttribute('aria-required');
    const w = $('fnpwit'), wl = g('wit').l; w.placeholder = wl ? t('fb_wit_ph', { l: wl }) : t('fn_wit'); w.setAttribute('aria-label', wl || t('gr_a_wit')); w.title = wl || t('gr_a_wit');
    if (g('wit').req) w.setAttribute('aria-required', 'true'); else w.removeAttribute('aria-required');
    $('secwit').classList.toggle('req', !!g('wit').req);
    const sm = $('secmore'); if (sm) sm.querySelector('summary').textContent = g('more').l || t('gr_more_s');
    for (const k of ['wit', 'more', 'time']) { const h = $('sech' + k); if (h) { h.textContent = g(k).h || ''; h.hidden = !g(k).h; } }
  }
  /* Werte zum Speichern: nur ausgefüllte; Werte gelöschter oder ausgeblendeter Felder einer geänderten Notiz bleiben */
  function fbOut() { const bd = new Set(FB.defs.filter(b => b.bind).map(b => b.id)), o = {}; for (const [k, v] of Object.entries(FNP.fv || {})) if (!Felder.isEmpty(v) && !bd.has(k)) o[k] = v; return o; }   // Standard-Felder gehen nach witness/ext
  /* Pflicht: einmal Hinweis, beim zweiten „Speichern“ wird trotzdem gespeichert (wie bei den Pflicht-Rubriken) */
  function fbReqOk() {
    const c = Felder.check(FNP.fv, $('fnpbody'), viewBlocks()), msg = $('fnpmsg'), g = k => FB.sec[k] || {};   // Pflicht nur für Bereiche, die diese Ansicht zeigt
    if (!viewHid('txt') && g('txt').req && !$('fnptext').value.trim()) c.miss.unshift(secLabel('txt'));
    if (!bndOf('witness') && !viewHid('wit') && g('wit').req && !$('fnpwit').value.trim()) c.miss.push(secLabel('wit'));
    if (c.bad.length) { msg.className = 'msg err'; msg.textContent = t('fb_bad', { l: c.bad.join(', ') }); return false; }
    const key = c.miss.join('|');
    if (c.miss.length && FNP.reqWarned !== key) { FNP.reqWarned = key; msg.className = 'msg warn'; msg.textContent = t('fb_req_miss', { l: c.miss.join(', ') }); return false; }
    return true;
  }
  /* Zähler: jeder Druck ein eigener Eintrag mit genauer Zeit (die Notiz in Arbeit bleibt, wie sie ist) */
  async function fbCount(b, d) {
    const now = nowMs(), msg = $('fnpmsg'), body = { action: 'add', from: dto(new Date(now)), cap: now, text: '', tags: [], src: srcVal(), fields: { [b.id]: d } }, info = { counter: true };
    const r = await Promise.resolve(H.saveNote(body, info)).catch(() => ({ ok: false }));
    if (!r.ok) { msg.className = 'msg err'; msg.textContent = t('fb_c_err'); return; }
    FB.counts[b.id] = (FB.counts[b.id] || 0) + d; Felder.countShow($('fnpbody'), b);
    msg.className = 'msg'; msg.textContent = '✓ ' + t('fb_c_done', { l: b.l, v: Felder.fmt(b, d), t: r.note && r.note.a ? fTime(r.note.a) : '', n: FB.counts[b.id] });
    clearTimeout(fbCount.tm); fbCount.tm = setTimeout(() => { if (msg.textContent.startsWith('✓')) msg.textContent = ''; }, 5000);
    hook('onSaved', r, body, info); fbLoad(true);
  }
  async function fbLoad(quiet) {
    try { Felder.load(await (await fetch('felder', { cache: 'no-store' })).json()); } catch (e) { }
    kindsLoaded();
    if (quiet) { hook('stats'); for (const b of viewBlocks()) if (b.type === 'counter') Felder.countShow($('fnpbody'), b); return; }
    fbApply();
  }
  function kindsLoaded() {                              // Arten geladen: Auswahl zeichnen; ohne Wahl die Vorgabe nehmen
    if (!FNP.edit && !FNP.kind && FB.kind_def && !FNP.from) kindSet(FB.kind_def);
    else if (FNP.kind && !Felder.kindOf(FNP.kind)) kindSet(''); else kindDraw();
  }
  function fbApply() {
    if (!LAY.on) { fbMount(); secApply(); secDraw(); }
    hook('stats'); tplFirst();
    hook('list');
  }
  /* Vorlagen: beim ersten Start anbieten (nicht aufdringlich, im Erfassen-Bereich) und in „Layout anpassen“ */
  function tplFirst() {
    const box = $('tplfirst'); if (!box) return;
    const on = FB.first && !FB.tpl; box.hidden = !on; if (!on) { box.innerHTML = ''; return; }
    Felder.tplBox(box, null, x => fbTpl(x, false), () => fbTpl(FB.linked ? 'laerm' : 'allg', false));   // „Später“: allein allgemein vorbelegt, mit GLighter lärm-spezifisch
  }
  async function fbTpl(name, ask) {
    if (ask && !pwin().confirm(t('fb_tpl_q', { n: t('fb_tpl_' + name) }))) return false;
    const j = await post('felder', { action: 'tpl', tpl: name, lang: H.lang() }).catch(() => ({ ok: false }));
    if (!j.ok) { H.toast(t('saveerr')); return false; }
    Felder.load(j); ntsApply(j.qt); hook('afterTpl', j);
    if (LAY.on) layClose();
    kindsLoaded(); fbApply(); fnpTags(); fnpShow(); hook('tagsChanged'); H.toast('✓ ' + t('fb_tpl_done', { n: t('fb_tpl_' + name) }));
    return true;
  }
  /* ---------- Layout anpassen: direkt auf dem Erfassen-Bildschirm (Ziehen mit Maus/Finger oder Pfeiltasten) ----------
     Änderungen sammeln sich in einem Entwurf; „Fertig“ schickt sie in einem Rutsch (notetags: batch), die Felder und
     Überschrift/Reihenfolge/Darstellung an den Speicherort der App. „Abbrechen“ verwirft alles. */
  const LAY = { on: false, d: null, focus: null };
  const SEC_ALL = { txt: 'fnptext', tags: 'fnptags', wit: 'secwit', more: 'secmore', time: 'sectime' };
  const SEC_L = { txt: 'fnp_p_txt', tags: 'fnp_p_tags', wit: 'fnp_p_wit', more: 'gr_more_p', time: 'gr_p_ext' };
  let SEC_EL = { txt: 'fnptext', tags: 'fnptags', wit: 'secwit', time: 'sectime' };
  const secs = () => Object.keys(SEC_EL);
  /* Reihenfolge der Bereiche: eingebaute und eigene Felder (Kennung b_…) gemeinsam */
  function capOrder(list, order) {                       // order: Reihenfolge einer Ansicht (ohne: die gerade gezeigte)
    const blocks = (list || Felder.active()).filter(b => !b.del).map(b => b.id), ok = x => SEC_EL[x] || blocks.includes(x);
    const wb = (list || Felder.active()).find(b => b.bind === 'witness' && !b.del), sw = x => x === 'wit' && wb ? wb.id : x;   // Zeuge als Feld: steht, wo der alte Bereich stand
    const src = order || viewGet(viewCur()).cap_order || [];
    const o = [...new Set(src.map(x => sw(x) === x || !src.includes(wb && wb.id) ? sw(x) : x).filter(ok))];
    return o.concat(secs().map(sw).concat(blocks).filter((x, i, a) => !o.includes(x) && a.indexOf(x) === i));
  }
  const secEl = k => Felder.isId(k) ? $('fb_' + k) : $(SEC_EL[k]);
  function secApply(order) {
    const body = $('fnpbody'); if (!body) return;
    for (const k of order || capOrder()) { const e = secEl(k); if (e && k !== 'time' && e.dataset.fold !== '1') body.appendChild(e); }   // eingeklappte Felder bleiben in „Mehr“
    const tm = secEl('time'), tx = secEl('txt'); if (tm) { if (tx && tx.parentElement === body) body.insertBefore(tm, tx); else body.prepend(tm); }   // „Zeit ändern“ immer direkt über dem Notiz-Textfeld
  }
  const hex6 = () => Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(16).padStart(2, '0')).join('');
  const layFlat = gs => gs.filter(g => !g.del).flatMap(g => g.keys);
  function layBuild(prof) {
    const ids = gIds();
    const groups = ids.map(g => {
      const gi = gInfo(g) || {}, col = (NTS.gcol || {})[g] || '';
      const rq = !!(NTS.req && NTS.req.has(g)), one = !!(NTS.gone && NTS.gone.has(g)), hp = (NTS.ghelp || {})[g] || '';
      return { g, l: gLabel(g), l0: gLabel(g), custom: gCustom(g), hide: !!gi.hide, hide0: !!gi.hide, col, col0: col, isNew: false, del: false, req: rq, req0: rq, one, one0: one, h: hp, h0: hp,
        keys: g === 'when' ? whenOrdered() : ntOrdered(ntAll().filter(k => { const gg = ntGroup(k); return (ids.includes(gg) && gg !== 'when' ? gg : 'own') === g; })) };
    });
    const keys = {};
    for (const gr of groups) for (const k of gr.keys) {
      const w = gr.g === 'when' ? WHEN.get(k) : null;
      keys[k] = { k, l: ntLabel(k), l0: ntLabel(k), kind: w ? 'when' : 'tag', own: w ? !!w.own : NTS.own[k] != null, hide: w ? !!w.hide : NTS.hide.has(k), hide0: w ? !!w.hide : NTS.hide.has(k), g0: gr.g, isNew: false, del: false };
    }
    const P = LP(), secs_ = capOrder(null, P.order || []), fb = JSON.parse(JSON.stringify({ blocks: FB.defs, sec: FB.sec, kinds: FB.kinds || [], kind_def: FB.kind_def || '', kind_keep: !!FB.kind_keep }));
    if (Array.isArray(P.hideSec)) for (const k of secs()) { if (P.hideSec.includes(k)) (fb.sec[k] = fb.sec[k] || {}).hide = true; else if (fb.sec[k]) delete fb.sec[k].hide; }   // „zeigen“ der eingebauten Bereiche liegt bei der App
    const dock = viewDock(), pop = viewGet('pop');
    LAY.d = { groups, keys, order0: layFlat(groups).join(), gorder0: groups.map(g => g.g).join(), secs: secs_, secs0: secs_.join(), title: P.title || '', sub: P.sub || '', width: P.width || 'wide', width0: P.width || 'wide',
      fb, fb0: JSON.stringify(Felder.strip(fb)), prof: 'dock', views: { dock, pop }, dock0: layVKey(dock), pop0: layVKey(pop), popSync: layVKey(pop), popOwn: !!P.pop, popFollow: false };
    if (prof === 'pop') layViewPut('pop');
  }
  /* Entwurf je Ansicht: Reihenfolge, Ausblenden der Bereiche/Felder und Rubriken stehen für die gerade bearbeitete Ansicht im
     Entwurf (d.secs, d.fb, d.groups); beim Umschalten werden sie in d.views getauscht. Die Darstellung steht direkt in d.views. */
  const layVKey = v => JSON.stringify([v.cap_order, [...v.hide].sort(), [...v.ghide].sort(), v.tipmode, v.dens, v.clock, v.style]);
  function layViewTake() {
    const d = LAY.d, v = d.views[d.prof];
    v.cap_order = d.secs.filter(k => SEC_EL[k] || d.fb.blocks.some(b => b.id === k && !b.del));
    v.hide = secs().filter(k => secHidden(k, d.fb.sec)).concat(d.fb.blocks.filter(b => b.hide && !b.del).map(b => b.id));
    v.ghide = d.groups.filter(g => g.hide && !g.del).map(g => g.g);
  }
  function layViewPut(p) {
    const d = LAY.d, v = d.views[p], h = new Set(v.hide), gh = new Set(v.ghide); d.prof = p;
    d.secs = capOrder(d.fb.blocks, v.cap_order);
    for (const k of secs()) { const s = d.fb.sec[k]; if (h.has(k)) (d.fb.sec[k] = s || {}).hide = true; else if (s && s.hide) { delete s.hide; if (!Object.keys(s).length) delete d.fb.sec[k]; } }
    for (const b of d.fb.blocks) { if (h.has(b.id)) b.hide = true; else delete b.hide; }
    for (const g of d.groups) g.hide = gh.has(g.g);
  }
  function layProf(p) {                                   // Ansicht im Editor wechseln (Vorschau sofort)
    const d = LAY.d; if (!d || d.prof === p) return;
    layViewTake();
    if (p === 'pop' && layFollows() && layVKey(d.views.pop) === d.popSync) { d.views.pop = JSON.parse(JSON.stringify(d.views.dock)); d.popSync = layVKey(d.views.pop); }   // folgt noch: aktuellen Stand von angedockt zeigen
    layViewPut(p); layBar(); layDraw(); fbPreview(); layDens();
    laySay(t('gr_lay_prof_now', { p: t(p === 'pop' ? 'gr_view_pop' : 'gr_view_dock') }));
  }
  const layFollows = () => !LAY.d.popOwn || LAY.d.popFollow;
  function layDens() { const d = LAY.d; if (d) lookApply(d.views[d.prof]); }
  function laySay(msg) { const e = $('laylive'); if (e) { e.textContent = ''; setTimeout(() => { e.textContent = msg; }, 30); } }
  function layOpen(prof) {
    if (LAY.on) return;
    if (H.ui.fold && $('fnpbody').hidden) foldSet(true);
    LAY.on = true; layBuild(prof || (popOn() ? 'pop' : 'dock'));   // im abgedockten Fenster: dessen Ansicht
    const pn = $('fnpanel'); pn.classList.add('lay'); $('laybtn').setAttribute('aria-pressed', 'true');
    const ce = 'plaintext-only';
    for (const [id, key, def] of [['capttl', 'title', t('fn_btn')], ['fnpfrom', 'sub', capWait()]]) {
      const e = $(id); e.textContent = LAY.d[key] || def; try { e.contentEditable = ce; } catch (x) { e.contentEditable = 'true'; }
      if (e.contentEditable !== ce) e.contentEditable = 'true';
      e.setAttribute('role', 'textbox'); e.setAttribute('aria-label', t(id === 'capttl' ? 'gr_lay_title' : 'gr_lay_sub')); e.tabIndex = 0; e.dataset.def = def;
      e.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); e.blur(); } };
    }
    layBar(); fnpTags(); fbPreview(); secDraw(); layDens(); $('laybar').querySelector('.laysec').focus();
  }
  function layClose() {
    LAY.on = false; LAY.d = null; hook('width');   // Abbrechen: gespeicherte Breite
    for (const id of ['capttl', 'fnpfrom']) { const e = $(id); e.removeAttribute('contenteditable'); e.removeAttribute('role'); e.removeAttribute('aria-label'); e.removeAttribute('tabindex'); e.onkeydown = null; }
    const pn = $('fnpanel'); pn.classList.remove('lay'); $('laybtn').setAttribute('aria-pressed', 'false'); $('laybar').hidden = true; $('laybar').innerHTML = '';
    viewLight(); fbMount(); secApply(); secDraw(); fnpTags(); fnpShow(); $('laybtn').focus();
  }
  /* Darstellung je Ansicht im Editor: Breite (nur angedockt), Uhr, Dichte, Tasten-Stil, Tipps – welche, sagt die App (viewOpts) */
  const VOPT = { width: ['gr_p_width', [['wide', 'gr_p_wide'], ['narrow', 'gr_p_narrow']]], clock: ['fc_o_clock', [['big', 'fc_o_clock_big'], ['small', 'fc_o_clock_small'], ['off', 'fc_o_clock_off']]],
    dens: ['gr_lay_dens', [['normal', 'gr_lay_dens_n'], ['compact', 'gr_lay_dens_c']]], style: ['fc_o_style', [['outline', 'fc_o_style_outline'], ['filled', 'fc_o_style_filled']]],
    tipmode: ['gr_lay_tips', [['hover', 'gr_lay_tm_h'], ['always', 'gr_lay_tm_a'], ['off', 'gr_lay_tm_o']]] };
  function layBar() {
    const bar = $('laybar'), d = LAY.d, v = d.views[d.prof], pop = d.prof === 'pop'; bar.hidden = false;
    const seg = (id, lab, k, vals, cur) => `<span class="layopt"><span class="laysl" id="${id}">${esc(t(lab))}</span><span class="seg" role="group" aria-labelledby="${id}">${vals.map(([x, l]) => `<button type="button" class="layob${cur === x ? ' on' : ''}" data-k="${k}" data-v="${x}" aria-pressed="${cur === x}">${esc(t(l))}</button>`).join('')}</span></span>`;
    const st = pop ? (d.popFollow || !d.popOwn ? t('gr_lay_pop_follow') : t('gr_lay_pop_own')) : t('gr_lay_dock_s');
    const opts = H.viewOpts.filter(k => VOPT[k] && !(k === 'width' && pop)).map(k => seg('lay' + k + 'l', VOPT[k][0], k, VOPT[k][1], k === 'width' ? d.width : v[k])).join('');
    bar.innerHTML = `<div class="layprof"><span class="laysl" id="laypl">${esc(t('gr_lay_prof'))}</span><span class="seg" role="group" aria-labelledby="laypl">${['dock', 'pop'].map(p => `<button type="button" class="laypb${d.prof === p ? ' on' : ''}" data-p="${p}" aria-pressed="${d.prof === p}">${p === 'pop' ? '⧉' : '▭'} ${esc(t(p === 'pop' ? 'gr_view_pop' : 'gr_view_dock'))}</button>`).join('')}</span>
        <small class="layps" id="layps">${esc(st)}</small>${pop && d.popOwn && !d.popFollow ? `<button type="button" class="btn" id="laypcopy">${esc(t('gr_lay_pop_copy'))}</button>` : ''}</div>
      <p class="layhint">${esc(t(pop ? 'gr_lay_hint_pop' : 'gr_lay_hint'))}</p>
      <div class="laytabs" role="tablist" aria-label="${esc(t('gr_lay'))}">${[['a', 'gr_lay_tab_a'], ['f', 'gr_lay_tab_f'], ['k', 'gr_lay_tab_k']].map(([x, l]) => `<button type="button" role="tab" class="laytab" id="laytab_${x}" data-tab="${x}" aria-controls="laypane_${x}">${esc(t(l))}</button>`).join('')}</div>
      <div class="laypane" id="laypane_a" role="tabpanel" aria-labelledby="laytab_a">
      <div class="laysecs"><span class="laysl" id="laysl">${esc(t('gr_lay_secs'))}</span><div class="laysbox" role="group" aria-labelledby="laysl"></div></div>
      <div class="laywid">${opts}
        </div></div>
      <div class="laypane" id="laypane_f" role="tabpanel" aria-labelledby="laytab_f"><div class="laytplrow"><span class="grow"></span><button type="button" class="btn" id="laytpl" aria-expanded="false" aria-controls="laytplbox">${esc(t('fb_tpl'))}</button></div>
      <div id="laytplbox" class="fbtplbox" hidden></div>
      <div id="layfb" class="layfb"></div></div>
      <div class="laypane" id="laypane_k" role="tabpanel" aria-labelledby="laytab_k"><div id="laykinds" class="layfb"></div></div>
      <div class="laybtns"><button type="button" class="btn" id="layreset">${esc(t('gr_reset'))}</button><span class="grow"></span><button type="button" class="btn" id="laycancel">${esc(t('cancel'))}</button><button type="button" class="btn primary" id="laydone">${esc(t('gr_lay_done'))}</button></div>
      <span class="sr" id="laylive" aria-live="polite"></span>`;
    layChips(); layFb(); layKinds();
    const tabs = [...bar.querySelectorAll('.laytab')], tabSet = (x, foc) => {            // Editor in Reitern statt einer langen Seite
      let cur = x; if (!tabs.some(b => b.dataset.tab === cur)) cur = 'a';
      tabs.forEach(b => { const on = b.dataset.tab === cur; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; b.classList.toggle('on', on); $('laypane_' + b.dataset.tab).hidden = !on; if (on && foc) b.focus(); });
      try { localStorage.setItem('gr_laytab', cur); } catch (e) { }
    };
    let tab0 = 'a'; try { tab0 = localStorage.getItem('gr_laytab') || 'a'; } catch (e) { }
    tabs.forEach((b, i) => { b.onclick = () => tabSet(b.dataset.tab); b.onkeydown = e => { const j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -9; if (j === -9) return; e.preventDefault(); tabSet(tabs[(j + tabs.length) % tabs.length].dataset.tab, true); }; });
    tabSet(tab0);
    bar.querySelectorAll('.layob').forEach(b => b.onclick = () => {                 // Darstellung – Vorschau sofort
      const k = b.dataset.k, x = b.dataset.v;
      if (k === 'width') { d.width = x; hook('width', x); } else { v[k] = x; layDens(); }
      bar.querySelectorAll(`.layob[data-k="${k}"]`).forEach(y => { const on = y.dataset.v === x; y.classList.toggle('on', on); y.setAttribute('aria-pressed', String(on)); });
    });
    bar.querySelectorAll('.laypb').forEach(b => b.onclick = () => { layProf(b.dataset.p); const f = $('laybar').querySelector(`.laypb[data-p="${b.dataset.p}"]`); if (f) f.focus(); });
    const cp = $('laypcopy'); if (cp) cp.onclick = () => {                            // abgedockt wieder wie angedockt (folgt danach den Änderungen)
      layViewTake(); d.views.pop = JSON.parse(JSON.stringify(d.views.dock)); d.popFollow = true; d.popSync = layVKey(d.views.pop); layViewPut('pop'); layBar(); layDraw(); fbPreview(); layDens();
      laySay(t('gr_lay_pop_copied')); const f = $('laybar').querySelector('.laypb[data-p="pop"]'); if (f) f.focus();
    };
    $('laytpl').onclick = () => { const box = $('laytplbox'), o = box.hidden; box.hidden = !o; $('laytpl').setAttribute('aria-expanded', String(o)); if (o) { Felder.tplBox(box, FB.tpl, x => fbTpl(x, true)); const f = box.querySelector('button'); if (f) f.focus(); } };
    $('layreset').onclick = layReset; $('laycancel').onclick = layClose; $('laydone').onclick = laySave;
  }
  /* Bereiche (eingebaute und eigene Felder) als Chips: Ziehen oder Pfeiltasten */
  function layChips(focus) {
    const d = LAY.d, box = $('laybar').querySelector('.laysbox'); if (!box) return;
    d.secs = d.secs.filter(k => SEC_EL[k] || d.fb.blocks.some(b => b.id === k && !b.del));
    const off = k => Felder.isId(k) ? !!(d.fb.blocks.find(b => b.id === k) || {}).hide : secHidden(k, d.fb.sec);
    const fo = k => (Felder.isId(k) && (d.fb.blocks.find(b => b.id === k) || {}).fold) || (k === 'wit' && d.fb.blocks.some(b => b.bind === 'witness'));
    box.innerHTML = d.secs.filter(k => !fo(k)).map((k, i) => `<button type="button" class="laysec${off(k) ? ' off' : ''}" data-sec="${esc(k)}" data-drag="sec" aria-label="${esc(t('gr_lay_sec_a', { s: secLabel(k, d.fb.sec, d.fb.blocks), i: i + 1, n: d.secs.length }) + (off(k) ? ', ' + t('gr_lay_hidden') : ''))}"><span aria-hidden="true">⠿</span> ${esc(secLabel(k, d.fb.sec, d.fb.blocks))}</button>`).join('');
    box.querySelectorAll('.laysec').forEach(b => b.onkeydown = e => {
      const i = d.secs.indexOf(b.dataset.sec), j = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : -2;
      if (j === -2) return; e.preventDefault(); if (j < 0 || j >= d.secs.length) return;
      d.secs.splice(j, 0, d.secs.splice(i, 1)[0]); secApply(d.secs); layChips(b.dataset.sec); layFb();
      laySay(t('gr_lay_moved', { s: secLabel(b.dataset.sec, d.fb.sec, d.fb.blocks), i: j + 1, n: d.secs.length }));
    });
    if (focus) { const f = box.querySelector(`.laysec[data-sec="${CSS.escape(focus)}"]`); if (f) f.focus(); }
  }
  /* Einstellungen je Bereich/Feld (Name, Hinweis, Pflicht, zeigen, Art-Einstellungen), neue Felder, Vorschau sofort */
  function layFb(focusId) {
    const d = LAY.d, box = $('layfb'); if (!box) return;
    const opened = new Set([...box.querySelectorAll('details.fbed[open]')].map(x => x.dataset.id));
    const bw = d.fb.blocks.some(b => b.bind === 'witness');           // Zeuge als Feld: alter Bereich nicht mehr in der Liste
    const items = d.secs.filter(k => !(k === 'wit' && bw)).map(k => SEC_EL[k] ? { k, l: t(SEC_L[k]), req: k === 'txt' || k === 'wit', help: k !== 'tags' } : { b: d.fb.blocks.find(b => b.id === k) }).filter(x => x.k || (x.b && !x.b.del));
    Felder.editor(box, d.fb, items, {
      change: (id, redraw) => { if (redraw) { layChips(); layFb(); } else layChips(); fbPreview(); },
      say: laySay,
      add: (type, b) => {
        if (type === 'pills') { layAddGroup(); return; }
        d.secs.push(b.id); layChips(); layFb(b.id); fbPreview();
      }
    });
    box.querySelectorAll('details.fbed').forEach(x => { if (opened.has(x.dataset.id)) x.open = true; });
    if (focusId) { const r = box.querySelector(`details.fbed[data-id="${CSS.escape(focusId)}"]`); if (r) { r.open = true; const i = r.querySelector('.fe_l'); i.focus(); i.select(); r.scrollIntoView({ block: 'nearest' }); } }
  }
  function layKinds() {                                 // Notiz-Arten verwalten (Vorschau sofort in der Erfassung)
    const box = $('laykinds'), d = LAY.d; if (!box || !d) return;
    Felder.kindsEditor(box, d.fb, { change: () => { const keep = { kinds: FB.kinds }; FB.kinds = d.fb.kinds.filter(k => !k.del); kindDraw(); FB.kinds = keep.kinds; }, say: laySay });
  }
  function fbPreview() {
    const d = LAY.d; if (!d) return; fbMount(d.fb.blocks, d.fb.sec); secApply(d.secs);
    for (const k of secs()) { const x = $(SEC_EL[k]); if (x) x.dataset.secel = k; }
    const sm = $('secmore'); if (sm && sm.querySelector('#fbmore .fbblk') && 'open' in sm) sm.open = true;   // eingeklappte Felder beim Bearbeiten sichtbar
    Felder.inlineEdit($('fnpbody'), d.fb, {                      // jedes Feld (auch Zeuge, „Mehr“) direkt am Element bearbeiten, wie die Rubriken
      change: () => { layChips(); layFb(); fbPreview(); },
      say: laySay,
      open: id => { const tb = $('laytab_f'); if (tb) tb.click(); const r = $('layfb') && $('layfb').querySelector(`details.fbed[data-id="${CSS.escape(id)}"]`); if (!r) return; r.open = true; r.scrollIntoView({ block: 'center' }); const i = r.querySelector('.fe_l'); if (i) i.focus(); },
      move: (id, to) => { const i = d.secs.indexOf(id); if (i < 0) return; const j = typeof to === 'number' ? i + to : d.secs.indexOf(to); if (j < 0 || j >= d.secs.length || j === i) return;
        d.secs.splice(j, 0, d.secs.splice(i, 1)[0]); secApply(d.secs); layChips(); layFb(); fbPreview(); laySay(t('gr_lay_moved', { s: secLabel(id, d.fb.sec, d.fb.blocks), i: j + 1, n: d.secs.length }));
        const f = $('fnpbody').querySelector(`.fbblk[data-b="${CSS.escape(id)}"] .hd`); if (f) f.focus(); }
    });
  }
  function layFind(k) { return LAY.d.groups.find(g => g.keys.includes(k)); }
  function layDraw() {
    const box = $('fnptags'), d = LAY.d; if (!box || !d) return;
    const cnt = d.groups.filter(g => !g.del).length;
    let h = '<div class="laygs">';
    d.groups.filter(g => !g.del).forEach((gr, gi) => {
      const kind = gr.g === 'when' ? 'when' : 'tag', col = gr.col || gColor(gr.g) || G_DEF[gr.g] || '#5f6b78';
      h += `<div class="layg${gr.hide ? ' off' : ''}" data-g="${esc(gr.g)}" style="--gc:${esc(col)}">
        <div class="laygh"><button type="button" class="hd" data-drag="grp" aria-label="${esc(t('gr_lay_grp_a', { g: gr.l, i: gi + 1, n: cnt }))}" title="${esc(t('gr_drag'))}">⠿</button>
          <input type="text" class="lgn" maxlength="30" value="${esc(gr.l)}" aria-label="${esc(t('gr_lay_gname'))}">
          <input type="color" class="lgc" value="${esc(/^#[0-9a-f]{6}$/i.test(col) ? col : '#5f6b78')}" aria-label="${esc(t('gr_gcol', { g: gr.l }))}" title="${esc(t('gr_gcol', { g: gr.l }))}">
          <label class="check"><input type="checkbox" class="lgh"${gr.hide ? '' : ' checked'}> ${esc(t('gr_shown'))}</label>
          <label class="check" title="${esc(t('gr_req_tip'))}"><input type="checkbox" class="lgr"${gr.req ? ' checked' : ''}> ${esc(t('fb_ed_req'))}</label>
          ${kind === 'when' ? '' : `<label class="check"><input type="checkbox" class="lgo"${gr.one ? ' checked' : ''}> ${esc(t('fb_g_one'))}</label>`}
          ${gr.custom ? `<button type="button" class="lgd" aria-label="${esc(t('gr_lay_gdel', { g: gr.l }))}" title="${esc(t('gr_lay_gdel', { g: gr.l }))}">🗑</button>` : ''}</div>
        <div class="laygx"><input type="text" class="lgx" maxlength="160" value="${esc(gr.h || '')}" placeholder="${esc(t('fb_ed_help'))}" aria-label="${esc(t('fb_g_help', { g: gr.l }))}"></div>
        <div class="laykeys" data-kind="${kind}">${gr.keys.map(k => d.keys[k]).filter(x => x && !x.del).map(x => `<span class="layk tag ${gAttr(kind === 'when' ? 'when' : gr.g).replace('"', x.hide ? ' off"' : '"')} data-k="${esc(x.k)}"><button type="button" class="lkn" data-drag="key" aria-label="${esc(t('gr_lay_key_a', { k: x.l, g: gr.l }) + (x.hide ? ', ' + t('gr_lay_hidden') : ''))}">${esc(x.l)}</button><button type="button" class="lkx" aria-label="${esc(t(x.own ? 'gr_lay_kdel' : x.hide ? 'gr_lay_kshow' : 'gr_lay_khide', { k: x.l }))}" title="${esc(t(x.own ? 'gr_lay_kdel' : x.hide ? 'gr_lay_kshow' : 'gr_lay_khide', { k: x.l }))}">${x.own ? '✕' : x.hide ? '○' : '●'}</button></span>`).join('')}<button type="button" class="tag add lka">＋ ${esc(t(kind === 'when' ? 'gr_lay_wadd' : 'gr_lay_kadd'))}</button></div>
      </div>`;
    });
    h += `<span class="lgaw"><button type="button" class="btn lga" aria-haspopup="menu" aria-expanded="false">＋ ${esc(t('gr_lay_gadd'))}</button></span></div>`;
    box.innerHTML = h;
    box.querySelectorAll('.layg').forEach(row => {
      const gr = d.groups.find(g => g.g === row.dataset.g);
      row.querySelector('.lgn').onchange = e => { const v = e.target.value.trim(); if (v) gr.l = v.slice(0, 30); else e.target.value = gr.l; };
      row.querySelector('.lgc').oninput = e => { gr.col = e.target.value; row.style.setProperty('--gc', gr.col); };
      row.querySelector('.lgh').onchange = e => { gr.hide = !e.target.checked; row.classList.toggle('off', gr.hide); };
      row.querySelector('.lgr').onchange = e => { gr.req = e.target.checked; };
      const lo = row.querySelector('.lgo'); if (lo) lo.onchange = e => { gr.one = e.target.checked; };
      row.querySelector('.lgx').oninput = e => { gr.h = e.target.value.trim(); };
      const del = row.querySelector('.lgd'); if (del) del.onclick = () => {   // Rückfrage im Knopf (kein Browser-Fenster)
        Felder.sure(del, t('gr_lay_gdel_q', { g: gr.l }), () => {
        const own = d.groups.find(g => g.g === 'own'); own.keys.push(...gr.keys); gr.keys = []; gr.del = true; layDraw(); laySay(t('gr_lay_gdeleted', { g: gr.l }));
        });
      };
      row.querySelector('.hd').onkeydown = e => layMoveGroup(e, gr);
      row.querySelector('.lka').onclick = () => layAddKey(row, gr);
    });
    box.querySelectorAll('.layk').forEach(chip => {
      const k = chip.dataset.k, x = d.keys[k];
      const nb = chip.querySelector('.lkn');
      nb.onclick = () => { if (!LAY.dragged) layRename(chip, x); };
      nb.onkeydown = e => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); layKeyX(x, chip.querySelector('.lkx')); } else layMoveKey(e, x); };
      chip.querySelector('.lkx').onclick = ev => layKeyX(x, ev.currentTarget);
    });
    box.querySelector('.lga').onclick = ev => Felder.addMenu(ev.currentTarget, ty => {   // Klick öffnet die Typauswahl: Tasten → neue Rubrik, sonst neues Feld
      if (ty === 'pills') { layAddGroup(); return; }
      const b = Felder.addDef(d.fb, ty); if (!b) { laySay(t('fb_ed_limit', { n: Felder.S.max })); return; }
      d.secs.push(b.id); layChips(); layFb(); fbPreview(); laySay(t('fb_ed_added', { l: b.l }));
      const f = $('fnpbody').querySelector(`.fbblk[data-b="${CSS.escape(b.id)}"] .fil_l`); if (f) { f.focus(); f.select(); f.scrollIntoView({ block: 'center' }); } });
    if (LAY.focus) { const f = box.querySelector(LAY.focus); LAY.focus = null; if (f) { f.focus(); if (f.classList.contains('lgn')) f.select(); } }
  }
  function layAddGroup() {                              // neue Pillen-Rubrik (auch über „Feld hinzufügen“)
    const d = LAY.d, l = t('gr_lay_gnew');                // ohne prompt() (erscheint in der HA-App nicht): Name direkt in der Leiste ändern
    const g = 'g_' + hex6(); d.groups.splice(d.groups.findIndex(x => x.g === 'own'), 0, { g, l: l.trim().slice(0, 30), l0: '', custom: true, hide: false, hide0: false, col: '', col0: '', isNew: true, del: false, req: false, req0: false, one: false, one0: false, h: '', h0: '', keys: [] });
    LAY.focus = `.layg[data-g="${g}"] .lgn`; layDraw(); laySay(t('fb_ed_added', { l: l.trim() }));
  }
  function layKeyX(x, btn) {                                  // eigene Taste löschen, eingebaute ein-/ausblenden
    if (x.own) {                                        // eigene Taste: Rückfrage im Knopf (kein Browser-Fenster, das in der HA-App nicht erscheint)
      const bt = btn || ($('fnptags') && $('fnptags').querySelector(`.layk[data-k="${CSS.escape(x.k)}"] .lkx`)); if (!bt) return;
      Felder.sure(bt, t('qt_del_q', { n: x.l }), () => { x.del = true; const g = layFind(x.k); if (g) g.keys = g.keys.filter(k => k !== x.k); laySay(t('gr_lay_kdeleted', { k: x.l })); layDraw(); }); return; }
    else { x.hide = !x.hide; LAY.focus = `.layk[data-k="${x.k}"] .lkx`; laySay(t(x.hide ? 'gr_lay_khidden' : 'gr_lay_kshown', { k: x.l })); }
    layDraw();
  }
  function layRename(chip, x) {
    const nb = chip.querySelector('.lkn'), inp = chip.ownerDocument.createElement('input'); Object.assign(inp, { type: 'text', className: 'lkin', value: x.l, maxLength: 30 });
    inp.setAttribute('aria-label', t('qt_ren')); nb.replaceWith(inp); inp.focus(); inp.select();
    let done = false;
    const fin = ok => { if (done) return; done = true; const v = inp.value.trim(); if (ok && v) x.l = v.slice(0, 30); LAY.focus = `.layk[data-k="${x.k}"] .lkn`; layDraw(); };
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); fin(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fin(false); } };
    inp.onblur = () => fin(true);
  }
  function layAddKey(row, gr) {
    const keysBox = row.querySelector('.laykeys'), add = keysBox.querySelector('.lka'), when = gr.g === 'when';
    const f = row.ownerDocument.createElement('span'); f.className = 'lkform';
    f.innerHTML = `<input type="text" class="lkin" maxlength="30" aria-label="${esc(t('gr_lay_kname'))}" placeholder="${esc(t('gr_lay_kname'))}">${when ? `<input type="text" class="lkin lkt" maxlength="5" aria-label="${esc(t('gr_lay_wspec'))}" placeholder="${esc(t('gr_lay_wspec_ph'))}">` : ''}<button type="button" class="chip">${esc(t('qt_create'))}</button>`;
    add.replaceWith(f); const [n, sp] = f.querySelectorAll('input'); n.focus();
    const go = () => {
      const l = n.value.trim(); if (!l) { layDraw(); return; }
      const k = (when ? 't_' : 'c_') + hex6(), x = { k, l: l.slice(0, 30), l0: l, kind: when ? 'when' : 'tag', own: true, hide: false, g0: gr.g, isNew: true, del: false };
      if (when) { const v = (sp.value || '').trim(); if (/^\d{1,2}:\d\d$/.test(v)) x.at = v; else if (/^\d+$/.test(v)) x.m = +v; else { sp.focus(); sp.setAttribute('aria-invalid', 'true'); H.toast(t('gr_lay_wspec_bad')); return; } }
      LAY.d.keys[k] = x; gr.keys.push(k); LAY.focus = `.layg[data-g="${gr.g}"] .lka`; layDraw(); laySay(t('gr_lay_kadded', { k: l }));
    };
    f.querySelector('button').onclick = go;
    f.querySelectorAll('input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); layDraw(); } });
  }
  function layMoveKey(e, x) {                            // ←/→ innerhalb der Rubrik, ↑/↓ in die vorige/nächste Rubrik (gleiche Art)
    const d = LAY.d, gr = layFind(x.k); if (!gr) return;
    const vis = gr.keys.filter(k => !d.keys[k].del), i = vis.indexOf(x.k);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault(); const j = i + (e.key === 'ArrowLeft' ? -1 : 1); if (j < 0 || j >= vis.length) return;
      const a = gr.keys.indexOf(x.k), b = gr.keys.indexOf(vis[j]); [gr.keys[a], gr.keys[b]] = [gr.keys[b], gr.keys[a]];
      laySay(t('gr_lay_moved', { s: x.l, i: j + 1, n: vis.length }));
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault(); if (x.kind === 'when') return;
      const gs = d.groups.filter(g => !g.del && g.g !== 'when'), gi = gs.indexOf(gr), ng = gs[gi + (e.key === 'ArrowUp' ? -1 : 1)]; if (!ng) return;
      gr.keys = gr.keys.filter(k => k !== x.k); ng.keys.splice(Math.min(i, ng.keys.length), 0, x.k);
      laySay(t('gr_lay_moved_g', { k: x.l, g: ng.l }));
    } else return;
    LAY.focus = `.layk[data-k="${x.k}"] .lkn`; layDraw();
  }
  function layMoveGroup(e, gr) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return; e.preventDefault();
    const gs = LAY.d.groups, i = gs.indexOf(gr); let j = i;
    do { j += e.key === 'ArrowUp' ? -1 : 1; } while (gs[j] && gs[j].del);
    if (j < 0 || j >= gs.length) return;
    gs.splice(i, 1); gs.splice(j, 0, gr);
    const vis = gs.filter(g => !g.del); laySay(t('gr_lay_moved', { s: gr.l, i: vis.indexOf(gr) + 1, n: vis.length }));
    LAY.focus = `.layg[data-g="${gr.g}"] .hd`; layDraw();
  }
  function layFromDom() {                                // nach dem Ziehen: Reihenfolge aus dem Bildschirm übernehmen
    const d = LAY.d, box = $('fnptags');
    const order = [...box.querySelectorAll('.layg')].map(r => r.dataset.g), pos = g => order.indexOf(g) < 0 ? 1e6 : order.indexOf(g);
    d.groups.sort((a, b) => pos(a.g) - pos(b.g));
    for (const r of box.querySelectorAll('.layg')) {
      const gr = d.groups.find(g => g.g === r.dataset.g), seen = [...r.querySelectorAll('.layk')].map(c => c.dataset.k);
      gr.keys = seen.concat(gr.keys.filter(k => d.keys[k].del && !seen.includes(k)));
    }
    const bs = [...$('laybar').querySelectorAll('.laysec')].map(b => b.dataset.sec); if (bs.length) d.secs = bs;
  }
  function layPointer(e) {                               // Ziehen mit Maus, Stift oder Finger
    if (!LAY.on || e.button !== 0) return;
    const h = e.target.closest('[data-drag]'); if (!h) return;
    const kind = h.dataset.drag, item = kind === 'key' ? h.closest('.layk') : kind === 'grp' ? h.closest('.layg') : h;
    const x0 = e.clientX, y0 = e.clientY, doc = item.ownerDocument, win = doc.defaultView || window; let on = false;   // auch im abgedockten Fenster
    const move = ev => {
      if (!on) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; on = true; item.classList.add('dragging'); }
      ev.preventDefault();
      const u = doc.elementFromPoint(ev.clientX, ev.clientY); if (!u) return;
      if (kind === 'key') {
        const box = u.closest('.laykeys'); if (!box || box.dataset.kind !== item.parentNode.dataset.kind) return;
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
      item.classList.remove('dragging'); layFromDom(); LAY.dragged = true; setTimeout(() => { LAY.dragged = false; }, 0);
      if (kind === 'sec') { secApply(LAY.d.secs); layChips(); layFb(); } else layDraw();
    };
    win.addEventListener('pointermove', move, { passive: false }); win.addEventListener('pointerup', end); win.addEventListener('pointercancel', end);
  }
  async function laySave() {
    const d = LAY.d, ops = [];
    layFromDom(); layViewTake();
    const dockV = d.views.dock, popV = d.views.pop, pk = layVKey(popV), P = LP();
    if (d.prof !== 'dock') layViewPut('dock');            // Entwurf zurück auf angedockt: Ausblenden dort bei den Feldern und Rubriken
    let popOut;                                           // undefined = unverändert, null = folgt angedockt, sonst eigene Ansicht
    if (layFollows() && (pk === d.popSync || pk === layVKey(dockV))) { if (P.pop) popOut = null; }
    else if (layFollows() || pk !== d.pop0) { popOut = { cap_order: popV.cap_order, hide: popV.hide, ghide: popV.ghide }; for (const k of LOOK) if (popV[k] !== undefined) popOut[k] = popV[k]; }
    const where = {}; for (const gr of d.groups) for (const k of gr.keys) where[k] = gr.g;
    for (const gr of d.groups) if (gr.isNew && !gr.del) ops.push({ action: 'gadd', g: gr.g, l: gr.l });
    for (const x of Object.values(d.keys)) {
      if (x.isNew) { if (x.del) continue; ops.push(x.kind === 'when' ? Object.assign({ action: 'wadd', k: x.k, l: x.l }, x.at ? { at: x.at } : { m: x.m || 0 }) : { action: 'add', k: x.k, l: x.l, g: where[x.k] }); continue; }
      if (x.del) { ops.push({ action: 'del', k: x.k }); continue; }
      if (x.l !== x.l0) ops.push({ action: 'ren', k: x.k, l: x.l });
      if (x.hide !== x.hide0 && !x.own) ops.push({ action: 'hide', k: x.k, on: x.hide });
      if (x.kind === 'tag' && where[x.k] && where[x.k] !== x.g0 && where[x.k] !== 'when') ops.push({ action: 'grp', k: x.k, g: where[x.k] });
    }
    for (const gr of d.groups) {
      if (gr.isNew) { if (!gr.del) { if (gr.hide) ops.push({ action: 'ghide', g: gr.g, on: true }); if (gr.col) ops.push({ action: 'gcol', g: gr.g, c: gr.col }); if (gr.req) ops.push({ action: 'req', g: gr.g, on: true }); if (gr.one) ops.push({ action: 'gone', g: gr.g, on: true }); if (gr.h) ops.push({ action: 'ghelp', g: gr.g, h: gr.h }); } continue; }
      if (gr.del) { ops.push({ action: 'gdel', g: gr.g }); continue; }
      if (gr.l !== gr.l0) ops.push({ action: 'gren', g: gr.g, l: gr.l });
      if (gr.hide !== gr.hide0) ops.push({ action: 'ghide', g: gr.g, on: gr.hide });
      if (gr.col !== gr.col0) ops.push({ action: 'gcol', g: gr.g, c: gr.col });
      if (gr.req !== gr.req0) ops.push({ action: 'req', g: gr.g, on: gr.req });
      if (gr.one !== gr.one0) ops.push({ action: 'gone', g: gr.g, on: gr.one });
      if (gr.h !== gr.h0) ops.push({ action: 'ghelp', g: gr.g, h: gr.h });
    }
    if (layFlat(d.groups).filter(k => !d.keys[k].del).join() !== d.order0.split(',').filter(k => d.keys[k] && !d.keys[k].del).join()) ops.push({ action: 'order', keys: layFlat(d.groups).filter(k => !d.keys[k].del) });
    const gs = d.groups.filter(g => !g.del).map(g => g.g); if (gs.join() !== d.gorder0) ops.push({ action: 'gorder', groups: gs });
    const tt = $('capttl').textContent.trim(), ts = $('fnpfrom').textContent.trim();
    const pf = { title: tt === $('capttl').dataset.def ? '' : tt.slice(0, 60), sub: ts === $('fnpfrom').dataset.def ? '' : ts.slice(0, 160) };
    const secs_ = d.secs.filter(k => SEC_EL[k] || d.fb.blocks.some(b => b.id === k && !b.del));
    if (secs_.join() !== d.secs0) pf.order = secs_;
    if (d.width !== d.width0) pf.width = d.width;
    const cur = viewDock(); for (const k of LOOK) if (dockV[k] !== undefined && dockV[k] !== cur[k]) pf[k] = dockV[k];
    if (popOut !== undefined) pf.pop = popOut;
    const fbNew = Felder.strip(d.fb);
    try {
      if (JSON.stringify(fbNew) !== d.fb0) {                // eigene Felder zuerst (Reihenfolge darf auf neue Felder zeigen)
        const j = await H.layout.saveFb(fbNew);           // die App lädt die Felder danach selbst (Felder.load)
        if (!j || !j.ok) throw new Error('felder');
        kindsLoaded();
        if ((j.errors || []).some(x => /limit/.test(x))) H.toast(t('fb_ed_limit', { n: FB.max }), 6000);
      }
      if (ops.length) {
        const j = await post('notetags', { action: 'batch', ops });
        if (j.ok) { ntsApply(j); hook('tagsChanged'); }
        if (j.errors && j.errors.length) H.toast(t('gr_lay_errs', { n: j.errors.length }) + (j.errors.some(x => x.error === 'limit_free') ? ' ' + t('gr_qt_limit_free', { n: NTS.max }) : j.errors.some(x => x.error === 'limit') ? ' ' + t('qt_limit') : ''), 6000);
      }
      if (pf.title !== (P.title || '') || pf.sub !== (P.sub || '') || pf.order || pf.width || LOOK.some(k => k in pf) || 'pop' in pf) {
        const ok = await H.layout.save(pf); if (ok === false) throw new Error('prefs');
      }
      H.toast('✓ ' + t('gr_lay_saved'));
    } catch (x) { H.toast(t('saveerr')); return; }
    layClose(); fbApply(); viewApply();
  }
  async function layReset() {
    if (!pwin().confirm(t('gr_lay_reset_q'))) return;
    try {
      const j = await post('notetags', { action: 'reset' }); if (j.ok) { ntsApply(j); hook('tagsChanged'); }
      if ((await H.layout.reset()) === false) throw new Error('reset');   // Überschrift, Reihenfolge, Darstellung; abgedockt folgt wieder; eigene Felder bleiben
    } catch (x) { H.toast(t('saveerr')); return; }
    layBuild(LAY.d ? LAY.d.prof : 'dock'); fbPreview(); hook('width'); layDens();
    for (const [id, def] of [['capttl', $('capttl').dataset.def], ['fnpfrom', $('fnpfrom').dataset.def]]) $(id).textContent = def;
    layBar(); layDraw(); laySay(t('gr_lay_reset_done'));
  }
  /* ---------- Einklappen (z. B. GLighter auf dem Handy: Live-Bild oben) ---------- */
  function foldSet(open) {
    const f = H.ui.fold; if (!f) return;
    $('fnpbody').hidden = !open; $('fnptog').setAttribute('aria-expanded', open ? 'true' : 'false'); $('fnpanel').classList.toggle('shut', !open);
    try { localStorage.setItem(f.key, open ? '1' : '0'); } catch (e) { }
  }
  /* ---------- Bildschirm: Aufbau (gleich in beiden Apps; Zusätze nur über den Adapter) ---------- */
  function markup() {
    const u = H.ui;
    return `<div class="caphead">
      <div class="clock"><time id="capclock" class="clocknum">--:--:--</time><span id="capdate" class="clockdate"></span></div>
      <div class="capinfo"><b id="capttl"></b><small id="fnpfrom"></small></div>
      <button type="button" id="laybtn" class="icon" data-ia="gr_lay" aria-pressed="false">▦</button>${u.head || ''}
      <button type="button" id="fnppop" class="icon" data-ia="pop_tip">⧉</button>${u.fold ? '<button type="button" id="fnptog" class="icon" data-ia="fc_fold" aria-expanded="true" aria-controls="fnpbody">▾</button>' : ''}
    </div>${u.tplFirst ? '<div id="tplfirst" class="fbtplbox first" role="region" data-ia="fb_tpl_title" hidden></div>' : ''}
    <div id="laybar" class="laybar" role="region" data-ia="gr_lay" hidden></div>
    <div id="fnpbody" class="capbody">
      <div id="secbar" class="secbar" role="group" data-ia="gr_sec_tip"></div>
      <div id="fnpkinds" class="fbkinds" hidden></div>
      <textarea id="fnptext" rows="2" maxlength="500" data-iph="fn_ph" data-ia="gr_a_text"></textarea>
      <div id="fnptags" class="groups"></div>
      <div class="witrow" id="secwit"><span class="witicon" aria-hidden="true">👤</span><input type="text" id="fnpwit" maxlength="${+u.witMax || 200}" data-iph="fn_wit" data-ia="gr_a_wit">${u.witExtra || ''}
        <small id="sechwit" class="fbhelp" hidden></small>${u.tips ? '<div class="tipslot" data-tips="4"></div>' : ''}</div>${u.more != null ? `
      <details class="more" id="secmore"><summary data-i="gr_more_s"></summary>
        <small id="sechmore" class="fbhelp" hidden></small>
        <div id="fbmore" class="fbmore"></div>${u.more}
      </details>` : ''}
      <div class="timerow" id="sectime">
        <button type="button" id="fnptimebtn" class="linkbtn" aria-expanded="false" aria-controls="fnpext"><span aria-hidden="true">🕒</span> <span id="fnptimetxt"></span></button>
        <small id="sechtime" class="fbhelp" hidden></small>
        <div id="fnpext" class="timeedit" hidden>
          <label><span data-i="per_from"></span><input type="datetime-local" id="fnpfromi" step="1"><button type="button" id="fnpfnow" class="chip" data-i="fn_now"></button></label>
          <label><span data-i="per_to"></span><input type="datetime-local" id="fnptoi" step="1"><button type="button" id="fnptnow" class="chip" data-i="fn_now"></button><button type="button" id="fnptclr" class="chip" data-ia="time_clear">✕</button></label>${u.src ? `
          <label class="tesrc"><span data-i="src_col"></span><select id="fnpsrc"></select></label>` : ''}
          <label class="check"><input type="checkbox" id="fnprun"> <span data-i="fnp_run"></span></label>
          <label class="check"><input type="checkbox" id="fnpnotime"> <span data-i="gr_notime"></span></label>
        </div>
      </div>
    </div>${u.tips ? '<div class="tipslot captip" data-tips="cap"></div>' : ''}${u.att ? '<div id="fnpatts" class="attpend" hidden></div>' : ''}
    <div class="savebar">${u.att ? `
      <button type="button" id="fnpatt" class="icon" data-ia="gr_att_add">📎</button>
      <button type="button" id="fnpcam" class="icon" data-ia="gr_att_cam" hidden>📷</button>` : ''}
      <small id="fnpmsg" class="msg" role="status" aria-live="polite"></small>
      <button type="button" id="fnpcancel" class="btn" data-i="cancel" hidden></button>
      <button type="button" id="fnpsave" class="btn primary" data-i="save"></button>
    </div>`;
  }
  /* Einhängen: Bildschirm aufbauen und bedienbar machen (vor dem ersten Laden der Daten) */
  function mount(panel) {
    panel = panel || document.getElementById('fnpanel'); if (!panel) return;
    SEC_EL = {}; for (const k of H.secs) if (SEC_ALL[k]) SEC_EL[k] = SEC_ALL[k];
    if (H.ui.more == null) delete SEC_EL.more;
    panel.classList.add('capture'); panel.innerHTML = markup(); trIn(panel);
    initFnp(); initLay(); fnpShow();
  }
  function initFnp() {
    let open = true;
    if (H.ui.fold) { open = H.ui.fold.open ? H.ui.fold.open() : true; try { const v = localStorage.getItem(H.ui.fold.key); if (v != null) open = v !== '0'; } catch (e) { } foldSet(open);
      $('fnptog').onclick = () => { const o = $('fnpbody').hidden; foldSet(o); if (o) $('fnptext').focus(); }; }
    fnpTags(); fnpShow(); secDraw();
    $('fnppop').onclick = fnPop;
    $('fnptext').addEventListener('input', () => { if ($('fnptext').value.trim()) fnpStart(); });
    $('fnpwit').addEventListener('input', () => { if ($('fnpwit').value.trim()) fnpStart(); });
    $('fnprun').onchange = () => { fnpStart(); fnpShow(); };
    $('fnpsave').onclick = fnpSave; $('fnpcancel').onclick = fnpReset;
    for (const ev of ['input', 'change']) $('fnpanel').addEventListener(ev, () => { if (ASV.until) autoSaveCheck(); }, true);   // Eingabe während des Countdowns: neu starten
    enterSave($('fnptext'), fnpSave);
    $('fnptimebtn').onclick = () => timeEdit($('fnpext').hidden);
    const manual = () => { FNP.manual = true; FNP.timeTouched = true; FNP.approx = false; FNP.pend = null; };   // von Hand gesetzt: hat Vorrang vor Zeit-Tasten
    $('fnpfnow').onclick = () => { FNP.fixed = false; manual(); $('fnpfromi').value = dtl(new Date(nowMs())); fnpShow(); };
    $('fnpfromi').addEventListener('input', () => { const v = new Date($('fnpfromi').value).getTime(); if (!isNaN(v)) { FNP.fixed = true; FNP.from = v; } manual(); fnpShow(); });
    $('fnptoi').addEventListener('input', () => { manual(); fnpShow(); });
    $('fnpnotime').onchange = () => { FNP.notime = $('fnpnotime').checked; FNP.when = FNP.notime ? [...WHEN.keys()].find(k => WHEN.get(k).none) || null : null; FNP.timeTouched = true; fnpStart(); notimeShow(); fnpTags(); fnpShow(); };
    $('fnptnow').onclick = () => { $('fnptoi').value = dtl(new Date(nowMs())); fnpShow(); };
    $('fnptclr').onclick = () => { $('fnptoi').value = ''; fnpShow(); };
    setInterval(() => {                                 // die Uhr läuft mit, bis gespeichert wird (oder die Zeit von Hand gesetzt ist)
      if (document.hidden && !popOn()) return;
      if (!FNP.fixed && !FNP.edit) { const fi = $('fnpfromi'); if (fi && !$('fnpext').hidden && fi.ownerDocument.activeElement !== fi) fi.value = dtl(new Date(nowMs())); }
      fnpShow();
    }, 1000);
    if (open && !matchMedia('(pointer:coarse)').matches) setTimeout(() => { const a = document.activeElement; if (!a || a === document.body) $('fnptext').focus({ preventScroll: true }); }, 300);   // am PC sofort lostippen
  }
  function initLay() {
    $('laybtn').onclick = () => LAY.on ? layClose() : layOpen();
    $('fnpanel').addEventListener('pointerdown', layPointer);
    secApply();
  }
  function setup(o) { Object.assign(H, o || {}); H.ui = H.ui || {}; H.viewOpts = H.viewOpts || ['dens']; }
  return {
    setup, mount, tr: () => trIn($('fnpanel')),
    // Zustand und Daten (gemeinsam genutzt, z. B. von der Liste der App)
    FNP, NTS, WHEN, G_DEF, GROUPS, noteTags: () => NOTE_TAGS, layOn: () => LAY.on,
    ntGroup, ntLabel, gInfo, gIds, wordGroups, gCustom, gLabel, gColor, gAttr, tagBtn, tagMk, ntAll, ntOrdered, ntVisible, whenOrdered, whenRange,
    ntsApply, ntsLoad, ntsPost, gcolApply, tagSentence, autoText,
    // Erfassung bedienen
    start: fnpStart, show: fnpShow, reset: fnpReset, edit: fnpEdit, save: fnpSave, tags: fnpTags, reqCheck, whenPick, kindSet, kindDraw,
    fbLoad, fbApply, fbMount, kindsLoaded, fbTpl, extRead, refresh: viewApply, viewLight, secDraw, secApply, viewGet, viewCur, viewHid, viewBlocks,
    layOpen, layClose, layOpenAt, pop: fnPop, popOn, popDoc, popEl, pwin, $: $, holdBind, enterSave, dtl, dto, inIso
  };
})();
