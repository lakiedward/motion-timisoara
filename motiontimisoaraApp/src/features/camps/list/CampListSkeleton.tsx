import { Skeleton } from '@/components/ui/skeleton'

export function CampListSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă taberele">
      <div className="mb-4 space-y-2">
        <Skeleton className="h-touch-target rounded-md" />
        <div className="mb-3 flex gap-2 pb-1 md:pb-0">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-touch-target w-28 rounded-full lg:h-9" />
          ))}
        </div>
      </div>
      <div className="grid gap-3">
        <Skeleton className="h-5 w-32" />
        <div className="divide-y overflow-hidden rounded-xl border">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-none md:h-28" />
          ))}
        </div>
      </div>
    </div>
  )
}
