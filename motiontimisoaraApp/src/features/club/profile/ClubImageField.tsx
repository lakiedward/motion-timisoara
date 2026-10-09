import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { publicUrl } from '@/api/public'
import { clearClubImage, setClubImage, type ClubImageKind } from '@/api/club-images'
import { alegeDinGalerie, galeriaSeDeschideNativ } from '@/lib/galerie'
import { esteImagine } from '@/lib/media'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const COPY = {
  logo: {
    title: 'Logo',
    hint: 'Apare pătrat lângă numele clubului, pe pagina publică.',
    empty: 'Fără logo, pagina arată inițiala clubului.',
    saved: 'Logo salvat.',
    cleared: 'Logo scos.',
  },
  hero: {
    title: 'Copertă',
    hint: 'Apare în banda de sus a paginii publice a clubului.',
    empty: 'Fără copertă, pagina arată fundalul implicit.',
    saved: 'Copertă salvată.',
    cleared: 'Copertă scoasă.',
  },
} as const

export default function ClubImageField({
  clubId,
  kind,
  path,
}: {
  clubId: string
  kind: ClubImageKind
  path: string | null
}) {
  const qc = useQueryClient()
  const copy = COPY[kind]
  const url = publicUrl('club-assets', path)
  const done = () => void qc.invalidateQueries({ queryKey: ['my-club'] })
  const upload = useMutation({
    mutationFn: (file: File) => setClubImage(clubId, kind, file),
    onSuccess: () => {
      done()
      toast.success(copy.saved)
    },
  })
  const clear = useMutation({
    mutationFn: () => clearClubImage(clubId, kind),
    onSuccess: () => {
      done()
      toast.success(copy.cleared)
    },
  })
  const busy = upload.isPending || clear.isPending

  const receive = (file: File | null) => {
    if (!file) return
    if (!esteImagine(file)) {
      toast.error('Poza trebuie să fie o imagine.')
      return
    }
    upload.mutate(file)
  }
  const fromGallery = async () => {
    try {
      const picked = await alegeDinGalerie(1)
      receive(picked.find(esteImagine) ?? null)
    } catch {
      toast.error('Nu am putut deschide galeria.')
    }
  }
  const pickLabel = upload.isPending ? 'Se încarcă…' : url ? 'Schimbă' : 'Alege o poză'

  return (
    <fieldset className="space-y-3 rounded-2xl border p-4" aria-busy={busy}>
      <legend className="px-2 font-semibold">{copy.title}</legend>
      <p className="text-muted-foreground text-sm">{copy.hint}</p>
      {url ? (
        <img
          src={url}
          alt={`${copy.title} club`}
          className={cn(
            'bg-muted rounded-xl object-cover',
            kind === 'logo' ? 'size-28' : 'h-40 w-full',
          )}
        />
      ) : (
        <p className="text-muted-foreground text-sm">{copy.empty}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {galeriaSeDeschideNativ() ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={() => void fromGallery()}
          >
            {pickLabel}
          </Button>
        ) : (
          <Label
            className={cn(
              'border-input inline-flex min-h-11 cursor-pointer items-center rounded-md border px-4 text-sm font-medium focus-within:ring-[3px] focus-within:ring-ring/50',
              busy && 'pointer-events-none opacity-50',
            )}
          >
            {pickLabel}
            <input
              aria-label={`${url ? 'Schimbă' : 'Alege'} ${copy.title.toLowerCase()}`}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                receive(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
          </Label>
        )}
        {url && (
          <Button
            type="button"
            variant="outline"
            className="text-destructive min-h-11"
            disabled={busy}
            onClick={() => clear.mutate()}
          >
            {clear.isPending ? 'Se scoate…' : `Scoate ${copy.title.toLowerCase()}`}
          </Button>
        )}
      </div>
      {(upload.isError || clear.isError) && (
        <p role="alert" className="text-destructive text-sm">
          {upload.isError
            ? `Nu am putut salva ${copy.title.toLowerCase()}. Încearcă din nou.`
            : `Nu am putut scoate ${copy.title.toLowerCase()}. Încearcă din nou.`}
        </p>
      )}
    </fieldset>
  )
}
