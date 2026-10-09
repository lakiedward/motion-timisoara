import { useRef, useState } from 'react'
import { useWatch, type Control, type UseFormSetValue } from 'react-hook-form'

import LocationPicker from '@/components/LocationPicker'
import LocationAddressFields from '@/features/club/location-form/LocationAddressFields'
import { cityForCounty, countyForCity, normalizeCounty } from '@/lib/geography/romanian-places'
import type { ClubProfileValues } from './clubProfileSchema'

export default function ClubAddressFields({
  control,
  setValue,
}: {
  control: Control<ClubProfileValues>
  setValue: UseFormSetValue<ClubProfileValues>
}) {
  const activeVersion = useRef(0)
  const [pickerVersion, setPickerVersion] = useState(0)
  const county = useWatch({ control, name: 'county' }) ?? ''
  const city = useWatch({ control, name: 'city' }) ?? ''
  const address = useWatch({ control, name: 'address' }) ?? ''
  const lat = useWatch({ control, name: 'lat' })
  const lng = useWatch({ control, name: 'lng' })
  const point = typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null
  const dirty = { shouldDirty: true }
  const restartPicker = () => {
    activeVersion.current += 1
    setPickerVersion(activeVersion.current)
  }

  return (
    <div className="space-y-4">
      <LocationAddressFields
        county={county}
        city={city}
        onCountyChange={(nextCounty) => {
          restartPicker()
          setValue('county', nextCounty, dirty)
          setValue('city', '', dirty)
        }}
        onCityChange={(nextCity) => {
          restartPicker()
          setValue('city', nextCity, dirty)
        }}
      />
      <LocationPicker
        key={pickerVersion}
        value={point}
        address={address}
        onAddressChange={(nextAddress) => setValue('address', nextAddress, dirty)}
        onChange={(picked) => {
          if (activeVersion.current !== pickerVersion) return
          setValue('lat', picked.lat, dirty)
          setValue('lng', picked.lng, dirty)
          if (!picked.resolved) return
          const nextCounty =
            normalizeCounty(picked.county) ?? picked.county ?? countyForCity(picked.city) ?? ''
          setValue('county', nextCounty, dirty)
          setValue('city', picked.city ? cityForCounty(picked.city, nextCounty) : '', dirty)
          setValue('address', picked.address ?? '', dirty)
        }}
      />
    </div>
  )
}
