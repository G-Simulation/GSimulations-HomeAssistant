'use strict';
/* Eigene Felder („Bausteine“) der Notiz-Erfassung – gleiche Datei in GReport und GLighter.
   Arten: Textfeld, Zähler, Zahl, Ja/Nein, Auswahlliste, Skala, Dauer, Datum/Uhrzeit, Ort, Person/Zeuge.
   Werte je Notiz in „fields“ {Kennung: Wert}. Pillen-Rubriken bleiben die Rubriken der Schnellwahl (Werte in „tags“).
   Die App gibt Texte (t), Maskieren (esc) und Zeitformate über Felder.setup() mit. */
window.Felder = (() => {
  const TYPES = ['text', 'counter', 'number', 'yesno', 'select', 'scale', 'duration', 'datetime', 'place', 'person'];
  const ROLES = ['mitbewohner', 'nachbar', 'hausverwaltung', 'vermieter', 'polizei', 'sonstige'];
  const H = { t: k => k, esc: s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    lang: () => 'de', fmtDT: ms => new Date(ms).toLocaleString(), dtl: d => d.toISOString().slice(0, 16), dto: d => d.toISOString(), nowMs: () => Date.now() };
  function t(k, v) { return H.t(k, v); }
  const e = s => H.esc(s);
  const S = { defs: [], sec: {}, counts: {}, daily: {}, sug: {}, tpl: null, first: false, max: 20, tpls: ['laerm', 'allg', 'zaehler'], kinds: [], kind_def: '', kind_keep: false, kind_n: {} };
  function setup(o) { Object.assign(H, o || {}); }
  /* Löschen ohne Browser-Rückfrage (confirm() erscheint in der Home-Assistant-App nicht): erster Klick fragt im Knopf, zweiter löscht */
  function sure(btn, msg, go) {
    if (btn.dataset.sure) { clearTimeout(btn._st); go(); return; }
    const old = btn.innerHTML, oa = btn.getAttribute('aria-label'); btn.dataset.sure = '1'; btn.classList.add('sure'); btn.innerHTML = e(t('fb_ed_sure')); btn.title = msg; btn.setAttribute('aria-label', t('fb_ed_sure') + ' ' + msg);
    btn._st = setTimeout(() => { delete btn.dataset.sure; btn.classList.remove('sure'); btn.innerHTML = old; if (oa) btn.setAttribute('aria-label', oa); else btn.removeAttribute('aria-label'); }, 5000);
  }

  function load(j) {
    if (!j || !j.ok) return;
    for (const k of ['sec', 'counts', 'daily', 'sug']) S[k] = j[k] || {};
    S.kinds = j.kinds || []; S.kind_def = j.kind_def || ''; S.kind_keep = !!j.kind_keep; S.kind_n = j.kind_n || {};
    S.defs = j.blocks || []; S.tpl = j.tpl || null; S.first = !!j.first; S.linked = !!j.linked; S.max = j.max || 20; if (j.tpls) S.tpls = j.tpls;
  }
  const isId = id => /^b_[0-9a-f]{6}$/.test(String(id || ''));
  const byId = id => S.defs.find(b => b.id === id);
  const active = () => S.defs.filter(b => !b.del);
  const visible = () => active().filter(b => !b.hide);
  const isEmpty = v => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !String(v.n || '').trim());
  const hex6 = () => Array.from(crypto.getRandomValues(new Uint8Array(3)), x => x.toString(16).padStart(2, '0')).join('');
  const newId = () => { let i; do { i = 'b_' + hex6(); } while (byId(i)); return i; };
  const numTxt = n => H.lang() === 'de' ? String(n).replace('.', ',') : String(n);
  const readNum = s => { s = String(s == null ? '' : s).trim().replace(',', '.'); if (!s) return null; const n = Number(s); return isFinite(n) ? n : NaN; };
  const durTxt = m => { m = Math.round(m || 0); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + String(m % 60).padStart(2, '0') + ' min' : ''); };
  const txtMax = b => Math.max(10, Math.min(500, +b.max || 500));
  const dtKind = b => b.kind === 'date' || b.kind === 'time' ? b.kind : 'dt';
  const p2 = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const dtNow = b => { const d = new Date(H.nowMs()), k = dtKind(b); return k === 'date' ? ymd(d) : k === 'time' ? p2(d.getHours()) + ':' + p2(d.getMinutes()) + (b.sec ? ':' + p2(d.getSeconds()) : '') : H.dtl(d); };
  const dtIn = (b, v) => { if (!v) return ''; const k = dtKind(b), s = String(v);
    if (/^\d{2}:\d{2}/.test(s)) return k === 'time' ? s : '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return k === 'date' ? s : k === 'dt' ? s + 'T00:00' : '';
    const d = new Date(s); if (isNaN(d)) return ''; return k === 'date' ? ymd(d) : k === 'time' ? p2(d.getHours()) + ':' + p2(d.getMinutes()) : H.dtl(d); };
  const scaleMax = b => b.rng === '10' ? 10 : 5, scaleMin = b => b.rng === '10' ? 0 : 1;
  const roleTxt = r => r ? t('fb_role_' + r) : '';
  /* Wert lesbar */
  function fmt(b, v) {
    if (v == null || v === '') return '';
    switch (b.type) {
      case 'counter': return b.mode === 'add' ? String(v) : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
      case 'number': return numTxt(v) + (b.unit ? ' ' + b.unit : '');
      case 'yesno': return v ? t('fb_yes') : t('fb_no');
      case 'scale': return v + '/' + scaleMax(b);
      case 'duration': return durTxt(v);
      case 'datetime': {
        if (/^\d{2}:\d{2}$/.test(String(v))) return String(v);                                   // nur Uhrzeit
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) { const [y, m, d] = String(v).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(H.lang() === 'en' ? 'en-GB' : 'de-DE'); }   // nur Datum
        const ms = Date.parse(v); return isNaN(ms) ? String(v) : H.fmtDT(ms);
      }
      case 'person': { if (typeof v !== 'object') return String(v); const x = [roleTxt(v.r), v.c].filter(Boolean); return (v.n || '') + (x.length ? ' (' + x.join(', ') + ')' : ''); }
      default: return Array.isArray(v) ? v.join(', ') : String(v);
    }
  }
  /* kurz „Name: Wert“ in der Reihenfolge der Definitionen (auch gelöschte – alte Werte bleiben sichtbar) */
  function compact(fields) {
    if (!fields || typeof fields !== 'object') return [];
    const out = [];
    for (const b of S.defs) if (b.id in fields) { const s = fmt(b, fields[b.id]); if (s !== '') out.push((b.l || b.id) + ': ' + s); }
    return out;
  }
  const label = b => e(b.l || t('fb_type_' + b.type));
  const reqMark = req => req ? `<i class="reqm" aria-hidden="true"> *</i><span class="sr"> ${e(t('fb_req_sr'))}</span>` : '';
  const helpHtml = b => b.h ? `<small class="fbhelp" id="fbh_${b.id}">${e(b.h)}</small>` : '';
  const desc = b => b.h ? ` aria-describedby="fbh_${b.id}"` : '';
  /* ---------- Erfassung: ein Feld zeichnen; hk.set(id, Wert), hk.start(), hk.count(b, ±1) ---------- */
  function countTxt(b, v) { const n = S.counts[b.id] || 0; return b.mode === 'add' ? t('fb_c_note', { n: v || 0 }) + ' · ' + t('fb_c_today', { n }) : t('fb_c_today', { n }); }
  function render(box, b, v, hk) {
    const id = b.id, req = !!b.req, ar = req ? ' aria-required="true"' : '';
    box.dataset.b = id; box.classList.add('fbblk', 'fbt-' + b.type); box.classList.toggle('req', req);
    if (b.col) box.style.setProperty('--fbc', b.col); else box.style.removeProperty('--fbc');
    const lab = `<label class="fbl" for="fbi_${id}">${label(b)}${reqMark(req)}</label>`, grp = `<span class="fbl" id="fbl_${id}">${label(b)}${reqMark(req)}</span>`;
    let h = '';
    switch (b.type) {
      case 'text': { const mx = txtMax(b), ph = b.ph ? ` placeholder="${e(b.ph)}"` : '', sg = !b.ml && b.sug && (S.sug[id] || []).length;
        h = lab + (b.ml ? `<textarea id="fbi_${id}" rows="${b.rows || 2}" maxlength="${mx}"${ph}${ar}${desc(b)}>${e(v || '')}</textarea>`
          : `<input type="text" id="fbi_${id}" maxlength="${mx}" autocomplete="off"${sg ? ` list="fbd_${id}"` : ''} value="${e(v || '')}"${ph}${ar}${desc(b)}>${sg ? `<datalist id="fbd_${id}">${S.sug[id].map(x => `<option value="${e(x)}"></option>`).join('')}</datalist>` : ''}`); break; }
      case 'place': h = lab + `<input type="text" id="fbi_${id}" maxlength="120" list="fbd_${id}" autocomplete="off" value="${e(v || '')}"${b.ph ? ` placeholder="${e(b.ph)}"` : ''}${ar}${desc(b)}><datalist id="fbd_${id}">${(S.sug[id] || []).map(x => `<option value="${e(x)}"></option>`).join('')}</datalist>`; break;
      case 'number': h = lab + `<span class="fbrow"><input type="text" class="fbnumi" inputmode="decimal" autocomplete="off" id="fbi_${id}" value="${v == null ? '' : e(numTxt(v))}"${ar}${desc(b)}>${b.unit ? `<span class="fbunit">${e(b.unit)}</span>` : ''}${b.min != null || b.max != null ? `<small class="fbunit">${e(t('fb_range', { a: b.min != null ? numTxt(b.min) : '…', b: b.max != null ? numTxt(b.max) : '…' }))}</small>` : ''}</span>`; break;
      case 'counter': h = grp + `<span class="fbrow fbcnt"><button type="button" class="fbplus" aria-label="${e(t('fb_c_plus', { l: b.l }))}" aria-describedby="fbc_${id}">＋1</button>${b.minus ? `<button type="button" class="fbminus" aria-label="${e(t('fb_c_minus', { l: b.l }))}" aria-describedby="fbc_${id}">−1</button>` : ''}<span class="fbcount" id="fbc_${id}" aria-live="polite">${e(countTxt(b, v))}</span></span>`; break;
      case 'yesno': h = grp + `<span class="fbrow" role="group" aria-labelledby="fbl_${id}"${desc(b)}><button type="button" class="fbchip" data-v="1" aria-pressed="${v === true}">${e(t('fb_yes'))}</button><button type="button" class="fbchip" data-v="0" aria-pressed="${v === false}">${e(t('fb_no'))}</button></span>`; break;
      case 'select': {
        const opts = (b.opts || []).slice(); for (const x of (Array.isArray(v) ? v : v ? [v] : [])) if (!opts.includes(x)) opts.push(x);   // alter Wert bleibt wählbar
        h = b.multi ? grp + `<span class="fbrow" role="group" aria-labelledby="fbl_${id}"${desc(b)}>${opts.map(o => `<button type="button" class="fbchip" data-o="${e(o)}" aria-pressed="${(v || []).includes(o)}">${e(o)}</button>`).join('') || `<small class="fbhelp">${e(t('fb_sel_empty'))}</small>`}</span>`
          : lab + `<select id="fbi_${id}"${ar}${desc(b)}><option value="">${e(t('fb_sel_none'))}</option>${opts.map(o => `<option${o === v ? ' selected' : ''}>${e(o)}</option>`).join('')}</select>`;
        break;
      }
      case 'scale': {
        const lo = scaleMin(b), hi = scaleMax(b), ns = []; for (let i = lo; i <= hi; i++) ns.push(i);
        h = grp + `<span class="fbrow fbscale" role="group" aria-labelledby="fbl_${id}"${desc(b)}>${b.lo ? `<small class="fbend">${e(b.lo)}</small>` : ''}${ns.map(i => `<button type="button" class="fbchip fbnum" data-v="${i}" aria-pressed="${v === i}" aria-label="${e(t('fb_scale_v', { v: i, m: hi }) + (i === lo && b.lo ? ' – ' + b.lo : i === hi && b.hi ? ' – ' + b.hi : ''))}">${i}</button>`).join('')}${b.hi ? `<small class="fbend">${e(b.hi)}</small>` : ''}</span>`;
        break;
      }
      case 'duration': { const hh = v == null ? '' : Math.floor(v / 60), mm = v == null ? '' : v % 60;
        h = grp + `<span class="fbrow" role="group" aria-labelledby="fbl_${id}"${desc(b)}><input type="number" class="fbdh" min="0" max="1666" inputmode="numeric" value="${hh}" aria-label="${e(b.l + ': ' + t('fb_hours'))}"><span>${e(t('fb_h'))}</span><input type="number" class="fbdm" min="0" max="59" inputmode="numeric" value="${mm}" aria-label="${e(b.l + ': ' + t('fb_minutes'))}"><span>${e(t('fb_min'))}</span></span>`; break; }
      case 'datetime': { const k = dtKind(b), ty = k === 'date' ? 'date' : k === 'time' ? 'time' : 'datetime-local';
        h = lab + `<span class="fbrow"><input type="${ty}" id="fbi_${id}"${k === 'date' ? '' : ` step="${b.sec ? 1 : 60}"`} value="${e(dtIn(b, v))}"${ar}${desc(b)}>${b.nonow ? '' : `<button type="button" class="chip fbnow">${e(t(k === 'date' ? 'fb_today' : 'fb_now'))}</button>`}</span>`; break; }
      case 'person': { const p = v && typeof v === 'object' ? v : {};
        h = grp + `<span class="fbrow fbper" role="group" aria-labelledby="fbl_${id}"${desc(b)}><input type="text" class="fbpn" maxlength="80" value="${e(p.n || '')}" placeholder="${e(t('fb_p_name'))}" aria-label="${e(b.l + ': ' + t('fb_p_name'))}"${ar}><select class="fbpr" aria-label="${e(b.l + ': ' + t('fb_p_role'))}"><option value="">${e(t('fb_role_none'))}</option>${ROLES.map(r => `<option value="${r}"${p.r === r ? ' selected' : ''}>${e(roleTxt(r))}</option>`).join('')}</select><input type="text" class="fbpc" maxlength="120" value="${e(p.c || '')}" placeholder="${e(t('fb_p_contact'))}" aria-label="${e(b.l + ': ' + t('fb_p_contact'))}"></span>`; break; }
    }
    box.innerHTML = h + helpHtml(b);
    bind(box, b, v, hk);
  }
  function bind(box, b, v, hk) {
    const id = b.id, set = x => { hk.set(id, isEmpty(x) ? undefined : x); if (!isEmpty(x)) hk.start(); }, q = s => box.querySelector(s);
    const i = q('#fbi_' + id);
    if (b.type === 'text' || b.type === 'place') i.addEventListener('input', () => set(i.value.trim() ? i.value : ''));
    else if (b.type === 'number') i.addEventListener('input', () => { const n = readNum(i.value); const bad = Number.isNaN(n) || (n != null && ((b.min != null && n < b.min) || (b.max != null && n > b.max))); i.setAttribute('aria-invalid', String(bad)); set(bad ? '' : n); box.dataset.bad = bad ? '1' : ''; });
    else if (b.type === 'select' && !b.multi) i.addEventListener('change', () => set(i.value));
    else if (b.type === 'datetime') {
      const k = dtKind(b), val = () => !i.value ? '' : k === 'dt' ? H.dto(new Date(i.value)) : k === 'time' ? i.value.slice(0, b.sec ? 8 : 5) : i.value;
      i.addEventListener('input', () => set(val()));
      const nb = q('.fbnow'); if (nb) nb.onclick = () => { i.value = dtNow(b); i.dispatchEvent(new Event('input')); };
      if (isEmpty(v) && b.def === 'now') { i.value = dtNow(b); hk.set(id, val()); }          // vorbelegt mit „jetzt“ (startet die Notiz nicht)
    }
    else if (b.type === 'yesno') box.querySelectorAll('.fbchip').forEach(c => c.onclick = () => { const on = c.getAttribute('aria-pressed') !== 'true'; box.querySelectorAll('.fbchip').forEach(x => x.setAttribute('aria-pressed', 'false')); c.setAttribute('aria-pressed', String(on)); set(on ? c.dataset.v === '1' : ''); });
    else if (b.type === 'scale') box.querySelectorAll('.fbchip').forEach(c => c.onclick = () => { const on = c.getAttribute('aria-pressed') !== 'true'; box.querySelectorAll('.fbchip').forEach(x => x.setAttribute('aria-pressed', 'false')); c.setAttribute('aria-pressed', String(on)); set(on ? +c.dataset.v : ''); });
    else if (b.type === 'select') box.querySelectorAll('.fbchip').forEach(c => c.onclick = () => { c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); set([...box.querySelectorAll('.fbchip[aria-pressed="true"]')].map(x => x.dataset.o)); });
    else if (b.type === 'duration') { const f = () => { const hh = readNum(q('.fbdh').value), mm = readNum(q('.fbdm').value); const bad = Number.isNaN(hh) || Number.isNaN(mm) || (mm != null && (mm < 0 || mm > 59)) || (hh != null && hh < 0); box.dataset.bad = bad ? '1' : ''; set(bad || (hh == null && mm == null) ? '' : Math.round((hh || 0) * 60 + (mm || 0))); }; q('.fbdh').addEventListener('input', f); q('.fbdm').addEventListener('input', f); }
    else if (b.type === 'person') { const f = () => set({ n: q('.fbpn').value.trim(), r: q('.fbpr').value, c: q('.fbpc').value.trim() }); for (const s of ['.fbpn', '.fbpc']) q(s).addEventListener('input', f); q('.fbpr').addEventListener('change', f); }
    else if (b.type === 'counter') {
      const press = d => {
        if (b.mode === 'add') { const n = Math.max(0, (hk.get(id) || 0) + d); hk.set(id, n || undefined); if (n) hk.start(); q('.fbcount').textContent = countTxt(b, n); return; }
        hk.count(b, d);
      };
      q('.fbplus').onclick = () => press(1); const m = q('.fbminus'); if (m) m.onclick = () => press(-1);
    }
  }
  function countShow(root, b) { const c = root && root.querySelector(`.fbblk[data-b="${b.id}"] .fbcount`); if (c) c.textContent = countTxt(b, undefined); }
  /* Pflicht und Eingaben prüfen → {miss: [Namen], bad: [Namen]} */
  function check(fv, root, only) {
    const miss = [], bad = [];
    for (const b of (only || visible())) {
      if (b.req && b.type !== 'counter' && isEmpty((fv || {})[b.id])) miss.push(b.l);
      const box = root && root.querySelector(`.fbblk[data-b="${b.id}"]`); if (box && box.dataset.bad === '1') bad.push(b.l);
    }
    return { miss, bad };
  }
  /* ---------- Statistik: Zähler je Tag (letzte 14 Tage) als kleine Balken ---------- */
  function chart(b) {
    const d = S.daily[b.id] || [], mx = Math.max(1, ...d.map(x => x[1])), sum = d.reduce((a, x) => a + x[1], 0), n = d.length || 1, w = 100 / n;
    const bars = d.map((x, i) => { const hh = Math.max(x[1] > 0 ? 6 : 1.5, 36 * Math.max(0, x[1]) / mx); return `<rect x="${(i * w + w * 0.15).toFixed(2)}" y="${(38 - hh).toFixed(2)}" width="${(w * 0.7).toFixed(2)}" height="${hh.toFixed(2)}" rx="1"${i === n - 1 ? ' class="now"' : ''}></rect>`; }).join('');
    const a = t('fb_st_a', { l: b.l, n: S.counts[b.id] || 0, s: sum, d: d.map(x => x[0].slice(8, 10) + '.' + x[0].slice(5, 7) + '. ' + x[1]).join(', ') });
    return `<figure class="fbst"><figcaption><b>${e(b.l)}</b> <span>${e(t('fb_c_today', { n: S.counts[b.id] || 0 }))} · ${e(t('fb_st_14', { s: sum }))}</span></figcaption><svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="${e(a)}">${bars}</svg></figure>`;
  }
  /* ---------- Layout anpassen: Einstellungen je Feld (Entwurf d = {blocks, sec}) ---------- */
  function newDef(type) {
    const b = { id: newId(), type, l: t('fb_type_' + type), isNew: true };
    if (type === 'counter') Object.assign(b, { mode: 'entry', minus: true });
    if (type === 'select') b.opts = [];
    if (type === 'scale') b.rng = '5';
    return b;
  }
  const cb = (cls, on, txt, extra) => `<label class="check fbck"><input type="checkbox" class="${cls}"${on ? ' checked' : ''}${extra || ''}> ${e(txt)}</label>`;
  const inp = (cls, txt, val, max, extra) => `<label class="fbf"><span>${e(txt)}</span><input type="text" class="${cls}" maxlength="${max}" value="${e(val == null ? '' : val)}"${extra || ''}></label>`;
  /* Zeile für ein eingebautes Bereich (k) oder ein Feld (b). bi = {k, l (Standardname), req (erlaubt), help (erlaubt)} */
  function edRow(it, d) {
    const b = it.b, s = it.k ? (d.sec[it.k] = d.sec[it.k] || {}) : null, nm = b ? b.l : (s.l || it.l), hid = b ? !!b.hide : !!s.hide;
    let x = '';
    if (b) {
      if (b.type === 'text') x += inp('fe_ph', t('fb_ed_ph'), b.ph, 80) + inp('fe_tmax', t('fb_ed_maxlen'), b.max, 3, ' inputmode="numeric"') + cb('fe_ml', b.ml, t('fb_ed_ml'))
        + `<label class="fbf fe_mlon"${b.ml ? '' : ' hidden'}><span>${e(t('fb_ed_rows'))}</span><select class="fe_rows">${[2, 3, 4, 6, 8].map(n => `<option value="${n}"${(b.rows || 2) === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`
        + `<span class="fe_mloff"${b.ml ? ' hidden' : ''}>${cb('fe_sug', b.sug, t('fb_ed_sug'))}</span>`;
      if (b.type === 'place') x += inp('fe_ph', t('fb_ed_ph'), b.ph, 80);
      if (b.type === 'datetime') x += `<label class="fbf"><span>${e(t('fb_ed_kind'))}</span><select class="fe_kind">${[['dt', 'fb_ed_k_dt'], ['date', 'fb_ed_k_date'], ['time', 'fb_ed_k_time']].map(([v, k]) => `<option value="${v}"${dtKind(b) === v ? ' selected' : ''}>${e(t(k))}</option>`).join('')}</select></label>`
        + `<label class="fbf"><span>${e(t('fb_ed_def'))}</span><select class="fe_def"><option value=""${b.def !== 'now' ? ' selected' : ''}>${e(t('fb_ed_def_empty'))}</option><option value="now"${b.def === 'now' ? ' selected' : ''}>${e(t('fb_ed_def_now'))}</option></select></label>`
        + cb('fe_nonow', !b.nonow, t('fb_ed_nowbtn')) + `<span class="fe_secw"${dtKind(b) === 'date' ? ' hidden' : ''}>${cb('fe_sec', b.sec, t('fb_ed_sec'))}</span>`;
      if (b.type === 'counter') x += `<label class="fbf"><span>${e(t('fb_ed_mode'))}</span><select class="fe_mode"><option value="entry"${b.mode !== 'add' ? ' selected' : ''}>${e(t('fb_ed_mode_entry'))}</option><option value="add"${b.mode === 'add' ? ' selected' : ''}>${e(t('fb_ed_mode_add'))}</option></select></label>` + cb('fe_minus', b.minus, t('fb_ed_minus'));
      if (b.type === 'number') x += inp('fe_unit', t('fb_ed_unit'), b.unit, 12) + inp('fe_min', t('fb_ed_min'), b.min, 16, ' inputmode="decimal"') + inp('fe_max', t('fb_ed_max'), b.max, 16, ' inputmode="decimal"');
      if (b.type === 'select') x += `<label class="fbf fbwide"><span>${e(t('fb_ed_opts'))}</span><textarea class="fe_opts" rows="3">${e((b.opts || []).join('\n'))}</textarea></label>` + cb('fe_multi', b.multi, t('fb_ed_multi'));
      if (b.type === 'scale') x += `<label class="fbf"><span>${e(t('fb_ed_rng'))}</span><select class="fe_rng"><option value="5"${b.rng !== '10' ? ' selected' : ''}>${e(t('fb_ed_rng5'))}</option><option value="10"${b.rng === '10' ? ' selected' : ''}>${e(t('fb_ed_rng10'))}</option></select></label>` + inp('fe_lo', t('fb_ed_lo'), b.lo, 24) + inp('fe_hi', t('fb_ed_hi'), b.hi, 24);
    }
    const kind = b ? t('fb_type_' + b.type) + (b.bind ? ' · ' + t('fb_ed_std') : '') : t('fb_ed_builtin');
    return `<details class="fbed${hid ? ' off' : ''}" data-id="${e(b ? b.id : it.k)}"${b && b.isNew ? ' open' : ''}><summary><span class="fbedn">${e(nm)}</span> <small>${e(kind)}${hid ? ' · ' + e(t('fb_ed_hidden')) : ''}${(b ? b.req : s.req) ? ' · ' + e(t('fb_ed_req')) : ''}</small></summary>
      <div class="fbedg">${inp('fe_l', t('fb_ed_name'), nm, b ? 40 : 40)}${(b || it.help) ? inp('fe_h', t('fb_ed_help'), b ? b.h : s.h, 160) : ''}
        ${(b ? b.type !== 'counter' : it.req) ? cb('fe_req', b ? b.req : s.req, t('fb_ed_req')) : ''}${cb('fe_show', !hid, t('fb_ed_shown'))}${b && S.foldOK ? cb('fe_fold', b.fold, t('fb_ed_fold')) : ''}${x}
        ${b ? `<button type="button" class="btn fe_del">🗑 ${e(t('fb_ed_del', { l: b.l }))}</button>` : ''}</div></details>`;
  }
  /* d = {blocks, sec}, items = [{k, l, req, help} | {b}] in Anzeige-Reihenfolge; hk.change(), hk.say(msg), hk.add(type) */
  function editor(box, d, items, hk) {
    box.innerHTML = `<div class="fbeds"><span class="laysl" id="fbedl">${e(t('fb_ed_title'))}</span><p class="hint fbhint">${e(t('fb_ed_hint'))}</p>
      <div class="fbedl" role="list" aria-labelledby="fbedl">${items.map(it => `<div role="listitem">${edRow(it, d)}</div>`).join('')}</div>
      <div class="fbadd lgaw"><button type="button" class="btn fe_add" aria-haspopup="menu" aria-expanded="false">＋ ${e(t('fb_ed_add'))}</button></div></div>`;   // wie oben: Klick öffnet die Typauswahl
    box.querySelectorAll('.fbed').forEach(row => {
      const id = row.dataset.id, b = d.blocks.find(x => x.id === id), s = b ? null : (d.sec[id] = d.sec[id] || {}), q = c => row.querySelector('.' + c);
      const upd = () => { const sm = row.querySelector('summary .fbedn'); sm.textContent = (b ? b.l : s.l) || (items.find(x => x.k === id) || {}).l || ''; row.classList.toggle('off', b ? !!b.hide : !!s.hide); hk.change(id); };
      q('fe_l').addEventListener('input', ev => { const v = ev.target.value.trim().slice(0, 40); if (b) { if (v) b.l = v; } else s.l = v && v !== (items.find(x => x.k === id) || {}).l ? v : ''; upd(); });
      const hh = q('fe_h'); if (hh) hh.addEventListener('input', () => { if (b) b.h = hh.value.trim(); else s.h = hh.value.trim(); hk.change(id); });
      const rq = q('fe_req'); if (rq) rq.onchange = () => { if (b) b.req = rq.checked; else s.req = rq.checked; hk.change(id); };
      q('fe_show').onchange = ev => { if (b) b.hide = !ev.target.checked; else s.hide = !ev.target.checked; upd(); hk.say(t(ev.target.checked ? 'fb_ed_shown_s' : 'fb_ed_hidden_s', { l: b ? b.l : (s.l || id) })); };
      if (!b) return;
      const on = (c, f) => { const x = q(c); if (x) x.addEventListener(x.tagName === 'SELECT' || x.type === 'checkbox' ? 'change' : 'input', () => { f(x); hk.change(id); }); };
      on('fe_ml', x => { b.ml = x.checked; row.querySelector('.fe_mlon').hidden = !b.ml; row.querySelector('.fe_mloff').hidden = b.ml; }); on('fe_ph', x => { b.ph = x.value.trim().slice(0, 80); }); on('fe_rows', x => { b.rows = +x.value; }); on('fe_sug', x => { b.sug = x.checked; });
      on('fe_kind', x => { b.kind = x.value === 'dt' ? undefined : x.value; row.querySelector('.fe_secw').hidden = x.value === 'date'; }); on('fe_def', x => { b.def = x.value || undefined; }); on('fe_nonow', x => { b.nonow = !x.checked; }); on('fe_sec', x => { b.sec = x.checked; }); on('fe_mode', x => { b.mode = x.value; }); on('fe_minus', x => { b.minus = x.checked; });
      on('fe_unit', x => { b.unit = x.value.trim(); });
      on('fe_tmax', x => { const n = readNum(x.value), bad = Number.isNaN(n) || (n != null && (n < 10 || n > 500)); x.setAttribute('aria-invalid', String(bad)); if (!bad) b.max = n == null ? undefined : Math.round(n); });
      for (const k of ['min', 'max']) on('fe_' + k, x => { const n = readNum(x.value); x.setAttribute('aria-invalid', String(Number.isNaN(n))); b[k] = n == null || Number.isNaN(n) ? null : n; });
      on('fe_opts', x => { b.opts = [...new Set(x.value.split('\n').map(y => y.trim()).filter(Boolean))].slice(0, 30); }); on('fe_multi', x => { b.multi = x.checked; });
      on('fe_fold', x => { b.fold = x.checked || undefined; hk.change(id, true); });
      on('fe_rng', x => { b.rng = x.value; }); on('fe_lo', x => { b.lo = x.value.trim(); }); on('fe_hi', x => { b.hi = x.value.trim(); });
      q('fe_del').onclick = e => sure(e.currentTarget, t('fb_ed_del_q', { l: b.l }), () => { b.del = true; hk.say(t('fb_ed_deleted', { l: b.l })); hk.change(id, true); });
    });
    box.querySelector('.fe_add').onclick = ev => addMenu(ev.currentTarget, ty => {
      if (ty === 'pills') { hk.add('pills'); return; }
      if (d.blocks.filter(x => !x.del).length >= S.max) { hk.say(t('fb_ed_limit', { n: S.max })); return; }
      const b = newDef(ty); d.blocks.push(b); hk.say(t('fb_ed_added', { l: b.l })); hk.add(ty, b);
    });
  }
  /* Entwurf → zum Speichern (ohne Hilfsfelder) */
  const strip = d => Object.assign({ blocks: d.blocks.filter(b => !(b.isNew && b.del)).map(b => { const o = Object.assign({}, b); delete o.isNew; return o; }), sec: d.sec },
    d.kinds ? { kinds: d.kinds.filter(k => !(k.isNew && k.del)).map(k => { const o = Object.assign({}, k); delete o.isNew; return o; }), kind_def: d.kind_def || '', kind_keep: !!d.kind_keep } : {});
  /* ---------- Notiz-Arten (z. B. „Erinnerung“): Name, Farbe, Symbol, ohne Zeitpunkt, nicht Störungen zuordnen ---------- */
  const newKid = list => { let i; do { i = 'k_' + hex6(); } while ((list || []).some(k => k.id === i)); return i; };
  const kindsActive = () => S.kinds.filter(k => !k.del);
  const kindsShown = () => kindsActive().filter(k => !k.hide);
  const kindOf = id => S.kinds.find(k => k.id === id);
  const kindChip = (id, small) => { const k = kindOf(id); if (!k) return ''; return `<span class="fbkind${small ? ' sm' : ''}" style="--kc:${e(k.col || '#5f6b78')}">${k.ico ? `<span aria-hidden="true">${e(k.ico)}</span> ` : ''}${e(k.l)}</span>`; };
  /* Auswahl in der Erfassung: box, aktuelle Art, onPick(id | '') */
  function kindPick(box, cur, onPick) {
    const ks = kindsShown(); box.hidden = !ks.length; if (!ks.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<span class="fbl" id="fbkl">${e(t('fk_title'))}</span><span class="fbrow" role="group" aria-labelledby="fbkl">${ks.map(k => `<button type="button" class="fbchip fbkchip" data-k="${e(k.id)}" aria-pressed="${cur === k.id}" style="--kc:${e(k.col || '#5f6b78')}" title="${e([k.notime ? t('fk_notime') : '', k.noassign ? t('fk_noassign') : ''].filter(Boolean).join(' · '))}">${k.ico ? `<span aria-hidden="true">${e(k.ico)}</span> ` : ''}${e(k.l)}</button>`).join('')}</span>`;
    box.querySelectorAll('.fbkchip').forEach(b => b.onclick = () => onPick(b.getAttribute('aria-pressed') === 'true' ? '' : b.dataset.k));
  }
  /* Verwaltung in „Layout anpassen“ (Entwurf d.kinds, d.kind_def, d.kind_keep) */
  function kindsEditor(box, d, hk) {
    d.kinds = d.kinds || [];
    const act = d.kinds.filter(k => !k.del);
    const row = k => `<details class="fbed fbkrow${k.hide ? ' off' : ''}" data-k="${e(k.id)}"${k.isNew ? ' open' : ''}><summary>${kindChipD(k)} <small>${e([k.notime ? t('fk_notime') : '', k.noassign ? t('fk_noassign') : '', k.hide ? t('fb_ed_hidden') : '', S.kind_n[k.id] ? t('fk_used', { n: S.kind_n[k.id] }) : ''].filter(Boolean).join(' · '))}</small></summary>
      <div class="fbedg">${inp('fk_l', t('fb_ed_name'), k.l, 30)}<label class="fbf"><span>${e(t('fk_col'))}</span><input type="color" class="fk_col" value="${e(k.col || '#5f6b78')}"></label>${inp('fk_ico', t('fk_ico'), k.ico, 4)}
        ${cb('fk_notime', k.notime, t('fk_notime_l'))}${cb('fk_noassign', k.noassign, t('fk_noassign_l'))}${cb('fk_show', !k.hide, t('fb_ed_shown'))}
        <button type="button" class="btn fk_del">🗑 ${e(t('fb_ed_del', { l: k.l }))}</button></div></details>`;
    box.innerHTML = `<div class="fbkeds"><span class="laysl" id="fbkedl">${e(t('fk_ed_title'))}</span><p class="hint fbhint">${e(t('fk_ed_hint'))}</p>
      <div class="fbedl" role="list" aria-labelledby="fbkedl">${act.map(k => `<div role="listitem">${row(k)}</div>`).join('')}</div>
      <div class="fbadd"><button type="button" class="btn fk_add">＋ ${e(t('fk_add'))}</button>
        <label class="fbf"><span>${e(t('fk_def'))}</span><select class="fk_def"><option value="">${e(t('fk_none'))}</option>${act.map(k => `<option value="${e(k.id)}"${d.kind_def === k.id ? ' selected' : ''}>${e(k.l)}</option>`).join('')}</select></label>
        ${cb('fk_keep', d.kind_keep, t('fk_keep'))}</div></div>`;
    box.querySelectorAll('.fbkrow').forEach(r => {
      const k = d.kinds.find(x => x.id === r.dataset.k), q = c => r.querySelector('.' + c), sum = () => { r.querySelector('summary').firstElementChild.outerHTML = kindChipD(k); r.classList.toggle('off', !!k.hide); hk.change(); };
      q('fk_l').addEventListener('input', ev => { const v = ev.target.value.trim().slice(0, 30); if (v) k.l = v; sum(); });
      q('fk_col').addEventListener('input', ev => { k.col = ev.target.value; sum(); });
      q('fk_ico').addEventListener('input', ev => { k.ico = ev.target.value.trim().slice(0, 4); sum(); });
      q('fk_notime').onchange = ev => { k.notime = ev.target.checked; hk.change(); };
      q('fk_noassign').onchange = ev => { k.noassign = ev.target.checked; hk.change(); };
      q('fk_show').onchange = ev => { k.hide = !ev.target.checked; sum(); };
      q('fk_del').onclick = e => sure(e.currentTarget, t('fk_del_q', { l: k.l }), () => { k.del = true; if (d.kind_def === k.id) d.kind_def = ''; hk.say(t('fb_ed_deleted', { l: k.l })); kindsEditor(box, d, hk); hk.change(); });
    });
    box.querySelector('.fk_add').onclick = () => {
      if (d.kinds.filter(x => !x.del).length >= 20) { alert(t('fk_limit', { n: 20 })); return; }
      const k = { id: newKid(d.kinds), l: t('fk_new'), col: '#7048e8', isNew: true }; d.kinds.push(k); hk.say(t('fb_ed_added', { l: k.l })); kindsEditor(box, d, hk); hk.change();
      const i = box.querySelector(`.fbkrow[data-k="${k.id}"] .fk_l`); if (i) { i.focus(); i.select(); }
    };
    box.querySelector('.fk_def').onchange = ev => { d.kind_def = ev.target.value; hk.change(); };
    box.querySelector('.fk_keep').onchange = ev => { d.kind_keep = ev.target.checked; hk.change(); };
  }
  const kindChipD = k => `<span class="fbkind" style="--kc:${e(k.col || '#5f6b78')}">${k.ico ? `<span aria-hidden="true">${e(k.ico)}</span> ` : ''}${e(k.l)}</span>`;
  /* ---------- Vorlagen ---------- */
  function tplBox(box, cur, onPick, later) {
    box.innerHTML = `<p class="fbtplh"><b>${e(t('fb_tpl_title'))}</b> ${e(t('fb_tpl_h'))}</p><div class="fbtpls">${S.tpls.map(x => `<button type="button" class="fbtpl${cur === x ? ' on' : ''}" data-tpl="${x}" aria-pressed="${cur === x}"><b>${e(t('fb_tpl_' + x))}</b><small>${e(t('fb_tpl_' + x + '_h'))}</small></button>`).join('')}</div>${later ? `<button type="button" class="linkbtn fbtpll">${e(t('fb_tpl_later'))}</button>` : ''}`;
    box.querySelectorAll('.fbtpl').forEach(x => x.onclick = () => onPick(x.dataset.tpl));
    const l = box.querySelector('.fbtpll'); if (l && later) l.onclick = later;
  }
  /* ab 1.12.3: jedes Feld in „Layout anpassen“ direkt am Element bearbeiten – dieselbe Leiste wie bei den Rubriken
     (Griff, Name, zeigen, Pflicht, unter „Mehr“, ⚙ weitere Einstellungen, 🗑 löschen, Hinweis). hk = {change(id, redraw), say, open(id), move(id, dir|zielId)} */
  function inlineEdit(root, d, hk) {
    if (!root) return;
    root.querySelectorAll('.fbblk[data-b]').forEach(box => {
      const id = box.dataset.b, b = (d.blocks || []).find(x => x.id === id); if (!b || b.del) return;
      box.querySelectorAll(':scope > .fbilh, :scope > .fbilx').forEach(x => x.remove());
      box.classList.add('fbil'); box.classList.toggle('off', !!b.hide);
      const bar = root.ownerDocument.createElement('div'); bar.className = 'laygh fbilh';
      bar.innerHTML = `<button type="button" class="hd" data-drag="fld" aria-label="${e(t('fb_il_drag', { l: b.l }))}" title="${e(t('fb_il_drag', { l: b.l }))}">⠿</button>`
        + `<input type="text" class="lgn fil_l" maxlength="40" value="${e(b.l)}" aria-label="${e(t('fb_ed_name'))}">`
        + `<small class="filty">${e(t('fb_type_' + b.type))}</small>`
        + `<label class="check"><input type="checkbox" class="fil_show"${b.hide ? '' : ' checked'}> ${e(t('fb_ed_shown'))}</label>`
        + (b.type !== 'counter' ? `<label class="check"><input type="checkbox" class="fil_req"${b.req ? ' checked' : ''}> ${e(t('fb_ed_req'))}</label>` : '')
        + (S.foldOK ? `<label class="check"><input type="checkbox" class="fil_fold"${b.fold ? ' checked' : ''}> ${e(t('fb_ed_fold'))}</label>` : '')
        + (hk.open ? `<button type="button" class="fil_more" aria-label="${e(t('fb_il_more', { l: b.l }))}" title="${e(t('fb_il_more', { l: b.l }))}">⚙</button>` : '')
        + `<button type="button" class="lgd fil_del" aria-label="${e(t('fb_ed_del', { l: b.l }))}" title="${e(t('fb_ed_del', { l: b.l }))}">🗑</button>`;
      const hx = root.ownerDocument.createElement('div'); hx.className = 'laygx fbilx';
      hx.innerHTML = `<input type="text" class="lgx fil_h" maxlength="160" value="${e(b.h || '')}" placeholder="${e(t('fb_ed_help'))}" aria-label="${e(t('fb_ed_help'))}">`;
      box.prepend(bar, hx);
      const q = c => bar.querySelector('.' + c) || hx.querySelector('.' + c);
      q('fil_l').onchange = ev => { const v = ev.target.value.trim().slice(0, 40); if (v) { b.l = v; hk.change(id, true); } else ev.target.value = b.l; };
      q('fil_h').onchange = ev => { b.h = ev.target.value.trim(); hk.change(id, true); };
      q('fil_show').onchange = ev => { b.hide = !ev.target.checked; hk.say && hk.say(t(ev.target.checked ? 'fb_ed_shown_s' : 'fb_ed_hidden_s', { l: b.l })); hk.change(id, true); };
      const rq = q('fil_req'); if (rq) rq.onchange = () => { b.req = rq.checked; hk.change(id, true); };
      const fo = q('fil_fold'); if (fo) fo.onchange = () => { b.fold = fo.checked || undefined; hk.change(id, true); };
      const mo = q('fil_more'); if (mo) mo.onclick = () => hk.open(id);
      q('fil_del').onclick = ev => sure(ev.currentTarget, t('fb_ed_del_q', { l: b.l }), () => { b.del = true; hk.say && hk.say(t('fb_ed_deleted', { l: b.l })); hk.change(id, true); });
      const hd = bar.querySelector('.hd');
      hd.onkeydown = ev => { if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown' && ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return; ev.preventDefault(); hk.move && hk.move(id, ev.key === 'ArrowUp' || ev.key === 'ArrowLeft' ? -1 : 1); };
      hd.onpointerdown = ev => {                         // Ziehen: auf ein anderes Feld bzw. einen anderen Bereich fallen lassen
        if (!hk.move || ev.button) return; ev.preventDefault(); hd.setPointerCapture(ev.pointerId); box.classList.add('fbdrag');
        const doc = root.ownerDocument; let tgt = null;
        const over = x => { const el = doc.elementFromPoint(x.clientX, x.clientY), o = el && el.closest('[data-b], [data-secel]'); return o && o !== box ? o : null; };
        hd.onpointermove = x => { const o = over(x); if (o !== tgt) { if (tgt) tgt.classList.remove('fbdrop'); tgt = o; if (tgt) tgt.classList.add('fbdrop'); } };
        hd.onpointerup = hd.onpointercancel = () => { hd.onpointermove = hd.onpointerup = hd.onpointercancel = null; box.classList.remove('fbdrag'); if (tgt) { tgt.classList.remove('fbdrop'); hk.move(id, tgt.dataset.b || tgt.dataset.secel); } };
      };
    });
  }
  /* „＋ Rubrik“ mit Typauswahl: Tasten (Rubrik) oder ein Feldtyp – gleicher Knopf, gleiche Leiste danach */
  function addMenu(btn, pick) {                       // „＋ Rubrik“: Klick öffnet die Typauswahl – Shoelace sl-dropdown (schließt bei Klick daneben und Esc, liegt über allem)
    if (btn.closest('sl-dropdown')) return;            // schon umgebaut: das Menü öffnet die Bibliothek selbst
    const doc = btn.ownerDocument, dd = doc.createElement('sl-dropdown');
    dd.setAttribute('placement', 'bottom-start'); dd.setAttribute('distance', '4'); dd.setAttribute('hoist', ''); dd.className = 'fbaddd';
    btn.replaceWith(dd); btn.slot = 'trigger'; dd.appendChild(btn);
    const m = doc.createElement('div'); m.className = 'fbaddm'; m.setAttribute('role', 'menu');
    m.innerHTML = [['pills', t('fb_type_pills')]].concat(TYPES.map(x => [x, t('fb_type_' + x)])).map(([v, l]) => `<button type="button" role="menuitem" data-ty="${v}">${e(l)}</button>`).join('');
    dd.appendChild(m);
    const its = [...m.querySelectorAll('button')];
    its.forEach((x, i) => { x.onclick = () => { dd.hide(); pick(x.dataset.ty); };
      x.onkeydown = ev => { if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); its[(i + (ev.key === 'ArrowDown' ? 1 : its.length - 1)) % its.length].focus(); } }; });
    dd.addEventListener('sl-after-show', () => its[0].focus());
    requestAnimationFrame(() => dd.show());
  }

  function addDef(d, ty) { if (d.blocks.filter(x => !x.del).length >= S.max) return null; const b = newDef(ty); d.blocks.push(b); return b; }
  return { sure, addMenu, addDef, inlineEdit, kindsActive, kindsShown, kindOf, kindChip, kindPick, kindsEditor, TYPES, ROLES, S, setup, load, isId, byId, active, visible, isEmpty, fmt, compact, render, countShow, check, chart, editor, strip, newDef, tplBox, readNum };
})();
