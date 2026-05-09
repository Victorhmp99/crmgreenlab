import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/providers/AuthProvider'
import { TenantProvider } from '@/providers/TenantProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { AppRouter } from '@/routes'

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
            <AppRouter />
          </ThemeProvider>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
