-- O envio em lote de 5 em 5 minutos é o certo pra operação: agrupa chamadas e
-- não deixa o Kanban esperando HTTP externo. Mas na hora de CONFIGURAR, cinco
-- minutos de espera sem saber se vai funcionar é péssimo — a pessoa fica
-- recarregando tela sem saber se o problema é dela ou do sistema.
create or replace function enviar_eventos_meta_agora(p_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pendentes integer;
begin
  if not is_tenant_admin(p_tenant_id)
     and not exists (select 1 from super_admins sa where sa.user_id = auth.uid())
  then
    raise exception 'Unauthorized';
  end if;

  select count(*) into v_pendentes
  from meta_conversion_events
  where tenant_id = p_tenant_id and status in ('pending', 'failed') and attempts < 5;

  if v_pendentes > 0 then
    -- Reaproveita a mesma drenagem do cron: um caminho só de envio, pra não
    -- existir a chance de o botão e o automático se comportarem diferente.
    perform drenar_fila_meta_conversions();
  end if;

  return v_pendentes;
end;
$$;

revoke all on function enviar_eventos_meta_agora(uuid) from public, anon;
grant execute on function enviar_eventos_meta_agora(uuid) to authenticated;

comment on function enviar_eventos_meta_agora(uuid) is
  'Dispara a fila na hora, sem esperar o cron. Existe pro momento da configuração; a operação normal não precisa.';
