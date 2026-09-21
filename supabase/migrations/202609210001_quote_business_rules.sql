-- Dados comerciais dos planos e identificação da empresa na cotação.
alter table public.insurer_plans
  add column if not exists observation text,
  add column if not exists discount_percent numeric(5,2) not null default 0,
  add column if not exists discount_min_lives integer,
  add column if not exists iof_percent numeric(5,2) not null default 0;

alter table public.insurer_plans
  drop constraint if exists insurer_plans_discount_percent_check,
  add constraint insurer_plans_discount_percent_check check (discount_percent between 0 and 100),
  drop constraint if exists insurer_plans_discount_min_lives_check,
  add constraint insurer_plans_discount_min_lives_check check (discount_min_lives is null or discount_min_lives >= 1),
  drop constraint if exists insurer_plans_iof_percent_check,
  add constraint insurer_plans_iof_percent_check check (iof_percent between 0 and 100);

alter table public.quotes
  add column if not exists company_cnpj text,
  add column if not exists company_legal_name text,
  add column if not exists company_trade_name text,
  add column if not exists company_size text,
  add column if not exists company_legal_nature text,
  add column if not exists company_city text,
  add column if not exists company_state text;

create index if not exists quotes_company_cnpj_idx on public.quotes (company_cnpj) where company_cnpj is not null;

comment on column public.insurer_plans.discount_percent is 'Desconto percentual aplicado quando a cotação atingir discount_min_lives.';
comment on column public.insurer_plans.iof_percent is 'IOF percentual aplicado após o desconto, somente em cotações empresariais.';
comment on column public.insurer_plans.observation is 'Observação comercial exibida no comparativo e no PDF.';
