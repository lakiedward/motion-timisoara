import { ChevronDown } from 'lucide-react'
import { AcceptedPriceDetails } from '@/components/AcceptedPriceDetails'
import { Badge } from '@/components/ui/badge'
import { formatRonOffer } from '@/lib/money'

export type SummaryLine = {
  id: string
  name: string
  adult?: boolean
  amount?: number
  snapshot?: unknown
}

function participantLabel(lines: SummaryLine[]) {
  const count = lines.length
  if (lines.some((line) => line.adult))
    return `${count} ${count === 1 ? 'participant' : 'participanți'}`
  return `${count} ${count === 1 ? 'copil' : 'copii'}`
}

function price(amount: number | undefined) {
  return amount === undefined ? 'Preț indisponibil' : formatRonOffer(amount)
}

function Lines({ lines }: { lines: SummaryLine[] }) {
  return (
    <ul className="space-y-2">
      {lines.map((line) => (
        <li key={line.id} className="flex items-start justify-between gap-3 text-sm">
          <div className="min-w-0">
            <span className="break-words">{line.name}</span>
            {line.adult && (
              <Badge variant="outline" className="ml-2">
                Adult
              </Badge>
            )}
            <AcceptedPriceDetails snapshot={line.snapshot} />
          </div>
          <span className="shrink-0 font-medium tabular-nums">{price(line.amount)}</span>
        </li>
      ))}
    </ul>
  )
}

export function CheckoutOrderSummary({
  title,
  kindLabel,
  packageSize,
  lines,
  total,
  direction = import.meta.env.VITE_SUMMARY_DIRECTION === 'B' ? 'B' : 'A',
}: {
  title: string
  kindLabel: string
  packageSize?: number
  lines: SummaryLine[]
  total?: number
  direction?: 'A' | 'B'
}) {
  const meta = [
    participantLabel(lines),
    packageSize !== undefined && `pachet de ${packageSize} ședințe`,
  ]
    .filter(Boolean)
    .join(' · ')

  if (direction === 'B') {
    return (
      <section
        data-section="sumar-comanda"
        aria-labelledby="checkout-summary"
        className="space-y-3 border-b pb-6"
      >
        <h3
          id="checkout-summary"
          className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
        >
          Sumar comandă
        </h3>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <p className="font-medium break-words">{title}</p>
            <p className="text-muted-foreground text-sm">
              {kindLabel} · {meta}
            </p>
          </div>
          <p className="font-display text-3xl font-bold tabular-nums">{price(total)}</p>
        </div>
        <details className="group">
          <summary className="text-primary focus-visible:outline-ring min-h-touch-target inline-flex cursor-pointer list-none items-center gap-1 rounded-md text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
            Vezi prețul pe fiecare participant
            <ChevronDown
              aria-hidden="true"
              className="size-4 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="pt-2">
            <Lines lines={lines} />
          </div>
        </details>
      </section>
    )
  }

  return (
    <section
      data-section="sumar-comanda"
      aria-labelledby="checkout-summary"
      className="bg-muted space-y-4 rounded-xl p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="checkout-summary" className="font-semibold">
            Sumar comandă
          </h3>
          <p className="text-muted-foreground mt-1 text-sm break-words">{title}</p>
        </div>
        <Badge variant="outline">{kindLabel}</Badge>
      </div>
      <Lines lines={lines} />
      <div className="flex items-end justify-between gap-3 border-t pt-4">
        <div>
          <p className="font-semibold">Total</p>
          <p className="text-muted-foreground text-sm">{meta}</p>
        </div>
        <p className="font-display shrink-0 text-xl font-bold tabular-nums">{price(total)}</p>
      </div>
    </section>
  )
}
