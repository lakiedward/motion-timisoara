import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getEnrollmentPayments, enrollmentPayable } from './enrollments'

const { query, select, from } = vi.hoisted(() => {
  const query = vi.fn()
  const select = vi.fn<(columns: string) => { in: typeof query }>(() => ({ in: query }))
  return { query, select, from: vi.fn(() => ({ select })) }
})
vi.mock('@/lib/supabase', () => ({ supabase: { from } }))

const row = (id: string) => ({
  id,
  child: { id: `child-${id}`, name: 'Copil Audit' },
  payments: [{ id: `payment-${id}`, status: 'PENDING', method: 'CARD' }],
})

beforeEach(() => vi.clearAllMocks())

describe('owner-scoped enrollment payment reads', () => {
  it('returns requested enrollments in the chosen order despite unordered server results', async () => {
    query.mockResolvedValue({ data: [row('second'), row('first')], error: null })
    const result = await getEnrollmentPayments(['first', 'second'])
    expect(result.map(({ id }) => id)).toEqual(['first', 'second'])
    expect(from).toHaveBeenCalledWith('enrollments')
    expect(query).toHaveBeenCalledWith('id', ['first', 'second'])
    expect(select.mock.calls[0][0]).toContain('pricing_snapshot')
  })

  it('does not query without an enrollment selection', async () => {
    expect(await getEnrollmentPayments([])).toEqual([])
    expect(from).not.toHaveBeenCalled()
  })

  it.each([null, [], [row('first')]])(
    'rejects missing or RLS-filtered enrollment rows',
    async (data) => {
      query.mockResolvedValue({ data, error: null })
      await expect(getEnrollmentPayments(['first', 'foreign'])).rejects.toThrow(
        'nu este disponibilă în acest cont',
      )
    },
  )

  it('preserves a failed read as an error instead of an empty list', async () => {
    const error = { code: '503', message: 'unavailable' }
    query.mockResolvedValue({ data: null, error })
    await expect(getEnrollmentPayments(['first'])).rejects.toMatchObject({
      message: 'Nu am putut verifica plățile. Reîncearcă.',
      cause: error,
    })
  })

  it.each([
    { ...row('first'), child: null, adult_profile_id: null },
    { ...row('first'), payments: [] },
    { ...row('first'), payments: [row('first').payments[0], row('second').payments[0]] },
  ])('rejects unavailable children or ambiguous payment records', async (invalid) => {
    query.mockResolvedValue({ data: [invalid], error: null })
    await expect(getEnrollmentPayments(['first'])).rejects.toThrow('Contactează clubul')
  })

  it('accepts an adult camp enrollment without a child sheet', async () => {
    query.mockResolvedValue({
      data: [{ ...row('first'), child: null, adult_profile_id: 'parent' }],
      error: null,
    })
    const [enrollment] = await getEnrollmentPayments(['first'])
    expect(enrollment.adult_profile_id).toBe('parent')
    expect(enrollment.child).toBeNull()
  })
})

describe('payment recovery eligibility', () => {
  it.each(['PENDING', 'FAILED'])('allows explicit recovery of a %s card payment', (status) => {
    expect(enrollmentPayable({ status: 'PENDING', payments: [{ status, method: 'CARD' }] })).toBe(
      true,
    )
  })

  it.each([
    { status: 'ACTIVE', payments: [{ status: 'SUCCEEDED', method: 'CARD' }] },
    { status: 'CANCELLED', payments: [{ status: 'PENDING', method: 'CARD' }] },
    { status: 'PENDING', payments: [{ status: 'PENDING', method: 'CASH' }] },
    { status: 'PENDING', payments: [{ status: 'SUCCEEDED', method: 'CARD' }] },
    { status: 'PENDING', payments: [{ status: 'REFUNDED', method: 'CARD' }] },
    { status: 'PENDING', payments: [] },
    {
      status: 'PENDING',
      payments: [
        { status: 'PENDING', method: 'CARD' },
        { status: 'PENDING', method: 'CARD' },
      ],
    },
  ])('blocks recovery for an ineligible or ambiguous enrollment', (enrollment) => {
    expect(enrollmentPayable(enrollment)).toBe(false)
  })
})
