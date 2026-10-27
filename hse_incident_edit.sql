-- حوادث: جدا کردن محل اعزام و علت حادثه (قبلاً داخل شعبه تامین اجتماعی / شدت ثبت شده بود)
alter table public.clinic_incidents add column if not exists referral_place text;
alter table public.clinic_incidents add column if not exists accident_cause text;
notify pgrst, 'reload schema';
