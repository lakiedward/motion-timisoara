import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
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

test('county change clears city and offers only the new county localities', async () => {
  const user = userEvent.setup()
  render(<Fields />)
  expect(screen.getByRole('combobox', { name: 'Oraș' })).toHaveValue('Timișoara')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Județ' }), 'Arad')
  const city = screen.getByRole('combobox', { name: 'Oraș' })
  expect(city).toHaveValue('')
  expect(screen.queryByRole('option', { name: 'Timișoara' })).not.toBeInTheDocument()
  await user.selectOptions(city, 'Arad')
  expect(city).toHaveValue('Arad')
})
