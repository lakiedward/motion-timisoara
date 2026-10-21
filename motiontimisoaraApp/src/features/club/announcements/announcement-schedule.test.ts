import {
  EMPTY_SCHEDULE,
  scheduleFromFields,
  scheduleIssues,
  scheduleState,
  scheduleToFields,
} from './announcement-schedule'

const now = new Date('2026-10-21T10:00:00Z')

test('câmpurile goale lasă anunțul imediat și fără expirare', () => {
  expect(scheduleFromFields(EMPTY_SCHEDULE)).toEqual({ publish_at: null, expires_at: null })
  expect(scheduleIssues(EMPTY_SCHEDULE, { now })).toEqual([])
})

test('ora din formular e ora Bucureștiului, inclusiv după schimbarea orei', () => {
  const vara = scheduleFromFields({
    ...EMPTY_SCHEDULE,
    publishDate: '2026-10-24',
    publishTime: '09:00',
  })
  expect(vara.publish_at).toBe('2026-10-24T06:00:00.000Z')
  const iarna = scheduleFromFields({
    ...EMPTY_SCHEDULE,
    expiresDate: '2026-11-02',
    expiresTime: '09:00',
  })
  expect(iarna.expires_at).toBe('2026-11-02T07:00:00.000Z')
})

test('datele salvate revin în formular pe ora Bucureștiului', () => {
  expect(
    scheduleToFields({ publish_at: '2026-10-24T06:00:00Z', expires_at: '2026-11-02T07:00:00Z' }),
  ).toEqual({
    publishDate: '2026-10-24',
    publishTime: '09:00',
    expiresDate: '2026-11-02',
    expiresTime: '09:00',
  })
})

test('ziua fără oră și ora fără zi cer completarea perechii', () => {
  const issues = scheduleIssues(
    { publishDate: '2026-10-24', publishTime: '', expiresDate: '', expiresTime: '10:00' },
    { now },
  )
  expect(issues).toEqual([
    { field: 'publishTime', message: 'Alege și ora publicării' },
    { field: 'expiresDate', message: 'Alege și ziua expirării' },
  ])
})

test('expirarea trebuie să fie după publicare', () => {
  expect(
    scheduleIssues(
      {
        publishDate: '2026-10-24',
        publishTime: '09:00',
        expiresDate: '2026-10-24',
        expiresTime: '09:00',
      },
      { now },
    ),
  ).toEqual([{ field: 'expiresDate', message: 'Expirarea trebuie să fie după publicare' }])
})

test('o expirare nouă din trecut e refuzată, una păstrată la editare nu', () => {
  const trecut = { ...EMPTY_SCHEDULE, expiresDate: '2026-10-19', expiresTime: '12:00' }
  expect(scheduleIssues(trecut, { now })).toEqual([
    { field: 'expiresDate', message: 'Alege un moment din viitor' },
  ])
  expect(scheduleIssues(trecut, { now, initial: trecut })).toEqual([])
})

test('starea anunțului: programat, vizibil sau expirat', () => {
  expect(scheduleState({ publish_at: '2026-10-24T06:00:00Z', expires_at: null }, now)).toBe(
    'scheduled',
  )
  expect(scheduleState({ publish_at: '2026-10-20T06:00:00Z', expires_at: null }, now)).toBe('live')
  expect(scheduleState({ publish_at: null, expires_at: '2026-10-21T10:00:00Z' }, now)).toBe(
    'expired',
  )
  expect(scheduleState({ publish_at: null, expires_at: null }, now)).toBe('live')
})
