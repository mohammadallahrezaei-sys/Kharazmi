-- اصلاح یک‌باره: چک‌لیست‌های پیمانکار «موگویی» که با نام کوتاه/فامیلی ثبت شده بودند
-- را با نام ثبت‌شدهٔ پیمانکار (ثبت ورود) یکی می‌کند تا در تقویم و ارزیابی «عدم تکمیل» نخورند.
-- مرحلهٔ ۱ (فقط ببینید، چیزی تغییر نمی‌کند):
select 'پیمانکارِ ثبت‌ورودشده' as نوع, name as مقدار, count(*) as تعداد from public.contractors where name ilike '%موگو%' group by name
union all
select 'مقدار location چک‌لیست‌ها', location, count(*) from public.inspections where module = 'CT' and location ilike '%موگو%' group by location;

-- مرحلهٔ ۲ (اصلاح): فقط اگر دقیقاً یک نام پیمانکار شامل «موگو» وجود داشته باشد اجرا می‌شود
do $$
declare nm text; n int; old text;
begin
  select count(distinct name), min(name) into n, nm from public.contractors where name ilike '%موگو%';
  if n = 0 then raise exception 'پیمانکاری با نام شامل «موگو» در جدول contractors پیدا نشد.'; end if;
  if n > 1 then raise exception 'بیش از یک نام پیمانکار شامل «موگو» وجود دارد؛ دستی بررسی شود.'; end if;
  select string_agg(distinct location, ' | ') into old from public.inspections where module = 'CT' and location ilike '%موگو%' and location <> nm;
  update public.inspections set location = nm where module = 'CT' and location ilike '%موگو%' and location <> nm;
  get diagnostics n = row_count;
  raise notice 'پیمانکار: % — % چک‌لیست اصلاح شد (مقادیر قبلی: %)', nm, n, coalesce(old, '-');
end $$;
