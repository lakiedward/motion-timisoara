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

test('invalid website, IBAN and CUI are rejected under their fields and nothing is saved', async () => {
  renderPage()
  await screen.findByLabelText('Nume club')
  fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'exemplu' } })
  fireEvent.change(screen.getByLabelText('IBAN'), { target: { value: '123' } })
  fireEvent.change(screen.getByLabelText('CUI'), { target: { value: 'RO12A' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nu-e-email' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(screen.getByLabelText('Website')).toHaveAttribute('aria-invalid', 'true'),
  )
  for (const id of ['website', 'bank_account', 'company_cui', 'email'])
    expect(document.getElementById(id)?.getAttribute('aria-describedby')).toBe(`${id}-error`)
  expect(mocks.updateClub).not.toHaveBeenCalled()
})

test('saving normalizes website, IBAN and CUI', async () => {
  renderPage()
  await screen.findByLabelText('Nume club')
  fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'clubul-tau.ro' } })
  fireEvent.change(screen.getByLabelText('IBAN'), {
    target: { value: 'ro49 aaaa 1b31 0075 9384 0000' },
  })
  fireEvent.change(screen.getByLabelText('CUI'), { target: { value: 'ro 12345678' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mocks.updateClub).toHaveBeenCalled())
  expect(mocks.updateClub.mock.calls[0][1]).toMatchObject({
    website: 'https://clubul-tau.ro',
    bank_account: 'RO49AAAA1B31007593840000',
    company_cui: 'RO12345678',
  })
  await waitFor(() => expect(screen.getByLabelText('Website')).toHaveValue('https://clubul-tau.ro'))
  expect(screen.getByLabelText('IBAN')).toHaveValue('RO49AAAA1B31007593840000')
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
  expect(screen.getByText('Folosite pentru facturare. Nu apar public.')).toBeVisible()
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
