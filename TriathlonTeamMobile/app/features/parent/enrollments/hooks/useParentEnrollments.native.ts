import { useCallback, useEffect, useState } from 'react';
import { useStripe } from '@stripe/stripe-react-native';
import type { EnrollmentDto } from '../../../../api/parentChildrenApi';
import {
  cancelDraftEnrollment,
  createPaymentIntent,
  listParentEnrollments,
  purchaseAdditionalSessions,
} from '../../../../api/enrollmentApi';

export const useParentEnrollments = () => {
  const [items, setItems] = useState<EnrollmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingEnrollmentId, setSubmittingEnrollmentId] = useState<string | null>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

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
    async (enrollmentId: string) => {
      setSubmittingEnrollmentId(enrollmentId);
      try {
        const intent = await createPaymentIntent(enrollmentId);

        const initResult = await initPaymentSheet({
          paymentIntentClientSecret: intent.clientSecret,
          merchantDisplayName: 'Motion Timișoara',
        });
        if (initResult.error) {
          setError('Nu s-a putut inițializa plata cu cardul. Încearcă din nou.');
          return;
        }

        const presentResult = await presentPaymentSheet();
        if (presentResult.error) {
          setError('Plata cu cardul nu a fost finalizată. Încearcă din nou.');
          return;
        }

        await load();
      } catch (e) {
        setError('A apărut o eroare la procesarea plății cu cardul. Încearcă din nou.');
      } finally {
        setSubmittingEnrollmentId(null);
      }
    },
    [initPaymentSheet, presentPaymentSheet, load],
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
