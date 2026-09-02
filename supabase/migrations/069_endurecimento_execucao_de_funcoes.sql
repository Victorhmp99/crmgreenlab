-- Corta o acesso de usuário NÃO AUTENTICADO às funções do banco.
--
-- No Postgres, função nasce com EXECUTE para PUBLIC — e `anon` herda dali. Era
-- assim que 60 funções SECURITY DEFINER estavam chamáveis sem nenhum login.
--
-- A maioria confere permissão por dentro e só devolvia "Unauthorized", então o
-- dado de cliente nunca esteve exposto. Mas depender disso é sorte: basta UMA
-- função nova sem checagem pra virar buraco. E aconteceu — `subir_card_do_lead`
-- respondia HTTP 204 e reordenava card de qualquer empresa, sem login.
--
-- A regra passa a ser a inversa: ninguém executa nada, e quem precisa recebe
-- explicitamente. Função nova nasce fechada, mesmo que alguém esqueça o REVOKE.

-- Função sem search_path fixo é vetor de sequestro de esquema: quem controlar
-- o search_path decide qual `lower()` ou `replace()` roda.
alter function normalizar_nome(text) set search_path = public;

do $$
declare
  r record;
  /* Únicas que PRECISAM funcionar sem login: são o fluxo de convite/cadastro.
     Todas recebem TOKEN, não e-mail — então não servem pra descobrir se um
     e-mail tem conta, que seria um oráculo de enumeração de usuários. */
  publicas text[] := array['get_invite_info', 'get_signup_token_info', 'invite_email_has_account'];
begin
  for r in
    select p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) as args,
           p.prorettype = 'pg_catalog.trigger'::regtype as e_gatilho
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function public.%I(%s) from public, anon',
                   r.proname, r.args);

    /* Função de gatilho não é chamada por ninguém diretamente: quem dispara é
       o banco, com os privilégios do dono. Conceder a alguém só aumentaria a
       superfície sem servir pra nada. */
    if r.e_gatilho then
      continue;
    end if;

    if r.proname = any(publicas) then
      execute format('grant execute on function public.%I(%s) to anon, authenticated',
                     r.proname, r.args);
    else
      /* `authenticated` é obrigatório inclusive para os ajudantes usados DENTRO
         das políticas de RLS (is_tenant_member e afins): a política é avaliada
         como o usuário que consulta, então sem EXECUTE toda leitura quebraria.
         `service_role` é o que as Edge Functions usam pra gravar. */
      execute format('grant execute on function public.%I(%s) to authenticated, service_role',
                     r.proname, r.args);
    end if;
  end loop;
end $$;
