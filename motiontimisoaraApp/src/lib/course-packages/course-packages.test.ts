import {
  cheapestPerSession,
  coursePackagesSchema,
  packagesToForm,
  packagesToPayload,
  pricePerSession,
  sessionsLabel,
} from './course-packages'

test('the schema accepts up to four valid packages', () => {
  const four = [1, 2, 3, 4].map((n) => ({ sessions: String(n * 4), price: `${n * 100}` }))
  expect(coursePackagesSchema.safeParse(four).success).toBe(true)
  expect(coursePackagesSchema.safeParse([...four, { sessions: '20', price: '500' }]).success).toBe(
    false,
  )
})

test('the schema refuses empty, zero, fractional and repeated values', () => {
  const issues = (value: unknown) =>
    coursePackagesSchema.safeParse(value).error?.issues.map((issue) => issue.message) ?? []
  expect(issues([{ sessions: '', price: '' }])).toEqual([
    'Scrie numărul de ședințe',
    'Scrie prețul pachetului',
  ])
  expect(issues([{ sessions: '0', price: '0' }])).toEqual([
    'Între 1 și 100 ședințe',
    'Introdu o sumă mai mare decât zero, cu cel mult două zecimale',
  ])
  expect(issues([{ sessions: '2.5', price: '10.555' }])).toHaveLength(2)
  expect(issues([{ sessions: '101', price: '10' }])).toEqual(['Între 1 și 100 ședințe'])
  expect(
    issues([
      { sessions: '8', price: '320' },
      { sessions: '8', price: '300' },
    ]),
  ).toEqual(['Ai deja un pachet de 8 ședințe'])
})

test('saved packages round-trip through the form in position order', () => {
  const saved = [
    { id: 'b', position: 1, sessions: 10, price: 45050, validity: 'NONE' },
    { id: 'a', position: 0, sessions: 5, price: 25000, validity: 'NONE' },
  ]
  const drafts = packagesToForm(saved)
  expect(drafts).toEqual([
    { packageId: 'a', sessions: '5', price: '250' },
    { packageId: 'b', sessions: '10', price: '450.5' },
  ])
  expect(packagesToPayload([...drafts, { sessions: ' 20 ', price: '700,25' }])).toEqual([
    { id: 'a', sessions: 5, price: 25000, validity: 'NONE' },
    { id: 'b', sessions: 10, price: 45050, validity: 'NONE' },
    { sessions: 20, price: 70025, validity: 'NONE' },
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
