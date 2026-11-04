import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Info, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import {
  ADMIN_PAYMENTS_QUERY_KEY,
  refundPayment,
  type AdminPayment,
  type AdminRefund,
} from '@/api/payments/admin-payments'
import { CASH_PAYMENTS_QUERY_KEY, confirmCashPayment } from '@/api/payments/cash-payments'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import {
  bucharestDay,
  cardLabel,
  dayTitle,
  describe,
  parseRonInput,
  paymentTime,
  refundableAmount,
  statusLabel,
  statusOf,
  statusVariant,
  timeOf,
} from './payment-history'

const TOUCH = 'h-touch-target min-h-touch-target lg:h-9 lg:min-h-9'
const PILL = 'h-touch-target min-h-touch-target shrink-0 rounded-full lg:h-9 lg:min-h-9'

const REFUND_STATUS: Record<AdminRefund['status'], string> = {
  pending: 'În curs',
  succeeded: 'Finalizată',
  failed: 'Eșuată',
  canceled: 'Anulată',
  requires_action: 'Așteaptă acțiune',
}

const when = (value: string) => `${dayTitle(bucharestDay(value))}, ${timeOf(value)}`

function feeNote(payment: AdminPayment) {
  if (payment.method === 'CASH') {
    return 'Rambursarea cash doar se notează: confirmi că ai dat banii înapoi personal.'
  }
  if (payment.source === 'SUBSCRIPTION_INVOICE') {
    return 'Banii se întorc pe card în 5–10 zile lucrătoare. Costul Stripe al abonamentului rămâne al platformei.'
  }
  return `Banii se întorc pe card în 5–10 zile lucrătoare. Partea lui ${payment.receiver_name} se retrage din contul lui Stripe. Costul Stripe nu se întoarce la rambursare: îl suportă antrenorul sau clubul.`
}

