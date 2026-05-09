import { Users, Kanban, Zap, CheckCircle, RefreshCw } from 'lucide-react'
import { MetricCard } from '../components/MetricCard'
import { LeadsEvolutionChart } from '../components/LeadsEvolutionChart'
import { PipelineFunnelChart } from '../components/PipelineFunnelChart'
import { SourceDistributionChart } from '../components/SourceDistributionChart'
import { RecentLeadsTable } from '../components/RecentLeadsTable'
import { useDashboardMetrics } from '../hooks/useDashboardMetrics'
import { useAuth } from '@/hooks/useAuth'

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export function DashboardPage() {
  const { user, tenant } = useAuth()
  const { data, isLoading, refetch, dataUpdatedAt } = useDashboardMetrics()

  const name = user?.email?.split('@')[0] ?? 'usuário'

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="flex flex-col gap-6">
      {/* Saudação */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>
            {greeting()}, {name} 👋
          </h2>
          <p className="text-sm mt-0.5" style={{ color: '#555' }}>
            {tenant?.name ?? 'Green Hub'} · Resumo geral
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50"
          style={{ color: '#555' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
          title="Atualizar dados"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          {lastUpdated ? `Atualizado às ${lastUpdated}` : 'Atualizar'}
        </button>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Leads Ativos"
          value={data?.totalLeads ?? 0}
          icon={Users}
          iconColor="rgba(0,230,118,0.15)"
          iconTextColor="var(--tenant-primary)"
          current={data?.totalLeads}
          previous={data?.totalLeadsPrev}
          deltaLabel="vs 30 dias anteriores"
          isLoading={isLoading}
        />
        <MetricCard
          label="No Pipeline"
          value={data?.leadsInPipeline ?? 0}
          icon={Kanban}
          iconColor="rgba(139,92,246,0.15)"
          iconTextColor="#a78bfa"
          isLoading={isLoading}
        />
        <MetricCard
          label="Disparos Hoje"
          value={data?.activitiesToday ?? 0}
          icon={Zap}
          iconColor="rgba(251,191,36,0.15)"
          iconTextColor="#fbbf24"
          current={data?.activitiesToday}
          previous={data?.activitiesYesterday}
          deltaLabel="vs ontem"
          isLoading={isLoading}
        />
        <MetricCard
          label="Fechamentos"
          value={data?.conversionsThisMonth ?? 0}
          icon={CheckCircle}
          iconColor="rgba(0,230,118,0.15)"
          iconTextColor="var(--tenant-primary)"
          current={data?.conversionsThisMonth}
          previous={data?.conversionsPrevMonth}
          deltaLabel="vs mês anterior"
          isLoading={isLoading}
        />
      </div>

      {/* Gráfico de evolução — largura total */}
      <LeadsEvolutionChart
        data={data?.leadsLast30Days ?? []}
        isLoading={isLoading}
      />

      {/* Pipeline + Origem — lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PipelineFunnelChart
          data={data?.leadsByStage ?? []}
          isLoading={isLoading}
        />
        <SourceDistributionChart
          data={data?.leadsBySource ?? []}
          isLoading={isLoading}
        />
      </div>

      {/* Leads recentes */}
      <RecentLeadsTable
        leads={data?.recentLeads ?? []}
        isLoading={isLoading}
      />
    </div>
  )
}
