import { getHomeTestimonials, shortName, toTestimonials } from './home'

const selecturi: Record<string, string> = {}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => {
      const interogare = {
        select: (coloane: string) => {
          selecturi[tabela] = coloane
          return interogare
        },
        not: () => interogare,
        order: () => interogare,
        limit: async () => ({
          data: [
            {
              id: `${tabela}-1`,
              comment: `Comentariu ${tabela}`,
              created_at: tabela === 'coach_ratings' ? '2026-10-02' : '2026-10-01',
              parent: { name: 'Ana Pop' },
            },
          ],
          error: null,
        }),
      }
      return interogare
    },
  },
}))

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

test('evaluările aleg explicit legătura cu părintele, nu pe cea cu antrenorul (bug #639)', async () => {
  const rezultat = await getHomeTestimonials()
  expect(selecturi.course_ratings).toContain('parent:profiles!course_ratings_parent_id_fkey(name)')
  expect(selecturi.coach_ratings).toContain('parent:profiles!coach_ratings_parent_id_fkey(name)')
  expect(rezultat.map((t) => t.id)).toEqual(['coach_ratings-1', 'course_ratings-1'])
})
