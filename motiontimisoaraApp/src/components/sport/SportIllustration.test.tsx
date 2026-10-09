import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { SportIllustration } from './SportIllustration'

test.each(['alergare', 'atletism', 'ciclism', 'gimnastica', 'inot', 'triatlon'])(
  'known sport %s gets its own glyph and color',
  (code) => {
    render(<SportIllustration code={code} name="Sport" />)
    const art = screen.getByRole('img', { name: 'Ilustrație Sport' })
    expect(art).toHaveAttribute('data-sport-illustration', code)
    expect(art.getAttribute('style')).toContain('color-mix')
    expect(art.querySelector('svg')).not.toBeNull()
    expect(screen.getByText('Sport')).toBeVisible()
  },
)

test('distinct sports use distinct glyphs', () => {
  const { container } = render(
    <>
      {['alergare', 'atletism', 'ciclism', 'gimnastica', 'inot', 'triatlon'].map((code) => (
        <SportIllustration key={code} code={code} />
      ))}
    </>,
  )
  const glyphs = [...container.querySelectorAll('svg')].map((svg) => svg.getAttribute('class'))
  expect(new Set(glyphs).size).toBe(6)
})

test('an unknown or missing sport still gets a generic illustration', () => {
  render(<SportIllustration code="padel" name="Padel" />)
  expect(screen.getByRole('img', { name: 'Ilustrație Padel' })).toHaveAttribute(
    'data-sport-illustration',
    'padel',
  )
  render(<SportIllustration />)
  const generic = screen.getByRole('img', { name: 'Ilustrație sport' })
  expect(generic).toHaveAttribute('data-sport-illustration', 'generic')
  expect(generic.querySelector('svg')).not.toBeNull()
})

test('compact illustration hides the name text but keeps the accessible label', () => {
  render(<SportIllustration code="inot" name="Înot" compact />)
  expect(screen.getByRole('img', { name: 'Ilustrație Înot' })).toBeInTheDocument()
  expect(screen.queryByText('Înot')).not.toBeInTheDocument()
})
