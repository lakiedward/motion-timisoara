import { beforeEach, expect, test, vi } from 'vitest'

import { addressFromNominatim, placeFromNominatim, reverseGeocode, searchPlaces } from './geocoding'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  fetchMock.mockReset()
})

test('addressFromNominatim splits street and city from Nominatim parts', () => {
  expect(
    addressFromNominatim({
      display_name: 'Piața Unirii, Cetate, Timișoara, Timiș, România',
      address: { road: 'Piața Unirii', city: 'Timișoara', county: 'Timiș' },
    }),
  ).toEqual({ address: 'Piața Unirii', city: 'Timișoara' })
})

test('addressFromNominatim joins road and house number', () => {
  expect(
    addressFromNominatim({
      display_name: '34, Bulevardul General Ion Dragalina, Iosefin, Timișoara, România',
      address: { house_number: '34', road: 'Bulevardul General Ion Dragalina', city: 'Timișoara' },
    }),
  ).toEqual({ address: 'Bulevardul General Ion Dragalina 34', city: 'Timișoara' })
})

test('addressFromNominatim uses town/village when city is missing', () => {
  expect(
    addressFromNominatim({ display_name: 'X', address: { road: 'Strada Mare', town: 'Lugoj' } }),
  ).toEqual({
    address: 'Strada Mare',
    city: 'Lugoj',
  })
})

test('placeFromNominatim drops hits without numeric coordinates', () => {
  expect(placeFromNominatim({ display_name: 'X', lat: 'foo', lon: '21' })).toBeNull()
})

test('searchPlaces asks Nominatim for Romanian results and maps hits', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => [
      {
        place_id: 11,
        display_name: 'Piața Unirii, Timișoara, România',
        lat: '45.757',
        lon: '21.229',
        address: { road: 'Piața Unirii', city: 'Timișoara' },
      },
    ],
  })
  const hits = await searchPlaces('Piata Unirii')
  expect(hits).toEqual([
    {
      id: '11',
      label: 'Piața Unirii, Timișoara, România',
      lat: 45.757,
      lng: 21.229,
      address: 'Piața Unirii',
      city: 'Timișoara',
    },
  ])
  const url = String(fetchMock.mock.calls[0][0])
  expect(url).toContain('nominatim.openstreetmap.org/search')
  expect(url).toContain('countrycodes=ro')
  expect(url).toContain('q=Piata+Unirii')
})

test('searchPlaces returns nothing for a one-letter query without calling the network', async () => {
  expect(await searchPlaces('T')).toEqual([])
  expect(fetchMock).not.toHaveBeenCalled()
})

test('reverseGeocode reads city and street from Nominatim', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      display_name: 'Strada Alba, Timișoara',
      lat: '45.75',
      lon: '21.22',
      address: { road: 'Strada Alba', city: 'Timișoara' },
    }),
  })
  expect(await reverseGeocode(45.75, 21.22)).toEqual({ address: 'Strada Alba', city: 'Timișoara' })
})

test('reverseGeocode returns null when Nominatim cannot geocode', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ error: 'Unable to geocode' }),
  })
  expect(await reverseGeocode(0, 0)).toBeNull()
})
