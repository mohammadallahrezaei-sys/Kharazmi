-- ایندکس‌های سرعت (ایمن و تکرارپذیر): فقط اگر جدول و ستون وجود داشته باشد ساخته می‌شود؛ داده‌ای تغییر نمی‌کند.
-- اجرا: Supabase > SQL Editor > Run (می‌توان چندبار اجرا کرد)
DO $$
DECLARE
  r record;
  spec text[][] := ARRAY[
    ['findings','status'], ['findings','module'], ['findings','created_at'], ['findings','notice_code'],
    ['findings','equipment_code'], ['findings','risk_id'], ['findings','location'],
    ['inspections','module'], ['inspections','created_at'], ['inspections','equipment_code'],
    ['clinic_visits','employee_id'], ['clinic_visits','visit_date'],
    ['clinic_incidents','employee_id'], ['clinic_incidents','incident_date'],
    ['clinic_followups','employee_id'], ['clinic_followups','status'],
    ['clinic_exams','employee_id'], ['hse_cards','card_date'],
    ['trainings','training_date'], ['training_attendees','training_id'], ['training_attendees','employee_id'],
    ['hse_unit_monthly','unit_id'], ['employees','department'], ['equipment_inspections','equipment_id']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(spec, 1) LOOP
    IF to_regclass('public.' || spec[i][1]) IS NOT NULL AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = spec[i][1] AND column_name = spec[i][2]) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)', 'ix_' || spec[i][1] || '_' || spec[i][2], spec[i][1], spec[i][2]);
    END IF;
  END LOOP;
END $$;
-- ترکیبی پرکاربرد: عدم‌انطباق‌های باز هر ماژول
DO $$ BEGIN
  IF to_regclass('public.findings') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS ix_findings_status_module ON public.findings (status, module);
  END IF;
END $$;
ANALYZE;
