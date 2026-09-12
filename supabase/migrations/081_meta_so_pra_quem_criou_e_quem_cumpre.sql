-- Meta: quem vê, e uma por pessoa por período.
--
-- Regras do Victor (12/09/2026):
--   1. A meta aparece só pra quem a CRIOU e pra quem precisa CUMPRIR. Outro
--      gestor da mesma empresa não vê metas que não criou. Admin vê todas —
--      "admin manda na empresa", regra da hierarquia já registrada.
--   2. Não pode existir duas metas pra mesma pessoa no mesmo período da mesma
--      empresa. Vale pra renovação automática também (que já era idempotente,
--      mas agora o banco garante).
--   3. Quem está em várias empresas tem uma meta em CADA empresa. Já era assim
--      — tudo é filtrado por tenant — e continua.

-- ── 2. Uma meta por pessoa por período ─────────────────────────────────────
create unique index if not exists uq_goals_pessoa_periodo
  on public.goals (tenant_id, user_id, start_date, end_date);

-- ── 1. Quem vê ─────────────────────────────────────────────────────────────
create or replace function public.pode_ver_meta(p_tenant_id uuid, p_user_id uuid, p_created_by uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = p_user_id
      or auth.uid() = p_created_by
      or is_tenant_admin(p_tenant_id);
$$;
-- Entra na política de RLS de `goals`, avaliada como o usuário que consulta:
-- sem EXECUTE pra `authenticated` toda leitura da tabela quebra (mesma
-- armadilha de `is_tenant_member`, anotada na 069).
revoke all on function public.pode_ver_meta(uuid, uuid, uuid) from public, anon;
grant execute on function public.pode_ver_meta(uuid, uuid, uuid) to authenticated;

create or replace function public.get_tenant_goals(
  p_tenant_id uuid, p_only_active boolean default false)
returns table(id uuid, tenant_id uuid, user_id uuid, period text,
              start_date date, end_date date, leads_target integer,
              calls_target integer, deals_target integer, revenue_target numeric,
              created_by uuid, created_at timestamptz,
              user_email text, user_full_name text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not is_tenant_member(p_tenant_id) then
    raise exception 'Unauthorized';
  end if;

  return query
  select g.id, g.tenant_id, g.user_id, g.period::text,
         g.start_date, g.end_date,
         g.leads_target, g.calls_target, g.deals_target,
         g.revenue_target, g.created_by, g.created_at,
         p.email, p.full_name
  from goals g
  left join profiles p on p.id = g.user_id
  where g.tenant_id = p_tenant_id
    and pode_ver_meta(g.tenant_id, g.user_id, g.created_by)
    and (not p_only_active or g.end_date >= current_date)
  order by g.start_date desc;
end;
$function$;
revoke all on function public.get_tenant_goals(uuid, boolean) from public, anon;
grant execute on function public.get_tenant_goals(uuid, boolean) to authenticated;

create or replace function public.progresso_das_metas(
  p_tenant_id    uuid,
  p_only_active  boolean default false
)
returns table (
  goal_id         uuid,
  leads_actual    integer,
  calls_actual    integer,
  deals_actual    integer,
  revenue_actual  numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_tenant_member(p_tenant_id) then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    g.id,
    case when g.encerrada_em is not null then (g.resultado_final->>'leads')::int       else r.leads end,
    case when g.encerrada_em is not null then (g.resultado_final->>'contatos')::int    else r.contatos end,
    case when g.encerrada_em is not null then (g.resultado_final->>'vendas')::int      else r.vendas end,
    case when g.encerrada_em is not null then (g.resultado_final->>'faturamento')::numeric else r.faturamento end
  from goals g
  cross join lateral realizado_no_periodo(g.tenant_id, g.user_id, g.start_date, g.end_date) r
  where g.tenant_id = p_tenant_id
    and pode_ver_meta(g.tenant_id, g.user_id, g.created_by)
    and (not p_only_active or g.end_date >= (now() at time zone 'America/Sao_Paulo')::date);
end;
$$;
revoke all on function public.progresso_das_metas(uuid, boolean) from public, anon;
grant execute on function public.progresso_das_metas(uuid, boolean) to authenticated;

-- A auditoria segue a mesma regra de visibilidade.
create or replace function public.detalhe_da_meta(p_goal_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g goals%rowtype;
begin
  select * into g from goals where id = p_goal_id;
  if not found then raise exception 'Meta não encontrada'; end if;
  if not pode_ver_meta(g.tenant_id, g.user_id, g.created_by) then
    raise exception 'Unauthorized';
  end if;

  return json_build_object(
    'leads', (
      select coalesce(json_agg(json_build_object('id', l.id, 'nome', l.name, 'em', l.created_at) order by l.created_at desc), '[]'::json)
      from leads l
      where l.tenant_id = g.tenant_id and l.assigned_to = g.user_id
        and (l.created_at at time zone 'America/Sao_Paulo')::date between g.start_date and g.end_date),
    'contatos', (
      select coalesce(json_agg(json_build_object(
                'lead_id', x.lead_id, 'nome', x.nome, 'tipo', x.tipo, 'origem', x.origem, 'em', x.em, 'vezes', x.vezes)
              order by x.em desc), '[]'::json)
      from (
        select a.lead_id, l.name as nome,
               (array_agg(a.type::text order by a.created_at desc))[1] as tipo,
               case when bool_or(coalesce(a.metadata->>'origem','manual') <> 'manual') then 'sistema' else 'manual' end as origem,
               max(a.created_at) as em,
               count(*)::int as vezes
        from lead_activities a
        join leads l on l.id = a.lead_id
        where a.tenant_id = g.tenant_id and a.user_id = g.user_id
          and a.type::text <> 'import'
          and (a.created_at at time zone 'America/Sao_Paulo')::date between g.start_date and g.end_date
        group by a.lead_id, l.name
      ) x),
    'vendas', (
      select coalesce(json_agg(json_build_object('id', l.id, 'nome', l.name, 'valor', l.value, 'em', l.updated_at) order by l.updated_at desc), '[]'::json)
      from leads l
      where l.tenant_id = g.tenant_id and l.assigned_to = g.user_id
        and lead_esta_ganho(l)
        and (l.updated_at at time zone 'America/Sao_Paulo')::date between g.start_date and g.end_date)
  );
end;
$$;
revoke all on function public.detalhe_da_meta(uuid) from public, anon;
grant execute on function public.detalhe_da_meta(uuid) to authenticated;

-- A política da tabela dizia "gestor vê todas". Passa a dizer o mesmo que as
-- funções — sem isso a leitura direta da tabela (que a tela faz pra pegar
-- `renovar`/`encerrada_em`) devolveria mais do que a RPC.
drop policy if exists members_see_goals on public.goals;
create policy members_see_goals on public.goals
  for select using (
    is_tenant_member(tenant_id)
    and pode_ver_meta(tenant_id, user_id, created_by)
  );
