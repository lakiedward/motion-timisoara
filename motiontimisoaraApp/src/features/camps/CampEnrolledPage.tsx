import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'

import { getInscrisiiTaberei } from '@/api/camp-enrolled'
import { campRulesFileAfisabil } from '@/api/camp-rules-file'
import { getTabaraDeEditat } from '@/api/camps-admin'
import { formatZi } from '@/api/camps'
import CampRulesDisplay from '@/components/camps/CampRulesDisplay'
import { plural } from '@/lib/plural'
import { Button } from '@/components/ui/button'
import {
  CampArrivalOnCard,
  CampLocationShare,
} from '@/features/live-location/camps/CampParticipationPanel'
import { useCampStaffParticipation } from '@/features/live-location/camps/useCampStaffParticipation'
import type { CampPortalBaza } from './camp-portal'
import EnrolledList from './enrolled/EnrolledList'

export default function CampEnrolledPage({ baza }: { baza: CampPortalBaza }) {
  const { id } = useParams()
  const campId = id as string

  const { data: tabara } = useQuery({
    queryKey: ['tabara-de-editat', campId],
    queryFn: () => getTabaraDeEditat(campId),
  })

  const {
    data: inscrisi = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['inscrisii-taberei', campId],
    queryFn: () => getInscrisiiTaberei(campId),
  })

  const sosire = useCampStaffParticipation(campId)
  const participanti = sosire.participants.data
  const poateConfirma = (participanti?.participants.length ?? 0) > 0

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to={baza}
        className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi la tabere
      </Link>

      <h1 className="font-display mt-2 text-2xl font-bold">Cine s-a înscris</h1>
      {tabara && (
        <p className="text-muted-foreground mt-1 text-sm">
          {tabara.title} · {formatZi(tabara.period_start)} – {formatZi(tabara.period_end)}
        </p>
      )}
      {tabara && <CampRulesDisplay rules={tabara.rules} fisier={campRulesFileAfisabil(tabara)} />}

      <CampLocationShare
        campId={campId}
        actorId={sosire.userId}
        canShare={!!participanti?.canShare}
        startsAt={participanti?.startsAt}
        endsAt={participanti?.endsAt}
      />

      {sosire.staff && sosire.participants.isError && (
        <div role="alert" className="mt-6 space-y-2">
          <p className="text-destructive text-sm">
            {sosire.participants.error instanceof Error
              ? sosire.participants.error.message
              : 'Nu am putut încărca prezența.'}
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11"
            onClick={() => void sosire.participants.refetch()}
          >
            Reîncearcă prezența
          </Button>
        </div>
      )}

      {isError ? (
        <div className="py-16 text-center" role="alert">
          <p className="text-foreground font-medium">Nu am putut încărca lista.</p>
          <Button type="button" className="mt-4 h-11 min-h-11" onClick={() => void refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : isLoading ? (
        <p className="text-muted-foreground mt-8 text-sm">Se încarcă…</p>
      ) : inscrisi.length === 0 ? (
        <div className="mt-8 rounded-2xl border p-8 text-center">
          <p className="text-foreground font-medium">Niciun participant înscris încă.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Aici apar copiii și adulții pe măsură ce părinții îi înscriu, inclusiv cei cu plata în
            curs.
          </p>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground mt-6 text-sm">
            {plural(inscrisi.length, 'participant înscris', 'participanți înscriși')}
            {tabara?.capacity ? ` din ${plural(tabara.capacity, 'loc', 'locuri')}` : ''}.
          </p>

          {sosire.staff && poateConfirma && (
            <p className="text-muted-foreground mt-4 text-sm">
              Confirmă sosirea pe cardul copilului, o singură dată. Părintele poate vedea locația în
              Anunțuri când antrenorul o pornește. Plecarea închide accesul pentru acest copil.
            </p>
          )}
          {sosire.mutation.isError && (
            <p role="alert" className="text-destructive mt-4 text-sm">
              {sosire.mutation.error.message}
            </p>
          )}

          <EnrolledList
            inscrisi={inscrisi}
            ziuaTaberei={tabara?.period_start ?? null}
            baza={baza}
            sosire={(c) => (
              <CampArrivalOnCard
                nume={c.nume}
                participant={sosire.byEnrollment.get(c.enrollmentId) ?? null}
                pending={sosire.mutation.isPending}
                confirmingDeparture={sosire.departure === c.enrollmentId}
                onArrive={() => {
                  sosire.mutation.reset()
                  sosire.mutation.mutate({ action: 'arrive', enrollmentId: c.enrollmentId })
                }}
                onAskDeparture={() => {
                  sosire.mutation.reset()
                  sosire.setDeparture(c.enrollmentId)
                }}
                onDepart={() =>
                  sosire.mutation.mutate({ action: 'depart', enrollmentId: c.enrollmentId })
                }
                onCancelDeparture={() => sosire.setDeparture(null)}
              />
            )}
          />
        </>
      )}
    </div>
  )
}
