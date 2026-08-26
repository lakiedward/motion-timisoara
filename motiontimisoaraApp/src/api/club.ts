import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import type { LocationFormInput } from '@/api/coach'

async function uid(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.user.id
}

export type Club = Tables<'clubs'>

export async function getMyClub(): Promise<Club | null> {
  const owner = await uid()
  const { data, error } = await supabase
    .from('clubs')
    .select('*')
    .eq('owner_user_id', owner)
    .maybeSingle()
  if (error) throw error
  return data
}

export interface ClubProfileInput {
  name: string
  description: string | null
  website: string | null
  email: string | null
  phone: string | null
  city: string | null
  address: string | null
  public_email_consent: boolean
  company_name: string | null
  company_cui: string | null
  bank_account: string | null
  bank_name: string | null
}

export async function updateClub(id: string, input: ClubProfileInput) {
  const { error } = await supabase.from('clubs').update(input).eq('id', id)
  if (error) throw error
}

// ===== Coaches roster =====
export type ClubCoach = {
  coach_profile_id: string
  name: string
  email: string
  photo_storage_path: string | null
}

export async function getClubCoaches(clubId: string): Promise<ClubCoach[]> {
  const { data, error } = await supabase
    .from('club_coaches')
    .select('coach_profile:coach_profiles(id, photo_storage_path, profile:profiles(name, email))')
    .eq('club_id', clubId)
  if (error) throw error
  type Row = {
    coach_profile: {
      id: string
      photo_storage_path: string | null
      profile: { name: string; email: string } | null
    } | null
  }
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.coach_profile)
    .map((r) => ({
      coach_profile_id: r.coach_profile!.id,
      name: r.coach_profile!.profile?.name ?? '—',
      email: r.coach_profile!.profile?.email ?? '',
      photo_storage_path: r.coach_profile!.photo_storage_path,
    }))
}

export interface CreateManagedCoachInput {
  email: string
  name: string
  phone?: string
  bio?: string
  sportIds?: string[]
}
export interface CreateManagedCoachResult {
  userId: string
  email: string
  tempPassword: string
}

/** Creates a coach account directly (club roster) via the Edge Function. */
export async function createManagedCoach(
  input: CreateManagedCoachInput
): Promise<CreateManagedCoachResult> {
  const { data, error } = await supabase.functions.invoke('create-managed-coach', { body: input })
  if (error) {
    let msg = 'Nu am putut crea antrenorul.'
    const ctx = (error as { context?: Response })?.context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const b = await ctx.json()
        if (b?.error) msg = b.error as string
      } catch {
        /* ignore */
      }
    }
    throw new Error(msg)
  }
  return data as CreateManagedCoachResult
}

export async function removeClubCoach(clubId: string, coachProfileId: string) {
  const { error } = await supabase
    .from('club_coaches')
    .delete()
    .eq('club_id', clubId)
    .eq('coach_profile_id', coachProfileId)
  if (error) throw error
}

// ===== Club invitation codes =====
export type ClubCode = Tables<'club_invitation_codes'>

