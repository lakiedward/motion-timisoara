import { describe, expect, it } from 'vitest'
import { locationWriteErrorMessage, SHARED_LOCATION_GUARD_HINT } from './shared-location-guard'

const fallback = 'Nu am putut salva locația.'

describe('locationWriteErrorMessage', () => {
  it('shows the guard message when the database blocks a shared location', () => {
    const error = {
      message: 'Locația „Bazin” e folosită și de: Antrenor Spec 504.',
      hint: SHARED_LOCATION_GUARD_HINT,
      code: 'P0001',
    }
    expect(locationWriteErrorMessage(error, fallback)).toBe(error.message)
  })

  it('keeps the generic message for other errors', () => {
    expect(locationWriteErrorMessage({ message: 'permission denied', hint: null }, fallback)).toBe(
      fallback,
    )
    expect(locationWriteErrorMessage(new Error('network'), fallback)).toBe(fallback)
    expect(locationWriteErrorMessage(null, fallback)).toBe(fallback)
    expect(
      locationWriteErrorMessage({ hint: SHARED_LOCATION_GUARD_HINT, message: ' ' }, fallback),
    ).toBe(fallback)
  })
})
