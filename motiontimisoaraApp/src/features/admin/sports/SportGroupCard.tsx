import type { ReactNode } from 'react'
import { ChevronDown, ImageOff, Images } from 'lucide-react'

import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import type { SportGroup } from './sport-overview'

export function SportGroupCard({
  group,
  open,
  onOpenChange,
  children,
}: {
  group: SportGroup
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  const Icon = group.key === 'without' ? ImageOff : Images
  const panelId = `sporturi-${group.key}`
  return (
    <section className="bg-card overflow-hidden rounded-xl border" aria-label={group.name}>
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
          className="hover:bg-accent flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors md:px-5"
        >
          <span className="bg-secondary text-muted-foreground grid size-10 shrink-0 place-items-center rounded-full">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-display text-foreground block font-semibold">{group.name}</span>
            <span className="text-muted-foreground text-sm">
              <strong className="text-foreground tabular-nums">{group.sports.length}</strong>{' '}
              {plural(group.sports.length, 'sport', 'sporturi', true)}
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
      </h2>
      {open && (
        <ul id={panelId} className="divide-y border-t">
          {children}
        </ul>
      )}
    </section>
  )
}
