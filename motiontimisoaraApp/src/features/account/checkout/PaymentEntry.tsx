import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { nativePaymentsSupported } from '@/api/payments/native'
import { usePaymentAdapter } from './usePaymentAdapter'

export const STRIPE_CHECKOUT_NOTE =
  'Plătești pe pagina securizată Stripe: card, Apple Pay sau Google Pay. Te întoarcem aici după plată.'

export function PaymentEntry({
  childCount = 1,
  framed = true,
}: {
  childCount?: number
  framed?: boolean
}) {
  const { android, availability } = usePaymentAdapter()
  if (!android) {
    return (
      <p
        className={
          framed
            ? 'bg-muted text-muted-foreground flex items-start gap-3 rounded-xl p-5 text-sm'
            : 'text-muted-foreground flex items-start gap-2 text-sm'
        }
      >
        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{STRIPE_CHECKOUT_NOTE}</span>
      </p>
    )
  }
  const Title = framed ? 'h2' : 'h3'
  return (
    <div className={framed ? 'bg-card shadow-card space-y-3 rounded-3xl p-5' : 'space-y-2'}>
      <Title className={framed ? 'font-semibold' : 'text-sm font-medium'}>Card sau Google Pay</Title>
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
      {childCount > 1 && (
        <p className="text-muted-foreground text-sm">
          Plata se confirmă separat pentru fiecare dintre cei {childCount} copii. Dacă te oprești,
          poți relua plățile rămase din Înscrieri, cu aceeași sumă.
        </p>
      )}
    </div>
  )
}
