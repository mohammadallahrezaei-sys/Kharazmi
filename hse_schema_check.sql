-- بررسی/تکمیل ستون‌های مورد استفادهٔ برنامه (امن و تکراری‌قابل‌اجرا: ستونِ موجود دست نمی‌خورد)
-- اگر قبلاً این ستون‌ها را ساخته‌اید هیچ اتفاقی نمی‌افتد؛ اگر نه، خطاهای «ستون وجود ندارد» برطرف می‌شود.
alter table if exists public.findings add column if not exists notice_code text;
alter table if exists public.findings add column if not exists notice_at timestamptz;
alter table if exists public.findings add column if not exists root_cause text;
alter table if exists public.clinic_incidents add column if not exists corrective_action text;
alter table if exists public.clinic_incidents add column if not exists action_status text;
alter table if exists public.clinic_incidents add column if not exists action_due_date date;
alter table if exists public.equipment add column if not exists requires_inspection boolean default true;
alter table if exists public.hse_cards add column if not exists received_date date;
alter table if exists public.hse_cards add column if not exists reg_no text;
alter table if exists public.chemicals add column if not exists review_note text;
notify pgrst, 'reload schema';
