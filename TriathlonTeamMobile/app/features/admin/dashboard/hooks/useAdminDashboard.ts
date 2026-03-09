import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminCourseDto } from '../../../../api/adminCoursesApi';
import { listAdminCourses } from '../../../../api/adminCoursesApi';

export type AdminDashboardStats = {
  totalCourses: number;
  activeCourses: number;
  inactiveCourses: number;
  totalEnrolled: number;
  totalReserved: number;
  totalPaid: number;
  totalUnpaid: number;
};

export const useAdminDashboard = () => {
  const [courses, setCourses] = useState<AdminCourseDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminCourses();
      setCourses(data);
    } catch (e) {
      setError('Nu s-au putut încărca datele de admin. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats: AdminDashboardStats = useMemo(() => {
    if (courses.length === 0) {
      return {
        totalCourses: 0,
        activeCourses: 0,
        inactiveCourses: 0,
        totalEnrolled: 0,
        totalReserved: 0,
        totalPaid: 0,
        totalUnpaid: 0,
      };
    }
    const totalCourses = courses.length;
    const activeCourses = courses.filter((c) => c.active).length;
    const inactiveCourses = totalCourses - activeCourses;
    const totalEnrolled = courses.reduce((sum, c) => sum + c.enrolledCount, 0);
    const totalReserved = courses.reduce((sum, c) => sum + c.reservedCount, 0);
    const totalPaid = courses.reduce((sum, c) => sum + c.enrolledPaidCount, 0);
    const totalUnpaid = courses.reduce((sum, c) => sum + c.enrolledUnpaidCount, 0);
    return {
      totalCourses,
      activeCourses,
      inactiveCourses,
      totalEnrolled,
      totalReserved,
      totalPaid,
      totalUnpaid,
    };
  }, [courses]);

  return { courses, stats, loading, error, reload: load };
};
