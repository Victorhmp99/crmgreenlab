import { Badge } from '@/components/ui/Badge'
import type { LeadStatus } from '@/types'

const STATUS_MAP: Record<LeadStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  active:    { label: 'Ativo',      variant: 'info' },
  converted: { label: 'Convertido', variant: 'success' },
  lost:      { label: 'Perdido',    variant: 'danger' },
  archived:  { label: 'Arquivado',  variant: 'default' },
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const { label, variant } = STATUS_MAP[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}

export const STATUS_OPTIONS = Object.entries(STATUS_MAP).map(([value, { label }]) => ({ value, label }))
