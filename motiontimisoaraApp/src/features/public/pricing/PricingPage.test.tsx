import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import PricingPage from './PricingPage'

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <PricingPage />
    </MemoryRouter>,
  )
}

test('direcția A arată antrenorul, cele trei pachete de club, promoția și nota fără TVA', () => {
  renderAt('/preturi')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Un abonament simplu')
  for (const price of ['100', '199', '349', '599']) expect(screen.getByText(price)).toBeInTheDocument()
  expect(screen.getByText('Până la 3 antrenori')).toBeInTheDocument()
  expect(screen.getByText('Antrenori nelimitați')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '3 luni gratuite la lansare' })).toBeInTheDocument()
  expect(screen.getByText(/nu este plătitor de TVA/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Creează cont' })).toHaveAttribute('href', '/register-coach')
  expect(screen.getAllByRole('link', { name: 'Înregistrează clubul' })[0]).toHaveAttribute('href', '/register-club')
  expect(screen.getByText('Cum anulez abonamentul?')).toBeInTheDocument()
})

test('direcția B comută între antrenor și club', () => {
  renderAt('/preturi?directie=b')
  expect(screen.getByText('100')).toBeInTheDocument()
  expect(screen.queryByText('349')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: 'Club' }))
  expect(screen.getByRole('radio', { name: 'Club' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByText('349')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Înregistrează clubul' })).toHaveAttribute('href', '/register-club')
})
