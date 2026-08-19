-- ═══════════════════════════════════════════════════════════════════════════
-- 043 — Contrato com prazo de término e itens (produtos/serviços)
--
-- Duas lacunas:
--
-- 1. Contrato de pagamento único (TCV) não tinha fim. Um projeto de 6 meses
--    ficava "ativo" pra sempre e ninguém era lembrado de renovar.
--    Agora: ao chegar a data de término, o contrato é PAUSADO e vira uma
--    tarefa de renovação. Pausado, e não cancelado, porque cancelar congela
--    o faturamento como perda definitiva — pausa é reversível ao renovar.
--
-- 2. Contrato só tinha um valor cru. Não dava pra dizer O QUE foi vendido.
--    Agora tem itens, com preço próprio: o valor é negociado por venda e não
--    pode ficar preso ao preço de catálogo.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Prazo de término ─────────────────────────────────────────────────────
alter table public.client_contracts
  add column if not exists end_date date;

-- Marca que a renovação já foi avisada, pra não gerar tarefa repetida a cada
-- passagem do job diário.
alter table public.client_contracts
  add column if not exists renewal_notified_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'client_contracts_end_after_start') then
    alter table public.client_contracts
      add constraint client_contracts_end_after_start
      check (end_date is null or end_date >= start_date);
  end if;
end $$;

create index if not exists idx_client_contracts_end_date
  on public.client_contracts(end_date)
  where end_date is not null and status = 'active';

-- ── 2. Itens do contrato ────────────────────────────────────────────────────
create table if not exists public.contract_items (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  contract_id uuid not null references public.client_contracts(id) on delete cascade,
  -- Produto é opcional: dá pra lançar um item avulso que não está no catálogo.
  product_id  uuid references public.financial_products(id) on delete set null,
  description text not null,
  -- Preço do ITEM, não do catálogo. Cada venda negocia o seu.
  unit_price  numeric(12,2) not null default 0,
  quantity    numeric(10,2) not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint contract_items_qty_positive check (quantity > 0)
);

create index if not exists idx_contract_items_contract
  on public.contract_items(contract_id);

alter table public.contract_items enable row level security;

-- Mesma regra do contrato: só gestor/admin, e só com a função financeiro.
drop policy if exists managers_manage_contract_items on public.contract_items;
create policy managers_manage_contract_items on public.contract_items
  for all
  using (is_tenant_manager(tenant_id))
  with check (is_tenant_manager(tenant_id) and tenant_has_feature(tenant_id, 'financeiro'));

-- O contrato e o item precisam ser da MESMA empresa. A FK sozinha permitiria
-- anexar item ao contrato de outro tenant informando outro tenant_id.
create or replace function public.check_contract_item_same_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.client_contracts c
    where c.id = new.contract_id and c.tenant_id = new.tenant_id
  ) then
    raise exception 'Contrato não pertence a esta empresa';
  end if;

  if new.product_id is not null and not exists (
    select 1 from public.financial_products p
    where p.id = new.product_id and p.tenant_id = new.tenant_id
  ) then
    raise exception 'Produto não pertence a esta empresa';
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_contract_item_same_tenant on public.contract_items;
create trigger trg_contract_item_same_tenant
  before insert or update on public.contract_items
  for each row execute function public.check_contract_item_same_tenant();

-- ── 3. Vencimento automático ────────────────────────────────────────────────
-- Roda uma vez por dia: pausa contratos vencidos e avisa quem gerencia.
create or replace function public.expire_due_contracts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contrato record;
  v_gestor   record;
  v_total    integer := 0;
  -- Fuso de Brasília, como no resto do financeiro: em UTC o contrato
  -- venceria à noite do dia anterior.
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  for v_contrato in
    select c.id, c.tenant_id, c.lead_id, c.amount, c.end_date, l.name as lead_name
    from client_contracts c
    join leads l on l.id = c.lead_id
    where c.status = 'active'
      and c.end_date is not null
      and c.end_date <= v_hoje
      and c.renewal_notified_at is null
  loop
    update client_contracts
    set status = 'paused', renewal_notified_at = now()
    where id = v_contrato.id;

    for v_gestor in
      select user_id from user_memberships
      where tenant_id = v_contrato.tenant_id
        and role in ('admin','manager') and active = true
    loop
      insert into lead_tasks (tenant_id, lead_id, created_by, assigned_to, title, description, due_at)
      values (
        v_contrato.tenant_id, v_contrato.lead_id, null, v_gestor.user_id,
        'Renovar contrato de ' || v_contrato.lead_name
          || ' — venceu em ' || to_char(v_contrato.end_date, 'DD/MM/YYYY'),
        'O contrato chegou ao fim e foi pausado automaticamente. '
          || 'Renove para voltar a faturar, ou cancele se o cliente não seguir.',
        (v_hoje + interval '12 hours')
      );
    end loop;

    v_total := v_total + 1;
  end loop;

  return v_total;
end $$;

revoke all on function public.expire_due_contracts() from public, anon;

-- 06:00 UTC = 03:00 em Brasília: roda antes de qualquer expediente, então o
-- gestor já encontra a tarefa criada ao abrir o sistema.
select cron.unschedule('expire-due-contracts')
where exists (select 1 from cron.job where jobname = 'expire-due-contracts');

select cron.schedule('expire-due-contracts', '0 6 * * *', 'SELECT expire_due_contracts()');

comment on column public.client_contracts.end_date is
  'Data de término. Ao chegar, o contrato é pausado e vira tarefa de renovação.';
comment on table public.contract_items is
  'Produtos/serviços do contrato. unit_price é o preço negociado, não o de catálogo.';
