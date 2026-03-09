import { supabase } from '../lib/supabase';

export type AdminCourseDto = {
  id: string;
  name: string;
  coachName: string;
  sport: string;
  level: string | null;
  location: string | null;
  capacity: number | null;
  active: boolean;
  enrolledCount: number;
  reservedCount: number;
  enrolledPaidCount: number;
  enrolledUnpaidCount: number;
  hasHeroPhoto: boolean;
};

export const listAdminCourses = async (): Promise<AdminCourseDto[]> => {
  const { data: courses, error } = await supabase
    .from('courses')
    .select(`
      id,
      name,
      level,
      capacity,
      active,
      hero_photo_storage_path,
      profiles:coach_id (name),
      sports:sport_id (name),
      locations:location_id (name)
    `)
    .order('name');

  if (error) throw new Error(error.message);

  // Get enrollment counts per course
  const courseIds = (courses ?? []).map((c) => c.id);

  const enrollmentCountMap = new Map<string, { enrolled: number; reserved: number; paid: number; unpaid: number }>();

  if (courseIds.length > 0) {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('entity_id, status, payments (status)')
      .in('entity_id', courseIds)
      .eq('entity_type', 'COURSE');

    for (const e of enrollments ?? []) {
      const counts = enrollmentCountMap.get(e.entity_id) ?? { enrolled: 0, reserved: 0, paid: 0, unpaid: 0 };

      if (e.status === 'ACTIVE') {
        counts.enrolled += 1;
        const payment = Array.isArray(e.payments) ? e.payments[0] : e.payments;
        if (payment?.status === 'PAID') {
          counts.paid += 1;
        } else {
          counts.unpaid += 1;
        }
      } else if (e.status === 'RESERVED' || e.status === 'DRAFT') {
        counts.reserved += 1;
      }

      enrollmentCountMap.set(e.entity_id, counts);
    }
  }

  return (courses ?? []).map((c) => {
    const coach = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    const sport = Array.isArray(c.sports) ? c.sports[0] : c.sports;
    const location = Array.isArray(c.locations) ? c.locations[0] : c.locations;
    const counts = enrollmentCountMap.get(c.id) ?? { enrolled: 0, reserved: 0, paid: 0, unpaid: 0 };

    return {
      id: c.id,
      name: c.name,
      coachName: coach?.name ?? '',
      sport: sport?.name ?? '',
      level: c.level ?? null,
      location: location?.name ?? null,
      capacity: c.capacity ?? null,
      active: c.active ?? true,
      enrolledCount: counts.enrolled,
      reservedCount: counts.reserved,
      enrolledPaidCount: counts.paid,
      enrolledUnpaidCount: counts.unpaid,
      hasHeroPhoto: !!c.hero_photo_storage_path,
    };
  });
};
