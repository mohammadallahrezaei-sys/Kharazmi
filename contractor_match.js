/* تطبیق نرم نام پیمانکار در چک‌لیست با «ثبت ورود پیمانکار»
   مشکل قبلی: location.includes(نام کامل) ← اگر در چک‌لیست فقط فامیلی/نام کوتاه نوشته شده بود، «عدم تکمیل» می‌خورد.
   HSECtr.match(locText, contractor, pool) → true اگر آن چک‌لیست متعلق به این پیمانکار باشد.
     contractor: {name, contact_name?}   pool: پیمانکاران حاضر در همان روز (برای جلوگیری از اختصاص یک چک‌لیست به پیمانکار اشتباه)
   امتیاز: ۳ = نام کامل داخل متن · ۲ = متن کوتاه‌تر داخل نام / همهٔ کلمات متن در نام یا نام رابط · ۱ = فقط یک کلمهٔ مشترک (فقط اگر یکتا باشد) */
(function () {
  'use strict';
  const STOP = new Set(['شرکت', 'مهندسی', 'پیمانکار', 'پیمانکاری', 'گروه', 'صنعتی', 'صنایع', 'بازرگانی', 'تولیدی', 'خدماتی', 'فنی', 'ساختمانی', 'عمرانی', 'سهامی', 'خاص', 'عام', 'مسئولیت', 'محدود', 'آقای', 'خانم', 'جناب', 'سرکار', 'مهندس', 'دکتر', 'استاد', 'کارگاه', 'واحد', 'نفر', 'نفرات', 'کار', 'کارخانه', 'روز', 'چک', 'لیست', 'چکلیست', 'قرارداد', 'شماره', 'با', 'از', 'در', 'به', 'برای', 'و']);
  const DIG = '۰۱۲۳۴۵۶۷۸۹', ADIG = '٠١٢٣٤٥٦٧٨٩';
  const norm = s => String(s == null ? '' : s).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه')
    .replace(/[۰-۹]/g, d => DIG.indexOf(d)).replace(/[٠-٩]/g, d => ADIG.indexOf(d))
    .replace(/[\u200c\u200d\u200e\u200f\u064b-\u065f]/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
  const compact = s => norm(s).replace(/ /g, '');
  const toks = s => norm(s).split(' ').filter(w => w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w));
  const cache = new Map();
  const prep = s => { let p = cache.get(s); if (!p) { p = { c: compact(s), t: toks(s) }; if (cache.size > 5000) cache.clear(); cache.set(s, p); } return p; };

  function score(loc, c) {
    const L = prep(loc || ''), N = prep(c.name || ''), K = prep(c.contact_name || '');
    if (!L.c || !L.t.length) return 0; // متنِ فقط کلمات عمومی (مثل «شرکت») هرگز تطبیق نمی‌خورد
    if (N.c.length >= 3 && L.c.includes(N.c)) return 3;
    if (L.c.length >= 3 && N.c.length > L.c.length && N.c.includes(L.c)) return 2;
    if (K.c.length >= 4 && (L.c.includes(K.c) || (L.c.length >= 3 && K.c.includes(L.c)))) return 2;
    if (L.t.length) {
      if (L.t.every(w => N.t.includes(w))) return 2;
      if (K.t.length && L.t.every(w => K.t.includes(w))) return 2;
      if (L.t.some(w => w.length >= 3 && (N.t.includes(w) || K.t.includes(w)))) return 1;
    }
    return 0;
  }
  function match(loc, c, pool) {
    if (!c) return false;
    const P = (pool && pool.length ? pool : []).slice(); if (!P.includes(c)) P.push(c);
    const mine = score(loc, c); if (!mine) return false;
    const best = Math.max(...P.map(o => score(loc, o)));
    if (mine < best) return false;
    if (best >= 2) return true;
    return P.filter(o => score(loc, o) === 1).length === 1; // تطبیق ضعیف فقط وقتی یکتاست
  }
  window.HSECtr = { match, score, norm, toks };
})();
