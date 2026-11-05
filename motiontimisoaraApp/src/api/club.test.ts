import { beforeEach, expect, test, vi } from 'vitest'

import {
  createClubActivity,
  createClubCourse,
  createClubLocation,
  createManagedCoach,
  deleteClubCode,
  generateClubCode,
  getClubAudiences,
  getClubCoaches,
  getClubLocations,
  getClubRosterForSelect,
  getMyClub,
  removeClubCoach,
  setClubCourseActive,
  updateClubCourse,
} from './club'
import { regenerateCourseOccurrences } from './course-occurrences'

type Raspuns = { data: unknown; error: unknown }
type Apel = { tabel: string; metoda: string; argumente: unknown[] }

let raspunsuri: Record<string, Raspuns> = {}
let apeluri: Apel[] = []
let rpcRaspuns: Raspuns = { data: null, error: null }
let rpcApeluri: { nume: string; argumente: unknown }[] = []
let sesiune: { user: { id: string } } | null = { user: { id: 'user-1' } }
let invokeRaspuns: Raspuns = { data: null, error: null }
let invokeApeluri: { nume: string; optiuni: unknown }[] = []

function builder(tabel: string) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, metoda: string) {
      if (metoda === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspunsuri[tabel] ?? { data: [], error: null }))
      }
      return (...argumente: unknown[]) => {
        apeluri.push({ tabel, metoda, argumente })
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabel: string) => builder(tabel),
    rpc: (nume: string, argumente: unknown) => {
      rpcApeluri.push({ nume, argumente })
      return Promise.resolve(rpcRaspuns)
    },
    auth: { getSession: () => Promise.resolve({ data: { session: sesiune } }) },
    functions: {
      invoke: (nume: string, optiuni: unknown) => {
        invokeApeluri.push({ nume, optiuni })
        return Promise.resolve(invokeRaspuns)
      },
    },
  },
}))

vi.mock('@/api/course-occurrences', () => ({
  regenerateCourseOccurrences: vi.fn(),
}))

const regenerare = vi.mocked(regenerateCourseOccurrences)

const ok = (data: unknown): Raspuns => ({ data, error: null })

function apelPe(tabel: string, metoda: string) {
  return apeluri.filter((a) => a.tabel === tabel && a.metoda === metoda)
}

beforeEach(() => {
  raspunsuri = {}
  apeluri = []
  rpcRaspuns = { data: null, error: null }
  rpcApeluri = []
  sesiune = { user: { id: 'user-1' } }
  invokeRaspuns = { data: null, error: null }
  invokeApeluri = []
  regenerare.mockReset()
  regenerare.mockResolvedValue(undefined as never)
})

test('getMyClub întoarce primul club din rpc my_club', async () => {
  rpcRaspuns = ok([{ id: 'club-1' }, { id: 'club-2' }])
  expect(await getMyClub()).toEqual({ id: 'club-1' })
  expect(rpcApeluri[0].nume).toBe('my_club')
})

test('getMyClub întoarce null când utilizatorul nu are club sau rpc-ul dă null', async () => {
  rpcRaspuns = ok([])
  expect(await getMyClub()).toBeNull()
  rpcRaspuns = ok(null)
  expect(await getMyClub()).toBeNull()
})

test('getMyClub propagă eroarea rpc-ului', async () => {
  rpcRaspuns = { data: null, error: new Error('rpc') }
  await expect(getMyClub()).rejects.toThrow('rpc')
})

test('getClubCoaches înlocuiește numele și emailul lipsă', async () => {
  rpcRaspuns = ok([
    { coach_profile_id: 'a', name: 'Ana', email: 'ana@test.ro', photo_storage_path: 'a.jpg' },
    { coach_profile_id: 'b', name: null, email: null, photo_storage_path: null },
  ])
  expect(await getClubCoaches('club-1')).toEqual([
    { coach_profile_id: 'a', name: 'Ana', email: 'ana@test.ro', photo_storage_path: 'a.jpg' },
    { coach_profile_id: 'b', name: '—', email: '', photo_storage_path: null },
  ])
  expect(rpcApeluri[0]).toEqual({ nume: 'club_coach_contacts', argumente: { p_club_id: 'club-1' } })
})

