import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import TermsPage from '../TermsPage'
import { TERMS_SECTIONS } from './terms-sections'

function randeaza() {
  return render(
    <MemoryRouter>
      <TermsPage />
    </MemoryRouter>,
  )
}

test('antetul are eyebrow, titlu, intermediarul și versiunea', () => {
  randeaza()
  expect(screen.getByText('Informații legale')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Termeni și condiții' })).toBeInTheDocument()
  expect(
    screen.getByText(
      /contractul pentru curs, activitate sau tabără se încheie între tine și organizatorul/i,
    ),
  ).toBeInTheDocument()
  expect(screen.getByText(/^Versiunea 1\.0 · ultima actualizare: /)).toBeInTheDocument()
})

test('cuprinsul are câte o ancoră spre fiecare secțiune', () => {
  const { container } = randeaza()
  const cuprins = screen.getByRole('navigation', { name: 'Cuprins' })
  const linkuri = within(cuprins).getAllByRole('link')
  expect(linkuri).toHaveLength(TERMS_SECTIONS.length)
  TERMS_SECTIONS.forEach((s, i) => {
    expect(linkuri[i]).toHaveAttribute('href', `#${s.id}`)
    expect(container.querySelector(`section#${s.id}`)).not.toBeNull()
    expect(screen.getByRole('region', { name: `${i + 1}. ${s.title}` })).toBeInTheDocument()
  })
})

test('înscrieri și plăți spune lipsa dreptului de retragere și rambursarea la anulare', () => {
  randeaza()
  const sectiune = screen.getByRole('region', { name: /Înscrieri și plăți/ })
  expect(sectiune).toHaveTextContent('OUG 34/2014, art. 16 lit. l')
  expect(sectiune).toHaveTextContent('primești banii înapoi integral')
  expect(sectiune).toHaveTextContent('Stripe')
})

test('participare și date personale au textele cerute, fără fraza despre jurnalul acceptării', () => {
  randeaza()
  expect(screen.getByRole('region', { name: /Participare în siguranță/ })).toHaveTextContent(
    'avizul epidemiologic',
  )
  const date = screen.getByRole('region', { name: /Date personale/ })
  expect(within(date).getByRole('link', { name: 'politica de confidențialitate' })).toHaveAttribute(
    'href',
    '/confidentialitate',
  )
  expect(date).not.toHaveTextContent('păstrăm')
})

test('contactul are email, telefon și formular apăsabile', () => {
  randeaza()
  const contact = screen.getByRole('region', { name: /Contact/ })
  expect(
    within(contact).getByRole('link', { name: /contact@motionromania\.com/ }),
  ).toHaveAttribute('href', 'mailto:contact@motionromania.com')
  expect(within(contact).getByRole('link', { name: /\+40 750 420 455/ })).toHaveAttribute(
    'href',
    'tel:+40750420455',
  )
  expect(within(contact).getByRole('link', { name: /Formularul de contact/ })).toHaveAttribute(
    'href',
    '/contact',
  )
})

test('fiecare secțiune poartă cheia ei din UI Coverage', () => {
  const { container } = randeaza()
  expect(container.querySelectorAll('[data-section^="manual:section:"]')).toHaveLength(
    TERMS_SECTIONS.length + 1,
  )
})
