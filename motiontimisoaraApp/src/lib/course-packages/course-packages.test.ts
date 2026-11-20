import {
  cheapestPerSession,
  coursePackagesSchema,
  packageNote,
  packagesToForm,
  packagesToPayload,
  pricePerSession,
  sessionsLabel,
} from './course-packages'

test('the schema accepts up to four valid packages', () => {
  const four = [1, 2, 3, 4].map((n) => ({
    sessions: String(n * 4),
    price: `${n * 100}`,
    validity: 'NONE',
  }))
  expect(coursePackagesSchema.safeParse(four).success).toBe(true)
  expect(
    coursePackagesSchema.safeParse([...four, { sessions: '20', price: '500', validity: 'NONE' }])
      .success,
  ).toBe(false)
})

test('the schema refuses empty, zero, fractional and repeated values', () => {
  const issues = (value: unknown) =>
    coursePackagesSchema.safeParse(value).error?.issues.map((issue) => issue.message) ?? []
  expect(issues([{ sessions: '', price: '', validity: 'NONE' }])).toEqual([
    'Scrie numărul de ședințe',
    'Scrie prețul pachetului',
  ])
  expect(issues([{ sessions: '0', price: '0', validity: 'NONE' }])).toEqual([
    'Între 1 și 100 ședințe',
    'Introdu o sumă mai mare decât zero, cu cel mult două zecimale',
  ])
  expect(issues([{ sessions: '2.5', price: '10.555', validity: 'NONE' }])).toHaveLength(2)
  expect(issues([{ sessions: '101', price: '10', validity: 'NONE' }])).toEqual([
    'Între 1 și 100 ședințe',
  ])
  expect(issues([{ sessions: '10', price: '100000.01', validity: 'NONE' }])).toEqual([
    'Prețul unui pachet poate fi cel mult 100.000',
  ])
  expect(
    issues([
      { sessions: '8', price: '320', validity: 'NONE' },
      { sessions: '8', price: '300', validity: 'NONE' },
    ]),
  ).toEqual(['Ai deja un pachet de 8 ședințe'])
  expect(
    issues([
      { sessions: '8', price: '320', validity: 'NONE' },
      { sessions: '12', price: '450', validity: 'CALENDAR_MONTH' },
    ]),
  ).toEqual(['Pachetele unui curs au toate aceeași valabilitate.'])
  expect(
    issues([
      { sessions: '8', price: '320', validity: 'CALENDAR_MONTH' },
      { sessions: '8', price: '300', validity: 'CALENDAR_MONTH' },
    ]),
  ).toEqual(['Ai deja un pachet lunar de 8 ședințe'])
})

test('saved packages round-trip through the form in position order', () => {
  const saved = [
    { id: 'b', position: 1, sessions: 10, price: 45050, validity: 'NONE', validity_days: null },
    { id: 'a', position: 0, sessions: 5, price: 25000, validity: 'NONE', validity_days: null },
  ]
  const drafts = packagesToForm(saved)
  expect(drafts).toEqual([
    { packageId: 'a', sessions: '5', price: '250', validity: 'NONE' },
    { packageId: 'b', sessions: '10', price: '450.5', validity: 'NONE' },
  ])
  expect(
    packagesToPayload([
      ...drafts,
      { sessions: ' 20 ', price: '700,25', validity: 'CALENDAR_MONTH' },
    ]),
  ).toEqual([
    { id: 'a', sessions: 5, price: 25000, validity: 'NONE' },
    { id: 'b', sessions: 10, price: 45050, validity: 'NONE' },
    { sessions: 20, price: 70025, validity: 'CALENDAR_MONTH' },
  ])
  expect(packagesToForm(undefined)).toEqual([])
})

test('per-session price, cheapest package and Romanian session labels', () => {
  expect(pricePerSession({ sessions: 3, price: 10000 })).toBe(3333)
  expect(
    cheapestPerSession([
      { sessions: 5, price: 25000 },
      { sessions: 10, price: 40000 },
    ]),
  ).toBe(4000)
  expect(sessionsLabel(1)).toBe('1 ședință')
  expect(sessionsLabel(8)).toBe('8 ședințe')
  expect(sessionsLabel(20)).toBe('20 de ședințe')
})

test('package notes say whether the package expires', () => {
  expect(packageNote({ sessions: 8, price: 32000, validity: 'NONE' }, 'RON')).toContain(
    'fără expirare',
  )
  expect(packageNote({ sessions: 8, price: 32000, validity: 'CALENDAR_MONTH' }, 'RON')).toContain(
    'expiră la sfârșitul lunii',
  )
})

test('packages that expire after N days need the same N between 7 and 365', () => {
  const issues = (value: unknown) =>
    coursePackagesSchema.safeParse(value).error?.issues.map((issue) => issue.message) ?? []
  const pkg = (validityDays?: string, sessions = '8') => ({
    sessions,
    price: '320',
    validity: 'DAYS',
    ...(validityDays === undefined ? {} : { validityDays }),
  })
  expect(issues([pkg('45'), pkg('45', '12')])).toEqual([])
  expect(issues([pkg()])).toEqual(['Scrie un număr de zile între 7 și 365'])
  expect(issues([pkg('6')])).toEqual(['Scrie un număr de zile între 7 și 365'])
  expect(issues([pkg('366')])).toEqual(['Scrie un număr de zile între 7 și 365'])
  expect(issues([pkg('4.5')])).toEqual(['Scrie un număr de zile între 7 și 365'])
  expect(issues([pkg('45'), pkg('30', '12')])).toEqual([
    'Pachetele unui curs expiră toate după același număr de zile.',
  ])
  expect(issues([pkg('45'), { sessions: '12', price: '450', validity: 'NONE' }])).toEqual([
    'Pachetele unui curs au toate aceeași valabilitate.',
  ])
})

test('the days round-trip through the form and reach the payload only for DAYS', () => {
  const drafts = packagesToForm([
    { id: 'a', position: 0, sessions: 8, price: 32000, validity: 'DAYS', validity_days: 45 },
  ])
  expect(drafts).toEqual([
    { packageId: 'a', sessions: '8', price: '320', validity: 'DAYS', validityDays: '45' },
  ])
  expect(packagesToPayload([...drafts, { sessions: '4', price: '180', validity: 'DAYS', validityDays: ' 45 ' }])).toEqual([
    { id: 'a', sessions: 8, price: 32000, validity: 'DAYS', validityDays: 45 },
    { sessions: 4, price: 18000, validity: 'DAYS', validityDays: 45 },
  ])
  expect(packagesToPayload([{ sessions: '4', price: '180', validity: 'NONE', validityDays: '45' }])).toEqual([
    { sessions: 4, price: 18000, validity: 'NONE' },
  ])
  expect(packageNote({ sessions: 8, price: 32000, validity: 'DAYS', validity_days: 45 }, 'RON')).toContain(
    'valabil 45 de zile de la plată',
  )
  expect(packageNote({ sessions: 8, price: 32000, validity: 'DAYS', validity_days: 7 }, 'RON')).toContain(
    'valabil 7 zile de la plată',
  )
})
