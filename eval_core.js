/* هسته مشترک ارزیابی عملکرد HSE — فرمول‌ها مطابق فایل اکسل «ارزیابی عملکرد» (شیت ارزیابی عملکرد HSE و پارامترها) */
(function () {
  const URL_ = 'https://priopguwfjawybffarhd.supabase.co', KEY = 'sb_publishable_fKFQePO9qiFhj4qU3Vq4lQ_OAFi7rfu';
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }, JH = { ...H, 'Content-Type': 'application/json' };
  const MN = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nd = s => String(s || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const PF = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric' });
  const PFU = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
  const mkey = p => p.find(x => x.type === 'year').value + '-' + String(+p.find(x => x.type === 'month').value).padStart(2, '0');
  const toJal = d => { const p = PFU.formatToParts(d), g = t => +p.find(x => x.type === t).value; return [g('year'), g('month'), g('day')]; };
  function jk(v) {
    if (!v) return null; const s = nd(v).trim();
    const m = s.match(/^(1[34]\d\d)[\/\-](\d{1,2})/); if (m) return m[1] + '-' + String(+m[2]).padStart(2, '0');
    const d = new Date(s); return isNaN(d) ? null : mkey(PF.formatToParts(d));
  }
  const MR = {};
  function monthRange(K) {
    if (MR[K]) return MR[K];
    const y = +K.slice(0, 4), st = Date.UTC(y + 621, 2, 10); let a = null, b = null, n = 0, w = 0;
    for (let i = 0; i < 400; i++) { const t = new Date(st + i * 864e5), j = toJal(t); if (j[0] + '-' + String(j[1]).padStart(2, '0') === K) { const s = t.toISOString().slice(0, 10); if (!a) a = s; b = s; n++; if (PARAM.WORKDAYS.includes(t.getUTCDay())) w++; } }
    return MR[K] = { a, b, days: n, work: w };
  }
  /* قطع همکاری: تا ماهی که قطع همکاری در آن رخ داده محاسبه می‌شود و از ماه بعد حذف (قاعده‌ی مشترک؛ HSEP در auth.js) */
  const isActive = (e, refISO) => !e || !e.termination_date || String(e.termination_date).slice(0, 10) >= refISO;
  const nowK = () => jk(new Date().toISOString());
  function monthKeys(n) { const out = []; let [y, m] = nowK().split('-').map(Number); for (let i = 0; i < n; i++) { out.push(y + '-' + String(m).padStart(2, '0')); if (--m < 1) { m = 12; y--; } } return out; }
  const monthLabel = K => MN[+K.slice(5) - 1] + ' ' + fa(K.slice(0, 4));
  function jalToISO(y, m, d) { const st = Date.UTC(y + 621, 2, 17); for (let i = 0; i < 400; i++) { const t = new Date(st + i * 864e5), j = toJal(t); if (j[0] === y && j[1] === m && j[2] === d) return t.toISOString().slice(0, 10); } return null; }

  /* ---- انتخابگر تاریخ شمسی: container با سه select (روز، ماه، سال) ---- */
  function jdInit(el, optional) {
    const ty = toJal(new Date())[0], o = (v, t) => `<option value="${v}">${t}</option>`, ss = el.querySelectorAll('select');
    ss[0].innerHTML = (optional ? o('', 'روز') : '') + Array.from({ length: 31 }, (_, i) => o(i + 1, fa(i + 1))).join('');
    ss[1].innerHTML = (optional ? o('', 'ماه') : '') + MN.map((n, i) => o(i + 1, n)).join('');
    ss[2].innerHTML = (optional ? o('', 'سال') : '') + [ty - 2, ty - 1, ty, ty + 1].map(v => o(v, fa(v))).join('');
    if (!optional) jdSet(el, new Date().toISOString().slice(0, 10));
  }
  function jdSet(el, iso) { const ss = el.querySelectorAll('select'), [y, m, d] = toJal(new Date(iso + 'T00:00:00Z')); ss[0].value = d; ss[1].value = m; ss[2].value = y; }
  function jdGet(el) { const [d, m, y] = [...el.querySelectorAll('select')].map(x => +x.value); if (!d || !m || !y) return null; return jalToISO(y, m, d) || jalToISO(y, m, 29); }
  const jdHTML = id => `<div id="${id}" class="jd"><select></select><select></select><select></select></div>`;

  /* ---- ارتباط با Supabase ---- */
  async function getAll(t) {
    for (const ord of ['order=id.asc', '']) {
      let all = [], o = 0, ok = true;
      for (let n = 0; n < 80; n++) {
        const r = await fetch(`${URL_}/rest/v1/${t}${t.includes('?') ? '&' : '?'}${ord ? ord + '&' : ''}limit=1000&offset=${o}`, { headers: H }).catch(() => null);
        if (!r || !r.ok) { ok = false; break; }
        const j = await r.json(); if (!j.length) break; all = all.concat(j); o += j.length;
      }
      if (ok) return all;
    }
    return null;
  }
  async function req(path, method, body, prefer) {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: { ...JH, Prefer: prefer || 'return=representation' }, body: body == null ? undefined : JSON.stringify(body) });
    const tx = await r.text(); if (!r.ok) throw new Error(tx); return tx ? JSON.parse(tx) : null;
  }

  /* ---- نگاشت نام (برای تطبیق «واحد» بانک پرسنل با واحدهای ارزیابی) ---- */
  const norm = s => nd(s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\s\u200c\-_()،,]/g, '').toLowerCase();
  function unitMatcher(units) {
    const list = [];
    (units || []).forEach(u => { [u.name, ...String(u.aliases || '').split(/[,،]/)].map(norm).filter(Boolean).forEach(k => list.push([k, u])); });
    list.sort((a, b) => b[0].length - a[0].length);
    return dept => { const d = norm(dept); if (!d) return null; const ex = list.find(x => x[0] === d); if (ex) return ex[1]; const c = list.find(x => d.includes(x[0])); return c ? c[1] : null; };
  }

  /* ---- بارگذاری داده‌های ارزیابی ---- */
  /* o.days: فقط داده‌ی چند روز اخیر خوانده شود (سریع‌تر؛ برای ارزیابی ماهانه کافی است). بدون آن، کل تاریخچه. */
  async function loadEval(o) {
    const days = o && o.days ? o.days + 365 : null, since = days ? new Date(Date.now() - days * 864e5).toISOString().slice(0, 10) : null,
      F = (t, col) => since ? `${t}&${col}=gte.${since}` : t;
    const [units, monthly, cards, inc, emp, tr] = await Promise.all([
      getAll('hse_units?select=*'), getAll('hse_unit_monthly?select=*'), getAll(F('hse_cards?select=*', 'card_date')),
      getAll(F('clinic_incidents?select=incident_date,severity,description,employee_id', 'incident_date')),
      getAll('employees?select=id,department,termination_date').then(r => r || getAll('employees?select=id,department')),
      getAll(F('trainings?select=id,training_type,training_date', 'training_date'))]);
    let ta;
    if (since && tr) { /* فقط حاضرین جلسات ایمنی همین بازه (ارزیابی فقط از همین‌ها استفاده می‌کند) */
      const ids = tr.filter(t => t.training_type === 'safety_talk').map(t => t.id), ch = [];
      for (let i = 0; i < ids.length; i += 40) ch.push(getAll('training_attendees?select=training_id,employee_id&training_id=in.(' + ids.slice(i, i + 40).join(',') + ')'));
      const parts = await Promise.all(ch);
      ta = parts.some(p => !p) ? null : [].concat(...parts);
    } else ta = await getAll('training_attendees?select=training_id,employee_id');
    return { units, monthly, cards, inc, emp, tr, ta };
  }

  /* ---- پارامترها (مطابق اصلاح استانداردسازی شاخص‌ها) ----
     - ساعت کار بر اساس روزهای کاری واقعی (شنبه تا چهارشنبه) نه روزهای تقویمی
     - نرخ‌های حادثه روی ۱۲ ماه متحرک و با کفِ مواجهه‌ی ۲۰۰٬۰۰۰ ساعت (پایه‌ی OSHA) تا واحد کوچک بی‌ثباتی آماری نداشته باشد
     - PPE و رفتار ناایمن به‌صورت درصد از «تعداد مشاهده» سنجیده می‌شود؛ صفر بدون مشاهده‌ی کافی امتیاز کامل نمی‌گیرد
     - حادثه‌ی جزئی (کمک‌های اولیه) از شاخص ایمنی خارج است تا گزارش‌دهی جریمه نشود
     - بدون ارفاق ریسک: واحد پرریسک با همان ترازو سنجیده می‌شود */
  const PARAM = { SAFETY_T: 80, PART_T: 20, WORKDAYS: [6, 0, 1, 2, 3], HOURS_PER_DAY: 9, FLOOR_H: 200000, MIN_OBS: 5, MIN_OBS_FRAC: 0.5, OBS_FROM: '1405-08',
    W: { X: 3, AB: 2, AF: 2.5, AJ: 2.5 }, RISK: { A: { cap: 100, coef: 1 }, B: { cap: 100, coef: 1 }, C: { cap: 100, coef: 1 } } };
  const ZONES = ['الگو (ایمن و مشارکت‌جو)', 'ایمن ولی ساکت', 'ریسک بالا، شفاف', 'نیازمند مداخله فوری'];
  const ratioPts = (n, c, t) => { if (!n) return 0; const r = n / c * 10; return r <= 1 ? t[0] : r <= 3 ? t[1] : r <= 5 ? t[2] : t[3]; };
  /* امتیاز درصد تخلف (۰..۱۰۰): درون‌یابی خطی بین نقاط؛ بدون پرش ناگهانی از +۱۰ به −۱ */
  const PCT_ANCH = [[0, 10], [2, 7], [5, 3], [10, 0], [30, -4], [60, -8], [100, -10]];
  const pctPts = v => { v = Math.max(0, Math.min(100, v)); for (let i = 1; i < PCT_ANCH.length; i++) { const [x1, y1] = PCT_ANCH[i - 1], [x2, y2] = PCT_ANCH[i]; if (v <= x2) return y1 + (y2 - y1) * (v - x1) / (x2 - x1); } return -10; };
  const minObs = C => Math.max(PARAM.MIN_OBS, Math.ceil(C * PARAM.MIN_OBS_FRAC));
  const prevKeyOf = k => { let y = +k.slice(0, 4), m = +k.slice(5) - 1; if (m < 1) { m = 12; y--; } return y + '-' + String(m).padStart(2, '0'); };
  const keys12 = K => { const o = []; let k = K; for (let i = 0; i < 12; i++) { o.push(k); k = prevKeyOf(k); } return o; };
  const lostOf = i => +((i.description || '').match(/روز از دست رفته:\s*(\d+)/) || [0, 0])[1]; /* مقدار را خود برنامه‌ی بهداری در شرح ثبت می‌کند */

  /* امتیازدهی یک واحد (تابع خالص)
     i: C نفر، hz/nm/sg/talks مشارکت، ppe/unsafe شمار تخلف، obs شمار مشاهده (null = داده‌ی قدیمی)،
        ac12/lost12/hours12 حادثه‌ی غیرجزئی، روز از دست رفته و ساعت کار ۱۲ ماه اخیر */
  function scoreUnit(i) {
    const C = i.C, h12 = Math.max(i.hours12 || 0, PARAM.FLOOR_H);
    const L = ratioPts(i.hz, C, [3, 6, 8, 10]), O = ratioPts(i.nm, C, [3, 6, 8, 10]), R = ratioPts(i.sg, C, [3, 6, 8, 10]), T = ratioPts(i.talks, C, [3, 5, 8, 10]);
    const den = i.obs > 0 ? i.obs : C; /* داده‌ی قدیمی بدون مخرج مشاهده: به نسبت نفرات (مثل قبل) */
    const X = pctPts(i.ppe / den * 100), AB = pctPts(i.unsafe / den * 100);
    const afr = (i.ac12 || 0) / h12 * 1e6, AF = afr === 0 ? 10 : afr <= 5 ? 0 : afr <= 10 ? -5 : -10;
    const dr = (i.lost12 || 0) / h12 * 200000, AJ = dr === 0 ? 10 : dr <= 10 ? 4 : dr <= 50 ? -2 : dr <= 150 ? -6 : -10;
    const W = PARAM.W, AS = X * W.X + AB * W.AB + AF * W.AF + AJ * W.AJ;
    return { hours: i.hours12 || 0, afr, asr: dr, pts: { L, O, R, T, X, AB, AF, AJ }, safety: Math.min(100, Math.max(0, 50 + AS / 2)), part: Math.min(100, ((L + O + R + T) * 0.5 / 20) * 100) };
  }

  function compute(K, B) {
    if (!B || !B.units) return null;
    const R = monthRange(K), inM = (a, f) => (a || []).filter(x => jk(x[f]) === K), match = unitMatcher(B.units);
    const empU = {}; (B.emp || []).forEach(e => { const u = match(e.department); if (u && isActive(e, R.a)) empU[e.id] = u.id; });
    const cards = inM(B.cards, 'card_date').filter(c => c.status !== 'rejected');
    const talkIds = new Set(inM(B.tr, 'training_date').filter(t => t.training_type === 'safety_talk').map(t => t.id));
    const talkUnits = {}; (B.ta || []).filter(a => talkIds.has(a.training_id) && empU[a.employee_id]).forEach(a => { (talkUnits[empU[a.employee_id]] = talkUnits[empU[a.employee_id]] || new Set()).add(a.training_id); });
    const incU = {}, incY = {}; let incNoUnit = 0;
    const K12 = keys12(K), S12 = new Set(K12);
    (B.inc || []).forEach(i => { const k = jk(i.incident_date); if (!k) return; const uid = empU[i.employee_id];
      if (S12.has(k) && uid) (incY[uid] = incY[uid] || []).push(i);
      if (k === K) { if (!uid) incNoUnit++; else (incU[uid] = incU[uid] || []).push(i); } });
    const mon = {}; (B.monthly || []).filter(m => m.month_key === K).forEach(m => mon[m.unit_id] = m);
    
    const rows = B.units.filter(u => u.active !== false && u.headcount > 0).map(u => {
      const C = u.headcount;
      
      // ✅ تابع جدید برای محاسبه‌ی امتیاز وزنی کارت‌ها
      // گزارش عادی = ۱ امتیاز، گزارش عالی = ۲ امتیاز
      const getWeightedScore = (type) => {
        const typeCards = cards.filter(c => c.unit === u.name && c.card_type === type);
        const standardCount = typeCards.filter(c => c.is_excellent !== true).length;
        const excellentCount = typeCards.filter(c => c.is_excellent === true).length;
        return standardCount + (excellentCount * 2);
      };
      
      const hz = getWeightedScore('hazard');
      const nm = getWeightedScore('near_miss');
      const sg = getWeightedScore('suggestion');
      const talks = (talkUnits[u.id] || new Set()).size;
      
      const m = mon[u.id], ppe = m ? m.ppe_count : 0, unsafe = m ? m.unsafe_count : 0, obs = m && m.obs_count != null ? +m.obs_count : null;
      /* از ۱۴۰۵-۰۸ ورودی بدون تعداد مشاهده‌ی کافی «داده ناقص» است (صفرِ بدون مشاهده امتیاز نمی‌گیرد) */
      const need = minObs(C), entered = !!m && (K < PARAM.OBS_FROM || (obs != null && obs >= need));
      const ii = incU[u.id] || [], ak = ii.filter(i => i.severity === 'minor').length, ac = ii.length - ak;
      const lost = ii.reduce((s, i) => s + lostOf(i), 0);
      const y = incY[u.id] || [], ac12 = y.filter(i => i.severity !== 'minor').length, ak12 = y.length - ac12, lost12 = y.reduce((s, i) => s + lostOf(i), 0);
      const hours12 = K12.reduce((s, k) => s + monthRange(k).work * C * PARAM.HOURS_PER_DAY, 0);
      const sc = scoreUnit({ C, hz, nm, sg, talks, ppe, unsafe, obs, ac12, lost12, hours12 }), { hours, afr, asr, pts, safety, part } = sc;
      const zone = !entered ? null : (safety >= PARAM.SAFETY_T && part >= PARAM.PART_T && part > 0) ? 0 : safety >= PARAM.SAFETY_T ? 1 : (part >= PARAM.PART_T && part > 0) ? 2 : 3;
      const eligible = entered && !!u.manager && ac === 0 && zone === 0;
      return { u, C, hz, nm, sg, talks, ppe, unsafe, obs, need, entered, ac, ak, lost, ac12, ak12, lost12, hours, afr, asr, pts, safety: Math.round(safety * 10) / 10, part: Math.round(part * 10) / 10, zone, eligible, score: eligible ? Math.sqrt(safety * part) : 0 };
    });
    rows.filter(r => r.eligible).sort((a, b) => b.score - a.score).forEach((r, i) => r.rank = i + 1);
    const zones = [0, 1, 2, 3].map(z => rows.filter(r => r.zone === z));
    
    // ✅ محاسبه‌ی آمار کارت‌ها با در نظر گرفتن امتیاز وزنی
    const allCardsInMonth = inM(B.cards, 'card_date').filter(c => c.status !== 'rejected');
    const weightedTotal = allCardsInMonth.reduce((sum, c) => sum + (c.is_excellent ? 2 : 1), 0);
    const weightedByType = (type) => allCardsInMonth.filter(c => c.card_type === type).reduce((sum, c) => sum + (c.is_excellent ? 2 : 1), 0);
    
    return { 
      K, rows, zones, 
      incomplete: rows.filter(r => !r.entered), 
      rank: rows.filter(r => r.eligible).sort((a, b) => a.rank - b.rank), 
      cardsTotal: allCardsInMonth.length,
      cardsWeightedTotal: weightedTotal, // ✅ مجموع امتیاز وزنی
      cardTypes: { 
        hazard: allCardsInMonth.filter(c => c.card_type === 'hazard').length, 
        near_miss: allCardsInMonth.filter(c => c.card_type === 'near_miss').length, 
        suggestion: allCardsInMonth.filter(c => c.card_type === 'suggestion').length 
      },
      cardTypesWeighted: { // ✅ آمار وزنی بر اساس نوع
        hazard: weightedByType('hazard'),
        near_miss: weightedByType('near_miss'),
        suggestion: weightedByType('suggestion')
      },
      incNoUnit, days: R.days 
    };
  }

  /* ---- نردبان فرهنگ ---- */
  const LV = [['بیمارگونه', '#c81414'], ['واکنشی', '#f08a1c'], ['محاسبه‌گر', '#e6d600'], ['پیشگیرانه', '#9cc63b'], ['خلاقانه', '#4f9a12']];
  const levelOf = avg => LV[Math.min(5, Math.max(1, Math.round(avg))) - 1];
  async function loadCulture() { const r = await getAll('culture_assessments?select=id,assessed_at,assessor,answers,avg,notes'); return r ? r.sort((a, b) => String(b.assessed_at).localeCompare(String(a.assessed_at))) : null; }
  function cultureAt(list, K) { if (!list) return null; const end = monthRange(K).b; const ok = list.filter(x => x.assessed_at <= end); return { latest: ok[0] || null, prev: ok[1] || null }; }

  window.HSE = { URL_, H, JH, MN, fa, esc, nd, jk, monthRange, monthKeys, monthLabel, nowK, jalToISO, toJal, jdInit, jdSet, jdGet, jdHTML, getAll, req, norm, unitMatcher, isActive, loadEval, compute, scoreUnit, lostOf, PARAM, ZONES, LV, levelOf, loadCulture, cultureAt };
})();
