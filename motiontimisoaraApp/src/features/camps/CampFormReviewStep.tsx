import { useEffect, useState, type ReactNode } from 'react'
import { CircleAlert, Pencil } from 'lucide-react'

import { formatZi } from '@/api/camps'
import { formatOfferPrice } from '@/lib/money'
import { formatExchangeRate, parseScaledDecimal } from '@/lib/pricing/offer-currency'
import { campPeriodDurationLabel } from '@/lib/camp-period'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { etichetaVarsta, totalCategorieBani } from './camp-form-totals'
import type { Values } from './camp-form-schema'

type LocatieOptiune = { id: string; name: string; city: string | null }

function Rand({ eticheta, children }: { eticheta: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
      <dt className="text-muted-foreground">{eticheta}</dt>
      <dd className="font-medium sm:text-right">{children}</dd>
    </div>
  )
}

function Bloc({
  titlu,
  pas,
  onModifica,
  children,
}: {
  titlu: string
  pas: number
  onModifica: (pas: number) => void
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">{titlu}</CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11"
            onClick={() => onModifica(pas)}
            aria-label={`Modifică ${titlu.toLowerCase()}`}
          >
            <Pencil className="size-4" /> Modifică
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">{children}</CardContent>
    </Card>
  )
}

function useImagine(fisier: File | null) {
  const [citita, setCitita] = useState<{ fisier: File; url: string } | null>(null)
  useEffect(() => {
    if (!fisier) return
    const cititor = new FileReader()
    cititor.onload = () => {
      if (typeof cititor.result === 'string') setCitita({ fisier, url: cititor.result })
    }
    cititor.readAsDataURL(fisier)
    return () => cititor.abort()
  }, [fisier])
  return citita && citita.fisier === fisier ? citita.url : null
}

function Pret({
  titlu,
  componente,
  currency,
}: {
  titlu: string
  componente: Values['adult']['componente']
  currency: string
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold">{titlu}</h4>
        <span className="font-semibold tabular-nums">
          {formatOfferPrice(totalCategorieBani(componente), currency)}
        </span>
      </div>
      <ul className="divide-border mt-2 divide-y">
        {componente.map((item, j) => (
          <li
            key={`${item.name}-${j}`}
            className="text-muted-foreground flex justify-between gap-3 py-2"
          >
            <span>{item.name}</span>
            <span className="tabular-nums">
              {formatOfferPrice(parseScaledDecimal(item.amount_lei, 2) ?? 0, currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function CampFormReviewStep({
  values,
  locatii,
  fisierRegulament,
  pozaHero = null,
  onModifica = () => {},
}: {
  values: Values
  locatii: LocatieOptiune[] | undefined
  fisierRegulament: { name: string; eticheta: string; marime: string } | null
  pozaHero?: File | null
  onModifica?: (pas: number) => void
}) {
  const poza = useImagine(pozaHero)
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
  const moneda =
    values.currency === 'EUR'
      ? `EUR, curs BNR ${formatExchangeRate(parseScaledDecimal(values.eur_ron_rate, 6) ?? 0)} lei`
      : 'RON'

  const detalii = (
    <>
      {poza && <img src={poza} alt="" className="h-32 w-full rounded-xl object-cover sm:h-40" />}
      <dl className="space-y-2">
        <Rand eticheta="Titlu">{values.title || '—'}</Rand>
        <Rand eticheta="Adresa">/tabere/{values.slug || '…'}</Rand>
        <Rand eticheta="Perioada">{perioada}</Rand>
        <Rand eticheta="Loc">{locLabel}</Rand>
        {values.location_text?.trim() && <Rand eticheta="Detalii loc">{values.location_text}</Rand>}
        <Rand eticheta="Locuri">{values.capacity?.trim() || 'Fără limită'}</Rand>
        <Rand eticheta="Plata cash">{values.allow_cash ? 'Acceptată' : 'Doar card'}</Rand>
      </dl>
      {!values.location_id && (
        <p className="text-highlight-ink flex items-start gap-2" role="status">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Fără loc ales: tabăra nu apare pe hartă.
        </p>
      )}
      {values.description?.trim() && (
        <div>
          <p className="text-muted-foreground">Descriere</p>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{values.description}</p>
        </div>
      )}
      {(values.rules.trim() || fisierRegulament) && (
        <div>
          <p className="text-muted-foreground">Regulament</p>
          {values.rules.trim() && (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{values.rules}</p>
          )}
          {fisierRegulament && (
            <p className="mt-1">
              Fișier: {fisierRegulament.name} · {fisierRegulament.eticheta} ·{' '}
              {fisierRegulament.marime}
            </p>
          )}
        </div>
      )}
      {values.necesar.length > 0 && (
        <dl>
          <Rand eticheta="Necesar">
            {values.necesar.map((c) => `${c.name} (${c.items.length})`).join(', ')}
          </Rand>
        </dl>
      )}
    </>
  )

  const preturi = (
    <>
      <dl>
        <Rand eticheta="Moneda">{moneda}</Rand>
      </dl>
      <div className="space-y-3" role="list" aria-label="Recapitulare prețuri">
        {values.varste.map((categorie, i) => (
          <div role="listitem" key={`${categorie.age_from}-${categorie.age_to}-${i}`}>
            <Pret
              titlu={etichetaVarsta(categorie.age_from, categorie.age_to)}
              componente={categorie.componente}
              currency={values.currency}
            />
          </div>
        ))}
        <div role="listitem">
          <Pret titlu="Adult" componente={values.adult.componente} currency={values.currency} />
        </div>
      </div>
    </>
  )

  return (
    <section className="space-y-5" aria-labelledby="pas-verificare">
      <div>
        <h2 id="pas-verificare" className="font-display text-lg font-bold">
          Verificare
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Verifică datele și prețurile, apoi creează tabăra.
        </p>
      </div>
      <Bloc titlu="Detalii" pas={0} onModifica={onModifica}>
        {detalii}
      </Bloc>
      <Bloc titlu="Prețuri" pas={1} onModifica={onModifica}>
        {preturi}
      </Bloc>
    </section>
  )
}
