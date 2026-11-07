-- پیگیری‌های ساخته‌شده از معاینات طب کار (عنوان «پیگیری یافته‌های معاینه طب کار: …» و «معاینه طب کار بعدی (…)») فقط برای مدیر دیده شوند.
-- از سیاست «محدودکننده» (restrictive) استفاده شده؛ یعنی روی سیاست‌های فعلی جدول اضافه می‌شود و آن‌ها را عوض نمی‌کند.
-- فقط خواندن را محدود می‌کند؛ ثبت/ویرایش سایر پیگیری‌ها مثل قبل کار می‌کند.
-- اگر ایمیل مدیر را در auth.js (MANAGERS) عوض کردید، همین‌جا هم عوض کنید. تکراری‌قابل‌اجرا است.
do $$ begin
  if not (select relrowsecurity from pg_class where oid = 'public.clinic_followups'::regclass) then
    raise exception 'RLS روی clinic_followups فعال نیست؛ این فایل اثری نمی‌داشت. ابتدا سیاست‌های فعلی جدول را بررسی کنید.';
  end if;
  drop policy if exists clinic_followups_noexam on public.clinic_followups;
  create policy clinic_followups_noexam on public.clinic_followups as restrictive for select to anon, authenticated
    using (
      lower(coalesce(auth.jwt()->>'email','')) = 'm.rezaei@gmail.com'
      or not (coalesce(title,'') like 'پیگیری یافته‌های معاینه طب کار%' or coalesce(title,'') like 'معاینه طب کار بعدی%')
    );
end $$;
notify pgrst, 'reload schema';
