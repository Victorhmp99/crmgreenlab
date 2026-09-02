import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/providers/AuthProvider'
import { TenantProvider } from '@/providers/TenantProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { AppRouter } from '@/routes'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantProvider>
          <ThemeProvider>
            <ConfirmProvider>
              {/* Dentro dos provedores: assim o erro de uma tela não derruba
                  sessão nem tema, e recarregar volta pro mesmo lugar. */}
              <ErrorBoundary>
                <AppRouter />
              </ErrorBoundary>
            </ConfirmProvider>
          </ThemeProvider>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
