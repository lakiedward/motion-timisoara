import { Label } from '@/components/ui/label'
import { selectClassName } from '@/components/ui/field-styles'
import { citiesForCounty, romanianCounties } from '@/lib/geography/romanian-places'

type Props = {
  county: string
  city: string
  onCountyChange: (county: string) => void
  onCityChange: (city: string) => void
}

export default function LocationAddressFields({
  county,
  city,
  onCountyChange,
  onCityChange,
}: Props) {
  const counties =
    county && !romanianCounties.includes(county) ? [county, ...romanianCounties] : romanianCounties
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="county">Județ / regiune</Label>
        <select
          id="county"
          className={selectClassName}
          value={county}
          onChange={(event) => onCountyChange(event.target.value)}
        >
          <option value="">Alege județul sau regiunea</option>
          {counties.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="city">Oraș</Label>
        <select
          id="city"
          className={selectClassName}
          value={city}
          disabled={!county && !city}
          onChange={(event) => onCityChange(event.target.value)}
        >
          <option value="">
            {county ? 'Alege orașul sau localitatea' : 'Alege întâi județul'}
          </option>
          {citiesForCounty(county, city).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
