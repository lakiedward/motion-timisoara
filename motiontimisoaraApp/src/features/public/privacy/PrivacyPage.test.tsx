import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import PrivacyPage from '../PrivacyPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>,
  )
}

const sectionIds = [
  'operator',
  'date-colectate',
  'scop-si-temei',
  'datele-copiilor',
  'furnizori-si-control',
  'durata-pastrarii',
  'drepturile-tale',
  'ce-se-partajeaza',
  'cine-poate-vedea-pozitia',
  'cat-timp-raman-datele',
]

describe('PrivacyPage', () => {
  it('shows the legal header with version and update date', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Confidențialitate' })).toBeInTheDocument()
    expect(
      screen.getByText(/Versiunea 1\.2 · ultima actualizare: 2 noiembrie 2026/),
    ).toBeInTheDocument()
  })

  it('links every section from the table of contents in order', () => {
    renderPage()
    const toc = screen.getByRole('navigation', { name: 'Cuprins' })
    const hrefs = Array.from(toc.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(sectionIds.map((id) => `#${id}`))
    for (const id of sectionIds) expect(document.getElementById(id)).not.toBeNull()
  })

  it('shows the operator company data and the privacy email', () => {
    renderPage()
    const operator = document.getElementById('operator')!
    const expected: Record<string, string> = {
      Denumire: 'TITUS CLUB SWIM&FUN S.R.L.',
      CUI: '49252540',
      'Nr. Registrul Comerțului': 'J35/4752/2023',
      Sediu: 'Str. Arieș nr. 2, sat Ghiroda, comuna Ghiroda, județul Timiș',
      'Email pentru date personale': 'office@motionromania.ro',
    }
    for (const [label, value] of Object.entries(expected)) {
      expect(within(operator).getByText(label).parentElement).toHaveTextContent(value)
    }
    expect(within(operator).queryByText('De completat')).not.toBeInTheDocument()
  })

  it('states a legal basis for each purpose, including health data and photos', () => {
    renderPage()
    const text = document.getElementById('scop-si-temei')!.textContent
    for (const basis of [
      'art. 6 alin. 1 lit. b',
      'art. 6 alin. 1 lit. c',
      'art. 9 alin. 2 lit. a',
      'art. 6 alin. 1 lit. a',
      'art. 6 alin. 1 lit. f',
    ]) {
      expect(text).toContain(basis)
    }
  })

  it('names the Google Play publisher and keeps the operator as controller', () => {
    renderPage()
    const text = document.getElementById('operator')!.textContent
    expect(text).toContain('publicată în Google Play de Romcad Design Inc. (New York, SUA)')
    expect(text).toContain('în numele operatorului de mai sus')
  })

  it('explains parental consent for children', () => {
    renderPage()
    const text = document.getElementById('datele-copiilor')!.textContent
    expect(text).toContain('Părintele creează profilul copilului')
    expect(text).toContain('16 ani')
  })

  it('names every data processor the app uses and the transfer safeguards', () => {
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
      'clauzele contractuale standard',
    ]) {
      expect(section.textContent).toContain(name)
    }
  })

  it('lists the rights, the contact routes and the ANSPDCP complaint', () => {
    renderPage()
    const rights = document.getElementById('drepturile-tale')!
    expect(within(rights).getByRole('link', { name: 'pagina de contact' })).toHaveAttribute(
      'href',
      '/contact',
    )
    expect(within(rights).getByRole('link', { name: 'office@motionromania.ro' })).toHaveAttribute(
      'href',
      'mailto:office@motionromania.ro',
    )
    expect(within(rights).getByRole('link', { name: 'dataprotection.ro' })).toHaveAttribute(
      'href',
      'https://www.dataprotection.ro',
    )
    expect(rights.textContent).toContain('ANSPDCP')
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

  it('marks the header and the tracked sections with their Team Tracker surface keys', () => {
    const { container } = renderPage()
    const keys = Array.from(container.querySelectorAll('[data-section]')).map(
      (el) => el.getAttribute('data-section')?.split(':')[2],
    )
    expect(keys).toEqual([
      'titlu',
      'cine-raspunde-de-datele-tale',
      'ce-date-colectam',
      'de-ce-le-folosim-si-pe-ce-temei',
      'datele-copiilor',
      'furnizori-si-control',
      'cat-timp-pastram-datele',
      'drepturile-tale',
      'ce-se-partajeaza',
      'cine-poate-vedea-pozitia',
      'cat-timp-raman-datele',
    ])
  })
})
