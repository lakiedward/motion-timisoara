import { CardElement } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { nativePaymentsSupported } from '@/api/payments/native'
import { usePaymentAdapter } from './usePaymentAdapter'

export function PaymentEntry({ childCount = 1 }: { childCount?: number }) {
  const { android, availability } = usePaymentAdapter()
  return (
    <div className="bg-card shadow-card space-y-3 rounded-3xl p-5">
      <h2 className="font-semibold">{android ? 'Card sau Google Pay' : 'Date card'}</h2>
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
        <div className="rounded-xl border p-3">
          <Label className="sr-only">Datele cardului</Label>
          <CardElement options={{ hidePostalCode: true }} />
        </div>
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
