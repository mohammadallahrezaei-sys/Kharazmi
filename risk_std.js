/* مرجع واحد استانداردهای ارزیابی ریسک (دستورالعمل شرکت بند ۵-۳ + کاربرگ ارزیابی نیمه‌کمی شیمیایی + قواعد پیشنهادی)
   مصرف‌کنندگان: risks.html (فرم و کنترل‌ها)، risk_procedure.html (متن دستورالعمل که از همین جدول‌ها ساخته می‌شود)
   هر مقدار منبع دارد: SRC.co = دستورالعمل شرکت (قبلاً در سامانه) · SRC.chem = کاربرگ شیمیایی (اسناد کمیته ۱۴۰۵-۱۳-۱) · SRC.rec = پیشنهادی (نیازمند تأیید مدیر) */
(function () {
  'use strict';
  const SRC = { co: 'دستورالعمل شرکت (بند ۵-۳)', chem: 'کاربرگ ارزیابی نیمه‌کمی ریسک شیمیایی', rec: 'پیشنهادی — نیازمند تأیید مدیر' };

  /* ---- مقیاس‌ها (منبع: دستورالعمل شرکت بند ۵-۳؛ منتقل‌شده از risks.html بدون تغییر) ---- */
  const SEV10 = ['', 'بدون آسیب (شبه‌حادثه)', 'آسیب خیلی جزئی، بدون درمان', 'آسیب جزئی، کمک‌های اولیه', 'نیاز به مرکز درمانی (بخیه)', 'حاد: اورژانس/بیمارستان', 'شکستگی، بستری', 'کاهش موقت عملکرد بدن', 'کاهش دائم (قطع عضو)', 'از دست دادن کامل عملکرد (کوری)', 'فوت'];
  const OCC10 = ['', 'فقط در شرایط نادر', 'هر ۱۰ تا ۱۵ سال', 'هر ۵ تا ۱۰ سال', 'هر ۲ تا ۴ سال', 'هر ۱ تا ۲ سال', 'هر ۶ ماه تا ۱ سال', 'هر ۳ ماه', 'هر ماه', 'هر هفته', 'هر روز'];
  const DET10 = ['', 'حتماً قابل شناسایی', 'احتمال بسیار بالا', 'احتمال بالا', 'معمولاً شناسایی می‌شود', 'پنجاه‌پنجاه', 'شانس کم', 'شانس ناچیز', 'شانس بسیار ناچیز', 'شانس بعید', 'غیرقابل شناسایی'];
  const SEV5 = ['', 'ناچیز', 'جزئی', 'متوسط', 'شدید', 'فاجعه‌بار'], LIK5 = ['', 'بسیار نادر', 'نادر', 'ممکن', 'محتمل', 'تقریباً حتمی'];
  const MN = { fmea: 'FMEA', hazop: 'HAZOP', reba: 'REBA', rula: 'RULA' };
  const RED = '#f87171', ORG = '#fb923c', YEL = '#fbbf24', GRN = '#34d399';

  /* ---- سطح ریسک بر اساس روش (منبع: دستورالعمل شرکت؛ بدون تغییر) ---- */
  function lvl(r) {
    const s = r.score || 0;
    if (r.method === 'fmea') {
      if (s >= 90) return { t: 'بالا (RPN ≥ ۹۰)', c: RED, h: 1 };
      if (r.legal_gap) return { t: 'اولویت: الزام قانونی رعایت نشده', c: ORG, h: 1 };
      if (r.severity === 10) return { t: 'اولویت: شدت ۱۰', c: ORG, h: 1 };
      return { t: 'پایین', c: GRN, h: 0 };
    }
    if (r.method === 'hazop') return s >= 15 ? { t: 'خیلی زیاد', c: RED, h: 1 } : s >= 10 ? { t: 'زیاد', c: ORG, h: 1 } : s >= 5 ? { t: 'متوسط', c: YEL, h: 0 } : { t: 'کم', c: GRN, h: 0 };
    if (r.method === 'reba') return s >= 11 ? { t: 'خیلی زیاد', c: RED, h: 1 } : s >= 8 ? { t: 'زیاد', c: ORG, h: 1 } : s >= 4 ? { t: 'متوسط', c: YEL, h: 0 } : s >= 2 ? { t: 'کم', c: GRN, h: 0 } : { t: 'ناچیز', c: GRN, h: 0 };
    return s >= 7 ? { t: 'تغییر فوری', c: RED, h: 1 } : s >= 5 ? { t: 'بررسی و تغییر به‌زودی', c: ORG, h: 1 } : s >= 3 ? { t: 'نیاز به بررسی بیشتر', c: YEL, h: 0 } : { t: 'قابل قبول', c: GRN, h: 0 };
  }
  const calc = (m, s, o, d) => m === 'fmea' ? s * o * (d || 1) : s * o;
  const levelClass = r => { const L = lvl(r); return L.h ? 'high' : (L.c === YEL ? 'mid' : 'low'); };
  /* جدول آستانه‌ها برای نمایش در دستورالعمل */
  const THRESH = {
    fmea: [['RPN ≥ ۹۰', 'بالا', RED, SRC.co], ['الزام قانونی رعایت‌نشده (حتی با RPN کمتر)', 'اولویت', ORG, SRC.co], ['شدت = ۱۰', 'اولویت', ORG, SRC.co], ['سایر', 'پایین', GRN, SRC.co]],
    hazop: [['≥ ۱۵', 'خیلی زیاد', RED, SRC.co], ['۱۰ تا ۱۴', 'زیاد', ORG, SRC.co], ['۵ تا ۹', 'متوسط', YEL, SRC.co], ['< ۵', 'کم', GRN, SRC.co]],
    reba: [['≥ ۱۱', 'خیلی زیاد', RED, SRC.co], ['۸ تا ۱۰', 'زیاد', ORG, SRC.co], ['۴ تا ۷', 'متوسط', YEL, SRC.co], ['۲ تا ۳', 'کم', GRN, SRC.co], ['۱', 'ناچیز', GRN, SRC.co]],
    rula: [['≥ ۷', 'تغییر فوری', RED, SRC.co], ['۵ تا ۶', 'بررسی و تغییر به‌زودی', ORG, SRC.co], ['۳ تا ۴', 'نیاز به بررسی بیشتر', YEL, SRC.co], ['۱ تا ۲', 'قابل قبول', GRN, SRC.co]]
  };

  /* ---- انتخاب روش بر اساس دسته (روش رسمی شرکت FMEA؛ ارگونومی REBA/RULA؛ HAZOP برای انحراف فرایندی) ---- */
  const ERGO_BODY = ['حمل دستی بار', 'وضعیت بدنی نامناسب'], ERGO_UPPER = ['حرکات تکراری', 'طراحی ایستگاه کار'];
  const METHOD_RULES = [
    ['ایمنی، بهداشت شغلی، محیط زیست، اضطراری، سایر', 'FMEA', 'روش رسمی شرکت؛ هر خطر یک ردیف با شدت، احتمال و کشف', SRC.co],
    ['ارگونومی: حمل دستی بار، وضعیت بدنی نامناسب', 'REBA', 'ارزیابی وضعیت کل بدن', SRC.co],
    ['ارگونومی: حرکات تکراری، طراحی ایستگاه کار', 'RULA', 'ارزیابی اندام فوقانی', SRC.co],
    ['انحراف فرایندی (فشار، دما، جریان، سطح) در واحدهای فرایندی', 'HAZOP', 'با کلیدواژه و پارامتر؛ اختیاری و مکمل FMEA', SRC.co],
    ['مواجهه با آلاینده‌های شیمیایی (نیاز به پایش هوا/معاینات)', 'نیمه‌کمی شیمیایی', '√(HR×ER) طبق کاربرگ ارزیابی مواجهه شیمیایی', SRC.chem]
  ];
  const methodFor = cat => ERGO_BODY.includes(cat) ? 'reba' : ERGO_UPPER.includes(cat) ? 'rula' : 'fmea';
  const isErgoCat = c => ERGO_BODY.includes(c) || ERGO_UPPER.includes(c);

  /* ---- مهلت‌ها (پیشنهادی؛ نیازمند تأیید مدیر): بازبینی و اقدام بر اساس سطح ---- */
  const DEF = { reviewMonths: { high: 3, mid: 6, low: 12 }, actionDays: { high: 30, mid: 90, low: 180 }, devS: 3, benchMin: 3, minText: 10 };
  const LEVEL_NAME = { high: 'بالا / اولویت‌دار', mid: 'متوسط', low: 'پایین / قابل قبول' };
  const addMonths = (iso, m) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + m); return d.toISOString().slice(0, 10); };
  const reviewDefault = (r, today) => addMonths(today, DEF.reviewMonths[levelClass(r)]);

  /* ---- مقایسه با ارزیابی‌های قبلی ---- */
  const med = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
  const normT = s => String(s == null ? '' : s).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\u200f]/g, ' ').toLowerCase();
  const STOP = new Set(['در', 'از', 'به', 'با', 'برای', 'و', 'یا', 'که', 'این', 'آن', 'هنگام', 'حین', 'بدون', 'توسط', 'بر', 'را', 'های', 'ای', 'یک', 'تا']);
  const words = s => new Set(normT(s).split(/[^\u0600-\u06FFa-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w)));
  const jac = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; a.forEach(w => { if (b.has(w)) i++; }); return i / (a.size + b.size - i); };
  /* آمار دستهٔ مشابه (FMEA): میانهٔ S/O/D/RPN از ارزیابی‌های قبلی همان دسته؛ فقط با حداقل benchMin نمونه */
  function bench(R, cat, excludeId) {
    if (!cat) return null;
    const a = (R || []).filter(r => r && r.method === 'fmea' && r.category === cat && r.status !== 'archived' && String(r.id) !== String(excludeId) && r.severity && r.likelihood);
    const ap = a.filter(r => r.status === 'approved'), use = ap.length >= DEF.benchMin ? ap : a;
    if (use.length < DEF.benchMin) return null;
    return { n: use.length, approved: use === ap, S: med(use.map(r => r.severity)), O: med(use.map(r => r.likelihood)), D: med(use.filter(r => r.detection).map(r => r.detection)), RPN: med(use.map(r => r.score || calc('fmea', r.severity, r.likelihood, r.detection))) };
  }
  /* ارزیابی‌های قبلی مشابه: همپوشانی کلمات «خطر» + هم‌دسته بودن/هم‌واحد بودن */
  function similar(R, q, k) {
    const wq = words(q.hazard); if (!wq.size) return [];
    return (R || []).filter(r => r && r.status !== 'archived' && String(r.id) !== String(q.id) && r.hazard).map(r => {
      const j = jac(wq, words(r.hazard)), s = j + (q.category && r.category === q.category ? 0.2 : 0) + (q.unit && r.unit === q.unit ? 0.05 : 0);
      return { r, s, j };
    }).filter(x => x.j >= 0.2).sort((a, b) => b.s - a.s).slice(0, k || 3).map(x => x.r);
  }
  /* انحراف شدید از میانهٔ دستهٔ مشابه (برای نیاز به توضیح) */
  function deviation(r, R) {
    if (r.method !== 'fmea' || !r.severity || !r.likelihood) return null;
    const b = bench(R, r.category, r.id); if (!b) return null;
    const d = [];
    if (Math.abs(r.severity - b.S) >= DEF.devS) d.push('شدت ' + r.severity + ' در برابر میانهٔ ' + b.S);
    if (Math.abs(r.likelihood - b.O) >= DEF.devS) d.push('احتمال ' + r.likelihood + ' در برابر میانهٔ ' + b.O);
    return d.length ? { items: d, bench: b } : null;
  }

  /* ---- بررسی انطباق یک ریسک با دستورالعمل. sev: 'block' = مانع ذخیره · 'warn' = هشدار ----
     o = { isNew, today } */
  const len = s => String(s == null ? '' : s).trim().length;
  function check(r, o) {
    o = o || {}; const E = [], add = (id, sev, msg) => E.push({ id, sev, msg });
    const sod = r.method === 'fmea' || r.method === 'hazop', L = lvl(r), cls = levelClass(r);
    if (len(r.hazard) < DEF.minText) add('hz', 'block', 'شرح خطر باید کامل باشد (منبع خطر + رویداد، حداقل ' + DEF.minText + ' حرف).');
    if (!r.category) add('cat', o.isNew ? 'block' : 'warn', 'دستهٔ ریسک مشخص نشده است.');
    if (r.category && r.method) {
      const ergo = isErgoCat(r.category);
      if (ergo && (r.method === 'fmea' || r.method === 'hazop')) add('meth', 'warn', 'دستهٔ ارگونومی با ' + MN[methodFor(r.category)] + ' ارزیابی می‌شود، نه ' + MN[r.method] + '.');
      else if (!ergo && (r.method === 'reba' || r.method === 'rula')) add('meth', 'warn', 'روش ' + MN[r.method] + ' فقط برای دسته‌های ارگونومی است؛ برای این دسته FMEA (روش رسمی شرکت) توصیه می‌شود.');
    }
    if (sod) {
      if (len(r.consequence) < 5) add('cq', o.isNew ? 'block' : 'warn', 'اثرات/پیامد خطر ثبت نشده است.');
      if (len(r.causes) < 5) add('cs', o.isNew ? 'block' : 'warn', 'علل بالقوه ثبت نشده است.');
    }
    if (L.h) {
      if (len(r.planned_controls) < 5) add('plan', 'block', 'برای ریسک بالا/اولویت‌دار شرح اقدام اصلاحی الزامی است.');
      if (!len(r.owner)) add('own', 'block', 'برای ریسک بالا/اولویت‌دار مسئول اقدام الزامی است.');
      if (!r.action_type) add('at', 'warn', 'نوع اقدام (سلسله‌مراتب کنترل) مشخص نشده است.');
      if (r.action_type === 'کنترل اداری' || r.action_type === 'وسایل حفاظت فردی') add('adm', 'warn', 'برای ریسک بالا کنترل اداری/PPE به‌تنهایی کافی نیست؛ سلسله‌مراتب: حذف ← جایگزینی ← مهندسی ← اداری ← PPE.');
      if (sod && !len(r.existing_controls)) add('ex', 'warn', 'کنترل‌های موجود ثبت نشده است.');
    }
    if (r.review_date && o.today) {
      const lim = addMonths(o.today, DEF.reviewMonths[cls]);
      if (r.review_date > addDays10(lim)) add('rev', 'warn', 'تاریخ بازبینی از مهلت سطح «' + LEVEL_NAME[cls] + '» (' + DEF.reviewMonths[cls] + ' ماه) دورتر است.');
    }
    return E;
  }
  const addDays10 = iso => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 10); return d.toISOString().slice(0, 10); };

  /* ---- روش نیمه‌کمی ارزیابی مواجهه با آلاینده‌های شیمیایی (کاربرگ ۱۴۰۵-۱۳-۱) ---- */
  const NA = ['در دسترس نیست / غیرقابل کاربرد', null];
  const CHEM = {
    HR: ['', 'بدون اثر سوء شناخته‌شده (ACGIH A5، غیرسمی)', 'تحریک/حساسیت پوست، اثرات برگشت‌پذیر (ACGIH A4)', 'سرطان‌زای احتمالی (ACGIH A3/IARC 2B)، خورنده، حساس‌کنندهٔ تنفسی، مضر', 'ACGIH A2/IARC 2A، بسیار خورنده، سمی', 'سرطان‌زا/جهش‌زای شناخته‌شده (A1/IARC 1)، بسیار سمی'],
    vp: [['فشار بخار < 0.1 mmHg', 1], ['0.1 تا 1 mmHg', 2], ['> 1 تا 10 mmHg', 3], ['> 10 تا 100 mmHg', 4], ['> 100 mmHg', 5], NA],
    size: [['ذرات درشت، توده یا مواد مرطوب', 1], ['ذرات درشت و مواد خشک', 2], ['ذرات کوچک و خشک > 100 میکرومتر', 3], ['مواد خشک و ریز 10 تا 100 میکرومتر', 4], ['مواد پودری خشک و ریز < 10 میکرومتر', 5], NA],
    odor: [['نسبت آستانهٔ بویایی/حد مجاز < 0.1', 1], ['0.1 تا 0.5', 2], ['> 0.5 تا 1', 3], ['> 1 تا 2', 4], ['≥ 2', 5], NA],
    ctrl: [['کنترل مناسب با تعمیر و نگهداری منظم', 1], ['کنترل مناسب با تعمیر و نگهداری غیرمنظم', 2], ['کنترل مناسب بدون تعمیر و نگهداری؛ نسبتاً غبارآلود', 3], ['کنترل نامناسب، غبارآلود', 4], ['فاقد اقدام کنترلی، خیلی غبارآلود', 5], NA],
    dur: [['< 4 ساعت در هفته', 0.5], ['4 تا 8 ساعت', 1], ['8 تا 16 ساعت', 2], ['16 تا 24 ساعت', 3], ['24 تا 32 ساعت', 4], ['32 تا 40 ساعت', 5], NA],
    qty: [['تقریباً قابل‌چشم‌پوشی (< 250 میلی‌گرم/میلی‌لیتر)', 0.5], ['خیلی کم (0.25 تا 1 کیلوگرم/لیتر)', 1], ['کم (1 تا کمتر از 10)', 2], ['متوسط، حمل با آموزش (10 تا کمتر از 100)', 3], ['زیاد، حمل با آموزش (100 تا کمتر از 1000)', 4], ['زیاد، حمل بدون آموزش (> 1000)', 5], NA]
  };
  /* ER = میانگین هندسی شاخص‌های موجود؛ سطح = √(HR×ER)؛ آستانه‌ها: <1.5 / <2.5 / <3.5 / <4.5 / ≥4.5 */
  const chemER = idx => { const v = idx.filter(x => typeof x === 'number'); return v.length ? Math.pow(v.reduce((a, b) => a * b, 1), 1 / v.length) : null; };
  const chemQ = (hr, er) => (hr && er) ? Math.sqrt(hr * er) : null;
  function chemClass(q) {
    if (q == null) return null;
    return q < 1.5 ? { n: 1, t: 'قابل چشم‌پوشی', c: GRN, mon: false } : q < 2.5 ? { n: 2, t: 'پایین', c: GRN, mon: false } : q < 3.5 ? { n: 3, t: 'متوسط', c: YEL, mon: true } : q < 4.5 ? { n: 4, t: 'بالا', c: ORG, mon: true } : { n: 5, t: 'خیلی بالا', c: RED, mon: true };
  }
  const chemFind = name => { const k = normT(name).replace(/\s+/g, ''); return (window.HSEChemList || []).find(x => normT(x[0]).replace(/\s+/g, '').replace(/^‡/, '') === k) || null; };

  window.HSERiskStd = { SRC, SEV10, OCC10, DET10, SEV5, LIK5, MN, lvl, calc, levelClass, LEVEL_NAME, THRESH, METHOD_RULES, methodFor, isErgoCat, DEF, reviewDefault, addMonths, bench, similar, deviation, check, CHEM, chemER, chemQ, chemClass, chemFind, colors: { RED, ORG, YEL, GRN } };
})();
