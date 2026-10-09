import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

import ClubProfilePage from './ClubProfilePage'

const mocks = vi.hoisted(() => ({
  getMyClub: vi.fn(),
  updateClub: vi.fn(),
  setImage: vi.fn(),
  clearImage: vi.fn(),
}))
vi.mock('@/api/club', async (original) => ({
  ...(await original<typeof import('@/api/club')>()),
  getMyClub: mocks.getMyClub,
  updateClub: mocks.updateClub,
}))
vi.mock('@/api/club-images', () => ({
  setClubImage: mocks.setImage,
  clearClubImage: mocks.clearImage,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const club = {
  id: 'club-1',
  owner_user_id: 'u',
  name: 'Clubul Exemplu',
  description: 'Descriere',
  website: null,
  email: 'contact@exemplu.ro',
  phone: '0722000000',
  city: 'Timișoara',
  address: null,
  public_email_consent: false,
  company_name: null,
  company_cui: null,
  bank_account: null,
  bank_name: null,
  company_address: null,
  company_reg_number: null,
  logo_storage_path: 'club-1/logo/a.jpg',
  hero_photo_storage_path: null,
  created_at: '2026-01-01T00:00:00Z',
  stripe_account_id: null,
  stripe_charges_enabled: false,
  stripe_onboarding_complete: false,
  stripe_payouts_enabled: false,
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ClubProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getMyClub.mockResolvedValue(club)
  mocks.updateClub.mockResolvedValue(undefined)
  mocks.setImage.mockResolvedValue('club-1/hero/b.jpg')
  mocks.clearImage.mockResolvedValue(undefined)
})

test('a failed load shows an error with retry instead of "Niciun club asociat."', async () => {
  mocks.getMyClub.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(club)
  renderPage()
  expect(await screen.findByText('Nu am putut încărca profilul clubului.')).toBeVisible()
  expect(screen.queryByText('Niciun club asociat.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByLabelText('Nume club')).toHaveValue('Clubul Exemplu')
})

test('invalid website and email are rejected under their fields and nothing is saved', async () => {
  renderPage()
  await screen.findByLabelText('Nume club')
  fireEvent.change(screen.getByLabelText('Website (opțional)'), { target: { value: 'exemplu' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nu-e-email' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(screen.getByLabelText('Website (opțional)')).toHaveAttribute('aria-invalid', 'true'),
  )
  for (const id of ['website', 'email'])
    expect(document.getElementById(id)?.getAttribute('aria-describedby')).toBe(`${id}-error`)
  expect(mocks.updateClub).not.toHaveBeenCalled()
})

test('saving normalizes the website and sends no billing fields', async () => {
  renderPage()
  await screen.findByLabelText('Nume club')
  fireEvent.change(screen.getByLabelText('Website (opțional)'), {
    target: { value: 'clubul-tau.ro' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mocks.updateClub).toHaveBeenCalled())
  expect(mocks.updateClub.mock.calls[0][1].website).toBe('https://clubul-tau.ro')
  expect(mocks.updateClub.mock.calls[0][1]).not.toHaveProperty('bank_account')
  await waitFor(() =>
    expect(screen.getByLabelText('Website (opțional)')).toHaveValue('https://clubul-tau.ro'),
  )
  expect(screen.queryByText('Date facturare')).toBeNull()
})

test('website is optional and an empty one is saved as null', async () => {
  mocks.getMyClub.mockResolvedValue({ ...club, website: 'https://vechi.ro' })
  renderPage()
  const website = await screen.findByLabelText('Website (opțional)')
  fireEvent.change(website, { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mocks.updateClub).toHaveBeenCalled())
  expect(mocks.updateClub.mock.calls[0][1].website).toBeNull()
  expect(website).not.toHaveAttribute('aria-invalid', 'true')
})

test('a failed save keeps what was typed', async () => {
  mocks.updateClub.mockRejectedValueOnce(new Error('boom'))
  renderPage()
  const name = await screen.findByLabelText('Nume club')
  fireEvent.change(name, { target: { value: 'Nume nou' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mocks.updateClub).toHaveBeenCalled())
  expect(name).toHaveValue('Nume nou')
})

test('touch targets, hints, public link and consent row', async () => {
  renderPage()
  await screen.findByLabelText('Nume club')
  expect(screen.getByLabelText('Nume club').className).toContain('min-h-11')
  expect(screen.getByRole('button', { name: 'Salvează' }).className).toContain('min-h-11')
  expect(screen.getByText('Apare pe pagina publică a clubului.')).toBeVisible()
  expect(screen.getByRole('link', { name: /Vezi pagina publică/ })).toHaveAttribute(
    'href',
    '/cluburi/club-1',
  )
  const consent = screen.getByLabelText('Afișează emailul public pe pagina clubului')
  expect(consent.closest('label')?.className).toContain('min-h-11')
})

test('logo can be removed and a cover uploaded', async () => {
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Scoate logo' }))
  await waitFor(() => expect(mocks.clearImage).toHaveBeenCalledWith('club-1', 'logo'))
  const file = new File(['x'], 'coperta.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Alege copertă'), { target: { files: [file] } })
  await waitFor(() => expect(mocks.setImage).toHaveBeenCalledWith('club-1', 'hero', file))
})
