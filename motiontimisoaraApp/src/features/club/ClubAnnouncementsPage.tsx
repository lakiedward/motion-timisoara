import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getClubAnnouncements, getClubAudiences, getMyClub } from '@/api/club'
import { getAtasamente } from '@/api/attachments'
import { StatusView } from '@/components/ui/status-view'
import AnnouncementComposeForm from './announcements/AnnouncementComposeForm'
import { ClubAnnouncementList } from './announcements/ClubAnnouncementList'
export default function ClubAnnouncementsPage() {
  const qc = useQueryClient()
  const {
    data: club,
    isPending: seIncarcaClubul,
    isError: aEsuatClubul,
    refetch: reincarcaClubul,
  } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id ?? ''
  const {
    data: items = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['club-announcements', clubId],
    queryFn: () => getClubAnnouncements(clubId),
    enabled: !!clubId,
    retry: false,
  })
  const { data: tinte = [], isError: aEsuatTintele } = useQuery({
    queryKey: ['club-audiences', clubId],
    queryFn: () => getClubAudiences(clubId),
    enabled: !!clubId,
  })
  const tinteActive = tinte.filter((t) => t.active)
  const aEsuatIncarcarea = aEsuatClubul || (isError && !items.length)
  const reincearca = () => (aEsuatClubul ? reincarcaClubul() : refetch())
  const { data: atasamente = {} } = useQuery({
    queryKey: ['club-announcement-media', items.map((a) => a.id).join(',')],
    queryFn: () => getAtasamente(items.map((a) => a.id)),
    enabled: items.length > 0,
  })
  const invalideaza = () => {
    qc.invalidateQueries({ queryKey: ['club-announcements', clubId] })
    qc.invalidateQueries({ queryKey: ['club-announcement-media'] })
  }
  return (
    <div className="max-w-2xl">
      <h1 className="font-display mb-6 text-2xl font-bold text-foreground">
        Anunțuri
        {!!items.length && (
          <span className="text-muted-foreground ml-2 text-base font-normal">({items.length})</span>
        )}
      </h1>

      <AnnouncementComposeForm clubId={clubId} audiences={tinteActive} onPublished={invalideaza} />

      {seIncarcaClubul || isLoading ? (
        <StatusView state="loading" title="Se încarcă anunțurile" rows={2} rowHeight={160} />
      ) : aEsuatIncarcarea ? (
        <StatusView
          state="error"
          title="Nu am putut încărca anunțurile."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={() => void reincearca()}
        />
      ) : !club ? (
        <StatusView state="empty" title="Niciun club asociat contului." />
      ) : items.length ? (
        <ClubAnnouncementList
          items={items}
          tinte={tinte}
          tinteNecunoscute={aEsuatTintele}
          atasamente={atasamente}
          onChanged={invalideaza}
        />
      ) : (
        <StatusView
          state="empty"
          title="Niciun anunț încă."
          text="Anunțurile pe care le publici apar aici, iar părinții le văd în contul lor."
        />
      )}
    </div>
  )
}
