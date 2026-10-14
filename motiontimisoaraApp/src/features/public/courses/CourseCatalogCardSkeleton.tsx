import { Skeleton } from '@/components/ui/skeleton'

export function CourseCatalogCardSkeleton() {
  return (
    <div className="bg-card flex h-full flex-col rounded-xl border">
      <Skeleton className="aspect-video w-full rounded-none rounded-t-xl" />
      <div className="flex flex-1 flex-col p-5">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="mt-1 h-5 w-1/2" />
        <div className="mt-3 space-y-1">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-5 w-3/5" />
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
    </div>
  )
}
