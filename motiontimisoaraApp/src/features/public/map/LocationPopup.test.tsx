import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'

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
