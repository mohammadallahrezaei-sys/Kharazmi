-- قطع همکاری پرسنل (بانک پرسنل) — یک بار در Supabase > SQL Editor اجرا شود
alter table public.employees add column if not exists termination_date date;
alter table public.employees add column if not exists termination_reason text;
create index if not exists employees_termination_idx on public.employees (termination_date);

-- اگر هنگام ثبت قطع همکاری پیام «هیچ ردیفی به‌روزرسانی نشد» گرفتید (RLS)، خط زیر را هم اجرا کنید:
-- create policy "employees_update_auth" on public.employees for update to authenticated using (true) with check (true);
