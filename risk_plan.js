/* برنامهٔ ارزیابی ریسک سوله‌ها/واحدها (استفاده در تقویم و صفحهٔ ثبت ریسک)
   - هر واحد (hse_units) برای سه حوزه باید ارزیابی ریسک داشته باشد: ایمنی ← کارشناس · بهداشت شغلی و ارگونومی ← مدیر
   - «انجام‌شده» یعنی برای آن واحد و آن حوزه حداقل MIN_RISKS ریسک ثبت‌شده (غیر بایگانی) وجود دارد؛ ریسک با دستهٔ آن حوزه (CATS) و واحدِ همان نام/نام مستعار.
   - بقیه به‌صورت «نوبتی» از امروز در روزهای کاری چیده می‌شوند و با ثبت ریسک خودکار از برنامه خارج می‌شوند. */
(function () {
  'use strict';
  /* دسته‌های ریسک (مرجع واحد؛ risks.html هم از همین استفاده می‌کند) */
  const CATS = [
    ['ایمنی', ['مکانیکی (ماشین‌آلات، قطعات متحرک)', 'برق و برق‌گرفتگی', 'سقوط از ارتفاع و لغزش', 'آتش‌سوزی و انفجار', 'حمل‌ونقل داخلی و لیفتراک', 'جرثقیل و بالابری', 'فضای بسته', 'کار گرم و جوشکاری', 'فشار (مخزن، بویلر، کمپرسور)', 'ابزار دستی و تجهیزات']],
    ['بهداشت شغلی', ['شیمیایی (اسید، گاز سمی، آمونیاک، گرد و غبار)', 'فیزیکی: صدا', 'فیزیکی: گرما و سرما', 'فیزیکی: روشنایی و ارتعاش', 'فیزیکی: پرتو', 'بیولوژیک', 'روانی-اجتماعی (استرس، شیفت، خستگی)']],
    ['ارگونومی', ['حمل دستی بار', 'وضعیت بدنی نامناسب', 'حرکات تکراری', 'طراحی ایستگاه کار']],
    ['محیط زیست', ['پساب و آلودگی آب', 'انتشار هوا و گاز', 'پسماند', 'نشت و ریزش مواد', 'مصرف انرژی و منابع', 'سر و صدای محیطی']],
    ['اضطراری', ['نشت گاز یا مواد سمی', 'آتش‌سوزی گسترده', 'زلزله و بلایای طبیعی', 'قطع برق و خدمات', 'تخلیه و کمک‌های اولیه']],
    ['سایر', ['امنیت و ورود غیرمجاز', 'پیمانکاران', 'قانونی و الزامات', 'سایر']]
  ];
  const catsOf = name => (CATS.find(g => g[0] === name) || [, []])[1];
  /* حوزه‌های برنامه + مسئول (expert = کارشناس، manager = مدیر) */
  const GROUPS = {
    safety: { label: 'ایمنی', name: 'ایمنی', owner: 'expert', cats: catsOf('ایمنی') },
    health: { label: 'بهداشتی', name: 'بهداشت شغلی', owner: 'manager', cats: catsOf('بهداشت شغلی') },
    ergo: { label: 'ارگونومی', name: 'ارگونومی', owner: 'manager', cats: catsOf('ارگونومی') }
  };
  const ORDER = ['safety', 'health', 'ergo'];
  const DEF = { minRisks: 1, step: { expert: 1, manager: 2 }, max: 400 }; /* step = هر چند روز کاری یک نوبت */
  const groupOfCat = c => ORDER.find(k => GROUPS[k].cats.includes(c)) || '';

  const norm = s => String(s == null ? '' : s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\s\u200c\-_()،,]/g, '').toLowerCase();
  function matcher(units) { /* مثل eval_core.unitMatcher: نام یا نام‌های مستعار؛ اول برابر، بعد شامل */
    const list = [];
    (units || []).forEach(u => [u.name, ...String(u.aliases || '').split(/[,،]/)].map(norm).filter(Boolean).forEach(k => list.push([k, u])));
    list.sort((a, b) => b[0].length - a[0].length);
    return t => { const d = norm(t); if (!d) return null; const ex = list.find(x => x[0] === d); if (ex) return ex[1]; const c = list.find(x => d.includes(x[0])); return c ? c[1] : null; };
  }
  /* همهٔ نوبت‌های انجام‌نشده (واحد × حوزه) برای واحدهای فعال */
  function pending(units, risks, o) {
    o = Object.assign({}, DEF, o || {});
    const act = (units || []).filter(u => u && u.name && u.active !== false), m = matcher(act), cnt = {};
    (risks || []).forEach(r => { if (!r || r.status === 'archived') return; const g = groupOfCat(r.category); if (!g) return; const u = m(r.unit); if (u) { const k = u.id + '|' + g; cnt[k] = (cnt[k] || 0) + 1; } });
    const us = act.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'fa', { numeric: true }));
    const out = [];
    us.forEach(u => ORDER.forEach(g => { if ((cnt[u.id + '|' + g] || 0) < o.minRisks) out.push({ uid: u.id, unit: u.name, gk: g, owner: GROUPS[g].owner }); }));
    return out;
  }
  /* برنامهٔ نوبتی یک نقش: از امروز (یا اولین روز کاری بعد) هر `step` روز کاری یک مورد */
  function plan(units, risks, role, o) {
    o = Object.assign({}, DEF, o || {});
    const isWork = o.isWork, addDays = o.addDays, today = o.today;
    if (!isWork || !addDays || !today || !(role in DEF.step)) return [];
    const list = pending(units, risks, o).filter(x => x.owner === role).slice(0, o.max), step = (o.step || DEF.step)[role] || 1;
    if (!list.length) return [];
    const wd = [], need = (list.length - 1) * step + 1;
    let cur = today, guard = 0;
    while (wd.length < need && guard++ < 4000) { if (isWork(cur)) wd.push(cur); cur = addDays(cur, 1); }
    return list.map((x, i) => Object.assign({ date: wd[i * step], n: i + 1, total: list.length, label: GROUPS[x.gk].label }, x)).filter(x => x.date);
  }
  window.HSERiskPlan = { CATS, GROUPS, ORDER, DEF, groupOfCat, pending, plan, matcher, norm };
})();
