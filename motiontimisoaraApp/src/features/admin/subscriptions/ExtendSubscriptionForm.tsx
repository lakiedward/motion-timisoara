import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { toast } from 'sonner'

import {
  ADMIN_SUBSCRIPTIONS_QUERY_KEY,
  extendSubscription,
  type AdminSubscription,
} from '@/api/subscriptions/admin-subscriptions'
import { SUBSCRIPTION_QUERY_KEY } from '@/api/subscriptions/subscriptions'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatShortDate } from '@/lib/panel-date'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import { EXTENSION_PRESETS, extensionPreview } from './subscription-admin'

const TOUCH = 'h-touch-target min-h-touch-target lg:h-9 lg:min-h-9'
const PILL = 'h-touch-target min-h-touch-target shrink-0 rounded-full lg:h-9 lg:min-h-9'

function parseDays(text: string): number {
  return /^\d{1,3}$/.test(text.trim()) ? Number(text.trim()) : Number.NaN
}

export function ExtendSubscriptionForm({
  subscription,
  onDone,
}: {
  subscription: AdminSubscription
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [daysText, setDaysText] = useState('30')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [touched, setTouched] = useState(false)
  const [now] = useState(() => Date.now())

  const days = parseDays(daysText)
  const preview = extensionPreview(subscription, days, now)
  const daysError =
    touched && preview === null && subscription.status !== 'trialing'
      ? 'Scrie un număr de zile între 1 și 366.'
      : touched && !(days >= 1 && days <= 366)
        ? 'Scrie un număr de zile între 1 și 366.'
        : null
  const reasonError =
    touched && reason.trim().length < 3 ? 'Scrie motivul (minim 3 caractere).' : null
  const valid = preview !== null && reason.trim().length >= 3

  const extend = useMutation({
    mutationFn: extendSubscription,
    onSuccess: (result) => {
      setConfirming(false)
      toast.success(
        `Abonamentul este gratuit până pe ${formatShortDate(result.newEnd)}.${
          result.stripeUpdated ? ' Stripe nu va încasa nimic înainte.' : ''
        }`,
      )
      onDone()
    },
    onError: (error: Error) => {
      setConfirming(false)
      toast.error(error.message || 'Nu am putut prelungi abonamentul.')
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_SUBSCRIPTIONS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY })
    },
  })

  if (subscription.status === 'trialing' && !subscription.access_end) {
    return (
      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          Perioada gratuită nu are încă o dată de încheiere, pentru că lansarea abonamentelor nu a
          fost setată. Nu e nimic de prelungit acum.
        </span>
      </p>
    )
  }

  const submit = () => {
    setTouched(true)
    if (valid) setConfirming(true)
  }

  return (
    <section
      aria-labelledby="extend-title"
      className="bg-card space-y-4 rounded-xl border p-4"
    >
      <h3 id="extend-title" className="font-display font-semibold">
        Prelungire gratuită
      </h3>
      <div role="group" aria-label="Câte zile" className="flex flex-wrap gap-2">
        {EXTENSION_PRESETS.map((preset) => (
          <Button
            key={preset}
            type="button"
            variant={days === preset ? 'default' : 'outline'}
            aria-pressed={days === preset}
            className={PILL}
            onClick={() => setDaysText(String(preset))}
          >
            {preset} zile
          </Button>
        ))}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="extend-days">Sau alt număr de zile (1–366)</Label>
        <Input
          id="extend-days"
          inputMode="numeric"
          autoComplete="off"
          value={daysText}
          onChange={(e) => setDaysText(e.target.value)}
          aria-invalid={!!daysError}
          aria-describedby={daysError ? 'extend-days-error' : undefined}
        />
        {daysError && (
          <p id="extend-days-error" className="text-destructive text-sm">
            {daysError}
          </p>
        )}
      </div>
      {preview && (
        <p className="bg-muted/40 rounded-xl border px-4 py-3 text-sm" role="status">
          Gratuit până pe <strong>{formatShortDate(preview)}</strong> ({plural(days, 'zi', 'zile')}{' '}
          după{' '}
          {subscription.access_end && Date.parse(subscription.access_end) > now
            ? 'data curentă de încheiere'
            : 'azi'}
          ).
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="extend-reason">Motiv (apare în istoric)</Label>
        <Textarea
          id="extend-reason"
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={!!reasonError}
          aria-describedby={reasonError ? 'extend-reason-error' : undefined}
        />
        {reasonError && (
          <p id="extend-reason-error" className="text-destructive text-sm">
            {reasonError}
          </p>
        )}
      </div>
      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          {subscription.has_stripe_subscription
            ? 'Mutăm și data din Stripe, deci nu se încasează nimic înainte de data nouă. Prelungirea se vede imediat în pagina Abonament a antrenorului sau clubului.'
            : 'Abonamentul nu are plată în Stripe. Prelungirea se vede imediat în pagina Abonament a antrenorului sau clubului.'}
        </span>
      </p>
      <Button
        type="button"
        className={cn(TOUCH, 'w-full')}
        disabled={extend.isPending}
        onClick={submit}
      >
        Prelungește gratuit
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Prelungești ${subscription.subscriber_name} cu ${plural(days, 'zi', 'zile')}?`}
        description={
          preview
            ? `Gratuit până pe ${formatShortDate(preview)}. Motivul rămâne în istoric.${
                subscription.has_stripe_subscription ? ' Data din Stripe se mută și ea.' : ''
              }`
            : undefined
        }
        confirmLabel="Da, prelungește"
        pending={extend.isPending}
        onConfirm={() =>
          extend.mutate({
            subscriptionId: subscription.id,
            days,
            reason: reason.trim(),
          })
        }
      />
    </section>
  )
}
