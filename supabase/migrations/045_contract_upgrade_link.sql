-- ═══════════════════════════════════════════════════════════════════════════
-- 045 — Troca de plano (upsell/downgrade) como evento distinto de cancelamento
--
-- Hoje, trocar um cliente de plano (Prata → Gold) exige cancelar o contrato
-- antigo e criar um novo — e "cancelado" é o mesmo número que os relatórios
-- usam pra medir CHURN de verdade. Um upgrade contado como perda de cliente
-- é o oposto do que aconteceu.
--
-- Este é um evento novo: o contrato antigo não foi cancelado, foi
-- SUBSTITUÍDO. status = 'upgraded' — nenhum filtro existente (`= 'active'`,
-- `= 'cancelled'`) precisa mudar, porque um valor novo simplesmente não bate
-- em nenhum dos dois.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.client_contracts
  add column if not exists previous_contract_id uuid references public.client_contracts(id) on delete set null;

-- 'upgraded' precisa entrar na lista permitida — sem isso o UPDATE que fecha
-- o contrato antigo na troca de plano viola a constraint e a RPC inteira
-- falha (foi pego só ao testar de ponta a ponta; a consulta ao catálogo de
-- constraints feita antes de escrever a migration não a havia encontrado).
alter table public.client_contracts drop constraint if exists client_contracts_status_check;
alter table public.client_contracts
  add constraint client_contracts_status_check
  check (status = any (array['active','paused','cancelled','completed','upgraded']));

create index if not exists idx_client_contracts_previous
  on public.client_contracts(previous_contract_id) where previous_contract_id is not null;

-- O vínculo só faz sentido dentro do MESMO lead e da MESMA empresa. Sem essa
-- checagem, um payload manipulado poderia "encadear" o histórico de upgrade
-- de um cliente ao de outro tenant.
create or replace function public.check_contract_upgrade_same_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.previous_contract_id is not null then
    if not exists (
      select 1 from public.client_contracts p
      where p.id = new.previous_contract_id
        and p.tenant_id = new.tenant_id
        and p.lead_id = new.lead_id
    ) then
      raise exception 'Contrato anterior precisa ser do mesmo lead e da mesma empresa';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_contract_upgrade_same_lead on public.client_contracts;
create trigger trg_contract_upgrade_same_lead
  before insert or update of previous_contract_id, tenant_id, lead_id on public.client_contracts
  for each row execute function public.check_contract_upgrade_same_lead();

comment on column public.client_contracts.previous_contract_id is
  'Contrato que este substituiu numa troca de plano. O antigo vira status ''upgraded'' — diferente de cancelado, não conta como perda.';

