# Segurança e permissões

Estado verificado em **03/09/2026**. Este arquivo é a referência de quem pode o
quê no CRM, onde cada regra mora e como conferir que ainda vale.

Não é um resumo do que se pretende fazer: tudo aqui foi testado contra o banco
de produção, com usuários reais, em empresas descartáveis criadas dentro de uma
transação e revertidas ao fim.

---

## A regra-mãe

**O cargo DENTRO da empresa decide o que a pessoa vê e faz naquela empresa.**

Ser super admin da plataforma não vale como cargo de empresa. A mesma conta
pode ser vendedora numa empresa, gestora em outra e admin numa terceira — e em
cada uma ela é tratada pelo cargo que tem ali.

Isso já estava escrito no `CLAUDE.md` ("o super admin administra mas não lê dado
de cliente") e o código não seguia: as funções checavam `gestor OU super admin`,
então uma conta de plataforma que também era vendedora de um cliente enxergava o
faturamento daquele cliente. Corrigido na migration 076.

## Os quatro cargos

| Cargo | O que é |
|---|---|
| **super admin** | Dono do servidor. Tabela `super_admins`. Administra a plataforma. |
| **admin** | Manda na empresa onde tem esse cargo. |
| **gestor** (`manager`) | Toca a operação da empresa. |
| **vendedor** (`seller`) | Trabalha os leads dele. |

Além do cargo existe o **criador da empresa** (`tenants.owner_user_id`), que tem
poderes que nem outro admin tem — excluir a empresa, por exemplo.

---

## Quem pode o quê

### Ver número da empresa (faturamento, receita, previsão, ranking, metas)

| | Vendedor | Gestor | Admin | Criador | Super admin |
|---|---|---|---|---|---|
| Carteira do Dashboard | só os leads dele | empresa (com botão "Meus") | idem gestor | idem | idem |
| Receita (caixa) | não | sim | sim | sim | sim |
| Relatório por vendedor | **não** | sim | sim | sim | sim |
| Metas | só a dele | todas | todas | todas | todas |
| Financeiro / Meta Ads | não (menu e rota) | sim | sim | sim | sim |

O menu esconde, a rota redireciona **e** a função do banco recusa. As três
camadas existem porque esconder botão nunca protegeu nada: o número chegava no
navegador do mesmo jeito.

### Apagar lead

| Quem | Limite |
|---|---|
| Super admin | sem limite, em qualquer empresa |
| Admin da empresa | sem limite naquela empresa |
| Criador da empresa | sem limite |
| Gestor que não é o criador | até 25% dos leads por dia (mínimo de 5) |
| Vendedor | só lead cadastrado nas últimas 12 horas |

A cota de 25% conta numa janela de 24h, não por ação — por ação sozinho seria
contornado repetindo. A base soma o que existe com o que a pessoa já apagou na
janela, senão ela encolheria a cada linha e a cota fecharia antes da hora.

Exclusão em massa acima da cota **recusa a operação inteira**, não apaga parte.

### Responsável pelo lead (`assigned_to`)

| Quem | Pode |
|---|---|
| Gestor, admin, criador | atribuir a qualquer pessoa ativa da empresa |
| Vendedor | só assumir para si, e só lead que está **sem** dono |
| Ninguém | atribuir a quem não é membro ativo da empresa |

Lead novo já nasce com dono: quem cria fica com ele; lead de webhook ou
importação (sem usuário logado) fica com o criador da empresa; e arrastar o card
para uma etapa de **venda** põe o lead no nome de quem arrastou — mas só se
estiver sem dono, para um gestor organizando o quadro não tomar a venda do
vendedor sem perceber.

### Excluir a empresa

Só **o criador** (`tenants.owner_user_id`) ou super admin. Outro admin não
consegue, e também não consegue rebaixar nem desativar o criador — sem essa
segunda trava, a primeira se contornava em dois passos.

---

## Onde cada regra mora

| Migration | O que garante |
|---|---|
| `069_endurecimento_execucao_de_funcoes` | Ninguém executa função do banco sem login, exceto o fluxo de convite. |
| `071_quem_pode_o_que` | Só o criador exclui a empresa; o criador não pode ser rebaixado; funções de bastidor viram `service_role`. |
| `072_vendedor_nao_ve_numero_da_empresa` | Ranking de vendas e metas deixam de ser visíveis para vendedor. |
| `073_dashboard_do_vendedor_e_dele` | Dashboard do vendedor passa a ser dos leads dele. |
| `074_responsavel_pelo_lead` | Quem pode trocar o responsável; venda vai para quem arrastou; gestor ganha o recorte "Meus". |
| `075_lead_sem_dono_fica_com_o_dono_da_empresa` | Histórico órfão atribuído; lead de rotina nasce com dono. |
| `076_cargo_na_empresa_decide` | Cargo na empresa decide — super admin não sobrepõe. |
| `077_quem_pode_apagar_lead` | Cota de exclusão por cargo, com rastro em `leads_excluidos`. |

---

## Três decisões que explicam o desenho

**1. Gatilho em vez de política de RLS quando a recusa precisa ter motivo.**
RLS que recusa devolve "0 linhas apagadas" — sucesso silencioso, e a pessoa acha
que apagou. O gatilho recusa dizendo o porquê. Por isso a regra de exclusão de
lead vive em `trg_quem_pode_apagar_lead` e a política só confere se a pessoa é
da empresa.

**2. Função `SECURITY DEFINER` roda ACIMA do RLS.**
É nela que a permissão precisa estar escrita. Foi assim que o vendedor
alcançava, pela API, número que a tela nunca mostrava: as tabelas estavam
certas, as funções é que só perguntavam "é membro?".

**3. Função nova nasce ABERTA no Supabase.**
O Supabase mantém um *default privilege* que concede `EXECUTE` a `anon` e
`authenticated` em toda função criada em `public`. Tentei virar isso com
`ALTER DEFAULT PRIVILEGES` e **não funciona** — o default do Supabase vence.
Então **toda migration que cria função precisa terminar com `REVOKE` explícito**
e o `GRANT` só para quem precisa. `CREATE OR REPLACE` também reseta grants:
reaplicar sempre.

---

## Como conferir (rode depois de qualquer migration)

O verificador do próprio Supabase pega a maior parte:

```
get_advisors(type: "security")
```

Hoje ele acusa, e está tudo explicado:

- **3 funções executáveis sem login** — `get_invite_info`,
  `get_signup_token_info`, `invite_email_has_account`. É o fluxo de
  convite/cadastro. Todas recebem TOKEN, não e-mail, então não servem para
  descobrir se um e-mail tem conta.
- **89 funções executáveis por usuário logado** — esperado: é como o app
  funciona. Cada uma confere permissão por dentro.
- **3 tabelas com RLS e nenhuma política** — `task_reminder_sent`,
  `webhook_rate_limits`, `leads_backfill_responsavel`. Nenhuma política =
  ninguém lê pela API; só o `service_role` alcança. É proposital.
- **Proteção contra senha vazada desligada** — pendência, ver abaixo.

Consultas que valem repetir:

```sql
-- Nenhuma política pode existir sem amarrar empresa ou usuário
select tablename, policyname, cmd from pg_policies
where schemaname='public'
  and coalesce(qual,'')||coalesce(with_check,'') not ilike '%tenant%'
  and coalesce(qual,'')||coalesce(with_check,'') not ilike '%auth.uid()%';

-- Nenhuma tabela pode ficar sem RLS
select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

-- Função que ESCREVE, é chamável por quem está logado e não confere nada
with f as (select p.oid, p.proname, pg_get_functiondef(p.oid) d from pg_proc p
           join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.prosecdef
             and p.prorettype <> 'pg_catalog.trigger'::regtype)
select proname from f
where d ~* '\m(insert into|update |delete from)\M'
  and d !~* '(is_tenant_|super_admins)'
  and has_function_privilege('authenticated', oid, 'execute');
```

As três devem voltar **vazias**. Em 03/09/2026, voltaram.

Do lado do site, os cabeçalhos estão no ar (conferido com `curl -I`):
CSP com `frame-ancestors 'none'`, HSTS de 2 anos, `X-Frame-Options: DENY`,
`nosniff` e `Referrer-Policy`. O bundle publicado não contém chave de serviço
nem o modo demo (que desliga a autenticação em desenvolvimento).

---

## Pendências e decisões

Decidido com o Victor em 03/09/2026.

**1. `check-whatsapp` — FECHADA, falta excluir.** Era endpoint público, sem
exigir segredo de quem chamava, que respondia se um telefone tem WhatsApp
consultando a sessão do CRC: um oráculo de enumeração apontado para a conta de
WhatsApp, que é o volume que derruba ou bane a sessão. A checagem foi descartada
em 15/08/2026 e a function ficou no ar.

Em 03/09 o corpo foi substituído por um 410 e `verify_jwt` ligado — anônimo
recebe 401, e o segredo do CRC saiu do código publicado. Conferido com `curl`.

Falta a exclusão de verdade, que **exige a conta do dono do projeto**: painel do
Supabase → Edge Functions → `check-whatsapp` → Delete. As tabelas que ela citava
(`whatsapp_check_cache`, `whatsapp_check_limits`) nunca chegaram a existir — o
cache falhava calado e ela batia no CRC toda vez.

**2. Proteção contra senha vazada — desligada, decidido fazer depois.**
Painel do Supabase → Authentication → Policies → *Leaked password protection*.
Não dá para ligar por migration; é ação no painel.

**3. Segredo do `notify-telegram` público — risco aceito.**
A function exige um `secret`, mas quem chama é o formulário do funil, no
navegador: o segredo está no JS público do site. Dá para extrair e mandar
mensagem de até 2000 caracteres para os chats cadastrados. Não vaza dado e não
alcança chat arbitrário — a lista de destinatários é fixa no servidor. Decisão:
manter como está. Se um dia virar spam, a saída é mandar a notificação pelo
servidor, o que muda a origem das notificações dos funis.

**4. Functions no ar sem código no repositório — risco avaliado, decidido manter.**
`notify-telegram` e `sync-meta-ads` existem no Supabase e não em
`supabase/functions/`. **Não é risco de segurança**: o código roda no servidor e
não fica exposto. O risco é operacional — mexer ou reimplantar sem ter a fonte.
E é recuperável: `get_edge_function` devolve o código a qualquer momento.

Há inclusive um motivo para NÃO versionar `notify-telegram` como está: o token
do bot do Telegram está embutido no fonte, e commitar isso colocaria segredo no
git. Se um dia for versionada, o token precisa sair para variável de ambiente
antes.

**5. Não existe lixeira — decidido fazer depois.**
Exclusão de lead é `DELETE` de verdade: sai o lead e, por cascata, atividades,
comentários, etiquetas e tarefas. Não há `deleted_at` em tabela nenhuma, embora
o `CLAUDE.md` mande usar soft delete. `leads_excluidos` guarda só quem apagou o
quê e quando — não dá para restaurar a partir dele.

Quando for fazer: coluna `deleted_at` em `leads`, exclusão vira marcação, toda
consulta de lead passa a filtrar `deleted_at is null`, e uma tela de lixeira com
restaurar e prazo. Mexe em toda consulta de lead do sistema, e esquecer um filtro
faz lead apagado reaparecer em relatório. Também muda o peso das regras de
exclusão: "apagar" viraria "mandar pra lixeira", e a cota de 25% do gestor passa
a proteger menos, porque dá para desfazer.
