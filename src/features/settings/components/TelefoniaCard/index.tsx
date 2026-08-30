import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PhoneCall, Copy, Check, Info, ExternalLink, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/authStore'
import { useTelefoniaConfig } from '../../hooks/useTelefonia'
import { salvarTelefoniaConfig, desligarTelefonia, salvarRamal } from '@/services/telefonia'
import { useUsers } from '@/features/users/hooks/useUsers'

/**
 * Telefonia: liga o CRM ao provedor de voz.
 *
 * Dois lados que precisam casar e são fáceis de esquecer:
 *  - o token, que o CRM usa pra disparar a chamada;
 *  - a URL de retorno, que o provedor usa pra devolver o resultado.
 *
 * Sem a segunda, tudo parece funcionar — a ligação sai — e nada é registrado.
 * Por isso ela fica em destaque e com botão de copiar, não escondida numa
 * documentação.
 */
export function TelefoniaCard() {
  const queryClient = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const { data: config } = useTelefoniaConfig()
  const { data: usuarios = [] } = useUsers()

  const [token,   setToken]   = useState('')
  const [copiado, setCopiado] = useState(false)
  const [erro,    setErro]    = useState<string | null>(null)
  // Abre sozinho pra quem ainda não configurou — é quem precisa ler.
  const [verPasso, setVerPasso] = useState(false)

  const ligado = !!(config?.hasToken && config.ativo)

  // Quem ainda não ligou é exatamente quem precisa do passo a passo, então
  // ele começa aberto até a configuração existir. Depois fica recolhido.
  const [passoSincronizado, setPassoSincronizado] = useState<boolean | null>(null)
  if (config !== undefined && passoSincronizado !== ligado) {
    setPassoSincronizado(ligado)
    setVerPasso(!ligado)
  }

  const urlWebhook = config?.webhookSecret
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telefonia-webhook?s=${config.webhookSecret}`
    : null

  const salvar = useMutation({
    mutationFn: () => salvarTelefoniaConfig(tenantId!, token),
    onSuccess: () => {
      setToken(''); setErro(null)
      queryClient.invalidateQueries({ queryKey: ['telefonia-config', tenantId] })
    },
    onError: (e: Error) => setErro(e.message),
  })

  const desligar = useMutation({
    mutationFn: () => desligarTelefonia(tenantId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['telefonia-config', tenantId] }),
  })

  const gravarRamal = useMutation({
    mutationFn: ({ id, ramal }: { id: string; ramal: string }) => salvarRamal(id, ramal),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  function handleSalvar(e: FormEvent) {
    e.preventDefault()
    if (!config?.hasToken && !token.trim()) return setErro('Informe o token do provedor.')
    salvar.mutate()
  }

  async function copiar() {
    if (!urlWebhook) return
    await navigator.clipboard.writeText(urlWebhook)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <section className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="flex items-center gap-2">
        <PhoneCall size={15} style={{ color: ligado ? '#00e676' : '#555' }} />
        <h3 className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>
          Telefonia <span style={{ color: '#666' }}>(API4COM)</span>
        </h3>
        {ligado && (
          <span className="text-[10px] rounded-full px-2 py-0.5"
            style={{ background: 'rgba(0,230,118,0.12)', color: '#00e676' }}>ligada</span>
        )}
      </div>

      <p className="text-xs" style={{ color: '#666' }}>
        Liga direto do card do lead. A gravação e o resultado voltam sozinhos, sem ninguém
        precisar anotar nada.
      </p>

      {/* Recolhido por padrão: instrução longa aberta o tempo todo empurra
          pra baixo justamente os campos que a pessoa veio preencher. Quem já
          sabe cola o token direto; quem não sabe abre. */}
      <div className="rounded-xl text-xs overflow-hidden"
        style={{ background: 'rgba(64,160,255,0.08)', border: '1px solid rgba(64,160,255,0.15)' }}>
        <button type="button" onClick={() => setVerPasso((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 transition-colors"
          style={{ color: '#40a0ff' }}>
          <span className="font-semibold flex items-center gap-1.5">
            <ExternalLink size={12} /> Como ligar (leva ~10 minutos)
          </span>
          <ChevronDown size={14}
            style={{ transform: verPasso ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>

        {verPasso && (
        <div className="px-4 pb-3">
          <ol className="list-decimal ml-4 space-y-1" style={{ color: '#7bb8f0' }}>
            <li>
              Crie a conta em{' '}
              <a href="https://www.api4com.com" target="_blank" rel="noopener noreferrer"
                className="underline" style={{ color: '#40a0ff' }}>api4com.com</a>{' '}
              (tem teste grátis com crédito).
            </li>
            <li>
              No painel deles, aba <strong>Ramal</strong>: anote o número do ramal (ex: 1000).
              <br />
              <span style={{ color: '#5a93c4' }}>
                Cada vendedor precisa de um <strong>usuário</strong> na API4COM — o ramal nasce
                junto com ele, e é cobrado por usuário.
              </span>
            </li>
            <li>Gere o <strong>token de API</strong> no painel e cole no campo abaixo.</li>
            <li>
              Copie a URL que vai aparecer aqui e cole no painel deles, aba{' '}
              <strong>Webhook</strong>.
              <br />
              <span style={{ color: '#5a93c4' }}>
                Sem esse passo a ligação sai normalmente e <strong>nada é registrado</strong> —
                é a falha mais fácil de não perceber.
              </span>
            </li>
            <li>Preencha o ramal de cada pessoa na lista que aparece no fim deste bloco.</li>
            <li>
              Instale a <strong>extensão do webphone</strong> no Chrome e deixe conectada. É ela
              que toca quando alguém clica em Ligar.
            </li>
          </ol>
          <p className="mt-2" style={{ color: '#5a93c4' }}>
            <strong>Celular ou tablet:</strong> a extensão é só de Chrome no computador. Em
            iPad/iPhone/Android, use um aplicativo SIP (Zoiper, Linphone) com o domínio, o ramal
            e a senha que aparecem na aba Ramal — o app precisa ficar aberto pra receber a
            chamada.
          </p>
        </div>
        )}
      </div>

      <form onSubmit={handleSalvar} autoComplete="off" className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-56">
          <Input
            label={config?.hasToken ? 'Token do provedor (salvo — cole outro para trocar)' : 'Token do provedor *'}
            type="password"
            name="telefonia-token"
            autoComplete="new-password"
            placeholder={config?.hasToken ? '•••••••• já salvo' : 'cole o token da API4COM'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        <Button type="submit" loading={salvar.isPending}>
          {ligado ? 'Atualizar' : 'Ligar telefonia'}
        </Button>
        {ligado && (
          <button type="button" onClick={() => desligar.mutate()}
            className="text-sm h-10" style={{ color: '#ff4444' }}>
            Desligar
          </button>
        )}
      </form>

      {erro && (
        <p className="text-sm rounded-lg px-3 py-2"
          style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>{erro}</p>
      )}

      {/* Passo que quase todo mundo esquece: sem colar essa URL no provedor, a
          ligação acontece e o CRM nunca fica sabendo. */}
      {urlWebhook && (
        <div className="rounded-lg p-3 text-xs"
          style={{ background: 'rgba(64,160,255,0.06)', border: '1px solid rgba(64,160,255,0.2)' }}>
          <p className="flex items-start gap-2 mb-2" style={{ color: '#7ab3dd' }}>
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>
              Cole esta URL no provedor, na aba <strong>Webhook</strong>. Sem ela a ligação sai
              normalmente e <strong>nada é registrado</strong> no CRM.
            </span>
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded px-2 py-1.5 break-all text-[10px]"
              style={{ background: '#0d0d0d', color: '#888' }}>{urlWebhook}</code>
            <button type="button" onClick={copiar}
              className="shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px]"
              style={{ background: '#1a1a1a', color: copiado ? '#00e676' : '#888' }}>
              {copiado ? <><Check size={12} /> copiado</> : <><Copy size={12} /> copiar</>}
            </button>
          </div>
        </div>
      )}

      {/* Ramal por pessoa: sem ele o vendedor não consegue discar, e a mensagem
          de erro sozinha não diz onde resolver. */}
      {ligado && (
        <div style={{ borderTop: '1px solid #1e1e1e' }} className="pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#666' }}>
            Ramal de cada pessoa
          </p>
          <p className="text-[11px] mb-3" style={{ color: '#555' }}>
            Cada vendedor precisa do próprio ramal — é ele que toca quando alguém clica em Ligar,
            e é o que separa a gravação de cada um.
          </p>
          <div className="flex flex-col gap-1.5">
            {usuarios.map((u) => (
              <div key={u.membershipId} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{ border: '1px solid #1e1e1e' }}>
                <span className="flex-1 text-xs truncate" style={{ color: '#ccc' }}>
                  {u.fullName || u.email}
                </span>
                <input
                  defaultValue={(u as { ramal?: string }).ramal ?? ''}
                  placeholder="ramal"
                  onBlur={(e) => {
                    const novo = e.target.value.trim()
                    if (novo !== ((u as { ramal?: string }).ramal ?? '')) {
                      gravarRamal.mutate({ id: u.membershipId, ramal: novo })
                    }
                  }}
                  className="w-24 text-xs rounded-lg px-2 py-1 outline-none"
                  style={{ background: '#1a1a1a', border: '1px solid #262626', color: '#e8e8e8' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
