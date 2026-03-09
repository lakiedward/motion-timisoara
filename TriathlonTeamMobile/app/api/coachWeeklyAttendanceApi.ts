import { supabase } from '../lib/supabase';

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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const getCoachWeeklyCalendar = async (
  weekStart: string,
): Promise<WeeklyCalendarDto> => {
  // Calculate week end (7 days from start)
  const startDate = new Date(weekStart + 'T00:00:00');
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  const weekEnd = endDate.toISOString().split('T')[0];

  // Get all occurrences in this week range with course & coach info
  const { data: occurrences, error } = await supabase
    .from('course_occurrences')
    .select(`
      id,
      starts_at,
      ends_at,
      course_id,
      courses!inner (
        id,
        name,
        coach_id,
        profiles:coach_id (id, name)
      )
    `)
    .gte('starts_at', startDate.toISOString())
    .lt('starts_at', endDate.toISOString())
    .order('starts_at');

  if (error) throw new Error(error.message);

  // Count enrollments per course
  const courseIds = [...new Set((occurrences ?? []).map((o) => o.course_id))];
  const enrollmentCounts = new Map<string, number>();

  if (courseIds.length > 0) {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('entity_id')
      .in('entity_id', courseIds)
      .eq('entity_type', 'COURSE')
      .eq('status', 'ACTIVE');

    for (const e of enrollments ?? []) {
      enrollmentCounts.set(e.entity_id, (enrollmentCounts.get(e.entity_id) ?? 0) + 1);
    }
  }

  // Group by coach then by day
  const coachMap = new Map<string, { coachId: string; coachName: string; dayMap: Map<string, SessionSummaryDto[]> }>();

  for (const occ of occurrences ?? []) {
    const course = Array.isArray(occ.courses) ? occ.courses[0] : occ.courses;
    const coach = course?.profiles
      ? Array.isArray(course.profiles)
        ? course.profiles[0]
        : course.profiles
      : null;

    const coachId = coach?.id ?? course?.coach_id ?? '';
    const coachName = coach?.name ?? '';
    const dateStr = occ.starts_at ? occ.starts_at.substring(0, 10) : '';

    if (!coachMap.has(coachId)) {
      coachMap.set(coachId, { coachId, coachName, dayMap: new Map() });
    }

    const coachEntry = coachMap.get(coachId)!;
    if (!coachEntry.dayMap.has(dateStr)) {
      coachEntry.dayMap.set(dateStr, []);
    }

    coachEntry.dayMap.get(dateStr)!.push({
      occurrenceId: occ.id,
      courseId: occ.course_id,
      courseName: course?.name ?? '',
      startsAt: occ.starts_at ?? '',
      endsAt: occ.ends_at ?? '',
      enrolledCount: enrollmentCounts.get(occ.course_id) ?? 0,
    });
  }

  const coaches: CoachWeekDto[] = Array.from(coachMap.values()).map((entry) => {
    const days: DaySessionsDto[] = Array.from(entry.dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sessions]) => ({
        date,
        dayOfWeek: DAY_NAMES[new Date(date + 'T00:00:00').getDay()],
        sessions,
      }));

    return {
      coachId: entry.coachId,
      coachName: entry.coachName,
      days,
    };
  });

  return {
    weekStart,
    weekEnd,
    coaches,
  };
};
