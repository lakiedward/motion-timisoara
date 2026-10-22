import { useQuery } from '@tanstack/react-query'

import { getInvitatiileMele } from '@/api/camp-coaches'
import { useAuth } from '@/lib/auth-context'

export const INVITATIONS_KEY = 'invitatiile-mele'

export function useCampInvitations(enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [INVITATIONS_KEY, user?.id],
    queryFn: () => getInvitatiileMele(user!.id),
    enabled: enabled && !!user?.id,
  })
}
