import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ImagePlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  MAX_COMPETITION_ROUTE_PHOTOS,
  addCompetitionRoutePhotos,
  deleteCompetitionRoutePhoto,
  listCompetitionRoutePhotos,
  moveCompetitionRoutePhoto,
} from '@/api/competition/competition-route-photos'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { alegeDinGalerie, galeriaSeDeschideNativ } from '@/lib/galerie'

export function CompetitionRouteGalleryEditor({
  competitionId,
  routeId,
  routeName,
}: {
  competitionId: string
  routeId: string
  routeName: string
}) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const photosQuery = useQuery({
    queryKey: ['competition-route-photos', competitionId],
    queryFn: () => listCompetitionRoutePhotos(competitionId),
  })
  const photos = (photosQuery.data ?? []).filter((photo) => photo.route_id === routeId)
  const full = photos.length >= MAX_COMPETITION_ROUTE_PHOTOS

  async function refreshPhotos() {
    await queryClient.invalidateQueries({ queryKey: ['competition-route-photos', competitionId] })
  }

  async function addPhotos(files: File[]) {
    if (!files.length) return
    setBusy(true)
    try {
      const result = await addCompetitionRoutePhotos(competitionId, routeId, files, photos.length)
      if (result.added)
        toast.success(result.added === 1 ? 'Poză adăugată.' : `${result.added} poze adăugate.`)
      for (const reason of result.rejected) toast.error(reason)
      await refreshPhotos()
    } catch {
      toast.error('Nu am putut adăuga pozele traseului.')
    } finally {
      setBusy(false)
    }
  }

  async function pickNativePhotos() {
    setBusy(true)
    try {
      const files = await alegeDinGalerie(MAX_COMPETITION_ROUTE_PHOTOS - photos.length)
      await addPhotos(files)
    } catch {
      toast.error('Nu am putut deschide galeria.')
    } finally {
      setBusy(false)
    }
  }

  async function deletePhoto(index: number) {
    const photo = photos[index]
    if (!photo) return
    setBusy(true)
    try {
      const result = await deleteCompetitionRoutePhoto(photo)
      if (result.cleanupFailed) {
        toast.warning('Poza a fost scoasă din galerie, dar fișierul nu a putut fi curățat.')
      } else {
        toast.success('Poză ștearsă.')
      }
    } catch {
      toast.error('Nu am putut șterge poza.')
    } finally {
      await refreshPhotos()
      setBusy(false)
    }
  }

  async function movePhoto(index: number, direction: -1 | 1) {
    setBusy(true)
    try {
      await moveCompetitionRoutePhoto(photos, index, direction)
    } catch {
      toast.error('Nu am putut schimba ordinea pozelor.')
    } finally {
      await refreshPhotos()
      setBusy(false)
    }
  }

  return (
    <section aria-label={`Galeria traseului ${routeName}`} className="space-y-3 border-t pt-4">
      <div>
        <h4 className="font-semibold">Galerie foto</h4>
        <p className="text-muted-foreground text-xs">
          Adaugă până la {MAX_COMPETITION_ROUTE_PHOTOS} poze pentru acest traseu. Se micșorează
          înainte de încărcare.
        </p>
      </div>

      {photosQuery.isPending ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : photosQuery.isError ? (
        <div role="alert" className="space-y-2 text-sm">
          <p>Nu am putut încărca pozele traseului.</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void photosQuery.refetch()}
          >
            Reîncearcă
          </Button>
        </div>
      ) : (
        <>
          {photos.length ? (
            <ul
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              aria-label={`Pozele traseului ${routeName}`}
            >
              {photos.map((photo, index) => (
                <li key={photo.id} className="overflow-hidden rounded-xl border bg-card">
                  <img
                    src={photo.url}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  <div className="flex items-center justify-between p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-11 min-h-11"
                      disabled={busy || index === 0}
                      onClick={() => void movePhoto(index, -1)}
                      aria-label={`Mută poza ${index + 1} mai devreme`}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-11 min-h-11"
                      disabled={busy}
                      onClick={() => void deletePhoto(index)}
                      aria-label={`Șterge poza ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-11 min-h-11"
                      disabled={busy || index === photos.length - 1}
                      onClick={() => void movePhoto(index, 1)}
                      aria-label={`Mută poza ${index + 1} mai târziu`}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="text-muted-foreground text-sm">
              Nu există încă poze pentru acest traseu.
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy || full}
            onClick={() =>
              galeriaSeDeschideNativ() ? void pickNativePhotos() : inputRef.current?.click()
            }
          >
            <ImagePlus aria-hidden="true" className="size-4" />
            {full ? 'Galeria e plină' : 'Adaugă poze'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ''
              void addPhotos(files)
            }}
          />
        </>
      )}
    </section>
  )
}
