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
  '@media print{.center-tabs{display:none!important}}';
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
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
