import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'

import { getTaberelemele, getToateTaberele } from '@/api/camps-admin'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'
import { useAuth } from '@/lib/auth-context'
import { useProprietarTabere } from './useProprietarTabere'
import type { CampPortalBaza } from './camp-portal'
import CampInvitations from './CampInvitations'
import { CampFilterBar } from './list/CampFilterBar'
import { CampListSkeleton } from './list/CampListSkeleton'
import { CampRows } from './list/CampRows'
import {
  NO_FILTERS,
  filterCamps,
  hasFilters,
  statusCounts,
  type CampFilters,
} from './list/camp-list'

export default function CampsListPage({ baza }: { baza: CampPortalBaza }) {
  const { proprietar, gata, eroare, reincearca, eClub } = useProprietarTabere()
  const eAdmin = useAuth().user?.role === 'ADMIN'
  const [filters, setFilters] = useState<CampFilters>(NO_FILTERS)

  const {
    data: tabere = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: eAdmin
      ? ['taberele-toate']
      : ['taberele-mele', proprietar.clubId, proprietar.coachUserId],
    queryFn: () => (eAdmin ? getToateTaberele() : getTaberelemele(proprietar)),
    enabled: gata,
  })
  const visible = filterCamps(tabere, filters)

  return (
    <div>
      {!eClub && !eAdmin && <CampInvitations />}

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

      {eroare || (isError && !tabere.length) ? (
        <StatusView
          state="error"
          title="Nu am putut încărca taberele."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={eroare ? reincearca : isFetching ? undefined : () => void refetch()}
        />
      ) : !gata || isLoading ? (
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
            <CampRows camps={visible} baza={baza} />
          )}
        </>
      )}
    </div>
  )
}
