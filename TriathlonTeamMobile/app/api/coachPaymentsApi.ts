import { httpClient } from './httpClient';

// Raw shape coming from backend /api/coach/courses/{courseId}/participants
// Backend currently returns EnrollmentDto with nested child + session fields.
export interface BackendEnrollmentDto {
  id: string;
  child?: {
    id: string;
    name: string;
  };
  childName?: string;
  purchasedSessions?: number;
  remainingSessions?: number;
  sessionsUsed?: number;
}

// View model used in mobile UI
export interface CoachEnrollment {
  id: string;
  childId: string;
  childName: string;
  sessionsPaid: number;
  sessionsAttended: number;
  sessionsRemaining: number;
}

// Get enrollments/participants for a specific course using existing endpoint
// GET /api/coach/courses/{courseId}/participants
export const getEnrollments = async (courseId: string): Promise<CoachEnrollment[]> => {
  const response = await httpClient.get<BackendEnrollmentDto[]>(
    `/api/coach/courses/${courseId}/participants`,
  );
  const items = response.data ?? [];

  return items.map((item) => {
    const childId = item.child?.id ?? '';
    const childName = item.child?.name ?? item.childName ?? 'Copil';

    return {
      id: String(item.id),
      childId,
      childName,
      sessionsPaid: item.purchasedSessions ?? 0,
      sessionsAttended: item.sessionsUsed ?? 0,
      sessionsRemaining: item.remainingSessions ?? 0,
    };
  });
};

// Add sessions to a child's enrollment using existing purchase endpoint
// POST /api/enrollments/{enrollmentId}/purchase-sessions
// Payload: { sessionCount: number; paymentMethod: 'CASH' | 'CARD' }
export const addSessions = async (enrollmentId: string, count: number): Promise<void> => {
  await httpClient.post(`/api/enrollments/${enrollmentId}/purchase-sessions`, {
    sessionCount: count,
    paymentMethod: 'CASH',
  });
};
