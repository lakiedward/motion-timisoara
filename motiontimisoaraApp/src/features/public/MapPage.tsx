import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './map-popup.css'
import { getActivities, getCourses, getLocations } from '@/api/public'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { grupeazaInLocuri } from '@/lib/locuri'
import LocationMap from './map/LocationMap'

export default function MapPage() {
  const [params] = useSearchParams()
  const locationsQuery = useQuery({ queryKey: ['locations'], queryFn: getLocations })
  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: () => getCourses() })
  const activitiesQuery = useQuery({ queryKey: ['activities'], queryFn: getActivities })
  const locations = useMemo(() => {
    const counts = new Map<string, number>()
    for (const course of coursesQuery.data ?? []) {
      if (course.location_id)
        counts.set(course.location_id, (counts.get(course.location_id) ?? 0) + 1)
    }
    return grupeazaInLocuri(locationsQuery.data ?? [], counts)
  }, [locationsQuery.data, coursesQuery.data])
  const isError = locationsQuery.isError || coursesQuery.isError || activitiesQuery.isError
  const isLoading = locationsQuery.isPending || coursesQuery.isPending || activitiesQuery.isPending
  const isFetching =
    locationsQuery.isFetching || coursesQuery.isFetching || activitiesQuery.isFetching

  function retry() {
    void locationsQuery.refetch()
    void coursesQuery.refetch()
    void activitiesQuery.refetch()
  }

  return (
    <div>
      <section className="from-primary/8 to-background border-b bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <span className="eyebrow mb-3">Locații</span>
          <h1 className="font-display text-foreground text-4xl font-extrabold">Hartă</h1>
          <p className="text-muted-foreground mt-2">
            Descoperă locațiile programelor noastre, oriunde în lume.
          </p>
        </div>
      </section>
      <section
        aria-label="Hartă locații"
        data-section="motion-react:page:/harta:section:harta-locatii"
      >
        {isError ? (
          <div role="alert" className="px-6 py-16 text-center">
            <p className="text-foreground font-medium">
              Nu am putut încărca locațiile și ofertele lor.
            </p>
            <Button className="mt-4 min-h-11" onClick={retry} disabled={isFetching}>
              {isFetching ? 'Se reîncearcă…' : 'Reîncearcă'}
            </Button>
          </div>
        ) : isLoading ? (
          <div role="status" className="space-y-3 p-6">
            <p className="text-muted-foreground text-sm">Se încarcă locațiile și ofertele…</p>
            <Skeleton className="h-96 w-full" />
          </div>
        ) : locations.length === 0 ? (
          <p role="status" className="text-muted-foreground px-6 py-16 text-center">
            Momentan nu există locații disponibile pe hartă.
          </p>
        ) : (
          <LocationMap
            locations={locations}
            courses={coursesQuery.data ?? []}
            activities={activitiesQuery.data ?? []}
            focusId={params.get('location')}
          />
        )}
      </section>
    </div>
  )
}
