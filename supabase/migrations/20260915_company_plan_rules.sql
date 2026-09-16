begin;
alter table public.insurer_plans add column if not exists observations text;
alter table public.insurer_plans add column if not exists discount_percent numeric(5,2) not null default 0;
alter table public.insurer_plans add column if not exists discount_min_lives integer;
alter table public.quotes add column if not exists company_cnpj text;
alter table public.quotes add column if not exists company_data jsonb;
do $$ begin
 if not exists (select 1 from pg_constraint where conrelid = 'public.insurer_plans'::regclass and conname = 'plan_discount_valid') then
 alter table public.insurer_plans add constraint plan_discount_valid check (discount_percent between 0 and 100 and (discount_min_lives is null or discount_min_lives >= 1) and (discount_percent = 0 or discount_min_lives is not null));
 end if;
end $$;
notify pgrst, 'reload schema';
commit;
