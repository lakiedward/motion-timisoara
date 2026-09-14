import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { getAtasamente } from '@/api/attachments'
import {
  getParentAnnouncementCourses,
  getParentAnnouncementFeed,
  markParentAnnouncementsSeen,
  type AnnouncementCursor,
  type AnnouncementRow,
  type FeedPage,
} from '@/api/announcements/parent'
import AnnouncementsPage from './AnnouncementsPage'

const auth = vi.hoisted(() => ({ userId: 'parent-1' as string | null }))
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: auth.userId ? { id: auth.userId } : null }),
}))
vi.mock('@/api/announcements/parent', () => ({
  getParentAnnouncementCourses: vi.fn(),
  getParentAnnouncementFeed: vi.fn(),
  markParentAnnouncementsSeen: vi.fn(),
}))
vi.mock('@/api/attachments', () => ({ getAtasamente: vi.fn() }))
vi.mock('@/features/live-location/camps/ActiveLocationAnnouncements', () => ({
  ActiveLocationAnnouncements: () => null,
}))

const feedRequest = vi.mocked(getParentAnnouncementFeed)
const coursesRequest = vi.mocked(getParentAnnouncementCourses)
const visitRequest = vi.mocked(markParentAnnouncementsSeen)
const mediaRequest = vi.mocked(getAtasamente)
const visitStartedAt = '2026-09-14T12:00:00Z'
const previousVisitAt = '2026-09-14T07:00:00Z'
const clients: QueryClient[] = []

function announcement(index = 1, overrides: Partial<AnnouncementRow> = {}): AnnouncementRow {
  return {
    id: `announcement-${index}`,
    source: 'coach',
    content: `Mesaj ${index}`,
    title: null,
    authorName: 'Ana Ionescu',
    courseId: 'course-1',
    courseName: 'Înot începători',
    audienceKind: 'COURSE',
    audienceName: 'Înot începători',
    publishedAt: '2026-09-14T08:00:00Z',
    pinned: false,
    ...overrides,
  }
}

function page(
  items: AnnouncementRow[] = [announcement()],
  overrides: Partial<FeedPage> = {},
): FeedPage {
  return {
    items,
    asOf: visitStartedAt,
    previousSeenAt: previousVisitAt,
    nextCursor: null,
    ...overrides,
  }
}

function cursor(item: AnnouncementRow): AnnouncementCursor {
  return {
    id: item.id,
    source: item.source,
    pinned: item.pinned,
    publishedAt: item.publishedAt,
    orderVersion: '11111111111111111111111111111111',
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, retryDelay: 0 },
    },
  })
  clients.push(client)
  const tree = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AnnouncementsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
  const view = render(tree())
  return { ...view, refresh: () => view.rerender(tree()) }
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.userId = 'parent-1'
  feedRequest.mockResolvedValue(page())
  coursesRequest.mockResolvedValue([
    { id: 'course-1', name: 'Înot începători' },
    { id: 'course-2', name: 'Alergare' },
  ])
  visitRequest.mockResolvedValue(undefined)
  mediaRequest.mockResolvedValue({})
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
})

test('shows real authors, a course link, a camp target and the optional title without merging equal source IDs', async () => {
  feedRequest.mockResolvedValue(
    page([
      announcement(1, {
        id: 'shared-id',
        source: 'club',
        authorName: 'Club Audit Motion',
        courseId: null,
        courseName: null,
        audienceKind: 'CAMP',
        audienceName: 'Tabăra de toamnă',
        title: 'Programul taberei',
        content: 'Ședința cu părinții.\n\nVineri, ora 18.',
      }),
      announcement(2, { id: 'shared-id', content: 'Vineri nu avem ședință.' }),
    ]),
  )
  renderPage()

  const title = await screen.findByRole('heading', { name: 'Programul taberei' })
  const camp = within(title.closest('li')!)
  expect(camp.getByText('Club Audit Motion')).toBeInTheDocument()
  expect(camp.getByText('Anunț de club')).toBeInTheDocument()
  expect(camp.getByText('Tabără: Tabăra de toamnă')).toBeInTheDocument()
  expect(camp.getByText(/Ședința cu părinții\./)).toHaveClass('whitespace-pre-wrap')
  const coach = within(screen.getByText('Vineri nu avem ședință.').closest('li')!)
  expect(coach.getByText('Ana Ionescu')).toBeInTheDocument()
  expect(coach.getByText('Anunț de la antrenor')).toBeInTheDocument()
  expect(coach.getByRole('link', { name: 'Înot începători' })).toHaveAttribute(
    'href',
    '/cursuri/course-1',
  )
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
  expect(screen.getByText('2 anunțuri afișate')).toBeInTheDocument()
})

