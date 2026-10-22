import { useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ImagePlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  MAX_POZE_GALERIE,
  adaugaInGalerie,
  getPozeleTaberei,
  mutaInGalerie,
  schimbaPozaHero,
  stergeDinGalerie,
  urlPublic,
} from '@/api/camp-photos'
import { FormSection } from '@/components/FormSection'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { alegeDinGalerie, galeriaSeDeschideNativ } from '@/lib/galerie'
import { plural } from '@/lib/plural'

type Poza = Awaited<ReturnType<typeof getPozeleTaberei>>[number]

export default function CampPhotosSection({
  campId,
  heroCale,
}: {
  campId: string
  heroCale: string | null
}) {
  const qc = useQueryClient()
  const [seLucreaza, setSeLucreaza] = useState(false)
  const [deSters, setDeSters] = useState<{ poza: Poza; index: number } | null>(null)
  const inputHero = useRef<HTMLInputElement>(null)
  const inputGalerie = useRef<HTMLInputElement>(null)

  const {
    data: poze = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['pozele-taberei', campId],
    queryFn: () => getPozeleTaberei(campId),
  })

  const reimprospateaza = () => {
    qc.invalidateQueries({ queryKey: ['pozele-taberei', campId] })
    qc.invalidateQueries({ queryKey: ['tabara-de-editat', campId] })
    qc.invalidateQueries({ queryKey: ['taberele-mele'] })
  }

  const hero = useMutation({
    mutationFn: (f: File) => schimbaPozaHero(campId, f),
    onSuccess: () => {
      toast.success('Poza din cap a fost schimbată.')
      reimprospateaza()
    },
    onError: () => toast.error('Nu am putut schimba poza din cap.'),
  })

  const sterge = useMutation({
    mutationFn: (poza: Poza) => stergeDinGalerie(poza),
    onSuccess: () => {
      toast.success('Poză ștearsă.')
      setDeSters(null)
      reimprospateaza()
    },
    onError: () => toast.error('Nu am putut șterge poza.'),
  })

  const muta = useMutation({
    mutationFn: ({ index, directie }: { index: number; directie: -1 | 1 }) =>
      mutaInGalerie(poze, index, directie),
    onSuccess: reimprospateaza,
    onError: () => toast.error('Nu am putut schimba ordinea.'),
  })

  const adauga = async (fisiere: File[]) => {
    if (!fisiere.length) return
    setSeLucreaza(true)
    try {
      const { adaugate, refuzate } = await adaugaInGalerie(campId, fisiere, poze.length)
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
      const alese = await alegeDinGalerie(MAX_POZE_GALERIE - poze.length)
      setSeLucreaza(false)
      await adauga(alese)
    } catch {
      setSeLucreaza(false)
      toast.error('Nu am putut deschide galeria.')
    }
  }

  const plina = poze.length >= MAX_POZE_GALERIE
  const ocupat = seLucreaza || hero.isPending || muta.isPending || sterge.isPending
  const contor = `${poze.length} din ${MAX_POZE_GALERIE} poze`

  const butonHero = (
    <Button
      type="button"
      variant="outline"
      className="h-11 min-h-11"
      disabled={ocupat}
      onClick={() => inputHero.current?.click()}
    >
      <ImagePlus className="size-4" aria-hidden="true" />
      {heroCale ? 'Schimbă poza' : 'Alege poza din cap'}
    </Button>
  )

  const imagineHero = heroCale && (
    <img
      src={urlPublic(heroCale)}
      alt="Poza din capul paginii"
      className="aspect-[16/5] w-full rounded-xl object-cover"
    />
  )

  const galerie: ReactNode = isError ? (
    <div className="space-y-2 text-sm" role="alert">
      <p>Nu am putut încărca pozele.</p>
      <Button
        type="button"
        variant="outline"
        className="h-11 min-h-11"
        onClick={() => void refetch()}
      >
        Reîncearcă
      </Button>
    </div>
  ) : isLoading ? (
    <div
      role="status"
      aria-label="Se încarcă pozele"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="aspect-square w-full rounded-xl" />
      ))}
    </div>
  ) : (
    <>
      {poze.length > 0 ? (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          aria-label="Pozele din galerie"
        >
          {poze.map((p, i) => (
            <li key={p.id} className="bg-card overflow-hidden rounded-xl border">
              <img
                src={p.url}
                alt={`Poza ${i + 1}`}
                className="aspect-square w-full object-cover"
              />
              <div className="flex items-center justify-between p-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="size-11 min-h-11"
                  disabled={i === 0 || ocupat}
                  onClick={() => muta.mutate({ index: i, directie: -1 })}
                  aria-label={`Mută poza ${i + 1} mai devreme`}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="size-11 min-h-11"
                  disabled={ocupat}
                  onClick={() => setDeSters({ poza: p, index: i })}
                  aria-label={`Șterge poza ${i + 1}`}
                >
                  <Trash2 className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="size-11 min-h-11"
                  disabled={i === poze.length - 1 || ocupat}
                  onClick={() => muta.mutate({ index: i, directie: 1 })}
                  aria-label={`Mută poza ${i + 1} mai târziu`}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="text-muted-foreground text-sm">
          Nu există încă poze în galerie.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11"
          disabled={plina || ocupat}
          onClick={() =>
            galeriaSeDeschideNativ() ? void dinGalerieNativa() : inputGalerie.current?.click()
          }
        >
          <ImagePlus className="size-4" aria-hidden="true" />
          {plina ? 'Galeria e plină' : 'Adaugă poze'}
        </Button>
        <span className="text-muted-foreground text-sm">{contor}</span>
      </div>
    </>
  )

  const inputuri = (
    <>
      <input
        ref={inputHero}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) hero.mutate(f)
        }}
      />
      <input
        ref={inputGalerie}
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
        description="Poza dispare din galeria taberei. Dacă o vrei înapoi, trebuie s-o încarci din nou."
        confirmLabel="Șterge poza"
        destructive
        pending={sterge.isPending}
        onConfirm={() => deSters && sterge.mutate(deSters.poza)}
      />
    </>
  )

  return (
    <FormSection
      title="Poze"
      description="Poza din cap apare deasupra titlului. Galeria apare mai jos pe pagina taberei, în ordinea de aici."
    >
      <div className="space-y-3">
        <h3 className="font-semibold">Poza din capul paginii</h3>
        {imagineHero}
        {butonHero}
      </div>
      <div className="space-y-3 border-t pt-4">
        <div>
          <h3 className="font-semibold">Galeria</h3>
          <p className="text-muted-foreground text-sm">
            Cel mult {MAX_POZE_GALERIE} poze. Se micșorează înainte de urcare.
          </p>
        </div>
        {galerie}
      </div>
      {inputuri}
    </FormSection>
  )
}
