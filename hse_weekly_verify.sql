-- برنامهٔ بازدید تاییدی هفتگی مدیر (فقط مدیر می‌نویسد؛ کارشناس فقط برای محاسبهٔ امتیاز می‌خواند)
create table if not exists public.verify_rounds(
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  expert text,
  module text,
  location text,
  inspection_id text,
  insp_at timestamptz,
  result text not null default 'planned' check (result in ('planned','ok','gap')),
  note text,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists verify_rounds_week_idx on public.verify_rounds(week_start);
alter table public.verify_rounds enable row level security;
drop policy if exists verify_rounds_read on public.verify_rounds;
create policy verify_rounds_read on public.verify_rounds for select to authenticated using (true);
drop policy if exists verify_rounds_mgr on public.verify_rounds;
create policy verify_rounds_mgr on public.verify_rounds for all to authenticated
  using (lower(auth.jwt()->>'email')='m.rezaei@gmail.com') with check (lower(auth.jwt()->>'email')='m.rezaei@gmail.com');
notify pgrst, 'reload schema';
