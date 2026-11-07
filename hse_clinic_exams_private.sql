-- معاینات طب کار فقط برای مدیر: دسترسی جدول clinic_exams (حتی از طریق API) به ایمیل مدیر محدود می‌شود.
-- کارشناس نه می‌تواند بخواند، نه ثبت/ویرایش/حذف کند. (همان الگوی hse_committee_private.sql)
-- نکته: اگر ایمیل مدیر را در auth.js (MANAGERS) عوض کردید، همین‌جا هم عوض کنید.
-- تکراری‌قابل‌اجرا است. فایل‌هایی که با SQL Editor اجرا می‌شوند (مثل hse_exams_1404.sql) تحت‌تأثیر نیستند.
do $$ declare pol record; begin
  alter table public.clinic_exams enable row level security;
  -- همه‌ی سیاست‌های قبلی (مثل "همه‌ی کاربران واردشده") حذف شود تا قفل دور زده نشود
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'clinic_exams' loop
    execute format('drop policy if exists %I on public.clinic_exams', pol.policyname);
  end loop;
  create policy clinic_exams_mgr on public.clinic_exams for all to authenticated
    using (lower(auth.jwt()->>'email') = 'm.rezaei@gmail.com')
    with check (lower(auth.jwt()->>'email') = 'm.rezaei@gmail.com');
end $$;
-- نقش anon هیچ دسترسی مستقیمی به این جدول نداشته باشد
revoke all on public.clinic_exams from anon;
notify pgrst, 'reload schema';
