/* =====================================================================
   عکس‌ها: بارگذاری تنبل (فقط عکس‌های دیده‌شده) + نسخه کوچک (thumbnail) + حافظه موقت
   + آرشیو روی کامپیوتر (File System Access API) با نسخه کوچک روی سرور برای نمایش در همه دستگاه‌ها
   ===================================================================== */
const PB = URL_ + '/storage/v1/object/', THUMB_SINCE = '2026-10-17';
let PUBF = 0, PUBK = 0;
async function srv(path, auth) {
  try {
    const r = await fetch(PB + (auth ? 'authenticated/' : 'public/') + 'photos/' + path, auth ? { headers: AH() } : {});
    if (r.ok) return await r.blob();
  } catch (e) { }
  return null;
}
/* اول مسیر public (سریع و قابل کش مرورگر)، بعد authenticated. اگر باکت خصوصی باشد، بعد از چند بار دیگر public را امتحان نمی‌کند */
async function srvAny(path) {
  if (PUBF < 3 || PUBK) { const b = await srv(path); if (b) { PUBK = 1; return b; } }
  const b = await srv(path, true);
  if (b && !PUBK && PUBF < 3) PUBF++;
  return b;
}

/* پوشه آرشیو روی کامپیوتر: handle در IndexedDB نگهداری می‌شود */
const idb = (m, k, v) => new Promise((ok, no) => {
  try {
    const o = indexedDB.open('hse-photos', 1);
    o.onupgradeneeded = () => o.result.createObjectStore('kv');
    o.onerror = () => no(o.error);
    o.onsuccess = () => {
      const st = o.result.transaction('kv', m == 'get' ? 'readonly' : 'readwrite').objectStore('kv'), rq = m == 'get' ? st.get(k) : m == 'set' ? st.put(v, k) : st.delete(k);
      rq.onsuccess = () => ok(rq.result); rq.onerror = () => no(rq.error);
    };
  } catch (e) { no(e); }
});
let DIRH;
async function dirHandle() { if (DIRH === undefined) { try { DIRH = (await idb('get', 'dir')) || null; } catch (e) { DIRH = null; } } return DIRH; }
async function dirPerm(ask, mode = 'readwrite') {
  const h = await dirHandle(); if (!h) return null;
  try {
    let p = await h.queryPermission({ mode });
    if (p != 'granted' && ask) p = await h.requestPermission({ mode });
    return p == 'granted' ? h : null;
  } catch (e) { return null; }
}
async function localRead(p) { try { const h = await dirPerm(false, 'read'); return h ? await (await h.getFileHandle(p)).getFile() : null; } catch (e) { return null; } }

/* پیدا کردن عکس: نسخه کوچک (برای لیست) ← اصل روی سرور ← فایل روی کامپیوتر ← نسخه کوچک سرور. lvl: 'thumb' | 'full' */
async function getBlob(p, full, created) {
  const wantThumb = !full && created && String(created).slice(0, 10) >= THUMB_SINCE;
  let b = null, lvl = 'full';
  if (wantThumb) { b = await srvAny('thumbs/' + p); if (b) lvl = 'thumb'; }
  if (!b) b = await srvAny(p);
  if (!b) b = await localRead(p);
  if (!b && !wantThumb) { b = await srvAny('thumbs/' + p); if (b) lvl = 'thumb'; }
  return b ? { b, lvl } : null;
}
const BM = new Map();
async function getURL(p, full, created) {
  const k = (full ? 'f' : 't') + p, c = BM.get(k);
  if (c) return c;
  const r = await getBlob(p, full, created); if (!r) return null;
  const o = { u: URL.createObjectURL(r.b), lvl: r.lvl };
  BM.set(k, o);
  if (BM.size > 400) { const f = BM.keys().next().value; try { URL.revokeObjectURL(BM.get(f).u); } catch (e) { } BM.delete(f); }
  return o;
}

let LQ = [], LA = 0;
async function paint(img) {
  if (!img.isConnected || img.getAttribute('src')) return;
  const r = await getURL(img.dataset.p, img.dataset.k == 'f', img.dataset.c);
  if (!img.isConnected) return;
  if (!r) { img.parentElement && img.parentElement.classList.add('nf'); return; }
  img.src = r.u; img.parentElement && img.parentElement.classList.remove('nf');
}
function pump() { while (LA < 6 && LQ.length) { const i = LQ.shift(); LA++; paint(i).catch(() => { }).finally(() => { LA--; pump(); }); } }
const IO = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { IO.unobserve(e.target); LQ.push(e.target); pump(); } }), { rootMargin: '400px' }) : null;
const li = () => document.querySelectorAll('img[data-p]:not([src])').forEach(i => { if (IO) IO.observe(i); else { LQ.push(i); pump(); } });
const th = (a, created, big) => (a || []).map(p => `<span class="th ${big ? 'bg2' : ''}"><img data-a="zoom" data-p="${esc(p)}" data-c="${esc(created || '')}" data-k="t" alt=""></span>`).join('');
const nm = k => (M.find(m => m[0] == k) || [])[1], mn = k => esc(nm(k));

