-- Excluir usuário pela tela dava erro. Motivo: 11 chaves estrangeiras
-- apontando pra auth.users estavam como NO ACTION, ou seja, BLOQUEIAM a
-- exclusão. A função delete_user_completely tratava 5 delas na mão e ignorava
-- as outras 6 — então qualquer pessoa que já tivesse criado uma tarefa,
-- escrito um comentário, lançado algo no financeiro ou enviado uma
-- notificação virava impossível de apagar.
--
-- Tratar isso dentro da função foi a escolha errada desde o início: a lista de
-- tabelas cresce a cada feature nova (o financeiro e as tarefas chegaram
-- depois) e ninguém lembra de voltar lá. A regra tem que estar na própria
-- chave, que é onde o banco a aplica sozinho.
--
-- Autoria (created_by, moved_by, user_id de histórico) vira NULO: o registro é
-- da EMPRESA e não deve sumir porque a pessoa saiu. O lead continua, o
-- comentário continua, o lançamento continua — só perdem o autor.
do $$
declare
  r record;
  v_acao text;
begin
  for r in
    select c.conname, c.conrelid::regclass::text as tabela, a.attname as coluna
    from pg_constraint c
    join unnest(c.conkey) with ordinality k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and c.confdeltype = 'a'   -- NO ACTION: as que bloqueiam
  loop
    -- goals.user_id é a meta DA pessoa: sem ela, a meta não significa nada.
    -- Todo o resto é registro da empresa e sobrevive sem autor.
    v_acao := case when r.tabela = 'goals' and r.coluna = 'user_id'
                   then 'cascade' else 'set null' end;

    execute format('alter table %s drop constraint %I', r.tabela, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references auth.users(id) on delete %s',
      r.tabela, r.conname, r.coluna, v_acao);
  end loop;
end $$;
