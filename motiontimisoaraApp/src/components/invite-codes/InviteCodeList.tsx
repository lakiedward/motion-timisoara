import { useState } from 'react'
import { ChevronDown, Search, Ticket, Trash2 } from 'lucide-react'

import { inviteCodeStatus } from '@/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusView } from '@/components/ui/status-view'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import { Highlight } from '@/features/admin/courses/CourseParts'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import CopyInviteValueButton from './CopyInviteValueButton'
import {
  INVITE_STATUS_LABEL,
  filterInviteCodes,
  groupInviteCodes,
  inviteExpiryLabel,
  inviteStatusCounts,
  type InviteCodeFields,
  type InviteCodeGroup,
  type InviteStatusFilter,
} from './invite-code-overview'

export type InviteListLayout = 'plain' | 'grouped'

export const INVITE_PREVIEW_LIMIT = 5

const STATUS_OPTIONS: FilterOption<InviteStatusFilter>[] = [
  { value: 'all', label: 'Toate' },
  { value: 'active', label: 'Active' },
  { value: 'used', label: 'Folosite' },
  { value: 'expired', label: 'Expirate' },
]

const countCodes = (n: number) => plural(n, 'cod', 'coduri')

type RowActions = {
  timezone: string
  query: string
  deletingId: string | undefined
  deleteDisabled: boolean
  onDelete: (id: string) => void
  indexOf: (id: string) => number
}

function InviteCodeRow({
  code,
  actions,
  plain = false,
}: {
  code: InviteCodeFields
  actions: RowActions
  plain?: boolean
}) {
  const status = inviteCodeStatus(code)
  const index = actions.indexOf(code.id) + 1
  return (
    <li
      className={cn(
        'flex min-w-0 flex-wrap items-center justify-between',
        plain ? 'bg-card gap-2 rounded-2xl border p-3' : 'gap-x-3 gap-y-2 px-4 py-3 md:px-5',
      )}
    >
      <div className={cn('min-w-0', !plain && 'flex-1 basis-56')}>
        <div className="flex flex-wrap items-center gap-3">
          <code className="bg-muted break-all rounded px-2 py-1 font-mono text-sm">
            <Highlight text={code.code} query={actions.query} />
          </code>
          <Badge variant={status === 'active' ? 'success' : 'outline'}>
            {INVITE_STATUS_LABEL[status]}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          Utilizări: {code.current_uses}/{code.max_uses}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {inviteExpiryLabel(code.expires_at, actions.timezone)}
        </p>
      </div>
      <div className="flex min-w-0 items-start gap-1">
        <CopyInviteValueButton
          key={code.code}
          value={code.code}
          label={`Copiază codul invitație ${index}`}
          successMessage="Codul existent a fost copiat."
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="text-destructive min-h-11 min-w-11"
          aria-label={
            actions.deletingId === code.id
              ? `Se șterge codul invitație ${index}`
              : `Șterge codul invitație ${index}`
          }
          disabled={actions.deleteDisabled}
          onClick={() => actions.onDelete(code.id)}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}

function InviteGroupCard({
  group,
  open,
  expanded,
  searching,
  actions,
  onOpenChange,
  onExpand,
}: {
  group: InviteCodeGroup<InviteCodeFields>
  open: boolean
  expanded: boolean
  searching: boolean
  actions: RowActions
  onOpenChange: (open: boolean) => void
  onExpand: () => void
}) {
  const shown = expanded || searching ? group.codes : group.codes.slice(0, INVITE_PREVIEW_LIMIT)
  const hidden = group.codes.length - shown.length
  const panelId = `coduri-${group.key}`
  return (
    <section className="bg-card overflow-hidden rounded-xl border" aria-label={group.name}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
          className="hover:bg-accent flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors md:px-5"
        >
          <span className="bg-secondary text-muted-foreground grid size-10 shrink-0 place-items-center rounded-full">
            <Ticket aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-display text-foreground block font-semibold">{group.name}</span>
            <span className="text-muted-foreground text-sm">
              <strong className="text-foreground tabular-nums">{group.codes.length}</strong>{' '}
              {plural(group.codes.length, 'cod', 'coduri', true)}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'text-muted-foreground size-5 shrink-0 transition-transform',
              !open && '-rotate-90',
            )}
          />
        </button>
      </h3>
      {open && (
        <div id={panelId}>
          <ul className="divide-y border-t">
            {shown.map((code) => (
              <InviteCodeRow key={code.id} code={code} actions={actions} />
            ))}
          </ul>
          {hidden > 0 && (
            <div className="border-t px-4 py-2 md:pl-5">
              <button
                type="button"
                onClick={onExpand}
                className="text-primary min-h-touch-target inline-flex items-center text-sm font-semibold lg:min-h-8"
              >
                Vezi toate cele {countCodes(group.codes.length)}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function InviteCodeList({
  codes,
  layout,
  timezone,
  deletingId,
  deleteDisabled,
  onDelete,
}: {
  codes: InviteCodeFields[]
  layout: InviteListLayout
  timezone: string
  deletingId: string | undefined
  deleteDisabled: boolean
  onDelete: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<InviteStatusFilter>('all')
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const visible = filterInviteCodes(codes, { query, status })
  const counts = inviteStatusCounts(codes)
  const searching = query.trim().length > 0
  const filtered = searching || status !== 'all'
  const actions: RowActions = {
    timezone,
    query,
    deletingId,
    deleteDisabled,
    onDelete,
    indexOf: (id) => codes.findIndex((code) => code.id === id),
  }
  const groups = groupInviteCodes(visible)
  const toggleKey = (key: string) => `${searching ? `q:${query.trim()}:` : ''}${key}`

  if (layout === 'plain')
    return (
      <ul className="space-y-2">
        {codes.map((code) => (
          <InviteCodeRow key={code.id} code={code} actions={actions} plain />
        ))}
      </ul>
    )

  return (
    <div className="space-y-3">
      <div className="relative md:w-80">
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Caută după cod"
          aria-label="Caută coduri invitație după cod"
          className="h-touch-target min-h-touch-target pl-9 lg:h-9 lg:min-h-9"
        />
      </div>
      <CourseFilterBar
        status={status}
        sport=""
        statusCounts={counts}
        sports={[]}
        statusOptions={STATUS_OPTIONS}
        onStatus={setStatus}
        onSport={() => {}}
      />
      <p role="status" className="text-muted-foreground text-sm">
        {visible.length > 0 &&
          (filtered
            ? `${visible.length} din ${countCodes(codes.length)}`
            : `${countCodes(codes.length)}, ${counts.active} ${counts.active === 1 ? 'activ' : 'active'}`)}
      </p>
      {visible.length === 0 ? (
        <StatusView
          state="empty"
          title="Niciun cod găsit."
          text="Schimbă căutarea sau filtrul."
          action={
            <Button
              type="button"
              variant="outline"
              className="h-touch-target min-h-touch-target mt-3"
              onClick={() => {
                setQuery('')
                setStatus('all')
              }}
            >
              Șterge filtrele
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {groups.map((group, index) => (
            <InviteGroupCard
              key={group.key}
              group={group}
              searching={searching}
              open={toggled[toggleKey(group.key)] ?? (searching || status !== 'all' || index === 0)}
              expanded={expanded.has(group.key)}
              actions={actions}
              onOpenChange={(open) =>
                setToggled((current) => ({ ...current, [toggleKey(group.key)]: open }))
              }
              onExpand={() => setExpanded((current) => new Set(current).add(group.key))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
