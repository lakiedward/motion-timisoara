import { useEffect, useState, useCallback } from 'react';
import { ChildDto, getParentChildren } from '../../../../api/parentChildrenApi';

export const useChildren = () => {
  const [children, setChildren] = useState<ChildDto[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getParentChildren();
      setChildren(data);
    } catch (e) {
      setError('Nu s-au putut încărca copiii. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { children, loading, error, reload: load };
};
