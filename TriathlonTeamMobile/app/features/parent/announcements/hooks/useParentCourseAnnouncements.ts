import { useCallback, useEffect, useState } from 'react';
import {
  AnnouncementDto,
  getParentCourseAnnouncements,
} from '../../../../api/parentAnnouncementsApi';

export const useParentCourseAnnouncements = (courseId: string) => {
  const [items, setItems] = useState<AnnouncementDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getParentCourseAnnouncements(courseId);
      setItems(data);
    } catch (e) {
      setError('Nu s-au putut încărca anunțurile cursului. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load };
};
