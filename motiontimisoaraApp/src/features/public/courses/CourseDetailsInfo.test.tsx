import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import type { CourseDetail } from '@/api/public'
import { CourseDetailsInfo } from './CourseDetailsInfo'

const BASE = {
  id: 'curs-1',
  name: 'Înot',
  description: 'Primul paragraf.\n\nAl doilea paragraf.',
  age_from: 6,
  age_to: 10,
  capacity: 12,
  location_id: 'loc-1',
  location: { name: 'Bazin Olimpic Timișoara' },
  recurrence_rule: null,
  occurrences: [],
  coach: { id: 'coach-1', name: 'Ana Pop', avatar_url: null },
  club: null,
  rules_file_storage_path: null,
  rules_file_name: null,
  rules_file_content_type: null,
  rules_file_size_bytes: null,
} as unknown as CourseDetail

function renderInfo(course: Partial<CourseDetail> = {}) {
  return render(
    <MemoryRouter>
      <CourseDetailsInfo course={{ ...BASE, ...course } as CourseDetail} remaining={5} />
    </MemoryRouter>,
  )
}

test('announces the schedule when there are no upcoming sessions', () => {
  renderInfo({
    occurrences: [{ id: 'old', starts_at: '2020-06-17T18:00:00Z', ends_at: '2020-06-17T19:00:00Z' }],
  })
  expect(screen.getByRole('heading', { name: 'Program' })).toBeInTheDocument()
  expect(screen.getByText('Programul se anunță în curând')).toBeInTheDocument()
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
})

test('lists upcoming sessions with the weekly summary', () => {
  renderInfo({
    occurrences: [{ id: 's1', starts_at: '2099-10-14T12:00:00Z', ends_at: '2099-10-14T13:00:00Z' }],
  })
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  expect(screen.getByText('14.10.2099 · 15:00–16:00')).toBeInTheDocument()
  expect(screen.getByText(/În fiecare săptămână/)).toBeInTheDocument()
})

test('keeps description paragraphs and hides the block without a description', () => {
  const { unmount } = renderInfo()
  expect(screen.getByText('Primul paragraf.')).toBeInTheDocument()
  expect(screen.getByText('Al doilea paragraf.')).toBeInTheDocument()
  unmount()
  renderInfo({ description: null })
  expect(screen.queryByRole('heading', { name: 'Despre curs' })).not.toBeInTheDocument()
})

test('links the organizing club only when the course has one', () => {
  const { unmount } = renderInfo()
  expect(screen.queryByText('Organizat de')).not.toBeInTheDocument()
  unmount()
  renderInfo({ club: { id: 'club-1', name: 'Club Delfinul' } })
  expect(screen.getByRole('link', { name: 'Club Delfinul' })).toHaveAttribute(
    'href',
    '/cluburi/club-1',
  )
})

test('keeps the location link to the map and the coach link', () => {
  renderInfo()
  expect(screen.getByRole('link', { name: /Bazin Olimpic Timișoara/ })).toHaveAttribute(
    'href',
    '/harta?location=loc-1',
  )
  expect(screen.getByRole('link', { name: /Ana Pop/ })).toHaveAttribute('href', '/antrenori/coach-1')
  expect(screen.getByText('5 locuri rămase')).toBeInTheDocument()
})
