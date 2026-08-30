import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PhoneCall, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { RESULTADOS, rotuloDoResultado, type ResultadoLigacao } from './resultados'

/**
 * Registro de ligação em um toque.
 *
 * O formulário de atividade já existia e permitia registrar ligação desde
 * sempre — e em 90 dias, com 1.109 leads, não houve UM registro. O recurso
 * não faltava: faltava ser rápido. Abrir modal, escolher o lead de novo e
 * digitar uma descrição é atrito demais pra quem acabou de desligar o
 * telefone e já vai ligar pro próximo.
 *
 * Aqui é um clique e acabou. E o resultado é ESTRUTURADO, não texto livre:
 * sem isso não dá pra calcular taxa de atendimento, que é o número que a
 * operação inteira precisa e hoje ninguém tem.
 */

export function RegistroRapidoLigacao({ leadId }: { leadId: string }) {
  const queryClient = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const user     = useAuthStore((s) => s.user)
  const [registrado, setRegistrado] = useState<ResultadoLigacao | null>(null)

  const registrar = useMutation({
    mutationFn: async (resultado: ResultadoLigacao) => {
      const { error } = await supabase.from('lead_activities').insert({
        tenant_id:   tenantId,
        lead_id:     leadId,
        user_id:     user?.id ?? null,
        type:        'call',
        description: `Ligação — ${rotuloDoResultado(resultado)}`,
        // O resultado vai em metadata (jsonb) e não numa coluna nova: o campo
        // já existe e aceita qualquer chave, então dá pra medir hoje sem
        // esperar migração. Quando a telefonia entrar, ela grava aqui também.
        metadata: {
          user_email: user?.email ?? null,
          resultado,
          origem: 'manual',
        },
      })
      if (error) throw error
      return resultado
    },
    onSuccess: (resultado) => {
      setRegistrado(resultado)
      queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] })
      queryClient.invalidateQueries({ queryKey: ['funnel-metrics', tenantId] })
      // Some depois de um tempo pra dar pra registrar outra tentativa no
      // mesmo lead — ligar de novo mais tarde é o normal, não a exceção.
      setTimeout(() => setRegistrado(null), 4000)
    },
  })

  if (registrado) {
    return (
      <div className="flex items-center gap-1.5 text-xs" style={{ color: '#00e676' }}>
        <Check size={13} /> {rotuloDoResultado(registrado)} — registrado
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="flex items-center gap-1 text-[11px] mr-0.5" style={{ color: '#555' }}>
        <PhoneCall size={11} /> Ligou? Registre:
      </span>
      {RESULTADOS.map((r) => (
        <button
          key={r.valor}
          onClick={() => registrar.mutate(r.valor)}
          disabled={registrar.isPending}
          className="text-[11px] rounded-full px-2 py-0.5 transition-colors disabled:opacity-40"
          style={{ background: '#1a1a1a', border: '1px solid #262626', color: r.cor }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#222')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#1a1a1a')}
        >
          {r.rotulo}
        </button>
      ))}
    </div>
  )
}
