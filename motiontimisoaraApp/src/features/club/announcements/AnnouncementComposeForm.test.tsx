import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import AnnouncementComposeForm from './AnnouncementComposeForm'
import { createClubAnnouncement } from '@/api/club'

vi.mock('@/api/club', () => ({ createClubAnnouncement: vi.fn() }))
vi.mock('@/api/attachments', () => ({ incarcaAtasamente: vi.fn(async () => []) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedCreate = vi.mocked(createClubAnnouncement)

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AnnouncementComposeForm clubId="club-1" audiences={[]} onPublished={vi.fn()} />
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

test('formularul e un Card plat cu titlul „Anunț nou” și unde ajunge anunțul', () => {
  const { container } = renderForm()
  const card = container.querySelector('[data-slot="card"]')!
  expect(card.className).toContain('rounded-xl')
  expect(card.className).not.toContain('shadow')
  expect(screen.getByText('Anunț nou')).toBeInTheDocument()
  expect(screen.getByText('Ajunge la părinți în aplicație și ca notificare.')).toBeInTheDocument()
})

test('erorile au iconița de alertă și cursorul merge pe primul câmp greșit', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.click(screen.getByRole('button', { name: 'Publică' }))
  const title = screen.getByLabelText('Titlu')
  await waitFor(() => expect(title).toHaveFocus())
  const message = document.getElementById(title.getAttribute('aria-describedby')!)!
  expect(message.textContent).toBe('Scrie un titlu de cel puțin 2 caractere')
  expect(message.querySelector('svg')).not.toBeNull()
  expect(screen.getByLabelText('Conținut').tagName).toBe('TEXTAREA')
})

test('cât se publică, butonul e dezactivat și scrie „Se publică…”', async () => {
  const user = userEvent.setup()
  mockedCreate.mockReturnValue(new Promise(() => {}) as never)
  renderForm()
  await user.type(screen.getByLabelText('Titlu'), 'Antrenament')
  await user.type(screen.getByLabelText('Conținut'), 'Azi la bazin')
  await user.click(screen.getByRole('button', { name: 'Publică' }))
  const button = await screen.findByRole('button', { name: 'Se publică…' })
  expect(button).toBeDisabled()
})
