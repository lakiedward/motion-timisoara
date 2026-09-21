import { formatZi } from '@/api/camps'
import { formatOfferPrice } from '@/lib/money'
import { formatExchangeRate, parseScaledDecimal } from '@/lib/pricing/offer-currency'
import { campPeriodDurationLabel } from '@/lib/camp-period'
import { Badge } from '@/components/ui/badge'
import { totalCategorieBani } from './camp-form-totals'
import type { Values } from './camp-form-schema'

type LocatieOptiune = { id: string; name: string; city: string | null }

export default function CampFormReviewStep({
  values,
  locatii,
}: {
  values: Values
  locatii: LocatieOptiune[] | undefined
}) {
  const loc = locatii?.find((l) => l.id === values.location_id)
  const locLabel = loc
    ? `${loc.name}${loc.city ? ` · ${loc.city}` : ''}`
    : values.location_id
      ? 'Loc ales'
      : 'Fără loc ales'
  const durata = campPeriodDurationLabel(values.period_start, values.period_end)
  const perioada =
    values.period_start && values.period_end
      ? `${formatZi(values.period_start)} – ${formatZi(values.period_end)}${durata ? ` · ${durata}` : ''}`
      : 'Perioada lipsește'

  return (
    <section className="space-y-5" aria-labelledby="pas-verificare">
      <h2 id="pas-verificare" className="font-display text-lg font-bold">
        Verificare
      </h2>
      <p className="text-muted-foreground text-sm">
        Controlează categoriile și totalurile, apoi salvează tabăra.
      </p>

      <div className="rounded-2xl border p-5">
        <h3 className="font-semibold">Detalii</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Titlu</dt>
            <dd className="font-medium">{values.title || '—'}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Adresa</dt>
            <dd className="font-medium">/tabere/{values.slug || '…'}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Perioada</dt>
            <dd className="font-medium">{perioada}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Loc</dt>
            <dd className="font-medium">{locLabel}</dd>
          </div>
          {values.location_text?.trim() && (
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">Detalii loc</dt>
              <dd className="font-medium">{values.location_text}</dd>
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Locuri</dt>
            <dd className="font-medium">{values.capacity?.trim() || 'Fără limită'}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Plata cash</dt>
            <dd className="font-medium">{values.allow_cash ? 'Acceptată' : 'Doar card'}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Monedă</dt>
            <dd className="font-medium">
              {values.currency === 'EUR'
                ? `EUR, curs BNR ${formatExchangeRate(parseScaledDecimal(values.eur_ron_rate, 6) ?? 0)} lei`
                : 'RON'}
            </dd>
          </div>
        </dl>
        {values.rules.trim() && <p className="mt-3 text-sm whitespace-pre-wrap">{values.rules}</p>}
        {values.necesar.length > 0 && (
          <p className="text-muted-foreground mt-3 text-sm">
            Necesar: {values.necesar.map((c) => c.name).join(', ')}
          </p>
        )}
      </div>

      <ul className="space-y-4" aria-label="Recapitulare prețuri">
        {values.varste.map((categorie, i) => {
          const total = totalCategorieBani(categorie.componente)
          return (
            <li
              key={`${categorie.age_from}-${categorie.age_to}-${i}`}
              className="rounded-2xl border p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">
                  {categorie.age_from}–{categorie.age_to} ani
                </h3>
                <span className="font-semibold tabular-nums">
                  {formatOfferPrice(total, values.currency)}
                </span>
              </div>
              {total === 0 && (
                <Badge variant="secondary" className="mt-2">
                  Gratuit
                </Badge>
              )}
              <ul className="divide-border mt-3 divide-y">
                {categorie.componente.map((item, j) => (
                  <li key={`${item.name}-${j}`} className="flex justify-between gap-3 py-2 text-sm">
                    <span>{item.name}</span>
                    <span className="tabular-nums">
                      {formatOfferPrice(
                        parseScaledDecimal(item.amount_lei, 2) ?? 0,
                        values.currency,
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
