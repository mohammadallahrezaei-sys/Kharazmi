/* ورود اجباری و نقش‌ها برای کل نرم‌افزار HSE.
   استفاده: اولین اسکریپت <head> هر صفحه:  <script src="auth.js"></script>
   صفحه‌ی فقط‌مدیر:  <script src="auth.js" data-roles="manager"></script> */
(function () {
  const SB = 'https://priopguwfjawybffarhd.supabase.co', KEY = 'sb_publishable_fKFQePO9qiFhj4qU3Vq4lQ_OAFi7rfu', STORE = 'hse_auth';
  /* ===== نقش‌ها (ایمیل‌ها را اینجا تنظیم کنید) ===== */
  const MANAGERS = ['m.rezaei@gmail.com'];
  const EXPERTS = { 'm.mohammadi@gmail.com': 'محمدی' };
  /* سوییچ بین حساب مدیر و کارشناس (ورود واقعی با هر حساب؛ دسترسی‌ها دقیقاً همان دسترسی همان حساب است).
     false (امن، پیش‌فرض): رفتن به کارشناس یک‌کلیکی است، ولی بازگشت به مدیر رمز مدیر را می‌خواهد؛ چون اگر نشست مدیر در همین مرورگر بماند،
     هر کس پشت این مرورگر بنشیند با یک کلیک مدیر می‌شود و قفل معاینات طب کار بی‌اثر می‌شود.
     true: هر دو جهت یک‌کلیکی (فقط روی دستگاه شخصیِ خودتان فعال کنید). */
  const SWITCH_BACK_WITHOUT_PASSWORD = false;
  const STORE_ALT = 'hse_auth_alt', SW_FLAG = 'hse_switched';
  const MANAGER_ONLY_LINKS = ['report.html', 'reward_eval.html', 'committee.html', 'weekly_verify.html', 'unit_report.html', 'evaluation.html', 'culture.html', 'indices.html', 'mgmt.html', 'procedures.html']; // برای کارشناس از منوها پنهان می‌شود
  /* ================================================= */
  const SCR = document.currentScript, PAGE_ROLES = SCR && SCR.dataset.roles ? SCR.dataset.roles.split(',') : null;
  /* اتصال زودهنگام به Supabase: چند صد میلی‌ثانیه از اولین درخواست داده کم می‌کند */
  try { const pc = document.createElement('link'); pc.rel = 'preconnect'; pc.href = SB; pc.crossOrigin = ''; document.head.appendChild(pc); } catch (e) { }
  const rawFetch = window.fetch.bind(window);
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE)); } catch (e) { return null; } };
  const save = s => localStorage.setItem(STORE, JSON.stringify(s));
  const mk = r => ({ access_token: r.access_token, refresh_token: r.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (r.expires_in || 3600), user: { email: ((r.user && r.user.email) || '').toLowerCase() } });
  async function grant(type, body) {
    const r = await rawFetch(`${SB}/auth/v1/token?grant_type=${type}`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    if (!r || !r.ok) return null; return mk(await r.json());
  }
  async function token() {
    let s = load(); if (!s) return null;
    if (s.expires_at - 60 < Date.now() / 1000) { const n = await grant('refresh_token', { refresh_token: s.refresh_token }); if (!n) { localStorage.removeItem(STORE); location.reload(); return null; } save(n); s = n; }
    return s.access_token;
  }
  let done; const ready = new Promise(r => done = r);
  /* ===== قطع همکاری پرسنل: قاعده‌ی مشترک همه‌ی ماژول‌ها =====
     فردی که termination_date دارد تا همان تاریخ فعال حساب می‌شود و بعد از آن از گزارش‌ها/ارزیابی‌ها/فهرست‌های جاری حذف می‌شود؛
     اطلاعاتش در بانک پرسنل و سوابق گذشته می‌ماند.
     HSEP.isActive(e)            → فعال بودن امروز (فهرست‌های جاری، انتخاب‌گرها، افراد پرخطر)
     HSEP.isActive(e, 'YYYY-MM-DD') → فعال بودن در بازه‌ای که از آن تاریخ شروع می‌شود (گزارش ماهانه/دوره‌ای) */
  window.HSEP = {
    isTerminated: e => !!(e && e.termination_date),
    isActive: (e, ref) => !e || !e.termination_date || String(e.termination_date).slice(0, 10) >= (ref || new Date().toISOString().slice(0, 10)),
    active: (list, ref) => (list || []).filter(e => window.HSEP.isActive(e, ref))
  };
  const A = window.HSEAuth = { EXPERTS, MANAGERS, ready, token, email: '', role: '', logout() { localStorage.removeItem(STORE); localStorage.removeItem(STORE_ALT); localStorage.removeItem(SW_FLAG); location.reload(); } };
  /* معاینات طب کار (clinic_exams) فقط برای مدیر؛ بعد از await HSEAuth.ready صدا بزنید.
     قفل اصلی در دیتابیس است (hse_clinic_exams_private.sql)؛ این تابع فقط برای جلوگیری از خواندن/نمایش بی‌مورد در رابط است. */
  A.canSeeExams = () => A.role === 'manager' && !A.viewAs;
  A.switchToExpert = () => switchToExpert(); A.switchToManager = () => switchToManager(); /* برای دکمه‌ی صفحه‌ی اصلی */
  /* پیگیری‌هایی که ثبت معاینه خودکار می‌سازد (عنوان با این دو پیشوند شروع می‌شود) حاوی یافته‌های پزشکی‌اند؛ برای غیرمدیر حذف می‌شوند.
     بعد از هر درخواست دیتا (که منتظر ورود می‌ماند) صدا بزنید؛ null را null برمی‌گرداند. قفل اصلی: hse_clinic_followups_exam_hide.sql */
  const EXAM_FU = /^\s*(پیگیری یافته‌های معاینه طب کار|معاینه طب کار بعدی)/;
  A.isExamFollowup = f => !!f && EXAM_FU.test(String(f.title || ''));
  A.visibleFollowups = list => (!Array.isArray(list) || A.canSeeExams()) ? list : list.filter(f => !A.isExamFollowup(f));

  /* همه‌ی درخواست‌های Supabase بعد از ورود و با توکن کاربر می‌روند (صفحه‌ها تغییری نمی‌خواهند) */
  /* جلوگیری از ثبت دوباره با دوبار لمس: درخواست POST کاملاً یکسان به دیتابیس در ۴ ثانیه یک‌بار فرستاده می‌شود */
  const recentPost = {};
  window.fetch = function (u, o) {
    const url = typeof u === 'string' ? u : (u && u.url) || String(u);
    if (o && o.method && String(o.method).toUpperCase() === 'POST' && url.startsWith(SB + '/rest/v1/') && typeof o.body === 'string') {
      const key = url + '|' + o.body, now = Date.now();
      if (recentPost[key] && now - recentPost[key].t < 4000) return recentPost[key].p.then(r => r.clone());
      const p = fetchCore(u, o); recentPost[key] = { t: now, p }; p.then(r => { if (!r.ok) delete recentPost[key]; }, () => { delete recentPost[key]; });
      return p.then(r => r.clone());
    }
    return fetchCore(u, o);
  };
  async function fetchCore(u, o) {
    const url = typeof u === 'string' ? u : (u && u.url) || String(u);
    if (url.startsWith(SB + '/rest/') || url.startsWith(SB + '/storage/') || url.startsWith(SB + '/functions/')) {
      await ready; const t = await token();
      if (t) { const h = new Headers((o && o.headers) || (u && u.headers) || {}); h.set('Authorization', 'Bearer ' + t); h.set('apikey', KEY);
        if (typeof Request !== 'undefined' && u instanceof Request) u = new Request(u, { headers: h }); else o = { ...(o || {}), headers: h }; }
    }
    return rawFetch(u, o);
  }

  const roleOf = e => MANAGERS.includes(e) ? 'manager' : EXPERTS[e] ? 'expert' : null;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function overlay(html) {
    let d = document.getElementById('hse-auth');
    if (!d) { d = document.createElement('div'); d.id = 'hse-auth'; document.documentElement.appendChild(d); }
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0f172a;color:#f1f5f9;display:flex;align-items:center;justify-content:center;font-family:Vazirmatn,Tahoma,sans-serif;direction:rtl;padding:16px';
    d.innerHTML = `<div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:22px;width:100%;max-width:340px;line-height:1.9">${html}</div>`;
    return d;
  }
  const inp = 'width:100%;margin-top:8px;padding:10px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#f1f5f9;font:inherit;direction:ltr';
  function loginUI(msg) {
    const d = overlay(`<h2 style="margin:0 0 6px;font-size:18px">ورود به نرم‌افزار HSE</h2><div style="font-size:12px;color:#94a3b8">گسترش فناوری خوارزمی</div>
      <input id="ha-e" type="email" placeholder="ایمیل" style="${inp}"><input id="ha-p" type="password" placeholder="رمز عبور" style="${inp}">
      <button id="ha-b" style="width:100%;margin-top:12px;padding:10px;border-radius:10px;border:0;background:#0f766e;color:#fff;font:inherit;cursor:pointer">ورود</button>
      <div id="ha-m" style="color:#f87171;font-size:13px;margin-top:6px">${esc(msg || '')}</div>`);
    const go = async () => {
      const e = d.querySelector('#ha-e').value.trim().toLowerCase(), p = d.querySelector('#ha-p').value;
      const s = await grant('password', { email: e, password: p });
      if (!s) { d.querySelector('#ha-m').textContent = 'ایمیل یا رمز عبور اشتباه است'; return; }
      s.user.email = s.user.email || e; save(s); location.reload();
    };
    d.querySelector('#ha-b').onclick = go; d.querySelector('#ha-p').onkeydown = ev => { if (ev.key === 'Enter') go(); };
  }
  function deny(email, why) {
    overlay(`<h2 style="margin:0 0 6px;font-size:17px;color:#f87171">${why}</h2><div style="font-size:13px;color:#94a3b8;direction:ltr;text-align:left">${esc(email)}</div>
      <div style="margin-top:12px;display:flex;gap:8px"><a href="index.html" style="color:#2dd4bf">صفحه اصلی</a><a href="#" id="ha-o" style="color:#2dd4bf;margin-right:auto">خروج</a></div>`).querySelector('#ha-o').onclick = e => { e.preventDefault(); A.logout(); };
  }
  /* ===== سوییچ حساب ===== */
  const loadAlt = () => { try { return JSON.parse(localStorage.getItem(STORE_ALT)); } catch (e) { return null; } };
  function askPassword(email, title) {
    return new Promise(res => {
      const d = overlay(`<h2 style="margin:0 0 6px;font-size:17px">${esc(title)}</h2><div style="font-size:13px;color:#94a3b8;direction:ltr;text-align:left">${esc(email)}</div>
        <input id="ha-sp" type="password" placeholder="رمز عبور" style="${inp}">
        <button id="ha-sb" style="width:100%;margin-top:12px;padding:10px;border-radius:10px;border:0;background:#0f766e;color:#fff;font:inherit;cursor:pointer">تأیید</button>
        <a href="#" id="ha-sc" style="display:block;margin-top:10px;color:#2dd4bf;text-align:center">انصراف</a>
        <div id="ha-sm" style="color:#f87171;font-size:13px;margin-top:6px"></div>`);
      const pw = d.querySelector('#ha-sp'), msg = d.querySelector('#ha-sm'); pw.focus();
      const go = async () => {
        const s = await grant('password', { email, password: pw.value });
        if (!s) { msg.textContent = 'رمز عبور اشتباه است'; return; }
        s.user.email = s.user.email || email; d.remove(); res(s);
      };
      d.querySelector('#ha-sb').onclick = go; pw.onkeydown = ev => { if (ev.key === 'Enter') go(); };
      d.querySelector('#ha-sc').onclick = ev => { ev.preventDefault(); d.remove(); res(null); };
    });
  }
  async function switchToExpert() {
    const email = Object.keys(EXPERTS)[0]; if (!email) { alert('ایمیل کارشناس تعریف نشده است'); return; }
    let s = null; const alt = loadAlt();
    if (alt && alt.user && alt.user.email === email) { const n = await grant('refresh_token', { refresh_token: alt.refresh_token }); if (n && n.user.email === email) s = n; }
    if (!s) s = await askPassword(email, 'ورود به حساب کارشناس');
    if (!s) return;
    if (roleOf(s.user.email) !== 'expert') { alert('این حساب کارشناس نیست'); return; }
    if (SWITCH_BACK_WITHOUT_PASSWORD) localStorage.setItem(STORE_ALT, JSON.stringify(load())); else localStorage.removeItem(STORE_ALT);
    save(s); localStorage.setItem(SW_FLAG, '1'); location.reload();
  }
  async function switchToManager() {
    const email = MANAGERS[0]; let s = null; const alt = loadAlt();
    if (SWITCH_BACK_WITHOUT_PASSWORD && alt && alt.user && alt.user.email === email) { const n = await grant('refresh_token', { refresh_token: alt.refresh_token }); if (n && n.user.email === email) s = n; }
    if (!s) s = await askPassword(email, 'بازگشت به حساب مدیر');
    if (!s) return;
    if (roleOf(s.user.email) !== 'manager') { alert('این حساب مدیر نیست'); return; }
    localStorage.setItem(STORE_ALT, JSON.stringify(load())); /* نشست کارشناس برای سوییچ یک‌کلیکی بعدی نگه داشته می‌شود */
    save(s); localStorage.removeItem(SW_FLAG); location.reload();
  }
  function chrome() {
    document.getElementById('hse-auth') && document.getElementById('hse-auth').remove();
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;top:6px;left:6px;z-index:99999;font:12px Vazirmatn,Tahoma,sans-serif;background:rgba(15,23,42,.85);color:#e2e8f0;border-radius:10px;padding:2px 10px;direction:rtl';
    b.className = 'np'; b.innerHTML = `${esc(EXPERTS[A.email] || A.email.split('@')[0])} · <a href="#" style="color:#2dd4bf">خروج</a>`;
    b.querySelector('a').onclick = e => { e.preventDefault(); A.logout(); };
    const flagged = (() => { try { return localStorage.getItem(SW_FLAG) === '1'; } catch (_) { return false; } })();
    if (A.role === 'manager' || (A.role === 'expert' && flagged)) { /* سوییچ بین حساب مدیر و کارشناس */
      const sw = document.createElement('a'); sw.href = '#'; sw.style.cssText = 'color:#fbbf24';
      sw.textContent = A.role === 'manager' ? '🔁 سوییچ به حساب کارشناس' : '🔁 بازگشت به حساب مدیر';
      sw.onclick = e => { e.preventDefault(); (A.role === 'manager' ? switchToExpert : switchToManager)(); };
      const lo = b.querySelector('a'); b.insertBefore(sw, lo); b.insertBefore(document.createTextNode(' · '), lo);
    }
    const st = document.createElement('style'); st.textContent = '@media print{.np{display:none!important}}'; document.head.appendChild(st);
    document.body.appendChild(b);
    if (A.role !== 'manager' || A.viewAs) {
      const hide = () => document.querySelectorAll(MANAGER_ONLY_LINKS.map(h => `a[href*="${h}"]`).join(',')).forEach(a => a.style.display = 'none');
      hide(); new MutationObserver(hide).observe(document.body, { childList: true, subtree: true });
    }
  }
  async function init() {
    const s = load(); if (!s) return loginUI();
    if (!(await token())) return loginUI('نشست شما منقضی شده است');
    const email = (load().user.email || '').toLowerCase(), role = roleOf(email);
    if (!role) return deny(email, 'این ایمیل برای نرم‌افزار تعریف نشده است');
    if (PAGE_ROLES && !PAGE_ROLES.includes(role)) return deny(email, 'دسترسی به این صفحه برای شما مجاز نیست');
    A.email = email; A.role = role; A.viewAs = false; try { localStorage.removeItem('hse_view_as'); } catch (_) { } /* «نمای کارشناس» قدیمی جایش را به سوییچ واقعی حساب داد */ done(); chrome();
  }

  /* تاریخ امروز به وقت تهران (toISOString در ۰۰:۰۰–۰۳:۳۰ بامداد تاریخ دیروز را می‌دهد). HSEToday(n) = n روز بعد/قبل */
  window.HSEToday = function (n) { const t = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' }); return n ? new Date(new Date(t + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10) : t; };

  /* ===== دریافت‌کنندهٔ مشترک داده (HSEDB): موازی، مرتب (بدون جاافتادگی/تکرار) و بدون سقف ۱۰۰۰ ردیف =====
     HSEDB.getAll('table?select=a,b&filter...') → آرایهٔ همهٔ ردیف‌ها یا null در صورت خطا.
     درخواست اول تعداد کل را می‌گیرد و بقیهٔ صفحه‌ها همزمان دریافت می‌شوند؛ درخواست‌های یکسانِ هم‌زمان یکی می‌شوند. */
  const inflight = {};
  async function pageAll(t, hdr) {
    const H0 = Object.assign({ apikey: KEY }, hdr || {}), hasOrd = /[?&]order=/.test(t);
    const url = (ord, o) => `${SB}/rest/v1/${t}${t.includes('?') ? '&' : '?'}${ord ? ord + '&' : ''}limit=1000&offset=${o}`;
    for (const ord of hasOrd ? [''] : ['order=id.asc', '']) {
      try {
        const r0 = await window.fetch(url(ord, 0), { headers: Object.assign({}, H0, { Prefer: 'count=exact' }) });
        if (!r0.ok) continue;
        const first = await r0.json(); if (!Array.isArray(first)) continue;
        if (first.length < 1000) return first;
        const m = /\/(\d+)\s*$/.exec(r0.headers.get('content-range') || ''), total = m ? +m[1] : null;
        let all = first, ok = true;
        if (total != null) {
          const offs = []; for (let o = 1000; o < total; o += 1000) offs.push(o);
          const out = new Array(offs.length);
          for (let i = 0; i < offs.length && ok; i += 6) {
            await Promise.all(offs.slice(i, i + 6).map(async (o, k) => { const r = await window.fetch(url(ord, o), { headers: H0 }); if (!r.ok) { ok = false; return; } const j = await r.json(); if (!Array.isArray(j)) { ok = false; return; } out[i + k] = j; }));
          }
          if (!ok) continue;
          out.forEach(a => { all = all.concat(a); });
          return all;
        }
        for (let o = 1000, n = 0; n < 80; n++) { const r = await window.fetch(url(ord, o), { headers: H0 }); if (!r.ok) { ok = false; break; } const j = await r.json(); if (!Array.isArray(j) || !j.length) break; all = all.concat(j); o += j.length; if (j.length < 1000) break; }
        if (ok) return all;
      } catch (e) { /* ادامه با حالت بعدی */ }
    }
    return null;
  }
  window.HSEDB = { getAll(t, hdr) { return inflight[t] || (inflight[t] = pageAll(t, hdr).finally(() => { delete inflight[t]; })); } };

  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
