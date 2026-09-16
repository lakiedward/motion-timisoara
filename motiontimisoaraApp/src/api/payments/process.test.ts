import { describe, expect, it, vi } from 'vitest'
import type { EnrollmentPayment } from './enrollments'
import { processEnrollmentPayments, type PaymentAdapter } from './process'

function enrollment(id: string, paid = false): EnrollmentPayment {
  return {
    id,
    status: paid ? 'ACTIVE' : 'PENDING',
    kind: 'COURSE',
    entity_id: 'course',
    purchased_sessions: paid ? 5 : 0,
    remaining_sessions: paid ? 5 : 0,
    child: { id: `child-${id}`, name: `Copil ${id}` },
    payments: [
      {
        id: `payment-${id}`,
        amount: 31612,
        currency: 'RON',
        status: paid ? 'SUCCEEDED' : 'PENDING',
        method: 'CARD',
        pricing_snapshot: {
          sourceUnitAmount: 1234,
          sourceCurrency: 'EUR',
          quantity: 5,
          eurRonRateMicros: 5123456,
        },
        billing_name: 'Părinte Audit',
        billing_email: 'audit@example.test',
        billing_address_line1: 'Strada Audit 1',
        billing_city: 'Timișoara',
        billing_postal_code: '300001',
      },
    ],
  }
}

function setup(ids = ['first', 'second']) {
  const current = new Map(ids.map((id) => [id, enrollment(id)]))
  const read = vi.fn(async (selected: string[]) => selected.map((id) => current.get(id)!))
  const intent = vi.fn(async (id: string) => ({ clientSecret: `${id}-secret`, testMode: true }))
  const pause = vi.fn(async () => undefined)
  const confirm = vi.fn<PaymentAdapter['confirm']>(async () => 'completed')
  const progress = vi.fn()
  const services = { read, intent, pause }
  const adapter = { testOnly: true, confirm }
  return { current, read, intent, pause, confirm, progress, services, adapter }
}

