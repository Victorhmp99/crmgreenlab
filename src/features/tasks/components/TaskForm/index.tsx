import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, User, FileText, Search, UserCircle, Phone, Mail, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { useAuthStore } from '@/store/authStore'
import { useTaskMutations } from '../../hooks/useTasks'
import { fetchTenantUsers } from '@/services/users'
import { supabase } from '@/lib/supabase'
import { formatPhone } from '@/lib/utils'
import type { LeadTaskWithMeta } from '@/services/leadTasks'

interface TaskFormProps {
  open:         boolean
  onClose:      () => void
  task?:        LeadTaskWithMeta | null
  presetLeadId?: string | null
}

interface LeadOption {
  id:    string
  name:  string
  company_name: string | null
  phone: string | null
  email: string | null
  status: string
}

export function TaskForm({ open, onClose, task = null, presetLeadId = null }: TaskFormProps) {
  const tenantId      = useAuthStore((s) => s.tenant?.id)
  const currentRole   = useAuthStore((s) => s.membership?.role)
  const isSuperAdmin  = useAuthStore((s) => s.isSuperAdmin)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const canAssignAnyone = currentRole === 'admin' || currentRole === 'manager' || isSuperAdmin

  // ID do lead efetivamente vinculado (preset, ou da tarefa em edição, ou escolhido pelo usuário)
  const initialLeadId = presetLeadId ?? task?.lead_id ?? null
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialLeadId)
  const { create, update } = useTaskMutations(selectedLeadId)

  // Lead search/picker
  const [leadSearch, setLeadSearch]   = useState('')
  const [leads,      setLeads]        = useState<LeadOption[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)

  // Carrega leads do tenant ao abrir (somente se não tem preset/edit)
  useEffect(() => {
    if (!open || !tenantId) return
    if (presetLeadId) return // preset não precisa carregar lista
    setLoadingLeads(true)
    Promise.resolve(
      supabase.from('leads')
        .select('id, name, company_name, phone, email, status')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'converted'])
        .order('name'),
    )
      .then(({ data }) => { setLeads((data ?? []) as LeadOption[]) })
      .finally(() => setLoadingLeads(false))
  }, [open, tenantId, presetLeadId])

  // Carrega detalhes do lead selecionado (pra mostrar bloco com info completa)
  const { data: selectedLead = null } = useQuery<LeadOption | null>({
    queryKey: ['lead-info', selectedLeadId],
    queryFn:  async () => {
      if (!selectedLeadId) return null
      // Tenta achar na lista cacheada
      const fromCache = leads.find((l) => l.id === selectedLeadId)
      if (fromCache) return fromCache
      const { data } = await supabase.from('leads')
        .select('id, name, company_name, phone, email, status')
        .eq('id', selectedLeadId).maybeSingle()
      return data as LeadOption | null
    },
    enabled:  !!selectedLeadId && open,
    staleTime: 1000 * 60,
  })

  // Usuários do tenant pra responsável
  const { data: users = [] } = useQuery({
    queryKey:  ['tenant-users', tenantId],
    queryFn:   () => fetchTenantUsers(tenantId!),
    enabled:   !!tenantId && open,
    staleTime: 1000 * 60,
  })

  // Form fields
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [dueDate,     setDueDate]     = useState('')
  const [dueTime,     setDueTime]     = useState('09:00')
  const [assignedTo,  setAssignedTo]  = useState<string>('')
  const [error,       setError]       = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (task) {
      setTitle(task.title)
      setDescription(task.description ?? '')
      const d = new Date(task.due_at)
      setDueDate(d.toISOString().slice(0, 10))
      setDueTime(d.toTimeString().slice(0, 5))
      setAssignedTo(task.assigned_to ?? '')
      setSelectedLeadId(task.lead_id ?? null)
    } else {
      setTitle('')
      setDescription('')
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
      setDueDate(tomorrow.toISOString().slice(0, 10))
      setDueTime('09:00')
      setAssignedTo(canAssignAnyone ? '' : (currentUserId ?? ''))
      setSelectedLeadId(presetLeadId ?? null)
      setLeadSearch('')
    }
    setError(null)
  }, [open, task, canAssignAnyone, currentUserId, presetLeadId])

  async function handleSave() {
    setError(null)
    if (!title.trim()) { setError('Título obrigatório'); return }
    if (!dueDate)      { setError('Data obrigatória'); return }

    const due_at = new Date(`${dueDate}T${dueTime}:00`).toISOString()
    const payload = {
      title,
      description: description.trim() || null,
      due_at,
      assigned_to: assignedTo || null,
    }

    try {
      if (task) {
        await update.mutateAsync({ id: task.id, data: payload })
      } else {
        await create.mutateAsync({ ...payload, lead_id: selectedLeadId })
      }
      onClose()
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao salvar')
    }
  }

  const userOptions = [
    { value: '', label: '— Sem responsável —' },
    ...users.filter((u) => u.active).map((u) => ({
      value: u.userId,
      label: `${u.fullName ?? u.email}${u.userId === currentUserId ? ' (eu)' : ''}`,
    })),
  ]

  const filteredLeads = leadSearch
    ? leads.filter((l) =>
        l.name.toLowerCase().includes(leadSearch.toLowerCase())
        || (l.company_name ?? '').toLowerCase().includes(leadSearch.toLowerCase())
        || (l.phone ?? '').includes(leadSearch)
        || (l.email ?? '').toLowerCase().includes(leadSearch.toLowerCase()),
      )
    : leads

  // Pra modo edição: não permite trocar de lead. Pra criação: pode escolher.
  const canChooseLead = !task && !presetLeadId

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Detalhes da Tarefa' : 'Nova Tarefa'}
      description={task ? 'Edite os dados ou marque como concluída' : 'Vincule a um lead para acompanhar'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} loading={create.isPending || update.isPending}>
            {task ? 'Salvar alterações' : 'Criar tarefa'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        {/* Bloco do lead vinculado (sempre que tem) */}
        {selectedLead && (
          <div className="rounded-xl p-3 flex flex-col gap-2"
            style={{ background: 'rgba(64,160,255,0.08)', border: '1px solid rgba(64,160,255,0.25)' }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <UserCircle size={16} className="shrink-0" style={{ color: '#40a0ff' }} />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold truncate block" style={{ color: '#e8e8e8' }}>
                    {selectedLead.name}
                  </span>
                  {selectedLead.company_name && (
                    <span className="text-[11px] truncate block" style={{ color: '#888' }}>
                      {selectedLead.company_name}
                    </span>
                  )}
                </div>
                <span className="text-[10px] uppercase rounded-full px-1.5 py-0.5 shrink-0"
                  style={{ background: '#1a1a1a', color: '#666' }}>
                  {selectedLead.status === 'converted' ? 'Convertido' : 'Ativo'}
                </span>
              </div>
              {canChooseLead && (
                <button onClick={() => setSelectedLeadId(null)} title="Remover vínculo"
                  className="h-6 w-6 rounded flex items-center justify-center"
                  style={{ color: '#666' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ff4444'; e.currentTarget.style.background = 'rgba(255,68,68,0.1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; e.currentTarget.style.background = 'transparent' }}>
                  <X size={11} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pl-6">
              {selectedLead.phone && (
                <>
                  <a href={`tel:${selectedLead.phone}`} className="inline-flex items-center gap-1 text-xs"
                    style={{ color: '#aaa' }}>
                    <Phone size={11} /> {formatPhone(selectedLead.phone)}
                  </a>
                  <a href={`https://wa.me/55${selectedLead.phone.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium"
                    style={{ color: '#00e676' }}>
                    <span>●</span> WhatsApp
                  </a>
                </>
              )}
              {selectedLead.email && (
                <a href={`mailto:${selectedLead.email}`} className="inline-flex items-center gap-1 text-xs truncate"
                  style={{ color: '#aaa' }}>
                  <Mail size={11} /> {selectedLead.email}
                </a>
              )}
              {!selectedLead.phone && !selectedLead.email && (
                <span className="text-[11px]" style={{ color: '#666' }}>Sem telefone ou e-mail cadastrado</span>
              )}
            </div>
          </div>
        )}

        {/* Picker de lead (só quando criando sem preset) */}
        {canChooseLead && !selectedLead && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5" style={{ color: '#888' }}>
              <UserCircle size={11} /> Vincular a um lead (opcional)
            </label>
            <div className="rounded-lg flex items-center gap-2 px-3 py-2"
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <Search size={13} style={{ color: '#555' }} />
              <input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)}
                placeholder="Buscar por nome, telefone ou e-mail..."
                className="flex-1 bg-transparent text-sm focus:outline-none"
                style={{ color: '#e8e8e8' }}
              />
            </div>

            <div className="rounded-lg max-h-44 overflow-y-auto"
              style={{ background: '#0f0f0f', border: '1px solid #1e1e1e' }}>
              {loadingLeads ? (
                <p className="py-6 text-center text-xs" style={{ color: '#555' }}>Carregando leads...</p>
              ) : filteredLeads.length === 0 ? (
                <p className="py-6 text-center text-xs" style={{ color: '#555' }}>
                  {leadSearch ? 'Nenhum lead encontrado' : 'Nenhum lead cadastrado'}
                </p>
              ) : (
                filteredLeads.slice(0, 30).map((l) => (
                  <button key={l.id} type="button" onClick={() => setSelectedLeadId(l.id)}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors"
                    style={{ borderBottom: '1px solid #161616' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}>
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: '#1e1e1e', color: '#888' }}>
                      {l.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: '#e8e8e8' }}>{l.name}</p>
                      {l.company_name && (
                        <p className="text-[11px] truncate" style={{ color: '#888' }}>{l.company_name}</p>
                      )}
                      <p className="text-[11px] truncate" style={{ color: '#666' }}>
                        {l.phone ? formatPhone(l.phone) : ''}{l.phone && l.email ? ' · ' : ''}{l.email ?? ''}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
            {filteredLeads.length > 30 && (
              <p className="text-[10px]" style={{ color: '#555' }}>
                Mostrando 30 de {filteredLeads.length}. Refine a busca pra encontrar mais.
              </p>
            )}
          </div>
        )}

        {/* Campos da tarefa */}
        <Input
          label="Título *"
          placeholder="Ex: Ligar para o lead, Enviar proposta..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5" style={{ color: '#888' }}>
            <FileText size={11} /> Descrição (opcional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Detalhes da tarefa..."
            className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
            onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--tenant-primary)')}
            onBlur={(e)  => (e.currentTarget.style.border = '1px solid #2a2a2a')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5" style={{ color: '#888' }}>
              <Calendar size={11} /> Data *
            </label>
            <DatePicker value={dueDate} onChange={(v) => v && setDueDate(v)} clearable={false}
              placeholder="Selecionar" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>Horário *</label>
            <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5" style={{ color: '#888' }}>
            <User size={11} /> Responsável
            {!canAssignAnyone && <span className="normal-case" style={{ color: '#666' }}>(só admin/gestor atribui a outros)</span>}
          </label>
          {canAssignAnyone ? (
            <Select value={assignedTo} options={userOptions}
              onChange={(e) => setAssignedTo(e.target.value)} />
          ) : (
            <Input value={users.find((u) => u.userId === currentUserId)?.fullName ?? 'Você'} disabled />
          )}
        </div>

        {/* Metadados quando editando */}
        {task && (
          <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px]"
            style={{ color: '#555', borderTop: '1px solid #1a1a1a' }}>
            {task.creator_name && (
              <span>Criada por <strong style={{ color: '#888' }}>{task.creator_name}</strong></span>
            )}
            <span>Criada em <strong style={{ color: '#888' }}>{new Date(task.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong></span>
            {task.completed && task.completed_at && (
              <span style={{ color: '#00e676' }}>✓ Concluída em {new Date(task.completed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
