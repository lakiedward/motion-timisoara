import { describe, expect, test } from 'vitest'
import {
  competitionAdvanceHint,
  participantKey,
  validBirthDate,
} from './competition-registration-flow'

const base = {
  step: 'Participanți',
  selectionCount: 1,
  includeSelf: false,
  selfComplete: true,
  checking: false,
  pricesReady: true,
  accepted: false,
}

describe('competitionAdvanceHint', () => {
  test('cere un participant când nu e ales nimeni', () => {
    expect(competitionAdvanceHint({ ...base, selectionCount: 0 })).toBe(
      'Alege cel puțin un participant ca să continui.',
    )
  })

  test('cere data nașterii și categoria pentru înscrierea proprie', () => {
    expect(
      competitionAdvanceHint({
        ...base,
        selectionCount: 0,
        includeSelf: true,
        selfComplete: false,
      }),
    ).toBe('Completează data nașterii și categoria ta ca să continui.')
  })

  test('spune că verifică prețul și apoi ce categorie nu e potrivită', () => {
    expect(competitionAdvanceHint({ ...base, checking: true, pricesReady: false })).toBe(
      'Verificăm categoria și prețul…',
    )
    expect(competitionAdvanceHint({ ...base, pricesReady: false })).toBe(
      'Alege o categorie potrivită pentru fiecare participant ca să continui.',
    )
  })

  test('nu arată nimic când pasul e complet', () => {
    expect(competitionAdvanceHint(base)).toBeNull()
  })

  test('folosește textele cursului pe Detalii și Facturare', () => {
    expect(competitionAdvanceHint({ ...base, step: 'Detalii' })).toBe(
      'Bifează confirmarea sumei ca să continui.',
    )
    expect(competitionAdvanceHint({ ...base, step: 'Detalii', accepted: true })).toBeNull()
    expect(competitionAdvanceHint({ ...base, step: 'Facturare' })).toBe(
      'Completează toate datele de facturare ca să continui.',
    )
  })
})

describe('helperi selecție', () => {
  test('cheia participantului e copilul sau self', () => {
    expect(participantKey({ childId: 'c1', categoryId: 'k' })).toBe('c1')
    expect(participantKey({ selfBirthDate: '1990-01-01', categoryId: 'k' })).toBe('self')
  })

  test('data nașterii trebuie să fie validă și din trecut', () => {
    expect(validBirthDate('1990-02-28')).toBe(true)
    expect(validBirthDate('1990-02-30')).toBe(false)
    expect(validBirthDate('2999-01-01')).toBe(false)
  })
})
