import { Zap } from 'lucide-react'
import { ActivityItem } from '../ActivityItem'
import { Spinner } from '@/components/ui/Spinner'
import { useLeadActivities } from '../../hooks/useLeadActivities'

interface LeadTimelineProps {
  leadId: string
  onRegister: () => void
}

export function LeadTimeline({ leadId, onRegister }: LeadTimelineProps) {
  const { data: activities = [], isLoading } = useLeadActivities(leadId)

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
          <Zap size={20} className="text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-600">Nenhum disparo registrado</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Registre o primeiro contato com este lead
          </p>
        </div>
        <button
          onClick={onRegister}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          + Registrar disparo
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {activities.map((activity, index) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          showLead={false}
          isLast={index === activities.length - 1}
        />
      ))}
    </div>
  )
}
