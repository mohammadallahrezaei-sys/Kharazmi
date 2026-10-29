/* چرخهٔ پیگیری عدم‌انطباق‌ها: روزهای ۱ و ۱۵ هر ماه شمسی (توابع خالص، بدون وابستگی) */
(function(){
const p=n=>String(n).padStart(2,'0');
function g2j(gy,gm,gd){const t=[0,31,59,90,120,151,181,212,243,273,304,334],g2=gm>2?gy+1:gy;let days=355666+365*gy+Math.floor((g2+3)/4)-Math.floor((g2+99)/100)+Math.floor((g2+399)/400)+gd+t[gm-1],jy=-1595+33*Math.floor(days/12053);days%=12053;jy+=4*Math.floor(days/1461);days%=1461;if(days>365){jy+=Math.floor((days-1)/365);days=(days-1)%365}
  return[jy,days<186?1+Math.floor(days/31):7+Math.floor((days-186)/30),1+(days<186?days%31:(days-186)%30)]}
function j2g(jy,jm,jd){jy+=1595;let days=-355668+365*jy+Math.floor(jy/33)*8+Math.floor(((jy%33)+3)/4)+jd+(jm<7?(jm-1)*31:((jm-7)*30)+186),gy=400*Math.floor(days/146097);days%=146097;if(days>36524){gy+=100*Math.floor(--days/36524);days%=36524;if(days>=365)days++}gy+=4*Math.floor(days/1461);days%=1461;if(days>365){gy+=Math.floor((days-1)/365);days=(days-1)%365}
  let gd=days+1;const s=[0,31,(gy%4==0&&gy%100!=0)||gy%400==0?29:28,31,30,31,30,31,31,30,31,30,31];let gm=0;for(;gm<13&&gd>s[gm];gm++)gd-=s[gm];return[gy,gm,gd]}
const addDays=(iso,n)=>new Date(new Date(iso+'T12:00:00Z').getTime()+n*864e5).toISOString().slice(0,10);
const toJ=iso=>{const [y,m,d]=iso.slice(0,10).split('-').map(Number);return g2j(y,m,d)};
const jToIso=(y,m,d)=>{const g=j2g(y,m,d);return g[0]+'-'+p(g[1])+'-'+p(g[2])};
/* اولین روز چرخه (۱ یا ۱۵ شمسی) که کاملاً بعد از تاریخ داده‌شده است */
function next(iso){const [y,m,d]=toJ(iso);if(d<15)return jToIso(y,m,15);return m===12?jToIso(y+1,1,1):jToIso(y,m+1,1)}
/* موعد پیش‌فرض پیگیری برای عدم‌انطباقِ بدون پیگیری: اولین روز چرخه، حداقل ۳ روز بعد از ثبت */
const defDue=created=>next(addDays(String(created).slice(0,10),2));
const fx=s=>String(s||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
function parseJ(s){const m=/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/.exec(fx(s).trim());if(!m)return'';const y=+m[1],mo=+m[2],d=+m[3];if(y<1300||mo<1||mo>12||d<1||d>31)return'';return jToIso(y,mo,d)}
const fmtJ=iso=>{if(!iso)return'';const [y,m,d]=toJ(iso);return y+'/'+p(m)+'/'+p(d)};
window.HSEC={next,defDue,addDays,toJ,jToIso,parseJ,fmtJ,isCycleDay:iso=>{const d=toJ(iso)[2];return d===1||d===15}};
})();
