import { httpClient } from './httpClient';

export type SessionSummaryDto = {
  occurrenceId: string;
  courseId: string;
  courseName: string;
  startsAt: string;
  endsAt: string;
  enrolledCount: number;
};

export type DaySessionsDto = {
  date: string; // LocalDate ISO (yyyy-MM-dd)
  dayOfWeek: string;
  sessions: SessionSummaryDto[];
};

export type CoachWeekDto = {
  coachId: string;
  coachName: string;
  days: DaySessionsDto[];
};

export type WeeklyCalendarDto = {
  weekStart: string; // LocalDate ISO
  weekEnd: string; // LocalDate ISO
  coaches: CoachWeekDto[];
};

export const getCoachWeeklyCalendar = async (
  weekStart: string,
): Promise<WeeklyCalendarDto> => {
  const response = await httpClient.get<WeeklyCalendarDto>(
    '/api/admin/attendance/weekly',
    {
      params: { weekStart },
    },
  );
  return response.data;
};
