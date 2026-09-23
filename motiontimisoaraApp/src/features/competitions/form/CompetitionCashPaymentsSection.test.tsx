import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { CompetitionCashPaymentsSection } from './CompetitionCashPaymentsSection'
import {
  confirmCompetitionCashPayment,
  getCompetitionCashPayments,
} from '@/api/competition/competition-cash'

vi.mock('@/api/competition/competition-cash', () => ({
  getCompetitionCashPayments: vi.fn(),
  confirmCompetitionCashPayment: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

test('confirmarea cash cere alegerea explicită a sumei încasate', async () => {
  const user = userEvent.setup()
  vi.mocked(getCompetitionCashPayments).mockResolvedValue([
    {
      payment_id: 'payment-1',
      enrollment_id: 'enrollment-1',
      participant_name: 'Adult Audit',
      category_name: 'Adulți',
      amount: 12000,
      currency: 'RON',
      status: 'PENDING',
    },
  ])
  vi.mocked(confirmCompetitionCashPayment).mockResolvedValue()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CompetitionCashPaymentsSection competitionId="competition-1" />
    </QueryClientProvider>,
  )
  await user.click(await screen.findByRole('button', { name: 'Confirmă încasarea' }))
  expect(screen.getByText('Adult Audit · Adulți')).toBeInTheDocument()
  expect(confirmCompetitionCashPayment).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Confirmă suma încasată' }))
  await waitFor(() =>
    expect(confirmCompetitionCashPayment).toHaveBeenCalledWith('payment-1', expect.anything()),
  )
})
