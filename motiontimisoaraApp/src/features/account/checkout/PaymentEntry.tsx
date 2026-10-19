import { CardElement } from '@stripe/react-stripe-js'
import type { StripeCardElementChangeEvent } from '@stripe/stripe-js'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { nativePaymentsSupported } from '@/api/payments/native'
import { cn } from '@/lib/utils'
import { usePaymentAdapter } from './usePaymentAdapter'

function themedCardStyle() {
  const css = getComputedStyle(document.documentElement)
  const color = css.getPropertyValue('--foreground').trim()
  const muted = css.getPropertyValue('--muted-foreground').trim()
  const danger = css.getPropertyValue('--destructive').trim()
  return {
    base: { color, iconColor: muted, fontSize: '16px', '::placeholder': { color: muted } },
    invalid: { color: danger, iconColor: danger },
  }
}

export const CARD_ERROR_ID = 'payment-card-error'

export function PaymentEntry({
  childCount = 1,
  framed = true,
  onCardChange,
  cardError,
}: {
  childCount?: number
  framed?: boolean
  onCardChange?: (event: StripeCardElementChangeEvent) => void
  cardError?: string | null
}) {
  const { android, availability } = usePaymentAdapter()
  const Title = framed ? 'h2' : 'h3'
  return (
    <div className={framed ? 'bg-card shadow-card space-y-3 rounded-3xl p-5' : 'space-y-2'}>
      <Title className={framed ? 'font-semibold' : 'text-sm font-medium'}>
        {android ? 'Card sau Google Pay' : 'Date card'}
      </Title>
      {android ? (
        <>
          <p className="text-muted-foreground text-sm">
            Datele cardului și confirmarea băncii se deschid în ecranul securizat de plată.
          </p>
          {!nativePaymentsSupported() ? (
            <p role="alert" className="text-destructive text-sm">
              Actualizează aplicația pentru a plăti cu cardul pe acest telefon.
            </p>
          ) : availability.isPending ? (
            <div role="status" aria-label="Verificăm metodele de plată">
              <Skeleton className="h-4 w-full" />
            </div>
          ) : availability.isError ? (
            <div role="alert" className="space-y-2 text-sm">
              <p>Nu am putut pregăti plata pe telefon.</p>
              <Button variant="outline" onClick={() => void availability.refetch()}>
                Reîncearcă
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {availability.data.googlePay
                ? 'Poți alege Google Pay sau un card bancar în ecranul de plată.'
                : 'Google Pay nu este disponibil pe acest telefon. Poți folosi un card bancar.'}
              {availability.data.testMode && ' Mod de test: nu se încasează bani reali.'}
            </p>
          )}
        </>
      ) : (
        <>
          <div
            aria-invalid={cardError ? true : undefined}
            aria-describedby={cardError ? CARD_ERROR_ID : undefined}
            className={
              framed
                ? 'rounded-xl border p-3'
                : cn(
                    'border-input hover:border-muted-foreground dark:bg-input/30 flex min-h-touch-target flex-col justify-center rounded-md border bg-transparent px-3 shadow-xs',
                    'has-[.StripeElement--focus]:outline-ring has-[.StripeElement--focus]:outline-2 has-[.StripeElement--focus]:outline-offset-2',
                    cardError && 'border-destructive border-2',
                  )
            }
          >
            <Label className="sr-only">Datele cardului</Label>
            <CardElement
              options={framed ? { hidePostalCode: true } : { hidePostalCode: true, style: themedCardStyle() }}
              onChange={onCardChange}
            />
          </div>
          {cardError && (
            <p id={CARD_ERROR_ID} role="alert" className="text-destructive text-sm">
              {cardError}
            </p>
          )}
        </>
      )}
      {childCount > 1 && (
        <p className="text-muted-foreground text-sm">
          Plata se confirmă separat pentru fiecare dintre cei {childCount} copii. Dacă te oprești,
          poți relua plățile rămase din Înscrieri, cu aceeași sumă.
        </p>
      )}
    </div>
  )
}
