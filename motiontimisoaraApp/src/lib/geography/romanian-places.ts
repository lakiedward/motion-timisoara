import catalogue from './romanian-localities.json'

const localities: Record<string, string[]> = catalogue
const normalizeName = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('ro').trim()

export const romanianCounties = Object.keys(localities).sort((a, b) => a.localeCompare(b, 'ro'))

export function normalizeCounty(value: string | null | undefined): string | null {
  if (!value) return null
  const name = normalizeName(value).replace(/^(judetul|judet|municipiul)\s+/, '')
  return romanianCounties.find((county) => normalizeName(county) === name) ?? null
}

export function countyForCity(city: string | null | undefined): string | null {
  if (!city) return null
  const name = normalizeName(city)
  const counties = romanianCounties.filter((county) =>
    localities[county].some((locality) => normalizeName(locality) === name),
  )
  return counties.length === 1 ? counties[0] : null
}

export function cityForCounty(city: string, county: string): string {
  const name = normalizeName(city)
  return localities[county]?.find((locality) => normalizeName(locality) === name) ?? city
}

export function citiesForCounty(county: string, currentCity = ''): string[] {
  const cities = localities[county] ?? []
  return currentCity && !cities.includes(currentCity) ? [currentCity, ...cities] : cities
}
