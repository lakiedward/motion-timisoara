import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, CreditCard, GraduationCap, Plus, XCircle } from 'lucide-react'

import { useAuth } from '@/lib/auth-context'
import { getMyCoachStripeStatus, getMyCourses } from '@/api/coach'
import { Button } from '@/components/ui/button'

export default function CoachDashboard() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(/\s+/)[0]
  const {
    data: courses = [],
    isError,
    isSuccess,
  } = useQuery({
    queryKey: ['my-courses'],
    queryFn: getMyCourses,
    retry: false,
  })
  const active = courses.filter((c) => c.active).length
  const { data: stripe } = useQuery({
    queryKey: ['my-coach-stripe'],
    queryFn: getMyCoachStripeStatus,
    retry: false,
  })
  const stripeComplete = stripe?.onboardingComplete ?? false
  const stripeLabel = stripeComplete ? 'Configurat' : 'Neconfigurat'

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-foreground">
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
          {isError ? (
            <p
              role="alert"
              className="bg-card text-muted-foreground shadow-card rounded-3xl p-6 sm:col-span-2"
            >
              Nu am putut încărca cursurile.
            </p>
          ) : (
            <>
              <Stat value={courses.length} label="Cursuri" />
              <Stat value={active} label="Cursuri active" />
            </>
          )}
          <Link
            to="/coach/courses"
            className="bg-primary text-primary-foreground flex items-center justify-between rounded-3xl p-6 transition-transform hover:-translate-y-1"
          >
            <span className="font-display font-bold">Gestionează cursuri</span>
            <GraduationCap className="size-5" />
          </Link>
          <Link
            to="/coach/stripe"
            data-testid="coach-stat-stripe"
            aria-label={`Stripe, ${stripeLabel}`}
            className="bg-card shadow-card rounded-3xl p-6 transition-transform hover:-translate-y-1 sm:col-span-3"
          >
            <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-xl">
              <CreditCard className="size-5" />
            </span>
            <div className="font-display mt-4 text-lg font-bold">Plăți cu cardul</div>
            <div className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
              {stripeComplete ? (
                <>
                  <CheckCircle2 className="text-success size-5" /> Configurat
                </>
              ) : (
                <>
                  <XCircle className="text-muted-foreground size-5" /> Neconfigurat
                </>
              )}
            </div>
          </Link>
        </div>
        {isSuccess && courses.length === 0 ? (
          <p className="text-muted-foreground">Nu ai încă niciun curs.</p>
        ) : null}
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-card shadow-card rounded-3xl p-6">
      <div className="font-display text-3xl font-extrabold">{value}</div>
      <div className="text-muted-foreground text-sm">{label}</div>
    </div>
  )
}
