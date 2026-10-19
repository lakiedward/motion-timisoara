import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentEntry } from './PaymentEntry'

const { state, supported } = vi.hoisted(() => ({
  state: {
    android: true,
    availability: {
      isPending: false,
      isError: false,
      data: { googlePay: false, testMode: true },
      refetch: vi.fn(),
    },
  },
  supported: vi.fn(() => true),
}))
vi.mock('./usePaymentAdapter', () => ({ usePaymentAdapter: () => state }))
vi.mock('@/api/payments/native', () => ({ nativePaymentsSupported: supported }))

beforeEach(() => {
  state.android = true
  state.availability.isPending = false
  state.availability.isError = false
  state.availability.data = { googlePay: false, testMode: true }
  vi.clearAllMocks()
  supported.mockReturnValue(true)
})

describe('Android payment entry', () => {
  it('keeps card fallback clear when Google Pay is unavailable', () => {
    render(<PaymentEntry />)
    expect(
      screen.getByText(
        /Google Pay nu este disponibil pe acest telefon. Poți folosi un card bancar/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/Mod de test: nu se încasează bani reali/)).toBeInTheDocument()
    expect(screen.queryByText('Card web simulat')).not.toBeInTheDocument()
  })

  it('describes separate child confirmations and recovery before starting payments', () => {
    state.availability.data.googlePay = true
    render(<PaymentEntry childCount={2} />)
    expect(screen.getByText(/Poți alege Google Pay sau un card bancar/)).toBeInTheDocument()
    expect(
      screen.getByText(/se confirmă separat pentru fiecare dintre cei 2 copii/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/poți relua plățile rămase din Înscrieri, cu aceeași sumă/),
    ).toBeInTheDocument()
  })

  it('distinguishes loading from unavailable-wallet fallback', () => {
    state.availability.isPending = true
    render(<PaymentEntry />)
    expect(screen.getByRole('status', { name: 'Verificăm metodele de plată' })).toBeInTheDocument()
    expect(screen.queryByText(/Google Pay nu este disponibil/)).not.toBeInTheDocument()
  })

  it('offers a retry after native setup fails', () => {
    state.availability.isError = true
    render(<PaymentEntry />)
    expect(screen.getByRole('alert')).toHaveTextContent('Nu am putut pregăti plata pe telefon.')
    fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
    expect(state.availability.refetch).toHaveBeenCalledTimes(1)
  })

  it('explains when the installed Android build lacks native payment support', () => {
    supported.mockReturnValue(false)
    render(<PaymentEntry />)
    expect(screen.getByRole('alert')).toHaveTextContent('Actualizează aplicația')
    expect(screen.queryByText(/Poți alege Google Pay/)).not.toBeInTheDocument()
  })

  it('sends web parents to Stripe Checkout instead of showing a card field', () => {
    state.android = false
    render(<PaymentEntry childCount={2} />)
    expect(screen.getByText(/Plătești pe pagina securizată Stripe: card, Apple Pay sau Google Pay/)).toBeInTheDocument()
    expect(screen.queryByText(/se confirmă separat/)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('keeps the Android panel heading below the enrollment card heading when unframed', () => {
    render(<PaymentEntry framed={false} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Card sau Google Pay' })).toBeInTheDocument()
  })
})
