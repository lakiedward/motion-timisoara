import type { AdminUser } from '@/api/admin'
import { asRole, countUsers, filterUsers, groupByRole, statusCounts } from './user-overview'

const u = (id: string, role: string, enabled = true, name = `User ${id}`): AdminUser =>
  ({
    id,
    name,
    email: `${id}@x.ro`,
    role,
    enabled,
    created_at: '2026-10-01T00:00:00Z',
  }) as AdminUser

const users = [
  u('1', 'PARENT'),
  u('2', 'PARENT', false, 'Audit Părinte'),
  u('3', 'COACH'),
  u('4', 'ADMIN'),
]

test('asRole acceptă doar rolurile cunoscute, indiferent de majuscule', () => {
  expect(asRole('coach')).toBe('COACH')
  expect(asRole('nimic')).toBeNull()
  expect(asRole(null)).toBeNull()
})

test('countUsers folosește „de” de la 20 în sus', () => {
  expect(countUsers(1)).toBe('1 utilizator')
  expect(countUsers(19)).toBe('19 utilizatori')
  expect(countUsers(48)).toBe('48 de utilizatori')
  expect(countUsers(101)).toBe('101 utilizatori')
})

test('filterUsers combină statusul și căutarea peste diacritice', () => {
  const ids = (status: 'all' | 'active' | 'disabled', query: string) =>
    filterUsers(users, { status, query }).map((x) => x.id)
  expect(ids('disabled', '')).toEqual(['2'])
  expect(ids('all', 'parinte')).toEqual(['2'])
  expect(ids('active', 'user')).toEqual(['1', '3', '4'])
})

test('statusCounts numără toți, activii și dezactivații', () => {
  expect(statusCounts(users)).toEqual({ all: 4, active: 3, disabled: 1 })
})

test('groupByRole păstrează ordinea rolurilor și numără conturile active', () => {
  expect(groupByRole(users).map((g) => [g.role, g.users.length, g.activeCount])).toEqual([
    ['PARENT', 2, 1],
    ['COACH', 1, 1],
    ['ADMIN', 1, 1],
  ])
})
