import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'

import type { AtasamentAfisabil } from '@/api/attachments'
import AnnouncementMedia from './AnnouncementMedia'

function attachment(overrides: Partial<AtasamentAfisabil> = {}): AtasamentAfisabil {
  return {
    id: 'image-1',
    fel: 'IMAGE',
    link: 'https://motion.example/photo.jpg',
    contentType: 'image/jpeg',
    expiraLa: null,
    ...overrides,
  }
}

afterEach(cleanup)

test('opens the photo with the keyboard, traps focus and returns it after Escape', async () => {
  const user = userEvent.setup()
  render(
    <>
      <AnnouncementMedia atasamente={[attachment(), attachment({ id: 'image-2' })]} />
      <button type="button">Următorul anunț</button>
    </>,
  )
  const secondPhoto = screen.getByRole('button', { name: 'Deschide poza 2 din 2' })
  secondPhoto.focus()
  await user.keyboard('{Enter}')

  const dialog = await screen.findByRole('dialog', { name: 'Poză mărită 2 din 2' })
  expect(within(dialog).getByRole('img')).toHaveAttribute('src', 'https://motion.example/photo.jpg')
  const close = within(dialog).getByRole('button', { name: 'Închide poza' })
  await waitFor(() => expect(close).toHaveFocus())
  await user.tab()
  expect(close).toHaveFocus()
  await user.tab({ shift: true })
  expect(close).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await waitFor(() => expect(secondPhoto).toHaveFocus())
})

test('the close button restores the photo trigger focus', async () => {
  const user = userEvent.setup()
  render(<AnnouncementMedia atasamente={[attachment()]} />)
  const photo = screen.getByRole('button', { name: 'Deschide poza 1 din 1' })
  await user.click(photo)
  await user.click(screen.getByRole('button', { name: 'Închide poza' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await waitFor(() => expect(photo).toHaveFocus())
})

test.each(['http', 'https'])(
  'shows descriptive %s links with safe external navigation',
  (protocol) => {
    const link = `${protocol}://motion.example/Program%20tabara.pdf?token=private`
    render(<AnnouncementMedia atasamente={[attachment({ fel: 'URL', link })]} />)
    const anchor = screen.getByRole('link', {
      name: 'Program tabara.pdf (motion.example) (se deschide într-o filă nouă)',
    })
    expect(anchor).toHaveAttribute('href', link)
    expect(anchor).toHaveAttribute('target', '_blank')
    expect(anchor).toHaveAttribute('rel', 'noopener noreferrer')
    expect(anchor).not.toHaveTextContent('private')
  },
)

test.each([
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'file:///private/file.pdf',
  'ftp://motion.example/file.pdf',
  '//motion.example/file.pdf',
  '/file.pdf',
  'https://trusted.example@other.example/file.pdf',
  'invalid URL',
])('does not render unsafe or invalid attachment URL %s', (link) => {
  const { container } = render(
    <AnnouncementMedia atasamente={[attachment({ fel: 'URL', link })]} />,
  )
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(container).toBeEmptyDOMElement()
})

test('uses the hostname when a URL has no filename', () => {
  render(
    <AnnouncementMedia
      atasamente={[attachment({ fel: 'URL', link: 'https://motion.example/' })]}
    />,
  )
  expect(screen.getByRole('link')).toHaveTextContent('motion.example')
})

test('preserves playback, expiry information and downloading of videos', () => {
  render(
    <AnnouncementMedia
      atasamente={[
        attachment({
          fel: 'VIDEO',
          link: 'https://motion.example/training.mp4',
          expiraLa: '2026-09-25T12:00:00Z',
        }),
      ]}
    />,
  )
  expect(screen.getByLabelText('Filmare atașată anunțului')).toHaveAttribute('controls')
  expect(screen.getByText('Filmarea se șterge pe 25 septembrie.')).toBeInTheDocument()
  const download = screen.getByRole('link', { name: 'Descarcă' })
  expect(download).toHaveAttribute('download')
  expect(download).toHaveAttribute('href', 'https://motion.example/training.mp4')
})
