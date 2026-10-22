import { FormSection } from '@/components/FormSection'
import { useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'

import { incarcaRegulamentFisier, stergeRegulamentFisier } from '@/api/camp-rules-file'
import RulesFileField from '@/components/RulesFileField'
import { Textarea } from '@/components/ui/textarea'
import type { CampRulesFileMeta } from '@/lib/camp-rules'
import CampFormField from './CampFormField'
import type { Values } from './camp-form-schema'

const LIMITA_REGULAMENT = 8000

export default function CampRulesSection({
  control,
  register,
  errors,
  campId,
  fisierSalvat,
  fisierLocal,
  onFisierLocal,
}: {
  control: Control<Values>
  register: UseFormRegister<Values>
  errors: FieldErrors<Values>
  campId?: string
  fisierSalvat: CampRulesFileMeta | null
  fisierLocal: File | null
  onFisierLocal: (fisier: File | null) => void
}) {
  const text = useWatch({ control, name: 'rules' }) ?? ''
  return (
    <FormSection
      title="Regulament"
      description="Textul și fișierul apar pe pagina publică a taberei. Părinții le pot citi; nu trebuie să le accepte la înscriere."
    >
      <CampFormField
        eticheta="Regulamentul taberei"
        eroare={errors.rules?.message}
        ajutor={`${text.length.toLocaleString('ro-RO')} din ${LIMITA_REGULAMENT.toLocaleString('ro-RO')} de caractere`}
      >
        <Textarea
          {...register('rules')}
          rows={8}
          className="[field-sizing:content] max-h-96"
          aria-invalid={!!errors.rules}
        />
      </CampFormField>

      <div className="border-t pt-4">
        <RulesFileField
          entityId={campId}
          saved={fisierSalvat}
          localFile={fisierLocal}
          onLocalFile={onFisierLocal}
          upload={incarcaRegulamentFisier}
          remove={stergeRegulamentFisier}
          queryKey={campId ? ['tabara-de-editat', campId] : undefined}
          confirmRemove
        />
      </div>
    </FormSection>
  )
}
