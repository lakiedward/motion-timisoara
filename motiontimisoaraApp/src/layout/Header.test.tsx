import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { Header } from './Header'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: null, loading: false, profileError: null, refresh: vi.fn() }),
}))

vi.mock('@/api/auth', () => ({
  signOut: vi.fn(),
}))

test('mobile menu marks the current page and keeps 44px link targets', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/despre']}>
      <Header />
    </MemoryRouter>,
  )

  await user.click(screen.getByRole('button', { name: 'Meniu' }))
  const sheet = screen.getByRole('dialog')
  const current = within(sheet).getByRole('link', { name: 'Despre' })
  const other = within(sheet).getByRole('link', { name: 'Contact' })

  expect(current).toHaveAttribute('aria-current', 'page')
  expect(current).toHaveClass('bg-primary/10', 'text-primary', 'min-h-touch-target')
  expect(other).not.toHaveAttribute('aria-current')
  expect(other).toHaveClass('text-foreground', 'min-h-touch-target')
  expect(within(sheet).getByRole('link', { name: 'Înregistrare' })).toHaveClass('btn-cta')
})

test('choosing a link in the mobile menu closes it', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/']}>
      <Header />
    </MemoryRouter>,
  )

  await user.click(screen.getByRole('button', { name: 'Meniu' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Contact' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
