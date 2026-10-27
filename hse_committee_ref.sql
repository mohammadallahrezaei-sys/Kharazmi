-- شناسهٔ منبع بندهای پیشنهادی (برای جلوگیری از تکرار یک عدم‌انطباق/آموزش در چند صورتجلسه)
alter table public.committee_items add column if not exists ref text;
notify pgrst, 'reload schema';
