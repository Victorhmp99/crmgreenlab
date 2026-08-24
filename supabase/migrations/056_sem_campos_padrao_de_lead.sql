-- Toda empresa nova nascia com 4 campos personalizados prontos
-- (especialidade_principal, procedimentos_alto_ticket_mes, maior_desafio,
-- investiu_marketing_digital). Isso vinha de quando o CRM era só pra clínica
-- odontológica — hoje ele é white label e vendido pra qualquer nicho, então
-- esses campos apareciam como se fossem padrão do produto pra advogado,
-- vacina, estética e curso de noiva.
--
-- Campo personalizado é justamente a parte que cada empresa desenha do zero.
-- Vir preenchido dá a impressão errada de que é obrigatório, e ninguém apaga
-- o que parece nativo do sistema.
drop trigger if exists trigger_seed_default_lead_fields on tenants;
drop function if exists seed_default_lead_fields();

-- Limpa o que já foi semeado — MAS só onde ninguém respondeu.
--
-- Três empresas adotaram alguns desses campos de verdade (a vacinasys tinha
-- 121 leads com resposta). Apagar a definição não apaga a resposta, que fica
-- em leads.custom_fields: o resultado seria dado órfão, visível no lead e sem
-- rótulo em lugar nenhum. Por isso a exclusão é condicionada ao campo estar
-- realmente vazio naquela empresa.
delete from lead_field_definitions f
where f.field_key in (
        'especialidade_principal', 'procedimentos_alto_ticket_mes',
        'maior_desafio', 'investiu_marketing_digital')
  and not exists (
        select 1 from leads l
        where l.tenant_id = f.tenant_id
          and l.custom_fields ? f.field_key
      );
