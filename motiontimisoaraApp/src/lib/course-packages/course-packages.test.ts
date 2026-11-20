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
      { sessions: '8', price: '300', validity: 'CALENDAR_MONTH' },
    ]),
  ).toEqual([])
  expect(
    issues([
      { sessions: '8', price: '320', validity: 'CALENDAR_MONTH' },
      { sessions: '8', price: '300', validity: 'CALENDAR_MONTH' },
    ]),
  ).toEqual(['Ai deja un pachet lunar de 8 ședințe'])
})

test('saved packages round-trip through the form in position order', () => {
  const saved = [
    { id: 'b', position: 1, sessions: 10, price: 45050, validity: 'NONE' },
    { id: 'a', position: 0, sessions: 5, price: 25000, validity: 'NONE' },
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
