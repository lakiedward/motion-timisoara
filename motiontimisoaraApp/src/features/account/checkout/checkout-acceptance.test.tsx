import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import TermsPage from '@/features/public/TermsPage'
import {
  TERMS_SHA256,
  TERMS_VERSION as SERVER_TERMS_VERSION,
} from '../../../../../supabase/functions/_shared/terms-version.ts'
import {
  TERMS_VERSION,
  acceptanceResetCode,
  rulesFingerprint,
  sha256Hex,
  termsTextForHash,
} from './checkout-acceptance'

test('amprenta termenilor corespunde textului afișat pe /termeni', async () => {
  const { container } = render(
    <MemoryRouter>
      <TermsPage />
    </MemoryRouter>,
  )
  const hash = await sha256Hex(termsTextForHash(container.textContent ?? ''))
  expect(hash, 'Textul termenilor s-a schimbat: crește TERMS_VERSION și actualizează TERMS_SHA256').toBe(
    TERMS_SHA256,
  )
})

test('serverul înregistrează aceeași versiune a termenilor ca pagina', () => {
  expect(SERVER_TERMS_VERSION).toBe(TERMS_VERSION)
})

test('amprenta regulamentului: fișierul are prioritate, textul se compară fără spații la capete', async () => {
  expect(await rulesFingerprint('club/regulament.pdf', 'text')).toBe('file:club/regulament.pdf')
  expect(await rulesFingerprint(null, '  Regulament  ')).toBe(
    `text:${await sha256Hex('Regulament')}`,
  )
  expect(await rulesFingerprint(null, '   ')).toBe('none')
  expect(await rulesFingerprint(undefined, null)).toBe('none')
})

test('după o schimbare de preț, termeni sau regulament se cere din nou confirmarea', () => {
  expect(acceptanceResetCode('PRICE_CHANGED')).toBe(true)
  expect(acceptanceResetCode('RULES_CHANGED')).toBe(true)
  expect(acceptanceResetCode('TERMS_CHANGED')).toBe(true)
  expect(acceptanceResetCode('FORBIDDEN')).toBe(false)
  expect(acceptanceResetCode(undefined)).toBe(false)
})
