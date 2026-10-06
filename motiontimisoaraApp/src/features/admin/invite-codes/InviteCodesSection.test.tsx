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

function renderPage(openForms = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const result = render(
    <QueryClientProvider client={client}>
      <AdminInviteCodesPage />
    </QueryClientProvider>,
  )
  if (openForms) {
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă antrenor' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cod nou' }))
  }
  return result
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
  expect(await screen.findByText('Activ')).toBeVisible()
  expect(screen.getAllByText('Utilizări: 0/2')).toHaveLength(2)
  expect(screen.getByText('Utilizări: 1/1')).toBeVisible()
  expect(screen.getAllByText('Fără expirare')).toHaveLength(2)
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
  expect(await screen.findByText('Nu am putut genera un cod nou. Încearcă din nou.')).toBeVisible()
  expect(screen.getByLabelText('Număr maxim de utilizări')).toHaveValue(4)
  expect(screen.getByRole('button', { name: 'Generează cod' })).toBeEnabled()
})

test('clipboard failure keeps the newly created code visible without false copy success', async () => {
  mocks.copy.mockRejectedValue(new Error('Denied'))
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Generează cod' }))
  expect(await screen.findByText('SYNTHETIC-NEW')).toBeVisible()
  expect(await screen.findByText(/Nu am putut copia/)).toBeVisible()
  expect(screen.getByText('Cod generat.')).toBeVisible()
  expect(screen.queryByText('Codul nou a fost copiat.')).not.toBeInTheDocument()
  expect(mocks.success).not.toHaveBeenCalled()
  expect(mocks.error).not.toHaveBeenCalled()
  expect(mocks.error).not.toHaveBeenCalledWith('Nu am putut genera un cod nou. Încearcă din nou.')
  expect(
    screen.queryByText('Nu am putut genera un cod nou. Încearcă din nou.'),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Generează cod' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Copiază codul nou' })).toBeEnabled()
})

test('existing-code copy confirms only after the clipboard resolves', async () => {
  const request = deferred<void>()
  mocks.copy.mockReturnValue(request.promise)
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Copiază codul invitație 1' }))
  expect(mocks.copy).toHaveBeenCalledWith('SYNTHETIC-ONE')
  expect(screen.queryByText('Codul existent a fost copiat.')).not.toBeInTheDocument()
  await act(async () => request.resolve())
  expect(await screen.findByText('Codul existent a fost copiat.')).toBeVisible()
})

test('copying an existing code after generation fails keeps the generation error visible', async () => {
  mocks.generate.mockRejectedValue(new Error('Rejected'))
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Generează cod' }))
  const generationError = await screen.findByText(
    'Nu am putut genera un cod nou. Încearcă din nou.',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Copiază codul invitație 1' }))
  expect(await screen.findByText('Codul existent a fost copiat.')).toBeVisible()
  expect(mocks.copy).toHaveBeenCalledWith('SYNTHETIC-ONE')
  expect(generationError).toBeVisible()
  expect(screen.queryByText('Cod nou:')).not.toBeInTheDocument()
  expect(mocks.success).not.toHaveBeenCalledWith('Cod generat.')
  expect(mocks.success).not.toHaveBeenCalledWith('Codul nou a fost copiat.')
  expect(mocks.generate).toHaveBeenCalledTimes(1)
})

test('successful generation automatically copies the new code and supports a later explicit copy', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Generează cod' }))
  expect(await screen.findByText('SYNTHETIC-NEW')).toBeVisible()
  expect(await screen.findByText('Codul nou a fost copiat.')).toBeVisible()
  expect(mocks.copy).toHaveBeenCalledWith('SYNTHETIC-NEW')
  mocks.copy.mockClear()
  mocks.success.mockClear()
  fireEvent.click(screen.getByRole('button', { name: 'Copiază codul nou' }))
  expect(await screen.findByText('Codul nou a fost copiat.')).toBeVisible()
  expect(mocks.copy).toHaveBeenCalledWith('SYNTHETIC-NEW')
  expect(mocks.generate).toHaveBeenCalledTimes(1)
})

