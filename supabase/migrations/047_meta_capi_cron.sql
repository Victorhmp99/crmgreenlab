-- Drenagem automática da fila da API de Conversões.

-- pg_net: o pg_cron sozinho não fala HTTP, só roda SQL. Sem isso não há como
-- a fila ser drenada sem alguém clicar num botão.
create extension if not exists pg_net with schema extensions;

-- Segredo compartilhado entre o cron e a Edge Function, guardado no Vault e
-- não em texto puro dentro do comando do cron — qualquer um com acesso de
-- leitura à tabela cron.job enxergaria o comando.
do $$
declare
  v_segredo text;
begin
  if not exists (select 1 from vault.secrets where name = 'meta_capi_cron_secret') then
    v_segredo := encode(extensions.gen_random_bytes(32), 'hex');
    perform vault.create_secret(v_segredo, 'meta_capi_cron_secret',
      'Header x-cron-secret usado pelo cron ao chamar a Edge Function send-meta-conversions');
  end if;
end $$;

-- ── Drenagem da fila ───────────────────────────────────────────────────────
-- A cada 5 minutos. Não é tempo real de propósito: o Meta não liga pra 5
-- minutos de atraso, e agrupar em lote reduz muito o número de chamadas.
create or replace function drenar_fila_meta_conversions()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_segredo text;
  v_url     text;
begin
  -- Não faz sentido acordar o serviço se não há nada pendente.
  if not exists (
    select 1 from meta_conversion_events
    where status in ('pending', 'failed') and attempts < 5
  ) then
    return;
  end if;

  select decrypted_secret into v_segredo
  from vault.decrypted_secrets where name = 'meta_capi_cron_secret';

  if v_segredo is null then
    raise warning 'meta_capi_cron_secret ausente no Vault — fila não drenada';
    return;
  end if;

  v_url := 'https://miezatcdfldmqmxgpkwr.supabase.co/functions/v1/send-meta-conversions';

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-cron-secret',  v_segredo
    ),
    body    := '{}'::jsonb
  );
end;
$$;

revoke all on function drenar_fila_meta_conversions() from public, anon, authenticated;

select cron.unschedule('drenar-meta-conversions')
where exists (select 1 from cron.job where jobname = 'drenar-meta-conversions');

select cron.schedule(
  'drenar-meta-conversions',
  '*/5 * * * *',
  $cron$ select drenar_fila_meta_conversions(); $cron$
);

-- ── Autenticação da Edge Function ──────────────────────────────────────────
-- O segredo do cron mora no Vault, e não numa variável de ambiente da Edge
-- Function. Assim o projeto se configura sozinho: o cron lê o segredo do Vault
-- pra mandar no header, a função pergunta ao Vault se confere. Ninguém precisa
-- colar valor em painel nenhum, e não existe cópia do segredo fora do banco.
create or replace function verificar_cron_secret(p_secret text)
returns boolean
language sql
security definer
set search_path = public, vault
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'meta_capi_cron_secret'
      and decrypted_secret = p_secret
  );
$$;

-- Só o service_role (a Edge Function) pode perguntar. Usuário logado no
-- navegador não tem como usar isso pra adivinhar o segredo por tentativa.
revoke all on function verificar_cron_secret(text) from public, anon, authenticated;
grant execute on function verificar_cron_secret(text) to service_role;

comment on function verificar_cron_secret(text) is
  'Confere o header x-cron-secret da Edge Function contra o segredo do Vault. Exclusiva do service_role.';
