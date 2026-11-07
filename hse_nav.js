/* ناوبری مشترک HSE:
     • موبایل/تبلت (<۱۰۲۴px): نوار پایین صفحه: خانه · میز کار · تقویم · بازگشت
     • دسکتاپ (≥۱۰۲۴px): ریل ثابت کنار صفحه مثل صفحه‌ی اصلی؛ فهرست ماژول‌ها از خودِ index.html خوانده می‌شود
       (منبع یکتا: ماژول تازه فقط در index.html اضافه شود)، در همان نشست ذخیره می‌شود، و می‌شود آن را جمع کرد.
       لینک‌های مخصوص مدیر را auth.js با href پنهان می‌کند؛ ریل هم همان لینک‌هاست، پس برای کارشناس پنهان است.
   استفاده: در <head> هر صفحه، بعد از auth.js:  <script src="hse_nav.js" defer></script>
   خاموش‌کردن در یک صفحه:  <script src="hse_nav.js" data-nav="off" defer></script>
   خودکار نمایش داده نمی‌شود: داخل iframe (مثل تقویمِ «کارهای من»)، با ?embed=1، و موقع چاپ. */
(function () {
  'use strict';
  var SCR = document.currentScript;
  if (SCR && SCR.dataset.nav === 'off') return;
  try { if (window.top !== window.self) return; } catch (e) { return; }
  if (/[?&]embed=1/.test(location.search) || document.getElementById('hse-nav')) return;

  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var ITEMS = [
    { href: 'index.html', ico: '🏠', t: 'خانه' },
    { href: 'desk.html', ico: '🧭', t: 'میز کار' },
    { href: 'calendar.html', ico: '📅', t: 'تقویم' }
  ];

  /* بازگشت: اگر از صفحه‌ی دیگرِ همین نرم‌افزار آمده‌ایم همان صفحه‌ی قبلی، وگرنه خانه */
  function goBack() {
    var internal = false;
    try { internal = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { }
    if (internal && history.length > 1) history.back(); else location.href = 'index.html';
  }

  var css = document.createElement('style');
  css.textContent =
    '#hse-nav{position:fixed;inset-inline:0;bottom:0;z-index:40;display:flex;justify-content:center;pointer-events:none;' +
      'padding:0 8px calc(8px + env(safe-area-inset-bottom,0px));font-family:Vazirmatn,Tahoma,sans-serif;direction:rtl;transition:transform .2s}' +
    '#hse-nav .hn{pointer-events:auto;display:flex;gap:4px;width:100%;max-width:480px;padding:4px;border-radius:16px;' +
      'background:var(--card,#fff);border:1px solid var(--bd,#e2e8f0);box-shadow:0 6px 20px rgba(15,23,42,.18)}' +
    '#hse-nav a,#hse-nav button{flex:1;min-width:0;min-height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;' +
      'border:0;border-radius:12px;background:transparent;color:var(--mu,#64748b);font:inherit;font-size:11.5px;line-height:1.5;text-decoration:none;cursor:pointer}' +
    '#hse-nav i{font-style:normal;font-size:18px;line-height:1.2}' +
    '#hse-nav a:hover,#hse-nav button:hover{background:var(--soft,#f8fafc)}' +
    '#hse-nav a[aria-current="page"]{background:var(--ac,#0f766e);color:var(--acx,#fff);font-weight:700}' +
    '#hse-nav a:focus-visible,#hse-nav button:focus-visible{outline:2px solid var(--ac,#0f766e);outline-offset:1px}' +
    'body.hse-nav-on{padding-bottom:calc(72px + env(safe-area-inset-bottom,0px))!important}' +
    'body.hse-nav-on #toast{bottom:84px!important}' +
    /* وقتی کیبورد موبایل باز است (فیلد در حال تایپ) نوار کنار می‌رود تا روی فیلد نیفتد */
    '#hse-nav.kb{transform:translateY(120%)}' +

    ':root{--hr-w:264px}html.hse-rail-min{--hr-w:68px}#hse-rail{display:none}' +
    '@media (min-width:1024px){' +
      'html.hse-rail-on{padding-inline-start:var(--hr-w)}html.hse-rail-on #hse-nav{display:none!important}' +
      'html.hse-rail-on body.hse-nav-on{padding-bottom:0!important}html.hse-rail-on body.hse-nav-on #toast{bottom:20px!important}' +
      'html.hse-rail-on .w{max-width:1180px}html.hse-rail-on body[class*="max-w-"],html.hse-rail-on body[style*="max-width"]{max-width:1180px!important}' +
      '#hse-rail{display:flex;flex-direction:column;position:fixed;top:0;bottom:0;inset-inline-start:0;width:var(--hr-w);z-index:40;background:#141e28;color:#d3dce5;' +
        'font-family:Vazirmatn,Tahoma,sans-serif;direction:rtl;overflow:hidden;transition:width .15s}' +
      '#hse-rail a{color:inherit;text-decoration:none}#hse-rail a:focus-visible,#hse-rail button:focus-visible{outline:2px solid #2cc4b3;outline-offset:-2px}' +
      '#hse-rail .hr-brand{display:flex;align-items:center;gap:10px;min-height:64px;padding:12px;border-bottom:1px solid #2b3b4b;color:#fff}' +
      '#hse-rail .hr-plate{flex:none;background:#fff;border-radius:6px;padding:4px 6px;line-height:0}#hse-rail .hr-plate img{height:26px;width:auto;display:block}' +
      '#hse-rail .hr-brand b{display:block;font-size:13.5px;line-height:1.5}#hse-rail .hr-brand small{display:block;font-size:11px;line-height:1.4;color:#8193a5}' +
      '#hse-rail .hr-nav{flex:1;overflow-y:auto;padding:4px 0 12px;scrollbar-width:thin;scrollbar-color:#2b3b4b transparent}' +
      '#hse-rail .hr-g{padding:14px 16px 5px;font-size:11.5px;font-weight:600;line-height:1.5;color:#8193a5}' +
      '#hse-rail .hr-i{display:flex;align-items:center;gap:10px;min-height:36px;margin:1px 8px;padding:4px 8px;border-radius:6px;font-size:13px;line-height:1.4;border-inline-start:3px solid transparent}' +
      '#hse-rail .hr-i:hover{background:#1c2935}#hse-rail .hr-i[aria-current="page"]{background:#1c2935;border-inline-start-color:#2cc4b3;color:#fff;font-weight:700}' +
      '#hse-rail .hr-im{flex:none;width:26px;height:26px;border-radius:6px;overflow:hidden;display:block}' +
      '#hse-rail .hr-im .im{display:block;width:100%;height:100%;background:var(--g);border-radius:6px}#hse-rail .hr-im svg{display:block;width:100%;height:100%}' +
      '#hse-rail .hr-pin .hr-im{display:flex;align-items:center;justify-content:center;background:#2b3b4b}#hse-rail .hr-pin .hr-im svg{width:16px;height:16px;fill:none;stroke:#d3dce5;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
      '#hse-rail .hr-t{flex:1;min-width:0}' +
      '#hse-rail .hr-tog{display:flex;align-items:center;justify-content:center;gap:6px;border:0;border-top:1px solid #2b3b4b;background:transparent;color:#8193a5;padding:10px;cursor:pointer;font:inherit;font-size:12px}#hse-rail .hr-tog:hover{background:#1c2935;color:#fff}' +
      'html.hse-rail-min #hse-rail .hr-t,html.hse-rail-min #hse-rail .hr-brand>div,html.hse-rail-min #hse-rail .hr-g span,html.hse-rail-min #hse-rail .hr-tog span{display:none}' +
      'html.hse-rail-min #hse-rail .hr-brand{justify-content:center;padding:12px 6px}html.hse-rail-min #hse-rail .hr-i{justify-content:center;margin:1px 6px;padding:4px}' +
      'html.hse-rail-min #hse-rail .hr-g{height:1px;margin:8px 14px;padding:0;background:#2b3b4b}' +
    '}' +
    '@media (prefers-color-scheme:dark){#hse-rail{background:#0a1016}}' +
    '@media print{#hse-rail{display:none!important}html.hse-rail-on{padding-inline-start:0!important}}' +
    '@media print{#hse-nav{display:none!important}body.hse-nav-on{padding-bottom:0!important}}';
  document.head.appendChild(css);

  function build() {
    if (!document.body || document.getElementById('hse-nav')) return;
    var nav = document.createElement('nav');
    nav.id = 'hse-nav'; nav.className = 'np'; nav.setAttribute('aria-label', 'ناوبری اصلی');
    var box = document.createElement('div'); box.className = 'hn';

    var back = document.createElement('button');
    back.type = 'button'; back.setAttribute('aria-label', 'بازگشت به صفحه قبل');
    back.innerHTML = '<i aria-hidden="true">→</i>بازگشت';
    back.onclick = goBack;
    box.appendChild(back);

    ITEMS.forEach(function (it) {
      var a = document.createElement('a');
      a.href = it.href; a.innerHTML = '<i aria-hidden="true">' + it.ico + '</i>' + it.t;
      if (it.href === page) a.setAttribute('aria-current', 'page');
      box.appendChild(a);
    });
    nav.appendChild(box); document.body.appendChild(nav);
    document.body.classList.add('hse-nav-on');

    var isField = function (el) { return el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/^(checkbox|radio|button|submit|file|range|color)$/.test(el.type || ''); };
    document.addEventListener('focusin', function (e) { if (isField(e.target)) nav.classList.add('kb'); });
    document.addEventListener('focusout', function () { setTimeout(function () { if (!isField(document.activeElement)) nav.classList.remove('kb'); }, 150); });
  }

  /* ================= ریل دسکتاپ ================= */
  var RAIL_KEY = 'hse_rail_v1', MIN_KEY = 'hse_rail_min', railBuilt = false;
  var SV = function (p) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>'; };
  var PIN = [
    { h: 'index.html', t: 'نمای کلی', s: SV('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>') },
    { h: 'desk.html', t: 'میز کار', s: SV('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>') },
    { h: 'calendar.html', t: 'تقویم', s: SV('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>') }
  ];
  var base = function (h) { return String(h || '').split(/[?#]/)[0].toLowerCase(); };

  /* فهرست ماژول‌ها از index.html (گروه‌ها، نام‌ها و تصویر هر ماژول) */
  function railModel(cb) {
    var c = null; try { c = JSON.parse(sessionStorage.getItem(RAIL_KEY) || 'null'); } catch (e) { }
    if (c && c.length) return cb(c);
    fetch('index.html', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : Promise.reject(); }).then(function (txt) {
      var d = new DOMParser().parseFromString(txt, 'text/html'), out = [];
      d.querySelectorAll('.grp').forEach(function (g) {
        var tt = g.querySelector('h2,summary'), items = [];
        g.querySelectorAll('.tiles a.m').forEach(function (a) {
          var im = a.querySelector('.im'), b = a.querySelector('b');
          if (a.getAttribute('href')) items.push({ h: a.getAttribute('href'), n: b ? b.textContent.trim() : '', a: im ? im.outerHTML : '' });
        });
        if (items.length) out.push({ t: tt ? tt.textContent.replace(/\s+/g, ' ').trim() : '', i: items });
      });
      if (!out.length) return;
      try { sessionStorage.setItem(RAIL_KEY, JSON.stringify(out)); } catch (e) { }
      cb(out);
    }).catch(function () { /* بدون ریل؛ نوار پایین همچنان هست */ });
  }

  function item(href, name, art, pin) {
    var a = document.createElement('a'); a.className = 'hr-i'; a.href = href; a.title = name;
    var im = document.createElement('span'); im.className = 'hr-im'; im.innerHTML = art;
    var t = document.createElement('span'); t.className = 'hr-t'; t.textContent = name;
    a.appendChild(im); a.appendChild(t);
    if (base(href) === page) a.setAttribute('aria-current', 'page');
    return a;
  }

  function buildRail(model) {
    if (railBuilt || !document.body || document.getElementById('hse-rail')) return;
    railBuilt = true;
    var r = document.createElement('aside'); r.id = 'hse-rail'; r.className = 'np'; r.setAttribute('aria-label', 'ناوبری اصلی');
    var br = document.createElement('a'); br.className = 'hr-brand'; br.href = 'index.html'; br.title = 'صفحه اصلی';
    br.innerHTML = '<span class="hr-plate"><img src="logo-sm.png" alt=""></span><div><b>نرم‌افزار جامع HSE</b><small>گسترش فناوری خوارزمی</small></div>';
    br.querySelector('img').onerror = function () { this.style.display = 'none'; };
    r.appendChild(br);
    var nav = document.createElement('nav'); nav.className = 'hr-nav'; r.appendChild(nav);
    var pin = document.createElement('div'); pin.className = 'hr-pin';
    PIN.forEach(function (p) { pin.appendChild(item(p.h, p.t, p.s)); }); nav.appendChild(pin);
    model.forEach(function (g) {
      var w = document.createElement('div'); w.className = 'hr-grp';
      var h = document.createElement('div'); h.className = 'hr-g'; h.innerHTML = '<span></span>'; h.firstChild.textContent = g.t; w.appendChild(h);
      g.i.forEach(function (m) { w.appendChild(item(m.h, m.n, m.a)); }); nav.appendChild(w);
    });
    var tog = document.createElement('button'); tog.type = 'button'; tog.className = 'hr-tog';
    var root = document.documentElement, paint = function () { var m = root.classList.contains('hse-rail-min'); tog.innerHTML = '<i style="font-style:normal">' + (m ? '»' : '«') + '</i><span>جمع کردن منو</span>'; tog.setAttribute('aria-label', m ? 'باز کردن منو' : 'جمع کردن منو'); };
    try { if (localStorage.getItem(MIN_KEY) === '1') root.classList.add('hse-rail-min'); } catch (e) { }
    tog.onclick = function () { var m = root.classList.toggle('hse-rail-min'); try { localStorage.setItem(MIN_KEY, m ? '1' : '0'); } catch (e) { } paint(); };
    paint(); r.appendChild(tog);
    document.body.appendChild(r); root.classList.add('hse-rail-on');
    /* گروهی که همهٔ لینک‌هایش برای این نقش پنهان شده، پنهان شود */
    var sync = function () { r.querySelectorAll('.hr-grp').forEach(function (g) { var any = [].some.call(g.querySelectorAll('a.hr-i'), function (a) { return a.style.display !== 'none'; }); g.style.display = any ? '' : 'none'; }); };
    new MutationObserver(sync).observe(r, { attributes: true, attributeFilter: ['style'], subtree: true });
    [0, 400, 1500, 3500].forEach(function (t) { setTimeout(sync, t); });
    var cur = r.querySelector('[aria-current]'); if (cur) nav.scrollTop = Math.max(0, cur.offsetTop - nav.clientHeight / 2);
  }

  var MQ = window.matchMedia ? window.matchMedia('(min-width:1024px)') : null;
  function maybeRail() { if (MQ && MQ.matches && !railBuilt) railModel(buildRail); }
  function startRail() { maybeRail(); if (MQ) { if (MQ.addEventListener) MQ.addEventListener('change', maybeRail); else if (MQ.addListener) MQ.addListener(maybeRail); } }
  var go = function () { build(); startRail(); };
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
})();
