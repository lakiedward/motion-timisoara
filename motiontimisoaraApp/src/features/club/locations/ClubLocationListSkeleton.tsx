import { Skeleton } from '@/components/ui/skeleton'

export function ClubLocationListSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă locațiile">
      <div className="mb-4 space-y-2">
        <Skeleton className="h-touch-target rounded-md" />
        <div className="mb-3 flex gap-2 pb-1 md:pb-0">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-touch-target w-24 rounded-full lg:h-9" />
          ))}
        </div>
      </div>
      <div className="grid gap-3">
        <Skeleton className="h-5 w-20" />
        <div className="divide-y overflow-hidden rounded-xl border">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="box-content h-32 rounded-none sm:h-18" />
          ))}
        </div>
      </div>
    </div>
  )
}
