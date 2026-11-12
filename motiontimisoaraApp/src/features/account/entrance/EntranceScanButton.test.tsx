import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { vi } from 'vitest'

import { EntranceScanButton } from './EntranceScanButton'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/features/coach/attendance/WebScannerSheet', () => ({
  WebScannerSheet: ({
    open,
    hint,
    onDetected,
  }: {
    open: boolean
    hint: string
    onDetected: (text: string) => void
  }) =>
    open ? (
      <div>
        <p>{hint}</p>
        <button onClick={() => onDetected(`https://motionromania.ro/prezenta/${'a'.repeat(32)}`)}>
          foaia
        </button>
        <button onClick={() => onDetected(`MT1:${'b'.repeat(32)}`)}>copil</button>
      </div>
    ) : null,
}))

function renderButton() {
  return render(
    <MemoryRouter initialEntries={['/account/attendance']}>
      <Routes>
        <Route path="/account/attendance" element={<EntranceScanButton />} />
        <Route path="/prezenta/:token" element={<p>pagina de prezență</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.clearAllMocks())

test('codul de pe foaia de la intrare duce la pagina de prezență', async () => {
  renderButton()
  await userEvent.click(screen.getByRole('button', { name: 'Scanează codul de la intrare' }))
  expect(screen.getByText('Încadrează codul de pe foaia lipită la intrare')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'foaia' }))
  expect(screen.getByText('pagina de prezență')).toBeInTheDocument()
})

test('codul unui copil e refuzat cu explicație', async () => {
  renderButton()
  await userEvent.click(screen.getByRole('button', { name: 'Scanează codul de la intrare' }))
  await userEvent.click(screen.getByRole('button', { name: 'copil' }))
  expect(toast.error).toHaveBeenCalledWith(
    'Acesta e codul QR al unui copil. Scanează foaia lipită la intrare.',
  )
  expect(screen.queryByText('pagina de prezență')).not.toBeInTheDocument()
})
