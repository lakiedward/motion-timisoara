import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useWatch, type Control, type UseFormRegister } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatOfferPrice } from '@/lib/money'
import type { Values } from './camp-form-schema'
import { componenteCompletate, totalCategorieBani } from './camp-form-totals'
import CampFormField from './CampFormField'

type Cale = `varste.${number}.componente` | 'adult.componente'
type EroareComponenta = { name?: { message?: string }; amount_lei?: { message?: string } }

export function CampPriceComponents({
  name,
  control,
  register,
  errors,
  currency,
  eticheta,
  etichetaSuma,
  textAdauga,
  textGratuit,
  ariaPrefix,
}: {
  name: Cale
  control: Control<Values>
  register: UseFormRegister<Values>
  errors: { message?: string; [index: number]: EroareComponenta | undefined } | undefined
  currency: string
  eticheta: string
  etichetaSuma: string
  textAdauga: string
  textGratuit: string
  ariaPrefix: string
}) {
  const arr = useFieldArray({ control, name })
  const vii = useWatch({ control, name })
  const moneda = currency === 'EUR' ? 'EUR' : 'lei'
  const total = totalCategorieBani(vii)
  const complet = componenteCompletate(vii)

  return (
    <div>
      <ul className="space-y-3" aria-label={`Componente de cost, ${ariaPrefix}`}>
        {arr.fields.map((f, j) => (
          <li
            key={f.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]"
          >
            <div className="col-span-2 sm:col-span-1">
              <CampFormField eticheta={eticheta} eroare={errors?.[j]?.name?.message}>
                <Input
                  {...register(`${name}.${j}.name`)}
                  placeholder="ex. Cazare"
                  aria-invalid={!!errors?.[j]?.name}
                />
              </CampFormField>
            </div>
            <div>
              <CampFormField
                eticheta={`${etichetaSuma} (${moneda})`}
                eroare={errors?.[j]?.amount_lei?.message}
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  {...register(`${name}.${j}.amount_lei`)}
                  aria-invalid={!!errors?.[j]?.amount_lei}
                />
              </CampFormField>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="mt-[1.375rem] size-11 min-h-11 shrink-0"
              disabled={arr.fields.length <= 1}
              onClick={() => arr.remove(j)}
              aria-label={`Șterge componenta ${j + 1}, ${ariaPrefix}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      {typeof errors?.message === 'string' && (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {errors.message}
        </p>
      )}
      <div
        className="bg-muted/50 mt-3 flex items-center justify-between rounded-lg px-3 py-2"
        role="status"
      >
        <span className="text-muted-foreground text-sm">Total</span>{' '}
        <span className="font-semibold">
          {complet ? formatOfferPrice(total, currency) : '— completează sumele'}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11"
          onClick={() => arr.append({ name: '', amount_lei: '' })}
        >
          <Plus className="size-4" /> {textAdauga}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11"
          onClick={() => arr.replace([{ name: 'Participare', amount_lei: '0' }])}
        >
          {textGratuit}
        </Button>
      </div>
    </div>
  )
}
