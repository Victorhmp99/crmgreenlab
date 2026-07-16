import type { ReactNode } from 'react'
import { LogIn, Kanban, Globe, UserCog, DollarSign } from 'lucide-react'

export interface HelpQuestion {
  slug:     string
  question: string
  answer:   ReactNode
}

export interface HelpCategory {
  slug:      string
  title:     string
  icon:      typeof LogIn
  featured?: boolean
  questions: HelpQuestion[]
}

// ── Helpers de formatação de resposta (mantém visual consistente) ────────────

function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{children}</p>
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2 pl-5 list-decimal text-sm" style={{ color: 'var(--text)' }}>
      {items.map((it, i) => <li key={i} className="leading-relaxed">{it}</li>)}
    </ol>
  )
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg px-3 py-2.5 text-xs leading-relaxed"
      style={{ background: 'rgba(64,160,255,0.06)', border: '1px solid rgba(64,160,255,0.2)', color: 'var(--text-muted)' }}>
      {children}
    </div>
  )
}

function Code({ children }: { children: string }) {
  return (
    <pre className="rounded-lg px-3 py-2.5 text-xs overflow-x-auto"
      style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border-dim)', color: 'var(--text)' }}>
      <code>{children}</code>
    </pre>
  )
}

// ── Conteúdo ──────────────────────────────────────────────────────────────────

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    slug: 'leads-pipeline',
    title: 'Leads e Pipeline',
    icon: Kanban,
    featured: true,
    questions: [
      {
        slug: 'importar-leads',
        question: 'Como importo vários leads de uma vez?',
        answer: (
          <>
            <P>Você pode trazer contatos em massa por arquivo CSV ou por uma URL do Google Sheets.</P>
            <Steps items={[
              <>Vá em <strong>Leads</strong> e clique em <strong>Importar</strong>.</>,
              <>Escolha a origem: arquivo CSV ou link do Google Sheets.</>,
              <>No mapeamento de colunas, diga qual coluna da planilha corresponde a nome, telefone, e-mail etc.</>,
              <>Confirme — os leads entram direto na base.</>,
            ]} />
            <Note>O mesmo telefone não se duplica dentro da mesma empresa: se já existir, o sistema reaproveita o lead em vez de criar outro.</Note>
          </>
        ),
      },
      {
        slug: 'ganho-perdido',
        question: 'Como marco um lead como Ganho ou Perdido?',
        answer: (
          <>
            <P>O status muda automaticamente ao arrastar o card do lead para uma coluna — o que importa é o <strong>tipo</strong> daquela coluna, não o nome dela.</P>
            <Steps items={[
              <>No Kanban, passe o mouse no cabeçalho da coluna e clique no lápis (editar).</>,
              <>Escolha o tipo: <strong>Em andamento</strong>, <strong>🏆 Ganho</strong> ou <strong>✕ Perdido</strong>.</>,
              <>Arraste o card do lead para essa coluna — o status do lead muda na hora.</>,
            ]} />
            <Note>Mover o card de volta para uma coluna "Em andamento" reativa o lead automaticamente.</Note>
          </>
        ),
      },
      {
        slug: 'criar-pipeline',
        question: 'Como crio uma nova pipeline?',
        answer: (
          <>
            <Steps items={[
              <>Na tela <strong>Pipeline</strong>, clique em <strong>Criar pipeline</strong>.</>,
              <>Defina nome e cor.</>,
              <>Monte as etapas (colunas) — use <strong>+ Nova etapa</strong> e arraste para reordenar.</>,
              <>Marque qual etapa é o <strong>Início</strong> (onde leads de automação/formulário entram) e qual é a <strong>Final</strong>.</>,
            ]} />
            <P>Você pode ter quantas pipelines quiser (ex: Inbound e Outbound), cada uma com suas próprias etapas.</P>
          </>
        ),
      },
      {
        slug: 'configurar-funil',
        question: 'Como configuro o funil de conversão em Relatórios?',
        answer: (
          <>
            <P>O funil analítico é separado das etapas do Kanban — fica em <strong>Relatórios → Configuração do Funil</strong>, em duas partes:</P>
            <Steps items={[
              <><strong>Passos do funil:</strong> os estágios que você quer medir (ex: Contato → Reunião → Proposta → Fechado), cada um com as atividades (disparos) que fazem o lead avançar.</>,
              <><strong>Mapeamento Pipeline → Funil:</strong> para cada etapa das suas pipelines, escolha a qual passo do funil ela corresponde, e clique em Salvar tudo.</>,
            ]} />
            <Note>Etapas sem mapeamento são ignoradas no funil, mas continuam funcionando normalmente no Kanban.</Note>
          </>
        ),
      },
    ],
  },
  {
    slug: 'automacoes',
    title: 'Automações e Formulários',
    icon: Globe,
    featured: true,
    questions: [
      {
        slug: 'campos-nao-preenchem',
        question: 'Conectei meu formulário, mas os campos personalizados não chegam no lead',
        answer: (
          <>
            <P>Esse é o erro mais comum. A regra é: campos <strong>padrão</strong> (<code>name</code>, <code>email</code>, <code>phone</code>) vão no topo do JSON; campos <strong>personalizados</strong> (as "Perguntas do Formulário") precisam ir <strong>dentro</strong> de um objeto <code>custom_fields</code>. Um campo personalizado solto no topo é ignorado.</P>
            <Code>{`❌ Errado
{
  "name": "Igor",
  "faturamento_mensal": "200000"
}

✅ Certo
{
  "name": "Igor",
  "custom_fields": {
    "faturamento_mensal": "200000"
  }
}`}</Code>
          </>
        ),
      },
      {
        slug: 'onde-pego-chaves',
        question: 'Onde encontro a URL, o tenant_id e a webhook_key da minha empresa?',
        answer: (
          <>
            <P>Tudo isso fica no modal <strong>Automações</strong> de cada pipeline:</P>
            <Steps items={[
              <>Vá em <strong>Pipeline</strong>, escolha a pipeline e clique no ícone de raio (Automações).</>,
              <>Na seção <strong>Formulário externo (Webhook)</strong>, você vê a URL do endpoint e um exemplo de payload já preenchido com o <code>tenant_id</code>, <code>webhook_key</code> e os campos personalizados da sua empresa.</>,
              <>Use o botão de copiar pra não errar nada.</>,
            ]} />
          </>
        ),
      },
      {
        slug: 'make-zapier',
        question: 'Uso Make, Zapier ou n8n — como configuro?',
        answer: (
          <>
            <Steps items={[
              <>Use o módulo de <strong>HTTP</strong> → "fazer uma requisição" (Make a request).</>,
              <><strong>Method:</strong> POST. <strong>Body type:</strong> Raw. <strong>Content type:</strong> JSON (application/json).</>,
              <>No corpo, use o modelo abaixo, trocando os valores pelos campos da sua automação.</>,
            ]} />
            <Code>{`{
  "tenant_id": "<id da empresa>",
  "webhook_key": "<chave da empresa>",
  "pipeline_id": "<pipeline de destino>",
  "name": "{{nome}}",
  "phone": "{{telefone}}",
  "email": "{{email}}",
  "custom_fields": {
    "Nome do campo 1": "{{valor1}}",
    "Nome do campo 2": "{{valor2}}"
  }
}`}</Code>
          </>
        ),
      },
      {
        slug: 'chave-ou-nome',
        question: 'Preciso usar a chave técnica do campo ou posso usar o nome que aparece na tela?',
        answer: (
          <>
            <P>Os dois funcionam. Dentro de <code>custom_fields</code>, o sistema aceita tanto a <strong>chave técnica</strong> (ex: <code>faturamento_mensal</code>) quanto o <strong>nome do campo</strong> como aparece na tela (ex: <code>"Qual a sua média de faturamento mensal?"</code>) — resolve sozinho, ignorando maiúsculas, acentos e espaços.</P>
            <P>A chave exata, com botão de copiar, fica em <strong>Configurações → Campos personalizados do lead</strong>.</P>
          </>
        ),
      },
      {
        slug: 'evitar-spam',
        question: 'Como evito leads falsos/spam no formulário?',
        answer: (
          <>
            <P>O endpoint já tem proteção automática: limite de requisições por minuto/hora e sanitização do que é gravado. Além disso, você pode reforçar do seu lado:</P>
            <Steps items={[
              <>Adicione um campo <strong>oculto</strong> (invisível pro usuário) chamado <code>_hp</code> no formulário. Se ele vier preenchido, o sistema entende que é um robô e finge sucesso sem gravar nada.</>,
              <>Se a chave (<code>webhook_key</code>) vazar e o spam continuar, regenere a chave em Configurações — links antigos param de funcionar.</>,
            ]} />
          </>
        ),
      },
    ],
  },
  {
    slug: 'login-conta',
    title: 'Login e Conta',
    icon: LogIn,
    questions: [
      {
        slug: 'esqueci-senha',
        question: 'Esqueci minha senha, como recupero o acesso?',
        answer: (
          <Steps items={[
            <>Na tela de login, clique em <strong>Esqueceu a senha?</strong></>,
            <>Informe o e-mail da sua conta.</>,
            <>Abra o link que chegar no seu e-mail e defina uma nova senha.</>,
          ]} />
        ),
      },
      {
        slug: 'aceitar-convite',
        question: 'Recebi um link de convite, como entro?',
        answer: (
          <P>Basta abrir o link recebido (formato <code>/convite/&lt;token&gt;</code>). Ele confirma seu e-mail e já te adiciona à empresa, com o papel (cargo) definido por quem convidou.</P>
        ),
      },
      {
        slug: 'trocar-empresa',
        question: 'Como troco entre as empresas que já faço parte?',
        answer: (
          <P>Clique no seletor de empresa no topo da barra lateral e escolha outra da lista. Os dados da tela são recarregados do zero para a empresa selecionada.</P>
        ),
      },
      {
        slug: 'criar-empresa',
        question: 'Como crio uma nova empresa dentro da minha conta?',
        answer: (
          <>
            <P>No seletor de empresa (topo da barra lateral), clique em <strong>Criar nova empresa</strong>. Disponível para quem tem cargo Admin ou Gestor, respeitando o limite de empresas da sua conta.</P>
            <Note>Isso cria uma empresa nova e isolada — não dá acesso a dados de empresas de outras pessoas.</Note>
          </>
        ),
      },
      {
        slug: 'conta-aguardando-bloqueada',
        question: 'Minha conta está "Aguardando" ou "Bloqueada" — o que significa?',
        answer: (
          <P><strong>Aguardando</strong>: o cadastro foi feito, mas ainda precisa ser aprovado por um administrador. <strong>Bloqueada</strong>: o acesso foi suspenso por um administrador. Nos dois casos você consegue entrar, mas não acessa os módulos até a liberação — fale com o admin da sua empresa.</P>
        ),
      },
    ],
  },
  {
    slug: 'usuarios-permissoes',
    title: 'Usuários e Permissões',
    icon: UserCog,
    questions: [
      {
        slug: 'diferenca-cargos',
        question: 'Qual a diferença entre Vendedor, Gestor e Admin?',
        answer: (
          <>
            <P><strong>Vendedor:</strong> opera o dia a dia — leads, pipeline, disparos, tarefas e as próprias metas.</P>
            <P><strong>Gestor:</strong> tudo do vendedor, mais Financeiro, Relatórios, Meta Ads, e gerencia usuários (só vendedores).</P>
            <P><strong>Admin:</strong> gerência total da empresa, incluindo gerenciar outros gestores e admins.</P>
          </>
        ),
      },
      {
        slug: 'convidar-usuario',
        question: 'Como convido alguém pra minha empresa?',
        answer: (
          <Steps items={[
            <>Vá em <strong>Usuários</strong> e clique em <strong>Link de cadastro</strong>.</>,
            <>Escolha o cargo (papel) que a pessoa vai ter.</>,
            <>Copie e envie o link — ao se cadastrar, ela já entra na sua empresa com esse cargo.</>,
          ]} />
        ),
      },
      {
        slug: 'remover-usuario',
        question: 'Como removo ou desativo um usuário?',
        answer: (
          <>
            <P>Na tela <strong>Usuários</strong>, use os botões da linha da pessoa para trocar cargo, ativar/desativar acesso ou remover.</P>
            <Note>Gestor só consegue gerenciar vendedores — não mexe em outros gestores ou admins. Isso é validado no servidor, não só na tela.</Note>
          </>
        ),
      },
    ],
  },
  {
    slug: 'financeiro-relatorios',
    title: 'Financeiro e Relatórios',
    icon: DollarSign,
    questions: [
      {
        slug: 'lancar-transacao',
        question: 'Como lanço uma transação financeira?',
        answer: (
          <P>Vá em <strong>Financeiro → Transações</strong> e clique em nova transação. Ela entra no resumo financeiro e nos gráficos de evolução automaticamente.</P>
        ),
      },
      {
        slug: 'quem-ve-financeiro',
        question: 'Quem consegue ver o módulo Financeiro?',
        answer: (
          <P>Só <strong>Gestor</strong> e <strong>Admin</strong>. Vendedores não têm acesso a Financeiro, Relatórios nem Meta Ads.</P>
        ),
      },
    ],
  },
]

export function findQuestion(slug: string | undefined) {
  if (!slug) return null
  for (const cat of HELP_CATEGORIES) {
    const q = cat.questions.find((q) => q.slug === slug)
    if (q) return { category: cat, question: q }
  }
  return null
}
