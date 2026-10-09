import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

type CountableTable = 'profiles' | 'coach_profiles' | 'clubs' | 'courses' | 'camps' | 'competitions'

export const NEW_USERS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
export const POSTGREST_MAX_ROWS = 1000

export type AdminStatKey =
  | 'users'
  | 'coaches'
  | 'clubs'
  | 'courses'
  | 'camps'
  | 'competitions'
  | 'newUsers7d'
  | 'activeInviteCodes'

export type AdminStatCell = {
  value: number | null
  error: string | null
  capped?: boolean
}

export type AdminStats = Record<AdminStatKey, AdminStatCell>

const STAT_LOAD_ERROR: Record<AdminStatKey, string> = {
  users: 'Nu am putut încărca numărul de utilizatori.',
  coaches: 'Nu am putut încărca numărul de antrenori.',
  clubs: 'Nu am putut încărca numărul de cluburi.',
  courses: 'Nu am putut încărca numărul de cursuri.',
  camps: 'Nu am putut încărca numărul de tabere.',
  competitions: 'Nu am putut încărca numărul de concursuri.',
  newUsers7d: 'Nu am putut încărca utilizatorii noi (7 zile).',
  activeInviteCodes: 'Nu am putut încărca codurile invitație.',
}

export type AdminUser = Pick<
  Tables<'profiles'>,
  'id' | 'name' | 'email' | 'role' | 'enabled' | 'created_at'
>

function okCell(value: number, capped = false): AdminStatCell {
  return { value, error: null, capped }
}

function errCell(key: AdminStatKey): AdminStatCell {
  return { value: null, error: STAT_LOAD_ERROR[key] }
}

export function formatAdminCount(value: number, capped = false): string {
  const text = value.toLocaleString('ro-RO')
  return capped ? `${text}+` : text
}

async function countRows(table: CountableTable): Promise<number> {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

async function countOrError(table: CountableTable, key: AdminStatKey): Promise<AdminStatCell> {
  try {
    return okCell(await countRows(table))
  } catch {
    return errCell(key)
  }
}

export type InviteCodeStatus = 'active' | 'used' | 'expired'

export function inviteCodeStatus(
  code: { current_uses: number; max_uses: number; expires_at: string | null },
  now = Date.now(),
): InviteCodeStatus {
  if (code.current_uses >= code.max_uses) return 'used'
  if (code.expires_at && new Date(code.expires_at).getTime() <= now) return 'expired'
  return 'active'
}

export function isActiveInviteCode(
  code: { current_uses: number; max_uses: number; expires_at: string | null },
  now = Date.now(),
): boolean {
  return inviteCodeStatus(code, now) === 'active'
}

export function countCreatedSince(rows: { created_at: string }[], sinceMs: number): number {
  return rows.filter((row) => new Date(row.created_at).getTime() >= sinceMs).length
}

function asFiniteCount(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function statsFromRpc(row: Record<string, unknown>): AdminStats | null {
  const mapped: Array<[AdminStatKey, unknown]> = [
    ['users', row.users],
    ['coaches', row.coaches],
    ['clubs', row.clubs],
    ['courses', row.courses],
    ['camps', row.camps],
    ['competitions', row.competitions],
    ['newUsers7d', row.new_users_7d],
    ['activeInviteCodes', row.active_invite_codes],
  ]
  const cells = {} as AdminStats
  for (const [key, raw] of mapped) {
    const value = asFiniteCount(raw)
    if (value === null) return null
    cells[key] = okCell(value)
  }
  return cells
}

async function tryAdminStatsRpc(): Promise<AdminStats | null> {
  const { data, error } = await supabase.rpc('admin_stats' as never)
  if (error) return null
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined
  if (!row || typeof row !== 'object') return null
  return statsFromRpc(row)
}

async function countNewUsers7d(now: number): Promise<AdminStatCell> {
  const sinceIso = new Date(now - NEW_USERS_WINDOW_MS).toISOString()
  const filtered = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sinceIso)
  if (!filtered.error) return okCell(filtered.count ?? 0)

  try {
    const rows = await getAllUsers()
    const since = now - NEW_USERS_WINDOW_MS
    const value = countCreatedSince(rows, since)
    const oldest = rows[rows.length - 1]
    const windowUnclosed =
      rows.length >= POSTGREST_MAX_ROWS &&
      oldest !== undefined &&
      new Date(oldest.created_at).getTime() >= since
    return okCell(value, windowUnclosed)
  } catch {
    return errCell('newUsers7d')
  }
}

async function countActiveInviteCodes(now: number): Promise<AdminStatCell> {
  const { data, error } = await supabase
    .from('coach_invitation_codes')
    .select('current_uses, max_uses, expires_at')
  if (error) return errCell('activeInviteCodes')
  const rows = data ?? []
  return okCell(
    rows.filter((code) => isActiveInviteCode(code, now)).length,
    rows.length >= POSTGREST_MAX_ROWS,
  )
}

function fromSettled(
  result: PromiseSettledResult<AdminStatCell>,
  key: AdminStatKey,
): AdminStatCell {
  return result.status === 'fulfilled' ? result.value : errCell(key)
}

export async function getAdminStats(now = Date.now()): Promise<AdminStats> {
  const fromRpc = await tryAdminStatsRpc()
  if (fromRpc) return fromRpc

  const [users, coaches, clubs, courses, camps, competitions, newUsers7d, activeInviteCodes] =
    await Promise.allSettled([
      countOrError('profiles', 'users'),
      countOrError('coach_profiles', 'coaches'),
      countOrError('clubs', 'clubs'),
      countOrError('courses', 'courses'),
      countOrError('camps', 'camps'),
      countOrError('competitions', 'competitions'),
      countNewUsers7d(now),
      countActiveInviteCodes(now),
    ])
  return {
    users: fromSettled(users, 'users'),
    coaches: fromSettled(coaches, 'coaches'),
    clubs: fromSettled(clubs, 'clubs'),
    courses: fromSettled(courses, 'courses'),
    camps: fromSettled(camps, 'camps'),
    competitions: fromSettled(competitions, 'competitions'),
    newUsers7d: fromSettled(newUsers7d, 'newUsers7d'),
    activeInviteCodes: fromSettled(activeInviteCodes, 'activeInviteCodes'),
  }
}

export async function getAllUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_users')
  if (error) throw error
  return (data as AdminUser[] | null) ?? []
}

