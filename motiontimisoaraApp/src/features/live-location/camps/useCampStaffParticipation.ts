import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getCampParticipants, recordCampParticipation } from '@/api/live-location/discovery'
import { useAuth } from '@/lib/auth-context'

export function useCampStaffParticipation(campId: string) {
  const { user } = useAuth()
  const staff = !!user && (user.role === 'COACH' || user.role === 'CLUB')
  const [departure, setDeparture] = useState<string | null>(null)
  const participants = useQuery({
    queryKey: ['camp-participation', user?.id ?? 'none', campId],
    queryFn: () => getCampParticipants(campId, user!.id),
    enabled: staff,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: staff ? 15_000 : false,
  })
  const mutation = useMutation({
    mutationFn: ({ action, enrollmentId }: { action: 'arrive' | 'depart'; enrollmentId: string }) =>
      recordCampParticipation(action, campId, enrollmentId, user!.id),
    onSuccess: async () => {
      setDeparture(null)
      await participants.refetch()
    },
  })
  const byEnrollment = new Map(
    (participants.data?.participants ?? []).map((participant) => [
      participant.enrollmentId,
      participant,
    ]),
  )
  return {
    staff,
    userId: user?.id ?? null,
    participants,
    mutation,
    departure,
    setDeparture,
    byEnrollment,
  }
}
