import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { getPublicClub } from '@/api/public'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ClubAbout } from './club-detail/ClubAbout'
import { ClubContact } from './club-detail/ClubContact'
import { ClubHero } from './club-detail/ClubHero'
import { ClubOffer } from './club-detail/ClubOffer'
import { useDocumentTitle } from '@/lib/page-title'
import { DetailNotFound } from '@/features/public/components/DetailNotFound'

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
  useDocumentTitle(club?.name, 'Cluburi')

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-20 text-center" role="alert">
        <p className="text-foreground font-medium">Nu am putut încărca clubul.</p>
        <Button className="mt-4 h-touch-target min-h-touch-target" type="button" onClick={() => refetch()}>
          Reîncearcă
        </Button>
      </div>
    )
  }
  if (!club) {
    return (
      <DetailNotFound
        title="Clubul nu a fost găsit."
        text="Linkul poate fi greșit sau clubul nu mai este disponibil. Poți alege alt club din listă."
        backTo="/cluburi"
        backLabel="Înapoi la cluburi"
      />
    )
  }

  return (
    <div>
      <ClubHero club={club} />
      <div className="mx-auto max-w-6xl px-6">
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <ClubAbout club={club} />
          <ClubContact club={club} />
        </div>
        <ClubOffer clubId={club.id} />
      </div>
    </div>
  )
}
