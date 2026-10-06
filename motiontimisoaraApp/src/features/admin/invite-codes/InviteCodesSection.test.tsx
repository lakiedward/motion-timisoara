import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, test, vi } from 'vitest'

import { inviteCodeStatus } from '@/api/admin'
import AdminInviteCodesPage from '../AdminInviteCodesPage'

const mocks = vi.hoisted(() => ({
  getCodes: vi.fn(),
  generate: vi.fn(),
  deleteCode: vi.fn(),
  createCoach: vi.fn(),
  copy: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock('@/api/admin', async (original) => ({
  ...(await original<typeof import('@/api/admin')>()),
  getCoachInviteCodes: mocks.getCodes,
  generateCoachInviteCode: mocks.generate,
  deleteInviteCode: mocks.deleteCode,
  createCoachAccount: mocks.createCoach,
}))
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }))

const firstCode = {
  id: 'first-row',
  code: 'SYNTHETIC-ONE',
  current_uses: 0,
  max_uses: 2,
  expires_at: null,
}
const secondCode = {
  id: 'second-row',
  code: 'SYNTHETIC-TWO',
  current_uses: 1,
  max_uses: 1,
  expires_at: null,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <AdminInviteCodesPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getCodes.mockResolvedValue([firstCode, secondCode])
  mocks.generate.mockResolvedValue('SYNTHETIC-NEW')
  mocks.copy.mockResolvedValue(undefined)
  mocks.deleteCode.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: mocks.copy },
  })
})

test('page hierarchy and active/used/expired states remain readable', async () => {
  mocks.getCodes.mockResolvedValue([
    ...(await mocks.getCodes()),
    { ...firstCode, id: 'expired', code: 'SYNTHETIC-EXPIRED', expires_at: '2000-01-01T12:30:00Z' },
  ])
  renderPage()
  expect(screen.getByRole('heading', { level: 1, name: 'Coduri și antrenori' })).toBeVisible()
  expect(screen.getByRole('heading', { level: 2, name: 'Adaugă antrenor direct' })).toBeVisible()
  expect(await screen.findByText('Activ · 0/2')).toBeVisible()
  expect(screen.getByText('Folosit')).toBeVisible()
  expect(screen.getByText('Expirat')).toBeVisible()
  expect(inviteCodeStatus(firstCode)).toBe('active')
  expect(screen.getByText(/Expirat pe/)).toHaveTextContent(/\d{2}:\d{2}/)
})

