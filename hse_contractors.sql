-- ماژول پیمانکاران: ثبت ورود/پایان کار + سابقهٔ اخطار
create table if not exists public.contractors(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contract_no text,
  contact_name text,
  phone text,
  scope text,
  workers int,
  start_date date not null default current_date,
  end_date date,
  status text not null default 'active' check (status in ('active','finished')),
  note text,
  created_by text,
  created_at timestamptz not null default now()
);
create table if not exists public.contractor_warnings(
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  warn_date date not null default current_date,
  record_type text not null default 'اخطار کتبی',
  reason text not null,
  description text,
  registered_by text,
  created_at timestamptz not null default now()
);
create index if not exists contractor_warnings_c_idx on public.contractor_warnings(contractor_id);
alter table public.contractors enable row level security;
alter table public.contractor_warnings enable row level security;
drop policy if exists contractors_all on public.contractors;
create policy contractors_all on public.contractors for all to authenticated using (true) with check (true);
drop policy if exists contractor_warnings_all on public.contractor_warnings;
create policy contractor_warnings_all on public.contractor_warnings for all to authenticated using (true) with check (true);
notify pgrst, 'reload schema';
