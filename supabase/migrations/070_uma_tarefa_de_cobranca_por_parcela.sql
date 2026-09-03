-- Uma tarefa de cobrança por parcela — não uma por gestor.
--
-- As duas funções que geram tarefa de contrato faziam um laço nos gestores da
-- empresa e inseriam a MESMA tarefa pra cada um. Numa empresa com 3 gestores,
-- um contrato de 3 parcelas virava 9 tarefas: três por data, idênticas, e o
-- sino avisava as três. Na Green Hub eram 147 tarefas pra 49 cobranças reais.
--
-- A intenção era "todo gestor tem que ver a cobrança". O efeito foi o oposto:
-- com a lista triplicada ninguém sabe quais são as cobranças de verdade, e
-- concluir a sua deixa as outras duas vencendo na tela dos colegas.
--
-- Agora a tarefa tem UM dono. Quem tem acesso ao financeiro continua vendo a
-- cobrança pela tela de contratos; a tarefa é de quem vai executá-la.

-- ── Quem fica com a cobrança ───────────────────────────────────────────────
-- Ordem pensada pra nunca sobrar tarefa órfã (atribuída a alguém que saiu da
-- empresa): cai pro próximo da lista até achar um gestor ativo.
create or replace function public.responsavel_pela_cobranca(
  p_tenant_id uuid,
  p_lead_id   uuid,
  p_preferido uuid          -- quem criou o contrato; null quando é rotina
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    -- 1) Quem criou o contrato. É quem acabou de fechar e sabe o combinado.
    (select um.user_id from user_memberships um
      where um.tenant_id = p_tenant_id and um.user_id = p_preferido and um.active),
    -- 2) O dono do lead, quando o contrato veio de rotina (sem criador).
    (select um.user_id from user_memberships um
      join leads l on l.assigned_to = um.user_id
     where l.id = p_lead_id and l.tenant_id = p_tenant_id
       and um.tenant_id = p_tenant_id and um.active),
    -- 3) O gestor mais antigo da empresa. Admin na frente de manager, e
    --    `created_at` como desempate pra escolha não mudar entre execuções.
    (select um.user_id from user_memberships um
      where um.tenant_id = p_tenant_id
        and um.role in ('admin','manager') and um.active
      order by case um.role when 'admin' then 0 else 1 end, um.created_at
      limit 1)
  );
$$;

revoke all on function public.responsavel_pela_cobranca(uuid, uuid, uuid) from public, anon;

-- ── Criação do contrato ────────────────────────────────────────────────────
-- Mesma assinatura de 12 args da migration 045 — não acrescentar parâmetro
-- aqui: CREATE OR REPLACE com assinatura diferente cria uma SEGUNDA função e
-- a criação de contrato quebra por ambiguidade (já aconteceu na 044).
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
  v_dono        uuid;
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

  v_dono := responsavel_pela_cobranca(p_tenant_id, p_lead_id, p_created_by);

  v_amount_txt := 'R$ ' || to_char(round(p_amount, 2), 'FM999999990.00')
    || case when p_billing_type = 'recurring' then '/mês' else '' end;

  if p_billing_type = 'one_time' then
    if p_start_date >= v_today then
      insert into lead_tasks (tenant_id, lead_id, created_by, assigned_to, title, description, due_at)
      values (p_tenant_id, p_lead_id, p_created_by, v_dono,
              'Cobrar ' || v_lead_name || ' — pagamento único — ' || v_amount_txt,
              'Gerado automaticamente pelo contrato de cobrança.',
              p_start_date + interval '12 hours');
    end if;
    return v_contract_id;
  end if;

  -- Pula as parcelas que já venceram: cobrança de mês passado não vira tarefa
  -- de hoje.
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

    insert into lead_tasks (tenant_id, lead_id, created_by, assigned_to, title, description, due_at)
    values (p_tenant_id, p_lead_id, p_created_by, v_dono, v_title,
            'Gerado automaticamente pelo contrato de cobrança.', v_due);
  end loop;

  return v_contract_id;
end;
$function$;

-- CREATE OR REPLACE reseta grants — reaplicar sempre (migration 069).
revoke all on function public.create_client_contract(uuid, uuid, text, boolean, numeric, numeric, integer, date, smallint, uuid, date, uuid) from public, anon;
grant execute on function public.create_client_contract(uuid, uuid, text, boolean, numeric, numeric, integer, date, smallint, uuid, date, uuid) to authenticated;

-- ── Contrato que venceu ────────────────────────────────────────────────────
-- Mesmo defeito, mesma correção: a tarefa de renovação também saía uma por
-- gestor. Aqui não há criador (é rotina), então o dono do lead decide.
create or replace function public.expire_due_contracts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contrato record;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_total integer := 0;
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

    insert into lead_tasks (tenant_id, lead_id, created_by, assigned_to, title, description, due_at)
    values (
      v_contrato.tenant_id, v_contrato.lead_id, null,
      responsavel_pela_cobranca(v_contrato.tenant_id, v_contrato.lead_id, null),
      'Renovar contrato de ' || v_contrato.lead_name
        || ' — venceu em ' || to_char(v_contrato.end_date, 'DD/MM/YYYY'),
      'O contrato chegou ao fim e foi pausado automaticamente. '
        || 'Renove para voltar a faturar, ou cancele se o cliente não seguir.',
      (v_hoje + interval '12 hours')
    );

    v_total := v_total + 1;
  end loop;

  return v_total;
end $$;

revoke all on function public.expire_due_contracts() from public, anon;
grant execute on function public.expire_due_contracts() to service_role;
