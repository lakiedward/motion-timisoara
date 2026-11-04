import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'

import {
  ADMIN_PAYMENTS_QUERY_KEY,
  getAdminPayments,
  type AdminPayment,
} from '@/api/payments/admin-payments'
import { FilterSearch } from '@/components/catalog-filters/FilterSearch'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SelectMenu } from '@/components/ui/select-menu'
import { StatusView } from '@/components/ui/status-view'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import { formatRon } from '@/lib/money'
import { plural } from '@/lib/plural'
import { PaymentDayList } from './PaymentDayList'
import { PaymentDetailSheet } from './PaymentDetailSheet'
import { PaymentPeriod } from './PaymentPeriod'
import {
  NO_PAYMENT_FILTERS,
  filterPayments,
  groupByDay,
  hasPaymentFilters,
  paymentTotals,
  paymentsCsv,
  presetDays,
  rangeOf,
  statusCounts,
  validDays,
  type DayRange,
  type PaymentFilters,
  type PaymentMethodFilter,
  type PaymentStatusFilter,
  type PaymentTypeFilter,
  type PeriodPreset,
} from './payment-history'

const TOUCH = 'h-touch-target min-h-touch-target lg:h-9 lg:min-h-9'

const STATUS_OPTIONS: FilterOption<PaymentStatusFilter>[] = [
  { value: 'all', label: 'Toate' },
  { value: 'paid', label: 'Plătite' },
  { value: 'cash', label: 'De confirmat' },
  { value: 'refunded', label: 'Rambursate' },
  { value: 'failed', label: 'Eșuate' },
]

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-card min-w-0 rounded-xl border px-4 py-3">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="font-display mt-1 text-xl font-extrabold break-words tabular-nums sm:text-2xl">
        {value}
      </dd>
      {note && <dd className="text-muted-foreground mt-0.5 text-xs">{note}</dd>}
    </div>
  )
}

