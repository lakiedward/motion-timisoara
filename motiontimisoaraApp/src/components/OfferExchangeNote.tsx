import { formatExchangeRate } from '@/lib/pricing/offer-currency'

export function OfferExchangeNote({
  offer,
}: {
  offer: { currency: string; eur_ron_rate_micros?: number | null }
}) {
  if (offer.currency !== 'EUR') return null
  return (
    <p className="text-muted-foreground mt-2 text-sm">
      {offer.eur_ron_rate_micros
        ? `Plata se face în lei, la cursul organizatorului: 1 EUR = ${formatExchangeRate(offer.eur_ron_rate_micros)} lei. Vezi suma exactă înainte de confirmare.`
        : 'Cursul în lei nu este disponibil. Contactează organizatorul înainte de înscriere.'}
    </p>
  )
}
