import { useEffect, useRef, type RefObject } from 'react'
import { useMap } from 'react-leaflet'
import type L from 'leaflet'
import { loculRandului, type Loc } from '@/lib/locuri'

export default function FocusLocation({
  locationId,
  locations,
  markers,
}: {
  locationId: string | null
  locations: Loc[]
  markers: RefObject<Map<string, L.Marker>>
}) {
  const map = useMap()
  const focusedId = useRef<string | null>(null)

  useEffect(() => {
    if (!locationId) {
      focusedId.current = null
      return
    }
    if (focusedId.current === locationId) return
    const location = loculRandului(locations, locationId)
    if (!location) return
    let frame = 0
    let attempts = 0
    const focus = () => {
      const marker = markers.current.get(location.cheie)
      if (!marker?.getPopup()) {
        if (attempts++ < 60) frame = requestAnimationFrame(focus)
        return
      }
      focusedId.current = locationId
      map.setView([location.lat, location.lng], 15, { animate: false })
      marker.openPopup()
    }
    frame = requestAnimationFrame(focus)
    return () => cancelAnimationFrame(frame)
  }, [locationId, locations, map, markers])

  useEffect(() => {
    const container = map.getContainer()
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      for (const marker of markers.current.values()) {
        if (!marker.isPopupOpen()) continue
        marker.closePopup()
        marker.getElement()?.focus()
        event.stopPropagation()
        break
      }
    }
    const reposition = () => {
      for (const marker of markers.current.values()) {
        if (marker.isPopupOpen()) marker.getPopup()?.update()
      }
    }
    container.addEventListener('keydown', closeWithEscape, true)
    map.on('resize', reposition)
    return () => {
      container.removeEventListener('keydown', closeWithEscape, true)
      map.off('resize', reposition)
    }
  }, [map, markers])

  return null
}