test('waits for a successful first page before recording the visit and preserves new badges after recording it', async () => {
  const loading = deferred<FeedPage>()
  const marking = deferred<void>()
  feedRequest.mockReturnValue(loading.promise)
  visitRequest.mockReturnValue(marking.promise)
  renderPage()
  expect(screen.getByRole('status', { name: 'Se încarcă anunțurile' })).toBeInTheDocument()
  expect(screen.queryByText(/Niciun mesaj încă/)).not.toBeInTheDocument()
  expect(visitRequest).not.toHaveBeenCalled()
  expect(coursesRequest).not.toHaveBeenCalled()

  await act(async () =>
    loading.resolve(page([announcement(), announcement(2, { publishedAt: previousVisitAt })])),
  )
  await waitFor(() => expect(visitRequest).toHaveBeenCalledWith(visitStartedAt, 'parent-1'))
  expect(screen.getAllByText('Nou')).toHaveLength(1)
  await act(async () => marking.resolve())
  expect(screen.getAllByText('Nou')).toHaveLength(1)
  expect(visitRequest).toHaveBeenCalledTimes(1)
})

test('a failed first page does not record a visit or appear empty and can be retried', async () => {
  feedRequest.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(page())
  renderPage()
  const retry = await screen.findByRole('button', { name: 'Reîncearcă' })
  expect(screen.getByText('Nu am putut încărca anunțurile.')).toBeInTheDocument()
  expect(screen.queryByText(/Niciun mesaj încă/)).not.toBeInTheDocument()
  expect(visitRequest).not.toHaveBeenCalled()
  await userEvent.click(retry)
  expect(await screen.findByText('Mesaj 1')).toBeInTheDocument()
  await waitFor(() => expect(visitRequest).toHaveBeenCalledTimes(1))
  expect(feedRequest).toHaveBeenCalledTimes(2)
})

