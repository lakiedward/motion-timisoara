import { httpClient } from './httpClient';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | string;

export type AttendanceChildDto = {
  childId: string;
  childName: string;
  status: AttendanceStatus | null;
  note: string | null;
};

export type AttendanceOccurrenceDto = {
  occurrenceId: string;
  courseId: string;
  courseName: string;
  startsAt: string;
  endsAt: string;
  children: AttendanceChildDto[];
};

export type AttendanceMarkRequest = {
  occurrenceId: string;
  childId: string;
  status: AttendanceStatus;
  note?: string | null;
};

export const getCoachTodayAttendance = async (): Promise<AttendanceOccurrenceDto[]> => {
  const response = await httpClient.get<AttendanceOccurrenceDto[]>(
    '/api/coach/attendance/today',
  );
  return response.data;
};

export const markCoachAttendance = async (
  request: AttendanceMarkRequest,
): Promise<void> => {
  await httpClient.post('/api/coach/attendance/mark', request);
};
