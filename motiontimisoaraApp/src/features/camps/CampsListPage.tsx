import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'

import { getTaberelePeId, getTaberelemele } from '@/api/camps-admin'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'
import { useProprietarTabere } from './useProprietarTabere'
import type { CampPortalBaza } from './camp-portal'
import CampInvitations from './CampInvitations'
import { useCampInvitations } from './useCampInvitations'
import { CampFilterBar } from './list/CampFilterBar'
import { CampListSkeleton } from './list/CampListSkeleton'
import { CampRows } from './list/CampRows'
import {
  NO_FILTERS,
  acceptedInvitations,
  filterCamps,
  hasFilters,
  statusCounts,
  type CampFilters,
} from './list/camp-list'

export default function CampsListPage({ baza }: { baza: CampPortalBaza }) {
  const { proprietar, gata, eroare, reincearca, eClub } = useProprietarTabere()
  const eAntrenor = !eClub
  const [filters, setFilters] = useState<CampFilters>(NO_FILTERS)

  const invitations = useCampInvitations(eAntrenor)
  const accepted = acceptedInvitations(invitations.data ?? [])
  const invitedBy = Object.fromEntries(accepted.map((i) => [i.campId, i.invitatDe ?? '']))
  const invitedIds = accepted.map((i) => i.campId).sort()
  const invitedQuery = useQuery({
    queryKey: ['tabere-invitat', invitedIds],
    queryFn: () => getTaberelePeId(invitedIds),
    enabled: eAntrenor && invitedIds.length > 0,
  })

  const {
    data: proprii = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['taberele-mele', proprietar.clubId, proprietar.coachUserId],
    queryFn: () => getTaberelemele(proprietar),
    enabled: gata,
  })
  const tabere = [
    ...proprii,
    ...(invitedQuery.data ?? []).filter((t) => !proprii.some((p) => p.id === t.id)),
  ]
  const visible = filterCamps(tabere, filters)

  return (
    <div>
      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-foreground text-2xl font-bold">
          Tabere
          {tabere.length > 0 && (
            <span className="text-muted-foreground ml-2 text-base font-normal">
              ({tabere.length})
            </span>
          )}
        </h1>
        <Button asChild className="h-touch-target min-h-touch-target">
          <Link to={`${baza}/new`}>
            <Plus aria-hidden="true" /> Tabără nouă
          </Link>
        </Button>
      </div>

      {eAntrenor && <CampInvitations />}

      {eroare || ((isError || invitedQuery.isError || invitations.isError) && !tabere.length) ? (
        <StatusView
          state="error"
          title="Nu am putut încărca taberele."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={
            eroare
              ? reincearca
              : isFetching || invitedQuery.isFetching || invitations.isFetching
                ? undefined
                : () => {
                    void refetch()
                    void invitedQuery.refetch()
                    void invitations.refetch()
                  }
          }
        />
      ) : !gata || isLoading || invitedQuery.isLoading || (eAntrenor && invitations.isLoading) ? (
        <CampListSkeleton />
      ) : !tabere.length ? (
        <StatusView
          state="empty"
          title="Nicio tabără încă."
          text="Prima tabără are nevoie de titlu, perioadă și preț. Categoriile, antrenorii și pozele se adaugă după."
          action={
            <Button asChild className="mt-3 h-touch-target min-h-touch-target">
              <Link to={`${baza}/new`}>
                <Plus aria-hidden="true" /> Creează prima tabără
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <CampFilterBar
            filters={filters}
            statusCounts={statusCounts(tabere)}
            onChange={setFilters}
          />
          {!visible.length ? (
            <StatusView
              state="empty"
              title="Nicio tabără pentru filtrele alese."
              text="Schimbă căutarea sau filtrele."
              action={
                hasFilters(filters) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-touch-target min-h-touch-target"
                    onClick={() => setFilters(NO_FILTERS)}
                  >
                    Șterge filtrele
                  </Button>
                ) : null
              }
            />
          ) : (
            <CampRows camps={visible} baza={baza} invitedBy={invitedBy} />
          )}
        </>
      )}
    </div>
  )
}
