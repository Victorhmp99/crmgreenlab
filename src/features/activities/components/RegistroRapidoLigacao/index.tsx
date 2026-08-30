import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PhoneCall, Check, Phone, Loader2, Settings2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { RESULTADOS, rotuloDoResultado, type ResultadoLigacao } from './resultados'
import { discar } from '@/services/telefonia'
import { useTelefoniaAtiva } from '@/features/settings/hooks/useTelefonia'

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

export function RegistroRapidoLigacao({ leadId, telefone }: { leadId: string; telefone?: string | null }) {
  const queryClient = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const user     = useAuthStore((s) => s.user)
  const [registrado, setRegistrado] = useState<ResultadoLigacao | null>(null)
  const [erroDiscar, setErroDiscar]  = useState<string | null>(null)
  const telefoniaAtiva = useTelefoniaAtiva()
  const { isAdmin, isSuperAdmin } = usePermissions()

  // Com telefonia ligada, o resultado chega sozinho pelo webhook — os botões
  // manuais viram reserva, pra quem ligou pelo celular fora do sistema.
  const ligar = useMutation({
    mutationFn: async () => {
      const r = await discar(tenantId!, leadId, telefone ?? '')
      if (!r.ok) throw new Error(r.erro ?? 'Falha ao iniciar a ligação')
      return r
    },
    onSuccess: () => setErroDiscar(null),
    onError:   (e: Error) => setErroDiscar(e.message),
  })

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
    <div className="flex flex-col gap-1.5">
      {/* Sem telefonia, o lugar do botão não fica vazio: explica o que
          existiria ali e leva pra configuração. Recurso que não se anuncia é
          recurso que ninguém liga. */}
      {!telefoniaAtiva && telefone && (
        <div className="rounded-lg px-2.5 py-2 text-[11px] leading-relaxed"
          style={{ background: '#171717', border: '1px solid #222', color: '#777' }}>
          <p className="flex items-start gap-1.5">
            <Phone size={11} className="shrink-0 mt-0.5" />
            <span>
              Dá pra <strong style={{ color: '#aaa' }}>ligar daqui</strong>, com a chamada saindo
              pelo número da empresa e a gravação voltando sozinha pro histórico do lead.
              Precisa conectar a telefonia primeiro.
            </span>
          </p>
          {(isAdmin || isSuperAdmin) ? (
            <Link to="/settings"
              className="inline-flex items-center gap-1 mt-1.5 rounded-lg px-2 py-1 transition-colors"
              style={{ background: 'rgba(0,230,118,0.1)', color: '#00e676' }}>
              <Settings2 size={11} /> Configurar telefonia
            </Link>
          ) : (
            <p className="mt-1" style={{ color: '#555' }}>
              Peça ao administrador da empresa para ativar.
            </p>
          )}
        </div>
      )}

      {telefoniaAtiva && telefone && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => ligar.mutate()}
            disabled={ligar.isPending}
            className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
            style={{ background: 'rgba(0,230,118,0.12)', color: '#00e676' }}
          >
            {ligar.isPending
              ? <><Loader2 size={12} className="animate-spin" /> Chamando seu ramal…</>
              : <><Phone size={12} /> Ligar</>}
          </button>
          {ligar.isSuccess && !ligar.isPending && (
            <span className="text-[11px]" style={{ color: '#666' }}>
              Atenda no seu ramal — a ligação sai depois disso
            </span>
          )}
        </div>
      )}

      {erroDiscar && (
        <p className="text-[11px]" style={{ color: '#ff6666' }}>{erroDiscar}</p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
      <span className="flex items-center gap-1 text-[11px] mr-0.5" style={{ color: '#555' }}>
        <PhoneCall size={11} /> {telefoniaAtiva ? 'Ligou por fora? Registre:' : 'Ligou? Registre:'}
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
    </div>
  )
}
