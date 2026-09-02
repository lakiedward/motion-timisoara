import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { vi } from 'vitest'

import ChildQrPage from './ChildQrPage'
import { getChild, regenereazaCodulCopilului } from '@/api/account'
import { useAuth } from '@/lib/auth-context'

vi.mock('@/api/account', () => ({ getChild: vi.fn(), regenereazaCodulCopilului: vi.fn() }))
vi.mock('@/lib/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const TOKEN = '3f1c2a9e8b7d4c6f5a2e1d0c9b8a7f6e'
const TOKEN_NOU = 'aaaaaaaabbbbbbbbccccccccdddddddd'
const COPIL = { id: 'c1', name: 'Bogdan Ștefan', birth_date: '2018-03-04', qr_token: TOKEN, parent_id: 'p1' }

function renderPagina(ruta = '/account/child/c1/qr') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/account/child/:id/qr" element={<ChildQrPage inapoi="/account/children" />} />
          <Route path="/coach/children/:id/qr" element={<ChildQrPage inapoi="/coach/attendance" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'p1', role: 'PARENT' } } as never)
  vi.mocked(getChild).mockResolvedValue(COPIL as never)
  vi.mocked(QRCode.toDataURL).mockImplementation(async (text) => `data:image/png;base64,${String(text)}` as never)
})

test('codul se desenează din token, cu prefixul versiunii, și poartă numele copilului', async () => {
  renderPagina()

  expect(await screen.findByRole('heading', { name: 'Codul QR al lui Bogdan Ștefan' })).toBeInTheDocument()
  const img = await screen.findByRole('img', { name: 'Codul QR al lui Bogdan Ștefan' })
  expect(img).toHaveAttribute('src', `data:image/png;base64,MT1:${TOKEN}`)
  expect(QRCode.toDataURL).toHaveBeenCalledWith(`MT1:${TOKEN}`, expect.objectContaining({ errorCorrectionLevel: 'M' }))
  // Numele fișierului salvat: fără diacritice, ca slugurile din restul aplicației.
  expect(screen.getByRole('link', { name: /Salvează imaginea/ })).toHaveAttribute('download', 'cod-qr-bogdan-stefan.png')
})

test('părintele generează un cod nou, iar codul de pe ecran se schimbă fără a doua citire', async () => {
  const user = userEvent.setup()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.mocked(regenereazaCodulCopilului).mockResolvedValue(TOKEN_NOU)
  renderPagina()

  await screen.findByRole('img', { name: /Codul QR/ })
  await user.click(screen.getByRole('button', { name: /Generează un cod nou/ }))

  expect(regenereazaCodulCopilului).toHaveBeenCalledWith('c1')
  await waitFor(() =>
    expect(screen.getByRole('img', { name: /Codul QR/ })).toHaveAttribute('src', `data:image/png;base64,MT1:${TOKEN_NOU}`),
  )
  // Copilul NU s-a recitit: tokenul nou a venit din răspunsul funcției.
  expect(getChild).toHaveBeenCalledTimes(1)
})

test('refuzul confirmării nu generează nimic', async () => {
  const user = userEvent.setup()
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  renderPagina()

  await screen.findByRole('img', { name: /Codul QR/ })
  await user.click(screen.getByRole('button', { name: /Generează un cod nou/ }))

  expect(regenereazaCodulCopilului).not.toHaveBeenCalled()
})

// Antrenorul vede codul (rezerva când părintele n-are telefonul), dar nu-l
// poate schimba: regenerarea e a părintelui, baza o refuză oricum.
test('antrenorul vede codul copilului înscris, fără butonul de regenerare', async () => {
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'a1', role: 'COACH' } } as never)
  renderPagina('/coach/children/c1/qr')

  expect(await screen.findByRole('img', { name: /Codul QR/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Generează un cod nou/ })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Înapoi/ })).toHaveAttribute('href', '/coach/attendance')
})

test('un copil pe care nu-l vezi nu deschide un cod', async () => {
  vi.mocked(getChild).mockResolvedValue(null)
  renderPagina()

  expect(await screen.findByText('Copilul nu a fost găsit.')).toBeInTheDocument()
  expect(QRCode.toDataURL).not.toHaveBeenCalled()
})

// O citire căzută nu e un copil inexistent: are reîncercare.
test('o citire căzută arată eroarea, cu reîncercare', async () => {
  vi.mocked(getChild).mockRejectedValueOnce(new Error('rețea')).mockResolvedValueOnce(COPIL as never)
  const user = userEvent.setup()
  renderPagina()

  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca copilul.')
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByRole('img', { name: /Codul QR/ })).toBeInTheDocument()
})
