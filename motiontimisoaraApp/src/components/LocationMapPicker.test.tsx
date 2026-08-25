import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

import { LocationMapPicker } from './LocationMapPicker'
import { reverseGeocode, searchPlaces } from '@/api/geocoding'
import { triggerMapClick } from '@/test/react-leaflet-stub'

vi.mock('react-leaflet', () => import('@/test/react-leaflet-stub'))
vi.mock('leaflet', () => ({
  default: { icon: () => ({}) },
}))
vi.mock('@/api/geocoding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/geocoding')>()
  return {
    ...actual,
    searchPlaces: vi.fn(),
    reverseGeocode: vi.fn(),
  }
})

const mockedSearch = vi.mocked(searchPlaces)
const mockedReverse = vi.mocked(reverseGeocode)

beforeEach(() => {
  vi.clearAllMocks()
  mockedSearch.mockResolvedValue([
    {
      id: '1',
      label: 'Piața Unirii, Timișoara, România',
      lat: 45.757,
      lng: 21.229,
      address: 'Piața Unirii',
      city: 'Timișoara',
    },
  ])
  mockedReverse.mockResolvedValue({ address: 'Strada Alba 1', city: 'Timișoara' })
})

test('choosing a suggestion reports the pin, street and city', async () => {
  const user = userEvent.setup()
  const onPinChange = vi.fn()
  render(<LocationMapPicker pin={null} onPinChange={onPinChange} />)

  await user.type(screen.getByRole('combobox', { name: /caută locul/i }), 'Unirii')
  const option = await screen.findByRole('button', { name: /piața unirii/i }, { timeout: 1500 })
  await user.click(option)

  expect(onPinChange).toHaveBeenCalledWith({
    lat: 45.757,
    lng: 21.229,
    address: 'Piața Unirii',
    city: 'Timișoara',
  })
  expect(mockedReverse).not.toHaveBeenCalled()
})

test('clicking the map drops a pin and reverse-fills address after debounce', async () => {
  const user = userEvent.setup()
  const onPinChange = vi.fn()
  render(<LocationMapPicker pin={null} onPinChange={onPinChange} />)

  triggerMapClick(45.75, 21.22)
  expect(onPinChange).toHaveBeenCalledWith({ lat: 45.75, lng: 21.22 })

  await waitFor(() => expect(mockedReverse).toHaveBeenCalledWith(45.75, 21.22, expect.anything()), {
    timeout: 1500,
  })
  await waitFor(() =>
    expect(onPinChange).toHaveBeenCalledWith({
      lat: 45.75,
      lng: 21.22,
      address: 'Strada Alba 1',
      city: 'Timișoara',
    }),
  )
  expect(user).toBeTruthy()
})

test('dragging the pin asks reverse geocoding for the new place', async () => {
  const user = userEvent.setup()
  const onPinChange = vi.fn()
  render(<LocationMapPicker pin={{ lat: 45.75, lng: 21.22 }} onPinChange={onPinChange} />)

  await user.click(screen.getByTestId('map-pin'))
  expect(onPinChange).toHaveBeenCalledWith({ lat: 45.751, lng: 21.221 })
  await waitFor(() => expect(mockedReverse).toHaveBeenCalled(), { timeout: 1500 })
})

test('shows the pin-missing error without mentioning coordinates', () => {
  render(
    <LocationMapPicker
      pin={null}
      onPinChange={() => undefined}
      error="Lipsește locul pe hartă. Caută o adresă sau pune pinul."
    />,
  )
  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent(/locul pe hartă/i)
  expect(alert.textContent?.toLowerCase()).not.toMatch(/coordonat|latitud|longitud/)
})
