import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'

import { getAtasamente, type AtasamentAfisabil } from '@/api/attachments'
import { getCoachAnnouncements } from '@/api/coach-announcements'
import { getMyCourses } from '@/api/coach'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'
import CoachAnnouncementForm from './CoachAnnouncementForm'
import { CoachAnnouncementList } from './CoachAnnouncementList'

async function loadAttachments(
  ownIds: string[],
  clubIds: string[],
): Promise<Record<string, AtasamentAfisabil[]>> {
  const [own, club] = await Promise.all([
    getAtasamente(ownIds, 'coach'),
    getAtasamente(clubIds, 'club'),
  ])
  return {
    ...Object.fromEntries(Object.entries(own).map(([id, list]) => [`coach-${id}`, list])),
    ...Object.fromEntries(Object.entries(club).map(([id, list]) => [`club-${id}`, list])),
  }
}

export default function CoachAnnouncementsPage() {
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const compact = params.get('v') === 'b'
  const [composing, setComposing] = useState(false)
  const courses = useQuery({ queryKey: ['my-courses'], queryFn: getMyCourses, retry: false })
  const allCourses = (courses.data ?? []).map((c) => ({ id: c.id, name: c.name }))
  const activeCourses = (courses.data ?? [])
    .filter((c) => c.active)
    .map((c) => ({ id: c.id, name: c.name }))
  const courseIds = allCourses.map((c) => c.id)

  const announcements = useQuery({
    queryKey: ['coach-announcements', courseIds.join(',')],
    queryFn: () => getCoachAnnouncements(courseIds),
    enabled: courses.isSuccess,
    retry: false,
  })
  const items = announcements.data ?? []
  const ownIds = items.filter((a) => a.source === 'coach').map((a) => a.id)
  const clubIds = items.filter((a) => a.source === 'club').map((a) => a.id)
  const media = useQuery({
    queryKey: ['coach-announcement-media', ownIds.join(','), clubIds.join(',')],
    queryFn: () => loadAttachments(ownIds, clubIds),
    enabled: items.length > 0,
  })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['coach-announcements'] })
    void qc.invalidateQueries({ queryKey: ['coach-announcement-media'] })
  }
  const loading = courses.isPending || (courses.isSuccess && announcements.isPending)
  const failed = courses.isError || announcements.isError
  const retry = () => void (courses.isError ? courses.refetch() : announcements.refetch())
  const canCompose = activeCourses.length > 0
  const form = (
    <CoachAnnouncementForm
      courses={activeCourses}
      onPublished={() => {
        refresh()
        setComposing(false)
      }}
      onCancel={compact ? () => setComposing(false) : undefined}
    />
  )

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Anunțuri
          {!!items.length && (
            <span className="text-muted-foreground ml-2 text-base font-normal">
              ({items.length})
            </span>
          )}
        </h1>
        {compact && canCompose && !composing && (
          <Button className="h-11 min-h-11 w-full md:w-auto" onClick={() => setComposing(true)}>
            <Plus /> Anunț nou
          </Button>
        )}
      </div>

      {canCompose && (!compact || composing) && form}

      {loading ? (
        <StatusView state="loading" title="Se încarcă anunțurile" rows={2} rowHeight={160} />
      ) : failed ? (
        <StatusView
          state="error"
          title="Nu am putut încărca anunțurile."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={retry}
        />
      ) : !allCourses.length ? (
        <StatusView
          state="empty"
          title="Niciun curs încă."
          text="Anunțurile se trimit părinților unui curs. Creează un curs ca să poți publica."
        />
      ) : items.length ? (
        <CoachAnnouncementList
          items={items}
          courses={allCourses}
          attachments={media.data ?? {}}
          onChanged={refresh}
          compact={compact}
        />
      ) : (
        <StatusView
          state="empty"
          title="Niciun anunț încă."
          text="Anunțurile tale și cele trimise de club către cursurile tale apar aici."
        />
      )}
    </div>
  )
}
