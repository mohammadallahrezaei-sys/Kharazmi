-- لیست تلفن داخلی قابل ویرایش
create table if not exists public.phonebook (
  id uuid primary key default gen_random_uuid(),
  unit text not null,
  name text not null,
  ext text not null,
  mobile text not null default '',   -- '**' یعنی داخلی + ** به موبایل می‌رسد؛ یا کد کامل مثل 166**
  ord int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists phonebook_ord_idx on public.phonebook (ord);
alter table public.phonebook enable row level security;
drop policy if exists phonebook_all on public.phonebook;
create policy phonebook_all on public.phonebook for all to authenticated using (true) with check (true);
notify pgrst, 'reload schema';
