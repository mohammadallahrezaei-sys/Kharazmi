-- ماژول کمیته حفاظت فنی و بهداشت کار: صورتجلسه‌ها، ارسال به ادارات، مستندات
create table if not exists public.committee_meetings (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  no int not null,
  no_label text,
  jdate text not null,            -- تاریخ شمسی yyyy/mm/dd
  t1 text, t2 text, place text,
  workers int,
  next_date text,
  att jsonb not null default '{}'::jsonb,
  absent text, guests text, notes text,
  created_at timestamptz not null default now(),
  unique (year, no)
);
create table if not exists public.committee_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.committee_meetings(id) on delete cascade,
  seq int not null default 0,
  kind text not null,             -- done | ongoing | new
  text text not null,
  actor text, follower text, deadline text, result text
);
create index if not exists committee_items_meeting_idx on public.committee_items (meeting_id);
create table if not exists public.committee_submissions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.committee_meetings(id) on delete cascade,
  target text not null,           -- labor | health
  letter_no text, letter_date text, receipt_no text, receipt_date text,
  files jsonb not null default '[]'::jsonb,
  note text,
  unique (meeting_id, target)
);
create table if not exists public.committee_docs (
  id uuid primary key default gen_random_uuid(),
  jyear int, period text, category text,
  title text not null,
  target text,                    -- labor | health | both | none
  status text not null default 'draft',   -- draft | ready | sent
  letter_no text, letter_date text, receipt_no text, receipt_date text,
  files jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['committee_meetings','committee_items','committee_submissions','committee_docs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t||'_all', t);
  end loop;
end $$;
notify pgrst, 'reload schema';
