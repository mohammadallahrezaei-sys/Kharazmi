-- ساعات کارکرد ماهانه (برای محاسبهٔ شاخص‌های حوادث AFR / ASR / FSI / Safe-T)
-- اجرا: Supabase > SQL Editor > Run (قابل اجرای مجدد)
create table if not exists public.hse_manhours(
  month_key text primary key,            -- ماه شمسی به‌صورت 1404-07
  base_hours numeric not null default 0, -- مجموع «کارکرد»
  ot_hours numeric not null default 0,   -- مجموع اضافه‌کار (شبکاری، مجاز، تعطیل، جمعه، ماموریت)
  headcount int not null default 0,
  source text,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.hse_manhours enable row level security;
drop policy if exists hse_manhours_all on public.hse_manhours;
create policy hse_manhours_all on public.hse_manhours for all to authenticated using (true) with check (true);
notify pgrst, 'reload schema';
