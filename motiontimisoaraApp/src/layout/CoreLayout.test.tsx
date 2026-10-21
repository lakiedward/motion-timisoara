import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

import CoreLayout from './CoreLayout'
import { isFabAccountVisible } from './fab-account'

const auth = vi.hoisted(() => ({ user: null as null | { name: string; email: string; role: string } }))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: auth.user, loading: false, profileError: null, refresh: vi.fn() }),
}))

vi.mock('@/api/auth', () => ({ signOut: vi.fn() }))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<CoreLayout />}>
          <Route path="*" element={<p>conținut</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

test('account shortcut is hidden on the account area and for visitors', () => {
  expect(isFabAccountVisible(true, '/')).toBe(true)
  expect(isFabAccountVisible(true, '/cursuri/12')).toBe(true)
  expect(isFabAccountVisible(true, '/accounting')).toBe(true)
  expect(isFabAccountVisible(true, '/account')).toBe(false)
  expect(isFabAccountVisible(true, '/account/children')).toBe(false)
  expect(isFabAccountVisible(false, '/')).toBe(false)
})

test('signed-in user gets a 48px account shortcut and bottom room for the last content', () => {
  auth.user = { name: 'Spec Parent', email: 'p@example.com', role: 'PARENT' }
  const { container } = renderAt('/despre')
  const fab = screen.getByRole('link', { name: 'Contul meu' })
  expect(fab).toHaveAttribute('href', '/account')
  expect(fab).toHaveClass('size-12', 'rounded-full', 'bg-primary', 'lg:hidden', 'focus-visible:outline-2')
  expect(fab).not.toHaveClass('size-touch-target')
  expect(container.firstElementChild).toHaveClass('pb-20', 'lg:pb-0')
})

test('no shortcut and no extra room on account pages or for visitors', () => {
  auth.user = { name: 'Spec Parent', email: 'p@example.com', role: 'PARENT' }
  const { container, unmount } = renderAt('/account/children')
  expect(screen.queryByRole('link', { name: 'Contul meu' })).toBeNull()
  expect(container.firstElementChild).not.toHaveClass('pb-20')
  unmount()
  auth.user = null
  renderAt('/')
  expect(screen.queryByRole('link', { name: 'Contul meu' })).toBeNull()
})
