import type { LeadSource } from '@/types'

const SOURCE_MAP: Record<LeadSource, { label: string; emoji: string }> = {
  manual:    { label: 'Manual',      emoji: '✍️' },
  import:    { label: 'Importado',   emoji: '📥' },
  meta_ads:  { label: 'Meta Ads',    emoji: '📘' },
  google:    { label: 'Google',      emoji: '🔍' },
  referral:  { label: 'Indicação',   emoji: '🤝' },
  other:     { label: 'Outro',       emoji: '📌' },
}

export function LeadSourceBadge({ source }: { source: LeadSource }) {
  const { label, emoji } = SOURCE_MAP[source] ?? { label: source, emoji: '•' }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
      <span>{emoji}</span>
      <span>{label}</span>
    </span>
  )
}

export const SOURCE_OPTIONS = Object.entries(SOURCE_MAP).map(([value, { label }]) => ({ value, label }))
