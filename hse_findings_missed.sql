-- بازرسی تأییدی مدیر: مواردی که در بازدید یک کارشناس از قلم افتاده بود (ایمیل کارشناس)
alter table public.findings add column if not exists missed_by text;
create index if not exists findings_missed_by_idx on public.findings (missed_by) where missed_by is not null;
notify pgrst, 'reload schema';
