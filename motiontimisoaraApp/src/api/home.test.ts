import { shortName, toTestimonials } from './home'

test('numele apare ca prenume și inițiala ultimului nume', () => {
  expect(shortName('Andreea Maria Popescu')).toBe('Andreea P.')
  expect(shortName('Dan')).toBe('Dan')
  expect(shortName(null)).toBe('Părinte')
})

test('testimonialele păstrează doar comentariile reale, cele mai noi primele', () => {
  const rows = [
    { id: 'a', comment: '  ', created_at: '2026-10-03', parent: { name: 'X Y' } },
    { id: 'b', comment: 'Bun', created_at: '2026-10-01', parent: { name: 'Ana Pop' } },
    { id: 'c', comment: 'Foarte bun ', created_at: '2026-10-02', parent: null },
    { id: 'd', comment: null, created_at: '2026-10-04', parent: null },
  ]
  expect(toTestimonials(rows)).toEqual([
    { id: 'c', quote: 'Foarte bun', author: 'Părinte', createdAt: '2026-10-02' },
    { id: 'b', quote: 'Bun', author: 'Ana P.', createdAt: '2026-10-01' },
  ])
})
