# سامانهٔ جامع HSE — شرکت گسترش فناوری خوارزمی

صفحات ایستا (HTML/JS) + Supabase. ورود با ایمیل؛ نقش مدیر و کارشناس در `auth.js` تعریف شده است.

## فایل‌های SQL (یک‌بار در Supabase → SQL Editor؛ همه تکراری‌قابل‌اجرا هستند)
`hse_schema_check.sql` را اول اجرا کنید (ستون‌های کم را می‌سازد)، سپس هر فایل `hse_*.sql` که هنوز اجرا نکرده‌اید:
indexes · findings_cancel · findings_missed · findings_closed_dates · finding_followups و finding_followups2 · inspections_equipment · equipment_inactive · employee_termination · incident_edit · incident_review · ekhtar_missed · weekly_verify · contractors · worklog · committee* · phonebook · cards_health · unit_obs · **obligations** (تعهدات دوره‌ای).

## قواعد فنی
- خواندن جدول‌های بزرگ فقط با `HSEDB.getAll(...)` (سقف ۱۰۰۰ ردیف Supabase را دور می‌زند). `limit=` بزرگ‌تر از ۱۰۰۰ بی‌اثر است.
- تاریخ «امروز» همیشه با `HSEToday()` (وقت تهران) گرفته شود؛ `new Date().toISOString()` بین ۰۰:۰۰ تا ۰۳:۳۰ بامداد تاریخ دیروز می‌دهد.
- چرخهٔ پیگیری عدم‌انطباق: `cycle.js` (۱ و ۱۵ شمسی).
