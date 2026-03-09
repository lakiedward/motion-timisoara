import { useState, useEffect, useCallback } from 'react';
import { getEnrollments, addSessions, type CoachEnrollment } from '../../../../api/coachPaymentsApi';

export const useCoachEnrollments = (courseId: string | null) => {
  const [enrollments, setEnrollments] = useState<CoachEnrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!courseId) {
      setEnrollments([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getEnrollments(courseId);
      setEnrollments(data);
    } catch (e) {
      setError('Nu s-au putut încărca înscrierile. Încearcă din nou.');
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddSessions = async (enrollmentId: string, count: number) => {
    try {
      await addSessions(enrollmentId, count);
      await load(); // Reload to get updated data
      return { success: true as const };
    } catch (e) {
      return { success: false as const, error: 'Nu s-au putut adăuga sesiunile' };
    }
  };

  return {
    enrollments,
    loading,
    error,
    reload: load,
    addSessions: handleAddSessions,
  };
};
