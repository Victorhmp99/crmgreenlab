import { Phone, MessageCircle, Mail, Calendar, FileText, ArrowRight, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActivityType } from '@/types'

interface Config {
  icon:    React.ElementType
  bg:      string
  text:    string
  label:   string
}

export const ACTIVITY_CONFIG: Record<ActivityType, Config> = {
  call:         { icon: Phone,         bg: 'bg-blue-100',    text: 'text-blue-600',   label: 'Ligação'     },
  whatsapp:     { icon: MessageCircle, bg: 'bg-green-100',   text: 'text-green-600',  label: 'WhatsApp'    },
  email:        { icon: Mail,          bg: 'bg-violet-100',  text: 'text-violet-600', label: 'E-mail'      },
  meeting:      { icon: Calendar,      bg: 'bg-amber-100',   text: 'text-amber-600',  label: 'Reunião'     },
  note:         { icon: FileText,      bg: 'bg-slate-100',   text: 'text-slate-600',  label: 'Anotação'    },
  stage_change: { icon: ArrowRight,    bg: 'bg-pink-100',    text: 'text-pink-600',   label: 'Etapa'       },
  import:       { icon: Download,      bg: 'bg-slate-100',   text: 'text-slate-500',  label: 'Importação'  },
}

// Opções exibidas no formulário (exclui os gerados automaticamente pelo sistema)
export const MANUAL_ACTIVITY_TYPES: ActivityType[] = ['call', 'whatsapp', 'email', 'meeting', 'note']

interface ActivityTypeIconProps {
  type: ActivityType
  size?: 'sm' | 'md'
}

export function ActivityTypeIcon({ type, size = 'md' }: ActivityTypeIconProps) {
  const cfg = ACTIVITY_CONFIG[type] ?? ACTIVITY_CONFIG.note
  const Icon = cfg.icon
  const dim  = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  const iconSize = size === 'sm' ? 14 : 18

  return (
    <div className={cn('rounded-full flex items-center justify-center shrink-0', dim, cfg.bg)}>
      <Icon size={iconSize} className={cfg.text} />
    </div>
  )
}

export function ActivityTypeOptions() {
  return MANUAL_ACTIVITY_TYPES.map((type) => ({
    value: type,
    label: ACTIVITY_CONFIG[type].label,
  }))
}
