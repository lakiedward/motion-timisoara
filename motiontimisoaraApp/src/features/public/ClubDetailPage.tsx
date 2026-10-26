import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { getPublicClub } from '@/api/public'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ClubAbout } from './club-detail/ClubAbout'
import { ClubContact } from './club-detail/ClubContact'
import { ClubHero } from './club-detail/ClubHero'
import { ClubOffer } from './club-detail/ClubOffer'

export default function ClubDetailPage() {
  const { id = '' } = useParams()
  const {
    data: club,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['club', id],
    queryFn: () => getPublicClub(id),
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Skeleton className="h-48 w-full rounded-3xl" />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-20 text-center" role="alert">
        <p className="text-foreground font-medium">Nu am putut încărca clubul.</p>
        <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => refetch()}>
          Reîncearcă
        </Button>
      </div>
    )
  }
  if (!club) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-20 text-center">
        <p className="text-muted-foreground">Clubul nu a fost găsit.</p>
        <Link
          to="/cluburi"
          className="text-primary mt-4 inline-flex h-11 items-center font-semibold"
        >
          ← Înapoi la cluburi
        </Link>
      </div>
    )
  }

  return (
    <div>
      <ClubHero club={club} />
      <div className="mx-auto max-w-5xl px-6">
        <div className="mt-8 grid gap-6 pb-10 lg:grid-cols-[1.6fr_1fr]">
          <ClubAbout club={club} />
          <ClubContact club={club} />
        </div>
        <ClubOffer clubId={club.id} />
      </div>
    </div>
  )
}
