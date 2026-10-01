import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { NativeAppShell } from './NativeAppShell'
import { setNativeDocumentScroll } from './native-keyboard'

vi.mock('./native-keyboard', () => ({
  setNativeDocumentScroll: vi.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.history.replaceState(null, '')
})

afterEach(() => vi.restoreAllMocks())

test('navigation resets the content scroller while keeping the document still', async () => {
  const router = createMemoryRouter(
    [
      {
        element: (
          <NativeAppShell role={null}>
            <Outlet />
          </NativeAppShell>
        ),
        children: [
          { path: '/', element: <h1>Acasă</h1> },
          { path: '/exploreaza', element: <h1>Explorează</h1> },
        ],
      },
    ],
    { initialEntries: ['/'] },
  )
  const view = render(<RouterProvider router={router} />)
  const content = screen.getByRole('main')
  content.scrollTop = 480
  await userEvent.click(screen.getByRole('link', { name: 'Explorează' }))
  expect(await screen.findByRole('heading', { name: 'Explorează' })).toBeInTheDocument()
  expect(screen.getByRole('main')).toBe(content)
  expect(content.scrollTop).toBe(0)
  expect(window.scrollTo).not.toHaveBeenCalled()
  expect(setNativeDocumentScroll).toHaveBeenCalledWith(true)
  view.unmount()
  expect(setNativeDocumentScroll).toHaveBeenLastCalledWith(false)
  expect(document.documentElement).not.toHaveClass('native-navigation')
})

test('a directly opened child profile can return to the child list', async () => {
  const router = createMemoryRouter(
    [
      {
        element: (
          <NativeAppShell role="PARENT">
            <Outlet />
          </NativeAppShell>
        ),
        children: [
          { path: '/account/child/:id', element: <h1>Profil copil</h1> },
          { path: '/account/children', element: <h1>Copiii mei</h1> },
        ],
      },
    ],
    { initialEntries: ['/account/child/audit'] },
  )
  render(<RouterProvider router={router} />)
  const nav = screen.getByRole('navigation', { name: 'Navigare principală' })
  expect(within(nav).getByRole('link', { name: 'Copii' })).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByRole('button', { name: 'Meniu' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Înapoi' }))
  expect(await screen.findByRole('heading', { name: 'Copiii mei' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Înapoi' })).not.toBeInTheDocument()
})

test('role changes replace privileged destinations without remounting page content', () => {
  const content = <input aria-label="Conținut în curs" defaultValue="păstrat" />
  const view = render(
    <MemoryRouter>
      <NativeAppShell role="ADMIN">{content}</NativeAppShell>
    </MemoryRouter>,
  )
  expect(screen.getByRole('link', { name: 'Utilizatori' })).toHaveAttribute('href', '/admin/users')
  view.rerender(
    <MemoryRouter>
      <NativeAppShell role={null}>{content}</NativeAppShell>
    </MemoryRouter>,
  )
  expect(screen.queryByRole('link', { name: 'Utilizatori' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Acasă' })).toHaveAttribute('href', '/')
  expect(screen.getByLabelText('Conținut în curs')).toHaveValue('păstrat')
})