test('requests additional server pages only on demand and keeps the original newness baseline through paging and filtering', async () => {
  const firstRows = Array.from({ length: 20 }, (_, index) => announcement(index + 1))
  const first = page(firstRows, { nextCursor: cursor(firstRows[19]) })
  feedRequest.mockImplementation(async (request) => {
    if (request?.courseId)
      return page([announcement(30, { courseId: 'course-2', courseName: 'Alergare' })], {
        previousSeenAt: visitStartedAt,
      })
    if (request?.cursor) return page([announcement(21)], { previousSeenAt: visitStartedAt })
    return first
  })
  renderPage()
  await screen.findByText('20 anunțuri afișate')
  await waitFor(() => expect(visitRequest).toHaveBeenCalledTimes(1))
  expect(feedRequest).toHaveBeenCalledTimes(1)
  expect(screen.getAllByText('Nou')).toHaveLength(20)
  await userEvent.click(screen.getByRole('button', { name: 'Încarcă mai multe' }))
  expect(await screen.findByText('21 anunțuri afișate')).toBeInTheDocument()
  expect(feedRequest).toHaveBeenLastCalledWith({
    courseId: undefined,
    cursor: first.nextCursor,
    asOf: visitStartedAt,
  })
  expect(screen.getAllByText('Nou')).toHaveLength(21)
  expect(screen.queryByRole('button', { name: 'Încarcă mai multe' })).not.toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Filtrează după curs'), 'course-2')
  expect(await screen.findByText('Mesaj 30')).toBeInTheDocument()
  expect(screen.queryByText('Mesaj 1')).not.toBeInTheDocument()
  expect(screen.getByText('Nou')).toBeInTheDocument()
  expect(feedRequest).toHaveBeenLastCalledWith({
    courseId: 'course-2',
    cursor: undefined,
    asOf: visitStartedAt,
  })
  expect(visitRequest).toHaveBeenCalledTimes(1)
  await userEvent.selectOptions(screen.getByLabelText('Filtrează după curs'), '')
  expect(await screen.findByText('20 anunțuri afișate')).toBeInTheDocument()
  expect(screen.queryByText('Mesaj 21')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Încarcă mai multe' }))
  expect(await screen.findByText('21 anunțuri afișate')).toBeInTheDocument()
  expect(feedRequest).toHaveBeenCalledTimes(5)
  expect(feedRequest.mock.calls[3][0]).toEqual({
    courseId: undefined,
    cursor: undefined,
    asOf: visitStartedAt,
  })
})

test('retains the first page after a next-page error and retries from the same cursor', async () => {
  const firstRows = Array.from({ length: 20 }, (_, index) => announcement(index + 1))
  const first = page(firstRows, { nextCursor: cursor(firstRows[19]) })
  feedRequest
    .mockResolvedValueOnce(first)
    .mockRejectedValueOnce(new Error('Network interrupted'))
    .mockResolvedValueOnce(page([announcement(21)]))
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Încarcă mai multe' }))
  const retry = await screen.findByRole('button', { name: 'Reîncearcă încărcarea' })
  expect(screen.getByText('20 anunțuri afișate')).toBeInTheDocument()
  expect(screen.getByText('Mesaj 1')).toBeInTheDocument()
  expect(screen.queryByText(/Niciun mesaj încă/)).not.toBeInTheDocument()
  await userEvent.click(retry)
  expect(await screen.findByText('21 anunțuri afișate')).toBeInTheDocument()
  expect(feedRequest.mock.calls[1]).toEqual(feedRequest.mock.calls[2])
  expect(feedRequest).toHaveBeenCalledTimes(3)
  expect(screen.queryByRole('button', { name: 'Reîncearcă încărcarea' })).not.toBeInTheDocument()
})

test('changing course resets pagination and an empty filtered result can return to all announcements', async () => {
  feedRequest.mockImplementation(async (request) => (request?.courseId ? page([]) : page()))
  renderPage()
  await screen.findByText('Mesaj 1')
  await userEvent.selectOptions(screen.getByLabelText('Filtrează după curs'), 'course-2')
  expect(await screen.findByText('Niciun anunț pentru cursul ales.')).toBeInTheDocument()
  expect(screen.queryByText('Mesaj 1')).not.toBeInTheDocument()
  expect(screen.queryByText(/Niciun mesaj încă/)).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Arată toate anunțurile' }))
  expect(await screen.findByText('Mesaj 1')).toBeInTheDocument()
  expect(screen.getByLabelText('Filtrează după curs')).toHaveValue('')
  expect(visitRequest).toHaveBeenCalledTimes(1)
})

test('a filtered request error keeps the selected course and retries that filter', async () => {
  feedRequest
    .mockResolvedValueOnce(page())
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(page([announcement(2)]))
  renderPage()
  await screen.findByText('Mesaj 1')
  await userEvent.selectOptions(screen.getByLabelText('Filtrează după curs'), 'course-2')
  await userEvent.click(await screen.findByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('Mesaj 2')).toBeInTheDocument()
  expect(screen.getByLabelText('Filtrează după curs')).toHaveValue('course-2')
  expect(feedRequest.mock.calls[1]).toEqual(feedRequest.mock.calls[2])
})

test('a successful empty feed names both announcement sources', async () => {
  feedRequest.mockResolvedValue(page([]))
  renderPage()
  const empty = await screen.findByText(/Niciun mesaj încă/)
  expect(empty).toHaveTextContent('cursurile copiilor tăi')
  expect(empty).toHaveTextContent('cluburile la care sunt înscriși')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(mediaRequest).not.toHaveBeenCalled()
})

test('loads club and coach attachments independently even when announcement IDs coincide', async () => {
  feedRequest.mockResolvedValue(
    page([
      announcement(1, { id: 'same', source: 'club', content: 'Mesaj club' }),
      announcement(2, { id: 'same', content: 'Mesaj antrenor' }),
    ]),
  )
  mediaRequest.mockImplementation(async (_ids, source = 'club') => ({
    same: [
      {
        id: `attachment-${source}`,
        fel: 'URL',
        link: `https://motion.example/${source}.pdf`,
        contentType: null,
        expiraLa: null,
      },
    ],
  }))
  renderPage()
  await screen.findByRole('link', { name: /coach.pdf/ })
  const club = within(screen.getByText('Mesaj club').closest('li')!)
  const coach = within(screen.getByText('Mesaj antrenor').closest('li')!)
  expect(club.getByRole('link', { name: /club.pdf/ })).toBeInTheDocument()
  expect(club.queryByRole('link', { name: /coach.pdf/ })).not.toBeInTheDocument()
  expect(coach.getByRole('link', { name: /coach.pdf/ })).toBeInTheDocument()
  expect(coach.queryByRole('link', { name: /club.pdf/ })).not.toBeInTheDocument()
  expect(mediaRequest).toHaveBeenCalledWith(['same'])
  expect(mediaRequest).toHaveBeenCalledWith(['same'], 'coach')
})

test('an attachment failure keeps announcement text and offers a working media retry', async () => {
  let failMedia = true
  mediaRequest.mockImplementation(
    async (_ids, source = 'club'): ReturnType<typeof getAtasamente> => {
      if (source === 'coach' && failMedia) throw new Error('Storage unavailable')
      return source === 'coach'
        ? {
            'announcement-1': [
              {
                id: 'file',
                fel: 'URL',
                link: 'https://motion.example/program.pdf',
                contentType: null,
                expiraLa: null,
              },
            ],
          }
        : {}
    },
  )
  renderPage()
  const retry = await screen.findByRole('button', { name: 'Reîncearcă atașamentele' })
  expect(screen.getByText('Mesaj 1')).toBeInTheDocument()
  failMedia = false
  await userEvent.click(retry)
  expect(await screen.findByRole('link', { name: /program.pdf/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reîncearcă atașamentele' })).not.toBeInTheDocument()
  expect(feedRequest).toHaveBeenCalledTimes(1)
})

test('switching account does not expose cached rows or attachments from the previous parent', async () => {
  const secondParent = deferred<FeedPage>()
  feedRequest
    .mockResolvedValueOnce(page([announcement(1, { content: 'Mesaj privat părinte unu' })]))
    .mockReturnValueOnce(secondParent.promise)
  mediaRequest.mockImplementation(async () => ({
    'announcement-1': [
      {
        id: 'private-file',
        fel: 'URL',
        link: `https://motion.example/${auth.userId}.pdf`,
        contentType: null,
        expiraLa: null,
      },
    ],
  }))
  const view = renderPage()
  await screen.findByRole('link', { name: /parent-1.pdf/ })
  auth.userId = 'parent-2'
  view.refresh()
  expect(screen.queryByText('Mesaj privat părinte unu')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /parent-1.pdf/ })).not.toBeInTheDocument()
  expect(screen.getByRole('status', { name: 'Se încarcă anunțurile' })).toBeInTheDocument()
  await act(async () =>
    secondParent.resolve(page([announcement(1, { content: 'Mesaj privat părinte doi' })])),
  )
  expect(await screen.findByRole('link', { name: /parent-2.pdf/ })).toBeInTheDocument()
  expect(screen.getByText('Mesaj privat părinte doi')).toBeInTheDocument()
  expect(screen.queryByText('Mesaj privat părinte unu')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /parent-1.pdf/ })).not.toBeInTheDocument()
  expect(feedRequest).toHaveBeenCalledTimes(2)
})

