import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import ForgotPasswordPage from './ForgotPasswordPage'
import { requestPasswordReset } from '@/api/auth'

vi.mock('@/api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/auth')>()),
  requestPasswordReset: vi.fn(),
}))

const mockedReset = vi.mocked(requestPasswordReset)
type ResetResult = Awaited<ReturnType<typeof requestPasswordReset>>

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

test('empty email asks for a required address and does not call recover', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: 'Trimite link' }))

  expect(await screen.findByText('Emailul e obligatoriu')).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  expect(mockedReset).not.toHaveBeenCalled()
})

test('a malformed email shows Email invalid and does not call recover', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.type(screen.getByLabelText('Email'), 'nu-e-email')
  await user.click(screen.getByRole('button', { name: 'Trimite link' }))

  expect(await screen.findByText('Email invalid')).toBeInTheDocument()
  expect(mockedReset).not.toHaveBeenCalled()
})

test('a finished request replaces the form with the neutral banner', async () => {
  const user = userEvent.setup()
  mockedReset.mockResolvedValue({ data: {}, error: null } as ResetResult)
  renderPage()
  await user.type(screen.getByLabelText('Email'), 'nimeni@example.test')
  await user.click(screen.getByRole('button', { name: 'Trimite link' }))

  expect(
    await screen.findByText(
      'Dacă există un cont cu acest email, vei primi în scurt timp un link de resetare.',
    ),
  ).toBeInTheDocument()
  expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  expect(mockedReset).toHaveBeenCalledWith(
    'nimeni@example.test',
    expect.stringMatching(/\/reset-password$/),
  )
})

test('a failed request keeps the form and does not pretend success', async () => {
  const user = userEvent.setup()
  mockedReset.mockResolvedValue({
    data: null,
    error: { message: 'Failed to fetch' },
  } as unknown as ResetResult)
  renderPage()
  await user.type(screen.getByLabelText('Email'), 'nimeni@example.test')
  await user.click(screen.getByRole('button', { name: 'Trimite link' }))

  expect(
    await screen.findByText('Nu am putut trimite linkul. Verifică conexiunea și încearcă din nou.'),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toBeInTheDocument()
  expect(
    screen.queryByText(/Dacă există un cont cu acest email/),
  ).not.toBeInTheDocument()
})

test('the submit button stays disabled for the whole request', async () => {
  const user = userEvent.setup()
  let resolveRequest: (value: ResetResult) => void = () => {}
  mockedReset.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
  )
  renderPage()
  await user.type(screen.getByLabelText('Email'), 'nimeni@example.test')
  await user.click(screen.getByRole('button', { name: 'Trimite link' }))

  const busy = await screen.findByRole('button', { name: 'Se trimite…' })
  expect(busy).toBeDisabled()
  expect(mockedReset).toHaveBeenCalledTimes(1)

  resolveRequest({ data: {}, error: null } as ResetResult)
  await waitFor(() =>
    expect(screen.getByText(/Dacă există un cont cu acest email/)).toBeInTheDocument(),
  )
})

test('the footer link goes back to login', () => {
  renderPage()
  expect(screen.getByRole('link', { name: 'Înapoi la autentificare' })).toHaveAttribute(
    'href',
    '/login',
  )
})