function History({ payment }: { payment: AdminPayment }) {
  return (
    <section aria-labelledby="payment-history-title" className="space-y-2">
      <h3 id="payment-history-title" className="font-display font-semibold">
        Istoric
      </h3>
      <ol className="space-y-3 border-l pl-4 text-sm">
        <li>
          <span className="font-medium">
            {payment.status === 'FAILED'
              ? 'Plată eșuată'
              : payment.status === 'PENDING'
                ? 'Înscriere, plata nu e încă încasată'
                : 'Plată încasată'}
          </span>
          <span className="text-muted-foreground block">{when(paymentTime(payment))}</span>
        </li>
        {payment.refunds.map((refund) => (
          <li key={refund.id}>
            <span className="flex flex-wrap items-center gap-2 font-medium">
              Rambursare {formatMoney(refund.amount, payment.currency)}
              <Badge
                variant={
                  refund.status === 'succeeded'
                    ? 'success'
                    : refund.status === 'failed'
                      ? 'destructive'
                      : 'outline'
                }
              >
                {REFUND_STATUS[refund.status]}
              </Badge>
            </span>
            <span className="text-muted-foreground block">
              {when(refund.created_at)} ·{' '}
              {refund.origin === 'STRIPE' ? 'din Stripe' : (refund.admin_name ?? 'Administrator')}
            </span>
            <span className="block wrap-anywhere">„{refund.reason}”</span>
            {refund.failure_reason && (
              <span className="text-destructive block text-xs">{refund.failure_reason}</span>
            )}
            {refund.cancel_enrollment && (
              <span className="text-muted-foreground block text-xs">
                Înscrierea a fost anulată.
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

function RefundForm({ payment, onDone }: { payment: AdminPayment; onDone: () => void }) {
  const queryClient = useQueryClient()
  const left = refundableAmount(payment)
  const [mode, setMode] = useState<'full' | 'partial'>('full')
  const [amountText, setAmountText] = useState('')
  const [reason, setReason] = useState('')
  const [cancelEnrollment, setCancelEnrollment] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [touched, setTouched] = useState(false)

  const amount = mode === 'full' ? left : parseRonInput(amountText)
  const amountError =
    mode === 'partial' && touched
      ? amount === null
        ? 'Scrie o sumă în lei, de exemplu 120 sau 120,50.'
        : amount > left
          ? `Poți rambursa cel mult ${formatMoney(left, payment.currency)}.`
          : null
      : null
  const reasonError =
    touched && reason.trim().length < 3 ? 'Scrie motivul (minim 3 caractere).' : null
  const valid = amount !== null && amount > 0 && amount <= left && reason.trim().length >= 3
  const canCancel =
    payment.source === 'PAYMENT' && amount === left && payment.enrollment_status !== 'CANCELLED'

  const refund = useMutation({
    mutationFn: refundPayment,
    onSuccess: (result) => {
      setConfirming(false)
      toast.success(
        result.status === 'succeeded'
          ? 'Rambursarea s-a făcut.'
          : 'Rambursarea a pornit. Starea se actualizează când răspunde Stripe.',
      )
      onDone()
    },
    onError: (error: Error) => {
      setConfirming(false)
      toast.error(error.message || 'Nu am putut face rambursarea.')
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_PAYMENTS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: CASH_PAYMENTS_QUERY_KEY })
    },
  })

  const submit = () => {
    setTouched(true)
    if (valid) setConfirming(true)
  }

  return (
    <section aria-labelledby="refund-title" className="bg-card space-y-4 rounded-xl border p-4">
      <h3 id="refund-title" className="font-display font-semibold">
        Rambursează
      </h3>
      <div role="group" aria-label="Cât rambursezi" className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={mode === 'full' ? 'default' : 'outline'}
          aria-pressed={mode === 'full'}
          className={PILL}
          onClick={() => setMode('full')}
        >
          Tot ({formatMoney(left, payment.currency)})
        </Button>
        <Button
          type="button"
          variant={mode === 'partial' ? 'default' : 'outline'}
          aria-pressed={mode === 'partial'}
          className={PILL}
          onClick={() => setMode('partial')}
        >
          Parțial
        </Button>
      </div>
      {mode === 'partial' && (
        <div className="grid gap-1.5">
          <Label htmlFor="refund-amount">Sumă (lei)</Label>
          <Input
            id="refund-amount"
            inputMode="decimal"
            autoComplete="off"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            aria-invalid={!!amountError}
            aria-describedby={amountError ? 'refund-amount-error' : undefined}
          />
          {amountError && (
            <p id="refund-amount-error" className="text-destructive text-sm">
              {amountError}
            </p>
          )}
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="refund-reason">Motiv (apare în istoric)</Label>
        <Textarea
          id="refund-reason"
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={!!reasonError}
          aria-describedby={reasonError ? 'refund-reason-error' : undefined}
        />
        {reasonError && (
          <p id="refund-reason-error" className="text-destructive text-sm">
            {reasonError}
          </p>
        )}
      </div>
      {canCancel && (
        <label className="flex min-h-touch-target cursor-pointer items-start gap-3 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={cancelEnrollment}
            onChange={(e) => setCancelEnrollment(e.target.checked)}
          />
          <span>Anulează și înscrierea (participantul nu mai apare la prezență)</span>
        </label>
      )}
      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{feeNote(payment)}</span>
      </p>
      <Button
        type="button"
        variant="destructive"
        className={cn(TOUCH, 'w-full')}
        disabled={refund.isPending}
        onClick={submit}
      >
        {amount && amount <= left
          ? `Rambursează ${formatMoney(amount, payment.currency)}`
          : 'Rambursează'}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Rambursezi ${amount ? formatMoney(amount, payment.currency) : ''} către ${payment.payer_name ?? 'plătitor'}?`}
        description={`${describe(payment)} · ${cardLabel(payment)}. ${
          payment.method === 'CARD' ? 'Stripe nu poate anula o rambursare trimisă.' : ''
        }${canCancel && cancelEnrollment ? ' Înscrierea se anulează.' : ''}`}
        confirmLabel="Da, rambursează"
        destructive
        pending={refund.isPending}
        onConfirm={() =>
          amount &&
          refund.mutate({
            source: payment.source,
            id: payment.id,
            amount,
            reason: reason.trim(),
            cancelEnrollment: canCancel && cancelEnrollment,
          })
        }
      />
    </section>
  )
}

function CashConfirm({ payment }: { payment: AdminPayment }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const confirm = useMutation({
    mutationFn: confirmCashPayment,
    onSuccess: () => {
      setOpen(false)
      toast.success('Încasarea a fost confirmată. Înscrierea este activă.')
    },
    onError: (error: Error) => toast.error(error.message || 'Nu am putut confirma încasarea.'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_PAYMENTS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: CASH_PAYMENTS_QUERY_KEY })
    },
  })
  return (
    <>
      <Button type="button" className={TOUCH} onClick={() => setOpen(true)}>
        Confirmă încasarea
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`S-au primit ${formatMoney(payment.amount, payment.currency)} de la ${payment.payer_name ?? 'plătitor'}?`}
        description="Confirmă numai după ce organizatorul a primit banii. Înscrierea devine activă imediat."
        confirmLabel="Da, banii au fost primiți"
        pending={confirm.isPending}
        onConfirm={() => confirm.mutate(payment.id)}
      />
    </>
  )
}

export function PaymentDetailSheet({
  payment,
  onClose,
}: {
  payment: AdminPayment | null
  onClose: () => void
}) {
  const [refunding, setRefunding] = useState(false)
  const close = () => {
    setRefunding(false)
    onClose()
  }
  const left = payment ? refundableAmount(payment) : 0
  const lines: [string, string | null][] = payment
    ? [
        [
          'Cine a plătit',
          [payment.payer_name, payment.payer_email].filter(Boolean).join(' · ') || null,
        ],
        [
          'Participant',
          payment.participant_name
            ? `${payment.participant_name}${payment.is_adult ? ' (adult)' : ''}`
            : null,
        ],
        ['Pentru', describe(payment)],
        ['Metodă', payment.method === 'CARD' ? `Card prin Stripe · ${cardLabel(payment)}` : 'Cash'],
        ['Când', when(paymentTime(payment))],
        ['Banii merg la', payment.receiver_name],
        [
          'Cost Stripe reținut',
          payment.stripe_fee_amount != null
            ? formatMoney(payment.stripe_fee_amount, payment.currency)
            : null,
        ],
        ['Referință Stripe', payment.gateway_ref],
      ]
    : []

  return (
    <Sheet open={!!payment} onOpenChange={(open) => !open && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {payment && (
          <>
            <SheetHeader>
              <SheetTitle className="font-display pr-8 wrap-anywhere">
                {payment.payer_name ?? 'Plătitor necunoscut'}
              </SheetTitle>
              <SheetDescription>{describe(payment)}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-5 px-4 pb-6">
              <div className="bg-muted/40 rounded-xl border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-muted-foreground text-sm">Sumă</p>
                  <Badge variant={statusVariant(payment)}>{statusLabel(payment)}</Badge>
                </div>
                <p className="font-display text-3xl font-extrabold tabular-nums">
                  {formatMoney(payment.amount, payment.currency)}
                </p>
                {payment.amount_refunded > 0 && (
                  <p className="text-muted-foreground text-sm">
                    Rambursat {formatMoney(payment.amount_refunded, payment.currency)} · rămas{' '}
                    {formatMoney(payment.amount - payment.amount_refunded, payment.currency)}
                  </p>
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
              <History payment={payment} />
              {statusOf(payment) === 'cash' && <CashConfirm payment={payment} />}
              {left > 0 &&
                (refunding ? (
                  <RefundForm key={payment.id} payment={payment} onDone={close} />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className={TOUCH}
                    onClick={() => setRefunding(true)}
                  >
                    <RotateCcw aria-hidden="true" className="size-4" /> Rambursează
                  </Button>
                ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
