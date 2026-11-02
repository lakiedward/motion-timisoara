import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { openSelectMenu, pickSelectMenuOption, selectMenuTrigger } from '@/test/select-menu'
import LocationAddressFields from './LocationAddressFields'

function Fields() {
  const [county, setCounty] = useState('Timiș')
  const [city, setCity] = useState('Timișoara')
  return (
    <LocationAddressFields
      county={county}
      city={city}
      onCountyChange={(value) => {
        setCounty(value)
        setCity('')
      }}
      onCityChange={setCity}
    />
  )
}

test.each(['Zell am See', 'Radstadt'])(
  'foreign locality %s and its region remain selectable',
  async (city) => {
    render(
      <LocationAddressFields
        county="Salzburg"
        city={city}
        onCountyChange={() => undefined}
        onCityChange={() => undefined}
      />,
    )
    expect(selectMenuTrigger('Județ / regiune')).toHaveTextContent('Salzburg')
    expect(selectMenuTrigger('Oraș')).toHaveTextContent(city)
    await openSelectMenu('Oraș')
    expect(screen.getByRole('menuitemradio', { name: city })).toHaveAttribute('aria-checked', 'true')
  },
)

test('county change clears city and offers only the new county localities', async () => {
  render(<Fields />)
  expect(selectMenuTrigger('Oraș')).toHaveTextContent('Timișoara')
  await pickSelectMenuOption('Județ / regiune', 'Arad')
  expect(selectMenuTrigger('Oraș')).toHaveTextContent('Alege orașul sau localitatea')
  const user = await openSelectMenu('Oraș')
  expect(screen.queryByRole('menuitemradio', { name: 'Timișoara' })).not.toBeInTheDocument()
  await user.type(screen.getByRole('searchbox'), 'arad')
  await user.click(screen.getByRole('menuitemradio', { name: 'Arad' }))
  expect(selectMenuTrigger('Oraș')).toHaveTextContent('Arad')
})
