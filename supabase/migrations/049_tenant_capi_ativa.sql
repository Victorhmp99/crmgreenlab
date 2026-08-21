-- A tabela meta_ads_credentials é legível só por admin (is_tenant_admin), e
-- com razão: ela guarda os tokens. Mas o Kanban precisa saber apenas UMA
-- coisa — se a empresa está mandando evento pro Meta — pra mostrar a antena
-- na coluna marcada. Sem isso, quem trabalha o funil o dia inteiro (gestor e
-- vendedor) nunca veria o indicador, que é justamente quem precisa dele.
--
-- Responde booleano e nada mais: nenhum token, nenhum dataset.
create or replace function tenant_capi_ativa(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from meta_ads_credentials c
    where c.tenant_id = p_tenant_id
      and c.dataset_id is not null
      and c.capi_token is not null
  ) and is_tenant_member(p_tenant_id);
$$;

revoke all on function tenant_capi_ativa(uuid) from public, anon;
grant execute on function tenant_capi_ativa(uuid) to authenticated;

comment on function tenant_capi_ativa(uuid) is
  'Só diz SE a empresa tem a API de Conversões ligada. Não devolve token nem dataset — existe pra não precisar afrouxar o RLS de meta_ads_credentials.';
