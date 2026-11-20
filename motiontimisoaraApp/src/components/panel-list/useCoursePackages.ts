import { useQuery } from '@tanstack/react-query'

import { getCoursePackagesByCourse } from '@/api/course-packages'
import type { CoursePackage } from '@/lib/course-packages/course-packages'

export function useCoursePackages(courseIds: string[]): {
  packages: Record<string, CoursePackage[]>
  pending: boolean
} {
  const key = [...courseIds].sort()
  const { data, isPending } = useQuery({
    queryKey: ['course-packages-by-course', key],
    queryFn: () => getCoursePackagesByCourse(key),
    enabled: key.length > 0,
  })
  return { packages: data ?? {}, pending: key.length > 0 && isPending }
}
