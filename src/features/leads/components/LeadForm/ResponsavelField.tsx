import { useQuery } from '@tanstack/react-query'
import { UserCheck } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuthStore } from '@/store/authStore'
import { useUsers } from '@/features/users/hooks/useUsers'
import { supabase } from '@/lib/supabase'

/**
 * Quem é o responsável pelo lead.
 *
 * O campo `assigned_to` alimentava relatório de vendas e conversão individual
 * desde sempre, mas não havia tela pra preencher — por isso tanto lead sem
 * dono. Este é o campo que faltava.
 *
 * O que cada um pode está no banco (migration 074), não aqui: gestor e admin
 * distribuem pra qualquer pessoa da empresa; vendedor só assume pra si, e só
 * lead que está sem dono. Esta tela apenas evita oferecer o que seria
 * recusado — se alguém contornar a tela, o gatilho recusa igual.
 */
export function ResponsavelField({ valor, onChange, ehLeadNovo }: {
  valor:      string | null
  onChange:   (novo: string | null) => void
  ehLeadNovo: boolean
}) {
  const { isManager } = usePermissions()
  const eu = useAuthStore((s) => s.user?.id) ?? null
  // Cargo dentro da empresa, nao a condicao de super admin da plataforma —
  // e a mesma regra de `get_tenant_users`, que alimenta a lista abaixo.
  const podeDistribuir = isManager

  // `get_tenant_users` é restrita a gestor/admin: pedir a lista sendo vendedor
  // devolveria "Unauthorized" e sujaria o console sem motivo.
  const { data: usuarios = [] } = useUsers({ enabled: podeDistribuir })

  // Vendedor não consegue listar a equipe, mas consegue ler o perfil de quem
  // é da mesma empresa — é o bastante pra mostrar de quem é o lead em vez de
  // um "outro usuário" que não ajuda ninguém.
  const { data: donoAtual } = useQuery({
    queryKey: ['perfil-responsavel', valor],
    enabled:  !podeDistribuir && !!valor && valor !== eu,
    queryFn:  async () => {
      const { data } = await supabase
        .from('profiles').select('full_name, email').eq('id', valor!).maybeSingle()
      return (data?.full_name || data?.email) ?? null
    },
  })

  if (podeDistribuir) {
    return (
      <div className="flex flex-col gap-1.5">
        <Select
          label="Responsável"
          value={valor ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          options={[
            { value: '', label: 'Sem responsável' },
            ...usuarios
              .filter((u) => u.active)
              .map((u) => ({
                value: u.userId,
                label: `${u.fullName ?? u.email}${u.userId === eu ? ' (você)' : ''}`,
              })),
          ]}
        />
        <span className="text-[11px]" style={{ color: '#555' }}>
          Quem fica com este lead no relatório de vendas e na conversão.
        </span>
      </div>
    )
  }

  // ── Vendedor ────────────────────────────────────────────────────────────
  const texto = ehLeadNovo || valor === eu
    ? 'Você'
    : (donoAtual ?? 'outra pessoa da equipe')

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
        Responsável
      </label>
      <div className="flex items-center justify-between gap-3 rounded-lg px-3 h-10"
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
        <span className="text-sm truncate" style={{ color: valor || ehLeadNovo ? '#e8e8e8' : '#666' }}>
          {valor || ehLeadNovo ? texto : 'Sem responsável'}
        </span>
        {!ehLeadNovo && !valor && (
          <button type="button" onClick={() => onChange(eu)}
            className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1 shrink-0 transition-colors"
            style={{ background: 'rgba(0,230,118,0.12)', color: '#00e676' }}>
            <UserCheck size={12} /> Assumir
          </button>
        )}
      </div>
      <span className="text-[11px]" style={{ color: '#555' }}>
        {valor && valor !== eu
          ? 'Só o gestor pode transferir um lead que já tem responsável.'
          : 'Fechar a venda no quadro também põe o lead no seu nome.'}
      </span>
    </div>
  )
}
