/* محاسبهٔ افراد پرریسک (مشترک بین صفحهٔ اصلی و تقویم کارشناس). نیاز: auth.js (HSEP, HSEDB, HSEToday) */
(function () {
const fa = (n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]));
const HRW = { sev: { minor: 3, moderate: 8, severe: 20, fatal: 40 }, repeatInc: 10, lostPerDay: 0.5, lostCap: 90, warnWritten: 6, warnOther: 2, warnCap: 20, epilepsy: 30, seizureVisit: 25, cardiac: 12, htn: 12, htnMaybe: 6, dm: 6, restricted: 6, fuOver: 5, noTrain: 5, trainCredit: 8, manyVisits: 5, HIGH: 30, MID: 15 };
const SEVL = { minor: 'جزئی', moderate: 'متوسط', severe: 'شدید', fatal: 'فوتی' };
const ndg = s => String(s == null ? '' : s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const PFU = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
function jalToISO(y, m, d) { const st = Date.UTC(y + 621, 2, 17); for (let i = 0; i < 400; i++) { const t = new Date(st + i * 864e5), p = PFU.formatToParts(t), g = k => +p.find(x => x.type === k).value; if (g('year') === y && g('month') === m && g('day') === d) return t.toISOString().slice(0, 10); } return null; }
function dISO(v) {
  if (!v) return null; const s = ndg(v).trim(), m = s.match(/^(1[34]\d\d)[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m) return jalToISO(+m[1], +m[2], +m[3]);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s); return isNaN(d) ? null : d.toISOString().slice(0, 10);
}
const agoISO = mo => { const d = new Date(); d.setMonth(d.getMonth() - mo); return d.toISOString().slice(0, 10); };
const getAllRows = t => HSEDB.getAll(t);
const pickK = (o, ks) => { for (const k of ks) if (o[k] != null && o[k] !== '') return o[k]; return null; };

async function computeHR() {
  try { if (window.HSEAuth) await HSEAuth.ready; } catch (_) { }
  const exOK = !!(window.HSEAuth && HSEAuth.canSeeExams && HSEAuth.canSeeExams());
  const [emp, inc, vis, ex, fu, ekh, tr, ta] = await Promise.all(['employees?select=*', 'clinic_incidents?select=employee_id,incident_date,severity,description', 'clinic_visits?select=employee_id,visit_date,visit_reason,medical_leave_days', exOK ? 'clinic_exams?select=employee_id,exam_date,history,vitals,fitness,restrictions' : null, 'clinic_followups?select=employee_id,status,due_date,title', 'ekhtars?select=*', 'trainings?select=id,training_date', 'training_attendees?select=training_id,employee_id'].map(q => q ? getAllRows(q) : null));
  if (!emp) return null;
  const c24 = agoISO(24), c36 = agoISO(36), c60 = agoISO(60), c12 = agoISO(12), c6 = agoISO(6), today = HSEToday();
  /* کل سوابق لحاظ می‌شود؛ هرچه قدیمی‌تر، وزن کمتر (۲ سال اخیر ۱۰۰٪، تا ۵ سال ۶۰٪، قدیمی‌تر ۳۵٪؛ حادثه شدید/فوتی حداقل ۶۰٪) */
  const wAge = (d, sev) => { const w = d >= c24 ? 1 : d >= c60 ? 0.6 : 0.35; return sev >= 3 ? Math.max(w, 0.6) : w; };
  const P = {}, byCode = {};
  /* فوتی: فردی که حادثهٔ فوتی دارد (یا علت قطع همکاری‌اش «فوت» است) در فهرست نمی‌آید، حتی اگر تاریخ قطع همکاری ثبت نشده باشد؛
     «روز از دست رفته»ی فوتی (مثلاً ۹۰۰۰) روز جریمه‌ای شاخص‌هاست و استعلاجی واقعی نیست */
  const dead = new Set((inc || []).filter(i => i.severity === 'fatal').map(i => i.employee_id));
  const empA = emp.filter(e => HSEP.isActive(e) && !dead.has(e.id) && !/فوت/.test(e.termination_reason || '')); /* قطع همکاری یا فوت: از فهرست افراد پرخطر حذف */
  empA.forEach(e => { P[e.id] = { e, n: 0, nRec: 0, n36: 0, sevMax: 0, pts: 0, lostInc: 0, lostVis: 0, lostIncW: 0, lostVisW: 0, warnPts: 0, lastEv: null, warnW: 0, warnO: 0, v6: 0, vBP: 0, seizV: 0, cond: new Set(), bp: false, restr: false, fuOver: 0, lastTr: null, chips: [], act: new Set() }; if (e.emp_id != null) byCode[String(e.emp_id)] = e.id; });
  const SO = { minor: 1, moderate: 2, severe: 3, fatal: 4 };
  (inc || []).forEach(i => { const p = P[i.employee_id], d = dISO(i.incident_date); if (!p || !d) return; const sv = HRW.sev[i.severity] ? i.severity : 'minor', w = wAge(d, SO[sv]); if (!p.lastEv || d > p.lastEv) p.lastEv = d; p.n++; if (d >= c24) p.nRec++; if (d >= c36) p.n36++; p.pts += HRW.sev[sv] * w; p.sevMax = Math.max(p.sevMax, SO[sv]); const m = ndg(i.description).match(/روز از دست رفته:\s*(\d+)/); if (m) { p.lostInc += +m[1]; p.lostIncW += +m[1] * w; } });
  (vis || []).forEach(v => { const p = P[v.employee_id], d = dISO(v.visit_date); if (!p || !d) return; const ld = Number(v.medical_leave_days) || 0; p.lostVis += ld; p.lostVisW += ld * wAge(d, 0); if (d >= c6) p.v6++; const r = String(v.visit_reason || ''); if (d >= c12 && /فشار/.test(r)) p.vBP++; if (/تشنج|صرع|غش|بیهوش/.test(r)) p.seizV++; });
  const latest = {}; (ex || []).forEach(x => { const c = latest[x.employee_id]; if (!c || String(x.exam_date) > String(c.exam_date)) latest[x.employee_id] = x; if (P[x.employee_id]) Object.keys(((x.history || {}).cond) || {}).forEach(k => P[x.employee_id].cond.add(k)); });
  Object.keys(latest).forEach(id => { const p = P[id], x = latest[id]; if (!p) return; const v = x.vitals || {}; if ((+v.sys >= 140) || (+v.dia >= 90)) p.bp = true; if (['fit_restricted', 'temp_unfit', 'unfit'].includes(x.fitness)) p.restr = true; });
  (HSEAuth.visibleFollowups(fu) || []).forEach(f => { const p = P[f.employee_id]; if (p && ['pending', 'overdue'].includes(f.status) && f.due_date && f.due_date < today) p.fuOver++; });
  (ekh || []).forEach(o => { const id = pickK(o, ['employee_id', 'personnel_id']) || byCode[String(pickK(o, ['emp_id', 'employee_code', 'personnel_code', 'code']))], p = P[id]; if (!p) return; const d = dISO(pickK(o, ['record_date', 'issue_date', 'issued_at', 'letter_date', 'date', 'created_at'])), w = d ? wAge(d, 0) : 1; if (d && (!p.lastEv || d > p.lastEv)) p.lastEv = d; if ((pickK(o, ['record_type', 'type', 'kind']) || '') === 'اخطار کتبی') { p.warnW++; p.warnPts += HRW.warnWritten * w; } else { p.warnO++; p.warnPts += HRW.warnOther * w; } });
  const trD = {}; (tr || []).forEach(t => trD[t.id] = dISO(t.training_date)); const haveTr = !!(tr && ta);
  (ta || []).forEach(a => { const p = P[a.employee_id], d = trD[a.training_id]; if (p && d && (!p.lastTr || d > p.lastTr)) p.lastTr = d; });
  const out = [];
  Object.values(P).forEach(p => {
    const ch = [], add = (t, c) => ch.push([t, c || '']);
    const lost = Math.max(p.lostInc, p.lostVis), lostW = Math.max(p.lostIncW, p.lostVisW);
    if (p.n) { add(`${fa(p.n)} حادثه` + (p.n !== p.nRec ? ` (${fa(p.nRec)} در ۲ سال اخیر)` : ''), p.n36 >= 3 ? 'r' : 'o'); if (p.sevMax >= 3) add(p.sevMax === 4 ? 'حادثه فوتی' : 'حادثه شدید', 'r'); }
    if (p.n36 >= 3) p.pts += HRW.repeatInc;
    if (lost) { p.pts += Math.min(lostW, HRW.lostCap) * HRW.lostPerDay; add(`${fa(lost)} روز استعلاجی`, lost >= 30 ? 'r' : 'o'); }
    if (p.warnW || p.warnO) { p.pts += Math.min(HRW.warnCap, p.warnPts); add(p.warnW ? `${fa(p.warnW)} اخطار کتبی` : `${fa(p.warnO)} سابقه انضباطی`, p.warnW ? 'o' : ''); }
    let med = false;
    if (p.cond.has('epilepsy')) { p.pts += HRW.epilepsy; add('سابقه صرع/تشنج', 'r'); med = true; } else if (p.seizV) { p.pts += HRW.seizureVisit; add('مراجعه برای تشنج/غش', 'r'); med = true; }
    if (p.cond.has('cardiac')) { p.pts += HRW.cardiac; add('بیماری قلبی', 'r'); med = true; }
    if (p.cond.has('htn') || p.bp) { p.pts += HRW.htn; add('فشار خون بالا', 'o'); med = true; } else if (p.vBP >= 2) { p.pts += HRW.htnMaybe; add('مراجعه مکرر برای فشار', 'o'); med = true; }
    if (p.cond.has('dm')) { p.pts += HRW.dm; add('دیابت'); }
    if (p.restr) { p.pts += HRW.restricted; add('محدودیت کاری طب کار', 'o'); }
    if (p.fuOver) { p.pts += HRW.fuOver; add('پیگیری بهداری معوق', 'o'); med = true; }
    if (p.v6 >= 4) { p.pts += HRW.manyVisits; add(`${fa(p.v6)} مراجعه بهداری در ۶ ماه`); }
    /* آموزش: اگر ۱۲ ماه اخیر آموزش ندیده، امتیاز و پیشنهاد آموزش؛ اگر بعد از آخرین حادثه/اخطار آموزش دیده، اعتبار آموزش (کاهش امتیاز و حذف پیشنهاد)؛ اگر بعد از آموزش دوباره حادثه/اخطار داشته، آموزش مجدد */
    const noTr = haveTr && (!p.lastTr || p.lastTr < c12); let trAct = '';
    if (!haveTr) { if (p.lastEv) trAct = 'آموزش'; }
    else if (noTr) { p.pts += HRW.noTrain; add('بدون آموزش در ۱۲ ماه اخیر', 'o'); trAct = 'آموزش'; }
    else if (p.lastEv) {
      if (p.lastTr >= p.lastEv) { p.pts = Math.max(0, p.pts - HRW.trainCredit); add('آموزش پس از آخرین رویداد', 'g'); }
      else { add('رویداد پس از آخرین آموزش', 'r'); trAct = 'آموزش مجدد'; }
    }
    p.score = Math.round(p.pts); p.chips = ch; p.med = med;
    p.level = p.score >= HRW.HIGH ? 'high' : p.score >= HRW.MID ? 'mid' : (med ? 'med' : 'low');
    const a = []; if (trAct) a.push(trAct); if (p.level === 'high') a.push('کنترل بیشتر'); if (med) a.push('پیگیری پزشکی');
    p.actions = a;
  });
  const list = out.concat(Object.values(P).filter(p => p.level !== 'low')).sort((a, b) => ({ high: 0, mid: 1, med: 2 }[a.level] - { high: 0, mid: 1, med: 2 }[b.level]) || b.score - a.score);
  return { list, total: empA.length, haveTr };
}

window.computeHR = computeHR;
})();
