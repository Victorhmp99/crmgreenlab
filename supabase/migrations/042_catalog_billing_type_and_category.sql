-- ═══════════════════════════════════════════════════════════════════════════
-- 042 — Catálogo: tipo de cobrança e categoria no produto
--
-- Antes o produto só tinha nome e preço. Não dava pra dizer se ele é
-- recorrente (MRR) ou pagamento único (TCV), nem organizar por categoria —
-- e é por isso que os gráficos de receita mostram tudo como "Sem categoria".
--
-- Idempotente: pode rodar de novo sem efeito colateral.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tipo de cobrança ────────────────────────────────────────────────────────
-- 'recurring' = MRR (mensalidade) · 'one_time' = TCV (pagamento único)
-- Default 'one_time' porque é o comportamento que os produtos já tinham:
-- nada no sistema os tratava como recorrentes até agora.
alter table public.financial_products
  add column if not exists billing_type text not null default 'one_time';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'financial_products_billing_type_check'
  ) then
    alter table public.financial_products
      add constraint financial_products_billing_type_check
      check (billing_type in ('recurring', 'one_time'));
  end if;
end $$;

-- ── Categoria ───────────────────────────────────────────────────────────────
-- ON DELETE SET NULL: apagar a categoria não pode apagar o produto junto —
-- o produto continua vendável, só fica sem classificação.
alter table public.financial_products
  add column if not exists category_id uuid
  references public.financial_categories(id) on delete set null;

create index if not exists idx_financial_products_category
  on public.financial_products(category_id) where category_id is not null;

-- ── Integridade entre empresas ──────────────────────────────────────────────
-- A FK acima garante que a categoria existe, mas NÃO que ela pertence à mesma
-- empresa do produto. Sem isto, um payload manipulado poderia apontar para a
-- categoria de outro tenant e vazar o nome dela nos relatórios.
create or replace function public.check_product_category_same_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category_id is not null then
    if not exists (
      select 1 from public.financial_categories c
      where c.id = new.category_id
        and c.tenant_id = new.tenant_id
    ) then
      raise exception 'Categoria não pertence a esta empresa';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_product_category_same_tenant on public.financial_products;
create trigger trg_product_category_same_tenant
  before insert or update of category_id, tenant_id on public.financial_products
  for each row execute function public.check_product_category_same_tenant();

-- ── Índice de apoio ao ranking de produtos vendidos ─────────────────────────
create index if not exists idx_financial_records_product
  on public.financial_records(tenant_id, product_id)
  where product_id is not null;

comment on column public.financial_products.billing_type is
  'recurring = MRR (mensalidade) | one_time = TCV (pagamento único)';
comment on column public.financial_products.category_id is
  'Categoria do catálogo. Validada por trigger como sendo do mesmo tenant.';
