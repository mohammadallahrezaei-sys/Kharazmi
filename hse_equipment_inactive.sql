-- غیرفعال‌سازی تجهیز با علت (ماژول تجهیزات) + ارجاع عدم‌انطباق به کارشناس (چک‌لیست‌ها)
alter table public.equipment add column if not exists inactive_reason text;
alter table public.equipment add column if not exists inactive_at date;

alter table public.findings add column if not exists assigned_to text;      -- ایمیل کارشناس
alter table public.findings add column if not exists assign_note text;      -- متن کوتاه ارجاع
alter table public.findings add column if not exists assigned_by text;
alter table public.findings add column if not exists assigned_at timestamptz;
create index if not exists findings_assigned_to_idx on public.findings (assigned_to) where assigned_to is not null;
notify pgrst, 'reload schema';
