/* Conteúdo da landing separado do layout — copy se ajusta sem mexer em JSX. */

export interface Pillar {
  id:       string
  eyebrow:  string
  title:    string
  features: { title: string; text: string }[]
}

export const PILLARS: Pillar[] = [
  {
    id: 'captar',
    eyebrow: 'Captar',
    title: 'O lead entra sozinho, já no lugar certo',
    features: [
      {
        title: 'Formulário do seu site vira lead',
        text: 'Webhook pronto: o lead cai na pipeline certa, na etapa de entrada que você definiu, com os campos que você criou. Funciona com Make, Zapier, n8n ou qualquer formulário que envie um POST.',
      },
      {
        title: 'Perguntas do seu jeito',
        text: 'Campos personalizados por empresa — faturamento, segmento, o que fizer sentido. Vêm preenchidos do formulário e ficam no card do lead.',
      },
      {
        title: 'Importação em massa',
        text: 'CSV ou link do Google Sheets, com mapeamento de colunas na tela. Telefone repetido não vira lead duplicado.',
      },
      {
        title: 'Proteção contra lixo',
        text: 'Campo-armadilha invisível, limite de requisições e chave secreta regenerável. Robô entra e não grava nada.',
      },
    ],
  },
  {
    id: 'converter',
    eyebrow: 'Converter',
    title: 'Um funil que é do seu processo',
    features: [
      {
        title: 'Pipeline sem ponto cego',
        text: 'Kanban com arrastar e soltar. Quantas pipelines você quiser, cada uma com suas etapas, cores e nomes. Etapa marcada como Ganho ou Perdido muda o status do lead sozinha.',
      },
      {
        title: 'Busca dentro do funil',
        text: 'Digite o nome e o sistema diz em que etapa o lead está, mesmo com a coluna fora da tela. Fim do "some o card".',
      },
      {
        title: 'Etiquetas e comentário',
        text: 'Marcadores coloridos livres e anotação com prévia na própria lista. Bate o olho e sabe com quem está falando.',
      },
      {
        title: 'Histórico de contato',
        text: 'Ligação, WhatsApp, e-mail, reunião ou anotação — tudo na timeline do lead, com data do próximo follow-up.',
      },
      {
        title: 'Tarefas e agenda',
        text: 'Lista e calendário, com responsável e vencimento. O sino entrega um resumo do dia: um aviso por pessoa, não um alerta por tarefa.',
      },
      {
        title: 'Metas por vendedor',
        text: 'Leads captados, disparos feitos e fechamentos, no período que você definir. O progresso sai do que acontece no CRM — ninguém atualiza número na mão.',
      },
    ],
  },
  {
    id: 'cobrar',
    eyebrow: 'Cobrar',
    title: 'A parte que os outros CRMs não fazem',
    features: [
      {
        title: 'Faturamento e receita, separados',
        text: 'Vendeu R$ 12 mil em 12x? Faturamento marca R$ 12 mil hoje. Receita marca R$ 1 mil e sobe sozinha a cada mês que a parcela chega. A diferença entre saber o que você vendeu e saber o que você tem.',
      },
      {
        title: 'Contrato no card do cliente',
        text: 'Recorrente com prazo, recorrente sem prazo, pagamento único ou percentual. As cobranças viram tarefa na data certa, sozinhas. Contrato retroativo conta o que já entrou sem gerar tarefa vencida.',
      },
      {
        title: 'Catálogo de produtos',
        text: 'Seus serviços com valor padrão e categoria. Adicione compras extras no cliente sem mexer no contrato principal.',
      },
      {
        title: 'Previsão de caixa',
        text: '30, 60, 90 dias ou mais. Cruza contratos ativos com despesa fixa e variável. Você para de descobrir o mês apertado no dia 28.',
      },
      {
        title: 'Calculadora de meta',
        text: 'Informe o alvo e o produto: ela devolve quantas vendas e quantos leads você precisa pra chegar lá.',
      },
    ],
  },
  {
    id: 'decidir',
    eyebrow: 'Decidir',
    title: 'Número que sustenta decisão',
    features: [
      {
        title: 'Dashboard',
        text: 'Leads do período com variação, conversão, valor em negociação, faturamento, receita e onde o funil está entupindo.',
      },
      {
        title: 'Relatórios por vendedor e por origem',
        text: 'Quem está produzindo e de onde vem lead que fecha — não lead que só entra.',
      },
      {
        title: 'Funil analítico configurável',
        text: 'Separado do Kanban de propósito: seu time pode ter dez colunas operacionais e a leitura gerencial ser em quatro passos. Você define o mapeamento.',
      },
    ],
  },
]

