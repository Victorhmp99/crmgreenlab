-- Meta nova (ou ajustada) avisa a pessoa no sino.
--
-- A 080 criou os avisos de andamento — marcos, ritmo, risco, fechamento — mas
-- ninguém era avisado de que GANHOU uma meta. O vendedor só descobria abrindo
-- a tela. Como gatilho na tabela, pega os dois caminhos: o gestor criando pela
-- tela e a rotina renovando no dia 1.

create or replace function public.tg_meta_avisa_dono()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvos text;
  v_periodo text;
begin
  -- Gestor criando meta pra si mesmo não precisa ser avisado do que acabou de
  -- fazer. Renovação automática tem created_by do gestor original, então o
  -- vendedor recebe normalmente.
  if new.user_id = new.created_by and (tg_op = 'INSERT' or auth.uid() = new.user_id) then
    return new;
  end if;

  -- No UPDATE só avisa se algum ALVO mudou. Mexer em "renovar" ou o próprio
  -- encerramento pela rotina não é novidade pra pessoa.
  if tg_op = 'UPDATE' and (new.leads_target, new.calls_target, new.deals_target, new.revenue_target)
     is not distinct from (old.leads_target, old.calls_target, old.deals_target, old.revenue_target) then
    return new;
  end if;

  v_alvos := concat_ws(' · ',
    case when new.leads_target   > 0 then new.leads_target   || ' leads' end,
    case when new.calls_target   > 0 then new.calls_target   || ' contatos' end,
    case when new.deals_target   > 0 then new.deals_target   || ' vendas' end,
    case when new.revenue_target > 0 then reais(new.revenue_target) end);
  v_periodo := to_char(new.start_date, 'DD/MM') || ' a ' || to_char(new.end_date, 'DD/MM');

  perform avisar_meta(new.tenant_id, new.user_id,
    case when tg_op = 'INSERT' then 'Você tem uma meta nova 🎯' else 'Sua meta foi ajustada' end,
    format('%s: %s.', v_periodo, coalesce(nullif(v_alvos, ''), 'sem alvos definidos ainda')));

  return new;
end;
$$;
revoke all on function public.tg_meta_avisa_dono() from public, anon, authenticated;

drop trigger if exists trg_meta_avisa_dono on public.goals;
create trigger trg_meta_avisa_dono
  after insert or update of leads_target, calls_target, deals_target, revenue_target on public.goals
  for each row execute function tg_meta_avisa_dono();
