-- برنامهٔ ارزیابی ریسک سوله‌ها: بازهٔ زمانی هر سوله برای هر نقش (expert = ایمنی، manager = بهداشتی + ارگونومی)
-- اجرا: Supabase > SQL Editor > Run (قابل اجرای مجدد)
create table if not exists public.risk_plan(
  id bigserial primary key,
  unit_id text not null,
  unit_name text not null,
  track text not null check (track in ('expert','manager')),
  start_date date not null,
  end_date date not null,
  equipment_n int not null default 0,
  people_n int not null default 0,
  hours numeric,
  days int,
  created_by text,
  created_at timestamptz not null default now(),
  unique (unit_id, track),
  check (end_date >= start_date)
);
alter table public.risk_plan enable row level security;
drop policy if exists risk_plan_all on public.risk_plan;
create policy risk_plan_all on public.risk_plan for all to authenticated using (true) with check (true);
notify pgrst, 'reload schema';
