import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { alegeDinGalerie, galeriaSeDeschideNativ } from '@/lib/galerie'
import { esteImagine } from '@/lib/media'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function HeroPhotoField({
  savedUrl,
  error,
  onFile,
}: {
  savedUrl: string | null
  error: string | null
  onFile: (file: File) => void
}) {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const afisat = preview ?? savedUrl

  const primeste = (ales: File | null) => {
    if (!ales) return
    if (!esteImagine(ales)) {
      toast.error('Poza trebuie să fie o imagine.')
      return
    }
    setPreview((veche) => {
      if (veche) URL.revokeObjectURL(veche)
      return URL.createObjectURL(ales)
    })
    onFile(ales)
  }

  const dinGalerie = async () => {
    try {
      const alese = await alegeDinGalerie(1)
      primeste(alese.find(esteImagine) ?? null)
    } catch {
      toast.error('Nu am putut deschide galeria.')
    }
  }

  return (
    <fieldset className="rounded-2xl border p-5">
      <legend className="px-2 font-semibold">Poza din capul paginii</legend>
      <p className="text-muted-foreground text-sm">
        Obligatorie. Se vede în banda de deasupra titlului, pe pagina publică. Galeria rămâne
        separată.
      </p>
      {afisat && <img src={afisat} alt="" className="mt-3 h-40 w-full rounded-xl object-cover" />}
      <div className="mt-3">
        {galeriaSeDeschideNativ() ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11"
            onClick={() => void dinGalerie()}
          >
            {afisat ? 'Schimbă poza' : 'Alege din galerie'}
          </Button>
        ) : (
          <Label className="border-input inline-flex h-11 min-h-11 cursor-pointer items-center rounded-md border px-4 text-sm font-medium">
            {afisat ? 'Schimbă poza' : 'Alege o poză'}
            <input
              aria-label="Poza din capul paginii"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                primeste(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
          </Label>
        )}
      </div>
      {error && (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
