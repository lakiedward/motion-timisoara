import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function randeaza() {
  const { default: TermsPage } = await import('../TermsPage')
  return render(
    <MemoryRouter>
      <TermsPage />
    </MemoryRouter>,
  )
}

test('termenii abonamentelor au prețurile, operatorul și regula de anulare', async () => {
  await randeaza()
  const planuri = screen.getByRole('region', { name: /Abonamente: planuri, plată și facturare/ })
  for (const text of [/100 lei/, /199 lei/, /349 lei/, /599 lei/, /nu este plătitor de TVA/]) {
    expect(within(planuri).getByText(text)).toBeInTheDocument()
  }
  expect(within(planuri).getByText(/TITUS CLUB SWIM&FUN S\.R\.L\. \(CUI 49252540/)).toBeInTheDocument()
  expect(within(planuri).getByRole('link', { name: 'Prețuri' })).toHaveAttribute('href', '/preturi')

  const anulare = screen.getByRole('region', {
    name: /Abonamente: anulare, rambursare și expirare/,
  })
  expect(within(anulare).getByText(/efect la sfârșitul perioadei deja plătite/)).toBeInTheDocument()
  expect(within(anulare).getByText(/nu rambursăm parțial luna începută/)).toBeInTheDocument()
  expect(within(anulare).getByText(/reîncearcă plata timp de 7 zile/)).toBeInTheDocument()
})

test('în aplicația nativă termenii abonamentelor lipsesc', async () => {
  vi.stubEnv('VITE_NATIVE_BUILD', '1')
  vi.resetModules()
  await randeaza()
  expect(screen.queryByText(/Abonamente:/)).not.toBeInTheDocument()
  expect(screen.queryByText(/599 lei/)).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: /Contact/ })).toBeInTheDocument()
})
