import { useState } from 'react'
import { UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { UserTable } from '../components/UserTable'
import { ChangeRoleModal } from '../components/ChangeRoleModal'
import { InviteModal } from '../components/InviteModal'
import { useUsers } from '../hooks/useUsers'
import type { TenantUser } from '@/services/users'

export function UsersPage() {
  const { data: users = [], isLoading, error } = useUsers()
  const [changingRole, setChangingRole] = useState<TenantUser | null>(null)
  const [showInvite, setShowInvite]     = useState(false)

  const activeCount   = users.filter((u) => u.active).length
  const inactiveCount = users.filter((u) => !u.active).length

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>Usuários</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm" style={{ color: '#555' }}>
              <span className="font-semibold" style={{ color: 'var(--tenant-primary)' }}>{activeCount}</span> ativos
            </span>
            {inactiveCount > 0 && (
              <span className="text-sm" style={{ color: '#444' }}>
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

      {/* Erro real (debug) */}
      {error && (
        <div className="rounded-xl p-4 flex flex-col gap-2"
          style={{ background: '#141414', border: '1px solid rgba(255,68,68,0.2)' }}>
          <p className="text-sm font-medium" style={{ color: '#ff4444' }}>
            Erro ao carregar usuários
          </p>
          <p className="text-xs font-mono rounded px-2 py-1 break-all"
            style={{ background: '#0d0d0d', color: '#ff6666' }}>
            {(error as Error).message}
          </p>
          <p className="text-xs" style={{ color: '#555' }}>
            Execute o SQL <strong style={{ color: '#888' }}>get_tenant_users</strong> + <strong style={{ color: '#888' }}>get_tenant_invites</strong> no Supabase.
          </p>
        </div>
      )}

      {/* Tabela ou estado vazio */}
      {!isLoading && !error && users.length === 0 ? (
        <div className="rounded-xl flex flex-col items-center gap-3 py-16 text-center"
          style={{ border: '1px dashed #2a2a2a', background: '#111' }}>
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: '#1a1a1a' }}>
            <Users size={26} style={{ color: '#333' }} />
          </div>
          <p className="font-medium" style={{ color: '#666' }}>Nenhum usuário encontrado</p>
          <p className="text-sm" style={{ color: '#444' }}>Convide membros da sua equipe para começar</p>
          <Button size="sm" onClick={() => setShowInvite(true)}>
            <UserPlus size={14} />
            Convidar agora
          </Button>
        </div>
      ) : !error ? (
        <UserTable
          users={users}
          isLoading={isLoading}
          onChangeRole={setChangingRole}
        />
      ) : null}

      {/* Aviso de permissões */}
      <div className="rounded-xl px-4 py-3 text-xs"
        style={{ background: '#111', border: '1px solid #1e1e1e', color: '#555' }}>
        <strong style={{ color: '#888' }}>Sobre os níveis de acesso:</strong>{' '}
        <span style={{ color: '#ff4444', fontWeight: 600 }}>Admin</span> — acesso total, incluindo esta página ·{' '}
        <span style={{ color: '#a78bfa', fontWeight: 600 }}>Gestor</span> — vê métricas e gerencia leads de todos ·{' '}
        <span style={{ color: '#888', fontWeight: 600 }}>Vendedor</span> — gerencia apenas seus próprios leads
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
