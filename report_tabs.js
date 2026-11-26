(function(){
"use strict";
const current=(location.pathname.split("/").pop()||"").toLowerCase();
// در گزارش جامعِ توکار، نوار مسیر داخل قاب تکرار می‌شود؛ فقط در صفحه مستقل نمایش داده شود.
if(window.self!==window.top)return;
const pages=["mgmt.html","report.html","unit_report.html","indices.html","evaluation.html","reward_eval.html","unit_eval.html","culture.html","committee.html","objectives.html"];
if(!pages.includes(current))return;
function mount(){
 if(document.querySelector(".rtabs"))return;
 const style=document.createElement("style");
 style.textContent=".rtabs{display:flex;flex-wrap:wrap;gap:6px;align-items:center;max-width:1000px;margin:24px auto 0;padding:6px 12px;font:12px inherit}.rtabs a{padding:5px 13px;border:1px solid var(--bd,#e2e8f0);border-radius:999px;background:var(--card,#fff);color:var(--ac,#0f766e);text-decoration:none}.rtabs a[aria-current]{background:var(--ac,#0f766e);color:#fff;border-color:var(--ac,#0f766e);font-weight:700}@media print{.rtabs{display:none!important}}";
 document.head.appendChild(style);
 const nav=document.createElement("nav");nav.className="rtabs";nav.setAttribute("aria-label","مسیرهای اصلی HSE");
 nav.innerHTML='<a href="comprehensive-report.html">📊 گزارش جامع</a><a href="action.html">🎯 مرکز پیگیری</a><a href="index.html">🏠 خانه</a>';
 document.body.insertBefore(nav,document.body.firstChild);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
})();