import L from 'leaflet'
import campMarkerSvg from './map-icons/camp-marker.svg?raw'
import courseMarkerSvg from './map-icons/course-marker.svg?raw'
import activityMarkerSvg from './map-icons/activity-marker.svg?raw'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

export const markerIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
})

const offerIcons = [
  { type: 'courses', svg: courseMarkerSvg },
  { type: 'activities', svg: activityMarkerSvg },
  { type: 'camps', svg: campMarkerSvg },
] as const

type OfferTypes = Record<(typeof offerIcons)[number]['type'], boolean>

const offerMarkerCache = new Map<string, L.DivIcon>()

export function getOfferMarkerIcon(offers: OfferTypes) {
  const activeIcons = offerIcons.filter((icon) => offers[icon.type])
  if (!activeIcons.length) return markerIcon
  const key = activeIcons.map((icon) => icon.type).join('-')
  const cached = offerMarkerCache.get(key)
  if (cached) return cached
  const width = activeIcons.length * 28 + 16
  const icon = L.divIcon({
    className: 'mt-offer-marker',
    html: activeIcons
      .map((entry) => `<span class="mt-offer-symbol mt-offer-${entry.type}">${entry.svg}</span>`)
      .join(''),
    iconSize: [width, 44],
    iconAnchor: [width / 2, 44],
    popupAnchor: [0, -40],
  })
  offerMarkerCache.set(key, icon)
  return icon
}
