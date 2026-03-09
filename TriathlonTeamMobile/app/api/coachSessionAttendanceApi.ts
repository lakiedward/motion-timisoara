import { supabase } from '../lib/supabase';

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
  // Get occurrence details
  const { data: occ, error: occError } = await supabase
    .from('course_occurrences')
    .select(`
      id,
      starts_at,
      course_id,
      courses!inner (name)
    `)
    .eq('id', occurrenceId)
    .single();

  if (occError || !occ) throw new Error(occError?.message ?? 'Occurrence not found');

  const course = Array.isArray(occ.courses) ? occ.courses[0] : occ.courses;

  // Get enrolled children with session info
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select(`
      id,
      child_id,
      sessions_remaining,
      sessions_total,
      children (id, first_name, last_name)
    `)
    .eq('entity_id', occ.course_id)
    .eq('entity_type', 'COURSE')
    .eq('status', 'ACTIVE');

  if (enrollError) throw new Error(enrollError.message);

  // Get existing attendance for this occurrence
  const { data: attendanceRecords } = await supabase
    .from('attendance')
    .select('child_id, status')
    .eq('course_occurrence_id', occurrenceId);

  const attendanceMap = new Map(
    (attendanceRecords ?? []).map((a) => [a.child_id, a.status]),
  );

  const LOW_SESSION_THRESHOLD = 2;

  const children: ChildAttendancePaymentDto[] = (enrollments ?? []).map((e) => {
    const child = Array.isArray(e.children) ? e.children[0] : e.children;
    const sessionsTotal = e.sessions_total ?? 0;
    const sessionsRemaining = e.sessions_remaining ?? 0;
    const sessionsUsed = sessionsTotal - sessionsRemaining;

    return {
      enrollmentId: e.id,
      childId: e.child_id,
      childName: child ? `${child.first_name} ${child.last_name}`.trim() : '',
      attendanceStatus: (attendanceMap.get(e.child_id) as 'PRESENT' | 'ABSENT') ?? null,
      remainingSessions: sessionsRemaining,
      sessionsUsed,
      lowSessionWarning: sessionsRemaining > 0 && sessionsRemaining <= LOW_SESSION_THRESHOLD,
    };
  });

  return {
    occurrenceId: occ.id,
    courseName: course?.name ?? '',
    startsAt: occ.starts_at ?? '',
    children,
  };
};

export const markCoachSessionAttendance = async (
  occurrenceId: string,
  items: MarkSessionAttendanceItemDto[],
): Promise<void> => {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // Get course_id for the occurrence
  const { data: occ } = await supabase
    .from('course_occurrences')
    .select('course_id')
    .eq('id', occurrenceId)
    .single();

  for (const item of items) {
    // Find enrollment
    let enrollmentId: string | null = null;
    if (occ) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('child_id', item.childId)
        .eq('entity_id', occ.course_id)
        .eq('entity_type', 'COURSE')
        .eq('status', 'ACTIVE')
        .maybeSingle();
      enrollmentId = enrollment?.id ?? null;
    }

    // Upsert attendance
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('course_occurrence_id', occurrenceId)
      .eq('child_id', item.childId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('attendance')
        .update({
          status: item.status,
          note: item.note ?? null,
          marked_by: user.user.id,
        })
        .eq('id', existing.id);

      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('attendance').insert({
        course_occurrence_id: occurrenceId,
        child_id: item.childId,
        enrollment_id: enrollmentId,
        status: item.status,
        note: item.note ?? null,
        marked_by: user.user.id,
      });

      if (error) throw new Error(error.message);
    }
  }
};
