import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { AuthLayout } from './AuthLayout'
import { usesNativeNavigation } from '@/layout/native/native-runtime'

vi.mock('@/layout/native/native-runtime', () => ({ usesNativeNavigation: vi.fn(() => false) }))

afterEach(() => vi.mocked(usesNativeNavigation).mockReturnValue(false))

function renderLayout() {
  return render(
    <MemoryRouter>
      <AuthLayout title="Setează o parolă nouă">formular</AuthLayout>
    </MemoryRouter>,
  )
}

test('desktop brand panel copy is multi-sport, not triathlon', () => {
  renderLayout()
  expect(
    screen.getByRole('heading', { name: /sportul copilului tău, într-un singur cont/i }),
  ).toBeInTheDocument()
  expect(
    screen.getByText(/cluburi, antrenori și cursuri sportive pentru copii în timișoara/i),
  ).toBeInTheDocument()
  expect(screen.queryByText(/triatlon/i)).not.toBeInTheDocument()
})

test('photo-panel and compact brand marks both link home', () => {
  renderLayout()
  const links = screen.getAllByRole('link', { name: /motion timișoara/i })
  expect(links.length).toBe(2)
  for (const link of links) {
    expect(link).toHaveAttribute('href', '/')
  }
})

test('photo panel stays readable if the background image is removed', () => {
  const { container } = renderLayout()
  const img = container.querySelector('img[src="/ui/20230516_184053.webp"]')
  expect(img).toBeTruthy()
  expect(img).toHaveAttribute('alt', '')
  img?.remove()
  expect(
    screen.getByRole('heading', { name: /sportul copilului tău, într-un singur cont/i }),
  ).toBeInTheDocument()
  expect(screen.getByText(/găsești, înscrii și plătești într-un singur loc/i)).toBeInTheDocument()
})

test('photo panel is desktop-only and compact logo wraps the 36px mark', () => {
  const { container } = renderLayout()
  const photoPanel = container.querySelector('img[src="/ui/20230516_184053.webp"]')?.parentElement
  const photoClasses = photoPanel?.className.split(/\s+/) ?? []
  expect(photoClasses).toContain('hidden')
  expect(photoClasses).toContain('lg:block')

  const compactWrap = container.querySelector('.lg\\:hidden')
  expect(compactWrap).toBeTruthy()
  const compactLink = compactWrap?.querySelector('a')
  expect(compactLink).toHaveAttribute('href', '/')
  expect(compactLink?.className).toMatch(/inline-flex/)
})

test('wider landscape forms opt in only inside native navigation', () => {
  const view = render(
    <MemoryRouter>
      <AuthLayout title="Autentificare" nativeLandscapeFields>
        formular
      </AuthLayout>
    </MemoryRouter>,
  )
  expect(view.container.querySelector('.native-landscape-form')).not.toBeInTheDocument()
  vi.mocked(usesNativeNavigation).mockReturnValue(true)
  view.rerender(
    <MemoryRouter>
      <AuthLayout title="Autentificare" nativeLandscapeFields>
        formular
      </AuthLayout>
    </MemoryRouter>,
  )
  expect(view.container.querySelector('.native-landscape-form')).toHaveTextContent('formular')
  view.rerender(
    <MemoryRouter>
      <AuthLayout title="Recuperare">formular</AuthLayout>
    </MemoryRouter>,
  )
  expect(view.container.querySelector('.native-landscape-form')).not.toBeInTheDocument()
})
