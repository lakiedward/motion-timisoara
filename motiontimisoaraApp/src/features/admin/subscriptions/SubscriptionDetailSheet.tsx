import type { AdminSubscription } from '@/api/subscriptions/admin-subscriptions'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatRon } from '@/lib/money'
import { formatShortDate, formatShortDateTime } from '@/lib/panel-date'
import { plural } from '@/lib/plural'
import { ExtendSubscriptionForm } from './ExtendSubscriptionForm'
import { STATUS_BADGE, TYPE_LABEL, planLabel, statusVariant } from './subscription-admin'

function Adjustments({ subscription }: { subscription: AdminSubscription }) {
  if (subscription.adjustments.length === 0) return null
  return (
    <section aria-labelledby="adjustments-title" className="space-y-2">
      <h3 id="adjustments-title" className="font-display font-semibold">
        Prelungiri făcute
      </h3>
      <ol className="space-y-3 border-l pl-4 text-sm">
        {subscription.adjustments.map((adjustment) => (
          <li key={adjustment.id}>
            <span className="block font-medium">{plural(adjustment.days, 'zi', 'zile')}</span>
            <span className="text-muted-foreground block">
              {formatShortDateTime(adjustment.created_at)} · {adjustment.admin_name ?? 'Administrator'}
            </span>
            <span className="block wrap-anywhere">„{adjustment.reason}”</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function SubscriptionDetailSheet({
  subscription,
  onClose,
}: {
  subscription: AdminSubscription | null
  onClose: () => void
}) {
  const lines: [string, string | null][] = subscription
    ? [
        ['Tip', TYPE_LABEL[subscription.subscriber_type]],
        ['Email', subscription.subscriber_email],
        [
          'Pachet',
          subscription.price_bani !== null
            ? `${planLabel(subscription)} · ${formatRon(subscription.price_bani)} pe lună`
            : planLabel(subscription),
        ],
        [
          'Trece la pachetul',
          subscription.scheduled_plan_name ? `${subscription.scheduled_plan_name}, la final` : null,
        ],
        [
          'Antrenori în club',
          subscription.coach_count !== null ? String(subscription.coach_count) : null,
        ],
        [
          'Perioada gratuită până pe',
          subscription.status === 'trialing' && subscription.trial_end
            ? formatShortDate(subscription.trial_end)
            : null,
        ],
        [
          'Perioada plătită până pe',
          subscription.current_period_end ? formatShortDate(subscription.current_period_end) : null,
        ],
        [
          'Accesul se încheie',
          subscription.access_end ? formatShortDate(subscription.access_end) : null,
        ],
        ['Plată în Stripe', subscription.has_stripe_subscription ? 'Da' : 'Nu'],
        ['Creat pe', formatShortDate(subscription.created_at)],
      ]
    : []

  return (
    <Sheet open={!!subscription} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {subscription && (
          <>
            <SheetHeader>
              <SheetTitle className="font-display pr-8 wrap-anywhere">
                {subscription.subscriber_name}
              </SheetTitle>
              <SheetDescription>
                {TYPE_LABEL[subscription.subscriber_type]} · {planLabel(subscription)}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-5 px-4 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(subscription.status)}>
                  {STATUS_BADGE[subscription.status]}
                </Badge>
                {subscription.cancel_at_period_end && subscription.status === 'active' && (
                  <Badge variant="outline">Se oprește la final</Badge>
                )}
              </div>
              <dl className="grid gap-3 text-sm">
                {lines
                  .filter((line): line is [string, string] => !!line[1])
                  .map(([label, value]) => (
                    <div key={label} className="grid gap-0.5">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium wrap-anywhere">{value}</dd>
                    </div>
                  ))}
              </dl>
              <Adjustments subscription={subscription} />
              <ExtendSubscriptionForm
                key={subscription.id}
                subscription={subscription}
                onDone={onClose}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
