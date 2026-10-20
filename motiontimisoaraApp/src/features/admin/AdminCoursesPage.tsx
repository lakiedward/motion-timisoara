import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { toast } from 'sonner'

import { getAllCourses, setCourseActiveAdmin } from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CourseFilterBar } from './courses/CourseFilterBar'
import { ToggleAction, type RenderCourseActions, type ToggleArgs } from './courses/CourseParts'
import { OrganizerCard } from './courses/OrganizerCard'
import {
  countCourses,
  filterCourses,
  groupByOrganizer,
  overviewLine,
  sportCounts,
  statusCounts,
  type OrganizerGroup,
  type StatusFilter,
} from './courses/course-overview'

const EMPTY_BY_STATUS: Record<StatusFilter, string> = {
  active: 'Niciun curs activ.',
  inactive: 'Niciun curs inactiv.',
  attention: 'Nimic de verificat. Toate cursurile sunt în regulă.',
  all: 'Niciun curs.',
}

function LoadingState() {
  return (
    <div aria-hidden="true">
      <div className="mb-3 flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-touch-target w-28 rounded-full lg:h-9" />
        ))}
      </div>
      <Skeleton className="mb-6 h-5 w-64" />
      <Skeleton className="mb-2 h-4 w-24" />
      <div className="grid gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground rounded-xl border border-dashed px-6 py-16 text-center">
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-muted-foreground mt-6 mb-2 text-xs font-semibold tracking-wider uppercase">
      {children}
    </h2>
  )
}

export default function AdminCoursesPage({
  headerActions,
  renderRowActions,
}: {
  headerActions?: ReactNode
  renderRowActions?: RenderCourseActions
} = {}) {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [sport, setSport] = useState('')
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const {
    data: courses = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['admin-courses'], queryFn: getAllCourses, retry: false })

  const toggle = useMutation({
    mutationFn: ({ id, active }: ToggleArgs) => setCourseActiveAdmin(id, active),
    onSuccess: (_res, { name, active }) => {
      qc.invalidateQueries({ queryKey: ['admin-courses'] })
      toast.success(`Cursul ${name} a fost ${active ? 'activat' : 'dezactivat'}.`)
    },
    onError: () => toast.error('Nu am putut actualiza cursul.'),
  })

  const searching = q.trim().length > 0
  const counts = useMemo(() => statusCounts(courses), [courses])
  const sports = useMemo(
    () => sportCounts(filterCourses(courses, { status, sport: '', query: '' })),
    [courses, status],
  )
  const visible = useMemo(
    () => filterCourses(courses, { status, sport, query: q }),
    [courses, status, sport, q],
  )
  const elsewhere = useMemo(
    () =>
      searching
        ? filterCourses(courses, { status: 'all', sport, query: q }).length - visible.length
        : 0,
    [courses, sport, q, searching, visible.length],
  )
  const groups = useMemo(() => groupByOrganizer(courses, visible), [courses, visible])
  const clubs = groups.filter((g) => g.kind === 'club')
  const coaches = groups.filter((g) => g.kind === 'coach')
  const defaultOpen = new Set([clubs[0]?.key, coaches[0]?.key])

  const toggleKey = (g: OrganizerGroup) => `${searching ? `q:${q.trim()}:` : ''}${g.key}`
  const isOpen = (g: OrganizerGroup) =>
    toggled[toggleKey(g)] ?? (searching || defaultOpen.has(g.key))

  const actions: RenderCourseActions = (course, layout) => (
    <>
      {renderRowActions?.(course, layout)}
      <ToggleAction
        course={course}
        pending={toggle.isPending}
        onToggle={(args) => toggle.mutate(args)}
        className={
          layout === 'table'
            ? 'h-touch-target min-h-touch-target lg:h-8 lg:min-h-8'
            : 'h-touch-target min-h-touch-target'
        }
      />
    </>
  )

  const renderGroup = (g: OrganizerGroup) => (
    <OrganizerCard
      key={g.key}
      group={g}
      query={q}
      open={isOpen(g)}
      expanded={expanded.has(g.key)}
      renderActions={actions}
      onOpenChange={(open) => setToggled((t) => ({ ...t, [toggleKey(g)]: open }))}
      onExpand={() => setExpanded((e) => new Set(e).add(g.key))}
    />
  )

  const showAll = () => {
    setStatus('all')
    setSport('')
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-foreground mr-auto text-2xl font-bold">Cursuri</h1>
        <div className="relative order-last w-full md:order-none md:w-80">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Caută curs, antrenor sau club"
            aria-label="Caută cursuri după nume, antrenor sau club"
            className="h-touch-target min-h-touch-target pl-9 lg:h-9 lg:min-h-9"
          />
        </div>
        {headerActions}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError && courses.length === 0 ? (
        <div role="alert" className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca cursurile.</p>
          <Button
            className="mt-4 h-touch-target min-h-touch-target"
            type="button"
            onClick={() => refetch()}
          >
            Reîncearcă
          </Button>
        </div>
      ) : courses.length === 0 ? (
        <Message>
          Niciun curs înregistrat.{' '}
          <Link to="/admin/courses/new" className="text-primary font-semibold">
            Creează primul curs
          </Link>
        </Message>
      ) : (
        <>
          <CourseFilterBar
            status={status}
            sport={sport}
            statusCounts={counts}
            sports={sports}
            onStatus={setStatus}
            onSport={setSport}
          />

          <p role="status" className="text-muted-foreground text-sm">
            {visible.length > 0 &&
              (searching
                ? `${visible.length} din ${countCourses(courses.length)}`
                : overviewLine(groups, status, visible.length))}
            {elsewhere > 0 && (
              <>
                {visible.length > 0 && ' · '}
                <button
                  type="button"
                  onClick={showAll}
                  className="text-primary inline-flex min-h-touch-target items-center font-semibold lg:min-h-0"
                >
                  {elsewhere === 1 ? 'Încă 1 rezultat' : `Încă ${elsewhere} rezultate`} în alte
                  filtre
                </button>
              </>
            )}
          </p>

          {visible.length === 0 ? (
            <div className="mt-3">
              <Message>
                {searching
                  ? 'Niciun curs nu se potrivește cu căutarea. '
                  : `${EMPTY_BY_STATUS[status]} `}
                {searching ? (
                  <button
                    type="button"
                    onClick={() => setQ('')}
                    className="text-primary inline-flex min-h-touch-target items-center font-semibold lg:min-h-0"
                  >
                    Șterge căutarea
                  </button>
                ) : (
                  status !== 'all' && (
                    <button
                      type="button"
                      onClick={showAll}
                      className="text-primary inline-flex min-h-touch-target items-center font-semibold lg:min-h-0"
                    >
                      Vezi toate cursurile
                    </button>
                  )
                )}
              </Message>
            </div>
          ) : (
            <>
              {clubs.length > 0 && (
                <>
                  <SectionLabel>Cluburi · {clubs.length}</SectionLabel>
                  <div className="grid gap-3">{clubs.map(renderGroup)}</div>
                </>
              )}
              {coaches.length > 0 && (
                <>
                  <SectionLabel>Antrenori independenți · {coaches.length}</SectionLabel>
                  <div className="grid gap-3">{coaches.map(renderGroup)}</div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
