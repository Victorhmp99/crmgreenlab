import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const { user, session, membership, tenant, isLoading } = useAuthStore()

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // HashRouter usa #/ — o Supabase redireciona para a origin e o hash lida com o resto
      redirectTo: `${window.location.origin}${window.location.pathname}#/reset-password`,
    })
    if (error) throw error
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  return {
    user,
    session,
    membership,
    tenant,
    isLoading,
    isAuthenticated: !!session || !!user,  // user sem session cobre o modo demo
    role: membership?.role ?? null,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  }
}
