import type { UserRole } from '@/types'

const ROLE_CONFIG: Record<UserRole, { label: string; className: string }> = {
  admin:   { label: 'Admin',   className: 'bg-violet-100 text-violet-700' },
  manager: { label: 'Gestor',  className: 'bg-blue-100   text-blue-700'   },
  seller:  { label: 'Vendedor',className: 'bg-slate-100  text-slate-600'  },
}

export function RoleBadge({ role }: { role: UserRole }) {
  const { label, className } = ROLE_CONFIG[role] ?? ROLE_CONFIG.seller
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin',   label: 'Admin'    },
  { value: 'manager', label: 'Gestor'   },
  { value: 'seller',  label: 'Vendedor' },
]
