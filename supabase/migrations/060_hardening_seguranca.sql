-- Segunda rodada da auditoria: verificação empírica dos achados anteriores.
-- Migrations 067 a 069 no Supabase, aplicadas em 28/08/2026.

-- ── 1. O REVOKE anterior NÃO tinha funcionado ──────────────────────────────
-- Revoguei de `authenticated` e `anon`, mas a permissão vinha de PUBLIC, que
-- todo papel herda. Revogar do papel específico não tira o que veio por
-- herança: a função continuou aberta. Só apareceu ao CONFERIR a permissão em
-- vez de confiar no comando ter surtido efeito.
--
-- Junto: havia duas versões de match_or_create_lead_by_phone. Chamada com 5
-- argumentos ficava ambígua (a de 6 tem default) e o Postgres recusava — ou
-- seja, além de aberta, estava quebrada pra quem chamasse com 5.
drop function if exists match_or_create_lead_by_phone(uuid, text, text, uuid, uuid);
revoke execute on function match_or_create_lead_by_phone(uuid, text, text, uuid, uuid, uuid)
  from public, anon, authenticated;

revoke execute on function delete_user_completely(uuid) from public, anon;
grant  execute on function delete_user_completely(uuid) to authenticated;
revoke execute on function create_signup_token(user_role, uuid) from public, anon;
grant  execute on function create_signup_token(user_role, uuid) to authenticated;
revoke execute on function notify_due_tasks() from public, anon, authenticated;

-- ── 2. Cadastro criava empresa e ADMIN sem login ───────────────────────────
-- register_new_tenant_with_admin recebia o id do usuário como ARGUMENTO e era
-- chamável sem sessão. Sem token, criava empresa nova já concedendo papel
-- 'admin' — o nível de revenda — pra um id qualquer informado por quem
-- chamou. E dava pra vincular OUTRA pessoa a uma empresa do atacante.
--
-- O app só chama depois do signUp, com sessão criada, então exigir que o id
-- seja o do próprio usuário logado não muda o fluxo legítimo.
-- (Corpo completo aplicado na migration 068 do Supabase.)

-- ── 3. Enumeração de usuários ──────────────────────────────────────────────
-- check_email_exists respondia, sem login, se um e-mail qualquer tem conta.
-- Dava pra varrer uma lista e descobrir quem é cliente da plataforma.
--
-- A única tela que precisava JÁ TEM o token do convite, e tira o e-mail dele.
-- A pergunta passou a ser amarrada ao token: sem convite válido, ninguém
-- descobre nada sobre ninguém. Token inválido devolve `false`, igual a "não
-- tem conta", pra não virar oráculo.
create or replace function invite_email_has_account(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_email text;
begin
  select email into v_email
  from tenant_invites
  where token = p_token and accepted_at is null and expires_at > now();

  if v_email is null then return false; end if;

  return exists (select 1 from auth.users u where lower(u.email) = lower(v_email));
end;
$$;

revoke all on function invite_email_has_account(text) from public;
grant execute on function invite_email_has_account(text) to anon, authenticated;

revoke execute on function check_email_exists(text) from public, anon;
grant  execute on function check_email_exists(text) to authenticated;
