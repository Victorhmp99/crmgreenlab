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
          <h2 className="text-xl font-semibold text-slate-900">
            {greeting()}, {name} 👋
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {tenant?.name} · Resumo geral
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
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
          color="bg-blue-600"
          current={data?.totalLeads}
          previous={data?.totalLeadsPrev}
          deltaLabel="vs 30 dias anteriores"
          isLoading={isLoading}
        />
        <MetricCard
          label="No Pipeline"
          value={data?.leadsInPipeline ?? 0}
          icon={Kanban}
          color="bg-violet-600"
          isLoading={isLoading}
        />
        <MetricCard
          label="Disparos Hoje"
          value={data?.activitiesToday ?? 0}
          icon={Zap}
          color="bg-amber-500"
          current={data?.activitiesToday}
          previous={data?.activitiesYesterday}
          deltaLabel="vs ontem"
          isLoading={isLoading}
        />
        <MetricCard
          label="Fechamentos"
          value={data?.conversionsThisMonth ?? 0}
          icon={CheckCircle}
          color="bg-emerald-600"
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