test('getClubCoaches întoarce listă goală când rpc-ul nu dă date', async () => {
  rpcRaspuns = ok(null)
  expect(await getClubCoaches('club-1')).toEqual([])
})

test('createManagedCoach trimite datele către funcția edge și întoarce parola temporară', async () => {
  const rezultat = { userId: 'u', email: 'a@test.ro', tempPassword: 'tmp' }
  invokeRaspuns = ok(rezultat)
  const intrare = { email: 'a@test.ro', name: 'Ana', sportIds: ['s1'] }
  expect(await createManagedCoach(intrare)).toEqual(rezultat)
  expect(invokeApeluri[0]).toEqual({ nume: 'create-managed-coach', optiuni: { body: intrare } })
})

test('createManagedCoach folosește mesajul din corpul răspunsului de eroare', async () => {
  invokeRaspuns = {
    data: null,
    error: { context: { json: () => Promise.resolve({ error: 'Email deja folosit.' }) } },
  }
  await expect(createManagedCoach({ email: 'a@test.ro', name: 'Ana' })).rejects.toThrow(
    'Email deja folosit.',
  )
})

test('createManagedCoach cade pe mesajul implicit când corpul erorii nu are text', async () => {
  invokeRaspuns = {
    data: null,
    error: { context: { json: () => Promise.resolve({}) } },
  }
  await expect(createManagedCoach({ email: 'a@test.ro', name: 'Ana' })).rejects.toThrow(
    'Nu am putut crea antrenorul.',
  )
})

test('createManagedCoach cade pe mesajul implicit când corpul erorii nu se poate citi', async () => {
  invokeRaspuns = {
    data: null,
    error: { context: { json: () => Promise.reject(new Error('json')) } },
  }
  await expect(createManagedCoach({ email: 'a@test.ro', name: 'Ana' })).rejects.toThrow(
    'Nu am putut crea antrenorul.',
  )
})

test('createManagedCoach cade pe mesajul implicit când eroarea nu are context', async () => {
  invokeRaspuns = { data: null, error: new Error('rețea') }
  await expect(createManagedCoach({ email: 'a@test.ro', name: 'Ana' })).rejects.toThrow(
    'Nu am putut crea antrenorul.',
  )
})

test('removeClubCoach șterge doar legătura dintre club și antrenor', async () => {
  await removeClubCoach('club-1', 'coach-1')
  expect(apelPe('club_coaches', 'delete')).toHaveLength(1)
  expect(apelPe('club_coaches', 'eq').map((a) => a.argumente)).toEqual([
    ['club_id', 'club-1'],
    ['coach_profile_id', 'coach-1'],
  ])
})

test('removeClubCoach propagă eroarea când nu s-a șters nimic', async () => {
  raspunsuri.club_coaches = { data: null, error: new Error('0 rânduri') }
  await expect(removeClubCoach('club-1', 'coach-1')).rejects.toThrow('0 rânduri')
})

test('generateClubCode respinge un număr de utilizări invalid fără să atingă baza', async () => {
  for (const invalid of [0, -1, 1.5, 2147483648, Number.NaN]) {
    await expect(generateClubCode('club-1', invalid)).rejects.toThrow(/între 1 și 2147483647/)
  }
  expect(apeluri).toEqual([])
})

test('generateClubCode cere o sesiune activă', async () => {
  sesiune = null
  await expect(generateClubCode('club-1')).rejects.toThrow('Not authenticated')
  expect(apeluri).toEqual([])
})

test('generateClubCode salvează un cod de forma XXXX-XXXX fără caractere ambigue', async () => {
  const cod = await generateClubCode('club-1', 5, '2026-12-31T00:00:00Z')
  expect(cod).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{4}$/)
  expect(apelPe('club_invitation_codes', 'insert')[0].argumente[0]).toEqual({
    club_id: 'club-1',
    code: cod,
    created_by_user_id: 'user-1',
    max_uses: 5,
    current_uses: 0,
    expires_at: '2026-12-31T00:00:00Z',
  })
})

test('generateClubCode are implicit o singură utilizare și fără expirare', async () => {
  await generateClubCode('club-1')
  expect(apelPe('club_invitation_codes', 'insert')[0].argumente[0]).toMatchObject({
    max_uses: 1,
    expires_at: null,
  })
})

