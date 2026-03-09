import { useCallback, useEffect, useState } from 'react';
import {
  AttendanceOccurrenceDto,
  getCoachTodayAttendance,
  markCoachAttendance,
  AttendanceStatus,
} from '../../../../api/coachAttendanceApi';

export const useCoachTodayAttendance = () => {
  const [occurrences, setOccurrences] = useState<AttendanceOccurrenceDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCoachTodayAttendance();
      setOccurrences(data);
    } catch (e) {
      setError('Nu s-au putut încărca ședințele de azi. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mark = useCallback(
    async (occurrenceId: string, childId: string, status: AttendanceStatus) => {
      const key = `${occurrenceId}-${childId}`;
      setSubmittingKey(key);
      try {
        await markCoachAttendance({ occurrenceId, childId, status });
        await load();
      } catch (e) {
        setError('Nu s-a putut salva prezența. Încearcă din nou.');
      } finally {
        setSubmittingKey(null);
      }
    },
    [load],
  );

  return { occurrences, loading, error, reload: load, mark, submittingKey };
};
