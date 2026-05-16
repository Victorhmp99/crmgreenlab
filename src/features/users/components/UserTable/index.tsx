import { ShieldOff, ShieldCheck, Settings } from 'lucide-react'
import { RoleBadge } from '../RoleBadge'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useUserMutations } from '../../hooks/useUserMutations'
import type { TenantUser } from '@/services/users'

interface UserTableProps {
  users:        TenantUser[]
  isLoading:    boolean
  onChangeRole: (user: TenantUser) => void
}

function Avatar({ email }: { email: string }) {
  return (
    <div className="h-9 w-9 rounded-full flex items-center justify-center text-black font-semibold text-sm shrink-0"
      style={{ background: 'var(--tenant-primary)' }}>
      {email[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

export function UserTable({ users, isLoading, onChangeRole }: UserTableProps) {
  const currentUserId    = useAuthStore((s) => s.user?.id)
  const isSuperAdmin     = useAuthStore((s) => s.isSuperAdmin)
  const { toggleActive } = useUserMutations()

  // Super admin vê coluna Empresa porque enxerga todos os tenants
  const headers = isSuperAdmin
    ? ['Usuário', 'Empresa', 'Papel', 'Status', 'Membro desde', 'Ações']
    : ['Usuário', 'Papel', 'Status', 'Membro desde', 'Ações']
  const actionsIdx = headers.length - 1

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#111', borderBottom: '1px solid #1a1a1a' }}>
            {headers.map((h, i) => (
              <th key={h}
                className={`px-4 py-3 text-xs font-medium uppercase tracking-wide ${i === actionsIdx ? 'text-right' : 'text-left'}`}
                style={{ color: '#444' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u.userId === currentUserId
            return (
              <tr key={u.membershipId}
                style={{ borderBottom: '1px solid #191919' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#191919')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar email={u.email} />
                    <div>
                      <p className="font-medium" style={{ color: '#e8e8e8' }}>
                        {u.fullName ?? u.email}
                        {isSelf && (
                          <span className="ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 font-semibold"
                            style={{ background: 'rgba(0,230,118,0.15)', color: '#00e676' }}>
                            você
                          </span>
                        )}
                      </p>
                      {u.fullName && (
                        <p className="text-xs" style={{ color: '#555' }}>{u.email}</p>
                      )}
                    </div>
                  </div>
                </td>

                {isSuperAdmin && (
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium rounded-full px-2.5 py-1"
                      style={{ background: 'rgba(167,139,250,0.08)', color: '#a78bfa' }}>
                      {u.tenantName}
                    </span>
                  </td>
                )}

                <td className="px-4 py-3">
                  <RoleBadge role={u.role} />
                </td>

                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: u.active ? '#00e676' : '#444' }}>
                    <span className="h-1.5 w-1.5 rounded-full"
                      style={{ background: u.active ? '#00e676' : '#333' }} />
                    {u.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>

                <td className="px-4 py-3 text-xs" style={{ color: '#555' }}>
                  {formatDate(u.joinedAt)}
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {!isSelf && (
                      <button
                        onClick={() => onChangeRole(u)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
                        style={{ color: '#555' }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = '#00e676'
                          ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,230,118,0.08)'
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = '#555'
                          ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                        }}
                        title="Alterar papel"
                      >
                        <Settings size={15} />
                      </button>
                    )}

                    {!isSelf && (
                      <button
                        onClick={() => toggleActive.mutate({ membershipId: u.membershipId, active: !u.active })}
                        disabled={toggleActive.isPending}
                        className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                        style={{ color: '#555' }}
                        onMouseEnter={(e) => {
                          const btn = e.currentTarget as HTMLButtonElement
                          btn.style.color = u.active ? '#ff4444' : '#00e676'
                          btn.style.background = u.active ? 'rgba(255,68,68,0.08)' : 'rgba(0,230,118,0.08)'
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = '#555'
                          ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                        }}
                        title={u.active ? 'Desativar acesso' : 'Reativar acesso'}
                      >
                        {u.active ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
