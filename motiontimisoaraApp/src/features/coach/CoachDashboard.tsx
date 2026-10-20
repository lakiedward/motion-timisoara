import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CreditCard,
  GraduationCap,
  LayoutList,
  Plus,
  RefreshCw,
  XCircle,
} from 'lucide-react'

import { useAuth } from '@/lib/auth-context'
import { getMyCoachStripeStatus, getMyCourses } from '@/api/coach'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { cn } from '@/lib/utils'

const linkCardClass = cn(
  'bg-card flex items-center gap-4 rounded-xl border p-6 transition-colors',
  'hover:border-primary/40 hover:bg-accent',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
)

export default function CoachDashboard() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(/\s+/)[0]
  const coursesQuery = useQuery({
    queryKey: ['my-courses'],
    queryFn: getMyCourses,
    retry: false,
  })
  const courses = coursesQuery.data ?? []
  const active = courses.filter((c) => c.active).length
  const stripeQuery = useQuery({
    queryKey: ['my-coach-stripe'],
    queryFn: getMyCoachStripeStatus,
    retry: false,
  })
  const stripeComplete = stripeQuery.data?.onboardingComplete ?? false
  const stripeLabel = stripeQuery.isPending
    ? 'se încarcă'
    : stripeQuery.isError
      ? 'Nu am putut verifica statusul'
      : stripeComplete
        ? 'Configurat'
        : 'Neconfigurat'

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold break-words text-foreground">
            Salut{firstName ? `, ${firstName}` : ''}!
          </h1>
          <p className="text-muted-foreground mt-1">Panoul tău de antrenor.</p>
        </div>
        <Button asChild className="h-11 min-h-11 w-full px-5 md:w-auto">
          <Link to="/coach/courses/new">
            <Plus /> Curs nou
          </Link>
        </Button>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {coursesQuery.isError ? (
            <Card
              role="alert"
              className="flex-row flex-wrap items-center justify-between gap-3 p-6 sm:col-span-2"
            >
              <p className="text-foreground">Nu am putut încărca cursurile.</p>
              <Button
                variant="outline"
                size="sm"
                disabled={coursesQuery.isFetching}
                onClick={() => void coursesQuery.refetch()}
              >
                <RefreshCw aria-hidden="true" />
                Reîncearcă
              </Button>
            </Card>
          ) : (
            <>
              <Stat
                icon={<LayoutList className="size-5" />}
                value={courses.length}
                label="Cursuri"
                pending={coursesQuery.isPending}
              />
              <Stat
                icon={<CircleCheck className="size-5" />}
                value={active}
                label="Cursuri active"
                pending={coursesQuery.isPending}
              />
            </>
          )}
          <Link
            to="/coach/courses"
            className="bg-primary text-primary-foreground flex items-center justify-between rounded-xl p-6 transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="font-display font-bold">Gestionează cursuri</span>
            <GraduationCap className="size-5" />
          </Link>
        </div>
        {coursesQuery.isSuccess && courses.length === 0 ? (
          <StatusView
            state="empty"
            className="py-8"
            title="Nu ai încă niciun curs."
            text="Adaugă primul curs cu „Curs nou”."
          />
        ) : null}
        <Link
          to="/coach/stripe"
          data-testid="coach-stat-stripe"
          aria-label={`Plăți cu cardul, ${stripeLabel}`}
          className={linkCardClass}
        >
          <span className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl">
            <CreditCard className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-bold">Plăți cu cardul</div>
            <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
              {stripeQuery.isPending ? (
                <Skeleton className="h-5 w-28" />
              ) : stripeQuery.isError ? (
                <>
                  <CircleAlert className="text-muted-foreground size-5" /> Nu am putut verifica
                  statusul
                </>
              ) : stripeComplete ? (
                <>
                  <CheckCircle2 className="text-success-ink size-5" /> Configurat
                </>
              ) : (
                <>
                  <XCircle className="text-muted-foreground size-5" /> Neconfigurat
                </>
              )}
            </div>
            {stripeQuery.isSuccess && !stripeComplete ? (
              <p className="text-muted-foreground mt-1 text-sm">
                Părinții vor putea plăti cursurile tale cu cardul.
              </p>
            ) : null}
          </div>
          <ChevronRight aria-hidden="true" className="text-muted-foreground size-5 shrink-0" />
        </Link>
      </div>
    </div>
  )
}

function Stat({
  icon,
  value,
  label,
  pending,
}: {
  icon: React.ReactNode
  value: number
  label: string
  pending: boolean
}) {
  return (
    <Card className="flex-row items-center gap-4 p-6" role="group" aria-label={label}>
      <span
        aria-hidden="true"
        className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl"
      >
        {icon}
      </span>
      <div className="min-w-0">
        {pending ? (
          <Skeleton role="status" aria-label={`Se încarcă: ${label}`} className="h-8 w-12" />
        ) : (
          <div className="font-display text-2xl font-extrabold">{value}</div>
        )}
        <div className="text-muted-foreground text-sm">{label}</div>
      </div>
    </Card>
  )
}
