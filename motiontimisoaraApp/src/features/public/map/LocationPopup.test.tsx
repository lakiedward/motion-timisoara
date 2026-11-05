import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'

import type { TabaraDinLista } from '@/api/camps'
import type { ActivityListItem, CourseListItem } from '@/api/public'
import type { Loc } from '@/lib/locuri'
import LocationPopup from './LocationPopup'

const LOC = { nume: 'Bazin Olimpia', address: 'Str. Test 1', city: 'Timișoara', cluburi: 1 } as Loc

const course = (id: string, code: string | null) =>
  ({
    id,
    name: `Curs ${id}`,
    age_from: 6,
    age_to: 10,
    sport: code ? { code, name: code } : null,
  }) as unknown as CourseListItem

test('rândurile din popup au iconița sportului, fără emoji', () => {
  const { container } = render(
    <MemoryRouter>
      <LocationPopup
        location={LOC}
        courses={[course('a', 'inot'), course('b', 'padel'), course('c', null)]}
        activities={[] as ActivityListItem[]}
        camps={[]}
      />
    </MemoryRouter>,
  )
  for (const name of ['Curs a', 'Curs b', 'Curs c']) {
    const row = screen.getByRole('link', { name: new RegExp(name) })
    expect(row.querySelector('svg')).not.toBeNull()
  }
  expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
})

test('activitatea și tabăra folosesc aceleași date ca listele, cu interval orar', () => {
  render(
    <MemoryRouter>
      <LocationPopup
        location={LOC}
        courses={[]}
        activities={
          [
            {
              id: 'x',
              name: 'Tură',
              activity_date: '2026-11-29',
              start_time: '09:30:00',
              end_time: '11:00:00',
              sport: null,
            },
          ] as unknown as ActivityListItem[]
        }
        camps={
          [
            {
              id: 'c',
              slug: 'vara',
              title: 'Tabără',
              period_start: '2026-12-14',
              period_end: '2026-12-20',
            },
          ] as unknown as TabaraDinLista[]
        }
      />
    </MemoryRouter>,
  )
  expect(screen.getByText('29.11.2026 · 09:30–11:00')).toBeInTheDocument()
  expect(screen.getByText('14.12.2026 – 20.12.2026')).toBeInTheDocument()
})