describe('existing enrollment payment recovery', () => {
  it.each(['cancel', 'refuse'] as const)(
    'preserves a paid child after the second payment is %s and retries only the remaining ID',
    async (interruption) => {
      const test = setup()
      test.confirm.mockImplementation(async ({ clientSecret }) => {
        if (clientSecret === 'first-secret') {
          test.current.set('first', enrollment('first', true))
          return 'completed'
        }
        if (interruption === 'refuse') throw new Error('Card refuzat')
        return 'canceled'
      })

      const result = await processEnrollmentPayments(
        ['first', 'second'],
        test.adapter,
        test.progress,
        undefined,
        test.services,
      )

      expect(result).toMatchObject({ outcome: 'partial', completed: 1, total: 2 })
      expect(test.pause).not.toHaveBeenCalled()
      test.intent.mockClear()
      test.confirm.mockClear()
      test.confirm.mockImplementation(async () => {
        test.current.set('second', enrollment('second', true))
        return 'completed'
      })

      const retried = await processEnrollmentPayments(
        ['first', 'second'],
        test.adapter,
        test.progress,
        undefined,
        test.services,
      )

      expect(retried).toMatchObject({ outcome: 'ready', completed: 2, total: 2 })
      expect(test.intent).toHaveBeenCalledExactlyOnceWith('second')
      expect(test.confirm).toHaveBeenCalledTimes(1)
      expect(test.confirm.mock.calls[0][0].clientSecret).toBe('second-secret')
      expect(test.read.mock.calls.every(([ids]) => ids.join(',') === 'first,second')).toBe(true)
    },
  )

  it.each(['alreadyProcessing', 'alreadySucceeded'] as const)(
    'reconciles %s from the server without opening another confirmation',
    async (flag) => {
      const test = setup(['first'])
      const intent = vi.fn(async () => ({ clientSecret: '', [flag]: true }))
      test.pause.mockImplementation(async () => {
        test.current.set('first', enrollment('first', true))
      })

      const result = await processEnrollmentPayments(
        ['first'],
        test.adapter,
        test.progress,
        undefined,
        { ...test.services, intent },
      )

      expect(result.outcome).toBe('ready')
      expect(test.confirm).not.toHaveBeenCalled()
      expect(test.read).toHaveBeenCalledTimes(3)
    },
  )

  it.each([false, undefined])(
    'blocks a non-test intent (%s) before native confirmation',
    async (testMode) => {
      const test = setup(['first'])
      const intent = vi.fn(async () => ({ clientSecret: 'first-secret', testMode }))
      const result = await processEnrollmentPayments(
        ['first'],
        test.adapter,
        test.progress,
        undefined,
        { ...test.services, intent },
      )
      expect(result).toMatchObject({ outcome: 'failed', completed: 0, total: 1 })
      expect(result.message).toMatch(/numai în mediul de test/)
      expect(test.confirm).not.toHaveBeenCalled()
    },
  )

  it('stops before any intent when owner-scoped reads reject an inaccessible enrollment', async () => {
    const test = setup()
    test.read.mockRejectedValue(new Error('Înscrierea nu este disponibilă în acest cont.'))
    await expect(
      processEnrollmentPayments(
        ['first', 'foreign'],
        test.adapter,
        test.progress,
        undefined,
        test.services,
      ),
    ).rejects.toThrow('nu este disponibilă în acest cont')
    expect(test.intent).not.toHaveBeenCalled()
    expect(test.confirm).not.toHaveBeenCalled()
  })

  it('stops the next child when the page is left during a confirmation', async () => {
    const test = setup()
    const abort = new AbortController()
    test.confirm.mockImplementation(async () => {
      test.current.set('first', enrollment('first', true))
      abort.abort()
      return 'completed'
    })
    const result = await processEnrollmentPayments(
      ['first', 'second'],
      test.adapter,
      test.progress,
      abort.signal,
      test.services,
    )
    expect(result).toMatchObject({ outcome: 'partial', completed: 1, total: 2 })
    expect(test.intent).toHaveBeenCalledExactlyOnceWith('first')
    expect(test.confirm).toHaveBeenCalledTimes(1)
    expect(test.pause).not.toHaveBeenCalled()
  })

  it('does not open the sheet when navigation aborts an in-flight intent request', async () => {
    const test = setup(['first'])
    const abort = new AbortController()
    test.intent.mockImplementation(async () => {
      abort.abort()
      return { clientSecret: 'first-secret', testMode: true }
    })
    await processEnrollmentPayments(
      ['first'],
      test.adapter,
      test.progress,
      abort.signal,
      test.services,
    )
    expect(test.confirm).not.toHaveBeenCalled()
    expect(test.pause).not.toHaveBeenCalled()
  })

  it('recovers a missed webhook notification by reading fulfilled server state', async () => {
    const test = setup(['first'])
    test.pause.mockImplementation(async () => {
      if (test.pause.mock.calls.length === 2) test.current.set('first', enrollment('first', true))
    })
    const result = await processEnrollmentPayments(
      ['first'],
      test.adapter,
      test.progress,
      undefined,
      test.services,
    )
    expect(result).toMatchObject({ outcome: 'ready', completed: 1, total: 1 })
    expect(test.confirm).toHaveBeenCalledTimes(1)
    expect(test.read).toHaveBeenCalledTimes(4)
    expect(test.pause).toHaveBeenCalledTimes(2)
  })

  it('bounds reconciliation and never treats an SDK completion as fulfillment', async () => {
    const test = setup(['first'])
    const result = await processEnrollmentPayments(
      ['first'],
      test.adapter,
      test.progress,
      undefined,
      test.services,
    )
    expect(result).toMatchObject({ outcome: 'pending', completed: 0, total: 1 })
    expect(test.read).toHaveBeenCalledTimes(13)
    expect(test.pause).toHaveBeenCalledTimes(11)
  })

  it('returns uncertainty after a reconciliation read fails without confirming again', async () => {
    const test = setup(['first'])
    test.read.mockResolvedValueOnce([enrollment('first')]).mockRejectedValue(new Error('offline'))
    const result = await processEnrollmentPayments(
      ['first'],
      test.adapter,
      test.progress,
      undefined,
      test.services,
    )
    expect(result).toMatchObject({ outcome: 'pending', completed: 0, total: 1 })
    expect(result.message).toMatch(/Verifică starea înainte de a relua/)
    expect(test.confirm).toHaveBeenCalledTimes(1)
  })

  it('does not open a card intent for a fulfilled free enrollment', async () => {
    const test = setup(['first'])
    test.current.set('first', {
      ...enrollment('first', true),
      payments: [{ ...enrollment('first', true).payments[0], amount: 0 }],
    })
    const result = await processEnrollmentPayments(
      ['first'],
      test.adapter,
      test.progress,
      undefined,
      test.services,
    )
    expect(result).toMatchObject({ outcome: 'ready', completed: 1, total: 1 })
    expect(test.intent).not.toHaveBeenCalled()
    expect(test.confirm).not.toHaveBeenCalled()
  })

  it('skips Stripe for a pending zero-amount sibling and still charges the paid child', async () => {
    const test = setup(['free', 'paid'])
    test.current.set('free', {
      ...enrollment('free'),
      payments: [{ ...enrollment('free').payments[0], amount: 0 }],
    })
    test.confirm.mockImplementation(async () => {
      test.current.set('paid', enrollment('paid', true))
      return 'completed'
    })
    const result = await processEnrollmentPayments(
      ['free', 'paid'],
      test.adapter,
      test.progress,
      undefined,
      test.services,
    )
    expect(test.intent).toHaveBeenCalledExactlyOnceWith('paid')
    expect(result.completed).toBe(1)
    expect(result.total).toBe(2)
  })

  it('rejects canceled enrollments and cash payments without opening a card flow', async () => {
    for (const row of [
      { ...enrollment('first'), status: 'CANCELLED' as const },
      {
        ...enrollment('first'),
        payments: [{ ...enrollment('first').payments[0], method: 'CASH' as const }],
      },
    ]) {
      const test = setup(['first'])
      test.current.set('first', row)
      const result = await processEnrollmentPayments(
        ['first'],
        test.adapter,
        test.progress,
        undefined,
        test.services,
      )
      expect(result.outcome).toBe('failed')
      expect(test.intent).not.toHaveBeenCalled()
      expect(test.confirm).not.toHaveBeenCalled()
    }
  })

  it('deduplicates enrollment IDs and preserves saved billing information', async () => {
    const test = setup(['first'])
    test.confirm.mockImplementation(async () => {
      test.current.set('first', enrollment('first', true))
      return 'completed'
    })
    const result = await processEnrollmentPayments(
      ['first', 'first'],
      test.adapter,
      test.progress,
      undefined,
      test.services,
    )
    expect(result.total).toBe(1)
    expect(test.intent).toHaveBeenCalledExactlyOnceWith('first')
    expect(test.confirm).toHaveBeenCalledExactlyOnceWith({
      clientSecret: 'first-secret',
      billing: {
        name: 'Părinte Audit',
        email: 'audit@example.test',
        addressLine1: 'Strada Audit 1',
        city: 'Timișoara',
        postalCode: '300001',
      },
    })
  })
})
