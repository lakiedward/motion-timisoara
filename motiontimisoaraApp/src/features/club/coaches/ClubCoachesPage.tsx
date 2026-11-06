import { useQuery } from '@tanstack/react-query'

import { deleteClubCode, generateClubCode, getClubCodes, getMyClub } from '@/api/club'
import { StatusView } from '@/components/ui/status-view'
import InviteCodesSection from '@/components/invite-codes/InviteCodesSection'
import ClubCoachForm from './ClubCoachForm'
import ClubCoachList from './ClubCoachList'

export default function ClubCoachesPage() {
  const clubQuery = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = clubQuery.data?.id

  if (clubQuery.isError) {
    return (
      <StatusView
        state="error"
        title="Nu am putut încărca clubul."
        text="Verifică conexiunea și încearcă din nou."
        onRetry={() => void clubQuery.refetch()}
        retrying={clubQuery.isRefetching}
        className="max-w-3xl"
      />
    )
  }

  return (
    <div className="max-w-3xl space-y-8">
      <section aria-labelledby="club-coaches-heading">
        <h1
          id="club-coaches-heading"
          className="font-display mb-4 text-2xl font-bold text-foreground"
        >
          Antrenori
        </h1>
        <ClubCoachList clubId={clubId} />
      </section>
      <ClubCoachForm clubId={clubId} />
      <InviteCodesSection
        source={{
          queryKey: ['club-codes', clubId],
          enabled: !!clubId,
          load: () => getClubCodes(clubId!),
          generate: (maxUses, expiresAt) => generateClubCode(clubId!, maxUses, expiresAt),
          remove: deleteClubCode,
        }}
        title="Coduri de invitație"
        description="Un antrenor poate folosi codul pentru a se alătura clubului tău."
      />
    </div>
  )
}
