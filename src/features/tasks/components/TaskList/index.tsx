import { useState } from 'react'
import { Plus, Check, Pencil, Trash2, Calendar, Clock, User, AlertTriangle } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { useLeadTasks, useTaskMutations } from '../../hooks/useTasks'
import { TaskForm } from '../TaskForm'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import type { LeadTaskWithMeta } from '@/services/leadTasks'

interface TaskListProps {
  leadId: string
}

export function TaskList({ leadId }: TaskListProps) {
  const { data: tasks = [], isLoading } = useLeadTasks(leadId)
  const { update, remove } = useTaskMutations(leadId)
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LeadTaskWithMeta | null>(null)

  function handleToggleComplete(task: LeadTaskWithMeta) {
    update.mutate({ id: task.id, data: { completed: !task.completed } })
  }

  async function handleDelete(task: LeadTaskWithMeta) {
    const ok = await confirm({
      title: 'Excluir tarefa', message: `Excluir a tarefa "${task.title}"?`,
      confirmLabel: 'Excluir', danger: true,
    })
    if (ok) remove.mutate(task.id)
  }

  function handleEdit(task: LeadTaskWithMeta) {
    setEditing(task)
    setShowForm(true)
  }

  function handleClose() {
    setShowForm(false)
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#555' }}>
          Tarefas
        </p>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-1 text-xs rounded-md px-2 py-1 transition-colors"
          style={{ background: 'rgba(0,230,118,0.08)', color: '#00e676', border: '1px solid rgba(0,230,118,0.2)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,230,118,0.15)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,230,118,0.08)')}>
          <Plus size={11} /> Nova tarefa
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-center py-3" style={{ color: '#555' }}>Nenhuma tarefa</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {tasks.map((task) => <TaskItem key={task.id} task={task}
            onToggle={handleToggleComplete}
            onEdit={handleEdit}
            onDelete={handleDelete} />)}
        </div>
      )}

      <TaskForm open={showForm} onClose={handleClose} task={editing} presetLeadId={leadId} />
    </div>
  )
}

function TaskItem({ task, onToggle, onEdit, onDelete }: {
  task:     LeadTaskWithMeta
  onToggle: (t: LeadTaskWithMeta) => void
  onEdit:   (t: LeadTaskWithMeta) => void
  onDelete: (t: LeadTaskWithMeta) => void
}) {
  const isOverdue = !task.completed && new Date(task.due_at) < new Date()
  const due = new Date(task.due_at)

  return (
    <div className="rounded-lg p-2.5 group flex items-start gap-2"
      style={{
        background: task.completed ? '#0f0f0f' : '#141414',
        border: `1px solid ${isOverdue ? 'rgba(255,68,68,0.3)' : '#1e1e1e'}`,
        opacity: task.completed ? 0.6 : 1,
      }}>
      <button onClick={() => onToggle(task)}
        className="h-5 w-5 rounded shrink-0 mt-0.5 flex items-center justify-center transition-colors"
        style={{
          background: task.completed ? 'var(--tenant-primary)' : '#1a1a1a',
          border: task.completed ? 'none' : '1px solid #2a2a2a',
        }}>
        {task.completed && <Check size={11} style={{ color: '#000' }} strokeWidth={3} />}
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight"
          style={{ color: task.completed ? '#666' : '#e8e8e8', textDecoration: task.completed ? 'line-through' : undefined }}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#666' }}>
            {task.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: isOverdue ? '#ff4444' : '#666' }}>
            {isOverdue && <AlertTriangle size={9} />}
            <Calendar size={9} />
            {due.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            <Clock size={9} />
            {due.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {task.assignee_name && (
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: '#666' }}>
              <User size={9} />
              {task.assignee_name}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(task)} title="Editar"
          className="h-6 w-6 rounded flex items-center justify-center" style={{ color: '#555' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#40a0ff'; e.currentTarget.style.background = 'rgba(64,160,255,0.08)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}>
          <Pencil size={11} />
        </button>
        <button onClick={() => onDelete(task)} title="Excluir"
          className="h-6 w-6 rounded flex items-center justify-center" style={{ color: '#555' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ff4444'; e.currentTarget.style.background = 'rgba(255,68,68,0.08)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}>
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}
