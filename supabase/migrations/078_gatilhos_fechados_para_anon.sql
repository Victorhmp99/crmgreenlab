-- Fecha três funções de gatilho que nasceram abertas.
--
-- A migration 069 varreu tudo e deixou a regra "ninguém executa nada sem
-- login". Só que ela varreu o que existia NAQUELE dia: função criada depois
-- nasce com EXECUTE para PUBLIC de novo, porque é assim que o Postgres — e o
-- default privilege do próprio Supabase — funcionam.
--
-- Foi o que aconteceu com estes três gatilhos, criados nas migrations 071 e
-- 074. Chamar função de gatilho direto não faz nada (o Postgres recusa: "can
-- only be called as a trigger"), então não havia buraco explorável — mas
-- deixar aberto contraria a regra da 069, e o verificador de segurança do
-- Supabase acusa toda vez.
--
-- Tentei automatizar com `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ... FROM
-- PUBLIC` e NÃO funciona: o Supabase mantém o default dele, que concede
-- execute a anon e authenticated, e ele vence. Testei e desfiz. A disciplina
-- continua manual: toda migration que cria função termina com REVOKE, e o
-- `get_advisors` pega quem esquecer.
revoke all on function public.tg_protege_dono_da_empresa()   from public, anon, authenticated;
revoke all on function public.tg_valida_responsavel_do_lead() from public, anon, authenticated;
revoke all on function public.tg_venda_vai_pra_quem_arrastou() from public, anon, authenticated;
