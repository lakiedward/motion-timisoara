import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { vi } from 'vitest'

import CoachEntranceCodePage from './CoachEntranceCodePage'
import {
  EntranceCodeError,
  getCoachEntranceCode,
  rotateCoachEntranceCode,
} from '@/api/attendance/entrance'
import { printEntrancePoster } from './entrance-poster'

vi.mock('@/api/attendance/entrance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/attendance/entrance')>()),
  getCoachEntranceCode: vi.fn(),
  rotateCoachEntranceCode: vi.fn(),
}))
vi.mock('./entrance-poster', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./entrance-poster')>()),
  printEntrancePoster: vi.fn(() => true),
}))
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const TOKEN = '0123456789abcdef0123456789abcdef'
const NEW_TOKEN = 'ffffffffffffffffffffffffffffffff'

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CoachEntranceCodePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(QRCode.toDataURL).mockImplementation(
    async (text) => `data:image/png;base64,${String(text)}` as never,
  )
  vi.mocked(getCoachEntranceCode).mockResolvedValue({
    coachId: 'k1',
    coachName: 'Ana Pop',
    token: TOKEN,
    rotatedAt: '2026-11-12T09:00:00Z',
  })
})

test('codul QR conține linkul de prezență de pe site-ul deschis', async () => {
  renderPage()
  const image = await screen.findByRole('img', {
    name: 'Codul de prezență al antrenorului Ana Pop',
  })
  expect(image).toHaveAttribute(
    'src',
    `data:image/png;base64,${window.location.origin}/prezenta/${TOKEN}`,
  )
  expect(screen.getByRole('heading', { name: 'Codul de la intrare' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Prezență/ })).toHaveAttribute(
    'href',
    '/coach/attendance',
  )
})

test('printarea deschide foaia A4 cu numele antrenorului', async () => {
  renderPage()
  await screen.findByRole('img', { name: /Ana Pop/ })
  await userEvent.click(screen.getByRole('button', { name: 'Printează foaia A4' }))
  expect(printEntrancePoster).toHaveBeenCalledWith(
    `data:image/png;base64,${window.location.origin}/prezenta/${TOKEN}`,
    'Ana Pop',
  )
})

test('regenerarea cere confirmare și înlocuiește codul afișat', async () => {
  vi.mocked(rotateCoachEntranceCode).mockResolvedValue({
    coachId: 'k1',
    coachName: 'Ana Pop',
    token: NEW_TOKEN,
    rotatedAt: '2026-11-12T10:00:00Z',
  })
  renderPage()
  await screen.findByRole('img', { name: /Ana Pop/ })
  await userEvent.click(screen.getByRole('button', { name: 'Generează un cod nou' }))
  expect(rotateCoachEntranceCode).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Generează' }))

  await waitFor(() =>
    expect(screen.getByRole('img', { name: /Ana Pop/ })).toHaveAttribute(
      'src',
      `data:image/png;base64,${window.location.origin}/prezenta/${NEW_TOKEN}`,
    ),
  )
})

test('un cont care nu e antrenor primește o explicație, nu o eroare de rețea', async () => {
  vi.mocked(getCoachEntranceCode).mockRejectedValue(new EntranceCodeError('FORBIDDEN'))
  renderPage()
  expect(
    await screen.findByRole('heading', { name: 'Codul de la intrare e doar pentru antrenori' }),
  ).toBeInTheDocument()
})

test('o eroare de rețea oferă reîncercarea', async () => {
  vi.mocked(getCoachEntranceCode).mockRejectedValue(new Error('Failed to fetch'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca codul.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await waitFor(() => expect(getCoachEntranceCode).toHaveBeenCalledTimes(2))
})
