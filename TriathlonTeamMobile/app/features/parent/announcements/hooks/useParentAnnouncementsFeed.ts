import { useCallback, useEffect, useState } from 'react';
import {
  AnnouncementDto,
  getParentAnnouncementsFeed,
} from '../../../../api/parentAnnouncementsApi';

export const useParentAnnouncementsFeed = () => {
  const [items, setItems] = useState<AnnouncementDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getParentAnnouncementsFeed({ limit: 20 });
      setItems(data);
    } catch (e) {
      setError('Nu s-au putut încărca anunțurile. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load };
};
