import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'

import { getAllClubs, getCoachesForSelect } from '@/api/admin'
import { getIndependentCoachCourses } from '@/api/announcements/admin-announcements'
import { getClubAudiences } from '@/api/club'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { StatusView } from '@/components/ui/status-view'
import AnnouncementComposeForm from '@/features/club/announcements/AnnouncementComposeForm'
import { CourseOwnerField } from '@/features/club/course-form/CourseOwnerField'
import { INDEPENDENT_OWNER } from '@/features/club/course-form/useCourseFormOwner'
import CoachAnnouncementForm from '@/features/coach/announcements/CoachAnnouncementForm'

const LIST_PATH = '/admin/announcements'

const selectCls =
  'border-input dark:bg-input/30 flex h-touch-target w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none hover:border-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 lg:h-9 lg:text-sm'

export default function AdminAnnouncementFormPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [owner, setOwner] = useState('')
  const [coachId, setCoachId] = useState('')
  const independent = owner === INDEPENDENT_OWNER
  const clubId = owner && !independent ? owner : ''

  const clubs = useQuery({ queryKey: ['admin-clubs'], queryFn: getAllClubs })
  const coaches = useQuery({
    queryKey: ['admin-course-coaches', INDEPENDENT_OWNER],
    queryFn: getCoachesForSelect,
    enabled: independent,
  })
  const audiences = useQuery({
    queryKey: ['club-audiences', clubId],
    queryFn: () => getClubAudiences(clubId),
    enabled: !!clubId,
  })
  const courses = useQuery({
    queryKey: ['admin-coach-courses', coachId],
    queryFn: () => getIndependentCoachCourses(coachId),
    enabled: independent && !!coachId,
  })

  const done = () => {
    void qc.invalidateQueries({ queryKey: ['admin-announcements'] })
    navigate(LIST_PATH)
  }
  const chooseOwner = (next: string) => {
    setOwner(next)
    setCoachId('')
  }

  const composer = clubId ? (
    audiences.isPending ? (
      <StatusView state="loading" title="Se încarcă cursurile clubului" rows={1} rowHeight={320} />
    ) : audiences.isError ? (
      <StatusView
        state="error"
        title="Nu am putut încărca cursurile clubului."
        onRetry={() => audiences.refetch()}
      />
    ) : (
      <AnnouncementComposeForm
        key={clubId}
        clubId={clubId}
        audiences={(audiences.data ?? []).filter((a) => a.active)}
        onPublished={done}
      />
    )
  ) : independent && coachId ? (
    courses.isPending ? (
      <StatusView
        state="loading"
        title="Se încarcă cursurile antrenorului"
        rows={1}
        rowHeight={320}
      />
    ) : courses.isError ? (
      <StatusView
        state="error"
        title="Nu am putut încărca cursurile antrenorului."
        onRetry={() => courses.refetch()}
      />
    ) : courses.data?.length ? (
      <CoachAnnouncementForm
        key={coachId}
        courses={courses.data}
        onPublished={done}
        onCancel={() => navigate(LIST_PATH)}
      />
    ) : (
      <StatusView
        state="empty"
        title="Antrenorul nu are cursuri active."
        text="Anunțurile antrenorilor independenți ajung la părinții unui curs."
      />
    )
  ) : null

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to={LIST_PATH}
        className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi
      </Link>
      <h1 className="font-display mt-4 text-2xl font-bold">Anunț nou</h1>

      <Card className="mt-6 mb-6">
        <CardHeader>
          <CardTitle className="font-display text-lg">Cine trimite</CardTitle>
          <CardDescription>
            Părinții văd anunțul ca venind de la organizatorul ales.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {clubs.isError ? (
            <StatusView
              state="error"
              title="Nu am putut încărca cluburile."
              onRetry={() => clubs.refetch()}
              className="sm:col-span-2"
            />
          ) : (
            <CourseOwnerField
              value={owner}
              clubs={clubs.data ?? []}
              locked={false}
              error={null}
              selectClassName={selectCls}
              onChange={chooseOwner}
            />
          )}
          {independent && (
            <div className="space-y-1.5">
              <Label htmlFor="coach">Antrenor</Label>
              <select
                id="coach"
                className={selectCls}
                value={coachId}
                disabled={!coaches.isSuccess}
                onChange={(e) => setCoachId(e.target.value)}
              >
                <option value="">{coaches.isError ? 'Nu am putut încărca' : '—'}</option>
                {(coaches.data ?? []).map((c) => (
                  <option key={c.user_id} value={c.user_id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {composer ?? (
        <p className="text-muted-foreground text-sm">
          {independent
            ? 'Alege antrenorul ca să scrii anunțul.'
            : 'Alege clubul sau un antrenor independent ca să scrii anunțul.'}
        </p>
      )}
    </div>
  )
}
