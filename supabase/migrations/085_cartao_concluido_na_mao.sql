-- Concluir também pelo check no cartão, não só pela coluna "Feito".
-- Antes, qualquer mudança de coluna pra uma não-Feito zerava completed_at —
-- então marcar o check em "A fazer" e arrastar pra "Fazendo" desmarcava.
-- Agora só SAIR de uma coluna Feito reabre; entrar numa Feito conclui;
-- mover entre colunas comuns não mexe no check.
create or replace function public.tg_cartao_conclui_pela_coluna()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nova_done  boolean;
  v_velha_done boolean;
begin
  select is_done into v_nova_done from board_columns where id = new.column_id;
  if tg_op = 'UPDATE' then
    select is_done into v_velha_done from board_columns where id = old.column_id;
  end if;
  if coalesce(v_nova_done, false) then
    new.completed_at := coalesce(new.completed_at, now());
  elsif coalesce(v_velha_done, false) then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.tg_cartao_conclui_pela_coluna() from public, anon, authenticated;
