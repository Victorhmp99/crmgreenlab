-- action_source é como o Meta classifica a ORIGEM do evento. Estava fixo em
-- 'system_generated' (evento gerado por sistema, sem ação direta da pessoa),
-- que é a descrição correta do que o CRM faz.
--
-- Comprovado em teste real contra o Meta: evento enviado como
-- 'system_generated' é aceito (events_received: 1, sem avisos) mas NÃO
-- aparece na ferramenta "Eventos de teste". O mesmo evento enviado como
-- 'website' aparece na hora, marcado como "Processado", recebido do
-- "Servidor" e com o telefone reconhecido como chave de correspondência.
--
-- Se o próprio Meta não mostra esse tipo nas ferramentas dele, ninguém
-- consegue conferir se a integração está funcionando — e integração que não
-- dá pra verificar não se sustenta. Por isso o padrão é website.
--
-- 'website' também não é invenção: o lead entrou por um formulário no site
-- da empresa, foi ali que a pessoa agiu. O CRM só confirma depois o que
-- aquele contato virou.
--
-- Fica configurável porque negócios diferentes se descrevem de formas
-- diferentes (clique-para-WhatsApp se encaixa melhor em business_messaging).
alter table meta_ads_credentials
  add column if not exists capi_action_source text default 'website';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'meta_capi_action_source_check') then
    alter table meta_ads_credentials
      add constraint meta_capi_action_source_check
      check (capi_action_source is null or capi_action_source in (
        'website', 'app', 'email', 'phone_call', 'chat',
        'physical_store', 'system_generated', 'business_messaging', 'other'
      ));
  end if;
end $$;

alter table meta_ads_credentials
  alter column capi_action_source set default 'website';

update meta_ads_credentials
   set capi_action_source = 'website'
 where capi_action_source is null
    or capi_action_source = 'system_generated';

comment on column meta_ads_credentials.capi_action_source is
  'Como o Meta classifica a origem do evento. Padrão website — system_generated é aceito mas fica invisível nas ferramentas de teste do Meta.';
