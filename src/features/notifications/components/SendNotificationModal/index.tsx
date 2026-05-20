import { useState, useEffect } from 'react'
import { Send, Search, Users, User as UserIcon, CheckSquare, Square } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNotificationMutations } from '../../hooks/useNotifications'
import { supabase } from '@/lib/supabase'

interface SendNotificationModalProps {
  open:    boolean
  onClose: () => void
}

interface UserLite {
  user_id:    string
  email:      string
  full_name:  string | null
  tenant_id:  string
  tenant_name: string
  role:       string
}

type Audience = 'all' | 'select'

export function SendNotificationModal({ open, onClose }: SendNotificationModalProps) {
  const { send, broadcast } = useNotificationMutations()

  const [audience, setAudience] = useState<Audience>('all')
  const [title,    setTitle]    = useState('')
  const [body,     setBody]     = useState('')
  const [link,     setLink]     = useState('')
  const [users,    setUsers]    = useState<UserLite[]>([])
  const [search,   setSearch]   = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [result, setResult] = useState<{ count: number } | null>(null)
  const [error,  setError]  = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setAudience('all'); setTitle(''); setBody(''); setLink('')
      setSelectedIds(new Set()); setSearch(''); setResult(null); setError(null)
      return
    }
    setLoadingUsers(true)
    Promise.resolve(supabase.rpc('get_platform_users'))
      .then(({ data }) => {
        const list = ((data ?? []) as Array<UserLite & { account_status: string }>)
          .filter((u) => u.account_status !== 'blocked')
        setUsers(list)
      })
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false))
  }, [open])

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleSend() {
    setError(null); setResult(null)
    if (!title.trim() || !body.trim()) { setError('Título e mensagem obrigatórios'); return }
    if (audience === 'select' && selectedIds.size === 0) { setError('Selecione pelo menos 1 usuário'); return }

    try {
      const count = audience === 'all'
        ? await broadcast.mutateAsync({ title: title.trim(), body: body.trim(), link: link.trim() || null })
        : await send.mutateAsync({
            recipientIds: Array.from(selectedIds),
            title: title.trim(), body: body.trim(), link: link.trim() || null,
          })
      setResult({ count })
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao enviar')
    }
  }

  const q = search.toLowerCase()
  const filtered = q
    ? users.filter((u) =>
        (u.full_name ?? '').toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q)
        || u.tenant_name.toLowerCase().includes(q),
      )
    : users

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enviar notificação"
      description="Envie um aviso pros usuários da plataforma"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={send.isPending || broadcast.isPending}>
            {result ? 'Fechar' : 'Cancelar'}
          </Button>
          {!result && (
            <Button onClick={handleSend} loading={send.isPending || broadcast.isPending}>
              <Send size={13} /> Enviar
            </Button>
          )}
        </>
      }
    >
      {result ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="h-14 w-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)' }}>
            <Send size={22} style={{ color: '#00e676' }} />
          </div>
          <p className="text-sm" style={{ color: '#e8e8e8' }}>
            Notificação enviada para <strong>{result.count}</strong> usuário{result.count !== 1 ? 's' : ''}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Audiência */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>Destinatários</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setAudience('all')} type="button"
                className="rounded-lg px-3 py-2 text-left transition-all"
                style={{
                  background: audience === 'all' ? 'rgba(0,230,118,0.08)' : '#1a1a1a',
                  border: audience === 'all' ? '1px solid rgba(0,230,118,0.4)' : '1px solid #2a2a2a',
                }}>
                <div className="flex items-center gap-2">
                  <Users size={14} style={{ color: audience === 'all' ? '#00e676' : '#666' }} />
                  <span className="text-sm font-medium" style={{ color: '#e8e8e8' }}>Todos</span>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: '#666' }}>Broadcast pra plataforma inteira</p>
              </button>
              <button onClick={() => setAudience('select')} type="button"
                className="rounded-lg px-3 py-2 text-left transition-all"
                style={{
                  background: audience === 'select' ? 'rgba(0,230,118,0.08)' : '#1a1a1a',
                  border: audience === 'select' ? '1px solid rgba(0,230,118,0.4)' : '1px solid #2a2a2a',
                }}>
                <div className="flex items-center gap-2">
                  <UserIcon size={14} style={{ color: audience === 'select' ? '#00e676' : '#666' }} />
                  <span className="text-sm font-medium" style={{ color: '#e8e8e8' }}>Selecionar</span>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: '#666' }}>Escolher usuários específicos</p>
              </button>
            </div>
          </div>

          {/* Lista de usuários quando "Selecionar" */}
          {audience === 'select' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs" style={{ color: '#888' }}>
                  {selectedIds.size} de {users.length} selecionados
                </label>
                {selectedIds.size > 0 && (
                  <button onClick={() => setSelectedIds(new Set())}
                    className="text-xs underline" style={{ color: '#666' }}>
                    Limpar
                  </button>
                )}
              </div>
              <div className="rounded-lg flex items-center gap-2 px-3 py-2"
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                <Search size={13} style={{ color: '#555' }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, e-mail ou empresa..."
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                  style={{ color: '#e8e8e8' }} />
              </div>
              <div className="rounded-lg max-h-44 overflow-y-auto"
                style={{ background: '#0f0f0f', border: '1px solid #1e1e1e' }}>
                {loadingUsers ? (
                  <p className="py-6 text-center text-xs" style={{ color: '#555' }}>Carregando usuários...</p>
                ) : filtered.length === 0 ? (
                  <p className="py-6 text-center text-xs" style={{ color: '#555' }}>Nenhum usuário</p>
                ) : (
                  filtered.slice(0, 50).map((u) => {
                    const selected = selectedIds.has(u.user_id)
                    return (
                      <button key={u.user_id} type="button" onClick={() => toggle(u.user_id)}
                        className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors"
                        style={{
                          borderBottom: '1px solid #161616',
                          background: selected ? 'rgba(0,230,118,0.06)' : 'transparent',
                        }}>
                        {selected ? <CheckSquare size={13} style={{ color: '#00e676' }} /> : <Square size={13} style={{ color: '#444' }} />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ color: '#e8e8e8' }}>
                            {u.full_name ?? u.email}
                          </p>
                          <p className="text-[10px] truncate" style={{ color: '#666' }}>
                            {u.email} · {u.tenant_name}
                          </p>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Conteúdo da mensagem */}
          <Input label="Título *" placeholder="Ex: Manutenção programada"
            value={title} onChange={(e) => setTitle(e.target.value)} />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
              Mensagem *
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Detalhes do aviso..."
              className="rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
              onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--tenant-primary)')}
              onBlur={(e)  => (e.currentTarget.style.border = '1px solid #2a2a2a')}
            />
          </div>

          <Input label="Link (opcional)" placeholder="https://..." type="url"
            value={link} onChange={(e) => setLink(e.target.value)} />

          {error && (
            <p className="text-sm rounded-lg px-3 py-2"
              style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>{error}</p>
          )}
        </div>
      )}
    </Modal>
  )
}
