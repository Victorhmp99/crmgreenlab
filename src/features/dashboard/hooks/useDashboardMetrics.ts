import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { fetchDashboardMetrics, type DashboardMetrics } from '@/services/dashboard'

// Dados de demonstração para VITE_DEMO_MODE=true
function buildDemoMetrics(): DashboardMetrics {
  const today = new Date()
  const leadsLast30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (29 - i))
    return {
      date:  d.toISOString().slice(0, 10),
      count: Math.floor(Math.random() * 8 + 1),
    }
  })

  return {
    totalLeads:           127,
    totalLeadsPrev:       98,
    leadsInPipeline:      43,
    activitiesToday:      12,
    activitiesYesterday:  9,
    conversionsThisMonth: 8,
    conversionsPrevMonth: 5,
    totalConverted:       45,
    totalLost:            12,
    monthlyRevenue:       18500,
    conversionRate:       79,
    financial: {
      revenue:           28500,
      forecast:          42000,
      loss:              7800,
      won_count:         8,
      lost_count:        3,
      in_progress_count: 15,
      active_count:      4,
      total_with_value:  30,
      avg_ticket:        3562.5,
      conversion_rate:   73,
    },
    leadsBySource: [
      { source: 'meta_ads',  count: 54 },
      { source: 'referral',  count: 29 },
      { source: 'google',    count: 21 },
      { source: 'manual',    count: 15 },
      { source: 'import',    count: 8  },
    ],
    leadsByStage: [
      { stageId: '1', stageName: 'Novo Lead',      color: '#6366F1', count: 18 },
      { stageId: '2', stageName: 'Contato Feito',  color: '#3B82F6', count: 12 },
      { stageId: '3', stageName: 'Agendado',        color: '#F59E0B', count: 7  },
      { stageId: '4', stageName: 'Em Negociação',  color: '#EC4899', count: 4  },
      { stageId: '5', stageName: 'Fechado',         color: '#10B981', count: 2  },
    ],
    leadsLast30Days,
    recentLeads: [
      { id:'1', tenant_id:'t', assigned_to:null, name:'Ana Costa',       phone:'11991234567', email:'ana@email.com',   status:'active',    source:'meta_ads', source_campaign:'Black Friday', notes:null, tags:['implante'],       custom_fields:{}, created_at: new Date(Date.now()-1*86400000).toISOString(), updated_at: new Date().toISOString() },
      { id:'2', tenant_id:'t', assigned_to:null, name:'Carlos Mendes',   phone:'11982345678', email:null,              status:'active',    source:'referral', source_campaign:null,           notes:null, tags:[],                 custom_fields:{}, created_at: new Date(Date.now()-2*86400000).toISOString(), updated_at: new Date().toISOString() },
      { id:'3', tenant_id:'t', assigned_to:null, name:'Fernanda Lima',   phone:'11973456789', email:'fe@email.com',   status:'converted', source:'google',   source_campaign:'Clareamento',  notes:null, tags:['clareamento'],   custom_fields:{}, created_at: new Date(Date.now()-3*86400000).toISOString(), updated_at: new Date().toISOString() },
      { id:'4', tenant_id:'t', assigned_to:null, name:'Roberto Souza',   phone:'11964567890', email:null,              status:'active',    source:'manual',   source_campaign:null,           notes:null, tags:[],                 custom_fields:{}, created_at: new Date(Date.now()-4*86400000).toISOString(), updated_at: new Date().toISOString() },
      { id:'5', tenant_id:'t', assigned_to:null, name:'Juliana Ramos',   phone:'11955678901', email:'ju@email.com',   status:'active',    source:'meta_ads', source_campaign:'Verão',        notes:null, tags:['ortodontia'],    custom_fields:{}, created_at: new Date(Date.now()-5*86400000).toISOString(), updated_at: new Date().toISOString() },
      { id:'6', tenant_id:'t', assigned_to:null, name:'Pedro Alves',     phone:'11946789012', email:null,              status:'lost',      source:'google',   source_campaign:null,           notes:null, tags:[],                 custom_fields:{}, created_at: new Date(Date.now()-6*86400000).toISOString(), updated_at: new Date().toISOString() },
    ],
  }
}

export function useDashboardMetrics() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const isDemo   = import.meta.env.VITE_DEMO_MODE === 'true'

  return useQuery({
    queryKey:  ['dashboard-metrics', tenantId],
    queryFn:   isDemo ? buildDemoMetrics : () => fetchDashboardMetrics(tenantId!),
    enabled:   !!tenantId,
    staleTime: 0,  // sempre rebusca quando algo muda
    refetchOnWindowFocus: !isDemo,
    refetchOnMount: true,
  })
}
