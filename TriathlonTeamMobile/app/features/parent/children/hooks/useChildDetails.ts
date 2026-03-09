import { useCallback, useEffect, useState } from 'react';
import {
  ChildDto,
  EnrollmentDto,
  getParentChild,
  getParentChildEnrollments,
} from '../../../../api/parentChildrenApi';

export const useChildDetails = (childId: string) => {
  const [child, setChild] = useState<ChildDto | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentDto[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!childId) return;
    setLoading(true);
    setError(null);
    try {
      const [childResponse, enrollmentsResponse] = await Promise.all([
        getParentChild(childId),
        getParentChildEnrollments(childId),
      ]);
      setChild(childResponse);
      setEnrollments(enrollmentsResponse);
    } catch (e) {
      setError('Nu s-au putut încărca detaliile copilului. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  return { child, enrollments, loading, error, reload: load };
};
