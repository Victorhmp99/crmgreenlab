import { Phone, MessageCircle, Mail, Calendar, FileText, ArrowRight, Download } from 'lucide-react'
import type { ActivityType } from '@/types'

interface Config {
  icon:  React.ElementType
  bg:    string   // rgba color
  color: string   // icon color
  label: string
  text:  string   // text color for ActivityItem
}

export const ACTIVITY_CONFIG: Record<ActivityType, Config> = {
  call:         { icon: Phone,         bg: 'rgba(64,160,255,0.12)',   color: '#40a0ff', label: 'Ligação',    text: '#40a0ff'  },
  whatsapp:     { icon: MessageCircle, bg: 'rgba(0,230,118,0.12)',    color: '#00e676', label: 'WhatsApp',   text: '#00e676'  },
  email:        { icon: Mail,          bg: 'rgba(167,139,250,0.12)',  color: '#a78bfa', label: 'E-mail',     text: '#a78bfa'  },
  meeting:      { icon: Calendar,      bg: 'rgba(251,191,36,0.12)',   color: '#fbbf24', label: 'Reunião',    text: '#fbbf24'  },
  note:         { icon: FileText,      bg: 'rgba(150,150,150,0.1)',   color: '#888',    label: 'Anotação',   text: '#888'     },
  stage_change: { icon: ArrowRight,    bg: 'rgba(236,72,153,0.12)',   color: '#ec4899', label: 'Etapa',      text: '#ec4899'  },
  import:       { icon: Download,      bg: 'rgba(150,150,150,0.1)',   color: '#666',    label: 'Importação', text: '#666'     },
}

export const MANUAL_ACTIVITY_TYPES: ActivityType[] = ['call', 'whatsapp', 'email', 'meeting', 'note']

interface ActivityTypeIconProps {
  type: ActivityType
  size?: 'sm' | 'md'
}

export function ActivityTypeIcon({ type, size = 'md' }: ActivityTypeIconProps) {
  const cfg  = ACTIVITY_CONFIG[type] ?? ACTIVITY_CONFIG.note
  const Icon = cfg.icon
  const dim  = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  const iconSize = size === 'sm' ? 14 : 18

  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center shrink-0`}
      style={{ background: cfg.bg }}
    >
      <Icon size={iconSize} style={{ color: cfg.color }} />
    </div>
  )
}

export function ActivityTypeOptions() {
  return MANUAL_ACTIVITY_TYPES.map((type) => ({
    value: type,
    label: ACTIVITY_CONFIG[type].label,
  }))
}
