import { useEffect } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'

import { CURS_BNR_EROARE, formatBnrDate, getCursBnr } from '@/api/bnr-rate'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatExchangeRate, millionthsToDecimal } from '@/lib/pricing/offer-currency'

function useCursBnrRate(
  currency: string,
  setValue: (name: 'eur_ron_rate', value: string, options?: { shouldValidate?: boolean }) => void,
) {
  const cursBnr = useQuery({
    queryKey: ['curs-bnr'],
    queryFn: getCursBnr,
    enabled: currency === 'EUR',
    retry: false,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (currency !== 'EUR') {
      setValue('eur_ron_rate', '')
      return
    }
    if (cursBnr.data) {
      setValue('eur_ron_rate', millionthsToDecimal(cursBnr.data.eur_ron_millionths), {
        shouldValidate: true,
      })
      return
    }
    if (!cursBnr.isFetching) setValue('eur_ron_rate', '')
  }, [currency, cursBnr.data, cursBnr.isFetching, setValue])

  return cursBnr
}

export function OfferCurrencyFields({
  currency,
  currencyField,
  setValue,
}: {
  currency: string
  currencyField: UseFormRegisterReturn
  setValue: (name: 'eur_ron_rate', value: string, options?: { shouldValidate?: boolean }) => void
}) {
  const cursBnr = useCursBnrRate(currency, setValue)
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
        <CursBnrAutomat
          date={cursBnr.data?.date}
          millionths={cursBnr.data?.eur_ron_millionths}
          loading={cursBnr.isFetching && !cursBnr.data}
          error={cursBnr.isError}
          onRetry={() => void cursBnr.refetch()}
        />
      )}
      <p className="text-muted-foreground text-xs">
        Schimbarea monedei nu convertește automat valorile introduse.
      </p>
    </div>
  )
}

function CursBnrAutomat({
  date,
  millionths,
  loading,
  error,
  onRetry,
}: {
  date?: string
  millionths?: number
  loading: boolean
  error: boolean
  onRetry: () => void
}) {
  if (loading) {
    return (
      <div className="space-y-1.5" aria-busy="true" aria-live="polite">
        <Skeleton className="h-5 w-64 max-w-full" />
        <p className="text-muted-foreground text-sm">Se citește cursul BNR…</p>
      </div>
    )
  }
  if (error || date == null || millionths == null) {
    return (
      <div className="space-y-2" role="alert">
        <p className="text-destructive text-sm">{CURS_BNR_EROARE}</p>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11"
          onClick={onRetry}
          aria-label="Reîncearcă cursul BNR"
        >
          Reîncearcă
        </Button>
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium" aria-live="polite">
        Curs BNR din {formatBnrDate(date)}: {formatExchangeRate(millionths)} lei/EUR
      </p>
      <p className="text-muted-foreground text-sm">
        Cursul BNR se salvează pe ofertă. Părintele confirmă și plătește suma finală în lei.
      </p>
    </div>
  )
}
