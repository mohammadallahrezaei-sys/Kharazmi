-- ثبت کد تجهیز روی هر بازدید چک‌لیست (برای سررسید بازدید تجهیزات و ارزیابی کارشناس)
alter table public.inspections add column if not exists equipment_code  text;
alter table public.inspections add column if not exists equipment_title text;
create index if not exists inspections_equipment_code_idx on public.inspections (equipment_code, created_at desc);
notify pgrst, 'reload schema';
