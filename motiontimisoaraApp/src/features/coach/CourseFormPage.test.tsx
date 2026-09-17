import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import CourseFormPage from './CourseFormPage'
import { createCourse, getCourseById, getSelectableLocations, updateCourse } from '@/api/coach'
import { fetchSports } from '@/api/sports'

vi.mock('@/api/coach', () => ({
  getSelectableLocations: vi.fn(),
  getCourseById: vi.fn(),
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
}))
vi.mock('@/api/sports', () => ({ fetchSports: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedLocations = vi.mocked(getSelectableLocations)
const mockedSports = vi.mocked(fetchSports)
const mockedExisting = vi.mocked(getCourseById)
const mockedCreate = vi.mocked(createCourse)
const mockedUpdate = vi.mocked(updateCourse)

const LOC = 'b6d97609-d740-44aa-b930-fb222ffadb13'
const SPORT = '4c7a30c1-42a4-4bad-839c-f03d2b90e88a'

function renderForm(ruta = '/coach/courses/new') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/coach/courses/new" element={<CourseFormPage />} />
          <Route path="/coach/courses/:id/edit" element={<CourseFormPage />} />
          <Route path="/coach/courses" element={<p>Lista cursuri</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function completeazaProgram(user: ReturnType<typeof userEvent.setup>, zi = 'Luni') {
  await user.click(screen.getByRole('button', { name: zi }))
  const grup = screen.getByRole('group', { name: zi })
  fireEvent.change(within(grup).getByLabelText('Ora start'), { target: { value: '18:00' } })
  fireEvent.change(within(grup).getByLabelText('Ora final'), { target: { value: '19:30' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedSports.mockResolvedValue([{ id: SPORT, name: 'Înot' }] as never)
  mockedLocations.mockResolvedValue([
    { id: LOC, name: 'Bazin Olimpic Timișoara', city: 'Timișoara' },
  ] as never)
})

test('fără program, salvarea e blocată și cursul nu se creează', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.type(await screen.findByLabelText('Nume curs'), 'Curs fără program')
  await user.selectOptions(screen.getByLabelText('Sport'), SPORT)
  await user.selectOptions(screen.getByLabelText('Locație'), LOC)
  await user.type(screen.getByLabelText('Preț / ședință (lei)'), '80')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(
    await screen.findByText('Selectează cel puțin o zi și completează orele.'),
  ).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('crearea trimite regula și anunță generarea ședințelor', async () => {
  const user = userEvent.setup()
  mockedCreate.mockResolvedValue({ id: 'c-new' } as never)
  renderForm()
  await user.type(await screen.findByLabelText('Nume curs'), 'Înot de seară')
  await user.selectOptions(screen.getByLabelText('Sport'), SPORT)
  await user.selectOptions(screen.getByLabelText('Locație'), LOC)
  await user.type(screen.getByLabelText('Preț / ședință (lei)'), '80')
  await completeazaProgram(user)
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  await waitFor(() => expect(mockedCreate).toHaveBeenCalled())
  expect(mockedCreate.mock.calls[0][0]).toMatchObject({
    name: 'Înot de seară',
    recurrence_rule: JSON.stringify({
      daySchedules: { '1': { start: '18:00', end: '19:30' } },
    }),
  })
  const { toast } = await import('sonner')
  expect(toast.success).toHaveBeenCalledWith('Curs creat. Ședințele au fost generate din program.')
  expect(await screen.findByText('Lista cursuri')).toBeInTheDocument()
})

test('la editare, programul salvat apare selectat', async () => {
  mockedExisting.mockResolvedValue({
    id: 'c1',
    name: 'Înot avansat',
    sport_id: SPORT,
    location_id: LOC,
    level: 'avansat',
    age_from: 9,
    age_to: 14,
    capacity: 14,
    price_per_session: 7500,
    description: '',
    recurrence_rule: JSON.stringify({
      daySchedules: { '3': { start: '16:00', end: '17:00' } },
    }),
  } as never)
  mockedUpdate.mockResolvedValue({ id: 'c1' } as never)
  renderForm('/coach/courses/c1/edit')
  await screen.findByDisplayValue('Înot avansat')
  expect(screen.getByRole('button', { name: 'Miercuri' })).toHaveAttribute('aria-pressed', 'true')
  const grup = screen.getByRole('group', { name: 'Miercuri' })
  expect(within(grup).getByLabelText('Ora start')).toHaveValue('16:00')
  expect(within(grup).getByLabelText('Ora final')).toHaveValue('17:00')
})
