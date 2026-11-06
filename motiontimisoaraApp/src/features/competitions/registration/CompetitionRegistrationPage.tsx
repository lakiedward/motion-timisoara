import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { getConcursPublic } from '@/api/competition/competitions'
import { getCompetitionCategories } from '@/api/competition/competition-offers'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
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
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (competition.isError || categories.isError) {
    return (
      <StatusView
        state="error"
        title="Nu am putut încărca înscrierea la concurs."
        text="Verifică conexiunea și încearcă din nou."
        onRetry={() => void (competition.isError ? competition.refetch() : categories.refetch())}
        className="mx-auto max-w-lg"
      />
    )
  }

  if (!competition.data) {
    return (
      <StatusView
        state="empty"
        title="Concursul nu a fost găsit."
        text="Poate a fost șters sau linkul e greșit."
        action={
          <Button asChild className="mt-3 h-touch-target min-h-touch-target">
            <Link to="/concursuri">Vezi concursurile</Link>
          </Button>
        }
        className="mx-auto max-w-lg"
      />
    )
  }

  return (
    <CompetitionRegistrationForm
      competition={competition.data}
      categories={categories.data ?? []}
    />
  )
}
