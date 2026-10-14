import {
  EMPTY_COURSE_FILTERS,
  countActiveCourseFilters,
  courseLocationOptions,
  courseMatchesFilters,
  courseSlots,
  courseSportOptions,
  formatCourseSchedule,
  monthlyPriceInRonBani,
  type CatalogCourseFields,
} from './course-catalog'

const now = new Date('2026-10-14T08:00:00Z')

function course(overrides: Partial<CatalogCourseFields> = {}): CatalogCourseFields {
  return {
    recurrence_rule: null,
    occurrences: [],
    price: 48_000,
    currency: 'RON',
    eur_ron_rate_micros: null,
    sport: { code: 'inot', name: 'Înot' },
    location: { name: 'Bazin Olimpic Timișoara' },
    ...overrides,
  }
}

const weekly = JSON.stringify({
  daySchedules: { '1': { start: '17:00', end: '18:00' }, '3': { start: '17:00', end: '18:00' } },
})

test('the schedule comes from the weekly rule and groups days that share a start time', () => {
  expect(formatCourseSchedule(courseSlots(course({ recurrence_rule: weekly }), now))).toBe(
    'Lu, Mi · 17:00',
  )
  const mixed = JSON.stringify({
    daySchedules: { '5': { start: '18:00', end: '19:00' }, '1': { start: '15:00', end: '16:00' } },
  })
  expect(formatCourseSchedule(courseSlots(course({ recurrence_rule: mixed }), now))).toBe(
    'Lu · 15:00; Vi · 18:00',
  )
})

test('without a rule the schedule falls back to future sessions in Bucharest time', () => {
  const slots = courseSlots(
    course({
      occurrences: [
        { starts_at: '2026-10-01T14:00:00Z' },
        { starts_at: '2026-10-16T15:00:00Z' },
        { starts_at: '2026-10-23T15:00:00Z' },
      ],
    }),
    now,
  )
  expect(slots).toEqual([{ iso: 5, start: '18:00' }])
  expect(formatCourseSchedule(courseSlots(course(), now))).toBeNull()
})

test('EUR prices compare in lei through the organizer rate and are excluded without one', () => {
  expect(monthlyPriceInRonBani(course())).toBe(48_000)
  expect(
    monthlyPriceInRonBani(course({ currency: 'EUR', price: 6_000, eur_ron_rate_micros: 5_000_000 })),
  ).toBe(30_000)
  expect(monthlyPriceInRonBani(course({ currency: 'EUR', price: 6_000 }))).toBeNull()
})

test('sport, day, price and location filters combine', () => {
  const swimMonday = course({ recurrence_rule: weekly })
  const bike = course({
    sport: { code: 'ciclism', name: 'Ciclism' },
    location: { name: 'Stadion Atletism' },
    price: 60_000,
  })
  const filters = { ...EMPTY_COURSE_FILTERS }
  expect([swimMonday, bike].filter((c) => courseMatchesFilters(c, filters, now))).toHaveLength(2)
  expect(courseMatchesFilters(bike, { ...filters, sport: 'inot' }, now)).toBe(false)
  expect(courseMatchesFilters(swimMonday, { ...filters, day: '1' }, now)).toBe(true)
  expect(courseMatchesFilters(swimMonday, { ...filters, day: '2' }, now)).toBe(false)
  expect(courseMatchesFilters(bike, { ...filters, maxPrice: '40000' }, now)).toBe(false)
  expect(courseMatchesFilters(swimMonday, { ...filters, maxPrice: '60000' }, now)).toBe(true)
  expect(courseMatchesFilters(bike, { ...filters, location: 'Stadion Atletism' }, now)).toBe(true)
  const combined = { sport: 'inot', day: '3', maxPrice: '60000', location: 'Bazin Olimpic Timișoara' }
  expect(courseMatchesFilters(swimMonday, combined, now)).toBe(true)
  expect(courseMatchesFilters(bike, combined, now)).toBe(false)
  expect(countActiveCourseFilters(combined)).toBe(4)
})

test('filter options list each sport and venue once, sorted in Romanian', () => {
  const list = [
    course({ location: { name: ' Bazin Olimpic Timișoara ' } }),
    course({ sport: { code: 'alergare', name: 'Alergare' }, location: { name: 'Arena' } }),
    course(),
  ]
  expect(courseSportOptions(list).map((o) => o.label)).toEqual(['Alergare', 'Înot'])
  expect(courseLocationOptions(list).map((o) => o.value)).toEqual([
    'Arena',
    'Bazin Olimpic Timișoara',
  ])
})
