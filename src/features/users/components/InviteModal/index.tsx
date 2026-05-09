import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Copy, Check, Link, Send } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { RoleBadge, ROLE_OPTIONS } from '../RoleBadge'
import { useUserMutations } from '../../hooks/useUserMutations'
import { useInvites } from '../../hooks/useUsers'
import { formatDate } from '@/lib/utils'
import type { UserRole } from '@/types'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  role:  z.enum(['admin', 'manager', 'seller']),
})
type FormData = z.infer<typeof schema>

interface InviteModalProps {
  open:    boolean
  onClose: () => void
}

function buildInviteUrl(token: string): string {
  return `${window.location.origin}/convite/${token}`
}

export function InviteModal({ open, onClose }: InviteModalProps) {
  const { invite, revoke } = useUserMutations()
  const { data: invites = [] } = useInvites()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'seller' },
  })

  async function onSubmit(data: FormData) {
    await invite.mutateAsync({ email: data.email, role: data.role as UserRole })
    reset()
  }

  async function copyLink(token: string, id: string) {
    await navigator.clipboard.writeText(buildInviteUrl(token))
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const pendingInvites = invites.filter((i) => !i.acceptedAt)
  const acceptedInvites = invites.filter((i) => i.acceptedAt)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convidar Usuário"
      description="Gere um link de convite para adicionar um novo membro ao tenant"
      size="lg"
    >
      {/* Formulário de convite */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex gap-3 items-end">
        <div className="flex-1">
          <Input
            label="E-mail do convidado"
            type="email"
            placeholder="colaborador@clinica.com"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>
        <div className="w-36">
          <Select
            label="Papel"
            options={ROLE_OPTIONS}
            error={errors.role?.message}
            {...register('role')}
          />
        </div>
        <Button type="submit" loading={isSubmitting} className="shrink-0 mb-[1px]">
          <Send size={14} />
          Gerar link
        </Button>
      </form>

      {invite.error && (
        <p className="mt-2 text-sm text-red-500">Erro ao gerar convite. Tente novamente.</p>
      )}

      {/* Instruções */}
      <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700">
        <p className="font-semibold mb-1 flex items-center gap-1.5"><Link size={12} /> Como funciona</p>
        <ol className="list-decimal ml-4 space-y-0.5">
          <li>Gere o link de convite acima</li>
          <li>Copie e envie para a pessoa por WhatsApp ou e-mail</li>
          <li>Ela abre o link, cria a conta e é adicionada ao sistema automaticamente</li>
          <li>Links expiram em 7 dias</li>
        </ol>
      </div>

      {/* Convites pendentes */}
      {pendingInvites.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Pendentes ({pendingInvites.length})
          </p>
          <div className="flex flex-col gap-2">
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800 truncate">{inv.email}</span>
                    <RoleBadge role={inv.role} />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Expira em {formatDate(inv.expiresAt)}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyLink(inv.token, inv.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-2.5 py-1.5 transition-colors"
                    title="Copiar link"
                  >
                    {copiedId === inv.id ? (
                      <><Check size={12} /> Copiado!</>
                    ) : (
                      <><Copy size={12} /> Copiar link</>
                    )}
                  </button>
                  <button
                    onClick={() => revoke.mutate(inv.id)}
                    className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg px-2 py-1.5 transition-colors"
                    title="Revogar convite"
                  >
                    Revogar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Convites aceitos */}
      {acceptedInvites.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Aceitos ({acceptedInvites.length})
          </p>
          <div className="flex flex-col gap-1">
            {acceptedInvites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
                <Check size={12} className="text-green-500 shrink-0" />
                <span className="font-medium">{inv.email}</span>
                <RoleBadge role={inv.role} />
                <span className="ml-auto text-slate-400">
                  aceito em {formatDate(inv.acceptedAt!)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
