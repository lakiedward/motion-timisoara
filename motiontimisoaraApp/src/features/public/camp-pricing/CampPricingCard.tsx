import { OfferExchangeNote } from '@/components/OfferExchangeNote'
import { useQuery } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'
import { getMyChildren } from '@/api/account'
import { formatZi, sumaCategoriilor, type TabaraDetaliu } from '@/api/camps'
import { useAuth } from '@/lib/auth-context'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ageAtCampStart, matchesAgeCategory } from './age-category'

export default function CampPricingCard({
  data,
  ended,
  full,
  onEnroll,
}: {
  data: TabaraDetaliu
  ended: boolean
  full: boolean
  onEnroll: () => void
}) {
  const { tabara, categorii, agePrices } = data
  const { user } = useAuth()
  const byAge = tabara.pricing_mode === 'by_age'
  const personalize = byAge && user?.role === 'PARENT'
  const childrenQuery = useQuery({
    queryKey: ['children', user?.id],
    queryFn: getMyChildren,
    enabled: personalize,
  })
  const children =
    personalize && childrenQuery.isSuccess
      ? childrenQuery.data
          .filter((child) => child.parent_id === user.id)
          .map((child) => ({
            ...child,
            age: ageAtCampStart(child.birth_date, tabara.period_start),
          }))
      : []
  const missingCategory = children.filter(
    (child) => !agePrices.some((price) => matchesAgeCategory(child.age, price)),
  )
  const priceAvailable =
    !byAge ||
    (agePrices.length > 0 &&
      agePrices.every((price) => Number.isSafeInteger(price.amount) && price.amount >= 0))
  const canEnroll = !ended && !full && priceAvailable
  const breakdownTotal = sumaCategoriilor(categorii)

  return (
    <div className="bg-card shadow-card mt-8 rounded-3xl border p-6">
      <OfferExchangeNote offer={tabara} />
      {byAge && (
        <div>
          <h2 className="font-display mb-1 text-lg font-bold">Preț pe categorii de vârstă</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Se ia în calcul vârsta împlinită la începutul taberei, {formatZi(tabara.period_start)}.
          </p>
          {priceAvailable ? (
            <ul className="space-y-2" aria-label="Tarife pe vârste">
              {agePrices.map((price) => {
                const matching = children.filter((child) => matchesAgeCategory(child.age, price))
                return (
                  <li
                    key={price.id}
                    className={cn(
                      'rounded-xl border p-3',
                      matching.length > 0 && 'border-primary bg-primary/5',
                    )}
                  >
                    <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                      <span className="font-medium">
                        {price.age_from}–{price.age_to} ani
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatMoney(price.amount, tabara.currency)}
                      </span>
                    </div>
                    {matching.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <Badge variant="secondary">Categoria potrivită</Badge>
                        <p className="text-sm break-words">
                          Pentru {matching.map((child) => child.name).join(', ')}
                        </p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p role="alert" className="text-destructive text-sm">
              Prețurile pe vârste nu sunt disponibile. Contactează organizatorul.
            </p>
          )}
          {personalize && (
            <div className="mt-4 text-sm">
              {childrenQuery.isLoading ? (
                <div role="status" className="space-y-2">
                  <p className="text-muted-foreground">Se verifică categoriile copiilor tăi…</p>
                  <Skeleton className="h-8 w-full rounded-xl" />
                </div>
              ) : childrenQuery.isError ? (
                <div role="alert" className="space-y-2">
                  <p>
                    Nu am putut verifica categoriile copiilor tăi. Tarifele taberei sunt afișate mai
                    sus.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => void childrenQuery.refetch()}>
                    Reîncearcă
                  </Button>
                </div>
              ) : children.length === 0 ? (
                <p className="text-muted-foreground">
                  Nu ai copii înregistrați. Îi poți adăuga la înscriere.
                </p>
              ) : missingCategory.length > 0 ? (
                <ul className="text-muted-foreground space-y-1">
                  {missingCategory.map((child) => (
                    <li key={child.id}>
                      {child.age === null
                        ? `Vârsta lui ${child.name} nu poate fi calculată. Verifică data nașterii înainte de înscriere.`
                        : `${child.name}: nicio categorie disponibilă pentru ${child.age} ani la începutul taberei.`}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
      )}

      {categorii.length > 0 && (
        <div className={byAge ? 'mt-6 border-t pt-4' : undefined}>
          <h2 className="font-display mb-1 text-lg font-bold">Ce include prețul</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            {byAge
              ? 'Serviciile taberei sunt descrise mai jos.'
              : `Plătești o singură dată ${formatMoney(tabara.price, tabara.currency)}. Mai jos scrie pe ce se duc banii.`}
          </p>
          <ul className="divide-border divide-y">
            {categorii.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <div className="font-medium">{item.name}</div>
                  {item.description && (
                    <p className="text-muted-foreground mt-0.5 text-sm">{item.description}</p>
                  )}
                </div>
                {!byAge && (
                  <div className="shrink-0 font-semibold">
                    {formatMoney(item.amount, tabara.currency)}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!byAge && breakdownTotal !== Number(tabara.price) && (
            <p className="text-muted-foreground mt-3 text-xs">
              Desfășurarea de mai sus însumează {formatMoney(breakdownTotal, tabara.currency)}; suma
              de plată rămâne {formatMoney(tabara.price, tabara.currency)}.
            </p>
          )}
        </div>
      )}

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-4',
          (byAge || categorii.length > 0) && 'border-border mt-4 border-t pt-4',
        )}
      >
        <div>
          {byAge ? (
            <p className="text-muted-foreground text-sm">
              Prețul fiecărui copil se confirmă la înscriere.
            </p>
          ) : (
            <div className="font-display text-2xl font-extrabold">
              {formatMoney(tabara.price, tabara.currency)}
            </div>
          )}
          {!tabara.allow_cash && canEnroll && (
            <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
              <Wallet className="size-3.5" /> Doar plată cu cardul.
            </p>
          )}
        </div>
        {canEnroll ? (
          <Button className="h-11 min-h-11 px-6" onClick={onEnroll}>
            Înscrie-te
          </Button>
        ) : ended || full ? (
          <p className="text-muted-foreground text-sm font-medium">
            {ended
              ? 'Tabăra s-a încheiat, înscrierile sunt închise.'
              : 'Toate locurile sunt ocupate.'}
          </p>
        ) : null}
      </div>
    </div>
  )
}
