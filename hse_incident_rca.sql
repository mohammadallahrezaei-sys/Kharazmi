-- علت‌یابی ریشه‌ای حادثه (RCA): ذخیرهٔ گزارش + قفل دیتابیس برای نهایی‌کردن
-- اجرا: Supabase > SQL Editor > Run (قابل اجرای مجدد)
-- بعد از hse_incident_review.sql اجرا شود.
alter table public.clinic_incidents add column if not exists rca jsonb;
alter table public.clinic_incidents add column if not exists rca_status text;      -- null | draft | final
alter table public.clinic_incidents add column if not exists rca_by text;
alter table public.clinic_incidents add column if not exists rca_at timestamptz;
alter table public.clinic_incidents add column if not exists rca_final_at timestamptz;

-- تریگر: حتی اگر کسی صفحه را دور بزند، «نظر کارشناس» بدون RCA کامل ثبت نمی‌شود.
-- (حوادث قدیمی که قبلاً نظر کارشناس دارند دست‌نخورده می‌مانند.)
create or replace function public.hse_rca_guard() returns trigger language plpgsql as $$
declare
  ch jsonb; st jsonb; ac jsonb; k text; cnt int; n int; i int;
  imm text[] := array['act','cond'];
  rt  text[] := array['proc','train','super','maint','risk','org'];
begin
  -- ۱) گزارش نهایی‌شده قفل است (فقط با بازگشت از مدیر که وضعیت را draft می‌کند باز می‌شود)
  if tg_op = 'UPDATE' and old.rca_status = 'final' and new.rca_status = 'final' and new.rca is distinct from old.rca then
    raise exception 'RCA_LOCKED: گزارش علت‌یابی نهایی‌شده قابل ویرایش نیست؛ مدیر باید آن را به کارشناس برگرداند.';
  end if;

  -- ۲) نظر کارشناس فقط همراه RCA نهایی
  if coalesce(btrim(new.expert_opinion), '') <> ''
     and (tg_op = 'INSERT' or coalesce(btrim(old.expert_opinion), '') = '')
     and coalesce(new.rca_status, '') <> 'final' then
    raise exception 'RCA_REQUIRED: ثبت نظر کارشناس فقط پس از تکمیل و نهایی‌شدن علت‌یابی ریشه‌ای ممکن است.';
  end if;

  -- ۳) نظر مدیر وقتی RCA در حال ویرایش (draft) است ثبت نمی‌شود
  if coalesce(btrim(new.manager_opinion), '') <> ''
     and (tg_op = 'INSERT' or coalesce(btrim(old.manager_opinion), '') = '')
     and new.rca_status = 'draft' then
    raise exception 'RCA_PENDING: علت‌یابی ریشه‌ای هنوز نهایی نشده است.';
  end if;

  -- ۴) اعتبارسنجی ساختار هنگام نهایی‌شدن
  if new.rca_status = 'final' and (tg_op = 'INSERT' or old.rca_status is distinct from 'final') then
    if new.rca is null or jsonb_typeof(new.rca->'chains') is distinct from 'array' or jsonb_array_length(new.rca->'chains') < 1 then
      raise exception 'RCA_INCOMPLETE: زنجیرهٔ علت ثبت نشده است.';
    end if;
    if jsonb_typeof(new.rca#>'{facts,timeline}') is distinct from 'array' or jsonb_array_length(new.rca#>'{facts,timeline}') < 3
       or jsonb_typeof(new.rca#>'{facts,evidence}') is distinct from 'array' or jsonb_array_length(new.rca#>'{facts,evidence}') < 3 then
      raise exception 'RCA_INCOMPLETE: خط زمانی یا شواهد کافی نیست.';
    end if;
    if coalesce((new.rca#>>'{facts,site_visit}')::boolean, false) is not true or coalesce((new.rca#>>'{facts,interviews}')::boolean, false) is not true then
      raise exception 'RCA_INCOMPLETE: بازدید محل و مصاحبه تأیید نشده است.';
    end if;
    foreach k in array array['elim','sub','eng','adm','ppe'] loop
      if coalesce(new.rca#>>array['barriers',k,'s'], '') = '' or char_length(btrim(coalesce(new.rca#>>array['barriers',k,'n'], ''))) < 10 then
        raise exception 'RCA_INCOMPLETE: تحلیل موانع کامل نیست (%).', k;
      end if;
    end loop;
    for ch in select value from jsonb_array_elements(new.rca->'chains') loop
      if jsonb_typeof(ch->'steps') is distinct from 'array' or jsonb_array_length(ch->'steps') < 4 then
        raise exception 'RCA_INCOMPLETE: هر زنجیره باید حداقل ۴ مرحلهٔ چرا داشته باشد.';
      end if;
      n := jsonb_array_length(ch->'steps'); i := 0;
      for st in select value from jsonb_array_elements(ch->'steps') loop
        i := i + 1;
        if char_length(btrim(coalesce(st->>'cause',''))) < 15 or char_length(btrim(coalesce(st->>'ev',''))) < 10 or coalesce(st->>'evt','') = '' then
          raise exception 'RCA_INCOMPLETE: هر مرحله به علت و شاهد نیاز دارد.';
        end if;
        if i = 1 and not (st->>'cat' = any(imm)) then
          raise exception 'RCA_INCOMPLETE: چرای اول باید علت بلافصل باشد.';
        end if;
        if i = n and not (st->>'cat' = any(rt)) then
          raise exception 'RCA_NOT_ROOT: آخرین چرا هنوز ریشهٔ سیستمی نیست.';
        end if;
        if i = n and st->>'evt' = 'interview' then
          raise exception 'RCA_NOT_ROOT: ریشه باید شاهدی غیر از مصاحبه داشته باشد.';
        end if;
      end loop;
      if coalesce((ch#>>'{tests,remove}')::boolean,false) is not true or coalesce((ch#>>'{tests,system}')::boolean,false) is not true or coalesce((ch#>>'{tests,history}')::boolean,false) is not true then
        raise exception 'RCA_INCOMPLETE: آزمون‌های اعتبار ریشه تأیید نشده است.';
      end if;
      if jsonb_typeof(ch->'actions') is distinct from 'array' or jsonb_array_length(ch->'actions') < 1 then
        raise exception 'RCA_INCOMPLETE: برای هر ریشه حداقل یک اقدام اصلاحی لازم است.';
      end if;
      for ac in select value from jsonb_array_elements(ch->'actions') loop
        if char_length(btrim(coalesce(ac->>'d',''))) < 15 or coalesce(ac->>'o','') = '' or coalesce(ac->>'due','') = ''
           or coalesce(ac->>'lvl','') = '' or char_length(btrim(coalesce(ac->>'ver',''))) < 10 then
          raise exception 'RCA_INCOMPLETE: مشخصات اقدام اصلاحی ناقص است.';
        end if;
      end loop;
    end loop;
    new.rca_final_at := coalesce(new.rca_final_at, now());
  end if;
  return new;
end $$;

drop trigger if exists hse_rca_guard on public.clinic_incidents;
create trigger hse_rca_guard before insert or update on public.clinic_incidents
  for each row execute function public.hse_rca_guard();

notify pgrst, 'reload schema';
