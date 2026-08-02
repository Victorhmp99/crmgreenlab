import { useAuth } from './useAuth'

// Funções que o super admin pode ligar/desligar por empresa. Para lançar uma
// função nova cobrável no futuro: adicione a chave aqui e gate onde ela aparece.
export type FeatureKey = 'automations' | 'financeiro' | 'relatorios' | 'meta_ads' | 'sdr_whatsapp'

export const FEATURE_CATALOG: { key: FeatureKey; label: string; description: string }[] = [
  { key: 'automations',  label: 'Automações da pipeline', description: 'Webhook, WhatsApp e etapa de entrada dentro do Pipeline.' },
  { key: 'financeiro',   label: 'Financeiro',             description: 'Menu Financeiro (receita e lançamentos).' },
  { key: 'relatorios',   label: 'Relatórios',             description: 'Menu Relatórios.' },
  { key: 'meta_ads',     label: 'Meta Ads',               description: 'Menu Meta Ads.' },
  { key: 'sdr_whatsapp', label: 'SDR WhatsApp',           description: 'Atalho para o atendimento via WhatsApp (CRC).' },
]

// Planos = presets de funções. Aplicar um plano liga o pacote de uma vez;
// depois dá pra ligar/desligar função específica por cliente (override).
export const PLAN_CATALOG: { key: string; label: string; price: string; features: FeatureKey[] }[] = [
  { key: 'start',    label: 'Start',    price: 'R$ 149', features: ['automations'] },
  { key: 'standard', label: 'Standard', price: 'R$ 299', features: ['automations', 'financeiro', 'relatorios', 'meta_ads'] },
  { key: 'plus',     label: 'Plus',     price: 'R$ 399', features: ['automations', 'financeiro', 'relatorios', 'meta_ads', 'sdr_whatsapp'] },
]

// Compara dois conjuntos de features (ignora ordem) — usado pra saber se a
// empresa está exatamente num plano ou "personalizada".
export function sameFeatureSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = new Set(a)
  return b.every((x) => sa.has(x))
}

/* Lê as funções liberadas da empresa ativa. Fail-open: se a lista ainda não
   carregou (undefined), não esconde nada — evita sumir função por glitch de
   carregamento. Uma lista vazia [] significa, de propósito, "nada liberado". */
export function useFeatures() {
  const { tenant } = useAuth()
  const features = tenant?.features

  function hasFeature(key: FeatureKey): boolean {
    if (!features) return true
    return features.includes(key)
  }

  return { hasFeature, features }
}
