import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { toast } from 'sonner'

import {
  CASH_PAYMENTS_QUERY_KEY,
  confirmCashPayment,
  getCashPayments,
  type CashOfferKind,
} from '@/api/payments/cash-payments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusView } from '@/components/ui/status-view'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import { KIND_LABEL } from '@/features/account/enrollments/enrollment-display'
import { plural } from '@/lib/plural'
import { CashPaymentRow } from './CashPaymentRow'
import {
  NO_CASH_FILTERS,
  cashKindOptions,
  cashStatusCounts,
  filterCashPayments,
  groupCashPayments,
  hasCashFilters,
  type CashFilters,
  type CashStatusFilter,
} from './cash-payment-list'

const TOUCH = 'h-touch-target min-h-touch-target lg:h-9 lg:min-h-9'

const STATUS_OPTIONS: FilterOption<CashStatusFilter>[] = [
  { value: 'attention', label: 'De confirmat' },
  { value: 'confirmed', label: 'Încasate' },
  { value: 'all', label: 'Toate' },
]

const EMPTY_TEXT: Record<CashStatusFilter, string> = {
  attention: 'Nu ai plăți cash de confirmat.',
  confirmed: 'Nu ai încă plăți cash încasate în ultimele 90 de zile.',
  all: 'Nu ai încă plăți cash.',
}

export default function CashPaymentsPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<CashFilters>(NO_CASH_FILTERS)
  const [armedId, setArmedId] = useState<string | null>(null)
  const {
    data: payments = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({ queryKey: CASH_PAYMENTS_QUERY_KEY, queryFn: getCashPayments })

  const confirm = useMutation({
    mutationFn: confirmCashPayment,
    onSuccess: () => {
      setArmedId(null)
      toast.success('Încasarea a fost confirmată. Înscrierea este activă.')
    },
    onError: (error: Error) => toast.error(error.message || 'Nu am putut confirma încasarea.'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CASH_PAYMENTS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] })
    },
  })

  const visible = useMemo(() => filterCashPayments(payments, filters), [payments, filters])
  const groups = useMemo(() => groupCashPayments(visible), [visible])
  const counts = useMemo(() => cashStatusCounts(payments), [payments])
  const kinds = useMemo(() => cashKindOptions(payments, filters.status), [payments, filters.status])
  const set = (patch: Partial<CashFilters>) => setFilters((f) => ({ ...f, ...patch }))

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-foreground mr-auto text-2xl font-bold">Încasări cash</h1>
        {payments.length > 0 && (
          <div className="relative order-last w-full md:order-none md:w-80">
            <Search
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              type="search"
              value={filters.query}
              onChange={(e) => set({ query: e.target.value })}
              placeholder="Caută participant sau ofertă"
              aria-label="Caută plăți cash după participant sau ofertă"
              className={`${TOUCH} pl-9`}
            />
          </div>
        )}
      </div>
      <p className="text-muted-foreground mb-4 max-w-2xl text-sm">
        Confirmă plata numai după ce ai primit banii de la părinte sau participant. Înscrierea
        devine activă, iar la cursuri copilul primește ședințele plătite.
      </p>

      {isLoading ? (
        <StatusView state="loading" title="Se încarcă plățile cash" rowHeight={72} />
      ) : isError ? (
        <StatusView
          state="error"
          title="Nu am putut încărca plățile cash."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : payments.length === 0 ? (
        <StatusView
          state="empty"
          title={EMPTY_TEXT.all}
          text="Aici apar înscrierile la cursuri, activități și tabere pe care părinții aleg să le plătească cash."
        />
      ) : (
        <>
          <CourseFilterBar
            status={filters.status}
            sport={filters.kind}
            statusCounts={counts}
            sports={kinds}
            statusOptions={STATUS_OPTIONS}
            onStatus={(status) => set({ status })}
            onSport={(kind) => set({ kind: kind as CashOfferKind | '' })}
            selectId="cash-payment-kind"
            sportLabel="Tip"
            allSportsLabel="Toate tipurile"
            statusLabel="Stare plată"
          />
          <p role="status" className="text-muted-foreground mb-3 text-sm">
            {visible.length > 0 &&
              `${plural(visible.length, 'plată', 'plăți')} în ${plural(groups.length, 'ofertă', 'oferte')}`}
          </p>
          {visible.length === 0 ? (
            <StatusView
              state="empty"
              title={
                hasCashFilters(filters)
                  ? 'Nicio plată pentru filtrele alese.'
                  : EMPTY_TEXT[filters.status]
              }
              text={hasCashFilters(filters) ? 'Schimbă căutarea sau tipul.' : undefined}
              action={
                hasCashFilters(filters) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={`${TOUCH} mt-3`}
                    onClick={() => set({ kind: '', query: '' })}
                  >
                    Șterge filtrele
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="grid gap-8">
              {groups.map((group) => (
                <section key={group.key} aria-label={group.title} className="grid gap-3">
                  <h2 className="text-muted-foreground text-sm font-semibold">
                    {KIND_LABEL[group.kind]} · {group.title} · {group.payments.length}
                  </h2>
                  <ul className="bg-card divide-y overflow-hidden rounded-xl border">
                    {group.payments.map((payment) => (
                      <CashPaymentRow
                        key={payment.payment_id}
                        payment={payment}
                        armed={armedId === payment.payment_id}
                        busy={confirm.isPending}
                        onConfirm={() =>
                          armedId === payment.payment_id
                            ? confirm.mutate(payment.payment_id)
                            : setArmedId(payment.payment_id)
                        }
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
