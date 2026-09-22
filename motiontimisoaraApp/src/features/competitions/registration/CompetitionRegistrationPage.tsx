import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Elements } from '@stripe/react-stripe-js'

import { getConcursPublic } from '@/api/competition/competitions'
import { getCompetitionCategories } from '@/api/competition/competition-offers'
import { stripePromise } from '@/lib/stripe'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CompetitionRegistrationForm } from './CompetitionRegistrationForm'

export default function CompetitionRegistrationPage() {
  const { slug = '' } = useParams()
  const competition = useQuery({
    queryKey: ['concurs-public', slug],
    queryFn: () => getConcursPublic(slug),
    retry: false,
  })
  const categories = useQuery({
    queryKey: ['competition-categories', competition.data?.id],
    queryFn: () => getCompetitionCategories(competition.data!.id),
    enabled: Boolean(competition.data?.id),
  })

  if (competition.isLoading || (competition.data && categories.isLoading)) {
    return <Skeleton className="h-72 w-full rounded-3xl" />
  }

  if (competition.isError || categories.isError) {
    return (
      <div role="alert" className="space-y-3 py-10 text-center">
        <p>Nu am putut încărca înscrierea la concurs.</p>
        <Button
          variant="outline"
          onClick={() => void (competition.isError ? competition.refetch() : categories.refetch())}
        >
          Reîncearcă
        </Button>
      </div>
    )
  }

  if (!competition.data) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p>Concursul nu a fost găsit.</p>
        <Link className="text-primary font-semibold" to="/concursuri">
          Vezi concursurile
        </Link>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <CompetitionRegistrationForm
        competition={competition.data}
        categories={categories.data ?? []}
      />
    </Elements>
  )
}
