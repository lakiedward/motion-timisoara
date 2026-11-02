import { useQuery } from '@tanstack/react-query'

import { getMyEnrollments } from '@/api/account'

export function useDeletionSummary(userId: string, enabled: boolean) {
  const enrollments = useQuery({
    queryKey: ['enrollments', userId],
    queryFn: getMyEnrollments,
    enabled,
  })
  return {
    loading: enrollments.isLoading,
    activeCount: (enrollments.data ?? []).filter((row) => row.status === 'ACTIVE').length,
  }
}
