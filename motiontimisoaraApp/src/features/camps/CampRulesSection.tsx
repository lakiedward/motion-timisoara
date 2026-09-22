import type { FieldErrors, UseFormRegister } from 'react-hook-form'

import { incarcaRegulamentFisier, stergeRegulamentFisier } from '@/api/camp-rules-file'
import RulesFileField from '@/components/RulesFileField'
import type { CampRulesFileMeta } from '@/lib/camp-rules'
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

      <div className="mt-4">
        <RulesFileField
          entityId={campId}
          saved={fisierSalvat}
          localFile={fisierLocal}
          onLocalFile={onFisierLocal}
          upload={incarcaRegulamentFisier}
          remove={stergeRegulamentFisier}
          queryKey={campId ? ['tabara-de-editat', campId] : undefined}
        />
      </div>
    </fieldset>
  )
}
