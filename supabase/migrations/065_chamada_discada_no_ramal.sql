-- Ligação discada direto no ramal (app SIP), sem passar pelo botão do CRM.
--
-- Hoje ela se perde: o vínculo com o lead viaja no `metadata` que o CRM manda
-- ao disparar a chamada, e quem digita o número no aplicativo não passa por
-- ali. O webhook recebe o fim da chamada sem lead nenhum e descarta.
--
-- Mas o número discado costuma ser de um lead que já existe. Cruzando por
-- telefone dá pra recuperar justamente a ligação que hoje some do histórico
-- — e some também da taxa de atendimento, que é o número que a operação quer.
--
-- Fica inerte enquanto a Api4Com só nos avisar das chamadas que o CRM origina.
-- Se ela passar a mandar todas, isto começa a valer no mesmo instante.

-- Passa a registrar de ONDE veio a chamada. Sem isso, ligação discada no
-- aplicativo e ligação disparada pelo CRM ficam indistinguíveis no histórico,
-- e não dá pra saber se a equipe está usando o botão ou driblando ele.
--
-- Precisa de DROP antes: acrescentar parâmetro com CREATE OR REPLACE deixaria
-- as duas versões vivas e as chamadas de 7 argumentos passariam a dar
-- "function is not unique".
drop function if exists registrar_chamada(uuid, uuid, uuid, text, int, text, text);

create function registrar_chamada(
  p_tenant_id uuid, p_lead_id uuid, p_user_id uuid,
  p_resultado text, p_duracao int, p_gravacao text, p_chamada_id text,
  p_origem text default 'api4com'
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into lead_activities (tenant_id, lead_id, user_id, type, description, metadata, external_id)
  values (
    p_tenant_id, p_lead_id, p_user_id, 'call',
    case p_resultado
      when 'atendeu'     then 'Ligação atendida — ' || coalesce(p_duracao, 0) || 's'
      when 'nao_atendeu' then 'Ligação não atendida'
      else 'Ligação — ' || coalesce(p_resultado, 'sem resultado')
    end,
    jsonb_strip_nulls(jsonb_build_object(
      'resultado', p_resultado, 'origem', p_origem, 'duracao', p_duracao,
      'gravacao', p_gravacao, 'chamada_id', p_chamada_id
    )),
    p_chamada_id
  )
  -- O provedor pode reenviar o mesmo evento. external_id evita a chamada
  -- aparecer duas vezes na linha do tempo.
  on conflict do nothing;
end;
$$;

revoke all on function registrar_chamada(uuid, uuid, uuid, text, int, text, text, text)
  from public, anon, authenticated;

/**
 * Registra uma chamada que não nasceu no CRM, descobrindo sozinha a quem ela
 * pertence. Devolve o lead encontrado, ou null quando não houver a quem
 * atribuir — o webhook usa isso pra distinguir "registrei" de "ignorei".
 *
 * O casamento é pelos ÚLTIMOS 8 DÍGITOS. Comparar o número inteiro não
 * funcionaria: o lead pode estar gravado como (11) 98765-4321, o provedor
 * manda +5511987654321, e ainda existe o nono dígito, que aparece num lado e
 * não no outro. Os 8 finais são a parte estável.
 */
create or replace function registrar_chamada_do_ramal(
  p_tenant_id uuid, p_telefone text, p_ramal text,
  p_resultado text, p_duracao int, p_gravacao text, p_chamada_id text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_sufixo  text;
  v_lead_id uuid;
  v_user_id uuid;
begin
  v_sufixo := right(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), 8);

  -- Menos de 8 dígitos não é telefone de cliente: é o próprio ramal, número
  -- curto de operadora ou lixo. Casar por aí atribuiria ligação ao lead errado.
  if length(v_sufixo) < 8 then
    return null;
  end if;

  -- Havendo mais de um lead com o mesmo número, o mais recente vence. São
  -- duplicatas da MESMA pessoa — descartar por ambiguidade perderia a ligação
  -- inteira, que é pior do que anexá-la a uma das cópias.
  select id into v_lead_id
  from leads
  where tenant_id = p_tenant_id
    and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 8) = v_sufixo
  order by updated_at desc nulls last, created_at desc
  limit 1;

  if v_lead_id is null then
    return null;
  end if;

  -- O ramal identifica quem ligou. Sem isso a chamada entraria órfã e não
  -- entraria na conta de ninguém.
  select user_id into v_user_id
  from user_memberships
  where tenant_id = p_tenant_id and ramal = p_ramal
  limit 1;

  perform registrar_chamada(
    p_tenant_id, v_lead_id, v_user_id,
    p_resultado, p_duracao, p_gravacao, p_chamada_id, 'ramal'
  );

  return v_lead_id;
end;
$$;

revoke all on function registrar_chamada_do_ramal(uuid, text, text, text, int, text, text)
  from public, anon, authenticated;

-- O cruzamento varre os leads da empresa a cada chamada. Sem índice isso é
-- varredura completa numa base que já passa de mil leads por empresa.
create index if not exists idx_leads_telefone_sufixo
  on leads (tenant_id, right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 8));