test('an unresolved clipboard operation does not keep generation pending or block another generation', async () => {
  const clipboard = deferred<void>()
  mocks.copy.mockReturnValueOnce(clipboard.promise)
  mocks.generate.mockResolvedValueOnce('SYNTHETIC-NEW').mockResolvedValueOnce('SYNTHETIC-NEXT')
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Generează cod' }))
  expect(await screen.findByText('SYNTHETIC-NEW')).toBeVisible()
  await waitFor(() => expect(mocks.copy).toHaveBeenCalledWith('SYNTHETIC-NEW'))
  expect(screen.getByRole('button', { name: 'Generează cod' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Generează cod' }))
  expect(await screen.findByText('SYNTHETIC-NEXT')).toBeVisible()
  expect(mocks.generate).toHaveBeenCalledTimes(2)
  await act(async () => clipboard.resolve())
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
  expect(await screen.findByText('Parolă copiată.')).toBeVisible()
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

test('initial view shows both workflows and invitation list with closed forms', async () => {
  renderPage(false)
  expect(screen.getByRole('button', { name: 'Adaugă antrenor' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  expect(screen.getByRole('button', { name: 'Cod nou' })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByLabelText('Nume')).not.toBeVisible()
  expect(screen.getByLabelText('Număr maxim de utilizări')).not.toBeVisible()
  expect(await screen.findByText('SYNTHETIC-ONE')).toBeVisible()
  expect(
    screen.getByText('Trimite codul unui antrenor ca să își creeze singur contul.'),
  ).toBeVisible()
})

test('coach disclosure retains values and validation, and manages focus', async () => {
  renderPage(false)
  const name = screen.getByLabelText('Nume')
  fireEvent.click(screen.getByRole('button', { name: 'Adaugă antrenor' }))
  await waitFor(() => expect(name).toHaveFocus())
  fireEvent.change(name, { target: { value: 'Entered Coach' } })
  fireEvent.click(screen.getByRole('button', { name: 'Creează antrenor' }))
  expect(await screen.findByText('Email invalid')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Închide formularul' }))
  const toggle = screen.getByRole('button', { name: 'Adaugă antrenor' })
  expect(toggle).toHaveFocus()
  expect(name).not.toBeVisible()
  expect(name).toHaveValue('Entered Coach')
  fireEvent.click(toggle)
  expect(name).toBe(screen.getByLabelText('Nume'))
  expect(screen.getByText('Email invalid')).toBeVisible()
  await waitFor(() => expect(name).toHaveFocus())
})

test('generator disclosure retains settings and returns focus to its toggle', async () => {
  renderPage(false)
  fireEvent.click(screen.getByRole('button', { name: 'Cod nou' }))
  const maximum = screen.getByLabelText('Număr maxim de utilizări')
  await waitFor(() => expect(maximum).toHaveFocus())
  fireEvent.change(maximum, { target: { value: '5' } })
  fireEvent.change(screen.getByLabelText('Expiră la (opțional)'), {
    target: { value: '2099-01-01T12:00' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Închide setările' }))
  const toggle = screen.getByRole('button', { name: 'Cod nou' })
  expect(toggle).toHaveFocus()
  expect(maximum).not.toBeVisible()
  fireEvent.click(toggle)
  expect(maximum).toHaveValue(5)
  expect(screen.getByLabelText('Expiră la (opțional)')).toHaveValue('2099-01-01T12:00')
  await waitFor(() => expect(maximum).toHaveFocus())
})

test('pending creation disables collapse and successful credentials stay visible after collapse', async () => {
  const request = deferred<{ userId: string; email: string; tempPassword: string }>()
  mocks.createCoach.mockReturnValue(request.promise)
  renderPage()
  fireEvent.change(screen.getByLabelText('Nume'), { target: { value: 'Test Coach' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'coach@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Creează antrenor' }))
  expect(await screen.findByRole('button', { name: 'Închide formularul' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Închide formularul' }))
  expect(screen.getByLabelText('Nume')).toBeVisible()
  await act(async () =>
    request.resolve({
      userId: 'synthetic',
      email: 'coach@example.test',
      tempPassword: 'synthetic-only-value',
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Închide formularul' }))
  expect(screen.getByText('synthetic-only-value')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Copiază parola temporară' }))
  expect(await screen.findByText('Parolă copiată.')).toBeVisible()
  expect(mocks.success).not.toHaveBeenCalled()
  expect(mocks.error).not.toHaveBeenCalled()
})

test('pending generation disables collapse and its result stays visible after collapse', async () => {
  const request = deferred<string>()
  mocks.generate.mockReturnValue(request.promise)
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Generează cod' }))
  expect(await screen.findByRole('button', { name: 'Închide setările' })).toBeDisabled()
  await act(async () => request.resolve('SYNTHETIC-NEW'))
  expect(await screen.findByText('Codul nou a fost copiat.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Închide setările' }))
  expect(screen.getByText('SYNTHETIC-NEW')).toBeVisible()
  expect(screen.getByText('Cod generat.')).toBeVisible()
  expect(mocks.success).not.toHaveBeenCalled()
  expect(mocks.error).not.toHaveBeenCalled()
})

test('an older clipboard rejection cannot replace the newer code copy success', async () => {
  const clipboard = deferred<void>()
  mocks.copy.mockReturnValueOnce(clipboard.promise)
  mocks.generate.mockResolvedValueOnce('SYNTHETIC-NEW').mockResolvedValueOnce('SYNTHETIC-NEXT')
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Generează cod' }))
  expect(await screen.findByText('SYNTHETIC-NEW')).toBeVisible()
  await waitFor(() => expect(mocks.copy).toHaveBeenCalledWith('SYNTHETIC-NEW'))
  fireEvent.click(screen.getByRole('button', { name: 'Generează cod' }))
  expect(await screen.findByText('SYNTHETIC-NEXT')).toBeVisible()
  expect(await screen.findByText('Codul nou a fost copiat.')).toBeVisible()
  await act(async () => clipboard.reject(new Error('Denied')))
  expect(screen.queryByText(/Nu am putut copia/)).not.toBeInTheDocument()
  expect(screen.getByText('Codul nou a fost copiat.')).toBeVisible()
})
