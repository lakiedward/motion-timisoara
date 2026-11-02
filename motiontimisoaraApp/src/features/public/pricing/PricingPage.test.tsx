import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import PricingPage from './PricingPage'

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <PricingPage />
    </MemoryRouter>,
  )
}

test('pagina arată antrenorul, cele trei pachete de club, promoția și nota fără TVA', () => {
  renderAt('/preturi')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Un abonament simplu')
  for (const price of ['100', '199', '349', '599']) expect(screen.getAllByText(price).length).toBeGreaterThan(0)
  expect(screen.getAllByText('Până la 3 antrenori')).toHaveLength(2)
  expect(screen.getAllByText('Antrenori nelimitați')).toHaveLength(2)
  expect(screen.getByRole('heading', { name: 'Pachete pentru cluburi' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '3 luni gratuite la lansare' })).toBeInTheDocument()
  expect(screen.getByText(/nu este plătitor de TVA/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Creează cont' })).toHaveAttribute('href', '/register-coach')
  expect(screen.getAllByRole('link', { name: 'Înregistrează clubul' })[0]).toHaveAttribute('href', '/register-club')
  expect(screen.getByText('Cum anulez abonamentul?')).toBeInTheDocument()
})
