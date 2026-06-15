import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { getCoachByUserId, getCourses, publicUrl } from '@/api/public'
import { getCoachRatingSummary, getMyCoachRating, submitCoachRating } from '@/api/ratings'
import { useAuth } from '@/lib/auth-context'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StarRating } from '@/components/StarRating'
import { CourseCard } from './components/CourseCard'

export default function CoachProfilePage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: coach, isLoading } = useQuery({
    queryKey: ['coach', id],
    queryFn: () => getCoachByUserId(id),
  })
  const { data: allCourses = [] } = useQuery({ queryKey: ['courses', 'all'], queryFn: () => getCourses() })
  const courses = allCourses.filter((c) => c.coach?.id === id)
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
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    )
  }
  if (!coach) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-20 text-center">
        <p className="text-muted-foreground">Antrenorul nu a fost găsit.</p>
        <Link to="/antrenori" className="text-primary mt-4 inline-block font-semibold">
          ← Înapoi la antrenori
        </Link>
      </div>
    )
  }

  const photo = publicUrl('coach-photos', coach.photo_storage_path)
  const name = coach.profile?.name ?? 'Antrenor'

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link to="/antrenori" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Înapoi la antrenori
      </Link>

      <div className="bg-card shadow-card mt-6 flex flex-col items-center gap-5 rounded-3xl border p-8 text-center sm:flex-row sm:text-left">
        <div className="size-28 shrink-0 overflow-hidden rounded-full border-4 border-muted">
          {photo ? (
            <img src={photo} alt={name} className="size-full object-cover" />
          ) : (
            <div className="bg-primary grid size-full place-items-center text-3xl font-bold text-white">
              {name.charAt(0)}
            </div>
          )}
        </div>
        <div>
          <h1 className="font-display text-3xl font-extrabold text-foreground">{name}</h1>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {coach.coach_sports
              ?.map((cs) => cs.sport)
              .filter(Boolean)
              .map((s) => (
                <Badge key={s!.id} variant="outline">
                  {s!.name}
                </Badge>
              ))}
          </div>
          {coach.bio && <p className="text-muted-foreground mt-3 max-w-xl">{coach.bio}</p>}

          {rating && rating.count > 0 && (
            <div className="mt-3 flex items-center justify-center gap-2 sm:justify-start">
              <StarRating value={rating.avg} size={18} />
              <span className="text-muted-foreground text-sm">
                {rating.avg.toFixed(1)} · {rating.count}{' '}
                {rating.count === 1 ? 'evaluare' : 'evaluări'}
              </span>
            </div>
          )}
          {user?.role === 'PARENT' && (
            <div className="mt-3 flex items-center justify-center gap-2 sm:justify-start">
              <span className="text-muted-foreground text-sm font-medium">Nota ta:</span>
              <StarRating value={myRating ?? 0} onChange={(r) => rate.mutate(r)} />
            </div>
          )}
        </div>
      </div>

      {courses.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display mb-5 text-2xl font-bold">Cursuri predate</h2>
          <div className="grid gap-7 md:grid-cols-3">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
