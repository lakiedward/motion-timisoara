import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import NotFoundPage from './NotFoundPage'

describe('NotFoundPage', () => {
  it('shows a heading and links back into the site', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Pagina nu a fost găsită' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mergi la pagina principală' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('link', { name: 'Vezi cursurile' })).toHaveAttribute('href', '/cursuri')
  })

  it('names the browser tab after the missing page', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(document.title).toBe('Pagina nu a fost găsită · Motion Timișoara')
  })
})
