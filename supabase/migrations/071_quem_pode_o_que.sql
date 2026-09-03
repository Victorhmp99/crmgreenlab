-- Quem pode o quê: fecha três buracos encontrados na revisão de permissões.
--
-- A revisão anterior (069) tratou do usuário NÃO autenticado. Esta trata do
-- autenticado com o papel errado — que é o caso real: o funcionário que saiu,
-- o admin que não é dono, o vendedor mexendo no que não é dele.

-- ── 1. Excluir a empresa: só o DONO ────────────────────────────────────────
-- `delete_tenant` aceitava QUALQUER admin ativo da empresa. Numa empresa com
-- dois admins, o segundo podia apagar tudo — leads, contratos, histórico — e
-- a cascata do banco não deixa nada pra trás. Quem criou a empresa não tinha
-- como impedir.
--
-- `tenants.owner_user_id` já existe e está preenchido nas 14 empresas, então
-- a regra vale desde já, sem depender de ninguém preencher nada.
create or replace function public.delete_tenant(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_dono    uuid;
  v_super   boolean := exists (select 1 from super_admins where user_id = v_user_id);
begin
  select owner_user_id into v_dono from tenants where id = p_tenant_id;

  if v_dono is null and not v_super then
    return jsonb_build_object('error', 'Empresa sem dono definido. Fale com o suporte.');
  end if;

  -- A diferença que importa: ser admin não basta, tem que ser o dono.
  if v_dono is distinct from v_user_id and not v_super then
    return jsonb_build_object(
      'error', 'Só quem criou a empresa pode excluí-la. Peça ao responsável.');
  end if;

  -- Guarda antiga, mantida: apagar a única empresa derruba o próprio acesso.
  if not exists (
    select 1 from user_memberships
    where user_id = v_user_id and tenant_id <> p_tenant_id and active = true
  ) and not v_super then
    return jsonb_build_object('error', 'Você não pode excluir sua única empresa.');
  end if;

  delete from tenants where id = p_tenant_id;

  return jsonb_build_object('success', true);
end;
$function$;

revoke all on function public.delete_tenant(uuid) from public, anon;
grant execute on function public.delete_tenant(uuid) to authenticated;

-- ── 2. O dono não pode ser derrubado por outro admin ────────────────────────
-- Sem isto, a regra acima se contorna em dois passos: um admin rebaixa o dono
-- (ou desativa a conta dele) e vira o único admin da empresa. A política
-- `admins_manage_memberships` permite exatamente isso hoje.
create or replace function public.tg_protege_dono_da_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dono  uuid;
  v_alvo  record := coalesce(new, old);
  v_quem  uuid := auth.uid();
begin
  -- Rotina interna (cron, edge function com service_role) não tem usuário.
  -- Bloquear aqui quebraria manutenção legítima sem proteger ninguém: quem
  -- tem a chave de serviço já tem acesso total ao banco.
  if v_quem is null then
    return v_alvo;
  end if;

  select owner_user_id into v_dono from tenants where id = v_alvo.tenant_id;

  -- Empresa sendo apagada em cascata: a linha de tenants já não existe.
  if v_dono is null or v_alvo.user_id is distinct from v_dono then
    return v_alvo;
  end if;

  if v_quem = v_dono or exists (select 1 from super_admins where user_id = v_quem) then
    return v_alvo;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Não é possível remover o dono da empresa';
  end if;

  -- No UPDATE só travam os dois campos que tiram o poder de quem é dono.
  -- O resto (ramal, aparelho) segue liberado pra administração do dia a dia.
  if new.role is distinct from old.role then
    raise exception 'Não é possível alterar o papel do dono da empresa';
  end if;
  if new.active is distinct from old.active then
    raise exception 'Não é possível desativar o dono da empresa';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protege_dono_da_empresa on user_memberships;
create trigger trg_protege_dono_da_empresa
  before update or delete on user_memberships
  for each row execute function tg_protege_dono_da_empresa();

-- ── 3. Funções de bastidor não são chamáveis pela tela ──────────────────────
-- Estas recebem `tenant_id` por parâmetro e NÃO conferem nada — o que faz
-- sentido, porque quem as chama são webhooks com a chave de serviço. O que
-- não fazia sentido é `authenticated` poder executá-las: qualquer pessoa
-- logada podia gravar ligação, criar lead ou disparar o aviso de tarefas em
-- QUALQUER empresa da plataforma, não só na dela. Nenhuma é chamada pelo app
-- (conferido: só pelas edge functions telefonia-webhook e receive-whatsapp,
-- que usam service_role).
revoke all on function public.registrar_chamada(uuid, uuid, uuid, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_chamada(uuid, uuid, uuid, text, integer, text, text, text) to service_role;

revoke all on function public.registrar_chamada_do_ramal(uuid, text, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.registrar_chamada_do_ramal(uuid, text, text, text, integer, text, text) to service_role;

revoke all on function public.match_or_create_lead_by_phone(uuid, text, text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.match_or_create_lead_by_phone(uuid, text, text, uuid, uuid, uuid) to service_role;

revoke all on function public.notify_due_tasks() from public, anon, authenticated;
grant execute on function public.notify_due_tasks() to service_role;

-- Auxiliar interna da migration 070: só é chamada de dentro de outras funções,
-- que rodam como dono e não dependem deste grant.
revoke all on function public.responsavel_pela_cobranca(uuid, uuid, uuid) from public, anon, authenticated;

-- ── 4. Trocar a chave do webhook é ato de gestão ────────────────────────────
-- Bastava ser membro ativo — vendedor incluído. Trocar a chave não vaza nada,
-- mas derruba a captação de leads dos formulários até alguém atualizar o
-- link, e ninguém entende por que os leads pararam de entrar.
create or replace function public.regenerate_webhook_key(p_tenant_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_new_key uuid;
begin
  if not is_tenant_manager(p_tenant_id) then
    raise exception 'Unauthorized';
  end if;
  v_new_key := gen_random_uuid();
  update tenant_settings set webhook_key = v_new_key where tenant_id = p_tenant_id;
  return v_new_key;
end;
$function$;

revoke all on function public.regenerate_webhook_key(uuid) from public, anon;
grant execute on function public.regenerate_webhook_key(uuid) to authenticated;
