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

export type EnrollmentRow = Tables<'enrollments'> & {
  child: Pick<Tables<'children'>, 'id' | 'name'> | null
  payments: Pick<
    Tables<'payments'>,
    'amount' | 'currency' | 'pricing_snapshot' | 'status' | 'method' | 'paid_at'
  >[]
  offerTitle: string | null
  offerPath: string | null
  competition_registration?: {
    category_name_snapshot: string
    route_name_snapshot: string
  } | null
}

type Offer = { title: string; path: string }

async function offersById(
  kind: 'CAMP' | 'COURSE' | 'ACTIVITY' | 'COMPETITION',
  ids: string[],
): Promise<Map<string, Offer>> {
  const offers = new Map<string, Offer>()
  if (!ids.length) return offers
  const rows: { id: string; title: string; path: string }[] = []
  if (kind === 'COMPETITION') {
    const { data, error } = await supabase.from('competitions').select('id, title, slug').in('id', ids)
    if (error) throw error
    for (const row of data ?? []) rows.push({ id: row.id, title: row.title, path: `/concursuri/${row.slug}` })
  } else if (kind === 'CAMP') {
    const { data, error } = await supabase.from('camps').select('id, title, slug').in('id', ids)
    if (error) throw error
    for (const row of data ?? []) rows.push({ id: row.id, title: row.title, path: `/tabere/${row.slug}` })
  } else if (kind === 'COURSE') {
    const { data, error } = await supabase.from('courses').select('id, name').in('id', ids)
    if (error) throw error
    for (const row of data ?? []) rows.push({ id: row.id, title: row.name, path: `/cursuri/${row.id}` })
  } else {
    const { data, error } = await supabase.from('activities').select('id, name').in('id', ids)
    if (error) throw error
    for (const row of data ?? []) rows.push({ id: row.id, title: row.name, path: `/activitati/${row.id}` })
  }
  for (const row of rows) offers.set(row.id, { title: row.title.trim(), path: row.path })
  return offers
}

async function offerDetails(rows: { kind: string; entity_id: string }[]) {
  const idsFor = (kind: string) => [
    ...new Set(rows.filter((row) => row.kind === kind).map((row) => row.entity_id)),
  ]
  const kinds = ['CAMP', 'COURSE', 'ACTIVITY', 'COMPETITION'] as const
  const maps = await Promise.all(kinds.map((kind) => offersById(kind, idsFor(kind))))
  return new Map<string, Offer>(
    maps.flatMap((map, index) => [...map].map(([id, offer]) => [`${kinds[index]}:${id}`, offer] as const)),
  )
}

export async function getMyEnrollments(): Promise<EnrollmentRow[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('Autentificarea este necesară pentru înscrieri')
  const userId = userData.user.id
  const { data: children, error: childrenError } = await supabase
    .from('children')
    .select('id')
    .eq('parent_id', userId)
  if (childrenError) throw childrenError
  const childIds = (children ?? []).map((child) => child.id)
  const participantFilter = childIds.length
    ? `adult_profile_id.eq.${userId},child_id.in.(${childIds.join(',')})`
    : `adult_profile_id.eq.${userId}`
  const { data, error } = await supabase
    .from('enrollments')
    .select(
      '*, child:children(id,name), payments(amount,currency,pricing_snapshot,status,method,paid_at), competition_registration:competition_registrations(category_name_snapshot,route_name_snapshot)',
    )
    .or(participantFilter)
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as Omit<EnrollmentRow, 'offerTitle' | 'offerPath'>[]
  if (!rows.length) return []
  const offers = await offerDetails(rows)
  return rows.map((row) => {
    const offer = offers.get(`${row.kind}:${row.entity_id}`)
    return { ...row, offerTitle: offer?.title || null, offerPath: offer?.path ?? null }
  })
}

/** Attendance for a child, joined to occurrence + course, newest first. */
export type AttendanceRow = Tables<'attendance'> & {
  occurrence: { starts_at: string; course: { name: string } | null } | null
}

/**
 * Un cod QR nou pentru copil. Din clipa asta vechiul cod nu mai e recunoscut de
 * nimeni, de asta baza îl lasă doar părintelui (sau adminului), nu antrenorului
 * care poate vedea copilul. Întoarce tokenul nou, ca ecranul să-l deseneze fără
 * o a doua citire.
 */
export async function regenereazaCodulCopilului(childId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenereaza_codul_copilului', { p_child_id: childId })
  if (error) throw error
  return data
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

export function childAge(birthDate: string): number {
  const d = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}
