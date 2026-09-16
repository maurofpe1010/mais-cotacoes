begin;
alter table public.insurer_plans add column if not exists iof_percent numeric(5,2) not null default 0;
do $$ begin if not exists (select 1 from pg_constraint where conrelid='public.insurer_plans'::regclass and conname='plan_iof_valid') then alter table public.insurer_plans add constraint plan_iof_valid check(iof_percent between 0 and 100); end if; end $$;
notify pgrst, 'reload schema';
commit;
