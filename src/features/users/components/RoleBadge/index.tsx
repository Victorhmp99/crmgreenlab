import type { UserRole } from '@/types'

const ROLE_CONFIG: Record<UserRole, { label: string; bg: string; color: string }> = {
  admin:   { label: 'Admin',   bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
  manager: { label: 'Gestor',  bg: 'rgba(64,160,255,0.12)',  color: '#40a0ff' },
  seller:  { label: 'Vendedor',bg: 'rgba(150,150,150,0.1)',  color: '#888'    },
}

export function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.seller
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin',   label: 'Admin'    },
  { value: 'manager', label: 'Gestor'   },
  { value: 'seller',  label: 'Vendedor' },
]