export async function getClubCodes(clubId: string): Promise<ClubCode[]> {
  const { data, error } = await supabase
    .from('club_invitation_codes')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

function randomCode(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part = () => Array.from({ length: 4 }, () => a[Math.floor(Math.random() * a.length)]).join('')
  return `${part()}-${part()}`
}

export async function generateClubCode(clubId: string, maxUses = 1): Promise<string> {
  const owner = await uid()
  const code = randomCode()
  const { error } = await supabase.from('club_invitation_codes').insert({
    club_id: clubId,
    code,
    created_by_user_id: owner,
    max_uses: maxUses,
    current_uses: 0,
  })
  if (error) throw error
  return code
}

export async function deleteClubCode(id: string) {
  const { error } = await supabase.from('club_invitation_codes').delete().eq('id', id)
  if (error) throw error
}

// ===== Club announcements =====
export type ClubAnnouncement = Tables<'club_announcements'>

/** Cui i se poate adresa un anunt. `CAMP` exista in baza, dar nu se ofera in
 *  interfata: `camps` nu are `club_id`, deci un club n-are inca tabere ale lui. */
export type AudienceKind = 'CLUB' | 'COURSE' | 'ACTIVITY'

/** O tinta posibila pentru un anunt: un curs sau o activitate a clubului. */
export type ClubAudience = {
  kind: Exclude<AudienceKind, 'CLUB'>
  id: string
  name: string
  active: boolean
}

/**
 * Cursurile si activitatile clubului, ca tinte pentru anunturi.
 *
 * Intoarce si pe cele inactive, ca eticheta unui anunt vechi sa se poata rezolva
 * dupa ce cursul a fost oprit — alegerea unei tinte NOI filtreaza mai departe pe
 * `active`, in pagina. Acelasi tipar ca la `getClubSelectableLocations`.
 *
 * Atentie: `courses_select` include `club_id IN my_club_ids()`, deci clubul isi
 * vede toate cursurile; `activities_select` NU are clauza de club, deci o
 * activitate dezactivata nu ajunge inapoi si eticheta ei cade pe textul de
 * rezerva. Se repara in politica, nu aici.
 */
export async function getClubAudiences(clubId: string): Promise<ClubAudience[]> {
  const [cursuri, activitati] = await Promise.all([
    supabase.from('courses').select('id, name, active').eq('club_id', clubId).order('name'),
    supabase.from('activities').select('id, name, active').eq('club_id', clubId).order('name'),
  ])
  if (cursuri.error) throw cursuri.error
  if (activitati.error) throw activitati.error
  return [
    ...(cursuri.data ?? []).map((c) => ({
      kind: 'COURSE' as const,
      id: c.id,
      name: c.name,
      active: c.active,
    })),
    ...(activitati.data ?? []).map((a) => ({
      kind: 'ACTIVITY' as const,
      id: a.id,
      name: a.name,
      active: a.active,
    })),
  ]
}

export async function getClubAnnouncements(clubId: string): Promise<ClubAnnouncement[]> {
  const { data, error } = await supabase
    .from('club_announcements')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * Cele trei scrieri de mai jos cer randul inapoi cu `.select().single()`, ca
 * `updateClubLocation`. Fara el PostgREST raspunde 204 No Content si cand RLS a
 * filtrat toate randurile, deci un refuz ar aparea pe ecran ca reusita: anuntul
 * ar parea publicat, ascuns sau sters fara sa se fi intamplat nimic.
 */
export async function createClubAnnouncement(input: {
  club_id: string
  title: string
  content: string
  priority: string
  audience_kind: AudienceKind
  /** Gol pentru „tot clubul”; obligatoriu altfel — constrangerea din baza o cere. */
  audience_id: string | null
}): Promise<ClubAnnouncement> {
  const author = await uid()
  const { data, error } = await supabase
    .from('club_announcements')
    .insert({ ...input, author_user_id: author, is_active: true })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setAnnouncementActive(
  id: string,
  is_active: boolean,
): Promise<ClubAnnouncement> {
  const { data, error } = await supabase
    .from('club_announcements')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteClubAnnouncement(id: string): Promise<ClubAnnouncement> {
  const { data, error } = await supabase
    .from('club_announcements')
    .delete()
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ===== Club locations =====
/** O locatie a clubului, cu numarul de cursuri care se tin acolo. */
export type ClubLocation = Tables<'locations'> & { courseCount: number }

/**
 * Locatiile pe care le ADMINISTREAZA clubul, cu numarul de cursuri legate de
 * fiecare. Numarul e cerut in aceeasi interogare (`courses(count)`), fiindca
 * dezactivarea unei locatii trebuie sa poata spune pe cate cursuri cade —
 * altfel clubul afla dupa.
 */
export async function getClubLocations(clubId: string): Promise<ClubLocation[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*, courses(count)')
    .eq('club_id', clubId)
    .order('name')
  if (error) throw error
  type Row = Tables<'locations'> & { courses?: { count: number }[] }
  return ((data ?? []) as unknown as Row[]).map(({ courses, ...loc }) => ({
    ...loc,
    courseCount: courses?.[0]?.count ?? 0,
  }))
}

/**
 * Locatiile pe care clubul le poate FOLOSI intr-un curs: ale lui plus cele
 * comune ale platformei (`club_id` gol, ex. Bazin Olimpic Timisoara). Salile
 * private ale altor cluburi nu apar.
 *
 * Deliberat separata de `getClubLocations`, care listeaza doar ce ADMINISTREAZA
 * clubul si alimenteaza pagina de locatii si numaratoarea din panou — acolo o
 * locatie comuna ar aparea ca fiind a clubului si ar sugera ca o poate edita.
 */
export async function getClubSelectableLocations(
  clubId: string,
  keepId?: string | null,
): Promise<Pick<Tables<'locations'>, 'id' | 'name' | 'city'>[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, city, is_active')
    .or(`club_id.eq.${clubId},club_id.is.null`)
    .order('name')
  if (error) throw error
  // Pentru alegeri NOI oferim doar sali active. Dar locatia deja salvata pe un
  // curs ramane in lista chiar daca a fost dezactivata intre timp — altfel
  // editarea ii pierde optiunea, selectul cade pe „—” si salvarea cere o
  // locatie care era deja pusa. Exact esecul pe care aceasta schimbare il repara.
  return (data ?? [])
    .filter((l) => l.is_active || l.id === keepId)
    .map(({ id, name, city }) => ({ id, name, city }))
}

/**
 * Doar locatiile pe care le administreaza clubul dat. Filtrul pe `club_id` e
 * obligatoriu aici: politica `locations_select` lasa orice utilizator CLUB sa
 * CITEASCA orice locatie, deci fara el un id strain ar precompleta formularul de
 * editare cu datele altui club — desi `locations_update` refuza apoi salvarea.
 */
export async function getClubLocationById(
  id: string,
  clubId: string,
): Promise<Tables<'locations'> | null> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .eq('club_id', clubId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createClubLocation(clubId: string, input: LocationFormInput) {
  const owner = await uid()
  const { error } = await supabase
    .from('locations')
    .insert({ ...input, club_id: clubId, created_by_user_id: owner, is_active: true })
  if (error) throw error
}

/**
 * `.select().single()` ca in `coach.ts` `updateLocation`: fara el, PostgREST
 * raspunde 204 No Content si cand RLS a filtrat toate randurile, iar apelantul
 * nu are cum sa deosebeasca „am salvat" de „nu aveam voie". Cu el, zero randuri
 * inseamna eroare, deci ecranul arata un esec, nu un fals succes.
 */
export async function updateClubLocation(
  id: string,
  input: LocationFormInput,
): Promise<Tables<'locations'>> {
  const { data, error } = await supabase
    .from('locations')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * `.select().single()` ca la `updateClubLocation`: fara el PostgREST raspunde 204
 * si cand RLS a filtrat toate randurile, deci o comutare refuzata ar aparea pe
 * ecran ca reusita.
 */
export async function setClubLocationActive(id: string, is_active: boolean) {
  const { error } = await supabase
    .from('locations')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
}

// ===== Club courses =====
export type ClubCourse = Tables<'courses'> & {
  sport: Pick<Tables<'sports'>, 'id' | 'name'> | null
  location: Pick<Tables<'locations'>, 'id' | 'name'> | null
  coach: Pick<Tables<'profiles'>, 'id' | 'name'> | null
}

export async function getClubCourses(clubId: string): Promise<ClubCourse[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*, sport:sports(id,name), location:locations(id,name), coach:profiles!courses_coach_id_fkey(id,name)')
    .eq('club_id', clubId)
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as ClubCourse[]
}

export async function getClubCourseById(id: string): Promise<Tables<'courses'> | null> {
  const { data, error } = await supabase.from('courses').select('*').eq('id', id).single()
  if (error) return null
  return data
}

/** Roster coaches for the course coach picker (user_id = courses.coach_id). */
export async function getClubRosterForSelect(
  clubId: string
): Promise<{ user_id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('club_coaches')
    .select('coach_profile:coach_profiles(user_id, profile:profiles(name))')
    .eq('club_id', clubId)
  if (error) throw error
  type Row = {
    coach_profile: { user_id: string; profile: { name: string } | null } | null
  }
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.coach_profile)
    .map((r) => ({ user_id: r.coach_profile!.user_id, name: r.coach_profile!.profile?.name ?? '—' }))
}

export interface ClubCourseFormInput {
  name: string
  sport_id: string
  location_id: string
  coach_id: string
  level: string | null
  age_from: number | null
  age_to: number | null
  capacity: number | null
  price_per_session: number // bani
  description: string | null
}

export async function createClubCourse(clubId: string, input: ClubCourseFormInput) {
  const { error } = await supabase.from('courses').insert({
    ...input,
    club_id: clubId,
    payment_recipient: 'CLUB',
    price: input.price_per_session * 8,
    active: true,
  })
  if (error) throw error
}

export async function updateClubCourse(id: string, input: ClubCourseFormInput) {
  const { error } = await supabase
    .from('courses')
    .update({ ...input, price: input.price_per_session * 8 })
    .eq('id', id)
  if (error) throw error
}

export async function setClubCourseActive(id: string, active: boolean) {
  const { error } = await supabase.from('courses').update({ active }).eq('id', id)
  if (error) throw error
}
