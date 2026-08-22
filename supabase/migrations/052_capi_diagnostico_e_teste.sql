-- Faltava guardar a resposta de SUCESSO do Meta. HTTP 200 não quer dizer que
-- ele contou o evento: o corpo traz events_received (que pode vir 0) e um
-- array de messages com avisos. Sem isso, "enviado" era uma suposição — e na
-- primeira vez que um evento não apareceu no Gerenciador não havia como
-- saber se o problema era nosso, do Meta, ou só demora de indexação.
alter table meta_conversion_events
  add column if not exists last_response text;

comment on column meta_conversion_events.last_response is
  'Corpo da resposta do Meta no último envio bem-sucedido. É onde vem events_received e os avisos.';

-- A aba "Eventos de teste" do Gerenciador de Eventos mostra o evento chegando
-- em tempo real, em vez de esperar a indexação da visão geral (que na
-- primeira vez que um nome novo aparece pode demorar bastante). Mas ela só
-- enxerga eventos que carregam o test_event_code que ela mesma gera.
--
-- Sem isso, conferir se a integração funciona vira recarregar a tela e torcer
-- — que foi exatamente o que aconteceu na primeira configuração.
alter table meta_ads_credentials
  add column if not exists capi_test_code text;

comment on column meta_ads_credentials.capi_test_code is
  'Código da aba "Eventos de teste" do Meta (TEST12345). Enquanto preenchido, todo evento vai marcado como teste. Serve pra conferir na hora e deve ser limpo depois.';
