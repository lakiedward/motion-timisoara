import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { packageChoice, type CheckoutChoice } from '@/lib/course-packages/checkout-choice'
import {
  packageNote,
  sessionsLabel,
  type CoursePackage,
} from '@/lib/course-packages/course-packages'
import { MONTHLY, packageMonthOptions } from '@/lib/course-packages/package-month'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { RADIO } from './CheckoutPaymentStep'

const OPTION_FOCUS =
  'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'

export function CheckoutPackagePicker({
  packages,
  coursePackages = [],
  currency = 'RON',
  value,
  onChange,
}: {
  packages: number[]
  coursePackages?: CoursePackage[]
  currency?: string
  value: CheckoutChoice
  onChange: (choice: CheckoutChoice) => void
}) {
  if (coursePackages.length > 0) {
    const chosen = coursePackages.find((item) => item.id === value.packageId)
    const monthly = chosen?.validity === MONTHLY
    const months = packageMonthOptions()
    const month = months.find((option) => option.value === value.month) ?? months[0]
    return (
      <section
        aria-labelledby="checkout-package"
        className="space-y-3"
        data-section="checkout-course-packages"
      >
        <h3 id="checkout-package" className="text-sm font-semibold">
          Pachet de ședințe
        </h3>
        <div
          role="radiogroup"
          aria-labelledby="checkout-package"
          className="grid gap-2 sm:grid-cols-2"
        >
          {coursePackages.map((item) => {
            const selected = value.packageId === item.id
            return (
              <label
                key={item.id}
                className={cn(
                  'bg-card hover:border-primary/60 flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors',
                  selected && 'border-primary',
                )}
              >
                <input
                  type="radio"
                  name="course-package"
                  className={RADIO}
                  checked={selected}
                  onChange={() => onChange(packageChoice(item, value.month))}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{sessionsLabel(item.sessions)}</span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(item.price, currency)}
                    </span>
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    {packageNote(item, currency)}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
        {chosen && monthly && (
          <div className="space-y-2" data-section="checkout-package-month">
            <h4 id="checkout-package-month" className="text-sm font-semibold">
              Luna pachetului
            </h4>
            <div
              role="radiogroup"
              aria-labelledby="checkout-package-month"
              aria-describedby="checkout-package-month-rule"
              className="grid gap-2 sm:grid-cols-2"
            >
              {months.map((option) => {
                const selected = option.value === month.value
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'bg-card hover:border-primary/60 flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors',
                      selected && 'border-primary',
                    )}
                  >
                    <input
                      type="radio"
                      name="course-package-month"
                      className={RADIO}
                      checked={selected}
                      onChange={() => onChange(packageChoice(chosen, option.value))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{option.label}</span>
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        Valabil {option.range}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
            <p id="checkout-package-month-rule" className="text-muted-foreground text-sm">
              Plătești prețul întreg al pachetului, oricând l-ai cumpăra. Pachetul e valabil până pe{' '}
              <strong className="text-foreground">{month.lastDay}</strong>; ședințele nefolosite se
              pierd la sfârșitul lunii.
            </p>
          </div>
        )}
      </section>
    )
  }

  const custom = !packages.includes(value.sessions)
  return (
    <section aria-labelledby="checkout-package" className="space-y-3">
      <h3 id="checkout-package" className="text-sm font-semibold">
        Pachet de ședințe
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {packages.map((size) => (
          <button
            key={size}
            type="button"
            aria-pressed={value.sessions === size}
            onClick={() => onChange({ sessions: size })}
            className={cn(
              'min-h-touch-target rounded-full border px-4 text-sm font-medium transition-colors',
              OPTION_FOCUS,
              value.sessions === size
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card hover:border-primary/60',
            )}
          >
            {size} ședințe
          </button>
        ))}
        <div
          className={cn(
            'bg-card flex min-h-touch-target items-center gap-2 rounded-full border pr-1 pl-4',
            custom && 'border-primary',
          )}
        >
          <Label htmlFor="custom-package" className="text-muted-foreground shrink-0 text-sm">
            Altul
          </Label>
          <Input
            id="custom-package"
            type="number"
            min={1}
            className="h-9 min-w-0 flex-1 rounded-full border-0 bg-transparent px-2 text-right shadow-none dark:bg-transparent"
            value={value.sessions}
            onChange={(e) => onChange({ sessions: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
      </div>
    </section>
  )
}
