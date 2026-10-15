import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

import CoachProfilePage from '../CoachProfilePage'

const mocks = vi.hoisted(() => ({
  getCoachByUserId: vi.fn(),
  getCourses: vi.fn(),
  getCoachRatingSummary: vi.fn(),
  getMyCoachRating: vi.fn(),
  submitCoachRating: vi.fn(),
  user: null as { id: string; role: string } | null,
}))
vi.mock('@/api/public', async (original) => ({
  ...(await original<typeof import('@/api/public')>()),
  getCoachByUserId: mocks.getCoachByUserId,
  getCourses: mocks.getCourses,
}))
vi.mock('@/api/ratings', () => ({
  getCoachRatingSummary: mocks.getCoachRatingSummary,
  getMyCoachRating: mocks.getMyCoachRating,
  submitCoachRating: mocks.submitCoachRating,
}))
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: mocks.user }) }))

const coach = {
  id: 'cp-1',
  user_id: 'coach-1',
  bio: 'Antrenor de înot',
  avatar_url: null,
  photo_storage_path: null,
  profile: { id: 'coach-1', name: 'Ana Pop', avatar_url: null },
  coach_sports: [{ sport: { id: 's1', code: 'SWIM', name: 'Înot' } }, { sport: null }],
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/antrenori/coach-1']}>
        <Routes>
          <Route path="/antrenori/:id" element={<CoachProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user = null
  mocks.getCourses.mockResolvedValue([])
  mocks.getCoachRatingSummary.mockResolvedValue({ avg: 0, count: 0 })
  mocks.getMyCoachRating.mockResolvedValue(null)
})

test('the hero shows initials, sport badges and a 44px back link, without a rating when there is none', async () => {
  mocks.getCoachByUserId.mockResolvedValue(coach)
  renderPage()
  expect(await screen.findByRole('heading', { level: 1, name: 'Ana Pop' })).toBeVisible()
  expect(screen.getByText('AP')).toBeVisible()
  expect(screen.getByText('Înot')).toHaveAttribute('data-slot', 'badge')
  expect(screen.getByRole('link', { name: /Înapoi la antrenori/ })).toHaveClass('h-11')
  expect(screen.queryByText(/evaluar/)).toBeNull()
})

test('the rating line agrees with the count', async () => {
  mocks.getCoachByUserId.mockResolvedValue(coach)
  mocks.getCoachRatingSummary.mockResolvedValue({ avg: 4.5, count: 1 })
  renderPage()
  expect(await screen.findByText('4.5 · 1 evaluare')).toBeVisible()
})

test('a load error shows a retry instead of “not found”', async () => {
  mocks.getCoachByUserId.mockRejectedValueOnce(new Error('network')).mockResolvedValue(coach)
  renderPage()
  expect(await screen.findByText('Nu am putut încărca antrenorul.')).toBeVisible()
  expect(screen.queryByText('Antrenorul nu a fost găsit.')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /Reîncearcă/ }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Ana Pop' })).toBeVisible()
})

test('a missing coach shows “not found” with the back link', async () => {
  mocks.getCoachByUserId.mockResolvedValue(null)
  renderPage()
  expect(await screen.findByText('Antrenorul nu a fost găsit.')).toBeVisible()
  expect(screen.getByRole('link', { name: /Înapoi la antrenori/ })).toBeVisible()
})

test('a parent rates with 44px stars', async () => {
  mocks.user = { id: 'p1', role: 'PARENT' }
  mocks.getCoachByUserId.mockResolvedValue(coach)
  mocks.submitCoachRating.mockResolvedValue(undefined)
  renderPage()
  const star = await screen.findByRole('radio', { name: '4 stele' })
  expect(star).toHaveClass('size-11')
  await userEvent.click(star)
  expect(mocks.submitCoachRating).toHaveBeenCalledWith('coach-1', 4)
})