function download(payments: AdminPayment[], days: DayRange) {
  const blob = new Blob([paymentsCsv(payments)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `plati-${days.start}-${days.end}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function AdminPaymentsPage() {
  const [preset, setPreset] = useState<PeriodPreset>('month')
  const [days, setDays] = useState<DayRange>(() => presetDays('month'))
  const [filters, setFilters] = useState<PaymentFilters>(NO_PAYMENT_FILTERS)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const dayError = validDays(days)
  const range = useMemo(() => (dayError ? null : rangeOf(days)), [days, dayError])

  const {
    data: payments = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [...ADMIN_PAYMENTS_QUERY_KEY, range?.from, range?.to],
    queryFn: () => getAdminPayments(range!),
    enabled: !!range,
  })

  const visible = useMemo(() => filterPayments(payments, filters), [payments, filters])
  const groups = useMemo(() => groupByDay(visible), [visible])
  const counts = useMemo(() => statusCounts(payments), [payments])
  const totals = useMemo(() => paymentTotals(payments), [payments])
  const open = payments.find((p) => `${p.source}:${p.id}` === openKey) ?? null
  const set = (patch: Partial<PaymentFilters>) => setFilters((f) => ({ ...f, ...patch }))

  const choosePreset = (next: PeriodPreset) => {
    setPreset(next)
    if (next !== 'custom') setDays(presetDays(next))
  }

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-foreground mr-auto text-2xl font-bold">Plăți</h1>
        <FilterSearch
          className="order-last w-full md:order-none md:w-80"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Caută plătitor, participant, ofertă"
          aria-label="Caută plăți după plătitor, email, participant, ofertă sau referință"
        />
        <Button
          type="button"
          variant="outline"
          className={TOUCH}
          disabled={visible.length === 0}
          onClick={() => download(visible, days)}
        >
          <Download aria-hidden="true" className="size-4" /> Export CSV
        </Button>
      </div>
      <p className="text-muted-foreground mb-4 max-w-2xl text-sm">
        Toate plățile de pe platformă: înscrierile plătite cu cardul sau cash și abonamentele
        antrenorilor și cluburilor. Apasă pe o plată ca să vezi cine a plătit, cum și când, sau ca
        s-o rambursezi.
      </p>

      <PaymentPeriod
        preset={preset}
        days={days}
        error={dayError}
        onPreset={choosePreset}
        onDays={setDays}
      />

      {dayError ? null : isLoading ? (
        <StatusView state="loading" title="Se încarcă plățile" rowHeight={72} />
      ) : isError ? (
        <StatusView
          state="error"
          title="Nu am putut încărca plățile."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Figure
              label="Încasat"
              value={formatRon(totals.collected)}
              note={plural(totals.collectedCount, 'plată', 'plăți')}
            />
            <Figure
              label="Rambursat"
              value={formatRon(totals.refunded)}
              note={plural(totals.refundCount, 'rambursare', 'rambursări')}
            />
            <Figure label="Net" value={formatRon(totals.net)} />
            <Figure
              label="Cash de confirmat"
              value={formatRon(totals.cashPending)}
              note={plural(totals.cashPendingCount, 'plată', 'plăți')}
            />
          </dl>
          {payments.length === 0 ? (
            <StatusView
              state="empty"
              title="Nicio plată în perioada aleasă."
              text="Alege altă perioadă sau un interval mai mare."
            />
          ) : (
            <>
              <CourseFilterBar
                status={filters.status}
                sport=""
                statusCounts={counts}
                sports={[]}
                statusOptions={STATUS_OPTIONS}
                onStatus={(status) => set({ status })}
                onSport={() => undefined}
                statusLabel="Stare plată"
              />
              <div className="mb-3 grid grid-cols-2 gap-3 sm:flex sm:items-center">
                <div className="grid gap-1.5 sm:flex sm:items-center sm:gap-2">
                  <Label htmlFor="payments-type" className="sm:shrink-0">
                    Tip
                  </Label>
                  <SelectMenu
                    id="payments-type"
                    className="sm:w-44"
                    value={filters.type}
                    onValueChange={(type) => set({ type: type as PaymentTypeFilter })}
                    emptyLabel="Toate tipurile"
                    options={[
                      { value: 'enrollments', label: 'Înscrieri' },
                      { value: 'subscriptions', label: 'Abonamente' },
                    ]}
                  />
                </div>
                <div className="grid gap-1.5 sm:flex sm:items-center sm:gap-2">
                  <Label htmlFor="payments-method" className="sm:shrink-0">
                    Metodă
                  </Label>
                  <SelectMenu
                    id="payments-method"
                    className="sm:w-40"
                    value={filters.method}
                    onValueChange={(method) => set({ method: method as PaymentMethodFilter })}
                    emptyLabel="Orice metodă"
                    options={[
                      { value: 'CARD', label: 'Card' },
                      { value: 'CASH', label: 'Cash' },
                    ]}
                  />
                </div>
              </div>
              <p role="status" className="text-muted-foreground mb-3 text-sm">
                {visible.length > 0 &&
                  `${plural(visible.length, 'plată', 'plăți')} în ${plural(groups.length, 'zi', 'zile')}`}
              </p>
              {visible.length === 0 ? (
                <StatusView
                  state="empty"
                  title="Nicio plată pentru filtrele alese."
                  text="Schimbă căutarea, starea, tipul sau metoda."
                  action={
                    hasPaymentFilters(filters) ? (
                      <Button
                        type="button"
                        variant="outline"
                        className={`${TOUCH} mt-3`}
                        onClick={() => setFilters(NO_PAYMENT_FILTERS)}
                      >
                        Șterge filtrele
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <PaymentDayList days={groups} onOpen={(p) => setOpenKey(`${p.source}:${p.id}`)} />
              )}
            </>
          )}
        </>
      )}
      <PaymentDetailSheet payment={open} onClose={() => setOpenKey(null)} />
    </div>
  )
}
