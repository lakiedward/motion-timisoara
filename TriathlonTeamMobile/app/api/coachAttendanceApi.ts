import { supabase } from '../lib/supabase';

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
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  // Get today's occurrences for the coach's courses
  const { data: occurrences, error: occError } = await supabase
    .from('course_occurrences')
    .select(`
      id,
      starts_at,
      ends_at,
      course_id,
      courses!inner (id, name, coach_id)
    `)
    .eq('courses.coach_id', user.user.id)
    .gte('starts_at', startOfDay)
    .lt('starts_at', endOfDay)
    .order('starts_at');

  if (occError) throw new Error(occError.message);
  if (!occurrences || occurrences.length === 0) return [];

  const results: AttendanceOccurrenceDto[] = [];

  for (const occ of occurrences) {
    const course = Array.isArray(occ.courses) ? occ.courses[0] : occ.courses;

    // Get enrolled children for this course
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('child_id, children (id, first_name, last_name)')
      .eq('entity_id', occ.course_id)
      .eq('entity_type', 'COURSE')
      .eq('status', 'ACTIVE');

    // Get existing attendance for this occurrence
    const { data: attendanceRecords } = await supabase
      .from('attendance')
      .select('child_id, status, note')
      .eq('course_occurrence_id', occ.id);

    const attendanceMap = new Map(
      (attendanceRecords ?? []).map((a) => [a.child_id, a]),
    );

    const children: AttendanceChildDto[] = (enrollments ?? []).map((e) => {
      const child = Array.isArray(e.children) ? e.children[0] : e.children;
      const existing = attendanceMap.get(e.child_id);
      return {
        childId: e.child_id,
        childName: child ? `${child.first_name} ${child.last_name}`.trim() : '',
        status: existing?.status ?? null,
        note: existing?.note ?? null,
      };
    });

    results.push({
      occurrenceId: occ.id,
      courseId: occ.course_id,
      courseName: course?.name ?? '',
      startsAt: occ.starts_at ?? '',
      endsAt: occ.ends_at ?? '',
      children,
    });
  }

  return results;
};

export const markCoachAttendance = async (
  request: AttendanceMarkRequest,
): Promise<void> => {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // Check if record already exists
  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('course_occurrence_id', request.occurrenceId)
    .eq('child_id', request.childId)
    .maybeSingle();

  if (existing) {
    // Update existing attendance
    const { error } = await supabase
      .from('attendance')
      .update({
        status: request.status,
        note: request.note ?? null,
        marked_by: user.user.id,
      })
      .eq('id', existing.id);

    if (error) throw new Error(error.message);
  } else {
    // Find enrollment for the child in this course occurrence
    const { data: occ } = await supabase
      .from('course_occurrences')
      .select('course_id')
      .eq('id', request.occurrenceId)
      .single();

    let enrollmentId: string | null = null;
    if (occ) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('child_id', request.childId)
        .eq('entity_id', occ.course_id)
        .eq('entity_type', 'COURSE')
        .eq('status', 'ACTIVE')
        .maybeSingle();
      enrollmentId = enrollment?.id ?? null;
    }

    const { error } = await supabase.from('attendance').insert({
      course_occurrence_id: request.occurrenceId,
      child_id: request.childId,
      enrollment_id: enrollmentId,
      status: request.status,
      note: request.note ?? null,
      marked_by: user.user.id,
    });

    if (error) throw new Error(error.message);
  }
};
