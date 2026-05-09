import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { PrivateRoute } from './PrivateRoute'
import { RoleRoute } from './RoleRoute'
import { AppLayout } from '@/components/layout/AppLayout'

// Auth pages
import { LoginPage }          from '@/features/auth/pages/LoginPage'
import { RegisterPage }       from '@/features/auth/pages/RegisterPage'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage }  from '@/features/auth/pages/ResetPasswordPage'
import { AcceptInvitePage }   from '@/features/auth/pages/AcceptInvitePage'

// App pages
import { DashboardPage }  from '@/features/dashboard/pages/DashboardPage'
import { LeadsPage }      from '@/features/leads/pages/LeadsPage'
import { PipelinePage }   from '@/features/pipeline/pages/PipelinePage'
import { ActivitiesPage } from '@/features/activities/pages/ActivitiesPage'
import { GoalsPage }      from '@/features/goals/pages/GoalsPage'
import { RevenuePage }    from '@/features/revenue/pages/RevenuePage'
import { ReportsPage }    from '@/features/reports/pages/ReportsPage'
import { MetaAdsPage }    from '@/features/integrations/pages/MetaAdsPage'
import { UsersPage }      from '@/features/users/pages/UsersPage'
import { SettingsPage }  from '@/features/settings/pages/SettingsPage'

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        {/* Rotas públicas */}
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/registrar"       element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
        <Route path="/convite/:token"  element={<AcceptInvitePage />} />

        {/* Rotas privadas */}
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<AppLayout><Navigate to="/dashboard" /></AppLayout>} />

          {/* Todos os usuários autenticados */}
          <Route path="/dashboard"  element={<AppLayout><DashboardPage /></AppLayout>} />
          <Route path="/leads"      element={<AppLayout><LeadsPage /></AppLayout>} />
          <Route path="/pipeline"   element={<AppLayout><PipelinePage /></AppLayout>} />
          <Route path="/activities" element={<AppLayout><ActivitiesPage /></AppLayout>} />
          <Route path="/goals"      element={<AppLayout><GoalsPage /></AppLayout>} />

          {/* Restritos a manager/admin */}
          <Route element={<RoleRoute required="manager" />}>
            <Route path="/revenue"  element={<AppLayout><RevenuePage /></AppLayout>} />
            <Route path="/reports"  element={<AppLayout><ReportsPage /></AppLayout>} />
            <Route path="/meta-ads" element={<AppLayout><MetaAdsPage /></AppLayout>} />
          </Route>

          {/* Restrito a admin */}
          <Route element={<RoleRoute required="admin" />}>
            <Route path="/users"     element={<AppLayout><UsersPage /></AppLayout>} />
            <Route path="/settings"  element={<AppLayout><SettingsPage /></AppLayout>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  )
}
