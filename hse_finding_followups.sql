-- پیگیری عدم‌انطباق‌ها با واحد فنی: نتیجهٔ هر پیگیری + موعد پیگیری بعدی (حداکثر ۱۰ روز)
create table if not exists public.finding_followups(
  id uuid primary key default gen_random_uuid(),
  finding_id text not null,
  followed_at date not null default current_date,
  followed_by text,
  result text not null,
  next_due date,
  created_at timestamptz not null default now(),
  constraint fu_next_max10 check (next_due is null or next_due <= followed_at + 10)
);
create index if not exists finding_followups_f_idx on public.finding_followups(finding_id);
alter table public.finding_followups enable row level security;
drop policy if exists finding_followups_all on public.finding_followups;
create policy finding_followups_all on public.finding_followups for all to authenticated using (true) with check (true);
notify pgrst, 'reload schema';
