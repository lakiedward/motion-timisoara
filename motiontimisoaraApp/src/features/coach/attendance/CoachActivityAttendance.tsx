import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Users } from 'lucide-react'

import { getActivityMarkedCounts } from '@/api/attendance/activity-attendance'
import { getMyActivities, type CoachActivity } from '@/api/coach'
import { Badge } from '@/components/ui/badge'
import { StatusView } from '@/components/ui/status-view'
import { todayInBucharest } from '@/features/admin/activities/activity-overview'
import { ClubLocationListSkeleton } from '@/features/club/locations/ClubLocationListSkeleton'
import { ActivityRoster } from '@/features/coach/activities/ActivityRoster'
import { activityDateLine } from '@/features/coach/activities/coach-activity-overview'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'

export function CoachActivityAttendance() {
  const today = todayInBucharest()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['my-activities'],
    queryFn: getMyActivities,
    retry: false,
  })
  const list = useMemo(
    () =>
      data
        .filter((a) => a.enrolled > 0)
        .sort((x, y) => {
          const xPast = x.activity_date <= today
          const yPast = y.activity_date <= today
          if (xPast !== yPast) return xPast ? -1 : 1
          const order = x.activity_date.localeCompare(y.activity_date)
          return xPast ? -order : order
        }),
    [data, today],
  )
  const ids = list.map((a) => a.id)
  const { data: marks } = useQuery({
    queryKey: ['activity-marks', ids],
    queryFn: () => getActivityMarkedCounts(ids),
    enabled: ids.length > 0,
    retry: false,
  })

  if (isLoading) return <ClubLocationListSkeleton />
  if (isError && !data.length)
    return (
      <StatusView state="error" title="Nu am putut încărca activitățile." onRetry={() => refetch()} />
    )
  if (!list.length)
    return (
      <StatusView
        state="empty"
        title="Nicio activitate cu copii înscriși."
        text="Când părinții înscriu copii la activitățile tale, le pontezi aici."
      />
    )

  const sel = list.find((a) => a.id === selectedId) ?? list[0]
  const roster = (a: CoachActivity) => (
    <ActivityRoster
      activityId={a.id}
      opensOn={a.activity_date > today ? activityDateLine(a) : null}
    />
  )
  const groups = [
    { title: 'Azi și trecute', items: list.filter((a) => a.activity_date <= today) },
    { title: 'Următoare', items: list.filter((a) => a.activity_date > today) },
  ]

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
      <div className="min-w-0 space-y-3">
        {groups.map(
          ({ title, items }) =>
            items.length > 0 && (
              <section key={title} aria-label={title} className="space-y-2">
                <h2 className="text-muted-foreground pt-2 text-xs font-semibold tracking-wider uppercase">
                  {title} · {items.length}
                </h2>
                <ul className="bg-card divide-y overflow-hidden rounded-xl border">
                  {items.map((a) => {
                    const active = a.id === sel.id
                    const marked = marks?.get(a.id) ?? 0
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          aria-current={active ? 'true' : undefined}
                          onClick={() => setSelectedId(a.id)}
                          className={cn(
                            'relative flex min-h-16 w-full flex-col gap-1 px-4 py-3 text-left transition-colors',
                            'focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2',
                            active
                              ? 'bg-accent before:bg-primary before:absolute before:inset-y-0 before:left-0 before:w-1'
                              : 'hover:bg-muted/60',
                          )}
                        >
                          <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-display min-w-0 flex-1 font-bold wrap-anywhere line-clamp-2">
                              {a.name}
                            </span>
                            <Badge variant={marked === a.enrolled ? 'success' : 'outline'}>
                              {marked}/{a.enrolled} pontați
                            </Badge>
                          </span>
                          <span className="text-foreground text-sm">{activityDateLine(a)}</span>
                          <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <span className="inline-flex min-w-0 items-center gap-1 wrap-anywhere">
                              <MapPin aria-hidden="true" className="size-4 shrink-0" />
                              {a.location?.name ?? '—'}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users aria-hidden="true" className="size-4 shrink-0" />
                              {plural(a.enrolled, 'copil', 'copii')}
                            </span>
                          </span>
                        </button>
                        {active && <div className="border-t p-3 md:hidden">{roster(a)}</div>}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ),
        )}
      </div>
      <div className="hidden min-w-0 md:block">
        <div className="bg-card space-y-3 rounded-xl border px-4 pb-4">
          <h2 className="font-display text-foreground -mx-4 border-b px-4 py-3 font-bold">
            <span className="line-clamp-2 wrap-anywhere">{sel.name}</span>
            <span className="text-muted-foreground block text-sm font-normal">
              {activityDateLine(sel)}
            </span>
          </h2>
          {roster(sel)}
        </div>
      </div>
    </div>
  )
}
