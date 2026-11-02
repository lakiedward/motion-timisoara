import { useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ImagePlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  MAX_POZE_CURS,
  adaugaPozeCurs,
  getPozeleCursului,
  mutaPozaCurs,
  stergePozaCurs,
  type PozaCursCuUrl,
} from '@/api/course-photos'
import { FormSection } from '@/components/FormSection'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { alegeDinGalerie, galeriaSeDeschideNativ } from '@/lib/galerie'
import { plural } from '@/lib/plural'
import { CoursePhotoCaption } from './CoursePhotoCaption'

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3'

export default function CoursePhotosSection({ courseId }: { courseId: string | null }) {
  const qc = useQueryClient()
  const consentId = useId()
  const [acord, setAcord] = useState(false)
  const [seLucreaza, setSeLucreaza] = useState(false)
  const [deSters, setDeSters] = useState<{ poza: PozaCursCuUrl; index: number } | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const {
    data: poze = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['pozele-cursului', courseId],
    queryFn: () => getPozeleCursului(courseId as string),
    enabled: !!courseId,
  })

  const reimprospateaza = () => {
    qc.invalidateQueries({ queryKey: ['pozele-cursului', courseId] })
    qc.invalidateQueries({ queryKey: ['course', courseId] })
  }

  const sterge = useMutation({
    mutationFn: (poza: PozaCursCuUrl) => stergePozaCurs(poza),
    onSuccess: () => {
      toast.success('Poză ștearsă.')
      setDeSters(null)
      reimprospateaza()
    },
    onError: () => toast.error('Nu am putut șterge poza.'),
  })

  const muta = useMutation({
    mutationFn: ({ index, directie }: { index: number; directie: -1 | 1 }) =>
      mutaPozaCurs(poze, index, directie),
    onSuccess: reimprospateaza,
    onError: () => toast.error('Nu am putut schimba ordinea.'),
  })

  const titlu = 'Galeria „O zi la curs”'
  const descriere =
    'Poze de la antrenament, cu o descriere scurtă. Apar pe pagina cursului, în ordinea de aici.'

  if (!courseId) {
    return (
      <FormSection title={titlu} description={descriere}>
        <p className="text-muted-foreground text-sm">
          Salvează cursul, apoi revino aici ca să adaugi poze în galerie.
        </p>
      </FormSection>
    )
  }

  const adauga = async (fisiere: File[]) => {
    if (!fisiere.length) return
    setSeLucreaza(true)
    try {
      const { adaugate, refuzate } = await adaugaPozeCurs(courseId, fisiere, poze.length)
      if (adaugate) toast.success(`${plural(adaugate, 'poză adăugată', 'poze adăugate')}.`)
      for (const motiv of refuzate) toast.error(motiv)
      reimprospateaza()
    } finally {
      setSeLucreaza(false)
    }
  }

  const dinGalerieNativa = async () => {
    setSeLucreaza(true)
    try {
      const alese = await alegeDinGalerie(MAX_POZE_CURS - poze.length)
      setSeLucreaza(false)
      await adauga(alese)
    } catch {
      setSeLucreaza(false)
      toast.error('Nu am putut deschide galeria.')
    }
  }

  const plina = poze.length >= MAX_POZE_CURS
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
            <CoursePhotoCaption poza={p} index={i} onSaved={reimprospateaza} />
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
    <FormSection title={titlu} description={descriere}>
      {lista}
      <div className="bg-muted/50 space-y-3 rounded-xl border p-4">
        <label htmlFor={consentId} className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            id={consentId}
            type="checkbox"
            className="accent-primary focus-visible:outline-ring mt-0.5 size-4 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
            checked={acord}
            onChange={(e) => setAcord(e.target.checked)}
          />
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
            {poze.length} din {MAX_POZE_CURS} poze
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
        description="Poza dispare din galeria cursului. Dacă o vrei înapoi, trebuie s-o încarci din nou."
        confirmLabel="Șterge poza"
        destructive
        pending={sterge.isPending}
        onConfirm={() => deSters && sterge.mutate(deSters.poza)}
      />
    </FormSection>
  )
}
