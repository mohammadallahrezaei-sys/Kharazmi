-- افزودن نوع کارت «خطر بهداشتی» (health_hazard) به جدول hse_cards
do $$ declare c text; t text; begin
  -- اگر نوع ستون enum باشد
  select udt_name into t from information_schema.columns
   where table_schema='public' and table_name='hse_cards' and column_name='card_type' and data_type='USER-DEFINED';
  if t is not null then execute format('alter type public.%I add value if not exists %L', t, 'health_hazard'); end if;
  -- اگر محدودیت check روی card_type باشد
  for c in select conname from pg_constraint where conrelid='public.hse_cards'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%card_type%' loop
    execute format('alter table public.hse_cards drop constraint %I', c);
  end loop;
end $$;
notify pgrst, 'reload schema';
