/* پیگیری عدم‌انطباق‌ها با واحد فنی: نامه + اکسل + ثبت پاسخ فنی از اکسل (مشترک؛ صفحهٔ tech_followup.html).
   نیاز به این متغیرها/توابع سراسری: api, fa, esc, fd, todayIso, isoAdd, SEVN, SLA, KL, HSEC, mail, loadFinds */
/* ===== چرخهٔ پیگیری: اکسل کامل + نامهٔ ارجاع به فنی + ثبت پاسخ فنی از اکسل + گزارش عدم‌تایید ===== */
async function loadXL() { if (!window.XLSX) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = () => no(new Error('بارگذاری کتابخانهٔ اکسل ناموفق بود')); document.head.appendChild(s); }); }
async function loadEJS() { if (!window.ExcelJS) await new Promise((ok, no) => { const e = document.createElement('script'); e.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'; e.onload = ok; e.onerror = () => no(new Error('بارگذاری کتابخانهٔ اکسل ناموفق بود')); document.head.appendChild(e); }); }
/* نامهٔ قابل‌ویرایش: متن کلی؛ روی خود صفحه ویرایش، سپس چاپ/کپی برای ایمیل */
function letterEdit(subject, paras) {
  const w = window.open('', '_blank'); if (!w) { alert('اجازهٔ باز شدن پنجره را بدهید.'); return; }
  w.document.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>نامه پیگیری</title><style>@page{size:A4;margin:16mm}body{font-family:Vazirmatn,Tahoma,sans-serif;font-size:13px;line-height:2.1;max-width:780px;margin:0 auto;padding:12px}.bar{position:sticky;top:0;background:#fffbe6;border:1px solid #f0d36b;padding:8px;margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.bar button{font:inherit;padding:4px 14px;cursor:pointer}.h{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:6px}.h b{font-size:15px}#L{outline:none}#L:focus{background:#fcfcf5}.s{margin-top:28px;padding-inline-end:30px;text-align:left}@media print{.bar{display:none}#L:focus{background:none}}</style></head><body>
    <div class="bar"><span>متن قابل ویرایش است؛ روی هر قسمت کلیک و تغییر دهید.</span><button onclick="print()">🖨 چاپ / PDF</button><button id="cp">📋 کپی متن برای ایمیل</button></div>
    <div id="L" contenteditable="true"><div class="h"><div><b>شرکت گسترش فناوری خوارزمی</b><br>واحد بهداشت، ایمنی و محیط زیست (HSE)</div><div>شماره: ........................<br>تاریخ: ${fa(new Date().toLocaleDateString('fa-IR-u-nu-latn'))}<br>پیوست: فایل اکسل</div></div>
    <p><b>گیرنده:</b> واحد فنی<br><b>موضوع:</b> ${subject}</p><p>با سلام و احترام،</p>${paras.map(p => '<p>' + p + '</p>').join('')}<div class="s">با تشکر<br>کارشناس HSE</div></div>
    <script>document.getElementById('cp').onclick=function(){var t=document.getElementById('L').innerText;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){alert('متن کپی شد')},function(){var r=document.createRange();r.selectNodeContents(document.getElementById('L'));var q=getSelection();q.removeAllRanges();q.addRange(r);document.execCommand('copy');alert('متن کپی شد')})}<\/script></body></html>`); w.document.close();
}
/* شرح تمیز عدم‌انطباق: برخی ثبت‌ها متن مرکب دارند («تجهیز: … — ثبت: … — وضعیت اعلان: … — سؤال چک‌لیست: …»)؛
   فقط خود شرح می‌ماند و کد/نام تجهیز از همان متن جدا می‌شود */
function descOf(x) {
  const raw = String(x.note || x.question || ''); let eqc = x.equipment_code && x.equipment_code != '0' ? x.equipment_code : '', eqt = x.equipment_title || '';
  const segs = raw.split(/\s+[—–]\s+|\s*\|\s*/).map(t => t.trim()).filter(Boolean), keep = [];
  segs.forEach(t => {
    let m;
    if ((m = /^تجهیز\s*[:：]\s*(.+)$/.exec(t))) { const mm = /^(.*?)\s*\(([A-Za-z0-9._\-]+)\)\s*$/.exec(m[1]); if (mm) { eqt = eqt || mm[1].trim(); eqc = eqc || mm[2]; } else eqt = eqt || m[1].trim(); return; }
    if (/^(ثبت|وضعیت اعلان|اعلان|تاریخ|شماره اعلان)\s*[:：]/.test(t)) return;
    keep.push(t.replace(/^(سؤال|سوال)\s*چک[‌ ]?لیست\s*[:：]\s*/, ''));
  });
  let q = (keep.join(' — ') || raw).trim();
  q = q.replace(/\s*\(([^()]+)\)\s*$/, (all, p) => (eqt && (eqt.includes(p.trim()) || p.includes(eqt))) || (x.location && String(x.location).includes(p.trim())) ? '' : all).trim();
  if (!eqc) eqt = ''; /* کد «۰»/خالی = تجهیز مشخص نیست */
  return { q, eqc, eqt };
}
const isGenericDesc = q => !q || /^\s*اعلان\s*[\d۰-۹]+/.test(q) || /^ورود دسته‌ای/.test(q);
const eqLine = r => r.eqc ? [r.eqc, r.eqt].filter(Boolean).join(' — ') : '—';
function descFull(x) {
  let d = descOf(x);
  if (isGenericDesc(d.q) && x._nt && x._nt.description) { const n = descOf({ note: x._nt.description, equipment_code: x.equipment_code, equipment_title: x.equipment_title }); if (n.q) d = { q: n.q, eqc: d.eqc || n.eqc, eqt: d.eqt || n.eqt }; }
  return d;
}
/* یک ردیف برای هر کد اعلان (چند عدم‌انطباق با یک اعلان ادغام می‌شوند؛ شناسه‌ها با ویرگول) */
function byNotice(data) {
  const m = new Map(); data.forEach(r => { const k = String(r.no); if (!m.has(k)) m.set(k, { ...r, ids: [r.id] }); else m.get(k).ids.push(r.id); });
  const loc = r => /نامشخص|^\s*$/.test(r.loc) ? '\uffff' : r.loc;
  return [...m.values()].sort((a, b) => loc(a).localeCompare(loc(b), 'fa') || String(a.no).localeCompare(String(b.no), undefined, { numeric: true })).map((r, i) => ({ ...r, n: i + 1 }));
}
async function cycleData() {
  let rows = []; for (let o = 0; o < 20000; o += 1000) { const r = await api('findings?select=id,question,note,location,module,category,severity,responsible,due_date,created_at,notice_code,inspector,equipment_code,equipment_title&status=eq.open&module=neq.MED&order=created_at.asc&limit=1000&offset=' + o); rows = rows.concat(r || []); if ((r || []).length < 1000) break; }
  rows = rows.filter(x => { const c = String(x.notice_code || '').trim(); return c && c.toUpperCase() != 'NOTICED'; }); /* فقط مواردی که کد اعلان واقعی دارند */
  const fm = {}; try { const ids = rows.map(r => r.id); for (let i = 0; i < ids.length; i += 150) (await api('finding_followups?select=*&order=followed_at.desc,created_at.desc&finding_id=in.(' + ids.slice(i, i + 150).join(',') + ')')).forEach(f => (fm[f.finding_id] = fm[f.finding_id] || []).push(f)); } catch (e) {}
  /* شرح عدم‌انطباق‌های واردشده از گزارش فنی («اعلان ۱۷۲۲۰ (تعمیراتی)») از جدول اعلان‌ها گرفته می‌شود */
  const NT = {}; try { const cs = [...new Set(rows.map(r => String(r.notice_code).trim()))]; for (let i = 0; i < cs.length; i += 100) (await api('notices?select=*&no=in.(' + cs.slice(i, i + 100).map(c => encodeURIComponent(c)).join(',') + ')')).forEach(n => { NT[String(n.no)] = n; }); } catch (e) { }
  rows.forEach(x => { const n = NT[String(x.notice_code).trim()]; if (!n) return; x._nt = n; if (!x.equipment_code && n.equipment_code) x.equipment_code = n.equipment_code; if (!x.equipment_title) x.equipment_title = n.equipment_title || n.equipment_name || n.equipment || ''; });
  const t0 = todayIso();
  return rows.map((x, i) => { const L = fm[x.id] || [], l = L[0], age = Math.round((new Date(t0 + 'T12:00:00Z') - new Date(new Date(x.created_at).toLocaleDateString('en-CA') + 'T12:00:00Z')) / 864e5);
    return { id: x.id, n: i + 1, no: x.notice_code || '', d: fd(x.created_at), age, loc: x.location || '', ...descFull(x), cat: x.category || '', sev: SEVN[x.severity] || '', resp: x.responsible || '', due: x.due_date ? fd(x.due_date + 'T12:00:00') : '', l, L,
      dd: x.due_date ? String(x.due_date).slice(0, 10) : (SLA[x.severity] ? isoAdd(new Date(x.created_at).toLocaleDateString('en-CA'), SLA[x.severity]) : ''), lf: l ? fd(l.followed_at + 'T12:00:00') + ' — ' + (KL[l.kind] || 'پیگیری') + ': ' + l.result : '', st: l && l.kind == 'claim' ? 'فنی اعلام انجام داده؛ منتظر بازدید' : l && l.kind == 'rejected' ? 'عدم تایید شده' : '' }; });
}
function letterDoc(title, subject, intro, head, body, closing) {
  const w = window.open('', '_blank'); if (!w) { alert('اجازهٔ باز شدن پنجره را بدهید.'); return; }
  w.document.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4;margin:14mm}body{font-family:Vazirmatn,Tahoma,sans-serif;font-size:12px;line-height:1.9}.h{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:6px}.h b{font-size:15px}table{width:100%;border-collapse:collapse;margin:8px 0}td,th{border:1px solid #000;padding:3px 6px;vertical-align:top;font-size:11px}th{background:#eee}tr{page-break-inside:avoid}.s{margin-top:28px;display:flex;justify-content:flex-end;padding-inline-end:30px}</style></head><body>
    <div class="h"><div><b>شرکت گسترش فناوری خوارزمی</b><br>واحد بهداشت، ایمنی و محیط زیست (HSE)</div><div>شماره: ........................<br>تاریخ: ${fa(new Date().toLocaleDateString('fa-IR-u-nu-latn'))}<br>پیوست: دارد</div></div>
    <p><b>گیرنده:</b> واحد فنی<br><b>موضوع:</b> ${subject}</p><p>با سلام و احترام،</p><p>${intro}</p>
    <table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${body.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>
    <p>${closing}</p><div class="s"><div>با تشکر<br>کارشناس HSE</div></div><script>setTimeout(()=>print(),500)<\/script></body></html>`); w.document.close();
}
function fuMakeLetter(rows) {
  letterEdit('پیگیری عدم‌انطباق‌های معوق ایمنی و اعلام برنامهٔ اقدام',
        [`در حال حاضر <b>${fa(rows.length)} مورد</b> عدم‌انطباق ایمنی که برای آن‌ها اعلان ثبت شده است، با گذشت مهلت اصلاح (بر اساس شدت هر مورد) تا تاریخ ${fa(new Date().toLocaleDateString('fa-IR-u-nu-latn'))} همچنان باز است. فهرست کامل این موارد شامل کد اعلان، تجهیز، محل و شرح هر مورد در فایل اکسل پیوست آمده است.`,
          `خواهشمند است آن واحد برای هر مورد، سه ستون نارنجی فایل («وضعیت اعلامی»، «برنامه اقدام» و «مهلت») را تکمیل کرده و ظرف ۳ روز کاری به واحد HSE بازگرداند. در صورت انجام اقدام، وضعیت «انجام شد» ثبت شود تا بازدید میدانی و تایید انجام شود.`,
          'پیگیری مجدد موارد باز در روزهای ۱ و ۱۵ هر ماه انجام خواهد شد.']);
}
async function fuMakeXls(rows) {
    await Promise.all([loadXL(), loadEJS()]);
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('عدم‌انطباق‌های معوق', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1', paperSize: 9 } });
    ws.columns = [{ header: 'شناسه', key: 'id', width: 8, hidden: true }, { header: 'ردیف', key: 'n', width: 6 }, { header: 'اعلان', key: 'no', width: 9 }, { header: 'کد و نام تجهیز', key: 'eq', width: 26 }, { header: 'محل', key: 'loc', width: 20 }, { header: 'شرح عدم‌انطباق', key: 'q', width: 44 }, { header: 'وضعیت اعلامی واحد فنی', key: 'a', width: 18 }, { header: 'برنامه اقدام', key: 'b', width: 30 }, { header: 'مهلت (مثال ۱۴۰۵/۰۸/۲۰)', key: 'c', width: 16 }];
    const thin = { style: 'thin', color: { argb: 'FFBFC5CC' } }, bd = { top: thin, left: thin, bottom: thin, right: thin }, al = { vertical: 'middle', horizontal: 'right', wrapText: true, readingOrder: 'rtl' };
    const hr = ws.getRow(1); hr.height = 30; hr.eachCell((c, k) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k >= 7 ? 'FFB45309' : 'FF0F766E' } }; c.alignment = { ...al, horizontal: 'center' }; c.border = bd; });
    rows.forEach((r, i) => { const row = ws.addRow({ id: r.ids.join(','), n: r.n, no: r.no, eq: r.eqc ? eqLine(r) : '', loc: r.loc, q: r.q, a: '', b: '', c: '' });
      row.eachCell({ includeEmpty: true }, (c, k) => { c.alignment = k == 2 || k == 3 ? { ...al, horizontal: 'center' } : al; c.border = bd; c.font = { size: 10 }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k >= 7 ? 'FFFFF7E0' : (i % 2 ? 'FFF3F6F8' : 'FFFFFFFF') } }; });
      row.getCell(7).dataValidation = { type: 'list', allowBlank: true, formulae: ['"در حال انجام,نیاز به تأمین,انجام شد,برنامه ندارد"'] };
      row.height = Math.max(20, Math.ceil(String(r.q).length / 42) * 15 + 4); });
    ws.autoFilter = { from: 'A1', to: 'I' + (rows.length + 1) };
    const gs = wb.addWorksheet('راهنما', { views: [{ rightToLeft: true }] }); gs.columns = [{ width: 100 }];
    ['راهنمای تکمیل توسط واحد فنی', 'ستون‌های نارنجی را پر کنید: وضعیت اعلامی (از فهرست)، برنامه اقدام (چه کاری، توسط چه کسی)، مهلت (تاریخ شمسی مانند 1405/08/20).', 'ردیف‌ها را حذف یا جابه‌جا نکنید؛ فایل تکمیل‌شده به HSE بازگردانده می‌شود.'].forEach((t, i) => { const c = gs.addRow([t]).getCell(1); c.alignment = al; if (!i) c.font = { bold: true, size: 13 }; });
    const buf = await wb.xlsx.writeBuffer(), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = 'follow-up-' + todayIso() + '.xlsx'; document.body.appendChild(a); a.click(); a.remove();
}
/* همهٔ موارد معوقِ دارای کد اعلان بدون انتخاب در نامه و اکسل می‌آیند؛ فقط یادآوری بررسی برای کارشناس */
function fuPick(rows) {
  const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);overflow:auto;padding:12px';
  o.innerHTML = `<div class="q" style="max-width:520px;margin:60px auto;background:var(--card);" dir="rtl"><b>📤 نامه و اکسل پیگیری برای واحد فنی</b>
    <p style="margin:10px 0;font-size:13px;line-height:2;">${fa(rows.length)} عدم‌انطباق معوق (دارای کد اعلان) در نامه و اکسل می‌آید.</p>
    <div style="border:1px solid var(--wa,#d97706);background:rgba(217,119,6,.1);border-radius:10px;padding:10px;font-size:13px;line-height:2;">⚠ <b>قبل از ارسال به واحد فنی</b>، همهٔ ردیف‌های اکسل را یک‌به‌یک بررسی کنید و از صحت اطلاعات مطمئن شوید. ممکن است عدم‌انطباقی در عمل اصلاح شده و به‌اشتباه باز مانده باشد؛ چنین مواردی را قبل از ارسال ببندید یا از فایل حذف کنید.</div>
    <div style="display:flex;gap:8px;margin-top:12px;"><button class="chip" id="fpX">انصراف</button><span style="flex:1"></span><button class="chip on" id="fpGo">✉ ایجاد نامه و اکسل</button></div></div>`;
  document.body.appendChild(o);
  o.querySelector('#fpX').onclick = () => o.remove();
  o.querySelector('#fpGo').onclick = async e => { const b = e.target, t = b.textContent; b.textContent = '… در حال ساخت'; b.disabled = true;
    const R = rows.map((r, k) => ({ ...r, n: k + 1 }));
    try { fuMakeLetter(R); await fuMakeXls(R); o.remove(); } catch (er) { alert(er.message); b.textContent = t; b.disabled = false; } };
}
async function exportOpen(kind, btn) {
  const old = btn.textContent; btn.textContent = '… در حال آماده‌سازی'; btn.disabled = true;
  try {
    let data = await cycleData();
    if (kind == 'rej') {
      const R = data.filter(r => r.l && r.l.kind == 'rejected');
      if (!R.length) { alert('مورد عدم‌تاییدشده‌ای (باز و دارای کد اعلان) ثبت نشده است.'); return; }
      letterDoc('گزارش عدم تایید', 'گزارش عدم‌تایید اقدامات اعلام‌شده برای رفع عدم‌انطباق‌های ایمنی',
        `بر اساس پیگیری‌های انجام‌شده، واحد فنی انجام اقدام اصلاحی ${fa(R.length)} مورد از عدم‌انطباق‌ها را اعلام کرده بود. پس از بازدید میدانی HSE، اقدام انجام‌شده در موارد زیر <b>تایید نشد</b>. خواهشمند است نسبت به رفع نواقص اعلام‌شده اقدام و نتیجه را اعلام فرمایید.`,
        ['ردیف', 'اعلان', 'کد و نام تجهیز', 'محل دقیق', 'شرح عدم‌انطباق', 'تاریخ عدم تایید', 'دلیل عدم تایید'],
        R.map((r, i) => [fa(i + 1), r.no, eqLine(r), r.loc, r.q, fd(r.l.followed_at + 'T12:00:00'), r.l.result]),
        'پس از انجام اصلاح، مراتب را به واحد HSE اعلام فرمایید تا بازدید مجدد انجام شود.'); return;
    }
    /* فقط معوقه‌ها بر اساس مهلت اصلاحِ تعریف‌شده با شدت (SLA): مهلت اصلاح گذشته باشد */
    const t0 = todayIso(), allN = data.length; data = data.filter(r => r.dd && r.dd < t0);
    if (!data.length) { alert(allN ? 'هیچ‌کدام از ' + fa(allN) + ' عدم‌انطباق باز دارای اعلان، از مهلت اصلاح نگذشته است.' : 'عدم‌انطباق بازی که کد اعلان آن ثبت شده باشد وجود ندارد.'); return; }
    fuPick(byNotice(data)); return;
  } catch (e) { alert(e.message); } finally { btn.textContent = old; btn.disabled = false; }
}
async function importReplies(file) {
  try {
    await loadXL(); const wb = XLSX.read(await file.arrayBuffer()), ws = wb.Sheets[wb.SheetNames[0]], R = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(1);
    const hd = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })[0] || [], ix = re => { const k = hd.findIndex(h => re.test(String(h))); return k; }, cS = ix(/وضعیت اعلامی/), cP = ix(/برنامه اقدام/), cD = ix(/مهلت (اعلامی|\()/); /* بر اساس عنوان ستون (فایل‌های قدیمی: ۱۲ تا ۱۴) */
    const iS = cS >= 0 ? cS : 12, iP = cP >= 0 ? cP : 13, iD = cD >= 0 ? cD : 14;
    const items = R.filter(r => r[0] && (String(r[iS]).trim() || String(r[iP]).trim() || String(r[iD]).trim())).map(r => ({ ids: String(r[0]).split(',').map(a => a.trim()).filter(Boolean), st: String(r[iS]).trim(), plan: String(r[iP]).trim(), dl: HSEC.parseJ(r[iD]) }));
    if (!items.length) return alert('در فایل پاسخی برای ثبت پیدا نشد (ستون‌های وضعیت/برنامه/مهلت خالی است).');
    const done = items.filter(i => /انجام شد/.test(i.st)).length;
    if (!confirm(`${fa(items.length)} پاسخ واحد فنی ثبت شود؟\n(${fa(done)} مورد «انجام شد» که باید بازدید و تایید شوند)`)) return;
    const t0 = todayIso(); let ok = 0, bad = 0;
    for (const i0 of items) for (const fid of i0.ids) { const i = { ...i0, id: fid }; const claim = /انجام شد/.test(i.st), res = [i.st, i.plan].filter(Boolean).join(' — ') || 'پاسخ واحد فنی (از فایل اکسل)';
      try { await api('finding_followups', { method: 'POST', body: JSON.stringify({ finding_id: i.id, followed_at: t0, followed_by: mail, result: res, kind: claim ? 'claim' : 'follow', tech_deadline: i.dl || null, next_due: claim ? isoAdd(t0, 3) : HSEC.next(t0) }) }); ok++; } catch (e) { bad++; } }
    alert(`${fa(ok)} پاسخ ثبت شد${bad ? ' — ' + fa(bad) + ' مورد خطا (SQL فایل hse_finding_followups2.sql اجرا شده؟)' : ''}.`); await loadFinds();
  } catch (e) { alert(e.message); }
}
