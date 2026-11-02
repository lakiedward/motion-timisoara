import { useId, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ImagePlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  MAX_POZE_GALERIE,
  adaugaPozeGalerie,
  galleryQueryKey,
  getPozeGalerie,
  mutaPozaGalerie,
  stergePozaGalerie,
  type GalerieTinta,
  type PozaGalerie,
} from '@/api/photo-gallery'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { alegeDinGalerie, galeriaSeDeschideNativ } from '@/lib/galerie'
import { plural } from '@/lib/plural'
import { Checkbox } from '@/components/ui/checkbox'
import { GalleryPhotoCaption } from './GalleryPhotoCaption'

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3'

export function GalleryPhotosEditor({
  tinta,
  placeholder,
  stergereDescriere,
  onChanged,
}: {
  tinta: GalerieTinta
  placeholder: string
  stergereDescriere: string
  onChanged: () => void
}) {
  const consentId = useId()
  const [acord, setAcord] = useState(false)
  const [seLucreaza, setSeLucreaza] = useState(false)
  const [deSters, setDeSters] = useState<{ poza: PozaGalerie; index: number } | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const {
    data: poze = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: galleryQueryKey(tinta),
    queryFn: () => getPozeGalerie(tinta),
  })

  const sterge = useMutation({
    mutationFn: (poza: PozaGalerie) => stergePozaGalerie(tinta, poza),
    onSuccess: () => {
      toast.success('Poză ștearsă.')
      setDeSters(null)
      onChanged()
    },
    onError: () => toast.error('Nu am putut șterge poza.'),
  })

  const muta = useMutation({
    mutationFn: ({ index, directie }: { index: number; directie: -1 | 1 }) =>
      mutaPozaGalerie(tinta.tabel, poze, index, directie),
    onSuccess: onChanged,
    onError: () => toast.error('Nu am putut schimba ordinea.'),
  })

  const adauga = async (fisiere: File[]) => {
    if (!fisiere.length) return
    setSeLucreaza(true)
    try {
      const { adaugate, refuzate } = await adaugaPozeGalerie(tinta, fisiere, poze.length)
      if (adaugate) toast.success(`${plural(adaugate, 'poză adăugată', 'poze adăugate')}.`)
      for (const motiv of refuzate) toast.error(motiv)
      onChanged()
    } finally {
      setSeLucreaza(false)
    }
  }

  const dinGalerieNativa = async () => {
    setSeLucreaza(true)
    try {
      const alese = await alegeDinGalerie(MAX_POZE_GALERIE - poze.length)
      setSeLucreaza(false)
      await adauga(alese)
    } catch {
      setSeLucreaza(false)
      toast.error('Nu am putut deschide galeria.')
    }
  }

  const plina = poze.length >= MAX_POZE_GALERIE
  const ocupat = seLucreaza || muta.isPending || sterge.isPending

  const lista = isError ? (
    <div className="space-y-2 text-sm" role="alert">
      <p>Nu am putut încărca pozele.</p>
      <Button
        type="button"
        variant="outline"
        className="h-touch-target"
        onClick={() => void refetch()}
      >
        Reîncearcă
      </Button>
    </div>
  ) : isLoading ? (
    <div role="status" aria-label="Se încarcă pozele" className={GRID}>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="aspect-square w-full rounded-xl" />
      ))}
    </div>
  ) : poze.length > 0 ? (
    <ul className={GRID} aria-label="Pozele din galerie">
      {poze.map((p, i) => (
        <li key={p.id} className="bg-card overflow-hidden rounded-xl border">
          <img
            src={p.url}
            alt={p.caption || `Poza ${i + 1}`}
            className="aspect-square w-full object-cover"
          />
          <div className="space-y-1 p-2">
            <GalleryPhotoCaption
              tabel={tinta.tabel}
              poza={p}
              index={i}
              placeholder={placeholder}
              onSaved={onChanged}
            />
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                className="size-touch-target"
                disabled={i === 0 || ocupat}
                onClick={() => muta.mutate({ index: i, directie: -1 })}
                aria-label={`Mută poza ${i + 1} mai devreme`}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="size-touch-target"
                disabled={ocupat}
                onClick={() => setDeSters({ poza: p, index: i })}
                aria-label={`Șterge poza ${i + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="size-touch-target"
                disabled={i === poze.length - 1 || ocupat}
                onClick={() => muta.mutate({ index: i, directie: 1 })}
                aria-label={`Mută poza ${i + 1} mai târziu`}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <p role="status" className="text-muted-foreground text-sm">
      Nu există încă poze în galerie.
    </p>
  )

  return (
    <>
      {lista}
      <div className="bg-muted/50 space-y-3 rounded-xl border p-4">
        <label htmlFor={consentId} className="flex cursor-pointer items-start gap-3 text-sm">
          <Checkbox id={consentId} checked={acord} onChange={(e) => setAcord(e.target.checked)} />
          <span>
            Am acordul scris al părinților pentru fiecare copil care apare în pozele pe care le
            încarc acum.
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-touch-target"
            disabled={!acord || plina || ocupat}
            onClick={() =>
              galeriaSeDeschideNativ() ? void dinGalerieNativa() : input.current?.click()
            }
          >
            <ImagePlus className="size-4" aria-hidden="true" />
            {plina ? 'Galeria e plină' : seLucreaza ? 'Se urcă…' : 'Adaugă poze'}
          </Button>
          <span className="text-muted-foreground text-sm">
            {poze.length} din {MAX_POZE_GALERIE} poze
          </span>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const alese = Array.from(e.target.files ?? [])
          e.target.value = ''
          void adauga(alese)
        }}
      />
      <ConfirmDialog
        open={!!deSters}
        onOpenChange={(open) => !open && setDeSters(null)}
        title={`Ștergi poza ${(deSters?.index ?? 0) + 1}?`}
        description={stergereDescriere}
        confirmLabel="Șterge poza"
        destructive
        pending={sterge.isPending}
        onConfirm={() => deSters && sterge.mutate(deSters.poza)}
      />
    </>
  )
}
