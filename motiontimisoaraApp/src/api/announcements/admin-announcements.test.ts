import { audienceLabel, countMedia } from './admin-announcements'

test('labels audiences with their names or as unavailable', () => {
  const names = new Map([['COURSE:k1', 'Înot mic']])
  expect(audienceLabel('CLUB', null, names)).toBe('Toți părinții clubului')
  expect(audienceLabel('COURSE', 'k1', names)).toBe('Curs: Înot mic')
  expect(audienceLabel('CAMP', 'x', names)).toBe('Tabără indisponibilă')
})

test('counts attachments per announcement source', () => {
  const counts = countMedia([
    { club_announcement_id: 'a', announcement_id: null },
    { club_announcement_id: 'a', announcement_id: null },
    { club_announcement_id: null, announcement_id: 'b' },
  ])
  expect(counts.get('club:a')).toBe(2)
  expect(counts.get('coach:b')).toBe(1)
})
