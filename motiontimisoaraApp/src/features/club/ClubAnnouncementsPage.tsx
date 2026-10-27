import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { getClubAnnouncements, getClubAudiences, getMyClub } from '@/api/club'
import { getAtasamente } from '@/api/attachments'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'
import AnnouncementComposeForm from './announcements/AnnouncementComposeForm'
import { ClubAnnouncementList } from './announcements/ClubAnnouncementList'

export default function ClubAnnouncementsPage() {
  const qc = useQueryClient()
  const [composing, setComposing] = useState(false)
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
  const canCompose = !!club
  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="font-display text-foreground text-2xl font-bold">
          Anunțuri
          {!!items.length && (
            <span className="text-muted-foreground ml-2 text-base font-normal">
              ({items.length})
            </span>
          )}
        </h1>
        {canCompose && !composing && (
          <Button
            className="h-touch-target min-h-touch-target w-full md:w-auto"
            onClick={() => setComposing(true)}
          >
            <Plus aria-hidden="true" /> Anunț nou
          </Button>
        )}
      </div>

      {canCompose && composing && (
        <AnnouncementComposeForm
          clubId={clubId}
          audiences={tinteActive}
          onPublished={() => {
            invalideaza()
            setComposing(false)
          }}
          onCancel={() => setComposing(false)}
        />
      )}

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
          action={
            composing ? null : (
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-touch-target min-h-touch-target"
                onClick={() => setComposing(true)}
              >
                Scrie primul anunț
              </Button>
            )
          }
        />
      )}
    </div>
  )
}
