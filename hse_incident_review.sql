-- بررسی حادثه: نظر کارشناس و سپس نظر مدیر
alter table public.clinic_incidents add column if not exists expert_opinion text;
alter table public.clinic_incidents add column if not exists expert_opinion_by text;
alter table public.clinic_incidents add column if not exists expert_opinion_at timestamptz;
alter table public.clinic_incidents add column if not exists manager_opinion text;
alter table public.clinic_incidents add column if not exists manager_opinion_at timestamptz;
notify pgrst, 'reload schema';
