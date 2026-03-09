import { useCallback, useEffect, useState } from 'react';
import type { EnrollmentDto } from '../../../../api/parentChildrenApi';
import {
  cancelDraftEnrollment,
  listParentEnrollments,
  purchaseAdditionalSessions,
} from '../../../../api/enrollmentApi';

export const useParentEnrollments = () => {
  const [items, setItems] = useState<EnrollmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingEnrollmentId, setSubmittingEnrollmentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listParentEnrollments();
      setItems(data);
    } catch (e) {
      setError('Nu s-au putut încărca înscrierile. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = useCallback(
    async (enrollmentId: string) => {
      setSubmittingEnrollmentId(enrollmentId);
      try {
        await cancelDraftEnrollment(enrollmentId);
        await load();
      } catch (e) {
        setError('Nu s-a putut anula înscrierea. Încearcă din nou.');
      } finally {
        setSubmittingEnrollmentId(null);
      }
    },
    [load],
  );

  const purchaseCashSessions = useCallback(
    async (enrollmentId: string, sessionCount: number) => {
      setSubmittingEnrollmentId(enrollmentId);
      try {
        await purchaseAdditionalSessions({
          enrollmentId,
          sessionCount,
          paymentMethod: 'CASH',
        });
        await load();
      } catch (e) {
        setError('Nu s-au putut cumpăra ședințele suplimentare. Încearcă din nou.');
      } finally {
        setSubmittingEnrollmentId(null);
      }
    },
    [load],
  );

  const payWithCard = useCallback(
    async (_enrollmentId: string) => {
      // Web fallback: Stripe RN nu este disponibil pe web.
      setError('Plata cu cardul este disponibilă doar în aplicația mobilă.');
    },
    [],
  );

  return {
    items,
    loading,
    error,
    reload: load,
    cancel,
    purchaseCashSessions,
    payWithCard,
    submittingEnrollmentId,
  };
};
