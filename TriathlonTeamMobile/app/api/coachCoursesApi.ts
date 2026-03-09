import { supabase } from '../lib/supabase';

export type CoachCourseDto = {
  id: string;
  name: string;
  sport: string;
  level: string | null;
  active: boolean;
  description: string | null;
};

export const listCoachCourses = async (): Promise<CoachCourseDto[]> => {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('courses')
    .select(`
      id,
      name,
      level,
      active,
      description,
      sports:sport_id (name)
    `)
    .eq('coach_id', user.user.id)
    .order('name');

  if (error) throw new Error(error.message);

  return (data ?? []).map((c) => {
    const sport = Array.isArray(c.sports) ? c.sports[0] : c.sports;
    return {
      id: c.id,
      name: c.name,
      sport: sport?.name ?? '',
      level: c.level ?? null,
      active: c.active ?? true,
      description: c.description ?? null,
    };
  });
};

// Full course details for edit screen (mirrors CourseResponse in backend)
export type CoachCourseDetailDto = {
  id: string;
  name: string;
  sport: string;
  level: string | null;
  ageFrom: number | null;
  ageTo: number | null;
  coachId: string;
  locationId: string;
  capacity: number | null;
  price: number;
  pricePerSession: number;
  packageOptions: string | null;
  recurrenceRule: string | null;
  active: boolean;
  description: string | null;
  hasHeroPhoto: boolean;
};

export type CoachCourseUpdateRequest = {
  name: string;
  sport: string;
  level: string | null;
  ageFrom: number | null;
  ageTo: number | null;
  coachId: string | null;
  locationId: string;
  capacity: number | null;
  price: number;
  pricePerSession: number;
  packageOptions: string | null;
  recurrenceRule: string;
  active: boolean;
  description: string | null;
  heroPhoto?: string | null;
};

export const getCoachCourse = async (
  courseId: string,
): Promise<CoachCourseDetailDto> => {
  const { data, error } = await supabase
    .from('courses')
    .select(`
      id,
      name,
      level,
      age_from,
      age_to,
      coach_id,
      location_id,
      capacity,
      price,
      price_per_session,
      package_options,
      recurrence_rule,
      active,
      description,
      hero_photo_storage_path,
      sports:sport_id (name)
    `)
    .eq('id', courseId)
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Course not found');

  const sport = Array.isArray(data.sports) ? data.sports[0] : data.sports;

  return {
    id: data.id,
    name: data.name,
    sport: sport?.name ?? '',
    level: data.level ?? null,
    ageFrom: data.age_from ?? null,
    ageTo: data.age_to ?? null,
    coachId: data.coach_id,
    locationId: data.location_id,
    capacity: data.capacity ?? null,
    price: data.price ?? 0,
    pricePerSession: data.price_per_session ?? 0,
    packageOptions: data.package_options ?? null,
    recurrenceRule: data.recurrence_rule ?? null,
    active: data.active ?? true,
    description: data.description ?? null,
    hasHeroPhoto: !!data.hero_photo_storage_path,
  };
};

export const updateCoachCourse = async (
  courseId: string,
  payload: CoachCourseUpdateRequest,
): Promise<CoachCourseDetailDto> => {
  // Resolve sport name to sport_id
  let sportId: string | null = null;
  if (payload.sport) {
    const { data: sportData } = await supabase
      .from('sports')
      .select('id')
      .eq('name', payload.sport)
      .single();
    sportId = sportData?.id ?? null;
  }

  const { error } = await supabase
    .from('courses')
    .update({
      name: payload.name,
      sport_id: sportId,
      level: payload.level,
      age_from: payload.ageFrom,
      age_to: payload.ageTo,
      coach_id: payload.coachId,
      location_id: payload.locationId,
      capacity: payload.capacity,
      price: payload.price,
      price_per_session: payload.pricePerSession,
      package_options: payload.packageOptions,
      recurrence_rule: payload.recurrenceRule,
      active: payload.active,
      description: payload.description,
    })
    .eq('id', courseId);

  if (error) throw new Error(error.message);

  return getCoachCourse(courseId);
};

export const setCoachCourseStatus = async (
  courseId: string,
  active: boolean,
): Promise<void> => {
  const { error } = await supabase
    .from('courses')
    .update({ active })
    .eq('id', courseId);

  if (error) throw new Error(error.message);
};
