-- تعهدات و الزامات دوره‌ای HSE (سنجش‌ها، مانورها، آزمون‌ها، ممیزی و بازنگری‌ها، مجوزها)
create table if not exists public.hse_obligations(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'سایر',
  period_months int not null default 12 check (period_months between 1 and 120),
  last_done date,
  next_due date,
  owner text,
  authority text,
  note text,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);
create table if not exists public.hse_obligation_log(
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.hse_obligations(id) on delete cascade,
  done_at date not null,
  note text,
  done_by text,
  created_at timestamptz not null default now()
);
create index if not exists hse_obligation_log_o_idx on public.hse_obligation_log(obligation_id, done_at desc);
alter table public.hse_obligations enable row level security;
alter table public.hse_obligation_log enable row level security;
drop policy if exists hse_obligations_all on public.hse_obligations;
create policy hse_obligations_all on public.hse_obligations for all to authenticated using (true) with check (true);
drop policy if exists hse_obligation_log_all on public.hse_obligation_log;
create policy hse_obligation_log_all on public.hse_obligation_log for all to authenticated using (true) with check (true);
notify pgrst, 'reload schema';