export interface Integration {
  name:  string
  lead:  string
  text:  string
  bullets: string[]
}

export const INTEGRATIONS: Integration[] = [
  {
    name: 'Meta Ads',
    lead: 'O custo real da campanha, do lado do lead que ela gerou',
    text: 'Conecta com token da sua própria conta de anúncios, em minutos. Sem aprovação da Meta, sem custo, e o token nunca sai do servidor. Várias contas no mesmo token, com troca por clique e sincronização automática.',
    bullets: [
      'Investimento, alcance, frequência, CTR, CPC e CPM por campanha',
      'CPL calculado sobre o resultado real',
      'Conta campanha otimizada pra conversa no WhatsApp — que a maioria dos painéis mostra como "zero leads"',
      'Período de hoje até o máximo, com atualização automática',
    ],
  },
  {
    name: 'SDR WhatsApp',
    lead: 'Onde a informação normalmente morre',
    text: 'Atendimento multi-sessão conectado ao CRM, com conexão por QR Code como no WhatsApp Web. Número novo vira lead automaticamente; número conhecido entra no histórico do lead que já existe.',
    bullets: [
      'Várias linhas na mesma empresa',
      'Conversa vira histórico consultável, não áudio perdido no celular',
      'O lead já nasce dentro do funil',
    ],
  },
]

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Já uso outro CRM. A migração dá trabalho?',
    a: 'Importação por CSV ou link do Google Sheets, com você dizendo qual coluna é o quê. Telefone repetido não duplica.',
  },
  {
    q: 'Meu CRM já mostra faturamento. Qual a diferença?',
    a: 'Quase todos mostram um número só e chamam de receita. Aqui são dois: o que foi vendido e o que efetivamente entrou. Quem já fechou contrato parcelado sabe o tamanho do buraco entre um e outro.',
  },
  {
    q: 'Preciso de alguém técnico pra conectar o Meta Ads?',
    a: 'Não. É um token gerado no seu próprio Gerenciador de Negócios e colado numa tela, com o passo a passo dentro do sistema.',
  },
  {
    q: 'Meu time não vai dar conta de mais um sistema.',
    a: 'Quem vende usa três telas: leads, pipeline e tarefas. Contrato, previsão e relatório ficam com quem gere — e nem aparecem pro resto da equipe.',
  },
  {
    q: 'E a segurança dos meus dados?',
    a: 'Cada empresa só acessa a própria base, e o isolamento é garantido no banco de dados. Cargo e plano são validados no servidor, não pelo navegador.',
  },
  {
    q: 'Dá pra começar pequeno?',
    a: 'Dá. Comece com funil e leads e ligue financeiro, relatórios, Meta Ads ou WhatsApp quando fizer sentido. Nada do que você já cadastrou se perde no caminho.',
  },
  {
    q: 'Sou agência. Posso revender com a minha marca?',
    a: 'Pode. Cada cliente entra como empresa isolada, com a identidade visual dela, e você controla quem acessa o quê.',
  },
  {
    q: 'Tem suporte ou é só documentação?',
    a: 'Central de ajuda dentro do sistema com mais de 60 respostas, documentação completa e time por trás.',
  },
]

export const FATURAMENTO_OPTIONS = [
  'Até R$ 10 mil/mês',
  'R$ 10 mil a R$ 30 mil/mês',
  'R$ 30 mil a R$ 100 mil/mês',
  'R$ 100 mil a R$ 300 mil/mês',
  'Acima de R$ 300 mil/mês',
]
