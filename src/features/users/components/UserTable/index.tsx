import { ShieldOff, ShieldCheck, Settings } from 'lucide-react'
import { RoleBadge } from '../RoleBadge'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useUserMutations } from '../../hooks/useUserMutations'
import type { TenantUser } from '@/services/users'

interface UserTableProps {
  users:     TenantUser[]
  isLoading: boolean
  onChangeRole: (user: TenantUser) => void
}

function Avatar({ email }: { email: string }) {
  return (
    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
      {email[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

export function UserTable({ users, isLoading, onChangeRole }: UserTableProps) {
  const currentUserId  = useAuthStore((s) => s.user?.id)
  const { toggleActive } = useUserMutations()

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="px-4 py-3 text-left font-medium text-slate-500">Usuário</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Papel</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Membro desde</th>
            <th className="px-4 py-3 text-right font-medium text-slate-500">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {users.map((u) => {
            const isSelf = u.userId === currentUserId

            return (
              <tr key={u.membershipId} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar email={u.email} />
                    <div>
                      <p className="font-medium text-slate-800">
                        {u.fullName ?? u.email}
                        {isSelf && (
                          <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-600 rounded-full px-1.5 py-0.5 font-semibold">
                            você
                          </span>
                        )}
                      </p>
                      {u.fullName && (
                        <p className="text-xs text-slate-400">{u.email}</p>
                      )}
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3">
                  <RoleBadge role={u.role} />
                </td>

                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                    u.active ? 'text-green-600' : 'text-slate-400'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${u.active ? 'bg-green-500' : 'bg-slate-300'}`} />
                    {u.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>

                <td className="px-4 py-3 text-slate-500 text-xs">
                  {formatDate(u.joinedAt)}
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {/* Alterar papel — não aplicável ao próprio usuário */}
                    {!isSelf && (
                      <button
                        onClick={() => onChangeRole(u)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Alterar papel"
                      >
                        <Settings size={15} />
                      </button>
                    )}

                    {/* Ativar / desativar — não aplicável ao próprio usuário */}
                    {!isSelf && (
                      <button
                        onClick={() =>
                          toggleActive.mutate({ membershipId: u.membershipId, active: !u.active })
                        }
                        disabled={toggleActive.isPending}
                        className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 ${
                          u.active
                            ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                            : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                        }`}
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
