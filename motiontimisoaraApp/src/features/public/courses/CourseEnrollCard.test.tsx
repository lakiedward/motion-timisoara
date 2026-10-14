import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { CourseEnrollCard } from './CourseEnrollCard'

const COURSE = { price: 48000, price_per_session: 6000, currency: 'RON' }

function renderCard(props: Partial<Parameters<typeof CourseEnrollCard>[0]> = {}) {
  const onEnroll = vi.fn()
  render(
    <MemoryRouter>
      <CourseEnrollCard
        course={COURSE}
        isFull={false}
        canEnroll
        onEnroll={onEnroll}
        rating={null}
        showMyRating={false}
        myRating={0}
        onRate={() => {}}
        {...props}
      />
    </MemoryRouter>,
  )
  return onEnroll
}

test('shows the monthly and per-session price with the package payment note', () => {
  const onEnroll = renderCard()
  expect(screen.getByText('/ lună')).toBeInTheDocument()
  expect(screen.getByText('60,00 lei / ședință')).toBeInTheDocument()
  expect(
    screen.getByText('Plătești la înscriere un pachet de ședințe, online sau cash.'),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Înscrie-te' }))
  expect(onEnroll).toHaveBeenCalledOnce()
})

test('a full course disables the button and links to other courses without repeating the text', () => {
  renderCard({ isFull: true })
  expect(screen.getByRole('button', { name: 'Locuri epuizate' })).toBeDisabled()
  expect(screen.getAllByText('Locuri epuizate')).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'Vezi alte cursuri' })).toHaveAttribute('href', '/cursuri')
})

test('a free course reads Gratuit without monthly or per-session price', () => {
  renderCard({ course: { ...COURSE, price: 0 } })
  expect(screen.getByText('Gratuit')).toBeInTheDocument()
  expect(screen.queryByText('/ lună')).not.toBeInTheDocument()
  expect(screen.queryByText(/ședință$/)).not.toBeInTheDocument()
})

test('an EUR course shows the per-session price before the exchange note', () => {
  renderCard({ course: { ...COURSE, currency: 'EUR', eur_ron_rate_micros: 5_100_000 } })
  const perSession = screen.getByText('60,00 EUR / ședință')
  const note = screen.getByText(/Plata se face în lei/)
  expect(perSession.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('an account that is not a parent sees a note instead of the button', () => {
  renderCard({ canEnroll: false })
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByText('Înscrierile se fac dintr-un cont de părinte.')).toBeInTheDocument()
})
