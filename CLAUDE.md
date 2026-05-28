# DENTAL CRM — Contexto do Projeto

## O que é
CRM SaaS white label multi-tenant voltado inicialmente para clínicas 
odontológicas, escalável para qualquer nicho. Vendido como SaaS.

## Stack
React + Tailwind + Supabase + Vercel
Futuro: NestJS no backend quando escalar

## Modelo de negócio
Super Admin Master → Admins (revendedores white label, podem revender 
para outros Admins ou Gestores) → Gestores (empresas) → Vendedores

## Email do Super Admin Master
vhvictor2015@gmail.com — hardcoded como fallback de segurança

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
- Toda query deve filtrar por tenant_id
- RLS ativo em todas as tabelas
- Soft delete em todas as deleções (campo deleted_at)
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
