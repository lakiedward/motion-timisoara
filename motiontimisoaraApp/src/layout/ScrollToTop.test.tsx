import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, Outlet, RouterProvider, useSearchParams } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { ScrollToTop } from './ScrollToTop'

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

function ListPage() {
  const [, setSearchParams] = useSearchParams()
  return (
    <>
      <h1>Tabere</h1>
      <Link to="/tabere/demo">Tabăra demo</Link>
      <Link to="/tabere#program">Program</Link>
      <button type="button" onClick={() => setSearchParams({ sport: 'inot' })}>
        Înot
      </button>
    </>
  )
}

function renderRouter() {
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <ScrollToTop />
            <Outlet />
          </>
        ),
        children: [
          { path: '/tabere', element: <ListPage /> },
          { path: '/tabere/:slug', element: <h1>Detaliu tabără</h1> },
        ],
      },
    ],
    { initialEntries: ['/tabere'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

test('opening a detail page starts at the top', async () => {
  renderRouter()
  expect(window.scrollTo).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('link', { name: 'Tabăra demo' }))
  expect(await screen.findByRole('heading', { name: 'Detaliu tabără' })).toBeInTheDocument()
  expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith(0, 0)
})

test('going back leaves the list position to the browser', async () => {
  const router = renderRouter()
  await userEvent.click(screen.getByRole('link', { name: 'Tabăra demo' }))
  vi.mocked(window.scrollTo).mockClear()
  await act(() => router.navigate(-1))
  expect(await screen.findByRole('heading', { name: 'Tabere' })).toBeInTheDocument()
  expect(window.scrollTo).not.toHaveBeenCalled()
})

test('filters and in-page anchors keep the scroll position', async () => {
  renderRouter()
  await userEvent.click(screen.getByRole('button', { name: 'Înot' }))
  await userEvent.click(screen.getByRole('link', { name: 'Program' }))
  expect(window.scrollTo).not.toHaveBeenCalled()
})
