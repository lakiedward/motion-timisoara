import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EnrollmentPaymentPanel } from './EnrollmentPaymentPanel'
import type { EnrollmentPayment } from '@/api/payments/enrollments'
import { formatMoney } from '@/lib/money'

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  process: vi.fn(),
  ready: true,
  userId: 'parent-327',
  adapter: { testOnly: true, confirm: vi.fn() },
  toast: { success: vi.fn(), message: vi.fn(), error: vi.fn() },
}))
vi.mock('@/api/payments/enrollments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/payments/enrollments')>()),
  getEnrollmentPayments: mocks.read,
}))
vi.mock('@/api/payments/process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/payments/process')>()),
  processEnrollmentPayments: mocks.process,
}))
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: mocks.userId } }) }))
vi.mock('@/lib/stripe', () => ({ stripePromise: Promise.resolve(null) }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('./usePaymentAdapter', () => ({
  usePaymentAdapter: () => ({ ready: mocks.ready, adapter: mocks.adapter }),
}))
vi.mock('./PaymentEntry', () => ({ PaymentEntry: () => <p>Card sau Google Pay</p> }))
vi.mock('sonner', () => ({ toast: mocks.toast }))

function enrollment(paid = false): EnrollmentPayment {
  return {
    id: 'saved-enrollment',
    status: paid ? 'ACTIVE' : 'PENDING',
    kind: 'COURSE',
    entity_id: 'course',
    purchased_sessions: 5,
    remaining_sessions: paid ? 5 : 0,
    child: { id: 'child', name: 'Copil Audit' },
    payments: [
      {
        id: 'saved-payment',
        amount: 31612,
        currency: 'RON',
        status: paid ? 'SUCCEEDED' : 'FAILED',
        method: 'CARD',
        pricing_snapshot: {
          sourceUnitAmount: 1234,
          sourceCurrency: 'EUR',
          quantity: 5,
          eurRonRateMicros: 5123456,
        },
        billing_name: 'Părinte Audit',
        billing_email: 'audit@example.test',
        billing_address_line1: null,
        billing_city: null,
        billing_postal_code: null,
      },
    ],
  }
}

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  const onClose = vi.fn()
  const view = render(
    <QueryClientProvider client={client}>
      <EnrollmentPaymentPanel enrollmentId="saved-enrollment" onClose={onClose} />
    </QueryClientProvider>,
  )
  return { ...view, client, onClose }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.ready = true
  mocks.userId = 'parent-327'
  mocks.read.mockResolvedValue([enrollment()])
  mocks.process.mockResolvedValue({ outcome: 'canceled', completed: 0, total: 1 })
})

describe('saved enrollment payment panel', () => {
  it('shows the accepted RON amount and EUR snapshot and never pays on mount or refresh', async () => {
    const { client } = renderPanel()
    const button = await screen.findByRole('button', {
      name: `Plătește ${formatMoney(31612, 'RON')}`,
    })
    expect(button).toBeEnabled()
    expect(screen.getByText(/1 EUR = 5,123456 lei/)).toBeInTheDocument()
    expect(screen.getByText(/5 × 12,34/)).toBeInTheDocument()
    expect(mocks.process).not.toHaveBeenCalled()
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['enrollment-payment'] })
    })
    expect(mocks.process).not.toHaveBeenCalled()
    expect(mocks.read.mock.calls.every(([ids]) => ids.join(',') === 'saved-enrollment')).toBe(true)
  })

  it('retries a failed ownership/state read before exposing a payment action', async () => {
    mocks.read.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([enrollment()])
    renderPanel()
    expect(await screen.findByRole('alert')).toHaveTextContent('Reîncearcă înainte să plătești')
    expect(screen.queryByRole('button', { name: /^Plătește/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
    expect(await screen.findByRole('button', { name: /^Plătește/ })).toBeEnabled()
    expect(mocks.process).not.toHaveBeenCalled()
  })

  it('requires another explicit payment action after cancellation and reuses the saved ID', async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: /^Plătește/ }))
    await waitFor(() => expect(mocks.process).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('status')).toHaveTextContent('Ai închis plata')
    await waitFor(() => expect(screen.getByRole('button', { name: /^Plătește/ })).toBeEnabled())
    expect(mocks.process).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /^Plătește/ }))
    await waitFor(() => expect(mocks.process).toHaveBeenCalledTimes(2))
    for (const [ids, adapter] of mocks.process.mock.calls) {
      expect(ids).toEqual(['saved-enrollment'])
      expect(adapter).toBe(mocks.adapter)
    }
  })

  it('removes payment actions for an already fulfilled enrollment', async () => {
    mocks.read.mockResolvedValue([enrollment(true)])
    renderPanel()
    expect(await screen.findByText(/Nu mai trebuie să plătești/)).toHaveAttribute('role', 'status')
    expect(screen.queryByRole('button', { name: /^Plătește/ })).not.toBeInTheDocument()
    expect(mocks.process).not.toHaveBeenCalled()
  })

  it('does not permit payment while the native adapter is unavailable', async () => {
    mocks.ready = false
    renderPanel()
    const button = await screen.findByRole('button', { name: /^Plătește/ })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(mocks.process).not.toHaveBeenCalled()
  })

  it('aborts the active batch when the panel unmounts', async () => {
    mocks.process.mockReturnValue(new Promise(() => undefined))
    const { unmount } = renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: /^Plătește/ }))
    await waitFor(() => expect(mocks.process).toHaveBeenCalledTimes(1))
    const signal = mocks.process.mock.calls[0][3] as AbortSignal
    expect(signal.aborted).toBe(false)
    unmount()
    expect(signal.aborted).toBe(true)
  })

  it.each(['completed', 'failed'] as const)(
    'does not notify a new account when the previous payment later %s',
    async (outcome) => {
      let resolve!: (value: unknown) => void
      let reject!: (reason: Error) => void
      mocks.process.mockReturnValue(new Promise((yes, no) => {
        resolve = yes
        reject = no
      }))
      const { client, onClose, rerender } = renderPanel()
      fireEvent.click(await screen.findByRole('button', { name: /^Plătește/ }))
      await waitFor(() => expect(mocks.process).toHaveBeenCalledTimes(1))
      const signal = mocks.process.mock.calls[0][3] as AbortSignal
      mocks.userId = 'another-parent'
      rerender(
        <QueryClientProvider client={client}>
          <EnrollmentPaymentPanel enrollmentId="saved-enrollment" onClose={onClose} />
        </QueryClientProvider>,
      )
      expect(signal.aborted).toBe(true)
      await act(async () => {
        if (outcome === 'completed') resolve({ outcome: 'ready', completed: 1, total: 1 })
        else reject(new Error('Old account payment failed'))
      })
      expect(mocks.toast.success).not.toHaveBeenCalled()
      expect(mocks.toast.message).not.toHaveBeenCalled()
      expect(mocks.toast.error).not.toHaveBeenCalled()
    },
  )
})