-- ── RPC: cria o contrato novo e, se for upgrade, fecha o antigo no MESMO
--    lugar. Precisa ser atômico: se a criação falhar, o contrato antigo não
--    pode ficar marcado como substituído por um contrato que não existe.
--
--    Assinatura nova (12 args); a de 11 é removida logo abaixo. Adicionar um
--    parâmetro com CREATE OR REPLACE cria uma SEGUNDA função em vez de
--    substituir — já aconteceu na migration 044 e travou a criação de
--    contrato por ambiguidade. Não repetir.
create or replace function public.create_client_contract(
  p_tenant_id uuid,
  p_lead_id uuid,
  p_billing_type text,
  p_is_percentage boolean,
  p_percentage_value numeric,
  p_amount numeric,
  p_installments integer,
  p_start_date date,
  p_billing_day smallint,
  p_created_by uuid,
  p_end_date date default null,
  p_previous_contract_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_contract_id uuid;
  v_lead_name   text;
  v_manager     record;
  v_i           integer;
  v_due_date    date;
  v_due         timestamptz;
  v_title       text;
  v_amount_txt  text;
  v_indefinite  boolean;
  v_today       date := (now() at time zone 'America/Sao_Paulo')::date;
  v_first_idx   integer := 0;
  v_last_idx    integer;
begin
  if not is_tenant_manager(p_tenant_id)
     and not exists (select 1 from super_admins where user_id = auth.uid())
  then
    raise exception 'Unauthorized';
  end if;

  if not tenant_has_feature(p_tenant_id, 'financeiro') then
    raise exception 'Funcao financeiro nao liberada para esta empresa';
  end if;

  select name into v_lead_name from leads where id = p_lead_id and tenant_id = p_tenant_id;
  if v_lead_name is null then
    raise exception 'Lead not found for tenant';
  end if;

  if p_end_date is not null and p_end_date < p_start_date then
    raise exception 'Data de termino nao pode ser anterior ao inicio';
  end if;

  -- Valida o contrato anterior AQUI, antes de criar nada: se for de outro
  -- lead/empresa ou já não existir mais, falha cedo e limpo.
  if p_previous_contract_id is not null and not exists (
    select 1 from client_contracts
    where id = p_previous_contract_id and tenant_id = p_tenant_id and lead_id = p_lead_id
  ) then
    raise exception 'Contrato anterior nao encontrado para este lead';
  end if;

  v_indefinite := p_billing_type = 'recurring' and p_installments is null;

  insert into client_contracts (
    tenant_id, lead_id, billing_type, is_percentage, percentage_value,
    amount, installments, start_date, end_date, billing_day, status, created_by,
    previous_contract_id
  ) values (
    p_tenant_id, p_lead_id, p_billing_type, p_is_percentage, p_percentage_value,
    p_amount, p_installments, p_start_date, p_end_date,
    coalesce(p_billing_day, extract(day from p_start_date)::smallint),
    'active', p_created_by, p_previous_contract_id
  )
  returning id into v_contract_id;

  -- Fecha o antigo como SUBSTITUÍDO, não cancelado — é a diferença entre
  -- "o cliente saiu" e "o cliente cresceu".
  if p_previous_contract_id is not null then
    update client_contracts
    set status = 'upgraded'
    where id = p_previous_contract_id
      and status in ('active', 'paused');
  end if;

  v_amount_txt := 'R$ ' || to_char(round(p_amount, 2), 'FM999999990.00')
    || case when p_billing_type = 'recurring' then '/mês' else '' end;

  if p_billing_type = 'one_time' then
    if p_start_date >= v_today then
      v_title := 'Cobrar ' || v_lead_name || ' — pagamento único — ' || v_amount_txt;
      for v_manager in
        select user_id from user_memberships
        where tenant_id = p_tenant_id and role in ('admin','manager') and active = true
      loop
        insert into lead_tasks (tenant_id, lead_id, created_by, assigned_to, title, description, due_at)
        values (p_tenant_id, p_lead_id, p_created_by, v_manager.user_id, v_title,
                'Gerado automaticamente pelo contrato de cobrança.',
                p_start_date + interval '12 hours');
      end loop;
    end if;
    return v_contract_id;
  end if;

  while (p_start_date + (v_first_idx || ' months')::interval)::date < v_today loop
    v_first_idx := v_first_idx + 1;
    if p_installments is not null and v_first_idx >= p_installments then
      return v_contract_id;
    end if;
    if v_first_idx > 1200 then return v_contract_id; end if;
  end loop;

  v_last_idx := case
    when v_indefinite then v_first_idx + 11
    else p_installments - 1
  end;

  for v_i in v_first_idx..v_last_idx loop
    v_due_date := (p_start_date + (v_i || ' months')::interval)::date;

    exit when p_end_date is not null and v_due_date > p_end_date;

    v_due := v_due_date + interval '12 hours';

    if v_indefinite then
      v_title := 'Cobrar ' || v_lead_name || ' — mensalidade — ' || v_amount_txt
                 || case when v_i = v_last_idx then ' — gere mais lembretes se o contrato continuar' else '' end;
    elsif v_i = p_installments - 1 and p_installments > 1 then
      v_title := 'Cobrar ' || v_lead_name || ' — ÚLTIMA parcela (' || (v_i + 1) || '/' || p_installments || ') — '
                 || v_amount_txt || ' — considere renovar contrato';
    else
      v_title := 'Cobrar ' || v_lead_name || ' — parcela ' || (v_i + 1) || '/' || p_installments || ' — ' || v_amount_txt;
    end if;

    for v_manager in
      select user_id from user_memberships
      where tenant_id = p_tenant_id and role in ('admin','manager') and active = true
    loop
      insert into lead_tasks (tenant_id, lead_id, created_by, assigned_to, title, description, due_at)
      values (p_tenant_id, p_lead_id, p_created_by, v_manager.user_id, v_title,
              'Gerado automaticamente pelo contrato de cobrança.', v_due);
    end loop;
  end loop;

  return v_contract_id;
end;
$function$;

-- Remove a versao de 11 args: com as duas vivas, chamar com 11 argumentos
-- (o que o app fazia ate agora) vira "function is not unique" e quebra a
-- criacao de contrato pelo caminho que a tela usa.
drop function if exists public.create_client_contract(
  uuid, uuid, text, boolean, numeric, numeric, integer, date, smallint, uuid, date
);

-- CREATE OR REPLACE reseta grants — reaplicar sempre.
revoke all on function public.create_client_contract(uuid, uuid, text, boolean, numeric, numeric, integer, date, smallint, uuid, date, uuid) from public, anon;
grant execute on function public.create_client_contract(uuid, uuid, text, boolean, numeric, numeric, integer, date, smallint, uuid, date, uuid) to authenticated;
