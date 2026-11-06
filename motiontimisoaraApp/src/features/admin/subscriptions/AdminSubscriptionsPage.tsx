import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  ADMIN_SUBSCRIPTIONS_QUERY_KEY,
  getAdminSubscriptions,
} from '@/api/subscriptions/admin-subscriptions'
import {
  SUBSCRIPTION_SETTINGS_QUERY_KEY,
  getSubscriptionSettings,
} from '@/api/subscriptions/subscriptions'
import { FilterSearch } from '@/components/catalog-filters/FilterSearch'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SelectMenu } from '@/components/ui/select-menu'
import { StatusView } from '@/components/ui/status-view'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import { formatRon } from '@/lib/money'
import { formatShortDate } from '@/lib/panel-date'
import { plural } from '@/lib/plural'
import { SubscriptionDetailSheet } from './SubscriptionDetailSheet'
import { SubscriptionGroupList } from './SubscriptionGroupList'
import {
  ENDING_SOON_DAYS,
  NO_SUBSCRIPTION_FILTERS,
  STATUS_LABEL,
  filterSubscriptions,
  groupByStatus,
  hasSubscriptionFilters,
  planOptions,
  statusCounts,
  subscriptionTotals,
  type SubscriptionFilters,
  type SubscriptionStateFilter,
  type SubscriptionTypeFilter,
} from './subscription-admin'

const TOUCH = 'h-touch-target min-h-touch-target lg:h-9 lg:min-h-9'

const STATUS_OPTIONS: FilterOption<SubscriptionStateFilter>[] = [
  { value: 'all', label: 'Toate' },
  { value: 'past_due', label: STATUS_LABEL.past_due },
  { value: 'trialing', label: STATUS_LABEL.trialing },
  { value: 'active', label: STATUS_LABEL.active },
  { value: 'canceled', label: STATUS_LABEL.canceled },
  { value: 'expired', label: STATUS_LABEL.expired },
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

export default function AdminSubscriptionsPage() {
  const [filters, setFilters] = useState<SubscriptionFilters>(NO_SUBSCRIPTION_FILTERS)
  const [openId, setOpenId] = useState<string | null>(null)

  const {
    data: subscriptions = [],
    isLoading,
    isError,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ADMIN_SUBSCRIPTIONS_QUERY_KEY,
    queryFn: getAdminSubscriptions,
  })
  const { data: settings } = useQuery({
    queryKey: SUBSCRIPTION_SETTINGS_QUERY_KEY,
    queryFn: getSubscriptionSettings,
  })

  const now = dataUpdatedAt || 0
  const visible = useMemo(() => filterSubscriptions(subscriptions, filters), [subscriptions, filters])
  const groups = useMemo(() => groupByStatus(visible), [visible])
  const counts = useMemo(() => statusCounts(subscriptions), [subscriptions])
  const plans = useMemo(() => planOptions(subscriptions), [subscriptions])
  const totals = useMemo(() => subscriptionTotals(subscriptions, now), [subscriptions, now])
  const open = subscriptions.find((s) => s.id === openId) ?? null
  const set = (patch: Partial<SubscriptionFilters>) => setFilters((f) => ({ ...f, ...patch }))

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-foreground mr-auto text-2xl font-bold">Abonamente</h1>
        <FilterSearch
          className="order-last w-full md:order-none md:w-80"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Caută antrenor, club, email"
          aria-label="Caută abonamente după nume, email sau pachet"
        />
      </div>
      <p className="text-muted-foreground mb-4 max-w-2xl text-sm">
        Abonamentele antrenorilor independenți și ale cluburilor. Apasă pe un abonament ca să vezi
        pachetul, data la care se încheie accesul și ca să-l prelungești gratuit, cu motiv.
      </p>
      {settings &&
        (settings.launchAt ? (
          <p className="text-muted-foreground mb-4 text-sm">
            Abonamentele sunt aplicate din {formatShortDate(settings.launchAt)}.
          </p>
        ) : (
          <p className="bg-muted/40 mb-4 rounded-xl border px-4 py-3 text-sm">
            Lansarea abonamentelor nu e setată încă, așa că toți au acces și nimeni nu plătește.
            Datele de mai jos arată cum ar sta fiecare după lansare.
          </p>
        ))}

      {isLoading ? (
        <StatusView state="loading" title="Se încarcă abonamentele" rowHeight={72} />
      ) : isError ? (
        <StatusView
          state="error"
          title="Nu am putut încărca abonamentele."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : subscriptions.length === 0 ? (
        <StatusView
          state="empty"
          title="Niciun abonament încă."
          text="Apar aici când un antrenor sau un club își creează contul."
        />
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Figure
              label="Venit lunar estimat"
              value={formatRon(totals.monthlyBani)}
              note={`din ${plural(totals.payingCount, 'abonament plătit', 'abonamente plătite')}`}
            />
            <Figure
              label="În perioadă gratuită"
              value={String(totals.trialingCount)}
              note={plural(totals.trialingCount, 'abonament', 'abonamente')}
            />
            <Figure
              label="Plată eșuată"
              value={String(totals.pastDueCount)}
              note={plural(totals.pastDueCount, 'abonament', 'abonamente')}
            />
            <Figure
              label={`Se încheie în ${ENDING_SOON_DAYS} zile`}
              value={String(totals.endingSoonCount)}
              note={plural(totals.endingSoonCount, 'abonament', 'abonamente')}
            />
          </dl>
          <CourseFilterBar
            status={filters.status}
            sport={filters.plan}
            statusCounts={counts}
            sports={plans}
            statusOptions={STATUS_OPTIONS}
            onStatus={(status) => set({ status })}
            onSport={(plan) => set({ plan })}
            statusLabel="Stare abonament"
            sportLabel="Pachet"
            allSportsLabel="Toate pachetele"
            selectId="admin-subscription-plan"
          />
          <div className="mb-3 grid grid-cols-2 gap-3 sm:flex sm:items-center">
            <div className="grid gap-1.5 sm:flex sm:items-center sm:gap-2">
              <Label htmlFor="subscriptions-type" className="sm:shrink-0">
                Tip
              </Label>
              <SelectMenu
                id="subscriptions-type"
                className="sm:w-44"
                value={filters.type}
                onValueChange={(type) => set({ type: type as SubscriptionTypeFilter })}
                emptyLabel="Toate tipurile"
                options={[
                  { value: 'COACH', label: 'Antrenori' },
                  { value: 'CLUB', label: 'Cluburi' },
                ]}
              />
            </div>
          </div>
          <p role="status" className="text-muted-foreground mb-3 text-sm">
            {visible.length > 0 &&
              (visible.length < subscriptions.length
                ? `${visible.length} din ${plural(subscriptions.length, 'abonament', 'abonamente')}`
                : plural(visible.length, 'abonament', 'abonamente'))}
          </p>
          {visible.length === 0 ? (
            <StatusView
              state="empty"
              title="Niciun abonament pentru filtrele alese."
              text="Schimbă căutarea, starea, tipul sau pachetul."
              action={
                hasSubscriptionFilters(filters) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={`${TOUCH} mt-3`}
                    onClick={() => setFilters(NO_SUBSCRIPTION_FILTERS)}
                  >
                    Șterge filtrele
                  </Button>
                ) : null
              }
            />
          ) : (
            <SubscriptionGroupList groups={groups} now={now} onOpen={(s) => setOpenId(s.id)} />
          )}
        </>
      )}
      <SubscriptionDetailSheet subscription={open} onClose={() => setOpenId(null)} />
    </div>
  )
}
