import { useCallback, useEffect, useState } from 'react';
import type { CoachCourseDto } from '../../../../api/coachCoursesApi';
import { listCoachCourses } from '../../../../api/coachCoursesApi';

export const useCoachCourses = () => {
  const [items, setItems] = useState<CoachCourseDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCoachCourses();
      setItems(data);
    } catch (e) {
      setError('Nu s-au putut încărca cursurile. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load };
};
