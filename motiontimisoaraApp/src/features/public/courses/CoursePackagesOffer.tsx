import {
  pricePerSession,
  sessionsLabel,
  type CoursePackage,
} from '@/lib/course-packages/course-packages'
import { formatMoney } from '@/lib/money'

export function CoursePackagesOffer({
  packages,
  currency,
}: {
  packages: CoursePackage[]
  currency: string
}) {
  return (
    <ul
      data-section="course-enroll-packages"
      className="mt-4 w-full space-y-2 text-left"
      aria-label="Pachete de ședințe"
    >
      {[...packages]
        .sort((a, b) => a.position - b.position)
        .map((item) => (
          <li key={item.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{sessionsLabel(item.sessions)}</span>
              <span className="font-semibold tabular-nums">
                {formatMoney(item.price, currency)}
              </span>
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {formatMoney(pricePerSession(item), currency)} / ședință · fără expirare
            </p>
          </li>
        ))}
    </ul>
  )
}
