import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, Calendar as CalIcon, ChevronLeft, ChevronRight,
  CalendarDays, CalendarRange, List, Check, Pencil, Trash2, Eraser,
  AlertTriangle, User, Clock, Phone, Mail, UserCircle, Building2,
} from 'lucide-react'
import { formatPhone } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useTasks, useTaskMutations } from '../hooks/useTasks'
import { TaskForm } from '../components/TaskForm'
import type { LeadTaskWithMeta } from '@/services/leadTasks'
import type { TaskFilters } from '@/services/leadTasks'

type ViewMode = 'month' | 'week' | 'list'
type ScopeFilter = 'all' | 'me'

export function TasksPage() {
  const [searchParams] = useSearchParams()
  // Vindo do aviso "Tarefas atrasadas" (?atrasadas=1): abre focado nas atrasadas
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('atrasadas') === '1')

  const [viewMode,    setViewMode]    = useState<ViewMode>(overdueOnly ? 'list' : 'month')
  const [anchorDate,  setAnchorDate]  = useState<Date>(new Date())
  const [scope,       setScope]       = useState<ScopeFilter>('all')
  const [showForm,    setShowForm]    = useState(false)
  const [editing,     setEditing]     = useState<LeadTaskWithMeta | null>(null)
  const [viewing,     setViewing]     = useState<LeadTaskWithMeta | null>(null)

  const { update: updateTaskM, remove: removeTaskM, removeMany } = useTaskMutations()
  const confirm = useConfirm()

  // Calcula intervalo de filtragem do servidor com base na view
  const range = useMemo(() => {
    const start = new Date(anchorDate)
    const end   = new Date(anchorDate)
    if (viewMode === 'month') {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      end.setMonth(end.getMonth() + 1, 0)
      end.setHours(23, 59, 59, 999)
    } else if (viewMode === 'week') {
      const day = start.getDay()  // 0=domingo
      start.setDate(start.getDate() - day)
      start.setHours(0, 0, 0, 0)
      end.setTime(start.getTime() + 6 * 86400000)
      end.setHours(23, 59, 59, 999)
    } else {
      // list: pega o mês inteiro também
      start.setDate(1); start.setHours(0, 0, 0, 0)
      end.setMonth(end.getMonth() + 1, 0); end.setHours(23, 59, 59, 999)
    }
    return { from: start.toISOString(), to: end.toISOString(), startDate: start, endDate: end }
  }, [anchorDate, viewMode])

  // No modo "atrasadas" busca TODAS as vencidas (sem limitar ao período/mês),
  // pra a pessoa ver de fato as tarefas do aviso — inclusive de meses passados.
  const filters: TaskFilters = overdueOnly
    ? { status: 'overdue', assignedTo: scope === 'me' ? 'me' : 'all' }
    : { from: range.from, to: range.to, assignedTo: scope === 'me' ? 'me' : 'all' }
  const { data: tasks = [], isLoading } = useTasks(filters)

  const effectiveView: ViewMode = overdueOnly ? 'list' : viewMode

  function navigate(direction: -1 | 1) {
    setOverdueOnly(false)   // navegar por período sai do modo "só atrasadas"
    const next = new Date(anchorDate)
    if (viewMode === 'month') {
      // Fixa o dia em 1 ANTES de trocar o mês — sem isso, navegar a partir de um
      // dia 29/30/31 pode cair num mês sem esse dia (ex: 31 de março - 1 mês),
      // o JS "estoura" pra frente e a navegação parece travada ou pula errado.
      next.setDate(1)
      next.setMonth(next.getMonth() + direction)
    }
    else if (viewMode === 'week')  next.setDate(next.getDate() + 7 * direction)
    else                            next.setDate(next.getDate() + direction)
    setAnchorDate(next)
  }

  function goToday() {
    setOverdueOnly(false)
    setAnchorDate(new Date())
  }

  // Limpa só as tarefas concluídas do período/filtro atual em tela
  async function handleClearCompleted() {
    const ids = tasks.filter((t) => t.completed).map((t) => t.id)
    if (ids.length === 0) return
    const ok = await confirm({
      title: 'Limpar concluídas',
      message: `Apagar ${ids.length} tarefa${ids.length !== 1 ? 's' : ''} concluída${ids.length !== 1 ? 's' : ''} de "${periodLabel}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Apagar concluídas',
      danger: true,
    })
    if (ok) removeMany.mutate(ids)
  }

  // Limpa TODAS as tarefas do período/filtro atual (feitas ou não)
  async function handleClearAll() {
    if (tasks.length === 0) return
    const ok = await confirm({
      title: 'Limpar tudo',
      message: `Apagar TODAS as ${tasks.length} tarefas de "${periodLabel}", incluindo as pendentes? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Apagar tudo',
      danger: true,
    })
    if (ok) removeMany.mutate(tasks.map((t) => t.id))
  }

  const periodLabel = useMemo(() => {
    if (viewMode === 'month') return anchorDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    if (viewMode === 'week') {
      const start = range.startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      const end   = range.endDate.toLocaleDateString('pt-BR',   { day: '2-digit', month: 'short' })
      return `${start} – ${end}`
    }
    return anchorDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }, [anchorDate, viewMode, range])

  // Capitaliza só a 1ª letra ("julho de 2026" → "Julho de 2026")
  const periodLabelDisplay = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#555' }}>Tarefas</span>
            <h2 className="text-2xl font-bold leading-tight" style={{ color: overdueOnly ? '#ff5555' : 'var(--text)' }}>
              {overdueOnly ? 'Atrasadas' : periodLabelDisplay}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#555' }}>
              {tasks.length} tarefa{tasks.length !== 1 ? 's' : ''}{overdueOnly ? ' atrasada' + (tasks.length !== 1 ? 's' : '') : ' neste período'}
            </p>
          </div>

          {/* Navegação junto do período (padrão de calendário) — oculta no modo atrasadas */}
          {!overdueOnly && (
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} title="Anterior"
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ border: '1px solid #2a2a2a', color: '#888' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#ccc' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={goToday} title="Hoje"
              className="text-xs rounded-lg px-2.5 py-1.5 font-medium transition-colors"
              style={{ border: '1px solid #2a2a2a', color: '#aaa' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              Hoje
            </button>
            <button onClick={() => navigate(1)} title="Próximo"
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ border: '1px solid #2a2a2a', color: '#888' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#ccc' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' }}>
              <ChevronRight size={16} />
            </button>
          </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro escopo */}
          <div className="flex rounded-lg p-0.5" style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border-dim)' }}>
            {(['all', 'me'] as ScopeFilter[]).map((s) => (
              <button key={s} onClick={() => setScope(s)}
                className="text-xs px-2.5 py-1 rounded-md font-medium transition-all"
                style={scope === s
                  ? { background: 'var(--bg-surface)', color: 'var(--text)' }
                  : { color: '#666' }}>
                {s === 'all' ? 'Todos' : 'Minhas'}
              </button>
            ))}
          </div>

          {/* View mode */}
          <div className="flex rounded-lg p-0.5" style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border-dim)' }}>
            <ViewBtn active={effectiveView === 'month'} onClick={() => { setOverdueOnly(false); setViewMode('month') }} icon={<CalendarDays size={13} />} label="Mês" />
            <ViewBtn active={effectiveView === 'week'}  onClick={() => { setOverdueOnly(false); setViewMode('week') }}  icon={<CalendarRange size={13} />} label="Semana" />
            <ViewBtn active={effectiveView === 'list'}  onClick={() => { setOverdueOnly(false); setViewMode('list') }}  icon={<List size={13} />}          label="Lista" />
          </div>

          {/* Limpar */}
          <button onClick={handleClearCompleted} title="Apagar tarefas concluídas deste período"
            disabled={removeMany.isPending}
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
            style={{ border: '1px solid #2a2a2a', color: '#888' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#ccc' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' }}>
            <Eraser size={13} /> Limpar concluídas
          </button>
          <button onClick={handleClearAll} title="Apagar TODAS as tarefas deste período"
            disabled={removeMany.isPending}
            className="flex items-center justify-center h-8 w-8 rounded-lg transition-colors disabled:opacity-40"
            style={{ border: '1px solid rgba(255,68,68,0.25)', color: '#ff5555' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,68,68,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <Trash2 size={13} />
          </button>

          {/* Novo */}
          <button onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-black text-sm font-medium transition-colors"
            style={{ background: 'var(--tenant-primary)' }}>
            <Plus size={14} /> Nova tarefa
          </button>
        </div>
      </div>

      {/* Aviso do modo "só atrasadas" (veio da notificação) */}
      {overdueOnly && (
        <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
          style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)' }}>
          <span className="text-xs font-medium inline-flex items-center gap-1.5" style={{ color: '#ff6b6b' }}>
            <AlertTriangle size={13} /> Mostrando só as tarefas atrasadas
          </span>
          <button onClick={() => setOverdueOnly(false)}
            className="text-xs font-medium underline whitespace-nowrap" style={{ color: 'var(--tenant-primary)' }}>
            Ver agenda completa
          </button>
        </div>
      )}

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : effectiveView === 'month' ? (
        <MonthView tasks={tasks} anchorDate={anchorDate} onSelectTask={setViewing} />
      ) : effectiveView === 'week' ? (
        <WeekView tasks={tasks} startDate={range.startDate} onSelectTask={setViewing} />
      ) : (
        <ListView tasks={tasks} onSelectTask={(t) => { setEditing(t); setShowForm(true) }} />
      )}

      <TaskForm open={showForm} onClose={() => { setShowForm(false); setEditing(null) }} task={editing} />

      {/* Detalhe da tarefa (clique na agenda) */}
      {viewing && (
        <TaskDetailModal
          task={viewing}
          isToggling={updateTaskM.isPending}
          isDeleting={removeTaskM.isPending}
          onClose={() => setViewing(null)}
          onEdit={() => { const t = viewing; setViewing(null); setEditing(t); setShowForm(true) }}
          onToggleDone={() => updateTaskM.mutate(
            { id: viewing.id, data: { completed: !viewing.completed } },
            { onSuccess: () => setViewing(null) },
          )}
          onDelete={async () => {
            const ok = await confirm({
              title: 'Excluir tarefa',
              message: `Excluir a tarefa "${viewing.title}"?`,
              confirmLabel: 'Excluir',
              danger: true,
            })
            if (ok) removeTaskM.mutate(viewing.id, { onSuccess: () => setViewing(null) })
          }}
        />
      )}
    </div>
  )
}

