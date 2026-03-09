import { supabase } from '../lib/supabase';

// Raw shape coming from Supabase enrollments + children + session fields
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

// Get enrollments/participants for a specific course
export const getEnrollments = async (courseId: string): Promise<CoachEnrollment[]> => {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      child_id,
      sessions_remaining,
      sessions_total,
      children (id, first_name, last_name)
    `)
    .eq('entity_id', courseId)
    .eq('entity_type', 'COURSE')
    .eq('status', 'ACTIVE');

  if (error) throw new Error(error.message);

  return (data ?? []).map((item) => {
    const child = Array.isArray(item.children) ? item.children[0] : item.children;
    const sessionsTotal = item.sessions_total ?? 0;
    const sessionsRemaining = item.sessions_remaining ?? 0;

    return {
      id: item.id,
      childId: child?.id ?? item.child_id,
      childName: child ? `${child.first_name} ${child.last_name}`.trim() : 'Copil',
      sessionsPaid: sessionsTotal,
      sessionsAttended: sessionsTotal - sessionsRemaining,
      sessionsRemaining,
    };
  });
};

// Add sessions to a child's enrollment using Edge Function
export const addSessions = async (enrollmentId: string, count: number): Promise<void> => {
  const { data, error } = await supabase.functions.invoke('purchase-sessions', {
    body: JSON.stringify({
      enrollmentId,
      sessionCount: count,
      paymentMethod: 'CASH',
    }),
  });

  if (error) throw new Error(error.message ?? 'Failed to add sessions');
  if (data?.error) throw new Error(data.error);
};
