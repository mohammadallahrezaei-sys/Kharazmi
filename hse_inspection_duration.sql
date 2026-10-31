-- مدت تکمیل هر چک‌لیست (ثانیه) برای تشخیص چک‌لیست‌های بی‌خروجی
alter table public.inspections add column if not exists duration_sec int;
notify pgrst, 'reload schema';