test('a course-list failure does not hide announcements and retries independently', async () => {
  coursesRequest
    .mockRejectedValueOnce(new Error('Courses unavailable'))
    .mockResolvedValueOnce([{ id: 'course-1', name: 'Înot începători' }])
  renderPage()
  const retry = await screen.findByRole('button', { name: 'Reîncearcă lista cursurilor' })
  expect(screen.getByText('Mesaj 1')).toBeInTheDocument()
  await userEvent.click(retry)
  expect(await screen.findByLabelText('Filtrează după curs')).toBeInTheDocument()
  expect(screen.queryByText('Nu am putut încărca lista cursurilor.')).not.toBeInTheDocument()
  expect(feedRequest).toHaveBeenCalledTimes(1)
  expect(visitRequest).toHaveBeenCalledTimes(1)
})

test('a failed visit record can be retried without changing the current new badges', async () => {
  visitRequest.mockRejectedValue(new Error('Saving unavailable'))
  renderPage()
  const retry = await screen.findByRole('button', { name: 'Reîncearcă salvarea vizitei' })
  expect(screen.getByText('Nou')).toBeInTheDocument()
  visitRequest.mockResolvedValue(undefined)
  await userEvent.click(retry)
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Reîncearcă salvarea vizitei' }),
    ).not.toBeInTheDocument(),
  )
  expect(screen.getByText('Nou')).toBeInTheDocument()
  expect(feedRequest).toHaveBeenCalledTimes(1)
})