export async function setUserEnabled(id: string, enabled: boolean) {
  const { error } = await supabase
    .from('profiles')
    .update({ enabled })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
}

export {
  createSport,
  updateSport,
  setSportDefaultPhoto,
  clearSportDefaultPhoto,
  deleteSport,
} from './sports/admin-sports'

export type InviteCode = Tables<'coach_invitation_codes'>

export async function getCoachInviteCodes(): Promise<InviteCode[]> {
  const { data, error } = await supabase
    .from('coach_invitation_codes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `COACH-${s}`
}

export async function generateCoachInviteCode(
  maxUses = 1,
  expiresAt: string | null = null,
): Promise<string> {
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 2147483647) {
    throw new Error('Numărul maxim de utilizări trebuie să fie un întreg între 1 și 2147483647.')
  }
  if (
    expiresAt !== null &&
    (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())
  ) {
    throw new Error('Expirarea trebuie să fie în viitor.')
  }
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const code = randomCode()
  const { error } = await supabase.from('coach_invitation_codes').insert({
    code,
    created_by_admin_id: session.user.id,
    max_uses: maxUses,
    current_uses: 0,
    expires_at: expiresAt,
  })
  if (error) throw error
  return code
}

export async function deleteInviteCode(id: string) {
  const { error } = await supabase
    .from('coach_invitation_codes')
    .delete()
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
}

export interface CreatedCoach {
  userId: string
  email: string
  tempPassword: string
  clubId: string | null
}

export async function createCoachAccount(input: {
  name: string
  email: string
  phone?: string
  clubId?: string
}): Promise<CreatedCoach> {
  const { data, error } = await supabase.functions.invoke('create-managed-coach', { body: input })
  if (error) {
    let msg = 'Nu am putut crea antrenorul.'
    const ctx = (error as { context?: Response })?.context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const b = await ctx.json()
        if (b?.error) msg = b.error as string
      } catch {
        msg = 'Nu am putut crea antrenorul.'
      }
    }
    throw new Error(msg)
  }
  if (
    !data ||
    typeof data.userId !== 'string' ||
    !data.userId ||
    typeof data.email !== 'string' ||
    !data.email ||
    typeof data.tempPassword !== 'string' ||
    !data.tempPassword
  ) {
    throw new Error('Răspunsul nu confirmă un cont de antrenor finalizat.')
  }
  const clubId = typeof data.clubId === 'string' ? data.clubId : null
  if (clubId !== (input.clubId ?? null)) {
    throw new Error('Răspunsul nu confirmă clubul ales pentru antrenor.')
  }
  return { userId: data.userId, email: data.email, tempPassword: data.tempPassword, clubId }
}

export type AdminClub = Pick<Tables<'clubs'>, 'id' | 'name' | 'city' | 'email'>

export async function getAllClubs(): Promise<AdminClub[]> {
  const { data, error } = await supabase.from('clubs').select('id, name, city, email').order('name')
  if (error) throw error
  return data ?? []
}

export type AdminCourse = Tables<'courses'> & {
  sport: Pick<Tables<'sports'>, 'name'> | null
  coach: Pick<Tables<'profiles'>, 'name'> | null

  location: Pick<Tables<'locations'>, 'name'> | null

  club: Pick<Tables<'clubs'>, 'name'> | null
}

export async function getAllCourses(): Promise<AdminCourse[]> {
  const { data, error } = await supabase
    .from('courses')
    .select(
      '*, sport:sports(name), coach:profiles(name), location:locations(name), club:clubs(name)',
    )
    .order('name')

    .order('price')
    .order('id')
  if (error) throw error
  return (data ?? []) as unknown as AdminCourse[]
}

export async function setCourseActiveAdmin(id: string, active: boolean) {
  const { error } = await supabase.from('courses').update({ active }).eq('id', id).select().single()
  if (error) throw error
}
