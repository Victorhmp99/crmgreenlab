import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { RoleBadge, ROLE_OPTIONS } from '../RoleBadge'
import { useUserMutations } from '../../hooks/useUserMutations'
import type { TenantUser } from '@/services/users'
import type { UserRole } from '@/types'

interface ChangeRoleModalProps {
  user:    TenantUser | null
  onClose: () => void
}

export function ChangeRoleModal({ user, onClose }: ChangeRoleModalProps) {
  const { changeRole } = useUserMutations()
  const [selected, setSelected] = useState<UserRole>(user?.role ?? 'seller')

  async function handleSave() {
    if (!user) return
    await changeRole.mutateAsync({ membershipId: user.membershipId, role: selected })
    onClose()
  }

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title="Alterar nível de acesso"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={changeRole.isPending}>Cancelar</Button>
          <Button loading={changeRole.isPending} onClick={handleSave}>Salvar</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 p-3 rounded-xl"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <div className="h-9 w-9 rounded-full flex items-center justify-center text-black font-semibold text-sm shrink-0"
            style={{ background: 'var(--tenant-primary)' }}>
            {(user?.email?.[0] ?? '?').toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: '#e8e8e8' }}>{user?.email}</p>
            <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: '#555' }}>
              Papel atual: <RoleBadge role={user?.role ?? 'seller'} />
            </p>
          </div>
        </div>

        <Select
          label="Novo papel"
          value={selected}
          onChange={(e) => setSelected(e.target.value as UserRole)}
          options={ROLE_OPTIONS}
        />

        <div className="rounded-xl px-3 py-2.5 text-xs"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
          <strong>Atenção:</strong> Alterar para Admin concede acesso total, incluindo gestão de usuários e configurações do tenant.
        </div>
      </div>
    </Modal>
  )
}