async function upRaw(path, b) {
  const url = PB + 'photos/' + path, h = { 'Content-Type': 'image/jpeg', 'cache-control': 'max-age=31536000', 'x-upsert': 'true' };
  let r = await fetch(url, { method: 'POST', headers: { ...AH(), ...h }, body: b });
  if (!r.ok && tok === KEY) r = await fetch(url, { method: 'POST', headers: { apikey: KEY, ...h }, body: b });
  if (!r.ok) {
    let d = ''; try { d = (await r.json()).message || ''; } catch (e) { }
    throw new Error('خطا در آپلود تصویر (' + r.status + ')' + (d ? ': ' + d : ''));
  }
}
async function mkThumb(b, max = 280) {
  const im = await createImageBitmap(b), k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); im.close && im.close();
  return await new Promise(res => c.toBlob(res, 'image/jpeg', 0.7));
}
/* آپلود عکس + نسخه کوچک (حدود ۸ کیلوبایت) برای باز شدن سریع لیست‌ها */
async function up(b) {
  const p = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '' + Math.random().toString(36).slice(2)) + '.jpg';
  await upRaw(p, b);
  try { await upRaw('thumbs/' + p, await mkThumb(b)); } catch (e) { console.warn('thumb', e); }
  return p;
}
async function delPhotos(ps) {
  for (const p of ps) for (const k of [p, 'thumbs/' + p]) { try { await fetch(PB + 'photos/' + k, { method: 'DELETE', headers: AH() }); } catch (e) { } }
}

/* ===== انتخاب فایل عکس (ثبت بازدید / افزودن عکس پس از اصلاح / ویرایش) ===== */
fi.onchange = async () => {
  const fs = [...fi.files].slice(0, 4), y = scrollY; fi.value = ''; if (!FT) return;
  try {
    if (FT.m == 'addph') {
      for (const f of fs) {
        const a = PH[FT.id] = PH[FT.id] || [];
        if (a.length < 4) { const b = await shrink(f); a.push({ b, u: URL.createObjectURL(b) }); }
      }
      form(); scrollTo(0, y);
    } else if (FT.m == 'eadd') {
      const a = EF[FT.k == 'b' ? 'addB' : 'addA'];
      for (const f of fs) { if (EF.before.length + EF.addB.length + EF.after.length + EF.addA.length < 20) { const b = await shrink(f); a.push({ b, u: URL.createObjectURL(b) }); } }
      fedit(); scrollTo(0, y);
    } else {
      const x = FD.map.get(String(FT.id)), ps = [];
      for (const f of fs) ps.push(await up(await shrink(f)));
      await patchF(FT.id, { photos_after: [...(x.photos_after || []), ...ps] }, [['PHOTO_ADD_AFTER', '', ps.length + ' عکس']]);
      fdetail(FT.id); scrollTo(0, y);
    }
  } catch (e) { alert(e.message); }
};

/* =====================================================================
   مدیریت و پیگیری عدم‌انطباق‌ها
   همه موارد یک‌بار (بدون عکس) دریافت می‌شوند؛ جستجو/فیلتر/گروه‌بندی روی دستگاه و آنی است.
   ===================================================================== */
