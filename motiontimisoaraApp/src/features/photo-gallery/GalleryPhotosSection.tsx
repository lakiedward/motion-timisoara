import { useQueryClient } from '@tanstack/react-query'

import {
  galerieActivitate,
  galerieCurs,
  galleryQueryKey,
  type GalerieTinta,
} from '@/api/photo-gallery'
import { FormSection } from '@/components/FormSection'
import { GalleryPhotosEditor } from './GalleryPhotosEditor'

type Fel = 'curs' | 'activitate'

const TEXTE: Record<
  Fel,
  { titlu: string; descriere: string; salveaza: string; exemplu: string; sterge: string }
> = {
  curs: {
    titlu: 'Galeria „O zi la curs”',
    descriere:
      'Poze de la antrenament, cu o descriere scurtă. Apar pe pagina cursului, în ordinea de aici.',
    salveaza: 'Salvează cursul, apoi revino aici ca să adaugi poze în galerie.',
    exemplu: 'Ex.: Încălzirea pe mal',
    sterge: 'Poza dispare din galeria cursului. Dacă o vrei înapoi, trebuie s-o încarci din nou.',
  },
  activitate: {
    titlu: 'Galeria „Din activitate”',
    descriere:
      'Poze din activitate, cu o descriere scurtă. Apar pe pagina activității, în ordinea de aici.',
    salveaza: 'Salvează activitatea, apoi revino aici ca să adaugi poze în galerie.',
    exemplu: 'Ex.: Traseul cu jaloane',
    sterge:
      'Poza dispare din galeria activității. Dacă o vrei înapoi, trebuie s-o încarci din nou.',
  },
}

function tintaPentru(fel: Fel, id: string): GalerieTinta {
  return fel === 'curs' ? galerieCurs(id) : galerieActivitate(id)
}

export default function GalleryPhotosSection({
  fel,
  id,
  invalidate = [],
}: {
  fel: Fel
  id: string | null
  invalidate?: readonly (readonly unknown[])[]
}) {
  const qc = useQueryClient()
  const texte = TEXTE[fel]

  if (!id) {
    return (
      <FormSection title={texte.titlu} description={texte.descriere}>
        <p className="text-muted-foreground text-sm">{texte.salveaza}</p>
      </FormSection>
    )
  }

  const tinta = tintaPentru(fel, id)
  const onChanged = () => {
    qc.invalidateQueries({ queryKey: galleryQueryKey(tinta) })
    for (const queryKey of invalidate) qc.invalidateQueries({ queryKey })
  }

  return (
    <FormSection title={texte.titlu} description={texte.descriere}>
      <GalleryPhotosEditor
        tinta={tinta}
        placeholder={texte.exemplu}
        stergereDescriere={texte.sterge}
        onChanged={onChanged}
      />
    </FormSection>
  )
}
