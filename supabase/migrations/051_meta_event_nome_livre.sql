-- O CHECK travava em Lead/Schedule/Purchase. Descoberto no uso real: o pixel
-- da empresa já tinha eventos próprios com o mesmo SENTIDO vindos de outras
-- origens (invitee_meeting_scheduled do Calendly, LeadNivelB/C do formulário).
-- Mandar "Schedule" pra esse mesmo dataset criava duas linhas dizendo a mesma
-- coisa sem dar pra saber qual veio do comercial.
--
-- Agora o nome é livre, dentro do que o Meta aceita: letras, números,
-- underscore e hífen. Sem espaço e sem acento — o Meta trata nome de evento
-- como identificador, não como texto de tela, e acento vira evento diferente
-- na hora de montar público.
alter table pipeline_stages drop constraint if exists pipeline_stages_meta_event_check;

alter table pipeline_stages
  add constraint pipeline_stages_meta_event_check
  check (meta_event is null or meta_event ~ '^[A-Za-z][A-Za-z0-9_-]{1,39}$');

comment on column pipeline_stages.meta_event is
  'Nome do evento enviado ao Meta ao entrar nesta coluna. Padrão (Lead/Schedule/Purchase) ou nome próprio. Nulo = não dispara.';
