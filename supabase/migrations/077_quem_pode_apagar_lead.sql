-- Quem pode apagar lead, e quanto.
--
-- A hierarquia combinada, de cima pra baixo:
--
--   super admin (dono do servidor) → apaga o que quiser, em qualquer empresa
--   admin da empresa               → sem limite naquela empresa
--   criador da empresa             → sem limite na empresa dele
--   gestor que não é o criador     → até 25% dos leads da empresa
--   vendedor                       → só lead cadastrado nas últimas 12 horas
--
-- Não existe tabela de parentesco entre empresas no banco: "a empresa que o
-- admin deu acesso" é, na prática, a empresa onde ele TEM o cargo de admin.
-- É esse o critério usado aqui.
--
-- A regra vive num GATILHO, não na política de RLS, por dois motivos. Um: RLS
-- que recusa devolve "0 linhas apagadas" — sucesso silencioso, e a pessoa
-- fica achando que apagou. O gatilho recusa com o motivo escrito. Dois: o
-- gatilho pega TODO caminho de exclusão de uma vez — a tela, a exclusão em
-- massa, o limpador de duplicados, o de leads sem contato, e a API crua.

-- ── Registro do que foi apagado ────────────────────────────────────────────
-- Serve pra duas coisas: contar a cota do gestor e deixar rastro de quem
-- apagou o quê. Sem chave estrangeira de propósito: com FK pra `leads` ou
-- `tenants`, apagar uma empresa inteira (cascata) tentaria gravar aqui
-- apontando pra linhas que já se foram e a exclusão quebraria.
create table if not exists public.leads_excluidos (
  id           bigserial primary key,
  tenant_id    uuid not null,
  lead_id      uuid not null,
  lead_nome    text,
  user_id      uuid not null,
  excluido_em  timestamptz not null default now()
);

create index if not exists idx_leads_excluidos_cota
  on public.leads_excluidos (tenant_id, user_id, excluido_em desc);

alter table public.leads_excluidos enable row level security;

drop policy if exists gestores_veem_exclusoes on public.leads_excluidos;
create policy gestores_veem_exclusoes on public.leads_excluidos
  for select using (is_tenant_manager(tenant_id));

-- ── A regra ────────────────────────────────────────────────────────────────
create or replace function public.tg_quem_pode_apagar_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quem     uuid := auth.uid();
  v_dono     uuid;
  v_papel    user_role;
  v_apagados integer;
  v_atual    integer;
  v_base     integer;
  v_limite   integer;
begin
  -- Rotina interna (cron, webhook, service_role). Quem tem a chave de serviço
  -- já tem acesso total ao banco: travar aqui não protegeria nada.
  if v_quem is null then
    return old;
  end if;

  -- Empresa sendo excluída: os leads saem por cascata e a linha de `tenants`
  -- já não existe. Sem esta saída, a exclusão de empresa quebraria aqui.
  select t.owner_user_id into v_dono from tenants t where t.id = old.tenant_id;
  if not found then
    return old;
  end if;

  if exists (select 1 from super_admins sa where sa.user_id = v_quem) then
    perform registrar_exclusao_de_lead(old, v_quem);
    return old;
  end if;

  if v_quem = v_dono then
    perform registrar_exclusao_de_lead(old, v_quem);
    return old;
  end if;

  select um.role into v_papel
  from user_memberships um
  where um.user_id = v_quem and um.tenant_id = old.tenant_id and um.active;

  if not found then
    raise exception 'Você não tem acesso a esta empresa';
  end if;

  if v_papel = 'admin' then
    perform registrar_exclusao_de_lead(old, v_quem);
    return old;
  end if;

  if v_papel = 'seller' then
    -- 12 horas é a janela do "cadastrei errado agora". Passou disso, o lead já
    -- tem histórico e a exclusão vira assunto de gestor.
    if old.created_at < now() - interval '12 hours' then
      raise exception 'Vendedor só pode excluir lead cadastrado nas últimas 12 horas. Este é de %. Peça ao gestor.',
        to_char(old.created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
    end if;
    perform registrar_exclusao_de_lead(old, v_quem);
    return old;
  end if;

  -- ── Gestor que não é o criador: cota de 25% ─────────────────────────────
  v_apagados := (select count(*) from leads_excluidos e
                  where e.tenant_id = old.tenant_id and e.user_id = v_quem
                    and e.excluido_em > now() - interval '24 hours');
  v_atual    := (select count(*) from leads l where l.tenant_id = old.tenant_id);

  -- A base soma o que ainda existe com o que esta pessoa já apagou na janela.
  -- Sem isso ela encolheria a cada linha apagada e a cota fecharia no meio da
  -- operação: em 100 leads, travaria por volta do vigésimo em vez do vigésimo
  -- quinto.
  v_base   := v_atual + v_apagados;
  -- O mínimo de 5 existe pra empresa pequena não ficar com cota ZERO: com 3
  -- leads, 25% arredonda pra baixo e o gestor não apagaria nem um cadastro
  -- errado.
  v_limite := greatest(floor(v_base * 0.25)::int, 5);

  if v_apagados >= v_limite then
    raise exception 'Limite atingido: gestor pode excluir até % leads por dia (25%% dos % da empresa). Já foram % nas últimas 24h. Só o criador da empresa pode excluir mais.',
      v_limite, v_base, v_apagados;
  end if;

  perform registrar_exclusao_de_lead(old, v_quem);
  return old;
end;
$$;

-- Auxiliar: grava o rastro. Separada pra não repetir o insert cinco vezes
-- dentro do gatilho e esquecer um deles depois.
create or replace function public.registrar_exclusao_de_lead(p_lead leads, p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into leads_excluidos (tenant_id, lead_id, lead_nome, user_id)
  values (p_lead.tenant_id, p_lead.id, p_lead.name, p_user_id);
$$;

revoke all on function public.registrar_exclusao_de_lead(leads, uuid) from public, anon, authenticated;
revoke all on function public.tg_quem_pode_apagar_lead() from public, anon, authenticated;

drop trigger if exists trg_quem_pode_apagar_lead on leads;
create trigger trg_quem_pode_apagar_lead
  before delete on leads
  for each row execute function tg_quem_pode_apagar_lead();

-- ── A política de RLS deixa de decidir ─────────────────────────────────────
-- Ela barrava vendedor por completo — o vendedor NÃO conseguia apagar nada,
-- nem o lead que acabou de cadastrar errado. Agora ela só confere se a pessoa
-- é da empresa; quem julga o resto é o gatilho, que sabe DIZER o motivo em
-- vez de devolver "0 linhas apagadas".
drop policy if exists super_or_managers_delete_leads on public.leads;

create policy membros_tentam_excluir_leads on public.leads
  for delete using (
    exists (select 1 from super_admins sa where sa.user_id = auth.uid())
    or exists (
      select 1 from user_memberships um
      where um.user_id = auth.uid() and um.tenant_id = leads.tenant_id and um.active
    )
  );
