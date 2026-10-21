import { useRef } from 'react'
import { ImagePlus, Trash2, X } from 'lucide-react'

import type { Sport } from '@/api/sports'
import { publicUrl } from '@/api/public'
import { Button } from '@/components/ui/button'
import { SportIllustration } from '@/components/sport/SportIllustration'
import { Highlight } from '@/features/admin/courses/CourseParts'

const TOUCH = 'h-touch-target min-h-touch-target lg:h-9 lg:min-h-9'

export type SportRowState = { changing: boolean; clearing: boolean; deleting: boolean }

export function SportThumb({ sport, className }: { sport: Sport; className: string }) {
  const thumb = publicUrl('sport-photos', sport.default_photo_storage_path)
  return (
    <span className={`bg-muted block shrink-0 overflow-hidden ${className}`}>
      {thumb ? (
        <img src={thumb} alt="" className="size-full object-cover" />
      ) : (
        <SportIllustration code={sport.code} name={sport.name} compact />
      )}
    </span>
  )
}

type RowProps = {
  sport: Sport
  busy: boolean
  state: SportRowState
  onPickPhoto: (file: File) => void
  onClearPhoto: () => void
  onDelete: () => void
}

export function PhotoActions({ sport, busy, state, onPickPhoto, onClearPhoto }: RowProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const withPhoto = !!sport.default_photo_storage_path
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        aria-label={`Alege poza standard pentru ${sport.name}`}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onPickPhoto(file)
        }}
      />
      <Button
        type="button"
        variant="outline"
        className={TOUCH}
        aria-label={`${withPhoto ? 'Schimbă poza' : 'Poză standard'} pentru ${sport.name}`}
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        <ImagePlus aria-hidden="true" />
        {state.changing ? 'Se salvează…' : withPhoto ? 'Schimbă poza' : 'Poză standard'}
      </Button>
      {withPhoto && (
        <Button
          type="button"
          variant="ghost"
          className={TOUCH}
          aria-label={`Scoate poza standard pentru ${sport.name}`}
          disabled={busy}
          onClick={onClearPhoto}
        >
          <X aria-hidden="true" /> {state.clearing ? 'Se scoate…' : 'Scoate'}
        </Button>
      )}
    </span>
  )
}

export function DeleteSportButton({ sport, busy, state, onDelete }: RowProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={`text-destructive min-w-touch-target shrink-0 lg:min-w-9 ${TOUCH}`}
      aria-label={`Șterge sportul ${sport.name}`}
      disabled={busy}
      onClick={onDelete}
    >
      <Trash2 aria-hidden="true" />
      {state.deleting && <span className="sr-only">Se șterge…</span>}
    </Button>
  )
}

export function SportRow(props: RowProps & { query: string }) {
  const { sport, query } = props
  return (
    <li className="flex min-h-16 min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-5">
      <SportThumb sport={sport} className="size-12 rounded-lg" />
      <span className="min-w-0 flex-1">
        <span className="font-display text-foreground block font-semibold break-words">
          <Highlight text={sport.name} query={query} />
        </span>
        <span className="text-muted-foreground block text-sm break-all">
          <Highlight text={sport.code} query={query} />
        </span>
      </span>
      <span className="order-last w-full md:order-none md:w-auto">
        <PhotoActions {...props} />
      </span>
      <DeleteSportButton {...props} />
    </li>
  )
}
