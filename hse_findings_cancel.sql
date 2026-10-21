-- لغو عدم‌انطباق با ثبت دلیل — یک‌بار در Supabase > SQL Editor اجرا شود (بخش ۱)
-- بخش ۱: ستون‌های جدید و پذیرفتن وضعیت «cancelled»
alter table public.findings
  add column if not exists cancel_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text;

-- اگر ستون status محدودیت check دارد، حذف می‌شود تا مقدار cancelled پذیرفته شود
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.findings'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.findings drop constraint %I', c.conname);
  end loop;
end $$;

-- اگر status از نوع enum است، مقدار جدید اضافه می‌شود
do $$
declare t text;
begin
  select udt_name into t from information_schema.columns
   where table_schema = 'public' and table_name = 'findings' and column_name = 'status' and data_type = 'USER-DEFINED';
  if t is not null then execute format('alter type %I add value if not exists %L', t, 'cancelled'); end if;
end $$;

-- بخش ۲ (اختیاری، جداگانه و بعد از بخش ۱ اجرا شود): لغو عدم‌انطباق‌های بازِ دارو که قبلاً خودکار ساخته شده بودند.
-- خود برنامه هم هنگام باز کردن صفحه‌ی داروها این کار را یک‌بار انجام می‌دهد.
-- update public.findings set status='cancelled', cancel_reason='هشدارهای دارو به صفحه‌ی کنترل و موجودی داروها منتقل شد', cancelled_at=now(), cancelled_by='سیستم', closed_at=null where module='MED' and status='open';
