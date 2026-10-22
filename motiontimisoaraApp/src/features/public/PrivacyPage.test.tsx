import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import PrivacyPage from './PrivacyPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>,
  )
}

describe('PrivacyPage', () => {
  it('shows the legal header with version and update date', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Confidențialitate' })).toBeInTheDocument()
    expect(
      screen.getByText(/Versiunea 1\.0 · ultima actualizare: 22 octombrie 2026/),
    ).toBeInTheDocument()
  })

  it('links every section from the table of contents', () => {
    renderPage()
    const toc = screen.getByRole('navigation', { name: 'Cuprins' })
    const ids = [
      'ce-se-partajeaza',
      'cine-poate-vedea-pozitia',
      'cat-timp-raman-datele',
      'furnizori-si-control',
    ]
    const hrefs = Array.from(toc.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(ids.map((id) => `#${id}`))
    for (const id of ids) expect(document.getElementById(id)).not.toBeNull()
  })

  it('names every data processor the app uses', () => {
    renderPage()
    const section = document.getElementById('furnizori-si-control')!
    for (const name of [
      'Supabase',
      'Stripe',
      'Google',
      'Netlify',
      'CARTO',
      'OpenStreetMap',
      'Photon',
    ]) {
      expect(section.textContent).toContain(name)
    }
    expect(screen.getByRole('link', { name: 'pagina de contact' })).toHaveAttribute(
      'href',
      '/contact',
    )
  })

  it('lists the access rules for courses, camps and stopping', () => {
    renderPage()
    const items = document.getElementById('cine-poate-vedea-pozitia')!.querySelectorAll('li')
    expect(Array.from(items).map((li) => li.querySelector('strong')?.textContent)).toEqual([
      'La cursuri:',
      'În tabără:',
      'Cum oprești:',
    ])
  })

  it('marks the header and every section with its Team Tracker surface key', () => {
    const { container } = renderPage()
    const keys = Array.from(container.querySelectorAll('[data-section]')).map(
      (el) => el.getAttribute('data-section')?.split(':')[2],
    )
    expect(keys).toEqual([
      'titlu',
      'ce-se-partajeaza',
      'cine-poate-vedea-pozitia',
      'cat-timp-raman-datele',
      'furnizori-si-control',
    ])
  })
})
