import { Label } from '@/components/ui/label'
import { formSelectMenuClassName } from '@/components/ui/field-styles'
import { SelectMenu } from '@/components/ui/select-menu'
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
        <SelectMenu
          className={formSelectMenuClassName}
          id="county"
          value={county}
          onValueChange={onCountyChange}
          searchable
          searchPlaceholder="Caută județul"
          emptyLabel="Alege județul sau regiunea"
          options={counties.map((name) => ({ value: name, label: name }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="city">Oraș</Label>
        <SelectMenu
          className={formSelectMenuClassName}
          id="city"
          value={city}
          disabled={!county && !city}
          onValueChange={onCityChange}
          searchable
          searchPlaceholder="Caută orașul"
          emptyLabel={county ? 'Alege orașul sau localitatea' : 'Alege întâi județul'}
          options={citiesForCounty(county, city).map((name) => ({ value: name, label: name }))}
        />
      </div>
    </div>
  )
}
