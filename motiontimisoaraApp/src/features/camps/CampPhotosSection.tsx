import { useRef, useState } from 'react'
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
  stergePozaHero,
  urlPublic,
} from '@/api/camp-photos'
import { alegeDinGalerie, galeriaSeDeschideNativ } from '@/lib/galerie'
import { plural } from '@/lib/plural'
import { Button } from '@/components/ui/button'

/**
 * Pozele se administrează doar pe o tabără care există deja: calea din bucket
 * începe cu id-ul ei, iar înainte de salvare nu-l avem. La creare, secțiunea
 * asta nici nu se arată — formularul o spune limpede în locul ei.
 */
export default function CampPhotosSection({
  campId,
  heroCale,
}: {
  campId: string
  heroCale: string | null
}) {
  const qc = useQueryClient()
  const [seLucreaza, setSeLucreaza] = useState(false)
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

  const scoateHero = useMutation({
    mutationFn: () => stergePozaHero(campId),
    onSuccess: () => {
      toast.success('Poza din cap a fost scoasă.')
      reimprospateaza()
    },
    onError: () => toast.error('Nu am putut scoate poza.'),
  })

  const sterge = useMutation({
    mutationFn: (poza: (typeof poze)[number]) => stergeDinGalerie(poza),
    onSuccess: () => {
      toast.success('Poză ștearsă.')
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
      // Fiecare refuz spune ce fișier și de ce, nu doar „a eșuat": altfel omul
      // nu are cum să știe pe care să-l scoată din lot.
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
  const ocupat = seLucreaza || hero.isPending || scoateHero.isPending || muta.isPending

  return (
    <fieldset className="rounded-2xl border p-5">
      <legend className="px-2 font-semibold">Poze</legend>

      <h3 className="text-sm font-medium">Poza din capul paginii</h3>
      <p className="text-muted-foreground mt-1 text-xs">
        Se vede lată, deasupra titlului. Merge cel mai bine una în care subiectul stă pe orizontală.
      </p>

      {heroCale ? (
        <div className="mt-3">
          <img
            src={urlPublic(heroCale)}
            alt=""
            className="h-40 w-full rounded-xl object-cover"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11"
              disabled={ocupat}
              onClick={() => inputHero.current?.click()}
            >
              Schimbă
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11"
              disabled={ocupat}
              onClick={() => scoateHero.mutate()}
            >
              <Trash2 className="size-4" /> Scoate
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-11 min-h-11"
          disabled={ocupat}
          onClick={() => inputHero.current?.click()}
        >
          <ImagePlus className="size-4" /> Alege poza din cap
        </Button>
      )}
      <input
        ref={inputHero}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          // Inputul se golește ca aceeași poză să poată fi aleasă din nou după
          // o încercare eșuată; altfel `change` nu se mai declanșează.
          e.target.value = ''
          if (f) hero.mutate(f)
        }}
      />

      <hr className="my-6" />

      <h3 className="text-sm font-medium">Galeria</h3>
      <p className="text-muted-foreground mt-1 text-xs">
        Cel mult {MAX_POZE_GALERIE} poze. Se micșorează în browser înainte de urcare, deci nu
        contează cât de mari sunt cele de pe telefon.
      </p>

      {isError ? (
        <div className="mt-3" role="alert">
          <p className="text-foreground text-sm font-medium">Nu am putut încărca pozele.</p>
          <Button type="button" className="mt-2 h-11 min-h-11" onClick={() => void refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : isLoading ? (
        <p className="text-muted-foreground mt-3 text-sm">Se încarcă…</p>
      ) : (
        <>
          {poze.length > 0 && (
            <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {poze.map((p, i) => (
                <li key={p.id} className="overflow-hidden rounded-xl border">
                  <img src={p.url} alt="" className="aspect-square w-full object-cover" />
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
                      disabled={sterge.isPending || ocupat}
                      onClick={() => sterge.mutate(p)}
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
          )}

          <Button
            type="button"
            variant="outline"
            className="mt-4 h-11 min-h-11"
            disabled={plina || ocupat}
            onClick={() =>
              galeriaSeDeschideNativ() ? void dinGalerieNativa() : inputGalerie.current?.click()
            }
          >
            <ImagePlus className="size-4" />
            {plina ? 'Galeria e plină' : 'Adaugă poze'}
          </Button>
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
        </>
      )}
    </fieldset>
  )
}
