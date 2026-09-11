import { useId } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function OfferCurrencyFields({
  currency,
  currencyField,
  rateField,
  error,
}: {
  currency: string
  currencyField: UseFormRegisterReturn
  rateField: UseFormRegisterReturn
  error?: string
}) {
  const id = useId()
  return (
    <div className="space-y-3 sm:col-span-2">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Moneda prețului</legend>
        <div className="flex flex-wrap gap-4">
          {(['RON', 'EUR'] as const).map((value) => (
            <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="radio"
                value={value}
                {...currencyField}
                className="size-4 accent-primary"
              />
              {value === 'RON' ? 'Lei (RON)' : 'Euro (EUR)'}
            </label>
          ))}
        </div>
      </fieldset>
      {currency === 'EUR' && (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-rate`}>Cursul tău: 1 EUR în lei</Label>
          <Input
            id={`${id}-rate`}
            inputMode="decimal"
            {...rateField}
            aria-invalid={!!error}
            aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
          />
          {error && (
            <p id={`${id}-error`} role="alert" className="text-destructive text-xs">
              {error}
            </p>
          )}
          <p id={`${id}-help`} className="text-muted-foreground text-sm">
            Stabilești cursul pentru această ofertă. Părintele confirmă și plătește suma finală în
            lei.
          </p>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Schimbarea monedei nu convertește automat valorile introduse.
      </p>
    </div>
  )
}
