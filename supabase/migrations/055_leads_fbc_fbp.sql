-- Identificadores de clique do Meta, capturados no formulário do funil.
--
-- fbc é a chave mais forte que existe pra correspondência: identifica O
-- CLIQUE naquele anúncio, então o Meta sabe exatamente quem é, sem
-- probabilidade. Só com telefone e nome a nota de correspondência ficava em
-- 2.5/10; os eventos de navegador da mesma empresa, que carregam esses
-- campos, ficam em 6.1.
--
-- Guardado no LEAD, não no evento, de propósito: capturado uma vez na
-- entrada, vale pra sempre. Quando o mesmo lead for movido pra Agendado
-- daqui a três dias e pra Fechado daqui a vinte, os dois eventos saem
-- carregando o mesmo fbc.
alter table leads
  add column if not exists fbc text,
  add column if not exists fbp text;

comment on column leads.fbc is
  'Identificador do clique no anúncio (fb.1.<timestamp>.<fbclid>). Vem do cookie _fbc do Pixel ou montado a partir do fbclid da URL. O timestamp é o da PRIMEIRA vez que o clique foi visto, não o do envio.';
comment on column leads.fbp is
  'Identificador do navegador, cookie _fbp criado pelo Pixel.';

-- Índice parcial: só interessa contar/filtrar quem TEM o dado, e hoje isso é
-- uma minoria (só lead novo tem). Índice cheio seria quase todo nulo.
create index if not exists idx_leads_com_fbc
  on leads (tenant_id) where fbc is not null;
