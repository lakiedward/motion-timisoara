import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

import { ClubTeam } from './ClubTeam'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }))

function coach(id: string, name: string, hidden = false) {
  return {
    id,
    user_id: `user-${id}`,
    bio: null,
    avatar_url: null,
    photo_storage_path: null,
    hidden_from_public: hidden,
    profile: { id: `user-${id}`, name, avatar_url: null },
    coach_sports: [{ sport: { id: 's1', code: 'tri', name: 'Triatlon' } }],
  }
}

function answer(result: { data: unknown; error: unknown }) {
  const eq = vi.fn().mockResolvedValue(result)
  mocks.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) })
  return eq
}

function renderTeam() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ClubTeam clubId="club-1" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => mocks.from.mockReset())

test('the founder comes first with the Fondator badge, hidden coaches stay out', async () => {
  const eq = answer({
    data: [
      { is_head: false, coach: coach('c2', 'Ana Popescu') },
      { is_head: true, coach: coach('c1', 'Titus Păun') },
      { is_head: false, coach: coach('c3', 'Ascuns', true) },
      { is_head: false, coach: null },
    ],
    error: null,
  })
  renderTeam()
  await screen.findByText('Titus Păun')
  const section = screen.getByRole('region', { name: 'Antrenorii clubului' })
  expect(eq).toHaveBeenCalledWith('club_id', 'club-1')
  const links = within(section).getAllByRole('link')
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/antrenori/user-c1',
    '/antrenori/user-c2',
  ])
  expect(within(links[0]).getByText('Fondator')).toBeVisible()
  expect(within(links[1]).queryByText('Fondator')).toBeNull()
})

test('a club without public coaches shows no team section', async () => {
  answer({ data: [{ is_head: false, coach: coach('c3', 'Ascuns', true) }], error: null })
  const { container } = renderTeam()
  await vi.waitFor(() => expect(container.querySelector('[role="status"]')).toBeNull())
  expect(screen.queryByText('Antrenorii clubului')).toBeNull()
})

test('a failed load offers a retry', async () => {
  answer({ data: null, error: new Error('down') })
  renderTeam()
  expect(await screen.findByText('Nu am putut încărca antrenorii clubului.')).toBeVisible()
  answer({ data: [{ is_head: true, coach: coach('c1', 'Titus Păun') }], error: null })
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('Fondator')).toBeVisible()
})