test('loading and error do not report an empty list, retry recovers', async () => {
  const request = deferred<never[]>()
  mocks.getCodes.mockReturnValueOnce(request.promise)
  renderPage()
  expect(screen.getByRole('status', { name: 'Se încarcă codurile' })).toBeVisible()
  expect(screen.queryByText(/Niciun cod/)).not.toBeInTheDocument()
  await act(async () => request.reject(new Error('Rejected')))
  expect(await screen.findByText('Nu am putut încărca codurile.')).toBeVisible()
  expect(screen.queryByText(/Niciun cod/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('SYNTHETIC-ONE')).toBeVisible()
})

test('confirmed empty response shows the empty state', async () => {
  mocks.getCodes.mockResolvedValue([])
  renderPage()
  expect(await screen.findByText(/Niciun cod/)).toBeVisible()
})

test.each(['0', '-1', '1.5', ''])('invalid max uses %s prevents generation', async (value) => {
  renderPage()
  fireEvent.change(screen.getByLabelText('Număr maxim de utilizări'), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Generează cod' }))
  expect(await screen.findByText(/Introdu un număr întreg/)).toBeVisible()
  expect(mocks.generate).not.toHaveBeenCalled()
})

test('past expiry prevents generation; future expiry passes its ISO instant', async () => {
  renderPage()
  fireEvent.change(screen.getByLabelText('Expiră la (opțional)'), {
    target: { value: '2000-01-01T12:00' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Generează cod' }))
  expect(await screen.findByText('Alege o dată și o oră în viitor.')).toBeVisible()
  expect(mocks.generate).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Expiră la (opțional)'), {
    target: { value: '2099-01-01T12:00' },
  })
  fireEvent.change(screen.getByLabelText('Număr maxim de utilizări'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Generează cod' }))
  await waitFor(() =>
    expect(mocks.generate).toHaveBeenCalledWith(3, new Date('2099-01-01T12:00').toISOString()),
  )
})

test('partial native datetime blocks generation while a truly empty expiry remains optional', async () => {
  renderPage()
  const expiry = screen.getByLabelText('Expiră la (opțional)')
  const form = expiry.closest('form')!
  Object.defineProperty(expiry, 'validity', {
    configurable: true,
    value: { badInput: true },
  })
  fireEvent.submit(form)
  expect(
    await screen.findByText('Completează data și ora expirării sau golește câmpul.'),
  ).toBeVisible()
  expect(expiry).toHaveAttribute('aria-invalid', 'true')
  expect(mocks.generate).not.toHaveBeenCalled()
  Object.defineProperty(expiry, 'validity', {
    configurable: true,
    value: { badInput: false },
  })
  expect(expiry).toHaveValue('')
  fireEvent.submit(form)
  await waitFor(() => expect(mocks.generate).toHaveBeenCalledWith(1, null))
  expect(
    screen.queryByText('Completează data și ora expirării sau golește câmpul.'),
  ).not.toBeInTheDocument()
})

test('generation rejects duplicates while pending and retains values on failure', async () => {
  const request = deferred<string>()
  mocks.generate.mockReturnValue(request.promise)
  renderPage()
  fireEvent.change(screen.getByLabelText('Număr maxim de utilizări'), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: 'Generează cod' }))
  const pending = await screen.findByRole('button', { name: 'Se generează…' })
  fireEvent.click(pending)
  expect(mocks.generate).toHaveBeenCalledTimes(1)
  await act(async () => request.reject(new Error('Rejected')))
  expect(await screen.findByText('Nu am putut genera codul. Încearcă din nou.')).toBeVisible()
  expect(screen.getByLabelText('Număr maxim de utilizări')).toHaveValue(4)
  expect(screen.getByRole('button', { name: 'Generează cod' })).toBeEnabled()
})

test('clipboard failure keeps the newly created code visible without false copy success', async () => {
  mocks.copy.mockRejectedValue(new Error('Denied'))
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Generează cod' }))
  expect(await screen.findByText('SYNTHETIC-NEW')).toBeVisible()
  await waitFor(() =>
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Nu am putut copia')),
  )
  expect(mocks.success).toHaveBeenCalledWith('Cod generat.')
  expect(mocks.success).not.toHaveBeenCalledWith('Cod generat copiat.')
  expect(screen.getByRole('button', { name: 'Copiază codul nou' })).toBeEnabled()
})

test('existing-code copy confirms only after the clipboard resolves', async () => {
  const request = deferred<void>()
  mocks.copy.mockReturnValue(request.promise)
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Copiază codul invitație 1' }))
  expect(mocks.copy).toHaveBeenCalledWith('SYNTHETIC-ONE')
  expect(mocks.success).not.toHaveBeenCalledWith('Cod copiat.')
  await act(async () => request.resolve())
  await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Cod copiat.'))
})

test('deletion keeps its target and preserves the row on backend failure', async () => {
  const request = deferred<void>()
  mocks.deleteCode.mockReturnValue(request.promise)
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Șterge codul invitație 1' }))
  const other = await screen.findByRole('button', { name: 'Șterge codul invitație 2' })
  expect(other).toBeDisabled()
  fireEvent.click(other)
  expect(mocks.deleteCode).toHaveBeenCalledTimes(1)
  expect(mocks.deleteCode).toHaveBeenCalledWith('first-row', expect.anything())
  await act(async () => request.reject(new Error('Rejected')))
  expect(await screen.findByText('Nu am putut șterge codul. Codul rămâne în listă.')).toBeVisible()
  expect(screen.getByText('SYNTHETIC-ONE')).toBeVisible()
})

test('invalid coach values show linked errors without sending a request', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Creează antrenor' }))
  expect(await screen.findByText('Minim 2 caractere')).toBeVisible()
  expect(screen.getByLabelText('Nume')).toHaveAttribute('aria-describedby', 'coach-name-error')
  expect(screen.getByText('Email invalid')).toBeVisible()
  expect(mocks.createCoach).not.toHaveBeenCalled()
})

test('coach partial-profile failure retains input, hides credentials and allows retry', async () => {
  const request = deferred<never>()
  mocks.createCoach.mockReturnValue(request.promise)
  renderPage()
  fireEvent.change(screen.getByLabelText('Nume'), { target: { value: 'Test Coach' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'coach@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Creează antrenor' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Se creează…' }))
  expect(mocks.createCoach).toHaveBeenCalledTimes(1)
  expect(mocks.createCoach).toHaveBeenCalledWith({
    name: 'Test Coach',
    email: 'coach@example.test',
    phone: undefined,
  })
  await act(async () => request.reject(new Error('Profilul nu a putut fi creat.')))
  expect(await screen.findByText('Profilul nu a putut fi creat.')).toBeVisible()
  expect(screen.getByLabelText('Nume')).toHaveValue('Test Coach')
  expect(screen.queryByText('Parolă temporară:')).not.toBeInTheDocument()
})

test('successful coach result and temporary-password copying use the returned value', async () => {
  mocks.createCoach.mockResolvedValue({
    userId: 'synthetic',
    email: 'coach@example.test',
    tempPassword: 'synthetic-only-value',
  })
  renderPage()
  fireEvent.change(screen.getByLabelText('Nume'), { target: { value: 'Test Coach' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'coach@example.test' } })
  fireEvent.change(screen.getByLabelText('Telefon (opțional)'), {
    target: { value: '+40 arbitrary text' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Creează antrenor' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Copiază parola temporară' }))
  expect(mocks.copy).toHaveBeenCalledWith('synthetic-only-value')
  await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Parolă copiată.'))
})

test('a later coach failure preserves credentials from the last successful creation', async () => {
  mocks.createCoach
    .mockResolvedValueOnce({
      userId: 'synthetic',
      email: 'coach@example.test',
      tempPassword: 'synthetic-only-value',
    })
    .mockRejectedValueOnce(new Error('Next creation rejected'))
  renderPage()
  fireEvent.change(screen.getByLabelText('Nume'), { target: { value: 'First Coach' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'coach@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Creează antrenor' }))
  expect(await screen.findByText('Ultimul antrenor creat: coach@example.test')).toBeVisible()
  fireEvent.change(screen.getByLabelText('Nume'), { target: { value: 'Next Coach' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'next@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Creează antrenor' }))
  expect(await screen.findByText('Next creation rejected')).toBeVisible()
  expect(screen.getByText('synthetic-only-value')).toBeVisible()
})

test('repeated submit events keep the coach operation visibly pending until completion', async () => {
  const request = deferred<never>()
  mocks.createCoach.mockReturnValue(request.promise)
  renderPage()
  fireEvent.change(screen.getByLabelText('Nume'), { target: { value: 'Test Coach' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'coach@example.test' } })
  const form = screen.getByLabelText('Nume').closest('form')!
  fireEvent.submit(form)
  await screen.findByRole('button', { name: 'Se creează…' })
  fireEvent.submit(form)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Se creează…' })).toBeDisabled())
  expect(mocks.createCoach).toHaveBeenCalledTimes(1)
  await act(async () => request.reject(new Error('Rejected')))
})
