import { useCallback, useEffect, useState } from 'react';
import {
  ParentAttendanceDto,
  getParentChildAttendance,
} from '../../../../api/parentChildrenApi';

export const useChildAttendance = (childId: string) => {
  const [attendance, setAttendance] = useState<ParentAttendanceDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!childId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getParentChildAttendance(childId);
      setAttendance(data);
    } catch (e) {
      setError('Nu s-a putut încărca istoricul de prezență. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  return { attendance, loading, error, reload: load };
};
