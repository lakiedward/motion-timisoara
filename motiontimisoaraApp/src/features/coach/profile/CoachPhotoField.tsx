import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'

import { publicUrl } from '@/api/public'
import {
  clearMyCoachPhoto,
  getMyCoachPhotoPath,
  setMyCoachPhoto,
} from '@/api/coach-profile/coach-photo'
import { alegeDinGalerie, galeriaSeDeschideNativ } from '@/lib/galerie'
import { esteImagine } from '@/lib/media'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { fieldFocusWithinClassName } from '@/components/ui/field-styles'
import { initials } from '@/lib/initials'

const QUERY_KEY = ['my-coach-photo']

export default function CoachPhotoField({ name }: { name: string }) {
  const qc = useQueryClient()
  const photo = useQuery({ queryKey: QUERY_KEY, queryFn: getMyCoachPhotoPath })
  const url = publicUrl('coach-photos', photo.data ?? null)
  const done = () => void qc.invalidateQueries({ queryKey: QUERY_KEY })
  const upload = useMutation({
    mutationFn: setMyCoachPhoto,
    onSuccess: () => {
      done()
      toast.success('Poză salvată.')
    },
  })
  const clear = useMutation({
    mutationFn: clearMyCoachPhoto,
    onSuccess: () => {
      done()
      toast.success('Poză scoasă.')
    },
  })
  const busy = upload.isPending || clear.isPending || photo.isLoading

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
  const pickLabel = upload.isPending ? 'Se încarcă…' : url ? 'Schimbă poza' : 'Alege o poză'

  const avatar = photo.isLoading ? (
    <Skeleton className="size-24 shrink-0 rounded-full" />
  ) : (
    <Avatar key={url ?? 'initials'} className="size-24">
      {url && <AvatarImage src={url} alt={name} className="object-cover" />}
      <AvatarFallback className="text-3xl">{initials(name)}</AvatarFallback>
    </Avatar>
  )

  const picker = galeriaSeDeschideNativ() ? (
    <Button
      type="button"
      variant="outline"
      className="min-h-11"
      disabled={busy}
      onClick={() => void fromGallery()}
    >
      <Camera aria-hidden="true" />
      {pickLabel}
    </Button>
  ) : (
    <Label
      className={cn(
        'border-input inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm font-medium',
        fieldFocusWithinClassName,
        busy && 'pointer-events-none opacity-50',
      )}
    >
      <Camera aria-hidden="true" className="size-4" />
      {pickLabel}
      <input
        aria-label={url ? 'Schimbă poza de profil' : 'Alege poza de profil'}
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
  )

  const actions = (
    <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
      {picker}
      {url && (
        <Button
          type="button"
          variant="outline"
          className="text-destructive min-h-11"
          disabled={busy}
          onClick={() => clear.mutate()}
        >
          {clear.isPending ? 'Se scoate…' : 'Scoate poza'}
        </Button>
      )}
    </div>
  )

  const errorText = (upload.isError || clear.isError || photo.isError) && (
    <p role="alert" className="text-destructive text-sm">
      {photo.isError
        ? 'Nu am putut citi poza de profil.'
        : upload.isError
          ? 'Nu am putut salva poza. Încearcă din nou.'
          : 'Nu am putut scoate poza. Încearcă din nou.'}
    </p>
  )

  return (
    <Card
      data-section="coach-photo"
      aria-busy={busy}
      className="flex-col items-center gap-5 p-6 text-center sm:flex-row sm:text-left"
    >
      {avatar}
      <div className="min-w-0 space-y-3">
        <div>
          <p className="font-display text-foreground text-xl font-bold">{name}</p>
          <p className="text-muted-foreground text-sm">
            {url
              ? 'Așa te văd părinții pe pagina ta publică.'
              : 'Fără poză, părinții văd inițialele tale.'}
          </p>
        </div>
        {actions}
        {errorText}
      </div>
    </Card>
  )
}
