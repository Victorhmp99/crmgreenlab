-- Ao inserir uma atividade (stage_change, call, note, etc.) no lead_activities,
-- atualiza leads.updated_at para que a "última atualização" reflita qualquer
-- interação, não só edição direta dos dados do lead.

create or replace function trg_activity_touches_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update leads set updated_at = now() where id = new.lead_id;
  return new;
end;
$$;

create trigger lead_activities_touch_lead
  after insert on lead_activities
  for each row
  execute function trg_activity_touches_lead();