test('generateClubCode propagă eroarea de la insert', async () => {
  raspunsuri.club_invitation_codes = { data: null, error: new Error('duplicat') }
  await expect(generateClubCode('club-1')).rejects.toThrow('duplicat')
})

test('deleteClubCode șterge după id și propagă eroarea', async () => {
  await deleteClubCode('cod-1')
  expect(apelPe('club_invitation_codes', 'eq')[0].argumente).toEqual(['id', 'cod-1'])
  raspunsuri.club_invitation_codes = { data: null, error: new Error('refuzat') }
  await expect(deleteClubCode('cod-1')).rejects.toThrow('refuzat')
})

test('getClubAudiences unește cursurile, activitățile și taberele clubului', async () => {
  raspunsuri.courses = ok([{ id: 'c', name: 'Înot', active: true }])
  raspunsuri.activities = ok([{ id: 'a', name: 'Aquathlon', active: false }])
  raspunsuri.camps = ok([{ id: 'k', title: 'Vara', period_end: '2026-12-01' }])
  expect(await getClubAudiences('club-1', new Date('2026-11-05T10:00:00'))).toEqual([
    { kind: 'COURSE', id: 'c', name: 'Înot', active: true },
    { kind: 'ACTIVITY', id: 'a', name: 'Aquathlon', active: false },
    { kind: 'CAMP', id: 'k', name: 'Vara', active: true },
  ])
})

test('getClubAudiences marchează tabăra încheiată ca inactivă', async () => {
  raspunsuri.camps = ok([
    { id: 'trecuta', title: 'Veche', period_end: '2026-11-04' },
    { id: 'azi', title: 'Se termină azi', period_end: '2026-11-05' },
  ])
  const rezultat = await getClubAudiences('club-1', new Date('2026-11-05T10:00:00'))
  expect(rezultat.map((r) => [r.id, r.active])).toEqual([
    ['trecuta', false],
    ['azi', true],
  ])
})

test('getClubAudiences filtrează toate cele trei liste după club', async () => {
  await getClubAudiences('club-1')
  for (const tabel of ['courses', 'activities', 'camps']) {
    expect(apelPe(tabel, 'eq')[0].argumente).toEqual(['club_id', 'club-1'])
  }
})

test('getClubAudiences propagă eroarea oricărei interogări', async () => {
  for (const tabel of ['courses', 'activities', 'camps']) {
    raspunsuri = { [tabel]: { data: null, error: new Error(`eroare ${tabel}`) } }
    await expect(getClubAudiences('club-1')).rejects.toThrow(`eroare ${tabel}`)
  }
})

test('getClubLocations mută numărul de cursuri din relația agregată', async () => {
  raspunsuri.locations = ok([
    { id: 'l1', name: 'Bazin', courses: [{ count: 3 }] },
    { id: 'l2', name: 'Sală', courses: [] },
    { id: 'l3', name: 'Stadion' },
  ])
  expect(await getClubLocations('club-1')).toEqual([
    { id: 'l1', name: 'Bazin', courseCount: 3 },
    { id: 'l2', name: 'Sală', courseCount: 0 },
    { id: 'l3', name: 'Stadion', courseCount: 0 },
  ])
})

test('getClubRosterForSelect sare peste profilurile lipsă și completează numele', async () => {
  raspunsuri.club_coaches = ok([
    { coach_profile: { user_id: 'u1', profile: { name: 'Ana' } } },
    { coach_profile: { user_id: 'u2', profile: null } },
    { coach_profile: null },
  ])
  expect(await getClubRosterForSelect('club-1')).toEqual([
    { user_id: 'u1', name: 'Ana' },
    { user_id: 'u2', name: '—' },
  ])
})

test('createClubLocation adaugă clubul, autorul și starea activă', async () => {
  const intrare = { name: 'Sala', county: 'Timiș' } as unknown as Parameters<typeof createClubLocation>[1]
  await createClubLocation('club-1', intrare)
  expect(apelPe('locations', 'insert')[0].argumente[0]).toEqual({
    name: 'Sala',
    county: 'Timiș',
    club_id: 'club-1',
    created_by_user_id: 'user-1',
    is_active: true,
  })
})

