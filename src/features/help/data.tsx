import type { ReactNode } from 'react'
import { P, Steps, Bullets, Note, Warn, Code, Table } from './components/Prose'
import {
  LogIn, Kanban, Globe, UserCog, DollarSign, Rocket, Megaphone,
  Send, BarChart3, Package, Settings,
} from 'lucide-react'

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

// ── Conteúdo ──────────────────────────────────────────────────────────────────

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    slug: 'primeiros-passos',
    title: 'Primeiros passos',
    icon: Rocket,
    featured: true,
    questions: [
      {
        slug: 'por-onde-comeco',
        question: 'Acabei de entrar — por onde começo?',
        answer: (
          <>
            <P>A ordem que funciona melhor pra maioria das empresas:</P>
            <Steps items={[
              <><strong>Configurações</strong> → preencha os dados da empresa e escolha a cor do tema.</>,
              <><strong>Usuários</strong> → gere o link de cadastro e convide sua equipe.</>,
              <><strong>Pipeline</strong> → crie a sua pipeline e monte as etapas do seu processo de venda.</>,
              <><strong>Leads</strong> → importe sua base atual (CSV ou Google Sheets) ou cadastre na mão.</>,
              <><strong>Pipeline → Automações</strong> → conecte seu formulário/site pra os leads entrarem sozinhos.</>,
              <><strong>Metas</strong> e <strong>Financeiro</strong> → só depois, quando já tiver movimento no funil.</>,
            ]} />
            <Note>Nada aqui é obrigatório na ordem: você pode usar só a pipeline e os leads no começo, e ligar o resto conforme precisar.</Note>
          </>
        ),
      },
      {
        slug: 'o-que-cada-menu-faz',
        question: 'O que cada item do menu faz?',
        answer: (
          <>
            <Table head={['Menu', 'Pra que serve']} rows={[
              ['Dashboard', 'Visão do dia: leads, conversão, receita, faturamento e o que está travado no funil.'],
              ['Leads', 'A base de contatos. Cadastrar, importar, exportar, etiquetar, comentar e mandar pra pipeline.'],
              ['Pipeline', 'O Kanban da venda. Arrasta o card do lead entre as etapas do seu processo.'],
              ['Disparos', 'Histórico de contatos feitos (ligação, WhatsApp, e-mail, reunião, anotação) e follow-ups.'],
              ['Tarefas', 'Lista e agenda do que precisa ser feito, com vencimento e responsável.'],
              ['Metas', 'Meta por vendedor e por período, com acompanhamento automático do progresso.'],
              ['Financeiro', 'Receita, faturamento, despesas, contratos, produtos e previsão de caixa.'],
              ['Relatórios', 'Performance por vendedor, por canal de origem e o funil de conversão.'],
              ['Meta Ads', 'Dados das campanhas do Facebook/Instagram Ads dentro do CRM.'],
              ['SDR WhatsApp', 'Atendimento por WhatsApp conectado ao CRM.'],
              ['Usuários', 'Quem tem acesso, com qual cargo.'],
              ['Configurações', 'Dados da empresa, cores, campos personalizados e chaves de integração.'],
            ]} />
            <Note>Alguns menus só aparecem pro seu cargo, ou dependem do plano contratado. Veja "Planos e funções".</Note>
          </>
        ),
      },
      {
        slug: 'trocar-tema',
        question: 'Como troco entre tema claro e escuro?',
        answer: (
          <P>Use o botão de tema no topo da tela. A escolha fica salva no seu navegador e vale só pra você — não muda o tema dos outros usuários da empresa.</P>
        ),
      },
      {
        slug: 'mudar-cor-sistema',
        question: 'Como mudo a cor do sistema pra identidade da minha empresa?',
        answer: (
          <>
            <P>Em <strong>Configurações → Cores do tema</strong>, escolha uma das paletas prontas (Verde Neon, Azul, Roxo, Rosa, Laranja, Ciano) ou defina a cor na mão.</P>
            <Note>A cor vale por empresa: se você gerencia várias, cada uma pode ter a sua. Todo mundo daquela empresa passa a ver a nova cor.</Note>
          </>
        ),
      },
    ],
  },
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
        slug: 'exportar-leads',
        question: 'Como exporto meus leads?',
        answer: (
          <>
            <P>Em <strong>Leads</strong>, clique em <strong>Exportar</strong>. Sai um CSV com os leads que estão passando pelos filtros ativos na tela.</P>
            <Note>Se quiser exportar só um recorte (ex: perdidos do mês, ou de uma origem específica), aplique os filtros antes de exportar.</Note>
          </>
        ),
      },
      {
        slug: 'ordenar-leads',
        question: 'Como ordeno a lista de leads?',
        answer: (
          <>
            <P>No seletor de ordenação da tela de Leads você tem quatro opções:</P>
            <Bullets items={[
              <><strong>Criação (recentes)</strong> — os cadastrados por último aparecem primeiro.</>,
              <><strong>Criação (antigos)</strong> — os mais antigos primeiro, bom pra achar base parada.</>,
              <><strong>Atualização (recentes)</strong> — quem teve mexida mais recente (qualquer alteração, não só troca de etapa).</>,
              <><strong>Atualização (antigos)</strong> — quem está sem nenhum toque há mais tempo. É a melhor pra caçar lead esquecido.</>,
            ]} />
          </>
        ),
      },
      {
        slug: 'etiquetas-comentarios',
        question: 'Como uso etiquetas e comentários no lead?',
        answer: (
          <>
            <P><strong>Etiquetas</strong> são marcadores coloridos livres (ex: "quente", "sem budget", "indicação"). Aparecem embaixo do nome do lead na lista e servem pra filtrar e bater o olho.</P>
            <P><strong>Comentário</strong> é uma anotação curta do lead — o começo dela aparece na própria linha da lista, e o texto completo você vê ao abrir o lead.</P>
            <Steps items={[
              <>Na lista de Leads, clique no lead pra abrir o painel lateral.</>,
              <>Use o campo de etiquetas pra criar ou aplicar uma (a cor é escolhida na criação).</>,
              <>Escreva o comentário no campo de anotação e salve.</>,
            ]} />
          </>
        ),
      },
      {
        slug: 'adicionar-lead-pipeline',
        question: 'Como jogo um lead da lista direto pra uma etapa da pipeline?',
        answer: (
          <>
            <Steps items={[
              <>Na tela <strong>Leads</strong>, na coluna de ações da linha, clique no botão de adicionar à pipeline.</>,
              <>Escolha a pipeline e a etapa de destino.</>,
              <>Confirme — o card aparece no Kanban na hora.</>,
            ]} />
            <Note>Antes de confirmar, o sistema mostra se aquele lead <strong>já está em alguma etapa</strong> de alguma pipeline — assim você não duplica sem saber. A movimentação também entra no histórico de disparos e conta como alteração do lead.</Note>
          </>
        ),
      },
      {
        slug: 'buscar-lead-pipeline',
        question: 'Tenho muitos cards no Kanban. Como acho um lead específico?',
        answer: (
          <P>Use a busca dentro da tela <strong>Pipeline</strong>. Ela procura pelo nome/telefone e mostra o resultado indicando <strong>em qual etapa</strong> aquele lead está, mesmo que a etapa esteja fora da parte visível da tela.</P>
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
        slug: 'campos-personalizados',
        question: 'Como crio campos próprios no cadastro de lead?',
        answer: (
          <>
            <P>Em <strong>Configurações → Campos personalizados do lead</strong> você cria perguntas próprias (ex: "Faturamento mensal", "Quantas cadeiras a clínica tem").</P>
            <Bullets items={[
              <>Cada campo tem um <strong>nome</strong> (o que aparece na tela) e uma <strong>chave técnica</strong> (usada por formulários e automações), com botão de copiar.</>,
              <>Campos desativados param de aparecer em formulários novos, mas o que já foi respondido continua guardado.</>,
              <>Os valores aparecem no painel do lead e podem ser preenchidos por webhook.</>,
            ]} />
          </>
        ),
      },
      {
        slug: 'telefone-duplicado',
        question: 'Cadastrei um lead e ele diz que já existe. Por quê?',
        answer: (
          <P>O telefone é único dentro de cada empresa — isso evita que a mesma pessoa vire três leads em três origens diferentes. Se o número já existir, o sistema aproveita o lead que já existe e registra o novo contato nele. Em outra empresa da sua conta, o mesmo número pode existir normalmente: as bases são isoladas.</P>
        ),
      },
    ],
  },
  {
    slug: 'financeiro',
    title: 'Financeiro',
    icon: DollarSign,
    featured: true,
    questions: [
      {
        slug: 'faturamento-vs-receita',
        question: 'Qual a diferença entre Faturamento e Receita?',
        answer: (
          <>
            <P>São duas perguntas diferentes, e o sistema mostra as duas lado a lado:</P>
            <Table head={['Indicador', 'O que responde']} rows={[
              [<strong>Faturamento</strong>, <>Quanto foi <strong>vendido</strong>. Soma o valor total dos contratos fechados — inclusive as parcelas que ainda vão cair nos próximos meses.</>],
              [<strong>Receita</strong>, <>Quanto já <strong>entrou</strong>. Soma só as parcelas cuja data já chegou, mais os lançamentos manuais de receita.</>],
            ]} />
            <P>Exemplo: contrato de R$ 1.000/mês por 12 meses, fechado hoje. O <strong>faturamento</strong> registra R$ 12.000 (a venda inteira). A <strong>receita</strong> começa em R$ 1.000 e sobe R$ 1.000 por mês, conforme as datas chegam.</P>
            <Note>Por isso Receita quase nunca é igual a Faturamento — e não é erro. Faturamento mede o comercial; Receita mede o caixa.</Note>
          </>
        ),
      },
      {
        slug: 'criar-contrato',
        question: 'Como coloco o contrato de um cliente?',
        answer: (
          <>
            <Steps items={[
              <>Abra o lead (na lista de Leads ou pelo card no Kanban).</>,
              <>Na seção de contrato, escolha o tipo de cobrança e preencha valor e data de início.</>,
              <>Salve — a partir daí o sistema cuida de faturamento, receita e lembretes sozinho.</>,
            ]} />
            <P>Os tipos disponíveis:</P>
            <Table head={['Tipo', 'Quando usar']} rows={[
              [<strong>Recorrente com prazo</strong>, 'Mensalidade com número de meses definido (ex: 12x de R$ 1.000).'],
              [<strong>Recorrente sem prazo</strong>, 'Mensalidade que continua indefinidamente até você cancelar. Não tem número de parcelas.'],
              [<strong>Pagamento único</strong>, 'Cobrança de uma vez só (projeto, setup, entrada).'],
              [<strong>Porcentagem</strong>, 'Quando você cobra um % em cima de algo (ex: % do faturamento do cliente). Disponível junto com os tipos acima.'],
            ]} />
          </>
        ),
      },
      {
        slug: 'contrato-sem-prazo',
        question: 'Como coloco uma mensalidade que não tem data pra acabar?',
        answer: (
          <>
            <P>Escolha <strong>Recorrente</strong> e marque a opção de <strong>sem prazo determinado</strong> — aí você não informa número de parcelas.</P>
            <Bullets items={[
              'A receita continua sendo computada mês a mês, indefinidamente.',
              'Os lembretes de cobrança continuam sendo gerados enquanto o contrato estiver ativo.',
              'Para encerrar, é só cancelar o contrato — nada mais é necessário.',
            ]} />
            <Note>Ao cancelar, o faturamento <strong>congela no que já foi acumulado</strong> — ele não zera nem apaga o histórico. Você continua enxergando o que aquele cliente rendeu enquanto esteve ativo.</Note>
          </>
        ),
      },
      {
        slug: 'contrato-data-antiga',
        question: 'O contrato começou mês passado. Como lanço sem bagunçar as tarefas?',
        answer: (
          <>
            <P>É só colocar a data real de início, mesmo que seja no passado. O sistema trata isso sozinho:</P>
            <Bullets items={[
              <><strong>Não cria nenhum lembrete de cobrança retroativo</strong> — você não é inundado de tarefas vencidas.</>,
              <>As parcelas cuja data já passou <strong>contam como recebidas automaticamente</strong>, sem você precisar confirmar nada.</>,
              <>Os lembretes só começam a partir da próxima data futura.</>,
              <>O valor do lead já sobe considerando o contrato inteiro.</>,
            ]} />
            <Note>Não existe passo de "confirmar recebimento": se a data chegou e o contrato está ativo, entrou na receita. Se o cliente parou de pagar, o caminho é cancelar (ou pausar) o contrato.</Note>
          </>
        ),
      },
      {
        slug: 'produtos-catalogo',
        question: 'Como vendo produtos/serviços extras pro mesmo cliente?',
        answer: (
          <>
            <P>Além do contrato principal, você pode lançar compras avulsas no lead — como um carrinho de itens.</P>
            <Steps items={[
              <>Monte seu catálogo em <strong>Financeiro → Produtos</strong>: nome, valor padrão e categoria.</>,
              <>Abra o lead e adicione o produto na lista de compras dele (dá pra ajustar o valor na hora).</>,
              <>Se o produto ainda não existir no catálogo, você consegue criá-lo direto dali, sem sair da tela.</>,
            ]} />
            <Note>O catálogo é por empresa: cada empresa tem os seus produtos, preços e categorias — nada é compartilhado entre empresas.</Note>
          </>
        ),
      },
      {
        slug: 'valor-do-lead',
        question: 'De onde vem o "valor" que aparece no lead?',
        answer: (
          <>
            <P>Enquanto o lead não tem contrato nem produtos, o valor é <strong>editável na mão</strong> — serve como estimativa do negócio.</P>
            <P>Assim que você lança um contrato ou uma compra, o valor passa a ser <strong>calculado sozinho</strong> (contrato + produtos) e para de aceitar edição manual, pra não divergir do financeiro.</P>
            <Note>Em contrato recorrente com prazo, o valor do lead considera o contrato inteiro (valor × parcelas), não só a primeira mensalidade.</Note>
          </>
        ),
      },
      {
        slug: 'tipos-de-despesa',
        question: 'Qual a diferença entre despesa fixa, variável e pontual?',
        answer: (
          <>
            <Table head={['Natureza', 'O que é']} rows={[
              [<strong>Fixa</strong>, 'Repete todo mês no mesmo valor (aluguel, software, salário). É a que entra na previsão de caixa como saída garantida.'],
              [<strong>Variável</strong>, 'Repete, mas muda de valor (tráfego pago, comissão, insumo).'],
              [<strong>Pontual</strong>, 'Aconteceu uma vez e não se repete (compra de equipamento, taxa avulsa).'],
            ]} />
            <P>Marcar a natureza certa é o que faz a <strong>previsão de caixa</strong> acertar: sem isso, o sistema não sabe o que vai se repetir no mês que vem.</P>
          </>
        ),
      },
      {
        slug: 'previsao-caixa',
        question: 'Como funciona a previsão de caixa?',
        answer: (
          <>
            <P>Em <strong>Financeiro</strong>, a previsão projeta o saldo pra frente cruzando o que já está contratado com o que já está comprometido:</P>
            <Bullets items={[
              <><strong>Entradas</strong>: parcelas futuras dos contratos ativos (inclusive os sem prazo, que seguem projetados até o fim do período escolhido).</>,
              <><strong>Saídas</strong>: despesas fixas e variáveis que se repetem.</>,
            ]} />
            <P>Você escolhe o horizonte (30, 60, 90 dias ou mais) e a data de partida. Contratos cancelados param de projetar na data do cancelamento.</P>
            <Warn>A previsão é uma projeção do que está lançado no sistema — ela não sabe de venda que você ainda não registrou nem de despesa que ainda não cadastrou.</Warn>
          </>
        ),
      },
      {
        slug: 'calculadora-meta',
        question: 'Como uso a calculadora de meta?',
        answer: (
          <>
            <P>Ela responde "quantos eu preciso vender pra bater X?".</P>
            <Steps items={[
              <>Informe a <strong>meta</strong> de faturamento que você quer atingir.</>,
              <>Escolha o <strong>produto/serviço</strong> que você pretende vender (ou informe o ticket médio).</>,
              <>A calculadora mostra quantas vendas são necessárias — e, com sua taxa de conversão, quantos leads isso exige.</>,
            ]} />
          </>
        ),
      },
      {
        slug: 'graficos-financeiro',
        question: 'O que cada gráfico do financeiro mostra?',
        answer: (
          <>
            <Bullets items={[
              <><strong>Evolução mensal</strong> — receita e despesa mês a mês, pra ver tendência.</>,
              <><strong>Pizza de receita</strong> — de onde vem seu dinheiro, dividido por categoria/produto. É o "de qual cliente ou serviço eu dependo".</>,
              <><strong>Quebra por categoria</strong> — o mesmo corte em números, com percentual de cada linha.</>,
              <><strong>Previsão de caixa</strong> — o saldo projetado pra frente.</>,
            ]} />
          </>
        ),
      },
      {
        slug: 'periodo-financeiro',
        question: 'De qual período são os números que estou vendo?',
        answer: (
          <>
            <P>O financeiro trabalha em cima de um <strong>mês de referência</strong>, indicado no topo da tela. Use as setas pra navegar entre os meses; quando você não está no mês corrente, aparece o botão <strong>Voltar pra hoje</strong>.</P>
            <Note>A lista de transações tem filtro de data próprio (De/Até), independente do mês de referência dos cards.</Note>
          </>
        ),
      },
      {
        slug: 'lancar-transacao',
        question: 'Como lanço uma transação manual?',
        answer: (
          <P>Vá em <strong>Financeiro</strong> e clique em nova transação. Escolha se é receita ou despesa, o valor, a data, a categoria e — no caso de despesa — a natureza (fixa, variável ou pontual). Ela entra nos cards, nos gráficos e na previsão automaticamente.</P>
        ),
      },
      {
        slug: 'quem-ve-financeiro',
        question: 'Quem consegue ver o módulo Financeiro?',
        answer: (
          <>
            <P>Só <strong>Gestor</strong> e <strong>Admin</strong> — e apenas se o plano da empresa incluir o Financeiro. Vendedores nunca têm acesso.</P>
            <Note>Sem a função de Financeiro liberada, o lead continua funcionando normalmente, mas com o valor preenchido <strong>na mão</strong>: as áreas de contrato e produtos não aparecem.</Note>
          </>
        ),
      },
    ],
  },
  {
    slug: 'meta-ads',
    title: 'Meta Ads',
    icon: Megaphone,
    featured: true,
    questions: [
      {
        slug: 'meta-o-que-preciso',
        question: 'O que preciso ter pra conectar o Meta Ads?',
        answer: (
          <>
            <Bullets items={[
              <>Acesso de <strong>administrador</strong> ao Gerenciador de Negócios (Business Manager) da conta.</>,
              <>Uma <strong>conta de anúncios</strong> dentro desse Business Manager.</>,
              <>Um <strong>app</strong> no Business Manager (pode ser um que você já tenha — não precisa criar um novo se já existir).</>,
            ]} />
            <Note>Não passa por revisão da Meta e não tem custo: a conexão usa um token de usuário do sistema, gerado dentro do seu próprio Business Manager.</Note>
          </>
        ),
      },
      {
        slug: 'meta-passo-a-passo',
        question: 'Passo a passo pra gerar o token',
        answer: (
          <>
            <Steps items={[
              <>No <strong>Gerenciador de Negócios</strong>, vá em Configurações do negócio.</>,
              <>Em <strong>Usuários → Usuários do sistema</strong>, crie um usuário do sistema com perfil <strong>Administrador</strong>.</>,
              <>Ainda em Usuários do sistema, use <strong>Adicionar ativos</strong> e atribua a ele: a <strong>conta de anúncios</strong> e também o <strong>app</strong>.</>,
              <>Clique em <strong>Gerar novo token</strong>, escolha o app e marque a permissão <code>ads_read</code>.</>,
              <>Copie o token gerado (ele só aparece uma vez).</>,
              <>No CRM, vá em <strong>Meta Ads</strong>, cole o token e salve.</>,
              <>Adicione o <strong>ID da conta de anúncios</strong> e sincronize.</>,
            ]} />
            <Warn>O passo 3 é o que mais trava: se você não atribuir o <strong>app</strong> como ativo do usuário do sistema, a tela de gerar token mostra "Nenhuma permissão disponível".</Warn>
            <P>A tela de Meta Ads no CRM traz esse mesmo passo a passo com as telas nomeadas, pra seguir sem sair do sistema.</P>
          </>
        ),
      },
      {
        slug: 'meta-varias-contas',
        question: 'Posso ter mais de uma conta de anúncios?',
        answer: (
          <>
            <P>Sim. Um token só enxerga todas as contas atribuídas àquele usuário do sistema. No CRM:</P>
            <Steps items={[
              <>Em <strong>Meta Ads</strong>, adicione cada conta pelo ID (com um apelido, pra identificar depois).</>,
              <>As contas viram botões no topo. Clique em uma pra ver só os dados dela, ou em <strong>Todas</strong> pra ver o consolidado.</>,
              <>Ao clicar, a sincronização acontece automaticamente — não precisa apertar mais nada.</>,
            ]} />
            <Note>Dá pra desativar uma conta temporariamente sem apagar o cadastro dela.</Note>
          </>
        ),
      },
      {
        slug: 'meta-metricas',
        question: 'Quais métricas o sistema traz?',
        answer: (
          <>
            <Bullets items={[
              <><strong>Investimento</strong>, impressões, alcance e frequência.</>,
              <><strong>Cliques</strong>, CTR, CPC e CPM.</>,
              <><strong>Resultados</strong> — leads de formulário e conversas iniciadas (WhatsApp/Direct), somados.</>,
              <><strong>CPL</strong> — custo por resultado, calculado em cima do total acima.</>,
              <><strong>Status</strong> e <strong>objetivo</strong> de cada campanha.</>,
            ]} />
            <Note>Somamos lead de formulário com conversa iniciada de propósito: sem isso, uma campanha otimizada pra WhatsApp apareceria com "0 leads" mesmo funcionando bem.</Note>
          </>
        ),
      },
      {
        slug: 'meta-periodo',
        question: 'Como mudo o período dos dados?',
        answer: (
          <P>Use o seletor de período: hoje, ontem, últimos 7/14/30/90 dias, este mês, mês passado ou máximo. Ao trocar, os dados são buscados de novo automaticamente na conta selecionada.</P>
        ),
      },
      {
        slug: 'meta-erro-sync',
        question: 'A sincronização deu erro. O que verifico?',
        answer: (
          <>
            <P>A mensagem de erro na tela costuma dizer o motivo exato. Os três mais comuns:</P>
            <Bullets items={[
              <><strong>Token expirado ou revogado</strong> — gere um novo no Business Manager e salve de novo.</>,
              <><strong>ID da conta errado</strong> — o ID da conta de anúncios não é o mesmo do usuário do sistema nem o do app. Ele começa com <code>act_</code> (o sistema adiciona esse prefixo se você esquecer).</>,
              <><strong>Sem permissão</strong> — a conta de anúncios não foi atribuída ao usuário do sistema, ou o token não tem <code>ads_read</code>.</>,
            ]} />
          </>
        ),
      },
      {
        slug: 'meta-token-seguro',
        question: 'Meu token fica seguro?',
        answer: (
          <P>Fica. O token é gravado no servidor e <strong>nunca é enviado de volta pro navegador</strong> — a tela só sabe se existe um token salvo ou não. Quem conversa com a Meta é uma função de servidor, não o seu navegador. Cada empresa tem o seu próprio token, isolado das demais.</P>
        ),
      },
    ],
  },
  {
    slug: 'automacoes',
    title: 'Automações e Formulários',
    icon: Globe,
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
        slug: 'lead-nao-apareceu',
        question: 'O lead entrou na base mas não apareceu no Kanban',
        answer: (
          <>
            <P>Duas causas possíveis:</P>
            <Bullets items={[
              <>O <code>pipeline_id</code> não foi enviado no payload — sem ele o sistema não sabe pra qual funil mandar.</>,
              <>A pipeline de destino não tem uma <strong>etapa de entrada</strong> definida. Sem ela o lead é criado, mas não ganha card.</>,
            ]} />
            <P>Defina a etapa de entrada no modal de <strong>Automações</strong> da pipeline.</P>
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
      {
        slug: 'whatsapp-sdr',
        question: 'Como funciona o SDR WhatsApp?',
        answer: (
          <>
            <P>É o atendimento por WhatsApp conectado ao CRM: as conversas viram leads e o histórico fica registrado.</P>
            <Steps items={[
              <>Clique em <strong>SDR WhatsApp</strong> no menu pra abrir o painel de atendimento.</>,
              <>Conecte a linha lendo o QR Code com o celular, como no WhatsApp Web.</>,
              <>Mensagens recebidas de números novos criam o lead automaticamente; de números já cadastrados, entram no histórico do lead existente.</>,
            ]} />
            <Note>Essa função depende do plano contratado. Se o item não aparece no menu, ela não está liberada pra sua empresa.</Note>
          </>
        ),
      },
    ],
  },
  {
    slug: 'disparos-tarefas-metas',
    title: 'Disparos, Tarefas e Metas',
    icon: Send,
    questions: [
      {
        slug: 'registrar-disparo',
        question: 'Como registro um contato feito com o lead?',
        answer: (
          <>
            <Steps items={[
              <>Abra o lead e clique em <strong>Registrar disparo</strong> (ou vá em Disparos → novo).</>,
              <>Escolha o tipo: Ligação, WhatsApp, E-mail, Reunião ou Anotação.</>,
              <>Descreva o que foi conversado.</>,
              <>Se quiser, defina a data do <strong>próximo follow-up</strong> — ela vira um lembrete visível na timeline.</>,
            ]} />
            <Note>Movimentações de etapa e importações também entram na timeline automaticamente, marcadas com o tipo próprio — você não precisa registrar.</Note>
          </>
        ),
      },
      {
        slug: 'filtrar-disparos',
        question: 'Como filtro o histórico de disparos?',
        answer: (
          <P>Na tela <strong>Disparos</strong> você filtra por tipo de contato e por intervalo de datas (De/Até). Serve pra auditar atividade da equipe num período e pra medir o volume real de contato por canal.</P>
        ),
      },
      {
        slug: 'criar-tarefa',
        question: 'Como crio e acompanho tarefas?',
        answer: (
          <>
            <P>Em <strong>Tarefas</strong> você cria itens com título, descrição, responsável e data de vencimento. Elas aparecem em lista e em agenda, com destaque pro que está vencido ou vence hoje.</P>
            <Note>Tarefas de cobrança de contratos recorrentes são criadas <strong>automaticamente</strong> — uma por parcela, na data certa. Você não precisa criar na mão.</Note>
          </>
        ),
      },
      {
        slug: 'notificacoes-sino',
        question: 'Como funcionam as notificações do sino?',
        answer: (
          <>
            <P>O sino no topo mostra um <strong>resumo do dia</strong> das suas tarefas: o que vence hoje e o que está atrasado.</P>
            <Bullets items={[
              'É um aviso-resumo por pessoa, não um alerta por tarefa — não enche a tela.',
              'Só chega pro responsável pela tarefa.',
              'O corte do dia usa o horário de Brasília.',
            ]} />
          </>
        ),
      },
      {
        slug: 'criar-meta',
        question: 'Como crio uma meta pra um vendedor?',
        answer: (
          <>
            <Steps items={[
              <>Vá em <strong>Metas</strong> e clique em nova meta.</>,
              <>Escolha o vendedor e o período (o início e o término já vêm sugeridos, e você pode ajustar).</>,
              <>Preencha só os indicadores que quer monitorar: <strong>Leads</strong> captados, <strong>Disparos</strong> feitos e <strong>Fechamentos</strong>. Deixe em branco o que não interessa.</>,
            ]} />
            <Note>O progresso é calculado automaticamente a partir do que acontece no CRM — ninguém precisa atualizar número na mão.</Note>
          </>
        ),
      },
    ],
  },
  {
    slug: 'relatorios',
    title: 'Relatórios e Dashboard',
    icon: BarChart3,
    questions: [
      {
        slug: 'o-que-dashboard-mostra',
        question: 'O que a Dashboard mostra?',
        answer: (
          <>
            <Bullets items={[
              'Leads captados no período e a evolução deles.',
              'Taxa de conversão e valor em negociação.',
              'Faturamento e receita (para quem tem acesso ao Financeiro).',
              'Distribuição dos leads por etapa — onde o funil está entupindo.',
            ]} />
          </>
        ),
      },
      {
        slug: 'performance-vendedor',
        question: 'Como vejo a performance de cada vendedor?',
        answer: (
          <P>Em <strong>Relatórios</strong> você tem o comparativo por vendedor (leads, disparos, conversões) e por canal de origem, com filtro de período no topo. Serve pra responder "quem está produzindo" e "de onde vem lead que fecha".</P>
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
      {
        slug: 'porque-funil-diferente',
        question: 'Por que o funil do relatório não bate com o meu Kanban?',
        answer: (
          <P>Porque são coisas diferentes de propósito. O Kanban é operacional — pode ter dez colunas específicas do seu processo. O funil analítico é o resumo gerencial em poucos passos. O <strong>mapeamento</strong> é o que liga um ao outro: várias etapas do Kanban podem cair no mesmo passo do funil, e etapas não mapeadas simplesmente não entram na conta.</P>
        ),
      },
    ],
  },
  {
    slug: 'planos-funcoes',
    title: 'Planos e Funções',
    icon: Package,
    questions: [
      {
        slug: 'o-que-sao-funcoes',
        question: 'Por que alguns menus não aparecem pra mim?',
        answer: (
          <>
            <P>Duas coisas definem o que você vê:</P>
            <Bullets items={[
              <><strong>Seu cargo</strong> — vendedor não acessa Financeiro, Relatórios nem Meta Ads, independente do plano.</>,
              <><strong>O plano da empresa</strong> — cada função (Automações, Financeiro, Relatórios, Meta Ads, SDR WhatsApp) pode estar ligada ou desligada pra sua empresa.</>,
            ]} />
            <P>Se você é gestor e mesmo assim não vê um menu, é o plano. Fale com quem administra sua conta.</P>
          </>
        ),
      },
      {
        slug: 'sem-financeiro',
        question: 'O que muda se minha empresa não tem o Financeiro liberado?',
        answer: (
          <>
            <P>O CRM funciona normalmente — o que muda é o detalhamento do dinheiro:</P>
            <Table head={['Com Financeiro', 'Sem Financeiro']} rows={[
              ['Contrato do cliente (recorrente, único, %)', 'Não aparece'],
              ['Produtos/compras por lead', 'Não aparece'],
              ['Valor do lead calculado automaticamente', 'Valor preenchido na mão'],
              ['Menu Financeiro, previsão e gráficos', 'Não aparece'],
            ]} />
            <Note>Nada é perdido: se a função for liberada depois, tudo que já existia continua lá.</Note>
          </>
        ),
      },
      {
        slug: 'quem-libera-funcao',
        question: 'Quem libera uma função nova pra minha empresa?',
        answer: (
          <P>Quem administra a plataforma (super admin). A liberação é feita por empresa — dá pra aplicar um pacote de plano inteiro ou ligar/desligar uma função específica pra um cliente. Não é algo que se muda dentro de Configurações da própria empresa.</P>
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
            <Note>Acima disso existe o Super Admin, que administra a plataforma inteira: empresas, planos, limites e contas.</Note>
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
      {
        slug: 'vendedor-ve-tudo',
        question: 'Um vendedor consegue ver os leads dos outros?',
        answer: (
          <P>Ele vê os leads da empresa em que está, mas não tem acesso a Financeiro, Relatórios nem Meta Ads, e não gerencia usuários. O isolamento forte é <strong>entre empresas</strong>: ninguém enxerga dados de uma empresa da qual não faz parte, e isso é garantido no banco de dados — não só escondendo botão na tela.</P>
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
            <Note>Isso cria uma empresa nova e isolada — não dá acesso a dados de empresas de outras pessoas. Se o botão não aparece, o limite da sua conta foi atingido.</Note>
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
    slug: 'configuracoes',
    title: 'Configurações',
    icon: Settings,
    questions: [
      {
        slug: 'dados-empresa',
        question: 'Onde altero os dados da minha empresa?',
        answer: (
          <P>Em <strong>Configurações</strong>, na primeira seção. Nome e dados da empresa aparecem no sistema pra toda a equipe daquela empresa.</P>
        ),
      },
      {
        slug: 'canais-origem',
        question: 'Como cadastro os canais de origem dos leads?',
        answer: (
          <P>Em <strong>Configurações</strong>, na área de canais. Eles alimentam o relatório de "de onde vem meu lead" — vale cadastrar do jeito que você fala no dia a dia (Instagram, indicação, tráfego pago, etc.).</P>
        ),
      },
      {
        slug: 'regenerar-chave',
        question: 'Como regenero a chave do webhook?',
        answer: (
          <>
            <P>Em <strong>Configurações</strong>, na área de integração. Use quando suspeitar que a chave vazou ou quando estiver recebendo spam persistente.</P>
            <Warn>Ao regenerar, <strong>todas</strong> as automações que usam a chave antiga param de funcionar na hora. Atualize seus formulários, Make/Zapier/n8n logo em seguida.</Warn>
          </>
        ),
      },
      {
        slug: 'excluir-empresa',
        question: 'O que tem na "Zona de perigo"?',
        answer: (
          <P>Ações destrutivas e sem volta, como excluir a empresa. Ficam separadas justamente pra não serem clicadas por engano. Se você só quer parar de usar, prefira desativar os acessos em vez de excluir.</P>
        ),
      },
      {
        slug: 'meus-dados-lgpd',
        question: 'Como o sistema trata dados pessoais dos leads?',
        answer: (
          <>
            <Bullets items={[
              'Cada empresa só acessa a sua própria base — o isolamento é garantido no banco de dados.',
              'As deleções preservam histórico quando aplicável (exclusão suave), pra não quebrar relatórios.',
              'O endpoint público de formulários valida chave secreta, limita volume e higieniza o que é gravado.',
            ]} />
            <Note>Como você é quem coleta os dados dos seus leads, mantenha Política de Privacidade e Termos publicados no seu site e um caminho pro titular pedir exclusão.</Note>
          </>
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
