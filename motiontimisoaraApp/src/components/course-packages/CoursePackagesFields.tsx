import { Plus, Trash2 } from 'lucide-react'
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type FieldValues,
  type UseFormRegister,
} from 'react-hook-form'

import { FormSection } from '@/components/FormSection'
import { Button } from '@/components/ui/button'
import { FieldMessage, fieldDescription } from '@/components/ui/field'
import { FormSelectMenu } from '@/components/ui/form-select-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MAX_COURSE_PACKAGES,
  MAX_PACKAGE_SESSIONS,
  emptyCoursePackage,
  pricePerSession,
  sessionsLabel,
  type CoursePackagesFormValues,
} from '@/lib/course-packages/course-packages'
import { MONTHLY } from '@/lib/course-packages/package-month'
import { formatMoney } from '@/lib/money'
import { parseScaledDecimal } from '@/lib/pricing/offer-currency'

type PackagesForm = FieldValues & CoursePackagesFormValues

const VALIDITY_OPTIONS = [
  { value: 'NONE', label: 'Fără expirare' },
  { value: MONTHLY, label: 'Lunar – expiră la sfârșitul lunii' },
]

export function CoursePackagesFields<T extends PackagesForm>({
  control,
  register,
  errors,
  currency,
}: {
  control: Control<T>
  register: UseFormRegister<T>
  errors: FieldErrors<T>
  currency: string
}) {
  const formControl = control as unknown as Control<CoursePackagesFormValues>
  const formRegister = register as unknown as UseFormRegister<CoursePackagesFormValues>
  const packageErrors = (errors as FieldErrors<CoursePackagesFormValues>).packages
  const { fields, append, remove } = useFieldArray({ control: formControl, name: 'packages' })
  const values = useWatch({ control: formControl, name: 'packages' })
  const unit = currency === 'EUR' ? 'EUR' : 'lei'
  const full = fields.length >= MAX_COURSE_PACKAGES

  return (
    <div data-section="course-form-packages">
      <FormSection
        title="Pachete"
        description={`Opțional. Până la ${MAX_COURSE_PACKAGES} pachete, de exemplu 8 ședințe la un preț total. Unde cursul are pachete, părintele poate cumpăra doar unul dintre ele, la înscriere și la reînnoire, fără alt număr de ședințe. Un pachet lunar e valabil de la 1 la ultima zi a lunii alese de părinte; ședințele nefolosite se pierd.`}
      >
        {fields.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Fără pachete, părintele alege la înscriere câte ședințe plătește, la prețul pe ședință.
          </p>
        ) : (
          <ul className="space-y-3" aria-label="Pachete">
            {fields.map((field, index) => {
              const fieldErrors = packageErrors?.[index]
              const sessionsId = `package-${index}-sessions`
              const priceId = `package-${index}-price`
              const validityId = `package-${index}-validity`
              const current = values?.[index]
              const sessions = Number(current?.sessions)
              const price = parseScaledDecimal(current?.price ?? '', 2)
              const perSession =
                Number.isInteger(sessions) && sessions > 0 && price
                  ? formatMoney(pricePerSession({ sessions, price }), currency)
                  : null
              return (
                <li
                  key={field.id}
                  className="rounded-xl border p-4"
                  aria-label={`Pachetul ${index + 1}`}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="font-semibold">
                      Pachetul {index + 1}
                      {Number.isInteger(sessions) && sessions > 0
                        ? ` · ${sessionsLabel(sessions)}`
                        : ''}
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-touch-target min-h-touch-target"
                      onClick={() => remove(index)}
                      aria-label={`Șterge pachetul ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor={sessionsId}>Număr de ședințe</Label>
                      <Input
                        id={sessionsId}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_PACKAGE_SESSIONS}
                        step={1}
                        aria-invalid={!!fieldErrors?.sessions}
                        aria-describedby={fieldDescription(
                          sessionsId,
                          undefined,
                          fieldErrors?.sessions?.message,
                        )}
                        {...formRegister(`packages.${index}.sessions`)}
                      />
                      <FieldMessage id={sessionsId} error={fieldErrors?.sessions?.message} />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor={priceId}>Preț total ({unit})</Label>
                      <Input
                        id={priceId}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min={0}
                        aria-invalid={!!fieldErrors?.price}
                        aria-describedby={fieldDescription(
                          priceId,
                          perSession ? `${perSession} / ședință` : undefined,
                          fieldErrors?.price?.message,
                        )}
                        {...formRegister(`packages.${index}.price`)}
                      />
                      <FieldMessage
                        id={priceId}
                        hint={perSession ? `Înseamnă ${perSession} / ședință.` : undefined}
                        error={fieldErrors?.price?.message}
                      />
                    </div>
                    <div className="min-w-0 space-y-1.5 sm:col-span-2">
                      <Label htmlFor={validityId}>Valabilitate</Label>
                      <FormSelectMenu
                        control={formControl}
                        name={`packages.${index}.validity`}
                        id={validityId}
                        aria-describedby={fieldDescription(validityId, 'hint', undefined)}
                        options={VALIDITY_OPTIONS}
                      />
                      <FieldMessage
                        id={validityId}
                        hint={
                          current?.validity === MONTHLY
                            ? 'Părintele alege luna aceasta sau luna următoare și plătește prețul întreg. Ședințele nefolosite se pierd la sfârșitul lunii.'
                            : 'Ședințele rămân până le folosește copilul.'
                        }
                      />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {typeof packageErrors?.message === 'string' && (
          <p className="text-destructive text-sm" role="alert">
            {packageErrors.message}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-touch-target min-h-touch-target"
            disabled={full}
            aria-describedby={full ? 'packages-full' : undefined}
            onClick={() => append(emptyCoursePackage())}
          >
            <Plus className="size-4" /> Adaugă un pachet
          </Button>
          {full && (
            <p id="packages-full" className="text-muted-foreground text-sm">
              Ai ajuns la {MAX_COURSE_PACKAGES} pachete, cât permite un curs.
            </p>
          )}
        </div>
      </FormSection>
    </div>
  )
}
