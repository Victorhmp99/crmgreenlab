import { useState } from 'react'
import { UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { UserTable } from '../components/UserTable'
import { ChangeRoleModal } from '../components/ChangeRoleModal'
import { InviteModal } from '../components/InviteModal'
import { useUsers } from '../hooks/useUsers'
import type { TenantUser } from '@/services/users'

export function UsersPage() {
  const { data: users = [], isLoading } = useUsers()
  const [changingRole, setChangingRole] = useState<TenantUser | null>(null)
  const [showInvite, setShowInvite]     = useState(false)

  const activeCount   = users.filter((u) => u.active).length
  const inactiveCount = users.filter((u) => !u.active).length

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Usuários</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-slate-500">
              <span className="font-semibold text-green-600">{activeCount}</span> ativos
            </span>
            {inactiveCount > 0 && (
              <span className="text-sm text-slate-400">
                · <span className="font-semibold">{inactiveCount}</span> inativos
              </span>
            )}
          </div>
        </div>
        <Button onClick={() => setShowInvite(true)}>
          <UserPlus size={15} />
          Convidar usuário
        </Button>
      </div>

      {/* Tabela */}
      {!isLoading && users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white flex flex-col items-center gap-3 py-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Users size={26} className="text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">Nenhum usuário encontrado</p>
          <p className="text-sm text-slate-400">Convide membros da sua equipe para começar</p>
          <Button size="sm" onClick={() => setShowInvite(true)}>
            <UserPlus size={14} />
            Convidar agora
          </Button>
        </div>
      ) : (
        <UserTable
          users={users}
          isLoading={isLoading}
          onChangeRole={setChangingRole}
        />
      )}

      {/* Aviso de permissões */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-500">
        <strong>Sobre os níveis de acesso:</strong>{' '}
        <span className="font-medium text-violet-600">Admin</span> — acesso total, incluindo esta página ·{' '}
        <span className="font-medium text-blue-600">Gestor</span> — vê métricas e gerencia leads de todos ·{' '}
        <span className="font-medium text-slate-600">Vendedor</span> — gerencia apenas seus próprios leads
      </div>

      {/* Modais */}
      <ChangeRoleModal
        user={changingRole}
        onClose={() => setChangingRole(null)}
      />
      <InviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
      />
    </div>
  )
}
