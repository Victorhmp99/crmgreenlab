import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { PrivateRoute }    from './PrivateRoute'
import { RoleRoute }       from './RoleRoute'
import { FeatureRoute }    from './FeatureRoute'
import { SuperAdminRoute } from './SuperAdminRoute'
import { AppLayout }       from '@/components/layout/AppLayout'
import { useAuth }         from '@/hooks/useAuth'
import { Spinner }         from '@/components/ui/Spinner'

// Landing pública (antes do login)
import { LandingPage }        from '@/features/landing/pages/LandingPage'

// Auth pages
import { LoginPage }          from '@/features/auth/pages/LoginPage'
import { RegisterPage }       from '@/features/auth/pages/RegisterPage'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage }  from '@/features/auth/pages/ResetPasswordPage'
import { AcceptInvitePage }   from '@/features/auth/pages/AcceptInvitePage'
import { PendingPage }        from '@/features/auth/pages/PendingPage'
import { BlockedPage }        from '@/features/auth/pages/BlockedPage'

// App pages
import { DashboardPage }  from '@/features/dashboard/pages/DashboardPage'
import { LeadsPage }      from '@/features/leads/pages/LeadsPage'
import { PipelinePage }   from '@/features/pipeline/pages/PipelinePage'
import { ActivitiesPage } from '@/features/activities/pages/ActivitiesPage'
import { TasksPage }      from '@/features/tasks/pages/TasksPage'
import { GoalsPage }      from '@/features/goals/pages/GoalsPage'
import { RevenuePage }    from '@/features/revenue/pages/RevenuePage'
import { ReportsPage }    from '@/features/reports/pages/ReportsPage'
import { MetaAdsPage }    from '@/features/integrations/pages/MetaAdsPage'
import { UsersPage }      from '@/features/users/pages/UsersPage'
import { SettingsPage }   from '@/features/settings/pages/SettingsPage'
import { PlatformPage }   from '@/features/platform/pages/PlatformPage'
import { HelpPage }        from '@/features/help/pages/HelpPage'
import { HelpArticlePage } from '@/features/help/pages/HelpArticlePage'

// Rota que só exige autenticação (sem checagem de status)
// Usada para as páginas de pending/blocked
function AuthOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d0d' }}>
        <Spinner size="lg" />
      </div>
    )
  }
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        {/* Raiz: apresentação pra quem não entrou; a própria página manda
            quem já está logado direto pro dashboard. */}
        <Route path="/"                element={<LandingPage />} />

        {/* Rotas públicas */}
        <Route path="/apresentacao"    element={<LandingPage />} />
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/registrar"       element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
        <Route path="/convite/:token"  element={<AcceptInvitePage />} />

        {/* Rotas que exigem login mas não exigem conta ativa */}
        <Route element={<AuthOnlyRoute />}>
          <Route path="/aguardando" element={<PendingPage />} />
          <Route path="/bloqueado"  element={<BlockedPage />} />
        </Route>

        {/* Rotas privadas — exige login + conta ativa */}
        <Route element={<PrivateRoute />}>

          {/* Todos os usuários ativos */}
          <Route path="/dashboard"  element={<AppLayout><DashboardPage /></AppLayout>} />
          <Route path="/leads"      element={<AppLayout><LeadsPage /></AppLayout>} />
          <Route path="/pipeline"   element={<AppLayout><PipelinePage /></AppLayout>} />
          <Route path="/activities" element={<AppLayout><ActivitiesPage /></AppLayout>} />
          <Route path="/tasks"      element={<AppLayout><TasksPage /></AppLayout>} />
          <Route path="/goals"      element={<AppLayout><GoalsPage /></AppLayout>} />
          <Route path="/ajuda"          element={<AppLayout><HelpPage /></AppLayout>} />
          <Route path="/ajuda/:slug"    element={<AppLayout><HelpArticlePage /></AppLayout>} />

          {/* Restritos a manager/admin */}
          <Route element={<RoleRoute required="manager" />}>
            <Route element={<FeatureRoute feature="financeiro" />}>
              <Route path="/revenue"  element={<AppLayout><RevenuePage /></AppLayout>} />
            </Route>
            <Route element={<FeatureRoute feature="relatorios" />}>
              <Route path="/reports"  element={<AppLayout><ReportsPage /></AppLayout>} />
            </Route>
            <Route element={<FeatureRoute feature="meta_ads" />}>
              <Route path="/meta-ads" element={<AppLayout><MetaAdsPage /></AppLayout>} />
            </Route>
          </Route>

          {/* Gestão de usuários + configurações — Manager e Admin têm acesso.
              Manager só consegue convidar/promover Vendedores (validado no banco). */}
          <Route element={<RoleRoute required="manager" />}>
            <Route path="/users"    element={<AppLayout><UsersPage /></AppLayout>} />
            <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
          </Route>

          {/* Plataforma — super admin (master ou auxiliary) */}
          <Route element={<SuperAdminRoute />}>
            <Route path="/platform" element={<AppLayout><PlatformPage /></AppLayout>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  )
}
