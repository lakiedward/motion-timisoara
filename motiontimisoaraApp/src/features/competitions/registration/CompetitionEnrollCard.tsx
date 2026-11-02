import { Link } from 'react-router-dom'

import { formatCompetitionDateTime } from '@/lib/competition-schedule'
import { formatRonOffer } from '@/lib/money'

export function CompetitionEnrollCard({
  slug,
  deadlineAt,
  prices,
  loading,
  now,
}: {
  slug: string
  deadlineAt: string | null
  prices: number[]
  loading: boolean
  now: number
}) {
  const lowest = prices.length ? Math.min(...prices) : null
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
      {lowest !== null && (
        <div className="font-display text-foreground text-3xl font-extrabold whitespace-nowrap">
          {prices.length > 1 && lowest > 0 && (
            <span className="text-muted-foreground font-sans text-base font-normal">de la </span>
          )}
          {formatRonOffer(lowest)}
        </div>
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
        <Link
          to={`/account/competitions/${slug}/register`}
          className="btn-cta btn-cta--primary mt-5 w-full"
        >
          Înscrie-te
        </Link>
      )}
    </div>
  )
}
