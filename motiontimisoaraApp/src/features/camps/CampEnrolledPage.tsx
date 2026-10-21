import { useState } from 'react'
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
import { StatusView } from '@/components/ui/status-view'
import {
  CampArrivalOnCard,
  CampLocationShare,
} from '@/features/live-location/camps/CampParticipationPanel'
import { useCampStaffParticipation } from '@/features/live-location/camps/useCampStaffParticipation'
import type { CampPortalBaza } from './camp-portal'
import { ParticipantFilterBar } from './enrolled/ParticipantFilterBar'
import { ParticipantRows } from './enrolled/ParticipantRows'
import {
  NO_PARTICIPANT_FILTERS,
  alertCounts,
  arrivalCounts,
  filterParticipants,
  groupByAge,
  hasParticipantFilters,
  type ParticipantFilters,
} from './enrolled/participant-list'

export default function CampEnrolledPage({ baza }: { baza: CampPortalBaza }) {
  const { id } = useParams()
  const campId = id as string
  const [filters, setFilters] = useState<ParticipantFilters>(NO_PARTICIPANT_FILTERS)

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
  const vizibili = filterParticipants(inscrisi, filters, sosire.byEnrollment)
  const ziuaTaberei = tabara?.period_start ?? null
  const grupuri = groupByAge(vizibili, ziuaTaberei)

  const arrival = (c: (typeof inscrisi)[number], className: string) => (
    <CampArrivalOnCard
      className={className}
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
      onDepart={() => sosire.mutation.mutate({ action: 'depart', enrollmentId: c.enrollmentId })}
      onCancelDeparture={() => sosire.setDeparture(null)}
    />
  )

  return (
    <div>
      <Link
        to={baza}
        className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi la tabere
      </Link>

      <h1 className="font-display text-foreground mt-2 text-2xl font-bold">
        Participanți
        {inscrisi.length > 0 && (
          <span className="text-muted-foreground ml-2 text-base font-normal">
            ({inscrisi.length}
            {tabara?.capacity ? ` din ${plural(tabara.capacity, 'loc', 'locuri')}` : ''})
          </span>
        )}
      </h1>
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

      <div className="mt-6">
        {isError ? (
          <StatusView
            state="error"
            title="Nu am putut încărca lista."
            text="Verifică conexiunea și încearcă din nou."
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <StatusView state="loading" title="Se încarcă participanții" rows={6} />
        ) : inscrisi.length === 0 ? (
          <StatusView
            state="empty"
            title="Niciun participant înscris încă."
            text="Aici apar copiii și adulții pe măsură ce părinții îi înscriu, inclusiv cei cu plata în curs."
          />
        ) : (
          <>
            {sosire.staff && poateConfirma && (
              <p className="text-muted-foreground mb-4 text-sm">
                Confirmă sosirea pe rândul copilului, o singură dată. Părintele poate vedea locația
                în Anunțuri când antrenorul o pornește. Plecarea închide accesul pentru acest copil.
              </p>
            )}
            {sosire.mutation.isError && (
              <p role="alert" className="text-destructive mb-4 text-sm">
                {sosire.mutation.error.message}
              </p>
            )}
            <ParticipantFilterBar
              filters={filters}
              alertCounts={alertCounts(inscrisi)}
              arrivalCounts={poateConfirma ? arrivalCounts(inscrisi, sosire.byEnrollment) : null}
              onChange={setFilters}
            />
            {!vizibili.length ? (
              <StatusView
                state="empty"
                title="Niciun participant pentru filtrele alese."
                text="Schimbă căutarea sau filtrele."
                action={
                  hasParticipantFilters(filters) ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-touch-target min-h-touch-target mt-3"
                      onClick={() => setFilters(NO_PARTICIPANT_FILTERS)}
                    >
                      Șterge filtrele
                    </Button>
                  ) : null
                }
              />
            ) : (
              <ParticipantRows
                groups={grupuri}
                ziuaTaberei={ziuaTaberei}
                baza={baza}
                sosire={(c) => arrival(c, 'space-y-2')}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
