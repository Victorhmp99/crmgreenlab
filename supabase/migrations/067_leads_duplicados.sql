-- Procurar e juntar leads duplicados.
--
-- Duplicata custa de três formas: dois vendedores ligam pra mesma pessoa (o
-- cliente percebe e desconfia), o histórico fica partido em dois cards, e a
-- API de Conversões pode contar a mesma venda duas vezes — ensinando errado a
-- campanha que a gente acabou de ligar.
--
-- O casamento é pelos ÚLTIMOS 8 DÍGITOS do telefone, mesma regra do registro
-- de chamada: o lead pode estar gravado como (11) 98765-4321 ou +5511987654321,
-- e ainda existe o nono dígito, que aparece de um lado e não do outro. Os 8
-- finais são a parte estável. Já existe índice por (tenant_id, sufixo).
--
-- TUDO é por empresa. Uma busca global cruzaria base de clientes diferentes —
-- e o telefone de uma clínica não pode nem aparecer na tela de outra.

/**
 * Grupos de leads que parecem a mesma pessoa, dentro de UMA empresa.
 *
 * Devolve o que a pessoa precisa pra decidir qual manter sem abrir os dois:
 * quando entrou, em que etapa está, de quem é, e quanto histórico tem.
 */
create or replace function buscar_leads_duplicados(p_tenant_id uuid)
returns table (
  chave        text,
  lead_id      uuid,
  nome         text,
  telefone     text,
  email        text,
  criado_em    timestamptz,
  etapa        text,
  responsavel  text,
  atividades   bigint,
  contratos    bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  -- SECURITY DEFINER ignora o RLS, então a checagem de empresa é obrigatória
  -- aqui: sem ela, qualquer pessoa logada leria os telefones de qualquer
  -- clínica só passando outro tenant_id.
  if not is_tenant_member(p_tenant_id)
     and not exists (select 1 from super_admins where user_id = auth.uid()) then
    raise exception 'Sem permissão nesta empresa';
  end if;

  return query
  with normalizados as (
    select l.id, l.name, l.phone, l.email, l.created_at, l.assigned_to,
           right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 8) as sufixo
    from leads l
    where l.tenant_id = p_tenant_id
      and length(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g')) >= 8
  ),
  repetidos as (
    select n.sufixo from normalizados n group by n.sufixo having count(*) > 1
  )
  select
    n.sufixo,
    n.id,
    n.name,
    n.phone,
    n.email,
    n.created_at,
    st.name,
    coalesce(p.full_name, p.email),
    (select count(*) from lead_activities a where a.lead_id = n.id),
    (select count(*) from client_contracts c where c.lead_id = n.id)
  from normalizados n
  join repetidos r on r.sufixo = n.sufixo
  left join pipeline_cards   pc on pc.lead_id = n.id
  left join pipeline_stages  st on st.id = pc.stage_id
  left join profiles         p  on p.id = n.assigned_to
  -- Mais antigo primeiro: normalmente é o que tem histórico e deve ser mantido.
  order by n.sufixo, n.created_at asc;
end;
$$;

revoke all on function buscar_leads_duplicados(uuid) from public, anon;
grant execute on function buscar_leads_duplicados(uuid) to authenticated;

/**
 * Junta dois leads num só. NÃO é "apagar o repetido".
 *
 * Apagar direto destruiria dado de receita em silêncio: sete tabelas apontam
 * pra leads em CASCADE, incluindo client_contracts. E financial_records é NO
 * ACTION, então a exclusão nem sempre passaria — falharia com erro de chave
 * estrangeira, em inglês, sem dizer o que fazer.
 *
 * Então tudo é MOVIDO pro lead mantido antes de remover o outro.
 */
create or replace function mesclar_leads(p_tenant_id uuid, p_manter uuid, p_remover uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_tem_card boolean;
begin
  if p_manter = p_remover then
    raise exception 'Escolha dois leads diferentes';
  end if;

  -- Juntar leads apaga um deles: é operação de limpeza, não de rotina de
  -- vendedor.
  if not is_tenant_manager(p_tenant_id)
     and not exists (select 1 from super_admins where user_id = auth.uid()) then
    raise exception 'Apenas gestores podem juntar leads';
  end if;

  -- Os DOIS têm que ser da empresa informada. Sem esta checagem, mandar o id
  -- de um lead de outra clínica juntaria (e apagaria) dado alheio.
  if not exists (select 1 from leads where id = p_manter  and tenant_id = p_tenant_id)
  or not exists (select 1 from leads where id = p_remover and tenant_id = p_tenant_id) then
    raise exception 'Lead não encontrado nesta empresa';
  end if;

  -- Dinheiro primeiro: é o que não pode se perder de jeito nenhum.
  update client_contracts   set lead_id = p_manter where lead_id = p_remover;
  update financial_records  set lead_id = p_manter where lead_id = p_remover;

  -- Histórico.
  update lead_activities set lead_id = p_manter where lead_id = p_remover;
  update lead_comments   set lead_id = p_manter where lead_id = p_remover;
  update lead_tasks      set lead_id = p_manter where lead_id = p_remover;

  -- Etiquetas: a chave é (lead_id, tag_id), então a etiqueta que os dois já
  -- têm colidiria. Move o que falta e descarta o resto.
  insert into lead_tag_links (lead_id, tag_id)
  select p_manter, tag_id from lead_tag_links where lead_id = p_remover
  on conflict do nothing;
  delete from lead_tag_links where lead_id = p_remover;

  -- Eventos do Meta: unique (lead_id, event_name). Só migra evento que o lead
  -- mantido ainda não tem — o repetido seria recusado, e reenviar não faria
  -- sentido de qualquer forma.
  update meta_conversion_events e set lead_id = p_manter
   where e.lead_id = p_remover
     and not exists (
       select 1 from meta_conversion_events x
       where x.lead_id = p_manter and x.event_name = e.event_name
     );
  delete from meta_conversion_events where lead_id = p_remover;

  -- Card do funil: a chave é única por lead, então não dá pra ter os dois. Se
  -- o mantido já está no funil, o card do repetido some; se não está, herda a
  -- posição dele em vez de sumir do quadro.
  select exists (select 1 from pipeline_cards where lead_id = p_manter) into v_tem_card;
  if v_tem_card then
    delete from pipeline_cards where lead_id = p_remover;
  else
    update pipeline_cards set lead_id = p_manter where lead_id = p_remover;
  end if;

  -- Completa o que faltava no mantido com o que o repetido tinha. É comum o
  -- lead novo ter o e-mail que o antigo não tinha; sem isto, juntar perderia
  -- justamente o dado que só existia numa das cópias.
  update leads m set
    email          = coalesce(nullif(m.email, ''),          r.email),
    company_name   = coalesce(nullif(m.company_name, ''),   r.company_name),
    source_campaign= coalesce(nullif(m.source_campaign,''), r.source_campaign),
    fbc            = coalesce(nullif(m.fbc, ''),            r.fbc),
    fbp            = coalesce(nullif(m.fbp, ''),            r.fbp),
    value          = coalesce(m.value,                      r.value),
    channel_id     = coalesce(m.channel_id,                 r.channel_id),
    assigned_to    = coalesce(m.assigned_to,                r.assigned_to),
    notes          = case
                       when coalesce(nullif(r.notes, ''), '') = '' then m.notes
                       when coalesce(nullif(m.notes, ''), '') = '' then r.notes
                       -- Some texto de anotação seria perda invisível: junta.
                       else m.notes || E'\n\n— juntado do lead repetido —\n' || r.notes
                     end,
    tags           = (select array(select distinct unnest(coalesce(m.tags,  '{}') || coalesce(r.tags, '{}')))),
    -- No jsonb o operando da DIREITA vence: o que o mantido já tinha prevalece.
    custom_fields  = coalesce(r.custom_fields, '{}'::jsonb) || coalesce(m.custom_fields, '{}'::jsonb),
    updated_at     = now()
  from leads r
  where m.id = p_manter and r.id = p_remover;

  delete from leads where id = p_remover and tenant_id = p_tenant_id;
end;
$$;

revoke all on function mesclar_leads(uuid, uuid, uuid) from public, anon;
grant execute on function mesclar_leads(uuid, uuid, uuid) to authenticated;
