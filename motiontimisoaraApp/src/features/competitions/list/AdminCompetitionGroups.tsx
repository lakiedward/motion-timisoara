import { useState } from 'react'

import type { CompetitionListItem } from '@/api/competition/competition-list'
import { CompetitionOrganizerCard } from './CompetitionOrganizerCard'
import { groupByOrganizer, type CompetitionOrganizerGroup } from './competition-list'

const SECTION_LABEL = { club: 'Cluburi', coach: 'Antrenori independenți' } as const

export function AdminCompetitionGroups({
  all,
  visible,
  query,
  baza,
}: {
  all: CompetitionListItem[]
  visible: CompetitionListItem[]
  query: string
  baza: string
}) {
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const searching = query.trim().length > 0
  const groups = groupByOrganizer(all, visible)
  const firstOfKind = new Set(
    (['club', 'coach'] as const).map((k) => groups.find((g) => g.kind === k)?.key),
  )
  const toggleKey = (g: CompetitionOrganizerGroup) =>
    `${searching ? `q:${query.trim()}:` : ''}${g.key}`
  const isOpen = (g: CompetitionOrganizerGroup) =>
    toggled[toggleKey(g)] ?? (searching || firstOfKind.has(g.key))

  return (
    <>
      {(['club', 'coach'] as const).map((kind) => {
        const ofKind = groups.filter((g) => g.kind === kind)
        if (!ofKind.length) return null
        return (
          <section key={kind} aria-label={SECTION_LABEL[kind]}>
            <h2 className="text-muted-foreground mt-6 mb-2 text-xs font-semibold tracking-wider uppercase">
              {SECTION_LABEL[kind]} · {ofKind.length}
            </h2>
            <div className="grid gap-3">
              {ofKind.map((g) => (
                <CompetitionOrganizerCard
                  key={g.key}
                  group={g}
                  baza={baza}
                  query={query}
                  open={isOpen(g)}
                  expanded={expanded.has(g.key)}
                  onOpenChange={(open) => setToggled((t) => ({ ...t, [toggleKey(g)]: open }))}
                  onExpand={() => setExpanded((e) => new Set(e).add(g.key))}
                />
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}
