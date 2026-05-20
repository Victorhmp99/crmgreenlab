import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  updateUserRole,
  setUserActive,
  createInvite,
  revokeInvite,
  setUserCompanyLimit,
} from '@/services/users'
import type { UserRole } from '@/types'

export function useUserMutations() {
  const queryClient = useQueryClient()
  const tenant = useAuthStore((s) => s.tenant)
  const user   = useAuthStore((s) => s.user)

  function invalidateUsers()   { queryClient.invalidateQueries({ queryKey: ['users',   tenant?.id] }) }
  function invalidateInvites() { queryClient.invalidateQueries({ queryKey: ['invites', tenant?.id] }) }

  const changeRole = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: UserRole }) =>
      updateUserRole(membershipId, role),
    onSuccess: invalidateUsers,
  })

  const toggleActive = useMutation({
    mutationFn: ({ membershipId, active }: { membershipId: string; active: boolean }) =>
      setUserActive(membershipId, active),
    onSuccess: invalidateUsers,
  })

  const invite = useMutation({
    mutationFn: ({ email, role }: { email: string; role: UserRole }) =>
      createInvite(tenant!.id, email, role, user!.id),
    onSuccess: invalidateInvites,
  })

  const revoke = useMutation({
    mutationFn: (inviteId: string) => revokeInvite(inviteId),
    onSuccess: invalidateInvites,
  })

  const setLimit = useMutation({
    mutationFn: ({ membershipId, limit }: { membershipId: string; limit: number | null }) =>
      setUserCompanyLimit(membershipId, limit),
    onSuccess: invalidateUsers,
  })

  return { changeRole, toggleActive, invite, revoke, setLimit }
}
