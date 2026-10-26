import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCheckoutCamp, type EnrollmentKind, type PaymentMethod } from '@/api/checkout'
import { getActivity, getCourse } from '@/api/public'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import CheckoutWizard from './checkout/CheckoutWizard'
import type { OfferingRules } from './checkout/CheckoutRulesConsent'
import {
  ACTIVITY_RULES_FILE_BUCKET,
  CAMP_RULES_FILE_BUCKET,
  COURSE_RULES_FILE_BUCKET,
  rulesFileAfisabil,
} from '@/api/camp-rules-file'
import { campRulesForDisplay } from '@/lib/camp-rules'
import { rulesFingerprint } from './checkout/checkout-acceptance'

const DEFAULT_PACKAGES = [5, 10, 20]

export interface Offering {
  id: string
  title: string
  perSession: boolean
  packages: number[]
  rules?: OfferingRules
  rulesFingerprint?: string
}

function parsePackages(raw: string | null): number[] {
  if (!raw) return DEFAULT_PACKAGES
  try {
    const parsed = JSON.parse(raw)
    const sizes = (Array.isArray(parsed) ? parsed : parsed?.sizes)
      ?.map((v: unknown) =>
        typeof v === 'number' ? v : Number((v as { sessions?: number })?.sessions),
      )
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

  const {
    data: offering,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['checkout-offering', kind, id, slug],
    queryFn: async (): Promise<Offering | null> => {
      if (kind === 'CAMP') {
        const camp = await getCheckoutCamp(id, slug)
        return camp
          ? {
              id: camp.id,
              title: camp.title,
              perSession: false,
              packages: [],
              rules: {
                text: campRulesForDisplay(camp.rules),
                file: rulesFileAfisabil(CAMP_RULES_FILE_BUCKET, camp),
              },
              rulesFingerprint: await rulesFingerprint(camp.rules_file_storage_path, camp.rules),
            }
          : null
      }
      if (kind === 'ACTIVITY' && id) {
        const activity = await getActivity(id)
        return activity
          ? {
              id: activity.id,
              title: activity.name,
              perSession: false,
              packages: [],
              rules: { text: null, file: rulesFileAfisabil(ACTIVITY_RULES_FILE_BUCKET, activity) },
              rulesFingerprint: await rulesFingerprint(activity.rules_file_storage_path, null),
            }
          : null
      }
      if (kind === 'COURSE' && id) {
        const course = await getCourse(id)
        return course
          ? {
              id: course.id,
              title: course.name,
              perSession: true,
              packages: parsePackages(course.package_options),
              rules: { text: null, file: rulesFileAfisabil(COURSE_RULES_FILE_BUCKET, course) },
              rulesFingerprint: await rulesFingerprint(course.rules_file_storage_path, null),
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
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }
  if (isError) {
    return (
      <StatusView
        state="error"
        title="Nu am putut încărca oferta."
        text="Verifică conexiunea și încearcă din nou."
        onRetry={() => void refetch()}
        className="mx-auto max-w-lg"
      />
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
    <CheckoutWizard
      key={`${kind}:${offering.id}`}
      kind={kind}
      offering={offering}
      initialMethod={readMethod(params.get('payment'))}
    />
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
