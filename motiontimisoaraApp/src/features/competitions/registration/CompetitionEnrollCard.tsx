import { formatCompetitionDateTime } from '@/lib/competition-schedule'
import { formatRon, formatRonOffer } from '@/lib/money'
import { plural } from '@/lib/plural'

export function CompetitionEnrollCard({
  categoriesAnchor,
  deadlineAt,
  prices,
  loading,
  now,
}: {
  categoriesAnchor: string
  deadlineAt: string | null
  prices: number[]
  loading: boolean
  now: number
}) {
  const lowest = prices.length ? Math.min(...prices) : null
  const highest = prices.length ? Math.max(...prices) : null
  const closed = deadlineAt !== null && Date.parse(deadlineAt) <= now
  const message = closed
    ? 'Înscrierile la acest concurs s-au încheiat.'
    : !deadlineAt || !prices.length
      ? 'Înscrierile se deschid după ce organizatorul adaugă categoriile.'
      : null

  return (
    <div
      data-section="competition-enroll"
      className="bg-card flex flex-col items-center rounded-xl border p-6 text-center"
    >
      {lowest !== null && highest !== null && (
        <>
          <div className="font-display text-foreground text-3xl font-extrabold">
            {lowest === highest ? (
              formatRonOffer(lowest)
            ) : (
              <>
                <span className="whitespace-nowrap">{formatRonOffer(lowest)}</span> –{' '}
                <span className="whitespace-nowrap">{formatRon(highest)}</span>
              </>
            )}
          </div>
          {prices.length > 1 && (
            <p className="text-muted-foreground mt-1 text-sm">
              {plural(prices.length, 'categorie', 'categorii')}, fiecare cu prețul ei
            </p>
          )}
        </>
      )}
      {deadlineAt && (
        <p className="text-muted-foreground mt-2 text-sm">
          Ultima înscriere: {formatCompetitionDateTime(deadlineAt)}
        </p>
      )}
      {loading ? null : message ? (
        <p className="text-muted-foreground bg-muted mt-5 w-full rounded-lg px-4 py-3 text-sm font-medium">
          {message}
        </p>
      ) : (
        <a href={`#${categoriesAnchor}`} className="btn-cta btn-cta--primary mt-5 w-full">
          Alege categoria
        </a>
      )}
    </div>
  )
}
