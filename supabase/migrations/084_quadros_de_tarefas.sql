-- Quadros de tarefas (estilo Trello).
--
-- A "Tarefas" que existia (lead_tasks) é uma AGENDA: toda tarefa tem hora,
-- normalmente presa a um lead, e vira lembrete. Isto aqui é outra coisa —
-- trabalho da empresa andando por colunas ("montar criativo", "revisar
-- contrato"), sem hora fixa, sem lead obrigatório. O Victor decidiu separar:
-- a antiga vira "Agenda", esta entra como "Tarefas".
--
-- Decisões:
--   • Vários quadros por empresa, colunas personalizáveis (nascem com
--     A fazer / Fazendo / Feito). A coluna marcada `is_done` conclui o cartão.
--   • Todo mundo da empresa vê e mexe. Apagar QUADRO é só gestor.
--   • Cartão: cor, prazo opcional, vários responsáveis, etiquetas do quadro,
--     checklist, comentários, ligação opcional a um lead.
--   • board_id repetido nas tabelas-filhas: é o filtro do realtime e da RLS
--     sem join.
--   • Avisos pelo sino: virou responsável, comentaram no seu cartão, prazo
--     hoje/atrasado (um resumo por dia, como a agenda).

-- ── Tabelas ─────────────────────────────────────────────────────────────────
create table public.boards (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  color       text,
  position    integer not null default 0,
  created_by  uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.board_columns (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  board_id   uuid not null references boards(id) on delete cascade,
  name       text not null,
  position   integer not null default 0,
  is_done    boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.board_labels (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  board_id   uuid not null references boards(id) on delete cascade,
  name       text not null,
  color      text not null,
  created_at timestamptz not null default now()
);

create table public.board_cards (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  board_id     uuid not null references boards(id) on delete cascade,
  column_id    uuid not null references board_columns(id) on delete cascade,
  title        text not null,
  description  text,
  color        text,
  lead_id      uuid references leads(id) on delete set null,
  due_date     date,
  position     double precision not null default 0,
  created_by   uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.board_card_assignees (
  card_id    uuid not null references board_cards(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  board_id   uuid not null references boards(id) on delete cascade,
  added_by   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (card_id, user_id)
);

create table public.board_card_labels (
  card_id   uuid not null references board_cards(id) on delete cascade,
  label_id  uuid not null references board_labels(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  board_id  uuid not null references boards(id) on delete cascade,
  primary key (card_id, label_id)
);

create table public.board_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  board_id   uuid not null references boards(id) on delete cascade,
  card_id    uuid not null references board_cards(id) on delete cascade,
  text       text not null,
  done       boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.board_comments (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  board_id   uuid not null references boards(id) on delete cascade,
  card_id    uuid not null references board_cards(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- Resumo diário de prazo: uma vez por pessoa por dia (mesma ideia da agenda).
create table public.card_reminder_sent (
  recipient_id uuid not null,
  tenant_id    uuid not null,
  sent_on      date not null,
  primary key (recipient_id, tenant_id, sent_on)
);

create index on public.boards (tenant_id) where archived_at is null;
create index on public.board_columns (board_id, position);
create index on public.board_cards (board_id, column_id, position) where archived_at is null;
create index on public.board_cards (tenant_id, due_date) where archived_at is null and completed_at is null;
create index on public.board_card_assignees (user_id);
create index on public.board_checklist_items (card_id, position);
create index on public.board_comments (card_id, created_at);

-- ── updated_at ──────────────────────────────────────────────────────────────
create trigger trg_boards_updated_at before update on public.boards
  for each row execute function update_updated_at();
create trigger trg_board_cards_updated_at before update on public.board_cards
  for each row execute function update_updated_at();

-- ── RLS: membro vê e mexe; apagar quadro é gestor ───────────────────────────
alter table public.boards               enable row level security;
alter table public.board_columns        enable row level security;
alter table public.board_labels         enable row level security;
alter table public.board_cards          enable row level security;
alter table public.board_card_assignees enable row level security;
alter table public.board_card_labels    enable row level security;
alter table public.board_checklist_items enable row level security;
alter table public.board_comments       enable row level security;

create policy boards_member_rw on public.boards
  for all using (is_tenant_member(tenant_id)) with check (is_tenant_member(tenant_id));
-- A política acima cobre delete também; esta restringe: um DELETE precisa
-- passar em TODAS as políticas restritivas.
create policy boards_delete_gestor on public.boards
  as restrictive for delete using (is_tenant_manager(tenant_id));

create policy board_columns_member on public.board_columns
  for all using (is_tenant_member(tenant_id)) with check (is_tenant_member(tenant_id));
create policy board_labels_member on public.board_labels
  for all using (is_tenant_member(tenant_id)) with check (is_tenant_member(tenant_id));
create policy board_cards_member on public.board_cards
  for all using (is_tenant_member(tenant_id)) with check (is_tenant_member(tenant_id));
create policy board_card_assignees_member on public.board_card_assignees
  for all using (is_tenant_member(tenant_id)) with check (is_tenant_member(tenant_id));
create policy board_card_labels_member on public.board_card_labels
  for all using (is_tenant_member(tenant_id)) with check (is_tenant_member(tenant_id));
create policy board_checklist_member on public.board_checklist_items
  for all using (is_tenant_member(tenant_id)) with check (is_tenant_member(tenant_id));
create policy board_comments_member on public.board_comments
  for all using (is_tenant_member(tenant_id)) with check (is_tenant_member(tenant_id));
-- Comentário só quem escreveu apaga (ou gestor).
create policy board_comments_delete_autor on public.board_comments
  as restrictive for delete using (user_id = auth.uid() or is_tenant_manager(tenant_id));

-- ── Realtime: dois no mesmo quadro veem o cartão andar ──────────────────────
alter publication supabase_realtime add table
  public.board_columns, public.board_cards, public.board_card_assignees,
  public.board_card_labels, public.board_labels, public.board_checklist_items, public.board_comments;

-- ── Concluído = está na coluna "Feito" ──────────────────────────────────────
create or replace function public.tg_cartao_conclui_pela_coluna()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_done boolean;
begin
  select is_done into v_done from board_columns where id = new.column_id;
  if coalesce(v_done, false) then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger trg_cartao_conclui_pela_coluna
  before insert or update of column_id on public.board_cards
  for each row execute function tg_cartao_conclui_pela_coluna();

-- Marcar/desmarcar uma coluna como "Feito" reflete nos cartões que já estão nela.
create or replace function public.tg_coluna_done_reflete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_done <> old.is_done then
    update board_cards
       set completed_at = case when new.is_done then coalesce(completed_at, now()) else null end
     where column_id = new.id;
  end if;
  return new;
end;
$$;
create trigger trg_coluna_done_reflete
  after update of is_done on public.board_columns
  for each row execute function tg_coluna_done_reflete();

-- ── Avisos ──────────────────────────────────────────────────────────────────
create or replace function public.link_do_cartao(p_board_id uuid, p_card_id uuid)
returns text
language sql
immutable
as $$ select '/boards/' || p_board_id || '?cartao=' || p_card_id $$;

-- Virou responsável por um cartão (se não foi você mesmo que se pôs).
create or replace function public.tg_responsavel_avisa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card  record;
  v_quem  text;
begin
  if new.user_id = auth.uid() then return new; end if;
  select c.title, b.name as board into v_card
    from board_cards c join boards b on b.id = c.board_id where c.id = new.card_id;
  select coalesce(p.full_name, p.email) into v_quem from profiles p where p.id = auth.uid();
  insert into notifications (tenant_id, recipient_id, created_by, title, body, link)
  values (new.tenant_id, new.user_id, auth.uid(),
          'Tarefa pra você 📌',
          format('%s te pôs em "%s" (%s).', coalesce(v_quem, 'Alguém'), v_card.title, v_card.board),
          link_do_cartao(new.board_id, new.card_id));
  return new;
end;
$$;
create trigger trg_responsavel_avisa
  after insert on public.board_card_assignees
  for each row execute function tg_responsavel_avisa();

-- Comentaram num cartão seu (responsáveis e quem criou, menos o autor).
create or replace function public.tg_comentario_avisa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card record;
  v_quem text;
  v_dest uuid;
begin
  select c.title, c.created_by into v_card from board_cards c where c.id = new.card_id;
  select coalesce(p.full_name, p.email) into v_quem from profiles p where p.id = new.user_id;
  for v_dest in
    select a.user_id from board_card_assignees a where a.card_id = new.card_id
    union
    select v_card.created_by where v_card.created_by is not null
  loop
    continue when v_dest = new.user_id;
    insert into notifications (tenant_id, recipient_id, created_by, title, body, link)
    values (new.tenant_id, v_dest, new.user_id,
            format('%s comentou em "%s"', coalesce(v_quem, 'Alguém'), v_card.title),
            left(new.body, 140) || case when length(new.body) > 140 then '…' else '' end,
            link_do_cartao(new.board_id, new.card_id));
  end loop;
  return new;
end;
$$;
create trigger trg_comentario_avisa
  after insert on public.board_comments
  for each row execute function tg_comentario_avisa();

-- Prazo hoje / atrasado: um aviso por pessoa por dia.
create or replace function public.notify_due_cards()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r       record;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_title text;
  v_body  text;
begin
  for r in
    select a.tenant_id, a.user_id as recipient_id,
           count(*) filter (where c.due_date <  v_today) as atrasados,
           count(*) filter (where c.due_date =  v_today) as hoje
    from board_cards c
    join board_card_assignees a on a.card_id = c.id
    where c.completed_at is null and c.archived_at is null
      and c.due_date is not null and c.due_date <= v_today
    group by a.tenant_id, a.user_id
  loop
    insert into card_reminder_sent (recipient_id, tenant_id, sent_on)
    values (r.recipient_id, r.tenant_id, v_today)
    on conflict do nothing;
    continue when not found;

    if r.atrasados > 0 and r.hoje > 0 then
      v_title := 'Tarefas com prazo';
      v_body  := r.atrasados || ' atrasada' || case when r.atrasados > 1 then 's' else '' end
              || ' e ' || r.hoje || ' pra hoje no quadro.';
    elsif r.atrasados > 0 then
      v_title := 'Tarefas atrasadas no quadro';
      v_body  := 'Você tem ' || r.atrasados || case when r.atrasados > 1 then ' tarefas atrasadas' else ' tarefa atrasada' end || '.';
    else
      v_title := 'Tarefas pra hoje no quadro';
      v_body  := 'Você tem ' || r.hoje || case when r.hoje > 1 then ' tarefas' else ' tarefa' end || ' com prazo hoje.';
    end if;

    insert into notifications (tenant_id, recipient_id, created_by, title, body, link)
    values (r.tenant_id, r.recipient_id, null, v_title, v_body, '/boards?prazo=1');
  end loop;

  delete from card_reminder_sent where sent_on < v_today - 30;
end;
$$;
revoke all on function public.notify_due_cards() from public, anon, authenticated;
select cron.schedule('notify-due-cards', '*/5 * * * *', 'select notify_due_cards()');

-- A agenda antiga agora se chama Agenda também nos avisos.
create or replace function public.notify_due_tasks()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_title text;
  v_body  text;
  v_link  text;
begin
  for r in
    select tenant_id, recipient_id,
           count(*) filter (where is_overdue)      as overdue_count,
           count(*) filter (where not is_overdue)  as today_count
    from (
      select t.tenant_id,
             coalesce(t.assigned_to, t.created_by) as recipient_id,
             (t.due_at at time zone 'America/Sao_Paulo')::date < v_today as is_overdue
      from lead_tasks t
      where t.completed = false
        and (t.due_at at time zone 'America/Sao_Paulo')::date <= v_today
        and coalesce(t.assigned_to, t.created_by) is not null
    ) sub
    group by tenant_id, recipient_id
  loop
    insert into task_reminder_sent (recipient_id, tenant_id, sent_on)
    values (r.recipient_id, r.tenant_id, v_today)
    on conflict (recipient_id, tenant_id, sent_on) do nothing;
    continue when not found;

    if r.overdue_count > 0 and r.today_count > 0 then
      v_title := 'Agenda pendente';
      v_body  := r.overdue_count || ' atrasada' || case when r.overdue_count > 1 then 's' else '' end
              || ' e ' || r.today_count || ' para hoje';
    elsif r.overdue_count > 0 then
      v_title := 'Agenda atrasada';
      v_body  := 'Você tem ' || r.overdue_count
              || case when r.overdue_count > 1 then ' compromissos atrasados' else ' compromisso atrasado' end;
    else
      v_title := 'Agenda de hoje';
      v_body  := 'Você tem ' || r.today_count
              || case when r.today_count > 1 then ' compromissos' else ' compromisso' end || ' para hoje';
    end if;

    v_link := case when r.overdue_count > 0 then '/tasks?atrasadas=1' else '/tasks' end;

    insert into notifications (tenant_id, recipient_id, created_by, title, body, link)
    values (r.tenant_id, r.recipient_id, null, v_title, v_body, v_link);
  end loop;

  delete from task_reminder_sent where sent_on < v_today - 30;
end;
$function$;

-- ── RPCs ────────────────────────────────────────────────────────────────────
-- Quem é da empresa, pra escolher responsável. get_tenant_users é só gestor;
-- vendedor também precisa pôr colega num cartão.
create or replace function public.membros_da_empresa(p_tenant_id uuid)
returns table (user_id uuid, full_name text, email text, role text)
language sql
stable
security definer
set search_path = public
as $$
  select um.user_id, p.full_name, p.email, um.role::text
  from user_memberships um
  left join profiles p on p.id = um.user_id
  where um.tenant_id = p_tenant_id and um.active
    and is_tenant_member(p_tenant_id)
  order by coalesce(p.full_name, p.email);
$$;
revoke all on function public.membros_da_empresa(uuid) from public, anon;
grant execute on function public.membros_da_empresa(uuid) to authenticated;

-- Quadro novo já com as três colunas — atômico.
create or replace function public.criar_quadro(p_tenant_id uuid, p_name text, p_color text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_tenant_member(p_tenant_id) then raise exception 'Unauthorized'; end if;
  insert into boards (tenant_id, name, color, created_by, position)
  values (p_tenant_id, p_name, p_color, auth.uid(),
          (select coalesce(max(position), -1) + 1 from boards where tenant_id = p_tenant_id))
  returning id into v_id;
  insert into board_columns (tenant_id, board_id, name, position, is_done) values
    (p_tenant_id, v_id, 'A fazer', 0, false),
    (p_tenant_id, v_id, 'Fazendo', 1, false),
    (p_tenant_id, v_id, 'Feito',   2, true);
  return v_id;
end;
$$;
revoke all on function public.criar_quadro(uuid, text, text) from public, anon;
grant execute on function public.criar_quadro(uuid, text, text) to authenticated;

-- Resumo pra lista de quadros: quantos cartões abertos, quantos atrasados.
create or replace function public.resumo_dos_quadros(p_tenant_id uuid)
returns table (board_id uuid, abertos integer, atrasados integer, meus integer)
language sql
stable
security definer
set search_path = public
as $$
  select b.id,
         count(c.id) filter (where c.completed_at is null)::int,
         count(c.id) filter (where c.completed_at is null and c.due_date < (now() at time zone 'America/Sao_Paulo')::date)::int,
         count(c.id) filter (where c.completed_at is null
                               and exists (select 1 from board_card_assignees a where a.card_id = c.id and a.user_id = auth.uid()))::int
  from boards b
  left join board_cards c on c.board_id = b.id and c.archived_at is null
  where b.tenant_id = p_tenant_id and is_tenant_member(p_tenant_id)
  group by b.id;
$$;
revoke all on function public.resumo_dos_quadros(uuid) from public, anon;
grant execute on function public.resumo_dos_quadros(uuid) to authenticated;

-- Função nova nasce aberta no Supabase (SEGURANCA.md): trigger e apoio
-- interno ninguém chama de fora.
revoke all on function public.tg_cartao_conclui_pela_coluna() from public, anon, authenticated;
revoke all on function public.tg_coluna_done_reflete() from public, anon, authenticated;
revoke all on function public.tg_responsavel_avisa() from public, anon, authenticated;
revoke all on function public.tg_comentario_avisa() from public, anon, authenticated;
revoke all on function public.link_do_cartao(uuid, uuid) from public, anon, authenticated;
