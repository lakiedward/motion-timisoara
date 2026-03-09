import { useCallback, useEffect, useState } from 'react';
import { DaySessionsDto, WeeklyCalendarDto, getCoachWeeklyCalendar } from '../../../../api/coachWeeklyAttendanceApi';

const getWeekStartIso = (date: Date): string => {
  const d = new Date(date);
  const day = d.getDay();
  // Convert Sunday(0) to 7, then compute Monday as start of week
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const dayOfMonth = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
};

export const useCoachWeeklySchedule = () => {
  const [weekStart, setWeekStart] = useState<string>(() => getWeekStartIso(new Date()));
  const [calendar, setCalendar] = useState<WeeklyCalendarDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCoachWeeklyCalendar(weekStart);
      setCalendar(data);
    } catch (e) {
      setError('Nu s-a putut încărca orarul săptămânal. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  const days: DaySessionsDto[] = calendar?.coaches[0]?.days ?? [];

  const goToPreviousWeek = useCallback(() => {
    const currentDate = new Date(weekStart);
    currentDate.setDate(currentDate.getDate() - 7);
    setWeekStart(getWeekStartIso(currentDate));
  }, [weekStart]);

  const goToNextWeek = useCallback(() => {
    const currentDate = new Date(weekStart);
    currentDate.setDate(currentDate.getDate() + 7);
    setWeekStart(getWeekStartIso(currentDate));
  }, [weekStart]);

  const weekStartDate = new Date(weekStart);

  return { 
    weekStart, 
    weekStartDate,
    days, 
    loading, 
    error, 
    reload: load,
    goToPreviousWeek,
    goToNextWeek
  };
};
