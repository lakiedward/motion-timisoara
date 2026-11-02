import { vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import CashPaymentsPage from './CashPaymentsPage'
import { confirmCashPayment, getCashPayments, type CashPayment } from '@/api/payments/cash-payments'

vi.mock('@/api/payments/cash-payments', () => ({
  CASH_PAYMENTS_QUERY_KEY: ['cash-payments'],
  getCashPayments: vi.fn(),
  confirmCashPayment: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const base: CashPayment = {
  payment_id: 'payment-1',
  enrollment_id: 'enrollment-1',
  kind: 'COURSE',
  entity_id: 'course-1',
  offer_title: 'Înot pentru începători',
  participant_name: 'Ana Pop',
  is_adult: false,
  sessions: 8,
  amount: 40000,
  currency: 'RON',
  status: 'PENDING',
  created_at: '2026-10-28T10:00:00Z',
  paid_at: null,
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CashPaymentsPage />
    </QueryClientProvider>,
  )
}

test('confirmă o plată cash de curs numai din fereastra cu suma', async () => {
  const user = userEvent.setup()
  vi.mocked(getCashPayments).mockResolvedValue([
    base,
    {
      ...base,
      payment_id: 'payment-2',
      kind: 'CAMP',
      entity_id: 'camp-1',
      offer_title: 'Tabăra de vară',
      participant_name: 'Ion',
      sessions: null,
      status: 'SUCCEEDED',
      paid_at: '2026-10-27T10:00:00Z',
    },
  ])
  vi.mocked(confirmCashPayment).mockResolvedValue()
  renderPage()

  const group = await screen.findByRole('region', { name: 'Înot pentru începători' })
  expect(within(group).getByText('Ana Pop')).toBeInTheDocument()
  expect(within(group).getByText(/8 ședințe/)).toBeInTheDocument()
  expect(screen.queryByText('Ion')).not.toBeInTheDocument()

  await user.click(within(group).getByRole('button', { name: /Confirmă încasarea/ }))
  const dialog = await screen.findByRole('alertdialog', {
    name: /Ai primit 400,00 lei de la Ana Pop\?/,
  })
  expect(within(dialog).getByText(/Curs · Înot pentru începători/)).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Anulează' }))
  expect(confirmCashPayment).not.toHaveBeenCalled()

  await user.click(within(group).getByRole('button', { name: /Confirmă încasarea/ }))
  await user.click(await screen.findByRole('button', { name: 'Da, am primit banii' }))
  await waitFor(() =>
    expect(confirmCashPayment).toHaveBeenCalledWith('payment-1', expect.anything()),
  )

  await user.click(screen.getByRole('button', { name: /Încasate/ }))
  expect(await screen.findByText('Ion')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Confirmă încasarea/ })).not.toBeInTheDocument()
})

test('arată o stare goală când nu există plăți cash', async () => {
  vi.mocked(getCashPayments).mockResolvedValue([])
  renderPage()
  expect(await screen.findByText('Nu ai încă plăți cash.')).toBeInTheDocument()
})

test('arată eroarea cu reîncercare', async () => {
  vi.mocked(getCashPayments).mockRejectedValue(new Error('x'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca plățile cash.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Reîncearcă/ })).toBeInTheDocument()
})
