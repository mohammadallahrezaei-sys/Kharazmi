-- ماژول کمیته فقط برای مدیر: دسترسی جدول‌ها (حتی از طریق API) به ایمیل مدیر محدود می‌شود
do $$ declare t text; begin
  foreach t in array array['committee_meetings','committee_items','committee_submissions','committee_docs'] loop
    execute format('drop policy if exists %I on public.%I', t||'_all', t);
    execute format('drop policy if exists %I on public.%I', t||'_mgr', t);
    execute format($p$create policy %I on public.%I for all to authenticated
      using (lower(auth.jwt()->>'email') = 'm.rezaei@gmail.com')
      with check (lower(auth.jwt()->>'email') = 'm.rezaei@gmail.com')$p$, t||'_mgr', t);
  end loop;
end $$;
notify pgrst, 'reload schema';
