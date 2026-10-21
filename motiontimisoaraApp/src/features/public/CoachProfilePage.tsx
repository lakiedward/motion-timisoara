import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { coachClubs, getCoachByUserId, publicUrl } from '@/api/public'
import { getCoachRatingSummary, getMyCoachRating, submitCoachRating } from '@/api/ratings'
import { useAuth } from '@/lib/auth-context'
import { StatusView } from '@/components/ui/status-view'
import { StarRating } from '@/components/StarRating'
import { CoachCourses } from './coaches/CoachCourses'
import { CoachBackLink, CoachHero, CoachHeroSkeleton } from './coaches/CoachHero'

export default function CoachProfilePage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const qc = useQueryClient()
  const {
    data: coach,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['coach', id],
    queryFn: () => getCoachByUserId(id),
    retry: false,
  })
  const { data: rating } = useQuery({
    queryKey: ['coach-rating', id],
    queryFn: () => getCoachRatingSummary(id),
  })
  const { data: myRating } = useQuery({
    queryKey: ['my-coach-rating', id, user?.id],
    queryFn: () => getMyCoachRating(id),
    enabled: !!user,
  })
  const rate = useMutation({
    mutationFn: (r: number) => submitCoachRating(id, r),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coach-rating', id] })
      qc.invalidateQueries({ queryKey: ['my-coach-rating', id] })
      toast.success('Mulțumim pentru evaluare!')
    },
    onError: () => toast.error('Nu am putut salva evaluarea.'),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <CoachHeroSkeleton />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <CoachBackLink />
        <StatusView
          state="error"
          title="Nu am putut încărca antrenorul."
          onRetry={() => void refetch()}
          className="mt-4"
        />
      </div>
    )
  }
  if (!coach) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-20 text-center">
        <p className="text-muted-foreground">Antrenorul nu a fost găsit.</p>
        <div className="mt-2">
          <CoachBackLink />
        </div>
      </div>
    )
  }

  const name = coach.profile?.name ?? 'Antrenor'
  const sports = (coach.coach_sports ?? []).flatMap((cs) => (cs.sport ? [cs.sport] : []))

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <CoachHero
        name={name}
        photoUrl={publicUrl('coach-photos', coach.photo_storage_path)}
        sports={sports}
        clubs={coachClubs(coach)}
        bio={coach.bio}
        rating={rating}
        myRating={
          user?.role === 'PARENT' && (
            <div className="mt-3 flex items-center justify-center gap-2 sm:justify-start">
              <span className="text-muted-foreground text-sm font-medium">Nota ta:</span>
              <StarRating value={myRating ?? 0} onChange={(r) => rate.mutate(r)} />
            </div>
          )
        }
      />

      <CoachCourses coachId={id} />
    </div>
  )
}
