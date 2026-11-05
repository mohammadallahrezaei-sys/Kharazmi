/* علت‌یابی ریشه‌ای حادثه (RCA) — کارشناس تا رسیدن به ریشهٔ سیستمی و ارائهٔ شواهد نمی‌تواند نتیجه را نهایی کند.
   مراحل: ۱) واقعیت‌ها و شواهد  ۲) تحلیل موانع (سلسله‌مراتب کنترل)  ۳) زنجیرهٔ «چرا» با دسته‌بندی و شاهد  ۴) اقدام اصلاحی و راستی‌آزمایی  ۵) مرور و ثبت نهایی
   استفاده: HSERCA.open(inc, ctx)  /  HSERCA.view(inc, ctx)  /  HSERCA.validate(rca, inc, today)  /  HSERCA.status(inc, today)
   ctx = { api, JH, email, today(), fdate, jdInit, jdGet, jdSet, followupTitles:[], onSaved() }
   قواعد مشابه در تریگر دیتابیس (hse_incident_rca.sql) هم اعمال می‌شود تا دور زدن از مرورگر ممکن نباشد. */
(function () {
  'use strict';

  /* ---------- طبقه‌بندی‌ها ---------- */
  const CATS = [
    ['act', 'عمل ناایمن (رفتار فرد)', 'imm'],
    ['cond', 'شرایط ناایمن (تجهیز / محیط)', 'imm'],
    ['human', 'عامل انسانی (خستگی، ارگونومی، بار کار، ارتباطات)', 'mid'],
    ['proc', 'رویه و دستورالعمل (نبود، نامناسب یا غیرعملی)', 'root'],
    ['train', 'آموزش و شایستگی', 'root'],
    ['super', 'نظارت، مدیریت میدانی و پیگیری', 'root'],
    ['maint', 'طراحی، نگهداری و تعمیرات', 'root'],
    ['risk', 'شناسایی خطر، ارزیابی ریسک و مدیریت تغییر', 'root'],
    ['org', 'سازمان، منابع، فشار تولید و فرهنگ ایمنی', 'root']
  ];
  const CAT = {}; CATS.forEach(c => CAT[c[0]] = { t: c[1], lvl: c[2] });
  const EVT = [['field', 'مشاهدهٔ میدانی از محل / تجهیز'], ['interview', 'مصاحبه (مصدوم، شاهد، سرپرست)'], ['doc', 'مدرک و سند (دستورالعمل، مجوز کار، سوابق آموزش، بازرسی / PM)'], ['media', 'عکس یا ویدئو'], ['history', 'سوابق قبلی (حوادث، عدم‌انطباق، گزارش‌ها)'], ['data', 'داده و اندازه‌گیری']];
  const EVT_T = {}; EVT.forEach(e => EVT_T[e[0]] = e[1]);
  const ACT_TYPES = [['slip', 'خطای ناخواسته (لغزش / فراموشی)'], ['mistake', 'اشتباه (قضاوت یا دانش نادرست)'], ['routine', 'تخلف رایج و عادی‌شده در واحد'], ['willful', 'تخلف عمدی']];
  const BARS = [
    ['elim', 'حذف خطر', 'آیا می‌شد کار، ماده یا شرایط خطرناک اصلاً حذف شود؟'],
    ['sub', 'جایگزینی', 'آیا ماده، روش یا تجهیز کم‌خطرتری وجود داشت؟'],
    ['eng', 'کنترل مهندسی', 'گارد، حفاظ، تهویه، اینترلاک، علائم هشداردهنده، چشم‌شور و ...'],
    ['adm', 'کنترل اداری', 'دستورالعمل، مجوز کار، آموزش، نظارت، زمان‌بندی کار'],
    ['ppe', 'وسایل حفاظت فردی', 'آیا در دسترس، مناسب و مورد استفاده بود؟']
  ];
  const BAR_S = [['worked', 'وجود داشت و عمل کرد'], ['failed', 'وجود داشت ولی شکست خورد'], ['missing', 'وجود نداشت'], ['na', 'برای این حادثه قابل اجرا نیست']];
  const LVL = { elim: 'حذف', sub: 'جایگزینی', eng: 'مهندسی', adm: 'اداری', ppe: 'حفاظت فردی' };
  const HIGH = ['elim', 'sub', 'eng'];

  /* ---------- ابزارها ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\u200f\u200e\s]+/g, '');
  const len = s => String(s == null ? '' : s).trim().length;
  const cut = (s, n) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
  /* عبارت‌هایی که «توصیف رفتار فرد» هستند، نه علت: نباید به‌عنوان ریشه پذیرفته شوند */
  const SHALLOW = /بیاحتیاط|سهلانگار|بیدقت|بیتوجه|کمتوجه|حواسپرت|غفلت|خطایانسانی|خطاینیرو|اشتباه(پرسنل|کارگر|فرد|مصدوم|همکار|اپراتور)|عدمرعایت|رعایتنکرد|نادیدهگرفت|بیمسئولیت|تقصیر|کوتاهی(فرد|پرسنل|کارگر|مصدوم)|بیانضباط|بیتجربه|ناآگاه(ی)?(فرد|پرسنل|کارگر)/;
  const words = s => new Set(String(s || '').replace(/ي/g, 'ی').split(/[\s،,.؛:!؟\-–()«»"']+/).filter(w => w.length > 1));
  const similar = (a, b) => { const A = words(a), B = words(b); if (!A.size || !B.size) return false; let i = 0; A.forEach(w => { if (B.has(w)) i++; }); return i / (A.size + B.size - i) >= 0.8; };

  const emptyStep = () => ({ cause: '', cat: '', evt: '', ev: '' });
  const emptyAction = () => ({ d: '', o: '', due: '', lvl: '', ver: '' });
  const emptyChain = (title, cat, cause) => ({ title: title || '', act_type: '', steps: [Object.assign(emptyStep(), { cat: cat || '', cause: cause || '' }), emptyStep(), emptyStep(), emptyStep()], tests: { remove: false, system: false, history: false, note: '' }, actions: [emptyAction()], no_high_reason: '' });
  function blank(inc) {
    const chains = [];
    if (inc && inc.unsafe_act) chains.push(emptyChain('عمل ناامن ثبت‌شده', 'act', inc.unsafe_act));
    if (inc && inc.unsafe_condition) chains.push(emptyChain('شرایط ناامن ثبت‌شده', 'cond', inc.unsafe_condition));
    if (!chains.length) chains.push(emptyChain('', '', ''));
    const bars = {}; BARS.forEach(b => bars[b[0]] = { s: '', n: '' });
    return { v: 1, facts: { task: '', containment: '', site_visit: false, interviews: false, timeline: [{ t: '', e: '' }, { t: '', e: '' }, { t: '', e: '' }], evidence: [{ type: '', d: '' }, { type: '', d: '' }, { type: '', d: '' }] }, barriers: bars, chains, attest: false, returns: [] };
  }

  /* ---------- اعتبارسنجی: هر مورد = یک مانع برای ثبت نهایی ---------- */
  function validate(r, inc, today) {
    const E = [], add = (s, m) => E.push({ s, m });
    r = r || blank(inc); const f = r.facts || {};
    if (len(f.task) < 10) add(1, 'شرح فعالیتی که مصدوم هنگام حادثه انجام می‌داد را بنویسید.');
    if (len(f.containment) < 10) add(1, 'اقدام فوری برای مهار خطر و ایمن‌سازی محل را بنویسید.');
    if (!f.site_visit) add(1, 'بازدید حضوری از محل حادثه باید انجام و تأیید شود.');
    if (!f.interviews) add(1, 'مصاحبه با مصدوم، شاهد یا سرپرست باید انجام و تأیید شود.');
    if ((f.timeline || []).filter(x => len(x.e) >= 5).length < 3) add(1, 'حداقل ۳ رویداد در خط زمانی ثبت کنید (قبل، حین و بعد از حادثه).');
    const ev = (f.evidence || []).filter(x => x.type && len(x.d) >= 10);
    if (ev.length < 3) add(1, 'حداقل ۳ شاهد/مدرک (با نوع و توضیح حداقل ۱۰ حرفی) ثبت کنید.');
    if (!ev.some(x => x.type !== 'interview')) add(1, 'حداقل یکی از شواهد باید غیر از مصاحبه باشد (مشاهده، مدرک، عکس، سابقه یا داده).');

    const B = r.barriers || {};
    BARS.forEach(b => {
      const x = B[b[0]] || {};
      if (!x.s) add(2, 'مانع «' + b[1] + '» را ارزیابی کنید.');
      else if (len(x.n) < 10) add(2, 'برای «' + b[1] + '» توضیح بنویسید (حداقل ۱۰ حرف؛ حتی اگر «قابل اجرا نیست»).');
    });
    if (BARS.every(b => (B[b[0]] || {}).s) && !BARS.some(b => ['failed', 'missing'].includes((B[b[0]] || {}).s))) add(2, 'حادثه رخ داده است، پس حداقل یک مانع باید شکست خورده یا وجود نداشته باشد؛ ارزیابی را بازبینی کنید.');

    const chains = r.chains || [];
    const need = Math.max(1, (inc && inc.unsafe_act ? 1 : 0) + (inc && inc.unsafe_condition ? 1 : 0));
    if (chains.length < need) add(3, 'برای هر عمل/شرایط ناامنِ ثبت‌شدهٔ حادثه یک زنجیرهٔ جدا لازم است (حداقل ' + need + ' زنجیره).');
    chains.forEach((c, ci) => {
      const P = 'زنجیره ' + (ci + 1) + ': ', S = c.steps || [];
      if (S.length < 4) add(3, P + 'حداقل ۴ مرحلهٔ «چرا» لازم است؛ هنوز به ریشه نرسیده‌اید.');
      S.forEach((s, si) => {
        const q = P + 'چرای ' + (si + 1) + ' — ';
        if (!s.cat) add(3, q + 'دستهٔ علت را انتخاب کنید.');
        if (len(s.cause) < 15) add(3, q + 'علت را کامل بنویسید (حداقل ۱۵ حرف).');
        if (!s.evt) add(3, q + 'نوع شاهد را انتخاب کنید.');
        if (len(s.ev) < 10) add(3, q + 'شاهدی که این علت را اثبات می‌کند بنویسید (حداقل ۱۰ حرف)؛ حدس پذیرفته نمی‌شود.');
        if (si > 0 && similar(S[si - 1].cause, s.cause)) add(3, q + 'این علت با مرحلهٔ قبل تکراری است؛ عمیق‌تر بپرسید.');
      });
      if (S.length) {
        const first = S[0], last = S[S.length - 1];
        if (first.cat && CAT[first.cat] && CAT[first.cat].lvl !== 'imm') add(3, P + 'چرای ۱ باید علت بلافصل باشد (عمل ناایمن یا شرایط ناایمن).');
        if (last.cat && CAT[last.cat] && CAT[last.cat].lvl !== 'root') add(3, P + 'آخرین «چرا» هنوز ریشهٔ سیستمی نیست؛ ادامه دهید تا به نقص در رویه، آموزش، نظارت، نگهداری، ارزیابی ریسک یا تصمیم سازمانی برسید.');
        if (last.cat && CAT[last.cat] && CAT[last.cat].lvl === 'root') {
          if (SHALLOW.test(norm(last.cause))) add(3, P + 'ریشه، توصیف رفتار فرد است (مثل بی‌احتیاطی/سهل‌انگاری/عدم رعایت)، نه علت. بپرسید: چرا سیستم اجازه داد یا جلوگیری نکرد؟');
          if (last.evt === 'interview') add(3, P + 'ریشه باید حداقل یک شاهد غیر از مصاحبه داشته باشد (مدرک، مشاهده، سابقه، عکس).');
          if (similar(first.cause, last.cause)) add(3, P + 'ریشه با علت بلافصل یکی است.');
        }
        S.forEach((s, si) => { if (si < S.length - 1 && SHALLOW.test(norm(s.cause)) && CAT[s.cat] && CAT[s.cat].lvl === 'root') add(3, P + 'چرای ' + (si + 1) + ': عبارت توصیف رفتار است؛ علت سیستمی را بنویسید.'); });
        if (S.some(s => s.cat === 'act')) {
          if (!c.act_type) add(3, P + 'نوع عمل ناایمن را مشخص کنید (خطای ناخواسته، اشتباه، تخلف رایج یا عمدی).');
          if ((c.act_type === 'routine' || c.act_type === 'willful') && !S.some(s => s.cat === 'super' || s.cat === 'org')) add(3, P + 'اگر عمل «تخلف» بوده، باید مشخص شود چرا نظارت یا فرهنگ سازمان آن را تحمل کرده (یک «چرا» از دستهٔ نظارت یا سازمان اضافه کنید).');
        }
      }
      const T = c.tests || {};
      if (!T.remove) add(3, P + 'آزمون حذف باید تأیید شود: اگر ریشه رفع می‌شد، همین حادثه رخ نمی‌داد؟');
      if (!T.system) add(3, P + 'تأیید کنید ریشه در کنترل شرکت است و ادامهٔ «چرا» به نقص دیگری در سیستم مدیریتی نمی‌رسد.');
      if (!T.history) add(3, P + 'تأیید کنید سوابق حوادث/عدم‌انطباق مشابه (همین واحد و سایر واحدها) بررسی شده است.');
      if (T.history && len(T.note) < 10) add(3, P + 'نتیجهٔ بررسی سوابق مشابه را بنویسید (حتی اگر «موردی یافت نشد»).');

      const A = c.actions || [];
      if (!A.length) add(4, P + 'حداقل یک اقدام اصلاحی برای این ریشه لازم است.');
      A.forEach((a, ai) => {
        const q = P + 'اقدام ' + (ai + 1) + ' — ';
        if (len(a.d) < 15) add(4, q + 'شرح اقدام را کامل بنویسید (حداقل ۱۵ حرف).');
        if (len(a.o) < 2) add(4, q + 'مسئول انجام را بنویسید.');
        if (!a.due) add(4, q + 'سررسید را مشخص کنید.');
        else if (today && a.due < today) add(4, q + 'سررسید نباید گذشته باشد.');
        if (!a.lvl) add(4, q + 'سطح کنترل را انتخاب کنید.');
        if (len(a.ver) < 10) add(4, q + 'روش راستی‌آزمایی اثربخشی را بنویسید (چه چیزی، چه زمانی، چگونه بررسی می‌شود).');
      });
      if (A.length && !A.some(a => HIGH.includes(a.lvl)) && A.every(a => a.lvl) && len(c.no_high_reason) < 20) add(4, P + 'همهٔ اقدامات اداری/حفاظت فردی هستند؛ یک اقدام حذف/جایگزینی/مهندسی اضافه کنید یا دلیل غیرممکن بودن آن را بنویسید.');
    });
    if (!r.attest) add(5, 'تأییدیهٔ پایانی را علامت بزنید.');
    return E;
  }
  /* خلاصهٔ وضعیت برای کارت حادثه */
  function status(inc, today) {
    const r = inc.rca; const st = inc.rca_status || (inc.expert_opinion ? 'legacy' : '');
    const errs = st === 'final' || st === 'legacy' ? [] : validate(r, inc, today).filter(e => e.s !== 5);
    return { st, left: errs.length };
  }

  function summary(r) {
    const L = ['✅ علت‌یابی ریشه‌ای (RCA) انجام و نهایی شد.'];
    (r.chains || []).forEach((c, i) => {
      const S = c.steps || [], first = S[0] || {}, last = S[S.length - 1] || {};
      L.push('', 'زنجیره ' + (i + 1) + (c.title ? ' – ' + c.title : '') + ':');
      L.push('• علت بلافصل: ' + first.cause);
      L.push('• ریشه (' + ((CAT[last.cat] || {}).t || '') + '): ' + last.cause);
      L.push('• اقدامات: ' + (c.actions || []).map(a => a.d + ' [' + (LVL[a.lvl] || '') + '، مسئول: ' + a.o + ']').join(' ؛ '));
    });
    return L.join('\n');
  }

  /* ---------- گزارش فقط‌خواندنی ---------- */
  function reportHTML(r, ctx) {
    const f = r.facts || {}, fd = ctx.fdate || (x => x);
    const sec = (t, b) => `<div class="rca-c"><b>${t}</b><div style="margin-top:6px;font-size:12px;line-height:1.9">${b}</div></div>`;
    let h = sec('۱) واقعیت‌ها', `<p><b>فعالیت:</b> ${esc(f.task)}</p><p><b>اقدام فوری:</b> ${esc(f.containment)}</p>` +
      '<p><b>خط زمانی:</b></p><ol style="margin:0 18px">' + (f.timeline || []).filter(x => len(x.e)).map(x => `<li>${esc(x.t)} ${x.t ? '—' : ''} ${esc(x.e)}</li>`).join('') + '</ol>' +
      '<p><b>شواهد:</b></p><ul style="margin:0 18px">' + (f.evidence || []).filter(x => len(x.d)).map(x => `<li>[${esc(EVT_T[x.type] || '')}] ${esc(x.d)}</li>`).join('') + '</ul>');
    h += sec('۲) تحلیل موانع', BARS.map(b => { const x = (r.barriers || {})[b[0]] || {}; return `<p><b>${b[1]}:</b> ${esc((BAR_S.find(s => s[0] === x.s) || [])[1] || '-')} — ${esc(x.n)}</p>`; }).join(''));
    (r.chains || []).forEach((c, ci) => {
      const S = c.steps || [];
      h += sec('۳) زنجیرهٔ علت ' + (ci + 1) + (c.title ? ' – ' + esc(c.title) : ''), S.map((s, i) => `<p>${i === S.length - 1 ? '🎯' : '⬇'} <b>چرا ${i + 1}</b> [${esc((CAT[s.cat] || {}).t || '')}]: ${esc(s.cause)}<br><span style="color:var(--mu)">شاهد (${esc(EVT_T[s.evt] || '')}): ${esc(s.ev)}</span></p>`).join('') +
        (c.act_type ? `<p><b>نوع عمل ناایمن:</b> ${esc((ACT_TYPES.find(a => a[0] === c.act_type) || [])[1])}</p>` : '') + `<p><b>بررسی سوابق مشابه:</b> ${esc(c.tests && c.tests.note)}</p>` +
        '<p><b>اقدامات:</b></p><ul style="margin:0 18px">' + (c.actions || []).map(a => `<li>${esc(a.d)} — مسئول: ${esc(a.o)} — سررسید: ${esc(a.due)} — سطح: ${esc(LVL[a.lvl] || '')}<br><span style="color:var(--mu)">راستی‌آزمایی: ${esc(a.ver)}</span></li>`).join('') + '</ul>' + (len(c.no_high_reason) ? `<p><b>دلیل نبود کنترل سطح بالاتر:</b> ${esc(c.no_high_reason)}</p>` : ''));
    });
    if ((r.returns || []).length) h += sec('سابقهٔ بازگشت از مدیر', r.returns.map(x => `<p>${esc(fd(x.at))}: ${esc(x.reason)}</p>`).join(''));
    return h;
  }

  /* ---------- استایل ---------- */
  function css() {
    if (document.getElementById('rca-css')) return;
    const s = document.createElement('style'); s.id = 'rca-css';
    s.textContent = `.rca-ov{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);overflow:auto;padding:8px}
.rca-box{background:var(--card);color:var(--tx);border:1px solid var(--bd);border-radius:16px;max-width:780px;margin:0 auto;min-height:calc(100vh - 16px);display:flex;flex-direction:column;direction:rtl;font-size:13px}
.rca-hd{position:sticky;top:0;z-index:3;background:var(--card);border-bottom:1px solid var(--bd);padding:10px 14px;border-radius:16px 16px 0 0}
.rca-nav{display:flex;gap:6px;overflow-x:auto;padding-top:8px}
.rca-tab{flex:1 0 auto;font:inherit;font-size:11px;padding:6px 10px;border-radius:10px;border:1px solid var(--bd);background:var(--soft);color:var(--tx);cursor:pointer;white-space:nowrap}
.rca-tab.on{background:var(--ac);color:var(--acx);border-color:var(--ac);font-weight:700}
.rca-bd{padding:12px 14px;flex:1}
.rca-ft{position:sticky;bottom:0;z-index:3;background:var(--card);border-top:1px solid var(--bd);padding:10px 14px;display:flex;gap:8px;flex-wrap:wrap;border-radius:0 0 16px 16px}
.rca-c{border:1px solid var(--bd);background:var(--soft);border-radius:12px;padding:10px;margin-bottom:10px}
.rca-l{display:block;font-size:12px;margin:8px 0 3px;color:var(--mu)}
.rca-in{width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:7px 10px;color:var(--tx);font:inherit;font-size:13px;outline:none}
.rca-in:focus{border-color:var(--ac)}
.rca-b{font:inherit;font-size:12px;padding:8px 14px;border-radius:10px;border:1px solid var(--bd);background:var(--soft);color:var(--tx);cursor:pointer}
.rca-b.p{background:var(--ac);color:var(--acx);border-color:var(--ac);font-weight:700}
.rca-b.d{color:var(--bad);border-color:var(--bad);padding:4px 10px}
.rca-b:disabled{opacity:.45;cursor:not-allowed}
.rca-tip{background:var(--infobg,var(--soft));border:1px solid var(--in);border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.8;margin-bottom:10px}
.rca-warn{background:var(--warnbg,var(--soft));border:1px solid var(--wa);border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.8;margin-bottom:10px}
.rca-err{background:var(--badbg,var(--soft));border:1px solid var(--bad);border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.9;margin-bottom:10px}
.rca-err li{cursor:pointer}
.rca-ok{background:var(--okbg,var(--soft));border:1px solid var(--ok);border-radius:10px;padding:8px 10px;font-size:12px;margin-bottom:10px}
.rca-row{display:flex;gap:6px;align-items:flex-start;margin-bottom:6px}
.rca-row>.rca-in:first-child{flex:0 0 28%}
.rca-chk{display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:1.8;margin:6px 0}
.rca-chk input{margin-top:5px}
.rca-why{border-right:3px solid var(--ac);padding-right:10px;margin-bottom:12px}
.rca-why.root{border-right-color:var(--ok)}`;
    document.head.appendChild(s);
  }

  /* ---------- ویرایشگر ---------- */
  function openEditor(inc, ctx, readOnly) {
    css();
    const today = ctx.today ? ctx.today() : new Date().toISOString().slice(0, 10);
    let R = inc.rca && typeof inc.rca === 'object' ? JSON.parse(JSON.stringify(inc.rca)) : blank(inc);
    const BK = 'rca_bk_' + inc.id;
    try {
      const bk = JSON.parse(localStorage.getItem(BK) || 'null');
      if (!readOnly && bk && bk.rca && (!inc.rca_at || bk.t > Date.parse(inc.rca_at)) && confirm('نسخهٔ ذخیره‌نشدهٔ جدیدتری از این علت‌یابی روی همین دستگاه هست. بازیابی شود؟')) R = bk.rca;
    } catch (_) { }
    let step = readOnly ? 5 : 1, dirty = false, saving = false, bkT = 0;
    const o = document.createElement('div'); o.className = 'rca-ov';
    document.body.appendChild(o);
    const ro = !!readOnly;

    const getP = (p) => p.split('.').reduce((a, k) => a == null ? a : a[k], R);
    const setP = (p, v) => { const ks = p.split('.'), last = ks.pop(); const t = ks.reduce((a, k) => a[k], R); t[last] = v; };
    const errs = () => validate(R, inc, today);
    const dis = ro ? ' disabled' : '';

    const inp = (p, ph, extra) => `<input class="rca-in" data-p="${p}" value="${esc(getP(p))}" placeholder="${esc(ph || '')}"${dis} ${extra || ''}>`;
    const ta = (p, ph, rows) => `<textarea class="rca-in" rows="${rows || 2}" data-p="${p}" placeholder="${esc(ph || '')}"${dis}>${esc(getP(p))}</textarea>`;
    const sel = (p, opts, ph) => `<select class="rca-in" data-p="${p}"${dis}><option value="">${esc(ph || '— انتخاب کنید —')}</option>${opts.map(x => `<option value="${x[0]}" ${getP(p) === x[0] ? 'selected' : ''}>${esc(x[1])}</option>`).join('')}</select>`;
    const chk = (p, label) => `<label class="rca-chk"><input type="checkbox" data-p="${p}" ${getP(p) ? 'checked' : ''}${dis}><span>${label}</span></label>`;
    const lab = t => `<label class="rca-l">${t}</label>`;

    function s1() {
      let h = `<div class="rca-tip">اول واقعیت‌ها را جمع کنید، بعد تحلیل. تحلیل بدون شاهد پذیرفته نمی‌شود.<br><b>شرح اولیهٔ ثبت‌شده:</b> ${esc(inc.description)}</div>`;
      h += lab('فعالیتی که مصدوم هنگام حادثه انجام می‌داد (چه کاری، با چه تجهیز/ماده‌ای، طبق کدام دستورالعمل؟)') + ta('facts.task', '', 2);
      h += lab('اقدام فوری برای مهار خطر و ایمن‌سازی محل (چه شد که حادثه تکرار نشود تا تحلیل کامل شود؟)') + ta('facts.containment', '', 2);
      h += chk('facts.site_visit', 'شخصاً از محل حادثه بازدید کردم.') + chk('facts.interviews', 'با مصدوم، شاهدان و سرپرست مصاحبه کردم (یا در صورت عدم‌امکان، دلیلش را در شواهد ثبت کردم).');
      h += lab('خط زمانی وقایع (حداقل ۳ مورد: قبل از حادثه، لحظهٔ حادثه، بعد از آن)');
      h += (R.facts.timeline || []).map((x, i) => `<div class="rca-row">${inp('facts.timeline.' + i + '.t', 'زمان / ترتیب')}${inp('facts.timeline.' + i + '.e', 'چه اتفاقی افتاد؟')}${ro ? '' : `<button class="rca-b d" data-del="facts.timeline:${i}">✕</button>`}</div>`).join('');
      if (!ro) h += '<button class="rca-b" data-add="facts.timeline">+ رویداد</button>';
      h += lab('شواهد جمع‌آوری‌شده (حداقل ۳ مورد و حداقل یکی غیر از مصاحبه)');
      h += (R.facts.evidence || []).map((x, i) => `<div class="rca-row"><div style="flex:0 0 38%">${sel('facts.evidence.' + i + '.type', EVT, 'نوع شاهد')}</div>${inp('facts.evidence.' + i + '.d', 'چه چیزی دیده/خوانده/اندازه‌گیری شد؟')}${ro ? '' : `<button class="rca-b d" data-del="facts.evidence:${i}">✕</button>`}</div>`).join('');
      if (!ro) h += '<button class="rca-b" data-add="facts.evidence">+ شاهد</button>';
      return h;
    }
    function s2() {
      let h = '<div class="rca-tip">برای هر لایهٔ حفاظتی بررسی کنید چه بود و چه شد. «قابل اجرا نیست» هم باید دلیل داشته باشد. حداقل یک لایه باید شکست خورده یا نبوده باشد.</div>';
      BARS.forEach(b => { h += `<div class="rca-c"><b>${b[1]}</b><div style="font-size:11px;color:var(--mu)">${b[2]}</div>${sel('barriers.' + b[0] + '.s', BAR_S)}${lab('توضیح و شاهد')}${ta('barriers.' + b[0] + '.n', '', 2)}</div>`; });
      return h;
    }
    function s3() {
      let h = '<div class="rca-tip">هر «چرا» باید با شاهد اثبات شود و یک پله عمیق‌تر برود. <b>ریشه</b> یعنی نقصی در رویه، آموزش، نظارت، نگهداری، ارزیابی ریسک یا تصمیم سازمانی که مدیریت می‌تواند اصلاح کند — نه «بی‌احتیاطی» یا «خطای انسانی». تا آخرین «چرا» به چنین علتی نرسد، ثبت نهایی ممکن نیست.</div>';
      R.chains.forEach((c, ci) => {
        h += `<div class="rca-c"><div style="display:flex;gap:6px;align-items:center"><b style="white-space:nowrap">زنجیره ${ci + 1}</b>${inp('chains.' + ci + '.title', 'عنوان (مثلاً: عدم استفاده از دستکش)')}${!ro && R.chains.length > 1 ? `<button class="rca-b d" data-del="chains:${ci}">حذف</button>` : ''}</div>`;
        c.steps.forEach((s, si) => {
          const p = 'chains.' + ci + '.steps.' + si, last = si === c.steps.length - 1, rootOk = CAT[s.cat] && CAT[s.cat].lvl === 'root';
          const q = si === 0 ? 'چرا آسیب رخ داد؟ (علت بلافصل: عمل یا شرایط ناایمنی که مستقیماً به آسیب رسید)' : 'چرا «' + cut(c.steps[si - 1].cause || '…', 60) + '» رخ داد؟';
          h += `<div class="rca-why ${last && rootOk ? 'root' : ''}"><div style="font-size:12px"><b>چرا ${si + 1}</b> — ${esc(q)}</div>${ta(p + '.cause', 'علت را بنویسید', 2)}<div class="rca-row" style="margin-top:6px"><div style="flex:1">${sel(p + '.cat', CATS, 'دستهٔ علت')}</div><div style="flex:1">${sel(p + '.evt', EVT, 'نوع شاهد')}</div></div>${inp(p + '.ev', 'شاهد: کدام مدرک/مشاهده/سابقه این علت را ثابت می‌کند؟')}${!ro && c.steps.length > 1 ? `<button class="rca-b d" style="margin-top:6px" data-del="chains.${ci}.steps:${si}">حذف این مرحله</button>` : ''}</div>`;
        });
        if (!ro && c.steps.length < 8) h += `<button class="rca-b" data-add="chains.${ci}.steps">+ چرای بعدی</button>`;
        if (c.steps.some(s => s.cat === 'act')) h += lab('نوع عمل ناایمن') + sel('chains.' + ci + '.act_type', ACT_TYPES);
        const chain = c.steps.filter(s => len(s.cause)).map(s => cut(s.cause, 40));
        if (chain.length > 1) h += `<div class="rca-tip" style="margin-top:10px"><b>خوانش زنجیره (از ریشه به حادثه):</b><br>${chain.slice().reverse().map(esc).join('<br>⬇ باعث شد: ')}</div>`;
        h += '<div style="margin-top:8px"><b style="font-size:12px">آزمون‌های اعتبار ریشه</b></div>' +
          chk('chains.' + ci + '.tests.remove', 'آزمون حذف: اگر این ریشه از قبل رفع شده بود، همین حادثه رخ نمی‌داد.') +
          chk('chains.' + ci + '.tests.system', 'آخرین علت در کنترل شرکت است و پرسیدن «چرا»ی بعدی به نقص دیگری در سیستم مدیریتی نمی‌رسد.') +
          chk('chains.' + ci + '.tests.history', 'سوابق حوادث و عدم‌انطباق مشابه (همین واحد و سایر واحدها) را بررسی کردم.') +
          lab('نتیجهٔ بررسی سوابق مشابه') + inp('chains.' + ci + '.tests.note', 'مثلاً: ۲ مورد مشابه در انبار ۱۴۰۴ یافت شد / موردی یافت نشد') + '</div>';
      });
      if (!ro && R.chains.length < 3) h += '<button class="rca-b" data-add="chains">+ زنجیرهٔ علت دیگر (برای علت مستقل دیگر)</button>';
      return h;
    }
    function s4() {
      let h = '<div class="rca-tip">برای هر ریشه اقدامی بنویسید که خودِ ریشه را برطرف کند، نه فقط تذکر به فرد. اقدامات حذف/جایگزینی/مهندسی از آموزش و تذکر مؤثرترند.</div>';
      R.chains.forEach((c, ci) => {
        const last = c.steps[c.steps.length - 1] || {};
        h += `<div class="rca-c"><b>ریشهٔ زنجیره ${ci + 1}:</b> ${esc(last.cause || '—')}`;
        c.actions.forEach((a, ai) => {
          const p = 'chains.' + ci + '.actions.' + ai;
          h += `<div class="rca-c" style="background:var(--card);margin-top:8px"><b style="font-size:12px">اقدام ${ai + 1}</b>${ta(p + '.d', 'شرح اقدام اصلاحی', 2)}<div class="rca-row" style="margin-top:6px"><div style="flex:1">${inp(p + '.o', 'مسئول انجام')}</div><div style="flex:1">${sel(p + '.lvl', Object.entries(LVL), 'سطح کنترل')}</div></div>${lab('سررسید')}<div id="rca_due_${ci}_${ai}" class="jd" data-back="0" data-jdp="${p}.due" style="display:flex;gap:4px"><select class="rca-in"${dis}></select><select class="rca-in"${dis}></select><select class="rca-in"${dis}></select></div>${lab('راستی‌آزمایی اثربخشی (چه چیزی، چه زمانی، چگونه بررسی شود؟)')}${inp(p + '.ver', 'مثلاً: بازدید ۳۰ روز بعد + نبود حادثهٔ مشابه تا ۶ ماه')}${!ro && c.actions.length > 1 ? `<button class="rca-b d" style="margin-top:6px" data-del="chains.${ci}.actions:${ai}">حذف اقدام</button>` : ''}</div>`;
        });
        if (!ro) h += `<button class="rca-b" data-add="chains.${ci}.actions">+ اقدام</button>`;
        if (c.actions.length && !c.actions.some(a => HIGH.includes(a.lvl)) && c.actions.every(a => a.lvl)) h += `<div class="rca-warn" style="margin-top:8px">همهٔ اقدامات اداری/حفاظت فردی است. اقدام حذف/جایگزینی/مهندسی اضافه کنید یا دلیل غیرممکن بودن را بنویسید:${ta('chains.' + ci + '.no_high_reason', 'چرا کنترل سطح بالاتر ممکن نیست؟', 2)}</div>`;
        h += '</div>';
      });
      return h;
    }
    function s5() {
      const E = errs().filter(e => e.s !== 5);
      let h = '';
      if (E.length) h += `<div class="rca-err"><b>هنوز ${E.length} مورد مانده است؛ تا رفع نشود نتیجه نهایی نمی‌شود:</b><ul style="margin:6px 18px 0">${E.map(e => `<li data-go="${e.s}">[مرحله ${e.s}] ${esc(e.m)}</li>`).join('')}</ul></div>`;
      else h += '<div class="rca-ok">✅ همهٔ شرایط رسیدن به ریشه برقرار است. گزارش را مرور و نهایی کنید.</div>';
      h += reportHTML(R, ctx);
      if (!ro) h += chk('attest', 'اعلام می‌کنم هر ریشه با شاهد تأیید شده و علل اشاره‌شده در کنترل سازمان است. پس از ثبت نهایی، تغییر فقط با بازگشت از مدیر ممکن است.');
      return h;
    }

    const TITLES = ['۱) واقعیت‌ها', '۲) موانع', '۳) چرا‌ها و ریشه', '۴) اقدام اصلاحی', '۵) مرور و ثبت'];
    function chrome() {
      const E = errs(), by = {}; E.forEach(e => by[e.s] = (by[e.s] || 0) + 1);
      const left = E.filter(e => e.s !== 5).length;
      return `<div class="rca-hd"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>🔎 علت‌یابی ریشه‌ای حادثه — ${esc(ctx.who || '')}</b><button class="rca-b" data-close="1">بستن</button></div>
      <div style="font-size:11px;color:${left ? 'var(--wa)' : 'var(--ok)'};margin-top:4px" id="rca_left">${ro ? 'نمایش فقط‌خواندنی' : (left ? '⏳ ' + left + ' مورد تا امکان ثبت نهایی باقی مانده' : '✅ آمادهٔ ثبت نهایی')}</div>
      <div class="rca-nav">${TITLES.map((t, i) => `<button class="rca-tab ${step === i + 1 ? 'on' : ''}" data-step="${i + 1}">${t}${i < 4 ? (by[i + 1] ? ' <span style="color:var(--bad)">(' + by[i + 1] + ')</span>' : ' ✓') : ''}</button>`).join('')}</div></div>`;
    }
    function render() {
      const sc = o.querySelector('.rca-box') ? o.scrollTop : 0;
      const ret = (R.returns || []).length ? R.returns[R.returns.length - 1] : null;
      const body = [s1, s2, s3, s4, s5][step - 1]();
      const E = errs(), canFinal = !E.length && !saving;
      o.innerHTML = `<div class="rca-box">${chrome()}<div class="rca-bd">${ret && !ro && inc.rca_status !== 'final' ? `<div class="rca-warn"><b>برگشت از مدیر:</b> ${esc(ret.reason)}</div>` : ''}${body}</div>
      <div class="rca-ft">${ro ? '<button class="rca-b" data-close="1">بستن</button>' : `<button class="rca-b" data-save="1">💾 ذخیره پیش‌نویس</button>${step > 1 ? '<button class="rca-b" data-prev="1">‹ قبلی</button>' : ''}${step < 5 ? '<button class="rca-b p" data-next="1">بعدی ›</button>' : `<button class="rca-b p" data-final="1" ${canFinal ? '' : 'disabled'}>🔒 ثبت نهایی علت‌یابی</button>`}`}</div></div>`;
      o.querySelectorAll('.jd[data-jdp]').forEach(el => { ctx.jdInit(el); const v = getP(el.dataset.jdp); if (v) { try { ctx.jdSet(el.id, v); } catch (_) { } } });
      o.scrollTop = sc;
    }
    function refreshHead() {
      const E = errs(), left = E.filter(e => e.s !== 5).length, by = {}; E.forEach(e => by[e.s] = (by[e.s] || 0) + 1);
      const l = o.querySelector('#rca_left'); if (l && !ro) { l.textContent = left ? '⏳ ' + left + ' مورد تا امکان ثبت نهایی باقی مانده' : '✅ آمادهٔ ثبت نهایی'; l.style.color = left ? 'var(--wa)' : 'var(--ok)'; }
      o.querySelectorAll('.rca-tab').forEach((b, i) => { if (i < 4) b.innerHTML = TITLES[i] + (by[i + 1] ? ' <span style="color:var(--bad)">(' + by[i + 1] + ')</span>' : ' ✓'); });
    }
    function backup() { dirty = true; clearTimeout(bkT); bkT = setTimeout(() => { try { localStorage.setItem(BK, JSON.stringify({ t: Date.now(), rca: R })); } catch (_) { } }, 600); }
    const close = () => { if (dirty && !ro && !confirm('تغییرات ذخیره‌نشده از بین می‌رود. بسته شود؟')) return; o.remove(); };

    async function saveDraft(silent) {
      const body = { rca: R, rca_status: 'draft', rca_by: ctx.email || null, rca_at: new Date().toISOString() };
      await ctx.api('clinic_incidents?id=eq.' + encodeURIComponent(inc.id), { method: 'PATCH', headers: Object.assign({}, ctx.JH, { Prefer: 'return=minimal' }), body: JSON.stringify(body) });
      dirty = false; try { localStorage.removeItem(BK); } catch (_) { }
      inc.rca = JSON.parse(JSON.stringify(R)); inc.rca_status = 'draft'; inc.rca_at = body.rca_at;
      if (!silent) alert('پیش‌نویس ذخیره شد.');
    }
    async function finalize() {
      const E = errs(); if (E.length) { step = 5; render(); return; }
      if (!confirm('علت‌یابی نهایی شود؟ پس از ثبت، فقط مدیر می‌تواند آن را برای اصلاح به شما برگرداند.')) return;
      saving = true; render();
      const now = new Date().toISOString(), S = (R.chains || []);
      const acts = []; S.forEach(c => (c.actions || []).forEach(a => acts.push(Object.assign({ root: (c.steps[c.steps.length - 1] || {}).cause }, a))));
      const body = { rca: R, rca_status: 'final', rca_by: ctx.email || null, rca_at: now, rca_final_at: now, expert_opinion: summary(R), expert_opinion_by: ctx.email || null, expert_opinion_at: now };
      if (!inc.corrective_action && acts.length) {
        body.corrective_action = acts[0].d + (acts.length > 1 ? ' (+' + (acts.length - 1) + ' اقدام دیگر در گزارش علت‌یابی)' : '');
        body.action_owner = acts[0].o; body.action_due_date = acts.map(a => a.due).sort()[0]; body.action_status = 'pending';
      }
      try {
        await ctx.api('clinic_incidents?id=eq.' + encodeURIComponent(inc.id), { method: 'PATCH', headers: Object.assign({}, ctx.JH, { Prefer: 'return=minimal' }), body: JSON.stringify(body) });
      } catch (er) { saving = false; render(); alert('ثبت نهایی انجام نشد: ' + er.message + (/rca|RCA/.test(er.message) ? '\nاگر پیام دربارهٔ ستون rca است، فایل hse_incident_rca.sql را در Supabase اجرا کنید.' : '')); return; }
      let fu = 0;
      for (const a of acts) {
        const title = 'اقدام اصلاحی حادثه: ' + a.d;
        if ((ctx.followupTitles || []).includes(title)) continue;
        try { await ctx.api('clinic_followups', { method: 'POST', headers: Object.assign({}, ctx.JH, { Prefer: 'return=minimal' }), body: JSON.stringify({ employee_id: inc.employee_id, visit_id: null, kind: 'incident_capa', priority: 'urgent', title, destination: 'مسئول: ' + a.o, reason: 'ریشهٔ حادثه: ' + cut(a.root, 120), due_date: a.due }) }); fu++; } catch (_) { }
      }
      dirty = false; try { localStorage.removeItem(BK); } catch (_) { }
      o.remove(); alert('علت‌یابی ریشه‌ای نهایی شد.' + (fu ? '\n' + fu + ' پیگیری اقدام اصلاحی ساخته شد.' : '')); if (ctx.onSaved) ctx.onSaved();
    }

    o.addEventListener('input', e => { const p = e.target.dataset && e.target.dataset.p; if (!p || ro) return; setP(p, e.target.type === 'checkbox' ? e.target.checked : e.target.value); backup(); refreshHead(); });
    o.addEventListener('change', e => {
      const t = e.target; if (ro) return;
      const jd = t.closest && t.closest('.jd[data-jdp]');
      if (jd) { setP(jd.dataset.jdp, ctx.jdGet(jd.id) || ''); backup(); refreshHead(); return; }
      const p = t.dataset && t.dataset.p; if (!p) return;
      setP(p, t.type === 'checkbox' ? t.checked : t.value); backup();
      if (/\.(cat|lvl|evt)$/.test(p) || p === 'attest') render(); else refreshHead();
    });
    o.addEventListener('click', async e => {
      const b = e.target.closest('[data-step],[data-next],[data-prev],[data-save],[data-final],[data-close],[data-add],[data-del],[data-go]'); if (!b) return;
      const d = b.dataset;
      if (d.close !== undefined) return close();
      if (d.step) { step = +d.step; render(); return; }
      if (d.go) { step = +d.go; render(); return; }
      if (d.next !== undefined) { step = Math.min(5, step + 1); render(); o.scrollTop = 0; return; }
      if (d.prev !== undefined) { step = Math.max(1, step - 1); render(); o.scrollTop = 0; return; }
      if (ro) return;
      if (d.save !== undefined) { try { await saveDraft(); render(); } catch (er) { alert('ذخیره نشد: ' + er.message + (/rca/.test(er.message) ? '\nفایل hse_incident_rca.sql را در Supabase اجرا کنید.' : '')); } return; }
      if (d.final !== undefined) return finalize();
      if (d.add) {
        const arr = getP(d.add);
        arr.push(d.add === 'facts.timeline' ? { t: '', e: '' } : d.add === 'facts.evidence' ? { type: '', d: '' } : d.add === 'chains' ? emptyChain() : /steps$/.test(d.add) ? emptyStep() : emptyAction());
        backup(); render(); return;
      }
      if (d.del) { const [p, i] = d.del.split(':'); getP(p).splice(+i, 1); backup(); render(); return; }
    });
    render();
  }

  window.HSERCA = {
    open: (inc, ctx) => openEditor(inc, ctx, false),
    view: (inc, ctx) => openEditor(inc, ctx, true),
    validate, status, blank, summary, CAT, SHALLOW_TEST: t => SHALLOW.test(norm(t))
  };
})();
