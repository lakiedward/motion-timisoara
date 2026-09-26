import { descriereActivitatePreview, pozeActivitatePreview } from '@/api/preview-activity'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

// Shared nested shapes returned by the embedded selects below.
export type SportRow = Pick<Tables<'sports'>, 'id' | 'code' | 'name' | 'default_photo_storage_path'>
export type CoachMini = Pick<Tables<'profiles'>, 'id' | 'name' | 'avatar_url'>
export type LocationRow = Tables<'locations'>

export type CourseListItem = Tables<'courses'> & {
  sport: SportRow | null
  coach: CoachMini | null
  location: LocationRow | null
  occurrences: Pick<Tables<'course_occurrences'>, 'id' | 'starts_at' | 'ends_at'>[]
  course_photos: Pick<Tables<'course_photos'>, 'storage_path' | 'display_order'>[]
}

export interface CourseFilters {
  sportCode?: string
  level?: string
  city?: string
}

export async function getCourses(filters: CourseFilters = {}): Promise<CourseListItem[]> {
  let q = supabase
    .from('courses')
    .select(
      '*, sport:sports(id,code,name,default_photo_storage_path), coach:profiles(id,name,avatar_url), location:locations(*), occurrences:course_occurrences(id,starts_at,ends_at), course_photos(storage_path,display_order)',
    )
    .eq('active', true)
  if (filters.level) q = q.eq('level', filters.level)
  const { data, error } = await q.order('name')
  if (error) throw error
  let rows = (data ?? []) as unknown as CourseListItem[]
  if (filters.sportCode) rows = rows.filter((c) => c.sport?.code === filters.sportCode)
  if (filters.city) rows = rows.filter((c) => c.location?.city === filters.city)
  return rows
}

export async function getCourse(id: string): Promise<CourseListItem | null> {
  const { data, error } = await supabase
    .from('courses')
    .select(
      '*, sport:sports(id,code,name,default_photo_storage_path), coach:profiles(id,name,avatar_url), location:locations(*), occurrences:course_occurrences(id,starts_at,ends_at), course_photos(storage_path,display_order)',
    )
    .eq('id', id)
    .single()
  if (error) return null
  return data as unknown as CourseListItem
}

/** Remaining seats for a public course (SECURITY DEFINER RPC). Null = unlimited / unknown. */
export async function getCourseSpotsRemaining(courseId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('course_spots_remaining', {
    p_course_id: courseId,
  })
  if (error) throw error
  return (data as number | null) ?? null
}

export type ActivityListItem = Tables<'activities'> & {
  sport: SportRow | null
  location: LocationRow | null
}

export async function getActivities(): Promise<ActivityListItem[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*, sport:sports(id,code,name), location:locations(*)')
    .eq('active', true)
    .order('activity_date')
  if (error) throw error
  return (data ?? []) as unknown as ActivityListItem[]
}

