import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, test, vi } from 'vitest'

import { CardPaymentsMonthCard } from './CardPaymentsMonthCard'
import { getCardPaymentsMonth } from '@/api/payments/card-payments-month'
import { subscriptionSalesAllowed } from '@/lib/store-compliance'

vi.mock('@/api/payments/card-payments-month', () => ({
  CARD_PAYMENTS_MONTH_QUERY_KEY: ['card-payments-month'],
  getCardPaymentsMonth: vi.fn(),
}))
vi.mock('@/lib/store-compliance', () => ({ subscriptionSalesAllowed: vi.fn(() => true) }))

const mockedMonth = vi.mocked(getCardPaymentsMonth)
const month = {
  monthStart: '2026-11-01',
  collected: 1600000,
  stripeFee: 29000,
  net: 1571000,
  paymentCount: 50,
  unsettledCount: 0,
}

beforeEach(() => {
  mockedMonth.mockReset()
  vi.mocked(subscriptionSalesAllowed).mockReturnValue(true)
})

function renderCard(enabled = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CardPaymentsMonthCard enabled={enabled} offersLabel="ofertele tale" netLabel="Primești tu" />
    </QueryClientProvider>,
  )
}

function figure(label: string) {
  return within(screen.getByText(label).parentElement as HTMLElement)
}

test('shows collected, the Stripe fee withheld and the net for the month', async () => {
  mockedMonth.mockResolvedValue(month)
  renderCard()
  expect(await screen.findByRole('heading', { name: 'Plăți online în noiembrie' })).toBeInTheDocument()
  expect(await screen.findByText('50 de plăți cu cardul la ofertele tale, până azi')).toBeInTheDocument()
  expect(figure('Încasat de la părinți').getByText('16.000,00 lei')).toBeInTheDocument()
  expect(figure('Cost Stripe reținut').getByText('− 290,00 lei')).toBeInTheDocument()
  expect(figure('Primești tu').getByText('15.710,00 lei')).toBeInTheDocument()
  expect(screen.getByText(/Abonamentul se plătește separat/)).toBeInTheDocument()
  expect(screen.queryByText(/se confirmă în câteva minute/)).not.toBeInTheDocument()
})

test('the native app never mentions the subscription', async () => {
  vi.mocked(subscriptionSalesAllowed).mockReturnValue(false)
  mockedMonth.mockResolvedValue(month)
  renderCard()
  expect(await screen.findByText(/se reține automat din fiecare plată/)).toBeInTheDocument()
  expect(screen.queryByText(/Abonament/)).not.toBeInTheDocument()
})

test('payments still at the ceiling fee are announced as provisional', async () => {
  mockedMonth.mockResolvedValue({ ...month, paymentCount: 1, unsettledCount: 1 })
  renderCard()
  expect(await screen.findByText('1 plată cu cardul la ofertele tale, până azi')).toBeInTheDocument()
  expect(screen.getByText(/Costul exact pentru 1 plată se confirmă în câteva minute/)).toBeInTheDocument()
})

test('a month without card payments says so instead of three zeros', async () => {
  mockedMonth.mockResolvedValue({ ...month, collected: 0, stripeFee: 0, net: 0, paymentCount: 0 })
  renderCard()
  expect(await screen.findByText('Nicio plată cu cardul la ofertele tale luna aceasta.')).toBeInTheDocument()
  expect(screen.queryByText('Încasat de la părinți')).not.toBeInTheDocument()
})

test('loading shows skeletons and a failed read can be retried', async () => {
  mockedMonth.mockReturnValueOnce(new Promise(() => {}))
  const { unmount } = renderCard()
  expect(screen.getByRole('status', { name: 'Se încarcă: plățile online' })).toBeInTheDocument()
  unmount()

  mockedMonth.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(month)
  renderCard()
  expect(await screen.findByText('Nu am putut încărca plățile online')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('16.000,00 lei')).toBeInTheDocument()
})

test('nothing is read or shown while Stripe is not configured', () => {
  renderCard(false)
  expect(screen.queryByTestId('card-payments-month')).not.toBeInTheDocument()
  expect(mockedMonth).not.toHaveBeenCalled()
})
