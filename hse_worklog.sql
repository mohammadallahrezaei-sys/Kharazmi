-- گزارش کارهای روزانهٔ HSE (با عکس) + تیک‌های روزانه (مثلاً روشن‌کردن کلرزنی تصفیه‌خانه)
create table if not exists public.work_log(
  id uuid primary key default gen_random_uuid(),
  work_date date not null default current_date,
  category text,
  title text not null,
  description text,
  status text not null default 'done',
  photos jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists work_log_date_idx on public.work_log(work_date);
create table if not exists public.daily_ticks(
  id uuid primary key default gen_random_uuid(),
  tick_date date not null,
  key text not null,
  done_by text,
  created_at timestamptz not null default now(),
  unique(tick_date,key)
);
alter table public.work_log enable row level security;
alter table public.daily_ticks enable row level security;
drop policy if exists work_log_all on public.work_log;
create policy work_log_all on public.work_log for all to authenticated using (true) with check (true);
drop policy if exists daily_ticks_all on public.daily_ticks;
create policy daily_ticks_all on public.daily_ticks for all to authenticated using (true) with check (true);
notify pgrst, 'reload schema';
