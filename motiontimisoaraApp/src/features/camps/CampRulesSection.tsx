import type { FieldErrors, UseFormRegister } from 'react-hook-form'

import CampFormField from './CampFormField'
import type { Values } from './camp-form-schema'

export default function CampRulesSection({
  register,
  errors,
}: {
  register: UseFormRegister<Values>
  errors: FieldErrors<Values>
}) {
  return (
    <fieldset className="rounded-2xl border p-5">
      <legend className="px-2 font-semibold">Regulament</legend>
      <p className="text-muted-foreground text-sm">
        Textul apare pe pagina publică a taberei. Părinții îl pot citi; nu trebuie să îl accepte la
        înscriere.
      </p>
      <CampFormField eticheta="Regulamentul taberei" eroare={errors.rules?.message}>
        <textarea
          {...register('rules')}
          rows={8}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent p-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] [field-sizing:content] max-h-96"
          aria-invalid={!!errors.rules}
        />
      </CampFormField>
    </fieldset>
  )
}
