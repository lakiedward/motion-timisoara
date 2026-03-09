import { httpClient } from './httpClient';

export type ParentCalendarEventDto = {
  id: string;
  date: string; // OffsetDateTime ISO string
  type: string; // 'course' | 'camp' | 'attendance' | other
  title: string;
  location: string | null;
  time: string | null; // e.g. '18:30:00'
  childName: string | null;
};

export const getParentUpcomingEvents = async (
  limit?: number,
): Promise<ParentCalendarEventDto[]> => {
  const params: Record<string, number> = {};
  if (limit && limit > 0) {
    params.limit = limit;
  }
  const response = await httpClient.get<ParentCalendarEventDto[]>(
    '/api/parent/upcoming-events',
    { params },
  );
  return response.data;
};
