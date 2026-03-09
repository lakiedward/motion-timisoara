import { useCallback, useEffect, useState } from 'react';
import { getParentUpcomingEvents, ParentCalendarEventDto } from '../../../../api/parentScheduleApi';

export const useParentSchedule = () => {
  const [events, setEvents] = useState<ParentCalendarEventDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Default: următoarele 60 de zile (limita este aplicată în backend)
      const data = await getParentUpcomingEvents(50);
      setEvents(data);
    } catch (e) {
      setError('Nu s-a putut încărca orarul. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { events, loading, error, reload: load };
};
