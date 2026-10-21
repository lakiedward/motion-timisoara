import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { vi } from 'vitest'

import { completeProfile } from '@/api/auth'
import { ProfileCompletionCard } from './ProfileCompletionCard'

const auth = vi.hoisted(() => ({
  user: null as null | { id: string; name: string; needsProfileCompletion: boolean },
  refresh: vi.fn(),
}))

vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }))
vi.mock('@/api/auth', () => ({ completeProfile: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const save = vi.mocked(completeProfile)

function renderCard() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ProfileCompletionCard />
    </QueryClientProvider>,
  )
}

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Completează profilul' }))
  return screen.getByRole('alertdialog', { name: 'Adaugă numărul de telefon' })
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.user = { id: 'parent-3450', name: 'Ana Popescu', needsProfileCompletion: true }
})

test('stays hidden when the parent already has a phone number', () => {
  auth.user = { id: 'parent-3450', name: 'Ana Popescu', needsProfileCompletion: false }
  const { container } = renderCard()
  expect(container).toBeEmptyDOMElement()
})

test('shows a section heading with the reason and no dismiss control', () => {
  renderCard()
  expect(screen.getByRole('heading', { level: 2, name: 'Completează-ți profilul' })).toBeVisible()
  expect(screen.getByText(/ca să te putem contacta despre înscrierile copiilor/)).toBeVisible()
  expect(screen.getAllByRole('button')).toHaveLength(1)
})

test('opens a phone dialog on the dashboard instead of leaving the account', () => {
  renderCard()
  openDialog()
  expect(screen.getByRole('textbox', { name: 'Telefon' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Renunță' })).toBeVisible()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

test('rejects an invalid phone number without saving', () => {
  renderCard()
  openDialog()
  fireEvent.change(screen.getByRole('textbox', { name: 'Telefon' }), { target: { value: '12ab' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(screen.getByText('Număr de telefon invalid')).toBeVisible()
  expect(save).not.toHaveBeenCalled()
})

test('keeps the dialog open with the typed number when saving fails', async () => {
  save.mockResolvedValue({ error: { message: 'denied' } } as never)
  renderCard()
  openDialog()
  fireEvent.change(screen.getByRole('textbox', { name: 'Telefon' }), {
    target: { value: '0722 123 456' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut salva numărul')
  expect(screen.getByRole('textbox', { name: 'Telefon' })).toHaveValue('0722 123 456')
  expect(save).toHaveBeenCalledWith('parent-3450', { name: 'Ana Popescu', phone: '0722123456' })
  expect(auth.refresh).not.toHaveBeenCalled()
})

test('saves, refreshes the profile, confirms and closes the dialog', async () => {
  save.mockResolvedValue({ error: null } as never)
  auth.refresh.mockResolvedValue(null)
  renderCard()
  openDialog()
  fireEvent.change(screen.getByRole('textbox', { name: 'Telefon' }), {
    target: { value: '+40722123456' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Profil actualizat'))
  expect(auth.refresh).toHaveBeenCalled()
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
})
