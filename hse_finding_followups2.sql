-- چرخهٔ پیگیری عدم‌انطباق‌ها (۱ و ۱۵ هر ماه) + اعلام انجام توسط فنی + عدم تایید
alter table public.finding_followups add column if not exists kind text not null default 'follow';   -- follow | claim | rejected
alter table public.finding_followups add column if not exists tech_deadline date;                    -- مهلتی که واحد فنی اعلام کرده
alter table public.finding_followups drop constraint if exists fu_next_max10;
alter table public.finding_followups drop constraint if exists fu_next_max18;
alter table public.finding_followups add constraint fu_next_max18 check (next_due is null or next_due <= followed_at + 18);
notify pgrst, 'reload schema';
