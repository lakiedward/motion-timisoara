import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'

import { getCoachByUserId, getCourses, publicUrl } from '@/api/public'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CourseCard } from './components/CourseCard'

export default function CoachProfilePage() {
  const { id = '' } = useParams()
  const { data: coach, isLoading } = useQuery({
    queryKey: ['coach', id],
    queryFn: () => getCoachByUserId(id),
  })
  const { data: allCourses = [] } = useQuery({ queryKey: ['courses', 'all'], queryFn: () => getCourses() })
  const courses = allCourses.filter((c) => c.coach?.id === id)

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