test('createClubLocation cere o sesiune activă', async () => {
  sesiune = null
  const intrare = { name: 'Sala' } as unknown as Parameters<typeof createClubLocation>[1]
  await expect(createClubLocation('club-1', intrare)).rejects.toThrow('Not authenticated')
  expect(apelPe('locations', 'insert')).toEqual([])
})

const intrareCurs = {
  currency: 'RON',
  eur_ron_rate_micros: null,
  name: 'Înot',
  sport_id: 's',
  location_id: 'l',
  coach_id: 'c',
  level: null,
  age_from: 6,
  age_to: 12,
  capacity: 10,
  price_per_session: 5000,
  description: null,
  recurrence_rule: 'FREQ=WEEKLY',
} as const

test('createClubCourse de club setează destinatarul plății CLUB și generează ședințele', async () => {
  raspunsuri.courses = ok({ id: 'curs-1' })
  const curs = await createClubCourse('club-1', intrareCurs)
  expect(curs).toEqual({ id: 'curs-1' })
  expect(apelPe('courses', 'insert')[0].argumente[0]).toMatchObject({
    club_id: 'club-1',
    payment_recipient: 'CLUB',
    price: 5000,
    price_per_session: 5000,
    active: true,
  })
  expect(regenerare).toHaveBeenCalledWith('curs-1', 'FREQ=WEEKLY')
})

test('createClubCourse fără club setează destinatarul plății COACH', async () => {
  raspunsuri.courses = ok({ id: 'curs-1' })
  await createClubCourse(null, intrareCurs)
  expect(apelPe('courses', 'insert')[0].argumente[0]).toMatchObject({
    club_id: null,
    payment_recipient: 'COACH',
  })
})

test('createClubCourse șterge cursul nou dacă generarea ședințelor eșuează', async () => {
  raspunsuri.courses = ok({ id: 'curs-1' })
  regenerare.mockRejectedValue(new Error('regulă invalidă'))
  await expect(createClubCourse('club-1', intrareCurs)).rejects.toThrow('regulă invalidă')
  expect(apelPe('courses', 'delete')).toHaveLength(1)
  expect(apelPe('courses', 'eq').at(-1)?.argumente).toEqual(['id', 'curs-1'])
})

test('createClubCourse nu generează ședințe când insert-ul eșuează', async () => {
  raspunsuri.courses = { data: null, error: new Error('insert') }
  await expect(createClubCourse('club-1', intrareCurs)).rejects.toThrow('insert')
  expect(regenerare).not.toHaveBeenCalled()
})

test('updateClubCourse sincronizează prețul și regenerează ședințele', async () => {
  raspunsuri.courses = ok({ id: 'curs-1' })
  await updateClubCourse('curs-1', intrareCurs)
  expect(apelPe('courses', 'update')[0].argumente[0]).toMatchObject({ price: 5000, name: 'Înot' })
  expect(regenerare).toHaveBeenCalledWith('curs-1', 'FREQ=WEEKLY')
})

test('updateClubCourse nu regenerează ședințele când actualizarea eșuează', async () => {
  raspunsuri.courses = { data: null, error: new Error('update') }
  await expect(updateClubCourse('curs-1', intrareCurs)).rejects.toThrow('update')
  expect(regenerare).not.toHaveBeenCalled()
})

test('setClubCourseActive trimite doar câmpul active', async () => {
  await setClubCourseActive('curs-1', false)
  expect(apelPe('courses', 'update')[0].argumente[0]).toEqual({ active: false })
  expect(apelPe('courses', 'eq')[0].argumente).toEqual(['id', 'curs-1'])
})

test('createClubActivity îi fixează clubul ca destinatar al plății și o activează', async () => {
  raspunsuri.activities = ok({ id: 'act-1' })
  const intrare = { name: 'Aquathlon', price: 3000 } as unknown as Parameters<
    typeof createClubActivity
  >[1]
  expect(await createClubActivity('club-1', intrare)).toEqual({ id: 'act-1' })
  expect(apelPe('activities', 'insert')[0].argumente[0]).toEqual({
    name: 'Aquathlon',
    price: 3000,
    club_id: 'club-1',
    payment_recipient: 'CLUB',
    active: true,
  })
})
