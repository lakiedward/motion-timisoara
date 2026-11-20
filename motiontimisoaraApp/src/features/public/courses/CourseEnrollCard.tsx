import { Link } from 'react-router-dom'

import { OfferExchangeNote } from '@/components/OfferExchangeNote'
import { StarRating } from '@/components/StarRating'
import { Skeleton } from '@/components/ui/skeleton'
import { cheapestPerSession, type CoursePackage } from '@/lib/course-packages/course-packages'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { CoursePackagesOffer } from './CoursePackagesOffer'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

type EnrollCourse = {
  price_per_session: number
  currency: string
  eur_ron_rate_micros?: number | null
}

export function CourseEnrollCard({
  course,
  isFull,
  canEnroll,
  onEnroll,
  rating,
  showMyRating,
  myRating,
  onRate,
  packages = [],
  packagesPending = false,
}: {
  course: EnrollCourse
  isFull: boolean
  canEnroll: boolean
  onEnroll: () => void
  rating?: { avg: number; count: number } | null
  showMyRating: boolean
  myRating: number
  onRate: (value: number) => void
  packages?: CoursePackage[]
  packagesPending?: boolean
}) {
  const withPackages = packages.length > 0
  const free = !withPackages && course.price_per_session === 0

  return (
    <div
      data-section="course-enroll"
      className="bg-card flex flex-col items-center rounded-xl border p-6 text-center"
    >
      {packagesPending ? (
        <Skeleton className="h-9 w-48" aria-label="Se încarcă prețul" />
      ) : (
        <div className="font-display text-foreground text-3xl font-extrabold">
          {withPackages && (
            <span className="text-muted-foreground text-base font-normal">de la </span>
          )}
          {free
            ? 'Gratuit'
            : formatMoney(
                withPackages ? cheapestPerSession(packages) : course.price_per_session,
                course.currency,
              )}
          {!free && <span className="text-muted-foreground text-base font-normal"> / ședință</span>}
        </div>
      )}
      {!free && !packagesPending && (
        <p className="text-muted-foreground mt-1 text-sm">Alegi pachetul la înscriere</p>
      )}
      {withPackages && <CoursePackagesOffer packages={packages} currency={course.currency} />}
      <OfferExchangeNote offer={course} className="text-xs" />

      {canEnroll ? (
        <>
          <button
            type="button"
            onClick={onEnroll}
            disabled={isFull}
            className={cn(
              'btn-cta btn-cta--primary mt-5 w-full',
              isFull && 'pointer-events-none opacity-50',
            )}
          >
            {isFull ? 'Locuri epuizate' : 'Înscrie-te'}
          </button>
          {isFull ? (
            <Link
              to="/cursuri"
              className={`text-primary min-h-touch-target mt-2 inline-flex items-center rounded-sm text-sm font-semibold underline-offset-2 hover:underline ${FOCUS_RING}`}
            >
              Vezi alte cursuri
            </Link>
          ) : free ? null : (
            <p className="text-muted-foreground mt-3 text-xs">
              Plătești la înscriere un pachet de ședințe, online sau cash.
            </p>
          )}
        </>
      ) : (
        <p className="text-muted-foreground bg-muted mt-5 w-full rounded-lg px-4 py-3 text-sm">
          Înscrierile se fac dintr-un cont de părinte.
        </p>
      )}

      {rating && rating.count > 0 && (
        <div className="mt-5 flex w-full flex-col items-center gap-2 border-t pt-4">
          <StarRating value={rating.avg} size={18} />
          <span className="text-muted-foreground text-sm">
            {rating.avg.toFixed(1)} · {rating.count} {rating.count === 1 ? 'evaluare' : 'evaluări'}
          </span>
        </div>
      )}
      {showMyRating && (
        <div className="mt-4 w-full border-t pt-4">
          <p className="text-muted-foreground mb-1.5 text-sm font-medium">Nota ta</p>
          <div className="flex justify-center">
            <StarRating value={myRating} onChange={onRate} />
          </div>
        </div>
      )}
    </div>
  )
}
