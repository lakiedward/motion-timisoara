import { OfferExchangeNote } from '@/components/OfferExchangeNote'
import { formatOfferPrice } from '@/lib/money'
import { plural } from '@/lib/plural'

export function ActivityEnrollCard({
  offer,
  spotsLeft,
  ended,
  full,
  onEnroll,
}: {
  offer: { price: number; currency: string; eur_ron_rate_micros?: number | null }
  spotsLeft: number | null
  ended: boolean
  full: boolean
  onEnroll: () => void
}) {
  return (
    <div
      data-section="activity-enroll"
      className="bg-card flex flex-col items-center rounded-xl border p-6 text-center"
    >
      <div className="font-display text-foreground text-3xl font-extrabold whitespace-nowrap">
        {formatOfferPrice(offer.price, offer.currency)}
      </div>
      <OfferExchangeNote offer={offer} className="text-xs" />
      {!ended && spotsLeft !== null && spotsLeft > 0 && (
        <p className="text-muted-foreground mt-2 text-sm">
          {plural(spotsLeft, 'loc rămas', 'locuri rămase')}
        </p>
      )}
      {ended ? (
        <p className="text-muted-foreground bg-muted mt-5 w-full rounded-lg px-4 py-3 text-sm font-medium">
          Activitatea s-a încheiat, înscrierile sunt închise.
        </p>
      ) : full ? (
        <p className="text-muted-foreground bg-muted mt-5 w-full rounded-lg px-4 py-3 text-sm font-medium">
          Toate locurile sunt ocupate.
        </p>
      ) : (
        <button type="button" onClick={onEnroll} className="btn-cta btn-cta--primary mt-5 w-full">
          Înscrie-te
        </button>
      )}
    </div>
  )
}
