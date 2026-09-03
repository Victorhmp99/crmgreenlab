-- Lead sem responsável passa a ser do dono da empresa.
--
-- Com o campo "Responsável" criado (074), lead novo já nasce com dono: quem
-- cria fica com ele, e fechar a venda no quadro atribui sozinho. Faltavam os
-- dois buracos que sobravam:
--
--   1. O histórico — 2.227 leads sem responsável nenhum, que não entram na
--      conta de ninguém e deixavam o relatório por vendedor sem sentido.
--   2. Os leads que chegam por webhook/importação, que não têm usuário logado
--      e continuariam nascendo órfãos.
--
-- A regra dos dois casos é a mesma: sem responsável, é do dono da empresa.
-- Gestor e admin redistribuem pela tela quando quiserem.

-- ── 1. Daqui pra frente: lead de rotina nasce com o dono ───────────────────
-- Vai DENTRO do gatilho que já valida responsável, e não num gatilho novo, de
-- propósito: dois gatilhos BEFORE INSERT na mesma coluna dependeriam da ordem
-- alfabética do nome pra funcionar, e a validação recusaria o padrão posto
-- pelo outro. Um gatilho só, sem ordem pra dar errado.
create or replace function public.tg_valida_responsavel_do_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quem     uuid := auth.uid();
  v_anterior uuid := case when tg_op = 'UPDATE' then old.assigned_to else null end;
  v_dono     uuid;
begin
  -- Sem usuário logado é rotina: webhook de formulário, importação, cron.
  if v_quem is null then
    if tg_op = 'INSERT' and new.assigned_to is null then
      select t.owner_user_id into v_dono from tenants t where t.id = new.tenant_id;
      -- Só se o dono ainda for gente ativa da empresa. Atribuir a quem saiu
      -- esconderia o lead de todo mundo em vez de dar um responsável.
      if v_dono is not null and exists (
        select 1 from user_memberships um
        where um.user_id = v_dono and um.tenant_id = new.tenant_id and um.active
      ) then
        new.assigned_to := v_dono;
      end if;
    end if;
    return new;
  end if;

  if new.assigned_to is not distinct from v_anterior then
    return new;
  end if;

  if new.assigned_to is not null and not exists (
    select 1 from user_memberships um
    where um.user_id = new.assigned_to and um.tenant_id = new.tenant_id and um.active
  ) then
    raise exception 'Responsável precisa ser um usuário ativo desta empresa';
  end if;

  if is_tenant_manager(new.tenant_id)
     or exists (select 1 from super_admins sa where sa.user_id = v_quem)
  then
    return new;
  end if;

  if v_anterior is not null then
    raise exception 'Este lead já tem responsável. Peça ao gestor para transferir.';
  end if;
  if new.assigned_to is distinct from v_quem then
    raise exception 'Você só pode assumir o lead para si';
  end if;

  return new;
end;
$$;

-- ── 2. O histórico ─────────────────────────────────────────────────────────
-- Guarda quais leads foram tocados ANTES de tocar. Todos estavam em NULL, então
-- desfazer é devolver NULL a esta lista — sem isto, depois de atribuídos não há
-- como distinguir os que o backfill mexeu dos que já eram do dono de verdade.
create table if not exists public.leads_backfill_responsavel (
  lead_id     uuid primary key references leads(id) on delete cascade,
  tenant_id   uuid not null,
  aplicado_em timestamptz not null default now()
);
alter table public.leads_backfill_responsavel enable row level security;
-- Sem política: é registro de manutenção, ninguém precisa ler pela API.

insert into public.leads_backfill_responsavel (lead_id, tenant_id)
select l.id, l.tenant_id
from leads l
join tenants t on t.id = l.tenant_id
where l.assigned_to is null
  and t.owner_user_id is not null
  and exists (
    select 1 from user_memberships um
    where um.user_id = t.owner_user_id and um.tenant_id = t.id and um.active
  )
on conflict (lead_id) do nothing;

-- `assigned_to` está na lista de campos que fazem o card subir (migration 068).
-- Sem desligar, este UPDATE jogaria 2.227 cards pro topo das colunas de uma vez
-- e bagunçaria o quadro de todo mundo — a ordem manual de cada empresa iria
-- junto. Não é edição de vendedor nenhum: é manutenção.
alter table leads disable trigger trg_lead_editado_sobe_card;

update leads l
   set assigned_to = t.owner_user_id
  from tenants t
 where t.id = l.tenant_id
   and l.assigned_to is null
   and l.id in (select lead_id from public.leads_backfill_responsavel);

alter table leads enable trigger trg_lead_editado_sobe_card;
