/* نوار ناوبری مشترک HSE (پایین صفحه): خانه · میز کار · تقویم · بازگشت
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
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
