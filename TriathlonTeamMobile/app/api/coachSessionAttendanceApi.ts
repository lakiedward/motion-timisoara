import { httpClient } from './httpClient';

export type ChildAttendancePaymentDto = {
  enrollmentId: string;
  childId: string;
  childName: string;
  attendanceStatus: 'PRESENT' | 'ABSENT' | null;
  remainingSessions: number;
  sessionsUsed: number;
  lowSessionWarning: boolean;
};

export type SessionAttendanceDto = {
  occurrenceId: string;
  courseName: string;
  startsAt: string;
  children: ChildAttendancePaymentDto[];
};

export type MarkSessionAttendanceItemDto = {
  childId: string;
  status: 'PRESENT' | 'ABSENT';
  note?: string | null;
};

export const getCoachSessionAttendance = async (
  occurrenceId: string,
): Promise<SessionAttendanceDto> => {
  const response = await httpClient.get<SessionAttendanceDto>(
    `/api/admin/attendance/session/${occurrenceId}`,
  );
  return response.data;
};

export const markCoachSessionAttendance = async (
  occurrenceId: string,
  items: MarkSessionAttendanceItemDto[],
): Promise<void> => {
  await httpClient.post(`/api/admin/attendance/session/${occurrenceId}/mark`, items);
};
