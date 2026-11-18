import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getManagedActivityRoster } from '@/api/attendance/activity-attendance'
import { getClubSessions } from '@/api/attendance/admin-sessions'
import { getClubActivities, getMyClub } from '@/api/club'
import { Button } from '@/components/ui/button'
import { SessionsOverview } from '@/features/admin/attendance/SessionsOverview'
import { ActivityAttendance } from '@/features/coach/attendance/CoachActivityAttendance'

export default function ClubAttendancePage() {
  const [kind, setKind] = useState<'courses' | 'activities'>('courses')
  const club = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club.data?.id ?? ''
  const sessions = useQuery({
    queryKey: ['club-sessions', clubId],
    queryFn: () => getClubSessions(clubId),
    enabled: !!clubId && kind === 'courses',
    retry: false,
  })
  const activities = useQuery({
    queryKey: ['club-activities', clubId],
    queryFn: () => getClubActivities(clubId),
    enabled: !!clubId && kind === 'activities',
    retry: false,
  })
  const list = kind === 'courses' ? sessions : activities
  const retry = () => {
    if (club.isError) void club.refetch()
    if (clubId && list.isError) void list.refetch()
  }

  const kindSwitch = (
    <div role="group" aria-label="Ce pontezi" className="mb-4 flex gap-2">
      {(
        [
          ['courses', 'Cursuri'],
          ['activities', 'Activități'],
        ] as const
      ).map(([value, label]) => (
        <Button
          key={value}
          type="button"
          variant={kind === value ? 'default' : 'outline'}
          aria-pressed={kind === value}
          className="h-touch-target min-h-touch-target rounded-full lg:h-9 lg:min-h-9"
          onClick={() => setKind(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  )

  if (kind === 'activities')
    return (
      <div>
        <h1 className="font-display text-foreground mb-4 text-2xl font-bold">Prezență</h1>
        {kindSwitch}
        <ActivityAttendance
          activities={activities.data ?? []}
          isLoading={club.isLoading || activities.isLoading}
          isError={club.isError || activities.isError}
          onRetry={retry}
          emptyText="Când părinții înscriu copii la activitățile clubului, le pontezi aici."
          loadRoster={getManagedActivityRoster}
        />
      </div>
    )

  return (
    <SessionsOverview
      items={sessions.data ?? []}
      isLoading={club.isLoading || sessions.isLoading}
      isError={club.isError || sessions.isError}
      onRetry={retry}
      listKey="club-sessions"
      selectId="club-attendance-sport"
      searchPlaceholder="Caută curs, antrenor sau locație"
      searchLabel="Caută ședințe după curs, antrenor sau locație"
      emptyText="Ședințele apar aici după ce programezi cursurile clubului."
      groupNoun={['antrenor', 'antrenori']}
      belowHeader={kindSwitch}
    />
  )
}
