import { Link } from 'react-router-dom'

import { formatRonOffer } from '@/lib/money'
import { Checkbox } from '@/components/ui/checkbox'

export type PriceLine = { key: string; label: string; amount: number | undefined }

export function CompetitionPriceStep({
  lines,
  total,
  accepted,
  disabled,
  onAcceptedChange,
}: {
  lines: PriceLine[]
  total: number | undefined
  accepted: boolean
  disabled: boolean
  onAcceptedChange: (value: boolean) => void
}) {
  return (
    <section className="space-y-5">
      <div className="rounded-xl border p-4">
        {lines.map((line) => (
          <div key={line.key} className="flex items-center justify-between gap-3 py-1 text-sm">
            <span className="min-w-0">{line.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {line.amount === undefined ? 'Preț indisponibil' : formatRonOffer(line.amount)}
            </span>
          </div>
        ))}
        <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 font-semibold">
          <span>Total</span>
          <span className="shrink-0 tabular-nums">
            {total === undefined ? 'Preț indisponibil' : formatRonOffer(total)}
          </span>
        </div>
      </div>

      <label className="flex min-h-touch-target items-start gap-3 text-sm">
        <Checkbox
          checked={accepted}
          disabled={disabled}
          onChange={(event) => onAcceptedChange(event.target.checked)}
        />
        <span>
          Confirm categoriile și suma finală în lei și accept{' '}
          <Link to="/termeni" className="text-primary font-medium">
            termenii și condițiile
          </Link>
          .
        </span>
      </label>
    </section>
  )
}
