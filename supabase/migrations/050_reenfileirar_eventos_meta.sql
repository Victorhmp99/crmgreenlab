-- Depois de 5 tentativas o evento para de ser tentado, o que é certo pra não
-- martelar a API do Meta pra sempre. Mas a causa mais comum de falha é
-- credencial errada — e aí, quando a pessoa arruma o token, aqueles leads
-- ficariam queimados: o unique(lead_id, event_name) impede que o evento seja
-- gerado de novo, então eles nunca mais seriam enviados.
--
-- Esta função devolve os falhos pra fila. É chamada automaticamente ao salvar
-- credencial nova (é exatamente quando a causa costuma ter sido resolvida) e
-- também por um botão, pro caso de a falha ter sido do lado do Meta.
create or replace function reenfileirar_eventos_meta(p_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd integer;
begin
  -- Mexe em envio de dado pra fora: mesma régua de quem pode configurar a
  -- credencial (admin da empresa), não qualquer membro.
  if not is_tenant_admin(p_tenant_id)
     and not exists (select 1 from super_admins sa where sa.user_id = auth.uid())
  then
    raise exception 'Unauthorized';
  end if;

  update meta_conversion_events
     set status = 'pending', attempts = 0, last_error = null
   where tenant_id = p_tenant_id
     and status in ('failed', 'skipped');

  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

revoke all on function reenfileirar_eventos_meta(uuid) from public, anon;
grant execute on function reenfileirar_eventos_meta(uuid) to authenticated;

comment on function reenfileirar_eventos_meta(uuid) is
  'Devolve pra fila os eventos que falharam. Evita que lead fique queimado por credencial errada, já que o unique(lead_id,event_name) impede regerar o evento.';
