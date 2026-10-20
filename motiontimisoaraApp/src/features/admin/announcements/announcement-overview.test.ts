import type { AdminAnnouncement } from '@/api/announcements/admin-announcements'
import {
  announcementStatusCounts,
  filterAnnouncements,
  groupAnnouncementsByMonth,
  groupAnnouncementsByOrganizer,
  sourceCounts,
} from './announcement-overview'

const base: AdminAnnouncement = {
  id: 'a',
  source: 'club',
  title: 'Program',
  content: 'Text',
  createdAt: '2026-10-01T10:00:00Z',
  visible: true,
  pinned: false,
  priority: 'NORMAL',
  organizerKey: 'club:c1',
  organizerKind: 'club',
  organizerName: 'Zebra Club',
  audience: 'Curs: Înot',
  coachName: null,
  mediaCount: 0,
}
const items: AdminAnnouncement[] = [
  base,
  { ...base, id: 'b', visible: false, createdAt: '2026-09-02T10:00:00Z' },
  {
    ...base,
    id: 'c',
    source: 'coach',
    pinned: true,
    title: null,
    organizerKey: 'coach:u1',
    organizerKind: 'coach',
    organizerName: 'Ana',
    createdAt: '2026-08-01T10:00:00Z',
  },
  { ...base, id: 'd', organizerKey: 'club:c2', organizerName: 'Alfa Club', content: 'Ședință' },
]

test('counts statuses and sources', () => {
  expect(announcementStatusCounts(items)).toEqual({ visible: 3, hidden: 1, pinned: 1, all: 4 })
  expect(sourceCounts(items)).toEqual([
    { id: 'club', name: 'Club', count: 3 },
    { id: 'coach', name: 'Antrenor', count: 1 },
  ])
})

test('filters by status, source and diacritic-free query', () => {
  const ids = (f: Parameters<typeof filterAnnouncements>[1]) =>
    filterAnnouncements(items, f).map((a) => a.id)
  expect(ids({ status: 'hidden', source: '', query: '' })).toEqual(['b'])
  expect(ids({ status: 'all', source: 'coach', query: '' })).toEqual(['c'])
  expect(ids({ status: 'all', source: '', query: 'sedinta' })).toEqual(['d'])
})

test('groups clubs before coaches by name and keeps totals from all items', () => {
  const groups = groupAnnouncementsByOrganizer(
    items,
    items.filter((a) => a.visible),
  )
  expect(groups.map((g) => [g.name, g.visibleCount, g.totalCount])).toEqual([
    ['Alfa Club', 1, 1],
    ['Zebra Club', 1, 2],
    ['Ana', 1, 1],
  ])
})

test('groups by month newest first', () => {
  expect(groupAnnouncementsByMonth(items).map((g) => g.title)).toEqual([
    'Octombrie 2026',
    'Septembrie 2026',
    'August 2026',
  ])
})
