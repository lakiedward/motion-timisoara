import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet'
import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { isNative } from '@/lib/platform'
import {
  basemapAttribution,
  cartoTileUrl,
  openStreetMapAttribution,
  openStreetMapTileUrl,
} from '@/features/public/map/basemap'
import {
  loadCompetitionGpx,
  publicCompetitionGpxUrl,
  type CompetitionGpx,
  type GpxPoint,
} from './competition-gpx'
import 'leaflet/dist/leaflet.css'

function FitRoute({ segments }: { segments: GpxPoint[][] }) {
  const map = useMap()
  const points = useMemo(() => segments.flat(), [segments])

  useEffect(() => {
    if (points.length === 1) {
      map.setView(points[0], 15)
    } else {
      map.fitBounds(points, { padding: [16, 16], maxZoom: 15 })
    }
  }, [map, points])

  return null
}

function RouteMapSurface({ routeLabel, gpx }: { routeLabel: string; gpx: CompetitionGpx }) {
  const cartoUrl = cartoTileUrl(import.meta.env.VITE_CARTO_BASEMAP_API_KEY)
  const tileUrl = cartoUrl ?? (!isNative() ? openStreetMapTileUrl : null)
  const tileAttribution = cartoUrl ? basemapAttribution : openStreetMapAttribution
  const [tileStatus, setTileStatus] = useState<'loading' | 'ready' | 'error'>(
    tileUrl ? 'loading' : 'error',
  )
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (tileStatus !== 'loading') return
    const timeout = window.setTimeout(() => setTileStatus('error'), 15_000)
    return () => window.clearTimeout(timeout)
  }, [tileStatus, attempt])

  return (
    <div className="space-y-3">
      {(!tileUrl || tileStatus === 'error') && (
        <div role="alert" className="bg-muted space-y-3 rounded-xl p-4 text-sm">
          <p>Fundalul hărții nu este disponibil momentan. Traseul GPX rămâne vizibil.</p>
          {tileUrl && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setTileStatus('loading')
                setAttempt((value) => value + 1)
              }}
            >
              Reîncearcă harta
            </Button>
          )}
        </div>
      )}
      {tileStatus === 'loading' && (
        <p role="status" className="text-muted-foreground text-sm">
          Se încarcă fundalul hărții…
        </p>
      )}
      <div
        role="region"
        aria-label={`Harta traseului ${routeLabel}`}
        className="relative z-0 h-64 overflow-hidden rounded-xl md:h-80"
      >
        <MapContainer
          key={attempt}
          center={gpx.segments[0][0]}
          zoom={13}
          scrollWheelZoom={false}
          className="h-full w-full"
          style={{ backgroundColor: 'var(--muted)' }}
        >
          {tileUrl && tileStatus !== 'error' && (
            <TileLayer
              url={tileUrl}
              attribution={tileAttribution}
              eventHandlers={{
                load: () => setTileStatus('ready'),
                tileerror: () => setTileStatus('error'),
              }}
            />
          )}
          {gpx.segments.map((segment, index) =>
            segment.length === 1 ? (
              <CircleMarker
                key={index}
                center={segment[0]}
                radius={5}
                pathOptions={{ color: 'var(--primary)' }}
              />
            ) : (
              <Polyline
                key={index}
                positions={segment}
                pathOptions={{ color: 'var(--primary)', weight: 4 }}
              />
            ),
          )}
          <FitRoute segments={gpx.segments} />
        </MapContainer>
      </div>
      <p className="text-muted-foreground text-xs">{gpx.pointCount} puncte pe traseu</p>
    </div>
  )
}

export function CompetitionRouteMap({
  routeLabel,
  gpxUrl,
  downloadUrl,
}: {
  routeLabel: string
  gpxUrl: string | null
  downloadUrl?: string | null
}) {
  const url = publicCompetitionGpxUrl(gpxUrl)
  const downloadHref = publicCompetitionGpxUrl(downloadUrl ?? null) ?? url
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['competition-gpx', url],
    queryFn: ({ signal }) => loadCompetitionGpx(url!, signal),
    enabled: Boolean(url),
    retry: false,
  })
  const filename = `${
    routeLabel
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'traseu'
  }.gpx`

  function downloadFile(event: MouseEvent<HTMLAnchorElement>) {
    if (!data || typeof URL.createObjectURL !== 'function') return
    event.preventDefault()
    const objectUrl = URL.createObjectURL(
      new Blob([data.xml], { type: 'application/gpx+xml;charset=utf-8' }),
    )
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-foreground font-medium">Traseul {routeLabel}</p>
        {url && (
          <Button asChild variant="outline" className="min-h-11">
            <a href={downloadHref ?? undefined} download={filename} onClick={downloadFile}>
              <Download aria-hidden="true" className="size-4" /> Descarcă GPX
            </a>
          </Button>
        )}
      </div>
      {!gpxUrl?.trim() ? (
        <p role="status" className="text-muted-foreground text-sm">
          Nu există fișier GPX pentru acest traseu.
        </p>
      ) : !url ? (
        <p role="alert" className="text-destructive text-sm">
          Adresa fișierului GPX nu este validă.
        </p>
      ) : isPending ? (
        <Skeleton className="h-64 w-full rounded-xl md:h-80" />
      ) : isError ? (
        <div role="alert" className="bg-muted space-y-3 rounded-xl p-4 text-sm">
          <p>Nu am putut afișa traseul GPX.</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void refetch()}
          >
            Reîncearcă traseul
          </Button>
        </div>
      ) : (
        <RouteMapSurface key={url} routeLabel={routeLabel} gpx={data} />
      )}
    </div>
  )
}
