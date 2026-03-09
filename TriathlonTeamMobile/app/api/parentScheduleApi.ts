import { supabase } from '../lib/supabase';

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
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const now = new Date().toISOString();

  // Get all child IDs for this parent
  const { data: children, error: childError } = await supabase
    .from('children')
    .select('id, first_name, last_name')
    .eq('parent_id', user.user.id);

  if (childError) throw new Error(childError.message);
  if (!children || children.length === 0) return [];

  const childIds = children.map((c) => c.id);
  const childNameMap = new Map(
    children.map((c) => [c.id, `${c.first_name} ${c.last_name}`.trim()]),
  );

  // Get active enrollments for these children
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('id, child_id, entity_type, entity_id')
    .in('child_id', childIds)
    .eq('status', 'ACTIVE');

  if (enrollError) throw new Error(enrollError.message);
  if (!enrollments || enrollments.length === 0) return [];

  // Collect course IDs from enrollments
  const courseIds = enrollments
    .filter((e) => e.entity_type === 'COURSE')
    .map((e) => e.entity_id);

  if (courseIds.length === 0) return [];

  // Get upcoming occurrences
  let query = supabase
    .from('course_occurrences')
    .select(`
      id,
      starts_at,
      ends_at,
      course_id,
      courses!inner (id, name, location_id, locations (name))
    `)
    .in('course_id', courseIds)
    .gte('starts_at', now)
    .order('starts_at', { ascending: true });

  if (limit && limit > 0) {
    query = query.limit(limit);
  }

  const { data: occurrences, error: occError } = await query;
  if (occError) throw new Error(occError.message);

  // Build a map of course_id -> child names (a child can be enrolled in the same course)
  const courseChildMap = new Map<string, string[]>();
  for (const e of enrollments) {
    if (e.entity_type === 'COURSE') {
      const names = courseChildMap.get(e.entity_id) ?? [];
      const childName = childNameMap.get(e.child_id) ?? null;
      if (childName) names.push(childName);
      courseChildMap.set(e.entity_id, names);
    }
  }

  return (occurrences ?? []).map((occ) => {
    const course = Array.isArray(occ.courses) ? occ.courses[0] : occ.courses;
    const location = course?.locations
      ? Array.isArray(course.locations)
        ? course.locations[0]
        : course.locations
      : null;
    const childNames = courseChildMap.get(occ.course_id) ?? [];

    const startsAt = occ.starts_at ? new Date(occ.starts_at) : null;

    return {
      id: occ.id,
      date: occ.starts_at ?? '',
      type: 'course',
      title: course?.name ?? '',
      location: location?.name ?? null,
      time: startsAt ? startsAt.toTimeString().substring(0, 8) : null,
      childName: childNames.length > 0 ? childNames.join(', ') : null,
    };
  });
};
