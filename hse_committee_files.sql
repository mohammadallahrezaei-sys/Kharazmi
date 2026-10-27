-- فایل‌های همراه هر جلسهٔ کمیته (اصل صورتجلسه، اسکن)
alter table public.committee_meetings add column if not exists files jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';
