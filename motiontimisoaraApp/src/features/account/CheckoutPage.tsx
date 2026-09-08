import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Elements } from '@stripe/react-stripe-js'
import { getCheckoutCamp, type EnrollmentKind, type PaymentMethod } from '@/api/checkout'
import { getActivity, getCourse } from '@/api/public'
import { stripePromise } from '@/lib/stripe'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import CheckoutWizard from './checkout/CheckoutWizard'

const DEFAULT_PACKAGES = [5, 10, 20]


export interface Offering {
  id: string
  title: string
  unitPrice: number
  perSession: boolean
  packages: number[]
}

function parsePackages(raw: string | null): number[] {
  if (!raw) return DEFAULT_PACKAGES
  try {
    const parsed = JSON.parse(raw)
    const sizes = (Array.isArray(parsed) ? parsed : parsed?.sizes)
      ?.map((v: unknown) => (typeof v === 'number' ? v : Number((v as { sessions?: number })?.sessions)))
      ?.filter((n: number) => Number.isFinite(n) && n > 0)
    return sizes?.length ? sizes : DEFAULT_PACKAGES
  } catch {
    return DEFAULT_PACKAGES
  }
}

export default function CheckoutPage() {
  const [params] = useSearchParams()
  const kind = (params.get('kind') ?? 'COURSE').toUpperCase() as EnrollmentKind
  const id = params.get('id')
  const slug = params.get('slug')

  const { data: offering, isLoading, isError, refetch } = useQuery({
    queryKey: ['checkout-offering', kind, id, slug],
    queryFn: async (): Promise<Offering | null> => {
      if (kind === 'CAMP') {
        const camp = await getCheckoutCamp(id, slug)
        return camp
          ? { id: camp.id, title: camp.title, unitPrice: Number(camp.price) || 0, perSession: false, packages: [] }
          : null
      }
      if (kind === 'ACTIVITY' && id) {
        const activity = await getActivity(id)
        return activity
          ? { id: activity.id, title: activity.name, unitPrice: Number(activity.price) || 0, perSession: false, packages: [] }
          : null
      }
      if (kind === 'COURSE' && id) {
        const course = await getCourse(id)
        return course
          ? {
              id: course.id,
              title: course.name,
              unitPrice: Number(course.price_per_session) || 0,
              perSession: true,
              packages: parsePackages(course.package_options),
            }
          : null
      }
      return null
    },
    enabled: Boolean(id || slug),
  })

  if (!id && !slug) {
    return (
      <Invalid
        title="Alege mai întâi un curs"
        message="Ca să te înscrii, deschide un curs, o activitate sau o tabără și apasă butonul de înscriere."
      />
    )
  }
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    )
  }
  if (isError) {
    return (
      <div role="alert" className="mx-auto max-w-lg space-y-4 py-10 text-center">
        <p>Nu am putut încărca oferta. Încearcă din nou.</p>
        <Button variant="outline" onClick={() => void refetch()}>Reîncearcă</Button>
      </div>
    )
  }
  if (!offering) {
    return (
      <Invalid
        title="Nu am găsit acest program"
        message="Poate a fost șters sau linkul e greșit. Caută altul din listă."
      />
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <CheckoutWizard kind={kind} offering={offering} initialMethod={readMethod(params.get('payment'))} />
    </Elements>
  )
}

function readMethod(raw: string | null): PaymentMethod {
  return raw?.toUpperCase() === 'CASH' ? 'CASH' : 'CARD'
}

function Invalid({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-lg py-10 text-center sm:py-16">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <p className="text-muted-foreground mt-3 text-base leading-relaxed">{message}</p>
      <Button asChild size="lg" className="mt-8">
        <Link to="/cursuri">Vezi cursurile</Link>
      </Button>
    </div>
  )
}
