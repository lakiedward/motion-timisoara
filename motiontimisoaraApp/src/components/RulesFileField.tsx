import { FileText, Trash2 } from 'lucide-react'
import { useId, useRef, type ComponentProps } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  CAMP_RULES_FILE_ACCEPT,
  campRulesFileContentType,
  campRulesFileKindLabel,
  formatCampRulesFileSize,
  respingeRegulamentFisier,
  type CampRulesFileMeta,
} from '@/lib/camp-rules'

export default function RulesFileField({
  entityId,
  saved,
  localFile,
  onLocalFile,
  onSaved,
  upload,
  remove,
  queryKey,
  intro,
}: {
  entityId?: string
  saved: CampRulesFileMeta | null
  localFile: File | null
  onLocalFile: (fisier: File | null) => void
  onSaved?: (fisier: CampRulesFileMeta | null) => void
  upload: (id: string, fisier: File) => Promise<CampRulesFileMeta>
  remove: (id: string) => Promise<void>
  queryKey?: readonly unknown[]
  intro?: string
}) {
  const qc = useQueryClient()
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)

  const reimprospateaza = () => {
    if (queryKey) void qc.invalidateQueries({ queryKey })
  }

  const urca = useMutation({
    mutationFn: (f: File) => upload(entityId as string, f),
    onSuccess: (meta) => {
      toast.success('Fișierul regulamentului a fost urcat.')
      onSaved?.(meta)
      reimprospateaza()
    },
    onError: (e) =>
      toast.error(e instanceof Error && e.message ? e.message : 'Nu am putut urca fișierul.'),
  })

  const scoate = useMutation({
    mutationFn: () => remove(entityId as string),
    onSuccess: () => {
      toast.success('Fișierul regulamentului a fost șters.')
      onSaved?.(null)
      reimprospateaza()
    },
    onError: () => toast.error('Nu am putut șterge fișierul.'),
  })

  const afisat = entityId
    ? saved
    : localFile
      ? {
          name: localFile.name,
          contentType: campRulesFileContentType(localFile) ?? '',
          sizeBytes: localFile.size,
        }
      : null

  const ocupat = urca.isPending || scoate.isPending

  const alege = (fisier: File | undefined) => {
    if (!fisier) return
    const refuz = respingeRegulamentFisier(fisier)
    if (refuz) {
      toast.error(refuz)
      return
    }
    if (entityId) urca.mutate(fisier)
    else onLocalFile(fisier)
  }

  return (
    <div>
      {intro && <p className="text-muted-foreground text-sm">{intro}</p>}
      <Label htmlFor={inputId} className={cn('text-sm font-medium', intro && 'mt-3')}>
        Fișierul regulamentului
      </Label>
      <p className="text-muted-foreground text-sm">
        PDF, imagine, Word sau Excel. Cel mult 10 MB. Un singur fișier.
      </p>
      <input
        id={inputId}
        ref={input}
        type="file"
        accept={CAMP_RULES_FILE_ACCEPT}
        className="sr-only"
        disabled={ocupat}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          alege(f)
        }}
      />
      {afisat && (
        <p className="mt-3 flex items-start gap-2 text-sm">
          <FileText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium">{afisat.name}</span>
            <span className="text-muted-foreground">
              {' '}
              · {campRulesFileKindLabel(afisat.contentType)} ·{' '}
              {formatCampRulesFileSize(afisat.sizeBytes)}
            </span>
          </span>
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11"
          disabled={ocupat}
          onClick={() => input.current?.click()}
        >
          <FileText className="size-4" />
          {afisat ? 'Înlocuiește fișierul' : 'Alege fișierul'}
        </Button>
        {afisat && (
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11"
            disabled={ocupat}
            onClick={() => {
              if (entityId) scoate.mutate()
              else onLocalFile(null)
            }}
          >
            <Trash2 className="size-4" />
            Șterge fișierul
          </Button>
        )}
      </div>
    </div>
  )
}

export function OfferRulesFieldset(props: ComponentProps<typeof RulesFileField>) {
  return (
    <fieldset className="rounded-2xl border p-5">
      <legend className="px-2 font-semibold">Regulament</legend>
      <RulesFileField {...props} />
    </fieldset>
  )
}
