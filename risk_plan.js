/* برنامهٔ ارزیابی ریسک سوله‌ها: برای هر سوله «بازهٔ زمانی» بر اساس تعداد تجهیز و پرسنل
   حوزه‌ها: ایمنی ← کارشناس (track=expert) · بهداشت شغلی + ارگونومی ← مدیر (track=manager)
   «انجام‌شده»: برای آن واحد و حوزه حداقل DEF.minRisks ریسک غیربایگانی با دستهٔ همان حوزه ثبت شده باشد.
   حجم کار (ساعت) = پایه + ضریب×(تجهیز وزنی) + ضریب×(نفر) برای هر حوزهٔ باقی‌مانده؛ روز کاری = ساعت ÷ ظرفیت روزانهٔ آن نقش.
   بازه‌ها پشت‌سرهم از تاریخ شروع چیده می‌شوند و در جدول risk_plan ذخیره می‌شوند (hse_risk_plan.sql). */
(function () {
  'use strict';
  const CATS = [
    ['ایمنی', ['مکانیکی (ماشین‌آلات، قطعات متحرک)', 'برق و برق‌گرفتگی', 'سقوط از ارتفاع و لغزش', 'آتش‌سوزی و انفجار', 'حمل‌ونقل داخلی و لیفتراک', 'جرثقیل و بالابری', 'فضای بسته', 'کار گرم و جوشکاری', 'فشار (مخزن، بویلر، کمپرسور)', 'ابزار دستی و تجهیزات']],
    ['بهداشت شغلی', ['شیمیایی (اسید، گاز سمی، آمونیاک، گرد و غبار)', 'فیزیکی: صدا', 'فیزیکی: گرما و سرما', 'فیزیکی: روشنایی و ارتعاش', 'فیزیکی: پرتو', 'بیولوژیک', 'روانی-اجتماعی (استرس، شیفت، خستگی)']],
    ['ارگونومی', ['حمل دستی بار', 'وضعیت بدنی نامناسب', 'حرکات تکراری', 'طراحی ایستگاه کار']],
    ['محیط زیست', ['پساب و آلودگی آب', 'انتشار هوا و گاز', 'پسماند', 'نشت و ریزش مواد', 'مصرف انرژی و منابع', 'سر و صدای محیطی']],
    ['اضطراری', ['نشت گاز یا مواد سمی', 'آتش‌سوزی گسترده', 'زلزله و بلایای طبیعی', 'قطع برق و خدمات', 'تخلیه و کمک‌های اولیه']],
    ['سایر', ['امنیت و ورود غیرمجاز', 'پیمانکاران', 'قانونی و الزامات', 'سایر']]
  ];
  const catsOf = n => (CATS.find(g => g[0] === n) || [, []])[1];
  const GROUPS = {
    safety: { label: 'ایمنی', name: 'ایمنی', owner: 'expert', cats: catsOf('ایمنی') },
    health: { label: 'بهداشتی', name: 'بهداشت شغلی', owner: 'manager', cats: catsOf('بهداشت شغلی') },
    ergo: { label: 'ارگونومی', name: 'ارگونومی', owner: 'manager', cats: catsOf('ارگونومی') }
  };
  const TRACKS = { expert: ['safety'], manager: ['health', 'ergo'] };
  const TRACK_NAME = { expert: 'کارشناس (ایمنی)', manager: 'مدیر (بهداشتی و ارگونومی)' };
  /* پارامترهای قابل‌تنظیم */
  const DEF = {
    minRisks: 1,
    workdays: [6, 0, 1, 2, 3], /* شنبه تا چهارشنبه (مثل تقویم) */
    cap: { expert: 4, manager: 2 }, /* ساعت مفید ارزیابی ریسک در هر روز کاری */
    minDays: 2, maxDays: 15,
    hrs: { safety: { b: 3, e: 1.5, p: 0.05 }, health: { b: 2, e: 0.3, p: 0.1 }, ergo: { b: 1.5, e: 0, p: 0.1 } }, /* پایه + ضریب هر تجهیز + ضریب هر نفر */
    eqW: { 'کپسول آتش‌نشانی': 0, 'چاه ارت': 0.25, 'سیستم همبندی': 0.25, 'فایرباکس': 0.25 } /* وزن تجهیز در حجم کار (پیش‌فرض ۱) */
  };
  const groupOfCat = c => Object.keys(GROUPS).find(k => GROUPS[k].cats.includes(c)) || '';
  const norm = s => String(s == null ? '' : s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\s\u200c\-_()،,]/g, '').toLowerCase();
  function matcher(units) { /* مثل eval_core.unitMatcher: نام یا نام‌های مستعار؛ اول برابر، بعد شامل */
    const list = [];
    (units || []).forEach(u => [u.name, ...String(u.aliases || '').split(/[,،]/)].map(norm).filter(Boolean).forEach(k => list.push([k, u])));
    list.sort((a, b) => b[0].length - a[0].length);
    return t => { const d = norm(t); if (!d) return null; const ex = list.find(x => x[0] === d); if (ex) return ex[1]; const c = list.find(x => d.includes(x[0])); return c ? c[1] : null; };
  }
  const activeUnits = units => (units || []).filter(u => u && u.name && u.active !== false).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'fa', { numeric: true }));
  /* تعداد ریسک ثبت‌شده برای هر (واحد، حوزه) */
  function counts(units, risks) {
    const m = matcher(activeUnits(units)), c = {};
    (risks || []).forEach(r => { if (!r || r.status === 'archived') return; const g = groupOfCat(r.category); if (!g) return; const u = m(r.unit); if (u) { const k = u.id + '|' + g; c[k] = (c[k] || 0) + 1; } });
    return c;
  }
  const remaining = (uid, track, cnt, o) => TRACKS[track].filter(g => (cnt[uid + '|' + g] || 0) < ((o && o.minRisks) || DEF.minRisks));
  /* حجم کار هر واحد از روی تجهیزات فعال (hall/location) و پرسنل فعال (department) */
  function workloads(units, equipment, employees) {
    const act = activeUnits(units), m = matcher(act), W = {};
    act.forEach(u => W[u.id] = { eq: 0, eqw: 0, ppl: 0, byCat: {} });
    (equipment || []).forEach(e => {
      if (!e || e.active === false) return;
      const u = m(e.hall) || m(e.location); if (!u) return;
      const w = W[u.id], k = DEF.eqW[e.category] != null ? DEF.eqW[e.category] : 1;
      w.eq++; w.eqw += k; w.byCat[e.category] = (w.byCat[e.category] || 0) + 1;
    });
    (employees || []).forEach(p => { if (!p || p.termination_date) return; const u = m(p.department); if (u) W[u.id].ppl++; });
    return W;
  }
  const hoursOf = (g, w, o) => { const h = (o && o.hrs || DEF.hrs)[g]; return h.b + h.e * (w.eqw != null ? w.eqw : (w.eq || 0)) + h.p * (w.ppl || 0); };
  const daysOf = (hours, track, o) => { const cap = ((o && o.cap) || DEF.cap)[track], mn = (o && o.minDays) || DEF.minDays, mx = (o && o.maxDays) || DEF.maxDays; return Math.max(mn, Math.min(mx, Math.ceil(hours / cap))); };

  /* ساخت برنامه: برای هر نقش، واحدها به ترتیب نام، پشت‌سرهم از start. loads[uid] = {eq,eqw,ppl} (قابل ویرایش توسط مدیر) */
  function build(units, risks, loads, o) {
    o = Object.assign({}, o); const isWork = o.isWork, addDays = o.addDays;
    if (!isWork || !addDays || !o.start) return [];
    const cnt = counts(units, risks), out = [];
    const nextWork = iso => { let d = iso, g = 0; while (!isWork(d) && g++ < 14) d = addDays(d, 1); return d; };
    Object.keys(TRACKS).forEach(track => {
      let cur = nextWork(o.start);
      activeUnits(units).forEach(u => {
        const rem = remaining(u.id, track, cnt, o); if (!rem.length) return;
        const w = (loads && loads[u.id]) || { eq: 0, eqw: 0, ppl: 0 }, hours = rem.reduce((s, g) => s + hoursOf(g, w, o), 0), days = daysOf(hours, track, o);
        let end = cur, n = 1; while (n < days) { end = addDays(end, 1); if (isWork(end)) n++; }
        out.push({ unit_id: String(u.id), unit_name: u.name, track, start_date: cur, end_date: end, equipment_n: w.eq || 0, people_n: w.ppl || 0, hours: Math.round(hours * 10) / 10, days, domains: rem });
        cur = nextWork(addDays(end, 1));
      });
    });
    return out;
  }
  /* وظایف تقویم برای یک نقش از روی ردیف‌های ذخیره‌شدهٔ برنامه. حوزهٔ انجام‌شده از برنامه حذف می‌شود؛
     بازهٔ گذشتهٔ انجام‌نشده = یک مورد «عقب‌افتاده» در روز پایان بازه. */
  function tasks(rows, units, risks, role, o) {
    o = o || {}; const isWork = o.isWork, addDays = o.addDays, today = o.today, a = o.a, b = o.b;
    if (!isWork || !addDays || !today || !(role in TRACKS)) return [];
    const cnt = counts(units, risks), U = {}; activeUnits(units).forEach(u => U[String(u.id)] = u);
    const out = [];
    (rows || []).filter(r => r.track === role && U[String(r.unit_id)]).forEach(r => {
      const rem = remaining(U[String(r.unit_id)].id, role, cnt, o); if (!rem.length) return;
      const lab = rem.map(g => GROUPS[g].label).join(' + '), first = rem[0], s = String(r.start_date).slice(0, 10), e = String(r.end_date).slice(0, 10);
      const days = []; for (let d = s, g = 0; d <= e && g < 40; d = addDays(d, 1), g++) if (isWork(d)) days.push(d);
      const mk = (d, late, idx) => ({ id: 'RK' + r.id + d, date: d, due: e, t: 'ارزیابی ریسک ' + lab + ' — ' + r.unit_name, rk: { start: s, end: e, idx, n: days.length, eq: r.equipment_n || 0, ppl: r.people_n || 0, late },
        mk: 'RK', done: false, kind: 'month', go: 'risks.html#new&unit=' + encodeURIComponent(r.unit_name) + '&group=' + first });
      if (e < today) { if (e >= a && e <= b) out.push(mk(e, true, days.length)); else if (today >= a && today <= b) out.push(mk(a, true, days.length)); return; } /* بازهٔ گذشتهٔ انجام‌نشده: در ماه جاری هم دیده شود */
      days.forEach((d, i) => { if (d >= today && d >= a && d <= b) out.push(mk(d, false, i + 1)); });
    });
    return out;
  }
  /* آیا هنوز واحد/حوزه‌ی بدون ارزیابی هست؟ (برای یادآوری تدوین برنامه) */
  const anyPending = (units, risks) => { const c = counts(units, risks); return activeUnits(units).some(u => Object.keys(TRACKS).some(t => remaining(u.id, t, c).length)); };
  window.HSERiskPlan = { anyPending, CATS, GROUPS, TRACKS, TRACK_NAME, DEF, groupOfCat, norm, matcher, counts, remaining, workloads, hoursOf, daysOf, build, tasks, activeUnits };
})();
