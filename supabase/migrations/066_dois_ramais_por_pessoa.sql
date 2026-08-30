-- Dois ramais por pessoa: um no computador, outro no celular.
--
-- A central da Api4Com aceita UM aparelho registrado por ramal. Quando o
-- softphone do celular registra, o webphone do computador cai — eles se
-- expulsam. Então não dá pra atender nos dois com um ramal só, e quem trabalha
-- fora da mesa fica escolhendo entre perder a ligação ou perder o computador.
--
-- Com dois ramais a pessoa escolhe onde quer receber, e troca com um clique em
-- vez de reconfigurar aparelho. O segundo ramal é cobrado como usuário
-- adicional no provedor — é uma decisão de custo de cada empresa, por isso o
-- campo nasce vazio e nada muda pra quem usa só um.

alter table user_memberships add column if not exists ramal_movel text;

comment on column user_memberships.ramal_movel is
  'Segundo ramal, do celular/tablet. Opcional: custa um usuário a mais no provedor.';

-- Qual aparelho deve tocar. Fica no vínculo junto dos ramais porque a escolha
-- é por empresa: a mesma pessoa pode atender uma na mesa e outra na rua.
alter table user_memberships add column if not exists aparelho text
  not null default 'computador';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_memberships_aparelho_valido'
  ) then
    alter table user_memberships add constraint user_memberships_aparelho_valido
      check (aparelho in ('computador', 'celular'));
  end if;
end $$;

-- ── Qual ramal tocar ───────────────────────────────────────────────────────
-- Devolve o ramal do aparelho escolhido. A Edge Function que disca continua
-- chamando isto e não precisa saber que existem dois — o desvio inteiro mora
-- aqui.
create or replace function meu_ramal(p_tenant_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    -- Escolheu celular mas nunca preencheu o ramal dele: cai pro computador
    -- em vez de recusar a ligação. Perder a chamada seria pior que tocar no
    -- lugar menos conveniente, e a tela só oferece a troca quando os dois
    -- existem — então isto é rede de segurança, não caminho comum.
    when m.aparelho = 'celular' then coalesce(nullif(m.ramal_movel, ''), m.ramal)
    else coalesce(nullif(m.ramal, ''), m.ramal_movel)
  end
  from user_memberships m
  where m.tenant_id = p_tenant_id and m.user_id = auth.uid() and m.active;
$$;

revoke all on function meu_ramal(uuid) from public, anon;
grant execute on function meu_ramal(uuid) to authenticated;

-- ── Gestor define os ramais de cada pessoa ─────────────────────────────────
-- Ganhou o parâmetro do celular. Precisa de DROP: acrescentar parâmetro com
-- CREATE OR REPLACE deixaria as duas versões vivas e as chamadas de dois
-- argumentos passariam a dar "function is not unique".
drop function if exists definir_ramal(uuid, text);

create function definir_ramal(p_membership_id uuid, p_ramal text, p_movel boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from user_memberships where id = p_membership_id;
  if v_tenant is null then
    raise exception 'Vínculo não encontrado';
  end if;

  if not is_tenant_manager(v_tenant)
     and not exists (select 1 from super_admins where user_id = auth.uid()) then
    raise exception 'Sem permissão para definir ramais nesta empresa';
  end if;

  if p_movel then
    update user_memberships
       set ramal_movel = nullif(btrim(p_ramal), '')
     where id = p_membership_id;
  else
    update user_memberships
       set ramal = nullif(btrim(p_ramal), '')
     where id = p_membership_id;
  end if;
end;
$$;

revoke all on function definir_ramal(uuid, text, boolean) from public, anon;
grant execute on function definir_ramal(uuid, text, boolean) to authenticated;

comment on function definir_ramal(uuid, text, boolean) is
  'Define o ramal de um membro; p_movel escolhe entre o do computador e o do celular.';

-- ── A pessoa escolhe onde quer receber ─────────────────────────────────────
-- Diferente de definir_ramal: não é o gestor configurando terceiros, é cada
-- um trocando o PRÓPRIO aparelho, o que acontece várias vezes por dia. Por
-- isso mexe só no vínculo de quem chamou, sem checar papel.
create or replace function definir_aparelho(p_tenant_id uuid, p_aparelho text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_aparelho not in ('computador', 'celular') then
    raise exception 'Aparelho inválido';
  end if;

  update user_memberships
     set aparelho = p_aparelho
   where tenant_id = p_tenant_id and user_id = auth.uid() and active;
end;
$$;

revoke all on function definir_aparelho(uuid, text) from public, anon;
grant execute on function definir_aparelho(uuid, text) to authenticated;

/**
 * O que a tela precisa saber pra desenhar a troca de aparelho.
 *
 * Devolve também quais ramais existem: sem isso a tela ofereceria "celular"
 * pra quem não tem o segundo ramal, e o clique não faria nada visível.
 */
create or replace function meu_aparelho(p_tenant_id uuid)
returns table (aparelho text, tem_computador boolean, tem_celular boolean)
language sql stable security definer set search_path = public
as $$
  select
    m.aparelho,
    coalesce(nullif(m.ramal, ''), '')       <> '',
    coalesce(nullif(m.ramal_movel, ''), '') <> ''
  from user_memberships m
  where m.tenant_id = p_tenant_id and m.user_id = auth.uid() and m.active;
$$;

revoke all on function meu_aparelho(uuid) from public, anon;
grant execute on function meu_aparelho(uuid) to authenticated;

-- ── Listagem de usuários passa a trazer o segundo ramal ────────────────────
-- Mudar o tipo de retorno exige DROP; CREATE OR REPLACE recusa.
drop function if exists get_tenant_users(uuid);

create function get_tenant_users(p_tenant_id uuid)
returns table (
  membership_id uuid, user_id uuid, email text, full_name text, role text,
  active boolean, account_status text, joined_at timestamptz, tenant_name text,
  tenant_id uuid, max_companies_override integer, is_owner boolean,
  ramal text, ramal_movel text
)
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from user_memberships um
    where um.user_id   = auth.uid()
      and um.tenant_id = p_tenant_id
      and um.active    = true
      and um.role in ('admin','manager')
  ) and not exists (
    select 1 from super_admins sa where sa.user_id = auth.uid()
  ) then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    m.id, m.user_id, p.email, p.full_name, m.role::text,
    m.active, m.account_status, m.created_at,
    t.name, m.tenant_id, m.max_companies_override,
    (t.owner_user_id = m.user_id), m.ramal, m.ramal_movel
  from user_memberships m
  join   tenants     t on t.id = m.tenant_id
  left join profiles p on p.id = m.user_id
  where m.tenant_id = p_tenant_id
  order by m.created_at asc;
end;
$$;
