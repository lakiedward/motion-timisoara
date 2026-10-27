import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, test, vi } from 'vitest'

import CoachPhotoField from './CoachPhotoField'
import {
  clearMyCoachPhoto,
  getMyCoachPhotoPath,
  setMyCoachPhoto,
} from '@/api/coach-profile/coach-photo'

vi.mock('@/api/coach-profile/coach-photo', () => ({
  getMyCoachPhotoPath: vi.fn(),
  setMyCoachPhoto: vi.fn(),
  clearMyCoachPhoto: vi.fn(),
}))

vi.mock('@/lib/galerie', () => ({
  galeriaSeDeschideNativ: () => false,
  alegeDinGalerie: vi.fn(),
}))

function renderField() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CoachPhotoField name="Laki Antrenor" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getMyCoachPhotoPath).mockReset()
  vi.mocked(setMyCoachPhoto).mockReset()
  vi.mocked(clearMyCoachPhoto).mockReset()
})

test('without a photo it shows the initials and only the pick button', async () => {
  vi.mocked(getMyCoachPhotoPath).mockResolvedValue(null)
  renderField()
  expect(await screen.findByText('LA')).toBeInTheDocument()
  expect(screen.getByText('Fără poză, părinții văd inițialele tale.')).toBeInTheDocument()
  expect(screen.getByLabelText('Alege poza de profil')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Scoate poza' })).not.toBeInTheDocument()
})

test('picking an image uploads it', async () => {
  vi.mocked(getMyCoachPhotoPath).mockResolvedValue(null)
  vi.mocked(setMyCoachPhoto).mockResolvedValue('u1/p.jpg')
  renderField()
  await screen.findByText('Fără poză, părinții văd inițialele tale.')
  const input = screen.getByLabelText('Alege poza de profil')
  const file = new File(['x'], 'poza.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(setMyCoachPhoto).toHaveBeenCalled())
  expect(vi.mocked(setMyCoachPhoto).mock.calls[0][0]).toBe(file)
})

test('with a photo it offers change and remove', async () => {
  vi.mocked(getMyCoachPhotoPath).mockResolvedValue('u1/p.jpg')
  vi.mocked(clearMyCoachPhoto).mockResolvedValue()
  renderField()
  expect(await screen.findByText('Așa te văd părinții pe pagina ta publică.')).toBeInTheDocument()
  expect(screen.getByLabelText('Schimbă poza de profil')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Scoate poza' }))
  await waitFor(() => expect(clearMyCoachPhoto).toHaveBeenCalled())
})

test('a failed upload explains it can be retried', async () => {
  vi.mocked(getMyCoachPhotoPath).mockResolvedValue(null)
  vi.mocked(setMyCoachPhoto).mockRejectedValue(new Error('down'))
  renderField()
  await screen.findByText('Fără poză, părinții văd inițialele tale.')
  const input = screen.getByLabelText('Alege poza de profil')
  fireEvent.change(input, {
    target: { files: [new File(['x'], 'poza.png', { type: 'image/png' })] },
  })
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Nu am putut salva poza. Încearcă din nou.',
  )
})
