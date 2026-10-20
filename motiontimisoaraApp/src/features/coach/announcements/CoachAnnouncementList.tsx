import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { stergeFisiereleAnuntului, type AtasamentAfisabil } from '@/api/attachments'
import {
  deleteCourseAnnouncement,
  setCourseAnnouncementPinned,
  type CoachAnnouncement,
} from '@/api/coach-announcements'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatusView } from '@/components/ui/status-view'
import { plural } from '@/lib/plural'
import { CoachAnnouncementCard } from './CoachAnnouncementCard'
import { CoachAnnouncementFilterBar } from './CoachAnnouncementFilterBar'
import {
  NO_FILTERS,
  courseCounts,
  filterCoachAnnouncements,
  groupAnnouncements,
  hasFilters,
  sourceCounts,
  type CoachAnnouncementFilters,
} from './coach-announcement-filters'

type Props = {
  items: CoachAnnouncement[]
  courses: { id: string; name: string }[]
  attachments: Record<string, AtasamentAfisabil[]>
  onChanged: () => void
  compact?: boolean
}

const PAGE = 15

export function CoachAnnouncementList({
  items,
  courses,
  attachments,
  onChanged,
  compact = false,
}: Props) {
  const [filters, setFilters] = useState<CoachAnnouncementFilters>(NO_FILTERS)
  const [limit, setLimit] = useState(PAGE)
  const [toDelete, setToDelete] = useState<CoachAnnouncement | null>(null)
  const names = Object.fromEntries(courses.map((c) => [c.id, c.name]))
  const courseName = (id: string) => names[id] ?? 'Curs indisponibil'
  const filtered = filterCoachAnnouncements(items, filters, names)
  const visible = [...filtered.filter((a) => a.pinned), ...filtered.filter((a) => !a.pinned)]
  const shown = visible.slice(0, limit)
  const changeFilters = (next: CoachAnnouncementFilters) => {
    setFilters(next)
    setLimit(PAGE)
  }

  const pin = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      setCourseAnnouncementPinned(id, pinned),
    onSuccess: (_d, { pinned }) => {
      onChanged()
      toast.success(pinned ? 'Anunț fixat sus.' : 'Anunț desprins.')
    },
    onError: () => toast.error('Nu am putut schimba anunțul.'),
  })
  const del = useMutation({
    mutationFn: async (id: string) => {
      await stergeFisiereleAnuntului(id, 'coach')
      return deleteCourseAnnouncement(id)
    },
    onSuccess: () => {
      setToDelete(null)
      onChanged()
      toast.success('Anunț șters.')
    },
    onError: () => toast.error('Nu am putut șterge anunțul.'),
  })

  return (
    <section aria-labelledby="anunturi-curs" className="space-y-4">
      <h2 id="anunturi-curs" className="font-display text-lg font-semibold">
        Anunțuri la cursurile mele
      </h2>
      {items.length > 1 && (
        <CoachAnnouncementFilterBar
          filters={filters}
          sourceCounts={sourceCounts(items)}
          courses={courseCounts(items, courses)}
          onChange={changeFilters}
        />
      )}
      {hasFilters(filters) && (
        <p className="text-muted-foreground text-sm" role="status">
          {visible.length} din {items.length}
        </p>
      )}

      {visible.length === 0 ? (
        <StatusView
          state="empty"
          title="Niciun anunț pentru filtrele alese."
          text="Schimbă căutarea sau filtrele."
          action={
            <Button
              type="button"
              variant="outline"
              className="mt-3 h-11 min-h-11"
              onClick={() => changeFilters(NO_FILTERS)}
            >
              Șterge filtrele
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {groupAnnouncements(shown).map((g) => (
            <section key={g.key} aria-label={g.title}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="font-display text-base font-semibold">{g.title}</h3>
                <span className="text-muted-foreground text-sm">
                  {plural(g.items.length, 'anunț', 'anunțuri')}
                </span>
              </div>
              <ul className="space-y-3" aria-label={`Anunțuri ${g.title}`}>
                {g.items.map((a) => (
                  <li key={`${a.source}-${a.id}`} className="min-w-0">
                    <CoachAnnouncementCard
                      announcement={a}
                      courseName={courseName(a.courseId)}
                      attachments={attachments[`${a.source}-${a.id}`] ?? []}
                      busy={
                        (pin.isPending && pin.variables?.id === a.id) ||
                        (del.isPending && del.variables === a.id)
                      }
                      onTogglePin={() => pin.mutate({ id: a.id, pinned: !a.pinned })}
                      onDelete={() => setToDelete(a)}
                      compact={compact}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {visible.length > shown.length && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-muted-foreground text-sm" role="status">
                Vezi {shown.length} din {visible.length}
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-11"
                onClick={() => setLimit((n) => n + PAGE)}
              >
                Arată încă {Math.min(PAGE, visible.length - shown.length)}
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={toDelete ? `Ștergi anunțul din ${courseName(toDelete.courseId)}?` : ''}
        description="Anunțul dispare definitiv, inclusiv pentru părinți, împreună cu pozele și filmarea lui. Acțiunea este ireversibilă."
        confirmLabel="Șterge"
        destructive
        pending={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
      />
    </section>
  )
}
