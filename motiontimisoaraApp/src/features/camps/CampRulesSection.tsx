import { FileText, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { incarcaRegulamentFisier, stergeRegulamentFisier } from '@/api/camp-rules-file'
import { Button } from '@/components/ui/button'
import {
  CAMP_RULES_FILE_ACCEPT,
  campRulesFileContentType,
  campRulesFileKindLabel,
  formatCampRulesFileSize,
  respingeRegulamentFisier,
  type CampRulesFileMeta,
} from '@/lib/camp-rules'
import CampFormField from './CampFormField'
import type { Values } from './camp-form-schema'

export default function CampRulesSection({
  register,
  errors,
  campId,
  fisierSalvat,
  fisierLocal,
  onFisierLocal,
}: {
  register: UseFormRegister<Values>
  errors: FieldErrors<Values>
  campId?: string
  fisierSalvat: CampRulesFileMeta | null
  fisierLocal: File | null
  onFisierLocal: (fisier: File | null) => void
}) {
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)

  const reimprospateaza = () => {
    if (!campId) return
    qc.invalidateQueries({ queryKey: ['tabara-de-editat', campId] })
  }

  const urca = useMutation({
    mutationFn: (f: File) => incarcaRegulamentFisier(campId as string, f),
    onSuccess: () => {
      toast.success('Fișierul regulamentului a fost urcat.')
      reimprospateaza()
    },
    onError: (e) =>
      toast.error(e instanceof Error && e.message ? e.message : 'Nu am putut urca fișierul.'),
  })

  const scoate = useMutation({
    mutationFn: () => stergeRegulamentFisier(campId as string),
    onSuccess: () => {
      toast.success('Fișierul regulamentului a fost șters.')
      reimprospateaza()
    },
    onError: () => toast.error('Nu am putut șterge fișierul.'),
  })

  const afisat = campId
    ? fisierSalvat
    : fisierLocal
      ? {
          name: fisierLocal.name,
          contentType: campRulesFileContentType(fisierLocal) ?? '',
          sizeBytes: fisierLocal.size,
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
    if (campId) urca.mutate(fisier)
    else onFisierLocal(fisier)
  }

  return (
    <fieldset className="rounded-2xl border p-5">
      <legend className="px-2 font-semibold">Regulament</legend>
      <p className="text-muted-foreground text-sm">
        Textul și fișierul apar pe pagina publică a taberei. Părinții le pot citi; nu trebuie să le
        accepte la înscriere.
      </p>
      <CampFormField eticheta="Regulamentul taberei" eroare={errors.rules?.message}>
        <textarea
          {...register('rules')}
          rows={8}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent p-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] [field-sizing:content] max-h-96"
          aria-invalid={!!errors.rules}
        />
      </CampFormField>

      <CampFormField
        eticheta="Fișierul regulamentului"
        ajutor="PDF, imagine, Word sau Excel. Cel mult 10 MB. Un singur fișier."
      >
        <input
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
      </CampFormField>

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
              if (campId) scoate.mutate()
              else onFisierLocal(null)
            }}
          >
            <Trash2 className="size-4" />
            Șterge fișierul
          </Button>
        )}
      </div>
    </fieldset>
  )
}