export async function getActivity(id: string): Promise<ActivityListItem | null> {
  const { data, error } = await supabase
    .from('activities')
    .select('*, sport:sports(id,code,name), location:locations(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as unknown as ActivityListItem
}

// `getCamps` a fost scoasă: cerea toate taberele, inclusiv pe cele încheiate,
// ordonate crescător după data de început — deci trecutul urca deasupra
// viitorului, sub titlul „VACANȚE ACTIVE". Lista publică folosește acum
// `getTaberePublice` din `api/camps.ts`, care filtrează. Lăsată aici, ar fi
// fost o capcană: următorul care o cheamă reintroduce exact bug-ul.

export async function getCampBySlug(slug: string): Promise<Tables<'camps'> | null> {
  const { data, error } = await supabase.from('camps').select('*').eq('slug', slug).single()
  if (error) return null
  return data
}

export async function getCamp(id: string): Promise<Tables<'camps'> | null> {
  const { data, error } = await supabase.from('camps').select('*').eq('id', id).single()
  if (error) return null
  return data
}

export type CoachListItem = Tables<'coach_profiles'> & {
  profile: CoachMini | null
  coach_sports: { sport: SportRow | null }[]
}

export async function getCoaches(): Promise<CoachListItem[]> {
  const { data, error } = await supabase
    .from('coach_profiles')
    .select(
      'id, user_id, bio, avatar_url, photo_storage_path, profile:profiles(id,name,avatar_url), coach_sports(sport:sports(id,code,name))',
    )
  if (error) throw error
  return (data ?? []) as unknown as CoachListItem[]
}

export async function getCoachByUserId(userId: string): Promise<CoachListItem | null> {
  const { data, error } = await supabase
    .from('coach_profiles')
    .select(
      'id, user_id, bio, avatar_url, photo_storage_path, profile:profiles(id,name,avatar_url), coach_sports(sport:sports(id,code,name))',
    )
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data as unknown as CoachListItem
}

export type ClubListItem = Tables<'clubs'> & {
  club_sports: { sport: SportRow | null }[]
}

export async function getPublicClubs(): Promise<ClubListItem[]> {
  const { data, error } = await supabase
    .from('clubs')
    .select(
      'id, owner_user_id, name, description, logo_storage_path, hero_photo_storage_path, website, phone, email, public_email_consent, address, city, created_at, club_sports(sport:sports(id,code,name))',
    )
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as ClubListItem[]
}

export async function getPublicClub(id: string): Promise<ClubListItem | null> {
  const { data, error } = await supabase
    .from('clubs')
    .select(
      'id, owner_user_id, name, description, logo_storage_path, hero_photo_storage_path, website, phone, email, public_email_consent, address, city, created_at, club_sports(sport:sports(id,code,name))',
    )
    .eq('id', id)
    .single()
  if (error) return null
  return data as unknown as ClubListItem
}

export async function getLocations(): Promise<LocationRow[]> {
  const { data, error } = await supabase.from('locations').select('*').eq('is_active', true)
  if (error) throw error
  return data ?? []
}

/** Public storage URL for a path in a bucket. */
export function publicUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http') || path.startsWith('/')) return path
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/** Course hero: own upload → admin sport default → null (caller shows gradient). */
export function courseHeroUrl(course: {
  course_photos?: { storage_path: string; display_order: number }[] | null
  sport?: { default_photo_storage_path?: string | null } | null
}): string | null {
  const hero = [...(course.course_photos ?? [])].sort(
    (a, b) => a.display_order - b.display_order,
  )[0]
  return (
    publicUrl('course-photos', hero?.storage_path ?? null) ??
    publicUrl('sport-photos', course.sport?.default_photo_storage_path ?? null)
  )
}

export function activityHeroUrl(activity: {
  hero_photo_storage_path?: string | null
  sport?: { default_photo_storage_path?: string | null } | null
}): string | null {
  return (
    publicUrl('activity-photos', activity.hero_photo_storage_path) ??
    publicUrl('sport-photos', activity.sport?.default_photo_storage_path)
  )
}

type ActivitateProgramata = {
  activity_date: string
  start_time: string
  end_time: string
}

function parteZona(parti: Intl.DateTimeFormatPart[], tip: Intl.DateTimeFormatPartTypes): number {
  return Number(parti.find((parte) => parte.type === tip)?.value)
}

export function sfarsitActivitate(activityDate: string, endTime: string): number {
  const [an, luna, zi] = activityDate.split('-').map(Number)
  const [ora, minut, secunda] = endTime.split(':').map(Number)
  const caUtc = Date.UTC(an, (luna ?? 1) - 1, zi ?? 1, ora ?? 0, minut ?? 0, secunda ?? 0)
  const parti = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Bucharest',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(caUtc))
  const inZona = Date.UTC(
    parteZona(parti, 'year'),
    parteZona(parti, 'month') - 1,
    parteZona(parti, 'day'),
    parteZona(parti, 'hour'),
    parteZona(parti, 'minute'),
    parteZona(parti, 'second'),
  )
  return caUtc - (inZona - caUtc)
}

export function activitateSAincheiat(
  activityDate: string,
  endTime: string,
  acum = new Date(),
): boolean {
  return sfarsitActivitate(activityDate, endTime) <= acum.getTime()
}

export function activitatiVizibile<T extends ActivitateProgramata>(
  randuri: T[],
  acum = new Date(),
): T[] {
  return randuri
    .filter((rand) => !activitateSAincheiat(rand.activity_date, rand.end_time, acum))
    .sort(
      (a, b) =>
        a.activity_date.localeCompare(b.activity_date) || a.start_time.localeCompare(b.start_time),
    )
}

export type ActivitateDinLista = {
  id: string
  name: string
  activityDate: string
  startTime: string
  endTime: string
  price: number
  currency: string
  locationName: string | null
  sportName: string | null
  heroUrl: string | null
  organizator: string | null
  locuriRamase: number | null
}

type ActivitateBruta = ActivitateProgramata & {
  id: string
  name: string
  price: number
  currency: string
  hero_photo_storage_path: string | null
  sport: SportRow | null
  location: { name: string } | null
  club: { name: string } | null
  coach: { name: string } | null
}

export async function getActivitatiPublice(acum = new Date()): Promise<ActivitateDinLista[]> {
  const { data, error } = await supabase
    .from('activities')
    .select(
      'id, name, activity_date, start_time, end_time, price, currency, hero_photo_storage_path, sport:sports(id, code, name, default_photo_storage_path), location:locations(name), club:clubs(name), coach:profiles(name)',
    )
    .eq('active', true)
    .order('activity_date')
    .order('start_time')
  if (error) throw error

  const vizibile = activitatiVizibile((data ?? []) as unknown as ActivitateBruta[], acum)
  const locuri = await Promise.all(
    vizibile.map(async (activitate) => {
      const { data: ramase, error: eLocuri } = await supabase.rpc('activity_spots_remaining', {
        p_activity_id: activitate.id,
      })
      if (eLocuri) throw eLocuri
      return ramase
    }),
  )

  return vizibile.map((activitate, index) => ({
    id: activitate.id,
    name: activitate.name,
    activityDate: activitate.activity_date,
    startTime: activitate.start_time,
    endTime: activitate.end_time,
    price: activitate.price,
    currency: activitate.currency,
    locationName: activitate.location?.name ?? null,
    sportName: activitate.sport?.name ?? null,
    heroUrl: activityHeroUrl(activitate),
    organizator: activitate.club?.name ?? activitate.coach?.name ?? null,
    locuriRamase: locuri[index] ?? null,
  }))
}

export type PersoanaActivitate = {
  id: string
  nume: string
  link: string
  pozaUrl: string | null
}

export type ActivitateDetaliu = {
  id: string
  name: string
  description: string | null
  activityDate: string
  startTime: string
  endTime: string
  price: number
  currency: string
  eur_ron_rate_micros: number | null
  bandUrl: string | null
  location: { name: string; lat: number | null; lng: number | null } | null
  organizator: PersoanaActivitate | null
  antrenori: PersoanaActivitate[]
  galerieUrls: string[]
  locuriRamase: number | null
  regulament: {
    rules_file_storage_path: string | null
    rules_file_name: string | null
    rules_file_content_type: string | null
    rules_file_size_bytes: number | null
  }
}

type ActivitateDetaliuBruta = {
  id: string
  name: string
  description: string | null
  activity_date: string
  start_time: string
  end_time: string
  price: number
  currency: string
  eur_ron_rate_micros: number | null
  hero_photo_storage_path: string | null
  rules_file_storage_path: string | null
  rules_file_name: string | null
  rules_file_content_type: string | null
  rules_file_size_bytes: number | null
  sport: SportRow | null
  location: { name: string; lat: number | null; lng: number | null } | null
  club: { id: string; name: string; logo_storage_path: string | null } | null
  coach: { id: string; name: string; avatar_url: string | null } | null
}

function pozaAntrenor(cale: string | null | undefined, avatar: string | null | undefined) {
  const dinDosar = publicUrl('coach-photos', cale)
  if (dinDosar) return dinDosar
  if (avatar && (avatar.startsWith('http') || avatar.startsWith('/'))) return avatar
  return null
}

function persoanaAntrenor(
  coach: NonNullable<ActivitateDetaliuBruta['coach']>,
  cale: string | null,
): PersoanaActivitate {
  return {
    id: coach.id,
    nume: coach.name,
    link: `/antrenori/${coach.id}`,
    pozaUrl: pozaAntrenor(cale, coach.avatar_url),
  }
}

export async function getActivitateDetaliu(id: string): Promise<ActivitateDetaliu | null> {
  const { data, error } = await supabase
    .from('activities')
    .select(
      'id, name, description, activity_date, start_time, end_time, price, currency, eur_ron_rate_micros, hero_photo_storage_path, rules_file_storage_path, rules_file_name, rules_file_content_type, rules_file_size_bytes, sport:sports(id, code, name, default_photo_storage_path), location:locations(name, lat, lng), club:clubs(id, name, logo_storage_path), coach:profiles(id, name, avatar_url)',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const rand = data as unknown as ActivitateDetaliuBruta
  let calePoza: string | null = null
  if (rand.coach) {
    const profil = await supabase
      .from('coach_profiles')
      .select('photo_storage_path')
      .eq('user_id', rand.coach.id)
      .maybeSingle()
    if (profil.error) throw profil.error
    const gasit = profil.data as { photo_storage_path: string | null } | null
    calePoza = gasit?.photo_storage_path ?? null
  }

  const { data: ramase, error: eLocuri } = await supabase.rpc('activity_spots_remaining', {
    p_activity_id: rand.id,
  })
  if (eLocuri) throw eLocuri

  const antrenor = rand.coach ? persoanaAntrenor(rand.coach, calePoza) : null
  const organizator: PersoanaActivitate | null = rand.club
    ? {
        id: rand.club.id,
        nume: rand.club.name,
        link: `/cluburi/${rand.club.id}`,
        pozaUrl: publicUrl('club-assets', rand.club.logo_storage_path),
      }
    : antrenor
  const poza = activityHeroUrl(rand)

  return {
    id: rand.id,
    name: rand.name,
    description: descriereActivitatePreview(rand.id, rand.description),
    activityDate: rand.activity_date,
    startTime: rand.start_time,
    endTime: rand.end_time,
    price: rand.price,
    currency: rand.currency,
    eur_ron_rate_micros: rand.eur_ron_rate_micros,
    bandUrl: publicUrl('activity-photos', rand.hero_photo_storage_path),
    location: rand.location,
    organizator,
    antrenori: rand.club && antrenor ? [antrenor] : [],
    galerieUrls: pozeActivitatePreview(rand.id, poza ? [poza] : []),
    locuriRamase: typeof ramase === 'number' ? ramase : null,
    regulament: {
      rules_file_storage_path: rand.rules_file_storage_path,
      rules_file_name: rand.rules_file_name,
      rules_file_content_type: rand.rules_file_content_type,
      rules_file_size_bytes: rand.rules_file_size_bytes,
    },
  }
}

export async function submitContactForm(input: {
  name: string
  email: string
  subject?: string
  message: string
}) {
  return supabase.functions.invoke('contact-form', { body: input })
}
