/* نوار مشترک «مرکز اقدامات و پیگیری»: همه صفحه‌های مرکز یک نوار و یک ترتیب دارند. */
(function(){
 'use strict';
 var TABS=[
  ['action.html','🎯','مرکز اقدام','نمای مدیریتی؛ شدت، تشدید و صف کاری'],
  ['action-register.html','🧭','فهرست یکپارچه','همه اقدامات مستقل با فیلتر منبع، واحد و مسئول'],
  ['due.html','⏳','رادار سررسیدها','سررسید همه ماژول‌ها روی یک خط زمانی'],
  ['calendar.html','📅','تقویم','نمای ماهانه موعدها'],
  ['mgmt.html','📊','گزارش جامع','گزارش مدیریتی و اقدامات اصلاحی مشترک']
 ];
 var cur=(location.pathname.split('/').pop()||'').toLowerCase();
 function css(){
  if(document.getElementById('center-tabs-css'))return;
  var s=document.createElement('style');s.id='center-tabs-css';
  s.textContent='.center-tabs{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;margin:10px 0 14px;padding:6px;background:var(--card,#fff);border:1px solid var(--bd,#e2e8f0);border-radius:12px;scrollbar-width:thin}'+
  '.center-tabs a{flex:1 1 0;min-width:max-content;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:38px;padding:6px 12px;border-radius:9px;border:1px solid transparent;color:var(--tx,#0f172a);text-decoration:none;font-size:13px;white-space:nowrap}'+
  '.center-tabs a:hover{border-color:var(--ac,#0f766e);color:var(--ac,#0f766e)}'+
  '.center-tabs a[aria-current="page"]{background:var(--ac,#0f766e);color:var(--acx,#fff);font-weight:700}'+
  '.center-kpi{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}'+
  '.center-kpi div{flex:1 1 130px;background:var(--card,#fff);border:1px solid var(--bd,#e2e8f0);border-radius:10px;padding:8px 12px;font-size:12px;color:var(--mu,#64748b)}'+
  '.center-kpi b{display:block;font-size:22px;color:var(--tx,#0f172a);line-height:1.3}'+
  '.center-kpi .bad b{color:var(--bad,#dc2626)}.center-kpi .wa b{color:var(--wa,#d97706)}'+
  '.center-kpi small{display:block;font-size:11px;margin-top:2px}'+
  '@media print{.center-tabs,.center-kpi{display:none!important}}';
  document.head.appendChild(s);
 }
 function build(){
  var n=document.createElement('nav');n.className='center-tabs';n.setAttribute('aria-label','مرکز اقدامات و پیگیری');
  TABS.forEach(function(t){var a=document.createElement('a');a.href=t[0];a.title=t[3];a.textContent=t[1]+' '+t[2];if(t[0]===cur)a.setAttribute('aria-current','page');n.appendChild(a)});
  return n;
 }
 function mount(){
  if(document.querySelector('.center-tabs'))return;
  css();
  var old=[].slice.call(document.querySelectorAll('.hse-workflow-nav'));
  var legacy=document.querySelector('nav.nav');
  var bar=build(),host=old[0]||legacy;
  if(host&&host.parentNode){host.parentNode.insertBefore(bar,host)}
  else{var w=document.querySelector('.w,main');if(!w)return;var h=w.querySelector('h1');if(h&&h.parentNode===w)w.insertBefore(bar,h.nextSibling);else w.insertBefore(bar,w.firstChild)}
  old.forEach(function(e){e.remove()});if(legacy&&legacy.parentNode)legacy.remove();
 }
/* شمارش واحد از نمای hse_actions_v (یک تعریف برای معوق/بدون موعد/بدون مسئول در همه‌ی صفحه‌های مرکز).
    اگر نما در پایگاه داده نبود یا دسترسی نداشت، چیزی نمایش داده نمی‌شود و صفحه مثل قبل کار می‌کند. */
 var fa=function(n){return String(n).replace(/\d/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'[d]})};
 function kpi(){
  var G=window.HSE&&typeof HSE.getAll==='function'?HSE.getAll.bind(HSE):window.HSEDB&&typeof HSEDB.getAll==='function'?HSEDB.getAll.bind(HSEDB):null;
  var bar=document.querySelector('.center-tabs');if(!G||!bar||document.querySelector('.center-kpi'))return;
  Promise.resolve(G('hse_actions_v?select=source,is_overdue,no_due,no_owner')).then(function(rows){
   if(!Array.isArray(rows))return;
   var late=0,nd=0,no=0;rows.forEach(function(r){if(r.is_overdue)late++;if(r.no_due)nd++;if(r.no_owner)no++});
   var d=document.createElement('div');d.className='center-kpi';d.setAttribute('aria-label','شمارش واحد اقدامات');
   [['کل اقدامات فعال',rows.length,'','همه‌ی منابع'],['معوق',late,late?'bad':'','موعد گذشته'],['بدون موعد',nd,nd?'wa':'',''],['بدون مسئول',no,no?'wa':'','']].forEach(function(k){var e=document.createElement('div');e.className=k[2];e.innerHTML='<b>'+fa(k[1])+'</b>'+k[0]+(k[3]?'<small>'+k[3]+'</small>':'');d.appendChild(e)});
   bar.parentNode.insertBefore(d,bar.nextSibling)}).catch(function(){})
 }
 function start(){mount();setTimeout(kpi,0);var t=0,iv=setInterval(function(){if(document.querySelector('.center-kpi')||++t>20){clearInterval(iv);return}kpi()},500)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
