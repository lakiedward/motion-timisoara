import { render, screen } from '@testing-library/react'

import { CompetitionEnrollCard } from './CompetitionEnrollCard'

const NOW = Date.parse('2026-11-06T12:00:00Z')

function renderCard(prices: number[]) {
  render(
    <CompetitionEnrollCard
      categoriesAnchor="trasee-si-categorii"
      deadlineAt="2026-12-01T20:00:00Z"
      prices={prices}
      loading={false}
      now={NOW}
    />,
  )
}

test('prețuri diferite arată intervalul și numărul de categorii', () => {
  renderCard([0, 12000, 15000])
  expect(screen.getByText('Gratuit')).toBeVisible()
  expect(screen.getByText(/150,00/)).toBeVisible()
  expect(screen.getByText('3 categorii, fiecare cu prețul ei')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Alege categoria' })).toHaveAttribute(
    'href',
    '#trasee-si-categorii',
  )
})

test('același preț la toate categoriile arată un singur preț', () => {
  renderCard([5000, 5000])
  expect(screen.getByText(/50,00/)).toBeVisible()
  expect(screen.queryByText(/–/)).toBeNull()
  expect(screen.getByText('2 categorii, fiecare cu prețul ei')).toBeVisible()
})

test('o singură categorie nu arată numărul de categorii', () => {
  renderCard([0])
  expect(screen.getByText('Gratuit')).toBeVisible()
  expect(screen.queryByText(/fiecare cu prețul/)).toBeNull()
})
