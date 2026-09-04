# DENTAL CRM — Contexto do Projeto

## ⚠️ DEPLOY — REGRA OBRIGATÓRIA (LEIA ANTES DE QUALQUER DEPLOY)

**Existe UM ÚNICO projeto Vercel para este CRM: `crmgreenlab`.**
- Domínio de produção REAL: **https://greenhub.assessoriagreenlab.com.br** (usa HashRouter → /#/login)
- Repo GitHub: github.com/Victorhmp99/crmgreenlab (branch `main`, auto-deploy no push)
- Project ID Vercel: `prj_lMapR2rSPWjUQAVajnYHd0M4ZDPL` · teamId: `team_hWiy9yY8z9WNlrNCBI97a29J`

**NUNCA criar outro projeto Vercel.** Todo deploy e TODA variável de ambiente vão SÓ no `crmgreenlab`.
Antes em 31/05/2026 havia duplicatas (`dental-crm`, `greenlab-growth-hub-2`) que causaram bugs
(deploy/env no projeto errado) — foram EXCLUÍDAS e não devem ser recriadas.

Outros projetos Vercel da conta NÃO são o CRM e NÃO devem ser tocados:
green-clinic-growth (site assessoriagreenlab.com.br), forms-lovable (form.*), scripts-platform (scripts.*), pessoaresolve.

**Setar env var na Vercel:** usar a API REST (NÃO `"valor" | vercel env add` no PowerShell — adiciona BOM invisível
que quebra URLs). POST https://api.vercel.com/v10/projects/{id}/env?teamId={team} body {key,value,type:plain,target:[production,preview]}.

**Backend WhatsApp (SDR/CRC):** projeto Railway `greenlab-crc` → https://greenlab-crc-production.up.railway.app
(repo github.com/Victorhmp99/greenlab-crc). É o que o botão "SDR WhatsApp" abre (via env VITE_CRC_URL).

## O que é
CRM SaaS white label multi-tenant voltado inicialmente para clínicas 
odontológicas, escalável para qualquer nicho. Vendido como SaaS.

## Stack
React + Tailwind + Supabase + Vercel
Futuro: NestJS no backend quando escalar

## Modelo de negócio
Super Admin Master → Admins (revendedores white label, podem revender 
para outros Admins ou Gestores) → Gestores (empresas) → Vendedores

## Papéis
Só existem quatro cargos: **super admin** (dono do servidor), **admin**,
**gestor** e **vendedor**. O cargo DENTRO da empresa decide o que a pessoa vê e
faz naquela empresa — ser super admin da plataforma não vale como cargo de
empresa. Detalhe em [SEGURANCA.md](SEGURANCA.md).

## Super Admins (tabela `super_admins`, type='master')
- assessoriagreenlab@gmail.com — conta principal
- vhvictor2015@gmail.com — reserva contra ficar trancado para fora (02/09/2026)

Não existe e-mail embutido em função nenhuma: quem manda é a tabela. Antes só
havia UMA conta, e perder o acesso a ela deixaria a plataforma sem administrador.

O super admin **administra** (empresas, usuários, papéis, exclusão) mas **não lê**
dado de cliente: as políticas de SELECT em `leads` e afins exigem ser membro da
empresa. Só o DELETE aceita super admin, porque excluir empresa precisa disso.
É de propósito — o dono da plataforma não navega no histórico de pacientes das
clínicas.

## O que já está implementado
- Login e autenticação
- Pipeline Kanban
- Gestão de leads
- Importação via Google Sheets e CSV
- Exportação de leads
- Dashboard com métricas e computação automática de receita, previsão e perda
- Módulo de metas
- Módulo financeiro básico
- Gestão de usuários
- Hierarquia completa de permissões (Super Admin Master, Super Admin 
  Auxiliar, Admin, Gestor, Vendedor)
- Sistema de Super Admin Master com ativação de contas
- Campos personalizados no formulário de lead
- Automação de formulário e WhatsApp (implementado, falta testar)

## O que falta implementar
- Etiquetas e comentários por lead
- Tarefas por lead com calendário interno e lista de tarefas
- Integração com Google Calendar
- WhatsApp multi-sessão (várias linhas por empresa no mesmo CRM)
- IA interna por empresa (análise de funil, financeiro e scripts)
- White label completo por tenant

## Fases futuras
- IA avançada via OpenAI
- Meta Ads e Google Ads

## Arquitetura futura (considerar em toda decisão)
- Websockets para tempo real
- Webhook para captura de leads de formulários externos
- WhatsApp multi-sessão via Evolution API
- Backend NestJS + Prisma quando escalar

---

# REGRAS OBRIGATÓRIAS DE DESENVOLVIMENTO

## Segurança

**Leia [SEGURANCA.md](SEGURANCA.md) antes de mexer em permissão, exclusão ou
qualquer função do banco.** Lá está quem pode o quê, onde cada regra mora e como
conferir. Duas armadilhas que já custaram caro e estão explicadas lá: função
`SECURITY DEFINER` roda ACIMA do RLS (é nela que a permissão precisa estar), e
função nova nasce ABERTA no Supabase (toda migration que cria função termina com
`REVOKE` explícito).

- Toda query deve filtrar por tenant_id
- RLS ativo em todas as tabelas
- Soft delete em todas as deleções (campo deleted_at) — **regra escrita mas NUNCA implementada**: hoje exclusão de lead é `DELETE` de verdade e não há lixeira (ver SEGURANCA.md)
- Operações críticas são atômicas
- Admin nunca vê dados de tenants não vinculados a ele
- Frontend nunca é a única camada de proteção

## Código limpo
- Cada função faz apenas uma coisa
- Sem duplicação de código
- Tipagem TypeScript correta
- Separação de responsabilidades (services, hooks, components)

## Agentes disponíveis — consultar sempre
- .claude/agents/security-db.md → antes de qualquer query ou migration
- .claude/agents/architecture.md → em qualquer mudança estrutural
- .claude/agents/frontend-ux.md → ao criar ou alterar componentes
- .claude/agents/qa.md → antes de entregar qualquer feature

## Skills disponíveis — usar sempre

@C:\Users\Admin\.claude\skills-biblioteca\clean-general\SKILL.md
@C:\Users\Admin\.claude\skills-biblioteca\api-design-reviewer\SKILL.md
@C:\Users\Admin\.claude\skills-biblioteca\spec-driven-workflow\SKILL.md
@C:\Users\Admin\.claude\skills-biblioteca\pr-review-expert\SKILL.md
@C:\Users\Admin\.claude\skills-biblioteca\system-architect\SKILL.md
@C:\Users\Admin\.claude\skills-biblioteca\security-reviewer\SKILL.md

---

# FLUXO DE TRABALHO OBRIGATÓRIO

Para qualquer tarefa nova:
1. Ler todos os arquivos relevantes
2. Identificar o que já existe e pode ser reaproveitado
3. Identificar dependências e impacto em outros módulos
4. Propor plano completo com ordem de implementação
5. Aguardar aprovação do usuário
6. Implementar uma etapa por vez
7. Entregar e aguardar confirmação antes de avançar

NUNCA implementar sem aprovação prévia do plano.
NUNCA criar algo que já existe de outra forma.
NUNCA tomar decisões de banco de dados sem consultar o agente security-db.
