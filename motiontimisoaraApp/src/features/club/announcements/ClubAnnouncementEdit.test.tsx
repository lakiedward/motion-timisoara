import { vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'

import { updateClubAnnouncement, type ClubAnnouncement } from '@/api/club'
import { ClubAnnouncementList } from './ClubAnnouncementList'

vi.mock('@/api/club', () => ({
  updateClubAnnouncement: vi.fn(),
  setAnnouncementActive: vi.fn(),
  deleteClubAnnouncement: vi.fn(),
}))
vi.mock('@/api/attachments', () => ({ stergeFisiereleAnuntului: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedUpdate = vi.mocked(updateClubAnnouncement)

const anunt = (id: string, title: string, priority = 'NORMAL') =>
  ({
    id,
    title,
    content: `Conținut ${title}`,
    priority,
    is_active: true,
    created_at: '2026-10-21T09:00:00Z',
    audience_kind: 'CLUB',
    audience_id: null,
  }) as ClubAnnouncement

function renderList(onChanged = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ClubAnnouncementList
        items={[anunt('a', 'Antrenament mutat', 'URGENT'), anunt('b', 'Echipament nou')]}
        tinte={[]}
        tinteNecunoscute={false}
        atasamente={{}}
        onChanged={onChanged}
      />
    </QueryClientProvider>,
  )
  return onChanged
}

beforeEach(() => vi.clearAllMocks())

test('„Editează” deschide formularul în card, completat cu anunțul existent', async () => {
  const user = userEvent.setup()
  renderList()
  await user.click(screen.getByRole('button', { name: 'Editează anunțul „Antrenament mutat”' }))
  const form = screen.getByRole('form', { name: 'Editezi anunțul „Antrenament mutat”' })
  expect(within(form).getByLabelText('Titlu')).toHaveValue('Antrenament mutat')
  expect(within(form).getByLabelText('Conținut')).toHaveValue('Conținut Antrenament mutat')
  expect(within(form).getByLabelText('Prioritate')).toHaveValue('URGENT')
  expect(screen.getByRole('heading', { name: 'Echipament nou' })).toBeInTheDocument()
})

test('salvarea trimite titlul, conținutul și prioritatea noi, apoi reîncarcă lista', async () => {
  const user = userEvent.setup()
  mockedUpdate.mockResolvedValue(anunt('a', 'Antrenament mutat la 18:30'))
  const onChanged = renderList()
  await user.click(screen.getByRole('button', { name: 'Editează anunțul „Antrenament mutat”' }))
  const form = screen.getByRole('form')
  const titlu = within(form).getByLabelText('Titlu')
  await user.clear(titlu)
  await user.type(titlu, '  Antrenament mutat la 18:30 ')
  await user.selectOptions(within(form).getByLabelText('Prioritate'), 'HIGH')
  await user.click(within(form).getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(mockedUpdate).toHaveBeenCalledWith('a', {
      title: 'Antrenament mutat la 18:30',
      content: 'Conținut Antrenament mutat',
      priority: 'HIGH',
    }),
  )
  await waitFor(() => expect(onChanged).toHaveBeenCalled())
  expect(toast.success).toHaveBeenCalledWith('Anunț actualizat.')
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})

test('un titlu gol nu se salvează și arată eroarea pe câmp', async () => {
  const user = userEvent.setup()
  renderList()
  await user.click(screen.getByRole('button', { name: 'Editează anunțul „Echipament nou”' }))
  const form = screen.getByRole('form')
  await user.clear(within(form).getByLabelText('Titlu'))
  await user.click(within(form).getByRole('button', { name: 'Salvează' }))
  expect(await within(form).findByText('Scrie un titlu de cel puțin 2 caractere')).toBeInTheDocument()
  expect(mockedUpdate).not.toHaveBeenCalled()
})

test('„Renunță” închide formularul fără să scrie nimic', async () => {
  const user = userEvent.setup()
  const onChanged = renderList()
  await user.click(screen.getByRole('button', { name: 'Editează anunțul „Echipament nou”' }))
  await user.type(within(screen.getByRole('form')).getByLabelText('Titlu'), ' x')
  await user.click(screen.getByRole('button', { name: 'Renunță' }))
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
  expect(mockedUpdate).not.toHaveBeenCalled()
  expect(onChanged).not.toHaveBeenCalled()
})

test('o salvare refuzată păstrează formularul deschis și anunță eroarea', async () => {
  const user = userEvent.setup()
  mockedUpdate.mockRejectedValue(new Error('RLS'))
  const onChanged = renderList()
  await user.click(screen.getByRole('button', { name: 'Editează anunțul „Echipament nou”' }))
  const form = screen.getByRole('form')
  await user.type(within(form).getByLabelText('Conținut'), ' nou')
  await user.click(within(form).getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Nu am putut salva modificările.'))
  expect(screen.getByRole('form')).toBeInTheDocument()
  expect(onChanged).not.toHaveBeenCalled()
})
