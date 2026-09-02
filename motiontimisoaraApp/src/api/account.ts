import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert } from '@/lib/database.types'

export type Child = Tables<'children'>
export type ChildInput = Omit<TablesInsert<'children'>, 'id' | 'parent_id' | 'created_at'>

export async function getMyChildren(): Promise<Child[]> {
  const { data, error } = await supabase.from('children').select('*').order('name')
  if (error) throw error
  return data ?? []
}

/**
 * Copilul cerut, sau `null` cand nu exista ori nu e al parintelui (RLS il ascunde).
 *
 * `maybeSingle` + aruncarea erorii, nu `single` cu `return null` pe orice esec:
 * altfel „nu exista" si „n-am putut citi" arata la fel pentru apelant, iar ecranul
 * ii spune parintelui ca nu are copilul cand de fapt a picat reteaua.
 */
export async function getChild(id: string): Promise<Child | null> {
  const { data, error } = await supabase.from('children').select('*').eq('id', id).maybeSingle()
  // `22P02` = id-ul din adresa nu e nici macar un uuid valid. Pentru Postgres e o
  // eroare de sintaxa, dar pentru parinte e tot „copilul asta nu exista": niciun
  // rand nu l-ar fi putut potrivi. Restul erorilor sunt esecuri reale si urca.
  if (error) {
    if (error.code === '22P02') return null
    throw error
  }
  return data
}

export async function createChild(input: ChildInput): Promise<Child> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('children')
    .insert({ ...input, parent_id: session.user.id, gdpr_consent_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateChild(id: string, input: Partial<ChildInput>): Promise<Child> {
  const { data, error } = await supabase
    .from('children')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Intorcea raspunsul brut in loc sa arunce, deci `onError` din pagina nu se
 * declansa niciodata: si o eroare reala afisa „Copilul a fost sters". Acum
 * arunca, si cere randul inapoi cu `.select().single()` ca sa nu treaca drept
 * reusita nici o stergere pe care RLS a filtrat-o.
 */
export async function deleteChild(id: string) {
  const { error } = await supabase.from('children').delete().eq('id', id).select().single()
  if (error) throw error
}

/** Enrollment rows for the current parent (RLS-scoped via children), with payment + child. */
export type EnrollmentRow = Tables<'enrollments'> & {
  child: Pick<Tables<'children'>, 'id' | 'name'> | null
  payments: Pick<Tables<'payments'>, 'amount' | 'status' | 'method' | 'paid_at'>[]
}

export async function getMyEnrollments(): Promise<EnrollmentRow[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*, child:children(id,name), payments(amount,status,method,paid_at)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as EnrollmentRow[]
}

/** Attendance for a child, joined to occurrence + course, newest first. */
export type AttendanceRow = Tables<'attendance'> & {
  occurrence: { starts_at: string; course: { name: string } | null } | null
}

export async function getChildAttendance(childId: string): Promise<AttendanceRow[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*, occurrence:course_occurrences(starts_at, course:courses(name))')
    .eq('child_id', childId)
  if (error) throw error
  return (data ?? []) as unknown as AttendanceRow[]
}

/**
 * Prezenta mai multor copii deodata, pentru vederea „Toti copiii".
 *
 * Un singur `.in(...)` in loc de cate o cerere per copil: politica `attendance_select`
 * restrange oricum randurile la copiii parintelui, deci lista de id-uri e o comoditate
 * pentru client, nu o masura de securitate. Randul poarta `child_id`, deci numele se
 * pune din lista de copii deja incarcata — fara join in plus.
 */
export async function getChildrenAttendance(childIds: string[]): Promise<AttendanceRow[]> {
  if (!childIds.length) return []
  const { data, error } = await supabase
    .from('attendance')
    .select('*, occurrence:course_occurrences(starts_at, course:courses(name))')
    .in('child_id', childIds)
  if (error) throw error
  return (data ?? []) as unknown as AttendanceRow[]
}

/** Course announcements for courses the parent's children are enrolled in (RLS-scoped). */
export type CourseAnnouncementRow = Tables<'course_announcements'> & {
  course: Pick<Tables<'courses'>, 'id' | 'name'> | null
}

export async function getMyCourseAnnouncements(): Promise<CourseAnnouncementRow[]> {
  const { data, error } = await supabase
    .from('course_announcements')
    .select('*, course:courses(id,name)')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as CourseAnnouncementRow[]
}

/**
 * Un anunt asa cum il vede parintele, indiferent din ce tabela vine.
 *
 * Sunt doua canale, si pana acum pagina il citea doar pe unul: `course_announcements`,
 * scris de antrenorul cursului, si `club_announcements`, scris de club. Al doilea
 * nu ajungea la nimeni, desi politica lui de citire era gandita pentru parinti.
 */
export type AnnouncementRow = {
  id: string
  content: string
  title: string | null
  created_at: string
  pinned: boolean
  /** „Antrenor” pentru anunturile de curs, „Club” pentru cele ale clubului. */
  sursa: 'coach' | 'club'
  /** Cine l-a scris, asa cum se arata pe card: numele cursului sau al clubului. */
  autor: string
  courseId: string | null
}

type ClubAnnouncementRow = Tables<'club_announcements'> & {
  club: Pick<Tables<'clubs'>, 'id' | 'name'> | null
}

/**
 * Anunturile de club care ajung la parintele curent. Filtrarea dupa audienta o
 * face politica `club_announcements_select` in baza — clientul nu decide cine ce
 * vede, doar cere. Ascunse, programate in viitor si expirate nu vin inapoi.
 */
async function getMyClubAnnouncements(): Promise<ClubAnnouncementRow[]> {
  const acum = new Date().toISOString()
  const { data, error } = await supabase
    .from('club_announcements')
    .select('*, club:clubs(id,name)')
    // Filtrele astea par o dublare a politicii, dar nu sunt: prima clauza a
    // politicii lasa un proprietar de club sa-si vada TOATE anunturile, inclusiv
    // ascunse, programate in viitor si expirate. Pe pagina de parinte, acelasi om
    // trebuie sa vada ce vede un parinte — altfel isi verifica un anunt ascuns
    // aici si crede ca a ajuns la lume.
    .eq('is_active', true)
    .or(`publish_at.is.null,publish_at.lte.${acum}`)
    .or(`expires_at.is.null,expires_at.gt.${acum}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as ClubAnnouncementRow[]
}

/** Ambele canale, intr-o singura lista: fixatele intai, apoi cronologic invers. */
export async function getMyAnnouncements(): Promise<AnnouncementRow[]> {
  const [cursuri, cluburi] = await Promise.all([
    getMyCourseAnnouncements(),
    getMyClubAnnouncements(),
  ])
  const randuri: AnnouncementRow[] = [
    ...cursuri.map((a) => ({
      id: a.id,
      content: a.content,
      title: null,
      created_at: a.created_at,
      pinned: a.pinned,
      sursa: 'coach' as const,
      autor: a.course?.name ?? 'Curs',
      courseId: a.course?.id ?? null,
    })),
    ...cluburi.map((a) => ({
      id: a.id,
      content: a.content,
      title: a.title,
      created_at: a.created_at,
      pinned: false,
      sursa: 'club' as const,
      autor: a.club?.name ?? 'Club',
      courseId: null,
    })),
  ]
  return randuri.sort(
    (x, y) =>
      Number(y.pinned) - Number(x.pinned) ||
      new Date(y.created_at).getTime() - new Date(x.created_at).getTime(),
  )
}

export function childAge(birthDate: string): number {
  const d = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}
