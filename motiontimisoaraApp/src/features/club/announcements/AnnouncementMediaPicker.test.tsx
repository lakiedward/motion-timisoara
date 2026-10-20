import { useState } from 'react'
import { vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'

import AnnouncementMediaPicker from './AnnouncementMediaPicker'
import type { FisierPregatit } from '@/lib/media'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/lib/galerie', () => ({ galeriaSeDeschideNativ: () => false, alegeDinGalerie: vi.fn() }))

const MB = 1024 * 1024

function file(name: string, type: string, size = 2048): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

function Harness() {
  const [files, setFiles] = useState<FisierPregatit[]>([])
  return <AnnouncementMediaPicker files={files} onChange={setFiles} />
}

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

test('alegerea fișierelor e un buton în română, fără inputul nativ vizibil', () => {
  render(<Harness />)
  expect(screen.getByRole('button', { name: 'Adaugă poze sau filmare' })).toBeVisible()
  expect(screen.getByLabelText('Alege poze sau filmare')).toHaveClass('hidden')
  expect(screen.getByText(/0 din 6 poze · 0 din 1 filmare/)).toBeInTheDocument()
})

test('fiecare fișier ales arată miniatura sau iconița, numele, mărimea și Scoate', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.upload(screen.getByLabelText('Alege poze sau filmare'), [
    file('bazin.jpg', 'image/jpeg', 300 * 1024),
    file('start.mp4', 'video/mp4', 5 * MB),
  ])
  const items = await screen.findAllByRole('listitem', {}, { timeout: 4000 })
  expect(items).toHaveLength(2)
  expect(within(items[0]).getByText('bazin.jpg')).toBeInTheDocument()
  expect(within(items[0]).getByText('300 KB')).toBeInTheDocument()
  expect(items[0].querySelector('img')?.getAttribute('src')).toBe('blob:preview')
  expect(within(items[1]).getByText('start.mp4')).toBeInTheDocument()
  expect(within(items[1]).getByText('5 MB')).toBeInTheDocument()
  expect(items[1].querySelector('img')).toBeNull()
  expect(
    screen.getByText(/1 din 6 poze · 1 din 1 filmare\. Filmarea se șterge pe/),
  ).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Scoate bazin.jpg' }))
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  expect(screen.queryByText('bazin.jpg')).not.toBeInTheDocument()
})

test('o filmare peste 50 MB e respinsă cu mesaj, înainte de încărcare', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.upload(screen.getByLabelText('Alege poze sau filmare'), [
    file('lung.mp4', 'video/mp4', 80 * MB),
  ])
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('limita e 50 MB'))
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
})
