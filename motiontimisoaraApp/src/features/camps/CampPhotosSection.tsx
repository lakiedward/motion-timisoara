import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus } from 'lucide-react'
import { toast } from 'sonner'

import { schimbaPozaHero, urlPublic } from '@/api/camp-photos'
import { MAX_POZE_GALERIE, galerieTabara, galleryQueryKey } from '@/api/photo-gallery'
import { FormSection } from '@/components/FormSection'
import { Button } from '@/components/ui/button'
import { GalleryPhotosEditor } from '@/features/photo-gallery/GalleryPhotosEditor'

export default function CampPhotosSection({
  campId,
  heroCale,
}: {
  campId: string
  heroCale: string | null
}) {
  const qc = useQueryClient()
  const inputHero = useRef<HTMLInputElement>(null)
  const tinta = galerieTabara(campId)

  const reimprospateaza = () => {
    qc.invalidateQueries({ queryKey: galleryQueryKey(tinta) })
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

  return (
    <FormSection
      title="Poze"
      description="Poza din cap apare deasupra titlului. Galeria „O zi la tabără” apare mai jos pe pagina taberei, în ordinea de aici."
    >
      <div className="space-y-3">
        <h3 className="font-semibold">Poza din capul paginii</h3>
        {heroCale && (
          <img
            src={urlPublic(heroCale)}
            alt="Poza din capul paginii"
            className="aspect-[16/5] w-full rounded-xl object-cover"
          />
        )}
        <Button
          type="button"
          variant="outline"
          className="h-touch-target"
          disabled={hero.isPending}
          onClick={() => inputHero.current?.click()}
        >
          <ImagePlus className="size-4" aria-hidden="true" />
          {heroCale ? 'Schimbă poza' : 'Alege poza din cap'}
        </Button>
      </div>
      <div className="space-y-3 border-t pt-4">
        <div>
          <h3 className="font-semibold">Galeria „O zi la tabără”</h3>
          <p className="text-muted-foreground text-sm">
            Cel mult {MAX_POZE_GALERIE} poze, cu o descriere scurtă. Se micșorează înainte de
            urcare.
          </p>
        </div>
        <GalleryPhotosEditor
          tinta={tinta}
          placeholder="Ex.: Drumeția de dimineață"
          stergereDescriere="Poza dispare din galeria taberei. Dacă o vrei înapoi, trebuie s-o încarci din nou."
          onChanged={reimprospateaza}
        />
      </div>
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
    </FormSection>
  )
}