const FD = { rows: [], map: new Map(), at: 0 };
const FS = { tab: 'open', q: '', mod: '', cat: '', sev: '', loc: '', resp: '', from: '', to: '', sort: 'new', grp: '', n: 25, fo: false, gopen: {}, gn: {}, dt: 0, id: null, y: 0, insp: '' };
const PAGE = 25;
const norm = s => String(s ?? '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/‌/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim();
const isOver = x => x.status == 'open' && x.due_date && new Date(x.due_date + 'T23:59:59') < Date.now();
function prep(x) {
  x._c = x.category || cat(x.module, x.question || '');
  x._s = norm([x.question, x.note, x.location, x.responsible, x.notice_code, x.root_cause, x._c, nm(x.module), x.module + '-' + x.qid, x.module + x.qid].join(' | '));
  return x;
}
async function loadFD(force) {
  if (!force && FD.rows.length && Date.now() - FD.at < 300000) return;
  const rows = await fetchAll('findings?select=*&order=created_at.desc,id.asc');
  FD.rows = rows.map(prep); FD.map = new Map(FD.rows.map(x => [String(x.id), x])); FD.at = Date.now();
}
/* ثبت تغییر در دیتابیس + به‌روزرسانی حافظه + ثبت لاگ (اگر جدول finding_logs ساخته شده باشد) */
async function patchF(id, body, logs) {
  const [r] = await api('findings?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(body) });
  const old = FD.map.get(String(id)); if (old) { Object.assign(old, r); prep(old); }
  if (logs && logs.length) {
    try { await api('finding_logs', { method: 'POST', body: JSON.stringify(logs.map(([a, o, n]) => ({ finding_id: String(id), actor: mail, action_type: a, old_value: String(o ?? ''), new_value: String(n ?? '') }))) }); } catch (e) { console.warn('log', e); }
  }
  return r;
}

const FTABS = [['open', 'باز', x => x.status == 'open'], ['over', 'عقب‌افتاده', isOver], ['nonotice', 'بدون اعلان رسمی', x => x.status == 'open' && !x.notice_at], ['closed', 'اصلاح‌شده', x => x.status == 'closed'], ['all', 'همه', () => true]];
const FKEYS = { mod: x => x.module, cat: x => x._c, sev: x => String(x.severity || ''), loc: x => nl(x.location), resp: x => (x.responsible || '').trim() };
function filt(skip) {
  const q = norm(FS.q).split(' ').filter(Boolean), tf = (FTABS.find(t => t[0] == FS.tab) || FTABS[0])[2];
  return FD.rows.filter(x => {
    if (skip != 'tab' && !tf(x)) return false;
    for (const k in FKEYS) if (skip != k && FS[k] && FKEYS[k](x) != FS[k]) return false;
    if (FS.insp && String(x.inspection_id) != String(FS.insp)) return false;
    const d = String(x.created_at).slice(0, 10);
    if (FS.from && d < FS.from) return false; if (FS.to && d > FS.to) return false;
    for (const w of q) if (!x._s.includes(w)) return false;
    return true;
  });
}
const SORTS = { new: (a, b) => new Date(b.created_at) - new Date(a.created_at), old: (a, b) => new Date(a.created_at) - new Date(b.created_at), sev: (a, b) => (b.severity || 0) - (a.severity || 0) || new Date(b.created_at) - new Date(a.created_at), due: (a, b) => (a.due_date || '9999') < (b.due_date || '9999') ? -1 : (a.due_date || '9999') > (b.due_date || '9999') ? 1 : 0 };
const GRPS = { cat: ['دسته', x => x._c], loc: ['محل', x => nl(x.location)], mod: ['چک‌لیست', x => nm(x.module) || x.module], sev: ['شدت', x => SEVN[x.severity] || 'نامشخص'], resp: ['مسئول', x => (x.responsible || '').trim() || 'بدون مسئول'] };

function fcard(x) {
  const bp = (x.photos_before || [])[0], np = (x.photos_before || []).length + (x.photos_after || []).length;
  return `<div class="fc s${x.severity || 2}" data-a="fopen" data-id="${esc(x.id)}">
    <span class="th sm">${bp ? `<img data-p="${esc(bp)}" data-c="${esc(x.created_at)}" data-k="t" alt="">` : ''}</span>
    <div class="fb">
      <b class="fq">${esc(x.question)}</b>
      <small>${mn(x.module)} · ${esc(x.location)} · ${fd(x.created_at)}</small>
      <div class="fg">
        ${x.status == 'open' ? '<span class="bg r">باز</span>' : '<span class="bg g">اصلاح‌شده</span>'}
        ${sevB(x)}${isOver(x) ? '<span class="bg r">عقب‌افتاده</span>' : ''}
        ${x.status == 'open' && !x.notice_at ? '<span class="bg y">بدون اعلان</span>' : ''}
        <span class="ct">${esc(x._c)}</span>${np ? `<span class="ct">🖼 ${fa(np)}</span>` : ''}
      </div>
    </div></div>`;
}

function fpanel() {
  const el = $('#fpanel'); if (!el) return;
  const opt = (key, label, all) => {
    const c = cnt(filt(key), FKEYS[key]).sort((a, b) => key == 'sev' ? b[0] - a[0] : b[1] - a[1]);
    const nmf = v => key == 'mod' ? (nm(v) || v) : key == 'sev' ? (SEVN[v] || 'نامشخص') : v || 'بدون مسئول';
    const cur = FS[key], has = c.some(r => r[0] == cur);
    return `<label class="fl">${label}<select data-ff="${key}"><option value="">${all}</option>${c.map(r => `<option value="${esc(r[0])}" ${cur == r[0] ? 'selected' : ''}>${esc(nmf(r[0]))} (${fa(r[1])})</option>`).join('')}${cur && !has ? `<option value="${esc(cur)}" selected>${esc(nmf(cur))} (۰)</option>` : ''}</select></label>`;
  };
  el.hidden = !FS.fo;
  el.innerHTML = `<div class="fgrid">
      ${opt('cat', 'دسته', 'همه دسته‌ها')}${opt('mod', 'چک‌لیست', 'همه چک‌لیست‌ها')}
      ${opt('sev', 'شدت', 'همه شدت‌ها')}${opt('loc', 'محل', 'همه محل‌ها')}
      ${opt('resp', 'مسئول پیگیری', 'همه')}
      <label class="fl">گروه‌بندی<select data-ff="grp"><option value="">بدون گروه‌بندی</option>${Object.entries(GRPS).map(([k, v]) => `<option value="${k}" ${FS.grp == k ? 'selected' : ''}>بر اساس ${v[0]}</option>`).join('')}</select></label>
      <label class="fl">از تاریخ ثبت<input type="date" data-ff="from" value="${FS.from}"></label>
      <label class="fl">تا تاریخ<input type="date" data-ff="to" value="${FS.to}"></label>
      <label class="fl">مرتب‌سازی<select data-ff="sort">${[['new', 'جدیدترین'], ['old', 'قدیمی‌ترین'], ['sev', 'شدت بالا'], ['due', 'نزدیک‌ترین مهلت']].map(([v, t]) => `<option value="${v}" ${FS.sort == v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    </div>
    <button class="l" data-a="fclear" style="margin-top:10px;color:var(--nc);">✕ پاک‌کردن همه فیلترها</button>`;
  const n = ['mod', 'cat', 'sev', 'loc', 'resp', 'from', 'to'].filter(k => FS[k]).length + (FS.grp ? 1 : 0);
  const b = $('#fbt'); if (b) b.textContent = '⚙️ فیلتر و گروه‌بندی' + (n ? ' (' + fa(n) + ')' : '');
}

function fres() {
  const el = $('#fres'); if (!el) return;
  const rows = filt().sort(SORTS[FS.sort]), over = rows.filter(isOver).length;
  const tabs = FTABS.map(t => `<button class="tb ${FS.tab == t[0] ? 'on' : ''}" data-a="ftab" data-t="${t[0]}">${t[1]} <i>${fa(filt('tab').filter(t[2]).length)}</i></button>`).join('');
  let body = '';
  if (!rows.length) body = '<p style="text-align:center;padding:30px 0;color:var(--mu);">موردی با این شرایط پیدا نشد.</p>';
  else if (FS.grp) {
    const g = GRPS[FS.grp], m = new Map(); rows.forEach(x => { const k = g[1](x); (m.get(k) || m.set(k, []).get(k)).push(x); });
    body = [...m.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, a]) => {
      const op = !!FS.gopen[k], lim = FS.gn[k] || 20, ob = a.filter(x => x.status == 'open').length;
      return `<div class="gh ${op ? 'on' : ''}" data-a="gtoggle" data-g="${esc(k)}"><b>${esc(k)}</b><span>${fa(a.length)} مورد${ob ? ` · <em>${fa(ob)} باز</em>` : ''} <i>${op ? '▾' : '‹'}</i></span></div>` +
        (op ? a.slice(0, lim).map(fcard).join('') + (a.length > lim ? `<button class="p" data-a="gmore" data-g="${esc(k)}" style="background:var(--card-bg);color:var(--ink);border-color:var(--ln);">نمایش بیشتر (${fa(a.length - lim)} مورد دیگر)</button>` : '') : '');
    }).join('');
  } else {
    body = rows.slice(0, FS.n).map(fcard).join('') + (rows.length > FS.n ? `<button class="p" data-a="fmore" style="background:var(--card-bg);color:var(--ink);border-color:var(--ln);">نمایش ${fa(Math.min(PAGE, rows.length - FS.n))} مورد بعدی (از ${fa(rows.length - FS.n)} مورد باقی‌مانده)</button>` : '');
  }
  el.innerHTML = `<div class="tabs">${tabs}</div>
    <small style="margin:8px 2px 0;">${fa(rows.length)} مورد پیدا شد${over && FS.tab != 'over' ? ` · <b style="color:var(--nc)">${fa(over)} مورد عقب‌افتاده</b>` : ''}</small>${body}`;
  li();
}

async function finds(iid, force) {
  if (iid !== undefined && iid !== null) FS.insp = iid;
  view('<p style="text-align:center; padding:40px;">در حال بارگذاری عدم‌انطباق‌ها...</p>');
  try {
    await loadFD(force);
    view(`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <button class="l" data-a="home" style="margin:0;">‹ بازگشت به لیست</button>
        <a href="index.html" class="back">← داشبورد اصلی</a>
      </div>
      <h2>مدیریت و پیگیری عدم‌انطباق‌ها</h2>
      <div style="display:flex; gap:8px; margin-top:6px;">
        <input data-fq="1" type="search" placeholder="جستجو: متن، محل، مسئول، کد اعلان، یا کد مثل F-3" value="${esc(FS.q)}" style="margin-top:0;flex:1;">
      </div>
      <div style="display:flex; gap:8px; margin-top:8px;">
        <button id="fbt" data-a="ftoggle" style="flex:1;min-height:42px;font-size:13px;">⚙️ فیلتر و گروه‌بندی</button>
        <button data-a="frefresh" style="min-height:42px;font-size:13px;" title="دریافت مجدد از سرور">🔄</button>
        <button data-a="archive" style="min-height:42px;font-size:13px;">💾 حجم عکس‌ها</button>
      </div>
      ${FS.insp ? '<small style="margin-top:6px;color:var(--warn);">فقط موارد یک بازدید خاص نمایش داده می‌شود. <b data-a="fclear" style="cursor:pointer;text-decoration:underline;">نمایش همه</b></small>' : ''}
      <div id="fpanel" class="fp" hidden></div>
      <div id="fres"></div>
    `);
    fpanel(); fres();
  } catch (e) { alert(e.message); }
}

/* ===== صفحه جزئیات یک عدم‌انطباق: چهار تب، هر بار فقط یک بخش ===== */
function fnav(id) {
  const rows = filt().sort(SORTS[FS.sort]), i = rows.findIndex(x => String(x.id) == String(id));
  return { i, n: rows.length, prev: rows[i - 1], next: rows[i + 1] };
}
async function fdetail(id, tab) {
  const x = FD.map.get(String(id)); if (!x) return finds();
  FS.id = String(id);
  if (tab !== undefined) FS.dt = tab;
  else if (FS.dtId != String(id)) FS.dt = !x.notice_at && x.status == 'open' ? 2 : x.status == 'open' ? 3 : 1;
  FS.dtId = String(id);
  const nv = fnav(id), dt = FS.dt, nb = (x.photos_before || []).length, na = (x.photos_after || []).length;
  const steps = [[1, 'ثبت', true], [2, 'اعلان رسمی', !!x.notice_at], [3, 'اقدام اصلاحی', x.status == 'closed'], [4, 'تاریخچه', false]];
  const row = (k, v) => v ? `<div class="kv"><span>${k}</span><b>${v}</b></div>` : '';
  let panel = '';
  if (dt == 1) panel = `
      <div class="kvs">
        ${row('شرح عدم‌انطباق', esc(x.note) || '—')}
        ${row('محل', esc(x.location))}
        ${row('چک‌لیست', mn(x.module) + ' · کد ' + esc(x.module + '-' + x.qid))}
        ${row('دسته', esc(x._c))}
        ${row('ثبت', fd(x.created_at))}
        ${row('مهلت اصلاح', x.due_date ? fd(x.due_date) + (isOver(x) ? ' <span class="bg r">گذشته</span>' : '') : '')}
        ${row('مسئول پیگیری', esc(x.responsible))}
        ${row('علت ریشه‌ای', esc(x.root_cause))}
      </div>
      <div class="sec" style="margin-top:16px;font-size:14px;">عکس‌های قبل از اصلاح (${fa(nb)})</div>
      <div class="ph">${th(x.photos_before, x.created_at, true) || '<small>عکسی ثبت نشده است.</small>'}</div>`;
  else if (dt == 2) panel = x.notice_at ? `
      <div class="ok-box">✅ اعلان رسمی ثبت شده است<br><small style="color:inherit;opacity:.8;">کد: <b dir="ltr">${esc(x.notice_code)}</b> · ${fd(x.notice_at)}</small></div>
      <button class="l" data-a="ntc-undo" data-id="${esc(x.id)}" style="margin-top:12px;color:var(--nc);">لغو ثبت اعلان</button>` : `
      <small>کد شناسه/اعلان صادره را وارد و ثبت کنید.</small>
      <input id="ncode" dir="ltr" placeholder="مثلاً N-1405-017">
      <button class="p" data-a="ntc-save" data-id="${esc(x.id)}">ثبت اعلان رسمی</button>`;
  else if (dt == 3) panel = `
      <label class="fl">علت ریشه‌ای (الزامی برای بستن)<select data-rc="${esc(x.id)}"><option value="">انتخاب کنید...</option>${RCS.map(rc => `<option ${x.root_cause == rc ? 'selected' : ''}>${rc}</option>`).join('')}</select></label>
      <div class="sec" style="margin-top:16px;font-size:14px;">عکس‌های پس از اصلاح (${fa(na)})</div>
      <div class="ph">${th(x.photos_after, x.created_at, true)}</div>
      <button class="ad" data-a="addaf" data-id="${esc(x.id)}" style="margin-top:10px;">+ افزودن عکس پس از اصلاح</button>
      ${x.status == 'closed'
        ? `<div class="ok-box" style="margin-top:14px;">✅ اصلاح‌شده و بسته شده ${x.closed_at ? '(' + fd(x.closed_at) + ')' : ''}</div><button class="l" data-a="reopen" data-id="${esc(x.id)}" style="margin-top:10px;color:var(--nc);">بازگشایی مجدد</button>`
        : na ? `<button class="p" data-a="close" data-id="${esc(x.id)}">✔ تایید انجام اقدام اصلاحی و بستن</button>` : '<small style="margin-top:10px;">برای بستن، حداقل یک عکس پس از اصلاح لازم است.</small>'}`;
  else panel = '<div id="flog"><small>در حال دریافت تاریخچه...</small></div>';

  view(`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <button class="l" data-a="fback" style="margin:0;">‹ بازگشت به فهرست</button>
      <span style="display:flex;gap:6px;align-items:center;">
        <button class="l" data-a="fnav" data-id="${nv.prev ? esc(nv.prev.id) : ''}" ${nv.prev ? '' : 'disabled style="opacity:.3"'}>‹ قبلی</button>
        <small>${nv.i >= 0 ? fa(nv.i + 1) + ' از ' + fa(nv.n) : ''}</small>
        <button class="l" data-a="fnav" data-id="${nv.next ? esc(nv.next.id) : ''}" ${nv.next ? '' : 'disabled style="opacity:.3"'}>بعدی ›</button>
      </span>
    </div>
    <div class="q ${x.status == 'open' ? 'bad' : 'good'}" style="margin-top:0;">
      <p>${esc(x.question)}</p>
      <small style="margin-top:4px;">${mn(x.module)} · ${esc(x.location)} · ${fd(x.created_at)}</small>
      <div style="margin-top:8px;">${x.status == 'open' ? '<span class="bg r">باز</span>' : '<span class="bg g">اصلاح‌شده</span>'}${sevB(x)}${isOver(x) ? '<span class="bg r">عقب‌افتاده</span>' : ''}<span class="ct">${esc(x._c)}</span></div>
      <button class="ad" data-a="edit-f" data-id="${esc(x.id)}" style="margin-top:12px;min-height:38px;">✏️ ویرایش اطلاعات و عکس‌ها</button>
    </div>
    <div class="tabs" style="margin-top:12px;">${steps.map(([n, t, d]) => `<button class="tb ${dt == n ? 'on' : ''}" data-a="dtab" data-t="${n}">${d ? '✓ ' : ''}${t}</button>`).join('')}</div>
    <div class="q" style="margin-top:10px;">${panel}</div>
  `);
  li();
  if (dt == 4) {
    let h = '';
    try {
      const L = await api('finding_logs?finding_id=eq.' + encodeURIComponent(x.id) + '&order=created_at.desc&limit=100');
      const AN = { EDIT: 'ویرایش', PHOTO_ADD_AFTER: 'افزودن عکس پس از اصلاح', PHOTO_ADD: 'افزودن عکس', PHOTO_REMOVE: 'حذف عکس', NOTICE: 'ثبت اعلان', NOTICE_UNDO: 'لغو اعلان', CLOSE: 'بستن (اصلاح)', REOPEN: 'بازگشایی', ROOT_CAUSE: 'علت ریشه‌ای' };
      h = L.map(l => { const [a, f] = String(l.action_type).split(':'); return `<div class="kv"><span>${fd(l.created_at)} ${ft(l.created_at)}<br>${esc(l.actor)}</span><b>${AN[a] || esc(a)}${f ? ' — ' + esc(f) : ''}${l.old_value || l.new_value ? `<small style="color:var(--mu);font-weight:400;">${l.old_value ? esc(l.old_value) + ' ← ' : ''}${esc(l.new_value)}</small>` : ''}</b></div>`; }).join('') || '<small>تغییری ثبت نشده است.</small>';
    } catch (e) { h = '<small>برای نمایش تاریخچه، یک‌بار فایل setup_checklists.sql را در Supabase اجرا کنید.</small>'; }
    const el = $('#flog'); if (el) el.innerHTML = h;
  }
}

/* ===== ویرایش اطلاعات و عکس‌ها ===== */
let EF = null;
function fedit(id) {
  if (id !== undefined) {
    const x = FD.map.get(String(id));
    EF = { id: String(id), note: x.note || '', loc: x.location || '', sev: x.severity || 2, cat: x._c, resp: x.responsible || '', due: x.due_date || '', before: [...(x.photos_before || [])], after: [...(x.photos_after || [])], addB: [], addA: [], rm: [] };
  }
  const x = FD.map.get(EF.id), cats = [...new Set([...CATS.map(c => c[0]), 'نظم و ایمنی عمومی', 'بهداشت و محیط‌زیست', EF.cat])];
  const grid = (k, paths, add) => `<div class="ph">${paths.map((p, j) => `<span class="th bg2"><img data-p="${esc(p)}" data-c="${esc(x.created_at)}" data-k="t" alt=""><b data-a="efrm" data-k="${k}" data-j="${j}">×</b></span>`).join('')}${add.map((p, j) => `<span class="th bg2"><img src="${p.u}" alt=""><b data-a="efrmn" data-k="${k}" data-j="${j}">×</b></span>`).join('')}</div>`;
  view(`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <button class="l" data-a="ef-cancel" style="margin:0;">‹ انصراف و بازگشت</button>
    </div>
    <h2>✏️ ویرایش عدم‌انطباق</h2>
    <small>${esc(x.question)}</small>
    <div class="q">
      <label class="fl">شرح عدم‌انطباق (الزامی)<textarea data-ef="note" rows="4">${esc(EF.note)}</textarea></label>
      <label class="fl">محل (الزامی)<input data-ef="loc" list="locs" value="${esc(EF.loc)}"></label>
      <datalist id="locs">${LOCS.map(l => `<option value="${l}">`).join('')}</datalist>
      <div class="fgrid">
        <label class="fl">شدت<select data-ef="sev">${[1, 2, 3, 4].map(v => `<option value="${v}" ${EF.sev == v ? 'selected' : ''}>${SEVN[v]}</option>`).join('')}</select></label>
        <label class="fl">مهلت اصلاح<input type="date" data-ef="due" value="${esc(EF.due)}"></label>
        <label class="fl">دسته<select data-ef="cat">${cats.map(c => `<option ${EF.cat == c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <label class="fl">مسئول پیگیری<input data-ef="resp" value="${esc(EF.resp)}" placeholder="نام مسئول"></label>
      </div>
      <div class="sec" style="font-size:14px;">عکس‌های قبل از اصلاح</div>
      ${grid('b', EF.before, EF.addB)}
      <button class="ad" data-a="efadd" data-k="b" style="margin-top:8px;">+ افزودن عکس</button>
      <div class="sec" style="font-size:14px;">عکس‌های پس از اصلاح</div>
      ${grid('a', EF.after, EF.addA)}
      <button class="ad" data-a="efadd" data-k="a" style="margin-top:8px;">+ افزودن عکس</button>
      <small style="margin-top:8px;">عکس‌های حذف‌شده هنگام ذخیره، از فضای سرور هم پاک می‌شوند. همه تغییرات در تاریخچه ثبت می‌شود.</small>
      <button class="p" data-a="ef-save">ذخیره تغییرات</button>
    </div>`);
  li();
}
async function saveEdit() {
  const x = FD.map.get(EF.id), body = {}, logs = [];
  const note = EF.note.trim(), loc = EF.loc.trim();
  if (!note) return alert('شرح عدم‌انطباق نمی‌تواند خالی باشد.');
  if (!loc) return alert('محل را بنویسید.');
  const ch = (k, f, nv, lab) => { const ov = x[f] ?? ''; if (String(ov) !== String(nv)) { body[f] = nv === '' ? null : nv; logs.push(['EDIT:' + lab, ov, nv]); } };
  ch('note', 'note', note, 'شرح'); ch('loc', 'location', loc, 'محل'); ch('sev', 'severity', +EF.sev, 'شدت'); ch('due', 'due_date', EF.due, 'مهلت');
  ch('cat', 'category', EF.cat, 'دسته'); ch('resp', 'responsible', EF.resp.trim(), 'مسئول');
  const kept = { b: EF.before, a: EF.after }, rmP = [...(x.photos_before || []), ...(x.photos_after || [])].filter(p => ![...EF.before, ...EF.after].includes(p));
  const btn = $('[data-a=ef-save]');
  if (EF.after.length + EF.addA.length == 0 && x.status == 'closed' && (x.photos_after || []).length) {
    if (!confirm('با حذف همه عکس‌های «پس از اصلاح»، وضعیت این مورد به «باز» برمی‌گردد. ادامه می‌دهید؟')) return;
    body.status = 'open'; body.closed_at = null; logs.push(['REOPEN', 'closed', 'open']);
  }
  if (EF.before.length + EF.addB.length == 0) return alert('حداقل یک عکس «قبل از اصلاح» باید باقی بماند.');
  btn.disabled = true; btn.textContent = 'در حال ذخیره...';
  try {
    const nb = [], na = [];
    for (const p of EF.addB) nb.push(await up(p.b));
    for (const p of EF.addA) na.push(await up(p.b));
    if (nb.length || rmP.some(p => (x.photos_before || []).includes(p))) body.photos_before = [...EF.before, ...nb];
    if (na.length || rmP.some(p => (x.photos_after || []).includes(p))) body.photos_after = [...EF.after, ...na];
    if (nb.length + na.length) logs.push(['PHOTO_ADD', '', fa(nb.length + na.length) + ' عکس']);
    if (rmP.length) logs.push(['PHOTO_REMOVE', '', fa(rmP.length) + ' عکس']);
    if (!Object.keys(body).length) { alert('تغییری ایجاد نشده است.'); btn.disabled = false; btn.textContent = 'ذخیره تغییرات'; return; }
    await patchF(EF.id, body, logs);
    if (rmP.length) await delPhotos(rmP);
    alert('تغییرات ذخیره شد.'); const id = EF.id; EF = null; fdetail(id, 1);
  } catch (e) { alert('خطا در ذخیره: ' + e.message); btn.disabled = false; btn.textContent = 'ذخیره تغییرات'; }
}

/* ===== حجم عکس‌ها و انتقال به کامپیوتر ===== */
const ARC = { stop: false, busy: false, photos: new Map(), sz: { ok: false, map: new Map(), thumbs: 0 } };
const fmtMB = b => fa((b / 1048576).toFixed(b > 1048576 * 10 ? 0 : 1));
async function listPhotos(prefix) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(PB.replace('/object/', '/object/list/') + 'photos', { method: 'POST', headers: { ...AH(), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix, limit: 1000, offset: off, sortBy: { column: 'name', order: 'asc' } }) });
    if (!r.ok) throw new Error('list ' + r.status);
    const a = await r.json(); out.push(...a); if (a.length < 1000) break;
  }
  return out;
}
async function archivePage() {
  view('<p style="text-align:center;padding:40px;">در حال محاسبه حجم عکس‌ها...</p>');
  try { await loadFD(); } catch (e) { alert(e.message); return home(); }
  ARC.photos = new Map(); FD.rows.forEach(x => [...(x.photos_before || []), ...(x.photos_after || [])].forEach(p => ARC.photos.set(p, { st: x.status, cd: x.status == 'closed' && x.closed_at ? x.closed_at : x.created_at })));
  ARC.sz = { ok: false, map: new Map(), thumbs: 0 };
  try {
    (await listPhotos('')).forEach(o => { if (o.id && o.metadata) ARC.sz.map.set(o.name, o.metadata.size || 0); });
    try { (await listPhotos('thumbs')).forEach(o => { if (o.metadata) ARC.sz.thumbs += o.metadata.size || 0; }); } catch (e) { }
    ARC.sz.ok = true;
  } catch (e) { }
  const total = [...ARC.sz.map.values()].reduce((a, b) => a + b, 0) + ARC.sz.thumbs, lim = +(localStorage.archMB || 500) * 1048576;
  if (ARC.sz.ok) { try { localStorage.usageMB = JSON.stringify({ mb: Math.round(total / 1048576), at: Date.now() }); } catch (e) { } }
  const h = await dirHandle(), granted = h ? await dirPerm(false) : null, sup = 'showDirectoryPicker' in window;
  let loc = '';
  if (granted) { try { let n = 0, s = 0; for await (const f of granted.values()) if (f.kind == 'file') { n++; s += (await f.getFile()).size; } loc = `${fa(n)} فایل · ${fmtMB(s)} مگابایت`; } catch (e) { } }
  const pc = ARC.sz.ok ? Math.min(100, total / lim * 100) : 0;
  view(`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <button class="l" data-a="finds" style="margin:0;">‹ بازگشت به پیگیری</button>
      <a href="index.html" class="back">← داشبورد اصلی</a>
    </div>
    <h2>💾 حجم عکس‌ها و آرشیو روی کامپیوتر</h2>
    <div class="row">
      <div class="t"><span>عکس‌های روی سرور (Supabase)</span><span>${ARC.sz.ok ? fmtMB(total) + ' مگابایت' : 'نامشخص'}</span></div>
      ${ARC.sz.ok ? `<div class="sb"><i style="width:${pc}%;background:${pc > 90 ? 'var(--nc)' : pc > 70 ? 'var(--warn)' : 'var(--ac)'}"></i></div><small style="margin-top:6px;">سقف هشدار: ${fa(lim / 1048576)} مگابایت · ${fa(ARC.sz.map.size)} عکس اصلی + نسخه‌های کوچک (${fmtMB(ARC.sz.thumbs)} مگابایت)</small>`
        : '<small style="margin-top:6px;color:var(--warn);">خواندن حجم از سرور ممکن نشد (سیاست دسترسی لیست‌کردن). فایل setup_checklists.sql را یک‌بار در Supabase اجرا کنید.</small>'}
      ${total > lim ? '<div class="ins hi" style="margin-top:8px;">⚠️ حجم از سقف هشدار گذشته است؛ عکس‌های قدیمی را به کامپیوتر منتقل کنید.</div>' : ''}
      <label class="fl" style="margin-top:8px;">سقف هشدار (مگابایت)<input id="amb" type="number" min="50" step="50" value="${localStorage.archMB || 500}" data-a-in="amb"></label>
      <small style="margin-top:6px;">${fa(ARC.photos.size)} عکس در پرونده‌ها ثبت شده است.</small>
    </div>
    <div class="sec">۱) پوشه آرشیو روی این کامپیوتر</div>
    <div class="row">
      ${sup ? '' : '<div class="ins hi">این مرورگر امکان انتخاب پوشه را ندارد. از Chrome یا Edge روی کامپیوتر استفاده کنید.</div>'}
      <div class="t"><span>پوشه فعلی</span><span>${h ? esc(h.name) : 'انتخاب نشده'}</span></div>
      ${h ? `<small>${granted ? '✅ دسترسی فعال' + (loc ? ' · ' + loc : '') : '⚠️ برای استفاده در این نشست باید دسترسی را فعال کنید.'}</small>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
        <button class="p" data-a="pickdir" style="margin:0;">📁 ${h ? 'تغییر پوشه' : 'انتخاب پوشه'}</button>
        ${h && !granted ? '<button class="p" data-a="grantdir" style="margin:0;background:var(--warn);border-color:var(--warn);">🔓 فعال‌سازی دسترسی</button>' : ''}
      </div>
    </div>
    <div class="sec">۲) انتقال عکس‌ها</div>
    <div class="row">
      <div class="fgrid">
        <label class="fl">کدام عکس‌ها<select id="ao"><option value="closed">فقط موارد اصلاح‌شده (پیشنهادی)</option><option value="all">همه موارد</option></select></label>
        <label class="fl">قدیمی‌تر از<select id="ad">${[[0, 'همه'], [30, '۳۰ روز'], [90, '۹۰ روز'], [180, '۶ ماه'], [365, 'یک سال']].map(([v, t]) => `<option value="${v}" ${v == 30 ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>
      <small style="margin-top:8px;line-height:1.9;">هر عکس ابتدا در پوشه ذخیره و صحت آن بررسی می‌شود، سپس نسخه کوچک (حدود ۸ کیلوبایت) روی سرور می‌ماند و عکس اصلی از سرور پاک می‌شود. بعد از آن:• روی همین کامپیوتر (با فعال بودن پوشه) عکس اصلی نمایش داده می‌شود.• روی بقیه دستگاه‌ها نسخه کوچک نمایش داده می‌شود.</small>
      <button class="p" data-a="runarc" ${sup ? '' : 'disabled'} style="background:#6366f1;border-color:#6366f1;color:#fff;">⬇️ شروع انتقال به کامپیوتر</button>
      <div id="arcout" style="margin-top:12px;"></div>
    </div>`);
}
async function runArchive() {
  if (ARC.busy) return;
  const dir = await dirPerm(true);
  if (!dir) return alert('ابتدا پوشه آرشیو را انتخاب کنید و دسترسی را فعال کنید.');
  const days = +$('#ad').value, only = $('#ao').value, cut = Date.now() - days * 864e5;
  const list = [...ARC.photos].filter(([p, i]) => (only == 'all' || i.st == 'closed') && new Date(i.cd).getTime() <= cut && (!ARC.sz.ok || ARC.sz.map.has(p))).map(r => r[0]);
  if (!list.length) return alert('عکسی با این شرایط برای انتقال پیدا نشد.');
  if (!confirm(`${fa(list.length)} عکس به پوشه «${dir.name}» منتقل و از سرور پاک می‌شود. ادامه می‌دهید؟`)) return;
  ARC.busy = true; ARC.stop = false;
  const out = $('#arcout'), btn = $('[data-a=runarc]'); btn.disabled = true;
  out.innerHTML = '<progress id="ap" value="0" max="1" style="width:100%"></progress><p id="at" style="text-align:center;margin:6px 0;"></p><button class="p" data-a="stoparc" style="background:var(--card-bg);color:var(--ink);border-color:var(--ln);">⏹ توقف</button>';
  const ap = $('#ap'), at = $('#at'); ap.max = list.length;
  let done = 0, skip = 0, saved = 0, err = '';
  for (const p of list) {
    if (ARC.stop) break;
    try {
      const b = await srvAny(p);
      if (!b) { skip++; }
      else {
        const fh = await dir.getFileHandle(p, { create: true }), w = await fh.createWritable(); await w.write(b); await w.close();
        if ((await fh.getFile()).size != b.size) throw new Error('بررسی صحت فایل ذخیره‌شده ناموفق بود');
        if (!(await srvAny('thumbs/' + p))) await upRaw('thumbs/' + p, await mkThumb(b));
        const r = await fetch(PB + 'photos/' + p, { method: 'DELETE', headers: AH() });
        let j = null; try { j = await r.json(); } catch (e) { }
        if (!r.ok || (Array.isArray(j) && !j.length)) throw new Error('حذف از سرور مجاز نیست (' + r.status + '). فایل setup_checklists.sql را در Supabase اجرا کنید؛ عکس‌ها سالم مانده‌اند.');
        saved += b.size;
      }
    } catch (e) { err = e.message; break; }
    done++; ap.value = done; at.textContent = `${fa(done)} از ${fa(list.length)} · ${fmtMB(saved)} مگابایت آزاد شد`;
  }
  ARC.busy = false;
  out.innerHTML = `<div class="${err ? 'ins hi' : 'ok-box'}">${err ? '⚠️ ' + esc(err) : ARC.stop ? 'متوقف شد.' : '✅ انتقال کامل شد.'}منتقل‌شده: ${fa(done - skip)} · ردشده (روی سرور نبود): ${fa(skip)} · فضای آزادشده: ${fmtMB(saved)} مگابایت</div><button class="p" data-a="archive" style="margin-top:10px;">🔄 محاسبه مجدد حجم</button>`;
}

/* ===== کتابخانه PowerPoint: اول فایل کنار سایت، بعد چند CDN؛ فقط هنگام نیاز بارگذاری می‌شود ===== */
let PPTX_P = null;
function ensurePptx() {
  if (typeof PptxGenJS != 'undefined') return Promise.resolve();
  if (PPTX_P) return PPTX_P;
  PPTX_P = (async () => {
    const srcs = ['pptxgen.bundle.js', 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', 'https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', 'https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js'];
    for (const u of srcs) {
      try {
        await new Promise((ok, no) => { const s = document.createElement('script'), t = setTimeout(() => no(new Error('timeout')), 25000); s.src = u; s.onload = () => { clearTimeout(t); ok(); }; s.onerror = () => { clearTimeout(t); no(new Error('load')); }; document.head.appendChild(s); });
        if (typeof PptxGenJS != 'undefined') return;
      } catch (e) { }
    }
    throw new Error('کتابخانه PowerPoint بارگذاری نشد. فایل pptxgen.bundle.js را کنار فایل checklists.html در GitHub آپلود کنید (یا از «چاپ مستقیم گزارش» استفاده کنید).');
  })().catch(e => { PPTX_P = null; throw e; });
  return PPTX_P;
}
