import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StarRating } from '@/components/StarRating'
import type { CoachClub } from '@/api/public'
import { initials } from '@/lib/initials'
import { CoachClubs } from './CoachClubs'

const CARD_LAYOUT =
  'mt-4 flex-col items-center gap-5 p-6 text-center sm:flex-row sm:items-center sm:p-8 sm:text-left'

export function CoachBackLink() {
  return (
    <Link
      to="/antrenori"
      className="text-muted-foreground hover:text-foreground focus-visible:outline-ring inline-flex h-11 items-center gap-1 rounded-md text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <ArrowLeft className="size-4" /> Înapoi la antrenori
    </Link>
  )
}

export function CoachHeroSkeleton() {
  return (
    <section data-section="coach-hero" role="status" aria-label="Se încarcă antrenorul">
      <CoachBackLink />
      <Card className={CARD_LAYOUT}>
        <Skeleton className="size-24 shrink-0 rounded-full" />
        <div className="flex w-full max-w-md flex-col items-center gap-3 sm:items-start">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
        </div>
      </Card>
    </section>
  )
}

export function CoachHero({
  name,
  photoUrl,
  sports,
  clubs = [],
  bio,
  rating,
  myRating,
}: {
  name: string
  photoUrl: string | null
  sports: { id: string; name: string }[]
  clubs?: CoachClub[]
  bio: string | null
  rating: { avg: number; count: number } | undefined
  myRating?: ReactNode
}) {
  return (
    <section data-section="coach-hero">
      <CoachBackLink />
      <Card className={CARD_LAYOUT}>
        <Avatar className="size-24">
          {photoUrl && <AvatarImage src={photoUrl} alt={name} className="object-cover" />}
          <AvatarFallback className="text-3xl">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="font-display text-foreground text-3xl font-extrabold md:text-4xl">
            {name}
          </h1>
          {sports.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {sports.map((s) => (
                <Badge key={s.id}>{s.name}</Badge>
              ))}
            </div>
          )}
          <CoachClubs clubs={clubs} />
          {bio && <p className="text-muted-foreground mt-3 max-w-xl">{bio}</p>}
          {rating && rating.count > 0 && (
            <div className="mt-3 flex items-center justify-center gap-2 sm:justify-start">
              <StarRating value={rating.avg} size={18} />
              <span className="text-muted-foreground text-sm">
                {rating.avg.toFixed(1)} · {rating.count}{' '}
                {rating.count === 1 ? 'evaluare' : 'evaluări'}
              </span>
            </div>
          )}
          {myRating}
        </div>
      </Card>
    </section>
  )
}
