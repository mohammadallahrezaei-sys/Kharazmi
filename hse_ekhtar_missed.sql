-- اخطار/تذکرهایی که مدیر در بازدید میدانی صادر کرده و کارشناس ندیده بود (کسر از امتیاز کارشناس)
alter table public.ekhtars add column if not exists missed_expert text;
notify pgrst, 'reload schema';