// ── Mês ─────────────────────────────────────────────────────────────────────

function MonthView({ tasks, anchorDate, onSelectTask }: {
  tasks: LeadTaskWithMeta[]; anchorDate: Date; onSelectTask: (t: LeadTaskWithMeta) => void
}) {
  const year  = anchorDate.getFullYear()
  const month = anchorDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  // Indexa tarefas por dia
  const byDay = new Map<number, LeadTaskWithMeta[]>()
  for (const task of tasks) {
    const d = new Date(task.due_at)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day)!.push(task)
    }
  }

  const cells: Array<{ day?: number }> = []
  for (let i = 0; i < firstDay; i++) cells.push({})
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d })

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0f0f0f', border: '1px solid #1e1e1e' }}>
      <div className="grid grid-cols-7" style={{ borderBottom: '1px solid #1e1e1e' }}>
        {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((d) => (
          <div key={d} className="px-2 py-2 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: '#555', background: '#0a0a0a' }}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          const isToday = !!cell.day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === cell.day
          const dayTasks = cell.day ? (byDay.get(cell.day) ?? []) : []
          return (
            <div key={idx} className="min-h-[90px] p-1.5 flex flex-col gap-1"
              style={{ borderRight: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a' }}>
              {cell.day && (
                <span className="text-xs"
                  style={{ color: isToday ? '#00e676' : '#666', fontWeight: isToday ? 700 : 400 }}>
                  {cell.day}
                </span>
              )}
              {dayTasks.slice(0, 3).map((t) => {
                const time = new Date(t.due_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                const label = t.lead_name ? `${time} · ${t.title} (${t.lead_name})` : `${time} · ${t.title}`
                return (
                  <button key={t.id} onClick={() => onSelectTask(t)} title={label}
                    className="text-left text-[10px] rounded px-1.5 py-0.5 truncate transition-colors"
                    style={{
                      background: t.completed ? '#1a1a1a' : 'rgba(64,160,255,0.12)',
                      color:      t.completed ? '#555'    : '#40a0ff',
                      textDecoration: t.completed ? 'line-through' : undefined,
                    }}>
                    {label}
                  </button>
                )
              })}
              {dayTasks.length > 3 && (
                <span className="text-[10px]" style={{ color: '#666' }}>+ {dayTasks.length - 3} mais</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Semana ──────────────────────────────────────────────────────────────────

function WeekView({ tasks, startDate, onSelectTask }: {
  tasks: LeadTaskWithMeta[]; startDate: Date; onSelectTask: (t: LeadTaskWithMeta) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate); d.setDate(d.getDate() + i); return d
  })
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const byDay = days.map((d) => {
    const dayTasks = tasks.filter((t) => {
      const td = new Date(t.due_at)
      return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() && td.getDate() === d.getDate()
    }).sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
    return { date: d, tasks: dayTasks }
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
      {byDay.map(({ date, tasks: dayTasks }) => {
        const isToday = date.getTime() === today.getTime()
        return (
          <div key={date.toISOString()} className="rounded-xl p-2.5 flex flex-col gap-1.5 min-h-[160px]"
            style={{
              background: isToday ? 'rgba(0,230,118,0.04)' : '#0f0f0f',
              border: isToday ? '1px solid rgba(0,230,118,0.3)' : '1px solid #1e1e1e',
            }}>
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase font-semibold tracking-wider" style={{ color: '#666' }}>
                {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
              </span>
              <span className="text-sm tabular-nums" style={{ color: isToday ? '#00e676' : '#aaa', fontWeight: isToday ? 700 : 400 }}>
                {date.getDate()}
              </span>
            </div>
            {dayTasks.length === 0 ? (
              <p className="text-[10px]" style={{ color: '#444' }}>—</p>
            ) : (
              dayTasks.map((t) => <CompactTaskCard key={t.id} task={t} onClick={() => onSelectTask(t)} />)
            )}
          </div>
        )
      })}
    </div>
  )
}

function CompactTaskCard({ task, onClick }: { task: LeadTaskWithMeta; onClick: () => void }) {
  const isOverdue = !task.completed && new Date(task.due_at) < new Date()
  return (
    <button onClick={onClick}
      className="text-left rounded-md p-1.5 transition-colors w-full"
      style={{
        background: '#141414',
        border: `1px solid ${isOverdue ? 'rgba(255,68,68,0.3)' : '#1e1e1e'}`,
        opacity: task.completed ? 0.5 : 1,
      }}>
      <p className="text-xs font-medium truncate" style={{ color: '#e8e8e8', textDecoration: task.completed ? 'line-through' : undefined }}>
        {task.title}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: isOverdue ? '#ff4444' : '#666' }}>
        {new Date(task.due_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>
      {task.lead_name && (
        <p className="text-[10px] mt-0.5 truncate flex items-center gap-1"
          style={{ color: '#40a0ff' }}>
          <UserCircle size={9} /> {task.lead_name}
        </p>
      )}
    </button>
  )
}

// ── Lista (diário) ──────────────────────────────────────────────────────────

function ListView({ tasks, onSelectTask }: {
  tasks: LeadTaskWithMeta[]; onSelectTask: (t: LeadTaskWithMeta) => void
}) {
  const { update, remove } = useTaskMutations()
  const confirm = useConfirm()

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: '#1a1a1a' }}>
          <CalIcon size={26} style={{ color: '#333' }} />
        </div>
        <p className="font-medium" style={{ color: '#666' }}>Nenhuma tarefa neste período</p>
      </div>
    )
  }

  // Agrupa por dia
  const byDay = new Map<string, LeadTaskWithMeta[]>()
  for (const t of tasks) {
    const key = t.due_at.slice(0, 10)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(t)
  }

  async function handleDelete(t: LeadTaskWithMeta) {
    const ok = await confirm({
      title: 'Excluir tarefa',
      message: `Excluir a tarefa "${t.title}"?`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (ok) remove.mutate(t.id)
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(byDay.entries()).map(([day, items]) => {
        const date = new Date(day + 'T00:00:00')
        return (
          <div key={day}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#666' }}>
              {date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
            <div className="flex flex-col gap-1.5">
              {items.map((t) => {
                const isOverdue = !t.completed && new Date(t.due_at) < new Date()
                return (
                  <div key={t.id} className="rounded-lg p-3 group"
                    style={{
                      background: '#141414',
                      border: `1px solid ${isOverdue ? 'rgba(255,68,68,0.3)' : '#1e1e1e'}`,
                      opacity: t.completed ? 0.6 : 1,
                    }}>
                    <div className="flex items-start gap-3">
                      <button onClick={() => update.mutate({ id: t.id, data: { completed: !t.completed } })}
                        className="h-5 w-5 rounded shrink-0 mt-0.5 flex items-center justify-center"
                        style={{
                          background: t.completed ? 'var(--tenant-primary)' : '#1a1a1a',
                          border: t.completed ? 'none' : '1px solid #2a2a2a',
                        }}>
                        {t.completed && <Check size={11} style={{ color: '#000' }} strokeWidth={3} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: t.completed ? '#666' : '#e8e8e8', textDecoration: t.completed ? 'line-through' : undefined }}>
                          {t.title}
                        </p>
                        {t.description && (
                          <p className="text-xs mt-0.5" style={{ color: '#666' }}>{t.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                          <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: isOverdue ? '#ff4444' : '#666' }}>
                            {isOverdue && <AlertTriangle size={9} />}
                            <Clock size={9} />
                            {new Date(t.due_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {t.assignee_name && (
                            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: '#666' }}>
                              <User size={9} /> {t.assignee_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onSelectTask(t)} title="Editar"
                          className="h-7 w-7 rounded flex items-center justify-center" style={{ color: '#555' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#40a0ff'; e.currentTarget.style.background = 'rgba(64,160,255,0.08)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}>
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => handleDelete(t)} title="Excluir"
                          className="h-7 w-7 rounded flex items-center justify-center" style={{ color: '#555' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#ff4444'; e.currentTarget.style.background = 'rgba(255,68,68,0.08)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {t.lead_name && <LinkedLeadBlock task={t} />}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Modal de detalhe da tarefa (clique na agenda) ───────────────────────────

function TaskDetailModal({
  task, isToggling, isDeleting, onClose, onEdit, onToggleDone, onDelete,
}: {
  task: LeadTaskWithMeta
  isToggling: boolean
  isDeleting: boolean
  onClose: () => void
  onEdit: () => void
  onToggleDone: () => void
  onDelete: () => void
}) {
  const due       = new Date(task.due_at)
  const isOverdue = !task.completed && due < new Date()
  const dateLabel = due.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const timeLabel = due.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <Modal
      open
      onClose={onClose}
      title="Detalhes da tarefa"
      size="md"
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
            style={{ color: '#ff5555', border: '1px solid rgba(255,68,68,0.25)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,68,68,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Trash2 size={14} /> Excluir
          </button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onEdit}>
              <Pencil size={14} /> Editar
            </Button>
            <Button onClick={onToggleDone} loading={isToggling}>
              <Check size={15} />
              {task.completed ? 'Reabrir' : 'Marcar como feito'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Título + status */}
        <div className="flex items-start gap-3">
          <span
            className="h-6 w-6 rounded-md shrink-0 mt-0.5 flex items-center justify-center"
            style={{
              background: task.completed ? 'var(--tenant-primary)' : '#1a1a1a',
              border: task.completed ? 'none' : '1px solid #2a2a2a',
            }}
          >
            {task.completed && <Check size={13} style={{ color: '#000' }} strokeWidth={3} />}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold leading-snug"
              style={{ color: '#e8e8e8', textDecoration: task.completed ? 'line-through' : undefined }}>
              {task.title}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {task.completed && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(0,230,118,0.12)', color: '#00e676' }}>
                  Concluída
                </span>
              )}
              {isOverdue && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1"
                  style={{ background: 'rgba(255,68,68,0.12)', color: '#ff5555' }}>
                  <AlertTriangle size={9} /> Atrasada
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Descrição */}
        {task.description && (
          <p className="text-sm whitespace-pre-wrap" style={{ color: '#aaa' }}>{task.description}</p>
        )}

        {/* Data / hora / responsável */}
        <div className="flex flex-col gap-2 rounded-lg p-3" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: '#ccc' }}>
            <CalendarDays size={14} style={{ color: '#666' }} />
            <span className="capitalize">{dateLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: isOverdue ? '#ff5555' : '#ccc' }}>
            <Clock size={14} style={{ color: isOverdue ? '#ff5555' : '#666' }} />
            <span>{timeLabel}</span>
          </div>
          {task.assignee_name && (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#ccc' }}>
              <User size={14} style={{ color: '#666' }} />
              <span>{task.assignee_name}</span>
            </div>
          )}
        </div>

        {/* Lead vinculado */}
        {task.lead_name && <LinkedLeadBlock task={task} />}
      </div>
    </Modal>
  )
}

// ── Subcomponentes ──────────────────────────────────────────────────────────

// Bloco de lead vinculado exibido dentro da tarefa
function LinkedLeadBlock({ task }: { task: LeadTaskWithMeta }) {
  const hasContact = task.lead_phone || task.lead_email
  return (
    <div className="mt-3 ml-8 rounded-lg p-2.5 flex flex-wrap items-center gap-2.5"
      style={{ background: 'rgba(64,160,255,0.06)', border: '1px solid rgba(64,160,255,0.2)' }}>
      <div className="flex items-center gap-1.5 min-w-0">
        <UserCircle size={13} style={{ color: '#40a0ff' }} className="shrink-0" />
        <span className="text-xs font-medium truncate" style={{ color: '#40a0ff' }}>
          {task.lead_name}
        </span>
      </div>
      {task.lead_company && (
        <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: '#aaa' }}>
          <Building2 size={10} /> {task.lead_company}
        </span>
      )}
      {task.lead_phone && (
        <a href={`tel:${task.lead_phone}`} className="inline-flex items-center gap-1 text-[11px]"
          style={{ color: '#aaa' }}>
          <Phone size={10} /> {formatPhone(task.lead_phone)}
        </a>
      )}
      {task.lead_phone && (
        <a href={`https://wa.me/55${task.lead_phone.replace(/\D/g, '')}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium"
          style={{ color: '#00e676' }}>
          <span>●</span> WhatsApp
        </a>
      )}
      {task.lead_email && (
        <a href={`mailto:${task.lead_email}`} className="inline-flex items-center gap-1 text-[11px] truncate"
          style={{ color: '#aaa' }}>
          <Mail size={10} /> {task.lead_email}
        </a>
      )}
      {!hasContact && (
        <span className="text-[10px]" style={{ color: '#666' }}>Sem telefone ou e-mail cadastrado</span>
      )}
    </div>
  )
}

function ViewBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium transition-all"
      style={active
        ? { background: 'var(--bg-surface)', color: 'var(--text)' }
        : { color: '#666' }}>
      {icon}
      {label}
    </button>
  )
}
