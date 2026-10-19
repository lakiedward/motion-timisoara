import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { CheckoutOrderSummary } from './CheckoutOrderSummary'

test('lists every participant with the server amount and the total', () => {
  render(
    <CheckoutOrderSummary
      title="Tabără de munte"
      kindLabel="Tabără"
      lines={[
        { id: 'a', name: 'Ana', amount: 60000 },
        { id: 'b', name: 'Bogdan', amount: 80000 },
      ]}
      total={140000}
    />,
  )
  expect(screen.getByRole('heading', { name: 'Sumar comandă' })).toBeInTheDocument()
  expect(screen.getByText('Tabără de munte')).toBeInTheDocument()
  expect(screen.getByText('600,00 lei')).toBeInTheDocument()
  expect(screen.getByText('800,00 lei')).toBeInTheDocument()
  expect(screen.getByText('1.400,00 lei')).toBeInTheDocument()
  expect(screen.getByText('2 copii')).toBeInTheDocument()
})

test('counts participants when an adult joins and shows the package', () => {
  render(
    <CheckoutOrderSummary
      title="Înot"
      kindLabel="Curs"
      packageSize={10}
      lines={[
        { id: 'a', name: 'Ana', amount: 50000 },
        { id: 'p', name: 'Părinte', adult: true, amount: 50000 },
      ]}
      total={100000}
    />,
  )
  expect(screen.getByText('2 participanți · pachet de 10 ședințe')).toBeInTheDocument()
  expect(screen.getByText('Adult')).toBeInTheDocument()
})

test('never shows a total when a price is not confirmed', () => {
  render(
    <CheckoutOrderSummary
      title="Tabără"
      kindLabel="Tabără"
      lines={[{ id: 'a', name: 'Ana' }]}
      total={undefined}
    />,
  )
  expect(screen.getAllByText('Preț indisponibil')).toHaveLength(2)
})
