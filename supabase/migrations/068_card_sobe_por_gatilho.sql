-- Card sobe pro topo quando o lead recebe movimento — por GATILHO, não por
-- chamada de tela.
--
-- Ligar caminho por caminho é uma lista que nunca fica completa: o botão de
-- WhatsApp é um link puro e não chamava nada, etiqueta e comentário vivem em
-- tabelas próprias, e sempre haveria mais uma tela esquecida. Quem usa não tem
-- como saber por que às vezes sobe e às vezes não.
--
-- Tudo aqui obedece a `pipelines.ordenar_por_edicao`. Desligada, nada acontece.

create or replace function subir_card_do_lead(p_lead_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update pipeline_cards c
     set position = coalesce(
           (select min(x.position) - 1 from pipeline_cards x
             where x.stage_id = c.stage_id and x.tenant_id = c.tenant_id), 0),
         moved_at = now()
   where c.lead_id = p_lead_id
     and exists (
       select 1 from pipeline_stages s
       join pipelines p on p.id = s.pipeline_id
       where s.id = c.stage_id and p.ordenar_por_edicao
     );
end;
$$;

-- ── Atividade: sobe o card e, se for contato de verdade, move de etapa ──────
create or replace function tg_atividade_mexe_no_card()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_alvo uuid; v_atual int; v_alvo_pos int; v_card uuid; v_tenant uuid;
begin
  perform subir_card_do_lead(new.lead_id);

  -- 'note' e 'import' ficam de fora: anotar algo ou importar uma planilha não
  -- é ter falado com a pessoa, e mover por isso mentiria no funil.
  if new.type::text in ('call', 'whatsapp', 'email', 'meeting') then
    select c.id, c.tenant_id, s.position, p.etapa_contato_id
      into v_card, v_tenant, v_atual, v_alvo
    from pipeline_cards c
    join pipeline_stages s on s.id = c.stage_id
    join pipelines p       on p.id = s.pipeline_id
    where c.lead_id = new.lead_id
    limit 1;

    if v_card is not null and v_alvo is not null then
      select position into v_alvo_pos from pipeline_stages where id = v_alvo;
      -- Só pra frente: ligar pra quem já fechou não pode puxar o card de volta.
      if v_alvo_pos is not null and v_alvo_pos > v_atual then
        update pipeline_cards
           set stage_id = v_alvo, moved_at = now(),
               position = coalesce((select min(x.position) - 1 from pipeline_cards x
                                     where x.stage_id = v_alvo and x.tenant_id = v_tenant), 0)
         where id = v_card;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_atividade_mexe_no_card on lead_activities;
create trigger trg_atividade_mexe_no_card
  after insert on lead_activities
  for each row execute function tg_atividade_mexe_no_card();

-- ── Lead editado ───────────────────────────────────────────────────────────
create or replace function tg_lead_editado_sobe_card()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Só quando muda campo que a pessoa VÊ. Sem isto, qualquer carimbo interno
  -- (um updated_at mexido por rotina) embaralharia o quadro sozinho.
  if (new.name, new.phone, new.email, new.status, new.value, new.notes,
      new.assigned_to, new.company_name, new.custom_fields)
     is distinct from
     (old.name, old.phone, old.email, old.status, old.value, old.notes,
      old.assigned_to, old.company_name, old.custom_fields) then
    perform subir_card_do_lead(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lead_editado_sobe_card on leads;
create trigger trg_lead_editado_sobe_card
  after update on leads
  for each row execute function tg_lead_editado_sobe_card();

-- ── Etiqueta, comentário e tarefa ──────────────────────────────────────────
-- Vivem em tabelas próprias e não passam por `leads` nem por atividades. Pra
-- quem usa, porém, marcar uma etiqueta É mexer no lead: a separação das
-- tabelas é detalhe nosso, não do vendedor.
create or replace function tg_toque_no_lead_sobe_card()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform subir_card_do_lead(new.lead_id);
  return new;
end;
$$;

drop trigger if exists trg_etiqueta_sobe_card on lead_tag_links;
create trigger trg_etiqueta_sobe_card
  after insert on lead_tag_links
  for each row execute function tg_toque_no_lead_sobe_card();

drop trigger if exists trg_comentario_sobe_card on lead_comments;
create trigger trg_comentario_sobe_card
  after insert on lead_comments
  for each row execute function tg_toque_no_lead_sobe_card();

drop trigger if exists trg_tarefa_sobe_card on lead_tasks;
create trigger trg_tarefa_sobe_card
  after insert on lead_tasks
  for each row execute function tg_toque_no_lead_sobe_card();

-- ── Troca de coluna ────────────────────────────────────────────────────────
/* Trocar de COLUNA sempre leva o card pro topo da coluna nova.
 *
 * Primeira versão condicionava isso a "a posição não vir junto", pra não
 * atropelar quem arrasta. Errado: arrastar pra outra coluna manda as duas
 * coisas na mesma escrita, então a regra nunca disparava no caso mais comum —
 * que era exatamente o pedido original.
 *
 * A distinção certa não é "veio posição junto?", é OUTRA COLUNA ou A MESMA:
 * soltar em outra coluna vai pro topo, porque é a movimentação mais recente;
 * reordenar dentro da mesma coluna respeita a posição escolhida, que é a
 * ordenação manual continuando a valer.
 */
create or replace function tg_card_trocou_de_etapa()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.stage_id is distinct from old.stage_id then
    -- O UPDATE de dentro mexe só em `position`; como o gatilho é UPDATE OF
    -- stage_id, ele não dispara de novo e não há recursão.
    update pipeline_cards c
       set position = coalesce(
             (select min(x.position) - 1 from pipeline_cards x
               where x.stage_id = new.stage_id and x.tenant_id = new.tenant_id
                 and x.id <> new.id), 0)
     where c.id = new.id
       and exists (
         select 1 from pipeline_stages s
         join pipelines p on p.id = s.pipeline_id
         where s.id = new.stage_id and p.ordenar_por_edicao
       );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_card_trocou_de_etapa on pipeline_cards;
create trigger trg_card_trocou_de_etapa
  after update of stage_id on pipeline_cards
  for each row execute function tg_card_trocou_de_etapa();
