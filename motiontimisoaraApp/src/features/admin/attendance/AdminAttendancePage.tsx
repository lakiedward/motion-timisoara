import { useQuery } from '@tanstack/react-query'

import { getAdminSessions } from '@/api/attendance/admin-sessions'
import { SessionsOverview } from './SessionsOverview'

const SECTION_LABELS = { club: 'Cluburi', coach: 'Antrenori independenți' }

export default function AdminAttendancePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-sessions'],
    queryFn: () => getAdminSessions(),
    retry: false,
  })

  return (
    <SessionsOverview
      items={data ?? []}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
      listKey="admin-sessions"
      selectId="admin-attendance-sport"
      searchPlaceholder="Caută curs, organizator sau locație"
      searchLabel="Caută ședințe după curs, organizator, antrenor sau locație"
      emptyText="Ședințele apar aici după ce cluburile și antrenorii își programează cursurile."
      groupNoun={['organizator', 'organizatori']}
      sectionLabels={SECTION_LABELS}
    />
  )
}
