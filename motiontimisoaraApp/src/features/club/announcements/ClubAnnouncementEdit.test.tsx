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
      publish_at: null,
      expires_at: null,
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
  expect(
    await within(form).findByText('Scrie un titlu de cel puțin 2 caractere'),
  ).toBeInTheDocument()
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

test('programarea din „Editează” salvează data publicării și a expirării', async () => {
  const user = userEvent.setup()
  mockedUpdate.mockResolvedValue(anunt('a', 'Antrenament mutat'))
  renderList()
  await user.click(screen.getByRole('button', { name: 'Editează anunțul „Antrenament mutat”' }))
  const form = screen.getByRole('form')
  await user.type(within(form).getByLabelText('Ziua publicării'), '2099-10-24')
  await user.type(within(form).getByLabelText('Ora publicării'), '09:00')
  await user.type(within(form).getByLabelText('Ziua expirării'), '2099-10-31')
  await user.type(within(form).getByLabelText('Ora expirării'), '20:00')
  await user.click(within(form).getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(mockedUpdate).toHaveBeenCalledWith('a', {
      title: 'Antrenament mutat',
      content: 'Conținut Antrenament mutat',
      priority: 'URGENT',
      publish_at: '2099-10-24T06:00:00.000Z',
      expires_at: '2099-10-31T18:00:00.000Z',
    }),
  )
})

test('expirarea înaintea publicării arată eroarea și nu salvează', async () => {
  const user = userEvent.setup()
  renderList()
  await user.click(screen.getByRole('button', { name: 'Editează anunțul „Antrenament mutat”' }))
  const form = screen.getByRole('form')
  await user.type(within(form).getByLabelText('Ziua publicării'), '2099-10-24')
  await user.type(within(form).getByLabelText('Ora publicării'), '09:00')
  await user.type(within(form).getByLabelText('Ziua expirării'), '2099-10-23')
  await user.type(within(form).getByLabelText('Ora expirării'), '09:00')
  await user.click(within(form).getByRole('button', { name: 'Salvează' }))
  expect(
    await within(form).findByText('Expirarea trebuie să fie după publicare'),
  ).toBeInTheDocument()
  expect(mockedUpdate).not.toHaveBeenCalled()
})

test('cardul spune când un anunț e programat sau a expirat', () => {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <ClubAnnouncementList
        items={[
          { ...anunt('p', 'Programat'), publish_at: '2099-10-24T06:00:00Z' },
          { ...anunt('e', 'Expirat'), expires_at: '2020-10-24T06:00:00Z' },
        ]}
        tinte={[]}
        tinteNecunoscute={false}
        atasamente={{}}
        onChanged={vi.fn()}
      />
    </QueryClientProvider>,
  )
  const programat = screen.getByRole('heading', { name: 'Programat' }).closest('article')!
  expect(programat).toHaveTextContent('Apare pe 24 octombrie 2099')
  expect(
    within(programat).getByText(
      'Părinții încă nu văd anunțul. Notificarea pleacă la data publicării.',
    ),
  ).toBeInTheDocument()
  const expirat = screen.getByRole('heading', { name: 'Expirat' }).closest('article')!
  expect(expirat).toHaveTextContent('A expirat pe 24 octombrie 2020')
})
