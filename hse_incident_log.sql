-- فهرست حوادث دارای روز از دست رفته (از اکسل Sick Leave (Days)) برای شاخص‌های AFR/ASR/FSI
-- اجرا: Supabase > SQL Editor > Run (قابل اجرای مجدد)
create table if not exists public.hse_lost_incidents(
  id uuid primary key default gen_random_uuid(),
  jdate text not null,
  month_key text not null,
  emp_code text not null default '',
  name text,
  department text,
  location text,
  lost_days numeric not null default 0,
  updated_by text,
  updated_at timestamptz not null default now(),
  unique(jdate, emp_code)
);
alter table public.hse_lost_incidents enable row level security;
drop policy if exists hse_lost_incidents_all on public.hse_lost_incidents;
create policy hse_lost_incidents_all on public.hse_lost_incidents for all to authenticated using (true) with check (true);
notify pgrst, 'reload schema';
