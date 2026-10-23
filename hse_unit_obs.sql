-- تعداد مشاهده برای مخرج درصد PPE و رفتار ناایمن در ارزیابی واحدها
alter table public.hse_unit_monthly add column if not exists obs_count integer;
notify pgrst, 'reload schema';
