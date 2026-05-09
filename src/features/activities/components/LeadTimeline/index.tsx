import { Zap } from 'lucide-react'
import { ActivityItem } from '../ActivityItem'
import { Spinner } from '@/components/ui/Spinner'
import { useLeadActivities } from '../../hooks/useLeadActivities'

interface LeadTimelineProps {
  leadId:     string
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
        <div className="h-12 w-12 rounded-full flex items-center justify-center"
          style={{ background: '#1a1a1a' }}>
          <Zap size={20} style={{ color: '#444' }} />
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: '#666' }}>Nenhum disparo registrado</p>
          <p className="text-xs mt-0.5" style={{ color: '#444' }}>
            Registre o primeiro contato com este lead
          </p>
        </div>
        <button
          onClick={onRegister}
          className="text-sm font-medium transition-colors"
          style={{ color: 'var(--tenant-primary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
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
