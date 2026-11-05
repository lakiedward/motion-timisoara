import { act, render } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import {
  formatPageTitle,
  HOME_TITLE,
  pageTitle,
  useDocumentTitle,
  useRouteTitle,
} from './page-title'

function Layout() {
  useRouteTitle()
  return <Outlet />
}

function Detail({ name }: { name: string | undefined }) {
  useDocumentTitle(name, 'Cursuri')
  return null
}

function renderAt(path: string, detailName?: string) {
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: '/', element: null },
          { path: '/cursuri', element: null, handle: pageTitle('Cursuri') },
          {
            path: '/cursuri/:id',
            element: <Detail name={detailName} />,
            handle: pageTitle('Cursuri'),
          },
          { path: '/account', element: null },
          { path: '*', element: null, handle: pageTitle('Pagina nu a fost găsită') },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

afterEach(() => {
  document.title = ''
})

describe('formatPageTitle', () => {
  it('puts the page before the brand', () => {
    expect(formatPageTitle('Cursuri')).toBe('Cursuri · Motion România')
  })

  it('falls back to the brand alone', () => {
    expect(formatPageTitle(undefined)).toBe('Motion România')
    expect(formatPageTitle('  ')).toBe('Motion România')
  })
})

describe('useRouteTitle', () => {
  it('gives the home page its own descriptive title', () => {
    renderAt('/')
    expect(document.title).toBe(HOME_TITLE)
  })

  it('names the tab after the matched route', () => {
    renderAt('/cursuri')
    expect(document.title).toBe('Cursuri · Motion România')
  })

  it('titles the not-found route', () => {
    renderAt('/ruta-care-nu-exista')
    expect(document.title).toBe('Pagina nu a fost găsită · Motion România')
  })

  it('resets to the brand on pages without a title', () => {
    const router = renderAt('/cursuri')
    act(() => {
      void router.navigate('/account')
    })
    expect(document.title).toBe('Motion România')
  })
})

describe('useDocumentTitle', () => {
  it('shows the record name once it is loaded', () => {
    renderAt('/cursuri/7', 'Înot pentru începători')
    expect(document.title).toBe('Înot pentru începători · Motion România')
  })

  it('keeps the section title while the record is loading', () => {
    renderAt('/cursuri/7', undefined)
    expect(document.title).toBe('Cursuri · Motion România')
  })

  it('does not keep the previous record name after leaving the page', () => {
    const router = renderAt('/cursuri/7', 'Înot pentru începători')
    act(() => {
      void router.navigate('/cursuri')
    })
    expect(document.title).toBe('Cursuri · Motion România')
  })
})
