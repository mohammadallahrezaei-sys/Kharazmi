/* ورود اجباری و نقش‌ها برای کل نرم‌افزار HSE.
   استفاده: اولین اسکریپت <head> هر صفحه:  <script src="auth.js"></script>
   صفحه‌ی فقط‌مدیر:  <script src="auth.js" data-roles="manager"></script> */
(function () {
  /* استایل واکنش‌گرا و یکپارچه در تمام ماژول‌ها */
  (function(){function add(){if(document.getElementById('hse-responsive-css'))return;var l=document.createElement('link');l.id='hse-responsive-css';l.rel='stylesheet';l.href='responsive.css?v=1';(document.head||document.documentElement).appendChild(l);}if(document.head)add();else document.addEventListener('DOMContentLoaded',add,{once:true});})();

  const SB = 'https://priopguwfjawybffarhd.supabase.co', KEY = 'sb_publishable_fKFQePO9qiFhj4qU3Vq4lQ_OAFi7rfu', STORE = 'hse_auth';
  /* Preview host: only the manager account may sign in; all data APIs are read-only. */
  const PREVIEW = location.hostname === 'raw.githack.com';
  /* ===== نقش‌ها (ایمیل‌ها را اینجا تنظیم کنید) ===== */
  const MANAGERS = ['m.rezaei@gmail.com'];
  const EXPERTS = { 'm.mohammadi@gmail.com': 'محمدی' };
  /* «کاربر»: استفاده از همهٔ ماژول‌های عمومی (مثل کارشناس) ولی با محافظ ضد کپی/استخراج کد. ایمیل‌ها را اینجا اضافه کنید، مثلاً: {'a@gmail.com':'نام'}.
     (حساب باید در Supabase هم ساخته شده باشد.) */
  const USERS = { 'haftlangi@kharazmi.net': 'محسن هفت‌لنگی' }; /* ایمیل → نام نمایشی */
  /* سوییچ بین حساب مدیر و کارشناس (ورود واقعی با هر حساب؛ دسترسی‌ها دقیقاً همان دسترسی همان حساب است).
     false (امن، پیش‌فرض): رفتن به کارشناس یک‌کلیکی است، ولی بازگشت به مدیر رمز مدیر را می‌خواهد؛ چون اگر نشست مدیر در همین مرورگر بماند،
     هر کس پشت این مرورگر بنشیند با یک کلیک مدیر می‌شود و قفل معاینات طب کار بی‌اثر می‌شود.
     true: هر دو جهت یک‌کلیکی (فقط روی دستگاه شخصیِ خودتان فعال کنید). */
  const SWITCH_BACK_WITHOUT_PASSWORD = false;
  const STORE_ALT = 'hse_auth_alt', SW_FLAG = 'hse_switched', SESSION_STORE = 'hse_session_id';
  const STRICT_MANAGER_PAGES = ['pollutants.html', 'my_work_report.html']; /* فقط خود مدیر؛ حتی نقش «کاربر» (هفت‌لنگی) دسترسی ندارد */
  const MANAGER_ONLY_LINKS = ['report.html', 'reward_eval.html', 'committee.html', 'weekly_verify.html', 'unit_report.html', 'evaluation.html', 'culture.html', 'indices.html', 'mgmt.html', 'procedures.html', 'obligations.html', 'action.html', 'sessions.html', 'security.html', 'objectives.html', 'occupational_disease.html', 'my_work_report.html']; // برای کارشناس از منوها پنهان می‌شود (obligations: تعهدات دوره‌ای فقط مدیر؛ صفحه‌اش هم data-roles="manager" دارد)
  /* فقط در صفحهٔ اصلی و فقط برای کارشناس پنهان می‌شود (صفحه‌ها بسته نمی‌شوند؛ لینک‌های داخلی سایر صفحه‌ها کار می‌کنند). فهرست را اینجا کم/زیاد کنید */
  const EXPERT_HOME_HIDDEN = []; /* پیمانکاران، لیست تلفن و کتابخانهٔ دستورالعمل دوباره برای کارشناس نمایش داده می‌شوند */
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
     اطلاعاتش در پرونده پرسنل و سوابق گذشته می‌ماند.
     HSEP.isActive(e)            → فعال بودن امروز (فهرست‌های جاری، انتخاب‌گرها، افراد پرخطر)
     HSEP.isActive(e, 'YYYY-MM-DD') → فعال بودن در بازه‌ای که از آن تاریخ شروع می‌شود (گزارش ماهانه/دوره‌ای) */
  window.HSEP = {
    isTerminated: e => !!(e && e.termination_date),
    isActive: (e, ref) => !e || !e.termination_date || String(e.termination_date).slice(0, 10) >= (ref || new Date().toISOString().slice(0, 10)),
    active: (list, ref) => (list || []).filter(e => window.HSEP.isActive(e, ref))
  };
  const A = window.HSEAuth = { EXPERTS, MANAGERS, ready, token, email: '', role: '', async logout() { try { await endCurrentSession(); } catch (_) {} localStorage.removeItem(STORE); localStorage.removeItem(STORE_ALT); localStorage.removeItem(SW_FLAG); localStorage.removeItem(SESSION_STORE); location.reload(); } };
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
    if (url.startsWith(SB + '/rest/')) noteSecurityRead(url, String((o && o.method) || (u && u.method) || 'GET').toUpperCase());
    if (url.startsWith(SB + '/rest/') || url.startsWith(SB + '/storage/') || url.startsWith(SB + '/functions/')) {
      await ready; const t = await token();
      if (t) { const h = new Headers((o && o.headers) || (u && u.headers) || {}); h.set('Authorization', 'Bearer ' + t); h.set('apikey', KEY);
        if (typeof Request !== 'undefined' && u instanceof Request) u = new Request(u, { headers: h }); else o = { ...(o || {}), headers: h }; }
    }
    if (PREVIEW && (url.startsWith(SB + '/rest/') || url.startsWith(SB + '/storage/') || url.startsWith(SB + '/functions/'))) {
      const method = String((o && o.method) || (u && u.method) || 'GET').toUpperCase();
      if (!['GET', 'HEAD'].includes(method)) return new Response(JSON.stringify({ error: 'Preview is read-only' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    return rawFetch(u, o);
  }

  // ===== Central session monitoring (requires hse_sessions.sql) =====
  const sessionDevice = () => {
    const ua = navigator.userAgent || '';
    const os = /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'دستگاه نامشخص';
    const browser = /Edg\//i.test(ua) ? 'Edge' : /Chrome\//i.test(ua) ? 'Chrome' : /Firefox\//i.test(ua) ? 'Firefox' : /Safari\//i.test(ua) ? 'Safari' : 'مرورگر نامشخص';
    return `${os} / ${browser}`;
  };
  const sessionId = () => { let id = localStorage.getItem(SESSION_STORE); if (!id) { id = crypto.randomUUID(); localStorage.setItem(SESSION_STORE, id); } return id; };
  async function sessionRequest(path, method, body) {
    const t = await token(); if (!t) return null;
    const r = await rawFetch(`${SB}/rest/v1/${path}`, { method: method || 'GET', headers: { apikey: KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) return null; return r.status === 204 ? true : r.json().catch(() => true);
  }
  async function startCurrentSession() {
    const s = load(); if (!s || !s.user || !s.user.email) return;
    const id = sessionId();
    const payload = { id, user_id: (await getAuthUserId()), email: s.user.email.toLowerCase(), device_label: sessionDevice(), user_agent: navigator.userAgent || '' };
    if (!payload.user_id) return;
    let existing = await sessionRequest(`hse_user_sessions?id=eq.${encodeURIComponent(id)}&select=id,user_id,email,revoked_at,ended_at`, 'GET');
    if (Array.isArray(existing) && existing.length && (existing[0].user_id !== payload.user_id || String(existing[0].email).toLowerCase() !== payload.email)) {
      localStorage.removeItem(SESSION_STORE); payload.id = sessionId();
      existing = await sessionRequest(`hse_user_sessions?id=eq.${encodeURIComponent(payload.id)}&select=id,user_id,email,revoked_at,ended_at`, 'GET');
    }
    if (Array.isArray(existing) && existing.length) {
      if (existing[0].revoked_at || existing[0].ended_at) { localStorage.removeItem(SESSION_STORE); wipe(); location.reload(); return; }
    } else {
      const t = await token();
      const created = await rawFetch(`${SB}/rest/v1/hse_user_sessions`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(payload) }).catch(() => null);
      if (!created || !created.ok) { localStorage.removeItem(SESSION_STORE); return; }
    }
    if (!window.__hseSessionTimer) window.__hseSessionTimer = setInterval(checkCurrentSession, 20000);
    checkCurrentSession();
  }
  async function getAuthUserId() {
    const t = await token(); if (!t) return null;
    const r = await rawFetch(`${SB}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${t}` } }).catch(() => null);
    if (!r || !r.ok) return null; const u = await r.json().catch(() => null); return u && u.id || null;
  }
  async function checkCurrentSession() {
    const id = localStorage.getItem(SESSION_STORE); if (!id || !load()) return;
    const rows = await sessionRequest(`hse_user_sessions?id=eq.${encodeURIComponent(id)}&select=id,revoked_at,ended_at`, 'GET');
    if (!Array.isArray(rows)) return;
    if (!rows.length || rows[0].revoked_at || rows[0].ended_at) {
      localStorage.removeItem(SESSION_STORE); wipe(); location.reload(); return;
    }
    await sessionRequest(`hse_user_sessions?id=eq.${encodeURIComponent(id)}`, 'PATCH', { last_seen_at: new Date().toISOString() });
  }
  async function endCurrentSession() {
    if (PREVIEW) return;
    const id = localStorage.getItem(SESSION_STORE); if (id) await sessionRequest('rpc/hse_end_my_session', 'POST', { p_session_id: id });
  }
  // ===== end session monitoring =====

  const roleOf = e => PREVIEW ? (MANAGERS.includes(e) ? 'manager' : null) : (MANAGERS.includes(e) ? 'manager' : EXPERTS[e] ? 'expert' : Object.keys(USERS).includes(e) ? 'user' : null);
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
    b.className = 'np'; b.id = 'hse-user'; b.innerHTML = `${esc(EXPERTS[A.email] || USERS[A.email] || A.email.split('@')[0])} · <a href="#" style="color:#2dd4bf">خروج</a>`;
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
    if (PREVIEW) {
      const notice = document.createElement('div');
      notice.id = 'hse-preview-notice';
      notice.className = 'np';
      notice.textContent = 'نسخهٔ آزمایشی · فقط مشاهده؛ ثبت و ویرایش اطلاعات غیرفعال است';
      notice.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99997;max-width:calc(100vw - 260px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:12px Vazirmatn,Tahoma,sans-serif;direction:rtl;background:#fff7ed;color:#9a3412;border:1px solid #fdba74;border-radius:999px;padding:5px 14px;box-shadow:0 2px 10px rgba(0,0,0,.12);pointer-events:none';
      document.body.appendChild(notice);
      const previewStyle = document.createElement('style');
      previewStyle.textContent = '@media(max-width:700px){#hse-preview-notice{top:48px!important;left:8px!important;right:8px!important;max-width:none!important;transform:none!important;text-align:center;font-size:11px!important}#hse-user{top:6px!important;left:8px!important}}@media print{#hse-preview-notice{display:none!important}}';
      document.head.appendChild(previewStyle);
    }
    /* لینک‌های دارای data-roles فقط برای نقش‌های مجاز نمایش داده می‌شوند. */
    const hideRoleLinks = () => document.querySelectorAll('a[data-roles]').forEach(a => {
      const allowed = (a.dataset.roles || '').split(',').map(x => x.trim()).filter(Boolean);
      a.style.display = allowed.includes(A.role) ? '' : 'none';
    });
    hideRoleLinks(); new MutationObserver(hideRoleLinks).observe(document.body, { childList: true, subtree: true });
    if (A.role !== 'manager' || A.viewAs) {
      const hideS = () => document.querySelectorAll(STRICT_MANAGER_PAGES.map(h => `a[href*="${h}"]`).join(',')).forEach(a => a.style.display = 'none');
      hideS(); new MutationObserver(hideS).observe(document.body, { childList: true, subtree: true });
    }
    if ((A.role !== 'manager' && A.role !== 'user') || A.viewAs) {
      const hide = () => document.querySelectorAll(MANAGER_ONLY_LINKS.map(h => `a[href*="${h}"]`).join(',')).forEach(a => a.style.display = 'none');
      hide(); new MutationObserver(hide).observe(document.body, { childList: true, subtree: true });
    }
    if (((A.role !== 'manager' && A.role !== 'user') || A.viewAs) && /(^|\/)(index\.html)?$/.test(location.pathname)) { /* صفحهٔ اصلیِ کارشناس: ماژول‌های غیرضروری و گروه‌های خالی پنهان */
      const hideHome = () => { EXPERT_HOME_HIDDEN.forEach(h => document.querySelectorAll('a.m[href*="' + h + '"]').forEach(a => a.style.display = 'none')); document.querySelectorAll('.grp').forEach(g => { const t = g.querySelectorAll('a.m'); if (t.length && [...t].every(a => a.style.display === 'none')) g.style.display = 'none'; }); };
      hideHome(); new MutationObserver(hideHome).observe(document.body, { childList: true, subtree: true });
    }
  }
  // ===== Security telemetry: ثبت فقط رویدادهای قابل مشاهده، نه ادعای تشخیص AI =====
  const securityCooldown = Object.create(null);
  let securityReads = [];
  async function securityEvent(type, details) {
    if (PREVIEW) return;
    try {
      if (!load() || !A.email) return;
      const now = Date.now(), key = type + '|' + String(details || '').slice(0,80);
      if (securityCooldown[key] && now - securityCooldown[key] < 30000) return;
      securityCooldown[key] = now;
      const t = await token(); if (!t) return;
      await rawFetch(SB + '/rest/v1/rpc/hse_log_security_event', {
        method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_event_type: type, p_details: String(details || '').slice(0,500) + ' | صفحه:' + location.pathname, p_device_label: sessionDevice(), p_user_agent: navigator.userAgent || '' })
      });
    } catch (_) {}
  }
  function securityWatch() {
    if (PREVIEW) return;
    if (window.__hseSecurityWatch) return; window.__hseSecurityWatch = true;
    const editable = t => !!(t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable));
    ['copy','cut','contextmenu','dragstart'].forEach(type => document.addEventListener(type, e => {
      if ((type === 'copy' || type === 'cut') && editable(e.target)) return;
      securityEvent(type === 'copy' ? 'copy_attempt' : type === 'cut' ? 'cut_attempt' : type === 'contextmenu' ? 'context_menu' : 'drag_attempt',
        'عنصر هدف: ' + (e.target && e.target.tagName || 'نامشخص'));
    }, true));
    document.addEventListener('keydown', e => {
      const k=(e.key||'').toLowerCase(), c=e.ctrlKey||e.metaKey;
      if (e.key==='F12' || (c && e.shiftKey && 'ijc'.includes(k)) || (c && 'usp'.includes(k)) || (e.metaKey && e.altKey && 'iuj'.includes(k)))
        securityEvent('devtools_shortcut','میانبر ابزار توسعه یا مشاهده منبع');
    }, true);
  }
  function noteSecurityRead(url, method) {
    if (method !== 'GET' || !url.startsWith(SB + '/rest/v1/') || /hse_(security_events|user_sessions)/.test(url)) return;
    const now=Date.now(); securityReads=securityReads.filter(t=>now-t<60000); securityReads.push(now);
    if (securityReads.length===80) securityEvent('high_read_volume','۸۰ درخواست خواندن داده در کمتر از ۶۰ ثانیه');
  }
  // ===== end security telemetry =====

  /* ===== محافظ نقش «کاربر»: جلوگیری از کپی/استخراج ساده‌ی کد (بازدارنده است، نه قفل مطلق؛ برنامه‌نویس با تلاش می‌تواند دور بزند) ===== */
  function guard() {
    const st = document.createElement('style');
    st.textContent = 'body{-webkit-user-select:none;user-select:none}input,textarea,select,[contenteditable]{-webkit-user-select:text;user-select:text}';
    document.head.appendChild(st);
    const ed = t => t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || (t && t.isContentEditable);
    const stop = e => { e.preventDefault(); e.stopPropagation(); return false; };
    document.addEventListener('contextmenu', stop, true);
    document.addEventListener('dragstart', stop, true);
    ['copy', 'cut'].forEach(n => document.addEventListener(n, e => { if (!ed(e.target)) stop(e); }, true));
    document.addEventListener('keydown', e => {
      const k = (e.key || '').toLowerCase(), c = e.ctrlKey || e.metaKey;
      if (e.key === 'F12' || (c && e.shiftKey && 'ijc'.includes(k)) || (c && 'usp'.includes(k) && k.length === 1) || (e.metaKey && e.altKey && 'iuj'.includes(k))) stop(e);
      else if (c && (k === 'a' || k === 'c' || k === 'x') && !ed(e.target)) stop(e);
    }, true);
  }

  /* ===== خروج خودکار پس از عدم فعالیت (برای وقتی که فراموش می‌کنید خروج بزنید) =====
     IDLE_MIN دقیقه بدون هیچ فعالیتی (کلیک/تایپ/لمس/اسکرول) → خروج کامل از حساب. بین تب‌ها مشترک است.
     اگر مرورگر بسته بماند و دوباره باز شود و زمان گذشته باشد، همان لحظه ورود لازم می‌شود. */
  const IDLE_MIN = 30, WARN_SEC = 60, ACT = 'hse_last_active';
  const lastAct = () => { try { return +localStorage.getItem(ACT) || 0; } catch (_) { return 0; } };
  const touch = () => { try { localStorage.setItem(ACT, String(Date.now())); } catch (_) { } };
  const wipe = () => { try { localStorage.removeItem(STORE); localStorage.removeItem(STORE_ALT); localStorage.removeItem(SW_FLAG); localStorage.removeItem(ACT); localStorage.removeItem(SESSION_STORE); } catch (_) { } };
  if (load() && lastAct() && Date.now() - lastAct() > IDLE_MIN * 60000) wipe(); /* ماندهٔ جلسهٔ قدیمی */
  function idleWatch() {
    touch(); let lastW = 0, bar = null;
    const bump = () => { const n = Date.now(); if (n - lastW > 5000) { lastW = n; if (!bar) touch(); } };
    ['click', 'keydown', 'mousemove', 'touchstart', 'scroll', 'wheel'].forEach(ev => window.addEventListener(ev, bump, { capture: true, passive: true }));
    setInterval(() => {
      if (!load()) { location.reload(); return; } /* در تب دیگر خروج زده شده */
      const left = IDLE_MIN * 60000 - (Date.now() - lastAct());
      if (left <= 0) { if (window.__hseEnding) return; window.__hseEnding = true; endCurrentSession().catch(() => { }).then(() => { wipe(); location.reload(); }); return; }
      if (left <= WARN_SEC * 1000) {
        if (!bar) {
          bar = document.createElement('div'); bar.className = 'np';
          bar.style.cssText = 'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:2147483000;background:#7c2d12;color:#fff;border-radius:12px;padding:10px 16px;font:14px Vazirmatn,Tahoma,sans-serif;direction:rtl;box-shadow:0 6px 24px rgba(0,0,0,.35)';
          bar.innerHTML = 'به‌دلیل عدم فعالیت، تا <b id="hse-idle-s"></b> ثانیه دیگر از حساب خارج می‌شوید. <a href="#" style="color:#fde68a;margin-right:10px">ادامه می‌دهم</a>';
          bar.querySelector('a').onclick = e => { e.preventDefault(); bar.remove(); bar = null; touch(); };
          document.body.appendChild(bar);
        }
        const sp = bar.querySelector('#hse-idle-s'); if (sp) sp.textContent = Math.ceil(left / 1000);
      } else if (bar) { bar.remove(); bar = null; }
    }, 1000);
  }

  async function init() {
    const s = load(); if (!s) return loginUI();
    if (!(await token())) return loginUI('نشست شما منقضی شده است');
    const email = (load().user.email || '').toLowerCase(), role = roleOf(email);
    if (!role) return deny(email, 'این ایمیل برای نرم‌افزار تعریف نشده است');
    const page = location.pathname.split('/').filter(Boolean).pop() || 'index.html';
    if (STRICT_MANAGER_PAGES.some(p => location.pathname.endsWith('/' + p) || location.pathname === '/' + p) && role !== 'manager') return deny(email, 'این بخش فقط برای مدیر HSE است');
    if (PAGE_ROLES && !PAGE_ROLES.includes(role) && !(role === 'user' && PAGE_ROLES.includes('manager'))) return deny(email, 'دسترسی به این صفحه برای شما مجاز نیست');
    A.email = email; A.role = role; A.viewAs = false; securityWatch(); if (!PREVIEW) await startCurrentSession(); if (role === 'user') guard(); if (!PREVIEW) idleWatch(); try { localStorage.removeItem('hse_view_as'); } catch (_) { } /* «نمای کارشناس» قدیمی جایش را به سوییچ واقعی حساب داد */ done(); chrome();
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

  /* امضای طراح: روی همهٔ صفحه‌ها (و صفحهٔ ورود) دیده می‌شود */
  function credit() {
    if (document.getElementById('hse-credit')) return;
    const c = document.createElement('div'); c.id = 'hse-credit';
    c.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:99998;font:12px Vazirmatn,Tahoma,sans-serif;direction:rtl;background:rgba(15,23,42,.88);color:#cbd5e1;border:1px solid rgba(45,212,191,.45);border-radius:999px;padding:5px 12px;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.25)';
    c.innerHTML = 'طراح و سازنده نرم‌افزار: <b style="color:#2dd4bf">محمد الله رضایی</b>';
    const st = document.createElement('style'); st.textContent = '@media(max-width:700px){#hse-credit{bottom:72px!important;font-size:11px!important}}'; document.head.appendChild(st);
    document.body.appendChild(c);
  }
  if (document.body) credit(); else document.addEventListener('DOMContentLoaded', credit);

  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