test('a visit retry after switching accounts remains bound to the original parent', async () => {
  const oldVisit = deferred<void>()
  const newFeed = deferred<FeedPage>()
  const newVisitStartedAt = '2026-09-14T12:10:00Z'
  const writes: { userId: string; asOf: string }[] = []
  feedRequest.mockResolvedValueOnce(page()).mockReturnValueOnce(newFeed.promise)
  visitRequest.mockImplementation(async (asOf, expectedUserId) => {
    if (visitRequest.mock.calls.length === 1) return oldVisit.promise
    if (auth.userId !== expectedUserId) throw new Error('Account changed')
    writes.push({ userId: expectedUserId, asOf })
  })
  const view = renderPage()
  await waitFor(() => expect(visitRequest).toHaveBeenCalledWith(visitStartedAt, 'parent-1'))
  auth.userId = 'parent-2'
  view.refresh()
  await act(async () => oldVisit.reject(new Error('Connection interrupted')))
  await waitFor(() => expect(visitRequest).toHaveBeenCalledTimes(2))
  expect(visitRequest.mock.calls[1]).toEqual([visitStartedAt, 'parent-1'])
  expect(writes).toEqual([])
  await act(async () => newFeed.resolve(page([announcement(2)], { asOf: newVisitStartedAt })))
  await waitFor(() => expect(writes).toEqual([{ userId: 'parent-2', asOf: newVisitStartedAt }]))
  expect(screen.getByText('Mesaj 2')).toBeInTheDocument()
  expect(screen.queryByText('Mesaj 1')).not.toBeInTheDocument()
})

test('an order conflict reloads the complete list without mixing old pages or clearing new badges', async () => {
  const firstRows = Array.from({ length: 20 }, (_, index) => announcement(index + 1))
  const laterRows = Array.from({ length: 20 }, (_, index) => announcement(index + 21))
  const reordered = page(laterRows, {
    previousSeenAt: visitStartedAt,
    nextCursor: { ...cursor(laterRows[19]), orderVersion: '22222222222222222222222222222222' },
  })
  feedRequest
    .mockResolvedValueOnce(page(firstRows, { nextCursor: cursor(firstRows[19]) }))
    .mockResolvedValueOnce(page(laterRows, { nextCursor: cursor(laterRows[19]) }))
    .mockRejectedValueOnce({ code: 'PT409', message: 'Announcement order changed' })
    .mockResolvedValueOnce(reordered)
    .mockResolvedValueOnce(page(firstRows, { previousSeenAt: visitStartedAt }))
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Încarcă mai multe' }))
  await screen.findByText('40 anunțuri afișate')
  await userEvent.click(screen.getByRole('button', { name: 'Încarcă mai multe' }))
  const reload = await screen.findByRole('button', { name: 'Reîncarcă lista' })
  expect(
    screen.getByText(
      'Lista anunțurilor s-a schimbat. Reîncarcă lista pentru a vedea ordinea actuală.',
    ),
  ).toBeInTheDocument()
  expect(screen.getByText('40 anunțuri afișate')).toBeInTheDocument()
  await userEvent.click(reload)
  await screen.findByText('20 anunțuri afișate')
  expect(screen.queryByText('Mesaj 1')).not.toBeInTheDocument()
  expect(screen.getAllByText('Mesaj 21')).toHaveLength(1)
  expect(screen.getAllByText('Nou')).toHaveLength(20)
  expect(feedRequest.mock.calls[3][0]).toEqual({
    courseId: undefined,
    cursor: undefined,
    asOf: visitStartedAt,
  })
  await userEvent.click(screen.getByRole('button', { name: 'Încarcă mai multe' }))
  await screen.findByText('40 anunțuri afișate')
  expect(screen.getAllByText('Mesaj 1')).toHaveLength(1)
  expect(screen.getAllByText('Mesaj 21')).toHaveLength(1)
  expect(feedRequest.mock.calls[4][0]?.cursor).toEqual(reordered.nextCursor)
  expect(screen.getAllByText('Nou')).toHaveLength(40)
  expect(visitRequest).toHaveBeenCalledTimes(1)
})
