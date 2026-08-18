import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { AuthLayout } from './AuthLayout'

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
  expect(photoPanel?.className).toMatch(/\bhidden\b/)
  expect(photoPanel?.className).toMatch(/\blg:block\b/)

  const compactWrap = container.querySelector('.lg\\:hidden')
  expect(compactWrap).toBeTruthy()
  const compactLink = compactWrap?.querySelector('a')
  expect(compactLink).toHaveAttribute('href', '/')
  expect(compactLink?.className).toMatch(/inline-flex/)
})
