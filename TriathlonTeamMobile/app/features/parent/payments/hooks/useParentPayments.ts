import { useCallback, useEffect, useState } from 'react';
import { getParentOverview, ParentOverviewDto } from '../../../../api/parentPaymentsApi';

export const useParentPayments = () => {
  const [overview, setOverview] = useState<ParentOverviewDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getParentOverview();
      setOverview(data);
    } catch (e) {
      setError('Nu s-au putut încărca plățile. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { overview, loading, error, reload: load };
};
