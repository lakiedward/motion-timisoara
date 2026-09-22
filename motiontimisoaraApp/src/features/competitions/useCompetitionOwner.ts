import { useQuery } from '@tanstack/react-query'

import { getMyClub } from '@/api/club'
import type { CompetitionOwner } from '@/api/competitions'
import { useAuth } from '@/lib/auth-context'

export function useCompetitionOwner(): {
  owner: CompetitionOwner
  gata: boolean
  eroare: boolean
  reincearca: () => void
} {
  const { user } = useAuth()
  const eClub = user?.role === 'CLUB'
  const eAdmin = user?.role === 'ADMIN'
  const eAntrenor = user?.role === 'COACH'

  const {
    data: club,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['my-club'],
    queryFn: getMyClub,
    enabled: eClub,
  })

  const role = eAdmin ? 'ADMIN' : eClub ? 'CLUB' : 'COACH'
  return {
    owner: {
      role,
      clubId: eClub ? (club?.id ?? null) : null,
      coachUserId: eAntrenor ? (user?.id ?? null) : null,
    },
    gata: eClub ? !isLoading && !isError && !!club : !!user && (eAdmin || eAntrenor),
    eroare: eClub && isError,
    reincearca: () => void refetch(),
  }
}
